/**
 * dsh-web-search-diy — web search provider for the DeepSeek Harness web
 * capability seam (`ctx.web`), speaking four selectable protocols (`mode`):
 *
 *   - `responses` (default): an OpenAI-compatible **Responses API** endpoint
 *     with the built-in `web_search` tool; `web_search_call` blocks normalize
 *     into seam-standard `WebSearchResult` sources. Works with any gateway
 *     implementing that surface:
 *       - Qwen Token Plan (Alibaba Cloud), verified: `deepseek-v4-flash-0731`
 *         on `token-plan.cn-beijing.maas.aliyuncs.com`
 *       - OpenAI (`api.openai.com`)
 *       - other OpenAI-compatible gateways that expose the same shape
 *   - `anthropic-messages`: an **Anthropic-compatible Messages API** endpoint
 *     (`POST /messages`) with the native `web_search_20250305` server tool —
 *     the same wire format as the shipped DeepSeek search provider
 *     (`deepseek-official`), so a deployment already holding
 *     `DEEPSEEK_API_KEY` and/or `DEEPSEEK_SEARCH_BASE_URL` works unchanged.
 *     `web_search_tool_result` blocks become sources, and page excerpts are
 *     joined from the response's `citations[].cited_text`.
 *   - `zhipu-web-search`: Zhipu BigModel's **Web Search API** (基础检索,
 *     `POST /web_search`) — raw structured results, no model turn; entries
 *     become sources and a digest of the top entries becomes `content`.
 *   - `zhipu-chat-search`: Zhipu's **Web Search in Chat** (问答增强,
 *     `POST /chat/completions` with the `web_search` tool) — the grounded
 *     answer becomes `content`, the tool's source details become sources.
 *
 * IMPORTANT: on many OpenAI-compatible gateways, built-in web search only
 * triggers through the Responses API (`/responses`) with an explicit
 * `tools: [{type: "web_search"}]` declaration — Chat Completions search flags
 * can be silently ignored there.
 *
 * This is an implementation package: it registers a provider on `ctx.web` via
 * `registerSearchProvider`, resolves credentials per search through the
 * `ctx.credentials` seam (falling back to the launching environment), and
 * registers NO model-facing tools itself.
 *
 * @module dsh-web-search-diy
 */
import { WebError } from "@deepseek-ai/dsh-web";
import { credentialRef } from "@deepseek-ai/dsh-credentials";
import { launchEnvironmentOf } from "@deepseek-ai/dsh-launch-environment";
import z from "@deepseek-ai/schemastery";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { homedir } from "node:os";
import { gunzipSync, inflateSync } from "node:zlib";

//#region constants
/** Cordis plugin name used by loader diagnostics. */
const name = "web-search-diy";
/** The web seam this provider registers into. */
const inject = ["web"];
/** Stable id this provider registers under on the seam. */
const PROVIDER_ID = "diy-search";
/**
 * Search protocols this provider speaks, in the order the configuration page
 * offers them. `responses` is the OpenAI-compatible Responses API with the
 * built-in `web_search` tool; `anthropic-messages` is the Anthropic-compatible
 * Messages API with the native `web_search_20250305` server tool; the two
 * `zhipu-*` modes speak Zhipu BigModel services over the shared
 * `https://open.bigmodel.cn/api/paas/v4` base: `zhipu-web-search` is the raw
 * Web Search API (`/web_search`), and `zhipu-chat-search` is Web Search in
 * Chat (`/chat/completions` with the `web_search` tool).
 */
const MODES = ["anthropic-messages", "responses", "zhipu-web-search", "zhipu-chat-search"];
/** Zhipu search engines shared by both zhipu modes (per-call pricing differs). */
const SEARCH_ENGINES = ["search_std", "search_pro", "search_pro_sogou", "search_pro_quark"];
/** Zhipu recency windows for `search_recency_filter`. */
const RECENCY_FILTERS = ["noLimit", "oneDay", "oneWeek", "oneMonth", "oneYear"];
/** Zhipu snippet sizes for `content_size`. */
const CONTENT_SIZES = ["medium", "high"];
/** Zhipu thinking-effort levels for `reasoning_effort` (chat mode only). */
const REASONING_EFFORTS = ["low", "high", "max"];
/** Default chat-mode thinking effort: keeps thinking-only models fast. */
const DEFAULT_REASONING_EFFORT = "low";
/**
 * OpenAI Responses API reasoning-effort levels for `reasoning.effort`
 * (`responses` mode only). Off by default: gateways that do not implement the
 * parameter may reject it, so nothing is sent until the user picks a value.
 */
const RESPONSES_REASONING_EFFORTS = ["low", "high"];
/** Default protocol: the historical OpenAI-compatible Responses API behavior. */
const DEFAULT_MODE = "responses";
/** Default endpoint for `responses` mode; `/responses` is appended. */
const DEFAULT_BASE_URL = "https://token-plan.cn-beijing.maas.aliyuncs.com/compatible-mode/v1";
/** Default endpoint for both zhipu modes; `/web_search` or `/chat/completions` is appended. */
const ZHIPU_DEFAULT_BASE_URL = "https://open.bigmodel.cn/api/paas/v4";
/** Default credential reference resolved per search in `responses` mode. */
const DEFAULT_API_KEY_ENV = "QWEN_TOKEN_PLAN_CN_API_KEY";
/** Default credential reference resolved per search in zhipu modes. */
const ZHIPU_DEFAULT_API_KEY_ENV = "ZHIPU_API_KEY";
/**
 * Zhipu credential references tried, in order, after the canonical one when the
 * configured reference is the mode's own default. A deployment normally names
 * its Zhipu credential after the model provider it configured there — a
 * `zai-coding-cn` row carries `ZAI_CODING_CN_API_KEY` — so an unset `apiKeyEnv`
 * must still find that key instead of reporting a missing credential.
 */
const ZHIPU_API_KEY_ENV_FALLBACKS = ["ZAI_CODING_CN_API_KEY"];
/** Default credential reference resolved per search in `anthropic-messages` mode. */
const DEEPSEEK_DEFAULT_API_KEY_ENV = "DEEPSEEK_API_KEY";
/** Default endpoint for `anthropic-messages` mode; `/messages` is appended. */
const DEEPSEEK_DEFAULT_BASE_URL = "https://api.deepseek.com/anthropic/v1";
/**
 * Default Anthropic-format model for `anthropic-messages` mode. The endpoint's
 * supported names are `deepseek-flash` and `deepseek-v4-pro`, and
 * `deepseek-flash` is the rolling latest Flash (DeepSeek V4.1 Flash since
 * 2026-09-10). A version string is not an API name: `deepseek-v4.1-flash` is
 * rejected with HTTP 400.
 */
const DEEPSEEK_DEFAULT_MODEL = "deepseek-flash";
/** Default `anthropic-version` header value for `anthropic-messages` mode. */
const DEEPSEEK_DEFAULT_API_VERSION = "2023-06-01";
/** Default cap on `web_search` server-tool uses per Anthropic Messages request. */
const DEEPSEEK_DEFAULT_MAX_USES = 5;
/**
 * Default output-token cap for one Anthropic Messages search turn. Larger than
 * the other modes' 1024: one search is a full thinking turn plus the native
 * tool round, and the shipped DeepSeek search provider defaults to 4096 there.
 */
const DEEPSEEK_DEFAULT_MAX_OUTPUT_TOKENS = 4096;
/**
 * Thinking selector for `anthropic-messages` mode. Measured against the shipped
 * DeepSeek endpoint: `reasoning_effort` and `thinking.budget_tokens` are both
 * ignored there (thinking length stays in the same noise band, and a 1024-token
 * budget yields more thinking than no budget at all), while
 * `thinking: {type: "disabled"}` reliably removes the thinking blocks and cuts
 * one search from ~38s to ~8s. Only that switch is worth exposing.
 */
