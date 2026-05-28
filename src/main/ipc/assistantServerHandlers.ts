import { ipcMain } from 'electron'
import fs from 'fs'
import path from 'path'
import { AssistantService } from '../services/assistantService'
import { AssistantAssets } from '../../renderer/src/types/AssistantInfo'
import { resolveAppDataDir } from '../utils/pathResolve'

/**
 * 设置助手服务IPC
 */
export function setupAssistantServerIPC(): void {
  const assistantService = AssistantService.getInstance()

  /**
   * 初始化助手服务
   */
  ipcMain.handle('assistant:init', async (event) => {
    return await assistantService.loadAssistants((assistantName, progress) => {
      event.sender.send('assistant:download-progress', {
        assistantName,
        progress
      })
    })
  })

  /**
   * 注册聊天框快捷键
   */
  ipcMain.handle('assistant:register-chat-shortcut', async (_event, shortcut: string) => {
    return assistantService.registerChatShortcut(shortcut)
  })

  /**
   * 添加助手
   */
  ipcMain.handle('assistant:add-assistant', async (event, assistantData) => {
    return await assistantService.addAssistant(assistantData, (progress) => {
      event.sender.send('assistant:upload-progress', {
        assistantName: assistantData.name,
        progress
      })
    })
  })

  /**
   * 更新助手信息
   */
  ipcMain.handle(
    'assistant:update-assistant',
    async (event, assistantData, options?: { uploadAssets?: boolean }) => {
      return await assistantService.updateAssistant(
        assistantData,
        options?.uploadAssets !== false,
        (progress) => {
          event.sender.send('assistant:upload-progress', {
            assistantName: assistantData.name,
            progress
          })
        }
      )
    }
  )

  /**
   * 删除助手
   */
  ipcMain.handle('assistant:delete-assistant', async (_, name) => {
    return await assistantService.deleteAssistant(name)
  })

  /**
   * 保存助手图片文件
   */
  ipcMain.handle(
    'assistant:save-image-file',
    async (
      _event,
      fileData: Buffer | ArrayBuffer,
      assistantName: string,
      fileName: string
    ): Promise<{ success: true; path: string } | { success: false; error: string }> => {
      return await assistantService.saveAssistantImage(fileData, assistantName, fileName)
    }
  )

  /**
   * 保存助手通用资源文件
   */
  ipcMain.handle(
    'assistant:save-resource-file',
    async (
      _event,
      fileDataOrPayload:
        | Buffer
        | ArrayBuffer
        | {
            fileData: Buffer | ArrayBuffer
            assistantName: string
            subDir: string
            fileName: string
            oldRelativePath?: string
          },
      assistantNameArg?: string,
      subDirArg?: string,
      fileNameArg?: string,
      oldRelativePathArg?: string
    ): Promise<{ success: true; path: string } | { success: false; error: string }> => {
      const isPayloadObject =
        typeof fileDataOrPayload === 'object' &&
        fileDataOrPayload !== null &&
        'fileData' in fileDataOrPayload &&
        'assistantName' in fileDataOrPayload

      const fileData = isPayloadObject
        ? (fileDataOrPayload.fileData as Buffer | ArrayBuffer)
        : (fileDataOrPayload as Buffer | ArrayBuffer)
      const assistantName = isPayloadObject
        ? fileDataOrPayload.assistantName
        : (assistantNameArg as string)
      const subDir = isPayloadObject ? fileDataOrPayload.subDir : (subDirArg as string)
      const fileName = isPayloadObject ? fileDataOrPayload.fileName : (fileNameArg as string)
      const oldRelativePath = isPayloadObject
        ? fileDataOrPayload.oldRelativePath
        : oldRelativePathArg

      return await assistantService.saveAssistantResourceFile(
        fileData,
        assistantName,
        subDir,
        fileName,
        oldRelativePath
      )
    }
  )

  /**
   * 获取助手资产配置
   */
  ipcMain.handle('assistant:get-assets', async (_event, assistantName: string) => {
    // 先尝试从缓存获取
    const cachedAssets = assistantService.getAssistantAssets(assistantName)
    if (cachedAssets) {
      return { success: true, data: cachedAssets }
    }
    // 如果缓存不存在，从文件加载
    return await assistantService.loadAssistantAssets(assistantName)
  })

  /**
   * 保存助手资产配置
   */
  ipcMain.handle('assistant:save-assets', async (_event, assets: AssistantAssets) => {
    return await assistantService.saveAssistantAssets(assets)
  })

  /**
   * 上传并解压Live2D模型
   */
  ipcMain.handle(
    'assistant:save-extract-live2d',
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
   */
  ipcMain.handle(
    'assistant:download-assistant-asset',
    async (event, { assistantName }: { assistantName: string }) => {
      return await assistantService.downloadAssistantAssets(assistantName, (progress) => {
        event.sender.send('assistant:download-progress', { assistantName, progress })
      })
    }
  )

  /**
   * 加载助手数据
   */
  ipcMain.handle('assistant:load-assistant-data', async () => {
    const result = await assistantService.loadAssistants()
    return {
      success: result.success,
      source: result.source,
      error: result.error,
      data: assistantService.getAssistants(),
      currentAssistant: assistantService.getCurrentAssistant()
    }
  })

  /**
   * 检查助手是否需要更新
   */
  ipcMain.handle('assistant:need-update', async (_event, assistant) => {
    return await assistantService.isNeedsUpdate(assistant)
  })

  /**
   * 获取当前助手信息
   */
  ipcMain.handle('assistant:get-current-assistant', async () => {
    const assistant = assistantService.getCurrentAssistant()
    if (!assistant) {
      return { success: false, error: '当前没有选中助手' }
    } else {
      return { success: true, data: assistant }
    }
  })

  /**
   * 切换当前助手
   */
  ipcMain.handle('assistant:switch-assistant', async (_event, assistantName: string) => {
    return await assistantService.setCurrentAssistant(assistantName)
  })

  /**
   * 从云端刷新当前助手数据（好感度等）
   */
  ipcMain.handle('assistant:refresh-current', async () => {
    const assistant = await assistantService.refreshCurrentAssistant()
    if (!assistant) {
      return { success: false, error: '刷新当前助手数据失败' }
    }
    return { success: true, data: assistant }
  })

  // 从角色卡片导入助手信息
  ipcMain.handle('assistant:import-from-card', async (_event, imageData: ArrayBuffer) => {
    try {
      const assistantService = AssistantService.getInstance()
      const extractedInfo = await assistantService.extractHiddenInfo(Buffer.from(imageData))
      return { success: true, data: extractedInfo }
    } catch (error) {
      return { success: false, error: (error as Error).message }
    }
  })

  // 从 zip 角色压缩包导入助手目录与资源
  ipcMain.handle('assistant:import-from-zip', async (_event, zipPath: string) => {
    return await assistantService.importAssistantFromZip(zipPath)
  })

  /**
   * 扫描模型文件所在目录下的所有 .exp3.json 表情文件，并读取每个文件的参数 ID。
   * @param modelJsonPath 模型 JSON 相对路径，如 "assistants/澪/assets/live2d/turong/turong.model3.json"
   * @returns 表情文件信息列表，包含文件名、相对路径和参数 ID
   */
  ipcMain.handle(
    'assistant:scan-live2d-expressions',
    async (): Promise<
      Map<
        string,
        {
          parameters: {
            Id: string
            Value: number
            Blend: string
          }[]
        }
      >
    > => {
      try {
        const assistant = assistantService.getCurrentAssistant()
        if (!assistant) return new Map()

        const assets = await assistantService.getAssistantAssets(assistant.name)

        const modelPath = assets?.live2d?.modelPath

        if (!modelPath) return new Map()

        const absoluteDir = path.join(resolveAppDataDir(), modelPath)

        if (!fs.existsSync(absoluteDir)) return new Map()

        const results: Map<
          string,
          {
            parameters: {
              Id: string
              Value: number
              Blend: string
            }[]
          }
        > = new Map()

        const walkDir = (dir: string): void => {
          let entries: fs.Dirent[]
          try {
            entries = fs.readdirSync(dir, { withFileTypes: true })
          } catch {
            // 读取目录失败（如权限问题），直接忽略该目录
            return
          }
          for (const entry of entries) {
            const full = path.join(dir, entry.name)
            if (entry.isDirectory()) {
              walkDir(full)
            } else if (entry.name.endsWith('.exp3.json')) {
              // 表情名，称取文件名去掉扩展部分，如 "shy.exp3.json" → "shy"
              const name = entry.name.replace(/\.exp3\.json$/, '')

              try {
                const content = JSON.parse(fs.readFileSync(full, 'utf8'))

                if (Array.isArray(content?.Parameters) && content.Parameters.length > 0) {
                  results.set(name, { parameters: content.Parameters })
                }
              } catch {
                // 读取失败不影响扫描结果
                console.error(`读取表情文件失败 ${full}`)
              }
            }
          }
        }

        walkDir(absoluteDir)
        return results
      } catch {
        return new Map()
      }
    }
  )
}
