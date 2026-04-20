// core/context.ts
export interface Context {
  lastInteraction: number
  userMood: string
  isBusy: boolean
  isInConversation?: boolean
  lastEventTime?: number
  lastEventType?: string
  lastMessage?: string
  mouseEventStatus?: {
    idleDurationMs: number
    isIdle: boolean
    timestamp: number
  }
  appEventStatus?: {
    appName: string
    previousAppName?: string
    title: string
    category: string
    continuousMs: number
    timestamp: number
  }
  systemPowerStatus?: {
    state: 'charging' | 'battery'
    timestamp: number
  }
  batteryStatus?: {
    percent: number
    isCharging: boolean
    isLow: boolean
    threshold: number
    timestamp: number
  }
  taskEventStatus?: {
    taskName: string
    success: boolean
    timestamp: number
  }
  systemEventStatus?: {
    eventName: string
    description: string
    timestamp: number
  }
}

export class ContextManager {
  private state: Context = {
    lastInteraction: Date.now(),
    userMood: '正常',
    isBusy: false
  }

  update(partial: Partial<Context>): void {
    this.state = { ...this.state, ...partial }
  }

  get(): Context {
    return this.state
  }
}
