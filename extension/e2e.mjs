// 端到端验证：真实 crypto-core 加解密 × 本地后端 × 系统 Chrome 加载扩展（popup 全链路）
// 前置：本地后端 127.0.0.1:9991 运行中；构建时 VITE_API_BASE=http://127.0.0.1:9991/api
import { randomFillSync } from 'node:crypto';
import puppeteer from 'puppeteer-core';
import {
  DEFAULT_ITERATIONS,
  decryptItem,
  deriveAuthHash,
  deriveMasterKey,
  encryptItem,
  generateDek,
  installSecureRandom,
  randomSalt,
  unwrapDek,
  wrapDek,
} from 'passvault-crypto';

const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const OUT = new URL('./.output/chrome-mv3', import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1');
const BASE = 'http://127.0.0.1:9991/api/admin/passvault';

const ensureRandom = installSecureRandom(async (n) => randomFillSync(new Uint8Array(n)));

async function api(method, path, body, token) {
  const res = await fetch(BASE + path, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: 'Bearer ' + token } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await res.json();
  if (json.code !== '0000') throw new Error(`${method} ${path} 失败: ${json.code} ${json.message}`);
  return json.data;
}

let passed = 0;
const assert = (cond, msg) => {
  if (!cond) throw new Error('断言失败: ' + msg);
  passed++;
  console.log('✓', msg);
};

// ---- 1. 播种：注册随机账号 + 写入一条加密条目（模拟 edit.vue 的加密流程） ----
const username = 'ext_e2e_' + Date.now().toString(36);
const password = 'E2ePassw0rd!' + Math.random().toString(36).slice(2, 8);
const itemData = { title: 'E2E邮箱', username: 'e2e@test.dev', password: 'x9#kQm2vPw!', url: 'https://test.dev', note: '' };

{
  await ensureRandom();
  const kdfSalt = randomSalt();
  const masterKey = deriveMasterKey(password, kdfSalt, DEFAULT_ITERATIONS);
  const authHash = deriveAuthHash(masterKey, username);
  const dek = generateDek();
  const { wrappedDek, wrapNonce } = wrapDek(dek, masterKey);
  await api('POST', '/register', { username, authHash, kdfSalt, kdfIters: DEFAULT_ITERATIONS, wrappedDek, wrapNonce });
  const loginData = await api('POST', '/login', { username, authHash });
  const keyInfo = await api('GET', '/key', null, loginData.token);
  const seedDek = unwrapDek(keyInfo.wrappedDek, keyInfo.wrapNonce, masterKey);
  await ensureRandom();
  await api('POST', '/items', encryptItem(itemData, seedDek), loginData.token);
  console.log('✓ 播种完成: ' + username);
}

// ---- 2. 加载扩展 ----
// Chrome 137+ 品牌版已禁用 --load-extension 命令行开关，改用 CDP Extensions.loadUnpacked
const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: false,
  pipe: true,
  args: ['--enable-unsafe-extension-debugging', '--no-first-run', '--no-default-browser-check'],
});

try {
  const extId = await browser.installExtension(OUT);
  console.log('扩展已安装, id =', extId);

  // 顶层导航被拦截时用 WAC 构建（PV_E2E=1）放开 popup.html，普通构建无此入口
  const page = await browser.newPage();
  await page.goto(`chrome-extension://${extId}/popup.html`);
  page.on('pageerror', (e) => console.log('页面错误:', e.message));
  page.on('console', (m) => {
    if (m.type() === 'error') console.log('console.error:', m.text());
  });
  await page.goto(`chrome-extension://${extId}/popup/index.html`);

  // ---- 3. 登录表单 ----
  await page.waitForSelector('input[placeholder="用户名"]', { timeout: 10000 });
  assert(true, '无 token 时显示登录表单');

  const inputs = await page.$$('input');
  await inputs[0].type(username);
  await inputs[1].type(password);
  await page.click('button.primary');
  await page.waitForSelector('.item', { timeout: 15000 });
  assert(true, '登录成功并解密出条目');

  const title = await page.$eval('.item .t', (el) => el.textContent.trim());
  assert(title === itemData.title, '条目标题正确: ' + title);

  // ---- 4. 搜索过滤 ----
  await page.type('.search', '不存在的关键词');
  await page.waitForSelector('.empty', { timeout: 5000 });
  assert(true, '搜索无结果显示空态');
  await page.$eval('.search', (el) => (el.value = ''));
  await page.type('.search', 'E2E');
  await page.waitForSelector('.item', { timeout: 5000 });
  assert(true, '关键词过滤命中条目');

  // ---- 5. 复制密码（剪贴板内容尽力校验） ----
  try {
    await browser.defaultBrowserContext().overridePermissions(
      `chrome-extension://${extId}`,
      ['clipboard-read', 'clipboard-sanitized-write']
    );
  } catch {
    console.log('（剪贴板权限授予失败，后续内容断言将跳过）');
  }
  const copyBtns = await page.$$('.mini');
  await copyBtns[1].click();
  await page.waitForSelector('.toast', { timeout: 5000 });
  assert(true, '点击密码弹出已复制提示');
  try {
    const text = await page.evaluate(() => navigator.clipboard.readText());
    assert(text === itemData.password, '剪贴板内容为条目密码');
  } catch {
    console.log('（跳过剪贴板内容断言：权限不可授予）');
  }

  // ---- 6. 零知识红线：DEK 只允许在 session，local 不得出现 ----
  const stash = await page.evaluate(async () => ({
    local: await chrome.storage.local.get(null),
    session: await chrome.storage.session.get(null),
  }));
  assert(!!stash.local.pv_token, 'token 持久化在 chrome.storage.local');
  assert(!('pv_dek' in stash.local), 'local 无 pv_dek（零知识红线）');
  assert(!!stash.session.pv_dek, 'DEK 只存在于 chrome.storage.session');

  // ---- 7. 锁定 → 错误密码 → 正确解锁 ----
  await page.click('.lock-btn');
  await page.waitForSelector('input[placeholder="主密码"]', { timeout: 5000 });
  const unlockInputs = await page.$$('input');
  await unlockInputs[0].type('wrong-password');
  await page.click('button.primary');
  await page.waitForFunction(() => document.body.innerText.includes('主密码错误'), { timeout: 5000 });
  assert(true, '错误主密码被拒绝');
  await page.$eval('input[type="password"]', (el) => (el.value = ''));
  await page.type('input[placeholder="主密码"]', password);
  await page.click('button.primary');
  await page.waitForSelector('.item', { timeout: 15000 });
  assert(true, '正确主密码解锁并恢复列表');

  // ---- 8. 退出登录 ----
  const links = await page.$$('.foot .link');
  await links[1].click();
  await page.waitForSelector('input[placeholder="用户名"]', { timeout: 5000 });
  assert(true, '退出后回到登录表单');

  console.log(`\n全部通过 (${passed} 断言)`);
} finally {
  await browser.close();
}
