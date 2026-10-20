/**
 * 配置 v3 契约：读写投影、保存过滤、字段校验、v1/v2 迁移与备份。
 */
import assert from "node:assert/strict";
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { homedir, tmpdir } from "node:os";
import { join } from "node:path";
import { after, before, beforeEach, describe, it } from "node:test";
import {
	buildConfigPatch,
	capabilityOf,
	configFilePath,
	CONFIG_VERSION,
	readConfigDocument,
	saveConfig
} from "../lib/index.js";

let home;
const originalHome = process.env.DSH_HOME;

before(() => {
	home = mkdtempSync(join(tmpdir(), "dsh-web-search-diy-v3-"));
	process.env.DSH_HOME = home;
});

after(() => {
	if (originalHome === void 0) delete process.env.DSH_HOME;
	else process.env.DSH_HOME = originalHome;
	rmSync(home, { recursive: true, force: true });
});

beforeEach(() => {
	rmSync(configFilePath(), { force: true });
	rmSync(`${configFilePath()}.v2.bak`, { force: true });
});

/** Write a raw JSON document to the managed config path. */
function writeRaw(value) {
	writeFileSync(configFilePath(), JSON.stringify(value));
}

/** Read the managed config as raw JSON. */
function readRaw() {
	return JSON.parse(readFileSync(configFilePath(), "utf8"));
}

describe("v3 document", () => {
	it("reads targets, selection, and drops unknown keys and targets", () => {
		writeRaw({
			version: 3,
			vendor: "zhipu",
			protocol: "chat-completions",
			targets: {
				"zhipu/chat-completions": { baseURL: "https://gw.example/v4", count: 20, bogus: "x" },
				"unknown/protocol": { baseURL: "https://nope.example" },
				"qwen/responses": { model: "qwen3.8-flash", includeSources: false }
			}
		});
		const document = readConfigDocument();
		assert.equal(document.version, CONFIG_VERSION);
		assert.equal(document.vendor, "zhipu");
		assert.equal(document.protocol, "chat-completions");
		assert.deepEqual(document.targets["zhipu/chat-completions"], { baseURL: "https://gw.example/v4", count: 20 });
		assert.deepEqual(document.targets["qwen/responses"], { model: "qwen3.8-flash", includeSources: false });
		assert.equal(document.targets["unknown/protocol"], void 0);
	});

	it("ignores an invalid selection", () => {
		writeRaw({ version: 3, vendor: "zhipu", protocol: "search", targets: {} });
		const document = readConfigDocument();
		assert.deepEqual({ vendor: document.vendor, protocol: document.protocol }, { vendor: "zhipu", protocol: "search" });
		writeRaw({ version: 3, vendor: "zhipu", protocol: "nope", targets: {} });
		assert.equal(readConfigDocument().vendor, void 0);
	});

	it("returns an empty document for a missing or malformed file", () => {
		assert.deepEqual(readConfigDocument(), { version: CONFIG_VERSION, targets: {} });
		writeFileSync(configFilePath(), "{not json");
		assert.deepEqual(readConfigDocument(), { version: CONFIG_VERSION, targets: {} });
	});

	it("keeps a custom gateway's engine value on reload", () => {
		writeRaw({ version: 3, vendor: "custom", protocol: "search", targets: { "custom/search": { template: "zhipu", path: "/web_search", searchEngine: "searxng" } } });
		const document = readConfigDocument();
		assert.equal(document.targets["custom/search"].searchEngine, "searxng");
	});
});

describe("saveConfig", () => {
	it("persists only the target's declared fields and keeps other targets", () => {
		writeRaw({ version: 3, targets: { "qwen/responses": { model: "qwen3.8-flash" } } });
		saveConfig("zhipu", "chat-completions", { baseURL: "https://gw.example/v4", count: 20, model: "glm-5.3-flash", bogus: "x" });
		const raw = readRaw();
		assert.equal(raw.version, 3);
		assert.equal(raw.vendor, "zhipu");
		assert.equal(raw.protocol, "chat-completions");
		assert.deepEqual(raw.targets["zhipu/chat-completions"], { baseURL: "https://gw.example/v4", count: 20, model: "glm-5.3-flash" });
		assert.deepEqual(raw.targets["qwen/responses"], { model: "qwen3.8-flash" });
	});

	it("deletes cleared keys and drops an emptied bucket", () => {
		writeRaw({ version: 3, targets: { "zhipu/search": { count: 20, searchEngine: "search_pro" } } });
		saveConfig("zhipu", "search", { count: 15 }, ["searchEngine"]);
		assert.deepEqual(readRaw().targets["zhipu/search"], { count: 15 });
		saveConfig("zhipu", "search", {}, ["count"]);
		assert.equal(readRaw().targets["zhipu/search"], void 0);
	});
});

