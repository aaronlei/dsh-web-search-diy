/**
 * Draft model: normalize a stored bucket, fill from a template, resolve the
 * placeholder/current value of one field, and coerce numbers for the wire.
 */
import type { CatalogEntry, Primitive, TargetDraft } from "./types.ts";
import { BOOLEANS, NUMBERS } from "./field-meta.ts";

/**
 * Numeric fields must reach the host as JSON numbers; a blank entry stays blank so
 * the host sees the "clear this key" signal instead of storing 0.
 */
export const wireValue = (key: string, value: Primitive): Primitive | number =>
	NUMBERS.has(key) && typeof value === "string" && /^\d+$/u.test(value.trim()) ? Number(value.trim()) : value;

/** Normalize a stored bucket into staged values. */
export function toDraft(bucket: unknown): TargetDraft {
	const draft: TargetDraft = {};
	if (typeof bucket !== "object" || bucket === null) return draft;
	for (const [key, value] of Object.entries(bucket)) {
		draft[key] = typeof value === "boolean" ? value : String(value);
	}
	return draft;
}

/**
 * Seed a custom target from its first template. Used both when the user switches to a
 * custom target and when a saved selection already points at one without a bucket.
 * `template` itself is never staged: it is a fill action, not part of the configuration.
 */
/** One template row as served by GET /config. */
export type TemplateEntry = NonNullable<CatalogEntry["templates"]>[number];

/**
 * Fill a draft from one template. Only keys this target actually declares are copied:
 * a template may carry another protocol's defaults (e.g. Zhipu's `contentSize` on a
 * search target), and staging those would make the host reject the whole save.
 */
export function fillFromTemplate(template: TemplateEntry, fields: readonly string[]): TargetDraft {
	const allowed = new Set(fields);
	const filled: TargetDraft = {};
	if (template.chatVariant !== void 0 && allowed.has("chatVariant")) filled.chatVariant = template.chatVariant;
	if (template.toolType !== void 0 && allowed.has("toolType")) filled.toolType = template.toolType;
	for (const [key, raw] of Object.entries(template.defaults)) {
		if (!allowed.has(key)) continue;
		if (Array.isArray(raw)) {
			if (raw.length > 0) filled[key] = String(raw[0]);
		} else if (typeof raw === "boolean") filled[key] = raw;
		else if (raw !== void 0 && raw !== null) filled[key] = String(raw);
	}
	return filled;
}

export function seedFromTemplate(next: CatalogEntry | undefined): TargetDraft {
	const template = next?.templates?.[0];
	if (next === void 0 || template === void 0) return {};
	return fillFromTemplate(template, next.fields);
}

/** Placeholder text for one field: its catalog default. */
export function defaultText(entry: CatalogEntry | undefined, key: string): string {
	const value = entry?.defaults[key];
	if (Array.isArray(value)) return value.length > 0 ? String(value[0]) : "";
	if (typeof value === "boolean") return "";
	return value == null ? "" : String(value);
}

/** Current staged value; booleans fall back to the catalog default. */
export function stagedValue(draft: TargetDraft, entry: CatalogEntry | undefined, key: string): Primitive {
	const value = draft[key];
	if (value !== void 0) return value;
	if (BOOLEANS.has(key)) return entry?.defaults[key] === true;
	return "";
}
