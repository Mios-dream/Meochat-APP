import { ipcMain, app, shell, Notification } from 'electron'
import { getMainWindow } from '../windows/mainWindow'

import {
  downloadAssistantAssets,
  loadAssistantsData,
  addAssistant,
  updateAssistantInfo,
  deleteAssistant,
  isNeedsUpdate,
  getCurrentAssistant,
  switchAssistant,
  saveAssistantImage,
  loadAssistantAssets,
  saveAssistantAssets,
  uploadAndExtractLive2D,
  registerChatShortcut
} from '../services/assistantService'
import log from '../utils/logger'
import { AssistantAssets } from '../../renderer/src/types/AssistantInfo'

/**
 * 设置助手服务IPC
 */
function setupAssistantServerIPC(): void {
  /**
   * 注册聊天框快捷键
   */
  ipcMain.handle('assistant:register-chat-shortcut', async (_event, shortcut: string) => {
    return registerChatShortcut(shortcut)
  })

  /**
   * 添加助手
   */
  ipcMain.handle('assistant:add-assistant', async (event, assistantData) => {
    return await addAssistant(assistantData, (progress) => {
      event.sender.send('assistant:upload-progress', {
        assistantName: assistantData.name,
        progress
      })
    })
  })

  /**
   * 更新助手信息
   */
  ipcMain.handle('assistant:update-assistant-info', async (_event, assistantData) => {
    return await updateAssistantInfo(assistantData)
  })

  /**
   * 删除助手
   */
  ipcMain.handle('assistant:delete-assistant', async (_, name) => {
    return await deleteAssistant(name)
  })

  /**
   * 保存助手图片文件
   */
  ipcMain.handle(
    'assistant:save-image-file',
    async (
      _event,
      fileData: Buffer | ArrayBuffer,
      assistantName: string,
      fileName: string
    ): Promise<{ success: true; path: string } | { success: false; error: string }> => {
      return await saveAssistantImage(fileData, assistantName, fileName)
    }
  )

  /**
   * 获取助手资产配置
   */
  ipcMain.handle('assistant:get-assets', async (_event, assistantName: string) => {
    return await loadAssistantAssets(assistantName)
  })

  /**
   * 保存助手资产配置
   */
  ipcMain.handle('assistant:save-assets', async (_event, assets: AssistantAssets) => {
    return await saveAssistantAssets(assets)
  })

  /**
   * 上传并解压Live2D模型
   */
  ipcMain.handle(
    'assistant:upload-extract-live2d',
    async (
      _event,
      fileData: Buffer | ArrayBuffer,
      assistantName: string
    ): Promise<{ success: boolean; path?: string; mainJsonPath?: string; error?: string }> => {
      return await uploadAndExtractLive2D(fileData, assistantName)
    }
  )
  /**
   * 下载助手资产文件
   */
  ipcMain.handle(
    'assistant:download-assistant-asset',
    async (event, { assistantName }: { assistantName: string }) => {
      return await downloadAssistantAssets(assistantName, (progress) => {
        event.sender.send('assistant:download-progress', { assistantName, progress })
      })
    }
  )

  /**
   * 加载助手数据
   */
  ipcMain.handle('assistant:load-assistant-data', async (event) => {
    return await loadAssistantsData((assistantName, progress) => {
      event.sender.send('assistant:download-progress', {
        assistantName,
        progress
      })
    })
  })

  /**
   * 检查助手是否需要更新
   */
  ipcMain.handle('assistant:need-update', async (_event, assistant) => {
    return await isNeedsUpdate(assistant)
  })

  /**
   * 获取当前助手信息
   */
  ipcMain.handle('assistant:get-current-assistant', async () => {
    try {
      const assistant = await getCurrentAssistant()
      return { success: true, data: assistant }
    } catch (error) {
      log.error('获取当前助手信息失败:', error)
      return { success: false, error: (error as Error).message }
    }
  })

  /**
   * 切换当前助手
   */
  ipcMain.handle('assistant:switch-assistant', async (_event, assistantName: string) => {
    const result = await switchAssistant(assistantName)
    return result
  })
}

// 添加日志相关 IPC 处理
function setupLoggerIPC(): void {
  // 处理从渲染进程和preload发来的日志消息
  ipcMain.on(
    'logger:log',
    (
      _event,
      {
        level,
        message,
        args = []
      }: {
        level: string
        message: string
        args?
      }
    ) => {
      switch (level) {
        case 'debug':
          log.debug(message, ...(args || []))
          break
        case 'info':
          log.info(message, ...(args || []))
          break
        case 'warning':
        case 'warn':
          log.warn(message, ...(args || []))
          break
        case 'error':
          log.error(message, ...(args || []))
          break
        default:
          log.info(`[${level}]`, message, ...(args || []))
      }
    }
  )

  // 打开日志目录
  ipcMain.on('logger:open-log-dir', () => {
    try {
      shell.openPath(app.getPath('logs'))
    } catch (error) {
      log.error('打开日志目录失败:', error)
    }
  })
}

/**
 * 设置工具IPC
 */
function setupUtilityIPC(): void {
  ipcMain.on('tool:open-external', (_event, url) => {
    shell.openExternal(url)
  })

  ipcMain.on('tool:notify', (_event, data) => {
    if (Notification.isSupported()) {
      new Notification({
        title: data.title,
        body: data.body,
        subtitle: data.subtitle || 'MoeChat',
        icon: data.icon || null,
        silent: data.silent || false, // 是否静音
        sound: data.sound || null // 自定义音效
      }).show()
    } else {
      log.warn('Notification not supported')
    }
  })
}

function setupMainIPC(): void {
  setupUtilityIPC()
  setupAssistantServerIPC()
  setupLoggerIPC()

  ipcMain.on('app:show', () => {
    const win = getMainWindow()
    if (win) win.show()
  })

  ipcMain.on('app:hide', () => {
    const win = getMainWindow()
    if (win) win.hide()
  })

  ipcMain.on('app:minimize', () => {
    const win = getMainWindow()
    if (win) win.minimize()
  })

  ipcMain.on('app:maximize', () => {
    const win = getMainWindow()
    if (win) {
      if (win.isMaximized()) {
        win.setBounds({ width: 1200, height: 800 })
        win.unmaximize()
      } else {
        win.show()
        win.maximize()
      }
    }
  })

  ipcMain.on('app:quit', () => {
    app.quit()
  })
}

export { setupMainIPC }
