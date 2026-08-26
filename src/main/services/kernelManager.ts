import { app } from 'electron'
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
import { windowRegistry } from '../windows'
import { CHANNELS } from '@shared/ipc/channels'

const execAsync = promisify(exec)

const KERNEL_DIR_NAME = 'kernel'
const CURRENT_KERNEL_DIR = 'current'
const MANIFEST_FILE_NAME = 'manifest.json'

/** 内核资产包信息（从 kernel-assets/manifest.json 权威声明解析） */
interface AssetBundleInfo {
  /** 资产包文件名（如 moechat-assets-v1.7.0-win-lite.zip） */
  file: string
  /** 内核版本号（如 1.7.0） */
  version: string
  /** 构建唯一标识：同一版本不同内容时不同，用于同版本内容变更检测 */
  buildId: string
}

/** 已安装内核的版本指纹（从 kernelDir/manifest.json 读取） */
interface InstalledKernelFingerprint {
  version: string
  buildId: string
}

/** kernel-assets/manifest.json 权威声明的原始结构 */
interface KernelAssetsDeclaration {
  assets?: {
    file: string
    version: string
    build_id: string
  }
}

/** 向所有可接收 IPC 的窗口广播原始数据流 */
function broadcastToAllWindows(channel: string, payload: Buffer): void {
  windowRegistry.broadcast(channel, payload)
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

  /** 操作日志（uv sync 依赖安装等，存储原始 Buffer，保留 ANSI 转义序列） */
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
    // 可执行文件名随平台而异：Windows 为 uv.exe，Linux/macOS 为 uv
    const uvBinaryName = process.platform === 'win32' ? 'uv.exe' : 'uv'
    return path.join(this.portableRuntimeDir, uvBinaryName)
  }

  // ─── 状态管理 ───────────────────────────────────────

  private loadState(): void {
    const installed = this.readInstalledFingerprint()
    if (installed) {
      this.state.currentVersion = installed.version
      log.info(`当前内核版本: v${installed.version}`)
    } else {
      log.info('未检测到已安装的内核，需要下载')
      this.state.currentVersion = null
    }
  }

  /** 向所有可接收 IPC 的窗口广播内核更新状态 */
  private notifyState(): void {
    windowRegistry.broadcast(CHANNELS.KERNEL_STATE_UPDATE_EVENT, { ...this.state })
  }

  /** 更新操作状态与文本（同时清空 error 字段） */
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
   * 自举初始化内核运行环境：
   * 校验便携 uv → 解析内置资产包并与已装内核比对（全新安装/就地升级）→ 运行 uv sync 对齐依赖
   * （无论虚拟环境是否就绪，确保依赖与当前源码/ wheels 缓存一致，覆盖安装/升级场景不会依赖不同步）。
   * 任一环节失败即返回错误，由调用方停止运行。
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

      // 2. 解析安装包内置资产包（权威声明缺失或指向文件缺失 → 安装错误）
      const assetsInfo = this.resolveAssetsPackage()
      if (!assetsInfo) {
        return { success: false, error: '安装包缺少内核资产包，请重新下载安装包。' }
      }
      const assetsPackage = path.join(this.portableKernelAssetsDir, assetsInfo.file)

      // 3.1 内容比对：未安装或 buildId 与内置包不一致 → 就地替换源码
      const kernelExists = fs.existsSync(path.join(this.kernelDir, 'pyproject.toml'))
      const installedFingerprint = this.readInstalledFingerprint()
      const needReplace = !kernelExists || this.needKernelReplace(assetsInfo, installedFingerprint)

      if (needReplace) {
        this.setOperation(
          'installing',
          kernelExists ? '正在升级内核（保留依赖环境）...' : '正在解压内核资源包...'
        )
        this.state.progress = 0
        this.notifyState()
        log.info(
          `[KernelManager] 内核自举开始: 已装版本=${installedFingerprint?.version ?? '无'} ` +
            `内置版本=${assetsInfo.version} 构建标识=${assetsInfo.buildId} 就地替换=${kernelExists && needReplace}`
        )

        if (kernelExists) {
          // 就地升级：保留依赖环境、模型数据和用户配置。
          await this.replaceKernelKeepingData(assetsPackage, (ratio) => {
            this.state.progress = Math.round(ratio * 90)
            this.notifyState()
          })
        } else {
          // 全新安装：将内核资产包解压到 kernelDir 根目录。
          await this.extractBundlePackage(assetsPackage, this.kernelDir, '', (ratio) => {
            this.state.progress = Math.round(ratio * 60)
            this.notifyState()
          })
        }

        this.state.progress = 90
        this.notifyState()
        log.info(`[KernelManager] 内核资源就绪，来源: ${assetsInfo.file}`)
      } else {
        // 已安装内核与内置资产包完全一致（version + buildId 相同），无需替换源码
        log.info(
          `[KernelManager] 内核已是最新: v${installedFingerprint?.version ?? '未知'}` +
            ` (buildId=${installedFingerprint?.buildId ?? '未知'})`
        )
      }

      // 刷新内核版本号（setupKernelEnvironment 依赖 currentVersion）
      this.state.currentVersion = this.readInstalledFingerprint()?.version ?? null
      if (this.state.currentVersion) {
        this.notifyState()
      }

      // 4. 无论虚拟环境是否就绪，启动前都运行 uv sync 对齐依赖：
      //    覆盖安装 / 升级可能替换源码或 wheels 缓存，必须重新同步 .venv
      //    （内置 wheels 存在时走 --find-links 离线安装，避免回退 PyPI）
      log.info('[KernelManager] 启动前执行 uv sync 对齐依赖')
      const setup = await this.setupKernelEnvironment()
      if (!setup.success) return setup

      return { success: true }
    } catch (error) {
      const msg = (error as Error).message
      this.setOperation('error', `初始化失败: ${msg}`)
      return { success: false, error: msg }
    }
  }

  /**
   * 解析安装包内置内核资产包（moechat-assets-*.zip）。
   * 以 kernel-assets/manifest.json 权威声明为准，声明缺失或文件缺失返回 null（由调用方判定安装错误）。
   */
  private resolveAssetsPackage(): AssetBundleInfo | null {
    const declaration = this.readKernelAssetsDeclaration()
    if (!declaration?.assets) return null
    const assets = declaration.assets
    const assetsDir = this.portableKernelAssetsDir
    const filePath = path.join(assetsDir, assets.file)
    if (!fs.existsSync(filePath)) {
      log.error(`[KernelManager] 权威声明指向的资产包缺失: ${assets.file}`)
      return null
    }
    return {
      file: assets.file,
      version: assets.version,
      buildId: assets.build_id
    }
  }

  /**
   * 读取安装包内置 kernel-assets/manifest.json 权威声明（由构建脚本打包时生成）。
   */
  private readKernelAssetsDeclaration(): KernelAssetsDeclaration | null {
    const manifestPath = path.join(this.portableKernelAssetsDir, MANIFEST_FILE_NAME)
    if (!fs.existsSync(manifestPath)) return null
    try {
      // 去除 UTF-8 BOM（构建脚本以 PowerShell 生成，可能带 BOM 导致 JSON.parse 失败）
      const content = fs.readFileSync(manifestPath, 'utf8').replace(/^\uFEFF/, '')
      return JSON.parse(content) as KernelAssetsDeclaration
    } catch (error) {
      log.error('[KernelManager] 解析 kernel-assets/manifest.json 失败:', (error as Error).message)
      return null
    }
  }

  /**
   * 读取已安装内核的版本指纹（kernelDir/manifest.json，由资产包解压时保留），
   * 用于与内置资产包比对，判断是否需要替换源码（含同版本内容变更场景）。
   * @returns 已安装版本指纹；缺失或解析失败返回 null
   */
  private readInstalledFingerprint(): InstalledKernelFingerprint | null {
    const manifestPath = path.join(this.kernelDir, MANIFEST_FILE_NAME)
    if (!fs.existsSync(manifestPath)) return null
    try {
      // 去除 UTF-8 BOM（资产包内 manifest 与内置声明同源，可能带 BOM）
      const content = fs.readFileSync(manifestPath, 'utf8').replace(/^\uFEFF/, '')
      const manifest = JSON.parse(content)
      const version = manifest.version
      const buildId = manifest.build_id
      if (!version) return null
      return { version, buildId: buildId || '' }
    } catch (error) {
      log.warn('[KernelManager] 读取已安装内核指纹失败:', (error as Error).message)
      return null
    }
  }

  /**
   * 判断是否需要替换已安装内核源码。
   * 以 buildId（每次构建唯一，毫秒级时间戳）为指纹：未安装或 buildId 不一致
   * （版本升级、同版本内容变更均体现为 buildId 变化）→ 需要替换；完全一致则无需。
   * @param bundled 内置资产包信息
   * @param installed 已安装版本指纹
   */
  private needKernelReplace(
    bundled: AssetBundleInfo,
    installed: InstalledKernelFingerprint | null
  ): boolean {
    return !installed || installed.buildId !== bundled.buildId
  }

  /**
   * 就地升级内核：仅删除旧源码，保留 .venv（依赖环境）、wheels（依赖缓存）、data（模型）
   * 和 config.yaml（用户配置），新资产包直接解压覆盖。
   * @param assetsPackage 内置资产包绝对路径
   * @param onProgress 进度回调（解压阶段 0-1 比值）
   */
  private async replaceKernelKeepingData(
    assetsPackage: string,
    onProgress: (ratio: number) => void
  ): Promise<void> {
    // config.yaml 为用户配置文件，删除旧源码时一并保留，避免升级丢失个性化配置。
    const keepEntries = new Set<string>(['.venv', 'wheels', 'data', 'config.yaml'])

    // 1. 删除旧内核目录中除保留条目外的全部内容（旧源码、旧 assets、非保留的 wheels/data）
    if (fs.existsSync(this.kernelDir)) {
      for (const entry of fs.readdirSync(this.kernelDir)) {
        if (!keepEntries.has(entry)) {
          fs.rmSync(path.join(this.kernelDir, entry), { recursive: true, force: true })
        }
      }
    } else {
      fs.mkdirSync(this.kernelDir, { recursive: true })
    }

    try {
      // 2. 解压新的内核资产包到 kernelDir。
      await this.extractBundlePackage(assetsPackage, this.kernelDir, '', onProgress)
    } catch (error) {
      // 解压失败：保留目录未受影响，仅源码可能残留部分文件，交由下次自举重建
      log.error('[KernelManager] 就地升级解压失败:', (error as Error).message)
      throw error
    }
  }

  /**
   * 使用 Worker 线程解压内置 zip 到目标目录，实时上报进度（保留源 zip 供重复自举）。
   * @param zipPath zip 绝对路径
   * @param targetDir 解压目标目录（如 kernelDir）
   * @param subDir 子目录前缀（如 'data' 表示解压到 {targetDir}/data 下）
   * @param onProgress 进度回调（0-1 比值）
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
      this.setOperation('error', `环境安装失败: ${msg}`)
      return { success: false, error: msg }
    }
  }

  // ─── 依赖安装 ─────────────────────────────────────

  /**
   * 安装环境依赖：uv sync 下载全部依赖并实时上报进度。
   * 根据运行环境选择 CPU 或 CUDA extra；不使用 `uv run`，避免其隐式 sync 吞掉进度条输出。
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

      this.state.statusText = '正在检测 CUDA 运行环境...'
      this.notifyState()

      this.resolveSyncArgs()
        .then(({ args, accelerator }) => {
          this.state.statusText =
            accelerator === 'cuda'
              ? '已检测到 NVIDIA CUDA，将安装 GPU 加速依赖...'
              : '未检测到可用 CUDA，将安装 CPU 依赖...'
          this.notifyState()
          log.info(`[setup] uv ${args.join(' ')} (accelerator=${accelerator}, cwd: ${kernelDir})`)
          return this.runSyncWithProgress(kernelDir, uvExe, args, onProgress)
        })
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

  /** 根据 NVIDIA 驱动可用性选择后端声明的 CPU/CUDA 依赖 extra。 */
  private async resolveSyncArgs(): Promise<{
    args: string[]
    accelerator: 'cpu' | 'cuda'
  }> {
    const cpuArgs = ['sync', '--extra', 'cpu']
    try {
      const { stdout } = await execAsync(
        'nvidia-smi --query-gpu=name,driver_version --format=csv,noheader',
        { timeout: 5000, windowsHide: true }
      )
      if (!stdout.trim()) return { args: cpuArgs, accelerator: 'cpu' }

      const [gpuName, driverVersion] = stdout.trim().split(/\r?\n/, 1)[0].split(',')
      const driver = driverVersion?.trim() ?? '未知'
      // cu130 wheel 需要 R580+ 驱动。仅存在 nvidia-smi 不代表驱动能加载 CUDA 13，
      // 驱动过旧时走 CPU，避免下载数 GB 的 CUDA 依赖后才在模型启动阶段失败。
      const driverMajor = Number.parseInt(driver.split('.')[0], 10)
      if (!Number.isFinite(driverMajor) || driverMajor < 580) {
        log.info(`[setup] NVIDIA 驱动 ${driver} 不支持 CUDA 13，使用 CPU 依赖`)
        return { args: cpuArgs, accelerator: 'cpu' }
      }

      log.info(`[setup] 检测到 NVIDIA GPU: ${gpuName.trim()} (driver ${driver})`)
      return {
        args: [
          'sync',
          '--extra',
          'cuda',
          '--find-links',
          'https://mirrors.aliyun.com/pytorch-wheels/cu130'
        ],
        accelerator: 'cuda'
      }
    } catch {
      return { args: cpuArgs, accelerator: 'cpu' }
    }
  }

  /**
   * 通过伪终端（node-pty：Windows 用 ConPTY，macOS/Linux 用标准 PTY）执行 uv sync，
   * 使 uv 输出 ANSI 进度条动画。原始 ANSI 数据转发给前端 xterm 渲染，
   * 同时解析其中的百分比更新 UI 进度条。
   */
  private async runSyncWithProgress(
    kernelDir: string,
    uvExe: string,
    uvArgs: string[],
    onProgress: (p: number) => void
  ): Promise<void> {
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
        broadcastToAllWindows(CHANNELS.KERNEL_SERVICE_STREAM_EVENT, Buffer.from(data, 'utf-8'))
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

  /** 后端 PID 持久化文件路径（用于异常退出后下次启动时回收残留进程） */
  private get backendPidFile(): string {
    return path.join(this.kernelManager.kernelRoot, 'backend.pid')
  }

  /**
   * 校验指定 PID 对应的进程是否存活。
   * 使用 process.kill(pid, 0) 发送空信号探测，跨平台可用。
   * @param pid 进程 PID
   * @returns true 表示进程存在，false 表示已退出
   */
  private isProcessAlive(pid: number): boolean {
    try {
      process.kill(pid, 0)
      return true
    } catch (error) {
      // EPERM: 进程存在但无权限发送信号；ESRCH: 进程不存在
      return (error as NodeJS.ErrnoException).code === 'EPERM'
    }
  }

  /**
   * 校验指定 PID 是否为本应用启动的后端进程。
   * 通过命令行特征（main_web.py / uv run）识别，避免 PID 被系统复用后误杀其他进程。
   * @param pid 进程 PID
   * @returns true 表示确认为本应用后端进程
   */
  private async isOurBackendProcess(pid: number): Promise<boolean> {
    if (process.platform === 'win32') {
      // Windows：通过 WMI 查询命令行
      try {
        const { stdout } = await execAsync(
          `powershell -NoProfile -Command "(Get-CimInstance Win32_Process -Filter 'ProcessId=${pid}').CommandLine"`,
          { timeout: 5000 }
        )
        return stdout.includes('main_web')
      } catch {
        return false
      }
    }
    // Linux/macOS：读取 /proc/<pid>/cmdline（以空字符分隔，需替换后检索）
    try {
      const cmdline = fs.readFileSync(`/proc/${pid}/cmdline`, 'utf8').replace(/\0/g, ' ')
      return cmdline.includes('main_web')
    } catch {
      return false
    }
  }

  /**
   * 强制终止指定进程的整棵进程树。
   * - Windows：taskkill /T /F 递归终止
   * - Linux/macOS：先按进程组强杀（node-pty 以 setsid 启动，进程组号即 PID），
   *   再遍历 /proc 递归终止所有后代进程，兜底覆盖脱离进程组的场景
   * @param pid 根进程 PID
   */
  private async killProcessTree(pid: number): Promise<void> {
    if (process.platform === 'win32') {
      await execAsync(`taskkill /PID ${pid} /T /F`, { timeout: 5000 }).catch(() => {
        /* 进程可能已退出，忽略 */
      })
      return
    }
    // 先按进程组强杀（node-pty 的子进程组与 PID 相同）
    try {
      process.kill(-pid, 'SIGKILL')
    } catch {
      /* 进程组可能已不存在，继续走兜底 */
    }
    // 遍历 /proc 递归终止后代进程，覆盖 setpgid 脱离进程组的子进程
    await this.killDescendants(pid)
    // 最后直接终止目标进程（仅杀后代时目标可能仍存活）
    try {
      process.kill(pid, 'SIGKILL')
    } catch {
      /* 目标进程可能已退出 */
    }
  }

  /**
   * 遍历 /proc 构建父子进程映射，按广度优先递归终止指定进程的所有后代。
   * 仅在 Linux 平台生效；读取失败时静默跳过。
   * @param rootPid 根进程 PID
   */
  private async killDescendants(rootPid: number): Promise<void> {
    if (process.platform !== 'linux') return
    const childrenOf = new Map<number, number[]>()
    let dirs: string[]
    try {
      dirs = fs.readdirSync('/proc')
    } catch {
      return
    }
    // 一次性读取 /proc 全部进程的父进程关系，避免多次 IO
    for (const name of dirs) {
      if (!/^\d+$/.test(name)) continue
      try {
        const stat = fs.readFileSync(`/proc/${name}/stat`, 'utf8')
        const closeParen = stat.lastIndexOf(')')
        const fields = stat
          .slice(closeParen + 1)
          .trim()
          .split(/\s+/)
        const ppid = parseInt(fields[1], 10)
        if (Number.isInteger(ppid) && ppid > 0) {
          const list = childrenOf.get(ppid) ?? []
          list.push(parseInt(name, 10))
          childrenOf.set(ppid, list)
        }
      } catch {
        /* 进程可能已退出，跳过 */
      }
    }
    // 广度优先遍历后代并逐个强杀
    const queue = [rootPid]
    const seen = new Set<number>()
    while (queue.length > 0) {
      const current = queue.shift()!
      if (seen.has(current)) continue
      seen.add(current)
      for (const child of childrenOf.get(current) ?? []) {
        try {
          process.kill(child, 'SIGKILL')
        } catch {
          /* 子进程已退出 */
        }
        queue.push(child)
      }
    }
  }

  /**
   * 回收上次异常退出遗留的孤儿后端进程。
   * 读取持久化 PID 文件，校验进程存活且确认为本应用后端后，按进程树强制终止并清理文件。
   * 该方法是幂等的：无 PID 文件或进程已退出时直接返回。
   */
  async reapStaleBackend(): Promise<void> {
    const pidFile = this.backendPidFile
    let stalePid = -1
    try {
      stalePid = parseInt(fs.readFileSync(pidFile, 'utf8').trim(), 10)
    } catch {
      // 无 PID 文件或内容无效，无需回收
      return
    }
    if (!Number.isInteger(stalePid) || stalePid <= 0) {
      fs.rmSync(pidFile, { force: true })
      return
    }
    if (!this.isProcessAlive(stalePid)) {
      fs.rmSync(pidFile, { force: true })
      return
    }
    // 校验进程身份，避免 PID 复用后误杀无关进程
    const isOurs = await this.isOurBackendProcess(stalePid)
    if (!isOurs) {
      log.warn(`[KernelManager] PID 文件中的进程 (${stalePid}) 非本应用后端，跳过回收`)
      fs.rmSync(pidFile, { force: true })
      return
    }
    log.info(`[KernelManager] 检测到上次异常退出遗留的后端进程 (PID: ${stalePid})，正在强制回收...`)
    this.addSystemLog(
      `[系统] 检测到上次异常退出的残留后端进程 (PID: ${stalePid})，正在强制清理...\r\n`
    )
    await this.killProcessTree(stalePid)
    fs.rmSync(pidFile, { force: true })
    this.addSystemLog('[系统] 残留后端进程已清理，端口已释放\r\n')
  }

  /** 原始数据流广播，发送原始二进制数据给渲染进程 */
  private broadcastStream(data: Buffer): void {
    broadcastToAllWindows(CHANNELS.KERNEL_SERVICE_STREAM_EVENT, data)
  }

  public kernelManager: KernelManager

  private constructor() {
    this.kernelManager = KernelManager.getInstance()
    // 启动时先回收上次异常退出遗留的孤儿后端进程，避免进程残留与端口占用
    void this.reapStaleBackend()
    // 确保应用退出时正确关闭后端服务
    app.on('before-quit', async () => {
      await this.stopBackend()
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
    windowRegistry.broadcast(CHANNELS.KERNEL_SERVICE_STATE_EVENT, {
      running: this.backendRunning,
      pid: this.backendPid,
      logs: [...this.backendLogs]
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
   * 使用内核虚拟环境（.venv）中的 Python 直接启动 main_web.py，
   * 绕开 uv run 包装层，保证 PID 即服务进程本身，终止更可靠；
   * 依赖同步仍由 uv sync 在启动前完成
   */
  async startBackend(): Promise<{ success: boolean; error?: string }> {
    if (this.backendRunning) {
      return { success: true }
    }

    // 启动前先回收上次异常退出遗留的孤儿进程，确保端口（如 8001）不被残留服务占用
    await this.reapStaleBackend()

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

    log.info(`[KernelManager] 启动后端服务: ${pythonPath} ${scriptPath} (cwd: ${kernelPath})`)
    this.addSystemLog(`[系统] 正在启动内核后端服务...\r\n`)
    this.addSystemLog(`[系统] ${pythonPath} ${scriptPath}\r\n`)
    this.addSystemLog(`[系统] 工作目录: ${kernelPath}\r\n`)

    try {
      // 依赖由 bootstrapKernel/setupKernelEnvironment 统一完成，避免每次启动重复执行 uv sync。
      // 直接运行 venv Python（绕开 uv run），使 backendPid 即服务进程本身，终止更可靠。
      const backendTerm = pty.spawn(pythonPath, [scriptPath], {
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

      // 持久化后端 PID，供异常退出后下次启动时回收残留进程
      try {
        fs.writeFileSync(this.backendPidFile, String(this.backendPid), 'utf8')
      } catch (error) {
        log.warn('[KernelManager] 持久化后端 PID 失败:', (error as Error).message)
      }

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
        // 进程自然退出后清理持久化 PID 文件，避免残留失效记录
        fs.rmSync(this.backendPidFile, { force: true })
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
      await this.killProcessTree(pid)
    }

    // 清理持久化 PID 文件
    fs.rmSync(this.backendPidFile, { force: true })

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
