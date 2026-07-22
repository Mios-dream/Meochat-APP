/**
 * @file chat.ts
 * @description 聊天服务相关的 IPC 接口定义
 */

import type { ChatMessage } from '@shared/types/chat'
/** 工具调用状态数据类型 */
export interface ToolStatusData {
  active: boolean
  tools: Array<{ name: string; status: string }>
}

/** 聊天调用请求（IPC invoke，携带原始附件路径，非 base64） */
export interface ChatInvokeRequest {
  text: string
  attachments?: { name: string; path: string }[]
}

/** 主进程转发给助理窗口的调用请求 */
export interface InvokeRequestData {
  requestId: string
  text: string
  attachments?: { name: string; path: string }[]
}

/** 助理窗口返回给主进程的调用结果 */
export interface InvokeResultData {
  requestId: string
  success: boolean
  reply?: string
  history?: ChatMessage[]
  error?: string
}

/** ChatBox 窗口得到的调用结果 */
export interface ChatInvokeResult {
  success: boolean
  reply?: string
  history?: ChatMessage[]
  error?: string
}

export interface ChatApi {
  // ─── 命令（renderer → main，单向 fire-and-forget） ───

  /** 取消当前聊天 */
  cancelMessage: (data?: { text: string }) => void
  /** 唤醒词检测 */
  wakewordDetected: (keyword: string) => void
  /** 更新工具状态 */
  updateToolStatus: (data: ToolStatusData) => void
  /** 助理窗口返回聊天调用结果给主进程 */
  sendInvokeResult: (data: InvokeResultData) => void

  // ─── 请求-响应（renderer → main，双向 invoke） ───

  /** 发送聊天消息（ChatBox → Main → Assistant → 结果返回） */
  invokeChat: (msg: ChatInvokeRequest) => Promise<ChatInvokeResult>
  /** 获取聊天历史 */
  getHistory: () => Promise<ChatMessage[]>
  /** 追加一条消息到历史 */
  appendMessage: (message: ChatMessage) => Promise<void>
  /** 删除最后一条消息（发送失败回滚） */
  popHistory: () => Promise<void>
  /** 替换全部历史（远端同步后覆盖） */
  replaceHistory: (messages: ChatMessage[]) => Promise<void>
  /** 清空聊天历史（本地 + 云端） */
  clearHistory: () => Promise<void>

  // ─── 事件监听（main → renderer，返回清理函数） ───

  /** 监听取消消息 */
  onCancelMessage: (callback: () => void) => () => void
  /** 监听清空历史 */
  onClearHistory: (callback: () => void) => () => void
  /** 监听聊天历史变更 */
  onHistoryChanged: (callback: () => void) => () => void
  /** 监听唤醒词检测 */
  onWakewordDetected: (callback: (wakeword: string) => void) => () => void
  /** 监听主进程转发的聊天调用请求（仅助理窗口使用） */
  onInvokeRequest: (callback: (data: InvokeRequestData) => void) => () => void
}
