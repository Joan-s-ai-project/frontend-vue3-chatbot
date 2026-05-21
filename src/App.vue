<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { sendStreamMessage, isHistorySession, sessionId, loadHistory, loadHistoryList, loadModels } from '@/services'

// 新会话：第一次发消息后把 sessionId 写入 URL，方便分享/定位
function syncSessionIdToUrl() {
  if (isHistorySession) return  // 已经是历史会话，URL 本来就有
  const current = window.location.pathname.replace(/^\/|\/$/g, '')
  if (current !== sessionId) {
    window.history.replaceState(null, '', `/${sessionId}`)
  }
}
import ChatInput from '@/components/ChatInput.vue'
import MessageList from '@/components/MessageList.vue'
import type { Message } from '@/components/MessageList.vue'

const messages = ref<Message[]>([])
const loading = ref(false)

// ── 模型选择 ──────────────────────────────────────────────────────────
interface ModelOption { id: string; label: string; provider: string }
const models = ref<ModelOption[]>([])
const selectedModel = ref('')

// ── 历史会话列表 ──────────────────────────────────────────────────────
interface SessionItem { id: string; title: string; createdAt: number; messageCount: number }
const sessionList = ref<SessionItem[]>([])
const sidebarOpen = ref(false)

async function refreshSessionList() {
  try {
    sessionList.value = await loadHistoryList()
  } catch (err: any) {
    console.error('[App] 加载会话列表失败:', err.message)
  }
}

function openSession(id: string) {
  window.location.href = `/${id}`
}

function newSession() {
  window.location.href = '/'
}

/**
 * 将后端 JSONL 格式的历史消息映射为前端 Message 格式
 */
function mapHistoryToMessages(history: any[]): Message[] {
  const result: Message[] = []
  let idCounter = 0

  for (const item of history) {
    // 跳过 system 消息
    if (item.role === 'system') continue

    // done 事件：把 usage/cost/model 回填到上一条 assistant 消息
    if (item.type === 'done') {
      const lastAi = [...result].reverse().find(m => !m.isUser)
      if (lastAi) {
        if (item.cost)  lastAi.cost  = item.cost
        if (item.usage) lastAi.usage = item.usage
        if (item.model) lastAi.model = item.model
      }
      continue
    }

    const msg: Message = {
      id: idCounter++,
      content: item.content || '',
      isUser: item.role === 'user',
    }

    // assistant 消息可能有 reasoning、model、toolActivities
    if (item.role === 'assistant') {
      if (item.reasoning) {
        msg.reasoning = item.reasoning
      }
      if (item.model) {
        msg.model = item.model
      }
      if (item.toolActivities && item.toolActivities.length > 0) {
        msg.toolCalls = item.toolActivities.map((ta: any) => ({
          name: ta.toolName,
          query: ta.input?.query || undefined,
          command: ta.input?.command || undefined,
          result: ta.result || '',
          loading: false,
        }))
      }
    }

    result.push(msg)
  }

  return result
}

onMounted(async () => {
  // 加载可用模型列表
  try {
    const list = await loadModels()
    models.value = list
    if (list.length > 0) selectedModel.value = list[0].id
  } catch (err: any) {
    console.error('[App] 加载模型列表失败:', err.message)
  }

  // 加载历史会话列表
  await refreshSessionList()

  if (isHistorySession) {
    try {
      const history = await loadHistory(sessionId)
      messages.value = mapHistoryToMessages(history)

      // 从历史数据找最后一条有 model 的 assistant 消息，恢复模型选择
      const lastModelEntry = [...history].reverse().find(
        (item: any) => item.role === 'assistant' && item.model
      )
      if (lastModelEntry?.model) {
        // 等模型列表加载完再匹配，如果列表里有就用，没有就保持默认
        const matched = models.value.find(m => m.id === lastModelEntry.model)
        if (matched) selectedModel.value = matched.id
      }
    } catch (err: any) {
      console.error('[App] 加载历史失败:', err.message)
    }
  }
})

