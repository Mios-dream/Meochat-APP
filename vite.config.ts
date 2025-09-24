import { fileURLToPath, URL } from 'node:url'

import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import vueDevTools from 'vite-plugin-vue-devtools'
import path from 'path'

// https://vite.dev/config/
export default defineConfig({
  plugins: [vue(), vueDevTools()],
  resolve: {
    alias: {
      '@framework': path.resolve(__dirname, './src/live2d/Framework/src'),
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
})
