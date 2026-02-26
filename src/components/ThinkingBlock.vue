<script setup lang="ts">
import { ref } from 'vue'

defineProps<{
  content: string
  loading?: boolean
}>()

const expanded = ref(false)
</script>

<template>
  <div class="thinking-block" :class="{ loading }">
    <div class="thinking-header" @click="expanded = !expanded">
      <span class="icon">{{ loading ? '⏳' : '💭' }}</span>
      <span class="label">{{ loading ? '思考中...' : '思考过程' }}</span>
      <span class="arrow" :class="{ open: expanded }">›</span>
    </div>
    <transition name="slide">
      <div v-if="expanded" class="thinking-content">
        {{ content }}
      </div>
    </transition>
  </div>
</template>

<style scoped>
.thinking-block {
  border-radius: 10px;
  overflow: hidden;
  font-size: 0.82rem;
  border: 1px solid #e8e8e8;
}

.thinking-block.loading {
  border-color: #d4daff;
  background: #f5f7ff;
}

.thinking-header {
  display: flex;
  align-items: center;
  gap: 0.35rem;
  padding: 0.35rem 0.6rem;
  cursor: pointer;
  user-select: none;
  transition: background 0.15s;
}

.thinking-header:hover {
  background: rgba(0,0,0,0.03);
}

.icon {
  font-size: 0.85rem;
}

.label {
  color: #888;
  flex: 1;
}

.loading .label {
  color: #667eea;
  animation: pulse 1.5s infinite;
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}

.arrow {
  color: #aaa;
  font-size: 1rem;
  transition: transform 0.2s;
}

.arrow.open {
  transform: rotate(90deg);
}

.thinking-content {
  padding: 0.5rem 0.7rem;
  color: #777;
  line-height: 1.55;
  white-space: pre-wrap;
  border-top: 1px solid #eee;
  background: #fafbff;
  max-height: 300px;
  overflow-y: auto;
}

/* 展开动画 */
.slide-enter-active,
.slide-leave-active {
  transition: all 0.2s ease;
}

.slide-enter-from,
.slide-leave-to {
  opacity: 0;
  max-height: 0;
  padding-top: 0;
  padding-bottom: 0;
}
</style>
