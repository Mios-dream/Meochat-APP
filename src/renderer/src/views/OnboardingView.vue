<template>
  <aside class="titlebar">
    <div class="titlebar-icons">
      <div
        v-for="(item, index) in titlebarIcons"
        :key="index"
        class="titlebar-item"
        :style="{ backgroundColor: item.color }"
        :title="item.text"
        @click="item.action"
      ></div>
    </div>
  </aside>
  <div class="onboarding-root" :class="{ dissolving: isDissolving }">
    <div class="onboarding-panel" :class="{ 'slogan-panel': currentStep === 'slogan' }">
      <transition name="content-fade" mode="out-in">
        <section :key="currentStep" class="step-content">
          <template v-if="currentStep === 'local'">
            <h2>正在检查环境</h2>
            <p class="hint">这可能需要几分钟，阁下请耐心等待</p>

            <ul class="task-list">
              <li v-for="task in sortedTasks" :key="task.id" class="task-item">
                <div class="task-info" @click="showLogs = !showLogs">
                  <div class="task-header">
                    <strong>智慧核心</strong>
                    <span :class="['task-state', taskStateClass(task.id)]">
                      {{ taskStateText(task.id) }}
                    </span>
                  </div>
                  <small>助手运行的必须服务</small>
                  <div class="task-progress">
                    <div class="progress-bar-small">
                      <div
                        class="progress-fill-small"
                        :class="{ 'progress-running': taskStateClass(task.id) === 'running' }"
                      ></div>
                    </div>
                  </div>
                </div>
              </li>
            </ul>

            <div v-if="showLogs" class="log-box">
              <div class="log-title">运行日志</div>
              <div ref="logContainerRef" class="log-content">
                <div v-for="(line, idx) in logLines" :key="idx" class="log-line">{{ line }}</div>
              </div>
            </div>

            <p v-if="localError" class="error-text">{{ localError }}</p>

            <div class="actions">
              <button class="btn btn-ghost" :disabled="localRunning" @click="switchToApiMode">
                切换 API 模式
              </button>
              <button class="btn" :disabled="localRunning" @click="retryLocalFlow">
                {{ localRunning ? '正在重试...' : '重试' }}
              </button>
            </div>
          </template>

          <template v-else-if="currentStep === 'api'">
            <h2>连接远程 API</h2>
            <p class="hint">阁下，如果需要连接到远程 API 服务，请填写以下信息。</p>

            <label class="field">
              <span>API 地址（host:port）</span>
              <input
                v-model="apiAddress"
                type="text"
                placeholder="例如 127.0.0.1:8001"
                :disabled="apiChecking"
              />
            </label>

            <p class="sub-hint">健康检查地址：{{ apiHealthPreview }}</p>
            <p v-if="apiError" class="error-text">{{ apiError }}</p>

            <div class="actions">
              <button class="btn btn-ghost" :disabled="apiChecking" @click="switchToLocalMode">
                切换本地模式
              </button>
              <button class="btn" :disabled="apiChecking" @click="connectApiMode">
                {{ apiChecking ? '连接中...' : '验证' }}
              </button>
            </div>
          </template>

          <template v-else-if="currentStep === 'loading'">
            <h2>正在加载助手资料与资源</h2>
            <p class="hint">马上就好，请稍作等待，我正在为阁下准备助手档案与资源文件。</p>

            <div class="progress-wrap">
              <div class="progress-bar">
                <div class="progress-fill" :style="{ width: `${assistantProgress}%` }"></div>
              </div>
              <span>{{ assistantProgress }}%</span>
            </div>

            <p class="sub-hint">{{ assistantProgressHint }}</p>
            <p v-if="assistantLoadError" class="error-text">{{ assistantLoadError }}</p>

            <div v-if="assistantLoadError" class="actions">
              <button class="btn" @click="retryAssistantLoading">重新加载</button>
            </div>
          </template>

          <template v-else-if="currentStep === 'profile'">
            <h2>完善阁下的资料</h2>
            <p class="hint">初次见面，可以让我更多的了解一下阁下吗？</p>

            <div class="profile-grid">
              <label class="field">
                <span>生日</span>
                <input v-model="profile.birthday" type="date" />
              </label>

              <label class="field">
                <span>性别</span>
                <select v-model="profile.gender">
                  <option value="">请选择</option>
                  <option value="女">女</option>
                  <option value="男">男</option>
                  <option value="其他">其他</option>
                </select>
              </label>

              <label class="field field-full">
                <span>职业</span>
                <input v-model="profile.occupation" type="text" placeholder="例如：上班族、学生" />
              </label>
            </div>

            <p v-if="profileError" class="error-text">{{ profileError }}</p>

            <div class="actions">
              <button class="btn" :disabled="savingProfile" @click="submitProfile">
                {{ savingProfile ? '保存中...' : '完成' }}
              </button>
            </div>
          </template>

          <template v-else-if="currentStep === 'slogan'">
            <div class="slogan-wrap">
              <p class="slogan" :aria-label="sloganText">
                <span
                  v-for="(char, index) in sloganText"
                  :key="`${char}-${index}`"
                  class="slogan-char"
                  :style="{ '--char-delay': `${index * 90}ms` }"
                >
                  {{ char }}
                </span>
              </p>
            </div>
          </template>
        </section>
      </transition>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, reactive, ref, watch } from 'vue'
