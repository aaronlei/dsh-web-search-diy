/**
 * 纯工具搜索协议：3 个兼容模板（智谱 / DeepSeek / Kimi）+ 自定义字段映射。
 *
 * 没有模型回合；结构化结果直接成为来源，前若干条的摘要成为 `content`。
 *
 * @module dsh-web-search-diy/protocols/search
 */
import { WebError } from "@deepseek-ai/dsh-web";
import type { WebSearchRequest, WebSearchResult } from "@deepseek-ai/dsh-web";
import { randomUUID } from "node:crypto";
import { isIP } from "node:net";
import { splitList } from "../catalog.ts";
import { isoPublishedAt, normalizeSourceUrl, type MutableSource } from "../mappers/sources.ts";
import type { SearchOptions } from "../types.ts";
import { isAbortError, postJson, searchAborted } from "../transport.ts";
import { asArray, asRecord, asString } from "../wire.ts";

/** 一个兼容模板的请求字段名与响应结构。 */
interface StandaloneTemplate {
	/** 响应里结果数组的点路径。 */
	readonly resultsPath: string;
	readonly urlField: string;
	readonly titleField: string;
	readonly snippetField: string;
	readonly dateField: string;
	/** 每条结果的长正文字段；写入 seam 的 `summary`，并作为 digest 的兜底。 */
	readonly contentField: string;
	readonly queryField: string;
	readonly countField: string;
}

/** 内置模板；自定义 target 通过同名 `template` 选择。 */
const TEMPLATES: Readonly<Record<string, StandaloneTemplate>> = {
	zhipu: {
		resultsPath: "search_result",
		urlField: "link",
		titleField: "title",
		snippetField: "content",
		dateField: "",
		contentField: "content",
		queryField: "search_query",
		countField: "count"
	},
	deepseek: {
		resultsPath: "results",
		urlField: "url",
		titleField: "title",
		snippetField: "snippet",
		dateField: "",
		/** `need_content=true` 的正文在 `content`；`summary` 是 600–800 字符的长摘要。 */
		contentField: "content",
		queryField: "query",
		countField: "count"
	},
	kimi: {
		resultsPath: "search_results",
		urlField: "url",
		titleField: "title",
		snippetField: "snippet",
		dateField: "",
		contentField: "",
		queryField: "text_query",
		countField: "limit"
	}
};

/** 取模板：内置用厂商名；自定义用 catalog 默认模板作为字段名的兜底，实际字段优先取已保存的 8 个映射值。 */
function templateOf(options: SearchOptions): { id: string; template: StandaloneTemplate } {
	const id = options.capability.vendor === "custom" ? options.settings.template : options.capability.vendor;
	const base = TEMPLATES[id] ?? TEMPLATES.zhipu;
	const settings = options.settings;
	/** 自定义的字段名覆盖只对纯工具生效；内置 target 的这些键不在 fields 里，保持为空。 */
	const template: StandaloneTemplate = {
		resultsPath: settings.resultsPath.length > 0 ? settings.resultsPath : base.resultsPath,
		urlField: settings.urlField.length > 0 ? settings.urlField : base.urlField,
		titleField: settings.titleField.length > 0 ? settings.titleField : base.titleField,
		snippetField: settings.snippetField.length > 0 ? settings.snippetField : base.snippetField,
		dateField: settings.dateField.length > 0 ? settings.dateField : base.dateField,
		contentField: settings.contentField.length > 0 ? settings.contentField : base.contentField,
		queryField: settings.queryField.length > 0 ? settings.queryField : base.queryField,
		countField: settings.countField.length > 0 ? settings.countField : base.countField
	};
	return { id: TEMPLATES[id] !== void 0 ? id : "zhipu", template };
}

/** 点路径读取；空路径返回原值。 */
function readPath(value: unknown, path: string): unknown {
	if (path.length === 0) return value;
	let current: unknown = value;
	for (const segment of path.split(".")) {
		const record = asRecord(current);
		if (record === void 0) return void 0;
		current = record[segment];
		if (current === void 0) return void 0;
	}
	return current;
}

/** 读取一个结果项的字段（自定义覆盖优先）。 */
function fieldOf(item: Record<string, unknown>, override: string, fallback: string): string | undefined {
	const key = override.length > 0 ? override : fallback;
	return key.length > 0 ? asString(item[key]) : void 0;
}

/** DeepSeek 的 `query` 硬上限是 128 个 Unicode 字符，超出会被端点直接 400。 */
const DEEPSEEK_QUERY_LIMIT = 128;

/** 按 Unicode 码点截断，避免把代理对切成半个字符。 */
function truncateQuery(query: string, limit: number): string {
	const characters = [...query];
	return characters.length <= limit ? query : characters.slice(0, limit).join("");
}

