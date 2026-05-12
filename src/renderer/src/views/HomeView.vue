<!-- HomeView.vue -->
<template>
  <!-- 樱花飘落画布 -->
  <canvas ref="sakuraCanvas" class="sakura-canvas"></canvas>

  <!-- 左上角问候语 -->
  <div class="greeting-corner">
    <h1 class="page-title">核心空间</h1>
    <p class="page-title-description">你好，阁下！今天是我与阁下相识的第{{ onboardingDays }}天</p>
  </div>

  <div class="universe">
    <!-- 主视觉区域 -->
    <div class="core-sanctuary">
      <!-- 伊卡洛斯光环 -->
      <div class="halo-ring" :class="{ active: isOperating }">
        <div class="halo-inner"></div>
        <div class="halo-outer"></div>
      </div>

      <!-- 智慧核心 - 心形/核心形态 -->
      <div class="wisdom-core" :class="coreStateClass" @click="toggleSidePanels">
        <div class="core-aura"></div>
        <div class="core-body">
          <div class="core-heart">
            <svg viewBox="0 0 100 100" class="heart-svg">
              <defs>
                <linearGradient id="heartGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" :stop-color="heartColorPrimary" />
                  <stop offset="100%" :stop-color="heartColorSecondary" />
                </linearGradient>
                <filter id="heartGlow">
                  <feGaussianBlur stdDeviation="3" result="blur" />
                  <feMerge>
                    <feMergeNode in="blur" />
                    <feMergeNode in="blur" />
                    <feMergeNode in="SourceGraphic" />
                  </feMerge>
                </filter>
              </defs>
              <path
                d="M50 85 C50 85, 10 55, 10 35 C10 20, 22 10, 35 10 C42 10, 47 15, 50 22 C53 15, 58 10, 65 10 C78 10, 90 20, 90 35 C90 55, 50 85, 50 85Z"
                fill="url(#heartGrad)"
                filter="url(#heartGlow)"
                class="heart-path"
              />
            </svg>
          </div>
          <div class="core-pulse"></div>
        </div>

        <!-- 可变双翼 - 左 -->
        <div class="wing wing-left" :class="{ spread: isOperating || showSidePanels }">
          <div class="wing-feather f1"></div>
          <div class="wing-feather f2"></div>
          <div class="wing-feather f3"></div>
          <div class="wing-feather f4"></div>
          <div class="wing-feather f5"></div>
          <div class="wing-feather f6"></div>
          <div class="wing-feather f7"></div>
        </div>

        <!-- 可变双翼 - 右 -->
        <div class="wing wing-right" :class="{ spread: isOperating || showSidePanels }">
          <div class="wing-feather f1"></div>
          <div class="wing-feather f2"></div>
          <div class="wing-feather f3"></div>
          <div class="wing-feather f4"></div>
          <div class="wing-feather f5"></div>
          <div class="wing-feather f6"></div>
          <div class="wing-feather f7"></div>
        </div>
      </div>

      <!-- 核心状态文字 -->
      <div class="core-whisper" :class="{ visible: showSidePanels }">
        <div class="whisper-line name">智慧核心</div>
        <div class="whisper-line version" v-if="kernelState.currentVersion">
          v{{ kernelState.currentVersion }}
        </div>
        <div class="whisper-line status" :class="statusClass">
          {{ statusText }}
        </div>
        <div
          class="whisper-line service-hint"
          :class="serviceStatusClass"
          v-if="isServiceDown || isServiceStarting"
        >
          {{ serviceStatusText }}
        </div>
        <div
          class="whisper-line hint"
          v-if="kernelState.updateAvailable && !isOperating && !isServiceDown"
        >
          新的内核更新可用...
        </div>
      </div>
    </div>

    <!-- 悬浮操作按钮 -->
    <div class="floating-actions" :class="{ visible: showSidePanels }">
      <button
        class="float-btn orbit-btn"
        @click="handleCheckUpdate"
        :disabled="isCheckingUpdate || isOperating"
        title="检查更新"
      >
        <span class="orbit-ring"></span>
        <font-awesome-icon icon="fa-solid fa-satellite" :class="{ 'fa-spin': isCheckingUpdate }" />
      </button>

      <button
        v-if="kernelState.updateAvailable && !isOperating"
        class="float-btn evolve-btn"
        @click="handleUpdateToLatest"
        :disabled="isUpdating"
        title="更新内核"
      >
        <span class="evolve-particles"></span>
        <font-awesome-icon icon="fa-solid fa-wand-magic-sparkles" />
      </button>

      <button
        v-if="kernelState.updateAvailable && kernelState.operationStatus === 'error'"
        class="float-btn retry-btn"
        @click="handleUpdateToLatest"
        :disabled="isUpdating"
        title="重试更新"
      >
        <span class="retry-ring"></span>
        <font-awesome-icon icon="fa-solid fa-rotate-right" />
      </button>

      <button
        v-if="isServiceDown && !isServiceStarting"
        class="float-btn start-btn"
        @click="handleStartBackend"
        :disabled="isStartingBackend"
        title="启动核心"
      >
        <span class="start-pulse"></span>
        <font-awesome-icon icon="fa-solid fa-play" />
      </button>

      <button
        v-if="backendService.running && !isServiceStarting"
        class="float-btn restart-btn"
        @click="handleRestartBackend"
        :disabled="isRestartingBackend"
        title="重启核心"
      >
        <span class="restart-ring"></span>
        <font-awesome-icon icon="fa-solid fa-rotate-right" />
      </button>

      <button v-if="isServiceStarting" class="float-btn starting-btn" disabled title="进行中...">
        <font-awesome-icon icon="fa-solid fa-spinner" class="fa-spin" />
      </button>

      <button
        v-if="isServiceDown && !isServiceStarting"
        class="float-btn sync-btn"
        @click="handleSyncDeps"
        :disabled="isSyncingDeps"
        title="同步共鸣依赖"
      >
        <font-awesome-icon icon="fa-solid fa-download" :class="{ 'fa-bounce': isSyncingDeps }" />
      </button>
    </div>

    <!-- 左侧面板 - 环境检查 -->
    <Transition name="panel-slide-left">
      <div v-if="showSidePanels" class="side-panel panel-left">
        <div class="panel-header">
          <font-awesome-icon icon="fa-solid fa-wind" class="panel-header-icon" />
          <span>世界共鸣</span>
        </div>
        <div class="panel-body">
          <template v-if="envCheckResult">
            <div
              class="panel-overall"
              :class="envCheckResult.allPassed ? 'overall-pass' : 'overall-fail'"
            >
              <font-awesome-icon
                :icon="
                  envCheckResult.allPassed
                    ? 'fa-solid fa-circle-check'
                    : 'fa-solid fa-circle-exclamation'
                "
              />
              <span>{{
                envCheckResult.allPassed
                  ? '和谐共鸣'
                  : `${envCheckResult.items.filter((i) => !i.passed).length} 处断裂`
              }}</span>
            </div>
            <div
              v-for="item in envCheckResult.items"
              :key="item.key"
              class="panel-item"
              :class="{ 'item-pass': item.passed, 'item-fail': !item.passed }"
            >
              <font-awesome-icon
                :icon="item.passed ? 'fa-solid fa-check' : 'fa-solid fa-xmark'"
                class="panel-item-icon"
              />
              <div class="panel-item-text">
                <div class="panel-item-name">{{ item.name }}</div>
                <div class="panel-item-msg">{{ item.message }}</div>
              </div>
            </div>
          </template>
          <div v-else class="panel-empty">尚未感知世界</div>
        </div>
      </div>
    </Transition>

    <!-- 右侧面板 - 日志 -->
    <Transition name="panel-slide-right">
      <div v-if="showSidePanels" class="side-panel panel-right">
        <div class="panel-header">
          <font-awesome-icon icon="fa-solid fa-scroll" class="panel-header-icon" />
          <span>内核日志</span>
          <button class="panel-refresh" title="刷新日志" @click="fetchLogs">
            <font-awesome-icon icon="fa-solid fa-rotate" :class="{ 'fa-spin': isFetchingLogs }" />
          </button>
        </div>
        <div class="panel-body">
          <template v-if="allLogEntries.length > 0">
            <div
              v-for="(log, idx) in allLogEntries"
              :key="idx"
              class="panel-log-entry"
              :class="'log-' + log.level + (log.source === 'backend' ? ' log-backend' : '')"
            >
              <span class="log-time">{{ log.time }}</span>
              <span class="log-level">{{ log.level }}</span>
              <span v-if="log.source === 'backend'" class="log-source">后端</span>
              <span v-else class="log-source log-source-kernel">内核</span>
              <span class="log-msg">{{ log.message }}</span>
            </div>
          </template>
          <div v-else class="panel-empty">暂无日志记录</div>
        </div>
      </div>
    </Transition>

    <!-- 更新日志弹窗 -->
    <Teleport to="body">
      <Transition name="mist-modal">
        <div
          v-if="showReleaseNotes && kernelState.latestVersion"
          class="modal-void"
          @click.self="showReleaseNotes = false"
        >
          <div class="modal-nebula">
            <div class="modal-header">
              <h3>进化记忆 v{{ kernelState.latestVersion.version }}</h3>
              <button class="modal-close" @click="showReleaseNotes = false">
                <font-awesome-icon icon="fa-solid fa-xmark" />
              </button>
            </div>
            <div class="modal-body">
              <MarkdownRenderer :markdown="kernelState.latestVersion.releaseNotes" />
            </div>
            <div class="modal-footer">
              <button class="ambient-btn" @click="showReleaseNotes = false">关闭</button>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import MarkdownRenderer from '../components/MarkdownRenderer.vue'
