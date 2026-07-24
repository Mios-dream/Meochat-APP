import { app, BrowserWindow } from 'electron'
import { exec } from 'child_process'
import { promisify } from 'util'
import pty from 'node-pty'
import fs from 'fs'
import path from 'path'
import axios from 'axios'
import StreamZip from 'node-stream-zip'
import log from '../utils/logger'
import type { KernelRemoteVersion, KernelUpdateState } from '@shared/types/kernel'
import { resolveAppDataDir, resolveLogDir } from '../utils/pathResolve'
import type {
  EnvironmentCheckResult,
  EnvironmentCheckItem,
  DataResourceCheckResult
} from '@shared/types/kernel'
import { decodeBuffer } from '../utils/buffer'
import { detectZipNameEncoding } from '../utils/zipUtils'

const execAsync = promisify(exec)

const GITHUB_API = 'https://api.github.com'
const BACKEND_REPO_OWNER = 'Mios-dream'
const BACKEND_REPO_NAME = 'MoeChat'
const KERNEL_DIR_NAME = 'kernel'
const CURRENT_KERNEL_DIR = 'current'
const VERSION_FILE_NAME = 'version.txt'
const KERNEL_STATE_CHANNEL = 'kernel:state-update'
const SERVICE_STREAM_CHANNEL = 'kernel:service-stream'

/**
 * 升级时需要保留的用户数据目录，这些目录不会被新版本覆盖。
 */
const PRESERVED_DATA_DIRS = ['data', '.venv']
const PRESERVED_DATA_FILES = ['config.yaml']

/** 向所有窗口广播原始数据流 */
function broadcastToAllWindows(channel: string, payload: Buffer): void {
  BrowserWindow.getAllWindows().forEach((win) => {
    if (!win.isDestroyed()) {
      win.webContents.send(channel, payload)
    }
  })
}

class KernelManager {
  private static instance: KernelManager

  private state: KernelUpdateState = {
    currentVersion: null,
    latestVersion: null,
    updateAvailable: false,
    operationStatus: 'idle',
    progress: 0,
    statusText: '',
    error: null
  }

  /** 操作日志（uv sync、模型下载等，存储原始 Buffer，保留 ANSI 转义序列） */
  private operationLogs: Buffer[] = []
  private readonly maxOperationLogs = 200

  private constructor() {
    this.loadState()
  }

  static getInstance(): KernelManager {
    if (!KernelManager.instance) {
      KernelManager.instance = new KernelManager()
    }
    return KernelManager.instance
  }

