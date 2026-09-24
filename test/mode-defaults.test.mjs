/**
 * Mode-scoped default resolution in `resolveOptions`.
 *
 * Background: the settings section's schema freezes a default into every key,
 * so a deployment that never edited the endpoint still carries the `responses`
 * mode's Qwen address. Adding a third family of defaults (the Anthropic
 * Messages endpoint) made the old "is this zhipu?" boolean wrong, so the
 * resolution is now driven by MODE_PROFILES: an empty value inherits the
 * current mode's default, another mode's default is treated as a fossil, and
 * anything else is the user's own value. These tests pin that contract,
 * including the UI-managed file's precedence over the section.
 *
 * Run: node --test "test/**\/*.test.mjs"
 */
import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, before, beforeEach, describe, it } from "node:test";
import { OpenAiSearchProvider, apply, resolveOptions } from "../lib/index.js";

const QWEN_BASE_URL = "https://token-plan.cn-beijing.maas.aliyuncs.com/compatible-mode/v1";
const ZHIPU_BASE_URL = "https://open.bigmodel.cn/api/paas/v4";
const DEEPSEEK_BASE_URL = "https://api.deepseek.com/anthropic/v1";

let home;
const originalHome = process.env.DSH_HOME;

before(() => {
	home = mkdtempSync(join(tmpdir(), "dsh-web-search-diy-test-"));
	process.env.DSH_HOME = home;
});

after(() => {
	if (originalHome === void 0) delete process.env.DSH_HOME;
	else process.env.DSH_HOME = originalHome;
	rmSync(home, { recursive: true, force: true });
});

beforeEach(() => {
	rmSync(join(home, "dsh-web-search-diy.json"), { force: true });
});

/** A fully-defaulted settings section, shaped as `apply` projects it. */
function section(overrides = {}) {
	return {
		apiKey: void 0,
		apiKeyEnv: "",
		baseURL: "",
		mode: "responses",
		model: "",
		maxOutputTokens: 1024,
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
		searchPrompt: "",
		...overrides
	};
}

/** Write the UI-managed file the web card owns. */
function writeFileConfig(config) {
	writeFileSync(join(home, "dsh-web-search-diy.json"), JSON.stringify(config));
}

/** `resolveOptions` only reads the credential, launch-environment, and agents services. */
const ctx = { get: () => void 0 };

describe("mode-scoped defaults", () => {
	it("resolves the DeepSeek Anthropic defaults in anthropic-messages mode", () => {
		const options = resolveOptions(ctx, section({ mode: "anthropic-messages" }));
		assert.equal(options.mode, "anthropic-messages");
		assert.equal(options.baseURL, DEEPSEEK_BASE_URL);
		assert.equal(options.apiKeyEnv, "DEEPSEEK_API_KEY");
		assert.equal(options.model, "deepseek-flash");
		assert.equal(options.apiVersion, "2023-06-01");
		assert.equal(options.maxUses, 5);
	});

	it("keeps the historical defaults in responses mode", () => {
		const options = resolveOptions(ctx, section());
		assert.equal(options.baseURL, QWEN_BASE_URL);
		assert.equal(options.apiKeyEnv, "QWEN_TOKEN_PLAN_CN_API_KEY");
		assert.equal(options.model, "deepseek-v4-flash-0731");
	});

	it("treats another mode's default endpoint as a fossil, never as a choice", () => {
		const zhipu = resolveOptions(ctx, section({ mode: "zhipu-chat-search", baseURL: QWEN_BASE_URL }));
		assert.equal(zhipu.baseURL, ZHIPU_BASE_URL);
		const anthropic = resolveOptions(ctx, section({ mode: "anthropic-messages", baseURL: QWEN_BASE_URL }));
		assert.equal(anthropic.baseURL, DEEPSEEK_BASE_URL);
		const backToResponses = resolveOptions(ctx, section({ baseURL: ZHIPU_BASE_URL }));
		assert.equal(backToResponses.baseURL, QWEN_BASE_URL);
	});

	it("shares DeepSeek model names across the DeepSeek modes but not with Zhipu", () => {
		const anthropic = resolveOptions(ctx, section({ mode: "anthropic-messages", model: "deepseek-v4-flash-0731" }));
		assert.equal(anthropic.model, "deepseek-v4-flash-0731");
		const zhipu = resolveOptions(ctx, section({ mode: "zhipu-chat-search", model: "deepseek-v4-flash-0731" }));
		assert.equal(zhipu.model, "glm-5.3-flash");
	});

	it("keeps a customized endpoint, credential reference, and model", () => {
		const options = resolveOptions(ctx, section({
			mode: "anthropic-messages",
			baseURL: "https://gateway.internal/anthropic/v1",
			apiKeyEnv: "INTERNAL_SEARCH_KEY",
			model: "deepseek-v4-flash-0731"
		}));
		assert.equal(options.baseURL, "https://gateway.internal/anthropic/v1");
		assert.equal(options.apiKeyEnv, "INTERNAL_SEARCH_KEY");
		assert.equal(options.model, "deepseek-v4-flash-0731");
	});

	it("lets the UI-managed file override the section for every mode-scoped key", () => {
		writeFileConfig({
			mode: "anthropic-messages",
			baseURL: "https://file.example/anthropic/v1",
			apiKeyEnv: "FILE_KEY",
			model: "file-model",
			apiVersion: "2024-01-01",
			maxUses: 9
		});
		const options = resolveOptions(ctx, section({ mode: "responses", baseURL: QWEN_BASE_URL }));
		assert.equal(options.mode, "anthropic-messages");
		assert.equal(options.baseURL, "https://file.example/anthropic/v1");
		assert.equal(options.apiKeyEnv, "FILE_KEY");
		assert.equal(options.model, "file-model");
		assert.equal(options.apiVersion, "2024-01-01");
		assert.equal(options.maxUses, 9);
	});

	it("strips a trailing slash from the resolved endpoint", () => {
		const options = resolveOptions(ctx, section({ mode: "anthropic-messages", baseURL: "https://gateway.example/v1///" }));
		assert.equal(options.baseURL, "https://gateway.example/v1");
	});
});

