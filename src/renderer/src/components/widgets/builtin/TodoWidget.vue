<template>
  <div class="mi-todo-widget">
    <!-- 左上角羽翼装饰 -->
    <svg class="deco-wing deco-wing-tl" viewBox="0 0 120 100" aria-hidden="true">
      <g opacity="0.12">
        <path
          d="M12 80 C8 70 6 58 8 46 C10 34 16 24 24 16 C32 8 44 4 52 6 C56 8 54 12 48 14 C42 16 34 24 28 34 C22 44 20 56 18 66 C18 72 16 78 12 80 Z"
          fill="var(--theme-color)"
        />
        <path
          d="M24 74 C22 62 24 50 28 38 C34 26 40 18 46 14 C50 12 48 16 44 18 C38 22 32 32 28 42 C24 52 22 62 24 74 C24 78 22 76 24 74 Z"
          fill="var(--theme-color-light)"
        />
        <path
          d="M20 76 C18 66 19 54 22 44 C26 32 31 24 36 18 C40 15 38 18 35 20 C30 25 25 36 22 46 C20 56 18 65 19 76 C18 78 20 76 20 76 Z"
          fill="var(--theme-color-shadow)"
        />
      </g>
    </svg>

    <!-- 右上角星芒装饰 -->
    <svg class="deco-star-group deco-star-tr" viewBox="0 0 80 60" aria-hidden="true">
      <g opacity="0.16">
        <path
          d="M10 10l2.4 4.8 5.2 0.8-3.8 3.6 0.9 5.2-4.7-2.5-4.7 2.5 0.9-5.2-3.8-3.6 5.2-0.8z"
          fill="var(--theme-color)"
          transform="translate(20,5) scale(0.6)"
        />
        <path
          d="M10 10l2.4 4.8 5.2 0.8-3.8 3.6 0.9 5.2-4.7-2.5-4.7 2.5 0.9-5.2-3.8-3.6 5.2-0.8z"
          fill="var(--theme-color-light)"
          transform="translate(52,18) scale(0.42)"
        />
        <path
          d="M10 10l2.4 4.8 5.2 0.8-3.8 3.6 0.9 5.2-4.7-2.5-4.7 2.5 0.9-5.2-3.8-3.6 5.2-0.8z"
          fill="var(--theme-color-shadow)"
          transform="translate(38,2) scale(0.34)"
        />
      </g>
    </svg>

    <!-- 标题栏 -->
    <div class="mi-todo-header">
      <div class="mi-todo-badge">
        <svg class="badge-star" viewBox="0 0 20 20" aria-hidden="true">
          <path
            d="M10 1l2 5.5H18l-4.8 3.6 1.8 5.5L10 12.5l-5 3.1 1.8-5.5L2 6.5h6z"
            fill="var(--theme-color)"
          />
        </svg>
        <span class="badge-text">澪的任务板</span>
      </div>
      <span class="mi-todo-subtitle">Mission Board</span>
    </div>

    <!-- 任务输入区 -->
    <div class="mi-todo-input-wrap">
      <input
        v-model="newTodoText"
        class="mi-todo-input"
        type="text"
        placeholder="写下阁下新的任务吧~"
        maxlength="120"
        @keyup.enter="addTodo"
      />
      <button
        class="mi-todo-add-btn"
        title="添加任务"
        :class="{ active: newTodoText.trim().length > 0 }"
        :disabled="!newTodoText.trim()"
        @click="addTodo"
      >
        <svg class="add-btn-svg" viewBox="0 0 20 20" aria-hidden="true">
          <path
            d="M10 2v16M2 10h16"
            stroke="currentColor"
            stroke-width="2.4"
            stroke-linecap="round"
            stroke-linejoin="round"
          />
        </svg>
      </button>
    </div>

    <!-- 统计概览 -->
    <!-- <div class="mi-todo-stats">
      <div class="stat-card">
        <span class="stat-number stat-total">{{ todos.length }}</span>
        <span class="stat-label">全部任务</span>
      </div>
      <div class="stat-divider"></div>
      <div class="stat-card">
        <span class="stat-number stat-done">{{ completedCount }}</span>
        <span class="stat-label">已完成</span>
      </div>
      <div class="stat-divider"></div>
      <div class="stat-card">
        <span class="stat-number stat-pending">{{ pendingCount }}</span>
        <span class="stat-label">待完成</span>
      </div>
    </div> -->

    <!-- 任务列表 -->
    <div v-if="sortedTodos.length > 0" class="mi-todo-list-wrap">
      <TransitionGroup name="mi-item" tag="div" class="mi-todo-list">
        <div
          v-for="(todo, index) in sortedTodos"
          :key="todo.id"
          class="mi-todo-item"
          :class="{ done: todo.completed }"
          :style="{ animationDelay: `${index * 0.04}s` }"
        >
          <!-- 勾选框 -->
          <button
            class="mi-checkbox"
            :class="{ checked: todo.completed }"
            :title="todo.completed ? '标记为未完成' : '标记为已完成'"
            @click="toggleTodo(todo.id)"
          >
            <svg v-if="todo.completed" class="check-mark" viewBox="0 0 20 20">
              <path
                d="M4 10.5L8 14.5L16 6"
                stroke="white"
                stroke-width="2.4"
                stroke-linecap="round"
                stroke-linejoin="round"
                fill="none"
              />
            </svg>
          </button>

          <!-- 任务文字 -->
          <span class="mi-todo-text" :class="{ 'line-through': todo.completed }">
            {{ todo.text }}
          </span>

          <!-- 删除按钮 -->
          <button class="mi-delete-btn" title="删除任务" @click="deleteTodo(todo.id)">
            <svg viewBox="0 0 18 18" class="delete-svg">
              <path
                d="M4 5h10M7 5V3.5A0.5 0.5 0 017.5 3h3a0.5 0.5 0 010.5 0.5V5M13 5v9.5a0.5 0.5 0 01-0.5 0.5h-7a0.5 0.5 0 01-0.5-0.5V5M3 5h12"
                stroke="currentColor"
                stroke-width="1.4"
                stroke-linecap="round"
                stroke-linejoin="round"
                fill="none"
              />
            </svg>
          </button>
        </div>
      </TransitionGroup>
    </div>

    <!-- 空状态 -->
    <div v-else class="mi-todo-empty">
      <div class="empty-illustration">
        <svg class="empty-check" viewBox="0 0 64 64" aria-hidden="true">
          <circle
            cx="32"
            cy="32"
            r="26"
            fill="none"
            stroke="var(--theme-color-shadow)"
            stroke-width="3"
            stroke-dasharray="8 4"
            opacity="0.6"
          />
          <circle cx="32" cy="32" r="18" fill="var(--theme-color-shadow)" opacity="0.14" />
          <path
            d="M20 32l8 8l16-16"
            stroke="var(--theme-color-light)"
            stroke-width="3.2"
            stroke-linecap="round"
            stroke-linejoin="round"
            fill="none"
            opacity="0.7"
          />
        </svg>
      </div>
      <p class="empty-title">暂无待办任务</p>
      <p class="empty-desc">阁下今天也很轻松呢~</p>
      <p class="empty-hint">澪随时待命，添加新任务开始吧 ✦</p>
    </div>

    <!-- 底部操作栏 -->
    <div v-if="completedCount > 0" class="mi-todo-footer">
      <button class="mi-clear-btn" @click="clearCompleted">
        <svg class="clear-icon" viewBox="0 0 16 16">
          <path
            d="M2 4h12M5.5 4V2.5A0.5 0.5 0 016 2h4a0.5 0.5 0 010.5 0.5V4M11 4v8.5a1 1 0 01-1 1H6a1 1 0 01-1-1V4"
            stroke="currentColor"
            stroke-width="1.3"
            stroke-linecap="round"
            stroke-linejoin="round"
            fill="none"
          />
        </svg>
        <span>清扫已完成任务 ({{ completedCount }})</span>
      </button>
    </div>

    <!-- 右下角Q版助手装饰 -->
    <div class="mi-todo-mascot" aria-hidden="true"></div>

    <!-- 樱花飘落装饰 -->
    <div class="sakura-petal sakura-p1" aria-hidden="true"></div>
    <div class="sakura-petal sakura-p2" aria-hidden="true"></div>
    <div class="sakura-petal sakura-p3" aria-hidden="true"></div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'

