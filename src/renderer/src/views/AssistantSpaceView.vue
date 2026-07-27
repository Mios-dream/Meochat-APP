<template>
  <div id="background-container">
    <div id="live2d-container">
      <canvas id="l2d-canvas" :class="{ 'canvas-fade-in': modelLoaded }"></canvas>
      <AssistantTips v-show="config.appSpeechBoard" :is-active="isTipsActive" font-size="20px">
        {{ currentTip }}
      </AssistantTips>
      <ModelErrorDisplay v-if="showError" :visible="showError" :message="modelErrorMessage" />
    </div>
    <div id="toolbar-right-top">
      <div class="diamond-button" @click="toggleAssistantSettings">
        <font-awesome-icon icon="fa-solid fa-gear" />
      </div>
    </div>
    <div id="toolbar-left-top">
      <div id="assistant-love">
        <div
          class="head-img"
          :style="{
            backgroundImage: `url(${currentAssistant?.avatar ? 'app-resource://' + currentAssistant?.avatar : '../assets/images/assistant_avatar_small.png'})`
          }"
        ></div>
        <div class="name">{{ currentAssistant?.name }}</div>
        <div class="progress-container">
          <div id="love-icon"><font-awesome-icon icon="fa-solid fa-heart" /></div>
          <div class="progress-bar-background">
            <div class="progress-bar-fill" :style="{ width: `${currentLove}%` }"></div>
          </div>
        </div>
        <div class="love-level">一级</div>
      </div>
    </div>
    <div id="toolbar-right-bottom">
      <div
        class="circle-button diary-button"
        :class="{ 'is-locked': !canViewDiary }"
        :title="canViewDiary ? '查看日记' : '好感度达到 100 后可查看日记'"
        @click="handleDiaryClick"
      >
        <font-awesome-icon icon="fa-solid fa-book" />
      </div>
      <div class="circle-button" @click="showChatHistory">
        <font-awesome-icon icon="fa-solid fa-message" />
      </div>

      <div class="circle-button" @click="switchChatBox">
        <font-awesome-icon icon="fa-solid fa-comments" />
      </div>
    </div>

    <ChatBox
      :is-visible="isVisible"
      :loading="chatLoading"
      @send="handleChatBoxSend"
      @cancel="handleChatBoxCancel"
    />
    <teleport to="body">
      <transition name="modal-fade">
        <div v-if="showHistoryModal" class="modal-overlay" @click="closeHistoryModal">
          <div class="chat-history-modal" @click.stop>
            <div class="modal-header">
              <div class="modal-header-left">
                <button
                  class="modal-header-btn clear-btn"
                  title="清空聊天记录"
                  @click="handleClearHistory"
                >
                  <font-awesome-icon icon="trash" />
                </button>
              </div>
              <h2>聊天历史</h2>
              <div class="modal-header-right" />
            </div>
            <div class="modal-body">
              <div v-if="historyLoading" class="no-history">正在加载聊天历史...</div>
              <div v-else-if="historyError" class="no-history">{{ historyError }}</div>
              <div v-else-if="chatHistory.length === 0" class="no-history">暂无聊天历史</div>
              <div v-else class="history-list">
                <template v-for="(disp, index) in historyDisplayItems" :key="index">
                  <ChatMessageItem
                    v-if="disp.kind === 'message'"
                    :role="disp.item.role"
                    :content="disp.item.content"
                    :tool-calls="disp.item.tool_calls"
                    :tool-call-id="disp.item.tool_call_id"
                    :avatar-url="avatarUrl"
                    :assistant-name="assistantName"
                    :timestamp="disp.item.timestamp"
                    :avatar-size="45"
                  />
                  <ChatMessageItem
                    v-else
                    role="assistant"
                    :tools="disp.tools"
                    :reply-content="disp.reply?.content"
                    :avatar-url="avatarUrl"
                    :assistant-name="assistantName"
                    :timestamp="disp.timestamp"
                  />
                </template>
              </div>
            </div>
          </div>
        </div>
      </transition>
      <DiaryNotebookModal
        :visible="showDiaryModal"
        :loading="diaryLoading"
        :error="diaryError"
        :records="diaryRecords"
        :pagination="diaryPagination"
        :format-timestamp="formatDiaryTimestamp"
        @close="closeDiaryModal"
      />
    </teleport>
    <BlurModal v-model="isVisibleSetting" @close="closeHistoryModal">
      <div class="setting-container">
        <div class="setting-title">助手设置</div>
        <div class="setting-item">
          <form class="setting-from">
            <label for="lock-assistant">锁定助手位置</label>
            <ToggleSwitch v-model="isLocked" />
          </form>
          <div class="divider"></div>
          <form class="setting-from">
            <div class="title">
              <label for="wakeword">语音唤醒</label>
              <div class="description">呼唤助手名字时将自动启动聊天</div>
            </div>
            <ToggleSwitch
              v-model="config.autoChat"
              @update:model-value="(v) => change('autoChat', v)"
            />
          </form>
          <div class="divider"></div>
          <form class="setting-from">
            <div class="title">
              <label for="generateMotion">生成动作</label>
              <div class="description">尝试使用模型生成定制化动作</div>
            </div>
            <ToggleSwitch
              :model-value="config.generateMotion"
              @update:model-value="(v) => change('generateMotion', v)"
            />
          </form>
          <div class="divider"></div>
          <form class="setting-from">
            <div class="title">
              <label for="app-speech-board">应用内台词板</label>
              <div class="description">在应用内显示助手台词板</div>
            </div>
            <ToggleSwitch
              :model-value="config.appSpeechBoard"
              @update:model-value="(v) => change('appSpeechBoard', v)"
            />
          </form>
          <div class="divider"></div>
          <form class="setting-from">
            <div class="title">
              <label for="desktop-speech-board">桌面台词板</label>
              <div class="description">在桌面显示助手台词板</div>
            </div>
            <ToggleSwitch
              :model-value="config.desktopSpeechBoard"
              @update:model-value="(v) => change('desktopSpeechBoard', v)"
            />
          </form>
          <div class="divider"></div>
          <form class="setting-from">
            <label for="assistant-volume">助手音量</label>
            <div style="width: 200px">
              <VolumeSlider v-model="volume" label="" :min="0" :max="100" :step="1" unit="" />
            </div>
          </form>
          <div class="divider"></div>
          <form class="setting-from">
            <label for="reset-assistant">重设助手位置</label>
            <RoundedButton @click="resetModelPosition">重设</RoundedButton>
          </form>
        </div>
        <div class="setting-title">互动设置</div>
        <div class="setting-item">
          <form class="setting-from">
            <div class="title">
              <label for="lock-assistant">随机行为</label>
              <div class="description">助手偶尔会和阁下产生互动</div>
            </div>
            <ToggleSwitch
              :model-value="config.idleEvent"
              @update:model-value="(v) => change('idleEvent', v)"
            />
          </form>
          <div class="divider"></div>
          <form class="setting-from">
            <div class="title">
              <label for="quiet-mode">安静模式</label>
              <div class="description">开启后桌宠不会自动发起聊天</div>
            </div>
            <ToggleSwitch
              :model-value="config.quietMode"
              @update:model-value="(v) => change('quietMode', v)"
            />
          </form>
          <div class="divider"></div>
          <form class="setting-from">
            <div class="title">
              <label for="lock-assistant">系统行为</label>
              <div class="description">助手会响应系统事件</div>
            </div>
            <ToggleSwitch v-model="isLocked" />
          </form>
          <div class="divider"></div>
          <form class="setting-from">
            <div class="title">
              <label for="lock-assistant">触摸反应</label>
              <div class="description">助手会对触摸做出响应</div>
            </div>
            <ToggleSwitch v-model="isLocked" />
          </form>
          <div class="divider"></div>
          <form class="setting-from">
            <div class="title">
              <label for="lock-assistant">特殊语音</label>
              <div class="description">助手会对和阁下说早安，晚安</div>
            </div>
            <ToggleSwitch v-model="isLocked" />
          </form>
        </div>
        <div class="setting-title">其他设置</div>
        <div class="setting-item">
          <form class="setting-from">
            <div class="title">
              <label for="chat-shortcut">聊天快捷键</label>
              <div class="description">设置桌宠模式下唤起聊天框的快捷键</div>
            </div>
            <input
              id="chat-shortcut"
              v-model="chatShortcut"
              class="setting-input"
              type="text"
              placeholder="例如：Alt+A"
              readonly
              @click="startCaptureShortcut"
            />
          </form>
        </div>
      </div>
    </BlurModal>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, Ref, watch, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ChatManager } from '../chat/ChatManager'
