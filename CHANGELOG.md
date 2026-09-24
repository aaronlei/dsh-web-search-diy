# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).
## [1.0.0] - 2026-09-23

### Added

- **`anthropic-messages` mode** — a fourth protocol speaking an
  Anthropic-compatible Messages API (`POST {baseURL}/messages`) with the native
  `web_search_20250305` server tool. It mirrors the shipped `deepseek-official`
  provider's wire format — dual `x-api-key` + `Bearer` headers, `max_uses`, and
  the `anthropic-version` header — so a deployment already holding
  `DEEPSEEK_API_KEY`, or fronting its own Anthropic-compatible gateway, works
  unchanged. Responses map `web_search_tool_result` blocks into deduped
  `sources[]` (`page_age` → `publishedAt`) with snippets joined from the
  response's `citations[].cited_text`, and deliberately return no `content` —
  the provider's own prose is not trusted as an answer. A result block that
  reports a tool failure (`max_uses_exceeded`, `too_many_requests`, …) surfaces
  that error code instead of a generic unprocessable-body error; a response with
  no result block still fails loudly with `WEB_PROVIDER_ERROR`. Defaults:
  endpoint `https://api.deepseek.com/anthropic/v1`, key reference
  `DEEPSEEK_API_KEY`, model `deepseek-flash` (the endpoint's rolling latest
  Flash).
- **`apiVersion`, `maxUses`, and `anthropicThinking` settings** — the
  `anthropic-version` header (default `2023-06-01`), the per-request
  `web_search` server-tool budget (default 5), and the thinking switch:
  `default` sends no parameter, `disabled` sends `thinking: {type: "disabled"}`.
  Measured against the shipped endpoint, `reasoning_effort` (low/high) and
  `thinking.budget_tokens` leave the thinking length unchanged — a 1024-token
  budget produced more thinking than no budget at all — while the switch removes
  the reasoning pass (same prompt: 38s → 8s, 9444 → 2204 output tokens).
- **Output budgets follow the documented defaults** — the `anthropic-messages`
  turn defaults to 65536 output tokens, DeepSeek's documented `max_tokens`
  default for thinking mode (8K with thinking off, 128K at
  `reasoning_effort: max`, ceiling 384K); the other modes default to 4096,
  matching the shipped DeepSeek search provider instead of the tight historical
  1024 that could truncate a turn. A user-set budget is never rewritten.
- **Anthropic endpoint and session overrides** — a blank endpoint falls back to
  `$DEEPSEEK_SEARCH_BASE_URL` before the built-in default, exactly like the
  shipped provider, and every Anthropic request is recorded on the calling
  session as `web/deepseek-search-llm-request`.
- **Zhipu credential chain** — with `apiKeyEnv` left unset, the Zhipu modes try
  `ZAI_CODING_CN_API_KEY` first — the name DeepSeek's credential plane uses for
  the key behind a `zai-coding-cn` model provider — and then the historical
  `ZHIPU_API_KEY` this plugin used to default to, through the credentials
  service and then the launching environment. An explicitly configured
  reference is used alone, the missing-credential error names every candidate,
  and the configuration page reports "a key is configured" when any candidate
  resolves.

### Changed

- **Configuration is stored per protocol mode** —
  `$DSH_HOME/dsh-web-search-diy.json` now holds one bucket per mode
  (`{ version: 2, mode, modes: { <mode>: { … } } }`) instead of a single flat
  object. Every mode keeps its own endpoint, model, credential reference, output
  budget, and search options, so entering a mode restores that mode's settings —
  across a page reload too — instead of carrying the previous mode's values over
  or replacing them with canonical defaults. A mode with no bucket yet starts
  from that mode's official values, and buckets are per mode rather than per
  family, so the two Zhipu modes no longer share one set of values. A file
  written by an earlier release (one flat object) is projected onto the mode it
  selected when read, and the next save rewrites it in the bucketed shape; reads
  never write. Each bucket also holds only the keys that mode actually uses: the
  page submits its whole form, so a field belonging to another mode is never
  written, and a leftover of one is dropped on that mode's next save — which
  keeps the bucket from pinning today's prefilled defaults forever.
  Downgrading after a save leaves the older plugin seeing only the top-level
  `mode`, so keep a copy of the file if you need to roll back.
- **Mode-scoped defaults became table-driven** — endpoint, credential reference,
  and model defaults come from a single `MODE_PROFILES` table instead of
  `mode !== "responses"` booleans, so a new protocol touches one place rather
  than every precedence branch. The schema-default "fossil" rule still applies
  to the endpoint and key reference in every mode; a fossilized DeepSeek model
  name yields only when switching to a zhipu mode, whose endpoint cannot serve
  it. The configuration page derives the Zhipu-only fields from the mode family
  rather than from "not responses".

### Fixed

- **A protocol switch is itself a pending change** — the save control compared
  field values only, so entering a mode that already had a bucket left the form
  "clean" and the mode selection could not be saved at all. The selected mode now
  counts in the dirty check.
