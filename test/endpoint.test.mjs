/**
 * 配置端点契约：GET 下发 catalog 与选择，POST 按 target 校验并保存。
 */
import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, before, beforeEach, describe, it } from "node:test";
import { apply } from "../lib/index.js";

let home;
const originalHome = process.env.DSH_HOME;

before(() => {
	home = mkdtempSync(join(tmpdir(), "dsh-web-search-diy-endpoint-"));
	process.env.DSH_HOME = home;
});

after(() => {
	if (originalHome === void 0) delete process.env.DSH_HOME;
	else process.env.DSH_HOME = originalHome;
	rmSync(home, { recursive: true, force: true });
});

beforeEach(() => {
	rmSync(join(home, "dsh-web-search-diy.json"), { force: true });
	rmSync(join(home, "dsh-web-search-diy.json.v2.bak"), { force: true });
});

/** Minimal request double: emits the JSON body on the next tick. */
function fakeRequest(method, body) {
	const req = new EventEmitter();
	req.method = method;
	if (body !== void 0) {
		const payload = JSON.stringify(body);
		process.nextTick(() => {
			req.emit("data", payload);
			req.emit("end");
		});
	}
	return req;
}

/** Minimal response double capturing status, headers, and payload. */
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

/** Register the plugin against stubs and return the config and test handlers. */
function registerHandlers(resolvedNames = null) {
	let configHandler;
	let testHandler;
	const credentials = {
		resolve: async (ref) => resolvedNames === null || resolvedNames.includes(ref) ? { value: "sk-test" } : void 0,
		set: async () => {}
	};
	const ctx = {
		get: (name) => name === "credentials" ? credentials : void 0,
		inject(names, callback) {
			/** The injected child owns its own effect scope; the routes stay registered for the test. */
			const child = {
				webServer: { register(entry) {
					if (entry.path.endsWith("/config")) configHandler = entry.handler;
					if (entry.path.endsWith("/test")) testHandler = entry.handler;
					return () => {};
				} },
				effect(fn) { fn(); }
			};
			if (names.includes("webServer")) callback(child);
		},
		web: { registerSearchProvider() {} },
		effect(fn) { fn(); }
	};
	apply(ctx);
	if (configHandler === void 0) throw new Error("config handler was not registered");
	if (testHandler === void 0) throw new Error("test handler was not registered");
	return { configHandler, testHandler };
}

/** The config handler alone, for the existing cases. */
function configHandler(resolvedNames = null) {
	return registerHandlers(resolvedNames).configHandler;
}

/** POST one body and decode the response. */
async function post(body, resolvedNames = null) {
	const response = fakeResponse();
	await configHandler(resolvedNames)(fakeRequest("POST", body), response);
	return { status: response.status, headers: response.headers, body: JSON.parse(response.payload) };
}

/** GET the configuration. */
async function get(resolvedNames = null) {
	const response = fakeResponse();
	await configHandler(resolvedNames)(fakeRequest("GET"), response);
	return { status: response.status, headers: response.headers, body: JSON.parse(response.payload) };
}

