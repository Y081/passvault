<template>
  <view class="set-card">
    <view class="set-row">
      <view class="set-main">
        <view class="set-title">指纹快捷解锁</view>
        <view class="set-sub">{{ subText }}</view>
      </view>
      <switch :checked="on" :disabled="!available" color="#4a6cf7" @change="toggle" />
    </view>
    <view class="set-note">
      开启后，本机会保存一把由指纹保护的随机钥匙用于快速解锁；主密码不会被存储或上传。更换主密码或退出登录会自动销毁该钥匙；关闭开关即手动销毁。
    </view>
    <BioPrompt ref="bioPrompt" />
  </view>
</template>

<script setup>
import { ref, nextTick } from 'vue';
import { onBackPress } from '@dcloudio/uni-app';
import { getCachedMasterKey, getUser } from '../../utils/session';
import * as biometric from '../../utils/biometric';
import BioPrompt from '../../components/bio-prompt/bio-prompt.vue';

const available = ref(biometric.isAvailable());
const on = ref(biometric.isEnabled());
const subText = ref(available.value ? '通过指纹验证后快速解锁' : '当前设备不支持或未录入指纹');
const bioPrompt = ref(null);
const busy = ref(false);

// 指纹验证中返回键 = 取消
onBackPress(() => {
  if (bioPrompt.value && bioPrompt.value.isOpen()) {
    bioPrompt.value.cancel();
    return true;
  }
  return false;
});

// switch 点击后视觉立即翻转，若绑定值没变 Vue 不会重渲染，开关会停在假状态；
// 先反向再回正，强制走一次 diff 把视觉同步回真实状态
async function resetSwitch() {
  on.value = !on.value;
  await nextTick();
  on.value = !on.value;
}

async function toggle(e) {
  if (busy.value) {
    await resetSwitch();
    return;
  }
  const want = e.detail.value;
  busy.value = true;
  try {
    if (!want) {
      biometric.disable();
      on.value = false;
      uni.showToast({ title: '已关闭并销毁本地钥匙', icon: 'none' });
      return;
    }
    const mk = getCachedMasterKey();
    if (!mk) {
      await resetSwitch();
      uni.showToast({ title: '状态异常，请解锁后再试', icon: 'none' });
      return;
    }
    await bioPrompt.value.open('验证指纹以开启快捷解锁');
    await biometric.enable(mk, getUser());
    on.value = true;
    uni.showToast({ title: '已开启', icon: 'success' });
  } catch (err) {
    await resetSwitch();
    uni.showToast({
      title: err.message === biometric.CANCELLED ? '已取消' : err.message,
      icon: 'none',
    });
  } finally {
    busy.value = false;
  }
}
</script>

<style scoped>
.set-card {
  background: #fff;
  border-radius: 16rpx;
  margin: 24rpx;
  padding: 8rpx 32rpx;
}
.set-row {
  display: flex;
  align-items: center;
  padding: 24rpx 0;
}
.set-main {
  flex: 1;
}
.set-title {
  font-weight: 600;
}
.set-sub {
  color: #999;
  font-size: 24rpx;
  margin-top: 6rpx;
}
.set-note {
  color: #b0b0c0;
  font-size: 24rpx;
  line-height: 1.7;
  padding: 16rpx 0 32rpx;
}
</style>
