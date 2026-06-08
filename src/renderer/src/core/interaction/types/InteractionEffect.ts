import { InteractionEventPayload } from '@renderer/chat/ChatManager'

/**
 * 交互事件产生的副作用描述。
 * 事件处理器只返回这些声明式动作，具体执行交给 EffectDispatcher 统一处理。
 */
export type InteractionEffect = ChatEffect | Live2DEnterSleepEffect | Live2DExitSleepEffect

/**
 * 发送一条由事件生成的对话。
 */
export interface ChatEffect {
  type: 'chat'
  payload: InteractionEventPayload
  /** 事件图标配置，用于在台词板末尾显示对应图标。 */
  icon?: {
    path: string
  }
}

/**
 * 让 Live2D 模型进入睡眠表现状态。
 */
export interface Live2DEnterSleepEffect {
  type: 'live2d.enterSleep'
}

/**
 * 让 Live2D 模型退出睡眠表现状态。
 */
export interface Live2DExitSleepEffect {
  type: 'live2d.exitSleep'
}
