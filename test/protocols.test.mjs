/**
 * 协议层契约：每个 target 的请求 URL / 头 / 请求体，以及响应映射与错误处理。
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { gzipSync } from "node:zlib";
import { WebError } from "@deepseek-ai/dsh-web";
import {
	DiySearchProvider,
	mapAnthropicResponse,
	mapChatAnnotationsResponse,
	mapQwenChatResponse,
	mapResponsesResponse,
	mapZhipuChatResponse,
	resolveOptions
} from "../lib/index.js";

const ctx = {
	get: (name) => name === "credentials" ? { resolve: async () => ({ value: "sk-test" }) } : void 0
};

/** Resolve one target's options with a fresh document. */
function optionsFor(target, bucket = {}) {
	return resolveOptions(ctx, { version: 3, targets: { [target]: bucket } }, target);
}

/**
 * Run one search against a scripted fetch. Each entry is `{ body, status? }`; the last
 * entry repeats. Returns the captured calls and the result (or the thrown error).
 */
async function runSearch(options, responses, request = { query: "测试查询", maxResults: 5 }) {
	const calls = [];
	const original = globalThis.fetch;
	let index = 0;
	globalThis.fetch = async (url, init) => {
		calls.push({ url: String(url), headers: init.headers, body: JSON.parse(init.body) });
		const spec = responses[Math.min(index++, responses.length - 1)];
		const payload = typeof spec.body === "string" ? spec.body : JSON.stringify(spec.body);
		return new Response(payload, { status: spec.status ?? 200, headers: { "content-type": "application/json" } });
	};
	try {
		const result = await new DiySearchProvider(() => options).search(request);
		return { result, calls };
	} finally {
		globalThis.fetch = original;
	}
}

const RESPONSES_BODY = {
	output: [
		{ type: "web_search_call", status: "completed", action: { type: "search", sources: [{ type: "url", url: "https://a.example/1" }] } },
		{ type: "message", phase: "final_answer", content: [{ type: "output_text", text: "answer" }] }
	]
};
const ANTHROPIC_BODY = {
	content: [{ type: "web_search_tool_result", content: [{ type: "web_search_result", url: "https://b.example/1", title: "B", page_age: "April 30, 2025" }] }]
};
const ZHIPU_CHAT_BODY = {
	choices: [{ message: { content: "answer", web_search: [{ link: "https://c.example/1", title: "C" }] } }]
};
const QWEN_CHAT_BODY = { choices: [{ message: { content: "answer" } }] };
const ANNOTATIONS_BODY = {
	choices: [{ message: { content: "answer", annotations: [{ type: "url_citation", url_citation: { url: "https://d.example/1", title: "D" } }] } }]
};
const DEEPSEEK_SEARCH_BODY = { results: [{ url: "https://e.example/1", title: "E", snippet: "snippet", summary: "summary" }] };
const KIMI_SEARCH_BODY = { search_results: [{ url: "https://f.example/1", title: "F", snippet: "snippet" }] };
const ZHIPU_SEARCH_BODY = { search_result: [{ link: "https://g.example/1", title: "G", content: "snippet" }] };

