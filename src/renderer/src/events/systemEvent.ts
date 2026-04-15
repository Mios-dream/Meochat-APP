import { ContextManager } from '../services/InteractionSystem/core/context'
import { ActionDispatcher } from '../services/InteractionSystem/core/dispatcher'
import { IEventHandler } from '../services/InteractionSystem/types/IEventHandler'
import { EventModule } from '../services/InteractionSystem/types/eventModules'
import { EventReplyGenerator } from '../services/InteractionSystem/eventReplyGenerator'

interface BatteryPayload {
  percent: number
  isCharging: boolean
  isLow: boolean
  threshold: number
  timestamp: number
}

export class SystemEventModule extends EventModule {
  private isListening = false
  private lowBatteryNotified = false

  start(): void {
    if (this.isListening) {
      return
    }

    window.api.ipcRenderer.on('assistantEvent:on-ac', (_event, payload) => {
      this.eventCenter.emit('system.charging', {
        systemPowerStatus: {
          state: 'charging',
          timestamp: payload?.timestamp || Date.now()
        }
      })
    })

    window.api.ipcRenderer.on('assistantEvent:on-battery', (_event, payload) => {
      this.eventCenter.emit('system.discharging', {
        systemPowerStatus: {
          state: 'battery',
          timestamp: payload?.timestamp || Date.now()
        }
      })
    })

    window.api.ipcRenderer.on('assistantEvent:battery-level', (_event, payload: BatteryPayload) => {
      const percent = Number(payload?.percent || 0)
      const isCharging = Boolean(payload?.isCharging)
      const isLow = Boolean(payload?.isLow)
      const threshold = Number(payload?.threshold || 20)
      const timestamp = payload?.timestamp || Date.now()

      this.eventCenter.emit('system.battery-level', {
        batteryStatus: {
          percent,
          isCharging,
          isLow,
          threshold,
          timestamp
        }
      })

      if (isLow && !this.lowBatteryNotified) {
        this.lowBatteryNotified = true
        this.eventCenter.emit('system.lowBattery', {
          batteryStatus: {
            percent,
            isCharging,
            isLow,
            threshold,
            timestamp
          }
        })
      }

      if (!isLow) {
        this.lowBatteryNotified = false
      }
    })

    this.isListening = true
  }

  stop(): void {
    if (!this.isListening) {
      return
    }

    window.api.ipcRenderer.removeAllListeners('assistantEvent:on-ac')
    window.api.ipcRenderer.removeAllListeners('assistantEvent:on-battery')
    window.api.ipcRenderer.removeAllListeners('assistantEvent:battery-level')
    this.lowBatteryNotified = false
    this.isListening = false
  }
}

export class SystemEventHandler implements IEventHandler {
  eventType = 'system'
  private replyGenerator: EventReplyGenerator

  constructor() {
    this.replyGenerator = new EventReplyGenerator()
  }

  responseHandlers = {
    'system.charging': async (contextManager: ContextManager) => {
      return await this.replyGenerator.generate({
        event: 'system.charging',
        scene: '设备已接入电源并开始充电',
        context: contextManager.get(),
        maxLength: 80,
        fallback: '已经开始充电啦，安心继续使用吧。'
      })
    },
    'system.discharging': async (contextManager: ContextManager) => {
      return await this.replyGenerator.generate({
        event: 'system.discharging',
        scene: '设备已切换到电池供电模式',
        context: contextManager.get(),
        maxLength: 80,
        fallback: '现在是电池模式，记得关注续航哦。'
      })
    },
    'system.battery-level': async () => null,
    'system.lowBattery': async (contextManager: ContextManager) => {
      const percent = contextManager.get().batteryStatus?.percent ?? 0
      return await this.replyGenerator.generate({
        event: 'system.lowBattery',
        scene: `设备电量偏低，当前电量约${percent}%`,
        context: contextManager.get(),
        maxLength: 80,
        fallback: `当前电量只剩${percent}%，建议尽快充电。`
      })
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
