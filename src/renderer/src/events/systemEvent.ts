import { ContextManager } from '@renderer/core/interaction/core/context'
import { InteractionPayloadBuilder } from '@renderer/core/interaction/tools/payloadBuilder'
import { IEventHandler } from '@renderer/core/interaction/types/IEventHandler'
import { EventModule } from '@renderer/core/interaction/types/eventModules'
import { InteractionEventPayload } from '@renderer/chat/ChatManager'
import { InteractionEffect } from '@renderer/core/interaction/types/InteractionEffect'

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
  cooldownMs = 0 // 系统事件通常是用户直接触发的，不需要全局冷却

  responseHandlers: Record<
    string,
    (contextManager: ContextManager) => Promise<InteractionEventPayload | null>
  > = {
    'system.charging': async (contextManager: ContextManager) => {
      const result = InteractionPayloadBuilder.buildEventPayload({
        event: 'system.charging',
        scene: '设备已接入电源并开始充电',
        context: contextManager.get(),
        maxLength: 80,
        fallback: '已经开始充电啦，安心继续使用吧！'
      })
      return result
    },
    'system.discharging': async (contextManager: ContextManager) => {
      const result = InteractionPayloadBuilder.buildEventPayload({
        event: 'system.discharging',
        scene: '设备已切换到电池供电模式',
        context: contextManager.get(),
        maxLength: 80,
        fallback: '现在是电池模式，记得关注续航哦！'
      })
      return result
    },
    'system.battery-level': async () => null,
    'system.lowBattery': async (contextManager: ContextManager) => {
      const percent = contextManager.get().batteryStatus?.percent ?? 0
      const result = InteractionPayloadBuilder.buildEventPayload({
        event: 'system.lowBattery',
        scene: `设备电量偏低，当前电量约${percent}%`,
        context: contextManager.get(),
        maxLength: 80,
        fallback: `当前电量只剩${percent}%，建议尽快充电。`
      })
      return result
    }
  }

  async handle(event: string, contextManager: ContextManager): Promise<InteractionEffect[]> {
    const handler = this.responseHandlers[event]
    if (!handler) {
      return []
    }

    const result = await handler(contextManager)
    return result ? [{ type: 'chat', payload: result }] : []
  }
}
