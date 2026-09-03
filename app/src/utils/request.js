// H5 与页面同域，走 Nginx 反代；小程序需要绝对地址（正式域名 + HTTPS）
// #ifdef H5
const BASE_URL = '/api';
// #endif
// #ifndef H5
const BASE_URL = 'https://m.colin-web4.cn/api';
// #endif

export function request(method, path, data) {
  return new Promise((resolve, reject) => {
    uni.request({
      url: BASE_URL + path,
      method,
      data,
      // APP 端传自定义 header 时 Content-Type 不会自动带上默认值，必须显式声明，
      // 否则 POST 以 text/plain 到达后端，@RequestBody 直接 500
      header: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + (uni.getStorageSync('pv_token') || '') },
      success: (res) => {
        // Sz-Admin 统一响应：{ code: "0000", message, data }
        if (res.statusCode === 200 && res.data && res.data.code === '0000') {
          resolve(res.data.data);
        } else {
          const msg = (res.data && res.data.message) || 'HTTP ' + res.statusCode;
          // C105/登录态失效：清掉本地 token 强制重新登录，避免卡死在过期状态
          const notLogin = res.statusCode === 401 || (res.data && res.data.code === 'C105');
          if (notLogin) {
            uni.removeStorageSync('pv_token');
            uni.reLaunch({ url: '/pages/login/login' });
          }
          reject(new Error(msg));
        }
      },
      fail: (err) => reject(new Error(err.errMsg || '网络错误')),
    });
  });
}
