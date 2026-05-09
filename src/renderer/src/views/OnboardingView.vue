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

  <div class="onboarding-root" :class="[`phase-${phaseClass}`, { dissolving: isDissolving }]">
    <ParticleCanvas ref="particleRef" :mode="particleMode" :density="particleDensity" />

    <div class="foreground-layer">
      <Transition name="screen-fade" mode="out-in">
        <!-- BOOT -->
        <div v-if="currentState === 'BOOT'" key="boot" class="screen boot-screen">
          <div class="boot-glitch-text">INITIALIZING</div>
          <div class="boot-sub">SYSTEM BOOT SEQUENCE</div>
        </div>

        <!-- SYSTEM_WAKE -->
        <div v-else-if="currentState === 'SYSTEM_WAKE'" key="wake" class="screen center-screen">
          <div class="wake-pulse-ring"></div>
          <div class="status-title">SIGNAL DETECTED</div>
          <div class="status-sub">检测到苏醒信号...</div>
        </div>

        <!-- LOG_STREAM -->
        <div v-else-if="currentState === 'LOG_STREAM'" key="logstream" class="screen center-screen">
          <div class="status-title">{{ logStatusTitle }}</div>
          <div class="status-sub">{{ logStatusSub }}</div>
          <div class="progress-indicator">
            <div
              v-for="i in 5"
              :key="i"
              class="progress-dot"
              :class="{ active: i <= logProgressDot }"
            ></div>
          </div>
          <div class="log-toggle log-toggle-corner">
            <button class="btn-log" @click="toggleLogDrawer">
              {{ showLogDrawer ? '收起日志' : '查看日志' }}
            </button>
          </div>
          <div v-if="showLogDrawer" class="log-modal" @click.self="toggleLogDrawer">
            <div class="log-dialog">
              <div class="log-dialog-header">
                <span>启动日志</span>
                <span class="log-drawer-sub">{{ logSourceText }}</span>
              </div>
              <div ref="logBodyRef" class="log-dialog-body">
                <div v-if="logLines.length === 0" class="log-empty">暂无日志</div>
                <div v-for="(line, index) in logLines" :key="index" class="log-line">
                  {{ line }}
                </div>
              </div>
            </div>
          </div>
          <!-- error -->
          <div v-if="backendError" class="error-block">
            <p class="error-text">{{ backendError }}</p>
            <div class="error-actions">
              <button class="btn-cold btn-ghost-cold" @click="switchMode">切换 API 模式</button>
              <button class="btn-cold" @click="retryBackend">重试</button>
            </div>
          </div>
        </div>

        <!-- PERSONALITY_ONLINE -->
        <div
          v-else-if="currentState === 'PERSONALITY_ONLINE'"
          key="personality"
          class="screen center-screen"
        >
          <div class="status-title">PERSONALITY CORE</div>
          <div class="status-sub">{{ personalityStatus }}</div>
          <div class="personality-bar-wrap">
            <div class="personality-bar">
              <div class="personality-fill" :style="{ width: `${assistantProgress}%` }"></div>
            </div>
            <span class="personality-pct">{{ assistantProgress }}%</span>
          </div>
          <div v-if="assistantLoadError" class="error-block">
            <p class="error-text">{{ assistantLoadError }}</p>
            <button class="btn-cold" @click="retryAssistantLoading">重试</button>
          </div>
        </div>

        <!-- SAKURA_TRANSITION -->
        <div
          v-else-if="currentState === 'SAKURA_TRANSITION'"
          key="sakura"
          class="screen center-screen"
        >
          <div class="sakura-text">SAKURA PROTOCOL</div>
          <div class="sakura-sub">协议启动...</div>
        </div>

        <!-- FIRST_MEETING: centered profile card -->
        <div v-else-if="currentState === 'FIRST_MEETING'" key="meeting" class="screen meeting-bg">
          <div class="onboarding-panel" :class="{ 'panel-entering': showPanel }">
            <h2 class="panel-title">完善阁下的资料</h2>
            <p class="panel-hint">初次见面，可以让我更多的了解一下阁下吗？</p>

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
              <button class="btn-submit" :disabled="savingProfile" @click="submitProfile">
                {{ savingProfile ? '保存中...' : '完成' }}
              </button>
            </div>
          </div>
        </div>

        <!-- PROFILE_SYNC -->
        <div v-else-if="currentState === 'PROFILE_SYNC'" key="sync" class="screen center-screen">
          <div class="sync-ring">
            <div class="sync-ring-inner"></div>
          </div>
          <div class="status-title sync-title">正在同步契约数据...</div>
          <div v-for="i in 3" :key="i" class="sync-sparkle" :style="syncSparkleStyle(i)"></div>
        </div>

        <!-- CONTRACT -->
        <div v-else-if="currentState === 'CONTRACT'" key="contract" class="screen center-screen">
          <div class="contract-glow"></div>
          <div class="contract-icon">✦</div>
          <div class="contract-title">契约成立</div>
          <div class="contract-text">
            从此刻起，澪将常驻于<br />
            您的屏幕角落...
          </div>
          <button class="contract-btn" @click="acceptContract">
            <span class="contract-btn-text">接受契约</span>
          </button>
        </div>

        <!-- fallback -->
        <div v-else key="empty" class="screen"></div>
      </Transition>
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
import ParticleCanvas from '../components/onboarding/ParticleCanvas.vue'