/**
 * 任务条目数据结构
 */
interface TodoItem {
  /** 唯一标识 */
  id: string
  /** 任务文本 */
  text: string
  /** 是否已完成 */
  completed: boolean
  /** 创建时间戳 */
  createdAt: number
}

const STORAGE_KEY = 'todos'

/** 组件对外触发的事件 */
interface Emits {
  (e: 'update:count', total: number, completed: number): void
}

const emit = defineEmits<Emits>()

/** 全部任务列表 */
const todos = ref<TodoItem[]>([])

/** 新任务输入文本 */
const newTodoText = ref('')

/** 已完成任务数 */
const completedCount = computed<number>(() => todos.value.filter((t) => t.completed).length)

// /** 待完成任务数 */
// const pendingCount = computed<number>(() => todos.value.filter((t) => !t.completed).length)

/**
 * 排序后的任务列表
 * 规则：未完成优先 → 按创建时间倒序排列
 */
const sortedTodos = computed<TodoItem[]>(() => {
  return [...todos.value].sort((a, b) => {
    if (a.completed !== b.completed) {
      return a.completed ? 1 : -1
    }
    return b.createdAt - a.createdAt
  })
})

/**
 * 生成唯一ID
 */
function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
}

/**
 * 从 localStorage 加载任务数据
 */
