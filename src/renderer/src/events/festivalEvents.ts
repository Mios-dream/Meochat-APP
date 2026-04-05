import { LLMRequest } from '@renderer/utils/LLMRequest'
import { AssistantManager } from '../services/assistantManager'
import { ContextManager } from '../services/InteractionSystem/core/context'
import { ActionDispatcher } from '../services/InteractionSystem/core/dispatcher'
import { EventModule } from '../services/InteractionSystem/types/eventModules'
import { IEventHandler } from '../services/InteractionSystem/types/IEventHandler'
import lunisolar from 'lunisolar'

// 节日事件处理器
class FestivalEventHandler implements IEventHandler {
  eventType = 'festival'
  private assistantManager: AssistantManager

  // 系统提示词模板
  private systemPrompt: string = `
  你是一个桌面助手，需要根据节日或节气生成自然、亲切的祝福语。
  可以结合节日特点、文化背景和助手人设，生成个性化的节日问候。

  对话示例：
  '新年快乐！愿新的一年里，我们的每一天都充满欢笑和惊喜！',
  '春节到了，愿我们像家人一样温暖相伴，共同迎接美好的春天！',
  '中秋月圆，愿我们的友谊也像这明月一样，永远明亮圆满！'

  当前情境：
  - 助手人设：{{personality}}
  - 节日类型：{{festivalType}}
  - 节日名称：{{festivalName}}
  - 节日特点：{{festivalDescription}}

  请生成一句【自然、亲切、符合节日氛围、不超过200字】的节日祝福语，要符合助手的人设和节日特点。
  `

  constructor() {
    this.assistantManager = AssistantManager.getInstance()
  }

  // 事件处理映射
  responseHandlers = {
    // 元旦节日
    'festival.newyear': async () => {
      return await this.generateFestivalMessage('元旦', '新年伊始，万象更新')
    },
    // 中国传统节日
    'festival.spring': async () => {
      return await this.generateFestivalMessage('春节', '农历新年，家人团聚的重要节日')
    },
    'festival.lantern': async () => {
      return await this.generateFestivalMessage('元宵节', '赏花灯、吃汤圆的传统节日')
    },
    'festival.qingming': async () => {
      return await this.generateFestivalMessage('清明节', '祭祖扫墓、缅怀先人的传统节日')
    },
    'festival.dragonboat': async () => {
      return await this.generateFestivalMessage('端午节', '纪念屈原、赛龙舟的传统节日')
    },
    'festival.midautumn': async () => {
      return await this.generateFestivalMessage('中秋节', '赏月、吃月饼的团圆节日')
    },
    'festival.double9': async () => {
      return await this.generateFestivalMessage('重阳节', '敬老爱老、登高祈福的传统节日')
    },
    // 西方节日
    'festival.valentine': async () => {
      return await this.generateFestivalMessage('情人节', '表达爱意和浪漫的节日')
    },
    'festival.christmas': async () => {
      return await this.generateFestivalMessage('圣诞节', '庆祝耶稣诞生的西方重要节日')
    },
    'festival.halloween': async () => {
      return await this.generateFestivalMessage('万圣节', '装扮、讨糖的西方传统节日')
    },
    'festival.thanksgiving': async () => {
      return await this.generateFestivalMessage('感恩节', '表达感谢和感恩的西方节日')
    },
    // 国际节日
    'festival.labor': async () => {
      return await this.generateFestivalMessage('劳动节', '庆祝劳动者贡献的国际节日')
    },
    'festival.children': async () => {
      return await this.generateFestivalMessage('儿童节', '关爱儿童、庆祝童年的节日')
    },
    'festival.teacher': async () => {
      return await this.generateFestivalMessage('教师节', '感谢老师辛勤付出的节日')
    },
    'festival.national': async () => {
      return await this.generateFestivalMessage('国庆节', '庆祝国家成立的重要节日')
    },
    // 其他节日
    'festival.fool': async () => {
      return await this.generateFestivalMessage('愚人节', '开玩笑、恶作剧的轻松节日')
    },
    // 母亲节和父亲节
    'festival.mother': async () => {
      return await this.generateFestivalMessage('母亲节', '感谢母亲养育之恩的节日')
    },
    'festival.father': async () => {
      return await this.generateFestivalMessage('父亲节', '感谢父亲辛勤付出的节日')
    },
    // 农历节日
    'festival.labafestival': async () => {
      return await this.generateFestivalMessage('腊八节', '喝腊八粥的传统节日')
    },
    'festival.littleyear': async () => {
      return await this.generateFestivalMessage('小年', '祭灶、扫尘，准备过年的节日')
    },
    // 七夕节和中元节
    'festival.qixi': async () => {
      return await this.generateFestivalMessage('七夕节', '中国的情人节，牛郎织女相会')
    },
    'festival.zhongyuan': async () => {
      return await this.generateFestivalMessage('中元节', '祭祖、缅怀先人的传统节日')
    }
  }

