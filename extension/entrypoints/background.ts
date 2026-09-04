import { decryptItem } from 'passvault-crypto';
import { api } from '../lib/api';
import { getDek, getKeyInfo, getToken } from '../lib/session';

// content script 的自动填充消息处理。
// 安全边界：解密只发生在 background（扩展受信上下文）；列表阶段只回标题/账号，
// 密码仅在用户点中某条时按 id 解密返回，用完即弃，不进任何存储。

export default defineBackground(() => {
  chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    handleMessage(msg)
      .then(sendResponse)
      .catch((e) => sendResponse({ error: (e && e.message) || 'unknown error' }));
    return true; // 异步 sendResponse
  });
});

async function handle(msg: any) {
  if (msg.type === 'PV_LIST') {
    if (!(await getToken())) return { auth: false };
    const [dek, keyInfo] = [await getDek(), await getKeyInfo()];
    if (!dek || !keyInfo) return { locked: true };
    let rows;
    try {
      rows = await api.listItems();
    } catch (e: any) {
      // token 过期等鉴权失败：让浮层提示去登录，而不是"加载失败"
      if (e && e.auth) return { auth: false };
      throw e;
    }
    const items = [];
    for (const row of rows) {
      const data = decryptItem(row.ciphertext, row.nonce, dek);
      if (data) {
        items.push({
          id: String(row.id),
          title: data.title || '（无标题）',
          username: data.username || '',
          url: data.url || '',
        });
      }
    }
    return { items };
  }

  if (msg.type === 'PV_CRED') {
    const dek = await getDek();
    if (!dek) return { locked: true };
    const rows = await api.listItems();
    const row = rows.find((r: any) => String(r.id) === String(msg.id));
    if (!row) return { error: '条目不存在' };
    const data = decryptItem(row.ciphertext, row.nonce, dek);
    if (!data) return { error: '解密失败' };
    return { username: data.username || '', password: data.password || '' };
  }

  return { error: 'unknown message' };
}
