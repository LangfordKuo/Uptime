import dayjs from 'dayjs'
import utc from 'dayjs/plugin/utc'
import timezone from 'dayjs/plugin/timezone'
import relativeTime from 'dayjs/plugin/relativeTime'
import 'dayjs/locale/zh-cn'

// 扩展插件
dayjs.extend(utc)
dayjs.extend(timezone)
dayjs.extend(relativeTime)
dayjs.locale('zh-cn')

// 获取系统时区
const systemTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone

/**
 * 将数据库 UTC 时间字符串转换为本地时间的相对时间描述
 * @param {string} utcTimeStr - UTC 时间字符串，如 "2026-02-14 14:30:00"
 * @returns {string} - 相对时间描述，如 "3 分钟前"
 */
export function formatTimeFromNow(utcTimeStr) {
  if (!utcTimeStr) return '-'
  
  // 将 UTC 时间转换为本地时间，然后显示相对时间
  return dayjs.utc(utcTimeStr).tz(systemTimezone).fromNow()
}

/**
 * 将数据库 UTC 时间字符串转换为本地时间的完整格式
 * @param {string} utcTimeStr - UTC 时间字符串
 * @param {string} format - 时间格式，默认 'YYYY-MM-DD HH:mm:ss'
 * @returns {string} - 格式化后的本地时间
 */
export function formatTime(utcTimeStr, format = 'YYYY-MM-DD HH:mm:ss') {
  if (!utcTimeStr) return '-'
  
  return dayjs.utc(utcTimeStr).tz(systemTimezone).format(format)
}

/**
 * 将数据库 UTC 时间字符串转换为本地 dayjs 对象
 * @param {string} utcTimeStr - UTC 时间字符串
 * @returns {dayjs.Dayjs} - dayjs 对象
 */
export function parseUTCTime(utcTimeStr) {
  return dayjs.utc(utcTimeStr).tz(systemTimezone)
}
