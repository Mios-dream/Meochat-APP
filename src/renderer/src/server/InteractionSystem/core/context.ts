// core/context.ts
export interface Context {
  lastInteraction: number
  userMood: string
  isBusy: boolean
  lastMessage?: string
}

export class ContextManager {
  private state: Context = {
    lastInteraction: Date.now(),
    userMood: 'neutral',
    isBusy: false,
  }

  update(partial: Partial<Context>) {
    this.state = { ...this.state, ...partial }
  }

  get() {
    return this.state
  }

  shouldInteract(minGap = 3 * 60 * 1000): boolean {
    return Date.now() - this.state.lastInteraction > minGap && !this.state.isBusy
  }
}
