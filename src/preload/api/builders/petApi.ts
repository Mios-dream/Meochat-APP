/**
 * 桌宠交互 API 构建函数
 *
 * 构建符合 PetInteractionApi 类型定义的 IPC 调用封装，
 * 供助手窗口与主窗口「助手空间」标签页复用。
 */

import { ipcRenderer } from 'electron'
import { ipc } from './ipc'
import { CHANNELS } from '@shared/ipc/channels'
import type { PetInteractionApi } from '@shared/ipc/api/base/pet'

/** 构建统一的桌宠交互 API 对象 */
export const petApi: PetInteractionApi = {
  onPowerAc: (callback) => ipc.on(CHANNELS.ASSISTANT_EVENT_ON_AC, callback),
  onPowerBattery: (callback) => ipc.on(CHANNELS.ASSISTANT_EVENT_ON_BATTERY, callback),
  onBatteryLevel: (callback) => ipc.on(CHANNELS.ASSISTANT_EVENT_BATTERY_LEVEL, callback),
  onMouseActivity: (callback) => ipc.on(CHANNELS.ASSISTANT_EVENT_MOUSE_ACTIVITY, callback),
  onMouseResumed: (callback) => ipc.on(CHANNELS.ASSISTANT_EVENT_MOUSE_RESUMED, callback),
  onMousePosition: (callback) => ipc.on(CHANNELS.ASSISTANT_MOUSE_POSITION_EVENT, callback),
  startMouseTracking: () => ipcRenderer.send(CHANNELS.ASSISTANT_START_MOUSE_TRACKING),
  stopMouseTracking: () => ipcRenderer.send(CHANNELS.ASSISTANT_STOP_MOUSE_TRACKING)
}
