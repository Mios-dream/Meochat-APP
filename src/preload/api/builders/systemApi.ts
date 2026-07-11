/**
 * 系统 API 构建函数
 *
 * 构建符合 SystemApi 类型定义的 IPC 调用封装，
 * 整合了屏幕信息、前台应用、文件选择等系统功能。
 */

import { ipcRenderer } from 'electron'
import { CHANNELS } from '@shared/ipc/channels'
import type { SystemApi } from '@shared/ipc/api/base/system'

/** 构建统一的系统 API 对象 */
export const systemApi: SystemApi = {
  getScreenSize: () => ipcRenderer.invoke(CHANNELS.ASSISTANT_GET_SCREEN_SIZE),
  getForegroundAppUsage: () => ipcRenderer.invoke(CHANNELS.ASSISTANT_GET_FOREGROUND_APP_USAGE),

  selectFile: (options?: Record<string, unknown>) =>
    ipcRenderer.invoke(CHANNELS.TOOL_SELECT_FILE, options),
  selectFolder: (options?: Record<string, unknown>) =>
    ipcRenderer.invoke(CHANNELS.TOOL_SELECT_FOLDER, options),
  pathExists: (targetPath: string) => ipcRenderer.invoke(CHANNELS.TOOL_PATH_EXISTS, targetPath)
}
