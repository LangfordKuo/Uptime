import axios from 'axios';
import net from 'net';
import ping from 'ping';
import MonitorModel from '../models/Monitor.js';

class MonitorService {
  constructor(io) {
    this.io = io; // Socket.io instance for real-time updates
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
        maxRedirects: config.followRedirects !== false ? 5 : 0
      });
      
      const responseTime = Date.now() - startTime;
      const expectedCode = config.expectedStatusCode || 200;
      const isUp = response.status === expectedCode;
      
      return {
        status: isUp ? 'up' : 'down',
        responseTime,
        statusCode: response.status,
        errorMessage: isUp ? null : `Expected status ${expectedCode}, got ${response.status}`
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
    const parts = monitor.target.split(':');
    const host = parts[0];
    const port = parseInt(parts[1]);

    if (!host || !port || isNaN(port)) {
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
      
      socket.connect(port, host, () => {
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

  // 统一检测入口
  async executeCheck(monitor) {
    let result;
    
    try {
      switch (monitor.type) {
        case 'http':
          result = await this.checkHttp(monitor);
          break;
        case 'tcp':
          result = await this.checkTcp(monitor);
          break;
        case 'ping':
          result = await this.checkPing(monitor);
          break;
        default:
          result = {
            status: 'down',
            responseTime: 0,
            errorMessage: `Unknown monitor type: ${monitor.type}`
          };
      }

      // 记录检测结果
      MonitorModel.recordCheckResult(monitor.id, result);

      // 检测并记录故障事件
      await this.detectIncident(monitor.id, result.status);

      // 通过 Socket.io 推送实时状态
      if (this.io) {
        this.io.emit('monitor:status', {
          monitorId: monitor.id,
          status: result.status,
          responseTime: result.responseTime,
          statusCode: result.statusCode,
          timestamp: new Date().toISOString()
        });
      }

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

  // 检测并记录故障事件
  async detectIncident(monitorId, currentStatus) {
    const activeIncident = MonitorModel.getActiveIncident(monitorId);

    if (currentStatus === 'down' && !activeIncident) {
      // 服务变为 down 且没有活动故障，创建新故障
      MonitorModel.createIncident(monitorId);
      
      if (this.io) {
        this.io.emit('monitor:incident', {
          monitorId,
          type: 'started',
          timestamp: new Date().toISOString()
        });
      }
      
      console.log(`[INCIDENT] Monitor #${monitorId}: Incident started`);
    } else if (currentStatus === 'up' && activeIncident) {
      // 服务恢复且有活动故障，结束故障
      MonitorModel.endIncident(monitorId);
      
      if (this.io) {
        this.io.emit('monitor:incident', {
          monitorId,
          type: 'ended',
          timestamp: new Date().toISOString()
        });
      }
      
      console.log(`[INCIDENT] Monitor #${monitorId}: Incident ended`);
    }
  }
}

export default MonitorService;
