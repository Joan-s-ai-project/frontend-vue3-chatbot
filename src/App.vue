<script setup lang="ts">
import { ref, nextTick } from 'vue'
import { sendChatMessage, sendStreamChatMessage, type ChatMessage } from '@/services/openai'

// 从环境变量读取模型配置
const API_MODEL = import.meta.env.VITE_OPENAI_API_MODEL || 'zai-org/glm-5'

// Message type definition
interface Message {
  id: number
  content: string
  isUser: boolean
  isError?: boolean
  reasoning?: string  // AI 消息的推理过程（GLM-5 reasoning_content）
}

// Reactive state
const messages = ref<Message[]>([
  {
    id: 1,
    content: '你好！我是 AI 助手，有什么可以帮您的吗？',
    isUser: false
  }
])
const inputMessage = ref('')
const isTyping = ref(false)
const messagesContainer = ref<HTMLElement | null>(null)
const chatHistory = ref<ChatMessage[]>([
  {
    role: 'system',
    content: '你是一个友好、专业的 AI 助手，用中文回答问题。'
  }
])

// Send message function (non-streaming)
const sendMessage = async () => {
  if (!inputMessage.value.trim() || isTyping.value) return

  const userContent = inputMessage.value.trim()

  // Add user message
  const userMessage: Message = {
    id: Date.now(),
    content: userContent,
    isUser: true
  }
  messages.value.push(userMessage)

  // Add to chat history
  chatHistory.value.push({
    role: 'user',
    content: userContent
  })

  inputMessage.value = ''
  await scrollToBottom()

  // Show typing indicator
  isTyping.value = true

  // Call OpenAI API
  const response = await sendChatMessage(chatHistory.value, {
    model: API_MODEL,
    temperature: 0.7,
    maxTokens: 1000
  })

  isTyping.value = false

  if (response.success) {
    // Add AI response to messages
    const aiMessage: Message = {
      id: Date.now(),
      content: response.content,
      isUser: false
    }
    messages.value.push(aiMessage)

    // Add to chat history
    chatHistory.value.push({
      role: 'assistant',
      content: response.content
    })
  } else {
    // Show error message
    const errorMessage: Message = {
      id: Date.now(),
      content: `抱歉，发生了错误：${response.error}`,
      isUser: false,
      isError: true
    }
    messages.value.push(errorMessage)
  }

  await scrollToBottom()
}

// Send message with streaming response (typewriter effect)
const sendStreamMessage = async () => {
  if (!inputMessage.value.trim() || isTyping.value) return

  const userContent = inputMessage.value.trim()

  // Add user message
  const userMessage: Message = {
    id: Date.now(),
    content: userContent,
    isUser: true
  }
  messages.value.push(userMessage)

  // Add to chat history
  chatHistory.value.push({
    role: 'user',
    content: userContent
  })

  inputMessage.value = ''
  await scrollToBottom()

  // Create placeholder message for AI response (empty initially)
  const aiMessageId = Date.now() + 1
  const aiMessage: Message = {
    id: aiMessageId,
    content: '',
    reasoning: '',  // 初始化推理字段
    isUser: false
  }
  messages.value.push(aiMessage)

  // Find the message reference for updates
  const messageRef = messages.value[messages.value.length - 1]

  // Call streaming API with onReasoning callback
  const response = await sendStreamChatMessage(chatHistory.value, {
    model: API_MODEL,
    temperature: 0.7, //思维活跃度，取值范围通常在 0 到 2 之间，默认值通常为 1, 保守到跳跃
    maxTokens: 450, // 限制模型生成的回答（Completion）最长能有多少个 Token
    onReasoning: (chunk) => {
      // Update reasoning content in real-time
      console.log(chunk);
      messageRef.reasoning = (messageRef.reasoning || '') + chunk
      scrollToBottom()
    },
    onChunk: (chunk) => {
      // Update answer content in real-time
      console.log(chunk);
      messageRef.content += chunk
      scrollToBottom()
    },
    onError: (error) => {
      console.error('Stream error:', error)
    },
    onComplete: () => {
      // Add to chat history when stream completes
      chatHistory.value.push({
        role: 'assistant',
        content: messageRef.content
      })
    }
  })

  if (!response.success) {
    // Replace placeholder with error message
    messageRef.content = `抱歉，发生了错误：${response.error}`
    messageRef.isError = true
  }

  await scrollToBottom()
}

