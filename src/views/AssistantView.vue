<template>
  <div id="live2d-container" @contextmenu.prevent="showContextMenu">
    <div id="assistant-tips"></div>
    <div id="live2d-context-menu" v-show="contextMenuVisible" :style="contextMenuStyle">
      <div
        v-for="(item, index) in contextMenuItems"
        :key="index"
        class="menu-item"
        @click="item.action"
      >
        <div class="icon"><font-awesome-icon :icon="item.icon" /></div>
        <div class="text">{{ item.text }}</div>
      </div>
    </div>
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
  cursor: grab;
}

#live2d-container.dragging {
  cursor: grabbing;
}

#live2d-container.locked {
  cursor: default;
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
  pointer-events: none;
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

#live2d-context-menu {
  position: fixed;
  background-color: rgba(255, 255, 255, 0.914);
  border: 1px solid rgba(128, 128, 128, 0.4);
  border-radius: 30px;
  box-shadow: 0 3px 15px rgba(128, 128, 128, 0.6);
  z-index: 10000;
  width: 50px;
  height: 110px;
  overflow: hidden;
  transition: width 0.5s;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  padding: 8px;
}

#live2d-context-menu:hover {
  width: 150px;
  transition: width 0.5s;
}

#live2d-context-menu .menu-item {
  cursor: pointer;
  max-width: auto;
  height: 40px;
  border-radius: 100px;
  white-space: nowrap; /* 防止文字换行 */
  position: relative;
  display: flex;
  flex-direction: row;
  align-items: center;
  justify-content: start;
}

.menu-item .icon {
  width: 40px;
  height: 40px;
  /* background-color: #ffc0d6; */
  border-radius: 30px;
  display: flex;
  align-items: center;
  padding-left: 7px;
}

.menu-item:hover {
  background-color: #ffc0d6;
  color: white;
  width: 100%;
}

.menu-item .text {
  position: absolute;
  left: 40px;
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
import { ref, onMounted, onUnmounted, computed } from 'vue'
import { LAppDelegate } from '../stores/live2d/delegate'
import { ChatService } from '../utils/ChatService'

// 从存储读取助手设置
const assistantSettings = JSON.parse(localStorage.getItem('assistantSettings') || '{}')

// 拖拽相关状态
const isLocked = ref(assistantSettings.locked || true)

// 右键菜单相关状态
const contextMenuVisible = ref(false)
const contextMenuStyle = ref({ top: '0px', left: '0px' })

// 右键菜单项
const contextMenuItems = computed(() => [
  {
    icon: isLocked.value ? 'fa-solid fa-lock' : 'fa-solid fa-unlock',
    text: isLocked.value ? '解锁位置' : '锁定位置',
    action: () => {
      toggleLock()
      hideContextMenu()
    },
  },
  {
    icon: 'fa-solid fa-gear',
    text: '设置',
    action: () => {
      window.assistantAPI.ipcRenderer.send('app:maximize', null)
      hideContextMenu()
    },
  },
])

// 切换锁定状态
function toggleLock() {
  isLocked.value = !isLocked.value
  const container = document.getElementById('live2d-container')
  if (container) {
    if (isLocked.value) {
      container.classList.add('locked')
      chatService.showTempMessage('位置已解锁', 2000, 10)
    } else {
      container.classList.remove('locked')
      chatService.showTempMessage('位置已锁定', 2000, 10)
    }
  }
}

function handleMouseDown(event: MouseEvent) {
  // 只处理左键点击，且未在菜单上点击，且没有被锁定
  if (event.button !== 0 || contextMenuVisible.value || isLocked.value) return

  window.assistantAPI.startDrag()
}

// 显示右键菜单
// 显示右键菜单
function showContextMenu(event: MouseEvent) {
  const menuWidth = 150
  const menuHeight = 110

  // 获取窗口尺寸
  const { innerWidth, innerHeight } = window

  // 计算菜单位置，确保不会超出屏幕边界
  let menuLeft = event.clientX
  let menuTop = event.clientY

  // 检查右侧是否超出边界
  if (menuLeft + menuWidth > innerWidth) {
    menuLeft = innerWidth - menuWidth - 10 // 留10px边距
  }

  // 检查底部是否超出边界
  if (menuTop + menuHeight > innerHeight) {
    menuTop = innerHeight - menuHeight - 10 // 留10px边距
  }

  // 确保不会小于0
  menuLeft = Math.max(0, menuLeft)
  menuTop = Math.max(0, menuTop)

  contextMenuStyle.value = {
    top: `${menuTop}px`,
    left: `${menuLeft}px`,
  }

  contextMenuVisible.value = true

  // 点击其他地方隐藏菜单
  const hideMenu = (e: MouseEvent) => {
    if (!(e.target as HTMLElement).closest('#live2d-context-menu')) {
      hideContextMenu()
      document.removeEventListener('click', hideMenu)
    }
  }

  setTimeout(() => {
    document.addEventListener('click', hideMenu)
  }, 0)
}

// 隐藏右键菜单
function hideContextMenu() {
  contextMenuVisible.value = false
}

// 获取 ChatService 单例
const chatService = ChatService.getInstance()

// Live2D 初始化
onMounted(() => {
  const tipsElement = document.getElementById('assistant-tips')

  chatService.initializeMessageTips(tipsElement)

  // 监听消息，并显示消息
  window.assistantAPI.ipcRenderer.on('show-assistant-message', (event, data) => {
    chatService.showTempMessage(data.text, data.timeout, data.priority)
  })

  // 获取LAppDelegate实例
  const delegate = LAppDelegate.getInstance()

  // 初始化Live2D
  delegate.initialize(80, 100)

  // 运行Live2D
  delegate.run()

  const container = document.getElementById('live2d-container')

  container.addEventListener('mousedown', handleMouseDown)
})

/**
 * 浏览器窗口即将关闭时释放
 */
onUnmounted(() => {
  LAppDelegate.releaseInstance()
  // 清理事件监听器
  const container = document.getElementById('live2d-container')
  if (container) {
    container.removeEventListener('mousedown', handleMouseDown)
  }
})
</script>
