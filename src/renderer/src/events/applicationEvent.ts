import { ContextManager } from '../services/InteractionSystem/core/context'
import { ActionDispatcher } from '../services/InteractionSystem/core/dispatcher'
import { IEventHandler } from '../services/InteractionSystem/types/IEventHandler'
import { EventModule } from '../services/InteractionSystem/types/eventModules'
import { useConfigStore } from '../stores/useConfigStore'
import { EventReplyGenerator } from '../services/InteractionSystem/eventReplyGenerator'
import { AssistantInfo } from '@renderer/types/AssistantInfo'
import { AssistantManager } from '@renderer/services/assistantManager'

interface AppUsagePayload {
  processName: string
  windowTitle: string
  pid: number
  category: string
  continuousMs: number
  sampledAt: number
}

export class ApplicationEventModule extends EventModule {
  private isListening = false
  private pollTimer: ReturnType<typeof setInterval> | null = null
  private isPolling = false
  private readonly pollIntervalMs = 60 * 1000
  // 记录每个应用上次触发过事件的时间，key格式为 "processName:pid"，value为时间戳
  private notifiedByApp = new Map<string, number>()
  // 记录上一次前台应用，用于识别应用切换
  private lastForegroundAppKey = ''
  // 记录上一次触发前台切换回复事件的时间
  private lastSwitchNotifiedAt = 0
  private readonly switchReplyProbability = 0.3

  private handleUsagePayload(payload: AppUsagePayload): void {
    const configStore = useConfigStore()
    // 同一应用持续使用多久后提醒休息
    const reminderMinutes = Math.max(10, Number(configStore.config.appReminderMinutes || 60))
    const thresholdMs = reminderMinutes * 60 * 1000
    // 冷静时间
    const cooldownMs = Math.max(
      10 * 60 * 1000,
      Number(configStore.config.autoEventCooldownMs || 8000) * 5
    )
    // 应用切换冷静时间
    const switchCooldownMs = Math.max(
      30 * 1000,
      Number(configStore.config.autoEventCooldownMs || 8000)
    )
    // 下面是使用不同应用的吐槽回复
    const appName = payload?.processName || 'unknown'
    const continuousMs = Number(payload?.continuousMs || 0)
    const now = Date.now()
    const key = `${appName}:${payload?.pid || 0}`
    // 如果当前应用与先前应用不同
    if (this.lastForegroundAppKey && this.lastForegroundAppKey !== key) {
      const shouldReply = Math.random() < this.switchReplyProbability
      // 如果冷静时间和概率同时满足
      if (shouldReply && now - this.lastSwitchNotifiedAt >= switchCooldownMs) {
        const previousAppName = this.lastForegroundAppKey.split(':')[0] || 'unknown'
        this.lastSwitchNotifiedAt = now
        this.eventCenter.emit('app.switch', {
          appEventStatus: {
            appName,
            previousAppName,
            title: payload?.windowTitle || '',
            category: payload?.category || 'other',
            continuousMs,
            timestamp: payload?.sampledAt || now
          },
          isBusy: true,
          lastInteraction: now
        })
      }
    }

    this.lastForegroundAppKey = key

    // 下面是持续使用时间提醒
    // 如果使用时间小于使用阈值
    if (continuousMs < thresholdMs) {
      return
    }
    // 如果还在冷静期内
    const lastNotifiedAt = this.notifiedByApp.get(key) || 0
    if (now - lastNotifiedAt < cooldownMs) {
      return
    }

    this.notifiedByApp.set(key, now)
    this.eventCenter.emit('app.overuse', {
      appEventStatus: {
        appName,
        title: payload?.windowTitle || '',
        category: payload?.category || 'other',
        continuousMs,
        timestamp: payload?.sampledAt || now
      },
      isBusy: true,
      lastInteraction: now
    })
  }

  private async pollAndHandleUsage(): Promise<void> {
    if (this.isPolling) {
      return
    }

    this.isPolling = true
    try {
      const payload = (await window.api.getForegroundAppUsage()) as AppUsagePayload | null
      if (!payload) {
        return
      }

      this.handleUsagePayload(payload)
    } catch {
      return
    } finally {
      this.isPolling = false
    }
  }

  start(): void {
    if (this.isListening) {
      return
    }

    void this.pollAndHandleUsage()
    this.pollTimer = setInterval(() => {
      void this.pollAndHandleUsage()
    }, this.pollIntervalMs)

    this.isListening = true
  }

  stop(): void {
    if (!this.isListening) {
      return
    }

    if (this.pollTimer) {
      clearInterval(this.pollTimer)
      this.pollTimer = null
    }

    this.isPolling = false
    this.notifiedByApp.clear()
    this.lastForegroundAppKey = ''
    this.lastSwitchNotifiedAt = 0
    this.isListening = false
  }
}

export class ApplicationEventHandler implements IEventHandler {
  eventType = 'app'
  private replyGenerator: EventReplyGenerator
  private assistant: AssistantInfo | null

  constructor() {
    this.replyGenerator = new EventReplyGenerator()
    this.assistant = AssistantManager.getInstance().getCurrentAssistant()
  }

  /**
   * 生成提示消息
   */
  private async generateTipMessage(
    appName: string,
    windowTitle: string,
    continuousMinutes: number,
    context: ReturnType<ContextManager['get']>
  ): Promise<string | null> {
    return await this.replyGenerator.generate({
      event: 'app.overuse',
      scene: `${this.assistant?.user || '阁下'}已连续使用${appName}较长时间,应用标题为:${windowTitle || '无'}；请以你扮演的角色的口吻自然地关心一下`,
      context,
      maxLength: 100,
      fallback: `你已经连续使用${appName}${continuousMinutes}分钟了，起来活动一下吧。`
    })
  }

  private async generateSwitchMessage(
    appName: string,
    _previousAppName: string,
    windowTitle: string,
    context: ReturnType<ContextManager['get']>
  ): Promise<string | null> {
    return await this.replyGenerator.generate({
      event: 'app.switch',
      scene: `当前${this.assistant?.user || '阁下'}正在使用应用${appName},应用标题为${windowTitle}，请以你扮演的角色的口吻自然地回应一句`,
      context,
      maxLength: 80,
      fallback: `阁下,您刚刚打开了${appName}，需要我帮你做点什么吗？`
    })
  }

  responseHandlers = {
    'app.switch': async (contextManager: ContextManager) => {
      const context = contextManager.get()
      const appName = context.appEventStatus?.appName || '当前应用'
      const previousAppName = context.appEventStatus?.previousAppName || '上一应用'
      return await this.generateSwitchMessage(
        appName,
        previousAppName,
        context.appEventStatus?.title || '',
        context
      )
    },
    'app.overuse': async (contextManager: ContextManager) => {
      const context = contextManager.get()
      const appName = context.appEventStatus?.appName || '当前应用'
      const minutes = Math.max(1, Math.round((context.appEventStatus?.continuousMs || 0) / 60000))
      return await this.generateTipMessage(
        appName,
        context.appEventStatus?.title || '',
        minutes,
        context
      )
    }
  }

  async handle(
    event: string,
    contextManager: ContextManager,
    dispatcher: ActionDispatcher
  ): Promise<void> {
    const handler = this.responseHandlers[event]
    if (!handler) {
      return
    }

    const message = await handler(contextManager)
    if (message) {
      dispatcher.send({ text: message, metadata: { eventType: event, timestamp: Date.now() } })
    }
  }
}
