/**
 * IPC 通道定义辅助函数与类型
 *
 * 为每个 IPC 通道补充「方向」元数据，让通道的调用关系可被类型系统约束：
 *   invoke — 请求-响应模式：renderer invoke → main handle（可返回数据）
 *   send   — 单向通知模式：renderer send  → main on（fire-and-forget）
 *   event  — 事件推送模式：main send      → renderer on（主进程主动推送）
 *
 * 方向是防错的关键：registerHandle 只能注册 invoke 通道，
 * registerOn 只能注册 send 通道，从而把「方向错配」从运行时错误提前到编译期。
 */

/** 通道方向枚举 */
export type ChannelDirection = 'invoke' | 'send' | 'event'

/** 通道定义：方向 + 通道名字符串 */
export interface ChannelDef<
  D extends ChannelDirection = ChannelDirection,
  C extends string = string
> {
  /** 通道方向 */
  readonly direction: D
  /** 通道名字符串，如 'assistant:load-data' */
  readonly channel: C
}

/**
 * 定义一个请求-响应通道（renderer invoke → main handle）
 * @param channel 通道名字符串
 */
export function defineInvoke<C extends string>(channel: C): ChannelDef<'invoke', C> {
  return { direction: 'invoke', channel }
}

/**
 * 定义一个单向通知通道（renderer send → main on）
 * @param channel 通道名字符串
 */
export function defineSend<C extends string>(channel: C): ChannelDef<'send', C> {
  return { direction: 'send', channel }
}

/**
 * 定义一个事件推送通道（main send → renderer on）
 * @param channel 通道名字符串
 */
export function defineEvent<C extends string>(channel: C): ChannelDef<'event', C> {
  return { direction: 'event', channel }
}
