# Vue3 AI 聊天机器人

一个基于 Vue 3 + TypeScript 的 AI 聊天机器人应用，支持流式对话和推理过程展示。

## 功能特性

- 🤖 **实时对话** - 支持 AI 实时流式响应，打字机效果
- 🧠 **思考链展示** - 支持 GLM-5 模型的推理过程展示
- ⚙️ **环境变量配置** - 灵活配置 API 密钥、地址和模型
- 🎨 **精美 UI** - 紫色渐变主题，响应式布局
- 🔄 **错误重试** - 支持失败消息重新发送
- 📱 **响应式设计** - 适配各种屏幕尺寸

## 技术栈

- **前端框架**: Vue 3 (Composition API)
- **语言**: TypeScript
- **构建工具**: Vite
- **AI SDK**: OpenAI SDK (支持兼容 OpenAI API 格式的服务)

## 快速开始

### 安装依赖

```bash
npm install
```

### 配置环境变量

复制 `.env.example` 为 `.env.local`，并填写你的配置：

```bash
cp .env.example .env.local
```

编辑 `.env.local`：

```env
# OpenAI API Key
VITE_OPENAI_API_KEY=your-api-key-here

# OpenAI API Base URL（支持第三方兼容 OpenAI 格式的 API）
VITE_OPENAI_API_BASE_URL=/api/openai/v3/openai

# 使用的模型（可选，默认 zai-org/glm-5）
VITE_OPENAI_API_MODEL=zai-org/glm-5
```

### 启动开发服务器

```bash
npm run dev
```

访问 `http://localhost:5173` 即可使用。

### 构建生产版本

```bash
npm run build
```

构建产物位于 `dist` 目录。

### 预览构建结果

```bash
npm run preview
```

## 项目结构

```
src/
├── App.vue                 # 主应用组件
├── main.ts                 # 应用入口
├── services/
│   └── openai.ts          # OpenAI API 封装
└── assets/
    └── styles/
        └── global.css     # 全局样式
```

## 环境变量说明

| 变量名 | 说明 | 默认值 |
|--------|------|--------|
| `VITE_OPENAI_API_KEY` | OpenAI API 密钥 | - |
| `VITE_OPENAI_API_BASE_URL` | API 基础地址 | `/api/ppinfra/v3/openai` |
| `VITE_OPENAI_API_MODEL` | 使用的模型 | `zai-org/glm-5` |

## 支持的模型

- GLM-5 (`zai-org/glm-5`) - 支持推理过程展示
- GPT-4o-mini (`gpt-4o-mini`)
- GPT-4 (`gpt-4`)
- 其他兼容 OpenAI API 格式的模型

## 开发

```bash
# 启动开发服务器
npm run dev

# 类型检查
npm run build

# 预览
npm run preview
```

## License

MIT
