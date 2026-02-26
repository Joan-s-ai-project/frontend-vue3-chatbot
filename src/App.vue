<script setup lang="ts">
import { ref } from 'vue'
import { sendStreamMessage } from '@/services/chat'
import ChatInput from '@/components/ChatInput.vue'
import MessageList from '@/components/MessageList.vue'
import type { Message } from '@/components/MessageList.vue'

const messages = ref<Message[]>([])
const loading = ref(false)

async function handleSend(text: string) {
  // 1. 推入 user 消息
  messages.value.push({
    id: Date.now(),
    content: text,
    isUser: true
  })

  // 2. 推入 assistant 占位
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
    await sendStreamMessage(text, {
      onReasoning(chunk) {
        aiMsg.reasoning += chunk  // 推理过程逐字追加
      },
      onContent(chunk) {
        aiMsg.reasoningLoading = false  // 推理结束，内容开始
        aiMsg.content += chunk
      },
      onDone(usage) {
        console.log('[App] 完成, tokens:', usage)
        aiMsg.reasoningLoading = false
        loading.value = false
      },
      onError(msg) {
        aiMsg.content = `❌ ${msg}`
        aiMsg.reasoningLoading = false
        loading.value = false
      }
    })
  } catch (err: any) {
    aiMsg.content = `❌ ${err.message}`
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div id="app">
    <!-- 空状态 -->
    <div v-if="messages.length === 0" class="welcome">
      <h1>💬 AI Chat</h1>
      <p>发一条消息开始对话</p>
    </div>

    <!-- 消息列表 -->
    <MessageList v-else :messages="messages" />

    <!-- 加载指示 -->
    <div v-if="loading" class="typing-indicator">
      AI 思考中<span class="dots">...</span>
    </div>

    <!-- 输入框 -->
    <ChatInput @send="handleSend" />
  </div>
</template>

<style>
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  background: #f5f5f5;
  color: #333;
}

#app {
  display: flex;
  flex-direction: column;
  height: 100vh;
}

.welcome {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
}

.welcome h1 {
  font-size: 2rem;
}

.welcome p {
  color: #999;
  font-size: 1rem;
}

.typing-indicator {
  padding: 0.5rem 1.5rem;
  color: #999;
  font-size: 0.85rem;
}

.dots {
  animation: blink 1.4s infinite;
}

@keyframes blink {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.2; }
}
</style>
