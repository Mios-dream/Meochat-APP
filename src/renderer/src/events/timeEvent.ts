import { ContextManager } from '../services/InteractionSystem/core/context'
import { ActionDispatcher } from '../services/InteractionSystem/core/dispatcher'
import { IEventHandler } from '../services/InteractionSystem/types/IEventHandler'
import { EventModule } from '../services/InteractionSystem/types/eventModules'
import { InteractionEventPayload } from '@renderer/services/ChatService'

export class TimeEventModule extends EventModule {
  private timeEventsTimer: number | null = null

  start(): void {
    this.scheduleTimeEvents()
  }

  stop(): void {
    if (this.timeEventsTimer) {
      clearTimeout(this.timeEventsTimer)
      this.timeEventsTimer = null
    }
  }

  private scheduleTimeEvents(): void {
    const check = (): void => {
      const h = new Date().getHours()
      if (h > 6 && h < 11) this.eventCenter.emit('time.morning')
      if (h > 10 && h < 14) this.eventCenter.emit('time.noon')
      if (h > 13 && h < 18) this.eventCenter.emit('time.afternoon')
      if (h > 23 || h < 6) this.eventCenter.emit('time.night')
      this.timeEventsTimer = setTimeout(check, 60 * 50 * 1000)
    }
    check()
  }
}

export class TimeEventHandler implements IEventHandler {
  eventType = 'time'
  cooldownMs = 0 // 时间事件不设置全局冷却，由具体事件类型控制

  responseHandlers: Record<
    string,
    (contextManager: ContextManager) => Promise<InteractionEventPayload | null>
  > = {
    'time.morning': async (contextManager: ContextManager) => {
      const result = ActionDispatcher.buildEventPayload({
        event: 'time.morning',
        scene: '现在是上午了，和用户说声早安',
        context: contextManager.get(),
        maxLength: 50,
        fallback: '早安，今天也要元气满满哦。'
      })
      return result
    },
    'time.noon': async (contextManager: ContextManager) => {
      const result = ActionDispatcher.buildEventPayload({
        event: 'time.noon',
        scene: '现在是中午了，提醒用户休息一下',
        context: contextManager.get(),
        maxLength: 50,
        fallback: '中午好，记得补充能量。'
      })
      return result
    },
    'time.afternoon': async (contextManager: ContextManager) => {
      const result = ActionDispatcher.buildEventPayload({
        event: 'time.afternoon',
        scene: '现在是下午了，和用户说声下午好',
        context: contextManager.get(),
        maxLength: 50,
        fallback: '下午好，继续加油哦。'
      })
      return result
    },
    'time.night': async (contextManager: ContextManager) => {
      const result = ActionDispatcher.buildEventPayload({
        event: 'time.night',
        scene: '现在是晚上了，如果很晚了可以关心一下用户的休息',
        context: contextManager.get(),
        maxLength: 50,
        fallback: '夜深啦，别太辛苦，记得早点休息。'
      })
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
}
