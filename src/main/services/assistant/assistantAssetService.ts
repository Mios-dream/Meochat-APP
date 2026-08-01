/**
 * 助手资源服务 - 管理助手资产（图片、Live2D、音频等）的下载、上传、检查与本地落盘
 *
 * 职责：
 * - 资产完整性检查与缺失资源后台下载
 * - 资产包（zip）的上传与下载
 * - 资源文件（图片、Live2D、通用文件）的本地保存与解压
 * - 资产配置（assets.json）的读写与内存缓存
 * - 资产下载状态的前端通知
 *
 * 通过构造注入的 AssistantAssetContext 与助手数据核心交互（列表、当前助手、
 * 目录解析、持久化、广播、切换），避免与 AssistantService 形成循环依赖。
 * 该类由 AssistantService 实例化并持有，不对外提供独立单例。
 */

import fs from 'fs'
import path from 'path'
import os from 'os'
import FormData from 'form-data'
import AdmZip from 'adm-zip'
import StreamZip from 'node-stream-zip'
import { Worker } from 'worker_threads'
import workerPath from '@/workers/extractWorker?modulePath'
import { BrowserWindow } from 'electron'
import log from '@/utils/logger'
import { request } from '@shared/api/request'
import { AssistantAssets, AssistantInfo, AssetTypeTimestamps } from '@shared/types/assistantTypes'
import type { UpdateCheckResult } from '@shared/types/assistantUpdate'
import { resolveAppDataDir } from '@/utils/pathResolve'
import { detectZipNameEncoding, extractZipEntries } from '@/utils/zipUtils'
import { CHANNELS } from '@shared/ipc/channels'

/** 切换当前助手的结果类型 */
export type SwitchResult =
  | { success: boolean; data: AssistantInfo }
  | { success: false; error: string }

/**
 * 资产服务依赖的助手数据核心能力（由 AssistantService 注入实现）。
 */
export interface AssistantAssetContext {
  /** 获取助手根目录绝对路径 */
  getAssistantsRootDir(): string
  /** 获取助手目录绝对路径，可选确保目录存在 */
  resolveAssistantDir(assistantName: string, ensureExists?: boolean): string
  /** 根据名称从内存缓存中查找助手 */
  getAssistantInfo(name: string): AssistantInfo | null
  /** 获取内存中的助手列表（同步，原始引用） */
  getAssistants(): AssistantInfo[]
  /** 获取内存中的当前助手（同步，原始引用） */
  getCurrentAssistant(): AssistantInfo | null
  /** 切换当前助手（更新内存、配置并广播） */
  setCurrentAssistant(name: string): Promise<SwitchResult>
  /** 将当前助手清空（更新内存与配置） */
  clearCurrentAssistant(): void
  /** 将助手信息持久化到本地磁盘 */
  saveAssistantToLocal(assistant: AssistantInfo): void
  /** 向所有窗口广播助手数据更新事件 */
  broadcastDataUpdated(): void
}

/**
 * 助手资源服务。
 */
export class AssistantAssetService {
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

  /** 助手数据核心能力 */
  private readonly ctx: AssistantAssetContext
  /** 助手资产配置缓存（key: 助手名称） */
  private readonly assistantAssetsMap: Map<string, AssistantAssets> = new Map()
  /** 正在下载资源的助手名称集合（防止重复下载） */
  private readonly downloadingAssets: Set<string> = new Set()

