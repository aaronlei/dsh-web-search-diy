import { credentialRef, isCredentialRefName } from "@deepseek-ai/dsh-credentials";
import { copyFileSync, existsSync, mkdirSync, readFileSync, renameSync, unlinkSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { launchEnvironmentOf } from "@deepseek-ai/dsh-launch-environment";
import { WebError } from "@deepseek-ai/dsh-web";
import { gunzipSync, inflateSync } from "node:zlib";
import { randomUUID } from "node:crypto";
import { isIP } from "node:net";
//#region src/catalog.ts
/** 通用连接与模型字段，几乎每个 target 都有。 */
const CONNECTION = ["baseURL", "apiKeyEnv"];
/** 有模型回合的 target 通用字段。 */
const MODEL = ["model", "maxOutputTokens"];
/** Responses 协议的高级字段。 */
const RESPONSES_ADVANCED = [
	"toolType",
	"includeSources",
	"reasoningEffort"
];
/** Anthropic 协议的高级字段。 */
const ANTHROPIC_ADVANCED = [
	"toolType",
	"maxUses",
	"thinking",
	"effort"
];
/** 智谱 Chat 的搜索字段。 */
const ZHIPU_CHAT_SEARCH = [
	"searchEngine",
	"count",
	"searchRecencyFilter",
	"contentSize",
	"searchDomainFilter",
	"searchIntent",
	"requireSearch",
	"searchPrompt",
	"reasoningEffort"
];
/** 智谱原始搜索的字段。 */
const ZHIPU_STANDALONE = [
	"searchEngine",
	"count",
	"searchRecencyFilter",
	"contentSize",
	"searchDomainFilter",
	"searchIntent"
];
/** 智谱两个 target 共用的默认搜索参数。 */
const ZHIPU_DEFAULTS = {
	searchEngine: "search_std",
	count: 10,
	searchRecencyFilter: "noLimit",
	contentSize: "medium",
	searchIntent: false
};
/**
* 官方 target 能力表。
*
* 支持度与默认值来自 `docs/厂商×协议-web_search-文档与兼容性明细.md` 的实测结论；
* 默认模型只是当前文档示例，发版前按官方模型页更新。
*/
const CATALOG = {
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
		fields: [
			...CONNECTION,
			...MODEL,
			...ANTHROPIC_ADVANCED
		],
		search: {
			kind: "anthropic-tool",
			path: "/v1/messages",
			toolType: "web_search_20250305",
			sourceQuality: "full"
		},
		hints: {
			thinking: "仅 disabled 能可靠关闭思考（实测）",
			effort: "留空不发送 output_config.effort"
		}
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
		fields: [
			...CONNECTION,
			...MODEL,
			"toolType"
		],
		search: {
			kind: "responses-tool",
			path: "/v1/responses",
			toolType: "web_search",
			sourceQuality: "partial"
		},
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
		fields: [
			...CONNECTION,
			"count",
			"includeContent",
			"oriQuestion",
			"localization",
			"digestEntries",
			"digestSnippetChars"
		],
		hints: { localization: "填 IP 地址（用于地域），留空不发送；非 IPv4/IPv6 会被忽略" },
		search: {
			kind: "standalone",
			path: "/v1/tools/search",
			sourceQuality: "full"
		}
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
			apiKeyEnv: [
				"MOONSHOT_API_KEY",
				"KIMI_API_KEY",
				"KIMI_CODING_API_KEY"
			],
			model: "kimi-k2.6",
			maxOutputTokens: 4096,
			toolType: "web_search",
			includeSources: true,
			allowedDomains: "",
			reasoningEffort: ""
		},
		fields: [
			...CONNECTION,
			...MODEL,
			"toolType",
			"includeSources",
			"allowedDomains"
		],
		search: {
			kind: "responses-tool",
			path: "/responses",
			toolType: "web_search",
			includeSources: true,
			sourceQuality: "full"
		},
		hints: {
			includeSources: "Kimi 的 action.sources[] 自带 title",
			allowedDomains: "Kimi 支持 filters.allowed_domains；blocked_domains 与 search_context_size 会 400，因此不提供",
			apiKeyEnv: "Kimi 即月之暗面，有两个入口：开放平台 api.moonshot.cn 用 MOONSHOT_API_KEY；Kimi coding 端点 api.kimi.com/coding 用 KIMI_API_KEY（DSH 自带的 kimi-coding provider）。key 与端点绑定，混用会 401"
		}
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
			apiKeyEnv: [
				"MOONSHOT_API_KEY",
				"KIMI_API_KEY",
				"KIMI_CODING_API_KEY"
			],
			count: 10,
			includeContent: false,
			timeoutSeconds: 30,
			digestEntries: 8,
			digestSnippetChars: 200
		},
		fields: [
			...CONNECTION,
			"count",
			"includeContent",
			"timeoutSeconds",
			"digestEntries",
			"digestSnippetChars"
		],
		search: {
			kind: "standalone",
			path: "/v1/tools/search",
			sourceQuality: "full"
		},
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
		fields: [
			...CONNECTION,
			...MODEL,
			...ZHIPU_CHAT_SEARCH
		],
		search: {
			kind: "chat-tool",
			path: "/chat/completions",
			toolType: "web_search",
			sourceQuality: "full"
		}
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
		fields: [
			...CONNECTION,
			...MODEL,
			...RESPONSES_ADVANCED
		],
		search: {
			kind: "responses-tool",
			path: "/responses",
			toolType: "web_search",
			includeSources: true,
			sourceQuality: "full"
		},
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
		fields: [
			...CONNECTION,
			...ZHIPU_STANDALONE,
			"digestEntries",
			"digestSnippetChars"
		],
		search: {
			kind: "standalone",
			path: "/web_search",
			sourceQuality: "full"
		},
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
			apiKeyEnv: [
				"QWEN_TOKEN_PLAN_API_KEY",
				"QWEN_TOKEN_PLAN_CN_API_KEY",
				"DASHSCOPE_API_KEY"
			],
			model: "qwen3.8-flash",
			maxOutputTokens: 4096,
			searchStrategy: "turbo",
			forcedSearch: false,
			freshness: "",
			assignedSiteList: "",
			searchExtension: "",
			promptIntervene: ""
		},
		fields: [
			...CONNECTION,
			...MODEL,
			"searchStrategy",
			"forcedSearch",
			"freshness",
			"assignedSiteList",
			"searchExtension",
			"promptIntervene"
		],
		search: {
			kind: "chat-param",
			path: "/chat/completions",
			sourceQuality: "none"
		},
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
			apiKeyEnv: [
				"QWEN_TOKEN_PLAN_API_KEY",
				"QWEN_TOKEN_PLAN_CN_API_KEY",
				"DASHSCOPE_API_KEY"
			],
			model: "qwen3.8-flash",
			maxOutputTokens: 4096,
			toolType: "web_search",
			includeSources: true,
			reasoningEffort: ""
		},
		fields: [
			...CONNECTION,
			...MODEL,
			"toolType",
			"includeSources",
			"reasoningEffort"
		],
		search: {
			kind: "responses-tool",
			path: "/responses",
			toolType: "web_search",
			includeSources: true,
			sourceQuality: "partial"
		},
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
			apiKeyEnv: [
				"QWEN_TOKEN_PLAN_API_KEY",
				"QWEN_TOKEN_PLAN_CN_API_KEY",
				"DASHSCOPE_API_KEY"
			],
			model: "qwen3.8-max",
			maxOutputTokens: 4096,
			toolType: "web_search_20250305",
			maxUses: 5,
			thinking: "default",
			effort: ""
		},
		fields: [
			...CONNECTION,
			...MODEL,
			"toolType",
			"maxUses"
		],
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
		search: {
			kind: "chat-search-model",
			path: "/chat/completions",
			sourceQuality: "partial"
		},
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
		fields: [
			...CONNECTION,
			...MODEL,
			"toolType",
			"includeSources",
			"reasoningEffort",
			"searchContextSize",
			"allowedDomains",
			"blockedDomains",
			"userLocation",
			"externalWebAccess",
			"returnTokenBudget",
			"searchContentTypes",
			"imageMaxResults",
			"imageCaption"
		],
		search: {
			kind: "responses-tool",
			path: "/responses",
			toolType: "web_search",
			includeSources: true,
			sourceQuality: "full"
		},
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
		fields: [
			...CONNECTION,
			...MODEL,
			"toolType",
			"maxUses",
			"thinking",
			"effort",
			"allowedDomains",
			"blockedDomains",
			"userLocation",
			"responseInclusion"
		],
		search: {
			kind: "anthropic-tool",
			path: "/v1/messages",
			toolType: "web_search_20250305",
			sourceQuality: "full"
		},
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
		fields: [
			...CONNECTION,
			...MODEL,
			"engine",
			"mode",
			"maxResults",
			"maxUses",
			"maxTotalResults",
			"searchContextSize",
			"maxCharacters",
			"allowedDomains",
			"excludedDomains",
			"userLocation",
			"xSearch"
		],
		search: {
			kind: "chat-tool",
			path: "/chat/completions",
			toolType: "openrouter:web_search",
			sourceQuality: "partial"
		},
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
		fields: [
			...CONNECTION,
			...MODEL,
			"toolType",
			"includeSources",
			"reasoningEffort",
			"engine",
			"mode",
			"maxResults",
			"maxUses",
			"maxTotalResults",
			"searchContextSize",
			"maxCharacters",
			"allowedDomains",
			"excludedDomains",
			"userLocation",
			"xSearch"
		],
		search: {
			kind: "responses-tool",
			path: "/responses",
			toolType: "openrouter:web_search",
			includeSources: true,
			sourceQuality: "full"
		},
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
		fields: [
			...CONNECTION,
			...MODEL,
			"toolType",
			"maxUses"
		],
		search: {
			kind: "anthropic-tool",
			path: "/v1/messages",
			toolType: "web_search_20250305",
			sourceQuality: "partial"
		},
		hints: { model: "必须填写 OpenRouter 上的模型 id" }
	}
};
/** 只用于折叠区展示的组合；它们不在 17 个官方 target 与 4 个自定义的计数内。 */
const UNSUPPORTED_CATALOG = {
	"deepseek/chat-completions": {
		id: "deepseek/chat-completions",
		vendor: "deepseek",
		protocol: "chat-completions",
		support: "unsupported",
		reason: "Chat Completions 没有内置搜索；联网能力只在 Responses（仅 deepseek-v4-pro）与 Anthropic Messages",
		title: "DeepSeek · Chat Completions（不可用）",
		defaults: {
			baseURL: "https://api.deepseek.com",
			apiKeyEnv: ["DEEPSEEK_API_KEY"]
		},
		fields: [],
		search: {
			kind: "chat-tool",
			path: "/chat/completions",
			sourceQuality: "none"
		}
	},
	"anthropic/chat-completions": {
		id: "anthropic/chat-completions",
		vendor: "anthropic",
		protocol: "chat-completions",
		support: "unsupported",
		reason: "Anthropic 不提供 Chat Completions 协议，只有 Messages API",
		title: "Anthropic · Chat Completions（协议不存在）",
		defaults: {
			baseURL: "https://api.anthropic.com",
			apiKeyEnv: ["ANTHROPIC_API_KEY"]
		},
		fields: [],
		search: {
			kind: "chat-tool",
			path: "/chat/completions",
			sourceQuality: "none"
		}
	},
	"kimi/anthropic-messages": {
		id: "kimi/anthropic-messages",
		vendor: "kimi",
		protocol: "anthropic-messages",
		support: "unsupported",
		reason: "Messages 的 tools schema 只有 custom（函数工具），没有 web_search 服务端工具",
		title: "Kimi · Anthropic Messages（无服务端搜索）",
		defaults: {
			baseURL: "https://api.moonshot.cn/anthropic",
			apiKeyEnv: ["MOONSHOT_API_KEY"]
		},
		fields: [],
		search: {
			kind: "anthropic-tool",
			path: "/anthropic/v1/messages",
			sourceQuality: "none"
		}
	},
	"zhipu/anthropic-messages": {
		id: "zhipu/anthropic-messages",
		vendor: "zhipu",
		protocol: "anthropic-messages",
		support: "unsupported",
		reason: "接受 web_search_20250305 声明但不执行（实测 usage.server_tool_use.web_search_requests = 0）",
		title: "智谱 · Anthropic Messages（不执行搜索）",
		defaults: {
			baseURL: "https://open.bigmodel.cn/api/anthropic",
			apiKeyEnv: ["ZAI_CODING_CN_API_KEY"]
		},
		fields: [],
		search: {
			kind: "anthropic-tool",
			path: "/v1/messages",
			sourceQuality: "none"
		}
	},
	"openai/anthropic-messages": {
		id: "openai/anthropic-messages",
		vendor: "openai",
		protocol: "anthropic-messages",
		support: "unsupported",
		reason: "OpenAI 没有 Anthropic 兼容端点",
		title: "OpenAI · Anthropic Messages（协议不存在）",
		defaults: {
			baseURL: "https://api.openai.com/v1",
			apiKeyEnv: ["OPENAI_API_KEY"]
		},
		fields: [],
		search: {
			kind: "anthropic-tool",
			path: "/v1/messages",
			sourceQuality: "none"
		}
	},
	"anthropic/responses": {
		id: "anthropic/responses",
		vendor: "anthropic",
		protocol: "responses",
		support: "unsupported",
		reason: "Anthropic 没有 Responses API",
		title: "Anthropic · Responses（协议不存在）",
		defaults: {
			baseURL: "https://api.anthropic.com",
			apiKeyEnv: ["ANTHROPIC_API_KEY"]
		},
		fields: [],
		search: {
			kind: "responses-tool",
			path: "/responses",
			sourceQuality: "none"
		}
	},
	"openrouter/search": {
		id: "openrouter/search",
		vendor: "openrouter",
		protocol: "search",
		support: "unsupported",
		reason: "OpenRouter 没有独立纯工具搜索接口",
		title: "OpenRouter · 纯工具搜索（无独立接口）",
		defaults: {
			baseURL: "https://openrouter.ai/api/v1",
			apiKeyEnv: ["OPENROUTER_API_KEY"]
		},
		fields: [],
		search: {
			kind: "standalone",
			path: "",
			sourceQuality: "none"
		}
	},
	"kimi/chat-completions": {
		id: "kimi/chat-completions",
		vendor: "kimi",
		protocol: "chat-completions",
		support: "unsupported",
		reason: "仅协议内置 $web_search（builtin_function）于 2026-10-20 下线；纯工具搜索 /v1/tools/search、/v1/tools/search_pro 长期支持，请改用「纯工具搜索」",
		title: "Kimi · Chat Completions（已停止接入）",
		docs: "https://platform.kimi.com/docs/guide/use-web-search",
		defaults: {
			baseURL: "https://api.moonshot.cn/v1",
			apiKeyEnv: ["MOONSHOT_API_KEY"]
		},
		fields: [],
		search: {
			kind: "chat-tool",
			path: "/chat/completions",
			sourceQuality: "none"
		}
	}
};
/** 4 个自定义入口；`support: "custom"` 表示需自测。 */
const CUSTOM_TARGETS = {
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
		fields: [
			"chatVariant",
			...CONNECTION,
			...MODEL,
			...ZHIPU_CHAT_SEARCH,
			"searchStrategy",
			"forcedSearch",
			"freshness",
			"assignedSiteList",
			"searchExtension",
			"promptIntervene",
			"engine",
			"mode",
			"maxResults",
			"maxUses",
			"maxTotalResults",
			"searchContextSize",
			"maxCharacters",
			"userLocation",
			"allowedDomains",
			"excludedDomains",
			"xSearch"
		],
		search: {
			kind: "chat-tool",
			path: "/chat/completions",
			toolType: "web_search",
			sourceQuality: "full"
		},
		hints: {},
		templates: [
			{
				id: "zhipu",
				label: "智谱问答增强",
				chatVariant: "zhipu",
				defaults: {
					baseURL: "https://open.bigmodel.cn/api/paas/v4",
					apiKeyEnv: ["ZAI_CODING_CN_API_KEY"],
					model: "glm-5.3-flash",
					...ZHIPU_DEFAULTS,
					reasoningEffort: "low"
				}
			},
			{
				id: "qwen",
				label: "千问联网搜索",
				chatVariant: "qwen",
				defaults: {
					baseURL: "https://maas.qianwenaiapi.com/compatible-mode/v1",
					apiKeyEnv: ["DASHSCOPE_API_KEY"],
					model: "qwen3.8-flash",
					searchStrategy: "turbo",
					forcedSearch: false
				}
			},
			{
				id: "openrouter",
				label: "OpenRouter Server Tool",
				chatVariant: "openrouter",
				defaults: {
					baseURL: "https://openrouter.ai/api/v1",
					apiKeyEnv: ["OPENROUTER_API_KEY"],
					engine: "auto",
					maxResults: 5,
					maxUses: 3,
					maxTotalResults: 15,
					searchContextSize: "medium"
				}
			},
			{
				id: "openai-search-model",
				label: "OpenAI 搜索模型",
				chatVariant: "openai-search-model",
				defaults: {
					baseURL: "https://api.openai.com/v1",
					apiKeyEnv: ["OPENAI_API_KEY"],
					model: "gpt-5-search-api"
				}
			}
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
		fields: [
			...CONNECTION,
			...MODEL,
			"toolType",
			"includeSources",
			"reasoningEffort",
			"searchContextSize",
			"allowedDomains",
			"blockedDomains",
			"engine",
			"mode",
			"maxResults",
			"maxUses",
			"maxTotalResults",
			"maxCharacters",
			"userLocation",
			"excludedDomains",
			"xSearch"
		],
		search: {
			kind: "responses-tool",
			path: "/responses",
			toolType: "web_search",
			includeSources: true,
			sourceQuality: "partial"
		},
		hints: { toolType: "web_search / openrouter:web_search / web_search_20250305" },
		templates: [
			{
				id: "openai",
				label: "OpenAI Responses",
				toolType: "web_search",
				defaults: {
					baseURL: "https://api.openai.com/v1",
					apiKeyEnv: ["OPENAI_API_KEY"],
					model: "gpt-5.5",
					includeSources: true
				}
			},
			{
				id: "openrouter",
				label: "OpenRouter Responses",
				toolType: "openrouter:web_search",
				defaults: {
					baseURL: "https://openrouter.ai/api/v1",
					apiKeyEnv: ["OPENROUTER_API_KEY"],
					includeSources: true,
					engine: "auto",
					maxResults: 5,
					maxUses: 3,
					maxTotalResults: 15,
					searchContextSize: "medium"
				}
			},
			{
				id: "kimi",
				label: "Kimi Responses",
				toolType: "web_search",
				defaults: {
					baseURL: "https://api.moonshot.cn/v1",
					apiKeyEnv: [
						"MOONSHOT_API_KEY",
						"KIMI_API_KEY",
						"KIMI_CODING_API_KEY"
					],
					model: "kimi-k2.6",
					includeSources: true
				}
			},
			{
				id: "zhipu",
				label: "智谱 Responses",
				toolType: "web_search",
				defaults: {
					baseURL: "https://open.bigmodel.cn/api/v1",
					apiKeyEnv: ["ZAI_CODING_CN_API_KEY"],
					model: "glm-5.3",
					includeSources: true
				}
			},
			{
				id: "deepseek",
				label: "DeepSeek Responses",
				toolType: "web_search",
				defaults: {
					baseURL: "https://api.deepseek.com",
					apiKeyEnv: ["DEEPSEEK_API_KEY"],
					model: "deepseek-v4-pro",
					includeSources: false
				}
			}
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
		fields: [
			...CONNECTION,
			...MODEL,
			"toolType",
			"maxUses",
			"thinking",
			"effort",
			"allowedDomains",
			"blockedDomains"
		],
		search: {
			kind: "anthropic-tool",
			path: "/v1/messages",
			toolType: "web_search_20250305",
			sourceQuality: "partial"
		},
		hints: { toolType: "可填 Anthropic 的任意 web_search_* 版本" },
		templates: [
			{
				id: "anthropic",
				label: "Anthropic Messages",
				toolType: "web_search_20250305",
				defaults: {
					baseURL: "https://api.anthropic.com",
					apiKeyEnv: ["ANTHROPIC_API_KEY"],
					model: "claude-opus-5-5"
				}
			},
			{
				id: "deepseek",
				label: "DeepSeek Anthropic 兼容",
				toolType: "web_search_20250305",
				defaults: {
					baseURL: "https://api.deepseek.com/anthropic",
					apiKeyEnv: ["DEEPSEEK_API_KEY"],
					model: "deepseek-flash",
					maxOutputTokens: 65536
				}
			},
			{
				id: "qwen",
				label: "千问 Anthropic 兼容",
				toolType: "web_search_20250305",
				defaults: {
					baseURL: "https://maas.qianwenaiapi.com/apps/anthropic",
					apiKeyEnv: ["DASHSCOPE_API_KEY"],
					model: "qwen3.8-max"
				}
			}
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
		fields: [
			...CONNECTION,
			"path",
			"count",
			"includeContent",
			"oriQuestion",
			"searchRecencyFilter",
			"contentSize",
			"searchIntent",
			"searchDomainFilter",
			"searchEngine",
			"timeoutSeconds",
			"localization",
			"digestEntries",
			"digestSnippetChars",
			"queryField",
			"countField",
			"resultsPath",
			"urlField",
			"titleField",
			"snippetField",
			"dateField",
			"contentField"
		],
		search: {
			kind: "standalone",
			path: "/web_search",
			sourceQuality: "partial"
		},
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
					apiKeyEnv: [
						"MOONSHOT_API_KEY",
						"KIMI_API_KEY",
						"KIMI_CODING_API_KEY"
					],
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
const OFFICIAL_TARGET_IDS = Object.keys(CATALOG);
Object.keys(CUSTOM_TARGETS);
/** 全部 target（含自定义与不支持项），供配置页渲染。 */
const ALL_TARGETS = {
	...CATALOG,
	...UNSUPPORTED_CATALOG,
	...CUSTOM_TARGETS
};
/**
* 每种搜索形态的默认 target：切换搜索方式时落到这里，两边都优先 DeepSeek 官方组合。
*
* 协议内置形态下 DeepSeek 只有 Anthropic Messages 是完整支持（Responses 仅
* `deepseek-v4-pro`、来源不完整），因此默认协议是 `anthropic-messages`。
*/
const SHAPE_DEFAULT_TARGETS = {
	"in-protocol": "deepseek/anthropic-messages",
	standalone: "deepseek/search"
};
/** 默认 target：DeepSeek 官方纯工具搜索，不依赖模型回合，首次使用即可直接生效。 */
const DEFAULT_TARGET = SHAPE_DEFAULT_TARGETS.standalone;
/** 厂商展示顺序。 */
const VENDORS = [
	"deepseek",
	"kimi",
	"zhipu",
	"qwen",
	"openai",
	"anthropic",
	"openrouter",
	"custom"
];
/** 协议展示顺序。 */
const PROTOCOLS = [
	"chat-completions",
	"responses",
	"anthropic-messages",
	"search"
];
/** True when `value` is a known target id. */
function isTargetId(value) {
	return typeof value === "string" && Object.hasOwn(ALL_TARGETS, value);
}
/** Combine a vendor and protocol into a target id. */
function targetIdOf(vendor, protocol) {
	return `${vendor}/${protocol}`;
}
/** Split a target id into its parts; undefined when malformed. */
function splitTargetId(id) {
	const index = id.indexOf("/");
	if (index <= 0) return void 0;
	const vendor = id.slice(0, index);
	const protocol = id.slice(index + 1);
	if (!VENDORS.includes(vendor)) return void 0;
	if (!PROTOCOLS.includes(protocol)) return void 0;
	return {
		vendor,
		protocol
	};
}
/** The capability for one target id, or undefined for an unknown id. */
function capabilityOf(id) {
	return Object.hasOwn(ALL_TARGETS, id) ? ALL_TARGETS[id] : void 0;
}
/** True for a target that may be selected and saved (everything but `unsupported`). */
function isSelectable(id) {
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
function joinEndpoint(baseURL, path) {
	const base = baseURL.replace(/\/+$/u, "");
	if (base.endsWith(path)) return base;
	const version = /^\/v\d+\//u.exec(path);
	if (version !== null && base.endsWith(version[0].slice(0, -1))) return `${base}${path.slice(version[0].length - 1)}`;
	return `${base}${path}`;
}
/** 兼容旧配置的 `mode` 到 target 的映射；2.0 只用于迁移。 */
const LEGACY_MODE_TARGETS = {
	responses: "qwen/responses",
	"anthropic-messages": "deepseek/anthropic-messages",
	"zhipu-web-search": "zhipu/search",
	"zhipu-chat-search": "zhipu/chat-completions"
};
/** True when the target exposes (and therefore accepts) one configuration key. */
function hasField(capability, key) {
	return capability.fields.includes(key);
}
/** 逗号分隔的域名列表拆成数组；空串得到空数组。 */
function splitList(value) {
	return value.split(/[,，\s]+/u).map((item) => item.trim()).filter((item) => item.length > 0);
}
//#endregion
//#region src/config.ts
/**
* 配置：v3 文档读写、v1/v2 迁移、按 target 的字段投影与保存、凭据探测。
*
* 优先级只有两层：UI 管理的文件 > catalog 默认值。API key 只走凭据面，不落文件。
*
* @module dsh-web-search-diy/config
*/
/** On-disk configuration version: 3 targets keyed by `<vendor>/<protocol>`. */
const CONFIG_VERSION = 3;
/** 所有字段的校验规格（含迁移时投影的键；`template` 已不在任何 target 的 `fields` 中）。 */
const FIELD_SPECS = {
	baseURL: { kind: "string" },
	/** 引用名要能被凭据服务接受，否则每次搜索都会在 `credentialRef()` 处抛错。 */
	apiKeyEnv: { kind: "refName" },
	model: { kind: "string" },
	maxOutputTokens: { kind: "positiveInt" },
	toolType: { kind: "string" },
	includeSources: { kind: "boolean" },
	reasoningEffort: { kind: "string" },
	searchContextSize: {
		kind: "enum",
		values: [
			"low",
			"medium",
			"high"
		]
	},
	allowedDomains: { kind: "string" },
	blockedDomains: { kind: "string" },
	excludedDomains: { kind: "string" },
	userLocation: { kind: "string" },
	maxUses: { kind: "positiveInt" },
	thinking: {
		kind: "enum",
		values: ["default", "disabled"]
	},
	effort: {
		kind: "enum",
		values: [
			"",
			"low",
			"medium",
			"high",
			"xhigh",
			"max"
		]
	},
	searchEngine: {
		kind: "enum",
		values: [
			"search_std",
			"search_pro",
			"search_pro_sogou",
			"search_pro_quark"
		]
	},
	count: {
		kind: "positiveInt",
		max: 50
	},
	searchRecencyFilter: {
		kind: "enum",
		values: [
			"noLimit",
			"oneDay",
			"oneWeek",
			"oneMonth",
			"oneYear"
		]
	},
	contentSize: {
		kind: "enum",
		values: ["medium", "high"]
	},
	searchDomainFilter: { kind: "string" },
	searchIntent: { kind: "boolean" },
	requireSearch: { kind: "boolean" },
	searchPrompt: { kind: "string" },
	searchStrategy: {
		kind: "enum",
		values: [
			"turbo",
			"max",
			"agent",
			"agent_max"
		]
	},
	forcedSearch: { kind: "boolean" },
	freshness: {
		kind: "enum",
		values: [
			"",
			"noLimit",
			"oneDay",
			"oneWeek",
			"oneMonth",
			"oneYear"
		]
	},
	assignedSiteList: { kind: "string" },
	searchExtension: { kind: "string" },
	promptIntervene: { kind: "string" },
	engine: { kind: "string" },
	mode: { kind: "string" },
	maxCharacters: { kind: "positiveInt" },
	externalWebAccess: {
		kind: "enum",
		values: [
			"",
			"true",
			"false"
		]
	},
	returnTokenBudget: {
		kind: "enum",
		values: [
			"",
			"default",
			"unlimited"
		]
	},
	searchContentTypes: { kind: "string" },
	imageMaxResults: { kind: "positiveInt" },
	imageCaption: { kind: "boolean" },
	responseInclusion: {
		kind: "enum",
		values: [
			"",
			"full",
			"excluded"
		]
	},
	xSearch: { kind: "json" },
	maxResults: { kind: "positiveInt" },
	maxTotalResults: { kind: "positiveInt" },
	includeContent: { kind: "boolean" },
	timeoutSeconds: { kind: "positiveInt" },
	digestEntries: {
		kind: "positiveInt",
		max: 20
	},
	digestSnippetChars: {
		kind: "positiveInt",
		max: 2e3
	},
	oriQuestion: { kind: "boolean" },
	localization: { kind: "string" },
	template: { kind: "string" },
	chatVariant: {
		kind: "enum",
		values: [
			"zhipu",
			"qwen",
			"openrouter",
			"openai-search-model"
		]
	},
	path: { kind: "string" },
	queryField: { kind: "string" },
	countField: { kind: "string" },
	resultsPath: { kind: "string" },
	urlField: { kind: "string" },
	titleField: { kind: "string" },
	snippetField: { kind: "string" },
	dateField: { kind: "string" },
	contentField: { kind: "string" }
};
/**
* 配置文件的路径，由 web 配置卡管理：`$DSH_HOME/dsh-web-search-diy.json`。
*
* `DSH_HOME` 显式设为空串时按未设置处理，避免配置落到进程当前目录。
*
* @returns 配置文件绝对路径。
*/
function configFilePath() {
	const home = process.env.DSH_HOME?.trim();
	return join(home !== void 0 && home.length > 0 ? home : join(homedir(), ".dsh"), "dsh-web-search-diy.json");
}
/** 旧格式文件的一次性备份路径。 */
function backupPath() {
	return `${configFilePath()}.v2.bak`;
}
/** 宽松读取对象。 */
function asRecord$1(value) {
	return typeof value === "object" && value !== null ? value : void 0;
}
/** 按规格校验一个字段值；返回规范化后的值或 undefined。 */
function coerceField(spec, value) {
	switch (spec.kind) {
		case "string": return typeof value === "string" && value.length > 0 ? value : void 0;
		case "refName": return typeof value === "string" && isCredentialRefName(value) ? value : void 0;
		case "positiveInt": {
			/** 表单把数字字段当文本提交，`"131072"` 与 `131072` 同样合法。 */
			const numeric = typeof value === "number" ? value : typeof value === "string" && /^\d+$/u.test(value.trim()) ? Number(value.trim()) : NaN;
			if (!Number.isSafeInteger(numeric) || numeric < 1) return void 0;
			return spec.max !== void 0 && numeric > spec.max ? void 0 : numeric;
		}
		case "boolean": return typeof value === "boolean" ? value : void 0;
		case "enum": return typeof value === "string" && spec.values.includes(value) ? value : void 0;
		case "json":
			if (typeof value !== "string" || value.length === 0) return void 0;
			try {
				const parsed = JSON.parse(value);
				return typeof parsed === "object" && parsed !== null ? value : void 0;
			} catch {
				return;
			}
	}
}
/**
* 该 target 下一个字段的校验规格。
*
* 自定义网关的引擎名不统一（`search_std`、`google`、`searxng` 都可能），因此只有
* 自定义 target 的 `searchEngine` 放开为任意非空字符串；官方智谱仍按固定枚举校验。
*
* @param capability - 目标能力。
* @param key - 字段名。
* @returns 校验规格。
*/
function fieldSpecOf(capability, key) {
	if (capability.vendor === "custom" && key === "searchEngine") return { kind: "string" };
	/** Kimi 的独立搜索接口 limit 上限是 20；其余纯工具接口的 count 上限为 50。 */
	if (capability.id === "kimi/search" && key === "count") return {
		kind: "positiveInt",
		max: 20
	};
	return FIELD_SPECS[key];
}
/**
* 该 target 每个声明字段的校验规格，随 catalog 下发给 Client。
*
* 只投影 `fields` 内的键：Client 不渲染、也不保存其他键。
*
* @param capability - 目标能力。
* @returns 字段名到规格的映射。
*/
function specsOf(capability) {
	const specs = {};
	for (const key of capability.fields) specs[key] = fieldSpecOf(capability, key);
	return specs;
}
/**
* 只保留该 target `fields` 内、类型正确的键。
*
* @param capability - 目标能力。
* @param data - 原始桶。
* @returns 投影后的桶。
*/
function projectTarget(capability, data) {
	const projected = {};
	for (const key of capability.fields) {
		const value = coerceField(fieldSpecOf(capability, key), data[key]);
		if (value !== void 0) projected[key] = value;
	}
	return projected;
}
/**
* 把 v2 的一个 mode 桶迁移成对应 target 的桶，并重命名旧字段。
*
* @param mode - 旧 mode 名。
* @param data - 旧桶。
* @returns 迁移后的桶（`apiVersion` 等 v3 不再暴露的键丢弃）。
*/
function migrateLegacyBucket(mode, data) {
	const migrated = { ...data };
	if (mode === "responses") {
		if (data.responsesToolType !== void 0) migrated.toolType = data.responsesToolType;
		if (data.responsesIncludeSources !== void 0) migrated.includeSources = data.responsesIncludeSources;
		if (data.responsesReasoningEffort !== void 0) migrated.reasoningEffort = data.responsesReasoningEffort;
	}
	if (mode === "anthropic-messages") {
		if (data.anthropicThinking !== void 0) migrated.thinking = data.anthropicThinking;
		if (data.anthropicEffort !== void 0) migrated.effort = data.anthropicEffort;
	}
	for (const key of [
		"responsesToolType",
		"responsesIncludeSources",
		"responsesReasoningEffort",
		"anthropicThinking",
		"anthropicEffort",
		"apiVersion",
		"mode"
	]) delete migrated[key];
	return migrated;
}
/**
* 读取 UI 管理的配置文件为 v3 文档。
*
* v3 直接投影；v2（`modes` 桶）与 v1（扁平对象）在内存里迁移到 v3，读取从不写盘——
* 首次保存时才写 v3 并备份旧文件。
*
* @returns 文档，只含已知 target 与已知键。
*/
function readConfigDocument() {
	let raw;
	try {
		raw = JSON.parse(readFileSync(configFilePath(), "utf8"));
	} catch {
		return {
			version: 3,
			targets: {}
		};
	}
	const record = asRecord$1(raw);
	if (record === void 0) return {
		version: 3,
		targets: {}
	};
	const targets = {};
	if (asRecord$1(record.targets) !== void 0 && !("modes" in record)) {
		for (const [id, bucket] of Object.entries(asRecord$1(record.targets) ?? {})) {
			const capability = capabilityOf(id);
			const data = asRecord$1(bucket);
			if (capability === void 0 || data === void 0) continue;
			const projected = projectTarget(capability, data);
			if (Object.keys(projected).length > 0) targets[id] = projected;
		}
		const selection = typeof record.vendor === "string" && typeof record.protocol === "string" ? `${record.vendor}/${record.protocol}` : void 0;
		const selected = selection !== void 0 ? splitTargetId(selection) : void 0;
		return {
			version: 3,
			...selected !== void 0 ? {
				vendor: selected.vendor,
				protocol: selected.protocol
			} : {},
			targets
		};
	}
	const modes = asRecord$1(record.modes);
	const buckets = modes !== void 0 ? modes : typeof record.mode === "string" ? { [record.mode]: record } : {};
	for (const [mode, bucket] of Object.entries(buckets)) {
		const targetId = LEGACY_MODE_TARGETS[mode];
		const data = asRecord$1(bucket);
		if (targetId === void 0 || data === void 0) continue;
		const capability = capabilityOf(targetId);
		if (capability === void 0) continue;
		const projected = projectTarget(capability, migrateLegacyBucket(mode, data));
		if (Object.keys(projected).length > 0) targets[targetId] = {
			...targets[targetId],
			...projected
		};
	}
	const legacyMode = typeof record.mode === "string" ? record.mode : void 0;
	const migratedSelection = legacyMode !== void 0 ? splitTargetId(LEGACY_MODE_TARGETS[legacyMode] ?? "") : void 0;
	return {
		version: 3,
		...migratedSelection !== void 0 ? {
			vendor: migratedSelection.vendor,
			protocol: migratedSelection.protocol
		} : {},
		targets
	};
}
/**
* 把某个 target 的配置持久化进 v3 文件，并把它设为当前选择。
*
* 只保存该 target `fields` 内的键；空值删除；清空后的桶整体丢弃。旧格式文件在首次
* 保存前备份为 `dsh-web-search-diy.json.v2.bak`（一次，保留回滚）。
*
* @param vendor - 选择的厂商。
* @param protocol - 选择的协议。
* @param partial - 要合并的键。
* @param cleared - 要删除的键。
* @returns 已保存的文档。
*/
function saveConfig(vendor, protocol, partial, cleared = []) {
	const id = `${vendor}/${protocol}`;
	const capability = capabilityOf(id);
	if (capability === void 0) throw new Error(`unknown target ${id}`);
	const document = readConfigDocument();
	backupLegacyFile();
	const bucket = { ...document.targets[id] };
	for (const [key, value] of Object.entries(partial)) if (capability.fields.includes(key)) bucket[key] = value;
	for (const key of cleared) delete bucket[key];
	const targets = { ...document.targets };
	if (Object.keys(bucket).length > 0) targets[id] = bucket;
	else delete targets[id];
	const next = {
		version: 3,
		vendor,
		protocol,
		targets
	};
	mkdirSync(dirname(configFilePath()), { recursive: true });
	replaceFileAtomically(configFilePath(), JSON.stringify(next, null, 2) + "\n");
	return next;
}
/**
* 原子替换配置文件：同目录临时文件 + rename。
*
* 直接覆盖写会在进程崩溃或磁盘写满时留下被截断的 JSON，下一次读取会退化为空文档，
* 随后的保存把原配置覆盖掉。rename 在同一文件系统上是原子的，读取方只会看到旧文件
* 或完整的新文件。
*
* @param path - 目标文件绝对路径。
* @param content - 完整的新内容。
*/
function replaceFileAtomically(path, content) {
	const temp = `${path}.${process.pid}.tmp`;
	try {
		writeFileSync(temp, content, { mode: 384 });
		renameSync(temp, path);
	} catch (error) {
		try {
			unlinkSync(temp);
		} catch {}
		throw error;
	}
}
/** 首次保存前把旧格式文件复制一份；已经备份过就不再覆盖。 */
function backupLegacyFile() {
	const path = configFilePath();
	if (!existsSync(path) || existsSync(backupPath())) return;
	let raw;
	try {
		raw = JSON.parse(readFileSync(path, "utf8"));
	} catch {
		return;
	}
	const record = asRecord$1(raw);
	if (record === void 0 || record.version === 3) return;
	mkdirSync(dirname(path), { recursive: true });
	copyFileSync(path, backupPath());
}
/**
* 校验一次配置提交。
*
* 每个键同一条规则：空值清除、缺省不动、非法值报错并点名。`apiKey` 不在这里处理。
*
* @param capability - 目标能力，决定允许的键。
* @param body - 解析后的 POST 请求体。
* @returns 要合并的补丁、要删除的键，以及第一个错误（若有）。
*/
function buildConfigPatch(capability, body) {
	const patch = {};
	const cleared = [];
	let error;
	/** 模型锁定的组合只接受 catalog 默认模型，避免保存一个不会触发的模型名。 */
	if (capability.modelLocked === true && body.model !== void 0 && body.model !== null && String(body.model).trim() !== "" && String(body.model).trim() !== capability.defaults.model) return {
		patch: {},
		cleared: [],
		error: `${capability.id} 的模型固定为 ${capability.defaults.model ?? ""}`
	};
	const allowed = new Set(capability.fields);
	const isBlank = (value) => value === void 0 || value === null || typeof value === "string" && value.trim().length === 0;
	for (const [key, raw] of Object.entries(body)) {
		if (key === "vendor" || key === "protocol" || key === "apiKey") continue;
		if (!allowed.has(key)) {
			error ??= `${key} 不属于 ${capability.id} 的可配置字段`;
			continue;
		}
		if (isBlank(raw)) {
			cleared.push(key);
			continue;
		}
		const spec = fieldSpecOf(capability, key);
		const coerced = coerceField(spec, typeof raw === "string" ? raw.trim() : raw);
		if (coerced === void 0) {
			error ??= `${key} 的值不合法（${describeSpec(spec)}）`;
			continue;
		}
		patch[key] = coerced;
	}
	return {
		patch,
		cleared,
		error
	};
}
/** 给用户看的字段值域描述。 */
function describeSpec(spec) {
	switch (spec.kind) {
		case "string": return "非空字符串";
		case "refName": return "凭据引用名（字母或下划线开头，仅字母、数字、下划线）";
		case "positiveInt": return spec.max !== void 0 ? `1-${spec.max} 的整数` : "正整数";
		case "boolean": return "布尔值";
		case "enum": return spec.values.map((value) => value.length > 0 ? value : "空").join(" / ");
		case "json": return "JSON 对象";
	}
}
/**
* 任一候选引用解析到非空凭据时返回 true。
*
* @param ctx - 提供 credentials 服务的插件上下文。
* @param refNames - 候选引用名，优先级从高到低。
* @returns 是否存在可用凭据。
*/
async function hasCredential(ctx, refNames) {
	const credentials = ctx.get("credentials");
	if (credentials === void 0) return false;
	for (const name of refNames) try {
		const resolved = await credentials.resolve(credentialRef(name));
		if (resolved?.value != null && resolved.value.length > 0) return true;
	} catch {}
	return false;
}
/**
* 首次加载时的默认选择。
*
* 1. 文档已记录选择且该 target 可选 → 用它。
* 2. `targets` 非空 → 用第一个已保存的可选 target。
* 3. {@link DEFAULT_TARGET} 的默认凭据可解析 → 用它（DeepSeek 纯工具搜索）。
* 4. 遍历官方 target，优先挑凭据可解析的完整 Responses 组合。
* 5. 都没有 → {@link DEFAULT_TARGET}。
*
* @param ctx - 提供 credentials 服务的插件上下文。
* @param document - 已读取的配置文档。
* @returns 选中的 target id。
*/
async function selectDefaultTarget(ctx, document) {
	if (document.vendor !== void 0 && document.protocol !== void 0) {
		const id = `${document.vendor}/${document.protocol}`;
		if (isSelectable(id)) return id;
	}
	const saved = Object.keys(document.targets).find((id) => isSelectable(id));
	if (saved !== void 0) return saved;
	/** 首选不消耗模型回合的纯工具搜索：只要有 DeepSeek 凭据就直接落在默认 target 上。 */
	if (await hasCredential(ctx, CATALOG[DEFAULT_TARGET].defaults.apiKeyEnv)) return DEFAULT_TARGET;
	const official = OFFICIAL_TARGET_IDS.filter((id) => CATALOG[id].support !== "unsupported");
	const preferred = [
		...official.filter((id) => CATALOG[id].protocol === "responses" && CATALOG[id].support === "full"),
		...official.filter((id) => CATALOG[id].support === "full"),
		...official
	];
	for (const id of preferred) if (await hasCredential(ctx, CATALOG[id].defaults.apiKeyEnv)) return id;
	return DEFAULT_TARGET;
}
//#endregion
//#region src/options.ts
/**
* 选项解析：catalog 默认值 + UI 文件覆盖 → 一次搜索的完整快照。
*
* 只有两层：文件 > catalog 默认值。每个 target 的桶互相独立，切换不会串值。
*
* @module dsh-web-search-diy/options
*/
/** Anthropic 协议的默认 `anthropic-version`。 */
const DEFAULT_API_VERSION = "2023-06-01";
/** 辅助搜索端点覆盖变量（DeepSeek 官方搜索 provider 同名）。 */
const SEARCH_BASE_URL_ENV = "DEEPSEEK_SEARCH_BASE_URL";
/** 所有字段的兜底值；catalog 未声明的字段靠它保持类型完整。 */
const DEFAULT_SETTINGS = {
	baseURL: "",
	model: "",
	maxOutputTokens: 4096,
	toolType: "",
	includeSources: false,
	reasoningEffort: "",
	searchContextSize: "medium",
	allowedDomains: "",
	blockedDomains: "",
	excludedDomains: "",
	userLocation: "",
	maxUses: 5,
	thinking: "default",
	effort: "",
	searchEngine: "",
	count: 10,
	searchRecencyFilter: "noLimit",
	contentSize: "medium",
	searchDomainFilter: "",
	searchIntent: false,
	requireSearch: false,
	searchPrompt: "",
	searchStrategy: "turbo",
	forcedSearch: false,
	freshness: "",
	assignedSiteList: "",
	searchExtension: "",
	promptIntervene: "",
	engine: "auto",
	mode: "",
	maxCharacters: 0,
	externalWebAccess: "",
	returnTokenBudget: "",
	searchContentTypes: "",
	imageMaxResults: 0,
	imageCaption: false,
	responseInclusion: "",
	xSearch: "",
	maxResults: 5,
	maxTotalResults: 15,
	includeContent: false,
	timeoutSeconds: 30,
	digestEntries: 8,
	digestSnippetChars: 200,
	oriQuestion: true,
	localization: "",
	template: "",
	chatVariant: "zhipu",
	path: "",
	queryField: "",
	countField: "",
	resultsPath: "",
	urlField: "",
	titleField: "",
	snippetField: "",
	dateField: "",
	contentField: ""
};
/** 把 catalog 默认值（`apiKeyEnv` 是数组）摊平成可合并的字段对象。 */
function defaultSettingsOf(targetId) {
	const capability = capabilityOf(targetId);
	if (capability === void 0) return {};
	const { apiKeyEnv: _ignored, ...rest } = capability.defaults;
	return rest;
}
/**
* 本次触发搜索的用户原问题。
*
* 与官方 `web-deepseek-api` 同源：当前 initiator 的 Session 中最后一条
* `source.kind === "user"` 的文本。搜索不在会话内时返回 undefined。
*
* @param session - 发起搜索的会话，可缺省。
* @returns 原问题文本；没有可用提问时 undefined。
*/
function latestUserQuestion(session) {
	const messages = session?.deriveMessages() ?? [];
	for (let index = messages.length - 1; index >= 0; index -= 1) {
		const message = messages[index];
		if (message.role !== "user" || message.source.kind !== "user") continue;
		return message.content.flatMap((block) => block.type === "text" ? [block.text] : []).join("\n");
	}
}
/**
* 解析某个 target 的一次搜索选项。
*
* @param ctx - 提供凭据面与启动环境的插件上下文。
* @param document - 已读取的配置文档。
* @param targetId - 当前选择的 target。
* @returns 一次搜索的选项。
*/
function resolveOptions(ctx, document, targetId) {
	const capability = capabilityOf(targetId) ?? CATALOG[DEFAULT_TARGET];
	const file = document.targets[capability.id] ?? {};
	const defaults = defaultSettingsOf(capability.id);
	const merged = {
		...DEFAULT_SETTINGS,
		...defaults
	};
	/** 模型锁定的组合忽略文件里的 model，始终使用 catalog 的固定模型。 */
	if (capability.modelLocked === true && capability.defaults.model !== void 0) merged.model = capability.defaults.model;
	for (const [key, value] of Object.entries(file)) if (value !== void 0 && value !== "") merged[key] = value;
	/**
	* 端点优先级：文件里显式填写 > 启动环境变量 > catalog 默认值。
	*
	* `merged.baseURL` 已经包含 catalog 默认值，不能再用它判断“用户是否填过”，否则
	* `DEEPSEEK_SEARCH_BASE_URL` 这类部署级覆盖会因为默认值非空而永远不生效。
	*/
	const fileBaseURL = file.baseURL !== void 0 && file.baseURL.length > 0 ? file.baseURL : void 0;
	const ambient = capability.protocol === "anthropic-messages" ? launchEnvironmentOf(ctx).get(SEARCH_BASE_URL_ENV)?.value : void 0;
	const ambientBaseURL = ambient !== void 0 && ambient.trim().length > 0 ? ambient.trim() : void 0;
	const baseURL = (fileBaseURL ?? ambientBaseURL ?? merged.baseURL).replace(/\/+$/u, "");
	const path = merged.path.length > 0 ? merged.path : capability.search.path;
	const endpoint = joinEndpoint(baseURL, path);
	const apiKeyEnvNames = file.apiKeyEnv !== void 0 && file.apiKeyEnv.length > 0 ? [file.apiKeyEnv] : capability.defaults.apiKeyEnv;
	const apiKeyEnv = apiKeyEnvNames[0] ?? "";
	const apiKeyEnvFallbacks = apiKeyEnvNames.slice(1);
	return {
		target: capability.id,
		capability,
		settings: {
			...merged,
			baseURL,
			path
		},
		baseURL,
		endpoint,
		apiKeyEnv,
		apiKeyEnvFallbacks,
		resolveApiKey: async () => {
			/** 手改配置或旧文件可能带非法引用名：跳过它们，而不是让 credentialRef 抛错中断整条链。 */
			const refs = [apiKeyEnv, ...apiKeyEnvFallbacks].filter((name) => isCredentialRefName(name));
			const credentials = ctx.get("credentials");
			if (credentials !== void 0) {
				for (const ref of refs) {
					const value = (await credentials.resolve(credentialRef(ref)))?.value;
					if (value !== void 0 && value.length > 0) return value;
				}
				return;
			}
			const environment = launchEnvironmentOf(ctx);
			for (const ref of refs) {
				const ambient = environment.get(ref);
				if (ambient !== void 0 && ambient.value.length > 0) return ambient.value;
			}
		},
		/**
		* 把出站模型请求记录到调用会话，与已发布 provider 一致。可选链是因为无头组合
		* 不挂 agents 服务；审计是附加项，会话不可写时不能阻断即将发出的搜索。
		*/
		recordRequest: (request) => {
			try {
				ctx.get("agents")?.currentInitiator()?.session.append("web/deepseek-search-llm-request", request);
			} catch {}
		},
		/** 只有显式开启时才读取会话，避免每次搜索都触碰 agent 状态。 */
		originalQuestion: merged.oriQuestion ? () => latestUserQuestion(ctx.get("agents")?.currentInitiator()?.session) : void 0
	};
}
/** 当前文档记录的选择；无效时 undefined。 */
function selectedTargetOf(document) {
	if (document.vendor === void 0 || document.protocol === void 0) return void 0;
	const id = `${document.vendor}/${document.protocol}`;
	return capabilityOf(id) !== void 0 ? id : void 0;
}
/** 一次解析的便捷入口：读文件、取选择（回退到 `fallback`）、解析选项。 */
function resolveCurrentOptions(ctx, fallback) {
	const document = readConfigDocument();
	return resolveOptions(ctx, document, selectedTargetOf(document) ?? fallback);
}
//#endregion
//#region src/mappers/sources.ts
/**
* DeepSeek 用内部调用片段标记它打开过的页面（`…#ws_call_id=call_01_…`）；
* 去掉它，保证每条来源都是可引用的 URL。
*
* 只接受绝对 `http:` / `https:` URL：来源最终会作为可点击链接交给客户端，
* 数据来源不可信时不能把 `javascript:` 一类协议透传下去。
*
* @param value - provider 提供的 URL。
* @returns 清理后的 URL；没有可用内容或协议不受支持时返回 undefined。
*/
function normalizeSourceUrl(value) {
	if (typeof value !== "string" || value.length === 0) return void 0;
	const cleaned = value.replace(/#ws_call_id=[^#]*$/u, "");
	if (cleaned.length === 0) return void 0;
	try {
		const protocol = new URL(cleaned).protocol;
		return protocol === "http:" || protocol === "https:" ? cleaned : void 0;
	} catch {
		return;
	}
}
/**
* 把 provider 提供的发布日期归一化成 seam `publishedAt` 承诺的 ISO-8601 字符串。
*
* Anthropic 发送的是人类可读的 `page_age`（"April 30, 2025"）；无法解析出日期的值
* 直接丢弃，不回显。
*
* @param value - provider 的 `page_age`。
* @returns ISO-8601 日期（YYYY-MM-DD），或 undefined。
*/
function isoPublishedAt(value) {
	if (typeof value !== "string" || value.length === 0) return void 0;
	const parsed = Date.parse(value);
	if (Number.isNaN(parsed)) return void 0;
	/**
	* 在解析时所在时区格式化日历日：provider 声明的是发布日而不是时刻，转 UTC 会把
	* 格林尼治以东的 "April 30, 2025" 移到 29 日。
	*/
	const date = new Date(parsed);
	const month = String(date.getMonth() + 1).padStart(2, "0");
	const day = String(date.getDate()).padStart(2, "0");
	return `${date.getFullYear()}-${month}-${day}`;
}
/**
* 把智谱搜索条目（`search_result[]` 项或 chat 工具的 source 对象，形状都是
* `{link, title, ...}`）归一化成 seam 来源，按 URL 去重。seam 没有槽位的字段
* （`media`、`publish_date`、`icon`）丢弃。
*
* @param entries - 智谱返回的条目数组。
* @returns 去重后的来源。
*/
function normalizeZhipuSources(entries) {
	const seen = /* @__PURE__ */ new Set();
	const sources = [];
	for (const item of entries) {
		const url = normalizeSourceUrl(item?.link);
		if (url === void 0 || seen.has(url)) continue;
		seen.add(url);
		const title = item.title;
		const source = { url };
		if (typeof title === "string" && title.length > 0) source.title = title;
		sources.push(source);
	}
	return sources;
}
//#endregion
//#region src/transport.ts
/**
* HTTP 传输：请求、压缩解码、reasoning 降级重试、取消语义。
*
* 这一层不关心任何协议字段，只负责“把 JSON 发出去、把 JSON 收回来、把失败映射成
* WebError”。协议文件负责请求体与响应映射。
*
* @module dsh-web-search-diy/transport
*/
/** 每个请求都带上的归属头；`test/catalog.test.mjs` 断言它与 package.json 版本一致。 */
const USER_AGENT = "dsh-web-search-diy/2.0.4";
/** gzip 成员魔数（RFC 1952）与 zlib 的默认 CMF 字节（RFC 1950）。 */
const GZIP_MAGIC_FIRST = 31;
const GZIP_MAGIC_SECOND = 139;
const ZLIB_CMF = 120;
/**
* 解压缩炸弹的硬上限。合法搜索载荷峰值只有几百 KB（观测到最大约 25 KB 压缩体对应
* 20 条结果），因此这两个上限只会对恶意或损坏的响应生效：线上上限阻止超大响应体
* 下载完成，解码上限阻止极小的压缩体在 `zlib` 内无限膨胀。
*/
const MAX_RESPONSE_BYTES = 8388608;
const MAX_DECODED_BYTES = 16777216;
/** True for a zlib-wrapped deflate stream: default CMF plus the RFC 1950 checksum. */
function isZlibStream(raw) {
	return raw[0] === ZLIB_CMF && (raw[0] << 8 | (raw[1] ?? 0)) % 31 === 0;
}
/**
* 读取整个响应体，拒绝拉取超过 `maxBytes`。
*
* 上限按块流式执行：累计大小越界后立即取消 reader，炸弹永远不会下载完，而不是先用
* `response.arrayBuffer()` 全部缓冲。
*
* @param response - 要读取的响应。
* @param maxBytes - 压缩体大小的硬上限。
* @returns 缓冲的响应体。
* @throws {Error} 响应体超过 `maxBytes` 时。
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
				await reader.cancel();
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
* 解压压缩体，拒绝膨胀超过 `maxBytes`。
*
* `maxOutputLength` 是这里唯一可信的边界：gzip 流声明的 ISIZE 由攻击者控制，所以上限
* 由 `zlib` 在产出时执行，而不是信任头部。
*
* @param raw - 压缩字节。
* @param maxBytes - 解码后大小的硬上限。
* @returns 解码后的字节。
* @throws {Error} 解码后超过 `maxBytes` 或流损坏时。
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
* 把响应体解码成 JSON，且不信任 `content-encoding`。
*
* 以字节读取而不是走 `response.json()`：本进程的全局 undici dispatcher 可能来自与
* Node 内置 `fetch` 不同的 undici 副本——`@deepseek-ai/dsh-http-proxy` 正是用自己
* 打包的 undici 8.x 安装它，于是进程里每个普通 `fetch()` 都跑在它上面。跨这个版本
* 边界时，内置 fetch 会返回仍然压缩的流，连 `content-encoding` 都读不到，导致
* `response.json()` 去解析 gzip 字节、每次搜索都以“响应体无法解析”失败。魔数是唯一
* 能跨越该边界的信号，所以压缩体在这里解压。
*
* 两个阶段都有上限（见 MAX_RESPONSE_BYTES / MAX_DECODED_BYTES），解压缩炸弹会快速
* 失败为不可解析的响应体，而不是在事件循环上耗尽内存。
*
* @param response - 要解码的响应。
* @returns 解析后的响应体。
* @throws {SyntaxError} 解码后的响应体不是 JSON 时。
* @throws {Error} 响应体或解码后大小超过上限，或看起来压缩却无法解压时。
*/
async function readJsonResponse(response) {
	const raw = await readBodyCapped(response, MAX_RESPONSE_BYTES);
	const json = raw[0] === GZIP_MAGIC_FIRST && raw[1] === GZIP_MAGIC_SECOND || isZlibStream(raw) ? inflateCapped(raw, MAX_DECODED_BYTES) : raw;
	return JSON.parse(json.toString("utf8"));
}
/**
* 端点是否因为 reasoning 参数拒绝了请求。
*
* 不同模型接受的 effort 档位与 thinking 开关不同，措辞是唯一可用信号：智谱 GLM-5.3
* 对 `thinking: disabled` 与 `reasoning_effort: medium` 都返回 400 “该模型始终思考，
* 不支持关闭思考；请使用 low、high 或 max。”，而 DeepSeek 会静默接受它不使用的
* effort。HTTP 400 本身区分不了参数被拒与模型名错误，所以重试只依据措辞。
*
* @param error - 一次请求的失败。
* @returns 是否可以去掉该参数重试。
*/
function rejectsReasoningKnob(error) {
	if (!(error instanceof WebError) || error.code !== "WEB_PROVIDER_ERROR") return false;
	return /effort|thinking|reasoning|思考|档位/iu.test(error.message);
}
/**
* 去掉仍然存在的最可牺牲的 reasoning 参数，让重试保留其余参数：
* `reasoning.effort` → `output_config` → `thinking` → `reasoning_effort`。
*
* @param body - 被拒绝的请求体。
* @returns 去掉一个参数的副本；没有可去掉的参数时 undefined。
*/
function dropReasoningKnob(body) {
	const next = { ...body };
	if (next.reasoning !== void 0) {
		delete next.reasoning;
		return next;
	}
	if (next.output_config !== void 0) {
		delete next.output_config;
		return next;
	}
	if (next.thinking !== void 0) {
		delete next.thinking;
		return next;
	}
	if (next.reasoning_effort !== void 0) {
		delete next.reasoning_effort;
		return next;
	}
}
/**
* POST 一个 JSON 请求体并返回解析后的响应，把传输与 HTTP 层失败映射到稳定的错误码。
*
* @param endpoint - 完整请求 URL。
* @param apiKey - 已解析凭据；总是作为 `authorization: Bearer` 发送。
* @param body - JSON 请求体。
* @param signal - 外层搜索的取消信号。
* @param extraHeaders - 协议专属头（Anthropic 协议附加 `x-api-key` 与
*   `anthropic-version`）；undefined 值被丢弃。
* @returns 解析后的响应体。
* @throws {WebError} 传输失败、非 2xx、响应体不可解析时。
*/
async function postJson(endpoint, apiKey, body, signal, extraHeaders = {}) {
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
				* 请网关不要压缩。这是跨 undici dispatcher 问题的主修复（见
				* readJsonResponse）；那里的魔数解压保留为对仍然压缩的网关的兜底。
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
		const status = `web search API error (HTTP ${response.status})`;
		let message = status;
		try {
			const parsed = await readJsonResponse(response);
			const detail = typeof parsed.error === "string" ? parsed.error : parsed.error?.message ?? parsed.message;
			/** 始终保留状态码：404 诊断依赖它区分“路径不存在”和普通业务错误。 */
			if (detail !== void 0 && detail.length > 0) message = `${status}: ${detail}`;
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
* POST 一次搜索，在端点持续拒绝时逐个牺牲可选的 reasoning 参数。
*
* effort 档位与 thinking 开关是模型偏好，不是搜索契约的一部分：因为选的档位该模型不认
* 就丢掉整个搜索，比按端点默认值跑更糟。每次重试都是同一请求少一个参数，因此不可能
* 循环：最多只有四个参数可以放弃。
*
* @param endpoint - 完整端点 URL。
* @param apiKey - 已解析 key。
* @param body - 首次发送的请求体。
* @param signal - 外层搜索的中断信号。
* @param extraHeaders - 协议专属头。
* @param onSend - 每次实际发送请求体时调用，用于记录请求。
* @returns 解析后的响应体。
*/
async function postWithReasoningFallback(endpoint, apiKey, body, signal, extraHeaders = {}, onSend) {
	let current = body;
	for (;;) {
		onSend?.(current);
		try {
			return await postJson(endpoint, apiKey, current, signal, extraHeaders);
		} catch (error) {
			if (signal?.aborted === true || isAbortError(error) || !rejectsReasoningKnob(error)) throw error;
			const next = dropReasoningKnob(current);
			if (next === void 0) throw error;
			current = next;
		}
	}
}
/**
* 让同进程的异步预检与调用方取消竞速。挂上的 settlement 处理器会在中断之后继续观察
* 不配合的操作，避免之后的拒绝成为 unhandled。
*
* @param operation - 被竞速的异步操作。
* @param signal - 调用方取消信号。
* @returns 操作结果，或在中断时拒绝。
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
/** 调用方已经中断时抛出 provider 稳定的取消错误。 */
function throwIfSearchAborted(signal) {
	if (signal?.aborted === true) throw searchAborted(signal);
}
/** 构造 provider 稳定的取消错误，同时保留调用方的 reason。 */
function searchAborted(signal, fallback) {
	return new WebError("web search aborted", "WEB_ABORTED", { cause: signal?.aborted === true ? signal.reason : fallback });
}
/** True for a fetch/`AbortSignal` abort, surfaced as `WEB_ABORTED`. */
function isAbortError(error) {
	return error instanceof DOMException && error.name === "AbortError";
}
//#endregion
//#region src/wire.ts
/**
* 线上响应体的宽松读取工具。
*
* 网关返回的 JSON 形状随厂商与版本变化，映射器只信任逐字段校验过的值：这几个函数把
* `unknown` 收窄成可安全读取的形状，非目标类型一律退化为空值。
*
* @module dsh-web-search-diy/wire
*/
/** 宽松读取一层对象，非对象返回 undefined。 */
function asRecord(value) {
	return typeof value === "object" && value !== null ? value : void 0;
}
/** 宽松读取数组，非数组返回空数组。 */
function asArray(value) {
	return Array.isArray(value) ? value : [];
}
/** 宽松读取字符串，非字符串返回 undefined。 */
function asString(value) {
	return typeof value === "string" ? value : void 0;
}
//#endregion
//#region src/protocols/anthropic.ts
/**
* Anthropic 兼容 Messages API 协议：请求构造 + 响应映射。
*
* @module dsh-web-search-diy/protocols/anthropic
*/
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
function mapAnthropicResponse(data) {
	const blocks = asArray(asRecord(data)?.content);
	const snippets = /* @__PURE__ */ new Map();
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
	const seen = /* @__PURE__ */ new Set();
	const sources = [];
	let toolError;
	let searched = false;
	for (const rawBlock of blocks) {
		const block = asRecord(rawBlock);
		if (block?.type !== "web_search_tool_result") continue;
		const items = block.content;
		if (!Array.isArray(items)) {
			const code = asString(asRecord(items)?.error_code);
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
			const source = { url };
			const title = asString(item.title);
			if (title !== void 0 && title.length > 0) source.title = title;
			const snippet = snippets.get(url);
			if (snippet !== void 0) source.snippet = snippet;
			const publishedAt = isoPublishedAt(item.page_age);
			if (publishedAt !== void 0) source.publishedAt = publishedAt;
			sources.push(source);
		}
	}
	if (sources.length === 0 && searched) return {
		sources,
		truncated: false
	};
	if (sources.length === 0) throw new WebError(toolError ?? "the provider returned no web_search_tool_result block; the endpoint may not implement the Anthropic web_search tool", "WEB_PROVIDER_ERROR");
	return {
		sources,
		truncated: false
	};
}
/** 构造服务端工具声明。 */
function toolDeclaration$1(options) {
	const { settings, capability } = options;
	const tool = {
		type: settings.toolType,
		name: "web_search",
		max_uses: settings.maxUses
	};
	const allowed = hasField(capability, "allowedDomains") ? splitList(settings.allowedDomains) : [];
	const blocked = hasField(capability, "blockedDomains") ? splitList(settings.blockedDomains) : [];
	/** 官方：allowed_domains 与 blocked_domains 不能同时出现，会 400；allowed 优先。 */
	if (allowed.length > 0) tool.allowed_domains = allowed;
	else if (blocked.length > 0) tool.blocked_domains = blocked;
	if (hasField(capability, "userLocation") && settings.userLocation.length > 0) tool.user_location = {
		type: "approximate",
		country: settings.userLocation
	};
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
async function searchAnthropicMessages(options, apiKey, request, signal) {
	const { settings, capability } = options;
	const endpoint = options.endpoint;
	const extraSystem = capability.search.extraSystem;
	const data = await postWithReasoningFallback(endpoint, apiKey, {
		model: settings.model,
		max_tokens: settings.maxOutputTokens,
		...extraSystem !== void 0 ? { system: [{
			type: "text",
			text: extraSystem
		}] } : {},
		messages: [{
			role: "user",
			content: [{
				type: "text",
				text: `Perform a web search for the query: ${request.query}`
			}]
		}],
		tools: [toolDeclaration$1(options)],
		...settings.effort.length > 0 ? { output_config: { effort: settings.effort } } : {},
		...settings.thinking === "disabled" ? { thinking: { type: "disabled" } } : {}
	}, signal, {
		"x-api-key": apiKey,
		"anthropic-version": DEFAULT_API_VERSION
	}, (sent) => {
		options.recordRequest?.({
			endpoint,
			apiVersion: DEFAULT_API_VERSION,
			body: sent
		});
	});
	try {
		return mapAnthropicResponse(data);
	} catch (error) {
		if (signal?.aborted === true || isAbortError(error)) throw searchAborted(signal, error);
		if (error instanceof WebError) throw error;
		throw new WebError(`web search returned an unprocessable response body: ${String(error)}`, "WEB_PROVIDER_ERROR", { cause: error });
	}
}
//#endregion
//#region src/protocols/chat.ts
/**
* Chat Completions 协议：4 个变体（智谱工具 / 千问参数 / OpenRouter 工具 / OpenAI 搜索模型）。
*
* @module dsh-web-search-diy/protocols/chat
*/
/** 官方 target 的变体由厂商决定；只有自定义开放 `chatVariant`。 */
function chatVariantOf(options) {
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
function messageContent(message) {
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
function sourcesFromAnnotations(message) {
	const seen = /* @__PURE__ */ new Set();
	const sources = [];
	for (const rawAnnotation of asArray(message?.annotations)) {
		const annotation = asRecord(rawAnnotation);
		if (annotation?.type !== "url_citation") continue;
		const citation = asRecord(annotation.url_citation) ?? annotation;
		const url = normalizeSourceUrl(citation.url);
		if (url === void 0 || seen.has(url)) continue;
		seen.add(url);
		const source = { url };
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
function mapZhipuChatResponse(data) {
	const root = asRecord(data);
	const message = asRecord(asRecord(asArray(root?.choices)[0])?.message);
	const content = messageContent(message);
	if (content === void 0) throw new WebError("the provider returned no assistant message; the endpoint may not implement the chat web_search tool", "WEB_PROVIDER_ERROR");
	const messageSources = message?.web_search;
	return {
		content,
		sources: normalizeZhipuSources(Array.isArray(messageSources) && messageSources.length > 0 ? messageSources : asArray(root?.web_search)),
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
function mapChatAnnotationsResponse(data) {
	const message = asRecord(asRecord(asArray(asRecord(data)?.choices)[0])?.message);
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
function mapQwenChatResponse(data) {
	const content = messageContent(asRecord(asRecord(asArray(asRecord(data)?.choices)[0])?.message));
	if (content === void 0) throw new WebError("the provider returned no assistant message; the endpoint may not implement qwen search", "WEB_PROVIDER_ERROR");
	return {
		content,
		sources: [],
		truncated: false
	};
}
/** 智谱请求体。 */
function zhipuBody(options, query) {
	const { settings, capability } = options;
	return {
		model: settings.model,
		messages: [{
			role: "user",
			content: query
		}],
		tools: [{
			type: "web_search",
			web_search: {
				enable: true,
				/** 智谱变体的 search_engine 必填：自定义留空时回落 search_std，填了则用用户值。 */
				search_engine: settings.searchEngine.length > 0 ? settings.searchEngine : "search_std",
				search_intent: settings.searchIntent ? "true" : "false",
				count: Math.min(Math.max(settings.count, 1), 50),
				...settings.searchDomainFilter.length > 0 ? { search_domain_filter: settings.searchDomainFilter } : {},
				search_recency_filter: settings.searchRecencyFilter,
				content_size: settings.contentSize,
				search_result: true,
				...settings.requireSearch && hasField(capability, "requireSearch") ? { require_search: true } : {},
				...settings.searchPrompt.length > 0 ? { search_prompt: settings.searchPrompt } : {}
			}
		}],
		reasoning_effort: settings.reasoningEffort,
		max_tokens: settings.maxOutputTokens,
		request_id: randomUUID()
	};
}
/** 千问请求体：`enable_search` + `search_options`。 */
function qwenBody(options, query) {
	const { settings, capability } = options;
	const searchOptions = {
		search_strategy: settings.searchStrategy,
		forced_search: settings.forcedSearch
	};
	if (settings.freshness.length > 0) searchOptions.freshness = settings.freshness;
	if (hasField(capability, "assignedSiteList")) {
		const sites = splitList(settings.assignedSiteList);
		if (sites.length > 0) searchOptions.assigned_site_list = sites;
	}
	if (settings.searchExtension.length > 0) searchOptions.search_extension = settings.searchExtension;
	if (settings.promptIntervene.length > 0) searchOptions.prompt_intervene = settings.promptIntervene;
	return {
		model: settings.model,
		messages: [{
			role: "user",
			content: query
		}],
		enable_search: true,
		search_options: searchOptions,
		max_tokens: settings.maxOutputTokens
	};
}
/** OpenRouter 请求体：`openrouter:web_search` server tool。 */
function openrouterBody(options, query) {
	const { settings } = options;
	const parameters = {
		engine: settings.engine,
		max_results: settings.maxResults,
		max_uses: settings.maxUses,
		max_total_results: settings.maxTotalResults,
		search_context_size: settings.searchContextSize
	};
	if (settings.mode.length > 0) parameters.mode = settings.mode;
	if (settings.maxCharacters > 0) parameters.max_characters = settings.maxCharacters;
	if (settings.userLocation.length > 0) parameters.user_location = {
		type: "approximate",
		country: settings.userLocation
	};
	if (settings.xSearch.length > 0) try {
		parameters.x_search = JSON.parse(settings.xSearch);
	} catch {}
	const allowed = splitList(settings.allowedDomains);
	const excluded = splitList(settings.excludedDomains);
	if (allowed.length > 0) parameters.allowed_domains = allowed;
	if (excluded.length > 0) parameters.excluded_domains = excluded;
	return {
		model: settings.model,
		messages: [{
			role: "user",
			content: query
		}],
		/** 该变体就是 OpenRouter 的 server tool；自定义 target 也固定用它，避免落到 catalog 的 web_search。 */
		tools: [{
			type: "openrouter:web_search",
			parameters
		}],
		max_tokens: settings.maxOutputTokens
	};
}
/** OpenAI 搜索模型请求体：不发 tools，模型自己联网。 */
function openaiSearchModelBody(options, query) {
	const { settings } = options;
	return {
		model: settings.model,
		messages: [{
			role: "user",
			content: query
		}],
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
async function searchChatCompletions(options, apiKey, request, signal) {
	const variant = chatVariantOf(options);
	const body = variant === "zhipu" ? zhipuBody(options, request.query) : variant === "qwen" ? qwenBody(options, request.query) : variant === "openrouter" ? openrouterBody(options, request.query) : openaiSearchModelBody(options, request.query);
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
//#endregion
//#region src/protocols/responses.ts
/**
* OpenAI 兼容 Responses API 协议：请求构造 + 响应映射。
*
* 搜索通过声明内置 `web_search` 工具触发，`web_search_call` 块归一化成 seam 的
* `WebSearchResult.sources`。
*
* @module dsh-web-search-diy/protocols/responses
*/
/** True for the official block type or a namespaced server tool (`openrouter:web_search`). */
function isWebSearchBlock(type) {
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
function mapResponsesResponse(data) {
	const output = asArray(asRecord(data)?.output);
	const seen = /* @__PURE__ */ new Set();
	const sources = [];
	const titles = /* @__PURE__ */ new Map();
	const sourceTitles = /* @__PURE__ */ new Map();
	const resultDetails = /* @__PURE__ */ new Map();
	const addSource = (url) => {
		if (url === void 0 || seen.has(url)) return;
		seen.add(url);
		sources.push({ url });
	};
	let content;
	let finalAnswer;
	let hasSearchCall = false;
	const failedStatuses = /* @__PURE__ */ new Set(["failed", "incomplete"]);
	let failedCallCount = 0;
	const blockTypes = /* @__PURE__ */ new Set();
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
		} else if (type === "message") for (const rawItem of asArray(block.content)) {
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
function toolDeclaration(options) {
	const { settings, capability } = options;
	const tool = { type: settings.toolType };
	/** OpenRouter 的命名空间 server tool 把参数放在 `parameters` 里；自定义 target 选同一拼写时也走这里。 */
	if (options.capability.vendor === "openrouter" || settings.toolType.endsWith(":web_search")) {
		const parameters = {};
		if (settings.engine.length > 0) parameters.engine = settings.engine;
		if (settings.mode.length > 0) parameters.mode = settings.mode;
		if (settings.maxResults > 0) parameters.max_results = settings.maxResults;
		if (hasField(capability, "maxUses")) parameters.max_uses = settings.maxUses;
		if (hasField(capability, "maxTotalResults")) parameters.max_total_results = settings.maxTotalResults;
		if (hasField(capability, "searchContextSize")) parameters.search_context_size = settings.searchContextSize;
		if (hasField(capability, "excludedDomains") || hasField(capability, "blockedDomains")) {
			/** OpenRouter 只有 excluded_domains；自定义 target 填的 blockedDomains 一并映射过去，避免被静默忽略。 */
			const domains = [.../* @__PURE__ */ new Set([...splitList(settings.excludedDomains), ...hasField(capability, "blockedDomains") ? splitList(settings.blockedDomains) : []])];
			if (domains.length > 0) parameters.excluded_domains = domains;
		}
		if (settings.maxCharacters > 0) parameters.max_characters = settings.maxCharacters;
		if (settings.userLocation.length > 0) parameters.user_location = {
			type: "approximate",
			country: settings.userLocation
		};
		if (settings.xSearch.length > 0) try {
			parameters.x_search = JSON.parse(settings.xSearch);
		} catch {}
		if (Object.keys(parameters).length > 0) tool.parameters = parameters;
		return tool;
	}
	if (hasField(capability, "searchContextSize")) tool.search_context_size = settings.searchContextSize;
	if (hasField(capability, "allowedDomains") || hasField(capability, "blockedDomains")) {
		const filters = {};
		const allowed = splitList(settings.allowedDomains);
		const blocked = splitList(settings.blockedDomains);
		if (allowed.length > 0) filters.allowed_domains = allowed;
		if (blocked.length > 0) filters.blocked_domains = blocked;
		if (Object.keys(filters).length > 0) tool.filters = filters;
	}
	if (hasField(capability, "userLocation") && settings.userLocation.length > 0) tool.user_location = {
		type: "approximate",
		country: settings.userLocation
	};
	if (settings.externalWebAccess.length > 0) tool.external_web_access = settings.externalWebAccess === "true";
	if (settings.returnTokenBudget.length > 0) tool.return_token_budget = settings.returnTokenBudget;
	if (hasField(capability, "searchContentTypes")) {
		const types = splitList(settings.searchContentTypes);
		if (types.length > 0) tool.search_content_types = types;
	}
	const imageSettings = {};
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
async function searchResponses(options, apiKey, request, signal) {
	const { settings, capability } = options;
	const endpoint = options.endpoint;
	const data = await postWithReasoningFallback(endpoint, apiKey, {
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
		...settings.includeSources && hasField(capability, "includeSources") ? { include: ["web_search_call.action.sources"] } : {},
		/** 只在显式设置时发送；未实现该参数的网关可能直接拒绝未知字段。 */
		...settings.reasoningEffort.length > 0 ? { reasoning: { effort: settings.reasoningEffort } } : {}
	}, signal).catch((error) => {
		if (error instanceof WebError && /\b404\b/u.test(error.message)) throw new WebError(`${error.message} — this endpoint exposes no Responses path; point ${capability.id} at a gateway that really implements the Responses API${capability.docs !== void 0 ? ` (docs: ${capability.docs})` : ""}, or switch to another target`, "WEB_PROVIDER_ERROR", { cause: error });
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
//#endregion
//#region src/protocols/search.ts
/**
* 纯工具搜索协议：3 个兼容模板（智谱 / DeepSeek / Kimi）+ 自定义字段映射。
*
* 没有模型回合；结构化结果直接成为来源，前若干条的摘要成为 `content`。
*
* @module dsh-web-search-diy/protocols/search
*/
/** 内置模板；自定义 target 通过同名 `template` 选择。 */
const TEMPLATES = {
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
		contentField: "summary",
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
function templateOf(options) {
	const id = options.capability.vendor === "custom" ? options.settings.template : options.capability.vendor;
	const base = TEMPLATES[id] ?? TEMPLATES.zhipu;
	const settings = options.settings;
	/** 自定义的字段名覆盖只对纯工具生效；内置 target 的这些键不在 fields 里，保持为空。 */
	const template = {
		resultsPath: settings.resultsPath.length > 0 ? settings.resultsPath : base.resultsPath,
		urlField: settings.urlField.length > 0 ? settings.urlField : base.urlField,
		titleField: settings.titleField.length > 0 ? settings.titleField : base.titleField,
		snippetField: settings.snippetField.length > 0 ? settings.snippetField : base.snippetField,
		dateField: settings.dateField.length > 0 ? settings.dateField : base.dateField,
		contentField: settings.contentField.length > 0 ? settings.contentField : base.contentField,
		queryField: settings.queryField.length > 0 ? settings.queryField : base.queryField,
		countField: settings.countField.length > 0 ? settings.countField : base.countField
	};
	return {
		id: TEMPLATES[id] !== void 0 ? id : "zhipu",
		template
	};
}
/** 点路径读取；空路径返回原值。 */
function readPath(value, path) {
	if (path.length === 0) return value;
	let current = value;
	for (const segment of path.split(".")) {
		const record = asRecord(current);
		if (record === void 0) return void 0;
		current = record[segment];
		if (current === void 0) return void 0;
	}
	return current;
}
/** 读取一个结果项的字段（自定义覆盖优先）。 */
function fieldOf(item, override, fallback) {
	const key = override.length > 0 ? override : fallback;
	return key.length > 0 ? asString(item[key]) : void 0;
}
/** DeepSeek 的 `query` 硬上限是 128 个 Unicode 字符，超出会被端点直接 400。 */
const DEEPSEEK_QUERY_LIMIT = 128;
/** 按 Unicode 码点截断，避免把代理对切成半个字符。 */
function truncateQuery(query, limit) {
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
function normalizeQuery(templateId, query) {
	const trimmed = query.trim();
	if (trimmed.length === 0) throw new WebError("web search query is empty", "WEB_PROVIDER_ERROR");
	return templateId === "deepseek" ? truncateQuery(trimmed, DEEPSEEK_QUERY_LIMIT) : trimmed;
}
/** DeepSeek 只接受合法 IP；非法值发出去会 400，因此按未提供处理。 */
function localizationOf(value) {
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
function originalQuestionOf(read) {
	const collapsed = read?.()?.replace(/\s+/gu, " ").trim() ?? "";
	if (collapsed.length === 0) return void 0;
	return [...collapsed].slice(0, ORIGINAL_QUESTION_LIMIT).join("");
}
/** 构造请求体；自定义的 `queryField` / `countField` 覆盖字段名。 */
function buildBody(options, query, maxResults, templateId, template) {
	const { settings, capability } = options;
	const searchQuery = normalizeQuery(templateId, query);
	const queryKey = template.queryField;
	const countKey = template.countField;
	const requested = typeof maxResults === "number" && Number.isInteger(maxResults) ? maxResults : settings.count;
	const count = Math.min(Math.max(requested, 1), templateId === "kimi" ? 20 : 50);
	if (templateId === "deepseek") {
		const originalQuestion = originalQuestionOf(options.originalQuestion);
		const localization = localizationOf(settings.localization);
		return {
			[queryKey]: searchQuery,
			[countKey]: count,
			...originalQuestion !== void 0 ? { ori_question: originalQuestion } : {},
			...settings.includeContent ? { need_content: true } : {},
			...localization !== void 0 ? { localization } : {}
		};
	}
	if (templateId === "kimi") return {
		[queryKey]: searchQuery,
		[countKey]: count,
		timeout_seconds: settings.timeoutSeconds,
		...settings.includeContent ? { include_content: true } : {}
	};
	/** 智谱模板：内置 target 用完整参数；自定义按 target 声明的字段发送。 */
	const body = {
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
/** catalog 未声明时的兜底。 */
const DEFAULT_DIGEST_LIMITS = {
	maxEntries: 8,
	maxSnippetChars: 200
};
/** 生成 `content` 摘要：编号的标题 + 摘要列表。 */
function digestOf(entries, template, maxEntries, maxSnippetLength) {
	const lines = [];
	for (const rawItem of entries) {
		if (lines.length >= maxEntries) break;
		const item = asRecord(rawItem);
		if (item === void 0) continue;
		const title = (fieldOf(item, template.titleField, "title") ?? "").trim();
		const snippet = (fieldOf(item, template.snippetField, "snippet") ?? "").trim();
		const head = `${lines.length + 1}. `;
		if (title.length > 0 && snippet.length > 0) lines.push(`${head}${title}\n${snippet.slice(0, maxSnippetLength)}`);
		else if (title.length > 0) lines.push(`${head}${title}`);
		else if (snippet.length > 0) lines.push(`${head}${snippet.slice(0, maxSnippetLength)}`);
	}
	return lines.join("\n");
}
/**
* 归一化一次纯工具搜索的响应。
*
* `resultsPath` 定位结果数组（自定义可覆盖），`urlField` 等决定逐项字段名；
* 有 URL 的项成为来源，前若干条拼成 `content`。空结果集是有效结果。
*
* @param data - 解析后的响应体。
* @param template - 模板规格。
* @returns 归一化结果。
*/
function mapStandaloneResponse(data, template = TEMPLATES.zhipu, limits = DEFAULT_DIGEST_LIMITS) {
	const entries = asArray(readPath(data, template.resultsPath));
	const seen = /* @__PURE__ */ new Set();
	const sources = [];
	for (const rawItem of entries) {
		const item = asRecord(rawItem);
		if (item === void 0) continue;
		const url = normalizeSourceUrl(fieldOf(item, template.urlField, "url"));
		if (url === void 0 || seen.has(url)) continue;
		seen.add(url);
		const source = { url };
		const title = fieldOf(item, template.titleField, "title");
		if (title !== void 0 && title.length > 0) source.title = title;
		const snippet = fieldOf(item, template.snippetField, "snippet");
		if (snippet !== void 0 && snippet.length > 0) source.snippet = snippet;
		const publishedAt = isoPublishedAt(fieldOf(item, template.dateField, ""));
		if (publishedAt !== void 0) source.publishedAt = publishedAt;
		sources.push(source);
	}
	if (entries.length === 0) return {
		sources,
		truncated: false
	};
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
function mapZhipuWebSearchResponse(data) {
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
async function searchStandalone(options, apiKey, request, signal) {
	const { id, template } = templateOf(options);
	const body = buildBody(options, request.query, request.maxResults, id, template);
	const data = await postJson(options.endpoint, apiKey, body, signal);
	try {
		return mapStandaloneResponse(data, template, {
			maxEntries: options.settings.digestEntries,
			maxSnippetChars: options.settings.digestSnippetChars
		});
	} catch (error) {
		if (signal?.aborted === true || isAbortError(error)) throw searchAborted(signal, error);
		if (error instanceof WebError) throw error;
		throw new WebError(`web search returned an unprocessable response body: ${String(error)}`, "WEB_PROVIDER_ERROR", { cause: error });
	}
}
//#endregion
//#region src/provider.ts
/**
* WebSearchProvider 实现：可用性检查、按协议分派、凭据解析。
*
* @module dsh-web-search-diy/provider
*/
/** Stable id this provider registers under on the seam. */
const PROVIDER_ID = "diy-search";
/** 纯工具搜索没有模型回合。 */
function needsModel(protocol) {
	return protocol !== "search";
}
/**
* 本插件的搜索 provider。每个 target 按 `protocol` 分派到对应协议实现；seam 负责
* `maxResults` 截断，因此这里的 `truncated` 永远是 `false`。
*/
var DiySearchProvider = class {
	id = PROVIDER_ID;
	resolveOptions;
	/**
	* @param resolveOptions - 下一次操作的选项，在每个操作入口处快照一次。
	*/
	constructor(resolveOptions) {
		this.resolveOptions = resolveOptions;
	}
	/** 本地廉价可用性检查：target 可选、端点合法、必填项齐全。 */
	available() {
		const options = this.resolveOptions();
		const capability = options.capability;
		if (capability.support === "unsupported") return false;
		if (options.baseURL.length === 0 || !URL.canParse(options.baseURL)) return false;
		if (capability.support === "custom" && options.apiKeyEnv.length === 0) return false;
		if (needsModel(capability.protocol) && options.settings.model.length === 0) return false;
		if (needsModel(capability.protocol) && options.settings.maxOutputTokens < 1) return false;
		return true;
	}
	/**
	* 运行一次搜索，按协议分派。
	*
	* @param request - seam 搜索请求。
	* @param signal - 取消信号。
	* @returns 归一化结果。
	* @throws {WebError} target 不可用或凭据缺失时。
	*/
	async search(request, signal) {
		const options = this.resolveOptions();
		if (options.capability.support === "unsupported") throw new WebError(`target ${options.capability.id} is not supported: ${options.capability.reason ?? "no reason recorded"}`, "WEB_PROVIDER_ERROR");
		const apiKey = await this.apiKey(options, signal);
		throwIfSearchAborted(signal);
		switch (options.capability.protocol) {
			case "responses": return searchResponses(options, apiKey, request, signal);
			case "anthropic-messages": return searchAnthropicMessages(options, apiKey, request, signal);
			case "chat-completions": return searchChatCompletions(options, apiKey, request, signal);
			case "search": return searchStandalone(options, apiKey, request, signal);
		}
	}
	/**
	* 解析一次操作的凭据，不在 provider 上保留。
	*
	* @param options - 调用方的快照，保证 key 与端点来自同一个 target。
	* @param signal - 外层搜索的中断信号。
	* @returns 已解析的 key。
	* @throws {WebError} 凭据缺失或解析失败时。
	*/
	async apiKey(options, signal) {
		throwIfSearchAborted(signal);
		let resolved;
		try {
			resolved = await abortable(options.resolveApiKey(), signal);
		} catch (error) {
			if (signal?.aborted === true || isAbortError(error)) throw searchAborted(signal, error);
			throw new WebError(`web search credential resolution failed: ${String(error)}`, "WEB_PROVIDER_ERROR", { cause: error });
		}
		if (resolved !== void 0 && resolved.length > 0) return resolved;
		const candidates = [options.apiKeyEnv, ...options.apiKeyEnvFallbacks].filter((name) => name.length > 0).map((name) => `"${name}"`).join(" or ");
		throw new WebError(`web search has no API key for ${candidates.length > 0 ? candidates : "this target"}; store it through the credentials service (the web Models page writes it), export it in the launching environment, or set apiKeyEnv for ${options.capability.id}`, "WEB_PROVIDER_CREDENTIAL_MISSING");
	}
};
//#endregion
//#region src/endpoint.ts
/**
* Host 配置端点：`/api/web-search-diy/config` 的 GET / POST。
*
* GET 下发完整 catalog，Client 不再自带厂商默认值。POST 只接受当前 target 声明的
* 字段；API key 只经凭据面写入。
*
* @module dsh-web-search-diy/endpoint
*/
/** 配置请求体上限：表单 JSON 远小于此值，超限说明不是本端点该收的请求。 */
const MAX_JSON_BODY_BYTES = 1048576;
/** 请求体超过上限；调用方据此返回 413 而不是“不是合法 JSON”。 */
var BodyTooLargeError = class extends Error {
	status = 413;
};
/** 读取 JSON 请求体，超过 {@link MAX_JSON_BODY_BYTES} 时拒绝。 */
function readJsonBody(req) {
	return new Promise((resolve, reject) => {
		let raw = "";
		let bytes = 0;
		let settled = false;
		const fail = (error) => {
			if (settled) return;
			settled = true;
			reject(error);
		};
		req.on("data", (chunk) => {
			if (settled) return;
			/** 表单与 Node 的 HTTP 块都可能是 Buffer；按字节而不是字符数累计。 */
			const text = typeof chunk === "string" ? chunk : Buffer.isBuffer(chunk) ? chunk.toString("utf8") : String(chunk);
			bytes += Buffer.byteLength(text);
			if (bytes > MAX_JSON_BODY_BYTES) {
				fail(new BodyTooLargeError(`request body exceeds ${MAX_JSON_BODY_BYTES} bytes`));
				return;
			}
			raw += text;
		});
		req.on("end", () => {
			if (settled) return;
			settled = true;
			try {
				resolve(raw.length > 0 ? JSON.parse(raw) : {});
			} catch (error) {
				reject(error);
			}
		});
		req.on("error", (error) => {
			fail(error);
		});
	});
}
/** 统一 JSON 响应。 */
function sendJson(res, status, body) {
	const payload = JSON.stringify(body);
	res.writeHead(status, {
		"Content-Type": "application/json; charset=utf-8",
		"Content-Length": Buffer.byteLength(payload),
		/** 配置与选择每次都从磁盘读取，缓存会让设置页展示过时状态。 */
		"Cache-Control": "no-store"
	});
	res.end(payload);
}
/** 下发给 Client 的 catalog 条目；形状由 `contract.ts` 与 Client 共享。 */
function catalogPayload() {
	return Object.values(ALL_TARGETS).map((capability) => ({
		id: capability.id,
		kind: capability.protocol === "search" ? "standalone" : "in-protocol",
		protocol: capability.protocol,
		vendor: capability.vendor,
		support: capability.support,
		reason: capability.reason ?? "",
		title: capability.title,
		docs: capability.docs ?? "",
		/** 展开成普通对象：`TargetDefaults` 是具名类型，不满足索引签名。 */
		defaults: { ...capability.defaults },
		fields: capability.fields,
		/** 字段值域随 catalog 下发：Client 的控件与即时校验都从这里派生。 */
		specs: specsOf(capability),
		modelLocked: capability.modelLocked === true,
		hints: capability.hints ?? {},
		...capability.templates !== void 0 ? { templates: capability.templates } : {}
	}));
}
/**
* 校验自定义 target 的必填项。
*
* @param capability - 目标能力。
* @param merged - 合并后的桶（现有 + 本次 patch）。
* @returns 错误文案，或 undefined。
*/
function validateCustom(capability, merged) {
	if (capability.support !== "custom") return void 0;
	if (capability.protocol === "search") {
		/** `template` 只是填充动作，不落盘；实际请求由已保存的字段与内置默认决定。 */
		if (typeof merged.path !== "string" || merged.path.length === 0) return "自定义纯工具搜索必须填写 path";
		return;
	}
	if (capability.protocol === "chat-completions") {
		if (typeof merged.chatVariant !== "string" || merged.chatVariant.length === 0) return "自定义 Chat 必须选择 chatVariant";
		return;
	}
	/** Responses 与 Anthropic 的自定义实例靠 toolType 决定请求形状，缺了就会静默不搜索。 */
	if (typeof merged.toolType !== "string" || merged.toolType.length === 0) return `自定义 ${capability.protocol} 必须填写 toolType`;
}
/**
* 每个厂商默认凭据链是否可解析。
*
* 配置页的「已配置密钥」徽标必须跟随所选厂商，而不是只反映加载时的 target；
* 因此 GET 一次给出全部厂商的状态。`custom` 的引用名由用户填写，没有默认链，
* 恒为 false（UI 另行提示「取决于凭据引用」）。
*
* @param ctx - 插件上下文（credentials 经 `ctx.get` 取得）。
* @returns 厂商 → 是否至少有一条默认引用可解析。
*/
async function credentialState(ctx) {
	const chains = /* @__PURE__ */ new Map();
	for (const capability of Object.values(ALL_TARGETS)) {
		if (capability.support === "unsupported") continue;
		const names = chains.get(capability.vendor) ?? [];
		for (const name of capability.defaults.apiKeyEnv) if (!names.includes(name)) names.push(name);
		chains.set(capability.vendor, names);
	}
	const entries = await Promise.all(VENDORS.map(async (vendor) => {
		const names = chains.get(vendor) ?? [];
		return [vendor, names.length > 0 && await hasCredential(ctx, names)];
	}));
	return Object.fromEntries(entries);
}
/**
* 校验依赖其他字段取值的组合限制。
*
* 智谱 `search_pro_sogou` 只接受 10/20/30/40/50 的 `count`；这是字段级规格表达不了
* 的约束，所以在合并后的桶上校验。
*
* @param capability - 目标能力。
* @param merged - 合并后的桶（现有 + 本次 patch）。
* @returns 错误文案，或 undefined。
*/
function validateTargetValues(capability, merged) {
	if (capability.vendor !== "zhipu" || merged.searchEngine !== "search_pro_sogou") return void 0;
	const count = merged.count;
	if (typeof count !== "number") return void 0;
	return [
		10,
		20,
		30,
		40,
		50
	].includes(count) ? void 0 : "search_pro_sogou 的 count 只支持 10/20/30/40/50";
}
/**
* 在 webServer 服务上注册配置 HTTP 端点（仅 web profile）。
*
* @param ctx - 插件上下文（credentials 经 `ctx.get` 取得）。
* @param webServer - host webserver 服务。
*/
function registerConfigEndpoint(ctx, webServer) {
	/** 每次打开配置页都会探测全部厂商的凭据链；短 TTL 合并重复的 GET，保存后立即失效。 */
	const CREDENTIAL_CACHE_MS = 2e3;
	let credentialCache;
	const cachedCredentialState = async () => {
		const now = Date.now();
		if (credentialCache !== void 0 && now - credentialCache.at < CREDENTIAL_CACHE_MS) return credentialCache.value;
		const value = await credentialState(ctx);
		credentialCache = {
			at: now,
			value
		};
		return value;
	};
	const disposeConfig = webServer.register({
		kind: "exact",
		path: "/api/web-search-diy/config",
		handler: async (req, res) => {
			if (req.method === "GET") {
				const document = readConfigDocument();
				const target = selectedTargetOf(document) ?? await selectDefaultTarget(ctx, document);
				const capability = capabilityOf(target) ?? ALL_TARGETS[DEFAULT_TARGET];
				const bucket = document.targets[target] ?? {};
				const keyConfigured = await hasCredential(ctx, capability.defaults.apiKeyEnv);
				const credentials = await cachedCredentialState();
				return sendJson(res, 200, {
					version: 3,
					selection: {
						vendor: capability.vendor,
						protocol: capability.protocol
					},
					target: bucket,
					targets: document.targets,
					keyConfigured,
					/** 每个厂商的默认链状态：Client 切厂商时据此更新密钥徽标。 */
					credentials,
					/** 每种搜索形态的默认落点：Client 切换搜索方式时使用。 */
					shapeDefaults: SHAPE_DEFAULT_TARGETS,
					catalog: catalogPayload()
				});
			}
			if (req.method === "POST") {
				let body;
				try {
					body = await readJsonBody(req);
				} catch (error) {
					if (error instanceof BodyTooLargeError) return sendJson(res, 413, { error: "请求体过大" });
					return sendJson(res, 400, { error: "请求体不是合法 JSON" });
				}
				if (body === null || typeof body !== "object") return sendJson(res, 400, { error: "请求体必须是 JSON 对象" });
				const record = body;
				const vendor = record.vendor;
				const protocol = record.protocol;
				if (typeof vendor !== "string" || typeof protocol !== "string") return sendJson(res, 400, { error: "请求体必须包含 vendor 与 protocol" });
				const id = `${vendor}/${protocol}`;
				const capability = capabilityOf(id);
				if (capability === void 0) return sendJson(res, 400, { error: `未知的 target: ${id}` });
				if (capability.support === "unsupported") return sendJson(res, 400, { error: `${id} 不可用：${capability.reason ?? "不支持"}` });
				if (!isSelectable(id)) return sendJson(res, 400, { error: `${id} 不可选择` });
				const { patch, cleared, error } = buildConfigPatch(capability, record);
				if (error !== void 0) return sendJson(res, 400, { error });
				const merged = {
					...readConfigDocument().targets[id] ?? {},
					...patch
				};
				for (const key of cleared) delete merged[key];
				const customError = validateCustom(capability, merged);
				if (customError !== void 0) return sendJson(res, 400, { error: customError });
				const valueError = validateTargetValues(capability, merged);
				if (valueError !== void 0) return sendJson(res, 400, { error: valueError });
				if (typeof record.apiKey === "string" && record.apiKey.length > 0) {
					const credentials = ctx.get("credentials");
					if (credentials === void 0) return sendJson(res, 400, { error: "credentials 服务不可用，无法保存 API key" });
					const refName = typeof merged.apiKeyEnv === "string" && merged.apiKeyEnv.length > 0 ? merged.apiKeyEnv : capability.defaults.apiKeyEnv[0];
					if (refName === void 0) return sendJson(res, 400, { error: "请先填写 apiKeyEnv（凭据引用名）" });
					try {
						await credentials.set(credentialRef(refName), record.apiKey);
					} catch (cause) {
						return sendJson(res, 400, { error: `API key 保存失败: ${String(cause)}` });
					}
				}
				const saved = saveConfig(capability.vendor, capability.protocol, patch, cleared);
				/** The save may have written a key or changed apiKeyEnv; the next GET must re-probe. */
				credentialCache = void 0;
				return sendJson(res, 200, {
					ok: true,
					keyConfigured: await hasCredential(ctx, capability.defaults.apiKeyEnv),
					targets: saved.targets
				});
			}
			return sendJson(res, 405, { error: "仅支持 GET / POST" });
		}
	});
	/**
	* 用当前草稿（含已保存值）执行一次最小搜索，不写盘。失败也返回 200，
	* 由 `ok` 字段区分，便于 UI 统一渲染。
	*/
	const disposeTest = webServer.register({
		kind: "exact",
		path: "/api/web-search-diy/test",
		handler: async (req, res) => {
			if (req.method !== "POST") return sendJson(res, 405, { error: "仅支持 POST" });
			let body;
			try {
				body = await readJsonBody(req);
			} catch (error) {
				if (error instanceof BodyTooLargeError) return sendJson(res, 413, { error: "请求体过大" });
				return sendJson(res, 400, { error: "请求体不是合法 JSON" });
			}
			if (body === null || typeof body !== "object") return sendJson(res, 400, { error: "请求体必须是 JSON 对象" });
			const record = body;
			if (typeof record.vendor !== "string" || typeof record.protocol !== "string") return sendJson(res, 400, { error: "请求体必须包含 vendor 与 protocol" });
			const id = `${record.vendor}/${record.protocol}`;
			const capability = capabilityOf(id);
			if (capability === void 0) return sendJson(res, 400, { error: `未知的 target: ${id}` });
			if (capability.support === "unsupported") return sendJson(res, 400, { error: `${id} 不可用：${capability.reason ?? "不支持"}` });
			const { patch, cleared, error } = buildConfigPatch(capability, record);
			if (error !== void 0) return sendJson(res, 400, { error });
			const merged = {
				...readConfigDocument().targets[id] ?? {},
				...patch
			};
			for (const key of cleared) delete merged[key];
			/** 测试连接走与保存完全相同的校验，避免“保存被拒、测试却发出请求”的错位。 */
			const customError = validateCustom(capability, merged);
			if (customError !== void 0) return sendJson(res, 400, { error: customError });
			const valueError = validateTargetValues(capability, merged);
			if (valueError !== void 0) return sendJson(res, 400, { error: valueError });
			const options = resolveOptions(ctx, {
				version: 3,
				targets: { [id]: merged }
			}, id);
			const started = Date.now();
			try {
				const result = await new DiySearchProvider(() => options).search({
					query: "OpenAI",
					maxResults: 3
				}, AbortSignal.timeout(6e4));
				return sendJson(res, 200, {
					ok: true,
					sourceCount: result.sources.length,
					sourceQuality: capability.search.sourceQuality,
					degraded: capability.support === "degraded",
					latencyMs: Date.now() - started,
					contentPreview: (result.content ?? "").slice(0, 200)
				});
			} catch (cause) {
				return sendJson(res, 200, {
					ok: false,
					degraded: capability.support === "degraded",
					latencyMs: Date.now() - started,
					error: cause instanceof Error ? cause.message : String(cause)
				});
			}
		}
	});
	return () => {
		disposeConfig();
		disposeTest();
	};
}
//#endregion
//#region src/index.ts
/** Cordis 插件名，供 loader 诊断使用。 */
const name = "web-search-diy";
/** 本 provider 注册进的 web 能力面。 */
const inject = ["web"];
/**
* 注册搜索 provider 与配置端点。
*
* 默认 target 在加载时按「已保存选择 → 可解析凭据 → DeepSeek 纯工具搜索」异步确定；
* 每次搜索都重新读取文件，因此保存后立即生效，无需重启。
*
* @param ctx - Cordis 插件上下文。
*/
function apply(ctx) {
	let fallback = DEFAULT_TARGET;
	selectDefaultTarget(ctx, readConfigDocument()).then((target) => {
		fallback = target;
	}, () => void 0);
	ctx.web.registerSearchProvider(new DiySearchProvider(() => resolveCurrentOptions(ctx, fallback)));
	ctx.inject(["webServer"], (sctx) => {
		/**
		* The route registration returns a disposer. It belongs to the injected
		* child fiber (`sctx`), not this plugin's fiber: when `webServer` goes
		* away the child unloads, and its effect must release the routes before a
		* replacement server is provided — otherwise the same paths are registered
		* twice and the old ones linger.
		*/
		sctx.effect(() => registerConfigEndpoint(ctx, sctx.webServer), `${name}: config route`);
	});
}
//#endregion
export { ALL_TARGETS, CATALOG, CONFIG_VERSION, CUSTOM_TARGETS, DEFAULT_API_VERSION, DEFAULT_TARGET, DiySearchProvider, DiySearchProvider as OpenAiSearchProvider, LEGACY_MODE_TARGETS, OFFICIAL_TARGET_IDS, PROTOCOLS, PROVIDER_ID, SHAPE_DEFAULT_TARGETS, TEMPLATES, UNSUPPORTED_CATALOG, USER_AGENT, VENDORS, apply, buildConfigPatch, capabilityOf, configFilePath, hasCredential, hasField, inject, isSelectable, isTargetId, joinEndpoint, mapAnthropicResponse, mapChatAnnotationsResponse, mapQwenChatResponse, mapResponsesResponse, mapStandaloneResponse, mapZhipuChatResponse, mapZhipuWebSearchResponse, name, projectTarget, readConfigDocument, resolveCurrentOptions, resolveOptions, saveConfig, selectDefaultTarget, selectedTargetOf, splitList, splitTargetId, targetIdOf };
