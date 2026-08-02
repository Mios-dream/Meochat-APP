#!/usr/bin/env tsx

/**
 * IPC 三端绑定 + 方向一致性检查脚本
 *
 * 以 channels/ 中带方向的通道定义（CHANNEL_DEFS）为单一事实来源，验证：
 *   1. 通道值唯一性（两个常量映射到同一通道名 → 冲突）
 *   2. 方向一致性：main 侧注册方式与通道方向匹配
 *        invoke → registerHandle / ipcMain.handle（缺则 ERROR）
 *        send   → registerOn / ipcMain.on（缺则 ERROR）
 *        event  → main 必须发送（webContents.send 等；缺则 WARN，监听永不触发）
 *   3. 语义完整性：
 *        - 主进程注册但渲染侧（preload）无调用方 → WARN（孤儿注册）
 *        - 任何一侧都未引用的通道 → WARN（死通道定义）
 *   4. 绕过 CHANNELS 常量的裸通道字符串字面量 → ERROR（拼写漂移风险）
 *
 * 与旧版差异：
 *   - 扫描范围覆盖 main 全部（含 windows/）、preload、renderer
 *   - 通过 CHANNEL_DEFS 直接获取「常量名 → 通道名 + 方向」，不再用脆弱的正则提取
 *   - 依据方向而非简单的两端引用判断
 *
 * 使用方式：
 *   npx tsx scripts/check-ipc-bindings.ts
 *
 * 退出码：0 = 无错误（可能有警告）, 1 = 存在 ERROR
 */

import { readFileSync } from 'node:fs'
import { globSync } from 'tinyglobby'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { CHANNEL_DEFS } from '../src/shared/ipc/channels'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')

/** 通道方向 */
type ChannelDirection = 'invoke' | 'send' | 'event'

/** 通道信息 */
interface ChannelInfo {
  /** 常量名，如 APP_SHOW */
  constant: string
  /** 通道名字符串，如 'app:show' */
  channel: string
  /** 通道方向 */
  direction: ChannelDirection
}

// ─── 1. 从 CHANNEL_DEFS 提取所有通道定义（单一事实来源） ───

const defs = CHANNEL_DEFS as Record<string, { direction: ChannelDirection; channel: string }>

const channelsByValue = new Map<string, ChannelInfo>()
const channelsByConstant = new Map<string, ChannelInfo>()
for (const [key, def] of Object.entries(defs)) {
  const info: ChannelInfo = { constant: key, channel: def.channel, direction: def.direction }
  channelsByValue.set(def.channel, info)
  channelsByConstant.set(key, info)
}

console.log(`[检查] 共发现 ${channelsByValue.size} 个通道定义\n`)

// ─── 2. 扫描各侧源码中的 CHANNELS.常量 引用并分类方向上下文 ───