  /**
   * 创建助手资源服务。
   *
   * @param ctx - 助手数据核心能力，由 AssistantService 注入
   */
  constructor(ctx: AssistantAssetContext) {
    this.ctx = ctx
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
  public checkAndDownloadAllAssistantsAssets(
    onProgress?: (assistantName: string, progress: number) => void
  ): void {
    log.info('[AssetSync] 开始检查所有助手资源完整性')

    // 通知前端开始检查资源
    this.notifyDownloadStatus('checking')

    const assistantsToCheck = [...this.ctx.getAssistants()]
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
      const assistantDir = this.ctx.resolveAssistantDir(assistant.name, false)

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
            typesToDownload.push(...AssistantAssetService.CLIENT_ASSET_TYPES)
          } else {
            // 逐类型对比时间戳，仅下载有更新且前端需要的类型
            for (const type of AssistantAssetService.CLIENT_ASSET_TYPES) {
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
          if (this.ctx.getCurrentAssistant()?.name === assistant.name) {
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
      const defaultAssistant = this.ctx
        .getAssistants()
        .find((a) => a.name === DEFAULT_ASSISTANT_NAME)
      if (defaultAssistant && defaultAssistant.name !== excludeAssistantName) {
        const isAvailable = await this.isAssistantAssetsComplete(defaultAssistant)
        if (isAvailable) {
          return defaultAssistant
        }
      }

      // 再检查其他助手
      for (const assistant of this.ctx.getAssistants()) {
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
      await this.ctx.setCurrentAssistant(availableAssistant.name)
    } else {
      log.warn(`没有可用的资源完整助手，将当前助手设置为空`)
      this.ctx.clearCurrentAssistant()

      // 通知前端当前助手已清空
      BrowserWindow.getAllWindows().forEach((win) => {
        win.webContents.send(CHANNELS.ASSISTANT_SWITCHED_EVENT, null)
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
      const assistantDir = this.ctx.resolveAssistantDir(assistant.name, false)
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
        for (const type of AssistantAssetService.CLIENT_ASSET_TYPES) {
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
      win.webContents.send(CHANNELS.ASSISTANT_DOWNLOAD_PROGRESS_EVENT, {
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
        const assistantDir = this.ctx.resolveAssistantDir(assistantName)

        // 确保目标目录存在
        if (!fs.existsSync(downloadsDir)) {
          fs.mkdirSync(downloadsDir, { recursive: true })
        }
        // 使用 axios 发送 POST 请求并监控进度
        const writer = fs.createWriteStream(tempZipPath)

        request({
          url: '/api/assistant/assets/download',
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
    const assistant = this.ctx.getAssistantInfo(assistantName)
    if (assistant) {
      assistant.userState.assetsLastModified = Math.floor(Date.now() / 1000)
      if (assetTypeTimestamps) {
        assistant.userState.assetTypesLastModified = assetTypeTimestamps
      }
      this.ctx.saveAssistantToLocal(assistant)
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
  private async isNeedsUpdate(assistant: AssistantInfo): Promise<UpdateCheckResult> {
    try {
      const assistantDir = this.ctx.resolveAssistantDir(assistant.name)
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

      const response = await request.post('/api/assistant/assets/check', {
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
    } catch {
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
  public async uploadAssistantAssets(
    assistantName: string,
    onProgress?: (progress: number) => void,
    assetTypes?: string[]
  ): Promise<{ success: false; error: string } | { success: true }> {
    // 检查助手目录和资产目录是否存在
    const assistantDir = this.ctx.resolveAssistantDir(assistantName)
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

          await request.post('/api/assistant/assets/upload', formData, {
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
      const assistantDir = this.ctx.resolveAssistantDir(assistantName)
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
            this.ctx.getAssistantsRootDir(),
            oldPathClean.replace(/^assistants\//, '')
          )
          if (fs.existsSync(oldAbsolutePath) && fs.statSync(oldAbsolutePath).isFile()) {
            fs.unlinkSync(oldAbsolutePath)
          }
        }
      }

      return { success: true, path: relativePath }
    } catch (error) {
      log.error('保存助手资源文件失败:', error)
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
      const assistantDir = this.ctx.resolveAssistantDir(assistantName)
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
      const assistantDir = this.ctx.resolveAssistantDir(assets.assistantName)
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
   * 移除助手在资产配置缓存中的记录。
   *
   * 在删除助手时调用，避免内存缓存残留已删除助手的数据。
   *
   * @param assistantName - 要移除的助手名称
   */
  public removeAssetCache(assistantName: string): void {
    this.assistantAssetsMap.delete(assistantName)
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
      const assistantDir = this.ctx.resolveAssistantDir(assistantName)
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
          await extractZipEntries(zip, Object.values(await zip.entries()), '', live2dDir)
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
}
