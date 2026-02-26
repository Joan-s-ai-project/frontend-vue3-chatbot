<script setup lang="ts">
import { sessionId } from '@/services/chat'

console.log('[App] Chat session:', sessionId)
</script>

<template>
  <div id="app">
    <h1>Hello Chat 💬</h1>
    <p>Session: {{ sessionId }}</p>
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
  align-items: center;
  justify-content: center;
  height: 100vh;
  gap: 1rem;
}

h1 {
  font-size: 2rem;
}

p {
  color: #999;
  font-size: 0.85rem;
  font-family: monospace;
}
</style>
