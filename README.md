# dsh-web-search-diy

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

A **web search provider plugin** for the **DeepSeek Harness (DSH)** that backs the built-in `web_search` tool with four selectable protocols, returning **structured citation sources** the calling model can ground its answer on. One `mode` selects the protocol, and each mode keeps its own endpoint, model, credential reference, output budget, and search options.

## Protocol modes

| `mode` | Protocol and request | Backend |
|---|---|---|
| `responses` (default) | OpenAI-compatible **Responses API** — `POST /responses` with `tools: [{ type: "web_search" }]` | Qwen Token Plan (the default example), OpenAI, any compatible gateway exposing the Responses surface |
| `anthropic-messages` | **Anthropic-compatible Messages API** — `POST /messages` with the native `web_search_20250305` server tool | DeepSeek's official Anthropic endpoint (a drop-in for the shipped provider), any Anthropic-compatible gateway |
| `zhipu-web-search` | Zhipu **Web Search API** (basic retrieval) — `POST /web_search`, no model turn | Zhipu open platform; raw structured results |
| `zhipu-chat-search` | Zhipu **Web Search in Chat** (answer augmentation) — `POST /chat/completions` with the `web_search` tool | Zhipu open platform; retrieval fused into a grounded answer |

Defaults per mode:

| `mode` | `baseURL` | `model` | `apiKeyEnv` | `maxOutputTokens` |
|---|---|---|---|---|
| `responses` | `https://token-plan.cn-beijing.maas.aliyuncs.com/compatible-mode/v1` | `deepseek-v4-flash-0731` | `QWEN_TOKEN_PLAN_CN_API_KEY` | `4096` |
| `anthropic-messages` | `https://api.deepseek.com/anthropic/v1` | `deepseek-flash` | `DEEPSEEK_API_KEY` | `65536` |
| `zhipu-web-search` | `https://open.bigmodel.cn/api/paas/v4` | — (no model turn) | `ZHIPU_API_KEY`, then `ZAI_CODING_CN_API_KEY` | `4096` (unused) |
| `zhipu-chat-search` | `https://open.bigmodel.cn/api/paas/v4` | `glm-5.3-flash` | `ZHIPU_API_KEY`, then `ZAI_CODING_CN_API_KEY` | `4096` |

**`responses`** is the historical behavior of this plugin: endpoint, model, and credential reference are yours to swap, and the only requirement is a model that actually exposes the `web_search` tool on its gateway. The one extra knob is `responsesReasoningEffort`, which passes the OpenAI-standard `reasoning.effort` (`low` / `high`); it is unset by default, because a gateway that does not implement the parameter may reject the whole request — leave it unset there.

**`anthropic-messages`** speaks DeepSeek's Anthropic-compatible endpoint: `baseURL` gets `/messages` appended, the credential reference defaults to `DEEPSEEK_API_KEY` (the same credential the shipped provider and the conversation model use), and the model defaults to `deepseek-flash`, the endpoint's rolling latest Flash. The endpoint's API names are `deepseek-flash` and `deepseek-v4-pro`; a version string is not an API name (`deepseek-v4.1-flash` is rejected with HTTP 400). Two protocol-specific keys exist: `apiVersion` (the `anthropic-version` header, default `2023-06-01`) and `maxUses` (`max_uses`, default 5). The output budget defaults to `65536` — DeepSeek's documented `max_tokens` default for thinking mode (8K with thinking off, 128K at `reasoning_effort: max`, ceiling 384K). The Anthropic protocol wants the field present, so the plugin sends that default explicitly rather than relying on server-side behavior; it is a ceiling, not a reservation, and a tight value truncates the turn and cuts the tool round short. A blank endpoint falls back to `$DEEPSEEK_SEARCH_BASE_URL` before the built-in default, the same override the shipped provider honors. Each Anthropic turn is also recorded on the calling session as `web/deepseek-search-llm-request` (endpoint, `anthropic-version`, body), exactly as the shipped provider records it. It speaks the same wire format as `deepseek-official`, so a deployment already holding that key or fronting its own Anthropic-compatible gateway needs no reconfiguration.

Thinking is not tunable by effort or budget on that endpoint: measured against it, `reasoning_effort` (low/high) and `thinking.budget_tokens` left the thinking length unchanged (a 1024-token budget even produced more thinking than no budget), while `thinking: {type: "disabled"}` removed the reasoning pass entirely (same long-reasoning prompt: 38s → 8s, 9444 → 2204 output tokens). `anthropicThinking` therefore exposes that one switch; on ordinary search queries the latency difference is small, the saving is in thinking tokens.

