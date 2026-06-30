<template>
  <div class="background-container">
    <div class="dashboard-content">
      <!-- 页面标题 -->
      <header class="page-header">
        <!-- 标题旁装饰星星 -->
        <svg class="deco-star deco-star-title" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path
            d="M12 2l2.4 7.2H22l-6 4.4 2.3 7.2L12 16.4l-6.3 4.4 2.3-7.2-6-4.4h7.6z"
            fill="var(--accent-lavender)"
            stroke="var(--accent-lavender)"
            stroke-width="1"
            stroke-linejoin="round"
          />
        </svg>
        <h1 class="page-title">✨ 魔法工坊 ✨</h1>
        <p class="page-title-description">管理你的桌面小组件和插件</p>
      </header>

      <!-- Tab 切换栏 -->
      <nav class="tab-bar">
        <button
          type="button"
          class="tab-item"
          :class="{ active: activeTab === 'widgets' }"
          @click="activeTab = 'widgets'"
        >
          <font-awesome-icon icon="fa-solid fa-puzzle-piece" />
          <span>小组件</span>
        </button>
        <button
          type="button"
          class="tab-item"
          :class="{ active: activeTab === 'plugins' }"
          @click="activeTab = 'plugins'"
        >
          <font-awesome-icon icon="fa-solid fa-plug" />
          <span>插件</span>
        </button>
      </nav>

      <!-- 小组件页面 - 双栏卡片布局 -->
      <section v-if="activeTab === 'widgets'" class="widgets-layout">
        <!-- 左侧：已添加组件管理 -->
        <div class="card manager-card">
          <!-- 右上角樱花装饰 -->
          <svg class="deco-sakura deco-sakura-tr" viewBox="0 0 60 60" aria-hidden="true">
            <g opacity="0.3">
              <ellipse
                cx="30"
                cy="12"
                rx="5"
                ry="10"
                fill="var(--theme-color-shadow)"
                transform="rotate(0 30 30)"
              />
              <ellipse
                cx="30"
                cy="12"
                rx="5"
                ry="10"
                fill="var(--theme-color-shadow)"
                transform="rotate(72 30 30)"
              />
              <ellipse
                cx="30"
                cy="12"
                rx="5"
                ry="10"
                fill="var(--theme-color-shadow)"
                transform="rotate(144 30 30)"
              />
              <ellipse
                cx="30"
                cy="12"
                rx="5"
                ry="10"
                fill="var(--theme-color-shadow)"
                transform="rotate(216 30 30)"
              />
              <ellipse
                cx="30"
                cy="12"
                rx="5"
                ry="10"
                fill="var(--theme-color-shadow)"
                transform="rotate(288 30 30)"
              />
              <circle cx="30" cy="30" r="4" fill="var(--theme-color-light)" />
            </g>
          </svg>

          <div class="card-header">
            <h2 class="card-title">
              <svg class="deco-diamond" viewBox="0 0 12 12" aria-hidden="true">
                <path d="M6 1L11 6L6 11L1 6Z" fill="var(--accent-lavender)" />
              </svg>
              已添加组件
            </h2>
            <span class="card-count">{{ enabledInstances.length }}</span>
          </div>

          <!-- 已添加实例列表 -->
          <div v-if="enabledInstances.length > 0" class="instances-list">
            <div v-for="instance in enabledInstances" :key="instance.id" class="instance-row">
              <div class="instance-info">
                <div class="instance-icon-wrap">
                  <font-awesome-icon :icon="getWidgetIcon(instance.widgetId)" />
                </div>
                <div class="instance-text">
                  <span class="instance-name">{{ getWidgetName(instance.widgetId) }}</span>
                  <span class="instance-id">{{ instance.id }}</span>
                </div>
              </div>
              <div class="instance-actions">
                <button
                  title="固定"
                  class="action-btn"
                  :class="{ active: instance.pinned }"
                  @click="toggleInstancePinned(instance.id, instance.pinned!)"
                >
                  <font-awesome-icon icon="fa-solid fa-thumbtack" />
                </button>
                <button
                  title="删除"
                  class="action-btn action-btn-danger"
                  @click="deleteInstance(instance.id)"
                >
                  <font-awesome-icon icon="fa-solid fa-trash" />
                </button>
              </div>
            </div>
          </div>

          <!-- 空状态 -->
          <div v-else class="empty-manager">
            <svg class="empty-illustration" viewBox="0 0 120 100" aria-hidden="true">
              <!-- 简笔画小盒子 -->
              <rect
                x="35"
                y="35"
                width="50"
                height="40"
                rx="4"
                fill="none"
                stroke="var(--border-color)"
                stroke-width="2"
                stroke-dasharray="4 3"
              />
              <path
                d="M30 35 L60 18 L90 35"
                fill="none"
                stroke="var(--border-color)"
                stroke-width="2"
                stroke-dasharray="4 3"
              />
              <!-- 盒子上的蝴蝶结 -->
              <path
                d="M55 28 Q50 22 45 28 Q50 30 55 28Z"
                fill="var(--theme-color-light)"
                stroke="none"
              />
              <path
                d="M65 28 Q70 22 75 28 Q70 30 65 28Z"
                fill="var(--theme-color-light)"
                stroke="none"
              />
              <circle cx="60" cy="28" r="2.5" fill="var(--theme-color)" />
              <!-- 小星星 -->
              <circle cx="25" cy="25" r="2" fill="var(--accent-lavender)" opacity="0.6" />
              <circle cx="95" cy="20" r="1.5" fill="var(--accent-mint)" opacity="0.6" />
              <circle cx="100" cy="60" r="2" fill="var(--theme-color-shadow)" opacity="0.5" />
            </svg>
            <p class="empty-title">还没有添加组件</p>
            <p class="empty-hint">从右侧选择喜欢的组件添加吧~</p>
          </div>
        </div>

        <!-- 右侧：组件预览 -->
        <div class="card preview-card">
          <!-- 左下角星星装饰 -->
          <svg class="deco-star deco-star-bl" viewBox="0 0 24 24" aria-hidden="true">
            <path
              d="M12 2l2.4 7.2H22l-6 4.4 2.3 7.2L12 16.4l-6.3 4.4 2.3-7.2-6-4.4h7.6z"
              fill="var(--theme-color-shadow)"
              stroke="var(--theme-color-light)"
              stroke-width="0.5"
              stroke-linejoin="round"
            />
          </svg>

          <div class="card-header">
            <h2 class="card-title">
              <svg class="deco-diamond" viewBox="0 0 12 12" aria-hidden="true">
                <path d="M6 1L11 6L6 11L1 6Z" fill="var(--accent-peach)" />
              </svg>
              组件预览
            </h2>
            <span class="card-count">{{ registeredWidgets.length }}</span>
          </div>

          <!-- 组件预览网格 -->
          <div class="widgets-grid">
            <WidgetPreview
              v-for="widget in registeredWidgets"
              :key="widget.id"
              :name="widget.name"
              :description="widget.description"
              :icon="widget.icon"
              :enabled="isWidgetEnabled(widget.id)"
              @add="addWidgetInstance(widget.id)"
            >
              <div
                :ref="getWidgetPreviewFrameSetter(widget.id)"
                class="widget-mini-preview-frame"
                :style="getWidgetPreviewStyle(widget)"
              >
                <div class="widget-mini-preview">
                  <component :is="widget.component" :preview-mode="true" />
                </div>
              </div>
            </WidgetPreview>
          </div>
        </div>
      </section>

      <!-- 插件页面 -->
      <section v-if="activeTab === 'plugins'" class="plugin-section">
        <div class="card plugin-card">
          <!-- 右上角樱花装饰 -->
          <svg class="deco-sakura deco-sakura-tr" viewBox="0 0 60 60" aria-hidden="true">
            <g opacity="0.25">
              <ellipse
                cx="30"
                cy="12"
                rx="5"
                ry="10"
                fill="var(--theme-color-shadow)"
                transform="rotate(0 30 30)"
              />
              <ellipse
                cx="30"
                cy="12"
                rx="5"
                ry="10"
                fill="var(--theme-color-shadow)"
                transform="rotate(72 30 30)"
              />
              <ellipse
                cx="30"
                cy="12"
                rx="5"
                ry="10"
                fill="var(--theme-color-shadow)"
                transform="rotate(144 30 30)"
              />
              <ellipse
                cx="30"
                cy="12"
                rx="5"
                ry="10"
                fill="var(--theme-color-shadow)"
                transform="rotate(216 30 30)"
              />
              <ellipse
                cx="30"
                cy="12"
                rx="5"
                ry="10"
                fill="var(--theme-color-shadow)"
                transform="rotate(288 30 30)"
              />
              <circle cx="30" cy="30" r="4" fill="var(--theme-color-light)" />
            </g>
          </svg>

          <div class="empty-plugin">
            <svg class="empty-illustration" viewBox="0 0 120 100" aria-hidden="true">
              <!-- 简笔画插头 -->
              <rect
                x="42"
                y="40"
                width="36"
                height="30"
                rx="4"
                fill="none"
                stroke="var(--border-color)"
                stroke-width="2"
              />
              <line
                x1="52"
                y1="30"
                x2="52"
                y2="40"
                stroke="var(--border-color)"
                stroke-width="2.5"
                stroke-linecap="round"
              />
              <line
                x1="68"
                y1="30"
                x2="68"
                y2="40"
                stroke="var(--border-color)"
                stroke-width="2.5"
                stroke-linecap="round"
              />
              <path
                d="M48 70 Q48 82 60 82 Q72 82 72 70"
                fill="none"
                stroke="var(--border-color)"
                stroke-width="2"
              />
              <!-- 小星星 -->
              <circle cx="30" cy="35" r="2" fill="var(--accent-lavender)" opacity="0.5" />
              <circle cx="92" cy="30" r="1.5" fill="var(--accent-mint)" opacity="0.5" />
              <circle cx="28" cy="65" r="1.8" fill="var(--theme-color-shadow)" opacity="0.4" />
              <circle cx="95" cy="70" r="2" fill="var(--accent-peach)" opacity="0.4" />
            </svg>
            <p class="empty-title">暂无可用插件</p>
            <p class="empty-hint">插件市场即将开放，敬请期待~</p>
          </div>
        </div>
      </section>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount, markRaw, reactive } from 'vue'
