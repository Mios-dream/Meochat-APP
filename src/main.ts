// import './assets/main.css'

import { createApp } from 'vue'
import { createPinia } from 'pinia'
import ElementPlus from 'element-plus'
import 'element-plus/dist/index.css'
import '@/assets/tailwindcss.css'
import '@/assets/fonts/font.css' // 字体CSS文件路径
import App from './App.vue'
import router from './router'
import { library } from '@fortawesome/fontawesome-svg-core'
import { fas } from '@fortawesome/free-solid-svg-icons'
import { far } from '@fortawesome/free-regular-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome'

// 添加所有solid图标到库中
library.add(fas)
library.add(far)

const app = createApp(App)
app.use(ElementPlus)

app.use(createPinia())
app.use(router)

// 注册全局组件
app.component('font-awesome-icon', FontAwesomeIcon)
app.mount('#app')
