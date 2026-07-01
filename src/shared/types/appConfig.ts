export interface AppConfig {
  baseUrl: string
  volume: number
  generateMotion: boolean
  autoStartOnBoot: boolean
  autoUpdate: boolean
  autoChat: boolean
  debugMode: boolean
  silentMode: boolean
  idleEvent: boolean
  quietMode: boolean
  desktopSpeechBoard: boolean
  appSpeechBoard: boolean
  assistantEnabled: boolean
  currentAssistant: string
  themeColor: string
  chatShortcut: string
  sleepMode: boolean
  kernelMode: 'local' | 'api'
}
