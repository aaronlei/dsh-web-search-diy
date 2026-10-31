/**
 * 观测导出：JSONL 与 CSV 序列化。
 *
 * JSONL 每行一条记录并带来源明细，便于 `jq` 处理；CSV 保持扁平列，
 * 来源只导出 host 列表，完整明细仍在 JSONL 中。
 *
 * @module dsh-web-search-diy/observability/export
 */
import type { ExportFormat, ObservationRecordView } from "./types.ts";

/** CSV 列顺序；与导出的表头一一对应。 */
const CSV_COLUMNS = [
	"id", "at", "kind", "session_id", "target", "vendor", "protocol", "query", "ok",
	"error_code", "error_message", "duration_ms", "source_count", "with_title",
	"with_snippet", "with_summary", "summary_chars", "answer_chars", "truncated", "source_hosts",
	"answer", "source_titles"
] as const;

/** 一个单元格的 CSV 转义：含分隔符、引号或换行时加引号并双写内部引号。 */
function csvCell(value: unknown): string {
	const text = value === null || value === void 0 ? "" : String(value);
	return /[",\r\n]/u.test(text) ? `"${text.replace(/"/gu, '""')}"` : text;
}

/** 一条记录按 `CSV_COLUMNS` 投影成单元格数组。 */
function csvRow(view: ObservationRecordView): string[] {
	return [
		view.id, view.at, view.kind, view.sessionId ?? "", view.target, view.vendor, view.protocol,
		view.query, view.ok ? "true" : "false", view.errorCode ?? "", view.errorMessage ?? "",
		String(view.durationMs), String(view.sourceCount), String(view.withTitle), String(view.withSnippet),
		String(view.withSummary), String(view.summaryChars), String(view.answerChars),
		view.truncated ? "true" : "false", view.sources.map((source) => source.host).join(";"),
		view.answer ?? "", view.sources.map((source) => source.title ?? source.host).join(";")
	];
}

/**
 * 序列化为 JSONL：每行一条带 `sources` 的记录。
 *
 * @param views - 记录与来源明细。
 * @returns 以换行结尾的 JSONL 文本。
 */
export function toJsonl(views: readonly ObservationRecordView[]): string {
	return views.map((view) => `${JSON.stringify(view)}\n`).join("");
}

/**
 * 序列化为 CSV。
 *
 * @param views - 记录与来源明细。
 * @returns 带表头的 CSV 文本（CRLF 行尾，兼容表格软件）。
 */
export function toCsv(views: readonly ObservationRecordView[]): string {
	const lines = [CSV_COLUMNS.join(",")];
	for (const view of views) lines.push(csvRow(view).map(csvCell).join(","));
	return `${lines.join("\r\n")}\r\n`;
}

/** 按格式序列化。 */
export function serialize(views: readonly ObservationRecordView[], format: ExportFormat): string {
	return format === "csv" ? toCsv(views) : toJsonl(views);
}

/** 导出的 MIME 类型。 */
export function contentTypeOf(format: ExportFormat): string {
	return format === "csv" ? "text/csv; charset=utf-8" : "application/x-ndjson; charset=utf-8";
}

/**
 * 导出文件名，带 UTC 日期。
 *
 * @param format - 导出格式。
 * @param now - 当前时间（毫秒）。
 * @returns 形如 `web-search-diy-observations-2026-10-31.jsonl`。
 */
export function exportFileName(format: ExportFormat, now: number = Date.now()): string {
	return `web-search-diy-observations-${new Date(now).toISOString().slice(0, 10)}.${format}`;
}
