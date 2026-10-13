# dsh-web-search-diy

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

**DeepSeek Harness（DSH）网页搜索提供方插件**：把内置 `web_search` 工具接到四种可选协议上，返回**结构化引用来源**，让调用方模型能基于真实页面作答。一个 `mode` 开关切换协议，每个模式各自保留自己的端点、模型、凭据引用、输出预算与搜索选项。

## 协议模式

| `mode` | 协议与请求 | 后端 |
|---|---|---|
| `responses`（默认） | OpenAI 兼容 **Responses API**——`POST /responses`，带 `tools: [{ type: "web_search" }]` | OpenAI 官方、Kimi（`https://api.moonshot.cn/v1`，实测）、或任意**真的实现了 `/responses`** 的兼容网关；百炼/千问不提供 Responses 接口 |
| `anthropic-messages` | **Anthropic 兼容 Messages API**——`POST /messages`，带原生 `web_search_20250305` 服务端工具 | DeepSeek 官方 Anthropic 端点（官方插件的等价替代）、Kimi（`https://api.moonshot.cn/anthropic`，实测）、任意 Anthropic 兼容网关 |
| `zhipu-web-search` | 智谱 **基础检索（Web Search API）**——`POST /web_search`，无模型回合 | 智谱开放平台；纯结构化结果 |
| `zhipu-chat-search` | 智谱 **问答增强（Web Search in Chat）**——`POST /chat/completions`，带 `web_search` 工具 | 智谱开放平台；检索与生成融合回答 |

各模式默认值：

| `mode` | `baseURL` | `model` | `apiKeyEnv` | `maxOutputTokens` |
|---|---|---|---|---|
| `responses` | `https://token-plan.cn-beijing.maas.aliyuncs.com/compatible-mode/v1` | `deepseek-v4-flash-0731` | `QWEN_TOKEN_PLAN_CN_API_KEY` | `4096` |
| `anthropic-messages` | `https://api.deepseek.com/anthropic/v1` | `deepseek-flash` | `DEEPSEEK_API_KEY` | `65536` |
| `zhipu-web-search` | `https://open.bigmodel.cn/api/paas/v4` | —（无模型回合） | `ZAI_CODING_CN_API_KEY`，其后历史名 `ZHIPU_API_KEY` | `4096`（不生效） |
| `zhipu-chat-search` | `https://open.bigmodel.cn/api/paas/v4` | `glm-5.3-flash` | `ZAI_CODING_CN_API_KEY`，其后历史名 `ZHIPU_API_KEY` | `4096` |

**`responses`** 是本插件的历史行为：端点、模型、密钥引用随手可换，唯一要求是模型在网关上真的支持 `web_search` 工具。额外的一个旋钮是 `responsesReasoningEffort`，透传 OpenAI 标准的 `reasoning.effort`（`low` / `high`）；默认不传——网关不实现该参数时可能直接拒绝整个请求，那种网关上请保持默认。另外默认发送 `include: ["web_search_call.action.sources"]` 以取回完整来源列表（官方 API 里该字段是 include-only，不传就只剩引用注解里的少量来源）；网关拒绝未知参数时可在配置页关闭。

**`anthropic-messages`** 说的是 DeepSeek 的 Anthropic 兼容端点：`baseURL` 追加 `/messages`，凭据引用默认 `DEEPSEEK_API_KEY`（与官方插件、对话模型共用同一个凭据），模型默认 `deepseek-flash`（端点上滚动指向最新 Flash）。该端点的 API 名只有 `deepseek-flash` 与 `deepseek-v4-pro`，版本号不是 API 名（`deepseek-v4.1-flash` 会被 HTTP 400 拒绝）。有两个协议专属键：`apiVersion`（`anthropic-version` 请求头，默认 `2023-06-01`）与 `maxUses`（`max_uses`，默认 5）。输出预算默认 `65536`，即 DeepSeek 文档中思考模式的 `max_tokens` 默认值（关闭思考 8K、`reasoning_effort: max` 时 128K，上限 384K）；Anthropic 协议要求该字段存在，插件因此显式发送该默认值而非依赖服务端行为。它只是上限、不预扣费，设得过小会截断回合、砍掉工具调用轮次。接口地址留空时会先回退到环境变量 `DEEPSEEK_SEARCH_BASE_URL`、再回退到内置默认值——与官方提供方一致。每次 Anthropic 调用还会以 `web/deepseek-search-llm-request` 事件记录到当前会话（端点、`anthropic-version`、请求体），与官方提供方行为相同。它说的是与官方 `deepseek-official` 提供方完全相同的线上格式——已有该密钥、或自建 Anthropic 兼容网关的部署无需重新配置。

