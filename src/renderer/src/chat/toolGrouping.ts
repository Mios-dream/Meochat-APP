/**
 * 聊天消息展示分组工具
 *
 * 将消息列表中的工具调用（kind: tool_call）与其执行结果（kind: tool_result）
 * 合并为「工具组」，并按对话回合（轮次）收拢整段回复，供助手空间与工具栏窗口共用，
 * 确保两个入口的聊天展示样式与行为保持一致。
 *
 * 消息采用后端私有展示结构（ChatMessage，kind 驱动），分组规则：
 * - kind === 'user' 开启用户回合，之后连续的 chat / 工具组归入该回合；
 * - kind === 'interaction' 开启自动回复回合，且**每条自动回复消息独立成回合**
 *   （不合并，各自拥有单独头像），便于与用户对话回合在视觉上区分；
 * - chat / 工具组若跟在自动回合之后（异常数据），强制开启新回合，避免并入互动回合。
 *
 * 本文件零依赖 Live2D 等桌面环境，可在任意渲染窗口安全使用。
 */

import type { ChatMessage } from '@shared/types/chat'

/**
 * 分组所需的消息最小结构：排除展示层可选的时间戳字段，
 * 使分组逻辑既能处理纯展示消息（ChatMessage），也能处理带 Date 时间戳的展示消息。
 */
export type GroupableMessage = Omit<ChatMessage, 'timestamp'>

/**
 * 合并后的工具条目：含调用参数、执行结果。
 * result === undefined 表示工具仍在执行中。
 */
export interface MergedTool {
  id: string
  name: string
  /** 调用参数（JSON 字符串） */
  args?: string
  /** 执行结果文本，undefined 表示尚未返回 */
  result?: string
}

/** 展示项：普通消息 */
export interface DisplayMessage<TMsg extends GroupableMessage = GroupableMessage> {
  kind: 'message'
  msg: TMsg
}

/** 展示项：合并后的工具组（工具调用 + 执行结果） */
export interface DisplayAssistantWithTools {
  kind: 'assistant_with_tools'
  tools: MergedTool[]
}

/** 消息列表的展示项联合类型 */
export type DisplayItem<TMsg extends GroupableMessage = GroupableMessage> =
  | DisplayMessage<TMsg>
  | DisplayAssistantWithTools

/**
 * 回合内容单元：一段助手展示内容（一句文本 或 一组工具调用）
 */
export type ChatTurnUnit<TMsg extends GroupableMessage = GroupableMessage> =
  | { type: 'text'; msg: TMsg }
  | { type: 'tools'; tools: MergedTool[] }

/**
 * 对话回合（轮次）
 *
 * 一个回合 = 一个用户消息 + 其触发的整段助手回复（工具调用 + 逐句文本），
 * 或 一个无用户消息的助手自动回复片段（initiatedBy === 'assistant'）。
 */
export interface ChatTurn<TMsg extends GroupableMessage = GroupableMessage> {
  kind: 'turn'
  /** 回合发起方：assistant 表示自动回复（非用户触发） */
  initiatedBy: 'user' | 'assistant'
  /** 用户消息（用户回合通常为 1 条，自动回复为空） */
  userMessages: TMsg[]
  /** 助手侧内容单元，按原始顺序排列 */
  units: ChatTurnUnit<TMsg>[]
}

/**
 * 从各种格式的消息 content 中提取纯文本
 * @param content - 消息内容（纯字符串或内容片段数组）
 * @returns 拼接后的纯文本
 */
export function getTextContent(content: ChatMessage['content']): string {
  if (!content) return ''
  if (typeof content === 'string') return content
  if (Array.isArray(content)) {
    return content
      .filter((p): p is Extract<typeof p, { type: 'text' }> => p.type === 'text')
      .map((p) => p.text)
      .join('')
  }
  return ''
}

/**
 * 将消息列表中的工具调用及其结果合并为展示用工具组。
 *
 * 同一轮 LLM 工具调用可能被后端拆分成多条 tool_call 消息逐条下发，
 * 这里将连续的工具调用锚点（含其匹配的 tool_result）合并为一个工具组，避免工具
 * 调用以独立的 tool 消息形式展示。助手后续的文字回复独立为普通消息展示，不并入
 * 工具组。未匹配到 tool_result 的孤立 tool_call / tool_result 消息照常作为普通消息渲染。
 *
 * @param messages - 原始消息列表
 * @returns 供模板渲染的展示项列表
 */
