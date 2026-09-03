<script>
import { initRandom } from './utils/random';
import { checkUpdate } from './utils/update';

export default {
  onLaunch() {
    initRandom();
    checkUpdate();
  },
};
</script>

<style>
page {
  background: #f5f6fa;
  font-size: 28rpx;
  color: #333;
}
.form-card {
  background: #fff;
  border-radius: 16rpx;
  padding: 32rpx;
  margin: 24rpx;
}
.form-card input {
  border-bottom: 1rpx solid #eee;
  padding: 20rpx 0;
  margin-bottom: 8rpx;
}
.btn {
  margin: 32rpx 24rpx;
  background: #4a6cf7;
  color: #fff;
  border-radius: 16rpx;
}
.link {
  text-align: center;
  color: #4a6cf7;
  padding: 16rpx;
}
/* 登录/注册/解锁三页共用：视口居中限宽卡片，桌面 H5 不拉通全宽 */
.auth-wrap {
  min-height: calc(100vh - var(--window-top, 0px));
  display: flex;
  flex-direction: column;
  justify-content: center;
  padding: 0 48rpx;
  background: linear-gradient(180deg, #eef1ff 0%, #f5f6fa 45%);
}
.auth-card {
  background: #fff;
  border-radius: 20rpx;
  padding: 56rpx 48rpx;
  box-shadow: 0 8rpx 40rpx rgba(74, 108, 247, 0.08);
}
.auth-logo {
  display: block;
  width: 128rpx;
  height: 128rpx;
  margin: 0 auto 20rpx;
  border-radius: 28rpx;
}
.auth-title {
  font-size: 44rpx;
  font-weight: 600;
  text-align: center;
}
.auth-sub {
  color: #999;
  font-size: 24rpx;
  text-align: center;
  margin: 12rpx 0 40rpx;
}
.auth-card input {
  border-bottom: 1rpx solid #e3e5f0;
  padding: 20rpx 0;
  margin-bottom: 8rpx;
  transition: border-color 0.2s;
}
.auth-card input:focus {
  border-bottom-color: #4a6cf7;
}
.pwd-row {
  position: relative;
}
.pwd-row input {
  padding-right: 64rpx;
}
.eye-btn {
  position: absolute;
  right: 0;
  top: 50%;
  transform: translateY(-50%);
  width: 48rpx;
  height: 48rpx;
  /* 默认为划线眼（内容不可见态），加 on 类切换为睁眼 */
  background: url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0ibm9uZSIgc3Ryb2tlPSIjYjBiMGMwIiBzdHJva2Utd2lkdGg9IjIiIHN0cm9rZS1saW5lY2FwPSJyb3VuZCIgc3Ryb2tlLWxpbmVqb2luPSJyb3VuZCI+PHBhdGggZD0iTTE3Ljk0IDE3Ljk0QTEwLjA3IDEwLjA3IDAgMCAxIDEyIDIwYy03IDAtMTEtOC0xMS04YTE4LjQ1IDE4LjQ1IDAgMCAxIDUuMDYtNS45NE05LjkgNC4yNEE5LjEyIDkuMTIgMCAwIDEgMTIgNGM3IDAgMTEgOCAxMSA4YTE4LjUgMTguNSAwIDAgMS0yLjE2IDMuMTltLTYuNzItMS4wN2EzIDMgMCAxIDEtNC4yNC00LjI0Ii8+PGxpbmUgeDE9IjEiIHkxPSIxIiB4Mj0iMjMiIHkyPSIyMyIvPjwvc3ZnPg==') center / 36rpx 36rpx no-repeat;
}
.eye-btn.on {
  background-image: url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0ibm9uZSIgc3Ryb2tlPSIjYjBiMGMwIiBzdHJva2Utd2lkdGg9IjIiIHN0cm9rZS1saW5lY2FwPSJyb3VuZCIgc3Ryb2tlLWxpbmVqb2luPSJyb3VuZCI+PHBhdGggZD0iTTEgMTJzNC03IDExLTcgMTEgNyAxMSA3LTQgNy0xMSA3UzEgMTIgMSAxMnoiLz48Y2lyY2xlIGN4PSIxMiIgY3k9IjEyIiByPSIzIi8+PC9zdmc+');
}
.auth-btn {
  margin: 40rpx 0 0;
  background: linear-gradient(135deg, #6a8bff, #4a6cf7);
  color: #fff;
  border-radius: 16rpx;
  border: none;
  transition: transform 0.1s, opacity 0.1s;
}
.auth-btn::after {
  border: none;
}
.auth-btn:active {
  opacity: 0.85;
  transform: scale(0.98);
}
</style>
