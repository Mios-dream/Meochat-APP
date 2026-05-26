import { ContextManager } from '@renderer/core/interaction/core/context'
import { InteractionPayloadBuilder } from '@renderer/core/interaction/tools/payloadBuilder'
import { IEventHandler } from '@renderer/core/interaction/types/IEventHandler'
import { EventModule } from '@renderer/core/interaction/types/eventModules'
import { InteractionEventPayload } from '@renderer/chat/ChatManager'
import { AssistantManager } from '@renderer/services/assistantManager'
import { InteractionEffect } from '@renderer/core/interaction/types/InteractionEffect'

/** 睡眠时间段配置 */
const SLEEP_TIME = { startHour: 22, endHour: 7 }
/** 睡眠状态检查间隔 (毫秒) */
const SLEEP_CHECK_INTERVAL = 60 * 1000
/** 梦话触发间隔配置 (毫秒) */
// const DREAM_TALK_INTERVAL = { min: 10 * 60 * 1000, max: 30 * 60 * 1000 }
const DREAM_TALK_INTERVAL = { min: 60 * 1000, max: 5 * 60 * 1000 }

/**
 * 睡眠事件模块
 * 在睡眠模式下触发梦话等特殊事件
 */
export class SleepEventModule extends EventModule {
  private sleeping = false
  private checkTimer: ReturnType<typeof setInterval> | null = null
  private dreamTalkTimer: ReturnType<typeof setTimeout> | null = null

  /**
   * 启动睡眠事件模块。
   * 初始化睡眠上下文，并按固定间隔检查当前时间是否需要进入或退出睡眠模式。
   */
  start(): void {
    if (this.checkTimer) return
    this.checkTimeAndToggle()
    this.checkTimer = setInterval(() => this.checkTimeAndToggle(), SLEEP_CHECK_INTERVAL)
  }

  /**
   * 停止睡眠事件模块。
   * 清理所有定时器，并在当前处于睡眠时发出退出睡眠事件。
   */
  stop(): void {
    if (this.checkTimer) {
      clearInterval(this.checkTimer)
      this.checkTimer = null
    }
    this.exitSleepMode()
  }

  /**
   * 根据当前时间切换睡眠状态。
   * 只负责状态流转，具体 Live2D 和 UI 表现由 SleepEventHandler 返回的 effects 执行。
   */
  private checkTimeAndToggle(): void {
    if (this.isSleepTime()) {
      this.enterSleepMode()
      return
    }

    this.exitSleepMode()
  }

  /**
   * 判断当前时间是否处于睡眠时间段。
   * 支持跨午夜的时间区间，例如 22:00 到次日 07:00。
   */
  private isSleepTime(): boolean {
    const now = new Date()
    const currentMinutes = now.getHours() * 60 + now.getMinutes()
    const startMinutes = SLEEP_TIME.startHour * 60
    const endMinutes = SLEEP_TIME.endHour * 60

    if (startMinutes > endMinutes) {
      return currentMinutes >= startMinutes || currentMinutes < endMinutes
    }
    return currentMinutes >= startMinutes && currentMinutes < endMinutes
  }

  /**
   * 进入睡眠模式。
   * 更新模块内部状态，并发出 sleep.enter 事件让处理器生成对应副作用。
   */
  private enterSleepMode(): void {
    if (this.sleeping) return

    this.sleeping = true
    this.startDreamTalkTimer()
    this.eventCenter.emit('sleep.enter', { sleepMode: this.sleeping })
  }

  /**
   * 退出睡眠模式。
   * 停止睡眠期间的定时任务，并发出 sleep.exit 事件让处理器恢复表现状态。
   */
  private exitSleepMode(): void {
    if (!this.sleeping) return

    this.sleeping = false
    this.stopDreamTalkTimer()
    this.eventCenter.emit('sleep.exit', { sleepMode: this.sleeping })
  }

  /**
   * 启动梦话定时器。
   * 梦话只在睡眠状态下调度，触发后会继续安排下一次梦话。
   */
  private startDreamTalkTimer(): void {
    this.stopDreamTalkTimer()
    this.scheduleNextDreamTalk()
  }

