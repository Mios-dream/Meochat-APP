<template>
  <div id="background-container" class="slide-in">
    <div id="live2d-container">
      <AssistantTips :is-active="isTipsActive" font-size="20px">
        {{ currentTip }}
      </AssistantTips>

      <canvas id="l2d-canvas"></canvas>
      <LoadingProgress :progress="loadingProgress" />
    </div>
    <div id="chat-button" @click="switchChatBox">
      <font-awesome-icon icon="fa-solid fa-comments" />
    </div>

    <div id="chatBox" :class="{ 'slide-up': isVisible }">
      <input
        id="chatBoxInput"
        type="text"
        v-model="inputValue"
        @keyup.enter="handleSubmit"
        ref="inputRef"
        :disabled="loading"
        placeholder="输入消息..."
      />
      <div id="role-image"></div>
      <button id="message-icon" @click="handleSubmit" :disabled="loading">
        <font-awesome-icon :icon="loading ? 'spinner' : 'paper-plane'" :spin="loading" />
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, Ref } from 'vue'
import { ChatService } from '../utils/ChatService'
import { Live2DManager } from '../utils/Live2dManager'
import AssistantTips from '../components/AssistantTips.vue'
import LoadingProgress from '../components/LoadingProgress.vue'
import Config from '../config/config'

// 加载进度
const loadingProgress = ref(0)
// 消息是否显示
const isTipsActive: Ref<boolean> = ref(false)
// 当前消息
const currentTip: Ref<string> = ref('')
// 对话框是否显示
const isVisible = ref(false)
const inputValue = ref('') // 👈 绑定输入框的值
const loading = ref(false) // 👈 加载状态

// 组件实例
const live2DManager = Live2DManager.getInstance()
const chatService = ChatService.getInstance()

live2DManager.focus_timeout_ms = 500

onMounted(async () => {
  // 模拟加载进度
  const progressInterval = setInterval(() => {
    if (loadingProgress.value < 90) {
      loadingProgress.value += 10
    } else {
      clearInterval(progressInterval)
    }
  }, 50)

  try {
    // 初始化Live2D模型
    await live2DManager.init('l2d-canvas', '/public/兔绒dlc/兔绒dlc.model3.json')

    live2DManager.initBaseListeners()

    live2DManager.setLocked(true)

    loadingProgress.value = 100

    // 隐藏加载进度
    setTimeout(() => {
      const progressElement = document.getElementById('loading-progress')

      if (progressElement) {
        progressElement.classList.add('fade-out')
        setTimeout(() => {
          if (progressElement) {
            progressElement.style.display = 'none'
          }
        }, 500)
      }
    }, 500)
  } catch (error) {
    console.error('Failed to load Live2D model:', error)
  }
})

onUnmounted(() => {
  live2DManager.destroy()
})

async function handleSubmit() {
  // 1️⃣ 验证：检查输入是否为空或正在加载
  if (!inputValue.value.trim() || loading.value) {
    console.log('输入为空或正在加载中')
    return
  }

  // 2️⃣ 获取输入内容并清空输入框
  const message = inputValue.value.trim()
  console.log('📤 发送消息:', message)

  inputValue.value = '' // 立即清空输入框
  loading.value = true // 设置加载状态

  try {
    window.api.ipcRenderer.send('chat-box:send-message', { text: message })
    // 设置超时定时器，超过20秒后强制取消加载状态
    setTimeout(() => {
      loading.value = false
    }, 20000)

    console.log('✅ 消息发送成功')
  } catch (error) {
    // 5️⃣ 错误处理
    console.error('❌ 发送消息失败:', error)

    // 如果失败，可以恢复输入内容让用户重试
    inputValue.value = message

    // 显示错误提示（使用 ipcRenderer 跨窗口发送给 assistant window）
    window.api.ipcRenderer.send('chat-box:send-temp-message', {
      text: '发送失败，请重试',
      timeout: 3000,
      priority: 1,
    })
  }
}

function switchChatBox() {
  const tabs = document.getElementById('tabs-container')
  if (isVisible.value) {
    isVisible.value = !isVisible.value
    tabs.style.opacity = '1'
  } else {
    isVisible.value = !isVisible.value
    tabs.style.opacity = '0'
  }
}
</script>

<style scoped>
#background-container {
  margin-top: 30px;
  /* background-color: #fff9f9; */
  background-color: #ffeef0;
  background-image: url('../assets/images/background_circle.png');
  /* background: linear-gradient(
    to bottom,
    #fff3f6 0%,
    #fff3f6 20%,
    #fff9f9 25%,
    #fff9f9 30%,
    #ffffff 30%,
    #ffffff 80%,
    #ffeef0 80%,
    #ffeef0 100%
  ); */
}

#live2d-container {
  height: 100vh;
  width: 100vw;
  position: relative;
}

#live2d-container.locked {
  cursor: default;
}

#l2d-canvas {
  width: 100%;
  height: 100%;
  display: block;
}

.message-form {
  position: absolute;
  top: 50%;
  z-index: 10;
}

#chat-button {
  position: absolute;
  bottom: 150px;
  right: 100px;
  width: 70px;
  height: 70px;
  border-radius: 100%;
  color: #fb7299;
  background-color: white;
  box-shadow: 2px 2px 10px #fb72995d;
  font-size: 30px;
  display: flex;
  justify-content: center;
  align-items: center;
  transition: transform 0.2s ease-in-out;
}

#chat-button:hover {
  transform: translateY(-3px);
}

#chatBox {
  bottom: 50px;
  left: 50%;
  position: absolute;
  width: 60%;
  height: 80px;
  max-width: 600px;
  max-height: 60px;
  transform: translateY(100px) translateX(-50%);
  opacity: 0;
  transition: all 0.5s ease-out;
  z-index: 1;
}

#chatBox.slide-up {
  transform: translateY(0) translateX(-50%);
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
}

#chatBoxInput:focus {
  background-color: white;
  outline: none;
  box-shadow: 0 0 30px #ffc0d663;
}

#chatBoxInput:disabled {
  cursor: not-allowed;
  opacity: 0.6;
}

#message-icon {
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
}

#message-icon:hover:not(:disabled) {
  background-color: #ffb0c6;
  transform: translateY(-50%) scale(1.05);
}

#message-icon:disabled {
  cursor: not-allowed;
  opacity: 0.6;
}
</style>
