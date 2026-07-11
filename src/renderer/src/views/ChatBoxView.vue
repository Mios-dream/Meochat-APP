<template>
  <div class="toolMenuContainer">
    <!-- 顶部标题栏：拖拽区域 + 窗口控制 -->
    <div class="title-bar" @mousedown="startDrag">
      <div class="title-left">
        <div class="title-avatar" />
        <span class="title-greeting">阁下，下午好</span>
      </div>
      <div class="title-right">
        <button
          class="title-btn"
          title="置顶"
          :class="{ pinned: isPinned }"
          @click.stop="togglePin"
        >
          <font-awesome-icon icon="thumbtack" />
        </button>
        <button class="title-btn close-btn" title="关闭" @click.stop="closeChatBox">
          <font-awesome-icon icon="xmark" />
        </button>
      </div>
    </div>

    <!-- 聊天消息区域：空间 > 260px 时显示历史记录，较小时自动留白 -->
    <div ref="messagesRef" class="chat-messages">
      <div class="chat-messages-body">
        <template v-if="messages.length > 0">
          <div
            v-for="(msg, idx) in messages"
            :key="idx"
            :class="['message-row', msg.role === 'assistant' ? 'assistant-row' : 'user-row']"
          >
            <div v-if="msg.role === 'assistant'" class="message-avatar small-avatar" />
            <div
              :class="[
                'message-bubble',
                msg.role === 'assistant' ? 'assistant-bubble' : 'user-bubble'
              ]"
            >
              <span class="message-label">{{
                msg.role === 'assistant' ? assistantName : '你'
              }}</span>
              <MessageContent :content="msg.content" :role="msg.role" />
            </div>
          </div>
          <!-- 输入中动画 -->
          <div v-if="loading" class="typing-indicator">
            <span class="typing-dot" />
            <span class="typing-dot" />
            <span class="typing-dot" />
          </div>
        </template>
        <div v-else class="empty-hint">
          <font-awesome-icon icon="comment-dots" class="empty-icon" />
          <span>开始一段对话吧</span>
        </div>
      </div>
    </div>

    <!-- 消息输入区域：紧贴消息区底部 -->
    <div class="chat-input-area">
      <input
        ref="inputRef"
        v-model="inputText"
        type="text"
        class="chat-input"
        placeholder="输入消息..."
        :disabled="loading"
        @keydown.enter.prevent="handleSend"
      />
    </div>

    <!-- 底部快捷工具栏 -->
    <div class="bottom-toolbar">
      <div class="toolbar-left">
        <button class="tool-icon-btn" title="截图" @click="takeScreenshot">
          <font-awesome-icon icon="camera" />
        </button>
        <button class="tool-icon-btn" title="上传文件" @click="uploadFile">
          <font-awesome-icon icon="paperclip" />
        </button>
        <button class="tool-icon-btn" title="上传图片" @click="uploadImage">
          <font-awesome-icon icon="image" />
        </button>
      </div>
      <div class="toolbar-right">
        <button class="send-btn" :disabled="!inputText.trim() || loading" @click="handleSend">
          <font-awesome-icon icon="paper-plane" />
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, nextTick } from 'vue'
import MessageContent from '../components/MessageContent.vue'

/** 单条聊天消息 */
interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}

const messagesRef = ref<HTMLElement | null>(null)

const messages = ref<ChatMessage[]>([])
const historyLoading = ref(false)
const loading = ref(false)
const inputText = ref('')
const assistantName = ref('助手')
const isPinned = ref(false)
let removeStatusUpdated: () => void = () => {}

/** 自动滚动聊天区域到底部 */
function scrollToBottom(): void {
  nextTick(() => {
    if (messagesRef.value) {
      messagesRef.value.scrollTop = messagesRef.value.scrollHeight
    }
  })
}

/** 发送消息 */
function handleSend(): void {
  const text = inputText.value.trim()
  if (!text || loading.value) return

  messages.value.push({ role: 'user', content: text })
  inputText.value = ''
  scrollToBottom()

  loading.value = true
  window.api.ipcRenderer.invoke('chat-box:send-message', text)
}

/** 切换窗口置顶 */
async function togglePin(): Promise<void> {
  try {
    const result = await window.api.togglePin()
    if (result.success) {
      isPinned.value = result.pinned ?? false
    }
  } catch (err) {
    console.error('切换置顶失败:', err)
  }
}

/** 关闭聊天框 */
function closeChatBox(): void {
  window.api.closeChatBox()
}

