/**
 * 窗口配置索引
 * 统一导出所有窗口配置，便于工厂模式使用
 */

import type { WindowType } from '../types'
import { mainWindowConfig } from './main.config'
import { widgetWindowConfig } from './widget.config'
import { widgetHostWindowConfig } from './widgetHost.config'
import { assistantWindowConfig } from './assistant.config'
import { chatBoxWindowConfig } from './chatBox.config'
import { tipsWindowConfig } from './tips.config'
import { assistantSettingsWindowConfig } from './assistantSettings.config'

/** 窗口配置映射表 */
export const windowConfigs: Record<WindowType, typeof mainWindowConfig> = {
  main: mainWindowConfig,
  widget: widgetWindowConfig,
  widgetHost: widgetHostWindowConfig,
  assistant: assistantWindowConfig,
  chatBox: chatBoxWindowConfig,
  tips: tipsWindowConfig,
  assistantSettings: assistantSettingsWindowConfig
}

/**
 * 获取指定类型的窗口配置
 * @param type 窗口类型
 * @returns 窗口配置
 */
export function getWindowConfig(type: WindowType): typeof mainWindowConfig {
  return windowConfigs[type]
}

// 导出各窗口配置
export { mainWindowConfig } from './main.config'
export { widgetWindowConfig } from './widget.config'
export { widgetHostWindowConfig } from './widgetHost.config'
export { assistantWindowConfig } from './assistant.config'
export { chatBoxWindowConfig } from './chatBox.config'
export { tipsWindowConfig } from './tips.config'
export { assistantSettingsWindowConfig } from './assistantSettings.config'
