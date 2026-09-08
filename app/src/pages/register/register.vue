<template>
  <view class="auth-wrap">
    <view class="auth-card">
      <image class="auth-logo" src="/static/logo.png" mode="aspectFit" />
      <view class="auth-title">创建账号</view>
      <view class="auth-sub">零知识加密 · 服务器永不保存你的主密码</view>
      <input v-model="username" placeholder="用户名（字母数字下划线，3-32位）" />
      <view class="pwd-row">
        <input v-model="password" :password="!showPwd1" placeholder="主密码（至少8位）" />
        <view class="eye-btn" :class="{ on: showPwd1 }" @click="showPwd1 = !showPwd1" />
      </view>
      <view class="pwd-row">
        <input v-model="confirm" :password="!showPwd2" placeholder="确认主密码" />
        <view class="eye-btn" :class="{ on: showPwd2 }" @click="showPwd2 = !showPwd2" />
      </view>
      <view class="captcha-row">
        <input v-model="captchaCode" placeholder="验证码" />
        <image class="captcha-img" :src="captchaImg" mode="aspectFit" @click="loadCaptcha" />
      </view>
      <view class="tip">忘记主密码将无法找回任何数据！</view>
      <button class="auth-btn" :loading="busy" @click="submit">注册</button>
      <view class="link" @click="goBack">已有账号？登录</view>
    </view>
  </view>
</template>

<script setup>
import { onMounted, ref } from 'vue';
import {
  DEFAULT_ITERATIONS,
  deriveAuthHash,
  deriveMasterKey,
  generateDek,
  randomSalt,
  wrapDek,
} from 'passvault-crypto';
import { api } from '../../api';
import { ensureRandom } from '../../utils/random';

const username = ref('');
const password = ref('');
const confirm = ref('');
const showPwd1 = ref(false);
const showPwd2 = ref(false);
const busy = ref(false);
const captchaId = ref('');
const captchaCode = ref('');
const captchaImg = ref('');

function goBack() {
  uni.navigateBack();
}

async function loadCaptcha() {
  const c = await api.captcha();
  captchaId.value = c.captchaId;
  captchaImg.value = c.image;
  captchaCode.value = '';
}
onMounted(loadCaptcha);

async function submit() {
  const name = username.value.trim();
  if (!/^[a-zA-Z0-9_]{3,32}$/.test(name)) {
    uni.showToast({ title: '用户名格式不正确', icon: 'none' });
    return;
  }
  if (password.value.length < 8) {
    uni.showToast({ title: '主密码至少8位', icon: 'none' });
    return;
  }
  if (password.value !== confirm.value) {
    uni.showToast({ title: '两次密码不一致', icon: 'none' });
    return;
  }
  busy.value = true;
  try {
    await ensureRandom();
    const kdfSalt = randomSalt();
    const masterKey = deriveMasterKey(password.value, kdfSalt, DEFAULT_ITERATIONS);
    const authHash = deriveAuthHash(masterKey, name);
    const dek = generateDek();
    const { wrappedDek, wrapNonce } = wrapDek(dek, masterKey);
    await api.register({ username: name, authHash, kdfSalt, kdfIters: DEFAULT_ITERATIONS, wrappedDek, wrapNonce, captchaId: captchaId.value, captchaCode: captchaCode.value });
    uni.showToast({ title: '注册成功', icon: 'success' });
    setTimeout(() => uni.redirectTo({ url: '/pages/login/login' }), 600);
  } catch (e) {
    uni.showToast({ title: e.message, icon: 'none' });
    loadCaptcha();
  } finally {
    busy.value = false;
  }
}
</script>

<style scoped>
.tip {
  color: #e05252;
  font-size: 24rpx;
  padding: 0 40rpx;
}

.captcha-row {
  display: flex;
  align-items: center;
  padding: 0 40rpx;
  gap: 20rpx;
}

.captcha-row input {
  flex: 1;
  min-width: 0;
  height: 80rpx;
  padding: 0 24rpx;
  margin-bottom: 0;
  border: 1rpx solid #d0d4e0;
  border-radius: 12rpx;
}

.captcha-row input:focus {
  border-color: #4a6cf7;
}

.captcha-img {
  flex-shrink: 0;
  width: 224rpx;
  height: 80rpx;
  border: 1rpx solid #d0d4e0;
  border-radius: 12rpx;
  background: #ffffff;
}
</style>
