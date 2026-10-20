/**
 * 能力矩阵：17 个官方 target + 8 条不支持项 + 4 个自定义 target。
 *
 * 这是厂商差异的单一事实源。Host 的选项解析、配置校验，以及 Client 的字段渲染都从
 * 这里读取——Client 不再自带 `OFFICIAL_ENDPOINTS` / `OFFICIAL_MODELS` 之类的副本。
 *
 * 约定：
 * - `baseURL` 是端点前缀，`search.path` 是相对路径；`joinEndpoint()` 负责拼接与去重。
 * - `defaults` 只提供默认值，用户配置永远优先。
 * - `fields` 决定该 target 展示与保存哪些键；不在此列的键不会被写盘。
 * - `support: "unsupported"` 的条目只用于 UI 置灰展示，不生成配置桶。
 *
 * @module dsh-web-search-diy/catalog
 */

/** 支持的厂商；`custom` 表示中转站或自建网关。 */
export type Vendor = "deepseek" | "kimi" | "zhipu" | "qwen" | "openai" | "anthropic" | "openrouter" | "custom";

/** 四种对话协议形态；`search` 是纯工具搜索，没有模型回合。 */
export type Protocol = "chat-completions" | "responses" | "anthropic-messages" | "search";

/** 配置键：`${vendor}/${protocol}`，例如 `qwen/responses`。 */
export type TargetId = `${Vendor}/${Protocol}`;

/** 支持度；`degraded` 表示能跑但来源或功能不完整，`custom` 表示需自测。 */
export type Support = "full" | "degraded" | "unsupported" | "custom";

/** 搜索触发方式，决定请求体形状与响应解析。 */
export type SearchKind = "responses-tool" | "anthropic-tool" | "chat-tool" | "chat-param" | "chat-search-model" | "standalone";

/** 该 target 实际能拿到的来源质量。 */
export type SourceQuality = "full" | "partial" | "none";

/** 一个 target 的配置项集合（全部可选，空值表示用默认）。 */
export interface TargetOptions {
	baseURL?: string;
	apiKeyEnv?: string;
	model?: string;
	maxOutputTokens?: number;
	toolType?: string;
	includeSources?: boolean;
	reasoningEffort?: string;
	searchContextSize?: string;
	allowedDomains?: string;
	blockedDomains?: string;
	excludedDomains?: string;
	userLocation?: string;
	maxUses?: number;
	thinking?: string;
	effort?: string;
	searchEngine?: string;
	count?: number;
	searchRecencyFilter?: string;
	contentSize?: string;
	searchDomainFilter?: string;
	searchIntent?: boolean;
	requireSearch?: boolean;
	searchPrompt?: string;
	searchStrategy?: string;
	forcedSearch?: boolean;
	freshness?: string;
	assignedSiteList?: string;
	searchExtension?: string;
	promptIntervene?: string;
	engine?: string;
	mode?: string;
	maxCharacters?: number;
	externalWebAccess?: string;
	returnTokenBudget?: string;
	searchContentTypes?: string;
	imageMaxResults?: number;
	imageCaption?: boolean;
	responseInclusion?: string;
	xSearch?: string;
	maxResults?: number;
	maxTotalResults?: number;
	includeContent?: boolean;
	timeoutSeconds?: number;
	digestEntries?: number;
	digestSnippetChars?: number;
	oriQuestion?: boolean;
	localization?: string;
	template?: string;
	chatVariant?: string;
	path?: string;
	queryField?: string;
	countField?: string;
	resultsPath?: string;
	urlField?: string;
	titleField?: string;
	snippetField?: string;
	dateField?: string;
	contentField?: string;
}

/** 配置键联合：`fields` 的元素只能是这里面的键。 */
export type FieldKey = keyof TargetOptions;

/** 默认值；`apiKeyEnv` 是候选引用链，其余与 {@link TargetOptions} 同义。 */
export type TargetDefaults = Omit<TargetOptions, "apiKeyEnv"> & {
	readonly baseURL: string;
	readonly apiKeyEnv: readonly string[];
};

/** 请求构造与响应解析的协议规格。 */
export interface SearchSpec {
	/** 搜索触发方式。 */
	readonly kind: SearchKind;
	/** 相对于 `baseURL` 的路径。 */
	readonly path: string;
	/** `tools[].type` 的默认值（Responses / Anthropic / Chat 工具变体）。 */
	readonly toolType?: string;
	/** 是否默认请求来源列表（Responses 的 `include`）。 */
	readonly includeSources?: boolean;
	/** 固定附加的 system 文本（千问 Anthropic 的 billing header）。 */
	readonly extraSystem?: string;
	/** 该 target 实际能拿到的来源质量。 */
	readonly sourceQuality: SourceQuality;
}

/** 自定义 target 的模板：一次性填充默认值；`template` 本身不持久化。 */
export interface Template {
	readonly id: string;
	readonly label: string;
	readonly chatVariant?: string;
	readonly toolType?: string;
	readonly defaults: Partial<TargetDefaults>;
}

/** 一个可配置入口。 */
export interface Capability {
	readonly id: TargetId;
	readonly vendor: Vendor;
	readonly protocol: Protocol;
	readonly support: Support;
	/** `support !== "full"` 时给用户看的原因。 */
	readonly reason?: string;
	/** 配置页展示名。 */
	readonly title: string;
	/** 官方文档链接。 */
	readonly docs?: string;
	readonly defaults: TargetDefaults;
	readonly fields: readonly FieldKey[];
	readonly search: SearchSpec;
	/** 字段级提示。 */
	readonly hints?: Readonly<Record<string, string>>;
	/** 该组合只支持 catalog 默认模型，UI 只读、保存拒绝其他值。 */
	readonly modelLocked?: boolean;
	/** `custom` target 的模板列表。 */
	readonly templates?: readonly Template[];
}