import { Live2DManager } from '../services/Live2dManager'
import AssistantTips from '../components/AssistantTips.vue'
import ModelErrorDisplay from '../components/main/ModelErrorDisplay.vue'
import BlurModal from '../components/BlurModal.vue'
import ToggleSwitch from '../components/ToggleSwitch.vue'
import VolumeSlider from '../components/VolumeSlider.vue'
import RoundedButton from '../components/RoundedButton.vue'
import { useConfigStore } from '../stores/useConfigStore'
import { storeToRefs } from 'pinia'
import { AssistantInfo, AssistantManager } from '../services/assistantManager'
import ChatBox from '../components/ChatBox.vue'
import ChatMessageItem from '../components/ChatMessageItem.vue'
import type { MergedTool } from '../components/ToolCallGroupBlock.vue'
import DiaryNotebookModal from '../components/main/DiaryNotebookModal.vue'
import { InteractionSystem } from '@renderer/core/interaction/InteractionSystem'
import { DiarySystem } from '@renderer/services/DiarySystem'
import type { ChatMessage, ContentPart, ToolCall } from '@shared/types/chat'
import { normalizeContent } from '../chat/contentNormalizer'

const configStore = useConfigStore()
const { config } = storeToRefs(configStore)
const route = useRoute()
const router = useRouter()

// 模型加载状态
const modelLoaded = ref(false)
const showError = ref(false)
const modelErrorMessage = ref('')

// 消息是否显示
const isTipsActive: Ref<boolean> = ref(false)
// 当前消息
const currentTip: Ref<string> = ref('')
// 对话框是否显示
const isVisible = ref(false)
// 聊天加载状态
const chatLoading = ref(false)

// 是否显示设置菜单
const isVisibleSetting = ref(false)
// 音量
const volume = ref(80)

// 模型设置
const isLocked = ref(true)

