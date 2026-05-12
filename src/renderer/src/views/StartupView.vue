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

  <div class="startup-root" :class="{ dissolving: isDissolving }">
    <div class="foreground-layer">
      <Transition name="screen-fade" mode="out-in">
        <!-- INITIALIZING -->
        <div v-if="phase === 'INIT'" key="init" class="screen center-screen">
          <div class="boot-glitch-text">INITIALIZING</div>
          <div class="boot-sub">内核初始化中...</div>
        </div>

        <!-- STARTING -->
        <div v-else-if="phase === 'STARTING'" key="starting" class="screen center-screen">
          <div class="wake-pulse-ring"></div>
          <div class="status-title">正在启动内核服务</div>
          <div class="status-sub">{{ statusMessage }}</div>
          <div class="phase-indicator">
            <div
              class="phase-dot"
              :class="{ active: startupStep >= 1, done: startupStep > 1 }"
            ></div>
            <div class="phase-line" :class="{ active: startupStep >= 2 }"></div>
            <div
              class="phase-dot"
              :class="{ active: startupStep >= 2, done: startupStep > 2 }"
            ></div>
            <div class="phase-line" :class="{ active: startupStep >= 3 }"></div>
            <div class="phase-dot" :class="{ active: startupStep >= 3 }"></div>
          </div>
          <div class="phase-labels">
            <span :class="{ active: startupStep >= 1 }">环境检测</span>
            <span :class="{ active: startupStep >= 2 }">启动服务</span>
            <span :class="{ active: startupStep >= 3 }">健康检查</span>
          </div>

          <!-- error -->
          <div v-if="error" class="error-block">
            <p class="error-text">{{ error }}</p>
            <div class="error-actions">
              <button class="btn-startup btn-ghost" @click="retry">跳过启动</button>
              <button class="btn-startup" @click="retry">重试</button>
            </div>
          </div>
        </div>

        <!-- READY -->
        <div v-else-if="phase === 'READY'" key="ready" class="screen center-screen">
          <div class="contract-icon">✦</div>
          <div class="status-title">内核服务就绪</div>
          <div class="status-sub">正在进入 MoeChat...</div>
        </div>

        <!-- fallback -->
        <div v-else key="empty" class="screen"></div>
      </Transition>
    </div>

    <!-- 日志按钮 -->
    <div v-if="phase === 'STARTING'" class="log-toggle">
      <button class="btn-log" @click="showLogs = !showLogs">
        {{ showLogs ? '收起日志' : '查看日志' }}
      </button>
    </div>

    <!-- 日志弹窗 -->
    <div v-if="showLogs && phase === 'STARTING'" class="log-overlay" @click.self="showLogs = false">
      <div class="log-dialog">
        <div class="log-dialog-header">
          <span>内核日志</span>
          <span class="log-count">{{ logLines.length }} 条</span>
        </div>
        <div ref="logBodyRef" class="log-dialog-body">
          <div v-if="logLines.length === 0" class="log-empty">暂无日志</div>
          <div v-for="(line, index) in logLines" :key="index" class="log-line">{{ line }}</div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'

const router = useRouter()

type StartupPhase = 'INIT' | 'STARTING' | 'READY'

const phase = ref<StartupPhase>('INIT')
const startupStep = ref(0)
const statusMessage = ref('')
const error = ref('')
const isDissolving = ref(false)
const showLogs = ref(false)
const logLines = ref<string[]>([])
const logBodyRef = ref<HTMLElement | null>(null)

let unsubServiceState: (() => void) | null = null

// ─── titlebar ──────────────────────────────────────

const titlebarIcons = [
  { color: '#f3bc4f', text: '最小化', action: () => window.api.minimizeApp() },
  { color: '#64c857', text: '最大化', action: () => window.api.maximizeApp() },
  { color: '#e97168', text: '关闭', action: () => window.api.hideApp() }
]

// ─── helpers ────────────────────────────────────────

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/** 添加日志并限制最多保留 100 条 */
function addLogLine(msg: string): void {
  logLines.value.push(msg)
  if (logLines.value.length > 100) {
    logLines.value = logLines.value.slice(-100)
  }
}

