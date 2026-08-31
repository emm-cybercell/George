# 桥智同学 · 项目交接与进度档案

> 更新时间：2026-08-31
> 用途：为下一个 Agent 窗口提供无缝接管所需的项目全景、当前进度与下一步计划。

---

## 1. 项目定位与技术栈

**定位**：面向 8-14 岁青少年的 AI 学习小程序「桥智同学」——培养 AI 时代产品经理思维（定义问题 / 判断结果 / 表达自己）。

**技术栈**：
- **框架**：Taro 4.x + React + TypeScript（`build:weapp` 目标微信小程序）
- **样式**：SCSS（Sass），CSS 变量全局 Token
- **后端**：微信云开发（云函数 + 云数据库）+ DeepSeek API（`deepseek-v4-flash` 模型）
- **UI 组件库**：`@nutui/nutui-react-taro`（已装，按需引入配置于 babel，当前页面以自研组件为主）

**环境**：Node 24、Windows、微信开发者工具（appid `wx5ecd4a2c24d8e309`）

---

## 2. 已完成模块与关键修复

### 2.1 首页（`src/pages/home/`）
- 顶部吸顶 HomeHeader（灵动岛避让 `safe-area-inset-top + 68px`）
- Hero 引导卡（跳学习页）
- 「关于桥智同学」「团队与理念」横向通栏卡（竖版无小字，仅徽章+标题+箭头）
- **核心特色：2×2 极简矩阵**（4 大模块，仅图标+粗体标题+主题色条）：
  1. 🔍 桥智观察站（蓝 `#2563EB`）→ `feature-detail?type=observation`
  2. 🧪 桥智实验室（青 `#06B6D4`）→ `?type=lab`
  3. 💬 桥智问未来（绿 `#16A34A`）→ `?type=ask-future`
  4. 📓 桥智成长日记（紫 `#7C3AED`）→ `?type=diary`

### 2.2 学习页（`src/pages/learn/`）
- 三状态交互：`idle`（立绘+快捷提问）/ `thinking`（思考中动效）/ `chatting`（对话流）
- 自适应消息气泡（用户右紫、AI 左白）、`scrollIntoView` 平滑置底
- 顶栏：`＋ 新对话` / `📜 历史` 按钮
- **会话恢复机制**：`BLANK_FLAG` 区分"空白新会话"与"有内容会话"，避免误加载
- 语音转文字（WechatSI 插件 0.3.10，赋值式回调注册）：实时识别回填输入框
- 错误处理：API 层统一 Toast（网络/401/状态码）

### 2.3 我的页（`src/pages/profile/`）
- 用户卡（档案数据）+ 培养方向入口卡（绿色胶囊显示当前能力）+ 通知卡 + 勋章墙 + 菜单
- 培养方向入口：`pages/ability-setting`

### 2.4 二级页面
- `about`：关于桥智（IP 世界观 / 三大教学支柱 / AI 作业红黄绿原则），顶部金句引言
- `team`：团队与理念（孵化背景 / 导师阵容 / 核心主张）
- `feature-detail`：4 大核心特色动态详情页（按 `type` 渲染，slogan + 行动按钮跳学习页）
- `ability-setting`：培养方向设置页（6 项能力单选 + 吸底保存，`current_ability` 本地存储）
- `history`：历史对话（本地会话 + 云端记录双源渲染，搜索清空/删除按钮）

### 2.5 样式避让与质感（全站）
- **灵动岛/刘海超安全边距**：统一 `padding-top: calc(env(safe-area-inset-top) + 68px) !important`
- **顶栏吸顶固定**：`position: sticky/fixed; top: 0; z-index: 999-1000`
- **底部 TabBar 防重叠**：CSS 变量 `--tabbar-h: 100px` 统一 TabBar/输入栏/页面留白
- 卡片质感：20px 圆角、软阴影、按压 `scale(0.97)` 反馈、`fadeInUp` 渐显动画

### 2.6 后端与云函数
- **云函数 `deepseekProxy`**（`cloudfunctions/`，已部署）：
  - DeepSeek API 代理（`deepseek-v4-flash`，API Key 存云函数端）
  - 微信内容安全审核 `security.msgSecCheck`（用户提问 + AI 回答双向校验）
  - 前端 `fetchDeepSeekReply` 已改为 `Taro.cloud.callFunction('deepseekProxy')`
- **云初始化**：`src/app.ts` 中 `Taro.cloud.init({ env: 'cloud1-d3g4mujv731fe8756', traceUser: true })`

