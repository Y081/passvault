<template>
  <div class="wrap">
    <!-- 登录 -->
    <template v-if="state === 'login'">
      <img class="logo" :src="logoUrl" alt="密小本" />
      <div class="title">密小本</div>
      <div class="sub">主密码不上传，数据加密后仅你可读</div>
      <input v-model="username" placeholder="用户名" @keyup.enter="submitLogin" />
      <input v-model="password" type="password" placeholder="主密码" @keyup.enter="submitLogin" />
      <button class="btn primary" :disabled="busy" @click="submitLogin">登录</button>
      <div v-if="error" class="error">{{ error }}</div>
      <div class="link" @click="goRegister">没有账号？注册</div>
    </template>

    <!-- 注册 -->
    <template v-else-if="state === 'register'">
      <img class="logo" :src="logoUrl" alt="密小本" />
      <div class="title">创建账号</div>
      <div class="sub">零知识加密 · 服务器永不保存你的主密码</div>
      <input v-model="username" placeholder="用户名（字母数字下划线，3-32位）" />
      <input v-model="password" type="password" placeholder="主密码（至少8位）" />
      <input v-model="confirm" type="password" placeholder="确认主密码" />
      <div class="captcha-row">
        <input v-model="captchaCode" placeholder="验证码（不区分大小写）" />
        <img class="captcha-img" :src="captchaImg" title="看不清？点击刷新" @click="loadCaptcha" />
      </div>
      <button class="btn primary" :disabled="busy" @click="submitRegister">注册</button>
      <div v-if="error" class="error">{{ error }}</div>
      <div class="link" @click="state = 'login'">已有账号？登录</div>
      <div class="tip">忘记主密码将无法找回任何数据！</div>
    </template>

    <!-- 解锁 -->
    <template v-else-if="state === 'unlock'">
      <img class="logo" :src="logoUrl" alt="密小本" />
      <div class="title">已锁定</div>
      <div class="sub">输入主密码解锁（主密码不联网）</div>
      <input v-model="password" type="password" placeholder="主密码" @keyup.enter="submitUnlock" />
      <button class="btn primary" :disabled="busy" @click="submitUnlock">解锁</button>
      <div v-if="error" class="error">{{ error }}</div>
      <div class="link" @click="doLogout">退出登录</div>
    </template>

    <!-- 列表 -->
    <template v-else-if="state === 'ready'">
      <div class="top">
        <input v-model="keyword" class="search" placeholder="搜索标题或账号" />
        <button class="icon-btn" title="添加密码" @click="goAdd">＋</button>
        <button class="icon-btn" title="锁定" @click="doLock">🔒</button>
      </div>
      <div v-for="it in filtered" :key="it.id" class="item" @click="goEdit(it.id)">
        <div class="avatar" :style="{ background: it.color }">{{ it.initial }}</div>
        <div class="info">
          <div class="t">{{ it.data.title || '（无标题）' }}</div>
          <div class="s">{{ it.data.username || '' }}</div>
        </div>
        <button class="mini" @click.stop="copy(it.data.username)">账号</button>
        <button class="mini" @click.stop="copy(it.data.password)">密码</button>
      </div>
      <div v-if="!filtered.length" class="empty">{{ loaded ? '暂无密码，点击右上角 + 添加' : '加载中…' }}</div>
      <div class="foot">
        <span class="link" @click="doLock">锁定</span>
        <span class="link" @click="doLogout">退出登录</span>
      </div>
    </template>

    <!-- 添加/编辑条目 -->
    <template v-else-if="state === 'edit'">
      <div class="top">
        <div class="e-title">{{ editId ? '编辑密码' : '添加密码' }}</div>
        <button class="icon-btn" title="返回" @click="state = 'ready'">←</button>
      </div>
      <input v-model="form.title" placeholder="标题（如：QQ邮箱）" />
      <input v-model="form.username" placeholder="账号" />
      <input v-model="form.password" type="password" placeholder="密码" />
      <input v-model="form.url" placeholder="网址（选填）" />
      <input v-model="form.note" placeholder="备注（选填）" />
      <button class="btn primary" :disabled="busy" @click="saveItem">保存（本地加密后上传密文）</button>
      <button v-if="editId" class="btn danger" :disabled="busy" @click="deleteItem">删除</button>
      <div v-if="error" class="error">{{ error }}</div>
    </template>
  </div>
  <transition name="fade">
    <div v-if="toast" class="toast">{{ toast }}</div>
  </transition>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue';
