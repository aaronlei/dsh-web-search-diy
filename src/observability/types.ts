/**
 * 观测数据契约：记录、来源明细、聚合与查询参数。
 *
 * 记录只存可计算指标与脱敏后的来源标识，不存完整 URL、正文或答案全文。
 *
 * @module dsh-web-search-diy/observability/types
 */
import type { WebSearchResult } from "@deepseek-ai/dsh-web";

/** 记录类型：真实搜索、配置页测试连接；`compare` 为历史数据保留。 */
export type ObservationKind = "search" | "test" | "compare";

/**
 * 一条来源的入库事实：不含 URL，只保留 hash、host 与内容标记。
 */
export interface ObservationSourceFacts {
	readonly urlHash: string;
	readonly host: string;
	readonly hasTitle: boolean;
	readonly hasSnippet: boolean;
	readonly hasSummary: boolean;
	/** 该来源 summary 的字符数。 */
	readonly summaryChars: number;
	/** 来源 URL（截断后）；记录页据此打开原文。 */
	readonly url?: string;
	readonly title?: string;
	readonly snippet?: string;
	readonly summary?: string;
}

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
	/** 已归一化的来源事实；对比记录直接提供，避免二次 hash。 */
	readonly sources?: readonly ObservationSourceFacts[];
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
	/** 返回给调用方的答案/摘要文本；记录页直接阅读，截断到 4,000 字符。 */
	readonly answer?: string;
}

/** 一条来源明细：hash/host 用于统计，文本字段供记录页阅读。 */
export interface ObservationSource {
	readonly observationId: string;
	/** URL 的 SHA-256 前 16 位十六进制。 */
	readonly urlHash: string;
	readonly host: string;
	readonly hasTitle: boolean;
	readonly hasSnippet: boolean;
	readonly hasSummary: boolean;
	/** 来源 URL（截断到 2,000 字符）。 */
	readonly url?: string;
	readonly title?: string;
	readonly snippet?: string;
	readonly summary?: string;
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
	/** 成功记录里没有任何来源的比例；无成功记录时 0。 */
	readonly emptySourceRate: number;
	/** 成功记录里答案正文为空的比例；无成功记录时 0。 */
	readonly emptyAnswerRate: number;
	/** 被 seam/tool 层截断的记录比例。 */
	readonly truncatedRate: number;
	/** 超时失败数。 */
	readonly timeoutCount: number;
	/** 超时失败占全部记录的比例。 */
	readonly timeoutRate: number;
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
	/** 该桶的失败记录数。 */
	readonly errorCount: number;
}

/** 失败码计数与最近一条消息。 */
export interface TopError {
	readonly code: string;
	readonly count: number;
	readonly lastMessage: string;
}

/** 一个来源域名的出现次数。 */
export interface HostSummary {
	readonly host: string;
	readonly count: number;
}

/** 观测库的存储状态；`bytes` 含主库与 WAL/SHM 伴生文件。 */
export interface StorageStats {
	readonly bytes: number;
	readonly rows: number;
	readonly sources: number;
	/** 最早一条记录的 `at`；空库为 null。 */
	readonly oldest: string | null;
	/** 最新一条记录的 `at`；空库为 null。 */
	readonly newest: string | null;
}

/** GET /observability/summary 的响应。 */
export interface ObservabilitySummary {
	readonly range: { readonly since: string; readonly until: string };
	readonly totals: SummaryTotals;
	readonly byTarget: readonly TargetSummary[];
	readonly byBucket: readonly BucketSummary[];
	readonly topErrors: readonly TopError[];
	/** 来源域名 Top 10；跟随当前筛选范围。 */
	readonly topHosts: readonly HostSummary[];
}

/** summary / export 共用的范围参数。 */
export interface RangeQuery {
	/** 自然范围（`today` / `week` / `month` / `quarter` / `year` / `all`）或 ISO-8601 时间。 */
	readonly since?: string;
	/** 结束时间的 ISO-8601 表示；省略表示到当前时间。 */
	readonly until?: string;
	readonly target?: string;
	/** true 时把 test / compare 记录也计入；默认只算 search。 */
	readonly includeTests?: boolean;
}

/** GET /observability/records 的查询参数。 */
export interface RecordsQuery extends RangeQuery {
	readonly limit?: number;
	/** 页码，从 1 开始；超出范围时由存储夹紧到最后一页。 */
	readonly page?: number;
	readonly status?: "ok" | "fail";
	/** 失败码精确筛选；只在 status 为 fail 或全部时有意义。 */
	readonly errorCode?: string;
	/** 搜索词子串，忽略大小写。 */
	readonly query?: string;
}

/** 一页记录与总数。 */
export interface RecordsPage {
	readonly records: readonly ObservationRecordView[];
	/** 当前筛选条件下的记录总数。 */
	readonly total: number;
	/** 实际页码（已夹紧到有效范围）。 */
	readonly page: number;
	/** 每页条数（已收窄到上限）。 */
	readonly pageSize: number;
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
