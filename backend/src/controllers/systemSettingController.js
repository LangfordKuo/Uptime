import SystemSettingModel from '../models/SystemSetting.js';

class SystemSettingController {
  // 获取所有设置
  getAllSettings = async (req, res) => {
    try {
      const settings = SystemSettingModel.getAll();
      res.json({
        success: true,
        data: settings
      });
    } catch (error) {
      console.error('Error getting settings:', error);
      res.status(500).json({
        success: false,
        message: '获取设置失败',
        error: error.message
      });
    }
  };

  // 获取网站设置
  getSiteSettings = async (req, res) => {
    try {
      const settings = SystemSettingModel.getSiteSettings();
      res.json({
        success: true,
        data: settings
      });
    } catch (error) {
      console.error('Error getting site settings:', error);
      res.status(500).json({
        success: false,
        message: '获取网站设置失败',
        error: error.message
      });
    }
  };

  // 保存网站设置
  saveSiteSettings = async (req, res) => {
    try {
      const { siteName, siteUrl, siteDescription } = req.body;
      
      const settings = SystemSettingModel.saveSiteSettings({
        siteName,
        siteUrl,
        siteDescription
      });

      res.json({
        success: true,
        data: settings,
        message: '网站设置已保存'
      });
    } catch (error) {
      console.error('Error saving site settings:', error);
      res.status(500).json({
        success: false,
        message: '保存网站设置失败',
        error: error.message
      });
    }
  };

  // 获取单个设置
  getSetting = async (req, res) => {
    try {
      const { key } = req.params;
      const value = SystemSettingModel.get(key);
      
      res.json({
        success: true,
        data: { key, value }
      });
    } catch (error) {
      console.error('Error getting setting:', error);
      res.status(500).json({
        success: false,
        message: '获取设置失败',
        error: error.message
      });
    }
  };

  // 设置单个值
  setSetting = async (req, res) => {
    try {
      const { key } = req.params;
      const { value } = req.body;
      
      SystemSettingModel.set(key, value);
      
      res.json({
        success: true,
        message: '设置已保存'
      });
    } catch (error) {
      console.error('Error setting value:', error);
      res.status(500).json({
        success: false,
        message: '保存设置失败',
        error: error.message
      });
    }
  };
}

export default new SystemSettingController();
