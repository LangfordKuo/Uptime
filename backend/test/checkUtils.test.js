import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  matchStatusCode,
  checkKeyword,
  parseTcpTarget,
  sanitizeIntervalTimeout,
  generatePushToken
} from '../src/utils/checkUtils.js';

// ===== matchStatusCode =====
test('matchStatusCode: 默认接受 2xx', () => {
  assert.equal(matchStatusCode(200, undefined), true);
  assert.equal(matchStatusCode(204, null), true);
  assert.equal(matchStatusCode(299, ''), true);
  assert.equal(matchStatusCode(301, undefined), false);
  assert.equal(matchStatusCode(404, undefined), false);
});

test('matchStatusCode: 精确匹配', () => {
  assert.equal(matchStatusCode(200, 200), true);
  assert.equal(matchStatusCode(200, '200'), true);
  assert.equal(matchStatusCode(201, 200), false);
});

test('matchStatusCode: 列表匹配', () => {
  assert.equal(matchStatusCode(204, '200,204'), true);
  assert.equal(matchStatusCode(301, '200,204,301'), true);
  assert.equal(matchStatusCode(302, '200,204,301'), false);
});

test('matchStatusCode: 范围匹配', () => {
  assert.equal(matchStatusCode(250, '200-299'), true);
  assert.equal(matchStatusCode(200, '200-299'), true);
  assert.equal(matchStatusCode(299, '200-299'), true);
  assert.equal(matchStatusCode(300, '200-299'), false);
});

test('matchStatusCode: 混合匹配', () => {
  assert.equal(matchStatusCode(204, '200,204,300-399'), true);
  assert.equal(matchStatusCode(350, '200,300-399'), true);
  assert.equal(matchStatusCode(204, '200,300-399'), false);
  assert.equal(matchStatusCode(400, '200,300-399'), false);
});

// ===== checkKeyword =====
test('checkKeyword: 未设置关键词时通过', () => {
  assert.equal(checkKeyword('hello', null), null);
  assert.equal(checkKeyword('hello', ''), null);
});

test('checkKeyword: 包含关键词通过', () => {
  assert.equal(checkKeyword('hello world', 'world'), null);
  assert.equal(checkKeyword('{"status":"ok"}', '"ok"'), null);
});

test('checkKeyword: 不包含关键词报错', () => {
  const err = checkKeyword('hello world', 'goodbye');
  assert.ok(err && err.includes('not found'));
});

test('checkKeyword: 反转模式', () => {
  // 反转：包含关键词则故障
  assert.ok(checkKeyword('hello world', 'world', true) !== null);
  assert.equal(checkKeyword('hello world', 'goodbye', true), null);
});

test('checkKeyword: 对象响应体会被序列化', () => {
  assert.equal(checkKeyword({ ok: true }, '"ok"'), null);
});

// ===== parseTcpTarget =====
test('parseTcpTarget: 常规 host:port', () => {
  assert.deepEqual(parseTcpTarget('localhost:3306'), { host: 'localhost', port: 3306 });
  assert.deepEqual(parseTcpTarget('example.com:80'), { host: 'example.com', port: 80 });
});

test('parseTcpTarget: IPv6', () => {
  assert.deepEqual(parseTcpTarget('[::1]:6379'), { host: '::1', port: 6379 });
});

test('parseTcpTarget: 非法输入', () => {
  assert.equal(parseTcpTarget('no-port'), null);
  assert.equal(parseTcpTarget(''), null);
  assert.equal(parseTcpTarget('host:99999'), null);
  assert.equal(parseTcpTarget('host:abc'), null);
});

// ===== sanitizeIntervalTimeout =====
test('sanitizeIntervalTimeout: 正常配置不变', () => {
  assert.deepEqual(sanitizeIntervalTimeout(300, 30), { interval: 300, timeout: 30 });
});

test('sanitizeIntervalTimeout: timeout 大于 interval 时自动修正', () => {
  const { interval, timeout } = sanitizeIntervalTimeout(10, 30);
  assert.equal(interval, 10);
  assert.ok(timeout < 10);
});

// ===== generatePushToken =====
test('generatePushToken: 长度与字符集', () => {
  const token = generatePushToken();
  assert.equal(token.length, 12);
  assert.match(token, /^[a-zA-Z0-9]+$/);
  assert.notEqual(token, generatePushToken());
});
