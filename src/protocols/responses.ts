/**
 * OpenAI 兼容 Responses API 协议：请求构造 + 响应映射。
 *
 * 搜索通过声明内置 `web_search` 工具触发，`web_search_call` 块归一化成 seam 的
 * `WebSearchResult.sources`。
 *
 * @module dsh-web-search-diy/protocols/responses
 */
import { WebError } from "@deepseek-ai/dsh-web";
import type { WebSearchRequest, WebSearchResult } from "@deepseek-ai/dsh-web";
import { hasField, splitList } from "../catalog.ts";
import { normalizeSourceUrl, type MutableSource } from "../mappers/sources.ts";
import type { SearchOptions } from "../types.ts";
import { isAbortError, postWithReasoningFallback, searchAborted } from "../transport.ts";
import { asArray, asRecord, asString } from "../wire.ts";

/** True for the official block type or a namespaced server tool (`openrouter:web_search`). */
function isWebSearchBlock(type: string): boolean {
	return type === "web_search_call" || type.endsWith(":web_search");
}

/**
 * 把 OpenAI 兼容 Responses API 响应体归一化成 seam 标准 `WebSearchResult`。
 *
 * 来源按 URL 去重，依次取自：
 * - `action.sources[]`（`{type:"url", url, title?}`），OpenAI / Kimi / 千问形状；
 * - `action.type` 为 `open_page` / `find_in_page` 时的 `action.url`，DeepSeek 形状；
 * - 同一块上的 `results[]`（`{url, title, snippet}`），智谱形状，作为元数据兜底；
 * - `output_text` 上的 `url_citation` 注解，提供标题或在没有块 URL 时提供唯一 URL。
 *
 * 回答文本取 `phase: "final_answer"` 的消息，否则取最后一个非空 `output_text`。
 *
 * @param data - 解析后的响应体。
 * @returns 归一化结果。
 * @throws {WebError} 响应完全没有搜索证据时。
 */