import { useWidgetStore } from '../stores/useWidgetStore'
import { WidgetManager } from '../services/widgetManager'
import WidgetPreview from '../components/widgets/WidgetPreview.vue'
import type { WidgetManifest } from '../types/widget'
import type { ComponentPublicInstance } from 'vue'

// 内置小组件
import ClockWidget from '../components/widgets/builtin/ClockWidget.vue'
import DailyQuoteWidget from '../components/widgets/builtin/DailyQuoteWidget.vue'
import WeatherWidget from '../components/widgets/builtin/WeatherWidget.vue'
import TodoWidget from '../components/widgets/builtin/TodoWidget.vue'
import NoteWidget from '../components/widgets/builtin/NoteWidget.vue'

// 当前选中的 tab
const activeTab = ref<'widgets' | 'plugins'>('widgets')

const widgetStore = useWidgetStore()
const widgetManager = WidgetManager.getInstance()
const widgetPreviewScales = reactive<Record<string, number>>({})
const widgetPreviewFrames = new Map<string, HTMLElement>()
const widgetPreviewFrameIds = new WeakMap<HTMLElement, string>()
const widgetPreviewFrameSetters = new Map<
  string,
  (element: Element | ComponentPublicInstance | null) => void
>()
const widgetPreviewGap = 14
let widgetPreviewResizeObserver: ResizeObserver | null = null

