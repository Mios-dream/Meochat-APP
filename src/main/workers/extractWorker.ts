import { parentPort, workerData } from 'worker_threads'
import fs from 'fs'
import path from 'path'
import StreamZip from 'node-stream-zip'

/**
 * 解压 Worker - 在独立线程中执行 zip 解压操作，避免阻塞主进程
 *
 * workerData 参数：
 * - zipPath: zip 文件路径
 * - targetDir: 解压目标目录
 * - nameEncoding: 条目名编码 ('utf8' | 'gbk')
 * - isFullDownload: 是否全量下载（全量时清空目标目录）
 */

interface WorkerData {
  zipPath: string
  targetDir: string
  nameEncoding: 'utf8' | 'gbk'
  isFullDownload: boolean
}

interface ExtractResult {
  success: boolean
  error?: string
}

/**
 * 检查路径安全性，防止路径穿越攻击
 */
function isPathSafe(relativePath: string, targetDir: string): boolean {
  const resolved = path.resolve(targetDir, relativePath)
  return resolved.startsWith(targetDir + path.sep) || resolved === targetDir
}

/**
 * 执行解压操作
 */
async function extractZip(data: WorkerData): Promise<ExtractResult> {
  const { zipPath, targetDir, nameEncoding, isFullDownload } = data

  try {
    // 全量下载时清空目标目录
    if (isFullDownload && fs.existsSync(targetDir)) {
      fs.rmSync(targetDir, { recursive: true, force: true })
    }

    // 确保目标目录存在
    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true })
    }

    // 打开 zip 文件
    const zip = new StreamZip.async({ file: zipPath, nameEncoding })

    try {
      const entries = Object.values(await zip.entries())
      const totalEntries = entries.length
      let processedEntries = 0

      for (const entry of entries) {
        // 跳过 info.yaml/info.yml 配置文件
        if (/^info\.ya?ml$/i.test(entry.name)) {
          processedEntries++
          continue
        }

        const relativeEntryName = entry.name
        const normalizedRelativePath = path.normalize(relativeEntryName)

        // 安全检查：防止路径穿越
        if (!isPathSafe(normalizedRelativePath, targetDir)) {
          processedEntries++
          continue
        }

        const destinationPath = path.join(targetDir, normalizedRelativePath)

        if (entry.isDirectory) {
          fs.mkdirSync(destinationPath, { recursive: true })
        } else {
          // 确保父目录存在
          const parentDir = path.dirname(destinationPath)
          if (!fs.existsSync(parentDir)) {
            fs.mkdirSync(parentDir, { recursive: true })
          }

          // 读取并写入文件
          const data = await zip.entryData(entry.name)
          fs.writeFileSync(destinationPath, data)
        }

        processedEntries++

        // 每处理 50 个文件向主线程报告一次进度
        if (processedEntries % 50 === 0 || processedEntries === totalEntries) {
          parentPort?.postMessage({
            type: 'progress',
            processed: processedEntries,
            total: totalEntries
          })
        }
      }
    } finally {
      await zip.close()
    }

    // 清理临时 zip 文件
    if (fs.existsSync(zipPath)) {
      fs.unlinkSync(zipPath)
    }

    return { success: true }
  } catch (error) {
    return { success: false, error: (error as Error).message }
  }
}

// 执行解压并返回结果
extractZip(workerData as WorkerData)
  .then((result) => {
    parentPort?.postMessage({ type: 'complete', ...result })
  })
  .catch((error) => {
    parentPort?.postMessage({
      type: 'complete',
      success: false,
      error: (error as Error).message
    })
  })