/** 通用连接与模型字段，几乎每个 target 都有。 */
const CONNECTION: readonly FieldKey[] = ["baseURL", "apiKeyEnv"];

/** 有模型回合的 target 通用字段。 */
const MODEL: readonly FieldKey[] = ["model", "maxOutputTokens"];

/** Responses 协议的高级字段。 */
const RESPONSES_ADVANCED: readonly FieldKey[] = ["toolType", "includeSources", "reasoningEffort"];

/** Anthropic 协议的高级字段。 */
const ANTHROPIC_ADVANCED: readonly FieldKey[] = ["toolType", "maxUses", "thinking", "effort"];

/** 智谱 Chat 的搜索字段。 */
const ZHIPU_CHAT_SEARCH: readonly FieldKey[] = ["searchEngine", "count", "searchRecencyFilter", "contentSize", "searchDomainFilter", "searchIntent", "requireSearch", "searchPrompt", "reasoningEffort"];

/** 智谱原始搜索的字段。 */
const ZHIPU_STANDALONE: readonly FieldKey[] = ["searchEngine", "count", "searchRecencyFilter", "contentSize", "searchDomainFilter", "searchIntent"];

/** 智谱两个 target 共用的默认搜索参数。 */
const ZHIPU_DEFAULTS = {
	searchEngine: "search_std",
	count: 10,
	searchRecencyFilter: "noLimit",
	contentSize: "medium",
	searchIntent: false
} as const;

/**
 * 官方 target 能力表。
 *
 * 支持度与默认值来自 `docs/厂商×协议-web_search-文档与兼容性明细.md` 的实测结论；
 * 默认模型只是当前文档示例，发版前按官方模型页更新。
 */
