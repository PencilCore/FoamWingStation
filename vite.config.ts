import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  base: '/FoamWingStation/',
  plugins: [react()],
  assetsInclude: ['**/*.dat'],   // 告诉 Vite 这些是静态资源，不是 JS
  server: {
    // 加上这三行，神仙配置，public/airfoils 立刻能访问！
    fs: {
      allow: ['.']
    }
  }
})
