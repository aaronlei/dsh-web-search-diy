# dsh-web-search-diy

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

**DeepSeek Harness（DSH）网页搜索提供方插件**：把内置 `web_search` 工具接到
**千问 Token Plan** 的 OpenAI 兼容 **Responses API** 及其原生 **`web_search`** 工具上。

- 默认模型：`deepseek-v4-flash-0731`
- 默认端点：`https://token-plan.cn-beijing.maas.aliyuncs.com/compatible-mode/v1`
- 默认密钥引用：`QWEN_TOKEN_PLAN_CN_API_KEY`

## 为什么

DSH 自带的搜索提供方（`deepseek-official`）走的是 DeepSeek 自家 Anthropic 兼容
端点——它指不到千问 Token Plan（该网关没有 Anthropic 路由），而且部署时要
切换很麻烦。本插件是**一等公民插件**：向 `ctx.web` 注册搜索提供方，并把共享的
`searchProvider` 覆盖到它，与生态内其他提供方插件一致。搜索模型与对话模型完全
解耦——任意对话模型都可以搭配使用。

> **为什么用 Responses API？** 千问 Token Plan 的内置联网搜索只在 Responses API
> （`/responses`）上、且显式声明 `tools: [{type: "web_search"}]` 时才会触发——
> Chat Completions 的 `enable_search` 参数在该网关上会被静默忽略。本插件走
> Responses 协议，并解析 `web_search_call` 块里结构化的 `action.sources` 为
> seam 标准的引用来源。

## 安装

已发布到 npm：

```bash
dsh plugin --profile web add dsh-web-search-diy
```

bundle patch 会（无需手动改 `cordis.patch.yml`）：
- 插入 `web-search-diy` loader 条目
- 覆盖共享 `web` 行：`searchProvider: diy-search`，并补回
  `fetchProvider: http`（patch 会整段替换该行 config）
- 禁用官方 DeepSeek 搜索插件 `web-search-deepseek`

本地开发调试：以本地链接方式安装 checkout（与其他本地插件一致）：

```bash
dsh plugin --profile web add link:./dsh-web-search-diy
```

（将 `./dsh-web-search-diy` 替换为你本地 checkout 的实际路径）

> **本地链接安装注意**：插件把 `@deepseek-ai/*` 钩子声明为 `peerDependencies`
> （并在 `devDependencies` 镜像）。链接包会优先解析自身 `node_modules`，所以
> 首次请在插件目录运行一次 `pnpm install`；运行时 peer 由 harness 安装提供。

## 配置

选项优先级：**UI 管理文件（`$DSH_HOME/dsh-web-search-diy.json`，由设置卡片写入）
> settings 段 / entry 配置 > 包默认值。**

| 键 | 默认值 | 含义 |
|---|---|---|
| `apiKey` | — | 字面 API key；设置时优先于 `apiKeyEnv` |
| `apiKeyEnv` | `QWEN_TOKEN_PLAN_CN_API_KEY` | 每次搜索经 `ctx.credentials` 解析的凭据引用 |
| `baseURL` | `https://token-plan.cn-beijing.maas.aliyuncs.com/compatible-mode/v1` | Responses API 基址；自动追加 `/responses` |
| `model` | `deepseek-v4-flash-0731` | 端点承载的模型（任意带 `web_search` 的 Responses-API 模型都可用） |
| `maxOutputTokens` | `1024` | 单次搜索的 `max_output_tokens` |

### 示例

```yaml
# ~/.dsh/settings.yaml
web-search-diy:
  model: deepseek-v4-flash-0731
```

## 工作原理

```
你 ──> 对话 LLM
            │ 需要实时信息时
            ▼
      web_search 工具（与模型无关）
            │ ctx.web seam ──> diy-search 提供方
            ▼
      POST {baseURL}/responses
      tools: [{ type: "web_search" }]
            │
            ▼
      千问 Token Plan deepseek-v4-flash-0731 ──> 结构化 web_search_call sources
            │
            ▼
      对话 LLM 基于搜索结果作答
```

每次搜索是一次 Responses API 调用（完整的一轮模型推理）。结果返回去重后的
`sources[]`（url + `url_citation` 注解提供的可选标题）以及模型生成的
`content`。响应中若没有任何 `web_search_call` 块，则以 `WEB_PROVIDER_ERROR`
响亮失败——绝不做从文本里扒链接的降级。

## 凭据

在 Web 的 **Models** 页 / 凭据服务里用 `QWEN_TOKEN_PLAN_CN_API_KEY` 保存密钥，
或在启动环境中导出。提供方每次搜索动态解析，不在自身保留密钥。

## 许可证

[MIT](LICENSE)