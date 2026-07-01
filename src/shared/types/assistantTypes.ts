export interface AssistantBaseInfo {
  name: string
  alias?: string
  user?: string
  avatar?: string
  birthday?: string
  height?: number | string
  weight?: number | string
  personality?: string
  description?: string
  mask?: string
  extraDescription?: string
  messageExamples?: string[]
  startWith?: string[]
}

export interface GSVSetting {
  textLang: string
  gptModelPath: string
  sovitsModelPath: string
  refAudioPath: string
  promptText: string
  promptLang: string
  seed: number
  topK: number
  batchSize: number
  extra: Record<string, string>
  extraRefAudio: Record<string, string>
}

export interface AssistantSettings {
  enableLongMemory: boolean
  enableLongMemorySearchEnhance: boolean
  enableCoreMemory: boolean
  longMemoryThreshold: number
  enableLoreBooks: boolean
  loreBooksThreshold: number
  loreBooksDepth: number
  enableEmotionSystem: boolean
  enableEmotionPersist: boolean
  contextLength: number
}

export interface AssetTypeTimestamps {
  audio: number
  images: number
  live2d: number
  models: number
  other: number
}

export interface UserStateInfo {
  firstMeetTime: number
  love: number
  updatedAt: number
  assetsLastModified: number
  assetTypesLastModified?: AssetTypeTimestamps
}

export interface AssistantInfo extends AssistantBaseInfo {
  name: string
  alias?: string
  user: string
  avatar: string
  birthday: string
  height: number | string
  weight: number | string
  personality: string
  description: string
  mask: string
  messageExamples: string[]
  extraDescription: string
  userState: UserStateInfo
  customPrompt: string
  startWith: string[]
  settings: AssistantSettings
  gsvSetting: GSVSetting
  emotionSetting: Record<string, any>
}

export interface AssistantAssets {
  assistantName: string
  characterImages: string
  live2d: {
    modelPath: string
    modelJsonPath: string
  }
}
