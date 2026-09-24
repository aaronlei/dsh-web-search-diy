/**
 * End-to-end regressions for the configuration endpoint.
 *
 * Two behaviours are pinned here:
 *   1. blank handling — a blank numeric field used to fail validation
 *      (`Number("") === 0`) while a blank string field silently kept its value,
 *      so "leave blank for the default" was true for some fields and false for
 *      others;
 *   2. per-mode buckets — every mode owns its own settings, so switching modes
 *      restores that mode's values instead of overwriting them, and a legacy
 *      flat file is projected onto the mode it selected.
 *
 * The real handler is driven through `apply`, so the wiring and the file effect
 * are covered, not just the pure patcher.
 *
 * Run: node --test "test/**\/*.test.mjs"
 */
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, before, beforeEach, describe, it } from "node:test";
import { apply } from "../lib/index.js";

const CONFIG_FILE = "dsh-web-search-diy.json";
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
	rmSync(join(home, CONFIG_FILE), { force: true });
});

/** A request whose `data`/`end` handlers fire synchronously. */
function fakeRequest(method, body) {
	return {
		method,
		on(event, handler) {
			if (event === "data" && body !== void 0) handler(Buffer.from(JSON.stringify(body)));
			if (event === "end") handler();
			return this;
		}
	};
}

function fakeResponse() {
	return {
		status: 0,
		payload: "",
		writeHead(status) {
			this.status = status;
		},
		end(payload) {
			this.payload = payload;
		}
	};
}

/** Register the plugin against a stub web server and return the config handler. */
function configHandler() {
	let handler;
	const ctx = {
		get: () => void 0,
		inject(names, callback) {
			if (names.includes("settings")) callback({ settings: { installSection() {} } });
			if (names.includes("webServer")) callback({ get: () => void 0, webServer: { register(entry) { handler = entry.handler; } } });
		},
		web: { registerSearchProvider() {} }
	};
	apply(ctx, {});
	if (handler === void 0) throw new Error("the config handler was not registered");
	return handler;
}

/** POST one body through a fresh handler and return the decoded response. */
async function post(body) {
	const response = fakeResponse();
	await configHandler()(fakeRequest("POST", body), response);
	return { status: response.status, body: JSON.parse(response.payload) };
}

/** GET the configuration through a fresh handler. */
async function get() {
	const response = fakeResponse();
	await configHandler()(fakeRequest("GET"), response);
	return { status: response.status, body: JSON.parse(response.payload) };
}

/** The persisted document as stored on disk. */
function storedDocument() {
	try {
		return JSON.parse(readFileSync(join(home, CONFIG_FILE), "utf8"));
	} catch {
		return { version: 2, modes: {} };
	}
}

const storedBucket = (mode) => storedDocument().modes[mode];
const writeLegacy = (flat) => writeFileSync(join(home, CONFIG_FILE), JSON.stringify(flat));
const writeDocument = (document) => writeFileSync(join(home, CONFIG_FILE), JSON.stringify(document));

describe("configuration endpoint blank handling", () => {
	it("saves a blank maxUses instead of rejecting it (the reported symptom)", async () => {
		const result = await post({ mode: "anthropic-messages", maxUses: "" });
		assert.equal(result.status, 200);
		assert.equal(result.body.ok, true);
		const document = storedDocument();
		assert.equal(document.mode, "anthropic-messages");
		assert.deepEqual(document.modes, {});
	});

	it("saves a blank count and maxOutputTokens the same way", async () => {
		assert.equal((await post({ count: "" })).status, 200);
		assert.equal((await post({ maxOutputTokens: "" })).status, 200);
		assert.deepEqual(storedDocument().modes, {});
	});

	it("clears a previously stored value when the field is blanked", async () => {
		writeDocument({
			version: 2,
			mode: "anthropic-messages",
			modes: { "anthropic-messages": { baseURL: "https://api.deepseek.com/anthropic/v1", model: "deepseek-flash", maxUses: 5 } }
		});
		const result = await post({ mode: "anthropic-messages", baseURL: "", maxUses: "" });
		assert.equal(result.status, 200);
		assert.deepEqual(storedBucket("anthropic-messages"), { model: "deepseek-flash" });
	});

	it("keeps keys the body does not mention", async () => {
		writeDocument({ version: 2, mode: "anthropic-messages", modes: { "anthropic-messages": { maxUses: 5 } } });
		assert.equal((await post({ mode: "anthropic-messages", apiVersion: "2024-01-01" })).status, 200);
		assert.deepEqual(storedBucket("anthropic-messages"), { maxUses: 5, apiVersion: "2024-01-01" });
	});

	it("still rejects a present-but-invalid value, naming the key", async () => {
		const result = await post({ mode: "anthropic-messages", maxUses: 0 });
		assert.equal(result.status, 400);
		assert.match(result.body.error, /^maxUses 必须是不小于 1 的整数$/);
		assert.deepEqual(storedDocument().modes, {});
	});
});