import { useRouter } from 'vue-router'

import { useConfigStore } from '../stores/useConfigStore'
import { AssistantManager } from '../services/assistantManager'
import TaskManager from '../services/TaskManager'
import { OnboardingMode, OnboardingProfile } from '../types/onboarding'

type OnboardingStep = 'local' | 'api' | 'loading' | 'profile' | 'slogan'

const router = useRouter()
const configStore = useConfigStore()
const assistantManager = AssistantManager.getInstance()
const taskManager = TaskManager.getInstance()

const currentStep = ref<OnboardingStep>('loading')
const currentMode = ref<OnboardingMode>('')
const localRunning = ref(false)
const apiChecking = ref(false)
const savingProfile = ref(false)
// 是否正在消失
const isDissolving = ref(false)

const localError = ref('')
const apiError = ref('')
const profileError = ref('')
const assistantLoadError = ref('')

const apiAddress = ref('')
const assistantProgress = ref(0)
const assistantProgressHint = ref('等待下载事件...')
const logLines = computed(() => taskManager.localStartupLogs.value)

const logContainerRef = ref<HTMLElement | null>(null)
const sortedTasks = taskManager.tasks
const showLogs = ref(false)
const sloganText = '这里是澪，从此刻起，将常驻于您的屏幕角落'

const profile = reactive<OnboardingProfile>({
  birthday: '',
  gender: '',
  occupation: ''
})

const apiHealthPreview = computed(() => {
  const addr = apiAddress.value.trim()
  return addr ? `http://${addr}/api/health` : 'http://<host:port>/api/health'
})

const titlebarIcons = [
  {
    color: '#f3bc4f',
    text: '最小化',
    action: () => {
      window.api.minimizeApp()
    }
  },
  {
    color: '#64c857',
    text: '最大化',
    action: () => {
      window.api.maximizeApp()
    }
  },
  {
    color: '#e97168',
    text: '关闭',
    action: () => {
      window.api.hideApp()
    }
  }
]

function taskStateClass(taskId: number): string {
  return taskManager.getStartupTaskStateClass(taskId)
}

function taskStateText(taskId: number): string {
  return taskManager.getStartupTaskStateText(taskId)
}

function appendLog(line: string): void {
  if (!line) {
    return
  }

  taskManager.appendLocalSystemLog(line.replace(/^\[系统\]\s*/, ''))

  void nextTick(() => {
    if (logContainerRef.value) {
      logContainerRef.value.scrollTop = logContainerRef.value.scrollHeight
    }
  })
}

function normalizeApiAddress(address: string): string {
  return address
    .replace(/^https?:\/\//i, '')
    .replace(/\/$/, '')
    .trim()
}

function validateApiAddress(address: string): boolean {
  const pattern = /^[\w.-]+:\d+$/
  return pattern.test(address)
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms)
  })
}

async function checkApiHealth(address: string, attempts = 1): Promise<boolean> {
  const normalizedAddress = normalizeApiAddress(address)

  for (let i = 0; i < attempts; i++) {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 5000)

    try {
      const response = await fetch(`http://${normalizedAddress}/api/health`, {
        method: 'GET',
        signal: controller.signal
      })
      const result = await response.json()

      if (response.ok && result.status === 'ok') {
        clearTimeout(timeout)
        return true
      }
    } catch {
      // 忽略当前轮次异常，继续重试
    } finally {
      clearTimeout(timeout)
    }

    if (i < attempts - 1) {
      await wait(1300)
    }
  }

  return false
}

function onAssistantDownloadProgress(
  _event,
  payload: { assistantName: string; progress: number }
): void {
  assistantProgress.value = Math.max(0, Math.min(100, payload.progress))
  assistantProgressHint.value = `正在下载 ${payload.assistantName} 的资源...`
}

