/**
 * 观测存储：写入、汇总、明细分页、导出与清空。
 *
 * 写入一个观测与其来源明细在同一事务里提交；所有失败都在这里被吸收，搜索
 * 返回值不受影响。`node:sqlite` 是同步 API，单条记录的写入在毫秒级。
 *
 * @module dsh-web-search-diy/observability/store
 */
import { randomUUID } from "node:crypto";
import { rangeFilter, summarize, type ObservationRow } from "./aggregate.ts";
import { contentTypeOf, exportFileName, serialize } from "./export.ts";
import { openObservationDatabase } from "./schema.ts";
import { factsOfSources } from "./sources.ts";
import type {
	ExportQuery,
	ObservabilitySummary,
	ObservationRecord,
	ObservationRecordView,
	ObservationSource,
	ObservationSourceFacts,
	RangeQuery,
	RecordsPage,
	RecordsQuery,
	SearchOutcome
} from "./types.ts";

/** 搜索词入库上限。 */
const QUERY_MAX_CHARS = 200;
/** 失败消息入库上限。 */
const ERROR_MAX_CHARS = 300;
/** 答案文本入库上限。 */
const ANSWER_MAX_CHARS = 4_000;
/** 明细分页默认与上限。 */
const DEFAULT_RECORD_LIMIT = 50;
const MAX_RECORD_LIMIT = 500;
/** 单次导出上限。 */
const MAX_EXPORT_ROWS = 50_000;
/** 聚合缓存窗口。 */
const SUMMARY_CACHE_MS = 2000;

/** 观测库用到的列；顺序与 {@link ObservationRow} 一致。 */
const ROW_COLUMNS = [
	"id", "at", "kind", "session_id", "target", "vendor", "protocol", "query", "ok",
	"error_code", "error_message", "duration_ms", "source_count", "with_title", "with_snippet",
	"with_summary", "summary_chars", "answer_chars", "truncated", "answer"
].join(", ");