describe("responses targets", () => {
	it("posts to qwen's Responses surface with the built-in tool and include", async () => {
		const { result, calls } = await runSearch(optionsFor("qwen/responses"), [{ body: RESPONSES_BODY }]);
		assert.equal(calls[0].url, "https://maas.qianwenaiapi.com/compatible-mode/v1/responses");
		assert.equal(calls[0].body.model, "qwen3.8-flash");
		assert.deepEqual(calls[0].body.tools, [{ type: "web_search" }]);
		assert.deepEqual(calls[0].body.include, ["web_search_call.action.sources"]);
		assert.equal(calls[0].body.store, false);
		assert.deepEqual(result.sources, [{ url: "https://a.example/1" }]);
		assert.equal(result.content, "answer");
	});

	it("does not send include for deepseek, whose target omits the field", async () => {
		const { calls } = await runSearch(optionsFor("deepseek/responses"), [{ body: RESPONSES_BODY }]);
		assert.equal(calls[0].body.include, void 0);
		assert.equal(calls[0].body.model, "deepseek-v4-pro");
	});

	it("sends openrouter's server tool with parameters", async () => {
		const { calls } = await runSearch(optionsFor("openrouter/responses"), [{ body: RESPONSES_BODY }]);
		assert.deepEqual(calls[0].body.tools[0], {
			type: "openrouter:web_search",
			parameters: { engine: "auto", max_results: 5, max_uses: 3, max_total_results: 15, search_context_size: "medium" }
		});
	});

	it("sends OpenAI domain filters and context size object", async () => {
		const options = optionsFor("openai/responses", { allowedDomains: "a.example, b.example", blockedDomains: "c.example" });
		const { calls } = await runSearch(options, [{ body: RESPONSES_BODY }]);
		assert.deepEqual(calls[0].body.tools[0], {
			type: "web_search",
			search_context_size: "medium",
			filters: { allowed_domains: ["a.example", "b.example"], blocked_domains: ["c.example"] }
		});
	});

	it("adds a documented hint to the 404 diagnostic", async () => {
		await assert.rejects(
			runSearch(optionsFor("qwen/responses"), [{ status: 404, body: { error: "not found" } }]),
			(error) => error instanceof WebError && /no Responses path/u.test(error.message) && /platform\.qianwenai\.com/u.test(error.message)
		);
	});

	it("retries without reasoning.effort when the endpoint rejects it", async () => {
		const options = optionsFor("qwen/responses", { reasoningEffort: "xhigh" });
		const { calls } = await runSearch(options, [{ status: 400, body: { error: "unsupported effort" } }, { body: RESPONSES_BODY }]);
		assert.equal(calls.length, 2);
		assert.deepEqual(calls[0].body.reasoning, { effort: "xhigh" });
		assert.equal(calls[1].body.reasoning, void 0);
	});
});

describe("anthropic targets", () => {
	it("posts to the DeepSeek Messages surface with both credential headers", async () => {
		const { result, calls } = await runSearch(optionsFor("deepseek/anthropic-messages"), [{ body: ANTHROPIC_BODY }]);
		assert.equal(calls[0].url, "https://api.deepseek.com/anthropic/v1/messages");
		assert.equal(calls[0].headers["x-api-key"], "sk-test");
		assert.equal(calls[0].headers["anthropic-version"], "2023-06-01");
		assert.deepEqual(calls[0].body.tools, [{ type: "web_search_20250305", name: "web_search", max_uses: 5 }]);
		assert.equal(calls[0].body.system, void 0);
		assert.deepEqual(result.sources, [{ url: "https://b.example/1", title: "B", publishedAt: "2025-04-30" }]);
	});

	it("attaches qwen's billing header as a system block", async () => {
		const { calls } = await runSearch(optionsFor("qwen/anthropic-messages"), [{ body: ANTHROPIC_BODY }]);
		assert.deepEqual(calls[0].body.system, [{ type: "text", text: "x-anthropic-billing-header: cc_entrypoint=cli;" }]);
		assert.equal(calls[0].body.model, "qwen3.8-max");
	});

	it("honours thinking=disabled and effort", async () => {
		const options = optionsFor("anthropic/anthropic-messages", { thinking: "disabled", effort: "high", maxUses: 3 });
		const { calls } = await runSearch(options, [{ body: ANTHROPIC_BODY }]);
		assert.deepEqual(calls[0].body.thinking, { type: "disabled" });
		assert.deepEqual(calls[0].body.output_config, { effort: "high" });
		assert.equal(calls[0].body.tools[0].max_uses, 3);
	});
});

describe("chat targets", () => {
	it("posts zhipu's web_search tool and parses sources from message.web_search", async () => {
		const { result, calls } = await runSearch(optionsFor("zhipu/chat-completions"), [{ body: ZHIPU_CHAT_BODY }]);
		assert.equal(calls[0].url, "https://open.bigmodel.cn/api/paas/v4/chat/completions");
		assert.equal(calls[0].body.tools[0].web_search.search_result, true);
		assert.equal(calls[0].body.tools[0].web_search.search_engine, "search_std");
		assert.match(calls[0].body.request_id, /^[0-9a-f-]{36}$/u);
		assert.deepEqual(result.sources, [{ url: "https://c.example/1", title: "C" }]);
	});

	it("posts qwen's enable_search without tools and returns no sources", async () => {
		const { result, calls } = await runSearch(optionsFor("qwen/chat-completions"), [{ body: QWEN_CHAT_BODY }]);
		assert.equal(calls[0].body.enable_search, true);
		assert.equal(calls[0].body.tools, void 0);
		assert.equal(calls[0].body.search_options.search_strategy, "turbo");
		assert.deepEqual(result.sources, []);
		assert.equal(result.content, "answer");
	});

	it("posts openrouter's server tool and parses annotations", async () => {
		const { result, calls } = await runSearch(optionsFor("openrouter/chat-completions", { model: "meta/llama" }), [{ body: ANNOTATIONS_BODY }]);
		assert.equal(calls[0].body.tools[0].type, "openrouter:web_search");
		assert.deepEqual(calls[0].body.tools[0].parameters, {
			engine: "auto",
			max_results: 5,
			max_uses: 3,
			max_total_results: 15,
			search_context_size: "medium"
		});
		assert.deepEqual(result.sources, [{ url: "https://d.example/1", title: "D" }]);
	});

	it("posts OpenAI's search model without tools", async () => {
		const { calls } = await runSearch(optionsFor("openai/chat-completions"), [{ body: ANNOTATIONS_BODY }]);
		assert.equal(calls[0].body.model, "gpt-5-search-api");
		assert.equal(calls[0].body.tools, void 0);
		assert.equal(calls[0].body.max_completion_tokens, 4096);
	});
});

