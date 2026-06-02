<template>
  <div class="todo-widget">
    <div class="todo-panel-title">Quest List</div>
    <!-- 添加待办 -->
    <div class="todo-input-container">
      <input
        v-model="newTodoText"
        class="todo-input"
        type="text"
        placeholder="添加新的待办事项..."
        @keyup.enter="addTodo"
      />
      <button class="add-btn" @click="addTodo" :disabled="!newTodoText.trim()">
        <font-awesome-icon icon="fa-solid fa-plus" />
      </button>
    </div>

    <!-- 待办统计 -->
    <div class="todo-stats">
      <span class="stats-item">
        <span class="stats-count">{{ todos.length }}</span>
        <span class="stats-label">总计</span>
      </span>
      <span class="stats-divider">|</span>
      <span class="stats-item">
        <span class="stats-count completed">{{ completedCount }}</span>
        <span class="stats-label">已完成</span>
      </span>
      <span class="stats-divider">|</span>
      <span class="stats-item">
        <span class="stats-count pending">{{ pendingCount }}</span>
        <span class="stats-label">待完成</span>
      </span>
    </div>

    <!-- 待办列表 -->
    <div class="todo-list" v-if="todos.length > 0">
      <TransitionGroup name="todo" tag="div">
        <div
          v-for="todo in sortedTodos"
          :key="todo.id"
          class="todo-item"
          :class="{ completed: todo.completed }"
        >
          <button class="todo-checkbox" @click="toggleTodo(todo.id)">
            <font-awesome-icon
              :icon="todo.completed ? 'fa-solid fa-circle-check' : 'fa-regular fa-circle'"
            />
          </button>
          <span class="todo-text" :class="{ 'line-through': todo.completed }">
            {{ todo.text }}
          </span>
          <button class="todo-delete" @click="deleteTodo(todo.id)" title="删除">
            <font-awesome-icon icon="fa-solid fa-trash-can" />
          </button>
        </div>
      </TransitionGroup>
    </div>

    <!-- 空状态 -->
    <div v-else class="todo-empty">
      <div class="empty-icon">✦</div>
      <p class="empty-text">还没有待办事项</p>
      <p class="empty-hint">添加一个开始吧~</p>
    </div>

    <!-- 清除已完成 -->
    <button
      v-if="completedCount > 0"
      class="clear-completed-btn"
      @click="clearCompleted"
    >
      <font-awesome-icon icon="fa-solid fa-broom" />
      清除已完成 ({{ completedCount }})
    </button>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'

/** 待办事项接口 */
interface Todo {
  id: number
  text: string
  completed: boolean
  createdAt: number
}

/** 本地存储键名 */
const STORAGE_KEY = 'moeechat-todos'

interface Emits {
  (e: 'update:count', total: number, completed: number): void
}

const emit = defineEmits<Emits>()

/** 待办列表 */
const todos = ref<Todo[]>([])

/** 新待办文本 */
const newTodoText = ref('')

/** 下一个ID */
let nextId = 1

/** 已完成数量 */
const completedCount = computed(() => todos.value.filter(t => t.completed).length)

/** 待完成数量 */
const pendingCount = computed(() => todos.value.filter(t => !t.completed).length)

/** 排序后的待办（未完成在前） */
const sortedTodos = computed(() => {
  return [...todos.value].sort((a, b) => {
    if (a.completed !== b.completed) {
      return a.completed ? 1 : -1
    }
    return b.createdAt - a.createdAt
  })
})

/** 从本地存储加载 */
function loadTodos(): void {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored) {
      todos.value = JSON.parse(stored)
      nextId = Math.max(...todos.value.map(t => t.id), 0) + 1
    }
  } catch (err) {
    console.error('加载待办失败:', err)
    todos.value = []
  }
}

/** 保存到本地存储 */
function saveTodos(): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(todos.value))
    emit('update:count', todos.value.length, completedCount.value)
  } catch (err) {
    console.error('保存待办失败:', err)
  }
}

