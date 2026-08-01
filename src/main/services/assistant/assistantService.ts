import fs from 'fs'
import path from 'path'
import { globalShortcut, BrowserWindow, screen } from 'electron'
import { getConfig, setConfig } from '@main/config/configManager'
import log from '@main/utils/logger'
import { request } from '@shared/api/request'
import { AssistantAssets, AssistantBaseInfo, AssistantInfo } from '@shared/types/assistantTypes'
import { createWindow, chatBoxWindowConfig } from '@main/windows'
import { resolveAppDataDir } from '@/utils/pathResolve'
import { CHANNELS } from '@shared/ipc/channels'
import { AssistantAssetService } from './assistantAssetService'
import { AssistantImportService } from './assistantImportService'
import type { SwitchResult } from './assistantAssetService'

/**
 * 助手服务 - 管理助手的生命周期、数据同步与当前选中状态
 *
 * 职责：
 * - 助手列表的内存缓存与增删改查（CRUD）
 * - 云端与本地数据的单向同步（始终以云端数据为准，云端不可用时回退本地缓存）
 * - 当前助手的选择与切换
 * - 快捷键注册与管理
 *
 * 资源管理（下载/上传/检查/Live2D/资源文件）委托给 AssistantAssetService，
 * 角色包导入（zip/角色卡）委托给 AssistantImportService，本类负责编排与统一对外入口。
 */
class AssistantService {
  /** 单例实例 */
  private static instance: AssistantService

  /** 内存中的助手列表缓存 */
  private assistants: AssistantInfo[] = []
  /** 当前选中的助手引用 */
  private currentAssistant: AssistantInfo | null = null
  /** 后台同步进行中标志（防重入，避免并发触发多次同步） */
  private syncing = false
  /** 同步读取云端的超时时间（毫秒），短超时保证内核不可用时快速失败并保留本地缓存 */
  private static readonly CLOUD_SYNC_TIMEOUT = 5000

  /** 助手资源服务（资产下载/上传/检查等） */
  private readonly assets: AssistantAssetService
  /** 助手导入服务（zip 角色包/角色卡导入） */
  private readonly importer: AssistantImportService

  private constructor() {
    this.assistants = []
    // 注入核心能力，避免资源/导入服务与核心形成循环依赖
    this.assets = new AssistantAssetService({
      getAssistantsRootDir: () => this.getAssistantsRootDir(),
      resolveAssistantDir: (name, ensureExists) => this.resolveAssistantDir(name, ensureExists),
      getAssistantInfo: (name) => this.getAssistantInfo(name),
      getAssistants: () => this.assistants,
      getCurrentAssistant: () => this.currentAssistant,
      setCurrentAssistant: (name) => this.setCurrentAssistant(name),
      clearCurrentAssistant: () => {
        this.currentAssistant = null
        setConfig('currentAssistant', '')
      },
      saveAssistantToLocal: (assistant) => this.saveAssistantToLocal(assistant),
      broadcastDataUpdated: () => this.broadcastDataUpdated()
    })
    this.importer = new AssistantImportService({
      getAssistantInfo: (name) => this.getAssistantInfo(name),
      saveAssistantToLocal: (assistant) => this.saveAssistantToLocal(assistant),
      onImported: (assistant) => {
        this.assistants.push(assistant)
        this.broadcastDataUpdated()
      }
    })
  }

  /**
   * 获取 AssistantService 的单例实例。
   *
   * 使用懒加载模式，首次调用时创建实例，后续调用返回同一实例。
   * 确保整个应用中只有一个助手服务实例在运行。
   *
   * @returns AssistantService 单例实例
   */
  public static getInstance(): AssistantService {
    if (!AssistantService.instance) {
      AssistantService.instance = new AssistantService()
    }
    return AssistantService.instance
  }

  /**
   * 获取助手数据的根目录路径。
   *
   * 该目录位于应用数据目录下的 `assistants/` 子目录中，
   * 每个助手对应一个以助手名称命名的子目录。
   * 如果目录不存在会自动创建。
   *
   * @returns 助手根目录的绝对路径
   */
  private getAssistantsRootDir(): string {
    const assistantsRoot = path.join(resolveAppDataDir(), 'assistants')
    if (!fs.existsSync(assistantsRoot)) {
      fs.mkdirSync(assistantsRoot, { recursive: true })
    }
    return assistantsRoot
  }

