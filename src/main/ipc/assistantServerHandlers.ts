import { CHANNELS } from '@shared/ipc/channels'
import { registerHandle } from '../utils/registerIpcHandler'
import fs from 'fs'
import path from 'path'
import { AssistantService } from '../services/assistantService'
import { AssistantAssets } from '@shared/types/assistantTypes'
import { resolveAppDataDir } from '../utils/pathResolve'

/**
 * 设置助手服务IPC
 *
 * 助手服务IPC方法清单：
 * - assistant:load-data          加载助手数据（初始化）
 * - assistant:register-chat-shortcut  注册聊天框快捷键
 * - assistant:add-assistant      添加助手
 * - assistant:update-assistant   更新助手信息
 * - assistant:delete-assistant   删除助手
 * - assistant:save-resource-file 保存助手资源文件（图片、音频等通用方法）
 * - assistant:get-assets         获取助手资产配置
 * - assistant:save-assets        保存助手资产配置
 * - assistant:save-extract-live2d 上传并解压Live2D模型
 * - assistant:download-asset     下载助手资产文件
 * - assistant:get-downloading    获取正在下载的助手列表
 * - assistant:get-current        获取当前助手信息
 * - assistant:refresh-current    从云端刷新当前助手数据
 * - assistant:import-from-card   从角色卡导入
 * - assistant:import-from-zip    从zip导入
 * - assistant:scan-live2d-expressions  扫描Live2D表情
 *
 * 事件清单：
 * - assistant:download-progress  下载进度 {assistantName, progress}
 * - assistant:upload-progress    上传进度 {assistantName, progress}
 * - assistant:data-updated       数据更新 {assistants, currentAssistant}
 * - assistant:switched           助手切换 AssistantInfo | null
 */
