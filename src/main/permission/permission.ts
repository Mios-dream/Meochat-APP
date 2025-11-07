import { session } from 'electron'

function getPermission() {
  session.defaultSession.setPermissionRequestHandler((_webContents, permission, callback) => {
    if (permission === 'media') {
      // 允许媒体权限
      callback(true)
    } else {
      callback(false)
    }
  })
}

export { getPermission }
