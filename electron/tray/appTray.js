import { Menu, Tray, app } from 'electron'
import { createMainWindow } from '../windows/mainWindow.js'
import path from 'path'

let tray = null

function createTray() {
  // 创建系统托盘
  const iconPath = path.join(app.getAppPath(), 'asset', 'icon', 'app_small.ico')
  tray = new Tray(iconPath)
  const contextMenu = Menu.buildFromTemplate([
    {
      label: '退出',
      role: 'quit',
    },
  ])
  tray.setToolTip('Meochat')
  tray.setContextMenu(contextMenu)

  tray.on('click', () => {
    createMainWindow()
  })

  tray.on('right-click', () => {
    tray.popUpContextMenu()
  })

  return tray
}

function getTray() {
  return tray
}

function setTrayTip(message) {
  tray.setToolTip(message)
}

export { getTray, createTray, setTrayTip }
