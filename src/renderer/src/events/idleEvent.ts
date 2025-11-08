import { ContextManager } from '../server/InteractionSystem/core/context'
import { ActionDispatcher } from '../server/InteractionSystem/core/dispatcher'
import { IEventHandler } from '../server/InteractionSystem/types/IEventHandler'
import { EventModule } from '../server/InteractionSystem/types/eventModules'
import { useConfigStore } from '../stores/useConfigStore'
// 空闲事件模块
export class IdleEventModule extends EventModule {
  private idleEventsTimer: NodeJS.Timeout | null = null

  start(): void {
    const configStore = useConfigStore()
    if (!configStore.config.idleEvent) {
      console.warn('空闲事件模块未启用')
      return
    }
    this.scheduleIdleEvents()
  }

  stop(): void {
    if (this.idleEventsTimer) {
      clearTimeout(this.idleEventsTimer)
      this.idleEventsTimer = null
    }
  }

  private scheduleIdleEvents(): void {
    const loop = (): void => {
      const delay = 1000 * 20 * (3 + Math.random() * 2)
      this.idleEventsTimer = setTimeout(() => {
        this.eventCenter.emit('idle.random')
        loop()
      }, delay)
    }
    loop()
  }
}

// 空闲事件处理器
export class IdleEventHandler implements IEventHandler {
  eventType = 'idle'

  responseHandlers = {
    'idle.random': () => {
      const messages = [
        '阁下，最近在忙什么呢？',
        '阁下，要不要陪我聊聊天？',
        '我才没有期待阁下摸我的头呢，哼，才没有！',
        '只要有阁下的陪伴，澪就会很开心的！',
        '阁下。我会很努力的去陪伴阁下的！',
        '我已经没有阁下就活不下去啦！',
        '阁下!阁下!...没什么，就是想叫叫你！',
        '我最喜阁下了！所以希望能一直，一直看着你！'
      ]
      return messages[Math.floor(Math.random() * messages.length)]
    }
  }

  handle(event: string, contextManager: ContextManager, dispatcher: ActionDispatcher): void {
    console.log(`空闲事件触发: ${event}`)
    console.log(contextManager)
    dispatcher.send({ text: this.responseHandlers[event]() })
  }
}