// ─── type helpers ───────────────────────────────────────────────────────────

type OnboardingState =
  | 'BOOT'
  | 'SYSTEM_WAKE'
  | 'LOG_STREAM'
  | 'PERSONALITY_ONLINE'
  | 'SAKURA_TRANSITION'
  | 'FIRST_MEETING'
  | 'PROFILE_SYNC'
  | 'CONTRACT'
  | 'HOME'

// ─── services / singletons ──────────────────────────────────────────────────

const router = useRouter()
const configStore = useConfigStore()
const assistantManager = AssistantManager.getInstance()
const taskManager = TaskManager.getInstance()
// ─── state machine ──────────────────────────────────────────────────────────

const currentState = ref<OnboardingState>('BOOT')
const currentMode = ref<OnboardingMode>('')
const isDissolving = ref(false)

// ─── particle canvas control ────────────────────────────────────────────────

const particleRef = ref<InstanceType<typeof ParticleCanvas> | null>(null)

const particleMode = computed(() => {
  switch (currentState.value) {
    case 'BOOT':
      return 'hidden' as const
    case 'SYSTEM_WAKE':
      return 'idle' as const
    case 'LOG_STREAM':
    case 'PERSONALITY_ONLINE':
      return 'logstream' as const
    case 'SAKURA_TRANSITION':
    case 'FIRST_MEETING':
    case 'PROFILE_SYNC':
      return 'sakura' as const
    case 'CONTRACT':
      return 'contract' as const
    default:
      return 'hidden' as const
  }
})

const particleDensity = computed(() => {
  switch (currentState.value) {
    case 'CONTRACT':
      return 1.4
    case 'SAKURA_TRANSITION':
      return 1.1
    case 'FIRST_MEETING':
      return 0.6
    default:
      return 1.0
  }
})

const phaseClass = computed(() => {
  switch (currentState.value) {
    case 'BOOT':
    case 'SYSTEM_WAKE':
      return 'cold'
    case 'LOG_STREAM':
    case 'PERSONALITY_ONLINE':
      return 'mid'
    case 'SAKURA_TRANSITION':
      return 'warming'
    default:
      return 'warm'
  }
})

// ─── backend state ──────────────────────────────────────────────────────────

const backendError = ref('')
const assistantLoadError = ref('')
const assistantProgress = ref(0)
const logStatusTitle = ref('正在启动核心服务...')
const logStatusSub = ref('请稍候，这可能需要几分钟')
const logProgressDot = ref(1)
let logDotTimer: ReturnType<typeof setInterval> | null = null

// ─── profile ────────────────────────────────────────────────────────────────

const profile = reactive<OnboardingProfile>({
  birthday: '',
  gender: '',
  occupation: ''
})

const apiAddress = ref('')
const sortedTasks = taskManager.tasks
const showLogDrawer = ref(false)
const logBodyRef = ref<HTMLElement | null>(null)
const logLines = computed(() => taskManager.localStartupLogs.value)
const logSourceText = computed(() => {
  if (currentMode.value === 'api') return 'API 模式不提供本地日志'
  if (sortedTasks.value.length === 0) return '未配置本地任务'
  return `本地任务 ${sortedTasks.value.length} 项`
})

// ─── LOG_STREAM dot animation ───────────────────────────────────────────────

function startLogDots(): void {
  let i = 1
  logDotTimer = setInterval(() => {
    i = (i % 5) + 1
    logProgressDot.value = i
  }, 700)
}

function stopLogDots(): void {
  if (logDotTimer) {
    clearInterval(logDotTimer)
    logDotTimer = null
  }
}

function scrollLogToBottom(): void {
  nextTick(() => {
    const el = logBodyRef.value
    if (!el) return
    el.scrollTop = el.scrollHeight
  })
}

