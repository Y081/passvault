import { defineConfig } from 'wxt';

const e2e = process.env.PV_E2E === '1';

export default defineConfig({
  modules: ['@wxt-dev/module-vue'],
  manifest: {
    name: '密小本 PassVault',
    description: '零知识密码管理：主密码不上传，数据加密后仅你可读',
    permissions: ['storage'],
    // 本地 127.0.0.1:9991 仅供开发联调（后端无 CORS，跨源 fetch 必须列 host_permissions）
    host_permissions: ['https://m.colin-web4.cn/*', 'http://127.0.0.1:9991/*'],
    action: { default_title: '密小本' },
    // 仅 e2e 构建：允许外部顶层导航打开 popup.html（chrome 拦截 chrome-extension:// 顶层导航）。
    // 不得进入正式包——WAC 会让任意网站 iframe 嵌入 popup 读取已解锁数据
    ...(e2e
      ? { web_accessible_resources: [{ resources: ['popup.html'], matches: ['<all_urls>'] }] }
      : {}),
  },
});
