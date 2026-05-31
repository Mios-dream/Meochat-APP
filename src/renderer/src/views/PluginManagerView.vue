<template>
  <div class="background-container">
    <div class="dashboard-content">
      <!-- 页面标题 -->
      <div class="page-header">
        <h1 class="page-title">✨ 魔法工坊 ✨</h1>
        <p class="page-title-description">管理你的桌面小组件和插件</p>
      </div>

      <!-- 桌面小组件区域 -->
      <section class="section">
        <div class="section-header">
          <h2 class="section-title">
            <font-awesome-icon icon="fa-solid fa-puzzle-piece" />
            <span>桌面小组件</span>
          </h2>
          <p class="section-description">小组件可以在桌面独立显示，支持拖拽和调整大小</p>
        </div>

        <div class="widgets-grid">
          <WidgetPreview
            v-for="widget in registeredWidgets"
            :key="widget.id"
            :name="widget.name"
            :description="widget.description"
            :icon="widget.icon"
            :enabled="isWidgetEnabled(widget.id)"
            @preview="previewWidget(widget)"
            @toggle-desktop="toggleWidgetDesktop(widget.id)"
            @add="addWidgetInstance(widget.id)"
          >
            <!-- 预览插槽 -->
            <div class="widget-mini-preview">
              <component :is="widget.component" :preview-mode="true" />
            </div>
          </WidgetPreview>
        </div>

        <!-- 已启用的小组件实例列表 -->
        <div v-if="enabledInstances.length > 0" class="instances-section">
          <h3 class="instances-title">已启用的小组件</h3>
          <div class="instances-list">
            <div v-for="instance in enabledInstances" :key="instance.id" class="instance-item">
              <div class="instance-info">
                <font-awesome-icon :icon="getWidgetIcon(instance.widgetId)" class="instance-icon" />
                <div class="instance-details">
                  <span class="instance-name">{{ getWidgetName(instance.widgetId) }}</span>
                  <span class="instance-id">{{ instance.id }}</span>
                </div>
              </div>
              <div class="instance-actions">
                <button
                  class="instance-btn"
                  :class="{ active: instance.pinned }"
                  @click="toggleInstancePinned(instance.id, instance.pinned!)"
                  title="置顶"
                >
                  <font-awesome-icon icon="fa-solid fa-thumbtack" />
                </button>
                <button
                  class="instance-btn"
                  @click="openInstanceWindow(instance.id)"
                  title="打开窗口"
                >
                  <font-awesome-icon icon="fa-solid fa-external-link-alt" />
                </button>
                <button
                  class="instance-btn disable-btn"
                  @click="disableInstance(instance.id)"
                  title="禁用"
                >
                  <font-awesome-icon icon="fa-solid fa-eye-slash" />
                </button>
                <button
                  class="instance-btn delete-btn"
                  @click="deleteInstance(instance.id)"
                  title="删除"
                >
                  <font-awesome-icon icon="fa-solid fa-trash" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, markRaw } from 'vue'
import { useWidgetStore } from '../stores/useWidgetStore'
import { WidgetManager } from '../services/widgetManager'
import WidgetPreview from '../components/widgets/WidgetPreview.vue'
import type { WidgetManifest } from '../types/widget'

// 导入内置小组件
import ClockWidget from '../components/widgets/builtin/ClockWidget.vue'
import DailyQuoteWidget from '../components/widgets/builtin/DailyQuoteWidget.vue'
import WeatherWidget from '../components/widgets/builtin/WeatherWidget.vue'
import TodoWidget from '../components/widgets/builtin/TodoWidget.vue'
import NoteWidget from '../components/widgets/builtin/NoteWidget.vue'

const widgetStore = useWidgetStore()
const widgetManager = WidgetManager.getInstance()

