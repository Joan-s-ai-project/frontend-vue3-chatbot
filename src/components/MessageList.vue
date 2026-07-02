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
  | { kind: 'content'; content: string }
  | { kind: 'tool'; name: string; query?: string; command?: string; result?: string; loading?: boolean }

export interface Message {
  id: number
  content: string
  isUser: boolean
  /** 有序内容块（thinking + tool 交替，按实际顺序） */
  blocks?: ContentBlock[]
  images?: string[]
  attachments?: Array<{ type: 'image' | 'document'; name: string; dataUrl?: string }>
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
  toolCallsCount?: number
  messageCount?: number
  /** 消息创建时间（毫秒时间戳） */
  createdAt?: number
  /** 处理总时长（毫秒），仅 assistant 消息 */
  duration?: number
  /** 本条回复被中止（用户停止/断连/出错），内容可能不完整 */
  stopped?: boolean
  // 以下两个字段保留，供流式写入时使用，渲染时统一走 blocks
  thinkingBlocks?: ThinkingBlock[]
  toolCalls?: ToolCall[]
}

const props = defineProps<{
  messages: Message[]
}>()

const container = ref<HTMLElement | null>(null)
const isAutoScrollEnabled = ref(true)
const showScrollBtn = ref(false)
let isProgrammaticScroll = false  // 标记是程序触发的滚动，不应影响 isAutoScrollEnabled

function handleScroll() {
  if (!container.value) return
  if (isProgrammaticScroll) return  // 忽略程序触发的滚动事件
  const { scrollTop, scrollHeight, clientHeight } = container.value
  const isAtBottom = scrollHeight - scrollTop - clientHeight <= 10
  isAutoScrollEnabled.value = isAtBottom
  showScrollBtn.value = !isAtBottom
}

async function scrollToBottom() {
  if (!container.value) return
  isProgrammaticScroll = true
  container.value.scrollTop = container.value.scrollHeight
  await nextTick()
  showScrollBtn.value = false
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
  <div class="message-list-wrap">
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
        :tool-calls-count="msg.toolCallsCount"
        :message-count="msg.messageCount"
        :created-at="msg.createdAt"
        :duration="msg.duration"
        :stopped="msg.stopped"
        :images="msg.images"
        :attachments="msg.attachments"
      />
    </div>

    <!-- 滚动到底部悬浮按钮 -->
    <Transition name="scroll-btn">
      <button
        v-if="showScrollBtn"
        class="scroll-to-bottom"
        @click="scrollToBottom"
        title="滚动到底部"
      >
        <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2">
          <polyline points="3,5 8,11 13,5" />
        </svg>
      </button>
    </Transition>
  </div>
</template>

<style scoped>
.message-list-wrap {
  flex: 1;
  position: relative;
  min-height: 0;
  display: flex;
  flex-direction: column;
}

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

/* 滚动到底部按钮 */
.scroll-to-bottom {
  position: absolute;
  bottom: 1.2rem;
  right: 1.2rem;
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #000;
  color: #fff;
  border: 3px solid #000;
  cursor: pointer;
  box-shadow: 4px 4px 0 #333;
  transition: box-shadow 0.1s, transform 0.1s;
  z-index: 10;
}

.scroll-to-bottom:hover {
  box-shadow: 6px 6px 0 #333;
  transform: translate(-2px, -2px);
}

.scroll-to-bottom:active {
  box-shadow: 1px 1px 0 #333;
  transform: translate(0, 0);
}

.scroll-to-bottom svg {
  width: 13px;
  height: 13px;
  stroke-width: 2;
}

/* 出现/消失动画 */
.scroll-btn-enter-active,
.scroll-btn-leave-active {
  transition: opacity 0.2s, transform 0.2s;
}

.scroll-btn-enter-from,
.scroll-btn-leave-to {
  opacity: 0;
  transform: translateY(8px);
}
</style>
