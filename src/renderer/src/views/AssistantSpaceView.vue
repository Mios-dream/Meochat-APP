<template>
  <div id="background-container">
    <div id="live2d-container">
      <AssistantTips :is-active="isTipsActive" font-size="20px">
        {{ currentTip }}
      </AssistantTips>

      <canvas id="l2d-canvas"></canvas>
      <LoadingProgress :progress="loadingProgress" />
    </div>
    <div id="toolbar-right-top">
      <div class="diamond-button" @click="toggleAssistantSettings">
        <font-awesome-icon icon="fa-solid fa-gear" />
      </div>
    </div>
    <div id="toolbar-left-top">
      <div id="assistant-love">
        <div class="head-img"></div>
        <div class="name">澪</div>
        <div class="progress-container">
          <div id="love-icon"><font-awesome-icon icon="fa-solid fa-heart" /></div>
          <div class="progress-bar-background">
            <div class="progress-bar-fill" :style="{ width: '50%' }"></div>
          </div>
        </div>
        <div class="love-level">一级</div>
      </div>
    </div>
    <div id="toolbar-right-bottom">
      <div class="circle-button" @click="toggleLock">
        <font-awesome-icon v-if="isLocked" icon="fa-solid fa-lock" />
        <font-awesome-icon v-else icon="fa-solid fa-lock-open" />
      </div>
      <div class="circle-button" @click="showChatHistory">
        <font-awesome-icon icon="fa-solid fa-message" />
      </div>
      <div class="circle-button" @click="switchChatBox">
        <font-awesome-icon icon="fa-solid fa-comments" />
      </div>
    </div>

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

      <button id="message-icon" :disabled="loading" @click="handleSubmit">
        <font-awesome-icon :icon="loading ? 'spinner' : 'paper-plane'" :spin="loading" />
      </button>
    </div>
    <transition name="modal-fade">
      <div v-if="showHistoryModal" class="modal-overlay" @click="closeHistoryModal">
        <div class="chat-history-modal" @click.stop>
          <div class="modal-header">
            <h2>聊天历史</h2>
          </div>
          <div class="modal-body">
            <div v-if="chatHistory.length === 0" class="no-history">暂无聊天历史</div>
            <div v-else class="history-list">
              <div v-for="(message, index) in chatHistory" :key="index">
                <div v-if="message.type === 'assistant'" class="message-item">
                  <div class="assistant-chat-avatar"></div>
                  <div class="message-content">
                    <div class="message-info">
                      <div class="assistant-name">澪</div>
                      <div class="message-time">{{ formatTime(message.timestamp) }}</div>
                    </div>
                    <div :class="['message-text', message.type]">{{ message.text }}</div>
                  </div>
                </div>
                <div v-else>
                  <div class="message-content">
                    <div :class="['message-text', message.type]">{{ message.text }}</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </transition>
    <BlurModal v-model="isVisibleSetting" @close="closeHistoryModal">
      <div class="setting-container">
        <div class="setting-title">助手设置</div>
        <div class="setting-item">
          <form class="setting-from">
            <label for="lock-assistant">锁定助手</label>
            <ToggleSwitch v-model="isLocked" />
          </form>
          <div class="divider"></div>
          <form class="setting-from">
            <label for="lock-assistant">是否启用桌面助手自动语音识别聊天</label>
            <ToggleSwitch
              v-model="config.autoChat"
              @update:model-value="(v) => change('autoChat', v)"
            />
          </form>
          <div class="divider"></div>
          <form class="setting-from">
            <label for="app-speech-board">应用内台词板</label>
            <ToggleSwitch v-model="isLocked" />
          </form>
          <div class="divider"></div>
          <form class="setting-from">
            <label for="desktop-speech-board">桌面台词板</label>
            <ToggleSwitch v-model="isLocked" />
          </form>
          <div class="divider"></div>
          <form class="setting-from">
            <label for="assistant-volume">助手音量</label>
            <div style="width: 200px">
              <VolumeSlider v-model="volume" label="" :min="0" :max="100" :step="10" unit="" />
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
      </div>
    </BlurModal>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, Ref, watch } from 'vue'
import { ChatService } from '../server/ChatService'
import { Live2DManager } from '../server/Live2dManager'
import AssistantTips from '../components/AssistantTips.vue'
import LoadingProgress from '../components/LoadingProgress.vue'
import BlurModal from '../components/BlurModal.vue'
import ToggleSwitch from '../components/ToggleSwitch.vue'
import VolumeSlider from '../components/VolumeSlider.vue'
import RoundedButton from '../components/RoundedButton.vue'
import { useConfigStore } from '../stores/useConfigStore'
import { storeToRefs } from 'pinia'

const configStore = useConfigStore()
const { config } = storeToRefs(configStore)

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
// 是否显示设置菜单
const isVisibleSetting = ref(false)
// 音量
const volume = ref(50)