async function handleSend(text: string, images: string[] = []) {
  // 新会话第一次发消息时，把 sessionId 同步到 URL
  syncSessionIdToUrl()

  messages.value.push({
    id: Date.now(),
    content: text,
    isUser: true,
    images: images.length > 0 ? images : undefined,
  })

  messages.value.push({
    id: Date.now() + 1,
    content: '',
    isUser: false,
    reasoning: '',
    reasoningLoading: true
  })
  const aiMsg = messages.value[messages.value.length - 1]
  loading.value = true

  try {
    await sendStreamMessage(text, images, {
      onReasoning(chunk) {
        aiMsg.reasoning += chunk
      },
      onContent(chunk) {
        aiMsg.reasoningLoading = false
        aiMsg.content += chunk
      },
      onSearching(query) {
        if (!aiMsg.toolCalls) aiMsg.toolCalls = []
        aiMsg.toolCalls.push({ name: 'search_web', query, loading: true })
      },
      onBashRunning(command) {
        if (!aiMsg.toolCalls) aiMsg.toolCalls = []
        aiMsg.toolCalls.push({ name: 'run_bash', command, loading: true })
      },
      onToolResult(data) {
        if (!aiMsg.toolCalls) return
        // search_web 用 query 匹配，run_bash 用 command 匹配
        const tc = aiMsg.toolCalls.find(t => {
          if (t.loading === false) return false
          if (data.name === 'search_web') return t.name === 'search_web' && t.query === data.query
          if (data.name === 'run_bash') return t.name === 'run_bash' && t.command === data.command
          return false
        })
        if (tc) {
          tc.result = data.result
          tc.loading = false
        }
      },
      onDone(data) {
        aiMsg.reasoningLoading = false
        aiMsg.cost = data.cost
        aiMsg.usage = data.usage
        aiMsg.model = data.model
        loading.value = false
      },
      onError(msg, code) {
        aiMsg.content = code ? `❌ [${code}] ${msg}` : `❌ ${msg}`
        aiMsg.reasoningLoading = false
        loading.value = false
      }
    }, selectedModel.value || undefined)
  } catch (err: any) {
    aiMsg.content = `❌ ${err.message}`
    aiMsg.reasoningLoading = false
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div id="app">
    <!-- 侧边栏遮罩 -->
    <div v-if="sidebarOpen" class="sidebar-overlay" @click="sidebarOpen = false" />

    <!-- 侧边栏 -->
    <aside :class="['sidebar', { 'sidebar--open': sidebarOpen }]">
      <div class="sidebar-header">
        <span class="sidebar-title">SESSIONS</span>
        <button class="sidebar-close" @click="sidebarOpen = false">✕</button>
      </div>
      <button class="new-session-btn" @click="newSession">+ NEW SESSION</button>
      <ul class="session-list">
        <li
          v-for="s in sessionList"
          :key="s.id"
          :class="['session-item', { 'session-item--active': s.id === sessionId }]"
          @click="openSession(s.id)"
        >
          <div class="session-title">{{ s.title || '新对话' }}</div>
        </li>
      </ul>
    </aside>

    <!-- 顶栏 -->
    <header class="header">
      <div class="header-left">
        <button class="menu-btn" @click="sidebarOpen = !sidebarOpen" title="会话列表">☰</button>
        <div class="header-title">
          <span class="logo">■</span>
          <h1>AI CHAT</h1>
        </div>
      </div>
      <select v-if="models.length > 0" v-model="selectedModel" class="model-select">
        <option v-for="m in models" :key="m.id" :value="m.id">{{ m.label }}</option>
      </select>
      <span v-else class="header-badge">LOADING...</span>
    </header>

    <!-- 空状态欢迎页 -->
    <div v-if="messages.length === 0" class="welcome">
      <div class="welcome-icon">▓</div>
      <h2>你好，欢迎使用 AI CHAT</h2>
      <p>输入任何问题，开始对话吧</p>
      <div class="welcome-tips">
        <div class="tip" @click="handleSend('用简单的话解释什么是量子计算', [])">→ 用简单的话解释什么是量子计算</div>
        <div class="tip" @click="handleSend('写一首关于春天的诗', [])">→ 写一首关于春天的诗</div>
        <div class="tip" @click="handleSend('帮我列一个周末旅行清单', [])">→ 帮我列一个周末旅行清单</div>
      </div>
    </div>

    <!-- 消息列表 -->
    <MessageList v-else :messages="messages" />

    <!-- 输入框 -->
    <div class="input-wrapper">
      <ChatInput @send="(msg, imgs) => handleSend(msg, imgs)" />
      <p class="disclaimer">AI 生成内容仅供参考</p>
    </div>
  </div>
</template>

<style>
@import url('https://fonts.googleapis.com/css2?family=Space+Mono:wght@400;700&display=swap');

* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body {
  font-family: 'Space Mono', 'Courier New', monospace;
  background: #f0f0f0;
  color: #000;
  min-height: 100vh;
}

#app {
  display: flex;
  flex-direction: column;
  height: 100vh;
  width: 100%;
  background: #fff;
}

/* 顶栏 */
.header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 1.2rem;
  height: 55px;
  flex-shrink: 0;
  background: #000;
  color: #fff;
  border-bottom: 4px solid #000;
}

.header-left {
  display: flex;
  align-items: center;
  gap: 0.8rem;
}

.menu-btn {
  background: none;
  border: none;
  color: #fff;
  font-size: 1.3rem;
  cursor: pointer;
  padding: 0 0.2rem;
  line-height: 1;
}

.menu-btn:hover {
  opacity: 0.7;
}

.header-title {
  display: flex;
  align-items: center;
  gap: 0.6rem;
}

.header-title h1 {
  font-size: 1.1rem;
  font-weight: 700;
  letter-spacing: 0.15em;
  text-transform: uppercase;
}

.logo {
  font-size: 1.3rem;
}

