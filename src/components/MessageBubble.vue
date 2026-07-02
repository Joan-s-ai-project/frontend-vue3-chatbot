<script setup lang="ts">
import { computed, ref, nextTick, watch, onMounted } from 'vue'
import { marked } from 'marked'
import ThinkingBlock from './ThinkingBlock.vue'
import type { ContentBlock } from './MessageList.vue'

const props = defineProps<{
  content: string
  isUser: boolean
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
}>()

marked.setOptions({ breaks: true })

const renderedContent = computed(() => {
  if (!props.content) return ''
  const isStreaming = props.blocks?.some(b => b.kind === 'thinking' && b.loading) ?? false
  const raw = isStreaming ? props.content + '\n\n' : props.content
  return marked.parse(raw) as string
})

// ——— 代码块复制按钮 ———
const bubbleRef = ref<HTMLElement | null>(null)

function attachCopyButtons(container: HTMLElement | null) {
  if (!container) return
  const blocks = container.querySelectorAll<HTMLPreElement>('pre')
  blocks.forEach(pre => {
    // 避免重复注入
    if (pre.querySelector('.code-copy-btn')) return

    // 确保 pre 有 position:relative
    pre.style.position = 'relative'

    const btn = document.createElement('button')
    btn.className = 'code-copy-btn'
    btn.title = '复制代码'
    btn.innerHTML = `
      <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" width="13" height="13">
        <rect x="5" y="1" width="9" height="11" rx="1" />
        <rect x="1" y="4" width="9" height="11" rx="1" />
      </svg>`

    btn.addEventListener('click', async () => {
      const code = pre.querySelector('code')?.innerText ?? pre.innerText
      try {
        if (navigator.clipboard && window.isSecureContext) {
          await navigator.clipboard.writeText(code)
        } else {
          const el = document.createElement('textarea')
          el.value = code
          el.style.cssText = 'position:fixed;top:-9999px;left:-9999px;opacity:0'
          document.body.appendChild(el)
          el.focus(); el.select()
          document.execCommand('copy')
          document.body.removeChild(el)
        }
        btn.classList.add('copied')
        btn.innerHTML = `
          <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2" width="13" height="13">
            <polyline points="2,8 6,12 14,4" />
          </svg>`
        setTimeout(() => {
          btn.classList.remove('copied')
          btn.innerHTML = `
            <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" width="13" height="13">
              <rect x="5" y="1" width="9" height="11" rx="1" />
              <rect x="1" y="4" width="9" height="11" rx="1" />
            </svg>`
        }, 1500)
      } catch { /* ignore */ }
    })

    pre.appendChild(btn)
  })
}

// 内容变化时（流式更新）重新注入
watch(renderedContent, () => {
  nextTick(() => attachCopyButtons(bubbleRef.value))
})

// blocks 变化时（tool/content块）也重新注入
watch(() => props.blocks, () => {
  nextTick(() => attachCopyButtons(bubbleRef.value))
}, { deep: true })

onMounted(() => {
  nextTick(() => attachCopyButtons(bubbleRef.value))
})

/** 格式化 createdAt 为 MM/DD HH:MM */
const formattedTime = computed(() => {
  if (!props.createdAt) return ''
  const d = new Date(props.createdAt)
  const mm = (d.getMonth() + 1).toString().padStart(2, '0')
  const dd = d.getDate().toString().padStart(2, '0')
  const hh = d.getHours().toString().padStart(2, '0')
  const mi = d.getMinutes().toString().padStart(2, '0')
  return `${mm}/${dd} ${hh}:${mi}`
})

/** 格式化 duration（毫秒）为 Xm Ys 或 Xs */
const formattedDuration = computed(() => {
  if (!props.duration) return ''
  const totalSeconds = Math.round(props.duration / 1000)
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return minutes > 0 ? `${minutes}m ${seconds}s` : `${seconds}s`
})

const userContent = computed(() => props.content ?? '')

const copied = ref(false)
async function copyUserContent() {
  const text = userContent.value
  if (!text) return

  const markDone = () => {
    copied.value = true
    setTimeout(() => { copied.value = false }, 1500)
  }

  if (navigator.clipboard && window.isSecureContext) {
    await navigator.clipboard.writeText(text)
    markDone()
  } else {
    // fallback：创建临时 textarea 选中复制
    const el = document.createElement('textarea')
    el.value = text
    el.style.cssText = 'position:fixed;top:-9999px;left:-9999px;opacity:0'
    document.body.appendChild(el)
    el.focus()
    el.select()
    const ok = document.execCommand('copy')
    document.body.removeChild(el)
    if (ok) markDone()
  }
}
</script>

