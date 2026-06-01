<template>
  <div class="widget-view" :class="{ 'is-transparent': isTransparent }">
    <!-- 小组件内容区域 -->
    <div class="widget-wrapper" @mouseenter="showControls" @mouseleave="hideControls">
      <!-- 拖拽区域 -->
      <div class="drag-region" />

      <!-- 小组件内容 -->
      <div class="widget-content">
        <div v-if="currentWidget" class="widget-inner">
          <component :is="currentWidget" :instance-id="instanceId" :config="instanceConfig" />
        </div>
        <div v-else class="widget-not-found">
          <font-awesome-icon icon="fa-solid fa-exclamation-triangle" />
          <span>小组件未找到 ({{ widgetId }})</span>
        </div>
      </div>

      <!-- 控制按钮 -->
      <Transition name="fade">
        <div v-show="showControlsFlag" class="widget-controls">
          <button class="control-btn" :title="isPinned ? '取消置顶' : '置顶'" @click="togglePin">
            <font-awesome-icon icon="fa-solid fa-thumbtack" :class="{ active: isPinned }" />
          </button>
          <button class="control-btn close-btn" title="关闭" @click="closeWidget">
            <font-awesome-icon icon="fa-solid fa-xmark" />
          </button>
        </div>
      </Transition>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, markRaw } from 'vue'
import { WidgetManager } from '../services/widgetManager'

// 导入内置小组件
import ClockWidget from '../components/widgets/builtin/ClockWidget.vue'
import DailyQuoteWidget from '../components/widgets/builtin/DailyQuoteWidget.vue'
import WeatherWidget from '../components/widgets/builtin/WeatherWidget.vue'
import TodoWidget from '../components/widgets/builtin/TodoWidget.vue'
import NoteWidget from '../components/widgets/builtin/NoteWidget.vue'

const widgetManager = WidgetManager.getInstance()

// 小组件映射
const widgetComponents: Record<string, unknown> = {
  clock: markRaw(ClockWidget),
  'daily-quote': markRaw(DailyQuoteWidget),
  weather: markRaw(WeatherWidget),
  todo: markRaw(TodoWidget),
  note: markRaw(NoteWidget)
}

// 状态
const instanceId = ref('')
const widgetId = ref('')
const instanceConfig = ref<Record<string, unknown>>({})
const isPinned = ref(false)
const isTransparent = ref(true)
const showControlsFlag = ref(false)

let hideControlsTimer: ReturnType<typeof setTimeout> | null = null

// 计算属性
const currentWidget = computed(() => {
  const widget = widgetComponents[widgetId.value] || null
  console.log('Current widget:', {
    widgetId: widgetId.value,
    found: !!widget,
    components: Object.keys(widgetComponents)
  })
  return widget
})

// 显示控制按钮
function showControls(): void {
  if (hideControlsTimer) {
    clearTimeout(hideControlsTimer)
    hideControlsTimer = null
  }
  showControlsFlag.value = true
}

// 隐藏控制按钮
function hideControls(): void {
  hideControlsTimer = setTimeout(() => {
    showControlsFlag.value = false
  }, 300)
}

// 切换置顶
async function togglePin(): Promise<void> {
  isPinned.value = !isPinned.value
  await window.widgetApi.togglePin(instanceId.value, isPinned.value)
}

// 关闭小组件
async function closeWidget(): Promise<void> {
  await window.widgetApi.closeWindow(instanceId.value)
}

// 监听实例数据
let removeInstanceDataListener: (() => void) | null = null

onMounted(() => {
  // 直接从 URL 查询参数获取，无需中间存储
  const urlParams = new URLSearchParams(window.location.search)
  widgetId.value = urlParams.get('widgetId') || ''
  instanceId.value = urlParams.get('instanceId') || ''

  console.log('WidgetView mounted:', { widgetId: widgetId.value, instanceId: instanceId.value })

  // 注册小组件
  widgetManager.registerWidgets([
    {
      id: 'clock',
      name: '时钟/日历',
      icon: 'fa-solid fa-clock',
      description: '显示当前时间和日期',
      version: '1.0.0',
      component: ClockWidget,
      defaultSize: { width: 300, height: 200 }
    },
    {
      id: 'daily-quote',
      name: '每日一句',
      icon: 'fa-solid fa-quote-left',
      description: '每日名言诗句',
      version: '1.0.0',
      component: DailyQuoteWidget,
      defaultSize: { width: 350, height: 180 }
    },
    {
      id: 'weather',
      name: '天气',
      icon: 'fa-solid fa-cloud-sun',
      description: '显示天气信息',
      version: '1.0.0',
      component: WeatherWidget,
      defaultSize: { width: 320, height: 250 }
    },
    {
      id: 'todo',
      name: '待办事项',
      icon: 'fa-solid fa-list-check',
      description: '管理待办事项',
      version: '1.0.0',
      component: TodoWidget,
      defaultSize: { width: 300, height: 400 }
    },
    {
      id: 'note',
      name: '便签',
      icon: 'fa-solid fa-sticky-note',
      description: '快速记录便签',
      version: '1.0.0',
      component: NoteWidget,
      defaultSize: { width: 300, height: 350 }
    }
  ])

  // 监听实例数据
  removeInstanceDataListener = window.widgetApi.onInstanceData((data) => {
    instanceConfig.value = data.config || {}
    isPinned.value = data.pinned || false
  })
})

onUnmounted(() => {
  if (removeInstanceDataListener) {
    removeInstanceDataListener()
  }
  if (hideControlsTimer) {
    clearTimeout(hideControlsTimer)
  }
})
</script>

<style scoped>
.widget-view {
  width: 100vw;
  height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: transparent;
  overflow: hidden;
}

.widget-view.is-transparent {
  background: transparent;
}

.widget-wrapper {
  position: relative;
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
}

.drag-region {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 40px;
  -webkit-app-region: drag;
  app-region: drag;
  z-index: 10;
}

.widget-content {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(255, 255, 255, 0.95);
  border-radius: 16px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.1);
  overflow: hidden;
  padding: 16px;
}

.widget-inner {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
}

.widget-not-found {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  color: #999;
  font-size: 14px;
}

.widget-not-found svg {
  font-size: 32px;
  color: var(--theme-color-light);
}

.widget-controls {
  position: absolute;
  top: 8px;
  right: 8px;
  display: flex;
  gap: 6px;
  z-index: 20;
  -webkit-app-region: no-drag;
  app-region: no-drag;
}

.control-btn {
  width: 28px;
  height: 28px;
  border: none;
  border-radius: 8px;
  background: rgba(0, 0, 0, 0.1);
  color: #666;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  transition: all 0.2s ease;
  backdrop-filter: blur(10px);
}

.control-btn:hover {
  background: rgba(0, 0, 0, 0.2);
  color: #333;
}

.control-btn svg.active {
  color: var(--theme-color);
}

.close-btn:hover {
  background: rgba(255, 0, 0, 0.3);
  color: white;
}

/* 过渡动画 */
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