  /** 内核根目录: appData/kernel/current */
  private get kernelDir(): string {
    const appDataDir = resolveAppDataDir()
    const dir = path.join(appDataDir, KERNEL_DIR_NAME, CURRENT_KERNEL_DIR)
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true })
    }
    return dir
  }

  /** 内核父目录: appData/kernel/ */
  get kernelRoot(): string {
    const appDataDir = resolveAppDataDir()
    const dir = path.join(appDataDir, KERNEL_DIR_NAME)
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true })
    }
    return dir
  }

  /** 版本文件路径 */
  private get versionFilePath(): string {
    return path.join(this.kernelDir, VERSION_FILE_NAME)
  }

  // ─── 便携 uv 运行时路径 ───────────────────────

  /** 内嵌便携 uv 运行时根目录 */
  get portableRuntimeDir(): string {
    if (app.isPackaged) {
      return path.join(process.resourcesPath, 'python-runtime')
    }
    return path.join(app.getAppPath(), 'resources', 'python-runtime')
  }

  /** 内嵌 uv 可执行文件路径（uv 自动管理 Python 版本） */
  get portableUvExe(): string {
    return path.join(this.portableRuntimeDir, 'uv.exe')
  }

  // ─── 状态管理 ───────────────────────────────────────

  private loadState(): void {
    try {
      const versionPath = this.versionFilePath
      const version = fs.readFileSync(versionPath, 'utf8').trim()
      this.state.currentVersion = version
      log.info(`当前内核版本: v${version}`)
    } catch (error: unknown) {
      const err = error as NodeJS.ErrnoException
      if (err.code === 'ENOENT') {
        log.info('未检测到已安装的内核，需要下载')
        this.state.currentVersion = null
      } else {
        log.error('加载内核状态失败:', err.message)
        this.state.currentVersion = null
      }
    }
  }

  // 通知所有窗口内核状态更新
  private notifyState(): void {
    BrowserWindow.getAllWindows().forEach((win) => {
      if (!win.isDestroyed()) {
        win.webContents.send(KERNEL_STATE_CHANNEL, { ...this.state })
      }
    })
  }

  // 更新操作状态和文本
  private setOperation(status: KernelUpdateState['operationStatus'], text: string): void {
    this.state.operationStatus = status
    this.state.statusText = text
    this.state.error = null
    this.notifyState()
  }

  /** 添加操作日志（存储原始 Buffer，保留 ANSI 转义序列） */
  addOperationLog(data: Buffer): void {
    if (!data || data.length === 0) return
    this.operationLogs.push(data)
    if (this.operationLogs.length > this.maxOperationLogs) {
      this.operationLogs = this.operationLogs.slice(-this.maxOperationLogs)
    }
  }

  /** 获取操作流日志（用于日志记录） */
  getOperationLogs(): Buffer[] {
    return [...this.operationLogs]
  }

  /** 获取当前完整状态 */
  getState(): KernelUpdateState {
    return this.state
  }

  /** 重置内核状态到默认（idle），通常在更新完成后调用 */
  resetState(): void {
    this.state.operationStatus = 'idle'
    this.state.progress = 0
    this.state.statusText = ''
    this.state.error = null
    this.state.updateAvailable = false
    this.notifyState()
  }

  /** 获取当前激活内核版本 */
  getCurrentVersion(): string | null {
    return this.state.currentVersion
  }

  /** 获取激活内核的路径 */
  async getActiveKernelPath(): Promise<string | null> {
    if (!this.state.currentVersion) return null

    try {
      await fs.promises.access(this.kernelDir)
      return this.kernelDir
    } catch {
      return null
    }
  }

  /**
   * 检查内核运行环境（资源完整性、运行时、venv、磁盘空间）
   * 使用内嵌便携 Python + uv，不再依赖系统级 uv 安装
   */
  async checkEnvironment(): Promise<EnvironmentCheckResult> {
    const items: EnvironmentCheckItem[] = []

    let runtimeOk = false
    let venvReady = false
    let kernelOk = false
    let modelOk = false
    // 1. 检查内嵌 Python 运行时完整性
    runtimeOk = fs.existsSync(this.portableUvExe)
    items.push({
      name: '内嵌 uv 管理器',
      passed: runtimeOk,
      message: runtimeOk ? `就绪 (${this.portableRuntimeDir})` : '内嵌管理器损坏，请重新安装应用',
      key: 'uv'
    })
    // 2. 检查 内核源码完整性（pyproject.toml 存在）
    if (fs.existsSync(this.kernelDir)) {
      kernelOk = fs.existsSync(path.join(this.kernelDir, 'pyproject.toml'))
    }
    items.push({
      name: '系统完整性',
      passed: kernelOk,
      message: kernelOk ? '系统数据已就绪，核心正在运行' : '未检测到系统数据包，需要导入',
      key: 'kernel'
    })
    // 3. 检查虚拟环境是否就绪（.venv/bin/python 存在）
    if (kernelOk) {
      const kernelPath = await this.getActiveKernelPath()
      if (kernelPath) {
        const venvPythonPath =
          process.platform === 'win32'
            ? path.join(kernelPath, '.venv', 'Scripts', 'python.exe')
            : path.join(kernelPath, '.venv', 'bin', 'python')
        venvReady = fs.existsSync(venvPythonPath)
      }
    }

    items.push({
      name: '虚拟环境 (.venv)',
      passed: venvReady,
      message: venvReady
        ? '虚拟环境已就绪'
        : kernelOk
          ? '虚拟环境未配置，需要运行 uv sync'
          : '需要先导入后端资源包',
      key: 'venv'
    })
    // 4. 检查助手模型文件是否完整
    modelOk = fs.existsSync(path.join(this.kernelDir, 'data', 'models'))
    items.push({
      name: '核心数据',
      passed: modelOk,
      message: modelOk ? '助手核心数据被保护中' : '助手核心数据缺失，需要导入数据资源包',
      key: 'data'
    })

    // 5. 检查磁盘空间（建议 ≥20GB，PyTorch + 依赖约需 14GB）
    const kernelRoot = this.kernelRoot
    let diskSpaceOk = true
    let diskMessage = '磁盘空间充足'
    try {
      const { statfsSync } = fs
      const stat = statfsSync(kernelRoot)
      const freeBytes = stat.bsize * stat.bfree
      const freeGB = freeBytes / (1024 * 1024 * 1024)
      if (freeGB < 20) {
        diskSpaceOk = false
        diskMessage = `磁盘空间不足: 仅剩 ${freeGB.toFixed(1)} GB (建议至少 20GB)`
      } else {
        diskMessage = `可用空间: ${freeGB.toFixed(1)} GB`
      }
    } catch {
      diskMessage = '无法检测磁盘空间'
    }
    items.push({
      name: '磁盘空间',
      passed: diskSpaceOk,
      message: diskMessage,
      key: 'disk'
    })

    const allPassed = items.every((item) => item.passed)
    const needsSetup = kernelOk && !venvReady && !modelOk && runtimeOk

    return { items, allPassed, needsSetup }
  }

  /**
   * 设置内核运行环境（运行 uv sync）
   */
  async setupKernelEnvironment(): Promise<{ success: boolean; error?: string }> {
    const version = this.state.currentVersion
    if (!version) {
      return { success: false, error: '没有安装内核' }
    }

    const pyprojectPath = path.join(this.kernelDir, 'pyproject.toml')
    if (!fs.existsSync(pyprojectPath)) {
      return { success: false, error: '内核目录中未找到 pyproject.toml' }
    }

    this.setOperation('settingUpEnv', '正在安装 Python 依赖...')
    this.state.progress = 0
    this.notifyState()

    try {
      // 确保 Python 版本与 wheels 匹配（根据 wheel ABI 标签锁定版本）
      await this.ensurePythonVersionPinned()

      await this.setupEnvironment((progress) => {
        this.state.progress = Math.round(progress * 100)
        this.notifyState()
      })

      this.setOperation('done', '环境安装完成！')
      this.state.progress = 100
      this.notifyState()
      return { success: true }
    } catch (error) {
      const msg = (error as Error).message
      this.state.error = msg
      this.setOperation('error', `环境安装失败: ${msg}`)
      return { success: false, error: msg }
    }
  }

  /**
   * 校验资源包 zip 合法性（检查 manifest.json 是否存在）
   * @returns 校验通过返回 true，否则返回错误信息
   */
  private async validateAssetZip(zipPath: string): Promise<{ valid: boolean; error?: string }> {
    let zip: InstanceType<typeof StreamZip.async> | null = null
    try {
      zip = new StreamZip.async({ file: zipPath, skipEntryNameValidation: true })
      const entries = await zip.entries()
      const entryNames = Object.values(entries).map((e: { name: string }) =>
        e.name.replace(/\\/g, '/')
      )

      const topLevelDir = this.detectSingleTopLevelDir(entries)

      // 检查 manifest.json 是否存在（考虑可能的外层目录）
      const hasManifest = entryNames.some((name) => {
        const relative = topLevelDir
          ? name.startsWith(`${topLevelDir}/`)
            ? name.slice(topLevelDir.length + 1)
            : null
          : name
        return relative === 'manifest.json'
      })

      if (!hasManifest) {
        return { valid: false, error: '无效的资源包：未找到 manifest.json' }
      }

      return { valid: true }
    } catch (error) {
      const msg = (error as Error).message
      return { valid: false, error: `无法读取资源包：${msg}` }
    } finally {
      if (zip) {
        await zip.close().catch(() => {})
      }
    }
  }

  /**
   * 导入资源包（完整内核安装）
   * 用户从网盘下载 moechat-assets-*.zip 后，在 App 内点"导入"调用此方法。
   * 资源包包含完整的 kernel 源码、wheel 缓存和模型文件，解压即用。
   */
  async importAssetBundle(zipPath: string): Promise<{ success: boolean; error?: string }> {
    try {
      // 校验资源包合法性
      const validation = await this.validateAssetZip(zipPath)
      if (!validation.valid) {
        return { success: false, error: validation.error }
      }

      this.setOperation('installing', '正在导入资源包...')
      this.state.progress = 0
      this.notifyState()
      log.info(`[KernelManager] 开始导入资源包: ${zipPath}`)

      await this.extractZipToKernelDir(zipPath)

      // 读取版本号
      const versionPath = path.join(this.kernelDir, 'version.txt')
      if (fs.existsSync(versionPath)) {
        const version = fs.readFileSync(versionPath, 'utf8').trim()
        this.state.currentVersion = version
        log.info(`[KernelManager] 资源包版本: ${version}`)
      }

      // 统计导入结果
      const wheelCount = (() => {
        const dir = path.join(this.kernelDir, 'wheels')
        if (!fs.existsSync(dir)) return 0
        try {
          return fs.readdirSync(dir).filter((f) => f.endsWith('.whl')).length
        } catch {
          return 0
        }
      })()

      this.state.progress = 100
      this.setOperation('done', `资源包导入完成（${wheelCount} 个 wheel）`)
      this.notifyState()
      log.info(`[KernelManager] 资源包导入完成: ${wheelCount} 个 wheel`)
      return { success: true }
    } catch (error) {
      const msg = (error as Error).message
      log.error(`[KernelManager] 资源包导入失败: ${msg}`)
      this.state.error = msg
      this.setOperation('error', `资源包导入失败: ${msg}`)
      return { success: false, error: msg }
    }
  }

  /** 将 zip 解压到内核目录（移除外层目录），保留现有数据目录 */
  private async extractZipToKernelDir(zipPath: string, subDir?: string): Promise<void> {
    const nameEncoding = await detectZipNameEncoding(zipPath)

    const zip = new StreamZip.async({
      file: zipPath,
      skipEntryNameValidation: true,
      nameEncoding
    })
    try {
      const entries = await zip.entries()

      // 检测外层包装目录（如 moechat-assets-v1.7.0/），有则剥离
      const topDir = this.detectSingleTopLevelDir(entries)

      for (const entry of Object.values(entries)) {
        let relativePath = entry.name.replace(/\\/g, '/')

        if (topDir) {
          if (!relativePath.startsWith(`${topDir}/`)) continue
          if (relativePath === `${topDir}/`) continue
          relativePath = relativePath.slice(topDir.length + 1)
        }
        if (!relativePath) continue

        // 若指定子目录（如 'data'），所有条目装到子目录下
        const targetRelPath = subDir ? `${subDir}/${relativePath}` : relativePath
        const targetPath = path.join(this.kernelDir, targetRelPath)

        if (entry.isDirectory) {
          await fs.promises.mkdir(targetPath, { recursive: true })
        } else {
          await fs.promises.mkdir(path.dirname(targetPath), { recursive: true })
          const readStream = await zip.stream(entry)
          const writeStream = fs.createWriteStream(targetPath)
          await new Promise<void>((resolve, reject) => {
            readStream.pipe(writeStream)
            readStream.on('error', reject)
            writeStream.on('error', reject)
            writeStream.on('finish', resolve)
          })
        }

        this.state.progress = Math.min(99, this.state.progress + 1)
        this.notifyState()
      }
    } finally {
      await zip.close().catch(() => {})
    }
  }

  /**
   * 检查资源完整性（内核源码、wheels、模型文件）
   * 不依赖后端运行，直接在文件系统上检查。
   * 这是判断是否需要导入资源包的主要依据。
   */
  async checkResources(): Promise<{
    kernelInstalled: boolean
    wheels: { ready: boolean; count: number }
    models: { ready: boolean; details: { name: string; exists: boolean }[] }
  }> {
    const kernelDir = this.kernelDir

    // 1. 检查内核源码是否已安装（核心标识）
    const kernelInstalled = fs.existsSync(path.join(kernelDir, 'pyproject.toml'))

    // 2. 检查 wheel
    const wheelsDir = path.join(kernelDir, 'wheels')
    let wheelCount = 0
    if (fs.existsSync(wheelsDir)) {
      try {
        const files = await fs.promises.readdir(wheelsDir)
        wheelCount = files.filter((f) => f.endsWith('.whl')).length
      } catch {
        wheelCount = 0
      }
    }

    // 3. 检查模型目录（data/models/ 存在即可）
    const modelsDir = path.join(kernelDir, 'data', 'models')
    const modelsReady = fs.existsSync(modelsDir)

    return {
      kernelInstalled,
      wheels: { ready: wheelCount >= 3, count: wheelCount },
      models: { ready: modelsReady, details: [{ name: '模型目录 (models)', exists: modelsReady }] }
    }
  }

  /**
   * 检查数据资源完整性（data/models + data/agents）
   * 数据资源包独立于后端内核资源包，可单独导入
   */
  async checkDataResources(): Promise<DataResourceCheckResult> {
    const kernelDir = this.kernelDir

    const modelsDir = path.join(kernelDir, 'data', 'models')
    const modelsExists = fs.existsSync(modelsDir)

    const agentsDir = path.join(kernelDir, 'data', 'agents')
    const agentsExists = fs.existsSync(agentsDir)

    const items = [
      { name: '模型文件 (models)', key: 'models', exists: modelsExists },
      { name: '角色数据 (agents)', key: 'agents', exists: agentsExists }
    ]

    return {
      ready: items.every((i) => i.exists),
      items
    }
  }

  /**
   * 导入数据资源包（仅 models + agents，不覆盖后端内核文件）
   * 用户选择的数据 zip 应包含 data/ 目录结构
   */
  async importDataBundle(zipPath: string): Promise<{ success: boolean; error?: string }> {
    try {
      // 校验资源包合法性
      const validation = await this.validateAssetZip(zipPath)
      if (!validation.valid) {
        return { success: false, error: validation.error }
      }

      this.setOperation('installing', '正在导入数据资源包...')
      this.state.progress = 0
      this.notifyState()
      log.info(`[KernelManager] 开始导入数据资源包: ${zipPath}`)

      await this.extractZipToKernelDir(zipPath, 'data')

      this.state.progress = 100
      this.setOperation('done', '数据资源包导入完成')
      this.notifyState()
      log.info('[KernelManager] 数据资源包导入完成')
      return { success: true }
    } catch (error) {
      const msg = (error as Error).message
      log.error(`[KernelManager] 数据资源包导入失败: ${msg}`)
      this.state.error = msg
      this.setOperation('error', `数据资源包导入失败: ${msg}`)
      return { success: false, error: msg }
    }
  }

  /** 检查远端是否有新内核版本（从 GitHub Releases） */
  async checkForUpdates(): Promise<KernelUpdateState> {
    this.setOperation('checking', '正在检查内核更新...')

    try {
      const latest = await this.fetchLatestRelease()

      if (!latest) {
        this.setOperation('idle', '')
        this.state.latestVersion = null
        this.state.updateAvailable = false
        this.notifyState()
        return { ...this.state }
      }

      this.state.latestVersion = latest

      if (this.state.currentVersion) {
        this.state.updateAvailable =
          this.compareVersions(latest.version, this.state.currentVersion) > 0
      } else {
        this.state.updateAvailable = true
      }

      if (this.state.updateAvailable) {
        this.setOperation('idle', `发现新内核 v${latest.version}`)
      } else {
        this.setOperation('idle', '内核已是最新版本')
      }

      this.notifyState()
      return { ...this.state }
    } catch (error) {
      const msg = (error as Error).message
      log.error('检查内核更新失败:', msg)
      this.state.error = msg
      this.setOperation('error', `检查更新失败: ${msg}`)
      return { ...this.state }
    }
  }

  /**
   * 从 GitHub Releases 下载并安装最新版本内核
   * 会保留用户数据目录，只替换代码文件
   */
  async downloadAndInstall(version?: string): Promise<boolean> {
    let targetVersion: string

    if (version) {
      targetVersion = version
    } else if (this.state.latestVersion?.version) {
      targetVersion = this.state.latestVersion.version
    } else {
      try {
        this.state.latestVersion = await this.fetchLatestRelease()
        if (!this.state.latestVersion?.version) {
          this.state.error = '无法获取内核版本信息'
          this.setOperation('error', '无法获取内核版本信息')
          return false
        }
        targetVersion = this.state.latestVersion.version
      } catch {
        this.state.error = '无法获取内核下载信息'
        this.setOperation('error', '无法获取内核下载信息')
        return false
      }
    }

    if (
      this.state.currentVersion &&
      this.compareVersions(this.state.currentVersion, targetVersion) >= 0
    ) {
      const pyprojectPath = path.join(this.kernelDir, 'pyproject.toml')
      if (fs.existsSync(pyprojectPath)) {
        this.setOperation('done', `内核已是最新版本 v${this.state.currentVersion}`)
        this.notifyState()
        return true
      }
    }

    if (!this.state.latestVersion || this.state.latestVersion.version !== targetVersion) {
      try {
        this.state.latestVersion = await this.fetchLatestRelease()
      } catch {
        // 继续使用已有的
      }
    }

    const downloadUrl = this.state.latestVersion?.downloadUrl
    if (!downloadUrl) {
      this.state.error = '未找到内核下载地址'
      this.setOperation('error', '未找到内核下载地址')
      return false
    }

    const tempDir = path.join(app.getPath('temp'), 'moechat-kernel-update')
    const tempZip = path.join(tempDir, `moechat-kernel-${targetVersion}.zip`)

    try {
      if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true })
      }

      this.setOperation('downloading', '正在下载内核...')
      await this.downloadFile(downloadUrl, tempZip, (progress) => {
        this.state.progress = Math.round(progress * 40)
        this.notifyState()
      })

      this.setOperation('installing', '正在解压内核...')
      this.state.progress = 40
      this.notifyState()

      await this.installKernelFromZip(tempZip, targetVersion)

      this.state.progress = 55
      this.notifyState()

      this.setOperation('settingUpEnv', '正在安装Python依赖...')
      await this.setupEnvironment((progress) => {
        this.state.progress = 55 + Math.round(progress * 0.4)
        this.notifyState()
      })

      this.state.progress = 100
      this.setOperation('done', `内核 v${targetVersion} 安装完成`)
      this.notifyState()

      return true
    } catch (error) {
      const msg = (error as Error).message
      log.error('下载安装内核失败:', msg)
      this.state.error = msg
      this.setOperation('error', `安装失败: ${msg}`)
      return false
    } finally {
      await fs.promises.unlink(tempZip).catch(() => {})
    }
  }

  /** 从 GitHub Releases API 获取最新版本 */
  private async fetchLatestRelease(): Promise<KernelRemoteVersion | null> {
    try {
      const url = `${GITHUB_API}/repos/${BACKEND_REPO_OWNER}/${BACKEND_REPO_NAME}/releases/latest`
      const response = await axios.get(url, {
        headers: {
          Accept: 'application/vnd.github.v3+json',
          'User-Agent': 'MoeChat-APP'
        },
        timeout: 15000
      })

      const release = response.data
      const tagName: string = release.tag_name || ''
      const version = tagName.replace(/^v/, '')
      const body: string = release.body || ''

      const asset = release.assets?.find(
        (a: { name: string; browser_download_url: string; size: number }) => {
          const name = a.name.toLowerCase()
          return (
            name.endsWith('.zip') &&
            (name.includes('moechat') ||
              name.includes('kernel') ||
              name.includes('backend') ||
              name.includes('source'))
          )
        }
      )

      if (!asset) {
        const sourceAsset = release.assets?.find((a: { name: string }) => a.name.endsWith('.zip'))
        if (!sourceAsset) {
          log.warn('未找到内核下载资源')
          return null
        }
        return {
          version,
          publishedAt: release.published_at || '',
          releaseNotes: this.truncateReleaseNotes(body),
          downloadUrl: sourceAsset.browser_download_url,
          size: sourceAsset.size || 0
        }
      }

      return {
        version,
        publishedAt: release.published_at || '',
        releaseNotes: this.truncateReleaseNotes(body),
        downloadUrl: asset.browser_download_url,
        size: asset.size || 0
      }
    } catch (error) {
      log.error('获取 GitHub Release 失败:', (error as Error).message)
      return null
    }
  }

  /** 截取更新日志前 2000 字符 */
  private truncateReleaseNotes(notes: string): string {
    if (!notes) return ''
    return notes.length > 2000 ? notes.slice(0, 2000) + '\n\n...(内容过长已截断)' : notes
  }

  /** 下载文件并回调进度（带超时和流式写入） */
  private async downloadFile(
    url: string,
    destPath: string,
    onProgress: (progress: number) => void
  ): Promise<void> {
    const writer = fs.createWriteStream(destPath)
    const response = await axios({
      url,
      method: 'GET',
      responseType: 'stream',
      headers: { 'User-Agent': 'MoeChat-APP', Accept: 'application/octet-stream' },
      timeout: 600000
    })

    const totalLength = parseInt(String(response.headers['content-length'] || '0'), 10)

    return new Promise((resolve, reject) => {
      let downloaded = 0
      response.data.on('data', (chunk: Buffer) => {
        downloaded += chunk.length
        if (totalLength > 0) onProgress(downloaded / totalLength)
      })
      response.data.pipe(writer)
      writer.on('finish', () => {
        writer.close()
        resolve()
      })
      writer.on('error', (err) => {
        writer.close()
        reject(err)
      })
      response.data.on('error', (err: Error) => {
        writer.close()
        reject(err)
      })
    })
  }

  /**
   * 解压并安装内核到固定目录 kernel/current/
   * 保留用户数据目录，仅替换代码文件
   */
  private async installKernelFromZip(zipPath: string, version: string): Promise<void> {
    const targetDir = this.kernelDir
    try {
      await fs.promises.access(targetDir)
      await this.cleanCodeFiles(targetDir)
    } catch {
      // 目录不存在，跳过清理
    }

    try {
      await this.extractZipToKernelDir(zipPath)
    } finally {
      // extractZipToKernelDir 已自行管理 zip 关闭
    }

    await fs.promises.writeFile(this.versionFilePath, version, 'utf8')
    this.state.currentVersion = version
    log.info(`内核 v${version} 升级完成: ${targetDir}`)
  }

  /**
   * 清理内核目录中的文件（保留用户数据目录）
   */
  private async cleanCodeFiles(dir: string): Promise<void> {
    try {
      await fs.promises.access(dir)
    } catch {
      return
    }

    try {
      const entries = await fs.promises.readdir(dir, { withFileTypes: true })
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name)
        if (PRESERVED_DATA_DIRS.includes(entry.name)) {
          log.info(`保留目录: ${entry.name}`)
          continue
        }
        if (PRESERVED_DATA_FILES.includes(entry.name)) {
          log.info(`保留文件: ${entry.name}`)
          continue
        }
        try {
          if (entry.isDirectory()) {
            await fs.promises.rm(fullPath, { recursive: true, force: true })
          } else {
            await fs.promises.unlink(fullPath)
          }
        } catch (error) {
          log.error(`清理失败: ${fullPath}, ${(error as Error).message}`)
        }
      }
      log.info(`内核目录清理完成: ${dir}`)
    } catch (error) {
      log.error(`清理内核目录失败: ${(error as Error).message}`)
    }
  }

  /** 比较版本号，返回 >0 如果 a > b */
  private compareVersions(a: string, b: string): number {
    const partsA = a.split('.').map(Number)
    const partsB = b.split('.').map(Number)
    const len = Math.max(partsA.length, partsB.length)
    for (let i = 0; i < len; i++) {
      const na = partsA[i] || 0
      const nb = partsB[i] || 0
      if (na > nb) return 1
      if (na < nb) return -1
    }
    return 0
  }

  /**
   * 判断是否存在单一外层目录（用于去掉压缩包外层文件夹）
   */
  private detectSingleTopLevelDir(entries: {
    [name: string]: { name: string; isDirectory: boolean }
  }): string | null {
    let topLevelDir: string | null = null
    let hasRootFile = false

    for (const entry of Object.values(entries)) {
      const entryName = entry.name.replace(/\\/g, '/')
      const parts = entryName.split('/').filter(Boolean)
      if (parts.length === 0) continue

      const first = parts[0]
      if (!topLevelDir) {
        topLevelDir = first
      } else if (topLevelDir !== first) {
        return null
      }

      if (parts.length === 1 && !entry.isDirectory) {
        hasRootFile = true
      }
    }

    if (!topLevelDir || hasRootFile) return null
    return topLevelDir
  }

  // ─── wheel 兼容性检测 ─────────────────────────────

  /**
   * 从 wheel 文件名中提取 ABI 标签（如 cp311、cp313、py3、none）
   * PEP 427: {distribution}-{version}(-{build tag})?-{python tag}-{abi tag}-{platform tag}.whl
   */
  private getWheelAbiTag(filename: string): string | null {
    const match = filename.match(
      /^[a-zA-Z0-9_.-]+?-\d+[^-]*?(?:-[a-zA-Z0-9_.]+)?-([^-]+)-([^-]+)-[\w.]+\.whl$/
    )
    return match ? match[2] : null
  }

  /**
   * 检查 wheel ABI 标签是否与给定的 Python 版本（主.次）兼容
   * - none/py3 等通用标签兼容任何版本
   * - cp311 ↔ cp311 精确匹配
   * - cp311 → cp313 不匹配
   */
  private isWheelAbiCompatible(abiTag: string, target: string): boolean {
    const targetTag = `cp${target.replace('.', '')}`
    if (abiTag === targetTag) return true
    if (abiTag.startsWith('py') || abiTag === 'none') return true
    return false
  }

  /**
   * 检测 uv 将为当前项目使用的 Python 版本（主.次）
   * 优先检查 .venv 中已安装的 Python，否则通过 uv python list 查询。
   */
  private async resolvePythonVersion(): Promise<string | null> {
    // 1. 优先从已存在的 .venv 中读取
    const venvPython =
      process.platform === 'win32'
        ? path.join(this.kernelDir, '.venv', 'Scripts', 'python.exe')
        : path.join(this.kernelDir, '.venv', 'bin', 'python')
    if (fs.existsSync(venvPython)) {
      try {
        const { stdout } = await execAsync(
          `"${venvPython}" -c "import sys; print(f'{sys.version_info.major}.{sys.version_info.minor}')"`
        )
        const ver = stdout.trim()
        if (/^\d+\.\d+$/.test(ver)) return ver
      } catch {
        /* fall through */
      }
    }

    // 2. 通过 uv 查询可用 Python 的最新安装版本
    try {
      const { stdout } = await execAsync(`"${this.portableUvExe}" python list --only-installed`, {
        cwd: this.kernelDir
      })
      // 取第一行非 freethreaded 的 CPython 版本
      const lines = stdout
        .split('\n')
        .map((l) => l.trim())
        .filter((l) => l.startsWith('cpython-') && !l.includes('freethreaded'))
      if (lines.length > 0) {
        const match = lines[0].match(/cpython-(\d+\.\d+)/)
        if (match) return match[1]
      }
    } catch {
      /* fall through */
    }

    return null
  }

  /**
   * 通过 wheel ABI 标签检测所需的 Python 版本，写入 .python-version 锁定 uv 使用的版本
   * 仅在 .python-version 和 .venv 均不存在时写入，避免覆盖已有配置
   */
  private async ensurePythonVersionPinned(): Promise<void> {
    const versionFile = path.join(this.kernelDir, '.python-version')
    const venvPython =
      process.platform === 'win32'
        ? path.join(this.kernelDir, '.venv', 'Scripts', 'python.exe')
        : path.join(this.kernelDir, '.venv', 'bin', 'python')

    // 已有锁定或 venv，无需干预
    if (fs.existsSync(versionFile) || fs.existsSync(venvPython)) return

    const wheelsDir = path.join(this.kernelDir, 'wheels')
    if (!fs.existsSync(wheelsDir)) return

    try {
      const files = fs.readdirSync(wheelsDir)
      for (const f of files) {
        if (!f.endsWith('.whl')) continue
        const abi = this.getWheelAbiTag(f)
        if (abi && /^cp\d+$/.test(abi)) {
          // cp311 → 3.11, cp39 → 3.9
          const num = abi.slice(2)
          const major = num[0]
          const minor = num.slice(1)
          const version = `${major}.${minor}`
          fs.writeFileSync(versionFile, version, 'utf8')
          log.info(`[setup] 根据 wheel ABI 标签锁定 Python 版本: ${version} (${f})`)
          return
        }
      }
    } catch (error) {
      log.warn(`[setup] 检测 wheel Python 版本失败: ${(error as Error).message}`)
    }
  }

  /**
   * 两步安装环境依赖：
   *   1. uv sync        → 下载全部依赖，实时转发 stderr 进度到终端
   *   2. install.py --cuda-only → 检测 GPU 并替换为 CUDA 版 torch
   *
   * 不依赖 `uv run`，避免 uv run 隐式 sync 吞掉进度条输出。
   */
  private setupEnvironment(onProgress: (progress: number) => void): Promise<void> {
    const kernelDir = this.kernelDir
    const uvExe = this.portableUvExe

    return new Promise((resolve, reject) => {
      const pyprojectPath = path.join(kernelDir, 'pyproject.toml')
      if (!fs.existsSync(pyprojectPath)) {
        log.warn('内核没有 pyproject.toml，跳过依赖安装')
        onProgress(1)
        resolve()
        return
      }
      if (!fs.existsSync(uvExe)) {
        reject(new Error('内嵌 uv 未找到，请重新安装应用。\n' + `期望路径: ${uvExe}`))
        return
      }

      this.state.statusText = '正在安装 Python 依赖（首次约需 5GB 下载）...'
      this.notifyState()

      // ── 步骤 1: uv sync ────────────────────────────
      log.info(`[setup] 步骤 1/2: uv sync (cwd: ${kernelDir})`)
      this.runSyncWithProgress(kernelDir, uvExe, onProgress)
        .then(() => this.runCudaUpgrade(kernelDir, onProgress))
        .then(() => {
          log.info('依赖安装完成')
          onProgress(1)
          resolve()
        })
        .catch((err) => {
          const msg = (err as Error).message
          log.error(`依赖安装失败: ${msg}`)
          reject(new Error(`依赖安装失败: ${msg}`))
        })
    })
  }

  /**
   * 通过伪终端 (PTY) 执行 uv sync，使 uv 认为连接的是真实终端，
   * 进而输出 ANSI 进度条动画（含百分比和下载速度）。
   *
   * 通过 node-pty 在 Windows 上使用 ConPTY，在 macOS/Linux 上使用
   * 标准 PTY。原始 ANSI 数据直接转发给前端的 xterm 组件渲染，
   * 同时解析其中的百分比用于更新 UI 进度条。
   */
  /**
   * 解析与当前 Python 版本兼容的本地 wheels 目录路径
   * 若所有 wheel 均不兼容则返回 null（后续将从 PyPI 下载）
   */
  private async resolveCompatibleWheelsDir(): Promise<string | null> {
    const rawDir = path.join(this.kernelDir, 'wheels')
    if (!fs.existsSync(rawDir)) return null

    const pyVersion = await this.resolvePythonVersion()
    if (!pyVersion) {
      log.warn('[setup] 无法检测 uv Python 版本，使用原始 wheels 目录（可能因版本不匹配失败）')
      return rawDir
    }

    let hasWhl = false
    let anyCompatible = false
    const files = fs.readdirSync(rawDir)
    for (const f of files) {
      if (!f.endsWith('.whl')) continue
      hasWhl = true
      const abi = this.getWheelAbiTag(f)
      if (!abi || this.isWheelAbiCompatible(abi, pyVersion)) {
        anyCompatible = true
      } else {
        log.warn(
          `[setup] 跳过不兼容的 wheel: ${f} (abi=${abi}, target=cp${pyVersion.replace('.', '')})`
        )
      }
    }

    if (!hasWhl) return rawDir
    if (!anyCompatible) {
      log.warn(`[setup] 本地 wheels 均与 Python ${pyVersion} 不兼容，将从 PyPI 下载依赖`)
      return null
    }
    return rawDir
  }

  private async runSyncWithProgress(
    kernelDir: string,
    uvExe: string,
    onProgress: (p: number) => void
  ): Promise<void> {
    const uvArgs = ['sync']
    const findLinksDir = await this.resolveCompatibleWheelsDir()
    if (findLinksDir) {
      uvArgs.push('--find-links', findLinksDir)
      log.info(`[setup] 使用本地 wheel 缓存: ${findLinksDir}`)
    } else {
      log.info('[setup] 无兼容的本地 wheel，将从 PyPI 下载依赖')
    }
    return new Promise((resolve, reject) => {
      const term = pty.spawn(uvExe, uvArgs, {
        cwd: kernelDir,
        name: 'xterm-256color',
        cols: 120,
        rows: 30,
        env: { ...process.env } as Record<string, string>
      })

      let settled = false
      const allOutput: string[] = []

      // 匹配 ANSI 进度条中的百分比，如 "[45%]" 或 "45%"
      const pctRe = /\[?(\b\d{1,3})%\]?/

      term.onData((data: string) => {
        broadcastToAllWindows(SERVICE_STREAM_CHANNEL, Buffer.from(data, 'utf-8'))
        this.addOperationLog(Buffer.from(data, 'utf-8'))
        allOutput.push(data)

        const match = data.match(pctRe)
        if (match) {
          const pct = parseInt(match[1], 10) / 100
          this.state.statusText = `正在下载依赖... ${match[1]}%`
          onProgress(Math.min(pct, 0.95) * 0.85)
          this.notifyState()
        }
      })

      term.onExit((event: { exitCode: number; signal?: number }) => {
        if (settled) return
        settled = true
        if (event.exitCode === 0) {
          log.info('uv sync 完成')
          this.state.statusText = '依赖下载完成'
          onProgress(0.85)
          this.notifyState()
          resolve()
        } else {
          const full = allOutput.join('')
          const errs = full.split('\n').filter((l) => /error|Error|fail/i.test(l))
          const msg = errs.slice(0, 5).join('\n') || `退出码: ${event.exitCode}`
          reject(new Error(`uv sync 失败 (${msg})`))
        }
      })
    })
  }

  /**
   * 执行 CUDA 检测与 torch 升级（install.py --cuda-only）
   * 同步完成后 venv Python 已存在，直接用 venv Python 运行
   */
  private runCudaUpgrade(kernelDir: string, onProgress: (p: number) => void): Promise<void> {
    const venvPython =
      process.platform === 'win32'
        ? path.join(kernelDir, '.venv', 'Scripts', 'python.exe')
        : path.join(kernelDir, '.venv', 'bin', 'python')

    const installPy = path.join(kernelDir, 'install.py')

    if (!fs.existsSync(venvPython)) {
      log.warn('venv Python 不存在，跳过 CUDA 升级')
      return Promise.resolve()
    }
    if (!fs.existsSync(installPy)) {
      log.warn('install.py 不存在，跳过 CUDA 升级')
      return Promise.resolve()
    }

    return new Promise<void>((resolve) => {
      this.state.statusText = '检测 GPU 并配置加速...'
      this.notifyState()

      // 也使用 PTY，让 uv pip install 的 ANSI 进度条能正常渲染
      const term = pty.spawn(venvPython, [installPy, '--cuda-only', '--json'], {
        cwd: kernelDir,
        name: 'xterm-256color',
        cols: 120,
        rows: 30,
        env: { ...process.env } as Record<string, string>
      })

      let settled = false
      let buffer = ''

      term.onData((data: string) => {
        broadcastToAllWindows(SERVICE_STREAM_CHANNEL, Buffer.from(data, 'utf-8'))
        this.addOperationLog(Buffer.from(data, 'utf-8'))

        // 尝试从 ANSI 流中提取 JSON 进度事件
        buffer += data
        const lines = buffer.split('\n')
        buffer = lines.pop() ?? ''

        for (const line of lines) {
          const trimmed = line.trim()
          if (!trimmed) continue
          try {
            const event = JSON.parse(trimmed)
            this.state.statusText = (event.message || '').slice(0, 200)
            if (event.progress != null) {
              // CUDA 阶段占总体进度的 15% (85% → 100%)
              onProgress(0.85 + event.progress * 0.15)
            }
          } catch {
            // 非 JSON 行（ANSI 进度条或普通日志），由 xterm 直接渲染
          }
        }
        this.notifyState()
      })

      term.onExit((event: { exitCode: number; signal?: number }) => {
        if (settled) return
        settled = true
        if (event.exitCode === 0) {
          log.info('CUDA 升级完成')
        } else {
          log.warn(`CUDA 升级退出码 ${event.exitCode}，保留 CPU 版本`)
        }
        resolve()
      })
    })
  }
}

