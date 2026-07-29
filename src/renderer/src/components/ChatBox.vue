<template>
  <div id="chatBox" :class="{ 'slide-up': props.isVisible }">
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
import { onUnmounted, ref, watch } from 'vue'
import { VoicePipelineService } from '../services/VoicePipelineService'
import { useConfigStore } from '../stores/useConfigStore'
import { storeToRefs } from 'pinia'

const configStore = useConfigStore()
const { config } = storeToRefs(configStore)

// 定义组件的props
const props = defineProps<{
  isVisible: boolean
  loading: boolean
}>()

/** 向父组件（AssistantSpaceView）发送消息和取消事件，避免经过 IPC 广播 */
const emit = defineEmits<{
  send: [text: string]
  cancel: []
}>()

// 输入框的值
const inputValue = ref('')
// 内部的加载状态，控制按钮显示与输入禁用
const isLoading = ref(false)

/** 语音发送后暂存文本，回复完成后才清除 */
let pendingVoiceText = ''

/** 当父组件通过 prop 同步 loading 为 false 时，重置内部加载状态并清除语音暂存文本 */
watch(
  () => props.loading,
  (newVal) => {
    if (newVal === false && isLoading.value) {
      isLoading.value = false
      if (pendingVoiceText) {
        inputValue.value = ''
        pendingVoiceText = ''
      }
    }
  }
)
// 语音转写状态
const isRecording = ref(false)

const voicePipeline = VoicePipelineService.getInstance()

/**
 * 处理提交消息
 */
async function handleSubmit(): Promise<void> {
  if (!inputValue.value.trim() || isLoading.value) {
    return
  }

  const message = inputValue.value.trim()
  // 语音发送：输入框保持显示，等回复完成后清除
  // 手动输入：立即清除
  if (!pendingVoiceText) {
    inputValue.value = ''
  }
  isLoading.value = true
  emit('send', message)
}

/**
 * 处理取消当前对话
 */
function handleCancel(): void {
  isLoading.value = false
  pendingVoiceText = ''
  emit('cancel')
}

async function handleVoiceInput(): Promise<void> {
  if (isRecording.value || isLoading.value) return

  isRecording.value = true
  pendingVoiceText = ''
  inputValue.value = ''
  try {
    const text = await voicePipeline.transcribeOnce(config.value.baseUrl, 10000, (segment) => {
      inputValue.value += segment
    })
    if (text) {
      pendingVoiceText = text
      handleSubmit()
    }
  } catch (error) {
    console.error('语音识别失败:', error)
  } finally {
    isRecording.value = false
  }
}

// 监听语音唤醒事件
const removeWakeword = window.api.chat.onWakewordDetected((wakeword) => {
  isLoading.value = true
  emit('send', wakeword as string)
})

onUnmounted(() => {
  removeWakeword()
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
