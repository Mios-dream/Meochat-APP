<template>
  <div id="chatBox" :class="{ 'slide-up': isVisible }">
    <!-- 工具调用状态栏：显示当前 LLM 正在调用的工具 -->
    <Transition name="tool-status-fade">
      <div v-if="toolStatus.active" id="toolStatusBar">
        <!-- <div v-if="true" id="toolStatusBar"> -->
        <span class="tool-status-dot" />
        <span class="tool-status-text">
          {{ formatToolStatusText }}
        </span>
      </div>
    </Transition>

    <input
      id="chatBoxInput"
      ref="inputRef"
      v-model="inputValue"
      type="text"
      placeholder="输入消息..."
      :disabled="loading"
      @keyup.enter="handleSubmit"
    />
    <div id="role-image"></div>

    <!-- 加载中：显示取消按钮 -->
    <button v-if="loading" id="cancel-icon" @click="handleCancel">
      <font-awesome-icon icon="stop" />
    </button>
    <!-- 有输入内容且非加载中：显示发送按钮 -->
    <button v-else-if="inputValue.trim()" id="message-icon" @click="handleSubmit">
      <font-awesome-icon icon="paper-plane" />
    </button>
    <!-- 无输入内容且非加载中：显示语音按钮 -->
    <button v-else id="voice-icon" @click="handleVoiceInput">
      <font-awesome-icon :icon="isRecording ? 'stop' : 'microphone'" />
    </button>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { MicrophoneManager } from '../services/MicrophoneManager'
import { useConfigStore } from '../stores/useConfigStore'
import { storeToRefs } from 'pinia'
import type { ToolStatusData } from '../chat/ChatManager'

const configStore = useConfigStore()
const { config } = storeToRefs(configStore)

// 定义组件的props
defineProps<{
  isVisible: boolean
}>()

/** 向父组件（AssistantSpaceView）发送消息和取消事件，避免经过 IPC 广播 */
const emit = defineEmits<{
  send: [text: string]
  cancel: []
}>()

// 输入框的值
const inputValue = ref('')
// 加载状态
const loading = ref(false)
// 录音状态
const isRecording = ref(false)
// 工具调用状态（由 Assistant 窗口通过 IPC 广播）
const toolStatus = ref<ToolStatusData>({ active: false, tools: [] })
/** 本地计时器：自最近一次 IPC 更新后累计的秒数，用于驱动耗时文本实时刷新。 */
const elapsedTick = ref(0)
/** 计时器句柄，工具不再活跃时清理。 */
let elapsedTimer: ReturnType<typeof setInterval> | null = null

// 工具状态文本格式化（elapsedTick 变化时自动重新计算）
const formatToolStatusText = computed(() => {
  if (toolStatus.value.tools.length === 0) return ''
  const names = toolStatus.value.tools.map((t) => {
    const totalElapsed = t.elapsed + elapsedTick.value
    return `${t.tool_name} (${totalElapsed.toFixed(1)}s)`
  })
  return `正在调用工具: ${names.join(', ')}`
})
const voiceIdleTimeoutMs = 10000
let voiceIdleTimer: ReturnType<typeof setTimeout> | null = null

// 创建麦克风管理器实例
const micManager = MicrophoneManager.getInstance()

// 设置识别结果回调
micManager.setRecognitionCallback((data: string) => {
  const recognizedText = data.trim()
  if (!recognizedText) {
    return
  }

  clearVoiceIdleTimer()
  inputValue.value = recognizedText
  // 停止录音
  micManager.stopRecording()
  // 提交消息
  handleSubmit()
})

const wsUrl = computed(() => {
  const base = config.value.baseUrl.replace(/^http/, 'ws')
  return `${base}/api/asr_ws`
})

/**
 * 停止录音
 */
function stopRecording(): void {
  clearVoiceIdleTimer()
  // 停止录音并断开连接
  micManager.stopRecording()
  micManager.disconnect()
  isRecording.value = false
  console.log('停止录音')
}

function clearVoiceIdleTimer(): void {
  if (voiceIdleTimer) {
    clearTimeout(voiceIdleTimer)
    voiceIdleTimer = null
  }
}

function scheduleVoiceIdleTimeout(): void {
  clearVoiceIdleTimer()
  voiceIdleTimer = setTimeout(() => {
    if (!isRecording.value || loading.value) {
      return
    }

    stopRecording()
  }, voiceIdleTimeoutMs)
}

/**
 * 处理提交消息
 */
async function handleSubmit(): Promise<void> {
  // 1️⃣ 验证：检查输入是否为空或正在加载
  if (!inputValue.value.trim() || loading.value) {
    return
  }

  // 2️⃣ 获取输入内容并清空输入框
  const message = inputValue.value.trim()
  inputValue.value = '' // 立即清空输入框
  loading.value = true // 设置加载状态
  emit('send', message)
}

/**
 * 处理取消当前对话
 */
function handleCancel(): void {
  loading.value = false
  emit('cancel')
}

async function handleVoiceInput(): Promise<void> {
  if (isRecording.value) {
    stopRecording()
  } else {
    await startVoiceRecording()
  }
}

async function startVoiceRecording(): Promise<void> {
  if (loading.value || isRecording.value) {
    return
  }

  micManager.connectToServer(wsUrl.value)
  isRecording.value = true

  try {
    await micManager.startRecording()
    scheduleVoiceIdleTimeout()
  } catch (error) {
    isRecording.value = false
    clearVoiceIdleTimer()
    micManager.disconnect()
    console.error('录音启动失败:', error)
  }
}

