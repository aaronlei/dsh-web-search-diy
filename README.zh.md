# dsh-web-search-diy

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

**DeepSeek Harness（DSH）网页搜索提供方插件**：把内置 `web_search` 工具接到
多种搜索后端，用协议原生的能力返回**结构化引用来源**。一个 `mode` 开关切换
三种协议：

| `mode` | 协议 | 后端 |
|---|---|---|
| `responses`（默认） | OpenAI 兼容 **Responses API** + `web_search` 工具 | 千问 Token Plan（默认示例）、OpenAI、任意兼容网关 |
| `anthropic-messages` | **Anthropic 兼容 Messages API** + `web_search_20250305` 服务端工具 | DeepSeek 官方 Anthropic 端点（官方插件的等价替代）、任意 Anthropic 兼容网关 |
| `zhipu-web-search` | 智谱 **基础检索（Web Search API）**（`POST /web_search`） | 智谱开放平台，纯结构化结果，无模型回合 |
| `zhipu-chat-search` | 智谱 **问答增强（Web Search in Chat）**（`/chat/completions` + `web_search` 工具） | 智谱开放平台，检索 + 生成融合回答 |

`responses` 模式：端点、模型、密钥引用随手可换——只要模型在网关上支持
`web_search` 工具即可。

- 默认模型：`deepseek-v4-flash-0731`
- 默认端点：`https://token-plan.cn-beijing.maas.aliyuncs.com/compatible-mode/v1`
- 默认密钥引用：`QWEN_TOKEN_PLAN_CN_API_KEY`

`anthropic-messages` 模式：默认端点 `https://api.deepseek.com/anthropic/v1`
（追加 `/messages`），默认密钥引用 `DEEPSEEK_API_KEY`（与对话模型、官方插件共用
同一个凭据），默认模型 `deepseek-flash`（端点上滚动指向最新 Flash），并提供 `apiVersion`
（`anthropic-version` 请求头，默认 `2023-06-01`）与 `maxUses`（`max_uses`，默认
5）。输出预算默认为 65536，即 DeepSeek 文档中思考模式的 `max_tokens` 默认值
（关闭思考 8K、`reasoning_effort: max` 时 128K，上限 384K）；Anthropic 协议要求
该字段存在，插件因此显式发送该默认值而非依赖服务端行为。它只是上限、不预扣费，
设得过小会截断回合、砍掉工具调用轮次。接口地址留空时会先回退到环境变量
`DEEPSEEK_SEARCH_BASE_URL`、再回退到内置默认值——与官方提供方一致。每次 Anthropic 调用还会以 `web/deepseek-search-llm-request` 事件
记录到当前会话（端点、`anthropic-version`、请求体），与官方提供方行为相同。
它说的是与官方 `deepseek-official` 提供方完全相同的线上格式——已有该密钥、或
自建 Anthropic 兼容网关的部署无需重新配置。

该端点无法按档位或预算调节思考：实测 `reasoning_effort`（low/high）与
`thinking.budget_tokens` 都不改变思考长度（1024 的预算甚至比不传预算思考更多），
只有 `thinking: {type: "disabled"}` 能整段去掉推理过程（同题：38s → 8s、输出
9444 → 2204 tokens）。因此 `anthropicThinking` 只暴露这一个开关；普通搜索查询
的时延差别不大，省下的是思考 token。