/** 添加待办 */
function addTodo(): void {
  const text = newTodoText.value.trim()
  if (!text) return

  const todo: Todo = {
    id: nextId++,
    text,
    completed: false,
    createdAt: Date.now()
  }

  todos.value.push(todo)
  newTodoText.value = ''
  saveTodos()
}

/** 切换待办状态 */
function toggleTodo(id: number): void {
  const todo = todos.value.find(t => t.id === id)
  if (todo) {
    todo.completed = !todo.completed
    saveTodos()
  }
}

/** 删除待办 */
function deleteTodo(id: number): void {
  todos.value = todos.value.filter(t => t.id !== id)
  saveTodos()
}

/** 清除已完成 */
function clearCompleted(): void {
  todos.value = todos.value.filter(t => !t.completed)
  saveTodos()
}

/** 监听变化 */
watch(todos, () => {
  saveTodos()
}, { deep: true })

/** 组件挂载 */
onMounted(() => {
  loadTodos()
})

/** 暴露方法 */
defineExpose({
  getTodos: () => todos.value,
  addTodo: (text: string) => {
    newTodoText.value = text
    addTodo()
  },
  clearAll: () => {
    todos.value = []
    saveTodos()
  }
})
</script>

<style scoped>
.todo-widget {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 14px;
  width: 100%;
  height: 100%;
  min-width: 250px;
  min-height: 320px;
  padding: 18px;
  overflow: hidden;
  background:
    linear-gradient(150deg, rgba(255, 255, 255, 0.92), rgba(255, 255, 255, 0.78)),
    url('../../../assets/images/background_circle.png');
  background-size: auto, 56px 38px;
  border: 2px solid rgba(255, 255, 255, 0.84);
  border-radius: 26px;
  box-shadow:
    inset 0 0 0 1px rgba(255, 255, 255, 0.72),
    0 18px 34px rgba(139, 30, 63, 0.16);
  backdrop-filter: blur(14px);
}

.todo-widget::after {
  content: '';
  position: absolute;
  right: -34px;
  bottom: -42px;
  width: 148px;
  height: 148px;
  background: url('../../../assets/images/助手Q版.png') center / contain no-repeat;
  opacity: 0.12;
  pointer-events: none;
}

.todo-panel-title {
  position: relative;
  z-index: 1;
  align-self: flex-start;
  padding: 5px 12px;
  border-radius: 999px;
  background: #fff5f9;
  border: 1px solid rgba(251, 114, 153, 0.2);
  color: #8b1e3f;
  font-size: 12px;
  font-weight: 900;
  letter-spacing: 0.08em;
}

.todo-input-container {
  position: relative;
  z-index: 1;
  display: flex;
  gap: 8px;
}

.todo-input {
  flex: 1;
  height: 40px;
  padding: 0 14px;
  border: 1px solid rgba(251, 114, 153, 0.18);
  border-radius: 999px;
  font-size: 14px;
  color: #6f2b43;
  background: rgba(255, 255, 255, 0.84);
  transition: all 0.2s ease;
  outline: none;
}