  /**
   * 获取助手目录路径，可选确保目录存在。
   *
   * @param assistantName - 助手名称，将经过安全校验
   * @param ensureExists - 是否确保目录存在（默认 true），设为 false 时仅返回路径不创建目录
   * @returns 校验后的助手目录绝对路径
   * @throws 当名称非法或路径越界时抛出 Error
   */
  private resolveAssistantDir(assistantName: string, ensureExists = true): string {
    const assistantsRoot = this.getAssistantsRootDir()
    const assistantDir = path.join(assistantsRoot, assistantName)
    if (ensureExists && !fs.existsSync(assistantDir)) {
      fs.mkdirSync(assistantDir, { recursive: true })
    }
    return assistantDir
  }

  /**
   * 注册聊天框快捷键。
   *
   * 注册全局快捷键用于打开/关闭聊天框窗口。如果已有快捷键注册，会先注销旧的再注册新的。
   * 注册成功后会将快捷键配置持久化到应用配置中。
   *
   * @param shortcut - 快捷键字符串，遵循 Electron accelerator 格式（如 "CommandOrControl+Shift+K"）
   * @returns 注册是否成功。失败通常是因为快捷键已被其他应用占用
   */
  public registerChatShortcut(shortcut: string): boolean {
    // 注销原有快捷键
    const currentShortcut = getConfig('chatShortcut')
    if (currentShortcut) {
      globalShortcut.unregister(currentShortcut)
    }
    // 注册聊天框快捷键
    const success = globalShortcut.register(shortcut, () => {
      const primaryDisplay = screen.getPrimaryDisplay()
      const { width: screenWidth, height: screenHeight } = primaryDisplay.workAreaSize

      // 计算窗口尺寸和位置
      const windowWidth = Math.floor(screenWidth / 2)
      const windowHeight = 200
      const x = Math.floor((screenWidth - windowWidth) / 2)
      // 距离底部抬升
      const targetY = screenHeight - 200 // 目标位置

      createWindow(chatBoxWindowConfig, {
        overrides: {
          x: x,
          y: targetY,
          width: windowWidth,
          height: windowHeight
        },
        showImmediately: true
      })
    })
    if (success) {
      setConfig('chatShortcut', shortcut)
    }
    return success
  }

  /**
   * 加载助手数据（本地缓存秒开 + 后台云端同步）。
   *
   * 加载流程（本地优先，保证启动秒开与离线可用）：
   * 1. 读取本地磁盘缓存到内存，立即可用
   * 2. 后台异步执行云端同步（以云端数据为准覆盖本地，仅成功才落盘）
   * 3. 后台异步检查并下载缺失资源（不阻塞返回）
   *
   * @param onProgress - 可选的进度回调，用于向渲染进程报告资产下载进度
   *   回调参数：(assistantName: 当前处理的助手名, progress: 0-100 的进度百分比)
   * @returns 包含 success（是否成功）
   */
  public async loadAssistants(
    onProgress?: (assistantName: string, progress: number) => void
  ): Promise<{ success: boolean; error?: string }> {
    try {
      // 1. 本地缓存立即可用（离线时仅能浏览）
      this.assistants = Array.from(this.readLocalAssistants().values())
      this.currentAssistant = this.pickCurrent(this.assistants)

      // 2. 后台云端同步（不阻塞返回，云端不可用时保留本地缓存）
      void this.requestSync()

      // 3. 后台检查并下载缺失资源
      this.assets.checkAndDownloadAllAssistantsAssets(onProgress)

      return { success: true }
    } catch (error) {
      log.error('加载助手数据失败:', error)
      return { success: false, error: (error as Error).message }
    }
  }

