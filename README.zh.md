# dsh-web-search-diy

[English](README.md) · **简体中文**

<p align="center">
  <a href="https://www.npmjs.com/package/dsh-web-search-diy"><img alt="npm 版本" src="https://img.shields.io/npm/v/dsh-web-search-diy?style=flat-square&amp;label=npm&amp;color=cb3837"></a>
  <a href="LICENSE"><img alt="许可证：MIT" src="https://img.shields.io/npm/l/dsh-web-search-diy?style=flat-square&amp;color=blue"></a>
  <a href="package.json"><img alt="Node &gt;= 18" src="https://img.shields.io/badge/node-%3E%3D18-339933?style=flat-square&amp;logo=nodedotjs&amp;logoColor=white"></a>
  <a href="#协议模式"><img alt="协议数：4" src="https://img.shields.io/badge/protocols-4-8A2BE2?style=flat-square"></a>
  <a href="https://github.com/deepseek-ai/deepseek-harness"><img alt="dsh 插件" src="https://img.shields.io/badge/dsh-plugin-4D6BFE?style=flat-square"></a>
</p>

> **DeepSeek Harness（DSH）网页搜索提供方插件**：通过四种可选协议为内置 `web_search` 工具提供后端，返回**结构化引用来源**，供调用方模型作为作答依据。协议由单一 `mode` 配置项选定；各模式独立维护自身的端点、模型、凭据引用、输出预算与搜索选项，搜索模型与对话模型因此完全解耦。

## 核心能力

- 🔌 **四种协议，由单一配置项选定** —— OpenAI **Responses API**、带原生 `web_search_20250305` 服务端工具的 Anthropic **Messages API**，以及智谱的**基础检索**与**问答增强**两项服务。
- 🧾 **结构化引用来源** —— `web_search_call` 块、`web_search_tool_result` 块与 `url_citation` 注解统一归一为 seam 标准来源，去重并保留标题；模型凭自身知识生成的文本不会作为检索结果返回。
- 🚨 **证据缺失即显式失败** —— 响应不含搜索证据时抛出 `WEB_PROVIDER_ERROR`，不会把模型自身知识当作搜索结果返回。
- 🗂️ **配置按模式分桶** —— 进入某模式即恢复该模式自身的设置，刷新页面后亦然，不会沿用上一个模式的取值。
- 🪜 **思考档位自动降级** —— 被模型以 HTTP 400 拒绝的档位会被移除并重试，搜索以端点默认档位完成。
- 🔐 **凭据不落盘** —— 每次搜索经 `ctx.credentials` 动态解析，不在提供方上保留，也不写入配置文件。
- 🌐 **配置页跟随语言** —— 页面文案跟随 设置 → 语言（zh / en）。

## 协议模式

| `mode` | 协议与请求 | 确实执行服务端搜索的端点 |
|---|---|---|
| `responses`（默认） | `POST {baseURL}/responses`，带 `tools: [{ type: "web_search" }]` | 千问AI平台（默认）、OpenAI 官方、Kimi，以及任意实现了 `/responses` 的网关 |
| `anthropic-messages` | `POST {baseURL}/messages`，带原生 `web_search_20250305` 服务端工具 | DeepSeek（默认）、Anthropic 官方、Kimi，以及任意确会执行该服务端工具的网关 |
| `zhipu-web-search` | `POST {baseURL}/web_search`——纯检索，无模型回合 | 智谱开放平台 |
| `zhipu-chat-search` | `POST {baseURL}/chat/completions`，带 `web_search` 工具 | 智谱开放平台 |

### 各模式默认值

| `mode` | `baseURL` | `model` | `apiKeyEnv` | `maxOutputTokens` |
|---|---|---|---|---|
| `responses` | `https://maas.qianwenaiapi.com/compatible-mode/v1` | `deepseek-v4-flash-0731` | `QWEN_TOKEN_PLAN_API_KEY` | `4096` |
| `anthropic-messages` | `https://api.deepseek.com/anthropic/v1` | `deepseek-flash` | `DEEPSEEK_API_KEY` | `65536` |
| `zhipu-web-search` | `https://open.bigmodel.cn/api/paas/v4` | —（无模型回合） | `ZAI_CODING_CN_API_KEY` → `ZHIPU_API_KEY` | `4096`（不生效） |
| `zhipu-chat-search` | `https://open.bigmodel.cn/api/paas/v4` | `glm-5.3-flash` | `ZAI_CODING_CN_API_KEY` → `ZHIPU_API_KEY` | `4096` |

