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
import { library } from '@fortawesome/fontawesome-svg-core'
import { fas } from '@fortawesome/free-solid-svg-icons'
import { far } from '@fortawesome/free-regular-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome'
import { useConfigStore } from './stores/useConfigStore'

// 添加图标
library.add(fas)
library.add(far)

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