export const CATALOG: Record<string, Capability> = {
	"deepseek/anthropic-messages": {
		id: "deepseek/anthropic-messages",
		vendor: "deepseek",
		protocol: "anthropic-messages",
		support: "full",
		title: "DeepSeek · Anthropic 兼容 Messages",
		docs: "https://api-docs.deepseek.com/zh-cn/guides/anthropic_api/",
		defaults: {
			baseURL: "https://api.deepseek.com/anthropic",
			apiKeyEnv: ["DEEPSEEK_API_KEY"],
			model: "deepseek-flash",
			maxOutputTokens: 65536,
			toolType: "web_search_20250305",
			maxUses: 5,
			thinking: "default",
			effort: ""
		},
		fields: [...CONNECTION, ...MODEL, ...ANTHROPIC_ADVANCED],
		search: { kind: "anthropic-tool", path: "/v1/messages", toolType: "web_search_20250305", sourceQuality: "full" },
		hints: { thinking: "仅 disabled 能可靠关闭思考（实测）", effort: "留空不发送 output_config.effort" }
	},
	"deepseek/responses": {
		id: "deepseek/responses",
		vendor: "deepseek",
		protocol: "responses",
		support: "degraded",
		reason: "仅 deepseek-v4-pro 支持；响应不带 action.sources[]，来源只能来自 open_page",
		title: "DeepSeek · Responses",
		docs: "https://api-docs.deepseek.com/guides/responses_api",
		defaults: {
			baseURL: "https://api.deepseek.com",
			apiKeyEnv: ["DEEPSEEK_API_KEY"],
			model: "deepseek-v4-pro",
			maxOutputTokens: 4096,
			toolType: "web_search",
			includeSources: false,
			reasoningEffort: ""
		},
		fields: [...CONNECTION, ...MODEL, "toolType"],
		search: { kind: "responses-tool", path: "/v1/responses", toolType: "web_search", sourceQuality: "partial" },
		modelLocked: true,
		hints: { model: "该端点只有 deepseek-v4-pro 支持内置搜索" }
	},
	"deepseek/search": {
		id: "deepseek/search",
		vendor: "deepseek",
		protocol: "search",
		support: "full",
		title: "DeepSeek · 独立搜索 API",
		docs: "https://api-docs.deepseek.com/api/search",
		defaults: {
			baseURL: "https://api.deepseek.com",
			apiKeyEnv: ["DEEPSEEK_API_KEY"],
			count: 10,
			includeContent: false,
			oriQuestion: true,
			localization: "",
			digestEntries: 8,
			digestSnippetChars: 200
		},
		fields: [...CONNECTION, "count", "includeContent", "oriQuestion", "localization", "digestEntries", "digestSnippetChars"],
		hints: { localization: "填 IP 地址（用于地域），留空不发送；非 IPv4/IPv6 会被忽略" },
		search: { kind: "standalone", path: "/v1/tools/search", sourceQuality: "full" }
	},
	"kimi/responses": {
		id: "kimi/responses",
		vendor: "kimi",
		protocol: "responses",
		support: "full",
		title: "Kimi · Responses",
		docs: "https://platform.kimi.com/docs/api/responses.md",
		defaults: {
			baseURL: "https://api.moonshot.cn/v1",
			apiKeyEnv: ["MOONSHOT_API_KEY", "KIMI_API_KEY", "KIMI_CODING_API_KEY"],
			model: "kimi-k2.6",
			maxOutputTokens: 4096,
			toolType: "web_search",
			includeSources: true,
			allowedDomains: "",
			reasoningEffort: ""
		},
		fields: [...CONNECTION, ...MODEL, "toolType", "includeSources", "allowedDomains"],
		search: { kind: "responses-tool", path: "/responses", toolType: "web_search", includeSources: true, sourceQuality: "full" },
		hints: { includeSources: "Kimi 的 action.sources[] 自带 title", allowedDomains: "Kimi 支持 filters.allowed_domains；blocked_domains 与 search_context_size 会 400，因此不提供", apiKeyEnv: "Kimi 即月之暗面，有两个入口：开放平台 api.moonshot.cn 用 MOONSHOT_API_KEY；Kimi coding 端点 api.kimi.com/coding 用 KIMI_API_KEY（DSH 自带的 kimi-coding provider）。key 与端点绑定，混用会 401" }
	},
	"kimi/search": {
		id: "kimi/search",
		vendor: "kimi",
		protocol: "search",
		support: "full",
		title: "Kimi · 独立搜索 API",
		docs: "https://platform.kimi.com/docs/api/tools-search.md",
		defaults: {
			baseURL: "https://api.moonshot.cn",
			apiKeyEnv: ["MOONSHOT_API_KEY", "KIMI_API_KEY", "KIMI_CODING_API_KEY"],
			count: 10,
			includeContent: false,
			timeoutSeconds: 30,
			digestEntries: 8,
			digestSnippetChars: 200
		},
		fields: [...CONNECTION, "count", "includeContent", "timeoutSeconds", "digestEntries", "digestSnippetChars"],
		search: { kind: "standalone", path: "/v1/tools/search", sourceQuality: "full" },
		hints: { template: "Basic: /v1/tools/search；Pro 片段接口 /v1/tools/search_pro 可用自定义纯工具 target 覆盖 path 接入" }
	},
	"zhipu/chat-completions": {
		id: "zhipu/chat-completions",
		vendor: "zhipu",
		protocol: "chat-completions",
		support: "full",
		title: "智谱 · 问答增强（Web Search in Chat）",
		docs: "https://docs.bigmodel.cn/cn/guide/tools/web-search",
		defaults: {
			baseURL: "https://open.bigmodel.cn/api/paas/v4",
			apiKeyEnv: ["ZAI_CODING_CN_API_KEY", "ZHIPU_API_KEY"],
			model: "glm-5.3-flash",
			maxOutputTokens: 4096,
			...ZHIPU_DEFAULTS,
			requireSearch: false,
			searchPrompt: "",
			reasoningEffort: "low"
		},
		fields: [...CONNECTION, ...MODEL, ...ZHIPU_CHAT_SEARCH],
		search: { kind: "chat-tool", path: "/chat/completions", toolType: "web_search", sourceQuality: "full" }
	},
	"zhipu/responses": {
		id: "zhipu/responses",
		vendor: "zhipu",
		protocol: "responses",
		support: "full",
		title: "智谱 · Responses",
		docs: "https://docs.bigmodel.cn/cn/guide/develop/responses/introduction",
		defaults: {
			baseURL: "https://open.bigmodel.cn/api/v1",
			apiKeyEnv: ["ZAI_CODING_CN_API_KEY", "ZHIPU_API_KEY"],
			model: "glm-5.3",
			maxOutputTokens: 4096,
			toolType: "web_search",
			includeSources: true,
			reasoningEffort: ""
		},
		fields: [...CONNECTION, ...MODEL, ...RESPONSES_ADVANCED],
		search: { kind: "responses-tool", path: "/responses", toolType: "web_search", includeSources: true, sourceQuality: "full" },
		hints: { includeSources: "智谱在 action.sources[] 之外还带 results[]（含 title/snippet）" }
	},
	"zhipu/search": {
		id: "zhipu/search",
		vendor: "zhipu",
		protocol: "search",
		support: "full",
		title: "智谱 · 基础检索（Web Search API）",
		docs: "https://docs.bigmodel.cn/cn/guide/tools/web-search",
		defaults: {
			baseURL: "https://open.bigmodel.cn/api/paas/v4",
			apiKeyEnv: ["ZAI_CODING_CN_API_KEY", "ZHIPU_API_KEY"],
			...ZHIPU_DEFAULTS,
			digestEntries: 8,
			digestSnippetChars: 200
		},
		fields: [...CONNECTION, ...ZHIPU_STANDALONE, "digestEntries", "digestSnippetChars"],
		search: { kind: "standalone", path: "/web_search", sourceQuality: "full" },
		hints: { contentSize: "medium / high 影响摘要长度" }
	},
	"qwen/chat-completions": {
		id: "qwen/chat-completions",
		vendor: "qwen",
		protocol: "chat-completions",
		support: "degraded",
		reason: "响应只有 message.content，不带 annotations 或 sources，sources 为空",
		title: "千问 · 联网搜索（Chat Completions）",
		docs: "https://platform.qianwenai.com/docs/api-reference/chat/openai-chat",
		defaults: {
			baseURL: "https://maas.qianwenaiapi.com/compatible-mode/v1",
			apiKeyEnv: ["QWEN_TOKEN_PLAN_API_KEY", "QWEN_TOKEN_PLAN_CN_API_KEY", "DASHSCOPE_API_KEY"],
			model: "qwen3.8-flash",
			maxOutputTokens: 4096,
			searchStrategy: "turbo",
			forcedSearch: false,
			freshness: "",
			assignedSiteList: "",
			searchExtension: "",
			promptIntervene: ""
		},
		fields: [...CONNECTION, ...MODEL, "searchStrategy", "forcedSearch", "freshness", "assignedSiteList", "searchExtension", "promptIntervene"],
		search: { kind: "chat-param", path: "/chat/completions", sourceQuality: "none" },
		hints: { searchStrategy: "turbo / max / agent / agent_max" }
	},
	"qwen/responses": {
		id: "qwen/responses",
		vendor: "qwen",
		protocol: "responses",
		support: "full",
		title: "千问 · Responses",
		docs: "https://platform.qianwenai.com/docs/api-reference/chat/openai-responses",
		defaults: {
			baseURL: "https://maas.qianwenaiapi.com/compatible-mode/v1",
			apiKeyEnv: ["QWEN_TOKEN_PLAN_API_KEY", "QWEN_TOKEN_PLAN_CN_API_KEY", "DASHSCOPE_API_KEY"],
			model: "qwen3.8-flash",
			maxOutputTokens: 4096,
			toolType: "web_search",
			includeSources: true,
			reasoningEffort: ""
		},
		fields: [...CONNECTION, ...MODEL, "toolType", "includeSources", "reasoningEffort"],
		search: { kind: "responses-tool", path: "/responses", toolType: "web_search", includeSources: true, sourceQuality: "partial" },
		hints: { includeSources: "来源只有 url，没有 title" }
	},
	"qwen/anthropic-messages": {
		id: "qwen/anthropic-messages",
		vendor: "qwen",
		protocol: "anthropic-messages",
		support: "full",
		title: "千问 · Anthropic 兼容 Messages",
		docs: "https://platform.qianwenai.com/docs/api-reference/chat/anthropic",
		defaults: {
			baseURL: "https://maas.qianwenaiapi.com/apps/anthropic",
			apiKeyEnv: ["QWEN_TOKEN_PLAN_API_KEY", "QWEN_TOKEN_PLAN_CN_API_KEY", "DASHSCOPE_API_KEY"],
			model: "qwen3.8-max",
			maxOutputTokens: 4096,
			toolType: "web_search_20250305",
			maxUses: 5,
			thinking: "default",
			effort: ""
		},
		fields: [...CONNECTION, ...MODEL, "toolType", "maxUses"],
		search: {
			kind: "anthropic-tool",
			path: "/v1/messages",
			toolType: "web_search_20250305",
			extraSystem: "x-anthropic-billing-header: cc_entrypoint=cli;",
			sourceQuality: "partial"
		},
		hints: { toolType: "插件自动附加 billing header；缺失时端点不执行搜索" }
	},
	"openai/chat-completions": {
		id: "openai/chat-completions",
		vendor: "openai",
		protocol: "chat-completions",
		support: "degraded",
		reason: "只有搜索模型（gpt-5-search-api）会联网；普通模型加 tools 不生效",
		title: "OpenAI · 搜索模型（Chat Completions）",
		docs: "https://developers.openai.com/api/docs/guides/tools-web-search.md",
		defaults: {
			baseURL: "https://api.openai.com/v1",
			apiKeyEnv: ["OPENAI_API_KEY"],
			model: "gpt-5-search-api",
			maxOutputTokens: 4096
		},
		fields: [...CONNECTION, ...MODEL],
		search: { kind: "chat-search-model", path: "/chat/completions", sourceQuality: "partial" },
		modelLocked: true,
		hints: { model: "必须是搜索模型，否则不会联网" }
	},
	"openai/responses": {
		id: "openai/responses",
		vendor: "openai",
		protocol: "responses",
		support: "full",
		title: "OpenAI · Responses",
		docs: "https://developers.openai.com/api/docs/guides/tools-web-search.md",
		defaults: {
			baseURL: "https://api.openai.com/v1",
			apiKeyEnv: ["OPENAI_API_KEY"],
			model: "gpt-5.5",
			maxOutputTokens: 4096,
			toolType: "web_search",
			includeSources: true,
			reasoningEffort: "",
			searchContextSize: "medium",
			allowedDomains: "",
			blockedDomains: "",
			userLocation: "",
			externalWebAccess: "",
			returnTokenBudget: "",
			searchContentTypes: "",
			imageMaxResults: 0,
			imageCaption: false
		},
		fields: [...CONNECTION, ...MODEL, "toolType", "includeSources", "reasoningEffort", "searchContextSize", "allowedDomains", "blockedDomains", "userLocation", "externalWebAccess", "returnTokenBudget", "searchContentTypes", "imageMaxResults", "imageCaption"],
		search: { kind: "responses-tool", path: "/responses", toolType: "web_search", includeSources: true, sourceQuality: "full" },
		hints: { includeSources: "关闭后真实 OpenAI 端点不返回 sources[]" }
	},
	"anthropic/anthropic-messages": {
		id: "anthropic/anthropic-messages",
		vendor: "anthropic",
		protocol: "anthropic-messages",
		support: "full",
		title: "Anthropic · Messages",
		docs: "https://platform.claude.com/docs/en/agents-and-tools/tool-use/web-search-tool",
		defaults: {
			baseURL: "https://api.anthropic.com",
			apiKeyEnv: ["ANTHROPIC_API_KEY"],
			model: "claude-opus-5-5",
			maxOutputTokens: 4096,
			toolType: "web_search_20250305",
			maxUses: 5,
			thinking: "default",
			effort: "",
			allowedDomains: "",
			blockedDomains: "",
			userLocation: "",
			responseInclusion: ""
		},
		fields: [...CONNECTION, ...MODEL, "toolType", "maxUses", "thinking", "effort", "allowedDomains", "blockedDomains", "userLocation", "responseInclusion"],
		search: { kind: "anthropic-tool", path: "/v1/messages", toolType: "web_search_20250305", sourceQuality: "full" },
		hints: { toolType: "可选 web_search_20250305 / web_search_20260209 / web_search_20260318" }
	},
	"openrouter/chat-completions": {
		id: "openrouter/chat-completions",
		vendor: "openrouter",
		protocol: "chat-completions",
		support: "full",
		title: "OpenRouter · Chat Completions",
		docs: "https://openrouter.ai/docs/guides/features/server-tools/web-search.md",
		defaults: {
			baseURL: "https://openrouter.ai/api/v1",
			apiKeyEnv: ["OPENROUTER_API_KEY"],
			model: "",
			maxOutputTokens: 4096,
			engine: "auto",
			mode: "",
			maxResults: 5,
			maxUses: 3,
			maxTotalResults: 15,
			searchContextSize: "medium",
			allowedDomains: "",
			excludedDomains: "",
			userLocation: "",
			xSearch: ""
		},
		fields: [...CONNECTION, ...MODEL, "engine", "mode", "maxResults", "maxUses", "maxTotalResults", "searchContextSize", "maxCharacters", "allowedDomains", "excludedDomains", "userLocation", "xSearch"],
		search: { kind: "chat-tool", path: "/chat/completions", toolType: "openrouter:web_search", sourceQuality: "partial" },
		hints: { model: "必须填写 OpenRouter 上的模型 id" }
	},
	"openrouter/responses": {
		id: "openrouter/responses",
		vendor: "openrouter",
		protocol: "responses",
		support: "full",
		title: "OpenRouter · Responses",
		docs: "https://openrouter.ai/docs/guides/features/server-tools/web-search.md",
		defaults: {
			baseURL: "https://openrouter.ai/api/v1",
			apiKeyEnv: ["OPENROUTER_API_KEY"],
			model: "",
			maxOutputTokens: 4096,
			toolType: "openrouter:web_search",
			includeSources: true,
			reasoningEffort: "",
			engine: "auto",
			mode: "",
			maxResults: 5,
			maxUses: 3,
			maxTotalResults: 15,
			searchContextSize: "medium",
			allowedDomains: "",
			excludedDomains: "",
			userLocation: "",
			xSearch: ""
		},
		fields: [...CONNECTION, ...MODEL, "toolType", "includeSources", "reasoningEffort", "engine", "mode", "maxResults", "maxUses", "maxTotalResults", "searchContextSize", "maxCharacters", "allowedDomains", "excludedDomains", "userLocation", "xSearch"],
		search: { kind: "responses-tool", path: "/responses", toolType: "openrouter:web_search", includeSources: true, sourceQuality: "full" },
		hints: { model: "必须填写 OpenRouter 上的模型 id" }
	},
	"openrouter/anthropic-messages": {
		id: "openrouter/anthropic-messages",
		vendor: "openrouter",
		protocol: "anthropic-messages",
		support: "degraded",
		reason: "`web_search_20250305` 别名尚未实测；按 Anthropic 同形响应解析",
		title: "OpenRouter · Anthropic 兼容 Messages",
		docs: "https://openrouter.ai/docs/client-sdks/typescript/models/servertooldetails",
		defaults: {
			baseURL: "https://openrouter.ai/api",
			apiKeyEnv: ["OPENROUTER_API_KEY"],
			model: "",
			maxOutputTokens: 4096,
			toolType: "web_search_20250305",
			maxUses: 5,
			thinking: "default",
			effort: ""
		},
		fields: [...CONNECTION, ...MODEL, "toolType", "maxUses"],
		search: { kind: "anthropic-tool", path: "/v1/messages", toolType: "web_search_20250305", sourceQuality: "partial" },
		hints: { model: "必须填写 OpenRouter 上的模型 id" }
	}
};

