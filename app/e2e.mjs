// 端到端验证：真实 crypto-core 加解密 × 运行中的后端
import net from "node:net";
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

// 本机 Redis 无密码，直连读验证码答案（校验走真实路径，仅答案用旁路取）
function redisGet(key) {
  return new Promise((resolve, reject) => {
    const sock = net.connect({ host: "127.0.0.1", port: 6379 });
    const chunks = [];
    sock.on("error", reject);
    sock.on("connect", () => {
      sock.write(`*2\r\n$3\r\nGET\r\n$${Buffer.byteLength(key)}\r\n${key}\r\n`);
      sock.end();
    });
    sock.on("data", (d) => chunks.push(d));
    sock.on("close", () => {
      const raw = Buffer.concat(chunks).toString("utf8");
      if (raw.startsWith("$-1")) return resolve(null);
      if (!raw.startsWith("$")) return reject(new Error("Redis 响应异常: " + raw.slice(0, 60)));
      const end = raw.indexOf("\r\n");
      const len = Number(raw.slice(1, end));
      resolve(raw.slice(end + 2, end + 2 + len));
    });
  });
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

// 2. 注册材料：真实派生 + 包裹，服务端只收密文材料
const kdfSalt = randomSalt();
const masterKey = deriveMasterKey(masterPassword, kdfSalt, DEFAULT_ITERATIONS);
const authHash = deriveAuthHash(masterKey, username);
const dek = generateDek();
const { wrappedDek, wrapNonce } = wrapDek(dek, masterKey);
const registerPayload = { username, authHash, kdfSalt, kdfIters: DEFAULT_ITERATIONS, wrappedDek, wrapNonce };

// 3. 图形验证码：接口形状 + 错码必须被拒（校验即删，一次性）
const cap = await api("GET", "/captcha");
assert(!!cap.captchaId && cap.image.startsWith("data:image/png;base64,"), "验证码接口返回 ID + base64 图片");
{
  const res = await fetch(BASE + "/register", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...registerPayload, captchaId: cap.captchaId, captchaCode: "zzzz" }),
  });
  const json = await res.json();
  assert(json.code === "C1018", "错误验证码注册被拒（code=" + json.code + "）");
}

// 框架 DebounceAspect 对同 URL POST 有 1s 防抖，等窗口过去再发正式注册
await new Promise((r) => setTimeout(r, 1100));

// 4. Redis 旁路取验证码答案，完成注册
const cap2 = await api("GET", "/captcha");
const answer = await redisGet("pv:captcha:" + cap2.captchaId);
assert(/^[2-8a-z]{4}$/.test(answer || ""), "Redis 旁路取到验证码答案");
await api("POST", "/register", { ...registerPayload, captchaId: cap2.captchaId, captchaCode: answer });
assert(true, "注册成功（主密码从未离开本地）");

// 5. 登录
const login = await api("POST", "/login", { username, authHash });
assert(!!login.token, "登录成功，拿到 JWT");

// 6. 取回密钥材料并用主密钥解包 DEK
const keyInfo = await api("GET", "/key", undefined, login.token);
assert(keyInfo.kdfSalt === kdfSalt && keyInfo.wrappedDek === wrappedDek, "服务端存取的密钥材料一致");
const unwrapped = unwrapDek(keyInfo.wrappedDek, keyInfo.wrapNonce, masterKey);
assert(unwrapped && Buffer.from(unwrapped).equals(Buffer.from(dek)), "DEK 解包还原一致");

// 7. 新增条目（真加密）
const secret = { title: "E2E邮箱", username: "e2e@test.com", password: "P@ss中文!123", url: "https://e2e.test", note: "端到端测试" };
const enc = encryptItem(secret, dek);
await api("POST", "/items", { nonce: enc.nonce, ciphertext: enc.ciphertext }, login.token);

// 8. 拉取列表并解密比对
const list = await api("GET", "/items", undefined, login.token);
const row = list.find((r) => r.nonce === enc.nonce);
assert(!!row, "新条目出现在服务端列表");
const decrypted = decryptItem(row.ciphertext, row.nonce, dek);
assert(JSON.stringify(decrypted) === JSON.stringify(secret), "密文解密与原文完全一致（含中文）");

// 9. 错误主密码必须解不开
const wrongKey = deriveMasterKey("错误密码", kdfSalt, DEFAULT_ITERATIONS);
assert(unwrapDek(keyInfo.wrappedDek, keyInfo.wrapNonce, wrongKey) === null, "错误主密码解包 DEK 返回 null");

// 10. 改主密码 = 重包裹 DEK，旧密文不动
const newKdfSalt = randomSalt();
const newMasterKey = deriveMasterKey("新主密码#456", newKdfSalt, DEFAULT_ITERATIONS);
const rewrapped = wrapDek(dek, newMasterKey);
await api("PUT", "/key", { kdfSalt: newKdfSalt, kdfIters: DEFAULT_ITERATIONS, wrappedDek: rewrapped.wrappedDek, wrapNonce: rewrapped.wrapNonce }, login.token);
const keyInfo2 = await api("GET", "/key", undefined, login.token);
const dek3 = unwrapDek(keyInfo2.wrappedDek, keyInfo2.wrapNonce, newMasterKey);
const decrypted2 = decryptItem(row.ciphertext, row.nonce, dek3);
assert(JSON.stringify(decrypted2) === JSON.stringify(secret), "改主密码后旧密文仍可解（重包裹生效）");

// 11. 清理测试条目
await api("DELETE", "/items/" + row.id, undefined, login.token);
const after = await api("GET", "/items", undefined, login.token);
assert(after.length === 0, "测试条目已清理");

console.log(`\n=== E2E 全部通过：${passed} 项断言 ===`);
