import axios from 'axios';
import net from 'net';
import tls from 'tls';
import dns from 'dns';
import http from 'http';
import ping from 'ping';
import MonitorModel from '../models/Monitor.js';
import NotificationService from './notificationService.js';
import { matchStatusCode, checkKeyword, parseTcpTarget } from '../utils/checkUtils.js';

const dnsPromises = dns.promises;

class MonitorService {
  constructor(io) {
    this.io = io; // Socket.io instance for real-time updates
    this.failCounts = new Map(); // monitorId -> 连续失败次数（用于故障确认）
  }

  // 执行 HTTP/HTTPS 检测
  async checkHttp(monitor) {
    const config = monitor.config ? JSON.parse(monitor.config) : {};
    const startTime = Date.now();

    try {
      const response = await axios({
        method: config.method || 'GET',
        url: monitor.target,
        timeout: monitor.timeout * 1000,
        validateStatus: () => true, // 不自动抛出错误
        headers: config.headers || {},
        maxRedirects: config.followRedirects !== false ? 5 : 0,
        maxBodyLength: 5 * 1024 * 1024,
        signal: AbortSignal.timeout(monitor.timeout * 1000 + 2000)
      });

      const responseTime = Date.now() - startTime;

      // 状态码检查（支持 200,204,300-399 这类写法）
      if (!matchStatusCode(response.status, config.expectedStatusCode)) {
        return {
          status: 'down',
          responseTime,
          statusCode: response.status,
          errorMessage: `Expected status ${config.expectedStatusCode || '2xx'}, got ${response.status}`
        };
      }

      // 关键词检查
      const keywordError = checkKeyword(
        response.data,
        config.keyword,
        config.invertKeyword
      );
      if (keywordError) {
        return {
          status: 'down',
          responseTime,
          statusCode: response.status,
          errorMessage: keywordError
        };
      }

      return {
        status: 'up',
        responseTime,
        statusCode: response.status,
        errorMessage: null
      };
    } catch (error) {
      return {
        status: 'down',
        responseTime: Date.now() - startTime,
        statusCode: null,
        errorMessage: error.message
      };
    }
  }

  // 执行 TCP 端口检测
  async checkTcp(monitor) {
    const parsed = parseTcpTarget(monitor.target);

    if (!parsed) {
      return {
        status: 'down',
        responseTime: 0,
        errorMessage: 'Invalid TCP target format. Expected: host:port'
      };
    }

    return new Promise((resolve) => {
      const startTime = Date.now();
      const socket = new net.Socket();

      socket.setTimeout(monitor.timeout * 1000);

      socket.connect(parsed.port, parsed.host, () => {
        socket.destroy();
        resolve({
          status: 'up',
          responseTime: Date.now() - startTime,
          statusCode: null,
          errorMessage: null
        });
      });

      socket.on('error', (err) => {
        socket.destroy();
        resolve({
          status: 'down',
          responseTime: Date.now() - startTime,
          statusCode: null,
          errorMessage: err.message
        });
      });

      socket.on('timeout', () => {
        socket.destroy();
        resolve({
          status: 'down',
          responseTime: Date.now() - startTime,
          statusCode: null,
          errorMessage: 'Connection timeout'
        });
      });
    });
  }

  // 执行 Ping 检测
  async checkPing(monitor) {
    const startTime = Date.now();

    try {
      const result = await ping.promise.probe(monitor.target, {
        timeout: monitor.timeout,
        min_reply: 1
      });

      const responseTime = Date.now() - startTime;

      return {
        status: result.alive ? 'up' : 'down',
        responseTime: result.alive ? Math.round(parseFloat(result.time)) : responseTime,
        statusCode: null,
        errorMessage: result.alive ? null : 'Host unreachable'
      };
    } catch (error) {
      return {
        status: 'down',
        responseTime: Date.now() - startTime,
        statusCode: null,
        errorMessage: error.message
      };
    }
  }

