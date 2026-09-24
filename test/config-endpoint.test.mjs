/**
 * End-to-end regression for the configuration endpoint's blank handling.
 *
 * Reported symptom: in Anthropic mode a blank `apiVersion` saved fine while a
 * blank `maxUses` refused to save, even though both have defaults. Cause was
 * `body.maxUses !== undefined` + `Number("") === 0` in the POST handler, while
 * string fields were skipped when blank. These cases drive the real handler
 * (registered through `apply`) so the wiring and the file effect are both
 * covered, not just the pure patcher.
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

/** POST one body and return the decoded response. */
async function post(handler, body) {
	const response = fakeResponse();
	await handler(fakeRequest("POST", body), response);
	return { status: response.status, body: JSON.parse(response.payload) };
}

/** The persisted configuration file, or an empty object when absent. */
function storedConfig() {
	try {
		return JSON.parse(readFileSync(join(home, CONFIG_FILE), "utf8"));
	} catch {
		return {};
	}
}

describe("configuration endpoint blank handling", () => {
	it("saves a blank maxUses instead of rejecting it (the reported symptom)", async () => {
		const handler = configHandler();
		const result = await post(handler, { mode: "anthropic-messages", maxUses: "" });
		assert.equal(result.status, 200);
		assert.equal(result.body.ok, true);
		assert.deepEqual(storedConfig(), { mode: "anthropic-messages" });
	});

	it("saves a blank count and maxOutputTokens the same way", async () => {
		const handler = configHandler();
		assert.equal((await post(handler, { count: "" })).status, 200);
		assert.equal((await post(handler, { maxOutputTokens: "" })).status, 200);
		assert.deepEqual(storedConfig(), {});
	});

	it("clears a previously stored value when the field is blanked", async () => {
		const handler = configHandler();
		writeFileSync(join(home, CONFIG_FILE), JSON.stringify({
			mode: "anthropic-messages",
			baseURL: "https://api.deepseek.com/anthropic/v1",
			model: "deepseek-flash",
			maxUses: 5
		}));
		const result = await post(handler, { baseURL: "", maxUses: "" });
		assert.equal(result.status, 200);
		assert.deepEqual(storedConfig(), { mode: "anthropic-messages", model: "deepseek-flash" });
	});

	it("keeps keys the body does not mention", async () => {
		const handler = configHandler();
		writeFileSync(join(home, CONFIG_FILE), JSON.stringify({ mode: "anthropic-messages", maxUses: 5 }));
		const result = await post(handler, { apiVersion: "2024-01-01" });
		assert.equal(result.status, 200);
		assert.deepEqual(storedConfig(), { mode: "anthropic-messages", maxUses: 5, apiVersion: "2024-01-01" });
	});

	it("still rejects a present-but-invalid value, naming the key", async () => {
		const handler = configHandler();
		const result = await post(handler, { maxUses: 0 });
		assert.equal(result.status, 400);
		assert.match(result.body.error, /^maxUses 必须是不小于 1 的整数$/);
		assert.deepEqual(storedConfig(), {});
	});

	it("reports the stored configuration on GET", async () => {
		writeFileSync(join(home, CONFIG_FILE), JSON.stringify({ mode: "anthropic-messages", maxUses: 5 }));
		const response = fakeResponse();
		await configHandler()(fakeRequest("GET"), response);
		assert.equal(response.status, 200);
		const body = JSON.parse(response.payload);
		assert.equal(body.mode, "anthropic-messages");
		assert.equal(body.maxUses, 5);
		assert.equal(body.keyConfigured, false); // no credentials service in this stub
	});
});
