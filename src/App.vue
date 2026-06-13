<script setup lang="ts">
import { ref, onMounted, nextTick } from 'vue'
import { sendStreamMessage, stopGeneration, isHistorySession, isReplaySession, sessionId, loadHistory, loadHistoryList, loadModels, loadTools, deleteSession, replaySession } from '@/services'
import type { AttachmentResult } from '@/services'

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

const messageListRef = ref<InstanceType<typeof MessageList> | null>(null)
const chatInputRef = ref<InstanceType<typeof ChatInput> | null>(null)

const messages = ref<Message[]>([])
const loading = ref(false)
const toastMessage = ref('')
const toastVisible = ref(false)

function showToast(msg: string, duration = 2000) {
  toastMessage.value = msg
  toastVisible.value = true
  setTimeout(() => { toastVisible.value = false }, duration)
}

// ── 模型选择 ──────────────────────────────────────────────────────────
interface ModelOption { id: string; label: string; provider: string }
const models = ref<ModelOption[]>([])
const selectedModel = ref('')

// ── 工具开关 ──────────────────────────────────────────────────────────
interface ToolInfo { id: string; label: string }
const availableTools = ref<ToolInfo[]>([])

/** 从 localStorage 恢复；key 不在可用列表里会被忽略 */
function loadEnabledSet(tools: ToolInfo[]): Set<string> {
  try {
    const stored = localStorage.getItem('disabledToolIds')
    const disabled = stored ? new Set<string>(JSON.parse(stored)) : new Set<string>()
    return new Set(tools.map(t => t.id).filter(id => !disabled.has(id)))
  } catch {
    return new Set(tools.map(t => t.id))
  }
}

const enabledToolIds = ref<Set<string>>(new Set())

function toggleTool(id: string) {
  const next = new Set(enabledToolIds.value)
  if (next.has(id)) { next.delete(id) } else { next.add(id) }
  enabledToolIds.value = next
  // 持久化禁用集合
  const disabled = availableTools.value.map(t => t.id).filter(tid => !next.has(tid))
  localStorage.setItem('disabledToolIds', JSON.stringify(disabled))
}

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

async function handleDeleteSession(id: string, event: Event) {
  event.stopPropagation() // 阻止触发 openSession
  
  if (!confirm('确定要删除这个会话吗？')) {
    return
  }
  
  try {
    await deleteSession(id)
    
    // 从列表中移除该会话
    sessionList.value = sessionList.value.filter(s => s.id !== id)
    
    // 如果删除的是当前会话，清空消息列表并重置为新会话
    if (id === sessionId) {
      messages.value = []
      chatInputRef.value?.clearAll()
      // 不刷新页面，只更新 URL
      window.history.replaceState(null, '', '/')
    }
  } catch (err: any) {
    console.error('[App] 删除会话失败:', err.message)
    alert('删除失败：' + err.message)
  }
}

const replayingId = ref<string | null>(null)

/**
 * 启动回放：加载 user 消息 + 流式回放 AI 响应
 * 可在 onMounted（URL 已是 /replay/:id）或 handleReplaySession（pushState 后）中调用
 */
