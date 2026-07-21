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

        <!-- LOG_STREAM - 意识唤醒协议 -->
        <div v-else-if="currentState === 'LOG_STREAM'" key="logstream" class="screen awaken-screen">
          <!-- 背景辉光层 -->
          <div
            class="awaken-glow"
            :class="{
              'glow-system': systemStatus === 'ready',
              'glow-data': dataStatus === 'ready',
              'glow-all': systemStatus === 'ready' && dataStatus === 'ready'
            }"
          ></div>

          <!-- 核心唤醒指示器 -->
          <div class="awaken-core">
            <div
              class="core-ring"
              :class="{
                'is-pulsing': systemStatus === 'checking' || dataStatus === 'checking',
                'is-steady': systemStatus === 'ready' && dataStatus === 'ready'
              }"
            >
              <div class="core-ring-inner"></div>
            </div>
            <div class="core-star">✦</div>
          </div>

          <!-- 标题区 -->
          <div class="awaken-header">
            <h2 class="awaken-title">意识唤醒协议</h2>
            <p class="awaken-sub">{{ awakenSubtitle }}</p>
          </div>

          <!-- 晶体装配面板 -->
          <div class="crystal-panel">
            <!-- 系统晶体 -->
            <div class="crystal-card" :class="`crystal--${systemStatus}`">
              <div class="crystal-card-bg"></div>
              <div class="crystal-card-glow"></div>
              <div class="crystal-card-content">
                <div class="crystal-card-icon">
                  <font-awesome-icon icon="fa-solid fa-cubes" />
                </div>
                <h3 class="crystal-card-title">装载助手系统</h3>
                <p class="crystal-card-status">{{ systemStatusText }}</p>
                <div v-if="systemStatus === 'importing'" class="crystal-progress-wrap">
                  <div class="crystal-progress-bar">
                    <div
                      class="crystal-progress-fill"
                      :style="{ width: `${kernelProgress}%` }"
                    ></div>
                  </div>
                  <span class="crystal-progress-pct">{{ kernelProgress }}%</span>
                </div>
                <button
                  v-if="systemStatus === 'missing'"
                  class="crystal-btn"
                  :disabled="isImportingAssets"
                  @click="handleImportAssets"
                >
                  <span class="crystal-btn-glow"></span>
                  <span>{{ isImportingAssets ? '装配中...' : '选择系统包' }}</span>
                </button>
                <div v-if="systemStatus === 'ready'" class="crystal-card-badge">
                  <span class="badge-icon">✦</span>
                  <span>已装载</span>
                </div>
              </div>
            </div>

            <!-- 连接线装饰 -->
            <div class="crystal-divider" :class="{ linked: systemStatus === 'ready' && dataStatus !== 'pending' }">
              <div class="divider-line"></div>
              <div class="divider-orb"></div>
              <div class="divider-line"></div>
            </div>

            <!-- 数据晶体 -->
            <div class="crystal-card" :class="`crystal--${dataStatus}`">
              <div class="crystal-card-bg"></div>
              <div class="crystal-card-glow"></div>
              <div class="crystal-card-content">
                <div class="crystal-card-icon">
                  <font-awesome-icon icon="fa-solid fa-database" />
                </div>
                <h3 class="crystal-card-title">装载助手数据</h3>
                <p class="crystal-card-status">{{ dataStatusText }}</p>
                <div v-if="dataStatus === 'importing'" class="crystal-progress-wrap">
                  <div class="crystal-progress-bar">
                    <div
                      class="crystal-progress-fill"
                      :style="{ width: `${kernelProgress}%` }"
                    ></div>
                  </div>
                  <span class="crystal-progress-pct">{{ kernelProgress }}%</span>
                </div>
                <button
                  v-if="dataStatus === 'missing'"
                  class="crystal-btn"
                  :disabled="isImportingDataAssets"
                  @click="handleImportDataAssets"
                >
                  <span class="crystal-btn-glow"></span>
                  <span>{{ isImportingDataAssets ? '装配中...' : '选择数据包' }}</span>
                </button>
                <div v-if="dataStatus === 'ready'" class="crystal-card-badge">
                  <span class="badge-icon">✦</span>
                  <span>已装载</span>
                </div>
              </div>
            </div>
          </div>

          <!-- 仍然启动中的提示 -->
          <div v-if="backendStillStarting" class="awaken-notice">
            <div class="notice-dots">
              <span></span><span></span><span></span>
            </div>
            <p>核心正在苏醒中... 已等待 {{ healthCheckElapsed }} 秒</p>
            <button class="notice-btn" @click="restartBackendService">重启服务</button>
          </div>

          <!-- 非资源缺失的一般错误 -->
          <div
            v-if="backendError && !isKernelMissing"
            class="awaken-notice is-error"
          >
            <p>{{ backendError }}</p>
          </div>

          <!-- 数据资源导入错误 -->
          <div
            v-if="dataError && isDataMissing"
            class="awaken-notice is-error"
          >
            <p>{{ dataError }}</p>
          </div>

          <!-- 底部工具栏 -->
          <div class="awaken-toolbar">
            <button class="tool-btn" @click="toggleLogDrawer">
              <font-awesome-icon icon="fa-solid fa-terminal" />
              <span>日志</span>
            </button>
            <button class="tool-btn" @click="switchMode">
              <font-awesome-icon icon="fa-solid fa-arrows-rotate" />
              <span>{{ currentMode === 'api' ? '本地模式' : 'API 模式' }}</span>
            </button>
            <button class="tool-btn" @click="retryBackend">
              <font-awesome-icon icon="fa-solid fa-rotate-right" />
              <span>重试</span>
            </button>
          </div>

          <!-- 日志抽屉 -->
          <div v-if="showLogDrawer" class="log-overlay" @click.self="toggleLogDrawer">
            <div class="log-panel">
              <div class="log-panel-header">
                <span>启动日志</span>
                <span class="log-panel-sub">{{ logSourceText }}</span>
                <div class="log-panel-actions">
                  <button class="log-panel-btn" title="打开日志目录" @click="openLogDir">
                    <font-awesome-icon icon="fa-solid fa-folder-open" />
                  </button>
                  <button class="log-panel-btn" @click="toggleLogDrawer">
                    <font-awesome-icon icon="fa-solid fa-xmark" />
                  </button>
                </div>
              </div>
              <div class="log-panel-body">
                <KernelLogTerminal :visible="showLogDrawer" />
              </div>
            </div>
          </div>

          <!-- API 地址输入弹窗 -->
          <div v-if="showApiInput" class="log-overlay" @click.self="cancelApiMode">
            <div class="api-input-panel">
              <h3 class="panel-title">连接远程核心</h3>
              <p class="panel-hint">请输入 API 服务地址</p>
              <label class="field field-full">
                <span>API 地址</span>
                <input
                  v-model="apiAddress"
                  type="text"
                  placeholder="例如：http://127.0.0.1:8001"
                  @keyup.enter="confirmApiMode"
                />
              </label>
              <p v-if="backendError" class="error-text">{{ backendError }}</p>
              <div class="actions" style="justify-content: space-between">
                <button class="btn-cold" @click="cancelApiMode">取消</button>
                <button class="btn-submit" @click="confirmApiMode">连接</button>
              </div>
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
import { request } from '@shared/api/request'

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
const isKernelMissing = ref(false)
const isImportingAssets = ref(false)
const isDataMissing = ref(false)
const dataError = ref('')
const isImportingDataAssets = ref(false)
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
let logDotTimer: ReturnType<typeof setInterval> | null = null
let kernelStateUnlisten: (() => void) | null = null
let serviceStateUnlisten: (() => void) | null = null
let assistantDownloadResolve: (() => void) | null = null

