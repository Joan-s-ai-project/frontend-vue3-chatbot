<script setup lang="ts">
import ThinkingBlock from './ThinkingBlock.vue'

defineProps<{
  content: string
  isUser: boolean
  reasoning?: string
  reasoningLoading?: boolean
}>()
</script>

<template>
  <div class="bubble" :class="{ user: isUser, assistant: !isUser }">
    <div class="avatar">{{ isUser ? '🧑' : '🤖' }}</div>
    <div class="body">
      <ThinkingBlock
        v-if="!isUser && (reasoning || reasoningLoading)"
        :content="reasoning || ''"
        :loading="reasoningLoading"
      />
      <div class="content" v-if="content">{{ content }}</div>
    </div>
  </div>
</template>

<style scoped>
.bubble {
  display: flex;
  gap: 0.6rem;
  padding: 0.5rem 1rem;
  max-width: 85%;
  animation: fadeIn 0.3s ease;
}

@keyframes fadeIn {
  from { opacity: 0; transform: translateY(8px); }
  to { opacity: 1; transform: translateY(0); }
}

.bubble.user {
  align-self: flex-end;
  flex-direction: row-reverse;
}

.bubble.assistant {
  align-self: flex-start;
}

.avatar {
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.2rem;
  border-radius: 50%;
  background: #f0f1f5;
  flex-shrink: 0;
}

.user .avatar {
  background: #e8ecff;
}

.body {
  display: flex;
  flex-direction: column;
  gap: 0.3rem;
  min-width: 0;
}

.content {
  padding: 0.65rem 0.9rem;
  border-radius: 14px;
  line-height: 1.6;
  white-space: pre-wrap;
  word-break: break-word;
  font-size: 0.93rem;
}

.user .content {
  background: linear-gradient(135deg, #667eea, #764ba2);
  color: #fff;
  border-bottom-right-radius: 4px;
}

.assistant .content {
  background: #fff;
  color: #333;
  border-bottom-left-radius: 4px;
  box-shadow: 0 1px 3px rgba(0,0,0,0.06);
}
</style>
