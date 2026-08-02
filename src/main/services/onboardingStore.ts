import Store, { Schema } from 'electron-store'

import { resolveAppDataDir } from '../utils/pathResolve'
import { OnboardingProfile, OnboardingState } from '@shared/types/onboarding'

interface OnboardingStoreShape {
  completed: boolean
  profile: OnboardingProfile
  completedAt: number
  updatedAt: number
}

const onboardingSchema: Schema<OnboardingStoreShape> = {
  completed: { type: 'boolean', default: false },
  profile: {
    type: 'object',
    default: {
      birthday: '',
      gender: '',
      occupation: ''
    }
  },
  completedAt: { type: 'number', default: 0 },
  updatedAt: { type: 'number', default: Date.now() }
}

class OnboardingStoreService {
  private static instance: OnboardingStoreService

  private readonly store: Store<OnboardingStoreShape>

  private constructor() {
    this.store = new Store<OnboardingStoreShape>({
      name: 'onboarding',
      schema: onboardingSchema,
      cwd: resolveAppDataDir()
    })
  }

  public static getInstance(): OnboardingStoreService {
    if (!OnboardingStoreService.instance) {
      OnboardingStoreService.instance = new OnboardingStoreService()
    }
    return OnboardingStoreService.instance
  }

  public getState(): OnboardingState {
    return {
      completed: this.store.get('completed'),
      profile: this.store.get('profile'),
      completedAt: this.store.get('completedAt'),
      updatedAt: this.store.get('updatedAt')
    }
  }

  public saveProfile(profile: OnboardingProfile): OnboardingState {
    this.store.set('profile', {
      birthday: profile.birthday,
      gender: profile.gender,
      occupation: profile.occupation
    })
    this.touch()
    return this.getState()
  }

  public markCompleted(): OnboardingState {
    const now = Date.now()
    this.store.set('completed', true)
    this.store.set('completedAt', now)
    this.store.set('updatedAt', now)
    return this.getState()
  }

  public reset(): OnboardingState {
    this.store.set('completed', false)
    this.store.set('profile', {
      birthday: '',
      gender: '',
      occupation: ''
    })
    this.store.set('completedAt', 0)
    this.touch()
    return this.getState()
  }

  private touch(): void {
    this.store.set('updatedAt', Date.now())
  }
}

export { OnboardingStoreService }