/** main 侧注册/发送标记 */
const MAIN_HANDLE_RE = /(registerHandle|ipcMain\.handle)\(/
const MAIN_ON_RE = /(registerOn|ipcMain\.on)\(/
const MAIN_SEND_RE = /(webContents\.send|\.sender\.send)\(/

/** preload / renderer 侧调用标记（用词边界匹配，兼容 `ipcRenderer\n  .invoke(` 链式调用） */
const RENDERER_INVOKE_RE = /\binvoke\(/
const RENDERER_SEND_RE = /\bsend\(/
const RENDERER_ON_RE = /\bon\(/

/** 上下文回溯行数（覆盖多行调用：registerHandle(\n CHANNELS.X, ...） */
const CONTEXT_WINDOW = 5

/**
 * 统计单侧文件中 CHANNELS.常量 引用的方向上下文
 *
 * 采用「就近 marker 优先」分类：从 CHANNELS 引用所在行向上回溯，
 * 取最近一个调用标记（registerHandle / registerOn / ipcRenderer.send 等）作为该引用的方向上下文，
 * 避免同窗口内无关标记的干扰（如 handle 回调体内的 send 引用）。
 *
 * @param files 文件列表
 * @param isMain 是否为 main 侧（影响上下文标记集合与默认分类）
 */
function collectRefs(
  files: string[],
  isMain: boolean
): Map<string, { handle: boolean; on: boolean; send: boolean; invoke: boolean; any: boolean }> {
  const refs = new Map<
    string,
    { handle: boolean; on: boolean; send: boolean; invoke: boolean; any: boolean }
  >()
  for (const info of channelsByValue.values()) {
    refs.set(info.channel, { handle: false, on: false, send: false, invoke: false, any: false })
  }

  for (const file of files) {
    const abs = path.isAbsolute(file) ? file : path.join(ROOT, file)
    const lines = readFileSync(abs, 'utf-8').split(/\r?\n/)

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]
      const match = line.match(/CHANNELS\.(\w+)/)
      if (!match) continue

      const info = channelsByConstant.get(match[1])
      if (!info) continue

      const ref = refs.get(info.channel)!
      ref.any = true

      // 从引用行向上回溯，取最近一个调用标记（含本行），就近优先
      let kind: 'handle' | 'on' | 'send' | 'invoke' | null = null
      const start = Math.max(0, i - CONTEXT_WINDOW)
      for (let j = i; j >= start; j--) {
        const l = lines[j]
        if (isMain) {
          if (MAIN_HANDLE_RE.test(l)) {
            kind = 'handle'
            break
          }
          if (MAIN_ON_RE.test(l)) {
            kind = 'on'
            break
          }
          if (MAIN_SEND_RE.test(l)) {
            kind = 'send'
            break
          }
        } else {
          if (RENDERER_INVOKE_RE.test(l)) {
            kind = 'invoke'
            break
          }
          if (RENDERER_SEND_RE.test(l)) {
            kind = 'send'
            break
          }
          if (RENDERER_ON_RE.test(l)) {
            kind = 'on'
            break
          }
        }
      }

      if (kind === 'handle') {
        ref.handle = true
      } else if (kind === 'on') {
        ref.on = true
      } else if (kind === 'invoke') {
        ref.invoke = true
      } else if (kind === 'send') {
        ref.send = true
      } else if (isMain) {
        // main 侧未匹配到注册标记的引用（webContents.send / event.sender.send / 广播辅助函数）视为发送
        ref.send = true
      }
      // preload/renderer 侧未匹配到标记的引用：仅计入 any，不参与方向判定
    }
  }
  return refs
}

const mainFiles = globSync(['src/main/**/*.ts'], { cwd: ROOT })
const preloadFiles = globSync(['src/preload/**/*.ts'], { cwd: ROOT })
const rendererFiles = globSync(['src/renderer/**/*.{ts,tsx,vue}'], { cwd: ROOT })

const mainRefs = collectRefs(mainFiles, true)
const preloadRefs = collectRefs(preloadFiles, false)
const rendererRefs = collectRefs(rendererFiles, false)

// ─── 3. 检查通道值唯一性 ───

interface CheckResult {
  errors: string[]
  warnings: string[]
}

const result: CheckResult = { errors: [], warnings: [] }

// 3.1 通道值冲突：多个常量映射到同一通道名
const collisionGroups = new Map<string, string[]>()
for (const info of channelsByValue.values()) {
  const list = collisionGroups.get(info.channel) ?? []
  list.push(info.constant)
  collisionGroups.set(info.channel, list)
}
for (const [channel, constants] of collisionGroups) {
  if (constants.length > 1) {
    result.errors.push(
      `通道值冲突：${channel} 被多个常量使用（${constants.join(', ')}），需拆分或重命名`
    )
  }
}

// ─── 4. 逐通道检查方向一致性 + 语义完整性 ───

for (const info of channelsByValue.values()) {
  const m = mainRefs.get(info.channel)!
  const p = preloadRefs.get(info.channel)!
  const r = rendererRefs.get(info.channel)!
  const refCount = (m.any ? 1 : 0) + (p.any ? 1 : 0) + (r.any ? 1 : 0)

  switch (info.direction) {
    case 'invoke':
      // renderer invoke → main handle
      if (!m.handle) {
        result.errors.push(
          `${info.channel} (${info.constant})：缺少 main 端 registerHandle（renderer invoke 将无响应）`
        )
      }
      if (m.any && !p.invoke) {
        result.warnings.push(
          `${info.channel} (${info.constant})：main 已注册但 preload 无 invoke 调用方（孤儿注册）`
        )
      }
      break

    case 'send':
      // renderer send → main on
      if (!m.on) {
        result.errors.push(
          `${info.channel} (${info.constant})：缺少 main 端 registerOn（renderer send 将无人处理）`
        )
      }
      if (m.any && !p.send) {
        result.warnings.push(
          `${info.channel} (${info.constant})：main 已注册但 preload 无 send 调用方（孤儿注册）`
        )
      }
      break

    case 'event':
      // main send → renderer on
      if (!m.send) {
        result.warnings.push(
          `${info.channel} (${info.constant})：主进程从未发送该事件（renderer 监听永不触发）`
        )
      }
      if (m.send && !p.on) {
        result.warnings.push(`${info.channel} (${info.constant})：主进程已发送但 preload 无人监听`)
      }
      break
  }

  // 死通道：任何一侧都未引用
  if (refCount === 0) {
    result.warnings.push(
      `${info.channel} (${info.constant})：死通道定义，未在 main / preload / renderer 任何一侧引用`
    )
  }
}

// ─── 5. 检查绕过 CHANNELS 常量的裸通道字符串 ───

/** 通道式字符串字面量（形如 'a:b-c'），排除模板字符串与注释行 */
const RAW_CHANNEL_RE = /['"]([a-zA-Z][\w-]*:[a-zA-Z][\w.:-]*)['"]/

function isCommentLine(line: string): boolean {
  const trimmed = line.trim()
  return trimmed.startsWith('//') || trimmed.startsWith('*') || trimmed.startsWith('/*')
}

const rawStringHits: string[] = []
for (const file of [...mainFiles, ...preloadFiles, ...rendererFiles]) {
  const abs = path.isAbsolute(file) ? file : path.join(ROOT, file)
  const lines = readFileSync(abs, 'utf-8').split(/\r?\n/)
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    if (isCommentLine(line)) continue
    // 去除行内注释后再匹配，避免注释中的通道名误报
    const codePart = line.split('//')[0]
    const match = codePart.match(RAW_CHANNEL_RE)
    if (!match) continue
    const value = match[1]
    // 仅当字符串与已注册通道值完全一致时视为「绕过常量」的裸字符串
    if (channelsByValue.has(value)) {
      rawStringHits.push(`${file.replace(/\\/g, '/')}:${i + 1} 使用了裸字符串 '${value}'`)
    }
  }
}
if (rawStringHits.length > 0) {
  result.errors.push('以下位置绕过 CHANNELS 常量使用了裸通道字符串：')
  result.errors.push(...rawStringHits.map((hit) => `    - ${hit}`))
}

// ─── 6. 报告 ───

if (result.errors.length > 0) {
  console.log(`❌ 错误（${result.errors.length} 项）：`)
  for (const e of result.errors) console.log(`   ${e}`)
  console.log()
}

if (result.warnings.length > 0) {
  console.log(`⚠️ 警告（${result.warnings.length} 项）：`)
  for (const w of result.warnings) console.log(`   ${w}`)
  console.log()
}

if (result.errors.length === 0 && result.warnings.length === 0) {
  console.log('✅ 所有通道方向一致、绑定完整，无裸字符串绕过')
} else if (result.errors.length === 0) {
  console.log('✅ 无错误，请留意上方警告项')
}

process.exit(result.errors.length > 0 ? 1 : 0)
