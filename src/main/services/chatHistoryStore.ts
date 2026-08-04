/**
 * 聊天历史存储（主进程）
 *
 * 作为聊天历史的单一权威数据源，所有窗口通过 IPC 读写此处。
 * 按助手名称分别维护，支持裁剪、回滚、远端同步。
 * 所有操作都会验证助手是否存在，若未指定助手名称则自动使用当前助手。
 */

import type { ChatMessage, ChatHistoryApiResponse, StoreResult } from '@shared/types/chat'
import { AssistantService } from './assistant/assistantService'

// 本地缓存上限：与后端 HistoryManager.MAX_RECORDS(100) 对齐，避免双源裁剪差异造成漂移
const MAX_HISTORY_LENGTH = 100

/** 裁剪聊天历史至最大长度 */
function trimChatHistory(messages: ChatMessage[], maxLength: number): ChatMessage[] {
  return messages.length > maxLength ? messages.slice(-maxLength) : messages
}

class ChatHistoryStore {
  /** 按助手名称维护的聊天历史 */
  private historyMap: Map<string, ChatMessage[]> = new Map()

  /**
   * 解析并验证助手名称。
   *
   * @param assistantName - 可选的助手名称，不传则从 AssistantService 获取当前助手
   * @returns 验证通过的助手名称
   * @throws 当助手不存在或未选中时抛出错误
   */
  private async resolveAssistant(assistantName?: string): Promise<string> {
    const assistantService = AssistantService.getInstance()
    if (assistantName) {
      const assistants = assistantService.getAssistants()
      if (!assistants.some((a) => a.name === assistantName)) {
        throw new Error(`助手 "${assistantName}" 不存在`)
      }
      return assistantName
    }
    const current = assistantService.getCurrentAssistant()
    if (!current) {
      throw new Error('当前没有选中助手')
    }
    return current.name
  }

  /** 获取指定助手的聊天历史 */
  public async get(assistantName?: string): Promise<StoreResult> {
    try {
      const name = await this.resolveAssistant(assistantName)
      return { success: true, data: this.getHistory(name) }
    } catch (e) {
      return { success: false, error: (e as Error).message }
    }
  }

  /** 添加一条消息到指定助手的历史 */
  public async push(assistantName: string | undefined, message: ChatMessage): Promise<StoreResult> {
    try {
      const name = await this.resolveAssistant(assistantName)
      const history = this.getHistory(name)
      history.push(message)
      const trimmed = trimChatHistory(history, MAX_HISTORY_LENGTH)
      this.setHistory(name, trimmed)
      return { success: true, data: trimmed }
    } catch (e) {
      return { success: false, error: (e as Error).message }
    }
  }

  /** 删除指定助手最后一条消息（发送失败回滚） */
  public async popLast(assistantName?: string): Promise<StoreResult> {
    try {
      const name = await this.resolveAssistant(assistantName)
      const history = this.getHistory(name)
      if (history.length > 0) history.pop()
      return { success: true, data: [...this.getHistory(name)] }
    } catch (e) {
      return { success: false, error: (e as Error).message }
    }
  }

  /** 使用后端 API 返回值同步 */
  public async syncFromApi(
    assistantName: string | undefined,
    result: ChatHistoryApiResponse
  ): Promise<StoreResult> {
    try {
      const resolved = await this.resolveAssistant(assistantName || result.assistant)
      const history = Array.isArray(result.data) ? result.data : []
      this.setHistory(resolved, trimChatHistory(history, MAX_HISTORY_LENGTH))
      return { success: true, data: history }
    } catch (e) {
      return { success: false, error: (e as Error).message }
    }
  }

  /** 替换指定助手的全部历史（用于远端同步后覆盖） */
  public async replace(
    assistantName: string | undefined,
    messages: ChatMessage[]
  ): Promise<StoreResult> {
    try {
      const name = await this.resolveAssistant(assistantName)
      this.setHistory(name, trimChatHistory(messages, MAX_HISTORY_LENGTH))
      return { success: true, data: messages }
    } catch (e) {
      return { success: false, error: (e as Error).message }
    }
  }

  /** 清空指定助手的历史 */
  public async clear(assistantName?: string): Promise<StoreResult> {
    try {
      const name = await this.resolveAssistant(assistantName)
      this.historyMap.delete(name)
      return { success: true, data: [] }
    } catch (e) {
      return { success: false, error: (e as Error).message }
    }
  }

  private getHistory(assistantName?: string): ChatMessage[] {
    const key = assistantName || '__default__'
    let history = this.historyMap.get(key)
    if (!history) {
      history = []
      this.historyMap.set(key, history)
    }
    return history
  }

  private setHistory(assistantName: string | undefined, history: ChatMessage[]): void {
    this.historyMap.set(assistantName || '__default__', history)
  }
}

export const chatHistoryStore = new ChatHistoryStore()
