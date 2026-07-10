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
          mainPreload: resolve(__dirname, 'src/preload/mainPreload.ts'),
          assistantPreload: resolve(__dirname, 'src/preload/assistantPreload.ts'),
          sharePreload: resolve(__dirname, 'src/preload/sharePreload.ts'),
          widgetPreload: resolve(__dirname, 'src/preload/widgetPreload.ts'),
          chatBoxPreload: resolve(__dirname, 'src/preload/chatBoxPreload.ts'),
          tipsPreload: resolve(__dirname, 'src/preload/tipsPreload.ts'),
          assistantSettingsPreload: resolve(__dirname, 'src/preload/assistantSettingsPreload.ts')
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
