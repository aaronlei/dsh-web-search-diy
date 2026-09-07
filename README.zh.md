# dsh-web-search-diy

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

**DeepSeek Harness（DSH）网页搜索提供方插件**：把内置 `web_search` 工具接到
多种搜索后端，用协议原生的能力返回**结构化引用来源**。一个 `mode` 开关切换
三种协议：

| `mode` | 协议 | 后端 |
|---|---|---|
| `responses`（默认） | OpenAI 兼容 **Responses API** + `web_search` 工具 | 千问 Token Plan（默认示例）、OpenAI、任意兼容网关 |
| `zhipu-web-search` | 智谱 **基础检索（Web Search API）**（`POST /web_search`） | 智谱开放平台，纯结构化结果，无模型回合 |
| `zhipu-chat-search` | 智谱 **问答增强（Web Search in Chat）**（`/chat/completions` + `web_search` 工具） | 智谱开放平台，检索 + 生成融合回答 |

`responses` 模式：端点、模型、密钥引用随手可换——只要模型在网关上支持
`web_search` 工具即可。

- 默认模型：`deepseek-v4-flash-0731`
- 默认端点：`https://token-plan.cn-beijing.maas.aliyuncs.com/compatible-mode/v1`
- 默认密钥引用：`QWEN_TOKEN_PLAN_CN_API_KEY`

`zhipu-*` 模式：默认端点 `https://open.bigmodel.cn/api/paas/v4`，默认密钥
引用 `ZHIPU_API_KEY`；`zhipu-chat-search` 默认模型 `glm-4-flash`。参考
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
| `mode` | `responses` | 协议模式：`responses` / `zhipu-web-search` / `zhipu-chat-search` |
| `apiKey` | — | 字面 API key；设置时优先于 `apiKeyEnv` |
| `apiKeyEnv` | 按模式取默认（见上） | 每次搜索经 `ctx.credentials` 解析的凭据引用 |
| `baseURL` | 按模式取默认（见上） | API 基址；`responses` 追加 `/responses`，`zhipu-web-search` 追加 `/web_search`，`zhipu-chat-search` 追加 `/chat/completions` |
| `model` | 按模式取默认（见上） | 端点承载的模型；`zhipu-web-search` 无模型回合，忽略此键 |
| `maxOutputTokens` | `1024` | 单次搜索回合的输出上限（`responses` 的 `max_output_tokens` / `zhipu-chat-search` 的 `max_tokens`） |
| `searchEngine` | `search_std` | 智谱搜索引擎：`search_std` / `search_pro` / `search_pro_sogou` / `search_pro_quark`（仅智谱模式） |
| `count` | `10` | 智谱返回条数（1-50）；请求自带 `maxResults` 上限时优先使用请求值（仅智谱模式） |
| `searchRecencyFilter` | `noLimit` | 智谱时间范围：`noLimit` / `oneDay` / `oneWeek` / `oneMonth` / `oneYear`（仅智谱模式） |
| `contentSize` | `medium` | 智谱摘要字数：`medium` / `high`（仅智谱模式） |
| `searchDomainFilter` | — | 智谱域名白名单，如 `www.example.com`（仅智谱模式） |
| `searchIntent` | `false` | 智谱意图识别；关闭则跳过识别直接搜索（仅 `zhipu-web-search` 模式） |
| `searchPrompt` | — | 智谱问答增强的搜索提示词，留空用官方默认（仅 `zhipu-chat-search` 模式） |
| `reasoningEffort` | `low` | 问答增强回合的思考强度 `reasoning_effort`：`low` / `high` / `max`；`low` 让 GLM-5.3-Flash 这类强制思考模型保持快速（仅 `zhipu-chat-search` 模式） |

> `apiKeyEnv` / `baseURL` / `model` 留空时按当前 `mode` 取默认；历史配置里由
> schema 默认固化的 Qwen 地址/模型/引用在切换到智谱模式时自动让位给智谱
> 默认值，显式自定义的值则始终尊重。

### 设置卡片

配置卡片在 **设置 → 插件 → 插件配置 → 自定义网页搜索**，与随包的终端 /
Agent 循环等官方卡片同一形态：编辑先暂存（header 出现「未保存」徽标），点
**保存** 才写入，**放弃修改** 恢复为已存值；保存即生效，无需重启。卡片文案
跟随 设置 → 语言（zh / en）。API 密钥输入框只写不读：留空表示保持已存密钥。

## 工作原理

```
你 ──> 对话 LLM
            │ 需要实时信息时
            ▼
      web_search 工具（与模型无关）
            │ ctx.web seam ──> diy-search 提供方
            ▼
      ┌─ responses：        POST {baseURL}/responses   tools: [{ type: "web_search" }]
      ├─ zhipu-web-search： POST {baseURL}/web_search  （纯检索，无模型回合）
      └─ zhipu-chat-search：POST {baseURL}/chat/completions  tools: [{ type: "web_search", web_search: {...} }]
            │
            ▼
      对话 LLM 基于搜索结果作答
```

- **responses**：每次搜索是一次 Responses API 调用（完整的一轮模型推理）。
  结果返回去重后的 `sources[]`（url + `url_citation` 注解提供的可选标题）以及
  模型生成的 `content`。响应中若没有任何 `web_search_call` 块，则以
  `WEB_PROVIDER_ERROR` 响亮失败——绝不做从文本里扒链接的降级。
- **zhipu-web-search**：`search_result[]` 直接映射为去重的 `sources[]`
  （url + title），并拼接前若干条「标题 + 摘要」作为 `content` 速览。空结果
  是合法结果，返回空 `sources[]` 而非报错。
- **zhipu-chat-search**：`choices[0].message.content` 即融合回答（`content`），
  工具声明的 `search_result: true` 让端点附带来源详情，从消息级/根级
  `web_search` 字段防御式解析为 `sources[]`；有回答而无来源详情同样可用。

## 凭据

在 Web 的 **Models** 页 / 凭据服务里保存密钥（引用名按模式取默认：
`responses` 模式为 `QWEN_TOKEN_PLAN_CN_API_KEY`，智谱模式为
`ZHIPU_API_KEY`），或在启动环境中导出。提供方每次搜索动态解析，不在自身
保留密钥。

## 许可证

MIT — see [LICENSE](LICENSE). Copyright (c) 2026 aaronlei.