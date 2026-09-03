// APK 自动更新（仅 APP 端 Android 生效，H5 为空实现）
// 版本清单是 nginx /downloads/version.json 静态文件，每次发版手动更新：
// { "versionCode": 2, "version": "0.2.0", "note": "更新说明", "apk": "/downloads/app-0.2.0.apk" }
// 注意：versionCode 必须大于已发布 APK 才会提示，HBuilderX 云打包前手动在 manifest 里 +1。
const VERSION_URL = 'https://m.colin-web4.cn/downloads/version.json?t=';

let prompted = false;

export function checkUpdate() {
  // #ifdef APP-PLUS
  if (prompted) return;
  try {
    if (plus.os.name.toLowerCase() !== 'android') return;
  } catch (e) {
    return;
  }
  plus.runtime.getProperty(plus.runtime.appid, (app) => {
    getRemoteVersion()
      .then((remote) => {
        if (!remote || !remote.versionCode) return;
        if (!(Number(remote.versionCode) > Number(app.versionCode))) return;
        showPrompt(remote);
      })
      .catch(() => {
        /* 网络/清单异常静默，下次冷启动再试 */
      });
  });
  // #endif
}

function getRemoteVersion() {
  return new Promise((resolve, reject) => {
    uni.request({
      url: VERSION_URL + Date.now(),
      method: 'GET',
      success: (res) => resolve(res.statusCode === 200 ? res.data : null),
      fail: reject,
    });
  });
}

function showPrompt(remote) {
  prompted = true;
  uni.showModal({
    title: '发现新版本 ' + (remote.version || ''),
    content: remote.note || '优化体验与修复问题，建议更新。',
    confirmText: '立即更新',
    cancelText: '以后再说',
    success: (res) => {
      if (res.confirm) downloadInstall(remote.apk);
    },
  });
}

function downloadInstall(apk) {
  if (!apk) {
    uni.showToast({ title: '更新包地址异常，请到官网下载', icon: 'none' });
    return;
  }
  const url = apk.indexOf('http') === 0 ? apk : 'https://m.colin-web4.cn' + apk;
  uni.showLoading({ title: '0%' });
  const task = uni.downloadFile({
    url,
    success: (res) => {
      uni.hideLoading();
      if (res.statusCode !== 200) {
        uni.showToast({ title: '下载失败，请稍后重试', icon: 'none' });
        return;
      }
      // 调起系统安装器；Android 8+ 首次会询问「允许安装未知应用」
      plus.runtime.openFile(res.tempFilePath);
    },
    fail: () => {
      uni.hideLoading();
      uni.showToast({ title: '下载失败，请检查网络', icon: 'none' });
    },
  });
  task.onProgressUpdate((e) => {
    uni.showLoading({ title: e.progress + '%' });
  });
}
