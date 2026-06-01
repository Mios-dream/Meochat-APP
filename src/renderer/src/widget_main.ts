/**
 * 小组件窗口入口文件
 * 独立于主窗口，只加载小组件必要的功能
 */

import { createApp } from 'vue'
import { createPinia } from 'pinia'
import './assets/base.css'
import './assets/fonts/font.css'
import App from './App.vue'
import { createRouter, createWebHashHistory } from 'vue-router'
import { library } from '@fortawesome/fontawesome-svg-core'
import { fas } from '@fortawesome/free-solid-svg-icons'
import { far } from '@fortawesome/free-regular-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome'
import WidgetView from './views/WidgetView.vue'
import { useConfigStore } from './stores/useConfigStore'

// 添加图标
library.add(fas)
library.add(far)

// 创建小组件专用路由（只包含 WidgetView）
const router = createRouter({
  history: createWebHashHistory('/'),
  routes: [
    {
      path: '/',
      name: 'widget',
      component: WidgetView
    }
  ]
})

const app = createApp(App)
app.use(createPinia())
app.use(router)
// 加载配置并监听变化，确保小组件能实时响应配置更新
const configStore = useConfigStore()
await configStore.loadConfig()
configStore.listenForChanges()

app.component('FontAwesomeIcon', FontAwesomeIcon)
app.mount('#app')
