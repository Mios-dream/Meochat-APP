/**
 * 桌宠助手悬浮设置窗口配置
 *
 * 该窗口为桌宠模式下的小型悬浮设置面板，支持：
 * - 调整桌宠大小
 * - 切换助手
 * - 开关台词板 & 其他快捷设置
 */
import type { WindowConfig } from '../types'

export const assistantSettingsWindowConfig: WindowConfig = {
  type: 'assistantSettings',
  htmlFile: 'assistantSettings.html',
  preload: 'assistantSettingsPreload',
  singleton: true,
  options: {
    width: 340,
    height: 520,
    frame: false,
    transparent: true,
    alwaysOnTop: false,
    resizable: false,
    skipTaskbar: true,
    autoHideMenuBar: true,
    focusable: true,
    hasShadow: true
  }
}
