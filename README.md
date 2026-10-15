# dsh-web-search-diy

**English** · [简体中文](README.zh.md)

<p align="center">
  <a href="https://www.npmjs.com/package/dsh-web-search-diy"><img alt="npm version" src="https://img.shields.io/npm/v/dsh-web-search-diy?style=flat-square&amp;label=npm&amp;color=cb3837"></a>
  <a href="LICENSE"><img alt="license: MIT" src="https://img.shields.io/npm/l/dsh-web-search-diy?style=flat-square&amp;color=blue"></a>
  <a href="package.json"><img alt="node &gt;= 18" src="https://img.shields.io/badge/node-%3E%3D18-339933?style=flat-square&amp;logo=nodedotjs&amp;logoColor=white"></a>
  <a href="#protocol-modes"><img alt="protocols: 4" src="https://img.shields.io/badge/protocols-4-8A2BE2?style=flat-square"></a>
  <a href="https://github.com/deepseek-ai/deepseek-harness"><img alt="dsh plugin" src="https://img.shields.io/badge/dsh-plugin-4D6BFE?style=flat-square"></a>
</p>

> A **web search provider plugin** for the **DeepSeek Harness (DSH)**. It supplies the built-in `web_search` tool through four selectable protocols and returns **structured citation sources** for the calling model to ground its answer on. A single `mode` selects the protocol; each mode maintains its own endpoint, model, credential reference, output budget, and search options, keeping search and conversation models fully independent.

## Capabilities

- 🔌 **Four protocols, selected by one option** — the OpenAI **Responses API**, the Anthropic **Messages API** with the native `web_search_20250305` server tool, and Zhipu's **basic retrieval** and **answer-augmentation** services.
- 🧾 **Structured citation sources** — `web_search_call` blocks, `web_search_tool_result` blocks, and `url_citation` annotations are normalized into seam-standard sources, deduplicated and titled. Text generated from the model's own knowledge is never returned as a retrieval result.
- 🚨 **Explicit failure instead of silent substitution** — a reply carrying no search evidence raises `WEB_PROVIDER_ERROR`, rather than returning the model's own knowledge as a search result.
- 🗂️ **Per-mode configuration buckets** — entering a mode restores that mode's own settings, including after a page reload, without inheriting values from the previous mode.
- 🪜 **Automatic degradation of thinking-effort parameters** — an effort level rejected by the model with HTTP 400 is removed and the request retried, so the search completes with the endpoint's default.
- 🔐 **Credentials are never persisted** — resolved per search through `ctx.credentials`, never retained on the provider, never written to a configuration file.
- 🌐 **Localized configuration page** — page copy follows Settings → Language (zh / en).

## Protocol modes

| `mode` | Request | Endpoints that perform server-side search |
|---|---|---|
| `responses` *(default)* | `POST {baseURL}/responses` with `tools: [{ type: "web_search" }]` | Qwen AI Platform *(default)*, OpenAI, Kimi, any gateway that implements `/responses` |
| `anthropic-messages` | `POST {baseURL}/messages` with the native `web_search_20250305` server tool | DeepSeek *(default)*, Anthropic, Kimi, any gateway that executes the Anthropic server tool |
| `zhipu-web-search` | `POST {baseURL}/web_search` — basic retrieval, no model turn | Zhipu open platform |
| `zhipu-chat-search` | `POST {baseURL}/chat/completions` with the `web_search` tool | Zhipu open platform |

### Default values per mode

| `mode` | `baseURL` | `model` | `apiKeyEnv` | `maxOutputTokens` |
|---|---|---|---|---|
| `responses` | `https://maas.qianwenaiapi.com/compatible-mode/v1` | `deepseek-v4-flash-0731` | `QWEN_TOKEN_PLAN_API_KEY` | `4096` |
| `anthropic-messages` | `https://api.deepseek.com/anthropic/v1` | `deepseek-flash` | `DEEPSEEK_API_KEY` | `65536` |
| `zhipu-web-search` | `https://open.bigmodel.cn/api/paas/v4` | — (no model turn) | `ZAI_CODING_CN_API_KEY` → `ZHIPU_API_KEY` | `4096` (unused) |
| `zhipu-chat-search` | `https://open.bigmodel.cn/api/paas/v4` | `glm-5.3-flash` | `ZAI_CODING_CN_API_KEY` → `ZHIPU_API_KEY` | `4096` |