describe("vendor-specific tool parameters", () => {
	it("sends OpenAI's live-access, token budget, and image controls", async () => {
		const options = optionsFor("openai/responses", {
			externalWebAccess: "false",
			returnTokenBudget: "unlimited",
			searchContentTypes: "image,text",
			imageMaxResults: 3,
			imageCaption: true
		});
		const { calls } = await runSearch(options, [{ body: RESPONSES_BODY }]);
		assert.equal(calls[0].body.tools[0].external_web_access, false);
		assert.equal(calls[0].body.tools[0].return_token_budget, "unlimited");
		assert.deepEqual(calls[0].body.tools[0].search_content_types, ["image", "text"]);
		assert.deepEqual(calls[0].body.tools[0].image_settings, { max_results: 3, caption: true });
	});

	it("sends Anthropic's response_inclusion and forces direct callers on 2026 versions", async () => {
		const options = optionsFor("anthropic/anthropic-messages", { toolType: "web_search_20260318", responseInclusion: "excluded" });
		const { calls } = await runSearch(options, [{ body: ANTHROPIC_BODY }]);
		assert.deepEqual(calls[0].body.tools[0].allowed_callers, ["direct"]);
		assert.equal(calls[0].body.tools[0].response_inclusion, "excluded");
	});

	it("keeps Anthropic's domain lists mutually exclusive", async () => {
		const options = optionsFor("anthropic/anthropic-messages", { allowedDomains: "a.example", blockedDomains: "b.example" });
		const { calls } = await runSearch(options, [{ body: ANTHROPIC_BODY }]);
		assert.deepEqual(calls[0].body.tools[0].allowed_domains, ["a.example"]);
		assert.equal(calls[0].body.tools[0].blocked_domains, void 0);
	});

	it("parses OpenRouter's x_search JSON into parameters", async () => {
		const options = optionsFor("openrouter/chat-completions", { model: "x", xSearch: '{"allowed_x_handles":["OpenRouterAI"]}' });
		const { calls } = await runSearch(options, [{ body: ANNOTATIONS_BODY }]);
		assert.deepEqual(calls[0].body.tools[0].parameters.x_search, { allowed_x_handles: ["OpenRouterAI"] });
	});
});