function toggleLogDrawer(): void {
  showLogDrawer.value = !showLogDrawer.value
  if (showLogDrawer.value) {
    scrollLogToBottom()
  }
}

watch(logLines, () => {
  if (showLogDrawer.value) {
    scrollLogToBottom()
  }
})

// ─── titlebar ───────────────────────────────────────────────────────────────

const titlebarIcons = [
  { color: '#f3bc4f', text: '最小化', action: () => window.api.minimizeApp() },
  { color: '#64c857', text: '最大化', action: () => window.api.maximizeApp() },
  { color: '#e97168', text: '关闭', action: () => window.api.hideApp() }
]

// ─── ui helpers ─────────────────────────────────────────────────────────────

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function normalizeApiAddress(address: string): string {
  return address
    .replace(/^https?:\/\//i, '')
    .replace(/\/$/, '')
    .trim()
}

function validateApiAddress(address: string): boolean {
  return /^[\w.-]+:\d+$/.test(address)
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
      // continue
    } finally {
      clearTimeout(timeout)
    }
    if (i < attempts - 1) await wait(1300)
  }
  return false
}

// ─── state transitions ──────────────────────────────────────────────────────

async function goState(next: OnboardingState, delay = 0): Promise<void> {
  if (delay > 0) await wait(delay)
  currentState.value = next
}

async function startBootSequence(): Promise<void> {
  currentState.value = 'BOOT'
  await wait(1800)
}

async function startSystemWake(): Promise<void> {
  currentState.value = 'SYSTEM_WAKE'
  await wait(1500)
}

// ─── backend: local service startup ─────────────────────────────────────────

async function startLocalBackend(): Promise<boolean> {
  currentState.value = 'LOG_STREAM'
  backendError.value = ''
  logStatusTitle.value = '正在启动核心服务...'
  logStatusSub.value = '初始化智慧核心所需的基础设施'
  startLogDots()

  try {
    const startResult = await taskManager.startLocalTasks(sortedTasks.value)
    if (!startResult.success) {
      backendError.value = startResult.error || '本地服务启动失败。'
      stopLogDots()
      return false
    }

    logStatusTitle.value = '正在唤醒澪的意识核心...'
    logStatusSub.value = '检查神经网络连接状态'
    const address = normalizeApiAddress(configStore.config.baseUrl || '127.0.0.1:8001')
    const healthOk = await checkApiHealth(address, 20)

    if (!healthOk) {
      const running = await taskManager.areTasksRunning(sortedTasks.value.map((task) => task.id))
      if (running) {
        backendError.value = '本地服务仍在预热中，API 暂未就绪，请稍后重试。'
      } else {
        backendError.value = '核心服务未能保持运行，请查看日志后重试。'
      }
      stopLogDots()
      return false
    }

    stopLogDots()
    logStatusTitle.value = '核心服务就绪'
    logStatusSub.value = '意识核心连接成功'
    await wait(500)
    return true
  } catch (err) {
    backendError.value = err instanceof Error ? err.message : '未知错误'
    stopLogDots()
    return false
  }
}

async function retryBackend(): Promise<void> {
  if (currentMode.value === 'api') {
    const ok = await connectApiMode()
    if (ok) {
      await loadAssistant()
      await advanceAfterAssistantLoaded()
    }
  } else {
    const ok = await startLocalBackend()
    if (ok) {
      currentMode.value = 'local-python'
      await window.api.onboarding.setMode('local-python')
      await loadAssistant()
      await advanceAfterAssistantLoaded()
    }
  }
}

async function switchMode(): Promise<void> {
  if (currentMode.value === 'local-python' || currentMode.value === '') {
    currentMode.value = 'api'
    currentState.value = 'LOG_STREAM'
    backendError.value = ''
    apiAddress.value = configStore.config.baseUrl || '127.0.0.1:8001'
    logStatusTitle.value = 'API 模式'
    logStatusSub.value = `等待连接 ${apiAddress.value}...`
    // give user a moment to see, then try to connect
    await wait(600)
    const ok = await connectApiMode()
    if (ok) {
      await loadAssistant()
      await advanceAfterAssistantLoaded()
    }
  } else {
    currentMode.value = 'local-python'
    await window.api.onboarding.setMode('local-python')
    await startLocalBackend()
    if (!backendError.value) {
      await loadAssistant()
      await advanceAfterAssistantLoaded()
    }
  }
}

// ─── backend: API mode ──────────────────────────────────────────────────────