import { useUIStore } from '../stores/useUIStore'
import type { KernelUpdateState, EnvironmentCheckResult, KernelLogEntry } from '../types/KernelInfo'
import sakuraImg from '../assets/images/sakura.webp'

// ─── 状态 ──────────────────────────────────────

const showReleaseNotes = ref(false)
const showSidePanels = ref(false)
const onboardingDays = ref(0)

// ─── 樱花飘落 ──────────────────────────────────────
const sakuraCanvas = ref<HTMLCanvasElement | null>(null)
let sakuraAnimFrameId: number | null = null
let sakuraImage: HTMLImageElement | null = null
const PETAL_COUNT = 12

interface SakuraPetal {
  x: number
  y: number
  size: number
  rotation: number
  rotationSpeed: number
  fallSpeed: number
  swayPhase: number
  swayAmplitude: number
  swaySpeed: number
  opacity: number
}

let petals: SakuraPetal[] = []

function initPetals(canvas: HTMLCanvasElement): void {
  const { width, height } = canvas
  petals = Array.from({ length: PETAL_COUNT }, () => ({
    x: Math.random() * width,
    y: Math.random() * height - height, // start above viewport
    size: 14 + Math.random() * 14, // 14~28px
    rotation: Math.random() * Math.PI * 2,
    rotationSpeed: (Math.random() - 0.5) * 0.015,
    fallSpeed: 0.3 + Math.random() * 0.5, // moderate speed
    swayPhase: Math.random() * Math.PI * 2,
    swayAmplitude: 20 + Math.random() * 30,
    swaySpeed: 0.005 + Math.random() * 0.008,
    opacity: 0.5 + Math.random() * 0.5
  }))
}

function startSakuraAnimation(): void {
  const canvas = sakuraCanvas.value
  if (!canvas) return
  const ctx = canvas.getContext('2d')
  if (!ctx) return

  const resizeCanvas = (): void => {
    const parent = canvas.parentElement
    if (!parent) return
    const rect = parent.getBoundingClientRect()
    const dpr = window.devicePixelRatio || 1
    canvas.width = rect.width * dpr
    canvas.height = rect.height * dpr
    canvas.style.width = rect.width + 'px'
    canvas.style.height = rect.height + 'px'
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  }

  const preloadImage = (): Promise<void> => {
    return new Promise((resolve) => {
      sakuraImage = new Image()
      sakuraImage.onload = () => resolve()
      sakuraImage.onerror = () => resolve() // silently ignore
      sakuraImage.src = sakuraImg
    })
  }

  const animate = (): void => {
    sakuraAnimFrameId = requestAnimationFrame(animate)

    const w = canvas.width / (window.devicePixelRatio || 1)
    const h = canvas.height / (window.devicePixelRatio || 1)

    ctx.clearRect(0, 0, w, h)

    const img = sakuraImage
    if (!img || !img.complete) return

    for (const p of petals) {
      // update position
      p.y += p.fallSpeed
      p.swayPhase += p.swaySpeed
      p.x += Math.sin(p.swayPhase) * 0.3
      p.rotation += p.rotationSpeed

      // reset when off screen
      if (p.y > h + p.size) {
        p.y = -p.size
        p.x = Math.random() * w
      }
      if (p.x > w + p.size) p.x = -p.size
      if (p.x < -p.size) p.x = w + p.size

      // draw
      ctx.save()
      ctx.globalAlpha = p.opacity
      ctx.translate(p.x, p.y)
      ctx.rotate(p.rotation)
      ctx.drawImage(img, -p.size / 2, -p.size / 2, p.size, p.size)
      ctx.restore()
    }
  }

  resizeCanvas()
  window.addEventListener('resize', resizeCanvas)
  preloadImage().then(() => {
    initPetals(canvas)
    sakuraAnimFrameId = requestAnimationFrame(animate)
  })
}

function stopSakuraAnimation(): void {
  if (sakuraAnimFrameId !== null) {
    cancelAnimationFrame(sakuraAnimFrameId)
    sakuraAnimFrameId = null
  }
  petals = []
  sakuraImage = null
}

const uiStore = useUIStore()

function toggleSidePanels(): void {
  showSidePanels.value = !showSidePanels.value
  uiStore.isHomePanelOpen = showSidePanels.value
}

const backendService = ref({
  running: false,
  pid: -1
})
const backendHealthy = ref<boolean | null>(null)
const isCheckingBackend = ref(false)
const isStartingBackend = ref(false)
const isRestartingBackend = ref(false)
const isSyncingDeps = ref(false)
const isDepsSynced = ref<boolean | null>(null)

