<!-- src/views/AssistantView.vue -->
<template>
  <div
    id="live2d-container"
    @contextmenu.prevent="showContextMenu"
    @mousedown="handleMouseDown"
    :class="{ locked: isLocked }"
  >
    <AssistantTips :is-active="isTipsActive">
      {{ currentTip }}
    </AssistantTips>

    <ContextMenu
      :visible="contextMenuVisible"
      :style="contextMenuStyle"
      :items="contextMenuItems"
      :locked="isLocked"
      @update:locked="isLocked = $event"
    />

    <canvas id="l2d-canvas"></canvas>
    <!-- <div
      id="overlay"
      style="position: absolute; inset: 0; pointer-events: auto; background: transparent"
    ></div> -->

    <LoadingProgress :progress="loadingProgress" />
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed, Ref } from 'vue'
import { ChatService } from '../utils/ChatService'
import { Live2DManager } from '../utils/Live2dManager'
import AssistantTips from '../components/AssistantTips.vue'
import ContextMenu from '../components/Live2dToolbar.vue'
import LoadingProgress from '../components/LoadingProgress.vue'

// 状态管理
const isLocked = ref(JSON.parse(localStorage.getItem('assistantSettings') || '{}').locked || true)
// 右键菜单
const contextMenuVisible = ref(false)
const contextMenuStyle = ref({ top: '0px', left: '0px' })
// 加载进度
const loadingProgress = ref(0)
// 消息是否显示
const isTipsActive: Ref<boolean> = ref(false)
// 当前消息
const currentTip: Ref<string> = ref('')

// 组件实例
const live2DManager = Live2DManager.getInstance()
const chatService = ChatService.getInstance()

// 计算属性
const contextMenuItems = computed(() => [
  {
    icon: isLocked.value ? 'fa-solid fa-lock' : 'fa-solid fa-unlock',
    text: isLocked.value ? '解锁位置' : '锁定位置',
    action: toggleLock,
  },
  {
    icon: 'fa-solid fa-gear',
    text: '设置',
    action: openSettings,
  },
  {
    icon: 'fa-solid fa-xmark',
    text: '关闭',
    action: closeApp,
  },
])

// 方法定义
function toggleLock() {
  isLocked.value = !isLocked.value
  const message = isLocked.value ? '位置已锁定' : '位置已解锁'
  chatService.showTempMessage(message, 2000, 10)
  hideContextMenu()
}

function openSettings() {
  window.assistantAPI.ipcRenderer.send('app:maximize', null)
  hideContextMenu()
}

function closeApp() {
  window.assistantAPI.ipcRenderer.send('app:quite', null)
  hideContextMenu()
}

function handleMouseDown(event: MouseEvent) {
  if (event.button !== 0 || contextMenuVisible.value || isLocked.value) return
  window.assistantAPI.startDrag()
}

function showContextMenu(event: MouseEvent) {
  const menuWidth = 150
  const menuHeight = 110
  const { innerWidth, innerHeight } = window

  let menuLeft = event.clientX
  let menuTop = event.clientY

  if (menuLeft + menuWidth > innerWidth) {
    menuLeft = innerWidth - menuWidth - 10
  }

  if (menuTop + menuHeight > innerHeight) {
    menuTop = innerHeight - menuHeight - 10
  }

  menuLeft = Math.max(0, menuLeft)
  menuTop = Math.max(0, menuTop)

  contextMenuStyle.value = {
    top: `${menuTop}px`,
    left: `${menuLeft}px`,
  }

  contextMenuVisible.value = true

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

/**
 * 隐藏菜单
 */
function hideContextMenu() {
  contextMenuVisible.value = false
}

onMounted(async () => {
  // 初始化聊天服务
  const tipsElement = document.getElementById('assistant-tips')
  chatService.initializeMessageTips(tipsElement)

  // 接收来自主进程的消息，是否显示消息
  window.assistantAPI.ipcRenderer.on('show-assistant-message', (event, data) => {
    chatService.showTempMessage(data.text, data.timeout, data.priority)
  })

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

    console.log('加载完毕')

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
  await live2DManager.speak('/public/梦梦奈铃芽之旅.wav')
})

onUnmounted(() => {
  live2DManager.destroy()
})
</script>

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
</style>