describe("per-target coverage", () => {
	it("posts kimi's Responses surface with include", async () => {
		const { result, calls } = await runSearch(optionsFor("kimi/responses"), [{ body: RESPONSES_BODY }]);
		assert.equal(calls[0].url, "https://api.moonshot.cn/v1/responses");
		assert.deepEqual(calls[0].body.tools, [{ type: "web_search" }]);
		assert.deepEqual(calls[0].body.include, ["web_search_call.action.sources"]);
		assert.equal(result.sources.length, 1);
	});

	it("posts zhipu's Responses surface and merges results[] metadata", async () => {
		const body = {
			output: [
				{ type: "web_search_call", action: { sources: [{ type: "url", url: "https://z.example/1" }] }, results: [{ url: "https://z.example/1", title: "Z", snippet: "S" }] },
				{ type: "message", content: [{ type: "output_text", text: "answer" }] }
			]
		};
		const { result, calls } = await runSearch(optionsFor("zhipu/responses"), [{ body }]);
		assert.equal(calls[0].url, "https://open.bigmodel.cn/api/v1/responses");
		assert.deepEqual(result.sources, [{ url: "https://z.example/1", title: "Z", snippet: "S" }]);
	});

	it("collects DeepSeek's open_page urls as sources without include", async () => {
		const body = {
			output: [
				{ type: "web_search_call", status: "completed", action: { type: "search", queries: ["x"] } },
				{ type: "web_search_call", action: { type: "open_page", url: "https://ds.example/1" } },
				{ type: "message", content: [{ type: "output_text", text: "answer" }] }
			]
		};
		const { result, calls } = await runSearch(optionsFor("deepseek/responses"), [{ body }]);
		assert.equal(calls[0].url, "https://api.deepseek.com/v1/responses");
		assert.equal(calls[0].body.model, "deepseek-v4-pro");
		assert.equal(calls[0].body.include, void 0);
		assert.deepEqual(result.sources, [{ url: "https://ds.example/1" }]);
		assert.equal(result.content, "answer");
	});

	it("posts OpenRouter's Messages surface with the web_search alias", async () => {
		const { result, calls } = await runSearch(optionsFor("openrouter/anthropic-messages", { model: "anthropic/claude-x" }), [{ body: ANTHROPIC_BODY }]);
		assert.equal(calls[0].url, "https://openrouter.ai/api/v1/messages");
		assert.equal(calls[0].headers["anthropic-version"], "2023-06-01");
		assert.equal(calls[0].body.tools[0].type, "web_search_20250305");
		assert.equal(result.sources.length, 1);
	});

	it("sends Kimi's allowed domains and never blocked domains", async () => {
		const options = optionsFor("kimi/responses", { allowedDomains: "a.example,b.example" });
		const { calls } = await runSearch(options, [{ body: RESPONSES_BODY }]);
		assert.deepEqual(calls[0].body.tools[0].filters, { allowed_domains: ["a.example", "b.example"] });
	});

	it("supports a custom Chat Completions target via the zhipu variant", async () => {
		const options = optionsFor("custom/chat-completions", {
			template: "zhipu",
			chatVariant: "zhipu",
			baseURL: "https://gw.example/v1",
			apiKeyEnv: "GW_KEY",
			model: "glm-5.3-flash"
		});
		const { result, calls } = await runSearch(options, [{ body: ZHIPU_CHAT_BODY }]);
		assert.equal(calls[0].url, "https://gw.example/v1/chat/completions");
		assert.equal(calls[0].body.tools[0].type, "web_search");
		assert.equal(calls[0].body.tools[0].web_search.search_engine, "search_std", "the zhipu variant requires an engine");
		assert.equal(result.sources.length, 1);
	});

	it("supports the qwen variant on a custom Chat target", async () => {
		const options = optionsFor("custom/chat-completions", { chatVariant: "qwen", baseURL: "https://gw.example/v1", apiKeyEnv: "GW_KEY", model: "qwen3.8-flash" });
		const { result, calls } = await runSearch(options, [{ body: QWEN_CHAT_BODY }]);
		assert.equal(calls[0].body.enable_search, true);
		assert.equal(calls[0].body.tools, void 0);
		assert.deepEqual(result.sources, []);
	});

	it("supports the openrouter variant on a custom Chat target", async () => {
		const options = optionsFor("custom/chat-completions", { chatVariant: "openrouter", baseURL: "https://gw.example/v1", apiKeyEnv: "GW_KEY", model: "x" });
		const { calls } = await runSearch(options, [{ body: ANNOTATIONS_BODY }]);
		assert.equal(calls[0].body.tools[0].type, "openrouter:web_search");
	});

	it("supports the search-model variant on a custom Chat target", async () => {
		const options = optionsFor("custom/chat-completions", { chatVariant: "openai-search-model", baseURL: "https://gw.example/v1", apiKeyEnv: "GW_KEY", model: "gpt-5-search-api" });
		const { calls } = await runSearch(options, [{ body: ANNOTATIONS_BODY }]);
		assert.equal(calls[0].body.tools, void 0);
		assert.equal(calls[0].body.max_completion_tokens, 4096);
	});

	it("maps blocked domains to OpenRouter's excluded_domains on a custom target", async () => {
		const options = optionsFor("custom/responses", {
			toolType: "openrouter:web_search",
			baseURL: "https://gw.example/v1",
			apiKeyEnv: "GW_KEY",
			model: "x",
			blockedDomains: "blocked.example"
		});
		const { calls } = await runSearch(options, [{ body: RESPONSES_BODY }]);
		assert.deepEqual(calls[0].body.tools[0].parameters.excluded_domains, ["blocked.example"]);
	});

	it("supports a custom Responses target across tool spellings", async () => {
		for (const toolType of ["web_search", "openrouter:web_search", "web_search_20250305"]) {
			const options = optionsFor("custom/responses", { template: "openai", toolType, baseURL: "https://gw.example/v1", apiKeyEnv: "GW_KEY", model: "gpt-5.5" });
			const { result, calls } = await runSearch(options, [{ body: RESPONSES_BODY }]);
			assert.equal(calls[0].url, "https://gw.example/v1/responses");
			assert.equal(calls[0].body.tools[0].type, toolType);
			assert.equal(result.sources.length, 1);
		}
	});

	it("supports a custom Anthropic target across tool versions", async () => {
		for (const toolType of ["web_search_20250305", "web_search_20260209", "web_search_20260318"]) {
			const options = optionsFor("custom/anthropic-messages", {
				template: "anthropic",
				toolType,
				baseURL: "https://gw.example/anthropic",
				apiKeyEnv: "GW_KEY",
				model: "claude-opus-5-5"
			});
			const { result, calls } = await runSearch(options, [{ body: ANTHROPIC_BODY }]);
			assert.equal(calls[0].url, "https://gw.example/anthropic/v1/messages");
			assert.equal(calls[0].body.tools[0].type, toolType);
			assert.equal(calls[0].body.tools[0].max_uses, 5);
			assert.equal(calls[0].body.system, void 0, "custom targets never get the qwen billing header");
			assert.deepEqual(calls[0].body.tools[0].allowed_callers, toolType === "web_search_20250305" ? void 0 : ["direct"]);
			assert.equal(result.sources.length, 1);
		}
	});
});

