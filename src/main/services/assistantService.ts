import fs from 'fs'
import axios from 'axios'
import FormData from 'form-data'
import AdmZip from 'adm-zip'
import path from 'path'
import { app, globalShortcut, BrowserWindow } from 'electron'
import { getConfig, setConfig } from '../config/configManager'
import log from '../utils/logger'
import { AssistantAssets, AssistantInfo } from '../../renderer/src/types/AssistantInfo'
import { createChatBoxWindow } from '../windows/chatBoxWindow'

// 默认助手数据
const DEFAULT_ASSISTANTS: AssistantInfo[] = [
  {
    name: '澪',
    user: '阁下',
    avatar: '',
    birthday: '2022-03-15',
    height: 160,
    weight: 40,
    description: `银发红瞳的可爱少女，经常穿着可爱的黑色长 裙，带着黑色的蝴蝶发饰。身份是澪之梦工作
                室的头号看板娘，她自己好像也非常自豪这 件事（才没有）。性格天真可爱（是个笨蛋）
                同时还是有些小腹黑？尽管澪大部分时候都是 活泼可爱的代名词，但有时候澪的眼中也会流
                露出淡淡的悲伤。原因就连她自己也不知道， 这或许和她以前的经历有关？这位天真可爱的
                女孩并不像看起来那么简单，她的身上还有更 多的秘密等待着阁下的探索.......`,
    firstMeetTime: new Date('2022-03-15').getTime(),
    love: 0,
    personality: '天真可爱',
    messageExamples: [],
    extraDescription: '',
    updatedAt: new Date('2022-03-15').getTime(),
    assetsLastModified: new Date('2022-03-15').getTime(),
    mask: '',
    customPrompt: '',
    startWith: [],
    settings: {
      enableLongMemory: true,
      enableLongMemorySearchEnhance: true,
      enableCoreMemory: true,
      longMemoryThreshold: 0.38,
      enableLoreBooks: true,
      loreBooksThreshold: 0.5,
      loreBooksDepth: 3,
      enableEmotionSystem: false,
      enableEmotionPersist: false,
      contextLength: 40
    },
    gsvSetting: {
      textLang: 'zh',
      gptModelPath: 'models/【萝莉】女仆_Ver-1.4-e15.ckpt',
      sovitsModelPath: 'models/【萝莉】女仆_Ver-1.4_e24_s504.pth',
      refAudioPath: 'models/tmp/020.wav',
      promptText: '嗯，谢谢您的夸奖，主人可以喜欢就好。',
      promptLang: 'zh',
      seed: -1,
      topK: 30,
      batchSize: 20,
      extra: {
        text_split_method: 'cut0'
      },
      extraRefAudio: {}
    }
  }
]

class AssistantService {
  private static instance: AssistantService

  // 助手列表
  private assistants: AssistantInfo[] = []
  // 当前助手
  private currentAssistant: AssistantInfo | null = null
  // 助手资产映射
  private assistantAssetsMap: Map<string, AssistantAssets> = new Map()

  private constructor() {
    this.assistants = []
  }

  public static getInstance(): AssistantService {
    if (!AssistantService.instance) {
      AssistantService.instance = new AssistantService()
    }
    return AssistantService.instance
  }

  /**
   * 工具函数，确保助手目录存在
   * @param assistantName 助手名称
   * @returns 助手目录路径
   */
  private ensureAssistantDirExists(assistantName: string): string {
    // 获取应用安装目录
    const appPath = app.getPath('userData')
    const assistantDir = path.join(appPath, 'assistants', assistantName)

    if (!fs.existsSync(assistantDir)) {
      fs.mkdirSync(assistantDir, { recursive: true })
    }

    return assistantDir
  }