// ─── 晶体状态机 ─────────────────────────────────────────────────────────
type ModuleStatus = 'pending' | 'checking' | 'missing' | 'importing' | 'ready'
const systemStatus = ref<ModuleStatus>('pending')
const dataStatus = ref<ModuleStatus>('pending')

const systemStatusText = computed(() => {
  switch (systemStatus.value) {
    case 'pending': return '等待检测...'
    case 'checking': return '正在扫描系统组件...'
    case 'missing': return '需要装载系统核心'
    case 'importing': return '正在装配系统组件...'
    case 'ready': return '系统已就绪'
  }
})

const dataStatusText = computed(() => {
  switch (dataStatus.value) {
    case 'pending': return '等待检测...'
    case 'checking': return '正在验证数据完整性...'
    case 'missing': return '需要装载数据核心'
    case 'importing': return '正在装载数据...'
    case 'ready': return '数据已就绪'
  }
})

const awakenSubtitle = computed(() => {
  if (systemStatus.value === 'ready' && dataStatus.value === 'ready') {
    return '所有组件已就绪，正在启动核心...'
  }
  if (systemStatus.value === 'ready' && dataStatus.value !== 'pending') {
    return '系统核心已就绪，等待数据组件...'
  }
  if (systemStatus.value === 'ready') {
    return '系统核心已就绪，正在检测数据组件...'
  }
  return '澪的意识核心正在苏醒，请依序装载组件'
})

// ─── profile ────────────────────────────────────────────────────────────────

const profile = reactive<OnboardingProfile>({
  birthday: '',
  gender: '',
  occupation: ''
})

