# dsh-web-search-diy

**English** · [简体中文](README.zh.md)

<p align="center">
  <a href="https://www.npmjs.com/package/dsh-web-search-diy"><img alt="npm version" src="https://img.shields.io/npm/v/dsh-web-search-diy?style=flat-square&amp;label=npm&amp;color=cb3837"></a>
  <a href="LICENSE"><img alt="license: MIT" src="https://img.shields.io/npm/l/dsh-web-search-diy?style=flat-square&amp;color=blue"></a>
  <a href="package.json"><img alt="node &gt;= 18" src="https://img.shields.io/badge/node-%3E%3D18-339933?style=flat-square&amp;logo=nodedotjs&amp;logoColor=white"></a>
  <a href="#capability-matrix"><img alt="vendors: 7" src="https://img.shields.io/badge/vendors-7-8A2BE2?style=flat-square"></a>
  <a href="#capability-matrix"><img alt="protocols: 4" src="https://img.shields.io/badge/protocols-4-8A2BE2?style=flat-square"></a>
  <a href="https://github.com/deepseek-ai/deepseek-harness"><img alt="dsh plugin" src="https://img.shields.io/badge/dsh-plugin-4D6BFE?style=flat-square"></a>
</p>

> A **web search provider plugin** for the **DeepSeek Harness (DSH)**. It supplies the built-in `web_search` tool per **vendor × protocol**: three in-protocol shapes (Chat Completions / Responses / Anthropic Messages) plus standalone search, covering DeepSeek, Kimi, Zhipu, Qwen, OpenAI, Anthropic, OpenRouter, and four custom targets. Results are normalized into **structured citation sources** for the calling model to ground its answer on.

## Capabilities

- 🧭 **Vendor × protocol matrix** — 17 official targets (13 full + 4 degraded) and 4 custom targets. Only combinations that really search appear in the vendor list; the rest live in a collapsed section with a reason.
- 🎛️ **Three-layer configuration page** — search kind → protocol → vendor. Fields come from the catalog served by the host; a blank value means the combination's default.
- 🧩 **Custom targets** — a template picker performs a one-shot fill (selection resets, nothing is saved); endpoint, path, request field names, and response field names are all editable.
- 🧪 **Test connection** — runs one real search with the staged draft (nothing persisted) and grades the result by source quality.
- 🔐 **Write-only credentials** — API keys are stored through the credentials service, never in the configuration file; each vendor offers its reference chain.
- 🗂️ **Configuration v3** — one bucket per `vendor/protocol`; v1/v2 files migrate on read and the old file is backed up as `.v2.bak` before the first save.
- 🪜 **Thinking-effort fallback** — a rejected `reasoning.effort` / `output_config` / `thinking` is dropped one at a time and retried.
- 📦 **Dispatcher-proof decoding** — bodies are read as bytes and inflated by magic number, independent of dsh's global undici dispatcher.

## Capability matrix

Legend: ✅ full (in-protocol search + citable sources); ◐ degraded (searches, but sources or model are limited); ✗ unsupported; ⚙ custom.

| Vendor | Chat Completions | Responses | Anthropic Messages | Standalone search |
|---|---|---|---|---|
| DeepSeek | ✗ | ◐ `deepseek-v4-pro` only; sources from `open_page` | ✅ | ✅ `/v1/tools/search` |
| Kimi | ✗ built-in `$web_search` retired | ✅ `web_search` + `include` | ✗ no server tool in the schema | ✅ `/v1/tools/search` |
| Zhipu | ✅ `web_search` tool | ✅ `web_search` + `results[]` | ✗ accepts but does not run it | ✅ `/paas/v4/web_search` |
| Qwen | ◐ `enable_search`, no sources | ✅ `action.sources` (url only) | ✅ needs the billing header | ✗ no standalone REST |
| OpenAI | ◐ `gpt-5-search-api` only | ✅ full `filters` / `include` | ✗ no such endpoint | ✗ |
| Anthropic | ✗ | ✗ | ✅ native `web_search` | ✗ |
| OpenRouter | ✅ `openrouter:web_search` | ✅ same server tool | ◐ alias, untested | ✗ |
| Custom | ⚙ template + 4 variants | ⚙ template + `toolType` | ⚙ template + `toolType` | ⚙ template + 8 mapping fields |

> 13 full, 4 degraded (OpenRouter Anthropic is pending), 4 custom. Eight `unsupported` entries exist only for the collapsed section and never create a configuration bucket.

## Install

Published on npm:

