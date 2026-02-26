<script setup lang="ts">
import { ref } from 'vue'
import { sendMessage } from '@/services/chat'
import ChatInput from '@/components/ChatInput.vue'

const reply = ref('')
const loading = ref(false)

async function handleSend(message: string) {
  console.log('[App] 发送:', message)
  loading.value = true
  reply.value = ''

  try {
    const result = await sendMessage(message)
    console.log('[App] 收到回复:', result)
    reply.value = result.content
  } catch (err: any) {
    console.error('[App] 错误:', err.message)
    reply.value = `❌ ${err.message}`
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div id="app">
    <div class="chat-area">
      <div class="reply-box" v-if="reply || loading">
        <p v-if="loading" class="loading">AI 思考中...</p>
        <p v-else>{{ reply }}</p>
      </div>
      <p v-else class="placeholder">发一条消息试试 👇</p>
    </div>
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

.chat-area {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 2rem;
}

.placeholder {
  color: #999;
  font-size: 1.1rem;
}

.reply-box {
  max-width: 600px;
  padding: 1rem 1.5rem;
  background: #fff;
  border-radius: 12px;
  box-shadow: 0 1px 3px rgba(0,0,0,0.1);
  line-height: 1.6;
  white-space: pre-wrap;
}

.loading {
  color: #999;
  animation: pulse 1.5s infinite;
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.4; }
}
</style>