export function mapResponsesResponse(data: unknown): WebSearchResult {
	const output = asArray(asRecord(data)?.output);
	const seen = new Set<string>();
	const sources: MutableSource[] = [];
	const titles = new Map<string, string>();
	const sourceTitles = new Map<string, string>();
	const resultDetails = new Map<string, Record<string, unknown>>();
	const addSource = (url: string | undefined): void => {
		if (url === void 0 || seen.has(url)) return;
		seen.add(url);
		sources.push({ url });
	};
	let content: string | undefined;
	let finalAnswer: string | undefined;
	let hasSearchCall = false;
	const failedStatuses = new Set(["failed", "incomplete"]);
	let failedCallCount = 0;
	const blockTypes = new Set<string>();
	for (const rawBlock of output) {
		const block = asRecord(rawBlock);
		if (block === void 0) continue;
		const type = asString(block.type) ?? "";
		if (type.length > 0) blockTypes.add(type);
		const action = asRecord(block.action);
		if (isWebSearchBlock(type)) {
			if (failedStatuses.has(asString(block.status) ?? "")) failedCallCount++;
			else hasSearchCall = true;
			for (const rawSource of asArray(action?.sources)) {
				const source = asRecord(rawSource);
				if (source?.type !== "url") continue;
				const url = normalizeSourceUrl(source.url);
				if (url === void 0) continue;
				addSource(url);
				const title = asString(source.title);
				if (title !== void 0 && title.length > 0) sourceTitles.set(url, title);
			}
			/** DeepSeek 把每个访问过的页面报告成独立的 `web_search_call`，不带 `sources[]`。 */
			if (action?.type === "open_page" || action?.type === "find_in_page") addSource(normalizeSourceUrl(action.url));
			for (const rawItem of asArray(block.results)) {
				const detail = asRecord(rawItem);
				const detailUrl = normalizeSourceUrl(detail?.url);
				if (detailUrl === void 0 || detail === void 0 || resultDetails.has(detailUrl)) continue;
				resultDetails.set(detailUrl, detail);
			}
		} else if (type === "message") {
			for (const rawItem of asArray(block.content)) {
				const item = asRecord(rawItem);
				if (item?.type !== "output_text") continue;
				for (const rawAnnotation of asArray(item.annotations)) {
					const annotation = asRecord(rawAnnotation);
					if (annotation?.type !== "url_citation") continue;
					const url = normalizeSourceUrl(annotation.url);
					if (url === void 0) continue;
					addSource(url);
					const title = asString(annotation.title);
					if (title !== void 0 && title.length > 0) titles.set(url, title);
				}
				const text = asString(item.text);
				if (text !== void 0 && text.length > 0) {
					content = text;
					if (block.phase === "final_answer") finalAnswer = text;
				}
			}
		}
	}
	const answerText = finalAnswer ?? content;
	if (!hasSearchCall && sources.length === 0) {
		const observed = blockTypes.size > 0 ? [...blockTypes].join(", ") : "none";
		if (failedCallCount > 0) throw new WebError(`every web search block reported status "failed" or "incomplete", so no search completed; the endpoint ran the tool but did not finish it (output item types: ${observed})`, "WEB_PROVIDER_ERROR");
		if (answerText === void 0 || answerText.trim().length === 0) throw new WebError(`the provider returned neither a web_search_call block, citations, nor answer text; the endpoint may not implement the Responses API web_search tool (output item types: ${observed})`, "WEB_PROVIDER_ERROR");
		throw new WebError(`the response carries no web_search_call block and no citations, so the model answered without searching; this endpoint likely ignores the built-in web_search tool (output item types: ${observed})`, "WEB_PROVIDER_ERROR");
	}
	for (const source of sources) {
		const detail = resultDetails.get(source.url);
		const annotatedTitle = titles.get(source.url) ?? sourceTitles.get(source.url);
		if (annotatedTitle !== void 0) source.title = annotatedTitle;
		else {
			const detailTitle = asString(detail?.title);
			if (detailTitle !== void 0 && detailTitle.length > 0) source.title = detailTitle;
		}
		const detailSnippet = asString(detail?.snippet);
		if (source.snippet === void 0 && detailSnippet !== void 0 && detailSnippet.length > 0) source.snippet = detailSnippet;
	}
	return {
		...answerText !== void 0 ? { content: answerText } : {},
		sources,
		truncated: false
	};
}

/** 构造 `tools[]` 里的那一条声明；OpenRouter 的参数放在 `parameters` 里。 */
function toolDeclaration(options: SearchOptions): Record<string, unknown> {
	const { settings, capability } = options;
	const tool: Record<string, unknown> = { type: settings.toolType };
	/** OpenRouter 的命名空间 server tool 把参数放在 `parameters` 里；自定义 target 选同一拼写时也走这里。 */
	if (options.capability.vendor === "openrouter" || settings.toolType.endsWith(":web_search")) {
		const parameters: Record<string, unknown> = {};
		if (settings.engine.length > 0) parameters.engine = settings.engine;
		if (settings.mode.length > 0) parameters.mode = settings.mode;
		if (settings.maxResults > 0) parameters.max_results = settings.maxResults;
		if (hasField(capability, "maxUses")) parameters.max_uses = settings.maxUses;
		if (hasField(capability, "maxTotalResults")) parameters.max_total_results = settings.maxTotalResults;
		if (hasField(capability, "searchContextSize")) parameters.search_context_size = settings.searchContextSize;
		if (hasField(capability, "excludedDomains") || hasField(capability, "blockedDomains")) {
			/** OpenRouter 只有 excluded_domains；自定义 target 填的 blockedDomains 一并映射过去，避免被静默忽略。 */
			const domains = [...new Set([
				...splitList(settings.excludedDomains),
				...(hasField(capability, "blockedDomains") ? splitList(settings.blockedDomains) : [])
			])];
			if (domains.length > 0) parameters.excluded_domains = domains;
		}
		if (settings.maxCharacters > 0) parameters.max_characters = settings.maxCharacters;
		if (settings.userLocation.length > 0) parameters.user_location = { type: "approximate", country: settings.userLocation };
		if (settings.xSearch.length > 0) {
			try {
				parameters.x_search = JSON.parse(settings.xSearch);
			} catch {
				// A hand-edited config may hold invalid JSON; skip the optional block.
			}
		}
		if (Object.keys(parameters).length > 0) tool.parameters = parameters;
		return tool;
	}
	if (hasField(capability, "searchContextSize")) tool.search_context_size = settings.searchContextSize;
	if (hasField(capability, "allowedDomains") || hasField(capability, "blockedDomains")) {
		const filters: Record<string, unknown> = {};
		const allowed = splitList(settings.allowedDomains);
		const blocked = splitList(settings.blockedDomains);
		if (allowed.length > 0) filters.allowed_domains = allowed;
		if (blocked.length > 0) filters.blocked_domains = blocked;
		if (Object.keys(filters).length > 0) tool.filters = filters;
	}
	if (hasField(capability, "userLocation") && settings.userLocation.length > 0) tool.user_location = { type: "approximate", country: settings.userLocation };
	if (settings.externalWebAccess.length > 0) tool.external_web_access = settings.externalWebAccess === "true";
	if (settings.returnTokenBudget.length > 0) tool.return_token_budget = settings.returnTokenBudget;
	if (hasField(capability, "searchContentTypes")) {
		const types = splitList(settings.searchContentTypes);
		if (types.length > 0) tool.search_content_types = types;
	}
	const imageSettings: Record<string, unknown> = {};
	if (settings.imageMaxResults > 0) imageSettings.max_results = settings.imageMaxResults;
	if (settings.imageCaption) imageSettings.caption = true;
	if (Object.keys(imageSettings).length > 0) tool.image_settings = imageSettings;
	return tool;
}