import {
  DEFAULT_ITERATIONS,
  decryptItem,
  deriveAuthHash,
  deriveMasterKey,
  encryptItem,
  generateDek,
  randomSalt,
  unwrapDek,
  wrapDek,
} from 'passvault-crypto';
import logoUrl from '../../assets/logo.png';
import { api } from '../../lib/api';
import { cacheDek, getDek, getKeyInfo, getUser, getToken, lock, logout, saveToken, saveUser, setKeyInfo } from '../../lib/session';

const COLORS = ['#4a6cf7', '#00b578', '#ff8f1f', '#8b5cf6', '#e05252', '#00a3e0'];

const state = ref('checking');
const username = ref('');
const password = ref('');
const confirm = ref('');
const captchaId = ref('');
const captchaCode = ref('');
const captchaImg = ref('');
const keyword = ref('');
const busy = ref(false);
const error = ref('');
const toast = ref('');
const items = ref([]);
const loaded = ref(false);
const editId = ref(null);
const form = ref({ title: '', username: '', password: '', url: '', note: '' });
let toastTimer = null;

const filtered = computed(() => {
  const kw = keyword.value.trim().toLowerCase();
  if (!kw) return items.value;
  return items.value.filter(
    (it) => (it.data.title || '').toLowerCase().includes(kw) || (it.data.username || '').toLowerCase().includes(kw)
  );
});

onMounted(async () => {
  username.value = await getUser();
  if (!(await getToken())) {
    state.value = 'login';
    return;
  }
  try {
    if (!(await getKeyInfo())) {
      await setKeyInfo(await api.getKey());
    }
    state.value = (await getDek()) ? 'ready' : 'unlock';
    if (state.value === 'ready') await load();
  } catch (e) {
    if (e.auth) {
      await logout();
      state.value = 'login';
    } else {
      error.value = e.message;
    }
  }
});

function goRegister() {
  password.value = '';
  error.value = '';
  loadCaptcha();
  state.value = 'register';
}

async function loadCaptcha() {
  const c = await api.captcha();
  captchaId.value = c.captchaId;
  captchaImg.value = c.image;
  captchaCode.value = '';
}

async function submitRegister() {
  const name = username.value.trim();
  if (!/^[a-zA-Z0-9_]{3,32}$/.test(name)) return showError('用户名格式不正确');
  if (password.value.length < 8) return showError('主密码至少8位');
  if (password.value !== confirm.value) return showError('两次密码不一致');
  busy.value = true;
  error.value = '';
  try {
    const kdfSalt = randomSalt();
    const masterKey = deriveMasterKey(password.value, kdfSalt, DEFAULT_ITERATIONS);
    const authHash = deriveAuthHash(masterKey, name);
    const dek = generateDek();
    const { wrappedDek, wrapNonce } = wrapDek(dek, masterKey);
    await api.register({ username: name, authHash, kdfSalt, kdfIters: DEFAULT_ITERATIONS, wrappedDek, wrapNonce, captchaId: captchaId.value, captchaCode: captchaCode.value });
    password.value = '';
    confirm.value = '';
    state.value = 'login';
    showToast('注册成功，请登录');
  } catch (e) {
    showError(e.message);
    loadCaptcha();
  } finally {
    busy.value = false;
  }
}

