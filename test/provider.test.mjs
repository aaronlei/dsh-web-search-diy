/**
 * Provider 契约：`available()` 与 `ready()` 对 target 可用性和凭据的判断。
 *
 * `ready()` 是 `ctx.web.searchReady()` 的唯一数据源；它决定 `web_search` 是否对
 * 模型可见，因此不联网、只读配置与凭据面。
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { DiySearchProvider, resolveOptions } from "../lib/index.js";

/** 只提供凭据面的 ctx；`value` 为 undefined 表示服务里没有这条凭据。 */
function ctxWithCredential(value) {
	return {
		get: (name) => name === "credentials"
			? { resolve: async () => value === void 0 ? void 0 : { value } }
			: void 0
	};
}

/** 解析一个 target 的选项；默认带一条可解析的测试凭据。 */
function optionsFor(target, bucket = {}, ctx = ctxWithCredential("sk-test")) {
	return resolveOptions(ctx, { version: 3, targets: { [target]: bucket } }, target);
}

/** 一个字段齐全、只缺凭据的自定义纯工具 target。 */
const CUSTOM_TARGET = { baseURL: "https://gw.example", path: "/search", apiKeyEnv: "DSH_TEST_PROVIDER_KEY" };

describe("DiySearchProvider readiness", () => {
	it("is ready when the configured credential resolves", async () => {
		const provider = new DiySearchProvider(() => optionsFor("custom/search", CUSTOM_TARGET));
		assert.equal(provider.available(), true);
		assert.equal(await provider.ready(), true);
	});

	it("is not ready when no credential resolves", async () => {
		const provider = new DiySearchProvider(() => optionsFor("custom/search", CUSTOM_TARGET, ctxWithCredential(void 0)));
		assert.equal(provider.available(), true);
		assert.equal(await provider.ready(), false);
	});

	it("is not ready when the target itself is unavailable", async () => {
		const provider = new DiySearchProvider(() => optionsFor("custom/search", { baseURL: "https://gw.example", path: "/search" }));
		assert.equal(provider.available(), false);
		assert.equal(await provider.ready(), false);
	});

	it("is not ready for an unsupported target", async () => {
		const provider = new DiySearchProvider(() => optionsFor("kimi/chat-completions"));
		assert.equal(provider.available(), false);
		assert.equal(await provider.ready(), false);
	});

	it("treats a credential resolution failure as not ready", async () => {
		const ctx = { get: (name) => name === "credentials" ? { resolve: async () => { throw new Error("credentials unavailable"); } } : void 0 };
		const provider = new DiySearchProvider(() => optionsFor("custom/search", CUSTOM_TARGET, ctx));
		assert.equal(await provider.ready(), false);
	});
});
