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

        <!-- MODE_SELECT - 选择运行模式 -->
        <div
          v-else-if="currentState === 'MODE_SELECT'"
          key="mode-select"
          class="screen center-screen mode-select-screen"
        >
          <div class="mode-select-glow"></div>
          <div class="mode-select-icon">✦</div>
          <div class="mode-select-title">选择运行模式</div>
          <p class="mode-select-sub">请选择核心的运行方式</p>
          <div class="mode-select-cards">
            <button class="mode-card" @click="chooseLocalMode">
              <span class="mode-card-icon">
                <font-awesome-icon icon="fa-solid fa-microchip" />
              </span>
              <span class="mode-card-title">本地模式</span>
              <span class="mode-card-desc">自动同步依赖与模型，并启动本地服务</span>
            </button>
            <button class="mode-card" @click="chooseApiMode">
              <span class="mode-card-icon is-api">
                <font-awesome-icon icon="fa-solid fa-cloud" />
              </span>
              <span class="mode-card-title">API 模式</span>
              <span class="mode-card-desc">连接远程核心服务，无需安装依赖</span>
            </button>
          </div>
        </div>

        <!-- LOG_STREAM - 意识唤醒协议 -->
        <div v-else-if="currentState === 'LOG_STREAM'" key="logstream" class="screen awaken-screen">
          <!-- 背景辉光层 -->
          <div class="awaken-glow" :class="{ 'glow-all': !backendError }"></div>

          <!-- 核心唤醒指示器 -->
          <div class="awaken-core">
            <div
              class="core-ring"
              :class="{
                'is-pulsing': !backendError && !backendRunning,
                'is-steady': backendRunning
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

          <!-- 本地模式启动阶段：资源装配、依赖同步、模型检查均可能耗时较长。 -->
          <div class="bootstrap-panel">
            <div class="bootstrap-status">{{ logStatusTitle }}</div>
            <div class="bootstrap-sub">{{ logStatusSub }}</div>
            <div class="bootstrap-progress-wrap">
              <div class="bootstrap-progress-bar">
                <div class="bootstrap-progress-fill" :style="{ width: `${kernelProgress}%` }"></div>
              </div>
              <span class="bootstrap-progress-pct">{{ kernelProgress }}%</span>
            </div>
            <ol class="startup-stages" aria-label="本地启动进度">
              <li
                v-for="stage in startupStages"
                :key="stage.id"
                :class="{ active: startupStage === stage.id, completed: isStageComplete(stage.id) }"
              >
                <span class="startup-stage-dot" aria-hidden="true"></span>
                <span>{{ stage.label }}</span>
              </li>
            </ol>
          </div>

          <!-- 启动异常（出错即停） -->
          <div v-if="backendError" class="awaken-notice is-error">
            <p>{{ backendError }}</p>
          </div>

          <!-- 仍然启动中的提示 -->
          <div v-if="backendStillStarting && !backendError" class="awaken-notice">
            <div class="notice-dots"><span></span><span></span><span></span></div>
            <p>核心正在苏醒中... 已等待 {{ healthCheckElapsed }} 秒</p>
            <button class="notice-btn" @click="restartBackendService">重启服务</button>
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
        </div>

        <!-- PERSONALITY_ONLINE -->
        <div
          v-else-if="currentState === 'PERSONALITY_ONLINE'"
          key="personality"
          class="screen center-screen"
        >
          <div class="status-title">PERSONALITY CORE</div>
          <div class="status-sub">{{ personalityStatus }}</div>
          <div class="personality-detail">{{ assistantStatusDetail }}</div>
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

      <!-- API 地址输入弹窗（全局覆盖层：模式选择页与 LOG_STREAM 工具栏均可弹出） -->
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
            <button class="btn-submit" :disabled="connectingApi" @click="confirmApiMode">
              {{ connectingApi ? '连接中...' : '连接' }}
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'