- **Blank values now mean the same thing on every key** — a blank numeric field
  (`maxUses`, `count`, `maxOutputTokens`) used to fail validation, because
  `body.x !== undefined` accepted `""` and `Number("") === 0`, so the card
  refused to save while a blank string or enum field silently kept the stored
  value. "Leave blank for the default" was therefore true for some fields and
  false for others, and a stored value could not be reset at all. The POST body
  is now projected by one pure `buildConfigPatch`: blank clears the key (the mode
  default applies again), an omitted key is untouched, and an invalid value is an
  error naming the key. `apiKey` still means "keep the stored secret".

## [0.2.2] - 2026-09-22

### Fixed

- **Searches no longer fail on compressed responses** — dsh's
  `@deepseek-ai/dsh-http-proxy` installs the process's global undici
  dispatcher from its own bundled undici 8.x, while the provider's plain
  `fetch()` is Node's built-in undici resolving that same dispatcher. Across
  that version boundary the built-in fetch hands back the still-compressed
  stream and `content-encoding` is not even readable, which made
  `response.json()` parse raw gzip bytes and every search fail as
  "web search returned an unprocessable response body: SyntaxError:
  Unexpected token '\u001f' ...". Bodies are now read as bytes and inflated
  by magic number (gzip `1f 8b`, zlib `0x78` + the RFC 1950 checksum)
  without trusting the header, and requests ask for `accept-encoding:
  identity` up front so gateways skip compression altogether. Compressed
  HTTP error bodies are decoded too, so the API's real error message
  surfaces instead of a bare HTTP status.

### Security

- **Decompression-bomb caps** — the response body is streamed with a hard
  wire cap (8 MiB): crossing it cancels the download instead of buffering
  the rest, and inflation runs with zlib's `maxOutputLength` (16 MiB) so a
  tiny compressed body cannot expand without bound while blocking the event
  loop. The gzip header's declared ISIZE is never trusted
  (attacker-controlled). Over-limit bodies fail fast as the usual
  `unprocessable response body` error.

### Added

- **`npm test`** — a `node:test` regression suite (11 cases) that stubs
  global fetch with the broken cross-dispatcher response shape (compressed
  bytes, no readable encoding header) plus the healthy shapes: gzip /
  deflate / plain decoding in all three modes, the `accept-encoding:
  identity` request header, compressed error bodies, and both bomb caps.

## [0.2.1] - 2026-09-18

### Changed

- **Configuration UI re-homed to the new Plugins page** — dsh
  0.1.6-alpha.2 removed the legacy `settings.plugin.item` slot (the old
  Settings → Plugins → Plugin configuration page) and moved plugin
  configuration to the new sidebar Plugins page. The client half now registers
  its form into `plugins.row.config` under the key
  `dsh-web-search-diy#web-search-diy`: the `web-search-diy` row on the
  bundle's page gains a Configure control opening the full-page form, which
  serves `view: 'summary'` (one-liner) and `view: 'page'` (staged form with
  discard/save) per the new owner-props contract. Save still rides the
  plugin's own `/api/web-search-diy/config` endpoint; the host half, the
  locale dictionaries, and the save semantics are unchanged. The collapsed
  card face, chevron, and unsaved badge are gone — the page draws the title,
  icon, and crumb.

## [0.2.0] - 2026-09-06

### Added

- **Zhipu BigModel support via a `mode` switch** — the provider now speaks
  three protocols: the historical `responses` (OpenAI-compatible Responses
  API, default and unchanged), `zhipu-web-search` (Zhipu's Web Search API,
  `POST /web_search` — raw structured results, no model turn), and
  `zhipu-chat-search` (Zhipu's Web Search in Chat, `/chat/completions` with
  the `web_search` tool — grounded answer plus cited sources).
