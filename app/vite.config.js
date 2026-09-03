import { defineConfig } from 'vite'
import uni from '@dcloudio/vite-plugin-uni'
// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    uni(),
  ],
  server: {
    proxy: {
      // H5 端 request.js 走相对路径 /api，开发时转发到本地后端（context-path=/api）
      '/api': {
        target: 'http://127.0.0.1:9991',
        changeOrigin: true,
      },
    },
  },
})
