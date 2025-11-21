import { useConfigStore } from '../stores/useConfigStore'

interface AssistantInfo {
  // 名字
  name: string
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
  // 初次相遇时间，存储为时间戳
  firstMeetTime?: number
  // 好感度
  love?: number
  // 对话案例
  conversationExamples?: string[]
  // 额外描述
  extraDescription?: string
  // 更新,存储为时间戳
  updatedAt?: number
  // 资产最后修改时间,存储为时间戳
  assetsLastModified?: number
}

const DEFAULT_ASSISTANTS: AssistantInfo[] = [
  {
    name: '澪',
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
    conversationExamples: [],
    extraDescription: '',
    updatedAt: new Date('2022-03-15').getTime(),
    assetsLastModified: new Date('2022-03-15').getTime()
  }
]

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
    // 从云端加载助手数据
    const cloudAssistants = await window.api.loadAssistantData()
    // 合并助手数据
    // this.assistants = [...DEFAULT_ASSISTANTS, ...cloudAssistants]
    this.assistants = [...cloudAssistants]

    if (this.assistants.length === 0) {
      this.assistants = DEFAULT_ASSISTANTS
    }
    this.setCurrentAssistant(this.configStore.config.currentAssistant)
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
  public setCurrentAssistant(name: string): void {
    this.currentAssistant = this.getAssistantInfo(name)
    this.configStore.updateConfig('currentAssistant', name)
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

  public async deleteAssistant(name: string): Promise<boolean> {
    // 发送IPC消息删除助手数据
    const status = await window.api.deleteAssistant(name)
    if (status) {
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

      // 监控助手资源下载进度
      // window.api.ipcRenderer.on('assistant:download-progress', (_event, data) => {
      //   console.log(`助手资源下载进度: ${data.assistantName} - ${data.progress}%`)
      // })

      console.log(`助手资源${assistantName}下载和解压完成`)
    } catch (error) {
      console.error(`下载助手资源失败: ${error instanceof Error ? error.message : String(error)}`)
      throw error
    }
  }
}

export { AssistantManager, type AssistantInfo }