onMounted(() => {
  // 组件挂载时，检查麦克风权限
  micManager.getPermissionStatus().then((status) => {
    if (!status) {
      console.error('麦克风权限未授予')
    }
  })
  // 监听来自AssistantView的状态更新
  window.api.ipcRenderer.on('chat-box:status-updated', (data) => {
    const statusData = data as { loading: boolean }
    const oldLoading = loading.value
    loading.value = statusData.loading
    inputValue.value = '' // 立即清空输入框

    // 如果加载状态从true变为false，并且当前是语音聊天模式，则自动开始下一次录音
    if (oldLoading && !loading.value && isRecording.value) {
      setTimeout(() => {
        if (isRecording.value) {
          micManager
            .startRecording()
            .then(() => {
              scheduleVoiceIdleTimeout()
            })
            .catch((error) => {
              stopRecording()
              console.error('自动开始录音失败:', error)
            })
        }
      }, 1000) // 延迟1秒开始下一次录音，给用户准备时间
    }
  })
  // 监听语音唤醒事件
  window.api.ipcRenderer.on('chat-box:wakeword-detected', (wakeword) => {
    loading.value = true
    emit('send', wakeword as string)
  })
  // 监听工具状态更新事件（由 Assistant 窗口通过 IPC 广播）
  window.api.ipcRenderer.on('chat-box:tool-status-updated', (data) => {
    const toolData = data as ToolStatusData
    toolStatus.value = toolData
    elapsedTick.value = 0

    // 根据活跃状态启停本地计时器，驱动耗时文本每秒刷新
    if (elapsedTimer) {
      clearInterval(elapsedTimer)
      elapsedTimer = null
    }
    if (toolData.active) {
      elapsedTimer = setInterval(() => {
        elapsedTick.value++
      }, 1000)
    }
  })
})

onUnmounted(() => {
  // 清理事件监听
  window.api.ipcRenderer.removeAllListeners('chat-box:status-updated')
  window.api.ipcRenderer.removeAllListeners('chat-box:wakeword-detected')
  window.api.ipcRenderer.removeAllListeners('chat-box:tool-status-updated')
  if (elapsedTimer) {
    clearInterval(elapsedTimer)
    elapsedTimer = null
  }
  clearVoiceIdleTimer()
  // 停止录音
  micManager.stopRecording()
})
</script>

<style scoped>
#chatBox {
  width: 80%;
  height: 50%;
  max-width: 600px;
  max-height: 60px;
  position: relative;
  transform: translateY(100px);
  opacity: 0;
  transition: all 0.5s ease-out;
}

#chatBox.slide-up {
  transform: translateY(0);
  opacity: 1;
}

#role-image {
  position: absolute;
  height: 90px;
  width: 90px;
  top: -75px;
  right: 30px;
  background-image: url('../assets/images/elysia.png');
  background-size: cover;
  z-index: -1;
}

#chatBoxInput {
  width: 100%;
  height: 100%;
  background-color: rgba(255, 255, 255, 0.8);
  border: 3px solid var(--theme-color-shadow);
  border-radius: 100px;
  font-size: larger;
  padding: 25px;
  padding-right: 90px;
  box-shadow: 0 0 10px #ffc0d69c;
  transition: all 0.3s ease;
  color: #6f2b43;
}

#chatBoxInput:focus {
  background-color: white;
  border-color: var(--theme-color-light);
  outline: none;
  box-shadow: 0 0 30px #ffc0d663;
  transition: all 0.3s ease;
}

#chatBoxInput:disabled {
  cursor: not-allowed;
  opacity: 0.6;
}

#message-icon,
#voice-icon,
#cancel-icon {
  color: white;
  background-color: #ffc0d6;
  width: 50px;
  height: 50px;
  border-radius: 100%;
  position: absolute;
  right: 7px;
  top: 50%;
  transform: translateY(-50%);
  border: none;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.3s ease;
  font-size: 16px;
}
#message-icon:hover:not(:disabled),
#voice-icon:hover:not(:disabled),
#cancel-icon:hover {
  transform: translateY(-50%) scale(1.05);
}

#message-icon:hover:not(:disabled),
#voice-icon:hover:not(:disabled) {
  background-color: #ffb0c6;
}

#message-icon:disabled,
#voice-icon:disabled {
  cursor: not-allowed;
  opacity: 0.6;
}

/* ───── 工具调用状态栏 ───── */
#toolStatusBar {
  position: absolute;
  top: -35px;
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  width: 80%;
  align-items: center;
  gap: 8px;
  padding: 8px 20px;
  background: rgba(255, 192, 214, 0.15);
  border: 1px solid rgba(255, 192, 214, 0.4);
  border-radius: 20px 20px 0px 0px;
  font-size: 13px;
  color: #c06a8a;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 100%;
  backdrop-filter: blur(4px);
  z-index: -1;
}

.tool-status-dot {
  flex-shrink: 0;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #ffa0c0;
  animation: tool-dot-pulse 1.2s ease-in-out infinite;
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

.tool-status-text {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* 工具状态栏出现/消失过渡 */
.tool-status-fade-enter-active,
.tool-status-fade-leave-active {
  transition: all 0.3s ease;
}

.tool-status-fade-enter-from,
.tool-status-fade-leave-to {
  opacity: 0;
  transform: translateY(-8px);
}
</style>
