import { AssistantAssets, AssistantInfo } from '@shared/types/assistantTypes'

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
    const response = await window.api.assistant.getCurrentAssistant()
    if (response.success && response.data) {
      return response.data
    }
    return null
  }

  /**
   * 获取所有助手信息（从主进程内存直接读取）
   * @returns 助手信息数组
   */
  public async getAssistants(): Promise<AssistantInfo[]> {
    const result = await window.api.assistant.getAllAssistants()
    if (result?.success && result.data) {
      return result.data
    }
    return []
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
    const result = await window.api.assistant.switchAssistant(name)
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
    const status = await window.api.assistant.addAssistant(assistant, options)
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
    return window.api.assistant.onUploadProgress(callback)
  }

  /**
   * 删除助手
   * @param name 助手名称
   * @returns 删除结果
   */
  public async deleteAssistant(name: string): Promise<{ success: boolean; message?: string }> {
    return await window.api.assistant.deleteAssistant(name)
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
    return await window.api.assistant.updateAssistant(assistant, options)
  }

  /**
   * 强制刷新助手数据（云端同步 + 资源完整性检查）
   *
   * 触发主进程以云端为准重新同步全部助手数据（好感度等云端字段会随之回流），
   * 并在后台检查、下载缺失的助手资源。同步完成后主进程会广播
   * assistant:data-updated 事件，前端页面据此被动更新列表。
   *
   * @returns 是否成功发起刷新流程
   */
  public async refreshAssistantData(): Promise<boolean> {
    const result = await window.api.assistant.refreshAssistantData()
    if (result.success) {
      return true
    } else {
      console.error('刷新助手数据失败:', result.error)
      return false
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
    const response = await window.api.assistant.getAssistantAssets(assistantName)
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
    const response = await window.api.assistant.saveAssistantAssets(assets)
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
    return await window.api.assistant.importAssistantFromZip(zipPath)
  }
}

export { AssistantManager, type AssistantAssets, type AssistantInfo }
