/**
 * @file assistant.ts
 * @description 助手相关的 IPC 接口定义
 */

import type {
  AssistantInfo,
  AssistantAssets,
  AssistantBaseInfo
} from '@shared/types/assistantTypes'

export interface AssistantApi {
  getAssistantStatus: () => Promise<boolean>
  loadAssistantData: () => Promise<{ success: boolean; error?: string }>
  getAllAssistants: () => Promise<{ success: boolean; data?: AssistantInfo[]; error?: string }>
  getCurrentAssistant: () => Promise<
    { success: true; data: AssistantInfo } | { success: false; error: string }
  >
  switchAssistant: (
    name: string
  ) => Promise<{ success: true; data: AssistantInfo } | { success: false; error: string }>
  addAssistant: (
    assistant: AssistantInfo,
    options?: { assetTypes?: string[] }
  ) => Promise<{ success: boolean; error?: string }>
  updateAssistant: (
    assistant: AssistantInfo,
    options?: { uploadAssets?: boolean; assetTypes?: string[] }
  ) => Promise<{ success: boolean; error?: string }>
  deleteAssistant: (name: string) => Promise<{ success: boolean; error?: string }>

  registerChatShortcut: (shortcut: string) => Promise<boolean>
  saveAssistantImageFile: (
    fileData: ArrayBuffer,
    assistantName: string,
    fileName: string
  ) => Promise<{ success: true; path: string } | { success: false; error: string }>
  saveAssistantResourceFile: (payload: {
    fileData: Buffer | ArrayBuffer
    assistantName: string
    subDir: 'images' | 'audio' | 'live2d' | 'models' | 'other'
    fileName: string
    oldRelativePath?: string
  }) => Promise<{ success: true; path: string } | { success: false; error: string }>
  getAssistantAssets: (
    assistantName: string
  ) => Promise<{ success: true; data: AssistantAssets } | { success: false; error: string }>
  saveAssistantAssets: (assets: AssistantAssets) => Promise<{ success: boolean; error?: string }>
  saveAndExtractLive2DModel: (
    fileData: Buffer | ArrayBuffer,
    assistantName: string
  ) => Promise<
    { success: true; path: string; mainJsonPath: string } | { success: false; error: string }
  >
  importAssistantFromCard: (
    imageData: ArrayBuffer
  ) => Promise<{ success: true; data: AssistantBaseInfo } | { success: false; error: string }>
  importAssistantFromZip: (
    zipPath: string
  ) => Promise<{ success: true; data: AssistantInfo } | { success: false; error: string }>
  scanLive2dExpressions: () => Promise<
    Map<string, { parameters: { Id: string; Value: number; Blend: string }[] }>
  >
  onUploadProgress: (
    callback: (data: { assistantName: string; progress: number }) => void
  ) => () => void
  onDownloadProgress: (
    callback: (data: { status: string; assistantName?: string; progress?: number }) => void
  ) => () => void
  onAssistantDataUpdated: (
    callback: (data: {
      assistants: AssistantInfo[]
      currentAssistant: AssistantInfo | null
    }) => void
  ) => () => void

  openAssistant: () => void
  closeAssistant: () => void
  hideAssistant: () => void
  showAssistant: () => void
}
