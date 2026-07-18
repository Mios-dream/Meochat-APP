<template>
  <div :class="['cmi-item', { 'cmi-user-item ': role === 'user' }]">
    <!-- 头像（助手消息/工具组专属） -->
    <div
      v-if="showAvatar"
      class="cmi-avatar"
      :style="{
        backgroundImage: `url(${avatarUrl})`,
        width: avatarSize + 'px',
        height: avatarSize + 'px',
        minWidth: avatarSize + 'px'
      }"
    />

    <div class="cmi-body">
      <!-- 信息栏（助手消息/工具组专属） -->
      <div v-if="showAvatar && assistantName" class="cmi-info">
        <span class="cmi-name">{{ assistantName }}</span>
        <span class="cmi-time">{{ displayTime }}</span>
      </div>

      <!-- 工具组模式：合并的工具调用 + 结果 + 可选回复 -->
      <template v-if="tools && tools.length > 0">
        <ToolCallGroupBlock :tools="tools" />
        <div v-if="replyContent != null" class="cmi-tool-reply">
          <div class="cmi-text cmi-assistant">
            <template v-if="Array.isArray(replyContent)">
              <template v-for="(part, idx) in replyContent" :key="idx">
                <span v-if="part.type === 'text'">{{ part.text }}</span>
              </template>
            </template>
            <template v-else>
              <span v-for="(seg, idx) in replyParsedSegments" :key="idx" :class="seg.class">
                {{ seg.text }}
              </span>
            </template>
          </div>
          <div v-if="replyAttachments.length > 0" class="cmi-attach">
            <div v-for="(att, aidx) in replyAttachments" :key="aidx" class="cmi-chip">
              <font-awesome-icon :icon="getAttachIcon(att)" class="cmi-chip-icon" />
              <span class="cmi-chip-name">{{ getAttachName(att) }}</span>
            </div>
          </div>
        </div>
      </template>

      <!-- 普通消息模式 -->
      <template v-else>
        <div :class="['cmi-text', `cmi-${role}`]">
          <!-- 工具调用（assistant 消息 content=null + tool_calls） -->
          <template v-if="toolCalls && toolCalls.length > 0">
            <div class="tc-panel">
              <div class="tc-header">
                <font-awesome-icon icon="wrench" class="tc-header-icon" />
                <span>调用工具</span>
              </div>
              <div class="tc-list">
                <div v-for="tc in toolCalls" :key="tc.id" class="tc-item">
                  <span class="tc-bullet">○</span>
                  <span class="tc-name">{{ tc.function.name }}</span>
                </div>
              </div>
            </div>
          </template>
          <!-- 工具结果（tool 角色） -->
          <template v-else-if="role === 'tool'">
            <div class="tool-result-content">{{ toolStringContent }}</div>
          </template>
          <!-- 结构化内容 -->
          <template v-else-if="Array.isArray(content)">
            <template v-for="(part, idx) in content" :key="idx">
              <span v-if="part.type === 'text'">{{ part.text }}</span>
            </template>
          </template>
          <!-- 纯文本内容 -->
          <template v-else>
            <span v-for="(seg, idx) in parsedSegments" :key="idx" :class="seg.class">
              {{ seg.text }}
            </span>
          </template>
        </div>
        <div
          v-if="msgAttachments.length > 0"
          :class="['cmi-attach', { 'cmi-attach-right': role === 'user' || role === 'tool' }]"
        >
          <div v-for="(att, aidx) in msgAttachments" :key="aidx" class="cmi-chip">
            <font-awesome-icon :icon="getAttachIcon(att)" class="cmi-chip-icon" />
            <span class="cmi-chip-name">{{ getAttachName(att) }}</span>
          </div>
        </div>
      </template>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import ToolCallGroupBlock from './ToolCallGroupBlock.vue'
import type { MergedTool } from './ToolCallGroupBlock.vue'
import { getAttachments } from '../chat/contentNormalizer'
import type { ContentPart, ToolCall } from '@shared/types/chat'

interface Props {
  role: 'user' | 'assistant' | 'tool'
  content?: string | ContentPart[] | null
  toolCalls?: ToolCall[]
  toolCallId?: string

  /** 工具组模式：提供此数组则进入工具组渲染 */
  tools?: MergedTool[]
  /** 工具组后续的助手文字回复 */
  replyContent?: string | ContentPart[] | null

  /** 显示定制 */
  avatarUrl?: string
  assistantName?: string
  timestamp?: Date | null
  avatarSize?: number
}

const props = withDefaults(defineProps<Props>(), {
  avatarUrl: '../assets/images/assistant_avatar_small.png',
  avatarSize: 50
})

const showAvatar = computed(
  () => props.role === 'assistant' || (props.tools && props.tools.length > 0)
)

const displayTime = computed(() => {
  if (!props.timestamp) return ''
  return props.timestamp.toLocaleDateString([], {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  })
})

/** 当前消息的附件列表 */
const msgAttachments = computed(() => {
  if (props.content == null) return []
  return getAttachments(props.content)
})

/** 工具组回复中的附件列表 */
const replyAttachments = computed(() => {
  if (props.replyContent == null) return []
  return getAttachments(props.replyContent)
})

/** 文本分段 */
interface TextSegment {
  text: string
  class?: string
}

/** 从 content 中提取纯文本（用于 tool 角色） */
const toolStringContent = computed(() => {
  if (typeof props.content === 'string') return props.content
  if (Array.isArray(props.content)) {
    return props.content
      .filter((p): p is ContentPart & { type: 'text' } => p.type === 'text')
      .map((p) => p.text)
      .join('')
  }
  return ''
})

