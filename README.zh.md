# dsh-web-search-diy

[English](README.md) · **简体中文**

<p align="center">
  <a href="https://www.npmjs.com/package/dsh-web-search-diy"><img alt="npm 版本" src="https://img.shields.io/npm/v/dsh-web-search-diy?style=flat-square&amp;label=npm&amp;color=cb3837"></a>
  <a href="LICENSE"><img alt="许可证：MIT" src="https://img.shields.io/npm/l/dsh-web-search-diy?style=flat-square&amp;color=blue"></a>
  <a href="package.json"><img alt="Node &gt;= 18" src="https://img.shields.io/badge/node-%3E%3D18-339933?style=flat-square&amp;logo=nodedotjs&amp;logoColor=white"></a>
  <a href="#能力矩阵"><img alt="厂商：7" src="https://img.shields.io/badge/vendors-7-8A2BE2?style=flat-square"></a>
  <a href="#能力矩阵"><img alt="协议：4" src="https://img.shields.io/badge/protocols-4-8A2BE2?style=flat-square"></a>
  <a href="https://github.com/deepseek-ai/deepseek-harness"><img alt="dsh 插件" src="https://img.shields.io/badge/dsh-plugin-4D6BFE?style=flat-square"></a>
</p>

> **DeepSeek Harness（DSH）网页搜索提供方插件**。按「厂商 × 协议」为内置 `web_search` 工具提供后端：三种协议内置搜索（Chat Completions / Responses / Anthropic Messages）与纯工具搜索，覆盖 DeepSeek、Kimi、智谱、千问、OpenAI、Anthropic、OpenRouter，并提供四个自定义入口。结果统一归一为**结构化引用来源**，供调用方模型作为作答依据。

## 核心能力

- 🧭 **厂商 × 协议矩阵** —— 17 个官方 target（13 完整 + 4 降级）与 4 个自定义入口；只有真实能搜索的组合会出现在厂商列表，其余放进「本版未接入的组合」并给出原因。
- 🎛️ **配置页三层选择** —— 搜索方式 → 协议 → 厂商；字段由 Host 下发的 catalog 决定，留空即用该组合的默认值。
- 🧩 **自定义接入** —— 模板下拉只做一次性填充（选完清空、不保存）；端点、路径、请求字段名与响应字段名都可覆盖。
- 🧪 **测试连接** —— 用当前草稿跑一次真实搜索（不写盘），按来源质量分档提示。
- 🔐 **凭据只写** —— API key 经凭据服务保存，不写入配置文件；引用名按厂商给出候选链。
- 🗂️ **配置 v3** —— 按 `vendor/protocol` 分桶；v1/v2 读取时迁移，首次保存前备份 `.v2.bak`。
- 🪜 **思考档位自动降级** —— 被端点 400 拒绝的 `reasoning.effort` / `output_config` / `thinking` 会逐个移除后重试。
- 📦 **响应解码对 dispatcher 免疫** —— 按字节读取并按魔数解压，不受 dsh 全局 undici dispatcher 影响。

## 能力矩阵

图例：✅ 完整（协议内搜索 + 可引用来源）；◐ 降级（能搜，但来源或模型受限）；✗ 不支持；⚙ 自定义。