/** 只用于折叠区展示的组合；它们不在 17 个官方 target 与 4 个自定义的计数内。 */
export const UNSUPPORTED_CATALOG: Record<string, Capability> = {
	"deepseek/chat-completions": {
		id: "deepseek/chat-completions",
		vendor: "deepseek",
		protocol: "chat-completions",
		support: "unsupported",
		reason: "Chat Completions 没有内置搜索；联网能力只在 Responses（仅 deepseek-v4-pro）与 Anthropic Messages",
		title: "DeepSeek · Chat Completions（不可用）",
		defaults: { baseURL: "https://api.deepseek.com", apiKeyEnv: ["DEEPSEEK_API_KEY"] },
		fields: [],
		search: { kind: "chat-tool", path: "/chat/completions", sourceQuality: "none" }
	},
	"anthropic/chat-completions": {
		id: "anthropic/chat-completions",
		vendor: "anthropic",
		protocol: "chat-completions",
		support: "unsupported",
		reason: "Anthropic 不提供 Chat Completions 协议，只有 Messages API",
		title: "Anthropic · Chat Completions（协议不存在）",
		defaults: { baseURL: "https://api.anthropic.com", apiKeyEnv: ["ANTHROPIC_API_KEY"] },
		fields: [],
		search: { kind: "chat-tool", path: "/chat/completions", sourceQuality: "none" }
	},
	"kimi/anthropic-messages": {
		id: "kimi/anthropic-messages",
		vendor: "kimi",
		protocol: "anthropic-messages",
		support: "unsupported",
		reason: "Messages 的 tools schema 只有 custom（函数工具），没有 web_search 服务端工具",
		title: "Kimi · Anthropic Messages（无服务端搜索）",
		defaults: { baseURL: "https://api.moonshot.cn/anthropic", apiKeyEnv: ["MOONSHOT_API_KEY"] },
		fields: [],
		search: { kind: "anthropic-tool", path: "/anthropic/v1/messages", sourceQuality: "none" }
	},
	"zhipu/anthropic-messages": {
		id: "zhipu/anthropic-messages",
		vendor: "zhipu",
		protocol: "anthropic-messages",
		support: "unsupported",
		reason: "接受 web_search_20250305 声明但不执行（实测 usage.server_tool_use.web_search_requests = 0）",
		title: "智谱 · Anthropic Messages（不执行搜索）",
		defaults: { baseURL: "https://open.bigmodel.cn/api/anthropic", apiKeyEnv: ["ZAI_CODING_CN_API_KEY"] },
		fields: [],
		search: { kind: "anthropic-tool", path: "/v1/messages", sourceQuality: "none" }
	},
	"openai/anthropic-messages": {
		id: "openai/anthropic-messages",
		vendor: "openai",
		protocol: "anthropic-messages",
		support: "unsupported",
		reason: "OpenAI 没有 Anthropic 兼容端点",
		title: "OpenAI · Anthropic Messages（协议不存在）",
		defaults: { baseURL: "https://api.openai.com/v1", apiKeyEnv: ["OPENAI_API_KEY"] },
		fields: [],
		search: { kind: "anthropic-tool", path: "/v1/messages", sourceQuality: "none" }
	},
	"anthropic/responses": {
		id: "anthropic/responses",
		vendor: "anthropic",
		protocol: "responses",
		support: "unsupported",
		reason: "Anthropic 没有 Responses API",
		title: "Anthropic · Responses（协议不存在）",
		defaults: { baseURL: "https://api.anthropic.com", apiKeyEnv: ["ANTHROPIC_API_KEY"] },
		fields: [],
		search: { kind: "responses-tool", path: "/responses", sourceQuality: "none" }
	},
	"openrouter/search": {
		id: "openrouter/search",
		vendor: "openrouter",
		protocol: "search",
		support: "unsupported",
		reason: "OpenRouter 没有独立纯工具搜索接口",
		title: "OpenRouter · 纯工具搜索（无独立接口）",
		defaults: { baseURL: "https://openrouter.ai/api/v1", apiKeyEnv: ["OPENROUTER_API_KEY"] },
		fields: [],
		search: { kind: "standalone", path: "", sourceQuality: "none" }
	},
	"kimi/chat-completions": {
		id: "kimi/chat-completions",
		vendor: "kimi",
		protocol: "chat-completions",
		support: "unsupported",
		reason: "仅协议内置 $web_search（builtin_function）于 2026-10-20 下线；纯工具搜索 /v1/tools/search、/v1/tools/search_pro 长期支持，请改用「纯工具搜索」",
		title: "Kimi · Chat Completions（已停止接入）",
		docs: "https://platform.kimi.com/docs/guide/use-web-search",
		defaults: { baseURL: "https://api.moonshot.cn/v1", apiKeyEnv: ["MOONSHOT_API_KEY"] },
		fields: [],
		search: { kind: "chat-tool", path: "/chat/completions", sourceQuality: "none" }
	}
};

