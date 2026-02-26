<script setup lang="ts">
import { ref } from 'vue'

const emit = defineEmits<{
  send: [message: string]
}>()

const input = ref('')
const composing = ref(false)  // 手动追踪输入法组合状态

function handleSend() {
  const text = input.value.trim()
  if (!text) return
  emit('send', text)
  input.value = ''
}

function handleKeydown(e: KeyboardEvent) {
  // 双重保险：e.isComposing + 手动追踪
  if (e.key === 'Enter' && !e.shiftKey && !e.isComposing && !composing.value) {
    e.preventDefault()
    handleSend()
  }
}
</script>

<template>
  <div class="chat-input">
    <textarea
      v-model="input"
      placeholder="输入消息..."
      @keydown="handleKeydown"
      @compositionstart="composing = true"
      @compositionend="composing = false"
      rows="1"
    />
    <button @click="handleSend" :disabled="!input.trim()">
      发送
    </button>
  </div>
</template>

<style scoped>
.chat-input {
  display: flex;
  gap: 0.5rem;
  padding: 1rem;
  border-top: 1px solid #e0e0e0;
  background: #fff;
}

textarea {
  flex: 1;
  padding: 0.6rem 0.8rem;
  border: 1px solid #ddd;
  border-radius: 8px;
  font-size: 0.95rem;
  font-family: inherit;
  resize: none;
  outline: none;
  line-height: 1.4;
}

textarea:focus {
  border-color: #4a90d9;
}

button {
  padding: 0.6rem 1.2rem;
  background: #4a90d9;
  color: #fff;
  border: none;
  border-radius: 8px;
  font-size: 0.95rem;
  cursor: pointer;
  white-space: nowrap;
}

button:hover:not(:disabled) {
  background: #357abd;
}

button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
</style>