  /**
   * 以云端为准后台同步助手数据（仅在显式时机触发）。
   *
   * 数据语义（云端权威，本地为只读缓存）：
   * 1. 远程可用：以云端数据为准整体覆盖内存缓存，并落盘 + 广播；
   * 2. 远程不可用：保留现有本地缓存，仅记录日志，下次触发再同步。
   *
   * 并发控制：通过 syncing 标志防重入，进行中的同步直接跳过。
   * 该方法是后台执行，不阻塞调用方。
   */
  private async requestSync(): Promise<void> {
    if (this.syncing) {
      return
    }
    this.syncing = true
    try {
      // 并行拉取云端助手列表与当前助手（短超时保证内核不可用时快速失败）
      const [listResponse, currentResponse] = await Promise.all([
        request.get('/api/assistants', { timeout: AssistantService.CLOUD_SYNC_TIMEOUT }),
        request.get('/api/assistant/current', { timeout: AssistantService.CLOUD_SYNC_TIMEOUT })
      ])

      const cloudAssistants: AssistantInfo[] = listResponse.data?.data ?? []
      const cloudCurrentName = (currentResponse.data?.data as AssistantInfo | null)?.name

      // 云端权威：整体覆盖本地缓存
      this.assistants = cloudAssistants
      this.currentAssistant = this.pickCurrent(cloudAssistants, cloudCurrentName)
      setConfig('currentAssistant', this.currentAssistant?.name ?? '')

      // 仅同步成功才落盘/删除本地目录，失败时保留本地缓存作为离线兜底
      this.persistAssistants(cloudAssistants)
      this.broadcastDataUpdated()

      log.info(`[AssistantSync] 云端同步完成，共 ${cloudAssistants.length} 个助手`)
    } catch (error) {
      // 远程不可用：保留本地缓存，下次显式触发再同步
      log.warn('[AssistantSync] 云端不可用，保留本地缓存:', (error as Error).message)
    } finally {
      this.syncing = false
    }
  }

  /**
   * 解析当前助手：云端当前 > 本地配置 > 列表第一个，均不满足时返回 null。
   *
   * @param assistants - 候选助手列表
   * @param cloudCurrentName - 云端记录的当前助手名称（可选）
   * @returns 解析出的当前助手
   */
  private pickCurrent(
    assistants: AssistantInfo[],
    cloudCurrentName?: string
  ): AssistantInfo | null {
    return (
      assistants.find((a) => a.name === cloudCurrentName) ??
      assistants.find((a) => a.name === getConfig('currentAssistant')) ??
      assistants[0] ??
      null
    )
  }

  /**
   * 向所有窗口广播助手数据更新事件。
   *
   * 携带完整的助手列表与当前助手信息，渲染进程通过
   * 'assistant:data-updated' 事件同步最新数据。
   */
  private broadcastDataUpdated(): void {
    BrowserWindow.getAllWindows().forEach((win) => {
      if (!win.isDestroyed()) {
        win.webContents.send(CHANNELS.ASSISTANT_DATA_UPDATED_EVENT, {
          assistants: [...this.assistants],
          currentAssistant: this.currentAssistant
        })
      }
    })
  }

  /**
   * 获取当前选中的助手信息（纯内存读取，永不触发网络）。
   *
   * 当前助手数据在加载与后台同步时更新，此处仅返回内存缓存。
   *
   * @returns 当前助手信息，未选中时返回 null
   */
  public getCurrentAssistant(): AssistantInfo | null {
    return this.currentAssistant
  }

  /**
   * 获取所有助手信息（纯内存读取，永不触发网络）。
   *
   * 助手列表在加载与后台同步时更新，此处仅返回内存缓存。
   * 返回列表的副本，防止外部直接修改内部状态。
   *
   * @returns 助手信息数组
   */
  public getAssistants(): AssistantInfo[] {
    return [...this.assistants]
  }

  /**
   * 根据名称从内存缓存中查找助手信息。
   *
   * 该方法为内部使用的查找方法，仅在内存中的助手列表里搜索，
   * 不涉及磁盘或网络 IO。
   *
   * @param name - 要查找的助手名称（精确匹配）
   * @returns 匹配的助手信息，未找到时返回 null
   */
  private getAssistantInfo(name: string): AssistantInfo | null {
    return this.assistants.find((assistant) => assistant.name === name) || null
  }

