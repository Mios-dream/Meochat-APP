import { useConfigStore } from '../stores/useConfigStore'

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

const DEFAULT_ASSISTANTS: AssistantInfo[] = [
  {
    name: '澪',
    user: '阁下',
    avatar: '',
    birthday: '2022-03-15',
    height: 160,
    weight: 40,
    description: `银发红瞳的可爱少女，经常穿着可爱的黑色长 裙，带着黑色的蝴蝶发饰。身份是澪之梦工作
                室的头号看板娘，她自己好像也非常自豪这 件事（才没有）。性格天真可爱（是个笨蛋）
                同时还是有些小腹黑？尽管澪大部分时候都是 活泼可爱的代名词，但有时候澪的眼中也会流
                露出淡淡的悲伤。原因就连她自己也不知道， 这或许和她以前的经历有关？这位天真可爱的
                女孩并不像看起来那么简单，她的身上还有更 多的秘密等待着阁下的探索.......`,
    firstMeetTime: new Date('2022-03-15').getTime(),
    love: 0,
    personality: '天真可爱',
    messageExamples: [],
    extraDescription: '',
    updatedAt: new Date('2022-03-15').getTime(),
    assetsLastModified: new Date('2022-03-15').getTime(),
    mask: '',
    customPrompt: '',
    startWith: [],
    settings: {
      enableLongMemory: true,
      enableLongMemorySearchEnhance: true,
      enableCoreMemory: true,
      longMemoryThreshold: 0.5,
      enableLoreBooks: true,
      loreBooksThreshold: 0.5,
      loreBooksDepth: 3,
      enableEmotionSystem: false,
      enableEmotionPersist: false,
      contextLength: 40
    },
    gsvSetting: {
      textLang: 'zh',
      gptModelPath: 'models/【萝莉】女仆_Ver-1.4-e15.ckpt',
      sovitsModelPath: 'models/【萝莉】女仆_Ver-1.4_e24_s504.pth',
      refAudioPath: 'models/tmp/020.wav',
      promptText: '嗯，谢谢您的夸奖，主人可以喜欢就好。',
      promptLang: 'zh',
      seed: -1,
      topK: 30,
      batchSize: 20,
      extra: {
        text_split_method: 'cut0'
      },
      extraRefAudio: {}
    }
  }
]

function createNullAssistant(): AssistantInfo {
  return {
    name: '',
    user: '',
    avatar: '',
    birthday: new Date().toISOString().split('T')[0],
    height: 0,
    weight: 0,
    description: '',
    firstMeetTime: 0,
    love: 0,
    personality: '',
    messageExamples: [],
    extraDescription: '',
    updatedAt: 0,
    assetsLastModified: 0,
    mask: '',
    customPrompt: '',
    startWith: [],
    settings: {
      enableLongMemory: true,
      enableLongMemorySearchEnhance: true,
      enableCoreMemory: true,
      longMemoryThreshold: 0.38,
      enableLoreBooks: true,
      loreBooksThreshold: 0.5,
      loreBooksDepth: 3,
      enableEmotionSystem: false,
      enableEmotionPersist: false,
      contextLength: 40
    },
    gsvSetting: {
      textLang: '',
      gptModelPath: '',
      sovitsModelPath: '',
      refAudioPath: '',
      promptText: '',
      promptLang: '',
      seed: -1,
      topK: 30,
      batchSize: 20,
      extra: {
        text_split_method: 'cut0'
      },
      extraRefAudio: {}
    }
  }
}

class AssistantManager {
  private static instance: AssistantManager

  private assistants: AssistantInfo[] = []

  private currentAssistant: AssistantInfo | null = null

  private configStore = useConfigStore()

  constructor() {
    this.assistants = DEFAULT_ASSISTANTS
  }

  public static getInstance(): AssistantManager {
    if (!AssistantManager.instance) {
      AssistantManager.instance = new AssistantManager()
    }
    return AssistantManager.instance
  }

  /**
   * 从云端和本地加载助手数据
   */
  public async loadAssistants(): Promise<void> {
    try {
      // 1. 首先尝试从服务器获取当前助手
      const currentAssistantResponse = await window.api.getCurrentAssistant()
      let serverCurrentAssistant: AssistantInfo | null = null

      if (currentAssistantResponse.success && currentAssistantResponse.data) {
        serverCurrentAssistant = currentAssistantResponse.data
      }

      // 2. 加载所有助手数据
      const cloudAssistants = await window.api.loadAssistantData()
      // 合并助手数据
      this.assistants = [...cloudAssistants]

      if (this.assistants.length === 0) {
        this.assistants = DEFAULT_ASSISTANTS
      }

      // 3. 设置当前助手：优先使用服务器返回的当前助手，如果没有则使用配置中的，最后使用第一个助手
      if (serverCurrentAssistant) {
        // 如果服务器返回的助手在本地存在，则使用它
        if (this.getAssistantInfo(serverCurrentAssistant.name)) {
          this.setCurrentAssistant(serverCurrentAssistant.name)
        } else {
          // 否则使用本地配置或第一个助手
          this.setCurrentAssistant(
            this.configStore.config.currentAssistant || this.assistants[0]?.name
          )
        }
      } else {
        // 服务器获取失败，使用本地配置或第一个助手
        this.setCurrentAssistant(
          this.configStore.config.currentAssistant || this.assistants[0]?.name
        )
      }
    } catch (error) {
      console.error('加载助手数据失败:', error)
      // 加载失败时，使用本地数据
      if (this.assistants.length === 0) {
        this.assistants = DEFAULT_ASSISTANTS
      }
      this.setCurrentAssistant(this.configStore.config.currentAssistant || this.assistants[0]?.name)
    }
  }

