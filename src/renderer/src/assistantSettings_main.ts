/**
 * 桌宠助手悬浮设置窗口入口文件
 * 独立窗口，用于显示桌宠模式的快捷设置面板
 */
import { createApp } from 'vue'
import { createPinia } from 'pinia'
import './assets/base.css'
import './assets/fonts/font.css'
import App from './App.vue'
import { createRouter, createWebHashHistory } from 'vue-router'
import AssistantSettingsView from './views/AssistantSettingsView.vue'
import { library } from '@fortawesome/fontawesome-svg-core'
import { fas } from '@fortawesome/free-solid-svg-icons'
import { far } from '@fortawesome/free-regular-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome'
import { useConfigStore } from './stores/useConfigStore'

library.add(fas)
library.add(far)

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
