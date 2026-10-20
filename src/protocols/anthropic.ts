/**
 * Anthropic 兼容 Messages API 协议：请求构造 + 响应映射。
 *
 * @module dsh-web-search-diy/protocols/anthropic
 */
import { WebError } from "@deepseek-ai/dsh-web";
import type { WebSearchRequest, WebSearchResult } from "@deepseek-ai/dsh-web";
import { hasField, splitList } from "../catalog.ts";
import { isoPublishedAt, normalizeSourceUrl, type MutableSource } from "../mappers/sources.ts";
import { DEFAULT_API_VERSION } from "../options.ts";
import type { SearchOptions } from "../types.ts";
import { isAbortError, postWithReasoningFallback, searchAborted } from "../transport.ts";
import { asArray, asRecord, asString } from "../wire.ts";

/**
 * 把 Anthropic 兼容 Messages 响应体归一化成 seam 标准 `WebSearchResult`。
 *
 * 来源取自 `web_search_tool_result` 块的 `web_search_result` 项；`snippet` 由
 * `citations[].cited_text` 按 URL 合并；`page_age` 归一化为 `publishedAt`。结果块
 * 的 `content` 是对象时表示工具失败，暴露其 `error_code`。空结果列表是有效结果。
 *
 * @param data - 解析后的响应体。
 * @returns 归一化结果。
 * @throws {WebError} 没有任何结果块时。
 */
export function mapAnthropicResponse(data: unknown): WebSearchResult {
	const blocks = asArray(asRecord(data)?.content);
	const snippets = new Map<string, string>();
	for (const rawBlock of blocks) {
		const block = asRecord(rawBlock);
		if (block?.type !== "text") continue;
		for (const rawCite of asArray(block.citations)) {
			const cite = asRecord(rawCite);
			const url = asString(cite?.url);
			const citedText = asString(cite?.cited_text);
			if (url === void 0 || url.length === 0) continue;
			if (citedText === void 0 || citedText.length === 0) continue;
			if (!snippets.has(url)) snippets.set(url, citedText);
		}
	}
	const seen = new Set<string>();
	const sources: MutableSource[] = [];
	let toolError: string | undefined;
	let searched = false;
	for (const rawBlock of blocks) {
		const block = asRecord(rawBlock);
		if (block?.type !== "web_search_tool_result") continue;
		const items = block.content;
		if (!Array.isArray(items)) {
			const content = asRecord(items);
			const code = asString(content?.error_code);
			toolError ??= `the web_search tool failed with "${code !== void 0 && code.length > 0 ? code : "unknown"}"`;
			continue;
		}
		searched = true;
		for (const rawItem of items) {
			const item = asRecord(rawItem);
			if (item?.type !== "web_search_result") continue;
			const url = normalizeSourceUrl(item.url);
			if (url === void 0 || seen.has(url)) continue;
			seen.add(url);
			const source: MutableSource = { url };
			const title = asString(item.title);
			if (title !== void 0 && title.length > 0) source.title = title;
			const snippet = snippets.get(url);
			if (snippet !== void 0) source.snippet = snippet;
			const publishedAt = isoPublishedAt(item.page_age);
			if (publishedAt !== void 0) source.publishedAt = publishedAt;
			sources.push(source);
		}
	}
	if (sources.length === 0 && searched) return { sources, truncated: false };
	if (sources.length === 0) throw new WebError(toolError ?? "the provider returned no web_search_tool_result block; the endpoint may not implement the Anthropic web_search tool", "WEB_PROVIDER_ERROR");
	return {
		sources,
		truncated: false
	};
}

/** 构造服务端工具声明。 */
function toolDeclaration(options: SearchOptions): Record<string, unknown> {
	const { settings, capability } = options;
	const tool: Record<string, unknown> = { type: settings.toolType, name: "web_search", max_uses: settings.maxUses };
	const allowed = hasField(capability, "allowedDomains") ? splitList(settings.allowedDomains) : [];
	const blocked = hasField(capability, "blockedDomains") ? splitList(settings.blockedDomains) : [];
	/** 官方：allowed_domains 与 blocked_domains 不能同时出现，会 400；allowed 优先。 */
	if (allowed.length > 0) tool.allowed_domains = allowed;
	else if (blocked.length > 0) tool.blocked_domains = blocked;
	if (hasField(capability, "userLocation") && settings.userLocation.length > 0) tool.user_location = { type: "approximate", country: settings.userLocation };
	/** 20260209+ 默认从 code execution 调用；这里做的是直接搜索，必须声明 direct。 */
	if (settings.toolType !== "web_search_20250305") tool.allowed_callers = ["direct"];
	/** 20260318+ 的 response_inclusion；旧版本会忽略该字段。 */
	if (settings.responseInclusion.length > 0) tool.response_inclusion = settings.responseInclusion;
	return tool;
}

/**
 * `anthropic-messages` 协议：一次携带原生 `web_search` 服务端工具的 Anthropic 兼容
 * Messages 回合。千问端点需要 billing header，由 catalog 的 `extraSystem` 固定附加。
 *
 * @param options - 本次搜索的选项快照。
 * @param apiKey - 已解析凭据。
 * @param request - seam 搜索请求。
 * @param signal - 取消信号。
 * @returns 归一化结果。
 * @throws {WebError} 响应中没有任何结果块时。
 */
export async function searchAnthropicMessages(options: SearchOptions, apiKey: string, request: WebSearchRequest, signal?: AbortSignal): Promise<WebSearchResult> {
	const { settings, capability } = options;
	const endpoint = options.endpoint;
	const extraSystem = capability.search.extraSystem;
	const body: Record<string, unknown> = {
		model: settings.model,
		max_tokens: settings.maxOutputTokens,
		...(extraSystem !== void 0 ? { system: [{ type: "text", text: extraSystem }] } : {}),
		messages: [{
			role: "user",
			content: [{
				type: "text",
				text: `Perform a web search for the query: ${request.query}`
			}]
		}],
		tools: [toolDeclaration(options)],
		...(settings.effort.length > 0 ? { output_config: { effort: settings.effort } } : {}),
		...(settings.thinking === "disabled" ? { thinking: { type: "disabled" } } : {})
	};
	const data = await postWithReasoningFallback(endpoint, apiKey, body, signal, {
		"x-api-key": apiKey,
		"anthropic-version": DEFAULT_API_VERSION
	}, (sent) => {
		options.recordRequest?.({ endpoint, apiVersion: DEFAULT_API_VERSION, body: sent });
	});
	try {
		return mapAnthropicResponse(data);
	} catch (error) {
		if (signal?.aborted === true || isAbortError(error)) throw searchAborted(signal, error);
		if (error instanceof WebError) throw error;
		throw new WebError(`web search returned an unprocessable response body: ${String(error)}`, "WEB_PROVIDER_ERROR", { cause: error });
	}
}