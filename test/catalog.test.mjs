/**
 * 能力矩阵契约：17 个官方 target + 4 个自定义 + 1 个不支持项，字段与端点拼接一致。
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
	CATALOG,
	capabilityOf,
	CUSTOM_TARGETS,
	DEFAULT_TARGET,
	hasField,
	joinEndpoint,
	OFFICIAL_TARGET_IDS,
	splitTargetId,
	UNSUPPORTED_CATALOG
} from "../lib/index.js";

describe("catalog matrix", () => {
	it("covers 17 official targets, 4 custom targets, and 8 unsupported entries", () => {
		assert.equal(OFFICIAL_TARGET_IDS.length, 17);
		assert.equal(Object.keys(CUSTOM_TARGETS).length, 4);
		assert.equal(Object.keys(UNSUPPORTED_CATALOG).length, 8);
	});

	it("splits official support into 13 full and 4 degraded (the pending one is marked degraded)", () => {
		const official = OFFICIAL_TARGET_IDS.map((id) => CATALOG[id]);
		assert.equal(official.filter((entry) => entry.support === "full").length, 13);
		assert.equal(official.filter((entry) => entry.support === "degraded").length, 4);
		assert.ok(official.filter((entry) => entry.support === "degraded").every((entry) => typeof entry.reason === "string" && entry.reason.length > 0));
		/** 降级组合的来源质量必须显式标注：none 表示设计上不返回来源。 */
		assert.equal(CATALOG["qwen/chat-completions"].search.sourceQuality, "none");
		assert.equal(CATALOG["deepseek/responses"].search.sourceQuality, "partial");
		assert.equal(CATALOG["openai/chat-completions"].search.sourceQuality, "partial");
		assert.equal(CATALOG["openrouter/anthropic-messages"].search.sourceQuality, "partial");
	});

	it("declares every key a custom template may fill", () => {
		for (const capability of Object.values(CUSTOM_TARGETS)) {
			const allowed = new Set(capability.fields);
			for (const template of capability.templates ?? []) {
				for (const key of Object.keys(template.defaults)) {
					assert.ok(allowed.has(key), `${capability.id} template ${template.id} fills undeclared ${key}`);
				}
				if (template.chatVariant !== void 0) assert.ok(allowed.has("chatVariant"), capability.id);
				if (template.toolType !== void 0) assert.ok(allowed.has("toolType"), capability.id);
			}
		}
	});

	it("gives every target a non-empty field list except the unsupported entry", () => {
		for (const id of [...OFFICIAL_TARGET_IDS, ...Object.keys(CUSTOM_TARGETS)]) {
			const capability = capabilityOf(id);
			assert.ok(capability, id);
			assert.ok(capability.fields.length > 0, id);
			assert.ok(capability.fields.includes("baseURL"), id);
			assert.ok(capability.fields.includes("apiKeyEnv"), id);
		}
		assert.equal(UNSUPPORTED_CATALOG["kimi/chat-completions"].fields.length, 0);
	});

	it("keeps every declared field unique", () => {
		for (const capability of [...Object.values(CATALOG), ...Object.values(CUSTOM_TARGETS)]) {
			assert.equal(new Set(capability.fields).size, capability.fields.length, capability.id);
		}
	});

	it("omits model/maxOutputTokens but declares the digest limits on standalone targets", () => {
		for (const capability of [...Object.values(CATALOG), ...Object.values(CUSTOM_TARGETS)]) {
			if (capability.protocol !== "search") continue;
			assert.ok(!hasField(capability, "model"), capability.id);
			assert.ok(!hasField(capability, "maxOutputTokens"), capability.id);
			assert.ok(hasField(capability, "digestEntries"), capability.id);
			assert.ok(hasField(capability, "digestSnippetChars"), capability.id);
		}
	});

	it("points the default target at qwen/responses", () => {
		assert.equal(DEFAULT_TARGET, "qwen/responses");
	});

	it("splits and validates target ids", () => {
		assert.deepEqual(splitTargetId("zhipu/chat-completions"), { vendor: "zhipu", protocol: "chat-completions" });
		assert.equal(splitTargetId("zhipu/nope"), void 0);
		assert.equal(splitTargetId("nope/responses"), void 0);
		assert.equal(splitTargetId("zhipu"), void 0);
	});
});

describe("joinEndpoint", () => {
	it("appends a versioned path without duplicating the version segment", () => {
		assert.equal(joinEndpoint("https://api.openai.com/v1", "/v1/messages"), "https://api.openai.com/v1/messages");
		assert.equal(joinEndpoint("https://api.deepseek.com/anthropic", "/v1/messages"), "https://api.deepseek.com/anthropic/v1/messages");
		assert.equal(joinEndpoint("https://api.anthropic.com", "/v1/messages"), "https://api.anthropic.com/v1/messages");
	});

	it("appends a plain path to a versioned base", () => {
		assert.equal(joinEndpoint("https://maas.qianwenaiapi.com/compatible-mode/v1", "/responses"), "https://maas.qianwenaiapi.com/compatible-mode/v1/responses");
		assert.equal(joinEndpoint("https://open.bigmodel.cn/api/paas/v4", "/web_search"), "https://open.bigmodel.cn/api/paas/v4/web_search");
	});

	it("does not append when the base already ends with the path", () => {
		assert.equal(joinEndpoint("https://gateway.example/v1/tools/search", "/v1/tools/search"), "https://gateway.example/v1/tools/search");
	});
});