<script setup lang="ts">
import { ref, computed } from 'vue'
import { marked } from 'marked'

const props = defineProps<{
  content: string
  loading?: boolean
}>()

const expanded = ref(false)

const renderedContent = computed(() => {
  if (!props.content) return ''
  // 流式进行中时，在末尾补两个换行，让 marked 把未闭合的块级语法强制结束
  // 避免不完整的 markdown（如未闭合的列表、加粗）导致后续内容被吞掉
  const raw = props.loading ? props.content + '\n\n' : props.content
  return marked.parse(raw) as string
})
</script>

<template>
  <div class="thinking-block" :class="{ loading }">
    <div class="thinking-header" @click="expanded = !expanded">
      <span class="icon">{{ loading ? '◻' : '◼' }}</span>
      <span class="label">{{ loading ? 'THINKING...' : 'THINKING' }}</span>
      <span class="arrow" :class="{ open: expanded }">▶</span>
    </div>
    <transition name="slide">
      <div v-if="expanded" class="thinking-content" v-html="renderedContent">
      </div>
    </transition>
  </div>
</template>

<style scoped>
.thinking-block {
  overflow: hidden;
  font-size: 0.8rem;
  border: 3px solid #000;
  width: 100%;
}

.thinking-block.loading {
  border-style: dashed;
}

.thinking-header {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  padding: 0.4rem 0.6rem;
  cursor: pointer;
  user-select: none;
  background: #f0f0f0;
  transition: all 0.1s;
}

.thinking-header:hover {
  background: #000;
  color: #fff;
}

.icon {
  font-size: 0.75rem;
}

.label {
  color: inherit;
  flex: 1;
  font-weight: 700;
  letter-spacing: 0.1em;
  text-transform: uppercase;
}

.loading .label {
  animation: blink 1s step-end infinite;
}

@keyframes blink {
  0%, 100% { opacity: 1; }
  50% { opacity: 0; }
}

.arrow {
  font-size: 0.6rem;
  transition: transform 0.1s;
}

.arrow.open {
  transform: rotate(90deg);
}

.thinking-content {
  padding: 0.5rem 0.7rem;
  color: #333;
  line-height: 1.55;
  border-top: 3px solid #000;
  background: #fafafa;
}

.thinking-content :deep(p) {
  margin: 0.3em 0;
}

.thinking-content :deep(ol),
.thinking-content :deep(ul) {
  margin: 0.3em 0;
  padding-left: 1.5em;
}

.thinking-content :deep(li) {
  margin: 0.15em 0;
}

/* 展开动画 */
.slide-enter-active,
.slide-leave-active {
  transition: all 0.15s ease;
}

.slide-enter-from,
.slide-leave-to {
  opacity: 0;
  max-height: 0;
  padding-top: 0;
  padding-bottom: 0;
}
</style>
