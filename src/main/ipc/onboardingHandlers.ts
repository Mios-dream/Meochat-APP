import { CHANNELS } from '@shared/ipc/channels'
import { registerHandle } from '../utils/registerIpcHandler'
import { OnboardingProfile } from '@shared/types/onboarding'
import { OnboardingStoreService } from '../services/onboardingStore'

const onboardingStore = OnboardingStoreService.getInstance()

/**
 * 设置新手引导IPC
 */
export function setupOnboardingIPC(): void {
  registerHandle(CHANNELS.ONBOARDING_GET_STATE, async () => {
    return onboardingStore.getState()
  })

  registerHandle(CHANNELS.ONBOARDING_SAVE_PROFILE, async (_event, profile: OnboardingProfile) => {
    return onboardingStore.saveProfile(profile)
  })

  registerHandle(CHANNELS.ONBOARDING_MARK_COMPLETED, async () => {
    return onboardingStore.markCompleted()
  })

  registerHandle(CHANNELS.ONBOARDING_RESET, async () => {
    return onboardingStore.reset()
  })
}
