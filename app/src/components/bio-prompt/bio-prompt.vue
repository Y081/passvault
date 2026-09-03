<!-- 指纹验证浮层：Android 端承载验证提示 + 取消按钮（plus.fingerprint 无系统弹窗）；
     iOS 端系统自带弹窗，浮层不展示。用法：ref.open(提示文字) 等待验证结果。 -->
<template>
  <view v-if="visible" class="bio-mask" @touchmove.stop.prevent>
    <view class="bio-box">
      <view class="bio-icon" />
      <view class="bio-text">{{ text }}</view>
      <button class="bio-btn" @click="onCancel">{{ cancelText }}</button>
    </view>
  </view>
</template>

<script setup>
import { ref } from 'vue';
import { authenticate, cancelAuth, CANCELLED } from '../../utils/biometric';

const needOverlay = (() => {
  // #ifdef APP-PLUS
  return plus.os.name.toLowerCase() === 'android';
  // #endif
  // #ifndef APP-PLUS
  return false;
  // #endif
})();

// 超时兜底：传感器无响应时自动取消回退主密码，避免无限等待
const TIMEOUT = 15000;

defineProps({
  cancelText: { type: String, default: '取消' },
});

const visible = ref(false);
const text = ref('');
let busy = false;

// resolve = 通过；reject = 取消(CANCELLED) / 超时 / 失败
function open(message) {
  if (busy) return Promise.reject(new Error(CANCELLED));
  busy = true;
  text.value = message;
  visible.value = needOverlay;
  return authenticate(TIMEOUT).finally(() => {
    busy = false;
    visible.value = false;
  });
}

function onCancel() {
  cancelAuth();
}

function isOpen() {
  return busy;
}

defineExpose({ open, cancel: onCancel, isOpen });
</script>

<style scoped>
.bio-mask {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 999;
  background: rgba(17, 20, 45, 0.45);
  display: flex;
  align-items: center;
  justify-content: center;
}
.bio-box {
  width: 480rpx;
  background: #fff;
  border-radius: 24rpx;
  padding: 48rpx 40rpx 32rpx;
  display: flex;
  flex-direction: column;
  align-items: center;
}
.bio-icon {
  width: 140rpx;
  height: 140rpx;
  border-radius: 50%;
  background: #f0f3ff
    url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0ibm9uZSIgc3Ryb2tlPSIjNGE2Y2Y3IiBzdHJva2Utd2lkdGg9IjEuOCIgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIiBzdHJva2UtbGluZWpvaW49InJvdW5kIj48cGF0aCBkPSJNNC42IDExLjRhNy40IDcuNCAwIDAgMSAxNC44IDBjMCAxLjktLjIgMy43LS43IDUuNCIvPjxwYXRoIGQ9Ik03LjEgMTEuNGE0LjkgNC45IDAgMCAxIDkuOCAwYzAgMi42LS40IDUtMS4yIDcuMiIvPjxwYXRoIGQ9Ik05LjYgMTEuNGEyLjQgMi40IDAgMCAxIDQuOCAwYzAgMy4xLS42IDUuOS0xLjggOC4zIi8+PHBhdGggZD0iTTEyLjEgMTEuNGMwIDMuNC0uNyA2LjUtMiA5Ii8+PC9zdmc+')
    center / 76rpx 76rpx no-repeat;
}
.bio-text {
  color: #666;
  font-size: 28rpx;
  margin: 24rpx 0 36rpx;
  text-align: center;
}
.bio-btn {
  width: 100%;
  background: #fff;
  color: #4a6cf7;
  border: 1rpx solid #dfe3ff;
  border-radius: 16rpx;
  font-size: 28rpx;
}
.bio-btn::after {
  border: none;
}
</style>
