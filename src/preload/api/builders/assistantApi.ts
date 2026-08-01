/**
 * 助手 API 构建函数
 *
 * 构建符合 AssistantApi 类型定义的 IPC 调用封装，
 * 可被 main / assistant / assistantSettings 等窗口复用。
 */

import { ipcRenderer } from 'electron'
import { ipc } from './ipc'
import { CHANNELS } from '@shared/ipc/channels'
import type { AssistantApi } from '@shared/ipc/api/base/assistant'
import type { AssistantInfo } from '@shared/types/assistantTypes'

/** 构建统一的助手 API 对象 */
export const assistantApi: AssistantApi = {
  getAssistantStatus: () => ipcRenderer.invoke(CHANNELS.ASSISTANT_GET_STATUS),
  openAssistant: () => ipcRenderer.send(CHANNELS.ASSISTANT_CREATE),
  closeAssistant: () => ipcRenderer.send(CHANNELS.ASSISTANT_CLOSE),
  hideAssistant: () => ipcRenderer.send(CHANNELS.ASSISTANT_HIDE),
  showAssistant: () => ipcRenderer.send(CHANNELS.ASSISTANT_SHOW),
  loadAssistantData: () => ipcRenderer.invoke(CHANNELS.ASSISTANT_LOAD_DATA),
  getAllAssistants: () => ipcRenderer.invoke(CHANNELS.ASSISTANT_GET_ALL),
  registerChatShortcut: (shortcut: string) =>
    ipcRenderer.invoke(CHANNELS.ASSISTANT_REGISTER_CHAT_SHORTCUT, shortcut),
  addAssistant: (assistant: unknown, options?: { assetTypes?: string[] }) =>
    ipcRenderer.invoke(CHANNELS.ASSISTANT_ADD, assistant, options),
  updateAssistant: (
    assistant: unknown,
    options?: { uploadAssets?: boolean; assetTypes?: string[] }
  ) => ipcRenderer.invoke(CHANNELS.ASSISTANT_UPDATE, assistant, options),
  deleteAssistant: (name: string) => ipcRenderer.invoke(CHANNELS.ASSISTANT_DELETE, name),
  saveAssistantImageFile: (fileData: ArrayBuffer, assistantName: string, fileName: string) =>
    ipcRenderer.invoke(CHANNELS.ASSISTANT_SAVE_RESOURCE_FILE, {
      fileData,
      assistantName,
      subDir: 'images',
      fileName
    }),
  saveAssistantResourceFile: (payload: Record<string, unknown>) =>
    ipcRenderer.invoke(CHANNELS.ASSISTANT_SAVE_RESOURCE_FILE, payload),
  getAssistantAssets: (assistantName: string) =>
    ipcRenderer.invoke(CHANNELS.ASSISTANT_GET_ASSETS, assistantName),
  saveAssistantAssets: (assets: unknown) =>
    ipcRenderer.invoke(CHANNELS.ASSISTANT_SAVE_ASSETS, assets),
  saveAndExtractLive2DModel: (fileData: Buffer | ArrayBuffer, assistantName: string) =>
    ipcRenderer.invoke(CHANNELS.ASSISTANT_SAVE_EXTRACT_LIVE2D, fileData, assistantName),
  downloadAssistantAsset: async (params: {
    assistantName: string
    assetTypes?: string[]
    onProgress?: (progress: number) => void
  }) => {
    const { assistantName, assetTypes, onProgress } = params
    const progressListener = (
      _event: Electron.IpcRendererEvent,
      data: { assistantName: string; progress: number }
    ): void => {
      if (data.assistantName === assistantName && onProgress) onProgress(data.progress)
    }
    ipcRenderer.on(CHANNELS.ASSISTANT_DOWNLOAD_PROGRESS_EVENT, progressListener)
    try {
      return await ipcRenderer.invoke(CHANNELS.ASSISTANT_DOWNLOAD_ASSET, {
        assistantName,
        assetTypes
      })
    } finally {
      ipcRenderer.removeListener(CHANNELS.ASSISTANT_DOWNLOAD_PROGRESS_EVENT, progressListener)
    }
  },
  getDownloadingAssets: () => ipcRenderer.invoke(CHANNELS.ASSISTANT_GET_DOWNLOADING),
  getCurrentAssistant: () => ipcRenderer.invoke(CHANNELS.ASSISTANT_GET_CURRENT),
  switchAssistant: (name: string) => ipcRenderer.invoke(CHANNELS.ASSISTANT_SWITCH, name),
  importAssistantFromCard: (imageData: ArrayBuffer) =>
    ipcRenderer.invoke(CHANNELS.ASSISTANT_IMPORT_FROM_CARD, imageData),
  importAssistantFromZip: (zipPath: string) =>
    ipcRenderer.invoke(CHANNELS.ASSISTANT_IMPORT_FROM_ZIP, zipPath),
  scanLive2dExpressions: () => ipcRenderer.invoke(CHANNELS.ASSISTANT_SCAN_LIVE2D_EXPRESSIONS),
  onUploadProgress: (callback: (data: { assistantName: string; progress: number }) => void) =>
    ipc.on(CHANNELS.ASSISTANT_UPLOAD_PROGRESS_EVENT, callback),
  onAssistantDataUpdated: (
    callback: (data: {
      assistants: AssistantInfo[]
      currentAssistant: AssistantInfo | null
    }) => void
  ) => ipc.on(CHANNELS.ASSISTANT_DATA_UPDATED_EVENT, callback)
}
