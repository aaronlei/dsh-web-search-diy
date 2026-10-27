/**
 * Human-readable labels for protocols, vendors and support badges, plus the
 * protocol display order.
 */
import type { Protocol } from "../catalog.ts";
import type { CatalogEntry } from "./types.ts";

/** Protocol display order. */
export const PROTOCOLS: readonly Protocol[] = ["chat-completions", "responses", "anthropic-messages", "search"];
//#endregion

/** Human label for a protocol. */
export function protocolLabel(t: (key: string) => string, protocol: Protocol): string {
	if (protocol === "chat-completions") return t("protocolChat");
	if (protocol === "responses") return t("protocolResponses");
	if (protocol === "anthropic-messages") return t("protocolAnthropic");
	return t("protocolSearch");
}

/** Human label for a vendor. */
export function vendorLabel(t: (key: string) => string, vendor: string): string {
	const key = `vendor${vendor.slice(0, 1).toUpperCase()}${vendor.slice(1)}`;
	const label = t(key);
	return label === key ? vendor : label;
}

/** Support badge copy. */
export function supportLabel(t: (key: string) => string, support: CatalogEntry["support"]): string {
	return t(support);
}
