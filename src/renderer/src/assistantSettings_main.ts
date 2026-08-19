/**
 * 桌宠助手悬浮设置窗口入口文件
 * 独立窗口，用于显示桌宠模式的快捷设置面板
 */
// 最先引入日志服务：重写 console 并安装全局错误监听，确保后续业务日志可被捕获
import './services/LogService'
import { createApp } from 'vue'
import { createPinia } from 'pinia'
import './assets/base.css'
import './assets/fonts/font.css'
import App from './App.vue'
import { createRouter, createWebHashHistory } from 'vue-router'
import AssistantSettingsView from './views/AssistantSettingsView.vue'
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome'
import { registerIcons } from './utils/icons'
import { useConfigStore } from './stores/useConfigStore'

registerIcons()

const router = createRouter({
  history: createWebHashHistory('/'),
  routes: [
    {
      path: '/',
      name: 'assistantSettings',
      component: AssistantSettingsView
    }
  ]
})

const app = createApp(App)
app.use(createPinia())
app.use(router)

const configStore = useConfigStore()
await configStore.loadConfig()
configStore.listenForChanges()

app.component('FontAwesomeIcon', FontAwesomeIcon)
app.mount('#app')
