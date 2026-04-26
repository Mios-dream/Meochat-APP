<!-- HomeView.vue -->
<template>
  <div class="background-container">
    <div class="dashboard-content">
      <div class="page-top-container">
        <h1 class="page-title">主页</h1>
        <p class="page-title-description">{{ companionDaysText }}</p>
      </div>
      <div class="perf-card-container">
        <div class="perf-card-title">性能模式</div>
        <div class="perf-card-wrapper">
          <!-- 修改性能模式卡片的点击事件 -->
          <div
            v-for="mode in performanceModes"
            :key="mode.id"
            class="perf-card"
            :class="{ active: currentGlobalMode === mode.id }"
            :style="{
              '--theme-color': mode.color,
              '--theme-bg': mode.lightColor
            }"
            @click="setGlobalMode(mode.id)"
          >
            <div class="perf-icon-box">
              <font-awesome-icon :icon="mode.icon" class="perf-icon" />
            </div>

            <div class="perf-content">
              <div class="perf-title">{{ mode.title }}</div>
              <div class="perf-desc">{{ mode.desc }}</div>
            </div>

            <div class="active-indicator"></div>
          </div>
        </div>
      </div>
      <div class="main-container">
        <div class="task-list-container">
          <div class="task-list-title">正在运行的任务</div>
          <div class="task-card-container">
            <TaskCard
              v-for="task in tasks"
              :key="task.id"
              :task="task"
              :is-selected="selectedTaskId === task.id"
              @select="selectTask"
              @start="startTask"
              @stop="stopTask"
              @restart="restartTask"
              @contextmenu.prevent="showContextMenu($event, task)"
            />
            <div class="add-task-card-container" @click="openAddTaskDialog">
              <font-awesome-icon icon="fa-solid fa-plus" class="add-task-card-button" />
              <div class="add-task-card-button-text">Add Task</div>
            </div>
          </div>
        </div>
        <div class="task-info-sidebar-container">
          <div v-if="selectedTask" class="task-info-content">
            <div class="task-info-title">
              <div :class="['state', { active: tasksStatus.get(selectedTaskId!)?.running }]"></div>
              <div class="task-card-title">{{ selectedTask.name }}</div>
            </div>

            <div class="task-info-section">
              <div class="task-info-item">
                <font-awesome-icon icon="fa-solid fa-code" class="task-info-icon" />
                <div class="task-info-item-content">
                  <div class="task-info-label">Virtual Env</div>
                  <div class="task-info-value">{{ selectedTask.venvPython }}</div>
                </div>
              </div>
              <div class="task-info-item">
                <font-awesome-icon icon="fa-solid fa-folder" class="task-info-icon" />
                <div class="task-info-item-content">
                  <div class="task-info-label">Working Directory</div>
                  <div class="task-info-value">{{ selectedTask.workDir }}</div>
                </div>
              </div>
            </div>
            <div class="task-info-section">
              <div class="task-info-item">
                <font-awesome-icon icon="fa-solid fa-gear" class="task-info-icon" />
                <div class="task-info-item-content">
                  <div class="task-info-label">Auto Start</div>
                  <div class="task-info-item-setting">
                    <span class="task-info-value">开机启动</span>
                    <div class="task-card-auto-start">
                      <label class="switch">
                        <input
                          :checked="autoStart"
                          type="checkbox"
                          @click="updateAutoStart(selectedTaskId!, !autoStart)"
                        />
                        <span class="slider"></span>
                      </label>
                    </div>
                  </div>
                </div>
              </div>
              <div class="task-info-item">
                <font-awesome-icon icon="fa-solid fa-box-open" class="task-info-icon" />
                <div class="task-info-item-content">
                  <div class="task-info-label">Dependency Sync</div>
                  <div class="task-info-item-setting">
                    <span class="task-info-value">启动前自动更新依赖</span>
                    <div class="task-card-auto-start">
                      <label class="switch">
                        <input
                          :checked="autoSyncDependencies"
                          type="checkbox"
                          @click="
                            updateAutoSyncDependencies(selectedTaskId!, !autoSyncDependencies)
                          "
                        />
                        <span class="slider"></span>
                      </label>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <div class="task-info-section">
              <div class="terminal-container">
                <div class="terminal-header">
                  <div class="terminal-buttons">
                    <font-awesome-icon
                      icon="fa-solid fa-terminal"
                      class="terminal-button"
                    ></font-awesome-icon>
                    <div class="terminal-title">Task Logs</div>
                  </div>
                  <div class="terminal-right">
                    <div
                      v-if="tasksStatus.get(selectedTaskId!)?.updatingDependencies"
                      class="sync-indicator"
                    >
                      <span class="sync-dot"></span>
                      <span>{{
                        tasksStatus.get(selectedTaskId!)?.dependencyStatus || '正在同步依赖'
                      }}</span>
                    </div>
                    <div
                      :class="['state', { active: tasksStatus.get(selectedTaskId!)?.running }]"
                    ></div>
                  </div>
                </div>
                <div ref="terminalBodyRef" class="terminal-body">
                  <div
                    v-for="(line, index) in selectedTaskStatus?.logs || []"
                    :key="index"
                    class="log-line"
                  >
                    <!-- <span class="log-time">{{ line.time }}</span> -->
                    <span class="log-content">{{ line }}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div v-else class="no-task-selected">
            <p>请选择一个任务查看详细信息</p>
          </div>
        </div>
      </div>
      <ContextMenu
        :visible="contextMenuVisible"
        :style="contextMenuStyle"
        :items="contextMenuItems"
      />
      <!-- 添加任务对话框 -->
      <AddTaskDialog v-model="isAddTaskDialogVisible" />
      <!-- 编辑任务对话框 -->
      <EditTaskDialog v-model="isEditTaskDialogVisible" :task="editingTask" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import TaskCard from '../components/TaskCard.vue'
