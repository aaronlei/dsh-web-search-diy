# dsh-web-search-diy

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

A **web search provider plugin** for the **DeepSeek Harness (DSH)** that backs
the built-in `web_search` tool with the **Qwen Token Plan** OpenAI-compatible
**Responses API** and its native **`web_search`** tool.

- Default model: `deepseek-v4-flash-0731`
- Default endpoint: `https://token-plan.cn-beijing.maas.aliyuncs.com/compatible-mode/v1`
- Default key reference: `QWEN_TOKEN_PLAN_CN_API_KEY`

## Why

The shipped DSH search provider (`deepseek-official`) calls DeepSeek's own
Anthropic-compatible endpoint — it cannot be pointed at Qwen Token Plan (no
Anthropic route there), and it is hard to switch per deployment. This plugin
is a **first-class DSH plugin**: it registers a `ctx.web` search provider and
overrides the shared `searchProvider` to it, exactly like the ecosystem's
other provider plugins. Search and conversation models stay fully
decoupled — use it with any chat LLM.

> **Why Responses API?** Built-in web search on Qwen Token Plan only triggers
> through the Responses API (`/responses`) with an explicit
> `tools: [{type: "web_search"}]` declaration — the Chat Completions
> `enable_search` flag is silently ignored on that gateway. This plugin speaks
> the Responses protocol and parses the structured `web_search_call` blocks'
> `action.sources` into seam-standard citation sources.

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
| `apiKey` | — | Literal API key; overrides `apiKeyEnv` when set |
| `apiKeyEnv` | `QWEN_TOKEN_PLAN_CN_API_KEY` | Credential reference resolved per search via `ctx.credentials` |
| `baseURL` | `https://token-plan.cn-beijing.maas.aliyuncs.com/compatible-mode/v1` | Responses API base; `/responses` is appended |
| `model` | `deepseek-v4-flash-0731` | Model served by the endpoint (any Responses-API model with `web_search` works) |
| `maxOutputTokens` | `1024` | `max_output_tokens` for one search call |

### Example

```yaml
# ~/.dsh/settings.yaml
web-search-diy:
  model: deepseek-v4-flash-0731
```

## How it works

```
you ──> chat LLM
            │ decides it needs live info
            ▼
     web_search tool (model-agnostic)
            │ ctx.web seam ──> diy-search provider
            ▼
     POST {baseURL}/responses
     tools: [{ type: "web_search" }]
            │
            ▼
     Qwen Token Plan deepseek-v4-flash-0731 ──> structured web_search_call sources
            │
            ▼
     chat LLM answers grounded in the results
```

Each search is one Responses API call (a full model turn). Results return as
deduped `sources[]` (url + optional title from `url_citation` annotations)
plus the model's grounded `content`. A response without any `web_search_call`
block fails loudly with `WEB_PROVIDER_ERROR` — never a prose-scraping
fallback.

## Credential

Store the key through the web **Models** page / credentials service under
`QWEN_TOKEN_PLAN_CN_API_KEY`, or export it in the launching environment. The
provider resolves it per search; no key is retained on the provider.

## License

[MIT](LICENSE)