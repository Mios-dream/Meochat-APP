import { EventCenter } from '../core/eventCenter'

// 抽象事件模块类
export abstract class EventModule {
  constructor(protected eventCenter: EventCenter) {}

  abstract start(): void
  abstract stop(): void
}
