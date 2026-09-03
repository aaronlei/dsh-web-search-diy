/**
 * dsh-web-search-diy — OpenAI-compatible web search provider for the
 * DeepSeek Harness web capability seam (`ctx.web`).
 *
 * It calls an OpenAI-compatible **Responses API** endpoint with the built-in
 * `web_search` tool, then normalizes the returned `web_search_call` blocks into
 * seam-standard `WebSearchResult` sources. This protocol works with any gateway
 * that implements the Responses API surface with a `web_search` tool:
 *
 *   - Qwen Token Plan (Alibaba Cloud), verified: `deepseek-v4-flash-0731`
 *     on `token-plan.cn-beijing.maas.aliyuncs.com`
 *   - OpenAI (`api.openai.com`)
 *   - other OpenAI-compatible gateways that expose the same shape
 *
 * IMPORTANT: built-in web search on Qwen Token Plan only triggers through the
 * Responses API (`/responses`) with an explicit `tools: [{type: "web_search"}]`
 * declaration — the Chat Completions `enable_search` flag is silently ignored
 * on that gateway.
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
/** Default endpoint: Qwen Token Plan (CN) OpenAI-compatible base; `/responses` is appended. */
const DEFAULT_BASE_URL = "https://token-plan.cn-beijing.maas.aliyuncs.com/compatible-mode/v1";
/** Default credential reference resolved per search. */
const DEFAULT_API_KEY_ENV = "QWEN_TOKEN_PLAN_CN_API_KEY";
/** Default model; any Responses-API model exposing the `web_search` tool works. */
const DEFAULT_MODEL = "deepseek-v4-flash-0731";
/**
 * Default upper bound on generated tokens for one search call. Each search is
 * a full model turn (reasoning + tool use + grounded answer); this caps the
 * answer length, not the search itself.
 */
const DEFAULT_MAX_OUTPUT_TOKENS = 1024;
/** Attribution header sent on every request. Bump with the package version. */
const USER_AGENT = "dsh-web-search-diy/0.1.0";
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
		return ((options.apiKey?.length ?? 0) > 0 || options.resolveApiKey !== void 0) && URL.canParse(options.baseURL) && isPositiveInteger(options.maxOutputTokens);
	}
	async search(request, signal) {
		const options = this.resolveOptions();
		const apiKey = await this.apiKey(options, signal);
		throwIfSearchAborted(signal);
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
		throwIfSearchAborted(signal);
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
			return mapResponsesResponse(await response.json());
		} catch (error) {
			if (signal?.aborted === true || isAbortError(error)) throw searchAborted(signal, error);
			if (error instanceof WebError) throw error;
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
//#endregion

//#region plugin
/** Profile schema for the `web-search-diy` settings section / entry config. */
const Config = z.object({
	apiKey: z.string().role("secret"),
	apiKeyEnv: z.string().role("credential-ref").default(DEFAULT_API_KEY_ENV),
	baseURL: z.string().default(DEFAULT_BASE_URL),
	model: z.string().default(DEFAULT_MODEL),
	maxOutputTokens: z.number().step(1).min(1).default(DEFAULT_MAX_OUTPUT_TOKENS)
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
			...(typeof data.model === "string" && data.model.length > 0 ? { model: data.model } : {}),
			...(Number.isInteger(data.maxOutputTokens) && data.maxOutputTokens > 0 ? { maxOutputTokens: data.maxOutputTokens } : {})
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
				let keyConfigured = false;
				const credentials = ctx.get("credentials");
				if (credentials !== void 0) {
					try {
						const ref = credentialRef(config.apiKeyEnv ?? DEFAULT_API_KEY_ENV);
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
					const envName = patch.apiKeyEnv ?? loadFileConfig().apiKeyEnv ?? DEFAULT_API_KEY_ENV;
					try {
						await credentials.set(credentialRef(envName), body.apiKey);
					} catch (error) {
						return sendJson(res, 400, { error: `API key 保存失败: ${String(error)}` });
					}
				}
				const config = saveFileConfig(patch);
				let keyConfigured = false;
				const credentials = ctx.get("credentials");
				if (credentials !== void 0) {
					try {
						const resolved = await credentials.resolve(credentialRef(config.apiKeyEnv ?? DEFAULT_API_KEY_ENV));
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
 * file (web card) > settings section > package defaults.
 * @param ctx - plugin context supplying the credential and environment planes.
 * @param config - the currently authoritative section.
 * @returns options for one search.
 */
function resolveOptions(ctx, config) {
	const file = loadFileConfig();
	const apiKeyEnv = credentialRef(file.apiKeyEnv ?? config.apiKeyEnv ?? DEFAULT_API_KEY_ENV);
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
		baseURL: (file.baseURL ?? config.baseURL ?? DEFAULT_BASE_URL).replace(/\/+$/u, ""),
		model: file.model ?? config.model ?? DEFAULT_MODEL,
		maxOutputTokens: file.maxOutputTokens ?? config.maxOutputTokens ?? DEFAULT_MAX_OUTPUT_TOKENS
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

export { Config, DEFAULT_API_KEY_ENV, DEFAULT_BASE_URL, DEFAULT_MAX_OUTPUT_TOKENS, DEFAULT_MODEL, OpenAiSearchProvider, PROVIDER_ID, SETTINGS_NAMESPACE, apply, inject, name };