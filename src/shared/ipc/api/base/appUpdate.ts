/**
 * @file appUpdate.ts
 * @description 应用更新相关的 IPC 接口定义
 */

export interface AppUpdate {
  getCurrentVersion: () => Promise<string>
  checkForUpdate: () => Promise<{
    updateAvailable: boolean
    version?: string
    releaseNotes?: string
    error?: string
  }>
  confirmUpdate: () => Promise<void>
  onStatus: (callback: (msg: string) => void) => () => void
  onProgress: (callback: (percent: number) => void) => () => void
  checkCloudVersion: () => Promise<
    | {
        success: true
        currentVersion: string
        cloudVersion: string
        isVersionMatch: boolean
        fullVersionMatch: boolean
      }
    | { success: false; error: string; currentVersion: string }
  >
}