export function mergeToolCallGroups<TMsg extends GroupableMessage>(
  messages: TMsg[]
): DisplayItem<TMsg>[] {
  const items: DisplayItem<TMsg>[] = []
  const skip = new Set<number>()

  for (let i = 0; i < messages.length; i++) {
    if (skip.has(i)) continue
    const msg = messages[i]

    if (msg.kind === 'tool_call' && msg.tool_calls && msg.tool_calls.length > 0) {
      // 合并连续的工具调用锚点（含其匹配的工具结果）为一个工具组
      const tools: MergedTool[] = []
      let anchorIdx = i
      while (anchorIdx < messages.length) {
        const anchor = messages[anchorIdx]
        if (anchor.kind === 'tool_call' && anchor.tool_calls && anchor.tool_calls.length > 0) {
          for (const tc of anchor.tool_calls) {
            let result: string | undefined
            for (let j = anchorIdx + 1; j < messages.length; j++) {
              if (skip.has(j)) continue
              if (messages[j].kind === 'tool_result' && messages[j].tool_call_id === tc.id) {
                skip.add(j)
                result = getTextContent(messages[j].content)
                break
              }
            }
            tools.push({
              id: tc.id,
              name: tc.function.name,
              args: tc.function.arguments,
              result
            })
          }
          skip.add(anchorIdx)
          anchorIdx++
        } else if (anchor.kind === 'tool_result') {
          // 工具结果消息（通常紧随调用之后）：跳过，继续向后合并锚点
          anchorIdx++
        } else {
          break
        }
      }

      // 不将后续的助手文字消息作为工具组的回复合并进来，
      // 文本回复按普通消息独立展示，与工具组穿插、顺序排列。
      items.push({ kind: 'assistant_with_tools', tools })
    } else {
      // 未匹配到 tool_calls 的孤立 tool 消息也照常渲染
      items.push({ kind: 'message', msg })
    }
  }
  return items
}

/**
 * 将消息列表分组为「对话回合」（轮次）。
 *
 * 回合划分规则（kind 驱动）：
 * - kind === 'user' 消息开启一个用户回合，之后连续的 chat / 工具组
 *   都归入该回合，直到下一条 user 或 interaction；
 * - kind === 'interaction' 消息**每条独立开启一个「自动回复」回合**，不合并，
 *   各自拥有单独头像（多句自动回复由后端按句展开时即各自成组）；
 * - chat / 工具组若跟随在自动回合之后（历史异常或裁剪导致无 user 锚点），
 *   强制开启新自动回合，避免并入互动回合；
 * - 列表开头无 user 消息的 chat / 工具组兜底为独立自动回合。
 *
 * 工具调用与其结果已在 mergeToolCallGroups 阶段合并为工具组，这里只需把
 * 「工具组 + 后续逐句文本」收拢到同一个回合，避免一轮回复被多个头像切碎。
 *
 * @param messages - 原始消息列表
 * @returns 供模板渲染的回合列表
 */
export function groupChatTurns<TMsg extends GroupableMessage>(messages: TMsg[]): ChatTurn<TMsg>[] {
  const displayItems = mergeToolCallGroups(messages)
  const turns: ChatTurn<TMsg>[] = []
  let current: ChatTurn<TMsg> | null = null

  const toUnit = (item: DisplayItem<TMsg>): ChatTurnUnit<TMsg> =>
    item.kind === 'assistant_with_tools'
      ? { type: 'tools', tools: item.tools }
      : { type: 'text', msg: item.msg }

  for (const item of displayItems) {
    // 用户消息：开启新的用户回合
    if (item.kind === 'message' && item.msg.kind === 'user') {
      current = { kind: 'turn', initiatedBy: 'user', userMessages: [item.msg], units: [] }
      turns.push(current)
      continue
    }

    // 工具组无 kind 字段，按普通助手内容处理（归入当前回合）
    const itemKind = item.kind === 'assistant_with_tools' ? 'tool_group' : item.msg.kind

    // 自动回复：每条消息独立成回合（不合并，各自拥有单独头像）
    if (itemKind === 'interaction') {
      current = { kind: 'turn', initiatedBy: 'assistant', userMessages: [], units: [] }
      turns.push(current)
    } else if (!current || current.initiatedBy === 'assistant') {
      // 非自动回复内容（chat / 工具组 / 孤立 tool_result）：
      // 无当前回合 → 兜底开自动回合；当前为自动回合 → 强制开新回合（防互吸）
      current = { kind: 'turn', initiatedBy: 'assistant', userMessages: [], units: [] }
      turns.push(current)
    }

    current.units.push(toUnit(item))
  }
  return turns
}
