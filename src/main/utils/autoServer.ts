import { getConfig } from '../config/configManager'
import { createAssistantWindow } from '../windows/assistantWindow'

function startAutoServer(): void {
  if (getConfig('assistantEnabled')) {
    createAssistantWindow()
  }
}

export { startAutoServer }