/** 截图功能（预留） */
function takeScreenshot(): void {
  console.log('触发截图功能')
}

/** 上传文件（预留） */
function uploadFile(): void {
  console.log('上传文件')
}

/** 上传图片（预留） */
function uploadImage(): void {
  console.log('上传图片')
}

/** 拖拽聊天框窗口 */
function startDrag(): void {
  window.api.startDrag?.()
}

onMounted(async () => {
  // 通过 IPC 从主进程获取聊天历史
  try {
    const history = await window.api.ipcRenderer.invoke('chat-box:get-history')

    messages.value = history as ChatMessage[]
    scrollToBottom()
  } catch (error) {
    console.warn('获取聊天历史失败:', error)
  }
  historyLoading.value = false

  removeStatusUpdated = window.api.ipcRenderer.on('chat-box:status-updated', (data) => {
    const statusData = data as { loading: boolean; reply?: string }
    loading.value = statusData.loading
    if (!statusData.loading && statusData.reply) {
      messages.value.push({ role: 'assistant', content: statusData.reply })
      scrollToBottom()
    }
  })
})

onUnmounted(() => {
  removeStatusUpdated()
})
</script>

<style scoped>
.toolMenuContainer {
  width: 100vw;
  height: 100vh;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  outline: none;
  border-radius: 14px;
  background: linear-gradient(155deg, rgba(255, 255, 255, 0.93) 0%, rgba(255, 255, 255, 0.78) 100%);
  backdrop-filter: blur(14px);
  border: 2px solid rgba(255, 255, 255, 0.82);
  box-shadow: 0 8px 32px rgba(139, 30, 63, 0.12);
}

/* ───── 顶部标题栏 ───── */
.title-bar {
  height: 48px;
  min-height: 48px;
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 12px;
  cursor: grab;
  -webkit-app-region: drag;
  app-region: drag;
  flex-shrink: 0;
  border-bottom: 1px solid rgba(139, 30, 63, 0.06);
}

.title-left {
  display: flex;
  align-items: center;
  gap: 10px;
  -webkit-app-region: drag;
  app-region: drag;
}

.title-avatar {
  width: 30px;
  height: 30px;
  border-radius: 50%;
  background-image: url('../assets/images/助手Q版.png');
  background-size: cover;
  background-position: center;
  border: 2px solid rgba(252, 165, 185, 0.6);
  flex-shrink: 0;
}

.title-greeting {
  font-size: 14px;
  color: #6f2b43;
  white-space: nowrap;
  font-weight: 600;
}

.title-right {
  display: flex;
  align-items: center;
  gap: 4px;
  -webkit-app-region: no-drag;
  app-region: no-drag;
}

.title-btn {
  width: 30px;
  height: 30px;
  border: none;
  background: transparent;
  color: #9a6275;
  border-radius: 8px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 14px;
  transition: all 0.2s ease;
}

