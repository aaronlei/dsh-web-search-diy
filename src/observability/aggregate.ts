/**
 * 观测聚合：P50/P95、按 target 汇总、时间桶与失败码。
 *
 * SQLite 没有内置 percentile，数据量又小，因此在应用层对 `duration_ms` 排序后
 * 线性插值，避免依赖窗口函数的版本差异。
 *
 * @module dsh-web-search-diy/observability/aggregate
 */
import type { BucketSummary, HostSummary, ObservabilitySummary, RangeQuery, SummaryTotals, TargetSummary, TopError } from "./types.ts";

/** `observations` 表的一行（应用层使用的子集）。 */
export interface ObservationRow {
	readonly id: string;
	readonly at: string;
	readonly kind: string;
	readonly session_id: string | null;
	readonly target: string;
	readonly vendor: string;
	readonly protocol: string;
	readonly query: string;
	readonly ok: number;
	readonly error_code: string | null;
	readonly error_message: string | null;
	readonly duration_ms: number;
	readonly source_count: number;
	readonly with_title: number;
	readonly with_snippet: number;
	readonly with_summary: number;
	readonly summary_chars: number;
	readonly answer_chars: number;
	readonly truncated: number;
	readonly answer?: string | null;
}

/**
 * 汇总真正读取的列：与 store 的 `SUMMARY_COLUMNS` 对应。汇总不需要答案、搜索词
 * 与会话，窄列读取避免数万条记录时把每条正文一起载入内存。
 */
export interface SummaryRow {
	readonly id: string;
	readonly at: string;
	readonly target: string;
	readonly ok: number;
	readonly error_code: string | null;
	readonly error_message: string | null;
	readonly duration_ms: number;
	readonly source_count: number;
	readonly with_title: number;
	readonly with_snippet: number;
	readonly with_summary: number;
	readonly answer_chars: number;
	readonly truncated: number;
}

/** 相对范围简写到毫秒（概览/记录使用）。 */
const RELATIVE_PRESETS: Readonly<Record<string, number>> = {
	"1h": 3_600_000,
	"24h": 24 * 3_600_000,
	"7d": 7 * 24 * 3_600_000,
	"30d": 30 * 24 * 3_600_000
};

/** 自然范围（历史导入使用）。 */
const NATURAL_PRESETS = new Set(["today", "week", "month", "quarter", "year", "all"]);

/** 本地时区的某天 00:00。 */
function startOfDay(date: Date): number {
	return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
}

/** 预设范围的起点；未知预设返回 undefined。 */
function presetStart(value: string, now: number): number | undefined {
	const date = new Date(now);
	switch (value) {
		case "today": return startOfDay(date);
		case "week": {
			/** 周一为一周起点（中文习惯）。 */
			const offset = date.getDay() === 0 ? 6 : date.getDay() - 1;
			return new Date(date.getFullYear(), date.getMonth(), date.getDate() - offset).getTime();
		}
		case "month": return new Date(date.getFullYear(), date.getMonth(), 1).getTime();
		case "quarter": return new Date(date.getFullYear(), Math.floor(date.getMonth() / 3) * 3, 1).getTime();
		case "year": return new Date(date.getFullYear(), 0, 1).getTime();
		case "all": return 0;
		default: return void 0;
	}
}

/** 趋势桶上限；超过时只返回有数据的桶，避免大跨度生成上千个空桶。 */
const MAX_BUCKETS = 400;

/**
 * 解析 `since` 与可选的 `until` 为时间范围。
 *
 * `since` 接受自然范围与 ISO-8601；`until` 只接受 ISO-8601（自定义结束日由界面
 * 转成结束日末尾的时间戳）。省略 `until` 表示到当前时间。
 *
 * @param value - 自然范围（`today` / `week` / `month` / `quarter` / `year` / `all`）、ISO-8601 时间或 undefined。
 * @param now - 当前时间（毫秒）。
 * @param until - 结束时间的 ISO-8601 表示；省略表示现在。
 * @returns 起止毫秒。
 * @throws {RangeError} 任一边界无法解析，或结束早于开始时。
 */
export function resolveRange(value: string | undefined, now: number, until?: string): { sinceMs: number; untilMs: number } {
	const sinceMs = resolveSince(value, now);
	const untilMs = resolveUntil(until, now);
	if (untilMs < sinceMs) throw new RangeError("结束时间必须晚于开始时间");
	return { sinceMs, untilMs };
}

