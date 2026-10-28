/**
 * HTTP 传输：请求、压缩解码、reasoning 降级重试、取消语义。
 *
 * 这一层不关心任何协议字段，只负责“把 JSON 发出去、把 JSON 收回来、把失败映射成
 * WebError”。协议文件负责请求体与响应映射。
 *
 * @module dsh-web-search-diy/transport
 */
import { WebError } from "@deepseek-ai/dsh-web";
import { gunzipSync, inflateSync } from "node:zlib";

/** 每个请求都带上的归属头；`test/catalog.test.mjs` 断言它与 package.json 版本一致。 */
export const USER_AGENT = "dsh-web-search-diy/2.0.4";

/** gzip 成员魔数（RFC 1952）与 zlib 的默认 CMF 字节（RFC 1950）。 */
const GZIP_MAGIC_FIRST = 0x1f;
const GZIP_MAGIC_SECOND = 0x8b;
const ZLIB_CMF = 0x78;

/**
 * 解压缩炸弹的硬上限。合法搜索载荷峰值只有几百 KB（观测到最大约 25 KB 压缩体对应
 * 20 条结果），因此这两个上限只会对恶意或损坏的响应生效：线上上限阻止超大响应体
 * 下载完成，解码上限阻止极小的压缩体在 `zlib` 内无限膨胀。
 */
const MAX_RESPONSE_BYTES = 8 * 1024 * 1024;
const MAX_DECODED_BYTES = 16 * 1024 * 1024;

/** True for a zlib-wrapped deflate stream: default CMF plus the RFC 1950 checksum. */
function isZlibStream(raw: Uint8Array): boolean {
	return raw[0] === ZLIB_CMF && ((raw[0] << 8) | (raw[1] ?? 0)) % 31 === 0;
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
async function readBodyCapped(response: Response, maxBytes: number): Promise<Buffer> {
	const reader = response.body?.getReader();
	if (reader === void 0) return Buffer.alloc(0);
	const chunks: Buffer[] = [];
	let total = 0;
	for (;;) {
		const { done, value } = await reader.read();
		if (done === true) break;
		total += value.byteLength;
		if (total > maxBytes) {
			let cancelError: unknown;
			try {
				await reader.cancel(); // stop pulling bomb bytes off the wire
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
function inflateCapped(raw: Buffer, maxBytes: number): Buffer {
	try {
		return raw[0] === GZIP_MAGIC_FIRST && raw[1] === GZIP_MAGIC_SECOND ? gunzipSync(raw, { maxOutputLength: maxBytes }) : inflateSync(raw, { maxOutputLength: maxBytes });
	} catch (error) {
		if ((error as { code?: string }).code === "ERR_BUFFER_TOO_LARGE") throw new Error(`decoded body exceeds ${maxBytes} bytes`, { cause: error });
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
export async function readJsonResponse(response: Response): Promise<unknown> {
	const raw = await readBodyCapped(response, MAX_RESPONSE_BYTES);
	const isCompressed = (raw[0] === GZIP_MAGIC_FIRST && raw[1] === GZIP_MAGIC_SECOND) || isZlibStream(raw);
	const json = isCompressed ? inflateCapped(raw, MAX_DECODED_BYTES) : raw;
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
export function rejectsReasoningKnob(error: unknown): boolean {
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
export function dropReasoningKnob(body: Record<string, unknown>): Record<string, unknown> | undefined {
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
	return void 0;
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
export async function postJson(endpoint: string, apiKey: string, body: Record<string, unknown>, signal?: AbortSignal, extraHeaders: Record<string, string | undefined> = {}): Promise<unknown> {
	let response: Response;
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
			const parsed = await readJsonResponse(response) as { error?: string | { message?: string }; message?: string };
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
export async function postWithReasoningFallback(endpoint: string, apiKey: string, body: Record<string, unknown>, signal?: AbortSignal, extraHeaders: Record<string, string | undefined> = {}, onSend?: (body: Record<string, unknown>) => void): Promise<unknown> {
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
export function abortable<T>(operation: Promise<T>, signal?: AbortSignal): Promise<T> {
	if (signal === void 0) return operation;
	if (signal.aborted) return Promise.reject(searchAborted(signal));
	return new Promise<T>((resolve, reject) => {
		const onAbort = (): void => {
			reject(searchAborted(signal));
		};
		signal.addEventListener("abort", onAbort, { once: true });
		operation.then((value) => {
			signal.removeEventListener("abort", onAbort);
			resolve(value);
		}, (error: unknown) => {
			signal.removeEventListener("abort", onAbort);
			reject(new Error(String(error).replace(/^Error: /u, ""), { cause: error }));
		});
	});
}

/** 调用方已经中断时抛出 provider 稳定的取消错误。 */
export function throwIfSearchAborted(signal?: AbortSignal): void {
	if (signal?.aborted === true) throw searchAborted(signal);
}

/** 构造 provider 稳定的取消错误，同时保留调用方的 reason。 */
export function searchAborted(signal?: AbortSignal, fallback?: unknown): WebError {
	return new WebError("web search aborted", "WEB_ABORTED", { cause: signal?.aborted === true ? signal.reason : fallback });
}

/** True for a fetch/`AbortSignal` abort, surfaced as `WEB_ABORTED`. */
export function isAbortError(error: unknown): boolean {
	return error instanceof DOMException && error.name === "AbortError";
}