async function startReplay(id: string) {
  if (replayingId.value) return
  replayingId.value = id
  messages.value = []
  loading.value = true

  try {
    const history = await loadHistory(id)
    const userMsgs = history.filter((m: any) => m.role === 'user')
    messages.value = userMsgs.map((m: any, i: number) => ({
      id: i,
      content: m.content || '',
      isUser: true,
      ...(m.images?.length ? { images: m.images } : {}),
      ...(m.attachments?.length ? { attachments: m.attachments } : {}),
    }))

    messages.value.push({
      id: Date.now(),
      content: '',
      isUser: false,
      blocks: [],
    })
    const aiMsg = messages.value[messages.value.length - 1]

    await nextTick()
    messageListRef.value?.scrollToBottom()

    await replaySession(id, {
      onReasoning(chunk) {
        const last = aiMsg.blocks![aiMsg.blocks!.length - 1]
        if (last?.kind === 'thinking' && last.loading) { last.content += chunk }
        else { aiMsg.blocks!.push({ kind: 'thinking', content: chunk, loading: true }) }
      },
      onContent(chunk) {
        const last = aiMsg.blocks![aiMsg.blocks!.length - 1]
        if (last?.kind === 'thinking' && last.loading) last.loading = false
        aiMsg.content += chunk
      },
      onContentEnd() {
        if (aiMsg.content) {
          aiMsg.blocks!.push({ kind: 'content', content: aiMsg.content })
          aiMsg.content = ''
        }
      },
      onSearching(query) {
        const last = aiMsg.blocks![aiMsg.blocks!.length - 1]
        if (last?.kind === 'thinking' && last.loading) last.loading = false
        aiMsg.blocks!.push({ kind: 'tool', name: 'search_web', query, loading: true })
      },
      onBashRunning(command) {
        const last = aiMsg.blocks![aiMsg.blocks!.length - 1]
        if (last?.kind === 'thinking' && last.loading) last.loading = false
        aiMsg.blocks!.push({ kind: 'tool', name: 'run_bash', command, loading: true })
      },
      onMemorySearching(query) {
        const last = aiMsg.blocks![aiMsg.blocks!.length - 1]
        if (last?.kind === 'thinking' && last.loading) last.loading = false
        aiMsg.blocks!.push({ kind: 'tool', name: 'memory_search', query, loading: true })
      },
      onMemorySaving(_cid) {
        const last = aiMsg.blocks![aiMsg.blocks!.length - 1]
        if (last?.kind === 'thinking' && last.loading) last.loading = false
        aiMsg.blocks!.push({ kind: 'tool', name: 'memory_save', loading: true })
      },
      onBrowserAction(data) {
        const last = aiMsg.blocks![aiMsg.blocks!.length - 1]
        if (last?.kind === 'thinking' && last.loading) last.loading = false
        aiMsg.blocks!.push({
          kind: 'tool', name: 'browser',
          query: data.action + (data.url ? `: ${data.url}` : data.selector ? `: ${data.selector}` : ''),
          loading: true,
        })
      },
      onToolResult(data) {
        const tb = [...aiMsg.blocks!].reverse().find(b => b.kind === 'tool' && b.name === data.name && b.loading)
        if (tb && tb.kind === 'tool') { tb.result = data.result; tb.loading = false }
      },
      onDone(data) {
        aiMsg.blocks!.forEach(b => { if ('loading' in b) b.loading = false })
        aiMsg.cost = data.cost; aiMsg.usage = data.usage; aiMsg.model = data.model
        aiMsg.toolCallsCount = data.toolCallsCount; aiMsg.messageCount = data.messageCount
        if (data.stopped) aiMsg.stopped = true
        loading.value = false
      },
      onError(msg, code) {
        aiMsg.content = code ? `❌ [${code}] ${msg}` : `❌ ${msg}`
        aiMsg.blocks!.forEach(b => { if ('loading' in b) b.loading = false })
        loading.value = false
      },
    })
  } catch (err: any) {
    showToast(`回放失败：${err.message}`)
    loading.value = false
  } finally {
    replayingId.value = null
  }
}

function handleReplaySession(id: string, event: Event) {
  event.stopPropagation()
  sidebarOpen.value = false
  // 更新 URL 到 /replay/:id（不刷新页面），然后启动回放
  window.history.pushState(null, '', `/replay/${id}`)
  startReplay(id)
}

/**
 * 将后端 JSONL 格式的历史消息映射为前端 Message 格式
 * 同一轮对话（一个 user 问题对应的所有 assistant+tool 轮次）合并为一个 Message
 */