  /**
   * 切换当前选中的助手。
   *
   * 切换流程：
   * 1. 验证目标助手是否存在
   * 2. 异步通知云端切换（不阻塞本地流程）
   * 3. 更新内存中的当前助手引用
   * 4. 加载目标助手的资产配置
   * 5. 持久化当前助手名称到应用配置
   * 6. 通知所有窗口助手已切换
   *
   * @param name - 目标助手的名称
   * @returns 成功时返回 `{ success: true, data: AssistantInfo }`，失败时返回 `{ success: false, error: string }`
   */
  public async setCurrentAssistant(name: string): Promise<SwitchResult> {
    const assistant = this.getAssistantInfo(name)
    if (!assistant) {
      return { success: false, error: '助手不存在' }
    }

    try {
      // 异步通知云端切换，不阻塞本地流程
      await this.switchAssistantInCloud(name)

      this.currentAssistant = assistant

      // 加载助手资产配置
      await this.assets.loadAssistantAssets(name)

      // 保存到配置中
      setConfig('currentAssistant', name)

      BrowserWindow.getAllWindows().forEach((win) => {
        win.webContents.send(CHANNELS.ASSISTANT_SWITCHED_EVENT, assistant)
      })

      // 通知所有窗口助手列表数据已更新
      this.broadcastDataUpdated()

      return { success: true, data: assistant }
    } catch (error) {
      log.error('切换助手失败:', error)
      return { success: false, error: (error as Error).message }
    }
  }

  /**
   * 通知云端切换当前助手。
   *
   * 通过 POST 请求 `/api/assistant/switch` 接口告知后端当前选中的助手已变更。
   * 该方法在 setCurrentAssistant 中以 fire-and-forget 方式调用，
   * 即使云端切换失败也不会影响本地的助手切换流程。
   *
   * @param assistantName - 要切换到的助手名称
   * @returns 云端响应结果，包含 success 状态和助手数据（或错误信息）
   */
  private async switchAssistantInCloud(assistantName: string): Promise<SwitchResult> {
    try {
      const response = await request.post('/api/assistant/switch', { name: assistantName })
      return {
        success: true,
        data: response.data.data
      }
    } catch (error) {
      log.error('切换云端助手失败:', (error as Error).message)
      return {
        success: false,
        error: (error as Error).message
      }
    }
  }

  /**
   * 更新助手信息，同步云端与本地数据。
   *
   * 更新流程：
   * 1. 补全必要字段（user、settings、gsvSetting 等）
   * 2. 上传助手基本信息到云端
   * 3. 保存到本地磁盘
   * 4. 可选：上传助手资产包到云端
   * 5. 更新内存中的助手缓存和当前助手引用
   *
   * @param assistant - 包含更新数据的助手信息对象
   * @param shouldUploadAssets - 是否同时上传资产包（默认 true），频繁保存时可设为 false 避免卡顿
   * @param onProgress - 资产上传进度回调，参数为 0-100 的百分比
   * @param assetTypes - 可选，需要上传的资源类型（子目录名）数组，为空则全量上传
   * @returns 成功返回 `{ success: true }`，失败返回 `{ success: false, error: string }`
   */
  public async updateAssistant(
    assistant: AssistantInfo,
    shouldUploadAssets = true,
    onProgress?: (progress: number) => void,
    assetTypes?: string[]
  ): Promise<{ success: boolean; error?: string }> {
    try {
      // 确保必要的字段存在
      const completeAssistant = {
        ...assistant,
        user: assistant.user || '阁下',
        settings: assistant.settings,
        gsvSetting: assistant.gsvSetting,
        userState: {
          ...assistant.userState,
          updatedAt: Math.floor(Date.now() / 1000)
        }
      }

      // 上传到云端
      await request.post('/api/assistant/info/update', completeAssistant)

      // 保存在本地
      this.saveAssistantToLocal(completeAssistant)
      // 仅在资产变更时上传，避免每次保存都压缩大文件导致主进程卡顿
      if (shouldUploadAssets) {
        const uploadResult = await this.assets.uploadAssistantAssets(
          completeAssistant.name,
          onProgress,
          assetTypes
        )
        if (!uploadResult.success) {
          return { success: false, error: `上传助手资产失败: ${uploadResult.error}` }
        }
      }

      // 更新内存中的助手数据
      const index = this.assistants.findIndex((a) => a.name === completeAssistant.name)
      if (index !== -1) {
        this.assistants[index] = completeAssistant
      }

      // 如果更新的是当前助手，也更新当前助手引用
      if (this.currentAssistant && this.currentAssistant.name === completeAssistant.name) {
        this.currentAssistant = completeAssistant
      }

      // 通知所有窗口数据已更新
      this.broadcastDataUpdated()

      return { success: true }
    } catch (error) {
      log.error(`Error updating assistant ${assistant.name}:`, (error as Error).message)
      return { success: false, error: (error as Error).message }
    }
  }

