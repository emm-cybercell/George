# 桥智同学 · 项目交接与进度档案

> 更新时间：2026-09-12
> 用途：为下一个 Agent（zcode）提供无缝接管所需的项目全景、当前进度、工程习惯与下一步计划。
> 请 zcode 先读本档案 + `docs/PRD_MVP.md` + `.github/copilot-instructions.md`，再动手。

---

## 1. 项目定位与技术栈

**定位**：面向 8-14 岁青少年的 AI 学习小程序「桥智同学」——培养 AI 时代产品经理思维（定义问题 / 判断结果 / 表达自己）。

**技术栈**：

- **框架**：Taro 4.x + React + TypeScript（`npm run build:weapp` 目标微信小程序）
- **样式**：SCSS（Sass），CSS 变量全局 Token
- **后端**：微信云开发（云函数 `deepseekProxy` + 云数据库）
- **大模型**：**腾讯云开发 AI 能力**（混元 `hy4-preview`/`hy3` 生文；`HY-Image-*` 混元生图），云函数端走 **wx-server-sdk ≥4.0.1 的 `cloud.ai()`**（`createModel('cloudbase').generateText` / `createImageModel('hunyuan-image').generateImage`）。⚠️ 旧 `cloud.openapi.ai.callOpenAI` 已下线（报 -604100 API not found），勿再使用
- **UI 组件库**：`@nutui/nutui-react-taro`（已装，当前以自研组件为主）
- **环境**：Node 24、Windows、微信开发者工具（appid `wx5ecd4a2c24d8e309`，云环境 `cloud1-d3g4mujv731fe8756`）

---

## 2. 工程习惯与硬性规范（务必遵守）

1. **单文件 ≤150 行**：任何 `.ts`/`.tsx` 超 150 行必须拆分为 `src/components/` 子组件或 `src/hooks/`。⚠️ IDE 若开启保存时格式化会把紧凑代码展开回退超行，改完超行需手动压回（或与用户确认关闭"保存时格式化"）。
2. **TypeScript 强类型**：严禁 `any`，所有 Props/State/API 返回在 `src/types/` 定义。
3. **逻辑与 UI 分离**：页面只拼组件，网络请求在 `src/api/`，复杂状态在 `src/hooks/`。
4. **灵动岛避让**：**新增页面顶栏一律 `padding-top: calc(env(safe-area-inset-top) + 150px) !important;`**（用户明确要求，见 `/memories/顶栏避让规范.md`）。现有页面不同数值保持不动（home/learn 160px、portfolio 150/160px、CustomPageHeader 68px）。
5. **云能力降级**：所有云操作 try-catch 静默降级本地，绝不让界面白屏。
6. **`@/` 别名** → `src/`；资源统一在 `src/assets/images/`。

---

## 3. 目录结构（当前最新）

- `src/`：唯一前端工作区（`pages` 11 页 / `components` / `hooks` / `api` / `types` / `utils` / `assets`）
- `cloudfunctions/deepseekProxy/`：云函数（`index.js` + `config.js` + `llmClient.js` + `core/agentRunner.js` + `tools/index.js`）
- `docs/`：PRD、交接档案、参考资料
- `tests/`：云函数本地测试（`gatewaySmoke.js` / `probeChannels.js` 等）
- 已删除死代码：`HomeHeader`、`Home/Hero`、`Home/InfoCard`、`home/data.ts`、根目录 `assets/`、根目录 `types/`、冗余 `cloud.ts`/`cloudUser.ts`

---

## 4. 已完成模块

### 4.1 首页（Bento Grid 全新重构）

- 简约清新科技风：`#F8FAFC` 冷灰底、毛玻璃吸顶 Header、卡片 22px 圆角 + 细边框 + 软阴影
- Header 右侧操作区 `margin-right: 108px` 避让微信胶囊
- Hero 横幅 + **非对称 Bento 卡**（实验室大卡/观察站/问未来/成长日记）+ **💡今日灵感探索卡**（随机脑洞问题直达学习页 `?prompt=`）+ 底部双栏功能卡
- 组件：`Home/InspirationCard`、`Home/FooterCards`

### 4.2 学习页（核心对话 + 多媒体 + 生图）

