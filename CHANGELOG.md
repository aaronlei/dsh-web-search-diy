# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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