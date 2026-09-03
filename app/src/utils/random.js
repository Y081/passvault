import { installSecureRandom } from 'passvault-crypto';

let ensure = null;

function nativeRandom(n) {
  const c = typeof crypto !== 'undefined' ? crypto : null;
  if (!c || !c.getRandomValues) return null;
  const out = new Uint8Array(n);
  c.getRandomValues(out);
  return out;
}

export function initRandom() {
  if (ensure) return;
  // #ifdef H5
  // H5 有原生 crypto.getRandomValues，tweetnacl 加载时自己会接上
  return;
  // #endif
  // #ifndef H5
  // APP/小程序：不能靠运行时探测原生 crypto（nacl 模块加载时 self.crypto 可能
  // 尚未注入，探测结果不一致就会抛 no PRNG），一律强制接管随机源。
  // 优先 uni.getRandomValues（小程序基础库 2.25+ / App），失败再试运行时原生 crypto。
  ensure = installSecureRandom(async (n) => {
    const fromUni = await new Promise((resolve, reject) => {
      if (typeof uni === 'undefined' || !uni.getRandomValues) {
        reject(new Error('uni.getRandomValues 不可用'));
        return;
      }
      uni.getRandomValues({
        length: n,
        success: (r) => resolve(new Uint8Array(r.randomValues)),
        fail: (e) => reject(new Error('uni.getRandomValues 失败: ' + ((e && e.errMsg) || ''))),
      });
    }).catch(() => null);
    if (fromUni && fromUni.length === n) return fromUni;
    const fromNative = nativeRandom(n);
    if (fromNative) return fromNative;
    throw new Error('设备缺少安全随机源，无法完成加密操作');
  });
  // #endif
}

export async function ensureRandom(bytesNeeded) {
  if (ensure) {
    await ensure(bytesNeeded);
  }
}