/** 聊天历史单项类型 */
interface HistoryItem {
  role: 'user' | 'assistant' | 'tool'
  content: string | ContentPart[] | null
  timestamp: Date | null
  tool_calls?: ToolCall[]
  tool_call_id?: string
}

// 聊天历史
const showHistoryModal = ref(false)
const chatHistory = ref<HistoryItem[]>([])

/** 展示项：普通消息或合并后的工具组 */
interface DisplayHistoryItem {
  kind: 'message'
  item: HistoryItem
}

interface DisplayHistoryToolGroup {
  kind: 'tool_group'
  tools: MergedTool[]
  /** 原始工具调用消息的时间戳 */
  timestamp: Date | null
  /** 工具调用后的助手文字回复 */
  reply?: HistoryItem
}

type HistoryDisplayItem = DisplayHistoryItem | DisplayHistoryToolGroup

/** 从各种格式的消息 content 中提取纯文本 */
function getTextContent(content: string | ContentPart[] | null): string {
  if (!content) return ''
  if (typeof content === 'string') return content
  if (Array.isArray(content)) {
    return content
      .filter((p): p is ContentPart & { type: 'text' } => p.type === 'text')
      .map((p) => p.text)
      .join('')
  }
  return ''
}

/** 预处理：将工具调用及其结果合并为工具组 */
const historyDisplayItems = computed<HistoryDisplayItem[]>(() => {
  const items: HistoryDisplayItem[] = []
  const skip = new Set<number>()
  const list = chatHistory.value

  for (let i = 0; i < list.length; i++) {
    if (skip.has(i)) continue
    const item = list[i]

    if (item.role === 'assistant' && item.tool_calls && item.tool_calls.length > 0) {
      const tools: MergedTool[] = item.tool_calls.map((tc) => {
        for (let j = i + 1; j < list.length; j++) {
          if (list[j].role === 'tool' && list[j].tool_call_id === tc.id) {
            skip.add(j)
            return {
              id: tc.id,
              name: tc.function.name,
              args: tc.function.arguments,
              result: getTextContent(list[j].content)
            }
          }
        }
        return { id: tc.id, name: tc.function.name, args: tc.function.arguments }
      })
      // 查找后续的助手文字回复，合并到同一块
      let reply: HistoryItem | undefined
      for (let j = i + 1; j < list.length; j++) {
        if (skip.has(j)) continue
        if (list[j].role === 'assistant') {
          reply = list[j]
          skip.add(j)
          break
        }
      }
      items.push({ kind: 'tool_group', tools, timestamp: item.timestamp, reply })
    } else {
      items.push({ kind: 'message', item })
    }
  }
  return items
})
const historyLoading = ref(false)
const historyError = ref('')

// 日记
const showDiaryModal = ref(false)
const diaryLoading = ref(false)
const diaryError = ref('')
const diaryLoaded = ref(false)
// 是否正在提示用户日记访问受限（避免重复提示）
const isDiaryPrompting = ref(false)
const diaryRecords = ref<
  Array<{
    day: string
    summary: string
    facts: string
    dayLastTimestamp: string
    dayLastTimestampSec: number
  }>
>([])
const diaryPagination = ref({
  total: 0,
  count: 0,
  offset: 0,
  limit: 20
})

// 聊天快捷键
const chatShortcut = ref('')
// 是否正在捕获快捷键
const isCapturingShortcut = ref(false)

// 组件实例
const live2DManager = Live2DManager.getInstance()
const chatService = ChatManager.getInstance()
// 聊天框 IPC 事件监听清理函数数组
let removeChatBoxListeners: () => void
const diarySystem = new DiarySystem()
const assistantManager = AssistantManager.getInstance()
// 获取交互系统实例
const interactionSystem = InteractionSystem.getInstance()

const currentAssistant: Ref<AssistantInfo | null> = ref(null)

const avatarUrl = computed(() => {
  if (currentAssistant.value?.avatar) {
    return 'app-resource://' + currentAssistant.value.avatar
  }
  return '../assets/images/assistant_avatar_small.png'
})

const assistantName = computed(() => currentAssistant.value?.name ?? '助手')

// 当前助手的好感度
const currentLove = computed(() => currentAssistant.value?.userState.love || 0) // 当前好感度值
const canViewDiary = computed(() => currentLove.value > 100)

// 将任意数值限制在0到1之间
function clampVolume(value: number): number {
  return Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0))
}

/**
 *  将存储的音量值规范化为 0.0-1.0 范围，兼容旧配置格式
 * @param value
 */
function normalizeStoredVolume(value: number): number {
  if (!Number.isFinite(value)) {
    return 0.8
  }
  return clampVolume(value)
}

/**
 * 将 0.0-1.0 的标准化值转换为 0-100 的百分比值
 * @param value - 标准化值（0.0-1.0）
 * @returns 百分比值（0-100）
 */
function normalizedToPercent(value: number): number {
  return Math.round(normalizeStoredVolume(value) * 100)
}

/**
 * 将 0-100 的百分比值转换为 0.0-1.0 的标准化值
 * @param value - 百分比值（0-100）
 * @returns 标准化值（0.0-1.0）
 */
function percentToNormalized(value: number): number {
  return clampVolume(value / 100)
}

