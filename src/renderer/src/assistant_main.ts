/**
 * 助手窗口入口文件
 * 独立于主窗口，只加载助手必要的功能
 */

import { createApp } from 'vue'
import { createPinia } from 'pinia'
import './assets/base.css'
import './assets/fonts/font.css'
import App from './App.vue'
import { createRouter, createWebHashHistory } from 'vue-router'
import AssistantView from './views/AssistantView.vue'
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome'
import { registerIcons } from './utils/icons'
import { useConfigStore } from './stores/useConfigStore'

// 仅注册实际使用的 82 个图标，替换全量加载的 library.add(fas + far)
registerIcons()

// 创建助手专用路由（只包含 AssistantView）
const router = createRouter({
  history: createWebHashHistory('/'),
  routes: [
    {
      path: '/',
      name: 'assistant',
      component: AssistantView
    }
  ]
})

const app = createApp(App)
app.use(createPinia())
app.use(router)

// 加载配置并监听变化，确保助手窗口能实时响应配置更新
const configStore = useConfigStore()
await configStore.loadConfig()
configStore.listenForChanges()

app.component('FontAwesomeIcon', FontAwesomeIcon)
app.mount('#app')
