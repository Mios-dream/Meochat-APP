<template>
  <div class="toolMenuContainer">
    <!-- 顶部标题栏：拖拽区域 + 窗口控制 -->
    <div class="title-bar">
      <div class="title-left">
        <div class="title-avatar" />
        <span class="title-greeting">工具栏</span>
      </div>
      <div class="title-right">
        <button class="title-btn" title="置顶" :class="{ pinned: isPinned }" @click="togglePin">
          <font-awesome-icon icon="thumbtack" />
        </button>
        <button class="title-btn close-btn" title="关闭" @click="closeChatBox">
          <font-awesome-icon icon="xmark" />
        </button>
      </div>
    </div>

    <!-- 聊天消息区域：空间 > 260px 时显示历史记录，较小时自动留白 -->
    <div ref="messagesRef" class="chat-messages">
      <div class="chat-messages-body">
        <!-- 历史加载中 -->
        <div v-if="historyLoading" class="history-loading">
          <span class="loading-dot" />
          <span class="loading-dot" />
          <span class="loading-dot" />
          <span class="history-loading-text">加载历史记录...</span>
        </div>
        <template v-else-if="displayItems.length > 0">
          <template v-for="(item, idx) in displayItems" :key="idx">
            <ChatMessageItem
              v-if="item.kind === 'message'"
              :role="item.msg.role"
              :content="item.msg.content"
              :tool-calls="item.msg.tool_calls"
              :tool-call-id="item.msg.tool_call_id"
              :avatar-url="avatarUrl"
              :assistant-name="assistantName"
              :avatar-size="35"
            />
            <ChatMessageItem
              v-else
              role="assistant"
              :tools="item.tools"
              :reply-content="item.reply?.content"
              :avatar-url="avatarUrl"
              :assistant-name="assistantName"
              :avatar-size="35"
            />
          </template>
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
      <!-- 已选文件预览栏 -->
      <div v-if="selectedFiles.length > 0" class="file-preview-bar">
        <div v-for="(file, idx) in selectedFiles" :key="idx" class="file-preview-item">
          <font-awesome-icon :icon="getFileIcon(file.name)" class="file-preview-icon" />
          <span class="file-preview-name">{{ file.name }}</span>
          <button class="file-preview-remove" @click="removeFile(idx)">
            <font-awesome-icon icon="xmark" />
          </button>
        </div>
      </div>
      <textarea
        ref="inputRef"
        v-model="inputText"
        class="chat-input"
        placeholder="输入消息..."
        :disabled="loading"
        rows="1"
        @keydown.enter.prevent="handleSend"
        @input="autoResize"
      />
      <button
        v-if="loading"
        class="send-btn cancel-send-btn"
        title="取消回复"
        @click="handleCancel"
      >
        <font-awesome-icon icon="stop" />
      </button>
      <button v-else class="send-btn" :disabled="!inputText.trim()" @click="handleSend">
        <font-awesome-icon icon="paper-plane" />
      </button>
    </div>

    <!-- 底部快捷工具栏 -->
    <div class="bottom-toolbar">
      <div class="toolbar-left">
        <button class="tool-icon-btn" title="新建对话" @click="handleNewConversation">
          <font-awesome-icon icon="plus" />
        </button>
        <div class="toolbar-divider" />
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
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, nextTick, Ref } from 'vue'
import ChatMessageItem from '../components/ChatMessageItem.vue'
import type { MergedTool } from '../components/ToolCallGroupBlock.vue'
import { normalizeContent } from '../chat/contentNormalizer'
import type { ChatMessage } from '../chat/ChatManager'
import type { ContentPart } from '@shared/types/chat'
import { AssistantInfo } from '@shared/types/assistantTypes.js'
import { AssistantManager } from '@renderer/services/assistantManager.js'

const messagesRef = ref<HTMLElement | null>(null)
const inputRef = ref<HTMLTextAreaElement | null>(null)

const messages = ref<ChatMessage[]>([])
const historyLoading = ref(false)
const loading = ref(false)
const inputText = ref('')
const isPinned = ref(false)
const selectedFiles = ref<{ name: string; path: string }[]>([])
const currentAssistant: Ref<AssistantInfo | null> = ref(null)
const assistantManager = AssistantManager.getInstance()

let removeClearHistory: () => void = () => {}
let removeToolStatus: () => void = () => {}
let removeHistoryChanged: () => void = () => {}
let elapsedTimer: ReturnType<typeof setInterval> | null = null

/** 标准化消息列表中的 content 字段 */
function normalizeMessages(raw: ChatMessage[]): ChatMessage[] {
  return raw.map((msg) => ({
    ...msg,
    content: normalizeContent(msg.content) ?? []
  }))
}

