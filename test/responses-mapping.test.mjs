/**
 * Mapping and request-body behaviors added after the live Zhipu Response API
 * verification:
 *
 * - Zhipu attaches `results[]` ({url, title, snippet}) to each
 *   `web_search_call` — richer than the Qwen/OpenAI gateways, whose only title
 *   source is the `url_citation` annotation (often absent). The mapper joins
 *   `results` by url as fallback metadata; annotation titles keep precedence.
 * - DeepSeek's Responses API (`deepseek-v4-pro`, verified live 2026-10-13)
 *   reports a search as `{type: "search", queries}` and each visited page as a
 *   separate `{type: "open_page", url}` call, never sends `action.sources[]`,
 *   and leaves `message.annotations` empty. The mapper therefore treats
 *   `open_page` urls and `url_citation` annotations as sources too, and counts a
 *   `web_search_call` block (with or without sources) as proof the search ran.
 *   The same endpoint silently ignores `tools:[{type:"web_search"}]` for
 *   `deepseek-flash`, whose answer without any search evidence stays an error.
 * - Zhipu's Responses endpoint (verified live 2026-10-13) sends
 *   `web_search_call.action.sources[]` together with `results[]`, and is the
 *   only gateway seen emitting progress messages ("The first search didn't
 *   return relevant results, so let me refine the query:") as their own
 *   `message` items before the final answer — the mapper keeps the last
 *   `output_text` as `content` so the running commentary is not returned as the
 *   answer. Zhipu's Anthropic-compatible endpoint accepts `web_search_20250305`
 *   but runs no search (`usage.server_tool_use.web_search_requests: 0`), so the
 *   `anthropic-messages` mode fails loudly there instead of passing prose on.
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
		anthropicEffort: "",
		searchEngine: "search_std",
		count: 10,
		searchRecencyFilter: "noLimit",
		contentSize: "medium",
		reasoningEffort: "low",
		responsesReasoningEffort: "",
		responsesIncludeSources: true,
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
/**
 * Replace global fetch with a stub replaying one reply per call: an entry is
 * either a plain body (HTTP 200) or `{status, body}`. The last entry repeats,
 * so a retry test can list the rejection and then the accepted reply.
 */