import TaskManager from '../services/TaskManager'
import AddTaskDialog from '../components/AddTaskDialog.vue'
import EditTaskDialog from '../components/EditTaskDialog.vue'
import { PythonTask } from '../types/PythonService'
import type { OnboardingState } from '../types/onboarding'
import ContextMenu from '../components/Toolbar.vue'
import throttle from '../utils/Throttle'

// 获取任务管理器实例
const taskManager = TaskManager.getInstance()

// 使用任务管理器的状态
const tasks = taskManager.tasks
const tasksStatus = taskManager.tasksStatus
const selectedTaskId = taskManager.selectedTaskId
const selectedTask = taskManager.selectedTask
const selectedTaskStatus = taskManager.selectedTaskStatus
const terminalBodyRef = ref<HTMLElement | null>(null)
const companionDays = ref(1)

const companionDaysText = computed(() => {
  return `你好，阁下！今天是我陪伴阁下的第${companionDays.value}天！`
})

const calcCompanionDays = (completedAt: number): number => {
  if (!Number.isFinite(completedAt) || completedAt <= 0) {
    return 1
  }

  const startDate = new Date(completedAt)
  const now = new Date()
  const startDay = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate())
  const nowDay = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const dayMs = 24 * 60 * 60 * 1000
  const diffDays = Math.floor((nowDay.getTime() - startDay.getTime()) / dayMs)

  return Math.max(1, diffDays + 1)
}

const loadCompanionDays = async (): Promise<void> => {
  try {
    const onboardingState = (await window.api.onboarding.getState()) as OnboardingState
    companionDays.value = calcCompanionDays(onboardingState.completedAt)
  } catch (error) {
    console.error('加载陪伴天数失败:', error)
    companionDays.value = 1
  }
}

const autoStart = computed(() => {
  return selectedTask.value?.autoStart || false
})
const autoSyncDependencies = computed(() => {
  return selectedTask.value?.autoSyncDependencies ?? true
})

