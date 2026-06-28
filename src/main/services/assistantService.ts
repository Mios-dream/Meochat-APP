import fs from 'fs'
import axios from 'axios'
import FormData from 'form-data'
import AdmZip from 'adm-zip'
import StreamZip from 'node-stream-zip'
import path from 'path'
import os from 'os'
import YAML from 'yaml'
import { Worker } from 'worker_threads'
import workerPath from '../workers/extractWorker?modulePath'
import { globalShortcut, BrowserWindow, screen } from 'electron'
import { getConfig, setConfig } from '../config/configManager'
import log from '../utils/logger'
import {
  AssistantAssets,
  AssistantBaseInfo,
  AssistantInfo,
  AssetTypeTimestamps,
  UpdateCheckResult
} from '../../renderer/src/types/AssistantInfo'
import { createWindow, chatBoxWindowConfig } from '../windows'
import ImageMetadataExtractor from '../utils/imageMetadataExtractor'
import { resolveAppDataDir } from '../utils/pathResolve'
import { detectZipNameEncoding } from '../utils/zipUtils'

/**
 * 助手服务 - 管理助手的生命周期、资产和云端同步
 *
 * 职责：
 * - 助手的增删改查（CRUD）操作
 * - 助手资产（图片、Live2D模型、音频等）的上传下载
 * - 云端与本地数据的单向同步（始终以云端数据为准）
 * - 快捷键注册与管理
 * - 角色包（zip/角色卡）的导入
 */
class AssistantService {
  /** 单例实例 */
  private static instance: AssistantService

  /**
   * 前端需要下载的资源类型列表。
   *
   * 只下载前端渲染所需的资源，服务端专用资源（如 models）不下载：
   * - audio: 音频文件（TTS语音等）
   * - images: 图片文件（立绘、表情等）
   * - live2d: Live2D 模型文件
   * - other: 其他通用资源
   *
   * models 类型由服务端（kernel）独立管理，前端不下载。
   */
  private static readonly CLIENT_ASSET_TYPES: Array<keyof AssetTypeTimestamps> = [
    'images',
    'live2d',
    'other'
  ]

  /** 内存中的助手列表缓存 */
  private assistants: AssistantInfo[] = []
  /** 当前选中的助手引用 */
  private currentAssistant: AssistantInfo | null = null
  /** 助手资产配置缓存（key: 助手名称） */
  private assistantAssetsMap: Map<string, AssistantAssets> = new Map()
  /** 正在下载资源的助手名称集合（防止重复下载） */
  private downloadingAssets: Set<string> = new Set()

