import { KernelApi } from '@shared/ipc/api/base/kernel'
import { CHANNELS } from '@shared/ipc/channels'
import type { KernelUpdateState } from '@shared/types/kernel'
import { ipcRenderer } from 'electron'
import { ipc } from './ipc'

export const kernelApi: KernelApi = {
  getState: () => ipcRenderer.invoke(CHANNELS.KERNEL_GET_STATE),
  getCurrentVersion: () => ipcRenderer.invoke(CHANNELS.KERNEL_GET_CURRENT_VERSION),
  getActivePath: () => ipcRenderer.invoke(CHANNELS.KERNEL_GET_ACTIVE_PATH),
  getPythonConfig: () => ipcRenderer.invoke(CHANNELS.KERNEL_GET_PYTHON_CONFIG),
  checkUpdate: () => ipcRenderer.invoke(CHANNELS.KERNEL_CHECK_UPDATE),
  updateToLatest: () => ipcRenderer.invoke(CHANNELS.KERNEL_UPDATE_TO_LATEST),
  onStateUpdate: (callback: (state: KernelUpdateState) => void) =>
    ipc.on(CHANNELS.KERNEL_STATE_UPDATE_EVENT, callback),
  resetState: () => ipcRenderer.invoke(CHANNELS.KERNEL_RESET_STATE),
  checkEnvironment: () => ipcRenderer.invoke(CHANNELS.KERNEL_CHECK_ENVIRONMENT),
  setupEnvironment: () => ipcRenderer.invoke(CHANNELS.KERNEL_SETUP_ENVIRONMENT),
  downloadModels: () => ipcRenderer.invoke(CHANNELS.KERNEL_DOWNLOAD_MODELS),
  startBackend: () => ipcRenderer.invoke(CHANNELS.KERNEL_START_BACKEND),
  stopBackend: () => ipcRenderer.invoke(CHANNELS.KERNEL_STOP_BACKEND),
  restartBackend: () => ipcRenderer.invoke(CHANNELS.KERNEL_RESTART_BACKEND),
  getBackendStatus: () => ipcRenderer.invoke(CHANNELS.KERNEL_GET_BACKEND_STATUS),
  getBackendLogs: () => ipcRenderer.invoke(CHANNELS.KERNEL_GET_BACKEND_LOGS),
  getOperationLogs: () => ipcRenderer.invoke(CHANNELS.KERNEL_GET_OPERATION_LOGS),
  checkBackendHealth: () => ipcRenderer.invoke(CHANNELS.KERNEL_CHECK_BACKEND_HEALTH),
  onServiceState: (callback: (state: { running: boolean; pid: number; logs: string[] }) => void) =>
    ipc.on(CHANNELS.KERNEL_SERVICE_STATE_EVENT, callback),
  onServiceStream: (callback: (data: ArrayBuffer) => void) =>
    ipc.on(CHANNELS.KERNEL_SERVICE_STREAM_EVENT, callback),
  openLogDir: () => ipcRenderer.invoke(CHANNELS.KERNEL_OPEN_LOG_DIR),
  checkApiHealth: () => ipcRenderer.invoke(CHANNELS.KERNEL_CHECK_API_HEALTH)
}
