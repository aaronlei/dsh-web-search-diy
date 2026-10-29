/**
 * Provider 契约：`available()` 与 `ready()` 对 target 可用性和凭据的判断。
 *
 * `ready()` 是 `ctx.web.searchReady()` 的唯一数据源；它决定 `web_search` 是否对
 * 模型可见，因此不联网、只读配置与凭据面。
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { Context } from "@deepseek-ai/cordis";
import { WebRuntime } from "@deepseek-ai/dsh-web";
import { DiySearchProvider, resolveOptions } from "../lib/index.js";

/** 只提供凭据面的 ctx；`value` 为 undefined 表示服务里没有这条凭据。 */
function ctxWithCredential(value) {
	return {
		get: (name) => name === "credentials"
			? { resolve: async () => value === void 0 ? void 0 : { value } }
			: void 0
	};
}

/** 没有凭据服务，只剩启动环境可读。 */
const ctxWithoutServices = { get: () => void 0 };

/** 解析一个 target 的选项；默认带一条可解析的测试凭据。 */
function optionsFor(target, bucket = {}, ctx = ctxWithCredential("sk-test")) {
	return resolveOptions(ctx, { version: 3, targets: { [target]: bucket } }, target);
}

/** 等待 cordis 插件装载完成。 */
const settle = () => new Promise((resolve) => setTimeout(resolve, 10));

/** 把 provider 注册进真实的 web seam，返回 `ctx.web`。 */
async function seamWith(provider) {
	const ctx = new Context();
	ctx.plugin(WebRuntime);
	await settle();
	const web = ctx.get("web");
	web.registerSearchProvider(provider);
	return web;
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

	it("falls back to the launch environment when no credential service is present", async () => {
		const previous = process.env.DSH_TEST_PROVIDER_KEY;
		process.env.DSH_TEST_PROVIDER_KEY = "sk-env";
		try {
			const provider = new DiySearchProvider(() => optionsFor("custom/search", CUSTOM_TARGET, ctxWithoutServices));
			assert.equal(await provider.ready(), true);
		} finally {
			if (previous === void 0) delete process.env.DSH_TEST_PROVIDER_KEY;
			else process.env.DSH_TEST_PROVIDER_KEY = previous;
		}
	});

	it("logs a diagnostic when the credential check throws", async () => {
		const messages = [];
		const ctx = { get: (name) => name === "credentials" ? { resolve: async () => { throw new Error("keychain locked"); } } : void 0 };
		const provider = new DiySearchProvider(() => optionsFor("custom/search", CUSTOM_TARGET, ctx), (message) => messages.push(message));
		assert.equal(await provider.ready(), false);
		assert.equal(messages.length, 1);
		assert.match(messages[0], /readiness check failed for custom\/search/u);
		assert.match(messages[0], /keychain locked/u);
	});

	it("reports readiness through the real web seam", async () => {
		const previous = process.env.DSH_TEST_PROVIDER_KEY;
		delete process.env.DSH_TEST_PROVIDER_KEY;
		try {
			const notReady = await seamWith(new DiySearchProvider(() => optionsFor("custom/search", CUSTOM_TARGET, ctxWithoutServices)));
			assert.equal(await notReady.searchReady(), false);
			const ready = await seamWith(new DiySearchProvider(() => optionsFor("custom/search", CUSTOM_TARGET)));
			assert.equal(await ready.searchReady(), true);
		} finally {
			if (previous !== void 0) process.env.DSH_TEST_PROVIDER_KEY = previous;
		}
	});
});