.todo-input:focus {
  border-color: var(--theme-color, #fb7299);
  box-shadow: 0 0 0 3px rgba(251, 114, 153, 0.1);
}

.todo-input::placeholder {
  color: #999;
}

.add-btn {
  width: 40px;
  height: 40px;
  border: none;
  border-radius: 999px;
  background: linear-gradient(135deg, var(--theme-color-light, #ffd1e8), var(--theme-color, #fb7299));
  color: white;
  font-size: 16px;
  cursor: pointer;
  transition: all 0.2s ease;
  display: flex;
  align-items: center;
  justify-content: center;
}

.add-btn:hover:not(:disabled) {
  transform: scale(1.05);
  box-shadow: 0 4px 12px rgba(251, 114, 153, 0.3);
}

.add-btn:active:not(:disabled) {
  transform: scale(0.95);
}

.add-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.todo-stats {
  position: relative;
  z-index: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 16px;
  padding: 8px 12px;
  background: rgba(255, 255, 255, 0.72);
  border: 1px solid rgba(251, 114, 153, 0.14);
  border-radius: 18px;
}

.stats-item {
  display: flex;
  align-items: center;
  gap: 6px;
}

.stats-count {
  font-size: 18px;
  font-weight: 700;
  color: #8b1e3f;
}

.stats-count.completed {
  color: #4caf50;
}

.stats-count.pending {
  color: var(--theme-color, #fb7299);
}

.stats-label {
  font-size: 12px;
  color: #9a6275;
}

.stats-divider {
  color: #ddd;
  font-size: 14px;
}

.todo-list {
  position: relative;
  z-index: 1;
  max-height: 300px;
  overflow-y: auto;
  padding-right: 4px;
}

.todo-list::-webkit-scrollbar {
  width: 4px;
}

.todo-list::-webkit-scrollbar-track {
  background: transparent;
}

.todo-list::-webkit-scrollbar-thumb {
  background: rgba(0, 0, 0, 0.1);
  border-radius: 2px;
}

.todo-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 12px;
  background: rgba(255, 255, 255, 0.82);
  border-radius: 16px;
  margin-bottom: 8px;
  transition: all 0.2s ease;
  border: 1px solid rgba(251, 114, 153, 0.12);
}

.todo-item:hover {
  background: rgba(255, 255, 255, 1);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
}

.todo-item.completed {
  opacity: 0.7;
  background: #f8f8f8;
}

.todo-checkbox {
  width: 24px;
  height: 24px;
  border: none;
  background: transparent;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 20px;
  color: #ddd;
  transition: all 0.2s ease;
  flex-shrink: 0;
}

.todo-checkbox:hover {
  color: var(--theme-color, #fb7299);
}

.todo-item.completed .todo-checkbox {
  color: #4caf50;
}

.todo-text {
  flex: 1;
  font-size: 14px;
  color: #6f2b43;
  word-break: break-word;
  transition: all 0.2s ease;
}

.todo-text.line-through {
  text-decoration: line-through;
  color: #999;
}

.todo-delete {
  width: 28px;
  height: 28px;
  border: none;
  border-radius: 999px;
  background: transparent;
  color: #ccc;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  opacity: 0;
  transition: all 0.2s ease;
}

.todo-item:hover .todo-delete {
  opacity: 1;
}

.todo-delete:hover {
  background: rgba(255, 0, 0, 0.1);
  color: #ff4444;
}

.todo-empty {
  position: relative;
  z-index: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 24px 16px;
  gap: 8px;
}

.empty-icon {
  width: 52px;
  height: 52px;
  display: grid;
  place-items: center;
  border-radius: 50%;
  background: #fff5f9;
  color: var(--theme-color, #fb7299);
  font-size: 30px;
  box-shadow: inset 0 0 0 1px rgba(251, 114, 153, 0.16);
}

.empty-text {
  font-size: 14px;
  color: #999;
  margin: 0;
}

.empty-hint {
  font-size: 12px;
  color: #bbb;
  margin: 0;
}

.clear-completed-btn {
  position: relative;
  z-index: 1;
  width: 100%;
  height: 36px;
  border: 1px solid rgba(251, 114, 153, 0.16);
  border-radius: 999px;
  background: #fff7fa;
  color: #9a6275;
  font-size: 13px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  transition: all 0.2s ease;
}

.clear-completed-btn:hover {
  background: rgba(255, 0, 0, 0.08);
  color: #ff4444;
}

/* TransitionGroup 动画 */
.todo-enter-active,
.todo-leave-active {
  transition: all 0.3s ease;
}

.todo-enter-from {
  opacity: 0;
  transform: translateX(-20px);
}

.todo-leave-to {
  opacity: 0;
  transform: translateX(20px);
}

.todo-move {
  transition: transform 0.3s ease;
}
</style>
