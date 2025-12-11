import { getConfig } from '../config/configManager'
import { createAssistantWindow } from '../windows/assistantWindow'
import log from '../utils/logger'
import { AssistantService } from '../services/assistantService'

// 初始化助手服务
const assistantService = AssistantService.getInstance()

async function startAutoService(): Promise<void> {
  // 预加载助手数据
  await assistantService.loadAssistants().catch((error) => {
    log.error('预加载助手数据失败:', error)
  })
  // 检查是否启用桌宠
  if (getConfig('assistantEnabled')) {
    createAssistantWindow()
  }
}

export { startAutoService }