  /**
   * 将助手信息序列化并保存到本地磁盘。
   *
   * 保存路径为 `{助手目录}/info.json`，使用 JSON 格式，2 空格缩进。
   * 如果助手目录不存在会自动创建。
   *
   * @param assistant - 要保存的助手信息对象
   */
  private saveAssistantToLocal(assistant: AssistantInfo): void {
    const assistantDir = this.resolveAssistantDir(assistant.name)
    const filePath = path.join(assistantDir, 'info.json')
    fs.writeFileSync(filePath, JSON.stringify(assistant, null, 2))
  }

  /**
   * 添加新助手，同步云端与本地数据，并上传助手资产。
   *
   * 添加流程：
   * 1. 校验助手名称合法性
   * 2. 检查助手是否已存在（本地文件 + 内存缓存双重检查）
   * 3. 补全必要字段（user、mask、messageExamples 等默认值）
   * 4. 上传助手信息到云端
   * 5. 保存到本地磁盘并添加到内存缓存
   * 6. 上传助手资产包
   *
   * @param assistant - 新助手的信息对象（至少需要 name 字段）
   * @param onProgress - 资产上传进度回调，参数为 0-100 的百分比
   * @param assetTypes - 可选，需要上传的资源类型（子目录名）数组，为空则全量上传
   * @returns 成功返回 `{ success: true }`，失败返回 `{ success: false, error: string }`
   */
  public async addAssistant(
    assistant: AssistantInfo,
    onProgress?: (progress: number) => void,
    assetTypes?: string[]
  ): Promise<{ success: boolean; error?: string }> {
    let assistantInfoPath = ''
    try {
      assistantInfoPath = path.join(this.resolveAssistantDir(assistant.name, false), 'info.json')
    } catch (error) {
      return { success: false, error: (error as Error).message }
    }

    // 检查助手是否存在
    if (fs.existsSync(assistantInfoPath)) {
      log.warn(`Assistant ${assistant.name} already exists.`)
      return { success: false, error: '助手已存在' }
    }

    // 检查内存中是否已存在
    if (this.getAssistantInfo(assistant.name)) {
      return { success: false, error: '助手已存在' }
    }

    try {
      // 确保必要的字段存在
      const completeAssistant = {
        ...assistant,
        user: assistant.user || '阁下',
        mask: assistant.mask || '',
        messageExamples: assistant.messageExamples || [],
        customPrompt: assistant.customPrompt || '',
        startWith: assistant.startWith || [],
        settings: assistant.settings,
        gsvSetting: assistant.gsvSetting,
        userState: {
          ...assistant.userState,
          updatedAt: Math.floor(Date.now() / 1000),
          assetsLastModified: Math.floor(Date.now() / 1000)
        }
      }

      // 上传到云端
      await request.post('/api/assistant/info/add', completeAssistant)

      // 保存在本地
      this.saveAssistantToLocal(completeAssistant)

      // 添加到内存中
      this.assistants.push(completeAssistant)

      // 上传助手资源
      const uploadResult = await this.assets.uploadAssistantAssets(
        completeAssistant.name,
        onProgress,
        assetTypes
      )
      if (!uploadResult.success) {
        return { success: false, error: `上传助手资产失败: ${uploadResult.error}` }
      }

      // 通知所有窗口数据已更新
      this.broadcastDataUpdated()

      return { success: true }
    } catch (error) {
      log.error(`Error adding assistant ${assistant.name}:`, (error as Error).message)
      return { success: false, error: (error as Error).message }
    }
  }

  /**
   * 从本地磁盘读取所有助手信息。
   *
   * 遍历 assistants 根目录下的所有子目录，读取每个助手的 info.json 文件。
   * 解析失败的助手会被跳过并记录错误日志，不会影响其他助手的读取。
   *
   * @returns 助手名称到助手信息的映射 Map，key 为助手名称，value 为助手信息对象
   */
  private readLocalAssistants(): Map<string, AssistantInfo> {
    const assistantsRoot = this.getAssistantsRootDir()
    const result = new Map<string, AssistantInfo>()
    if (!fs.existsSync(assistantsRoot)) {
      return result
    }
    for (const name of fs.readdirSync(assistantsRoot)) {
      const infoPath = path.join(assistantsRoot, name, 'info.json')
      if (fs.existsSync(infoPath)) {
        try {
          result.set(name, JSON.parse(fs.readFileSync(infoPath, 'utf8')))
        } catch (parseError) {
          log.error(`Error parsing assistant ${name} info:`, parseError)
        }
      }
    }
    return result
  }

