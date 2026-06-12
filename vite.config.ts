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
    allowedHosts: true,
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
          // http-proxy 对长连接不会主动传播客户端断连：
          // 浏览器刷新/关页面只断开"浏览器↔Vite"，"Vite↔Koa"会一直挂着，
          // 导致后端 req.on('close') 永不触发、生成无法止血。手动销毁上游连接。
          proxy.on('proxyReq', (proxyReq, _req, res) => {
            res.on('close', () => proxyReq.destroy())
          })
        }
      }
    }
  }
})
