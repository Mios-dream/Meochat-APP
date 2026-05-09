import Store, { Schema } from 'electron-store'

import { resolveAppDataDir } from '../utils/pathResolve'
import {
  OnboardingMode,
  OnboardingProfile,
  OnboardingState
} from '../../renderer/src/types/onboarding'

interface OnboardingStoreShape {
  completed: boolean
  mode: OnboardingMode
  profile: OnboardingProfile
  completedAt: number
  updatedAt: number
}

const onboardingSchema: Schema<OnboardingStoreShape> = {
  completed: { type: 'boolean', default: false },
  mode: { type: 'string', default: '' },
  profile: {
    type: 'object',
    default: {
      name: '',
      birthday: '',
      gender: '',
      occupation: ''
    }
  },
  completedAt: { type: 'number', default: 0 },
  updatedAt: { type: 'number', default: Math.floor(Date.now() / 1000) }
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
      mode: this.store.get('mode'),
      profile: this.store.get('profile'),
      completedAt: this.store.get('completedAt'),
      updatedAt: this.store.get('updatedAt')
    }
  }

  public setMode(mode: OnboardingMode): OnboardingState {
    this.store.set('mode', mode)
    this.touch()
    return this.getState()
  }

  public saveProfile(profile: OnboardingProfile): OnboardingState {
    this.store.set('profile', {
      name: profile.name,
      birthday: profile.birthday,
      gender: profile.gender,
      occupation: profile.occupation
    })
    this.touch()
    return this.getState()
  }

  public markCompleted(): OnboardingState {
    const now = Math.floor(Date.now() / 1000)
    this.store.set('completed', true)
    this.store.set('completedAt', now)
    this.store.set('updatedAt', now)
    return this.getState()
  }

  public reset(): OnboardingState {
    this.store.set('completed', false)
    this.store.set('mode', '')
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
    this.store.set('updatedAt', Math.floor(Date.now() / 1000))
  }
}

export { OnboardingStoreService }
