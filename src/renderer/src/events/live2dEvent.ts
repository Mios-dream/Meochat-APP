import { ContextManager } from '../services/InteractionSystem/core/context'
import { ActionDispatcher } from '../services/InteractionSystem/core/dispatcher'
import { IEventHandler } from '../services/InteractionSystem/types/IEventHandler'
import { EventModule } from '../services/InteractionSystem/types/eventModules'
import { EventReplyGenerator } from '../services/InteractionSystem/eventReplyGenerator'
import { AssistantInfo } from '@renderer/types/AssistantInfo'
import { AssistantManager } from '@renderer/services/assistantManager'

// Live2d事件模块
export class Live2dEventModule extends EventModule {
  private isListening = false

  start(): void {
    if (this.isListening) {
      console.warn('Live2d事件模块已经在监听中')
      return
    }

    // this.setupLive2dEventListeners()
    this.isListening = true
    console.log('Live2d事件模块启动成功')
  }

  stop(): void {
    if (!this.isListening) {
      console.warn('Live2d事件模块未在监听中')
      return
    }

    // this.removeLive2dEventListeners()
    this.isListening = false
    console.log('Live2d事件模块已停止')
  }
}

// Live2d事件处理器
export class Live2dEventHandler implements IEventHandler {
  eventType = 'live2d'
  private replyGenerator: EventReplyGenerator
  private assistant: AssistantInfo | null

  constructor() {
    this.replyGenerator = new EventReplyGenerator()
    this.assistant = AssistantManager.getInstance().getCurrentAssistant()
  }

  responseHandlers = {
    'live2d.hit.body': async (contextManager: ContextManager) => {
      return await this.replyGenerator.generate({
        event: 'live2d.hit.body',
        scene: `${this.assistant?.user || '阁下'}点击了角色身体区域，属于轻互动`,
        context: contextManager.get(),
        maxLength: 50,
        fallback: '哎呀，阁下在摸哪里呢~'
      })
    },
    'live2d.hit.part.head': async (contextManager: ContextManager) => {
      return await this.replyGenerator.generate({
        event: 'live2d.hit.part.head',
        scene: `${this.assistant?.user || '阁下'}点击了角色头部，语气可亲昵但不要过激`,
        context: contextManager.get(),
        maxLength: 50,
        fallback: '阁下的手好温暖呢~'
      })
    },
    'live2d.hit.part.face': async (contextManager: ContextManager) => {
      return await this.replyGenerator.generate({
        event: 'live2d.hit.part.face',
        scene: `${this.assistant?.user || '阁下'}点击了角色脸部，表现轻微害羞或打趣`,
        context: contextManager.get(),
        maxLength: 50,
        fallback: '不要捏脸啦，会变形的！'
      })
    },
    'live2d.hit.part.hand': async (contextManager: ContextManager) => {
      return await this.replyGenerator.generate({
        event: 'live2d.hit.part.hand',
        scene: `${this.assistant?.user || '阁下'}点击了角色手部，可生成牵手或互动感回复`,
        context: contextManager.get(),
        maxLength: 50,
        fallback: '要牵手吗？'
      })
    },
    'live2d.hit.part.leg': async (contextManager: ContextManager) => {
      return await this.replyGenerator.generate({
        event: 'live2d.hit.part.leg',
        scene: `${this.assistant?.user || '阁下'}点击了角色腿部，保持轻松互动`,
        context: contextManager.get(),
        maxLength: 50,
        fallback: '不要挠痒痒啦！'
      })
    },
    'live2d.stroke.head.light': async (contextManager: ContextManager) => {
      return await this.replyGenerator.generate({
        event: 'live2d.stroke.head.light',
        scene: `${this.assistant?.user || '阁下'}轻柔抚摸角色头部，整体偏温柔治愈`,
        context: contextManager.get(),
        maxLength: 50,
        fallback: '好轻柔的摸头呀，心情都变好了。'
      })
    },
    'live2d.stroke.head.heavy': async (contextManager: ContextManager) => {
      return await this.replyGenerator.generate({
        event: 'live2d.stroke.head.heavy',
        scene: `${this.assistant?.user || '阁下'}较重力度抚摸头部，表达撒娇提醒更温柔`,
        context: contextManager.get(),
        maxLength: 50,
        fallback: '摸头可以，但请温柔一点点嘛。'
      })
    }
  }

  async handle(
    event: string,
    contextManager: ContextManager,
    dispatcher: ActionDispatcher
  ): Promise<void> {
    console.log(`收到Live2D事件: ${event}`)
    const handler = this.responseHandlers[event]
    if (handler) {
      const message = await handler(contextManager)
      if (message) {
        dispatcher.send({ text: message })
      }
    }
  }
}
