<script setup lang="ts">
import { computed } from 'vue'
import { marked } from 'marked'
import ThinkingBlock from './ThinkingBlock.vue'

const props = defineProps<{
  content: string
  isUser: boolean
  reasoning?: string
  reasoningLoading?: boolean
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
  toolCalls?: { name: string; query: string; result?: string; loading?: boolean }[]
}>()

marked.setOptions({
  breaks: true,
})

const renderedContent = computed(() => {
  if (!props.content) return ''
  // reasoningLoading 为 true 说明 AI 还在流式输出，末尾补换行防止未闭合语法截断内容
  const raw = props.reasoningLoading ? props.content + '\n\n' : props.content
  return marked.parse(raw) as string
})
</script>

<template>
  <div class="bubble" :class="{ user: isUser, assistant: !isUser }">
    <div class="avatar">{{ isUser ? '█' : '░' }}</div>
    <div class="body">
      <!-- 用户消息中的图片 -->
      <div class="msg-images" v-if="isUser && images && images.length">
        <img v-for="(img, i) in images" :key="i" :src="img" alt="用户图片" class="msg-image" />
      </div>
      <ThinkingBlock
        v-if="!isUser && (reasoning || reasoningLoading)"
        :content="reasoning || ''"
        :loading="reasoningLoading"
      />
      <!-- Tool 调用状态 -->
      <div class="tool-calls" v-if="!isUser && toolCalls && toolCalls.length">
        <details class="tool-call" v-for="(tc, i) in toolCalls" :key="i" :class="{ loading: tc.loading }">
          <summary class="tool-header">
            <span class="tool-icon-wrap">
              <svg v-if="tc.loading" class="tool-spinner" viewBox="0 0 16 16" fill="none">
                <circle cx="8" cy="8" r="6.5" stroke="currentColor" stroke-width="2" stroke-dasharray="30 12" />
              </svg>
              <svg v-else class="tool-icon-svg" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.3">
                <circle cx="8" cy="8" r="6.5" />
                <ellipse cx="8" cy="8" rx="3" ry="6.5" />
                <line x1="1.5" y1="8" x2="14.5" y2="8" />
                <line x1="2.5" y1="5" x2="13.5" y2="5" />
                <line x1="2.5" y1="11" x2="13.5" y2="11" />
              </svg>
            </span>
            <span class="tool-label">Web search:</span>
            <span class="tool-query">{{ tc.query }}</span>
            <span class="tool-expand-hint">{{ tc.loading ? '' : '▶' }}</span>
          </summary>
          <div class="tool-result-text" v-if="tc.result" v-html="marked.parse(tc.result)"></div>
        </details>
      </div>
      <div
        class="content markdown-body"
        v-if="content"
        v-html="renderedContent"
      ></div>
      <!-- 费用信息 -->
      <div class="cost-info" v-if="!isUser && cost">
        <span class="cost-model">{{ model }}</span>
        <span class="cost-sep">|</span>
        <span>↑{{ usage?.prompt_tokens?.toLocaleString() }} ↓{{ usage?.completion_tokens?.toLocaleString() }} tokens</span>
        <span v-if="usage?.cached_tokens" class="cost-cache">缓存 {{ usage.cached_tokens.toLocaleString() }}</span>
        <span class="cost-sep">|</span>
        <span class="cost-total">{{ cost.currency === 'USD' ? '$' : '¥' }}{{ cost.total_cost.toFixed(4) }}</span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.bubble {
  display: flex;
  gap: 0.6rem;
  padding: 0.5rem 1rem;
  max-width: 85%;
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
  font-size: 1.4rem;
  border: 3px solid #000;
  background: #fff;
  flex-shrink: 0;
  line-height: 1;
}

.user .avatar {
  background: #000;
  color: #fff;
}

.body {
  display: flex;
  flex-direction: column;
  gap: 0.3rem;
  min-width: 0;
}

