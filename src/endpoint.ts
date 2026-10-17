/**
 * Host 配置端点：`/api/web-search-diy/config` 的 GET / POST。
 *
 * GET 下发完整 catalog，Client 不再自带厂商默认值。POST 只接受当前 target 声明的
 * 字段；API key 只经凭据面写入。
 *
 * @module dsh-web-search-diy/endpoint
 */
import { credentialRef } from "@deepseek-ai/dsh-credentials";
import type { Context } from "@deepseek-ai/cordis";
import { ALL_TARGETS, capabilityOf, isSelectable, PROTOCOLS, VENDORS, type Capability, type TargetId } from "./catalog.ts";
import {
	buildConfigPatch,
	CONFIG_VERSION,
	hasCredential,
	readConfigDocument,
	saveConfig,
	selectDefaultTarget
} from "./config.ts";
import { resolveOptions, selectedTargetOf } from "./options.ts";
import { DiySearchProvider } from "./provider.ts";

/** 最小 HTTP 请求形状：只包含本端点用到的成员。 */
export interface HttpRequestLike {
	readonly method?: string;
	on(event: "data", listener: (chunk: unknown) => void): void;
	on(event: "end", listener: () => void): void;
	on(event: "error", listener: (error: unknown) => void): void;
}

/** 最小 HTTP 响应形状：只包含本端点用到的成员。 */
export interface HttpResponseLike {
	writeHead(status: number, headers: Record<string, string | number>): void;
	end(body: string): void;
}

/** `webServer` 服务中本插件用到的部分。 */
export interface WebServerLike {
	register(route: {
		kind: "exact";
		path: string;
		handler: (req: HttpRequestLike, res: HttpResponseLike) => void | Promise<void>;
	}): () => void;
}

/** 读取 JSON 请求体。 */
export function readJsonBody(req: HttpRequestLike): Promise<unknown> {
	return new Promise((resolve, reject) => {
		let raw = "";
		req.on("data", (chunk) => {
			raw += chunk;
		});
		req.on("end", () => {
			try {
				resolve(raw.length > 0 ? JSON.parse(raw) : {});
			} catch (error) {
				reject(error);
			}
		});
		req.on("error", reject);
	});
}

/** 统一 JSON 响应。 */
export function sendJson(res: HttpResponseLike, status: number, body: unknown): void {
	const payload = JSON.stringify(body);
	res.writeHead(status, {
		"Content-Type": "application/json; charset=utf-8",
		"Content-Length": Buffer.byteLength(payload)
	});
	res.end(payload);
}

/** 配置端点用到的凭据面（`set` 只写不读）。 */
interface CredentialsLike {
	set(ref: ReturnType<typeof credentialRef>, value: string): Promise<void>;
}

/** 下发给 Client 的 catalog 条目。 */
export function catalogPayload(): unknown[] {
	return Object.values(ALL_TARGETS).map((capability) => ({
		id: capability.id,
		kind: capability.protocol === "search" ? "standalone" : "in-protocol",
		protocol: capability.protocol,
		vendor: capability.vendor,
		support: capability.support,
		reason: capability.reason ?? "",
		title: capability.title,
		docs: capability.docs ?? "",
		defaults: capability.defaults,
		fields: capability.fields,
		modelLocked: capability.modelLocked === true,
		hints: capability.hints ?? {},
		...(capability.templates !== void 0 ? { templates: capability.templates } : {})
	}));
}

/**
 * 校验自定义 target 的必填项。
 *
 * @param capability - 目标能力。
 * @param merged - 合并后的桶（现有 + 本次 patch）。
 * @returns 错误文案，或 undefined。
 */
function validateCustom(capability: Capability, merged: Record<string, unknown>): string | undefined {
	if (capability.support !== "custom") return void 0;
	if (capability.protocol === "search") {
		/** `template` 只是填充动作，不落盘；实际请求由已保存的字段与内置默认决定。 */
		if (typeof merged.path !== "string" || merged.path.length === 0) return "自定义纯工具搜索必须填写 path";
		return void 0;
	}
	if (capability.protocol === "chat-completions") {
		if (typeof merged.chatVariant !== "string" || merged.chatVariant.length === 0) return "自定义 Chat 必须选择 chatVariant";
		return void 0;
	}
	/** Responses 与 Anthropic 的自定义实例靠 toolType 决定请求形状，缺了就会静默不搜索。 */
	if (typeof merged.toolType !== "string" || merged.toolType.length === 0) return `自定义 ${capability.protocol} 必须填写 toolType`;
	return void 0;
}