describe("standalone targets", () => {
	it("posts zhipu's search_query body", async () => {
		const { result, calls } = await runSearch(optionsFor("zhipu/search"), [{ body: ZHIPU_SEARCH_BODY }]);
		assert.equal(calls[0].url, "https://open.bigmodel.cn/api/paas/v4/web_search");
		assert.equal(calls[0].body.search_query, "测试查询");
		assert.equal(calls[0].body.search_engine, "search_std", "the official target keeps its catalog default");
		assert.match(calls[0].body.request_id, /^[0-9a-f-]{36}$/u);
		assert.deepEqual(result.sources, [{ url: "https://g.example/1", title: "G", snippet: "snippet" }]);
		assert.match(result.content, /G/u);
	});

	it("falls back to search_std when a Zhipu-template gateway leaves the engine blank", async () => {
		const options = optionsFor("custom/search", { template: "zhipu", baseURL: "https://gw.example", path: "/web_search", apiKeyEnv: "GW_KEY" });
		const { calls } = await runSearch(options, [{ body: ZHIPU_SEARCH_BODY }]);
		assert.equal(calls[0].body.search_engine, "search_std");
	});

	it("sends a hand-typed engine for a custom gateway", async () => {
		const options = optionsFor("custom/search", { template: "zhipu", baseURL: "https://gw.example", path: "/web_search", apiKeyEnv: "GW_KEY", searchEngine: "searxng" });
		const { calls } = await runSearch(options, [{ body: ZHIPU_SEARCH_BODY }]);
		assert.equal(calls[0].body.search_engine, "searxng");
	});

	it("posts deepseek's query body and parses results[]", async () => {
		const { result, calls } = await runSearch(optionsFor("deepseek/search"), [{ body: DEEPSEEK_SEARCH_BODY }]);
		assert.equal(calls[0].url, "https://api.deepseek.com/v1/tools/search");
		assert.equal(calls[0].body.query, "测试查询");
		assert.equal(calls[0].body.count, 5);
		assert.equal(calls[0].body.localization, void 0);
		assert.deepEqual(result.sources, [{ url: "https://e.example/1", title: "E", snippet: "snippet" }]);
	});

	it("posts kimi's text_query body and parses search_results[]", async () => {
		const { result, calls } = await runSearch(optionsFor("kimi/search"), [{ body: KIMI_SEARCH_BODY }]);
		assert.equal(calls[0].url, "https://api.moonshot.cn/v1/tools/search");
		assert.equal(calls[0].body.text_query, "测试查询");
		assert.equal(calls[0].body.limit, 5);
		assert.deepEqual(result.sources, [{ url: "https://f.example/1", title: "F", snippet: "snippet" }]);
	});

	it("clamps Kimi's limit to its 1-20 range", async () => {
		/** No request maxResults, so the configured count decides. */
		const { calls } = await runSearch(optionsFor("kimi/search", { count: 50 }), [{ body: KIMI_SEARCH_BODY }], { query: "测试查询" });
		assert.equal(calls[0].body.limit, 20);
	});

	it("limits the digest entries and the snippet length", async () => {
		const options = optionsFor("zhipu/search", { digestEntries: 1, digestSnippetChars: 4 });
		const body = {
			search_result: [
				{ link: "https://a.example/1", title: "A", content: "abcdefgh" },
				{ link: "https://b.example/2", title: "B", content: "ijklmnop" }
			]
		};
		const { result } = await runSearch(options, [{ body }]);
		assert.equal(result.sources.length, 2, "sources are never trimmed by the digest limit");
		assert.equal(result.content, "1. A\nabcd");
	});

	it("maps a custom target through its field overrides", async () => {
		const options = optionsFor("custom/search", {
			template: "deepseek",
			baseURL: "https://gw.example",
			path: "/v1/search",
			apiKeyEnv: "GW_KEY",
			queryField: "q",
			countField: "size",
			resultsPath: "data.items",
			urlField: "link",
			titleField: "name",
			snippetField: "desc",
			count: 7
		});
		const { result, calls } = await runSearch(options, [{ body: { data: { items: [{ link: "https://h.example/1", name: "H", desc: "D" }] } } }]);
		assert.equal(calls[0].url, "https://gw.example/v1/search");
		assert.equal(calls[0].body.q, "测试查询");
		assert.equal(calls[0].body.size, 5);
		assert.deepEqual(result.sources, [{ url: "https://h.example/1", title: "H", snippet: "D" }]);
	});
});