function stubFetchSequence(replies) {
	const calls = [];
	globalThis.fetch = async (url, init) => {
		calls.push({ url, body: JSON.parse(init.body) });
		const reply = replies[Math.min(calls.length - 1, replies.length - 1)];
		const status = reply.status ?? 200;
		return new Response(JSON.stringify(reply.body ?? reply), { status });
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

describe("mapResponsesResponse: sources beyond action.sources[]", () => {
	it("collects DeepSeek open_page urls and strips the internal call fragment", () => {
		const result = mapResponsesResponse({
			output: [
				{ type: "reasoning", status: "completed", content: [{ type: "reasoning_text", text: "…" }] },
				{ type: "web_search_call", status: "completed", action: { type: "search", queries: ["DeepSeek V4 发布时间"] } },
				{ type: "web_search_call", status: "completed", action: { type: "open_page", url: "https://api-docs.deepseek.com/updates/#ws_call_id=call_01_ABC" } },
				{ type: "web_search_call", status: "failed", action: { type: "open_page", url: "https://stcn.com/article/detail/3816053.html#ws_call_id=call_02_DEF" } },
				{ type: "message", status: "completed", role: "assistant", content: [{ type: "output_text", text: "根据最新搜索结果……", annotations: [] }] }
			]
		});
		assert.deepEqual(result, {
			content: "根据最新搜索结果……",
			sources: [
				{ url: "https://api-docs.deepseek.com/updates/" },
				{ url: "https://stcn.com/article/detail/3816053.html" }
			],
			truncated: false
		});
	});

	it("keeps the answer when the search block lists no source at all", () => {
		const result = mapResponsesResponse({
			output: [
				{ type: "web_search_call", status: "completed", action: { type: "search", queries: ["q"] } },
				{ type: "message", content: [{ type: "output_text", text: "答案" }] }
			]
		});
		assert.deepEqual(result, { content: "答案", sources: [], truncated: false });
	});

	it("falls back to url_citation annotations when no block lists urls", () => {
		const result = mapResponsesResponse({
			output: [{
				type: "message",
				content: [{
					type: "output_text",
					text: "有引用",
					annotations: [
						{ type: "url_citation", url: "https://cite.example/", title: "引用来源" },
						{ type: "url_citation", url: "https://cite.example/" }
					]
				}]
			}]
		});
		assert.deepEqual(result, {
			content: "有引用",
			sources: [{ url: "https://cite.example/", title: "引用来源" }],
			truncated: false
		});
	});

	it("still fails when the model answered without any search evidence", () => {
		assert.throws(() => mapResponsesResponse({
			output: [
				{ type: "reasoning", content: [{ type: "reasoning_text", text: "…" }] },
				{ type: "message", content: [{ type: "output_text", text: "我目前无法执行网页搜索——在这个对话中没有开启联网搜索功能。" }] }
			]
		}), /no web_search_call block and no citations/u);
	});

	it("fails on a response with neither search evidence nor answer text", () => {
		assert.throws(() => mapResponsesResponse({ output: [] }), /neither a web_search_call block, citations, nor answer text/u);
		assert.throws(() => mapResponsesResponse({ output: [{ type: "message", content: [{ type: "output_text", text: "   " }] }] }), /neither a web_search_call block, citations, nor answer text/u);
	});

	it("keeps the final answer when the gateway emits progress messages first", () => {
		const result = mapResponsesResponse({
			output: [
				{ type: "web_search_call", status: "completed", action: { type: "search", queries: ["q"], sources: [{ type: "url", url: "https://z.example/a" }] } },
				{ type: "message", status: "completed", content: [{ type: "output_text", text: "The first search didn't return relevant results, so let me refine the query:" }] },
				{ type: "web_search_call", status: "completed", action: { type: "open_page", url: "https://z.example/b" } },
				{ type: "message", status: "completed", content: [{ type: "output_text", text: "最终答案" }] }
			]
		});
		assert.equal(result.content, "最终答案");
		assert.deepEqual(result.sources, [{ url: "https://z.example/a" }, { url: "https://z.example/b" }]);
	});

	it("collects the url of a find_in_page action too", () => {
		const result = mapResponsesResponse({
			output: [
				{ type: "web_search_call", status: "completed", action: { type: "search", query: "q" } },
				{ type: "web_search_call", status: "completed", action: { type: "open_page", url: "https://o.example/page" } },
				{ type: "web_search_call", status: "completed", action: { type: "find_in_page", url: "https://f.example/page", pattern: "weather" } },
				{ type: "message", status: "completed", phase: "final_answer", content: [{ type: "output_text", text: "答案" }] }
			]
		});
		assert.deepEqual(result.sources, [{ url: "https://o.example/page" }, { url: "https://f.example/page" }]);
	});

	it("prefers the message OpenAI labelled final_answer over later commentary", () => {
		const result = mapResponsesResponse({
			output: [
				{ type: "web_search_call", status: "completed", action: { type: "search", query: "q" } },
				{ type: "message", status: "completed", phase: "final_answer", content: [{ type: "output_text", text: "最终答案" }] },
				{ type: "message", status: "completed", phase: "commentary", content: [{ type: "output_text", text: "补充说明" }] }
			]
		});
		assert.equal(result.content, "最终答案");
	});

	it("keeps the title Kimi attaches to action.sources[] items", () => {
		const result = mapResponsesResponse({
			output: [
				{
					type: "web_search_call",
					status: "completed",
					action: {
						type: "search",
						query: "top news",
						sources: [{ type: "url", url: "https://k.example/a", title: "Kimi 标题" }]
					}
				},
				{ type: "message", status: "completed", content: [{ type: "output_text", text: "答案" }] }
			]
		});
		assert.deepEqual(result.sources, [{ url: "https://k.example/a", title: "Kimi 标题" }]);
	});

	it("prefers the url_citation annotation title over the sources[] title", () => {
		const result = mapResponsesResponse({
			output: [
				{ type: "web_search_call", action: { type: "search", sources: [{ type: "url", url: "https://k.example/a", title: "来源标题" }] } },
				{ type: "message", content: [{ type: "output_text", text: "答案", annotations: [{ type: "url_citation", url: "https://k.example/a", title: "注解标题" }] }] }
			]
		});
		assert.equal(result.sources[0].title, "注解标题");
	});

	it("ignores malformed source entries", () => {
		const result = mapResponsesResponse({
			output: [
				{
					type: "web_search_call",
					action: {
						sources: [
							{ type: "url" },
							{ type: "image", url: "https://x.example/" },
							{ type: "url", url: "" },
							{ type: "url", url: "https://ok.example/" }
						]
					}
				},
				{ type: "web_search_call", action: { type: "open_page", url: "" } },
				{ type: "message", content: [{ type: "output_text", text: "答案", annotations: [null, { type: "url_citation", url: 5 }] }] }
			]
		});
		assert.deepEqual(result.sources, [{ url: "https://ok.example/" }]);
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

	it("retries without reasoning_effort when the model rejects that level", async () => {
		const calls = stubFetchSequence([
			{ status: 400, body: { error: { code: "1210", message: "该模型始终思考，不支持关闭思考；请使用 low、high 或 max。" } } },
			{ choices: [{ message: { content: "答案正文", web_search: [{ link: "https://c.example/", title: "来源" }] } }] }
		]);
		try {
			const result = await provider(baseOptions({ mode: "zhipu-chat-search", reasoningEffort: "low" })).search({ query: "q" });
			assert.equal(calls.length, 2);
			assert.equal(calls[0].body.reasoning_effort, "low");
			assert.equal(calls[1].body.reasoning_effort, void 0);
			assert.deepEqual(result.sources, [{ url: "https://c.example/", title: "来源" }]);
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

	it("requests web_search_call.action.sources by default and honours the switch", async () => {
		const onCalls = stubFetch({
			output: [
				{ type: "web_search_call", action: { sources: [{ type: "url", url: "https://q.example/" }] } },
				{ type: "message", content: [{ type: "output_text", text: "答案" }] }
			]
		});
		try {
			await provider().search({ query: "q" });
			assert.deepEqual(onCalls[0].body.include, ["web_search_call.action.sources"]);
		} finally {
			globalThis.fetch = realFetch;
		}

		const offCalls = stubFetch({
			output: [
				{ type: "web_search_call", action: { sources: [{ type: "url", url: "https://q.example/" }] } },
				{ type: "message", content: [{ type: "output_text", text: "答案" }] }
			]
		});
		try {
			await provider(baseOptions({ responsesIncludeSources: false })).search({ query: "q" });
			assert.equal(offCalls[0].body.include, void 0);
		} finally {
			globalThis.fetch = realFetch;
		}
	});
});

describe("reasoning-effort fallback", () => {
	const searchPayload = {
		output: [
			{ type: "web_search_call", status: "completed", action: { type: "search", query: "q", sources: [{ type: "url", url: "https://q.example/" }] } },
			{ type: "message", status: "completed", content: [{ type: "output_text", text: "答案" }] }
		]
	};

	it("sends any official effort level, not only low and high", async () => {
		const calls = stubFetch(searchPayload);
		try {
			await provider(baseOptions({ responsesReasoningEffort: "xhigh" })).search({ query: "q" });
			assert.deepEqual(calls[0].body.reasoning, { effort: "xhigh" });
		} finally {
			globalThis.fetch = realFetch;
		}
	});

	it("retries without the effort knob when the model rejects that level", async () => {
		const calls = stubFetchSequence([
			{ status: 400, body: { error: { message: "该模型始终思考，不支持关闭思考；请使用 low、high 或 max。" } } },
			searchPayload
		]);
		try {
			const result = await provider(baseOptions({ responsesReasoningEffort: "medium" })).search({ query: "q" });
			assert.equal(calls.length, 2);
			assert.deepEqual(calls[0].body.reasoning, { effort: "medium" });
			assert.equal(calls[1].body.reasoning, void 0);
			assert.equal(result.sources[0].url, "https://q.example/");
		} finally {
			globalThis.fetch = realFetch;
		}
	});

	it("does not retry a failure that says nothing about a reasoning knob", async () => {
		const calls = stubFetchSequence([{ status: 429, body: { error: { message: "配额已用尽" } } }]);
		try {
			await assert.rejects(provider(baseOptions({ responsesReasoningEffort: "medium" })).search({ query: "q" }), /配额已用尽/u);
			assert.equal(calls.length, 1);
		} finally {
			globalThis.fetch = realFetch;
		}
	});
});
