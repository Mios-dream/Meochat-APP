import { InteractionEventPayload } from '@renderer/chat/ChatManager'
import { ContextManager } from '@renderer/core/interaction/core/context'
import { InteractionPayloadBuilder } from '@renderer/core/interaction/tools/payloadBuilder'
import { IEventHandler } from '@renderer/core/interaction/types/IEventHandler'
import { EventModule } from '@renderer/core/interaction/types/eventModules'
import { InteractionEffect } from '@renderer/core/interaction/types/InteractionEffect'

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
  private notifiedByApp = new Map<string, number>()
  private lastForegroundAppKey = ''
  private lastSwitchNotifiedAt = 0
  private readonly switchReplyProbability = 0.3

  private handleUsagePayload(payload: AppUsagePayload): void {
    const reminderMinutes = 60
    const thresholdMs = reminderMinutes * 60 * 1000
    const cooldownMs = 10 * 60 * 1000
    const switchCooldownMs = 30 * 1000
    const appName = payload?.processName || 'unknown'
    const continuousMs = Number(payload?.continuousMs || 0)
    const now = Date.now()
    const key = `${appName}:${payload?.pid || 0}`

    if (this.lastForegroundAppKey && this.lastForegroundAppKey !== key) {
      const shouldReply = Math.random() < this.switchReplyProbability
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

    if (continuousMs < thresholdMs) {
      return
    }

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
  cooldownMs = 5 * 60 * 1000 // 5 minute

  private async generateTipMessage(
    _appName: string,
    windowTitle: string,
    continuousMinutes: number,
    context: ReturnType<ContextManager['get']>
  ): Promise<InteractionEventPayload | null> {
    const result = InteractionPayloadBuilder.buildEventPayload({
      event: 'app.overuse',
      scene: `用户已连续使用${_appName}较长时间,应用标题${windowTitle || '未知'}；请以你扮演的角色的口吻自然地关心一下`,
      context,
      maxLength: 100,
      fallback: `你已经连续使用${_appName}${continuousMinutes}分钟了，起来活动一下吧。`,
      icon: { path: '/icon/icon_clock.png' }
    })
    return result
  }

  private async generateSwitchMessage(
    appName: string,
    _previousAppName: string,
    windowTitle: string,
    context: ReturnType<ContextManager['get']>
  ): Promise<InteractionEventPayload | null> {
    const result = InteractionPayloadBuilder.buildEventPayload({
      event: 'app.switch',
      scene: `当前用户正在使用应用${appName},应用标题${windowTitle}，请以你扮演的角色的口吻自然地回应一句`,
      context,
      maxLength: 80,
      fallback: `阁下,您刚刚打开${appName}，需要我帮你做点什么吗？`,
      icon: { path: '/icon/icon_cherry_blossom.png' }
    })
    return result
  }

  responseHandlers: Record<
    string,
    (contextManager: ContextManager) => Promise<InteractionEventPayload | null>
  > = {
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

  async handle(event: string, contextManager: ContextManager): Promise<InteractionEffect[]> {
    if (contextManager.get().sleepMode) {
      return []
    }

    const handler = this.responseHandlers[event]
    if (!handler) {
      return []
    }

    const result = await handler(contextManager)
    return result ? [{ type: 'chat', payload: result }] : []
  }
}