// 模型设置
const isLocked = ref(true)

// 聊天历史
const showHistoryModal = ref(false)
const chatHistory = ref<Array<{ text: string; type: string; timestamp: Date }>>([])

// 组件实例
const live2DManager = Live2DManager.getInstance()
const chatService = ChatService.getInstance()

live2DManager.focus_timeout_ms = 500

onMounted(async () => {
  // 接收来自主进程的消息，是否显示消息
  window.api.ipcRenderer.on('show-assistant-message', (data) => {
    chatService.showTempMessage(data.text, data.timeout, data.priority)
  })

  window.api.ipcRenderer.on('chat-box:send-message', async (_event, data) => {
    console.log('收到请求:', data)
    await chatService.chat(data.text).then(() => {
      window.api.ipcRenderer.send('loading-state-changed', false)
    })
  })
  // 当前窗口显示时隐藏助手窗口
  window.api.hideAssistant()
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
    await live2DManager.init('l2d-canvas', './turong/turong.model3.json')

    live2DManager.initBaseListeners()

    live2DManager.setLocked(isLocked.value)

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
  window.api.ipcRenderer.removeAllListeners('show-assistant-message')
  window.api.ipcRenderer.removeAllListeners('chat-box:send-message')

  const tabs = document.getElementById('tabs-container')
  tabs!.style.opacity = '1'
  window.api.showAssistant()
  live2DManager.destroy()
})

async function handleSubmit(): Promise<void> {
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
      priority: 1
    })
  }
}

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

function toggleLock(): void {
  isLocked.value = !isLocked.value
}

// 监听锁定状态变化
watch(isLocked, (newValue) => {
  live2DManager.setLocked(newValue)
})
// 监听音量变化
watch(volume, (newVolume) => {
  // 将 0-100 范围转换为 0.0-1.0 范围
  const normalizedVolume = newVolume / 100
  chatService.setVolume(normalizedVolume)
  configStore.updateConfig('volume', normalizedVolume)
})

function change<K extends keyof typeof config.value>(
  key: K,
  value: (typeof config.value)[K]
): void {
  configStore.updateConfig(key, value)
}

// 在现有函数基础上添加新函数
function showChatHistory(): void {
  // 显示聊天历史弹窗
  showHistoryModal.value = true

  // 这里可以从本地存储或API获取聊天历史
  loadChatHistory()
}

function closeHistoryModal(): void {
  // 关闭聊天历史弹窗
  showHistoryModal.value = false
}

function loadChatHistory(): void {
  // 模拟加载聊天历史
  chatHistory.value = []
}

function formatTime(timestamp: Date): string {
  // 格式化时间显示
  return timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

function toggleAssistantSettings(): void {
  // 显示助手设置弹窗
  isVisibleSetting.value = !isVisibleSetting.value
}

function resetModelPosition(): void {
  // 重置模型位置
  live2DManager.resetModelTransform()
}
</script>

<style scoped>
#background-container {
  margin-top: 30px;
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
  padding: 10px;
  background-color: #f982a6;
  color: white;
  display: flex;
  justify-content: center;
  align-items: center;
  font-family: 'LoliFont';
}

.modal-header h2 {
  margin: 0;
  font-size: 1.5rem;
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

.message-item {
  padding: 12px 15px;
  border-radius: 10px;
  width: 100%;
  display: flex;
  flex-direction: row;
}

.assistant-chat-avatar {
  background-image: url('../assets/images/assistant_avatar_small.png');
  background-size: cover;
  width: 50px;
  height: 50px;
  border-radius: 100%;
  border: 1px solid #f982a6;
  margin-right: 10px;
  flex-shrink: 0;
}

.message-content {
  flex: 1; /* 占据剩余空间 */
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.message-info {
  width: 100%;
  height: 20px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 15px;
  color: #656565;
  margin-bottom: 10px;
}

.message-text {
  margin-bottom: 5px;
  padding: 10px;
  color: #656565;
  border-radius: 10px;
  display: inline-block;
  max-width: 90%; /* 限制最大宽度为容器的80% */
  word-wrap: break-word;
  white-space: pre-wrap;
  box-sizing: border-box;
}

.message-text.assistant {
  background-color: #fff3f5;
  align-self: flex-start;
}

.message-text.user {
  background-color: #f5f5f5;
  align-self: flex-end;
}

.message-time {
  font-size: 15px;
  color: #656565;
  text-align: right;
}

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
  padding: 5px 10px;
}

#assistant-love .head-img {
  width: 100%;
  height: 50px;
  border-radius: 10px;
  background-color: #ffcddec9;
  margin-bottom: 3px;
  background-image: url('../assets/images/assistant_avatar_small.png');
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
</style>
