import { BrowserWindow, powerMonitor, app } from 'electron'
import { CHANNELS } from '@shared/ipc/channels'
import { registerHandle } from '../utils/registerIpcHandler'
import { ForegroundAppMonitor, ForegroundAppUsagePayload } from '../services/foregroundAppMonitor'
import fs from 'fs'
import path from 'path'
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

// ─── Linux 电池状态查询（sysfs）─────────────────────────────────────────
//
// 通过 Linux 内核的 power supply 子系统（/sys/class/power_supply/）读取电池信息，
// 等效替代 Windows 平台的 kernel32 GetSystemPowerStatus 调用：
//   - capacity   : 当前剩余电量百分比（0~100 的整数）
//   - status     : 充放电状态字符串，Charging 表示充电中
// 遍历以 "BAT" 开头的电池设备，取第一个可用电池作为结果。

/** Linux sysfs 电池信息根目录（内核 power supply 子系统） */
const LINUX_POWER_SUPPLY_DIR = '/sys/class/power_supply'

/** 查询 Linux 电池状态，读取 sysfs 返回电量百分比与充电状态；读取失败返回 null */
function queryBatteryStatusLinux(): BatteryStatus | null {
  try {
    // 电源目录不存在（如台式机无电池）直接返回 null
    if (!fs.existsSync(LINUX_POWER_SUPPLY_DIR)) {
      return null
    }

    // 查找以 BAT 开头的电池设备（通常为 BAT0 / BAT1）
    const batteryDir = fs.readdirSync(LINUX_POWER_SUPPLY_DIR).find((name) => name.startsWith('BAT'))
    if (!batteryDir) {
      return null
    }

    const baseDir = path.join(LINUX_POWER_SUPPLY_DIR, batteryDir)
    const capacityPath = path.join(baseDir, 'capacity')
    const statusPath = path.join(baseDir, 'status')

    // 电量文件缺失视为不可读，返回 null
    if (!fs.existsSync(capacityPath)) {
      return null
    }

    const percent = parseInt(fs.readFileSync(capacityPath, 'utf8').trim(), 10)
    if (Number.isNaN(percent)) {
      return null
    }

    // 充电状态：status 文件值为 "Charging" 时判定为充电中
    let isCharging = false
    if (fs.existsSync(statusPath)) {
      isCharging = fs.readFileSync(statusPath, 'utf8').trim() === 'Charging'
    }

    return { percent: Math.min(100, Math.max(0, percent)), isCharging }
  } catch {
    // 任何读取异常均降级为 null，不影响主流程
    return null
  }
}

// 向所有渲染进程广播事件
function broadcast(channel: string, payload?: unknown): void {
  BrowserWindow.getAllWindows().forEach((win) => {
    win.webContents.send(channel, payload)
  })
}

// 查询电池状态，返回剩余电量百分比和是否正在充电
function queryBatteryStatus(): BatteryStatus | null {
  // Linux 通过读取 sysfs 电池信息（/sys/class/power_supply/BAT*）实现，
  // 与 Windows 的 kernel32 GetSystemPowerStatus 保持相同的数据契约。
  if (process.platform === 'linux') {
    return queryBatteryStatusLinux()
  }

  // macOS 无跨平台统一接口，暂不提供（保持与之前行为一致返回 null）
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

    const status = {
      ACLineStatus: 0,
      BatteryFlag: 0,
      BatteryLifePercent: 0,
      Reserved1: 0,
      BatteryLifeTime: 0,
      BatteryFullLifeTime: 0
    }
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
