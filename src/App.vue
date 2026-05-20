<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { sendStreamMessage, isHistorySession, sessionId, loadHistory, loadModels } from '@/services'
import ChatInput from '@/components/ChatInput.vue'
import MessageList from '@/components/MessageList.vue'
import type { Message } from '@/components/MessageList.vue'

const messages = ref<Message[]>([])
const loading = ref(false)

// ── 模型选择 ──────────────────────────────────────────────────────────
interface ModelOption { id: string; label: string; provider: string }
const models = ref<ModelOption[]>([])
const selectedModel = ref('')

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
          query: ta.input?.query || '',
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

  if (isHistorySession) {
    try {
      const history = await loadHistory(sessionId)
      messages.value = mapHistoryToMessages(history)
    } catch (err: any) {
      console.error('[App] 加载历史失败:', err.message)
    }
  }
})

async function handleSend(text: string, images: string[] = []) {
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
      onToolResult(data) {
        if (!aiMsg.toolCalls) return
        const tc = aiMsg.toolCalls.find(t => t.query === data.query && t.loading)
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
    <!-- 顶栏 -->
    <header class="header">
      <div class="header-title">
        <span class="logo">■</span>
        <h1>AI CHAT</h1>
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
  padding: 0.8rem 1.2rem;
  background: #000;
  color: #fff;
  border-bottom: 4px solid #000;
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
</style>