/** 展示项：普通消息或合并后的工具组 */
interface DisplayMessage {
  kind: 'message'
  msg: ChatMessage
}

interface DisplayAssistantWithTools {
  kind: 'assistant_with_tools'
  tools: MergedTool[]
  /** 工具调用后的助手文字回复 */
  reply?: ChatMessage
}

type DisplayItem = DisplayMessage | DisplayAssistantWithTools

/** 从各种格式的消息 content 中提取纯文本 */
function getTextContent(content: ChatMessage['content']): string {
  if (!content) return ''
  if (typeof content === 'string') return content
  if (Array.isArray(content)) {
    return content
      .filter((p): p is Extract<typeof p, { type: 'text' }> => p.type === 'text')
      .map((p) => p.text)
      .join('')
  }
  return ''
}

const avatarUrl = computed(() => {
  if (currentAssistant.value?.avatar) {
    return 'app-resource://' + currentAssistant.value.avatar
  }
  return '../assets/images/assistant_avatar_small.png'
})

const assistantName = computed(() => currentAssistant.value?.name ?? '助手')

/** 预处理消息列表：将工具调用及其结果合并为工具组 */
const displayItems = computed<DisplayItem[]>(() => {
  const items: DisplayItem[] = []
  const skip = new Set<number>()
  const msgs = messages.value

  for (let i = 0; i < msgs.length; i++) {
    if (skip.has(i)) continue
    const msg = msgs[i]

    if (msg.role === 'assistant' && msg.tool_calls && msg.tool_calls.length > 0) {
      // 合并工具调用 + 后续匹配的工具结果
      const tools: MergedTool[] = msg.tool_calls.map((tc) => {
        for (let j = i + 1; j < msgs.length; j++) {
          if (msgs[j].role === 'tool' && msgs[j].tool_call_id === tc.id) {
            skip.add(j)
            return {
              id: tc.id,
              name: tc.function.name,
              args: tc.function.arguments,
              result: getTextContent(msgs[j].content)
            }
          }
        }
        return { id: tc.id, name: tc.function.name, args: tc.function.arguments }
      })
      // 查找后续的助手文字回复，合并到同一块
      let reply: ChatMessage | undefined
      for (let j = i + 1; j < msgs.length; j++) {
        if (skip.has(j)) continue
        if (msgs[j].role === 'assistant') {
          reply = msgs[j]
          skip.add(j)
          break
        }
      }
      items.push({ kind: 'assistant_with_tools', tools, reply })
    } else {
      // 未匹配到 tool_calls 的孤立 tool 消息也照常渲染
      items.push({ kind: 'message', msg })
    }
  }
  return items
})

/** 根据文件名获取对应的 FontAwesome 图标 */
function getFileIcon(fileName: string): string {
  const ext = fileName.split('.').pop()?.toLowerCase() ?? ''
  const imageExts = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'svg', 'ico']
  if (imageExts.includes(ext)) return 'image'
  return 'file'
}

/** 移除已选文件 */
function removeFile(idx: number): void {
  selectedFiles.value.splice(idx, 1)
}

/** 自动滚动聊天区域到底部 */
function scrollToBottom(): void {
  nextTick(() => {
    if (messagesRef.value) {
      messagesRef.value.scrollTop = messagesRef.value.scrollHeight
    }
  })
}

/** 发送消息（含文本和已选文件） */
async function handleSend(): Promise<void> {
  const text = inputText.value.trim()
  if ((!text || loading.value) && selectedFiles.value.length === 0) return

  // 构建附件列表
  const attachments = selectedFiles.value.map((f) => ({ name: f.name, path: f.path }))

  // 构建消息内容（含附件信息，用于乐观更新时直接显示）
  // 使用与历史记录同步同样的 marker 标记格式，确保 normalizeContent 正确解析
  let content: string | ContentPart[]
  if (attachments.length > 0) {
    const markers: string[] = []
    if (text) markers.push(text)
    const imgExts = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'svg', 'ico']
    for (const file of selectedFiles.value) {
      const ext = file.name.split('.').pop()?.toLowerCase() ?? ''
      if (imgExts.includes(ext)) {
        markers.push(`[图片: ${file.name}]`)
      } else {
        markers.push(`[文件: ${file.name}]`)
      }
    }
    content = normalizeContent(markers.join('\n')) ?? []
  } else {
    content = text || ''
  }

  // 乐观更新：立即显示用户消息
  messages.value.push({ role: 'user', content })
  inputText.value = ''
  selectedFiles.value = []
  scrollToBottom()

  // 重置输入框高度
  if (inputRef.value) {
    inputRef.value.style.height = 'auto'
  }

  loading.value = true
  try {
    const result = await window.api.chat.invokeChat({ text, attachments })
    if (result.error) {
      console.error('聊天请求失败:', result.error)
    }
  } catch (err) {
    console.error('聊天请求失败:', err)
  } finally {
    loading.value = false
  }
}

