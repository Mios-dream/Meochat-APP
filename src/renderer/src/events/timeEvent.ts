import { ContextManager } from '../services/InteractionSystem/core/context'
import { ActionDispatcher } from '../services/InteractionSystem/core/dispatcher'
import { IEventHandler } from '../services/InteractionSystem/types/IEventHandler'
import { EventModule } from '../services/InteractionSystem/types/eventModules'
import { EventReplyGenerator } from '../services/InteractionSystem/eventReplyGenerator'
import { AssistantInfo, AssistantManager } from '@renderer/services/assistantManager'

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
      if (h > 6 && h < 11) this.eventCenter.emit('time.morning')
      if (h > 10 && h < 14) this.eventCenter.emit('time.noon')
      if (h > 13 && h < 18) this.eventCenter.emit('time.afternoon')
      if (h > 23 || h < 6) this.eventCenter.emit('time.night')
      this.timeEventsTimer = setTimeout(check, 60 * 50 * 1000)
    }
    check()
  }
}

// 时间事件处理器
export class TimeEventHandler implements IEventHandler {
  eventType = 'time'
  private replyGenerator: EventReplyGenerator
  private assistant: AssistantInfo | null

  constructor() {
    this.replyGenerator = new EventReplyGenerator()
    this.assistant = AssistantManager.getInstance().getCurrentAssistant()
  }

  // 事件处理映射
  responseHandlers = {
    'time.morning': async (contextManager: ContextManager) => {
      return await this.replyGenerator.generate({
        event: 'time.morning',
        scene: `现在是上午了，你可以和${this.assistant?.name || '阁下'}说声早安`,
        context: contextManager.get(),
        maxLength: 50,
        fallback: '早安，今天也要元气满满哦。'
      })
    },
    'time.noon': async (contextManager: ContextManager) => {
      return await this.replyGenerator.generate({
        event: 'time.noon',
        scene: `现在是下午了，你可以提醒${this.assistant?.name || '阁下'}休息一下`,
        context: contextManager.get(),
        maxLength: 50,
        fallback: '中午好，记得补充能量。'
      })
    },
    'time.afternoon': async (contextManager: ContextManager) => {
      return await this.replyGenerator.generate({
        event: 'time.afternoon',
        scene: `现在是下午了，你可以和${this.assistant?.name || '阁下'}说声下午好`,
        context: contextManager.get(),
        maxLength: 50,
        fallback: '下午好，继续加油哦。'
      })
    },
    'time.night': async (contextManager: ContextManager) => {
      return await this.replyGenerator.generate({
        event: 'time.night',
        scene: `现在是晚上了，如果很晚了可以关心一下${this.assistant?.name || '阁下'}的休息`,
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