function loadTodos(): void {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored) {
      const parsed = JSON.parse(stored)
      if (Array.isArray(parsed)) {
        todos.value = parsed
      }
    }
  } catch (err) {
    console.error('[澪的任务板] 加载数据失败:', err)
    todos.value = []
  }
}

/**
 * 将任务数据存入 localStorage
 */
function saveTodos(): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(todos.value))
    emit('update:count', todos.value.length, completedCount.value)
  } catch (err) {
    console.error('[澪的任务板] 保存数据失败:', err)
  }
}

/**
 * 添加新任务
 */
function addTodo(): void {
  const text = newTodoText.value.trim()
  if (!text) return

  const todo: TodoItem = {
    id: generateId(),
    text,
    completed: false,
    createdAt: Date.now()
  }

  todos.value.push(todo)
  newTodoText.value = ''
  saveTodos()
}

/**
 * 切换任务完成状态
 * @param id - 目标任务ID
 */
function toggleTodo(id: string): void {
  const todo = todos.value.find((t) => t.id === id)
  if (todo) {
    todo.completed = !todo.completed
    saveTodos()
  }
}

/**
 * 删除指定任务
 * @param id - 目标任务ID
 */
function deleteTodo(id: string): void {
  todos.value = todos.value.filter((t) => t.id !== id)
  saveTodos()
}

/**
 * 清除所有已完成任务
 */
function clearCompleted(): void {
  todos.value = todos.value.filter((t) => !t.completed)
  saveTodos()
}

/**
 * 清空全部任务
 */
function clearAll(): void {
  todos.value = []
  saveTodos()
}

/**
 * 获取所有任务（对外接口）
 * @returns 当前任务列表的深拷贝
 */
function getTodos(): TodoItem[] {
  return JSON.parse(JSON.stringify(todos.value))
}

// 深度监听数据变更并自动持久化
watch(
  todos,
  () => {
    saveTodos()
  },
  { deep: true }
)

onMounted(() => {
  loadTodos()
})

/** 对外开放的管理接口 */
defineExpose({
  /** 查看全部待办 */
  getTodos,
  /** 添加待办，传入任务文本即可 */
  addTodo: (text: string): void => {
    newTodoText.value = text
    addTodo()
  },
  /** 删除指定ID的待办 */
  deleteTodo,
  /** 切换完成状态 */
  toggleTodo,
  /** 清除所有已完成 */
  clearCompleted,
  /** 清空全部 */
  clearAll
})
</script>