class KernelServiceManager {
  private static instance: KernelServiceManager
  /** 后端 Python 进程 */
  private backendProcess: { pid: number; kill: (signal?: string) => void } | null = null

  /** 后端服务运行状态 */
  private backendRunning = false

  /** 后端服务 PID */
  private backendPid = -1

  /** 后端进程退出码（进程退出后记录） */
  private backendExitCode: number | null = null

  /** 后端服务日志（存储原始 Buffer，保留 ANSI 转义序列） */
  private backendLogs: Buffer[] = []
  private readonly maxBackendLogs = 100

  /** 日志文件最大大小 (1MB) */
  private readonly maxLogFileSize = 1 * 1024 * 1024

  /** 持久化日志文件路径（与 electron-log 的日志目录一致） */
  private get backendLogFile(): string {
    return path.join(resolveLogDir(), 'core.log')
  }

  /** 服务状态广播通道 */
  private static readonly SERVICE_STATE_CHANNEL = 'kernel:service-state'

  /** 原始数据流广播，发送原始二进制数据给渲染进程 */
  private broadcastStream(data: Buffer): void {
    broadcastToAllWindows(SERVICE_STREAM_CHANNEL, data)
  }

  public kernelManager: KernelManager

  private constructor() {
    this.kernelManager = KernelManager.getInstance()
    // 确保应用退出时正确关闭后端服务
    app.on('before-quit', () => {
      this.stopBackend()
    })
  }