let unsubServiceState: (() => void) | null = null
let healthCheckTimer: ReturnType<typeof setInterval> | null = null

const isServiceDown = computed(() => {
  return !backendService.value.running
})

const isServiceStarting = computed(() => {
  return isStartingBackend.value || isRestartingBackend.value || isSyncingDeps.value
})

const serviceStatusClass = computed(() => {
  if (isServiceStarting.value) return 'service-starting'
  if (isServiceDown.value) return 'service-down'
  if (backendHealthy.value === true) return 'service-healthy'
  if (backendHealthy.value === false && backendService.value.running) return 'service-loading'
  return 'service-unknown'
})

const serviceStatusText = computed(() => {
  if (isSyncingDeps.value) return '共鸣同步中...'
  if (isStartingBackend.value) return '苏醒中...'
  if (isRestartingBackend.value) return '重生展开...'
  if (isServiceDown.value) return '沉眠中'
  if (backendHealthy.value === true) return '共鸣中'
  if (backendHealthy.value === false && backendService.value.running) return '苏醒中...'
  return '感知中断'
})

// ─── 内核状态 ──────────────────────────────────────

const kernelState = ref<KernelUpdateState>({
  currentVersion: null,
  latestVersion: null,
  updateAvailable: false,
  installedKernels: [], // 向后兼容：升级后始终只包含当前内核
  operationStatus: 'idle',
  progress: 0,
  statusText: '',
  error: null
})

let unsubKernelState: (() => void) | null = null

const isOperating = computed(() => {
  const s = kernelState.value.operationStatus
  return s !== 'idle' && s !== 'done'
})

const coreStateClass = computed(() => {
  const s = kernelState.value.operationStatus
  if (s === 'error') return 'core-error'
  if (isServiceStarting.value) return 'core-evolving'
  if (isServiceDown.value) return 'core-dormant'
  if (s === 'done') return 'core-bloom'
  if (isOperating.value) return 'core-evolving'
  if (kernelState.value.updateAvailable) return 'core-awakening'
  return 'core-peace'
})

const statusText = computed(() => {
  if (isServiceDown.value || isServiceStarting.value) return serviceStatusText.value
  const s = kernelState.value.operationStatus
  const map: Record<string, string> = {
    idle: '宁静中',
    checking: '感知中',
    downloading: '汲取中',
    installing: '蜕变中',
    settingUpEnv: '共鸣中',
    restarting: '重生中',
    done: '绽放',
    error: '痛苦'
  }
  return map[s] || kernelState.value.statusText || '未知'
})

const statusClass = computed(() => {
  if (isServiceDown.value) return 'status-dormant'
  if (isServiceStarting.value) return 'status-evolving'
  const s = kernelState.value.operationStatus
  if (s === 'error') return 'status-error'
  if (s === 'done') return 'status-bloom'
  if (isOperating.value) return 'status-evolving'
  if (kernelState.value.updateAvailable) return 'status-awakening'
  return 'status-peace'
})

const heartColorPrimary = computed(() => {
  if (isServiceDown.value) return '#94a3b8'
  const s = kernelState.value.operationStatus
  if (s === 'error') return '#ef4444'
  if (s === 'done') return '#22c55e'
  if (isOperating.value) return '#a78bfa'
  if (kernelState.value.updateAvailable) return '#fb7299'
  return '#fb7299'
})

const heartColorSecondary = computed(() => {
  if (isServiceDown.value) return '#cbd5e1'
  const s = kernelState.value.operationStatus
  if (s === 'error') return '#f87171'
  if (s === 'done') return '#4ade80'
  if (isOperating.value) return '#c4b5fd'
  if (kernelState.value.updateAvailable) return '#fda4b8'
  return '#fca5b9'
})

// ─── 更新操作 ──────────────────────────────────────

const isCheckingUpdate = ref(false)
const isUpdating = ref(false)

async function handleCheckUpdate(): Promise<void> {
  isCheckingUpdate.value = true
  try {
    const result = await window.api.kernel.checkUpdate()
    if (!result.success) {
      console.error('检查更新失败:', result.error)
    }
  } catch (e) {
    console.error('检查更新异常:', (e as Error).message)
  } finally {
    isCheckingUpdate.value = false
  }
}

async function handleUpdateToLatest(): Promise<void> {
  isUpdating.value = true
  try {
    const result = await window.api.kernel.updateToLatest()
    if (!result.success) {
      console.error('更新失败:', result.error)
    }
  } catch (e) {
    console.error('更新异常:', (e as Error).message)
  } finally {
    isUpdating.value = false
  }
}

// ─── 环境检测 ──────────────────────────────────────

const envCheckResult = ref<EnvironmentCheckResult | null>(null)
const isCheckingEnv = ref(false)

async function handleCheckEnv(): Promise<void> {
  isCheckingEnv.value = true
  envCheckResult.value = null
  try {
    const result = await window.api.kernel.checkEnvironment()
    if (result.success && result.data) {
      envCheckResult.value = result.data
    } else {
      console.error('环境检测失败:', result.error)
    }
  } catch (e) {
    console.error('环境检测异常:', (e as Error).message)
  } finally {
    isCheckingEnv.value = false
  }
}

// ─── 后端服务管理 ──────────────────────────────────────

async function checkBackendStatus(): Promise<void> {
  isCheckingBackend.value = true
  try {
    const status = await window.api.kernel.getBackendStatus()
    backendService.value = { running: status.running, pid: status.pid }
    if (status.running) {
      const health = await window.api.kernel.checkBackendHealth()
      backendHealthy.value = health.healthy
    } else {
      backendHealthy.value = null
    }
  } catch (e) {
    console.error('检查后端服务状态异常:', (e as Error).message)
  } finally {
    isCheckingBackend.value = false
  }
}

function startHealthPolling(): void {
  healthCheckTimer = setInterval(checkBackendStatus, 8000)
}

function stopHealthPolling(): void {
  if (healthCheckTimer) {
    clearInterval(healthCheckTimer)
    healthCheckTimer = null
  }
}

async function handleStartBackend(): Promise<void> {
  isStartingBackend.value = true
  try {
    // 先同步依赖
    isSyncingDeps.value = true
    const envResult = await window.api.kernel.setupEnvironment()
    isSyncingDeps.value = false

    if (envResult.success) {
      isDepsSynced.value = true
    } else {
      console.warn('依赖同步部分失败，继续启动:', envResult.error)
    }

    const result = await window.api.kernel.startBackend()
    if (!result.success) {
      console.error('启动后端服务失败:', result.error)
    }
  } catch (e) {
    console.error('启动后端服务异常:', (e as Error).message)
  } finally {
    isStartingBackend.value = false
    isSyncingDeps.value = false
    // 稍等后检查状态
    setTimeout(() => {
      void checkBackendStatus()
    }, 2000)
  }
}

async function handleRestartBackend(): Promise<void> {
  isRestartingBackend.value = true
  try {
    const result = await window.api.kernel.restartBackend()
    if (!result.success) {
      console.error('重启后端服务失败:', result.error)
    }
  } catch (e) {
    console.error('重启后端服务异常:', (e as Error).message)
  } finally {
    isRestartingBackend.value = false
    setTimeout(() => {
      void checkBackendStatus()
    }, 3000)
  }
}

