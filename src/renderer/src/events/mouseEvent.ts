import { ContextManager } from '@renderer/core/interaction/core/context'
import { ActionDispatcher } from '@renderer/core/interaction/core/dispatcher'
import { IEventHandler } from '@renderer/core/interaction/types/IEventHandler'
import { EventModule } from '@renderer/core/interaction/types/eventModules'
import randomSelect from '@renderer/utils/RandomSelect'
import { InteractionEventPayload } from '@renderer/services/ChatService'

interface MouseResumePayload {
  idleDurationMs: number
  timestamp: number
}

interface MouseActivityPayload {
  idleDurationMs: number
  isIdle: boolean
  timestamp: number
}

export class MouseEventModule extends EventModule {
  private isListening = false
  private lastIdleState: boolean | null = null

  start(): void {
    if (this.isListening) {
      return
    }

    window.api.ipcRenderer.on(
      'assistantEvent:mouse-resumed',
      (_event, payload: MouseResumePayload) => {
        this.eventCenter.emit('mouse.resume', {
          isBusy: false,
          lastInteraction: Date.now(),
          mouseEventStatus: {
            idleDurationMs: payload?.idleDurationMs || 0,
            isIdle: false,
            timestamp: payload?.timestamp || Date.now()
          }
        })
      }
    )

    window.api.ipcRenderer.on(
      'assistantEvent:mouse-activity',
      (_event, payload: MouseActivityPayload) => {
        const nextIdle = Boolean(payload?.isIdle)

        if (this.lastIdleState === null || this.lastIdleState !== nextIdle) {
          this.lastIdleState = nextIdle
          this.eventCenter.emit(nextIdle ? 'mouse.idle' : 'mouse.busy', {
            isBusy: !nextIdle,
            lastInteraction: Date.now(),
            mouseEventStatus: {
              idleDurationMs: payload?.idleDurationMs || 0,
              isIdle: nextIdle,
              timestamp: payload?.timestamp || Date.now()
            }
          })
        }
      }
    )

    this.isListening = true
  }

  stop(): void {
    if (!this.isListening) {
      return
    }

    window.api.ipcRenderer.removeAllListeners('assistantEvent:mouse-resumed')
    window.api.ipcRenderer.removeAllListeners('assistantEvent:mouse-activity')
    this.lastIdleState = null
    this.isListening = false
  }
}

export class MouseEventHandler implements IEventHandler {
  eventType = 'mouse'
  cooldownMs = 0 // 鼠标事件通常是用户直接触发的，不需要全局冷却

  responseHandlers: Record<
    string,
    (contextManager: ContextManager) => Promise<InteractionEventPayload | null>
  > = {
    'mouse.resume': async (contextManager: ContextManager) => {
      const context = contextManager.get()
      const idleDurationMs = context.mouseEventStatus?.idleDurationMs || 0
      const minutes = Math.max(1, Math.round(idleDurationMs / 60000))
      const response = [
        '用户已经很久没有和你互动了，你可以表达一下想被关注的心情',
        `用户已经${minutes}分钟没有理你了，你可以主动找话题聊聊`
      ]
      const result = ActionDispatcher.buildEventPayload({
        event: 'mouse.resume',
        scene: randomSelect(response)!,
        context,
        maxLength: 80,
        fallback: `欢迎回来，已经有${minutes}分钟没看到你啦。`
      })
      return result
    },
    'mouse.idle': async () => null,
    'mouse.busy': async () => null
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

    const result = await handler(contextManager)
    if (result) {
      await dispatcher.send(result)
    }
  }
}

