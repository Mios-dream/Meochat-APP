/**
 * 统一 Preload 脚本
 *
 * 根据 --window-type 参数选择正确的 API 构建器，
 * 通过 contextBridge 暴露给渲染进程。
 */

import { contextBridge } from 'electron'
import { buildMainWindowApi } from './api/main'
import { buildAssistantWindowApi } from './api/assistant'
import { buildChatBoxWindowApi } from './api/chatBox'
import { buildAssistantSettingsWindowApi } from './api/assistantSettings'
import { buildWidgetWindowApi } from './api/widget'
import { buildTipsWindowApi } from './api/tips'
import type {
  MainWindowApi,
  AssistantWindowApi,
  ChatBoxWindowApi,
  AssistantSettingsWindowApi,
  WidgetWindowApi,
  TipsWindowApi
} from '@shared/ipc/api'

type WindowApi =
  | MainWindowApi
  | AssistantWindowApi
  | ChatBoxWindowApi
  | AssistantSettingsWindowApi
  | WidgetWindowApi
  | TipsWindowApi

const apiBuilders: Record<string, () => WindowApi> = {
  main: buildMainWindowApi,
  assistant: buildAssistantWindowApi,
  chatBox: buildChatBoxWindowApi,
  assistantSettings: buildAssistantSettingsWindowApi,
  widget: buildWidgetWindowApi,
  tips: buildTipsWindowApi
}

const windowType =
  process.argv.find((arg) => arg.startsWith('--window-type='))?.split('=')[1] ?? 'main'

contextBridge.exposeInMainWorld('api', (apiBuilders[windowType] ?? buildMainWindowApi)())