/**
 * 每个厂商默认凭据链是否可解析。
 *
 * 配置页的「已配置密钥」徽标必须跟随所选厂商，而不是只反映加载时的 target；
 * 因此 GET 一次给出全部厂商的状态。`custom` 的引用名由用户填写，没有默认链，
 * 恒为 false（UI 另行提示「取决于凭据引用」）。
 *
 * @param ctx - 插件上下文（credentials 经 `ctx.get` 取得）。
 * @returns 厂商 → 是否至少有一条默认引用可解析。
 */
async function credentialState(ctx: Context): Promise<Record<string, boolean>> {
	const chains = new Map<string, string[]>();
	for (const capability of Object.values(ALL_TARGETS)) {
		if (capability.support === "unsupported") continue;
		const names = chains.get(capability.vendor) ?? [];
		for (const name of capability.defaults.apiKeyEnv) {
			if (!names.includes(name)) names.push(name);
		}
		chains.set(capability.vendor, names);
	}
	const entries = await Promise.all(VENDORS.map(async (vendor) => {
		const names = chains.get(vendor) ?? [];
		return [vendor, names.length > 0 && await hasCredential(ctx, names)] as const;
	}));
	return Object.fromEntries(entries);
}

/**
 * 校验依赖其他字段取值的组合限制。
 *
 * 智谱 `search_pro_sogou` 只接受 10/20/30/40/50 的 `count`；这是字段级规格表达不了
 * 的约束，所以在合并后的桶上校验。
 *
 * @param capability - 目标能力。
 * @param merged - 合并后的桶（现有 + 本次 patch）。
 * @returns 错误文案，或 undefined。
 */
function validateTargetValues(capability: Capability, merged: Record<string, unknown>): string | undefined {
	if (capability.vendor !== "zhipu" || merged.searchEngine !== "search_pro_sogou") return void 0;
	const count = merged.count;
	if (typeof count !== "number") return void 0;
	const allowed = [10, 20, 30, 40, 50];
	return allowed.includes(count) ? void 0 : "search_pro_sogou 的 count 只支持 10/20/30/40/50";
}

/**
 * 在 webServer 服务上注册配置 HTTP 端点（仅 web profile）。
 *
 * @param ctx - 插件上下文（credentials 经 `ctx.get` 取得）。
 * @param webServer - host webserver 服务。
 */
