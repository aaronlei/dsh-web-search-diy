/**
 * Stub-environment smoke test for lib/client.js.
 *
 * Covers the whole browser-side contract without a live dsh web:
 *   1. the registration path (apply → slots.inject → register) and both views;
 *   2. the mode-scoped fields the card renders, per protocol mode;
 *   3. bucket-driven mode switching — entering a mode restores its own stored
 *      endpoint, model, credential reference, and options, a mode with no bucket
 *      starts from that mode's official values, and a switch never marks the
 *      form dirty (the reported regression: switching back used to replace a
 *      stored `ZAI_CODING_CN_API_KEY` with the canonical `ZHIPU_API_KEY`).
 *
 * The React stand-in implements real state and effect semantics: the bundle
 * stages edits through `useState` setters and registers effects through
 * `useEffect`/`ctx.effect`, so a no-op stub silently checks nothing.
 *
 * Run: npm run test:client
 */
import { readFileSync } from "node:fs";

// --- fake react / jsx-runtime -------------------------------------------------
let hookIndex = 0;
let hookState = [];
let pendingEffects = [];
const fakeReact = {
	useState: (init) => {
		const index = hookIndex++;
		if (!(index in hookState)) hookState[index] = typeof init === "function" ? init() : init;
		const set = (value) => {
			hookState[index] = typeof value === "function" ? value(hookState[index]) : value;
		};
		return [hookState[index], set];
	},
	useEffect: (fn) => {
		pendingEffects.push(fn);
	},
	useMemo: (fn) => fn(),
	useRef: (init) => {
		const index = hookIndex++;
		if (!(index in hookState)) hookState[index] = { current: init };
		return hookState[index];
	}
};
const fakeJsx = (type, props, key) => ({ $$type: "jsx", type, props, key });
const fakeJsxs = fakeJsx;

// --- fake browser globals -----------------------------------------------------
globalThis.window = {};
globalThis.document = {
	// injectStyles probes for an existing <style>, then sets dataset on a fresh one.
	createElement: () => ({ dataset: {}, textContent: "" }),
	head: { appendChild: () => {} },
	querySelector: () => null
};

/** The configuration the stubbed host serves; replaced per scenario below. */
let storedConfig = {};

// --- load the bundle ----------------------------------------------------------
const source = readFileSync(new URL("../lib/client.js", import.meta.url), "utf8");
let captured = null;
globalThis.window.__ModuleLoader__ = {
	load({ id, factory }) {
		const require = (spec) => {
			if (spec === "react") return fakeReact;
			if (spec === "react/jsx-runtime") return { jsx: fakeJsx, jsxs: fakeJsxs };
			throw new Error(`unexpected require: ${spec}`);
		};
		captured = { id, exports: factory(require) };
	}
};
globalThis.fetch = async () => ({ ok: true, status: 200, json: async () => ({ ...storedConfig, keyConfigured: true }) });
new Function(source)();

const { id, exports } = captured;
console.log(`module id: ${id}`);
if (id !== "dsh-web-search-diy") throw new Error(`unexpected module id ${id}`);
if (typeof exports.apply !== "function") throw new Error("apply missing");

// --- fake plugin ctx ----------------------------------------------------------
const effects = [];
let registered = null;
let dictionaries = null;
const ctx = {
	effect(fn, label) {
		// cordis runs the callback immediately and keeps its disposer on the
		// calling fiber. The bundle registers every side effect through an effect,
		// so a stub that only records the callback never reaches slots.register.
		effects.push({ fn, label });
		fn();
	},
	locale: {
		register(ns, dicts) {
			dictionaries = { ns, dicts };
		}
	},
	slots: {
		inject(name, fn) {
			if (name !== "plugins.row.config") throw new Error(`inject waits on wrong slot: ${name}`);
			fn(); // the slot is declared by the composition; run the registration
		},
		register(options, component) {
			registered = { options, component };
		}
	}
};
exports.apply(ctx);

console.log(`effects: ${effects.map((effect) => effect.label).join(" | ")}`);
if (!registered) throw new Error("plugins.row.config entry was not registered");
console.log(`registered slot: ${registered.options.name}`);
console.log(`registered key:  ${registered.options.key}`);
if (registered.options.name !== "plugins.row.config") throw new Error("wrong slot name");
if (registered.options.key !== "dsh-web-search-diy#web-search-diy") throw new Error(`wrong key: ${registered.options.key}`);
if (dictionaries === null || dictionaries.ns !== "dshWebSearchDiy") throw new Error("locale namespace not registered");

const missing = new Set();
const t = (key) => {
	const value = dictionaries.dicts.zh[key] ?? dictionaries.dicts.en[key];
	if (value === void 0) missing.add(key);
	return value ?? `<missing:${key}>`;
};