async function handleSyncDeps(): Promise<void> {
  isSyncingDeps.value = true
  try {
    const result = await window.api.kernel.setupEnvironment()
    if (result.success) {
      isDepsSynced.value = true
    } else {
      console.error('依赖同步失败:', result.error)
    }
  } catch (e) {
    console.error('依赖同步异常:', (e as Error).message)
  } finally {
    isSyncingDeps.value = false
  }
}

// ─── 日志 ──────────────────────────────────────

interface DisplayLogEntry {
  time: string
  level: 'info' | 'warn' | 'error' | 'success'
  message: string
  source: 'kernel' | 'backend'
}

const kernelLogs = ref<KernelLogEntry[]>([])
const backendLogs = ref<string[]>([])
const isFetchingLogs = ref(false)
let logPollTimer: ReturnType<typeof setInterval> | null = null

const MAX_LOG_ENTRIES = 100

const allLogEntries = computed<DisplayLogEntry[]>(() => {
  const kernel: DisplayLogEntry[] = kernelLogs.value.map((l) => ({
    time: l.time,
    level: l.level,
    message: l.message,
    source: 'kernel' as const
  }))
  const now = new Date().toISOString().replace('T', ' ').slice(0, 19)
  const backend: DisplayLogEntry[] = backendLogs.value.map((msg) => ({
    time: now,
    level: 'info' as const,
    message: msg,
    source: 'backend' as const
  }))
  const merged = [...kernel, ...backend]
  return merged.slice(-MAX_LOG_ENTRIES)
})

async function fetchLogs(): Promise<void> {
  isFetchingLogs.value = true
  try {
    const [kernelResult, backendResult] = await Promise.all([
      window.api.kernel.getLogs(),
      window.api.kernel.getBackendLogs()
    ])
    if (kernelResult.success && kernelResult.data) {
      kernelLogs.value = kernelResult.data
    }
    if (Array.isArray(backendResult)) {
      backendLogs.value = backendResult
    }
  } catch (e) {
    console.error('获取日志异常:', (e as Error).message)
  } finally {
    isFetchingLogs.value = false
  }
}

function startLogPolling(): void {
  fetchLogs()
  logPollTimer = setInterval(fetchLogs, 5000)
}

function stopLogPolling(): void {
  if (logPollTimer) {
    clearInterval(logPollTimer)
    logPollTimer = null
  }
}

watch(showSidePanels, (val) => {
  if (val) {
    startLogPolling()
  } else {
    stopLogPolling()
  }
})

// ─── 生命周期 ──────────────────────────────────────

onMounted(async () => {
  startSakuraAnimation()

  try {
    const state = await window.api.kernel.getState()
    kernelState.value = state
  } catch {
    console.warn('无法获取内核状态')
  }

  unsubKernelState = window.api.kernel.onStateUpdate((state) => {
    kernelState.value = state as KernelUpdateState
  })

  // 监听后端服务状态实时变化
  unsubServiceState = window.api.kernel.onServiceState((state) => {
    backendService.value = { running: state.running, pid: state.pid }
    if (state.logs) {
      backendLogs.value = state.logs
    }
    if (!state.running) {
      backendHealthy.value = null
    }
  })

  // 自动检查后端服务状态
  await checkBackendStatus()
  startHealthPolling()

  handleCheckEnv()

  // 计算与阁下相识的天数
  try {
    const state = await window.api.onboarding.getState()
    if (state.completed && state.completedAt > 0) {
      const startDate = new Date(state.completedAt)
      const today = new Date()
      // 重置到当天0点计算天数差
      const startDay = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate())
      const todayDay = new Date(today.getFullYear(), today.getMonth(), today.getDate())
      const diffMs = todayDay.getTime() - startDay.getTime()
      onboardingDays.value = Math.max(1, Math.floor(diffMs / (1000 * 60 * 60 * 24)) + 1)
    }
  } catch {
    // 静默失败，onboardingDays 保持 0
  }
})

onUnmounted(() => {
  stopSakuraAnimation()
  // 清除模糊滤镜
  uiStore.isHomePanelOpen = false
  unsubKernelState?.()
  unsubServiceState?.()
  stopHealthPolling()
  stopLogPolling()
})
</script>

<style scoped>
.universe {
  width: 100%;
  height: 100%;
  /* position: relative; */
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
}

/* ─── 樱花飘落画布 ──────────────────────────────────── */

.sakura-canvas {
  position: absolute;
  inset: 0;
  z-index: 15;
  pointer-events: none;
  width: 100%;
  height: 100%;
}

/* ─── 左上角问候语 ──────────────────────────────────── */

.greeting-corner {
  position: absolute;
  top: 25px;
  left: 55px;
  display: flex;
  flex-direction: column;
}

.star {
  position: absolute;
  background: #fb7299;
  border-radius: 50%;
  opacity: 0;
  animation: starTwinkle ease-in-out infinite;
  box-shadow: 0 0 6px rgba(251, 114, 153, 0.6);
}

@keyframes starTwinkle {
  0%,
  100% {
    opacity: 0;
    transform: scale(0.5);
  }
  50% {
    opacity: 0.8;
    transform: scale(1);
  }
}

/* ─── 核心圣域 ──────────────────────────────────── */

.core-sanctuary {
  position: relative;
  z-index: 10;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 24px;
  padding: 40px 20px;
}

/* ─── 光环 ──────────────────────────────────────── */

.halo-ring {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: 320px;
  height: 320px;
  pointer-events: none;
  opacity: 0.3;
  transition: opacity 1s ease;
}

.halo-ring.active {
  opacity: 0.8;
}

.halo-inner {
  position: absolute;
  inset: 0;
  border-radius: 50%;
  border: 1px solid rgba(251, 114, 153, 0.2);
  animation: haloRotate 20s linear infinite;
}

.halo-outer {
  position: absolute;
  inset: -20px;
  border-radius: 50%;
  border: 1px solid rgba(251, 114, 153, 0.15);
  animation: haloRotate 30s linear infinite reverse;
}

@keyframes haloRotate {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}

/* ─── 智慧核心 ──────────────────────────────────── */

.wisdom-core {
  position: relative;
  width: 160px;
  height: 160px;
  cursor: pointer;
  transition: transform 0.6s cubic-bezier(0.23, 1, 0.32, 1);
}

.wisdom-core:hover {
  transform: scale(1.05);
}

.core-aura {
  position: absolute;
  inset: -40px;
  border-radius: 50%;
  background: radial-gradient(circle, rgba(251, 114, 153, 0.12) 0%, transparent 70%);
  animation: auraPulse 3s ease-in-out infinite;
  pointer-events: none;
}

@keyframes auraPulse {
  0%,
  100% {
    transform: scale(1);
    opacity: 0.6;
  }
  50% {
    transform: scale(1.2);
    opacity: 1;
  }
}

.core-body {
  position: relative;
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
}

.core-heart {
  width: 100px;
  height: 100px;
  filter: drop-shadow(0 0 20px rgba(251, 114, 153, 0.35));
  transition: filter 0.5s ease;
}