<template>
  <div class="bubble" :class="{ user: isUser, assistant: !isUser }" ref="bubbleRef">
    <div class="avatar-col">
      <div class="avatar">{{ isUser ? '█' : '░' }}</div>
      <span v-if="formattedTime" class="msg-time">{{ formattedTime }}</span>
    </div>
    <div class="body">
      <!-- 用户消息中的图片 -->
      <div class="msg-images" v-if="isUser && images && images.length">
        <img v-for="(img, i) in images" :key="i" :src="img" alt="用户图片" class="msg-image" />
      </div>
      <!-- 用户消息中的附件：保持原始顺序，图片有 dataUrl 才显示缩略图，否则降级为文件卡片 -->
      <div class="msg-attachments" v-if="isUser && attachments && attachments.length">
        <div v-for="(att, i) in attachments" :key="i" class="msg-attachment">
          <!-- 图片且有 dataUrl：显示缩略图 -->
          <template v-if="att.type === 'image' && att.dataUrl">
            <img :src="att.dataUrl" :alt="att.name" class="msg-att-image" />
          </template>
          <!-- 文档，或图片但无 dataUrl（历史记录）：文件卡片 -->
          <template v-else>
            <div class="msg-att-icon-block">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                <polyline points="14 2 14 8 20 8"/>
              </svg>
            </div>
            <span class="msg-att-name">{{ att.name }}</span>
          </template>
        </div>
      </div>
      <!-- 等待第一个 token：空 assistant bubble 时显示 typing indicator -->
      <div
        v-if="!isUser && !content && (!blocks || blocks.length === 0) && !stopped"
        class="typing-indicator"
        aria-label="正在思考"
      >
        <span></span><span></span><span></span>
      </div>

      <!-- 有序内容块：thinking 和 tool 按实际产生顺序交替渲染 -->
      <template v-if="!isUser && blocks && blocks.length">
        <template v-for="(block, idx) in blocks" :key="idx">
          <!-- thinking 块 -->
          <ThinkingBlock
            v-if="block.kind === 'thinking'"
            :content="block.content"
            :loading="block.loading"
          />
          <!-- content 块（中间轮的文字回复） -->
          <div
            v-else-if="block.kind === 'content'"
            class="content markdown-body"
            v-html="marked.parse(block.content)"
          ></div>
          <!-- search_web tool -->
          <details
            v-else-if="block.kind === 'tool' && block.name === 'search_web'"
            class="tool-call"
            :class="{ loading: block.loading }"
          >
            <summary class="tool-header">
              <span class="tool-icon-wrap">
                <svg v-if="block.loading" class="tool-spinner" viewBox="0 0 16 16" fill="none">
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
              <span class="tool-query">{{ block.query }}</span>
              <span class="tool-expand-hint">{{ block.loading ? '' : '▶' }}</span>
            </summary>
            <div class="tool-result-text" v-if="block.result" v-html="marked.parse(block.result)"></div>
          </details>
          <!-- run_bash tool -->
          <details
            v-else-if="block.kind === 'tool' && block.name === 'run_bash'"
            class="tool-call"
            :class="{ loading: block.loading }"
          >
            <summary class="tool-header tool-header--bash">
              <span class="tool-icon-wrap">
                <svg v-if="block.loading" class="tool-spinner tool-spinner--bash" viewBox="0 0 16 16" fill="none">
                  <circle cx="8" cy="8" r="6.5" stroke="currentColor" stroke-width="2" stroke-dasharray="30 12" />
                </svg>
                <span v-else class="tool-bash-icon">$</span>
              </span>
              <span class="tool-label tool-label--bash">Bash:</span>
              <span class="tool-query tool-query--bash">{{ block.command }}</span>
              <span class="tool-expand-hint">{{ block.loading ? '' : '▶' }}</span>
            </summary>
            <div class="tool-result-text tool-result-bash" v-if="block.result" v-html="marked.parse(block.result)"></div>
          </details>
          <!-- memory_search tool -->
          <details
            v-else-if="block.kind === 'tool' && block.name === 'memory_search'"
            class="tool-call tool-call--memory"
            :class="{ loading: block.loading }"
          >
            <summary class="tool-header tool-header--memory">
              <span class="tool-icon-wrap">
                <svg v-if="block.loading" class="tool-spinner tool-spinner--memory" viewBox="0 0 16 16" fill="none">
                  <circle cx="8" cy="8" r="6.5" stroke="currentColor" stroke-width="2" stroke-dasharray="30 12" />
                </svg>
                <svg v-else class="tool-icon-svg tool-icon-svg--memory" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4">
                  <ellipse cx="8" cy="5" rx="6" ry="2.5" />
                  <path d="M2 5v3c0 1.38 2.69 2.5 6 2.5S14 9.38 14 8V5" />
                  <path d="M2 8v3c0 1.38 2.69 2.5 6 2.5S14 12.38 14 11V8" />
                </svg>
              </span>
              <span class="tool-label tool-label--memory">Memory:</span>
              <span class="tool-query tool-query--memory">{{ block.query }}</span>
              <span class="tool-expand-hint">{{ block.loading ? '' : '▶' }}</span>
            </summary>
            <div class="tool-result-text" v-if="block.result" v-html="marked.parse(block.result)"></div>
          </details>
          <!-- memory_save tool -->
          <div
            v-else-if="block.kind === 'tool' && block.name === 'memory_save'"
            class="tool-call tool-call--memory-save"
            :class="{ loading: block.loading }"
          >
            <span class="tool-icon-wrap">
              <svg v-if="block.loading" class="tool-spinner tool-spinner--memory" viewBox="0 0 16 16" fill="none">
                <circle cx="8" cy="8" r="6.5" stroke="currentColor" stroke-width="2" stroke-dasharray="30 12" />
              </svg>
              <svg v-else viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4" class="tool-icon-svg tool-icon-svg--memory">
                <path d="M13 2H3a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1V3a1 1 0 0 0-1-1z"/>
                <polyline points="5,2 5,7 11,7 11,2"/>
                <polyline points="5,12 5,9 11,9 11,12"/>
              </svg>
            </span>
            <span class="tool-label tool-label--memory">{{ block.loading ? 'Saving memory...' : 'Memory saved' }}</span>
          </div>
          <!-- browser tool -->
          <details
            v-else-if="block.kind === 'tool' && block.name === 'browser'"
            class="tool-call tool-call--browser"
            :class="{ loading: block.loading }"
          >
            <summary class="tool-header tool-header--browser">
              <span class="tool-icon-wrap">
                <svg v-if="block.loading" class="tool-spinner tool-spinner--browser" viewBox="0 0 16 16" fill="none">
                  <circle cx="8" cy="8" r="6.5" stroke="currentColor" stroke-width="2" stroke-dasharray="30 12" />
                </svg>
                <svg v-else class="tool-icon-svg tool-icon-svg--browser" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4">
                  <rect x="1" y="2" width="14" height="12" rx="1.5"/>
                  <line x1="1" y1="6" x2="15" y2="6"/>
                  <circle cx="4" cy="4" r="0.8" fill="currentColor" stroke="none"/>
                  <circle cx="7" cy="4" r="0.8" fill="currentColor" stroke="none"/>
                  <circle cx="10" cy="4" r="0.8" fill="currentColor" stroke="none"/>
                </svg>
              </span>
              <span class="tool-label tool-label--browser">Browser:</span>
              <span class="tool-query tool-query--browser">{{ block.query }}</span>
              <span class="tool-expand-hint">{{ block.loading ? '' : '▶' }}</span>
            </summary>
            <!-- 截图直接渲染图片 -->
            <template v-if="block.result">
              <div v-if="block.result.includes('[IMAGE:data:image')" class="tool-result-browser-screenshot">
                <img :src="block.result.match(/\[IMAGE:(data:image\/[^\]]+)\]/)?.[1]" alt="screenshot" class="browser-screenshot-img" />
              </div>
              <div v-else class="tool-result-text" v-html="marked.parse(block.result.replace(/\[IMAGE:[^\]]+\]/g, ''))"></div>
            </template>
          </details>
        </template>
      </template>
      <!-- Tool 调用状态 -->
      <div class="tool-calls" v-if="false"><!-- legacy slot, now rendered via blocks --></div>
      <!-- 用户消息：纯文本，不渲染 HTML/Markdown，防止注入 -->
      <div
        v-if="content && isUser"
        class="user-content-wrap"
      >
        <div class="content user-text">{{ userContent }}</div>
        <button
          class="copy-btn"
          :class="{ copied }"
          @click="copyUserContent"
          :title="copied ? '已复制' : '复制'"
        >
          <svg v-if="!copied" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5">
            <rect x="5" y="1" width="9" height="11" rx="1" />
            <rect x="1" y="4" width="9" height="11" rx="1" />
          </svg>
          <svg v-else viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="2,8 6,12 14,4" />
          </svg>
        </button>
      </div>
      <!-- AI 消息：Markdown 渲染 -->
      <div
        v-else-if="content && !isUser"
        class="content markdown-body"
        v-html="renderedContent"
      ></div>
      <!-- 中止标记 -->
      <div class="stopped-badge" v-if="!isUser && stopped">⏹ 已停止生成</div>
      <!-- 费用信息 -->
      <div class="cost-info" v-if="!isUser && cost">
        <span class="cost-model">{{ model }}</span>
        <span class="cost-sep">|</span>
        <span>↑{{ usage?.prompt_tokens?.toLocaleString() }} ↓{{ usage?.completion_tokens?.toLocaleString() }} tokens</span>
        <span v-if="usage?.cached_tokens" class="cost-cache">缓存 {{ usage.cached_tokens.toLocaleString() }}</span>
        <span class="cost-sep">|</span>
        <span v-if="toolCallsCount" class="cost-tools">🔧 {{ toolCallsCount }} calls</span>
        <span v-if="messageCount" class="cost-msgs">💬 {{ messageCount }} msgs</span>
        <span v-if="toolCallsCount || messageCount" class="cost-sep">|</span>
        <span class="cost-total">{{ cost.currency === 'USD' ? '$' : '¥' }}{{ cost.total_cost.toFixed(4) }}</span>
        <template v-if="formattedDuration">
          <span class="cost-sep">|</span>
          <span class="cost-duration">⏱ {{ formattedDuration }}</span>
        </template>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* ── Typing indicator (brutalist) ── */
