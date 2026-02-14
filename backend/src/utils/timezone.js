/**
 * 时区转换工具函数
 * 数据库中存储的是 UTC 时间，根据用户设置的时区进行转换
 */

import SystemSettingModel from '../models/SystemSetting.js';

// 常用时区列表
export const TIMEZONES = [
  { value: 'UTC', label: 'UTC (协调世界时)' },
  { value: 'Asia/Shanghai', label: 'Asia/Shanghai (北京时间/上海)' },
  { value: 'Asia/Hong_Kong', label: 'Asia/Hong_Kong (香港时间)' },
  { value: 'Asia/Taipei', label: 'Asia/Taipei (台北时间)' },
  { value: 'Asia/Tokyo', label: 'Asia/Tokyo (东京时间)' },
  { value: 'Asia/Seoul', label: 'Asia/Seoul (首尔时间)' },
  { value: 'Asia/Singapore', label: 'Asia/Singapore (新加坡时间)' },
  { value: 'Asia/Dubai', label: 'Asia/Dubai (迪拜时间)' },
  { value: 'Europe/London', label: 'Europe/London (伦敦时间)' },
  { value: 'Europe/Paris', label: 'Europe/Paris (巴黎时间)' },
  { value: 'Europe/Berlin', label: 'Europe/Berlin (柏林时间)' },
  { value: 'Europe/Moscow', label: 'Europe/Moscow (莫斯科时间)' },
  { value: 'America/New_York', label: 'America/New_York (纽约时间)' },
  { value: 'America/Los_Angeles', label: 'America/Los_Angeles (洛杉矶时间)' },
  { value: 'America/Chicago', label: 'America/Chicago (芝加哥时间)' },
  { value: 'America/Toronto', label: 'America/Toronto (多伦多时间)' },
  { value: 'Australia/Sydney', label: 'Australia/Sydney (悉尼时间)' },
  { value: 'Pacific/Auckland', label: 'Pacific/Auckland (奥克兰时间)' }
];

// 日期格式选项
export const DATE_FORMATS = [
  { value: 'YYYY-MM-DD HH:mm:ss', label: 'YYYY-MM-DD HH:mm:ss' },
  { value: 'YYYY/MM/DD HH:mm:ss', label: 'YYYY/MM/DD HH:mm:ss' },
  { value: 'DD/MM/YYYY HH:mm:ss', label: 'DD/MM/YYYY HH:mm:ss' },
  { value: 'MM/DD/YYYY HH:mm:ss', label: 'MM/DD/YYYY HH:mm:ss' },
  { value: 'YYYY年MM月DD日 HH:mm:ss', label: 'YYYY年MM月DD日 HH:mm:ss' }
];

/**
 * 将 UTC 时间字符串转换为目标时区的本地时间
 * @param {string} utcDateTime - UTC 时间字符串 (ISO 8601 格式)
 * @param {string} timezone - 目标时区 (如 'Asia/Shanghai')
 * @returns {Date} - 目标时区的 Date 对象
 */
export function convertToTimezone(utcDateTime, timezone = 'UTC') {
  if (!utcDateTime) return null;
  
  try {
    // 创建 UTC 时间的 Date 对象
    const utcDate = new Date(utcDateTime);
    
    if (timezone === 'UTC') {
      return utcDate;
    }
    
    // 使用 Intl.DateTimeFormat 进行时区转换
    const options = {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false
    };
    
    const formatter = new Intl.DateTimeFormat('en-US', options);
    const parts = formatter.formatToParts(utcDate);
    
    const year = parts.find(p => p.type === 'year').value;
    const month = parts.find(p => p.type === 'month').value;
    const day = parts.find(p => p.type === 'day').value;
    const hour = parts.find(p => p.type === 'hour').value;
    const minute = parts.find(p => p.type === 'minute').value;
    const second = parts.find(p => p.type === 'second').value;
    
    // 返回目标时区的 Date 对象（注意：这个 Date 对象内部仍然是 UTC 时间，但表示的是目标时区的本地时间）
    return new Date(`${year}-${month}-${day}T${hour}:${minute}:${second}`);
  } catch (error) {
    console.error('Timezone conversion error:', error);
    return new Date(utcDateTime);
  }
}

/**
 * 格式化日期时间
 * @param {Date} date - Date 对象
 * @param {string} format - 格式字符串
 * @returns {string} - 格式化后的字符串
 */
export function formatDateTime(date, format = 'YYYY-MM-DD HH:mm:ss') {
  if (!date) return '';
  
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hour = String(date.getHours()).padStart(2, '0');
  const minute = String(date.getMinutes()).padStart(2, '0');
  const second = String(date.getSeconds()).padStart(2, '0');
  
  return format
    .replace('YYYY', year)
    .replace('MM', month)
    .replace('DD', day)
    .replace('HH', hour)
    .replace('mm', minute)
    .replace('ss', second);
}

/**
 * 将 UTC 时间转换为目标时区并格式化
 * @param {string} utcDateTime - UTC 时间字符串
 * @param {string} timezone - 目标时区
 * @param {string} format - 日期格式
 * @returns {string} - 格式化后的本地时间字符串
 */
export function convertAndFormat(utcDateTime, timezone = 'UTC', format = 'YYYY-MM-DD HH:mm:ss') {
  const convertedDate = convertToTimezone(utcDateTime, timezone);
  return formatDateTime(convertedDate, format);
}

/**
 * 获取系统设置的时区配置
 * @returns {Object} - { timezone, dateFormat }
 */
export function getSystemTimezoneConfig() {
  return SystemSettingModel.getTimezoneSettings();
}

/**
 * 使用系统设置转换并格式化时间
 * @param {string} utcDateTime - UTC 时间字符串
 * @returns {string} - 格式化后的本地时间字符串
 */
export function formatWithSystemTimezone(utcDateTime) {
  const config = getSystemTimezoneConfig();
  return convertAndFormat(utcDateTime, config.timezone, config.dateFormat);
}
