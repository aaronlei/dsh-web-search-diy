/**
 * 观测端点客户端：summary、records、export 链接与清空。
 *
 * 所有函数只负责 HTTP 与参数拼装；错误以异常抛出，由页面渲染成横幅。
 *
 * @module dsh-web-search-diy/client/obs/api
 */
import type { Filters, RecordsResponse, StatusKey, StorageStats, SummaryResponse, TimeRange } from "./types.ts";
import { getJson, postJson, readJsonResponse } from "../http.ts";
import { sinceOf, untilOf } from "./range.ts";

/** Host 观测端点前缀。 */
const OBS_BASE = "/api/web-search-diy/observability";

/** 把筛选状态转成查询串。 */
function queryOf(filters: Filters, extra: Record<string, string | undefined> = {}): string {
	const params = new URLSearchParams();
	params.set("since", sinceOf(filters.range));
	const until = untilOf(filters.range);
	if (until !== void 0) params.set("until", until);
	if (filters.target.length > 0) params.set("target", filters.target);
	if (filters.includeTests) params.set("includeTests", "true");
	if (filters.errorCode.length > 0) params.set("errorCode", filters.errorCode);
	for (const [key, value] of Object.entries(extra)) {
		if (value !== void 0 && value.length > 0) params.set(key, value);
	}
	return params.toString();
}

/** 拉取汇总。 */
export async function fetchSummary(filters: Filters, signal?: AbortSignal): Promise<SummaryResponse> {
	return getJson<SummaryResponse>(`${OBS_BASE}/summary?${queryOf(filters)}`, signal);
}

/** 拉取观测库的存储状态。 */
export async function fetchStorage(signal?: AbortSignal): Promise<StorageStats> {
	return getJson<StorageStats>(`${OBS_BASE}/storage`, signal);
}

/** 拉取一页记录；页码从 1 开始。 */
export async function fetchRecords(
	filters: Filters,
	options: { readonly limit?: number; readonly page?: number; readonly status?: StatusKey; readonly query?: string } = {},
	signal?: AbortSignal
): Promise<RecordsResponse> {
	const extra: Record<string, string | undefined> = {
		limit: String(options.limit ?? 50),
		page: options.page === void 0 ? void 0 : String(options.page),
		status: options.status === void 0 || options.status === "all" ? void 0 : options.status,
		query: options.query
	};
	return getJson<RecordsResponse>(`${OBS_BASE}/records?${queryOf(filters, extra)}`, signal);
}

/** 导出链接：直接交给浏览器下载当前筛选范围。 */
export function exportUrl(format: "jsonl" | "csv", filters: Filters): string {
	return `${OBS_BASE}/export?${queryOf(filters, { format })}`;
}

/** 导入历史会话里的 web_search 记录。 */
export interface ImportResult {
	readonly sessions: number;
	readonly calls: number;
	readonly imported: number;
	readonly skipped: number;
	readonly failed: number;
	readonly filtered: number;
	readonly identified: number;
	readonly updated: number;
}

/** 后台导入的进度快照。 */
export interface ImportStatus {
	readonly state: "idle" | "running" | "done" | "failed";
	readonly done: number;
	readonly total: number;
	readonly result?: ImportResult;
	readonly error?: string;
}

/** 启动一次后台导入；用 {@link fetchImportStatus} 轮询进度。 */
export async function startImport(range: TimeRange): Promise<void> {
	const until = untilOf(range);
	await postJson<{ accepted?: boolean }>(`${OBS_BASE}/import`, { since: sinceOf(range), ...(until !== void 0 ? { until } : {}), async: true });
}

/** 读取后台导入的进度与结果。 */
export async function fetchImportStatus(): Promise<ImportStatus> {
	return getJson<ImportStatus>(`${OBS_BASE}/import/status`);
}

/** 清空全部观测记录；返回删除条数。 */
export async function clearObservations(): Promise<number> {
	const response = await fetch(`${OBS_BASE}/records`, {
		method: "DELETE",
		headers: { "content-type": "application/json" },
		body: JSON.stringify({ confirm: "DELETE" })
	});
	const body = await readJsonResponse<{ deleted?: number }>(response);
	return body.deleted ?? 0;
}