<style scoped>
/* ==================== 容器基础 ==================== */
.mi-todo-widget {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 12px;
  width: 100%;
  height: 100%;
  min-width: 260px;
  min-height: 340px;
  padding: 20px 18px 18px;
  overflow: hidden;
  /* 毛玻璃白色基底 + 圆形纹理 */
  background: linear-gradient(155deg, rgba(255, 255, 255, 0.95) 0%, rgba(255, 255, 255, 0.82) 100%);
  border: 2px solid rgba(255, 255, 255, 0.86);
  border-radius: 28px;
  backdrop-filter: blur(14px);
}

/* ==================== 羽翼装饰 (左上角) ==================== */
.deco-wing-tl {
  position: absolute;
  top: -8px;
  left: -6px;
  width: 90px;
  height: 80px;
  pointer-events: none;
  z-index: 0;
  animation: wingDrift 6s ease-in-out infinite;
}

@keyframes wingDrift {
  0%,
  100% {
    transform: translate(0, 0) rotate(0deg);
  }
  25% {
    transform: translate(2px, -3px) rotate(1deg);
  }
  50% {
    transform: translate(-1px, -1px) rotate(-1deg);
  }
  75% {
    transform: translate(1px, 2px) rotate(0.5deg);
  }
}

/* ==================== 星芒装饰 (右上角) ==================== */
.deco-star-tr {
  position: absolute;
  top: -4px;
  right: -2px;
  width: 70px;
  height: 52px;
  pointer-events: none;
  z-index: 0;
  animation: starShine 5s ease-in-out infinite;
}

@keyframes starShine {
  0%,
  100% {
    opacity: 0.8;
    transform: scale(1);
  }
  50% {
    opacity: 0.48;
    transform: scale(0.92);
  }
}

/* ==================== 标题区 ==================== */
.mi-todo-header {
  position: relative;
  z-index: 1;
  display: flex;
  align-items: center;
  gap: 10px;
}

.mi-todo-badge {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 5px 14px;
  background: linear-gradient(135deg, #fff5f9 0%, #ffebf3 100%);
  border: 1px solid rgba(251, 114, 153, 0.22);
  border-radius: 999px;
  box-shadow: 0 2px 8px rgba(251, 114, 153, 0.08);
}

.badge-star {
  width: 16px;
  height: 16px;
  flex-shrink: 0;
}

.badge-text {
  font-family: 'SanJiFangYuanFont';
  font-size: 13px;
  font-weight: 900;
  color: #8b1e3f;
  letter-spacing: 0.06em;
}

.mi-todo-subtitle {
  font-family: 'LoliFont';
  font-size: 10px;
  color: #c49aaa;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  opacity: 0.7;
}

/* ==================== 输入区 ==================== */
.mi-todo-input-wrap {
  position: relative;
  z-index: 1;
  display: flex;
  gap: 8px;
}

.mi-todo-input {
  flex: 1;
  height: 42px;
  padding: 0 16px;
  border: 2px solid rgba(251, 114, 153, 0.16);
  border-radius: 999px;
  font-size: 14px;
  font-family: inherit;
  color: #6f2b43;
  background: rgba(255, 255, 255, 0.82);
  transition: all 0.25s ease;
  outline: none;
}

.mi-todo-input:focus {
  border-color: var(--theme-color-light);
  box-shadow:
    0 0 0 3px rgba(251, 114, 153, 0.08),
    0 0 0 1px rgba(251, 114, 153, 0.18);
  background: rgba(255, 255, 255, 1);
}

.mi-todo-input::placeholder {
  color: #c0a0ae;
  font-size: 13px;
}

.mi-todo-add-btn {
  width: 42px;
  height: 42px;
  flex-shrink: 0;
  border: none;
  border-radius: 50%;
  background: none;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.28s ease;
}

.mi-todo-add-btn.active {
  background: var(--theme-color-light);
  color: #fff;
  box-shadow: 0 4px 14px rgba(251, 114, 153, 0.34);
}

.mi-todo-add-btn.active:hover {
  transform: scale(1.06);
  box-shadow: 0 6px 20px rgba(251, 114, 153, 0.42);
}

.mi-todo-add-btn:disabled {
  cursor: default;
}

.add-btn-svg {
  width: 18px;
  height: 18px;
}

/* ==================== 统计区 ==================== */
.mi-todo-stats {
  position: relative;
  z-index: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0;
  padding: 10px 6px;
  background: rgba(255, 255, 255, 0.68);
  border: 1px solid rgba(251, 114, 153, 0.1);
  border-radius: 20px;
  backdrop-filter: blur(4px);
}

.stat-card {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
}

.stat-number {
  font-family: 'LoliFont';
  font-size: 20px;
  font-weight: 700;
  line-height: 1.1;
}

.stat-label {
  font-size: 11px;
  color: #af8a98;
  font-weight: 500;
}

.stat-total {
  color: #8b1e3f;
}

.stat-done {
  color: #4caf50;
}

.stat-pending {
  color: var(--theme-color);
}

.stat-divider {
  width: 1px;
  height: 28px;
  background: linear-gradient(180deg, transparent, rgba(251, 114, 153, 0.2), transparent);
  border-radius: 1px;
}

/* ==================== 任务列表 ==================== */
.mi-todo-list-wrap {
  position: relative;
  z-index: 1;
  flex: 1;
  min-height: 0;
  overflow: hidden;
}

.mi-todo-list {
  max-height: 100%;
  overflow-y: auto;
  padding-right: 4px;
  display: flex;
  flex-direction: column;
  gap: 7px;
}

.mi-todo-list::-webkit-scrollbar {
  width: 4px;
}

.mi-todo-list::-webkit-scrollbar-track {
  background: transparent;
}

.mi-todo-list::-webkit-scrollbar-thumb {
  background: rgba(251, 114, 153, 0.16);
  border-radius: 4px;
}

.mi-todo-list::-webkit-scrollbar-thumb:hover {
  background: rgba(251, 114, 153, 0.3);
}

/* --- 任务条目 --- */
.mi-todo-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 12px;
  background: rgba(255, 255, 255, 0.78);
  border: 1px solid rgba(251, 114, 153, 0.1);
  border-radius: 16px;
  transition: all 0.28s ease;
  animation: itemSlideIn 0.36s ease both;
}