/** 解析起始边界；省略时回落到近 24 小时。 */
function resolveSince(value: string | undefined, now: number): number {
	if (value === void 0 || value.length === 0) return now - RELATIVE_PRESETS["24h"];
	const relative = RELATIVE_PRESETS[value];
	if (relative !== void 0) return now - relative;
	if (NATURAL_PRESETS.has(value)) {
		const start = presetStart(value, now);
		if (start !== void 0) return start;
	}
	const parsed = Date.parse(value);
	if (!Number.isFinite(parsed)) throw new RangeError(`无法解析的时间范围: ${value}`);
	return parsed;
}

/** 解析结束边界；省略时回落到当前时间。 */
function resolveUntil(value: string | undefined, now: number): number {
	if (value === void 0 || value.length === 0) return now;
	const parsed = Date.parse(value);
	if (!Number.isFinite(parsed)) throw new RangeError(`无法解析的结束时间: ${value}`);
	return parsed;
}

/**
 * 已排序数组的 p 分位，线性插值后取整毫秒。
 *
 * @param sorted - 升序数值。
 * @param p - 0–1 的分位。
 * @returns 整数毫秒；空数组为 0。
 */
export function percentile(sorted: readonly number[], p: number): number {
	if (sorted.length === 0) return 0;
	const rank = (sorted.length - 1) * p;
	const low = Math.floor(rank);
	const high = Math.ceil(rank);
	if (low === high) return Math.round(sorted[low]);
	const value = sorted[low] + (sorted[high] - sorted[low]) * (rank - low);
	return Math.round(value);
}

/** 一组记录的汇总指标。 */
function totalsOf(rows: readonly SummaryRow[]): SummaryTotals {
	const count = rows.length;
	if (count === 0) {
		return {
			count: 0, successRate: 0, p50: 0, p95: 0, avgSources: 0, summaryCoverage: null, errorCount: 0,
			emptySourceRate: 0, emptyAnswerRate: 0, truncatedRate: 0, timeoutCount: 0, timeoutRate: 0
		};
	}
	let ok = 0;
	let sources = 0;
	let withSummary = 0;
	let errors = 0;
	let emptySource = 0;
	let emptyAnswer = 0;
	let truncated = 0;
	let timeouts = 0;
	const durations: number[] = [];
	for (const row of rows) {
		if (row.ok === 1) {
			ok += 1;
			if (row.source_count === 0) emptySource += 1;
			if (row.answer_chars === 0) emptyAnswer += 1;
		} else {
			errors += 1;
			if (row.error_code === "WEB_PROVIDER_TIMEOUT") timeouts += 1;
		}
		if (row.truncated === 1) truncated += 1;
		sources += row.source_count;
		withSummary += row.with_summary;
		durations.push(row.duration_ms);
	}
	durations.sort((a, b) => a - b);
	return {
		count,
		successRate: ok / count,
		p50: percentile(durations, 0.5),
		p95: percentile(durations, 0.95),
		avgSources: Math.round(sources / count * 10) / 10,
		summaryCoverage: sources === 0 ? null : withSummary / sources,
		errorCount: errors,
		emptySourceRate: ok === 0 ? 0 : emptySource / ok,
		emptyAnswerRate: ok === 0 ? 0 : emptyAnswer / ok,
		truncatedRate: truncated / count,
		timeoutCount: timeouts,
		timeoutRate: timeouts / count
	};
}

/** 按 target 汇总，次数降序、target 字母序打破平局。 */
function byTargetOf(rows: readonly SummaryRow[]): TargetSummary[] {
	const groups = new Map<string, SummaryRow[]>();
	for (const row of rows) {
		const group = groups.get(row.target);
		if (group === void 0) groups.set(row.target, [row]);
		else group.push(row);
	}
	return [...groups.entries()]
		.map(([target, group]) => ({ target, ...totalsOf(group) }))
		.sort((a, b) => b.count - a.count || a.target.localeCompare(b.target));
}

/** 时间桶步长：一天内按小时，7 天内按 6 小时，60 天内按天，更长按周。 */
function bucketStep(spanMs: number): number {
	const HOUR = 3_600_000;
	const DAY = 24 * HOUR;
	if (spanMs <= DAY) return HOUR;
	if (spanMs <= 7 * DAY) return 6 * HOUR;
	if (spanMs <= 60 * DAY) return DAY;
	return 7 * DAY;
}

/**
 * 生成时间桶；空桶保留为 null 比率，趋势图据此断线而不是画成 0。
 *
 * @param rows - 时间范围内的记录。
 * @param sinceMs - 范围起点。
 * @param untilMs - 范围终点。
 * @returns 按时间升序的桶。
 */
