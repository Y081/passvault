import assert from 'node:assert/strict';
import { test } from 'node:test';
import { hostOf, isSameSite } from '../lib/matcher.js';

test('hostOf 提取 hostname 并转小写', () => {
  assert.equal(hostOf('https://GitHub.com/login'), 'github.com');
  assert.equal(hostOf('http://accounts.example.com/a?b=1#x'), 'accounts.example.com');
  assert.equal(hostOf('not a url'), '');
  assert.equal(hostOf(''), '');
});

test('完全相等的 hostname', () => {
  assert.equal(isSameSite('https://github.com/login', 'https://github.com/x'), true);
});

test('互为子域均可匹配', () => {
  assert.equal(isSameSite('https://accounts.example.com/u', 'https://example.com/'), true);
  assert.equal(isSameSite('https://example.com/', 'https://www.example.com/u'), true);
});

test('前缀伪装域名绝不匹配', () => {
  assert.equal(isSameSite('https://evil-example.com/', 'https://example.com/'), false);
  assert.equal(isSameSite('https://example.com.evil.io/', 'https://example.com/'), false);
});

test('不同域名不匹配', () => {
  assert.equal(isSameSite('https://github.com/', 'https://gitlab.com/'), false);
});

test('空网址/空来源不匹配', () => {
  assert.equal(isSameSite('', 'https://example.com/'), false);
  assert.equal(isSameSite('https://example.com/', ''), false);
});