// 添加任务对话框的可见性状态
const isAddTaskDialogVisible = ref(false)
// 编辑任务对话框的可见性状态
const isEditTaskDialogVisible = ref(false)
const editingTask = ref<PythonTask | null>(null)

// 确认对话框相关状态
const contextMenuVisible = ref(false)
const contextMenuStyle = ref({ top: '0px', left: '0px' })
const contextMenuTask = ref<PythonTask | null>(null)

const currentGlobalMode = ref('balanced')
const performanceModes: GlobalPerfMode[] = [
  {
    id: 'high',
    title: '高性能',
    desc: '对服务无任何限制，将持续占用性能',
    icon: 'fa-solid fa-rocket',
    color: '#fb7299',
    lightColor: 'rgba(244, 63, 94, 0.1)'
  },
  {
    id: 'balanced',
    title: '均衡',
    desc: '助手将自动智能调度',
    icon: 'fa-solid fa-scale-balanced',
    color: '#3b82f6',
    lightColor: 'rgba(59, 130, 246, 0.1)'
  },
  {
    id: 'low',
    title: '节能',
    desc: '低功耗运行，禁用部分功能，保持安静',
    icon: 'fa-solid fa-leaf',
    color: '#10b981',
    lightColor: 'rgba(16, 185, 129, 0.1)'
  }
]
// 性能模式相关状态
interface GlobalPerfMode {
  id: 'high' | 'balanced' | 'low'
  title: string
  desc: string
  icon: string
  color: string
  lightColor: string
}

// 加载当前性能模式
const loadCurrentMode = async (): Promise<void> => {
  const result = await window.api.getPerformanceMode()
  if (result.success) {
    currentGlobalMode.value = result.data
  } else {
    console.error('加载当前性能模式失败:', result.error)
  }
}

// 创建节流函数实例
const throttledSetPerformanceMode = throttle(async (modeId: 'high' | 'balanced' | 'low') => {
  console.log('设置性能模式:', modeId)
  await window.api.setPerformanceMode(modeId)
}, 3000)

// 设置性能模式
const setGlobalMode = async (modeId: 'high' | 'balanced' | 'low'): Promise<void> => {
  currentGlobalMode.value = modeId
  throttledSetPerformanceMode(modeId)
}

// 计算属性
const contextMenuItems = computed(() => [
  {
    icon: 'fa-solid fa-edit',
    text: '编辑',
    action: () => {
      if (contextMenuTask.value) {
        openEditDialog(contextMenuTask.value)
        hideContextMenu()
      }
    }
  },
  {
    icon: 'fa-solid fa-trash',
    text: '删除',
    action: () => {
      if (contextMenuTask.value) {
        taskManager.removeTask(contextMenuTask.value.id)
        hideContextMenu()
      }
    }
  }
])

// 显示右键菜单
function showContextMenu(event: MouseEvent, task: PythonTask): void {
  contextMenuStyle.value = {
    top: `${event.clientY}px`,
    left: `${event.clientX}px`
  }
  contextMenuTask.value = task
  contextMenuVisible.value = true
}

// 隐藏右键菜单
function hideContextMenu(): void {
  contextMenuVisible.value = false
  contextMenuTask.value = null
}

// 监听点击事件，点击其他地方关闭右键菜单
function handleClickOutside(event: MouseEvent): void {
  if (!contextMenuVisible.value) return
  const target = event.target as HTMLElement
  if (!target.closest('.context-menu') && !target.closest('.task-card')) {
    hideContextMenu()
  }
}

// 选择任务的方法
const selectTask = (taskId: number): void => {
  taskManager.selectTask(taskId)
}

// 任务操作方法
const startTask = (taskId: number): void => {
  taskManager.startTask(taskId)
}

const stopTask = (taskId: number): void => {
  taskManager.stopTask(taskId)
}

