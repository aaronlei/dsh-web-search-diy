/**
 * Blank-value semantics for the configuration endpoint.
 *
 * Regression background: blank used to mean three different things depending on
 * the field. Numeric fields answered `Number("") === 0` and failed validation,
 * so leaving `maxUses`, `count`, or `maxOutputTokens` empty refused to save
 * ("maxUses 必须是正整数"), while most string and enum fields silently kept the
 * stored value and only a few actually reset. Every field now follows one rule:
 * blank clears the key (the mode default applies again), absent leaves it
 * untouched, invalid is an error naming the key.
 *
 * Run: node --test "test/**\/*.test.mjs"
 */
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, before, beforeEach, describe, it } from "node:test";
import { buildConfigPatch, saveFileConfig } from "../lib/index.js";

const CONFIG_FILE = "dsh-web-search-diy.json";
let home;
const originalHome = process.env.DSH_HOME;

before(() => {
	home = mkdtempSync(join(tmpdir(), "dsh-web-search-diy-patch-"));
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

describe("buildConfigPatch", () => {
	it("treats a blank value as a reset for every field type, never as an error", () => {
		const { patch, cleared, error } = buildConfigPatch({
			mode: "",
			searchEngine: "",
			count: "",
			searchRecencyFilter: "",
			contentSize: "",
			reasoningEffort: "",
			responsesReasoningEffort: "",
			searchDomainFilter: "",
			searchPrompt: "",
			baseURL: "",
			apiKeyEnv: "",
			model: "",
			maxOutputTokens: "",
			apiVersion: "",
			maxUses: "",
			anthropicThinking: ""
		});
		assert.equal(error, void 0);
		assert.deepEqual(patch, {});
		assert.deepEqual(cleared.slice().sort(), [
			"anthropicThinking", "apiKeyEnv", "apiVersion", "baseURL", "contentSize", "count",
			"maxOutputTokens", "maxUses", "mode", "model", "reasoningEffort",
			"responsesReasoningEffort", "searchDomainFilter", "searchEngine", "searchPrompt",
			"searchRecencyFilter"
		].sort());
	});

	it("treats a blank number like a blank string (the maxUses regression)", () => {
		for (const key of ["maxUses", "count", "maxOutputTokens"]) {
			const { patch, cleared, error } = buildConfigPatch({ [key]: "" });
			assert.equal(error, void 0, key);
			assert.deepEqual(patch, {}, key);
			assert.deepEqual(cleared, [key], key);
		}
	});

	it("accepts null as blank too", () => {
		const { patch, cleared, error } = buildConfigPatch({ maxUses: null, baseURL: null });
		assert.equal(error, void 0);
		assert.deepEqual(patch, {});
		assert.deepEqual(cleared.slice().sort(), ["baseURL", "maxUses"]);
	});

	it("leaves absent keys untouched", () => {
		const { patch, cleared, error } = buildConfigPatch({ mode: "anthropic-messages" });
		assert.equal(error, void 0);
		assert.deepEqual(patch, { mode: "anthropic-messages" });
		assert.deepEqual(cleared, []);
	});

	it("accepts and normalizes valid values of each type", () => {
		const { patch, cleared, error } = buildConfigPatch({
			mode: "zhipu-chat-search",
			count: 20,
			maxOutputTokens: "4096",
			maxUses: 5,
			model: " glm-5.3-flash ",
			searchIntent: true,
			anthropicThinking: "disabled",
			apiVersion: "2023-06-01"
		});
		assert.equal(error, void 0);
		assert.deepEqual(cleared, []);
		assert.deepEqual(patch, {
			mode: "zhipu-chat-search",
			count: 20,
			maxOutputTokens: 4096,
			maxUses: 5,
			model: "glm-5.3-flash",
			searchIntent: true,
			anthropicThinking: "disabled",
			apiVersion: "2023-06-01"
		});
	});

	it("rejects invalid values with a message naming the key", () => {
		assert.match(buildConfigPatch({ maxUses: 0 }).error, /^maxUses 必须是不小于 1 的整数$/);
		assert.match(buildConfigPatch({ maxOutputTokens: "abc" }).error, /^maxOutputTokens 必须是不小于 1 的整数$/);
		assert.match(buildConfigPatch({ count: 51 }).error, /^count 必须是 1-50 的整数$/);
		assert.match(buildConfigPatch({ mode: "nope" }).error, /^mode 必须是/);
		assert.match(buildConfigPatch({ anthropicThinking: "maybe" }).error, /^anthropicThinking 必须是/);
		assert.match(buildConfigPatch({ searchIntent: "true" }).error, /^searchIntent 必须是布尔值$/);
		assert.match(buildConfigPatch({ responsesReasoningEffort: "max" }).error, /^responsesReasoningEffort 必须是/);
	});

	it("accepts an empty object without inventing changes", () => {
		const { patch, cleared, error } = buildConfigPatch({});
		assert.equal(error, void 0);
		assert.deepEqual(patch, {});
		assert.deepEqual(cleared, []);
	});
});

describe("saveFileConfig", () => {
	it("deletes cleared keys instead of writing blanks", () => {
		writeFileSync(join(home, CONFIG_FILE), JSON.stringify({
			mode: "zhipu-web-search",
			baseURL: "https://example.test/v1",
			model: "glm-5.3-flash",
			maxUses: 3
		}));
		const merged = saveFileConfig({ count: 7 }, ["baseURL", "maxUses"]);
		const expected = { mode: "zhipu-web-search", model: "glm-5.3-flash", count: 7 };
		assert.deepEqual(merged, expected);
		assert.deepEqual(JSON.parse(readFileSync(join(home, CONFIG_FILE), "utf8")), expected);
	});

	it("keeps untouched keys when the patch is empty", () => {
		writeFileSync(join(home, CONFIG_FILE), JSON.stringify({ mode: "responses", model: "deepseek-flash" }));
		assert.deepEqual(saveFileConfig({}, []), { mode: "responses", model: "deepseek-flash" });
	});
});