export function registerConfigEndpoint(ctx: Context, webServer: WebServerLike): () => void {
	const disposeConfig = webServer.register({
		kind: "exact",
		path: "/api/web-search-diy/config",
		handler: async (req, res) => {
			if (req.method === "GET") {
				const document = readConfigDocument();
				const target = selectedTargetOf(document) ?? await selectDefaultTarget(ctx, document);
				const capability = capabilityOf(target) ?? ALL_TARGETS["qwen/responses"];
				const bucket = document.targets[target] ?? {};
				const keyConfigured = await hasCredential(ctx, capability.defaults.apiKeyEnv);
				const credentials = await credentialState(ctx);
				return sendJson(res, 200, {
					version: CONFIG_VERSION,
					selection: { vendor: capability.vendor, protocol: capability.protocol },
					target: bucket,
					targets: document.targets,
					keyConfigured,
					/** 每个厂商的默认链状态：Client 切厂商时据此更新密钥徽标。 */
					credentials,
					catalog: catalogPayload(),
					vendors: VENDORS,
					protocols: PROTOCOLS
				});
			}
			if (req.method === "POST") {
				let body: unknown;
				try {
					body = await readJsonBody(req);
				} catch {
					return sendJson(res, 400, { error: "请求体不是合法 JSON" });
				}
				if (body === null || typeof body !== "object") return sendJson(res, 400, { error: "请求体必须是 JSON 对象" });
				const record = body as Record<string, unknown>;
				const vendor = record.vendor;
				const protocol = record.protocol;
				if (typeof vendor !== "string" || typeof protocol !== "string") return sendJson(res, 400, { error: "请求体必须包含 vendor 与 protocol" });
				const id = `${vendor}/${protocol}`;
				const capability = capabilityOf(id);
				if (capability === void 0) return sendJson(res, 400, { error: `未知的 target: ${id}` });
				if (capability.support === "unsupported") return sendJson(res, 400, { error: `${id} 不可用：${capability.reason ?? "不支持"}` });
				if (!isSelectable(id)) return sendJson(res, 400, { error: `${id} 不可选择` });
				const { patch, cleared, error } = buildConfigPatch(capability, record);
				if (error !== void 0) return sendJson(res, 400, { error });
				const document = readConfigDocument();
				const existing = document.targets[id] ?? {};
				const merged: Record<string, unknown> = { ...existing, ...patch };
				for (const key of cleared) delete merged[key];
				const customError = validateCustom(capability, merged);
				if (customError !== void 0) return sendJson(res, 400, { error: customError });
				const valueError = validateTargetValues(capability, merged);
				if (valueError !== void 0) return sendJson(res, 400, { error: valueError });
				if (typeof record.apiKey === "string" && record.apiKey.length > 0) {
					const credentials = ctx.get("credentials") as CredentialsLike | undefined;
					if (credentials === void 0) return sendJson(res, 400, { error: "credentials 服务不可用，无法保存 API key" });
					const refName = typeof merged.apiKeyEnv === "string" && merged.apiKeyEnv.length > 0 ? merged.apiKeyEnv : capability.defaults.apiKeyEnv[0];
					if (refName === void 0) return sendJson(res, 400, { error: "请先填写 apiKeyEnv（凭据引用名）" });
					try {
						await credentials.set(credentialRef(refName), record.apiKey);
					} catch (cause) {
						return sendJson(res, 400, { error: `API key 保存失败: ${String(cause)}` });
					}
				}
				const saved = saveConfig(capability.vendor, capability.protocol, patch, cleared);
				const keyConfigured = await hasCredential(ctx, capability.defaults.apiKeyEnv);
				return sendJson(res, 200, { ok: true, keyConfigured, targets: saved.targets });
			}
			return sendJson(res, 405, { error: "仅支持 GET / POST" });
		}
	});
	/**
	 * 用当前草稿（含已保存值）执行一次最小搜索，不写盘。失败也返回 200，
	 * 由 `ok` 字段区分，便于 UI 统一渲染。
	 */
	const disposeTest = webServer.register({
		kind: "exact",
		path: "/api/web-search-diy/test",
		handler: async (req, res) => {
			if (req.method !== "POST") return sendJson(res, 405, { error: "仅支持 POST" });
			let body: unknown;
			try {
				body = await readJsonBody(req);
			} catch {
				return sendJson(res, 400, { error: "请求体不是合法 JSON" });
			}
			if (body === null || typeof body !== "object") return sendJson(res, 400, { error: "请求体必须是 JSON 对象" });
			const record = body as Record<string, unknown>;
			if (typeof record.vendor !== "string" || typeof record.protocol !== "string") return sendJson(res, 400, { error: "请求体必须包含 vendor 与 protocol" });
			const id = `${record.vendor}/${record.protocol}`;
			const capability = capabilityOf(id);
			if (capability === void 0) return sendJson(res, 400, { error: `未知的 target: ${id}` });
			if (capability.support === "unsupported") return sendJson(res, 400, { error: `${id} 不可用：${capability.reason ?? "不支持"}` });
			const { patch, error } = buildConfigPatch(capability, record);
			if (error !== void 0) return sendJson(res, 400, { error });
			const saved = readConfigDocument().targets[id] ?? {};
			const merged = { ...saved, ...patch };
			const options = resolveOptions(ctx, { version: CONFIG_VERSION, targets: { [id]: merged } }, id as TargetId);
			const started = Date.now();
			try {
				const result = await new DiySearchProvider(() => options).search({ query: "OpenAI", maxResults: 3 }, AbortSignal.timeout(60_000));
				return sendJson(res, 200, {
					ok: true,
					sourceCount: result.sources.length,
					sourceQuality: capability.search.sourceQuality,
					degraded: capability.support === "degraded",
					latencyMs: Date.now() - started,
					contentPreview: (result.content ?? "").slice(0, 200)
				});
			} catch (cause) {
				return sendJson(res, 200, {
					ok: false,
					degraded: capability.support === "degraded",
					latencyMs: Date.now() - started,
					error: cause instanceof Error ? cause.message : String(cause)
				});
			}
		}
	});
	return () => {
		disposeConfig();
		disposeTest();
	};
}