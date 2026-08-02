/**
 * 聊天框窗口 API 类型
 *
 * 注意：只包含主进程有 handler 的方法。
 * 无 handler 的已移除：sendMessage / getChatHistory / clearChatHistory 等。
 */

import { AssistantApi } from '../base/assistant'
import { ChatApi } from '../base/chat'
import { SystemApi } from '../base/system'
import type { CommonApi } from '../base/common'

/** 聊天框窗口暴露的 API 接口 */
export interface ChatBoxWindowApi extends CommonApi {
  togglePin: () => Promise<{ success: boolean; pinned?: boolean; error?: string }>
  getPinStatus: () => Promise<{ success: boolean; pinned?: boolean; error?: string }>
  hideChatBox: () => void
  showChatBox: () => void
  openChatBox: () => void
  closeChatBox: () => void
  assistant: AssistantApi
  chat: ChatApi
  system: SystemApi
}
