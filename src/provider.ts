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
import type { ObservationKind, SearchOutcome } from "./observability/types.ts";
import { abortable, isAbortError, searchAborted, throwIfSearchAborted } from "./transport.ts";
import type { SearchOptions } from "./types.ts";

/** 观测 sink；实现方保证不抛错、不影响搜索返回值。 */
export type OutcomeListener = (outcome: SearchOutcome) => void;

/** provider 的非搜索职责：诊断、观测与记录类型。 */
export interface DiySearchProviderOptions {
	/** 就绪检查失败时的诊断出口；无头组合不传时保持静默。 */
	readonly warn?: (message: string) => void;
	/** 观测采集出口；未启用观测时省略。 */
	readonly onOutcome?: OutcomeListener;
	/** 当前会话 id 来源，用于把记录关联回会话。 */
	readonly sessionId?: () => string | undefined;
	/** 记录类型；配置页测试连接传 `test`，默认 `search`。 */
	readonly kind?: ObservationKind;
}

/** `AbortSignal.timeout` 接受的上限（2^31-1 毫秒）。 */
const MAX_TIMEOUT_MS = 2_147_483_647;

/** 把配置值收窄成可用的超时；非法值回落到默认 25 秒。 */
function timeoutOf(value: number): number {
	return Number.isSafeInteger(value) && value > 0 ? Math.min(value, MAX_TIMEOUT_MS) : 25_000;
}

/** 失败原因的可观测形态；非 `WebError` 统一按 provider 错误归类。 */
function failureOf(error: unknown): { code: string; message: string } {
	const code = error instanceof WebError ? error.code : "WEB_PROVIDER_ERROR";
	return { code, message: error instanceof Error ? error.message : String(error) };
}

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
	/** Picker title; 0.2.2-rc.3 shows it instead of the raw provider id. */
	readonly title = "DIY Web Search";
	/**
	 * Picker description introduced in 0.2.2-rc.3: what the provider is suited
	 * for and how it is billed. The field is optional and absent from older
	 * `WebSearchProvider` types, so a plain literal keeps both builds assignable.
	 */
	readonly description = {
		en: "Searches through the vendor and protocol you configure; billed by that provider.",
		zh: "通过你选定的厂商与协议执行搜索，费用由对应厂商结算。",
		ja: "設定したベンダーとプロトコルで検索し、料金はその提供元に請求されます。",
		es: "Busca con el proveedor y protocolo que configures; la facturación corre a cargo de ese proveedor.",
		fr: "Recherche via le fournisseur et le protocole que vous configurez ; la facturation revient à ce fournisseur.",
		de: "Durchsucht das Web über den gewählten Anbieter und das Protokoll; die Abrechnung erfolgt durch diesen Anbieter.",
		ru: "Поиск идёт через выбранного поставщика и протокол; оплату выставляет этот поставщик.",
		pt: "Pesquisa pelo fornecedor e protocolo que você configurar; a cobrança é feita por esse fornecedor."
	};
	private readonly resolveOptions: () => SearchOptions;
	/** 就绪检查失败时的诊断出口；无头组合不传时保持静默。 */
	private readonly warn: ((message: string) => void) | undefined;
	/** 搜索引擎的会话 id 来源；无头组合或 HTTP 测试路径不传。 */
	private readonly sessionId: (() => string | undefined) | undefined;
	/** 观测采集出口；未启用观测时保持 undefined，搜索路径完全不触碰存储。 */
	private readonly onOutcome: OutcomeListener | undefined;
	/** 报告给观测层的记录类型。 */
	private readonly kind: ObservationKind;

	/**
	 * @param resolveOptions - 下一次操作的选项，在每个操作入口处快照一次。
	 * @param options - 诊断、观测与记录类型。
	 */
	constructor(resolveOptions: () => SearchOptions, options: DiySearchProviderOptions = {}) {
		this.resolveOptions = resolveOptions;
		this.warn = options.warn;
		this.onOutcome = options.onOutcome;
		this.sessionId = options.sessionId;
		this.kind = options.kind ?? "search";
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
		} catch (error) {
			/** 没有可解析的 key 时搜索必然失败，按不可用处理；留下诊断线索。 */
			this.warn?.(`web search readiness check failed for ${options.capability.id}: ${String(error)}`);
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
		const started = Date.now();
		const startedAt = new Date(started).toISOString();
		const timeoutMs = timeoutOf(options.settings.requestTimeoutMs);
		const sessionId = this.currentSessionId();
		/**
		 * 本地超时与调用方取消合并：两者都要立刻中断请求，但错误码不同。用
		 * `started` 时刻的时间戳判断哪个信号先触发，调用方取消优先。
		 */
		const localTimeout = AbortSignal.timeout(timeoutMs);
		const combined = signal === void 0 ? localTimeout : AbortSignal.any([signal, localTimeout]);
		try {
			const result = await this.runSearch(options, request, combined);
			this.report({
				kind: this.kind,
				target: options.capability.id,
				vendor: options.capability.vendor,
				protocol: options.capability.protocol,
				...(sessionId !== void 0 ? { sessionId } : {}),
				query: request.query,
				startedAt,
				durationMs: Date.now() - started,
				ok: true,
				result
			});
			return result;
		} catch (error) {
			const timedOut = localTimeout.aborted && signal?.aborted !== true;
			const failure = timedOut
				? new WebError(`web search timed out after ${timeoutMs}ms`, "WEB_PROVIDER_TIMEOUT", { cause: error })
				: error;
			const { code, message } = failureOf(failure);
			this.report({
				kind: this.kind,
				target: options.capability.id,
				vendor: options.capability.vendor,
				protocol: options.capability.protocol,
				...(sessionId !== void 0 ? { sessionId } : {}),
				query: request.query,
				startedAt,
				durationMs: Date.now() - started,
				ok: false,
				errorCode: code,
				errorMessage: message
			});
			throw failure;
		}
	}

	/** 读取当前会话 id；读取失败不能影响搜索本身。 */
	private currentSessionId(): string | undefined {
		try {
			return this.sessionId?.();
		} catch {
			return void 0;
		}
	}

	/**
	 * 报告一次结果。
	 *
	 * sink 理论上已自行隔离异常；这里再兜一层，保证任何采集实现都不会把一次
	 * 成功的搜索变成失败。
	 */
	private report(outcome: SearchOutcome): void {
		try {
			this.onOutcome?.(outcome);
		} catch {
			// 观测是附加项，失败不能影响搜索返回值。
		}
	}

	/** 按协议分派一次搜索；不含超时组合与观测。 */
	private async runSearch(options: SearchOptions, request: WebSearchRequest, signal?: AbortSignal): Promise<WebSearchResult> {
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