<script setup lang="ts">
defineProps<{
  content: string
  isUser: boolean
}>()
</script>

<template>
  <div class="bubble" :class="{ user: isUser, assistant: !isUser }">
    <div class="avatar">{{ isUser ? '🧑' : '🤖' }}</div>
    <div class="content">{{ content }}</div>
  </div>
</template>

<style scoped>
.bubble {
  display: flex;
  gap: 0.75rem;
  padding: 0.75rem 1rem;
  max-width: 80%;
}

.bubble.user {
  align-self: flex-end;
  flex-direction: row-reverse;
}

.bubble.assistant {
  align-self: flex-start;
}

.avatar {
  font-size: 1.5rem;
  flex-shrink: 0;
}

.content {
  padding: 0.75rem 1rem;
  border-radius: 12px;
  line-height: 1.6;
  white-space: pre-wrap;
  word-break: break-word;
}

.user .content {
  background: #4a90d9;
  color: #fff;
  border-bottom-right-radius: 4px;
}

.assistant .content {
  background: #fff;
  color: #333;
  border-bottom-left-radius: 4px;
  box-shadow: 0 1px 2px rgba(0,0,0,0.08);
}
</style>