function scrollLogsToBottom(): void {
  nextTick(() => {
    const el = logBodyRef.value
    if (el) el.scrollTop = el.scrollHeight
  })
}

watch(logLines, () => {
  if (showLogs.value) scrollLogsToBottom()
})

// ─── main flow ──────────────────────────────────────

async function runStartup(): Promise<void> {
  error.value = ''

  // Phase 1: INIT
  phase.value = 'INIT'
  await wait(1500)

  // Phase 2: STARTING
  phase.value = 'STARTING'

  // Step 1: 环境检测
  startupStep.value = 1
  statusMessage.value = '正在检测内核运行环境...'
  addLogLine('[系统] 开始检测内核运行环境...')

  try {
    const envResult = await window.api.kernel.checkEnvironment()
    if (envResult.success && envResult.data) {
      const { items } = envResult.data
      items.forEach((item) => {
        const icon = item.passed ? '✓' : '✗'
        addLogLine(`[环境] ${icon} ${item.name}: ${item.message.replace(/\n/g, ' ')}`)
      })

      if (!envResult.data.allPassed) {
        if (envResult.data.needsSetup) {
          statusMessage.value = '正在安装环境依赖...'
          addLogLine('[系统] 环境不完整，正在运行 uv sync...')

          const setupResult = await window.api.kernel.setupEnvironment()
          if (!setupResult.success) {
            error.value = `环境安装失败: ${setupResult.error || '未知错误'}`
            return
          }
          addLogLine('[系统] ✓ 环境安装完成')
        } else {
          const failed = items.filter((i) => !i.passed)
          const missingKernel = failed.some((i) => i.key === 'kernel')
          if (missingKernel) {
            error.value = '内核未安装，请先下载内核。将跳转到主页进行下载...'
            addLogLine(`[系统] ✗ ${error.value}`)
            await wait(3000)
            goToMain()
            return
          }
          // 其他环境问题不阻塞
          addLogLine(`[系统] 环境检测有 ${failed.length} 项未通过，继续启动...`)
        }
      } else {
        addLogLine('[系统] ✓ 环境检测全部通过')
      }
    } else {
      addLogLine(`[系统] 环境检测失败: ${envResult.error || '未知'}`)
    }
  } catch (e) {
    addLogLine(`[系统] 环境检测异常: ${(e as Error).message}`)
  }

  // Step 2: 启动服务
  startupStep.value = 2
  statusMessage.value = '正在启动内核后端服务...'
  addLogLine('[系统] 正在启动内核后端服务...')

  // 注册服务状态监听
  unsubServiceState = window.api.kernel.onServiceState((state) => {
    // 将新日志追加到本地
    const existingCount = logLines.value.length
    state.logs.forEach((line, i) => {
      if (existingCount + i >= logLines.value.length) {
        logLines.value.push(line)
      }
    })
    // 限制本地日志量
    if (logLines.value.length > 100) {
      logLines.value = logLines.value.slice(-100)
    }
  })

  try {
    const startResult = await window.api.kernel.startBackend()
    if (!startResult.success) {
      error.value = `后端服务启动失败: ${startResult.error || '未知错误'}`
      addLogLine(`[系统] ✗ ${error.value}`)
      return
    }
  } catch (e) {
    error.value = `启动异常: ${(e as Error).message}`
    addLogLine(`[系统] ✗ ${error.value}`)
    return
  }

  // Step 3: 健康检查
  startupStep.value = 3
  statusMessage.value = '等待后端服务就绪...'
  addLogLine('[系统] 正在等待后端服务就绪...')

  try {
    const healthResult = await window.api.kernel.checkBackendHealth()
    if (healthResult.healthy) {
      // 成功！
      // addLogLine('[系统] ✓ 后端服务健康检查通过')
      phase.value = 'READY'
      await wait(800)
      goToMain()
    } else if (healthResult.error) {
      // 进程异常退出 → 显示错误
      error.value = healthResult.error
      addLogLine(`[系统] ✗ ${healthResult.error}`)
    } else {
      // 健康检查超时但进程仍在运行 → 继续等待（不显示错误）
      addLogLine('[系统] 后端服务启动较慢，继续等待...')
      statusMessage.value = '后端服务仍在启动中，请耐心等待...'

      // 继续轮询，最多再尝试 10 次，间隔 3 秒
      let retryHealthy = false
      for (let i = 0; i < 10; i++) {
        await wait(3000)
        const retryResult = await window.api.kernel.checkBackendHealth()
        if (retryResult.healthy) {
          // addLogLine('[系统] ✓ 后端服务健康检查通过')
          retryHealthy = true
          break
        } else if (retryResult.error) {
          error.value = retryResult.error
          addLogLine(`[系统] ✗ ${retryResult.error}`)
          return
        }
        addLogLine(`[系统] 等待中... (${i + 1}/10)`)
      }

      if (retryHealthy) {
        phase.value = 'READY'
        await wait(800)
        goToMain()
      } else {
        // 重试耗尽但进程仍在运行 → 不阻塞，尝试进入主界面
        addLogLine('[系统] 后端服务启动时间较长，将进入主界面（服务可能仍在初始化）')
        phase.value = 'READY'
        await wait(800)
        goToMain()
      }
    }
  } catch (e) {
    error.value = `健康检查异常: ${(e as Error).message}`
    addLogLine(`[系统] ✗ ${error.value}`)
  }
}

