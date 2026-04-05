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
      const delay = this.calculateEventDelay(2, 4)

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
  可选的对话主题：
  - 与用户互动，例如：想被摸摸头，主动捏捏用户的脸等
  - 分享角色故事
  - 询问用户关于当前情境的问题
  - 表达对用户的关心和问候
  - 分享有趣的二次元相关的知识或话题
  - 提议一起做某件事（如听音乐、玩游戏等）
  - 表达对未来的期待或小目标
  - 天气或季节相关的对话
  - 美食或兴趣爱好相关的话题
  - 回忆过去的美好时光
  - 其他

  但注意，不要和上一次对话内容或主题重复。

  **角色昵称**：{{name}}
  **助手人设**：{{personality}}
  **角色描述**：{{description}}
  **额外描述**：{{extraDescription}}

  **对话示例**：
  '我才没有期待{{user}}摸我的头呢，哼，才没有！',
  '只要有阁下的陪伴，{{name}}就会很开心的！',
  '{{user}}。我会很努力的去陪伴阁下的！',
  '我已经没有{{user}}就活不下去啦！',
  '阁下!阁下!...没什么，就是想叫叫你！',
  '我最喜阁下了！所以希望能一直，一直看着你！'

  **当前情境**：
  - 事件类型：{{eventType}}
  - 事件描述：{{eventDescription}}
  - 用户状态：{{userStatus}}

  上一次对话内容：{{lastMessage}}

  请生成一句【自然、亲切、不超过100字】的主动对话，要符合助手的人设和当前情境，如果存在心理活动或动作需要使用()标记。
  `

  constructor() {
    this.assistantManager = AssistantManager.getInstance()
  }

  // 事件处理映射
  responseHandlers = {
    'idle.random': async (contextManager: ContextManager) => {
      const context = contextManager.get()
      const message = await this.generateAIMessage(
        'random',
        '随机空闲时刻',
        '用户可能处于空闲状态',
        context
      )
      if (message) {
        contextManager.update({ lastMessage: message })
      }
      return message
    },
    'idle.taskComplete': async (contextManager: ContextManager) => {
      const context = contextManager.get()
      const taskName = context.taskEventStatus?.taskName || '未知任务'
      const success = context.taskEventStatus?.success !== false
      const description = `${taskName}${success ? '完成' : '失败'}`
      const message = await this.generateAIMessage(
        'taskComplete',
        description,
        '用户刚刚完成任务',
        context
      )
      if (message) {
        contextManager.update({ lastMessage: message })
      }
      return message
    },
    'idle.systemEvent': async (contextManager: ContextManager) => {
      const context = contextManager.get()
      const description = context?.systemEventStatus?.description || '发生了系统事件'
      const message = await this.generateAIMessage(
        'systemEvent',
        description,
        '系统状态发生变化',
        context
      )
      if (message) {
        contextManager.update({ lastMessage: message })
      }
      return message
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
    userStatus: string,
    context: Context
  ): Promise<string | null> {
    // 构建提示词
    const prompt = this.buildPrompt(eventType, eventDescription, userStatus, context.lastMessage)
    return await LLMRequest([{ role: 'user', content: prompt }])
  }

  /**
   * 构建提示词
   * @param personality - 助手人设
   * @param eventType - 事件类型
   * @param eventDescription - 事件描述
   * @param userStatus - 用户状态
   * @param lastMessage - 上一次对话内容
   * @returns 构建后的提示词
   */
  private buildPrompt(
    eventType: string,
    eventDescription: string,
    userStatus: string,
    lastMessage: string | null = null
  ): string {
    const currentAssistant = this.assistantManager.getCurrentAssistant()

    return this.systemPrompt
      .replaceAll('{{name}}', currentAssistant?.name || '澪')
      .replaceAll('{{user}}', currentAssistant?.user || '阁下')
      .replaceAll('{{personality}}', currentAssistant?.personality || '无')
      .replaceAll(
        '{{description}}',
        currentAssistant?.description || currentAssistant?.customPrompt || '无'
      )
      .replaceAll('{{extraDescription}}', currentAssistant?.extraDescription || '无')
      .replaceAll('{{eventType}}', eventType)
      .replaceAll('{{eventDescription}}', eventDescription)
      .replaceAll('{{userStatus}}', userStatus)
      .replaceAll('{{lastMessage}}', lastMessage || '无')
  }
}