const ANTHROPIC_THINKING_MODES = ["default", "disabled"];
/** Default thinking selector: send nothing and follow the model's own mode. */
const DEFAULT_ANTHROPIC_THINKING = "default";
/**
 * Auxiliary-search endpoint override, read from the launching environment
 * independently of the configured mode. The shipped DeepSeek search provider
 * honors the same variable, so an existing deployment's override keeps working
 * after switching to `anthropic-messages`.
 */
const SEARCH_BASE_URL_ENV = "DEEPSEEK_SEARCH_BASE_URL";
/** Default model for `responses` mode; any Responses-API model exposing the `web_search` tool works. */
const DEFAULT_MODEL = "deepseek-v4-flash-0731";
/**
 * Default model for `zhipu-chat-search` mode. GLM-5.3-Flash with the default
 * `reasoningEffort: low` is the fastest reliably-available choice: the free
 * tier's GLM-4.7-Flash (GLM-4-Flash's successor) is frequently rate-limited
 * with HTTP 429 code 1305, and thinking-only 5.3-Flash answers fast at low
 * effort (verified live: ~3.5s, empty reasoning content).
 */
const ZHIPU_DEFAULT_CHAT_MODEL = "glm-5.3-flash";
/** Default Zhipu result count when the seam request carries no `maxResults`. */
const DEFAULT_COUNT = 10;
/**
 * Default upper bound on generated tokens for one search call. Each search is
 * a full model turn (reasoning + tool use + grounded answer); this caps the
 * answer length, not the search itself.
 */
const DEFAULT_MAX_OUTPUT_TOKENS = 1024;
/** Attribution header sent on every request. Bump with the package version. */
const USER_AGENT = "dsh-web-search-diy/0.3.0";
/**
 * The credential reference, endpoint, model, and output budget each mode falls
 * back to when the settings section and the UI-managed file both leave a field
 * blank.
 * Everything mode-scoped is read from this table instead of scattering
 * `mode === "..."` tests, so a new protocol touches one place rather than every
 * precedence branch. The request paths stay in the protocol methods: they
 * belong to the wire format each method implements.
 */
const MODE_PROFILES = {
	responses: {
		apiKeyEnv: DEFAULT_API_KEY_ENV,
		apiKeyEnvFallbacks: [],
		baseURL: DEFAULT_BASE_URL,
		model: DEFAULT_MODEL,
		maxOutputTokens: DEFAULT_MAX_OUTPUT_TOKENS
	},
	"anthropic-messages": {
		apiKeyEnv: DEEPSEEK_DEFAULT_API_KEY_ENV,
		apiKeyEnvFallbacks: [],
		baseURL: DEEPSEEK_DEFAULT_BASE_URL,
		model: DEEPSEEK_DEFAULT_MODEL,
		maxOutputTokens: DEEPSEEK_DEFAULT_MAX_OUTPUT_TOKENS
	},
	"zhipu-web-search": {
		apiKeyEnv: ZHIPU_DEFAULT_API_KEY_ENV,
		apiKeyEnvFallbacks: ZHIPU_API_KEY_ENV_FALLBACKS,
		baseURL: ZHIPU_DEFAULT_BASE_URL,
		model: ZHIPU_DEFAULT_CHAT_MODEL,
		maxOutputTokens: DEFAULT_MAX_OUTPUT_TOKENS
	},
	"zhipu-chat-search": {
		apiKeyEnv: ZHIPU_DEFAULT_API_KEY_ENV,
		apiKeyEnvFallbacks: ZHIPU_API_KEY_ENV_FALLBACKS,
		baseURL: ZHIPU_DEFAULT_BASE_URL,
		model: ZHIPU_DEFAULT_CHAT_MODEL,
		maxOutputTokens: DEFAULT_MAX_OUTPUT_TOKENS
	}
};
/** True for the Anthropic-compatible protocol (different headers and body). */
function isAnthropicMode(mode) {
	return mode === "anthropic-messages";
}
/** True for the two Zhipu modes, whose endpoint cannot serve a DeepSeek model. */
function isZhipuMode(mode) {
	return mode.startsWith("zhipu-");
}
/**
 * Candidate credential references for one search, highest priority first.
 *
 * An explicitly configured reference is used alone: the deployment named that
 * credential, so no other name may stand in for it. Otherwise the mode's own
 * chain applies — see {@link ZHIPU_API_KEY_ENV_FALLBACKS} for why the Zhipu
 * modes carry more than one name.
 *
 * @param explicitName - the explicitly configured reference, if any.
 * @param mode - the authoritative mode.
 * @returns reference names to try in order.
 */
function apiKeyEnvCandidates(explicitName, mode) {
	if (explicitName !== void 0 && explicitName.length > 0) return [explicitName];
	const profile = MODE_PROFILES[mode];
	return [profile.apiKeyEnv, ...(profile.apiKeyEnvFallbacks ?? [])];
}
/**
 * Decide one mode-scoped section value (endpoint, credential reference, model).
 *
 * A section value that is exactly another mode's default is treated as a
 * schema-default fossil rather than a choice: past versions froze the
 * `responses` defaults into the section, so switching modes without ever
 * editing the field must land on the new mode's default. A value equal to the
 * CURRENT mode's default is kept (it is explicit or equivalent), and any other
 * value is the user's own and always wins.
 *
 * Endpoints and credential references are mode-exclusive, so the fossil rule
 * applies to them in every mode. Model names are shared across the DeepSeek
 * modes (a user may legitimately run `deepseek-v4-flash-0731` on the Anthropic
 * endpoint), so it applies to `model` only when the target mode is Zhipu, whose
 * endpoint cannot serve a DeepSeek model at all.
 *
 * @param value - the section's value for `key` (may be undefined or blank).
 * @param key - which profile field to compare against.
 * @param mode - the authoritative mode.
 * @returns the value to use, or undefined when it should fall back to the profile.
 */
function pickModeScoped(value, key, mode) {
	if (value === void 0 || value.length === 0) return void 0;
	if (value === MODE_PROFILES[mode][key]) return value;
	if (key === "model" && !isZhipuMode(mode)) return value;
	const isAnotherModeDefault = Object.values(MODE_PROFILES).some((profile) => profile[key] === value);
	return isAnotherModeDefault ? void 0 : value;
}
/**
 * Decide the output-token budget for one search turn.
 *
 * The Anthropic endpoint needs a larger default than the other protocols (see
 * {@link DEEPSEEK_DEFAULT_MAX_OUTPUT_TOKENS}), but the settings schema freezes
 * the smaller shared default into every section. That frozen value is therefore
 * a fossil in `anthropic-messages` mode only, where it yields to 4096; every
 * other mode keeps whatever the section holds, so a user-set 4096 is never
 * rewritten there.
 *
 * @param value - the section's `maxOutputTokens`.
 * @param mode - the authoritative mode.
 * @returns the value to use, or undefined to fall back to the profile default.
 */
function pickMaxOutputTokens(value, mode) {
	if (value === void 0) return void 0;
	if (isAnthropicMode(mode) && value === DEFAULT_MAX_OUTPUT_TOKENS) return void 0;
	return value;
}
//#endregion

//#region response mapping
/**
 * Normalize an OpenAI-compatible Responses API body into a seam-standard
 * `WebSearchResult`.
 *
 * - Sources come from every `web_search_call` block's `action.sources`
 *   (deduped by url — one request can repeat a page across sub-queries).
 * - `url_citation` annotations on `output_text` blocks provide optional titles
 *   for those urls.
 * - The model's grounded answer (the `output_text` after search) becomes
 *   `content`; it is the provider's summary over the returned sources.
 *
 * Strict mode: a response without any `web_search_call` block is an error
 * rather than a prose-scraping fallback — the endpoint or model simply does
 * not implement the expected tool.
 *
 * @param data - the parsed Responses API response body.
 * @returns the normalized result with deduped sources.
 * @throws {WebError} `WEB_PROVIDER_ERROR` when no search call block exists.
 */
