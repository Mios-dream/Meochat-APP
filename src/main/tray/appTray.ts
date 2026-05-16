import { Menu, Tray } from 'electron'
import { createMainWindow } from '../windows/mainWindow'
import appIcon from '/resources/icon/app.ico?asset'

let tray: Tray

function createTray(): Tray {
  tray = new Tray(appIcon)
  const contextMenu = Menu.buildFromTemplate([
    {
      label: '退出',
      role: 'quit'
    }
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

function getTray(): Tray {
  return tray
}

function setTrayTip(message: string): void {
  tray.setToolTip(message)
}

export { getTray, createTray, setTrayTip }
