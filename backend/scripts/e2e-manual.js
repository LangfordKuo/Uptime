// E2E 测试脚本：对运行中的后端做全流程验证
const BASE = 'http://localhost:3900';
let passed = 0, failed = 0;
const failures = [];

function check(name, cond, detail = '') {
  if (cond) { passed++; console.log(`  ✓ ${name}`); }
  else { failed++; failures.push(name); console.log(`  ✗ ${name} ${detail}`); }
}

async function api(method, path, { token, body, apiKey } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  if (apiKey) headers['X-API-Key'] = apiKey;
  const res = await fetch(BASE + path, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined
  });
  let data = null;
  try { data = await res.json(); } catch { /* ignore */ }
  return { status: res.status, data };
}

async function main() {
  console.log('== 1. 安装与登录 ==');
  let r = await api('POST', '/api/install/setup', {
    body: { username: 'admin', email: 'admin@t.com', password: 'admin123', confirmPassword: 'admin123' }
  });
  check('安装成功（热启动）', r.data?.success === true);

  r = await api('POST', '/api/auth/login', { body: { username: 'admin', password: 'admin123' } });
  check('登录成功', r.data?.success === true);
  const adminToken = r.data?.data?.token;

  r = await api('POST', '/api/install/setup', { body: { username: 'x', email: 'x@t.com', password: 'admin123', confirmPassword: 'admin123' } });
  check('重复安装被拒绝', r.status === 400);

  console.log('== 2. 监控项 ==');
  // HTTP 监控（指向自身 health，带关键词）
  r = await api('POST', '/api/monitors', { token: adminToken, body: {
    name: 'self-ok', type: 'http', target: `${BASE}/health`, interval: 10, timeout: 5, max_retries: 2, group_name: 'g1', tags: ['a','b']
  }});
  check('创建 HTTP 监控', r.data?.success === true);
  const okMonitorId = r.data?.data?.id;

  // HTTP 监控 + 错误关键词 → 应判 down
  r = await api('POST', '/api/monitors', { token: adminToken, body: {
    name: 'self-kw-bad', type: 'http', target: `${BASE}/health`, interval: 10, timeout: 5,
    config: { keyword: 'THIS-STRING-DOES-NOT-EXIST' }
  }});
  const kwBadId = r.data?.data?.id;
  check('创建关键词监控', r.data?.success === true);

  // push 监控
  r = await api('POST', '/api/monitors', { token: adminToken, body: {
    name: 'push-m', type: 'push', target: 'push', interval: 300, config: { period: 60 }
  }});
  const pushToken = r.data?.data?.push_token;
  check('创建 Push 监控并生成 token', !!pushToken);

  // 立即检测
  r = await api('POST', `/api/monitors/${okMonitorId}/check`, { token: adminToken });
  check('立即检测成功且为 up', r.data?.data?.status === 'up');

  // 关键词不匹配 → down
  r = await api('POST', `/api/monitors/${kwBadId}/check`, { token: adminToken });
  check('关键词不匹配判 down', r.data?.data?.status === 'down');

  // push 心跳
  r = await api('POST', `/api/push/${pushToken}`);
  check('Push 心跳上报成功', r.data?.data?.status === 'up');
  r = await api('GET', `/api/push/${pushToken}`);
  check('GET 心跳也支持', r.data?.success === true);
  r = await api('POST', '/api/push/invalid-token');
  check('无效 token 返回 404', r.status === 404);

  // 禁用监控后心跳忽略
  console.log('== 3. 数据归属 ==');
  r = await api('POST', '/api/auth/register', { token: adminToken, body: {
    username: 'user1', email: 'u1@t.com', password: 'user1234', role: 'user'
  }});
  check('创建普通用户', r.data?.success === true);
  r = await api('POST', '/api/auth/login', { body: { username: 'user1', password: 'user1234' } });
  const userToken = r.data?.data?.token;

  r = await api('GET', '/api/monitors', { token: userToken });
  const userVisible = r.data?.data?.length ?? -1;
  check('普通用户能看到未归属/自己的监控', r.status === 200);

  // user 创建自己的监控
  r = await api('POST', '/api/monitors', { token: userToken, body: {
    name: 'user-mon', type: 'ping', target: '127.0.0.1', interval: 60, timeout: 5
  }});
  check('普通用户创建自己的监控', r.data?.success === true);
  const userMonId = r.data?.data?.id;

  // user 尝试改 admin 的监控 → 404（不可见）
  r = await api('PUT', `/api/monitors/${okMonitorId}`, { token: userToken, body: {
    name: 'hacked', type: 'http', target: 'http://x', interval: 60, timeout: 5
  }});
  check('普通用户无法修改他人监控', r.status === 404);

  // user 删除自己的监控 OK，admin 也能看到
  r = await api('GET', '/api/monitors', { token: adminToken });
  check('管理员能看到所有监控', (r.data?.data?.length ?? 0) >= 4);

  console.log('== 4. viewer 只读 + API Key ==');
  r = await api('POST', '/api/auth/register', { token: adminToken, body: {
    username: 'viewer1', email: 'v1@t.com', password: 'viewer123', role: 'viewer'
  }});
  check('创建 viewer', r.data?.success === true);

  r = await api('POST', '/api/api-keys', { token: adminToken, body: { name: 'test-key' } });
  const apiKeyValue = r.data?.data?.key;
  check('创建 API Key', !!apiKeyValue);

  r = await api('GET', '/api/monitors', { apiKey: apiKeyValue });
  check('API Key 可读监控列表', r.data?.success === true && r.data.data.length >= 4);
  r = await api('POST', '/api/monitors', { apiKey: apiKeyValue, body: { name: 'x', type: 'ping', target: '1.2.3.4' } });
  check('API Key 无写权限', r.status === 403);
  r = await api('GET', '/api/dashboard', { apiKey: apiKeyValue });
  check('API Key 可读仪表盘', r.data?.success === true);

  console.log('== 5. 维护窗口 ==');
  const start = new Date(Date.now() - 60000).toISOString();
  const end = new Date(Date.now() + 600000).toISOString();
  r = await api('POST', `/api/monitors/${okMonitorId}/maintenance`, { token: adminToken, body: { name: 'maint', start_at: start, end_at: end }});
  check('创建维护窗口', r.data?.success === true);
  r = await api('GET', '/api/monitors', { token: adminToken });
  const inMaint = r.data?.data?.find(m => m.id === okMonitorId);
  check('监控项显示维护中', inMaint?.inMaintenance === true);
  // 维护中执行调度检测会被跳过（checkNow 用 force 不受限）
  r = await api('POST', `/api/monitors/${okMonitorId}/check`, { token: adminToken });
  check('维护中仍可手动强制检测', r.data?.data?.status === 'up');
  r = await api('GET', `/api/monitors/${okMonitorId}/maintenance`, { token: adminToken });
  const winId = r.data?.data?.[0]?.id;
  r = await api('DELETE', `/api/maintenance/${winId}`, { token: adminToken });
  check('删除维护窗口', r.data?.success === true);

  console.log('== 6. 状态页密码 ==');
  r = await api('POST', '/api/status-pages', { token: adminToken, body: {
    name: '公开页', slug: 'pub-page', description: 'test', is_public: true, password: 'secret1', monitor_ids: [okMonitorId]
  }});
  check('创建带密码状态页', r.data?.success === true);

  r = await api('GET', '/api/status-pages/public/pub-page');
  check('无密码访问返回 401+needsPassword', r.status === 401 && r.data?.needsPassword === true);
  r = await api('POST', '/api/status-pages/public/pub-page', { body: { password: 'wrong' } });
  check('错误密码被拒绝', r.status === 401);
  r = await api('POST', '/api/status-pages/public/pub-page', { body: { password: 'secret1' } });
  check('正确密码可访问', r.data?.success === true && r.data?.data?.monitors?.length === 1);
  const pageMonitor = r.data?.data?.monitors?.[0];
  check('状态页监控含 30 天热力图数据', Array.isArray(pageMonitor?.daily_uptime) && pageMonitor.daily_uptime.length === 30);
  check('状态页返回最近事件字段', Array.isArray(r.data?.data?.recent_incidents));

  console.log('== 7. 备份 ==');
  r = await api('POST', '/api/backups', { token: adminToken });
  check('手动备份成功', r.data?.success === true);
  r = await api('GET', '/api/backups', { token: adminToken });
  check('备份列表非空', (r.data?.data?.length ?? 0) >= 1);

  console.log('== 8. 统计与导入导出 ==');
  r = await api('GET', `/api/monitors/${okMonitorId}/stats?range=720`, { token: adminToken });
  check('30天统计返回趋势', r.data?.success === true && Array.isArray(r.data?.data?.trend));
  r = await api('GET', '/api/monitors/export/data', { token: adminToken });
  check('导出监控配置', Array.isArray(r.data?.monitors) && r.data.monitors.length >= 4);
  r = await api('POST', '/api/monitors/import', { token: adminToken, body: { monitors: [
    { name: 'imported-1', type: 'http', target: 'https://example.com', interval: 300, timeout: 30 }
  ]}});
  check('导入监控配置', r.data?.data?.created === 1);

  console.log('== 9. 安全 ==');
  r = await api('GET', '/api/monitors');
  check('无 token 访问被拒', r.status === 401);
  r = await api('POST', '/api/auth/login', { body: { username: 'admin', password: 'wrong-password-xx' } });
  check('错误密码被拒绝', r.status === 401);
  // 删除用户后其 token 立即失效
  r = await api('POST', '/api/auth/register', { token: adminToken, body: {
    username: 'victim', email: 'v@t.com', password: 'victim1234', role: 'user'
  }});
  r = await api('POST', '/api/auth/login', { body: { username: 'victim', password: 'victim1234' } });
  const victimToken = r.data?.data?.token;
  check('victim 登录成功', !!victimToken);
  r = await api('GET', '/api/auth/users', { token: adminToken });
  const victim = r.data?.data?.find(u => u.username === 'victim');
  r = await api('DELETE', `/api/auth/users/${victim.id}`, { token: adminToken });
  check('删除 victim', r.data?.success === true);
  r = await api('GET', '/api/monitors', { token: victimToken });
  check('被删用户旧 token 立即失效', r.status === 401);

  console.log(`\n结果: ${passed} 通过, ${failed} 失败`);
  if (failures.length) {
    console.log('失败项:', failures.join(' | '));
    process.exit(1);
  }
}

main().catch(err => { console.error('E2E ERROR:', err); process.exit(1); });
