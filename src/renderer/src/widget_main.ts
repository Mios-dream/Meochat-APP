/**
 * 小组件窗口入口文件
 * 精简版：移除 Pinia、vue-router、configStore 等小组件不需要的依赖。
 * 每个小组件实例是一个独立渲染进程，减负可降低约 30-50 MB 的 V8 堆开销。
 */

import { createApp } from 'vue'
import './assets/base.css'
import './assets/fonts/font.css'
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome'
import { registerIcons } from './utils/icons'
import WidgetView from './views/WidgetView.vue'

registerIcons()

const app = createApp(WidgetView)
app.component('FontAwesomeIcon', FontAwesomeIcon)
app.mount('#app')