- 三状态（idle/thinking/chatting）、微信式消息行（`ChattingState/MessageRow.tsx`：助手/用户各自头像 + 气泡，语音按钮随行）、`scrollIntoView` 置底
- **会话恢复**：`?new=1` / `?historyId=`（云端单条）/ `?sessionId=`（本地）/ `?prompt=`（首页灵感直达自动提问）
- 语音转文字（WechatSI 插件，**赋值式回调注册** `onStart=fn` 不能用方法调用）
- **TTS 语音朗读**（`utils/tts.ts`）：合成防重入锁 + 播放/暂停状态机；音色固定为微信插件男声，智谱童声需充值
- **多媒体上传**：`+` 按钮 → `MediaPanel`（拍照/相册/文件 + AI 生图入口）→ `works.ts` 云上传
- **AI 生图**：`+` 面板 → 「🎨 AI 生图」→ `ImageGenPanel`（**文生图 / 图生图双模式**，i2i 选参考图）→ 图片消息插入对话
- 思考态：首条消息等待显示紧凑思考动画（120px），已有对话时在消息流末尾显示"正在输入"三点气泡，不遮挡内容
- 页头：「＋新对话 / 📜 历史」居左横排，标题文字居右同高
- 积分飘字/升级/勋章激励反馈（`onDidReply` 回调）

### 4.3 用户体系与激励（云端持久化）

- `api/user.ts` + `api/rewards.ts`：`getOrInitUserAccount` 自动建档、`updateUserProfile`、`handleDailyCheckIn`（+20/连续天数/streak_3）、`awardChatPoints`（+10/等级/勋章）、`checkAbilitySwitchBadge`
- `types/`：`FullUserAccount`、`BADGE_DEFINITIONS` 勋章图鉴、`CreativeWork` 作品模型
- 我的页：真实用户卡 + 打卡按钮 + 勋章墙（解锁发光/未解锁蒙层）+ 编辑档案弹层

### 4.4 作品集

- `pages/portfolio` + `Portfolio/WorkCard`：Tab 分类筛选 + 4:3 瀑布流 + 封面预览 + 悬浮添加作品

### 4.5 二级页

- 消息通知中心（Tab 筛选/已读态/空态）、系统设置（TTS/震动开关/清缓存/隐私/重置）、历史对话（云端+本地双源）、培养方向设置、about/team/feature-detail

### 4.6 云函数（多模型网关 + Agent）

- **多模型网关**：`config.js` 默认配置 + `system_configs`（`_id: llm_active`）动态热更
- **ReAct Agent**：`core/agentRunner.js` 3 轮 Function Calling 循环 + `tools/index.js`（`award_growth_points` / `save_creative_portfolio`）+ `llmClient.js`（OpenAI/Anthropic/wxai 协议）
- **生图分支**：`index.js` 的 `event.type === 'image'`

---

## 5. ⚠️ 模型配置现状（用户最新要求，重要）

**当前生效（默认激活）：腾讯混元 via `cloud.openapi.ai.callOpenAI`（`protocol: 'wxai'`）**

| 用途         | 模型                                    | 说明                                                         |
| ------------ | --------------------------------------- | ------------------------------------------------------------ |
| 生文（对话） | `hy3`（固定，成长计划免费包唯一可用）   | 2026-09-13 起移除 hy4-preview 与模型切换功能（用户要求）     |
| 生图         | 文生图 `HY-Image-3.0-Plus-4090-Tob-v1.0` / 图生图 `HY-Image-v3.0-I2I-ToB-v1.0.1` | ImageGenPanel 双模式切换；i2i 垫图 base64 直传（不占云存储） |

**⚠️ hy4-preview 超时结论**：小程序成长计划赠送 AI 资源包**仅含 hy3**（官方升级指南 https://docs.cloudbase.net/ai/ai-inspire-plan-upgrade ）；DeepSeek/Kimi/GLM/hy4 等更多模型需在 套餐管理 切换**资源点套餐**。可选模型以控制台 AI+ → 模型管理 列表为准。云函数已加 25s 快速超时 + 超时提示，避免占满 30s 云函数时长。

**2026-09-13 大清理**：删除未引用图片 8 张（约 2.6MB）、`tests/probeModels.js`/`probeChannels.js`（阿里云探测脚本）、`src/api/bigmodel.ts`（智谱旧封装）、`.env*`、`llmClient.js`（第三方 HTTP 适配层）、axios 依赖；`config.js` 收敛为 wxai 单供应商。AI 能力只保留微信云开发官方通道，**勿再加回第三方供应商**。

**模型切换能力（已实现，2026-09-12）：**