.typing-indicator {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 0.5rem 0.75rem;
  border: 3px solid #000;
  background: #fff;
}

.typing-indicator span {
  display: block;
  width: 7px;
  height: 7px;
  background: #000;
  opacity: 0.1;
  animation: brutal-wave 1.4s ease-in-out infinite;
}

.typing-indicator span:nth-child(2) { animation-delay: 0.28s; }
.typing-indicator span:nth-child(3) { animation-delay: 0.56s; }

@keyframes brutal-wave {
  0%, 100% { opacity: 0.1; }
  40%       { opacity: 1; }
}

.stopped-badge {
  margin-top: 0.4rem;
  font-size: 0.75rem;
  color: #999;
}

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

.avatar-col {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.15rem;
  flex-shrink: 0;
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

.msg-time {
  font-size: 0.55rem;
  color: #999;
  font-family: 'Space Mono', monospace;
  white-space: nowrap;
  letter-spacing: -0.02em;
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
  max-width: 100%;
  overflow: hidden;
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

/* 消息中的附件 */
.msg-attachments {
  display: flex;
  flex-direction: column;
  gap: 0.3rem;
  margin-bottom: 0.25rem;
  align-items: flex-end;
}

.msg-attachment {
  display: inline-flex;
  align-items: stretch;
  gap: 0;
  border: 3px solid #000;
  background: #f5f5f5;
}

/* 图片缩略图（当前会话有 dataUrl） */
.msg-att-image {
  width: 140px;
  height: 140px;
  object-fit: cover;
  display: block;
  border: 3px solid #000;
}

/* 文件图标 */
.msg-att-icon-block {
  width: 36px;
  height: 36px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  border-right: 3px solid #000;
  background: #e8e8e8;
  color: #000;
}

.msg-att-icon-block svg {
  width: 18px;
  height: 18px;
}

/* 文件名 */
.msg-att-name {
  font-size: 0.78rem;
  font-family: 'Space Mono', 'Courier New', monospace;
  font-weight: 700;
  color: #000;
  white-space: normal;
  word-break: break-all;
  line-height: 1.4;
  padding: 0.2rem 0.5rem;
  align-self: center;
}

.content {
  padding: 0.4rem 0.6rem;
  line-height: 1.6;
  word-break: break-word;
  font-size: 0.88rem;
  border: 3px solid #000;
}

.user .content {
  background: #000;
  color: #fff;
}

/* 用户消息纯文本：保留换行，不渲染 HTML */
.user-text {
  white-space: pre-wrap;
}

/* 用户消息 wrapper，hover 时显示复制按钮 */
.user-content-wrap {
  position: relative;
  display: inline-flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 0.3rem;
}

.copy-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 20px;
  padding: 3px;
  background: #fff;
  border: 2px solid #000;
  cursor: pointer;
  transition: background 0.15s;
  color: #000;
  border-radius: 2px;
  align-self: flex-end;
}

.copy-btn:hover {
  background: #f0f0f0;
}

.copy-btn svg {
  width: 11px;
  height: 11px;
}

.copy-btn.copied {
  border-color: #16a34a;
  color: #16a34a;
  background: #f0fdf4;
}

.user-content-wrap:hover .copy-btn {
  opacity: 1;
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

/* 图片自适应宽度 */
.markdown-body :deep(img) {
  max-width: 100%;
  height: auto;
  display: block;
  border: 2px solid #000;
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
  max-width: 100%;
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

.cost-tools {
  color: #888;
  font-size: 0.68rem;
}

.cost-msgs {
  color: #888;
  font-size: 0.68rem;
}

.cost-total {
  font-weight: 700;
  color: #000;
  border: 2px solid #000;
  padding: 0 0.3rem;
}

.cost-duration {
  font-weight: 700;
  color: #555;
  font-size: 0.68rem;
}
.tool-result-bash {
  font-family: 'Space Mono', 'Courier New', monospace;
}

.tool-result-bash :deep(pre) {
  background: #0d0d0d;
  color: #00ff88;
  border: none;
  margin: 0;
  padding: 0.5rem 0.6rem;
  font-size: 0.78rem;
  white-space: pre-wrap;
  word-break: break-all;
}

.tool-result-bash :deep(code) {
  background: none;
  border: none;
  color: inherit;
}

.tool-result-bash :deep(p) {
  margin: 0.2em 0;
  font-size: 0.75rem;
  color: #aaa;
}

.tool-result-bash :deep(strong) {
  color: #7dd3fc;
  font-weight: 700;
}

.tool-header--bash {
  background: #0d1117;
  border-bottom: 1px solid #1e2a1e;
}

.tool-header--bash:hover {
  background: #161b22;
}

.tool-label--bash {
  color: #4ade80;
}

.tool-query--bash {
  color: #7dd3fc;
  font-family: 'Space Mono', monospace;
}

.tool-bash-icon {
  font-size: 0.9rem;
  font-weight: 700;
  color: #4ade80;
  font-family: 'Space Mono', monospace;
  line-height: 1;
}

.tool-spinner--bash {
  color: #4ade80;
}
/* Browser 工具样式 */
.tool-call--browser {
  border-color: #0ea5e9;
  background: #0c1a2e;
}

.tool-call--browser.loading {
  border-style: dashed;
  border-color: #0284c7;
}

.tool-header--browser {
  background: #0c1a2e;
  border-bottom: 1px solid #1e3a5f;
}

.tool-header--browser:hover {
  background: #112240;
}

.tool-label--browser {
  color: #38bdf8;
}

.tool-query--browser {
  color: #bae6fd;
  font-family: 'Space Mono', monospace;
}

.tool-icon-svg--browser {
  color: #38bdf8;
}

.tool-spinner--browser {
  color: #38bdf8;
}

.tool-result-browser-screenshot {
  padding: 0.5rem;
  background: #000;
  border-top: 1px solid #1e3a5f;
  overflow: hidden;
}

.browser-screenshot-img {
  max-width: 100%;
  width: 100%;
  height: auto;
  display: block;
  border: 1px solid #1e3a5f;
  object-fit: contain;
}

/* Memory 工具样式 */
.tool-call--memory {
  border-color: #7c3aed;
  background: #1a1030;
}

.tool-call--memory.loading {
  border-style: dashed;
  border-color: #6d28d9;
}

.tool-header--memory {
  background: #1a1030;
  border-bottom: 1px solid #3b1f6e;
}

.tool-header--memory:hover {
  background: #231545;
}

.tool-label--memory {
  color: #a78bfa;
}

.tool-query--memory {
  color: #ddd6fe;
  font-family: 'Space Mono', monospace;
}

.tool-icon-svg--memory {
  color: #a78bfa;
}

.tool-spinner--memory {
  color: #a78bfa;
}

/* memory_save 内联样式（不可展开） */
.tool-call--memory-save {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.45rem 0.7rem;
  border: 2px dashed #6d28d9;
  background: #1a1030;
  border-radius: 4px;
  font-size: 0.8rem;
}

/* ===== 代码块复制按钮 ===== */
:deep(.code-copy-btn) {
  position: absolute;
  top: 0.35rem;
  right: 0.35rem;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  padding: 0;
  background: #2e2e2e;
  border: 1.5px solid #555;
  border-radius: 3px;
  cursor: pointer;
  color: #aaa;
  opacity: 0;
  transition: opacity 0.15s, background 0.15s, color 0.15s, border-color 0.15s;
  z-index: 1;
}

:deep(pre:hover .code-copy-btn) {
  opacity: 1;
}

:deep(.code-copy-btn:hover) {
  background: #444;
  color: #fff;
  border-color: #888;
}

:deep(.code-copy-btn.copied) {
  background: #14532d;
  border-color: #16a34a;
  color: #4ade80;
  opacity: 1;
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
