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
      <!-- 光环 -->
      <div class="halo-ring" :class="{ active: isOperating, dormant: isServiceDown }">
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
        <div class="wing wing-left" :class="{ spread: shouldWingsSpread }">
          <div class="wing-layer layer-inner">
            <div class="wing-flap">
              <div class="wing-feather f1"></div>
              <div class="wing-feather f2"></div>
              <div class="wing-feather f3"></div>
              <div class="wing-feather f4"></div>
            </div>
          </div>
          <div class="wing-layer layer-mid">
            <div class="wing-flap">
              <div class="wing-feather f1"></div>
              <div class="wing-feather f2"></div>
              <div class="wing-feather f3"></div>
              <div class="wing-feather f4"></div>
            </div>
          </div>
          <div class="wing-layer layer-outer">
            <div class="wing-flap">
              <div class="wing-feather f1"></div>
              <div class="wing-feather f2"></div>
              <div class="wing-feather f3"></div>
              <div class="wing-feather f4"></div>
              <div class="wing-feather f5"></div>
              <div class="wing-feather f6"></div>
              <div class="wing-feather f7"></div>
            </div>
          </div>
        </div>

        <!-- 可变双翼 - 右 -->
        <div class="wing wing-right" :class="{ spread: shouldWingsSpread }">
          <div class="wing-layer layer-inner">
            <div class="wing-flap">
              <div class="wing-feather f1"></div>
              <div class="wing-feather f2"></div>
              <div class="wing-feather f3"></div>
              <div class="wing-feather f4"></div>
            </div>
          </div>
          <div class="wing-layer layer-mid">
            <div class="wing-flap">
              <div class="wing-feather f1"></div>
              <div class="wing-feather f2"></div>
              <div class="wing-feather f3"></div>
              <div class="wing-feather f4"></div>
            </div>
          </div>
          <div class="wing-layer layer-outer">
            <div class="wing-flap">
              <div class="wing-feather f1"></div>
              <div class="wing-feather f2"></div>
              <div class="wing-feather f3"></div>
              <div class="wing-feather f4"></div>
              <div class="wing-feather f5"></div>
              <div class="wing-feather f6"></div>
              <div class="wing-feather f7"></div>
            </div>
          </div>
        </div>
      </div>

      <!-- 核心状态文字 -->
      <div class="core-whisper" :class="{ visible: showSidePanels }">
        <div class="whisper-line name">智慧核心</div>

        <div class="whisper-line status" :class="statusClass">
          {{ statusText }}
        </div>
        <div
          v-if="kernelMode === 'local' && kernelState.currentVersion"
          class="whisper-line version"
        >
          v{{ kernelState.currentVersion }}
        </div>
        <div v-if="kernelMode === 'api' && apiOnline !== null" class="whisper-line version">
          {{ apiOnline ? '远程连接正常' : '远程连接失败' }}
        </div>
      </div>
    </div>

    <!-- 悬浮操作按钮 -->
    <div class="floating-actions" :class="{ visible: showSidePanels }">
      <button
        v-if="kernelMode === 'api'"
        class="float-btn orbit-btn"
        :disabled="isCheckingApi"
        title="检查API状态"
        @click="checkApiHealth"
      >
        <span class="orbit-ring"></span>
        <font-awesome-icon icon="fa-solid fa-satellite" :class="{ 'fa-spin': isCheckingApi }" />
      </button>

      <button
        v-if="kernelMode === 'local' && isServiceDown && !isServiceStarting"
        class="float-btn start-btn"
        :disabled="isStartingBackend"
        title="启动核心"
        @click="handleStartBackend"
      >
        <span class="start-pulse"></span>
        <font-awesome-icon icon="fa-solid fa-play" />
      </button>

      <button
        v-if="kernelMode === 'local' && backendService.running && !isServiceStarting"
        class="float-btn restart-btn"
        :disabled="isRestartingBackend"
        title="重启核心"
        @click="handleRestartBackend"
      >
        <span class="restart-ring"></span>
        <font-awesome-icon icon="fa-solid fa-rotate-right" />
      </button>

      <button
        v-if="kernelMode === 'local' && isServiceStarting"
        class="float-btn starting-btn"
        disabled
        title="进行中..."
      >
        <font-awesome-icon icon="fa-solid fa-spinner" class="fa-spin" />
      </button>

      <button
        v-if="kernelMode === 'local' && isServiceDown && !isServiceStarting"
        class="float-btn sync-btn"
        :disabled="isSyncingDeps"
        title="同步共鸣依赖"
        @click="handleSyncDeps"
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
                  : `${envCheckResult.items.filter((i) => !i.passed).length} 处错误`
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

    <!-- 右侧面板 - 日志终端 -->
    <Transition name="panel-slide-right">
      <div v-if="showSidePanels" class="side-panel panel-right">
        <div class="panel-header">
          <font-awesome-icon icon="fa-solid fa-scroll" class="panel-header-icon" />
          <span>内核日志</span>
          <button class="panel-header-action" title="打开日志目录" @click="openLogDir">
            <font-awesome-icon icon="fa-solid fa-folder-open" />
          </button>
        </div>
        <div class="panel-body panel-body-terminal">
          <KernelLogTerminal :visible="showSidePanels" />
        </div>
      </div>
    </Transition>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { useUIStore } from '../stores/useUIStore'