function mapResponsesResponse(data) {
	const output = Array.isArray(data?.output) ? data.output : [];
	const seen = /* @__PURE__ */ new Set();
	const sources = [];
	const titles = /* @__PURE__ */ new Map();
	let content;
	for (const block of output) {
		if (!block || typeof block !== "object") continue;
		if (block.type === "web_search_call") {
			for (const item of block.action?.sources ?? []) {
				if (item?.type !== "url" || typeof item.url !== "string" || item.url.length === 0 || seen.has(item.url)) continue;
				seen.add(item.url);
				sources.push({ url: item.url });
			}
		} else if (block.type === "message") {
			for (const item of block.content ?? []) {
				if (item?.type !== "output_text") continue;
				for (const annotation of item.annotations ?? []) {
					if (annotation?.type === "url_citation" && typeof annotation.url === "string" && annotation.url.length > 0 && typeof annotation.title === "string" && annotation.title.length > 0) {
						titles.set(annotation.url, annotation.title);
					}
				}
				if (content === void 0 && typeof item.text === "string" && item.text.length > 0) content = item.text;
			}
		}
	}
	if (sources.length === 0) throw new WebError("the provider returned no web_search_call block; the endpoint may not implement the Responses API web_search tool", "WEB_PROVIDER_ERROR");
	for (const source of sources) {
		const title = titles.get(source.url);
		if (title !== void 0) source.title = title;
	}
	return {
		...content !== void 0 ? { content } : {},
		sources,
		truncated: false
	};
}
/**
 * Normalize an Anthropic-compatible Messages body into a seam-standard
 * `WebSearchResult`.
 *
 * - Sources come from every `web_search_tool_result` block's
 *   `web_search_result` items: `url`, optional `title`, and optional
 *   `page_age` → `publishedAt`, deduped by url (one request can repeat a page
 *   across sub-queries).
 * - Anthropic result items carry no inline excerpt, so `snippet` is joined
 *   from the `citations[].cited_text` of the response's `text` blocks, keyed by
 *   url (first occurrence wins) — the same join the shipped DeepSeek provider
 *   performs.
 * - `content` is deliberately omitted: the provider's own prose is not trusted
 *   as an answer. The seam owns `maxResults` truncation, so `truncated` is
 *   always `false` here.
 * - A result block whose `content` is an object instead of an array is
 *   Anthropic reporting a tool failure (`max_uses_exceeded`, `too_many_requests`,
 *   …); its `error_code` is surfaced instead of being flattened into an
 *   unprocessable body.
 *
 * Strict mode: no result block at all is an error, never a prose-scraping
 * fallback — the endpoint or model simply does not implement the expected tool.
 *
 * @param data - the parsed Messages response body.
 * @returns the normalized result with deduped, snippet-joined sources.
 * @throws {WebError} `WEB_PROVIDER_ERROR` when no result block exists.
 */
function mapAnthropicResponse(data) {
	const blocks = Array.isArray(data?.content) ? data.content : [];
	const snippets = /* @__PURE__ */ new Map();
	for (const block of blocks) {
		if (block?.type !== "text") continue;
		for (const cite of block.citations ?? []) {
			if (typeof cite?.url !== "string" || cite.url.length === 0) continue;
			if (typeof cite.cited_text !== "string" || cite.cited_text.length === 0) continue;
			if (!snippets.has(cite.url)) snippets.set(cite.url, cite.cited_text);
		}
	}
	const seen = /* @__PURE__ */ new Set();
	const sources = [];
	let toolError;
	for (const block of blocks) {
		if (block?.type !== "web_search_tool_result") continue;
		const items = block.content;
		if (!Array.isArray(items)) {
			const code = typeof items?.error_code === "string" && items.error_code.length > 0 ? items.error_code : "unknown";
			toolError ??= `the web_search tool failed with "${code}"`;
			continue;
		}
		for (const item of items) {
			if (item?.type !== "web_search_result") continue;
			if (typeof item.url !== "string" || item.url.length === 0 || seen.has(item.url)) continue;
			seen.add(item.url);
			const source = { url: item.url };
			if (typeof item.title === "string" && item.title.length > 0) source.title = item.title;
			const snippet = snippets.get(item.url);
			if (snippet !== void 0) source.snippet = snippet;
			if (typeof item.page_age === "string" && item.page_age.length > 0) source.publishedAt = item.page_age;
			sources.push(source);
		}
	}
	if (sources.length === 0) throw new WebError(toolError ?? "the provider returned no web_search_tool_result block; the endpoint may not implement the Anthropic web_search tool", "WEB_PROVIDER_ERROR");
	return {
		sources,
		truncated: false
	};
}
/**
 * Normalize Zhipu search entries (`search_result[]` items or the chat tool's
 * source objects, both shaped `{link, title, ...}`) into seam sources, deduped
 * by url. Fields the seam has no slot for (`media`, `publish_date`, `icon`)
 * are dropped.
 */
function normalizeZhipuSources(entries) {
	const seen = /* @__PURE__ */ new Set();
	const sources = [];
	for (const item of entries) {
		if (typeof item?.link !== "string" || item.link.length === 0 || seen.has(item.link)) continue;
		seen.add(item.link);
		const source = { url: item.link };
		if (typeof item.title === "string" && item.title.length > 0) source.title = item.title;
		sources.push(source);
	}
	return sources;
}
/**
 * Build the `content` digest for the raw Web Search API mode: a numbered
 * title-plus-snippet list over the top entries, standing in for the grounded
 * summary a model-backed provider would produce.
 */
function zhipuResultDigest(entries, maxEntries = 8, maxSnippetLength = 200) {
	const lines = [];
	for (const item of entries) {
		if (lines.length >= maxEntries) break;
		const title = typeof item?.title === "string" ? item.title.trim() : "";
		const snippet = typeof item?.content === "string" ? item.content.trim() : "";
		const head = `${lines.length + 1}. `;
		if (title.length > 0 && snippet.length > 0) lines.push(`${head}${title}\n${snippet.slice(0, maxSnippetLength)}`);
		else if (title.length > 0) lines.push(`${head}${title}`);
		else if (snippet.length > 0) lines.push(`${head}${snippet.slice(0, maxSnippetLength)}`);
	}
	return lines.join("\n");
}
/**
 * Normalize a Zhipu Web Search API body into a seam-standard result.
 *
 * `search_result[]` entries with a usable `link` become the sources; a compact
 * digest of the top entries always becomes `content` — some credentials and
 * engines return entries with an empty `link`, and the digest is then the only
 * usable payload. An empty result set is a valid outcome (the engine found
 * nothing), not an error.
 *
 * @param data - the parsed `/web_search` response body.
 * @returns the normalized result.
 */
function mapZhipuWebSearchResponse(data) {
	const entries = Array.isArray(data?.search_result) ? data.search_result : [];
	const sources = normalizeZhipuSources(entries);
	if (entries.length === 0) return { sources, truncated: false };
	return {
		...{ content: zhipuResultDigest(entries) },
		sources,
		truncated: false
	};
}
/**
 * Normalize a Zhipu Chat Completions body that ran with the `web_search` tool.
 *
 * - `choices[0].message.content` (string or text-item array) becomes `content`.
 * - Sources come from the search details the endpoint attaches when the tool
 *   was declared with `search_result: true`. The OpenAPI schema does not spell
 *   out their position, so both documented placements are probed: the message
 *   itself and the response root. A grounded answer without source details is
 *   still a usable answer, so missing sources do not throw.
 *
 * @param data - the parsed `/chat/completions` response body.
 * @returns the normalized result.
 * @throws {WebError} `WEB_PROVIDER_ERROR` when no assistant message exists.
 */
