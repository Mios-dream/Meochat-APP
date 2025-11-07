import { createApp } from 'vue'
import { createPinia } from 'pinia'
import '@/assets/base.css'
import '@/assets/fonts/font.css' // 字体CSS文件路径
import App from './App.vue'
import router from './router'
import { library } from '@fortawesome/fontawesome-svg-core'
import { fas } from '@fortawesome/free-solid-svg-icons'
import { far } from '@fortawesome/free-regular-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome'
import { useConfigStore } from './stores/useConfigStore'

// 添加所有solid图标到库中
library.add(fas)
library.add(far)

const app = createApp(App)
// 添加Pinia
app.use(createPinia())
// 添加路由
app.use(router)

const configStore = useConfigStore()
await configStore.loadConfig()
configStore.listenForChanges()
// 注册全局组件
app.component('font-awesome-icon', FontAwesomeIcon)
app.mount('#app')