.header-badge {
  font-size: 0.7rem;
  font-weight: 700;
  background: #fff;
  color: #000;
  padding: 0.25rem 0.6rem;
  border: none;
  letter-spacing: 0.1em;
  font-family: 'Courier New', monospace;
}

.model-select {
  font-size: 0.7rem;
  font-weight: 700;
  font-family: 'Space Mono', 'Courier New', monospace;
  background: #fff;
  color: #000;
  border: none;
  padding: 0.25rem 0.5rem;
  letter-spacing: 0.05em;
  cursor: pointer;
  outline: none;
  text-transform: uppercase;
  appearance: none;
  -webkit-appearance: none;
  /* 自定义下拉箭头 */
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6'%3E%3Cpath d='M0 0l5 6 5-6z' fill='%23000'/%3E%3C/svg%3E");
  background-repeat: no-repeat;
  background-position: right 0.4rem center;
  padding-right: 1.4rem;
}

.model-select:hover {
  background-color: #e0e0e0;
}

/* 欢迎页 */
.welcome {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.8rem;
  padding: 2rem;
}

.welcome-icon {
  font-size: 4rem;
  line-height: 1;
}

.welcome h2 {
  font-size: 1.3rem;
  font-weight: 700;
  color: #000;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.welcome p {
  color: #555;
  font-size: 0.85rem;
}

.welcome-tips {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  margin-top: 1.5rem;
  width: 100%;
  max-width: 420px;
}

.tip {
  padding: 0.75rem 1rem;
  background: #fff;
  border: 3px solid #000;
  font-size: 0.85rem;
  color: #000;
  cursor: pointer;
  transition: all 0.1s;
  font-family: inherit;
}

.tip:hover {
  background: #000;
  color: #fff;
  transform: translate(-2px, -2px);
  box-shadow: 4px 4px 0 #000;
}

/* 输入区域 */
.input-wrapper {
  background: #fff;
  border-top: 4px solid #000;
}

.disclaimer {
  text-align: center;
  font-size: 0.7rem;
  color: #999;
  padding: 0.2rem 0 0.6rem;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

/* 侧边栏遮罩 */
.sidebar-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.3);
  z-index: 100;
}

/* 侧边栏 */
.sidebar {
  position: fixed;
  top: 0;
  left: 0;
  height: 100vh;
  width: 300px;
  background: #f5f5f5;
  color: #000;
  z-index: 101;
  display: flex;
  flex-direction: column;
  transform: translateX(-100%);
  transition: transform 0.22s cubic-bezier(0.4, 0, 0.2, 1);
  border-right: 4px solid #000;
}

.sidebar--open {
  transform: translateX(0);
}

.sidebar-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 1.2rem;
  height: 55px;
  flex-shrink: 0;
  background: #000;
  color: #fff;
  border-bottom: 4px solid #000;
}

.sidebar-title {
  font-size: 0.75rem;
  font-weight: 700;
  letter-spacing: 0.2em;
  color: #fff;
  text-transform: uppercase;
}

.sidebar-close {
  background: none;
  border: none;
  color: #fff;
  font-size: 1.2rem;
  cursor: pointer;
  padding: 0;
  transition: all 0.1s;
}

.sidebar-close:hover {
  transform: scale(1.2);
}

.new-session-btn {
  margin: 1rem 0.8rem 0.6rem;
  padding: 0.75rem 1rem;
  background: #000;
  color: #fff;
  border: 4px solid #000;
  font-family: 'Space Mono', 'Courier New', monospace;
  font-size: 0.75rem;
  font-weight: 700;
  letter-spacing: 0.1em;
  cursor: pointer;
  text-align: center;
  text-transform: uppercase;
  transition: all 0.1s;
}

.new-session-btn:hover {
  background: #fff;
  color: #000;
  transform: translate(-3px, -3px);
  box-shadow: 6px 6px 0 #000;
}

.new-session-btn:active {
  transform: translate(0, 0);
  box-shadow: 0 0 0 #000;
}

.session-list {
  list-style: none;
  overflow-y: auto;
  flex: 1;
  padding: 0.8rem 0.6rem 1rem;
}

.session-list::-webkit-scrollbar {
  width: 6px;
}
.session-list::-webkit-scrollbar-track {
  background: #e8e8e8;
}
.session-list::-webkit-scrollbar-thumb {
  background: #000;
}

.session-item {
  padding: 0.7rem 0.8rem;
  cursor: pointer;
  border: 3px solid #ddd;
  transition: all 0.1s;
  margin-bottom: 6px;
  background: #fff;
}

.session-item:hover {
  border-color: #000;
  background: #f0f0f0;
  transform: translate(-2px, -2px);
  box-shadow: 4px 4px 0 #000;
}

.session-item--active {
  background: #000;
  border-color: #000;
  box-shadow: 4px 4px 0 #000;
}

.session-title {
  font-size: 0.78rem;
  font-weight: 700;
  color: #000;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  letter-spacing: 0.02em;
}

.session-item--active .session-title {
  color: #fff;
}
</style>
