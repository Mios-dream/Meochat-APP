import { resolve } from 'path'
import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  main: {
    resolve: {
      alias: {
        '@': resolve('src/main'),
        '@shared': resolve('src/shared')
      }
    },
    plugins: [externalizeDepsPlugin()]
  },
  preload: {
    resolve: {
      alias: {
        '@': resolve('src/preload/src'),
        '@shared': resolve('src/shared')
      }
    },
    plugins: [externalizeDepsPlugin()],
    build: {
      rollupOptions: {
        input: {
          unifiedPreload: resolve(__dirname, 'src/preload/unifiedPreload.ts')
        }
      }
    }
  },
  renderer: {
    resolve: {
      alias: {
        '@': resolve('src/renderer/src'),
        '@renderer': resolve('src/renderer/src'),
        '@preload': resolve('src/preload/src'),
        '@shared': resolve('src/shared')
      }
    },
    plugins: [vue()],
    build: {
      rollupOptions: {
        input: {
          main: resolve(__dirname, 'src/renderer/index.html'),
          widget: resolve(__dirname, 'src/renderer/widget.html'),
          assistant: resolve(__dirname, 'src/renderer/assistant.html'),
          chatbox: resolve(__dirname, 'src/renderer/chatbox.html'),
          assistantTips: resolve(__dirname, 'src/renderer/assistantTips.html'),
          assistantSettings: resolve(__dirname, 'src/renderer/assistantSettings.html')
        }
      }
    }
  }
})