function mapHistoryToMessages(history: any[]): Message[] {
  const result: Message[] = []
  let idCounter = 0
  // 当前正在构建的 AI 消息（跨多轮 assistant/tool 合并）
  let currentAiMsg: Message | null = null

  function flushAiMsg() {
    if (currentAiMsg) {
      result.push(currentAiMsg)
      currentAiMsg = null
    }
  }

  for (const item of history) {
    if (item.role === 'system') continue

    // done 事件：把 usage/cost/model 回填到当前 AI 消息
    if (item.type === 'done') {
      if (currentAiMsg) {
        if (item.cost)  currentAiMsg.cost  = item.cost
        if (item.usage) currentAiMsg.usage = item.usage
        if (item.model) currentAiMsg.model = item.model
        if (item.toolCallsCount) currentAiMsg.toolCallsCount = item.toolCallsCount
        if (item.messageCount)   currentAiMsg.messageCount   = item.messageCount
        flushAiMsg()
      }
      continue
    }

    // user 消息：先把上一条 AI 消息 flush，再新建 user 消息
    if (item.role === 'user') {
      flushAiMsg()
      result.push({
        id: idCounter++,
        content: item.content || '',
        isUser: true,
        ...(item.images && item.images.length > 0 ? { images: item.images } : {}),
        ...(item.attachments && item.attachments.length > 0 ? { attachments: item.attachments } : {}),
      })
      continue
    }

    // assistant 消息：合并进当前 AI 消息（或新建）
    if (item.role === 'assistant') {
      if (!currentAiMsg) {
        currentAiMsg = {
          id: idCounter++,
          content: '',
          isUser: false,
          blocks: [],
        }
      }

      // reasoning 始终作为 thinking 块
      if (item.reasoning) {
        currentAiMsg.blocks!.push({ kind: 'thinking', content: item.reasoning, loading: false })
      }

      if (item.tool_calls && item.tool_calls.length > 0) {
        // ── 中间轮（有 tool_calls）──
        // content 是模型在调工具前说的话，作为独立 content 块放进 blocks
        if (item.content) {
          currentAiMsg.blocks!.push({ kind: 'content', content: item.content })
        }
        // 追加 tool 块（等待 tool 消息回填结果）
        for (const tc of item.tool_calls) {
          const args = tc.function?.arguments ? JSON.parse(tc.function.arguments) : {}
          currentAiMsg.blocks!.push({
            kind: 'tool',
            name: tc.function?.name || '',
            query: args.query || undefined,
            command: args.command || undefined,
            result: '',
            loading: false,
          })
        }
      } else {
        // ── 最终轮（无 tool_calls）──
        // content 是最终回答，放进 aiMsg.content 供 markdown 渲染
        if (item.content) {
          currentAiMsg.content += item.content
        }
      }

      // model 取最后一条有值的
      if (item.model) currentAiMsg.model = item.model
      // 半成品消息（被中止/出错）带 stopped 标记
      if (item.stopped) currentAiMsg.stopped = true
      continue
    }

    // tool 消息：回填到 blocks 里第一个 result 为空的同名 tool 块
    if (item.role === 'tool' && currentAiMsg?.blocks) {
      const toolBlock = currentAiMsg.blocks.find(
        b => b.kind === 'tool' && b.name === item.name && (b.result === '' || b.result === undefined)
      )
      if (toolBlock && toolBlock.kind === 'tool') {
        toolBlock.result = item.content || ''
        toolBlock.loading = false
      }
      continue
    }
  }

  // 文件末尾没有 done 事件时也要 flush
  flushAiMsg()

  // 清理空的 blocks 数组，避免渲染空占位
  for (const msg of result) {
    if (!msg.isUser && msg.blocks?.length === 0) delete msg.blocks
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

  // 加载可用工具列表，恢复上次的开关状态
  try {
    const tools = await loadTools()
    availableTools.value = tools
    enabledToolIds.value = loadEnabledSet(tools)
  } catch (err: any) {
    console.error('[App] 加载工具列表失败:', err.message)
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

      // 历史消息加载完毕后滚到底部
      await nextTick()
      messageListRef.value?.scrollToBottom()
    } catch (err: any) {
      if (err.status === 404) {
        showToast('会话不存在或已被删除', 1500)
        setTimeout(() => { window.location.href = '/' }, 1500)
        return
      }
      console.error('[App] 加载历史失败:', err.message)
    }
  }

  // ── Replay 模式：/replay/:uuid ──────────────────────────────────────
  if (isReplaySession) {
    startReplay(sessionId)
  }
})

