// 修改导入路径为相对路径
import { AssistantAssets, AssistantInfo } from '../types/AssistantInfo'

class AssistantManager {
  private static instance: AssistantManager

  private assistants: AssistantInfo[] = []

  private currentAssistant: AssistantInfo | null = null

  public static getInstance(): AssistantManager {
    if (!AssistantManager.instance) {
      AssistantManager.instance = new AssistantManager()
    }
    return AssistantManager.instance
  }

  /**
   * 初始化助手服务
   */
  public async initialize(): Promise<void> {
    // 从主进程加载助手列表
    await this.loadAssistants()
    // 加载当前助手信息
    const response = await window.api.getCurrentAssistant()
    if (response.success && response.data) {
      this.currentAssistant = response.data
    }
    // 初始化事件监听器
    this.initListeners()
  }

  public initListeners(): void {
    // 监听助手数据更新
    window.api.onAssistantSwitched((assistant) => {
      this.currentAssistant = assistant || null
    })
  }

  /**
   * 从主进程加载最新助手数据
   */
  public async loadAssistants(): Promise<void> {
    // 使用preload中暴露的方法
    const cloudAssistants = await window.api.loadAssistantData()
    this.assistants = cloudAssistants || []
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
    // 使用preload中暴露的方法
    const result = await window.api.switchAssistant(name)

    if (result.success) {
      // 更新当前助手信息
      this.currentAssistant = result.data
    } else {
      console.error('同步助手失败:', result.error)
    }
  }

  /**
   * 获取当前助手信息
   * @returns 当前助手信息,没有则返回null
   */
  public getCurrentAssistant(): AssistantInfo | null {
    return this.currentAssistant
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
      // 使用preload中暴露的方法
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
    // 设置上传进度监听器 - 使用preload中暴露的方法
    const progressCallback = (data: { assistantName: string; progress: number }): void => {
      console.log(`上传进度: ${data.progress}%`)
      if (data.assistantName === assistant.name) {
        // 这里可以触发一个事件，让UI组件更新进度条
        console.log(`上传进度: ${data.progress}%`)
      }
    }

    window.api.onUploadProgress(progressCallback)

    // 发送IPC消息保存助手数据 - 使用preload中暴露的方法
    const status = await window.api.addAssistant(assistant)
    await this.loadAssistants()
    window.api.ipcRenderer.removeAllListeners('assistant:upload-progress')

    if (status.success) {
      return true
    } else {
      console.error('添加助手失败:', status.error)
      return false
    }
  }

  public async deleteAssistant(name: string): Promise<{ success: boolean; message?: string }> {
    // 使用preload中暴露的方法
    const result = await window.api.deleteAssistant(name)
    await this.loadAssistants()
    // 加载当前助手信息
    const response = await window.api.getCurrentAssistant()
    if (response.success && response.data) {
      this.currentAssistant = response.data
    }
    return result
  }

  /**
   * 更新助手信息
   * @param assistant 助手信息
   */
  public async updateAssistant(
    assistant: AssistantInfo
  ): Promise<{ success: boolean; error?: string }> {
    // 使用preload中暴露的方法
    const result = await window.api.updateAssistant(assistant)
    await this.loadAssistants()
    return result
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
      // 使用preload中暴露的方法，它已经包含了进度监听的处理
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

  /**
   * 获取当前助手的资产配置
   * @returns 助手资产配置,没有则返回null
   */
  public async getAssistantAssets(): Promise<AssistantAssets | null> {
    if (this.currentAssistant) {
      return this.getAssistantAssetsByName(this.currentAssistant.name)
    } else {
      console.error('当前没有选择助手')
      return null
    }
  }

  public async getAssistantAssetsByName(assistantName: string): Promise<AssistantAssets | null> {
    // 使用preload中暴露的方法
    const response = await window.api.getAssistantAssets(assistantName)
    if (response.success) {
      return response.data
    } else {
      console.error('获取助手资产配置失败:', response.error)
      return null
    }
  }

  /**
   * 保存助手资产配置
   * @param assets 助手资产配置
   * @returns 是否保存成功
   */
  public async saveAssistantAssets(assets: AssistantAssets): Promise<boolean> {
    // 使用preload中暴露的方法
    const response = await window.api.saveAssistantAssets(assets)
    if (response.success) {
      return true
    } else {
      console.error('保存助手资产配置失败:', response.error)
      return false
    }
  }
}

export { AssistantManager, type AssistantAssets, type AssistantInfo }
