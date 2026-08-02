/**
 * @file kernel.ts
 * @description 应用内核相关的 IPC 接口定义
 */

import type { KernelUpdateState, EnvironmentCheckResult } from '@shared/types/kernel'

export interface KernelApi {
  getState: () => Promise<KernelUpdateState>
  onStateUpdate: (callback: (state: KernelUpdateState) => void) => () => void
  checkEnvironment: () => Promise<{
    success: boolean
    data?: EnvironmentCheckResult
    error?: string
  }>
  /** 自举初始化（装配内置内核资源 + uv sync 安装依赖） */
  bootstrapKernel: () => Promise<{ success: boolean; error?: string }>
  setupEnvironment: () => Promise<{ success: boolean; error?: string }>
  startBackend: () => Promise<{ success: boolean; error?: string }>
  stopBackend: () => Promise<{ success: boolean }>
  restartBackend: () => Promise<{ success: boolean; error?: string }>
  getBackendStatus: () => Promise<{ running: boolean; pid: number }>
  getBackendLogs: () => Promise<ArrayBuffer[]>
  getOperationLogs: () => Promise<ArrayBuffer[]>
  checkBackendHealth: () => Promise<{
    success: boolean
    healthy: boolean
    error?: string
    stillRunning?: boolean
  }>
  onServiceState: (
    callback: (state: { running: boolean; pid: number; logs: string[] }) => void
  ) => () => void
  onServiceStream: (callback: (data: ArrayBuffer) => void) => () => void
  openLogDir: () => Promise<{ success: boolean; error?: string }>
  checkApiHealth: () => Promise<{ success: boolean; healthy: boolean; error?: string }>
}
