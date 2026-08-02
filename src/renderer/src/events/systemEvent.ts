import { ContextManager } from '@renderer/core/interaction/core/context'
import { InteractionPayloadBuilder } from '@renderer/core/interaction/tools/payloadBuilder'
import { IEventHandler } from '@renderer/core/interaction/types/IEventHandler'
import { EventModule } from '@renderer/core/interaction/types/eventModules'
import { InteractionEventPayload } from '@renderer/chat/ChatManager'
import { InteractionEffect } from '@renderer/core/interaction/types/InteractionEffect'

export class SystemEventModule extends EventModule {
  private isListening = false
  private lowBatteryNotified = false
  /** 已注册的 IPC 监听清理函数 */
  private cleanups: Array<() => void> = []

  start(): void {
    if (this.isListening) {
      return
    }

    this.cleanups.push(
      window.api.onPowerAc((data) => {
        this.eventCenter.emit('system.charging', {
          systemPowerStatus: {
            state: 'charging',
            timestamp: data?.timestamp || Date.now()
          }
        })
      })
    )

    this.cleanups.push(
      window.api.onPowerBattery((data) => {
        this.eventCenter.emit('system.discharging', {
          systemPowerStatus: {
            state: 'battery',
            timestamp: data?.timestamp || Date.now()
          }
        })
      })
    )

    this.cleanups.push(
      window.api.onBatteryLevel((batteryData) => {
        const percent = Number(batteryData?.percent || 0)
        const isCharging = Boolean(batteryData?.isCharging)
        const isLow = Boolean(batteryData?.isLow)
        const threshold = Number(batteryData?.threshold || 20)
        const timestamp = batteryData?.timestamp || Date.now()

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
    )

    this.isListening = true
  }

  stop(): void {
    if (!this.isListening) {
      return
    }

    this.cleanups.forEach((cleanup) => cleanup())
    this.cleanups = []
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
        fallback: '已经开始充电啦，安心继续使用吧！',
        icon: { path: '/icon/icon_gear.png' }
      })
      return result
    },
    'system.discharging': async (contextManager: ContextManager) => {
      const result = InteractionPayloadBuilder.buildEventPayload({
        event: 'system.discharging',
        scene: '设备已切换到电池供电模式',
        context: contextManager.get(),
        maxLength: 80,
        fallback: '现在是电池模式，记得关注续航哦！',
        icon: { path: '/icon/icon_gear.png' }
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
        fallback: `当前电量只剩${percent}%，建议尽快充电。`,
        icon: { path: '/icon/icon_gear.png' }
      })
      return result
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