async function connectLocalMode(): Promise<void> {
  currentStep.value = 'local'
  currentMode.value = 'local-python'
  await window.api.onboarding.setMode('local-python')

  localRunning.value = true
  localError.value = ''

  const address = normalizeApiAddress(configStore.config.baseUrl || '127.0.0.1:8001')

  try {
    const startResult = await taskManager.startLocalTasks(sortedTasks.value)
    if (!startResult.success) {
      localError.value = startResult.error || '本地服务启动失败，请查看日志。'
      return
    }

    appendLog('[系统] 开始检测 API 健康状态')
    const healthOk = await checkApiHealth(address, 20)

    if (!healthOk) {
      const running = await taskManager.areTasksRunning(sortedTasks.value.map((task) => task.id))
      if (running) {
        localError.value = '本地服务仍在预热中，API 暂未就绪，请稍后重试。'
        appendLog('[系统] API 暂未就绪，服务仍在运行中')
      } else {
        localError.value = '本地任务未保持运行，API 健康检查失败，请查看日志后重试。'
        appendLog('[系统] API 健康检查失败，检测到本地任务已退出')
      }
      return
    }

    appendLog('[系统] API 健康检查成功，进入资源加载阶段')
    await continueAfterConnection('local-python')
  } finally {
    localRunning.value = false
  }
}

async function connectApiMode(): Promise<void> {
  apiChecking.value = true
  apiError.value = ''

  try {
    const normalizedAddress = normalizeApiAddress(apiAddress.value)
    if (!normalizedAddress) {
      apiError.value = '请输入 API 地址。'
      return
    }

    if (!validateApiAddress(normalizedAddress)) {
      apiError.value = '地址格式无效，请使用 host:port 形式。'
      return
    }

    const ok = await checkApiHealth(normalizedAddress, 2)
    if (!ok) {
      apiError.value = '连接失败，请确认服务是否可访问。'
      return
    }

    await configStore.updateConfig('baseUrl', normalizedAddress)
    await continueAfterConnection('api')
  } finally {
    apiChecking.value = false
  }
}

async function switchToLocalMode(): Promise<void> {
  currentStep.value = 'local'
  currentMode.value = 'local-python'
  await window.api.onboarding.setMode('local-python')
}

async function continueAfterConnection(mode: OnboardingMode): Promise<void> {
  currentMode.value = mode
  await window.api.onboarding.setMode(mode)

  currentStep.value = 'loading'
  assistantLoadError.value = ''
  assistantProgress.value = 5
  assistantProgressHint.value = '开始同步助手数据...'

  const result = await window.api.initAssistant()
  if (!result.success) {
    assistantLoadError.value = `助手数据加载失败：${result.error || '未知错误'}`
    assistantProgressHint.value = '加载失败，请重试。'
    return
  }

  assistantProgress.value = Math.max(assistantProgress.value, 90)
  assistantProgressHint.value = '正在整理助手信息...'

  await assistantManager.initialize()

  assistantProgress.value = 100
  assistantProgressHint.value = '助手数据加载完成'

  await wait(350)
  currentStep.value = 'profile'
}

async function retryLocalFlow(): Promise<void> {
  await connectLocalMode()
}

async function retryAssistantLoading(): Promise<void> {
  await continueAfterConnection(currentMode.value || 'api')
}

async function switchToApiMode(): Promise<void> {
  currentStep.value = 'api'
  currentMode.value = 'api'
  await window.api.onboarding.setMode('api')
  apiError.value = ''
}

async function submitProfile(): Promise<void> {
  savingProfile.value = true
  profileError.value = ''

  try {
    if (!profile.birthday.trim() || !profile.gender.trim() || !profile.occupation.trim()) {
      profileError.value = '阁下，你是不是漏掉了什么？'
      return
    }

    await window.api.onboarding.saveProfile({
      birthday: profile.birthday.trim(),
      gender: profile.gender.trim(),
      occupation: profile.occupation.trim()
    })

    currentStep.value = 'slogan'
    await wait(3000)

    await finishOnboarding()
  } finally {
    savingProfile.value = false
  }
}

async function finishOnboarding(): Promise<void> {
  await window.api.onboarding.markCompleted()
  isDissolving.value = true
  await nextTick()
  await wait(80)

  await router.replace({
    path: '/tabs',
    query: {
      tab: 'assistant-space',
      welcome: 'true'
    }
  })
}

