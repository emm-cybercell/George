# 桥智同学 MCP Server

把小程序 Agent 的 5 个工具（`search_knowledge` / `recommend_challenge` / `summarize_session` / `award_growth_points` / `save_creative_portfolio`）通过 **MCP 协议**暴露给任意宿主（Claude Desktop、Cursor 等）。

**一次注册，多端复用**：本服务直接 `require` 云函数里同一份工具定义与执行器（`cloudfunctions/deepseekProxy/tools/`），小程序用户和 MCP 宿主调用的是完全一致的能力——这正是 MCP 的设计哲学。

## 本地运行（stdio）

```bash
cd mcp-server
npm install

# 数据库凭据（三选一）：
# 1) 临时密钥（推荐演示用，CloudBase MCP: auth get_temp_credentials 获取）
export TCB_ENV_ID=cloud1-xxxx
export TCB_SECRET_ID=AKIDxxxx
export TCB_SECRET_KEY=xxxx
export TCB_TOKEN=xxxx        # 临时密钥必填；固定密钥留空
# 2) 固定密钥（腾讯云 API 密钥，授权 CloudBase 资源）
# 3) 不设变量 → 使用 CloudRun 注入的运行时凭据（部署场景）

npm run smoke   # 冒烟：initialize → tools/list → 真实调用 search_knowledge
```

## Claude Desktop 配置

`claude_desktop_config.json`（Settings → Developer → Edit Config）：

```json
{
  "mcpServers": {
    "george-tutor": {
      "command": "node",
      "args": ["D:/emm/vscodeproject/George/mcp-server/index.js"],
      "env": {
        "TCB_ENV_ID": "cloud1-xxxx",
        "TCB_SECRET_ID": "AKIDxxxx",
        "TCB_SECRET_KEY": "xxxx",
        "TCB_TOKEN": "xxxx"
      }
    }
  }
}
```

## Cursor 配置

`.cursor/mcp.json`（项目级）或全局 MCP 设置：

```json
{
  "mcpServers": {
    "george-tutor": {
      "command": "node",
      "args": ["D:/emm/vscodeproject/George/mcp-server/index.js"],
      "env": {
        "TCB_ENV_ID": "cloud1-xxxx",
        "TCB_SECRET_ID": "AKIDxxxx",
        "TCB_SECRET_KEY": "xxxx",
        "TCB_TOKEN": "xxxx"
      }
    }
  }
}
```

配置后即可对 Claude/Cursor 说：「用 search_knowledge 查一下乘除运算顺序」。

## 说明

- **用户隔离**：MCP 宿主调用统一挂到伪用户 `mcp-demo-user`（`MCP_USER` 环境变量可改）；个人材料库、成长积分按该标识隔离。
- **凭据安全**：临时密钥有时效（过期后重新获取即可）；固定密钥只给 CloudBase 资源授权，不要提交进仓库。
- **云上部署**：代码零改动可部署 CloudRun 容器（运行时自动注入凭据），加 Streamable HTTP 传输与 API Key 鉴权后即成为公网 MCP 端点。
- **写操作工具**（`award_growth_points` / `save_creative_portfolio` / `summarize_session`）会真实写库，演示时注意。