  /**
   * 以云端数据为准持久化到本地磁盘。
   *
   * 持久化策略：
   * 1. 写入/覆盖云端存在的助手 info.json（仅内容变化才写，减少无意义 IO）
   * 2. 删除云端已不存在的本地助手目录（含资产文件）
   *
   * @param assistants - 云端助手列表
   */
  private persistAssistants(assistants: AssistantInfo[]): void {
    const assistantsRoot = this.getAssistantsRootDir()
    const cloudNames = new Set(assistants.map((a) => a.name))

    // 1. 覆盖云端存在的助手信息（内容变化才写入）
    for (const assistant of assistants) {
      try {
        const assistantDir = this.resolveAssistantDir(assistant.name)
        const infoPath = path.join(assistantDir, 'info.json')
        const json = JSON.stringify(assistant, null, 2)
        if (!fs.existsSync(infoPath) || fs.readFileSync(infoPath, 'utf8') !== json) {
          fs.writeFileSync(infoPath, json)
        }
      } catch (saveError) {
        log.error(`保存助手 ${assistant.name} 信息失败:`, saveError)
      }
    }

    // 2. 删除云端已不存在的本地助手目录
    if (fs.existsSync(assistantsRoot)) {
      for (const name of fs.readdirSync(assistantsRoot)) {
        if (!cloudNames.has(name)) {
          fs.rmSync(path.join(assistantsRoot, name), { recursive: true, force: true })
          log.info(`助手 ${name} 在云端已不存在，已删除本地数据`)
        }
      }
    }
  }

