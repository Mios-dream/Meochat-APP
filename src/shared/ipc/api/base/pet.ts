/**
 * @file pet.ts
 * @description 桌宠交互相关的 IPC 接口定义
 *
 * 涵盖主进程推送的系统/鼠标事件、鼠标轨迹监控命令，
 * 供助手窗口（桌宠）与主窗口「助手空间」标签页复用。
 */

/** 电池电量事件载荷 */
export interface BatteryLevelData {
  /** 电量百分比 0-100 */
  percent: number
  /** 是否正在充电 */
  isCharging: boolean
  /** 是否低电量 */
  isLow: boolean
  /** 低电量阈值 */
  threshold: number
  /** 事件时间戳 */
  timestamp: number
}

/** 鼠标恢复事件载荷 */
export interface MouseResumeData {
  /** 空闲持续时间（毫秒） */
  idleDurationMs: number
  /** 事件时间戳 */
  timestamp: number
}

/** 鼠标活动事件载荷 */
export interface MouseActivityData {
  /** 空闲持续时间（毫秒） */
  idleDurationMs: number
  /** 是否处于空闲状态 */
  isIdle: boolean
  /** 事件时间戳 */
  timestamp: number
}

/** 鼠标位置事件载荷（主进程上报的全局鼠标坐标） */
export interface MousePositionData {
  /** 鼠标是否按下 */
  isMouseDown: boolean
  /** 屏幕坐标 X */
  screenX: number
  /** 屏幕坐标 Y */
  screenY: number
  /** 窗口坐标 X */
  windowX: number
  /** 窗口坐标 Y */
  windowY: number
  /** 窗口宽度 */
  windowWidth: number
  /** 窗口高度 */
  windowHeight: number
}

/** 桌宠交互 API 接口 */
export interface PetInteractionApi {
  /** 监听接通电源事件 */
  onPowerAc: (callback: (data: { timestamp: number }) => void) => () => void
  /** 监听电池供电事件 */
  onPowerBattery: (callback: (data: { timestamp: number }) => void) => () => void
  /** 监听电池电量事件 */
  onBatteryLevel: (callback: (data: BatteryLevelData) => void) => () => void
  /** 监听鼠标活动事件 */
  onMouseActivity: (callback: (data: MouseActivityData) => void) => () => void
  /** 监听鼠标恢复事件 */
  onMouseResumed: (callback: (data: MouseResumeData) => void) => () => void
  /** 监听鼠标位置事件 */
  onMousePosition: (callback: (data: MousePositionData) => void) => () => void
  /** 开始全局鼠标追踪 */
  startMouseTracking: () => void
  /** 停止全局鼠标追踪 */
  stopMouseTracking: () => void
}
