<template>
  <div id="live2d-container">
    <div id="assistant-tips"></div>
  </div>
</template>

<style>
html,
body {
  overflow: hidden;
  margin: 0;
  background: transparent;
}

#live2d-container {
  height: 100vh;
  width: 100vw;
  position: relative;
}

#assistant-tips {
  animation: shake 50s ease-in-out 5s infinite;
  background-color: rgba(236, 217, 188, 0.5);
  border: 1px solid rgba(224, 186, 140, 0.62);
  border-radius: 12px;
  box-shadow: 0 3px 15px 2px rgba(191, 158, 118, 0.2);
  font-size: 14px;
  line-height: 24px;
  margin: 20px 20px;
  min-height: 70px;
  opacity: 0;
  overflow: hidden;
  padding: 5px 10px;
  position: absolute;
  text-overflow: ellipsis;
  transition: opacity 1s;
  width: 250px;
  word-break: break-all;
  z-index: 10;
}

#assistant-tips.active {
  opacity: 1 !important;
  transition: opacity 0.2s;
}

#assistant-tips .fa-lg {
  color: #0099cc;
}

.message-form {
  position: absolute;
  top: 50%;
  z-index: 10;
}

@keyframes shake {
  2% {
    transform: translate(0.5px, -1.5px) rotate(-0.5deg);
  }

  4% {
    transform: translate(0.5px, 1.5px) rotate(1.5deg);
  }

  6% {
    transform: translate(1.5px, 1.5px) rotate(1.5deg);
  }

  8% {
    transform: translate(2.5px, 1.5px) rotate(0.5deg);
  }

  10% {
    transform: translate(0.5px, 2.5px) rotate(0.5deg);
  }

  12% {
    transform: translate(1.5px, 1.5px) rotate(0.5deg);
  }

  14% {
    transform: translate(0.5px, 0.5px) rotate(0.5deg);
  }

  16% {
    transform: translate(-1.5px, -0.5px) rotate(1.5deg);
  }

  18% {
    transform: translate(0.5px, 0.5px) rotate(1.5deg);
  }

  20% {
    transform: translate(2.5px, 2.5px) rotate(1.5deg);
  }

  22% {
    transform: translate(0.5px, -1.5px) rotate(1.5deg);
  }

  24% {
    transform: translate(-1.5px, 1.5px) rotate(-0.5deg);
  }

  26% {
    transform: translate(1.5px, 0.5px) rotate(1.5deg);
  }

  28% {
    transform: translate(-0.5px, -0.5px) rotate(-0.5deg);
  }

  30% {
    transform: translate(1.5px, -0.5px) rotate(-0.5deg);
  }

  32% {
    transform: translate(2.5px, -1.5px) rotate(1.5deg);
  }

  34% {
    transform: translate(2.5px, 2.5px) rotate(-0.5deg);
  }

  36% {
    transform: translate(0.5px, -1.5px) rotate(0.5deg);
  }

  38% {
    transform: translate(2.5px, -0.5px) rotate(-0.5deg);
  }

  40% {
    transform: translate(-0.5px, 2.5px) rotate(0.5deg);
  }

  42% {
    transform: translate(-1.5px, 2.5px) rotate(0.5deg);
  }

  44% {
    transform: translate(-1.5px, 1.5px) rotate(0.5deg);
  }

  46% {
    transform: translate(1.5px, -0.5px) rotate(-0.5deg);
  }

  48% {
    transform: translate(2.5px, -0.5px) rotate(0.5deg);
  }

  50% {
    transform: translate(-1.5px, 1.5px) rotate(0.5deg);
  }

  52% {
    transform: translate(-0.5px, 1.5px) rotate(0.5deg);
  }

  54% {
    transform: translate(-1.5px, 1.5px) rotate(0.5deg);
  }

  56% {
    transform: translate(0.5px, 2.5px) rotate(1.5deg);
  }

  58% {
    transform: translate(2.5px, 2.5px) rotate(0.5deg);
  }

  60% {
    transform: translate(2.5px, -1.5px) rotate(1.5deg);
  }

  62% {
    transform: translate(-1.5px, 0.5px) rotate(1.5deg);
  }

  64% {
    transform: translate(-1.5px, 1.5px) rotate(1.5deg);
  }

  66% {
    transform: translate(0.5px, 2.5px) rotate(1.5deg);
  }

  68% {
    transform: translate(2.5px, -1.5px) rotate(1.5deg);
  }

  70% {
    transform: translate(2.5px, 2.5px) rotate(0.5deg);
  }

  72% {
    transform: translate(-0.5px, -1.5px) rotate(1.5deg);
  }

  74% {
    transform: translate(-1.5px, 2.5px) rotate(1.5deg);
  }

  76% {
    transform: translate(-1.5px, 2.5px) rotate(1.5deg);
  }

  78% {
    transform: translate(-1.5px, 2.5px) rotate(0.5deg);
  }

  80% {
    transform: translate(-1.5px, 0.5px) rotate(-0.5deg);
  }

  82% {
    transform: translate(-1.5px, 0.5px) rotate(-0.5deg);
  }

  84% {
    transform: translate(-0.5px, 0.5px) rotate(1.5deg);
  }

  86% {
    transform: translate(2.5px, 1.5px) rotate(0.5deg);
  }

  88% {
    transform: translate(-1.5px, 0.5px) rotate(1.5deg);
  }

  90% {
    transform: translate(-1.5px, -0.5px) rotate(-0.5deg);
  }

  92% {
    transform: translate(-1.5px, -1.5px) rotate(1.5deg);
  }

  94% {
    transform: translate(0.5px, 0.5px) rotate(-0.5deg);
  }

  96% {
    transform: translate(2.5px, -0.5px) rotate(-0.5deg);
  }

  98% {
    transform: translate(-1.5px, -1.5px) rotate(-0.5deg);
  }

  0%,
  100% {
    transform: translate(0, 0) rotate(0);
  }
}
</style>

<script setup lang="ts">
import { onMounted, onUnmounted } from 'vue'
import { LAppDelegate } from '../stores/live2d/delegate'
import { ChatService } from '../utils/ChatService'

// 获取 ChatService 单例
const chatService = ChatService.getInstance()

// Live2D 初始化
onMounted(() => {
  // Initialize MessageTips with the ID of the DOM element
  const tipsElement = document.getElementById('assistant-tips')

  chatService.initializeMessageTips(tipsElement)

  window.assistantAPI.ipcRenderer.on('show-assistant-message', (event, data) => {
    // data is the object { text, timeout, priority }
    console.log('接受到：show-assistant-message', data)
    chatService.showTempMessage(data.text, data.timeout, data.priority) // 🎯 Correctly pass the arguments
  })

  // 获取LAppDelegate实例
  const delegate = LAppDelegate.getInstance()

  // 初始化Live2D
  delegate.initialize(80, 100)

  // 运行Live2D
  delegate.run()
})

/**
 * 浏览器窗口即将关闭时释放
 */
onUnmounted(() => {
  LAppDelegate.releaseInstance()
})

// 监听鼠标事件
window.addEventListener('mouseup', () => {
  chatService.showTempMessage('摸摸头，可以加互动~', 6000, 9)
})
</script>
