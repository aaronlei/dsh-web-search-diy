/**
 * 观测页的线上契约：与 Host 的 `observability/types.ts` 对应，只镜像页面用到的字段。
 *
 * @module dsh-web-search-diy/client/obs/types
 */

/** 汇总指标；`summaryCoverage` 在没有任何来源时为 null。 */
export interface SummaryTotals {
	readonly count: number;
	readonly successRate: number;
	readonly p50: number;
	readonly p95: number;
	readonly avgSources: number;
	readonly summaryCoverage: number | null;
	readonly errorCount: number;
}

/** 一个 target 的汇总。 */
export interface TargetSummary extends SummaryTotals {
	readonly target: string;
}

/** 趋势桶；空桶比率为 null。 */
export interface BucketSummary {
	readonly at: string;
	readonly count: number;
	readonly successRate: number | null;
	readonly p95: number | null;
}

/** 失败码与最近一条消息。 */
export interface TopError {
	readonly code: string;
	readonly count: number;
	readonly lastMessage: string;
}

/** `GET /observability/summary` 的响应。 */
export interface SummaryResponse {
	readonly range: { readonly since: string; readonly until: string };
	readonly totals: SummaryTotals;
	readonly byTarget: readonly TargetSummary[];
	readonly byBucket: readonly BucketSummary[];
	readonly topErrors: readonly TopError[];
}

/** 一条来源明细；只含 hash 与 host。 */
export interface ObservationSource {
	readonly observationId: string;
	readonly urlHash: string;
	readonly host: string;
	readonly hasTitle: boolean;
	readonly hasSnippet: boolean;
	readonly hasSummary: boolean;
}

/** 一条观测记录。 */
export interface ObservationRecord {
	readonly v: 1;
	readonly id: string;
	readonly at: string;
	readonly kind: "search" | "test" | "compare";
	readonly sessionId?: string;
	readonly target: string;
	readonly vendor: string;
	readonly protocol: string;
	readonly query: string;
	readonly ok: boolean;
	readonly errorCode?: string;
	readonly errorMessage?: string;
	readonly durationMs: number;
	readonly sourceCount: number;
	readonly withTitle: number;
	readonly withSnippet: number;
	readonly withSummary: number;
	readonly summaryChars: number;
	readonly answerChars: number;
	readonly truncated: boolean;
}

/** 记录与来源明细。 */
export interface RecordView extends ObservationRecord {
	readonly sources: readonly ObservationSource[];
}

/** `GET /observability/records` 的响应。 */
export interface RecordsResponse {
	readonly records: readonly RecordView[];
	readonly nextBefore: string | null;
}

/** 时间范围键。 */
export type RangeKey = "24h" | "7d" | "30d" | "all";

/** 状态筛选。 */
export type StatusKey = "all" | "ok" | "fail";

/** 页面共享的筛选状态。 */
export interface Filters {
	readonly range: RangeKey;
	readonly target: string;
	readonly includeTests: boolean;
}