function mapZhipuChatResponse(data) {
	const message = Array.isArray(data?.choices) ? data.choices[0]?.message : void 0;
	const content = typeof message?.content === "string" && message.content.length > 0 ? message.content : Array.isArray(message?.content) ? message.content.filter((item) => item?.type === "text" && typeof item.text === "string" && item.text.length > 0).map((item) => item.text).join("\n") : void 0;
	if (content === void 0 || content.length === 0) throw new WebError("the provider returned no assistant message; the endpoint may not implement the chat web_search tool", "WEB_PROVIDER_ERROR");
	const messageSources = message?.web_search;
	const rootSources = data?.web_search;
	const entries = Array.isArray(messageSources) && messageSources.length > 0 ? messageSources : Array.isArray(rootSources) ? rootSources : [];
	return {
		content,
		sources: normalizeZhipuSources(entries),
		truncated: false
	};
}
//#endregion

//#region transport
/** gzip member magic (RFC 1952) and zlib's default CMF byte for deflate (RFC 1950). */
const GZIP_MAGIC_FIRST = 0x1f;
const GZIP_MAGIC_SECOND = 0x8b;
const ZLIB_CMF = 0x78;
/**
 * Hard caps against decompression bombs. Legitimate search payloads peak at a
 * few hundred kilobytes (largest observed: ~25 KB compressed for 20 results),
 * so these bounds only ever fire on hostile or broken responses: the wire cap
 * stops an oversized body from even finishing its download, the decode cap
 * stops a tiny compressed body from expanding without bound inside `zlib`.
 */
const MAX_RESPONSE_BYTES = 8 * 1024 * 1024;
const MAX_DECODED_BYTES = 16 * 1024 * 1024;
/** True for a zlib-wrapped deflate stream: default CMF plus the RFC 1950 checksum. */
function isZlibStream(raw) {
	return raw[0] === ZLIB_CMF && ((raw[0] << 8) | (raw[1] ?? 0)) % 31 === 0;
}
/**
 * Read the whole body off the wire, refusing to pull more than `maxBytes`.
 *
 * The cap is enforced per chunk while streaming: once the accumulated size
 * crosses the limit the reader is cancelled so a bomb never finishes
 * downloading, instead of buffering it all through `response.arrayBuffer()`.
 *
 * @param response - the response to drain.
 * @param maxBytes - hard cap on the compressed body size.
 * @returns the buffered body.
 * @throws {Error} when the body exceeds `maxBytes`.
 */
async function readBodyCapped(response, maxBytes) {
	const reader = response.body?.getReader();
	if (reader === void 0) return Buffer.alloc(0);
	const chunks = [];
	let total = 0;
	for (;;) {
		const { done, value } = await reader.read();
		if (done === true) break;
		total += value.byteLength;
		if (total > maxBytes) {
			let cancelError;
			try {
				await reader.cancel(); // stop pulling bomb bytes off the wire
			} catch (error) {
				cancelError = error;
			}
			throw new Error(`response body exceeds ${maxBytes} bytes`, cancelError === void 0 ? void 0 : { cause: cancelError });
		}
		chunks.push(Buffer.from(value));
	}
	return Buffer.concat(chunks);
}
/**
 * Inflate a compressed body, refusing to expand past `maxBytes`.
 *
 * `maxOutputLength` is the only trustworthy bound here: a gzip stream's
 * declared ISIZE is attacker-controlled, so the cap is enforced by `zlib`
 * while producing output, not by trusting headers.
 *
 * @param raw - the compressed bytes.
 * @param maxBytes - hard cap on the decoded size.
 * @returns the decoded bytes.
 * @throws {Error} when the decoded size would exceed `maxBytes` or the stream is corrupt.
 */
function inflateCapped(raw, maxBytes) {
	try {
		return raw[0] === GZIP_MAGIC_FIRST && raw[1] === GZIP_MAGIC_SECOND ? gunzipSync(raw, { maxOutputLength: maxBytes }) : inflateSync(raw, { maxOutputLength: maxBytes });
	} catch (error) {
		if (error.code === "ERR_BUFFER_TOO_LARGE") throw new Error(`decoded body exceeds ${maxBytes} bytes`, { cause: error });
		throw error;
	}
}
/**
 * Decode a response body into JSON without trusting `content-encoding`.
 *
 * The body is read as bytes instead of through `response.json()` because this
 * process's global undici dispatcher may come from a different undici copy than
 * the one backing Node's built-in `fetch` — `@deepseek-ai/dsh-http-proxy`
 * installs exactly that, from its own bundled undici 8.x, so every plain
 * `fetch()` in the process runs against it. Across that version boundary the
 * built-in fetch hands back the still-compressed stream and `content-encoding`
 * is not even readable, which made `response.json()` parse gzip bytes and every
 * search fail as "unprocessable response body". Magic bytes are the only
 * signal that survives the boundary, so compressed bodies are inflated here.
 *
 * Both stages are capped (see MAX_RESPONSE_BYTES / MAX_DECODED_BYTES) so a
 * decompression bomb fails fast as an unprocessable body instead of exhausting
 * memory on the event loop.
 *
 * @param response - the response whose body to decode.
 * @returns the parsed body.
 * @throws {SyntaxError} when the decoded body is not JSON.
 * @throws {Error} when the body or its decoded size exceeds the caps, or a
 *   body that looks compressed cannot be inflated.
 */
async function readJsonResponse(response) {
	const raw = await readBodyCapped(response, MAX_RESPONSE_BYTES);
	const isCompressed = (raw[0] === GZIP_MAGIC_FIRST && raw[1] === GZIP_MAGIC_SECOND) || isZlibStream(raw);
	const json = isCompressed ? inflateCapped(raw, MAX_DECODED_BYTES) : raw;
	return JSON.parse(json.toString("utf8"));
}
//#endregion

//#region provider
/**
 * The OpenAI-compatible search provider. Each search POSTs a Responses API
 * request with the built-in `web_search` tool; the seam owns `maxResults`
 * truncation, so `truncated` is always `false` here.
 */