| 厂商 | Chat Completions | Responses | Anthropic Messages | 纯工具搜索 |
|---|---|---|---|---|
| DeepSeek | ✗ | ◐ 仅 `deepseek-v4-pro`，来源靠 `open_page` | ✅ | ✅ `/v1/tools/search` |
| Kimi | ✗ 内置 `$web_search` 下线 | ✅ `web_search` + `include` | ✗ 工具 schema 无服务端搜索 | ✅ `/v1/tools/search` |
| 智谱 | ✅ `web_search` tool | ✅ `web_search` + `results[]` | ✗ 接受但不执行 | ✅ `/paas/v4/web_search` |
| 千问 | ◐ `enable_search`，无来源 | ✅ `action.sources`（仅 url） | ✅ 需 billing header | ✗ 无独立 REST |
| OpenAI | ◐ 仅 `gpt-5-search-api` | ✅ 完整 `filters` / `include` | ✗ 无该端点 | ✗ |
| Anthropic | ✗ | ✗ | ✅ 原生 `web_search` | ✗ |
| OpenRouter | ✅ `openrouter:web_search` | ✅ 同一 server tool | ◐ 别名，待测 | ✗ |
| 自定义 | ⚙ 模板 + 四变体 | ⚙ 模板 + `toolType` | ⚙ 模板 + `toolType` | ⚙ 模板 + 8 个映射字段 |

> 完整 13 个、降级 4 个（其中 OpenRouter Anthropic 待实测）、自定义 4 个。另有 8 条 `unsupported` 元数据只用于折叠区说明，不生成配置桶。

## 安装

已发布到 npm：

```bash
dsh plugin --profile web add dsh-web-search-diy
```

bundle patch 会自动完成接线，无需手改 `cordis.patch.yml`：

- 插入 `web-search-diy` loader 条目；
- 覆盖共享 `web` 行：`searchProvider: diy-search`，并补回 `fetchProvider: http`（patch 会整段替换该行 config）；
- 禁用官方 `web-search-deepseek` 提供方。

本地开发用链接安装：

```bash
dsh plugin --profile web add link:./dsh-web-search-diy
```

> 插件把 `@deepseek-ai/*` 钩子声明为 `peerDependencies`。链接安装时先在插件目录运行一次 `pnpm install`；运行时 peer 由 harness 提供。

## 配置

### 配置页

位置：侧栏 **插件 → dsh-web-search-diy → `web-search-diy` 行的「配置」**。页面跟随 设置 → 语言（zh / en）。

- **搜索方式**：`协议内置搜索` 与 `纯工具搜索`；纯工具没有模型回合，表单不显示模型与输出上限。
- **协议**：内置下三选一（Chat Completions / Responses / Anthropic Messages）；纯工具固定 `search`。
- **厂商**：只列该协议下可用的厂商；降级组合在卡片内标注原因；不支持的组合按当前形态收进折叠区。
- **字段**：留空即用 catalog 默认值（显示为 placeholder）。清空并保存会删除该键。
- **模板（仅自定义）**：下拉一次性填充，选完即清空，placeholder 提示刚用过的模板；模板本身不保存。若该 target 已有保存配置，切换模板前会提示「将覆盖当前配置」，并提供「重置为已保存配置」。
- **保存**：切换厂商/协议本身也算一次待保存变更；保存即生效（Host 每次搜索重新读取文件）。
- **API 密钥**：只写凭据服务，不落配置文件；留空表示保持当前密钥。

### 配置文件（v3）

`$DSH_HOME/dsh-web-search-diy.json`，由配置页写入：

```json
{
  "version": 3,
  "vendor": "qwen",
  "protocol": "responses",
  "targets": {
    "qwen/responses": {
      "baseURL": "https://maas.qianwenaiapi.com/compatible-mode/v1",
      "apiKeyEnv": "QWEN_TOKEN_PLAN_API_KEY",
      "model": "qwen3.8-flash",
      "maxOutputTokens": 4096,
      "toolType": "web_search",
      "includeSources": true
    },
    "custom/search": {
      "baseURL": "https://search-gateway.example.com",
      "path": "/v1/tools/search",
      "apiKeyEnv": "SEARCH_GATEWAY_API_KEY",
      "queryField": "q",
      "countField": "size",
      "resultsPath": "data.items",
      "urlField": "link",
      "titleField": "name",
      "snippetField": "desc",
      "count": 10
    }
  }
}
```