/** 取消当前回复 */
function handleCancel(): void {
  loading.value = false
  window.api.chat.cancelMessage({ text: '用户取消' })
}

/** textarea 自动伸缩高度 */
function autoResize(): void {
  const el = inputRef.value
  if (!el) return
  el.style.height = 'auto'
  el.style.height = `${Math.min(el.scrollHeight, 120)}px`
}

/** 新建对话：中断当前对话、清空本地历史并通知主进程同步清空 */
async function handleNewConversation(): Promise<void> {
  // 如果有进行中的回复，先取消
  if (loading.value) {
    window.api.chat.cancelMessage({ text: '用户取消' })
    loading.value = false
  }
  messages.value = []
  try {
    await window.api.chat.clearHistory()
  } catch (err) {
    console.warn('清空历史失败:', err)
  }
  nextTick(() => {
    if (inputRef.value) {
      inputRef.value.focus()
    }
  })
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

/** 截图：使用浏览器屏幕捕获 API 截图并复制到剪贴板 */
async function takeScreenshot(): Promise<void> {
  try {
    const stream = await navigator.mediaDevices.getDisplayMedia({ video: true })
    const video = document.createElement('video')
    video.srcObject = stream
    await video.play()

    const canvas = document.createElement('canvas')
    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    const ctx = canvas.getContext('2d')
    if (ctx) {
      ctx.drawImage(video, 0, 0)
    }
    stream.getTracks().forEach((t) => t.stop())

    // 将截图复制到剪贴板
    canvas.toBlob(async (blob) => {
      if (blob) {
        try {
          await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })])
          window.api.notify?.({ title: '截图已复制到剪贴板', body: '' })
        } catch {
          console.warn('复制截图到剪贴板失败')
        }
      }
    })
  } catch (err) {
    console.error('截图失败:', err)
  }
}

/** 文件选择结果类型 */
interface SelectFileResult {
  success: boolean
  filePath?: string
  filePaths?: string[]
  error?: string
}

/** 上传文件：通过 IPC 打开系统文件选择对话框 */
async function uploadFile(): Promise<void> {
  try {
    const result = (await window.api.ipcRenderer.invoke('tool:select-file', {
      title: '选择文件',
      filters: [{ name: '所有文件', extensions: ['*'] }]
    })) as SelectFileResult
    if (result?.success && result.filePath) {
      const name = result.filePath.split('\\').pop()?.split('/').pop() ?? result.filePath
      selectedFiles.value.push({ name, path: result.filePath })
    }
  } catch (err) {
    console.error('选择文件失败:', err)
  }
}

