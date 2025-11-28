import { ContextManager } from '../services/InteractionSystem/core/context'
import { ActionDispatcher } from '../services/InteractionSystem/core/dispatcher'
import { IEventHandler } from '../services/InteractionSystem/types/IEventHandler'
import { EventModule } from '../services/InteractionSystem/types/eventModules'

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

  responseHandlers = {
    'time.morning': () => '早安~ 今天也要元气满满哦！',
    'time.noon': () => '阁下，中午好，记得补充能量！',
    'time.night': () => {
      const messages = [
        '晚安，好梦，阁下！',
        '阁下，这么晚了，还不睡吗？连我都有些困了呢。',
        '阁下，现在是睡觉时间，明天再努力工作吧！'
      ]
      return messages[Math.floor(Math.random() * messages.length)]
    }
  }

  handle(event: string, _contextManager: ContextManager, dispatcher: ActionDispatcher): void {
    dispatcher.send({ text: this.responseHandlers[event]() })
  }
}
