import { BrowserWindow, powerMonitor, app } from 'electron'
import { CHANNELS } from '@shared/ipc/channels'
import { registerHandle } from '../utils/registerIpcHandler'
import { ForegroundAppMonitor, ForegroundAppUsagePayload } from '../services/foregroundAppMonitor'
import koffi from 'koffi'
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

// 查询电池状态，返回剩余电量百分比和是否正在充电
function queryBatteryStatus(): BatteryStatus | null {
  if (process.platform !== 'win32') {
    return null
  }

  try {
    const kernel32 = koffi.load('kernel32.dll')

    // SYSTEM_POWER_STATUS 结构体
    const SystemPowerStatus = koffi.struct('SystemPowerStatus', {
      ACLineStatus: 'uchar',
      BatteryFlag: 'uchar',
      BatteryLifePercent: 'uchar',
      Reserved1: 'uchar',
      BatteryLifeTime: 'uint',
      BatteryFullLifeTime: 'uint'
    })

    // BOOL GetSystemPowerStatus(LPSYSTEM_POWER_STATUS lpSystemPowerStatus)
    const getSystemPowerStatus = kernel32.func('GetSystemPowerStatus', 'int', [
      koffi.pointer(SystemPowerStatus)
    ])

    const status = { ACLineStatus: 0, BatteryFlag: 0, BatteryLifePercent: 0, Reserved1: 0, BatteryLifeTime: 0, BatteryFullLifeTime: 0 }
    const result = getSystemPowerStatus(status)

    kernel32.unload()

    if (!result || status.BatteryLifePercent > 100) {
      return null
    }

    return {
      percent: Math.round(status.BatteryLifePercent),
      // ACLineStatus: 1 = 在线（充电中），0 = 离线（电池供电）
      isCharging: status.ACLineStatus === 1
    }
  } catch {
    return null
  }
}

// 广播当前电池状态给所有渲染进程
function broadcastBatteryStatus(): void {
  const battery = queryBatteryStatus()
  if (!battery) {
    return
  }

  const threshold = 20
  broadcast(CHANNELS.ASSISTANT_EVENT_BATTERY_LEVEL, {
    percent: battery.percent,
    isCharging: battery.isCharging,
    isLow: !battery.isCharging && battery.percent <= threshold,
    threshold,
    timestamp: Date.now()
  })
}

async function queryForegroundAppUsage(): Promise<ForegroundAppUsagePayload | null> {
  return await appMonitor.queryCurrentUsage()
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
    broadcast(CHANNELS.ASSISTANT_EVENT_ON_AC, { timestamp: Date.now() })
    broadcastBatteryStatus()
  })

  powerMonitor.on('on-battery', () => {
    broadcast(CHANNELS.ASSISTANT_EVENT_ON_BATTERY, { timestamp: Date.now() })
    broadcastBatteryStatus()
  })

  registerHandle(CHANNELS.ASSISTANT_GET_FOREGROUND_APP_USAGE, async () => {
    return await queryForegroundAppUsage()
  })

  broadcastBatteryStatus()
  batteryPollingTimer = setInterval(() => {
    broadcastBatteryStatus()
  }, 60 * 1000)

  app.on('will-quit', cleanupEventResources)
}

export { setupSystemEventIPC }