async function loadLive2DModel(): Promise<boolean> {
  try {
    const assistantAssets = await assistantManager.getAssistantAssets()

    if (assistantAssets && assistantAssets.live2d.modelJsonPath) {
      // 初始化Live2D模型
      await live2DManager.init(
        'l2d-canvas',
        'app-resource://' + assistantAssets.live2d.modelJsonPath
      )
    } else {
      await live2DManager.init('l2d-canvas', './turong/turong.model3.json')
    }

    live2DManager.initListeners()
    live2DManager.setLocked(isLocked.value)

    // 模型加载成功，淡入显示
    modelLoaded.value = true
    showError.value = false
    return true
  } catch (error) {
    console.error('加载Live2D模型失败:', error)
    showError.value = true
    return false
  }
}

async function sendOnboardingWelcomeIfNeeded(): Promise<void> {
  const fromRoute = route.query.welcome === 'true'
  if (fromRoute) {
    await chatService.sendMessage('您好，阁下！我是澪，您的专属助手，将满足您的所有愿望。')

    // 欢迎语只需要触发一次，触发后移除路由标记，避免切换 tab 重复触发
    const restQuery = { ...route.query }
    delete restQuery.welcome
    await router.replace({
      path: route.path,
      query: restQuery
    })
  }
}

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

onMounted(async () => {
  currentAssistant.value = await assistantManager.getCurrentAssistant()
  // 从配置加载快捷键设置
  chatShortcut.value = config.value.chatShortcut

  // 当前窗口显示时隐藏助手窗口
  window.api.assistant.closeAssistant()

  loadLive2DModel().then(async (code) => {
    // 模型加载成功后再发送欢迎语并启动交互系统，确保欢迎语的动作和语音能够正常播放
    if (!code) {
      return
    }
    await sendOnboardingWelcomeIfNeeded()
    registerLive2DEffects()
    registerLive2DInteractionBridge()

    // 读取配置中的睡眠状态，自动应用睡眠模式
    if (config.value.sleepMode) {
      live2DManager.enterSleepMode()
    }

    interactionSystem.start()
  })

  // 监听从工具栏（ChatBoxView）转发的聊天调用请求
  // 当桌宠模式未开启时，聊天请求降级到主窗口处理
  removeChatBoxListeners = window.api.chat.onInvokeRequest(async (data) => {
    try {
      const isSleepMode = interactionSystem.isSleepMode()
      await chatService.chat(data.text, isSleepMode, data.attachments)
      const history = await chatService.getChatHistory()
      window.api.chat.sendInvokeResult({
        requestId: data.requestId,
        success: true,
        history
      })
    } catch (error) {
      console.error('[AssistantSpace] 聊天请求失败:', error)
      window.api.chat.sendInvokeResult({
        requestId: data.requestId,
        success: false,
        error: String(error)
      })
    }
  })
})

onUnmounted(() => {
  const tabs = document.getElementById('tabs-container')
  tabs!.style.opacity = '1'
  // 清理聊天框 IPC 事件监听
  removeChatBoxListeners()
  if (configStore.config.assistantEnabled) {
    window.api.assistant.openAssistant()
  }
  interactionSystem.stop()
  live2DManager.destroy()
})

function switchChatBox(): void {
  const tabs = document.getElementById('tabs-container')

  if (isVisible.value) {
    isVisible.value = !isVisible.value
    tabs!.style.opacity = '1'
  } else {
    isVisible.value = !isVisible.value
    tabs!.style.opacity = '0'
  }
}

/**
 * 处理 ChatBox 组件发出的发送消息事件。
 * 与桌面宠物的 ChatBoxView 不同，助手空间内的 ChatBox 通过 emit 直连，
 * 不经过 IPC 广播，避免与 AssistantView 重复处理。
 */
async function handleChatBoxSend(text: string): Promise<void> {
  chatLoading.value = true
  try {
    const isSleepMode = interactionSystem.isSleepMode()
    await chatService.chat(text, isSleepMode)
  } finally {
    chatLoading.value = false
  }
}

/** 处理 ChatBox 组件发出的取消消息事件。 */
function handleChatBoxCancel(): void {
  chatService.interruptCurrentPlayback()
}

// 监听锁定状态变化
watch(isLocked, (newValue) => {
  live2DManager.setLocked(newValue)
})
// 监听音量变化
watch(volume, (newVolume) => {
  // 将 0-100 范围转换为 0.0-1.0 范围
  const normalizedVolume = percentToNormalized(newVolume)
  chatService.setVolume(normalizedVolume)
  if (Math.abs(normalizeStoredVolume(config.value.volume) - normalizedVolume) > 0.0001) {
    void configStore.updateConfig('volume', normalizedVolume)
  }
})

watch(
  () => config.value.volume,
  (rawVolume) => {
    const normalizedVolume = normalizeStoredVolume(rawVolume)
    const sliderValue = normalizedToPercent(normalizedVolume)
    if (volume.value !== sliderValue) {
      volume.value = sliderValue
    }

    chatService.setVolume(normalizedVolume)

    // 将旧格式体积值回写为标准 0-1，避免后续继续出现显示/设置不同步
    if (Math.abs(rawVolume - normalizedVolume) > 0.0001) {
      void configStore.updateConfig('volume', normalizedVolume)
    }
  },
  { immediate: true }
)