// --- both views ---------------------------------------------------------------
const summary = registered.component({ t, view: "summary" });
console.log(`summary view: ${JSON.stringify(summary)}`);
if (typeof summary !== "string" || summary.length === 0 || summary.startsWith("<missing")) throw new Error("bad summary");

const page = registered.component({ t, view: "page" });
console.log(`page view element: $$type=${page.$$type} type=${page.type?.name ?? "?"}`);
if (page.$$type !== "jsx" || typeof page.type !== "function") throw new Error("page view is not the form component");

// --- render helpers -----------------------------------------------------------
/** Render the page, optionally running the effects it registered. */
function render(runEffects) {
	hookIndex = 0;
	pendingEffects = [];
	const tree = page.type({ t });
	if (runEffects) for (const fn of pendingEffects) fn();
	return tree;
}

/** Collect the field props of a rendered tree. */
function fieldsOf(tree) {
	const fields = [];
	const walk = (node) => {
		if (node == null || typeof node !== "object") return;
		if (Array.isArray(node)) {
			for (const child of node) walk(child);
			return;
		}
		if (typeof node.props?.id === "string") fields.push(node.props);
		if (node.props?.children !== void 0) walk(node.props.children);
	};
	walk(tree);
	return fields;
}

/** The save control's props, or null when it is not rendered. */
function saveButtonOf(tree) {
	let found = null;
	const walk = (node) => {
		if (node == null || typeof node !== "object") return;
		if (Array.isArray(node)) {
			for (const child of node) walk(child);
			return;
		}
		if (typeof node.props?.className === "string" && node.props.className.includes("dwsd-save")) found = node.props;
		if (node.props?.children !== void 0) walk(node.props.children);
	};
	walk(tree);
	return found;
}

const valueOf = (fields, suffix) => {
	const field = fields.find((props) => props.id.endsWith(suffix));
	return field?.value ?? field?.text;
};
const countOf = (fields, suffix) => fields.filter((props) => props.id.endsWith(suffix)).length;
const snapshot = (fields) => ({
	mode: valueOf(fields, "-mode"),
	baseURL: valueOf(fields, "-base-url"),
	model: valueOf(fields, "-model"),
	apiKeyEnv: valueOf(fields, "-api-key-env")
});

/** Load one GET payload, render the card, and return its fields and text. */
async function open(payload) {
	storedConfig = payload;
	hookState = [];
	render(true);
	await new Promise((resolve) => setTimeout(resolve, 0));
	const tree = render(false);
	return { fields: fieldsOf(tree), canSave: saveButtonOf(tree)?.disabled === false };
}

/** Enter a mode through the selector and return the resulting card. */
function enterMode(fields, mode) {
	fields.find((props) => props.id.endsWith("-mode")).onEdit(mode);
	const tree = render(false);
	return { fields: fieldsOf(tree), canSave: saveButtonOf(tree)?.disabled === false };
}

function expectEqual(actual, expected, label) {
	if (actual !== expected) throw new Error(`${label}: expected ${expected}, got ${actual}`);
}

// --- mode-scoped rendering ----------------------------------------------------
const anthropicCard = await open({ mode: "anthropic-messages", modes: {} });
expectEqual(countOf(anthropicCard.fields, "-api-version"), 1, "anthropic apiVersion field");
expectEqual(countOf(anthropicCard.fields, "-max-uses"), 1, "anthropic maxUses field");
expectEqual(countOf(anthropicCard.fields, "-anthropic-thinking"), 1, "anthropic thinking field");
expectEqual(countOf(anthropicCard.fields, "-search-engine"), 0, "anthropic mode must not render Zhipu fields");
expectEqual(countOf(anthropicCard.fields, "-responses-reasoning-effort"), 0, "anthropic mode must not render the responses knob");
const budgetField = anthropicCard.fields.find((props) => props.id.endsWith("-max-output-tokens"));
expectEqual(budgetField?.placeholder, "65536", "anthropic budget placeholder");
console.log("anthropic fields: apiVersion + maxUses + thinking, budget placeholder 65536");

const zhipuCard = await open({ mode: "zhipu-chat-search", modes: {} });
expectEqual(countOf(zhipuCard.fields, "-search-engine"), 1, "zhipu searchEngine field");
expectEqual(countOf(zhipuCard.fields, "-api-version"), 0, "zhipu mode must not render apiVersion");
const zhipuBudget = zhipuCard.fields.find((props) => props.id.endsWith("-max-output-tokens"));
expectEqual(zhipuBudget?.placeholder, "4096", "zhipu budget placeholder");
console.log("zhipu fields: searchEngine only, budget placeholder 4096");

