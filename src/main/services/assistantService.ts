import fs from 'fs'
import axios from 'axios'
import FormData from 'form-data'
import AdmZip from 'adm-zip'
import path from 'path'
import { app } from 'electron'
import { getConfig } from '../config/configManager'
import log from '../utils/logger'

// 助手语音合成设置模型
interface GSVSetting {
  // 助手语音合成的语言
  textLang: string
  // 助手语音合成的GPT模型
  gptModelPath: string
  // 助手语音合成的SOVITS模型
  sovitsModelPath: string
  // 助手语音合成的参考音频
  refAudioPath: string
  // 助手语音合成的参考文字
  promptText: string
  // 助手语音合成的参考文字语言
  promptLang: string
  // 助手语音合成的随机种子
  seed: number
  // 助手语音合成的TopK
  topK: number
  // 助手语音合成的批量大小
  batchSize: number
  // 助手语音合成的额外参数
  extra: Record<string, string>
  // 助手语音合成的额外参考音频
  extraRefAudio: Record<string, string>
}

// 助手设置模型
interface AssistantSettings {
  // 助手是否开启日记功能
  enableLongMemory: boolean
  // 助手是否开启日记功能的检索加强
  enableLongMemorySearchEnhance: boolean
  // 助手是否开启核心记忆功能
  enableCoreMemory: boolean
  // 助手日记功能的搜索阈值
  longMemoryThreshold: number
  // 助手是否开启世界书(知识库)功能
  enableLoreBooks: boolean
  // 助手世界书(知识库)功能的搜索阈值
  loreBooksThreshold: number
  // 助手世界书(知识库)功能的搜索深度
  loreBooksDepth: number
  // 助手是否开启情绪系统
  enableEmotionSystem: boolean
  // 助手是否开启情绪系统的持续存储
  enableEmotionPersist: boolean
  // 助手的上下文长度
  contextLength: number
}

interface AssistantInfo {
  // 助手名称
  name: string
  // 对用户的称呼
  user: string
  // 头像
  avatar: string
  // 生日
  birthday: number | string
  // 身高
  height: number | string
  // 体重
  weight: number | string
  // 角色性格
  personality: string
  // 描述
  description: string
  // 用户的设定，用于在提示词中填充用户的信息，进行个性化对话
  mask: string
  // 初次相遇时间，存储为时间戳
  firstMeetTime: number
  // 好感度
  love: number
  // 对话案例
  messageExamples: string[]
  // 额外描述
  extraDescription: string
  // 更新,存储为时间戳
  updatedAt: number
  // 资产最后修改时间,存储为时间戳
  assetsLastModified: number
  // 自定义提示词
  customPrompt: string
  // 开场白，数组形式
  startWith: string[]
  // 助手设置
  settings: AssistantSettings
  // 助手GSV设置
  gsvSetting: GSVSetting
}

/**
 * 获取当前助手信息
 * @returns 当前助手信息或 null
 */
async function getCurrentAssistant(): Promise<AssistantInfo | null> {
  try {
    const url = `http://${getConfig('baseUrl')}/api/assistant/current`
    const response = await axios.get(url)
    return response.data.data || null
  } catch (error) {
    log.error('获取当前助手失败:', (error as Error).message)
    return null
  }
}

/**
 * 切换当前助手
 * @param assistantName 助手名称
 * @returns 切换结果和助手信息
 */
async function switchAssistant(
  assistantName: string
): Promise<{ success: boolean; data?: AssistantInfo; error?: string }> {
  try {
    const url = `http://${getConfig('baseUrl')}/api/assistant/switch`
    const response = await axios.post(url, { name: assistantName })
    return {
      success: true,
      data: response.data.data
    }
  } catch (error) {
    log.error('切换助手失败:', (error as Error).message)
    return {
      success: false,
      error: (error as Error).message
    }
  }
}

/** 工具函数，确保助手目录存在
 * @param assistantName 助手名称
 * @returns 助手目录路径
 */
function ensureAssistantDirExists(assistantName: string): string {
  // 获取应用安装目录
  const appPath = app.getPath('userData')
  const assistantDir = path.join(appPath, 'assistants', assistantName)

  if (!fs.existsSync(assistantDir)) {
    fs.mkdirSync(assistantDir, { recursive: true })
  }

  return assistantDir
}

/**
 * 下载助手资产
 * @param assistantName 助手名称
 * @param url 资产下载URL
 * @param onProgress 进度回调函数
 * @returns 下载结果
 */