/**
 * 更新配置项
 * @param key - 配置项键
 * @param value - 新值
 */
function change<K extends keyof typeof config.value>(
  key: K,
  value: (typeof config.value)[K]
): void {
  configStore.updateConfig(key, value)
}

/**
 * 显示聊天历史弹窗
 */
function showChatHistory(): void {
  // 显示聊天历史弹窗
  showHistoryModal.value = true
  void loadChatHistory()
}

async function handleDiaryClick(): Promise<void> {
  if (canViewDiary.value) {
    showDiaryModal.value = true
    void loadDiaryRecords()
    return
  }

  if (isDiaryPrompting.value) {
    return
  }

  isDiaryPrompting.value = true
  try {
    if (chatService.getReplyStatus()) {
      return
    }

    await chatService.interactionChat({
      event_type: 'diary_access',
      // 场景
      scene: '用户尝试访问日记，但好感度不足，不要让用户偷看日记',
      context: {},
      generation_motion: false
    })
  } catch (error) {
    console.error('日记访问提示失败:', error)
  } finally {
    isDiaryPrompting.value = false
  }
}

async function loadDiaryRecords(forceReload: boolean = false): Promise<void> {
  if (diaryLoading.value) {
    return
  }

  if (diaryLoaded.value && !forceReload) {
    return
  }

  diaryLoading.value = true
  diaryError.value = ''

  try {
    const remoteDiary = await diarySystem.fetchDiaryRecords({
      limit: diaryPagination.value.limit,
      offset: 0
    })

    diaryRecords.value = remoteDiary.data
    diaryPagination.value = {
      total: remoteDiary.total,
      count: remoteDiary.count,
      offset: remoteDiary.offset,
      limit: remoteDiary.limit
    }
    diaryLoaded.value = true
  } catch (error) {
    console.error('加载助手日记失败:', error)
    diaryError.value = '日记加载失败，请稍后再试'
    diaryRecords.value = []
  } finally {
    diaryLoading.value = false
  }
}

/**
 * 关闭聊天历史弹窗
 */
function closeHistoryModal(): void {
  // 关闭聊天历史弹窗
  showHistoryModal.value = false
}

function closeDiaryModal(): void {
  showDiaryModal.value = false
}

/**
 * 清空聊天记录：通过 ChatManager 清空本地 + 云端聊天记录。
 */
async function handleClearHistory(): Promise<void> {
  try {
    await chatService.clearChatHistory()
    // 清空本地历史显示
    chatHistory.value = []
  } catch (err) {
    console.warn('清空聊天记录失败:', err)
  }
}

/**
 * 加载聊天历史
 *
 * 优先展示 ChatManager 的本地缓存（保证与当前对话实时一致），
 * 再异步从后端 API 拉取完整记录补充。
 */
async function loadChatHistory(): Promise<void> {
  historyLoading.value = true
  historyError.value = ''

  // 先展示主进程缓存，保证即时响应
  try {
    const localHistory = await chatService.getChatHistory()
    chatHistory.value = buildHistoryItems(localHistory)
  } catch {
    // 忽略，后续远端请求会覆盖
  }
  historyLoading.value = false

  // 异步拉取远端记录，补充来自其他会话的历史
  try {
    const remoteHistory = await chatService.fetchChatHistory()
    chatHistory.value = buildHistoryItems(remoteHistory)
  } catch (error) {
    console.error('加载远程聊天历史失败，仅显示本地记录:', error)
  }
}

function formatDiaryTimestamp(timestamp: string): string {
  if (!timestamp) {
    return '--:--'
  }

  const normalized = timestamp.replace(' ', 'T')
  const parsed = new Date(normalized)
  if (Number.isNaN(parsed.getTime())) {
    return timestamp
  }

  return parsed.toLocaleString([], {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  })
}

function buildHistoryItems(messages: ChatMessage[]): Array<{
  role: 'user' | 'assistant' | 'tool'
  content: string | ContentPart[] | null
  timestamp: Date | null
  tool_calls?: ToolCall[]
  tool_call_id?: string
}> {
  let lastTimestamp: Date | null = null

  return messages.map((item) => {
    const parsedTimestamp = parseTimestampFromContent(item.content ?? '')
    let content: string | ContentPart[] | null = item.content
    if (item.role === 'user' && typeof item.content === 'string') {
      // 移除旧版后端前缀
      let cleanText = (
        item.content.match(/用户对话内容或动作:\s*([\s\S]*?)$/)?.[1] || item.content
      ).trim()
      // 如果是纯字符串内容，尝试解析其中的 [图片:]/[文件:]/[附件:] 标记
      const parsed = normalizeContent(cleanText)
      if (parsed && parsed.length > 0) {
        content = parsed
      } else {
        content = cleanText
      }
    }
    if (parsedTimestamp) {
      lastTimestamp = parsedTimestamp
    }

    return {
      role: item.role,
      content,
      timestamp: parsedTimestamp || lastTimestamp,
      ...(item.tool_calls ? { tool_calls: item.tool_calls } : {}),
      ...(item.tool_call_id ? { tool_call_id: item.tool_call_id } : {})
    }
  })
}

