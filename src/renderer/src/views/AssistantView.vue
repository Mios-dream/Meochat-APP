<!-- src/views/AssistantView.vue -->
<template>
  <div
    id="live2d-container"
    :class="{ locked: isLocked }"
    @contextmenu.prevent="showContextMenu"
    @mousedown="handleMouseDown"
  >
    <AssistantTips v-show="config.desktopSpeechBoard" :is-active="isTipsActive">
      {{ currentTip }}
    </AssistantTips>

    <ContextMenu
      :visible="contextMenuVisible"
      :style="contextMenuStyle"
      :items="contextMenuItems"
    />

    <canvas id="l2d-canvas"></canvas>
  </div>
  <div v-if="loadError" class="error-root">
    <div class="eva-bar">
      <div class="eva-track">
        <span v-for="i in 8" :key="i">SYSTEM LOCKED ◆ 系统锁定 ◆ </span>
      </div>
    </div>
    <div class="eva-bar eva-bar--secondary">
      <div class="eva-track eva-track--reverse">
        <span v-for="i in 8" :key="i">ERROR :: 加载失败 :: CORE DUMP ◆ </span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed, Ref, watch } from 'vue'
import { ChatManager } from '../chat/ChatManager'
import { Live2DManager } from '../services/Live2dManager'
import AssistantTips from '../components/AssistantTips.vue'
import ContextMenu from '../components/Toolbar.vue'
import { useConfigStore } from '../stores/useConfigStore'
import { storeToRefs } from 'pinia'
import { InteractionSystem } from '@renderer/core/interaction/InteractionSystem'
import { WakewordService } from '../services/WakewordService'

const configStore = useConfigStore()
const { config } = storeToRefs(configStore)

// 状态管理,是否锁定助手位置
const isLocked = ref(JSON.parse(localStorage.getItem('assistantSettings') || '{}').locked || true)
// 右键菜单
const contextMenuVisible = ref(false)
const contextMenuStyle = ref({ top: '0px', left: '0px' })

// 消息是否显示
const isTipsActive: Ref<boolean> = ref(false)
// 当前消息
const currentTip: Ref<string> = ref('')
// 是否加载模型失败
const loadError = ref(false)
// 组件实例
const live2DManager = Live2DManager.getInstance()
// 聊天服务实例
const chatService = ChatManager.getInstance()
// 交互系统实例
const interactionSystem = InteractionSystem.getInstance()
// 唤醒词服务实例
const wakewordService = WakewordService.getInstance()
// Tips更新定时器,定时更新Tips内容以保持与语音输出同步
let tipsUpdateInterval: ReturnType<typeof setTimeout> | null = null
// 当前已激活的助手名称，用于过滤重复的助手切换事件，避免睡眠模式等状态被意外重置
let currentAssistantName = ''

/**
 * 注册由事件系统驱动的 Live2D 表现副作用。
 * 事件处理器只声明 Live2D 动作，具体模型调用集中在页面初始化阶段绑定。
 */
function registerLive2DEffects(): void {
  const effectDispatcher = interactionSystem.getEffectDispatcher()
  effectDispatcher.register('live2d.enterSleep', () => live2DManager.enterSleepMode())
  effectDispatcher.register('live2d.exitSleep', () => live2DManager.exitSleepMode())
}

/**
 * 注册 Live2D 点击/抚摸回调。
 * 睡眠模式下触摸有 70% 概率触发唤醒，30% 概率保留原交互逻辑。
 */
function registerLive2DInteractionBridge(): void {
  const partEventMap = {
    head: 'live2d.hit.part.head',
    face: 'live2d.hit.part.face',
    body: 'live2d.hit.body',
    hand: 'live2d.hit.part.hand',
    leg: 'live2d.hit.part.leg',
    'head.light': 'live2d.stroke.head.light',
    'head.heavy': 'live2d.stroke.head.heavy'
  }

  live2DManager.onTap((partName) => {
    if (interactionSystem.isSleepMode() && Math.random() < 0.7) {
      interactionSystem.triggerEvent('sleep.wakeup')
      return
    }
    interactionSystem.triggerEvent(partEventMap[partName])
  })
}

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
  hideContextMenu()
  window.api.closeAssistant()
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

/**
 * 切换交互系统状态
 */
function syncInteractionSystemState(): void {
  if (config.value.quietMode) {
    interactionSystem.stop()
    return
  }
  interactionSystem.start()
}

/**
 * 切换语音唤醒状态
 */
async function syncWakewordState(): Promise<void> {
  if (!config.value.autoChat || config.value.quietMode) {
    await wakewordService.stop()
    return
  }

  try {
    await wakewordService.start(config.value.baseUrl)
  } catch {
    console.error('启动语音唤醒失败，请检查配置和麦克风权限')
  }
}

/**
 * 重连唤醒词状态
 */
async function reconnectWakewordState(): Promise<void> {
  try {
    await wakewordService.stop()
    await syncWakewordState()
  } catch (error) {
    console.error('助手切换后重连唤醒词失败:', error)
  }
}