// 注册内置小组件
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
    defaultSize: { width: 350, height: 180 }
  },
  {
    id: 'weather',
    name: '天气',
    icon: 'fa-solid fa-cloud-sun',
    description: '显示当前天气和温度信息',
    version: '1.0.0',
    component: markRaw(WeatherWidget),
    defaultSize: { width: 320, height: 250 }
  },
  {
    id: 'todo',
    name: '待办事项',
    icon: 'fa-solid fa-list-check',
    description: '管理你的待办事项列表',
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

// 计算属性
const enabledInstances = computed(() => widgetStore.enabledInstances)

// 检查小组件是否已启用
function isWidgetEnabled(widgetId: string): boolean {
  return widgetStore.instances.some((i) => i.widgetId === widgetId && i.enabled)
}

// 获取小组件图标
function getWidgetIcon(widgetId: string): string | string[] {
  const widget = registeredWidgets.value.find((w) => w.id === widgetId)
  return widget?.icon || 'fa-solid fa-puzzle-piece'
}

// 获取小组件名称
function getWidgetName(widgetId: string): string {
  const widget = registeredWidgets.value.find((w) => w.id === widgetId)
  return widget?.name || '未知小组件'
}

// 预览小组件
function previewWidget(widget: WidgetManifest): void {
  // 可以打开一个预览窗口或显示预览模态框
  console.log('预览小组件:', widget.name)
}

// 切换小组件桌面显示
async function toggleWidgetDesktop(widgetId: string): Promise<void> {
  const existingInstance = widgetStore.instances.find((i) => i.widgetId === widgetId)
  if (existingInstance) {
    const newEnabled = !existingInstance.enabled
    await widgetStore.toggleEnabled(existingInstance.id, newEnabled)
    // 如果启用，创建窗口；如果禁用，关闭窗口
    if (newEnabled) {
      await widgetStore.createWindow(existingInstance.id)
    } else {
      await widgetStore.closeWindow(existingInstance.id)
    }
  } else {
    await addWidgetInstance(widgetId)
  }
}

// 添加小组件实例
async function addWidgetInstance(widgetId: string): Promise<void> {
  const widget = registeredWidgets.value.find((w) => w.id === widgetId)
  if (!widget) {
    console.error('小组件未找到:', widgetId)
    return
  }

  const instance = widgetManager.createInstance(widgetId, {
    enabled: true,
    position: { x: 100 + Math.random() * 200, y: 100 + Math.random() * 200 }
  })

  if (instance) {
    console.log('创建小组件实例:', instance)
    await widgetStore.addInstance(instance)
    // 创建独立窗口显示小组件
    console.log('创建小组件窗口:', instance.id)
    await widgetStore.createWindow(instance.id)
  }
}

// 切换实例置顶
async function toggleInstancePinned(instanceId: string, pinned: boolean): Promise<void> {
  await widgetStore.togglePinned(instanceId, !pinned)
}

// 打开实例窗口
async function openInstanceWindow(instanceId: string): Promise<void> {
  await widgetStore.createWindow(instanceId)
}

// 禁用实例
async function disableInstance(instanceId: string): Promise<void> {
  await widgetStore.toggleEnabled(instanceId, false)
}

// 删除实例
async function deleteInstance(instanceId: string): Promise<void> {
  await widgetStore.deleteInstance(instanceId)
}

// 初始化
onMounted(async () => {
  // 注册小组件到管理器
  widgetManager.registerWidgets(registeredWidgets.value)

  // 加载配置
  await widgetStore.loadConfig()

  // 监听配置变更
  widgetStore.listenForChanges()
})
</script>

<style scoped>
.page-header {
  text-align: center;
  margin-bottom: 30px;
}

.page-title {
  background: linear-gradient(45deg, var(--theme-color-dark), var(--theme-color-light));
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  margin-top: 0;
  margin-bottom: 8px;
  text-shadow: 0 2px 10px var(--theme-color-shadow);
  font-weight: 900;
  letter-spacing: 2px;
}

.page-title-description {
  color: var(--theme-text-color-dark);
  opacity: 0.7;
  letter-spacing: 1px;
  margin: 0;
}

.section {
  margin-bottom: 40px;
}

.section-header {
  margin-bottom: 20px;
}

.section-title {
  display: flex;
  align-items: center;
  gap: 10px;
  margin: 0 0 8px;
  font-size: 20px;
  font-weight: 700;
  color: var(--theme-text-color-dark);
}

.section-title svg {
  color: var(--theme-color);
}

.section-description {
  margin: 0;
  font-size: 14px;
  color: #999;
}

/* 小组件网格 */
.widgets-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 16px;
  margin-bottom: 24px;
}

.widget-mini-preview {
  transform: scale(0.6);
  transform-origin: center center;
  pointer-events: none;
  width: 150%;
  height: 150%;
  margin: -25%;
}

/* 已启用实例区域 */
.instances-section {
  margin-top: 24px;
  padding: 20px;
  background: rgba(255, 255, 255, 0.8);
  border-radius: 16px;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.05);
}

.instances-title {
  margin: 0 0 16px;
  font-size: 16px;
  font-weight: 600;
  color: var(--theme-text-color-dark);
}

.instances-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.instance-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  background: rgba(255, 255, 255, 0.9);
  border-radius: 12px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
  transition: all 0.2s ease;
}

.instance-item:hover {
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
}

.instance-info {
  display: flex;
  align-items: center;
  gap: 12px;
}

.instance-icon {
  width: 36px;
  height: 36px;
  border-radius: 10px;
  background: linear-gradient(135deg, var(--theme-color-light), var(--theme-color));
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
  font-size: 16px;
}

.instance-details {
  display: flex;
  flex-direction: column;
}

.instance-name {
  font-size: 14px;
  font-weight: 600;
  color: var(--theme-text-color-dark);
}

.instance-id {
  font-size: 11px;
  color: #999;
  font-family: monospace;
}

.instance-actions {
  display: flex;
  gap: 8px;
}

.instance-btn {
  width: 32px;
  height: 32px;
  border: none;
  border-radius: 8px;
  background: rgba(0, 0, 0, 0.05);
  color: #666;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 14px;
  transition: all 0.2s ease;
}

.instance-btn:hover {
  background: rgba(0, 0, 0, 0.1);
}

.instance-btn.active {
  background: var(--theme-color);
  color: white;
}

.instance-btn.disable-btn:hover {
  background: rgba(255, 165, 0, 0.2);
  color: #ffa500;
}

.instance-btn.delete-btn:hover {
  background: rgba(255, 0, 0, 0.2);
  color: #ff0000;
}
</style>
