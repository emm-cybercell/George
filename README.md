# 桥智同学 (George)

> 青少年 AI 创意助手 · 微信小程序
> 由深圳大学科技工作室孵化，联合一线教育者与 AI 工程师共同打造。

"桥智同学"是一款面向 8-14 岁青少年的 AI 学习搭档小程序：它以"未来创造者探险家" IP 形象与孩子平等对话，通过 Prompt 工程启蒙、AI 结果批判性判断、创意表达三大特色，培养 AI 时代的产品经理思维。

## ✨ 功能特性

页面路由以 `src/app.config.ts` 为准：

| 页面     | 路由                          | 说明                                                                   |
| -------- | ----------------------------- | ---------------------------------------------------------------------- |
| 首页     | `pages/home/index`            | 默认入口，项目宣传页（Hero 欢迎卡片 · 项目介绍 · 核心特色）            |
| 学习页   | `pages/learn/index`           | AI 动态对话页，IP 形象三状态（待机 / 思考中 / 对话中），底部悬浮输入栏 |
| 我的页   | `pages/profile/index`         | 个人中心（用户信息卡 · 荣誉勋章墙 · 菜单列表）                         |
| 历史记录 | `pages/history/index`         | 对话历史回顾                                                           |
| 作品集   | `pages/portfolio/index`       | 我的创作作品集                                                         |
| 通知     | `pages/notifications/index`   | 消息通知中心                                                           |
| 设置     | `pages/settings/index`        | 全局设置（语音朗读 · 触感反馈）                                        |
| 关于     | `pages/about/index`           | 项目理念（创造 / 判断 / 表达三大支柱 · 作业红黄绿原则）                |
| 团队     | `pages/team/index`            | 导师团队介绍                                                           |
| 功能详情 | `pages/feature-detail/index`  | 特色功能详解（桥智观察站等）                                           |
| 能力设置 | `pages/ability-setting/index` | 当前重点培养的 AI 能力设置                                             |

AI 对话由云函数 `deepseekProxy` 代理驱动，内置"桥智同学"人设 System Prompt：平等对话、启发探索、鼓励创作，并严格遵循"AI 作业红黄绿原则"，拒绝直接代写作业。

## 🛠 技术栈

- **框架**：Taro 4.x（webpack5 + React 18）
- **语言**：TypeScript（严禁 `any`，类型定义统一放 `src/types/`）
- **样式**：Sass (SCSS)
- **UI 组件库**：`@nutui/nutui-react-taro`
- **AI 服务**：微信云开发 AI（`wxai`）为主，云函数 `deepseekProxy` 多模型代理（智谱 GLM / 阿里云百炼 / DeepSeek 可选）
- **工程规范**：ESLint + Stylelint + Commitlint（Conventional Commits）+ Husky

## 📁 目录结构

```
├── config/              # Taro 构建配置（dev / prod / 环境变量注入）
├── cloudfunctions/      # 微信云函数（deepseekProxy 多模型代理）
├── docs/                # 产品与开发文档（PRD、人设 Prompt）
│   ├── PRD_MVP.md       # UI 与功能需求文档（设计规范、页面拆解）
│   └── PERSONA_PROMPT.md# AI 系统人设与 API 开发规范
└── src/
    ├── api/             # 网络请求层（云函数 / DeepSeek 封装）
    ├── assets/          # 静态资源（图片等）
    ├── components/      # 可复用组件（每文件 ≤150 行，超限拆子组件）
    ├── hooks/           # 复杂状态逻辑（自定义 Hooks）
    ├── pages/           # 页面（只做组件拼装）
    ├── types/           # 全局类型定义
    └── utils/           # 通用工具（设置 · TTS 语音）
```

## 🚀 快速开始

环境要求：Node.js ≥ 18，微信开发者工具，微信云开发（cloudbase）账号。

```bash
# 1. 安装依赖
npm install

# 2. 开发模式（监听构建到 dist/）
npm run dev:weapp

# 3. 生产构建
npm run build:weapp
```

用微信开发者工具导入项目根目录，AppID 在 `project.config.json` 中已配置，构建产物输出至 `dist/`。

### ☁️ 云函数部署（AI 对话依赖，必做）

AI 对话通过云函数 `deepseekProxy` 代理，避免 API Key 暴露在客户端。克隆后需先部署：

1. 微信开发者工具 → 云开发控制台 → 开通云开发环境；
2. 右键 `cloudfunctions/deepseekProxy` → **上传并部署：云端安装依赖**；
3. 在云函数 `deepseekProxy` 的"配置 → 环境变量"中按需配置密钥（二选一即可，对应 `activeProvider`）：

| 供应商                | 环境变量           | 说明                                         |
| --------------------- | ------------------ | -------------------------------------------- |
| 微信云开发 AI（默认） | 无需密钥           | `activeProvider: "wxai"`，走云开发资源点套餐 |
| 智谱 BigModel         | `GLM_API_KEY`      | 你的智谱 API Key                             |
| 阿里云百炼            | `ALIYUN_API_KEY`   | 你的阿里云百炼 API Key                       |
| DeepSeek              | `DEEPSEEK_API_KEY` | 你的 DeepSeek API Key                        |

> 所有密钥只通过环境变量注入，**严禁硬编码进代码**。生产构建所需的 `DEEPSEEK_API_KEY` 由 `config/index.ts` 从本地 `.env*` 文件读取注入，密钥文件不会进入仓库（已在 `.gitignore` 中忽略）。

### ⚙️ 本地环境变量

- `config/index.ts` 会依次读取根目录的 `.env`、`.env.development`、`.env.production`（不存在则静默跳过），用于构建期注入 `process.env.DEEPSEEK_API_KEY`。
- 克隆后**无需**创建 `.env` 也能成功构建；本地若要调试 DeepSeek 直连，可自建 `.env.development` 填入 `DEEPSEEK_API_KEY="sk-xxx"`（此文件已被 gitignore，不会误提交）。

### 📱 初始化

- 项目依赖云数据库集合：`system_configs`（可热更 `llm_active` 配置）。首次运行时如 AI 无响应，请确认该集合已创建且云函数已部署。

## 📚 文档

- [产品需求文档（UI 与功能）](docs/PRD_MVP.md) —— 设计规范、页面与组件拆解
- [DeepSeek 人设 Prompt 与 API 规范](docs/PERSONA_PROMPT.md) —— 系统人设与调用约定

## 🔄 内容更新维护指南

本仓库采取**单一事实来源**原则：README 只做索引与概览，细节一律以源头文档为准，避免双份维护导致内容漂移。

| 内容变化            | 事实来源（改这里）                              | README 需要同步的地方  |
| ------------------- | ----------------------------------------------- | ---------------------- |
| 页面 / 功能变化     | `docs/PRD_MVP.md`、`src/app.config.ts`          | 「功能特性」表格       |
| 依赖 / 构建脚本变化 | `package.json`                                  | 「技术栈」「快速开始」 |
| AI 人设 / API 变化  | `docs/PERSONA_PROMPT.md`、`src/api/deepseek.ts` | 「功能特性」末段概述   |
| 目录结构调整        | 实际目录                                        | 「目录结构」树         |
| 新增 / 删除文档     | `docs/` 目录                                    | 「文档」链接列表       |

> 变更代码时如涉及上表任意一项，请随手更新 README 对应小节，保持索引与代码一致。

## 📄 License

内部项目，未开源授权，仅供学习交流。
