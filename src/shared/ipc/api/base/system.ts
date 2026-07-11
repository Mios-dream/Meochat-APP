/**
 * @file system.ts
 * @description 系统相关的 ipc 接口
 */

export interface SystemApi {
  getForegroundAppUsage: () => Promise<{
    processName: string
    windowTitle: string
    pid: number
    category: 'work' | 'social' | 'browser' | 'game' | 'media' | 'other'
    continuousMs: number
    sampledAt: number
  } | null>
  getScreenSize: () => Promise<{ width: number; height: number }>

  selectFile: (options?: {
    title?: string
    defaultPath?: string
    buttonLabel?: string
    filters?: Array<{ name: string; extensions: string[] }>
  }) => Promise<
    { success: true; filePath: string; filePaths: string[] } | { success: false; error: string }
  >
  selectFolder: (options?: {
    title?: string
    defaultPath?: string
    buttonLabel?: string
  }) => Promise<
    { success: true; folderPath: string; folderPaths: string[] } | { success: false; error: string }
  >
  pathExists: (
    targetPath: string
  ) => Promise<
    { success: true; exists: boolean; isFile: boolean } | { success: false; error: string }
  >
}
