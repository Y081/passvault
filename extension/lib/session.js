import naclUtil from 'tweetnacl-util';

// 零知识红线在 MV3 下的映射：
// token/用户名 → chrome.storage.local（持久，等价 app 的 uni storage）
// wrappedDek 元数据 → chrome.storage.session（浏览器关闭自动清）
// DEK 明文 → 只进 chrome.storage.session（内存级），持久化即违规
const local = chrome.storage.local;
const session = chrome.storage.session;

async function get(area, key) {
  const obj = await area.get(key);
  return obj[key];
}

export async function getToken() {
  return (await get(local, 'pv_token')) || '';
}

export async function saveToken(t) {
  await local.set({ pv_token: t });
}

export async function getUser() {
  return (await get(local, 'pv_user')) || '';
}

export async function saveUser(u) {
  await local.set({ pv_user: u });
}

export async function getKeyInfo() {
  return get(session, 'pv_keyinfo');
}

export async function setKeyInfo(info) {
  await session.set({ pv_keyinfo: info });
}

export async function cacheDek(dek) {
  await session.set({ pv_dek: naclUtil.encodeBase64(dek) });
}

export async function getDek() {
  const v = await get(session, 'pv_dek');
  return v ? naclUtil.decodeBase64(v) : null;
}

export async function lock() {
  await session.remove('pv_dek');
}

export async function logout() {
  await session.clear();
  await local.remove(['pv_token', 'pv_user']);
}