.heart-svg {
  width: 100%;
  height: 100%;
  overflow: visible;
}

.heart-path {
  transition: all 0.5s ease;
  animation: heartBeat 2s ease-in-out infinite;
}

@keyframes heartBeat {
  0%,
  100% {
    transform: scale(1);
  }
  14% {
    transform: scale(1.08);
  }
  28% {
    transform: scale(1);
  }
  42% {
    transform: scale(1.05);
  }
  70% {
    transform: scale(1);
  }
}

.core-pulse {
  position: absolute;
  inset: -20px;
  border-radius: 50%;
  border: 2px solid rgba(251, 114, 153, 0.25);
  animation: pulseRing 2s ease-out infinite;
  pointer-events: none;
}

@keyframes pulseRing {
  0% {
    transform: scale(0.8);
    opacity: 1;
  }
  100% {
    transform: scale(1.5);
    opacity: 0;
  }
}

/* 核心状态变体 */

.core-peace .core-aura {
  background: radial-gradient(circle, rgba(251, 114, 153, 0.12) 0%, transparent 70%);
}

.core-peace .core-heart {
  filter: drop-shadow(0 0 20px rgba(251, 114, 153, 0.3));
}

.core-awakening .core-aura {
  background: radial-gradient(circle, rgba(251, 114, 153, 0.2) 0%, transparent 70%);
  animation: auraPulse 1.5s ease-in-out infinite;
}

.core-awakening .core-heart {
  filter: drop-shadow(0 0 30px rgba(251, 114, 153, 0.6));
}

.core-awakening .heart-path {
  animation: heartBeat 1.5s ease-in-out infinite;
}

.core-evolving .core-aura {
  background: radial-gradient(circle, rgba(251, 114, 153, 0.2) 0%, transparent 70%);
  animation: auraPulse 1s ease-in-out infinite;
}

.core-evolving .core-heart {
  filter: drop-shadow(0 0 40px rgba(251, 114, 153, 0.6));
}

.core-evolving .heart-path {
  animation: heartBeat 0.8s ease-in-out infinite;
}

.core-bloom .core-aura {
  background: radial-gradient(circle, rgba(34, 197, 94, 0.2) 0%, transparent 70%);
}

.core-bloom .core-heart {
  filter: drop-shadow(0 0 30px rgba(34, 197, 94, 0.6));
}

.core-error .core-aura {
  background: radial-gradient(circle, rgba(239, 68, 68, 0.2) 0%, transparent 70%);
  animation: auraPulse 0.8s ease-in-out infinite;
}

.core-error .core-heart {
  filter: drop-shadow(0 0 30px rgba(239, 68, 68, 0.6));
}

.core-error .heart-path {
  animation: heartBeat 0.6s ease-in-out infinite;
}

.core-dormant .core-aura {
  background: radial-gradient(circle, rgba(148, 163, 184, 0.12) 0%, transparent 70%);
  animation: auraPulse 4s ease-in-out infinite;
}
.core-dormant .core-heart {
  filter: drop-shadow(0 0 15px rgba(148, 163, 184, 0.35));
}
.core-dormant .heart-path {
  animation: heartBeat 3s ease-in-out infinite;
}

/* ─── 可变双翼 (翅膀羽翼形态) ──────────────────────────────────── */

.wing {
  position: absolute;
  top: 50%;
  width: 200px;
  height: 160px;
  pointer-events: none;
  transition: all 1.2s cubic-bezier(0.25, 1, 0.4, 1);
  z-index: -1;
}

.wing-left {
  right: 75%;
  transform-origin: right center;
  transform: translateY(-50%) scale(0.1) rotate(-45deg);
  opacity: 0;
}

.wing-right {
  left: 75%;
  transform-origin: left center;
  transform: translateY(-50%) scale(0.1) rotate(45deg);
  opacity: 0;
}

.wing.spread {
  opacity: 0.95;
}

.wing-left.spread {
  transform: translateY(-50%) scale(1) rotate(-8deg);
}

.wing-right.spread {
  transform: translateY(-50%) scale(1) rotate(8deg);
}

.wing-feather {
  position: absolute;
  height: 36px;
  background: linear-gradient(
    135deg,
    rgba(255, 255, 255, 0.96) 0%,
    rgba(255, 236, 242, 0.9) 40%,
    rgba(251, 114, 153, 0.5) 100%
  );
  border: 1px solid rgba(255, 255, 255, 0.75);
  box-shadow:
    0 8px 24px rgba(251, 114, 153, 0.2),
    inset 0 3px 6px rgba(255, 255, 255, 0.9);
  backdrop-filter: blur(6px);
  transition: all 0.8s cubic-bezier(0.25, 1, 0.4, 1);
}

.wing-feather::before {
  content: '';
  position: absolute;
  inset: 2px 6px;
  border-radius: inherit;
  background: linear-gradient(90deg, rgba(255, 255, 255, 0.9), rgba(255, 255, 255, 0));
  opacity: 0.7;
  pointer-events: none;
}

.wing-feather::after {
  content: '';
  position: absolute;
  inset: 8px 10px;
  border-radius: inherit;
  border-top: 1px solid rgba(255, 255, 255, 0.8);
  opacity: 0.6;
  pointer-events: none;
}

.wing-left .wing-feather {
  border-radius: 100% 0% 90% 10% / 90% 40% 60% 20%;
  transform-origin: right center;
  right: 0;
}

.wing-right .wing-feather {
  border-radius: 10% 90% 80% 10% / 10% 60% 40% 10%;
  transform-origin: left center;
  left: 0;
}

/* 左翼羽毛排布：更长、更丰富的展开形态 */
.wing-left .f1 {
  width: 80px;
  top: -10px;
  right: 20px;
  transform: rotate(-50deg);
  z-index: 5;
}
.wing-left .f2 {
  width: 130px;
  top: 15px;
  right: 15px;
  transform: rotate(-30deg);
  z-index: 4;
}
.wing-left .f3 {
  width: 180px;
  top: 50px;
  right: 10px;
  transform: rotate(-10deg);
  z-index: 3;
}
.wing-left .f4 {
  width: 150px;
  top: 85px;
  right: 20px;
  transform: rotate(15deg);
  z-index: 2;
}
.wing-left .f5 {
  width: 100px;
  top: 110px;
  right: 35px;
  transform: rotate(40deg);
  z-index: 1;
}
.wing-left .f6 {
  width: 70px;
  top: 135px;
  right: 52px;
  transform: rotate(55deg);
  z-index: 0;
  opacity: 0.9;
}
.wing-left .f7 {
  width: 120px;
  top: 70px;
  right: 0;
  transform: rotate(-22deg);
  z-index: 2;
  opacity: 0.95;
}

