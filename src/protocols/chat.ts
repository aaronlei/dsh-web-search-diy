/**
 * Chat Completions 协议：4 个变体（智谱工具 / 千问参数 / OpenRouter 工具 / OpenAI 搜索模型）。
 *
 * @module dsh-web-search-diy/protocols/chat
 */
import { WebError } from "@deepseek-ai/dsh-web";
import type { WebSearchRequest, WebSearchResult } from "@deepseek-ai/dsh-web";
import { randomUUID } from "node:crypto";
import { hasField, splitList } from "../catalog.ts";
import { normalizeZhipuSources, normalizeSourceUrl, type MutableSource } from "../mappers/sources.ts";
import type { SearchOptions } from "../types.ts";
import { isAbortError, postWithReasoningFallback, searchAborted } from "../transport.ts";
import { asArray, asRecord, asString } from "../wire.ts";

/** 四个变体。 */
type ChatVariant = "zhipu" | "qwen" | "openrouter" | "openai-search-model";

/** 官方 target 的变体由厂商决定；只有自定义开放 `chatVariant`。 */
function chatVariantOf(options: SearchOptions): ChatVariant {
	if (options.capability.vendor === "custom") {
		const variant = options.settings.chatVariant;
		return variant === "qwen" || variant === "openrouter" || variant === "openai-search-model" ? variant : "zhipu";
	}
	switch (options.capability.vendor) {
		case "qwen": return "qwen";
		case "openrouter": return "openrouter";
		case "openai": return "openai-search-model";
		default: return "zhipu";
	}
}

/** 读取 assistant 消息的文本（字符串或 text 项数组）。 */
function messageContent(message: Record<string, unknown> | undefined): string | undefined {
	const raw = message?.content;
	if (typeof raw === "string" && raw.length > 0) return raw;
	const items = asArray(raw).filter((item) => {
		const record = asRecord(item);
		return record?.type === "text" && typeof record.text === "string" && record.text.length > 0;
	});
	if (items.length === 0) return void 0;
	return items.map((item) => asString(asRecord(item)?.text) ?? "").join("\n");
}

/** 从 `message.annotations[]` 的 `url_citation` 取来源（OpenAI / OpenRouter 形状）。 */
function sourcesFromAnnotations(message: Record<string, unknown> | undefined): MutableSource[] {
	const seen = new Set<string>();
	const sources: MutableSource[] = [];
	for (const rawAnnotation of asArray(message?.annotations)) {
		const annotation = asRecord(rawAnnotation);
		if (annotation?.type !== "url_citation") continue;
		const citation = asRecord(annotation.url_citation) ?? annotation;
		const url = normalizeSourceUrl(citation.url);
		if (url === void 0 || seen.has(url)) continue;
		seen.add(url);
		const source: MutableSource = { url };
		const title = asString(citation.title);
		if (title !== void 0 && title.length > 0) source.title = title;
		sources.push(source);
	}
	return sources;
}

/**
 * 归一化智谱 Chat Completions 响应：`content` 取 assistant 消息，来源取
 * `message.web_search` 或根上的 `web_search`。
 *
 * @param data - 解析后的响应体。
 * @returns 归一化结果。
 * @throws {WebError} 没有 assistant 消息时。
 */
export function mapZhipuChatResponse(data: unknown): WebSearchResult {
	const root = asRecord(data);
	const message = asRecord(asRecord(asArray(root?.choices)[0])?.message);
	const content = messageContent(message);
	if (content === void 0) throw new WebError("the provider returned no assistant message; the endpoint may not implement the chat web_search tool", "WEB_PROVIDER_ERROR");
	const messageSources = message?.web_search;
	const entries = Array.isArray(messageSources) && messageSources.length > 0 ? messageSources : asArray(root?.web_search);
	return {
		content,
		sources: normalizeZhipuSources(entries),
		truncated: false
	};
}

/**
 * 归一化 OpenRouter / OpenAI 搜索模型的响应：`content` 取 assistant 消息，来源取
 * `message.annotations[]`。
 *
 * @param data - 解析后的响应体。
 * @returns 归一化结果。
 * @throws {WebError} 没有 assistant 消息时。
 */
export function mapChatAnnotationsResponse(data: unknown): WebSearchResult {
	const root = asRecord(data);
	const message = asRecord(asRecord(asArray(root?.choices)[0])?.message);
	const content = messageContent(message);
	if (content === void 0) throw new WebError("the provider returned no assistant message; the endpoint may not implement the chat web_search tool", "WEB_PROVIDER_ERROR");
	return {
		content,
		sources: sourcesFromAnnotations(message),
		truncated: false
	};
}

/**
 * 归一化千问 Chat 的响应：只有 `content`，没有来源（降级组合）。
 *
 * @param data - 解析后的响应体。
 * @returns 归一化结果。
 * @throws {WebError} 没有 assistant 消息时。
 */
export function mapQwenChatResponse(data: unknown): WebSearchResult {
	const root = asRecord(data);
	const message = asRecord(asRecord(asArray(root?.choices)[0])?.message);
	const content = messageContent(message);
	if (content === void 0) throw new WebError("the provider returned no assistant message; the endpoint may not implement qwen search", "WEB_PROVIDER_ERROR");
	return { content, sources: [], truncated: false };
}