/** 停止当前生成：后端会落盘半成品并以 done(stopped:true) 收尾，loading 由 onDone 关闭 */
async function handleStop() {
  try {
    await stopGeneration()
  } catch (err: any) {
    showToast(`停止失败：${err.message}`)
  }
}

// 刷新/关闭页面时显式止血（双保险）：TCP 断连要靠代理层逐跳传播，可能丢；
// sendBeacon 在页面卸载后仍保证送达，直接告诉后端"停"
window.addEventListener('pagehide', () => {
  if (loading.value) {
    navigator.sendBeacon('/api/v1/chat/stop', new Blob([JSON.stringify({ sessionId })], { type: 'application/json' }))
  }
})

async function handleSend(text: string, images: string[] = [], attachments: AttachmentResult[] = []) {
  // 新会话第一次发消息时，把 sessionId 同步到 URL
  syncSessionIdToUrl()

  messages.value.push({
    id: Date.now(),
    content: text,
    isUser: true,
    images: images.length > 0 ? images : undefined,
    attachments: attachments.length > 0
      ? attachments.map(a => ({ type: a.type, name: a.name, dataUrl: a.dataUrl }))
      : undefined,
  })

  messages.value.push({
    id: Date.now() + 1,
    content: '',
    isUser: false,
    blocks: [],
    thinkingBlocks: [],  // 保留供 onReasoning 判断用
  })
  const aiMsg = messages.value[messages.value.length - 1]
  loading.value = true

  try {
    await sendStreamMessage(text, images, {
      onReasoning(chunk) {
        // 找最后一个 thinking 块，如果在 loading 中就累加，否则新建
        const lastBlock = aiMsg.blocks![aiMsg.blocks!.length - 1]
        if (lastBlock?.kind === 'thinking' && lastBlock.loading) {
          lastBlock.content += chunk
        } else {
          aiMsg.blocks!.push({ kind: 'thinking', content: chunk, loading: true })
        }
      },
      onContent(chunk) {
        // 关闭最后一个 thinking 块的 loading
        const lastBlock = aiMsg.blocks![aiMsg.blocks!.length - 1]
        if (lastBlock?.kind === 'thinking' && lastBlock.loading) {
          lastBlock.loading = false
        }
        aiMsg.content += chunk
      },
      onContentEnd() {
        // 把当前 content 封装为一个 content block，为下一轮腾出位置
        if (aiMsg.content) {
          aiMsg.blocks!.push({ kind: 'content', content: aiMsg.content })
          aiMsg.content = ''
        }
      },
      onSearching(query) {
        // 关闭最后一个 thinking 块的 loading
        const lastBlock = aiMsg.blocks![aiMsg.blocks!.length - 1]
        if (lastBlock?.kind === 'thinking' && lastBlock.loading) {
          lastBlock.loading = false
        }
        aiMsg.blocks!.push({ kind: 'tool', name: 'search_web', query, loading: true })
      },
      onBashRunning(command) {
        // 关闭最后一个 thinking 块的 loading
        const lastBlock = aiMsg.blocks![aiMsg.blocks!.length - 1]
        if (lastBlock?.kind === 'thinking' && lastBlock.loading) {
          lastBlock.loading = false
        }
        aiMsg.blocks!.push({ kind: 'tool', name: 'run_bash', command, loading: true })
      },
      onMemorySearching(query) {
        const lastBlock = aiMsg.blocks![aiMsg.blocks!.length - 1]
        if (lastBlock?.kind === 'thinking' && lastBlock.loading) {
          lastBlock.loading = false
        }
        aiMsg.blocks!.push({ kind: 'tool', name: 'memory_search', query, loading: true })
      },
      onMemorySaving(_conversationId) {
        const lastBlock = aiMsg.blocks![aiMsg.blocks!.length - 1]
        if (lastBlock?.kind === 'thinking' && lastBlock.loading) {
          lastBlock.loading = false
        }
        aiMsg.blocks!.push({ kind: 'tool', name: 'memory_save', loading: true })
      },
      onBrowserAction(data) {
        const lastBlock = aiMsg.blocks![aiMsg.blocks!.length - 1]
        if (lastBlock?.kind === 'thinking' && lastBlock.loading) {
          lastBlock.loading = false
        }
        aiMsg.blocks!.push({
          kind: 'tool',
          name: 'browser',
          query: data.action + (data.url ? `: ${data.url}` : data.selector ? `: ${data.selector}` : ''),
          loading: true,
        })
      },
      onToolResult(data) {
        // 找最后一个同名且 loading 的 tool 块
        const toolBlock = [...aiMsg.blocks!].reverse().find(
          b => b.kind === 'tool' && b.name === data.name && b.loading
        )
        if (toolBlock && toolBlock.kind === 'tool') {
          toolBlock.result = data.result
          toolBlock.loading = false
        }
      },
      onDone(data) {
        // 关闭所有还在 loading 的块
        aiMsg.blocks!.forEach(b => { if ('loading' in b) b.loading = false })
        aiMsg.cost = data.cost
        aiMsg.usage = data.usage
        aiMsg.model = data.model
        aiMsg.toolCallsCount = data.toolCallsCount
        aiMsg.messageCount = data.messageCount
        if (data.stopped) aiMsg.stopped = true
        loading.value = false
      },
      onError(msg, code) {
        aiMsg.content = code ? `❌ [${code}] ${msg}` : `❌ ${msg}`
        aiMsg.blocks!.forEach(b => { if ('loading' in b) b.loading = false })
        loading.value = false
      }
    }, selectedModel.value || undefined, attachments.length > 0 ? attachments : undefined,
      [...enabledToolIds.value])
  } catch (err: any) {
    aiMsg.content = `❌ ${err.message}`
    aiMsg.blocks!.forEach(b => { if ('loading' in b) b.loading = false })
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div id="app">
    <!-- Toast 提示 -->
    <div v-if="toastVisible" class="toast">{{ toastMessage }}</div>

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
          <div class="session-actions">
            <button
              class="session-action-btn session-replay-btn"
              @click="handleReplaySession(s.id, $event)"
              title="在新标签页回放"
            >▶</button>
            <button 
              class="session-action-btn session-delete-btn" 
              @click="handleDeleteSession(s.id, $event)"
              title="删除会话"
            >
              🗑️
            </button>
          </div>
        </li>
      </ul>
    </aside>

    <!-- 顶栏 -->
    <header class="header">
      <div class="header-left">
        <button class="menu-btn" @click="sidebarOpen = !sidebarOpen" title="会话列表">☰</button>
        <div class="header-title" @click="newSession" style="cursor:pointer" title="返回首页">
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
        <div class="tip" @click="handleSend('今天广州的天气怎么样', [])">→ 今天广州的天气怎么样</div>
      </div>
    </div>

    <!-- 消息列表 -->
    <MessageList v-else :messages="messages" ref="messageListRef" />

    <!-- 输入框 -->
    <div class="input-wrapper">
      <ChatInput
        ref="chatInputRef"
        :loading="loading"
        :tools="availableTools"
        :enabled-tool-ids="enabledToolIds"
        @send="(msg, imgs, atts) => handleSend(msg, imgs, atts)"
        @stop="handleStop"
        @toggle-tool="toggleTool"
      />
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
  gap: 0.5rem;
  overflow: hidden;
}

.header-left {
  display: flex;
  align-items: center;
  gap: 0.8rem;
  flex-shrink: 0;
}

.menu-btn {
  background: none;
  border: none;
  color: #fff;
  font-size: 1.3rem;
  cursor: pointer;
  padding: 0 0.2rem;
  line-height: 1;
  flex-shrink: 0;
}

.menu-btn:hover {
  opacity: 0.7;
}

.header-title {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  white-space: nowrap;
}

.header-title h1 {
  font-size: 1.1rem;
  font-weight: 700;
  letter-spacing: 0.15em;
  text-transform: uppercase;
  white-space: nowrap;
}

.logo {
  font-size: 1.3rem;
  flex-shrink: 0;
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
  white-space: nowrap;
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
  /* 小屏幕下限制宽度，防止撑开 header */
  max-width: 200px;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.model-select:hover {
  background-color: #e0e0e0;
}

/* 小屏幕适配 */
@media (max-width: 480px) {
  .header {
    padding: 0 0.8rem;
    gap: 0.4rem;
  }

  .header-left {
    gap: 0.5rem;
  }

  .header-title h1 {
    font-size: 0.85rem;
    letter-spacing: 0.08em;
  }

  .logo {
    font-size: 1rem;
  }

  .menu-btn {
    font-size: 1.1rem;
  }

  .model-select {
    font-size: 0.62rem;
    max-width: 140px;
    padding: 0.2rem 0.4rem;
    padding-right: 1.2rem;
    letter-spacing: 0.02em;
  }
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

/* Toast 提示 */
.toast {
  position: fixed;
  top: 80px;
  left: 50%;
  transform: translateX(-50%);
  background: #000;
  color: #fff;
  padding: 0.75rem 1.5rem;
  font-family: 'Space Mono', 'Courier New', monospace;
  font-size: 0.82rem;
  font-weight: 700;
  letter-spacing: 0.05em;
  border: 3px solid #000;
  box-shadow: 4px 4px 0 rgba(0, 0, 0, 0.3);
  z-index: 9999;
  animation: toast-in 0.2s ease-out;
}

@keyframes toast-in {
  from { opacity: 0; transform: translateX(-50%) translateY(-10px); }
  to { opacity: 1; transform: translateX(-50%) translateY(0); }
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
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
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
  margin-bottom: 10px;
}

.session-item--active:hover {
  background: #000;
  border-color: #000;
  transform: none;
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
  flex: 1;
}

.session-item--active .session-title {
  color: #fff;
}

.session-delete-btn {
  background: none;
  border: none;
  color: #999;
  font-size: 0.75rem;
  cursor: pointer;
  padding: 0.2rem 0.3rem;
  line-height: 1;
  transition: all 0.1s;
  flex-shrink: 0;
}

.session-delete-btn:hover {
  color: #ff0000;
  transform: scale(1.2);
}

.session-item--active .session-delete-btn {
  color: #ccc;
}

.session-item--active .session-delete-btn:hover {
  color: #ff6666;
}

.session-actions {
  display: flex;
  align-items: center;
  gap: 0.1rem;
  flex-shrink: 0;
}

.session-action-btn {
  background: none;
  border: none;
  color: #999;
  font-size: 0.72rem;
  cursor: pointer;
  padding: 0.2rem 0.3rem;
  line-height: 1;
  transition: all 0.1s;
}

.session-action-btn:disabled {
  cursor: default;
  opacity: 0.5;
}

.session-replay-btn:hover:not(:disabled) {
  color: #16a34a;
  transform: scale(1.2);
}

.session-item--active .session-action-btn {
  color: #ccc;
}

.session-item--active .session-replay-btn:hover:not(:disabled) {
  color: #86efac;
}

.session-item--active .session-delete-btn:hover {
  color: #ff6666;
}</style>
