import { ContextManager } from '../services/InteractionSystem/core/context'
import { ActionDispatcher } from '../services/InteractionSystem/core/dispatcher'
import { IEventHandler } from '../services/InteractionSystem/types/IEventHandler'
import { EventModule } from '../services/InteractionSystem/types/eventModules'
import { EventReplyGenerator } from '../services/InteractionSystem/eventReplyGenerator'
import randomSelect from '@renderer/utils/RandomSelect'
import { AssistantInfo, AssistantManager } from '@renderer/services/assistantManager'

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
  private replyGenerator: EventReplyGenerator
  private assistant: AssistantInfo | null

  constructor() {
    this.replyGenerator = new EventReplyGenerator()
    this.assistant = AssistantManager.getInstance().getCurrentAssistant()
  }

  responseHandlers = {
    'mouse.resume': async (contextManager: ContextManager) => {
      const context = contextManager.get()
      const idleDurationMs = context.mouseEventStatus?.idleDurationMs || 0
      const minutes = Math.max(1, Math.round(idleDurationMs / 60000))
      const response = [
        `${this.assistant?.user || '阁下'}已经很久没有和你互动了，你可以表达一下想被关注的心情`,
        `${this.assistant?.user || '阁下'}已经${minutes}分钟没有理你了，你可以主动找话题聊聊`
      ]
      return await this.replyGenerator.generate({
        event: 'mouse.resume',
        scene: randomSelect(response)!,
        context,
        maxLength: 80,
        fallback: `欢迎回来，已经有${minutes}分钟没看到你啦。`
      })
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

    const message = await handler(contextManager)
    if (message) {
      dispatcher.send({ text: message, metadata: { eventType: event, timestamp: Date.now() } })
    }
  }
}
