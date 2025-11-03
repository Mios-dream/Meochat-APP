// index.ts
import { EventCenter } from './core/eventCenter'
import { ContextManager } from './core/context'
import { ActionDispatcher } from './core/dispatcher'
import { EventSystem } from './core/eventSystem'
import { EventModule } from './types/eventModules'
import { TimeEventHandler, TimeEventModule } from '@/events/timeEvent'
import { IdleEventHandler, IdleEventModule } from '@/events/idleEvent'
import { FestivalEventHandler, FestivalEventModule } from '@/events/festivalEvents'

export class InteractionSystem {
  private static instance: InteractionSystem | null = null

  // 事件中心，用于管理事件的注册和触发
  private eventCenter: EventCenter
  // 上下文管理器，用于管理应用状态
  private contextManager: ContextManager
  // 响应分发器，用于处理事件响应执行具体的动作
  private dispatcher: ActionDispatcher
  // 事件系统，用于注册事件触发器，并将事件发送到事件中心触发
  private eventSystem: EventSystem
  // 事件模块列表
  private eventModules: EventModule[] = []
  // 应用运行状态
  private isRunning = false
  // 是否启用调试事件
  private enableDebugEvents: boolean = false

  static getInstance(): InteractionSystem {
    if (!InteractionSystem.instance) {
      InteractionSystem.instance = new InteractionSystem()
    }
    return InteractionSystem.instance
  }

  constructor() {
    // 初始化核心组件
    this.eventCenter = new EventCenter()
    this.contextManager = new ContextManager()
    this.dispatcher = new ActionDispatcher()
    this.eventSystem = new EventSystem(this.eventCenter, this.contextManager, this.dispatcher)
    // 初始化事件模块
    this.initializeEventModules()
  }

  /**
   * 初始化事件模块,添加需要的事件模块到列表中,通常是定时任务
   */
  private initializeEventModules() {
    this.eventModules.push(new TimeEventModule(this.eventCenter))
    this.eventModules.push(new IdleEventModule(this.eventCenter))
    this.eventModules.push(new FestivalEventModule(this.eventCenter))
  }

  // 注册所有默认处理器
  registerHandlers() {
    this.eventSystem.registerHandler(new TimeEventHandler())
    this.eventSystem.registerHandler(new FestivalEventHandler())
    this.eventSystem.registerHandler(new IdleEventHandler())
  }

  /**
   * 启动应用
   */
  start(): void {
    if (this.isRunning) {
      console.warn('应用已经在运行中')
      return
    }

    try {
      // 注册事件处理器
      if (this.enableDebugEvents) {
        this.eventSystem.registerDebugEvents()
      }

      this.registerHandlers()

      // 启动事件模块
      this.eventModules.forEach((module) => module.start())

      this.isRunning = true
    } catch (error) {
      console.error('应用启动失败:', error)
      throw error
    }
  }

  /**
   * 停止应用
   */
  stop(): void {
    if (!this.isRunning) {
      console.warn('应用未在运行中')
      return
    }

    try {
      // 停止事件模块
      this.eventModules.forEach((module) => module.stop())

      this.isRunning = false
    } catch (error) {
      console.error('应用停止失败:', error)
    }
  }

  /**
   * 获取应用状态
   */
  getStatus(): { isRunning: boolean; activeModules: number } {
    return {
      isRunning: this.isRunning,
      activeModules: this.eventModules.length,
    }
  }

  /**
   * 手动触发事件（用于测试）
   */
  triggerEvent(event: string): void {
    this.eventCenter.emit(event)
  }
}