/**
 * 规范搜索词：空串没有可发送的内容；DeepSeek 超长查询截断到上限。
 *
 * 智谱的 70 字符只是文档建议而非硬限制，Kimi 未声明上限，因此不做截断。
 *
 * @param templateId - 模板 id。
 * @param query - seam 传入的搜索词。
 * @returns 可发送的搜索词。
 * @throws {WebError} 查询为空时。
 */
function normalizeQuery(templateId: string, query: string): string {
	const trimmed = query.trim();
	if (trimmed.length === 0) throw new WebError("web search query is empty", "WEB_PROVIDER_ERROR");
	return templateId === "deepseek" ? truncateQuery(trimmed, DEEPSEEK_QUERY_LIMIT) : trimmed;
}

/** DeepSeek 只接受合法 IP；非法值发出去会 400，因此按未提供处理。 */
function localizationOf(value: string): string | undefined {
	const trimmed = value.trim();
	return isIP(trimmed) === 0 ? void 0 : trimmed;
}

/** Search API 的 `ori_question` 上限，与 `query` 同为 128 个字符。 */
const ORIGINAL_QUESTION_LIMIT = 128;

/**
 * 归一化原问题：折叠连续空白并截断到 128 个字符；空值表示不发送。
 *
 * 与官方 `web-deepseek-api` 的 `boundedQuestion` 保持一致。
 *
 * @param read - 会话原问题读取器；未开启或不在会话中时为 undefined。
 * @returns 可直接发送的 `ori_question`，或 undefined。
 */
function originalQuestionOf(read: (() => string | undefined) | undefined): string | undefined {
	const collapsed = read?.()?.replace(/\s+/gu, " ").trim() ?? "";
	if (collapsed.length === 0) return void 0;
	return [...collapsed].slice(0, ORIGINAL_QUESTION_LIMIT).join("");
}

/** 构造请求体；自定义的 `queryField` / `countField` 覆盖字段名。 */
function buildBody(options: SearchOptions, query: string, maxResults: number | undefined, templateId: string, template: StandaloneTemplate): Record<string, unknown> {
	const { settings, capability } = options;
	const searchQuery = normalizeQuery(templateId, query);
	const queryKey = template.queryField;
	const countKey = template.countField;
	const requested = typeof maxResults === "number" && Number.isInteger(maxResults) ? maxResults : settings.count;
	/** Kimi 的 `limit` 只接受 1-20；智谱与 DeepSeek 的 `count` 为 1-50。 */
	const upper = templateId === "kimi" ? 20 : 50;
	const count = Math.min(Math.max(requested, 1), upper);
	if (templateId === "deepseek") {
		const originalQuestion = originalQuestionOf(options.originalQuestion);
		const localization = localizationOf(settings.localization);
		return {
			[queryKey]: searchQuery,
			[countKey]: count,
			...(originalQuestion !== void 0 ? { ori_question: originalQuestion } : {}),
			...(settings.includeContent ? { need_content: true } : {}),
			...(localization !== void 0 ? { localization } : {})
		};
	}
	if (templateId === "kimi") {
		return {
			[queryKey]: searchQuery,
			[countKey]: count,
			timeout_seconds: settings.timeoutSeconds,
			...(settings.includeContent ? { include_content: true } : {})
		};
	}
	/** 智谱模板：内置 target 用完整参数；自定义按 target 声明的字段发送。 */
	const body: Record<string, unknown> = {
		[queryKey]: searchQuery,
		/** 智谱模板的 search_engine 是必填项：自定义网关留空时回落到 search_std，填了则用用户值。 */
		search_engine: settings.searchEngine.length > 0 ? settings.searchEngine : "search_std",
		search_intent: settings.searchIntent,
		[countKey]: count,
		search_recency_filter: settings.searchRecencyFilter,
		content_size: settings.contentSize,
		request_id: randomUUID()
	};
	if (settings.searchDomainFilter.length > 0) body.search_domain_filter = splitList(settings.searchDomainFilter);
	if (capability.vendor === "custom" && settings.includeContent) body.content_size = "high";
	return body;
}

/** 拼给调用方的 content 摘要上限。 */
export interface DigestLimits {
	/** 最多包含几条结果。 */
	readonly maxEntries: number;
	/** 每条结果最多保留多少字符。 */
	readonly maxSnippetChars: number;
}
/** catalog 未声明时的兜底。 */
const DEFAULT_DIGEST_LIMITS: DigestLimits = { maxEntries: 8, maxSnippetChars: 200 };

/**
 * 每条来源长正文的硬上限。`dsh-tool-web` 会按部署配置再截到 800 字符才给模型，
 * 这里只阻止个别接口把整页正文塞进 session 的 `tool/result` meta。
 */
const SUMMARY_MAX_CHARS = 2000;

