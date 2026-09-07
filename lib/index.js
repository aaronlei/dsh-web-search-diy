/**
 * dsh-web-search-diy — web search provider for the DeepSeek Harness web
 * capability seam (`ctx.web`), speaking three selectable protocols (`mode`):
 *
 *   - `responses` (default): an OpenAI-compatible **Responses API** endpoint
 *     with the built-in `web_search` tool; `web_search_call` blocks normalize
 *     into seam-standard `WebSearchResult` sources. Works with any gateway
 *     implementing that surface:
 *       - Qwen Token Plan (Alibaba Cloud), verified: `deepseek-v4-flash-0731`
 *         on `token-plan.cn-beijing.maas.aliyuncs.com`
 *       - OpenAI (`api.openai.com`)
 *       - other OpenAI-compatible gateways that expose the same shape
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

//#region constants
/** Cordis plugin name used by loader diagnostics. */
const name = "web-search-diy";
/** The web seam this provider registers into. */
const inject = ["web"];
/** Stable id this provider registers under on the seam. */
const PROVIDER_ID = "diy-search";
/**
 * Search protocols this provider speaks. `responses` is the OpenAI-compatible
 * Responses API with the built-in `web_search` tool; the two `zhipu-*` modes
 * speak Zhipu BigModel services over the shared `https://open.bigmodel.cn/api/paas/v4`
 * base: `zhipu-web-search` is the raw Web Search API (`/web_search`), and
 * `zhipu-chat-search` is Web Search in Chat (`/chat/completions` with the
 * `web_search` tool).
 */
const MODES = ["responses", "zhipu-web-search", "zhipu-chat-search"];
/** Zhipu search engines shared by both zhipu modes (per-call pricing differs). */
const SEARCH_ENGINES = ["search_std", "search_pro", "search_pro_sogou", "search_pro_quark"];
/** Zhipu recency windows for `search_recency_filter`. */
const RECENCY_FILTERS = ["noLimit", "oneDay", "oneWeek", "oneMonth", "oneYear"];
/** Zhipu snippet sizes for `content_size`. */
const CONTENT_SIZES = ["medium", "high"];
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
/** Default model for `responses` mode; any Responses-API model exposing the `web_search` tool works. */
const DEFAULT_MODEL = "deepseek-v4-flash-0731";
/** Default model for `zhipu-chat-search` mode. */
const ZHIPU_DEFAULT_CHAT_MODEL = "glm-4-flash";
/** Default Zhipu result count when the seam request carries no `maxResults`. */
const DEFAULT_COUNT = 10;
/**
 * Default upper bound on generated tokens for one search call. Each search is
 * a full model turn (reasoning + tool use + grounded answer); this caps the
 * answer length, not the search itself.
 */
