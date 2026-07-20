import { shell, dialog } from 'electron'
import { CHANNELS } from '@shared/ipc/channels'
import { registerHandle } from '../utils/registerIpcHandler'
import { KernelManager, KernelServiceManager } from '../services/kernelManager'
import log from '../utils/logger'
import { resolveLogDir } from '../utils/pathResolve'
import { request } from '@shared/api/request'

const kernelManager = KernelManager.getInstance()
const kernelServiceManager = KernelServiceManager.getInstance()

/**
 * 设置内核管理 IPC 通道
 */
function setupKernelIPC(): void {
  // ─── 状态查询 ────────────────────────────────────

  /** 获取内核完整状态 */
  registerHandle(CHANNELS.KERNEL_GET_STATE, () => {
    return kernelManager.getState()
  })

  // ─── 更新操作 ────────────────────────────────────

  /** 检查内核更新 */
  registerHandle(CHANNELS.KERNEL_CHECK_UPDATE, async () => {
    try {
      const state = await kernelManager.checkForUpdates()
      return { success: true, data: state }
    } catch (error) {
      const msg = (error as Error).message
      log.error('内核更新检查失败:', msg)
      return { success: false, error: msg }
    }
  })

  /** 更新到最新版本内核（从 GitHub Releases 下载，保留用户数据） */
  registerHandle(CHANNELS.KERNEL_UPDATE_TO_LATEST, async () => {
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
  registerHandle(CHANNELS.KERNEL_CHECK_ENVIRONMENT, async () => {
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
  registerHandle(CHANNELS.KERNEL_SETUP_ENVIRONMENT, async () => {
    try {
      const result = await kernelManager.setupKernelEnvironment()
      return result
    } catch (error) {
      const msg = (error as Error).message
      log.error('环境安装失败:', msg)
      return { success: false, error: msg }
    }
  })

  /** 获取操作流日志（uv sync 等） */
  registerHandle(CHANNELS.KERNEL_GET_OPERATION_LOGS, () => {
    try {
      const logs = kernelManager.getOperationLogs()
      return logs
    } catch (error) {
      const msg = (error as Error).message
      log.error('获取操作流日志失败:', msg)
      return []
    }
  })

  // ─── 后端服务管理 ─────────────────────────────────

  /** 启动后端服务 */
  registerHandle(CHANNELS.KERNEL_START_BACKEND, async () => {
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
  registerHandle(CHANNELS.KERNEL_STOP_BACKEND, async () => {
    try {
      const result = await kernelServiceManager.stopBackend()
      return result
    } catch (error) {
      const msg = (error as Error).message
      log.error('停止后端服务失败:', msg)
      return { success: false, error: msg }
    }
  })

  /** 重启后端服务 */
  registerHandle(CHANNELS.KERNEL_RESTART_BACKEND, async () => {
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
  registerHandle(CHANNELS.KERNEL_GET_BACKEND_STATUS, () => {
    return kernelServiceManager.getBackendStatus()
  })

  /** 获取后端服务日志*/
  registerHandle(CHANNELS.KERNEL_GET_BACKEND_LOGS, () => {
    const logs = kernelServiceManager.getBackendLogs()
    return logs
  })

  // ─── 状态重置 ────────────────────────────────────

  /** 重置内核状态到默认（idle） */
  registerHandle(CHANNELS.KERNEL_RESET_STATE, () => {
    kernelManager.resetState()
    return { success: true }
  })

  /** 检查后端健康状态 */
  registerHandle(CHANNELS.KERNEL_CHECK_BACKEND_HEALTH, async () => {
    try {
      const result = await kernelServiceManager.checkBackendHealth()
      return { success: true, ...result }
    } catch (error) {
      const msg = (error as Error).message
      return { success: false, healthy: false, error: msg }
    }
  })

  /** 打开日志存储目录 */
  registerHandle(CHANNELS.KERNEL_OPEN_LOG_DIR, async () => {
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
  registerHandle(CHANNELS.KERNEL_CHECK_API_HEALTH, async () => {
    try {
      const healthy = await request
        .get('/api/health', { signal: AbortSignal.timeout(5000) })
        .then((res) => res.status === 200)
        .catch(() => false)

      return { success: true, healthy }
    } catch (error) {
      const msg = (error as Error).message
      log.error('API健康检查失败:', msg)
      return { success: false, healthy: false, error: msg }
    }
  })

  // ─── 资源管理 ────────────────────────────────────

  /** 导入资源包（用户选择 zip 文件后调用） */
  registerHandle(CHANNELS.KERNEL_IMPORT_ASSETS, async () => {
    try {
      const result = await dialog.showOpenDialog({
        title: '选择资源包',
        filters: [{ name: '资源包', extensions: ['zip'] }],
        properties: ['openFile']
      })

      if (result.canceled || result.filePaths.length === 0) {
        return { success: false, error: '用户取消了选择' }
      }

      const zipPath = result.filePaths[0]
      const importResult = await kernelManager.importAssetBundle(zipPath)
      return importResult
    } catch (error) {
      const msg = (error as Error).message
      log.error('导入资源包失败:', msg)
      return { success: false, error: msg }
    }
  })

  /** 检查资源完整性 */
  registerHandle(CHANNELS.KERNEL_CHECK_RESOURCES, async () => {
    try {
      const result = await kernelManager.checkResources()
      return { success: true, data: result }
    } catch (error) {
      const msg = (error as Error).message
      log.error('检查资源完整性失败:', msg)
      return { success: false, error: msg }
    }
  })

  /** 检查数据资源完整性（models + agents） */
  registerHandle(CHANNELS.KERNEL_CHECK_DATA_RESOURCES, async () => {
    try {
      const result = await kernelManager.checkDataResources()
      return { success: true, data: result }
    } catch (error) {
      const msg = (error as Error).message
      log.error('检查数据资源完整性失败:', msg)
      return { success: false, error: msg }
    }
  })

  /** 导入数据资源包（用户选择 zip 文件后调用） */
  registerHandle(CHANNELS.KERNEL_IMPORT_DATA_ASSETS, async () => {
    try {
      const result = await dialog.showOpenDialog({
        title: '选择数据资源包',
        filters: [{ name: '数据资源包', extensions: ['zip'] }],
        properties: ['openFile']
      })

      if (result.canceled || result.filePaths.length === 0) {
        return { success: false, error: '用户取消了选择' }
      }

      const zipPath = result.filePaths[0]
      const importResult = await kernelManager.importDataBundle(zipPath)
      return importResult
    } catch (error) {
      const msg = (error as Error).message
      log.error('导入数据资源包失败:', msg)
      return { success: false, error: msg }
    }
  })
}

export default setupKernelIPC
