/**
 * 小组件窗口入口文件
 */

// 最先引入日志服务：重写 console 并安装全局错误监听，确保后续业务日志可被捕获
import './services/LogService'
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
  const widgetApi = createWidgetBridgeApi(instanceId)
  window.api = {
    widgetApi,
    // 日志代理：子窗口无完整 preload，日志经宿主网关转发到主进程 electron-log
    log: {
      debug: (message) => void widgetApi.log('debug', message),
      info: (message) => void widgetApi.log('info', message),
      warn: (message) => void widgetApi.log('warn', message),
      error: (message) => void widgetApi.log('error', message)
    }
  } as Window['api']
}

const app = createApp(WidgetView)
app.component('FontAwesomeIcon', FontAwesomeIcon)
app.mount('#app')
