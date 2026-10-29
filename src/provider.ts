/**
 * WebSearchProvider 实现：可用性检查、按协议分派、凭据解析。
 *
 * @module dsh-web-search-diy/provider
 */
import { WebError } from "@deepseek-ai/dsh-web";
import type { WebSearchProvider, WebSearchRequest, WebSearchResult } from "@deepseek-ai/dsh-web";
import { searchAnthropicMessages } from "./protocols/anthropic.ts";
import { searchChatCompletions } from "./protocols/chat.ts";
import { searchResponses } from "./protocols/responses.ts";
import { searchStandalone } from "./protocols/search.ts";
import { abortable, isAbortError, searchAborted, throwIfSearchAborted } from "./transport.ts";
import type { SearchOptions } from "./types.ts";

/** Stable id this provider registers under on the seam. */
export const PROVIDER_ID = "diy-search";

/** 纯工具搜索没有模型回合。 */
function needsModel(protocol: string): boolean {
	return protocol !== "search";
}

/**
 * 本插件的搜索 provider。每个 target 按 `protocol` 分派到对应协议实现；seam 负责
 * `maxResults` 截断，因此这里的 `truncated` 永远是 `false`。
 */
export class DiySearchProvider implements WebSearchProvider {
	readonly id = PROVIDER_ID;
	private readonly resolveOptions: () => SearchOptions;

	/**
	 * @param resolveOptions - 下一次操作的选项，在每个操作入口处快照一次。
	 */
	constructor(resolveOptions: () => SearchOptions) {
		this.resolveOptions = resolveOptions;
	}

	/** 本地廉价可用性检查：target 可选、端点合法、必填项齐全。 */
	available(): boolean {
		return this.isUsable(this.resolveOptions());
	}

	/**
	 * 下一次搜索能否带上凭据。
	 *
	 * 只查配置与凭据面，不做网络请求。`llmProvider` 属于按模型路由区分凭据的部署；
	 * 本插件按 target 固定一条引用链，因此忽略它。
	 *
	 * @param _llmProvider - seam 传入的模型路由 id；本插件不使用。
	 * @returns 配置可用且能解析出凭据时为 true。
	 */
	async ready(_llmProvider?: string): Promise<boolean> {
		const options = this.resolveOptions();
		if (!this.isUsable(options)) return false;
		try {
			const apiKey = await options.resolveApiKey();
			return apiKey !== void 0 && apiKey.length > 0;
		} catch {
			/** 没有可解析的 key 时搜索必然失败，按不可用处理。 */
			return false;
		}
	}

	/** 一份选项快照上的可用性判断；`available()` 与 `ready()` 共用。 */
	private isUsable(options: SearchOptions): boolean {
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
	async search(request: WebSearchRequest, signal?: AbortSignal): Promise<WebSearchResult> {
		const options = this.resolveOptions();
		if (options.capability.support === "unsupported") {
			throw new WebError(`target ${options.capability.id} is not supported: ${options.capability.reason ?? "no reason recorded"}`, "WEB_PROVIDER_ERROR");
		}
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
	private async apiKey(options: SearchOptions, signal?: AbortSignal): Promise<string> {
		throwIfSearchAborted(signal);
		let resolved: string | undefined;
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
}

/** 1.x 的导出名，保留给已有调用方。 */
export { DiySearchProvider as OpenAiSearchProvider };