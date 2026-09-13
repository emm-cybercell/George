# 桥智同学 (George)

> 青少年 AI 创意助手 · 微信小程序
> 由深圳大学科技工作室孵化，联合一线教育者与 AI 工程师共同打造。

"桥智同学"是一款面向 8-14 岁青少年的 AI 学习搭档小程序：它以"未来创造者探险家" IP 形象与孩子平等对话，通过 Prompt 工程启蒙、AI 结果批判性判断、创意表达三大特色，培养 AI 时代的产品经理思维。

## ✨ 功能特性

页面路由以 `src/app.config.ts` 为准：

| 页面     | 路由                          | 说明                                                                   |
| -------- | ----------------------------- | ---------------------------------------------------------------------- |
| 首页     | `pages/home/index`            | 默认入口，项目宣传页（Hero 欢迎卡片 · 项目介绍 · 核心特色）            |
| 学习页   | `pages/learn/index`           | AI 对话页：微信式消息流（各自头像）、语音转文字输入、TTS 朗读回复      |
| 我的页   | `pages/profile/index`         | 个人中心（用户信息卡 · 荣誉勋章墙 · 菜单列表）                         |
| 历史记录 | `pages/history/index`         | 对话历史回顾（云端 + 本地双源，可恢复续聊）                            |
| 作品集   | `pages/portfolio/index`       | 我的创作作品集（AI 自动归档优质创作）                                  |
| 通知     | `pages/notifications/index`   | 消息通知中心                                                           |
| 设置     | `pages/settings/index`        | 全局设置（语音朗读 · 触感反馈）                                        |
| 关于     | `pages/about/index`           | 项目理念（创造 / 判断 / 表达三大支柱 · 作业红黄绿原则）                |
| 团队     | `pages/team/index`            | 导师团队介绍                                                           |
| 功能详情 | `pages/feature-detail/index`  | 特色功能详解（桥智观察站等）                                           |
| 能力设置 | `pages/ability-setting/index` | 当前重点培养的 AI 能力设置                                             |

核心 AI 能力：

- **AI 对话**：云函数代理调用微信云开发混元模型（`hy3`），内置"桥智同学"人设 System Prompt——平等对话、启发探索、鼓励创作，严格遵循"AI 作业红黄绿原则"，拒绝直接代写作业。
- **AI 生图**：文生图 / 图生图双模式（混元生图模型），生成结果自动插入对话。
- **Agent 工具调用**：模型可自主调用云端工具，为高质量提问发放成长积分、将优质创作归档到作品集。
- **内容安全**：用户提问与 AI 回复均经微信内容安全接口审核。
- **激励体系**：对话积分、等级成长、勋章解锁，云端持久化。

## 🛠 技术栈

- **框架**：Taro 4.x（webpack5 + React 18）+ TypeScript
- **样式**：Sass (SCSS)
- **后端**：微信云开发（云函数 + 云数据库 + 云存储）
- **AI 能力**：微信云开发 AI（腾讯混元生文 `hy3` / 混元生图），经 `wx-server-sdk` 的 `cloud.ai()` 调用
- **工程规范**：ESLint + Stylelint + Commitlint（Conventional Commits）+ Husky

## 📁 目录结构

```
├── config/              # Taro 构建配置（dev / prod）
├── cloudfunctions/      # 微信云函数
│   └── deepseekProxy/   # AI 网关（生文 / 生图 / Agent 工具 / 内容审核）
├── docs/                # 产品与开发文档（PRD、人设 Prompt、进度交接）
├── tests/               # 云函数本地测试
└── src/
    ├── api/             # 网络请求层（云函数 / 云数据库封装）
    ├── assets/          # 静态资源（图片）
    ├── components/      # 可复用组件
    ├── hooks/           # 复杂状态逻辑（对话会话 / 录音）
    ├── pages/           # 页面（只做组件拼装）
    ├── types/           # 全局类型定义
    └── utils/           # 通用工具（设置 · TTS 语音）
```

## 🚀 快速开始

环境要求：Node.js ≥ 18，微信开发者工具，已开通云开发环境的微信小程序账号。

```bash
# 1. 安装依赖
npm install

# 2. 开发模式（监听构建到 dist/）
npm run dev:weapp

# 3. 生产构建
npm run build:weapp
```

用微信开发者工具导入项目根目录，AppID 在 `project.config.json` 中已配置，构建产物输出至 `dist/`。

### ☁️ 云开发配置（AI 功能依赖，必做）

1. 微信开发者工具 → 云开发控制台 → 开通云开发环境（`project.config.json` 中已绑定环境 ID）；
2. 右键 `cloudfunctions/deepseekProxy` → **上传并部署：云端安装依赖**（拉取 `wx-server-sdk 4.x`）；
3. 云开发控制台 → AI+ → 开通 AI 能力，开通**混元生文（hy3）**与**混元生图**模型；
4. 云开发控制台 → 云函数 → `deepseekProxy` → 配置：将超时时间调至 **30 秒以上**；
5. 云数据库创建 `system_configs` 集合（可选，用于模型配置热更；未创建时自动使用代码内置默认配置）。

> AI 调用无需配置任何 API Key——混元模型走微信云开发内置通道，费用计入云开发资源消耗。小程序成长计划的免费资源包仅含 `hy3` 生文模型；如需更多模型（DeepSeek / Kimi / GLM 等），需在控制台切换资源点套餐。

### 🧪 云函数本地测试

```bash
node --test tests/deepseekProxy.spec.js   # 网关全链路（对话 / 生图双模式）
node tests/gatewaySmoke.js                # 对话链路冒烟
```

## 📚 文档

- [产品需求文档（UI 与功能）](docs/PRD_MVP.md) —— 设计规范、页面与组件拆解
- [人设 Prompt 与 API 规范](docs/PERSONA_PROMPT.md) —— 系统人设与调用约定
- [进度交接档案](docs/PROGRESS_HANDOFF.md) —— 架构现状、模型配置与排障记录

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
