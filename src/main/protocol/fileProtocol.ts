import { app, protocol } from 'electron'
import fs from 'fs'
import path from 'path'

// 一个辅助函数，用于处理不同操作系统的文件路径问题
function convertPath(originalPath): string {
  const match = originalPath.match(/^\/([a-zA-Z])\/(.*)$/)
  if (match) {
    // 为 Windows 系统转换路径格式
    return `${match[1]}:/${match[2]}`
  } else {
    return originalPath // 其他系统直接使用原始路径
  }
}

function registerFileProtocol(): void {
  // 根目录
  protocol.registerSchemesAsPrivileged([
    {
      scheme: 'local-resource',
      privileges: {
        secure: true, // 让 Electron 信任这个方式就像信任网站的 HTTPS 一样
        supportFetchAPI: true, // 允许我们像在网页上那样请求资源
        standard: true, // 让这种方式的网址看起来像普通的网址
        bypassCSP: true, // 允许我们绕过一些安全限制
        stream: true // 允许我们以流的形式读取文件，这对于大文件很有用
      }
    }
  ])
  // app目录
  protocol.registerSchemesAsPrivileged([
    {
      scheme: 'app-resource',
      privileges: {
        secure: true, // 让 Electron 信任这个方式就像信任网站的 HTTPS 一样
        supportFetchAPI: true, // 允许我们像在网页上那样请求资源
        standard: true, // 让这种方式的网址看起来像普通的网址
        bypassCSP: true, // 允许我们绕过一些安全限制
        stream: true // 允许我们以流的形式读取文件，这对于大文件很有用
      }
    }
  ])
}

function handleFileProtocol(): void {
  // 处理本地资源请求
  protocol.handle('local-resource', async (request) => {
    try {
      const decodedUrl = decodeURIComponent(
        request.url.replace(new RegExp(`^local-resource:/`, 'i'), '')
      )

      const fullPath = process.platform === 'win32' ? convertPath(decodedUrl) : decodedUrl

      const data = await fs.promises.readFile(fullPath) // 异步读取文件内容
      return new Response(data) // 将文件内容作为响应返回
    } catch (error) {
      console.error('读取本地文件时出错:', (error as Error).message)
      return new Response(null, { status: 404 }) // 返回 404 错误
    }
  })

  // 处理app资源请求
  protocol.handle('app-resource', async (request) => {
    try {
      const decodedUrl = decodeURIComponent(
        request.url.replace(new RegExp(`^app-resource:/`, 'i'), '')
      )

      const fullPath = process.platform === 'win32' ? convertPath(decodedUrl) : decodedUrl

      const data = await fs.promises.readFile(path.join(app.getAppPath(), fullPath)) // 异步读取文件内容
      return new Response(data) // 将文件内容作为响应返回
    } catch (error) {
      console.error('读取app目录的文件时出错:', (error as Error).message)
      return new Response(null, { status: 404 }) // 返回 404 错误
    }
  })
}

export { registerFileProtocol, handleFileProtocol }