/* 右翼羽毛排布：对称调整 */
.wing-right .f1 {
  width: 80px;
  top: -10px;
  left: 20px;
  transform: rotate(50deg);
  z-index: 5;
}
.wing-right .f2 {
  width: 130px;
  top: 15px;
  left: 15px;
  transform: rotate(30deg);
  z-index: 4;
}
.wing-right .f3 {
  width: 180px;
  top: 50px;
  left: 10px;
  transform: rotate(10deg);
  z-index: 3;
}
.wing-right .f4 {
  width: 150px;
  top: 85px;
  left: 20px;
  transform: rotate(-15deg);
  z-index: 2;
}
.wing-right .f5 {
  width: 100px;
  top: 110px;
  left: 35px;
  transform: rotate(-40deg);
  z-index: 1;
}
.wing-right .f6 {
  width: 70px;
  top: 135px;
  left: 52px;
  transform: rotate(-55deg);
  z-index: 0;
  opacity: 0.9;
}
.wing-right .f7 {
  width: 120px;
  top: 70px;
  left: 0;
  transform: rotate(22deg);
  z-index: 2;
  opacity: 0.95;
}

.wing.spread .wing-feather {
  box-shadow:
    0 10px 30px rgba(251, 114, 153, 0.4),
    inset 0 4px 10px rgba(255, 255, 255, 1);
}

.wing-left .wing-feather {
  background: linear-gradient(
    135deg,
    rgba(255, 255, 255, 0.98) 0%,
    rgba(255, 235, 240, 0.9) 42%,
    rgba(251, 114, 153, 0.55) 100%
  );
}

.wing-right .wing-feather {
  background: linear-gradient(
    45deg,
    rgba(255, 255, 255, 0.98) 0%,
    rgba(255, 235, 240, 0.9) 42%,
    rgba(251, 114, 153, 0.55) 100%
  );
}

/* ─── 核心低语 ──────────────────────────────────── */

.core-whisper {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  opacity: 0;
  transform: translateY(10px);
  transition: all 0.6s ease;
}

.core-whisper.visible {
  opacity: 1;
  transform: translateY(0);
}

.whisper-line {
  text-align: center;
  transition: all 0.3s ease;
}

.whisper-line.name {
  font-size: 20px;
  font-weight: 300;
  color: #4f4f4f;
  letter-spacing: 0.15em;
  text-shadow: 0 0 20px rgba(251, 114, 153, 0.3);
}

.whisper-line.version {
  font-size: 14px;
  color: #999;
  font-weight: 300;
  letter-spacing: 0.1em;
}

.whisper-line.status {
  font-size: 12px;
  font-weight: 500;
  padding: 4px 16px;
  border-radius: 20px;
  letter-spacing: 0.08em;
  backdrop-filter: blur(10px);
}

.status-peace {
  color: #fb7299;
  background: rgba(251, 114, 153, 0.08);
  border: 1px solid rgba(251, 114, 153, 0.15);
}

.status-awakening {
  color: rgba(251, 114, 153, 0.9);
  background: rgba(251, 114, 153, 0.1);
  border: 1px solid rgba(251, 114, 153, 0.2);
  animation: statusGlow 2s ease-in-out infinite;
}

.status-evolving {
  color: #fb7299;
  background: rgba(251, 114, 153, 0.1);
  border: 1px solid rgba(251, 114, 153, 0.25);
  animation: statusGlow 1s ease-in-out infinite;
}

.status-bloom {
  color: rgba(34, 197, 94, 0.9);
  background: rgba(34, 197, 94, 0.1);
  border: 1px solid rgba(34, 197, 94, 0.2);
}

.status-error {
  color: rgba(239, 68, 68, 0.9);
  background: rgba(239, 68, 68, 0.1);
  border: 1px solid rgba(239, 68, 68, 0.2);
  animation: statusGlow 0.8s ease-in-out infinite;
}

.status-dormant {
  color: rgba(148, 163, 184, 0.9);
  background: rgba(148, 163, 184, 0.08);
  border: 1px solid rgba(148, 163, 184, 0.12);
}

@keyframes statusGlow {
  0%,
  100% {
    box-shadow: 0 0 10px currentColor;
  }
  50% {
    box-shadow: 0 0 20px currentColor;
  }
}

.whisper-line.hint {
  font-size: 11px;
  color: #fb7299;
  font-style: italic;
  animation: hintFloat 3s ease-in-out infinite;
}

.whisper-line.service-hint {
  font-size: 11px;
  font-weight: 400;
  padding: 2px 12px;
  border-radius: 12px;
  letter-spacing: 0.06em;
}
.whisper-line.service-hint.service-down {
  color: rgba(148, 163, 184, 0.8);
  background: rgba(148, 163, 184, 0.06);
  border: 1px solid rgba(148, 163, 184, 0.1);
}
.whisper-line.service-hint.service-starting {
  color: rgba(168, 139, 250, 0.85);
  background: rgba(168, 139, 250, 0.06);
  border: 1px solid rgba(168, 139, 250, 0.12);
  animation: statusGlow 1.5s ease-in-out infinite;
}
.whisper-line.service-hint.service-healthy {
  color: rgba(34, 197, 94, 0.75);
}
.whisper-line.service-hint.service-loading {
  color: rgba(245, 158, 11, 0.8);
  background: rgba(245, 158, 11, 0.05);
  border: 1px solid rgba(245, 158, 11, 0.1);
}
.whisper-line.service-hint.service-unknown {
  color: rgba(148, 163, 184, 0.6);
}

@keyframes hintFloat {
  0%,
  100% {
    transform: translateY(0);
    opacity: 0.6;
  }
  50% {
    transform: translateY(-3px);
    opacity: 1;
  }
}

/* ─── 悬浮操作按钮 ───────────────────────────────── */

.floating-actions {
  position: relative;
  z-index: 20;
  display: flex;
  gap: 16px;
  opacity: 0;
  transform: translateY(20px);
  transition: all 0.6s ease 0.3s;
}

.floating-actions.visible {
  opacity: 1;
  transform: translateY(0);
}

.float-btn {
  position: relative;
  width: 48px;
  height: 48px;
  border-radius: 50%;
  border: 1px solid rgba(251, 114, 153, 0.15);
  background: rgba(255, 255, 255, 0.75);
  backdrop-filter: blur(10px);
  color: #4f4f4f;
  font-size: 16px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.3s ease;
  overflow: hidden;
}

.float-btn:hover:not(:disabled) {
  background: rgba(255, 255, 255, 0.95);
  border-color: rgba(251, 114, 153, 0.4);
  color: #fb7299;
  transform: translateY(-2px);
  box-shadow: 0 8px 24px rgba(251, 114, 153, 0.15);
}

.float-btn:disabled {
  opacity: 0.3;
  cursor: not-allowed;
}

.orbit-ring {
  position: absolute;
  inset: -4px;
  border-radius: 50%;
  border: 1px solid rgba(251, 114, 153, 0.3);
  animation: orbitSpin 3s linear infinite;
  opacity: 0;
  transition: opacity 0.3s ease;
}

.orbit-btn:hover .orbit-ring {
  opacity: 1;
}

@keyframes orbitSpin {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}

.evolve-btn {
  border-color: rgba(251, 114, 153, 0.25);
}

.evolve-btn:hover:not(:disabled) {
  box-shadow: 0 8px 24px rgba(251, 114, 153, 0.2);
  border-color: rgba(251, 114, 153, 0.5);
}