async function connectApiMode(): Promise<boolean> {
  backendError.value = ''
  const normalizedAddress = normalizeApiAddress(apiAddress.value)
  if (!normalizedAddress) {
    backendError.value = '请输入 API 地址。'
    return false
  }
  if (!validateApiAddress(normalizedAddress)) {
    backendError.value = '地址格式无效，请使用 host:port 形式。'
    return false
  }

  logStatusTitle.value = '正在连接远程核心...'
  logStatusSub.value = `尝试连接 ${normalizedAddress}`

  const ok = await checkApiHealth(normalizedAddress, 2)
  if (!ok) {
    backendError.value = '连接失败，请确认服务是否可访问。'
    return false
  }

  await configStore.updateConfig('baseUrl', normalizedAddress)
  logStatusTitle.value = '远程核心已连接'
  logStatusSub.value = '意识同步通道已建立'
  return true
}

// ─── backend: assistant loading ─────────────────────────────────────────────

async function loadAssistant(): Promise<void> {
  currentState.value = 'PERSONALITY_ONLINE'
  assistantLoadError.value = ''
  assistantProgress.value = 5

  const result = await window.api.initAssistant()
  if (!result.success) {
    assistantLoadError.value = `助手数据加载失败：${result.error || '未知错误'}`
    return
  }

  assistantProgress.value = Math.max(assistantProgress.value, 90)
  await assistantManager.initialize()
  assistantProgress.value = 100
  await wait(400)
}

async function advanceAfterAssistantLoaded(): Promise<void> {
  if (assistantLoadError.value) return
  await startSakuraTransition()
  await startFirstMeeting()
}

async function retryAssistantLoading(): Promise<void> {
  await loadAssistant()
  await advanceAfterAssistantLoaded()
}

const personalityStatus = computed(() => {
  if (assistantLoadError.value) return '人格核心加载失败...'
  if (assistantProgress.value >= 100) return '人格核心已上线'
  if (assistantProgress.value >= 90) return '正在整理助手信息...'
  if (assistantProgress.value > 5) return '正在加载人格数据...'
  return '开始同步助手数据...'
})

// ─── transition: SAKURA ─────────────────────────────────────────────────────

async function startSakuraTransition(): Promise<void> {
  currentState.value = 'SAKURA_TRANSITION'
  particleRef.value?.morphToSakura()
  await wait(2800)
}

// ─── FIRST_MEETING ────────────────────────────────────────────────────────

const showPanel = ref(false)
const savingProfile = ref(false)
const profileError = ref('')

async function startFirstMeeting(): Promise<void> {
  currentState.value = 'FIRST_MEETING'
  await wait(400)
  showPanel.value = true
}

async function submitProfile(): Promise<void> {
  savingProfile.value = true
  profileError.value = ''

  try {
    if (!profile.birthday.trim() || !profile.gender.trim() || !profile.occupation.trim()) {
      profileError.value = '阁下，你是不是漏掉了什么？'
      return
    }

    await goState('PROFILE_SYNC')
    showPanel.value = false
    await wait(300)

    await window.api.onboarding.saveProfile({
      birthday: profile.birthday.trim(),
      gender: profile.gender.trim(),
      occupation: profile.occupation.trim()
    })

    await wait(1500)
    await startContract()
  } finally {
    savingProfile.value = false
  }
}

function syncSparkleStyle(i: number): Record<string, string> {
  const angle = (i / 3) * Math.PI * 2 + Date.now() * 0.001
  const r = 80 + Math.sin(Date.now() * 0.002 + i) * 20
  const x = Math.cos(angle) * r
  const y = Math.sin(angle) * r
  return {
    left: `calc(50% + ${x}px)`,
    top: `calc(50% + ${y}px)`,
    animationDelay: `${i * 0.2}s`
  }
}

// ─── CONTRACT ───────────────────────────────────────────────────────────────

async function startContract(): Promise<void> {
  currentState.value = 'CONTRACT'
}

async function acceptContract(): Promise<void> {
  await window.api.onboarding.markCompleted()
  isDissolving.value = true
  particleRef.value?.clearParticles()
  await nextTick()
  await wait(80)

  await router.replace({
    path: '/tabs',
    query: { tab: 'assistant-space', welcome: 'true' }
  })
}

// ─── IPC listener ───────────────────────────────────────────────────────────

function onAssistantDownloadProgress(
  _event,
  payload: { assistantName: string; progress: number }
): void {
  assistantProgress.value = Math.max(0, Math.min(100, payload.progress))
}

// ─── main flow ──────────────────────────────────────────────────────────────