该端点无法按档位或预算调节思考：实测 `reasoning_effort`（low/high）与 `thinking.budget_tokens` 都不改变思考长度（1024 的预算甚至比不传预算思考更多），只有 `thinking: {type: "disabled"}` 能整段去掉推理过程（同一道长推理题：38s → 8s，输出 9444 → 2204 tokens）。因此 `anthropicThinking` 只暴露这一个开关；普通搜索查询的时延差别不大，省下的是思考 token。

**`zhipu-*`** 两个模式共用智谱开放平台基址 `https://open.bigmodel.cn/api/paas/v4` 与凭据链 `ZAI_CODING_CN_API_KEY` → 历史名 `ZHIPU_API_KEY`。首选名正是 DeepSeek 侧凭据平面对智谱密钥使用的名字（`zai-coding-cn` provider 行读的就是 `ZAI_CODING_CN_API_KEY`），因此按该 provider 命名凭据的部署把 `apiKeyEnv` 留空也能被找到；`ZHIPU_API_KEY` 是本插件此前的默认名，仅为老部署迁移期间兼容保留。`zhipu-chat-search` 默认模型 `glm-5.3-flash`、思考强度 `low`（实测约 3.5s）——免费档 `glm-4.7-flash` 经常限流 429，不作为默认。参考 [智谱联网搜索文档](https://docs.bigmodel.cn/cn/guide/tools/web-search)。

## 为什么

DSH 自带的搜索提供方（`deepseek-official`）走的是 DeepSeek 自家 Anthropic 兼容端点——指不到其他网关，而且部署时要切换很麻烦。本插件是**一等公民插件**：向 `ctx.web` 注册搜索提供方，并把共享的 `searchProvider` 覆盖到它，与生态内其他提供方插件一致。搜索模型与对话模型完全解耦——任意对话模型都可以搭配使用。

> **为什么走 Responses API？** 很多 OpenAI 兼容网关的内置联网搜索只在 Responses API（`/responses`）上、且显式声明 `tools: [{type: "web_search"}]` 时才会触发——Chat Completions 的搜索开关参数会被静默忽略。本插件走 Responses 协议，并解析 `web_search_call` 块里的结构化来源（`action.sources`，以及 DeepSeek 的 `open_page` `action.url`）与 `url_citation` 注解为 seam 标准的引用来源。注意 DeepSeek 官方 Responses 端点对 `deepseek-flash` 会静默忽略内置 `web_search` 工具（需要 DeepSeek 联网搜索时请用 `anthropic-messages` 模式）；`deepseek-v4-pro` 会真的执行搜索，但只回 `open_page` 的 URL、不给 `action.sources`。

> **为什么要 Anthropic Messages？** 官方 `deepseek-official` 提供方说的是 DeepSeek 的 Anthropic 兼容端点，但指不到别处。`anthropic-messages` 模式在本插件内复刻了该协议（含 `x-api-key` + `Bearer` 双认证头，以及用 `citations[].cited_text` 关联出的 snippet），已有 `DEEPSEEK_API_KEY` 的部署可直接沿用，同时端点、模型、工具预算与凭据都变得可配置，并继承本插件的 dispatcher 免疫响应解码。

## 安装

已发布到 npm：

```bash
dsh plugin --profile web add dsh-web-search-diy
```

bundle patch 会（无需手动改 `cordis.patch.yml`）：

- 插入 `web-search-diy` loader 条目
- 覆盖共享 `web` 行：`searchProvider: diy-search`，并补回 `fetchProvider: http`（patch 会整段替换该行 config）
- 禁用官方 DeepSeek 搜索插件 `web-search-deepseek`

本地开发调试：以本地链接方式安装 checkout（与其他本地插件一致）：

```bash
dsh plugin --profile web add link:./dsh-web-search-diy
```

（将 `./dsh-web-search-diy` 替换为你本地 checkout 的实际路径）

> **本地链接安装注意**：插件把 `@deepseek-ai/*` 钩子声明为 `peerDependencies`（并在 `devDependencies` 镜像）。链接包会优先解析自身 `node_modules`，所以首次请在插件目录运行一次 `pnpm install`；运行时 peer 由 harness 安装提供。

## 开发

服务端半侧是直接维护的源码 [lib/index.js](lib/index.js)；浏览器半侧的权威源是 [src/client/index.tsx](src/client/index.tsx)，宿主消费的是它**构建后**的 bundle `lib/client.js`（官方客户端插件同样用 tsdown 构建），因此 UI 改动一律走构建：

```bash
pnpm install         # 首次：安装 tsdown、TypeScript 与 React 类型
pnpm run bundle      # 一次性构建，或 pnpm run watch（保存即重建）
pnpm run typecheck   # 类型检查在这一步（tsdown 只转译）
pnpm run test:client # 先重建再校验产物的契约
pnpm run test        # 服务端测试
```

`lib/client.js` 入库，因为本地链接安装与 npm 发布包交付的都是构建产物；source map 属本地构建副产品，不入库。`pnpm run test:client` 会先重建再校验，因此忘记构建不会让旧产物蒙混过关。[scripts/verify-client.mjs](scripts/verify-client.mjs) 把构建产物装进保真的 React 替身（真实的 `useState`/`useEffect`/`useRef` 语义，`ctx.effect` 立即执行），因此当产物与卡片的注册路径、按模式可见的字段、分桶切换或保存控件状态发生偏离时，它会直接失败。

## 配置

选项优先级：**UI 管理文件（`$DSH_HOME/dsh-web-search-diy.json`，由配置页写入）> settings 段 / entry 配置 > 包默认值。**

该文件**按协议模式分桶**：

```json
{
  "version": 2,
  "mode": "anthropic-messages",
  "modes": {
    "anthropic-messages": { "baseURL": "...", "model": "deepseek-flash", "maxUses": 8 },
    "zhipu-chat-search": { "apiKeyEnv": "ZAI_CODING_CN_API_KEY", "searchEngine": "search_pro" }
  }
}
```

每个模式各自保存自己的端点、模型、凭据引用、输出预算与搜索选项，因此进入某模式时恢复的是它自己的设置——刷新页面后依然如此——既不会把上一个模式的取值带过去，也不会被规范默认值覆盖。尚无桶的模式会从该模式的官方值起步。顶层 `mode` 是当前选中的模式。每个桶只保存该模式真正使用的键：配置页提交的是整张表单，因此属于其它模式的字段不会被写入，已有桶里的这类残留会在该模式下次保存时被清掉。在配置页里清空的键会被删除而不是写空，所以文件里只留真实选择，被清空的桶会整体删除。更早版本写出的扁平文件在读取时被投影到它当时选中的模式，下一次保存即改写为分桶结构；读取过程不写盘。降级前请留一份备份：旧版插件只认顶层 `mode`、会忽略这些桶。

| 键 | 默认值 | 含义 |
|---|---|---|
| `mode` | `responses` | 协议模式：`responses` / `anthropic-messages` / `zhipu-web-search` / `zhipu-chat-search` |
| `apiKey` | — | 字面 API key；设置时优先于 `apiKeyEnv` |
| `apiKeyEnv` | 按模式取默认（见上） | 每次搜索经 `ctx.credentials` 解析的凭据引用；留空走该模式自带的候选链 |
| `baseURL` | 按模式取默认（见上） | API 基址；按模式追加 `/responses`、`/messages`、`/web_search` 或 `/chat/completions` |
| `model` | 按模式取默认（见上） | 端点承载的模型；`zhipu-web-search` 无模型回合，忽略此键 |
| `maxOutputTokens` | 按模式：`anthropic-messages` 为 `65536`，其余为 `4096` | 单次搜索回合的输出上限（`responses` 的 `max_output_tokens`、`anthropic-messages` 与 `zhipu-chat-search` 的 `max_tokens`） |
| `apiVersion` | `2023-06-01` | 每次请求发送的 `anthropic-version` 请求头（仅 `anthropic-messages`） |
| `maxUses` | `5` | 单次请求内 `web_search` 服务端工具的最大调用次数，作为 `max_uses` 发送（仅 `anthropic-messages`） |
| `anthropicThinking` | `default` | `default` 不传参数；`disabled` 发送 `thinking: {type: "disabled"}`（仅 `anthropic-messages`） |
| `searchEngine` | `search_std` | 智谱搜索引擎：`search_std` / `search_pro` / `search_pro_sogou` / `search_pro_quark`（仅智谱模式） |
| `count` | `10` | 智谱返回条数（1-50）；请求自带 `maxResults` 上限时优先使用请求值（仅智谱模式） |
| `searchRecencyFilter` | `noLimit` | 智谱时间范围：`noLimit` / `oneDay` / `oneWeek` / `oneMonth` / `oneYear`（仅智谱模式） |
| `contentSize` | `medium` | 智谱摘要字数：`medium` / `high`（仅智谱模式） |
| `searchDomainFilter` | — | 智谱域名白名单，如 `www.example.com`（仅智谱模式） |
| `searchIntent` | `false` | 智谱意图识别；关闭则跳过识别直接搜索（仅 `zhipu-web-search`） |
| `requireSearch` | `false` | 强制接口在有搜索结果时才作答（`require_search: true`）；默认不传，请求体与历史行为一致（仅 `zhipu-chat-search`） |
| `searchPrompt` | — | 智谱问答增强的搜索提示词，留空用官方默认（仅 `zhipu-chat-search`） |
| `reasoningEffort` | `low` | 问答增强回合的思考强度 `reasoning_effort`：`low` / `high` / `max`；`low` 让 GLM-5.3-Flash 这类强制思考模型保持快速（仅 `zhipu-chat-search`） |
| `responsesReasoningEffort` | —（不传） | OpenAI 兼容回合的推理档位 `reasoning.effort`：官方全集 `minimal` / `low` / `medium` / `high` / `xhigh`；模型不认识所选档位时会被拒（400），插件自动去掉该档位重试（仅 `responses`） |
| `anthropicEffort` | —（不传） | Anthropic 兼容回合的 `output_config.effort`：`low` / `medium` / `high` / `xhigh` / `max`；被拒时同样自动降级重试（仅 `anthropic-messages`） |
| `responsesIncludeSources` | `true` | 发送 `include: ["web_search_call.action.sources"]` 取回完整来源列表（官方 API 里该字段是 include-only）；网关拒绝未知参数时关闭（仅 `responses`） |

> `apiKeyEnv` / `baseURL` / `model` 留空时按当前 `mode` 取默认。历史配置里由 schema 默认固化的 Qwen 地址/引用在切换模式时让位给新模式的默认值；同样固化的 DeepSeek 模型名只在切到智谱模式（其端点无法承载该模型）时让位。旧 schema 固化下来的 `1024` 输出预算同样按化石处理，而从配置页明确设置的 `1024` 依然生效。显式自定义的值则始终尊重。

从配置页保存时，所有键遵循同一条规则：空值会清除该键、让该模式自身的默认值重新生效；未提交的键维持原值；非法值会被拒绝并指名该键。`apiKey` 例外——留空表示保持已存密钥。

### 配置页

配置页在侧栏 **插件 → dsh-web-search-diy → `web-search-diy` 行的「配置」**（注册进 dsh 0.1.6-alpha.2 起的 `plugins.row.config` slot；旧「设置 → 插件 → 插件配置」页随该版本移除）。页面形态与官方插件配置页一致：编辑先暂存，点 **保存** 才写入，**放弃修改** 恢复为已存值；保存即生效，无需重启。页面文案跟随 设置 → 语言（zh / en）。API 密钥输入框只写不读：留空表示保持已存密钥。

协议列表把 **Anthropic 兼容（Messages API + web_search，DeepSeek 官方采用）** 放在首位，而已存默认值仍是 `responses`。切换协议时会填入该模式的官方接口地址、模型与凭据引用：属于「正在离开的那个服务商家族」的值会跟随切换，不属于任何已知家族的自定义值（网关令牌、自定义引用名）原样保留。由于进入一个桶里已是当前值的模式时表单看起来毫无变化，**协议选择本身就算一次待保存变更**：模式切换与改动的参数由同一次保存一起写入，只有草稿与宿主已存值完全一致时保存按钮才禁用。

字段按模式显示，与取值真正生效的位置对应：`zhipu-web-search` 隐藏 `model` 与 `maxOutputTokens`（无模型回合，条数由 `count` 决定），`searchIntent` 只在 `zhipu-web-search` 出现，`requireSearch`、`searchPrompt` 与 `reasoningEffort` 只在 `zhipu-chat-search` 出现，`apiVersion`、`maxUses`、`anthropicThinking` 只在 `anthropic-messages` 出现。选中 `search_pro_quark` 时，`count` 与 `searchDomainFilter` 的提示会注明该引擎不支持（值仍按原样发送，由端点忽略）。保存被拒时页面保留，错误显示在底部 footer——与官方配置页报告保存失败的位置一致。

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

- **responses**：每次搜索是一次 Responses API 调用（完整的一轮模型推理）。默认发送 `include: ["web_search_call.action.sources"]`——官方 API 把该字段列为 include-only，不传就只剩引用注解里的少量来源；网关拒绝未知参数时可在配置页关闭。来源按网关实际给出的形状收集并去重：`web_search_call.action.sources[]`（Qwen/OpenAI 形状；Kimi 会在这类条目上再带 `title`，插件保留它，引用注解的标题仍优先）、`action.type: "open_page"` / `"find_in_page"` 的 `action.url`（DeepSeek 形状）、`url_citation` 注解的 URL（同时为上述来源提供标题），以及智谱网关随 `web_search_call.results[]` 附带的 title/snippet 兜底补全。模型答案成为 `content`：优先取 OpenAI 标了 `phase: "final_answer"` 的 message，缺失该字段的网关（如智谱）退回最后一段非空 `output_text`——它们会在最终答案前插入"第一次搜索没有相关结果，让我换个查询"这类过程旁白。判定依据是**搜索证据**而非来源数量：响应里有 `web_search_call` 块或引用注解就算成功——DeepSeek 的 Responses 端点会执行搜索却完全不给 `action.sources[]`；两者都没有时以 `WEB_PROVIDER_ERROR` 响亮失败，绝不把模型凭自身知识写出的文本当成搜索结果（实测 2026-10-13：DeepSeek 官方 Responses 端点对 `deepseek-flash` 静默忽略内置 `web_search` 工具）。Kimi 的 Responses 端点（`https://api.moonshot.cn/v1`）支持 `{"type": "web_search"}`，带上 `include` 会回来 12–20 条带 `title` 的来源（实测 2026-10-13；其 sources 里会混入 Google 跳转链接，插件按 provider 原样透传）。
- **anthropic-messages**：每次搜索是一次 Anthropic Messages 调用，带原生 `web_search_20250305` 服务端工具。`web_search_tool_result` 块成为去重的 `sources[]`（`url`、可选 `title`、`page_age` → `publishedAt`；官方给的 `page_age` 是人类可读日期如 "April 30, 2025"，会先归一化为 ISO-8601，解析不出日期就丢弃），`snippet` 由响应的 `citations[].cited_text` 关联得到。提供方自己的文本不作为 `content` 返回（与官方提供方一致）。报告工具失败的 result 块（`max_uses_exceeded`、`too_many_requests` 等）会带出该错误码而不是笼统的 unprocessable body；空的结果列表按官方语义是"没搜到结果"而非错误，返回空 `sources[]`；完全没有 result 块的响应才以 `WEB_PROVIDER_ERROR` 响亮失败。注意智谱的 Claude 兼容端点（`https://open.bigmodel.cn/api/anthropic`）接受 `web_search_20250305` 却不执行搜索（实测 `server_tool_use.web_search_requests: 0`，模型自述无法联网），因此该端点在本模式下会响亮失败，不会把模型自身知识当成检索结果。Kimi 的 Anthropic 兼容端点（`https://api.moonshot.cn/anthropic`）官方 tools schema 只列了客户端工具，实测却会真的执行 `web_search_20250305` 并返回 `web_search_tool_result`（含 `title` 与 ISO 格式 `page_age`），所以本模式在 Kimi 上同样可用（实测 20 条来源）。
- **zhipu-web-search**：`search_result[]` 直接映射为去重的 `sources[]`（url + title），并取前至多八条「标题 + 摘要」拼接为 `content` 速览。空结果是合法结果，返回空 `sources[]` 而非报错。
- **zhipu-chat-search**：`choices[0].message.content` 即融合回答（`content`），工具声明的 `search_result: true` 让端点附带来源详情，从消息级/根级 `web_search` 字段防御式解析为 `sources[]`；有回答而无来源详情同样可用。
- **思考档位与自动降级**：档位集合因协议、因模型而异——智谱 GLM-5.3 只认 `max`/`high`/`low` 且拒绝关闭思考，Kimi 只认 `low`/`high`/`max`，DeepSeek 会静默接受并不生效的档位。因此所有档位默认都不传；一旦显式设置而端点以 400 拒绝（错误文本提到 effort / thinking / reasoning / 思考 / 档位，中英文均可），插件按 `reasoning.effort` → `output_config` → `thinking` → `reasoning_effort` 的顺序去掉一个档位重试，最多三次，改用端点自己的默认档完成这次搜索——不会因为档位不匹配让整次搜索失败。与档位无关的错误（配额、鉴权）不重试。
- **凭据处理**：密钥每次搜索动态解析，不在提供方上保留，作为 `authorization: Bearer` 发送（Anthropic 模式另加 `x-api-key` 与 `anthropic-version`）。缺少密钥抛 `WEB_PROVIDER_CREDENTIAL_MISSING`；搜索被取消抛 `WEB_ABORTED`。
- **响应解码对 dispatcher 免疫**：响应体按字节读取，压缩时按魔数就地解压，请求显式声明 `accept-encoding: identity`。这使插件能扛过 dsh 的跨版本全局 undici dispatcher（该环境下 `response.json()` 会拿到原始 gzip 字节），并设有解压炸弹硬上限（线路上限 8 MiB、解压上限 16 MiB）。

## 凭据

在 Web 的 **Models** 页 / 凭据服务里保存密钥（`$DSH_HOME/.credentials.yaml`），或在启动环境中导出。引用名按模式取默认：`responses` 为 `QWEN_TOKEN_PLAN_CN_API_KEY`，`anthropic-messages` 为 `DEEPSEEK_API_KEY`，智谱模式为 `ZAI_CODING_CN_API_KEY`（其后历史名 `ZHIPU_API_KEY`）。提供方每次搜索动态解析，不在自身保留密钥，也不把密钥写入配置文件。

## 许可证

MIT — see [LICENSE](LICENSE). Copyright (c) 2026 aaronlei.