.evolve-particles {
  position: absolute;
  inset: 0;
  border-radius: 50%;
  background: radial-gradient(circle, rgba(251, 114, 153, 0.3) 0%, transparent 70%);
  opacity: 0;
  transition: opacity 0.3s ease;
}

.evolve-btn:hover .evolve-particles {
  opacity: 1;
  animation: particleBurst 1s ease-out infinite;
}

@keyframes particleBurst {
  0% {
    transform: scale(0.8);
    opacity: 0.8;
  }
  100% {
    transform: scale(2);
    opacity: 0;
  }
}

.retry-btn {
  border-color: rgba(239, 68, 68, 0.25);
  color: rgba(239, 68, 68, 0.8);
}

.retry-btn:hover:not(:disabled) {
  border-color: rgba(239, 68, 68, 0.5);
  color: rgba(239, 68, 68, 1);
  box-shadow: 0 8px 24px rgba(239, 68, 68, 0.2);
}

.retry-ring {
  position: absolute;
  inset: -4px;
  border-radius: 50%;
  border: 1px dashed rgba(239, 68, 68, 0.45);
  animation: retrySpin 2.5s linear infinite;
  opacity: 0;
  transition: opacity 0.3s ease;
}

.retry-btn:hover .retry-ring {
  opacity: 1;
}

@keyframes retrySpin {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}

/* 唤醒按钮 */
.start-btn {
  border-color: rgba(34, 197, 94, 0.25);
  color: rgba(34, 197, 94, 0.8);
}
.start-btn:hover:not(:disabled) {
  border-color: rgba(34, 197, 94, 0.5);
  color: rgba(34, 197, 94, 1);
  box-shadow: 0 8px 24px rgba(34, 197, 94, 0.2);
}
.start-pulse {
  position: absolute;
  inset: 0;
  border-radius: 50%;
  background: radial-gradient(circle, rgba(34, 197, 94, 0.25) 0%, transparent 70%);
  opacity: 0;
  transition: opacity 0.3s ease;
}
.start-btn:hover .start-pulse {
  opacity: 1;
  animation: particleBurst 1s ease-out infinite;
}

/* 重启按钮 */
.restart-btn {
  border-color: rgba(168, 139, 250, 0.25);
  color: rgba(168, 139, 250, 0.8);
}
.restart-btn:hover:not(:disabled) {
  border-color: rgba(168, 139, 250, 0.5);
  color: rgba(168, 139, 250, 1);
  box-shadow: 0 8px 24px rgba(168, 139, 250, 0.2);
}
.restart-ring {
  position: absolute;
  inset: -4px;
  border-radius: 50%;
  border: 1px dashed rgba(168, 139, 250, 0.45);
  animation: retrySpin 2.5s linear infinite;
  opacity: 0;
  transition: opacity 0.3s ease;
}
.restart-btn:hover .restart-ring {
  opacity: 1;
}

/* 进行中按钮 */
.starting-btn {
  border-color: rgba(168, 139, 250, 0.35);
  color: rgba(168, 139, 250, 0.9);
  cursor: not-allowed;
}

/* 同步依赖按钮 */
.sync-btn {
  border-color: rgba(245, 158, 11, 0.25);
  color: rgba(245, 158, 11, 0.8);
}
.sync-btn:hover:not(:disabled) {
  border-color: rgba(245, 158, 11, 0.5);
  color: rgba(245, 158, 11, 1);
  box-shadow: 0 8px 24px rgba(245, 158, 11, 0.2);
}

/* ─── 侧边毛玻璃面板 ───────────────────────────────── */

.side-panel {
  position: absolute;
  width: 300px;
  height: 435px;
  z-index: 25;
  display: flex;
  flex-direction: column;
  background: rgba(255, 255, 255, 0.42);
  backdrop-filter: blur(40px) saturate(1.2);
  -webkit-backdrop-filter: blur(40px) saturate(1.2);
  border: 1px solid rgba(255, 255, 255, 0.5);
  border-radius: 16px;
  box-shadow:
    0 8px 40px rgba(251, 114, 153, 0.12),
    0 2px 12px rgba(0, 0, 0, 0.04),
    inset 0 1px 0 rgba(255, 255, 255, 0.3);
  pointer-events: auto;
  overflow: hidden;
}

.panel-left {
  left: 20px;
}

.panel-right {
  right: 20px;
}

.panel-header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 20px 20px 14px;
  border-bottom: 1px solid rgba(251, 114, 153, 0.08);
  font-size: 14px;
  font-weight: 500;
  color: #4f4f4f;
  letter-spacing: 0.05em;
  flex-shrink: 0;
}

.panel-header-icon {
  color: #fb7299;
  font-size: 13px;
}

.panel-refresh {
  margin-left: auto;
  background: none;
  border: none;
  color: #bbb;
  cursor: pointer;
  padding: 4px 8px;
  border-radius: 6px;
  transition: all 0.2s ease;
  font-size: 12px;
}

.panel-refresh:hover {
  color: #fb7299;
  background: rgba(251, 114, 153, 0.06);
}