describe("configuration endpoint buckets", () => {
	it("keeps every mode's settings in its own bucket, filtered to that mode's keys", async () => {
		await post({ mode: "zhipu-web-search", apiKeyEnv: "ZAI_CODING_CN_API_KEY", model: "GLM-5.3-Flash", count: 20 });
		await post({ mode: "anthropic-messages", apiKeyEnv: "DEEPSEEK_API_KEY", maxUses: 5 });
		// The raw Web Search API has no model turn, so its bucket must not carry `model`.
		assert.deepEqual(storedBucket("zhipu-web-search"), { apiKeyEnv: "ZAI_CODING_CN_API_KEY", count: 20 });
		assert.deepEqual(storedBucket("anthropic-messages"), { apiKeyEnv: "DEEPSEEK_API_KEY", maxUses: 5 });
		assert.equal(storedDocument().mode, "anthropic-messages");
	});

	it("ignores the page's other-mode fields and cleans them out of the bucket", async () => {
		writeDocument({
			version: 2,
			mode: "anthropic-messages",
			modes: { "anthropic-messages": { model: "deepseek-flash", searchEngine: "search_std", count: 20, searchIntent: false } }
		});
		await post({ mode: "anthropic-messages", model: "deepseek-flash", anthropicThinking: "disabled", searchEngine: "search_pro", count: 30, searchIntent: true, reasoningEffort: "max" });
		assert.deepEqual(storedBucket("anthropic-messages"), { model: "deepseek-flash", anthropicThinking: "disabled" });
	});

	it("drops a bucket once nothing is left in it", async () => {
		writeDocument({ version: 2, mode: "responses", modes: { responses: { model: "deepseek-v4-flash-0731" } } });
		await post({ mode: "responses", model: "" });
		assert.deepEqual(storedDocument().modes, {});
	});

	it("projects a legacy flat file onto the mode it selected", async () => {
		writeLegacy({ mode: "zhipu-web-search", apiKeyEnv: "ZAI_CODING_CN_API_KEY", count: 20, maxOutputTokens: 131072 });
		const read = await get();
		assert.equal(read.status, 200);
		assert.equal(read.body.mode, "zhipu-web-search");
		assert.equal(read.body.apiKeyEnv, "ZAI_CODING_CN_API_KEY");
		assert.equal(read.body.count, 20);
		assert.deepEqual(read.body.modes, { "zhipu-web-search": { apiKeyEnv: "ZAI_CODING_CN_API_KEY", count: 20, maxOutputTokens: 131072 } });

		// The next save rewrites the file in the bucketed shape, and the raw Web
		// Search API's bucket keeps only the keys that mode owns — `maxOutputTokens`
		// budgets a model turn, which this mode does not have.
		await post({ mode: "zhipu-web-search", searchEngine: "search_pro" });
		assert.deepEqual(storedDocument(), {
			version: 2,
			mode: "zhipu-web-search",
			modes: { "zhipu-web-search": { apiKeyEnv: "ZAI_CODING_CN_API_KEY", count: 20, searchEngine: "search_pro" } }
		});
	});

	it("serves the selected mode's bucket plus every bucket on GET", async () => {
		writeDocument({
			version: 2,
			mode: "anthropic-messages",
			modes: {
				"anthropic-messages": { maxUses: 5, apiKeyEnv: "DEEPSEEK_API_KEY" },
				"zhipu-web-search": { count: 20 }
			}
		});
		const read = await get();
		assert.equal(read.body.mode, "anthropic-messages");
		assert.equal(read.body.maxUses, 5);
		assert.equal(read.body.apiKeyEnv, "DEEPSEEK_API_KEY");
		assert.equal(read.body.count, void 0);
		assert.deepEqual(read.body.modes, {
			"anthropic-messages": { maxUses: 5, apiKeyEnv: "DEEPSEEK_API_KEY" },
			"zhipu-web-search": { count: 20 }
		});
		assert.equal(read.body.keyConfigured, false); // no credentials service in this stub
	});
});