import { useConfigStore } from '../stores/useConfigStore'
import { OnboardingProfile } from '@shared/types/onboarding'
import type { KernelUpdateState } from '@shared/types/kernel'
import KernelLogTerminal from '../components/KernelLogTerminal.vue'
import ParticleCanvas from '../components/onboarding/ParticleCanvas.vue'
import { request } from '@shared/api/request'

// ─── type helpers ───────────────────────────────────────────────────────────

type OnboardingState =
  | 'BOOT'
  | 'SYSTEM_WAKE'
  | 'MODE_SELECT'
  | 'LOG_STREAM'
  | 'PERSONALITY_ONLINE'
  | 'SAKURA_TRANSITION'
  | 'MODEL_CONFIG'
  | 'FIRST_MEETING'
  | 'PROFILE_SYNC'
  | 'CONTRACT'
  | 'HOME'

type StartupStageId = 'environment' | 'dependencies' | 'models' | 'assistants'

// ─── services / singletons ──────────────────────────────────────────────────

const router = useRouter()
const configStore = useConfigStore()

// ─── state machine ──────────────────────────────────────────────────────────

const currentState = ref<OnboardingState>('BOOT')
const isDissolving = ref(false)

// 运行模式以配置 kernelMode 为准（local / api），此处仅作界面展示与流转判断
const currentMode = computed(() => configStore.config.kernelMode)

// ─── particle canvas control ────────────────────────────────────────────────

const particleRef = ref<InstanceType<typeof ParticleCanvas> | null>(null)