describe("failure handling", () => {
	it("refuses a target marked unsupported", async () => {
		const options = optionsFor("kimi/chat-completions");
		await assert.rejects(runSearch(options, [{ body: ZHIPU_CHAT_BODY }]), (error) => error instanceof WebError && /not supported/u.test(error.message));
	});

	it("aborts with WEB_ABORTED when the caller already cancelled", async () => {
		const controller = new AbortController();
		controller.abort();
		await assert.rejects(
			new DiySearchProvider(() => optionsFor("qwen/responses")).search({ query: "x" }, controller.signal),
			(error) => error instanceof WebError && error.code === "WEB_ABORTED"
		);
	});

	it("inflates a gzip body that ignores accept-encoding", async () => {
		const original = globalThis.fetch;
		globalThis.fetch = async () => new Response(gzipSync(JSON.stringify(RESPONSES_BODY)), { status: 200, headers: { "content-type": "application/json" } });
		try {
			const result = await new DiySearchProvider(() => optionsFor("qwen/responses")).search({ query: "x" });
			assert.equal(result.sources.length, 1);
		} finally {
			globalThis.fetch = original;
		}
	});
});

describe("response mapping", () => {
	it("prefers phase=final_answer and joins Zhipu results[] metadata", () => {
		const result = mapResponsesResponse({
			output: [
				{
					type: "web_search_call",
					action: { sources: [{ type: "url", url: "https://z.example/1" }] },
					results: [{ url: "https://z.example/1", title: "Z", snippet: "S" }]
				},
				{ type: "message", phase: "commentary", content: [{ type: "output_text", text: "progress" }] },
				{ type: "message", phase: "final_answer", content: [{ type: "output_text", text: "answer" }] }
			]
		});
		assert.equal(result.content, "answer");
		assert.deepEqual(result.sources, [{ url: "https://z.example/1", title: "Z", snippet: "S" }]);
	});

	it("rejects a response with neither search blocks nor citations", () => {
		assert.throws(() => mapResponsesResponse({ output: [{ type: "message", content: [{ type: "output_text", text: "own knowledge" }] }] }), /answered without searching/u);
	});

	it("treats an empty anthropic result list as a successful empty search", () => {
		assert.deepEqual(mapAnthropicResponse({ content: [{ type: "web_search_tool_result", content: [] }] }), { sources: [], truncated: false });
	});

	it("surfaces the anthropic tool error code", () => {
		assert.throws(() => mapAnthropicResponse({ content: [{ type: "web_search_tool_result", content: { error_code: "max_uses_exceeded" } }] }), /max_uses_exceeded/u);
	});

	it("maps zhipu chat, qwen chat, and annotation responses", () => {
		assert.deepEqual(mapZhipuChatResponse(ZHIPU_CHAT_BODY).sources, [{ url: "https://c.example/1", title: "C" }]);
		assert.deepEqual(mapQwenChatResponse(QWEN_CHAT_BODY), { content: "answer", sources: [], truncated: false });
		assert.deepEqual(mapChatAnnotationsResponse(ANNOTATIONS_BODY).sources, [{ url: "https://d.example/1", title: "D" }]);
	});
});