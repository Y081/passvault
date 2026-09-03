// 端到端验证：真实 crypto-core 加解密 × 运行中的后端
import { randomFillSync } from "node:crypto";
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
} from "passvault-crypto";

const ensureRandom = installSecureRandom(async (n) => randomFillSync(new Uint8Array(n)));
const BASE = "http://127.0.0.1:9991/api/admin/passvault";

async function api(method, path, body, token) {
  const res = await fetch(BASE + path, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: "Bearer " + token } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await res.json();
  if (json.code !== "0000") throw new Error(`${method} ${path} 失败: ${json.code} ${json.message}`);
  return json.data;
}

let passed = 0;
const assert = (cond, msg) => {
  if (!cond) throw new Error("断言失败: " + msg);
  passed++;
  console.log("✓", msg);
};

const username = "e2e_" + Date.now();
const masterPassword = "测试主密码#123";

// 1. 注册前 kdf 可用（防枚举探测）
const decoy = await api("GET", "/kdf?username=" + encodeURIComponent(username));
assert(decoy.kdfIters > 0, "注册前 kdf 接口可用（返回防枚举随机盐）");

await ensureRandom();

// 2. 注册：真实派生 + 包裹，服务端只收密文材料
const kdfSalt = randomSalt();
const masterKey = deriveMasterKey(masterPassword, kdfSalt, DEFAULT_ITERATIONS);
const authHash = deriveAuthHash(masterKey, username);
const dek = generateDek();
const { wrappedDek, wrapNonce } = wrapDek(dek, masterKey);
await api("POST", "/register", { username, authHash, kdfSalt, kdfIters: DEFAULT_ITERATIONS, wrappedDek, wrapNonce });
assert(true, "注册成功（主密码从未离开本地）");

// 3. 登录
const login = await api("POST", "/login", { username, authHash });
assert(!!login.token, "登录成功，拿到 JWT");

// 4. 取回密钥材料并用主密钥解包 DEK
const keyInfo = await api("GET", "/key", undefined, login.token);
assert(keyInfo.kdfSalt === kdfSalt && keyInfo.wrappedDek === wrappedDek, "服务端存取的密钥材料一致");
const unwrapped = unwrapDek(keyInfo.wrappedDek, keyInfo.wrapNonce, masterKey);
assert(unwrapped && Buffer.from(unwrapped).equals(Buffer.from(dek)), "DEK 解包还原一致");

// 5. 新增条目（真加密）
const secret = { title: "E2E邮箱", username: "e2e@test.com", password: "P@ss中文!123", url: "https://e2e.test", note: "端到端测试" };
const enc = encryptItem(secret, dek);
await api("POST", "/items", { nonce: enc.nonce, ciphertext: enc.ciphertext }, login.token);

// 6. 拉取列表并解密比对
const list = await api("GET", "/items", undefined, login.token);
const row = list.find((r) => r.nonce === enc.nonce);
assert(!!row, "新条目出现在服务端列表");
const decrypted = decryptItem(row.ciphertext, row.nonce, dek);
assert(JSON.stringify(decrypted) === JSON.stringify(secret), "密文解密与原文完全一致（含中文）");

// 7. 错误主密码必须解不开
const wrongKey = deriveMasterKey("错误密码", kdfSalt, DEFAULT_ITERATIONS);
assert(unwrapDek(keyInfo.wrappedDek, keyInfo.wrapNonce, wrongKey) === null, "错误主密码解包 DEK 返回 null");

// 8. 改主密码 = 重包裹 DEK，旧密文不动
const newKdfSalt = randomSalt();
const newMasterKey = deriveMasterKey("新主密码#456", newKdfSalt, DEFAULT_ITERATIONS);
const rewrapped = wrapDek(dek, newMasterKey);
await api("PUT", "/key", { kdfSalt: newKdfSalt, kdfIters: DEFAULT_ITERATIONS, wrappedDek: rewrapped.wrappedDek, wrapNonce: rewrapped.wrapNonce }, login.token);
const keyInfo2 = await api("GET", "/key", undefined, login.token);
const dek3 = unwrapDek(keyInfo2.wrappedDek, keyInfo2.wrapNonce, newMasterKey);
const decrypted2 = decryptItem(row.ciphertext, row.nonce, dek3);
assert(JSON.stringify(decrypted2) === JSON.stringify(secret), "改主密码后旧密文仍可解（重包裹生效）");

// 9. 清理测试条目
await api("DELETE", "/items/" + row.id, undefined, login.token);
const after = await api("GET", "/items", undefined, login.token);
assert(after.length === 0, "测试条目已清理");

console.log(`\n=== E2E 全部通过：${passed} 项断言 ===`);
