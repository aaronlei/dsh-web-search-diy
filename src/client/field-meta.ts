/**
 * Field metadata derived from the host catalog: enum ranges, boolean/numeric
 * sets, chat variants and the advanced section. Display layer only; the host
 * validates authoritatively.
 */
import type { CatalogEntry } from "./types.ts";

/** Enum value ranges (display layer; the host validates authoritatively). */
export const ENUMS: Readonly<Record<string, readonly string[]>> = {
	toolType: ["web_search", "openrouter:web_search", "web_search_20250305", "web_search_20260209", "web_search_20260318"],
	thinking: ["default", "disabled"],
	effort: ["", "low", "medium", "high", "xhigh", "max"],
	searchEngine: ["search_std", "search_pro", "search_pro_sogou", "search_pro_quark"],
	searchRecencyFilter: ["noLimit", "oneDay", "oneWeek", "oneMonth", "oneYear"],
	contentSize: ["medium", "high"],
	searchStrategy: ["turbo", "max", "agent", "agent_max"],
	freshness: ["", "noLimit", "oneDay", "oneWeek", "oneMonth", "oneYear"],
	searchContextSize: ["low", "medium", "high"],
	externalWebAccess: ["", "true", "false"],
	returnTokenBudget: ["", "default", "unlimited"],
	responseInclusion: ["", "full", "excluded"]
};
/** Boolean fields. */
export const BOOLEANS = new Set(["includeSources", "includeContent", "requireSearch", "searchIntent", "forcedSearch", "oriQuestion", "imageCaption"]);
/** Numeric fields. */
export const NUMBERS = new Set(["maxOutputTokens", "maxUses", "count", "maxResults", "maxTotalResults", "maxCharacters", "imageMaxResults", "timeoutSeconds", "digestEntries", "digestSnippetChars"]);

/**
 * 自定义网关的搜索引擎取值：智谱、OpenRouter 与常见自建/第三方引擎放在一起，
 * 只作为候选；输入框仍接受任意值。智谱模板下留空时回落到 search_std（该接口必填）。
 */
export const CUSTOM_SEARCH_ENGINES: readonly string[] = [
	"search_std", "search_pro", "search_pro_sogou", "search_pro_quark",
	"auto", "native", "exa", "firecrawl", "parallel", "perplexity",
	"searxng", "google", "bing", "brave", "duckduckgo", "tavily"
];

/**
 * 自定义 Chat 的四个变体各自实际使用的搜索字段。保存时 Host 按并集校验，
 * 但 UI 只渲染当前变体相关的字段，避免在 OpenRouter 变体下误填智谱参数。
 */
export const CHAT_VARIANT_FIELDS: Readonly<Record<string, readonly string[]>> = {
	zhipu: ["searchEngine", "count", "searchRecencyFilter", "contentSize", "searchDomainFilter", "searchIntent", "requireSearch", "searchPrompt", "reasoningEffort"],
	qwen: ["searchStrategy", "forcedSearch", "freshness", "assignedSiteList", "searchExtension", "promptIntervene"],
	openrouter: ["engine", "mode", "maxResults", "maxUses", "maxTotalResults", "searchContextSize", "maxCharacters", "userLocation", "allowedDomains", "excludedDomains", "xSearch"],
	"openai-search-model": []
};
/** 变体专属字段的并集；这些键只对声明它们的变体渲染。 */
export const CHAT_VARIANT_ONLY = new Set(Object.values(CHAT_VARIANT_FIELDS).flat());


/** Fields folded into the advanced section. */
export const ADVANCED = new Set([
	"toolType", "includeSources", "reasoningEffort", "thinking", "effort", "searchContextSize",
	"allowedDomains", "blockedDomains", "excludedDomains", "userLocation", "maxUses",
	"searchRecencyFilter", "contentSize", "searchDomainFilter", "searchIntent", "requireSearch",
	"searchPrompt", "searchStrategy", "forcedSearch", "freshness", "assignedSiteList",
	"searchExtension", "promptIntervene", "engine", "mode", "maxResults", "maxTotalResults",
	"maxCharacters", "includeContent", "timeoutSeconds", "oriQuestion", "localization", "chatVariant", "digestEntries", "digestSnippetChars",
	"path", "queryField", "countField", "resultsPath", "urlField", "titleField", "snippetField",
	"dateField", "contentField", "externalWebAccess", "returnTokenBudget", "searchContentTypes",
	"imageMaxResults", "imageCaption", "responseInclusion", "xSearch"
]);
/** References seen on existing deployments that are not a vendor's default chain. */
export const EXTRA_CREDENTIAL_REFS: Readonly<Record<string, readonly string[]>> = {
	deepseek: ["DEEPSEEK_API_SEARCH_KEY"],
	zhipu: ["ZAI_API_KEY"]
};
/** The default credential chain a catalog entry declares. */
export function chainOf(entry: CatalogEntry): string[] {
	const chain = entry.defaults.apiKeyEnv;
	return Array.isArray(chain) ? chain.filter((ref): ref is string => typeof ref === "string" && ref.length > 0) : [];
}
/** Credential references for one vendor: catalog chains first, then deployment aliases. */
export function credentialRefsFor(catalog: CatalogEntry[], vendor: string): string[] {
	const refs = new Set<string>();
	for (const entry of catalog) {
		if (entry.vendor !== vendor || entry.support === "unsupported") continue;
		for (const ref of chainOf(entry)) refs.add(ref);
	}
	for (const ref of EXTRA_CREDENTIAL_REFS[vendor] ?? []) refs.add(ref);
	return [...refs];
}
/** Every reference the catalog declares plus aliases, for custom gateways. */
export function allCredentialRefs(catalog: CatalogEntry[]): string[] {
	const refs = new Set<string>();
	for (const entry of catalog) for (const ref of chainOf(entry)) refs.add(ref);
	for (const extra of Object.values(EXTRA_CREDENTIAL_REFS)) for (const ref of extra) refs.add(ref);
	return [...refs];
}
