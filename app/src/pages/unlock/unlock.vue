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
import { cacheMasterKey, getKeyInfo, hasToken, logout, setKeyInfo, unlockWithPassword } from '../../utils/session';
import * as biometric from '../../utils/biometric';
import { api } from '../../api';
import BioPrompt from '../../components/bio-prompt/bio-prompt.vue';

const password = ref('');
const showPwd = ref(false);
const bioBusy = ref(false);
const bioOn = ref(false);
const bioPrompt = ref(null);

// keyInfo 兜底：iOS Safari 切后台会冻结并重载页面，内存态清空后 keyInfo 为 null，
// 此时解锁会抛错且表现为"没反应"；首页会自愈，本页必须自己补拉
onShow(async () => {
  if (!hasToken()) {
    uni.reLaunch({ url: '/pages/login/login' });
    return;
  }
  try {
    if (!getKeyInfo()) {
      setKeyInfo(await api.getKey());
    }
  } catch (e) {
    uni.showToast({ title: e.message, icon: 'none' });
  }
  if (bioOn.value) {
    bioUnlock();
  }
});

// 必须 onReady 而非 onLoad：onLoad 时子组件未挂载，bioPrompt ref 还是 null
onReady(() => {
  bioOn.value = biometric.isEnabled();
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

async function submit() {
  try {
    // onShow 的兜底可能还没返回（弱网），提交前再保证一次 keyInfo 就位
    if (!getKeyInfo()) {
      setKeyInfo(await api.getKey());
    }
    if (unlockWithPassword(password.value)) {
      uni.reLaunch({ url: '/pages/index/index' });
    } else {
      uni.showToast({ title: '主密码错误', icon: 'none' });
    }
  } catch (e) {
    // keyInfo 缺失等原因导致的异常必须可见，不允许"点了没反应"
    uni.showToast({ title: e.message || '解锁失败，请重试', icon: 'none' });
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
