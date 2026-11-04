import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  plugins: [vue()],
  server: {
    port: 5173,
    proxy: {
      // 本地开发模拟线上 Cloudflare Pages 的 /api 反代
      '/api': {
        target: 'https://hizynzkovnnugjedqpuw.supabase.co',
        changeOrigin: true,
        secure: true,
        rewrite: (path) => path.replace(/^\/api/, '/functions/v1')
      },
      // 保留旧路径，方便本地直接调试单个 Edge Function
      '/functions/v1': {
        target: 'https://hizynzkovnnugjedqpuw.supabase.co',
        changeOrigin: true,
        secure: true
      }
    },
  }
})
