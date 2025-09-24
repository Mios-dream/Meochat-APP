import { BrowserWindow } from 'electron'
import path from 'path'
import { fileURLToPath } from 'url'
import { dirname } from 'path'

// 在 ESM 中获取 __dirname 的等效方法
const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

let assistantWindow = null

export function createAssistantWindow() {
  if (assistantWindow && !assistantWindow.isDestroyed()) {
    assistantWindow.focus()
    return
  }

  assistantWindow = new BrowserWindow({
    width: 400,
    height: 400,
    frame: true,
    transparent: true,
    alwaysOnTop: true,
    resizable: false,
    skipTaskbar: true,
    autoHideMenuBar: true,
    // focusable: false, // 如果需要点击穿透，在这里开启
    webPreferences: {
      contextIsolation: true,
      preload: path.join(__dirname, '../preload/assistantPreload.js'), // 👈 专用 preload
    },
  })

  // 加载宠物页面

  assistantWindow.loadURL(`http://localhost:5173/#/assistant`)

  assistantWindow.webContents.openDevTools({ mode: 'detach' })

  assistantWindow.once('ready-to-show', () => {
    assistantWindow.show()
  })

  assistantWindow.on('closed', () => {
    assistantWindow = null
  })

  return assistantWindow
}

// 提供外部访问当前宠物窗口的方法
export function getAssistantWindow() {
  return assistantWindow && !assistantWindow.isDestroyed() ? assistantWindow : null
}
