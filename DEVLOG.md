# Frontend Development Log (Vue3 Chatbot)

本项目是基于 Vue 3 + Vite + TypeScript 开发的 AI 聊天前端，对接 Koa 后端 API。

## 核心架构
- **框架**: Vue 3 (Composition API)
- **构建**: Vite
- **通信**: Fetch API + SSE (Server-Sent Events)
- **状态**: 响应式 `ref` / `reactive` 处理消息流
- **样式**: Vanilla CSS (现代简约风)

---

## 开发步骤回顾

### Step 1: 项目清理与接口封装
**工作内容**:
- 清理 `App.vue` 模板，删除原有的 OpenAI SDK 直接调用逻辑。
- 创建 `src/services/chat.ts`，封装 `sendMessage` (POST) 和 `sendStreamMessage` (SSE)。
- 配置 `vite.config.ts` 代理，将 `/api` 转发至后端 `localhost:3000`。
- 使用 `crypto.randomUUID()` 生成并持久化 `sessionId`。

**验证**:
- 浏览器加载正常，控制台无代理报错。

### Step 2: ChatInput 组件与非流式调通
**工作内容**:
- 开发 `ChatInput.vue`：包含 `textarea` 和发送按钮。
- 处理键盘事件：Enter 发送，Shift+Enter 换行。
- **关键修复**: 增加 `isComposing` 守卫，解决中文输入法按 Enter 确认选字时误触发发送的问题。

**验证**:
- 输入文字点击发送，控制台成功打印后端返回的完整 AI 回复。

### Step 3: 基础消息展示 (MessageList & Bubble)
**工作内容**:
- 开发 `MessageBubble.vue`：区分用户 (右侧蓝色) 和 AI (左侧白色) 气泡。
- 开发 `MessageList.vue`：容器组件，支持自动滚动到底部。
- **响应式修复**: 在 `App.vue` 中 push 消息后，获取数组中的 Proxy 引用进行赋值，确保视图实时更新。

**验证**:
- 界面出现对话流，对话气泡样式分明。

### Step 4: 流式 SSE 接入
**工作内容**:
- `App.vue` 切换至 `sendStreamMessage`。
- 在 `onContent` 回调中逐字追加内容，实现平滑的“打字机”效果。

**验证**:
- AI 回复实时跳动显示，无需等待完整返回。

### Step 5: 推理过程展示 (ThinkingBlock)
**工作内容**:
- 开发 `ThinkingBlock.vue`：一个可折叠的 UI 块，展示 AI 的 `reasoning` (DeepSeek 等模型支持)。
- SSE 逻辑增强：分别处理 `onReasoning` 和 `onContent` 回调。
- 状态切换：内容开始输出时，将推理块状态由“思考中”转为“已完成”。

**验证**:
- 回复初期显示“⏳ 思考中...”，展开可看到实时推理逻辑。

### Step 6: UI 全面美化与交互优化
**工作内容**:
- **视觉增强**: 引入 Inter 字体，添加渐变色顶栏、阴影悬浮效果。
- **欢迎页**: 增加空状态动画及 3 个快捷示例（点击直接发送）。
- **滚动优化**: 实现“智能自动滚动”——如果用户正在上滑查看历史记录，自动滚动会暂停，不干扰阅读。
- **兼容性**: 针对非安全上下文（如 IP 访问）增加了 `randomUUID` 的 Fallback 函数。

**验证**:
- 整体 UI 达到生产级审美，交互流畅，支持移动端自适应。

---

## 运行与部署
1. **安装**: `npm install`
2. **开发阶段**: `npm run dev`
3. **安全提示**: 使用 `crypto.randomUUID` 等 API 需要 HTTPS 环境（本地开发 localhost 除外）。建议结合 `ngrok` 或 Vite SSL 插件使用。
