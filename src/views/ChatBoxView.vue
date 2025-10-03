<template>
  <div class="w-screen h-screen flex items-center justify-center mg-20">
    <div id="chatBox" :class="{ 'slide-up': isVisible }">
      <input
        id="chatBoxInput"
        type="text"
        v-model="inputValue"
        @blur="hideChatBox"
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

<style>
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

<script setup>
import { ref, onMounted, onUnmounted } from 'vue'
import { ChatService } from '../utils/ChatService'

const isVisible = ref(false)
const inputRef = ref(null)
const inputValue = ref('') // 👈 绑定输入框的值
const loading = ref(false) // 👈 加载状态
let isFirst = true

// 👇 获取 ChatService 单例（这是关键！）
const chatService = ChatService.getInstance()

// 监听窗口可见性变化
function handleVisibilityChange() {
  if (document.visibilityState === 'visible') {
    isVisible.value = true
    setTimeout(() => {
      if (inputRef.value) {
        inputRef.value.focus()
      }
    }, 100)
  } else {
    isVisible.value = false
  }
}

// 👇 【核心函数】提交消息的完整流程
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
    // 3️⃣ 调用 ChatService 发送消息
    // 这个方法会自动：
    //   - 请求后端 API (http://127.0.0.1:8001/api/chat_v2)
    //   - 处理返回的流式数据
    //   - 将文本显示到 AssistantView 的 tips 中
    //   - 自动播放返回的音频
    await chatService.sendMessage(message)

    console.log('✅ 消息发送成功')

    // 4️⃣ 可选：发送成功后的其他操作
    // 例如：关闭聊天框、播放提示音等
  } catch (error) {
    // 5️⃣ 错误处理
    console.error('❌ 发送消息失败:', error)

    // 如果失败，可以恢复输入内容让用户重试
    inputValue.value = message

    // 显示错误提示（使用 ipcRenderer 跨窗口发送给 assistant window）
    if (window.assistantAPI?.ipcRenderer) {
      // 🐛 FIX: Directly send IPC from chatBox to main, then main relays to assistant
      window.assistantAPI.ipcRenderer.send('chat-box:send-temp-message', {
        text: '发送失败，请重试',
        timeout: 3000,
        priority: 1,
      })
    } else {
      console.warn('IPC not available, cannot send temp message.')
      chatService.showTempMessage('发送失败，请重试', 3000, 1) // Fallback for testing/dev if IPC is not set up
    }
  } finally {
    // 6️⃣ 无论成功失败，都要重置加载状态
    loading.value = false

    // 重新聚焦输入框，方便继续输入
    setTimeout(() => {
      if (inputRef.value) {
        inputRef.value.focus()
      }
    }, 100)
  }
}

function hideChatBox() {
  if (isFirst) {
    isFirst = false
    return
  }

  // 先播放消失动画
  isVisible.value = false

  // 等待动画完成后再隐藏窗口
  setTimeout(() => {
    if (window.chatBoxAPI) {
      window.chatBoxAPI.hideChatBox()
    }
  }, 500)
}

onMounted(() => {
  // 监听页面可见性变化
  document.addEventListener('visibilitychange', handleVisibilityChange)

  // 初始显示动画
  setTimeout(() => {
    isVisible.value = true
    if (inputRef.value) {
      inputRef.value.focus()
    }
  }, 100)
})

onUnmounted(() => {
  document.removeEventListener('visibilitychange', handleVisibilityChange)
})

// 👇 【可选】暴露方法给外部调用（用于调试或其他组件调用）
defineExpose({
  sendMessage: handleSubmit,
  getChatHistory: () => chatService.getChatHistory(),
  clearHistory: () => chatService.clearChatHistory(),
})
</script>