> ⚠️ **千问签发两类互不通用的凭据。** 按量付费 key（`sk-…` / `sk-ws-…`）对 `https://maas.qianwenaiapi.com/compatible-mode/v1` 有效——即本插件的默认地址，它确实实现了 `/responses` 与内置 `web_search` 工具；Token Plan 套餐专属 key（`sk-sp-…`）绑定 `token-plan.*.maas.aliyuncs.com` 域。将任一凭据用于另一类域名会返回 **HTTP 401**。千问的 **Anthropic 兼容**端点（`/apps/anthropic`）接受 `tools` 但**仅支持 Function Call**，会静默丢弃 `web_search_20250305`，因此千问需使用 `responses` 模式。

### 实测结果（2026-10-13）

| 协议 | 端点 | 结果 |
|---|---|---|
| `responses` | 千问 `maas.qianwenaiapi.com/compatible-mode/v1` | ✅ 每回合 26–37 条 `action.sources[]` url；`deepseek-v4-flash-0731` 与 `qwen3.8-flash` 均执行内置工具；`include` 被接受但非必需 |
| `responses` | Kimi `api.moonshot.cn/v1` | ✅ 12–20 条带标题来源；`{"type": "web_search"}` 确实执行 |
| `responses` | DeepSeek | ⚠️ `deepseek-v4-pro` 会搜索但仅给出 `open_page` 的 url；`deepseek-flash` 静默丢弃该工具——DeepSeek 需使用 `anthropic-messages` 模式 |
| `responses` | 智谱 | ✅ 执行，会在最终答案前输出过程旁白 |
| `anthropic-messages` | DeepSeek `api.deepseek.com/anthropic/v1` | ✅ 14–20 条来源 |
| `anthropic-messages` | Kimi `api.moonshot.cn/anthropic/v1` | ✅ 20 条来源，含 `title` 与 ISO 格式 `page_age` |
| `anthropic-messages` | 千问 `/apps/anthropic/v1/messages` | ❌ HTTP 200 但工具被丢弃：仅有文本，无 `server_tool_use`、无结果块 |
| `anthropic-messages` | 智谱 `/api/anthropic` | ❌ HTTP 200，`web_search_requests: 0` |

## 安装

已发布到 npm：

```bash
dsh plugin --profile web add dsh-web-search-diy
```

bundle patch 会完成接线，无需手动修改 `cordis.patch.yml`：

- 插入 `web-search-diy` loader 条目
- 覆盖共享 `web` 行：`searchProvider: diy-search`，并补回 `fetchProvider: http`（patch 会整段替换该行 config）
- 禁用官方 `web-search-deepseek` 提供方

本地开发调试：以本地链接方式安装 checkout（与其他本地插件一致）：

```bash
dsh plugin --profile web add link:./dsh-web-search-diy
```

把 `./dsh-web-search-diy` 替换为你本地 checkout 的实际路径。

> **本地链接安装注意事项**：插件将 `@deepseek-ai/*` 钩子声明为 `peerDependencies`（并在 `devDependencies` 中镜像）。链接包优先解析自身 `node_modules`，因此首次需在插件目录运行一次 `pnpm install`；运行时 peer 由 harness 安装提供。

## 配置

选项优先级：**UI 管理文件（`$DSH_HOME/dsh-web-search-diy.json`，由配置页写入）> settings 段 / entry 配置 > 包默认值。**

### 配置文件

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

顶层 `mode` 记录当前选中的协议。每个桶仅保存该模式使用的键：配置页提交的是整张表单，因此属于其它模式的字段不会被写入，已有桶中的这类残留会在该模式下次保存时移除。配置页中清空的键会被删除而非写入空值，因此文件中仅保留显式选择，被清空的桶整体移除。`apiKeyEnv` / `baseURL` / `model` 留空时继承当前模式的默认值。