const restartTask = (taskId: number): void => {
  taskManager.restartTask(taskId)
}

// 添加任务的方法
function openAddTaskDialog(): void {
  isAddTaskDialogVisible.value = true
}

// 新增编辑任务的方法
function openEditDialog(task: PythonTask): void {
  editingTask.value = task
  isEditTaskDialogVisible.value = true
}

function updateAutoStart(taskId: number, autoStart: boolean): void {
  taskManager.updateAutoStart(taskId, autoStart)
}

function updateAutoSyncDependencies(taskId: number, autoSyncDependencies: boolean): void {
  taskManager.updateTask(taskId, { autoSyncDependencies })
}

function scrollLogsToBottom(): void {
  const terminalBody = terminalBodyRef.value
  if (!terminalBody) return
  terminalBody.scrollTop = terminalBody.scrollHeight
}

watch([selectedTaskId, () => selectedTaskStatus.value?.logs?.length ?? 0], async () => {
  await nextTick()
  scrollLogsToBottom()
})

onMounted(() => {
  document.addEventListener('click', handleClickOutside)
  loadCurrentMode()
  loadCompanionDays()
  nextTick(() => {
    scrollLogsToBottom()
  })
})

// 组件卸载时清理
onUnmounted(() => {
  document.removeEventListener('click', handleClickOutside)
})
</script>

<style scoped>
.page-top-container {
  margin-bottom: 20px;
}

.main-container {
  height: auto;
  width: 100%;
  padding: 20px;
  background-color: #fdfefe;
  border-radius: 10px;
  display: flex;
}

.task-list-container {
  height: 100%;
  width: 80%;
}

.task-list-title {
  font-size: 16px;
  font-weight: bold;
  color: #334155;
  margin-top: 10px;
  margin-left: 20px;
}

/* 任务卡片容器 - 网格布局 */
.task-card-container {
  flex: 1;
  display: grid;
  margin-top: 10px;
  padding: 30px 20px 20px 20px;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  overflow-y: auto;
  gap: 10px;
}

.add-task-card-container {
  display: flex;
  align-items: center;
  justify-content: center;
  flex-direction: column;
  position: relative;
  height: 270px;
  border-radius: 20px;
  padding: 20px 30px;
  transition: all 0.3s ease;
  border: 2px dashed #94a3b8;
  cursor: pointer;
  z-index: 1;
  margin-top: -30px;
  margin-left: 10px;
  margin-right: 10px;
  color: #94a3b8;
}

.add-task-card-container:hover {
  border: 2px dashed #fca5b9;
  color: #fca5b9;
}

.add-task-card-button {
  padding: 12px 10px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  background-color: #efefef;
  font-size: 20px;
}

/* 任务信息侧边栏 */
.task-info-sidebar-container {
  width: 450px;
  min-width: 450px;
  flex-shrink: 0;
  background-color: #f8fafc;
  padding: 20px;
  border-radius: 10px;
  border: 1px solid #e5e7eb;
  margin-right: 10px;
}
.task-info-content {
  margin-bottom: -25px;
}

.task-info-title {
  display: flex;
  flex-direction: row;
  align-items: center;
  justify-content: flex-start;
  margin-bottom: 20px;
}

.task-card-title {
  padding-left: 10px;
  font-size: 20px;
  color: #333;
  font-weight: bold;
}

.task-info-section {
  margin-bottom: 25px;
}

.task-info-item {
  display: flex;
  margin-bottom: 10px;
  font-size: 17px;
  align-items: center;
  color: #94a3b8;
  border-radius: 10px;
  padding-left: 10px;
}

.task-info-item:hover {
  background-color: white;
}

.task-info-item-content {
  width: 100%;
  height: 50px;
  display: flex;
  flex-direction: column;
  margin-left: 10px;
}

.task-info-item-setting {
  height: 50px;
  display: flex;
  flex-direction: row;
  align-items: center;
  justify-content: center;
}

