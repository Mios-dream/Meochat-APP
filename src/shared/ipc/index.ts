/**
 * 共享 IPC 模块入口
 */

export * from './channels'
export type {
  MainWindowApi,
  AssistantWindowApi,
  ChatBoxWindowApi,
  AssistantSettingsWindowApi,
  WidgetWindowApi,
  TipsWindowApi
} from './api'
