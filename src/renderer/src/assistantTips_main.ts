/**
 * 提示窗口入口文件
 * 独立于主窗口，只加载提示窗口必要的功能
 */

// 最先引入日志服务：重写 console 并安装全局错误监听，确保后续业务日志可被捕获
import './services/LogService'
import { createApp } from 'vue'
import { createPinia } from 'pinia'
import './assets/base.css'
import './assets/fonts/font.css'
import App from './App.vue'
import { createRouter, createWebHashHistory } from 'vue-router'
import TipsView from './views/TipsView.vue'
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome'
import { registerIcons } from './utils/icons'

registerIcons()

// 创建提示窗口专用路由（只包含 TipsView）
const router = createRouter({
  history: createWebHashHistory('/'),
  routes: [
    {
      path: '/',
      name: 'tips',
      component: TipsView
    }
  ]
})

const app = createApp(App)
app.use(createPinia())
app.use(router)

app.component('FontAwesomeIcon', FontAwesomeIcon)
app.mount('#app')