var OpenAiSearchProvider = class {
	/**
	 * @param resolveOptions - the options for the NEXT operation, snapshotted
	 * once at each operation's entry so one search never mixes two sections.
	 * A thunk rather than a value because the plugin's settings section can
	 * change between searches, and re-registering the provider to carry a new
	 * endpoint would make the seam's selection observable as a flicker.
	 */
	constructor(resolveOptions) {
		this.resolveOptions = resolveOptions;
		this.id = PROVIDER_ID;
	}
	available() {
		const options = this.resolveOptions();
		return ((options.apiKey?.length ?? 0) > 0 || options.resolveApiKey !== void 0) && URL.canParse(options.baseURL) && isPositiveInteger(options.maxOutputTokens) && isResultCount(options.count) && isPositiveInteger(options.maxUses) && (options.apiVersion?.length ?? 0) > 0;
	}
	async search(request, signal) {
		const options = this.resolveOptions();
		const apiKey = await this.apiKey(options, signal);
		throwIfSearchAborted(signal);
		if (isAnthropicMode(options.mode)) return this.searchAnthropicMessages(options, apiKey, request, signal);
		if (options.mode === "zhipu-web-search") return this.searchZhipuWebSearch(options, apiKey, request, signal);
		if (options.mode === "zhipu-chat-search") return this.searchZhipuChatSearch(options, apiKey, request, signal);
		return this.searchResponses(options, apiKey, request, signal);
	}
	/**
	 * `responses` mode: one Responses API turn with the built-in `web_search`
	 * tool. This is the provider's historical behavior, unchanged.
	 */
	async searchResponses(options, apiKey, request, signal) {
		const endpoint = `${options.baseURL}/responses`;
		const body = {
			model: options.model,
			input: [{
				role: "user",
				content: [{
					type: "input_text",
					text: `Perform a web search for the query: ${request.query}`
				}]
			}],
			store: false,
			tools: [{ type: "web_search" }],
			max_output_tokens: options.maxOutputTokens,
			/**
			 * OpenAI-standard reasoning knob, sent only when explicitly set:
			 * gateways that do not implement the parameter may reject unknown
			 * fields outright, so the default keeps the historical body exact.
			 */
			...(options.responsesReasoningEffort.length > 0 ? { reasoning: { effort: options.responsesReasoningEffort } } : {})
		};
		const data = await this.postJson(endpoint, apiKey, body, signal);
		try {
			return mapResponsesResponse(data);
		} catch (error) {
			if (signal?.aborted === true || isAbortError(error)) throw searchAborted(signal, error);
			if (error instanceof WebError) throw error;
			throw new WebError(`web search returned an unprocessable response body: ${String(error)}`, "WEB_PROVIDER_ERROR", { cause: error });
		}
	}
	/**
	 * `anthropic-messages` mode: one Anthropic-compatible Messages turn carrying
	 * the native `web_search_20250305` server tool. This mirrors the shipped
	 * DeepSeek search provider's wire format — including the dual
	 * `x-api-key` + `Bearer` credential headers — so a deployment already
	 * holding `DEEPSEEK_API_KEY` (and optionally a `DEEPSEEK_SEARCH_BASE_URL`
	 * endpoint) keeps working when it switches to this mode.
	 */
	async searchAnthropicMessages(options, apiKey, request, signal) {
		const endpoint = `${options.baseURL}/messages`;
		const body = {
			model: options.model,
			max_tokens: options.maxOutputTokens,
			messages: [{
				role: "user",
				content: [{
					type: "text",
					text: `Perform a web search for the query: ${request.query}`
				}]
			}],
			tools: [{
				type: "web_search_20250305",
				name: "web_search",
				max_uses: options.maxUses
			}],
			/**
			 * Thinking switch. `default` omits the field entirely: the endpoint
			 * accepts either form, and omitting it keeps the body identical to the
			 * shipped provider's for deployments that never touch this knob.
			 */
			...options.anthropicThinking === "disabled" ? { thinking: { type: "disabled" } } : {}
		};
		options.recordRequest?.({
			endpoint,
			apiVersion: options.apiVersion,
			body
		});
		const data = await this.postJson(endpoint, apiKey, body, signal, {
			"x-api-key": apiKey,
			...options.apiVersion.length > 0 ? { "anthropic-version": options.apiVersion } : {}
		});
		try {
			return mapAnthropicResponse(data);
		} catch (error) {
			if (signal?.aborted === true || isAbortError(error)) throw searchAborted(signal, error);
			if (error instanceof WebError) throw error;
			throw new WebError(`web search returned an unprocessable response body: ${String(error)}`, "WEB_PROVIDER_ERROR", { cause: error });
		}
	}
	/**
	 * `zhipu-web-search` mode: the raw Web Search API. No model is involved;
	 * the structured `search_result[]` entries become the sources directly and
	 * a compact digest of the top entries becomes `content`.
	 */
	async searchZhipuWebSearch(options, apiKey, request, signal) {
		const endpoint = `${options.baseURL}/web_search`;
		const body = {
			search_query: request.query,
			search_engine: options.searchEngine,
			search_intent: options.searchIntent === true,
			count: resolveCount(request, options),
			...(options.searchDomainFilter.length > 0 ? { search_domain_filter: options.searchDomainFilter } : {}),
			search_recency_filter: options.searchRecencyFilter,
			content_size: options.contentSize
		};
		const data = await this.postJson(endpoint, apiKey, body, signal);
		try {
			return mapZhipuWebSearchResponse(data);
		} catch (error) {
			if (signal?.aborted === true || isAbortError(error)) throw searchAborted(signal, error);
			if (error instanceof WebError) throw error;
			throw new WebError(`web search returned an unprocessable response body: ${String(error)}`, "WEB_PROVIDER_ERROR", { cause: error });
		}
	}
	/**
	 * `zhipu-chat-search` mode: one Chat Completions turn whose `web_search`
	 * tool fuses live results into the grounded answer. `search_result: true`
	 * asks the endpoint to also return the source details the answer cites.
	 */
	async searchZhipuChatSearch(options, apiKey, request, signal) {
		const endpoint = `${options.baseURL}/chat/completions`;
		const body = {
			model: options.model,
			messages: [{ role: "user", content: request.query }],
			tools: [{
				type: "web_search",
				web_search: {
					enable: true,
					search_engine: options.searchEngine,
					search_intent: options.searchIntent === true ? "true" : "false",
					count: resolveCount(request, options),
					...(options.searchDomainFilter.length > 0 ? { search_domain_filter: options.searchDomainFilter } : {}),
					search_recency_filter: options.searchRecencyFilter,
					content_size: options.contentSize,
					search_result: true,
					...(options.searchPrompt.length > 0 ? { search_prompt: options.searchPrompt } : {})
				}
			}],
			/**
			 * Thinking-effort knob for the chat turn (`reasoning_effort`, GLM-5.2+
			 * semantics; older models tolerate it as a no-op — verified live
			 * against `glm-4-flash`). Defaulting to `low` keeps a thinking-only
			 * model like GLM-5.3-Flash fast while leaving deeper reasoning one
			 * setting away.
			 */
			reasoning_effort: options.reasoningEffort,
			max_tokens: options.maxOutputTokens
		};
		const data = await this.postJson(endpoint, apiKey, body, signal);
		try {
			return mapZhipuChatResponse(data);
		} catch (error) {
			if (signal?.aborted === true || isAbortError(error)) throw searchAborted(signal, error);
			if (error instanceof WebError) throw error;
			throw new WebError(`web search returned an unprocessable response body: ${String(error)}`, "WEB_PROVIDER_ERROR", { cause: error });
		}
	}
	/**
	 * POST one JSON body and return the parsed response, mapping transport and
	 * HTTP-level failures onto the provider's stable error codes. The abort
	 * semantics match the historical `search` implementation exactly.
	 *
	 * @param endpoint - absolute request URL.
	 * @param apiKey - resolved credential; always sent as `authorization: Bearer`.
	 * @param body - JSON request body.
	 * @param signal - cancellation signal for the surrounding search.
	 * @param extraHeaders - protocol-specific headers (the Anthropic modes add
	 *   `x-api-key` and `anthropic-version`); undefined values are dropped.
	 */
	async postJson(endpoint, apiKey, body, signal, extraHeaders = {}) {
		let response;
		try {
			response = await fetch(endpoint, {
				method: "POST",
				redirect: "error",
				headers: {
					authorization: `Bearer ${apiKey}`,
					...Object.fromEntries(Object.entries(extraHeaders).filter(([, value]) => value !== void 0)),
					"content-type": "application/json",
					accept: "application/json",
					/**
					 * Ask gateways not to compress at all. This is the primary fix
					 * for the cross-undici dispatcher issue (see readJsonResponse);
					 * the magic-byte inflation there stays as the safety net for
					 * gateways that compress regardless.
					 */
					"accept-encoding": "identity",
					"user-agent": USER_AGENT
				},
				body: JSON.stringify(body),
				...signal !== void 0 ? { signal } : {}
			});
		} catch (error) {
			if (signal?.aborted === true || isAbortError(error)) throw searchAborted(signal, error);
			throw new WebError(`web search request failed: ${String(error)}`, "WEB_PROVIDER_ERROR", { cause: error });
		}
		if (!response.ok) {
			let message = `web search API error (HTTP ${response.status})`;
			try {
				const parsed = await readJsonResponse(response);
				const detail = typeof parsed.error === "string" ? parsed.error : parsed.error?.message ?? parsed.message;
				if (detail !== void 0 && detail.length > 0) message = detail;
			} catch (error) {
				if (signal?.aborted === true || isAbortError(error)) throw searchAborted(signal, error);
			}
			throw new WebError(message, "WEB_PROVIDER_ERROR");
		}
		try {
			return await readJsonResponse(response);
		} catch (error) {
			if (signal?.aborted === true || isAbortError(error)) throw searchAborted(signal, error);
			throw new WebError(`web search returned an unprocessable response body: ${String(error)}`, "WEB_PROVIDER_ERROR", { cause: error });
		}
	}
	/**
	 * Resolve one operation's credential without retaining it on the provider.
	 * @param options - the caller's snapshot, so the key and the endpoint it is sent to come from one section.
	 * @param signal - abort signal for the surrounding search.
	 * @returns the resolved key.
	 */
	async apiKey(options, signal) {
		throwIfSearchAborted(signal);
		if (options.apiKey !== void 0 && options.apiKey.length > 0) return options.apiKey;
		let resolved;
		try {
			resolved = await abortable(options.resolveApiKey?.() ?? Promise.resolve(void 0), signal);
		} catch (error) {
			if (signal?.aborted === true || isAbortError(error)) throw searchAborted(signal, error);
			throw new WebError(`web search credential resolution failed: ${String(error)}`, "WEB_PROVIDER_ERROR", { cause: error });
		}
		if (resolved !== void 0 && resolved.length > 0) return resolved;
		const candidates = [options.apiKeyEnv ?? DEFAULT_API_KEY_ENV, ...(options.apiKeyEnvFallbacks ?? [])].map((ref) => `"${String(ref)}"`).join(" or ");
		throw new WebError(`web search has no API key for ${candidates}; store it through the credentials service (the web Models page writes it), export it in the launching environment, or set a literal "apiKey" in the web-search-diy config`, "WEB_PROVIDER_CREDENTIAL_MISSING");
	}
};
/**
 * Race a same-process asynchronous preflight against caller cancellation. The
 * attached settlement handlers keep observing an uncooperative operation after
 * abort so a later rejection cannot become unhandled.
 */
