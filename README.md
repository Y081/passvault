# 密小本(PassVault)— 零知识加密密码管理

> 把密码锁进只有你能翻开的小本本。
>
> 一个零知识(Zero-Knowledge)架构的密码管理系统：主密码永不上传，加解密全部发生在用户设备本地，服务端从架构上就无法窥视任何一条密码——数据库被整体拖走、运维人员主动翻库，没有用户的主密码谁也还原不出一条明文。

- 线上体验(H5)：<https://m.colin-web4.cn>
- 浏览器扩展(Edge 商店)：<https://microsoftedge.microsoft.com/addons/detail/hhhdpmfoebgckbonheiimpmlgjhmlcph>
- 用户文档：<https://m.colin-web4.cn/docs/user-guide.html>
- 隐私政策：<https://m.colin-web4.cn/docs/privacy-policy.html>
- 加密核心库：[passvault-crypto](https://github.com/Y081/passvault-crypto)(MIT，可独立审计与引用)

## 功能特性

- **零知识加密**：主密码只在设备内存存在，条目在本地加密后上云；服务端仅存密文与密钥包裹体
- **四端覆盖**：H5 网页 / Android APK(指纹快捷解锁、应用内自动更新)/ 微信小程序 / 浏览器扩展(MV3，已上架 Edge 商店，Chrome 可离线加载)，同一账号数据互通
- **卡片式密码库**：彩色卡片、关键词搜索、默认打码一键显示、逐字段复制
- **锁定即安全**：手动锁定或关闭应用后再进入需主密码(或指纹)解锁，密钥只存在于内存
- **秒换主密码**：改主密码只需重新包裹数据密钥，全部历史数据无需重加密
- **无法找回，诚实告知**：忘记主密码 = 数据永久不可恢复，不留后门

## 零知识加密设计

### 密钥链

```
主密码（只存在于用户设备内存，永不上传）
   │  GET /kdf 取 kdfSalt、kdfIters（公开参数，非机密）
   │  PBKDF2-SHA256(主密码, salt, 10万次) —— 本地计算
   ▼
masterKey（只在设备内存）
   ├─ HMAC-SHA256(masterKey, "passvault-auth:" + 用户名) = authHash ──网络──► 服务端 bcrypt 后存储、登录时比对
   └─ 解开服务端存着的 wrappedDek → DEK（每用户一把数据密钥）→ 逐条解密/加密条目
```

- **登录凭证不是密码**：网络上传输与数据库存储的都是 authHash，从它既还原不出主密码，也推不出 masterKey
- **换设备为什么还能登录**：密钥派生是确定性的——同样的「密码+盐+迭代次数」必然推出同一把 masterKey；新设备向服务端要一下公开的 kdfSalt/kdfIters 即可在本地重演整个推导，主密码全程不出设备
- **条目加密**：每条密码整条 JSON 用 DEK 做 XSalsa20-Poly1305 认证加密(TweetNaCl secretbox)，密文上云，篡改即解密失败
- **改主密码 = 仅重新包裹 DEK**，历史数据零重加密
- 完整实现与 API 文档见 [passvault-crypto](https://github.com/Y081/passvault-crypto)——加密代码量不足 200 行，任何人都可以打开它完成独立审计

### 安全边界（诚实声明）

- 忘记主密码 = 数据永久不可找回，无任何找回机制
- 密钥派生参数服务端同样持有，因此拖库者可对**弱主密码**做离线暴力尝试（每次猜测需 10 万次 PBKDF2，成本被刻意抬高但非零）——主密码强度仍是最后一道防线，这也是 Bitwarden 等主流密码管理器的共同取舍

### 关于服务端

服务端组件暂不开源，但接口契约只容纳密文与衍生凭证（authHash / wrappedDek / 密文条目），不含任何明文。零知识性质由客户端加密库的公开可审计性保证；「服务端是否如约不存明文」的验证方法见用户文档。

## 目录结构

```
passvault/
├── app/             # uni-app 用户端（Vue3 + Vite）：H5 / Android APK / 微信小程序
├── extension/       # 浏览器扩展（WXT + Vue3，MV3）
├── docs/            # 用户文档源（md → 自包含单文件 HTML）
└── image/           # 文档/界面截图素材
```

## 快速开始

### H5

```bash
cd app && npm install && npm run dev:h5   # http://localhost:5173
node e2e.mjs                              # 端到端加密回归
```

需要本地后端(接口契约见用户文档)。

### 浏览器扩展(Chrome / Edge)

**正式安装（推荐）**：从 [Edge 加载项商店](https://microsoftedge.microsoft.com/addons/detail/hhhdpmfoebgckbonheiimpmlgjhmlcph) 一键安装，自动跟随更新；Chrome 用户可从[用户文档页](https://m.colin-web4.cn/docs/user-guide.html)下载 zip 包离线加载。

本地开发构建：

```bash
cd extension
echo "VITE_API_BASE=https://m.colin-web4.cn/api" > .env   # 本地联调改 http://127.0.0.1:9991/api
npm install && npm run build      # 产物 .output/chrome-mv3/，chrome://extensions 开发者模式加载
npm run zip                       # 出正式分发包
```

### Android APK / 微信小程序

用 HBuilderX 打开 `app` 目录：

- **APK**：「发行 → 原生App云打包」；发版前在 `manifest.json` 将 `versionCode` +1（应用内自动更新依赖它）
- **小程序**：`manifest.json` 填入 AppID 后运行到微信开发者工具；正式发布需大陆备案域名

### 用户文档

```bash
cd docs && npm install && npm run build   # 产物 dist/user-guide.html（自包含单文件，可直接分发）
```

## 开源协议

- 本仓库（客户端产品）: [AGPL-3.0](LICENSE)
- [passvault-crypto](https://github.com/Y081/passvault-crypto)（加密核心库）: MIT
- 产品图标、名称「密小本」为项目方品牌资产，与上述许可证相互独立

## 计划 / Roadmap

- rekey（改主密码）客户端 UI
- 浏览器扩展：闲置自动锁定、保存新密码反向捕获（页面自动填充 v1 已上线）
- 微信小程序正式发布（需大陆备案域名）

---

*密小本 · 把密码锁进只有你能翻开的小本本。*