- **Zhipu search options** — `searchEngine` (`search_std`/`search_pro`/
  `search_pro_sogou`/`search_pro_quark`), `count` (1-50, with the seam
  request's `maxResults` taking precedence), `searchRecencyFilter`,
  `contentSize`, `searchDomainFilter`, `searchIntent` (basic retrieval only),
  and `searchPrompt` (chat mode only).
- **Chat thinking-effort knob** — `reasoningEffort` (`low`/`high`/`max`,
  default `low`) maps to the chat turn's `reasoning_effort`, keeping
  thinking-only models such as GLM-5.3-Flash fast for search turns. Verified
  live: `low` answers in ~3.5s with empty reasoning content, and older models
  (`glm-4-flash`) tolerate the parameter as a no-op.
- **Responses reasoning-effort knob** — `responsesReasoningEffort`
  (`low`/`high`, unset by default) passes the OpenAI-standard
  `reasoning.effort` on the responses turn. Unset sends no `reasoning`
  parameter — the historical body stays byte-exact — so gateways that reject
  unknown parameters keep working; a Default option in the card selects the
  unset state explicitly.
- **Mode-scoped defaults** — `baseURL` / `apiKeyEnv` / `model` left empty
  inherit the current mode's default (`https://open.bigmodel.cn/api/paas/v4`,
  `ZHIPU_API_KEY`, `glm-5.3-flash` for the zhipu modes). Section values equal to
  the historical responses-mode defaults are treated as schema-default fossils
  and yield to the zhipu defaults on mode switch; explicit custom values are
  always honored. The zhipu chat default deliberately avoids the free-tier
  `glm-4.7-flash` (GLM-4-Flash's successor), which is frequently rate-limited
  with HTTP 429 code 1305.
- **Settings card grows with the protocol** — a radio-group protocol selector
  and conditional Zhipu fields (official model-selection row styling), a
  toggle for intent recognition (official switch styling), and updated zh/en
  copy; fields only render where their protocol applies.
- **Mode switch fills in the official endpoint** — selecting a mode stages
  that mode's official address (Zhipu: `https://open.bigmodel.cn/api/paas/v4`)
  into the endpoint field, so the settled addresses never need manual lookup;
  the field shows the address as a placeholder and a customized endpoint is
  never overwritten.

### Fixed

- **Basic retrieval keeps its digest when entries carry no `link`** — live
  testing showed some Zhipu credentials/engines return `search_result[]`
  entries with an empty `link`, which previously collapsed the result to
  empty `sources` with no `content`. The digest is now produced whenever any
  entries exist; only entries with a usable `link` become sources.

### Changed

- `search()` dispatches per mode over a shared fetch/error path; the
  `responses` branch is byte-for-byte the historical request shape.
- Zhipu mappings return empty `sources[]` as a valid outcome instead of
  erroring; `zhipu-chat-search` still fails loudly when no assistant message
  comes back at all.

## [0.1.4] - 2026-09-04

### Changed

- **Repositioned to any compatible gateway** — the README and npm description
  no longer bind the plugin to Qwen Token Plan: it backs the `web_search` tool
  with any OpenAI-compatible Responses API gateway whose models actually
  expose `web_search`. Qwen Token Plan stays as the default example backend,
  and the `model` row now warns that unsupported models fail loudly with
  `WEB_PROVIDER_ERROR` — never a no-search fallback.
- **Removed the no-op settings.yaml example** — the example only restated
  defaults, and the settings card (higher precedence) is the everyday entry
  point; the settings section remains as the headless fallback.
- **Generalized copy** — settings card hints (zh / en) and code comments no
  longer name a specific gateway; the protocol note now reads as the general
  Responses-API-vs-Chat-Completions caveat.

## [0.1.3] - 2026-09-04

### Changed

- **Settings card matches the shipped plugin cards** — the configuration card
  now reuses the exact `PluginCard` face the Shell / Agent loop / Subagent /
  Web search cards render: a collapsed header (title + one-line description +
  "unsaved" badge + rotating chevron), official `ValueField`/`SecretField`
  field layout, and a right-aligned footer with discard/save that collapses
  the card after a successful save.
- **Edits stage until saved** — the form keeps a draft and shows an "unsaved"
  badge while it differs from the stored config; discard reverts it; a failed
  save keeps the card open with the error in the footer (previously the card
  was always expanded and wrote on every save click without staged state).
- **Localized copy (zh / en)** — all card strings register under the plugin's
  own locale namespace and follow Settings → Language, like the shipped cards.

## [0.1.2] - 2026-09-04

### Changed

- **Self-contained bundle patch** — the plugin's `cordis.patch.yml` now also
  restates `web.fetchProvider: http` (a row patch replaces the whole config)
  and disables the shipped `web-search-deepseek` row, so installing the plugin
  requires no manual profile-level `cordis.patch.yml` edits for search.

## [0.1.1] - 2026-09-04

### Fixed

- **Local install docs no longer embed machine-specific paths** — the README
  example for a linked local checkout now uses a placeholder path instead of a
  real absolute path, so published artifacts stay portable and leak no
  developer-specific information.

## [0.1.0] - 2026-09-04

### Added

- **DIY web search provider for DSH** — registers a `ctx.web` search provider
  (`diy-search`) that calls an OpenAI-compatible **Responses API** with the
  native `web_search` tool, and overrides the shared `web` row's
  `searchProvider` to it.
- **Qwen Token Plan as the default backend** — default endpoint
  `https://token-plan.cn-beijing.maas.aliyuncs.com/compatible-mode/v1`, default
  model `deepseek-v4-flash-0731`, default credential reference
  `QWEN_TOKEN_PLAN_CN_API_KEY`.
- **Structured citation sources** — parses `web_search_call` blocks'
  `action.sources` into seam-standard `WebSearchSource[]` (deduped by url,
  optional titles from `url_citation` annotations), never scraped from prose.
- **Strict failure mode** — a response without any `web_search_call` block
  fails loudly with `WEB_PROVIDER_ERROR`; missing credentials fail with
  `WEB_PROVIDER_CREDENTIAL_MISSING`.
- **Settings card UI** — web configuration card under Settings → Plugins →
  Plugin configuration → Web search (zh/en), backed by a
  `/api/web-search-diy/config` endpoint and `$DSH_HOME/dsh-web-search-diy.json`;
  API keys go through the credentials seam only.