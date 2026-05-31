<template>
  <div
    class="widget-container"
    :class="{ dragging: isDragging, resizing: isResizing }"
    :style="containerStyle"
    @mousedown="handleMouseDown"
  >
    <!-- 小组件头部 -->
    <div class="widget-header" @mousedown="startDrag">
      <div class="widget-title">
        <font-awesome-icon :icon="widgetIcon" class="widget-icon" />
        <span>{{ widgetName }}</span>
      </div>
      <div class="widget-actions">
        <button class="action-btn pin-btn" :class="{ active: pinned }" @click.stop="togglePin" title="置顶">
          <font-awesome-icon :icon="pinned ? 'fa-solid fa-thumbtack' : 'fa-solid fa-thumbtack'" />
        </button>
        <button class="action-btn close-btn" @click.stop="handleClose" title="关闭">
          <font-awesome-icon icon="fa-solid fa-xmark" />
        </button>
      </div>
    </div>

    <!-- 小组件内容 -->
    <div class="widget-content">
      <slot />
    </div>

    <!-- 调整大小手柄 -->
    <div class="resize-handle" @mousedown.stop="startResize" />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'

interface Props {
  instanceId: string
  widgetName: string
  widgetIcon: string | string[]
  initialX?: number
  initialY?: number
  initialWidth?: number
  initialHeight?: number
  initialPinned?: boolean
  minWidth?: number
  minHeight?: number
}

interface Emits {
  (e: 'close'): void
  (e: 'pin', pinned: boolean): void
  (e: 'move', x: number, y: number): void
  (e: 'resize', width: number, height: number): void
}

const props = withDefaults(defineProps<Props>(), {
  initialX: 100,
  initialY: 100,
  initialWidth: 300,
  initialHeight: 200,
  initialPinned: false,
  minWidth: 150,
  minHeight: 100
})

const emit = defineEmits<Emits>()

// 状态
const x = ref(props.initialX)
const y = ref(props.initialY)
const width = ref(props.initialWidth)
const height = ref(props.initialHeight)
const pinned = ref(props.initialPinned)
const isDragging = ref(false)
const isResizing = ref(false)

// 拖拽相关
let dragStartX = 0
let dragStartY = 0
let dragStartLeft = 0
let dragStartTop = 0

// 调整大小相关
let resizeStartX = 0
let resizeStartY = 0
let resizeStartWidth = 0
let resizeStartHeight = 0

// 计算样式
const containerStyle = computed(() => ({
  left: `${x.value}px`,
  top: `${y.value}px`,
  width: `${width.value}px`,
  height: `${height.value}px`,
  zIndex: pinned.value ? 1000 : 100
}))

// 开始拖拽
function startDrag(event: MouseEvent): void {
  if (event.button !== 0) return
  isDragging.value = true
  dragStartX = event.clientX
  dragStartY = event.clientY
  dragStartLeft = x.value
  dragStartTop = y.value

  document.addEventListener('mousemove', handleDrag)
  document.addEventListener('mouseup', stopDrag)
}

// 处理拖拽
function handleDrag(event: MouseEvent): void {
  if (!isDragging.value) return

  const deltaX = event.clientX - dragStartX
  const deltaY = event.clientY - dragStartY

  x.value = dragStartLeft + deltaX
  y.value = dragStartTop + deltaY
}

// 停止拖拽
function stopDrag(): void {
  isDragging.value = false
  document.removeEventListener('mousemove', handleDrag)
  document.removeEventListener('mouseup', stopDrag)
  emit('move', x.value, y.value)
}

// 开始调整大小
function startResize(event: MouseEvent): void {
  if (event.button !== 0) return
  isResizing.value = true
  resizeStartX = event.clientX
  resizeStartY = event.clientY
  resizeStartWidth = width.value
  resizeStartHeight = height.value

  document.addEventListener('mousemove', handleResize)
  document.addEventListener('mouseup', stopResize)
}

// 处理调整大小
function handleResize(event: MouseEvent): void {
  if (!isResizing.value) return

  const deltaX = event.clientX - resizeStartX
  const deltaY = event.clientY - resizeStartY

  width.value = Math.max(props.minWidth, resizeStartWidth + deltaX)
  height.value = Math.max(props.minHeight, resizeStartHeight + deltaY)
}

// 停止调整大小
function stopResize(): void {
  isResizing.value = false
  document.removeEventListener('mousemove', handleResize)
  document.removeEventListener('mouseup', stopResize)
  emit('resize', width.value, height.value)
}

// 切换置顶
function togglePin(): void {
  pinned.value = !pinned.value
  emit('pin', pinned.value)
}

// 关闭
function handleClose(): void {
  emit('close')
}

// 处理鼠标按下事件
function handleMouseDown(): void {
  // 可以在这里处理焦点管理
}

// 清理事件监听器
onUnmounted(() => {
  document.removeEventListener('mousemove', handleDrag)
  document.removeEventListener('mouseup', stopDrag)
  document.removeEventListener('mousemove', handleResize)
  document.removeEventListener('mouseup', stopResize)
})

// 暴露方法供外部调用
defineExpose({
  setPosition: (newX: number, newY: number) => {
    x.value = newX
    y.value = newY
  },
  setSize: (newWidth: number, newHeight: number) => {
    width.value = newWidth
    height.value = newHeight
  },
  setPinned: (value: boolean) => {
    pinned.value = value
  },
  getPosition: () => ({ x: x.value, y: y.value }),
  getSize: () => ({ width: width.value, height: height.value })
})
</script>

<style scoped>
.widget-container {
  position: absolute;
  background: rgba(255, 255, 255, 0.95);
  border-radius: 16px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.1);
  overflow: hidden;
  display: flex;
  flex-direction: column;
  transition: box-shadow 0.2s ease;
}

.widget-container:hover {
  box-shadow: 0 6px 25px rgba(0, 0, 0, 0.15);
}

.widget-container.dragging {
  opacity: 0.9;
  cursor: grabbing;
}

.widget-container.resizing {
  opacity: 0.9;
}

.widget-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 10px 14px;
  background: linear-gradient(135deg, var(--theme-color-light), var(--theme-color));
  color: white;
  cursor: grab;
  user-select: none;
}

.widget-header:active {
  cursor: grabbing;
}

.widget-title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
  font-weight: 600;
}

.widget-icon {
  font-size: 16px;
}

.widget-actions {
  display: flex;
  gap: 6px;
}

.action-btn {
  width: 24px;
  height: 24px;
  border: none;
  border-radius: 6px;
  background: rgba(255, 255, 255, 0.2);
  color: white;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  transition: all 0.2s ease;
}

.action-btn:hover {
  background: rgba(255, 255, 255, 0.3);
}

.pin-btn.active {
  background: rgba(255, 255, 255, 0.4);
}

.close-btn:hover {
  background: rgba(255, 0, 0, 0.4);
}

.widget-content {
  flex: 1;
  padding: 14px;
  overflow: auto;
}

.resize-handle {
  position: absolute;
  bottom: 0;
  right: 0;
  width: 16px;
  height: 16px;
  cursor: nwse-resize;
  background: linear-gradient(135deg, transparent 50%, var(--theme-color-light) 50%);
  border-radius: 0 0 16px 0;
}
</style>