function abortable(operation, signal) {
	if (signal === void 0) return operation;
	if (signal.aborted) return Promise.reject(searchAborted(signal));
	return new Promise((resolve, reject) => {
		const onAbort = () => {
			reject(searchAborted(signal));
		};
		signal.addEventListener("abort", onAbort, { once: true });
		operation.then((value) => {
			signal.removeEventListener("abort", onAbort);
			resolve(value);
		}, (error) => {
			signal.removeEventListener("abort", onAbort);
			reject(new Error(String(error).replace(/^Error: /u, ""), { cause: error }));
		});
	});
}
/** Throw the provider's stable cancellation error when the caller already aborted. */
function throwIfSearchAborted(signal) {
	if (signal?.aborted === true) throw searchAborted(signal);
}
/** Build the provider's stable cancellation error while retaining the caller's reason. */
function searchAborted(signal, fallback) {
	return new WebError("web search aborted", "WEB_ABORTED", { cause: signal?.aborted === true ? signal.reason : fallback });
}
/** True for a fetch/`AbortSignal` abort, surfaced as `WEB_ABORTED`. */
function isAbortError(error) {
	return error instanceof DOMException && error.name === "AbortError";
}
/** True for positive integer configuration values. */
function isPositiveInteger(value) {
	return Number.isInteger(value) && value > 0;
}
/** True for a Zhipu `count` value: an integer within the API's 1-50 range. */
function isResultCount(value) {
	return Number.isInteger(value) && value >= 1 && value <= 50;
}
/**
 * Resolve the Zhipu `count` for one search: the seam request's `maxResults`
 * when it carries a usable integer, otherwise the configured default, clamped
 * to the API's 1-50 range. The seam truncates `sources[]` itself, so an
 * over-large value only over-fetches, never breaks the contract.
 */
function resolveCount(request, options) {
	const requested = Number.isInteger(request?.maxResults) ? request.maxResults : options.count;
	return Math.min(Math.max(requested, 1), 50);
}
//#endregion

//#region plugin
/** Profile schema for the `web-search-diy` settings section / entry config. */
const Config = z.object({
	apiKey: z.string().role("secret"),
	/** Empty inherits the mode's default reference (see resolveOptions). */
	apiKeyEnv: z.string().role("credential-ref").default(""),
	/** Empty inherits the mode's default endpoint (see resolveOptions). */
	baseURL: z.string().default(""),
	mode: z.union(MODES.map((value) => z.const(value))).default(DEFAULT_MODE),
	/** Empty inherits the mode's default model (see resolveOptions). */
	model: z.string().default(""),
	maxOutputTokens: z.number().step(1).min(1).default(DEFAULT_MAX_OUTPUT_TOKENS),
	/** `anthropic-messages` mode: the `anthropic-version` header value. */
	apiVersion: z.string().default(DEEPSEEK_DEFAULT_API_VERSION),
	/** `anthropic-messages` mode: maximum `web_search` tool uses per request. */
	maxUses: z.number().step(1).min(1).default(DEEPSEEK_DEFAULT_MAX_USES),
	/** `anthropic-messages` mode: thinking switch; `default` sends no parameter. */
	anthropicThinking: z.union(ANTHROPIC_THINKING_MODES.map((value) => z.const(value))).default(DEFAULT_ANTHROPIC_THINKING),
	searchEngine: z.union(SEARCH_ENGINES.map((value) => z.const(value))).default("search_std"),
	count: z.number().step(1).min(1).max(50).default(DEFAULT_COUNT),
	searchRecencyFilter: z.union(RECENCY_FILTERS.map((value) => z.const(value))).default("noLimit"),
	contentSize: z.union(CONTENT_SIZES.map((value) => z.const(value))).default("medium"),
	reasoningEffort: z.union(REASONING_EFFORTS.map((value) => z.const(value))).default(DEFAULT_REASONING_EFFORT),
	/** Empty sends no `reasoning` parameter (gateway-agnostic default). */
	responsesReasoningEffort: z.union([z.const(""), ...RESPONSES_REASONING_EFFORTS.map((value) => z.const(value))]).default(""),
	searchDomainFilter: z.string().default(""),
	searchIntent: z.boolean().default(false),
	searchPrompt: z.string().default("")
});
/** Settings namespace carrying this provider's endpoint, model, and key reference. */
const SETTINGS_NAMESPACE = "web-search-diy";
/**
 * Configuration file path managed by the web configuration card
 * (`lib/web.js`): `$DSH_HOME/dsh-web-search-diy.json`.
 */
function configFilePath() {
	return join(process.env.DSH_HOME ?? join(homedir(), ".dsh"), "dsh-web-search-diy.json");
}
/**
 * Load the UI-managed configuration file. The web card's settings are the
 * highest-priority runtime source (UI file > settings section > defaults);
 * missing or unreadable files project an empty object.
 */