@keyframes itemSlideIn {
  from {
    opacity: 0;
    transform: translateX(-16px) scale(0.96);
  }
  to {
    opacity: 1;
    transform: translateX(0) scale(1);
  }
}

.mi-todo-item:hover {
  background: rgba(255, 255, 255, 0.98);
  border-color: rgba(251, 114, 153, 0.24);
  box-shadow: 0 3px 12px rgba(139, 30, 63, 0.08);
  transform: translateX(2px);
}

.mi-todo-item.done {
  opacity: 0.64;
  background: rgba(248, 248, 248, 0.72);
}

.mi-todo-item.done:hover {
  opacity: 0.82;
}

/* --- 勾选框 --- */
.mi-checkbox {
  width: 24px;
  height: 24px;
  flex-shrink: 0;
  border: 2px solid #ddd;
  border-radius: 50%;
  background: transparent;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.22s ease;
  padding: 0;
}

.mi-checkbox:hover {
  border-color: var(--theme-color);
  box-shadow: 0 0 0 4px rgba(251, 114, 153, 0.1);
}

.mi-checkbox.checked {
  border-color: var(--theme-color-light);
  background: var(--theme-color-light);
  box-shadow: 0 2px 8px rgba(251, 114, 153, 0.3);
}

.check-mark {
  width: 14px;
  height: 14px;
}

/* --- 任务文字 --- */
.mi-todo-text {
  flex: 1;
  font-size: 14px;
  color: #6f2b43;
  line-height: 1.45;
  word-break: break-word;
  transition: all 0.25s ease;
}

.mi-todo-text.line-through {
  text-decoration: line-through;
  text-decoration-color: rgba(153, 153, 153, 0.5);
  color: #b0a0a8;
}

/* --- 删除按钮 --- */
.mi-delete-btn {
  width: 28px;
  height: 28px;
  flex-shrink: 0;
  border: none;
  border-radius: 50%;
  background: transparent;
  color: #d0c0c8;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  opacity: 0;
  transition: all 0.22s ease;
  padding: 2px;
}

.mi-todo-item:hover .mi-delete-btn {
  opacity: 1;
}

.mi-delete-btn:hover {
  background: rgba(255, 60, 80, 0.1);
  color: #ff5c6c;
}

.delete-svg {
  width: 15px;
  height: 15px;
}

