/**
 * dsh-web-search-diy 2.0 — 为 DeepSeek Harness 的 web 能力面（`ctx.web`）注册搜索
 * provider，支持三层选择：搜索形态（协议内置 / 纯工具）→ 协议 → 厂商。
 *
 * 协议：
 * - `chat-completions`：OpenAI 兼容 Chat Completions，按厂商分 4 个变体；
 * - `responses`：OpenAI 兼容 Responses API + 内置 `web_search` 工具；
 * - `anthropic-messages`：Anthropic 兼容 Messages API + `web_search_*` 服务端工具；
 * - `search`：纯工具搜索（智谱 / DeepSeek / Kimi 模板），无模型回合。
 *
 * 厂商差异集中在 `catalog.ts`；配置只走 UI 管理的文件与凭据面，不注册 settings 段。
 *
 * @module dsh-web-search-diy
 */
import type { Context } from "@deepseek-ai/cordis";
import { DEFAULT_TARGET, type TargetId } from "./catalog.ts";
import { readConfigDocument, selectDefaultTarget } from "./config.ts";
import { registerConfigEndpoint, type WebServerLike } from "./endpoint.ts";
import { resolveCurrentOptions } from "./options.ts";
import { DiySearchProvider } from "./provider.ts";

/** Cordis 插件名，供 loader 诊断使用。 */
export const name = "web-search-diy";
/** 本 provider 注册进的 web 能力面。 */
export const inject = ["web"];

/**
 * 注册搜索 provider 与配置端点。
 *
 * 默认 target 在加载时按「已保存选择 → 可解析凭据 → `qwen/responses`」异步确定；
 * 每次搜索都重新读取文件，因此保存后立即生效，无需重启。
 *
 * @param ctx - Cordis 插件上下文。
 */
export function apply(ctx: Context): void {
	let fallback: TargetId = DEFAULT_TARGET;
	selectDefaultTarget(ctx, readConfigDocument()).then((target) => {
		fallback = target;
	}, () => void 0);
	ctx.web.registerSearchProvider(new DiySearchProvider(() => resolveCurrentOptions(ctx, fallback)));
	// The config endpoint rides the webServer service when it appears (web
	// profiles). Non-web compositions never provide webServer, so the inject
	// simply never fires — no dedicated row or disabled flag is needed.
	ctx.inject(["webServer"], (sctx) => {
		/** The route registration returns a disposer; keep it on the plugin fiber so unload removes it. */
		ctx.effect(() => registerConfigEndpoint(ctx, (sctx as unknown as { webServer: WebServerLike }).webServer), `${name}: config route`);
	});
}

export {
	ALL_TARGETS,
	CATALOG,
	CUSTOM_TARGETS,
	capabilityOf,
	DEFAULT_TARGET,
	hasField,
	isSelectable,
	isTargetId,
	joinEndpoint,
	LEGACY_MODE_TARGETS,
	OFFICIAL_TARGET_IDS,
	PROTOCOLS,
	splitList,
	splitTargetId,
	targetIdOf,
	UNSUPPORTED_CATALOG,
	VENDORS
} from "./catalog.ts";
export type { Capability, FieldKey, Protocol, SearchKind, Support, TargetId, TargetOptions, Template, Vendor } from "./catalog.ts";
export {
	buildConfigPatch,
	CONFIG_VERSION,
	configFilePath,
	hasCredential,
	projectTarget,
	readConfigDocument,
	saveConfig,
	selectDefaultTarget
} from "./config.ts";
export { DEFAULT_API_VERSION, resolveCurrentOptions, resolveOptions, selectedTargetOf } from "./options.ts";
export { DiySearchProvider, OpenAiSearchProvider, PROVIDER_ID } from "./provider.ts";
export { mapAnthropicResponse } from "./protocols/anthropic.ts";
export { mapChatAnnotationsResponse, mapQwenChatResponse, mapZhipuChatResponse } from "./protocols/chat.ts";
export { mapResponsesResponse } from "./protocols/responses.ts";
export { mapStandaloneResponse, mapZhipuWebSearchResponse, TEMPLATES } from "./protocols/search.ts";
export type { RecordedSearchRequest, ResolvedSettings, SearchOptions } from "./types.ts";