/** 智谱请求体。 */
function zhipuBody(options: SearchOptions, query: string): Record<string, unknown> {
	const { settings, capability } = options;
	return {
		model: settings.model,
		messages: [{ role: "user", content: query }],
		tools: [{
			type: "web_search",
			web_search: {
				enable: true,
				/** 智谱变体的 search_engine 必填：自定义留空时回落 search_std，填了则用用户值。 */
				search_engine: settings.searchEngine.length > 0 ? settings.searchEngine : "search_std",
				search_intent: settings.searchIntent ? "true" : "false",
				count: Math.min(Math.max(settings.count, 1), 50),
				...(settings.searchDomainFilter.length > 0 ? { search_domain_filter: settings.searchDomainFilter } : {}),
				search_recency_filter: settings.searchRecencyFilter,
				content_size: settings.contentSize,
				search_result: true,
				...(settings.requireSearch && hasField(capability, "requireSearch") ? { require_search: true } : {}),
				...(settings.searchPrompt.length > 0 ? { search_prompt: settings.searchPrompt } : {})
			}
		}],
		reasoning_effort: settings.reasoningEffort,
		max_tokens: settings.maxOutputTokens,
		request_id: randomUUID()
	};
}

/** 千问请求体：`enable_search` + `search_options`。 */
function qwenBody(options: SearchOptions, query: string): Record<string, unknown> {
	const { settings, capability } = options;
	const searchOptions: Record<string, unknown> = { search_strategy: settings.searchStrategy, forced_search: settings.forcedSearch };
	if (settings.freshness.length > 0) searchOptions.freshness = settings.freshness;
	if (hasField(capability, "assignedSiteList")) {
		const sites = splitList(settings.assignedSiteList);
		if (sites.length > 0) searchOptions.assigned_site_list = sites;
	}
	if (settings.searchExtension.length > 0) searchOptions.search_extension = settings.searchExtension;
	if (settings.promptIntervene.length > 0) searchOptions.prompt_intervene = settings.promptIntervene;
	return {
		model: settings.model,
		messages: [{ role: "user", content: query }],
		enable_search: true,
		search_options: searchOptions,
		max_tokens: settings.maxOutputTokens
	};
}

/** OpenRouter 请求体：`openrouter:web_search` server tool。 */
function openrouterBody(options: SearchOptions, query: string): Record<string, unknown> {
	const { settings } = options;
	const parameters: Record<string, unknown> = {
		engine: settings.engine,
		max_results: settings.maxResults,
		max_uses: settings.maxUses,
		max_total_results: settings.maxTotalResults,
		search_context_size: settings.searchContextSize
	};
	if (settings.mode.length > 0) parameters.mode = settings.mode;
	if (settings.maxCharacters > 0) parameters.max_characters = settings.maxCharacters;
	if (settings.userLocation.length > 0) parameters.user_location = { type: "approximate", country: settings.userLocation };
	if (settings.xSearch.length > 0) {
		try {
			parameters.x_search = JSON.parse(settings.xSearch);
		} catch {
			// A hand-edited config may hold invalid JSON; skip the optional block.
		}
	}
	const allowed = splitList(settings.allowedDomains);
	const excluded = splitList(settings.excludedDomains);
	if (allowed.length > 0) parameters.allowed_domains = allowed;
	if (excluded.length > 0) parameters.excluded_domains = excluded;
	return {
		model: settings.model,
		messages: [{ role: "user", content: query }],
		/** 该变体就是 OpenRouter 的 server tool；自定义 target 也固定用它，避免落到 catalog 的 web_search。 */
		tools: [{ type: "openrouter:web_search", parameters }],
		max_tokens: settings.maxOutputTokens
	};
}

/** OpenAI 搜索模型请求体：不发 tools，模型自己联网。 */
function openaiSearchModelBody(options: SearchOptions, query: string): Record<string, unknown> {
	const { settings } = options;
	return {
		model: settings.model,
		messages: [{ role: "user", content: query }],
		max_completion_tokens: settings.maxOutputTokens
	};
}

/**
 * `chat-completions` 协议：按变体构造请求并解析响应。
 *
 * @param options - 本次搜索的选项快照。
 * @param apiKey - 已解析凭据。
 * @param request - seam 搜索请求。
 * @param signal - 取消信号。
 * @returns 归一化结果。
 * @throws {WebError} 响应中没有 assistant 消息时。
 */
export async function searchChatCompletions(options: SearchOptions, apiKey: string, request: WebSearchRequest, signal?: AbortSignal): Promise<WebSearchResult> {
	const variant = chatVariantOf(options);
	const body = variant === "zhipu" ? zhipuBody(options, request.query)
		: variant === "qwen" ? qwenBody(options, request.query)
		: variant === "openrouter" ? openrouterBody(options, request.query)
		: openaiSearchModelBody(options, request.query);
	const data = await postWithReasoningFallback(options.endpoint, apiKey, body, signal);
	try {
		if (variant === "zhipu") return mapZhipuChatResponse(data);
		if (variant === "qwen") return mapQwenChatResponse(data);
		return mapChatAnnotationsResponse(data);
	} catch (error) {
		if (signal?.aborted === true || isAbortError(error)) throw searchAborted(signal, error);
		if (error instanceof WebError) throw error;
		throw new WebError(`web search returned an unprocessable response body: ${String(error)}`, "WEB_PROVIDER_ERROR", { cause: error });
	}
}