import fs from 'fs'
import axios from 'axios'
import FormData from 'form-data'
import AdmZip from 'adm-zip'
import path from 'path'
import { app, BrowserWindow, globalShortcut } from 'electron'
import { getConfig, setConfig } from '../config/configManager'
import log from '../utils/logger'
import { AssistantAssets, AssistantInfo } from '../../renderer/src/types/AssistantInfo'
import { createChatBoxWindow } from '../windows/chatBoxWindow'

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

function registerChatShortcut(shortcut: string): boolean {
  // 注销原有快捷键
  const currentShortcut = getConfig('chatShortcut')
  if (currentShortcut) {
    globalShortcut.unregister(currentShortcut)
  }
  // 注册聊天框快捷键
  const success = globalShortcut.register(shortcut, () => {
    createChatBoxWindow()
  })
  if (success) {
    setConfig('chatShortcut', shortcut)
  }
  return success
}

/**
 * 获取当前助手信息，从云端数据库读取
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
    // 切换成功后，向所有窗口广播助手切换事件
    BrowserWindow.getAllWindows().forEach((win) => {
      win.webContents.send('assistant:switched', response.data.data)
    })
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

/** 检查助手资产是否需要更新
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
 * 更新助手信息，同步云端与本地数据
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
 * 添加助手，同步云端与本地数据，并上传助手资产
 * @param assistant 助手信息
 */
async function addAssistant(
  assistant: AssistantInfo,
  onProgress?: (progress: number) => void
): Promise<{ success: boolean; error?: string }> {
  // 检查助手是否存在
  const assistantInfoPath = path.join(
    app.getPath('userData'),
    'assistants',
    assistant.name,
    'info.json'
  )
  if (fs.existsSync(assistantInfoPath)) {
    log.warn(`Assistant ${assistant.name} already exists.`)
    return { success: false, error: '助手已存在' }
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

    return { success: true }
  } catch (error) {
    log.error(`Error adding assistant ${assistant.name}:`, error)
    return { success: false, error: (error as Error).message }
  }
}

/** 加载助手数据并同步云端与本地数据
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
 * 上传助手资产，包括图片、Live2D模型等
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

/**
 * 删除助手，包括云端资产和本地资产
 * @param assistantName 助手名称
 * @returns 删除结果
 */
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

/**
 * 保存助手的图片资源到助手目录
 * @param fileData 文件数据（Buffer 或 ArrayBuffer）
 * @param assistantName 助手名称
 * @param fileName 文件名（不包含扩展名）
 * @returns 保存结果
 */
async function saveAssistantImage(
  fileData: Buffer | ArrayBuffer,
  assistantName: string,
  fileName: string
): Promise<{ success: true; path: string } | { success: false; error: string }> {
  try {
    const assistantDir = ensureAssistantDirExists(assistantName)
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
    return { success: true, path: `assistants/${assistantName}/assets/images/${fileName}.png` }
  } catch (error) {
    log.error('保存助手文件失败:', error)
    return { success: false, error: (error as Error).message }
  }
}

/**
 * 加载助手资产配置
 * @param assistantName 助手名称
 * @returns 资产配置或错误信息
 */
async function loadAssistantAssets(
  assistantName: string
): Promise<{ success: true; data: AssistantAssets } | { success: false; error: string }> {
  try {
    const assistantDir = ensureAssistantDirExists(assistantName)
    const assetsFilePath = path.join(assistantDir, 'assets', 'assets.json')

    if (fs.existsSync(assetsFilePath)) {
      const assetsData = fs.readFileSync(assetsFilePath, 'utf8')
      return { success: true, data: JSON.parse(assetsData) }
    } else {
      return { success: false, error: '资产配置文件不存在' }
    }
  } catch (error) {
    log.error('获取助手资产配置失败:', error)
    return { success: false, error: (error as Error).message }
  }
}

/**
 * 保存助手资产配置
 * @param assets 助手资产配置
 * @returns 保存结果
 */
async function saveAssistantAssets(
  assets: AssistantAssets
): Promise<{ success: true } | { success: false; error: string }> {
  try {
    const assistantDir = ensureAssistantDirExists(assets.assistantName)
    const assetsFilePath = path.join(assistantDir, 'assets', 'assets.json')
    fs.writeFileSync(assetsFilePath, JSON.stringify(assets, null, 2))
    return { success: true }
  } catch (error) {
    log.error('保存助手资产配置失败:', error)
    return { success: false, error: (error as Error).message }
  }
}

/**
 * 上传并解压Live2D模型
 * @param fileData 文件数据（Buffer 或 ArrayBuffer）
 * @param assistantName 助手名称
 * @returns 上传结果
 */
async function uploadAndExtractLive2D(
  fileData: Buffer | ArrayBuffer,
  assistantName: string
): Promise<{ success: boolean; path?: string; mainJsonPath?: string; error?: string }> {
  try {
    if (!assistantName || assistantName.trim() === '') {
      return { success: false, error: '助手名称不能为空' }
    }

    const assistantDir = ensureAssistantDirExists(assistantName)
    const live2dDir = path.join(assistantDir, 'assets', 'live2d')

    // 确保目标目录存在
    if (!fs.existsSync(live2dDir)) {
      fs.mkdirSync(live2dDir, { recursive: true })
    }

    // 如果传入的是 ArrayBuffer，则转换为 Buffer
    const bufferData = Buffer.isBuffer(fileData) ? fileData : Buffer.from(fileData)

    // 解压文件
    const zip = new AdmZip(bufferData)

    // 如果目录已存在，先删除
    if (fs.existsSync(live2dDir)) {
      fs.rmSync(live2dDir, { recursive: true, force: true })
    }

    fs.mkdirSync(live2dDir, { recursive: true })

    // 解压到模型目录
    zip.extractAllTo(live2dDir, true)

    // 查找主JSON文件
    let mainJsonPath = ''
    const files = fs.readdirSync(live2dDir, { recursive: true })
    for (const file of files) {
      const fileName = file.toString()
      if (fileName.endsWith('model3.json')) {
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

export {
  registerChatShortcut,
  getCurrentAssistant,
  switchAssistant,
  downloadAssistantAssets,
  loadAssistantsData,
  ensureAssistantDirExists,
  isNeedsUpdate,
  addAssistant,
  updateAssistantInfo,
  uploadAssistantAssets,
  deleteAssistant,
  saveAssistantImage,
  loadAssistantAssets,
  saveAssistantAssets,
  uploadAndExtractLive2D
}
