import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  plugins: [vue()],
  server: {
    port: 5173,
    proxy: {
      '/functions/v1': {
        target: 'https://hizynzkovnnugjedqpuw.supabase.co',
        changeOrigin: true,
        secure: true,
      },
    },
  }
})
