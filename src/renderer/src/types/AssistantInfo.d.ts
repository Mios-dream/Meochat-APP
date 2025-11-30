interface GSVSetting {
  // 助手语音合成的语言
  textLang: string
  // 助手语音合成的GPT模型
  gptModelPath: string
  // 助手语音合成的SOVITS模型
  sovitsModelPath: string
  // 助手语音合成的参考音频
  refAudioPath: string
  // 助手语音合成的参考文字
  promptText: string
  // 助手语音合成的参考文字语言
  promptLang: string
  // 助手语音合成的随机种子
  seed: number
  // 助手语音合成的TopK
  topK: number
  // 助手语音合成的批量大小
  batchSize: number
  // 助手语音合成的额外参数
  extra: Record<string, string>
  // 助手语音合成的额外参考音频
  extraRefAudio: Record<string, string>
}

// 助手设置模型
interface AssistantSettings {
  // 助手是否开启日记功能
  enableLongMemory: boolean
  // 助手是否开启日记功能的检索加强
  enableLongMemorySearchEnhance: boolean
  // 助手是否开启核心记忆功能
  enableCoreMemory: boolean
  // 助手日记功能的搜索阈值
  longMemoryThreshold: number
  // 助手是否开启世界书(知识库)功能
  enableLoreBooks: boolean
  // 助手世界书(知识库)功能的搜索阈值
  loreBooksThreshold: number
  // 助手世界书(知识库)功能的搜索深度
  loreBooksDepth: number
  // 助手是否开启情绪系统
  enableEmotionSystem: boolean
  // 助手是否开启情绪系统的持续存储
  enableEmotionPersist: boolean
  // 助手的上下文长度
  contextLength: number
}

interface AssistantInfo {
  // 助手名称
  name: string
  // 对用户的称呼
  user: string
  // 头像
  avatar: string
  // 生日
  birthday: string
  // 身高
  height: number | string
  // 体重
  weight: number | string
  // 角色性格
  personality: string
  // 描述
  description: string
  // 用户的设定，用于在提示词中填充用户的信息，进行个性化对话
  mask: string
  // 初次相遇时间，存储为时间戳
  firstMeetTime: number
  // 好感度
  love: number
  // 对话案例
  messageExamples: string[]
  // 额外描述
  extraDescription: string
  // 更新,存储为时间戳
  updatedAt: number
  // 资产最后修改时间,存储为时间戳
  assetsLastModified: number
  // 自定义提示词
  customPrompt: string
  // 开场白，数组形式
  startWith: string[]
  // 助手设置
  settings: AssistantSettings
  // 助手GSV设置
  gsvSetting: GSVSetting
}

// 助手资产配置
interface AssistantAssets {
  // 助手名称（用于关联）
  assistantName: string
  // 角色立绘列表
  characterImages: string
  // Live2D模型设置
  live2d: {
    // Live2D模型路径
    modelPath: string
    // Live2D模型配置文件路径
    modelJsonPath: string
  }
}

export { AssistantInfo, AssistantAssets }