/**
 * `responses` 协议：一次带内置 `web_search` 工具的 Responses API 回合。
 *
 * @param options - 本次搜索的选项快照。
 * @param apiKey - 已解析凭据。
 * @param request - seam 搜索请求。
 * @param signal - 取消信号。
 * @returns 归一化结果。
 * @throws {WebError} 端点没有 Responses 路径或响应中无搜索时。
 */
export async function searchResponses(options: SearchOptions, apiKey: string, request: WebSearchRequest, signal?: AbortSignal): Promise<WebSearchResult> {
	const { settings, capability } = options;
	const endpoint = options.endpoint;
	const body: Record<string, unknown> = {
		model: settings.model,
		input: [{
			role: "user",
			content: [{
				type: "input_text",
				text: `Perform a web search for the query: ${request.query}`
			}]
		}],
		store: false,
		tools: [toolDeclaration(options)],
		max_output_tokens: settings.maxOutputTokens,
		/**
		 * `action.sources` 在 Responses API 里是 include-only 字段：缺少它时真正的
		 * OpenAI 端点完全不返回来源列表。只对声明了该字段的 target 发送。
		 */
		...(settings.includeSources && hasField(capability, "includeSources") ? { include: ["web_search_call.action.sources"] } : {}),
		/** 只在显式设置时发送；未实现该参数的网关可能直接拒绝未知字段。 */
		...(settings.reasoningEffort.length > 0 ? { reasoning: { effort: settings.reasoningEffort } } : {})
	};
	const data = await postWithReasoningFallback(endpoint, apiKey, body, signal).catch((error: unknown) => {
		if (error instanceof WebError && /\b404\b/u.test(error.message)) {
			throw new WebError(`${error.message} — this endpoint exposes no Responses path; point ${capability.id} at a gateway that really implements the Responses API${capability.docs !== void 0 ? ` (docs: ${capability.docs})` : ""}, or switch to another target`, "WEB_PROVIDER_ERROR", { cause: error });
		}
		throw error;
	});
	try {
		return mapResponsesResponse(data);
	} catch (error) {
		if (signal?.aborted === true || isAbortError(error)) throw searchAborted(signal, error);
		if (error instanceof WebError) throw error;
		throw new WebError(`web search returned an unprocessable response body: ${String(error)}`, "WEB_PROVIDER_ERROR", { cause: error });
	}
}