describe("GET /api/web-search-diy/config", () => {
	it("serves every catalog entry, the selection, and the key state", async () => {
		const { status, headers, body } = await get();
		assert.equal(status, 200);
		assert.equal(headers["Cache-Control"], "no-store", "the config must not be cached by the browser");
		assert.equal(body.version, 3);
		assert.equal(body.catalog.length, 29);
		assert.ok(body.catalog.some((entry) => entry.id === "kimi/chat-completions" && entry.support === "unsupported"));
		assert.ok(body.catalog.filter((entry) => entry.support === "custom").length === 4);
		assert.deepEqual(body.selection, { vendor: "deepseek", protocol: "search" }, "a fresh install opens on the DeepSeek standalone search");
		assert.deepEqual(body.shapeDefaults, { "in-protocol": "deepseek/anthropic-messages", standalone: "deepseek/search" }, "the host declares where each shape switch lands");
		assert.deepEqual(body.targets, {});
		assert.equal(body.keyConfigured, true);
	});

	it("reports the saved target configuration", async () => {
		await post({ vendor: "zhipu", protocol: "chat-completions", baseURL: "https://gw.example/v4", count: 20 });
		const { body } = await get();
		assert.deepEqual(body.selection, { vendor: "zhipu", protocol: "chat-completions" });
		assert.deepEqual(body.target, { baseURL: "https://gw.example/v4", count: 20 });
	});

	it("probes every vendor's default chain for the credential badge", async () => {
		const { body } = await get(["QWEN_TOKEN_PLAN_API_KEY"]);
		assert.equal(body.credentials.qwen, true, "the qwen chain resolves");
		assert.equal(body.credentials.deepseek, false);
		assert.equal(body.credentials.openai, false);
		assert.equal(body.credentials.custom, false, "custom has no default chain");
		assert.deepEqual(body.selection, { vendor: "qwen", protocol: "responses" }, "only qwen has a key, so it becomes the default");
	});

	it("prefers the DeepSeek standalone search when its key resolves", async () => {
		const { body } = await get(["DEEPSEEK_API_KEY"]);
		assert.equal(body.credentials.deepseek, true);
		assert.deepEqual(body.selection, { vendor: "deepseek", protocol: "search" });
	});

	it("falls back to the default target when no credential resolves", async () => {
		const { body } = await get([]);
		assert.deepEqual(body.selection, { vendor: "deepseek", protocol: "search" }, "a first run without keys still lands on the default target");
	});

	it("caches the per-vendor probe and re-probes after a save", async () => {
		let handler;
		const resolutions = [];
		const credentials = {
			resolve: async (ref) => {
				resolutions.push(ref);
				return { value: "sk-test" };
			},
			set: async () => {}
		};
		const ctx = {
			get: (name) => name === "credentials" ? credentials : void 0,
			inject(names, callback) {
				const child = {
					webServer: { register(entry) { if (entry.path.endsWith("/config")) handler = entry.handler; return () => {}; } },
					effect(fn) { fn(); }
				};
				if (names.includes("webServer")) callback(child);
			},
			web: { registerSearchProvider() {} },
			effect(fn) { fn(); }
		};
		apply(ctx);
		const openaiProbes = () => resolutions.filter((ref) => ref === "OPENAI_API_KEY").length;
		const call = async (method, body) => {
			const response = fakeResponse();
			await handler(fakeRequest(method, body), response);
			return response;
		};
		await call("GET");
		assert.equal(openaiProbes(), 1, "the first GET probes every vendor");
		await call("GET");
		assert.equal(openaiProbes(), 1, "a second GET within the TTL reuses the probe");
		await call("POST", { vendor: "zhipu", protocol: "search", count: 5 });
		await call("GET");
		assert.equal(openaiProbes(), 2, "saving invalidates the cached probe");
	});

	it("projects each entry's field specs alongside its fields", async () => {
		const { body } = await get();
		const zhipu = body.catalog.find((entry) => entry.id === "zhipu/chat-completions");
		assert.deepEqual(Object.keys(zhipu.specs).sort(), [...zhipu.fields].sort(), "specs cover exactly the declared fields");
		assert.deepEqual(zhipu.specs.count, { kind: "positiveInt", max: 50 });
		assert.deepEqual(zhipu.specs.apiKeyEnv, { kind: "refName" }, "a credential reference keeps its grammar on the wire");
		assert.deepEqual(zhipu.specs.searchEngine, { kind: "enum", values: ["search_std", "search_pro", "search_pro_sogou", "search_pro_quark"] });
		const kimi = body.catalog.find((entry) => entry.id === "kimi/search");
		assert.deepEqual(kimi.specs.count, { kind: "positiveInt", max: 20 }, "Kimi's cap is a per-target exception");
		const custom = body.catalog.find((entry) => entry.id === "custom/search");
		assert.deepEqual(custom.specs.searchEngine, { kind: "string" }, "a custom gateway accepts any engine name");
	});
});