function goToMain(): void {
  isDissolving.value = true
  setTimeout(() => {
    router.replace('/tabs')
  }, 600)
}

async function retry(): Promise<void> {
  error.value = ''
  phase.value = 'INIT'
  startupStep.value = 0
  await wait(500)
  runStartup()
}

// ─── lifecycle ──────────────────────────────────────

onMounted(() => {
  runStartup()
})

onUnmounted(() => {
  unsubServiceState?.()
})
</script>

<style scoped>
/* ─── root ─────────────────────────────────────────── */

.startup-root {
  position: relative;
  width: 100vw;
  height: 100vh;
  overflow: hidden;
  background: #fff5f7;
  transition: background 1s ease;
}

.startup-root.dissolving {
  animation: dissolveOut 0.8s ease forwards;
}

/* ─── titlebar ─────────────────────────────────────── */

.titlebar {
  position: fixed;
  z-index: 100;
  top: 0;
  height: 40px;
  user-select: none;
  width: 100%;
  -webkit-app-region: drag;
}

.titlebar-icons {
  display: flex;
  gap: 8px;
  position: absolute;
  right: 0;
  width: 100px;
  height: 30px;
  justify-content: space-between;
  align-items: center;
  margin-right: 15px;
  -webkit-app-region: no-drag;
  z-index: 99999;
}

.titlebar-item {
  border-radius: 100%;
  cursor: pointer;
  width: 13px;
  height: 13px;
  opacity: 0.85;
  transition: opacity 0.18s ease;
}

.titlebar-item:hover {
  opacity: 1;
}

/* ─── foreground ───────────────────────────────────── */

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

.center-screen {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
}

/* ─── INIT screen ──────────────────────────────────── */

.boot-screen {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  background: #fff5f7;
}