async function runFlow(): Promise<void> {
  // 1. BOOT
  await startBootSequence()

  // 2. SYSTEM_WAKE
  await startSystemWake()

  // 3. LOG_STREAM → start backend
  if (sortedTasks.value.length > 0) {
    currentMode.value = 'local-python'
    await window.api.onboarding.setMode('local-python')
    const ok = await startLocalBackend()
    if (!ok) return // stay in LOG_STREAM showing error
  } else {
    // no local tasks → API mode
    currentMode.value = 'api'
    await window.api.onboarding.setMode('api')
    apiAddress.value = configStore.config.baseUrl || '127.0.0.1:8001'
    currentState.value = 'LOG_STREAM'
    backendError.value = ''
    logStatusTitle.value = 'API 模式'
    logStatusSub.value = `等待连接 ${apiAddress.value}...`
    startLogDots()
    await wait(600)
    const ok = await connectApiMode()
    if (!ok) {
      stopLogDots()
      return
    }
    stopLogDots()
  }

  // 4. PERSONALITY_ONLINE → load assistant
  await loadAssistant()
  if (assistantLoadError.value) return // stay showing error
  await advanceAfterAssistantLoaded()
  // dialogue is user-driven; after last line, goState('PROFILE_SYNC') is called
}

// ─── bootstrap ──────────────────────────────────────────────────────────────

onMounted(async () => {
  window.api.ipcRenderer.on('assistant:download-progress', onAssistantDownloadProgress)

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
  await runFlow()
})

onUnmounted(() => {
  window.api.ipcRenderer.removeAllListeners('assistant:download-progress')
  stopLogDots()
})
</script>

<style scoped>
/* ─── root ──────────────────────────────────────────────────────────────── */

.onboarding-root {
  position: relative;
  width: 100vw;
  height: 100vh;
  overflow: hidden;
  transition: background 1.6s ease;
}

/* cold phase */
.onboarding-root.phase-cold {
  background: #fff5f7;
}

/* mid phase */
.onboarding-root.phase-mid {
  background: #fef0f5;
}

/* warming phase */
.onboarding-root.phase-warming {
  background: #fce4ec;
}

/* warm phase */
.onboarding-root.phase-warm {
  background: #fce4ec;
}

.onboarding-root.dissolving {
  animation: dissolveOut 0.8s ease forwards;
}

.foreground-layer {
  position: relative;
  z-index: 5;
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
}

.screen {
  width: 100%;
  height: 100%;
  position: relative;
}

/* ─── BOOT screen ───────────────────────────────────────────────────────── */

.boot-screen {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  background: #fff5f7;
  overflow: hidden;
}

.boot-screen::before {
  content: '';
  position: absolute;
  inset: 0;
  background: repeating-linear-gradient(
    0deg,
    transparent,
    transparent 2px,
    rgba(255, 200, 210, 0.04) 2px,
    rgba(255, 200, 210, 0.04) 4px
  );
  pointer-events: none;
  animation: scanlineMove 0.1s linear infinite;
}

.boot-glitch-text {
  font-family: 'Consolas', 'Courier New', monospace;
  font-size: clamp(1.6rem, 3vw, 2.4rem);
  color: #d4687c;
  letter-spacing: 0.3em;
  text-shadow:
    0 0 20px rgba(251, 114, 153, 0.4),
    2px 0 0 rgba(255, 150, 180, 0.35),
    -2px 0 0 rgba(255, 200, 210, 0.3);
  animation: bootGlitch 2.5s ease-in-out infinite;
}

.boot-sub {
  margin-top: 16px;
  font-family: 'Consolas', 'Courier New', monospace;
  font-size: 12px;
  color: rgba(200, 120, 140, 0.55);
  letter-spacing: 0.2em;
}

/* ─── center screen (shared by most states) ─────────────────────────────── */

.center-screen {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
}

/* ─── SYSTEM_WAKE ───────────────────────────────────────────────────────── */

.wake-pulse-ring {
  width: 80px;
  height: 80px;
  border-radius: 50%;
  border: 2px solid rgba(251, 114, 153, 0.35);
  animation: wakePulse 1.4s ease-out infinite;
  margin-bottom: 20px;
}

/* ─── status text (shared) ──────────────────────────────────────────────── */

.status-title {
  font-family: 'Consolas', 'Courier New', monospace;
  font-size: clamp(1rem, 1.8vw, 1.25rem);
  letter-spacing: 0.12em;
  color: #c2516b;
}