- 顶层只记录当前 `vendor` 与 `protocol`；每个 target 的桶只保存它 `fields` 内的键。
- 空值等于删除该键，回到 catalog 默认。
- `template` 只是填充动作，不属于配置；提交会被拒绝。
- API key 不在此文件中。

### 从 1.x 迁移

| v2 `mode` | v3 target |
|---|---|
| `responses` | `qwen/responses` |
| `anthropic-messages` | `deepseek/anthropic-messages` |
| `zhipu-web-search` | `zhipu/search` |
| `zhipu-chat-search` | `zhipu/chat-completions` |

- v1 扁平对象先投影到它当时的 mode，再按上表迁移。
- 读取时只在内存迁移；首次保存写 v3，并把原文件备份为 `dsh-web-search-diy.json.v2.bak`（一次，保留回滚）。
- 旧字段名映射：`responsesToolType` → `toolType`、`responsesIncludeSources` → `includeSources`、`responsesReasoningEffort` → `reasoningEffort`、`anthropicThinking` → `thinking`、`anthropicEffort` → `effort`；`apiVersion` 丢弃（固定 `2023-06-01`）。
- 2.0 不再注册 settings 段；配置只来自文件与凭据面。

### 字段速查

| 协议 / 厂商 | 字段 |
|---|---|
| 通用 | `baseURL`、`apiKeyEnv`、`model`、`maxOutputTokens`（纯工具不显示后两项） |
| Responses · OpenAI | `toolType`、`includeSources`、`reasoningEffort`、`searchContextSize`、`allowedDomains`、`blockedDomains`、`userLocation`、`externalWebAccess`、`returnTokenBudget`、`searchContentTypes`、`imageMaxResults`、`imageCaption` |
| Responses · Kimi | `toolType`、`includeSources`、`allowedDomains`（`blockedDomains` / `search_context_size` 会 400） |
| Responses · 智谱 / 千问 | `toolType`、`includeSources`、`reasoningEffort` |
| Responses · DeepSeek | `toolType`；模型锁定 `deepseek-v4-pro`，不发 `include` |
| Responses · OpenRouter | `toolType`、`includeSources`、`engine`、`mode`、`maxResults`、`maxUses`、`maxTotalResults`、`searchContextSize`、`maxCharacters`、`userLocation`、`allowedDomains`、`excludedDomains`、`xSearch` |
| Anthropic Messages | `toolType`、`maxUses`、`thinking`、`effort`、`allowedDomains`、`blockedDomains`、`userLocation`、`responseInclusion` |
| Chat · 智谱 | `searchEngine`、`count`、`searchRecencyFilter`、`contentSize`、`searchDomainFilter`、`searchIntent`、`requireSearch`、`searchPrompt`、`reasoningEffort` |
| Chat · 千问 | `searchStrategy`、`forcedSearch`、`freshness`、`assignedSiteList`、`searchExtension`、`promptIntervene` |
| Chat · OpenRouter | `engine`、`mode`、`maxResults`、`maxUses`、`maxTotalResults`、`searchContextSize`、`maxCharacters`、`userLocation`、`allowedDomains`、`excludedDomains`、`xSearch` |
| Chat · OpenAI | 无搜索参数；模型锁定 `gpt-5-search-api` |
| 纯工具 | `count`、`includeContent`、`searchEngine` / `contentSize` / `searchIntent` / `searchRecencyFilter` / `searchDomainFilter`（智谱）、`oriQuestion` / `localization`（DeepSeek）、`timeoutSeconds`（Kimi）、`digestEntries`、`digestSnippetChars`；自定义另含 `path` 与 8 个映射字段 |

> 纯工具的结果条数与摘要条数相互独立：`count` / `limit` 决定请求与 `sources` 数量（智谱/DeepSeek 1–50，Kimi 1–20）；`digestEntries`（默认 8）与 `digestSnippetChars`（默认 200）只控制返回给调用方的 `content` 摘要，不裁剪 `sources`。

### 自定义接入

