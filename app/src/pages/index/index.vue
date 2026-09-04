<template>
  <view class="page">
    <view class="search-bar">
      <input v-model="keyword" placeholder="搜索" />
      <view class="tool" @click="doLock">🔒</view>
      <view class="tool" @click="goSettings">⚙️</view>
      <view class="tool-add" @click="goAdd">＋</view>
    </view>
    <view v-for="it in filtered" :key="it.id" class="item-card" @click="goDetail(it.id)">
      <view class="avatar" :style="{ background: it.color }">{{ it.initial }}</view>
      <view class="item-main">
        <view class="item-title">{{ it.data.title || '（无标题）' }}</view>
        <view class="item-sub">{{ it.data.username }}</view>
      </view>
      <view class="copy" @click.stop="copyPw(it)">复制</view>
    </view>
    <view v-if="!items.length" class="empty" @click="goAdd">
      <view class="empty-icon">＋</view>
      <view class="empty-text">还没有密码</view>
      <view class="empty-btn">添加第一个密码</view>
    </view>
    <view v-else-if="!filtered.length" class="empty empty-text">没有匹配的密码</view>
  </view>
</template>

<script setup>
import { computed, ref } from 'vue';
import { onPullDownRefresh, onShow } from '@dcloudio/uni-app';
import { decryptItem } from 'passvault-crypto';
import { api } from '../../api';
import { autoUnlock, getDek, getKeyInfo, hasToken, lock, setKeyInfo } from '../../utils/session';

const COLORS = ['#4a6cf7', '#00b578', '#ff8f1f', '#8b5cf6', '#e05252', '#00a3e0'];
const items = ref([]);
const keyword = ref('');

const filtered = computed(() => {
  const kw = keyword.value.trim().toLowerCase();
  if (!kw) return items.value;
  return items.value.filter(
    (it) => (it.data.title || '').toLowerCase().includes(kw) || (it.data.username || '').toLowerCase().includes(kw)
  );
});

onShow(async () => {
  if (!hasToken()) {
    uni.reLaunch({ url: '/pages/login/login' });
    return;
  }
  try {
    if (!getKeyInfo()) {
      setKeyInfo(await api.getKey());
    }
    if (!autoUnlock()) {
      uni.navigateTo({ url: '/pages/unlock/unlock' });
      return;
    }
    await load();
  } catch (e) {
    uni.showToast({ title: e.message, icon: 'none' });
  }
});

onPullDownRefresh(async () => {
  try {
    await load();
  } finally {
    uni.stopPullDownRefresh();
  }
});

async function load() {
  const dek = getDek();
  const list = await api.listItems();
  items.value = list.map((row) => {
    // 密文在客户端解密；篡改或密钥不匹配时标记为不可读
    const data = decryptItem(row.ciphertext, row.nonce, dek) || { title: '（无法解密）', username: '' };
    return {
      id: row.id,
      updateTime: row.updateTime,
      initial: (data.title || '?').charAt(0).toUpperCase(),
      color: COLORS[(data.title || '?').charCodeAt(0) % COLORS.length],
      data,
    };
  });
}

function goDetail(id) {
  uni.navigateTo({ url: '/pages/detail/detail?id=' + id });
}

function goAdd() {
  uni.navigateTo({ url: '/pages/edit/edit' });
}

function goSettings() {
  uni.navigateTo({ url: '/pages/settings/settings' });
}

// 列表卡片右侧「复制」= 复制密码；FAB 已移除，此按钮不再有遮挡问题
function copyPw(it) {
  uni.setClipboardData({
    data: it.data.password || '',
    success: () => uni.showToast({ title: '已复制密码', icon: 'success' }),
  });
}

function doLock() {
  lock();
  uni.showToast({ title: '已锁定', icon: 'none' });
  setTimeout(() => uni.navigateTo({ url: '/pages/unlock/unlock' }), 400);
}
</script>

<style scoped>
.page {
  padding-bottom: 40rpx;
}
.search-bar {
  display: flex;
  align-items: center;
  padding: 16rpx 24rpx;
}
.search-bar input {
  flex: 1;
  background: #fff;
  border-radius: 16rpx;
  padding: 16rpx 24rpx;
  margin-right: 8rpx;
}
.tool {
  font-size: 40rpx;
  padding: 8rpx 10rpx;
}
.tool-add {
  width: 64rpx;
  height: 64rpx;
  border-radius: 16rpx;
  background: #4a6cf7;
  color: #fff;
  font-size: 40rpx;
  text-align: center;
  line-height: 60rpx;
  margin-left: 8rpx;
  box-shadow: 0 4rpx 12rpx rgba(74, 108, 247, 0.35);
}
.item-card {
  display: flex;
  align-items: center;
  background: #fff;
  border-radius: 16rpx;
  padding: 24rpx;
  margin: 16rpx 24rpx;
}
.avatar {
  width: 76rpx;
  height: 76rpx;
  border-radius: 20rpx;
  color: #fff;
  font-size: 36rpx;
  font-weight: 600;
  text-align: center;
  line-height: 76rpx;
  margin-right: 20rpx;
  flex-shrink: 0;
}
.item-main {
  flex: 1;
  overflow: hidden;
}
.item-title {
  font-weight: 600;
}
.item-sub {
  color: #999;
  font-size: 24rpx;
  margin-top: 6rpx;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 140rpx 0;
  color: #bbb;
}
.empty-icon {
  width: 120rpx;
  height: 120rpx;
  border-radius: 50%;
  background: #fff;
  color: #4a6cf7;
  font-size: 60rpx;
  line-height: 116rpx;
  box-shadow: 0 8rpx 24rpx rgba(74, 108, 247, 0.15);
}
.empty-text {
  margin-top: 20rpx;
}
.empty-btn {
  margin-top: 28rpx;
  background: #4a6cf7;
  color: #fff;
  font-size: 28rpx;
  padding: 16rpx 44rpx;
  border-radius: 40rpx;
}
</style>