/** 上传图片：通过 IPC 打开系统文件选择对话框（筛选图片格式） */
async function uploadImage(): Promise<void> {
  try {
    const result = (await window.api.ipcRenderer.invoke('tool:select-file', {
      title: '选择图片',
      filters: [{ name: '图片文件', extensions: ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp'] }]
    })) as SelectFileResult
    if (result?.success && result.filePath) {
      const name = result.filePath.split('\\').pop()?.split('/').pop() ?? result.filePath
      selectedFiles.value.push({ name, path: result.filePath })
    }
  } catch (err) {
    console.error('选择图片失败:', err)
  }
}

onMounted(async () => {
  currentAssistant.value = await assistantManager.getCurrentAssistant()
  // 从主进程获取聊天历史
  historyLoading.value = true
  try {
    const history = normalizeMessages(await window.api.chat.getHistory())
    if (history.length > 0) {
      messages.value = history
      scrollToBottom()
    }
  } catch (error) {
    console.warn('获取聊天历史失败:', error)
  } finally {
    historyLoading.value = false
  }

  // 监听清空历史事件（由其他窗口发起）
  removeClearHistory = window.api.chat.onClearHistory(() => {
    messages.value = []
  })

  // 监听聊天历史变更，重新从主进程拉取最新数据
  removeHistoryChanged = window.api.chat.onHistoryChanged(async () => {
    try {
      const history = normalizeMessages(await window.api.chat.getHistory())
      messages.value = history
      scrollToBottom()
    } catch (error) {
      console.warn('同步聊天历史失败:', error)
    }
  })
})

onUnmounted(() => {
  removeClearHistory()
  removeHistoryChanged()
  removeToolStatus()
  if (elapsedTimer) {
    clearInterval(elapsedTimer)
    elapsedTimer = null
  }
})
</script>

<style scoped>
.toolMenuContainer {
  /* width: 100vw;
  height: 100vh; */
  position: fixed;
  inset: 2px;
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  outline: none;
  border-radius: 14px;
  background: linear-gradient(155deg, rgba(255, 255, 255, 0.93) 0%, rgba(255, 255, 255, 0.9) 100%);
  backdrop-filter: blur(14px);
  border: 2px solid var(--theme-color-shadow);
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
  flex-shrink: 0;
  border-bottom: 1px solid rgba(139, 30, 63, 0.06);
  -webkit-app-region: drag;
  app-region: drag;
}

.title-left {
  display: flex;
  align-items: center;
  gap: 5px;
  cursor: grab;
}

.title-avatar {
  width: 30px;
  height: 30px;
  background-image: url('../assets/images/momona_icon.png');
  background-size: cover;
  background-position: center;
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
  -webkit-app-region: no-drag;
  app-region: no-drag;
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

/* 消息渲染由 ChatMessageItem 组件接管 */

/* ───── 历史加载中 ───── */
.history-loading {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 20px;
}

.history-loading-text {
  font-size: 12px;
  color: #c0a0ae;
  margin-left: 4px;
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

/* ───── 已选文件预览栏 ───── */
.file-preview-bar {
  position: absolute;
  top: -30px;
  left: 0;
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  padding: 2px 12px 6px;
  flex-shrink: 0;
}

.file-preview-item {
  display: flex;
  align-items: center;
  gap: 5px;
  padding: 3px 8px;
  background: rgba(255, 255, 255, 0.7);
  border: 1px solid rgba(139, 30, 63, 0.08);
  border-radius: 6px;
  font-size: 12px;
  color: #6f2b43;
  max-width: 200px;
}

.file-preview-icon {
  flex-shrink: 0;
  color: var(--theme-color, #fc8ead);
  font-size: 13px;
}

.file-preview-name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.file-preview-remove {
  flex-shrink: 0;
  width: 16px;
  height: 16px;
  border: none;
  background: transparent;
  color: #c0a0ae;
  border-radius: 50%;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 10px;
  transition: all 0.2s ease;
  padding: 0;
}

.file-preview-remove:hover {
  background: rgba(233, 113, 104, 0.14);
  color: #e97168;
}

/* ───── 消息输入区域 ───── */
.chat-input-area {
  position: relative;
  display: flex;
  flex-shrink: 0;
  align-items: flex-end;
  gap: 8px;
  padding: 0 12px 8px;
}

.chat-input {
  flex: 1;
  min-height: 36px;
  max-height: 120px;
  padding: 8px 14px;
  border: 2px solid rgba(139, 30, 63, 0.1);
  background: rgba(255, 255, 255, 0.55);
  backdrop-filter: blur(4px);
  font-size: 12px;
  line-height: 1.5;
  color: #6f2b43;
  outline: none;
  transition: all 0.25s ease;
  box-sizing: border-box;
  font-family: inherit;
  border-radius: 12px;
  resize: none;
  overflow-y: hidden;
}

.chat-input:focus {
  border-color: var(--theme-color-light);
  background: rgba(255, 255, 255, 0.7);
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

/* 工具栏分隔线 */
.toolbar-divider {
  width: 1px;
  height: 18px;
  background: rgba(139, 30, 63, 0.1);
  margin: 0 4px;
  flex-shrink: 0;
}

.send-btn {
  flex-shrink: 0;
  width: 36px;
  height: 36px;
  border: none;
  background: var(--theme-color, #fc8ead);
  color: white;
  border-radius: 50%;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 14px;
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

/* 取消发送按钮：加载中替换发送按钮 */
.cancel-send-btn {
  background: var(--theme-color);
  box-shadow: 0 2px 8px rgba(233, 113, 104, 0.3);
}

.cancel-send-btn:hover {
  background: var(--theme-color);
  box-shadow: 0 4px 14px rgba(233, 113, 104, 0.4);
  transform: scale(1.05);
}

/* ───── 工具调用状态栏 ───── */
.tool-status-bar {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  margin: 0 12px 4px;
  background: rgba(255, 192, 214, 0.12);
  border: 1px solid rgba(255, 192, 214, 0.3);
  border-radius: 8px;
  font-size: 12px;
  color: #c06a8a;
  flex-shrink: 0;
}

.tool-status-dot {
  flex-shrink: 0;
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: #ffa0c0;
  animation: tool-dot-pulse 1.2s ease-in-out infinite;
}

.tool-status-text {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

@keyframes tool-dot-pulse {
  0%,
  100% {
    opacity: 0.4;
    transform: scale(0.8);
  }
  50% {
    opacity: 1;
    transform: scale(1.2);
  }
}

/* 工具状态栏过渡 */
.tool-fade-enter-active,
.tool-fade-leave-active {
  transition: all 0.3s ease;
}

.tool-fade-enter-from,
.tool-fade-leave-to {
  opacity: 0;
  transform: translateY(-4px);
}
</style>
