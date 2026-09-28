"""
桥智同学 · Embedding 服务（FastAPI + ONNX Runtime）
- 模型：BGE bge-small-zh-v1.5（Xenova ONNX q8 量化，512 维，CLS pooling + L2 归一化）
- 职责：文本 → 归一化向量，供云函数 RAG 稠密召回腿经 HTTP 调用
- 与评测侧 transformers.js 完全同构（同模型/同分词/同池化），保证向量空间一致
- 鉴权：EMBEDDING_API_KEY 环境变量设置后，请求须携带 X-API-Key 头
- 端口：8080（CloudRun 容器端口）
"""
import os
from typing import List

import numpy as np
import onnxruntime as ort
from fastapi import FastAPI, Header, HTTPException
from tokenizers import Tokenizer

MODEL_DIR = os.path.join(os.path.dirname(__file__), "model")
MAX_LEN = 512
API_KEY = os.environ.get("EMBEDDING_API_KEY", "")

app = FastAPI(title="george-embedding-svc", version="1.0.0")

tokenizer = Tokenizer.from_file(os.path.join(MODEL_DIR, "tokenizer.json"))
tokenizer.enable_truncation(max_length=MAX_LEN)

_session = ort.InferenceSession(
    os.path.join(MODEL_DIR, "model_quantized.onnx"),
    providers=["CPUExecutionProvider"],
)
_INPUT_NAMES = {i.name for i in _session.get_inputs()}


def _embed_one(text: str) -> List[float]:
    enc = tokenizer.encode(text)
    ids = np.array([enc.ids], dtype=np.int64)
    mask = np.array([enc.attention_mask], dtype=np.int64)
    feed = {"input_ids": ids, "attention_mask": mask}
    if "token_type_ids" in _INPUT_NAMES:
        feed["token_type_ids"] = np.zeros_like(ids)
    hidden = _session.run(None, feed)[0]          # [1, seq, hidden]
    vec = hidden[0, 0]                            # CLS pooling
    norm = np.linalg.norm(vec) or 1.0
    return (vec / norm).astype(float).tolist()


def _check_auth(x_api_key: str) -> None:
    if API_KEY and x_api_key != API_KEY:
        raise HTTPException(status_code=401, detail="invalid api key")


@app.get("/healthz")
def healthz():
    return {"ok": True, "model": "bge-small-zh-v1.5", "dim": _session.get_outputs()[0].shape[-1] or 512}


@app.post("/embed")
def embed(body: dict, x_api_key: str = Header(default="")):
    _check_auth(x_api_key)
    text = str(body.get("text", "")).strip()
    if not text:
        raise HTTPException(status_code=400, detail="text is required")
    return {"embedding": _embed_one(text[:900])}


@app.post("/embed_batch")
def embed_batch(body: dict, x_api_key: str = Header(default="")):
    _check_auth(x_api_key)
    texts = [str(t)[:900] for t in (body.get("texts") or []) if str(t).strip()]
    if not texts or len(texts) > 64:
        raise HTTPException(status_code=400, detail="texts must be 1-64 items")
    return {"embeddings": [_embed_one(t) for t in texts]}