.task-info-label {
  font-weight: bold;
  color: #94a3b8;
  font-size: 14px;
}

.task-info-value {
  flex: 1;
  color: #333;
  word-break: break-all;
  font-size: 12px;
}

.no-task-selected {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
  color: #999;
  font-size: 1.1em;
}

/* 终端样式日志容器 */
.terminal-container {
  background-color: #0f172a;
  border-radius: 8px;
  overflow: hidden;
  box-shadow: 0 5px 15px rgba(0, 0, 0, 0.2);
}

.terminal-header {
  background-color: #1e293b;
  padding: 8px 12px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  border-bottom: 1px solid #3e3e42;
}

.terminal-right {
  display: flex;
  align-items: center;
  gap: 8px;
}

.sync-indicator {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 11px;
  color: #fda4af;
  padding: 4px 9px;
  border-radius: 999px;
  background: rgba(251, 113, 133, 0.18);
  border: 1px solid rgba(251, 113, 133, 0.35);
}

.sync-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: #fb7185;
  box-shadow: 0 0 8px rgba(251, 113, 133, 0.9);
  animation: pulse-sync 1.1s ease-in-out infinite;
}

@keyframes pulse-sync {
  0%,
  100% {
    opacity: 0.7;
    transform: scale(1);
  }
  50% {
    opacity: 1;
    transform: scale(1.15);
  }
}

.terminal-buttons {
  display: flex;
  gap: 8px;
  align-items: center;
}

.terminal-title {
  color: white;
  font-size: 12px;
}

.terminal-button {
  font-size: 14px;
  color: var(--theme-color);
}

.terminal-body {
  padding: 12px;
  height: 300px;
  overflow-y: auto;
  scrollbar-width: none;
  /* font-family: 'LoliFont'; */
}

.log-line {
  color: #d4d4d4;
  font-size: 12px;
  margin-bottom: 4px;
  line-height: 1.4;
}

.log-content {
  color: #bac4d1;
}

/* 响应式设计 */
@media (max-width: 1024px) {
  .task-card-container {
    grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
    grid-gap: -5px 20px;
  }

  .task-info-sidebar-container {
    width: 350px;
  }
}

@media (max-width: 768px) {
  .main-container {
    flex-direction: column;
  }

  .task-card-container {
    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
    grid-gap: 10px;
    height: 50%;
  }

  .task-info-sidebar-container {
    width: 100%;
    height: 50%;
    border-left: none;
    border-top: 1px solid #e5e7eb;
  }
}

@media (max-width: 480px) {
  .dashboard-content {
    padding: 10px;
  }

  .task-card-container {
    padding: 10px;
    grid-template-columns: 1fr;
  }
}

.state {
  height: 10px;
  width: 10px;
  background-color: rgba(128, 128, 128, 0.4);
  border-radius: 50%;
  margin-right: 5px;
  transition: all 0.3s ease;
  box-shadow: none;
}

.state.active {
  height: 10px;
  width: 10px;
  background-color: rgb(74 222 128);
  border-radius: 50%;
  margin-right: 5px;
  animation: blink 3s infinite;
}

@keyframes blink {
  0% {
    box-shadow: none;
  }
  50% {
    box-shadow: 0 0px 7px #34d399;
  }
  100% {
    box-shadow: none;
  }
}

/* 添加开机启动开关样式 */
.task-card-auto-start {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  margin-right: 10px;
}

.switch {
  position: relative;
  display: inline-block;
  width: 40px;
  height: 20px;
}

.switch input {
  opacity: 0;
  width: 0;
  height: 0;
}

.slider {
  position: absolute;
  cursor: pointer;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: #ccc;
  transition: 0.4s;
  border-radius: 20px;
}

.slider:before {
  position: absolute;
  content: '';
  height: 16px;
  width: 16px;
  left: 2px;
  bottom: 2px;
  background-color: white;
  transition: 0.4s;
  border-radius: 50%;
}