function loadFileConfig() {
	try {
		const data = JSON.parse(readFileSync(configFilePath(), "utf8"));
		return {
			...(typeof data.baseURL === "string" && data.baseURL.length > 0 ? { baseURL: data.baseURL } : {}),
			...(typeof data.apiKeyEnv === "string" && data.apiKeyEnv.length > 0 ? { apiKeyEnv: data.apiKeyEnv } : {}),
			...(MODES.includes(data.mode) ? { mode: data.mode } : {}),
			...(typeof data.model === "string" && data.model.length > 0 ? { model: data.model } : {}),
			...(Number.isInteger(data.maxOutputTokens) && data.maxOutputTokens > 0 ? { maxOutputTokens: data.maxOutputTokens } : {}),
			...(typeof data.apiVersion === "string" && data.apiVersion.length > 0 ? { apiVersion: data.apiVersion } : {}),
			...(Number.isInteger(data.maxUses) && data.maxUses > 0 ? { maxUses: data.maxUses } : {}),
			...(ANTHROPIC_THINKING_MODES.includes(data.anthropicThinking) ? { anthropicThinking: data.anthropicThinking } : {}),
			...(SEARCH_ENGINES.includes(data.searchEngine) ? { searchEngine: data.searchEngine } : {}),
			...(isResultCount(data.count) ? { count: data.count } : {}),
			...(RECENCY_FILTERS.includes(data.searchRecencyFilter) ? { searchRecencyFilter: data.searchRecencyFilter } : {}),
			...(CONTENT_SIZES.includes(data.contentSize) ? { contentSize: data.contentSize } : {}),
			...(REASONING_EFFORTS.includes(data.reasoningEffort) ? { reasoningEffort: data.reasoningEffort } : {}),
			...(RESPONSES_REASONING_EFFORTS.includes(data.responsesReasoningEffort) ? { responsesReasoningEffort: data.responsesReasoningEffort } : {}),
			...(typeof data.searchDomainFilter === "string" ? { searchDomainFilter: data.searchDomainFilter } : {}),
			...(typeof data.searchIntent === "boolean" ? { searchIntent: data.searchIntent } : {}),
			...(typeof data.searchPrompt === "string" ? { searchPrompt: data.searchPrompt } : {})
		};
	} catch {
		return {};
	}
}
/** 读取 JSON 请求体。 */
function readJsonBody(req) {
	return new Promise((resolve, reject) => {
		let raw = "";
		req.on("data", (chunk) => {
			raw += chunk;
		});
		req.on("end", () => {
			try {
				resolve(raw.length > 0 ? JSON.parse(raw) : {});
			} catch (error) {
				reject(error);
			}
		});
		req.on("error", reject);
	});
}
/** 统一 JSON 响应。 */
function sendJson(res, status, body) {
	const payload = JSON.stringify(body);
	res.writeHead(status, {
		"Content-Type": "application/json; charset=utf-8",
		"Content-Length": Buffer.byteLength(payload)
	});
	res.end(payload);
}
/**
 * True when any candidate reference resolves to a non-empty credential.
 *
 * The card must report "a key is configured" for the chain the provider will
 * actually try, otherwise a deployment whose key lives under
 * `ZAI_CODING_CN_API_KEY` would see "not configured" while searches succeed.
 *
 * @param ctx - plugin context supplying the credentials service.
 * @param refNames - candidate reference names, highest priority first.
 * @returns whether a usable credential exists.
 */
async function hasCredential(ctx, refNames) {
	const credentials = ctx.get("credentials");
	if (credentials === void 0) return false;
	for (const name of refNames) {
		try {
			const resolved = await credentials.resolve(credentialRef(name));
			if (resolved?.value != null && resolved.value.length > 0) return true;
		} catch {
			// An unresolvable reference is simply not this candidate.
		}
	}
	return false;
}
/**
 * Register the configuration HTTP endpoint on the webServer service (web
 * profiles only). The UI-managed file is the highest-priority runtime
 * config source; API keys go through the credentials seam only.
 * @param ctx - plugin context (credentials via `ctx.get`).
 * @param webServer - the host webserver service.
 */
function registerConfigEndpoint(ctx, webServer) {
	webServer.register({
		kind: "exact",
		path: "/api/web-search-diy/config",
		handler: async (req, res) => {
			if (req.method === "GET") {
				const config = loadFileConfig();
				const keyConfigured = await hasCredential(ctx, apiKeyEnvCandidates(config.apiKeyEnv, config.mode ?? DEFAULT_MODE));
				return sendJson(res, 200, { ...config, keyConfigured });
			}
			if (req.method === "POST") {
				let body;
				try {
					body = await readJsonBody(req);
				} catch {
					return sendJson(res, 400, { error: "请求体不是合法 JSON" });
				}
				if (body === null || typeof body !== "object") {
					return sendJson(res, 400, { error: "请求体必须是 JSON 对象" });
				}
				const patch = {};
				if (typeof body.mode === "string" && body.mode.trim().length > 0) {
					if (!MODES.includes(body.mode.trim())) return sendJson(res, 400, { error: `mode 必须是 ${MODES.join(" / ")} 之一` });
					patch.mode = body.mode.trim();
				}
				if (typeof body.searchEngine === "string" && body.searchEngine.trim().length > 0) {
					if (!SEARCH_ENGINES.includes(body.searchEngine.trim())) return sendJson(res, 400, { error: `searchEngine 必须是 ${SEARCH_ENGINES.join(" / ")} 之一` });
					patch.searchEngine = body.searchEngine.trim();
				}
				if (body.count !== void 0) {
					const n = Number(body.count);
					if (!Number.isInteger(n) || n < 1 || n > 50) return sendJson(res, 400, { error: "count 必须是 1-50 的整数" });
					patch.count = n;
				}
				if (typeof body.searchRecencyFilter === "string" && body.searchRecencyFilter.trim().length > 0) {
					if (!RECENCY_FILTERS.includes(body.searchRecencyFilter.trim())) return sendJson(res, 400, { error: `searchRecencyFilter 必须是 ${RECENCY_FILTERS.join(" / ")} 之一` });
					patch.searchRecencyFilter = body.searchRecencyFilter.trim();
				}
				if (typeof body.contentSize === "string" && body.contentSize.trim().length > 0) {
					if (!CONTENT_SIZES.includes(body.contentSize.trim())) return sendJson(res, 400, { error: `contentSize 必须是 ${CONTENT_SIZES.join(" / ")} 之一` });
					patch.contentSize = body.contentSize.trim();
				}
				if (typeof body.reasoningEffort === "string" && body.reasoningEffort.trim().length > 0) {
					if (!REASONING_EFFORTS.includes(body.reasoningEffort.trim())) return sendJson(res, 400, { error: `reasoningEffort 必须是 ${REASONING_EFFORTS.join(" / ")} 之一` });
					patch.reasoningEffort = body.reasoningEffort.trim();
				}
				if (typeof body.responsesReasoningEffort === "string") {
					const value = body.responsesReasoningEffort.trim();
					if (value.length > 0 && !RESPONSES_REASONING_EFFORTS.includes(value)) return sendJson(res, 400, { error: `responsesReasoningEffort 必须是 ${RESPONSES_REASONING_EFFORTS.join(" / ")} 之一或留空` });
					patch.responsesReasoningEffort = value;
				}
				if (typeof body.searchDomainFilter === "string") patch.searchDomainFilter = body.searchDomainFilter.trim();
				if (typeof body.searchIntent === "boolean") patch.searchIntent = body.searchIntent;
				if (typeof body.searchPrompt === "string") patch.searchPrompt = body.searchPrompt.trim();
				if (typeof body.baseURL === "string" && body.baseURL.trim().length > 0) patch.baseURL = body.baseURL.trim();
				if (typeof body.apiKeyEnv === "string" && body.apiKeyEnv.trim().length > 0) patch.apiKeyEnv = body.apiKeyEnv.trim();
				if (typeof body.model === "string" && body.model.trim().length > 0) patch.model = body.model.trim();
				if (body.maxOutputTokens !== void 0) {
					const n = Number(body.maxOutputTokens);
					if (!Number.isInteger(n) || n < 1) return sendJson(res, 400, { error: "maxOutputTokens 必须是正整数" });
					patch.maxOutputTokens = n;
				}
				if (typeof body.apiVersion === "string" && body.apiVersion.trim().length > 0) patch.apiVersion = body.apiVersion.trim();
				if (body.maxUses !== void 0) {
					const n = Number(body.maxUses);
					if (!Number.isInteger(n) || n < 1) return sendJson(res, 400, { error: "maxUses 必须是正整数" });
					patch.maxUses = n;
				}
				if (typeof body.anthropicThinking === "string" && body.anthropicThinking.trim().length > 0) {
					if (!ANTHROPIC_THINKING_MODES.includes(body.anthropicThinking.trim())) return sendJson(res, 400, { error: `anthropicThinking 必须是 ${ANTHROPIC_THINKING_MODES.join(" / ")} 之一` });
					patch.anthropicThinking = body.anthropicThinking.trim();
				}
				if (typeof body.apiKey === "string" && body.apiKey.length > 0) {
					const credentials = ctx.get("credentials");
					if (credentials === void 0) return sendJson(res, 400, { error: "credentials 服务不可用，无法保存 API key" });
					const envName = patch.apiKeyEnv ?? loadFileConfig().apiKeyEnv ?? MODE_PROFILES[patch.mode ?? loadFileConfig().mode ?? DEFAULT_MODE].apiKeyEnv;
					try {
						await credentials.set(credentialRef(envName), body.apiKey);
					} catch (error) {
						return sendJson(res, 400, { error: `API key 保存失败: ${String(error)}` });
					}
				}
				const config = saveFileConfig(patch);
				const keyConfigured = await hasCredential(ctx, apiKeyEnvCandidates(config.apiKeyEnv, config.mode ?? DEFAULT_MODE));
				return sendJson(res, 200, { ok: true, keyConfigured });
			}
			return sendJson(res, 405, { error: "仅支持 GET / POST" });
		}
	});
}
/**
 * Merge and persist the UI-managed configuration file. Returns the merged
 * config (used for the keyConfigured echo).
 */