// 初始化助手模型
async function initAssistantModel(): Promise<boolean> {
  try {
    const response = await window.api.getCurrentAssistant()
    if (response.success && response.data) {
      currentAssistantName = response.data.name
    }

    const assetsResponse = await window.api.getAssistantAssets(currentAssistantName)
    // 销毁当前模型
    live2DManager.destroy()
    if (assetsResponse.success && assetsResponse.data && assetsResponse.data.live2d.modelJsonPath) {
      await live2DManager.init(
        'l2d-canvas',
        'app-resource://' + assetsResponse.data.live2d.modelJsonPath
      )
      live2DManager.enableModel()
    } else {
      // 加载默认模型
      await live2DManager.init('l2d-canvas', './turong/turong.model3.json')
      live2DManager.enableModel()
    }
    live2DManager.initListeners({ isPetMode: true })
    return true
  } catch (error) {
    loadError.value = true
    await live2DManager.init('l2d-canvas', './turong/turong.model3.json')
    live2DManager.disabledModel()
    console.error('初始化Live2D模型失败:', error)
    return false
  }
}

/**
 * 切换助手模型
 * @param assistantName 助手名称
 * @returns 模型切换是否成功
 */
async function switchModel(assistantName: string): Promise<boolean> {
  try {
    const assetsResponse = await window.api.getAssistantAssets(assistantName)
    if (assetsResponse.success && assetsResponse.data && assetsResponse.data.live2d.modelJsonPath) {
      // 切换模型
      await live2DManager.switchModel('app-resource://' + assetsResponse.data.live2d.modelJsonPath)
      live2DManager.enableModel()
    } else {
      // 加载默认模型
      await live2DManager.switchModel('./turong/turong.model3.json')
      live2DManager.enableModel()
    }
    // 模型切换后重新同步睡眠状态：switchModel 内部会 reset 睡眠控制器，
    // 但交互系统的 SleepEventModule 仍处于 sleeping 状态，需要主动恢复 Live2D 侧的睡眠表现
    restoreSleepState()
    return true
  } catch (error) {
    console.error('切换Live2D模型失败，尝试恢复默认模型:', error)
    // 尝试恢复默认模型，不直接标记 disabled，避免正常切换时进入错误的禁用状态
    try {
      await live2DManager.switchModel('./turong/turong.model3.json')
      live2DManager.enableModel()
      restoreSleepState()
      return true
    } catch (recoveryError) {
      // 默认模型也加载失败，才标记为禁用状态
      loadError.value = true
      live2DManager.disabledModel()
      console.error('恢复默认模型失败:', recoveryError)
      return false
    }
  }
}

/**
 * 恢复睡眠状态。
 * 模型切换 / 重建后调用：若交互系统当前处于睡眠时段，重新让 Live2D 进入睡眠表现，
 * 弥补 switchModel→sleepController.reset() 与 SleepEventModule 之间的状态脱节。
 */
function restoreSleepState(): void {
  if (interactionSystem.isSleepMode()) {
    live2DManager.enterSleepMode()
  }
}

/**
 * 处理唤醒词检测到的事件
 * @param keyword
 */
async function handleWakewordDetected(keyword: string): Promise<void> {
  window.api.openChatBox()
  window.api.ipcRenderer.send('chat-box:wakeword-detected', keyword)
}

