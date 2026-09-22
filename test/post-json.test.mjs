/**
 * Regression tests for response-body decoding in lib/index.js (`postJson`).
 *
 * Background: dsh's `@deepseek-ai/dsh-http-proxy` installs the process's global
 * undici dispatcher from its own bundled undici 8.x, while Node's built-in
 * `fetch` (undici 7.x) resolves that same dispatcher across the version
 * boundary. The built-in fetch then hands back still-compressed bytes and the
 * `content-encoding` header is not even readable, which made every search fail
 * as "web search returned an unprocessable response body: SyntaxError:
 * Unexpected token '\u001f' ...". The provider therefore asks gateways for
 * `accept-encoding: identity` up front and inflates compressed bodies by magic
 * bytes as the safety net. These tests stub global fetch with exactly that
 * broken shape — compressed bytes, no readable encoding header — plus the
 * healthy shapes, so both defenses stay guarded.
 *
 * Run: node --test test/
 */
import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import { deflateSync, gzipSync } from "node:zlib";
import { WebError } from "@deepseek-ai/dsh-web";
import { OpenAiSearchProvider } from "../lib/index.js";

const realFetch = globalThis.fetch;

afterEach(() => {
	globalThis.fetch = realFetch;
});

/** One fully-defaulted options object per mode, as `resolveOptions` would emit. */
function baseOptions(overrides = {}) {
	return {
		apiKey: "test-key",
		apiKeyEnv: "TEST_API_KEY",
		mode: "zhipu-web-search",
		baseURL: "https://gateway.example.test/api/paas/v4",
		model: "glm-5.3-flash",
		maxOutputTokens: 1024,
		searchEngine: "search_std",
		count: 10,
		searchRecencyFilter: "noLimit",
		contentSize: "medium",
		reasoningEffort: "low",
		responsesReasoningEffort: "",
		searchDomainFilter: "",
		searchIntent: false,
		searchPrompt: "",
		...overrides
	};
}

function provider(options = baseOptions()) {
	return new OpenAiSearchProvider(() => options);
}

/**
 * Replace global fetch with a stub. Replies are raw `Response`s: setting no
 * `content-encoding` header reproduces the cross-undici dispatcher shape where
 * the header is unreadable but the bytes are still compressed.
 */
function stubFetch(respond) {
	const calls = [];
	globalThis.fetch = async (url, init) => {
		calls.push({ url, init });
		return respond(url, init);
	};
	return calls;
}

function jsonResponse(body, init = {}) {
	return new Response(gzipSync(Buffer.from(JSON.stringify(body))), init);
}

const zhipuPayload = {
	search_result: [
		{ link: "https://a.example/weather", title: "北京天气", content: "今天多云" },
		{ link: "https://a.example/weather", title: "重复链接应被去重", content: "" }
	]
};

const responsesPayload = {
	output: [
		{ type: "web_search_call", action: { sources: [{ type: "url", url: "https://b.example/" }] } },
		{ type: "message", content: [{ type: "output_text", text: "答案正文" }] }
	]
};

const chatPayload = {
	choices: [{ message: { content: "答案正文", web_search: [{ link: "https://c.example/", title: "来源" }] } }]
};