读取时也接受单一的扁平对象（投影到它当时选中的模式），下一次保存即改写为分桶结构；读取过程不写盘。

### 配置项

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
| `anthropicEffort` | —（不传） | Anthropic 兼容回合的 `output_config.effort`：`low` / `medium` / `high` / `xhigh` / `max`；被拒时自动去掉该档位重试（仅 `anthropic-messages`） |
| `responsesReasoningEffort` | —（不传） | OpenAI 兼容回合的推理档位 `reasoning.effort`：官方全集 `minimal` / `low` / `medium` / `high` / `xhigh`；被拒时自动去掉该档位重试（仅 `responses`） |
| `responsesIncludeSources` | `true` | 发送 `include: ["web_search_call.action.sources"]` 取回完整来源列表（官方 API 里该字段是 include-only）；网关拒绝未知参数时关闭（仅 `responses`） |
| `responsesToolType` | `web_search` | `tools[]` 里声明的工具名：官方 `web_search`、OpenRouter 规范名 `openrouter:web_search`，或 OpenRouter 在 `responses` 格式同时接受的别名 `web_search_20250305`——名字不对时该端点可能完全不执行搜索（仅 `responses`） |
| `searchEngine` | `search_std` | 智谱搜索引擎：`search_std` / `search_pro` / `search_pro_sogou` / `search_pro_quark`（仅智谱模式） |
| `count` | `10` | 智谱返回条数（1-50）；请求自带 `maxResults` 上限时优先使用请求值（仅智谱模式） |
| `searchRecencyFilter` | `noLimit` | 智谱时间范围：`noLimit` / `oneDay` / `oneWeek` / `oneMonth` / `oneYear`（仅智谱模式） |
| `contentSize` | `medium` | 智谱摘要字数：`medium` / `high`（仅智谱模式） |
| `searchDomainFilter` | — | 智谱域名白名单，如 `www.example.com`（仅智谱模式） |
| `searchIntent` | `false` | 智谱意图识别；关闭则跳过识别直接搜索（仅 `zhipu-web-search`） |
| `requireSearch` | `false` | 强制接口在有搜索结果时才作答（`require_search: true`）；关闭则请求体保持原样（仅 `zhipu-chat-search`） |
| `searchPrompt` | — | 智谱问答增强的搜索提示词，留空用官方默认（仅 `zhipu-chat-search`） |
| `reasoningEffort` | `low` | 问答增强回合的思考强度 `reasoning_effort`：`low` / `high` / `max`；`low` 让 GLM-5.3-Flash 这类强制思考模型保持快速（仅 `zhipu-chat-search`） |

端点、模型与凭据引用中属于**其它模式家族**的值，会在切换模式时被当前模式的默认值替换；显式自定义的值始终保留。从配置页保存时，所有键遵循同一规则：空值清除该键，使该模式自身的默认值重新生效；未提交的键维持原值；非法值被拒绝并指明该键。`apiKey` 例外——留空表示保留已存密钥。

### 配置页

配置页位于侧栏 **插件 → dsh-web-search-diy → `web-search-diy` 行的「配置」**（注册进 `plugins.row.config` slot）。页面形态与官方插件配置页一致：编辑先暂存，点击 **保存** 才写入，**放弃修改** 恢复为已存值；保存即生效，无需重启。页面文案跟随 设置 → 语言（zh / en）；API 密钥输入框只接受写入：留空表示保留已存密钥。

协议列表将 **Anthropic 兼容（Messages API + web_search，DeepSeek 官方采用）** 置于首位，而已存默认值仍为 `responses`。切换协议时会填入该模式的官方接口地址、模型与凭据引用：属于「正在离开的服务商家族」的值会跟随切换，不属于任何已知家族的自定义值（网关令牌、自定义引用名）按输入原样保留。由于进入桶中已保存当前值的模式时表单不会发生变化，**协议选择本身即计为一次待保存变更**：模式切换与改动的参数由同一次保存一并写入，仅当草稿与宿主已存值完全一致时保存按钮才禁用。