import { useConfigStore } from '../stores/useConfigStore'
import { NotificationService } from '../services/NotificationService'
import type { KernelUpdateState, EnvironmentCheckResult } from '@shared/types/kernel'
import KernelLogTerminal from '../components/KernelLogTerminal.vue'
import sakuraImg from '../assets/images/sakura.webp'

/** 通知服务实例 */
const notificationService = NotificationService.getInstance()
/** 上一次内核操作状态，用于检测状态变化 */
const lastOperationStatus = ref<string>('idle')

// 是否展示侧面吧
const showSidePanels = ref(false)
// 与用户相识的天数
const onboardingDays = ref(0)

// ─── 运行模式切换 ──────────────────────────────────────
/** 从配置store读取运行模式 */
const configStore = useConfigStore()
const kernelMode = computed(() => configStore.config.kernelMode)
const apiOnline = ref<boolean | null>(null)
const isCheckingApi = ref(false)
let apiHealthCheckTimer: ReturnType<typeof setInterval> | null = null

// 打开日志目录
async function openLogDir(): Promise<void> {
  await window.api.kernel.openLogDir()
}

// 樱花飘落相关
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

// 初始化樱花瓣数据
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

// 启动樱花动画
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

// 停止樱花动画并清理资源
function stopSakuraAnimation(): void {
  if (sakuraAnimFrameId !== null) {
    cancelAnimationFrame(sakuraAnimFrameId)
    sakuraAnimFrameId = null
  }
  petals = []
  sakuraImage = null
}

// UI 状态管理，与背景模糊等交互
const uiStore = useUIStore()

// 切换侧边面板显示状态
function toggleSidePanels(): void {
  showSidePanels.value = !showSidePanels.value
  uiStore.isHomePanelOpen = showSidePanels.value
}

// 后端服务状态
const backendService = ref({
  running: false,
  pid: -1
})
// 后端服务健康状态：null=未知，true=健康，false=不健康
const backendHealthy = ref<boolean | null>(null)
// 是否正在启动后端服务
const isStartingBackend = ref(false)
// 是否正在重启后端服务
const isRestartingBackend = ref(false)
// 是否正在同步依赖
const isSyncingDeps = ref(false)

// 监听后端服务状态变化的取消函数
let unsubServiceState: (() => void) | null = null

let healthCheckTimer: ReturnType<typeof setInterval> | null = null

// 服务是否正在运行
const isServiceDown = computed(() => {
  return !backendService.value.running
})

const isServiceStarting = computed(() => {
  return isStartingBackend.value || isRestartingBackend.value || isSyncingDeps.value
})

/**
 * 后端服务已启动但尚未通过健康检查（数据加载中）
 * 包含两种情况：
 * - backendHealthy === null：健康检查尚未运行（进程刚启动，或 setTimeout 等待中）
 * - backendHealthy === false：健康检查超时 / 失败，但进程仍在运行
 * 此状态用于填补 handleRestartBackend/handleStartBackend 的 finally 块
 * 到 checkBackendStatus 完成健康检查之间的空白期，防止核心过早显示"宁静中"
 */
const isBackendLoading = computed(() => {
  return backendService.value.running && backendHealthy.value !== true
})

const serviceStatusText = computed(() => {
  // API模式下的状态文字
  if (kernelMode.value === 'api') {
    if (isCheckingApi.value) return '检查API中...'
    if (apiOnline.value === true) return '成功链接远程核心'
    if (apiOnline.value === false) return '链接远程核心失败'
    return '未知状态'
  }

  // 本地模式下的状态文字
  if (isSyncingDeps.value) return '共鸣同步中...'
  if (isStartingBackend.value) return '苏醒中...'
  if (isRestartingBackend.value) return '重启中...'
  if (isServiceDown.value) return '沉眠中'
  if (backendHealthy.value === true) return '共鸣中'
  if (backendHealthy.value === false && backendService.value.running) return '苏醒中...'
  // 健康状态未知但进程已运行（如刚重启/启动后尚未完成健康检查）
  if (backendHealthy.value === null && backendService.value.running) return '苏醒中...'
  return '更新中断'
})

