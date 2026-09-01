// 检测相关的纯函数工具，方便单元测试

/**
 * 判断 HTTP 状态码是否符合期望。
 * expected 支持：
 *   - 数字/数字字符串: 200
 *   - 逗号分隔列表: "200,204,301"
 *   - 闭区间范围: "200-299"
 *   - 混合: "200,204,300-399"
 * 不传或为空时默认 2xx 都算正常。
 */
export function matchStatusCode(actual, expected) {
  if (expected === undefined || expected === null || expected === '') {
    return actual >= 200 && actual < 300;
  }

  const parts = String(expected).split(',').map(s => s.trim()).filter(Boolean);
  for (const part of parts) {
    if (part.includes('-')) {
      const [lo, hi] = part.split('-').map(n => parseInt(n, 10));
      if (!isNaN(lo) && !isNaN(hi) && actual >= lo && actual <= hi) return true;
    } else {
      const code = parseInt(part, 10);
      if (!isNaN(code) && actual === code) return true;
    }
  }
  return false;
}

/**
 * 关键词检查：body 包含（或不包含，invertKeyword 时）keyword 才算通过
 * 返回 null 表示通过，否则返回错误信息
 */
export function checkKeyword(body, keyword, invertKeyword = false) {
  if (!keyword) return null;

  let text = body;
  if (typeof body !== 'string') {
    try {
      text = JSON.stringify(body);
    } catch {
      text = String(body);
    }
  }
  // 限制比较长度，避免超大响应体拖慢检测
  if (text.length > 1024 * 1024) text = text.slice(0, 1024 * 1024);

  const found = text.includes(keyword);
  if (!invertKeyword && !found) {
    return `Keyword "${keyword}" not found in response`;
  }
  if (invertKeyword && found) {
    return `Forbidden keyword "${keyword}" found in response`;
  }
  return null;
}

/**
 * 解析 TCP 目标 "host:port"，支持 IPv6 "[::1]:3306"
 * 返回 { host, port } 或 null
 */
export function parseTcpTarget(target) {
  if (!target) return null;

  const ipv6Match = target.match(/^\[(.+)\]:(\d+)$/);
  if (ipv6Match) {
    return { host: ipv6Match[1], port: parseInt(ipv6Match[2], 10) };
  }

  const idx = target.lastIndexOf(':');
  if (idx === -1) return null;

  const host = target.slice(0, idx);
  const port = parseInt(target.slice(idx + 1), 10);
  if (!host || isNaN(port) || port <= 0 || port > 65535) return null;
  return { host, port };
}

/**
 * 校验监控配置：timeout 必须小于 interval，否则修正
 */
export function sanitizeIntervalTimeout(interval, timeout) {
  const safeInterval = Math.max(10, parseInt(interval, 10) || 300);
  let safeTimeout = Math.min(300, Math.max(1, parseInt(timeout, 10) || 30));
  if (safeTimeout >= safeInterval) {
    safeTimeout = Math.max(1, Math.floor(safeInterval / 2));
  }
  return { interval: safeInterval, timeout: safeTimeout };
}

// 生成长度 12 的随机 push token（URL 安全）
export function generatePushToken() {
  const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let token = '';
  for (let i = 0; i < 12; i++) {
    token += chars[Math.floor(Math.random() * chars.length)];
  }
  return token;
}
