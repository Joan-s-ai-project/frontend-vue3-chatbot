<script setup lang="ts">
import { computed } from 'vue'
import { marked } from 'marked'
import ThinkingBlock from './ThinkingBlock.vue'

const props = defineProps<{
  content: string
  isUser: boolean
  reasoning?: string
  reasoningLoading?: boolean
}>()

// 配置 marked：支持换行、允许 HTML 标签透传（如 <details>/<summary>）
marked.setOptions({
  breaks: true,
})

const renderedContent = computed(() => {
  if (!props.content) return ''
  return marked.parse(props.content) as string
})
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
      <div
        class="content markdown-body"
        v-if="content"
        v-html="renderedContent"
      ></div>
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

/* ===== Markdown 排版样式 ===== */
.markdown-body :deep(p) {
  margin: 0.4em 0;
}

.markdown-body :deep(p:first-child) {
  margin-top: 0;
}

.markdown-body :deep(p:last-child) {
  margin-bottom: 0;
}

.markdown-body :deep(strong) {
  font-weight: 600;
}

.markdown-body :deep(em) {
  font-style: italic;
}

/* 标题 */
.markdown-body :deep(h1),
.markdown-body :deep(h2),
.markdown-body :deep(h3),
.markdown-body :deep(h4),
.markdown-body :deep(h5),
.markdown-body :deep(h6) {
  margin: 0.6em 0 0.3em;
  font-weight: 600;
  line-height: 1.3;
}

.markdown-body :deep(h1) { font-size: 1.3em; }
.markdown-body :deep(h2) { font-size: 1.15em; }
.markdown-body :deep(h3) { font-size: 1.05em; }

/* 列表 */
.markdown-body :deep(ul),
.markdown-body :deep(ol) {
  margin: 0.4em 0;
  padding-left: 1.5em;
}

.markdown-body :deep(li) {
  margin: 0.15em 0;
}

.markdown-body :deep(li > p) {
  margin: 0.2em 0;
}

/* 行内代码 */
.markdown-body :deep(code) {
  background: rgba(0, 0, 0, 0.06);
  padding: 0.15em 0.35em;
  border-radius: 4px;
  font-size: 0.88em;
  font-family: 'SF Mono', 'Fira Code', 'Consolas', monospace;
}

/* 代码块 */
.markdown-body :deep(pre) {
  background: #1e1e2e;
  color: #cdd6f4;
  padding: 0.75rem 1rem;
  border-radius: 8px;
  overflow-x: auto;
  margin: 0.5em 0;
  font-size: 0.85em;
  line-height: 1.5;
}

.markdown-body :deep(pre code) {
  background: none;
  padding: 0;
  border-radius: 0;
  color: inherit;
  font-size: inherit;
}

/* 引用 */
.markdown-body :deep(blockquote) {
  border-left: 3px solid #667eea;
  margin: 0.5em 0;
  padding: 0.3em 0.8em;
  color: #666;
  background: #f8f9ff;
  border-radius: 0 6px 6px 0;
}

/* 分隔线 */
.markdown-body :deep(hr) {
  border: none;
  border-top: 1px solid #e8e8e8;
  margin: 0.6em 0;
}

/* 链接 */
.markdown-body :deep(a) {
  color: #667eea;
  text-decoration: none;
}

.markdown-body :deep(a:hover) {
  text-decoration: underline;
}

/* 表格 */
.markdown-body :deep(table) {
  border-collapse: collapse;
  width: 100%;
  margin: 0.5em 0;
  font-size: 0.9em;
}

.markdown-body :deep(th),
.markdown-body :deep(td) {
  border: 1px solid #e0e0e0;
  padding: 0.4em 0.6em;
  text-align: left;
}

.markdown-body :deep(th) {
  background: #f5f6fa;
  font-weight: 600;
}

/* ===== <details> / <summary> 折叠块 ===== */
.markdown-body :deep(details) {
  border: 1px solid #e0e4f0;
  border-radius: 8px;
  margin: 0.5em 0;
  overflow: hidden;
  transition: border-color 0.2s;
}

.markdown-body :deep(details[open]) {
  border-color: #c5ccee;
}

.markdown-body :deep(summary) {
  padding: 0.45em 0.75em;
  cursor: pointer;
  font-weight: 500;
  background: #f5f7ff;
  user-select: none;
  transition: background 0.15s;
  list-style: none;
  display: flex;
  align-items: center;
  gap: 0.4em;
}

.markdown-body :deep(summary::before) {
  content: '▶';
  font-size: 0.65em;
  transition: transform 0.2s;
  display: inline-block;
}

.markdown-body :deep(details[open] > summary::before) {
  transform: rotate(90deg);
}

.markdown-body :deep(summary::-webkit-details-marker) {
  display: none;
}

.markdown-body :deep(summary:hover) {
  background: #edf0ff;
}

.markdown-body :deep(details > *:not(summary)) {
  padding: 0 0.75em;
}

.markdown-body :deep(details > p:last-child) {
  padding-bottom: 0.5em;
}

/* 用户气泡内的 markdown 颜色覆盖 */
.user .markdown-body :deep(code) {
  background: rgba(255, 255, 255, 0.2);
  color: #fff;
}

.user .markdown-body :deep(pre) {
  background: rgba(0, 0, 0, 0.25);
  color: #e8e8ff;
}

.user .markdown-body :deep(blockquote) {
  border-left-color: rgba(255, 255, 255, 0.5);
  background: rgba(255, 255, 255, 0.1);
  color: rgba(255, 255, 255, 0.85);
}

.user .markdown-body :deep(a) {
  color: #c8d4ff;
}

.user .markdown-body :deep(th) {
  background: rgba(255, 255, 255, 0.15);
}

.user .markdown-body :deep(th),
.user .markdown-body :deep(td) {
  border-color: rgba(255, 255, 255, 0.25);
}
</style>
