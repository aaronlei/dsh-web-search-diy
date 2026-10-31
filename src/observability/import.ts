/**
 * 历史会话导入：从 `$DSH_HOME/sessions` 的压缩会话日志中提取 web_search 调用，
 * 转成观测记录，让插件开始保存观测之前的搜索也能在观测页看到。
 *
 * 适用于所有从旧版本升级的用户：旧版本从不写观测库，但会话日志里保留了完整的
 * 工具调用与结果。当前版本在所有协议发送请求时都会留下出站请求事件
 * （`web/deepseek-search-llm-request`），事件携带 target id，据此直接还原 target；
 * 旧事件的 target id 缺失时回退到端点匹配。更早期的会话（事件机制上线前）只能
 * 标为 `historical`。导入按 `history:<sessionId>:<seq>` 生成确定性 id，重复运行只补新增。
 *
 * @module dsh-web-search-diy/observability/import
 */
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { ALL_TARGETS, capabilityOf, joinEndpoint } from "../catalog.ts";
import { homedir } from "node:os";
import { join } from "node:path";
import { zstdDecompressSync } from "node:zlib";
import type { WebSearchSource } from "@deepseek-ai/dsh-web";
import type { ObservationStore } from "./store.ts";
import type { SearchOutcome } from "./types.ts";

/** 无法识别 target 时使用的分组。 */
export const HISTORICAL_TARGET = "historical";

/** 识别出的 target 三元组。 */
interface ResolvedTarget {
	readonly target: string;
	readonly vendor: string;
	readonly protocol: string;
}

