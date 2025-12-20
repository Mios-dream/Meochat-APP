import { Context, ContextManager } from '../services/InteractionSystem/core/context'
import { ActionDispatcher } from '../services/InteractionSystem/core/dispatcher'
import { IEventHandler } from '../services/InteractionSystem/types/IEventHandler'
import { EventModule } from '../services/InteractionSystem/types/eventModules'
import { useConfigStore } from '../stores/useConfigStore'
import { AssistantManager } from '../services/assistantManager'
import { LLMRequest } from '../utils/LLMRequest'

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
      // 根据事件类型计算延迟时间
      const delay = this.calculateEventDelay(2)

      this.idleEventsTimer = setTimeout(() => {
        // 根据概率决定是否触发事件
        if (Math.random() < 0.7) {
          this.eventCenter.emit(`idle.random`)
        }
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

  /**
   * 计算事件触发延迟时间（随机值）
   * @param minInterval - 最小间隔分钟
   * @param maxInterval - 最大间隔分钟（可选，默认是最小间隔的两倍）
   * @returns 随机延迟时间
   */
  private calculateEventDelay(minInterval: number, maxInterval?: number): number {
    const max = maxInterval || minInterval * 2
    return (minInterval + Math.random() * (max - minInterval)) * 1000 * 60
  }

  /**
   * 触发任务完成事件
   * @param taskName - 任务名称
   * @param success - 任务是否成功完成（可选，默认是成功）
   */
  public triggerTaskCompleteEvent(taskName: string, success: boolean = true): void {
    const context = {
      taskName,
      success,
      timestamp: Date.now()
    }
    this.eventCenter.emit('idle.taskComplete', { taskEventStatus: context })
  }

  /**
   * 触发系统事件
   * @param eventName - 事件名称
   * @param description - 事件描述
   */
  public triggerSystemEvent(eventName: string, description: string): void {
    const context = {
      eventName,
      description,
      timestamp: Date.now()
    }
    this.eventCenter.emit('idle.systemEvent', { systemEventStatus: context })
  }
}

// 空闲事件处理器
export class IdleEventHandler implements IEventHandler {
  eventType = 'idle'
  private assistantManager: AssistantManager

  // 系统提示词模板（移动到类内部）
  private systemPrompt: string = `
  你是一个桌面助手，需要根据当前情境生成自然、亲切的主动对话。
  可以询问用户关于当前情境的问题，可以分享自己的故事，或者引导用户互动。

  对话示例：
  '我才没有期待阁下摸我的头呢，哼，才没有！',
  '只要有阁下的陪伴，澪就会很开心的！',
  '阁下。我会很努力的去陪伴阁下的！',
  '我已经没有阁下就活不下去啦！',
  '阁下!阁下!...没什么，就是想叫叫你！',
  '我最喜阁下了！所以希望能一直，一直看着你！'

  当前情境：
  - 助手人设：{{personality}}
  - 事件类型：{{eventType}}
  - 事件描述：{{eventDescription}}
  - 用户状态：{{userStatus}}

  请生成一句【自然、亲切、不超过50字】的主动对话，要符合助手的人设和当前情境。
  `

  constructor() {
    this.assistantManager = AssistantManager.getInstance()
  }

  // 事件处理映射
  responseHandlers = {
    'idle.random': async () => {
      return await this.generateAIMessage('random', '随机空闲时刻', '用户可能处于空闲状态')
    },
    'idle.taskComplete': async (context: Context) => {
      const taskName = context.taskEventStatus?.taskName || '未知任务'
      const success = context.taskEventStatus?.success !== false
      const description = `${taskName}${success ? '完成' : '失败'}`
      return await this.generateAIMessage('taskComplete', description, '用户刚刚完成任务')
    },
    'idle.systemEvent': async (context) => {
      const description = context?.description || '发生了系统事件'
      return await this.generateAIMessage('systemEvent', description, '系统状态发生变化')
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
   * @param eventDescription - 事件描述
   * @param userStatus - 用户状态
   * @returns 生成的回复消息
   */
  private async generateAIMessage(
    eventType: string,
    eventDescription: string,
    userStatus: string
  ): Promise<string | null> {
    const currentAssistant = this.assistantManager.getCurrentAssistant()
    const personality =
      currentAssistant?.description || currentAssistant?.customPrompt || '温柔可爱'

    // 构建提示词
    const prompt = this.buildPrompt(personality, eventType, eventDescription, userStatus)

    return await LLMRequest([{ role: 'system', content: prompt }])
  }

  /**
   * 构建提示词
   * @param personality - 助手人设
   * @param eventType - 事件类型
   * @param eventDescription - 事件描述
   * @param userStatus - 用户状态
   * @returns 构建后的提示词
   */
  private buildPrompt(
    personality: string,
    eventType: string,
    eventDescription: string,
    userStatus: string
  ): string {
    return this.systemPrompt
      .replace('{{personality}}', personality)
      .replace('{{eventType}}', eventType)
      .replace('{{eventDescription}}', eventDescription)
      .replace('{{userStatus}}', userStatus)
  }
}
