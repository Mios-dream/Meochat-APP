import { ContextManager } from '@renderer/core/interaction/core/context'
import { InteractionEventPayload } from '@renderer/services/ChatService'
import { ActionDispatcher } from '@renderer/core/interaction/core/dispatcher'
import { EventModule } from '@renderer/core/interaction/types/eventModules'
import { IEventHandler } from '@renderer/core/interaction/types/IEventHandler'
import { AssistantManager } from '../services/assistantManager'
import lunisolar from 'lunisolar'

class FestivalEventHandler implements IEventHandler {
  eventType = 'festival'
  cooldownMs: number = 5 * 60 * 60 * 1000 // 5 hours

  responseHandlers: Record<
    string,
    (contextManager: ContextManager) => Promise<InteractionEventPayload | null>
  > = {
    'festival.newyear': async () =>
      this.generateFestivalMessage('元旦', '新年伊始，万象更新，适合表达新年祝福和展望'),
    'festival.spring': async () =>
      this.generateFestivalMessage('春节', '农历新年，家人团聚的重要节日'),
    'festival.lantern': async () =>
      this.generateFestivalMessage('元宵节', '赏花灯、吃汤圆的传统节日'),
    'festival.qingming': async () =>
      this.generateFestivalMessage('清明节', '祭祖扫墓、缅怀先人的传统节日'),
    'festival.dragonboat': async () =>
      this.generateFestivalMessage('端午节', '纪念屈原、赛龙舟的传统节日'),
    'festival.midautumn': async () =>
      this.generateFestivalMessage('中秋节', '赏月、吃月饼的团圆节日'),
    'festival.double9': async () =>
      this.generateFestivalMessage('重阳节', '敬老爱老、登高祈福的传统节日'),
    'festival.valentine': async () =>
      this.generateFestivalMessage('情人节', '表达爱意和浪漫的节日'),
    'festival.christmas': async () =>
      this.generateFestivalMessage('圣诞节', '庆祝耶稣诞生的西方重要节日'),
    'festival.halloween': async () =>
      this.generateFestivalMessage('万圣节', '装扮、讨糖的西方传统节日'),
    'festival.thanksgiving': async () =>
      this.generateFestivalMessage('感恩节', '表达感谢和感恩的西方节日'),
    'festival.labor': async () =>
      this.generateFestivalMessage('劳动节', '庆祝劳动者贡献的国际节日'),
    'festival.children': async () =>
      this.generateFestivalMessage('儿童节', '关爱儿童、庆祝童年的节日'),
    'festival.teacher': async () =>
      this.generateFestivalMessage('教师节', '感谢老师辛勤付出的节日'),
    'festival.national': async () =>
      this.generateFestivalMessage('国庆节', '庆祝国家成立的重要节日'),
    'festival.fool': async () => this.generateFestivalMessage('愚人节', '开玩笑、恶作剧的轻松节日'),
    'festival.mother': async () => this.generateFestivalMessage('母亲节', '感谢母亲养育之恩的节日'),
    'festival.father': async () => this.generateFestivalMessage('父亲节', '感谢父亲辛勤付出的节日'),
    'festival.labafestival': async () =>
      this.generateFestivalMessage('腊八节', '喝腊八粥的传统节日'),
    'festival.littleyear': async () =>
      this.generateFestivalMessage('小年', '祭灶、扫尘，准备过年的节日'),
    'festival.qixi': async () =>
      this.generateFestivalMessage('七夕节', '中国的情人节，牛郎织女相会的节日'),
    'festival.zhongyuan': async () =>
      this.generateFestivalMessage('中元节', '祭祖、缅怀先人的传统节日'),
    'festival.moe': async () =>
      this.generateFestivalMessage('萌节', '二次元节日，庆祝可爱文化的节日，适合各种可爱事物'),
    'festival.mio': async () =>
      this.generateFestivalMessage(
        '澪的生日',
        '2020年的3月5日，第一个助手诞生了，是澪之梦工作室（这个助手软件的开发团队），梦开始的地方'
      ),
    'festival.assistantbirthday': async () => {
      const assistant = AssistantManager.getInstance().getCurrentAssistant()
      const assistantName = assistant?.name || '助手'
      return this.generateFestivalMessage(
        `${assistantName}的生日`,
        `今天�?{assistantName}的生日，这是一个属于助手自己的节日！为自己庆祝一下吧！`
      )
    }
  }

  async handle(
    event: string,
    contextManager: ContextManager,
    dispatcher: ActionDispatcher
  ): Promise<void> {
    const handler = this.responseHandlers[event]
    if (handler) {
      const result = await handler(contextManager)
      if (result) {
        await dispatcher.send(result)
      }
    }
  }

  private async generateFestivalMessage(
    festivalName: string,
    festivalDescription: string,
    context?: ReturnType<ContextManager['get']>
  ): Promise<InteractionEventPayload | null> {
    const result = ActionDispatcher.buildEventPayload({
      event: `festival.${festivalName}`,
      scene: `当前节日�?{festivalName}。节日描述：${festivalDescription}。请给出节日氛围感祝福。`,
      context: context || { lastInteraction: Date.now(), isBusy: false },
      maxLength: 100,
      fallback: `${festivalName}快乐，愿你今天也有好心情。`
    })
    return result
  }
}

class FestivalEventModule extends EventModule {
  private festivalCheckTimer: ReturnType<typeof setTimeout> | null = null
  private assistantManager = AssistantManager.getInstance()

  start(): void {
    this.checkFestival()
  }