**`zhipu-*`** modes share the Zhipu open platform base `https://open.bigmodel.cn/api/paas/v4` and the credential chain `ZHIPU_API_KEY` then `ZAI_CODING_CN_API_KEY`. That second name is why the chain exists: a deployment that names its Zhipu credential after the provider it configured (say `ZAI_CODING_CN_API_KEY` from a `zai-coding-cn` model provider) may leave `apiKeyEnv` blank and still be found. `zhipu-chat-search` defaults its model to `glm-5.3-flash` with thinking effort `low` (~3.5s live-verified) — the free-tier `glm-4.7-flash` is frequently rate-limited with HTTP 429 and is not the default. See the [Zhipu web search docs](https://docs.bigmodel.cn/cn/guide/tools/web-search).

## Why

The shipped DSH search provider (`deepseek-official`) calls DeepSeek's own Anthropic-compatible endpoint — it cannot be pointed at other gateways, and switching per deployment is hard. This plugin is a **first-class DSH plugin**: it registers a `ctx.web` search provider and overrides the shared `searchProvider` to it, exactly like the ecosystem's other provider plugins. Search and conversation models stay fully decoupled — use it with any chat LLM.

> **Why the Responses API?** Many OpenAI-compatible gateways only trigger their built-in web search through the Responses API (`/responses`) with an explicit `tools: [{type: "web_search"}]` declaration — Chat Completions search flags are silently ignored there. This plugin speaks the Responses protocol and parses the structured `web_search_call` blocks' `action.sources` into seam-standard citation sources.

> **Why Anthropic Messages?** The shipped `deepseek-official` provider speaks DeepSeek's Anthropic-compatible endpoint but cannot be pointed elsewhere. The `anthropic-messages` mode reproduces that protocol inside this plugin — including the dual `x-api-key` + `Bearer` headers and the snippets joined from `citations[].cited_text` — so an existing `DEEPSEEK_API_KEY` deployment keeps working while the endpoint, model, tool budget, and credential become configurable, and it inherits this plugin's dispatcher-proof response decoding.

## Install

Published on npm:

```bash
dsh plugin --profile web add dsh-web-search-diy
```

The bundle patch then (no manual `cordis.patch.yml` edits needed):

- inserts the `web-search-diy` loader entry
- overrides the shared `web` row's `searchProvider` to `diy-search` and restates `fetchProvider: http` (a patch replaces the whole row config)
- disables the shipped DeepSeek-official search (`web-search-deepseek`)

For local development, install the checkout as a linked package (the same way other local plugins are linked):

```bash
dsh plugin --profile web add link:./dsh-web-search-diy
```

(replace `./dsh-web-search-diy` with the actual path to your local checkout)

> **Note for local linked installs:** the plugin declares its `@deepseek-ai/*` hooks as `peerDependencies` (mirrored in `devDependencies`). A linked package resolves its own `node_modules` first, so run `pnpm install` inside the plugin directory once; the harness install supplies the runtime peers.

## Configuration

The provider resolves options with precedence **UI-managed file (`$DSH_HOME/dsh-web-search-diy.json`, written by the configuration page) > settings section / entry config > package defaults.**

That file is **bucketed by protocol mode**:

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

Every mode keeps its own endpoint, model, credential reference, output budget, and search options, so entering a mode restores that mode's settings — including after a page reload — instead of carrying the previous mode's values over or replacing them with canonical defaults. A mode with no bucket yet starts from that mode's official values. Top-level `mode` is the selected mode, and keys cleared in the page are deleted rather than stored blank, so the file only ever holds real choices; an emptied bucket is dropped entirely. A file written by an earlier release (one flat object) is projected onto the mode it selected when read, and the next save rewrites it in the bucketed shape; reads never write. Keep a copy before a downgrade: an older plugin sees only the top-level `mode` and ignores the buckets.

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
| `searchEngine` | `search_std` | Zhipu engine: `search_std` / `search_pro` / `search_pro_sogou` / `search_pro_quark` (Zhipu modes) |
| `count` | `10` | Zhipu result count (1-50); a request-supplied `maxResults` cap takes precedence (Zhipu modes) |
| `searchRecencyFilter` | `noLimit` | Zhipu recency window: `noLimit` / `oneDay` / `oneWeek` / `oneMonth` / `oneYear` (Zhipu modes) |
| `contentSize` | `medium` | Zhipu snippet size: `medium` / `high` (Zhipu modes) |
| `searchDomainFilter` | — | Zhipu domain allowlist, e.g. `www.example.com` (Zhipu modes) |
| `searchIntent` | `false` | Zhipu intent recognition; off searches directly (`zhipu-web-search` only) |
| `searchPrompt` | — | Zhipu chat search prompt; blank uses the official default (`zhipu-chat-search` only) |
| `reasoningEffort` | `low` | Thinking effort (`reasoning_effort`) for the chat turn: `low` / `high` / `max`; `low` keeps thinking-only models like GLM-5.3-Flash fast (`zhipu-chat-search` only) |
| `responsesReasoningEffort` | — (unset) | OpenAI-standard `reasoning.effort` for the responses turn: `low` / `high`; unset sends no `reasoning` parameter and follows the model's own mode (`responses` only) |

> `apiKeyEnv` / `baseURL` / `model` left empty inherit the current mode's default. Endpoint and key-reference values fossilized into a section by the old schema defaults (the Qwen ones) yield to the current mode's default when you switch modes. A DeepSeek model name fossilized the same way yields only when you switch to a zhipu mode, whose endpoint cannot serve it. A deliberate `1024` output budget from an old schema is likewise treated as a fossil, while a `1024` set through the configuration page still works. Explicitly customized values are always honored.

Every key saved from the card follows one rule: a blank value clears the key so the mode's own default applies again, an omitted key is left untouched, and an invalid value is rejected with a message naming it. `apiKey` is the exception — blank keeps the stored secret.

### Configuration page

The configuration page lives in the sidebar under **Plugins → dsh-web-search-diy → the `web-search-diy` row's Configure** (registered into the `plugins.row.config` slot introduced in dsh 0.1.6-alpha.2; the legacy **Settings → Plugins → Plugin configuration** page was removed in that release). The page matches the official plugin configuration pages: edits stage locally and only **Save** writes, while **Discard** reverts to the stored values. Saving takes effect immediately — no restart. Page copy follows Settings → Language (zh / en). The API key input is write-only: leave it blank to keep the stored key.

The protocol list puts **Anthropic-compatible (Messages API + web_search, used by DeepSeek official)** first, while the stored default remains `responses`. Switching the protocol fills in the new mode's official endpoint, model, and credential reference; a value belonging to the family being left follows the switch, and a value outside every known family (a gateway token, a custom name) is kept as typed. Because entering a mode whose bucket already holds the current values would otherwise look unchanged, the selected protocol counts as a pending change on its own: **the mode switch and any edited parameters are written by the same Save**, and the button is disabled only when the draft matches what the host holds.

Fields appear per mode, mirroring where each value actually applies: `model` and `maxOutputTokens` are hidden in `zhipu-web-search` (no model turn — `count` governs the result size there), `searchIntent` is offered only in `zhipu-web-search`, `searchPrompt` and `reasoningEffort` only in `zhipu-chat-search`, and `apiVersion`, `maxUses`, and `anthropicThinking` only in `anthropic-messages`. A rejected save keeps the page with the error in the footer, where the official pages report save failures.

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

- **responses**: each search is one Responses API call (a full model turn). Results return as deduped `sources[]` (url + optional title from `url_citation` annotations) plus the model's grounded `content`. A response without any `web_search_call` block fails loudly with `WEB_PROVIDER_ERROR` — never a prose-scraping fallback.
- **anthropic-messages**: each search is one Anthropic Messages turn with the native `web_search_20250305` server tool. `web_search_tool_result` blocks become deduped `sources[]` (`url`, optional `title`, `page_age` → `publishedAt`), and `snippet` is joined from the response's `citations[].cited_text`. The provider's own prose is deliberately not returned as `content`, matching the shipped provider. A result block that reports a tool failure (`max_uses_exceeded`, `too_many_requests`, …) surfaces that error code instead of an unprocessable body, and a response with no result block fails loudly with `WEB_PROVIDER_ERROR`.
- **zhipu-web-search**: `search_result[]` maps directly into deduped `sources[]` (url + title), and a digest of up to eight title-plus-snippet entries becomes the `content` overview. An empty result set is a valid outcome and returns empty `sources[]` rather than an error.
- **zhipu-chat-search**: `choices[0].message.content` is the grounded answer (`content`); the tool's `search_result: true` declaration makes the endpoint attach source details, which are parsed defensively from the message-level or root-level `web_search` field into `sources[]`. A grounded answer without source details is still a usable result.
- **Credential handling**: the key is resolved per search, never retained on the provider, and sent as `authorization: Bearer` (the Anthropic mode adds `x-api-key` and `anthropic-version`). A missing key raises `WEB_PROVIDER_CREDENTIAL_MISSING`; a cancelled search raises `WEB_ABORTED`.
- **Response decoding is dispatcher-proof**: bodies are read as bytes and inflated by magic number when compressed, and requests send `accept-encoding: identity`. This survives dsh's cross-version global undici dispatcher (where `response.json()` would parse raw gzip bytes), with hard caps (8 MiB wire, 16 MiB decoded) against decompression bombs.

## Credential

Store the key through the web **Models** page / credentials service (`$DSH_HOME/.credentials.yaml`), or export it in the launching environment. The default reference is per mode: `QWEN_TOKEN_PLAN_CN_API_KEY` in `responses`, `DEEPSEEK_API_KEY` in `anthropic-messages`, and `ZHIPU_API_KEY` (then `ZAI_CODING_CN_API_KEY`) in the Zhipu modes. The provider resolves it per search; no key is retained on the provider, and no key is written to the configuration file.

## License

MIT — see [LICENSE](LICENSE). Copyright (c) 2026 aaronlei.
