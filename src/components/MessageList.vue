<script setup lang="ts">
import { ref, nextTick, watch, onMounted, onUnmounted } from 'vue'
import MessageBubble from './MessageBubble.vue'

export interface Message {
  id: number
  content: string
  isUser: boolean
  reasoning?: string
  reasoningLoading?: boolean
}

const props = defineProps<{
  messages: Message[]
}>()

const container = ref<HTMLElement | null>(null)
const isAutoScrollEnabled = ref(true)

// 处理用户手动滚动
function handleScroll() {
  if (!container.value) return
  const { scrollTop, scrollHeight, clientHeight } = container.value
  // 如果距离底部超过 10px，认为是用户主动向上滚动了
  const isAtBottom = scrollHeight - scrollTop - clientHeight <= 10
  isAutoScrollEnabled.value = isAtBottom
}

onMounted(() => {
  container.value?.addEventListener('scroll', handleScroll)
})

onUnmounted(() => {
  container.value?.removeEventListener('scroll', handleScroll)
})

// 监听消息数量变化（发新消息时），强制回到最后并开启自动滚动
watch(
  () => props.messages.length,
  async () => {
    isAutoScrollEnabled.value = true
    await nextTick()
    if (container.value) {
      container.value.scrollTop = container.value.scrollHeight
    }
  }
)

// 深度监听消息内容变化（流式打字效果时），如果自动滚动处于开启状态，则滚动到底部
watch(
  () => props.messages,
  async () => {
    if (!isAutoScrollEnabled.value) return
    await nextTick()
    if (container.value) {
      container.value.scrollTop = container.value.scrollHeight
    }
  },
  { deep: true }
)
</script>

<template>
  <div class="message-list" ref="container">
    <MessageBubble
      v-for="msg in messages"
      :key="msg.id"
      :content="msg.content"
      :is-user="msg.isUser"
      :reasoning="msg.reasoning"
      :reasoning-loading="msg.reasoningLoading"
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
  gap: 0.25rem;
}
</style>
