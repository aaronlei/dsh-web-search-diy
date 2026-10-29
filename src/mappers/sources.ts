/**
 * 来源归一化：URL 清理、发布日期格式化、智谱条目去重。
 *
 * 各协议映射器共用这些步骤，保证 seam 拿到的 `sources[]` 形状一致。
 *
 * @module dsh-web-search-diy/mappers/sources
 */
import type { WebSearchSource } from "@deepseek-ai/dsh-web";

/** 映射过程中可写的一条来源；最终以 {@link WebSearchSource} 交出。 */
export interface MutableSource {
	url: string;
	title?: string;
	snippet?: string;
	/** 长正文，供调用方模型阅读；`dsh-tool-web` 会再按部署配置截断。 */
	summary?: string;
	publishedAt?: string;
}

/**
 * DeepSeek 用内部调用片段标记它打开过的页面（`…#ws_call_id=call_01_…`）；
 * 去掉它，保证每条来源都是可引用的 URL。
 *
 * 只接受绝对 `http:` / `https:` URL：来源最终会作为可点击链接交给客户端，
 * 数据来源不可信时不能把 `javascript:` 一类协议透传下去。
 *
 * @param value - provider 提供的 URL。
 * @returns 清理后的 URL；没有可用内容或协议不受支持时返回 undefined。
 */
export function normalizeSourceUrl(value: unknown): string | undefined {
	if (typeof value !== "string" || value.length === 0) return void 0;
	const cleaned = value.replace(/#ws_call_id=[^#]*$/u, "");
	if (cleaned.length === 0) return void 0;
	try {
		const protocol = new URL(cleaned).protocol;
		return protocol === "http:" || protocol === "https:" ? cleaned : void 0;
	} catch {
		return void 0;
	}
}

/**
 * 把 provider 提供的发布日期归一化成 seam `publishedAt` 承诺的 ISO-8601 字符串。
 *
 * Anthropic 发送的是人类可读的 `page_age`（"April 30, 2025"）；无法解析出日期的值
 * 直接丢弃，不回显。
 *
 * @param value - provider 的 `page_age`。
 * @returns ISO-8601 日期（YYYY-MM-DD），或 undefined。
 */
export function isoPublishedAt(value: unknown): string | undefined {
	if (typeof value !== "string" || value.length === 0) return void 0;
	const parsed = Date.parse(value);
	if (Number.isNaN(parsed)) return void 0;
	/**
	 * 在解析时所在时区格式化日历日：provider 声明的是发布日而不是时刻，转 UTC 会把
	 * 格林尼治以东的 "April 30, 2025" 移到 29 日。
	 */
	const date = new Date(parsed);
	const month = String(date.getMonth() + 1).padStart(2, "0");
	const day = String(date.getDate()).padStart(2, "0");
	return `${date.getFullYear()}-${month}-${day}`;
}

/**
 * 把智谱搜索条目（`search_result[]` 项或 chat 工具的 source 对象，形状都是
 * `{link, title, ...}`）归一化成 seam 来源，按 URL 去重。seam 没有槽位的字段
 * （`media`、`publish_date`、`icon`）丢弃。
 *
 * @param entries - 智谱返回的条目数组。
 * @returns 去重后的来源。
 */
export function normalizeZhipuSources(entries: readonly unknown[]): MutableSource[] {
	const seen = new Set<string>();
	const sources: MutableSource[] = [];
	for (const item of entries) {
		const url = normalizeSourceUrl((item as { link?: unknown } | null | undefined)?.link);
		if (url === void 0 || seen.has(url)) continue;
		seen.add(url);
		const title = (item as { title?: unknown }).title;
		const source: MutableSource = { url };
		if (typeof title === "string" && title.length > 0) source.title = title;
		sources.push(source);
	}
	return sources;
}