describe("apply() wiring", () => {
	it("registers a provider that posts to the Anthropic default endpoint", async () => {
		let registeredProvider;
		// The settings service projects the section into a plain value object and
		// hands it back through `setSource`; mirror that so `resolveOptions` sees
		// resolved values rather than schema refs.
		const ctx = {
			get: () => void 0,
			inject(names, callback) {
				if (names.includes("settings")) {
					callback({
						settings: {
							installSection(_pluginCtx, _namespace, _schema, _config, options) {
								options.setSource(() => section({ apiKey: "test-key", mode: "anthropic-messages" }));
							}
						}
					});
				}
			},
			web: {
				registerSearchProvider(provider) {
					registeredProvider = provider;
				}
			}
		};
		apply(ctx, {});
		assert.equal(registeredProvider.id, "diy-search");

		const calls = [];
		const realFetch = globalThis.fetch;
		globalThis.fetch = async (url, init) => {
			calls.push({ url, init });
			return new Response(JSON.stringify({
				content: [{ type: "web_search_tool_result", content: [{ type: "web_search_result", url: "https://e.example/" }] }]
			}));
		};
		try {
			const result = await registeredProvider.search({ query: "q" });
			assert.equal(calls[0].url, "https://api.deepseek.com/anthropic/v1/messages");
			assert.deepEqual(result.sources, [{ url: "https://e.example/" }]);
		} finally {
			globalThis.fetch = realFetch;
		}
	});
});

describe("output budget and environment fallback", () => {
	it("defaults the Anthropic turn to 4096 while keeping 1024 elsewhere", () => {
		assert.equal(resolveOptions(ctx, section({ mode: "anthropic-messages" })).maxOutputTokens, 4096);
		assert.equal(resolveOptions(ctx, section({ mode: "responses" })).maxOutputTokens, 1024);
		assert.equal(resolveOptions(ctx, section({ mode: "zhipu-web-search" })).maxOutputTokens, 1024);
	});

	it("keeps a custom budget in every mode, including 4096 set outside the Anthropic mode", () => {
		assert.equal(resolveOptions(ctx, section({ mode: "anthropic-messages", maxOutputTokens: 2048 })).maxOutputTokens, 2048);
		assert.equal(resolveOptions(ctx, section({ mode: "zhipu-chat-search", maxOutputTokens: 4096 })).maxOutputTokens, 4096);
		assert.equal(resolveOptions(ctx, section({ mode: "responses", maxOutputTokens: 8192 })).maxOutputTokens, 8192);
	});

	it("lets the UI-managed file win over the mode's budget default", () => {
		writeFileConfig({ mode: "anthropic-messages", maxOutputTokens: 16384 });
		assert.equal(resolveOptions(ctx, section({ mode: "anthropic-messages" })).maxOutputTokens, 16384);
	});

	it("defaults the Anthropic thinking switch to the model's own mode", () => {
		assert.equal(resolveOptions(ctx, section({ mode: "anthropic-messages" })).anthropicThinking, "default");
		assert.equal(resolveOptions(ctx, section({ mode: "anthropic-messages", anthropicThinking: "disabled" })).anthropicThinking, "disabled");
		writeFileConfig({ mode: "anthropic-messages", anthropicThinking: "disabled" });
		assert.equal(resolveOptions(ctx, section({ mode: "anthropic-messages" })).anthropicThinking, "disabled");
	});

	it("honors DEEPSEEK_SEARCH_BASE_URL in the Anthropic mode only", () => {
		const previous = process.env.DEEPSEEK_SEARCH_BASE_URL;
		process.env.DEEPSEEK_SEARCH_BASE_URL = "https://env.example/anthropic/v1";
		try {
			assert.equal(resolveOptions(ctx, section({ mode: "anthropic-messages" })).baseURL, "https://env.example/anthropic/v1");
			assert.equal(resolveOptions(ctx, section({ mode: "zhipu-web-search" })).baseURL, ZHIPU_BASE_URL);
			assert.equal(resolveOptions(ctx, section({ mode: "anthropic-messages", baseURL: "https://section.example/v1" })).baseURL, "https://section.example/v1");
		} finally {
			if (previous === void 0) delete process.env.DEEPSEEK_SEARCH_BASE_URL;
			else process.env.DEEPSEEK_SEARCH_BASE_URL = previous;
		}
	});

	it("records the outbound Anthropic request on the calling session", () => {
		const appends = [];
		const recordingCtx = {
			get: (name) => name === "agents" ? {
				currentInitiator: () => ({
					session: { append: (type, payload) => appends.push({ type, payload }) }
				})
			} : void 0
		};
		const options = resolveOptions(recordingCtx, section({ mode: "anthropic-messages" }));
		const request = { endpoint: "https://api.deepseek.com/anthropic/v1/messages", apiVersion: "2023-06-01", body: { model: "deepseek-v4-flash" } };
		options.recordRequest(request);
		assert.deepEqual(appends, [{ type: "web/deepseek-search-llm-request", payload: request }]);
	});
});