const particleMode = computed(() => {
  switch (currentState.value) {
    case 'BOOT':
      return 'hidden' as const
    case 'SYSTEM_WAKE':
    case 'MODE_SELECT':
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
    case 'MODE_SELECT':
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
const kernelProgress = ref(0)
const startupStage = ref<StartupStageId>('environment')
const startupStages: ReadonlyArray<{ id: StartupStageId; label: string }> = [
  { id: 'environment', label: '运行环境' },
  { id: 'dependencies', label: '同步依赖' },
  { id: 'models', label: '检查模型' },
  { id: 'assistants', label: '助手资源' }
]
let kernelStateUnlisten: (() => void) | null = null
let serviceStateUnlisten: (() => void) | null = null
let downloadProgressUnlisten: (() => void) | null = null
let assistantDownloadResolve: (() => void) | null = null

const awakenSubtitle = computed(() => {
  if (backendError.value) return '初始化遇到问题，已停止运行'
  if (backendStillStarting.value) return '模型检查或下载仍在进行，请保持网络连接'
  if (startupStage.value === 'models') return '后端已启动，正在检查模型完整性...'
  if (backendRunning.value) return '核心已就绪，正在同步助手资源...'
  return '正在装配运行环境、同步依赖并检查模型'
})

function isStageComplete(stage: StartupStageId): boolean {
  return startupStages.findIndex((item) => item.id === stage) <
    startupStages.findIndex((item) => item.id === startupStage.value)
}

function setStartupStage(
  stage: StartupStageId,
  title: string,
  detail: string,
  progress?: number
): void {
  startupStage.value = stage
  logStatusTitle.value = title
  logStatusSub.value = detail
  if (progress !== undefined) {
    kernelProgress.value = Math.max(0, Math.min(100, Math.round(progress)))
  }
}

// ─── profile ────────────────────────────────────────────────────────────────

const profile = reactive<OnboardingProfile>({
  birthday: '',
  gender: '',
  occupation: ''
})

const apiAddress = ref('')
const showLogDrawer = ref(false)
const showApiInput = ref(false)
const connectingApi = ref(false) // API 健康检查进行中（防止重复提交）

const logSourceText = computed(() => {
  if (currentMode.value === 'api') return 'API 模式'
  if (backendRunning.value) return `内核服务运行中 (PID: ${backendPid.value})`
  if (kernelState.value?.currentVersion) return `内核 v${kernelState.value.currentVersion}`
  return '内核未就绪'
})

// ─── LOG_STREAM helpers ─────────────────────────────────────────────────────

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

// ─── kernel: bootstrap & backend start ──────────────────────────────────────

/**
 * 自举初始化内核运行环境（解压运行时资产包 + uv sync 在线安装依赖）。
 * 模型完整性由后端启动时检查并自动下载，前端仅展示启动反馈。
 * 返回 true 表示环境就绪，失败即停止运行
 */
async function ensureKernelReady(): Promise<boolean> {
  currentState.value = 'LOG_STREAM'
  backendError.value = ''
  kernelProgress.value = 0

  setStartupStage('environment', '正在检查运行环境...', '正在装配助手数据与后端源码', 2)

  const result = await window.api.kernel.bootstrapKernel()
  if (!result.success) {
    backendError.value = result.error || '环境初始化失败，已停止运行。'
    setStartupStage('environment', '初始化失败', '已停止运行，请查看日志')
    return false
  }

  setStartupStage('models', '依赖同步完成', '即将启动后端并检查模型完整性', 65)
  return true
}

// ─── backend: start service & health check ──────────────────────────────────

async function startBackendService(): Promise<boolean> {
  currentState.value = 'LOG_STREAM'
  backendError.value = ''
  backendStillStarting.value = false
  healthCheckAbort.value = false
  healthCheckElapsed.value = 0
  setStartupStage('models', '正在启动核心服务...', '后端将检查模型完整性并自动下载缺失模型', 68)

  // 刷新后端日志（可能来自上一次运行）
  const status = await window.api.kernel.getBackendStatus()
  if (status.running) {
    setStartupStage('models', '核心服务已在运行', '正在检查模型服务连接状态...', 72)

    // 检查健康状态
    const healthResult = await window.api.kernel.checkBackendHealth()
    if (healthResult.healthy) {
      setStartupStage('assistants', '核心服务就绪', '模型完整性检查已完成', 85)
      await wait(500)
      return true
    }
  }

  // 启动后端
  const startResult = await window.api.kernel.startBackend()
  if (!startResult.success) {
    backendError.value = startResult.error || '启动服务失败。'
    return false
  }

  setStartupStage('models', '正在检查模型完整性...', '缺失模型会从镜像站自动下载，这可能需要较长时间', 72)

  // 启动等待计时器
  startHealthCheckElapsedTimer()

  // 持续轮询健康检查，直到通过或被取消
  while (!healthCheckAbort.value) {
    const healthResult = await window.api.kernel.checkBackendHealth()

    if (healthResult.healthy) {
      // 健康检查通过
      stopHealthCheckElapsedTimer()
      backendStillStarting.value = false
      setStartupStage('assistants', '核心服务就绪', '模型完整性检查已完成，正在准备助手资源', 85)
      await wait(500)
      return true
    }

    if (!healthResult.stillRunning) {
      // 进程已退出 - 真正的错误
      stopHealthCheckElapsedTimer()
      backendStillStarting.value = false
      backendError.value = healthResult.error || '后端服务启动失败。'
      return false
    }

    // 进程仍在运行但健康检查未通过 - 继续轮询
    // 超过阈值后显示"仍在启动中"提示
    if (healthCheckElapsed.value >= 30 && !backendStillStarting.value) {
      backendStillStarting.value = true
      setStartupStage(
        'models',
        '模型检查或下载仍在进行',
        '首次下载可能需要较长时间，请保持网络连接；可在日志中查看详细进度',
        78
      )
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
  setStartupStage('models', '正在重启后端服务...', '请稍候', 68)

  // 先停止后端服务
  await window.api.kernel.stopBackend()
  await wait(1000)

  // 重新启动
  const backendOk = await startBackendService()
  if (!backendOk) return

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
    // 重试完整流程：自举环境 → 启动后端服务
    backendError.value = ''
    backendStillStarting.value = false
    kernelProgress.value = 0
    currentState.value = 'LOG_STREAM'

    const kernelReady = await ensureKernelReady()
    if (!kernelReady) return

    const backendOk = await startBackendService()
    if (!backendOk) return

    await loadAssistant()
    await advanceAfterAssistantLoaded()
  }
}

async function switchMode(): Promise<void> {
  if (currentMode.value === 'local') {
    await switchToApiMode()
  } else {
    await switchToLocalMode()
  }
}

// ─── MODE_SELECT: 选择运行模式 ──────────────────────────────────────────────

/** 进入模式选择页（引导流程起始步骤） */
async function startModeSelect(): Promise<void> {
  currentState.value = 'MODE_SELECT'
}

/** 选择本地运行模式：持久化 kernelMode 配置并执行本地内核自举与后端启动 */
async function chooseLocalMode(): Promise<void> {
  await configStore.updateConfig('kernelMode', 'local')
  await proceedLocalMode()
}

/** 选择 API 运行模式：打开远程地址输入弹窗（健康检查通过后才提交 API 模式） */
async function chooseApiMode(): Promise<void> {
  apiAddress.value = configStore.config.baseUrl || 'http://127.0.0.1:8001'
  backendError.value = ''
  showApiInput.value = true
}

/** 本地模式主流程：自举内核环境 → 启动后端服务 → 加载助手 */
async function proceedLocalMode(): Promise<void> {
  currentState.value = 'LOG_STREAM'
  backendError.value = ''
  backendStillStarting.value = false
  kernelProgress.value = 0

  const kernelReady = await ensureKernelReady()
  if (!kernelReady) return

  const backendOk = await startBackendService()
  if (!backendOk) return

  await loadAssistant()
  if (assistantLoadError.value) return
  await advanceAfterAssistantLoaded()
}

/** 切换到 API 模式：打开远程地址输入弹窗（健康检查通过后才停止本地服务并提交模式） */
async function switchToApiMode(): Promise<void> {
  apiAddress.value = configStore.config.baseUrl || 'http://127.0.0.1:8001'
  backendError.value = ''
  showApiInput.value = true
}

/** 切换到本地模式：持久化 kernelMode 配置并执行本地内核自举与后端启动 */
async function switchToLocalMode(): Promise<void> {
  await configStore.updateConfig('kernelMode', 'local')
  await proceedLocalMode()
}

/**
 * 确认 API 模式：健康检查通过后才提交切换（持久化 kernelMode 并停止本地服务）
 * 检查未通过时保持弹窗打开，可在弹窗内修改地址重试，避免模式被频繁来回切换
 */
async function confirmApiMode(): Promise<void> {
  if (connectingApi.value) return
  connectingApi.value = true
  backendError.value = ''
  const ok = await connectApiMode()
  connectingApi.value = false
  if (!ok) return

  // 健康检查通过：停止本地后端服务（避免本地核心后台空转），提交 API 模式并继续引导流程
  try {
    await window.api.kernel.stopBackend()
  } catch {
    // 停止失败不阻塞切换流程
  }
  showApiInput.value = false
  await configStore.updateConfig('kernelMode', 'api')
  await loadAssistant()
  await advanceAfterAssistantLoaded()
}

/** 取消 API 连接：仅关闭弹窗，不改变运行模式与 kernelMode 配置 */
function cancelApiMode(): void {
  showApiInput.value = false
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
  startupStage.value = 'assistants'
  assistantLoadError.value = ''
  assistantProgress.value = 8

  const result = await window.api.assistant.loadAssistantData()
  if (!result.success) {
    assistantLoadError.value = `助手数据加载失败：${result.error || '未知错误'}`
    return
  }

  assistantProgress.value = Math.max(assistantProgress.value, 20)

  // 等待后台资源下载完成
  await new Promise<void>((resolve) => {
    assistantDownloadResolve = resolve
    // 设置超时，避免永久等待
    setTimeout(() => {
      if (assistantDownloadResolve) {
        assistantDownloadResolve()
        assistantDownloadResolve = null
      }
    }, 10 * 60 * 1000)
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
  if (assistantProgress.value > 20) return '正在同步助手资源...'
  return '开始同步助手数据...'
})

const assistantStatusDetail = computed(() => {
  if (assistantLoadError.value) return '请检查网络连接或在启动日志中查看详情'
  if (assistantProgress.value >= 100) return '助手资料与资源已就绪'
  if (assistantProgress.value > 20) return '正在检查图片、Live2D 和其他必要资源'
  return '正在读取本地资料并同步最新助手信息'
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
  } else if (progressData.status === 'checking') {
    assistantProgress.value = Math.max(assistantProgress.value, 25)
  } else if (progressData.progress !== undefined) {
    const mappedProgress = 30 + progressData.progress * 0.7
    assistantProgress.value = Math.max(assistantProgress.value, Math.min(99, mappedProgress))
  }
}

function onKernelStateUpdate(state: KernelUpdateState): void {
  kernelState.value = state
  if (state.operationStatus === 'installing') {
    setStartupStage(
      'environment',
      state.statusText || '正在装配运行资源...',
      '正在释放后端源码、助手资料和必要运行数据',
      2 + state.progress * 0.13
    )
  } else if (state.operationStatus === 'settingUpEnv') {
    setStartupStage(
      'dependencies',
      state.statusText || '正在同步运行依赖...',
      '正在检测 CUDA 环境并从镜像站同步所需依赖',
      15 + state.progress * 0.5
    )
  } else if (state.operationStatus === 'done') {
    setStartupStage('models', '依赖同步完成', '即将启动后端并检查模型完整性', 65)
  } else if (state.operationStatus === 'error') {
    backendError.value = state.error || state.statusText || '运行环境初始化失败'
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

  // 3. MODE_SELECT → 由用户选择运行模式（本地自举 / 远程 API）
  await startModeSelect()
}

// ─── bootstrap ──────────────────────────────────────────────────────────────

onMounted(async () => {
  // 监听助手数据加载进度
  downloadProgressUnlisten = window.api.assistant.onDownloadProgress(onAssistantDownloadProgress)

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
  if (downloadProgressUnlisten) downloadProgressUnlisten()
  if (kernelStateUnlisten) kernelStateUnlisten()
  if (serviceStateUnlisten) serviceStateUnlisten()
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

/* ─── MODE_SELECT ───────────────────────────────────────────────────────── */

.mode-select-screen {
  position: relative;
}

.mode-select-glow {
  position: absolute;
  width: 360px;
  height: 360px;
  border-radius: 50%;
  background: radial-gradient(circle, rgba(251, 114, 153, 0.1) 0%, transparent 70%);
  animation: glowPulse 3s ease-in-out infinite;
  pointer-events: none;
}

.mode-select-icon {
  font-size: 30px;
  color: #f48fb1;
  text-shadow: 0 0 20px rgba(251, 114, 153, 0.4);
  animation: contractIconFloat 2s ease-in-out infinite;
  margin-bottom: 6px;
}

.mode-select-title {
  font-family: 'LoliFont', 'Microsoft YaHei', sans-serif;
  font-size: clamp(1.4rem, 2.4vw, 1.8rem);
  color: #7d2444;
  letter-spacing: 0.12em;
}

.mode-select-sub {
  margin: 6px 0 28px;
  font-size: 14px;
  color: rgba(160, 100, 120, 0.65);
  letter-spacing: 0.04em;
}

.mode-select-cards {
  display: flex;
  gap: 18px;
}

.mode-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
  width: 200px;
  padding: 26px 20px;
  border: 1px solid rgba(251, 114, 153, 0.18);
  border-radius: 20px;
  background: rgba(255, 255, 255, 0.82);
  backdrop-filter: blur(10px);
  box-shadow: 0 12px 32px rgba(180, 60, 90, 0.1);
  cursor: pointer;
  font-family: inherit;
  transition:
    transform 0.25s ease,
    box-shadow 0.25s ease,
    border-color 0.25s ease,
    background 0.25s ease;
}

.mode-card:hover {
  transform: translateY(-4px);
  border-color: rgba(251, 114, 153, 0.4);
  background: rgba(255, 255, 255, 0.95);
  box-shadow: 0 18px 40px rgba(180, 60, 90, 0.18);
}

.mode-card:active {
  transform: translateY(-1px);
}

.mode-card-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 52px;
  height: 52px;
  border-radius: 16px;
  background: rgba(251, 114, 153, 0.1);
  color: #fb7299;
  font-size: 22px;
  transition: background 0.25s ease;
}

.mode-card:hover .mode-card-icon {
  background: rgba(251, 114, 153, 0.18);
}

.mode-card-icon.is-api {
  background: rgba(140, 160, 255, 0.12);
  color: #7a8df5;
}

.mode-card:hover .mode-card-icon.is-api {
  background: rgba(140, 160, 255, 0.2);
}

.mode-card-title {
  font-family: 'LoliFont', 'Microsoft YaHei', sans-serif;
  font-size: 16px;
  font-weight: 700;
  color: #6f2c48;
  letter-spacing: 0.06em;
}

.mode-card-desc {
  font-size: 12px;
  color: rgba(160, 100, 120, 0.6);
  text-align: center;
  line-height: 1.6;
  letter-spacing: 0.02em;
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

/* ─── PERSONALITY_ONLINE ───────────────────────────────────────────────── */

.personality-bar-wrap {
  margin-top: 16px;
  display: flex;
  align-items: center;
  gap: 14px;
  width: 320px;
  max-width: 70vw;
}

.personality-detail {
  min-height: 20px;
  max-width: min(420px, 82vw);
  color: rgba(160, 100, 120, 0.55);
  font-size: 12px;
  line-height: 1.5;
  text-align: center;
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
  background:
    radial-gradient(ellipse at 50% 30%, rgba(251, 114, 153, 0.06) 0%, transparent 60%),
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

.awaken-glow.glow-all {
  background: radial-gradient(
    ellipse at 50% 50%,
    rgba(251, 114, 153, 0.15) 0%,
    rgba(249, 90, 138, 0.08) 35%,
    transparent 60%
  );
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
  border: 2px solid rgba(251, 114, 153, 0.2);
  animation: coreRingIdle 3s ease-in-out infinite;
}

.core-ring.is-pulsing {
  border-color: rgba(251, 114, 153, 0.45);
  animation: coreRingPulse 1.2s ease-out infinite;
}

.core-ring.is-steady {
  border-color: rgba(251, 114, 153, 0.5);
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
  text-shadow: 0 0 16px rgba(251, 114, 153, 0.4);
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

/* ─── 装配进度面板（自举 + uv sync 单一进度） ─────────────────────────── */

.bootstrap-panel {
  display: flex;
  flex-direction: column;
  align-items: center;
  width: min(420px, 82vw);
  padding: 20px 24px;
  border-radius: 20px;
  background: rgba(255, 255, 255, 0.72);
  border: 1px solid rgba(251, 114, 153, 0.12);
  backdrop-filter: blur(10px);
  box-shadow: 0 12px 36px rgba(180, 60, 90, 0.08);
  animation: textFade 0.5s ease;
}

.bootstrap-status {
  font-family: 'LoliFont', 'Microsoft YaHei', sans-serif;
  font-size: 15px;
  font-weight: 600;
  color: #6f2c48;
  letter-spacing: 0.06em;
  text-align: center;
}

.bootstrap-sub {
  margin-top: 4px;
  font-size: 12px;
  color: rgba(160, 100, 120, 0.55);
  letter-spacing: 0.03em;
  text-align: center;
}

.bootstrap-progress-wrap {
  display: flex;
  align-items: center;
  gap: 12px;
  width: 100%;
  margin-top: 16px;
}

.bootstrap-progress-bar {
  flex: 1;
  height: 6px;
  border-radius: 6px;
  background: rgba(251, 114, 153, 0.12);
  overflow: hidden;
}

.bootstrap-progress-fill {
  height: 100%;
  border-radius: 6px;
  background: linear-gradient(90deg, #fb7299, #f95a8a);
  transition: width 0.5s ease;
  box-shadow: 0 0 10px rgba(251, 114, 153, 0.4);
}

.bootstrap-progress-pct {
  font-family: 'Consolas', monospace;
  font-size: 12px;
  color: #c2516b;
  min-width: 36px;
  text-align: right;
}

.startup-stages {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  width: 100%;
  margin: 20px 0 0;
  padding: 0;
  list-style: none;
}

.startup-stages li {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  color: rgba(160, 100, 120, 0.42);
  font-size: 11px;
  text-align: center;
  transition: color 0.25s ease;
}

.startup-stages li:not(:last-child)::after {
  content: '';
  position: absolute;
  top: 5px;
  left: calc(50% + 9px);
  width: calc(100% - 18px);
  height: 1px;
  background: rgba(251, 114, 153, 0.15);
  transition: background 0.25s ease;
}

.startup-stages li.completed,
.startup-stages li.active {
  color: #b05473;
}

.startup-stages li.completed::after {
  background: rgba(251, 114, 153, 0.52);
}

.startup-stage-dot {
  position: relative;
  z-index: 1;
  width: 10px;
  height: 10px;
  border: 2px solid rgba(251, 114, 153, 0.3);
  border-radius: 50%;
  background: #fff;
  transition:
    border-color 0.25s ease,
    background 0.25s ease,
    box-shadow 0.25s ease;
}

.startup-stages li.completed .startup-stage-dot {
  border-color: #fb7299;
  background: #fb7299;
}

.startup-stages li.active .startup-stage-dot {
  border-color: #fb7299;
  box-shadow: 0 0 0 4px rgba(251, 114, 153, 0.14);
  animation: startupStagePulse 1.5s ease-in-out infinite;
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
  border-color: rgba(230, 100, 100, 0.2);
  background: rgba(255, 245, 245, 0.7);
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
  border: 1px solid rgba(251, 114, 153, 0.2);
  border-radius: 10px;
  padding: 4px 12px;
  background: rgba(255, 255, 255, 0.7);
  color: #b05473;
  font-size: 11px;
  cursor: pointer;
  font-family: inherit;
  transition:
    border-color 0.2s,
    background 0.2s;
}

.notice-btn:hover {
  border-color: rgba(251, 114, 153, 0.4);
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
  background: rgba(255, 255, 255, 0.8);
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
  background: rgba(255, 245, 247, 0.5);
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
    0 0 0 1px rgba(255, 255, 255, 0.3) inset;
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
  background: rgba(255, 255, 255, 0.6);
  border-bottom: 1px solid rgba(251, 114, 153, 0.08);
  letter-spacing: 0.06em;
}

.log-panel-sub {
  color: rgba(176, 84, 115, 0.5);
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
  0%,
  100% {
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
  0%,
  100% {
    transform: scale(1);
    opacity: 0.5;
  }
  50% {
    transform: scale(1.03);
    opacity: 0.8;
  }
}

@keyframes starFloat {
  0%,
  100% {
    transform: translateY(0) rotate(0deg);
  }
  50% {
    transform: translateY(-4px) rotate(10deg);
  }
}

@keyframes dotBounce {
  0%,
  100% {
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

@keyframes startupStagePulse {
  0%,
  100% {
    box-shadow: 0 0 0 3px rgba(251, 114, 153, 0.12);
  }
  50% {
    box-shadow: 0 0 0 7px rgba(251, 114, 153, 0.04);
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
