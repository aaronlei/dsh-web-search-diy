/**
 * 观测数据契约：记录、来源明细、聚合与查询参数。
 *
 * 记录只存可计算指标与脱敏后的来源标识，不存完整 URL、正文或答案全文。
 *
 * @module dsh-web-search-diy/observability/types
 */
import type { WebSearchResult } from "@deepseek-ai/dsh-web";

/** 记录类型：真实搜索、配置页测试连接、多 target 对比（2.1.0 使用）。 */
export type ObservationKind = "search" | "test" | "compare";

/**
 * 一次搜索的原始结果，由 provider 报告给观测 sink。
 *
 * provider 只负责事实；记录 id、截断、URL 脱敏与表结构属于存储层。
 */
export interface SearchOutcome {
	readonly kind: ObservationKind;
	readonly target: string;
	readonly vendor: string;
	readonly protocol: string;
	/** 发起搜索的会话 id；无会话或取不到时省略。 */
	readonly sessionId?: string;
	readonly query: string;
	/** 搜索开始时间，ISO-8601。 */
	readonly startedAt: string;
	readonly durationMs: number;
	readonly ok: boolean;
	readonly errorCode?: string;
	readonly errorMessage?: string;
	/** 成功时的归一化结果；失败时省略。 */
	readonly result?: WebSearchResult;
}

/** 一条观测记录；字段与 `observations` 表一一对应。 */
export interface ObservationRecord {
	readonly v: 1;
	readonly id: string;
	/** 搜索开始时间，ISO-8601。 */
	readonly at: string;
	readonly kind: ObservationKind;
	readonly sessionId?: string;
	readonly target: string;
	readonly vendor: string;
	readonly protocol: string;
	/** 搜索词，截断到 200 字符。 */
	readonly query: string;
	readonly ok: boolean;
	readonly errorCode?: string;
	/** 失败消息，截断到 300 字符。 */
	readonly errorMessage?: string;
	readonly durationMs: number;
	readonly sourceCount: number;
	readonly withTitle: number;
	readonly withSnippet: number;
	readonly withSummary: number;
	/** 所有来源 summary 字符数之和。 */
	readonly summaryChars: number;
	/** 返回答案 content 的字符数；无答案为 0。 */
	readonly answerChars: number;
	/** 结果是否被 seam/tool 层截断。 */
	readonly truncated: boolean;
}

/** 一条来源明细；只保留 hash 与 host，不存完整 URL。 */
export interface ObservationSource {
	readonly observationId: string;
	/** URL 的 SHA-256 前 16 位十六进制。 */
	readonly urlHash: string;
	readonly host: string;
	readonly hasTitle: boolean;
	readonly hasSnippet: boolean;
	readonly hasSummary: boolean;
}

/** 记录及其来源明细，供记录页展开与导出使用。 */
export interface ObservationRecordView extends ObservationRecord {
	readonly sources: readonly ObservationSource[];
}

/** 汇总指标；`summaryCoverage` 在没有任何来源时为 null。 */
export interface SummaryTotals {
	readonly count: number;
	/** 0–1 的成功比例。 */
	readonly successRate: number;
	readonly p50: number;
	readonly p95: number;
	/** 平均来源数，保留 1 位小数。 */
	readonly avgSources: number;
	/** 0–1 的摘要覆盖率；无来源时 null。 */
	readonly summaryCoverage: number | null;
	readonly errorCount: number;
}

/** 一个 target 的汇总。 */
export interface TargetSummary extends SummaryTotals {
	readonly target: string;
}

/** 时间桶；空桶的比率为 null，便于趋势图断线而不是画成 0。 */
export interface BucketSummary {
	readonly at: string;
	readonly count: number;
	readonly successRate: number | null;
	readonly p95: number | null;
}

/** 失败码计数与最近一条消息。 */
export interface TopError {
	readonly code: string;
	readonly count: number;
	readonly lastMessage: string;
}

/** GET /observability/summary 的响应。 */
export interface ObservabilitySummary {
	readonly range: { readonly since: string; readonly until: string };
	readonly totals: SummaryTotals;
	readonly byTarget: readonly TargetSummary[];
	readonly byBucket: readonly BucketSummary[];
	readonly topErrors: readonly TopError[];
}

/** summary / export 共用的范围参数。 */
export interface RangeQuery {
	/** 相对范围（`24h` / `7d` / `30d` / `all`）或 ISO-8601 时间。 */
	readonly since?: string;
	readonly target?: string;
	/** true 时把 test / compare 记录也计入；默认只算 search。 */
	readonly includeTests?: boolean;
}

/** GET /observability/records 的查询参数。 */
export interface RecordsQuery extends RangeQuery {
	readonly limit?: number;
	/** 返回严格早于该时间的记录，用于倒序分页。 */
	readonly before?: string;
	readonly status?: "ok" | "fail";
	/** 搜索词子串，忽略大小写。 */
	readonly query?: string;
}

/** 一对分页游标与记录。 */
export interface RecordsPage {
	readonly records: readonly ObservationRecordView[];
	/** 还有更早记录时给出下一页的 `before`；否则 null。 */
	readonly nextBefore: string | null;
}

/** 导出格式。 */
export type ExportFormat = "jsonl" | "csv";

/** 一次导出请求。 */
export interface ExportQuery extends RangeQuery {
	readonly format: ExportFormat;
}

/** `node:sqlite` 的 `DatabaseSync` 中本模块用到的部分；便于测试注入替身。 */
export interface DatabaseLike {
	exec(sql: string): void;
	prepare(sql: string): StatementLike;
	close(): void;
}

/** `DatabaseSync` 语句的最小形状。 */
export interface StatementLike {
	all(...params: readonly unknown[]): unknown[];
	get(...params: readonly unknown[]): unknown;
	run(...params: readonly unknown[]): { changes: number | bigint; lastInsertRowid: number | bigint };
}