  // SSL 证书检测：验证证书有效性并计算剩余天数
  checkSsl(monitor) {
    return new Promise((resolve) => {
      const startTime = Date.now();
      const [host, portStr] = monitor.target.split(':');
      const port = parseInt(portStr, 10) || 443;

      const socket = tls.connect(
        { host: host.trim(), port, servername: host.trim(), rejectUnauthorized: false, timeout: monitor.timeout * 1000 },
        () => {
          try {
            const cert = socket.getPeerCertificate();
            socket.end();

            if (!cert || !cert.valid_to) {
              resolve({ status: 'down', responseTime: Date.now() - startTime, errorMessage: 'No certificate found' });
              return;
            }

            const validTo = new Date(cert.valid_to);
            const daysRemaining = Math.floor((validTo - Date.now()) / 86400000);

            if (daysRemaining < 0) {
              resolve({
                status: 'down',
                responseTime: Date.now() - startTime,
                errorMessage: `Certificate expired on ${cert.valid_to}`,
                extra: { daysRemaining, validTo: cert.valid_to, issuer: cert.issuer?.O || null }
              });
              return;
            }

            resolve({
              status: 'up',
              responseTime: Date.now() - startTime,
              errorMessage: null,
              extra: { daysRemaining, validTo: cert.valid_to, issuer: cert.issuer?.O || null }
            });
          } catch (err) {
            resolve({ status: 'down', responseTime: Date.now() - startTime, errorMessage: err.message });
          }
        }
      );

      socket.on('error', (err) => {
        resolve({ status: 'down', responseTime: Date.now() - startTime, errorMessage: err.message });
      });
      socket.on('timeout', () => {
        socket.destroy();
        resolve({ status: 'down', responseTime: Date.now() - startTime, errorMessage: 'TLS handshake timeout' });
      });
    });
  }

