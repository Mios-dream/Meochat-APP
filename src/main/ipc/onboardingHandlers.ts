import { ipcMain } from 'electron'
import { OnboardingMode, OnboardingProfile } from '../../renderer/src/types/onboarding'
import { OnboardingStoreService } from '../services/onboardingStore'

const onboardingStore = OnboardingStoreService.getInstance()

/**
 * 设置新手引导IPC
 */
export function setupOnboardingIPC(): void {
  ipcMain.handle('onboarding:get-state', async () => {
    return onboardingStore.getState()
  })

  ipcMain.handle('onboarding:set-mode', async (_event, mode: OnboardingMode) => {
    return onboardingStore.setMode(mode)
  })

  ipcMain.handle('onboarding:save-profile', async (_event, profile: OnboardingProfile) => {
    return onboardingStore.saveProfile(profile)
  })

  ipcMain.handle('onboarding:mark-completed', async () => {
    return onboardingStore.markCompleted()
  })

  ipcMain.handle('onboarding:reset', async () => {
    return onboardingStore.reset()
  })
}
