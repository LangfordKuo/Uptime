import nodemailer from 'nodemailer';
import crypto from 'crypto';
import db from '../models/database.js';

// 通知服务：支持邮件、Telegram、Webhook、钉钉、飞书、企业微信
class NotificationService {

  // 获取监控项应使用的通知渠道：
  // 监控项绑定了渠道就用绑定的；没绑定则使用所有启用的渠道（全局兜底）
  getChannelsForMonitor(monitorId) {
    const bound = db.prepare(`
      SELECT c.* FROM notification_channels c
      INNER JOIN monitor_channels mc ON mc.channel_id = c.id
      WHERE mc.monitor_id = ? AND c.enabled = 1
    `).all(monitorId);

    if (bound.length > 0) return bound;

    return db.prepare('SELECT * FROM notification_channels WHERE enabled = 1').all();
  }

  // 构建通知消息
  buildMessage(monitor, { type, errorMessage, durationSeconds }) {
    const now = new Date().toISOString().replace('T', ' ').slice(0, 19);
    if (type === 'down') {
      return [
        `🔴 服务故障：${monitor.name}`,
        `类型：${monitor.type}`,
        `目标：${monitor.target}`,
        `时间：${now}`,
        errorMessage ? `错误：${errorMessage}` : null
      ].filter(Boolean).join('\n');
    }
    const duration = durationSeconds
      ? `持续 ${this.formatDuration(durationSeconds)}`
      : '';
    return [
      `🟢 服务恢复：${monitor.name}`,
      `类型：${monitor.type}`,
      `目标：${monitor.target}`,
      `时间：${now}`,
      duration
    ].filter(Boolean).join('\n');
  }

  formatDuration(seconds) {
    if (seconds < 60) return `${Math.round(seconds)} 秒`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)} 分 ${Math.round(seconds % 60)} 秒`;
    return `${Math.floor(seconds / 3600)} 时 ${Math.round((seconds % 3600) / 60)} 分`;
  }

  // 发送故障/恢复通知（每个渠道独立 try/catch，互不影响）
  async notifyIncident(monitor, { type, errorMessage, durationSeconds }) {
    try {
      const channels = this.getChannelsForMonitor(monitor.id);
      if (channels.length === 0) return;

      const message = this.buildMessage(monitor, { type, errorMessage, durationSeconds });
      const subject = type === 'down'
        ? `【故障】${monitor.name} 监控告警`
        : `【恢复】${monitor.name} 已恢复`;

      const results = await Promise.allSettled(
        channels.map(channel => this.send(channel, subject, message))
      );

      results.forEach((r, i) => {
        if (r.status === 'rejected') {
          console.error(`Notification via ${channels[i].type}(${channels[i].name}) failed:`, r.reason?.message || r.reason);
        }
      });
    } catch (error) {
      console.error('Notify incident error:', error);
    }
  }

  // 向单个渠道发送（也用于"发送测试消息"）
  async send(channel, subject, message) {
    const config = JSON.parse(channel.config || '{}');
    switch (channel.type) {
      case 'email': return this.sendEmail(config, subject, message);
      case 'telegram': return this.sendTelegram(config, message);
      case 'webhook': return this.sendWebhook(config, subject, message);
      case 'dingtalk': return this.sendDingtalk(config, message);
      case 'feishu': return this.sendFeishu(config, message);
      case 'wecom': return this.sendWecom(config, message);
      default: throw new Error(`Unknown channel type: ${channel.type}`);
    }
  }

  async sendEmail(config, subject, message) {
    const transport = nodemailer.createTransport({
      host: config.smtpHost,
      port: parseInt(config.smtpPort, 10) || 465,
      secure: config.smtpSecure !== false,
      auth: config.smtpUser
        ? { user: config.smtpUser, pass: config.smtpPass }
        : undefined
    });
    await transport.sendMail({
      from: config.from || config.smtpUser,
      to: config.to,
      subject,
      text: message
    });
  }

  async sendTelegram(config, message) {
    const res = await fetch(
      `https://api.telegram.org/bot${config.botToken}/sendMessage`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: config.chatId, text: message }),
        signal: AbortSignal.timeout(10000)
      }
    );
    if (!res.ok) throw new Error(`Telegram API ${res.status}: ${await res.text()}`);
  }

  async sendWebhook(config, subject, message) {
    const res = await fetch(config.url, {
      method: config.method || 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(config.secret ? { 'X-Webhook-Secret': config.secret } : {})
      },
      body: JSON.stringify({ title: subject, message, timestamp: Date.now() }),
      signal: AbortSignal.timeout(10000)
    });
    if (!res.ok) throw new Error(`Webhook ${res.status}`);
  }

  // 钉钉机器人加签
  dingtalkSign(secret, timestamp) {
    const stringToSign = `${timestamp}\n${secret}`;
    return crypto
      .createHmac('sha256', secret)
      .update(stringToSign)
      .digest('base64');
  }

  async sendDingtalk(config, message) {
    let url = config.webhookUrl;
    if (config.secret) {
      const ts = Date.now();
      url += `&timestamp=${ts}&sign=${encodeURIComponent(this.dingtalkSign(config.secret, ts))}`;
    }
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ msgtype: 'text', text: { content: message } }),
      signal: AbortSignal.timeout(10000)
    });
    if (!res.ok) throw new Error(`DingTalk ${res.status}`);
  }

  // 飞书机器人加签
  feishuSign(secret, timestamp) {
    const stringToSign = `${timestamp}\n${secret}`;
    return crypto
      .createHmac('sha256', stringToSign)
      .update('')
      .digest('base64');
  }

  async sendFeishu(config, message) {
    const body = { msg_type: 'text', content: { text: message } };
    if (config.secret) {
      const ts = Math.floor(Date.now() / 1000);
      body.timestamp = String(ts);
      body.sign = this.feishuSign(config.secret, ts);
    }
    const res = await fetch(config.webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(10000)
    });
    if (!res.ok) throw new Error(`Feishu ${res.status}`);
  }

  async sendWecom(config, message) {
    const res = await fetch(config.webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ msgtype: 'text', text: { content: message } }),
      signal: AbortSignal.timeout(10000)
    });
    if (!res.ok) throw new Error(`WeCom ${res.status}`);
  }
}

export default new NotificationService();
