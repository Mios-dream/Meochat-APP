/**
 * 助手导入服务 - 负责角色包（zip 角色包 / 角色卡图片）的导入处理
 *
 * 职责：
 * - 从 zip 角色压缩包导入助手（校验、解析 info.yaml、上传后端、落库）
 * - 从角色卡图片中提取并解码隐藏的助手信息
 *
 * 通过构造注入的 AssistantImportContext 与助手数据核心交互
 * （查重、持久化、导入成功后登记到列表并广播），避免循环依赖。
 * 该类由 AssistantService 实例化并持有，不对外提供独立单例。
 */

import fs from 'fs'
import path from 'path'
import FormData from 'form-data'
import StreamZip from 'node-stream-zip'
import log from '@/utils/logger'
import { request } from '@shared/api/request'
import { AssistantBaseInfo, AssistantInfo } from '@shared/types/assistantTypes'
import { detectZipNameEncoding } from '@/utils/zipUtils'
import { parseYamlContent } from '@/utils/zipUtils'
import ImageMetadataExtractor from '@/utils/imageMetadataExtractor'

/**
 * 导入服务依赖的助手数据核心能力（由 AssistantService 注入实现）。
 */
export interface AssistantImportContext {
  /** 根据名称从内存缓存中查找助手 */
  getAssistantInfo(name: string): AssistantInfo | null
  /** 将助手信息持久化到本地磁盘 */
  saveAssistantToLocal(assistant: AssistantInfo): void
  /** 导入成功后的登记回调（推入内存列表并广播更新） */
  onImported(assistant: AssistantInfo): void
}

/**
 * 助手导入服务。
 */
export class AssistantImportService {
  /** 助手数据核心能力 */
  private readonly ctx: AssistantImportContext

  /**
   * 创建助手导入服务。
   *
   * @param ctx - 助手数据核心能力，由 AssistantService 注入
   */
  constructor(ctx: AssistantImportContext) {
    this.ctx = ctx
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
        const assistantInfo = parseYamlContent(yamlContent)
        const assistantName =
          typeof assistantInfo.name === 'string' ? assistantInfo.name.trim() : ''

        if (!assistantName) {
          return { success: false, error: 'info.yaml 中缺少助手名称' }
        }

        // 检查助手是否已存在
        if (this.ctx.getAssistantInfo(assistantName)) {
          return { success: false, error: `助手「${assistantName}」已存在` }
        }

        // 上传整个 zip 压缩包到后端，并用后端返回的标准信息刷新本地缓存
        const uploadResult = await this.uploadAssistantZipPackage(zipPath)
        if (!uploadResult.success) {
          return { success: false, error: uploadResult.error }
        }

        // 持久化到本地并登记到助手列表
        this.ctx.saveAssistantToLocal(uploadResult.data)
        this.ctx.onImported(uploadResult.data)

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

      const response = await request.post('/api/assistant/import-from-zip', formData, {
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
   * 从图片文件中提取并解码隐藏的助手信息（角色卡导入）。
   *
   * @param imageData - 角色卡图片的原始数据
   * @returns 解码后的助手基础信息
   * @throws 当图片中不存在有效隐藏信息时抛出错误
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
