#!/usr/bin/env tsx

/**
 * IPC 三端绑定检查脚本
 *
 * 验证所有在 CHANNELS 中定义的通道名是否同时在以下两处被引用：
 *   1. preload — ipcRenderer 调用（send / invoke / on）
 *   2. main    — ipcMain 注册（handle / on）
 *
 * 检测方式：从 channels/ 定义文件中提取常量名 → 通道值映射，
 * 然后在 preload/main 源码中搜索 `CHANNELS.常量名` 引用。
 *
 * 使用方式：
 *   npx tsx scripts/check-ipc-bindings.ts
 *
 * 退出码：0 = 全部通过, 1 = 存在缺失
 */

import { readFileSync } from 'node:fs'
import { globSync } from 'tinyglobby'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')

/** 将相对路径转换为用于 readFileSync 的绝对路径 */
function absPath(p: string): string {
  return path.isAbsolute(p) ? p : path.join(ROOT, p)
}

interface ChannelEntry {
  /** 常量名，如 APP_SHOW */
  constantName: string
  /** 通道名字符串，如 'app:show' */
  channelValue: string
}

/** 从通道定义文件中提取 `CONSTANT_NAME: 'channel-value'` 模式的键值对 */
function extractChannelEntries(filePath: string): ChannelEntry[] {
  const content = readFileSync(filePath, 'utf-8')
  const entries: ChannelEntry[] = []
  const regex = /(\w+)\s*:\s*['"]([^'"]+)['"]\s*,/g
  let match: RegExpExecArray | null
  while ((match = regex.exec(content)) !== null) {
    entries.push({ constantName: match[1], channelValue: match[2] })
  }
  return entries
}

// ─── 1. 从 channels/ 分类文件中提取所有通道定义 ───

const CHANNELS_DIR = path.join(ROOT, 'src', 'shared', 'ipc', 'channels')
const CATEGORY_FILES = globSync(['!(index|types).ts'], { cwd: CHANNELS_DIR })

const channelEntries: ChannelEntry[] = []
for (const file of CATEGORY_FILES) {
  const entries = extractChannelEntries(absPath(path.join(CHANNELS_DIR, file)))
  channelEntries.push(...entries)
}

console.log(`[检查] 共发现 ${channelEntries.length} 个通道定义\n`)

// ─── 2. 搜索指定源码侧的引用 ───

interface ChannelRef {
  found: boolean
  files: string[]
}

function findChannelReferences(files: string[], entries: ChannelEntry[]): Map<string, ChannelRef> {
  const refs = new Map<string, ChannelRef>()
  for (const entry of entries) {
    refs.set(entry.channelValue, { found: false, files: [] })
  }

  for (const file of files) {
    const content = readFileSync(absPath(file), 'utf-8')
    for (const entry of entries) {
      // 搜索 `CHANNELS.常量名` 模式
      const pattern = `CHANNELS.${entry.constantName}`
      const ref = refs.get(entry.channelValue)
      if (content.includes(pattern) && ref && !ref.found) {
        ref.found = true
        ref.files.push(file)
      }
    }
  }
  return refs
}

const preloadFiles = globSync(['src/preload/**/*.ts'], { cwd: ROOT, ignore: ['**/types/**'] })
const preloadRefs = findChannelReferences(preloadFiles, channelEntries)

const mainFiles = globSync(['src/main/**/*.ts'], { cwd: ROOT, ignore: ['**/windows/**'] })
const mainRefs = findChannelReferences(mainFiles, channelEntries)

// ─── 3. 报告 ───

let hasError = false
const missingInPreload: ChannelEntry[] = []
const missingInMain: ChannelEntry[] = []

for (const entry of channelEntries) {
  if (!preloadRefs.get(entry.channelValue)?.found) missingInPreload.push(entry)
  if (!mainRefs.get(entry.channelValue)?.found) missingInMain.push(entry)
}

if (missingInPreload.length > 0) {
  hasError = true
  console.log(`❌ preload 侧未引用（共 ${missingInPreload.length} 个）：`)
  for (const entry of missingInPreload) {
    console.log(`   - ${entry.channelValue} (${entry.constantName})`)
  }
  console.log()
}

if (missingInMain.length > 0) {
  hasError = true
  console.log(`❌ main 侧未引用（共 ${missingInMain.length} 个）：`)
  for (const entry of missingInMain) {
    console.log(`   - ${entry.channelValue} (${entry.constantName})`)
  }
  console.log()
}

if (!hasError) {
  console.log('✅ 所有通道在 preload 和 main 两侧均有引用')
} else {
  console.log('\n详细信息：')
  for (const entry of channelEntries) {
    const pRef = preloadRefs.get(entry.channelValue)
    const mRef = mainRefs.get(entry.channelValue)
    if (!pRef?.found || !mRef?.found) {
      console.log(`  ${entry.channelValue} (${entry.constantName}):`)
      console.log(`    preload: ${pRef && pRef.found ? pRef.files.join(', ') : '❌ 未找到'}`)
      console.log(`    main:    ${mRef && mRef.found ? mRef.files.join(', ') : '❌ 未找到'}`)
    }
  }
}

process.exit(hasError ? 1 : 0)