export function setupAssistantServerIPC(): void {
  const assistantService = AssistantService.getInstance()

  /**
   * 加载助手数据（初始化）
   *
   * 快速返回本地缓存数据，后台异步执行云端同步和资源检查。
   */
  registerHandle(CHANNELS.ASSISTANT_LOAD_DATA, async (event) => {
    return await assistantService.loadAssistants((assistantName, progress) => {
      event.sender.send(CHANNELS.ASSISTANT_DOWNLOAD_PROGRESS_EVENT, { assistantName, progress })
    })
  })

  /**
   * 获取所有助手列表（直接从内存返回，不触发同步）
   */
  registerHandle(CHANNELS.ASSISTANT_GET_ALL, async () => {
    return {
      success: true,
      data: assistantService.getAssistants()
    }
  })

  registerHandle(CHANNELS.ASSISTANT_SWITCH, async (_event, name) => {
    return await assistantService.setCurrentAssistant(name)
  })

  /**
   * 注册聊天框快捷键
   */
  registerHandle(CHANNELS.ASSISTANT_REGISTER_CHAT_SHORTCUT, async (_event, shortcut: string) => {
    return assistantService.registerChatShortcut(shortcut)
  })

  /**
   * 添加助手
   */
  registerHandle(
    CHANNELS.ASSISTANT_ADD,
    async (event, assistantData, options?: { assetTypes?: string[] }) => {
      return await assistantService.addAssistant(
        assistantData,
        (progress) => {
          event.sender.send(CHANNELS.ASSISTANT_UPLOAD_PROGRESS_EVENT, {
            assistantName: assistantData.name,
            progress
          })
        },
        options?.assetTypes
      )
    }
  )

  /**
   * 更新助手信息
   */
  registerHandle(
    CHANNELS.ASSISTANT_UPDATE,
    async (event, assistantData, options?: { uploadAssets?: boolean; assetTypes?: string[] }) => {
      return await assistantService.updateAssistant(
        assistantData,
        options?.uploadAssets !== false,
        (progress) => {
          event.sender.send(CHANNELS.ASSISTANT_UPLOAD_PROGRESS_EVENT, {
            assistantName: assistantData.name,
            progress
          })
        },
        options?.assetTypes
      )
    }
  )

  /**
   * 删除助手
   */
  registerHandle(CHANNELS.ASSISTANT_DELETE, async (_, name) => {
    return await assistantService.deleteAssistant(name)
  })

  /**
   * 保存助手资源文件（通用方法）
   *
   * 支持保存任意类型的资源文件（图片、音频、Live2D等）。
   * 通过 subDir 参数指定资源子目录，如 "images"、"audio"、"live2d" 等。
   */
  registerHandle(
    CHANNELS.ASSISTANT_SAVE_RESOURCE_FILE,
    async (
      _event,
      payload: {
        fileData: Buffer | ArrayBuffer
        assistantName: string
        subDir: 'images' | 'audio' | 'live2d' | 'models' | 'other'
        fileName: string
        oldRelativePath?: string
      }
    ): Promise<{ success: true; path: string } | { success: false; error: string }> => {
      return await assistantService.saveAssistantResourceFile(
        payload.fileData,
        payload.assistantName,
        payload.subDir,
        payload.fileName,
        payload.oldRelativePath
      )
    }
  )

  /**
   * 获取助手资产配置
   */
  registerHandle(CHANNELS.ASSISTANT_GET_ASSETS, async (_event, assistantName: string) => {
    const cachedAssets = assistantService.getAssistantAssets(assistantName)
    if (cachedAssets) {
      return { success: true, data: cachedAssets }
    }
    return await assistantService.loadAssistantAssets(assistantName)
  })

  /**
   * 保存助手资产配置文件
   */
  registerHandle(CHANNELS.ASSISTANT_SAVE_ASSETS, async (_event, assets: AssistantAssets) => {
    return await assistantService.saveAssistantAssets(assets)
  })

  /**
   * 上传并解压Live2D模型
   */
  registerHandle(
    CHANNELS.ASSISTANT_SAVE_EXTRACT_LIVE2D,
    async (
      _event,
      fileData: Buffer | ArrayBuffer,
      assistantName: string
    ): Promise<{ success: boolean; path?: string; mainJsonPath?: string; error?: string }> => {
      return await assistantService.saveAndExtractLive2D(fileData, assistantName)
    }
  )

  /**
   * 下载助手资产文件
   *
   * 支持按资源类型选择性下载：传入 assetTypes 数组时仅下载指定类型的资源，
   * 不传或传空数组则下载全部资源。
   */
  registerHandle(
    CHANNELS.ASSISTANT_DOWNLOAD_ASSET,
    async (
      event,
      { assistantName, assetTypes }: { assistantName: string; assetTypes?: string[] }
    ) => {
      return await assistantService.downloadAssistantAssets(
        assistantName,
        (progress) => {
          event.sender.send(CHANNELS.ASSISTANT_DOWNLOAD_PROGRESS_EVENT, { assistantName, progress })
        },
        assetTypes ?? []
      )
    }
  )

  /**
   * 获取当前正在下载资源的助手列表
   */
  registerHandle(CHANNELS.ASSISTANT_GET_DOWNLOADING, async () => {
    return assistantService.getDownloadingAssets()
  })

  /**
   * 获取当前助手信息
   */
  registerHandle(CHANNELS.ASSISTANT_GET_CURRENT, async () => {
    const assistant = assistantService.getCurrentAssistant()
    if (!assistant) {
      return { success: false, error: '当前没有选中助手' }
    }
    return { success: true, data: assistant }
  })

  /**
   * 从云端刷新当前助手数据（好感度等）
   */
  registerHandle(CHANNELS.ASSISTANT_REFRESH_CURRENT, async () => {
    const assistant = await assistantService.refreshCurrentAssistant()
    if (!assistant) {
      return { success: false, error: '刷新当前助手数据失败' }
    }
    return { success: true, data: assistant }
  })

  /**
   * 从角色卡片导入助手信息
   */
  registerHandle(CHANNELS.ASSISTANT_IMPORT_FROM_CARD, async (_event, imageData: ArrayBuffer) => {
    try {
      const extractedInfo = await assistantService.extractHiddenInfo(Buffer.from(imageData))
      return { success: true, data: extractedInfo }
    } catch (error) {
      return { success: false, error: (error as Error).message }
    }
  })

  /**
   * 从 zip 角色压缩包导入助手目录与资源
   */
  registerHandle(CHANNELS.ASSISTANT_IMPORT_FROM_ZIP, async (_event, zipPath: string) => {
    return await assistantService.importAssistantFromZip(zipPath)
  })

  /**
   * 扫描 Live2D 表情文件
   *
   * 扫描当前助手的 Live2D 模型目录下的所有 .exp3.json 表情文件。
   */
  registerHandle(CHANNELS.ASSISTANT_SCAN_LIVE2D_EXPRESSIONS, async () => {
    try {
      const assistant = assistantService.getCurrentAssistant()
      if (!assistant) return new Map()

      const assets = assistantService.getAssistantAssets(assistant.name)
      const modelPath = assets?.live2d?.modelPath
      if (!modelPath) return new Map()

      const absoluteDir = path.join(resolveAppDataDir(), modelPath)
      if (!fs.existsSync(absoluteDir)) return new Map()

      const results = new Map<
        string,
        { parameters: { Id: string; Value: number; Blend: string }[] }
      >()

      const walkDir = (dir: string): void => {
        let entries: fs.Dirent[]
        try {
          entries = fs.readdirSync(dir, { withFileTypes: true })
        } catch {
          return
        }
        for (const entry of entries) {
          const full = path.join(dir, entry.name)
          if (entry.isDirectory()) {
            walkDir(full)
          } else if (entry.name.endsWith('.exp3.json')) {
            const name = entry.name.replace(/\.exp3\.json$/, '')
            try {
              const content = JSON.parse(fs.readFileSync(full, 'utf8'))
              if (Array.isArray(content?.Parameters) && content.Parameters.length > 0) {
                results.set(name, { parameters: content.Parameters })
              }
            } catch {
              // 读取失败不影响扫描结果
            }
          }
        }
      }

      walkDir(absoluteDir)
      return results
    } catch {
      return new Map()
    }
  })
}
