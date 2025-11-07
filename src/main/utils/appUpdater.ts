import electronUpdater from 'electron-updater'

export function getAutoUpdater() {
  const { autoUpdater } = electronUpdater
  autoUpdater.autoDownload = false // 手动控制下载
  return autoUpdater
}
