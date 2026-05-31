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

// 添加图标
library.add(fas)
library.add(far)

// 从 URL 查询参数中获取 widgetId 和 instanceId
const urlParams = new URLSearchParams(window.location.search)
const widgetId = urlParams.get('widgetId') || ''
const instanceId = urlParams.get('instanceId') || ''

// 将参数存储到 window 对象，供 WidgetView 使用
window.__WIDGET_PARAMS__ = { widgetId, instanceId }

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
app.component('FontAwesomeIcon', FontAwesomeIcon)
app.mount('#app')
