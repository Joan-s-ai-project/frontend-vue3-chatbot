<script setup lang="ts">
import { ref } from 'vue'
import { sendStreamMessage } from '@/services/chat'
import ChatInput from '@/components/ChatInput.vue'
import MessageList from '@/components/MessageList.vue'
import type { Message } from '@/components/MessageList.vue'

const messages = ref<Message[]>([])
const loading = ref(false)

async function handleSend(text: string) {
  messages.value.push({
    id: Date.now(),
    content: text,
    isUser: true
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
    await sendStreamMessage(text, {
      onReasoning(chunk) {
        aiMsg.reasoning += chunk
      },
      onContent(chunk) {
        aiMsg.reasoningLoading = false
        aiMsg.content += chunk
      },
      onDone(usage) {
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
    <!-- 顶栏 -->
    <header class="header">
      <div class="header-title">
        <span class="logo">✨</span>
        <h1>AI Chat</h1>
      </div>
      <span class="header-badge">GLM-5</span>
    </header>

    <!-- 空状态欢迎页 -->
    <div v-if="messages.length === 0" class="welcome">
      <div class="welcome-icon">💬</div>
      <h2>你好，欢迎使用 AI Chat</h2>
      <p>输入任何问题，开始对话吧</p>
      <div class="welcome-tips">
        <div class="tip" @click="handleSend('用简单的话解释什么是量子计算')">💡 用简单的话解释什么是量子计算</div>
        <div class="tip" @click="handleSend('写一首关于春天的诗')">🌸 写一首关于春天的诗</div>
        <div class="tip" @click="handleSend('帮我列一个周末旅行清单')">🗺️ 帮我列一个周末旅行清单</div>
      </div>
    </div>

    <!-- 消息列表 -->
    <MessageList v-else :messages="messages" />

    <!-- 输入框 -->
    <div class="input-wrapper">
      <ChatInput @send="handleSend" />
      <p class="disclaimer">AI 生成内容仅供参考</p>
    </div>
  </div>
</template>

<style>
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&display=swap');

* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body {
  font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: #333;
  min-height: 100vh;
}

#app {
  display: flex;
  flex-direction: column;
  height: 100vh;
  max-width: 800px;
  margin: 0 auto;
  background: #f7f8fc;
  box-shadow: 0 0 40px rgba(0,0,0,0.15);
}

/* 顶栏 */
.header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.8rem 1.2rem;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: #fff;
}

.header-title {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.header-title h1 {
  font-size: 1.1rem;
  font-weight: 600;
}

.logo {
  font-size: 1.3rem;
}

.header-badge {
  font-size: 0.75rem;
  background: rgba(255,255,255,0.2);
  padding: 0.2rem 0.6rem;
  border-radius: 12px;
  backdrop-filter: blur(4px);
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
  font-size: 3.5rem;
  animation: float 3s ease-in-out infinite;
}

@keyframes float {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-10px); }
}

.welcome h2 {
  font-size: 1.4rem;
  font-weight: 600;
  color: #333;
}

.welcome p {
  color: #888;
  font-size: 0.95rem;
}

.welcome-tips {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  margin-top: 1rem;
  width: 100%;
  max-width: 400px;
}

.tip {
  padding: 0.7rem 1rem;
  background: #fff;
  border: 1px solid #e8e8e8;
  border-radius: 10px;
  font-size: 0.9rem;
  color: #555;
  cursor: pointer;
  transition: all 0.2s;
}

.tip:hover {
  border-color: #667eea;
  color: #667eea;
  transform: translateY(-1px);
  box-shadow: 0 2px 8px rgba(102, 126, 234, 0.15);
}

/* 输入区域 */
.input-wrapper {
  background: #f7f8fc;
}

.disclaimer {
  text-align: center;
  font-size: 0.72rem;
  color: #bbb;
  padding: 0.2rem 0 0.6rem;
}
</style>
