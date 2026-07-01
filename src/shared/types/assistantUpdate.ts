import type { AssetTypeTimestamps } from './assistantTypes'

export interface UpdateCheckResult {
  needsUpdate: boolean
  assetsLastModified: number
  assetTypes: AssetTypeTimestamps
}
