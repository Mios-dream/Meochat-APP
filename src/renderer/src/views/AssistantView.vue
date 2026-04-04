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
import { ref, onMounted, onUnmounted, computed, Ref, watch } from 'vue'
import { ChatService } from '../services/ChatService'
import { Live2DManager } from '../services/Live2dManager'
import AssistantTips from '../components/AssistantTips.vue'
import ContextMenu from '../components/Toolbar.vue'
import LoadingProgress from '../components/LoadingProgress.vue'
import { useConfigStore } from '../stores/useConfigStore'
import { storeToRefs } from 'pinia'
import { InteractionSystem } from '../services/InteractionSystem/InteractionSystem'
import { WakewordService } from '../services/WakewordService'

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
// 移除监听器
let removeListener: () => void
// 组件实例
const live2DManager = Live2DManager.getInstance()
const chatService = ChatService.getInstance()
const interactionSystem = InteractionSystem.getInstance()
const wakewordService = WakewordService.getInstance()

// 计算属性
const contextMenuItems = computed(() => [
  {
    icon: isLocked.value ? 'fa-solid fa-lock' : 'fa-solid fa-unlock',
    text: isLocked.value ? '解锁位置' : '锁定位置',
    action: toggleLock
  },
  {
    icon: config.value.quietMode ? 'fa-solid fa-volume-xmark' : 'fa-solid fa-volume-high',
    text: config.value.quietMode ? '安静模式' : '安静模式',
    action: toggleQuietMode
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

async function toggleQuietMode(): Promise<void> {
  const nextMode = !config.value.quietMode
  await configStore.updateConfig('quietMode', nextMode)
  const message = nextMode ? '已开启安静模式，不再自动发起聊天' : '已关闭安静模式'
  chatService.showTempMessage(message, 2000, 10)
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

function syncInteractionSystemState(): void {
  if (config.value.quietMode) {
    interactionSystem.stop()
    return
  }
  interactionSystem.start()
}

async function syncWakewordState(): Promise<void> {
  if (!config.value.autoChat || config.value.quietMode) {
    await wakewordService.stop()
    return
  }

  try {
    await wakewordService.start(config.value.baseUrl)
  } catch (error) {
    console.error('启动语音唤醒失败:', error)
    chatService.showTempMessage('语音唤醒启动失败，请检查麦克风权限', 3000, 10)
  }
}

async function reconnectWakewordState(): Promise<void> {
  try {
    await wakewordService.stop()
    await syncWakewordState()
  } catch (error) {
    console.error('助手切换后重连唤醒词失败:', error)
  }
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
  syncInteractionSystemState()

  wakewordService.setCallbacks({
    onReady: () => {
      console.log('Wakeword service ready')
    },
    onDetected: ({ keyword }) => {
      console.log('检测到唤醒词:', keyword)
      // chatService.showTempMessage(`检测到唤醒词：${keyword.trim() || '已唤醒'}`, 2000, 20)
      window.api.openChatBox()
      window.api.ipcRenderer.send('chat-box:wakeword-detected', {
        keyword,
        timestamp: Date.now()
      })
    },
    onError: (message) => {
      console.error('唤醒词服务错误:', message)
    }
  })

  try {
    await syncWakewordState()
  } catch (error) {
    console.error('同步唤醒词状态失败:', error)
  }

  // 监听来自ChatBox的消息
  window.api.ipcRenderer.on('chat-box:send-message', async (_, data) => {
    // 调用ChatService处理消息
    chatService.chat(data.text).then(() => {
      // 发送状态更新给ChatBox
      window.api.ipcRenderer.send('chat-box:update-status', {
        loading: false
      })
    })
  })
  await initAssistantModel()

  // 监听助手切换事件
  removeListener = window.api.onAssistantSwitched(async (assistant) => {
    // 当助手切换时，重新初始化模型
    await switchModel(assistant.name)
    // 切换助手后同步唤醒词状态
    await reconnectWakewordState()
  })
})

watch(
  () => config.value.quietMode,
  async () => {
    syncInteractionSystemState()
    try {
      await syncWakewordState()
    } catch (error) {
      console.error('安静模式切换后同步唤醒词状态失败:', error)
    }
  }
)

watch(
  () => [config.value.autoChat, config.value.baseUrl],
  async () => {
    try {
      await syncWakewordState()
    } catch (error) {
      console.error('配置变更后同步唤醒词状态失败:', error)
    }
  }
)

onUnmounted(() => {
  if (removeListener) {
    removeListener()
  }
  interactionSystem.stop()
  wakewordService.stop()

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
  /* border: 2px dashed #a18cd1; */
}
</style>
