import { AssistantAssets, AssistantInfo } from '../types/AssistantInfo'

export interface AssistantLoadResult {
  success: boolean
  error?: string
}

/**
 * 助手管理器
 * 移除渲染进程缓存，所有数据直接从主进程读取，确保数据一致性
 */
class AssistantManager {
  private static instance: AssistantManager

  public static getInstance(): AssistantManager {
    if (!AssistantManager.instance) {
      AssistantManager.instance = new AssistantManager()
    }
    return AssistantManager.instance
  }

  /**
   * 获取当前助手信息（每次都从主进程读取）
   * @returns 当前助手信息，没有则返回 null
   */
  public async getCurrentAssistant(): Promise<AssistantInfo | null> {
    const response = await window.api.getCurrentAssistant()
    if (response.success && response.data) {
      return response.data
    }
    return null
  }

  /**
   * 获取所有助手信息（每次都从主进程读取）
   * @returns 助手信息数组
   */
  public async getAssistants(): Promise<AssistantInfo[]> {
    const result = await window.api.loadAssistantData()
    return result.data || []
  }

  /**
   * 根据名称获取助手信息
   * @param name 助手名称
   * @returns 助手信息或 null
   */
  public async getAssistantInfo(name: string): Promise<AssistantInfo | null> {
    const assistants = await this.getAssistants()
    return assistants.find((assistant) => assistant.name === name) || null
  }

  /**
   * 设置当前助手
   * @param name 助手名称
   */
  public async setCurrentAssistant(name: string): Promise<void> {
    const result = await window.api.switchAssistant(name)
    if (!result.success) {
      console.error('同步助手失败:', result.error)
    }
  }

  /**
   * 添加助手
   * @param assistant 助手信息
   * @param options 可选配置，assetTypes 指定需要上传的资源类型（子目录名），为空则全量上传
   * @returns 是否添加成功
   */
  public async addAssistant(
    assistant: AssistantInfo,
    options?: { assetTypes?: string[] }
  ): Promise<boolean> {
    const status = await window.api.addAssistant(assistant, options)
    if (status.success) {
      return true
    } else {
      console.error('添加助手失败:', status.error)
      return false
    }
  }

  /**
   * 监听上传进度
   * @param callback 进度回调函数
   * @returns 取消监听函数
   */
  public onUploadProgress(
    callback: (data: { assistantName: string; progress: number }) => void
  ): () => void {
    return window.api.onUploadProgress(callback)
  }

  /**
   * 删除助手
   * @param name 助手名称
   * @returns 删除结果
   */
  public async deleteAssistant(name: string): Promise<{ success: boolean; message?: string }> {
    return await window.api.deleteAssistant(name)
  }

  /**
   * 更新助手信息
   * @param assistant 助手信息
   * @param options 选项（是否上传资产、指定上传的资源类型）
   * @returns 更新结果
   */
  public async updateAssistant(
    assistant: AssistantInfo,
    options?: { uploadAssets?: boolean; assetTypes?: string[] }
  ): Promise<{ success: boolean; error?: string }> {
    return await window.api.updateAssistant(assistant, options)
  }

  /**
   * 从云端刷新当前助手数据（好感度等）
   * @returns 刷新后的助手信息，失败返回 null
   */
  public async refreshCurrentAssistant(): Promise<AssistantInfo | null> {
    const result = await window.api.refreshCurrentAssistant()
    if (result.success && result.data) {
      return result.data
    }
    return null
  }

  /**
   * 下载助手资源（zip文件）并解压到应用目录的助手文件夹
   *
   * 支持按资源类型选择性下载：传入 assetTypes 数组时仅下载指定类型的资源，
   * 不传或传空数组则下载全部资源。
   *
   * @param assistantName 助手名称
   * @param onProgress 下载进度回调函数 (可选)
   * @param assetTypes 需要下载的资源类型列表（子目录名），为空则下载全部
   */
  public async downloadAssistantAsset(
    assistantName: string,
    onProgress?: (progress: number) => void,
    assetTypes: string[] = []
  ): Promise<void> {
    try {
      await window.api.downloadAssistantAsset({
        assistantName,
        assetTypes,
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
   * @returns 助手资产配置，没有则返回 null
   */
  public async getAssistantAssets(): Promise<AssistantAssets | null> {
    const currentAssistant = await this.getCurrentAssistant()
    if (currentAssistant) {
      return this.getAssistantAssetsByName(currentAssistant.name)
    } else {
      console.error('当前没有选择助手')
      return null
    }
  }

  /**
   * 根据名称获取助手资产配置
   * @param assistantName 助手名称
   * @returns 助手资产配置，失败返回 null
   */
  public async getAssistantAssetsByName(assistantName: string): Promise<AssistantAssets | null> {
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
    const response = await window.api.saveAssistantAssets(assets)
    if (response.success) {
      return true
    } else {
      console.error('保存助手资产配置失败:', response.error)
      return false
    }
  }

  /**
   * 从 zip 角色压缩包导入助手，并刷新本地助手列表。
   * @param zipPath zip 文件路径，压缩包内必须包含 info.yaml
   */
  public async importAssistantFromZip(
    zipPath: string
  ): Promise<{ success: true; data: AssistantInfo } | { success: false; error: string }> {
    return await window.api.importAssistantFromZip(zipPath)
  }
}

export { AssistantManager, type AssistantAssets, type AssistantInfo }