/** 将纯文本解析为带样式的分段（括号内容 dim） */
function parseTextSegments(raw: string): TextSegment[] {
  if (!raw) return [{ text: '' }]
  const segments: TextSegment[] = []
  const bracketRegex = /(\([^)]*\)|\[[^\]]*\]|（[^）]*）|【[^】]*】)/g
  let lastIndex = 0
  let match
  while ((match = bracketRegex.exec(raw)) !== null) {
    if (match.index > lastIndex) {
      segments.push({ text: raw.slice(lastIndex, match.index) })
    }
    segments.push({ text: match[1], class: 'msg-dim' })
    lastIndex = match.index + match[1].length
  }
  if (lastIndex < raw.length) {
    segments.push({ text: raw.slice(lastIndex) })
  }
  if (segments.length === 0) {
    segments.push({ text: raw })
  }
  return segments
}

/** 主内容的分段解析 */
const parsedSegments = computed<TextSegment[]>(() => {
  const raw = typeof props.content === 'string' ? props.content : ''
  return parseTextSegments(raw)
})

/** 工具组回复的分段解析 */
const replyParsedSegments = computed<TextSegment[]>(() => {
  const raw = typeof props.replyContent === 'string' ? props.replyContent : ''
  return parseTextSegments(raw)
})

function getAttachIcon(att: ContentPart): string {
  if (att.type === 'image_ocr' || att.type === 'image_url') return 'image'
  if (att.type === 'attachment') return 'triangle-exclamation'
  return 'file-lines'
}

function getAttachName(att: ContentPart): string {
  if (att.type === 'image_url') return '图片附件'
  return (att as any).fileName ?? '附件'
}
</script>

<style scoped>
.cmi-item {
  display: flex;
  flex-direction: row;
  width: 100%;
  margin-bottom: 14px;
}

.cmi-item:last-child {
  margin-bottom: 0;
}

.cmi-user-item {
  justify-content: flex-end;
  margin-bottom: 0;
}

.cmi-avatar {
  border-radius: 50%;
  border: 2px solid #f982a6;
  flex-shrink: 0;
  background-size: cover;
  background-position: center;
  margin-right: 10px;
}

.cmi-body {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-width: 0;
  max-width: 80%;
  font-size: 14px;
}

.cmi-item.cmi-user .cmi-body {
  align-items: flex-end;
}

/* ─── 信息栏 ─── */
.cmi-info {
  display: flex;
  justify-content: space-between;
  align-items: center;
  width: 100%;
  height: 20px;
  margin-bottom: 6px;
}

.cmi-name {
  font-size: 14px;
  color: #656565;
}

.cmi-time {
  font-size: 12px;
  color: #999;
}

/* ─── 消息气泡 ─── */
.cmi-text {
  padding: 10px 12px;
  border-radius: 10px;
  word-wrap: break-word;
  white-space: pre-wrap;
  box-sizing: border-box;
  line-height: 1.5;
  max-width: 100%;
  width: auto;
}

.cmi-assistant {
  background-color: #fff3f5;
  border: 1px solid rgba(249, 130, 166, 0.15);
  /* color: #6f2b43; */
  color: #555;
  border-radius: 10px;
  align-self: flex-start;
}

.cmi-user {
  background-color: #f5f5f5;
  border: 1px solid rgba(0, 0, 0, 0.04);
  color: #555;
  border-radius: 10px;
  align-self: flex-end;
}

.cmi-tool {
  background: #faf5ff;
  border: 1px solid rgba(103, 58, 183, 0.12);
  color: #555;
  border-radius: 10px;
  font-size: 12px;
  align-self: flex-start;
}

/* ─── 工具组回复 ─── */
.cmi-tool-reply {
  margin-top: 8px;
}

/* ─── 附件栏 ─── */
.cmi-attach {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  margin-top: 4px;
}

.cmi-attach-right {
  justify-content: flex-end;
}

.cmi-chip {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 2px 8px;
  background: rgba(249, 130, 166, 0.08);
  border: 1px solid rgba(249, 130, 166, 0.2);
  border-radius: 6px;
  font-size: 11px;
  color: #6f2b43;
  max-width: 180px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.cmi-chip-icon {
  flex-shrink: 0;
  font-size: 11px;
  color: #fb7299;
}

.cmi-chip-name {
  overflow: hidden;
  text-overflow: ellipsis;
}

/* ─── 消息内容内联样式（原 MessageContent 组件） ─── */
.msg-dim {
  opacity: 0.45;
}

.tool-result-content {
  font-size: 12px;
  color: #7a5a8a;
  line-height: 1.5;
  white-space: pre-wrap;
  word-break: break-word;
}

.tc-panel {
  background: rgba(251, 114, 153, 0.04);
  border: 1px solid rgba(251, 114, 153, 0.08);
  border-radius: 8px;
  padding: 8px 10px;
}

.tc-header {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 11px;
  color: #c07a90;
  margin-bottom: 6px;
  user-select: none;
}

.tc-header-icon {
  font-size: 10px;
}

.tc-list {
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.tc-item {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 1px 0;
}

.tc-bullet {
  font-size: 8px;
  color: rgba(251, 114, 153, 0.35);
  line-height: 1;
  flex-shrink: 0;
}

.tc-name {
  font-size: 12px;
  color: #b06080;
  line-height: 1.5;
}
</style>
