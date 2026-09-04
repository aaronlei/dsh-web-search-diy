# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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