  /**
   * 停止梦话定时器。
   * 用于退出睡眠或重新调度前清理未触发的梦话任务。
   */
  private stopDreamTalkTimer(): void {
    if (this.dreamTalkTimer) {
      clearTimeout(this.dreamTalkTimer)
      this.dreamTalkTimer = null
    }
  }

  /**
   * 调度下一次梦话事件。
   * 只发出 sleep.talk 事件，具体对话内容由 SleepEventHandler 构建。
   */
  private scheduleNextDreamTalk(): void {
    if (!this.sleeping) return
    const { min, max } = DREAM_TALK_INTERVAL
    const interval = min + Math.random() * (max - min)

    this.dreamTalkTimer = setTimeout(() => {
      if (this.sleeping) {
        this.eventCenter.emit('sleep.talk')
        this.scheduleNextDreamTalk()
      }
    }, interval)
  }
}

/**
 * 睡眠事件处理器
 * 处理夜间唤醒和梦话事件
 */
export class SleepEventHandler implements IEventHandler {
  eventType = 'sleep'
  cooldownMs = 0

  responseHandlers: Record<
    string,
    (contextManager: ContextManager) => Promise<InteractionEventPayload | null>
  > = {
    'sleep.wakeup': async (contextManager) => {
      const assistant = AssistantManager.getInstance().getCurrentAssistant()
      return InteractionPayloadBuilder.buildEventPayload({
        event: 'sleep.wakeup',
        scene: `用户在深夜唤醒了正在睡觉的${assistant?.name}，${assistant?.name}被惊醒但很困，表现出困倦但还是回应用户`,
        context: contextManager.get(),
        maxLength: 30,
        fallback: '（迷迷糊糊）嗯...怎么了...'
      })
    },

    'sleep.talk': async (contextManager) => {
      const assistant = AssistantManager.getInstance().getCurrentAssistant()
      return InteractionPayloadBuilder.buildEventPayload({
        event: 'sleep.talk',
        scene: `${assistant?.name}正在睡觉，无意中说了一些梦话，语句可以不完整、逻辑跳跃`,
        context: contextManager.get(),
        maxLength: 20,
        fallback: '（梦呓）嗯...不要...',
        keepSleepEyes: true
      })
    }
  }

  /**
   * 将 sleep.* 事件转换为声明式副作用。
   * 睡眠进入和退出同时返回 Live2D 表现和聊天回复，梦话和唤醒返回聊天 effect。
   */
  async handle(event: string, contextManager: ContextManager): Promise<InteractionEffect[]> {
    if (event === 'sleep.enter') {
      const assistant = AssistantManager.getInstance().getCurrentAssistant()
      const chatPayload = InteractionPayloadBuilder.buildEventPayload({
        event: 'sleep.enter',
        scene: `${assistant?.name}看到夜深了，准备进入睡眠模式，用困倦和温柔的晚安语气,给${assistant?.user || '阁下'}说个晚安吧~`,
        context: contextManager.get(),
        maxLength: 30,
        fallback: '（打了个哈欠）阁下，夜深了，晚安...'
      })
      return [{ type: 'chat', payload: chatPayload }, { type: 'live2d.enterSleep' }]
    }

    if (event === 'sleep.exit') {
      const assistant = AssistantManager.getInstance().getCurrentAssistant()
      const chatPayload = InteractionPayloadBuilder.buildEventPayload({
        event: 'sleep.exit',
        scene: `${assistant?.name}从睡眠中醒来，表现出刚睡醒的慵懒和元气`,
        context: contextManager.get(),
        maxLength: 30,
        fallback: '（伸懒腰）早上好呀阁下...'
      })
      return [{ type: 'chat', payload: chatPayload }, { type: 'live2d.exitSleep' }]
    }

    const handler = this.responseHandlers[event]
    if (!handler) {
      return []
    }

    const result = await handler(contextManager)
    return result ? [{ type: 'chat', payload: result }] : []
  }
}
