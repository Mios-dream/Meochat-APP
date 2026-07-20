/**
 * @file kernel.ts
 * @description 应用内核相关的 IPC 接口定义
 */

import type {
  KernelUpdateState,
  EnvironmentCheckResult,
  DataResourceCheckResult
} from '@shared/types/kernel'

export interface KernelApi {
  getState: () => Promise<KernelUpdateState>
  checkUpdate: () => Promise<{ success: boolean; data?: KernelUpdateState; error?: string }>
  updateToLatest: () => Promise<{ success: boolean; error?: string }>
  onStateUpdate: (callback: (state: KernelUpdateState) => void) => () => void
  resetState: () => Promise<{ success: boolean }>
  checkEnvironment: () => Promise<{
    success: boolean
    data?: EnvironmentCheckResult
    error?: string
  }>
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
  importAssets: () => Promise<{ success: boolean; error?: string }>
  checkResources: () => Promise<{
    success: boolean
    data?: {
      kernelInstalled: boolean
      wheels: { ready: boolean; count: number }
      models: { ready: boolean; details: { name: string; exists: boolean }[] }
    }
    error?: string
  }>
  /** 检查数据资源完整性（models + agents） */
  checkDataResources: () => Promise<{
    success: boolean
    data?: DataResourceCheckResult
    error?: string
  }>
  /** 导入数据资源包 */
  importDataAssets: () => Promise<{ success: boolean; error?: string }>
}
