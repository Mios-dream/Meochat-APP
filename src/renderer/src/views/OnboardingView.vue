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
          <!-- Regular kernel setup display -->
          <template v-if="!isDownloadingModels">
            <div class="status-title">{{ logStatusTitle }}</div>
            <div class="status-sub">{{ logStatusSub }}</div>
            <div v-if="kernelProgress > 0" class="kernel-progress-wrap">
              <div class="kernel-progress-bar">
                <div class="kernel-progress-fill" :style="{ width: `${kernelProgress}%` }"></div>
              </div>
              <span class="kernel-progress-pct">{{ kernelProgress }}%</span>
            </div>
            <div v-else class="progress-indicator">
              <div
                v-for="i in 5"
                :key="i"
                class="progress-dot"
                :class="{ active: i <= logProgressDot }"
              ></div>
            </div>
          </template>

          <!-- Elegant model download display -->
          <template v-else>
            <div class="model-download-section">
              <div class="md-icon-wrap">
                <div class="md-pulse-ring"></div>
                <span class="md-icon-inner">◈</span>
              </div>
              <div class="status-title">{{ logStatusTitle }}</div>
              <p class="md-status-hint">{{ logStatusSub }}</p>

              <div class="md-model-cards">
                <div class="md-card" :class="modelCardClass('embedding')">
                  <span class="md-card-icon" :class="modelCardClass('embedding')">
                    {{ modelCardIcon('embedding') }}
                  </span>
                  <div class="md-card-info">
                    <span class="md-card-name">语义嵌入模型</span>
                    <span class="md-card-desc">Embedding · 文本理解</span>
                  </div>
                </div>
                <div class="md-card" :class="modelCardClass('asr')">
                  <span class="md-card-icon" :class="modelCardClass('asr')">
                    {{ modelCardIcon('asr') }}
                  </span>
                  <div class="md-card-info">
                    <span class="md-card-name">语音识别模型</span>
                    <span class="md-card-desc">ASR · 语音转文字</span>
                  </div>
                </div>
              </div>

              <div class="kernel-progress-wrap md-progress">
                <div class="kernel-progress-bar">
                  <div class="kernel-progress-fill" :style="{ width: `${kernelProgress}%` }"></div>
                </div>
                <span class="kernel-progress-pct">{{ kernelProgress }}%</span>
              </div>
            </div>
          </template>

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
                <button class="log-dialog-action" title="打开日志目录" @click="openLogDir">
                  <font-awesome-icon icon="fa-solid fa-folder-open" />
                </button>
              </div>
              <div class="log-dialog-body-terminal">
                <KernelLogTerminal :visible="showLogDrawer" />
              </div>
            </div>
          </div>
          <!-- still starting hint -->
          <div v-if="backendStillStarting" class="hint-block">
            <p class="hint-text">澪的意识核心正在苏醒中...已等待 {{ healthCheckElapsed }} 秒</p>
            <p class="hint-sub">请查看日志了解进度，澪会持续尝试连接</p>
            <div class="hint-actions">
              <button class="btn-cold" @click="restartBackendService">重启服务</button>
            </div>
          </div>

          <!-- error -->
          <div v-else-if="backendError" class="error-block">
            <p class="error-text">{{ backendError }}</p>
            <div class="error-actions">
              <button class="btn-cold btn-ghost-cold" @click="switchMode">
                {{ currentMode === 'api' ? '切换本地模式' : '切换 API 模式' }}
              </button>
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
            <button class="btn-cold" @click="retryBackend">重试</button>
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

        <!-- MODEL_CONFIG -->
        <div
          v-else-if="currentState === 'MODEL_CONFIG'"
          key="model-config"
          class="screen meeting-bg"
        >
          <div class="onboarding-panel" :class="{ 'panel-entering': showModelPanel }">
            <h2 class="panel-title">配置模型服务</h2>
            <p class="panel-hint">请填写大模型服务的 API 信息</p>

            <div class="profile-grid">
              <label class="field field-full">
                <span>API 地址</span>
                <input
                  v-model="modelConfig.api"
                  type="text"
                  placeholder="例如：https://api.openai.com/v1"
                />
              </label>

              <label class="field field-full">
                <span>API Key</span>
                <input v-model="modelConfig.key" type="password" placeholder="sk-..." />
              </label>

              <label class="field field-full">
                <span>模型名称</span>
                <input
                  v-model="modelConfig.model"
                  type="text"
                  placeholder="例如：gpt-4o、qwen-plus"
                />
              </label>
            </div>

            <p v-if="modelConfigError" class="error-text">{{ modelConfigError }}</p>

            <div class="actions">
              <button
                class="btn-submit"
                :disabled="savingModelConfig || verifyingModelConfig"
                @click="submitModelConfig"
              >
                {{
                  savingModelConfig ? '保存中...' : verifyingModelConfig ? '验证中...' : '下一步'
                }}
              </button>
            </div>
          </div>
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
import { computed, nextTick, onMounted, onUnmounted, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'

import { useConfigStore } from '../stores/useConfigStore'
import { OnboardingMode, OnboardingProfile } from '@shared/types/onboarding'
import type { KernelUpdateState, EnvironmentCheckResult } from '@shared/types/kernel'
import KernelLogTerminal from '../components/KernelLogTerminal.vue'
import ParticleCanvas from '../components/onboarding/ParticleCanvas.vue'

// ─── type helpers ───────────────────────────────────────────────────────────

type OnboardingState =
  | 'BOOT'
  | 'SYSTEM_WAKE'
  | 'LOG_STREAM'
  | 'PERSONALITY_ONLINE'
  | 'SAKURA_TRANSITION'
  | 'MODEL_CONFIG'
  | 'FIRST_MEETING'
  | 'PROFILE_SYNC'
  | 'CONTRACT'
  | 'HOME'

// ─── services / singletons ──────────────────────────────────────────────────

const router = useRouter()
const configStore = useConfigStore()

// ─── state machine ──────────────────────────────────────────────────────────

const currentState = ref<OnboardingState>('BOOT')
const currentMode = ref<OnboardingMode>('local')
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
    case 'MODEL_CONFIG':
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
    case 'MODEL_CONFIG':
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

// ─── kernel / backend state ─────────────────────────────────────────────────

const kernelState = ref<KernelUpdateState | null>(null)
const backendRunning = ref(false)
const backendPid = ref(-1)
const backendError = ref('')
const backendStillStarting = ref(false) // 健康检查超时但进程仍在运行
const healthCheckAbort = ref(false) // 取消健康检查轮询
const healthCheckElapsed = ref(0) // 健康检查已等待秒数
let healthCheckElapsedTimer: ReturnType<typeof setInterval> | null = null
const assistantLoadError = ref('')
const assistantProgress = ref(0)
const logStatusTitle = ref('正在初始化内核...')
const logStatusSub = ref('正在检查运行环境')
const logProgressDot = ref(1)
const kernelProgress = ref(0)
const isDownloadingModels = ref(false)
const modelDownloadStage = ref<'idle' | 'embedding' | 'asr' | 'tts' | 'complete'>('idle')
let logDotTimer: ReturnType<typeof setInterval> | null = null
let kernelStateUnlisten: (() => void) | null = null
let serviceStateUnlisten: (() => void) | null = null
let assistantDownloadResolve: (() => void) | null = null

// ─── profile ────────────────────────────────────────────────────────────────

const profile = reactive<OnboardingProfile>({
  birthday: '',
  gender: '',
  occupation: ''
})

const apiAddress = ref('')
const showLogDrawer = ref(false)

const logSourceText = computed(() => {
  if (currentMode.value === 'api') return 'API 模式'
  if (backendRunning.value) return `内核服务运行中 (PID: ${backendPid.value})`
  if (kernelState.value?.currentVersion) return `内核 v${kernelState.value.currentVersion}`
  return '内核未就绪'
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

function startHealthCheckElapsedTimer(): void {
  healthCheckElapsed.value = 0
  healthCheckElapsedTimer = setInterval(() => {
    healthCheckElapsed.value++
  }, 1000)
}

function stopHealthCheckElapsedTimer(): void {
  if (healthCheckElapsedTimer) {
    clearInterval(healthCheckElapsedTimer)
    healthCheckElapsedTimer = null
  }
}

function toggleLogDrawer(): void {
  showLogDrawer.value = !showLogDrawer.value
}

async function openLogDir(): Promise<void> {
  await window.api.kernel.openLogDir()
}

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

function validateApiAddress(address: string): boolean {
  const withoutProtocol = address.replace(/^https?:\/\//i, '')
  return /^[\w.-]+:\d+$/.test(withoutProtocol)
}

async function checkApiHealth(address: string, attempts = 1): Promise<boolean> {
  const normalizedAddress = address.trim().replace(/\/$/, '')
  for (let i = 0; i < attempts; i++) {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 5000)
    try {
      const response = await fetch(`${normalizedAddress}/api/health`, {
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

// ─── kernel: environment check & setup ──────────────────────────────────────

/**
 * 检查内核运行环境，必要时执行安装
 * 返回 true 表示内核就绪可以启动后端
 */
async function ensureKernelReady(): Promise<boolean> {
  currentState.value = 'LOG_STREAM'
  backendError.value = ''
  startLogDots()

  logStatusTitle.value = '正在检查内核环境...'
  logStatusSub.value = '扫描运行环境与依赖'

  // 1. 检查环境
  const envResult = await window.api.kernel.checkEnvironment()
  if (!envResult.success) {
    backendError.value = `环境检查失败: ${envResult.error || '未知错误'}`
    stopLogDots()
    return false
  }

  const env: EnvironmentCheckResult = envResult.data!
  const kernelInstalled = env.items.find((i) => i.key === 'kernel')?.passed ?? false
  const venvReady = env.items.find((i) => i.key === 'venv')?.passed ?? false

  if (!kernelInstalled) {
    // 2a. 未安装内核 → 下载并安装
    logStatusTitle.value = '正在获取内核信息...'
    logStatusSub.value = '从 GitHub 获取最新版本'

    const checkResult = await window.api.kernel.checkUpdate()
    if (!checkResult.success) {
      backendError.value = `获取内核版本失败: ${checkResult.error || '未知错误'}`
      stopLogDots()
      return false
    }

    logStatusTitle.value = '正在下载内核源码...'
    logStatusSub.value = '首次下载约需数分钟，请耐心等待'

    const installResult = await window.api.kernel.updateToLatest()
    if (!installResult.success) {
      backendError.value = `内核安装失败: ${(installResult as { error?: string }).error || '未知错误'}`
      stopLogDots()
      return false
    }

    logStatusTitle.value = '内核安装完成'
    logStatusSub.value = '正在准备下载 AI 模型...'
    await wait(800)
  } else if (!venvReady) {
    // 2b. 内核已安装但 venv 未就绪 → 运行 uv sync
    logStatusTitle.value = '正在安装 Python 依赖...'
    logStatusSub.value = '首次安装约需下载 5GB，请耐心等待'

    const setupResult = await window.api.kernel.setupEnvironment()
    if (!setupResult.success) {
      backendError.value = `环境安装失败: ${setupResult.error || '未知错误'}`
      stopLogDots()
      return false
    }

    logStatusTitle.value = '依赖安装完成'
    logStatusSub.value = '正在准备下载 AI 模型...'
    await wait(800)
  }

  // 3. 下载 AI 模型（embedding, ASR 等）
  isDownloadingModels.value = true
  stopLogDots()
  logStatusTitle.value = '正在同步 AI 模型...'
  logStatusSub.value = '首次下载语音识别与语义模型，预计约需 5 分钟'

  const modelResult = await window.api.kernel.downloadModels()
  if (!modelResult.success) {
    isDownloadingModels.value = false
    backendError.value = `模型下载失败: ${modelResult.error || '未知错误'}`
    return false
  }

  isDownloadingModels.value = false
  modelDownloadStage.value = 'complete'
  logStatusTitle.value = '模型同步完成'
  logStatusSub.value = '内核环境已就绪'

  await wait(600)
  return true
}

// ─── backend: start service & health check ──────────────────────────────────

async function startBackendService(): Promise<boolean> {
  currentState.value = 'LOG_STREAM'
  backendError.value = ''
  backendStillStarting.value = false
  healthCheckAbort.value = false
  healthCheckElapsed.value = 0
  logStatusTitle.value = '正在启动核心服务...'
  logStatusSub.value = '初始化智慧核心所需的基础设施'
  startLogDots()

  // 刷新后端日志（可能来自上一次运行）
  const status = await window.api.kernel.getBackendStatus()
  if (status.running) {
    logStatusTitle.value = '核心服务已在运行'
    logStatusSub.value = '正在检查连接状态...'
    stopLogDots()

    // 检查健康状态
    const healthResult = await window.api.kernel.checkBackendHealth()
    if (healthResult.healthy) {
      logStatusTitle.value = '核心服务就绪'
      logStatusSub.value = '意识核心连接成功'
      await wait(500)
      return true
    }
  }

  // 启动后端
  const startResult = await window.api.kernel.startBackend()
  if (!startResult.success) {
    backendError.value = startResult.error || '启动服务失败。'
    stopLogDots()
    return false
  }

  logStatusTitle.value = '正在唤醒澪的意识核心...'
  logStatusSub.value = '检查神经网络连接状态'

  // 启动等待计时器
  startHealthCheckElapsedTimer()

  // 持续轮询健康检查，直到通过或被取消
  while (!healthCheckAbort.value) {
    const healthResult = await window.api.kernel.checkBackendHealth()

    if (healthResult.healthy) {
      // 健康检查通过
      stopHealthCheckElapsedTimer()
      stopLogDots()
      backendStillStarting.value = false
      logStatusTitle.value = '核心服务就绪'
      logStatusSub.value = '意识核心连接成功'
      await wait(500)
      return true
    }

    if (!healthResult.stillRunning) {
      // 进程已退出 - 真正的错误
      stopHealthCheckElapsedTimer()
      stopLogDots()
      backendStillStarting.value = false
      backendError.value = healthResult.error || '后端服务启动失败。'
      return false
    }

    // 进程仍在运行但健康检查未通过 - 继续轮询
    // 超过阈值后显示"仍在启动中"提示
    if (healthCheckElapsed.value >= 30 && !backendStillStarting.value) {
      backendStillStarting.value = true
      logStatusTitle.value = '后台启动时间较长'
      logStatusSub.value = '请查看日志了解进度，如出现错误请尝试重启'
    }
  }

  // 被取消（用户点击了重启）
  stopHealthCheckElapsedTimer()
  return false
}

// ─── retry / switch mode ────────────────────────────────────────────────────

async function restartBackendService(): Promise<void> {
  // 取消当前健康检查轮询
  healthCheckAbort.value = true
  stopHealthCheckElapsedTimer()

  backendError.value = ''
  backendStillStarting.value = false
  currentState.value = 'LOG_STREAM'
  logStatusTitle.value = '正在重启后端服务...'
  logStatusSub.value = '请稍候'
  startLogDots()

  // 先停止后端服务
  await window.api.kernel.stopBackend()
  await wait(1000)

  // 重新启动
  const backendOk = await startBackendService()
  if (!backendOk) return

  currentMode.value = 'local'
  await window.api.onboarding.setMode('local')
  await loadAssistant()
  await advanceAfterAssistantLoaded()
}

async function retryBackend(): Promise<void> {
  if (currentMode.value === 'api') {
    const ok = await connectApiMode()
    if (ok) {
      await loadAssistant()
      await advanceAfterAssistantLoaded()
    }
  } else {
    // 重试完整流程：检查内核环境 → 安装依赖 → 下载模型 → 启动后端服务
    backendError.value = ''
    backendStillStarting.value = false
    currentState.value = 'LOG_STREAM'

    const kernelReady = await ensureKernelReady()
    if (!kernelReady) return

    const backendOk = await startBackendService()
    if (!backendOk) return

    currentMode.value = 'local'
    await window.api.onboarding.setMode('local')
    await loadAssistant()
    await advanceAfterAssistantLoaded()
  }
}

async function switchMode(): Promise<void> {
  if (currentMode.value === 'local') {
    currentMode.value = 'api'
    currentState.value = 'LOG_STREAM'
    backendError.value = ''
    backendStillStarting.value = false
    apiAddress.value = configStore.config.baseUrl || 'http://127.0.0.1:8001'
    logStatusTitle.value = 'API 模式'
    logStatusSub.value = `等待连接 ${apiAddress.value}...`
    await wait(600)
    const ok = await connectApiMode()
    if (ok) {
      await loadAssistant()
      await advanceAfterAssistantLoaded()
    }
  } else {
    currentMode.value = 'local'
    currentState.value = 'LOG_STREAM'
    backendError.value = ''
    backendStillStarting.value = false
    await window.api.onboarding.setMode('local')

    const kernelReady = await ensureKernelReady()
    if (!kernelReady) return

    const ok = await startBackendService()
    if (ok) {
      await loadAssistant()
      await advanceAfterAssistantLoaded()
    }
  }
}

// ─── backend: API mode ──────────────────────────────────────────────────────

async function connectApiMode(): Promise<boolean> {
  backendError.value = ''
  const normalizedAddress = apiAddress.value.trim().replace(/\/$/, '')
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

  const result = await window.api.loadAssistantData()
  if (!result.success) {
    assistantLoadError.value = `助手数据加载失败：${result.error || '未知错误'}`
    return
  }

  assistantProgress.value = Math.max(assistantProgress.value, 30)

  // 等待后台资源下载完成
  await new Promise<void>((resolve) => {
    assistantDownloadResolve = resolve
    // 设置超时，避免永久等待
    setTimeout(() => {
      if (assistantDownloadResolve) {
        assistantDownloadResolve()
        assistantDownloadResolve = null
      }
    }, 60000)
  })

  assistantProgress.value = 100
  await wait(400)
}

async function advanceAfterAssistantLoaded(): Promise<void> {
  if (assistantLoadError.value) return
  await startSakuraTransition()
  await startModelConfig()
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

// ─── MODEL_CONFIG ────────────────────────────────────────────────────────

const modelConfig = reactive({
  api: '',
  key: '',
  model: ''
})
const savingModelConfig = ref(false)
const verifyingModelConfig = ref(false)
const modelConfigError = ref('')
const showModelPanel = ref(false)

async function startModelConfig(): Promise<void> {
  currentState.value = 'MODEL_CONFIG'
  await wait(400)
  showModelPanel.value = true
}

async function submitModelConfig(): Promise<void> {
  savingModelConfig.value = true
  modelConfigError.value = ''

  try {
    if (!modelConfig.api.trim()) {
      modelConfigError.value = '请填写 API 地址'
      return
    }
    if (!modelConfig.key.trim()) {
      modelConfigError.value = '请填写 API Key'
      return
    }
    if (!modelConfig.model.trim()) {
      modelConfigError.value = '请填写模型名称'
      return
    }

    const baseUrl = configStore.config.baseUrl || 'http://127.0.0.1:8001'
    const normalizedBase = baseUrl

    // 1. 保存配置
    const saveResponse = await fetch(`${normalizedBase}/api/update_config`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        data: {
          LLM: {
            api: modelConfig.api.trim(),
            key: modelConfig.key.trim(),
            model: modelConfig.model.trim()
          },
          ChatLLM: {
            api: modelConfig.api.trim(),
            key: modelConfig.key.trim(),
            model: modelConfig.model.trim()
          }
        }
      })
    })

    if (!saveResponse.ok) {
      const result = await saveResponse.json().catch(() => ({}))
      modelConfigError.value = (result as { detail?: string }).detail || '配置保存失败，请检查参数'
      return
    }

    // 2. 验证配置可用性：发送测试请求
    savingModelConfig.value = false
    verifyingModelConfig.value = true
    modelConfigError.value = ''

    const testResponse = await fetch(`${normalizedBase}/api/llm_chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ msg: [{ role: 'user', content: 'hi' }] }),
      signal: AbortSignal.timeout(30000)
    })

    if (!testResponse.ok) {
      modelConfigError.value = '模型连接测试失败，请检查 API 地址、Key 和模型名称是否正确'
      return
    }

    // 3. 验证通过，进入下一步
    showModelPanel.value = false
    await wait(300)
    await startFirstMeeting()
  } catch (e) {
    const err = e as Error
    if (err.name === 'TimeoutError') {
      modelConfigError.value = '模型连接超时，请检查 API 地址是否可达'
    } else {
      modelConfigError.value = `配置验证失败：${err.message}`
    }
  } finally {
    savingModelConfig.value = false
    verifyingModelConfig.value = false
  }
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

// ─── model download card helpers ─────────────────────────────────────────

function modelCardClass(stage: 'embedding' | 'asr' | 'tts'): string {
  const current = modelDownloadStage.value
  const order = { idle: 0, embedding: 1, asr: 2, tts: 3, complete: 4 }
  const stageOrder = { embedding: 1, asr: 2, tts: 3 }
  const stageIdx = stageOrder[stage]
  const currentIdx = order[current]

  if (currentIdx > stageIdx) return 'done'
  if (currentIdx === stageIdx) return 'active'
  return 'pending'
}

function modelCardIcon(stage: 'embedding' | 'asr' | 'tts'): string {
  const cls = modelCardClass(stage)
  if (cls === 'done') return '✓'
  if (cls === 'active') return '◈'
  return '○'
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

// ─── IPC listeners ──────────────────────────────────────────────────────────

function onAssistantDownloadProgress(
  _event: unknown,
  payload: { status: string; assistantName?: string; progress?: number }
): void {
  if (payload.status === 'completed' || payload.status === 'idle') {
    assistantProgress.value = 100
    if (assistantDownloadResolve) {
      assistantDownloadResolve()
      assistantDownloadResolve = null
    }
  } else if (payload.progress !== undefined) {
    assistantProgress.value = Math.max(0, Math.min(100, payload.progress))
  }
}

function onKernelStateUpdate(state: KernelUpdateState): void {
  kernelState.value = state
  kernelProgress.value = state.progress

  // 根据操作状态更新 LOG_STREAM 显示
  if (state.operationStatus !== 'idle' && state.operationStatus !== 'done') {
    // 如果是模型下载阶段，使用优雅的状态文本而非原始日志
    if (isDownloadingModels.value) {
      const rawText = state.statusText || ''
      // 根据 stdout 内容推断当前下载的模型类型
      if (rawText.includes('embedding') || rawText.includes('sentence')) {
        modelDownloadStage.value = 'embedding'
      } else if (
        rawText.includes('asr') ||
        rawText.includes('whisper') ||
        rawText.includes('speech')
      ) {
        modelDownloadStage.value = 'asr'
      } else if (rawText.includes('tts') || rawText.includes('vits') || rawText.includes('bert')) {
        modelDownloadStage.value = 'tts'
      }
      // 不更新 logStatusTitle/Sub，保持优雅的阶段标题
    } else {
      logStatusTitle.value = state.statusText || logStatusTitle.value
      logStatusSub.value = state.progress > 0 ? `进度: ${state.progress}%` : '请稍候...'
    }
  }
}

function onServiceState(state: { running: boolean; pid: number; logs: string[] }): void {
  backendRunning.value = state.running
  backendPid.value = state.pid
}

// ─── main flow ──────────────────────────────────────────────────────────────

async function runFlow(): Promise<void> {
  // 1. BOOT
  await startBootSequence()

  // 2. SYSTEM_WAKE
  await startSystemWake()

  // 3. LOG_STREAM → ensure kernel ready (install/setup/models if needed)
  currentMode.value = 'local'
  await window.api.onboarding.setMode('local')

  const kernelReady = await ensureKernelReady()
  if (!kernelReady) return // stay in LOG_STREAM showing error

  // 4. LOG_STREAM → start backend service & wait for health
  const backendOk = await startBackendService()
  if (!backendOk) return // stay in LOG_STREAM showing error

  // 5. PERSONALITY_ONLINE → load assistant
  await loadAssistant()
  if (assistantLoadError.value) return
  await advanceAfterAssistantLoaded()
}

// ─── bootstrap ──────────────────────────────────────────────────────────────

onMounted(async () => {
  // 监听助手数据加载进度
  window.api.ipcRenderer.on('assistant:download-progress', onAssistantDownloadProgress)

  // 监听内核状态更新
  kernelStateUnlisten = window.api.kernel.onStateUpdate(onKernelStateUpdate)

  // 监听后端服务状态
  serviceStateUnlisten = window.api.kernel.onServiceState(onServiceState)

  // 拉取初始内核状态
  const ks = await window.api.kernel.getState()
  kernelState.value = ks

  // 拉取初始后端服务状态
  const svcStatus = await window.api.kernel.getBackendStatus()
  backendRunning.value = svcStatus.running
  backendPid.value = svcStatus.pid

  const onboardingState = await window.api.onboarding.getState()
  if (onboardingState.completed) {
    await router.replace('/tabs')
    return
  }

  apiAddress.value = configStore.config.baseUrl || 'http://127.0.0.1:8001'

  if (onboardingState.profile) {
    profile.birthday = onboardingState.profile.birthday || ''
    profile.gender = onboardingState.profile.gender || ''
    profile.occupation = onboardingState.profile.occupation || ''
  }

  await runFlow()
})

onUnmounted(() => {
  window.api.ipcRenderer.removeAllListeners('assistant:download-progress')
  if (kernelStateUnlisten) kernelStateUnlisten()
  if (serviceStateUnlisten) serviceStateUnlisten()
  stopLogDots()
  stopHealthCheckElapsedTimer()
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

.log-dialog-action {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 26px;
  height: 26px;
  border: none;
  border-radius: 6px;
  background: rgba(251, 114, 153, 0.08);
  color: #b05473;
  cursor: pointer;
  transition:
    background 0.2s,
    color 0.2s,
    transform 0.15s;
  font-size: 12px;
}

.log-dialog-action:hover {
  background: rgba(251, 114, 153, 0.18);
  color: #fb7299;
  transform: scale(1.08);
}

.log-dialog-action:active {
  transform: scale(0.95);
}

.log-dialog-body-terminal {
  flex: 1;
  overflow: hidden;
  min-height: 260px;
  border-radius: 0 0 16px 16px;
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

/* ─── kernel progress bar (LOG_STREAM) ──────────────────────────────────── */

.kernel-progress-wrap {
  margin-top: 18px;
  display: flex;
  align-items: center;
  gap: 14px;
  width: 320px;
  max-width: 70vw;
}

.kernel-progress-bar {
  flex: 1;
  height: 6px;
  border-radius: 6px;
  background: rgba(251, 114, 153, 0.12);
  overflow: hidden;
}

.kernel-progress-fill {
  height: 100%;
  background: linear-gradient(90deg, #fb7299, #f95a8a);
  border-radius: 6px;
  transition: width 0.5s ease;
  box-shadow: 0 0 10px rgba(251, 114, 153, 0.4);
}

.kernel-progress-pct {
  font-family: 'Consolas', monospace;
  font-size: 13px;
  color: #c2516b;
  min-width: 40px;
  text-align: right;
}

/* ─── model download section (LOG_STREAM) ────────────────────────────────── */

.model-download-section {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0;
  animation: mdFadeIn 0.5s ease;
}

.md-icon-wrap {
  position: relative;
  width: 56px;
  height: 56px;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 14px;
}

.md-pulse-ring {
  position: absolute;
  inset: 0;
  border-radius: 50%;
  border: 2px solid rgba(251, 114, 153, 0.25);
  animation: mdPulse 2s ease-out infinite;
}

.md-icon-inner {
  position: relative;
  font-size: 22px;
  color: #fb7299;
  animation: mdIconFloat 2.5s ease-in-out infinite;
  filter: drop-shadow(0 0 8px rgba(251, 114, 153, 0.35));
}

.model-download-section .status-title {
  margin-bottom: 4px;
}

.md-status-hint {
  margin: 0 0 20px;
  font-size: 13px;
  color: rgba(180, 100, 120, 0.6);
  letter-spacing: 0.04em;
}

/* model cards */
.md-model-cards {
  display: flex;
  gap: 14px;
  margin-bottom: 20px;
}

.md-card {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 18px;
  border-radius: 14px;
  background: rgba(255, 255, 255, 0.65);
  border: 1px solid rgba(251, 114, 153, 0.12);
  min-width: 200px;
  transition:
    border-color 0.4s ease,
    background 0.4s ease,
    box-shadow 0.4s ease,
    transform 0.3s ease;
}

.md-card.pending {
  opacity: 0.5;
}

.md-card.active {
  border-color: rgba(251, 114, 153, 0.35);
  background: rgba(255, 255, 255, 0.85);
  box-shadow: 0 0 18px rgba(251, 114, 153, 0.12);
  transform: translateY(-1px);
}

.md-card.done {
  border-color: rgba(100, 200, 120, 0.3);
  background: rgba(240, 255, 245, 0.7);
}

.md-card-icon {
  flex-shrink: 0;
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  font-size: 13px;
  font-weight: 700;
  transition:
    background 0.4s ease,
    color 0.4s ease;
}

.md-card-icon.pending {
  background: rgba(251, 114, 153, 0.08);
  color: rgba(200, 120, 140, 0.4);
}

.md-card-icon.active {
  background: rgba(251, 114, 153, 0.15);
  color: #fb7299;
  animation: mdIconSpin 1.5s linear infinite;
}

.md-card-icon.done {
  background: rgba(100, 200, 120, 0.15);
  color: #4caf50;
}

.md-card-info {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.md-card-name {
  font-size: 13px;
  font-weight: 600;
  color: #6f2c48;
  letter-spacing: 0.03em;
}

.md-card.done .md-card-name {
  color: #3a7d44;
}

.md-card-desc {
  font-size: 11px;
  color: rgba(160, 100, 120, 0.45);
  letter-spacing: 0.03em;
}

.md-card.done .md-card-desc {
  color: rgba(60, 130, 70, 0.45);
}

/* model download progress bar */
.md-progress {
  margin-top: 4px;
}

/* ─── model download keyframes ───────────────────────────────────────────── */

@keyframes mdFadeIn {
  from {
    opacity: 0;
    transform: translateY(8px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@keyframes mdPulse {
  0% {
    transform: scale(0.85);
    opacity: 0.7;
  }
  100% {
    transform: scale(1.5);
    opacity: 0;
  }
}

@keyframes mdIconFloat {
  0%,
  100% {
    transform: translateY(0);
  }
  50% {
    transform: translateY(-4px);
  }
}

@keyframes mdIconSpin {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}

/* ─── PERSONALITY_ONLINE ───────────────────────────────────────────────── */

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

/* ─── hint block (still starting) ───────────────────────────────────────── */

.hint-block {
  margin-top: 22px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
}

.hint-text {
  color: #f59e0b;
  font-size: 14px;
  text-align: center;
  font-weight: 500;
}

.hint-sub {
  color: rgba(180, 100, 120, 0.6);
  font-size: 12px;
  text-align: center;
}

.hint-actions {
  display: flex;
  gap: 10px;
  margin-top: 4px;
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
