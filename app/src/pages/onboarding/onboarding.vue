<template>
  <view class="ob">
    <view class="skip" @click="finish">跳过</view>
    <swiper class="swiper" :current="cur" @change="(e) => (cur = e.detail.current)">
      <swiper-item v-for="p in pages" :key="p.title" class="slide">
        <view class="center">
          <view class="ring">
            <view class="ring-dot" />
            <text class="emoji">{{ p.emoji }}</text>
          </view>
          <view class="title">{{ p.title }}</view>
          <view class="desc">{{ p.desc }}</view>
        </view>
      </swiper-item>
    </swiper>
    <view class="foot">
      <view class="dots">
        <view v-for="(p, i) in pages" :key="i" class="dot" :class="{ on: cur === i }" @click="cur = i" />
      </view>
      <button class="next" @click="next">{{ cur === pages.length - 1 ? '开始使用' : '下一步' }}</button>
    </view>
  </view>
</template>

<script setup>
import { ref } from 'vue';

const pages = [
  { emoji: '🔐', title: '给你的密码一个保险柜', desc: '本地加密存储，一个主密码解锁全部' },
  { emoji: '☁️', title: '网页、插件、手机多端同步', desc: '登录同一账号，数据实时互通' },
  { emoji: '🎲', title: '一键生成高强度密码', desc: '大小写、数字与符号随机组合' },
];
const cur = ref(0);

function next() {
  if (cur.value === pages.length - 1) {
    finish();
  } else {
    cur.value++;
  }
}

function finish() {
  uni.setStorageSync('pv_onboarded', '1');
  uni.reLaunch({ url: '/pages/login/login' });
}
</script>

<style scoped>
.ob {
  height: 100vh;
  background: linear-gradient(180deg, #eef1ff 0%, #f5f6fa 55%);
  position: relative;
  display: flex;
  flex-direction: column;
}
.skip {
  position: absolute;
  top: 24rpx;
  right: 32rpx;
  color: #999;
  font-size: 28rpx;
  padding: 12rpx;
  z-index: 2;
}
.swiper {
  flex: 1;
}
.slide {
  display: flex;
}
.center {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 0 60rpx;
  text-align: center;
}
.ring {
  width: 260rpx;
  height: 260rpx;
  border-radius: 50%;
  border: 6rpx solid #4a6cf7;
  background: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
  box-shadow: 0 16rpx 48rpx rgba(74, 108, 247, 0.18);
}
.ring-dot {
  position: absolute;
  right: -8rpx;
  top: 24rpx;
  width: 28rpx;
  height: 28rpx;
  border-radius: 50%;
  background: #8b5cf6;
}
.emoji {
  font-size: 96rpx;
}
.title {
  margin-top: 56rpx;
  font-size: 40rpx;
  font-weight: 600;
  color: #222;
}
.desc {
  margin-top: 20rpx;
  font-size: 28rpx;
  color: #888;
  max-width: 480rpx;
}
.foot {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 40rpx 60rpx 80rpx;
}
.dots {
  display: flex;
  gap: 14rpx;
}
.dot {
  width: 14rpx;
  height: 14rpx;
  border-radius: 999rpx;
  background: #d6d9e8;
}
.dot.on {
  width: 40rpx;
  background: #4a6cf7;
}
.next {
  min-width: 220rpx;
  background: #4a6cf7;
  color: #fff;
  font-size: 30rpx;
  border-radius: 999rpx;
  padding: 12rpx 36rpx;
  margin: 0;
}
</style>
