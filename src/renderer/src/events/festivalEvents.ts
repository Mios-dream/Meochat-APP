import { ContextManager } from '../server/InteractionSystem/core/context'
import { ActionDispatcher } from '../server/InteractionSystem/core/dispatcher'
import { EventModule } from '../server/InteractionSystem/types/eventModules'
import { IEventHandler } from '../server/InteractionSystem/types/IEventHandler'

// 节日事件处理器
class FestivalEventHandler implements IEventHandler {
  eventType = 'festival'

  responseHandlers = {
    'festival.newyear': () => '新年快乐！愿你今年好运连连！',
    'festival.christmas': () => '圣诞节快到了，愿你在这特殊的日子里，有更多的快乐和惊喜！'
  }

  handle(event: string, _contextManager: ContextManager, dispatcher: ActionDispatcher) {
    dispatcher.send({ text: this.responseHandlers[event] })
  }
}
// 节日事件模块
class FestivalEventModule extends EventModule {
  private festivalCheckTimer: NodeJS.Timeout | null = null

  start() {
    this.checkFestival()
  }

  stop() {
    if (this.festivalCheckTimer) {
      clearTimeout(this.festivalCheckTimer)
      this.festivalCheckTimer = null
    }
  }

  private checkFestival = () => {
    const now = new Date()
    const date = `${now.getMonth() + 1}-${now.getDate()}`

    if (date === '1-1') this.eventCenter.emit('festival.newyear')
    if (date === '12-25') this.eventCenter.emit('festival.christmas')

    // 每24小时检查一次
    this.festivalCheckTimer = setTimeout(this.checkFestival, 24 * 60 * 60 * 1000)
  }
}

export { FestivalEventHandler, FestivalEventModule }
