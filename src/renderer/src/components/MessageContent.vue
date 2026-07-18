<template>
  <div :class="['message-text', role]">
    <!-- 工具调用（assistant 消息 content=null + tool_calls） -->
    <template v-if="toolCalls && toolCalls.length > 0">
      <div v-for="tc in toolCalls" :key="tc.id" class="tool-call-card">
        <div class="tool-call-header">
          <font-awesome-icon icon="wrench" class="tool-call-icon" />
          <span class="tool-call-name">{{ tc.function.name }}</span>
        </div>
        <pre class="tool-call-args">{{ formatArgs(tc.function.arguments) }}</pre>
      </div>
    </template>

    <!-- 工具结果（tool 角色） -->
    <template v-else-if="role === 'tool'">
      <div class="tool-result-card">
        <div class="tool-result-header">
          <font-awesome-icon icon="arrow-right" class="tool-result-icon" />
          <span class="tool-result-label">工具结果{{ toolCallId ? ` (${toolCallId})` : '' }}</span>
        </div>
        <pre class="tool-result-content">{{ stringContent }}</pre>
      </div>
    </template>

    <!-- 结构化内容（仅渲染文本片段，附件由外层负责） -->
    <template v-else-if="isStructured">
      <template v-for="(part, idx) in typedContent" :key="idx">
        <span v-if="part.type === 'text'">{{ part.text }}</span>
      </template>
    </template>

    <!-- 纯文本内容 -->
    <template v-else>
      <span v-for="(segment, idx) in parsedSegments" :key="idx" :class="segment.class">
        {{ segment.text }}
      </span>
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { ContentPart, ToolCall } from '@shared/types/chat'

interface Props {
  content: string | ContentPart[] | null
  role: 'user' | 'assistant' | 'tool'
  toolCalls?: ToolCall[]
  toolCallId?: string
}

const props = defineProps<Props>()

const stringContent = computed(() => {
  if (typeof props.content === 'string') return props.content
  if (Array.isArray(props.content)) {
    return props.content
      .filter((p): p is ContentPart & { type: 'text' } => p.type === 'text')
      .map((p) => p.text)
      .join('')
  }
  return ''
})

const isStructured = computed(() => Array.isArray(props.content))

const typedContent = computed(() => {
  if (!Array.isArray(props.content)) return []
  return props.content
})

function formatArgs(args: string): string {
  try {
    return JSON.stringify(JSON.parse(args), null, 2)
  } catch {
    return args
  }
}

interface TextSegment {
  text: string
  class?: string
}

const parsedSegments = computed(() => {
  const raw = typeof props.content === 'string' ? props.content : ''
  if (!raw) return [{ text: '' }]

  const segments: TextSegment[] = []
  const bracketRegex = /(\([^)]*\)|\[[^\]]*\]|（[^）]*）|【[^】]*】)/g

  let lastIndex = 0
  let match

  while ((match = bracketRegex.exec(raw)) !== null) {
    if (match.index > lastIndex) {
      segments.push({ text: raw.slice(lastIndex, match.index) })
    }
    segments.push({ text: match[1], class: 'message-dim' })
    lastIndex = match.index + match[1].length
  }

  if (lastIndex < raw.length) {
    segments.push({ text: raw.slice(lastIndex) })
  }

  if (segments.length === 0) {
    segments.push({ text: raw })
  }

  return segments
})
</script>

<style scoped>
.message-text {
  line-height: 1.5;
}

.message-dim {
  opacity: 0.45;
}

/* ─── 工具调用卡片 ─── */
.tool-call-card {
  margin-top: 4px;
  padding: 8px 10px;
  background: rgba(103, 58, 183, 0.06);
  border: 1px solid rgba(103, 58, 183, 0.15);
  border-radius: 8px;
}

.tool-call-header {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 4px;
}

.tool-call-icon {
  color: #7b4fbf;
  font-size: 13px;
}

.tool-call-name {
  font-weight: 600;
  font-size: 13px;
  color: #7b4fbf;
}

.tool-call-args {
  margin: 0;
  font-size: 11px;
  color: #555;
  background: rgba(255, 255, 255, 0.5);
  padding: 4px 6px;
  border-radius: 4px;
  white-space: pre-wrap;
  word-break: break-word;
}

/* ─── 工具结果卡片 ─── */
.tool-result-card {
  margin-top: 4px;
  padding: 8px 10px;
  background: rgba(255, 152, 0, 0.06);
  border: 1px solid rgba(255, 152, 0, 0.15);
  border-radius: 8px;
}

.tool-result-header {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 4px;
}

.tool-result-icon {
  color: #e68a00;
  font-size: 13px;
}

.tool-result-label {
  font-weight: 600;
  font-size: 13px;
  color: #e68a00;
}

.tool-result-content {
  margin: 0;
  font-size: 11px;
  color: #555;
  background: rgba(255, 255, 255, 0.5);
  padding: 4px 6px;
  border-radius: 4px;
  white-space: pre-wrap;
  word-break: break-word;
}
</style>
