/**
 * 选项解析：catalog 默认值 + UI 文件覆盖 → 一次搜索的完整快照。
 *
 * 只有两层：文件 > catalog 默认值。每个 target 的桶互相独立，切换不会串值。
 *
 * @module dsh-web-search-diy/options
 */
import { credentialRef } from "@deepseek-ai/dsh-credentials";
import type { Context } from "@deepseek-ai/cordis";
import type {} from "@deepseek-ai/dsh-agent";
import type { Session } from "@deepseek-ai/dsh-session";
import { launchEnvironmentOf } from "@deepseek-ai/dsh-launch-environment";
import { capabilityOf, CATALOG, DEFAULT_TARGET, joinEndpoint, type Protocol, type TargetId, type Vendor } from "./catalog.ts";
import type { ConfigDocument } from "./config.ts";
import { readConfigDocument } from "./config.ts";
import type { ResolvedSettings, SearchOptions } from "./types.ts";

/** Anthropic 协议的默认 `anthropic-version`。 */
export const DEFAULT_API_VERSION = "2023-06-01";

/** 辅助搜索端点覆盖变量（DeepSeek 官方搜索 provider 同名）。 */
export const SEARCH_BASE_URL_ENV = "DEEPSEEK_SEARCH_BASE_URL";

/** 所有字段的兜底值；catalog 未声明的字段靠它保持类型完整。 */
const DEFAULT_SETTINGS: ResolvedSettings = {
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
function defaultSettingsOf(targetId: TargetId): Partial<ResolvedSettings> {
	const capability = capabilityOf(targetId);
	if (capability === void 0) return {};
	const { apiKeyEnv: _ignored, ...rest } = capability.defaults;
	return rest as Partial<ResolvedSettings>;
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
function latestUserQuestion(session: Session | undefined): string | undefined {
	const messages = session?.deriveMessages() ?? [];
	for (let index = messages.length - 1; index >= 0; index -= 1) {
		const message = messages[index];
		if (message.role !== "user" || message.source.kind !== "user") continue;
		return message.content.flatMap((block) => block.type === "text" ? [block.text] : []).join("\n");
	}
	return void 0;
}

/**
 * 解析某个 target 的一次搜索选项。
 *
 * @param ctx - 提供凭据面与启动环境的插件上下文。
 * @param document - 已读取的配置文档。
 * @param targetId - 当前选择的 target。
 * @returns 一次搜索的选项。
 */
export function resolveOptions(ctx: Context, document: ConfigDocument, targetId: TargetId): SearchOptions {
	const capability = capabilityOf(targetId) ?? CATALOG[DEFAULT_TARGET];
	const file = document.targets[capability.id] ?? {};
	const defaults = defaultSettingsOf(capability.id);
	const merged: ResolvedSettings = { ...DEFAULT_SETTINGS, ...defaults };
	/** 模型锁定的组合忽略文件里的 model，始终使用 catalog 的固定模型。 */
	if (capability.modelLocked === true && capability.defaults.model !== void 0) merged.model = capability.defaults.model;
	for (const [key, value] of Object.entries(file)) {
		if (value !== void 0 && value !== "") (merged as unknown as Record<string, unknown>)[key] = value;
	}
	/**
	 * Anthropic 端点的环境覆盖仍然生效：DeepSeek 官方搜索 provider 认同一个变量，
	 * 已有部署的 `DEEPSEEK_SEARCH_BASE_URL` 在切到本插件后继续可用。
	 */
	const ambientBaseURL = capability.protocol === "anthropic-messages" ? launchEnvironmentOf(ctx).get(SEARCH_BASE_URL_ENV)?.value : void 0;
	const baseURL = (merged.baseURL.length > 0 ? merged.baseURL : ambientBaseURL ?? "").replace(/\/+$/u, "");
	const path = merged.path.length > 0 ? merged.path : capability.search.path;
	const endpoint = joinEndpoint(baseURL, path);
	const apiKeyEnvNames = file.apiKeyEnv !== void 0 && file.apiKeyEnv.length > 0 ? [file.apiKeyEnv] : capability.defaults.apiKeyEnv;
	const apiKeyEnv = apiKeyEnvNames[0] ?? "";
	const apiKeyEnvFallbacks = apiKeyEnvNames.slice(1);
	return {
		target: capability.id as TargetId,
		capability,
		settings: { ...merged, baseURL, path },
		baseURL,
		endpoint,
		apiKeyEnv,
		apiKeyEnvFallbacks,
		resolveApiKey: async () => {
			const credentials = ctx.get("credentials");
			const refs = [apiKeyEnv, ...apiKeyEnvFallbacks].filter((name) => name.length > 0);
			if (credentials !== void 0) {
				for (const ref of refs) {
					const value = (await credentials.resolve(credentialRef(ref)))?.value;
					if (value !== void 0 && value.length > 0) return value;
				}
				return void 0;
			}
			const environment = launchEnvironmentOf(ctx);
			for (const ref of refs) {
				const ambient = environment.get(ref);
				if (ambient !== void 0 && ambient.value.length > 0) return ambient.value;
			}
			return void 0;
		},
		/**
		 * 把出站模型请求记录到调用会话，与已发布 provider 一致。可选链是因为无头组合
		 * 不挂 agents 服务。
		 */
		recordRequest: (request) => {
			ctx.get("agents")?.currentInitiator()?.session.append("web/deepseek-search-llm-request", request);
		},
		/** 只有显式开启时才读取会话，避免每次搜索都触碰 agent 状态。 */
		originalQuestion: merged.oriQuestion
			? () => latestUserQuestion(ctx.get("agents")?.currentInitiator()?.session)
			: void 0
	};
}

/** 当前文档记录的选择；无效时 undefined。 */
export function selectedTargetOf(document: ConfigDocument): TargetId | undefined {
	if (document.vendor === void 0 || document.protocol === void 0) return void 0;
	const id = `${document.vendor}/${document.protocol}`;
	return capabilityOf(id) !== void 0 ? id as TargetId : void 0;
}

/** 一次解析的便捷入口：读文件、取选择（回退到 `fallback`）、解析选项。 */
export function resolveCurrentOptions(ctx: Context, fallback: TargetId): SearchOptions {
	const document = readConfigDocument();
	return resolveOptions(ctx, document, selectedTargetOf(document) ?? fallback);
}

/** 厂商与协议的类型再导出，供端点和测试使用。 */
export type { Protocol, TargetId, Vendor };