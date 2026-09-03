<template>
  <view class="form-card">
    <input v-model="form.title" placeholder="标题（如：QQ邮箱）" />
    <input v-model="form.username" placeholder="账号" />
    <input v-model="form.password" password placeholder="密码" />
    <input v-model="form.url" placeholder="网址（选填）" />
    <input v-model="form.note" placeholder="备注（选填）" />
  </view>
  <button class="btn" :loading="busy" @click="save">保存（本地加密后上传密文）</button>
  <button v-if="id" class="btn danger" @click="del">删除</button>
</template>

<script setup>
import { ref } from 'vue';
import { onLoad } from '@dcloudio/uni-app';
import { decryptItem, encryptItem } from 'passvault-crypto';
import { api } from '../../api';
import { getDek } from '../../utils/session';
import { ensureRandom } from '../../utils/random';

const id = ref(null);
const form = ref({ title: '', username: '', password: '', url: '', note: '' });
const busy = ref(false);

onLoad(async (query) => {
  if (query.id) {
    // 雪花 ID 超出 JS Number 安全整数范围，必须保持字符串，不能 Number()
    id.value = query.id;
    const list = await api.listItems();
    const row = list.find((r) => String(r.id) === String(id.value));
    if (row) {
      const data = decryptItem(row.ciphertext, row.nonce, getDek());
      if (data) form.value = data;
    }
  }
});

async function save() {
  if (!form.value.title || !form.value.password) {
    uni.showToast({ title: '标题和密码必填', icon: 'none' });
    return;
  }
  busy.value = true;
  try {
    await ensureRandom();
    const enc = encryptItem(form.value, getDek());
    if (id.value) {
      await api.updateItem(id.value, enc);
    } else {
      await api.createItem(enc);
    }
    uni.showToast({ title: '已保存', icon: 'success' });
    setTimeout(() => uni.navigateBack(), 500);
  } catch (e) {
    uni.showToast({ title: e.message, icon: 'none' });
  } finally {
    busy.value = false;
  }
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
  uni.navigateBack();
}
</script>

<style scoped>
.danger {
  background: #e05252;
}
</style>
