<template>
  <view class="splash">
    <view class="logo-wrap">
      <image class="logo" src="/static/logo.png" mode="aspectFit" />
    </view>
    <view class="name">密小本</view>
    <view class="slogan">主密码不上传，数据加密后仅你可读</view>
    <view class="bar"><view class="bar-run" /></view>
  </view>
</template>

<script setup>
import { onShow } from '@dcloudio/uni-app';
import { hasToken } from '../../utils/session';

// HTML 启动页：原生启动屏只存在一瞬，用户看到的主画面是本页（纯 CSS，清晰）。
// 最少展示 1.1s 避免闪屏，随后按登录态/引导标记路由。
onShow(() => {
  setTimeout(() => {
    const target = !hasToken()
      ? uni.getStorageSync('pv_onboarded')
        ? '/pages/login/login'
        : '/pages/onboarding/onboarding'
      : '/pages/index/index';
    uni.reLaunch({ url: target });
  }, 1100);
});
</script>

<style scoped>
.splash {
  height: 100vh;
  background: linear-gradient(180deg, #eef1ff 0%, #f5f6fa 60%);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  position: relative;
}
.logo-wrap {
  width: 160rpx;
  height: 160rpx;
  border-radius: 40rpx;
  overflow: hidden;
  box-shadow: 0 20rpx 60rpx rgba(74, 108, 247, 0.25);
  animation: pop 0.6s ease both;
}
.logo {
  width: 100%;
  height: 100%;
}
.name {
  margin-top: 36rpx;
  font-size: 48rpx;
  font-weight: 700;
  color: #222;
  animation: pop 0.6s 0.15s ease both;
}
.slogan {
  margin-top: 14rpx;
  font-size: 26rpx;
  color: #999;
  animation: pop 0.6s 0.3s ease both;
}
.bar {
  position: absolute;
  bottom: 120rpx;
  width: 320rpx;
  height: 6rpx;
  border-radius: 999rpx;
  background: #dfe3f5;
  overflow: hidden;
}
.bar-run {
  width: 40%;
  height: 100%;
  border-radius: 999rpx;
  background: linear-gradient(90deg, #6a8bff, #4a6cf7);
  animation: run 1.1s ease-in-out infinite;
}
@keyframes pop {
  from {
    opacity: 0;
    transform: translateY(24rpx) scale(0.92);
  }
  to {
    opacity: 1;
    transform: none;
  }
}
@keyframes run {
  from {
    transform: translateX(-120%);
  }
  to {
    transform: translateX(320%);
  }
}
</style>
