# dsh-web-search-diy

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

A **web search provider plugin** for the **DeepSeek Harness (DSH)** that backs
the built-in `web_search` tool with multiple search backends, returning
**structured citation sources**. A single `mode` switch selects the protocol:

| `mode` | Protocol | Backend |
|---|---|---|
| `responses` (default) | OpenAI-compatible **Responses API** + `web_search` tool | Qwen Token Plan (default example), OpenAI, any compatible gateway |
| `zhipu-web-search` | Zhipu **Web Search API** (basic retrieval, `POST /web_search`) | Zhipu open platform; raw structured results, no model turn |
| `zhipu-chat-search` | Zhipu **Web Search in Chat** (answer augmentation, `/chat/completions` + `web_search` tool) | Zhipu open platform; retrieval fused into a grounded answer |

In `responses` mode, endpoint, model, and key reference are yours to swap —
the only requirement is a model that actually exposes the `web_search` tool on
its gateway.

- Default model: `deepseek-v4-flash-0731`
- Default endpoint: `https://token-plan.cn-beijing.maas.aliyuncs.com/compatible-mode/v1`
- Default key reference: `QWEN_TOKEN_PLAN_CN_API_KEY`

In `zhipu-*` modes: default endpoint `https://open.bigmodel.cn/api/paas/v4`,
default key reference `ZHIPU_API_KEY`, and `zhipu-chat-search` defaults its
model to `glm-4-flash`. See the
[Zhipu web search docs](https://docs.bigmodel.cn/cn/guide/tools/web-search).

## Why

The shipped DSH search provider (`deepseek-official`) calls DeepSeek's own
Anthropic-compatible endpoint — it cannot be pointed at other gateways, and
switching per deployment is hard. This plugin is a **first-class DSH plugin**:
it registers a `ctx.web` search provider and overrides the shared
`searchProvider` to it, exactly like the ecosystem's other provider plugins.
Search and conversation models stay fully decoupled — use it with any chat LLM.

> **Why Responses API?** Many OpenAI-compatible gateways only trigger their
> built-in web search through the Responses API (`/responses`) with an
> explicit `tools: [{type: "web_search"}]` declaration — Chat Completions
> search flags are silently ignored there. This plugin speaks the Responses
> protocol and parses the structured `web_search_call` blocks' `action.sources`
> into seam-standard citation sources.

## Install

Published on npm:

```bash
dsh plugin --profile web add dsh-web-search-diy
```

The bundle patch then (no manual `cordis.patch.yml` edits needed):
- inserts the `web-search-diy` loader entry
- overrides the shared `web` row's `searchProvider` to `diy-search` and
  restates `fetchProvider: http` (a patch replaces the whole row config)
- disables the shipped DeepSeek-official search (`web-search-deepseek`)

For local development, install the checkout as a linked package (the same way
other local plugins are linked):

```bash
dsh plugin --profile web add link:./dsh-web-search-diy
```

(replace `./dsh-web-search-diy` with the actual path to your local checkout)

> **Note for local linked installs:** the plugin declares its `@deepseek-ai/*`
> hooks as `peerDependencies` (mirrored in `devDependencies`). A linked package
> resolves its own `node_modules` first, so run `pnpm install` inside the
> plugin directory once; the harness install supplies the runtime peers.

## Configuration

The provider resolves options with precedence: **UI-managed file
(`$DSH_HOME/dsh-web-search-diy.json`, written by the Settings card) >
settings section / entry config > package defaults.**

| Key | Default | Meaning |
|---|---|---|
| `mode` | `responses` | Protocol mode: `responses` / `zhipu-web-search` / `zhipu-chat-search` |
| `apiKey` | — | Literal API key; overrides `apiKeyEnv` when set |
| `apiKeyEnv` | per mode (see above) | Credential reference resolved per search via `ctx.credentials` |
| `baseURL` | per mode (see above) | API base; `/responses`, `/web_search`, or `/chat/completions` is appended per mode |
| `model` | per mode (see above) | Model served by the endpoint; `zhipu-web-search` has no model turn and ignores this key |
| `maxOutputTokens` | `1024` | Output cap for one search turn (`max_output_tokens` in `responses`, `max_tokens` in `zhipu-chat-search`) |
| `searchEngine` | `search_std` | Zhipu engine: `search_std` / `search_pro` / `search_pro_sogou` / `search_pro_quark` (Zhipu modes only) |
| `count` | `10` | Zhipu result count (1-50); a request-supplied `maxResults` cap takes precedence (Zhipu modes only) |
| `searchRecencyFilter` | `noLimit` | Zhipu recency window: `noLimit` / `oneDay` / `oneWeek` / `oneMonth` / `oneYear` (Zhipu modes only) |
| `contentSize` | `medium` | Zhipu snippet size: `medium` / `high` (Zhipu modes only) |
| `searchDomainFilter` | — | Zhipu domain allowlist, e.g. `www.example.com` (Zhipu modes only) |
| `searchIntent` | `false` | Zhipu intent recognition; off searches directly (Zhipu `zhipu-web-search` only) |
| `searchPrompt` | — | Zhipu chat search prompt; blank uses the official default (`zhipu-chat-search` only) |

> `apiKeyEnv` / `baseURL` / `model` left empty inherit the current mode's
> default. Values fossilized into a section by the old schema defaults (the
> Qwen endpoint/model/reference) yield to the zhipu defaults when you switch
> to a zhipu mode; explicitly customized values are always honored.

### Settings card

The configuration card lives under **Settings → Plugins → Plugin
configuration → Custom web search**, in the same form as the shipped Shell /
Agent loop cards: edits stage locally (an "unsaved" badge appears in the
header) and only **Save** writes, while **Discard** reverts to the stored
values. Saving takes effect immediately — no restart. Card copy follows
Settings → Language (zh / en). The API key input is write-only: leave it
blank to keep the stored key.

## How it works

```
you ──> chat LLM
            │ decides it needs live info
            ▼
     web_search tool (model-agnostic)
            │ ctx.web seam ──> diy-search provider
            ▼
     ├─ responses:        POST {baseURL}/responses   tools: [{ type: "web_search" }]
     ├─ zhipu-web-search: POST {baseURL}/web_search  (raw retrieval, no model turn)
     └─ zhipu-chat-search:POST {baseURL}/chat/completions  tools: [{ type: "web_search", web_search: {...} }]
            │
            ▼
     chat LLM answers grounded in the results
```

- **responses**: each search is one Responses API call (a full model turn).
  Results return as deduped `sources[]` (url + optional title from
  `url_citation` annotations) plus the model's grounded `content`. A response
  without any `web_search_call` block fails loudly with `WEB_PROVIDER_ERROR`
  — never a prose-scraping fallback.
- **zhipu-web-search**: `search_result[]` maps directly into deduped
  `sources[]` (url + title), and a digest of the top title-plus-snippet
  entries becomes the `content` overview. An empty result set is a valid
  outcome and returns empty `sources[]` rather than an error.
- **zhipu-chat-search**: `choices[0].message.content` is the grounded answer
  (`content`); the tool's `search_result: true` declaration makes the endpoint
  attach source details, which are parsed defensively from the message-level
  or root-level `web_search` field into `sources[]`. A grounded answer without
  source details is still a usable result.

## Credential

Store the key through the web **Models** page / credentials service (the
default reference is per mode: `QWEN_TOKEN_PLAN_CN_API_KEY` in `responses`
mode, `ZHIPU_API_KEY` in the zhipu modes), or export it in the launching
environment. The provider resolves it per search; no key is retained on the
provider.

## License

MIT — see [LICENSE](LICENSE). Copyright (c) 2026 aaronlei.