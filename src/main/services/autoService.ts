import { getConfig } from '../config/configManager'
import {
  createWindow,
  assistantWindowConfig,
  chatBoxWindowConfig,
  createMultiInstanceWindow,
  widgetWindowConfig,
  createWidgetOptions
} from '../windows'
import log from '../utils/logger'
import { AssistantService } from '../services/assistantService'
import { KernelManager, KernelServiceManager } from '../services/kernelManager'
import { OnboardingStoreService } from '../services/onboardingStore'
import { WidgetService } from '../services/widgetService'
import { boundsStore } from '../services/boundsStore'
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
      // 创建小组件选项，不传入位置，让 createWindow 从 boundsStore 恢复
      const options = createWidgetOptions(
        instance.id,
        instance.widgetId,
        undefined, // 不传入位置，让 boundsStore 恢复
        instance.size
      )

      // 构建 overrides，只包含有值的属性
      const overrides: Partial<Electron.BrowserWindowConstructorOptions> = {
        width: options.overrides?.width,
        height: options.overrides?.height
      }

      // 如果 boundsStore 中没有保存的位置，使用配置中的默认位置
      const boundsKey = `widgetWindowBounds:${instance.id}`
      const hasSavedBounds = boundsStore.get(boundsKey)
      if (!hasSavedBounds) {
        overrides.x = instance.position.x
        overrides.y = instance.position.y
      }

      await createMultiInstanceWindow(
        widgetWindowConfig,
        instance.id,
        options.query as Record<string, string>,
        overrides
      )
      log.info(`[autoService] 已创建小组件窗口: ${instance.widgetId} (${instance.id})`)
    }
  } catch (error) {
    log.error('[autoService] 创建小组件窗口失败:', error)
  }
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