//格式化日期
function parseTimestampFromContent(content: string | ContentPart[] | null): Date | null {
  if (!content) return null
  if (Array.isArray(content)) {
    for (const part of content) {
      if (part.type === 'text') {
        const result = extractTimestamp(part.text)
        if (result) return result
      }
    }
    return null
  }
  return extractTimestamp(content)
}

function extractTimestamp(text: string): Date | null {
  const matched = text.match(/当前时间[:：]\s*(\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}:\d{2})/)
  if (!matched?.[1]) {
    return null
  }
  const normalized = matched[1].replace(' ', 'T')
  const parsed = new Date(normalized)
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

/**
 * 切换助手设置弹窗显示状态
 */
function toggleAssistantSettings(): void {
  // 显示助手设置弹窗
  isVisibleSetting.value = !isVisibleSetting.value
}

/**
 * 重置模型位置
 */
function resetModelPosition(): void {
  // 重置模型位置
  live2DManager.resetModelTransform()
}

/**
 * 开始捕获快捷键
 */
function startCaptureShortcut(): void {
  isCapturingShortcut.value = true
  chatShortcut.value = '请按下快捷键...'

  // 添加全局键盘事件监听器
  document.addEventListener('keydown', handleKeyDown)
  document.addEventListener('keyup', handleKeyUp)
}

// 处理键盘按下事件
function handleKeyDown(event: KeyboardEvent): void {
  // 阻止默认行为，避免触发浏览器快捷键
  event.preventDefault()

  // 只有在捕获模式下才处理
  if (!isCapturingShortcut.value) return

  // 收集按下的修饰键
  const modifiers: string[] = []
  if (event.ctrlKey) modifiers.push('Ctrl')
  if (event.altKey) modifiers.push('Alt')
  if (event.shiftKey) modifiers.push('Shift')
  if (event.metaKey) modifiers.push('Meta')

  // 获取主要按键（排除修饰键）
  const key = event.key.length === 1 ? event.key.toUpperCase() : event.key

  // 只有当有修饰键并且有主要按键时才更新显示
  if (modifiers.length > 0 && key && !['Control', 'Alt', 'Shift', 'Meta'].includes(key)) {
    const shortcut = [...modifiers, key].join('+')
    chatShortcut.value = shortcut
  } else if (modifiers.length > 0) {
    // 只显示修饰键
    chatShortcut.value = modifiers.join('+') + '+...'
  }
}

// 处理键盘释放事件
function handleKeyUp(event: KeyboardEvent): void {
  // 只有在捕获模式下才处理
  if (!isCapturingShortcut.value) return

  // 收集按下的修饰键和主要按键
  const modifiers: string[] = []
  if (event.ctrlKey) modifiers.push('Ctrl')
  if (event.altKey) modifiers.push('Alt')
  if (event.shiftKey) modifiers.push('Shift')
  if (event.metaKey) modifiers.push('Meta')

  // 获取主要按键（排除修饰键）
  const key = event.key.length === 1 ? event.key.toUpperCase() : event.key

  // 当用户完成快捷键输入（释放最后一个键）时，保存设置
  if (modifiers.length > 0 && key && !['Control', 'Alt', 'Shift', 'Meta'].includes(key)) {
    const shortcut = [...modifiers, key].join('+')
    saveShortcut(shortcut)
  }
}

// 保存快捷键设置
async function saveShortcut(shortcut: string): Promise<void> {
  // 停止捕获模式
  isCapturingShortcut.value = false
  chatShortcut.value = shortcut

  // 移除事件监听器
  document.removeEventListener('keydown', handleKeyDown)
  document.removeEventListener('keyup', handleKeyUp)

  console.log('尝试注册快捷键:', shortcut)

  const result = await window.api.assistant.registerChatShortcut(shortcut)
  if (result) {
    // 保存到配置
    await configStore.updateConfig('chatShortcut', shortcut)
    console.log('快捷键设置成功')
  } else {
    console.error('快捷键设置失败')
  }
}
</script>

<style scoped>
#background-container {
  /* margin-top: 30px; */
  /* background-color: #fff9f9; */
  background-color: #ffeef0;
  background-image: url('../assets/images/background_circle.png');
}

.divider {
  width: 100%;
  height: 1px;
  background-color: #e0e0e0;
  margin-top: 10px;
  margin-bottom: 10px;
}

.setting-container {
  width: 50vw;
  height: 60vh;
  overflow-y: auto;
  scrollbar-width: none;
  padding: 30px;
}

.setting-title {
  display: flex;
  font-size: 20px;
  font-weight: bold;
  margin-top: 20px;
  margin-left: 5px;
}

.setting-item {
  display: flex;
  background-color: white;
  border-radius: 15px;
  padding: 20px;
  flex-direction: column;
  margin-bottom: 20px;
  margin-top: 10px;
}

.setting-from {
  height: 40px;
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.setting-from .title {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  justify-content: space-between;
}

.setting-from .title .description {
  font-size: 12px;
  color: gray;
}

#live2d-container {
  height: 100vh;
  width: 100vw;
  position: relative;
  overflow: hidden;
}

#live2d-container.locked {
  cursor: default;
}

#l2d-canvas {
  width: 100%;
  height: 100%;
  display: block;
  opacity: 0;
  transition: opacity 1s ease-in-out;
}

#l2d-canvas.canvas-fade-in {
  opacity: 1;
}

.message-form {
  position: absolute;
  top: 50%;
  z-index: 10;
}