字段按模式显示，与取值实际生效的位置对应：`zhipu-web-search` 隐藏 `model` 与 `maxOutputTokens`（无模型回合，条数由 `count` 决定），`searchIntent` 仅在 `zhipu-web-search` 出现，`requireSearch` / `searchPrompt` / `reasoningEffort` 仅在 `zhipu-chat-search` 出现，`apiVersion` / `maxUses` / `anthropicThinking` / `anthropicEffort` 仅在 `anthropic-messages` 出现。选中 `search_pro_quark` 时，`count` 与 `searchDomainFilter` 的提示会注明该引擎不支持（取值仍按配置发送，由端点忽略）。保存被拒时页面保持打开，错误显示在底部 footer。

## 工作原理

```
你 ──> 对话 LLM
            │ 需要实时信息时
            ▼
      web_search 工具（与模型无关）
            │ ctx.web seam ──> diy-search 提供方
            ▼
      ├─ responses：         POST {baseURL}/responses   tools: [{ type: "web_search" }]
      ├─ anthropic-messages：POST {baseURL}/messages    tools: [{ type: "web_search_20250305", name: "web_search", max_uses }]
      ├─ zhipu-web-search：  POST {baseURL}/web_search  （纯检索，无模型回合）
      └─ zhipu-chat-search： POST {baseURL}/chat/completions  tools: [{ type: "web_search", web_search: {...} }]
            │
            ▼
      对话 LLM 基于搜索结果作答
```

- **`responses`** —— 每次搜索为一次 Responses API 调用（完整的模型回合）。默认发送 `include: ["web_search_call.action.sources"]`，因为官方 API 仅在该字段被显式请求时才返回 `action.sources`；网关拒绝未知参数时可在配置页关闭。块类型按官方 `web_search_call` 拼写匹配，并接受同一 `:web_search` 后缀——对服务端工具加了厂商命名空间的网关（OpenRouter 的 `openrouter:web_search`）按同样方式读取。来源按网关实际返回的形状收集并去重：`web_search_call.action.sources[]`（Qwen/OpenAI 形状——Kimi 会在该类条目上附带 `title`，插件予以保留）、`action.type: "open_page"` / `"find_in_page"` 的 `action.url`（DeepSeek 形状）、`url_citation` 注解的 url（同时为上述来源提供标题），以及智谱网关随 `web_search_call.results[]` 附带的 title/snippet 补齐。模型答案作为 `content`：优先取标记了 `phase: "final_answer"` 的 message，缺失该字段的网关（千问、智谱）则取**最后一段**非空 `output_text`，因为这类网关会在最终答案前插入过程旁白。判定依据是**搜索证据**而非来源数量：存在 `web_search_call` 块（或同后缀的命名空间块）且其官方 `status` 不为 `failed` / `incomplete`，或存在引用注解，即视为成功。声明失败的块仍贡献其 url，但被报告为「搜索未完成」，而非归咎于端点；两者皆无时以显式错误失败，并在消息中列出实际观测到的 output item 类型。404 会被报告为「该端点缺少 `/responses` 路径」，并列出确实实现了该路径的端点。
- **`anthropic-messages`** —— 每次搜索为一次 Messages 调用，带原生服务端工具。`web_search_tool_result` 条目成为去重后的 `sources[]`（`url`、可选 `title`、`page_age` → `publishedAt`，归一化为 ISO-8601，无法解析日期时省略），`snippet` 由响应的 `citations[].cited_text` 关联得到。提供方自身的文本不作为 `content` 返回。报告工具失败的 result 块会给出其错误码（`max_uses_exceeded`、`too_many_requests` 等），而非笼统的 unprocessable body；空结果列表表示「无匹配结果」，返回空 `sources[]`；完全不含 result 块的响应以显式错误失败。千问与智谱的 Anthropic 兼容端点正是如此：接受该工具，却将其丢弃。
- **`zhipu-web-search`** —— `search_result[]` 直接映射为去重后的 `sources[]`（url + title），并取至多八条「标题 + 摘要」拼接为 `content` 速览。空结果是合法结果。
- **`zhipu-chat-search`** —— `choices[0].message.content` 为融合回答（`content`）；工具声明的 `search_result: true` 使端点附带来源详情，从消息级或根级 `web_search` 字段防御式解析为 `sources[]`。有回答而无来源详情仍属可用结果。
- **思考档位自动降级** —— 档位集合因协议与模型而异：智谱 GLM-5.3 仅接受 `max`/`high`/`low` 且拒绝关闭思考，Kimi 仅接受 `low`/`high`/`max`，DeepSeek 会静默接受其并不生效的档位。因此所有档位默认均不传；当显式选择的档位被端点以 400 拒绝（错误文本提及 effort / thinking / reasoning / 思考 / 档位，中英文皆可识别），插件按 `reasoning.effort` → `output_config` → `thinking` → `reasoning_effort` 的顺序移除一个档位并重试，最多三次。与档位无关的错误（配额、鉴权）不重试。
- **凭据处理** —— 密钥每次搜索动态解析，不在提供方上保留，以 `authorization: Bearer` 发送（Anthropic 模式另加 `x-api-key` 与 `anthropic-version`）。缺少密钥抛出 `WEB_PROVIDER_CREDENTIAL_MISSING`；搜索被取消抛出 `WEB_ABORTED`。
- **响应解码对 dispatcher 免疫** —— 响应体按字节读取，压缩时按魔数就地解压，请求显式声明 `accept-encoding: identity`。这使插件在 dsh 的跨版本全局 undici dispatcher 下仍能正确解析（该环境下 `response.json()` 会得到原始 gzip 字节），并设有解压炸弹硬上限（线路上限 8 MiB、解压上限 16 MiB）。

