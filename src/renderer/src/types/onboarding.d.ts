export type OnboardingMode = '' | 'local' | 'api'

export interface OnboardingProfile {
  birthday: string
  gender: string
  occupation: string
}

export interface OnboardingState {
  completed: boolean
  mode: OnboardingMode
  profile: OnboardingProfile
  completedAt: number
  updatedAt: number
}
