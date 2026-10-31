/**
 * 观测页的时间范围模型：预设与自定义起止日。
 *
 * 查询与历史导入共用同一套范围和同一个选择器，但各自持有独立的 state；自定义范围
 * 可选结束日，省略结束日表示到当前时间。
 *
 * @module dsh-web-search-diy/client/obs/range
 */
import type { RangePreset, TimeRange } from "./types.ts";

/** 查询与导入共用的预设顺序。 */
export const RANGE_PRESETS: readonly RangePreset[] = ["24h", "7d", "30d", "all"];

/** 默认范围：近 24 小时。 */
export const DEFAULT_RANGE: TimeRange = { preset: "24h" };

/** 把范围转成后端 `since` 参数：预设名或 ISO 时间戳。 */
export function sinceOf(range: TimeRange): string {
	return range.preset === "custom" ? range.since : range.preset;
}

/** 把范围转成后端 `until` 参数；预设与「至今」返回 undefined。 */
export function untilOf(range: TimeRange): string | undefined {
	return range.preset === "custom" ? range.until : void 0;
}

/** 本地时区的日期键 `YYYY-MM-DD`；ISO 字符串无效时原样返回。 */
export function dayKeyOf(value: string | Date): string {
	const date = value instanceof Date ? value : new Date(value);
	if (Number.isNaN(date.getTime())) return String(value);
	const pad = (part: number): string => String(part).padStart(2, "0");
	return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** 某个本地日期的零点。 */
export function startOfDay(date: Date): Date {
	return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

/** 某个本地日期的最后一毫秒，保证结束日整天被包含。 */
export function endOfDay(date: Date): Date {
	return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59, 999);
}

/** 某个本地日期零点对应的自定义范围（到当前时间）。 */
export function customRangeOf(date: Date): TimeRange {
	return { preset: "custom", since: startOfDay(date).toISOString() };
}

/** 起止日期对应的自定义范围；结束日按整天计入。 */
export function rangeOfDays(from: Date, to: Date): TimeRange {
	return { preset: "custom", since: startOfDay(from).toISOString(), until: endOfDay(to).toISOString() };
}

/** 触发器文案：预设标签、「自 YYYY-MM-DD 起」，或「起 ~ 止」。 */
export function rangeLabelOf(t: (key: string) => string, range: TimeRange): string {
	if (range.preset !== "custom") return t(`obsRange_${range.preset}`);
	const since = dayKeyOf(range.since);
	return range.until === void 0 ? t("obsRangeSince").replace("{date}", since) : `${since} ~ ${dayKeyOf(range.until)}`;
}
