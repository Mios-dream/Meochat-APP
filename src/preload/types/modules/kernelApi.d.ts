import type {
  KernelUpdateState,
  EnvironmentCheckResult,
  KernelLogEntry
} from '../../../renderer/src/types/KernelInfo'

export interface KernelApi {
  kernel: {
    /** 获取内核完整状态 */
    getState: () => Promise<KernelUpdateState>
    /** 获取当前内核版本 */
    getCurrentVersion: () => Promise<string | null>
    /** 获取当前激活内核的路径 */
    getActivePath: () => Promise<string | null>
    /** 获取当前激活内核的 Python 配置（workDir, venvPython, scriptPath） */
    getPythonConfig: () => Promise<
      | { success: true; data: { workDir: string; venvPython: string; scriptPath: string } }
      | { success: false; error: string }
    >
    /** 检查内核更新 */
    checkUpdate: () => Promise<{ success: boolean; data?: KernelUpdateState; error?: string }>
    /** 更新到最新版本（下载、解压、安装依赖，自动保留用户数据） */
    updateToLatest: () => Promise<{ success: boolean; error?: string }>
    /** 监听内核状态变化 */
    onStateUpdate: (callback: (state: KernelUpdateState) => void) => () => void
    /** 监听需要重启服务的通知 */
    onNeedRestart: (callback: (data: { version: string }) => void) => () => void
    /** 重置内核状态到默认（idle），更新完成后调用 */
    resetState: () => Promise<{ success: boolean }>
    /** 检查内核运行环境（Python, uv, venv, 磁盘空间） */
    checkEnvironment: () => Promise<{
      success: boolean
      data?: EnvironmentCheckResult
      error?: string
    }>
    /** 设置内核运行环境（运行 uv sync 安装依赖） */
    setupEnvironment: () => Promise<{ success: boolean; error?: string }>
    /** 下载 AI 模型（embedding, ASR 等），首次安装后调用 */
    downloadModels: () => Promise<{ success: boolean; error?: string }>
    /** 获取内核操作日志 */
    getLogs: () => Promise<{ success: boolean; data?: KernelLogEntry[]; error?: string }>
    /** 启动后端服务 */
    startBackend: () => Promise<{ success: boolean; error?: string }>
    /** 停止后端服务 */
    stopBackend: () => Promise<{ success: boolean }>
    /** 重启后端服务 */
    restartBackend: () => Promise<{ success: boolean; error?: string }>
    /** 获取后端服务状态 */
    getBackendStatus: () => Promise<{ running: boolean; pid: number; logs: string[] }>
    /** 获取后端服务日志 */
    getBackendLogs: () => Promise<string[]>
    /** 检查后端健康状态 */
    checkBackendHealth: () => Promise<{ success: boolean; healthy: boolean; error?: string }>
    /** 监听后端服务状态变化 */
    onServiceState: (
      callback: (state: { running: boolean; pid: number; logs: string[] }) => void
    ) => () => void
  }
}
