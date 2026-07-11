/**
 * 预加载 API 入口
 *
 * 根据 --window-type 参数，选择正确的 API 对象暴露给渲染进程。
 */

import { buildMainWindowApi } from './main'
import { buildAssistantWindowApi } from './assistant'
import { buildChatBoxWindowApi } from './chatBox'
import { buildAssistantSettingsWindowApi } from './assistantSettings'
import { buildWidgetWindowApi } from './widget'
import { buildTipsWindowApi } from './tips'
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

export function getWindowApi(windowType: string): WindowApi {
  const builder = apiBuilders[windowType] ?? buildMainWindowApi
  return builder()
}
