import { AppConfig } from '../../../renderer/src/types/appConfig'

export interface ConfigApi {
  config: {
    get: <K extends keyof AppConfig>(key?: K) => Promise<AppConfig[K] | AppConfig>
    set: <K extends keyof AppConfig>(key: K, value: AppConfig[K]) => Promise<void>
    onChange: (callback: (config: AppConfig) => void) => void
  }
}
