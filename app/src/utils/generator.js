// 随机密码生成：大写/小写/数字/符号各至少一位，其余随机填充后洗牌。
// 随机源走平台安全接口（APP/小程序=uni.getRandomValues，H5=crypto.getRandomValues），
// 与 nacl 的随机池相互独立，不依赖 ensureRandom。

const SETS = ['ABCDEFGHJKLMNPQRSTUVWXYZ', 'abcdefghijkmnpqrstuvwxyz', '23456789', '!@#$%^&*?-+='];
const ALL = SETS.join('');

async function secureBytes(n) {
  if (typeof uni !== 'undefined' && uni.getRandomValues) {
    const r = await new Promise((resolve) => {
      uni.getRandomValues({
        length: n,
        success: (x) => resolve(new Uint8Array(x.randomValues)),
        fail: () => resolve(null),
      });
    });
    if (r) return r;
  }
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    return crypto.getRandomValues(new Uint8Array(n));
  }
  throw new Error('设备缺少安全随机源');
}

export async function generatePassword(length = 16) {
  const chars = [];
  for (const set of SETS) {
    chars.push(set[(await secureBytes(1))[0] % set.length]);
  }
  while (chars.length < length) {
    chars.push(ALL[(await secureBytes(1))[0] % ALL.length]);
  }
  for (let i = chars.length - 1; i > 0; i--) {
    const j = (await secureBytes(1))[0] % (i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  return chars.join('');
}