## 凭据

在 Web 的 **Models** 页 / 凭据服务里保存密钥（`$DSH_HOME/.credentials.yaml`），或在启动环境中导出。引用名按模式取默认：`responses` 为 `QWEN_TOKEN_PLAN_API_KEY`，`anthropic-messages` 为 `DEEPSEEK_API_KEY`，智谱模式为 `ZAI_CODING_CN_API_KEY`（其后 `ZHIPU_API_KEY`）。若改用 Anthropic 官方端点，请将 `baseURL` 设为 `https://api.anthropic.com/v1`、`apiKeyEnv` 设为 `ANTHROPIC_API_KEY`；该模式的默认值属于 DeepSeek 端点。提供方每次搜索动态解析，不在自身保留密钥，也不把密钥写入配置文件。

## 开发

服务端部分为手写维护的源码 [lib/index.js](lib/index.js)；浏览器部分的权威源是 [src/client/index.tsx](src/client/index.tsx)，宿主消费的是其**构建后**的 bundle `lib/client.js`（官方客户端插件同样使用 tsdown 构建），因此 UI 改动一律需经构建：

```bash
pnpm install         # 首次：安装 tsdown、TypeScript 与 React 类型
pnpm run bundle      # 一次性构建，或 pnpm run watch（保存即重建）
pnpm run typecheck   # 类型检查在这一步（tsdown 只转译）
pnpm run test:client # 先重建再校验产物的契约
pnpm run test        # 服务端测试
```

`lib/client.js` 入库，因为本地链接安装与 npm 发布包交付的均为构建产物；source map 属本地构建副产品，不入库。`pnpm run test:client` 先重建再校验，因此陈旧产物无法通过校验。[scripts/verify-client.mjs](scripts/verify-client.mjs) 将构建产物载入保真的 React 替身（真实的 `useState`/`useEffect`/`useRef` 语义，`ctx.effect` 立即执行），当产物与卡片的注册路径、按模式可见的字段、分桶切换或保存控件状态发生偏离时会直接失败。

## 许可证

MIT —— 见 [LICENSE](LICENSE)。Copyright (c) 2026 aaronlei.

[![](https://img.shields.io/badge/powered_by-dsh-4D6BFE?style=flat-square&logo=deepseek&logoColor=white)](https://github.com/deepseek-ai/deepseek-harness)
