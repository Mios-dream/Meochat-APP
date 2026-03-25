import { ipcMain, app, shell, Notification, dialog } from 'electron'
import { getMainWindow } from '../windows/mainWindow'
import { AssistantService } from '../services/assistantService'
import log from '../utils/logger'
import { AssistantAssets } from '../../renderer/src/types/AssistantInfo'
import { PythonServiceManager, PythonTask } from '../services/pythonService'
import { SystemMonitor } from '../utils/systemMonitor'
import { PerformanceMode, PerformanceManager } from '../services/performanceManager'

const pythonServiceManager = PythonServiceManager.getInstance()
const systemMonitor = SystemMonitor.getInstance()
const performanceModeManager = PerformanceManager.getInstance()
/**
 * 设置助手服务IPC
 */
function setupAssistantServerIPC(): void {
  const assistantService = AssistantService.getInstance()

  /**
   * 初始化助手服务
   */
  ipcMain.handle('assistant:init', async (event) => {
    return await assistantService.loadAssistants((assistantName, progress) => {
      event.sender.send('assistant:download-progress', {
        assistantName,
        progress
      })
    })
  })

  /**
   * 注册聊天框快捷键
   */
  ipcMain.handle('assistant:register-chat-shortcut', async (_event, shortcut: string) => {
    return assistantService.registerChatShortcut(shortcut)
  })

  /**
   * 添加助手
   */
  ipcMain.handle('assistant:add-assistant', async (event, assistantData) => {
    return await assistantService.addAssistant(assistantData, (progress) => {
      event.sender.send('assistant:upload-progress', {
        assistantName: assistantData.name,
        progress
      })
    })
  })

  /**
   * 更新助手信息
   */
  ipcMain.handle('assistant:update-assistant', async (_event, assistantData) => {
    return await assistantService.updateAssistant(assistantData)
  })

  /**
   * 删除助手
   */
  ipcMain.handle('assistant:delete-assistant', async (_, name) => {
    return await assistantService.deleteAssistant(name)
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
      return await assistantService.saveAssistantImage(fileData, assistantName, fileName)
    }
  )

  /**
   * 获取助手资产配置
   */
  ipcMain.handle('assistant:get-assets', async (_event, assistantName: string) => {
    // 先尝试从缓存获取
    const cachedAssets = assistantService.getAssistantAssets(assistantName)
    if (cachedAssets) {
      return { success: true, data: cachedAssets }
    }
    // 如果缓存不存在，从文件加载
    return await assistantService.loadAssistantAssets(assistantName)
  })

  /**
   * 保存助手资产配置
   */
  ipcMain.handle('assistant:save-assets', async (_event, assets: AssistantAssets) => {
    return await assistantService.saveAssistantAssets(assets)
  })

  /**
   * 上传并解压Live2D模型
   */
  ipcMain.handle(
    'assistant:save-extract-live2d',
    async (
      _event,
      fileData: Buffer | ArrayBuffer,
      assistantName: string
    ): Promise<{ success: boolean; path?: string; mainJsonPath?: string; error?: string }> => {
      return await assistantService.saveAndExtractLive2D(fileData, assistantName)
    }
  )

  /**
   * 下载助手资产文件
   */
  ipcMain.handle(
    'assistant:download-assistant-asset',
    async (event, { assistantName }: { assistantName: string }) => {
      return await assistantService.downloadAssistantAsset(assistantName, (progress) => {
        event.sender.send('assistant:download-progress', { assistantName, progress })
      })
    }
  )

  /**
   * 加载助手数据
   */
  ipcMain.handle('assistant:load-assistant-data', async () => {
    return assistantService.getAssistants()
  })

  /**
   * 检查助手是否需要更新
   */
  ipcMain.handle('assistant:need-update', async (_event, assistant) => {
    return await assistantService.isNeedsUpdate(assistant)
  })

  /**
   * 获取当前助手信息
   */
  ipcMain.handle('assistant:get-current-assistant', async () => {
    const assistant = assistantService.getCurrentAssistant()
    if (!assistant) {
      return { success: false, error: '当前没有选中助手' }
    } else {
      return { success: true, data: assistant }
    }
  })

  /**
   * 切换当前助手
   */
  ipcMain.handle('assistant:switch-assistant', async (_event, assistantName: string) => {
    return await assistantService.setCurrentAssistant(assistantName)
  })

  // 从角色卡片导入助手信息
  ipcMain.handle('assistant:import-from-card', async (_event, imageData: ArrayBuffer) => {
    try {
      const assistantService = AssistantService.getInstance()
      const extractedInfo = await assistantService.extractHiddenInfo(Buffer.from(imageData))
      return { success: true, data: extractedInfo }
    } catch (error) {
      return { success: false, error: (error as Error).message }
    }
  })
}

/**
 * 设置日志相关IPC处理
 */