#toolbar-right-top {
  position: absolute;
  top: 15%;
  right: 7%;
  width: 70px;
  height: auto;
}

#toolbar-right-bottom {
  position: absolute;
  bottom: 15%;
  right: 7%;
  width: 70px;
  height: auto;
}

#toolbar-left-top {
  position: absolute;
  top: 12%;
  left: 7%;
}

.circle-button {
  width: 70px;
  height: 70px;
  margin-bottom: 20px;
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

.circle-button:hover {
  transform: translateY(-3px);
}

.diary-button.is-locked {
  opacity: 0.65;
  box-shadow: 1px 1px 8px #fb729940;
}

.diary-button.is-locked:hover {
  transform: none;
}

.diamond-button {
  position: relative;
  width: 60px;
  height: 60px;
  margin-bottom: 20px;
  border-radius: 10px;
  border: 2px solid #ffc0d6;
  color: #fb7299;
  font-size: 30px;
  box-shadow: 0px 0px 10px #fb72995d;
  background-color: white;
  display: flex;
  justify-content: center;
  align-items: center;
  transform: rotate(45deg);
  transition: all 0.2s ease-in-out;
}

.diamond-button:hover {
  transform: rotate(-45deg);
}

#chatBox {
  bottom: 80px;
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

/* 添加聊天历史弹窗样式和动画 */
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background-color: rgba(0, 0, 0, 0.5);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 1000;
}

.chat-history-modal {
  background-color: white;
  border-radius: 15px;
  width: 90%;
  max-width: 600px;
  max-height: 80vh;
  overflow: hidden;
  box-shadow: 0 5px 20px rgba(0, 0, 0, 0.3);
  display: flex;
  flex-direction: column;
}

.modal-header {
  position: relative;
  padding: 10px;
  height: 50px !important;
  background-color: #f982a6;
  color: white;
  display: flex;
  align-items: center;
  font-family: 'LoliFont';
  overflow: hidden;
}

/* 左右两侧多排淡白色圆点装饰，铺满高度 */
.modal-header::before,
.modal-header::after {
  content: '';
  position: absolute;
  top: 0;
  bottom: 0;
  width: 100px;
  pointer-events: none;
}

.modal-header::before {
  left: 0;
  background:
    radial-gradient(circle at 5px 50%, rgba(255, 255, 255, 0.3) 4px, transparent 4px) 0 0 / 100px
      8px repeat-y,
    radial-gradient(circle at 13px 50%, rgba(255, 255, 255, 0.3) 3.6px, transparent 3.6px) 0 0 /
      100px 8px repeat-y,
    radial-gradient(circle at 21px 50%, rgba(255, 255, 255, 0.3) 3.2px, transparent 3.2px) 0 0 /
      100px 8px repeat-y,
    radial-gradient(circle at 29px 50%, rgba(255, 255, 255, 0.3) 2.9px, transparent 2.9px) 0 0 /
      100px 8px repeat-y,
    radial-gradient(circle at 37px 50%, rgba(255, 255, 255, 0.3) 2.6px, transparent 2.6px) 0 0 /
      100px 8px repeat-y,
    radial-gradient(circle at 45px 50%, rgba(255, 255, 255, 0.3) 2.3px, transparent 2.3px) 0 0 /
      100px 8px repeat-y,
    radial-gradient(circle at 53px 50%, rgba(255, 255, 255, 0.3) 2px, transparent 2px) 0 0 / 100px
      8px repeat-y,
    radial-gradient(circle at 61px 50%, rgba(255, 255, 255, 0.3) 1.8px, transparent 1.8px) 0 0 /
      100px 8px repeat-y,
    radial-gradient(circle at 69px 50%, rgba(255, 255, 255, 0.3) 1.6px, transparent 1.6px) 0 0 /
      100px 8px repeat-y,
    radial-gradient(circle at 77px 50%, rgba(255, 255, 255, 0.3) 1.4px, transparent 1.4px) 0 0 /
      100px 8px repeat-y,
    radial-gradient(circle at 85px 50%, rgba(255, 255, 255, 0.3) 1.2px, transparent 1.2px) 0 0 /
      100px 8px repeat-y,
    radial-gradient(circle at 93px 50%, rgba(255, 255, 255, 0.3) 1px, transparent 1px) 0 0 / 100px
      8px repeat-y;
}