// Scroll to bottom of messages
const scrollToBottom = async () => {
  await nextTick()
  if (messagesContainer.value) {
    messagesContainer.value.scrollTop = messagesContainer.value.scrollHeight
  }
}

// Retry failed message
const retryMessage = async (messageId: number) => {
  const messageIndex = messages.value.findIndex(m => m.id === messageId)
  if (messageIndex === -1) return

  // Remove error message
  messages.value.splice(messageIndex, 1)

  // Remove last user message from history and resend
  const lastUserMsgIndex = [...chatHistory.value].reverse().findIndex((m: ChatMessage) => m.role === 'user')
  const actualIndex = lastUserMsgIndex === -1 ? -1 : chatHistory.value.length - 1 - lastUserMsgIndex
  if (actualIndex !== -1) {
    const userContent = chatHistory.value[actualIndex].content
    chatHistory.value = chatHistory.value.slice(0, actualIndex)

    inputMessage.value = userContent
    await sendMessage()
  }
}

const handleKeyDown = (e: KeyboardEvent) => {
 // 如果正在使用输入法选词（isComposing 为 true），则直接返回，不执行发送逻辑
  if (e.isComposing || e.keyCode === 229) {
    return;
  }

  // 正常的发送逻辑：按 Enter 键且没有按 Shift（Shift+Enter 通常用于换行）
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault(); // 阻止默认的换行行为
    sendStreamMessage();      // 调用你的发送函数
  }
}   
</script>

<template>
  <div class="chat-app">
    <header class="chat-header">
      <h1>AI Chatbot</h1>
      <span class="status">在线</span>
    </header>

    <div class="chat-container">
      <div ref="messagesContainer" class="messages">
        <div
          v-for="message in messages"
          :key="message.id"
          :class="['message', message.isUser ? 'user-message' : 'ai-message', message.isError ? 'error-message' : '']"
        >
          <div class="message-content">
            <!-- 思考链区域（仅 AI 消息且有推理内容时显示） -->
            <div v-if="!message.isUser && message.reasoning" class="reasoning-section">
              <div class="reasoning-header">
                <span class="reasoning-icon">🧠</span>
                <span class="reasoning-label">思考过程</span>
              </div>
              <div class="reasoning-content">{{ message.reasoning }}</div>
            </div>

            <!-- 主回答内容 -->
            <p>{{ message.content }}</p>
            <button
              v-if="message.isError"
              @click="retryMessage(message.id)"
              class="retry-button"
            >
              重试
            </button>
          </div>
        </div>

        <!-- Typing indicator -->
        <div v-if="isTyping" class="message ai-message">
          <div class="message-content typing-indicator">
            <span></span>
            <span></span>
            <span></span>
          </div>
        </div>
      </div>
    </div>

    <footer class="chat-input-area">
      <textarea
        v-model="inputMessage"
        class="message-input"
        placeholder="输入消息... (Enter 发送, Shift+Enter 换行)"
        rows="1"
        :disabled="isTyping"
        @keydown="handleKeyDown"
      />
      <button class="send-button" @click="sendStreamMessage" :disabled="!inputMessage.trim() || isTyping">
        {{ isTyping ? '发送中...' : '发送' }}
      </button>
    </footer>
  </div>
</template>

<style scoped>
.chat-app {
  display: flex;
  flex-direction: column;
  height: 100vh;
  max-width: 900px;
  margin: 0 auto;
  background: #ffffff;
  box-shadow: 0 0 20px rgba(0, 0, 0, 0.1);
}

.chat-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 1rem 1.5rem;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

.chat-header h1 {
  font-size: 1.25rem;
  font-weight: 600;
}

