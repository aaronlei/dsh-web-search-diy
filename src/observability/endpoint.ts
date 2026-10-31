/**
 * 观测 HTTP 端点：summary / records / export / clear。
 *
 * 沿用配置端点的 webServer 子 fiber 注册模式，参数在后端校验，错误以 JSON 返回。
 *
 * @module dsh-web-search-diy/observability/endpoint
 */
import { BodyTooLargeError, readJsonBody, sendJson, type HttpRequestLike, type HttpResponseLike, type WebServerLike } from "../endpoint.ts";
import { resolveRange } from "./aggregate.ts";
import type { ImportResult } from "./import.ts";
import type { ObservationStore } from "./store.ts";
import type { ExportFormat, RangeQuery, RecordsQuery } from "./types.ts";

/** 路由前缀。 */
const BASE = "/api/web-search-diy/observability";

/** 明细分页的查询词上限，避免超长 LIKE。 */
const MAX_FILTER_TERM = 200;

/** 读取请求的查询参数。 */
function queryOf(req: HttpRequestLike): URLSearchParams {
	const raw = req.url ?? "";
	const index = raw.indexOf("?");
	return new URLSearchParams(index >= 0 ? raw.slice(index + 1) : "");
}

/** 解析范围参数；`since` / `until` 的合法性由 store 的 `resolveRange` 再校验一次。 */
function rangeOf(params: URLSearchParams): RangeQuery {
	const target = params.get("target") ?? "";
	const until = params.get("until");
	return {
		...(params.get("since") !== null ? { since: params.get("since") ?? void 0 } : {}),
		...(until !== null && until.length > 0 ? { until } : {}),
		...(target.length > 0 ? { target } : {}),
		includeTests: params.get("includeTests") === "true"
	};
}

/** 解析记录筛选与分页。 */
function recordsQueryOf(params: URLSearchParams): RecordsQuery {
	const page = params.get("page");
	const status = params.get("status");
	const term = params.get("query");
	const limit = params.get("limit");
	const query: RecordsQuery = {
		...rangeOf(params),
		...(limit !== null ? { limit: Number(limit) } : {}),
		...(page !== null && page.length > 0 ? { page: Number(page) } : {}),
		...(status === "ok" || status === "fail" ? { status } : {}),
		...(term !== null && term.length > 0 ? { query: term.slice(0, MAX_FILTER_TERM) } : {})
	};
	/** 非法页码不报错：存储会夹紧到有效页，避免旧链接失效。 */
	return query;
}

/** 解析导出格式。 */
function formatOf(params: URLSearchParams): ExportFormat {
	const format = params.get("format");
	if (format === "csv") return "csv";
	if (format === "jsonl" || format === null) return "jsonl";
	throw new RangeError(`不支持的导出格式: ${format}`);
}

/** 统一的观测错误响应：范围参数错误 400，其余 500。 */
function failure(res: HttpResponseLike, error: unknown): void {
	if (error instanceof RangeError) return sendJson(res, 400, { error: error.message });
	sendJson(res, 500, { error: "观测数据库读取失败" });
}

/** 历史导入执行器；两个边界都来自独立的导入范围。 */
export type ImportRunner = (sinceMs?: number, untilMs?: number) => Promise<ImportResult>;

/**
 * 注册观测端点。
 *
 * @param store - 观测存储。
 * @param webServer - host webserver 服务。
 * @param importRunner - 历史会话导入执行器。
 */
export function registerObservabilityEndpoints(store: ObservationStore, webServer: WebServerLike, importRunner?: ImportRunner): () => void {
	const disposers = [
		webServer.register({
			kind: "exact",
			path: `${BASE}/summary`,
			handler: (req, res) => {
				if (req.method !== "GET") return sendJson(res, 405, { error: "仅支持 GET" });
				try {
					return sendJson(res, 200, store.summary(rangeOf(queryOf(req))));
				} catch (error) {
					return failure(res, error);
				}
			}
		}),
		webServer.register({
			kind: "exact",
			path: `${BASE}/export`,
			handler: (req, res) => {
				if (req.method !== "GET") return sendJson(res, 405, { error: "仅支持 GET" });
				try {
					const params = queryOf(req);
					const exported = store.export({ ...rangeOf(params), format: formatOf(params) });
					res.writeHead(200, {
						"Content-Type": exported.contentType,
						"Content-Length": Buffer.byteLength(exported.body),
						"Content-Disposition": `attachment; filename="${exported.filename}"`,
						"Cache-Control": "no-store"
					});
					res.end(exported.body);
					return;
				} catch (error) {
					return failure(res, error);
				}
			}
		}),
		...(importRunner !== void 0 ? [webServer.register({
			kind: "exact",
			path: `${BASE}/import`,
			handler: async (req, res) => {
				if (req.method !== "POST") return sendJson(res, 405, { error: "仅支持 POST" });
				let body: unknown = {};
				try {
					body = await readJsonBody(req);
				} catch (error) {
					if (error instanceof BodyTooLargeError) return sendJson(res, 413, { error: "请求体过大" });
					return sendJson(res, 400, { error: "请求体不是合法 JSON" });
				}
				const record = typeof body === "object" && body !== null ? body as Record<string, unknown> : {};
				let sinceMs: number | undefined;
				let untilMs: number | undefined;
				try {
					if (typeof record.since === "string" && record.since.length > 0) sinceMs = resolveRange(record.since, Date.now()).sinceMs;
					if (typeof record.until === "string" && record.until.length > 0) {
						/** 结束时间独立解析：不能套用默认的「近 24 小时」起点，否则较早的结束日会被拒。 */
						const parsed = Date.parse(record.until);
						if (!Number.isFinite(parsed)) throw new RangeError("无法解析的结束时间");
						untilMs = parsed;
					}
					if (sinceMs !== void 0 && untilMs !== void 0 && untilMs < sinceMs) throw new RangeError("结束时间必须晚于开始时间");
				} catch (error) {
					return sendJson(res, 400, { error: error instanceof Error ? error.message : "无效的导入范围" });
				}
				try {
					return sendJson(res, 200, await importRunner(sinceMs, untilMs));
				} catch {
					return sendJson(res, 500, { error: "历史记录导入失败" });
				}
			}
		})] : []),
		webServer.register({
			kind: "exact",
			path: `${BASE}/records`,
			handler: async (req, res) => {
				if (req.method === "GET") {
					try {
						return sendJson(res, 200, store.records(recordsQueryOf(queryOf(req))));
					} catch (error) {
						return failure(res, error);
					}
				}
				if (req.method !== "DELETE") return sendJson(res, 405, { error: "仅支持 GET / DELETE" });
				let body: unknown;
				try {
					body = await readJsonBody(req);
				} catch (error) {
					if (error instanceof BodyTooLargeError) return sendJson(res, 413, { error: "请求体过大" });
					return sendJson(res, 400, { error: "请求体不是合法 JSON" });
				}
				const record = typeof body === "object" && body !== null ? body as Record<string, unknown> : {};
				if (record.confirm !== "DELETE") return sendJson(res, 400, { error: '清空观测数据需要 confirm: "DELETE"' });
				try {
					return sendJson(res, 200, { ok: true, deleted: store.clear() });
				} catch (error) {
					return failure(res, error);
				}
			}
		})
	];
	return () => {
		/** 后注册先释放，和路由注册顺序严格相反。 */
		for (const dispose of [...disposers].reverse()) dispose();
	};
}