  stop(): void {
    if (this.festivalCheckTimer) {
      clearTimeout(this.festivalCheckTimer)
      this.festivalCheckTimer = null
    }
  }

  private checkFestival = (): void => {
    const now = new Date()
    const year = now.getFullYear()
    const month = now.getMonth() + 1
    const day = now.getDate()
    const dateStr = `${month}-${day}`

    if (this.isCurrentAssistantBirthday(month, day)) {
      this.eventCenter.emit('festival.assistantbirthday')
    }

    switch (dateStr) {
      case '1-1':
        this.eventCenter.emit('festival.newyear')
        break
      case '2-14':
        this.eventCenter.emit('festival.valentine')
        break
      case '3-25':
        this.eventCenter.emit('festival.mio')
        break
      case '4-1':
        this.eventCenter.emit('festival.fool')
        break
      case '5-1':
        this.eventCenter.emit('festival.labor')
        break
      case '6-1':
        this.eventCenter.emit('festival.children')
        break
      case '9-10':
        this.eventCenter.emit('festival.teacher')
        break
      case '10-1':
        this.eventCenter.emit('festival.national')
        break
      case '10-10':
        this.eventCenter.emit('festival.moe')
        break
      case '10-31':
        this.eventCenter.emit('festival.halloween')
        break
      case '12-25':
        this.eventCenter.emit('festival.christmas')
        break
    }

    if (month === 5) {
      const motherDay = this.getNthSundayOfMonth(year, 5, 2)
      if (day === motherDay) {
        this.eventCenter.emit('festival.mother')
      }
    }

    if (month === 6) {
      const fatherDay = this.getNthSundayOfMonth(year, 6, 3)
      if (day === fatherDay) {
        this.eventCenter.emit('festival.father')
      }
    }

    if (month === 11) {
      const thanksgiving = this.getNthWeekdayOfMonth(year, 11, 4, 4)
      if (day === thanksgiving) {
        this.eventCenter.emit('festival.thanksgiving')
      }
    }

    this.checkChineseFestivalsWithLunisolar(now)

    this.festivalCheckTimer = setTimeout(this.checkFestival, 12 * 60 * 60 * 1000)
  }

  private isCurrentAssistantBirthday(todayMonth: number, todayDay: number): boolean {
    const birthday = this.assistantManager.getCurrentAssistant()?.birthday
    if (!birthday) {
      return false
    }

    const parsed = this.parseBirthdayMonthDay(birthday)
    if (!parsed) {
      return false
    }

    return parsed.month === todayMonth && parsed.day === todayDay
  }

  private parseBirthdayMonthDay(birthday: string): { month: number; day: number } | null {
    const text = birthday.trim()
    if (!text) {
      return null
    }

    const cnMatch = text.match(/(\d{1,2})\s*月\s*(\d{1,2})\s*日/)
    if (cnMatch) {
      const month = Number(cnMatch[1])
      const day = Number(cnMatch[2])
      return this.isValidMonthDay(month, day) ? { month, day } : null
    }

    const numberParts = text
      .split(/[^0-9]+/)
      .filter(Boolean)
      .map((part) => Number(part))
      .filter((num) => Number.isFinite(num))

    if (numberParts.length >= 2) {
      const month = numberParts.length >= 3 ? numberParts[numberParts.length - 2] : numberParts[0]
      const day = numberParts[numberParts.length - 1]
      return this.isValidMonthDay(month, day) ? { month, day } : null
    }

    return null
  }

  private isValidMonthDay(month: number, day: number): boolean {
    return month >= 1 && month <= 12 && day >= 1 && day <= 31
  }

  private getNthSundayOfMonth(year: number, month: number, n: number): number {
    return this.getNthWeekdayOfMonth(year, month, n, 0)
  }

  private getNthWeekdayOfMonth(year: number, month: number, n: number, weekday: number): number {
    const firstDay = new Date(year, month - 1, 1)
    const firstWeekday = firstDay.getDay()

    let offset = weekday - firstWeekday
    if (offset < 0) offset += 7

    return 1 + offset + (n - 1) * 7
  }

  private checkChineseFestivalsWithLunisolar(date: Date): void {
    const lsr = lunisolar(date)
    const lunarMonth = lsr.lunar.month
    const lunarDay = lsr.lunar.day
    const solarTerm = lsr.solarTerm?.name

    if (lunarMonth === 1 && lunarDay === 1) {
      this.eventCenter.emit('festival.spring')
    }

    if (lunarMonth === 1 && lunarDay === 15) {
      this.eventCenter.emit('festival.lantern')
    }

    if (solarTerm === '清明') {
      this.eventCenter.emit('festival.qingming')
    }

    if (lunarMonth === 5 && lunarDay === 5) {
      this.eventCenter.emit('festival.dragonboat')
    }

    if (lunarMonth === 7 && lunarDay === 7) {
      this.eventCenter.emit('festival.qixi')
    }

    if (lunarMonth === 7 && lunarDay === 15) {
      this.eventCenter.emit('festival.zhongyuan')
    }

    if (lunarMonth === 8 && lunarDay === 15) {
      this.eventCenter.emit('festival.midautumn')
    }

    if (lunarMonth === 9 && lunarDay === 9) {
      this.eventCenter.emit('festival.double9')
    }

    if (lunarMonth === 12 && lunarDay === 8) {
      this.eventCenter.emit('festival.labafestival')
    }

    if (lunarMonth === 12 && (lunarDay === 23 || lunarDay === 24)) {
      this.eventCenter.emit('festival.littleyear')
    }
  }
}

export { FestivalEventHandler, FestivalEventModule }
