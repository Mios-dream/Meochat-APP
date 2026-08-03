import { Menu, Tray } from 'electron'
import { createWindow, mainWindowConfig } from '../windows'
// 托盘图标按平台选择：Windows 用 .ico；Linux/macOS 用 .png（Electron 在 Linux 无法解码 .ico）
import appIconWin from '/resources/icon/app.ico?asset'
import appIconLinux from '/resources/icon/app.png?asset'

const appIcon = process.platform === 'win32' ? appIconWin : appIconLinux

let tray: Tray

function createTray(): Tray {
  tray = new Tray(appIcon)
  const contextMenu = Menu.buildFromTemplate([
    {
      label: '退出',
      role: 'quit'
    }
  ])
  tray.setToolTip('MoeChat')
  tray.setContextMenu(contextMenu)

  tray.on('click', () => {
    createWindow(mainWindowConfig, { showImmediately: true })
  })

  tray.on('right-click', () => {
    tray.popUpContextMenu()
  })

  return tray
}

function getTray(): Tray {
  return tray
}

function setTrayTip(message: string): void {
  tray.setToolTip(message)
}

export { getTray, createTray, setTrayTip }
