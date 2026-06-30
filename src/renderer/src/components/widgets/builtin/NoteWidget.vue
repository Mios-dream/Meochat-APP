<template>
  <div class="note-widget">
    <div class="note-ribbon">Moe Memo</div>
    <!-- 便签头部 -->
    <div class="note-header">
      <input
        v-model="title"
        class="note-title-input"
        type="text"
        placeholder="便签标题..."
        @input="debounceSave"
      />
      <div class="note-actions">
        <button class="action-btn" title="清空" @click="clearNote">
          <font-awesome-icon icon="fa-solid fa-eraser" />
        </button>
        <button class="action-btn" title="复制" @click="copyNote">
          <font-awesome-icon :icon="copied ? 'fa-solid fa-check' : 'fa-solid fa-copy'" />
        </button>
      </div>
    </div>

    <!-- 便签内容 -->
    <div class="note-content">
      <textarea
        v-model="content"
        class="note-textarea"
        placeholder="在这里记录你的想法..."
        @input="debounceSave"
      ></textarea>
    </div>

    <!-- 便签底部 -->
    <div class="note-footer">
      <div class="note-info">
        <span class="info-item">
          <font-awesome-icon icon="fa-solid fa-font" />
          {{ charCount }} 字
        </span>
        <span class="info-item">
          <font-awesome-icon icon="fa-solid fa-clock" />
          {{ savedAt }}
        </span>
      </div>
      <div class="note-status" :class="{ saved: isSaved }">
        <span>{{ isSaved ? '已保存' : '保存中...' }}</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'

/** 本地存储键名 */
const STORAGE_KEY = 'moechat-note'

/** 保存延迟（毫秒） */
const SAVE_DELAY = 1000

interface Emits {
  (e: 'update:title', title: string): void
  (e: 'update:content', content: string): void
  (e: 'save'): void
}

const emit = defineEmits<Emits>()

/** 标题 */
const title = ref('')

/** 内容 */
const content = ref('')

/** 是否已复制 */
const copied = ref(false)

/** 是否已保存 */
const isSaved = ref(true)

/** 保存时间 */
const savedAt = ref('未保存')

/** 保存定时器 */
let saveTimer: ReturnType<typeof setTimeout> | null = null

/** 复制定时器 */
let copyTimer: ReturnType<typeof setTimeout> | null = null

/** 字符数 */
const charCount = computed(() => {
  return content.value.length
})

/** 防抖保存 */
function debounceSave(): void {
  isSaved.value = false

  if (saveTimer) {
    clearTimeout(saveTimer)
  }

  saveTimer = setTimeout(() => {
    saveNote()
  }, SAVE_DELAY)
}

/** 保存到本地存储 */
function saveNote(): void {
  try {
    const data = {
      title: title.value,
      content: content.value,
      updatedAt: Date.now()
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data))

    isSaved.value = true
    savedAt.value = formatTime(new Date())
    emit('save')
  } catch (err) {
    console.error('保存便签失败:', err)
  }
}

/** 从本地存储加载 */
function loadNote(): void {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored) {
      const data = JSON.parse(stored)
      title.value = data.title || ''
      content.value = data.content || ''
      if (data.updatedAt) {
        savedAt.value = formatTime(new Date(data.updatedAt))
      }
    }
  } catch (err) {
    console.error('加载便签失败:', err)
  }
}

/** 清空便签 */
function clearNote(): void {
  if (title.value || content.value) {
    title.value = ''
    content.value = ''
    saveNote()
  }
}

/** 复制便签内容 */
async function copyNote(): Promise<void> {
  const text = `${title.value ? title.value + '\n\n' : ''}${content.value}`

  if (!text.trim()) return

  try {
    await navigator.clipboard.writeText(text)
    copied.value = true

    if (copyTimer) {
      clearTimeout(copyTimer)
    }
    copyTimer = setTimeout(() => {
      copied.value = false
    }, 2000)
  } catch (err) {
    console.error('复制失败:', err)
  }
}

/** 格式化时间 */
function formatTime(date: Date): string {
  const hours = String(date.getHours()).padStart(2, '0')
  const minutes = String(date.getMinutes()).padStart(2, '0')
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')

  return `${month}/${day} ${hours}:${minutes}`
}

/** 组件挂载 */
onMounted(() => {
  loadNote()
})

/** 组件卸载 */
onUnmounted(() => {
  if (saveTimer) {
    clearTimeout(saveTimer)
  }
  if (copyTimer) {
    clearTimeout(copyTimer)
  }
  // 离开前保存
  if (!isSaved.value) {
    saveNote()
  }
})

