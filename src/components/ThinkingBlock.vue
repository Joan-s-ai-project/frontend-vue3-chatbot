<script setup lang="ts">
import { ref } from 'vue'

defineProps<{
  content: string
  loading?: boolean
}>()

const expanded = ref(false)
</script>

<template>
  <div class="thinking-block">
    <div class="thinking-header" @click="expanded = !expanded">
      <span class="icon">{{ loading ? '⏳' : '💭' }}</span>
      <span class="label">{{ loading ? '思考中...' : '查看思考过程' }}</span>
      <span class="arrow" :class="{ open: expanded }">▸</span>
    </div>
    <div v-if="expanded" class="thinking-content">
      {{ content }}
    </div>
  </div>
</template>

<style scoped>
.thinking-block {
  margin-bottom: 0.5rem;
  border: 1px solid #e8e8e8;
  border-radius: 8px;
  overflow: hidden;
  font-size: 0.85rem;
}

.thinking-header {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  padding: 0.4rem 0.6rem;
  background: #f8f8f8;
  cursor: pointer;
  user-select: none;
}

.thinking-header:hover {
  background: #f0f0f0;
}

.icon {
  font-size: 0.9rem;
}

.label {
  color: #888;
  flex: 1;
}

.arrow {
  color: #aaa;
  transition: transform 0.2s;
}

.arrow.open {
  transform: rotate(90deg);
}

.thinking-content {
  padding: 0.6rem 0.8rem;
  color: #666;
  line-height: 1.6;
  white-space: pre-wrap;
  border-top: 1px solid #e8e8e8;
  background: #fafafa;
}
</style>
