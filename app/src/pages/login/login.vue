<template>
  <view class="auth-wrap">
    <view class="auth-card">
      <image class="auth-logo" src="/static/logo.png" mode="aspectFit" />
      <view class="auth-title">密小本</view>
      <view class="auth-sub">主密码不上传，数据加密后仅你可读</view>
      <input v-model="username" placeholder="用户名" />
      <view class="pwd-row">
        <input v-model="password" :password="!showPwd" placeholder="主密码" />
        <view class="eye-btn" :class="{ on: showPwd }" @click="showPwd = !showPwd" />
      </view>
      <button class="auth-btn" :loading="busy" @click="submit">登录</button>
      <view class="link" @click="goRegister">没有账号？注册</view>
    </view>
  </view>
</template>

<script setup>
import { ref } from 'vue';
import { deriveAuthHash, deriveMasterKey } from 'passvault-crypto';
import { api } from '../../api';
import { cacheMasterKey, saveToken, saveUser, setKeyInfo } from '../../utils/session';
import { ensureForAccount } from '../../utils/biometric';

const username = ref('');
const password = ref('');
const showPwd = ref(false);
const busy = ref(false);

function goRegister() {
  uni.navigateTo({ url: '/pages/register/register' });
}

async function submit() {
  const name = username.value.trim();
  if (!name || !password.value) {
    uni.showToast({ title: '请填写完整', icon: 'none' });
    return;
  }
  busy.value = true;
  try {
    // 主密码派生 masterKey → authHash 仅作登录凭证，主密码本身不上传
    const kdf = await api.kdf(name);
    const masterKey = deriveMasterKey(password.value, kdf.kdfSalt, kdf.kdfIters);
    const authHash = deriveAuthHash(masterKey, name);
    const loginData = await api.login({ username: name, authHash });
    saveToken(loginData.token);
    setKeyInfo(await api.getKey());
    cacheMasterKey(masterKey);
    saveUser(name);
    ensureForAccount(name);
    uni.reLaunch({ url: '/pages/index/index' });
  } catch (e) {
    uni.showToast({ title: e.message, icon: 'none' });
  } finally {
    busy.value = false;
  }
}
</script>
