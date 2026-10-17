/**
 * 线上响应体的宽松读取工具。
 *
 * 网关返回的 JSON 形状随厂商与版本变化，映射器只信任逐字段校验过的值：这几个函数把
 * `unknown` 收窄成可安全读取的形状，非目标类型一律退化为空值。
 *
 * @module dsh-web-search-diy/wire
 */

/** 宽松读取一层对象，非对象返回 undefined。 */
export function asRecord(value: unknown): Record<string, unknown> | undefined {
	return typeof value === "object" && value !== null ? value as Record<string, unknown> : void 0;
}

/** 宽松读取数组，非数组返回空数组。 */
export function asArray(value: unknown): readonly unknown[] {
	return Array.isArray(value) ? value : [];
}

/** 宽松读取字符串，非字符串返回 undefined。 */
export function asString(value: unknown): string | undefined {
	return typeof value === "string" ? value : void 0;
}