function setupLoggerIPC(): void {
  // 处理从渲染进程和preload发来的日志消息
  ipcMain.on(
    'logger:log',
    (
      _event,
      {
        level,
        message,
        args
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

  // 选择文件
  ipcMain.handle('tool:select-file', async (_event, options) => {
    try {
      const result = await dialog.showOpenDialog({
        title: options?.title || '选择文件',
        defaultPath: options?.defaultPath,
        buttonLabel: options?.buttonLabel || '选择',
        filters: options?.filters || [{ name: '所有文件', extensions: ['*'] }],
        properties: ['openFile']
      })

      if (result.canceled) {
        return { success: false, error: '取消选择' }
      }

      if (!result.filePaths[0]) {
        return { success: false, error: '未选择任何文件' }
      }

      return {
        success: true,
        filePath: result.filePaths[0],
        filePaths: result.filePaths
      }
    } catch (error) {
      log.error('选择文件失败:', error)
      return { success: false, error: (error as Error).message }
    }
  })

  // 选择文件夹
  ipcMain.handle('tool:select-folder', async (_event, options) => {
    try {
      const result = await dialog.showOpenDialog({
        title: options?.title || '选择文件夹',
        defaultPath: options?.defaultPath,
        buttonLabel: options?.buttonLabel || '选择',
        properties: ['openDirectory']
      })

      if (result.canceled) {
        return { success: false, error: '取消选择' }
      }

      if (!result.filePaths[0]) {
        return { success: false, error: '未选择任何文件夹' }
      }

      return {
        success: true,
        folderPath: result.filePaths[0],
        folderPaths: result.filePaths
      }
    } catch (error) {
      log.error('选择文件夹失败:', error)
      return { success: false, error: (error as Error).message }
    }
  })
}

function setupPythonServiceIPC(): void {
  ipcMain.handle('pythonService:start', async (_event, serviceId: number) => {
    try {
      await pythonServiceManager.startService(serviceId)
      return { success: true }
    } catch (error) {
      return { success: false, error: (error as Error).message }
    }
  })
  ipcMain.handle('pythonService:stop', async (_event, serviceId: number) => {
    try {
      await pythonServiceManager.stopService(serviceId)
      PerformanceManager.getInstance().refreshTaskConfigs()
      return { success: true }
    } catch (error) {
      return { success: false, error: (error as Error).message }
    }
  })
  ipcMain.handle('pythonService:restart', async (_event, serviceId: number) => {
    try {
      await pythonServiceManager.restartService(serviceId)
      return { success: true }
    } catch (error) {
      return { success: false, error: (error as Error).message }
    }
  })
  ipcMain.handle('pythonService:create', async (_event, pythonTask: PythonTask) => {
    try {
      const serviceId = await pythonServiceManager.createService(pythonTask)
      PerformanceManager.getInstance().refreshTaskConfigs()
      return { success: true, data: serviceId }
    } catch (error) {
      return { success: false, error: (error as Error).message }
    }
  })

  // 添加删除任务的IPC处理程序
  ipcMain.handle('pythonService:remove', async (_event, serviceId: number) => {
    try {
      const success = pythonServiceManager.removeService(serviceId)
      return { success }
    } catch (error) {
      return { success: false, error: (error as Error).message }
    }
  })
  ipcMain.handle('pythonService:getStatus', async (_event, serviceId: number) => {
    try {
      return await pythonServiceManager.getServiceStatus(serviceId)
    } catch (error) {
      return { success: false, error: (error as Error).message }
    }
  })
  ipcMain.handle('pythonService:stopAll', async () => {
    try {
      await pythonServiceManager.stopAllServices()
      return { success: true }
    } catch (error) {
      return { success: false, error: (error as Error).message }
    }
  })
  ipcMain.handle('pythonService:getAll', async () => {
    try {
      return pythonServiceManager.getAllServicesInfo()
    } catch (error) {
      return { success: false, error: (error as Error).message }
    }
  })

  ipcMain.handle(
    'pythonService:updateAutoStart',
    async (_event, serviceId: number, autoStart: boolean) => {
      try {
        const success = pythonServiceManager.updateAutoStart(serviceId, autoStart)
        return { success }
      } catch (error) {
        return { success: false, error: (error as Error).message }
      }
    }
  )

  ipcMain.handle(
    'pythonService:update',
    async (_event, serviceId: number, serviceData: Partial<PythonTask>) => {
      try {
        const success = pythonServiceManager.updateService(serviceId, serviceData)
        return { success }
      } catch (error) {
        return { success: false, error: (error as Error).message }
      }
    }
  )
}

function setupSystemMonitorIPC(): void {
  /**
   * 获取系统资源状态
   */
  ipcMain.handle('system:get-resources', async () => {
    try {
      const resources = await systemMonitor.getSystemResources()
      return { success: true, data: resources }
    } catch (error) {
      log.error('获取系统资源失败:', error)
      return { success: false, error: (error as Error).message }
    }
  })

  /**
   * 设置性能模式
   */
  ipcMain.handle('system:set-performance-mode', async (_event, mode: PerformanceMode) => {
    try {
      log.info(`设置性能模式: ${mode}`)
      await performanceModeManager.setPerformanceMode(mode)
      return { success: true }
    } catch (error) {
      log.error('设置性能模式失败:', error)
      return { success: false, error: (error as Error).message }
    }
  })

  /**
   * 获取当前性能模式
   */
  ipcMain.handle('system:get-performance-mode', async () => {
    try {
      const mode = performanceModeManager.getPerformanceMode()
      return { success: true, data: mode }
    } catch (error) {
      log.error('获取性能模式失败:', error)
      return { success: false, error: (error as Error).message }
    }
  })
}

function setupMainIPC(): void {
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
  setupUtilityIPC()
  setupAssistantServerIPC()
  setupLoggerIPC()
  setupPythonServiceIPC()
  setupSystemMonitorIPC()
}

export { setupMainIPC }
export { setupAssistantServerIPC, setupLoggerIPC }
