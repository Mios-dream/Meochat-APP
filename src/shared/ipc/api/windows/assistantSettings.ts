/**
 * 桌宠助手悬浮设置窗口 API 类型
 */

import { AssistantApi } from '../base/assistant'
import type { CommonApi } from '../base/common'

/** 助手设置窗口暴露的 API 接口 */
export interface AssistantSettingsWindowApi extends CommonApi {
  closeAssistantSettings: () => void
  resizeAssistant: (width: number, height: number) => void

  assistant: AssistantApi
}