describe("postJson response-body decoding", () => {
	it("sends accept-encoding: identity so gateways skip compression", async () => {
		const calls = stubFetch(() => new Response(JSON.stringify(zhipuPayload), { headers: { "content-type": "application/json" } }));
		await provider().search({ query: "北京天气", maxResults: 5 });
		assert.equal(new Headers(calls[0].init.headers).get("accept-encoding"), "identity");
	});

	it("decodes a gzip body that carries no readable content-encoding header (cross-undici dispatcher regression)", async () => {
		stubFetch(() => jsonResponse(zhipuPayload));
		const result = await provider().search({ query: "北京天气", maxResults: 5 });
		assert.equal(result.sources[0].url, "https://a.example/weather");
		assert.equal(result.sources[0].title, "北京天气");
		assert.equal(result.sources.length, 1); // deduped by url
		assert.match(result.content, /北京天气/);
	});

	it("decodes a zlib-deflate body the same way", async () => {
		stubFetch(() => new Response(deflateSync(Buffer.from(JSON.stringify(zhipuPayload)))));
		const result = await provider().search({ query: "北京天气", maxResults: 5 });
		assert.equal(result.sources[0].url, "https://a.example/weather");
	});

	it("decodes an uncompressed body unchanged", async () => {
		stubFetch(() => new Response(JSON.stringify(zhipuPayload)));
		const result = await provider().search({ query: "北京天气", maxResults: 5 });
		assert.equal(result.sources.length, 1);
	});

	it("maps a gzip body in responses mode", async () => {
		stubFetch(() => jsonResponse(responsesPayload));
		const result = await provider(baseOptions({ mode: "responses", baseURL: "https://gateway.example.test/v1", model: "deepseek-v4-flash-0731" })).search({ query: "q" });
		assert.equal(result.content, "答案正文");
		assert.deepEqual(result.sources, [{ url: "https://b.example/" }]);
	});

	it("maps a gzip body in zhipu-chat-search mode", async () => {
		stubFetch(() => jsonResponse(chatPayload));
		const result = await provider(baseOptions({ mode: "zhipu-chat-search" })).search({ query: "q" });
		assert.equal(result.content, "答案正文");
		assert.deepEqual(result.sources, [{ url: "https://c.example/", title: "来源" }]);
	});

	it("reads a compressed error body on HTTP failure", async () => {
		stubFetch(() => new Response(gzipSync(Buffer.from(JSON.stringify({ error: { message: "配额已用尽" } }))), { status: 429 }));
		await assert.rejects(provider().search({ query: "q" }), (error) => {
			assert.ok(error instanceof WebError);
			assert.equal(error.code, "WEB_PROVIDER_ERROR");
			assert.match(error.message, /配额已用尽/);
			return true;
		});
	});

	it("still reports an unprocessable body for content that is neither JSON nor compressed", async () => {
		stubFetch(() => new Response("<html>bad gateway</html>"));
		await assert.rejects(provider().search({ query: "q" }), (error) => {
			assert.ok(error instanceof WebError);
			assert.equal(error.code, "WEB_PROVIDER_ERROR");
			assert.match(error.message, /unprocessable response body/);
			return true;
		});
	});

	it("reports an unprocessable body for an empty response", async () => {
		stubFetch(() => new Response(""));
		await assert.rejects(provider().search({ query: "q" }), (error) => {
			assert.ok(error instanceof WebError);
			assert.equal(error.code, "WEB_PROVIDER_ERROR");
			assert.match(error.message, /unprocessable response body/);
			return true;
		});
	});

	it("refuses to download a body larger than the wire cap, cancelling the stream early", async () => {
		const megabyte = 1024 * 1024;
		let pulled = 0;
		const endless = new ReadableStream({
			pull(controller) {
				pulled += 1;
				controller.enqueue(Buffer.alloc(megabyte));
			}
		});
		stubFetch(() => new Response(endless));
		// MAX_RESPONSE_BYTES is 8 MiB: the 9th chunk crosses the cap. One extra
		// chunk may sit in the stream's internal prefetch queue — the assertion
		// only needs to prove the endless stream was abandoned, not drained.
		await assert.rejects(provider().search({ query: "q" }), (error) => {
			assert.match(String(error), /response body exceeds \d+ bytes/);
			return true;
		});
		assert.ok(pulled <= 10, `reader kept pulling after the wire cap: ${pulled} chunks`);
	});

	it("refuses to inflate a gzip bomb past the decode cap", async () => {
		// 17 MiB of zeros compresses to ~17 KB — a classic small-body bomb. The
		// decode cap (16 MiB) must make zlib stop inflating mid-stream.
		const bomb = gzipSync(Buffer.alloc(17 * 1024 * 1024, 0));
		assert.ok(bomb.length < 64 * 1024, "test precondition: bomb should compress tiny");
		stubFetch(() => new Response(bomb));
		await assert.rejects(provider().search({ query: "q" }), (error) => {
			assert.match(String(error), /decoded body exceeds \d+ bytes/);
			return true;
		});
	});
});