  private constructor() {
    this.assistants = []
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
   * 该方法是助手目录操作的核心入口，集成了：
   * 1. 名称合法性校验（通过 sanitizePathComponent）
   * 2. 路径越界防护（通过 path.relative 二次确认）
   * 3. 可选的目录自动创建
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
   * 从云端和本地加载助手数据，完成初始化同步。
   *
   * 加载流程：
   * 1. 优先读取本地数据快速返回（不阻塞前端）
   * 2. 后台异步执行云端同步
   * 3. 同步完成后设置当前助手
   * 4. 异步检查并下载缺失的资源
   *
   * @param onProgress - 可选的进度回调，用于向渲染进程报告资产下载进度
   *   回调参数：(assistantName: 当前处理的助手名, progress: 0-100 的进度百分比)
   * @returns 包含 success（是否成功）
   */
  public async loadAssistants(
    onProgress?: (assistantName: string, progress: number) => void
  ): Promise<{ success: boolean; error?: string }> {
    try {
      // 1. 快速读取本地数据，立即返回给前端
      const localAssistants = this.readLocalAssistants()
      this.assistants = Array.from(localAssistants.values())

      // 2. 设置当前助手（从配置读取，不等待云端）
      const savedAssistantName = getConfig('currentAssistant')
      if (savedAssistantName && this.getAssistantInfo(savedAssistantName)) {
        this.currentAssistant = this.getAssistantInfo(savedAssistantName)
      } else if (this.assistants.length > 0) {
        this.currentAssistant = this.assistants[0]
      }

      // 3. 后台异步执行云端同步（不阻塞返回）
      this.syncFromCloudInBackground(onProgress)

      return { success: true }
    } catch (error) {
      log.error('加载助手数据失败:', error)
      return { success: false, error: (error as Error).message }
    }
  }

  /**
   * 后台异步执行云端同步。
   *
   * 该方法不阻塞调用方，完成后会：
   * 1. 更新内存中的助手列表
   * 2. 设置正确的当前助手
   * 3. 通知前端数据已更新
   * 4. 检查并下载资源
   *
   * @param onProgress - 资源下载进度回调
   */
  private syncFromCloudInBackground(
    onProgress?: (assistantName: string, progress: number) => void
  ): void {
    const doSync = async (): Promise<void> => {
      try {
        log.info('[BackgroundSync] 开始后台云端同步')

        // 1. 从云端获取当前助手信息
        const serverCurrentAssistant = await this.getCurrentAssistantFromCloud()

        // 2. 从云端同步助手数据
        this.assistants = await this.loadAssistantsData()

        // 3. 设置当前助手：优先使用服务器返回的当前助手
        const savedAssistantName = getConfig('currentAssistant')

        if (serverCurrentAssistant && this.getAssistantInfo(serverCurrentAssistant.name)) {
          await this.setCurrentAssistant(serverCurrentAssistant.name)
        } else if (savedAssistantName && this.getAssistantInfo(savedAssistantName)) {
          await this.setCurrentAssistant(savedAssistantName)
        } else if (this.assistants.length > 0) {
          await this.setCurrentAssistant(this.assistants[0].name)
        }

        // 4. 通知前端数据已更新
        BrowserWindow.getAllWindows().forEach((win) => {
          win.webContents.send('assistant:data-updated', {
            assistants: this.getAssistants(),
            currentAssistant: this.getCurrentAssistant()
          })
        })

        log.info('[BackgroundSync] 云端同步完成')

        // 5. 异步检查并下载缺失的资源
        this.checkAndDownloadAllAssistantsAssets(onProgress)
      } catch (error) {
        log.error('[BackgroundSync] 后台同步失败:', error)
      }
    }

    // 异步执行，不阻塞
    doSync()
  }

  /**
   * 异步检查所有助手的资源完整性，对缺失资源在后台下载。
   *
   * 该方法不阻塞调用方，下载过程中通过IPC通知前端下载状态。
   * 使用 downloadingAssets 集合防止重复触发下载。
   *
   * 特殊逻辑：如果当前选中的助手需要下载资源，会自动切换到其他资源完整的助手。
   * 如果没有可用的助手，则将当前助手设置为空。
   *
   * @param onProgress - 可选的进度回调，参数为 (助手名称, 0-100 进度百分比)
   */
  private checkAndDownloadAllAssistantsAssets(
    onProgress?: (assistantName: string, progress: number) => void
  ): void {
    log.info('[AssetSync] 开始检查所有助手资源完整性')

    // 通知前端开始检查资源
    this.notifyDownloadStatus('checking')

    const assistantsToCheck = [...this.assistants]
    let hasDownload = false

    // 串行检查每个助手，避免并发下载导致资源竞争
    const checkNext = async (index: number): Promise<void> => {
      if (index >= assistantsToCheck.length) {
        // 所有助手检查完毕
        log.info(`[AssetSync] 检查完毕，hasDownload=${hasDownload}`)
        if (!hasDownload) {
          this.notifyDownloadStatus('idle')
        }
        return
      }

      const assistant = assistantsToCheck[index]
      const assistantDir = this.resolveAssistantDir(assistant.name, false)

      // 跳过正在下载的助手
      if (this.downloadingAssets.has(assistant.name)) {
        log.info(`[AssetSync] 跳过正在下载的助手: ${assistant.name}`)
        await checkNext(index + 1)
        return
      }

      try {
        const checkResult = await this.isNeedsUpdate(assistant)
        const assetsDir = path.join(assistantDir, 'assets')
        const assetsExist = fs.existsSync(assetsDir) && fs.readdirSync(assetsDir).length > 0

        log.info(
          `[AssetSync] 检查助手 ${assistant.name}: needsUpdate=${checkResult.needsUpdate}, assetsExist=${assetsExist}`
        )

        // 计算需要更新的资源类型列表（只包含前端需要的类型）
        const typesToDownload: string[] = []
        if (checkResult.needsUpdate) {
          const localTimestamps = assistant.userState.assetTypesLastModified
          if (!localTimestamps || !assetsExist) {
            // 本地无记录或资源目录不存在，只下载前端需要的类型
            typesToDownload.push(...AssistantService.CLIENT_ASSET_TYPES)
          } else {
            // 逐类型对比时间戳，仅下载有更新且前端需要的类型
            for (const type of AssistantService.CLIENT_ASSET_TYPES) {
              const cloudTimestamp = checkResult.assetTypes[type] ?? 0
              const localTimestamp = localTimestamps[type] ?? 0
              if (cloudTimestamp > localTimestamp) {
                typesToDownload.push(type)
              }
            }
          }
        }

        if (typesToDownload.length > 0) {
          hasDownload = true
          log.info(`[AssetSync] 助手 ${assistant.name} 需要下载资源: ${typesToDownload.join(', ')}`)

          // 如果是当前助手需要下载，先切换到其他可用助手
          if (this.currentAssistant?.name === assistant.name) {
            await this.switchToAvailableAssistant(assistant.name)
          }

          this.downloadingAssets.add(assistant.name)
          this.notifyDownloadStatus('downloading', assistant.name, 0)

          try {
            await this.downloadAssistantAssets(
              assistant.name,
              (progress) => {
                this.notifyDownloadStatus('downloading', assistant.name, progress)
                if (onProgress) {
                  onProgress(assistant.name, progress)
                }
              },
              typesToDownload
            )
            // 下载完成后更新本地各类资产时间戳
            this.updateAssistantAssetsLastModified(assistant.name, checkResult.assetTypes)
            log.info(`[AssetSync] 助手 ${assistant.name} 资源下载完成`)
          } finally {
            this.downloadingAssets.delete(assistant.name)
          }
        }
      } catch (err) {
        log.error(`[AssetSync] 后台检查助手 ${assistant.name} 资源失败:`, err)
      }

      // 继续检查下一个助手
      await checkNext(index + 1)
    }

    // 异步执行，不阻塞调用方
    checkNext(0)
      .then(() => {
        if (hasDownload) {
          log.info('[AssetSync] 所有资源下载完成，发送 completed 状态')
          this.notifyDownloadStatus('completed')
        }
      })
      .catch((err) => {
        log.error('[AssetSync] 后台检查资源失败:', err)
        this.notifyDownloadStatus('idle')
      })
  }

  /**
   * 当当前助手需要下载资源时，切换到其他资源完整的可用助手。
   *
   * 切换优先级：
   * 1. 优先切换到默认助手（如果资源完整且不是当前助手）
   * 2. 否则切换到列表中第一个资源完整的助手
   * 3. 如果没有可用助手，将当前助手设置为空
   *
   * @param excludeAssistantName - 需要排除的助手名称（即正在下载的助手）
   */
  private async switchToAvailableAssistant(excludeAssistantName: string): Promise<void> {
    const DEFAULT_ASSISTANT_NAME = '澪'

    // 查找资源完整的助手
    const findAvailableAssistant = async (): Promise<AssistantInfo | null> => {
      // 先检查默认助手
      const defaultAssistant = this.assistants.find((a) => a.name === DEFAULT_ASSISTANT_NAME)
      if (defaultAssistant && defaultAssistant.name !== excludeAssistantName) {
        const isAvailable = await this.isAssistantAssetsComplete(defaultAssistant)
        if (isAvailable) {
          return defaultAssistant
        }
      }

      // 再检查其他助手
      for (const assistant of this.assistants) {
        if (assistant.name === excludeAssistantName) {
          continue
        }
        const isAvailable = await this.isAssistantAssetsComplete(assistant)
        if (isAvailable) {
          return assistant
        }
      }

      return null
    }

    const availableAssistant = await findAvailableAssistant()

    if (availableAssistant) {
      log.info(
        `当前助手「${excludeAssistantName}」资源需要下载，自动切换到「${availableAssistant.name}」`
      )
      // 使用 setCurrentAssistant 会更新内存、配置并通知前端
      await this.setCurrentAssistant(availableAssistant.name)
    } else {
      log.warn(`没有可用的资源完整助手，将当前助手设置为空`)
      this.currentAssistant = null
      setConfig('currentAssistant', '')

      // 通知前端当前助手已清空
      BrowserWindow.getAllWindows().forEach((win) => {
        win.webContents.send('assistant:switched', null)
      })
    }
  }

  /**
   * 检查助手的前端资源是否完整（无需下载）。
   *
   * 只检查前端需要的资源类型（audio, images, live2d, other），
   * 不检查服务端专用资源（models）。
   *
   * @param assistant - 要检查的助手信息
   * @returns 资源是否完整
   */
  private async isAssistantAssetsComplete(assistant: AssistantInfo): Promise<boolean> {
    try {
      const assistantDir = this.resolveAssistantDir(assistant.name, false)
      const assetsDir = path.join(assistantDir, 'assets')
      const assetsExist = fs.existsSync(assetsDir) && fs.readdirSync(assetsDir).length > 0

      // 如果本地资源目录不存在或为空，说明资源不完整
      if (!assetsExist) {
        return false
      }

      // 检查是否需要更新
      const checkResult = await this.isNeedsUpdate(assistant)
      if (checkResult.needsUpdate) {
        const localTimestamps = assistant.userState.assetTypesLastModified
        if (!localTimestamps) {
          return false
        }

        // 只检查前端需要的资源类型
        for (const type of AssistantService.CLIENT_ASSET_TYPES) {
          const cloudTimestamp = checkResult.assetTypes[type] ?? 0
          const localTimestamp = localTimestamps[type] ?? 0
          if (cloudTimestamp > localTimestamp) {
            return false
          }
        }
      }

      return true
    } catch (err) {
      log.error(`检查助手 ${assistant.name} 资源完整性失败:`, err)
      return false
    }
  }

  /**
   * 通知前端资源下载状态。
   *
   * 通过 IPC 向所有窗口广播下载进度事件。
   * 前端可监听 'assistant:download-progress' 事件获取下载状态。
   *
   * @param status - 下载状态：'checking' | 'downloading' | 'completed' | 'idle'
   * @param assistantName - 当前正在下载的助手名称
   * @param progress - 下载进度 0-100
   */
  private notifyDownloadStatus(
    status: 'checking' | 'downloading' | 'completed' | 'idle',
    assistantName?: string,
    progress?: number
  ): void {
    const windows = BrowserWindow.getAllWindows()
    log.info(
      `[AssetSync] 发送下载状态: status=${status}, assistantName=${assistantName}, progress=${progress}, windowCount=${windows.length}`
    )

    windows.forEach((win) => {
      win.webContents.send('assistant:download-progress', {
        status,
        assistantName,
        progress
      })
    })
  }

  /**
   * 获取当前是否正在下载资源。
   *
   * @returns 正在下载的助手名称数组，空数组表示没有下载任务
   */
  public getDownloadingAssets(): string[] {
    return Array.from(this.downloadingAssets)
  }

  /**
   * 从云端数据库获取当前选中的助手信息。
   *
   * 通过 GET 请求 `/api/assistant/current` 接口获取云端记录的当前助手。
   * 该方法在 loadAssistants 初始化流程中被调用，用于确定用户上次选择的助手。
   *
   * @returns 云端的当前助手信息，获取失败时返回 null（网络错误、服务未启动等）
   */
  private async getCurrentAssistantFromCloud(): Promise<AssistantInfo | null> {
    try {
      const url = `${getConfig('baseUrl')}/api/assistant/current`
      const response = await axios.get(url)
      return response.data.data
    } catch (error) {
      log.error('获取当前助手失败:', (error as Error).message)
      return null
    }
  }

  /**
   * 从云端刷新当前助手数据，同步最新的好感度等信息到本地。
   *
   * 该方法用于实时同步云端的助手状态（如好感度、对话次数等）到本地。
   * 刷新后会同时更新：
   * - 本地磁盘的 info.json 文件
   * - 内存中的助手列表缓存
   * - 当前助手引用（如果刷新的是当前助手）
   *
   * @returns 刷新后的助手信息，失败时返回 null
   */
  public async refreshCurrentAssistant(): Promise<AssistantInfo | null> {
    try {
      const cloudAssistant = await this.getCurrentAssistantFromCloud()
      if (!cloudAssistant) {
        return null
      }

      // 更新本地文件
      this.saveAssistantToLocal(cloudAssistant)

      // 更新内存中的数据
      const index = this.assistants.findIndex((a) => a.name === cloudAssistant.name)
      if (index !== -1) {
        this.assistants[index] = cloudAssistant
      }

      // 如果恰好是当前助手，同步引用
      if (this.currentAssistant && this.currentAssistant.name === cloudAssistant.name) {
        this.currentAssistant = cloudAssistant
      }

      return cloudAssistant
    } catch (error) {
      log.error('刷新当前助手数据失败:', (error as Error).message)
      return null
    }
  }

  /**
   * 获取当前选中的助手信息。
   *
   * 返回内存中缓存的当前助手引用，不涉及磁盘或网络 IO。
   * 如果尚未初始化或没有助手，返回 null。
   *
   * @returns 当前助手信息，未选中时返回 null
   */
  public getCurrentAssistant(): AssistantInfo | null {
    return this.currentAssistant
  }

  /**
   * 获取所有助手信息的副本。
   *
   * 返回内存中缓存的助手列表的浅拷贝，防止外部直接修改内部状态。
   * 如果需要获取最新数据，应先调用 loadAssistants 刷新。
   *
   * @returns 助手信息数组的副本
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
  public async setCurrentAssistant(
    name: string
  ): Promise<{ success: boolean; data: AssistantInfo } | { success: false; error: string }> {
    const assistant = this.getAssistantInfo(name)
    if (!assistant) {
      return { success: false, error: '助手不存在' }
    }

    try {
      // 异步通知云端切换，不阻塞本地流程
      await this.switchAssistantInCloud(name)

      this.currentAssistant = assistant

      // 加载助手资产配置
      await this.loadAssistantAssets(name)

      // 保存到配置中
      setConfig('currentAssistant', name)

      BrowserWindow.getAllWindows().forEach((win) => {
        win.webContents.send('assistant:switched', assistant)
      })

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
  private async switchAssistantInCloud(
    assistantName: string
  ): Promise<{ success: boolean; data: AssistantInfo } | { success: false; error: string }> {
    try {
      const url = `${getConfig('baseUrl')}/api/assistant/switch`
      const response = await axios.post(url, { name: assistantName })
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
   * 从云端下载助手的资产包并解压到本地。
   *
   * 支持按资源类型选择性下载：传入 assetTypes 数组时仅下载指定类型的资源，
   * 不传或传空数组则下载全部资源。
   *
   * 下载流程：
   * 1. 校验助手名称并准备临时下载路径
   * 2. 通过 POST 流式下载 zip 压缩包到临时目录（携带 assetTypes 参数）
   * 3. 自动探测 zip 条目名编码（UTF-8/GBK）
   * 4. 解压新内容（全量下载时清空旧目录，部分下载时覆盖更新）
   * 5. 清理临时文件并更新资产修改时间戳
   *
   * @param assistantName - 要下载资产的助手名称
   * @param onProgress - 下载进度回调，参数为 0-100 的百分比
   * @param assetTypes - 需要下载的资源类型列表（子目录名），为空则下载全部
   * @returns 下载是否成功
   * @throws 当下载或解压过程中发生错误时抛出异常
   */
  public async downloadAssistantAssets(
    assistantName: string,
    onProgress: (progress: number) => void,
    assetTypes: string[] = []
  ): Promise<{ success: boolean }> {
    return new Promise((resolve, reject) => {
      try {
        // 定义下载和保存路径
        const downloadsDir = path.join(resolveAppDataDir(), 'cache')
        const tempZipPath = path.join(downloadsDir, `${assistantName}.zip`)
        const assistantDir = this.resolveAssistantDir(assistantName)

        // 确保目标目录存在
        if (!fs.existsSync(downloadsDir)) {
          fs.mkdirSync(downloadsDir, { recursive: true })
        }
        const url = `${getConfig('baseUrl')}/api/assistant/assets/download`
        // 使用axios发送POST请求并监控进度
        const writer = fs.createWriteStream(tempZipPath)

        axios({
          url,
          method: 'POST',
          data: { name: assistantName, assetTypes },
          responseType: 'stream',
          onDownloadProgress: (progressEvent) => {
            if (progressEvent.total) {
              const progress = Math.round((progressEvent.loaded * 100) / progressEvent.total)
              onProgress(progress)
            }
          }
        })
          .then((response) => {
            // 将响应流保存到文件
            response.data.pipe(writer)

            writer.on('finish', async () => {
              try {
                const isFullDownload = assetTypes.length === 0

                // 使用 Worker Thread 执行解压，避免阻塞主进程
                const extractResult = await this.extractWithWorker(
                  tempZipPath,
                  assistantDir,
                  isFullDownload
                )

                if (!extractResult.success) {
                  throw new Error(extractResult.error || '解压失败')
                }

                // 更新助手的资产修改时间
                this.updateAssistantAssetsLastModified(assistantName)

                resolve({ success: true })
              } catch (error) {
                reject(error)
              }
            })
          })
          .catch((error) => {
            reject(error)
          })
      } catch (error) {
        reject(error)
      }
    })
  }

  /**
   * 使用 Worker Thread 执行 zip 解压操作。
   *
   * 将解压任务放到独立线程中执行，避免大文件解压时阻塞主进程。
   * Worker 会通过消息向主线程报告解压进度。
   *
   * @param zipPath - zip 文件路径
   * @param targetDir - 解压目标目录
   * @param isFullDownload - 是否全量下载（全量时会先清空目标目录）
   * @returns 解压结果，包含 success 状态和可选的 error 信息
   */
  private extractWithWorker(
    zipPath: string,
    targetDir: string,
    isFullDownload: boolean
  ): Promise<{ success: boolean; error?: string }> {
    return new Promise((resolve) => {
      // 先探测编码
      detectZipNameEncoding(zipPath)
        .then((nameEncoding) => {
          // 创建 Worker 执行解压
          const worker = new Worker(workerPath, {
            workerData: {
              zipPath,
              targetDir,
              nameEncoding,
              isFullDownload
            }
          })

          // 监听 Worker 消息
          worker.on('message', (message) => {
            if (message.type === 'progress') {
              log.info(`[ExtractWorker] 解压进度: ${message.processed}/${message.total}`)
            } else if (message.type === 'complete') {
              log.info(`[ExtractWorker] 解压完成: success=${message.success}`)
              resolve({
                success: message.success,
                error: message.error
              })
            }
          })

          // 监听 Worker 错误
          worker.on('error', (error) => {
            log.error('[ExtractWorker] Worker 错误:', error)
            resolve({ success: false, error: error.message })
          })

          // Worker 退出时如果还没收到 complete 消息，返回错误
          worker.on('exit', (code) => {
            if (code !== 0) {
              log.error(`[ExtractWorker] Worker 异常退出，代码: ${code}`)
              resolve({ success: false, error: `Worker 异常退出，代码: ${code}` })
            }
          })
        })
        .catch((error) => {
          log.error('[ExtractWorker] 探测编码失败:', error)
          resolve({ success: false, error: error.message })
        })
    })
  }

  /**
   * 更新助手的资产修改时间戳。
   *
   * 将助手的 `userState.assetsLastModified` 更新为当前时间（Unix 秒级时间戳），
   * 并同步保存到本地磁盘。该时间戳用于判断资产是否需要更新。
   *
   * @param assistantName - 要更新的助手名称
   * @param assetTypeTimestamps - 可选的云端各类资产时间戳，用于精细化记录各类资产的修改时间
   * @returns 更新是否成功。助手不存在时返回 false
   */
  private updateAssistantAssetsLastModified(
    assistantName: string,
    assetTypeTimestamps?: AssetTypeTimestamps
  ): boolean {
    const assistant = this.getAssistantInfo(assistantName)
    if (assistant) {
      assistant.userState.assetsLastModified = Math.floor(Date.now() / 1000)
      if (assetTypeTimestamps) {
        assistant.userState.assetTypesLastModified = assetTypeTimestamps
      }
      this.saveAssistantToLocal(assistant)
      return true
    } else {
      log.error(`助手 ${assistantName} 不存在`)
      return false
    }
  }

  /**
   * 检查助手的资产是否需要更新。
   *
   * 通过 POST 请求 `/api/assistant/assets/check` 接口，将本地资产的最后修改时间
   * 与云端进行对比，返回精细化的各类资源更新状态。
   *
   * @param assistant - 要检查的助手信息（需要 userState.assetsLastModified 字段）
   * @returns 包含 needsUpdate、assetsLastModified、assetTypes 的检查结果。
   *          网络错误时默认返回 needsUpdate=false（保守策略，避免误触发下载）
   */
  public async isNeedsUpdate(assistant: AssistantInfo): Promise<UpdateCheckResult> {
    const url = `${getConfig('baseUrl')}/api/assistant/assets/check`
    try {
      const assistantDir = this.resolveAssistantDir(assistant.name)
      const assetsDir = path.join(assistantDir, 'assets')
      // 检查本地资源是否存在，如果不存在也需要更新
      if (!fs.existsSync(assetsDir)) {
        return {
          needsUpdate: true,
          assetsLastModified: 0,
          assetTypes: {
            audio: 0,
            images: 0,
            live2d: 0,
            models: 0,
            other: 0
          }
        }
      }

      const response = await axios.post(url, {
        name: assistant.name,
        lastModified: assistant.userState.assetsLastModified
      })

      const data = response.data
      return {
        needsUpdate: data.needsUpdate ?? false,
        assetsLastModified: data.assetsLastModified ?? 0,
        assetTypes: data.assetTypes ?? {
          audio: 0,
          images: 0,
          live2d: 0,
          models: 0,
          other: 0
        }
      }
    } catch (error) {
      // log.error('Error checking assistant update:', error)
      return {
        needsUpdate: false,
        assetsLastModified: 0,
        assetTypes: {
          audio: 0,
          images: 0,
          live2d: 0,
          models: 0,
          other: 0
        }
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
      const url = `${getConfig('baseUrl')}/api/assistant/info/update`
      await axios.post(url, completeAssistant)

      // 保存在本地
      this.saveAssistantToLocal(completeAssistant)
      // 仅在资产变更时上传，避免每次保存都压缩大文件导致主进程卡顿
      if (shouldUploadAssets) {
        const uploadResult = await this.uploadAssistantAssets(
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
      const url = `${getConfig('baseUrl')}/api/assistant/info/add`
      await axios.post(url, completeAssistant)

      // 保存在本地
      this.saveAssistantToLocal(completeAssistant)

      // 添加到内存中
      this.assistants.push(completeAssistant)

      // 上传助手资源
      const uploadResult = await this.uploadAssistantAssets(
        completeAssistant.name,
        onProgress,
        assetTypes
      )
      if (!uploadResult.success) {
        return { success: false, error: `上传助手资产失败: ${uploadResult.error}` }
      }

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
   * 加载助手数据并以云端为准进行单向同步。
   *
   * 同步策略（全部以云端数据为准）：
   * 1. 从云端获取所有助手列表
   * 2. 对于云端存在的助手：始终用云端数据覆盖本地，并检查资产是否需要更新
   * 3. 对于云端不存在但本地存在的助手：删除本地数据
   *
   * @param onProgress - 资产下载进度回调，参数为 (助手名称, 0-100 进度百分比)
   * @returns 包含 assistants（助手列表）和 source（数据来源）的结果对象
   */
  private async loadAssistantsData(): Promise<AssistantInfo[]> {
    // 云端助手映射，用于后续对比本地数据
    const cloudAssistantMap = new Map<string, AssistantInfo>()

    try {
      // 从云端加载助手数据
      const url = `${getConfig('baseUrl')}/api/assistants`
      const response = await axios.get(url)
      const apiData = response.data

      if (apiData.data && Array.isArray(apiData.data)) {
        // 将云端数据映射到 Map 中以便快速查找
        apiData.data.forEach((assistant: AssistantInfo) => {
          cloudAssistantMap.set(assistant.name, assistant)
        })

        // 从本地获取当前的助手数据（用于后续对比删除）
        const localAssistants = this.readLocalAssistants()

        // 同步策略1: 处理云端存在的助手（始终以云端数据为准覆盖本地）
        for (const [assistantName, cloudAssistant] of cloudAssistantMap.entries()) {
          try {
            const assistantDir = this.resolveAssistantDir(assistantName)
            const infoPath = path.join(assistantDir, 'info.json')

            // 云端数据覆盖本地
            fs.writeFileSync(infoPath, JSON.stringify(cloudAssistant, null, 2))
          } catch (saveError) {
            log.error(`Error saving assistant ${assistantName} info:`, saveError)
          }
        }

        // 同步策略2: 删除云端不存在但本地存在的助手
        for (const [assistantName] of localAssistants.entries()) {
          if (!cloudAssistantMap.has(assistantName)) {
            fs.rmSync(path.join(this.getAssistantsRootDir(), assistantName), {
              recursive: true,
              force: true
            })
            log.info(`Assistant ${assistantName} removed as it no longer exists in the cloud.`)
          }
        }
      }
    } catch (error) {
      log.error('Error loading assistant data from cloud:', (error as Error).message)
      // 云端同步失败时，仍然返回本地数据
    }

    // 最终从本地获取所有助手数据（同步后可能已更新）
    const localAssistants = this.readLocalAssistants()
    return Array.from(localAssistants.values())
  }

  /**
   * 上传助手资产包到云端。
   *
   * 上传流程：
   * 1. 检查资产目录是否存在
   * 2. 根据 assetTypes 参数决定打包范围（全量或增量）
   * 3. 使用 AdmZip 将资产目录压缩为临时 zip 文件
   * 4. 通过 FormData 上传到云端（支持进度回调）
   * 5. 内置 ECONNABORTED 错误重试机制（最多重试 1 次）
   * 6. 上传完成后清理临时 zip 文件
   *
   * 使用临时文件而非内存 Buffer，降低大文件上传时的内存峰值。
   *
   * @param assistantName - 要上传资产的助手名称
   * @param onProgress - 上传进度回调，参数为 0-100 的百分比
   * @param assetTypes - 可选，需要上传的资源类型（子目录名）数组，为空则全量上传
   * @returns 成功返回 `{ success: true }`，失败返回 `{ success: false, error: string }`
   */
  private async uploadAssistantAssets(
    assistantName: string,
    onProgress?: (progress: number) => void,
    assetTypes?: string[]
  ): Promise<{ success: false; error: string } | { success: true }> {
    // 检查助手目录和资产目录是否存在
    const assistantDir = this.resolveAssistantDir(assistantName)
    const assetsDir = path.join(assistantDir, 'assets')

    if (!fs.existsSync(assetsDir)) {
      log.warn(`没有找到助手 ${assistantName} 的资产目录`)
      return { success: false, error: '没有找到助手资产目录' }
    }

    // Windows 下部分目录或含特殊字符路径可能在 chmod 时触发 EPERM，改用系统临时目录与 ASCII 文件名
    const tempZipPath = path.join(
      os.tmpdir(),
      `assistant_assets_upload_${Date.now()}_${Math.random().toString(16).slice(2)}.zip`
    )

    try {
      // 使用临时文件而非内存 Buffer，降低大文件上传时内存峰值与阻塞风险
      const zip = new AdmZip()

      // 根据 assetTypes 参数决定打包范围
      if (assetTypes && assetTypes.length > 0) {
        // 增量上传：只打包指定的子目录
        for (const assetType of assetTypes) {
          const subDir = path.join(assetsDir, assetType)
          if (fs.existsSync(subDir)) {
            zip.addLocalFolder(subDir, assetType)
          } else {
            log.warn(`[AssistantUpload] asset type directory not found: ${assetType}`)
          }
        }
      } else {
        // 全量上传：打包整个 assets 目录
        zip.addLocalFolder(assetsDir)
      }

      await zip.writeZipPromise(tempZipPath, { overwrite: true })

      const zipStat = fs.statSync(tempZipPath)
      const zipSize = zipStat.size

      log.info(
        `[AssistantUpload] start assistant=${assistantName}, zipSizeMB=${(zipSize / 1024 / 1024).toFixed(2)}`
      )

      // 上传到云端
      const url = `${getConfig('baseUrl')}/api/assistant/assets/upload`
      const maxRetry = 1

      for (let attempt = 0; attempt <= maxRetry; attempt++) {
        try {
          const formData = new FormData()
          formData.append('name', assistantName)
          formData.append('assets_zip', fs.createReadStream(tempZipPath), {
            filename: `${assistantName}_assets.zip`,
            knownLength: zipSize,
            contentType: 'application/zip'
          })

          // 如果指定了 assetTypes，添加 asset_types 参数
          if (assetTypes && assetTypes.length > 0) {
            formData.append('asset_types', assetTypes.join(','))
          }

          const headers = formData.getHeaders()
          const contentLength = await new Promise<number | null>((resolve) => {
            formData.getLength((err, length) => {
              if (err) {
                resolve(null)
                return
              }
              resolve(length)
            })
          })

          if (contentLength !== null) {
            headers['Content-Length'] = String(contentLength)
          }

          await axios.post(url, formData, {
            headers,
            timeout: 0,
            maxBodyLength: Infinity,
            maxContentLength: Infinity,
            onUploadProgress: (progressEvent) => {
              if (progressEvent.total && onProgress) {
                const progress = Math.round((progressEvent.loaded * 100) / progressEvent.total)
                onProgress(progress)
              }
            }
          })

          log.info(`[AssistantUpload] success assistant=${assistantName}`)
          return { success: true }
        } catch (error) {
          const maybeError = error as { code?: string; message?: string }
          const message = maybeError.message || ''
          const isConnectionAbort =
            maybeError.code === 'ECONNABORTED' || message.includes('ECONNABORTED')

          if (isConnectionAbort && attempt < maxRetry) {
            log.warn(
              `[AssistantUpload] ECONNABORTED, retrying assistant=${assistantName}, attempt=${attempt + 1}`
            )
            continue
          }

          return { success: false, error: message || '上传失败' }
        }
      }

      return { success: false, error: '上传失败' }
    } catch (error) {
      return { success: false, error: (error as Error).message }
    } finally {
      if (fs.existsSync(tempZipPath)) {
        fs.rmSync(tempZipPath, { force: true })
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
      const url = `${getConfig('baseUrl')}/api/assistant/info/delete`
      await axios.post(url, { name: assistantName })

      // 再删除本地资产
      if (fs.existsSync(assistantDir)) {
        fs.rmSync(assistantDir, {
          recursive: true,
          force: true
        })
      }

      // 从内存中移除
      this.assistants = this.assistants.filter((a) => a.name !== assistantName)
      this.assistantAssetsMap.delete(assistantName)

      // 如果删除的是当前助手，切换到第一个助手
      if (this.currentAssistant && this.currentAssistant.name === assistantName) {
        if (this.assistants.length > 0) {
          await this.setCurrentAssistant(this.assistants[0].name)
        } else {
          this.currentAssistant = null
        }
      }

      log.info(`Assistant ${assistantName} deleted successfully.`)
      return { success: true }
    } catch (error) {
      log.error(`Error deleting assistant ${assistantName}:`, (error as Error).message)
      return { success: false, error: (error as Error).message }
    }
  }

  /**
   * 保存助手的图片资源到本地目录。
   *
   * 图片保存路径为 `{助手目录}/assets/images/{文件名}.png`。
   * 文件名会经过安全校验，自动去除路径穿越字符。
   * 支持 Buffer 和 ArrayBuffer 两种输入格式。
   *
   * @param fileData - 图片文件数据（Buffer 或 ArrayBuffer）
   * @param assistantName - 目标助手名称
   * @param fileName - 文件名（不含扩展名，会自动添加 .png 后缀）
   * @returns 成功返回 `{ success: true, path: string }`（path 为应用内相对路径），
   *          失败返回 `{ success: false, error: string }`
   */
  public async saveAssistantImage(
    fileData: Buffer | ArrayBuffer,
    assistantName: string,
    fileName: string
  ): Promise<{ success: true; path: string } | { success: false; error: string }> {
    try {
      const assistantDir = this.resolveAssistantDir(assistantName)
      const assetsDir = path.join(assistantDir, 'assets', 'images')
      if (!fs.existsSync(assetsDir)) {
        fs.mkdirSync(assetsDir, { recursive: true })
      }
      const filePath = path.join(assetsDir, fileName + '.png')
      // 如果传入的是 ArrayBuffer，则转换为 Buffer
      const bufferData = Buffer.isBuffer(fileData) ? fileData : Buffer.from(fileData)
      // 写入文件
      fs.writeFileSync(filePath, bufferData)

      // 返回相对路径，用于在应用中引用
      return {
        success: true,
        path: `assistants/${assistantName}/assets/images/${fileName}.png`
      }
    } catch (error) {
      log.error('保存助手文件失败:', error)
      return { success: false, error: (error as Error).message }
    }
  }

  /**
   * 保存助手通用资源文件到指定资产子目录，并在替换时删除旧文件。
   *
   * 该方法用于保存各种类型的资源文件（音频、配置文件等），支持：
   * - 自定义子目录结构（如 "voices/extra"）
   * - 自动清理旧文件（通过 oldRelativePath 参数）
   * - 应用内协议路径清理（去除 app-resource:// 前缀和查询参数）
   *
   * @param fileData - 文件数据（Buffer 或 ArrayBuffer）
   * @param assistantName - 目标助手名称
   * @param subDir - assets 下的子目录路径（如 "voices"、"models"）
   * @param fileName - 文件名（含扩展名）
   * @param oldRelativePath - 旧文件的相对路径（用于替换时删除旧文件），可选
   * @returns 成功返回 `{ success: true, path: string }`（path 为应用内相对路径），
   *          失败返回 `{ success: false, error: string }`
   */
  public async saveAssistantResourceFile(
    fileData: Buffer | ArrayBuffer,
    assistantName: string,
    subDir: 'images' | 'audio' | 'live2d' | 'models' | 'other',
    fileName: string,
    oldRelativePath?: string
  ): Promise<{ success: true; path: string } | { success: false; error: string }> {
    try {
      const assistantDir = this.resolveAssistantDir(assistantName)
      const targetDir = path.join(assistantDir, 'assets', subDir)
      if (!fs.existsSync(targetDir)) {
        fs.mkdirSync(targetDir, { recursive: true })
      }

      const targetPath = path.join(targetDir, fileName)
      const bufferData = Buffer.isBuffer(fileData) ? fileData : Buffer.from(fileData)
      fs.writeFileSync(targetPath, bufferData)

      const relativePath = path.posix.join(
        'assistants',
        assistantName,
        'assets',
        ...subDir.split('/').filter(Boolean),
        fileName
      )

      const oldPathClean = oldRelativePath
        ?.replace(/^app-resource:\/\//, '')
        .split('?')[0]
        .replace(/\\/g, '/')

      if (oldPathClean && oldPathClean !== relativePath) {
        const assistantAssetsPrefix = `assistants/${assistantName}/assets/`
        if (oldPathClean.startsWith(assistantAssetsPrefix) && !oldPathClean.includes('..')) {
          const oldAbsolutePath = path.join(
            this.getAssistantsRootDir(),
            oldPathClean.replace(/^assistants\//, '')
          )
          if (fs.existsSync(oldAbsolutePath) && fs.statSync(oldAbsolutePath).isFile()) {
            fs.unlinkSync(oldAbsolutePath)
          }
        }
      }

      return { success: true, path: relativePath }
    } catch (error) {
      log.error('保存助手资源文件失败:', Error)
      return { success: false, error: (error as Error).message }
    }
  }

  /**
   * 从本地磁盘加载助手的资产配置文件。
   *
   * 读取 `{助手目录}/assets/assets.json` 文件并解析为 AssistantAssets 对象。
   * 加载成功后会自动缓存到内存中，后续可通过 getAssistantAssets 直接获取。
   *
   * @param assistantName - 要加载资产配置的助手名称
   * @returns 成功返回 `{ success: true, data: AssistantAssets }`，
   *          失败返回 `{ success: false, error: string }`（文件不存在或解析失败）
   */
  public async loadAssistantAssets(
    assistantName: string
  ): Promise<{ success: true; data: AssistantAssets } | { success: false; error: string }> {
    try {
      const assistantDir = this.resolveAssistantDir(assistantName)
      const assetsFilePath = path.join(assistantDir, 'assets', 'assets.json')

      if (fs.existsSync(assetsFilePath)) {
        const assetsData = fs.readFileSync(assetsFilePath, 'utf8')
        const assets = JSON.parse(assetsData)
        // 缓存到内存中
        this.assistantAssetsMap.set(assistantName, assets)
        return { success: true, data: assets }
      } else {
        return { success: false, error: '资产配置文件不存在' }
      }
    } catch (error) {
      log.error('获取助手资产配置失败:', (error as Error).stack)
      return { success: false, error: (error as Error).message }
    }
  }

  /**
   * 保存助手资产配置到本地磁盘。
   *
   * 将 AssistantAssets 对象序列化为 JSON 并保存到 `{助手目录}/assets/assets.json`。
   * 保存成功后会同步更新内存中的缓存。
   *
   * @param assets - 要保存的资产配置对象（必须包含 assistantName 字段）
   * @returns 成功返回 `{ success: true }`，失败返回 `{ success: false, error: string }`
   */
  public async saveAssistantAssets(
    assets: AssistantAssets
  ): Promise<{ success: true } | { success: false; error: string }> {
    try {
      const assistantDir = this.resolveAssistantDir(assets.assistantName)
      const assetsDir = path.join(assistantDir, 'assets')
      if (!fs.existsSync(assetsDir)) {
        fs.mkdirSync(assetsDir, { recursive: true })
      }
      const assetsFilePath = path.join(assetsDir, 'assets.json')
      fs.writeFileSync(assetsFilePath, JSON.stringify(assets, null, 2))

      // 更新内存缓存
      this.assistantAssetsMap.set(assets.assistantName, assets)

      return { success: true }
    } catch (error) {
      log.error('保存助手资产配置失败:', error)
      return { success: false, error: (error as Error).message }
    }
  }

  /**
   * 从内存缓存中获取助手的资产配置。
   *
   * 该方法仅查询内存缓存，不涉及磁盘 IO。
   * 如果缓存中不存在，需要先调用 loadAssistantAssets 从磁盘加载。
   *
   * @param assistantName - 要获取资产配置的助手名称
   * @returns 资产配置对象，缓存中不存在时返回 null
   */
  public getAssistantAssets(assistantName: string): AssistantAssets | null {
    return this.assistantAssetsMap.get(assistantName) || null
  }

  /**
   * 解析角色包 info.yaml 内容为结构化对象。
   *
   * 处理流程：
   * 1. 自动去除 UTF-8 BOM 头（U+FEFF）
   * 2. 使用 yaml 库进行标准 YAML 解析
   * 3. 校验解析结果必须为非空对象（排除数组、null 等类型）
   *
   * @param content - YAML 格式的字符串内容
   * @returns 解析后的 Record 对象，解析失败或类型不符时返回空对象 `{}`
   */
  private parseYamlContent(content: string): Record<string, unknown> {
    // 去除 BOM 头
    const cleanContent = content.replace(/^\uFEFF/, '')
    const parsed = YAML.parse(cleanContent)
    // 确保返回的是对象类型
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
      return {}
    }
    return parsed as Record<string, unknown>
  }

  /**
   * 判断 zip 条目是否位于指定的包根目录下。
   *
   * 用于过滤 zip 包中的条目，只处理属于指定目录的内容。
   * 如果 packageRoot 为空字符串，则所有条目都被视为有效。
   *
   * @param entryName - zip 条目的完整路径（如 "character/avatars/main.png"）
   * @param packageRoot - 期望的根目录前缀（如 "character"），空字符串表示不过滤
   * @returns 条目是否在指定根目录下
   */
  private isEntryUnderPackageRoot(entryName: string, packageRoot: string): boolean {
    return packageRoot ? entryName.startsWith(`${packageRoot}/`) : true
  }

  /**
   * 安全解压 zip 条目到目标目录，内置路径穿越防护。
   *
   * 安全措施：
   * 1. 过滤不属于指定包根目录的条目
   * 2. 跳过 info.yaml/info.yml 配置文件
   * 3. 可选过滤嵌套目录条目
   * 4. 路径规范化后进行越界检查（防止 ../../../etc/passwd 攻击）
   *
   * @param zip - StreamZip 异步实例
   * @param entries - 要解压的 zip 条目数组
   * @param packageRoot - 包内根目录前缀，空字符串表示解压整个包
   * @param targetDir - 解压目标目录的绝对路径
   * @param options - 可选配置
   * @param options.includeNestedEntries - 是否包含嵌套目录条目（默认 true）
   * @throws 当检测到不安全路径时抛出 Error
   */
  private async extractZipEntries(
    zip: StreamZip.StreamZipAsync,
    entries: StreamZip.ZipEntry[],
    packageRoot: string,
    targetDir: string,
    options?: { includeNestedEntries?: boolean }
  ): Promise<void> {
    const shouldIncludeNestedEntries = options?.includeNestedEntries !== false
    for (const entry of entries) {
      if (!this.isEntryUnderPackageRoot(entry.name, packageRoot)) {
        continue
      }

      const relativeEntryName = packageRoot ? entry.name.slice(packageRoot.length + 1) : entry.name
      if (!relativeEntryName || /^info\.ya?ml$/i.test(relativeEntryName)) {
        continue
      }
      if (!shouldIncludeNestedEntries && relativeEntryName.includes('/')) {
        continue
      }

      const normalizedRelativePath = path.normalize(relativeEntryName)
      const destinationPath = path.join(targetDir, normalizedRelativePath)

      if (entry.isDirectory) {
        fs.mkdirSync(destinationPath, { recursive: true })
        continue
      }

      fs.mkdirSync(path.dirname(destinationPath), { recursive: true })
      const data = await zip.entryData(entry.name)
      fs.writeFileSync(destinationPath, data)
    }
  }

  /**
   * 从 zip 角色压缩包导入助手。
   *
   * 导入流程：
   * 1. 校验文件格式（必须是 .zip 扩展名）
   * 2. 自动探测 zip 条目名编码（UTF-8/GBK）
   * 3. 查找并解析 info.yaml 获取助手名称
   * 4. 检查助手是否已存在（防止重复导入）
   * 5. 上传整个 zip 包到后端进行处理
   * 6. 用后端返回的标准数据更新本地缓存
   *
   * @param zipPath - zip 压缩包的绝对路径
   * @returns 成功返回 `{ success: true, data: AssistantInfo }`（包含后端处理后的完整助手信息），
   *          失败返回 `{ success: false, error: string }`
   */
  public async importAssistantFromZip(
    zipPath: string
  ): Promise<{ success: true; data: AssistantInfo } | { success: false; error: string }> {
    // 初步校验是否为 zip 文件，避免不必要的解压尝试
    if (!zipPath || !zipPath.toLowerCase().endsWith('.zip')) {
      return { success: false, error: '请选择 zip 格式的角色压缩包' }
    }
    if (!fs.existsSync(zipPath)) {
      return { success: false, error: '角色压缩包不存在' }
    }

    try {
      // 检测编码并打开 zip 文件
      const nameEncoding = await detectZipNameEncoding(zipPath)
      const zip = new StreamZip.async({ file: zipPath, nameEncoding })
      try {
        const entries = Object.values(await zip.entries())

        // 检查是否存在 info.yaml 文件
        const infoEntry = entries.find(
          (entry) => !entry.isDirectory && /(^|\/)info\.ya?ml$/i.test(entry.name)
        )
        if (!infoEntry) {
          return { success: false, error: '无效角色压缩包：未找到 info.yaml' }
        }

        // 解析 yaml 获取助手名称
        const yamlContent = (await zip.entryData(infoEntry.name)).toString('utf8')
        const assistantInfo = this.parseYamlContent(yamlContent)
        const assistantName =
          typeof assistantInfo.name === 'string' ? assistantInfo.name.trim() : ''

        if (!assistantName) {
          return { success: false, error: 'info.yaml 中缺少助手名称' }
        }

        // 检查助手是否已存在
        if (this.getAssistantInfo(assistantName)) {
          return { success: false, error: `助手「${assistantName}」已存在` }
        }

        // 上传整个 zip 压缩包到后端，并用后端返回的标准信息刷新本地缓存
        const uploadResult = await this.uploadAssistantZipPackage(zipPath)
        if (!uploadResult.success) {
          return { success: false, error: uploadResult.error }
        }

        this.saveAssistantToLocal(uploadResult.data)
        this.assistants.push(uploadResult.data)

        return { success: true, data: uploadResult.data }
      } finally {
        await zip.close()
      }
    } catch (error) {
      log.error('导入 zip 角色包失败:', error)
      return { success: false, error: (error as Error).message }
    }
  }

  /**
   * 上传整个助手 zip 压缩包到后端进行导入处理。
   *
   * 后端会负责解压 zip 包、解析 info.yaml、创建助手目录结构、
   * 生成标准的 AssistantInfo 数据等操作。
   *
   * @param zipPath - zip 压缩包的绝对路径
   * @returns 成功返回 `{ success: true, data: AssistantInfo }`（后端返回的完整助手信息），
   *          失败返回 `{ success: false, error: string }`（包含后端返回的详细错误信息）
   */
  private async uploadAssistantZipPackage(
    zipPath: string
  ): Promise<{ success: true; data: AssistantInfo } | { success: false; error: string }> {
    try {
      const url = `${getConfig('baseUrl')}/api/assistant/import-from-zip`
      const zipStat = fs.statSync(zipPath)

      log.info(`[AssistantZipImport] start zipSizeMB=${(zipStat.size / 1024 / 1024).toFixed(2)}`)

      const formData = new FormData()
      formData.append('assistant_zip', fs.createReadStream(zipPath), {
        filename: path.basename(zipPath),
        knownLength: zipStat.size,
        contentType: 'application/zip'
      })

      const headers = formData.getHeaders()
      const contentLength = await new Promise<number | null>((resolve) => {
        formData.getLength((err, length) => {
          if (err) {
            resolve(null)
            return
          }
          resolve(length)
        })
      })

      if (contentLength !== null) {
        headers['Content-Length'] = String(contentLength)
      }

      const response = await axios.post(url, formData, {
        headers,
        timeout: 0,
        maxBodyLength: Infinity,
        maxContentLength: Infinity
      })

      log.info(`[AssistantZipImport] success`)
      return { success: true, data: response.data.data }
    } catch (error) {
      const axiosError = error as { response?: { data?: { detail?: string } }; message?: string }
      const message =
        axiosError.response?.data?.detail || axiosError.message || '上传助手压缩包失败'
      log.error(`[AssistantZipImport] failed: ${message}`)
      return { success: false, error: message }
    }
  }

  /**
   * 保存并解压 Live2D 模型文件到助手目录。
   *
   * 处理流程：
   * 1. 清空旧的 live2d 目录（如果存在）
   * 2. 将 zip 数据写入临时文件
   * 3. 自动探测编码并解压到 `{助手目录}/assets/live2d/`
   * 4. 递归查找主模型文件（*.model3.json 或 *.model.json）
   * 5. 清理临时文件
   *
   * 如果未找到主模型文件，会自动删除空的 live2d 目录。
   *
   * @param fileData - Live2D 模型的 zip 数据（Buffer 或 ArrayBuffer）
   * @param assistantName - 目标助手名称
   * @returns 成功返回 `{ success: true, path: string, mainJsonPath: string }`，
   *   - path: live2d 目录的应用内相对路径
   *   - mainJsonPath: 主模型文件的应用内相对路径
   *          失败返回 `{ success: false, error: string }`
   */
  public async saveAndExtractLive2D(
    fileData: Buffer | ArrayBuffer,
    assistantName: string
  ): Promise<{ success: boolean; path?: string; mainJsonPath?: string; error?: string }> {
    try {
      const assistantDir = this.resolveAssistantDir(assistantName)
      const live2dDir = path.join(assistantDir, 'assets', 'live2d')

      // 确保目标目录存在
      if (!fs.existsSync(live2dDir)) {
        fs.mkdirSync(live2dDir, { recursive: true })
      }

      // 如果传入的是 ArrayBuffer，则转换为 Buffer
      const bufferData = Buffer.isBuffer(fileData) ? fileData : Buffer.from(fileData)

      // 如果目录已存在，先删除
      if (fs.existsSync(live2dDir)) {
        fs.rmSync(live2dDir, { recursive: true, force: true })
      }

      fs.mkdirSync(live2dDir, { recursive: true })

      // 将 Buffer 写入临时文件，使用 node-stream-zip 解压以正确处理中文文件名
      const tempZipPath = path.join(os.tmpdir(), `live2d_upload_${Date.now()}.zip`)
      try {
        fs.writeFileSync(tempZipPath, bufferData)

        // 先按 UTF-8 探测条目名，若出现替换字符则降级为 GBK：
        // Bandizip / Win11 新版自带压缩使用 UTF-8（但后者不置位 bit 11），旧版工具使用 GBK
        const nameEncoding = await detectZipNameEncoding(tempZipPath)
        const zip = new StreamZip.async({ file: tempZipPath, nameEncoding })
        try {
          await this.extractZipEntries(zip, Object.values(await zip.entries()), '', live2dDir)
        } finally {
          await zip.close()
        }
      } finally {
        // 清理临时文件
        if (fs.existsSync(tempZipPath)) {
          fs.unlinkSync(tempZipPath)
        }
      }

      // 查找主JSON文件
      let mainJsonPath = ''
      const files = fs.readdirSync(live2dDir, { recursive: true })
      for (const file of files) {
        const fileName = file.toString()
        if (fileName.endsWith('.model3.json') || fileName.endsWith('.model.json')) {
          mainJsonPath = path.join('assistants', assistantName, 'assets', 'live2d', fileName)
          break
        }
      }

      if (!mainJsonPath) {
        // 删除空目录
        fs.rmSync(live2dDir, { recursive: true, force: true })
        return { success: false, error: '未找到主JSON文件' }
      }

      return {
        success: true,
        path: `assistants/${assistantName}/assets/live2d`,
        mainJsonPath: mainJsonPath
      }
    } catch (error) {
      log.error('上传并解压Live2D模型失败:', error)
      return { success: false, error: (error as Error).message }
    }
  }

  /**
   * 从图片文件中提取并解码隐藏的助手信息
   */
  public extractHiddenInfo(imageData: Buffer): AssistantBaseInfo {
    const extractor = new ImageMetadataExtractor()
    const result = JSON.parse(extractor.extractAndDecodeHiddenInfo(imageData))
    if (!result || !result.data) {
      throw new Error('隐藏信息中缺少角色数据')
    }
    const hiddenInfo = result.data
    const assistantInfo: AssistantBaseInfo = {
      name: hiddenInfo.name?.trim(),
      extraDescription: hiddenInfo?.description?.trim(),
      messageExamples: [
        ...(hiddenInfo?.mes_example
          ?.split('<START>')
          .map((item: string) => item.trim())
          .filter((item: string) => item !== '') || [])
      ],
      startWith: [...(hiddenInfo?.alternate_greetings || [])]
    }
    return assistantInfo
  }
}

export { AssistantService }