- **模板**：内置协议列出该协议可用厂商；纯工具列出 DeepSeek / Kimi / 智谱。选择模板 = 一次性填入端点、凭据、模型与搜索参数，随后可任意修改。
- **Chat 变体**：由模板决定（智谱问答增强 / 千问联网搜索 / OpenRouter server tool / OpenAI 搜索模型），不作为单独字段展示；字段随变体过滤。
- **纯工具映射**：`queryField`、`countField`、`resultsPath`、`urlField`、`titleField`、`snippetField`、`dateField`、`contentField` 是权威；模板只负责填充与留空兜底。支持简单点路径（如 `data.items`），不支持完整 JSONPath。
- **搜索引擎**：输入框 + 常见候选（智谱 / OpenRouter / 自建），可自由填写；智谱模板留空时回落 `search_std`（该接口必填）。
- **必填项**：Chat 需要变体（模板会填）；Responses / Anthropic 需要 `toolType`；纯工具需要 `path`。

## 目标速查（默认端点 / 模型 / 凭据）

| target | 支持度 | 默认端点 | 默认模型 | 凭据引用 |
|---|---|---|---|---|
| `deepseek/anthropic-messages` | ✅ | `https://api.deepseek.com/anthropic` | `deepseek-flash` | `DEEPSEEK_API_KEY` |
| `deepseek/responses` | ◐ | `https://api.deepseek.com` | `deepseek-v4-pro` | `DEEPSEEK_API_KEY` |
| `deepseek/search` | ✅ | `https://api.deepseek.com` | — | `DEEPSEEK_API_KEY` |
| `kimi/responses` | ✅ | `https://api.moonshot.cn/v1` | `kimi-k2.6` | `MOONSHOT_API_KEY` → `KIMI_API_KEY` |
| `kimi/search` | ✅ | `https://api.moonshot.cn` | — | 同上 |
| `zhipu/chat-completions` | ✅ | `https://open.bigmodel.cn/api/paas/v4` | `glm-5.3-flash` | `ZAI_CODING_CN_API_KEY` → `ZHIPU_API_KEY` |
| `zhipu/responses` | ✅ | `https://open.bigmodel.cn/api/v1` | `glm-5.3` | 同上 |
| `zhipu/search` | ✅ | `https://open.bigmodel.cn/api/paas/v4` | — | 同上 |
| `qwen/chat-completions` | ◐ | `https://maas.qianwenaiapi.com/compatible-mode/v1` | `qwen3.8-flash` | `QWEN_TOKEN_PLAN_API_KEY` → `QWEN_TOKEN_PLAN_CN_API_KEY` → `DASHSCOPE_API_KEY` |
| `qwen/responses` | ✅ | 同上 | `qwen3.8-flash` | 同上 |
| `qwen/anthropic-messages` | ✅ | `https://maas.qianwenaiapi.com/apps/anthropic` | `qwen3.8-max` | 同上 |
| `openai/chat-completions` | ◐ | `https://api.openai.com/v1` | `gpt-5-search-api` | `OPENAI_API_KEY` |
| `openai/responses` | ✅ | `https://api.openai.com/v1` | `gpt-5.5` | `OPENAI_API_KEY` |
| `anthropic/anthropic-messages` | ✅ | `https://api.anthropic.com` | `claude-opus-5-5` | `ANTHROPIC_API_KEY` |
| `openrouter/chat-completions` | ✅ | `https://openrouter.ai/api/v1` | 用户填写 | `OPENROUTER_API_KEY` |
| `openrouter/responses` | ✅ | `https://openrouter.ai/api/v1` | 用户填写 | `OPENROUTER_API_KEY` |
| `openrouter/anthropic-messages` | ◐ | `https://openrouter.ai/api` | 用户填写 | `OPENROUTER_API_KEY` |
| `custom/chat-completions` | ⚙ | 模板预填 | 模板 / 用户填写 | 用户填写 |
| `custom/responses` | ⚙ | 模板预填 | 模板 / 用户填写 | 用户填写 |
| `custom/anthropic-messages` | ⚙ | 模板预填 | 模板 / 用户填写 | 用户填写 |
| `custom/search` | ⚙ | 模板预填 | — | 用户填写 |

