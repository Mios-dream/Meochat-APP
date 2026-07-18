/**
 * 聊天内容标准化工具
 *
 * 将后端返回的 ChatCompletionMessageParam 格式内容（string | ContentPart[]）
 * 统一为前端友好的 ContentPart[] 格式，支持三种文本标记：
 *   [图片: 文件名] 内容
 *   [文件: 文件名]\n内容
 *   [附件: 文件名] 描述
 *
 * 同时兼容旧版 [图片 N 中的文字]: 内容 和 [文件 xxx 内容]:\n内容 格式。
 *
 * 本文件零依赖，可在任意窗口（包括工具栏等无 Live2D 环境）中安全使用。
 */

import type { ContentPart } from '@shared/types/chat'

/** 将后端内容标准化为前端友好的 ContentPart[]，null 保留。 */
export function normalizeContent(
  content: string | ContentPart[] | null | undefined
): ContentPart[] | null {
  if (Array.isArray(content)) {
    return convertContentParts(content)
  }
  if (typeof content === 'string') {
    return parseStructuredText(content)
  }
  return null
}

/** 将后端可能为 type: "text" 的 parts 转换为结构化类型 */
function convertContentParts(parts: ContentPart[]): ContentPart[] {
  const result: ContentPart[] = []
  for (const part of parts) {
    if (part.type === 'text') {
      const converted = tryParseContentPart(part.text)
      if (converted) {
        result.push(converted)
      } else {
        result.push(part)
      }
    } else {
      result.push(part)
    }
  }
  return result
}

/** 尝试识别一单段文本中的附件标记，返回结构化片段或 null */
function tryParseContentPart(text: string): ContentPart | null {
  // 新格式：[图片: 文件名] 内容（内容可包含换行）
  const imgMatch = text.match(/^\[图片:\s*(.+?)\]\s*([\s\S]*)$/)
  if (imgMatch) {
    return { type: 'image_ocr', fileName: imgMatch[1].trim(), text: imgMatch[2].trim() }
  }

  // 新格式：[文件: 文件名]\n内容
  const docMatch = text.match(/^\[文件:\s*(.+?)\]\s*([\s\S]*)$/)
  if (docMatch) {
    return { type: 'doc', fileName: docMatch[1].trim(), text: docMatch[2].trim() }
  }

  // 新格式：[附件: 文件名] 描述（内容可包含换行）
  const attMatch = text.match(/^\[附件:\s*(.+?)\]\s*([\s\S]*)$/)
  if (attMatch) {
    return { type: 'attachment', fileName: attMatch[1].trim(), text: attMatch[2].trim() }
  }

  // 旧格式兼容：[图片 N 中的文字]: 内容
  const oldImgMatch = text.match(/^\[图片\s*(\d+)\s*中的文字\]\s*:\s*([\s\S]*)$/)
  if (oldImgMatch) {
    return { type: 'image_ocr', fileName: `图片${oldImgMatch[1]}`, text: oldImgMatch[2].trim() }
  }

  // 旧格式兼容：[文件 xxx 内容]:\n内容
  const oldDocMatch = text.match(/^\[文件\s+(.+?)\s*内容\]\s*:\s*([\s\S]*)$/)
  if (oldDocMatch) {
    return { type: 'doc', fileName: oldDocMatch[1].trim(), text: oldDocMatch[2].trim() }
  }

  return null
}

/**
 * 将纯文本字符串解析为 ContentPart[]
 * 兼容多个标记拼接到同一个字符串中的情况
 */
function parseStructuredText(text: string): ContentPart[] {
  if (!text) return []

  const parts: ContentPart[] = []
  let lastEnd = 0

  const re = /\[(图片|文件|附件):\s*(.+?)\]\s*/g
  let match: RegExpExecArray | null

  while ((match = re.exec(text)) !== null) {
    if (match.index > lastEnd) {
      const before = text.slice(lastEnd, match.index)
      if (before.trim()) {
        parts.push({ type: 'text', text: before })
      }
    }

    const markerType = match[1]
    const fileName = match[2].trim()
    const contentStart = match.index + match[0].length
    const restText = text.slice(contentStart)
    const nextIdx = restText.search(/\[(?:图片|文件|附件):/)
    const content = nextIdx < 0 ? restText.trim() : restText.slice(0, nextIdx).trim()

    const typeMap: Record<string, 'image_ocr' | 'doc' | 'attachment'> = {
      图片: 'image_ocr',
      文件: 'doc',
      附件: 'attachment'
    }

    parts.push({ type: typeMap[markerType], fileName, text: content })

    const skipLen = nextIdx < 0 ? restText.length : nextIdx
    re.lastIndex = contentStart + skipLen
    lastEnd = re.lastIndex
  }

  if (lastEnd < text.length) {
    const rest = text.slice(lastEnd)
    if (rest.trim()) {
      parts.push({ type: 'text', text: rest })
    }
  }

  return parts.length > 0 ? parts : [{ type: 'text', text }]
}

/** 从 content 中提取所有非文本附件片段 */
export function getAttachments(content: string | ContentPart[] | null | undefined): ContentPart[] {
  if (!Array.isArray(content)) return []
  return content.filter((p) => p.type !== 'text')
}