  async handle(
    event: string,
    contextManager: ContextManager,
    dispatcher: ActionDispatcher
  ): Promise<void> {
    const handler = this.responseHandlers[event]
    if (handler) {
      const context = contextManager.get()
      const message = await handler(context)

      if (message) {
        dispatcher.send({ text: message })
      }
    }
  }

  /**
   * 生成节日祝福消息
   * @param festivalName - 节日名称
   * @param festivalDescription - 节日描述
   * @returns 生成的祝福消息
   */
  private async generateFestivalMessage(
    festivalName: string,
    festivalDescription: string
  ): Promise<string | null> {
    const currentAssistant = this.assistantManager.getCurrentAssistant()
    const personality =
      currentAssistant?.description || currentAssistant?.customPrompt || '温柔可爱'

    // 构建提示词
    const prompt = this.buildPrompt(personality, '节日祝福', festivalName, festivalDescription)

    return await LLMRequest([{ role: 'user', content: prompt }])
  }

  /**
   * 构建提示词
   * @param personality - 助手人设
   * @param festivalType - 节日类型
   * @param festivalName - 节日名称
   * @param festivalDescription - 节日描述
   * @returns 构建后的提示词
   */
  private buildPrompt(
    personality: string,
    festivalType: string,
    festivalName: string,
    festivalDescription: string
  ): string {
    return this.systemPrompt
      .replace('{{personality}}', personality)
      .replace('{{festivalType}}', festivalType)
      .replace('{{festivalName}}', festivalName)
      .replace('{{festivalDescription}}', festivalDescription)
  }
}

// 节日事件模块
class FestivalEventModule extends EventModule {
  private festivalCheckTimer: NodeJS.Timeout | null = null

  start(): void {
    this.checkFestival()
  }

  stop(): void {
    if (this.festivalCheckTimer) {
      clearTimeout(this.festivalCheckTimer)
      this.festivalCheckTimer = null
    }
  }

  /**
   * 检查当前日期是否为中国传统节日
   */
  private checkFestival = (): void => {
    const now = new Date()
    const year = now.getFullYear()
    const month = now.getMonth() + 1
    const day = now.getDate()
    const dateStr = `${month}-${day}`

    // 检查固定日期节日
    switch (dateStr) {
      case '1-1': // 元旦
        this.eventCenter.emit('festival.newyear')
        break
      case '2-14': // 情人节
        this.eventCenter.emit('festival.valentine')
        break
      case '4-1': // 愚人节
        this.eventCenter.emit('festival.fool')
        break
      case '5-1': // 劳动节
        this.eventCenter.emit('festival.labor')
        break
      case '6-1': // 儿童节
        this.eventCenter.emit('festival.children')
        break
      case '9-10': // 教师节
        this.eventCenter.emit('festival.teacher')
        break
      case '10-1': // 国庆节
        this.eventCenter.emit('festival.national')
        break
      case '10-31': // 万圣节前夜
        this.eventCenter.emit('festival.halloween')
        break
      case '12-25': // 圣诞节
        this.eventCenter.emit('festival.christmas')
        break
    }

    // 检查母亲节（5月的第二个星期日）
    if (month === 5) {
      const motherDay = this.getNthSundayOfMonth(year, 5, 2)
      if (day === motherDay) {
        this.eventCenter.emit('festival.mother')
      }
    }

    // 检查父亲节（6月的第三个星期日）
    if (month === 6) {
      const fatherDay = this.getNthSundayOfMonth(year, 6, 3)
      if (day === fatherDay) {
        this.eventCenter.emit('festival.father')
      }
    }

    // 检查感恩节（11月的第四个星期四）
    if (month === 11) {
      const thanksgiving = this.getNthWeekdayOfMonth(year, 11, 4, 4) // 4=星期四
      if (day === thanksgiving) {
        this.eventCenter.emit('festival.thanksgiving')
      }
    }

    // 使用lunisolar库检查中国传统节日
    this.checkChineseFestivalsWithLunisolar(now)

    // 每12小时检查一次，提高响应速度
    this.festivalCheckTimer = setTimeout(this.checkFestival, 12 * 60 * 60 * 1000)
  }

  /**
   * 获取某月第N个星期日的日期
   * @param year 年份
   * @param month 月份
   * @param n 第n个
   * @returns 该月第n个星期日的日期
   */
  private getNthSundayOfMonth(year: number, month: number, n: number): number {
    return this.getNthWeekdayOfMonth(year, month, n, 0) // 0=星期日
  }

  /**
   * 获取某月第N个星期X的日期
   * @param year 年份
   * @param month 月份
   * @param n 第n个
   * @param weekday 星期几（0=星期日）
   * @returns 该月第n个星期X的日期
   */
  private getNthWeekdayOfMonth(year: number, month: number, n: number, weekday: number): number {
    const firstDay = new Date(year, month - 1, 1)
    const firstWeekday = firstDay.getDay()

    let offset = weekday - firstWeekday
    if (offset < 0) offset += 7

    return 1 + offset + (n - 1) * 7
  }