> 默认模型只是当前文档示例，不承诺长期有效；用户填了则以用户值为准。

## 测试连接

配置页底部的「测试连接」用**当前草稿**执行一次真实搜索，不写盘：

- 查询词固定 `OpenAI`，`maxResults = 3`，超时 60 秒；
- 协议内置：Responses / Anthropic 发送 `Perform a web search for the query: OpenAI`，Chat 直接发送 `OpenAI`；
- 纯工具：按模板发送 `search_query` / `query` / `text_query` 与对应条数；
- 返回 `{ ok, sourceCount, sourceQuality, degraded, latencyMs, contentPreview?, error? }`；
- 0 来源时按该组合的预期来源质量分档提示：设计上不返回 / 可能未执行 / 应检查工具名与端点。

## 工作原理

```
你 ──> 对话 LLM ──> web_search 工具（与模型无关）
                         │ ctx.web seam ──> diy-search provider
                         ▼
   ├─ Responses:           POST {baseURL}/responses   tools: [{ type, ... }]
   ├─ Anthropic Messages:  POST {baseURL}/messages    tools: [{ type: web_search_*, max_uses }]
   ├─ Chat Completions:    POST {baseURL}/chat/completions  （四个变体）
   └─ 纯工具:              POST {baseURL}{path}       （无模型回合）
                         │
                         ▼
                  对话 LLM 基于来源作答
```

- **Responses**：`action.sources[]`、`open_page` / `find_in_page` 的 `action.url`、`results[]` 元数据与 `url_citation` 注解统一归一为去重来源；答案优先取 `phase: "final_answer"`。没有搜索证据时显式失败，404 会提示该端点缺少 `/responses` 路径。
- **Anthropic Messages**：`web_search_tool_result` → `sources[]`，`citations[].cited_text` → `snippet`，`page_age` → ISO 日期；`allowed_domains` 与 `blocked_domains` 互斥（allowed 优先）；非 `20250305` 工具自动加 `allowed_callers: ["direct"]`。
- **Chat Completions**：智谱 `web_search` 工具、千问 `enable_search`、OpenRouter server tool、OpenAI 搜索模型四种变体；来源从 `message.web_search[]` 或 `annotations[]` 读取。
- **纯工具**：结构化结果直接成为 `sources[]`，前若干条摘要拼成 `content`；没有模型回合。
- **思考档位降级**：按 `reasoning.effort` → `output_config` → `thinking` → `reasoning_effort` 顺序逐个移除后重试。
- **响应解码**：按字节读取并按 gzip/zlib 魔数解压，设置 8 MiB 线上与 16 MiB 解码上限。

## 实测结果

2026-10-17 / 2026-10-18 使用真实凭据：

| target | 来源数 | 备注 |
|---|---|---|
| `qwen/responses` | 6 | 来源仅 url |
| `qwen/anthropic-messages` | 9 | 自动附加 billing header |
| `deepseek/anthropic-messages` | 10 | — |
| `deepseek/search` | 3 | `localization` 留空不发送 |
| `zhipu/chat-completions` | 8 | — |
| `zhipu/responses` | 5 | `sources` + `results` 合并 |
| `zhipu/search` | 1 | 摘要上限生效 |
| `kimi/responses` | 6 | `kimi-k2.6` |
| `kimi/search` | 3 | `maxResults=30` 钳到 `limit=20` |
| `custom/search` | 1 | 自定义映射与摘要上限生效 |
| `qwen/chat-completions` | 0 | 降级符合预期（无来源） |
| `deepseek/responses` | 0 | 降级符合预期（仅 `open_page`） |
| `custom/chat` / `responses` / `anthropic` | 8 / 5 / 10 | 2026-10-17 验证 |

