/**
 * 时区转换工具函数 - 前端版本
 * 用于将 UTC 时间转换为用户设置的时区并格式化显示
 */

import { settingsApi } from '@/api'

// 缓存时区设置
let cachedTimezone = 'UTC'
let cachedDateFormat = 'YYYY-MM-DD HH:mm:ss'
let settingsLoaded = false

/**
 * 加载时区设置
 */
export async function loadTimezoneSettings() {
  try {
    const res = await settingsApi.getTimezoneSettings()
    if (res.data) {
      cachedTimezone = res.data.timezone || 'UTC'
      cachedDateFormat = res.data.dateFormat || 'YYYY-MM-DD HH:mm:ss'
      settingsLoaded = true
    }
  } catch (error) {
    console.error('加载时区设置失败:', error)
  }
}

/**
 * 获取缓存的时区设置
 */
export function getTimezoneConfig() {
  return {
    timezone: cachedTimezone,
    dateFormat: cachedDateFormat
  }
}

/**
 * 设置时区配置（用于动态更新）
 */
export function setTimezoneConfig(timezone, dateFormat) {
  cachedTimezone = timezone || 'UTC'
  cachedDateFormat = dateFormat || 'YYYY-MM-DD HH:mm:ss'
}

/**
 * 将 UTC 时间字符串转换为目标时区的本地时间并格式化
 * @param {string|Date} utcDateTime - UTC 时间字符串或 Date 对象
 * @param {string} timezone - 目标时区，不传则使用系统设置
 * @param {string} format - 日期格式，不传则使用系统设置
 * @returns {string} - 格式化后的本地时间字符串
 */
export function formatDateTime(utcDateTime, timezone, format) {
  if (!utcDateTime) return ''
  
  const tz = timezone || cachedTimezone
  const fmt = format || cachedDateFormat
  
  try {
    // 处理时间字符串，确保正确解析为 UTC 时间
    let utcDate
    if (typeof utcDateTime === 'string') {
      // 如果时间字符串没有时区信息（如 "2026-02-14 19:15:01"），假设它是 UTC 时间
      if (utcDateTime.match(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/)) {
        // 替换为空格为 T，并添加 Z 表示 UTC
        utcDate = new Date(utcDateTime.replace(' ', 'T') + 'Z')
      } else {
        utcDate = new Date(utcDateTime)
      }
    } else {
      utcDate = new Date(utcDateTime)
    }
    
    // 检查日期是否有效
    if (isNaN(utcDate.getTime())) {
      console.error('无效的日期:', utcDateTime)
      return utcDateTime.toString()
    }
    
    if (tz === 'UTC') {
      const year = utcDate.getUTCFullYear()
      const month = String(utcDate.getUTCMonth() + 1).padStart(2, '0')
      const day = String(utcDate.getUTCDate()).padStart(2, '0')
      const hour = String(utcDate.getUTCHours()).padStart(2, '0')
      const minute = String(utcDate.getUTCMinutes()).padStart(2, '0')
      const second = String(utcDate.getUTCSeconds()).padStart(2, '0')
      
      return fmt
        .replace('YYYY', year)
        .replace('MM', month)
        .replace('DD', day)
        .replace('HH', hour)
        .replace('mm', minute)
        .replace('ss', second)
    }
    
    // 使用 Intl.DateTimeFormat 进行时区转换
    const options = {
      timeZone: tz,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false
    }
    
    const formatter = new Intl.DateTimeFormat('en-US', options)
    const parts = formatter.formatToParts(utcDate)
    
    const year = parts.find(p => p.type === 'year').value
    const month = parts.find(p => p.type === 'month').value
    const day = parts.find(p => p.type === 'day').value
    const hour = parts.find(p => p.type === 'hour').value
    const minute = parts.find(p => p.type === 'minute').value
    const second = parts.find(p => p.type === 'second').value
    
    return fmt
      .replace('YYYY', year)
      .replace('MM', month)
      .replace('DD', day)
      .replace('HH', hour)
      .replace('mm', minute)
      .replace('ss', second)
  } catch (error) {
    console.error('时间格式化错误:', error)
    return utcDateTime.toString()
  }
}

/**
 * 使用系统设置格式化时间（便捷函数）
 * @param {string|Date} utcDateTime - UTC 时间
 * @returns {string} - 格式化后的时间
 */
export function formatWithSystemTimezone(utcDateTime) {
  return formatDateTime(utcDateTime, cachedTimezone, cachedDateFormat)
}

/**
 * 获取相对时间描述（如：2分钟前、1小时前）
 * @param {string|Date} utcDateTime - UTC 时间
 * @returns {string} - 相对时间描述
 */
export function getRelativeTime(utcDateTime) {
  if (!utcDateTime) return ''
  
  try {
    const date = new Date(utcDateTime)
    const now = new Date()
    const diff = now.getTime() - date.getTime()
    
    const seconds = Math.floor(diff / 1000)
    const minutes = Math.floor(seconds / 60)
    const hours = Math.floor(minutes / 60)
    const days = Math.floor(hours / 24)
    
    if (seconds < 60) {
      return '刚刚'
    } else if (minutes < 60) {
      return `${minutes}分钟前`
    } else if (hours < 24) {
      return `${hours}小时前`
    } else if (days < 30) {
      return `${days}天前`
    } else {
      return formatWithSystemTimezone(utcDateTime)
    }
  } catch (error) {
    console.error('相对时间计算错误:', error)
    return utcDateTime.toString()
  }
}