.title-btn:hover {
  background: rgba(252, 142, 173, 0.12);
  color: var(--theme-color, #fc8ead);
}

.title-btn.pinned {
  color: var(--theme-color, #fc8ead);
}

.close-btn:hover {
  background: rgba(233, 113, 104, 0.14);
  color: #e97168;
}

/* ───── 聊天消息区域 ───── */
.chat-messages {
  flex: 1;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  padding: 12px 12px 8px;
  scrollbar-width: thin;
  scrollbar-color: rgba(0, 0, 0, 0.12) transparent;
}

.chat-messages-body {
  display: flex;
  flex-direction: column;
  flex: 1;
  gap: 6px;
}

/* 窗口高度 ≤ 260px 时隐藏消息内容，仅留空白占位 */
@media (max-height: 260px) {
  .chat-messages-body {
    display: none;
  }
  .chat-messages {
    overflow: hidden;
  }
}

.chat-messages::-webkit-scrollbar {
  width: 4px;
}

.chat-messages::-webkit-scrollbar-thumb {
  background: rgba(0, 0, 0, 0.12);
  border-radius: 2px;
}

.chat-messages::-webkit-scrollbar-thumb:hover {
  background: rgba(0, 0, 0, 0.2);
}

.empty-hint {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  color: #c0a0ae;
  font-size: 14px;
}

.empty-icon {
  font-size: 32px;
  color: var(--theme-color-shadow, #ffc0d6);
  opacity: 0.4;
}

.loading-messages {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 20px;
}

.loading-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--theme-color-shadow, #ffc0d6);
  animation: loading-pulse 1.2s ease-in-out infinite;
}

.loading-dot:nth-child(2) {
  animation-delay: 0.2s;
}

.loading-dot:nth-child(3) {
  animation-delay: 0.4s;
}

@keyframes loading-pulse {
  0%,
  100% {
    opacity: 0.25;
    transform: scale(0.7);
  }
  50% {
    opacity: 0.8;
    transform: scale(1);
  }
}

/* ───── 消息气泡 ───── */
.message-row {
  display: flex;
  gap: 8px;
  align-items: flex-start;
  max-width: 100%;
}

.assistant-row {
  align-self: flex-start;
}

.user-row {
  align-self: flex-end;
}

.message-avatar {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  flex-shrink: 0;
}

.small-avatar {
  width: 30px;
  height: 30px;
  background-image: url('../assets/images/助手Q版.png');
  background-size: cover;
  background-position: center;
  border: 2px solid var(--theme-color-light, #fca5b9);
}

.message-bubble {
  padding: 8px 14px;
  border-radius: 14px;
  font-size: 13px;
  line-height: 1.5;
  word-break: break-word;
  max-width: 85%;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.05);
}

.assistant-bubble {
  background: rgba(255, 255, 255, 0.65);
  border: 1px solid rgba(139, 30, 63, 0.06);
  backdrop-filter: blur(8px);
  color: #6f2b43;
  border-top-left-radius: 4px;
}

.user-bubble {
  background: linear-gradient(
    135deg,
    var(--theme-color-light, #fca5b9),
    var(--theme-color, #fc8ead)
  );
  color: white;
  border-bottom-right-radius: 4px;
}

.message-label {
  font-size: 11px;
  color: #9a6275;
  display: block;
  margin-bottom: 2px;
  font-weight: 500;
}

/* ───── 输入中动画 ───── */
.typing-indicator {
  display: flex;
  gap: 4px;
  padding: 4px 0;
}

.typing-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: var(--theme-color-light, #fca5b9);
  animation: typing-bounce 1.4s ease-in-out infinite;
}

.typing-dot:nth-child(2) {
  animation-delay: 0.2s;
}

.typing-dot:nth-child(3) {
  animation-delay: 0.4s;
}

@keyframes typing-bounce {
  0%,
  60%,
  100% {
    transform: translateY(0);
  }
  30% {
    transform: translateY(-6px);
  }
}

/* ───── 消息输入区域 ───── */
.chat-input-area {
  display: flex;
  flex-shrink: 0;
  padding: 0 12px 8px;
}

.chat-input {
  width: 100%;
  height: 36px;
  padding: 0 16px;
  border: 1.5px solid rgba(139, 30, 63, 0.1);
  background: rgba(255, 255, 255, 0.5);
  backdrop-filter: blur(4px);
  font-size: 13px;
  color: #6f2b43;
  outline: none;
  transition: all 0.25s ease;
  box-sizing: border-box;
  font-family: inherit;
  border-radius: 999px;
}

.chat-input:focus {
  border-color: var(--theme-color-light, #fca5b9);
  background: rgba(255, 255, 255, 0.6);
  box-shadow: 0 0 12px rgba(252, 142, 173, 0.15);
}

.chat-input:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

.chat-input::placeholder {
  color: #c0a0ae;
}

/* ───── 底部快捷工具栏 ───── */
.bottom-toolbar {
  height: 44px;
  min-height: 44px;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 12px;
  border-top: 1px solid rgba(139, 30, 63, 0.06);
}

.toolbar-left {
  display: flex;
  align-items: center;
  gap: 2px;
}

.tool-icon-btn {
  width: 32px;
  height: 32px;
  border: none;
  background: transparent;
  color: #9a6275;
  border-radius: 8px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 15px;
  transition: all 0.2s ease;
}

.tool-icon-btn:hover {
  color: var(--theme-color, #fc8ead);
  background: rgba(252, 142, 173, 0.1);
}

.toolbar-right {
  display: flex;
  align-items: center;
}

.send-btn {
  width: 32px;
  height: 32px;
  border: none;
  background: var(--theme-color, #fc8ead);
  color: white;
  border-radius: 50%;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 15px;
  box-shadow: 0 2px 8px rgba(251, 114, 153, 0.25);
  transition: all 0.25s ease;
}

.send-btn:hover:not(:disabled) {
  box-shadow: 0 4px 14px rgba(251, 114, 153, 0.35);
  transform: scale(1.05);
}

.send-btn:disabled {
  opacity: 0.45;
  cursor: not-allowed;
  transform: none;
  box-shadow: none;
}
</style>