// 注册内置小组件清单
const registeredWidgets = ref<WidgetManifest[]>([
  {
    id: 'clock',
    name: '时钟/日历',
    icon: 'fa-solid fa-clock',
    description: '显示当前时间和日期，支持12/24小时制切换',
    version: '1.0.0',
    component: markRaw(ClockWidget),
    defaultSize: { width: 300, height: 200 }
  },
  {
    id: 'daily-quote',
    name: '每日一句',
    icon: 'fa-solid fa-quote-left',
    description: '每日名言诗句，激励每一天',
    version: '1.0.0',
    component: markRaw(DailyQuoteWidget),
    defaultSize: { width: 300, height: 250 }
  },
  {
    id: 'weather',
    name: '天气',
    icon: 'fa-solid fa-cloud-sun',
    description: '显示当前天气和温度信息',
    version: '1.0.0',
    component: markRaw(WeatherWidget),
    defaultSize: { width: 300, height: 100 }
  },
  {
    id: 'todo',
    name: '澪的任务板',
    icon: 'fa-solid fa-list-check',
    description: '澪为你精心设计的任务清单',
    version: '1.0.0',
    component: markRaw(TodoWidget),
    defaultSize: { width: 300, height: 400 }
  },
  {
    id: 'note',
    name: '便签',
    icon: 'fa-solid fa-sticky-note',
    description: '快速记录文字便签',
    version: '1.0.0',
    component: markRaw(NoteWidget),
    defaultSize: { width: 300, height: 350 }
  }
])