/** 4 个自定义入口；`support: "custom"` 表示需自测。 */
export const CUSTOM_TARGETS: Record<string, Capability> = {
	"custom/chat-completions": {
		id: "custom/chat-completions",
		vendor: "custom",
		protocol: "chat-completions",
		support: "custom",
		title: "自定义 · Chat Completions",
		defaults: {
			baseURL: "",
			apiKeyEnv: [],
			model: "",
			maxOutputTokens: 4096,
			template: "zhipu",
			chatVariant: "zhipu",
			...ZHIPU_DEFAULTS,
			/** 自定义网关的引擎取值各不相同：留空不发送，由模板或用户填写。 */
			searchEngine: "",
			requireSearch: false,
			searchPrompt: "",
			reasoningEffort: "low"
		},
		fields: ["chatVariant", ...CONNECTION, ...MODEL, ...ZHIPU_CHAT_SEARCH, "searchStrategy", "forcedSearch", "freshness", "assignedSiteList", "searchExtension", "promptIntervene", "engine", "mode", "maxResults", "maxUses", "maxTotalResults", "searchContextSize", "maxCharacters", "userLocation", "allowedDomains", "excludedDomains", "xSearch"],
		search: { kind: "chat-tool", path: "/chat/completions", toolType: "web_search", sourceQuality: "full" },
		hints: {},
		templates: [
			{ id: "zhipu", label: "智谱问答增强", chatVariant: "zhipu", defaults: { baseURL: "https://open.bigmodel.cn/api/paas/v4", apiKeyEnv: ["ZAI_CODING_CN_API_KEY"], model: "glm-5.3-flash", ...ZHIPU_DEFAULTS, reasoningEffort: "low" } },
			{ id: "qwen", label: "千问联网搜索", chatVariant: "qwen", defaults: { baseURL: "https://maas.qianwenaiapi.com/compatible-mode/v1", apiKeyEnv: ["DASHSCOPE_API_KEY"], model: "qwen3.8-flash", searchStrategy: "turbo", forcedSearch: false } },
			{ id: "openrouter", label: "OpenRouter Server Tool", chatVariant: "openrouter", defaults: { baseURL: "https://openrouter.ai/api/v1", apiKeyEnv: ["OPENROUTER_API_KEY"], engine: "auto", maxResults: 5, maxUses: 3, maxTotalResults: 15, searchContextSize: "medium" } },
			{ id: "openai-search-model", label: "OpenAI 搜索模型", chatVariant: "openai-search-model", defaults: { baseURL: "https://api.openai.com/v1", apiKeyEnv: ["OPENAI_API_KEY"], model: "gpt-5-search-api" } }
		]
	},
	"custom/responses": {
		id: "custom/responses",
		vendor: "custom",
		protocol: "responses",
		support: "custom",
		title: "自定义 · Responses",
		defaults: {
			baseURL: "",
			apiKeyEnv: [],
			model: "",
			maxOutputTokens: 4096,
			template: "openai",
			toolType: "web_search",
			includeSources: true,
			reasoningEffort: ""
		},
		fields: [...CONNECTION, ...MODEL, "toolType", "includeSources", "reasoningEffort", "searchContextSize", "allowedDomains", "blockedDomains", "engine", "mode", "maxResults", "maxUses", "maxTotalResults", "maxCharacters", "userLocation", "excludedDomains", "xSearch"],
		search: { kind: "responses-tool", path: "/responses", toolType: "web_search", includeSources: true, sourceQuality: "partial" },
		hints: { toolType: "web_search / openrouter:web_search / web_search_20250305" },
		templates: [
			{ id: "openai", label: "OpenAI Responses", toolType: "web_search", defaults: { baseURL: "https://api.openai.com/v1", apiKeyEnv: ["OPENAI_API_KEY"], model: "gpt-5.5", includeSources: true } },
			{ id: "openrouter", label: "OpenRouter Responses", toolType: "openrouter:web_search", defaults: { baseURL: "https://openrouter.ai/api/v1", apiKeyEnv: ["OPENROUTER_API_KEY"], includeSources: true, engine: "auto", maxResults: 5, maxUses: 3, maxTotalResults: 15, searchContextSize: "medium" } },
			{ id: "kimi", label: "Kimi Responses", toolType: "web_search", defaults: { baseURL: "https://api.moonshot.cn/v1", apiKeyEnv: ["MOONSHOT_API_KEY", "KIMI_API_KEY", "KIMI_CODING_API_KEY"], model: "kimi-k2.6", includeSources: true } },
			{ id: "zhipu", label: "智谱 Responses", toolType: "web_search", defaults: { baseURL: "https://open.bigmodel.cn/api/v1", apiKeyEnv: ["ZAI_CODING_CN_API_KEY"], model: "glm-5.3", includeSources: true } },
			{ id: "deepseek", label: "DeepSeek Responses", toolType: "web_search", defaults: { baseURL: "https://api.deepseek.com", apiKeyEnv: ["DEEPSEEK_API_KEY"], model: "deepseek-v4-pro", includeSources: false } }
		]
	},
	"custom/anthropic-messages": {
		id: "custom/anthropic-messages",
		vendor: "custom",
		protocol: "anthropic-messages",
		support: "custom",
		title: "自定义 · Anthropic 兼容 Messages",
		defaults: {
			baseURL: "",
			apiKeyEnv: [],
			model: "",
			maxOutputTokens: 4096,
			template: "anthropic",
			toolType: "web_search_20250305",
			maxUses: 5,
			thinking: "default",
			effort: "",
			allowedDomains: "",
			blockedDomains: ""
		},
		fields: [...CONNECTION, ...MODEL, "toolType", "maxUses", "thinking", "effort", "allowedDomains", "blockedDomains"],
		search: { kind: "anthropic-tool", path: "/v1/messages", toolType: "web_search_20250305", sourceQuality: "partial" },
		hints: { toolType: "可填 Anthropic 的任意 web_search_* 版本" },
		templates: [
			{ id: "anthropic", label: "Anthropic Messages", toolType: "web_search_20250305", defaults: { baseURL: "https://api.anthropic.com", apiKeyEnv: ["ANTHROPIC_API_KEY"], model: "claude-opus-5-5" } },
			{ id: "deepseek", label: "DeepSeek Anthropic 兼容", toolType: "web_search_20250305", defaults: { baseURL: "https://api.deepseek.com/anthropic", apiKeyEnv: ["DEEPSEEK_API_KEY"], model: "deepseek-flash", maxOutputTokens: 65536 } },
			{ id: "qwen", label: "千问 Anthropic 兼容", toolType: "web_search_20250305", defaults: { baseURL: "https://maas.qianwenaiapi.com/apps/anthropic", apiKeyEnv: ["DASHSCOPE_API_KEY"], model: "qwen3.8-max" } }
		]
	},
	"custom/search": {
		id: "custom/search",
		vendor: "custom",
		protocol: "search",
		support: "custom",
		title: "自定义 · 纯工具搜索",
		defaults: {
			baseURL: "",
			apiKeyEnv: [],
			template: "zhipu",
			path: "/web_search",
			includeContent: false,
			oriQuestion: true,
			...ZHIPU_DEFAULTS,
			/** 自定义网关的引擎取值各不相同：留空不发送，由模板或用户填写。 */
			searchEngine: "",
			digestEntries: 8,
			digestSnippetChars: 200
		},
		fields: [...CONNECTION, "path", "count", "includeContent", "oriQuestion", "searchRecencyFilter", "contentSize", "searchIntent", "searchDomainFilter", "searchEngine", "timeoutSeconds", "localization", "digestEntries", "digestSnippetChars", "queryField", "countField", "resultsPath", "urlField", "titleField", "snippetField", "dateField", "contentField"],
		search: { kind: "standalone", path: "/web_search", sourceQuality: "partial" },
		hints: {
			template: "决定请求字段名与响应结构；字段名可被高级项覆盖",
			queryField: "留空使用模板默认（智谱 search_query / DeepSeek query / Kimi text_query）"
		},
		templates: [
			{
				id: "zhipu",
				label: "智谱 Web Search",
				defaults: {
					baseURL: "https://open.bigmodel.cn/api/paas/v4",
					apiKeyEnv: ["ZAI_CODING_CN_API_KEY"],
					path: "/web_search",
					...ZHIPU_DEFAULTS,
					queryField: "search_query",
					countField: "count",
					resultsPath: "search_result",
					urlField: "link",
					titleField: "title",
					snippetField: "content",
					dateField: "",
					contentField: "content"
				}
			},
			{
				id: "deepseek",
				label: "DeepSeek 搜索",
				defaults: {
					baseURL: "https://api.deepseek.com",
					apiKeyEnv: ["DEEPSEEK_API_KEY"],
					path: "/v1/tools/search",
					count: 10,
					oriQuestion: true,
					localization: "",
					queryField: "query",
					countField: "count",
					resultsPath: "results",
					urlField: "url",
					titleField: "title",
					snippetField: "snippet",
					dateField: "",
					contentField: "summary"
				}
			},
			{
				id: "kimi",
				label: "Kimi 搜索",
				defaults: {
					baseURL: "https://api.moonshot.cn",
					apiKeyEnv: ["MOONSHOT_API_KEY", "KIMI_API_KEY", "KIMI_CODING_API_KEY"],
					path: "/v1/tools/search",
					count: 10,
					timeoutSeconds: 30,
					queryField: "text_query",
					countField: "limit",
					resultsPath: "search_results",
					urlField: "url",
					titleField: "title",
					snippetField: "snippet",
					dateField: "",
					contentField: ""
				}
			}
		]
	}
};