async function bootstrap(): Promise<void> {
  const onboardingState = await window.api.onboarding.getState()
  if (onboardingState.completed) {
    await router.replace('/tabs')
    return
  }

  apiAddress.value = configStore.config.baseUrl || '127.0.0.1:8001'

  if (onboardingState.profile) {
    profile.birthday = onboardingState.profile.birthday || ''
    profile.gender = onboardingState.profile.gender || ''
    profile.occupation = onboardingState.profile.occupation || ''
  }

  await taskManager.initService()

  if (sortedTasks.value.length > 0) {
    await connectLocalMode()
    if (localError.value) {
      currentStep.value = 'local'
    }
  } else {
    currentStep.value = 'api'
    currentMode.value = 'api'
    await window.api.onboarding.setMode('api')
  }
}

onMounted(async () => {
  window.api.ipcRenderer.on('assistant:download-progress', onAssistantDownloadProgress)

  watch(
    logLines,
    () => {
      void nextTick(() => {
        if (logContainerRef.value) {
          logContainerRef.value.scrollTop = logContainerRef.value.scrollHeight
        }
      })
    },
    { deep: true }
  )

  await bootstrap()
})

onUnmounted(() => {
  window.api.ipcRenderer.removeAllListeners('assistant:download-progress')
})
</script>

<style scoped>
.onboarding-root {
  position: relative;
  width: 100vw;
  height: 100vh;
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #ff95ae;
}

.onboarding-root.dissolving {
  animation: dissolveOut 0.8s ease forwards;
}

.bg-glow {
  position: absolute;
  border-radius: 999px;
  filter: blur(50px);
  opacity: 0.45;
  pointer-events: none;
}

.bg-glow-a {
  width: 380px;
  height: 380px;
  background: #ffffff;
  top: -120px;
  right: -100px;
  animation: floatA 7s ease-in-out infinite;
}

.bg-glow-b {
  width: 320px;
  height: 320px;
  background: #ffc7da;
  bottom: -100px;
  left: -90px;
  animation: floatB 8s ease-in-out infinite;
}

.onboarding-panel {
  position: relative;
  width: 480px;
  height: auto;
  overflow: hidden;
  background: rgba(255, 255, 255, 0.92);
  border: 1px solid rgba(255, 255, 255, 0.75);
  border-radius: 30px;
  box-shadow: 0 28px 70px rgba(171, 37, 93, 0.28);
  backdrop-filter: blur(12px);
  display: flex;
  flex-direction: column;
  padding: 30px;
  animation: enterSoft 0.5s ease;
}

.onboarding-panel.slogan-panel {
  width: 100%;
  height: 100%;
  padding: 0;
  border: none;
  border-radius: 0;
  background: transparent;
  box-shadow: none;
  backdrop-filter: none;
}

.panel-header {
  text-align: center;
  animation: enterSoft 0.5s ease;
}

.assistant-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 999px;
  padding: 8px 16px;
  font-weight: 700;
  color: #fff;
  background: linear-gradient(120deg, #fb7299, #f95a8a);
  box-shadow: 0 8px 20px rgba(249, 90, 138, 0.35);
  margin-bottom: 12px;
}

.panel-header h1 {
  margin: 0;
  color: #7d2444;
  font-size: clamp(1.45rem, 2.2vw, 2rem);
}

.panel-header p {
  margin: 8px 0 0;
  color: #a94468;
}

.step-strip {
  margin-top: 22px;
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 12px;
}

.step-dot {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 5px;
  padding: 10px 8px;
  border-radius: 14px;
  background: rgba(255, 240, 247, 0.8);
  border: 1px solid rgba(249, 90, 138, 0.2);
  transition: all 0.3s ease;
}

.step-dot span {
  width: 28px;
  height: 28px;
  border-radius: 999px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: #ffd3e2;
  color: #a73f66;
  font-weight: 700;
}

.step-dot small {
  color: #a54f70;
  font-size: 12px;
}

.step-dot.active {
  transform: translateY(-2px);
  border-color: rgba(249, 90, 138, 0.45);
  box-shadow: 0 8px 18px rgba(249, 90, 138, 0.2);
}

.step-dot.active span {
  background: #fb7299;
  color: #fff;
}

.step-content {
  margin-top: 20px;
  flex: 1;
  display: flex;
  flex-direction: column;
  min-height: 0;
}

.slogan-panel .step-content {
  margin-top: 0;
  width: 100%;
  height: 100%;
  justify-content: center;
  align-items: center;
}