```bash
dsh plugin --profile web add dsh-web-search-diy
```

The bundle patch performs the wiring, so no manual `cordis.patch.yml` edits are required:

- inserts the `web-search-diy` loader entry;
- overrides the shared `web` row's `searchProvider` to `diy-search` and restates `fetchProvider: http` (a patch replaces the whole row config);
- disables the shipped `web-search-deepseek` provider.

For local development, install the checkout as a link:

```bash
dsh plugin --profile web add link:./dsh-web-search-diy
```

> The plugin declares the `@deepseek-ai/*` hooks as `peerDependencies`. Run `pnpm install` once in the plugin directory before linking; the harness provides the peers at runtime.

## Configuration

### Configuration page

Location: **Plugins → Installed plugins → the dsh-web-search-diy card** (clicking the card opens this plugin's configuration page). Copy follows Settings → Language (zh / en).

- **Search kind**: `In-protocol search` or `Standalone search`. Standalone has no model turn, so model and output-budget fields are hidden.
- **Protocol**: one of Chat Completions / Responses / Anthropic Messages in-protocol; standalone is fixed to `search`.
- **Vendor**: only vendors available under that protocol; degraded combinations show their reason on the card; unsupported ones are collapsed for the current shape.
- **Fields**: blank means the catalog default (shown as the placeholder). Saving a blank deletes the key.
- **Endpoint override (Anthropic protocol)**: the launching environment variable `DEEPSEEK_SEARCH_BASE_URL` overrides the endpoint; an explicitly saved **Endpoint** wins over it.
- **Template (custom only)**: a one-shot picker. The selection resets immediately, the placeholder names the last template, and the template itself is never saved. If the target already has a saved configuration, switching templates first asks for confirmation and offers **Reset to saved configuration**.
- **Save**: switching vendor/protocol counts as a pending change; saving takes effect immediately (the host re-reads the file on every search).
- **API key**: written through the credentials service only; blank keeps the current key.

### Configuration file (v3)

`$DSH_HOME/dsh-web-search-diy.json`, written by the configuration page:

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

- The top level stores only the current `vendor` and `protocol`; each target bucket stores only the keys declared in its `fields`.
- A blank value deletes the key and restores the catalog default.
- `template` is a fill action, not configuration; submitting it is rejected.
- API keys never appear in this file.

### Migrating from 1.x

| v2 `mode` | v3 target |
|---|---|
| `responses` | `qwen/responses` |
| `anthropic-messages` | `deepseek/anthropic-messages` |
| `zhipu-web-search` | `zhipu/search` |
| `zhipu-chat-search` | `zhipu/chat-completions` |

- A v1 flat object is first projected onto its mode, then migrated by the table above.
- Migration happens in memory on read; the first save writes v3 and backs the original up as `dsh-web-search-diy.json.v2.bak` (once, for rollback).
- Old key names: `responsesToolType` → `toolType`, `responsesIncludeSources` → `includeSources`, `responsesReasoningEffort` → `reasoningEffort`, `anthropicThinking` → `thinking`, `anthropicEffort` → `effort`; `apiVersion` is dropped (fixed at `2023-06-01`).
- 2.0 registers no settings section; configuration comes from the file and the credential surface only.

### Field reference

| Protocol / vendor | Fields |
|---|---|
| Common | `baseURL`, `apiKeyEnv`, `model`, `maxOutputTokens` (the last two are hidden for standalone) |
| Responses · OpenAI | `toolType`, `includeSources`, `reasoningEffort`, `searchContextSize`, `allowedDomains`, `blockedDomains`, `userLocation`, `externalWebAccess`, `returnTokenBudget`, `searchContentTypes`, `imageMaxResults`, `imageCaption` |
| Responses · Kimi | `toolType`, `includeSources`, `allowedDomains` (`blockedDomains` / `search_context_size` return 400) |
| Responses · Zhipu / Qwen | `toolType`, `includeSources`, `reasoningEffort` |
| Responses · DeepSeek | `toolType`; the model is locked to `deepseek-v4-pro` and `include` is not sent |
| Responses · OpenRouter | `toolType`, `includeSources`, `engine`, `mode`, `maxResults`, `maxUses`, `maxTotalResults`, `searchContextSize`, `maxCharacters`, `userLocation`, `allowedDomains`, `excludedDomains`, `xSearch` |
| Anthropic Messages | `toolType`, `maxUses`, `thinking`, `effort`, `allowedDomains`, `blockedDomains`, `userLocation`, `responseInclusion` |
| Chat · Zhipu | `searchEngine`, `count`, `searchRecencyFilter`, `contentSize`, `searchDomainFilter`, `searchIntent`, `requireSearch`, `searchPrompt`, `reasoningEffort` |
| Chat · Qwen | `searchStrategy`, `forcedSearch`, `freshness`, `assignedSiteList`, `searchExtension`, `promptIntervene` |
| Chat · OpenRouter | `engine`, `mode`, `maxResults`, `maxUses`, `maxTotalResults`, `searchContextSize`, `maxCharacters`, `userLocation`, `allowedDomains`, `excludedDomains`, `xSearch` |
| Chat · OpenAI | no search parameters; the model is locked to `gpt-5-search-api` |
| Standalone | `count`, `includeContent`, `searchEngine` / `contentSize` / `searchIntent` / `searchRecencyFilter` / `searchDomainFilter` (Zhipu), `oriQuestion` / `localization` (DeepSeek), `timeoutSeconds` (Kimi), `digestEntries`, `digestSnippetChars`; custom adds `path` and the 8 mapping fields |

> `oriQuestion` sends the human prompt that triggered the search as DeepSeek's `ori_question`: whitespace collapsed, cut to 128 characters, read from the initiating Session and omitted outside one. It shares the source used by the official `web-deepseek-api` provider (`sendOriginalQuestion`).

> Result count and digest size are independent: `count` / `limit` drive the request and the number of `sources` (1–50 for Zhipu/DeepSeek, 1–20 for Kimi); `digestEntries` (default 8) and `digestSnippetChars` (default 200) only shape the `content` digest returned to the caller and never trim `sources`.

### Custom targets

- **Templates**: in-protocol targets list the vendors available under that protocol; standalone lists DeepSeek / Kimi / Zhipu. Picking a template performs a one-shot fill of endpoint, credential, model, and search parameters; everything remains editable.
- **Chat variants**: decided by the template (Zhipu answer augmentation / Qwen web search / OpenRouter server tool / OpenAI search model), not exposed as a separate field; fields are filtered per variant.
- **Standalone mapping**: `queryField`, `countField`, `resultsPath`, `urlField`, `titleField`, `snippetField`, `dateField`, `contentField` are authoritative; the template only fills them and acts as a blank fallback. Simple dot paths (`data.items`) are supported; full JSONPath is not.
- **Search engine**: free input with common candidates (Zhipu / OpenRouter / self-hosted). On the Zhipu template a blank falls back to `search_std` (the API requires it).
- **Required**: Chat needs a variant (the template fills it); Responses / Anthropic need `toolType`; standalone needs `path`.

## Target reference (default endpoint / model / credential)

| target | Support | Default endpoint | Default model | Credential reference |
|---|---|---|---|---|
| `deepseek/anthropic-messages` | ✅ | `https://api.deepseek.com/anthropic` | `deepseek-flash` | `DEEPSEEK_API_KEY` |
| `deepseek/responses` | ◐ | `https://api.deepseek.com` | `deepseek-v4-pro` | `DEEPSEEK_API_KEY` |
| `deepseek/search` | ✅ | `https://api.deepseek.com` | — | `DEEPSEEK_API_KEY` |
| `kimi/responses` | ✅ | `https://api.moonshot.cn/v1` | `kimi-k2.6` | `MOONSHOT_API_KEY` → `KIMI_API_KEY` |
| `kimi/search` | ✅ | `https://api.moonshot.cn` | — | same |
| `zhipu/chat-completions` | ✅ | `https://open.bigmodel.cn/api/paas/v4` | `glm-5.3-flash` | `ZAI_CODING_CN_API_KEY` → `ZHIPU_API_KEY` |
| `zhipu/responses` | ✅ | `https://open.bigmodel.cn/api/v1` | `glm-5.3` | same |
| `zhipu/search` | ✅ | `https://open.bigmodel.cn/api/paas/v4` | — | same |
| `qwen/chat-completions` | ◐ | `https://maas.qianwenaiapi.com/compatible-mode/v1` | `qwen3.8-flash` | `QWEN_TOKEN_PLAN_API_KEY` → `QWEN_TOKEN_PLAN_CN_API_KEY` → `DASHSCOPE_API_KEY` |
| `qwen/responses` | ✅ | same | `qwen3.8-flash` | same |
| `qwen/anthropic-messages` | ✅ | `https://maas.qianwenaiapi.com/apps/anthropic` | `qwen3.8-max` | same |
| `openai/chat-completions` | ◐ | `https://api.openai.com/v1` | `gpt-5-search-api` | `OPENAI_API_KEY` |
| `openai/responses` | ✅ | `https://api.openai.com/v1` | `gpt-5.5` | `OPENAI_API_KEY` |
| `anthropic/anthropic-messages` | ✅ | `https://api.anthropic.com` | `claude-opus-5-5` | `ANTHROPIC_API_KEY` |
| `openrouter/chat-completions` | ✅ | `https://openrouter.ai/api/v1` | user-supplied | `OPENROUTER_API_KEY` |
| `openrouter/responses` | ✅ | `https://openrouter.ai/api/v1` | user-supplied | `OPENROUTER_API_KEY` |
| `openrouter/anthropic-messages` | ◐ | `https://openrouter.ai/api` | user-supplied | `OPENROUTER_API_KEY` |
| `custom/chat-completions` | ⚙ | template prefill | template / user | user |
| `custom/responses` | ⚙ | template prefill | template / user | user |
| `custom/anthropic-messages` | ⚙ | template prefill | template / user | user |
| `custom/search` | ⚙ | template prefill | — | user |

> Default models are current examples, not a long-term promise; an explicit user value always wins.

## Test connection

The page's **Test connection** button runs one real search with the **staged draft**, without persisting anything:

- query fixed to `OpenAI`, `maxResults = 3`, timeout 60 s;
- in-protocol: Responses / Anthropic send `Perform a web search for the query: OpenAI`; Chat sends `OpenAI` directly;
- standalone: sends `search_query` / `query` / `text_query` plus the matching count;
- response: `{ ok, sourceCount, sourceQuality, degraded, latencyMs, contentPreview?, error? }`;
- the save-side required-field checks (for example, a standalone custom target must declare `path`) run first, so a missing value returns 400 without sending a request;
- with zero sources the message is graded by the combination's expected source quality: by design / may not have run / check the tool name and endpoint.

## How it works

```
you ──> chat LLM ──> web_search tool (model-independent)
                        │ ctx.web seam ──> diy-search provider
                        ▼
   ├─ Responses:          POST {baseURL}/responses   tools: [{ type, ... }]
   ├─ Anthropic Messages: POST {baseURL}/messages    tools: [{ type: web_search_*, max_uses }]
   ├─ Chat Completions:   POST {baseURL}/chat/completions  (four variants)
   └─ Standalone:         POST {baseURL}{path}       (no model turn)
                        │
                        ▼
                  chat LLM answers from the sources
```

- **Responses**: `action.sources[]`, `open_page` / `find_in_page` `action.url`, `results[]` metadata, and `url_citation` annotations all normalize into deduplicated sources; the answer prefers `phase: "final_answer"`. A reply with no search evidence fails explicitly, and a 404 points out the missing `/responses` path.
- **Anthropic Messages**: `web_search_tool_result` → `sources[]`, `citations[].cited_text` → `snippet`, `page_age` → ISO date; `allowed_domains` and `blocked_domains` are mutually exclusive (allowed wins); tool types other than `20250305` also send `allowed_callers: ["direct"]`.
- **Chat Completions**: Zhipu `web_search` tool, Qwen `enable_search`, OpenRouter server tool, OpenAI search model; sources come from `message.web_search[]` or `annotations[]`.
- **Standalone**: structured results become `sources[]` directly and the first few snippets form `content`; there is no model turn.
- **Effort fallback**: drop one knob at a time in the order `reasoning.effort` → `output_config` → `thinking` → `reasoning_effort` and retry.
- **Decoding**: read as bytes and inflate by gzip/zlib magic, capped at 8 MiB on the wire and 16 MiB decoded.

## Live verification

Real credentials, 2026-10-17 / 2026-10-18:

| target | Sources | Notes |
|---|---|---|
| `qwen/responses` | 6 | sources carry url only |
| `qwen/anthropic-messages` | 9 | billing header attached automatically |
| `deepseek/anthropic-messages` | 10 | — |
| `deepseek/search` | 3 | blank `localization` is not sent |
| `zhipu/chat-completions` | 8 | — |
| `zhipu/responses` | 5 | `sources` + `results` merged |
| `zhipu/search` | 1 | digest cap applied |
| `kimi/responses` | 6 | `kimi-k2.6` |
| `kimi/search` | 3 | `maxResults=30` clamped to `limit=20` |
| `custom/search` | 1 | custom mapping and digest cap applied |
| `qwen/chat-completions` | 0 | degraded as expected (no sources) |
| `deepseek/responses` | 0 | degraded as expected (`open_page` only) |
| `custom/chat` / `responses` / `anthropic` | 8 / 5 / 10 | verified on 2026-10-17 |

OpenAI, Anthropic, and OpenRouter are not verified yet; results for these endpoints are welcome under Feedback.

## Known limitations

- **Kimi Chat is not wired in**: the in-protocol `$web_search` retires on 2026-10-20, and the `api.kimi.com/coding` endpoint is not wired either. Kimi keeps Responses and standalone search (`/v1/tools/search`; the Pro endpoint can be reached by overriding `path` on a custom target).
- **Zhipu's Anthropic surface accepts but never runs the tool** (`web_search_requests: 0`), so it is marked unsupported.
- **DeepSeek Responses only works with `deepseek-v4-pro`** and returns no `action.sources`; sources come from `open_page` only.
- **Qwen Chat returns no sources**; Qwen is wired to the Qwen AI Platform only (`maas.qianwenaiapi.com`), not Alibaba Cloud Model Studio.
- **OpenAI Chat only works with `gpt-5-search-api`**; ordinary models ignore the tool.
- **OpenRouter Anthropic** accepts the `web_search_20250305` alias per its docs, but it is not verified yet.
- **Kimi Responses** rejects `search_context_size` / `blocked_domains` (400).
- **Standalone search has no model turn**; its output cap is `digestEntries` / `digestSnippetChars`, not a model token budget.
- **Test connection uses a fixed query** (`OpenAI`) and only proves connectivity, not search quality.

## Feedback

If you hit an unsupported vendor or gateway, a protocol difference, or a field-mapping problem, open an [issue](https://github.com/aaronlei/dsh-web-search-diy/issues) with the endpoint type, request shape, and error message. PRs with new live-verification results are welcome.

## Credentials

Store keys in the Web **Models** page / credentials service (`$DSH_HOME/.credentials.yaml`) or export them in the launching environment. The plugin resolves them per search, never retains them on the provider, and never writes them to the configuration file.

Default chains per vendor: DeepSeek `DEEPSEEK_API_KEY`; Kimi `MOONSHOT_API_KEY` → `KIMI_API_KEY` → `KIMI_CODING_API_KEY`; Zhipu `ZAI_CODING_CN_API_KEY` → `ZHIPU_API_KEY`; Qwen `QWEN_TOKEN_PLAN_API_KEY` → `QWEN_TOKEN_PLAN_CN_API_KEY` → `DASHSCOPE_API_KEY`; one each for OpenAI / Anthropic / OpenRouter. Custom targets use a user-supplied reference.

A reference name must be a valid environment-variable name (letter/underscore start, then letters, digits, underscores). Saving rejects anything else, and an invalid reference left in a hand-edited file is skipped in favor of the next candidate.

## Development

Host and Client both live in `src/`; built artifacts are committed:

```
src/
  index.ts        # apply: registers the provider and the config/test endpoints
  catalog.ts      # capability matrix, defaults, fields, templates
  config.ts       # v3 read/write, v1/v2 migration, field validation
  endpoint.ts     # GET/POST /api/web-search-diy/config and /test
  options.ts      # catalog defaults + file overrides
  provider.ts     # available / dispatch by protocol
  transport.ts    # fetch, decoding, reasoning fallback
  protocols/      # responses / anthropic / chat / search
  mappers/        # source normalization
  client/         # browser half, bundled into one lib/client.js
    index.tsx     # apply: card registration, stylesheet and dictionaries
    page.tsx      # config page: shape → protocol → vendor, field form, test/save
    fields.tsx    # field controls
    field-meta.ts # enum/boolean/numeric sets, chat variants, advanced section
    draft.ts      # draft normalization, template fill, number coercion
    labels.ts     # protocol/vendor/support copy
    styles.ts     # card stylesheet
    locale.ts     # zh/en dictionaries
    consts.ts     # loader id and endpoints
    types.ts      # draft and field-prop types
```

```bash
pnpm install
pnpm run build       # Host ESM + Client CJS
pnpm run typecheck
pnpm test            # host tests (92)
pnpm run test:client # rebuild and verify the client contract
```

`lib/index.js` and `lib/client.js` are committed; source maps are not.

## License

MIT — see [LICENSE](LICENSE). Copyright (c) 2026 aaronlei.

[![](https://img.shields.io/badge/powered_by-dsh-4D6BFE?style=flat-square&logo=deepseek&logoColor=white)](https://github.com/deepseek-ai/deepseek-harness)