onMounted(async () => {
  wakewordService.setCallbacks({
    onReady: () => {
      console.log('唤醒服务启动成功')
    },
    onDetected: ({ keyword }) => {
      handleWakewordDetected(keyword)
    },
    onError: (message) => {
      console.error('唤醒服务错误:', message)
    }
  })

  // 监听来自ChatBox的消息
  window.api.ipcRenderer.on('chat-box:send-message', async (_, data) => {
    try {
      // 获取当前睡眠模式状态，传递给后端识别
      const isSleepMode = interactionSystem.isSleepMode()
      // 调用 ChatManager 处理消息，并等待语音/动作播放完成后再解锁输入
      await chatService.chat(data.text, isSleepMode)
      await chatService.waitForReplyPlaybackComplete()
    } finally {
      // 发送状态更新给 ChatBox
      window.api.ipcRenderer.send('chat-box:update-status', {
        loading: false
      })
    }
  })

  // 初始化模型，只有成功加载模型后才启用服务
  const modelLoaded = await initAssistantModel()
  if (modelLoaded) {
    registerLive2DEffects()
    registerLive2DInteractionBridge()
    syncInteractionSystemState()

    // 读取配置中的睡眠状态，自动应用睡眠模式
    if (config.value.sleepMode) {
      live2DManager.enterSleepMode()
    }
    try {
      await syncWakewordState()
    } catch (error) {
      console.error('同步唤醒词状态失败:', error)
    }
  } else {
    console.warn('Live2D模型加载失败，InteractionSystem 和 Wakeword 服务未启用')
  }

  // 注册语音播放事件 — 用于控制Tips窗口
  chatService.onSpeechStart(async (message) => {
    const isVisible = await window.api.isAssistantVisible()
    // const isVisible = false // 暂时不检查窗口可见性，直接显示Tips
    console.log('语音开始播放，当前窗口可见:', isVisible)
    if (!isVisible) {
      // console.log('语音开始播放，显示Tips:', message)
      window.api.showTips(message)
      // 定期更新Tips消息内容
      tipsUpdateInterval = setInterval(() => {
        const currentText = chatService.getCurrentDisplayText()
        // console.log('更新Tips内容:', currentText)
        if (currentText) {
          window.api.updateTips(currentText)
        }
      }, 1000)
    }
  })

  chatService.onSpeechEnd(() => {
    if (tipsUpdateInterval) {
      clearInterval(tipsUpdateInterval)
      tipsUpdateInterval = null
    }
    setTimeout(() => {
      window.api.hideTips()
    }, 2000)
  })

  // 监听助手切换事件
  window.api.onAssistantSwitched(async (assistant) => {
    // 助手未变化时跳过模型重载，防止睡眠模式等运行状态被重置
    if (assistant.name === currentAssistantName) return

    currentAssistantName = assistant.name
    // 当助手切换时，重新初始化模型
    const modelSwitched = await switchModel(assistant.name)
    // 只有模型成功切换时才重连唤醒词状态
    if (modelSwitched) {
      await reconnectWakewordState()
    } else {
      console.warn('助手模型切换失败，唤醒词服务未重连')
    }
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

watch(
  () => config.value.desktopSpeechBoard,
  (enabled) => {
    if (!enabled) {
      chatService.hideMessage()
    }
  }
)

onUnmounted(() => {
  interactionSystem.stop()
  wakewordService.stop()
  window.api.ipcRenderer.removeAllListeners('chat-box:send-message')
  live2DManager.destroy()
  // 清除Tips更新定时器
  if (tipsUpdateInterval) {
    clearInterval(tipsUpdateInterval)
    tipsUpdateInterval = null
  }
  window.api.hideTips()
})
</script>

<style scoped>
/* ERROR ROOT — 整体容器 */
.error-root {
  position: fixed;
  inset: 0;
  z-index: 9999;
  pointer-events: none;
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 12px;
}

.eva-bar {
  width: 100%;
  overflow: hidden;
  height: 36px;
  display: flex;
  align-items: center;
  border-top: 1px solid rgba(255, 77, 166, 0.6);
  border-bottom: 1px solid rgba(255, 77, 166, 0.6);
  background: repeating-linear-gradient(
    45deg,
    rgba(255, 77, 166, 0.15),
    rgba(255, 77, 166, 0.15) 10px,
    rgba(255, 77, 166, 0.35) 10px,
    rgba(255, 77, 166, 0.35) 20px
  );
  background-size: 200px 40px;
  animation: eva-bg-move 5s linear infinite;
}

.eva-bar--secondary {
  height: 28px;
  opacity: 0.7;
  background: repeating-linear-gradient(
    -45deg,
    rgba(180, 100, 255, 0.1),
    rgba(180, 100, 255, 0.1) 10px,
    rgba(180, 100, 255, 0.25) 10px,
    rgba(180, 100, 255, 0.25) 20px
  );
  background-size: 200px 40px;
  border-color: rgba(180, 100, 255, 0.5);
  animation: eva-bg-move 4s linear infinite reverse;
}

.eva-track {
  display: flex;
  white-space: nowrap;
  animation: eva-scroll 24s linear infinite;
}

.eva-track--reverse {
  animation: eva-scroll-reverse 21s linear infinite;
}

.eva-track span {
  margin-right: 60px;
  font-size: 13px;
  font-weight: bold;
  letter-spacing: 2px;
  color: #ff4da6;
  text-shadow: 0 0 8px rgba(255, 77, 166, 0.8);
  font-family: 'Courier New', monospace;
}

.eva-bar--secondary .eva-track span {
  color: #c87eff;
  text-shadow: 0 0 8px rgba(180, 100, 255, 0.8);
}

@keyframes eva-scroll {
  0% {
    transform: translateX(0);
  }
  100% {
    transform: translateX(-50%);
  }
}
@keyframes eva-scroll-reverse {
  0% {
    transform: translateX(-50%);
  }
  100% {
    transform: translateX(0);
  }
}
@keyframes eva-bg-move {
  0% {
    background-position: 0 0;
  }
  100% {
    background-position: 200px 0;
  }
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

#loading-container {
  position: absolute;
  height: 100%;
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  /* border: 2px dashed #a18cd1; */
}

.seal-core {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
  text-align: center;
  text-shadow: 0 0 18px rgba(255, 138, 198, 0.65);
}

.core-title {
  color: #ffd4ea;
  font-size: clamp(22px, 2.8vw, 40px);
  letter-spacing: 5px;
  font-family: 'Rajdhani', 'Segoe UI', sans-serif;
  font-weight: 700;
}

.core-subtitle {
  color: rgba(230, 234, 255, 0.9);
  font-size: clamp(12px, 1.3vw, 18px);
  letter-spacing: 3px;
  font-family: 'Rajdhani', 'Segoe UI', sans-serif;
}
</style>