// 已启用的实例列表
const enabledInstances = computed(() => widgetStore.enabledInstances)

/**
 * 检查小组件是否已有启用实例
 */
function isWidgetEnabled(widgetId: string): boolean {
  return widgetStore.instances.some((i) => i.widgetId === widgetId && i.enabled)
}

/**
 * 获取小组件图标
 */
function getWidgetIcon(widgetId: string): string | string[] {
  const widget = registeredWidgets.value.find((w) => w.id === widgetId)
  return widget?.icon || 'fa-solid fa-puzzle-piece'
}

/**
 * 获取小组件显示名称
 */
function getWidgetName(widgetId: string): string {
  const widget = registeredWidgets.value.find((w) => w.id === widgetId)
  return widget?.name || '未知小组件'
}

/**
 * 记录预览框元素，用于在尺寸变化时重新计算组件缩放比例。
 */
function setWidgetPreviewFrameRef(
  widgetId: string,
  element: Element | ComponentPublicInstance | null
): void {
  if (!widgetPreviewResizeObserver) {
    widgetPreviewResizeObserver = new ResizeObserver((entries) => {
      entries.forEach((entry) => {
        const resizedWidgetId = widgetPreviewFrameIds.get(entry.target as HTMLElement)

        if (resizedWidgetId) {
          updateWidgetPreviewScale(resizedWidgetId)
        }
      })
    })
  }

  const previousElement = widgetPreviewFrames.get(widgetId)

  if (previousElement) {
    widgetPreviewResizeObserver.unobserve(previousElement)
    widgetPreviewFrames.delete(widgetId)
  }

  if (!(element instanceof HTMLElement)) {
    return
  }

  widgetPreviewFrames.set(widgetId, element)
  widgetPreviewFrameIds.set(element, widgetId)
  widgetPreviewResizeObserver.observe(element)
  updateWidgetPreviewScale(widgetId)
}

/**
 * 获取稳定的 ref setter，避免每次渲染创建新函数。
 */
function getWidgetPreviewFrameSetter(
  widgetId: string
): (element: Element | ComponentPublicInstance | null) => void {
  const cached = widgetPreviewFrameSetters.get(widgetId)

  if (cached) {
    return cached
  }

  const setter = (element: Element | ComponentPublicInstance | null): void => {
    setWidgetPreviewFrameRef(widgetId, element)
  }

  widgetPreviewFrameSetters.set(widgetId, setter)
  return setter
}

/**
 * 按预览框可用空间等比缩放组件，保留边距且不放大超过原始尺寸。
 */
function updateWidgetPreviewScale(widgetId: string): void {
  const widget = registeredWidgets.value.find((w) => w.id === widgetId)
  const frame = widgetPreviewFrames.get(widgetId)

  if (!widget || !frame) return

  const width = Math.max(widget.defaultSize?.width ?? 300, 1)
  const height = Math.max(widget.defaultSize?.height ?? 200, 1)
  const availableWidth = Math.max(frame.clientWidth - widgetPreviewGap * 2, 1)
  const availableHeight = Math.max(frame.clientHeight - widgetPreviewGap * 2, 1)
  const scale = Math.min(availableWidth / width, availableHeight / height, 1)
  const normalizedScale = Number(scale.toFixed(4))

  if (widgetPreviewScales[widgetId] === normalizedScale) return

  widgetPreviewScales[widgetId] = normalizedScale
}

/**
 * 根据组件清单尺寸生成预览用 CSS 变量。
 */
function getWidgetPreviewStyle(widget: WidgetManifest): Record<string, string> {
  const width = Math.max(widget.defaultSize?.width ?? 300, 1)
  const height = Math.max(widget.defaultSize?.height ?? 200, 1)

  return {
    '--widget-preview-width': `${width}px`,
    '--widget-preview-height': `${height}px`,
    '--widget-preview-scale': `${widgetPreviewScales[widget.id] ?? 1}`
  }
}

/**
 * 添加小组件实例并创建窗口
 */
async function addWidgetInstance(widgetId: string): Promise<void> {
  const widget = registeredWidgets.value.find((w) => w.id === widgetId)
  if (!widget) return

  const instance = widgetManager.createInstance(widgetId, {
    enabled: true,
    position: { x: 100 + Math.random() * 200, y: 100 + Math.random() * 200 }
  })

  if (instance) {
    await widgetStore.addInstance(instance)
    await widgetStore.createWindow(instance.id)
  }
}

