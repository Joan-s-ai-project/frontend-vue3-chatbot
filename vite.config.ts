import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { fileURLToPath, URL } from 'node:url'

// https://vite.dev/config/
export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url))
    }
  },
  server: {
    host: '0.0.0.0',
    proxy: {
      // 将 /api 代理到 Koa 后端
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
        // 针对 SSE 流式响应，必须关闭代理缓冲
        configure: (proxy) => {
          proxy.on('proxyRes', (proxyRes) => {
            // 当后端返回 SSE 时，禁用代理层的缓冲
            if (proxyRes.headers['content-type']?.includes('text/event-stream')) {
              proxyRes.headers['cache-control'] = 'no-cache'
              proxyRes.headers['x-accel-buffering'] = 'no'
            }
          })
        }
      }
    }
  }
})