/* 消息中的图片 */
.msg-images {
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem;
}

.msg-image {
  max-width: 200px;
  max-height: 200px;
  border: 3px solid #000;
  object-fit: contain;
  background: #f5f5f5;
}

.content {
  padding: 0.7rem 0.9rem;
  line-height: 1.6;
  word-break: break-word;
  font-size: 0.88rem;
  border: 3px solid #000;
}

.user .content {
  background: #000;
  color: #fff;
}

.assistant .content {
  background: #fff;
  color: #000;
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
  font-weight: 700;
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
  font-weight: 700;
  line-height: 1.3;
  text-transform: uppercase;
  letter-spacing: 0.03em;
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
  background: #f0f0f0;
  padding: 0.15em 0.35em;
  border: 1px solid #000;
  font-size: 0.88em;
  font-family: 'Space Mono', 'Courier New', monospace;
}

/* 代码块 */
.markdown-body :deep(pre) {
  background: #1a1a1a;
  color: #e0e0e0;
  padding: 0.75rem 1rem;
  border: 3px solid #000;
  overflow-x: auto;
  margin: 0.5em 0;
  font-size: 0.82em;
  line-height: 1.5;
}

.markdown-body :deep(pre code) {
  background: none;
  padding: 0;
  border: none;
  color: inherit;
  font-size: inherit;
}

/* 引用 */
.markdown-body :deep(blockquote) {
  border-left: 4px solid #000;
  margin: 0.5em 0;
  padding: 0.3em 0.8em;
  color: #333;
  background: #f5f5f5;
}

/* 分隔线 */
.markdown-body :deep(hr) {
  border: none;
  border-top: 3px solid #000;
  margin: 0.6em 0;
}

/* 链接 */
.markdown-body :deep(a) {
  color: #000;
  text-decoration: underline;
  text-underline-offset: 2px;
  font-weight: 700;
}

.markdown-body :deep(a:hover) {
  background: #000;
  color: #fff;
}

/* 表格 */
.markdown-body :deep(table) {
  border-collapse: collapse;
  width: 100%;
  margin: 0.5em 0;
  font-size: 0.85em;
}

.markdown-body :deep(th),
.markdown-body :deep(td) {
  border: 2px solid #000;
  padding: 0.4em 0.6em;
  text-align: left;
}

.markdown-body :deep(th) {
  background: #000;
  color: #fff;
  font-weight: 700;
  text-transform: uppercase;
}

/* ===== <details> / <summary> 折叠块 ===== */
.markdown-body :deep(details) {
  border: 3px solid #000;
  margin: 0.5em 0;
  overflow: hidden;
}