const apiAddress = ref('')
const showLogDrawer = ref(false)
const showApiInput = ref(false)

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
  isKernelMissing.value = false
  systemStatus.value = 'checking'

  logStatusTitle.value = '正在检查环境...'
  logStatusSub.value = '扫描运行环境与资源'

  // 1. 检查环境（含资源完整性）
  const envResult = await window.api.kernel.checkEnvironment()
  if (!envResult.success) {
    backendError.value = `环境检查失败: ${envResult.error || '未知错误'}`
    systemStatus.value = 'missing'
    return false
  }

  const env: EnvironmentCheckResult = envResult.data!
  const kernelInstalled = env.items.find((i) => i.key === 'kernel')?.passed ?? false
  const venvReady = env.items.find((i) => i.key === 'venv')?.passed ?? false

  if (!kernelInstalled) {
    // 2a. 内核未安装 → 引导用户导入后端资源包
    backendError.value = '未检测到后端文件，请导入后端资源包。'
    isKernelMissing.value = true
    systemStatus.value = 'missing'
    return false
  }

  if (!venvReady) {
    // 2b. 内核已安装但 venv 未就绪 → 运行 uv sync（自动使用本地 wheels）
    logStatusTitle.value = '正在安装 Python 依赖...'
    logStatusSub.value = '首次安装约需数分钟，请耐心等待'
    systemStatus.value = 'importing'

    const setupResult = await window.api.kernel.setupEnvironment()
    if (!setupResult.success) {
      backendError.value = `环境安装失败: ${setupResult.error || '未知错误'}`
      systemStatus.value = 'missing'
      return false
    }

    logStatusTitle.value = '依赖安装完成'
    logStatusSub.value = '环境已就绪'
    systemStatus.value = 'ready'
    await wait(800)
  } else {
    systemStatus.value = 'ready'
  }

  await wait(600)
  return true
}

/**
 * 检查数据资源完整性（模型文件 + 角色数据）
 * 返回 true 表示数据资源已就绪
 */
