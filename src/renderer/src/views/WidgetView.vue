<template>
  <div class="widget-view" :class="{ 'is-transparent': isTransparent }">
    <!-- 小组件内容区域：宿主模式（无 widgetId）下渲染为空 -->
    <div
      v-if="widgetId"
      class="widget-wrapper"
      @mouseenter="showControls"
      @mouseleave="hideControls"
    >
      <!-- 拖拽区域 -->
      <div class="drag-region" :class="{ 'drag-region--locked': isPinned }" />

      <!-- 小组件内容 -->
      <div class="widget-content">
        <component
          :is="currentWidget"
          v-if="currentWidget"
          :instance-id="instanceId"
          :config="instanceConfig"
        />

        <div v-else class="widget-not-found">
          <font-awesome-icon icon="fa-solid fa-exclamation-triangle" />
          <span>小组件未找到 ({{ widgetId }})</span>
        </div>
      </div>

      <!-- 控制按钮 -->
      <Transition name="fade">
        <div v-show="showControlsFlag" class="widget-controls">
          <button class="control-btn" :title="isPinned ? '取消固定' : '固定'" @click="togglePin">
            <font-awesome-icon icon="fa-solid fa-thumbtack" :class="{ active: isPinned }" />
          </button>
          <button class="control-btn close-btn" title="关闭" @click="deleteWidget">
            <font-awesome-icon icon="fa-solid fa-xmark" />
          </button>
        </div>
      </Transition>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { widgetRegistry } from '../services/widgetRegistry'

// 状态
const instanceId = ref('')
const widgetId = ref('')
const instanceConfig = ref<Record<string, unknown>>({})
const isPinned = ref(false)
const isTransparent = ref(true)
const showControlsFlag = ref(false)

let hideControlsTimer: ReturnType<typeof setTimeout> | null = null

// 计算属性：按 widgetId 从注册表解析组件（注册表为单一数据源，支持动态扩展）
const currentWidget = computed(() => {
  return widgetRegistry.get(widgetId.value)?.component ?? null
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
  await window.api.widgetApi.togglePin(instanceId.value, isPinned.value)
}

// 关闭小组件（删除实例并关闭窗口）
async function deleteWidget(): Promise<void> {
  await window.api.widgetApi.deleteInstance(instanceId.value)
}

// 监听实例数据
let removeInstanceDataListener: (() => void) | null = null

onMounted(() => {
  // 直接从 URL 查询参数获取，无需中间存储
  const urlParams = new URLSearchParams(window.location.search)
  widgetId.value = urlParams.get('widgetId') || ''
  instanceId.value = urlParams.get('instanceId') || ''

  console.log('WidgetView mounted:', { widgetId: widgetId.value, instanceId: instanceId.value })

  // 宿主模式：无 widgetId / instanceId（隐藏宿主窗口），仅作为 window.open 的 opener，
  // 不注册小组件、不监听任何实例数据，保持零业务开销
  if (!widgetId.value || !instanceId.value) return

  // 监听实例数据（子窗口模式下由 widgetBridge 垫片对接宿主网关提供）
  removeInstanceDataListener = window.api.widgetApi.onInstanceData((data) => {
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

.drag-region--locked {
  -webkit-app-region: no-drag;
  app-region: no-drag;
  pointer-events: none;
}

.widget-content {
  position: relative;
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
}

.widget-inner {
  width: 100vw;
  height: 100vh;
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
  background: var(--theme-color);
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