// --- bucket-driven mode switching --------------------------------------------
const twoBuckets = {
	mode: "zhipu-web-search",
	apiKeyEnv: "ZAI_CODING_CN_API_KEY",
	model: "GLM-5.3-Flash",
	baseURL: "https://open.bigmodel.cn/api/paas/v4",
	modes: {
		"zhipu-web-search": {
			apiKeyEnv: "ZAI_CODING_CN_API_KEY",
			model: "GLM-5.3-Flash",
			baseURL: "https://open.bigmodel.cn/api/paas/v4"
		},
		"anthropic-messages": { apiKeyEnv: "DEEPSEEK_API_KEY", model: "deepseek-flash" },
		"zhipu-chat-search": { apiKeyEnv: "ZAI_CODING_CN_API_KEY", model: "GLM-5.3-Flash" }
	}
};
const start = await open(twoBuckets);
const atAnthropic = enterMode(start.fields, "anthropic-messages");
const backToZhipu = enterMode(atAnthropic.fields, "zhipu-web-search");
console.log(`zhipu(ZAI) → anthropic → zhipu: ${[
	snapshot(start.fields),
	snapshot(atAnthropic.fields),
	snapshot(backToZhipu.fields)
].map((step) => `${step.mode}=${step.apiKeyEnv}`).join(" | ")}`);
expectEqual(valueOf(atAnthropic.fields, "-api-key-env"), "DEEPSEEK_API_KEY", "Anthropic restores its own bucket");
expectEqual(valueOf(atAnthropic.fields, "-model"), "deepseek-flash", "Anthropic restores its own model");
expectEqual(valueOf(backToZhipu.fields, "-api-key-env"), "ZAI_CODING_CN_API_KEY", "Zhipu restores its stored reference (regression)");
expectEqual(valueOf(backToZhipu.fields, "-base-url"), "https://open.bigmodel.cn/api/paas/v4", "Zhipu restores its stored endpoint");
// zhipu-web-search hides the model field, so the stored model is checked on the sibling mode.
const atZhipuChatStored = enterMode(backToZhipu.fields, "zhipu-chat-search");
expectEqual(valueOf(atZhipuChatStored.fields, "-model"), "GLM-5.3-Flash", "the stored model comes back");
expectEqual(valueOf(atZhipuChatStored.fields, "-api-key-env"), "ZAI_CODING_CN_API_KEY", "the stored reference comes back");

// A mode with no bucket yet starts from that mode's official values.
const freshCard = await open({ mode: "zhipu-web-search", modes: {} });
const atResponses = enterMode(freshCard.fields, "responses");
console.log(`fresh install → responses: keyRef=${valueOf(atResponses.fields, "-api-key-env")} model=${valueOf(atResponses.fields, "-model")} baseURL=${valueOf(atResponses.fields, "-base-url")}`);
expectEqual(valueOf(atResponses.fields, "-api-key-env"), "QWEN_TOKEN_PLAN_CN_API_KEY", "official reference prefilled");
expectEqual(valueOf(atResponses.fields, "-model"), "deepseek-v4-flash-0731", "official model prefilled");
expectEqual(valueOf(atResponses.fields, "-base-url"), "https://token-plan.cn-beijing.maas.aliyuncs.com/compatible-mode/v1", "official endpoint prefilled");

// Buckets are per mode, not per family: the other Zhipu mode has its own.
const zhipuOnly = await open({
	mode: "zhipu-web-search",
	apiKeyEnv: "ZAI_CODING_CN_API_KEY",
	modes: { "zhipu-web-search": { apiKeyEnv: "ZAI_CODING_CN_API_KEY" } }
});
const atZhipuChat = enterMode(zhipuOnly.fields, "zhipu-chat-search");
console.log(`zhipu-web-search(ZAI) → zhipu-chat-search (no bucket): keyRef=${valueOf(atZhipuChat.fields, "-api-key-env")}`);
expectEqual(valueOf(atZhipuChat.fields, "-api-key-env"), "ZHIPU_API_KEY", "a sibling mode with no bucket gets its canonical value");

// A mode switch is itself a pending change: without that, entering a mode whose
// bucket already held the same values left the save control disabled and the
// selection could never be written.
if (start.canSave) throw new Error("a freshly loaded form should not offer a save");
if (!atAnthropic.canSave) throw new Error("entering another mode must be saveable (regression)");
if (backToZhipu.canSave) throw new Error("returning to the stored mode should offer no save");
console.log("a mode switch enables Save; returning to the stored mode disables it again");

console.log("missing t() keys:", [...missing]);
if (missing.size > 0) throw new Error("missing locale keys");
console.log("\nALL CHECKS PASSED");
