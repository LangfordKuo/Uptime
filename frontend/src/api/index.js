import request from '@/utils/request';

export const installApi = {
  // 检查是否已安装
  checkInstalled() {
    return request.get('/install/check');
  },

  // 执行安装
  install(data) {
    return request.post('/install/setup', data);
  }
};

export const authApi = {
  // 用户登录
  login(data) {
    return request.post('/auth/login', data);
  },

  // 获取当前用户信息
  getCurrentUser() {
    return request.get('/auth/me');
  },

  // 创建用户（管理员）
  createUser(data) {
    return request.post('/auth/register', data);
  },

  // 获取用户列表（管理员）
  getUsers() {
    return request.get('/auth/users');
  },

  // 删除用户（管理员）
  deleteUser(id) {
    return request.delete(`/auth/users/${id}`);
  },

  // 修改用户名
  updateUsername(id, data) {
    return request.put(`/auth/users/${id}/username`, data);
  },

  // 修改密码
  updatePassword(id, data) {
    return request.put(`/auth/users/${id}/password`, data);
  }
};

export const monitorApi = {
  // 获取所有监控项
  getAll() {
    return request.get('/monitors');
  },

  // 获取单个监控项
  getById(id) {
    return request.get(`/monitors/${id}`);
  },

  // 创建监控项
  create(data) {
    return request.post('/monitors', data);
  },

  // 更新监控项
  update(id, data) {
    return request.put(`/monitors/${id}`, data);
  },

  // 删除监控项
  delete(id) {
    return request.delete(`/monitors/${id}`);
  },

  // 切换启用/禁用
  toggle(id) {
    return request.post(`/monitors/${id}/toggle`);
  },

  // 立即执行一次检测
  checkNow(id) {
    return request.post(`/monitors/${id}/check`);
  },

  // 获取检测结果
  getResults(id, limit = 100) {
    return request.get(`/monitors/${id}/results`, { params: { limit } });
  },

  // 获取统计数据（range: 24 / 168 / 720 小时）
  getStats(id, range = 24) {
    return request.get(`/monitors/${id}/stats`, { params: { range } });
  },

  // 获取故障事件
  getIncidents(id, limit = 50) {
    return request.get(`/monitors/${id}/incidents`, { params: { limit } });
  },

  // 导出监控配置
  exportMonitors() {
    return request.get('/monitors/export/data');
  },

  // 导入监控配置
  importMonitors(monitors) {
    return request.post('/monitors/import', { monitors });
  },

  // 维护窗口
  getMaintenance(id) {
    return request.get(`/monitors/${id}/maintenance`);
  },

  createMaintenance(id, data) {
    return request.post(`/monitors/${id}/maintenance`, data);
  },

  deleteMaintenance(windowId) {
    return request.delete(`/maintenance/${windowId}`);
  }
};

export const dashboardApi = {
  // 获取仪表盘数据
  getDashboard() {
    return request.get('/dashboard');
  }
};

export const statusPageApi = {
  // 获取所有状态页
  getAll() {
    return request.get('/status-pages');
  },

  // 获取单个状态页
  getById(id) {
    return request.get(`/status-pages/${id}`);
  },

  // 创建状态页
  create(data) {
    return request.post('/status-pages', data);
  },

  // 更新状态页
  update(id, data) {
    return request.put(`/status-pages/${id}`, data);
  },

  // 删除状态页
  delete(id) {
    return request.delete(`/status-pages/${id}`);
  },

  // 获取公开状态页（访客访问，支持密码）
  getPublic(slug, password = null) {
    if (password) {
      return request.post(`/status-pages/public/${slug}`, { password });
    }
    return request.get(`/status-pages/public/${slug}`);
  }
};

export const settingsApi = {
  // 获取网站设置（公开）
  getSiteSettings() {
    return request.get('/settings/site');
  },

  // 保存网站设置（需要管理员权限）
  saveSiteSettings(data) {
    return request.post('/settings/site', data);
  },

  // 获取时区设置（公开）
  getTimezoneSettings() {
    return request.get('/settings/timezone');
  },

  // 保存时区设置（需要管理员权限）
  saveTimezoneSettings(data) {
    return request.post('/settings/timezone', data);
  },

  // 获取时区选项列表（公开）
  getTimezoneOptions() {
    return request.get('/settings/timezone/options');
  },

  // 获取所有设置（需要管理员权限）
  getAllSettings() {
    return request.get('/settings');
  },

  // 获取单个设置（需要管理员权限）
  getSetting(key) {
    return request.get(`/settings/${key}`);
  },

  // 设置单个值（需要管理员权限）
  setSetting(key, value) {
    return request.post(`/settings/${key}`, { value });
  }
};

// 通知渠道（管理员）
export const notificationApi = {
  getChannels() {
    return request.get('/notifications/channels');
  },
  createChannel(data) {
    return request.post('/notifications/channels', data);
  },
  updateChannel(id, data) {
    return request.put(`/notifications/channels/${id}`, data);
  },
  deleteChannel(id) {
    return request.delete(`/notifications/channels/${id}`);
  },
  testChannel(id) {
    return request.post(`/notifications/channels/${id}/test`);
  }
};

// API Key（管理员）
export const apiKeyApi = {
  getAll() {
    return request.get('/api-keys');
  },
  create(name) {
    return request.post('/api-keys', { name });
  },
  remove(id) {
    return request.delete(`/api-keys/${id}`);
  }
};

// 数据库备份（管理员）
export const backupApi = {
  list() {
    return request.get('/backups');
  },
  create() {
    return request.post('/backups');
  },
  // 下载走原生跳转（需要带上 token，改为 fetch + blob）
  async download(name) {
    const token = localStorage.getItem('token');
    const res = await fetch(`/api/backups/${encodeURIComponent(name)}/download`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    if (!res.ok) throw new Error('下载失败');
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    a.click();
    URL.revokeObjectURL(url);
  }
};
