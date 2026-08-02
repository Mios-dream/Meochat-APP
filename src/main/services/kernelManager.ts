import { app, BrowserWindow } from 'electron'
import { exec } from 'child_process'
import { promisify } from 'util'
import pty from 'node-pty'
import fs from 'fs'
import path from 'path'
import axios from 'axios'
import { Worker } from 'worker_threads'
import workerPath from '@/workers/extractWorker?modulePath'
import log from '../utils/logger'
import { resolveAppDataDir, resolveLogDir } from '../utils/pathResolve'
import type {
  KernelUpdateState,
  EnvironmentCheckResult,
  EnvironmentCheckItem
} from '@shared/types/kernel'
import { decodeBuffer } from '../utils/buffer'
import { detectZipNameEncoding } from '../utils/zipUtils'

const execAsync = promisify(exec)

const KERNEL_DIR_NAME = 'kernel'
const CURRENT_KERNEL_DIR = 'current'
const VERSION_FILE_NAME = 'version.txt'
const KERNEL_STATE_CHANNEL = 'kernel:state-update'
const SERVICE_STREAM_CHANNEL = 'kernel:service-stream'

/**
 * 比较两个点分版本号（如 1.7.0 / 1.10.1）。
 * 逐段按数值比较，避免字符串字典序导致的 1.10 < 1.7 误判。
 * @returns a 比 b 新返回正数，旧返回负数，相等返回 0
 */
