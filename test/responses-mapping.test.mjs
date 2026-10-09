/**
 * Mapping and request-body behaviors added after the live Zhipu Response API
 * verification:
 *
 * - Zhipu attaches `results[]` ({url, title, snippet}) to each
 *   `web_search_call` — richer than the Qwen/OpenAI gateways, whose only title
 *   source is the `url_citation` annotation (often absent). The mapper joins
 *   `results` by url as fallback metadata; annotation titles keep precedence.
 * - The two `paas/v4` Zhipu modes attach a `request_id` (6-64 chars, UUID) for
 *   platform-side correlation; the Response API schema has no such field.
 * - `require_search` (zhipu-chat-search only) rides the tool object when on
 *   and stays absent when off, keeping the historical body byte-identical.
 *
 * Run: node --test "test/**\/*.test.mjs"
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { mapResponsesResponse, OpenAiSearchProvider } from "../lib/index.js";

function baseOptions(overrides = {}) {
	return {
		apiKey: "test-key",
		apiKeyEnv: "TEST_API_KEY",
		mode: "responses",
		baseURL: "https://gateway.example.test/api/v1",
		model: "glm-5.3-flash",
		maxOutputTokens: 4096,
		apiVersion: "2023-06-01",
		maxUses: 5,
		anthropicThinking: "default",
		searchEngine: "search_std",
		count: 10,
		searchRecencyFilter: "noLimit",
		contentSize: "medium",
		reasoningEffort: "low",
		responsesReasoningEffort: "",
		searchDomainFilter: "",
		searchIntent: false,
		requireSearch: false,
		searchPrompt: "",
		...overrides
	};
}

function provider(options = baseOptions()) {
	return new OpenAiSearchProvider(() => options);
}

/** Replace global fetch, capturing request bodies, replying `body` as JSON. */
function stubFetch(body) {
	const calls = [];
	globalThis.fetch = async (url, init) => {
		calls.push({ url, body: JSON.parse(init.body) });
		return new Response(JSON.stringify(body));
	};
	return calls;
}
const realFetch = globalThis.fetch;

describe("mapResponsesResponse: web_search_call.results[] fallback metadata", () => {
	it("joins titles and snippets from results[] by url", () => {
		const result = mapResponsesResponse({
			output: [{
				type: "web_search_call",
				action: { sources: [{ type: "url", url: "https://z.example/a" }, { type: "url", url: "https://z.example/b" }] },
				results: [
					{ url: "https://z.example/a", title: "结果 A", snippet: "A 的摘要" },
					{ url: "https://z.example/b", title: "结果 B" },
					{ url: "https://z.example/missing" } // not in sources: ignored
				]
			}]
		});
		assert.deepEqual(result.sources, [
			{ url: "https://z.example/a", title: "结果 A", snippet: "A 的摘要" },
			{ url: "https://z.example/b", title: "结果 B" }
		]);
	});

	it("keeps the url_citation annotation title ahead of the results[] title", () => {
		const result = mapResponsesResponse({
			output: [
				{ type: "web_search_call", action: { sources: [{ type: "url", url: "https://z.example/a" }] }, results: [{ url: "https://z.example/a", title: "results 标题", snippet: "摘要" }] },
				{ type: "message", content: [{ type: "output_text", text: "答案", annotations: [{ type: "url_citation", url: "https://z.example/a", title: "注解标题" }] }] }
			]
		});
		assert.equal(result.sources[0].title, "注解标题");
		assert.equal(result.sources[0].snippet, "摘要");
	});

	it("leaves Qwen-shaped responses (no results[]) untouched", () => {
		const result = mapResponsesResponse({
			output: [
				{ type: "web_search_call", action: { sources: [{ type: "url", url: "https://q.example/" }] } },
				{ type: "message", content: [{ type: "output_text", text: "答案" }] }
			]
		});
		assert.deepEqual(result.sources, [{ url: "https://q.example/" }]);
	});
});

describe("zhipu paas/v4 request bodies", () => {
	it("attaches a UUID request_id in zhipu-web-search mode", async () => {
		const calls = stubFetch({ search_result: [] });
		try {
			await provider(baseOptions({ mode: "zhipu-web-search" })).search({ query: "q" });
			assert.match(calls[0].body.request_id, /^[0-9a-f-]{36}$/u);
		} finally {
			globalThis.fetch = realFetch;
		}
	});

	it("attaches a request_id and omits require_search when off in zhipu-chat-search mode", async () => {
		const calls = stubFetch({ choices: [{ message: { content: "答案" } }] });
		try {
			await provider(baseOptions({ mode: "zhipu-chat-search" })).search({ query: "q" });
			assert.match(calls[0].body.request_id, /^[0-9a-f-]{36}$/u);
			assert.equal(calls[0].body.tools[0].web_search.require_search, void 0);
		} finally {
			globalThis.fetch = realFetch;
		}
	});

	it("sends require_search: true through the tool object when on", async () => {
		const calls = stubFetch({ choices: [{ message: { content: "答案" } }] });
		try {
			await provider(baseOptions({ mode: "zhipu-chat-search", requireSearch: true })).search({ query: "q" });
			assert.equal(calls[0].body.tools[0].web_search.require_search, true);
		} finally {
			globalThis.fetch = realFetch;
		}
	});

	it("sends no request_id in responses mode (the Response API has no such field)", async () => {
		const calls = stubFetch({
			output: [
				{ type: "web_search_call", action: { sources: [{ type: "url", url: "https://q.example/" }] } },
				{ type: "message", content: [{ type: "output_text", text: "答案" }] }
			]
		});
		try {
			await provider().search({ query: "q" });
			assert.equal(calls[0].body.request_id, void 0);
		} finally {
			globalThis.fetch = realFetch;
		}
	});
});