// ─── 内核状态 ──────────────────────────────────────

const kernelState = ref<KernelUpdateState>({
  currentVersion: null,
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

/**
 * 核心视觉状态类名
 * 优先级：error > 启动中/加载中 > 更新中 > 休眠 > 完成 > 可更新 > 宁静
 * isBackendLoading 填补了 API 调用返回后到健康检查完成之间的状态空白
 */
const coreStateClass = computed(() => {
  // API模式下的核心状态
  if (kernelMode.value === 'api') {
    if (isCheckingApi.value) return 'core-evolving'
    if (apiOnline.value === true) return 'core-peace'
    if (apiOnline.value === false) return 'core-dormant'
    return 'core-dormant'
  }

  // 本地模式下的核心状态
  const s = kernelState.value.operationStatus
  if (s === 'error') return 'core-error'
  if (isServiceStarting.value) return 'core-evolving'
  if (isBackendLoading.value) return 'core-evolving'
  if (isOperating.value) return 'core-evolving'
  if (isServiceDown.value) return 'core-dormant'
  // 完成状态保持宁静状态样式
  return 'core-peace'
})

/**
 * 双翼展开规则：
 * - 仅在用户点击核心 且 核心正常（peace）时展开
 * - 休眠、错误、演进中等状态即使点击也不展开
 * - 未点击时始终收缩
 */
const shouldWingsSpread = computed(() => {
  if (!showSidePanels.value) return false
  const cls = coreStateClass.value
  return cls === 'core-peace'
})

const statusText = computed(() => {
  // API模式下的状态文字
  if (kernelMode.value === 'api') {
    if (isCheckingApi.value) return '检查API中...'
    if (apiOnline.value === true) return '远程模式'
    if (apiOnline.value === false) return '链接失败'
    return '未知'
  }

  // 本地模式下的状态文字
  if (isServiceStarting.value) return serviceStatusText.value
  // 后端进程已运行但健康检查尚未通过（数据加载中）
  if (isBackendLoading.value) return '苏醒中...'
  const s = kernelState.value.operationStatus
  if (isOperating.value) {
    const map: Record<string, string> = {
      idle: '运行中...',
      checking: '感知中',
      downloading: '下载中',
      installing: '安装中',
      settingUpEnv: '共鸣中',
      restarting: '重启中',
      done: '完成',
      error: '错误！'
    }
    return map[s] || kernelState.value.statusText || '运行中...'
  }
  if (isServiceDown.value) return '沉眠中'
  const map: Record<string, string> = {
    idle: '宁静中',
    done: '宁静中',
    error: '错误！'
  }
  return map[s] || kernelState.value.statusText || '宁静中'
})

const statusClass = computed(() => {
  // API模式下的状态样式
  if (kernelMode.value === 'api') {
    if (isCheckingApi.value) return 'status-evolving'
    if (apiOnline.value === true) return 'status-peace'
    if (apiOnline.value === false) return 'status-dormant'
    return 'status-dormant'
  }

  // 本地模式下的状态样式
  if (isServiceStarting.value) return 'status-evolving'
  if (isBackendLoading.value) return 'status-evolving'
  if (isOperating.value) {
    const s = kernelState.value.operationStatus
    if (s === 'error') return 'status-error'
    return 'status-evolving'
  }
  if (isServiceDown.value) return 'status-dormant'
  const s = kernelState.value.operationStatus
  if (s === 'error') return 'status-error'
  return 'status-peace'
})

const heartColorPrimary = computed(() => {
  // API模式下的颜色
  if (kernelMode.value === 'api') {
    if (isCheckingApi.value) return '#c8a0e0'
    if (apiOnline.value === true) return '#fb7299'
    if (apiOnline.value === false) return '#c8bdd8'
    return '#c8bdd8'
  }

  // 本地模式下的颜色
  const s = kernelState.value.operationStatus
  if (s === 'error') return '#f0a0a8'
  if (isServiceStarting.value || isBackendLoading.value || isOperating.value) return '#c8a0e0'
  if (isServiceDown.value) return '#c8bdd8'
  // 完成状态使用默认颜色
  return '#fb7299'
})

const heartColorSecondary = computed(() => {
  // API模式下的颜色
  if (kernelMode.value === 'api') {
    if (isCheckingApi.value) return '#e0c8f5'
    if (apiOnline.value === true) return '#fca5b9'
    if (apiOnline.value === false) return '#e0d8f0'
    return '#e0d8f0'
  }

  // 本地模式下的颜色
  const s = kernelState.value.operationStatus
  if (s === 'error') return '#fad0d5'
  if (isServiceStarting.value || isBackendLoading.value || isOperating.value) return '#e0c8f5'
  if (isServiceDown.value) return '#e0d8f0'
  // 完成状态使用默认颜色
  return '#fca5b9'
})

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

// ─── API模式检查 ──────────────────────────────────────

/**
 * 检查API是否在线
 * 在API模式下定期调用，确认远程服务可用性
 */
async function checkApiHealth(): Promise<void> {
  if (kernelMode.value !== 'api') return

  isCheckingApi.value = true
  try {
    const result = await window.api.kernel.checkApiHealth()
    apiOnline.value = result.healthy
  } catch {
    apiOnline.value = false
  } finally {
    isCheckingApi.value = false
  }
}

/**
 * 启动API健康检查定时器
 * 每30秒检查一次API是否在线
 */
function startApiHealthPolling(): void {
  stopApiHealthPolling()
  apiHealthCheckTimer = setInterval(checkApiHealth, 30000)
}

/**
 * 停止API健康检查定时器
 */
function stopApiHealthPolling(): void {
  if (apiHealthCheckTimer) {
    clearInterval(apiHealthCheckTimer)
    apiHealthCheckTimer = null
  }
}

/**
 * 监听模式变化，自动切换服务
 */
watch(kernelMode, async (newMode) => {
  if (newMode === 'api') {
    // 切换到API模式：停止本地内核轮询，启动API检查
    stopHealthPolling()
    if (backendService.value.running) {
      await window.api.kernel.stopBackend()
    }
    backendService.value = { running: false, pid: -1 }
    backendHealthy.value = null
    await checkApiHealth()
    startApiHealthPolling()
  } else {
    // 切换到本地模式：停止API检查，启动本地内核
    stopApiHealthPolling()
    apiOnline.value = null
    await checkBackendStatus()
    startHealthPolling()
  }
})

// ─── 后端服务管理 ──────────────────────────────────────

async function checkBackendStatus(): Promise<void> {
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

    if (!envResult.success) {
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
    if (!result.success) {
      console.error('依赖同步失败:', result.error)
    }
  } catch (e) {
    console.error('依赖同步异常:', (e as Error).message)
  } finally {
    isSyncingDeps.value = false
  }
}

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

    // 根据内核状态变化发送通知
    const newStatus = state.operationStatus
    const oldStatus = lastOperationStatus.value

    if (newStatus !== oldStatus) {
      lastOperationStatus.value = newStatus

      // 检查更新开始
      if (newStatus === 'checking') {
        notificationService.info({
          title: '内核更新',
          message: '正在检查内核更新...',
          key: 'kernel-update'
        })
      }
      // 下载开始
      else if (newStatus === 'downloading' && oldStatus !== 'downloading') {
        notificationService.info({
          title: '内核更新',
          message: '开始下载内核更新...',
          key: 'kernel-update'
        })
      }
      // 安装中
      else if (newStatus === 'installing' && oldStatus !== 'installing') {
        notificationService.info({
          title: '内核更新',
          message: '正在安装内核...',
          key: 'kernel-update'
        })
      }
      // 环境配置中
      else if (newStatus === 'settingUpEnv' && oldStatus !== 'settingUpEnv') {
        notificationService.info({
          title: '内核更新',
          message: '正在配置运行环境...',
          key: 'kernel-update'
        })
      }
      // 更新完成
      else if (newStatus === 'done' && oldStatus !== 'done' && oldStatus !== 'idle') {
        notificationService.success({
          title: '内核更新',
          message: state.statusText || '内核更新完成！',
          key: 'kernel-update'
        })
      }
      // 更新出错
      else if (newStatus === 'error' && oldStatus !== 'error') {
        notificationService.error({
          title: '内核更新',
          message: state.error || state.statusText || '内核更新失败',
          key: 'kernel-update'
        })
      }
    }

    // 下载进度通知（使用key避免频繁弹出新通知）
    if (newStatus === 'downloading' && state.progress > 0) {
      notificationService.info({
        title: '内核下载中',
        message: `下载进度: ${state.progress}%`,
        key: 'kernel-download-progress',
        duration: 2000
      })
    }
  })

  // 监听后端服务状态实时变化
  unsubServiceState = window.api.kernel.onServiceState((state) => {
    backendService.value = { running: state.running, pid: state.pid }
    if (!state.running) {
      backendHealthy.value = null
    }
  })

  // 根据模式初始化
  if (kernelMode.value === 'local') {
    // 本地模式：自动检查后端服务状态
    await checkBackendStatus()
    startHealthPolling()
  } else {
    // API模式：检查API健康状态
    await checkApiHealth()
    startApiHealthPolling()
  }

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
  stopApiHealthPolling()
  // 重置状态
  lastOperationStatus.value = 'idle'
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
  z-index: 2;
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