.modal-header::after {
  right: 0;
  background:
    radial-gradient(circle at calc(100% - 5px) 50%, rgba(255, 255, 255, 0.3) 4px, transparent 4px) 0
      0 / 100px 8px repeat-y,
    radial-gradient(
        circle at calc(100% - 13px) 50%,
        rgba(255, 255, 255, 0.3) 3.6px,
        transparent 3.6px
      )
      0 0 / 100px 8px repeat-y,
    radial-gradient(
        circle at calc(100% - 21px) 50%,
        rgba(255, 255, 255, 0.3) 3.2px,
        transparent 3.2px
      )
      0 0 / 100px 8px repeat-y,
    radial-gradient(
        circle at calc(100% - 29px) 50%,
        rgba(255, 255, 255, 0.3) 2.9px,
        transparent 2.9px
      )
      0 0 / 100px 8px repeat-y,
    radial-gradient(
        circle at calc(100% - 37px) 50%,
        rgba(255, 255, 255, 0.3) 2.6px,
        transparent 2.6px
      )
      0 0 / 100px 8px repeat-y,
    radial-gradient(
        circle at calc(100% - 45px) 50%,
        rgba(255, 255, 255, 0.3) 2.3px,
        transparent 2.3px
      )
      0 0 / 100px 8px repeat-y,
    radial-gradient(circle at calc(100% - 53px) 50%, rgba(255, 255, 255, 0.3) 2px, transparent 2px)
      0 0 / 100px 8px repeat-y,
    radial-gradient(
        circle at calc(100% - 61px) 50%,
        rgba(255, 255, 255, 0.3) 1.8px,
        transparent 1.8px
      )
      0 0 / 100px 8px repeat-y,
    radial-gradient(
        circle at calc(100% - 69px) 50%,
        rgba(255, 255, 255, 0.3) 1.6px,
        transparent 1.6px
      )
      0 0 / 100px 8px repeat-y,
    radial-gradient(
        circle at calc(100% - 77px) 50%,
        rgba(255, 255, 255, 0.3) 1.4px,
        transparent 1.4px
      )
      0 0 / 100px 8px repeat-y,
    radial-gradient(
        circle at calc(100% - 85px) 50%,
        rgba(255, 255, 255, 0.3) 1.2px,
        transparent 1.2px
      )
      0 0 / 100px 8px repeat-y,
    radial-gradient(circle at calc(100% - 93px) 50%, rgba(255, 255, 255, 0.3) 1px, transparent 1px)
      0 0 / 100px 8px repeat-y;
}

.modal-header-left,
.modal-header-right {
  width: 50px;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
  z-index: 1;
}

.modal-header h2 {
  flex: 1;
  text-align: center;
  margin: 0;
  font-size: 1.5rem;
  position: relative;
  z-index: 1;
}

.modal-header-btn {
  width: 30px;
  height: 30px;
  border: none;
  background: transparent;
  color: rgba(255, 255, 255, 0.8);
  border-radius: 8px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 17px;
  transition: all 0.2s ease;
  position: relative;
  z-index: 1;
}

.modal-header-btn:hover {
  background: rgba(255, 255, 255, 0.2);
  color: white;
}

.modal-body {
  padding: 20px;
  overflow-y: auto;
  flex-grow: 1;
}

.no-history {
  text-align: center;
  color: #999;
  font-style: italic;
  padding: 40px 0;
}

.history-list {
  display: flex;
  flex-direction: column;
  gap: 15px;
}

/* 消息渲染由 ChatMessageItem 组件接管 */

/* 淡入淡出动画 */
.modal-fade-enter-active {
  transition: opacity 0.3s ease;
}

.modal-fade-leave-active {
  transition: opacity 0.3s ease;
}

.modal-fade-enter-from,
.modal-fade-leave-to {
  opacity: 0;
}

/* 弹窗缩放动画（可选，增强效果） */
.modal-fade-enter-from .chat-history-modal {
  transform: scale(0.9);
  transition: transform 0.3s ease;
}

.modal-fade-enter-to .chat-history-modal {
  transform: scale(1);
}

.modal-fade-leave-from .chat-history-modal {
  transform: scale(1);
}

.modal-fade-leave-to .chat-history-modal {
  transform: scale(0.9);
  transition: transform 0.3s ease;
}

#assistant-love {
  width: 120px;
  height: 120px;
  position: relative;
  background-color: white;
  /* background: linear-gradient(to top left, #fbd786, #fb7299); */
  border: 1px solid #ffc0d6;
  box-shadow: 2px 2px 10px #fb72995d;
  border-radius: 20px;
  display: flex;
  justify-content: center;
  flex-direction: column;
  margin-bottom: 20px;
  align-items: start;
  padding: 10px;
}

#assistant-love .head-img {
  width: 100%;
  height: 50px;
  border-radius: 10px;
  background-color: #ffcddec9;
  margin-bottom: 3px;
  background-size: 70px;
  background-position: center;
}

#assistant-love .name {
  height: 13px;
  color: #fb7299;
  font-weight: bold;
  font-family: 'LoliFont';
  font-size: 13px;
}

#assistant-love .love-level {
  color: gray;
  font-size: 10px;
}

/* 进度条容器 */
.progress-container {
  display: flex;
  flex-direction: row;
  align-items: center;
  justify-content: space-between;
  width: 100%;
}

/* 进度条背景 */
.progress-bar-background {
  width: 100%;
  height: 6px;
  background-color: #ffe6f0; /* 淡粉色背景 */
  border-radius: 3px;
  overflow: hidden;
}

/* 进度条填充 */
.progress-bar-fill {
  height: 100%;
  background-color: #fb7299; /* 粉色进度条 */
  border-radius: 3px;
  transition: width 0.3s ease;
}

/* 进度文本样式 */
#love-icon {
  color: #fb7299;
  font-size: 12px;
  font-weight: bold;
}

.setting-input {
  width: auto;
  max-width: 200px;
  padding: 10px 12px;
  border: 2px solid #e0e0e0;
  border-radius: 8px;
  font-size: 14px;
  transition: border-color 0.2s;
}

.setting-input:focus {
  outline: none;
  border-color: var(--theme-color-light);
}
</style>
