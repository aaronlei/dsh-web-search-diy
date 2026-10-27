/**
 * 配置：v3 文档读写、v1/v2 迁移、按 target 的字段投影与保存、凭据探测。
 *
 * 优先级只有两层：UI 管理的文件 > catalog 默认值。API key 只走凭据面，不落文件。
 *
 * @module dsh-web-search-diy/config
 */
import { credentialRef, isCredentialRefName } from "@deepseek-ai/dsh-credentials";
import type { Context } from "@deepseek-ai/cordis";
import { copyFileSync, existsSync, mkdirSync, readFileSync, renameSync, unlinkSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import {
	CATALOG,
	capabilityOf,
	DEFAULT_TARGET,
	LEGACY_MODE_TARGETS,
	isSelectable,
	OFFICIAL_TARGET_IDS,
	PROTOCOLS,
	splitTargetId,
	VENDORS,
	type Capability,
	type FieldKey,
	type Protocol,
	type TargetId,
	type TargetOptions,
	type Vendor
} from "./catalog.ts";
import type { FieldSpecWire } from "./contract.ts";

/** On-disk configuration version: 3 targets keyed by `<vendor>/<protocol>`. */
export const CONFIG_VERSION = 3;

/** UI 管理的配置文件文档（v3）。 */
export interface ConfigDocument {
	version: number;
	/** 当前选择的厂商；未选择时缺省。 */
	vendor?: Vendor;
	/** 当前选择的协议；未选择时缺省。 */
	protocol?: Protocol;
	/** 每个 target 的配置桶。 */
	targets: Record<string, TargetOptions>;
}

/** 字段值域规格；形状与下发给 Client 的 `FieldSpecWire` 共用。 */
type FieldSpec = FieldSpecWire;

/** 所有字段的校验规格（含迁移时投影的键；`template` 已不在任何 target 的 `fields` 中）。 */
const FIELD_SPECS: Record<FieldKey, FieldSpec> = {
	baseURL: { kind: "string" },
	/** 引用名要能被凭据服务接受，否则每次搜索都会在 `credentialRef()` 处抛错。 */
	apiKeyEnv: { kind: "refName" },
	model: { kind: "string" },
	maxOutputTokens: { kind: "positiveInt" },
	toolType: { kind: "string" },
	includeSources: { kind: "boolean" },
	reasoningEffort: { kind: "string" },
	searchContextSize: { kind: "enum", values: ["low", "medium", "high"] },
	allowedDomains: { kind: "string" },
	blockedDomains: { kind: "string" },
	excludedDomains: { kind: "string" },
	userLocation: { kind: "string" },
	maxUses: { kind: "positiveInt" },
	thinking: { kind: "enum", values: ["default", "disabled"] },
	effort: { kind: "enum", values: ["", "low", "medium", "high", "xhigh", "max"] },
	searchEngine: { kind: "enum", values: ["search_std", "search_pro", "search_pro_sogou", "search_pro_quark"] },
	count: { kind: "positiveInt", max: 50 },
	searchRecencyFilter: { kind: "enum", values: ["noLimit", "oneDay", "oneWeek", "oneMonth", "oneYear"] },
	contentSize: { kind: "enum", values: ["medium", "high"] },
	searchDomainFilter: { kind: "string" },
	searchIntent: { kind: "boolean" },
	requireSearch: { kind: "boolean" },
	searchPrompt: { kind: "string" },
	searchStrategy: { kind: "enum", values: ["turbo", "max", "agent", "agent_max"] },
	forcedSearch: { kind: "boolean" },
	freshness: { kind: "enum", values: ["", "noLimit", "oneDay", "oneWeek", "oneMonth", "oneYear"] },
	assignedSiteList: { kind: "string" },
	searchExtension: { kind: "string" },
	promptIntervene: { kind: "string" },
	engine: { kind: "string" },
	mode: { kind: "string" },
	maxCharacters: { kind: "positiveInt" },
	externalWebAccess: { kind: "enum", values: ["", "true", "false"] },
	returnTokenBudget: { kind: "enum", values: ["", "default", "unlimited"] },
	searchContentTypes: { kind: "string" },
	imageMaxResults: { kind: "positiveInt" },
	imageCaption: { kind: "boolean" },
	responseInclusion: { kind: "enum", values: ["", "full", "excluded"] },
	xSearch: { kind: "json" },
	maxResults: { kind: "positiveInt" },
	maxTotalResults: { kind: "positiveInt" },
	includeContent: { kind: "boolean" },
	timeoutSeconds: { kind: "positiveInt" },
	digestEntries: { kind: "positiveInt", max: 20 },
	digestSnippetChars: { kind: "positiveInt", max: 2000 },
	oriQuestion: { kind: "boolean" },
	localization: { kind: "string" },
	template: { kind: "string" },
	chatVariant: { kind: "enum", values: ["zhipu", "qwen", "openrouter", "openai-search-model"] },
	path: { kind: "string" },
	queryField: { kind: "string" },
	countField: { kind: "string" },
	resultsPath: { kind: "string" },
	urlField: { kind: "string" },
	titleField: { kind: "string" },
	snippetField: { kind: "string" },
	dateField: { kind: "string" },
	contentField: { kind: "string" }
};

/**
 * 配置文件的路径，由 web 配置卡管理：`$DSH_HOME/dsh-web-search-diy.json`。
 *
 * `DSH_HOME` 显式设为空串时按未设置处理，避免配置落到进程当前目录。
 *
 * @returns 配置文件绝对路径。
 */
export function configFilePath(): string {
	const home = process.env.DSH_HOME?.trim();
	return join(home !== void 0 && home.length > 0 ? home : join(homedir(), ".dsh"), "dsh-web-search-diy.json");
}

/** 旧格式文件的一次性备份路径。 */
function backupPath(): string {
	return `${configFilePath()}.v2.bak`;
}

/** 宽松读取对象。 */
function asRecord(value: unknown): Record<string, unknown> | undefined {
	return typeof value === "object" && value !== null ? value as Record<string, unknown> : void 0;
}

/** 按规格校验一个字段值；返回规范化后的值或 undefined。 */
function coerceField(spec: FieldSpec, value: unknown): unknown {
	switch (spec.kind) {
		case "string":
			return typeof value === "string" && value.length > 0 ? value : void 0;
		case "refName":
			return typeof value === "string" && isCredentialRefName(value) ? value : void 0;
		case "positiveInt": {
			/** 表单把数字字段当文本提交，`"131072"` 与 `131072` 同样合法。 */
			const numeric = typeof value === "number"
				? value
				: typeof value === "string" && /^\d+$/u.test(value.trim()) ? Number(value.trim()) : Number.NaN;
			if (!Number.isSafeInteger(numeric) || numeric < 1) return void 0;
			return spec.max !== void 0 && numeric > spec.max ? void 0 : numeric;
		}
		case "boolean":
			return typeof value === "boolean" ? value : void 0;
		case "enum":
			return typeof value === "string" && spec.values.includes(value) ? value : void 0;
		case "json": {
			if (typeof value !== "string" || value.length === 0) return void 0;
			try {
				const parsed: unknown = JSON.parse(value);
				return typeof parsed === "object" && parsed !== null ? value : void 0;
			} catch {
				return void 0;
			}
		}
	}
}

/**
 * 该 target 下一个字段的校验规格。
 *
 * 自定义网关的引擎名不统一（`search_std`、`google`、`searxng` 都可能），因此只有
 * 自定义 target 的 `searchEngine` 放开为任意非空字符串；官方智谱仍按固定枚举校验。
 *
 * @param capability - 目标能力。
 * @param key - 字段名。
 * @returns 校验规格。
 */
function fieldSpecOf(capability: Capability, key: FieldKey): FieldSpec {
	if (capability.vendor === "custom" && key === "searchEngine") return { kind: "string" };
	/** Kimi 的独立搜索接口 limit 上限是 20；其余纯工具接口的 count 上限为 50。 */
	if (capability.id === "kimi/search" && key === "count") return { kind: "positiveInt", max: 20 };
	return FIELD_SPECS[key];
}

/**
 * 该 target 每个声明字段的校验规格，随 catalog 下发给 Client。
 *
 * 只投影 `fields` 内的键：Client 不渲染、也不保存其他键。
 *
 * @param capability - 目标能力。
 * @returns 字段名到规格的映射。
 */
export function specsOf(capability: Capability): Record<string, FieldSpec> {
	const specs: Record<string, FieldSpec> = {};
	for (const key of capability.fields) specs[key] = fieldSpecOf(capability, key);
	return specs;
}

/**
 * 只保留该 target `fields` 内、类型正确的键。
 *
 * @param capability - 目标能力。
 * @param data - 原始桶。
 * @returns 投影后的桶。
 */
export function projectTarget(capability: Capability, data: Record<string, unknown>): TargetOptions {
	const projected: Record<string, unknown> = {};
	for (const key of capability.fields) {
		const value = coerceField(fieldSpecOf(capability, key), data[key]);
		if (value !== void 0) projected[key] = value;
	}
	return projected as TargetOptions;
}

/**
 * 把 v2 的一个 mode 桶迁移成对应 target 的桶，并重命名旧字段。
 *
 * @param mode - 旧 mode 名。
 * @param data - 旧桶。
 * @returns 迁移后的桶（`apiVersion` 等 v3 不再暴露的键丢弃）。
 */
function migrateLegacyBucket(mode: string, data: Record<string, unknown>): TargetOptions {
	const migrated: Record<string, unknown> = { ...data };
	if (mode === "responses") {
		if (data.responsesToolType !== void 0) migrated.toolType = data.responsesToolType;
		if (data.responsesIncludeSources !== void 0) migrated.includeSources = data.responsesIncludeSources;
		if (data.responsesReasoningEffort !== void 0) migrated.reasoningEffort = data.responsesReasoningEffort;
	}
	if (mode === "anthropic-messages") {
		if (data.anthropicThinking !== void 0) migrated.thinking = data.anthropicThinking;
		if (data.anthropicEffort !== void 0) migrated.effort = data.anthropicEffort;
	}
	for (const key of ["responsesToolType", "responsesIncludeSources", "responsesReasoningEffort", "anthropicThinking", "anthropicEffort", "apiVersion", "mode"]) {
		delete migrated[key];
	}
	return migrated as TargetOptions;
}

/**
 * 读取 UI 管理的配置文件为 v3 文档。
 *
 * v3 直接投影；v2（`modes` 桶）与 v1（扁平对象）在内存里迁移到 v3，读取从不写盘——
 * 首次保存时才写 v3 并备份旧文件。
 *
 * @returns 文档，只含已知 target 与已知键。
 */
export function readConfigDocument(): ConfigDocument {
	let raw: unknown;
	try {
		raw = JSON.parse(readFileSync(configFilePath(), "utf8"));
	} catch {
		return { version: CONFIG_VERSION, targets: {} };
	}
	const record = asRecord(raw);
	if (record === void 0) return { version: CONFIG_VERSION, targets: {} };

	const targets: Record<string, TargetOptions> = {};
	if (asRecord(record.targets) !== void 0 && !("modes" in record)) {
		for (const [id, bucket] of Object.entries(asRecord(record.targets) ?? {})) {
			const capability = capabilityOf(id);
			const data = asRecord(bucket);
			if (capability === void 0 || data === void 0) continue;
			const projected = projectTarget(capability, data);
			if (Object.keys(projected).length > 0) targets[id] = projected;
		}
		const selection = typeof record.vendor === "string" && typeof record.protocol === "string" ? `${record.vendor}/${record.protocol}` : void 0;
		const selected = selection !== void 0 ? splitTargetId(selection) : void 0;
		return {
			version: CONFIG_VERSION,
			...(selected !== void 0 ? { vendor: selected.vendor, protocol: selected.protocol } : {}),
			targets
		};
	}

	// v2: { version: 2, mode, modes: { <mode>: {...} } }; v1: one flat object.
	const modes = asRecord(record.modes);
	const buckets: Record<string, unknown> = modes !== void 0
		? modes
		: typeof record.mode === "string" ? { [record.mode]: record } : {};
	for (const [mode, bucket] of Object.entries(buckets)) {
		const targetId = LEGACY_MODE_TARGETS[mode];
		const data = asRecord(bucket);
		if (targetId === void 0 || data === void 0) continue;
		const capability = capabilityOf(targetId);
		if (capability === void 0) continue;
		const projected = projectTarget(capability, migrateLegacyBucket(mode, data) as Record<string, unknown>);
		if (Object.keys(projected).length > 0) targets[targetId] = { ...targets[targetId], ...projected };
	}
	const legacyMode = typeof record.mode === "string" ? record.mode : void 0;
	const migratedSelection = legacyMode !== void 0 ? splitTargetId(LEGACY_MODE_TARGETS[legacyMode] ?? "") : void 0;
	return {
		version: CONFIG_VERSION,
		...(migratedSelection !== void 0 ? { vendor: migratedSelection.vendor, protocol: migratedSelection.protocol } : {}),
		targets
	};
}

/**
 * 把某个 target 的配置持久化进 v3 文件，并把它设为当前选择。
 *
 * 只保存该 target `fields` 内的键；空值删除；清空后的桶整体丢弃。旧格式文件在首次
 * 保存前备份为 `dsh-web-search-diy.json.v2.bak`（一次，保留回滚）。
 *
 * @param vendor - 选择的厂商。
 * @param protocol - 选择的协议。
 * @param partial - 要合并的键。
 * @param cleared - 要删除的键。
 * @returns 已保存的文档。
 */
export function saveConfig(vendor: Vendor, protocol: Protocol, partial: Record<string, unknown>, cleared: readonly string[] = []): ConfigDocument {
	const id = `${vendor}/${protocol}`;
	const capability = capabilityOf(id);
	if (capability === void 0) throw new Error(`unknown target ${id}`);
	const document = readConfigDocument();
	backupLegacyFile();
	const bucket: Record<string, unknown> = { ...document.targets[id] };
	for (const [key, value] of Object.entries(partial)) {
		if (capability.fields.includes(key as FieldKey)) bucket[key] = value;
	}
	for (const key of cleared) delete bucket[key];
	const targets = { ...document.targets };
	if (Object.keys(bucket).length > 0) targets[id] = bucket as TargetOptions;
	else delete targets[id];
	const next: ConfigDocument = { version: CONFIG_VERSION, vendor, protocol, targets };
	mkdirSync(dirname(configFilePath()), { recursive: true });
	replaceFileAtomically(configFilePath(), JSON.stringify(next, null, 2) + "\n");
	return next;
}

/**
 * 原子替换配置文件：同目录临时文件 + rename。
 *
 * 直接覆盖写会在进程崩溃或磁盘写满时留下被截断的 JSON，下一次读取会退化为空文档，
 * 随后的保存把原配置覆盖掉。rename 在同一文件系统上是原子的，读取方只会看到旧文件
 * 或完整的新文件。
 *
 * @param path - 目标文件绝对路径。
 * @param content - 完整的新内容。
 */
function replaceFileAtomically(path: string, content: string): void {
	const temp = `${path}.${process.pid}.tmp`;
	try {
		writeFileSync(temp, content, { mode: 0o600 });
		renameSync(temp, path);
	} catch (error) {
		try {
			unlinkSync(temp);
		} catch {
			// Best effort: the rename may already have consumed the temp file.
		}
		throw error;
	}
}

/** 首次保存前把旧格式文件复制一份；已经备份过就不再覆盖。 */
function backupLegacyFile(): void {
	const path = configFilePath();
	if (!existsSync(path) || existsSync(backupPath())) return;
	let raw: unknown;
	try {
		raw = JSON.parse(readFileSync(path, "utf8"));
	} catch {
		return;
	}
	const record = asRecord(raw);
	if (record === void 0 || record.version === CONFIG_VERSION) return;
	mkdirSync(dirname(path), { recursive: true });
	copyFileSync(path, backupPath());
}

/**
 * 校验一次配置提交。
 *
 * 每个键同一条规则：空值清除、缺省不动、非法值报错并点名。`apiKey` 不在这里处理。
 *
 * @param capability - 目标能力，决定允许的键。
 * @param body - 解析后的 POST 请求体。
 * @returns 要合并的补丁、要删除的键，以及第一个错误（若有）。
 */
export function buildConfigPatch(capability: Capability, body: Record<string, unknown>): { patch: Record<string, unknown>; cleared: string[]; error?: string } {
	const patch: Record<string, unknown> = {};
	const cleared: string[] = [];
	let error: string | undefined;
	/** 模型锁定的组合只接受 catalog 默认模型，避免保存一个不会触发的模型名。 */
	if (capability.modelLocked === true && body.model !== void 0 && body.model !== null && String(body.model).trim() !== "" && String(body.model).trim() !== capability.defaults.model) {
		return { patch: {}, cleared: [], error: `${capability.id} 的模型固定为 ${capability.defaults.model ?? ""}` };
	}
	const allowed = new Set<string>(capability.fields);
	const isBlank = (value: unknown): boolean => value === void 0 || value === null || typeof value === "string" && value.trim().length === 0;
	for (const [key, raw] of Object.entries(body)) {
		if (key === "vendor" || key === "protocol" || key === "apiKey") continue;
		if (!allowed.has(key as FieldKey)) {
			error ??= `${key} 不属于 ${capability.id} 的可配置字段`;
			continue;
		}
		if (isBlank(raw)) {
			cleared.push(key);
			continue;
		}
		const spec = fieldSpecOf(capability, key as FieldKey);
		const value = typeof raw === "string" ? raw.trim() : raw;
		const coerced = coerceField(spec, value);
		if (coerced === void 0) {
			error ??= `${key} 的值不合法（${describeSpec(spec)}）`;
			continue;
		}
		patch[key] = coerced;
	}
	return { patch, cleared, error };
}

/** 给用户看的字段值域描述。 */
function describeSpec(spec: FieldSpec): string {
	switch (spec.kind) {
		case "string":
			return "非空字符串";
		case "refName":
			return "凭据引用名（字母或下划线开头，仅字母、数字、下划线）";
		case "positiveInt":
			return spec.max !== void 0 ? `1-${spec.max} 的整数` : "正整数";
		case "boolean":
			return "布尔值";
		case "enum":
			return spec.values.map((value) => value.length > 0 ? value : "空").join(" / ");
		case "json":
			return "JSON 对象";
	}
}

/**
 * 任一候选引用解析到非空凭据时返回 true。
 *
 * @param ctx - 提供 credentials 服务的插件上下文。
 * @param refNames - 候选引用名，优先级从高到低。
 * @returns 是否存在可用凭据。
 */
export async function hasCredential(ctx: Context, refNames: readonly string[]): Promise<boolean> {
	const credentials = ctx.get("credentials");
	if (credentials === void 0) return false;
	for (const name of refNames) {
		try {
			const resolved = await credentials.resolve(credentialRef(name));
			if (resolved?.value != null && resolved.value.length > 0) return true;
		} catch {
			// An unresolvable reference is simply not this candidate.
		}
	}
	return false;
}

/**
 * 首次加载时的默认选择。
 *
 * 1. 文档已记录选择且该 target 可选 → 用它。
 * 2. `targets` 非空 → 用第一个已保存的可选 target。
 * 3. {@link DEFAULT_TARGET} 的默认凭据可解析 → 用它（DeepSeek 纯工具搜索）。
 * 4. 遍历官方 target，优先挑凭据可解析的完整 Responses 组合。
 * 5. 都没有 → {@link DEFAULT_TARGET}。
 *
 * @param ctx - 提供 credentials 服务的插件上下文。
 * @param document - 已读取的配置文档。
 * @returns 选中的 target id。
 */
export async function selectDefaultTarget(ctx: Context, document: ConfigDocument): Promise<TargetId> {
	if (document.vendor !== void 0 && document.protocol !== void 0) {
		const id = `${document.vendor}/${document.protocol}`;
		if (isSelectable(id)) return id as TargetId;
	}
	const saved = Object.keys(document.targets).find((id) => isSelectable(id));
	if (saved !== void 0) return saved as TargetId;
	/** 首选不消耗模型回合的纯工具搜索：只要有 DeepSeek 凭据就直接落在默认 target 上。 */
	if (await hasCredential(ctx, CATALOG[DEFAULT_TARGET].defaults.apiKeyEnv)) return DEFAULT_TARGET;
	const official = OFFICIAL_TARGET_IDS.filter((id) => CATALOG[id].support !== "unsupported");
	const preferred = [
		...official.filter((id) => CATALOG[id].protocol === "responses" && CATALOG[id].support === "full"),
		...official.filter((id) => CATALOG[id].support === "full"),
		...official
	];
	for (const id of preferred) {
		if (await hasCredential(ctx, CATALOG[id].defaults.apiKeyEnv)) return id;
	}
	return DEFAULT_TARGET;
}

/** 导出的厂商 / 协议顺序，供配置端点下发。 */
export { PROTOCOLS, VENDORS };