async function submitLogin() {
  const name = username.value.trim();
  const pwd = password.value;
  if (!name || !pwd) return showError('请填写完整');
  busy.value = true;
  error.value = '';
  try {
    const kdf = await api.kdf(name);
    const masterKey = deriveMasterKey(pwd, kdf.kdfSalt, kdf.kdfIters);
    const authHash = deriveAuthHash(masterKey, name);
    const loginData = await api.login({ username: name, authHash });
    await saveToken(loginData.token);
    await saveUser(name);
    const keyInfo = await api.getKey();
    await setKeyInfo(keyInfo);
    const dek = unwrapDek(keyInfo.wrappedDek, keyInfo.wrapNonce, masterKey);
    if (!dek) throw new Error('密钥解包失败，请重试');
    await cacheDek(dek);
    password.value = '';
    state.value = 'ready';
    await load();
  } catch (e) {
    showError(e.message);
  } finally {
    busy.value = false;
  }
}

async function submitUnlock() {
  const pwd = password.value;
  if (!pwd) return showError('请输入主密码');
  busy.value = true;
  error.value = '';
  try {
    const keyInfo = await getKeyInfo();
    const masterKey = deriveMasterKey(pwd, keyInfo.kdfSalt, keyInfo.kdfIters);
    const dek = unwrapDek(keyInfo.wrappedDek, keyInfo.wrapNonce, masterKey);
    if (!dek) {
      showError('主密码错误');
      return;
    }
    await cacheDek(dek);
    password.value = '';
    state.value = 'ready';
    await load();
  } catch (e) {
    showError(e.message);
  } finally {
    busy.value = false;
  }
}

async function load() {
  const dek = await getDek();
  const list = await api.listItems();
  items.value = list.map((row) => {
    // 密文在本地解密；解密失败标记为不可读
    const data = decryptItem(row.ciphertext, row.nonce, dek) || { title: '（无法解密）', username: '' };
    const seed = data.title || '?';
    return {
      id: row.id,
      data,
      initial: seed.charAt(0).toUpperCase(),
      color: COLORS[seed.charCodeAt(0) % COLORS.length],
    };
  });
  loaded.value = true;
}

function goAdd() {
  editId.value = null;
  form.value = { title: '', username: '', password: '', url: '', note: '' };
  error.value = '';
  state.value = 'edit';
}

function goEdit(id) {
  // 雪花 ID 超出 Number 安全整数范围，全程保持字符串，禁止 Number()
  editId.value = String(id);
  const it = items.value.find((r) => String(r.id) === editId.value);
  if (!it) {
    goAdd();
    return;
  }
  form.value = { title: it.data.title || '', username: it.data.username || '', password: it.data.password || '', url: it.data.url || '', note: it.data.note || '' };
  error.value = '';
  state.value = 'edit';
}

async function saveItem() {
  if (!form.value.title || !form.value.password) return showError('标题和密码必填');
  busy.value = true;
  error.value = '';
  try {
    const enc = encryptItem(form.value, await getDek());
    if (editId.value) {
      await api.updateItem(editId.value, enc);
    } else {
      await api.createItem(enc);
    }
    state.value = 'ready';
    await load();
    showToast('已保存');
  } catch (e) {
    showError(e.message);
  } finally {
    busy.value = false;
  }
}

async function deleteItem() {
  if (!window.confirm('删除后无法恢复，确定？')) return;
  busy.value = true;
  error.value = '';
  try {
    await api.deleteItem(editId.value);
    state.value = 'ready';
    await load();
    showToast('已删除');
  } catch (e) {
    showError(e.message);
  } finally {
    busy.value = false;
  }
}

async function copy(text) {
  if (!text) return showToast('无内容可复制');
  try {
    await navigator.clipboard.writeText(text);
    showToast('已复制');
  } catch {
    showToast('复制失败');
  }
}

function showError(msg) {
  error.value = msg;
}

function showToast(msg) {
  toast.value = msg;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => (toast.value = ''), 2000);
}

async function doLock() {
  await lock();
  state.value = 'unlock';
}

async function doLogout() {
  await logout();
  state.value = 'login';
  password.value = '';
}
</script>

