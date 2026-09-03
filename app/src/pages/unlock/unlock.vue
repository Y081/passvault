<template>
  <view class="auth-wrap">
    <view class="auth-card">
      <image class="auth-logo" src="/static/logo.png" mode="aspectFit" />
      <view class="auth-title">已锁定</view>
      <view class="hint">
        {{ bioOn ? '正在等待指纹验证，也可直接输入主密码' : '输入主密码解锁本机数据（主密码不联网）' }}
      </view>
      <view class="pwd-row">
        <input v-model="password" :password="!showPwd" placeholder="主密码" />
        <view class="eye-btn" :class="{ on: showPwd }" @click="showPwd = !showPwd" />
      </view>
      <button class="auth-btn" @click="submit">解锁</button>
      <view class="link" @click="doLogout">退出登录</view>
    </view>
    <BioPrompt ref="bioPrompt" cancel-text="使用主密码解锁" />
  </view>
</template>

<script setup>
import { ref } from 'vue';
import { onReady, onShow, onBackPress } from '@dcloudio/uni-app';
import { cacheMasterKey, logout, unlockWithPassword } from '../../utils/session';
import * as biometric from '../../utils/biometric';
import BioPrompt from '../../components/bio-prompt/bio-prompt.vue';

const password = ref('');
const showPwd = ref(false);
const bioBusy = ref(false);
const bioOn = ref(false);
const bioPrompt = ref(null);

// 必须 onReady 而非 onLoad：onLoad 时子组件未挂载，bioPrompt ref 还是 null
onReady(() => {
  bioOn.value = biometric.isEnabled();
  if (bioOn.value) {
    bioUnlock();
  }
});

// 切后台再回前台自动重新弹指纹；验证已在进行时由 bioBusy 拦住
onShow(() => {
  if (bioOn.value) {
    bioUnlock();
  }
});

// 锁定页不允许返回键离开（否则回首页又立即跳回）；指纹验证中返回 = 取消
onBackPress(() => {
  if (bioPrompt.value && bioPrompt.value.isOpen()) {
    bioPrompt.value.cancel();
  }
  return true;
});

function submit() {
  if (unlockWithPassword(password.value)) {
    uni.reLaunch({ url: '/pages/index/index' });
  } else {
    uni.showToast({ title: '主密码错误', icon: 'none' });
  }
}

async function bioUnlock() {
  if (bioBusy.value) return;
  bioBusy.value = true;
  try {
    await bioPrompt.value.open('验证指纹解锁');
    const mk = biometric.tryUnlock();
    cacheMasterKey(mk);
    uni.reLaunch({ url: '/pages/index/index' });
  } catch (e) {
    if (e.message !== biometric.CANCELLED) {
      uni.showToast({ title: e.message, icon: 'none' });
    }
  } finally {
    bioBusy.value = false;
  }
}

function doLogout() {
  biometric.disable();
  logout();
  uni.reLaunch({ url: '/pages/login/login' });
}
</script>

<style scoped>
.hint {
  color: #999;
  font-size: 24rpx;
  padding-bottom: 16rpx;
  text-align: center;
}
</style>