describe("POST /api/web-search-diy/config", () => {
	it("saves the declared fields of a target and returns ok", async () => {
		const { status, body } = await post({ vendor: "zhipu", protocol: "chat-completions", model: "glm-5.3-flash", count: 15 });
		assert.equal(status, 200);
		assert.equal(body.ok, true);
		assert.equal(body.targets["zhipu/chat-completions"].model, "glm-5.3-flash");
	});

	it("rejects an unknown target", async () => {
		const { status, body } = await post({ vendor: "nope", protocol: "responses" });
		assert.equal(status, 400);
		assert.match(body.error, /未知的 target/u);
	});

	it("rejects a target marked unsupported", async () => {
		const { status, body } = await post({ vendor: "kimi", protocol: "chat-completions" });
		assert.equal(status, 400);
		assert.match(body.error, /不可用/u);
	});

	it("rejects a field the target does not declare", async () => {
		const { status, body } = await post({ vendor: "deepseek", protocol: "responses", includeSources: true });
		assert.equal(status, 400);
		assert.match(body.error, /includeSources/u);
	});

	it("rejects a custom standalone target without a path", async () => {
		const { status, body } = await post({ vendor: "custom", protocol: "search", path: "" });
		assert.equal(status, 400);
		assert.match(body.error, /path/u);
	});

	it("accepts a custom standalone target without the reference template", async () => {
		const { status, body } = await post({ vendor: "custom", protocol: "search", path: "/v1/tools/search", apiKeyEnv: "GW_KEY", count: 8 });
		assert.equal(status, 200, body.error);
		assert.equal(body.targets["custom/search"].path, "/v1/tools/search");
		assert.equal(body.targets["custom/search"].template, void 0);
	});

	it("rejects the reference template as a configuration key", async () => {
		const { status, body } = await post({ vendor: "custom", protocol: "search", path: "/web_search", template: "kimi" });
		assert.equal(status, 400);
		assert.match(body.error, /template/u);
	});

	it("saves Zhipu's search parameters on a custom standalone target", async () => {
		const { status, body } = await post({ vendor: "custom", protocol: "search", path: "/web_search", apiKeyEnv: "GW_KEY", contentSize: "high", searchIntent: true });
		assert.equal(status, 200, body.error);
		assert.equal(body.targets["custom/search"].contentSize, "high");
		assert.equal(body.targets["custom/search"].searchIntent, true);
	});

	it("rejects a count Zhipu's sogou engine cannot use", async () => {
		const bad = await post({ vendor: "zhipu", protocol: "search", searchEngine: "search_pro_sogou", count: 15 });
		assert.equal(bad.status, 400);
		assert.match(bad.body.error, /10\/20\/30\/40\/50/u);
		const good = await post({ vendor: "zhipu", protocol: "search", searchEngine: "search_pro_sogou", count: 20 });
		assert.equal(good.status, 200, good.body.error);
	});

	it("saves a custom gateway's own engine name", async () => {
		const { status, body } = await post({ vendor: "custom", protocol: "search", path: "/web_search", apiKeyEnv: "GW_KEY", searchEngine: "searxng" });
		assert.equal(status, 200, body.error);
		assert.equal(body.targets["custom/search"].searchEngine, "searxng");
	});

	it("rejects a request without vendor/protocol", async () => {
		const { status, body } = await post({ model: "x" });
		assert.equal(status, 400);
		assert.match(body.error, /vendor/u);
	});
});

describe("POST /api/web-search-diy/test", () => {
	/** Run one draft through the test-connection handler. */
	async function runTest(body) {
		const response = fakeResponse();
		await registerHandlers().testHandler(fakeRequest("POST", body), response);
		return { status: response.status, body: JSON.parse(response.payload) };
	}

	it("applies the same custom validation as saving", async () => {
		const { status, body } = await runTest({ vendor: "custom", protocol: "search", baseURL: "https://gw.example", apiKeyEnv: "GW_KEY" });
		assert.equal(status, 400, "a missing path must fail before any request is sent");
		assert.match(body.error, /path/u);
	});

	it("rejects a request body over the size limit", async () => {
		const { status, body } = await runTest({ vendor: "zhipu", protocol: "search", count: "x".repeat(1024 * 1024 + 1) });
		assert.equal(status, 413);
		assert.match(body.error, /过大/u);
	});
});

describe("plugin lifecycle", () => {
	it("disposes both config routes when the plugin unloads", () => {
		const routes = [];
		const disposed = [];
		const disposers = [];
		const ctx = {
			get: () => void 0,
			inject(names, callback) {
				const child = {
					webServer: { register(entry) { routes.push(entry.path); return () => disposed.push(entry.path); } },
					effect(fn) {
						const result = fn();
						if (typeof result === "function") disposers.push(result);
					}
				};
				callback(child);
			},
			web: { registerSearchProvider() {} },
			effect(fn) {
				const result = fn();
				if (typeof result === "function") disposers.push(result);
			}
		};
		apply(ctx);
		assert.deepEqual(routes, ["/api/web-search-diy/config", "/api/web-search-diy/test"]);
		for (const dispose of disposers) dispose();
		assert.deepEqual(disposed, routes);
	});
});