input:checked + .slider {
  background-color: var(--theme-color-light);
}

input:checked:hover + .slider {
  box-shadow: 0 0 5px var(--theme-color-light);
}

input:checked + .slider:before {
  transform: translateX(20px);
}

.perf-card-container {
  margin-bottom: 20px;
  background-color: white;
  padding: 30px;
  border-radius: 10px;
}
.perf-card-title {
  font-size: 16px;
  font-weight: bold;
  color: #334155;
  margin-bottom: 20px;
}

/* --- 性能卡片容器 (Grid布局) --- */
.perf-card-wrapper {
  display: grid;
  grid-template-columns: repeat(3, 1fr); /* 三等分 */
  gap: 20px;
  width: 100%;
}

/* --- 单个卡片样式 --- */
.perf-card {
  position: relative;
  background-color: #fff;
  border-radius: 12px; /* 圆角略大，更现代 */
  padding: 15px 20px;
  display: flex;
  align-items: center;
  cursor: pointer;
  transition: all 0.3s cubic-bezier(0.25, 0.8, 0.25, 1);
  border: 1px solid transparent; /* 预留边框位置，防止跳动 */
  box-shadow:
    0 4px 6px rgba(0, 0, 0, 0.02),
    0 1px 3px rgba(0, 0, 0, 0.05); /* 极简阴影 */
  overflow: hidden;
}

/* 悬停效果 */
.perf-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 10px 15px rgba(0, 0, 0, 0.05);
}

/* --- 选中状态 (核心设计) --- */
.perf-card.active {
  border-color: var(--theme-color); /* 边框变色 */
  background-color: var(--theme-bg); /* 背景变淡色 */
  box-shadow: 0 8px 20px rgba(0, 0, 0, 0.08);
}

/* 图标容器 */
.perf-icon-box {
  width: 48px;
  height: 48px;
  border-radius: 50%;
  background-color: #f1f5f9;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-right: 15px;
  transition: all 0.3s ease;
  flex-shrink: 0; /* 防止挤压 */
  transition: all 0.3s ease-in-out;
  border: 1px solid transparent;
}

.perf-icon {
  font-size: 20px;
  color: #94a3b8;
  transition: all 0.3s ease;
}

/* 选中时图标的变化 */
.perf-card.active .perf-icon-box {
  /* background-color: #fff; */
  /* box-shadow: 0 2px 5px rgba(0, 0, 0, 0.1); */
  transform: rotate(15deg);
  /* border: 1px solid var(--theme-color); */
  background-color: var(--theme-color);
}

.perf-card.active .perf-icon {
  /* color: var(--theme-color); */
  color: #fff;
  transform: scale(1.1);
}

/* 文字区域 */
.perf-content {
  display: flex;
  flex-direction: column;
}

.perf-title {
  font-size: 16px;
  font-weight: bold;
  color: #334155;
  margin-bottom: 4px;
}

.perf-desc {
  font-size: 12px;
  color: #94a3b8;
  font-weight: 500;
}

/* 选中时文字颜色加深 */
.perf-card.active .perf-title {
  color: var(--theme-color);
}
.perf-card.active .perf-desc {
  color: #475569; /* 稍微深一点的灰色 */
}

/* 选中时的右上角装饰（可选，增加层次感） */
.active-indicator {
  position: absolute;
  top: -10px;
  right: -10px;
  width: 40px;
  height: 40px;
  border-radius: 50%;
  background: var(--theme-color);
  opacity: 0.15;
  filter: blur(10px);
  display: none;
}

.perf-card.active .active-indicator {
  display: block;
}

/* --- 响应式适配 --- */
@media (max-width: 768px) {
  .perf-card-wrapper {
    grid-template-columns: 1fr; /* 手机端变为单列 */
    gap: 10px;
  }

  .perf-card {
    padding: 12px 15px;
  }
}
</style>
