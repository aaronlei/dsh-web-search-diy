/**
 * 来源归一化：URL hash、主机名与入库事实。
 *
 * 不保留完整 URL；hash 用于跨记录重合度，host 用于域名分布。
 *
 * @module dsh-web-search-diy/observability/sources
 */
import { createHash } from "node:crypto";
import type { WebSearchSource } from "@deepseek-ai/dsh-web";
import type { ObservationSourceFacts } from "./types.ts";

/** URL 的 SHA-256 前 16 位十六进制。 */
export function urlHashOf(url: string): string {
	return createHash("sha256").update(url).digest("hex").slice(0, 16);
}

/** 解析主机名；非法 URL 记为空串（来源已由协议层规范化）。 */
export function hostOfUrl(url: string): string {
	try {
		return new URL(url).hostname;
	} catch {
		return "";
	}
}

/** 来源文本的入库上限。 */
const URL_MAX_CHARS = 2_000;
const TITLE_MAX_CHARS = 300;
const SNIPPET_MAX_CHARS = 1_000;
const SUMMARY_MAX_CHARS = 2_000;

/** 按码点截断，不切断代理对。 */
function clip(text: string, max: number): string {
	const characters = [...text];
	return characters.length <= max ? text : characters.slice(0, max).join("");
}

/** 按 Unicode 码点计数。 */
function charCount(text: string | undefined): number {
	return text === void 0 ? 0 : [...text].length;
}

/**
 * 把会话来源转成入库事实；按 `urlHash` 去重并保留首次出现顺序。
 *
 * @param list - 归一化后的来源。
 * @returns 不含 URL 的来源事实。
 */
export function factsOfSources(list: readonly WebSearchSource[]): ObservationSourceFacts[] {
	const seen = new Set<string>();
	const facts: ObservationSourceFacts[] = [];
	for (const source of list) {
		const urlHash = urlHashOf(source.url);
		if (seen.has(urlHash)) continue;
		seen.add(urlHash);
		const title = source.title !== void 0 && source.title.length > 0 ? clip(source.title, TITLE_MAX_CHARS) : void 0;
		const snippet = source.snippet !== void 0 && source.snippet.length > 0 ? clip(source.snippet, SNIPPET_MAX_CHARS) : void 0;
		const summary = source.summary !== void 0 && source.summary.length > 0 ? clip(source.summary, SUMMARY_MAX_CHARS) : void 0;
		facts.push({
			urlHash,
			host: hostOfUrl(source.url),
			hasTitle: title !== void 0,
			hasSnippet: snippet !== void 0,
			hasSummary: summary !== void 0,
			summaryChars: charCount(summary),
			url: clip(source.url, URL_MAX_CHARS),
			...(title !== void 0 ? { title } : {}),
			...(snippet !== void 0 ? { snippet } : {}),
			...(summary !== void 0 ? { summary } : {})
		});
	}
	return facts;
}