  static getInstance(): KernelServiceManager {
    if (!KernelServiceManager.instance) {
      KernelServiceManager.instance = new KernelServiceManager()
    }
    return KernelServiceManager.instance
  }

  /**
   * 添加后端日志并广播，同时持久化到文件
   * @param data 原始 Buffer 数据（保留 ANSI 转义序列）
   */
  private addBackendLog(data: Buffer): void {
    if (!data || data.length === 0) return

    this.backendLogs.push(data)
    if (this.backendLogs.length > this.maxBackendLogs) {
      this.backendLogs = this.backendLogs.slice(-this.maxBackendLogs)
    }
    this.notifyServiceState()

    // 持久化到文件时解码为纯文本
    const text = decodeBuffer(data)
    const lines = text
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line.length > 0)
    if (lines.length > 0) {
      this.persistLogs(lines)
    }
  }

  /** 添加系统日志（纯文本，转为 Buffer 存储） */
  private addSystemLog(message: string): void {
    if (!message) return
    this.addBackendLog(Buffer.from(message, 'utf-8'))
  }

  /**
   * 将当前后端日志异步持久化到文件（追加模式）
   * 当日志文件超过1MB时，将旧日志重命名为core.old.log
   * @param lines 要追加的日志行
   */
  private persistLogs(lines: string[]): void {
    if (!lines || lines.length === 0) return

    const logFile = this.backendLogFile
    const oldLogFile = logFile.replace('core.log', 'core.old.log')

    try {
      // 检查日志文件大小
      if (fs.existsSync(logFile)) {
        const stats = fs.statSync(logFile)
        if (stats.size >= this.maxLogFileSize) {
          // 文件超过1MB，轮转日志
          try {
            // 如果oldLogFile已存在，先删除
            if (fs.existsSync(oldLogFile)) {
              fs.unlinkSync(oldLogFile)
            }
            // 重命名当前日志文件为core.old.log
            fs.renameSync(logFile, oldLogFile)
          } catch {
            // 轮转失败时静默忽略
          }
        }
      }

      // 追加写入新日志
      const content = lines.join('\n') + '\n'
      fs.promises.appendFile(logFile, content, 'utf-8').catch(() => {
        // 写入失败时静默忽略，不影响主流程
      })
    } catch {
      // 文件操作失败时静默忽略
    }
  }

  /**
   * 广播后端服务状态到所有渲染进程
   */
  private notifyServiceState(): void {
    BrowserWindow.getAllWindows().forEach((win) => {
      if (!win.isDestroyed()) {
        win.webContents.send(KernelServiceManager.SERVICE_STATE_CHANNEL, {
          running: this.backendRunning,
          pid: this.backendPid,
          logs: [...this.backendLogs]
        })
      }
    })
  }

  /**
   * 获取后端服务状态
   */
  getBackendStatus(): { running: boolean; pid: number } {
    return {
      running: this.backendRunning,
      pid: this.backendPid
    }
  }

  /**
   * 获取后端日志（用于终端显示）
   */
  getBackendLogs(): Buffer[] {
    return [...this.backendLogs]
  }

  /**
   * 获取内核的 Python 执行路径
   */
  private async getKernelPythonPath(): Promise<string | null> {
    const kernelPath = await this.kernelManager.getActiveKernelPath()
    if (!kernelPath) return null
    return process.platform === 'win32'
      ? path.join(kernelPath, '.venv', 'Scripts', 'python.exe')
      : path.join(kernelPath, '.venv', 'bin', 'python')
  }

  /**
   * 启动后端 Python 服务
   * 使用 uv run 启动内核的 main.py
   */
  async startBackend(): Promise<{ success: boolean; error?: string }> {
    if (this.backendRunning) {
      return { success: true }
    }

    const kernelPath = await this.kernelManager.getActiveKernelPath()
    if (!kernelPath) {
      return { success: false, error: '未安装内核，无法启动后端服务' }
    }

    const pythonPath = await this.getKernelPythonPath()
    if (!pythonPath || !fs.existsSync(pythonPath)) {
      return { success: false, error: '虚拟环境未配置，请先安装环境依赖' }
    }

    const scriptPath = 'main_web.py'
    const fullScriptPath = path.join(kernelPath, scriptPath)

    if (!fs.existsSync(fullScriptPath)) {
      return { success: false, error: `未找到启动脚本: ${scriptPath}` }
    }

    log.info(`[KernelManager] 启动后端服务: uv run ${scriptPath} (cwd: ${kernelPath})`)
    this.addSystemLog(`[系统] 正在启动内核后端服务...\r\n`)
    this.addSystemLog(`[系统] uv run ${scriptPath}\r\n`)
    this.addSystemLog(`[系统] 工作目录: ${kernelPath}\r\n`)

    try {
      // 使用内嵌 uv 运行（uv 自动管理 Python 版本）
      const uvExe = this.kernelManager.portableUvExe

      if (!fs.existsSync(uvExe)) {
        return { success: false, error: `内嵌 uv 未找到: ${uvExe}` }
      }

      // 启动前执行 uv sync 确保依赖最新（使用 pty 支持终端渲染）
      this.addSystemLog(`[系统] 正在同步依赖...\r\n`)
      try {
        await new Promise<void>((resolve, reject) => {
          const syncTerm = pty.spawn(uvExe, ['sync'], {
            cwd: kernelPath,
            name: 'xterm-256color',
            cols: 120,
            rows: 30,
            env: { ...process.env } as Record<string, string>
          })
          syncTerm.onData((data: string) => {
            broadcastToAllWindows(SERVICE_STREAM_CHANNEL, Buffer.from(data, 'utf-8'))
            this.addSystemLog(data)
          })
          syncTerm.onExit(({ exitCode, signal }) => {
            if (exitCode === 0) resolve()
            else reject(new Error(`uv sync 退出码: ${exitCode}, 信号: ${signal}`))
          })
        })
        this.addSystemLog(`[系统] 依赖同步完成\r\n`)
      } catch (syncErr) {
        const syncMsg = (syncErr as Error).message
        log.warn(`[KernelManager] uv sync 失败，尝试继续启动: ${syncMsg}`)
        this.addSystemLog(`[系统] 依赖同步失败: ${syncMsg}，继续启动...\r\n`)
      }

      // 使用 pty 启动后端（支持终端渲染与 ANSI 转义序列）
      const backendTerm = pty.spawn(uvExe, ['run', scriptPath], {
        cwd: kernelPath,
        name: 'xterm-256color',
        cols: 120,
        rows: 30,
        env: {
          ...process.env,
          PYTHONIOENCODING: 'utf-8',
          PYTHONUTF8: '1'
        } as Record<string, string>
      })

      this.backendProcess = backendTerm
      this.backendRunning = true
      this.backendPid = backendTerm.pid
      this.backendExitCode = null

      backendTerm.onData((data: string) => {
        const buf = Buffer.from(data, 'utf-8')
        this.broadcastStream(buf)
        this.addBackendLog(buf)
      })

      backendTerm.onExit(({ exitCode, signal }) => {
        this.backendRunning = false
        this.backendProcess = null
        this.backendPid = -1
        this.backendExitCode = exitCode
        this.addSystemLog(`[系统] 后端服务已退出 (退出码: ${exitCode}, 信号: ${signal})`)
        this.notifyServiceState()
        log.info(`[KernelManager] 后端服务已退出 (code=${exitCode}, signal=${signal})`)
      })

      this.addSystemLog(`[系统] 后端服务已启动 (PID: ${this.backendPid})`)
      this.notifyServiceState()

      log.info(`[KernelManager] 后端服务启动成功 (PID: ${this.backendPid})`)
      return { success: true }
    } catch (error) {
      const msg = (error as Error).message
      this.backendRunning = false
      this.backendProcess = null
      this.addSystemLog(`[系统] 启动后端服务失败: ${msg}`)
      this.notifyServiceState()
      log.error('[KernelManager] 启动后端服务失败:', msg)
      return { success: false, error: msg }
    }
  }

  /**
   * 停止后端 Python 服务
   * 先尝试优雅终止，然后强制结束进程树确保清理
   */
  async stopBackend(): Promise<{ success: boolean }> {
    if (!this.backendRunning && !this.backendProcess) {
      return { success: true }
    }

    this.addSystemLog('[系统] 正在停止后端服务...')
    log.info('[KernelManager] 正在停止后端服务...')

    // 强制结束整个进程树（兜底保障，确保子进程也被清理）
    const pid = this.backendPid
    if (pid > 0) {
      try {
        if (process.platform === 'win32') {
          await execAsync(`taskkill /PID ${pid} /T /F`, { timeout: 5000 }).catch(() => {
            /* 忽略 taskkill 的返回结果 */
          })
        } else {
          try {
            process.kill(-pid, 'SIGKILL')
          } catch {
            process.kill(pid, 'SIGKILL')
          }
        }
      } catch {
        // process may already be dead
      }
    }

    // 重置状态
    this.backendProcess = null
    this.backendRunning = false
    this.backendPid = -1
    this.backendExitCode = null
    this.addSystemLog('[系统] 后端服务已停止')
    this.notifyServiceState()
    log.info('[KernelManager] 后端服务已停止')
    return { success: true }
  }

  /**
   * 重启后端 Python 服务
   */
  async restartBackend(): Promise<{ success: boolean; error?: string }> {
    await this.stopBackend()
    await new Promise((resolve) => setTimeout(resolve, 1500))
    return this.startBackend()
  }

  /**
   * 检查后端服务健康状态 (HTTP health check)
   * 返回值包含 healthy 标志和可选的 error 信息
   * - healthy=true: 服务就绪
   * - healthy=false, stillRunning=true: 健康检查超时但进程仍在运行（仍在启动中）
   * - healthy=false, stillRunning=false, error: 进程异常退出，包含退出码信息
   */
  async checkBackendHealth(
    port = 8001,
    maxAttempts = 30,
    intervalMs = 1000
  ): Promise<{ healthy: boolean; error?: string; stillRunning?: boolean }> {
    for (let i = 0; i < maxAttempts; i++) {
      // 每次轮询前检查进程是否已异常退出
      if (!this.backendRunning && this.backendProcess === null) {
        const exitCode = this.backendExitCode
        const errorMsg =
          exitCode !== null ? `后端进程已退出 (退出码: ${exitCode})` : '后端进程异常终止'
        this.addSystemLog(`[系统] ✗ ${errorMsg}`)
        return { healthy: false, error: errorMsg, stillRunning: false }
      }

      try {
        const response = await axios.get(`http://127.0.0.1:${port}/api/health`, {
          timeout: 3000
        })
        if (response.status === 200) {
          // this.addSystemLog(`[系统] 后端服务健康检查通过 (端口 ${port})`)
          return { healthy: true }
        }
      } catch {
        // service not ready yet, continue polling
      }
      if (i < maxAttempts - 1) {
        await new Promise((resolve) => setTimeout(resolve, intervalMs))
      }
    }

    // 超时后再次确认进程状态
    if (!this.backendRunning && this.backendProcess === null) {
      const exitCode = this.backendExitCode
      const errorMsg =
        exitCode !== null ? `后端进程已退出 (退出码: ${exitCode})` : '后端进程异常终止'
      this.addSystemLog(`[系统] ✗ ${errorMsg}`)
      return { healthy: false, error: errorMsg, stillRunning: false }
    }

    // 进程仍在运行但健康检查超时 → 不视为错误，服务可能仍在启动
    this.addSystemLog(
      `[系统] 后端服务健康检查超时，但进程仍在运行 (端口 ${port}, 尝试 ${maxAttempts} 次)`
    )
    return { healthy: false, stillRunning: true }
  }
}

export { KernelManager, KernelServiceManager }
