import { ChatManager } from '@renderer/chat/ChatManager'
import { InteractionEffect } from '../types/InteractionEffect'

type EffectExecutor<T extends InteractionEffect = InteractionEffect> = (
  effect: T
) => void | Promise<void>
type EffectType = InteractionEffect['type']
type EffectByType<T extends EffectType> = Extract<InteractionEffect, { type: T }>

/**
 * 统一执行事件处理器返回的效果。
 * 事件处理器只描述需要发生的动作，本类负责连接 Chat、Live2D、UI 与上下文等具体能力。
 */
export class EffectDispatcher {
  private chatService = ChatManager.getInstance()
  private executors = new Map<InteractionEffect['type'], EffectExecutor>()

  /**
   * 创建效果执行器。
   * @param contextManager 事件上下文管理器，用于执行上下文更新类效果。
   */
  constructor() {
    this.registerBuiltInExecutors()
  }

  /**
   * 注册指定效果类型的执行器。
   * @param type 效果类型名称，例如 live2d.enterSleep 或 ui.showTempMessage。
   * @param executor 实际执行效果的函数。
   */
  register<T extends EffectType>(type: T, executor: EffectExecutor<EffectByType<T>>): void {
    this.executors.set(type, executor as EffectExecutor)
  }

  /**
   * 按顺序执行一组效果。
   * @param effects 事件处理器返回的效果列表，空值会被安全忽略。
   */
  async dispatchAll(effects?: InteractionEffect[] | void): Promise<void> {
    if (!effects?.length) return

    for (const effect of effects) {
      const executor = this.executors.get(effect.type)
      if (!executor) {
        console.warn(`[EffectDispatcher] 未注册效果执行器: ${effect.type}`)
        return
      }
      await executor(effect)
    }
  }

  /**
   * 注册事件系统内置效果执行器。
   * 内置执行器只依赖通用聊天能力，Live2D 等具体表现能力由外部注册。
   */
  private registerBuiltInExecutors(): void {
    this.register('chat', async (effect) => {
      if (this.chatService.isChatting) {
        return
      }

      await this.sendChatEffect(effect)
    })
  }

  /**
   * 执行聊天效果。
   * 这里保留原先对话发送的节流和播放等待逻辑，确保聊天类 effect 不会过于频繁触发。
   */
  private async sendChatEffect(
    effect: Extract<InteractionEffect, { type: 'chat' }>
  ): Promise<void> {
    await this.chatService.interactionChat(effect.payload)
    await this.chatService.waitForReplyPlaybackComplete()
  }
}