.step-content h2 {
  margin: 0;
  color: #7b2141;
  font-size: clamp(1.2rem, 1.9vw, 1.5rem);
}

.hint {
  margin: 8px 0 14px;
  color: #92506c;
  line-height: 1.55;
}

.sub-hint {
  margin-top: 8px;
  color: #ab5f7d;
  font-size: 13px;
}

.status-card {
  background: rgba(255, 247, 250, 0.88);
  border: 1px solid rgba(249, 90, 138, 0.2);
  border-radius: 14px;
  padding: 12px;
}

.status-line {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 10px;
  color: #8f4460;
  font-size: 13px;
}

.status-line + .status-line {
  margin-top: 8px;
}

.status-line strong {
  color: #70243f;
  max-width: 60%;
  text-align: right;
  word-break: break-all;
}

.task-list {
  list-style: none;
  margin: 12px 0 0;
  padding: 0;
  display: grid;
  gap: 8px;
}

.task-item {
  display: flex;
  justify-content: space-between;
  align-items: stretch;
  gap: 14px;
  padding: 12px;
  border-radius: 12px;
  background: #fff;
  border: 1px solid rgba(249, 90, 138, 0.15);
  transition: all 0.2s ease;
  cursor: pointer;
}

.task-item:hover {
  border-color: rgba(249, 90, 138, 0.25);
  box-shadow: 0 4px 12px rgba(249, 90, 138, 0.1);
}

.task-info {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 6px;
  min-width: 0;
}

.task-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 10px;
}

.task-header strong {
  color: #742640;
  font-weight: 700;
  flex-shrink: 0;
}

.task-info small {
  color: #a26480;
  font-size: 12px;
}

.task-progress {
  margin-top: 4px;
}

.progress-bar-small {
  height: 6px;
  border-radius: 999px;
  background: #ffe5ef;
  overflow: hidden;
}

