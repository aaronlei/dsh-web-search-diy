/**
 * 传输层契约：HTTP 状态分层、网络失败与本地请求超时的错误码。
 *
 * 400 必须保持 `WEB_PROVIDER_ERROR`，reasoning 参数降级依赖这个 code 加措辞判断。
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { WebError } from "@deepseek-ai/dsh-web";
import { DiySearchProvider, httpErrorCode, resolveOptions } from "../lib/index.js";

const ctx = { get: (name) => name === "credentials" ? { resolve: async () => ({ value: "sk-test" }) } : void 0 };

/** Resolve one target's options with a fresh document. */
function optionsFor(target, bucket = {}) {
	return resolveOptions(ctx, { version: 3, targets: { [target]: bucket } }, target);
}

/** One search against a scripted fetch; restores the global afterwards. */
async function searchWith(options, fetchImpl, signal) {
	const original = globalThis.fetch;
	globalThis.fetch = fetchImpl;
	try {
		return await new DiySearchProvider(() => options).search({ query: "测试查询" }, signal);
	} finally {
		globalThis.fetch = original;
	}
}

/** A fetch that answers with one HTTP status and a JSON error body. */
function statusFetch(status) {
	return async () => new Response(JSON.stringify({ error: "denied", message: "denied" }), { status, headers: { "content-type": "application/json" } });
}

/** A fetch that never settles until its request signal aborts. */
function hangingFetch() {
	return async (_url, init) => new Promise((_resolve, reject) => {
		const signal = init?.signal;
		if (signal === void 0) return;
		if (signal.aborted) return reject(signal.reason);
		signal.addEventListener("abort", () => reject(signal.reason), { once: true });
	});
}

describe("HTTP error classification", () => {
	const cases = [
		[401, "WEB_PROVIDER_AUTH"],
		[403, "WEB_PROVIDER_AUTH"],
		[429, "WEB_PROVIDER_RATE_LIMIT"],
		[500, "WEB_PROVIDER_SERVER"],
		[503, "WEB_PROVIDER_SERVER"],
		[408, "WEB_PROVIDER_TIMEOUT"],
		[504, "WEB_PROVIDER_TIMEOUT"],
		[404, "WEB_PROVIDER_REQUEST"],
		[422, "WEB_PROVIDER_REQUEST"],
		[400, "WEB_PROVIDER_ERROR"]
	];
	for (const [status, code] of cases) {
		it(`maps HTTP ${status} to ${code}`, async () => {
			assert.equal(httpErrorCode(status), code);
			await assert.rejects(
				searchWith(optionsFor("deepseek/search"), statusFetch(status)),
				(error) => error instanceof WebError && error.code === code
			);
		});
	}

	it("keeps the status and endpoint detail in the message", async () => {
		await assert.rejects(
			searchWith(optionsFor("deepseek/search"), statusFetch(429)),
			(error) => /HTTP 429/u.test(error.message) && /denied/u.test(error.message)
		);
	});

	it("maps a transport failure to WEB_PROVIDER_NETWORK", async () => {
		await assert.rejects(
			searchWith(optionsFor("deepseek/search"), async () => { throw new TypeError("fetch failed"); }),
			(error) => error instanceof WebError && error.code === "WEB_PROVIDER_NETWORK"
		);
	});
});

describe("request timeout", () => {
	it("fails with WEB_PROVIDER_TIMEOUT when the local timer fires", async () => {
		const options = optionsFor("deepseek/search", { requestTimeoutMs: 50 });
		const started = Date.now();
		await assert.rejects(
			searchWith(options, hangingFetch()),
			(error) => error instanceof WebError && error.code === "WEB_PROVIDER_TIMEOUT" && /50ms/u.test(error.message)
		);
		assert.ok(Date.now() - started < 2_000, "the local timeout must fire without waiting for the tool budget");
	});

	it("reports caller cancellation as WEB_ABORTED, not a timeout", async () => {
		const controller = new AbortController();
		controller.abort(new Error("caller cancelled"));
		await assert.rejects(
			searchWith(optionsFor("deepseek/search"), hangingFetch(), controller.signal),
			(error) => error instanceof WebError && error.code === "WEB_ABORTED"
		);
	});

	it("does not time out a request that settles first", async () => {
		const body = { results: [{ url: "https://a.example/1", title: "A", snippet: "S" }] };
		const result = await searchWith(
			optionsFor("deepseek/search", { requestTimeoutMs: 5000 }),
			async () => new Response(JSON.stringify(body), { status: 200, headers: { "content-type": "application/json" } })
		);
		assert.equal(result.sources.length, 1);
	});

	it("honors a tiny configured timeout instead of rounding it away", async () => {
		const options = optionsFor("deepseek/search", { requestTimeoutMs: 1 });
		const started = Date.now();
		await assert.rejects(
			searchWith(options, hangingFetch()),
			(error) => error instanceof WebError && error.code === "WEB_PROVIDER_TIMEOUT"
		);
		assert.ok(Date.now() - started < 1_000, "a 1ms timeout must not wait for the default");
	});
});