.panel-body {
  flex: 1;
  overflow-y: auto;
  padding: 14px 20px 20px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.panel-body::-webkit-scrollbar {
  width: 4px;
}

.panel-body::-webkit-scrollbar-thumb {
  background: rgba(251, 114, 153, 0.15);
  border-radius: 2px;
}

.panel-body::-webkit-scrollbar-track {
  background: transparent;
}

/* 环境总览 */
.panel-overall {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 14px;
  border-radius: 10px;
  font-size: 13px;
  font-weight: 500;
  margin-bottom: 2px;
}

.overall-pass {
  color: rgba(34, 197, 94, 0.9);
  background: rgba(34, 197, 94, 0.06);
  border: 1px solid rgba(34, 197, 94, 0.12);
}

.overall-fail {
  color: rgba(239, 68, 68, 0.9);
  background: rgba(239, 68, 68, 0.04);
  border: 1px solid rgba(239, 68, 68, 0.12);
}

/* 环境单项 */
.panel-item {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  padding: 10px 14px;
  border-radius: 10px;
  background: rgba(255, 255, 255, 0.5);
  border: 1px solid rgba(251, 114, 153, 0.06);
  transition: all 0.2s ease;
}

.panel-item:hover {
  background: rgba(255, 255, 255, 0.8);
  border-color: rgba(251, 114, 153, 0.12);
}

.panel-item-icon {
  margin-top: 2px;
  font-size: 12px;
  flex-shrink: 0;
}

.item-pass .panel-item-icon {
  color: rgba(34, 197, 94, 0.8);
}

.item-fail .panel-item-icon {
  color: rgba(239, 68, 68, 0.8);
}

.panel-item-text {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.panel-item-name {
  font-size: 13px;
  font-weight: 500;
  color: #555;
}

.panel-item-msg {
  font-size: 11px;
  color: #999;
  word-break: break-all;
}

/* 日志条目 */
.panel-log-entry {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  padding: 8px 12px;
  border-radius: 8px;
  font-size: 11px;
  line-height: 1.5;
  background: rgba(255, 255, 255, 0.4);
  border: 1px solid rgba(251, 114, 153, 0.04);
}

.log-time {
  color: #aaa;
  font-family: 'SF Mono', 'Fira Code', monospace;
  font-size: 10px;
  flex-shrink: 0;
}

.log-level {
  font-weight: 600;
  text-transform: uppercase;
  font-size: 9px;
  flex-shrink: 0;
  padding: 1px 5px;
  border-radius: 3px;
  letter-spacing: 0.04em;
}

.log-info .log-level {
  color: #6366f1;
  background: rgba(99, 102, 241, 0.08);
}

.log-warn .log-level {
  color: #f59e0b;
  background: rgba(245, 158, 11, 0.08);
}

.log-error .log-level {
  color: #ef4444;
  background: rgba(239, 68, 68, 0.08);
}

.log-success .log-level {
  color: #22c55e;
  background: rgba(34, 197, 94, 0.08);
}

.log-msg {
  color: #666;
  word-break: break-all;
  width: 100%;
}

.log-source {
  font-weight: 600;
  font-size: 9px;
  padding: 1px 5px;
  border-radius: 3px;
  letter-spacing: 0.04em;
  flex-shrink: 0;
  background: rgba(99, 102, 241, 0.06);
  color: rgba(99, 102, 241, 0.7);
}

.log-source-kernel {
  background: rgba(148, 163, 184, 0.06);
  color: rgba(148, 163, 184, 0.7);
}

.panel-log-entry.log-backend {
  border-left: 2px solid rgba(99, 102, 241, 0.2);
}

.panel-log-entry.log-info {
  border-left: 2px solid rgba(99, 102, 241, 0.4);
}

.panel-log-entry.log-warn {
  border-left: 2px solid rgba(245, 158, 11, 0.4);
}

.panel-log-entry.log-error {
  border-left: 2px solid rgba(239, 68, 68, 0.4);
}

.panel-log-entry.log-success {
  border-left: 2px solid rgba(34, 197, 94, 0.4);
}

/* 空状态 */
.panel-empty {
  text-align: center;
  color: #bbb;
  font-size: 12px;
  padding: 40px 0;
  letter-spacing: 0.05em;
}

/* 侧边面板滑入/滑出动画 */
.panel-slide-left-enter-active,
.panel-slide-left-leave-active {
  transition: transform 0.5s cubic-bezier(0.23, 1, 0.32, 1);
}

.panel-slide-left-enter-from,
.panel-slide-left-leave-to {
  transform: translateX(calc(-100% - 20px));
}

.panel-slide-right-enter-active,
.panel-slide-right-leave-active {
  transition: transform 0.5s cubic-bezier(0.23, 1, 0.32, 1);
}

.panel-slide-right-enter-from,
.panel-slide-right-leave-to {
  transform: translateX(calc(100% + 20px));
}

/* ─── 迷雾过渡动画 ───────────────────────────────── */

.mist-enter-active,
.mist-leave-active {
  transition: all 0.5s cubic-bezier(0.23, 1, 0.32, 1);
}

.mist-enter-from,
.mist-leave-to {
  opacity: 0;
  transform: translateY(-10px);
}

/* ─── 弹窗虚空 ──────────────────────────────────── */

.modal-void {
  position: fixed;
  inset: 0;
  z-index: 1000;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.2);
  backdrop-filter: blur(8px);
}

.modal-nebula {
  background: #fff;
  border-radius: 20px;
  width: 520px;
  max-width: 90vw;
  max-height: 80vh;
  display: flex;
  flex-direction: column;
  border: 1px solid rgba(251, 114, 153, 0.1);
  box-shadow:
    0 20px 60px rgba(0, 0, 0, 0.1),
    0 0 40px rgba(251, 114, 153, 0.08);
  overflow: hidden;
}

.modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 18px 24px;
  border-bottom: 1px solid #f0e8ea;
}

.modal-header h3 {
  margin: 0;
  font-size: 15px;
  font-weight: 500;
  color: #fb7299;
  letter-spacing: 0.05em;
}

.modal-close {
  background: none;
  border: none;
  cursor: pointer;
  color: #bbb;
  font-size: 16px;
  padding: 4px 8px;
  border-radius: 8px;
  transition: all 0.2s ease;
}

.modal-close:hover {
  color: #4f4f4f;
  background: rgba(251, 114, 153, 0.05);
}

.modal-body {
  padding: 20px 24px;
  overflow-y: auto;
  flex: 1;
  font-size: 13px;
  color: #555;
  line-height: 1.7;
}

.modal-body :deep(h2) {
  font-size: 15px;
  margin-top: 16px;
  margin-bottom: 8px;
  color: #4f4f4f;
  font-weight: 500;
}

.modal-body :deep(h3) {
  font-size: 14px;
  margin-top: 14px;
  margin-bottom: 6px;
  color: #666;
  font-weight: 500;
}

.modal-body :deep(ul),
.modal-body :deep(ol) {
  padding-left: 20px;
  margin: 8px 0;
}

.modal-body :deep(li) {
  margin-bottom: 4px;
}

.modal-body :deep(code) {
  background: rgba(251, 114, 153, 0.06);
  padding: 1px 6px;
  border-radius: 4px;
  font-size: 12px;
  color: #fb7299;
}

.modal-body :deep(pre) {
  background: #f9f6f7;
  padding: 12px;
  border-radius: 8px;
  overflow-x: auto;
  border: 1px solid #f0e8ea;
}

.modal-footer {
  padding: 14px 24px;
  border-top: 1px solid #f0e8ea;
  display: flex;
  justify-content: flex-end;
}

/* 弹窗迷雾过渡 */
.mist-modal-enter-active,
.mist-modal-leave-active {
  transition: opacity 0.3s ease;
}

.mist-modal-enter-active .modal-nebula,
.mist-modal-leave-active .modal-nebula {
  transition:
    transform 0.3s ease,
    opacity 0.3s ease;
}

.mist-modal-enter-from,
.mist-modal-leave-to {
  opacity: 0;
}

.mist-modal-enter-from .modal-nebula {
  transform: scale(0.95) translateY(10px);
  opacity: 0;
}

.mist-modal-leave-to .modal-nebula {
  transform: scale(0.95) translateY(10px);
  opacity: 0;
}

/* ─── 响应式 ────────────────────────────────────── */

@media (max-width: 768px) {
  .wisdom-core {
    width: 120px;
    height: 120px;
  }

  .core-heart {
    width: 75px;
    height: 75px;
  }

  .halo-ring {
    width: 240px;
    height: 240px;
  }

  .wing {
    width: 80px;
    height: 60px;
  }

  .whisper-line.name {
    font-size: 16px;
  }

  .side-panel {
    width: 220px;
    top: 10%;
    bottom: 10%;
  }

  .floating-actions {
    gap: 10px;
  }

  .float-btn {
    width: 40px;
    height: 40px;
    font-size: 14px;
  }

  .panel-left {
    left: 12px;
  }

  .panel-right {
    right: 12px;
  }

  .panel-header {
    padding: 16px 16px 12px;
    font-size: 13px;
  }

  .panel-body {
    padding: 12px 16px 16px;
  }

  .modal-nebula {
    width: 95vw;
    max-height: 90vh;
    border-radius: 16px;
  }
}
</style>