  // 域名到期检测（通过 RDAP 协议查询）
  async checkDomain(monitor) {
    const startTime = Date.now();
    const domain = monitor.target.replace(/^https?:\/\//, '').split('/')[0].trim();

    try {
      const res = await fetch(`https://rdap.org/domain/${encodeURIComponent(domain)}`, {
        headers: { Accept: 'application/rdap+json' },
        signal: AbortSignal.timeout(Math.max(5, monitor.timeout) * 1000)
      });

      if (!res.ok) {
        return {
          status: 'down',
          responseTime: Date.now() - startTime,
          errorMessage: `RDAP query failed with ${res.status}`
        };
      }

      const data = await res.json();
      const expirationEvent = (data.events || []).find(e => e.eventAction === 'expiration');

      if (!expirationEvent) {
        return {
          status: 'down',
          responseTime: Date.now() - startTime,
          errorMessage: 'No expiration event in RDAP response'
        };
      }

      const expiresAt = new Date(expirationEvent.eventDate);
      const daysRemaining = Math.floor((expiresAt - Date.now()) / 86400000);

      return {
        status: daysRemaining < 0 ? 'down' : 'up',
        responseTime: Date.now() - startTime,
        errorMessage: daysRemaining < 0 ? `Domain expired on ${expiresAt.toISOString().slice(0, 10)}` : null,
        extra: { daysRemaining, expiresAt: expirationEvent.eventDate }
      };
    } catch (error) {
      return {
        status: 'down',
        responseTime: Date.now() - startTime,
        errorMessage: error.message
      };
    }
  }

  // DNS 解析检测
  async checkDns(monitor) {
    const startTime = Date.now();
    const config = monitor.config ? JSON.parse(monitor.config) : {};
    const recordType = (config.recordType || 'A').toUpperCase();
    const resolver = new dnsPromises.Resolver({ timeout: monitor.timeout * 1000, tries: 1 });

    const resolvers = {
      A: (d) => resolver.resolve4(d),
      AAAA: (d) => resolver.resolve6(d),
      CNAME: (d) => resolver.resolveCname(d),
      MX: (d) => resolver.resolveMx(d),
      TXT: (d) => resolver.resolveTxt(d),
      NS: (d) => resolver.resolveNs(d)
    };

    const resolveFn = resolvers[recordType];
    if (!resolveFn) {
      return { status: 'down', responseTime: 0, errorMessage: `Unsupported record type: ${recordType}` };
    }

    try {
      let records = await resolveFn(monitor.target);
      const responseTime = Date.now() - startTime;

      // 归一化为字符串数组
      if (recordType === 'TXT') records = records.map(r => Array.isArray(r) ? r.join('') : String(r));
      else if (recordType === 'MX') records = records.map(r => String(r.exchange));
      else records = records.map(r => String(r));

      // 期望值检查（任一记录包含期望值即通过）
      const expected = config.expectedValue?.trim();
      if (expected && !records.some(r => r.includes(expected))) {
        return {
          status: 'down',
          responseTime,
          errorMessage: `Expected ${recordType} record containing "${expected}", got: ${records.slice(0, 5).join(', ')}`
        };
      }

      return {
        status: 'up',
        responseTime,
        errorMessage: null,
        extra: { records: records.slice(0, 10) }
      };
    } catch (error) {
      return {
        status: 'down',
        responseTime: Date.now() - startTime,
        errorMessage: `DNS ${recordType} lookup failed: ${error.message}`
      };
    }
  }

  // Docker 容器状态检测（通过 Docker Engine API，走 unix socket / named pipe）
  checkDocker(monitor) {
    return new Promise((resolve) => {
      const startTime = Date.now();
      const config = monitor.config ? JSON.parse(monitor.config) : {};
      const socketPath = config.socketPath
        || (process.platform === 'win32' ? '\\\\.\\pipe\\docker_engine' : '/var/run/docker.sock');
      const container = encodeURIComponent(monitor.target);

      const req = http.request(
        {
          socketPath,
          path: `/v1.43/containers/${container}/json`,
          method: 'GET',
          timeout: monitor.timeout * 1000
        },
        (res) => {
          let body = '';
          res.on('data', chunk => { body += chunk; });
          res.on('end', () => {
            const responseTime = Date.now() - startTime;
            try {
              if (res.statusCode === 404) {
                resolve({ status: 'down', responseTime, errorMessage: `Container "${monitor.target}" not found` });
                return;
              }
              if (res.statusCode !== 200) {
                resolve({ status: 'down', responseTime, errorMessage: `Docker API ${res.statusCode}` });
                return;
              }
              const info = JSON.parse(body);
              const running = info.State?.Running === true;
              const health = info.State?.Health?.Status;

              let isUp = running;
              let message = null;
              if (running && health) {
                isUp = health !== 'unhealthy';
                if (!isUp) message = `Container health check: ${health}`;
              } else if (!running) {
                message = `Container is not running (status: ${info.State?.Status})`;
              }

              resolve({
                status: isUp ? 'up' : 'down',
                responseTime,
                errorMessage: message,
                extra: { health: health || null, status: info.State?.Status || null }
              });
            } catch (err) {
              resolve({ status: 'down', responseTime, errorMessage: `Parse error: ${err.message}` });
            }
          });
        }
      );

      req.on('error', (err) => {
        resolve({
          status: 'down',
          responseTime: Date.now() - startTime,
          errorMessage: `Docker socket error: ${err.message} (socketPath: ${socketPath})`
        });
      });
      req.on('timeout', () => {
        req.destroy();
        resolve({ status: 'down', responseTime: Date.now() - startTime, errorMessage: 'Docker API timeout' });
      });
      req.end();
    });
  }

  // 统一检测入口
  async executeCheck(monitor, { fromPush = false } = {}) {
    let result;

    try {
      switch (monitor.type) {
        case 'http': result = await this.checkHttp(monitor); break;
        case 'tcp': result = await this.checkTcp(monitor); break;
        case 'ping': result = await this.checkPing(monitor); break;
        case 'ssl': result = await this.checkSsl(monitor); break;
        case 'domain': result = await this.checkDomain(monitor); break;
        case 'dns': result = await this.checkDns(monitor); break;
        case 'docker': result = await this.checkDocker(monitor); break;
        default:
          result = {
            status: 'down',
            responseTime: 0,
            errorMessage: `Unknown monitor type: ${monitor.type}`
          };
      }

      // 记录检测结果
      MonitorModel.recordCheckResult(monitor.id, result);

      // 故障确认：连续失败达到阈值才触发故障事件，避免网络抖动误报
      await this.detectIncident(monitor, result);

      // 通过 Socket.io 推送实时状态
      this.emitStatus(monitor.id, result);

      console.log(`[${new Date().toISOString()}] Monitor #${monitor.id} (${monitor.name}): ${result.status} - ${result.responseTime}ms`);

      return result;
    } catch (error) {
      console.error(`Error checking monitor #${monitor.id}:`, error);
      return {
        status: 'down',
        responseTime: 0,
        errorMessage: error.message
      };
    }
  }

  emitStatus(monitorId, result) {
    if (!this.io) return;
    this.io.emit('monitor:status', {
      monitorId,
      status: result.status,
      responseTime: result.responseTime,
      statusCode: result.statusCode,
      timestamp: new Date().toISOString()
    });
  }

  // 故障确认与事件处理
  async detectIncident(monitor, result) {
    const monitorId = monitor.id;
    const maxRetries = Math.max(1, monitor.max_retries || 1);

    if (result.status === 'down') {
      const fails = (this.failCounts.get(monitorId) || 0) + 1;
      this.failCounts.set(monitorId, fails);

      // 尚未达到确认阈值：只记录失败，不触发事件和通知
      if (fails < maxRetries) return;

      const activeIncident = MonitorModel.getActiveIncident(monitorId);
      if (!activeIncident) {
        const incidentId = MonitorModel.createIncident(monitorId, result.errorMessage);

        if (this.io) {
          this.io.emit('monitor:incident', {
            monitorId,
            type: 'started',
            errorMessage: result.errorMessage,
            timestamp: new Date().toISOString()
          });
        }

        // 发送故障通知（不阻塞检测流程）
        NotificationService.notifyIncident(monitor, {
          type: 'down',
          errorMessage: result.errorMessage
        }).catch(err => console.error('Down notification error:', err));

        console.log(`[INCIDENT] Monitor #${monitorId}: Incident #${incidentId} started`);
      }
    } else {
      this.failCounts.delete(monitorId);

      const activeIncident = MonitorModel.getActiveIncident(monitorId);
      if (activeIncident) {
        MonitorModel.endIncident(monitorId);
        const durationSeconds = MonitorModel.getIncidentById(activeIncident.id)?.duration || 0;

        if (this.io) {
          this.io.emit('monitor:incident', {
            monitorId,
            type: 'ended',
            duration: durationSeconds,
            timestamp: new Date().toISOString()
          });
        }

        NotificationService.notifyIncident(monitor, {
          type: 'up',
          durationSeconds
        }).catch(err => console.error('Recovery notification error:', err));

        console.log(`[INCIDENT] Monitor #${monitorId}: Incident ended`);
      }
    }
  }

  // 记录一次 push 心跳（外部服务主动上报）
  recordPush(monitor, { status = 'up', message = null } = {}) {
    const latest = MonitorModel.getLatestCheckResult(monitor.id);
    let responseTime = 0;
    if (latest?.checked_at) {
      responseTime = Math.max(0, Date.now() - new Date(latest.checked_at + 'Z').getTime());
    }

    const result = {
      status: status === 'down' ? 'down' : 'up',
      responseTime,
      statusCode: null,
      errorMessage: status === 'down' ? (message || 'Reported as down by client') : null
    };

    MonitorModel.recordCheckResult(monitor.id, result);
    this.detectIncident(monitor, result);
    this.emitStatus(monitor.id, result);
    return result;
  }

  // Push 监控巡检：超过周期 * 1.5 没收到心跳判定为故障
  async sweepPushMonitor(monitor) {
    const config = monitor.config ? JSON.parse(monitor.config) : {};
    const periodSeconds = Math.max(20, parseInt(config.period, 10) || 300);
    const latest = MonitorModel.getLatestCheckResult(monitor.id);

    let isStale = true;
    if (latest?.checked_at) {
      const lastTime = new Date(latest.checked_at + 'Z').getTime();
      isStale = (Date.now() - lastTime) > periodSeconds * 1.5 * 1000;
    }

    if (isStale) {
      const result = {
        status: 'down',
        responseTime: 0,
        statusCode: null,
        errorMessage: latest
          ? 'Heartbeat timeout: no push received within expected period'
          : 'Waiting for first heartbeat'
      };
      MonitorModel.recordCheckResult(monitor.id, result);
      await this.detectIncident(monitor, result);
      this.emitStatus(monitor.id, result);
    } else if (latest.status === 'down') {
      // 收到过心跳且最近一次记录是 down（比如客户端上报过 down），恢复
      const result = { status: 'up', responseTime: 0, statusCode: null, errorMessage: null };
      MonitorModel.recordCheckResult(monitor.id, result);
      await this.detectIncident(monitor, result);
      this.emitStatus(monitor.id, result);
    }
  }
}

export default MonitorService;