.phase-warm .status-title,
.phase-warming .status-title {
  color: #d4687c;
  font-family: 'LoliFont', 'Microsoft YaHei', sans-serif;
  letter-spacing: 0.08em;
}

.status-sub {
  font-size: 14px;
  color: rgba(180, 100, 120, 0.7);
  letter-spacing: 0.05em;
}

.phase-warm .status-sub,
.phase-warming .status-sub {
  color: rgba(200, 130, 150, 0.7);
}

/* ─── progress indicator (LOG_STREAM) ───────────────────────────────────── */

.progress-indicator {
  margin-top: 18px;
  display: flex;
  gap: 10px;
}

.log-toggle {
  margin-bottom: 14px;
}

.log-toggle-corner {
  position: absolute;
  bottom: 24px;
  right: 28px;
  margin-top: 0;
  z-index: 6;
}

.btn-log {
  border: 1px solid rgba(251, 114, 153, 0.25);
  border-radius: 12px;
  padding: 6px 16px;
  background: rgba(255, 255, 255, 0.7);
  color: #b05473;
  font-size: 12px;
  cursor: pointer;
  letter-spacing: 0.04em;
  transition:
    border-color 0.2s ease,
    background 0.2s ease,
    transform 0.15s ease;
}

.btn-log:hover {
  border-color: rgba(251, 114, 153, 0.5);
  background: rgba(255, 255, 255, 0.85);
  transform: translateY(-1px);
}

.log-modal {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(255, 245, 247, 0.55);
  backdrop-filter: blur(2px);
  z-index: 5;
}

.log-dialog {
  width: min(680px, 90vw);
  max-height: min(60vh, 480px);
  background: rgba(255, 255, 255, 0.92);
  border: 1px solid rgba(251, 114, 153, 0.2);
  border-radius: 20px;
  box-shadow: 0 20px 48px rgba(180, 60, 90, 0.18);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.log-dialog-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 18px;
  font-size: 12px;
  color: #b05473;
  background: rgba(255, 255, 255, 0.7);
  border-bottom: 1px solid rgba(251, 114, 153, 0.12);
  letter-spacing: 0.06em;
}

.log-drawer-sub {
  color: rgba(176, 84, 115, 0.6);
  font-size: 11px;
}

.log-dialog-body {
  padding: 12px 18px 16px;
  overflow: auto;
  font-family: 'Consolas', 'Courier New', monospace;
  font-size: 12px;
  color: #7b304a;
}

.log-empty {
  color: rgba(176, 84, 115, 0.55);
  text-align: center;
  padding: 12px 0;
}

.log-line {
  line-height: 1.6;
  white-space: pre-wrap;
  word-break: break-word;
}

.progress-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: rgba(251, 114, 153, 0.2);
  transition:
    background 0.35s ease,
    box-shadow 0.35s ease;
}

.progress-dot.active {
  background: #fb7299;
  box-shadow: 0 0 10px rgba(251, 114, 153, 0.5);
}

/* ─── PERSONALITY_ONLINE ────────────────────────────────────────────────── */

.personality-bar-wrap {
  margin-top: 16px;
  display: flex;
  align-items: center;
  gap: 14px;
  width: 320px;
  max-width: 70vw;
}

.personality-bar {
  flex: 1;
  height: 4px;
  border-radius: 4px;
  background: rgba(251, 114, 153, 0.1);
  overflow: hidden;
}

