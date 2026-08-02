export interface OnboardingProfile {
  birthday: string
  gender: string
  occupation: string
}

export interface OnboardingState {
  completed: boolean
  profile: OnboardingProfile
  completedAt: number
  updatedAt: number
}
