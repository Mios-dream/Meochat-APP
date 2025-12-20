import { ContextManager } from '../services/InteractionSystem/core/context'
import { ActionDispatcher } from '../services/InteractionSystem/core/dispatcher'
import { IEventHandler } from '../services/InteractionSystem/types/IEventHandler'
import { EventModule } from '../services/InteractionSystem/types/eventModules'

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

  responseHandlers = {
    "'live2d.click": async () => {
      return '阁下在摸我吗？'
    },
    'live2d.hit.body': async () => {
      const responses = [
        '哎呀，阁下在摸哪里呢~',
        '痒痒的，别闹啦！',
        '阁下真是的，突然摸人家...',
        '嘻嘻，被发现了呢~',
        '阁下今天心情不错嘛！'
      ]
      return responses[Math.floor(Math.random() * responses.length)]
    },
    'live2d.hit.part.head': async () => {
      const responses = [
        '摸头会长不高的啦！',
        '阁下的手好温暖呢~',
        '被摸头的感觉...还不错？',
        '哎呀，发型要乱了！',
        '阁下是在安慰我吗？'
      ]
      return responses[Math.floor(Math.random() * responses.length)]
    },
    'live2d.hit.part.face': async () => {
      const responses = [
        '脸...脸好红！',
        '阁下真是的，这么直接...',
        '不要捏脸啦，会变形的！',
        '呜...害羞死了...',
        '阁下的手好温柔呢~'
      ]
      return responses[Math.floor(Math.random() * responses.length)]
    },
    'live2d.hit.part.hand': async () => {
      const responses = [
        '要牵手吗？',
        '阁下的手好大呢~',
        '手牵手一起走吧！',
        '手有点凉呢，要暖暖吗？',
        '握手就是好朋友啦！'
      ]
      return responses[Math.floor(Math.random() * responses.length)]
    },
    'live2d.hit.part.leg': async () => {
      const responses = [
        '腿有点痒呢...',
        '阁下在检查我的腿吗？',
        '不要挠痒痒啦！',
        '腿有点酸呢，站了好久...',
        '阁下想跳舞吗？'
      ]
      return responses[Math.floor(Math.random() * responses.length)]
    }
  }

  async handle(
    event: string,
    _contextManager: ContextManager,
    dispatcher: ActionDispatcher
  ): Promise<void> {
    const handler = this.responseHandlers[event]
    if (handler) {
      const message = await handler()
      if (message) {
        dispatcher.send({ text: message })
      }
    }
  }
}
