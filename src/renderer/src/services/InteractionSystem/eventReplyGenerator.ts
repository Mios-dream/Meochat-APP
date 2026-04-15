import { AssistantManager } from '@renderer/services/assistantManager'
import { Context } from '@renderer/services/InteractionSystem/core/context'
import { LLMRequest } from '@renderer/utils/LLMRequest'

interface EventReplyRequest {
  // 事件
  event: string
  // 场景描述
  scene: string
  // 上下文信息
  context: Context
  // 回复的最大长度，超过后会自动截断并添加省略号
  maxLength?: number
  // 额外的回复规则，可以在生成提示词时添加
  extraRules?: string[]
  // 当生成失败时的备用回复
  fallback?: string
}

export class EventReplyGenerator {
  private assistantManager: AssistantManager

  constructor() {
    this.assistantManager = AssistantManager.getInstance()
  }

  async generate(request: EventReplyRequest): Promise<string | null> {
    const prompt = this.buildPrompt(request)
    const content = await LLMRequest([{ role: 'user', content: prompt }])
    const normalized = this.normalize(content)
    if (normalized) {
      return normalized
    }
    return request.fallback || null
  }

  private buildPrompt(request: EventReplyRequest): string {
    const assistant = this.assistantManager.getCurrentAssistant()
    const name = assistant?.name || '澪'
    const user = assistant?.user || '阁下'
    const personality = assistant?.personality || '温柔、亲切'
    const description = assistant?.description || assistant?.customPrompt || '桌面助手'
    const extraDescription = assistant?.extraDescription || '无'
    const examples = (assistant?.messageExamples || []).slice(0, 3).join('；') || '无'
    const maxLength = request.maxLength || 100
    const extraRules = (request.extraRules || []).map((rule) => `- ${rule}`).join('\n')

    return `
你是一个桌面助手，需要基于事件场景生成一句中文回复。

角色资料：
- 角色名：${name}
- 对用户称呼：${user}
- 人设性格：${personality}
- 角色描述：${description}
- 额外设定：${extraDescription}
- 对话参考：${examples}

事件信息：
- 事件名：${request.event}
- 场景描述：${request.scene}

上下文(JSON)：
${JSON.stringify(request.context, null, 2)}

输出要求：
- 只输出一句可直接展示的话，不要解释
- 自然、亲切、符合当前场景
- 保持角色口吻一致，不要脱离人设
- 不超过${maxLength}字
${extraRules}
`
  }

  private normalize(content: string | null): string | null {
    if (!content) {
      return null
    }

    let text = content.trim()
    text = text.replace(/^['"“”]+|['"“”]+$/g, '').trim()
    text = text.replace(/\s+/g, ' ')

    if (!text) {
      return null
    }

    return text
  }
}