.personality-fill {
  height: 100%;
  background: linear-gradient(90deg, #fb7299, #f95a8a);
  border-radius: 4px;
  transition: width 0.4s ease;
  box-shadow: 0 0 8px rgba(251, 114, 153, 0.35);
}

.personality-pct {
  font-family: 'Consolas', monospace;
  font-size: 12px;
  color: #c2516b;
  min-width: 36px;
  text-align: right;
}

/* ─── SAKURA_TRANSITION ─────────────────────────────────────────────────── */

.sakura-text {
  font-family: 'LoliFont', 'Microsoft YaHei', sans-serif;
  font-size: clamp(1.1rem, 2vw, 1.4rem);
  letter-spacing: 0.15em;
  color: #d4687c;
  animation: sakuraGlow 1.5s ease-in-out infinite;
}

.sakura-sub {
  font-size: 14px;
  color: rgba(244, 143, 177, 0.65);
  letter-spacing: 0.06em;
}

/* ─── FIRST_MEETING ─────────────────────────────────────────────────────── */

.meeting-bg {
  display: flex;
  align-items: center;
  justify-content: center;
  pointer-events: auto;
  background: radial-gradient(ellipse at 50% 45%, rgba(244, 143, 177, 0.08) 0%, transparent 60%);
}

/* ─── panel (centered profile card) ──────────────────────────────────────── */

.onboarding-panel {
  position: relative;
  width: 440px;
  max-width: 90vw;
  background: rgba(255, 255, 255, 0.92);
  border: 1px solid rgba(251, 114, 153, 0.2);
  border-radius: 24px;
  padding: 32px 30px;
  backdrop-filter: blur(14px);
  box-shadow:
    0 20px 56px rgba(180, 60, 90, 0.16),
    0 0 0 1px rgba(255, 255, 255, 0.4) inset;
  opacity: 0;
  transform: translateY(12px);
  transition:
    opacity 0.45s ease,
    transform 0.45s ease;
}

.onboarding-panel.panel-entering {
  opacity: 1;
  transform: translateY(0);
}

.panel-title {
  margin: 0 0 6px;
  font-family: 'LoliFont', 'Microsoft YaHei', sans-serif;
  font-size: 1.4rem;
  color: #7d2444;
  text-align: center;
  letter-spacing: 0.06em;
}

.panel-hint {
  margin: 0 0 22px;
  color: #a96480;
  font-size: 14px;
  text-align: center;
  letter-spacing: 0.03em;
}

/* ─── profile form ───────────────────────────────────────────────────────── */

.profile-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 14px;
}