/** 暴露方法 */
defineExpose({
  getTitle: () => title.value,
  getContent: () => content.value,
  setTitle: (value: string) => {
    title.value = value
    debounceSave()
  },
  setContent: (value: string) => {
    content.value = value
    debounceSave()
  },
  clear: clearNote,
  save: saveNote
})
</script>

<style scoped>
.note-widget {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 0;
  width: 100%;
  height: 100%;
  min-height: 240px;
  background: linear-gradient(145deg, #fff8e6, #fff3f7);
  background-size:
    auto,
    24px 24px;
  border-radius: 26px;
  overflow: hidden;
  backdrop-filter: blur(14px);
}

.note-widget::after {
  content: '';
  position: absolute;
  right: -30px;
  bottom: -42px;
  width: 144px;
  height: 144px;
  background: url('../../../assets/images/sakura.webp') center / contain no-repeat;
  opacity: 0.16;
  pointer-events: none;
}

.note-ribbon {
  position: absolute;
  top: 10px;
  left: -28px;
  z-index: 2;
  width: 118px;
  padding: 5px 0;
  background: linear-gradient(135deg, #ff9ec3, var(--theme-color, #fb7299));
  color: white;
  font-size: 11px;
  font-weight: 900;
  letter-spacing: 0.08em;
  text-align: center;
  transform: rotate(-38deg);
  box-shadow: 0 8px 18px rgba(251, 114, 153, 0.22);
}

.note-header {
  position: relative;
  z-index: 1;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 16px 16px 12px 42px;
  background: rgba(255, 255, 255, 0.76);
  border-bottom: 1px dashed rgba(251, 114, 153, 0.26);
}

.note-title-input {
  flex: 1;
  border: none;
  background: transparent;
  font-size: 17px;
  font-weight: 900;
  color: #8b1e3f;
  outline: none;
}

.note-title-input::placeholder {
  color: #999;
  font-weight: 400;
}

.note-actions {
  display: flex;
  gap: 4px;
}

.action-btn {
  width: 32px;
  height: 32px;
  border: 1px solid rgba(251, 114, 153, 0.18);
  border-radius: 999px;
  background: #fff7fa;
  color: #8b1e3f;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 14px;
  transition: all 0.2s ease;
}

.action-btn:hover {
  background: #fff;
  color: var(--theme-color, #fb7299);
  transform: translateY(-1px);
}

.action-btn:active {
  transform: scale(0.95);
}

.note-content {
  position: relative;
  z-index: 1;
  flex: 1;
  padding: 0;
}

.note-content::before {
  content: '';
  position: absolute;
  inset: 14px 18px;
  background: repeating-linear-gradient(
    to bottom,
    transparent 0,
    transparent 29px,
    rgba(251, 114, 153, 0.12) 30px
  );
  pointer-events: none;
}

.note-textarea {
  width: 100%;
  height: 100%;
  min-height: 150px;
  position: relative;
  z-index: 1;
  padding: 18px 20px;
  border: none;
  background: transparent;
  font-size: 14px;
  line-height: 1.8;
  color: #6f2b43;
  resize: none;
  outline: none;
  font-family: inherit;
  font-weight: 600;
}

.note-textarea::placeholder {
  color: #aaa;
  font-style: italic;
}

.note-footer {
  position: relative;
  z-index: 1;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 16px;
  background: rgba(255, 255, 255, 0.76);
  border-top: 1px dashed rgba(251, 114, 153, 0.24);
  font-size: 11px;
  color: #9a6275;
}

.note-info {
  display: flex;
  gap: 12px;
}

.info-item {
  display: flex;
  align-items: center;
  gap: 4px;
}

.info-item svg {
  font-size: 10px;
}

.note-status {
  display: flex;
  align-items: center;
  gap: 4px;
  color: #999;
  transition: all 0.3s ease;
}

.note-status.saved {
  color: #4caf50;
}

.note-status svg {
  font-size: 12px;
}

/* 滚动条样式 */
.note-textarea::-webkit-scrollbar {
  width: 6px;
}

.note-textarea::-webkit-scrollbar-track {
  background: transparent;
}

.note-textarea::-webkit-scrollbar-thumb {
  background: rgba(0, 0, 0, 0.1);
  border-radius: 3px;
}

.note-textarea::-webkit-scrollbar-thumb:hover {
  background: rgba(0, 0, 0, 0.2);
}
</style>
