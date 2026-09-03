import { deriveMasterKey, unwrapDek } from 'passvault-crypto';

// masterKey 与 dek 只存在于内存，锁屏/退出即清除；持久化的只有 token 和密钥密文
let keyInfo = null;
let masterKey = null;
let dek = null;

export function saveToken(t) {
  uni.setStorageSync('pv_token', t);
}

export function getToken() {
  return uni.getStorageSync('pv_token') || '';
}

export function hasToken() {
  return !!getToken();
}

export function setKeyInfo(info) {
  keyInfo = info;
}

export function getKeyInfo() {
  return keyInfo;
}

export function cacheMasterKey(k) {
  masterKey = k;
}

export function getCachedMasterKey() {
  return masterKey;
}

export function saveUser(u) {
  uni.setStorageSync('pv_user', u);
}

export function getUser() {
  return uni.getStorageSync('pv_user') || '';
}

export function autoUnlock() {
  if (!dek && masterKey && keyInfo) {
    dek = unwrapDek(keyInfo.wrappedDek, keyInfo.wrapNonce, masterKey);
  }
  return !!dek;
}

export function unlockWithPassword(password) {
  masterKey = deriveMasterKey(password, keyInfo.kdfSalt, keyInfo.kdfIters);
  return autoUnlock();
}

export function getDek() {
  return dek;
}

export function lock() {
  dek = null;
  masterKey = null;
}

export function logout() {
  lock();
  keyInfo = null;
  uni.removeStorageSync('pv_token');
}
