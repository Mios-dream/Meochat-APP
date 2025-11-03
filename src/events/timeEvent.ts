import { ContextManager } from '@/server/InteractionSystem/core/context'
import { ActionDispatcher } from '@/server/InteractionSystem/core/dispatcher'
// import { InteractionEngine } from '@/server/InteractionSystem/core/engine'
import { IEventHandler } from '@/server/InteractionSystem/types/IEventHandler'
import { EventModule } from '@/server/InteractionSystem/types/eventModules'

// 时间事件模块
export class TimeEventModule extends EventModule {
  private timeEventsTimer: number | null = null

  start() {
    this.scheduleTimeEvents()
  }

  stop() {
    if (this.timeEventsTimer) {
      clearTimeout(this.timeEventsTimer)
      this.timeEventsTimer = null
    }
  }

  private scheduleTimeEvents() {
    const check = () => {
      const h = new Date().getHours()
      if (h === 7) this.eventCenter.emit('time.morning')
      if (h === 12) this.eventCenter.emit('time.noon')
      if (h === 22) this.eventCenter.emit('time.night')
      this.timeEventsTimer = setTimeout(check, 60 * 1000)
    }
    check()
  }
}

// 时间事件处理器
export class TimeEventHandler implements IEventHandler {
  eventType = 'time'

  responseHandlers = {
    'time.morning': () => '早安~ 今天也要元气满满哦！',
    'time.noon': () => '中午好，记得补充能量！',
    'time.night': () => '晚安，好梦，阁下！',
  }

  handle(event: string, contextManager: ContextManager, dispatcher: ActionDispatcher) {
    dispatcher.send({ text: this.responseHandlers[event] })
  }
}
