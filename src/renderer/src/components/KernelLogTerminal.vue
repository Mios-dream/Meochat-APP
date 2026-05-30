<template>
  <div ref="terminalContainer" class="kernel-log-terminal"></div>
</template>

<script setup lang="ts">
import { onMounted, onUnmounted, ref, watch } from 'vue'
import { Terminal } from 'xterm'
import { FitAddon } from '@xterm/addon-fit'
import 'xterm/css/xterm.css'

const props = defineProps<{
  visible: boolean
}>()

const terminalContainer = ref<HTMLDivElement>()
let term: Terminal | null = null
let fitAddon: FitAddon | null = null
let unsubStream: (() => void) | null = null
let resizeObserver: ResizeObserver | null = null

onMounted(() => {
  if (!terminalContainer.value) return

  term = new Terminal({
    disableStdin: true,
    convertEol: true,
    cursorBlink: false,
    cursorStyle: 'bar',
    fontSize: 13,
    fontFamily: "'Cascadia Code', 'Fira Code', 'JetBrains Mono', Consolas, monospace",
    theme: {
      background: '#00000000',
      foreground: '#8c8c8c',
      cursor: '#b0b0b0',
      selectionBackground: '#b0b0b040',
      black: '#535363',
      red: '#c07070',
      green: '#70a870',
      yellow: '#b0a870',
      blue: '#7088b0',
      magenta: '#a870a0',
      cyan: '#70a0a0',
      white: '#b0b0b0',
      brightBlack: '#6a6a7a',
      brightRed: '#d08888',
      brightGreen: '#88c088',
      brightYellow: '#c8c088',
      brightBlue: '#8898c8',
      brightMagenta: '#c088c0',
      brightCyan: '#88c0c0',
      brightWhite: '#d0d0d0'
    }
  })

  fitAddon = new FitAddon()
  term.loadAddon(fitAddon)
  term.open(terminalContainer.value)

  // Auto-fit on container resize
  resizeObserver = new ResizeObserver(() => {
    if (fitAddon && term) {
      try {
        fitAddon.fit()
      } catch {
        // 容器不可见时 fit 可能失败，忽略
      }
    }
  })
  resizeObserver.observe(terminalContainer.value)

  // 初始适应
  setTimeout(() => fitAddon?.fit(), 100)

  // 如果初始状态就是可见的，立即订阅
  if (props.visible) {
    subscribeStream()
  }
})

// 只在面板可见时订阅数据流，避免不必要的 CPU 消耗
watch(
  () => props.visible,
  (val) => {
    if (val) {
      subscribeStream()
      // 面板显示后重新适应终端大小
      setTimeout(() => fitAddon?.fit(), 100)
    } else {
      unsubscribeStream()
    }
  }
)

function subscribeStream(): void {
  if (unsubStream) return

  unsubStream = window.api.kernel.onServiceStream((data: ArrayBuffer) => {
    if (!term) return

    term.write(new Uint8Array(data))
  })

  // 加载已有日志（作为历史记录写入终端）
  loadHistory()
}

function unsubscribeStream(): void {
  unsubStream?.()
  unsubStream = null
}

async function loadHistory(): Promise<void> {
  if (!term) {
    console.error('[KernelLogTerminal] terminal 未初始化')
    return
  }

  try {
    // 加载原始 Buffer 流日志（保留 ANSI 转义序列，用于终端回显）
    const rawStreamLogs = await window.api.kernel.getOperationLogs()

    if (Array.isArray(rawStreamLogs) && rawStreamLogs.length > 0) {
      for (const buffer of rawStreamLogs) {
        term.write(new Uint8Array(buffer))
      }
    }

    // 加载原始 Buffer 后端服务日志（保留 ANSI 转义序列）
    const rawBackendLogs = await window.api.kernel.getBackendLogs()

    if (Array.isArray(rawBackendLogs) && rawBackendLogs.length > 0) {
      for (const buffer of rawBackendLogs) {
        term.write(new Uint8Array(buffer))
      }
    }

    if (
      (!rawStreamLogs || rawStreamLogs.length === 0) &&
      (!rawBackendLogs || rawBackendLogs.length === 0)
    ) {
      term.write('暂无历史日志\r\n')
    }
  } catch (error) {
    console.error('[KernelLogTerminal] 加载历史日志失败:', error)
    term.write('加载历史日志失败\r\n')
  }
}

onUnmounted(() => {
  unsubscribeStream()
  resizeObserver?.disconnect()
  term?.dispose()
  term = null
  fitAddon = null
})
</script>

<style scoped>
.kernel-log-terminal {
  width: 100%;
  height: 100%;
  min-height: 200px;
  border-radius: 8px;
  overflow: hidden;
}

/* xterm.js 内部调整 */
:deep(.xterm) {
  height: 100%;
  padding: 8px;
}

:deep(.xterm-viewport) {
  scrollbar-width: thin;
  scrollbar-color: #fb729940 transparent;
}

:deep(.xterm-viewport::-webkit-scrollbar) {
  width: 6px;
}

:deep(.xterm-viewport::-webkit-scrollbar-track) {
  background: transparent;
}

:deep(.xterm-viewport::-webkit-scrollbar-thumb) {
  background: #fb729940;
  border-radius: 3px;
}
</style>
