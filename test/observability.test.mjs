/**
 * 观测层契约：写入、聚合对账、明细分页、导出、清空、写入隔离、端点与保留策略。
 *
 * 直接打开临时 SQLite 文件，不经过插件装配，便于精确控制时间与记录内容。
 */
import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { mkdirSync, mkdtempSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { zstdCompressSync } from "node:zlib";
import { after, describe, it } from "node:test";
import {
	DiySearchProvider,
	ObservationStore,
	openObservationDatabase,
	registerConfigEndpoint,
	registerObservabilityEndpoints,
	resolveOptions,
	resolveRange,
	importHistorical
} from "../lib/index.js";

const HOUR = 3_600_000;

/** 一个临时目录，测试结束后整体删除。 */
function tempDir() {
	return mkdtempSync(join(tmpdir(), "dsh-web-search-diy-obs-"));
}

/** One observation with a source list; override any field. */
function outcome(overrides = {}) {
	return {
		kind: "search",
		target: "deepseek/search",
		vendor: "deepseek",
		protocol: "search",
		query: "测试查询",
		startedAt: new Date().toISOString(),
		durationMs: 1000,
		ok: true,
		result: {
			content: "答案正文",
			sources: [{ url: "https://a.example/x", title: "A", snippet: "snip", summary: "long body" }],
			truncated: false
		},
		...overrides
	};
}

/** An open store on a fresh database with an injectable clock. */
function storeWithClock(clock = { now: Date.now() }) {
	const dir = tempDir();
	const store = ObservationStore.open({ path: join(dir, "observations.db"), now: () => clock.now });
	return { store, dir, clock };
}

describe("observation store", () => {
	it("writes a search and its sources in one transaction", () => {
		const { store, dir } = storeWithClock();
		try {
			store.record(outcome());
			const page = store.records({});
			assert.equal(page.records.length, 1);
			assert.equal(page.records[0].sourceCount, 1);
			assert.equal(page.records[0].withTitle, 1);
			assert.equal(page.records[0].withSnippet, 1);
			assert.equal(page.records[0].withSummary, 1);
			assert.equal(page.records[0].answerChars, 4);
			assert.equal(page.records[0].answer, "答案正文", "the answer text is stored for the record page");
			assert.equal(page.records[0].sources.length, 1);
			assert.equal(page.records[0].sources[0].host, "a.example");
			assert.equal(page.records[0].sources[0].url, "https://a.example/x");
			assert.equal(page.records[0].sources[0].title, "A");
			assert.equal(page.records[0].sources[0].snippet, "snip");
			assert.equal(page.records[0].sources[0].summary, "long body");
			assert.match(page.records[0].sources[0].urlHash, /^[0-9a-f]{16}$/u);
		} finally {
			store.close();
			rmSync(dir, { recursive: true, force: true });
		}
	});

	it("aggregates counts, success rate, percentiles and coverage from raw rows", () => {
		const clock = { now: Date.parse("2026-10-31T12:00:00.000Z") };
		const { store, dir } = storeWithClock(clock);
		try {
			const at = (hoursAgo) => new Date(clock.now - hoursAgo * HOUR).toISOString();
			store.record(outcome({ startedAt: at(3), durationMs: 100, result: { sources: [{ url: "https://a.example/1", title: "A", summary: "x" }], truncated: false } }));
			store.record(outcome({ startedAt: at(2), durationMs: 200, result: { sources: [{ url: "https://b.example/1", snippet: "s" }], truncated: false } }));
			store.record(outcome({ startedAt: at(1), durationMs: 300, target: "zhipu/search", ok: false, errorCode: "WEB_PROVIDER_RATE_LIMIT", errorMessage: "HTTP 429", result: void 0 }));
			const summary = store.summary({});
			assert.equal(summary.totals.count, 3);
			assert.equal(summary.totals.successRate, 2 / 3);
			assert.equal(summary.totals.p50, 200);
			assert.equal(summary.totals.p95, 290, "linear interpolation between 200 and 300");
			assert.equal(summary.totals.avgSources, 0.7, "two sources over three searches, to one decimal");
			assert.equal(summary.totals.summaryCoverage, 1 / 2, "one summary of two sources");
			assert.equal(summary.totals.errorCount, 1);
			assert.deepEqual(summary.byTarget.map((target) => target.target), ["deepseek/search", "zhipu/search"]);
			assert.equal(summary.byTarget[1].errorCount, 1);
			assert.deepEqual(summary.topErrors.map((error) => error.code), ["WEB_PROVIDER_RATE_LIMIT"]);
			assert.equal(summary.topErrors[0].lastMessage, "HTTP 429");
			assert.ok(summary.byBucket.length >= 12, "today is bucketed by hour");
			assert.ok(summary.byBucket.some((bucket) => bucket.count > 0));
		} finally {
			store.close();
			rmSync(dir, { recursive: true, force: true });
		}
	});

	it("returns an empty summary when there are no records", () => {
		const { store, dir } = storeWithClock();
		try {
			const summary = store.summary({});
			assert.equal(summary.totals.count, 0);
			assert.equal(summary.totals.summaryCoverage, null);
			assert.deepEqual(summary.byTarget, []);
			assert.deepEqual(summary.topErrors, []);
		} finally {
			store.close();
			rmSync(dir, { recursive: true, force: true });
		}
	});

	it("filters records by target, status, query and paginates by page number", () => {
		const clock = { now: Date.parse("2026-10-31T12:00:00.000Z") };
		const { store, dir } = storeWithClock(clock);
		try {
			const at = (hoursAgo) => new Date(clock.now - hoursAgo * HOUR).toISOString();
			store.record(outcome({ startedAt: at(3), query: "DeepSeek API" }));
			store.record(outcome({ startedAt: at(2), query: "GLM 最新版本", target: "zhipu/search", vendor: "zhipu" }));
			store.record(outcome({ startedAt: at(1), query: "失败查询", ok: false, errorCode: "WEB_PROVIDER_NETWORK" }));
			assert.equal(store.records({ target: "zhipu/search" }).records.length, 1);
			assert.equal(store.records({ status: "fail" }).records.length, 1);
			assert.equal(store.records({ query: "deepseek" }).records.length, 1, "query filtering ignores case");
			const first = store.records({ limit: 2 });
			assert.equal(first.records.length, 2);
			assert.equal(first.records[0].query, "失败查询", "records come newest first");
			assert.equal(first.total, 3);
			assert.equal(first.page, 1);
			assert.equal(first.pageSize, 2);
			const second = store.records({ limit: 2, page: 2 });
			assert.equal(second.records.length, 1);
			assert.equal(second.page, 2);
			assert.equal(second.total, 3);
			/** 超出范围的页码夹紧到最后一页，而不是返回空页。 */
			const clamped = store.records({ limit: 2, page: 99 });
			assert.equal(clamped.page, 2);
			assert.equal(clamped.records.length, 1);
		} finally {
			store.close();
			rmSync(dir, { recursive: true, force: true });
		}
	});

	it("exports JSONL and CSV within the selected range", () => {
		const { store, dir } = storeWithClock();
		try {
			store.record(outcome({ query: "带,逗号" }));
			const jsonl = store.export({ format: "jsonl" });
			const lines = jsonl.body.trim().split("\n");
			assert.equal(lines.length, 1);
			const record = JSON.parse(lines[0]);
			assert.equal(record.query, "带,逗号");
			assert.equal(record.sources.length, 1);
			assert.equal(record.answer, "答案正文");
			assert.equal(record.sources[0].title, "A");
			assert.equal(record.sources[0].url, "https://a.example/x");
			assert.match(jsonl.filename, /^web-search-diy-observations-\d{4}-\d{2}-\d{2}\.jsonl$/u);
			const csv = store.export({ format: "csv" });
			const rows = csv.body.trim().split("\r\n");
			assert.equal(rows.length, 2, "one header plus one record");
			assert.match(rows[0], /^id,at,kind,/u);
			assert.match(rows[1], /"带,逗号"/u, "commas are quoted");
		} finally {
			store.close();
			rmSync(dir, { recursive: true, force: true });
		}
	});

	it("clears every record and cascades the source rows", () => {
		const { store, dir } = storeWithClock();
		try {
			store.record(outcome());
			assert.equal(store.clear(), 1);
			assert.equal(store.records({}).records.length, 0);
			assert.equal(store.summary({}).totals.count, 0);
		} finally {
			store.close();
			rmSync(dir, { recursive: true, force: true });
		}
	});

	it("never throws when the connection is closed", () => {
		const messages = [];
		const dir = tempDir();
		const store = ObservationStore.open({ path: join(dir, "observations.db"), warn: (message) => messages.push(message) });
		try {
			store.close();
			store.record(outcome());
			store.record(outcome());
			assert.equal(messages.length, 1, "a broken store warns once, not once per search");
			assert.match(messages[0], /observation write failed/u);
		} finally {
			rmSync(dir, { recursive: true, force: true });
		}
	});

	it("keeps the database and its directory private", () => {
		const { store, dir } = storeWithClock();
		try {
			const file = join(dir, "observations.db");
			assert.equal(statSync(file).mode & 0o777, 0o600);
			assert.equal(statSync(dir).mode & 0o777, 0o700);
		} finally {
			store.close();
			rmSync(dir, { recursive: true, force: true });
		}
	});
});

describe("observation retention", () => {
	it("keeps old records on open; only the row cap trims", () => {
		const dir = tempDir();
		const path = join(dir, "observations.db");
		const clock = { now: Date.parse("2026-10-31T12:00:00.000Z") };
		const store = ObservationStore.open({ path, now: () => clock.now });
		try {
			store.record(outcome({ startedAt: new Date(clock.now - 200 * 24 * HOUR).toISOString() }));
			store.record(outcome({ startedAt: new Date(clock.now).toISOString() }));
			store.close();
			/** 历史导入可能早于任何时间窗口，打开数据库不应按时间删除。 */
			const reopened = openObservationDatabase(path);
			reopened.close();
			const again = ObservationStore.open({ path, now: () => clock.now });
			try {
				assert.equal(again.summary({ since: "all" }).totals.count, 2);
			} finally {
				again.close();
			}
		} finally {
			rmSync(dir, { recursive: true, force: true });
		}
	});
});

describe("observability endpoints", () => {
	/** Minimal request double carrying a method, url and optional JSON body. */
	function fakeRequest(method, url, body) {
		const req = new EventEmitter();
		req.method = method;
		req.url = url;
		if (body !== void 0) {
			const payload = JSON.stringify(body);
			process.nextTick(() => {
				req.emit("data", payload);
				req.emit("end");
			});
		}
		return req;
	}

	/** Minimal response double capturing status, headers and payload. */
	function fakeResponse() {
		return {
			status: 0,
			headers: {},
			payload: "",
			writeHead(status, headers) {
				this.status = status;
				this.headers = headers ?? {};
			},
			end(payload) {
				this.payload = payload;
			}
		};
	}

	/** Register the four routes against a fake server and return a caller. */
	function endpoints(store, importRunner) {
		const handlers = new Map();
		const webServer = { register(entry) { handlers.set(entry.path, entry.handler); return () => {}; } };
		registerObservabilityEndpoints(store, webServer, importRunner);
		return async (method, url, body) => {
			const path = url.split("?")[0];
			const handler = handlers.get(path);
			if (handler === void 0) throw new Error(`no route for ${path}`);
			const response = fakeResponse();
			await handler(fakeRequest(method, url, body), response);
			return response;
		};
	}

	it("serves summary, paginated records, exports and a confirmed clear", async () => {
		const { store, dir } = storeWithClock();
		try {
			store.record(outcome());
			const call = endpoints(store);
			const summary = await call("GET", "/api/web-search-diy/observability/summary?since=today");
			assert.equal(summary.status, 200);
			assert.equal(JSON.parse(summary.payload).totals.count, 1);

			const records = await call("GET", "/api/web-search-diy/observability/records?limit=10&target=deepseek%2Fsearch");
			assert.equal(records.status, 200);
			assert.equal(JSON.parse(records.payload).records.length, 1);

			const exported = await call("GET", "/api/web-search-diy/observability/export?format=jsonl");
			assert.equal(exported.status, 200);
			assert.match(exported.headers["Content-Type"], /ndjson/u);
			assert.match(exported.headers["Content-Disposition"], /attachment; filename="web-search-diy-observations-/u);

			const rejected = await call("DELETE", "/api/web-search-diy/observability/records", { confirm: "nope" });
			assert.equal(rejected.status, 400);
			const cleared = await call("DELETE", "/api/web-search-diy/observability/records", { confirm: "DELETE" });
			assert.equal(cleared.status, 200);
			assert.equal(JSON.parse(cleared.payload).deleted, 1);
		} finally {
			store.close();
			rmSync(dir, { recursive: true, force: true });
		}
	});

	it("accepts an older import window and forwards both boundaries", async () => {
		const { store, dir } = storeWithClock();
		try {
			const received = [];
			const call = endpoints(store, async (sinceMs, untilMs) => {
				received.push({ sinceMs, untilMs });
				return { sessions: 0, calls: 0, imported: 0, skipped: 0, failed: 0, filtered: 0, identified: 0, updated: 0 };
			});
			const response = await call("POST", "/api/web-search-diy/observability/import", {
				since: "2026-01-01T00:00:00.000Z",
				until: "2026-10-01T00:00:00.000Z"
			});
			assert.equal(response.status, 200);
			assert.equal(received.length, 1);
			assert.equal(received[0].sinceMs, Date.parse("2026-01-01T00:00:00.000Z"));
			assert.equal(received[0].untilMs, Date.parse("2026-10-01T00:00:00.000Z"));
			const reversed = await call("POST", "/api/web-search-diy/observability/import", {
				since: "2026-10-01T00:00:00.000Z",
				until: "2026-09-01T00:00:00.000Z"
			});
			assert.equal(reversed.status, 400);
		} finally {
			store.close();
			rmSync(dir, { recursive: true, force: true });
		}
	});

	it("rejects bad ranges and formats with 400", async () => {
		const { store, dir } = storeWithClock();
		try {
			const call = endpoints(store);
			assert.equal((await call("GET", "/api/web-search-diy/observability/summary?since=yesterday")).status, 400);
			assert.equal((await call("GET", "/api/web-search-diy/observability/records?until=not-a-date")).status, 400);
			assert.equal((await call("GET", "/api/web-search-diy/observability/records?since=2026-10-31T00:00:00.000Z&until=2026-10-30T00:00:00.000Z")).status, 400);
			assert.equal((await call("GET", "/api/web-search-diy/observability/export?format=xml")).status, 400);
		} finally {
			store.close();
			rmSync(dir, { recursive: true, force: true });
		}
	});
});

describe("provider capture", () => {
	const providerCtx = { get: (name) => name === "credentials" ? { resolve: async () => ({ value: "sk-test" }) } : void 0 };
	const options = resolveOptions(providerCtx, { version: 3, targets: {} }, "deepseek/search");

	/** Run one search with an injected sink; restores fetch afterwards. */
	async function run(fetchImpl, sink, signal) {
		const original = globalThis.fetch;
		globalThis.fetch = fetchImpl;
		try {
			return await new DiySearchProvider(() => options, {
				onOutcome: sink,
				sessionId: () => "sess-1",
				kind: "search"
			}).search({ query: "测试查询" }, signal);
		} finally {
			globalThis.fetch = original;
		}
	}

	it("reports a successful search with its session and result", async () => {
		const outcomes = [];
		await run(async () => new Response(JSON.stringify({
			results: [{ url: "https://a.example/1", title: "A", snippet: "S" }]
		}), { status: 200, headers: { "content-type": "application/json" } }), (outcome) => outcomes.push(outcome));
		assert.equal(outcomes.length, 1);
		assert.equal(outcomes[0].kind, "search");
		assert.equal(outcomes[0].sessionId, "sess-1");
		assert.equal(outcomes[0].ok, true);
		assert.equal(outcomes[0].target, "deepseek/search");
		assert.match(outcomes[0].startedAt, /^\d{4}-\d{2}-\d{2}T/u);
	});

	it("reports a failed search with its classified code", async () => {
		const outcomes = [];
		await assert.rejects(run(
			async () => new Response(JSON.stringify({ error: "boom" }), { status: 500, headers: { "content-type": "application/json" } }),
			(outcome) => outcomes.push(outcome)
		));
		assert.equal(outcomes[0].ok, false);
		assert.equal(outcomes[0].errorCode, "WEB_PROVIDER_SERVER");
	});

	it("reports caller cancellation as WEB_ABORTED", async () => {
		const outcomes = [];
		const controller = new AbortController();
		controller.abort();
		await assert.rejects(run(async () => new Response("{}", { status: 200 }), (outcome) => outcomes.push(outcome), controller.signal));
		assert.equal(outcomes[0].errorCode, "WEB_ABORTED");
	});

	it("still returns a successful search when the sink throws", async () => {
		const result = await run(
			async () => new Response(JSON.stringify({ results: [{ url: "https://a.example/1" }] }), { status: 200, headers: { "content-type": "application/json" } }),
			() => { throw new Error("sink exploded"); }
		);
		assert.equal(result.sources.length, 1);
	});
});

describe("capture points", () => {
	/** A config-endpoint context with a resolvable credential. */
	function configContext() {
		return {
			get: (name) => name === "credentials" ? { resolve: async () => ({ value: "sk-test" }), set: async () => {} } : void 0,
			inject() {},
			web: { registerSearchProvider() {} },
			effect(fn) { fn(); }
		};
	}

	/** Register /test and return a caller plus the captured outcomes. */
	function testEndpoint(onOutcome) {
		const handlers = new Map();
		const webServer = { register(entry) { handlers.set(entry.path, entry.handler); return () => {}; } };
		registerConfigEndpoint(configContext(), webServer, onOutcome);
		return async (body) => {
			const req = new EventEmitter();
			req.method = "POST";
			const payload = JSON.stringify(body);
			process.nextTick(() => {
				req.emit("data", payload);
				req.emit("end");
			});
			const response = {
				status: 0,
				payload: "",
				writeHead(status) { this.status = status; },
				end(payload) { this.payload = payload; }
			};
			await handlers.get("/api/web-search-diy/test")(req, response);
			return { status: response.status, body: JSON.parse(response.payload) };
		};
	}

	it("records a successful test connection as kind=test", async () => {
		const outcomes = [];
		const original = globalThis.fetch;
		globalThis.fetch = async () => new Response(JSON.stringify({
			results: [{ url: "https://a.example/1", title: "A", snippet: "S", content: "body" }]
		}), { status: 200, headers: { "content-type": "application/json" } });
		try {
			const call = testEndpoint((outcome) => outcomes.push(outcome));
			const response = await call({ vendor: "deepseek", protocol: "search" });
			assert.equal(response.status, 200);
			assert.equal(response.body.ok, true);
			assert.equal(outcomes.length, 1);
			assert.equal(outcomes[0].kind, "test");
			assert.equal(outcomes[0].target, "deepseek/search");
			assert.equal(outcomes[0].ok, true);
			assert.equal(outcomes[0].result.sources.length, 1);
		} finally {
			globalThis.fetch = original;
		}
	});

	it("records a failed test connection with classified error codes", async () => {
		const outcomes = [];
		const original = globalThis.fetch;
		globalThis.fetch = async () => new Response(JSON.stringify({ error: "denied" }), { status: 401, headers: { "content-type": "application/json" } });
		try {
			const call = testEndpoint((outcome) => outcomes.push(outcome));
			await call({ vendor: "deepseek", protocol: "search" });
			assert.equal(outcomes[0].ok, false);
			assert.equal(outcomes[0].errorCode, "WEB_PROVIDER_AUTH");
			assert.match(outcomes[0].errorMessage, /HTTP 401/u);
		} finally {
			globalThis.fetch = original;
		}
	});

	it("honors a draft requestTimeoutMs on the test path", async () => {
		const outcomes = [];
		const original = globalThis.fetch;
		globalThis.fetch = async (_url, init) => new Promise((_resolve, reject) => {
			const signal = init?.signal;
			if (signal === void 0) return;
			if (signal.aborted) return reject(signal.reason);
			signal.addEventListener("abort", () => reject(signal.reason), { once: true });
		});
		try {
			const call = testEndpoint((outcome) => outcomes.push(outcome));
			await call({ vendor: "deepseek", protocol: "search", requestTimeoutMs: 50 });
			assert.equal(outcomes.length, 1);
			assert.equal(outcomes[0].errorCode, "WEB_PROVIDER_TIMEOUT");
			assert.equal(outcomes[0].kind, "test");
		} finally {
			globalThis.fetch = original;
		}
	});
});

describe("schema migration", () => {
	it("upgrades a v1 database and keeps old rows readable", () => {
		const dir = tempDir();
		const path = join(dir, "observations.db");
		const { DatabaseSync } = process.getBuiltinModule("node:sqlite");
		const db = new DatabaseSync(path);
		db.exec(`
			CREATE TABLE observations (
				id TEXT PRIMARY KEY, at TEXT NOT NULL, kind TEXT NOT NULL, session_id TEXT,
				target TEXT NOT NULL, vendor TEXT NOT NULL, protocol TEXT NOT NULL, query TEXT NOT NULL,
				ok INTEGER NOT NULL, error_code TEXT, error_message TEXT, duration_ms INTEGER NOT NULL,
				source_count INTEGER NOT NULL, with_title INTEGER NOT NULL, with_snippet INTEGER NOT NULL,
				with_summary INTEGER NOT NULL, summary_chars INTEGER NOT NULL, answer_chars INTEGER NOT NULL,
				truncated INTEGER NOT NULL
			);
			CREATE TABLE observation_sources (
				observation_id TEXT NOT NULL REFERENCES observations(id) ON DELETE CASCADE,
				url_hash TEXT NOT NULL, host TEXT NOT NULL, has_title INTEGER NOT NULL,
				has_snippet INTEGER NOT NULL, has_summary INTEGER NOT NULL,
				PRIMARY KEY (observation_id, url_hash)
			);
			PRAGMA user_version = 1;
		`);
		db.prepare(`INSERT INTO observations (id, at, kind, target, vendor, protocol, query, ok, duration_ms, source_count, with_title, with_snippet, with_summary, summary_chars, answer_chars, truncated) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
			.run("old-1", "2026-10-01T00:00:00.000Z", "search", "deepseek/search", "deepseek", "search", "旧记录", 1, 100, 1, 1, 1, 0, 0, 0, 0);
		db.prepare("INSERT INTO observation_sources (observation_id, url_hash, host, has_title, has_snippet, has_summary) VALUES (?, ?, ?, ?, ?, ?)")
			.run("old-1", "0123456789abcdef", "old.example", 1, 1, 0);
		db.close();
		const store = ObservationStore.open({ path });
		try {
			const page = store.records({ since: "all" });
			assert.equal(page.records.length, 1);
			assert.equal(page.records[0].query, "旧记录");
			assert.equal(page.records[0].answer, void 0, "v1 rows have no answer text");
			assert.equal(page.records[0].sources[0].host, "old.example");
			assert.equal(page.records[0].sources[0].url, void 0, "v1 sources have no URL column");
			assert.equal(page.records[0].sources[0].title, void 0);
		} finally {
			store.close();
			rmSync(dir, { recursive: true, force: true });
		}
	});
});

describe("historical import", () => {
	it("imports web_search calls from session logs and stays idempotent", async () => {
		const dir = tempDir();
		const previous = process.env.DSH_HOME;
		process.env.DSH_HOME = dir;
		const sessionDir = join(dir, "sessions", "project", "session-abc");
		mkdirSync(sessionDir, { recursive: true });
		const callTime = Date.parse("2026-10-30T18:57:38.947Z");
		const events = [
			{ type: "tool/call", seq: 21, time: callTime, data: { name: "web_search", callId: "c1", arguments: JSON.stringify({ queries: ["历史查询一", "历史查询二"] }) } },
			{
				type: "tool/result", seq: 22, time: callTime + 500,
				data: {
					message: { toolCallId: "c1", isError: false, content: [{ type: "text", text: "fallback text" }] },
					meta: { sources: [{ url: "https://old.example/1", title: "旧标题", snippet: "旧摘要" }], answer: "历史答案", truncated: false }
				}
			}
		];
		writeFileSync(join(sessionDir, "session.v4.jsonl.zstd"), zstdCompressSync(events.map((event) => JSON.stringify(event)).join("\n")));
		const store = ObservationStore.open({ path: join(dir, "observations.db") });
		try {
			const first = await importHistorical(store);
			assert.deepEqual(first, { sessions: 1, calls: 1, imported: 1, skipped: 0, failed: 0, filtered: 0, identified: 0, updated: 0 });
			const page = store.records({ since: "all" });
			assert.equal(page.records.length, 1);
			const record = page.records[0];
			assert.equal(record.target, "historical");
			assert.equal(record.query, "历史查询一 | 历史查询二");
			assert.equal(record.answer, "历史答案");
			assert.equal(record.sessionId, "abc");
			assert.equal(record.durationMs, 500);
			assert.equal(record.sources[0].title, "旧标题");
			assert.equal(record.sources[0].url, "https://old.example/1");
			assert.equal(record.sources[0].snippet, "旧摘要");
			const second = await importHistorical(store);
			assert.equal(second.imported, 0, "a re-run does not duplicate the record");
			assert.equal(second.skipped, 1);
			/** 独立的导入范围：起点晚于调用时间时，整条调用被过滤。 */
			const filtered = await importHistorical(store, { sinceMs: callTime + 1 });
			assert.equal(filtered.imported, 0);
			assert.equal(filtered.filtered, 1);
			assert.equal(filtered.calls, 0);
			/** 结束时间早于调用时间时同样被过滤。 */
			const filteredUntil = await importHistorical(store, { untilMs: callTime - 1 });
			assert.equal(filteredUntil.imported, 0);
			assert.equal(filteredUntil.filtered, 1);
			assert.equal(filteredUntil.calls, 0);
		} finally {
			store.close();
			if (previous === void 0) delete process.env.DSH_HOME;
			else process.env.DSH_HOME = previous;
			rmSync(dir, { recursive: true, force: true });
		}
	});
});

	it("backfills the target from the outbound request event on a re-import", async () => {
		const dir = tempDir();
		const previous = process.env.DSH_HOME;
		process.env.DSH_HOME = dir;
		const sessionDir = join(dir, "sessions", "project", "session-def");
		mkdirSync(sessionDir, { recursive: true });
		const callTime = Date.parse("2026-10-29T10:00:00.000Z");
		const base = [
			{ type: "tool/call", seq: 10, time: callTime, data: { name: "web_search", callId: "c9", arguments: JSON.stringify({ queries: ["历史查询"] }) } }
		];
		const result = {
			type: "tool/result", seq: 12, time: callTime + 800,
			data: {
				message: { toolCallId: "c9", isError: false, content: [{ type: "text", text: "fallback" }] },
				meta: { sources: [{ url: "https://old.example/2", title: "旧标题二", snippet: "旧摘要二" }], answer: "历史答案二", truncated: false }
			}
		};
		const write = (events) => writeFileSync(join(sessionDir, "session.v4.jsonl.zstd"), zstdCompressSync(events.map((event) => JSON.stringify(event)).join("\n")));
		const store = ObservationStore.open({ path: join(dir, "observations.db") });
		try {
			write([...base, result]);
			const first = await importHistorical(store);
			assert.equal(first.imported, 1);
			assert.equal(first.identified, 0);
			assert.equal(store.records({ since: "all" }).records[0].target, "historical");
			/** 同一调用再出现时带上出站请求事件：补全 target，而不是新增一条。 */
			const request = { type: "web/deepseek-search-llm-request", seq: 11, time: callTime + 100, data: { endpoint: "https://api.deepseek.com/anthropic/v1/messages", apiVersion: "2023-06-01", body: {} } };
			write([...base, request, result]);
			const second = await importHistorical(store);
			assert.equal(second.imported, 0);
			assert.equal(second.updated, 1);
			assert.equal(second.identified, 1);
			const record = store.records({ since: "all" }).records[0];
			assert.equal(record.target, "deepseek/anthropic-messages");
			assert.equal(record.vendor, "deepseek");
			assert.equal(record.protocol, "anthropic-messages");
		} finally {
			store.close();
			if (previous === void 0) delete process.env.DSH_HOME;
			else process.env.DSH_HOME = previous;
			rmSync(dir, { recursive: true, force: true });
		}
	});

describe("historical import target hints", () => {
	it("uses the target recorded on the request event when the endpoint is not a catalog default", async () => {
		const dir = tempDir();
		const previous = process.env.DSH_HOME;
		process.env.DSH_HOME = dir;
		const sessionDir = join(dir, "sessions", "project", "session-ghi");
		mkdirSync(sessionDir, { recursive: true });
		const callTime = Date.parse("2026-10-31T13:16:03.089Z");
		const events = [
			{ type: "tool/call", seq: 10, time: callTime, data: { name: "web_search", callId: "c3", arguments: JSON.stringify({ queries: ["历史查询三"] }) } },
			/** 用户改过 baseURL 时端点不在 catalog 里，事件上的 target 才是可靠来源。 */
			{ type: "web/deepseek-search-llm-request", seq: 11, time: callTime + 100, data: { endpoint: "https://proxy.example/v1/responses", target: "qwen/responses", body: {} } },
			{
				type: "tool/result", seq: 12, time: callTime + 900,
				data: {
					message: { toolCallId: "c3", isError: false, content: [{ type: "text", text: "fallback" }] },
					meta: { sources: [{ url: "https://old.example/3", title: "旧标题三", snippet: "旧摘要三" }], answer: "历史答案三", truncated: false }
				}
			}
		];
		writeFileSync(join(sessionDir, "session.v4.jsonl.zstd"), zstdCompressSync(events.map((event) => JSON.stringify(event)).join("\n")));
		const store = ObservationStore.open({ path: join(dir, "observations.db") });
		try {
			const result = await importHistorical(store);
			assert.equal(result.imported, 1);
			assert.equal(result.identified, 1);
			const record = store.records({ since: "all" }).records[0];
			assert.equal(record.target, "qwen/responses");
			assert.equal(record.vendor, "qwen");
			assert.equal(record.protocol, "responses");
		} finally {
			store.close();
			if (previous === void 0) delete process.env.DSH_HOME;
			else process.env.DSH_HOME = previous;
			rmSync(dir, { recursive: true, force: true });
		}
	});
});

describe("range parsing", () => {
	it("resolves relative presets, natural-day presets and ISO timestamps", () => {
		const now = new Date(2026, 9, 31, 12, 0, 0).getTime();
		const today = new Date(2026, 9, 31).getTime();
		const day = new Date(now).getDay();
		const weekOffset = day === 0 ? 6 : day - 1;
		assert.equal(resolveRange(void 0, now).sinceMs, now - 24 * HOUR, "no range defaults to 24h");
		assert.equal(resolveRange("24h", now).sinceMs, now - 24 * HOUR);
		assert.equal(resolveRange("7d", now).sinceMs, now - 7 * 24 * HOUR);
		assert.equal(resolveRange("30d", now).sinceMs, now - 30 * 24 * HOUR);
		assert.equal(resolveRange("today", now).sinceMs, today);
		assert.equal(resolveRange("week", now).sinceMs, new Date(2026, 9, 31 - weekOffset).getTime());
		assert.equal(resolveRange("month", now).sinceMs, new Date(2026, 9, 1).getTime());
		assert.equal(resolveRange("quarter", now).sinceMs, new Date(2026, 9, 1).getTime());
		assert.equal(resolveRange("year", now).sinceMs, new Date(2026, 0, 1).getTime());
		assert.equal(resolveRange("all", now).sinceMs, 0);
		assert.equal(resolveRange("2026-10-01T00:00:00.000Z", now).sinceMs, Date.parse("2026-10-01T00:00:00.000Z"));
		assert.throws(() => resolveRange("yesterday", now), /无法解析/u);
	});

	it("honors an explicit until boundary", () => {
		const now = new Date(2026, 9, 31, 12, 0, 0).getTime();
		const since = "2026-10-01T00:00:00.000Z";
		const until = "2026-10-15T23:59:59.999Z";
		const range = resolveRange(since, now, until);
		assert.equal(range.sinceMs, Date.parse(since));
		assert.equal(range.untilMs, Date.parse(until));
		assert.equal(resolveRange("30d", now, until).untilMs, Date.parse(until));
		assert.throws(() => resolveRange("2026-10-20T00:00:00.000Z", now, until), /结束时间必须晚于开始时间/u);
		assert.throws(() => resolveRange(since, now, "not-a-date"), /无法解析的结束时间/u);
	});
});
