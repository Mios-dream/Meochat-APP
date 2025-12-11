<template>
  <div id="chatBox" :class="{ 'slide-up': isVisible }">
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

    <button v-if="inputValue.trim()" id="message-icon" :disabled="loading" @click="handleSubmit">
      <font-awesome-icon :icon="loading ? 'spinner' : 'paper-plane'" :spin="loading" />
    </button>
    <button v-else id="voice-icon" :disabled="loading" @click="handleVoiceInput">
      <font-awesome-icon
        :icon="loading ? 'spinner' : isRecording ? 'stop' : 'microphone'"
        :spin="loading"
      />
    </button>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { MicrophoneManager } from '../services/MicrophoneManager'
import { useConfigStore } from '../stores/useConfigStore'
import { storeToRefs } from 'pinia'

const configStore = useConfigStore()
const { config } = storeToRefs(configStore)

// 定义组件的props
defineProps<{
  isVisible: boolean
}>()

// 输入框的值
const inputValue = ref('')
// 加载状态
const loading = ref(false)
// 录音状态
const isRecording = ref(false)

// 创建麦克风管理器实例
const micManager = new MicrophoneManager()

// 设置识别结果回调
micManager.setRecognitionCallback((data: string) => {
  inputValue.value = data
  // 停止录音
  micManager.stopRecording()
  // 提交消息
  handleSubmit()
})

const wsUrl = computed(() => `ws://${config.value.baseUrl}/api/asr_ws`)

/**
 * 停止录音
 */
function stopRecording(): void {
  // 停止录音并断开连接
  micManager.stopRecording()
  micManager.disconnect()
  isRecording.value = false
  console.log('停止录音')
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
  loading.value = true // 设置加载状态
  window.api.ipcRenderer.send('chat-box:send-message', { text: message })
}

async function handleVoiceInput(): Promise<void> {
  if (isRecording.value) {
    stopRecording()
  } else {
    // 连接到 WebSocket 服务
    micManager.connectToServer(wsUrl.value)
    isRecording.value = true
    // 开始录音
    micManager
      .startRecording()
      .then(() => {
        console.log('开始录音')
      })
      .catch((error) => {
        console.error('录音启动失败:', error)
      })
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
  window.api.ipcRenderer.on('chat-box:status-updated', (_, data) => {
    const oldLoading = loading.value
    loading.value = data.loading
    inputValue.value = '' // 立即清空输入框

    // 如果加载状态从true变为false，并且当前是语音聊天模式，则自动开始下一次录音
    if (oldLoading && !loading.value && isRecording.value) {
      setTimeout(() => {
        if (isRecording.value) {
          micManager.startRecording()
        }
      }, 1000) // 延迟1秒开始下一次录音，给用户准备时间
    }
  })
})

onUnmounted(() => {
  // 清理事件监听
  window.api.ipcRenderer.removeAllListeners('chat-box:status-updated')
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
  border: 3px solid #ffc0d6;
  border-radius: 100px;
  font-size: larger;
  padding: 25px;
  padding-right: 90px;
  box-shadow: 0 0 10px #ffc0d69c;
  transition: all 0.3s ease;
}

#chatBoxInput:focus {
  background-color: white;
  outline: none;
  box-shadow: 0 0 30px #ffc0d663;
  transition: all 0.3s ease;
}

#chatBoxInput:disabled {
  cursor: not-allowed;
  opacity: 0.6;
}

#message-icon,
#voice-icon {
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
#voice-icon:hover:not(:disabled) {
  background-color: #ffb0c6;
  transform: translateY(-50%) scale(1.05);
}

#message-icon:disabled,
#voice-icon:disabled {
  cursor: not-allowed;
  opacity: 0.6;
}
</style>