  /**
   * 使用lunisolar库检查中国传统节日
   * @param date 日期
   */
  private checkChineseFestivalsWithLunisolar(date: Date): void {
    const lsr = lunisolar(date)
    const lunarMonth = lsr.lunar.month
    const lunarDay = lsr.lunar.day
    const solarTerm = lsr.solarTerm?.name

    // 春节（农历正月初一）
    if (lunarMonth === 1 && lunarDay === 1) {
      this.eventCenter.emit('festival.spring')
    }

    // 元宵节（农历正月十五）
    if (lunarMonth === 1 && lunarDay === 15) {
      this.eventCenter.emit('festival.lantern')
    }

    // 清明节（节气）
    if (solarTerm === '清明') {
      this.eventCenter.emit('festival.qingming')
    }

    // 端午节（农历五月初五）
    if (lunarMonth === 5 && lunarDay === 5) {
      this.eventCenter.emit('festival.dragonboat')
    }

    // 七夕节（农历七月初七）
    if (lunarMonth === 7 && lunarDay === 7) {
      this.eventCenter.emit('festival.qixi')
    }

    // 中元节（农历七月十五）
    if (lunarMonth === 7 && lunarDay === 15) {
      this.eventCenter.emit('festival.zhongyuan')
    }

    // 中秋节（农历八月十五）
    if (lunarMonth === 8 && lunarDay === 15) {
      this.eventCenter.emit('festival.midautumn')
    }

    // 重阳节（农历九月初九）
    if (lunarMonth === 9 && lunarDay === 9) {
      this.eventCenter.emit('festival.double9')
    }

    // 腊八节（农历腊月初八）
    if (lunarMonth === 12 && lunarDay === 8) {
      this.eventCenter.emit('festival.labafestival')
    }

    // 小年（农历腊月二十三或二十四）
    if (lunarMonth === 12 && (lunarDay === 23 || lunarDay === 24)) {
      this.eventCenter.emit('festival.littleyear')
    }

    // 检查节气
    this.checkSolarTerms(solarTerm)
  }
  /**
   * 检查节气
   * @param solarTerm 节气名称
   */
  private checkSolarTerms(solarTerm: string | undefined): void {
    if (!solarTerm) return

    const solarTermMessages: Record<string, string> = {
      立春: '🌱 立春到了，万物复苏，新的一年开始了！',
      雨水: '💧 雨水节气，春雨贵如油，愿你的生活滋润美好！',
      惊蛰: '⚡ 惊蛰时节，春雷始鸣，万物生机勃勃！',
      春分: '🌞 春分昼夜平分，愿你的生活也平衡美好！',
      清明: '🌿 清明时节，缅怀先人，珍惜当下！',
      谷雨: '🌧️ 谷雨节气，雨生百谷，愿你的努力都有收获！',
      立夏: '☀️ 立夏到了，夏天正式开始，注意防暑哦！',
      小满: '🌾 小满节气，麦类等夏熟作物籽粒开始饱满！',
      芒种: '🌾 芒种时节，忙着种，忙着收，愿你的付出都有回报！',
      夏至: '🔥 夏至日最长，愿你的快乐也最长！',
      小暑: '🌡️ 小暑来临，天气开始炎热，注意防暑降温！',
      大暑: '🔥 大暑最热，愿你的热情也像这天气一样热烈！',
      立秋: '🍂 立秋到了，秋天开始，天气逐渐凉爽！',
      处暑: '🌬️ 处暑节气，暑气渐消，秋意渐浓！',
      白露: '💧 白露时节，露水凝结，天气转凉！',
      秋分: '🌕 秋分昼夜平分，愿你的生活也平衡美好！',
      寒露: '❄️ 寒露节气，露水寒冷，注意保暖！',
      霜降: '🌨️ 霜降时节，天气更冷，霜开始出现！',
      立冬: '⛄ 立冬到了，冬天正式开始，注意保暖！',
      小雪: '❄️ 小雪节气，开始下雪，愿你的生活也纯净美好！',
      大雪: '🌨️ 大雪纷飞，注意防寒保暖！',
      冬至: '🥟 冬至到了，吃饺子防冻耳，愿你的冬天温暖如春！',
      小寒: '🧊 小寒节气，天气寒冷，注意保暖！',
      大寒: '❄️ 大寒最冷，春天不远了，坚持就是胜利！'
    }

    if (solarTermMessages[solarTerm]) {
      // 可以在这里发送节气消息，或者记录日志
      console.log(`节气提醒: ${solarTerm} - ${solarTermMessages[solarTerm]}`)
    }
  }
}

export { FestivalEventHandler, FestivalEventModule }