/**
 * 切换实例置顶状态
 */
async function toggleInstancePinned(instanceId: string, pinned: boolean): Promise<void> {
  await widgetStore.togglePinned(instanceId, !pinned)
}

/**
 * 删除小组件实例
 */
async function deleteInstance(instanceId: string): Promise<void> {
  await widgetStore.deleteInstance(instanceId)
}

// 初始化
onMounted(async () => {
  widgetManager.registerWidgets(registeredWidgets.value)
  await widgetStore.loadConfig()
  widgetStore.listenForChanges()
})

onBeforeUnmount(() => {
  widgetPreviewResizeObserver?.disconnect()
  widgetPreviewResizeObserver = null
  widgetPreviewFrames.clear()
})
</script>

<style scoped>
/* ========================================
   辅助色变量
   ======================================== */
.card {
  --accent-lavender: #b8a9d4;
  --accent-mint: #a8d8b9;
  --accent-peach: #f5c6aa;
  --border-color: #f0d6df;
  --card-bg: rgba(255, 255, 255, 0.72);
  --row-bg: rgba(251, 114, 153, 0.06);
  --row-hover-bg: rgba(251, 114, 153, 0.12);
}

/* ========================================
   容器 - 撑满到 Tab 栏上方
   ======================================== */
.background-container {
  height: 100vh;
}

.dashboard-content {
  height: 100%;
  display: flex;
  flex-direction: column;
}

/* ========================================
   页面标题
   ======================================== */
.page-header {
  position: relative;
  text-align: center;
  margin-bottom: 16px;
  flex-shrink: 0;
}

.page-title {
  background: #fb7299d3;
  background-clip: text;
  -webkit-text-fill-color: transparent;
  margin-top: 0;
  margin-bottom: 8px;
  text-shadow: 0 2px 15px var(--theme-color-shadow);
  font-weight: 900;
  letter-spacing: 2px;
}

.page-title-description {
  font-family: 'KaTongFont';
  font-size: 14px;
  color: #9e8e9a;
  margin: 0;
  letter-spacing: 1px;
}

/* 标题旁装饰星星 */
.deco-star-title {
  position: absolute;
  top: -4px;
  left: calc(50% - 120px);
  width: 18px;
  height: 18px;
  animation: twinkle 3s ease-in-out infinite;
}

/* ========================================
   Tab 切换栏
   ======================================== */
.tab-bar {
  display: flex;
  justify-content: center;
  gap: 6px;
  margin-bottom: 16px;
  padding: 4px;
  background: var(--card-bg);
  border: 1px solid var(--border-color);
  border-radius: 50px;
  width: fit-content;
  margin-left: auto;
  margin-right: auto;
  flex-shrink: 0;
}

.tab-item {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 7px 20px;
  border: none;
  border-radius: 50px;
  cursor: pointer;
  font-size: 13px;
  font-weight: 500;
  color: #8e7f8a;
  background: transparent;
  transition: all 0.2s ease;
  user-select: none;
}

.tab-item:hover {
  color: var(--theme-color);
}

.tab-item.active {
  background: var(--theme-color);
  color: #fff;
  box-shadow: 0 2px 8px rgba(251, 114, 153, 0.3);
}

.tab-item svg {
  font-size: 13px;
}

/* ========================================
   双栏卡片布局
   ======================================== */
.widgets-layout {
  display: grid;
  grid-template-columns: 340px 1fr;
  gap: 20px;
  align-items: stretch;
  flex: 1;
  min-height: 0;
}

/* ========================================
   通用卡片样式
   ======================================== */
.card {
  position: relative;
  background: var(--card-bg);
  border: 1px solid var(--border-color);
  border-radius: 16px;
  padding: 20px;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 16px;
}

.card-title {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 0;
  font-size: 15px;
  font-weight: 600;
  color: #5a4e56;
  font-family: 'SanJiFangYuanFont';
}

.card-count {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 24px;
  height: 24px;
  padding: 0 6px;
  background: var(--row-bg);
  border-radius: 20px;
  font-size: 12px;
  font-weight: 600;
  color: var(--theme-color);
}

/* 标题旁菱形装饰 */
.deco-diamond {
  width: 10px;
  height: 10px;
  flex-shrink: 0;
}

