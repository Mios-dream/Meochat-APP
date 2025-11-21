import { getConfig } from '../config/configManager'
import { createAssistantWindow } from '../windows/assistantWindow'

function startAutoService(): void {
  if (getConfig('assistantEnabled')) {
    createAssistantWindow()
  }
}

export { startAutoService }