describe("credential reference chain", () => {
	/** A credentials service backed by an in-memory map. */
	function credentialsWith(values) {
		return {
			resolve: async (ref) => values[String(ref)] === void 0 ? void 0 : { value: values[String(ref)] }
		};
	}

	/** A context whose only service is that credentials map. */
	function ctxWith(values) {
		return { get: (name) => name === "credentials" ? credentialsWith(values) : void 0 };
	}

	it("carries the deployment's Zhipu reference behind the canonical one", () => {
		const options = resolveOptions(ctx, section({ mode: "zhipu-chat-search" }));
		assert.equal(String(options.apiKeyEnv), "ZHIPU_API_KEY");
		assert.deepEqual(options.apiKeyEnvFallbacks.map(String), ["ZAI_CODING_CN_API_KEY"]);
	});

	it("resolves the canonical reference first, then the fallback", async () => {
		const canonical = resolveOptions(ctxWith({ ZHIPU_API_KEY: "zhipu-key" }), section({ mode: "zhipu-web-search" }));
		assert.equal(await canonical.resolveApiKey(), "zhipu-key");
		const fallback = resolveOptions(ctxWith({ ZAI_CODING_CN_API_KEY: "zai-key" }), section({ mode: "zhipu-web-search" }));
		assert.equal(await fallback.resolveApiKey(), "zai-key");
	});

	it("returns nothing when neither reference resolves", async () => {
		const options = resolveOptions(ctxWith({}), section({ mode: "zhipu-web-search" }));
		assert.equal(await options.resolveApiKey(), void 0);
	});

	it("walks the chain through the launching environment when no credentials service is mounted", async () => {
		const previous = process.env.ZAI_CODING_CN_API_KEY;
		process.env.ZAI_CODING_CN_API_KEY = "ambient-zai-key";
		try {
			const options = resolveOptions({ get: () => void 0 }, section({ mode: "zhipu-chat-search" }));
			assert.equal(await options.resolveApiKey(), "ambient-zai-key");
		} finally {
			if (previous === void 0) delete process.env.ZAI_CODING_CN_API_KEY;
			else process.env.ZAI_CODING_CN_API_KEY = previous;
		}
	});

	it("uses an explicitly configured reference alone, without the chain", () => {
		writeFileConfig({ mode: "zhipu-web-search", apiKeyEnv: "MY_ZHIPU_KEY" });
		const options = resolveOptions(ctx, section({ mode: "zhipu-web-search" }));
		assert.equal(String(options.apiKeyEnv), "MY_ZHIPU_KEY");
		assert.deepEqual(options.apiKeyEnvFallbacks, []);
	});

	it("names every candidate in the missing-credential error", async () => {
		const options = resolveOptions(ctxWith({}), section({ mode: "zhipu-web-search" }));
		const provider = new OpenAiSearchProvider(() => options);
		await assert.rejects(provider.search({ query: "q" }), (error) => {
			assert.equal(error.code, "WEB_PROVIDER_CREDENTIAL_MISSING");
			assert.match(error.message, /"ZHIPU_API_KEY" or "ZAI_CODING_CN_API_KEY"/);
			return true;
		});
	});

	it("reports an empty chain for the DeepSeek modes", () => {
		for (const mode of ["responses", "anthropic-messages"]) {
			const options = resolveOptions(ctx, section({ mode }));
			assert.deepEqual(options.apiKeyEnvFallbacks, [], mode);
		}
	});
});