.field {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.field span {
  color: #8d4a67;
  font-weight: 600;
  font-size: 13px;
}

.field input,
.field select {
  border: 1px solid #f3c0d2;
  border-radius: 12px;
  padding: 11px 14px;
  font-size: 14px;
  outline: none;
  background: rgba(255, 248, 250, 0.9);
  color: #6f2c48;
  font-family: inherit;
  transition:
    border-color 0.22s ease,
    box-shadow 0.22s ease;
}

.field input:focus,
.field select:focus {
  border-color: #fb7299;
  box-shadow: 0 0 0 3px rgba(251, 114, 153, 0.14);
}

.field input::placeholder {
  color: rgba(160, 100, 120, 0.35);
}

.field-full {
  grid-column: span 2;
}

/* ─── actions ────────────────────────────────────────────────────────────── */

.actions {
  margin-top: 22px;
  display: flex;
  justify-content: flex-end;
}

.btn-submit {
  border: none;
  border-radius: 14px;
  padding: 12px 40px;
  cursor: pointer;
  background: linear-gradient(135deg, #fb7299, #f95a8a);
  color: #fff;
  font-weight: 700;
  font-size: 15px;
  font-family: inherit;
  letter-spacing: 0.04em;
  transition:
    transform 0.16s ease,
    box-shadow 0.2s ease;
  box-shadow: 0 8px 22px rgba(249, 90, 138, 0.28);
}

.btn-submit:hover:not(:disabled) {
  transform: translateY(-1px);
  box-shadow: 0 12px 28px rgba(249, 90, 138, 0.36);
}

.btn-submit:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

/* ─── PROFILE_SYNC ──────────────────────────────────────────────────────── */

.sync-ring {
  position: relative;
  width: 60px;
  height: 60px;
  margin-bottom: 18px;
}

.sync-ring::before {
  content: '';
  position: absolute;
  inset: 0;
  border-radius: 50%;
  border: 2px solid rgba(244, 143, 177, 0.3);
  border-top-color: #ec407a;
  animation: syncSpin 1s linear infinite;
}

.sync-ring-inner {
  position: absolute;
  inset: 10px;
  border-radius: 50%;
  background: rgba(244, 143, 177, 0.06);
}

.sync-title {
  color: #f8bbd0;
}

.sync-sparkle {
  position: absolute;
  width: 3px;
  height: 3px;
  border-radius: 50%;
  background: #fce4ec;
  box-shadow: 0 0 6px rgba(252, 228, 236, 0.6);
  animation: syncSparkleFloat 2s ease-in-out infinite;
}

/* ─── CONTRACT ──────────────────────────────────────────────────────────── */

.contract-glow {
  position: absolute;
  width: 300px;
  height: 300px;
  border-radius: 50%;
  background: radial-gradient(circle, rgba(251, 114, 153, 0.18) 0%, transparent 70%);
  animation: glowPulse 3s ease-in-out infinite;
  pointer-events: none;
}

.contract-icon {
  font-size: 32px;
  color: #f48fb1;
  animation: contractIconFloat 2s ease-in-out infinite;
  margin-bottom: 8px;
}

.contract-title {
  font-family: 'LoliFont', 'Microsoft YaHei', sans-serif;
  font-size: clamp(1.6rem, 3vw, 2.2rem);
  color: #7d2444;
  letter-spacing: 0.15em;
  text-shadow: 0 0 30px rgba(251, 114, 153, 0.35);
}

.contract-text {
  margin-top: 14px;
  font-size: 15px;
  color: rgba(120, 50, 70, 0.7);
  text-align: center;
  line-height: 1.8;
  letter-spacing: 0.06em;
}

.contract-btn {
  position: relative;
  margin-top: 36px;
  border: none;
  border-radius: 30px;
  padding: 14px 48px;
  background: linear-gradient(135deg, #fb7299, #f95a8a);
  cursor: pointer;
  overflow: hidden;
  box-shadow: 0 8px 24px rgba(249, 90, 138, 0.3);
  transition:
    transform 0.2s ease,
    box-shadow 0.3s ease;
}

.contract-btn:hover {
  transform: translateY(-2px);
  box-shadow: 0 12px 32px rgba(249, 90, 138, 0.45);
}

.contract-btn-text {
  position: relative;
  z-index: 1;
  color: #fff;
  font-size: 15px;
  font-weight: 700;
  letter-spacing: 0.1em;
  font-family: 'Microsoft YaHei', sans-serif;
}

/* ─── error block ───────────────────────────────────────────────────────── */

.error-block {
  margin-top: 22px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 14px;
}

.error-text {
  color: #ef5350;
  font-size: 14px;
  text-align: center;
}

.error-actions {
  display: flex;
  gap: 10px;
}

/* ─── cold buttons ──────────────────────────────────────────────────────── */

.btn-cold {
  border: 1px solid rgba(251, 114, 153, 0.35);
  border-radius: 10px;
  padding: 9px 22px;
  background: rgba(251, 114, 153, 0.08);
  color: #c2516b;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  font-family: inherit;
  letter-spacing: 0.04em;
  transition:
    background 0.22s ease,
    border-color 0.22s ease,
    transform 0.15s ease;
}

.btn-cold:hover {
  background: rgba(251, 114, 153, 0.18);
  border-color: rgba(251, 114, 153, 0.55);
  transform: translateY(-1px);
}

.btn-ghost-cold {
  background: transparent;
  border-color: rgba(251, 114, 153, 0.2);
  color: rgba(180, 100, 120, 0.7);
}

.btn-ghost-cold:hover {
  background: rgba(251, 114, 153, 0.06);
  color: #c2516b;
}

/* ─── screen transition ─────────────────────────────────────────────────── */

.screen-fade-enter-active,
.screen-fade-leave-active {
  transition:
    opacity 0.45s ease,
    transform 0.45s ease;
}

.screen-fade-enter-from {
  opacity: 0;
  transform: translateY(10px);
}

.screen-fade-leave-to {
  opacity: 0;
  transform: translateY(-10px);
}

/* ─── keyframes ─────────────────────────────────────────────────────────── */

@keyframes bootGlitch {
  0%,
  90%,
  94%,
  100% {
    transform: translate(0);
    opacity: 1;
  }
  91% {
    transform: translate(-3px, 1px);
    opacity: 0.75;
  }
  92% {
    transform: translate(3px, -1px);
    opacity: 0.8;
  }
  93% {
    transform: translate(-1px, -1px);
    opacity: 0.7;
  }
}

@keyframes scanlineMove {
  from {
    transform: translateY(0);
  }
  to {
    transform: translateY(4px);
  }
}

@keyframes wakePulse {
  0% {
    transform: scale(0.8);
    opacity: 0.8;
  }
  100% {
    transform: scale(1.8);
    opacity: 0;
  }
}

@keyframes sakuraGlow {
  0%,
  100% {
    text-shadow: 0 0 16px rgba(251, 114, 153, 0.35);
  }
  50% {
    text-shadow: 0 0 32px rgba(251, 114, 153, 0.6);
  }
}

@keyframes syncSpin {
  to {
    transform: rotate(360deg);
  }
}

@keyframes syncSparkleFloat {
  0%,
  100% {
    opacity: 0;
    transform: translateY(0);
  }
  50% {
    opacity: 0.8;
    transform: translateY(-8px);
  }
}

@keyframes glowPulse {
  0%,
  100% {
    opacity: 0.6;
    transform: scale(1);
  }
  50% {
    opacity: 1;
    transform: scale(1.08);
  }
}

@keyframes contractIconFloat {
  0%,
  100% {
    transform: translateY(0);
  }
  50% {
    transform: translateY(-5px);
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
</style>