describe("buildConfigPatch", () => {
	const capability = capabilityOf("zhipu/chat-completions");

	it("accepts declared fields and trims strings", () => {
		const { patch, cleared, error } = buildConfigPatch(capability, { baseURL: "  https://gw.example  ", count: 20 });
		assert.equal(error, void 0);
		assert.deepEqual(patch, { baseURL: "https://gw.example", count: 20 });
		assert.deepEqual(cleared, []);
	});

	it("treats blank values as clears", () => {
		const { patch, cleared, error } = buildConfigPatch(capability, { model: "", searchPrompt: "   " });
		assert.equal(error, void 0);
		assert.deepEqual(patch, {});
		assert.deepEqual(cleared, ["model", "searchPrompt"]);
	});

	it("rejects fields the target does not declare", () => {
		const { error } = buildConfigPatch(capability, { includeSources: true });
		assert.match(error, /includeSources/);
	});

	it("rejects out-of-range enums and integers", () => {
		assert.match(buildConfigPatch(capability, { searchEngine: "nope" }).error, /searchEngine/);
		assert.match(buildConfigPatch(capability, { count: 0 }).error, /count/);
		assert.match(buildConfigPatch(capability, { count: 99 }).error, /count/);
	});

	it("accepts a numeric string from the form and stores a number", () => {
		const { patch, error } = buildConfigPatch(capabilityOf("deepseek/anthropic-messages"), { maxOutputTokens: "131072" });
		assert.equal(error, void 0);
		assert.equal(patch.maxOutputTokens, 131072);
		assert.match(buildConfigPatch(capability, { count: "0" }).error, /count/);
		assert.match(buildConfigPatch(capability, { count: "1e3" }).error, /count/);
	});

	it("keeps Kimi's limit inside 1-20", () => {
		const kimi = capabilityOf("kimi/search");
		assert.equal(buildConfigPatch(kimi, { count: 20 }).error, void 0);
		assert.match(buildConfigPatch(kimi, { count: 21 }).error, /count/);
	});

	it("validates the digest limits", () => {
		const search = capabilityOf("zhipu/search");
		const accepted = buildConfigPatch(search, { digestEntries: 5, digestSnippetChars: 300 });
		assert.equal(accepted.error, void 0);
		assert.equal(accepted.patch.digestEntries, 5);
		assert.match(buildConfigPatch(search, { digestEntries: 21 }).error, /digestEntries/);
		assert.match(buildConfigPatch(search, { digestSnippetChars: 0 }).error, /digestSnippetChars/);
	});

	it("rejects an apiKeyEnv that the credentials service cannot address", () => {
		const search = capabilityOf("deepseek/search");
		const accepted = buildConfigPatch(search, { apiKeyEnv: "DEEPSEEK_SEARCH_KEY" });
		assert.equal(accepted.error, void 0);
		assert.equal(accepted.patch.apiKeyEnv, "DEEPSEEK_SEARCH_KEY");
		const rejected = buildConfigPatch(search, { apiKeyEnv: "bad name" });
		assert.match(rejected.error, /apiKeyEnv/);
		assert.match(rejected.error, /凭据引用名/u);
		assert.equal(rejected.patch.apiKeyEnv, void 0);
	});

	it("accepts a custom gateway's engine name but keeps the official enum", () => {
		const custom = buildConfigPatch(capabilityOf("custom/search"), { searchEngine: "searxng" });
		assert.equal(custom.error, void 0);
		assert.equal(custom.patch.searchEngine, "searxng");
		assert.match(buildConfigPatch(capability, { searchEngine: "searxng" }).error, /searchEngine/);
	});
});

describe("model locking", () => {
	it("rejects a different model for combinations that only support one", () => {
		const openaiChat = capabilityOf("openai/chat-completions");
		const rejected = buildConfigPatch(openaiChat, { model: "gpt-4o" });
		assert.match(rejected.error, /固定为 gpt-5-search-api/u);
		const accepted = buildConfigPatch(openaiChat, { model: "gpt-5-search-api" });
		assert.equal(accepted.error, void 0);
		const deepseek = buildConfigPatch(capabilityOf("deepseek/responses"), { model: "deepseek-flash" });
		assert.match(deepseek.error, /固定为 deepseek-v4-pro/u);
	});

	it("keeps model locking out of unlocked combinations", () => {
		const qwen = buildConfigPatch(capabilityOf("qwen/responses"), { model: "any-model" });
		assert.equal(qwen.error, void 0);
		assert.equal(qwen.patch.model, "any-model");
	});
});

