# 桥智同学 (George)

> 青少年 AI 创意助手 · 微信小程序
> 由深圳大学科技工作室孵化，联合一线教育者与 AI 工程师共同打造。

"桥智同学"是一款面向 8-14 岁青少年的 AI 学习搭档小程序：它以"未来创造者探险家" IP 形象与孩子平等对话，通过 Prompt 工程启蒙、AI 结果批判性判断、创意表达三大特色，培养 AI 时代的产品经理思维。

## ✨ 功能特性

| 页面 | 路由 | 说明 |
| --- | --- | --- |
| 首页 | `pages/home/index` | 默认入口，项目宣传页（Hero 欢迎卡片 · 项目介绍 · 核心特色） |
| 学习页 | `pages/learn/index` | AI 动态对话页，IP 形象三状态（待机 / 思考中 / 对话中），底部悬浮输入栏 |
| 我的页 | `pages/profile/index` | 个人中心（用户信息卡 · 荣誉勋章墙 · 菜单列表） |

AI 对话由 DeepSeek API（`deepseek-chat`）驱动，内置"桥智同学"人设 System Prompt：平等对话、启发探索、鼓励创作，并严格遵循"AI 作业红黄绿原则"，拒绝直接代写作业。

## 🛠 技术栈

- **框架**：Taro 4.x（webpack5 + React 18）
- **语言**：TypeScript（严禁 `any`，类型定义统一放 `src/types/`）
- **样式**：Sass (SCSS)
- **UI 组件库**：`@nutui/nutui-react-taro`
- **AI 服务**：DeepSeek Chat Completions API
- **工程规范**：ESLint + Stylelint + Commitlint（Conventional Commits）+ Husky

## 📁 目录结构

```
├── config/              # Taro 构建配置（dev / prod）
├── docs/                # 产品与开发文档（PRD、人设 Prompt）
│   ├── PRD_MVP.md       # UI 与功能需求文档（设计规范、页面拆解）
│   └── PERSONA_PROMPT.md# DeepSeek 系统人设与 API 开发规范
└── src/
    ├── api/             # 网络请求层（DeepSeek API 封装）
    ├── components/      # 可复用组件（每文件 ≤150 行，超限拆子组件）
    ├── hooks/           # 复杂状态逻辑（自定义 Hooks）
    ├── pages/           # 页面（只做组件拼装）
    └── types/           # 全局类型定义
```

## 🚀 快速开始

环境要求：Node.js ≥ 18，微信开发者工具。

```bash
# 1. 安装依赖
npm install

# 2. 配置 DeepSeek API Key
#    编辑 src/api/deepseek.ts，将 YOUR_DEEPSEEK_API_KEY_HERE
#    替换为你从 platform.deepseek.com 获取的真实 Key

# 3. 开发模式（监听构建到 dist/）
npm run dev:weapp

# 4. 生产构建
npm run build:weapp
```

用微信开发者工具导入项目根目录，AppID 在 `project.config.json` 中已配置，构建产物输出至 `dist/`。

## 📚 文档

- [产品需求文档（UI 与功能）](docs/PRD_MVP.md) —— 设计规范、页面与组件拆解
- [DeepSeek 人设 Prompt 与 API 规范](docs/PERSONA_PROMPT.md) —— 系统人设与调用约定

## 🔄 内容更新维护指南

本仓库采取**单一事实来源**原则：README 只做索引与概览，细节一律以源头文档为准，避免双份维护导致内容漂移。

| 内容变化 | 事实来源（改这里） | README 需要同步的地方 |
| --- | --- | --- |
| 页面 / 功能变化 | `docs/PRD_MVP.md`、`src/app.config.ts` | 「功能特性」表格 |
| 依赖 / 构建脚本变化 | `package.json` | 「技术栈」「快速开始」 |
| AI 人设 / API 变化 | `docs/PERSONA_PROMPT.md`、`src/api/deepseek.ts` | 「功能特性」末段概述 |
| 目录结构调整 | 实际目录 | 「目录结构」树 |
| 新增 / 删除文档 | `docs/` 目录 | 「文档」链接列表 |

> 变更代码时如涉及上表任意一项，请随手更新 README 对应小节，保持索引与代码一致。

## 📄 License

内部项目，未开源授权，仅供学习交流。