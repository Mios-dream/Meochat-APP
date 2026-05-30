import { ipcMain, shell } from 'electron'
import { KernelManager, KernelServiceManager } from '../services/kernelManager'
import log from '../utils/logger'
import pathLib from 'path'
import { resolveLogDir } from '../utils/pathResolve'
import { getConfig } from '../config/configManager'

const kernelManager = KernelManager.getInstance()
const kernelServiceManager = KernelServiceManager.getInstance()

/**
 * 设置内核管理 IPC 通道
 */
function setupKernelIPC(): void {
  // ─── 状态查询 ────────────────────────────────────

  /** 获取内核完整状态 */
  ipcMain.handle('kernel:get-state', () => {
    return kernelManager.getState()
  })

  /** 获取当前内核版本 */
  ipcMain.handle('kernel:get-current-version', () => {
    return kernelManager.getCurrentVersion()
  })

  /** 获取当前激活内核的路径 */
  ipcMain.handle('kernel:get-active-path', async () => {
    return kernelManager.getActiveKernelPath()
  })

  /** 获取当前激活内核的 Python 配置（venv路径、工作目录等） */
  ipcMain.handle('kernel:get-python-config', async () => {
    const kernelPath = await kernelManager.getActiveKernelPath()
    if (!kernelPath) {
      return { success: false, error: '没有激活的内核' }
    }

    const isWin = process.platform === 'win32'
    const venvPython = isWin
      ? pathLib.join(kernelPath, '.venv', 'Scripts', 'python.exe')
      : pathLib.join(kernelPath, '.venv', 'bin', 'python')

    return {
      success: true,
      data: {
        workDir: kernelPath,
        venvPython,
        scriptPath: 'main_web.py'
      }
    }
  })

  // ─── 更新操作 ────────────────────────────────────

  /** 检查内核更新 */
  ipcMain.handle('kernel:check-update', async () => {
    try {
      const state = await kernelManager.checkForUpdates()
      return { success: true, data: state }
    } catch (error) {
      const msg = (error as Error).message
      log.error('内核更新检查失败:', msg)
      return { success: false, error: msg }
    }
  })

  /** 更新到最新版本内核（下载、解压、安装依赖，保留数据） */
  ipcMain.handle('kernel:update-to-latest', async () => {
    try {
      const success = await kernelManager.downloadAndInstall()
      return { success }
    } catch (error) {
      const msg = (error as Error).message
      log.error('内核更新失败:', msg)
      return { success: false, error: msg }
    }
  })

  // ─── 环境检查 ────────────────────────────────────

  /** 检查内核运行环境 */
  ipcMain.handle('kernel:check-environment', async () => {
    try {
      const result = await kernelManager.checkEnvironment()
      return { success: true, data: result }
    } catch (error) {
      const msg = (error as Error).message
      log.error('环境检查失败:', msg)
      return { success: false, error: msg }
    }
  })

  /** 设置内核运行环境（运行 uv sync） */
  ipcMain.handle('kernel:setup-environment', async () => {
    try {
      const result = await kernelManager.setupKernelEnvironment()
      return result
    } catch (error) {
      const msg = (error as Error).message
      log.error('环境安装失败:', msg)
      return { success: false, error: msg }
    }
  })

  /** 下载 AI 模型（运行 download.py） */
  ipcMain.handle('kernel:download-models', async () => {
    try {
      const result = await kernelManager.downloadModels()
      return result
    } catch (error) {
      const msg = (error as Error).message
      log.error('模型下载失败:', msg)
      return { success: false, error: msg }
    }
  })

  /** 获取操作日志 */
  ipcMain.handle('kernel:get-logs', () => {
    try {
      const logs = kernelManager.getOperationLogs()
      return { success: true, data: logs }
    } catch (error) {
      const msg = (error as Error).message
      return { success: false, error: msg }
    }
  })

  /** 获取操作流日志（uv sync、模型下载等） */
  ipcMain.handle('kernel:get-stream-logs', () => {
    try {
      const logs = kernelManager.getStreamLogs()
      return logs
    } catch (error) {
      const msg = (error as Error).message
      log.error('获取操作流日志失败:', msg)
      return []
    }
  })

  // ─── 事件监听（供渲染进程注册） ─────────────────

  /** 注册内核状态监听 */
  ipcMain.handle('kernel:listen-state', (event) => {
    const state = kernelManager.getState()
    event.sender.send('kernel:state-update', state)
    return { success: true }
  })

  /** 注册内核日志监听（接收主进程 logger 输出的日志） */
  ipcMain.handle('kernel:listen-logs', () => {
    return { success: true }
  })

  // ─── 后端服务管理 ─────────────────────────────────

  /** 启动后端服务 */
  ipcMain.handle('kernel:start-backend', async () => {
    try {
      const result = await kernelServiceManager.startBackend()
      return result
    } catch (error) {
      const msg = (error as Error).message
      log.error('启动后端服务失败:', msg)
      return { success: false, error: msg }
    }
  })

  /** 停止后端服务 */
  ipcMain.handle('kernel:stop-backend', () => {
    try {
      const result = kernelServiceManager.stopBackend()
      return result
    } catch (error) {
      const msg = (error as Error).message
      log.error('停止后端服务失败:', msg)
      return { success: false, error: msg }
    }
  })

  /** 重启后端服务 */
  ipcMain.handle('kernel:restart-backend', async () => {
    try {
      const result = await kernelServiceManager.restartBackend()
      return result
    } catch (error) {
      const msg = (error as Error).message
      log.error('重启后端服务失败:', msg)
      return { success: false, error: msg }
    }
  })

  /** 获取后端服务状态 */
  ipcMain.handle('kernel:get-backend-status', () => {
    return kernelServiceManager.getBackendStatus()
  })

  /** 获取后端服务日志 */
  ipcMain.handle('kernel:get-backend-logs', () => {
    const logs = kernelServiceManager.getBackendLogs()
    console.log(`[IPC] kernel:get-backend-logs 返回 ${logs.length} 条日志`)
    return logs
  })

  // ─── 状态重置 ────────────────────────────────────

  /** 重置内核状态到默认（idle） */
  ipcMain.handle('kernel:reset-state', () => {
    kernelManager.resetState()
    return { success: true }
  })

  /** 检查后端健康状态 */
  ipcMain.handle('kernel:check-backend-health', async () => {
    try {
      const result = await kernelServiceManager.checkBackendHealth()
      return { success: true, ...result }
    } catch (error) {
      const msg = (error as Error).message
      return { success: false, healthy: false, error: msg }
    }
  })

  /** 打开日志存储目录 */
  ipcMain.handle('kernel:open-log-dir', async () => {
    try {
      const logDir = resolveLogDir()
      const err = await shell.openPath(logDir)
      if (err) {
        return { success: false, error: err }
      }
      return { success: true }
    } catch (error) {
      const msg = (error as Error).message
      return { success: false, error: msg }
    }
  })

  /** 检查API健康状态（用于API模式） */
  ipcMain.handle('kernel:check-api-health', async () => {
    try {
      // TODO: 从配置中读取API地址，目前使用默认地址
      const baseUrl = getConfig('baseUrl') || 'http://127.0.0.1:8001'
      const apiUrl = `${baseUrl}/api/health`

      console.log(`[IPC] 检查API健康状态，URL: ${apiUrl}`)

      const healthy = await fetch(apiUrl, {
        signal: AbortSignal.timeout(5000)
      })
        .then((res) => res.ok)
        .catch(() => false)

      return { success: true, healthy }
    } catch (error) {
      const msg = (error as Error).message
      log.error('API健康检查失败:', msg)
      return { success: false, healthy: false, error: msg }
    }
  })
}

export default setupKernelIPC
