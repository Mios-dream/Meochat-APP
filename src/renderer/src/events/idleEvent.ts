import { Context, ContextManager } from '@renderer/core/interaction/core/context'
import { InteractionPayloadBuilder } from '@renderer/core/interaction/tools/payloadBuilder'
import { IEventHandler } from '@renderer/core/interaction/types/IEventHandler'
import { EventModule } from '@renderer/core/interaction/types/eventModules'
import { useConfigStore } from '../stores/useConfigStore'
import { InteractionEventPayload } from '@renderer/chat/ChatManager'
import { InteractionEffect } from '@renderer/core/interaction/types/InteractionEffect'

/** 聊天主题定义：文本 + 选取权重（值越大概率越高） */
interface ThemeItem {
  text: string
  weight: number
}

/** 聊天主题池：与用户互动类主题权重更高 */
const CHAT_THEMES: ThemeItem[] = [
  { text: '与用户互动，例如：想被摸摸头，主动捏捏用户的脸等', weight: 4 },
  { text: '分享角色故事', weight: 1 },
  { text: '询问用户关于当前情境的问题', weight: 2 },
  { text: '表达对用户的关心和问候', weight: 2 },
  { text: '分享有趣的二次元相关的知识或话题', weight: 1 },
  { text: '提议一起做某件事（如听音乐、玩游戏等）', weight: 3 },
  { text: '表达对未来的期待或小目标', weight: 1 },
  { text: '天气或季节相关的对话', weight: 1 },
  { text: '美食或兴趣爱好相关的话题', weight: 1 },
  { text: '回忆过去的美好时光', weight: 2 },
  { text: '其他', weight: 1 }
]

export class IdleEventModule extends EventModule {
  private idleEventsTimer: ReturnType<typeof setTimeout> | null = null

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
    window.api.ipcRenderer.on('assistantEvent:idle.taskComplete', (context) => {
      const taskData = context as { taskName: string; success: boolean }
      this.triggerTaskCompleteEvent(taskData.taskName, taskData.success)
    })
    window.api.ipcRenderer.on('assistantEvent:idle.systemEvent', (context) => {
      const sysData = context as { eventName: string; description: string }
      this.triggerSystemEvent(sysData.eventName, sysData.description)
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

/** 带权重的主题选择器：互动类主题有更高概率 */
function selectTheme(): { theme: string; index: number } {
  const totalWeight = CHAT_THEMES.reduce((sum, t) => sum + t.weight, 0)
  let r = Math.random() * totalWeight
  let index = 0
  for (let i = 0; i < CHAT_THEMES.length; i++) {
    r -= CHAT_THEMES[i].weight
    if (r <= 0) {
      index = i
      break
    }
  }
  return { theme: CHAT_THEMES[index].text, index }
}

export class IdleEventHandler implements IEventHandler {
  eventType = 'idle'
  cooldownMs = 0

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

  async handle(event: string, contextManager: ContextManager): Promise<InteractionEffect[]> {
    if (contextManager.get().sleepMode) {
      return []
    }

    const handler = this.responseHandlers[event]
    if (!handler) {
      return []
    }

    const result = await handler(contextManager)
    return result ? [{ type: 'chat', payload: result }] : []
  }

  private async generateAIMessage(
    eventType: string,
    eventDescription: string,
    context: Context
  ): Promise<InteractionEventPayload | null> {
    const { theme: selectedTheme } = selectTheme()
    return InteractionPayloadBuilder.buildEventPayload({
      event: `idle.${eventType}`,
      scene: `空闲主动对话。主题：${selectedTheme}；事件描述：${eventDescription}`,
      context,
      maxLength: 100,
      extraRules: ['如果包含动作或心理活动，请使用( )标记', '尽量避免与上一次对话主题重复'],
      fallback: '在忙吗？也别忘了偶尔放松一下，我会一直陪着你的！',
      icon: { path: '/icon/icon_message.png' }
    })
  }
}