/* ==================== TransitionGroup 动画 ==================== */
.mi-item-enter-active,
.mi-item-leave-active {
  transition: all 0.35s ease;
}

.mi-item-enter-from {
  opacity: 0;
  transform: translateX(-24px) scale(0.94);
}

.mi-item-leave-to {
  opacity: 0;
  transform: translateX(28px) scale(0.94);
}

.mi-item-move {
  transition: transform 0.35s ease;
}

/* ==================== 空状态 ==================== */
.mi-todo-empty {
  position: relative;
  z-index: 1;
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 20px 16px;
}

.empty-illustration {
  margin-bottom: 6px;
}

.empty-check {
  width: 56px;
  height: 56px;
  animation: emptyFloat 4s ease-in-out infinite;
}

@keyframes emptyFloat {
  0%,
  100% {
    transform: translateY(0);
  }
  50% {
    transform: translateY(-4px);
  }
}

.empty-title {
  font-family: 'SanJiFangYuanFont';
  font-size: 15px;
  color: #af8a98;
  margin: 0;
  font-weight: 700;
}

.empty-desc {
  font-size: 13px;
  color: #c0a0ae;
  margin: 0;
}

.empty-hint {
  font-size: 12px;
  color: #d4c0ca;
  margin: 0;
  margin-top: 2px;
}

/* ==================== 底部操作栏 ==================== */
.mi-todo-footer {
  position: relative;
  z-index: 1;
}

.mi-clear-btn {
  width: 100%;
  height: 36px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  border: 2px solid rgba(251, 114, 153, 0.14);
  border-radius: 999px;
  background: white;
  color: #b08898;
  font-size: 12px;
  font-family: inherit;
  cursor: pointer;
  transition: all 0.24s ease;
}

.mi-clear-btn:hover {
  /* background: rgba(255, 80, 100, 0.06); */
  border-color: rgba(255, 80, 100, 0.28);
  color: var(--theme-color);
}

.mi-clear-btn:active {
  transform: scale(0.98);
}

.clear-icon {
  width: 14px;
  height: 14px;
  flex-shrink: 0;
}

/* ==================== Q版助手装饰 (右下角) ==================== */
.mi-todo-mascot {
  position: absolute;
  right: -26px;
  bottom: -34px;
  width: 120px;
  height: 120px;
  background: url('../../../assets/images/助手Q版.png') center / contain no-repeat;
  opacity: 0.08;
  pointer-events: none;
  z-index: 0;
  animation: mascotBreathe 8s ease-in-out infinite;
}

@keyframes mascotBreathe {
  0%,
  100% {
    transform: scale(1) rotate(0deg);
    opacity: 0.08;
  }
  25% {
    transform: scale(1.04) rotate(1deg);
    opacity: 0.1;
  }
  50% {
    transform: scale(1) rotate(0deg);
    opacity: 0.08;
  }
  75% {
    transform: scale(1.03) rotate(-1deg);
    opacity: 0.09;
  }
}

/* ==================== 樱花花瓣飘落装饰 ==================== */
.sakura-petal {
  position: absolute;
  pointer-events: none;
  z-index: 0;
  border-radius: 50% 0 50% 0;
  opacity: 0.09;
}

.sakura-p1 {
  width: 18px;
  height: 18px;
  background: var(--theme-color-light);
  top: 15%;
  right: 8%;
  animation: petalFall 12s linear infinite;
}

.sakura-p2 {
  width: 12px;
  height: 12px;
  background: var(--theme-color-shadow);
  top: 45%;
  left: 6%;
  animation: petalFall 10s linear 3s infinite;
}

.sakura-p3 {
  width: 10px;
  height: 10px;
  background: var(--theme-color);
  top: 70%;
  right: 12%;
  animation: petalFall 14s linear 6s infinite;
}

@keyframes petalFall {
  0% {
    transform: translateY(-20px) translateX(0) rotate(0deg);
    opacity: 0;
  }
  10% {
    opacity: 0.09;
  }
  90% {
    opacity: 0.09;
  }
  100% {
    transform: translateY(calc(100vh)) translateX(20px) rotate(360deg);
    opacity: 0;
  }
}
</style>
