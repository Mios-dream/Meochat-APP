import { ContextManager } from '../services/InteractionSystem/core/context'
import { ActionDispatcher } from '../services/InteractionSystem/core/dispatcher'
import { IEventHandler } from '../services/InteractionSystem/types/IEventHandler'
import { EventModule } from '../services/InteractionSystem/types/eventModules'
import { AssistantManager } from '../services/assistantManager'
import { LLMRequest } from '../utils/LLMRequest'

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
  private assistantManager: AssistantManager

  // 系统提示词模板
  private systemPrompt: string = `
  你是一个桌面助手，需要根据当前时间情境生成自然、亲切的问候对话。
  可以根据不同的时间段（早晨、中午、晚上）生成符合时段的问候语。

  对话示例：
  '早安~ 今天也要元气满满哦！',
  '阁下，中午好，记得补充能量！',
  '晚安，好梦，阁下！',
  '阁下，这么晚了，还不睡吗？连我都有些困了呢。',
  '阁下，现在是睡觉时间，明天再努力工作吧！'

  当前情境：
  - 助手人设：{{personality}}
  - 事件类型：{{eventType}}
  - 时间描述：{{timeDescription}}
  - 用户状态：{{userStatus}}

  请生成一句【自然、亲切、不超过50字】的问候对话，要符合助手的人设和当前时间段。
  `

  constructor() {
    this.assistantManager = AssistantManager.getInstance()
  }

  // 事件处理映射
  responseHandlers = {
    'time.morning': async () => {
      return await this.generateAIMessage('morning', '早晨7点', '用户刚刚开始新的一天')
    },
    'time.noon': async () => {
      return await this.generateAIMessage('noon', '中午12点', '用户正在午休或午餐时间')
    },
    'time.night': async () => {
      return await this.generateAIMessage('night', '晚上11点', '用户准备休息或还在工作')
    }
  }

  async handle(
    event: string,
    contextManager: ContextManager,
    dispatcher: ActionDispatcher
  ): Promise<void> {
    const handler = this.responseHandlers[event]
    if (handler) {
      const context = contextManager.get()
      const message = await handler(context)

      if (message) {
        dispatcher.send({ text: message })
      }
    }
  }

  /**
   * 生成AI回复消息
   * @param eventType - 事件类型
   * @param timeDescription - 时间描述
   * @param userStatus - 用户状态
   * @returns 生成的回复消息
   */
  private async generateAIMessage(
    eventType: string,
    timeDescription: string,
    userStatus: string
  ): Promise<string | null> {
    const currentAssistant = this.assistantManager.getCurrentAssistant()
    const personality =
      currentAssistant?.description || currentAssistant?.customPrompt || '温柔可爱'

    // 构建提示词
    const prompt = this.buildPrompt(personality, eventType, timeDescription, userStatus)

    return await LLMRequest([{ role: 'system', content: prompt }])
  }

  /**
   * 构建提示词
   * @param personality - 助手人设
   * @param eventType - 事件类型
   * @param timeDescription - 时间描述
   * @param userStatus - 用户状态
   * @returns 构建后的提示词
   */
  private buildPrompt(
    personality: string,
    eventType: string,
    timeDescription: string,
    userStatus: string
  ): string {
    return this.systemPrompt
      .replace('{{personality}}', personality)
      .replace('{{eventType}}', eventType)
      .replace('{{timeDescription}}', timeDescription)
      .replace('{{userStatus}}', userStatus)
  }
}