export function buildBuckets(rows: readonly SummaryRow[], sinceMs: number, untilMs: number): BucketSummary[] {
	const span = Math.max(1, untilMs - sinceMs);
	const step = bucketStep(span);
	/**
	 * 从范围起点开始分桶，而不是对齐 UTC epoch：`today` / `week` 的起点是本地
	 * 00:00，按 epoch 取整会把首个「天」桶挪到本地 08:00 等非自然边界。
	 */
	const start = sinceMs;
	const groups = new Map<number, { ok: number; errors: number; durations: number[] }>();
	for (const row of rows) {
		const at = Date.parse(row.at);
		if (!Number.isFinite(at) || at < start) continue;
		const key = start + Math.floor((at - start) / step) * step;
		const group = groups.get(key) ?? { ok: 0, errors: 0, durations: [] };
		if (row.ok === 1) group.ok += 1;
		else group.errors += 1;
		group.durations.push(row.duration_ms);
		groups.set(key, group);
	}
	if (groups.size === 0) return [];
	const bucketCount = Math.floor((untilMs - start) / step) + 1;
	const keys = bucketCount > MAX_BUCKETS ? [...groups.keys()].sort((a, b) => a - b) : [];
	if (keys.length === 0) {
		for (let key = start; key <= untilMs; key += step) keys.push(key);
	}
	return keys.map((key) => {
		const group = groups.get(key);
		const at = new Date(key).toISOString();
		if (group === void 0) return { at, count: 0, successRate: null, p95: null, errorCount: 0 };
		const durations = [...group.durations].sort((a, b) => a - b);
		return {
			at,
			count: group.durations.length,
			successRate: group.ok / group.durations.length,
			p95: percentile(durations, 0.95),
			errorCount: group.errors
		};
	});
}

/** 失败码计数与最近一条消息，次数降序取前 5。 */
function topErrorsOf(rows: readonly SummaryRow[]): TopError[] {
	const groups = new Map<string, { count: number; lastMessage: string; lastAt: number }>();
	for (const row of rows) {
		if (row.ok === 1) continue;
		const code = row.error_code ?? "WEB_PROVIDER_ERROR";
		const at = Date.parse(row.at);
		const group = groups.get(code);
		const message = row.error_message ?? "";
		if (group === void 0) groups.set(code, { count: 1, lastMessage: message, lastAt: Number.isFinite(at) ? at : 0 });
		else {
			group.count += 1;
			if (Number.isFinite(at) && at >= group.lastAt) {
				group.lastMessage = message;
				group.lastAt = at;
			}
		}
	}
	return [...groups.entries()]
		.map(([code, group]) => ({ code, count: group.count, lastMessage: group.lastMessage }))
		.sort((a, b) => b.count - a.count || a.code.localeCompare(b.code))
		.slice(0, 5);
}

/**
 * 把查询行汇总成 summary 响应。
 *
 * @param rows - 时间范围内的记录。
 * @param sinceMs - 范围起点。
 * @param untilMs - 范围终点。
 * @returns summary 响应体。
 */
export function summarize(rows: readonly ObservationRow[], sinceMs: number, untilMs: number, topHosts: readonly HostSummary[] = []): ObservabilitySummary {
	return {
		range: { since: new Date(sinceMs).toISOString(), until: new Date(untilMs).toISOString() },
		totals: totalsOf(rows),
		byTarget: byTargetOf(rows),
		byBucket: buildBuckets(rows, sinceMs, untilMs),
		topErrors: topErrorsOf(rows),
		topHosts
	};
}

/** 解析范围参数的失败在端点层转成 400；这里提供统一的查询条件片段。 */
export interface RangeFilter {
	readonly sql: string;
	readonly params: readonly unknown[];
}

/**
 * 构造 summary / records / export 共用的范围条件。
 *
 * @param query - 范围参数。
 * @param now - 当前时间（毫秒）。
 * @returns WHERE 片段与参数。
 * @throws {RangeError} `since` 无法解析时。
 */
export function rangeFilter(query: RangeQuery, now: number): RangeFilter & { sinceMs: number; untilMs: number } {
	const { sinceMs, untilMs } = resolveRange(query.since, now, query.until);
	const clauses: string[] = ["at >= ?"];
	const params: unknown[] = [new Date(sinceMs).toISOString()];
	/** 只有显式给了结束时间才加上界：默认「至今」不应排除时钟略晚于查询起点的记录。 */
	if (query.until !== void 0 && query.until.length > 0) {
		clauses.push("at <= ?");
		params.push(new Date(untilMs).toISOString());
	}
	if (query.includeTests === true) clauses.push("kind IN ('search', 'test', 'compare')");
	else clauses.push("kind = 'search'");
	if (query.target !== void 0 && query.target.length > 0) {
		clauses.push("target = ?");
		params.push(query.target);
	}
	return { sql: clauses.join(" AND "), params, sinceMs, untilMs };
}
