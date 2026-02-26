<script setup lang="ts">
import { ref, nextTick, watch } from 'vue'
import MessageBubble from './MessageBubble.vue'

export interface Message {
  id: number
  content: string
  isUser: boolean
}

const props = defineProps<{
  messages: Message[]
}>()

const container = ref<HTMLElement | null>(null)

// 消息变化时自动滚到底部
watch(
  () => props.messages.length,
  async () => {
    await nextTick()
    if (container.value) {
      container.value.scrollTop = container.value.scrollHeight
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
    />
  </div>
</template>

<style scoped>
.message-list {
  flex: 1;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  padding: 1rem;
  gap: 0.5rem;
}
</style>
