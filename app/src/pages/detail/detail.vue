<template>
  <view class="detail-card">
    <view class="d-head">
      <view class="avatar" :style="{ background: color }">{{ initial }}</view>
      <view class="d-head-main">
        <view class="d-title">{{ form.title || '（无标题）' }}</view>
        <view class="d-sub">{{ form.username || '—' }}</view>
      </view>
    </view>

    <view class="field">
      <view class="label">账号</view>
      <view class="value">{{ form.username || '—' }}</view>
      <view class="act" @click="copy(form.username, '账号')">复制</view>
    </view>
    <view class="field">
      <view class="label">密码</view>
      <view class="value password">{{ visible ? form.password : mask }}</view>
      <view class="act" @click="visible = !visible">{{ visible ? '隐藏' : '显示' }}</view>
      <view class="act" @click="copy(form.password, '密码')">复制</view>
    </view>
    <view class="field" v-if="form.url">
      <view class="label">网址</view>
      <view class="value">{{ form.url }}</view>
      <view class="act" @click="copy(form.url, '网址')">复制</view>
    </view>
    <view class="field" v-if="form.note">
      <view class="label">备注</view>
      <view class="value">{{ form.note }}</view>
    </view>
    <view class="time" v-if="updateTime">更新于 {{ updateTime }}</view>
  </view>

  <button class="btn" @click="goEdit">编辑</button>
  <button class="btn danger" @click="del">删除</button>
</template>

<script setup>
import { computed, ref } from 'vue';
import { onLoad, onShow } from '@dcloudio/uni-app';
import { decryptItem } from 'passvault-crypto';
import { api } from '../../api';
import { getDek } from '../../utils/session';

const COLORS = ['#4a6cf7', '#00b578', '#ff8f1f', '#8b5cf6', '#e05252', '#00a3e0'];
const id = ref('');
const form = ref({ title: '', username: '', password: '', url: '', note: '' });
const visible = ref(false);
const updateTime = ref('');
const color = ref('#4a6cf7');

const initial = computed(() => (form.value.title || '?').charAt(0).toUpperCase());
const mask = computed(() => '•'.repeat(Math.min((form.value.password || '').length || 8, 12)));

onLoad((query) => {
  id.value = query.id || '';
});

// 从编辑页返回时也重新加载，保证展示最新密文解密结果
onShow(load);

async function load() {
  if (!id.value) return;
  try {
    const list = await api.listItems();
    const row = list.find((r) => String(r.id) === String(id.value));
    if (!row) {
      uni.navigateBack();
      return;
    }
    const data = decryptItem(row.ciphertext, row.nonce, getDek());
    if (data) form.value = data;
    updateTime.value = row.updateTime;
    // 明文展示每次进入默认隐藏
    visible.value = false;
    color.value = COLORS[(form.value.title || '?').charCodeAt(0) % COLORS.length];
  } catch (e) {
    uni.showToast({ title: e.message, icon: 'none' });
  }
}

function copy(text, label) {
  if (!text) return;
  uni.setClipboardData({
    data: text,
    success: () => uni.showToast({ title: '已复制' + label, icon: 'success' }),
  });
}

function goEdit() {
  uni.navigateTo({ url: '/pages/edit/edit?id=' + id.value });
}

async function del() {
  const ok = await new Promise((resolve) => {
    uni.showModal({
      title: '删除确认',
      content: '删除后无法恢复，确定？',
      success: (r) => resolve(r.confirm),
    });
  });
  if (!ok) return;
  await api.deleteItem(id.value);
  uni.showToast({ title: '已删除', icon: 'success' });
  setTimeout(() => uni.navigateBack(), 500);
}
</script>

<style scoped>
.detail-card {
  background: #fff;
  border-radius: 16rpx;
  margin: 24rpx;
  padding: 32rpx;
}
.d-head {
  display: flex;
  align-items: center;
  padding-bottom: 24rpx;
  border-bottom: 1rpx solid #f0f0f0;
}
.avatar {
  width: 96rpx;
  height: 96rpx;
  border-radius: 24rpx;
  color: #fff;
  font-size: 44rpx;
  font-weight: 600;
  text-align: center;
  line-height: 96rpx;
  margin-right: 24rpx;
  flex-shrink: 0;
}
.d-title {
  font-size: 36rpx;
  font-weight: 600;
}
.d-sub {
  color: #999;
  font-size: 26rpx;
  margin-top: 6rpx;
}
.field {
  display: flex;
  align-items: center;
  padding: 24rpx 0;
  border-bottom: 1rpx solid #f5f5f5;
}
.label {
  width: 96rpx;
  color: #999;
  font-size: 26rpx;
  flex-shrink: 0;
}
.value {
  flex: 1;
  word-break: break-all;
  padding-right: 16rpx;
}
.password {
  font-family: monospace;
  letter-spacing: 2rpx;
}
.act {
  color: #4a6cf7;
  font-size: 26rpx;
  padding: 8rpx 0 8rpx 24rpx;
  flex-shrink: 0;
}
.time {
  color: #bbb;
  font-size: 22rpx;
  padding-top: 20rpx;
  text-align: center;
}
.danger {
  background: #e05252;
}
</style>
