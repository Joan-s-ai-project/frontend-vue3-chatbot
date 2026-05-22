<script setup lang="ts">
import { ref, nextTick, watch, onMounted, onUnmounted } from 'vue'
import MessageBubble from './MessageBubble.vue'

export interface ToolCall {
  name: string
  query?: string
  command?: string
  result?: string
  loading?: boolean
}

export interface ThinkingBlock {
  content: string
  loading: boolean
}

/** 有序的内容块，按实际产生顺序排列 */
export type ContentBlock =
  | { kind: 'thinking'; content: string; loading: boolean }
  | { kind: 'tool'; name: string; query?: string; command?: string; result?: string; loading?: boolean }

export interface Message {
  id: number
  content: string
  isUser: boolean
  /** 有序内容块（thinking + tool 交替，按实际顺序） */
  blocks?: ContentBlock[]
  images?: string[]
  cost?: {
    input_cost: number
    cache_cost: number
    output_cost: number
    total_cost: number
    currency: string
  }
  usage?: {
    prompt_tokens: number
    completion_tokens: number
    total_tokens: number
    cached_tokens: number
  }
  model?: string
  // 以下两个字段保留，供流式写入时使用，渲染时统一走 blocks
  thinkingBlocks?: ThinkingBlock[]
  toolCalls?: ToolCall[]
}

const props = defineProps<{
  messages: Message[]
}>()

const container = ref<HTMLElement | null>(null)
const isAutoScrollEnabled = ref(true)
let isProgrammaticScroll = false  // 标记是程序触发的滚动，不应影响 isAutoScrollEnabled

function handleScroll() {
  if (!container.value) return
  if (isProgrammaticScroll) return  // 忽略程序触发的滚动事件
  const { scrollTop, scrollHeight, clientHeight } = container.value
  const isAtBottom = scrollHeight - scrollTop - clientHeight <= 10
  // 只有用户主动向上滚动时才关闭自动滚动；到达底部时重新开启
  isAutoScrollEnabled.value = isAtBottom
}

async function scrollToBottom() {
  if (!container.value) return
  isProgrammaticScroll = true
  container.value.scrollTop = container.value.scrollHeight
  await nextTick()
  // 等下一帧再关闭标志，确保 scroll 事件已经触发完毕
  requestAnimationFrame(() => {
    isProgrammaticScroll = false
  })
}

onMounted(() => {
  container.value?.addEventListener('scroll', handleScroll)
})

onUnmounted(() => {
  container.value?.removeEventListener('scroll', handleScroll)
})

defineExpose({ scrollToBottom })

watch(
  () => props.messages.length,
  async () => {
    isAutoScrollEnabled.value = true
    await nextTick()
    scrollToBottom()
  }
)

watch(
  () => props.messages,
  async () => {
    if (!isAutoScrollEnabled.value) return
    await nextTick()
    scrollToBottom()
  },
  { deep: true }
)

// 最后一条消息从空内容变为有内容时（如错误写入），强制滚到底
// 解决用户滚动后 isAutoScrollEnabled=false 导致错误消息不可见的问题
watch(
  () => {
    const last = props.messages[props.messages.length - 1]
    return last && !last.isUser ? last.content : ''
  },
  async (newVal, oldVal) => {
    if (!oldVal && newVal) {
      isAutoScrollEnabled.value = true
      await nextTick()
      scrollToBottom()
    }
  }
)
</script>

<template>
  <div class="message-list" ref="container">
    <MessageBubble
      v-for="msg in messages"
      :key="msg.id"
      :content="msg.content"
      :is-user="msg.isUser"
      :blocks="msg.blocks"
      :cost="msg.cost"
      :usage="msg.usage"
      :model="msg.model"
      :images="msg.images"
    />
  </div>
</template>

<style scoped>
.message-list {
  flex: 1;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  padding: 1rem 0.5rem;
  gap: 0.4rem;
  background: #f5f5f5;
}

/* 自定义滚动条 - 粗野风格 */
.message-list::-webkit-scrollbar {
  width: 8px;
}

.message-list::-webkit-scrollbar-track {
  background: #e0e0e0;
}

.message-list::-webkit-scrollbar-thumb {
  background: #000;
}
</style>
