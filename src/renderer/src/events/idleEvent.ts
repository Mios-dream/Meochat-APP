import { Context, ContextManager } from '../services/InteractionSystem/core/context'
import { ActionDispatcher } from '../services/InteractionSystem/core/dispatcher'
import { IEventHandler } from '../services/InteractionSystem/types/IEventHandler'
import { EventModule } from '../services/InteractionSystem/types/eventModules'
import { useConfigStore } from '../stores/useConfigStore'
import { InteractionEventPayload } from '@renderer/services/ChatService'

export class IdleEventModule extends EventModule {
  private idleEventsTimer: number | null = null

  start(): void {
    const configStore = useConfigStore()
    if (!configStore.config.idleEvent) {
      console.warn('空闲事件模块未启用')
      return
    }
    this.scheduleIdleEvents()
    this.initEventListeners()
  }

  stop(): void {
    window.api.ipcRenderer.removeAllListeners('assistantEvent:idle.taskComplete')
    window.api.ipcRenderer.removeAllListeners('assistantEvent:idle.systemEvent')
    if (this.idleEventsTimer) {
      clearTimeout(this.idleEventsTimer)
      this.idleEventsTimer = null
    }
  }

  private scheduleIdleEvents(): void {
    const loop = (): void => {
      const delay = this.calculateEventDelay(4, 6)

      this.idleEventsTimer = setTimeout(() => {
        this.eventCenter.emit(`idle.random`)
        loop()
      }, delay)
    }
    loop()
  }

  private initEventListeners(): void {
    window.api.ipcRenderer.on('assistantEvent:idle.taskComplete', (_event, context) => {
      this.triggerTaskCompleteEvent(context.taskName, context.success)
    })
    window.api.ipcRenderer.on('assistantEvent:idle.systemEvent', (_event, context) => {
      this.triggerSystemEvent(context.eventName, context.description)
    })
  }

  private calculateEventDelay(minInterval: number, maxInterval?: number): number {
    const max = maxInterval || minInterval * 2
    return (minInterval + Math.random() * (max - minInterval)) * 1000 * 60
  }

  public triggerTaskCompleteEvent(taskName: string, success: boolean = true): void {
    const context = {
      taskName,
      success,
      timestamp: Date.now()
    }
    this.eventCenter.emit('idle.taskComplete', { taskEventStatus: context })
  }

  public triggerSystemEvent(eventName: string, description: string): void {
    const context = {
      eventName,
      description,
      timestamp: Date.now()
    }
    this.eventCenter.emit('idle.systemEvent', { systemEventStatus: context })
  }
}

export class IdleEventHandler implements IEventHandler {
  eventType = 'idle'
  cooldownMs = 0 // 空闲事件不设置全局冷却，由具体事件类型控制

  chatTheme = [
    '与用户互动，例如：想被摸摸头，主动捏捏用户的脸等',
    '分享角色故事',
    '询问用户关于当前情境的问题',
    '表达对用户的关心和问候',
    '分享有趣的二次元相关的知识或话题',
    '提议一起做某件事（如听音乐、玩游戏等）',
    '表达对未来的期待或小目标',
    '天气或季节相关的对话',
    '美食或兴趣爱好相关的话题',
    '回忆过去的美好时光',
    '其他'
  ]

  responseHandlers: Record<
    string,
    (contextManager: ContextManager) => Promise<InteractionEventPayload | null>
  > = {
    'idle.random': async (contextManager: ContextManager) => {
      const context = contextManager.get()
      const result = await this.generateAIMessage('random', '随机空闲时刻', context)
      return result
    }
  }

  async handle(
    event: string,
    contextManager: ContextManager,
    dispatcher: ActionDispatcher
  ): Promise<void> {
    const handler = this.responseHandlers[event]
    if (handler) {
      const result = await handler(contextManager)
      if (result) {
        await dispatcher.send(result)
      }
    }
  }

  private async generateAIMessage(
    eventType: string,
    eventDescription: string,

    context: Context
  ): Promise<InteractionEventPayload | null> {
    const selectedTheme = this.chatTheme[Math.floor(Math.random() * this.chatTheme.length)]
    return ActionDispatcher.buildEventPayload({
      event: `idle.${eventType}`,
      scene: `空闲主动对话。主题:${selectedTheme}；事件描述:${eventDescription}`,
      context,
      maxLength: 100,
      extraRules: ['如果包含动作或心理活动，请使用()标记', '尽量避免与上一次对话主题重复'],
      fallback: '在忙吗？也别忘了偶尔放松一下，我会一直陪着你。'
    })
  }
}