/** 去掉查询串、片段与尾斜杠，用于端点比较。 */
function normalizeEndpoint(url: string): string {
	return url.replace(/[?#].*$/u, "").replace(/\/+$/u, "");
}

/** 旧事件的回退索引：catalog 默认端点 → target；用户改过 baseURL 时无法命中。 */
function targetIndexOfCatalog(): Map<string, ResolvedTarget> {
	const index = new Map<string, ResolvedTarget>();
	for (const capability of Object.values(ALL_TARGETS)) {
		if (capability.support === "unsupported") continue;
		index.set(normalizeEndpoint(joinEndpoint(capability.defaults.baseURL, capability.search.path)), {
			target: capability.id,
			vendor: capability.vendor,
			protocol: capability.protocol
		});
	}
	return index;
}

/** 在 tool/call 与 tool/result 之间找本插件的出站请求事件。 */
function requestOf(events: readonly Record<string, unknown>[], call: Record<string, unknown>, result: Record<string, unknown> | undefined): Record<string, unknown> | undefined {
	const callSeq = typeof call.seq === "number" ? call.seq : -1;
	const resultSeq = typeof result?.seq === "number" ? result.seq : Number.POSITIVE_INFINITY;
	for (const event of events) {
		if (event.type !== "web/deepseek-search-llm-request") continue;
		const seq = typeof event.seq === "number" ? event.seq : -1;
		if (seq <= callSeq || seq >= resultSeq) continue;
		const data = event.data;
		if (typeof data !== "object" || data === null) continue;
		const record = data as Record<string, unknown>;
		/** 只有带识别线索的事件才算数：旧事件只有 endpoint，新事件两者都有。 */
		const hasEndpoint = typeof record.endpoint === "string" && record.endpoint.length > 0;
		const hasTarget = typeof record.target === "string" && record.target.length > 0;
		if (hasEndpoint || hasTarget) return record;
	}
	return void 0;
}

/**
 * 从出站请求事件还原 target。
 *
 * 优先使用事件携带的 target id：用户改过 baseURL、或同一端点被多个 target 共享时
 * 只有它可靠。旧事件没有该字段，回退到 catalog 默认端点匹配。
 */
function resolvedTargetOf(request: Record<string, unknown> | undefined, endpointIndex: Map<string, ResolvedTarget>): ResolvedTarget | undefined {
	const declared = typeof request?.target === "string" ? request.target : void 0;
	if (declared !== void 0) {
		const capability = capabilityOf(declared);
		if (capability !== void 0) return { target: capability.id, vendor: capability.vendor, protocol: capability.protocol };
	}
	const endpoint = typeof request?.endpoint === "string" ? request.endpoint : void 0;
	return endpoint !== void 0 && endpoint.length > 0 ? endpointIndex.get(normalizeEndpoint(endpoint)) : void 0;
}

/** 导入统计。 */
export interface ImportResult {
	/** 扫到的会话文件数。 */
	readonly sessions: number;
	/** 扫到的 web_search 调用数。 */
	readonly calls: number;
	/** 新写入的记录数。 */
	readonly imported: number;
	/** 已存在而跳过的记录数。 */
	readonly skipped: number;
	/** 解压或解析失败的会话文件数。 */
	readonly failed: number;
	/** 落在导入范围之外而跳过的调用数。 */
	readonly filtered: number;
	/** 其中能从出站请求还原 target 的调用数。 */
	readonly identified: number;
	/** 已存在但补全了 target 的记录数。 */
	readonly updated: number;
}

/** 会话根目录；`DSH_HOME` 为空串时回落到 `~/.dsh`。 */
function sessionsRoot(): string {
	const home = process.env.DSH_HOME?.trim();
	const root = home !== void 0 && home.length > 0 ? home : join(homedir(), ".dsh");
	return join(root, "sessions");
}

/** 一个待扫描的会话文件。 */
interface SessionFile {
	readonly sessionId: string;
	readonly path: string;
}

/** 列出所有会话日志文件；目录结构为 `<sessions>/<project>/<session-*>/session*.jsonl.zstd`。 */
function listSessionFiles(root: string): SessionFile[] {
	if (!existsSync(root)) return [];
	const files: SessionFile[] = [];
	for (const project of readdirSync(root)) {
		const projectDir = join(root, project);
		let sessions: string[];
		try {
			sessions = readdirSync(projectDir);
		} catch {
			continue;
		}
		for (const session of sessions) {
			const sessionDir = join(projectDir, session);
			let entries: string[];
			try {
				entries = readdirSync(sessionDir);
			} catch {
				continue;
			}
			const sessionId = session.startsWith("session-") ? session.slice("session-".length) : session;
			for (const entry of entries) {
				if (!entry.endsWith(".jsonl.zstd") || !entry.includes("session")) continue;
				files.push({ sessionId, path: join(sessionDir, entry) });
			}
		}
	}
	return files;
}

/** 一行一个 JSON 事件；损坏行跳过。 */
function parseEvents(text: string): Record<string, unknown>[] {
	const events: Record<string, unknown>[] = [];
	for (const line of text.split("\n")) {
		if (line.trim().length === 0) continue;
		try {
			const value: unknown = JSON.parse(line);
			if (typeof value === "object" && value !== null) events.push(value as Record<string, unknown>);
		} catch {
			// 单行损坏不影响同文件的其他事件。
		}
	}
	return events;
}

/** 解析工具调用的 arguments（JSON 字符串）。 */
function argumentsOf(call: Record<string, unknown>): { queries: string[] } {
	try {
		const parsed = JSON.parse(String(call.arguments ?? "{}")) as { queries?: unknown; query?: unknown };
		const queries = Array.isArray(parsed.queries)
			? parsed.queries.filter((value): value is string => typeof value === "string" && value.trim().length > 0)
			: typeof parsed.query === "string" && parsed.query.trim().length > 0 ? [parsed.query] : [];
		return { queries };
	} catch {
		return { queries: [] };
	}
}

/** 结果消息的文本。 */
function resultText(result: Record<string, unknown> | undefined): string {
	const payload = result?.data as Record<string, unknown> | undefined;
	const message = payload?.message as { content?: unknown } | undefined;
	const content = Array.isArray(message?.content) ? message.content : [];
	return content
		.filter((block): block is { type?: string; text?: string } => typeof block === "object" && block !== null)
		.filter((block) => block.type === "text" && typeof block.text === "string")
		.map((block) => block.text ?? "")
		.join("\n");
}

/** 结果 meta 里的来源。 */
function resultSources(result: Record<string, unknown> | undefined): WebSearchSource[] {
	const payload = result?.data as Record<string, unknown> | undefined;
	const meta = payload?.meta as { sources?: unknown } | undefined;
	if (!Array.isArray(meta?.sources)) return [];
	return meta.sources.filter((value): value is WebSearchSource => {
		if (typeof value !== "object" || value === null) return false;
		const source = value as Record<string, unknown>;
		return typeof source.url === "string" && source.url.length > 0;
	});
}

/** 把一个历史工具调用映射成观测记录。 */
function outcomeOf(sessionId: string, call: Record<string, unknown>, result: Record<string, unknown> | undefined, target: ResolvedTarget | undefined): SearchOutcome {
	const { queries } = argumentsOf(call.data as Record<string, unknown> ?? {});
	const query = queries.join(" | ").trim() || "(unknown query)";
	const payload = result?.data as Record<string, unknown> | undefined;
	const meta = payload?.meta as { answer?: unknown; truncated?: unknown } | undefined;
	const text = typeof meta?.answer === "string" && meta.answer.length > 0 ? meta.answer : resultText(result);
	const message = payload?.message as { isError?: unknown } | undefined;
	const failed = result === void 0 || message?.isError === true;
	const callTime = typeof call.time === "number" ? call.time : Date.now();
	const resultTime = typeof result?.time === "number" ? result.time : callTime;
	return {
		kind: "search",
		target: target?.target ?? HISTORICAL_TARGET,
		vendor: target?.vendor ?? HISTORICAL_TARGET,
		protocol: target?.protocol ?? "search",
		sessionId,
		query,
		startedAt: new Date(callTime).toISOString(),
		durationMs: Math.max(0, resultTime - callTime),
		ok: !failed,
		...(failed ? { errorCode: "WEB_PROVIDER_ERROR", errorMessage: text.length > 0 ? text.slice(0, 300) : "历史工具结果缺失" } : {}),
		/** 失败调用把文本放进 errorMessage，不再重复作为答案正文。 */
		result: { content: failed ? "" : text, sources: resultSources(result), truncated: meta?.truncated === true }
	};
}

/** 导入选项。 */
export interface ImportOptions {
	/** 会话目录；默认 `$DSH_HOME/sessions`。 */
	readonly root?: string;
	/** 只导入该时间点之后的调用；省略表示不设下界。 */
	readonly sinceMs?: number;
	/** 只导入该时间点之前的调用；省略表示不设上界。 */
	readonly untilMs?: number;
}

/**
 * 导入历史 web_search 调用。
 *
 * @param store - 观测存储。
 * @param options - 目录与时间范围。
 * @returns 导入统计。
 */
export async function importHistorical(store: ObservationStore, options: ImportOptions = {}): Promise<ImportResult> {
	const files = listSessionFiles(options.root ?? sessionsRoot());
	const endpointIndex = targetIndexOfCatalog();
	const result = { sessions: files.length, calls: 0, imported: 0, skipped: 0, failed: 0, filtered: 0, identified: 0, updated: 0 };
	for (const file of files) {
		let events: Record<string, unknown>[];
		try {
			events = parseEvents(zstdDecompressSync(readFileSync(file.path)).toString("utf8"));
		} catch {
			result.failed += 1;
			continue;
		}
		const calls = events.filter((event) => event.type === "tool/call" && (event.data as { name?: unknown } | undefined)?.name === "web_search");
		if (calls.length === 0) continue;
		const results = new Map<string, Record<string, unknown>>();
		for (const event of events) {
			if (event.type !== "tool/result") continue;
			const message = (event.data as { message?: { toolCallId?: unknown } } | undefined)?.message;
			const callId = typeof message?.toolCallId === "string" ? message.toolCallId : void 0;
			if (callId !== void 0) results.set(callId, event);
		}
		for (const call of calls) {
			const callTime = typeof call.time === "number" ? call.time : 0;
			if (options.sinceMs !== void 0 && callTime < options.sinceMs) {
				result.filtered += 1;
				continue;
			}
			if (options.untilMs !== void 0 && callTime > options.untilMs) {
				result.filtered += 1;
				continue;
			}
			result.calls += 1;
			const data = call.data as Record<string, unknown> | undefined;
			const callId = typeof data?.callId === "string" ? data.callId : void 0;
			const targetResult = callId !== void 0 ? results.get(callId) : void 0;
			const request = requestOf(events, call, targetResult);
			const target = resolvedTargetOf(request, endpointIndex);
			if (target !== void 0) result.identified += 1;
			const outcome = outcomeOf(file.sessionId, call, targetResult, target);
			const id = `history:${file.sessionId}:${String(call.seq ?? result.calls)}`;
			const status = store.record(outcome, id);
			if (status === "inserted") result.imported += 1;
			else if (status === "updated") result.updated += 1;
			else result.skipped += 1;
		}
		/** 每处理完一个会话让出事件循环，避免导入期间界面完全无响应。 */
		await new Promise((resolve) => setImmediate(resolve));
	}
	return result;
}
