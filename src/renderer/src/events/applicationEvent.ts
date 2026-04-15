import { ContextManager } from '../services/InteractionSystem/core/context'
import { ActionDispatcher } from '../services/InteractionSystem/core/dispatcher'
import { IEventHandler } from '../services/InteractionSystem/types/IEventHandler'
import { EventModule } from '../services/InteractionSystem/types/eventModules'
import { useConfigStore } from '../stores/useConfigStore'
import { EventReplyGenerator } from '../services/InteractionSystem/eventReplyGenerator'

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
  // 记录每个应用上次触发过事件的时间，key格式为 "processName:pid"，value为时间戳
  private notifiedByApp = new Map<string, number>()

  start(): void {
    if (this.isListening) {
      return
    }

    window.api.ipcRenderer.on('assistantEvent:app-usage', (_event, payload: AppUsagePayload) => {
      const configStore = useConfigStore()
      const reminderMinutes = Math.max(10, Number(configStore.config.appReminderMinutes || 60))
      const thresholdMs = reminderMinutes * 60 * 1000
      const cooldownMs = Math.max(
        10 * 60 * 1000,
        Number(configStore.config.autoEventCooldownMs || 8000) * 5
      )

      const appName = payload?.processName || 'unknown'
      const continuousMs = Number(payload?.continuousMs || 0)
      const now = Date.now()

      if (continuousMs < thresholdMs) {
        return
      }

      const key = `${appName}:${payload?.pid || 0}`
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
    })

    this.isListening = true
  }

  stop(): void {
    if (!this.isListening) {
      return
    }

    window.api.ipcRenderer.removeAllListeners('assistantEvent:app-usage')
    this.notifiedByApp.clear()
    this.isListening = false
  }
}

export class ApplicationEventHandler implements IEventHandler {
  eventType = 'app'
  private replyGenerator: EventReplyGenerator

  constructor() {
    this.replyGenerator = new EventReplyGenerator()
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
      scene: `用户已连续使用应用较长时间。应用名:${appName}；窗口标题:${windowTitle || '无'}；连续时长:${continuousMinutes}分钟`,
      context,
      maxLength: 100,
      fallback: `你已经连续使用${appName}${continuousMinutes}分钟了，起来活动一下吧。`
    })
  }

  responseHandlers = {
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
