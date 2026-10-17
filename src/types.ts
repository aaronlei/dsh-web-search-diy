/**
 * Host 半内部的共享类型。
 *
 * @module dsh-web-search-diy/types
 */
import type { Capability, TargetId } from "./catalog.ts";

/** 一次搜索实际发送到模型端点的请求，记录在调用会话上供审计。 */
export interface RecordedSearchRequest {
	/** 完整请求 URL。 */
	readonly endpoint: string;
	/** `anthropic-version` 头值（仅 Anthropic 协议）。 */
	readonly apiVersion: string;
	/** 实际发送的请求体（可能经过 reasoning 降级重试）。 */
	readonly body: unknown;
}

/** 所有配置字段解析后的完整形态（catalog 默认 + 文件覆盖）。 */
export interface ResolvedSettings {
	baseURL: string;
	model: string;
	maxOutputTokens: number;
	toolType: string;
	includeSources: boolean;
	reasoningEffort: string;
	searchContextSize: string;
	allowedDomains: string;
	blockedDomains: string;
	excludedDomains: string;
	userLocation: string;
	maxUses: number;
	thinking: string;
	effort: string;
	searchEngine: string;
	count: number;
	searchRecencyFilter: string;
	contentSize: string;
	searchDomainFilter: string;
	searchIntent: boolean;
	requireSearch: boolean;
	searchPrompt: string;
	searchStrategy: string;
	forcedSearch: boolean;
	freshness: string;
	assignedSiteList: string;
	searchExtension: string;
	promptIntervene: string;
	engine: string;
	mode: string;
	maxCharacters: number;
	externalWebAccess: string;
	returnTokenBudget: string;
	searchContentTypes: string;
	imageMaxResults: number;
	imageCaption: boolean;
	responseInclusion: string;
	xSearch: string;
	maxResults: number;
	maxTotalResults: number;
	includeContent: boolean;
	timeoutSeconds: number;
	/** 纯工具搜索的 content 摘要最多包含几条结果。 */
	digestEntries: number;
	/** 摘要里每条结果最多保留多少字符。 */
	digestSnippetChars: number;
	oriQuestion: boolean;
	localization: string;
	template: string;
	chatVariant: string;
	path: string;
	queryField: string;
	countField: string;
	resultsPath: string;
	urlField: string;
	titleField: string;
	snippetField: string;
	dateField: string;
	contentField: string;
}

/**
 * 一次搜索的完整选项快照。
 *
 * 每个操作在入口处取一次快照，因此一次搜索不会混用两个配置版本。
 */
export interface SearchOptions {
	/** 目标 id，例如 `qwen/responses`。 */
	readonly target: TargetId;
	/** 目标能力（支持度、协议规格、字段）。 */
	readonly capability: Capability;
	/** 已完全默认化的配置。 */
	readonly settings: ResolvedSettings;
	/** 已去掉尾部斜杠的端点前缀。 */
	readonly baseURL: string;
	/** 完整请求 URL（`baseURL` + `path`）。 */
	readonly endpoint: string;
	/** 首选凭据引用。 */
	readonly apiKeyEnv: string;
	/** 首选之外的候选引用。 */
	readonly apiKeyEnvFallbacks: readonly string[];
	/** 解析凭据；undefined 表示当前没有可用凭据。 */
	readonly resolveApiKey: () => Promise<string | undefined>;
	/** 把出站请求记录到调用会话；不会抛错。 */
	readonly recordRequest?: (request: RecordedSearchRequest) => void;
}