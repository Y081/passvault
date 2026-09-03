// 生物识别快捷解锁（仅 APP 端生效，H5 返回空实现）
// 安全边界：指纹通过后解开「本地保存的一把随机钥匙」，再用它解开 masterKey 包裹；
// bioKey 存于本地 storage、受指纹闸门保护，主密码本身不落盘、不上传。
// 关闭开关 / 主密码更改 / 切换账号 时本地钥匙即销毁。
// UI 约定：Android 端 authenticate 无系统弹窗，验证过程的浮层由 bio-prompt 组件承载；
// iOS 端系统自带弹窗，组件不叠加浮层。取消入口 = 浮层按钮 / 返回键 / 超时，不再用原生等待框。
import { generateDek, unwrapDek, wrapDek } from 'passvault-crypto';
import { ensureRandom } from './random';

const KEY_ENABLE = 'pv_bio_enabled';
const KEY_BIOKEY = 'pv_bio_key';
const KEY_BLOB = 'pv_bio_blob';
const KEY_USER = 'pv_bio_user';

// plus.fingerprint.authenticate 错误码
const ERR_MISMATCH = 4;
const ERR_OVERLIMIT = 5;
const ERR_CANCEL = 6;

export const CANCELLED = '已取消';

function plusfp() {
  // #ifdef APP-PLUS
  try {
    return typeof plus !== 'undefined' && plus.fingerprint ? plus.fingerprint : null;
  } catch (e) {
    return null;
  }
  // #endif
  // #ifndef APP-PLUS
  return null;
  // #endif
}

export function isAvailable() {
  const fp = plusfp();
  if (!fp) return false;
  try {
    return fp.isSupport() && fp.isKeyguardSecure() && fp.isEnrolledFingerprints();
  } catch (e) {
    return false;
  }
}

export function isEnabled() {
  // #ifdef APP-PLUS
  return (
    isAvailable() &&
    !!uni.getStorageSync(KEY_ENABLE) &&
    !!uni.getStorageSync(KEY_BIOKEY) &&
    !!uni.getStorageSync(KEY_BLOB)
  );
  // #endif
  // #ifndef APP-PLUS
  return false;
  // #endif
}

// 弹出指纹验证（本函数无 UI）；resolve = 通过。
// 不匹配只回调 errorCB(MISMATCH) 等待重试、不结束验证（并重置超时计时）；
// 连续 timeoutMs 无响应则自动取消并 reject。
export function authenticate(timeoutMs) {
  return new Promise((resolve, reject) => {
    const fp = plusfp();
    if (!fp) {
      reject(new Error('当前环境不支持指纹'));
      return;
    }
    let settled = false;
    let timer = null;
    const settle = (fn, arg) => {
      if (settled) return;
      settled = true;
      if (timer) clearTimeout(timer);
      fn(arg);
    };
    // 无响应超时：每次不匹配（用户仍在尝试）重新计时
    const armTimeout = () => {
      if (timeoutMs <= 0) return;
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        // 先 settle 再 cancel：cancel 会触发 errorCB(CANCEL)，不能让它抢先接管结果
        settle(reject, new Error('验证超时，请重试或使用主密码'));
        try {
          fp.cancel();
        } catch (e) {
          /* ignore */
        }
      }, timeoutMs);
    };
    armTimeout();
    try {
      fp.authenticate(
        () => settle(resolve),
        (err) => {
          const code = err ? Number(err.code) : 0;
          if (!settled && code === ERR_MISMATCH) {
            armTimeout();
            return; // 等待用户重试
          }
          settle(
            reject,
            code === ERR_CANCEL
              ? new Error(CANCELLED)
              : code === ERR_OVERLIMIT
                ? new Error('指纹验证失败次数过多，请用主密码解锁')
                : new Error('指纹验证未通过')
          );
        },
        { message: '' }
      );
    } catch (e) {
      // 原生桥可能抛非 Error（如 Java 异常字符串），统一转 Error 保证 message 存在
      settle(reject, e instanceof Error ? e : new Error('指纹验证未通过'));
    }
  });
}

// 主动取消进行中的指纹验证（浮层按钮 / 返回键），无验证进行时为安全空操作
export function cancelAuth() {
  // #ifdef APP-PLUS
  try {
    if (typeof plus !== 'undefined' && plus.fingerprint) plus.fingerprint.cancel();
  } catch (e) {
    /* ignore */
  }
  // #endif
}

// 开启：生成随机 bioKey 包裹当前 masterKey 存本机（指纹验证由调用方先行完成）
export async function enable(masterKey, username) {
  if (!isAvailable()) throw new Error('设备不支持或未录入指纹');
  await ensureRandom();
  const bioKey = generateDek();
  const blob = wrapDek(masterKey, bioKey);
  uni.setStorageSync(KEY_BIOKEY, JSON.stringify(Array.from(bioKey)));
  uni.setStorageSync(KEY_BLOB, JSON.stringify(blob));
  uni.setStorageSync(KEY_USER, username || '');
  uni.setStorageSync(KEY_ENABLE, '1');
}

export function disable() {
  [KEY_ENABLE, KEY_BIOKEY, KEY_BLOB, KEY_USER].forEach((k) => uni.removeStorageSync(k));
}

// 用本地 bioKey 解开 masterKey；解不开（主密码已改）自动销毁并抛错。指纹验证由调用方先行完成。
export function tryUnlock() {
  if (!isEnabled()) throw new Error('未开启指纹解锁');
  let mk = null;
  try {
    const bioKey = new Uint8Array(JSON.parse(uni.getStorageSync(KEY_BIOKEY)));
    const blob = JSON.parse(uni.getStorageSync(KEY_BLOB));
    mk = unwrapDek(blob.wrappedDek, blob.wrapNonce, bioKey);
  } catch (e) {
    mk = null;
  }
  if (!mk) {
    disable();
    throw new Error('指纹钥匙已失效（主密码可能已更改），请用主密码解锁后重新开启');
  }
  return mk;
}

// 登录成功后调用：若开启过指纹但账号已换，销毁上一个账号的本地钥匙
export function ensureForAccount(username) {
  // #ifdef APP-PLUS
  if (uni.getStorageSync(KEY_ENABLE) && uni.getStorageSync(KEY_USER) !== (username || '')) {
    disable();
  }
  // #endif
}
