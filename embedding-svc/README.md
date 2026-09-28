# Embedding 服务（FastAPI + ONNX Runtime）

桥智同学 RAG 稠密召回腿的向量服务：文本 → BGE 归一化向量，部署于 CloudBase 云托管（CloudRun 容器），云函数 `ragPipeline.js` 经 HTTP 调用。模型选型依据 `evals/reports/2026-09-28-dense-leg.md`（稠密召回使 Recall@3 从 0.928 → 0.982）。

## 架构

```
小程序 → deepseekProxy 云函数 ──HTTP──→ embedding-svc（CloudRun 容器，本服务）
                │                            BGE bge-small-zh-v1.5 (ONNX q8, 512维)
                └─ 稠密召回(内存余弦) → LLM 重排 → topK
                     └ 服务不可用时降级：稀疏 TF-IDF 召回 → LLM 重排
```

- 模型烘进镜像（构建时 COPY，运行时零冷下载）；CPU 推理单条 ~3ms
- 与评测侧 `evals/vectorSearch.js`（transformers.js）完全同构，跨语言向量一致性已实测验证

## 接口

| 方法 | 路径 | 说明 |
|---|---|---|
| GET | `/healthz` | 健康检查（返回模型与维度） |
| POST | `/embed` | `{text}` → `{embedding: [512]}`，单条 |
| POST | `/embed_batch` | `{texts: [...]}`（1-64 条）→ `{embeddings: [[512]]}` |

鉴权：设置环境变量 `EMBEDDING_API_KEY` 后，请求须携带 `X-API-Key` 头。

## 本地运行

```bash
cd embedding-svc
python -m venv .venv && .venv/Scripts/pip install -r requirements.txt
EMBEDDING_API_KEY=test .venv/Scripts/python -m uvicorn main:app --port 8080
curl -X POST localhost:8080/embed -H "Content-Type: application/json" \
  -H "X-API-Key: test" -d '{"text":"乘除哪个先算"}'
```

## 部署到 CloudBase 云托管

前置：环境需开通云托管（控制台 → 云托管 → 开通，按量计费）。

```bash
# 方式一：CloudBase MCP manageCloudRun deploy
#   serverName: embedding-svc, serverType: container, targetPath: 本目录
#   serverConfig: Cpu 0.25 / Mem 0.5 / MinNum 0（闲时缩容到 0）/ MaxNum 2 / Port 8080
#   EnvParams: {"EMBEDDING_API_KEY": "<生成一个随机串>"}
# 方式二：tcb CLI（equivalent）
tcb cloudrun deploy embedding-svc --dir . --container
```

部署后从 `queryCloudRun detail` 获取公网域名，配置到云函数环境变量：

```
EMBEDDING_SVC_URL = https://<公网域名>      # 或内网域名（同环境内网调用免流量费）
EMBEDDING_SVC_KEY = <与 EnvParams 一致>
```

## 文件说明

- `main.py`：FastAPI 服务（tokenizers 分词 → onnxruntime 推理 → CLS pooling → L2 归一化）
- `model/`：模型文件（`model_quantized.onnx` 23MB + `tokenizer.json`），**已 gitignore**，
  下载命令：`curl -L https://hf-mirror.com/Xenova/bge-small-zh-v1.5/resolve/main/onnx/model_quantized.onnx -o model/model_quantized.onnx`（另需 config.json / tokenizer.json）
- `.venv/`：本地虚拟环境（gitignore）