describe("v2 migration", () => {
	it("maps the four legacy modes onto their targets and renames fields", () => {
		writeRaw({
			version: 2,
			mode: "responses",
			modes: {
				responses: {
					baseURL: "https://qwen.example/v1",
					model: "qwen3.8-flash",
					maxOutputTokens: 4096,
					responsesToolType: "openrouter:web_search",
					responsesIncludeSources: false,
					responsesReasoningEffort: "low"
				},
				"anthropic-messages": { model: "deepseek-flash", anthropicThinking: "disabled", anthropicEffort: "high", apiVersion: "2023-06-01" },
				"zhipu-web-search": { count: 20, searchEngine: "search_pro" },
				"zhipu-chat-search": { model: "glm-5.3-flash", requireSearch: true, reasoningEffort: "high" }
			}
		});
		const document = readConfigDocument();
		assert.equal(document.vendor, "qwen");
		assert.equal(document.protocol, "responses");
		assert.deepEqual(document.targets["qwen/responses"], {
			baseURL: "https://qwen.example/v1",
			model: "qwen3.8-flash",
			maxOutputTokens: 4096,
			toolType: "openrouter:web_search",
			includeSources: false,
			reasoningEffort: "low"
		});
		assert.deepEqual(document.targets["deepseek/anthropic-messages"], {
			model: "deepseek-flash",
			thinking: "disabled",
			effort: "high"
		});
		assert.deepEqual(document.targets["zhipu/search"], { count: 20, searchEngine: "search_pro" });
		assert.deepEqual(document.targets["zhipu/chat-completions"], {
			model: "glm-5.3-flash",
			requireSearch: true,
			reasoningEffort: "high"
		});
	});

	it("projects a v1 flat file onto its mode before migrating", () => {
		writeRaw({ mode: "zhipu-web-search", count: 15, searchEngine: "search_pro_sogou" });
		const document = readConfigDocument();
		assert.equal(document.vendor, "zhipu");
		assert.equal(document.protocol, "search");
		assert.deepEqual(document.targets["zhipu/search"], { count: 15, searchEngine: "search_pro_sogou" });
	});

	it("backs the legacy file up once and writes v3 on the first save", () => {
		writeRaw({ version: 2, mode: "zhipu-chat-search", modes: { "zhipu-chat-search": { count: 12 } } });
		assert.equal(existsSync(`${configFilePath()}.v2.bak`), false);
		saveConfig("zhipu", "chat-completions", { model: "glm-5.3-flash" });
		assert.equal(existsSync(`${configFilePath()}.v2.bak`), true);
		assert.equal(readRaw().version, 3);
		const backup = JSON.parse(readFileSync(`${configFilePath()}.v2.bak`, "utf8"));
		assert.equal(backup.version, 2);
		/** The migrated bucket survives the save. */
		assert.deepEqual(readRaw().targets["zhipu/chat-completions"], { count: 12, model: "glm-5.3-flash" });
	});

	it("does not overwrite an existing backup", () => {
		writeFileSync(`${configFilePath()}.v2.bak`, "keep");
		writeRaw({ version: 2, modes: { responses: { model: "a" } } });
		saveConfig("qwen", "responses", { model: "b" });
		assert.equal(readFileSync(`${configFilePath()}.v2.bak`, "utf8"), "keep");
	});

	it("is idempotent across repeated saves", () => {
		writeRaw({ version: 2, mode: "responses", modes: { responses: { model: "qwen3.8-flash", responsesIncludeSources: true } } });
		const first = saveConfig("qwen", "responses", { toolType: "web_search" });
		const second = saveConfig("qwen", "responses", { toolType: "web_search" });
		assert.deepEqual(second, first);
		assert.equal(readRaw().version, CONFIG_VERSION);
	});

	it("replaces the file atomically without leaving temp files behind", () => {
		saveConfig("deepseek", "search", { count: 7 });
		assert.deepEqual(readRaw().targets["deepseek/search"], { count: 7 });
		const leftovers = readdirSync(home).filter((name) => name.endsWith(".tmp"));
		assert.deepEqual(leftovers, []);
	});

	it("falls back to the user home when DSH_HOME is blank", () => {
		const previous = process.env.DSH_HOME;
		process.env.DSH_HOME = "   ";
		try {
			const expected = join(homedir(), ".dsh", "dsh-web-search-diy.json");
			assert.equal(configFilePath(), expected);
		} finally {
			if (previous === void 0) delete process.env.DSH_HOME;
			else process.env.DSH_HOME = previous;
		}
	});
});