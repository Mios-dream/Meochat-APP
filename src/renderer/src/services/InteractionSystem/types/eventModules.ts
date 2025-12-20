import { EventCenter } from '../core/eventCenter'

// 抽象事件模块类
export abstract class EventModule {
  constructor(protected eventCenter: EventCenter) {}

  /**
   * 启动事件模块
   */
  abstract start(): void
  /**
   * 停止事件模块
   */
  abstract stop(): void
}
