# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [2.0.5] - 2026-10-29

### Added

- **Standalone results now expose their long body as `source.summary`.** The
  body comes from `contentField` (DeepSeek's `need_content` field `content`,
  Zhipu's `content`), falls back to `summary` when the configured field is
  absent, and is capped at 2,000 characters. It is omitted when the configured
  body equals the original `snippet`, and both `snippet` and `summary` are
  capped at 2,000 characters without splitting surrogate pairs. `dsh-tool-web`
  renders `summary` first and caps it at 800 characters, so the calling model
  now reads substantially more than the 100–200 character snippet.
- **`DiySearchProvider.ready()` is implemented.** `ctx.web.searchReady()` now
  reflects whether the selected target can resolve a credential; a target
  without a key no longer exposes `web_search` to the model, which previously
  failed only after the model called it.
- **Anthropic Messages answers are returned as `content`.** Text blocks are
  joined in order, matching the Responses and Chat mappings, so the tool output
  can carry the provider's answer alongside the sources.

### Changed

- **DeepSeek standalone search reads `content`, not `summary`.** The built-in
  target and the custom DeepSeek template now default `contentField` to
  `content`, the field carrying the `need_content` body. Existing saved
  configurations with `contentField: "summary"` keep working: the mapper falls
  back to `summary` when the configured field is absent. Clear that field to
  pick up the new default.
- **A target without a resolvable credential is reported as not ready.** The
  search tool disappears from the model step instead of failing on invocation;
  `search()` still raises `WEB_PROVIDER_CREDENTIAL_MISSING` when called
  directly.

### Fixed

- **`contentField` was a dead setting.** It was stored and validated but never
  read; the digest only used `snippetField`. It now drives `source.summary` and
  serves as the digest fallback when `snippet` is empty.
- **An empty `content` no longer blocks the `summary` fallback.** DeepSeek
  returns `content: ""` even without `need_content`, so a present-but-empty key
  must count as absent; otherwise every default DeepSeek search carried no
  `source.summary`.
- **A long body is no longer duplicated when `snippetField` and `contentField`
  name the same key.** The equality check now uses the pre-cap values, so the
  2,000-character prefix is not written a second time as `summary` (Zhipu
  `content_size=high`).
- **The 2,000-character caps no longer split surrogate pairs.** A capped
  `snippet`, `summary`, or digest excerpt cannot end with a lone UTF-16
  surrogate.

### Internal

- Host tests: 136 (was 118); added `test/provider.test.mjs` and coverage for
  the summary mapping, the digest fallback, the empty-`content` fallback, the
  snippet/summary deduplication boundary, surrogate-safe caps, the launch
  environment credential fallback, the readiness diagnostic log, real-seam
  `searchReady()`, and the Anthropic answer text.
- Live verification with a real DeepSeek key on 2026-10-29: `deepseek/search`
  returned 5 sources with 1,790–2,000-character summaries and a 1,157-character
  digest; `includeContent=true` used the `need_content` body;
  `deepseek/anthropic-messages` returned 10 sources plus a 4,336-character
  answer; a credential-less custom target reported `ready() === false` and
  raised `WEB_PROVIDER_CREDENTIAL_MISSING`.

## [2.0.4] - 2026-10-29

### Added

- **UI copy now covers all eight languages DSH 0.2.2 ships.** The client
  registers `zh`, `en`, `ja`, `es`, `fr`, `de`, `ru` and `pt` dictionaries
  (214 keys each). The six new languages live under `src/client/locales/`, and
  `locale/` metadata follows the same set, so the configuration card, its form
  and the plugin-list title track Settings → Language.
- **The client-contract check enforces the full language set.**
  `scripts/verify-client.mjs` fails when a language is missing or its key set
  differs from English, instead of checking only `zh`/`en`.

### Changed

- **DSH baseline raised to 0.2.2-alpha.2.** `peerDependencies` admit
  `^0.2.2-alpha.2`, and `devDependencies` plus the lockfile build against
  0.2.2-alpha.2 with cordis `~4.0.6-alpha.1`. No plugin API change was needed:
  the web provider, `webServer` route registration and the
  `plugins.bundle.config` slot keep their 0.2.1 shapes.
- **README and the package description document the eight-language copy.**

## [2.0.3] - 2026-10-28

### Added

- **Field constraints now travel with the catalog and are enforced while
  editing.** Every catalog entry carries `specs` (host-projected from
  `fieldSpecOf`, including the per-target exceptions: Kimi's `count` cap of 20
  and the custom-gateway `searchEngine` that accepts any name). The client
  derives each control and its validation from those specs instead of three
  hand-maintained copies (enum ranges, boolean set, numeric set). Positive
  integers are checked against their maximum (`count` 50, Kimi 20,
  `digestEntries` 20, `digestSnippetChars` 2000), `apiKeyEnv` against the
  credential-reference grammar, and `json` fields against an object shape. A
  staged value the host would reject is flagged immediately and blocks Save, so
  a malformed value no longer reaches the server only to come back as a 400.

### Changed

- **A rejected save keeps the staged draft** and shows the host's error in the
  footer; before, the failing value stayed in the form without explanation.
- **The client half is split into focused modules** (`consts`, `types`,
  `field-meta`, `draft`, `fields`, `page`, `styles`, `locale`). The loader
  handoff is unchanged: `src/client/index.tsx` is still the only entry and the
  build still emits a single `lib/client.js` whose id is the package name.

### Fixed

- **Dirty detection no longer depends on key order.** The form used to compare
  `JSON.stringify(draft)` with `JSON.stringify(savedDraft)`, so an equivalent
  draft with a different key order looked dirty; it now compares keys and values
  explicitly.
- **The locale test double mirrors the real service.** A missing key resolves to
  the key itself (never a synthetic `<missing:...>` marker), both dictionaries
  must define the same keys, and the two branches that only the stub could reach
  are gone.

### Internal

- README development section now reports the actual host test count (118).

## [2.0.2] - 2026-10-21

### Changed

- **A fresh install now opens on `deepseek/search` (DeepSeek standalone
  search).** `DEFAULT_TARGET` used to be `qwen/responses`, so a first-time user
  landed on an in-protocol Responses target and had to switch manually. The
  first-load picker now prefers the DeepSeek pure-tool target whenever its
  default credential chain resolves, and still lands there when no credential
  resolves. Explicitly saved selections keep winning, so existing
  configurations are untouched; the client's pre-load placeholder mirrors the
  new default.
- **Switching the search shape lands on DeepSeek in both directions.** The host
  now serves `shapeDefaults` (`in-protocol` → `deepseek/anthropic-messages`,
  `standalone` → `deepseek/search`), and the config page applies it whenever the
  search-kind radio changes. Previously a shape switch merely kept the current
  vendor when it happened to exist in the target shape, which could land on an
  unsupported combination (e.g. DeepSeek Chat Completions) and forced a manual
  pick.
- **Clicking the plugin card opens this plugin's settings directly.** The client
  half now registers on `plugins.bundle.config` (key: the package name) instead
  of `plugins.row.config`, so the configuration page is the bundle card's page.
  Before, the form lived one level deeper: users had to open the bundle, find the
  `web-search-diy` row, and click its Configure control.
- **Internal maintenance.** The GET `/config` payload is now typed by a shared
  `contract.ts` used by both halves (type-only, erased from both bundles); the
  credential picker derives its vendor chains from the catalog instead of a
  second copy; the loader id in the client banner comes from `package.json`; the
  client aborts an in-flight snapshot load on unmount; a 2 s cache merges
  repeated per-vendor credential probes (invalidated on save); and the unused
  `vendors`/`protocols` response fields were removed.

### Fixed

- **The config routes no longer survive a `webServer` restart.** The routes were
  registered through an effect on the plugin's own fiber instead of the injected
  child fiber, so replacing the web server left the old routes registered and
  added a second copy of each path. They now belong to the `webServer` child and
  are released before a replacement server registers.
- **An unaddressable `apiKeyEnv` can no longer crash every search.** The field is
  validated as a credential reference name (letter/underscore start, then
  letters, digits, underscores), and credential resolution skips references the
  service cannot address instead of throwing before trying the fallbacks.
- **`DEEPSEEK_SEARCH_BASE_URL` now actually overrides the endpoint.** The catalog
  default was always non-empty, so the environment layer never applied. Priority
  is now: explicitly saved `baseUrl` > launch environment > catalog default.
- **Session recording failures no longer abort a search.** `Session.append` can
  throw (read-only/closed session); the audit record is best-effort and is now
  contained.
- **The test-connection endpoint applies the same validation as saving.** A
  custom target missing `path`/`toolType`, or an invalid Zhipu count, previously
  reached the network and returned `ok: true`; it now fails locally with 400.
- **Source URLs are limited to absolute `http(s)`.** `javascript:` and similar
  schemes returned by a provider are dropped instead of being forwarded as
  clickable sources.
- **A blank `DSH_HOME` no longer writes the config into the process cwd.** Empty
  or whitespace-only values fall back to `~/.dsh`.
- **The config file is replaced atomically.** A crash during a save can no
  longer leave truncated JSON that the next read silently treats as empty and
  the next save overwrites.
- **Config request bodies are capped at 1 MiB and responses are sent with
  `Cache-Control: no-store`.**
- **The `user-agent` now carries the real package version instead of a stale
  literal**, with a test that ties it to `package.json`; the declared Node engine
  now matches the APIs actually used (`^22.19.0 || >=24.0.0`).

## [2.0.1] - 2026-10-18

### Added

- **`oriQuestion` is back, now with a real data source.** DSH v0.2.1-rc.2
  ships `web-deepseek-api` with `sendOriginalQuestion`, which reads the latest
  human prompt from the initiating Session. This plugin uses the same source:
  the last `source.kind === "user"` message on
  `agents.currentInitiator().session`, whitespace collapsed and cut to 128
  characters, sent as `ori_question`. It is enabled by default for the DeepSeek
  template (built-in and custom) and omitted outside a session or when no human
  prompt exists.

### Fixed

- **DeepSeek queries are truncated to the documented 128-character limit**
  instead of being rejected with 400. OpenAI-style emoji surrogate pairs are
  cut by code point, never mid-character.
- **A malformed `localization` value is omitted instead of sent.** The field now
  accepts only a valid IPv4/IPv6 address, so a non-IP entry can no longer cause
  a 400; blank and malformed values both mean "not provided".

## [2.0.0] - 2026-10-18

### Added

- **Vendor × protocol configuration model** — `{ version: 3, vendor, protocol, targets }`,
  with one bucket keyed `<vendor>/<protocol>` per combination. The legacy single
  `mode` enum no longer exists.
- **Capability catalog** — 17 official targets (13 full + 4 degraded), 8
  `unsupported` metadata entries used only by the collapsed list, and 4 custom
  targets (`custom/chat-completions`, `custom/responses`,
  `custom/anthropic-messages`, `custom/search`). Fields, defaults, paths,
  templates, and model locks all come from this single source.
- **Four protocol implementations** — Chat Completions (Zhipu tool, Qwen
  `enable_search`, OpenRouter server tool, OpenAI search model), Responses,
  Anthropic Messages, and standalone search (DeepSeek / Kimi / Zhipu templates).
- **Three-layer configuration page** — search kind → protocol → vendor. Fields
  are rendered from the catalog; the vendor list contains only combinations that
  really search, and unsupported ones are collapsed per shape.
- **Custom targets** — a template picker performs a one-shot fill (the selection
  resets, the template is never persisted); eight mapping fields
  (`queryField`, `countField`, `resultsPath`, `urlField`, `titleField`,
  `snippetField`, `dateField`, `contentField`) are authoritative, with simple
  dot paths.
- **Test connection** — `POST /api/web-search-diy/test` runs one real search with
  the staged draft (query `OpenAI`, `maxResults = 3`, 60 s timeout, nothing
  persisted) and returns `{ ok, sourceCount, sourceQuality, degraded, latencyMs,
  contentPreview?, error? }`.
- **Per-vendor credential probe** — `GET /api/web-search-diy/config` now also
  returns `credentials: Record<vendor, boolean>` so the key badge follows the
  selected vendor.
- **Standalone digest limits** — `digestEntries` (default 8, 1–20) and
  `digestSnippetChars` (default 200, 1–2000) control the `content` digest without
  trimming `sources`.
- **Kimi Responses `allowedDomains`** and the `kimi-k2.6` default model.
- **Dual build** — Host ESM (`lib/index.js`) and Client CJS (`lib/client.js`)
  via tsdown; the complete Host implementation now lives in `src/`.

### Changed

- Configuration is `$DSH_HOME/dsh-web-search-diy.json` v3; no settings section is
  registered.
- Client copy and field visibility follow the catalog; vendor defaults are no
  longer hardcoded.
- A custom Chat target's request variant is decided by the template and is not
  exposed as a separate field; fields are filtered per variant.
- The custom search engine is a free-input combo with common candidates; on the
  Zhipu template a blank falls back to `search_std`.

### Removed

- The four legacy selectable modes (`responses`, `anthropic-messages`,
  `zhipu-web-search`, `zhipu-chat-search`); existing files migrate to targets on
  read.
- `maxOutputTokens` on standalone targets (it never took effect), replaced by the
  digest limits.
- The `apiVersion` setting (the Anthropic version is fixed at `2023-06-01`).
- The unused `@deepseek-ai/schemastery` dependency.

### Fixed

- **Qwen Anthropic-compatible endpoint** now performs `web_search_20250305`; the
  required `x-anthropic-billing-header: cc_entrypoint=cli;` is attached
  automatically.
- **Zhipu Responses** points at its own base URL (`/api/v1`), not the Chat one.
- **Kimi standalone `limit`** is clamped to 1–20 (previously 1–50).
- **Custom Zhipu-template search** falls back to `search_std` when the engine is
  blank, instead of sending no `search_engine`.
- **Custom Responses** maps `blockedDomains` to OpenRouter's `excluded_domains`,
  and a `:web_search` tool name generates the `parameters` block.
- **Custom Chat fields** follow the variant chosen by the template.
- **Degraded reasons** render once, on the vendor card, instead of repeating
  below the list.
- **`maxOutputTokens`** accepts the numeric string the form submits.

### Migration

- v1 flat files and v2 `modes` files migrate in memory; the first save writes v3
  and backs the original up as `dsh-web-search-diy.json.v2.bak` (once).
- Old keys are renamed: `responsesToolType` → `toolType`,
  `responsesIncludeSources` → `includeSources`,
  `responsesReasoningEffort` → `reasoningEffort`,
  `anthropicThinking` → `thinking`, `anthropicEffort` → `effort`;
  `apiVersion` is dropped.
- `template` is not persisted; the first template seeds a new custom target as a
  fill action.

### Known limitations

- OpenRouter Anthropic is implemented from documentation but not verified yet.
- Kimi Chat (`$web_search`, retiring 2026-10-20) and the Kimi coding endpoint are
  not wired in.
- DeepSeek Responses only supports `deepseek-v4-pro` and returns no
  `action.sources`.
- Qwen Chat returns no sources; Qwen is wired to the Qwen AI Platform only.
- Standalone search has no model turn.

## [1.1.1] - 2026-10-15

### Added

- **`responses` mode: configurable `tools[]` declaration name** — the official
  Responses API declares the built-in tool as `web_search`, while a gateway may
  only accept a spelling of its own: OpenRouter's `/tools` schema lists
  `openrouter:web_search` as the canonical `tools[].type` on every API format it
  supports, and `web_search_20250305` as an alias accepted on `responses` too.
  Declaring the wrong one can make the endpoint run no search at all and answer
  without any search block. The new `responsesToolType` setting (configuration
  page, default `web_search`) selects which of the three names is declared; the
  response mapper already reads either spelling back.

### Fixed

- **`responses` mode accepts a gateway-namespaced search block** — the official
  Responses API fixes the output item type at `web_search_call` ("Always
  `web_search_call`"), while OpenRouter returns the same block as
  `openrouter:web_search`, with `status` and `action.sources[]` carrying the
  official members. The mapper now matches the plain spelling and the same
  `:web_search` suffix, so a completed search from such a gateway yields its
  sources instead of failing with `WEB_PROVIDER_ERROR`.
- **`responses` mode honours the official `status` enum** — a block reporting
  `failed` / `incomplete` still contributes its urls (DeepSeek reports an opened
  page that way) but no longer counts as proof a search ran; that case is now
  reported as an unfinished search instead of blaming the endpoint. Both
  remaining "no search evidence" errors name the output item types actually
  observed, so a naming mismatch is diagnosable from the message alone.

## [1.1.0] - 2026-10-13

### Fixed

- **`responses` mode decides success by search evidence, not by source count** —
  a live probe against DeepSeek's Responses endpoint (2026-10-13) showed the
  gateway running the search while returning `web_search_call` blocks with no
  `action.sources[]` at all: `deepseek-v4-pro` reports `{type: "search",
  queries}` plus one `{type: "open_page", url}` per visited page and leaves
  `message.annotations` empty, so every real DeepSeek search used to fail with
  `WEB_PROVIDER_ERROR`. The mapper now collects sources from `action.sources[]`,
  from `open_page` `action.url` (stripping the internal `#ws_call_id=…`
  fragment), from `results[]`, and from `url_citation` annotations, and treats a
  `web_search_call` block or a citation as proof the search ran. A response with
  neither still fails loudly: `deepseek-flash` on the same endpoint silently
  ignores `tools: [{type: "web_search"}]` and answers from its own knowledge,
  which is a configuration problem rather than a search result.
- **`responses` mode returns the final answer, not the progress commentary** —
  Zhipu's Responses endpoint (verified live 2026-10-13) emits one `message` per
  progress step ("The first search didn't return relevant results, so let me
  refine the query:") before the final answer, and the mapper used to keep the
  first `output_text`. It now prefers the message OpenAI labels
  `phase: "final_answer"` and falls back to the last non-empty `output_text` for
  gateways that omit the field (Zhipu), so `content` carries the answer. Zhipu's
  Anthropic-compatible endpoint is unaffected by this fix and still fails loudly:
  it accepts `web_search_20250305` but runs no search
  (`usage.server_tool_use.web_search_requests: 0`).
- **The `user-agent` header carries the released version** — the attribution
  header was still `dsh-web-search-diy/1.0.2` after the package had reached
  1.1.0; it now reads `1.1.0`, matching `package.json`.

### Added

- **Plugin icon** — `icon.svg` reuses the globe dsh itself renders for the
  `web_search` activity (`IconGlobeOutlineRegular` in
  `@deepseek-ai/dsh-client-ui-primitives`, MIT, Copyright (c) 2026 DeepSeek),
  declared through `package.json`'s `icon` field and the `./icon` export so the
  plugin list and detail page stop showing the default artwork.
- **Localized plugin metadata** — `locale/en.json` and `locale/zh.json` carry
  `meta.title` / `meta.description`, so the plugin list and its detail page
  follow the app language (Settings → Language) instead of falling back to the
  English `package.json` description.

### Changed

- **OpenAI-protocol conformance** (checked against the Responses API reference
  and the web search guide) — `responses` mode now sends
  `include: ["web_search_call.action.sources"]` by default, because the official
  API returns `action.sources` only when requested through `include`. A new
  `responsesIncludeSources` switch turns it off for a gateway that rejects
  unknown parameters; DeepSeek and Zhipu both accept it (verified live
  2026-10-13). The mapper also reads `find_in_page` action URLs alongside
  `open_page`.
- **Anthropic-protocol conformance** (checked against the web search tool docs) —
  an empty `web_search_tool_result.content` list is a search that matched
  nothing, which the API reports as success, so it now resolves to empty
  `sources` instead of `WEB_PROVIDER_ERROR`; only a response with no result block
  at all still fails. `page_age`, a human-readable date in the official API
  ("April 30, 2025"), is normalized to the ISO-8601 `publishedAt` the seam
  promises, and dropped when it carries no parsable date.
- **Kimi's `action.sources[].title` is kept** — Kimi's Responses API titles each
  entry of `web_search_call.action.sources[]`, which the mapper used to drop (it
  kept only the url). The `url_citation` annotation title still wins, and
  `results[].title` remains the last fallback.
- **Reasoning-knob differences are absorbed instead of guessed** — the official
  level sets differ per model: Zhipu's GLM-5.3 accepts only `max`/`high`/`low`
  and rejects `thinking: disabled` outright (verified live: HTTP 400,
  "该模型始终思考，不支持关闭思考；请使用 low、high 或 max。", for both
  `reasoning_effort: medium` and `thinking: disabled`, on its chat *and*
  Responses endpoints), Kimi knows `low`/`high`/`max`, and DeepSeek silently
  accepts levels it does not use. `responsesReasoningEffort` now offers the full
  official OpenAI set (`minimal`/`low`/`medium`/`high`/`xhigh`), and the new
  `anthropicEffort` exposes Anthropic's `output_config.effort`
  (`low`/`medium`/`high`/`xhigh`/`max`). When an endpoint rejects the request
  over one of those knobs, the provider retries once without it, sacrificing
  `reasoning.effort` → `output_config` → `thinking` → `reasoning_effort` in that
  order, so an unsupported preference degrades to the endpoint's own default
  instead of failing the whole search. Verified live against Kimi's Responses
  endpoint: `reasoning.effort: "minimal"` (Kimi knows only `low`/`high`/`max`)
  came back 400 and the automatic retry without the knob returned 200 with 20
  sources, while the same bogus value on Kimi's Messages endpoint is accepted
  silently — that `output_config` is lenient about unknown levels.
- **Kimi verified live on both protocols** — `responses` mode works with
  `https://api.moonshot.cn/v1` (kimi-k3): `{"type": "web_search"}` runs, `include`
  returns 12–20 titled sources, and the answer arrives as `content`. Contrary to
  its own tools schema, Kimi's Anthropic-compatible endpoint
  (`https://api.moonshot.cn/anthropic/v1`) also runs `web_search_20250305`,
  returning `web_search_tool_result` blocks that carry `title` and an ISO
  `page_age`, so `anthropic-messages` mode works there too (20 sources). Both
  endpoints list some Google redirect URLs among their sources; those are passed
  through exactly as the provider sent them. (An earlier reading of Qwen's Base
  URL overview concluded that Qwen published no Responses API at all; the live
  measurement recorded under *Changed* below shows the opposite.)
- **A missing `/responses` surface is diagnosed instead of just reported** — a
  404 from the `responses` endpoint now states that the base URL exposes no
  `/responses` path and names endpoints that do implement it, instead of
  surfacing a bare status line.
- **Qwen measured live on both protocols; defaults moved to the surface that
  works** — the shipped default used to be Qwen Token Plan's *OpenAI-compatible*
  domain with `QWEN_TOKEN_PLAN_CN_API_KEY`, and that domain answers a
  pay-as-you-go key with HTTP 401: Token Plan's own docs pin its `sk-sp-…`
  subscription key to a `token-plan.*.maas.aliyuncs.com` endpoint, while the
  stored `sk-ws-…` key is pay-as-you-go. Measured on 2026-10-13 against
  `https://maas.qianwenaiapi.com/compatible-mode/v1`, `POST /responses` with
  `tools: [{type: "web_search"}]` really searches: `web_search_call` blocks
  carry 26–37 `action.sources[]` urls (no titles), `include` is accepted and
  ignored — sources arrive with or without it — assistant `message` blocks carry
  no `phase` (the mapper's "last non-empty `output_text`" fallback picks the
  5845-character final answer over the progress notes), and both
  `deepseek-v4-flash-0731` (4 searches / 35 sources / 17.3s) and
  `qwen3.8-flash` (1 / 29 / 16.5s) run the built-in tool. The same platform's
  Anthropic-compatible surface is the opposite:
  `https://maas.qianwenaiapi.com/apps/anthropic/v1/messages` accepts
  `tools: [{type: "web_search_20250305", name: "web_search", max_uses: 5}]`
  without a 400 and then answers prose in ~8s with no `server_tool_use`, no
  `web_search_tool_result`, and the same text it returns when no tools are sent
  at all — its reference lists the `content` block types as
  `text`/`thinking`/`tool_use` and `tools` as function calling only, so there is
  no server-side search. The default `baseURL` and `apiKeyEnv`, the README tables
  and warning block, and the configuration page's endpoint hint therefore now
  point Qwen at the `responses` mode instead of `anthropic-messages`, the module
  header records the measurement, and two regression tests pin the shapes
  (phase-less Qwen Responses turns; a 200 carrying only prose on an Anthropic
  surface must still fail loudly). The `responses` protocol paragraphs continue
  to describe the expanded effort set and the automatic retry instead of the old
  `low`/`high`-only wording.
- **Version 1.1.0, and both READMEs rebuilt for it** — the changes above ship as
  1.1.0, and the two READMEs now describe only what this release implements
  (protocol table, per-mode defaults, a live-verification matrix, the
  configuration keys, and the request flow). The change-history narration is
  gone, the files carry shields.io badges (npm / license / node / protocol count
  / dsh-plugin) plus the official "powered by dsh" badge, and each links to the
  other through a language switcher. The plugin-list locale strings, the
  `package.json` description, and the configuration page's endpoint and
  credential hints were aligned with the same wording; the Anthropic protocol
  row now names DeepSeek as the default backend with Anthropic and Kimi beside
  it.

## [1.0.2] - 2026-10-09

### Changed

- **`responses` mode sources gain title/snippet on Zhipu** — live verification
  against `https://open.bigmodel.cn/api/v1/responses` showed the gateway
  attaches `results[]` (`url` / `title` / `snippet`) to each `web_search_call`
  while emitting no `url_citation` annotations, leaving every source untitled.
  The mapper now joins `results[]` by url as fallback metadata; annotation
  titles keep precedence, and Qwen/OpenAI-shaped responses (no `results[]`)
  are untouched. (The OpenAPI document's `action.source` string-array shape
  does not match the live response — the real body carries the same
  `action.sources` objects the Qwen gateways send.)
- **`request_id` on the two `paas/v4` Zhipu calls** — each Web Search API and
  chat search now carries a generated UUID for platform-side correlation; the
  Response API request schema has no such field, so `responses` is unchanged.
- **`available()` checks per mode** — `maxUses`/`apiVersion` count only in
  `anthropic-messages`, `count` only in the Zhipu modes; previously every
  mode's check ran against every key (always true through the defaults).
- Dropped the inert `model` entry from the `zhipu-web-search` profile (the
  mode sends no model).
- `mapResponsesResponse` is now exported (the only one of the four mappers
  that was missing from the bundle's export list).

### Added

- **`requireSearch` (zhipu-chat-search)** — exposes the tool's documented
  `require_search` switch: when on, the endpoint refuses to answer without
  search results. Default off, which keeps the request body byte-identical to
  the historical one. Shown on the configuration page with zh/en copy.
- **Engine compatibility notes on the configuration page** — selecting
  `search_pro_quark` annotates `count` and `searchDomainFilter` with
  "not supported by this engine" (values are still sent as configured; the
  endpoint ignores them), and `search_pro_sogou` annotates `count` with its
  10/20/30/40/50 restriction, straight from the Zhipu OpenAPI.

## [1.0.1] - 2026-10-08

### Fixed

- **The plugin is no longer skipped on dsh 0.2.x** — the `peerDependencies`
  range was still `^0.1.2-rc.1`, which caret-expands to `>=0.1.2-rc.1 <0.2.0`
  under 0.x semantics. Moving the runtime to 0.2.0-rc.2 therefore tripped the
  app-boot compatibility gate (`Plugin dsh-web-search-diy@1.0.0 is incompatible
  with dsh 0.2.0-rc.2: peerDependencies …`) and the whole profile bundle was
  skipped, leaving no search provider registered at all.

### Changed

- **Peer range widened to two release lines** —
  `@deepseek-ai/dsh-web`, `@deepseek-ai/dsh-credentials`, and
  `@deepseek-ai/dsh-launch-environment` now declare
  `^0.1.6-alpha.2 || ^0.2.0-rc.1`. Under 0.x a caret never crosses a minor, so
  covering both lines requires the explicit `||` (a single `|` is not a valid
  semver range and silently matches nothing). The lower bound is
  0.1.6-alpha.2 — the release that introduced the `plugins.row.config` slot this
  configuration page registers into, and therefore the oldest runtime on which
  that page is reachable at all. The three packages were verified to export
  identical public symbols from 0.1.2-rc.1 through 0.2.1-alpha.1 apart from
  `dsh-launch-environment`'s added `launchedThroughSsh`.
- **`devDependencies` and the lockfile moved to 0.2.0-rc.2** — development and
  tests now resolve against the current runtime, so a linked install can no
  longer pick up a shadowed 0.1.x copy of those peers from the plugin's own
  `node_modules`.

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