/* ========================================
   装饰元素
   ======================================== */

/* 樱花装饰 */
.deco-sakura {
  position: absolute;
  width: 50px;
  height: 50px;
  pointer-events: none;
  z-index: 0;
}

.deco-sakura-tr {
  top: -8px;
  right: -8px;
}

/* 星星装饰 */
.deco-star {
  pointer-events: none;
  z-index: 0;
}

.deco-star-bl {
  position: absolute;
  bottom: 10px;
  left: 10px;
  width: 20px;
  height: 20px;
  animation: twinkle 4s ease-in-out infinite 1s;
}

/* 星星闪烁动画 */
@keyframes twinkle {
  0%,
  100% {
    opacity: 0.5;
    transform: scale(1) rotate(0deg);
  }
  50% {
    opacity: 0.9;
    transform: scale(1.1) rotate(8deg);
  }
}

/* ========================================
   左侧 - 已添加组件管理
   ======================================== */

.instances-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  scrollbar-width: none;
}

.instance-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 12px;
  background: var(--row-bg);
  border-radius: 12px;
  transition: background 0.2s ease;
}

.instance-row:hover {
  background: var(--row-hover-bg);
}

.instance-info {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
  flex: 1;
}

.instance-icon-wrap {
  width: 34px;
  height: 34px;
  border-radius: 10px;
  background: #fff;
  border: 1px solid var(--border-color);
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--theme-color);
  font-size: 14px;
  flex-shrink: 0;
}

.instance-text {
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.instance-name {
  font-size: 13px;
  font-weight: 600;
  color: #5a4e56;
  line-height: 1.3;
}

.instance-id {
  font-size: 11px;
  color: #b0a3ac;
  font-family: monospace;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.instance-actions {
  display: flex;
  gap: 6px;
  flex-shrink: 0;
  margin-left: 8px;
}

/* 操作按钮 */
.action-btn {
  width: 30px;
  height: 30px;
  border: none;
  border-radius: 8px;
  background: #fff;
  border: 1px solid var(--border-color);
  color: #b0a3ac;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  transition: all 0.2s ease;
}

.action-btn:hover {
  color: var(--theme-color);
  border-color: var(--theme-color-light);
  background: rgba(251, 114, 153, 0.06);
}

.action-btn.active {
  color: #fff;
  background: var(--theme-color);
  border-color: var(--theme-color);
}

.action-btn-danger:hover {
  color: #e8596b;
  border-color: #f0a0aa;
  background: rgba(232, 89, 107, 0.06);
}

/* 管理区空状态 */
.empty-manager {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 30px 10px;
  text-align: center;
  flex: 1;
  min-height: 0;
}

.empty-illustration {
  width: 100px;
  height: 80px;
  margin-bottom: 14px;
  opacity: 0.7;
}

.empty-title {
  font-size: 14px;
  font-weight: 600;
  color: #7a6e76;
  margin: 0 0 4px;
}

.empty-hint {
  font-size: 12px;
  color: #b0a3ac;
  margin: 0;
}

/* ========================================
   右侧 - 组件预览
   ======================================== */
.widgets-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  grid-auto-rows: max-content;
  gap: 16px;
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  scrollbar-width: none;
  align-content: start;
}

.widget-mini-preview-frame {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
}

.widget-mini-preview {
  flex: 0 0 auto;
  width: var(--widget-preview-width);
  height: var(--widget-preview-height);
  box-sizing: border-box;
  display: flex;
  align-items: stretch;
  justify-content: stretch;
  transform: scale(var(--widget-preview-scale));
  transform-origin: center center;
  pointer-events: none;
  user-select: none;
  cursor: default;
}

.widget-mini-preview :deep(*) {
  box-sizing: border-box;
}

.widget-mini-preview > :deep(*) {
  width: 100%;
  height: 100%;
  min-width: 0;
  min-height: 0;
}

/* ========================================
   插件页面
   ======================================== */
.plugin-section {
  margin: 0 auto;
  flex: 1;
  min-height: 0;
  width: 100%;
  display: flex;
}

.plugin-card {
  min-height: 300px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex: 1;
}

.empty-plugin {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  padding: 20px;
}

/* ========================================
   响应式 - 小屏幕适配
   ======================================== */
@media (max-width: 768px) {
  .widgets-layout {
    grid-template-columns: 1fr;
  }

  .manager-card {
    position: static;
  }
}
</style>
