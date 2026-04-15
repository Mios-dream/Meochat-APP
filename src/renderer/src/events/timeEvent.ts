import { ContextManager } from '../services/InteractionSystem/core/context'
import { ActionDispatcher } from '../services/InteractionSystem/core/dispatcher'
import { IEventHandler } from '../services/InteractionSystem/types/IEventHandler'
import { EventModule } from '../services/InteractionSystem/types/eventModules'
import { EventReplyGenerator } from '../services/InteractionSystem/eventReplyGenerator'

// 时间事件模块
export class TimeEventModule extends EventModule {
  private timeEventsTimer: NodeJS.Timeout | null = null

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
      if (h === 7) this.eventCenter.emit('time.morning')
      if (h === 12) this.eventCenter.emit('time.noon')
      if (h === 23) this.eventCenter.emit('time.night')
      this.timeEventsTimer = setTimeout(check, 60 * 50 * 1000)
    }
    check()
  }
}

// 时间事件处理器
export class TimeEventHandler implements IEventHandler {
  eventType = 'time'
  private replyGenerator: EventReplyGenerator

  constructor() {
    this.replyGenerator = new EventReplyGenerator()
  }

  // 事件处理映射
  responseHandlers = {
    'time.morning': async (contextManager: ContextManager) => {
      return await this.replyGenerator.generate({
        event: 'time.morning',
        scene: '早晨问候，当前约为早上7点，用户刚开始新的一天',
        context: contextManager.get(),
        maxLength: 50,
        fallback: '早安，今天也要元气满满哦。'
      })
    },
    'time.noon': async (contextManager: ContextManager) => {
      return await this.replyGenerator.generate({
        event: 'time.noon',
        scene: '中午问候，当前约为12点，用户可能在午休或午餐',
        context: contextManager.get(),
        maxLength: 50,
        fallback: '中午好，记得补充能量。'
      })
    },
    'time.night': async (contextManager: ContextManager) => {
      return await this.replyGenerator.generate({
        event: 'time.night',
        scene: '夜间问候，当前约为23点，提醒用户适当休息',
        context: contextManager.get(),
        maxLength: 50,
        fallback: '夜深啦，别太辛苦，记得早点休息。'
      })
    }
  }

  async handle(
    event: string,
    contextManager: ContextManager,
    dispatcher: ActionDispatcher
  ): Promise<void> {
    const handler = this.responseHandlers[event]
    if (handler) {
      const message = await handler(contextManager)

      if (message) {
        dispatcher.send({ text: message })
      }
    }
  }
}