const DEFAULT_MAX_OUTPUT_TOKENS = 1024;
/** Attribution header sent on every request. Bump with the package version. */
const USER_AGENT = "dsh-web-search-diy/0.2.0";
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
		return ((options.apiKey?.length ?? 0) > 0 || options.resolveApiKey !== void 0) && URL.canParse(options.baseURL) && isPositiveInteger(options.maxOutputTokens) && isResultCount(options.count);
	}
	async search(request, signal) {
		const options = this.resolveOptions();
		const apiKey = await this.apiKey(options, signal);
		throwIfSearchAborted(signal);
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
			max_output_tokens: options.maxOutputTokens
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
	 */
	async postJson(endpoint, apiKey, body, signal) {
		let response;
		try {
			response = await fetch(endpoint, {
				method: "POST",
				redirect: "error",
				headers: {
					authorization: `Bearer ${apiKey}`,
					"content-type": "application/json",
					accept: "application/json",
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
				const parsed = await response.json();
				const detail = typeof parsed.error === "string" ? parsed.error : parsed.error?.message ?? parsed.message;
				if (detail !== void 0 && detail.length > 0) message = detail;
			} catch (error) {
				if (signal?.aborted === true || isAbortError(error)) throw searchAborted(signal, error);
			}
			throw new WebError(message, "WEB_PROVIDER_ERROR");
		}
		try {
			return await response.json();
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
		throw new WebError(`web search has no API key for "${options.apiKeyEnv ?? DEFAULT_API_KEY_ENV}"; store it through the credentials service (the web Models page writes it), export it in the launching environment, or set a literal "apiKey" in the web-search-diy config`, "WEB_PROVIDER_CREDENTIAL_MISSING");
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
	searchEngine: z.union(SEARCH_ENGINES.map((value) => z.const(value))).default("search_std"),
	count: z.number().step(1).min(1).max(50).default(DEFAULT_COUNT),
	searchRecencyFilter: z.union(RECENCY_FILTERS.map((value) => z.const(value))).default("noLimit"),
	contentSize: z.union(CONTENT_SIZES.map((value) => z.const(value))).default("medium"),
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
			...(SEARCH_ENGINES.includes(data.searchEngine) ? { searchEngine: data.searchEngine } : {}),
			...(isResultCount(data.count) ? { count: data.count } : {}),
			...(RECENCY_FILTERS.includes(data.searchRecencyFilter) ? { searchRecencyFilter: data.searchRecencyFilter } : {}),
			...(CONTENT_SIZES.includes(data.contentSize) ? { contentSize: data.contentSize } : {}),
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
				const isZhipu = (config.mode ?? DEFAULT_MODE) !== "responses";
				const envName = config.apiKeyEnv ?? (isZhipu ? ZHIPU_DEFAULT_API_KEY_ENV : DEFAULT_API_KEY_ENV);
				let keyConfigured = false;
				const credentials = ctx.get("credentials");
				if (credentials !== void 0) {
					try {
						const ref = credentialRef(envName);
						const resolved = await credentials.resolve(ref);
						keyConfigured = resolved?.value != null && resolved.value.length > 0;
					} catch {
						keyConfigured = false;
					}
				}
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
				if (typeof body.apiKey === "string" && body.apiKey.length > 0) {
					const credentials = ctx.get("credentials");
					if (credentials === void 0) return sendJson(res, 400, { error: "credentials 服务不可用，无法保存 API key" });
					const isZhipu = (patch.mode ?? loadFileConfig().mode ?? DEFAULT_MODE) !== "responses";
					const envName = patch.apiKeyEnv ?? loadFileConfig().apiKeyEnv ?? (isZhipu ? ZHIPU_DEFAULT_API_KEY_ENV : DEFAULT_API_KEY_ENV);
					try {
						await credentials.set(credentialRef(envName), body.apiKey);
					} catch (error) {
						return sendJson(res, 400, { error: `API key 保存失败: ${String(error)}` });
					}
				}
				const config = saveFileConfig(patch);
				const isZhipuAfter = (config.mode ?? DEFAULT_MODE) !== "responses";
				const envNameAfter = config.apiKeyEnv ?? (isZhipuAfter ? ZHIPU_DEFAULT_API_KEY_ENV : DEFAULT_API_KEY_ENV);
				let keyConfigured = false;
				const credentials = ctx.get("credentials");
				if (credentials !== void 0) {
					try {
						const resolved = await credentials.resolve(credentialRef(envNameAfter));
						keyConfigured = resolved?.value != null && resolved.value.length > 0;
					} catch {
						keyConfigured = false;
					}
				}
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
 * inherits the current mode's default. A section value that equals the
 * historical `responses`-mode default is treated as a schema-default fossil
 * rather than a choice, so switching to a zhipu mode without ever editing the
 * field lands on the zhipu default instead of the Qwen endpoint.
 * @param ctx - plugin context supplying the credential and environment planes.
 * @param config - the currently authoritative section.
 * @returns options for one search.
 */
function resolveOptions(ctx, config) {
	const file = loadFileConfig();
	const mode = file.mode ?? config.mode ?? DEFAULT_MODE;
	const isZhipu = mode !== "responses";
	const explicitBaseURL = file.baseURL ?? (config.baseURL !== void 0 && config.baseURL.length > 0 && !(isZhipu && config.baseURL === DEFAULT_BASE_URL) ? config.baseURL : void 0);
	const apiKeyEnvName = file.apiKeyEnv ?? (config.apiKeyEnv !== void 0 && config.apiKeyEnv.length > 0 && !(isZhipu && config.apiKeyEnv === DEFAULT_API_KEY_ENV) ? config.apiKeyEnv : void 0) ?? (isZhipu ? ZHIPU_DEFAULT_API_KEY_ENV : DEFAULT_API_KEY_ENV);
	const apiKeyEnv = credentialRef(apiKeyEnvName);
	const literalApiKey = config.apiKey !== void 0 && config.apiKey.length > 0 ? config.apiKey : void 0;
	return {
		...literalApiKey === void 0 ? {} : { apiKey: literalApiKey },
		resolveApiKey: async () => {
			const credentials = ctx.get("credentials");
			if (credentials !== void 0) return (await credentials.resolve(apiKeyEnv))?.value;
			const ambient = launchEnvironmentOf(ctx).get(apiKeyEnv);
			return ambient !== void 0 && ambient.value.length > 0 ? ambient.value : void 0;
		},
		apiKeyEnv,
		mode,
		baseURL: (explicitBaseURL ?? (isZhipu ? ZHIPU_DEFAULT_BASE_URL : DEFAULT_BASE_URL)).replace(/\/+$/u, ""),
		model: file.model ?? (config.model !== void 0 && config.model.length > 0 && !(isZhipu && config.model === DEFAULT_MODEL) ? config.model : void 0) ?? (isZhipu ? ZHIPU_DEFAULT_CHAT_MODEL : DEFAULT_MODEL),
		maxOutputTokens: file.maxOutputTokens ?? config.maxOutputTokens ?? DEFAULT_MAX_OUTPUT_TOKENS,
		searchEngine: file.searchEngine ?? config.searchEngine ?? "search_std",
		count: file.count ?? config.count ?? DEFAULT_COUNT,
		searchRecencyFilter: file.searchRecencyFilter ?? config.searchRecencyFilter ?? "noLimit",
		contentSize: file.contentSize ?? config.contentSize ?? "medium",
		searchDomainFilter: file.searchDomainFilter ?? config.searchDomainFilter ?? "",
		searchIntent: file.searchIntent ?? config.searchIntent ?? false,
		searchPrompt: file.searchPrompt ?? config.searchPrompt ?? ""
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

export { Config, CONTENT_SIZES, DEFAULT_API_KEY_ENV, DEFAULT_BASE_URL, DEFAULT_COUNT, DEFAULT_MAX_OUTPUT_TOKENS, DEFAULT_MODE, DEFAULT_MODEL, MODES, OpenAiSearchProvider, PROVIDER_ID, RECENCY_FILTERS, SEARCH_ENGINES, SETTINGS_NAMESPACE, ZHIPU_DEFAULT_API_KEY_ENV, ZHIPU_DEFAULT_BASE_URL, ZHIPU_DEFAULT_CHAT_MODEL, apply, inject, mapZhipuChatResponse, mapZhipuWebSearchResponse, name, resolveOptions };