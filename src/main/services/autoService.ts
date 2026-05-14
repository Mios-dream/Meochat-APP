import { getConfig } from '../config/configManager'
import { createAssistantWindow } from '../windows/assistantWindow'
import log from '../utils/logger'
import { AssistantService } from '../services/assistantService'
import { KernelManager, KernelServiceManager } from '../services/kernelManager'

const assistantService = AssistantService.getInstance()
const kernelManager = KernelManager.getInstance()
const kernelServiceManager = KernelServiceManager.getInstance()

async function startAutoService(): Promise<void> {
  // 预加载助手数据
  await assistantService.loadAssistants().catch((error) => {
    log.error('预加载助手数据失败:', error)
  })
  // 检查是否启用桌宠
  if (getConfig('assistantEnabled')) {
    createAssistantWindow()
  }
  // 自动启动内核后端服务
  await ensureKernelBackendStarted()
}

/**
 * 确保内核后端服务已启动
 * 如果内核已安装且有虚拟环境，自动启动后端服务
 */
async function ensureKernelBackendStarted(): Promise<void> {
  const currentVersion = kernelManager.getCurrentVersion()
  if (!currentVersion) {
    log.info('[autoService] 未安装内核，跳过自动启动后端服务')
    return
  }

  const status = kernelServiceManager.getBackendStatus()
  if (status.running) {
    log.info('[autoService] 内核后端服务已在运行')
    return
  }

  log.info('[autoService] 正在自动启动内核后端服务...')
  const result = await kernelServiceManager.startBackend()
  if (result.success) {
    log.info('[autoService] 内核后端服务启动成功')
  } else {
    log.error(`[autoService] 内核后端服务启动失败: ${result.error}`)
  }
}

export { startAutoService, ensureKernelBackendStarted }
