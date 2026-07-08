/**
 * 桌宠助手悬浮设置窗口 —— IPC 处理器
 *
 * 处理设置窗口的创建、关闭，以及响应来自 dispatch 中心的消息。
 * 使用统一调度中心架构，避免为每个功能创建独立的 IPC 通道。
 */
import { ipcMain, screen } from 'electron'
import { windowRegistry, createWindow, assistantSettingsWindowConfig } from '../windows'
import log from '../utils/logger'

/**
 * 设置助手悬浮设置窗口相关 IPC 通道
 */
function setupAssistantSettingsIPC(): void {
  // —— 打开设置窗口 ——
  ipcMain.on('assistantSettings:open', () => {
    const primaryDisplay = screen.getPrimaryDisplay()
    const { width: screenWidth } = primaryDisplay.workArea

    // 默认显示在屏幕右侧中部
    const windowWidth = 340
    const windowHeight = 520
    const x = screenWidth - windowWidth - 20
    const y = 100

    createWindow(assistantSettingsWindowConfig, {
      overrides: { x, y, width: windowWidth, height: windowHeight },
      showImmediately: true
    })
  })

  // —— 关闭设置窗口 ——
  ipcMain.on('assistantSettings:close', () => {
    const settingsWin = windowRegistry.getWindowByType('assistantSettings')
    if (settingsWin && !settingsWin.isDestroyed()) {
      settingsWin.close()
    }
  })

  // —— 调整助手窗口尺寸（桌宠大小） ——
  // 助手窗口默认 300x500，resizable 为 false，需主进程执行 setSize
  // 为减轻透明窗口渲染压力，限制尺寸范围：宽 200-450，高 350-750
  ipcMain.on('assistant:resize', (_event, size: { width?: number; height?: number }) => {
    const assistantWin = windowRegistry.getWindowByType('assistant')
    if (!assistantWin || assistantWin.isDestroyed()) return

    const { width, height } = size
    const clampedWidth = Math.max(200, width || 300)
    const clampedHeight = Math.max(350, height || 500)

    assistantWin.setResizable(true)
    assistantWin.setSize(clampedWidth, clampedHeight)
    assistantWin.setResizable(false)
  })

  log.info('[AssistantSettingsIPC] IPC 处理器已注册')
}

export { setupAssistantSettingsIPC }