const INSERT_OBSERVATION = `INSERT OR IGNORE INTO observations (${ROW_COLUMNS}) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;
const INSERT_SOURCE = "INSERT OR IGNORE INTO observation_sources (observation_id, url_hash, host, has_title, has_snippet, has_summary, url, title, snippet, summary) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)";

/** 打开观测库的方式。 */
export interface ObservationStoreOptions {
	/** 数据库路径；默认 `$DSH_HOME/web-search-diy/observations.db`。 */
	readonly path?: string;
	/** 诊断出口；打开或写入失败时最多各记一次。 */
	readonly warn?: (message: string) => void;
	/** 时钟注入，便于测试。 */
	readonly now?: () => number;
}

/** 按 Unicode 码点截断，不切断代理对。 */
function clip(text: string, max: number): string {
	const characters = [...text];
	return characters.length <= max ? text : characters.slice(0, max).join("");
}

/** 从已归一化的来源事实派生入库明细。 */
function sourcesOf(observationId: string, facts: readonly ObservationSourceFacts[]): ObservationSource[] {
	return facts.map((fact) => ({
		observationId,
		urlHash: fact.urlHash,
		host: fact.host,
		hasTitle: fact.hasTitle,
		hasSnippet: fact.hasSnippet,
		hasSummary: fact.hasSummary,
		...(fact.url !== void 0 ? { url: fact.url } : {}),
		...(fact.title !== void 0 ? { title: fact.title } : {}),
		...(fact.snippet !== void 0 ? { snippet: fact.snippet } : {}),
		...(fact.summary !== void 0 ? { summary: fact.summary } : {})
	}));
}

/** 从原始结果派生一条可写入的记录。 */
function recordOf(outcome: SearchOutcome, id: string, facts: readonly ObservationSourceFacts[]): ObservationRecord {
	const content = outcome.result?.content ?? "";
	const answer = content.length > 0 ? clip(content, ANSWER_MAX_CHARS) : void 0;
	let withTitle = 0;
	let withSnippet = 0;
	let withSummary = 0;
	let summaryChars = 0;
	for (const fact of facts) {
		if (fact.hasTitle) withTitle += 1;
		if (fact.hasSnippet) withSnippet += 1;
		if (fact.hasSummary) withSummary += 1;
		summaryChars += fact.summaryChars;
	}
	return {
		v: 1,
		id,
		at: outcome.startedAt,
		kind: outcome.kind,
		...(outcome.sessionId !== void 0 ? { sessionId: outcome.sessionId } : {}),
		target: outcome.target,
		vendor: outcome.vendor,
		protocol: outcome.protocol,
		query: clip(outcome.query, QUERY_MAX_CHARS),
		ok: outcome.ok,
		...(outcome.errorCode !== void 0 ? { errorCode: outcome.errorCode } : {}),
		...(outcome.errorMessage !== void 0 ? { errorMessage: clip(outcome.errorMessage, ERROR_MAX_CHARS) } : {}),
		durationMs: Math.max(0, Math.round(outcome.durationMs)),
		sourceCount: facts.length,
		withTitle,
		withSnippet,
		withSummary,
		summaryChars,
		answerChars: [...(outcome.result?.content ?? "")].length,
		truncated: outcome.result?.truncated === true,
		...(answer !== void 0 ? { answer } : {})
	};
}

/** 数据库行 → API 记录。 */
function recordFromRow(row: ObservationRow): ObservationRecord {
	return {
		v: 1,
		id: row.id,
		at: row.at,
		kind: row.kind as ObservationRecord["kind"],
		...(row.session_id !== null ? { sessionId: row.session_id } : {}),
		target: row.target,
		vendor: row.vendor,
		protocol: row.protocol,
		query: row.query,
		ok: row.ok === 1,
		...(row.error_code !== null ? { errorCode: row.error_code } : {}),
		...(row.error_message !== null ? { errorMessage: row.error_message } : {}),
		durationMs: row.duration_ms,
		sourceCount: row.source_count,
		withTitle: row.with_title,
		withSnippet: row.with_snippet,
		withSummary: row.with_summary,
		summaryChars: row.summary_chars,
		answerChars: row.answer_chars,
		truncated: row.truncated === 1,
		...(typeof row.answer === "string" && row.answer.length > 0 ? { answer: row.answer } : {})
	};
}

/** 来源行 → API 明细。 */
function sourceFromRow(row: Record<string, unknown>): ObservationSource {
	const text = (value: unknown): string | undefined => typeof value === "string" && value.length > 0 ? value : void 0;
	const url = text(row.url);
	const title = text(row.title);
	const snippet = text(row.snippet);
	const summary = text(row.summary);
	return {
		observationId: String(row.observation_id),
		urlHash: String(row.url_hash),
		host: String(row.host),
		hasTitle: row.has_title === 1,
		hasSnippet: row.has_snippet === 1,
		hasSummary: row.has_summary === 1,
		...(url !== void 0 ? { url } : {}),
		...(title !== void 0 ? { title } : {}),
		...(snippet !== void 0 ? { snippet } : {}),
		...(summary !== void 0 ? { summary } : {})
	};
}

/** 分页上限收窄。 */
function limitOf(value: number | undefined): number {
	if (value === void 0 || !Number.isSafeInteger(value) || value < 1) return DEFAULT_RECORD_LIMIT;
	return Math.min(value, MAX_RECORD_LIMIT);
}

/** 异常转诊断文本；不包含搜索词或凭据。 */
function describe(error: unknown): string {
	return error instanceof Error ? error.message : String(error);
}

/** 观测存储门面；构造失败时 `open` 返回 undefined，插件按禁用观测继续。 */
export class ObservationStore {
	private readonly db: ReturnType<typeof openObservationDatabase>;
	private readonly warn: ((message: string) => void) | undefined;
	private readonly now: () => number;
	private summaryCache: { key: string; at: number; value: ObservabilitySummary } | undefined;
	private warned = false;

	private constructor(db: ReturnType<typeof openObservationDatabase>, options: ObservationStoreOptions) {
		this.db = db;
		this.warn = options.warn;
		this.now = options.now ?? Date.now;
	}

	/**
	 * 打开观测库；任何失败都降级为禁用观测。
	 *
	 * @param options - 路径、诊断出口与时钟。
	 * @returns 可用的存储，或 undefined。
	 */
	static open(options: ObservationStoreOptions = {}): ObservationStore | undefined {
		try {
			return new ObservationStore(openObservationDatabase(options.path), options);
		} catch (error) {
			options.warn?.(`observation store disabled: ${describe(error)}`);
			return void 0;
		}
	}

	/**
	 * 写一条记录；失败只告警一次，永不抛出。
	 *
	 * @param outcome - 记录事实。
	 * @param id - 记录 id；历史导入传入确定性 id。
	 * @returns 新写入、已存在或仅补全 target 的更新。
	 */
	record(outcome: SearchOutcome, id: string = randomUUID()): "inserted" | "existing" | "updated" {
		try {
			const status = this.insert(outcome, id);
			if (status !== "existing") this.summaryCache = void 0;
			return status;
		} catch (error) {
			this.warnOnce(`observation write failed: ${describe(error)}`);
			return "existing";
		}
	}

	/** 一条观测与其来源明细在同一事务内写入；重复主键时尝试补全历史记录的 target。 */
	private insert(outcome: SearchOutcome, id: string): "inserted" | "existing" | "updated" {
		const facts = outcome.sources ?? factsOfSources(outcome.result?.sources ?? []);
		const sources = sourcesOf(id, facts);
		const record = recordOf(outcome, id, facts);
		this.db.exec("BEGIN IMMEDIATE");
		try {
			const { changes } = this.db.prepare(INSERT_OBSERVATION).run(
				record.id, record.at, record.kind, record.sessionId ?? null, record.target, record.vendor,
				record.protocol, record.query, record.ok ? 1 : 0, record.errorCode ?? null,
				record.errorMessage ?? null, record.durationMs, record.sourceCount, record.withTitle,
				record.withSnippet, record.withSummary, record.summaryChars, record.answerChars,
				record.truncated ? 1 : 0, record.answer ?? null
			);
			if (Number(changes) === 0) {
				/** 旧版本导入的历史记录可能只有 `historical`；新解析出的 target 用来补全它。 */
				const updated = outcome.target !== "historical"
					? this.db.prepare("UPDATE observations SET target = ?, vendor = ?, protocol = ? WHERE id = ? AND target = 'historical'").run(outcome.target, outcome.vendor, outcome.protocol, id)
					: { changes: 0 };
				if (Number(updated.changes) > 0) {
					this.db.exec("COMMIT");
					return "updated";
				}
				this.db.exec("ROLLBACK");
				return "existing";
			}
			const insertSource = this.db.prepare(INSERT_SOURCE);
			for (const source of sources) {
				insertSource.run(
					source.observationId, source.urlHash, source.host,
					source.hasTitle ? 1 : 0, source.hasSnippet ? 1 : 0, source.hasSummary ? 1 : 0,
					source.url ?? null, source.title ?? null, source.snippet ?? null, source.summary ?? null
				);
			}
			this.db.exec("COMMIT");
			return "inserted";
		} catch (error) {
			try {
				this.db.exec("ROLLBACK");
			} catch {
				// 事务可能已因连接问题回滚；保留原始失败原因。
			}
			throw error;
		}
	}

	/**
	 * 汇总指标；结果缓存 2 秒，写入与清空后失效。
	 *
	 * @param query - 范围、target 与是否包含测试记录。
	 * @returns summary 响应体。
	 * @throws {RangeError} `since` 无法解析时。
	 */
	summary(query: RangeQuery): ObservabilitySummary {
		/** 缓存键只用原始参数：计算后的时间边界每次都不同，用它会让缓存永不命中。 */
		const key = `${query.since ?? ""}|${query.until ?? ""}|${query.target ?? ""}|${query.includeTests === true}`;
		const cached = this.summaryCache;
		if (cached !== void 0 && cached.key === key && this.now() - cached.at < SUMMARY_CACHE_MS) return cached.value;
		const filter = rangeFilter(query, this.now());
		const value = summarize(this.rowsWhere([filter.sql], [...filter.params], "ASC", 0), filter.sinceMs, filter.untilMs);
		this.summaryCache = { key, at: this.now(), value };
		return value;
	}

	/**
	 * 明细分页：时间倒序，按页码取一页并返回筛选后的总数。
	 *
	 * @param query - 筛选与分页参数。
	 * @returns 当前页、总数与实际页码。
	 */
	records(query: RecordsQuery): RecordsPage {
		const filter = rangeFilter(query, this.now());
		const clauses = [filter.sql];
		const params: unknown[] = [...filter.params];
		if (query.status === "ok") clauses.push("ok = 1");
		if (query.status === "fail") clauses.push("ok = 0");
		if (query.query !== void 0 && query.query.length > 0) {
			clauses.push("instr(lower(query), lower(?)) > 0");
			params.push(query.query);
		}
		const pageSize = limitOf(query.limit);
		const total = this.countWhere(clauses, params);
		const lastPage = Math.max(1, Math.ceil(total / pageSize));
		const requested = typeof query.page === "number" && Number.isSafeInteger(query.page) ? query.page : 1;
		const page = Math.min(Math.max(requested, 1), lastPage);
		const rows = this.rowsWhere(clauses, params, "DESC", pageSize, (page - 1) * pageSize);
		const sources = this.sourcesOfIds(rows.map((row) => row.id));
		const records: ObservationRecordView[] = rows.map((row) => ({ ...recordFromRow(row), sources: sources.get(row.id) ?? [] }));
		return { records, total, page, pageSize };
	}

	/**
	 * 导出当前筛选范围内的记录。
	 *
	 * @param query - 格式与筛选。
	 * @returns 文件名、MIME 与正文。
	 */
	export(query: ExportQuery): { filename: string; contentType: string; body: string } {
		const filter = rangeFilter(query, this.now());
		const rows = this.rowsWhere([filter.sql], [...filter.params], "ASC", MAX_EXPORT_ROWS);
		const sources = this.sourcesOfIds(rows.map((row) => row.id));
		const views: ObservationRecordView[] = rows.map((row) => ({ ...recordFromRow(row), sources: sources.get(row.id) ?? [] }));
		return {
			filename: exportFileName(query.format, this.now()),
			contentType: contentTypeOf(query.format),
			body: serialize(views, query.format)
		};
	}

	/** 清空全部记录（来源明细级联删除）。 */
	clear(): number {
		const result = this.db.prepare("DELETE FROM observations").run();
		this.summaryCache = void 0;
		return Number(result.changes);
	}

	/** 关闭连接；失败只告警。 */
	close(): void {
		try {
			this.db.close();
		} catch (error) {
			this.warnOnce(`observation store close failed: ${describe(error)}`);
		}
	}

	/** 诊断只输出一次，避免写库故障刷屏。 */
	private warnOnce(message: string): void {
		if (this.warned) return;
		this.warned = true;
		this.warn?.(message);
	}

	/** 按条件读取观测行；`limit` 为 0 表示不限制，`offset` 用于分页。 */
	private rowsWhere(clauses: readonly string[], params: readonly unknown[], order: "ASC" | "DESC", limit: number, offset = 0): ObservationRow[] {
		const where = clauses.length > 0 ? `WHERE ${clauses.join(" AND ")}` : "";
		const tail = limit > 0 ? " LIMIT ? OFFSET ?" : "";
		const sql = `SELECT ${ROW_COLUMNS} FROM observations ${where} ORDER BY at ${order}, id ${order}${tail}`;
		const args = limit > 0 ? [...params, limit, offset] : [...params];
		return this.db.prepare(sql).all(...args) as ObservationRow[];
	}

	/** 与 {@link rowsWhere} 相同的筛选条件，返回记录总数。 */
	private countWhere(clauses: readonly string[], params: readonly unknown[]): number {
		const where = clauses.length > 0 ? `WHERE ${clauses.join(" AND ")}` : "";
		const row = this.db.prepare(`SELECT COUNT(*) AS total FROM observations ${where}`).get(...params) as { total?: number } | undefined;
		return Number(row?.total ?? 0);
	}

	/** 一次查询取回一页记录的全部来源明细，按 observation_id 分组。 */
	private sourcesOfIds(ids: readonly string[]): Map<string, ObservationSource[]> {
		const grouped = new Map<string, ObservationSource[]>();
		if (ids.length === 0) return grouped;
		const placeholders = ids.map(() => "?").join(", ");
		const rows = this.db.prepare(`SELECT observation_id, url_hash, host, has_title, has_snippet, has_summary, url, title, snippet, summary FROM observation_sources WHERE observation_id IN (${placeholders}) ORDER BY rowid`).all(...ids) as Record<string, unknown>[];
		for (const row of rows) {
			const source = sourceFromRow(row);
			const list = grouped.get(source.observationId);
			if (list === void 0) grouped.set(source.observationId, [source]);
			else list.push(source);
		}
		return grouped;
	}
}
