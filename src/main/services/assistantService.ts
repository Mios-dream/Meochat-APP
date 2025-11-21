import fs from 'fs'
import axios from 'axios'
import FormData from 'form-data'
import AdmZip from 'adm-zip'
import path from 'path'
import { app } from 'electron'
import { getConfig } from '../config/configManager'

interface AssistantInfo {
  // 名字
  name: string
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
  // 初次相遇时间，存储为时间戳
  firstMeetTime: number
  // 好感度
  love: number
  // 对话案例
  conversationExamples: string[]
  // 额外描述
  extraDescription: string
  // 更新,存储为时间戳
  updatedAt: number
  // 资产最后修改时间,存储为时间戳
  assetsLastModified: number
}

/** 工具函数，确保助手目录存在
 * @param assistantName 助手名称
 * @returns 助手目录路径
 */
function ensureAssistantDirExists(assistantName: string): string {
  // 获取应用安装目录
  const appPath = app.getAppPath()
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
      const downloadsDir = path.join(app.getAppPath(), 'cache')
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
    console.error('Error checking assistant update:', error)
    return false
  }
}

/**
 * 更新助手信息
 * @param assistant 助手信息
 */
async function updateAssistantInfo(assistant: AssistantInfo): Promise<boolean> {
  try {
    // 上传到云端
    const url = `http://${getConfig('baseUrl')}/api/assistant/info/update`

    await axios.post(url, assistant)
    // 保存在本地，然后上传
    const assistantDir = ensureAssistantDirExists(assistant.name)
    // 将数据保存为JSON文件
    const filePath = path.join(assistantDir, 'info.json')
    fs.writeFileSync(filePath, JSON.stringify(assistant, null, 2))
    return true
  } catch (error) {
    console.error(`Error updating assistant ${assistant.name}:`, (error as Error).message)
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
  const assistantDir = ensureAssistantDirExists(assistant.name)
  if (fs.existsSync(assistantDir)) {
    console.warn(`Assistant ${assistant.name} already exists.`)
    return false
  }
  try {
    // 上传到云端
    const url = `http://${getConfig('baseUrl')}/api/assistant/info/add`
    await axios.post(url, assistant)
    // 保存在本地，然后上传
    const assistantDir = ensureAssistantDirExists(assistant.name)
    // 将数据保存为JSON文件
    const filePath = path.join(assistantDir, 'info.json')
    // 更新资产最后修改时间
    assistant.assetsLastModified = Date.now()
    fs.writeFileSync(filePath, JSON.stringify(assistant, null, 2))
    // 上传助手资源
    await uploadAssistantAssets(assistant, onProgress)

    return true
  } catch (error) {
    console.error(`Error adding assistant ${assistant.name}:`, (error as Error).message)
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
      const assistantDir = path.join(app.getAppPath(), 'assistants')
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
              console.error(`Error parsing assistant ${name} info:`, parseError)
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
          console.error(`Error saving assistant ${assistantName} info:`, saveError)
        }
      }

      // 同步策略2: 处理云端不存在但本地存在的助手
      // 删除本地助手
      for (const [assistantName] of localAssistants.entries()) {
        if (!cloudAssistantMap.has(assistantName)) {
          // 删除本地助手数据
          fs.rmSync(path.join(app.getAppPath(), 'assistants', assistantName), {
            recursive: true,
            force: true
          })
          console.log(`Assistant ${assistantName} removed as it no longer exists in the cloud.`)
        }
      }
    }
  } catch (error) {
    console.error('Error loading assistant data from cloud:', (error as Error).message)
    // 云端同步失败时，仍然返回本地数据
  }

  // 最终从本地获取所有助手数据
  const assistantDir = path.join(app.getAppPath(), 'assistants')
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
          console.error(`Error parsing assistant ${name} info:`, parseError)
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
    console.warn('No assets directory found for assistant:', assistant.name)
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
    console.log('Assistant assets uploaded successfully:', response.data)
    return true
  } catch (error) {
    console.error(`Error uploading assistant ${assistant.name} assets:`, (error as Error).message)
    return false
  }
}

async function deleteAssistant(assistantName: string): Promise<boolean> {
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

    console.log(`Assistant ${assistantName} deleted successfully.`)
    return true
  } catch (error) {
    console.error(`Error deleting assistant ${assistantName}:`, (error as Error).message)
    return false
  }
}

export {
  downloadAssistantAssets,
  loadAssistantsData,
  ensureAssistantDirExists,
  isNeedsUpdate,
  addAssistant,
  updateAssistantInfo,
  uploadAssistantAssets,
  deleteAssistant
}