- 对话模型：学习页「+」面板 → 「🤖 切换对话模型」在 `hy4-preview` / `hy3` 间切换，选择持久化本地（`src/api/deepseek.ts` 的 `CHAT_MODELS` / `getChatModel`），云函数 `index.js` 白名单校验
- 生图模型：学习页「+」面板 → 「🎨 AI 生图」→ `ImageGenPanel` 内选 `HY-Image-*` 双模型；云函数 `IMAGE_MODELS` 白名单
- 页头仅保留「＋新对话 / 📜 历史」横排（模型与生图入口已收进「+」面板）

**⚠️ 部署排障记录（2026-09-12）**：对话报 `LLM 请求失败 [deepseek]: api key invalid`，根因是云数据库 `system_configs` 文档 `llm_active` 的 `activeProvider` 残留 `"deepseek"`，覆盖了代码默认 `wxai`。修复：控制台把该文档 `activeProvider` 改为 `"wxai"`（或删除该文档走代码默认）。云函数需「上传并部署：云端安装依赖」+ 超时 30s+。
后续报 `errCode: -604100 API not found`：**根因是 `cloud.openapi.ai.callOpenAI` 接口已整体下线**，非权限声明问题。已按官方文档迁移到 wx-server-sdk ≥4.0.1 的 `cloud.ai()`（生文 `createModel('cloudbase').generateText` + `registerFunctionTool` 自动工具循环；生图 `createImageModel('hunyuan-image').generateImage`），`package.json` 的 wx-server-sdk 已升 `^4.0.1`。**部署必须选「上传并部署：云端安装依赖」**（拉新 SDK），并保持超时 30s+。另 `config.js` 的 DB 覆盖已收敛为白名单字段（activeProvider/model/temperature/max_tokens），apiKey/baseURL 不再可被文档劫持。

**历史遗留**：智谱 GLM key、阿里云百炼 key 仍在 `config.js` 作为可选供应商（`glm`/`aliyun`/`aliyunAnthropic`），但都已欠费/无权限，**不要切回为默认**。用户给过的高权限云开发 JWT 实测无法直连 HTTP 调模型（仅管理面 key），不要用。

---

## 6. 云数据库集合

| 集合                       | 用途                       | 权限                            |
| -------------------------- | -------------------------- | ------------------------------- |
| `chat_history`             | 对话记录                   | 仅创建者可读写（\_openid 隔离） |
| `users`                    | 用户档案（profile/growth） | 仅创建者可读写                  |
| `creative_works` / `works` | 作品集                     | 仅创建者可读写                  |
| `system_configs`           | `_id: llm_active` 模型热更 | 管理端                          |
| `notifications`            | 通知（可选）               | 仅创建者可读写                  |

---

## 7. 当前阻塞点 / 待办

1. **模型切换能力**：确认 `hy4-preview`↔`hy3`、生图双模型切换已实现（见第 5 节）。
2. **云开发控制台**：需开通**资源点套餐** + 生文/生图模型，否则 `callOpenAI` 报错。
3. **TTS 音色**：当前微信插件男声固定；智谱童声需充值（`cogtts` 的 `tongtong`）。
4. **云函数超时**：控制台需将 `deepseekProxy` 超时设到 30s+（默认 3s 必超时）。
5. **TTS/响应慢**：`playTextVoice` 在回复后合成 1-2s；若要更快需流式改造。

---

## 8. 常用命令

```bash
npm run build:weapp     # 微信小程序生产构建
npm run dev:weapp       # 开发 watch
npx tsc --noEmit -p tsconfig.json  # TS 全量类型检查
node tests/gatewaySmoke.js  # 云函数链路冒烟（需真实模型可用）
node --check cloudfunctions/deepseekProxy/index.js  # 云函数语法检查
```

- 云函数改动后在开发者工具「上传并部署：云端安装依赖」（选"更新"避免 ResourceInUse）
- 云函数超时在控制台单独调（`config.json` 无 timeout 字段）
- 改动云函数后建议先 `node --check` 再部署

---

## 9. 关键配置值速查

- 云环境 ID：`cloud1-d3g4mujv731fe8756`
- 微信 appid：`wx5ecd4a2c24d8e309`
- 腾讯混元生文模型：`hy4-preview` / `hy3`
- 腾讯混元生图模型：`HY-Image-3.0-Plus-4090-Tob-v1.0` / `HY-Image-v3.0-I2I-ToB-v1.0.1`
- WechatSI 插件：`0.3.10`（provider `wx069ba97219f66d99`）
