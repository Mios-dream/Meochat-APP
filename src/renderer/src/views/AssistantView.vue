<!-- src/views/AssistantView.vue -->
<template>
  <div id="loading-container">
    <LoadingProgress :progress="loadingProgress" />
  </div>
  <div
    id="live2d-container"
    :class="{ locked: isLocked }"
    @contextmenu.prevent="showContextMenu"
    @mousedown="handleMouseDown"
  >
    <AssistantTips :is-active="isTipsActive">
      {{ currentTip }}
    </AssistantTips>

    <ContextMenu
      :visible="contextMenuVisible"
      :style="contextMenuStyle"
      :items="contextMenuItems"
    />

    <canvas id="l2d-canvas"></canvas>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed, Ref } from 'vue'
import { ChatService } from '../services/ChatService'
import { Live2DManager } from '../services/Live2dManager'
import { MicrophoneManager } from '../services/MicrophoneManager'
import AssistantTips from '../components/AssistantTips.vue'
import ContextMenu from '../components/Toolbar.vue'
import LoadingProgress from '../components/LoadingProgress.vue'
import { useConfigStore } from '../stores/useConfigStore'
import { storeToRefs } from 'pinia'
import { InteractionSystem } from '../services/InteractionSystem/InteractionSystem'

const configStore = useConfigStore()
const { config } = storeToRefs(configStore)

// 状态管理,是否锁定助手位置
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

let removeListener: () => void
// 组件实例
const live2DManager = Live2DManager.getInstance()
const chatService = ChatService.getInstance()
const interactionSystem = InteractionSystem.getInstance()

// 创建麦克风管理器实例
const micManager = new MicrophoneManager()

// 设置识别结果回调
micManager.setRecognitionCallback((data) => {
  console.log('识别结果:', data)
  const jsonData = JSON.parse(data)
  if (jsonData.withAssistant === true) {
    chatService.chat(jsonData.data)
  }
})

// 获取麦克风权限
micManager.getPermissionStatus().then((status) => {
  console.log('麦克风权限状态:', status)
})
const wsUrl = computed(() => `ws://${config.value.baseUrl}/api/asr_ws_plus`)

// 计算属性
const contextMenuItems = computed(() => [
  {
    icon: isLocked.value ? 'fa-solid fa-lock' : 'fa-solid fa-unlock',
    text: isLocked.value ? '解锁位置' : '锁定位置',
    action: toggleLock
  },
  {
    icon: 'fa-solid fa-gear',
    text: '设置',
    action: openSettings
  },
  {
    icon: 'fa-solid fa-xmark',
    text: '关闭',
    action: closeAssistant
  }
])

// 方法定义
function toggleLock(): void {
  isLocked.value = !isLocked.value
  const message = isLocked.value ? '位置已锁定' : '位置已解锁'
  chatService.showTempMessage(message, 2000, 10)
  hideContextMenu()
}

function openSettings(): void {
  window.api.maximizeApp()
  hideContextMenu()
}

function closeAssistant(): void {
  window.api.closeAssistant()
  hideContextMenu()
}

function handleMouseDown(event: MouseEvent): void {
  if (event.button !== 0 || contextMenuVisible.value || isLocked.value) return
  window.api.startDrag()
}

function showContextMenu(event: MouseEvent): void {
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
    left: `${menuLeft}px`
  }

  contextMenuVisible.value = true

  const hideMenu = (e: MouseEvent): void => {
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
function hideContextMenu(): void {
  contextMenuVisible.value = false
}

// 初始化助手模型
async function initAssistantModel(): Promise<void> {
  try {
    let currentAssistantName = ''
    const response = await window.api.getCurrentAssistant()
    if (response.success && response.data) {
      currentAssistantName = response.data.name
    }

    const assetsResponse = await window.api.getAssistantAssets(currentAssistantName)
    // 销毁当前模型
    live2DManager.destroy()
    if (assetsResponse.success && assetsResponse.data && assetsResponse.data.live2d.modelJsonPath) {
      console.log('Live2D模型路径:', 'app-resource://' + assetsResponse.data.live2d.modelJsonPath)
      await live2DManager.init(
        'l2d-canvas',
        'app-resource://' + assetsResponse.data.live2d.modelJsonPath
      )
    } else {
      // 加载默认模型
      await live2DManager.init('l2d-canvas', './turong/turong.model3.json')
    }
    live2DManager.initListeners()
    loadingCompleted()
  } catch (error) {
    console.error('初始化Live2D模型失败:', error)
  }
}

/**
 * 切换助手模型
 * @param assistantName 助手名称
 */
async function switchModel(assistantName: string): Promise<void> {
  try {
    startLoading()
    const assetsResponse = await window.api.getAssistantAssets(assistantName)
    if (assetsResponse.success && assetsResponse.data && assetsResponse.data.live2d.modelJsonPath) {
      // 切换模型
      await live2DManager.switchModel('app-resource://' + assetsResponse.data.live2d.modelJsonPath)
    } else {
      // 加载默认模型
      await live2DManager.switchModel('./turong/turong.model3.json')
    }
    loadingCompleted()
  } catch (error) {
    console.error('切换Live2D模型失败:', error)
  }
}

function loadingCompleted(): void {
  loadingProgress.value = 100
  // 隐藏加载进度
  setTimeout(() => {
    const progressElement = document.getElementById('loading-container')

    if (progressElement) {
      progressElement.classList.add('fade-out')

      setTimeout(() => {
        if (progressElement) {
          progressElement.style.display = 'none'
        }
      }, 500)
    }
  }, 500)
}
function startLoading(): void {
  loadingProgress.value = 0
  const progressElement = document.getElementById('loading-container')

  if (progressElement) {
    progressElement.classList.remove('fade-out')

    progressElement.style.display = 'flex'
  }
  // 模拟加载进度
  const progressInterval = setInterval(() => {
    if (loadingProgress.value < 90) {
      loadingProgress.value += 10
    } else {
      clearInterval(progressInterval)
    }
  }, 50)
}

onMounted(async () => {
  startLoading()
  if (config.value.autoChat) {
    // 连接到 WebSocket 服务
    micManager.connectToServer(wsUrl.value)
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
  interactionSystem.start()

  // 接收来自主进程的消息，是否显示消息
  window.api.ipcRenderer.on('show-assistant-message', (data) => {
    chatService.showTempMessage(data.text, data.timeout, data.priority)
  })

  window.api.ipcRenderer.on('chat-box:send-message', async (_event, data) => {
    await chatService.chat(data.text).then(() => {
      window.api.ipcRenderer.send('loading-state-changed', false)
    })
  })

  // 监听助手切换事件
  removeListener = window.api.onAssistantSwitched(async (assistant) => {
    // 当助手切换时，重新初始化模型
    switchModel(assistant.name)
  })

  initAssistantModel()
})

onUnmounted(() => {
  if (removeListener) {
    removeListener()
  }
  interactionSystem.stop()
  window.api.ipcRenderer.removeAllListeners('show-assistant-message')
  window.api.ipcRenderer.removeAllListeners('chat-box:send-message')
  live2DManager.destroy()
})
</script>

<style>
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

#loading-container {
  position: absolute;
  height: 100%;
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 2px dashed #a18cd1;
}
</style>