### 2.7 关键修复记录
- API Key 曾硬编码客户端 → 改云函数代理
- `process is not defined`（env 注入）→ config `defineConstants` 编译期替换
- WechatSI 回调为**赋值式**注册（`rm.onStart = fn`），非方法调用
- 引号嵌套导致 SCSS/JS 语法错误 → 统一中文弯引号
- Taro 页面模块同名类型导入冲突 → 重命名

---

## 3. 当前正在进行的任务：接入微信云数据库

**目标**：对话记录（`chat_history`）与用户档案（`users`）云端持久化，跨端同步。

已完成的代码（`src/api/cloud.ts` 封装，全部 try-catch 静默降级本地缓存）：
- `saveChatRecordToCloud` / `queryCloudChatRecords` / `clearCloudChatRecords`（chat_history 增查清）
- `syncProfileToCloud` / `fetchCloudUserProfile` / `mergeAbilityFromCloud` / `get/setLocalUserProfile`（users 档案）
- 学习页：回复成功后云端写入对话
- 历史页：云优先渲染，本地会话兜底；清空/删除双写
- 设置页：保存培养方向同步云端
- 我的页：`useDidShow` 云优先拉档案合并本地

**⚠️ 待完成/待验证**：
1. **云数据库集合创建与权限配置**（关键阻塞）：
   - 云开发控制台创建 `chat_history`、`users` 集合
   - 权限建议：仅创建者可读写（依赖云数据库自动 `_openid` 隔离）
2. 真机验证云端读写与审核链路；弱网降级行为
3. （可选）`users` 集合按 `_openid` 的更新策略（当前 add 最新档案 + orderBy updateTime 取最新）

---

## 4. 关键文件与配置清单

| 文件 | 职责 |
|---|---|
| `project.config.json` | 小程序配置：appid、`miniprogramRoot: dist/`、`cloudfunctionRoot: cloudfunctions/`、压缩开关 |
| `src/app.config.ts` | 路由注册（8 页面）、WechatSI 插件 0.3.10、`permission.scope.record`、`navigationStyle: custom` |
| `src/app.ts` | 入口组件，云初始化（env `cloud1-d3g4mujv731fe8756`） |
| `src/app.scss` | 全局 Token（主题色/卡片圆角/`--tabbar-h`）、`fadeInUp` 动画、`.btn-new-chat` |
| `config/index.ts` | Taro 构建配置、`defineConstants` 注入 env |
| `.env.development` | DeepSeek API Key |
| `src/api/deepseek.ts` | 云函数调用封装（system prompt + 培养方向动态注入） |
| `src/api/cloud.ts` | 云数据库封装（chat_history / users + 本地缓存） |
| `src/api/history.ts` | 本地会话存储（save/get/delete/clear） |
| `src/types/index.ts` | 全局类型（TabKey/ChatState/PromptItem/BadgeItem/UserInfo/AbilityItem） |
| `src/types/ability.ts` | 6 项培养能力预设（含 systemGuidance） |
| `src/types/global.d.ts` | 图片模块声明、WechatSI/requirePlugin 类型 |
| `src/pages/home/` | 首页（极简卡片矩阵 + 跳转） |
| `src/pages/learn/` | 学习页（三状态对话、录音、会话恢复） |
| `src/pages/profile/` | 我的页（档案/培养方向/勋章/菜单） |
| `src/pages/history/` | 历史对话（本地+云端双源） |
| `src/pages/about/` | 关于桥智详情页 |
| `src/pages/team/` | 团队与理念详情页 |
| `src/pages/feature-detail/` | 4 大核心特色动态详情页 |
| `src/pages/ability-setting/` | 培养方向设置页 |
| `src/components/` | 公共组件（CustomTabBar/HomeHeader/CustomPageHeader/Hero/InfoCard/PromptPill/ChatInput/Learn/*/Profile/*/RecordingOverlay 已删） |
| `cloudfunctions/deepseekProxy/` | 云函数（DeepSeek 代理 + msgSecCheck 审核） |
| `assets/images/` | 立绘（立绘2.jpg 学习页主形象）、思考.jpg、首页.jpg、桥智同学.jpg |
| `tests/deepseekProxy.spec.js` | 云函数本地 mock 测试（`node tests/deepseekProxy.spec.js`） |

---

## 5. 常用命令与注意

```bash
npm run build:weapp   # 微信小程序生产构建
npm run dev:weapp     # 开发 watch 模式
node tests/deepseekProxy.spec.js  # 云函数本地测试
```

- 微信开发者工具中重新编译会覆盖 `dist/`；
- 云函数改动后需在工具中「上传并部署：云端安装依赖」；
- 开发者工具出现旧构建缓存问题时"清缓存→清除全部"。