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

/**
 * 升级时需要保留的用户数据目录，这些目录不会被新版本覆盖。
 * 后端会将虚拟环境、数据、配置文件都保存在内核目录中，
 * 因此升级时必须保留这些目录以避免数据丢失。
 */
const PRESERVED_DATA_DIRS = ['data', '.venv']
// 需要保留的文件
const PRESERVED_DATA_FILES = ['config.yaml']

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
  private get kernelRoot(): string {
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

  // ─── 状态管理 ───────────────────────────────────────

  private loadState(): void {
    // 检查当前内核是否存在
    const versionPath = this.versionFilePath

    const version = fs.readFileSync(versionPath, 'utf8').trim()
    this.state.currentVersion = version
    log.info(`当前内核版本: v${version}`)
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
   * 检查内核运行环境（uv, venv, 磁盘空间等）
   * uv 可以自行管理 Python 版本，因此不需要单独检查 Python
   */
  async checkEnvironment(): Promise<EnvironmentCheckResult> {
    const items: EnvironmentCheckItem[] = []

    // 1. 检查 uv
    let uvFound = false
    let uvVersion = ''
    try {
      const { stdout, stderr } = await execAsync('uv --version', {
        timeout: 5000,
        windowsHide: true
      })
      const output = (stdout || stderr || '').trim()
      if (output) {
        uvFound = true
        uvVersion = output
      }
    } catch {
      console.error('uv 包管理器不可用')
      // uv 未安装
    }

    items.push({
      name: 'uv 包管理器',
      passed: uvFound,
      message: uvFound ? uvVersion : '未找到 uv，请先安装: https://docs.astral.sh/uv/',
      key: 'uv'
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

    // 4. 检查磁盘空间
    const kernelRoot = this.kernelRoot
    let diskSpaceOk = true
    let diskMessage = '磁盘空间充足'
    try {
      const { statfsSync } = fs
      const stat = statfsSync(kernelRoot)
      const freeBytes = stat.bsize * stat.bfree
      const freeGB = freeBytes / (1024 * 1024 * 1024)
      if (freeGB < 1) {
        diskSpaceOk = false
        diskMessage = `磁盘空间不足: 仅剩 ${freeGB.toFixed(1)} GB (建议至少 1GB)`
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
    const needsSetup = kernelInstalled && !venvReady && uvFound

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

  /** 在内核目录中运行 uv sync 创建虚拟环境并安装依赖 */
  private setupEnvironment(onProgress: (progress: number) => void): Promise<void> {
    const kernelDir = this.kernelDir

    return new Promise((resolve, reject) => {
      // 检查 pyproject.toml 是否存在
      const pyprojectPath = path.join(kernelDir, 'pyproject.toml')
      if (!fs.existsSync(pyprojectPath)) {
        log.warn('内核没有 pyproject.toml，跳过依赖安装')
        onProgress(1)
        resolve()
        return
      }

      // 优先使用系统 uv
      const uvCommand = 'uv'
      const uvArgs = ['sync']

      this.state.statusText = '正在使用 uv 安装依赖...'
      this.notifyState()

      log.info(`运行 uv sync: ${kernelDir}`)

      const child = spawn(uvCommand, uvArgs, {
        cwd: kernelDir,
        stdio: 'pipe',
        shell: process.platform === 'win32'
      })

      let settled = false
      const errorLines: string[] = []

      child.stdout.on('data', (data: Buffer) => {
        const text = decodeBuffer(data).trim()
        if (text) {
          log.info(`[uv] ${text}`)
        }
      })

      child.stderr.on('data', (data: Buffer) => {
        const text = decodeBuffer(data).trim()
        if (text) {
          errorLines.push(text)
          log.warn(`[uv stderr] ${text}`)
        }
      })

      child.on('error', (error: Error) => {
        if (settled) return
        settled = true
        // uv 命令不存在，尝试 python -m uv
        log.warn(`uv 命令不可用，尝试 python -m uv: ${error.message}`)
        this.setupEnvironmentWithPython(kernelDir, onProgress).then(resolve).catch(reject)
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
          // 不阻塞安装流程 - 用户可以稍后手动安装依赖
          log.warn('依赖安装失败但继续，用户可手动运行 uv sync')
          this.state.statusText = '内核已安装，但依赖安装失败（可稍后手动安装）'
          onProgress(1)
          resolve()
        }
      })
    })
  }

  /** 使用 python -m uv 安装依赖（备选方案） */
  private setupEnvironmentWithPython(
    kernelDir: string,
    onProgress: (progress: number) => void
  ): Promise<void> {
    return new Promise((resolve) => {
      const pythonCommand = process.platform === 'win32' ? 'python' : 'python3'

      log.info(`尝试 ${pythonCommand} -m uv sync: ${kernelDir}`)

      const child = spawn(pythonCommand, ['-m', 'uv', 'sync'], {
        cwd: kernelDir,
        stdio: 'pipe',
        shell: process.platform === 'win32'
      })

      let settled = false

      child.on('error', () => {
        if (settled) return
        settled = true
        log.warn('python -m uv 也不可用，跳过依赖安装')
        onProgress(1)
        resolve()
      })

      child.on('close', (code: number | null) => {
        if (settled) return
        settled = true
        if (code === 0) {
          log.info('依赖安装完成 (via python -m uv)')
        } else {
          log.warn(`python -m uv sync 退出码: ${code}，跳过依赖安装`)
        }
        onProgress(1)
        resolve()
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

  /** 服务状态广播通道 */
  private static readonly SERVICE_STATE_CHANNEL = 'kernel:service-state'

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
   * 添加后端日志并广播
   */
  private addBackendLog(message: string): void {
    if (!message) return
    this.backendLogs.push(message.trim())
    if (this.backendLogs.length > this.maxBackendLogs) {
      this.backendLogs = this.backendLogs.slice(-this.maxBackendLogs)
    }
    this.notifyServiceState()
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
      // 使用系统 uv 命令直接运行，uv 会自动使用项目内的 .venv
      this.backendProcess = spawn('uv', ['run', scriptPath], {
        cwd: kernelPath,
        stdio: 'pipe',
        shell: process.platform === 'win32',
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
        const text = decodeBuffer(data)
        if (text) this.addBackendLog(text)
      })

      this.backendProcess.stderr.on('data', (data: Buffer) => {
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
   * - healthy=false 且无 error: 健康检查超时但进程仍在运行（仍在启动中）
   * - healthy=false 且有 error: 进程异常退出，包含退出码信息
   */
  async checkBackendHealth(
    port = 8001,
    maxAttempts = 30,
    intervalMs = 1000
  ): Promise<{ healthy: boolean; error?: string }> {
    for (let i = 0; i < maxAttempts; i++) {
      // 每次轮询前检查进程是否已异常退出
      if (!this.backendRunning && this.backendProcess === null) {
        const exitCode = this.backendExitCode
        const errorMsg =
          exitCode !== null ? `后端进程已退出 (退出码: ${exitCode})` : '后端进程异常终止'
        this.addBackendLog(`[系统] ✗ ${errorMsg}`)
        return { healthy: false, error: errorMsg }
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
      return { healthy: false, error: errorMsg }
    }

    // 进程仍在运行但健康检查超时 → 不视为错误，服务可能仍在启动
    this.addBackendLog(
      `[系统] 后端服务健康检查超时，但进程仍在运行 (端口 ${port}, 尝试 ${maxAttempts} 次)`
    )
    return { healthy: false }
  }
}

export { KernelManager, KernelServiceManager }
