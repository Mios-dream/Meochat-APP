import { getConfig } from '../config/configManager'
import { createWindow, assistantWindowConfig, chatBoxWindowConfig } from '../windows'
import { widgetWindowService } from './widgetWindowService'
import log from '../utils/logger'
import { AssistantService } from '@/services/assistant/assistantService'
import { KernelManager, KernelServiceManager } from '../services/kernelManager'
import { OnboardingStoreService } from '../services/onboardingStore'
import { WidgetService } from '../services/widgetService'
import { globalShortcut } from 'electron'

const assistantService = AssistantService.getInstance()
const kernelManager = KernelManager.getInstance()
const kernelServiceManager = KernelServiceManager.getInstance()
const onboardingStore = OnboardingStoreService.getInstance()
const widgetService = WidgetService.getInstance()

async function startAutoService(): Promise<void> {
  // 首次运行尚未完成引导流程，跳过自启 —— 引导流程中会自行完成内核安装与助手加载
  if (!onboardingStore.getState().completed) {
    log.info('[autoService] 引导未完成，跳过自启服务')
    return
  }
  // 预加载助手数据
  await assistantService.loadAssistants().catch((error) => {
    log.error('预加载助手数据失败:', error)
  })
  // 检查是否启用桌宠
  if (getConfig('assistantEnabled')) {
    createWindow(assistantWindowConfig, { showImmediately: true })
  }

  autoRegisterChatShortcut()

  await autoCreateWidget()

  // 自动启动内核后端服务
  if (getConfig('kernelMode') === 'local') {
    await ensureKernelBackendStarted()
  }
}

function autoRegisterChatShortcut(): void {
  // 注册快捷回复的快捷键
  const chatShortcut = getConfig('chatShortcut')
  globalShortcut.register(chatShortcut, () => {
    createWindow(chatBoxWindowConfig)
  })
}

async function autoCreateWidget(): Promise<void> {
  // 自动创建已启用的小组件窗口
  try {
    const widgetInstances = widgetService.getAllInstances()
    const enabledInstances = widgetInstances.filter((instance) => instance.enabled)
    log.info(`[autoService] 发现 ${enabledInstances.length} 个已启用的小组件`)

    for (const instance of enabledInstances) {
      // 通过宿主窗口 window.open 创建，多个小组件共享同一渲染进程；
      // 位置/尺寸解析由 widgetWindowService 内部完成（优先 boundsStore 恢复）
      await widgetWindowService.createWidgetWindow(instance)
      log.info(`[autoService] 已创建小组件窗口: ${instance.widgetId} (${instance.id})`)
    }
  } catch (error) {
    log.error('[autoService] 创建小组件窗口失败:', error)
  }
}

/**
 * 确保内核后端服务已启动
 * 启动后端前先执行内核自举（bootstrapKernel）：比对安装包内置资产包与已装内核的
 * build_id，不一致（覆盖安装 / 升级 / 同版本内容变更）时就地替换后端源码，保证
 * appData 中运行的是与当前安装包一致的代码。自举幂等：build_id 一致或虚拟环境
 * 已就绪时开销极小；后端已在运行时跳过，避免打断正在运行的服务。
 * 若自举失败（资产包缺失 / 解压异常），停止启动，避免用残留或不完整的源码拉起后端。
 */
async function ensureKernelBackendStarted(): Promise<void> {
  const status = kernelServiceManager.getBackendStatus()
  if (status.running) {
    log.info('[autoService] 内核后端服务已在运行')
    return
  }

  // 启动前自举校验：幂等，仅在内置资产包与已装内核不一致时解压替换源码
  log.info('[autoService] 启动前检查内核更新（自举）...')
  const bootstrapResult = await kernelManager.bootstrapKernel()
  if (!bootstrapResult.success) {
    log.error(`[autoService] 内核自举失败，跳过自动启动后端服务: ${bootstrapResult.error}`)
    return
  }

  const currentVersion = kernelManager.getCurrentVersion()
  if (!currentVersion) {
    log.info('[autoService] 未安装内核，跳过自动启动后端服务')
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