.markdown-body :deep(summary) {
  padding: 0.45em 0.75em;
  cursor: pointer;
  font-weight: 700;
  background: #f0f0f0;
  user-select: none;
  list-style: none;
  display: flex;
  align-items: center;
  gap: 0.4em;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.markdown-body :deep(summary::before) {
  content: '▶';
  font-size: 0.65em;
  transition: transform 0.1s;
  display: inline-block;
}

.markdown-body :deep(details[open] > summary::before) {
  transform: rotate(90deg);
}

.markdown-body :deep(summary::-webkit-details-marker) {
  display: none;
}

.markdown-body :deep(summary:hover) {
  background: #000;
  color: #fff;
}

.markdown-body :deep(details > *:not(summary)) {
  padding: 0 0.75em;
}

.markdown-body :deep(details > p:last-child) {
  padding-bottom: 0.5em;
}

/* Tool 调用 */
.tool-calls {
  display: flex;
  flex-direction: column;
  gap: 0.3rem;
  width: 100%;
}

.tool-call {
  border: 2px solid #333;
  background: #1a1a1a;
  font-size: 0.8rem;
  border-radius: 4px;
  overflow: hidden;
}

.tool-call.loading {
  border-style: dashed;
  border-color: #555;
}

.tool-header {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 0.7rem;
  cursor: pointer;
  color: #ccc;
  list-style: none;
  user-select: none;
  transition: background 0.15s;
}

.tool-header:hover {
  background: #2a2a2a;
}

.tool-header::-webkit-details-marker {
  display: none;
}

.tool-call[open] .tool-header {
  border-bottom: 1px solid #333;
}

/* Icon 容器 — 固定尺寸，防止旋转晃动 */
.tool-icon-wrap {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 18px;
  height: 18px;
  flex-shrink: 0;
}

.tool-icon-svg {
  width: 14px;
  height: 14px;
  color: #4ade80;
}

.tool-spinner {
  width: 14px;
  height: 14px;
  color: #facc15;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

.tool-label {
  color: #999;
  font-weight: 700;
  font-size: 0.75rem;
  white-space: nowrap;
}

.tool-header .tool-query {
  color: #fff;
  font-weight: 400;
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* 展开/折叠提示箭头 */
.tool-expand-hint {
  font-size: 0.6rem;
  color: #666;
  transition: transform 0.15s;
  flex-shrink: 0;
}

.tool-call[open] .tool-expand-hint {
  transform: rotate(90deg);
}

.tool-results {
  padding: 0.3rem 0.6rem 0.5rem;
  display: flex;
  flex-direction: column;
  gap: 0.15rem;
}

.tool-result-text {
  padding: 0.5rem 0.6rem;
  font-size: 0.75rem;
  max-height: 300px;
  overflow-y: auto;
  color: #ccc;
  font-family: 'Space Mono', monospace;
  line-height: 1.5;
  border-top: 1px solid #333;
}

.tool-result-text :deep(p) {
  margin: 0.3em 0;
}

.tool-result-text :deep(strong) {
  color: #fff;
}

.tool-result-text :deep(a) {
  color: #a78bfa;
  text-decoration: none;
}

.tool-result-text :deep(a:hover) {
  text-decoration: underline;
}

.tool-result-text :deep(ul) {
  padding-left: 1.2em;
  margin: 0.3em 0;
}

.tool-result-text :deep(li) {
  margin: 0.2em 0;
}

.tool-result-item {
  display: flex;
  flex-direction: column;
  gap: 0;
  padding: 0.2rem 0;
}

.result-domain {
  color: #888;
  font-size: 0.7rem;
}

.result-date {
  color: #666;
  font-size: 0.68rem;
  margin-left: 0.5rem;
  display: inline;
}

.result-title {
  color: #a78bfa;
  text-decoration: none;
  font-size: 0.78rem;
  line-height: 1.3;
}

.result-title:hover {
  text-decoration: underline;
}

/* 费用信息 */
.cost-info {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  font-size: 0.72rem;
  color: #888;
  font-family: 'Space Mono', monospace;
  padding: 0.2rem 0;
  flex-wrap: wrap;
}

.cost-model {
  font-weight: 700;
  color: #555;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.cost-sep {
  color: #ccc;
}

.cost-cache {
  background: #f0f0f0;
  border: 1px solid #ccc;
  padding: 0 0.3rem;
  font-size: 0.68rem;
}

.cost-total {
  font-weight: 700;
  color: #000;
  border: 2px solid #000;
  padding: 0 0.3rem;
}
.user .markdown-body :deep(code) {
  background: rgba(255, 255, 255, 0.15);
  color: #fff;
  border-color: #555;
}

.user .markdown-body :deep(pre) {
  background: #222;
  color: #ddd;
  border-color: #555;
}

.user .markdown-body :deep(blockquote) {
  border-left-color: #fff;
  background: rgba(255, 255, 255, 0.1);
  color: #ddd;
}

.user .markdown-body :deep(a) {
  color: #fff;
}

.user .markdown-body :deep(th) {
  background: #333;
  color: #fff;
}

.user .markdown-body :deep(th),
.user .markdown-body :deep(td) {
  border-color: #555;
}
</style>