  /**
   * 删除助手，包括云端数据和本地数据。
   *
   * 删除流程：
   * 1. 调用云端接口删除助手记录
   * 2. 删除本地助手目录（包括所有资产文件）
   * 3. 从内存缓存中移除助手
   * 4. 如果删除的是当前助手，自动切换到列表中的第一个助手
   *
   * @param assistantName - 要删除的助手名称
   * @returns 成功返回 `{ success: true }`，失败返回 `{ success: false, error: string }`
   */
  public async deleteAssistant(
    assistantName: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const assistantDir = this.resolveAssistantDir(assistantName, false)
      // 先删除云端资产
      await request.post('/api/assistant/info/delete', { name: assistantName })

      // 再删除本地资产
      if (fs.existsSync(assistantDir)) {
        fs.rmSync(assistantDir, {
          recursive: true,
          force: true
        })
      }

      // 从内存中移除
      this.assistants = this.assistants.filter((a) => a.name !== assistantName)
      this.assets.removeAssetCache(assistantName)

      // 如果删除的是当前助手，切换到第一个助手
      if (this.currentAssistant && this.currentAssistant.name === assistantName) {
        if (this.assistants.length > 0) {
          await this.setCurrentAssistant(this.assistants[0].name)
        } else {
          this.currentAssistant = null
        }
      }

      // 通知所有窗口数据已更新
      this.broadcastDataUpdated()

      log.info(`Assistant ${assistantName} deleted successfully.`)
      return { success: true }
    } catch (error) {
      log.error(`Error deleting assistant ${assistantName}:`, (error as Error).message)
      return { success: false, error: (error as Error).message }
    }
  }

  // ─── 资源管理委托（实现委托给 AssistantAssetService） ─────────────────────────

  /**
   * 从云端下载助手的资产包并解压到本地（委托给资源服务）。
   *
   * @param assistantName - 要下载资产的助手名称
   * @param onProgress - 下载进度回调，参数为 0-100 的百分比
   * @param assetTypes - 需要下载的资源类型列表（子目录名），为空则下载全部
   * @returns 下载是否成功
   */
  public downloadAssistantAssets(
    assistantName: string,
    onProgress: (progress: number) => void,
    assetTypes: string[] = []
  ): Promise<{ success: boolean }> {
    return this.assets.downloadAssistantAssets(assistantName, onProgress, assetTypes)
  }

  /**
   * 获取当前正在下载资源的助手列表（委托给资源服务）。
   *
   * @returns 正在下载的助手名称数组，空数组表示没有下载任务
   */
  public getDownloadingAssets(): string[] {
    return this.assets.getDownloadingAssets()
  }

  /**
   * 从内存缓存中获取助手的资产配置（委托给资源服务）。
   *
   * @param assistantName - 要获取资产配置的助手名称
   * @returns 资产配置对象，缓存中不存在时返回 null
   */
  public getAssistantAssets(assistantName: string): AssistantAssets | null {
    return this.assets.getAssistantAssets(assistantName)
  }

  /**
   * 从本地磁盘加载助手的资产配置文件（委托给资源服务）。
   *
   * @param assistantName - 要加载资产配置的助手名称
   * @returns 成功返回 `{ success: true, data: AssistantAssets }`，失败返回错误信息
   */
  public loadAssistantAssets(
    assistantName: string
  ): Promise<{ success: true; data: AssistantAssets } | { success: false; error: string }> {
    return this.assets.loadAssistantAssets(assistantName)
  }

  /**
   * 保存助手资产配置到本地磁盘（委托给资源服务）。
   *
   * @param assets - 要保存的资产配置对象（必须包含 assistantName 字段）
   * @returns 成功返回 `{ success: true }`，失败返回错误信息
   */
  public saveAssistantAssets(
    assets: AssistantAssets
  ): Promise<{ success: true } | { success: false; error: string }> {
    return this.assets.saveAssistantAssets(assets)
  }

  /**
   * 保存助手通用资源文件到指定资产子目录（委托给资源服务）。
   *
   * @param fileData - 文件数据（Buffer 或 ArrayBuffer）
   * @param assistantName - 目标助手名称
   * @param subDir - assets 下的子目录路径（如 "voices"、"models"）
   * @param fileName - 文件名（含扩展名）
   * @param oldRelativePath - 旧文件的相对路径（用于替换时删除旧文件），可选
   * @returns 成功返回 `{ success: true, path: string }`，失败返回错误信息
   */
  public saveAssistantResourceFile(
    fileData: Buffer | ArrayBuffer,
    assistantName: string,
    subDir: 'images' | 'audio' | 'live2d' | 'models' | 'other',
    fileName: string,
    oldRelativePath?: string
  ): Promise<{ success: true; path: string } | { success: false; error: string }> {
    return this.assets.saveAssistantResourceFile(
      fileData,
      assistantName,
      subDir,
      fileName,
      oldRelativePath
    )
  }

  /**
   * 保存并解压 Live2D 模型文件到助手目录（委托给资源服务）。
   *
   * @param fileData - Live2D 模型的 zip 数据（Buffer 或 ArrayBuffer）
   * @param assistantName - 目标助手名称
   * @returns 成功返回 `{ success: true, path: string, mainJsonPath: string }`，失败返回错误信息
   */
  public saveAndExtractLive2D(
    fileData: Buffer | ArrayBuffer,
    assistantName: string
  ): Promise<{ success: boolean; path?: string; mainJsonPath?: string; error?: string }> {
    return this.assets.saveAndExtractLive2D(fileData, assistantName)
  }

  // ─── 导入委托（实现委托给 AssistantImportService） ───────────────────────────

  /**
   * 从 zip 角色压缩包导入助手（委托给导入服务）。
   *
   * @param zipPath - zip 压缩包的绝对路径
   * @returns 成功返回 `{ success: true, data: AssistantInfo }`，失败返回错误信息
   */
  public importAssistantFromZip(
    zipPath: string
  ): Promise<{ success: true; data: AssistantInfo } | { success: false; error: string }> {
    return this.importer.importAssistantFromZip(zipPath)
  }

  /**
   * 从图片文件中提取并解码隐藏的助手信息（角色卡导入，委托给导入服务）。
   *
   * @param imageData - 角色卡图片的原始数据
   * @returns 解码后的助手基础信息
   */
  public extractHiddenInfo(imageData: Buffer): AssistantBaseInfo {
    return this.importer.extractHiddenInfo(imageData)
  }
}

export { AssistantService }