/** 官方 target id 列表（17 个，不含不支持项与自定义）。 */
export const OFFICIAL_TARGET_IDS = Object.keys(CATALOG) as TargetId[];

/** 自定义 target id 列表（4 个）。 */
export const CUSTOM_TARGET_IDS = Object.keys(CUSTOM_TARGETS) as TargetId[];

/** 全部 target（含自定义与不支持项），供配置页渲染。 */
export const ALL_TARGETS: Record<string, Capability> = { ...CATALOG, ...UNSUPPORTED_CATALOG, ...CUSTOM_TARGETS };

/** 搜索形态：`in-protocol` 走模型回合，`standalone` 是纯工具搜索。 */
export type Shape = "in-protocol" | "standalone";

/**
 * 每种搜索形态的默认 target：切换搜索方式时落到这里，两边都优先 DeepSeek 官方组合。
 *
 * 协议内置形态下 DeepSeek 只有 Anthropic Messages 是完整支持（Responses 仅
 * `deepseek-v4-pro`、来源不完整），因此默认协议是 `anthropic-messages`。
 */
export const SHAPE_DEFAULT_TARGETS: Readonly<Record<Shape, TargetId>> = {
	"in-protocol": "deepseek/anthropic-messages",
	standalone: "deepseek/search"
};

