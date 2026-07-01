import { session } from 'electron'

function getPermission(): void {
  session.defaultSession.setPermissionRequestHandler((_webContents, permission, callback) => {
    if (permission === 'media' || permission === 'geolocation') {
      // 允许媒体和地理定位权限
      callback(true)
    } else {
      callback(false)
    }
  })
}

export { getPermission }
