import { app, BrowserWindow } from 'electron'
import { spawn, exec, ChildProcessWithoutNullStreams } from 'child_process'
import { promisify } from 'util'
import fs from 'fs'
import path from 'path'
import axios from 'axios'
import AdmZip from 'adm-zip'
import log from '../utils/logger'

import { setConfig } from '../config/configManager'
import type { KernelRemoteVersion, KernelUpdateState } from '../../renderer/src/types/KernelInfo'
import { resolveAppDataDir } from '../utils/pathResolve'
import type {
  EnvironmentCheckResult,
  EnvironmentCheckItem
} from '../../renderer/src/types/KernelInfo'
import type { KernelLogEntry } from '../../renderer/src/types/KernelInfo'
import { decodeBuffer } from '../utils/buffer'

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
 * 后端会将虚拟环境、数据、配置文件都保存在内核目录中，
 * 因此升级时必须保留这些目录以避免数据丢失。
 */
const PRESERVED_DATA_DIRS = ['data', '.venv']
// 需要保留的文件
const PRESERVED_DATA_FILES = ['config.yaml']

/** 向所有窗口广播原始数据流 */
function broadcastToAllWindows(channel: string, payload: string): void {
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
   * 检查内核运行环境（内嵌运行时、venv、磁盘空间等）
   * 使用内嵌便携 Python + uv，不再依赖系统级 uv 安装
   */
  async checkEnvironment(): Promise<EnvironmentCheckResult> {
    const items: EnvironmentCheckItem[] = []

    // 1. 检查内嵌 Python 运行时完整性（替代系统 uv 检查）
    const runtimeOk = fs.existsSync(this.portableUvExe)
    items.push({
      name: '内嵌 Python 运行时',
      passed: runtimeOk,
      message: runtimeOk ? `就绪 (${this.portableRuntimeDir})` : '内嵌运行时损坏，请重新安装应用',
      key: 'runtime'
    })

    // 2. 检查内核是否已安装
    const kernelPath = await this.getActiveKernelPath()
    const kernelInstalled = kernelPath !== null
    items.push({
      name: 'MoeChat 内核',
      passed: kernelInstalled,
      message: kernelInstalled
        ? `已安装 (v${this.state.currentVersion})\n${kernelPath}`
        : '未安装，请下载内核',
      key: 'kernel'
    })

    // 3. 检查 venv 是否已配置
    let venvReady = false
    if (kernelPath) {
      const venvPythonPath =
        process.platform === 'win32'
          ? path.join(kernelPath, '.venv', 'Scripts', 'python.exe')
          : path.join(kernelPath, '.venv', 'bin', 'python')
      venvReady = fs.existsSync(venvPythonPath)
    }
    items.push({
      name: '虚拟环境 (.venv)',
      passed: venvReady,
      message: venvReady
        ? '虚拟环境已就绪'
        : kernelInstalled
          ? '虚拟环境未配置，需要运行 uv sync'
          : '需要先安装内核',
      key: 'venv'
    })

    // 4. 检查磁盘空间（建议 ≥20GB，PyTorch + 依赖约需 14GB）
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
    const needsSetup = kernelInstalled && !venvReady && runtimeOk

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
   * 下载模型数据（运行 download.py）
   * 用于首次安装后下载 embedding、ASR 等 ML 模型
   */
  async downloadModels(): Promise<{ success: boolean; error?: string }> {
    const version = this.state.currentVersion
    if (!version) {
      return { success: false, error: '没有安装内核' }
    }

    const downloadScript = path.join(this.kernelDir, 'download.py')
    if (!fs.existsSync(downloadScript)) {
      return { success: false, error: '未找到模型下载脚本 download.py' }
    }

    const uvExe = this.portableUvExe
    if (!fs.existsSync(uvExe)) {
      return { success: false, error: '内嵌 uv 未找到，请重新安装应用' }
    }

    const pythonPath =
      process.platform === 'win32'
        ? path.join(this.kernelDir, '.venv', 'Scripts', 'python.exe')
        : path.join(this.kernelDir, '.venv', 'bin', 'python')

    if (!fs.existsSync(pythonPath)) {
      return { success: false, error: '虚拟环境未配置，请先安装环境依赖' }
    }

    this.setOperation('settingUpEnv', '正在下载 AI 模型...')
    this.state.progress = 0
    this.notifyState()

    log.info(`[KernelManager] 开始下载模型: uv run download.py (cwd: ${this.kernelDir})`)

    return new Promise((resolve) => {
      const child = spawn(uvExe, ['run', 'download.py'], {
        cwd: this.kernelDir,
        stdio: 'pipe',
        env: { ...process.env }
      })

      let settled = false
      const errorLines: string[] = []

      child.stdout.on('data', (data: Buffer) => {
        broadcastToAllWindows(SERVICE_STREAM_CHANNEL, data.toString('base64'))
        const text = data.toString('utf-8').trim()
        if (text) {
          log.info(`[model-dl] ${text}`)
          this.state.statusText = text.slice(0, 100)
          // 模型下载进度粗略估算（modelscope snapshot_download 不提供精确进度）
          const prevProgress = this.state.progress
          this.state.progress = Math.min(95, prevProgress + 3)
          this.notifyState()
        }
      })

      child.stderr.on('data', (data: Buffer) => {
        broadcastToAllWindows(SERVICE_STREAM_CHANNEL, data.toString('base64'))
        const text = data.toString('utf-8').trim()
        if (text) {
          errorLines.push(text)
          log.warn(`[model-dl stderr] ${text}`)
        }
      })

      child.on('error', (error: Error) => {
        if (settled) return
        settled = true
        const msg = `无法启动模型下载: ${error.message}`
        this.state.error = msg
        this.setOperation('error', msg)
        resolve({ success: false, error: msg })
      })

      child.on('close', (code: number | null) => {
        if (settled) return
        settled = true

        if (code === 0) {
          log.info('[KernelManager] 模型下载完成')
          this.state.progress = 100
          this.setOperation('done', '模型下载完成')
          resolve({ success: true })
        } else {
          const errorMsg = errorLines.join('\n') || `download.py 退出码: ${code}`
          log.error(`[KernelManager] 模型下载失败: ${errorMsg}`)
          this.state.error = errorMsg
          this.setOperation('error', `模型下载失败 (退出码 ${code})`)
          resolve({ success: false, error: errorMsg })
        }
      })
    })
  }

  /**
   * 获取操作日志（最近的操作记录）
   */
  getOperationLogs(): KernelLogEntry[] {
    const logs: KernelLogEntry[] = []

    if (this.state.currentVersion) {
      logs.push({
        time: new Date().toISOString(),
        level: 'info',
        message: `当前内核版本: v${this.state.currentVersion}`
      })
    } else {
      logs.push({
        time: new Date().toISOString(),
        level: 'warn',
        message: '未安装内核'
      })
    }

    if (this.state.latestVersion) {
      logs.push({
        time: new Date().toISOString(),
        level: this.state.updateAvailable ? 'info' : 'success',
        message: this.state.updateAvailable
          ? `发现新版本: v${this.state.latestVersion.version}`
          : `内核已是最新版本 v${this.state.latestVersion.version}`
      })
    }

    if (this.state.operationStatus !== 'idle' && this.state.operationStatus !== 'done') {
      logs.push({
        time: new Date().toISOString(),
        level: 'info',
        message: `[${this.state.operationStatus}] ${this.state.statusText} (${this.state.progress}%)`
      })
    }

    if (this.state.error) {
      logs.push({
        time: new Date().toISOString(),
        level: 'error',
        message: this.state.error
      })
    }

    return logs
  }

  /** 检查远端是否有新内核版本 */
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
   * 下载并安装最新版本内核
   * 会保留用户数据目录，只替换代码文件
   */
  async downloadAndInstall(version?: string): Promise<boolean> {
    // 如果未指定版本，使用已获取的最新版本
    let targetVersion: string

    if (version) {
      targetVersion = version
    } else if (this.state.latestVersion?.version) {
      targetVersion = this.state.latestVersion.version
    } else {
      // 重新获取最新版本
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

    // 如果已经是最新版本，检查是否需要重新确认
    if (
      this.state.currentVersion &&
      this.compareVersions(this.state.currentVersion, targetVersion) >= 0
    ) {
      const pyprojectPath = path.join(this.kernelDir, 'pyproject.toml')
      if (fs.existsSync(pyprojectPath)) {
        // 已安装且是最新，但允许强制重装（用于修复损坏的安装）
        this.setOperation('done', `内核已是最新版本 v${this.state.currentVersion}`)
        this.notifyState()
        return true
      }
    }

    // 获取下载 URL
    if (!this.state.latestVersion || this.state.latestVersion.version !== targetVersion) {
      try {
        this.state.latestVersion = await this.fetchLatestRelease()
      } catch {
        // 继续使用已有的 latestVersion
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
      // 准备临时目录
      if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true })
      }

      // 步骤 1: 下载 (0-40%)
      this.setOperation('downloading', '正在下载内核...')
      await this.downloadFile(downloadUrl, tempZip, (progress) => {
        this.state.progress = Math.round(progress * 40)
        this.notifyState()
      })

      // 步骤 2: 解压安装 (40-55%)
      this.setOperation('installing', '正在解压内核...')
      this.state.progress = 40
      this.notifyState()

      await this.installKernelFromZip(tempZip, targetVersion)

      this.state.progress = 55
      this.notifyState()

      // 步骤 3: 设置 Python 环境 & 安装依赖 (55-95%)
      this.setOperation('settingUpEnv', '正在安装Python依赖...')
      await this.setupEnvironment((progress) => {
        this.state.progress = 55 + Math.round(progress * 0.4)
        this.notifyState()
      })

      this.state.progress = 100
      this.setOperation('done', `内核 v${targetVersion} 安装完成`)
      this.notifyState()

      // 通知渲染进程需要重启后端服务
      BrowserWindow.getAllWindows().forEach((win) => {
        if (!win.isDestroyed()) {
          win.webContents.send('kernel:need-restart', { version: targetVersion })
        }
      })

      return true
    } catch (error) {
      const msg = (error as Error).message
      log.error('下载安装内核失败:', msg)
      this.state.error = msg
      this.setOperation('error', `安装失败: ${msg}`)
      return false
    } finally {
      // 清理临时文件
      try {
        await fs.promises.unlink(tempZip).catch(() => {
          /* ignore */
        })
      } catch {
        /* ignore */
      }
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

      // 查找包含 "moechat" 或 "kernel" 或 "backend" 的 zip 资源
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
        // 如果没有找到 zip，使用 source code zip
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

  /** 下载文件并回调进度 */
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
      headers: {
        'User-Agent': 'MoeChat-APP',
        Accept: 'application/octet-stream'
      },
      timeout: 600000 // 10 分钟超时
    })

    const totalLength = parseInt(String(response.headers['content-length'] || '0'), 10)

    return new Promise((resolve, reject) => {
      let downloaded = 0

      response.data.on('data', (chunk: Buffer) => {
        downloaded += chunk.length
        if (totalLength > 0) {
          onProgress(downloaded / totalLength)
        }
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
   * 会保留用户数据目录，仅替换代码文件，避免数据丢失
   */
  private async installKernelFromZip(zipPath: string, version: string): Promise<void> {
    // 目标目录
    const targetDir = this.kernelDir

    // 清理内核目录中的代码文件（保留用户数据目录）
    try {
      await fs.promises.access(targetDir)
      await this.cleanCodeFiles(targetDir)
    } catch {
      // 目录不存在，跳过清理
    }

    // 解压 zip
    const zip = new AdmZip(zipPath)
    const entries = zip.getEntries()
    const topLevelDir = this.detectSingleTopLevelDir(entries)

    if (topLevelDir) {
      log.info(`检测到内核压缩包外层目录: ${topLevelDir}，将移除外层目录后解压`)
      const writeTasks: Promise<void>[] = []
      for (const entry of entries) {
        const entryName = entry.entryName.replace(/\\/g, '/')
        if (!entryName || entryName === `${topLevelDir}/`) continue
        if (!entryName.startsWith(`${topLevelDir}/`)) continue

        const relativePath = entryName.slice(topLevelDir.length + 1)
        if (!relativePath) continue

        const targetPath = path.join(targetDir, relativePath)
        if (entry.isDirectory) {
          writeTasks.push(fs.promises.mkdir(targetPath, { recursive: true }).then())
        } else {
          writeTasks.push(
            fs.promises
              .mkdir(path.dirname(targetPath), { recursive: true })
              .then(() => fs.promises.writeFile(targetPath, entry.getData()))
          )
        }
      }
      await Promise.all(writeTasks)
    } else {
      zip.extractAllTo(targetDir, true)
    }

    // 写入版本文件 ──
    await fs.promises.writeFile(this.versionFilePath, version, 'utf8')

    // 更新状态
    this.state.currentVersion = version
    setConfig('activeKernelVersion', version)

    log.info(`内核 v${version} 升级完成: ${targetDir}`)
  }

  /**
   * 判断是否存在单一外层目录（用于去掉压缩包外层文件夹）
   */
  private detectSingleTopLevelDir(entries): string | null {
    let topLevelDir: string | null = null
    let hasRootFile = false

    for (const entry of entries) {
      const entryName = entry.entryName.replace(/\\/g, '/')
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

        // 跳过白名单中的目录
        if (PRESERVED_DATA_DIRS.includes(entry.name)) {
          log.info(`保留目录: ${entry.name}`)
          continue
        }

        // 跳过白名单中的文件
        if (PRESERVED_DATA_FILES.includes(entry.name)) {
          log.info(`保留文件: ${entry.name}`)
          continue
        }

        // 删除不在白名单中的项
        try {
          if (entry.isDirectory()) {
            await fs.promises.rm(fullPath, { recursive: true, force: true })
            log.info(`删除目录: ${entry.name}`)
          } else {
            await fs.promises.unlink(fullPath)
            log.info(`删除文件: ${entry.name}`)
          }
        } catch (error) {
          log.error(`清理文件/目录失败: ${fullPath}, ${(error as Error).message}`)
        }
      }

      log.info(`内核目录清理完成: ${dir}`)
    } catch (error) {
      log.error(`清理内核目录失败: ${(error as Error).message}`)
    }
  }

  /** 使用内嵌 uv 在内核目录中运行 uv sync，从 PyPI 镜像下载所有预编译 wheel */
  private setupEnvironment(onProgress: (progress: number) => void): Promise<void> {
    const kernelDir = this.kernelDir
    const uvExe = this.portableUvExe

    return new Promise((resolve, reject) => {
      // 检查 pyproject.toml 是否存在
      const pyprojectPath = path.join(kernelDir, 'pyproject.toml')
      if (!fs.existsSync(pyprojectPath)) {
        log.warn('内核没有 pyproject.toml，跳过依赖安装')
        onProgress(1)
        resolve()
        return
      }

      // 断言内嵌运行时存在
      if (!fs.existsSync(uvExe)) {
        reject(new Error('内嵌 Python 运行时未找到，请重新安装应用。\n' + `期望路径: ${uvExe}`))
        return
      }

      this.state.statusText = '正在从镜像安装依赖（首次约需 5GB 下载）...'
      this.notifyState()

      log.info(`运行内嵌 uv sync: ${kernelDir}`)
      log.info(`  uv: ${uvExe}`)

      const child = spawn(uvExe, ['sync'], {
        cwd: kernelDir,
        stdio: 'pipe',
        env: {
          ...process.env
        }
      })

      let settled = false
      const errorLines: string[] = []
      let lastProgress = 0

      child.stdout.on('data', (data: Buffer) => {
        broadcastToAllWindows(SERVICE_STREAM_CHANNEL, data.toString('base64'))
        const text = decodeBuffer(data).trim()
        if (text) {
          log.info(`[uv] ${text}`)
          // 解析 uv 输出估算进度
          if (
            text.includes('Resolved') ||
            text.includes('Downloaded') ||
            text.includes('Installed')
          ) {
            lastProgress = Math.min(0.95, lastProgress + 0.05)
            onProgress(lastProgress)
          }
        }
      })

      child.stderr.on('data', (data: Buffer) => {
        broadcastToAllWindows(SERVICE_STREAM_CHANNEL, data.toString('base64'))
        const text = decodeBuffer(data).trim()
        if (text) {
          errorLines.push(text)
          log.warn(`[uv stderr] ${text}`)
        }
      })

      child.on('error', (error: Error) => {
        if (settled) return
        settled = true
        reject(new Error(`无法启动内嵌 uv: ${error.message}`))
      })

      child.on('close', (code: number | null) => {
        if (settled) return
        settled = true

        if (code === 0) {
          log.info('依赖安装完成')
          onProgress(1)
          resolve()
        } else {
          const errorMsg = errorLines.join('\n') || `uv sync 退出码: ${code}`
          log.error(`依赖安装失败: ${errorMsg}`)
          reject(new Error(`依赖安装失败 (退出码 ${code}): ${errorMsg}`))
        }
      })
    })
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
}

class KernelServiceManager {
  private static instance: KernelServiceManager
  /** 后端 Python 进程 */
  private backendProcess: ChildProcessWithoutNullStreams | null = null

  /** 后端服务运行状态 */
  private backendRunning = false

  /** 后端服务 PID */
  private backendPid = -1

  /** 后端进程退出码（进程退出后记录） */
  private backendExitCode: number | null = null

  /** 后端服务日志 */
  private backendLogs: string[] = []
  private readonly maxBackendLogs = 100

  /** 日志文件最大大小 (1MB) */
  private readonly maxLogFileSize = 1 * 1024 * 1024

  /** 持久化日志文件路径（与 electron-log 的日志目录一致） */
  private get backendLogFile(): string {
    return path.join(app.getPath('logs'), 'core.log')
  }

  /** 服务状态广播通道 */
  private static readonly SERVICE_STATE_CHANNEL = 'kernel:service-state'

  /** 原始数据流广播，发送原始二进制数据给渲染进程 */
  private broadcastStream(data: Buffer): void {
    broadcastToAllWindows(SERVICE_STREAM_CHANNEL, data.toString('base64'))
  }

  public kernelManager: KernelManager

  private constructor() {
    this.kernelManager = KernelManager.getInstance()
    log.info(`[KernelServiceManager] 构造函数被调用，开始加载持久化日志`)
    this.loadPersistedLogs()
    log.info(`[KernelServiceManager] 构造函数完成，backendLogs 长度: ${this.backendLogs.length}`)
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
   */
  private addBackendLog(message: string): void {
    if (!message) return
    const lines = message
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line.length > 0)

    if (lines.length === 0) return

    this.backendLogs.push(...lines)
    if (this.backendLogs.length > this.maxBackendLogs) {
      this.backendLogs = this.backendLogs.slice(-this.maxBackendLogs)
    }
    this.notifyServiceState()
    this.persistLogs(lines)
  }

  /**
   * 从文件加载持久化的后端日志
   */
  private loadPersistedLogs(): void {
    try {
      const logFile = this.backendLogFile
      log.info(`[loadPersistedLogs] 尝试加载日志文件: ${logFile}`)
      log.info(`[loadPersistedLogs] 文件是否存在: ${fs.existsSync(logFile)}`)
      
      if (fs.existsSync(logFile)) {
        const stats = fs.statSync(logFile)
        log.info(`[loadPersistedLogs] 文件大小: ${stats.size} 字节`)
        
        const raw = fs.readFileSync(logFile, 'utf-8')
        log.info(`[loadPersistedLogs] 读取到 ${raw.length} 个字符`)
        
        const lines = raw
          .split(/\r?\n/)
          .map((line) => line.trim())
          .filter((line) => line.length > 0)
        
        log.info(`[loadPersistedLogs] 文件包含 ${lines.length} 行日志`)
        if (lines.length > 0) {
          log.info(`[loadPersistedLogs] 第一行: ${lines[0].substring(0, 100)}...`)
          log.info(`[loadPersistedLogs] 最后一行: ${lines[lines.length - 1].substring(0, 100)}...`)
        }
        
        this.backendLogs = lines.slice(-this.maxBackendLogs)
        log.info(`[loadPersistedLogs] 加载了 ${this.backendLogs.length} 条历史日志`)
      } else {
        log.info(`[loadPersistedLogs] 日志文件不存在: ${logFile}`)
      }
    } catch (error) {
      log.error(`[loadPersistedLogs] 加载日志失败:`, (error as Error).message)
      log.error(`[loadPersistedLogs] 错误堆栈:`, (error as Error).stack)
    }
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
  getBackendStatus(): { running: boolean; pid: number; logs: string[] } {
    return {
      running: this.backendRunning,
      pid: this.backendPid,
      logs: [...this.backendLogs]
    }
  }

  /**
   * 获取后端日志
   */
  getBackendLogs(): string[] {
    log.info(`[getBackendLogs] 返回 ${this.backendLogs.length} 条日志`)
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
    this.addBackendLog(`[系统] 正在启动内核后端服务...`)
    this.addBackendLog(`[系统] uv run ${scriptPath}`)
    this.addBackendLog(`[系统] 工作目录: ${kernelPath}`)

    try {
      // 使用内嵌 uv 运行（uv 自动管理 Python 版本）
      const uvExe = this.kernelManager.portableUvExe

      if (!fs.existsSync(uvExe)) {
        return { success: false, error: `内嵌 uv 未找到: ${uvExe}` }
      }

      this.backendProcess = spawn(uvExe, ['run', scriptPath], {
        cwd: kernelPath,
        stdio: 'pipe',
        env: {
          ...process.env,
          PYTHONIOENCODING: 'utf-8',
          PYTHONUTF8: '1'
        }
      })

      this.backendRunning = true
      this.backendPid = this.backendProcess.pid ?? -1
      this.backendExitCode = null

      this.backendProcess.stdout.on('data', (data: Buffer) => {
        this.broadcastStream(data)
        const text = decodeBuffer(data)
        if (text) this.addBackendLog(text)
      })

      this.backendProcess.stderr.on('data', (data: Buffer) => {
        this.broadcastStream(data)
        const text = decodeBuffer(data)
        if (text) this.addBackendLog(text)
      })

      this.backendProcess.on('error', (err: Error) => {
        this.backendRunning = false
        this.backendProcess = null
        this.backendExitCode = this.backendExitCode ?? -1
        this.addBackendLog(`[系统] 后端服务进程错误: ${err.message}`)
        this.notifyServiceState()
        log.error('[KernelManager] 后端服务进程错误:', err.message)
      })

      this.backendProcess.on('close', (code: number | null, signal: string | null) => {
        this.backendRunning = false
        this.backendProcess = null
        this.backendPid = -1
        this.backendExitCode = code
        this.addBackendLog(`[系统] 后端服务已退出 (退出码: ${code}, 信号: ${signal})`)
        this.notifyServiceState()
        log.info(`[KernelManager] 后端服务已退出 (code=${code}, signal=${signal})`)
      })

      this.addBackendLog(`[系统] 后端服务已启动 (PID: ${this.backendPid})`)
      this.notifyServiceState()

      log.info(`[KernelManager] 后端服务启动成功 (PID: ${this.backendPid})`)
      return { success: true }
    } catch (error) {
      const msg = (error as Error).message
      this.backendRunning = false
      this.backendProcess = null
      this.addBackendLog(`[系统] 启动后端服务失败: ${msg}`)
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

    this.addBackendLog('[系统] 正在停止后端服务...')
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
    this.addBackendLog('[系统] 后端服务已停止')
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
        this.addBackendLog(`[系统] ✗ ${errorMsg}`)
        return { healthy: false, error: errorMsg, stillRunning: false }
      }

      try {
        const response = await axios.get(`http://127.0.0.1:${port}/api/health`, {
          timeout: 3000
        })
        if (response.status === 200) {
          // this.addBackendLog(`[系统] 后端服务健康检查通过 (端口 ${port})`)
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
      this.addBackendLog(`[系统] ✗ ${errorMsg}`)
      return { healthy: false, error: errorMsg, stillRunning: false }
    }

    // 进程仍在运行但健康检查超时 → 不视为错误，服务可能仍在启动
    this.addBackendLog(
      `[系统] 后端服务健康检查超时，但进程仍在运行 (端口 ${port}, 尝试 ${maxAttempts} 次)`
    )
    return { healthy: false, stillRunning: true }
  }
}

export { KernelManager, KernelServiceManager }
