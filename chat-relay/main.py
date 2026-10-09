"""
桥智同学 · 流式对话中继（FastAPI + SSE）
- 职责：把 CloudBase 网关 /chat/completions 的流式响应（SSE）透传给小程序
  （wx.request enableChunked 不支持跨域/直连网关，需经本服务转手）
- 范围：纯对话流式（闲聊/追问场景）；需要工具调用的知识问答仍走云函数全量链路
- 鉴权：CHAT_RELAY_API_KEY 环境变量设置后，请求须携带 X-API-Key 头
- 端口：8080（CloudRun 容器端口）
"""
import os
import json
import httpx
from fastapi import FastAPI, Header, HTTPException
from fastapi.responses import StreamingResponse

GATEWAY_URL = os.environ.get("CB_GATEWAY_URL", "")
GATEWAY_KEY = os.environ.get("CB_GATEWAY_KEY", "")
MODEL = "hy3"
API_KEY = os.environ.get("CHAT_RELAY_API_KEY", "")
TIMEOUT = httpx.Timeout(60.0, connect=5.0)  # default 60s，连接阶段 5s 快速失败

app = FastAPI(title="george-chat-relay", version="1.0.0")


def _check_auth(x_api_key: str) -> None:
    if API_KEY and x_api_key != API_KEY:
        raise HTTPException(status_code=401, detail="invalid api key")


@app.get("/healthz")
def healthz():
    return {"ok": True, "gateway_configured": bool(GATEWAY_URL and GATEWAY_KEY)}


@app.post("/chat")
async def chat(body: dict, x_api_key: str = Header(default="")):
    """流式对话：{messages: [{role, content}]} → SSE（data: {delta} ... data: [DONE]）"""
    _check_auth(x_api_key)
    if not (GATEWAY_URL and GATEWAY_KEY):
        raise HTTPException(status_code=503, detail="gateway not configured")
    messages = body.get("messages") or []
    if not messages:
        raise HTTPException(status_code=400, detail="messages is required")
    # 只保留 role/content，防注入未知字段；上限保护
    clean = [
        {"role": str(m.get("role", "user"))[:16], "content": str(m.get("content", ""))[:4000]}
        for m in messages[-20:]
        if m.get("content")
    ]

    async def stream():
        payload = {
            "model": MODEL,
            "messages": clean,
            "stream": True,
            "temperature": 0.7,
        }
        headers = {
            "Authorization": f"Bearer {GATEWAY_KEY}",
            "Content-Type": "application/json",
        }
        try:
            # trust_env=False：CloudRun 内直连网关不走系统代理；本地 Windows 开发机的系统代理会拦 tcloudbasegateway 域名
            client = httpx.AsyncClient(timeout=TIMEOUT, trust_env=False)
            resp = await client.send(
                client.build_request(
                    "POST",
                    f"{GATEWAY_URL}/chat/completions",
                    json=payload,
                    headers=headers,
                ),
                stream=True,
            )
        except Exception:
            # 连接阶段失败（网关不可达/DNS 等）：立即产出 SSE 错误帧让前端降级，不让其等到超时
            yield f'data: {json.dumps({"error": "gateway unreachable"}, ensure_ascii=False)}\n\n'
            return
        try:
            if resp.status_code != 200:
                yield f'data: {json.dumps({"error": f"gateway {resp.status_code}"}, ensure_ascii=False)}\n\n'
                return
            async for line in resp.aiter_lines():
                if not line.startswith("data:"):
                    continue
                chunk = line[5:].strip()
                if chunk == "[DONE]":
                    yield "data: [DONE]\n\n"
                    return
                try:
                    obj = json.loads(chunk)
                    delta = obj["choices"][0]["delta"].get("content", "")
                except Exception:
                    continue
                if delta:
                    yield f'data: {json.dumps({"delta": delta}, ensure_ascii=False)}\n\n'
        finally:
            await resp.aclose()
            await client.aclose()

    return StreamingResponse(
        stream(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )
