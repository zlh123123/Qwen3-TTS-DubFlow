import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()], // 这里只需要 react()，Tailwind v3 会自动读取 postcss 配置
  server: {
    host: '0.0.0.0',
    port: 5173,
    proxy: {
      // 代理配置：将 /api 开头的请求转发给后端 Python 服务
      '/api': {
        target: 'http://127.0.0.1:8000', // 确保你的后端运行在这个地址
        changeOrigin: true,
      }
    }
  }
})