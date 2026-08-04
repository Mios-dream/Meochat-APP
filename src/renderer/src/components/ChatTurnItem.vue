<template>
  <div class="ct-item">
    <!-- 用户消息：保持右侧气泡展示 -->
    <template v-for="(um, i) in turn.userMessages" :key="'user-' + i">
      <ChatMessageItem
        :kind="um.kind"
        :content="um.content"
        :tool-calls="um.tool_calls"
        :tool-call-id="um.tool_call_id"
        :avatar-url="avatarUrl"
        :assistant-name="assistantName"
        :avatar-size="avatarSize"
        :timestamp="showTimestamp ? toDate(um.timestamp) : null"
      />
    </template>

    <!-- 助手侧：单个头像 + 整段回复堆叠 -->
    <div v-if="turn.units.length > 0" class="ct-assistant">
      <div
        class="ct-avatar"
        :style="{
          backgroundImage: `url(${avatarUrl})`,
          width: avatarSize + 'px',
          height: avatarSize + 'px',
          minWidth: avatarSize + 'px'
        }"
      />
      <div class="ct-assistant-body">
        <!-- 信息头：助手名 + 时间 -->
        <div class="ct-info">
          <span class="ct-name">{{ assistantName }}</span>
          <span v-if="showTimestamp && turnTimestamp" class="ct-time">{{ displayTime }}</span>
        </div>

        <!-- 回合内容：工具组 与 逐句文本 按顺序堆叠，共享单个头像 -->
        <template v-for="(unit, idx) in turn.units" :key="idx">
          <ToolCallGroupBlock v-if="unit.type === 'tools'" :tools="unit.tools" />
          <ChatMessageItem
            v-else
            :kind="unit.msg.kind"
            :content="unit.msg.content"
            :tool-calls="unit.msg.tool_calls"
            :tool-call-id="unit.msg.tool_call_id"
            :avatar-url="avatarUrl"
            :assistant-name="assistantName"
            :avatar-size="avatarSize"
            :show-header="false"
          />
        </template>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import ChatMessageItem from './ChatMessageItem.vue'
import ToolCallGroupBlock from './ToolCallGroupBlock.vue'
import type { ChatTurn, GroupableMessage } from '../chat/toolGrouping'

/** 回合消息结构：分组所需字段 + 兼容 Date / 字符串的时间戳（工具栏无、历史弹窗为 Date） */
type TurnMessage = GroupableMessage & { timestamp?: Date | string | null }

interface Props {
  /** 需要展示的对话回合（由 chat/toolGrouping 的 groupChatTurns 产出） */
  turn: ChatTurn<TurnMessage>
  /** 助手头像地址 */
  avatarUrl?: string
  /** 助手显示名称 */
  assistantName?: string
  /** 头像尺寸（px） */
  avatarSize?: number
  /** 是否显示消息时间戳（助手空间历史弹窗开启，工具栏关闭） */
  showTimestamp?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  avatarUrl: '../assets/images/assistant_avatar_small.png',
  assistantName: '助手',
  avatarSize: 45,
  showTimestamp: false
})

/** 将 Date / 字符串时间戳统一转换为 Date；缺失或非法返回 null */
function toDate(ts: Date | string | null | undefined): Date | null {
  if (ts instanceof Date) return ts
  if (typeof ts === 'string') {
    const normalized = ts.replace(' ', 'T')
    const parsed = new Date(normalized)
    return Number.isNaN(parsed.getTime()) ? null : parsed
  }
  return null
}

/** 回合时间：取首个文本内容单元的原始时间戳 */
const turnTimestamp = computed<Date | null>(() => {
  for (const unit of props.turn.units) {
    if (unit.type === 'text') {
      const parsed = toDate(unit.msg.timestamp)
      if (parsed) return parsed
    }
  }
  return null
})

/** 格式化回合时间显示 */
const displayTime = computed(() => {
  if (!turnTimestamp.value) return ''
  return turnTimestamp.value.toLocaleDateString([], {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  })
})
</script>

<style scoped>
/* 回合之间的间距 */
.ct-item {
  margin-bottom: 16px;
}

.ct-item:last-child {
  margin-bottom: 0;
}

/* 助手侧布局：左头像 + 右侧内容列 */
.ct-assistant {
  display: flex;
  flex-direction: row;
  align-items: flex-start;
  gap: 10px;
}

.ct-avatar {
  border-radius: 50%;
  border: 2px solid #f982a6;
  flex-shrink: 0;
  background-size: cover;
  background-position: center;
}

.ct-assistant-body {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

/* 信息头 */
.ct-info {
  display: flex;
  align-items: center;
  gap: 8px;
  height: 20px;
}

.ct-name {
  font-size: 14px;
  color: #656565;
}

.ct-time {
  margin-left: auto;
  font-size: 12px;
  color: #999;
  flex-shrink: 0;
}

/* 收紧回合内消息间距：由 gap 控制，去掉子组件自带的外边距 */
.ct-assistant-body :deep(.cmi-item) {
  margin-bottom: 0;
}

.ct-assistant-body :deep(.cmi-item:last-child) {
  margin-bottom: 0;
}
</style>