function saveFileConfig(partial) {
	const merged = { ...loadFileConfig(), ...partial };
	mkdirSync(dirname(configFilePath()), { recursive: true });
	writeFileSync(configFilePath(), JSON.stringify(merged, null, 2) + "\n");
	return merged;
}
/**
 * Project one resolved section into the options the provider serves its next
 * search with. Environment fallbacks stay here rather than in the provider:
 * every value it reads is already fully defaulted. Precedence: UI-managed
 * file (web card) > settings section > mode defaults.
 *
 * Endpoint, credential reference, and model are mode-scoped: an empty value
 * inherits the current mode's default, and a section value that is another
 * mode's default counts as a schema-default fossil rather than a choice (see
 * `pickModeScoped`), so switching modes without ever editing the field lands on
 * the new mode's default instead of the previous mode's endpoint.
 * @param ctx - plugin context supplying the credential and environment planes.
 * @param config - the currently authoritative section.
 * @returns options for one search.
 */
function resolveOptions(ctx, config) {
	const file = loadFileConfig();
	const mode = file.mode ?? config.mode ?? DEFAULT_MODE;
	const profile = MODE_PROFILES[mode];
	const apiKeyEnvNames = apiKeyEnvCandidates(file.apiKeyEnv ?? pickModeScoped(config.apiKeyEnv, "apiKeyEnv", mode), mode);
	const apiKeyEnv = credentialRef(apiKeyEnvNames[0]);
	const apiKeyEnvFallbacks = apiKeyEnvNames.slice(1).map((name) => credentialRef(name));
	const literalApiKey = config.apiKey !== void 0 && config.apiKey.length > 0 ? config.apiKey : void 0;
	const envBaseURL = isAnthropicMode(mode) ? launchEnvironmentOf(ctx).get(SEARCH_BASE_URL_ENV)?.value : void 0;
	return {
		...literalApiKey === void 0 ? {} : { apiKey: literalApiKey },
		resolveApiKey: async () => {
			const credentials = ctx.get("credentials");
			if (credentials !== void 0) {
				for (const ref of [apiKeyEnv, ...apiKeyEnvFallbacks]) {
					const value = (await credentials.resolve(ref))?.value;
					if (value !== void 0 && value.length > 0) return value;
				}
				return void 0;
			}
			const environment = launchEnvironmentOf(ctx);
			for (const ref of [apiKeyEnv, ...apiKeyEnvFallbacks]) {
				const ambient = environment.get(ref);
				if (ambient !== void 0 && ambient.value.length > 0) return ambient.value;
			}
			return void 0;
		},
		apiKeyEnv,
		apiKeyEnvFallbacks,
		mode,
		baseURL: (file.baseURL ?? pickModeScoped(config.baseURL, "baseURL", mode) ?? (envBaseURL !== void 0 && envBaseURL.length > 0 ? envBaseURL : void 0) ?? profile.baseURL).replace(/\/+$/u, ""),
		model: file.model ?? pickModeScoped(config.model, "model", mode) ?? profile.model,
		apiVersion: file.apiVersion ?? config.apiVersion ?? DEEPSEEK_DEFAULT_API_VERSION,
		maxUses: file.maxUses ?? config.maxUses ?? DEEPSEEK_DEFAULT_MAX_USES,
		anthropicThinking: file.anthropicThinking ?? config.anthropicThinking ?? DEFAULT_ANTHROPIC_THINKING,
		maxOutputTokens: file.maxOutputTokens ?? pickMaxOutputTokens(config.maxOutputTokens, mode) ?? profile.maxOutputTokens,
		searchEngine: file.searchEngine ?? config.searchEngine ?? "search_std",
		count: file.count ?? config.count ?? DEFAULT_COUNT,
		searchRecencyFilter: file.searchRecencyFilter ?? config.searchRecencyFilter ?? "noLimit",
		contentSize: file.contentSize ?? config.contentSize ?? "medium",
		reasoningEffort: file.reasoningEffort ?? config.reasoningEffort ?? DEFAULT_REASONING_EFFORT,
		responsesReasoningEffort: file.responsesReasoningEffort ?? config.responsesReasoningEffort ?? "",
		searchDomainFilter: file.searchDomainFilter ?? config.searchDomainFilter ?? "",
		searchIntent: file.searchIntent ?? config.searchIntent ?? false,
		searchPrompt: file.searchPrompt ?? config.searchPrompt ?? "",
		/**
		 * Record the outbound model request on the calling session, exactly as the
		 * shipped provider does, so a search stays auditable from the session log.
		 * Optional-chained because a headless composition mounts no agents service.
		 */
		recordRequest: (request) => {
			ctx.get("agents")?.currentInitiator()?.session.append("web/deepseek-search-llm-request", request);
		}
	};
}
/** Register the OpenAI-compatible search provider with `ctx.web`. */
function apply(ctx, config) {
	let current = () => config;
	ctx.inject(["settings"], (settingsCtx) => {
		settingsCtx.settings.installSection(ctx, SETTINGS_NAMESPACE, Config, config, {
			setSource: (source) => {
				current = source;
			},
			onChange: () => {}
		});
	});
	ctx.web.registerSearchProvider(new OpenAiSearchProvider(() => resolveOptions(ctx, current())));
	// The config endpoint rides the webServer service when it appears (web
	// profiles). Non-web compositions never provide webServer, so the inject
	// simply never fires — no dedicated row or disabled flag is needed.
	ctx.inject(["webServer"], (sctx) => {
		registerConfigEndpoint(sctx, sctx.webServer);
	});
}
//#endregion

export { Config, CONTENT_SIZES, DEFAULT_API_KEY_ENV, DEFAULT_BASE_URL, DEFAULT_COUNT, DEFAULT_MAX_OUTPUT_TOKENS, DEFAULT_MODE, DEFAULT_MODEL, DEEPSEEK_DEFAULT_API_KEY_ENV, DEEPSEEK_DEFAULT_API_VERSION, DEEPSEEK_DEFAULT_BASE_URL, DEEPSEEK_DEFAULT_MAX_USES, DEEPSEEK_DEFAULT_MODEL, MODES, OpenAiSearchProvider, PROVIDER_ID, RECENCY_FILTERS, SEARCH_ENGINES, SETTINGS_NAMESPACE, ZHIPU_DEFAULT_API_KEY_ENV, ZHIPU_DEFAULT_BASE_URL, ZHIPU_DEFAULT_CHAT_MODEL, apply, inject, mapAnthropicResponse, mapZhipuChatResponse, mapZhipuWebSearchResponse, name, resolveOptions };