OpenAI、Anthropic、OpenRouter 尚未实测；有这些端点的实际结果，欢迎在「反馈」中补充。

## 已知限制

- **Kimi Chat 不接入**：协议内置 `$web_search` 将于 2026-10-20 下线；`api.kimi.com/coding` 端点同样不接入。Kimi 只保留 Responses 与纯工具（`/v1/tools/search`，Pro 可用自定义 target 覆盖 `path`）。
- **智谱 Anthropic 不执行搜索**：接受 `web_search_20250305` 但 `web_search_requests: 0`，标为不支持。
- **DeepSeek Responses 仅 `deepseek-v4-pro`**，且不返回 `action.sources`，来源只能来自 `open_page`。
- **千问 Chat 不返回来源**；千问只对接千问 AI 平台（`maas.qianwenaiapi.com`），不接阿里云百炼。
- **OpenAI Chat 仅 `gpt-5-search-api`**，普通模型加 tools 不生效。
- **OpenRouter Anthropic** 的 `web_search_20250305` 别名按文档实现，尚未实测。
- **Kimi Responses** 不支持 `search_context_size` / `blocked_domains`（会 400）。
- **纯工具搜索没有模型回合**；输出上限由 `digestEntries` / `digestSnippetChars` 控制，不是模型的 token 预算。
- **测试连接固定查询词** `OpenAI`，只用于验证连通性，不代表搜索质量。

## 反馈

遇到未覆盖的厂商或网关、协议行为差异、字段映射问题，欢迎在 [GitHub Issues](https://github.com/aaronlei/dsh-web-search-diy/issues) 反馈，附上端点类型、请求形状与错误信息即可；也欢迎提交 PR 补充实测结果。

## 凭据

在 Web 的 **Models** 页 / 凭据服务里保存（`$DSH_HOME/.credentials.yaml`），或在启动环境中导出。插件每次搜索动态解析，不在 provider 上保留，也不写入配置文件。

默认引用链按厂商：DeepSeek `DEEPSEEK_API_KEY`；Kimi `MOONSHOT_API_KEY` → `KIMI_API_KEY` → `KIMI_CODING_API_KEY`；智谱 `ZAI_CODING_CN_API_KEY` → `ZHIPU_API_KEY`；千问 `QWEN_TOKEN_PLAN_API_KEY` → `QWEN_TOKEN_PLAN_CN_API_KEY` → `DASHSCOPE_API_KEY`；OpenAI / Anthropic / OpenRouter 各一条。自定义 target 的引用名由用户填写。

## 开发

Host 与 Client 都在 `src/` 维护，构建产物入库：

```
src/
  index.ts        # apply：注册 provider 与配置/测试端点
  catalog.ts      # 能力矩阵、默认值、字段、模板
  config.ts       # v3 读写、v1/v2 迁移、字段校验
  endpoint.ts     # GET/POST /api/web-search-diy/config 与 /test
  options.ts      # catalog 默认 + 文件覆盖
  provider.ts     # available / 按协议分派
  transport.ts    # fetch、解码、reasoning 降级
  protocols/      # responses / anthropic / chat / search
  mappers/        # 来源归一化
  client/index.tsx
```

```bash
pnpm install
pnpm run build       # Host ESM + Client CJS 双产物
pnpm run typecheck
pnpm test            # Host 测试（92 项）
pnpm run test:client # 重建并校验 Client 契约
```

`lib/index.js` 与 `lib/client.js` 入库；source map 不入库。

## 许可证

MIT —— 见 [LICENSE](LICENSE)。Copyright (c) 2026 aaronlei.

[![](https://img.shields.io/badge/powered_by-dsh-4D6BFE?style=flat-square&logo=deepseek&logoColor=white)](https://github.com/deepseek-ai/deepseek-harness)
