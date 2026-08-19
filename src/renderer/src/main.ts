// 最先引入日志服务：重写 console 并安装全局错误监听，确保后续业务日志可被捕获
import './services/LogService'
import { createApp } from 'vue'
import { createPinia } from 'pinia'
import './assets/base.css'
import './assets/fonts/font.css' // 字体CSS文件路径
import App from './App.vue'
import router from './router'
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome'
import { registerIcons } from './utils/icons'
import { useConfigStore } from './stores/useConfigStore'

// 仅注册实际使用的 82 个图标
registerIcons()

const app = createApp(App)
// 添加Pinia
app.use(createPinia())
// 添加路由
app.use(router)

const configStore = useConfigStore()
await configStore.loadConfig()
configStore.listenForChanges()

// 根据onboarding状态决定初始路由
// 第一次启动：显示 OnboardingView（完整的引导流程）
// 非第一次启动：走默认路由 / → /startup（等待后端服务启动后进入主界面）
const onboardingState = await window.api.onboarding.getState()
if (!onboardingState.completed) {
  await router.replace('/onboarding')
}
// 注册全局组件
app.component('FontAwesomeIcon', FontAwesomeIcon)
app.mount('#app')