  /**
   * 注册聊天框快捷键
   */
  public registerChatShortcut(shortcut: string): boolean {
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
   * 从云端和本地加载助手数据
   */
  public async loadAssistants(
    onProgress?: (assistantName: string, progress: number) => void
  ): Promise<{ success: boolean; error?: string }> {
    try {
      // 1. 首先尝试从服务器获取当前助手
      const serverCurrentAssistant = await this.getCurrentAssistantFromCloud()

      // 2. 加载所有助手数据
      this.assistants = await this.loadAssistantsData(onProgress)

      if (this.assistants.length === 0) {
        this.assistants = DEFAULT_ASSISTANTS
        // 保存默认助手到本地
        for (const assistant of DEFAULT_ASSISTANTS) {
          this.saveAssistantToLocal(assistant)
        }
      }

      // 3. 设置当前助手：优先使用服务器返回的当前助手，如果没有则使用配置中的，最后使用第一个助手
      const savedAssistantName = getConfig('currentAssistant')
      if (serverCurrentAssistant && this.getAssistantInfo(serverCurrentAssistant.name)) {
        await this.setCurrentAssistant(serverCurrentAssistant.name)
      } else if (savedAssistantName && this.getAssistantInfo(savedAssistantName)) {
        await this.setCurrentAssistant(savedAssistantName)
      } else if (this.assistants.length > 0) {
        await this.setCurrentAssistant(this.assistants[0].name)
      }
      return { success: true }
    } catch (error) {
      log.error('加载助手数据失败:', error)
      return { success: false, error: (error as Error).message }
    }
  }

  /**
   * 获取当前助手信息，从云端数据库读取
   */
  private async getCurrentAssistantFromCloud(): Promise<AssistantInfo | null> {
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
   * 获取当前助手信息
   */
  public getCurrentAssistant(): AssistantInfo | null {
    return this.currentAssistant
  }

  /**
   * 获取所有助手信息
   */
  public getAssistants(): AssistantInfo[] {
    return [...this.assistants]
  }

  /**
   * 获取指定助手信息
   */
  public getAssistantInfo(name: string): AssistantInfo | null {
    return this.assistants.find((assistant) => assistant.name === name) || null
  }

  /**
   * 切换当前助手
   */
  public async setCurrentAssistant(
    name: string
  ): Promise<{ success: boolean; data: AssistantInfo } | { success: false; error: string }> {
    const assistant = this.getAssistantInfo(name)
    if (!assistant) {
      return { success: false, error: '助手不存在' }
    }

    try {
      // 尝试从云端切换
      await this.switchAssistantInCloud(name)

      // 无论云端切换是否成功，都更新本地状态
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
   * 切换当前助手（云端）
   */
  private async switchAssistantInCloud(
    assistantName: string
  ): Promise<{ success: boolean; data: AssistantInfo } | { success: false; error: string }> {
    try {
      const url = `http://${getConfig('baseUrl')}/api/assistant/switch`
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
   * 下载助手资产
   */
  private async downloadAssistantAssets(
    assistantName: string,
    onProgress: (progress: number) => void
  ): Promise<{ success: boolean }> {
    return new Promise((resolve, reject) => {
      try {
        // 定义下载和保存路径
        const downloadsDir = path.join(app.getPath('userData'), 'cache')
        const tempZipPath = path.join(downloadsDir, `${assistantName}.zip`)
        const assistantDir = this.ensureAssistantDirExists(assistantName)
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
   * 更新助手资产修改时间
   */
  private updateAssistantAssetsLastModified(assistantName: string): boolean {
    const assistant = this.getAssistantInfo(assistantName)
    if (assistant) {
      assistant.assetsLastModified = Date.now()
      this.saveAssistantToLocal(assistant)
      return true
    } else {
      log.error(`助手 ${assistantName} 不存在`)
      return false
    }
  }

  /**
   * 检查助手资产是否需要更新
   */
  public async isNeedsUpdate(assistant: AssistantInfo): Promise<boolean> {
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
   */
  public async updateAssistant(
    assistant: AssistantInfo
  ): Promise<{ success: boolean; error?: string }> {
    try {
      // 确保必要的字段存在
      const completeAssistant = {
        ...assistant,
        user: assistant.user || '阁下',
        settings: assistant.settings,
        gsvSetting: assistant.gsvSetting,
        // 更新时间戳
        updatedAt: Date.now()
      }

      // 上传到云端
      const url = `http://${getConfig('baseUrl')}/api/assistant/info/update`
      await axios.post(url, completeAssistant)

      // 保存在本地
      this.saveAssistantToLocal(completeAssistant)
      // 上传助手资产
      const uploadResult = await this.uploadAssistantAssets(completeAssistant.name)
      if (!uploadResult.success) {
        return { success: false, error: `上传助手资产失败: ${uploadResult.error}` }
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
   * 保存助手信息到本地
   */
  private saveAssistantToLocal(assistant: AssistantInfo): void {
    const assistantDir = this.ensureAssistantDirExists(assistant.name)
    const filePath = path.join(assistantDir, 'info.json')
    fs.writeFileSync(filePath, JSON.stringify(assistant, null, 2))
  }

  /**
   * 添加助手，同步云端与本地数据，并上传助手资产
   */
  public async addAssistant(
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
        // 更新时间戳
        updatedAt: Date.now(),
        assetsLastModified: Date.now()
      }

      // 上传到云端
      const url = `http://${getConfig('baseUrl')}/api/assistant/info/add`
      await axios.post(url, completeAssistant)

      // 保存在本地
      this.saveAssistantToLocal(completeAssistant)

      // 添加到内存中
      this.assistants.push(completeAssistant)

      // 上传助手资源
      const uploadResult = await this.uploadAssistantAssets(completeAssistant.name, onProgress)
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
   * 加载助手数据并同步云端与本地数据
   */
  private async loadAssistantsData(
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
        apiData.data.forEach((assistant: AssistantInfo) => {
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
            const assistantDir = this.ensureAssistantDirExists(assistantName)
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
            if (!assetsExist || (await this.isNeedsUpdate(cloudAssistant))) {
              if (onProgress) {
                onProgress(assistantName, 0) // 开始下载
              }

              await this.downloadAssistantAssets(assistantName, (progress) => {
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
   */
  private async uploadAssistantAssets(
    assistantName: string,
    onProgress?: (progress: number) => void
  ): Promise<{ success: false; error: string } | { success: true }> {
    const assistantDir = this.ensureAssistantDirExists(assistantName)
    const assetsDir = path.join(assistantDir, 'assets')

    if (!fs.existsSync(assetsDir)) {
      log.warn(`No assets directory found for assistant ${assistantName}`)
      return { success: false, error: 'No assets directory found' }
    }
    try {
      // 压缩资产文件夹
      const zip = new AdmZip()
      zip.addLocalFolder(assetsDir)
      const zipBuffer = zip.toBuffer()
      // 上传到云端
      const url = `http://${getConfig('baseUrl')}/api/assistant/assets/upload`

      const formData = new FormData()
      formData.append('name', assistantName) // 替换为实际的助手名称
      formData.append('assets_zip', zipBuffer, {
        filename: `${assistantName}_assets.zip`
      })

      const headers = formData.getHeaders()

      await axios.post(url, formData, {
        headers,
        onUploadProgress: (progressEvent) => {
          if (progressEvent.total && onProgress) {
            const progress = Math.round((progressEvent.loaded * 100) / progressEvent.total)
            onProgress(progress)
          }
        }
      })
      return { success: true }
    } catch (error) {
      return { success: false, error: (error as Error).message }
    }
  }

  /**
   * 删除助手，包括云端资产和本地资产
   */
  public async deleteAssistant(
    assistantName: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      // 先删除云端资产
      const url = `http://${getConfig('baseUrl')}/api/assistant/info/delete`
      await axios.post(url, { name: assistantName })

      // 再删除本地资产
      const assistantDir = this.ensureAssistantDirExists(assistantName)
      fs.rmSync(assistantDir, {
        recursive: true,
        force: true
      })

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
   * 保存助手的图片资源到助手目录
   */
  public async saveAssistantImage(
    fileData: Buffer | ArrayBuffer,
    assistantName: string,
    fileName: string
  ): Promise<{ success: true; path: string } | { success: false; error: string }> {
    try {
      const assistantDir = this.ensureAssistantDirExists(assistantName)
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
   */
  public async loadAssistantAssets(
    assistantName: string
  ): Promise<{ success: true; data: AssistantAssets } | { success: false; error: string }> {
    try {
      const assistantDir = this.ensureAssistantDirExists(assistantName)
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
      log.error('获取助手资产配置失败:', error)
      return { success: false, error: (error as Error).message }
    }
  }

  /**
   * 保存助手资产配置
   */
  public async saveAssistantAssets(
    assets: AssistantAssets
  ): Promise<{ success: true } | { success: false; error: string }> {
    try {
      const assistantDir = this.ensureAssistantDirExists(assets.assistantName)
      const assetsFilePath = path.join(assistantDir, 'assets', 'assets.json')
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
   * 获取助手资产配置
   */
  public getAssistantAssets(assistantName: string): AssistantAssets | null {
    return this.assistantAssetsMap.get(assistantName) || null
  }

  /**
   * 保存并解压Live2D模型
   */
  public async saveAndExtractLive2D(
    fileData: Buffer | ArrayBuffer,
    assistantName: string
  ): Promise<{ success: boolean; path?: string; mainJsonPath?: string; error?: string }> {
    try {
      if (!assistantName || assistantName.trim() === '') {
        return { success: false, error: '助手名称不能为空' }
      }

      const assistantDir = this.ensureAssistantDirExists(assistantName)
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
   * 下载助手资源
   */
  public async downloadAssistantAsset(
    assistantName: string,
    onProgress: (progress: number) => void
  ): Promise<{ success: boolean }> {
    return this.downloadAssistantAssets(assistantName, onProgress)
  }
}

export { AssistantService }