.halo-ring.dormant {
  opacity: 0.15;
}

.halo-ring.dormant .halo-inner,
.halo-ring.dormant .halo-outer {
  animation: none;
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
  transform-origin: center;
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

.core-evolving .core-aura {
  background: radial-gradient(circle, rgba(200, 160, 224, 0.2) 0%, transparent 70%);
  animation: auraPulse 1s ease-in-out infinite;
}

.core-evolving .core-heart {
  filter: drop-shadow(0 0 40px rgba(200, 160, 224, 0.6));
}

.core-evolving .heart-path {
  animation: heartBeat 0.8s ease-in-out infinite;
}

.core-error .core-aura {
  background: radial-gradient(circle, rgba(240, 160, 168, 0.2) 0%, transparent 70%);
  animation: auraPulse 0.8s ease-in-out infinite;
}

.core-error .core-heart {
  filter: drop-shadow(0 0 30px rgba(240, 160, 168, 0.6));
}

.core-error .heart-path {
  animation: heartBeat 0.6s ease-in-out infinite;
}

.core-dormant .core-aura {
  background: radial-gradient(circle, rgba(200, 189, 216, 0.12) 0%, transparent 70%);
  animation: none;
}
.core-dormant .core-heart {
  filter: drop-shadow(0 0 15px rgba(200, 189, 216, 0.35));
}
.core-dormant .heart-path {
  animation: none;
}
.core-dormant .core-pulse {
  animation: none;
  opacity: 0;
}

/* ─── 可变双翼 (翅膀羽翼形态) ──────────────────────────────────── */

.wing {
  position: absolute;
  top: 50%;
  width: 220px;
  height: 190px;
  pointer-events: none;
  transition:
    opacity 0.9s ease,
    transform 1.2s cubic-bezier(0.25, 1, 0.4, 1);
  z-index: -1;
}

.wing-left {
  right: 78%;
  transform-origin: right center;
  transform: translateY(-50%) scale(0.1) rotate(-38deg);
  opacity: 0;
}

.wing-right {
  left: 78%;
  transform-origin: left center;
  transform: translateY(-50%) scale(0.1) rotate(38deg);
  opacity: 0;
}

.wing.spread {
  opacity: 0.95;
}

.wing-left.spread {
  transform: translateY(-50%) scale(1) rotate(-6deg);
}

.wing-right.spread {
  transform: translateY(-50%) scale(1) rotate(6deg);
}

.wing-layer {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  transform-origin: center;
}

.wing-flap {
  position: relative;
  width: 100%;
  height: 100%;
  transform-origin: center;
  animation: wingFlap 4.8s ease-in-out infinite;
}

.wing-left .wing-flap {
  transform-origin: right 55%;
}

.wing-right .wing-flap {
  transform-origin: left 55%;
}

.layer-inner {
  transform: translateY(-6px) scale(0.74);

  opacity: 1;
  filter: blur(0.2px);
  z-index: 3;
}

.layer-mid {
  transform: translateY(6px) scale(0.88);
  opacity: 0.92;
  z-index: 2;
}

.layer-outer {
  transform: translateY(16px) scale(1);
  opacity: 0.85;
  z-index: 1;
}

.layer-inner .wing-flap {
  animation-delay: -0.6s;
}

.layer-mid .wing-flap {
  animation-delay: -0.3s;
}

.layer-outer .wing-flap {
  animation-delay: 0s;
}

.wing-feather {
  position: absolute;
  height: 32px;
  border-radius: 999px;
  -webkit-mask-image: radial-gradient(closest-side, rgba(0, 0, 0, 1) 92%, rgba(0, 0, 0, 0) 100%);
  mask-image: radial-gradient(closest-side, rgba(0, 0, 0, 1) 92%, rgba(0, 0, 0, 0) 100%);
  -webkit-mask-repeat: no-repeat;
  mask-repeat: no-repeat;
  -webkit-mask-size: 100% 100%;
  mask-size: 100% 100%;
  background: linear-gradient(
    135deg,
    rgba(255, 255, 255, 0.97) 0%,
    rgba(255, 240, 245, 0.88) 30%,
    rgba(251, 114, 153, 0.48) 55%,
    rgba(200, 155, 225, 0.35) 80%,
    rgba(255, 245, 250, 0.82) 100%
  );
  box-shadow:
    0 6px 18px rgba(251, 114, 153, 0.12),
    0 2px 6px rgba(200, 155, 225, 0.08),
    inset 0 2px 8px rgba(255, 255, 255, 0.75);
  transition:
    transform 0.8s cubic-bezier(0.25, 1, 0.4, 1),
    box-shadow 0.8s cubic-bezier(0.25, 1, 0.4, 1),
    filter 0.8s cubic-bezier(0.25, 1, 0.4, 1);
}

/* ─── 羽轴 (Rachis) ──────────────────────────────── */
/* 中央纵向亮线，模拟真实羽毛的羽轴 */
.wing-feather::before {
  content: '';
  position: absolute;
  top: 50%;
  height: 1.5px;
  transform: translateY(-50%);
  z-index: 3;
  pointer-events: none;
  border-radius: 1px;
  opacity: 0.65;
}

/* ─── 羽枝纹理 (Barbs) ────────────────────────────── */
/* 斜向细纹模拟羽枝从羽轴向两侧辐射 */
.wing-feather::after {
  content: '';
  position: absolute;
  inset: 3px 0;
  z-index: 1;
  pointer-events: none;
  opacity: 0.22;
  -webkit-mask-image: linear-gradient(
    to right,
    transparent 0%,
    rgba(0, 0, 0, 0.5) 12%,
    rgba(0, 0, 0, 0.75) 35%,
    rgba(0, 0, 0, 0.4) 70%,
    transparent 100%
  );
  mask-image: linear-gradient(
    to right,
    transparent 0%,
    rgba(0, 0, 0, 0.5) 12%,
    rgba(0, 0, 0, 0.75) 35%,
    rgba(0, 0, 0, 0.4) 70%,
    transparent 100%
  );
}

.wing-left .wing-feather {
  /* 左翼羽毛轮廓: 基部在右(100%)，尖端在左(0%) */
  /* 上缘窄(leading edge)，下缘宽(trailing edge)，模拟真实飞羽的不对称 */
  clip-path: polygon(
    100% 38%,
    100% 62%,
    92% 70%,
    80% 78%,
    66% 86%,
    50% 92%,
    34% 90%,
    20% 82%,
    10% 70%,
    6% 58%,
    8% 46%,
    14% 34%,
    26% 24%,
    44% 16%,
    62% 12%,
    78% 16%,
    90% 26%
  );
  transform-origin: right center;
  right: 0;
}

.wing-right .wing-feather {
  /* 右翼羽毛轮廓: 基部在左(0%)，尖端在右(100%) —— 左翼的水平镜像 */
  clip-path: polygon(
    0% 38%,
    0% 62%,
    8% 70%,
    20% 78%,
    34% 86%,
    50% 92%,
    66% 90%,
    80% 82%,
    90% 70%,
    94% 58%,
    92% 46%,
    86% 34%,
    74% 24%,
    56% 16%,
    38% 12%,
    22% 16%,
    10% 26%
  );
  transform-origin: left center;
  left: 0;
}

/* ─── 左翼羽轴方向: 从基部(右)延伸到尖部(左) ─────── */
.wing-left .wing-feather::before {
  left: 0;
  right: 3px;
  background: linear-gradient(
    to right,
    rgba(255, 255, 255, 0.08) 0%,
    rgba(255, 255, 255, 0.75) 22%,
    rgba(255, 255, 255, 0.95) 50%,
    rgba(255, 255, 255, 0.5) 82%,
    rgba(255, 255, 255, 0.12) 100%
  );
}

/* ─── 右翼羽轴方向: 从基部(左)延伸到尖部(右) ─────── */
.wing-right .wing-feather::before {
  left: 3px;
  right: 0;
  background: linear-gradient(
    to left,
    rgba(255, 255, 255, 0.08) 0%,
    rgba(255, 255, 255, 0.75) 22%,
    rgba(255, 255, 255, 0.95) 50%,
    rgba(255, 255, 255, 0.5) 82%,
    rgba(255, 255, 255, 0.12) 100%
  );
}

/* ─── 左翼羽枝: 斜纹向尖端汇聚 ────────────────────── */
.wing-left .wing-feather::after {
  background: repeating-linear-gradient(
    72deg,
    transparent,
    transparent 2px,
    rgba(255, 255, 255, 0.45) 2px,
    rgba(255, 255, 255, 0.45) 2.5px
  );
}

/* ─── 右翼羽枝: 镜像斜纹 ──────────────────────────── */
.wing-right .wing-feather::after {
  background: repeating-linear-gradient(
    -72deg,
    transparent,
    transparent 2px,
    rgba(255, 255, 255, 0.45) 2px,
    rgba(255, 255, 255, 0.45) 2.5px
  );
}

/* 3层羽毛排布：从内到外递进，羽毛朝外、长度自上而下递减 */
.wing-left .layer-inner .f1 {
  width: 95px;
  top: 40px;
  right: -10px;
  transform: rotate(20deg);
  z-index: 4;
}
.wing-left .layer-inner .f2 {
  width: 86px;
  top: 80px;
  right: 10px;
  transform: rotate(10deg);
  z-index: 3;
}
.wing-left .layer-inner .f3 {
  width: 76px;
  top: 110px;
  right: 0px;
  transform: rotate(0deg);
  z-index: 2;
}
.wing-left .layer-inner .f4 {
  width: 64px;
  top: 150px;
  right: -20px;
  transform: rotate(-10deg);
  z-index: 1;
}

.wing-left .layer-mid .f1 {
  width: 138px;
  top: 20px;
  right: 20px;
  transform: rotate(20deg);
  z-index: 4;
}
.wing-left .layer-mid .f2 {
  width: 124px;
  top: 50px;
  right: 14px;
  transform: rotate(10deg);
  z-index: 3;
}
.wing-left .layer-mid .f3 {
  width: 108px;
  top: 80px;
  right: 20px;
  transform: rotate(0deg);
  z-index: 2;
}
.wing-left .layer-mid .f4 {
  width: 92px;
  top: 110px;
  right: 14px;
  transform: rotate(-10deg);
  z-index: 1;
}

.wing-left .layer-outer .f1 {
  width: 188px;
  top: 20px;
  right: 20px;
  transform: rotate(22deg);
  z-index: 4;
}
.wing-left .layer-outer .f2 {
  width: 172px;
  top: 30px;
  right: 14px;
  transform: rotate(10deg);
  z-index: 3;
}
.wing-left .layer-outer .f3 {
  width: 154px;
  top: 68px;
  right: 10px;
  transform: rotate(0deg);
  z-index: 2;
}
.wing-left .layer-outer .f4 {
  width: 134px;
  top: 104px;
  right: 14px;
  transform: rotate(-15deg);
  z-index: 1;
}

.wing-left .layer-outer .f5 {
  width: 120px;
  top: 10px;
  left: 14px;
  transform: rotate(10deg);
  z-index: 1;
}
.wing-left .layer-outer .f6 {
  width: 134px;
  top: 50px;
  left: 14px;
  transform: rotate(5deg);
  z-index: 1;
}
.wing-left .layer-outer .f7 {
  width: 134px;
  top: 85px;
  left: 30px;
  transform: rotate(-10deg);
  z-index: 1;
}

.wing-right .layer-inner .f1 {
  width: 95px;
  top: 40px;
  left: -10px;
  transform: rotate(-20deg);
  z-index: 4;
}
.wing-right .layer-inner .f2 {
  width: 86px;
  top: 80px;
  left: 10px;
  transform: rotate(-10deg);
  z-index: 3;
}
.wing-right .layer-inner .f3 {
  width: 76px;
  top: 110px;
  left: 0px;
  transform: rotate(0deg);
  z-index: 2;
}
.wing-right .layer-inner .f4 {
  width: 64px;
  top: 150px;
  left: -20px;
  transform: rotate(10deg);
  z-index: 1;
}

.wing-right .layer-mid .f1 {
  width: 138px;
  top: 20px;
  left: 20px;
  transform: rotate(-20deg);
  z-index: 4;
}
.wing-right .layer-mid .f2 {
  width: 124px;
  top: 50px;
  left: 14px;
  transform: rotate(-10deg);
  z-index: 3;
}
.wing-right .layer-mid .f3 {
  width: 108px;
  top: 80px;
  left: 20px;
  transform: rotate(0deg);
  z-index: 2;
}
.wing-right .layer-mid .f4 {
  width: 92px;
  top: 110px;
  left: 14px;
  transform: rotate(10deg);
  z-index: 1;
}

.wing-right .layer-outer .f1 {
  width: 188px;
  top: 20px;
  left: 20px;
  transform: rotate(-22deg);
  z-index: 4;
}
.wing-right .layer-outer .f2 {
  width: 172px;
  top: 30px;
  left: 14px;
  transform: rotate(-10deg);
  z-index: 3;
}
.wing-right .layer-outer .f3 {
  width: 154px;
  top: 68px;
  left: 10px;
  transform: rotate(0deg);
  z-index: 2;
}
.wing-right .layer-outer .f4 {
  width: 134px;
  top: 104px;
  left: 14px;
  transform: rotate(15deg);
  z-index: 1;
}

.wing-right .layer-outer .f5 {
  width: 120px;
  top: 20px;
  left: 80px;
  transform: rotate(-10deg);
  z-index: 1;
}
.wing-right .layer-outer .f6 {
  width: 134px;
  top: 50px;
  left: 50px;
  transform: rotate(-5deg);
  z-index: 1;
}
.wing-right .layer-outer .f7 {
  width: 134px;
  top: 85px;
  left: 30px;
  transform: rotate(10deg);
  z-index: 1;
}

.wing.spread .wing-feather {
  /* 展开态增强光效: 多层霓虹 glow + 虹彩色调 */
  box-shadow:
    0 12px 36px rgba(251, 114, 153, 0.45),
    0 4px 16px rgba(200, 155, 225, 0.3),
    0 0 60px rgba(251, 114, 153, 0.15),
    inset 0 3px 12px rgba(255, 255, 255, 0.95);
}

@keyframes wingFlap {
  0%,
  100% {
    transform: rotate(0deg) translateY(0);
  }
  35% {
    transform: rotate(2deg) translateY(-2px);
  }
  65% {
    transform: rotate(-1.5deg) translateY(1px);
  }
}

/* 左翼虹彩渐变: 基底已设，此处微调方向与饱和度 */
.wing-left .wing-feather {
  background: linear-gradient(
    135deg,
    rgba(255, 255, 255, 0.97) 0%,
    rgba(255, 238, 245, 0.85) 35%,
    rgba(251, 114, 153, 0.5) 60%,
    rgba(200, 155, 225, 0.38) 85%,
    rgba(255, 245, 250, 0.8) 100%
  );
}

/* 右翼虹彩渐变: 方向镜像，保持左右视觉一致 */
.wing-right .wing-feather {
  background: linear-gradient(
    225deg,
    rgba(255, 255, 255, 0.97) 0%,
    rgba(255, 238, 245, 0.85) 35%,
    rgba(251, 114, 153, 0.5) 60%,
    rgba(200, 155, 225, 0.38) 85%,
    rgba(255, 245, 250, 0.8) 100%
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
  color: #5a5a5ab0;
  letter-spacing: 0.15em;
  text-shadow: 0 0 20px rgba(251, 114, 153, 0.3);
  font-family: 'KaTongFont';
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

.status-evolving {
  color: #c8a0e0;
  background: rgba(200, 160, 224, 0.1);
  border: 1px solid rgba(200, 160, 224, 0.25);
  animation: statusGlow 1s ease-in-out infinite;
}

.status-error {
  color: rgba(240, 160, 168, 0.9);
  background: rgba(240, 160, 168, 0.1);
  border: 1px solid rgba(240, 160, 168, 0.2);
  animation: statusGlow 0.8s ease-in-out infinite;
}

.status-dormant {
  color: rgba(200, 189, 216, 0.9);
  background: rgba(200, 189, 216, 0.08);
  border: 1px solid rgba(200, 189, 216, 0.12);
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
  color: rgba(200, 189, 216, 0.8);
  background: rgba(200, 189, 216, 0.06);
  border: 1px solid rgba(200, 189, 216, 0.1);
}
.whisper-line.service-hint.service-starting {
  color: rgba(168, 139, 250, 0.85);
  background: rgba(168, 139, 250, 0.06);
  border: 1px solid rgba(168, 139, 250, 0.12);
  animation: statusGlow 1.5s ease-in-out infinite;
}
.whisper-line.service-hint.service-healthy {
  color: rgba(248, 184, 208, 0.75);
}
.whisper-line.service-hint.service-loading {
  color: rgba(245, 158, 11, 0.8);
  background: rgba(245, 158, 11, 0.05);
  border: 1px solid rgba(245, 158, 11, 0.1);
}
.whisper-line.service-hint.service-unknown {
  color: rgba(200, 189, 216, 0.6);
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
  width: 27%;
  height: 60%;
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

.panel-header-action {
  margin-left: auto;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border: none;
  border-radius: 6px;
  background: rgba(251, 114, 153, 0.08);
  color: #fb7299;
  cursor: pointer;
  font-size: 13px;
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
  color: rgba(251, 114, 153, 0.9);
  background: rgba(251, 114, 153, 0.06);
  border: 1px solid rgba(251, 114, 153, 0.12);
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
  color: rgba(251, 114, 153, 0.8);
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

/* 日志终端容器 */
.panel-body-terminal {
  padding: 0;
  display: flex;
}

.panel-body-terminal > :deep(div) {
  width: 100%;
  height: 100%;
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
</style>
