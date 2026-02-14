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

  // 获取检测结果
  getResults(id, limit = 100) {
    return request.get(`/monitors/${id}/results`, { params: { limit } });
  },

  // 获取统计数据
  getStats(id) {
    return request.get(`/monitors/${id}/stats`);
  },

  // 获取故障事件
  getIncidents(id, limit = 50) {
    return request.get(`/monitors/${id}/incidents`, { params: { limit } });
  }
};

export const dashboardApi = {
  // 获取仪表盘数据
  getDashboard() {
    return request.get('/dashboard');
  }
};
