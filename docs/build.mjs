// 用户指南构建：user-guide.md → 自包含单文件 HTML（logo 内联、移动端适配、下载链接按钮化）
// 发布链接统一在此维护，md 里用 {{H5_URL}}/{{APK_URL}}/{{EXT_ZIP_URL}} 占位
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { marked } from 'marked';

const LINKS = {
  H5_URL: 'https://m.colin-web4.cn',
  APK_URL: 'https://m.colin-web4.cn/downloads/mxb1.apk',
  EXT_ZIP_URL: 'https://m.colin-web4.cn/downloads/passvault-extension-0.1.0-chrome.zip',
};

let md = readFileSync(new URL('./user-guide.md', import.meta.url), 'utf8');
for (const [k, v] of Object.entries(LINKS)) md = md.replaceAll(`{{${k}}}`, v);
// 页头已含品牌标题，去掉 md 首个 h1 避免重复
md = md.replace(/^# .*?\n/, '');

const logoB64 = readFileSync(new URL('../app/src/static/logo.png', import.meta.url)).toString('base64');
let body = marked.parse(md);
// 「👉 [文字](链接)」单独成行的下载入口渲染成按钮（容忍粗体包裹等修饰标签）
body = body.replace(/<p>👉 (?:<strong>)?<a href="([^"]+)">([^<]+)<\/a>(?:<\/strong>)?<\/p>/g, (_m, href, text) =>
  `<p class="cta"><a class="btn" href="${href}">${text}</a></p>`
);
// 本地截图（image/*.png）内联为 data URI，保持单文件自包含
body = body.replace(/<img src="(image\/[^"]+)"/g, (_m, rel) => {
  const b64 = readFileSync(new URL('../' + rel, import.meta.url)).toString('base64');
  return `<img loading="lazy" src="data:image/png;base64,${b64}"`;
});

const html = `<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>密小本 PassVault 使用指南</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    font-family: -apple-system, 'Segoe UI', 'PingFang SC', 'Microsoft YaHei', sans-serif;
    background: #f5f6fa; color: #333; line-height: 1.75; font-size: 16px;
  }
  .topbar { height: 4px; background: linear-gradient(90deg, #4a6cf7, #8b5cf6); }
  .banner { text-align: center; padding: 36px 16px 24px; }
  .banner img { width: 72px; height: 72px; border-radius: 18px; }
  .banner h1 { font-size: 26px; margin-top: 12px; color: #222; }
  .banner h1 span { font-size: 16px; color: #999; font-weight: 400; margin-left: 6px; }
  .banner p { color: #888; font-size: 14px; margin-top: 4px; }
  main { max-width: 720px; margin: 0 auto; padding: 8px 20px 48px; }
  main img { max-width: 100%; border-radius: 10px; }
  main > p > img { display: block; margin: 14px auto 0; box-shadow: 0 4px 16px rgba(0, 0, 0, 0.1); }
  .shots { display: flex; gap: 20px; justify-content: center; margin-top: 14px; }
  .shots img { width: 200px; border-radius: 14px; box-shadow: 0 4px 16px rgba(0, 0, 0, 0.12); }
  main > * + * { margin-top: 14px; }
  h2 {
    font-size: 20px; color: #222; margin-top: 36px; padding-bottom: 8px;
    border-bottom: 2px solid #e8eaf1;
  }
  h2::before { content: ''; display: inline-block; width: 4px; height: 18px; background: #4a6cf7; border-radius: 2px; margin-right: 10px; vertical-align: -2px; }
  h3 { font-size: 17px; color: #333; margin-top: 24px; }
  p { margin-top: 10px; }
  ul, ol { padding-left: 22px; margin-top: 10px; }
  li { margin-top: 6px; }
  a { color: #4a6cf7; text-decoration: none; }
  a:hover { text-decoration: underline; }
  p.cta { margin-top: 14px; }
  a.btn {
    display: inline-block; background: #4a6cf7; color: #fff; font-size: 16px;
    padding: 12px 28px; border-radius: 10px; text-decoration: none;
    box-shadow: 0 4px 14px rgba(74, 108, 247, 0.35);
  }
  a.btn:hover { background: #3b5bdb; text-decoration: none; }
  blockquote {
    background: #fff7e8; border-left: 4px solid #f5a623; border-radius: 8px;
    padding: 12px 16px; margin-top: 12px; color: #8a5b00; font-size: 15px;
  }
  table { width: 100%; border-collapse: collapse; margin-top: 12px; background: #fff; border-radius: 10px; overflow: hidden; font-size: 15px; }
  th, td { padding: 10px 12px; text-align: left; border-bottom: 1px solid #eef0f5; }
  th { background: #f0f2f8; color: #444; white-space: nowrap; }
  tr:last-child td { border-bottom: none; }
  code {
    background: #eceef4; border-radius: 4px; padding: 2px 6px;
    font-family: Consolas, 'Courier New', monospace; font-size: 14px; color: #c7254e;
  }
  hr { border: none; border-top: 1px solid #e8eaf1; margin-top: 32px; }
  footer { text-align: center; color: #bbb; font-size: 13px; padding: 24px 0 40px; }
</style>
</head>
<body>
<div class="topbar"></div>
<div class="banner">
  <img src="data:image/png;base64,${logoB64}" alt="密小本">
  <h1>密小本<span>PassVault</span></h1>
  <p>零知识密码管理 · 主密码不上传 · 数据加密后仅你可读</p>
</div>
<main>
${body}
</main>
<footer>密小本 PassVault · 官方使用指南</footer>
</body>
</html>`;

mkdirSync(new URL('./dist', import.meta.url), { recursive: true });
writeFileSync(new URL('./dist/user-guide.html', import.meta.url), html);
writeFileSync(new URL('./dist/user-guide.md', import.meta.url), md);
console.log('OK docs/dist/user-guide.html,', (html.length / 1024).toFixed(1) + 'KB');