> ⚠️ **Qwen issues two distinct credential types, which are not interchangeable.** A pay-as-you-go key (`sk-…` / `sk-ws-…`) is valid against `https://maas.qianwenaiapi.com/compatible-mode/v1` — the default here, which implements `/responses` with the built-in `web_search` tool. A Token Plan subscription key (`sk-sp-…`) is bound to a `token-plan.*.maas.aliyuncs.com` endpoint. Presenting either credential to the other's domain returns **HTTP 401**. Qwen's **Anthropic-compatible** surface (`/apps/anthropic`) accepts `tools` for **function calling only** and silently discards `web_search_20250305`; Qwen therefore requires the `responses` mode.

### Live verification (2026-10-13)

| Protocol | Endpoint | Result |
|---|---|---|
| `responses` | Qwen `maas.qianwenaiapi.com/compatible-mode/v1` | ✅ 26–37 `action.sources[]` urls per turn; `deepseek-v4-flash-0731` and `qwen3.8-flash` both execute the built-in tool; `include` is accepted but not required |
| `responses` | Kimi `api.moonshot.cn/v1` | ✅ 12–20 titled sources; `{"type": "web_search"}` executes |
| `responses` | DeepSeek | ⚠️ `deepseek-v4-pro` searches but reports only `open_page` urls; `deepseek-flash` silently discards the tool — use the `anthropic-messages` mode with DeepSeek |
| `responses` | Zhipu | ✅ executes, emitting progress messages before the answer |
| `anthropic-messages` | DeepSeek `api.deepseek.com/anthropic/v1` | ✅ 14–20 sources |
| `anthropic-messages` | Kimi `api.moonshot.cn/anthropic/v1` | ✅ 20 sources with `title` and ISO `page_age` |
| `anthropic-messages` | Qwen `/apps/anthropic/v1/messages` | ❌ HTTP 200 with the tool discarded: prose only, no `server_tool_use`, no result block |
| `anthropic-messages` | Zhipu `/api/anthropic` | ❌ HTTP 200, `web_search_requests: 0` |

## Install

Published on npm:

```bash
dsh plugin --profile web add dsh-web-search-diy
```

The bundle patch performs the wiring, so no manual `cordis.patch.yml` edits are required:

- inserts the `web-search-diy` loader entry
- overrides the shared `web` row's `searchProvider` to `diy-search` and restates `fetchProvider: http` (a patch replaces the whole row config)
- disables the shipped `web-search-deepseek` provider

For local development, install the checkout as a linked package (the same way other local plugins are linked):

```bash
dsh plugin --profile web add link:./dsh-web-search-diy
```

Replace `./dsh-web-search-diy` with the actual path to your checkout.

> **Notes for linked installs:** the plugin declares its `@deepseek-ai/*` hooks as `peerDependencies` (mirrored in `devDependencies`). A linked package resolves its own `node_modules` first, so run `pnpm install` inside the plugin directory once; the harness installation supplies the runtime peers.

## Configuration

Options resolve with this precedence: **UI-managed file (`$DSH_HOME/dsh-web-search-diy.json`, written by the configuration page) > settings section / entry config > package defaults.**

### Configuration file

The file is **bucketed by protocol mode**:

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

The top-level `mode` records the selected protocol. Each bucket stores only the keys that mode uses: the page submits its whole form, so a field belonging to another mode is never written, and a leftover of one in an existing bucket is removed on that mode's next save. Keys cleared in the page are deleted rather than stored blank, so the file retains only explicit choices, and an emptied bucket is removed entirely. A blank `apiKeyEnv` / `baseURL` / `model` inherits the current mode's default.

A single flat object is still accepted on read (projected onto the mode it selected); the next save rewrites it in the bucketed shape. Reads never write.

### Keys

