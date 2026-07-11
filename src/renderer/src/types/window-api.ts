/**
 * 窗口 API 类型声明（渲染进程侧）
 *
 * 为渲染进程提供 window.api 的类型增强。
 * 所有窗口类型的 API 统一通过 window.api 访问，
 * widget/tips 窗口的特性 API 通过 window.api.widgetApi / window.api.tipsApi 子对象访问。
 */

import type {
  CommonApi,
  MainWindowApi,
  AssistantWindowApi,
  ChatBoxWindowApi,
  AssistantSettingsWindowApi,
  WidgetWindowApi,
  TipsWindowApi
} from '@shared/ipc/api'

declare global {
  interface Window {
    api: CommonApi &
      MainWindowApi &
      AssistantWindowApi &
      ChatBoxWindowApi &
      AssistantSettingsWindowApi &
      WidgetWindowApi &
      TipsWindowApi
  }
}
