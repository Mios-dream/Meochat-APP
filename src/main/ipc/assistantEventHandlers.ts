import { BrowserWindow, powerMonitor, app } from 'electron'
import { execFile } from 'child_process'
import { promisify } from 'util'
import { getConfig } from '../config/configManager'
import { ForegroundAppMonitor } from '../services/foregroundAppMonitor'

const execFileAsync = promisify(execFile)
// 是否已经完成事件监听的设置，确保只设置一次
let setupCompleted = false
// 电池状态轮询定时器
let batteryPollingTimer: NodeJS.Timeout | null = null
// 前台应用监控实例
const appMonitor = ForegroundAppMonitor.getInstance()

interface BatteryStatus {
  percent: number
  isCharging: boolean
}

// 向所有渲染进程广播事件
function broadcast(channel: string, payload?: unknown): void {
  BrowserWindow.getAllWindows().forEach((win) => {
    win.webContents.send(channel, payload)
  })
}

// 根据BatteryStatus的状态码判断是否正在充电
function isChargingStatus(status: number): boolean {
  // 2 = Charging, 6 = Charging and High, 7 = Charging and Low, 8 = Charging and Critical, 9 = Undefined
  return [2, 6, 7, 8, 9].includes(status)
}

// 查询电池状态，返回剩余电量百分比和是否正在充电
async function queryBatteryStatus(): Promise<BatteryStatus | null> {
  if (process.platform !== 'win32') {
    return null
  }

  const psScript =
    'Get-CimInstance Win32_Battery | Select-Object -First 1 EstimatedChargeRemaining,BatteryStatus | ConvertTo-Json -Compress'

  try {
    const { stdout } = await execFileAsync(
      'powershell',
      ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', psScript],
      {
        windowsHide: true,
        timeout: 3000,
        maxBuffer: 128 * 1024,
        encoding: 'utf8'
      }
    )

    const raw = stdout.trim()
    if (!raw) {
      return null
    }

    const parsed = JSON.parse(raw) as {
      EstimatedChargeRemaining?: number
      BatteryStatus?: number
    }

    const percent = Number(parsed.EstimatedChargeRemaining)
    const status = Number(parsed.BatteryStatus)

    if (!Number.isFinite(percent) || !Number.isFinite(status)) {
      return null
    }

    return {
      percent: Math.max(0, Math.min(100, Math.round(percent))),
      isCharging: isChargingStatus(status)
    }
  } catch {
    return null
  }
}

// 广播当前电池状态给所有渲染进程
async function broadcastBatteryStatus(): Promise<void> {
  const battery = await queryBatteryStatus()
  if (!battery) {
    return
  }

  const threshold = Number(getConfig('lowBatteryThreshold') || 20)
  broadcast('assistantEvent:battery-level', {
    percent: battery.percent,
    isCharging: battery.isCharging,
    isLow: !battery.isCharging && battery.percent <= threshold,
    threshold,
    timestamp: Date.now()
  })
}
// 清理事件监听和定时器资源，确保在应用退出时不会留下未清理的资源
function cleanupEventResources(): void {
  if (batteryPollingTimer) {
    clearInterval(batteryPollingTimer)
    batteryPollingTimer = null
  }
  appMonitor.stop()
}

// 监听电脑事件
function setupSystemEventIPC(): void {
  if (setupCompleted) {
    return
  }

  setupCompleted = true

  // 监听电源状态变化
  powerMonitor.on('on-ac', () => {
    broadcast('assistantEvent:on-ac', { timestamp: Date.now() })
    broadcastBatteryStatus()
  })

  powerMonitor.on('on-battery', () => {
    broadcast('assistantEvent:on-battery', { timestamp: Date.now() })
    broadcastBatteryStatus()
  })

  appMonitor.start()

  broadcastBatteryStatus()
  batteryPollingTimer = setInterval(() => {
    broadcastBatteryStatus()
  }, 60 * 1000)

  app.on('will-quit', cleanupEventResources)
}

export { setupSystemEventIPC }