| Key | Default | Meaning |
|---|---|---|
| `mode` | `responses` | Protocol: `responses` / `anthropic-messages` / `zhipu-web-search` / `zhipu-chat-search` |
| `apiKey` | — | Literal API key; overrides `apiKeyEnv` when set |
| `apiKeyEnv` | per mode (see above) | Credential reference resolved per search via `ctx.credentials`; blank uses the mode's own chain |
| `baseURL` | per mode (see above) | API base; `/responses`, `/messages`, `/web_search`, or `/chat/completions` is appended per mode |
| `model` | per mode (see above) | Model served by the endpoint; `zhipu-web-search` has no model turn and ignores this key |
| `maxOutputTokens` | per mode: `65536` in `anthropic-messages`, `4096` elsewhere | Output cap for one search turn (`max_output_tokens` in `responses`, `max_tokens` in `anthropic-messages` and `zhipu-chat-search`) |
| `apiVersion` | `2023-06-01` | `anthropic-version` header sent with each request (`anthropic-messages` only) |
| `maxUses` | `5` | Maximum `web_search` server-tool uses per request, sent as `max_uses` (`anthropic-messages` only) |
| `anthropicThinking` | `default` | `default` sends no parameter; `disabled` sends `thinking: {type: "disabled"}` (`anthropic-messages` only) |
| `anthropicEffort` | — (unset) | Anthropic `output_config.effort`: `low` / `medium` / `high` / `xhigh` / `max`; a rejected level is retried without it (`anthropic-messages` only) |
| `responsesReasoningEffort` | — (unset) | OpenAI-standard `reasoning.effort`: the full official set `minimal` / `low` / `medium` / `high` / `xhigh`; a rejected level is retried without it (`responses` only) |
| `responsesIncludeSources` | `true` | Sends `include: ["web_search_call.action.sources"]` to get the complete source list (an include-only field in the official API); turn it off when a gateway rejects unknown parameters (`responses` only) |
| `responsesToolType` | `web_search` | Tool name declared in `tools[]`: `web_search` (official), `openrouter:web_search` (OpenRouter's canonical name), or `web_search_20250305` (an alias OpenRouter also accepts on `responses`) — the wrong name can make the endpoint run no search at all (`responses` only) |
| `searchEngine` | `search_std` | Zhipu engine: `search_std` / `search_pro` / `search_pro_sogou` / `search_pro_quark` (Zhipu modes) |
| `count` | `10` | Zhipu result count (1-50); a request-supplied `maxResults` cap takes precedence (Zhipu modes) |
| `searchRecencyFilter` | `noLimit` | Zhipu recency window: `noLimit` / `oneDay` / `oneWeek` / `oneMonth` / `oneYear` (Zhipu modes) |
| `contentSize` | `medium` | Zhipu snippet size: `medium` / `high` (Zhipu modes) |
| `searchDomainFilter` | — | Zhipu domain allowlist, e.g. `www.example.com` (Zhipu modes) |
| `searchIntent` | `false` | Zhipu intent recognition; off searches directly (`zhipu-web-search` only) |
| `requireSearch` | `false` | Make the endpoint refuse to answer without search results (`require_search: true`); off keeps the request body unchanged (`zhipu-chat-search` only) |
| `searchPrompt` | — | Zhipu chat search prompt; blank uses the official default (`zhipu-chat-search` only) |
| `reasoningEffort` | `low` | Thinking effort (`reasoning_effort`) for the chat turn: `low` / `high` / `max`; `low` keeps thinking-only models like GLM-5.3-Flash fast (`zhipu-chat-search` only) |

Endpoint, model, and credential-reference values belonging to another mode's family are replaced by the current mode's defaults on a mode switch; explicitly customized values are always preserved. Every key saved from the card follows one rule: a blank value clears the key so the mode's own default applies again, an omitted key is left untouched, and an invalid value is rejected with a message naming it. `apiKey` is the exception — a blank value retains the stored secret.

### Configuration page

The page is available in the sidebar under **Plugins → dsh-web-search-diy → the `web-search-diy` row's Configure** (the `plugins.row.config` slot). It matches the official plugin configuration pages: edits stage locally and only **Save** writes, while **Discard** reverts to the stored values. Saving takes effect immediately — no restart. Page copy follows Settings → Language (zh / en), and the API key input is write-only: a blank value retains the stored key.

The protocol list places **Anthropic-compatible (Messages API + web_search, used by DeepSeek official)** first, while the stored default remains `responses`. Switching the protocol fills in the new mode's official endpoint, model, and credential reference; a value belonging to the family being left follows the switch, and a value outside every known family (a gateway token, a custom name) is preserved as entered. Because entering a mode whose bucket already holds the current values would otherwise leave the form unchanged, the selected protocol counts as a pending change on its own: **the mode switch and any edited parameters are written by the same Save**, and the button is disabled only when the draft matches what the host holds.

Fields are displayed per mode, mirroring where each value actually applies: `model` and `maxOutputTokens` are hidden in `zhipu-web-search` (no model turn — `count` governs the result size there), `searchIntent` is offered only in `zhipu-web-search`, `requireSearch` / `searchPrompt` / `reasoningEffort` only in `zhipu-chat-search`, and `apiVersion` / `maxUses` / `anthropicThinking` / `anthropicEffort` only in `anthropic-messages`. When `search_pro_quark` is selected, the `count` and `searchDomainFilter` hints note that the engine does not support them (the values are still sent as configured; the endpoint ignores them). A rejected save keeps the page open with the error in the footer.

## How it works

```
you ──> chat LLM
            │ decides it needs live info
            ▼
     web_search tool (model-agnostic)
            │ ctx.web seam ──> diy-search provider
            ▼
     ├─ responses:         POST {baseURL}/responses   tools: [{ type: "web_search" }]
     ├─ anthropic-messages:POST {baseURL}/messages    tools: [{ type: "web_search_20250305", name: "web_search", max_uses }]
     ├─ zhipu-web-search:  POST {baseURL}/web_search  (raw retrieval, no model turn)
     └─ zhipu-chat-search: POST {baseURL}/chat/completions  tools: [{ type: "web_search", web_search: {...} }]
            │
            ▼
     chat LLM answers grounded in the results
```

- **`responses`** — one Responses API call per search (a complete model turn). It sends `include: ["web_search_call.action.sources"]` by default, because the official API returns `action.sources` only when requested; the switch disables it on a gateway that rejects unknown parameters. The block type is matched on the official `web_search_call` spelling and on the same `:web_search` suffix, so a gateway that namespaces its server tool (OpenRouter's `openrouter:web_search`) is read identically. Sources are collected, deduplicated, and shaped according to what the gateway actually returns: `web_search_call.action.sources[]` (the Qwen/OpenAI shape — Kimi titles those items and the title is retained), `action.url` on `action.type: "open_page"` / `"find_in_page"` (the DeepSeek shape), the urls of `url_citation` annotations (which also supply titles for the sources above), plus title/snippet joined from Zhipu's per-call `results[]`. The model's answer becomes `content`: the message labelled `phase: "final_answer"` when present, otherwise the **last** non-empty `output_text`, since gateways that omit `phase` (Qwen, Zhipu) insert progress notes before the answer. Success is determined by **search evidence**, not by source count: a `web_search_call` block (or a namespaced one matching the same suffix) whose official `status` is not `failed` / `incomplete`, or a citation, is sufficient. A block that reports failure still contributes its urls but is surfaced as an unfinished search instead of being blamed on the endpoint, and when no evidence is present the call fails with an explicit error that names the output item types it actually saw. A 404 is reported as a missing `/responses` surface, naming endpoints that do implement it.
- **`anthropic-messages`** — one Messages turn with the native server tool. `web_search_tool_result` items become deduplicated `sources[]` (`url`, optional `title`, `page_age` → `publishedAt`, normalized to ISO-8601 and omitted when it carries no parsable date), and `snippet` is joined from the response's `citations[].cited_text`. The provider's own prose is deliberately not returned as `content`. A result block reporting a tool failure surfaces its `error_code` (`max_uses_exceeded`, `too_many_requests`, …) instead of an unprocessable body; an empty result list represents "no matches" and resolves to empty `sources[]`; a response with no result block at all fails with an explicit error. Qwen's and Zhipu's Anthropic-compatible surfaces behave in exactly that way: both accept the tool and discard it.
- **`zhipu-web-search`** — `search_result[]` maps directly into deduplicated `sources[]` (url + title), and a digest of up to eight title-plus-snippet entries becomes the `content` overview. An empty result set is a valid outcome.
- **`zhipu-chat-search`** — `choices[0].message.content` is the grounded answer (`content`); the tool's `search_result: true` declaration makes the endpoint attach source details, which are parsed defensively from the message-level or root-level `web_search` field into `sources[]`. A grounded answer without source details remains a usable result.
- **Thinking-effort parameters degrade automatically** — level sets differ per protocol and per model: Zhipu's GLM-5.3 accepts only `max`/`high`/`low` and refuses to disable thinking, Kimi accepts `low`/`high`/`max`, and DeepSeek silently accepts a level it does not apply. Every parameter is therefore unset by default; when an explicitly selected level is rejected with 400 (the message mentions effort/thinking/reasoning, in English or Chinese), the provider removes one parameter — `reasoning.effort` → `output_config` → `thinking` → `reasoning_effort` — and retries, at most three times. Failures unrelated to these parameters (quota, authentication) are never retried.
- **Credential handling** — the key is resolved per search, never retained on the provider, and sent as `authorization: Bearer` (the Anthropic mode adds `x-api-key` and `anthropic-version`). A missing key raises `WEB_PROVIDER_CREDENTIAL_MISSING`; a cancelled search raises `WEB_ABORTED`.
- **Dispatcher-proof response decoding** — bodies are read as bytes and inflated by magic number when compressed, and requests send `accept-encoding: identity`. This remains correct under dsh's cross-version global undici dispatcher (where `response.json()` would parse raw gzip bytes), with hard caps (8 MiB wire, 16 MiB decoded) against decompression bombs.

## Credentials

Store the key through the web **Models** page / credentials service (`$DSH_HOME/.credentials.yaml`), or export it in the launching environment. The default reference is per mode: `QWEN_TOKEN_PLAN_API_KEY` in `responses`, `DEEPSEEK_API_KEY` in `anthropic-messages`, and `ZAI_CODING_CN_API_KEY` (then `ZHIPU_API_KEY`) in the Zhipu modes. To use Anthropic's own endpoint instead, set `baseURL` to `https://api.anthropic.com/v1` and `apiKeyEnv` to `ANTHROPIC_API_KEY`; the mode defaults belong to DeepSeek's endpoint. The provider resolves the key per search; no key is retained on the provider, and no key is written to the configuration file.

## Development

The server implementation is hand-written source at [lib/index.js](lib/index.js). The browser half's authoritative source is [src/client/index.tsx](src/client/index.tsx), and the host consumes its **built** bundle at `lib/client.js` (the official client plugins are built the same way, with tsdown), so UI changes always go through the build:

```bash
pnpm install         # once: tsdown, TypeScript, React types
pnpm run bundle      # one-shot build, or: pnpm run watch (rebuild on save)
pnpm run typecheck   # types are checked here — tsdown only transpiles
pnpm run test:client # rebuilds first, then asserts the artifact's contracts
pnpm run test        # server-side suites
```

`lib/client.js` is committed because both a linked local install and the published package ship the built artifact; the source map is a local build product and stays out of git. `pnpm run test:client` rebuilds before it asserts, so a stale artifact cannot pass validation. [scripts/verify-client.mjs](scripts/verify-client.mjs) loads the built bundle into a hook-faithful React stand-in — real `useState`/`useEffect`/`useRef` semantics and an immediately-running `ctx.effect` — so it fails if the artifact and the card's registration, mode-scoped fields, bucket switching, or save-control states diverge.

## License

MIT — see [LICENSE](LICENSE). Copyright (c) 2026 aaronlei.

[![](https://img.shields.io/badge/powered_by-dsh-4D6BFE?style=flat-square&logo=deepseek&logoColor=white)](https://github.com/deepseek-ai/deepseek-harness)