/** 生成 `content` 摘要：编号的标题 + 摘要列表。 */
function digestOf(entries: readonly unknown[], template: StandaloneTemplate, maxEntries: number, maxSnippetLength: number): string {
	const lines: string[] = [];
	for (const rawItem of entries) {
		if (lines.length >= maxEntries) break;
		const item = asRecord(rawItem);
		if (item === void 0) continue;
		const title = (fieldOf(item, template.titleField, "title") ?? "").trim();
		const snippet = (fieldOf(item, template.snippetField, "snippet") ?? "").trim();
		/** snippet 为空时回退 contentField，再回退模板的 summary，避免摘要为空。 */
		const body = snippet.length > 0
			? snippet
			: (fieldOf(item, template.contentField, "summary") || fieldOf(item, "summary", "") || "").trim();
		const head = `${lines.length + 1}. `;
		if (title.length > 0 && body.length > 0) lines.push(`${head}${title}\n${body.slice(0, maxSnippetLength)}`);
		else if (title.length > 0) lines.push(`${head}${title}`);
		else if (body.length > 0) lines.push(`${head}${body.slice(0, maxSnippetLength)}`);
	}
	return lines.join("\n");
}

/**
 * 归一化一次纯工具搜索的响应。
 *
 * `resultsPath` 定位结果数组（自定义可覆盖），`urlField` 等决定逐项字段名；
 * 有 URL 的项成为来源，`contentField` 的长正文写入 `source.summary`（与
 * `snippet` 相同则省略），前若干条拼成 `content`。空结果集是有效结果。
 *
 * @param data - 解析后的响应体。
 * @param template - 模板规格。
 * @returns 归一化结果。
 */
export function mapStandaloneResponse(data: unknown, template: StandaloneTemplate = TEMPLATES.zhipu, limits: DigestLimits = DEFAULT_DIGEST_LIMITS): WebSearchResult {
	const entries = asArray(readPath(data, template.resultsPath));
	const seen = new Set<string>();
	const sources: MutableSource[] = [];
	for (const rawItem of entries) {
		const item = asRecord(rawItem);
		if (item === void 0) continue;
		const url = normalizeSourceUrl(fieldOf(item, template.urlField, "url"));
		if (url === void 0 || seen.has(url)) continue;
		seen.add(url);
		const source: MutableSource = { url };
		const title = fieldOf(item, template.titleField, "title");
		if (title !== void 0 && title.length > 0) source.title = title;
		const snippet = fieldOf(item, template.snippetField, "snippet");
		if (snippet !== void 0 && snippet.length > 0) source.snippet = snippet;
		/**
		 * 长正文进 `summary`：调用方模型优先读它，再退回 snippet。用户配置的
		 * contentField 优先；该字段为空时回退模板的 `summary`（DeepSeek 的长摘要）。
		 * 真实 DeepSeek 在未开 `need_content` 时也返回 `content: ""`，所以空串
		 * 必须按缺失处理，不能只判断键是否存在。
		 */
		const summary = (fieldOf(item, template.contentField, "summary") || fieldOf(item, "summary", "") || "").trim();
		if (summary.length > 0) {
			const bounded = summary.slice(0, SUMMARY_MAX_CHARS);
			/** 智谱等接口的正文就是 snippet：重复写一份只会放大 session。 */
			if (bounded !== snippet) source.summary = bounded;
		}
		const publishedAt = isoPublishedAt(fieldOf(item, template.dateField, ""));
		if (publishedAt !== void 0) source.publishedAt = publishedAt;
		sources.push(source);
	}
	if (entries.length === 0) return { sources, truncated: false };
	return {
		content: digestOf(entries, template, limits.maxEntries, limits.maxSnippetChars),
		sources,
		truncated: false
	};
}

/**
 * 智谱 Web Search API 的响应映射（1.x 行为，保留导出名）。
 *
 * @param data - 解析后的响应体。
 * @returns 归一化结果。
 */
export function mapZhipuWebSearchResponse(data: unknown): WebSearchResult {
	return mapStandaloneResponse(data, TEMPLATES.zhipu);
}

/**
 * `search` 协议：一次纯工具搜索，无模型回合。
 *
 * @param options - 本次搜索的选项快照。
 * @param apiKey - 已解析凭据。
 * @param request - seam 搜索请求。
 * @param signal - 取消信号。
 * @returns 归一化结果。
 * @throws {WebError} 响应体不可解析时。
 */
export async function searchStandalone(options: SearchOptions, apiKey: string, request: WebSearchRequest, signal?: AbortSignal): Promise<WebSearchResult> {
	const { id, template } = templateOf(options);
	const body = buildBody(options, request.query, request.maxResults, id, template);
	const data = await postJson(options.endpoint, apiKey, body, signal);
	try {
		return mapStandaloneResponse(data, template, { maxEntries: options.settings.digestEntries, maxSnippetChars: options.settings.digestSnippetChars });
	} catch (error) {
		if (signal?.aborted === true || isAbortError(error)) throw searchAborted(signal, error);
		if (error instanceof WebError) throw error;
		throw new WebError(`web search returned an unprocessable response body: ${String(error)}`, "WEB_PROVIDER_ERROR", { cause: error });
	}
}

/** 供测试引用内置模板。 */
export { TEMPLATES };