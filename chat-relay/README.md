# Chat Relay（流式对话中继）

桥智同学 SSE 流式对话服务：把 CloudBase 网关 `/chat/completions` 的流式响应透传给小程序（`wx.request enableChunked` 分块接收），实现打字机渐进渲染。

## 架构定位

- **范围**：纯对话流式（闲聊/追问，无工具调用）——占日常对话大头，流式收益最大；
- **知识问答仍走云函数全量链路**（ReAct 循环 + RAG + trace + 监控）——前端 `streamChat` 失败或 relay 未配置时自动回退；
- 与 `embedding-svc` 同构：CloudRun 容器、模型无关、X-API-Key 鉴权、MinNum=0 闲时缩容。

## 接口

| 方法 | 路径 | 说明 |
|---|---|---|
| GET | `/healthz` | 健康检查（返回网关配置状态） |
| POST | `/chat` | `{messages:[{role,content}]}` → SSE：`data: {"delta":"..."}` 帧 + `data: [DONE]`；网关故障发 `data: {"error":"..."}` 帧（前端立即降级，不等待超时） |

鉴权：`CHAT_RELAY_API_KEY` 环境变量设置后，请求须携带 `X-API-Key` 头。网关 Key 经 `CB_GATEWAY_KEY/URL` 环境变量注入（与云函数同源，永不进代码库）。

## 错误路径（本地已全部验证）

- 未配网关 Key → `/chat` 直接 503（快速失败）；
- 网关不可达/DNS 失败 → SSE error 帧 `gateway unreachable`（秒级，前端立即回退）；
- 网关拒绝（401/429…）→ SSE error 帧 `gateway <status>`；
- 无效 API Key → HTTP 401。

## 部署（2026-10-09 已上线）

CloudRun 服务 `chat-relay`：Cpu 1 / Mem 2 / MinNum 0 / Port 8080。域名 `https://chat-relay-320752-4-1476112672.sh.run.tcloudbase.com`。

小程序侧开启方式：storage 写入 `chat_relay_config = {url, key}`（`src/config/relay.ts`），不配置即功能关闭（默认安全态）。

## 本地运行

```bash
cd chat-relay
python -m venv .venv && .venv/Scripts/pip install -r requirements.txt
CB_GATEWAY_URL=<网关地址> CB_GATEWAY_KEY=<Key> CHAT_RELAY_API_KEY=test \
  .venv/Scripts/python -m uvicorn main:app --port 8080
curl -N -X POST localhost:8080/chat -H "Content-Type: application/json" \
  -H "X-API-Key: test" -d '{"messages":[{"role":"user","content":"你好"}]}'
```

注意：本地 Windows 开发机需 `trust_env=False`（代码已内置）绕过系统代理拦截 `tcloudbasegateway` 域名。
