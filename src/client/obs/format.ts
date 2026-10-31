/**
 * 观测页的数字与日期格式。
 *
 * 不使用硬编码语言：数字跟随浏览器区域设置，日期用固定字段（月-日 时:分:秒），
 * 避免在图表与表格里出现未翻译的英文单词。
 *
 * @module dsh-web-search-diy/client/obs/format
 */

/** 0–1 的比例转百分比；null 显示破折号。 */
export function percentOf(ratio: number | null): string {
	if (ratio === null || !Number.isFinite(ratio)) return "—";
	return `${Math.round(ratio * 100)}%`;
}

/** 毫秒显示：一公里以内保留整数毫秒，超过用一位小数秒。 */
export function durationOf(ms: number): string {
	if (!Number.isFinite(ms) || ms < 0) return "—";
	if (ms < 1000) return `${Math.round(ms)}ms`;
	return `${(ms / 1000).toFixed(1)}s`;
}

/** 计数与平均值的紧凑显示。 */
export function numberOf(value: number, fractionDigits = 0): string {
	if (!Number.isFinite(value)) return "—";
	return new Intl.NumberFormat(undefined, { maximumFractionDigits: fractionDigits, minimumFractionDigits: fractionDigits }).format(value);
}

/** 紧凑日期：`10-31 20:41:13`。 */
export function timeOf(iso: string): string {
	const date = new Date(iso);
	if (Number.isNaN(date.getTime())) return iso;
	const pad = (value: number): string => String(value).padStart(2, "0");
	return `${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}

/** 搜索词的表格显示：折叠空白并按字符截断。 */
export function queryOf(query: string, max = 48): string {
	const collapsed = query.replace(/\s+/gu, " ").trim();
	const characters = [...collapsed];
	return characters.length <= max ? collapsed : `${characters.slice(0, max).join("")}…`;
}