.progress-fill-small {
  height: 100%;
  background: linear-gradient(90deg, #f3d1dc, #e8b8cc);
  transition: all 0.3s ease;
  width: 0%;
}

.progress-fill-small.progress-running {
  width: 65%;
  background: linear-gradient(90deg, #fb7299, #f95a8a);
  animation: progressShimmer 1.5s ease-in-out infinite;
}

.log-actions {
  margin-top: 12px;
  display: flex;
  justify-content: center;
}

.task-state {
  font-size: 12px;
  border-radius: 999px;
  padding: 6px 10px;
  white-space: nowrap;
}

.task-state.idle {
  background: #f6f0f3;
  color: #8b7380;
}

.task-state.warming {
  background: #ffe8f1;
  color: #b04a6f;
  animation: pulse 1.2s ease-in-out infinite;
}

.task-state.running {
  background: #ffe1eb;
  color: #902d51;
}

.log-box {
  margin-top: 12px;
  border-radius: 12px;
  border: 1px solid rgba(249, 90, 138, 0.18);
  background: #fff;
  display: flex;
  flex-direction: column;
  min-height: 170px;
  flex: 1;
  animation: slideDown 0.3s ease;
}

.log-title {
  padding: 10px 12px;
  color: #8f4261;
  font-weight: 700;
  border-bottom: 1px solid rgba(249, 90, 138, 0.12);
}

.log-content {
  max-height: 200px;
  padding: 10px 12px;
  overflow: auto;
  flex: 1;
}

.log-line {
  font-family: 'Consolas', 'Courier New', monospace;
  color: #7e4461;
  font-size: 12px;
  line-height: 1.4;
  animation: logIn 0.28s ease;
}

.field {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-top: 10px;
}

.field span {
  color: #8d4a67;
  font-weight: 600;
}

.field input,
.field select {
  border: 1px solid #f3b6cd;
  border-radius: 12px;
  padding: 11px 12px;
  font-size: 14px;
  outline: none;
  transition: all 0.2s ease;
  background: #fff;
  color: #6f2c48;
}

.field input:focus,
.field select:focus {
  border-color: #fb7299;
  box-shadow: 0 0 0 3px rgba(251, 114, 153, 0.18);
}

.profile-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
}

.field-full {
  grid-column: span 2;
}

.progress-wrap {
  margin-top: 10px;
  display: flex;
  align-items: center;
  gap: 12px;
}

.progress-wrap span {
  min-width: 46px;
  text-align: right;
  color: #8e4866;
  font-weight: 600;
}

.progress-bar {
  height: 14px;
  flex: 1;
  border-radius: 999px;
  background: #ffe5ef;
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  background: linear-gradient(90deg, #fb7299, #f95a8a);
  transition: width 0.35s ease;
}

.slogan-wrap {
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  text-align: center;
}

.slogan {
  margin: 0;
  font-size: clamp(1.35rem, 3.2vw, 2.2rem);
  line-height: 1.5;
  color: #fff;
  text-shadow: 0 6px 24px rgba(110, 20, 52, 0.42);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.01em;
  animation: sloganFadeOut 0.7s ease forwards;
  animation-delay: 2.45s;
}

.slogan-char {
  display: inline-block;
  opacity: 0;
  transform: translateX(-16px) translateY(8px);
  filter: blur(6px);
  animation: sloganCharIn 0.5s ease forwards;
  animation-delay: var(--char-delay);
}

.actions {
  position: relative;
  margin-top: 14px;
  display: flex;
  justify-content: flex-end;
  gap: 10px;
}

.btn {
  border: none;
  border-radius: 12px;
  padding: 10px 18px;
  cursor: pointer;
  background: linear-gradient(130deg, #fb7299, #f95a8a);
  color: #fff;
  font-weight: 700;
  transition:
    transform 0.16s ease,
    box-shadow 0.2s ease;
  box-shadow: 0 8px 18px rgba(249, 90, 138, 0.26);
}

.btn:hover:not(:disabled) {
  transform: translateY(-1px);
}

.btn:disabled {
  opacity: 0.65;
  cursor: not-allowed;
}

.btn-ghost {
  background: #fff;
  color: #9b4264;
  border: 1px solid #f2bfd1;
  box-shadow: none;
}

.error-text {
  margin: 10px 0 0;
  color: #e85d82;
  font-weight: 600;
  font-size: 14px;
}

.content-fade-enter-active,
.content-fade-leave-active {
  transition:
    opacity 0.28s ease,
    transform 0.28s ease;
}

.content-fade-enter-from,
.content-fade-leave-to {
  opacity: 0;
  transform: translateY(8px);
}

@keyframes pulse {
  0%,
  100% {
    transform: scale(1);
  }
  50% {
    transform: scale(1.03);
  }
}

@keyframes sloganGlow {
  0%,
  100% {
    opacity: 0.85;
  }
  50% {
    opacity: 1;
  }
}

@keyframes sloganCharIn {
  0% {
    opacity: 0;
    transform: translateX(-16px) translateY(8px);
    filter: blur(6px);
  }
  100% {
    opacity: 1;
    transform: translateX(0) translateY(0);
    filter: blur(0);
  }
}

@keyframes sloganFadeOut {
  0%,
  72% {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
  100% {
    opacity: 0;
    transform: translateY(-4px) scale(0.98);
  }
}

@keyframes enterSoft {
  from {
    opacity: 0;
    transform: translateY(-8px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@keyframes dissolveOut {
  from {
    opacity: 1;
    filter: blur(0);
    transform: scale(1);
  }
  to {
    opacity: 0;
    filter: blur(16px);
    transform: scale(1.03);
  }
}

@keyframes floatA {
  0%,
  100% {
    transform: translateY(0);
  }
  50% {
    transform: translateY(15px);
  }
}

@keyframes floatB {
  0%,
  100% {
    transform: translateY(0);
  }
  50% {
    transform: translateY(-13px);
  }
}

@keyframes logIn {
  from {
    opacity: 0;
    transform: translateY(6px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@keyframes progressShimmer {
  0%,
  100% {
    opacity: 1;
  }
  50% {
    opacity: 0.7;
  }
}

@keyframes slideDown {
  from {
    opacity: 0;
    transform: translateY(-8px);
    max-height: 0;
  }
  to {
    opacity: 1;
    transform: translateY(0);
    max-height: 400px;
  }
}

@media (max-width: 900px) {
  .onboarding-panel {
    border-radius: 20px;
    padding: 20px 18px;
    width: calc(100vw - 20px);
    min-height: calc(100vh - 20px);
    max-height: calc(100vh - 20px);
  }

  .step-strip {
    gap: 8px;
  }

  .step-dot small {
    font-size: 11px;
  }

  .profile-grid {
    grid-template-columns: 1fr;
  }

  .field-full {
    grid-column: span 1;
  }

  .actions {
    justify-content: stretch;
  }

  .btn {
    width: 100%;
  }

  .task-header {
    flex-direction: column;
    align-items: flex-start;
  }

  .btn-toggle-log {
    width: 100%;
  }
}
</style>