function compareVersion(a: string, b: string): number {
  const partsA = a.split('.').map((n) => parseInt(n, 10) || 0)
  const partsB = b.split('.').map((n) => parseInt(n, 10) || 0)
  const length = Math.max(partsA.length, partsB.length)
  for (let i = 0; i < length; i++) {
    const numA = partsA[i] ?? 0
    const numB = partsB[i] ?? 0
    if (numA !== numB) return numA - numB
  }
  return 0
}

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
   * 检查内核运行环境（运行时、内核资源、venv、磁盘空间）
   * 使用内嵌便携 Python + uv，不再依赖系统级 uv 安装。
   * 模型完整性由后端自行检查与自动下载，前端不参与。
   */
  async checkEnvironment(): Promise<EnvironmentCheckResult> {
    const items: EnvironmentCheckItem[] = []

    let runtimeOk = false
    let venvReady = false
    let kernelOk = false

    // 1. 检查内嵌 Python 运行时完整性
    runtimeOk = fs.existsSync(this.portableUvExe)
    items.push({
      name: '内嵌 uv 管理器',
      passed: runtimeOk,
      message: runtimeOk ? `就绪 (${this.portableRuntimeDir})` : '内嵌管理器损坏，请重新安装应用',
      key: 'uv'
    })

    // 2. 检查内核源码完整性（pyproject.toml 存在，首次运行由自举流程装配）
    if (fs.existsSync(this.kernelDir)) {
      kernelOk = fs.existsSync(path.join(this.kernelDir, 'pyproject.toml'))
    }
    items.push({
      name: '内核资源',
      passed: kernelOk,
      message: kernelOk ? '内核资源已就绪' : '内核资源未装配，需要自举初始化',
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
          : '需要先装配内核资源',
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
    const needsSetup = runtimeOk && kernelOk && !venvReady

    return { items, allPassed, needsSetup }
  }

  /**
   * 自举初始化内核运行环境（安装包内置 zip 资源 → appData）
   * 1. 校验便携 uv 运行时完整性
   * 2. 解析内置资产包版本并与已装内核版本比对，决定：
   *    - 全新安装：解压资产包（源码 + wheels），完整版额外解压数据包（data/ 模型）
   *    - 就地升级：保留 data/（模型），仅替换内核源码与 wheels，随后重跑 uv sync
   * 3. 虚拟环境未就绪时，运行 uv sync 安装依赖（使用内置 wheels）
   * 任一环节失败即返回错误，由调用方停止运行
   */
  async bootstrapKernel(): Promise<{ success: boolean; error?: string }> {
    try {
      // 1. 便携 uv 运行时必须存在（安装包自带资源）
      if (!fs.existsSync(this.portableUvExe)) {
        return {
          success: false,
          error: `便携运行时损坏，请重新安装应用。\n期望路径: ${this.portableUvExe}`
        }
      }

      // 2. 恢复就地升级中断时残留的数据备份（防止模型数据遗弃）
      this.restoreDataUpgradeBackup()

      // 3. 解析安装包内置资产包（缺失则无法自举/升级）
      const assetsPackage = this.resolveAssetsPackage()
      if (!assetsPackage) {
        return { success: false, error: '安装包缺少内核资产包，请重新下载安装包。' }
      }

      // 3.1 版本比对：内置资产包版本高于已装内核版本 → 就地升级
      const kernelExists = fs.existsSync(path.join(this.kernelDir, 'pyproject.toml'))
      const installedVersion = this.readInstalledVersion()
      const bundledVersion = this.parseBundleVersion(assetsPackage)
      const needUpgrade =
        kernelExists &&
        installedVersion != null &&
        bundledVersion != null &&
        compareVersion(bundledVersion, installedVersion) > 0

      if (!kernelExists || needUpgrade) {
        this.setOperation(
          'installing',
          needUpgrade ? '正在升级内核（保留模型数据）...' : '正在解压内核资源包...'
        )
        this.state.progress = 0
        this.notifyState()
        log.info(
          `[KernelManager] 内核自举开始: 已装版本=${installedVersion ?? '无'} 内置版本=${bundledVersion ?? '未知'} 就地升级=${needUpgrade}`
        )

        if (needUpgrade) {
          // 就地升级：保留 data/（模型），替换内核源码与 wheels
          await this.replaceKernelKeepingData(assetsPackage, (ratio) => {
            this.state.progress = Math.round(ratio * 90)
            this.notifyState()
          })
        } else {
          // 全新安装：解压内核资产包（源码 + wheels）到 kernelDir 根目录
          await this.extractBundlePackage(assetsPackage, this.kernelDir, '', (ratio) => {
            this.state.progress = Math.round(ratio * 60)
            this.notifyState()
          })

          // 若内置数据包存在，解压到 {kernel}/data（完整版离线模型数据）
          const dataPackage = this.resolveDataPackage()
          if (dataPackage) {
            this.state.statusText = '正在解压内置数据包...'
            this.notifyState()
            await this.extractBundlePackage(dataPackage, this.kernelDir, 'data', (ratio) => {
              this.state.progress = Math.round(60 + ratio * 30)
              this.notifyState()
            })
          }
        }

        this.state.progress = 90
        this.notifyState()
        log.info(`[KernelManager] 内核资源就绪，来源: ${assetsPackage}`)
      }

      // 刷新内核版本号（setupKernelEnvironment 依赖 currentVersion）
      this.state.currentVersion = this.readInstalledVersion()
      if (this.state.currentVersion) {
        this.notifyState()
      }

      // 4. 虚拟环境未就绪时，运行 uv sync（内置 wheels 离线安装）
      const venvReady = this.isVenvReady()
      if (!venvReady) {
        log.info('[KernelManager] 虚拟环境未就绪，开始安装 Python 依赖')
        const setup = await this.setupKernelEnvironment()
        if (!setup.success) return setup
      }

      return { success: true }
    } catch (error) {
      const msg = (error as Error).message
      this.state.error = msg
      this.setOperation('error', `初始化失败: ${msg}`)
      return { success: false, error: msg }
    }
  }

  /** 判断虚拟环境是否已就绪 */
  private isVenvReady(): boolean {
    const venvPythonPath =
      process.platform === 'win32'
        ? path.join(this.kernelDir, '.venv', 'Scripts', 'python.exe')
        : path.join(this.kernelDir, '.venv', 'bin', 'python')
    return fs.existsSync(venvPythonPath)
  }

  /**
   * 解析安装包内置内核资产包（moechat-assets-*.zip）
   * 优先取名称排序最靠后的包（版本号在文件名中，字典序即版本序）；
   * 未找到时返回 null。
   */
  private resolveAssetsPackage(): string | null {
    return this.resolveBundlePackage('moechat-assets-')
  }

  /**
   * 解析安装包内置数据包（moechat-data-*.zip）
   * 精简版不含数据包，返回 null（模型由后端首次运行自动下载）。
   */
  private resolveDataPackage(): string | null {
    return this.resolveBundlePackage('moechat-data-')
  }

  /**
   * 在 kernel-assets 内置资源目录中查找指定前缀的 zip 包。
   * @param prefix 包名前缀（如 'moechat-assets-'、'moechat-data-'）
   * @returns 匹配的 zip 绝对路径；无匹配返回 null
   */
  private resolveBundlePackage(prefix: string): string | null {
    const bundleDir = this.portableKernelAssetsDir
    if (!fs.existsSync(bundleDir)) return null

    try {
      const zips = fs
        .readdirSync(bundleDir)
        .filter((name) => name.startsWith(prefix) && name.endsWith('.zip'))
      if (zips.length === 0) return null
      zips.sort()
      return path.join(bundleDir, zips[zips.length - 1])
    } catch {
      // 读取异常交由上层报错
      return null
    }
  }

  /**
   * 读取已安装内核版本（kernelDir/version.txt），缺失或读取失败返回 null。
   * version.txt 由资产包解压时写入内核根目录。
   */
  private readInstalledVersion(): string | null {
    try {
      const versionPath = this.versionFilePath
      if (!fs.existsSync(versionPath)) return null
      const version = fs.readFileSync(versionPath, 'utf8').trim()
      return version || null
    } catch {
      return null
    }
  }

  /**
   * 从资产包文件名解析版本号（如 moechat-assets-v1.7.0-cpu.zip → 1.7.0）。
   * 解析失败返回 null。
   */
  private parseBundleVersion(zipPath: string): string | null {
    const match = path.basename(zipPath).match(/moechat-assets-v(\d+\.\d+\.\d+)/)
    return match ? match[1] : null
  }

  /** 就地升级时内核数据（data/）的临时备份目录，与 kernelDir 同盘保证原子 rename */
  private get dataUpgradeBackupDir(): string {
    return path.join(this.kernelRoot, '.data-upgrade-backup')
  }

  /**
   * 就地升级内核：备份并保留 data/（模型），清空重建 kernelDir 后解压新资产包，再恢复 data/。
   * 解压失败时回滚：尽力恢复旧 data/，避免模型数据丢失。
   *
   * @param assetsPackage 内置资产包绝对路径
   * @param onProgress 进度回调（解压阶段 0-1 比值）
   */
  private async replaceKernelKeepingData(
    assetsPackage: string,
    onProgress: (ratio: number) => void
  ): Promise<void> {
    const dataDir = path.join(this.kernelDir, 'data')
    const backupDir = this.dataUpgradeBackupDir
    let hasData = false

    // 1. 将现有 data/（模型）原子移动到备份目录（同盘 rename 瞬时完成）
    if (fs.existsSync(dataDir)) {
      fs.rmSync(backupDir, { recursive: true, force: true })
      fs.renameSync(dataDir, backupDir)
      hasData = true
    }

    try {
      // 2. 清空旧内核目录（旧源码、wheels、.venv 一并移除，随后重跑 uv sync）
      fs.rmSync(this.kernelDir, { recursive: true, force: true })
      fs.mkdirSync(this.kernelDir, { recursive: true })

      // 3. 解压新资产包到全新 kernelDir
      await this.extractBundlePackage(assetsPackage, this.kernelDir, '', onProgress)
    } catch (error) {
      // 解压失败：回滚 data/，保留旧内核目录（可能残留部分文件，交由下次自举重建）
      if (hasData && !fs.existsSync(dataDir)) {
        fs.mkdirSync(path.dirname(dataDir), { recursive: true })
        fs.renameSync(backupDir, dataDir)
      }
      throw error
    }

    // 4. 恢复 data/ 到新内核目录
    if (hasData) {
      fs.mkdirSync(dataDir, { recursive: true })
      fs.renameSync(backupDir, dataDir)
    }
  }

  /**
   * 恢复就地升级中断时残留的数据备份。
   * data/ 曾被移动到备份目录但未完成恢复（进程崩溃/断电等），在每次自举开始时检测并还原，
   * 防止模型数据被遗弃在备份目录而内核目录缺失 data/。
   */
  private restoreDataUpgradeBackup(): void {
    const dataDir = path.join(this.kernelDir, 'data')
    const backupDir = this.dataUpgradeBackupDir
    if (fs.existsSync(backupDir) && !fs.existsSync(dataDir)) {
      try {
        fs.mkdirSync(path.dirname(dataDir), { recursive: true })
        fs.renameSync(backupDir, dataDir)
        log.info('[KernelManager] 已恢复升级中断时的模型数据备份')
      } catch (error) {
        log.error('[KernelManager] 恢复数据备份失败:', error)
      }
    }
  }

  /**
   * 使用 Worker 线程解压内置 zip 包到目标目录，实时上报进度。
   * 保留源 zip（不删除），供后续运行重复自举。
   *
   * @param zipPath 内置 zip 包的绝对路径
   * @param targetDir 解压目标目录（如 kernelDir）
   * @param subDir 可选的子目录前缀（如 'data' 表示解压到 {targetDir}/data 下）
   * @param onProgress 进度回调，参数为 0-1 的比值
   */
  private extractBundlePackage(
    zipPath: string,
    targetDir: string,
    subDir: string,
    onProgress: (ratio: number) => void
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      detectZipNameEncoding(zipPath)
        .then((nameEncoding) => {
          // 创建 Worker 执行解压
          const worker = new Worker(workerPath, {
            workerData: {
              zipPath,
              targetDir,
              nameEncoding,
              isFullDownload: false,
              subDir,
              deleteZip: false
            }
          })

          worker.on('message', (message) => {
            if (message.type === 'progress') {
              const ratio = message.total > 0 ? message.processed / message.total : 0
              onProgress(ratio)
            } else if (message.type === 'complete') {
              if (message.success) {
                resolve()
              } else {
                reject(new Error(message.error || '解压失败'))
              }
            }
          })

          worker.on('error', (error) => {
            log.error('[KernelManager] 解压 Worker 错误:', error)
            reject(new Error(`解压进程错误: ${error.message}`))
          })

          // Worker 退出时如果还没收到 complete 消息，返回错误
          worker.on('exit', (code) => {
            if (code !== 0) {
              log.error(`[KernelManager] 解压 Worker 异常退出，代码: ${code}`)
              reject(new Error(`解压 Worker 异常退出，代码: ${code}`))
            }
          })
        })
        .catch((error) => {
          log.error('[KernelManager] 探测 zip 编码失败:', error)
          reject(new Error(`探测 zip 编码失败: ${(error as Error).message}`))
        })
    })
  }

  /** 安装包内置内核资源目录（kernel-assets） */
  get portableKernelAssetsDir(): string {
    if (app.isPackaged) {
      return path.join(process.resourcesPath, 'kernel-assets')
    }
    return path.join(app.getAppPath(), 'resources', 'kernel-assets')
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

  // ─── 依赖安装 ─────────────────────────────────────

  /**
   * 安装环境依赖：uv sync 下载全部依赖，实时转发进度到终端
   * CPU/CUDA 版本由打包阶段决定，运行时不再升级 CUDA。
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
      log.info(`[setup] uv sync (cwd: ${kernelDir})`)
      this.runSyncWithProgress(kernelDir, uvExe, onProgress)
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
   * 解析本地 wheels 缓存目录（uv sync 离线安装用）
   * wheels 目录存在且包含 .whl 时返回该目录，否则返回 null（回退网络下载）。
   * Python 版本与包兼容性由后端 pyproject.toml 自动管理，无需前端预检。
   */
  private resolveWheelsDir(): string | null {
    const rawDir = path.join(this.kernelDir, 'wheels')
    if (!fs.existsSync(rawDir)) return null
    try {
      const hasWhl = fs.readdirSync(rawDir).some((f) => f.endsWith('.whl'))
      return hasWhl ? rawDir : null
    } catch {
      return null
    }
  }

  /**
   * 通过伪终端 (PTY) 执行 uv sync，使 uv 认为连接的是真实终端，
   * 进而输出 ANSI 进度条动画（含百分比和下载速度）。
   *
   * 通过 node-pty 在 Windows 上使用 ConPTY，在 macOS/Linux 上使用
   * 标准 PTY。原始 ANSI 数据直接转发给前端的 xterm 组件渲染，
   * 同时解析其中的百分比用于更新 UI 进度条。
   */
  private async runSyncWithProgress(
    kernelDir: string,
    uvExe: string,
    onProgress: (p: number) => void
  ): Promise<void> {
    const uvArgs = ['sync']
    const wheelsDir = this.resolveWheelsDir()
    if (wheelsDir) {
      uvArgs.push('--find-links', wheelsDir)
      log.info(`[setup] 使用本地 wheel 缓存: ${wheelsDir}`)
    } else {
      log.info('[setup] 无本地 wheel 缓存，将从 PyPI 下载依赖')
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
    intervalMs = 5000
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