async function ensureDataReady(): Promise<boolean> {
  isDataMissing.value = false
  dataError.value = ''
  dataStatus.value = 'checking'

  logStatusTitle.value = '正在检查数据资源...'
  logStatusSub.value = '验证模型与角色数据完整性'

  const result = await window.api.kernel.checkDataResources()
  if (result.success && result.data?.ready) {
    logStatusTitle.value = '数据资源完整'
    logStatusSub.value = '模型与角色数据已就绪'
    dataStatus.value = 'ready'
    await wait(500)
    return true
  }

  dataError.value = '数据资源不完整，请导入数据资源包。'
  isDataMissing.value = true
  dataStatus.value = 'missing'
  logStatusTitle.value = '数据资源不完整'
  logStatusSub.value = '需要导入数据资源包'
  return false
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

async function handleImportAssets(): Promise<void> {
  isImportingAssets.value = true
  systemStatus.value = 'importing'
  try {
    const result = await window.api.kernel.importAssets()
    if (result.success) {
      backendError.value = ''
      isKernelMissing.value = false
      // 导入后端资源包后重新检查环境
      const kernelReady = await ensureKernelReady()
      if (!kernelReady) return

      // 检查数据资源
      const dataReady = await ensureDataReady()
      if (!dataReady) return

      const backendOk = await startBackendService()
      if (!backendOk) return

      currentMode.value = 'local'
      await window.api.onboarding.setMode('local')
      await loadAssistant()
      await advanceAfterAssistantLoaded()
    } else {
      // 用户取消或导入失败，回到缺失状态
      systemStatus.value = 'missing'
      if (result.error !== '用户取消了选择') {
        backendError.value = `后端资源包导入失败: ${result.error || '未知错误'}`
      }
    }
  } catch (e) {
    backendError.value = `后端资源包导入异常: ${(e as Error).message}`
    systemStatus.value = 'missing'
  } finally {
    isImportingAssets.value = false
  }
}

async function handleImportDataAssets(): Promise<void> {
  isImportingDataAssets.value = true
  dataStatus.value = 'importing'
  try {
    const result = await window.api.kernel.importDataAssets()
    if (result.success) {
      isDataMissing.value = false
      dataError.value = ''
      // 导入数据资源包后重新检查数据完整性
      const dataReady = await ensureDataReady()
      if (!dataReady) return

      // 继续启动后端
      const backendOk = await startBackendService()
      if (!backendOk) return

      currentMode.value = 'local'
      await window.api.onboarding.setMode('local')
      await loadAssistant()
      await advanceAfterAssistantLoaded()
    } else {
      // 用户取消或导入失败，回到缺失状态
      dataStatus.value = 'missing'
      if (result.error !== '用户取消了选择') {
        dataError.value = `数据资源包导入失败: ${result.error || '未知错误'}`
      }
    }
  } catch (e) {
    dataError.value = `数据资源包导入异常: ${(e as Error).message}`
    dataStatus.value = 'missing'
  } finally {
    isImportingDataAssets.value = false
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
    // 重试完整流程：检查内核环境 → 数据资源 → 启动后端服务
    backendError.value = ''
    isKernelMissing.value = false
    isDataMissing.value = false
    dataError.value = ''
    backendStillStarting.value = false
    systemStatus.value = 'pending'
    dataStatus.value = 'pending'
    currentState.value = 'LOG_STREAM'

    const kernelReady = await ensureKernelReady()
    if (!kernelReady) return

    const dataReady = await ensureDataReady()
    if (!dataReady) return

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
    // 显示 API 地址输入弹窗，让用户填写/确认地址后再连接
    currentMode.value = 'api'
    apiAddress.value = configStore.config.baseUrl || 'http://127.0.0.1:8001'
    backendError.value = ''
    showApiInput.value = true
  } else {
    currentMode.value = 'local'
    currentState.value = 'LOG_STREAM'
    backendError.value = ''
    isKernelMissing.value = false
    isDataMissing.value = false
    dataError.value = ''
    backendStillStarting.value = false
    systemStatus.value = 'pending'
    dataStatus.value = 'pending'
    await window.api.onboarding.setMode('local')

    const kernelReady = await ensureKernelReady()
    if (!kernelReady) return

    const dataReady = await ensureDataReady()
    if (!dataReady) return

    const ok = await startBackendService()
    if (ok) {
      await loadAssistant()
      await advanceAfterAssistantLoaded()
    }
  }
}

async function confirmApiMode(): Promise<void> {
  showApiInput.value = false
  currentState.value = 'LOG_STREAM'
  backendError.value = ''
  isKernelMissing.value = false
  backendStillStarting.value = false
  logStatusTitle.value = 'API 模式'
  logStatusSub.value = `等待连接 ${apiAddress.value}...`
  await wait(600)
  const ok = await connectApiMode()
  if (ok) {
    await loadAssistant()
    await advanceAfterAssistantLoaded()
  }
}

function cancelApiMode(): void {
  showApiInput.value = false
  currentMode.value = 'local'
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

  const result = await window.api.assistant.loadAssistantData()
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

    // 1. 保存配置
    try {
      await request.post('/api/update_config', {
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
    } catch (error) {
      const err = error as { response?: { data?: { detail?: string } } }
      modelConfigError.value = err.response?.data?.detail || '配置保存失败，请检查参数'
      return
    }

    // 2. 验证配置可用性：发送测试请求
    savingModelConfig.value = false
    verifyingModelConfig.value = true
    modelConfigError.value = ''

    try {
      await request.post(
        '/api/llm_chat',
        { msg: [{ role: 'user', content: 'hi' }] },
        { timeout: 30000 }
      )
    } catch {
      modelConfigError.value = '模型连接测试失败，请检查 API 地址、Key 和模型名称是否正确'
      return
    }

    // 3. 验证通过，进入下一步
    showModelPanel.value = false
    await wait(300)
    await startFirstMeeting()
  } catch (e) {
    const err = e as Error
    modelConfigError.value = `配置验证失败：${err.message}`
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

function onAssistantDownloadProgress(payload: unknown): void {
  const progressData = payload as { status: string; assistantName?: string; progress?: number }
  if (progressData.status === 'completed' || progressData.status === 'idle') {
    assistantProgress.value = 100
    if (assistantDownloadResolve) {
      assistantDownloadResolve()
      assistantDownloadResolve = null
    }
  } else if (progressData.progress !== undefined) {
    assistantProgress.value = Math.max(0, Math.min(100, progressData.progress))
  }
}

function onKernelStateUpdate(state: KernelUpdateState): void {
  kernelState.value = state
  kernelProgress.value = state.progress

  if (state.operationStatus !== 'idle' && state.operationStatus !== 'done') {
    logStatusTitle.value = state.statusText || logStatusTitle.value
    logStatusSub.value = state.progress > 0 ? `进度: ${state.progress}%` : '请稍候...'
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

  // 3. LOG_STREAM → ensure kernel ready (install/setup if needed)
  currentMode.value = 'local'
  await window.api.onboarding.setMode('local')

  const kernelReady = await ensureKernelReady()
  if (!kernelReady) return // stay in LOG_STREAM showing error

  // 4. LOG_STREAM → check data resources (models + agents)
  const dataReady = await ensureDataReady()
  if (!dataReady) return // stay in LOG_STREAM showing data error

  // 5. LOG_STREAM → start backend service & wait for health
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

/* ═══════════════════════════════════════════════════════════════════════════
   意识唤醒协议 - 晶体装配界面
   设计理念：将系统/数据装载抽象为"晶体唤醒"，融入苏醒仪式感
   主题色：#fb7299（粉樱）+ 白色
   ═══════════════════════════════════════════════════════════════════════════ */

/* ─── 屏幕容器 ───────────────────────────────────────────────────────── */

.awaken-screen {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0;
  overflow: hidden;
  background: radial-gradient(ellipse at 50% 30%, rgba(251, 114, 153, 0.06) 0%, transparent 60%),
    linear-gradient(180deg, #fff5f7 0%, #fff 50%, #fef0f5 100%);
}

/* ─── 背景辉光 ───────────────────────────────────────────────────────── */

.awaken-glow {
  position: absolute;
  inset: 0;
  pointer-events: none;
  background: radial-gradient(ellipse at 50% 30%, transparent 0%, transparent 100%);
  transition: background 1.2s cubic-bezier(0.22, 1, 0.36, 1);
}

.awaken-glow.glow-system {
  background: radial-gradient(ellipse at 40% 50%, rgba(251, 114, 153, 0.10) 0%, transparent 55%);
}

.awaken-glow.glow-data {
  background: radial-gradient(ellipse at 60% 50%, rgba(251, 114, 153, 0.10) 0%, transparent 55%);
}

.awaken-glow.glow-all {
  background: radial-gradient(ellipse at 50% 50%, rgba(251, 114, 153, 0.15) 0%, rgba(249, 90, 138, 0.08) 35%, transparent 60%);
}

/* ─── 核心唤醒指示器 ──────────────────────────────────────────────────── */

.awaken-core {
  position: relative;
  width: 72px;
  height: 72px;
  margin-bottom: 14px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.core-ring {
  position: absolute;
  inset: 0;
  border-radius: 50%;
  border: 2px solid rgba(251, 114, 153, 0.20);
  animation: coreRingIdle 3s ease-in-out infinite;
}

.core-ring.is-pulsing {
  border-color: rgba(251, 114, 153, 0.45);
  animation: coreRingPulse 1.2s ease-out infinite;
}

.core-ring.is-steady {
  border-color: rgba(251, 114, 153, 0.50);
  animation: coreRingSteady 2s ease-in-out infinite;
  box-shadow:
    0 0 20px rgba(251, 114, 153, 0.15),
    inset 0 0 20px rgba(251, 114, 153, 0.08);
}

.core-ring-inner {
  position: absolute;
  inset: 6px;
  border-radius: 50%;
  border: 1.5px solid rgba(251, 114, 153, 0.12);
}

.core-ring.is-pulsing .core-ring-inner {
  animation: coreRingPulse 1.2s ease-out infinite 0.3s;
}

.core-star {
  font-size: 22px;
  color: #fb7299;
  text-shadow: 0 0 16px rgba(251, 114, 153, 0.40);
  animation: starFloat 2.5s ease-in-out infinite;
}

/* ─── 标题区 ──────────────────────────────────────────────────────────── */

.awaken-header {
  text-align: center;
  margin-bottom: 28px;
}

.awaken-title {
  margin: 0;
  font-family: 'LoliFont', 'Microsoft YaHei', sans-serif;
  font-size: clamp(1.2rem, 2.2vw, 1.6rem);
  font-weight: 700;
  color: #7d2444;
  letter-spacing: 0.15em;
}

.awaken-sub {
  margin: 6px 0 0;
  font-size: 13px;
  color: rgba(160, 100, 120, 0.65);
  letter-spacing: 0.04em;
  animation: textFade 0.6s ease;
}

/* ─── 晶体装配面板 ────────────────────────────────────────────────────── */

.crystal-panel {
  display: flex;
  align-items: stretch;
  gap: 0;
  width: min(620px, 88vw);
}

/* ─── 单个晶体卡 ──────────────────────────────────────────────────────── */

.crystal-card {
  position: relative;
  flex: 1;
  min-width: 0;
  border-radius: 20px;
  padding: 22px 18px 20px;
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  transition:
    background 0.8s ease,
    border-color 0.8s ease,
    box-shadow 0.8s ease,
    transform 0.4s ease;
  overflow: hidden;
}

.crystal-card-bg {
  position: absolute;
  inset: 0;
  border-radius: 20px;
  background: rgba(255, 255, 255, 0.70);
  backdrop-filter: blur(10px);
  border: 1px solid rgba(251, 114, 153, 0.10);
  transition:
    background 0.8s ease,
    border-color 0.8s ease;
  z-index: 0;
}

.crystal-card-glow {
  position: absolute;
  inset: -2px;
  border-radius: 22px;
  opacity: 0;
  transition: opacity 0.8s ease;
  z-index: 0;
  pointer-events: none;
}

.crystal-card-content {
  position: relative;
  z-index: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  width: 100%;
}

/* ─── 晶体图标 ──────────────────────────────────────────────────────── */

.crystal-card-icon {
  width: 48px;
  height: 48px;
  border-radius: 16px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 20px;
  margin-bottom: 10px;
  background: rgba(251, 114, 153, 0.08);
  color: #fb7299;
  transition:
    background 0.6s ease,
    color 0.6s ease,
    box-shadow 0.6s ease;
}

/* ─── 晶体标题与状态 ────────────────────────────────────────────────── */

.crystal-card-title {
  margin: 0 0 4px;
  font-family: 'LoliFont', 'Microsoft YaHei', sans-serif;
  font-size: 15px;
  font-weight: 600;
  color: #6f2c48;
  letter-spacing: 0.06em;
}

.crystal-card-status {
  margin: 0;
  font-size: 12px;
  color: rgba(160, 100, 120, 0.55);
  letter-spacing: 0.03em;
  min-height: 1.2em;
  transition: color 0.4s ease;
}

/* ─── 各状态样式 ────────────────────────────────────────────────────── */

/* pending - 暗淡等待 */
.crystal-card.crystal--pending .crystal-card-bg {
  background: rgba(255, 255, 255, 0.45);
}

.crystal-card.crystal--pending .crystal-card-icon {
  background: rgba(180, 140, 150, 0.10);
  color: rgba(180, 140, 150, 0.40);
}

.crystal-card.crystal--pending .crystal-card-title {
  color: rgba(140, 100, 115, 0.50);
}

.crystal-card.crystal--pending .crystal-card-status {
  color: rgba(140, 100, 115, 0.30);
}

/* checking - 脉冲扫描 */
.crystal-card.crystal--checking .crystal-card-glow {
  opacity: 1;
  background: radial-gradient(ellipse at 50% 50%, rgba(251, 114, 153, 0.06) 0%, transparent 70%);
  animation: glowPulse 1.6s ease-in-out infinite;
}

.crystal-card.crystal--checking .crystal-card-icon {
  animation: iconScan 1.6s ease-in-out infinite;
}

/* missing - 需要导入 */
.crystal-card.crystal--missing .crystal-card-bg {
  background: rgba(255, 248, 245, 0.85);
  border-color: rgba(243, 168, 120, 0.25);
}

.crystal-card.crystal--missing .crystal-card-glow {
  opacity: 1;
  background: radial-gradient(ellipse at 50% 50%, rgba(243, 168, 120, 0.08) 0%, transparent 70%);
  animation: glowPulse 2s ease-in-out infinite;
}

.crystal-card.crystal--missing .crystal-card-icon {
  background: rgba(243, 168, 120, 0.12);
  color: #d4945a;
}

.crystal-card.crystal--missing .crystal-card-title {
  color: #7d5538;
}

.crystal-card.crystal--missing .crystal-card-status {
  color: rgba(200, 140, 80, 0.60);
}

/* importing - 正在装载 */
.crystal-card.crystal--importing .crystal-card-bg {
  background: rgba(255, 255, 255, 0.85);
  border-color: rgba(251, 114, 153, 0.25);
}

.crystal-card.crystal--importing .crystal-card-glow {
  opacity: 1;
  background: radial-gradient(ellipse at 50% 50%, rgba(251, 114, 153, 0.10) 0%, transparent 65%);
  animation: glowPulse 1s ease-in-out infinite;
}

.crystal-card.crystal--importing .crystal-card-icon {
  background: rgba(251, 114, 153, 0.15);
  color: #fb7299;
  box-shadow: 0 0 16px rgba(251, 114, 153, 0.15);
  animation: iconActive 1.2s ease-in-out infinite;
}

/* ready - 已就绪 */
.crystal-card.crystal--ready .crystal-card-bg {
  background: rgba(255, 255, 255, 0.90);
  border-color: rgba(251, 114, 153, 0.20);
}

.crystal-card.crystal--ready .crystal-card-glow {
  opacity: 1;
  background: radial-gradient(ellipse at 50% 50%, rgba(251, 114, 153, 0.12) 0%, rgba(249, 90, 138, 0.06) 40%, transparent 70%);
}

.crystal-card.crystal--ready .crystal-card-icon {
  background: rgba(251, 114, 153, 0.15);
  color: #fb7299;
  box-shadow: 0 0 20px rgba(251, 114, 153, 0.12);
}

.crystal-card.crystal--ready .crystal-card-title {
  color: #7d2444;
}

.crystal-card.crystal--ready .crystal-card-status {
  color: rgba(80, 170, 110, 0.65);
}

/* ─── 进度条 ────────────────────────────────────────────────────────── */

.crystal-progress-wrap {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  margin-top: 12px;
}

.crystal-progress-bar {
  flex: 1;
  height: 4px;
  border-radius: 4px;
  background: rgba(251, 114, 153, 0.10);
  overflow: hidden;
}

.crystal-progress-fill {
  height: 100%;
  border-radius: 4px;
  background: linear-gradient(90deg, #fb7299, #f95a8a);
  transition: width 0.4s ease;
  box-shadow: 0 0 8px rgba(251, 114, 153, 0.35);
}

.crystal-progress-pct {
  font-family: 'Consolas', monospace;
  font-size: 11px;
  color: #c2516b;
  min-width: 32px;
  text-align: right;
}

/* ─── 操作按钮 ──────────────────────────────────────────────────────── */

.crystal-btn {
  position: relative;
  margin-top: 14px;
  border: none;
  border-radius: 14px;
  padding: 9px 22px;
  font-size: 13px;
  font-weight: 600;
  font-family: inherit;
  color: #fff;
  background: linear-gradient(135deg, #fb7299, #f95a8a);
  cursor: pointer;
  letter-spacing: 0.06em;
  overflow: hidden;
  transition:
    transform 0.2s ease,
    box-shadow 0.2s ease,
    opacity 0.2s ease;
  box-shadow:
    0 4px 16px rgba(251, 114, 153, 0.25),
    0 0 0 1px rgba(255, 255, 255, 0.20) inset;
}

.crystal-btn:hover {
  transform: translateY(-2px);
  box-shadow:
    0 6px 24px rgba(251, 114, 153, 0.35),
    0 0 0 1px rgba(255, 255, 255, 0.25) inset;
}

.crystal-btn:active {
  transform: translateY(0);
}

.crystal-btn:disabled {
  opacity: 0.55;
  cursor: not-allowed;
  transform: none;
}

.crystal-btn-glow {
  position: absolute;
  inset: 0;
  background: linear-gradient(135deg, transparent 30%, rgba(255, 255, 255, 0.15) 50%, transparent 70%);
  animation: btnShimmer 2.5s ease-in-out infinite;
}

/* ─── 就绪徽章 ──────────────────────────────────────────────────────── */

.crystal-card-badge {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-top: 12px;
  font-size: 13px;
  color: rgba(80, 170, 110, 0.80);
  letter-spacing: 0.06em;
  animation: badgeAppear 0.5s cubic-bezier(0.22, 1, 0.36, 1);
}

.badge-icon {
  font-size: 14px;
  animation: badgeSparkle 1.5s ease-in-out infinite;
}

/* ─── 晶体分割器 ────────────────────────────────────────────────────── */

.crystal-divider {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  width: 32px;
  flex-shrink: 0;
  gap: 4px;
}

.divider-line {
  width: 1px;
  flex: 1;
  min-height: 20px;
  background: linear-gradient(180deg, rgba(251, 114, 153, 0.08), rgba(251, 114, 153, 0.15), rgba(251, 114, 153, 0.08));
  transition: background 0.8s ease;
}

.crystal-divider.linked .divider-line {
  background: linear-gradient(180deg, rgba(251, 114, 153, 0.25), rgba(251, 114, 153, 0.40), rgba(251, 114, 153, 0.25));
}

.divider-orb {
  width: 5px;
  height: 5px;
  border-radius: 50%;
  background: rgba(251, 114, 153, 0.15);
  transition:
    background 0.6s ease,
    box-shadow 0.6s ease;
}

.crystal-divider.linked .divider-orb {
  background: #fb7299;
  box-shadow: 0 0 10px rgba(251, 114, 153, 0.40);
  animation: orbPulse 1.5s ease-in-out infinite;
}

/* ─── 等待提示 ────────────────────────────────────────────────────────── */

.awaken-notice {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-top: 20px;
  padding: 8px 16px;
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.65);
  border: 1px solid rgba(251, 114, 153, 0.08);
  font-size: 12px;
  color: rgba(160, 100, 120, 0.65);
  animation: textFade 0.5s ease;
}

.awaken-notice.is-error {
  border-color: rgba(230, 100, 100, 0.20);
  background: rgba(255, 245, 245, 0.70);
  color: rgba(200, 80, 80, 0.75);
}

.notice-dots {
  display: flex;
  gap: 4px;
}

.notice-dots span {
  width: 4px;
  height: 4px;
  border-radius: 50%;
  background: #fb7299;
  animation: dotBounce 1.2s ease-in-out infinite;
}

.notice-dots span:nth-child(2) {
  animation-delay: 0.2s;
}

.notice-dots span:nth-child(3) {
  animation-delay: 0.4s;
}

.notice-btn {
  margin-left: auto;
  border: 1px solid rgba(251, 114, 153, 0.20);
  border-radius: 10px;
  padding: 4px 12px;
  background: rgba(255, 255, 255, 0.70);
  color: #b05473;
  font-size: 11px;
  cursor: pointer;
  font-family: inherit;
  transition:
    border-color 0.2s,
    background 0.2s;
}

.notice-btn:hover {
  border-color: rgba(251, 114, 153, 0.40);
  background: rgba(255, 255, 255, 0.85);
}

/* ─── 底部工具栏 ──────────────────────────────────────────────────────── */

.awaken-toolbar {
  position: absolute;
  bottom: 22px;
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  gap: 8px;
}

.tool-btn {
  display: flex;
  align-items: center;
  gap: 5px;
  border: 1px solid rgba(251, 114, 153, 0.12);
  border-radius: 12px;
  padding: 6px 14px;
  background: rgba(255, 255, 255, 0.55);
  color: rgba(180, 100, 120, 0.55);
  font-size: 11px;
  cursor: pointer;
  font-family: inherit;
  letter-spacing: 0.03em;
  backdrop-filter: blur(4px);
  transition:
    background 0.25s ease,
    border-color 0.25s ease,
    color 0.25s ease,
    transform 0.15s ease;
}

.tool-btn:hover {
  background: rgba(255, 255, 255, 0.80);
  border-color: rgba(251, 114, 153, 0.25);
  color: #b05473;
  transform: translateY(-1px);
}

.tool-btn:active {
  transform: translateY(0);
}

.tool-btn svg {
  font-size: 12px;
}

/* ─── 日志面板 ──────────────────────────────────────────────────────────── */

.log-overlay {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(255, 245, 247, 0.50);
  backdrop-filter: blur(3px);
  z-index: 20;
  animation: logFadeIn 0.3s ease;
}

.log-panel {
  width: min(660px, 90vw);
  max-height: min(55vh, 440px);
  background: rgba(255, 255, 255, 0.92);
  border: 1px solid rgba(251, 114, 153, 0.15);
  border-radius: 20px;
  box-shadow:
    0 16px 48px rgba(180, 60, 90, 0.12),
    0 0 0 1px rgba(255, 255, 255, 0.30) inset;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.log-panel-header {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px 18px;
  font-size: 12px;
  color: #b05473;
  background: rgba(255, 255, 255, 0.60);
  border-bottom: 1px solid rgba(251, 114, 153, 0.08);
  letter-spacing: 0.06em;
}

.log-panel-sub {
  color: rgba(176, 84, 115, 0.50);
  font-size: 11px;
  margin-right: auto;
}

.log-panel-actions {
  display: flex;
  gap: 4px;
}

.log-panel-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 26px;
  height: 26px;
  border: none;
  border-radius: 8px;
  background: rgba(251, 114, 153, 0.06);
  color: #b05473;
  cursor: pointer;
  font-size: 12px;
  transition:
    background 0.2s,
    color 0.2s,
    transform 0.15s;
}

.log-panel-btn:hover {
  background: rgba(251, 114, 153, 0.15);
  color: #fb7299;
  transform: scale(1.08);
}

.log-panel-body {
  flex: 1;
  overflow: hidden;
  min-height: 240px;
  border-radius: 0 0 16px 16px;
}

/* ─── 关键帧动画 ────────────────────────────────────────────────────── */

@keyframes coreRingIdle {
  0%, 100% {
    transform: scale(1);
    opacity: 0.4;
  }
  50% {
    transform: scale(1.04);
    opacity: 0.7;
  }
}

@keyframes coreRingPulse {
  0% {
    transform: scale(0.95);
    opacity: 0.3;
  }
  50% {
    transform: scale(1.06);
    opacity: 0.8;
  }
  100% {
    transform: scale(0.95);
    opacity: 0.3;
  }
}

@keyframes coreRingSteady {
  0%, 100% {
    transform: scale(1);
    opacity: 0.5;
  }
  50% {
    transform: scale(1.03);
    opacity: 0.8;
  }
}

@keyframes starFloat {
  0%, 100% {
    transform: translateY(0) rotate(0deg);
  }
  50% {
    transform: translateY(-4px) rotate(10deg);
  }
}

@keyframes glowPulse {
  0%, 100% {
    opacity: 0.5;
  }
  50% {
    opacity: 1;
  }
}

@keyframes iconScan {
  0%, 100% {
    transform: scale(1);
    opacity: 0.7;
  }
  50% {
    transform: scale(1.06);
    opacity: 1;
  }
}

@keyframes iconActive {
  0%, 100% {
    transform: translateY(0);
  }
  50% {
    transform: translateY(-3px);
  }
}

@keyframes btnShimmer {
  0% {
    transform: translateX(-100%);
  }
  100% {
    transform: translateX(100%);
  }
}

@keyframes badgeAppear {
  0% {
    opacity: 0;
    transform: scale(0.8);
  }
  100% {
    opacity: 1;
    transform: scale(1);
  }
}

@keyframes badgeSparkle {
  0%, 100% {
    opacity: 1;
    transform: scale(1) rotate(0deg);
  }
  50% {
    opacity: 0.7;
    transform: scale(1.2) rotate(20deg);
  }
}

@keyframes orbPulse {
  0%, 100% {
    transform: scale(1);
    opacity: 0.6;
  }
  50% {
    transform: scale(1.5);
    opacity: 1;
  }
}

@keyframes dotBounce {
  0%, 100% {
    transform: translateY(0);
    opacity: 0.3;
  }
  50% {
    transform: translateY(-6px);
    opacity: 1;
  }
}

@keyframes textFade {
  0% {
    opacity: 0;
    transform: translateY(4px);
  }
  100% {
    opacity: 1;
    transform: translateY(0);
  }
}

@keyframes logFadeIn {
  0% {
    opacity: 0;
  }
  100% {
    opacity: 1;
  }
}

/* ─── API 地址输入弹窗 ──────────────────────────────────────────────────── */

.api-input-panel {
  position: relative;
  width: 400px;
  max-width: 90vw;
  background: rgba(255, 255, 255, 0.95);
  border: 1px solid rgba(251, 114, 153, 0.2);
  border-radius: 24px;
  padding: 32px 30px;
  backdrop-filter: blur(14px);
  box-shadow:
    0 20px 56px rgba(180, 60, 90, 0.16),
    0 0 0 1px rgba(255, 255, 255, 0.4) inset;
}
</style>