.status {
  font-size: 0.875rem;
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.status::before {
  content: '';
  width: 8px;
  height: 8px;
  background: #4ade80;
  border-radius: 50%;
  animation: pulse 2s infinite;
}

@keyframes pulse {
  0%, 100% {
    opacity: 1;
  }
  50% {
    opacity: 0.5;
  }
}

.chat-container {
  flex: 1;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.messages {
  flex: 1;
  overflow-y: auto;
  padding: 1.5rem;
  display: flex;
  flex-direction: column;
  gap: 1rem;
  background: #f8fafc;
}

.message {
  display: flex;
  max-width: 80%;
  animation: slideIn 0.3s ease-out;
}

@keyframes slideIn {
  from {
    opacity: 0;
    transform: translateY(10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.user-message {
  align-self: flex-end;
}

.ai-message {
  align-self: flex-start;
}

.message-content {
  padding: 0.875rem 1.125rem;
  border-radius: 1rem;
  position: relative;
}

.user-message .message-content {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  border-bottom-right-radius: 0.25rem;
}

.ai-message .message-content {
  background: white;
  color: #1a1a1a;
  border: 1px solid #e5e7eb;
  border-bottom-left-radius: 0.25rem;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
}

.error-message .message-content {
  border-color: #ef4444;
  background: #fef2f2;
}

.message-content p {
  margin: 0;
  line-height: 1.5;
  word-wrap: break-word;
  white-space: pre-wrap;
}

.retry-button {
  display: inline-block;
  margin-top: 0.5rem;
  padding: 0.25rem 0.75rem;
  font-size: 0.75rem;
  background: #ef4444;
  color: white;
  border: none;
  border-radius: 0.5rem;
  cursor: pointer;
  transition: background 0.2s;
}

.retry-button:hover {
  background: #dc2626;
}

/* Typing indicator */
.typing-indicator {
  display: flex;
  align-items: center;
  gap: 0.375rem;
  padding: 0.875rem 1.125rem;
}

.typing-indicator span {
  width: 8px;
  height: 8px;
  background: #9ca3af;
  border-radius: 50%;
  animation: bounce 1.4s infinite ease-in-out both;
}

.typing-indicator span:nth-child(1) {
  animation-delay: -0.32s;
}

.typing-indicator span:nth-child(2) {
  animation-delay: -0.16s;
}

@keyframes bounce {
  0%, 80%, 100% {
    transform: scale(0.8);
    opacity: 0.5;
  }
  40% {
    transform: scale(1);
    opacity: 1;
  }
}

/* Input area */
.chat-input-area {
  display: flex;
  gap: 0.75rem;
  padding: 1rem 1.5rem;
  background: white;
  border-top: 1px solid #e5e7eb;
}

.message-input {
  flex: 1;
  padding: 0.75rem 1rem;
  border: 1px solid #d1d5db;
  border-radius: 1.5rem;
  font-size: 0.9375rem;
  font-family: inherit;
  resize: none;
  outline: none;
  transition: border-color 0.2s, box-shadow 0.2s;
  max-height: 120px;
}

.message-input:focus {
  border-color: #667eea;
  box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
}

.message-input:disabled {
  background: #f3f4f6;
  cursor: not-allowed;
}

.send-button {
  padding: 0.75rem 1.5rem;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  border: none;
  border-radius: 1.5rem;
  font-size: 0.9375rem;
  font-weight: 500;
  cursor: pointer;
  transition: opacity 0.2s, transform 0.1s;
}

.send-button:hover:not(:disabled) {
  opacity: 0.9;
}

.send-button:active:not(:disabled) {
  transform: scale(0.98);
}

.send-button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/* Scrollbar styling */
.messages::-webkit-scrollbar {
  width: 6px;
}

.messages::-webkit-scrollbar-track {
  background: transparent;
}

.messages::-webkit-scrollbar-thumb {
  background: #d1d5db;
  border-radius: 3px;
}

.messages::-webkit-scrollbar-thumb:hover {
  background: #9ca3af;
}

/* 思考链区域 */
.reasoning-section {
  margin-bottom: 0.75rem;
  padding: 0.75rem;
  background: #f8fafc;
  border-left: 3px solid #8b5cf6;
  border-radius: 0.5rem;
}

.reasoning-header {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-bottom: 0.5rem;
  font-size: 0.875rem;
  color: #6b7280;
  font-weight: 500;
}

.reasoning-icon {
  font-size: 1rem;
}

.reasoning-label {
  font-size: 0.875rem;
}

.reasoning-content {
  font-size: 0.875rem;
  line-height: 1.6;
  color: #4b5563;
  white-space: pre-wrap;
  word-wrap: break-word;
}
</style>
