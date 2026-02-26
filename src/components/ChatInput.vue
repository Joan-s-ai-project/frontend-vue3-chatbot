<script setup lang="ts">
import { ref } from 'vue'

const emit = defineEmits<{
  send: [message: string]
}>()

const input = ref('')
const composing = ref(false)

function handleSend() {
  const text = input.value.trim()
  if (!text) return
  emit('send', text)
  input.value = ''
}

function handleKeydown(e: KeyboardEvent) {
  if (e.key === 'Enter' && !e.shiftKey && !e.isComposing && !composing.value) {
    e.preventDefault()
    handleSend()
  }
}
</script>

<template>
  <div class="chat-input">
    <div class="input-row">
      <textarea
        v-model="input"
        placeholder="输入消息... (Enter 发送, Shift+Enter 换行)"
        @keydown="handleKeydown"
        @compositionstart="composing = true"
        @compositionend="composing = false"
        rows="1"
      />
      <button @click="handleSend" :disabled="!input.trim()" title="发送">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z"/>
        </svg>
      </button>
    </div>
  </div>
</template>

<style scoped>
.chat-input {
  padding: 0.8rem 1rem;
  border-top: 1px solid #eee;
  background: #fff;
}

.input-row {
  display: flex;
  align-items: flex-end;
  gap: 0.5rem;
  background: #f0f1f5;
  border-radius: 16px;
  padding: 0.4rem 0.5rem 0.4rem 1rem;
  transition: box-shadow 0.2s;
}

.input-row:focus-within {
  box-shadow: 0 0 0 2px rgba(102, 126, 234, 0.3);
}

textarea {
  flex: 1;
  padding: 0.5rem 0;
  border: none;
  background: transparent;
  font-size: 0.95rem;
  font-family: inherit;
  resize: none;
  outline: none;
  line-height: 1.4;
  max-height: 120px;
}

button {
  width: 36px;
  height: 36px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #667eea, #764ba2);
  color: #fff;
  border: none;
  border-radius: 12px;
  cursor: pointer;
  flex-shrink: 0;
  transition: all 0.2s;
}

button:hover:not(:disabled) {
  transform: scale(1.05);
  box-shadow: 0 2px 8px rgba(102, 126, 234, 0.4);
}

button:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}
</style>