`zhipu-*` 模式：默认端点 `https://open.bigmodel.cn/api/paas/v4`，默认密钥
引用 `ZHIPU_API_KEY`（若你的智谱凭据按所配置的 provider 命名——例如
`zai-coding-cn` 对应的 `ZAI_CODING_CN_API_KEY`——把 `apiKeyEnv` 填成该名字，或
直接留空，因为该模式的候选链本就会在 `ZHIPU_API_KEY` 之后尝试它；配置页在切换
协议时会把它算作智谱家族的一员）；`zhipu-chat-search` 默认模型 `glm-5.3-flash`（配思考
强度 `low`，实测约 3.5s——免费档 `glm-4.7-flash` 经常限流 429 不可用，不作为
默认）。参考
[智谱联网搜索文档](https://docs.bigmodel.cn/cn/guide/tools/web-search)。

## 为什么

DSH 自带的搜索提供方（`deepseek-official`）走的是 DeepSeek 自家 Anthropic 兼容
端点——指不到其他网关，而且部署时要切换很麻烦。本插件是**一等公民插件**：
向 `ctx.web` 注册搜索提供方，并把共享的 `searchProvider` 覆盖到它，与生态内
其他提供方插件一致。搜索模型与对话模型完全解耦——任意对话模型都可以搭配使用。

> **为什么走 Responses API？** 很多 OpenAI 兼容网关的内置联网搜索只在
> Responses API（`/responses`）上、且显式声明 `tools: [{type: "web_search"}]`
> 时才会触发——Chat Completions 的搜索开关参数会被静默忽略。本插件走
> Responses 协议，并解析 `web_search_call` 块里结构化的 `action.sources` 为
> seam 标准的引用来源。

> **为什么要 Anthropic Messages？** 官方 `deepseek-official` 提供方说的是
> DeepSeek 的 Anthropic 兼容端点，但指不到别处。`anthropic-messages` 模式在本
> 插件内复刻了该协议（含 `x-api-key` + `Bearer` 双认证头，以及用
> `citations[].cited_text` 关联出的 snippet），已有 `DEEPSEEK_API_KEY` 的部署可
> 直接沿用，同时端点、模型、工具预算与凭据都变得可配置，并继承本插件的
> dispatcher 免疫响应解码。

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

选项优先级：**UI 管理文件（`$DSH_HOME/dsh-web-search-diy.json`，由配置页写入）
> settings 段 / entry 配置 > 包默认值。**

| 键 | 默认值 | 含义 |
|---|---|---|
| `mode` | `responses` | 协议模式：`responses` / `anthropic-messages` / `zhipu-web-search` / `zhipu-chat-search` |
| `apiKey` | — | 字面 API key；设置时优先于 `apiKeyEnv` |
| `apiKeyEnv` | 按模式取默认（见上） | 每次搜索经 `ctx.credentials` 解析的凭据引用；留空时智谱模式会在 `ZHIPU_API_KEY` 之后再尝试 `ZAI_CODING_CN_API_KEY` |
| `baseURL` | 按模式取默认（见上） | API 基址；`responses` 追加 `/responses`，`anthropic-messages` 追加 `/messages`，`zhipu-web-search` 追加 `/web_search`，`zhipu-chat-search` 追加 `/chat/completions` |
| `model` | 按模式取默认（见上） | 端点承载的模型；`zhipu-web-search` 无模型回合，忽略此键 |
| `maxOutputTokens` | 按模式：`anthropic-messages` 为 `65536`，其余为 `4096` | 单次搜索回合的输出上限（`responses` 的 `max_output_tokens`、`anthropic-messages` 与 `zhipu-chat-search` 的 `max_tokens`） |
| `apiVersion` | `2023-06-01` | 每次请求发送的 `anthropic-version` 请求头（仅 `anthropic-messages` 模式） |
| `maxUses` | `5` | 单次请求内 `web_search` 服务端工具的最大调用次数，作为 `max_uses` 发送（仅 `anthropic-messages` 模式） |
| `anthropicThinking` | `default` | `default` 不传参数；`disabled` 发送 `thinking: {type: "disabled"}`（仅 `anthropic-messages` 模式） |
| `searchEngine` | `search_std` | 智谱搜索引擎：`search_std` / `search_pro` / `search_pro_sogou` / `search_pro_quark`（仅智谱模式） |
| `count` | `10` | 智谱返回条数（1-50）；请求自带 `maxResults` 上限时优先使用请求值（仅智谱模式） |
| `searchRecencyFilter` | `noLimit` | 智谱时间范围：`noLimit` / `oneDay` / `oneWeek` / `oneMonth` / `oneYear`（仅智谱模式） |
| `contentSize` | `medium` | 智谱摘要字数：`medium` / `high`（仅智谱模式） |
| `searchDomainFilter` | — | 智谱域名白名单，如 `www.example.com`（仅智谱模式） |
| `searchIntent` | `false` | 智谱意图识别；关闭则跳过识别直接搜索（仅 `zhipu-web-search` 模式） |
| `searchPrompt` | — | 智谱问答增强的搜索提示词，留空用官方默认（仅 `zhipu-chat-search` 模式） |
| `reasoningEffort` | `low` | 问答增强回合的思考强度 `reasoning_effort`：`low` / `high` / `max`；`low` 让 GLM-5.3-Flash 这类强制思考模型保持快速（仅 `zhipu-chat-search` 模式） |
| `responsesReasoningEffort` | —（不传） | OpenAI 兼容回合的推理档位 `reasoning.effort`：`low` / `high`；不传则随大模型自身模式——网关不认识未知参数时请保持默认（仅 `responses` 模式） |

> `apiKeyEnv` / `baseURL` / `model` 留空时按当前 `mode` 取默认。历史配置里由
> schema 默认固化的 Qwen 地址/引用在切换模式时让位给新模式的默认值；同样固化
> 的 DeepSeek 模型名只在切到智谱模式（其端点无法承载该模型）时让位。显式自定义
> 的值则始终尊重。

从配置页保存时，所有键遵循同一条规则：空值会清除该键、让该模式自身的默认值重新
生效；未提交的键维持原值；非法值会被拒绝并指名该键。`apiKey` 例外——留空表示
保持已存密钥。

### 配置页

配置页在侧栏 **插件 → dsh-web-search-diy → `web-search-diy` 行的「配置」**
（注册进 dsh 0.1.6-alpha.2 起的 `plugins.row.config` slot；旧「设置 → 插件 →
插件配置」页随该版本移除）。页面形态与官方插件配置页一致：编辑先暂存，点
**保存** 才写入，**放弃修改** 恢复为已存值；保存即生效，无需重启。页面文案
跟随 设置 → 语言（zh / en）。API 密钥输入框只写不读：留空表示保持已存密钥。
切换协议时，模型与凭据引用会一并换成新协议的官方值：已存的 `GLM-5.3-Flash`，
或任何属于“正在离开的那个服务商家族”的引用（`ZHIPU_API_KEY`、
`ZAI_CODING_CN_API_KEY`）都会跟随替换；不属于任何已知家族的自定义引用名（网关
令牌等）则原样保留。

## 工作原理

```
你 ──> 对话 LLM
            │ 需要实时信息时
            ▼
      web_search 工具（与模型无关）
            │ ctx.web seam ──> diy-search 提供方
            ▼
      ┌─ responses：         POST {baseURL}/responses   tools: [{ type: "web_search" }]
      ├─ anthropic-messages：POST {baseURL}/messages    tools: [{ type: "web_search_20250305", name: "web_search", max_uses }]
      ├─ zhipu-web-search：  POST {baseURL}/web_search  （纯检索，无模型回合）
      └─ zhipu-chat-search： POST {baseURL}/chat/completions  tools: [{ type: "web_search", web_search: {...} }]
            │
            ▼
      对话 LLM 基于搜索结果作答
```

- **responses**：每次搜索是一次 Responses API 调用（完整的一轮模型推理）。
  结果返回去重后的 `sources[]`（url + `url_citation` 注解提供的可选标题）以及
  模型生成的 `content`。响应中若没有任何 `web_search_call` 块，则以
  `WEB_PROVIDER_ERROR` 响亮失败——绝不做从文本里扒链接的降级。
- **anthropic-messages**：每次搜索是一次 Anthropic Messages 调用，带原生
  `web_search_20250305` 服务端工具。`web_search_tool_result` 块成为去重的
  `sources[]`（`url`、可选 `title`、`page_age` → `publishedAt`），`snippet` 由
  响应的 `citations[].cited_text` 关联得到。提供方自己的文本不作为 `content`
  返回（与官方提供方一致）。报告工具失败的 result 块（`max_uses_exceeded`、
  `too_many_requests` 等）会带出该错误码而不是笼统的 unprocessable body；没有
  任何 result 块的响应以 `WEB_PROVIDER_ERROR` 响亮失败。
- **zhipu-web-search**：`search_result[]` 直接映射为去重的 `sources[]`
  （url + title），并拼接前若干条「标题 + 摘要」作为 `content` 速览。空结果
  是合法结果，返回空 `sources[]` 而非报错。
- **zhipu-chat-search**：`choices[0].message.content` 即融合回答（`content`），
  工具声明的 `search_result: true` 让端点附带来源详情，从消息级/根级
  `web_search` 字段防御式解析为 `sources[]`；有回答而无来源详情同样可用。
- **响应解码对 dispatcher 免疫**：响应体按字节读取，压缩时按魔数就地解压，
  请求显式声明 `accept-encoding: identity`。这使插件能扛过 dsh 的跨版本全局
  undici dispatcher（该环境下 `response.json()` 会拿到原始 gzip 字节），并设
  有解压炸弹硬上限（线路上限 8 MiB、解压上限 16 MiB）。

## 凭据

在 Web 的 **Models** 页 / 凭据服务里保存密钥（引用名按模式取默认：
`responses` 模式为 `QWEN_TOKEN_PLAN_CN_API_KEY`，`anthropic-messages` 模式为
`DEEPSEEK_API_KEY`，智谱模式为 `ZHIPU_API_KEY`（其后依次为
`ZAI_CODING_CN_API_KEY`）），或在启动环境中导出。提供方每次搜索动态解析，不在自身
保留密钥。

## 许可证

MIT — see [LICENSE](LICENSE). Copyright (c) 2026 aaronlei.