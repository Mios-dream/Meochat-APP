/**
 * 小组件窗口入口文件
 */

import { createApp } from 'vue'
import './assets/base.css'
import './assets/fonts/font.css'
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome'
import { registerIcons } from './utils/icons'
import WidgetView from './views/WidgetView.vue'
import { createWidgetBridgeApi } from './services/widgetBridge'

registerIcons()

// 子窗口模式判定与代理安装：
// 仅当携带 widgetId/instanceId 且当前环境没有 preload 暴露的 window.api 时，
// 才安装桥接代理（宿主窗口已有真实 API，不可覆盖）。
const urlParams = new URLSearchParams(window.location.search)
const widgetId = urlParams.get('widgetId') || ''
const instanceId = urlParams.get('instanceId') || ''

if (widgetId && instanceId && !window.api) {
  window.api = {
    widgetApi: createWidgetBridgeApi(instanceId)
  } as Window['api']
}

const app = createApp(WidgetView)
app.component('FontAwesomeIcon', FontAwesomeIcon)
app.mount('#app')