  /**
   * 获取当前助手信息
   * @param name 助手名称
   * @returns 助手信息或 null
   */
  public getAssistantInfo(name: string): AssistantInfo | null {
    const assistant = this.assistants.find((assistant) => assistant.name === name)
    if (!assistant) {
      return null
    }
    return assistant
  }

  /**
   * 设置当前助手
   * @param name 助手名称
   */
  public async setCurrentAssistant(name: string): Promise<void> {
    // 1. 先更新本地状态
    const assistant = this.getAssistantInfo(name)
    if (assistant) {
      // 2. 发送切换请求到服务器同步
      const result = await window.api.switchAssistant(name)
      if (result.success) {
        this.currentAssistant = assistant
        this.configStore.updateConfig('currentAssistant', name)
      } else {
        this.currentAssistant = this.getAssistantInfo(name)
        this.configStore.updateConfig('currentAssistant', name)
        console.error('同步助手失败:', result.error)
      }
    } else {
      console.error('助手不存在:', name)
    }
  }

  /**
   * 获取当前助手信息
   * @returns 当前助手信息,没有则返回默认信息
   */
  public getCurrentAssistant(): AssistantInfo {
    return (
      this.assistants.find((assistant) => assistant.name === this.currentAssistant?.name) ||
      this.assistants[0]
    )
  }

  /**
   * 获取所有助手信息
   * @returns 助手信息数组
   */
  public getAssistants(): AssistantInfo[] {
    return this.assistants
  }

  /** * 检查助手是否需要更新
   * @param assistant 助手信息
   * @returns 是否需要更新
   */
  public async isNeedsUpdate(assistant: AssistantInfo): Promise<boolean> {
    try {
      return await window.api.isNeedUpdate(assistant)
    } catch {
      return false
    }
  }

  /**
   * 添加助手
   * @param assistant 助手信息
   */
  public async addAssistant(assistant: AssistantInfo): Promise<boolean> {
    // 设置上传进度监听器
    window.api.onUploadProgress((data) => {
      console.log(`上传进度: ${data.progress}%`)
      if (data.assistantName === assistant.name) {
        // 这里可以触发一个事件，让UI组件更新进度条
        console.log(`上传进度: ${data.progress}%`)
        // 例如：this.emit('uploadProgress', { name: assistant.name, progress })
      }
    })

    // 发送IPC消息保存助手数据
    const status = await window.api.addAssistant(assistant)
    if (!status) {
      console.error('Failed to save assistant data')
    } else {
      this.assistants.push(assistant)
    }
    return status
  }

  public async deleteAssistant(name: string): Promise<{ success: boolean; message?: string }> {
    // 发送IPC消息删除助手数据
    const status = await window.api.deleteAssistant(name)
    if (status.success) {
      this.assistants = this.assistants.filter((assistant) => assistant.name !== name)
      // 如果删除的是当前助手，切换到第一个助手
      if (this.currentAssistant && this.currentAssistant.name === name) {
        this.currentAssistant = this.assistants.length > 0 ? this.assistants[0] : null
      }
    }
    return status
  }

  /**
   * 更新助手信息
   * @param assistant 助手信息
   */
  public async updateAssistant(assistant: AssistantInfo): Promise<boolean> {
    // 发送IPC消息更新助手数据
    const status = await window.api.updateAssistantInfo(assistant)

    if (status) {
      const index = this.assistants.findIndex((a) => a.name === assistant.name)
      if (index !== -1) {
        this.assistants[index] = assistant
        // 如果更新的是当前助手，也更新当前助手信息
        if (this.currentAssistant && this.currentAssistant.name === assistant.name) {
          this.currentAssistant = assistant
        }
      }
    }
    return status
  }

  /**
   * 下载助手资源（zip文件）并解压到应用目录的助手文件夹
   * @param assistantName 助手名称
   * @param onProgress 下载进度回调函数 (可选)
   */
  public async downloadAssistantAsset(
    assistantName: string,
    onProgress?: (progress: number) => void
  ): Promise<void> {
    try {
      await window.api.downloadAssistantAsset({
        assistantName,
        onProgress
      })

      console.log(`助手资源${assistantName}下载和解压完成`)
    } catch (error) {
      console.error(`下载助手资源失败: ${error instanceof Error ? error.message : String(error)}`)
      throw error
    }
  }
}

export { AssistantManager, type AssistantInfo, createNullAssistant }