<style>
.wrap {
  width: 360px;
  min-height: 300px;
  padding: 20px;
  box-sizing: border-box;
  font-family: -apple-system, 'Segoe UI', 'PingFang SC', 'Microsoft YaHei', sans-serif;
  background: #f5f6fa;
  color: #333;
}
.logo {
  width: 56px;
  height: 56px;
  display: block;
  margin: 8px auto 4px;
  border-radius: 14px;
}
.title {
  text-align: center;
  font-size: 18px;
  font-weight: 600;
  margin-top: 4px;
}
.sub {
  text-align: center;
  color: #999;
  font-size: 12px;
  margin: 6px 0 16px;
}
input {
  width: 100%;
  box-sizing: border-box;
  padding: 10px 12px;
  margin-bottom: 10px;
  border: 1px solid #ddd;
  border-radius: 8px;
  font-size: 14px;
  background: #fff;
  outline: none;
}
input:focus {
  border-color: #4a6cf7;
}
.captcha-row {
  display: flex;
  gap: 8px;
  align-items: center;
}
.captcha-row input {
  flex: 1;
  min-width: 0;
}
.captcha-img {
  width: 108px;
  height: 40px;
  margin-bottom: 10px;
  border: 1px solid #ddd;
  border-radius: 8px;
  background: #fff;
  cursor: pointer;
  flex-shrink: 0;
}
.btn {
  width: 100%;
  padding: 10px;
  border: none;
  border-radius: 8px;
  font-size: 14px;
  cursor: pointer;
  margin-top: 2px;
}
.btn.primary {
  background: #4a6cf7;
  color: #fff;
}
.btn.danger {
  background: #e05252;
  color: #fff;
  margin-top: 10px;
}
.btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}
.error {
  color: #e05252;
  font-size: 12px;
  text-align: center;
  margin-top: 10px;
}
.tip {
  color: #e05252;
  font-size: 12px;
  text-align: center;
  margin-top: 10px;
}
.link {
  color: #999;
  font-size: 12px;
  text-align: center;
  margin-top: 12px;
  cursor: pointer;
}
.link:hover {
  color: #4a6cf7;
}
.top {
  display: flex;
  gap: 8px;
  align-items: center;
}
.top .search {
  margin-bottom: 0;
  flex: 1;
}
.e-title {
  font-size: 15px;
  font-weight: 600;
  flex: 1;
}
.icon-btn {
  border: 1px solid #e5e6eb;
  background: #fff;
  border-radius: 8px;
  cursor: pointer;
  font-size: 14px;
  height: 38px;
  padding: 0 10px;
}
.item {
  display: flex;
  align-items: center;
  background: #fff;
  border-radius: 10px;
  padding: 10px 12px;
  margin-top: 8px;
  cursor: pointer;
}
.item:hover {
  box-shadow: 0 1px 6px rgba(0, 0, 0, 0.08);
}
.avatar {
  width: 36px;
  height: 36px;
  border-radius: 10px;
  color: #fff;
  font-size: 16px;
  font-weight: 600;
  text-align: center;
  line-height: 36px;
  margin-right: 10px;
  flex-shrink: 0;
}
.info {
  flex: 1;
  overflow: hidden;
}
.t {
  font-size: 14px;
  font-weight: 600;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.s {
  color: #999;
  font-size: 12px;
  margin-top: 2px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.mini {
  border: none;
  background: transparent;
  color: #4a6cf7;
  font-size: 12px;
  cursor: pointer;
  padding: 6px;
  flex-shrink: 0;
}
.empty {
  text-align: center;
  color: #bbb;
  font-size: 13px;
  padding: 40px 0;
}
.foot {
  display: flex;
  justify-content: center;
  gap: 24px;
  margin-top: 16px;
}
.foot .link {
  margin-top: 0;
}
.toast {
  position: fixed;
  left: 50%;
  bottom: 24px;
  transform: translateX(-50%);
  background: rgba(0, 0, 0, 0.75);
  color: #fff;
  font-size: 12px;
  padding: 8px 16px;
  border-radius: 16px;
  z-index: 9;
}
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