/** 默认 target：DeepSeek 官方纯工具搜索，不依赖模型回合，首次使用即可直接生效。 */
export const DEFAULT_TARGET: TargetId = SHAPE_DEFAULT_TARGETS.standalone;

/** 厂商展示顺序。 */
export const VENDORS: readonly Vendor[] = ["deepseek", "kimi", "zhipu", "qwen", "openai", "anthropic", "openrouter", "custom"];

/** 协议展示顺序。 */
export const PROTOCOLS: readonly Protocol[] = ["chat-completions", "responses", "anthropic-messages", "search"];

/** True when `value` is a known target id. */
export function isTargetId(value: unknown): value is TargetId {
	return typeof value === "string" && Object.hasOwn(ALL_TARGETS, value);
}

/** Combine a vendor and protocol into a target id. */
export function targetIdOf(vendor: Vendor, protocol: Protocol): TargetId {
	return `${vendor}/${protocol}`;
}

/** Split a target id into its parts; undefined when malformed. */
export function splitTargetId(id: string): { vendor: Vendor; protocol: Protocol } | undefined {
	const index = id.indexOf("/");
	if (index <= 0) return void 0;
	const vendor = id.slice(0, index);
	const protocol = id.slice(index + 1);
	if (!(VENDORS as readonly string[]).includes(vendor)) return void 0;
	if (!(PROTOCOLS as readonly string[]).includes(protocol)) return void 0;
	return { vendor: vendor as Vendor, protocol: protocol as Protocol };
}