.boot-glitch-text {
  font-family: 'Consolas', 'Courier New', monospace;
  font-size: clamp(1.8rem, 3vw, 2.4rem);
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

/* ─── status text ──────────────────────────────────── */

.status-title {
  font-family: 'Consolas', 'Courier New', monospace;
  font-size: clamp(1rem, 1.8vw, 1.25rem);
  letter-spacing: 0.12em;
  color: #c2516b;
}

.status-sub {
  font-size: 14px;
  color: rgba(180, 100, 120, 0.7);
  letter-spacing: 0.05em;
}

/* ─── wake pulse ring ──────────────────────────────── */

.wake-pulse-ring {
  width: 80px;
  height: 80px;
  border-radius: 50%;
  border: 2px solid rgba(251, 114, 153, 0.35);
  animation: wakePulse 1.4s ease-out infinite;
  margin-bottom: 20px;
}

/* ─── phase indicator ──────────────────────────────── */

.phase-indicator {
  display: flex;
  align-items: center;
  gap: 0;
  margin-top: 16px;
}

.phase-dot {
  width: 12px;
  height: 12px;
  border-radius: 50%;
  background: rgba(251, 114, 153, 0.15);
  border: 2px solid rgba(251, 114, 153, 0.2);
  transition: all 0.4s ease;
}

.phase-dot.active {
  background: #fb7299;
  border-color: #fb7299;
  box-shadow: 0 0 12px rgba(251, 114, 153, 0.5);
  animation: dotPulse 1.5s ease-in-out infinite;
}

.phase-dot.done {
  background: #22c55e;
  border-color: #22c55e;
  box-shadow: 0 0 8px rgba(34, 197, 94, 0.4);
  animation: none;
}

.phase-line {
  width: 40px;
  height: 2px;
  background: rgba(251, 114, 153, 0.15);
  transition: background 0.5s ease;
}

.phase-line.active {
  background: #fb7299;
}

.phase-labels {
  display: flex;
  gap: 36px;
  margin-top: 6px;
  font-size: 11px;
  color: rgba(180, 100, 120, 0.4);
  letter-spacing: 0.04em;
}

.phase-labels span.active {
  color: #c2516b;
  font-weight: 600;
}

/* ─── ready icon ───────────────────────────────────── */

.contract-icon {
  font-size: 32px;
  color: #f48fb1;
  animation: iconFloat 2s ease-in-out infinite;
  margin-bottom: 8px;
}

/* ─── error block ──────────────────────────────────── */

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
  max-width: 420px;
}

.error-actions {
  display: flex;
  gap: 10px;
}

.btn-startup {
  border: 1px solid rgba(251, 114, 153, 0.35);
  border-radius: 10px;
  padding: 9px 28px;
  background: rgba(251, 114, 153, 0.08);
  color: #c2516b;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  letter-spacing: 0.04em;
  transition: all 0.22s ease;
}

.btn-startup:hover {
  background: rgba(251, 114, 153, 0.18);
  border-color: rgba(251, 114, 153, 0.55);
  transform: translateY(-1px);
}

.btn-ghost {
  background: transparent;
  border-color: rgba(251, 114, 153, 0.2);
  color: rgba(180, 100, 120, 0.7);
}

/* ─── log toggle ───────────────────────────────────── */

.log-toggle {
  position: fixed;
  bottom: 28px;
  right: 28px;
  z-index: 10;
}

.btn-log {
  border: 1px solid rgba(251, 114, 153, 0.25);
  border-radius: 12px;
  padding: 6px 16px;
  background: rgba(255, 255, 255, 0.85);
  color: #b05473;
  font-size: 12px;
  cursor: pointer;
  letter-spacing: 0.04em;
  transition: all 0.2s ease;
}

.btn-log:hover {
  border-color: rgba(251, 114, 153, 0.5);
  background: rgba(255, 255, 255, 0.95);
  transform: translateY(-1px);
}

/* ─── log overlay ──────────────────────────────────── */

.log-overlay {
  position: fixed;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(255, 245, 247, 0.55);
  backdrop-filter: blur(2px);
  z-index: 50;
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

.log-count {
  color: rgba(176, 84, 115, 0.6);
  font-size: 11px;
}

.log-dialog-body {
  padding: 12px 18px 16px;
  overflow: auto;
  font-family: 'Consolas', 'Courier New', monospace;
  font-size: 12px;
  color: #7b304a;
  user-select: text;
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

/* ─── transitions ──────────────────────────────────── */

.screen-fade-enter-active,
.screen-fade-leave-active {
  transition:
    opacity 0.4s ease,
    transform 0.4s ease;
}

.screen-fade-enter-from {
  opacity: 0;
  transform: translateY(10px);
}

.screen-fade-leave-to {
  opacity: 0;
  transform: translateY(-10px);
}

/* ─── keyframes ────────────────────────────────────── */

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

@keyframes dotPulse {
  0%,
  100% {
    box-shadow: 0 0 8px rgba(251, 114, 153, 0.3);
  }
  50% {
    box-shadow: 0 0 16px rgba(251, 114, 153, 0.7);
  }
}

@keyframes iconFloat {
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
