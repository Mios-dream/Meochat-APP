// core/context.ts
export interface Context {
  lastInteraction: number
  userMood: string
  isBusy: boolean
  lastMessage?: string
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