/** The capability for one target id, or undefined for an unknown id. */
export function capabilityOf(id: string): Capability | undefined {
	return Object.hasOwn(ALL_TARGETS, id) ? ALL_TARGETS[id] : void 0;
}

/** True for a target that may be selected and saved (everything but `unsupported`). */
export function isSelectable(id: string): boolean {
	const capability = capabilityOf(id);
	return capability !== void 0 && capability.support !== "unsupported";
}

/**
 * 拼接端点的相对路径。
 *
 * 默认端点已经包含版本段的厂商（`/v1`、`/compatible-mode/v1`、`/paas/v4`）直接追加
 * 协议路径；`path` 自己带版本段而 `baseURL` 已以同一段结尾时去重，避免出现
 * `/v1/v1/messages`。用户填的 baseURL 以协议路径结尾时直接使用，不再重复追加。
 *
 * @param baseURL - 已去掉尾斜杠的端点前缀。
 * @param path - 协议路径（以 `/` 开头）。
 * @returns 完整请求 URL。
 */
export function joinEndpoint(baseURL: string, path: string): string {
	const base = baseURL.replace(/\/+$/u, "");
	if (base.endsWith(path)) return base;
	const version = /^\/v\d+\//u.exec(path);
	if (version !== null && base.endsWith(version[0].slice(0, -1))) return `${base}${path.slice(version[0].length - 1)}`;
	return `${base}${path}`;
}

/** 兼容旧配置的 `mode` 到 target 的映射；2.0 只用于迁移。 */
export const LEGACY_MODE_TARGETS: Readonly<Record<string, TargetId>> = {
	responses: "qwen/responses",
	"anthropic-messages": "deepseek/anthropic-messages",
	"zhipu-web-search": "zhipu/search",
	"zhipu-chat-search": "zhipu/chat-completions"
};
/** True when the target exposes (and therefore accepts) one configuration key. */
export function hasField(capability: Capability, key: FieldKey): boolean {
	return capability.fields.includes(key);
}

/** 逗号分隔的域名列表拆成数组；空串得到空数组。 */
export function splitList(value: string): string[] {
	return value.split(/[,，\s]+/u).map((item) => item.trim()).filter((item) => item.length > 0);
}