function downloadAssistantAssets(
  assistantName: string,
  onProgress: (progress: number) => void
): Promise<{ success: boolean }> {
  return new Promise((resolve, reject) => {
    try {
      // 定义下载和保存路径
      const downloadsDir = path.join(app.getPath('userData'), 'cache')
      const tempZipPath = path.join(downloadsDir, `${assistantName}.zip`)
      const assistantDir = ensureAssistantDirExists(assistantName)
      const assetsDir = path.join(assistantDir, 'assets')

      // 确保目标目录存在
      if (!fs.existsSync(downloadsDir)) {
        fs.mkdirSync(downloadsDir, { recursive: true })
      }
      const url = `http://${getConfig('baseUrl')}/api/assistant/assets/download`
      // 使用axios发送POST请求并监控进度
      const writer = fs.createWriteStream(tempZipPath)

      axios({
        url,
        method: 'POST',
        data: { name: assistantName },
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

          writer.on('finish', () => {
            try {
              // 解压文件
              if (fs.existsSync(assetsDir)) {
                fs.rmSync(assetsDir, { recursive: true, force: true })
                fs.mkdirSync(assetsDir, { recursive: true })
              }

              const zip = new AdmZip(tempZipPath)
              zip.extractAllTo(assistantDir, true)

              // 清理临时文件
              fs.unlinkSync(tempZipPath)

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

/** * 检查助手是否需要更新
 * @param assistant 助手信息
 * @returns 是否需要更新
 */
async function isNeedsUpdate(assistant: AssistantInfo): Promise<boolean> {
  const url = `http://${getConfig('baseUrl')}/api/assistant/assets/check`
  try {
    const response = await axios.post(url, {
      name: assistant.name,
      lastModified: assistant.assetsLastModified
    })
    return response.data.needsUpdate
  } catch (error) {
    log.error('Error checking assistant update:', error)
    return false
  }
}

/**
 * 更新助手信息
 * @param assistant 助手信息
 */
async function updateAssistantInfo(assistant: AssistantInfo): Promise<boolean> {
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
      // 更新时间戳
      updatedAt: Date.now()
    }

    // 上传到云端
    const url = `http://${getConfig('baseUrl')}/api/assistant/info/update`
    await axios.post(url, completeAssistant)

    // 保存在本地
    const assistantDir = ensureAssistantDirExists(completeAssistant.name)
    const filePath = path.join(assistantDir, 'info.json')
    fs.writeFileSync(filePath, JSON.stringify(completeAssistant, null, 2))

    return true
  } catch (error) {
    log.error(`Error updating assistant ${assistant.name}:`, (error as Error).message)
    return false
  }
}

/**
 * 添加助手
 * @param assistant 助手信息
 */
async function addAssistant(
  assistant: AssistantInfo,
  onProgress?: (progress: number) => void
): Promise<boolean> {
  // 检查助手是否存在
  const assistantInfoPath = path.join(
    app.getPath('userData'),
    'assistants',
    assistant.name,
    'info.json'
  )
  if (fs.existsSync(assistantInfoPath)) {
    log.warn(`Assistant ${assistant.name} already exists.`)
    return false
  }
  try {
    // 确保必要的字段存在
    const completeAssistant = {
      ...assistant,
      user: assistant.user,
      mask: assistant.mask,
      messageExamples: assistant.messageExamples,
      customPrompt: assistant.customPrompt,
      startWith: assistant.startWith,
      settings: assistant.settings,
      gsvSetting: assistant.gsvSetting,
      // 更新时间戳
      updatedAt: Date.now(),
      assetsLastModified: Date.now()
    }

    // 上传到云端
    const url = `http://${getConfig('baseUrl')}/api/assistant/info/add`
    await axios.post(url, completeAssistant)

    // 保存在本地
    const assistantDir = ensureAssistantDirExists(completeAssistant.name)
    const filePath = path.join(assistantDir, 'info.json')
    fs.writeFileSync(filePath, JSON.stringify(completeAssistant, null, 2))

    // 上传助手资源
    await uploadAssistantAssets(completeAssistant, onProgress)

    return true
  } catch (error) {
    log.error(`Error adding assistant ${assistant.name}:`, (error as Error).message)
    return false
  }
}

/** * 加载助手数据并同步云端与本地数据
 * @returns 助手信息数组
 */
async function loadAssistantsData(
  onProgress?: (assistantName: string, progress: number) => void
): Promise<AssistantInfo[]> {
  // 创建一个对象用于跟踪云端存在的助手
  const cloudAssistantMap = new Map<string, AssistantInfo>()

  try {
    // 从云端加载助手数据
    const url = `http://${getConfig('baseUrl')}/api/assistants`
    const response = await axios.get(url)
    const apiData = response.data

    if (apiData.data && Array.isArray(apiData.data)) {
      // 将云端数据映射到Map中以便快速查找
      apiData.data.forEach((assistant) => {
        cloudAssistantMap.set(assistant.name, assistant)
      })

      // 从本地获取当前的助手数据
      const assistantDir = path.join(app.getPath('userData'), 'assistants')
      const localAssistants = new Map<string, AssistantInfo>()

      if (fs.existsSync(assistantDir)) {
        const assistantNames = fs.readdirSync(assistantDir)
        for (const name of assistantNames) {
          const assistantInfoFile = path.join(assistantDir, name, 'info.json')
          if (fs.existsSync(assistantInfoFile)) {
            try {
              const info = JSON.parse(fs.readFileSync(assistantInfoFile, 'utf8'))
              localAssistants.set(name, info)
            } catch (parseError) {
              log.error(`Error parsing assistant ${name} info:`, parseError)
            }
          }
        }
      }

      // 同步策略1: 处理云端存在的助手（新增或更新）
      for (const [assistantName, cloudAssistant] of cloudAssistantMap.entries()) {
        try {
          const assistantDir = ensureAssistantDirExists(assistantName)
          const infoPath = path.join(assistantDir, 'info.json')

          // 检查本地是否存在该助手
          const localAssistant = localAssistants.get(assistantName)

          // 确定是否需要更新本地数据
          let shouldUpdate = true
          // 如果本地存在，则比较更新时间戳
          if (localAssistant) {
            const cloudTime = new Date(cloudAssistant.updatedAt).getTime()
            const localTime = new Date(localAssistant.updatedAt).getTime()
            shouldUpdate = cloudTime > localTime
          }

          // 更新本地数据
          if (shouldUpdate) {
            fs.writeFileSync(infoPath, JSON.stringify(cloudAssistant, null, 2))
          }

          // 检查助手资源是否存在或需要更新
          const assetsDir = path.join(assistantDir, 'assets')
          const assetsExist = fs.existsSync(assetsDir) && fs.readdirSync(assetsDir).length > 0

          // 如果资源不存在或需要更新，则从云端下载
          if (!assetsExist || (await isNeedsUpdate(cloudAssistant))) {
            if (onProgress) {
              onProgress(assistantName, 0) // 开始下载
            }

            await downloadAssistantAssets(assistantName, (progress) => {
              if (onProgress) {
                onProgress(assistantName, progress)
              }
            })
          }
        } catch (saveError) {
          log.error(`Error saving assistant ${assistantName} info:`, saveError)
        }
      }

      // 同步策略2: 处理云端不存在但本地存在的助手
      // 删除本地助手
      for (const [assistantName] of localAssistants.entries()) {
        if (!cloudAssistantMap.has(assistantName)) {
          // 删除本地助手数据
          fs.rmSync(path.join(app.getPath('userData'), 'assistants', assistantName), {
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

  // 最终从本地获取所有助手数据
  const assistantDir = path.join(app.getPath('userData'), 'assistants')
  if (!fs.existsSync(assistantDir)) {
    return []
  }

  const assistantNames = fs.readdirSync(assistantDir)
  const assistants = assistantNames
    .map((name) => {
      const assistantInfoFile = path.join(assistantDir, name, 'info.json')
      if (fs.existsSync(assistantInfoFile)) {
        try {
          const info = JSON.parse(fs.readFileSync(assistantInfoFile, 'utf8'))
          return info
        } catch (parseError) {
          log.error(`Error parsing assistant ${name} info:`, parseError)
          return null
        }
      }
      return null
    })
    .filter((info) => info !== null) // 过滤掉解析失败的助手

  return assistants as AssistantInfo[]
}

/**
 * 上传助手资产
 * @param assistant 助手信息
 */
async function uploadAssistantAssets(
  assistant: AssistantInfo,
  onProgress?: (progress: number) => void
): Promise<boolean> {
  const assistantDir = ensureAssistantDirExists(assistant.name)
  const assetsDir = path.join(assistantDir, 'assets')

  if (!fs.existsSync(assetsDir)) {
    log.warn('No assets directory found for assistant:', assistant.name)
    return false
  }
  try {
    // 压缩资产文件夹
    const zip = new AdmZip()
    zip.addLocalFolder(assetsDir)
    const zipBuffer = zip.toBuffer()
    // 上传到云端
    const url = `http://${getConfig('baseUrl')}/api/assistant/assets/upload`

    const formData = new FormData()
    formData.append('name', assistant.name) // 替换为实际的助手名称
    formData.append('assets_zip', zipBuffer, {
      filename: `${assistant.name}_assets.zip`
    })

    const headers = formData.getHeaders()

    const response = await axios.post(url, formData, {
      headers,
      onUploadProgress: (progressEvent) => {
        if (progressEvent.total && onProgress) {
          const progress = Math.round((progressEvent.loaded * 100) / progressEvent.total)
          onProgress(progress)
        }
      }
    })
    log.info('Assistant assets uploaded successfully:', response.data)
    return true
  } catch (error) {
    log.error(`Error uploading assistant ${assistant.name} assets:`, (error as Error).message)
    return false
  }
}

async function deleteAssistant(
  assistantName: string
): Promise<{ success: boolean; message?: string }> {
  try {
    // 先删除云端资产
    const url = `http://${getConfig('baseUrl')}/api/assistant/info/delete`
    await axios.post(url, { name: assistantName })

    // 再删除本地资产
    const assistantDir = ensureAssistantDirExists(assistantName)
    fs.rmSync(assistantDir, {
      recursive: true,
      force: true
    })

    log.info(`Assistant ${assistantName} deleted successfully.`)
    return { success: true }
  } catch (error) {
    log.error(`Error deleting assistant ${assistantName}:`, (error as Error).message)
    return { success: false, message: (error as Error).message }
  }
}

export {
  getCurrentAssistant,
  switchAssistant,
  downloadAssistantAssets,
  loadAssistantsData,
  ensureAssistantDirExists,
  isNeedsUpdate,
  addAssistant,
  updateAssistantInfo,
  uploadAssistantAssets,
  deleteAssistant
}
