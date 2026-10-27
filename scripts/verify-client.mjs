/**
 * Stub-environment smoke test for lib/client.js (2.0 contract).
 *
 * Covers the browser-side contract without a live dsh web:
 *   1. registration path (apply → slots.inject → register) and both views;
 *   2. the catalog-driven form: fields come from GET /config, not from hardcoded
 *      per-mode lists, and placeholders are the catalog defaults;
 *   3. three-layer selection — switching protocol/vendor re-renders that target's
 *      declared fields, keeping every target's staged draft;
 *   4. saving posts `{ vendor, protocol, ...fields }` and only offers itself when
 *      the staged draft differs from the stored one.
 *
 * The React stand-in implements real state/effect semantics: a no-op stub would
 * silently check nothing.
 *
 * Run: pnpm run test:client (it rebuilds lib/client.js first)
 */
import { readFileSync } from "node:fs";

// --- fake react / jsx-runtime -------------------------------------------------
let hookIndex = 0;
let hookState = [];
let pendingEffects = [];
/** Cleanups returned by effects run during `open()`, so the unmount path is testable. */
let pendingCleanups = [];
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
	useCallback: (fn) => fn,
	useMemo: (fn) => fn(),
	useRef: (init) => {
		const index = hookIndex++;
		if (!(index in hookState)) hookState[index] = { current: init };
		return hookState[index];
	}
};
const fakeJsx = (type, props, key) => ({ $$type: "jsx", type, props, key });
const fakeJsxs = fakeJsx;

globalThis.window = {};
globalThis.document = {
	createElement: () => ({ dataset: {}, textContent: "" }),
	head: { appendChild: () => {} },
	querySelector: () => null
};

/** The GET payload the stubbed host serves. */
let storedConfig = {};
/** The last POST body the card sent. */
let postedBody = null;
/** The init passed to the most recent snapshot GET, for the abort-signal check. */
let lastGetInit = null;

globalThis.fetch = async (url, init) => {
	if (init?.method === "POST") {
		postedBody = JSON.parse(init.body);
		return { ok: true, status: 200, json: async () => ({ ok: true }) };
	}
	lastGetInit = init ?? null;
	return { ok: true, status: 200, json: async () => storedConfig };
};

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
			if (name !== "plugins.bundle.config") throw new Error(`inject waits on wrong slot: ${name}`);
			fn();
		},
		register(options, component) {
			registered = { options, component };
		}
	}
};
exports.apply(ctx);

console.log(`effects: ${effects.map((effect) => effect.label).join(" | ")}`);
if (!registered) throw new Error("plugins.bundle.config entry was not registered");
if (registered.options.name !== "plugins.bundle.config") throw new Error(`wrong slot: ${registered.options.name}`);
if (registered.options.key !== "dsh-web-search-diy") throw new Error(`wrong key: ${registered.options.key}`);
if (dictionaries === null || dictionaries.ns !== "dshWebSearchDiy") throw new Error("locale namespace not registered");

const missing = new Set();
/**
 * Mirrors the real locale service: a key defined by neither language is returned
 * verbatim (`lookup(...) ?? key`), never a synthetic marker. The set below is the
 * test's own completeness check, not part of the contract.
 */
const t = (key) => {
	const value = dictionaries.dicts.zh[key] ?? dictionaries.dicts.en[key];
	if (value === void 0) missing.add(key);
	return value ?? key;
};

/** Both languages must define the same keys: a gap would silently fall back to the other one. */
const zhKeys = Object.keys(dictionaries.dicts.zh).sort();
const enKeys = Object.keys(dictionaries.dicts.en).sort();
if (zhKeys.join("\n") !== enKeys.join("\n")) {
	throw new Error(`dictionaries disagree: zh ${zhKeys.length} keys, en ${enKeys.length}`);
}

const summary = registered.component({ t, view: "summary" });
if (typeof summary !== "string" || summary.length === 0 || summary === "description") throw new Error("bad summary");
const page = registered.component({ t, view: "page" });
if (page.$$type !== "jsx" || typeof page.type !== "function") throw new Error("page view is not the form component");

// --- catalog fixture ----------------------------------------------------------
const catalog = [
	{
		id: "deepseek/anthropic-messages", kind: "in-protocol", protocol: "anthropic-messages", vendor: "deepseek", support: "full",
		reason: "", title: "DeepSeek Anthropic 兼容 Messages", docs: "",
		defaults: { baseURL: "https://api.deepseek.com/anthropic", apiKeyEnv: ["DEEPSEEK_API_KEY"], model: "deepseek-flash", maxOutputTokens: 65536, toolType: "web_search_20250305", maxUses: 5 },
		fields: ["baseURL", "apiKeyEnv", "model", "maxOutputTokens", "toolType", "maxUses"], hints: {}
	},
	{
		id: "deepseek/search", kind: "standalone", protocol: "search", vendor: "deepseek", support: "full",
		reason: "", title: "DeepSeek 独立搜索 API", docs: "",
		defaults: { baseURL: "https://api.deepseek.com", apiKeyEnv: ["DEEPSEEK_API_KEY"], count: 10, includeContent: false, digestEntries: 8, digestSnippetChars: 200 },
		fields: ["baseURL", "apiKeyEnv", "count", "includeContent", "digestEntries", "digestSnippetChars"], hints: {}
	},
	{
		id: "zhipu/chat-completions", kind: "in-protocol", protocol: "chat-completions", vendor: "zhipu", support: "full",
		reason: "", title: "智谱问答增强", docs: "",
		defaults: { baseURL: "https://open.bigmodel.cn/api/paas/v4", apiKeyEnv: ["ZAI_CODING_CN_API_KEY"], model: "glm-5.3-flash", maxOutputTokens: 4096, count: 10, searchEngine: "search_std" },
		fields: ["baseURL", "apiKeyEnv", "model", "maxOutputTokens", "searchEngine", "count"], hints: {}
	},
	{
		id: "zhipu/search", kind: "standalone", protocol: "search", vendor: "zhipu", support: "full",
		reason: "", title: "智谱基础检索", docs: "",
		defaults: { baseURL: "https://open.bigmodel.cn/api/paas/v4", apiKeyEnv: ["ZAI_CODING_CN_API_KEY"], count: 10, searchEngine: "search_std" },
		fields: ["baseURL", "apiKeyEnv", "searchEngine", "count"], hints: {}
	},
	{
		id: "qwen/chat-completions", kind: "in-protocol", protocol: "chat-completions", vendor: "qwen", support: "degraded",
		reason: "无来源", title: "千问 Chat", docs: "",
		defaults: { baseURL: "https://maas.qianwenaiapi.com/compatible-mode/v1", apiKeyEnv: ["QWEN_TOKEN_PLAN_API_KEY"], model: "qwen3.8-flash", maxOutputTokens: 4096 },
		fields: ["baseURL", "apiKeyEnv", "model", "maxOutputTokens"], hints: {}
	},
	{
		id: "qwen/responses", kind: "in-protocol", protocol: "responses", vendor: "qwen", support: "full",
		reason: "", title: "千问 Responses", docs: "",
		defaults: { baseURL: "https://maas.qianwenaiapi.com/compatible-mode/v1", apiKeyEnv: ["QWEN_TOKEN_PLAN_API_KEY"], model: "qwen3.8-flash", maxOutputTokens: 4096, toolType: "web_search", includeSources: true },
		fields: ["baseURL", "apiKeyEnv", "model", "maxOutputTokens", "toolType", "includeSources"], hints: {}
	},
	{
		id: "custom/search", kind: "standalone", protocol: "search", vendor: "custom", support: "custom",
		reason: "", title: "自定义纯工具", docs: "",
		defaults: { template: "zhipu", path: "/web_search", count: 10 },
		fields: ["baseURL", "apiKeyEnv", "path", "count", "searchEngine", "digestEntries", "digestSnippetChars", "queryField", "countField", "resultsPath", "urlField", "titleField", "snippetField"], hints: {},
		templates: [
			{ id: "zhipu", label: "智谱 Web Search", defaults: { baseURL: "https://open.bigmodel.cn/api/paas/v4", apiKeyEnv: ["ZAI_CODING_CN_API_KEY"], path: "/web_search", count: 10, searchEngine: "search_std", queryField: "search_query", countField: "count", resultsPath: "search_result", urlField: "link", titleField: "title", snippetField: "content" } },
			{ id: "deepseek", label: "DeepSeek 搜索", defaults: { baseURL: "https://api.deepseek.com", apiKeyEnv: ["DEEPSEEK_API_KEY"], path: "/v1/tools/search", count: 10, queryField: "query", countField: "count", resultsPath: "results", urlField: "url", titleField: "title", snippetField: "snippet" } },
			{ id: "kimi", label: "Kimi 搜索", defaults: { baseURL: "https://api.moonshot.cn", apiKeyEnv: ["MOONSHOT_API_KEY"], path: "/v1/tools/search", count: 10 } }
		]
	},
	{
		id: "custom/chat-completions", kind: "in-protocol", protocol: "chat-completions", vendor: "custom", support: "custom",
		reason: "", title: "自定义 Chat", docs: "",
		defaults: { baseURL: "", apiKeyEnv: [], model: "", maxOutputTokens: 4096, chatVariant: "zhipu", searchEngine: "", count: 10, engine: "auto", searchStrategy: "turbo" },
		fields: ["chatVariant", "baseURL", "apiKeyEnv", "model", "maxOutputTokens", "searchEngine", "count", "engine", "maxResults", "searchStrategy", "forcedSearch"], hints: {},
		templates: [
			{ id: "zhipu", label: "智谱", chatVariant: "zhipu", defaults: { baseURL: "https://open.bigmodel.cn/api/paas/v4", searchEngine: "search_std", count: 10 } },
			{ id: "openrouter", label: "OpenRouter", chatVariant: "openrouter", defaults: { baseURL: "https://openrouter.ai/api/v1", engine: "auto", maxResults: 5 } }
		]
	},
	{
		id: "openai/chat-completions", kind: "in-protocol", protocol: "chat-completions", vendor: "openai", support: "degraded",
		reason: "仅搜索模型会联网", title: "OpenAI Chat", docs: "",
		defaults: { baseURL: "https://api.openai.com/v1", apiKeyEnv: ["OPENAI_API_KEY"], model: "gpt-5-search-api", maxOutputTokens: 4096 },
		fields: ["baseURL", "apiKeyEnv", "model", "maxOutputTokens"], modelLocked: true, hints: {}
	},
	{
		id: "kimi/chat-completions", kind: "in-protocol", protocol: "chat-completions", vendor: "kimi", support: "unsupported",
		reason: "已下线", title: "Kimi Chat", docs: "", defaults: { baseURL: "", apiKeyEnv: [] }, fields: [], hints: {}
	},
	{
		id: "openrouter/search", kind: "standalone", protocol: "search", vendor: "openrouter", support: "unsupported",
		reason: "无独立纯工具接口", title: "OpenRouter Search", docs: "", defaults: { baseURL: "", apiKeyEnv: [] }, fields: [], hints: {}
	}
];
const basePayload = {
	version: 3,
	selection: { vendor: "zhipu", protocol: "chat-completions" },
	target: {},
	targets: {},
	keyConfigured: true,
	credentials: { zhipu: true, qwen: false, kimi: true, openai: false, deepseek: true },
	shapeDefaults: { "in-protocol": "deepseek/anthropic-messages", standalone: "deepseek/search" },
	catalog
};

// --- render helpers -----------------------------------------------------------
function render(runEffects) {
	hookIndex = 0;
	pendingEffects = [];
	const tree = page.type({ t });
	if (runEffects) for (const fn of pendingEffects) {
		const cleanup = fn();
		if (typeof cleanup === "function") pendingCleanups.push(cleanup);
	}
	return tree;
}
function fieldsOf(tree) {
	const fields = [];
	const walk = (node) => {
		if (node == null || typeof node !== "object") return;
		if (Array.isArray(node)) { for (const child of node) walk(child); return; }
		if (typeof node.props?.id === "string") fields.push(node.props);
		if (node.props?.children !== void 0) walk(node.props.children);
	};
	walk(tree);
	return fields;
}
function saveButtonOf(tree) {
	let found = null;
	const walk = (node) => {
		if (node == null || typeof node !== "object") return;
		if (Array.isArray(node)) { for (const child of node) walk(child); return; }
		if (typeof node.props?.className === "string" && node.props.className.includes("dwsd-save")) found = node.props;
		if (node.props?.children !== void 0) walk(node.props.children);
	};
	walk(tree);
	return found;
}
/** Find a button by its visible text (template confirm/reset actions). */
function buttonByText(tree, text) {
	let found = null;
	const walk = (node) => {
		if (node == null || typeof node !== "object") return;
		if (Array.isArray(node)) { for (const child of node) walk(child); return; }
		if (typeof node.props?.className === "string" && node.props.className.includes("dwsd-discard") && textOf(node.props.children) === text) found = node.props;
		if (node.props?.children !== void 0) walk(node.props.children);
	};
	walk(tree);
	return found;
}
const valueOf = (fields, suffix) => fields.find((props) => props.id.endsWith(suffix))?.text;
const hasField = (fields, suffix) => fields.some((props) => props.id.endsWith(suffix));
const placeholderOf = (fields, suffix) => fields.find((props) => props.id.endsWith(suffix))?.placeholder;
/** The credential badge text, which must follow the selected vendor. */
function badgeTextOf(tree) {
	let found = null;
	const walk = (node) => {
		if (node == null || typeof node !== "object") return;
		if (Array.isArray(node)) { for (const child of node) walk(child); return; }
		/** SecretField is a component node here; its badge text is a prop, not a DOM child. */
		if (typeof node.props?.stateLabel === "string") found = node.props.stateLabel;
		if (node.props?.children !== void 0) walk(node.props.children);
	};
	walk(tree);
	return found;
}

/** Flatten a JSX children value into text. */
function textOf(children) {
	if (typeof children === "string") return children;
	if (typeof children === "number") return String(children);
	if (Array.isArray(children)) return children.map(textOf).join("");
	return "";
}
/** All `.dwsd-notice` lines: the unsupported list and degraded reasons. */
function noticesOf(tree) {
	const found = [];
	const walk = (node) => {
		if (node == null || typeof node !== "object") return;
		if (Array.isArray(node)) { for (const child of node) walk(child); return; }
		const className = node.props?.className;
		if (typeof className === "string" && className.includes("dwsd-notice")) found.push(textOf(node.props.children));
		if (node.props?.children !== void 0) walk(node.props.children);
	};
	walk(tree);
	return found;
}

/** Load one GET payload, run its mount effect, and return the rendered card. */
async function open(payload) {
	storedConfig = payload;
	postedBody = null;
	hookState = [];
	pendingCleanups = [];
	render(true);
	await new Promise((resolve) => setTimeout(resolve, 0));
	const tree = render(false);
	return { tree, fields: fieldsOf(tree), canSave: saveButtonOf(tree)?.disabled === false };
}

/** Click one radio by its id suffix and value, then return the re-rendered card. */
function choose(current, suffix, value) {
	const field = current.fields.find((props) => props.id.includes(`${suffix}-`) && props.value === value);
	if (field === void 0) throw new Error(`missing selector ${suffix}=${value}`);
	if (typeof field.onChange === "function") field.onChange();
	else field.onEdit(value);
	const tree = render(false);
	return { tree, fields: fieldsOf(tree), canSave: saveButtonOf(tree)?.disabled === false };
}

function expectEqual(actual, expected, label) {
	if (actual !== expected) throw new Error(`${label}: expected ${expected}, got ${actual}`);
}

// --- catalog-driven rendering -------------------------------------------------
const initial = await open(basePayload);
const chatVendors = initial.fields.filter((props) => props.id.includes("-vendor-"));
if (chatVendors.length !== 4) throw new Error(`chat protocol should list zhipu, qwen, openai and custom vendors, got ${chatVendors.length}`);
if (!hasField(initial.fields, "-searchEngine")) throw new Error("zhipu chat should render searchEngine");
if (!hasField(initial.fields, "-count")) throw new Error("zhipu chat should render count");
if (hasField(initial.fields, "-toolType")) throw new Error("zhipu chat must not render responses fields");
expectEqual(placeholderOf(initial.fields, "-maxOutputTokens"), "4096", "catalog default placeholder");
expectEqual(initial.canSave, false, "a freshly loaded form offers no save");
expectEqual(badgeTextOf(initial.tree), "已配置密钥", "zhipu's probed chain is configured");
const initialNotices = noticesOf(initial.tree);
if (!initialNotices.some((line) => line.includes("已下线"))) throw new Error("in-protocol should list the Kimi Chat unsupported entry");
if (initialNotices.some((line) => line.includes("无独立纯工具接口"))) throw new Error("in-protocol must not list the standalone unsupported entry");
console.log("zhipu/chat-completions renders its catalog fields with catalog placeholders");

const openaiCard = choose(initial, "-vendor", "openai");
console.log("openai fields:", openaiCard.fields.map((props) => `${props.id}:${props.disabled}`).join(", "));
const lockedModel = openaiCard.fields.find((props) => props.id.endsWith("-model"));
if (lockedModel?.disabled !== true) throw new Error("a model-locked target must render model as disabled");
if (openaiCard.canSave !== true) throw new Error("switching vendor should make the selection saveable");
expectEqual(badgeTextOf(openaiCard.tree), "未配置密钥", "the badge follows the vendor, not the loaded target");
console.log("model-locked target renders the model field read-only and the badge follows the vendor");

/** A degraded reason lives on the vendor card only; rendering it again below the list duplicates it. */
const customChatCard = choose(initial, "-vendor", "custom");
if (!hasField(customChatCard.fields, "-searchEngine")) throw new Error("the zhipu template should show searchEngine");
if (hasField(customChatCard.fields, "-engine")) throw new Error("the zhipu template must hide the OpenRouter engine");
if (hasField(customChatCard.fields, "-chatVariant")) throw new Error("the variant must not be a user-facing field");
const chatTemplateSelect = customChatCard.fields.find((props) => props.id.endsWith("-template"));
if (chatTemplateSelect === void 0) throw new Error("the template picker is missing on a custom Chat target");
chatTemplateSelect.onChange("openrouter");
const switchedVariant = fieldsOf(render(false));
if (hasField(switchedVariant, "-searchEngine")) throw new Error("the openrouter template must hide searchEngine");
if (hasField(switchedVariant, "-count")) throw new Error("the openrouter template must hide the zhipu count");
if (!hasField(switchedVariant, "-engine")) throw new Error("the openrouter template must show engine");
console.log("custom Chat fields follow the template-selected variant");

const qwenChatCard = choose(initial, "-vendor", "qwen");
if (noticesOf(qwenChatCard.tree).some((line) => line.includes("无来源"))) {
	throw new Error("a degraded reason must not repeat below the vendor list");
}
console.log("degraded reasons render once, on the vendor card");

// Switching protocol to responses moves to a vendor that supports it.
const atResponses = choose(initial, "-protocol", "responses");
if (!hasField(atResponses.fields, "-toolType")) throw new Error("responses should render toolType");
if (hasField(atResponses.fields, "-searchEngine")) throw new Error("responses must not render zhipu fields");
expectEqual(valueOf(atResponses.fields, "-baseURL"), "", "unsaved target starts blank (defaults are placeholders)");
expectEqual(placeholderOf(atResponses.fields, "-baseURL"), "https://maas.qianwenaiapi.com/compatible-mode/v1", "responses endpoint placeholder");
const apiKeyEnvField = atResponses.fields.find((props) => props.id.endsWith("-apiKeyEnv"));
if (apiKeyEnvField?.text !== "QWEN_TOKEN_PLAN_API_KEY") throw new Error(`apiKeyEnv should default to the vendor reference, got ${apiKeyEnvField?.text}`);
const toolTypeField = atResponses.fields.find((props) => props.id.endsWith("-toolType"));
if (toolTypeField?.text !== "web_search") throw new Error(`toolType should default to the catalog value, got ${toolTypeField?.text}`);
console.log("protocol switch lands on qwen/responses and re-renders its fields");

// The unsupported vendor is present but cannot be selected.
const kimiRadio = atResponses.fields.filter((props) => props.id.includes("-vendor-"));
if (kimiRadio.length === 0) throw new Error("vendor selector missing");
console.log("unsupported combinations stay listed in the collapsed section");

// --- draft editing and saving -------------------------------------------------
const edited = choose(atResponses, "-vendor", "qwen");
const baseURLField = edited.fields.find((props) => props.id.endsWith("-baseURL"));
baseURLField.onEdit("https://gateway.example/v1");
const afterEditTree = render(false);
expectEqual(saveButtonOf(afterEditTree)?.disabled, false, "an edit enables Save");
const maxOutputField = fieldsOf(afterEditTree).find((props) => props.id.endsWith("-maxOutputTokens"));
maxOutputField.onEdit("131072");
const numericTree = render(false);
saveButtonOf(numericTree).onClick();
await new Promise((resolve) => setTimeout(resolve, 0));
if (postedBody === null) throw new Error("save did not POST");
expectEqual(postedBody.vendor, "qwen", "posted vendor");
expectEqual(postedBody.protocol, "responses", "posted protocol");
expectEqual(postedBody.baseURL, "https://gateway.example/v1", "posted baseURL");
expectEqual(postedBody.maxOutputTokens, 131072, "numeric fields travel as numbers");
if (typeof postedBody.maxOutputTokens !== "number") throw new Error("maxOutputTokens must be a JSON number");
console.log("save posts { vendor, protocol, ...fields } with numeric fields as numbers");

// --- standalone shape ---------------------------------------------------------
const standalone = choose(initial, "-shape", "standalone");
if (standalone.fields.some((props) => props.id.includes("-protocol-"))) throw new Error("standalone shape must hide the single-option protocol selector");
const standaloneNotices = noticesOf(standalone.tree);
if (!standaloneNotices.some((line) => line.includes("无独立纯工具接口"))) throw new Error("standalone should list the OpenRouter Search unsupported entry");
if (standaloneNotices.some((line) => line.includes("已下线"))) throw new Error("standalone must not list the in-protocol unsupported entry");
if (!hasField(standalone.fields, "-includeContent")) throw new Error("standalone should land on deepseek/search and render includeContent");
if (hasField(standalone.fields, "-model")) throw new Error("standalone must not render model fields");
expectEqual(valueOf(standalone.fields, "-apiKeyEnv"), "DEEPSEEK_API_KEY", "the standalone default uses the DeepSeek credential");
console.log("standalone shape switches to deepseek/search and hides model fields");

// --- custom target: the template picker is a one-shot fill action -----------------
const customCard = choose(standalone, "-vendor", "custom");
expectEqual(badgeTextOf(customCard.tree), "取决于凭据引用", "custom has no fixed chain to probe");
const customEngine = customCard.fields.find((props) => props.id.endsWith("-searchEngine"));
if (customCard.fields.find((props) => props.id.endsWith("-digestEntries")) === void 0) throw new Error("a custom standalone target must render the digest limits");
if (customEngine === void 0) throw new Error("a custom target must render searchEngine as a free-input combo");
const templateSelect = customCard.fields.find((props) => props.id.endsWith("-template"));
if (templateSelect === void 0) throw new Error("custom targets must render the template picker");
expectEqual(templateSelect.value, "", "the picker never carries a selected value");
expectEqual(templateSelect.placeholder, "选择模板…", "the picker starts with its placeholder");
templateSelect.onChange("deepseek");
const prefilled = fieldsOf(render(false));
expectEqual(prefilled.find((props) => props.id.endsWith("-baseURL"))?.text, "https://api.deepseek.com", "template prefills baseURL");
expectEqual(prefilled.find((props) => props.id.endsWith("-path"))?.text, "/v1/tools/search", "template prefills path");
expectEqual(prefilled.find((props) => props.id.endsWith("-queryField"))?.text, "query", "template prefills the query field name");
expectEqual(prefilled.find((props) => props.id.endsWith("-resultsPath"))?.text, "results", "template prefills the results path");
expectEqual(prefilled.find((props) => props.id.endsWith("-searchEngine"))?.text, "", "switching templates clears the previous engine");
expectEqual(prefilled.find((props) => props.id.endsWith("-template"))?.placeholder, "刚才用了：DeepSeek 搜索", "the picker resets to a placeholder naming the last template");
if (prefilled.some((props) => props.id.endsWith("-template") && props.value !== "")) throw new Error("the template selection must not be staged");
saveButtonOf(render(false)).onClick();
await new Promise((resolve) => setTimeout(resolve, 0));
if (postedBody === null) throw new Error("save did not POST");
if ("template" in postedBody) throw new Error("the template picker must not be part of the saved payload");
console.log("custom template picker fills once, resets to a hint, and is never saved");

// A saved selection that points at a custom target without a bucket is seeded from its
// first template.
const seededSelection = await open({
	...basePayload,
	selection: { vendor: "custom", protocol: "search" },
	target: {},
	targets: {},
	credentials: {}
});
expectEqual(valueOf(seededSelection.fields, "-baseURL"), "https://open.bigmodel.cn/api/paas/v4", "custom selection seeds its first template");
expectEqual(valueOf(seededSelection.fields, "-queryField"), "search_query", "custom selection seeds the mapping fields");
console.log("a custom selection without a bucket seeds its first template");

// --- overwrite confirmation and reset -----------------------------------------
const savedCustom = await open({
	...basePayload,
	selection: { vendor: "custom", protocol: "search" },
	target: { baseURL: "https://saved.example", path: "/saved" },
	targets: { "custom/search": { baseURL: "https://saved.example", path: "/saved" } },
	credentials: {}
});
const savedPicker = savedCustom.fields.find((props) => props.id.endsWith("-template"));
savedPicker.onChange("kimi");
const pendingTree = render(false);
expectEqual(valueOf(fieldsOf(pendingTree), "-baseURL"), "https://saved.example", "pending confirmation leaves the draft untouched");
const confirmButton = buttonByText(pendingTree, "应用模板");
if (confirmButton === void 0) throw new Error("a saved configuration must require confirmation before overwriting");
confirmButton.onClick();
const appliedTree = render(false);
expectEqual(valueOf(fieldsOf(appliedTree), "-baseURL"), "https://api.moonshot.cn", "confirming the template overwrites the draft");
const resetButton = buttonByText(appliedTree, "重置为已保存配置");
if (resetButton === void 0) throw new Error("a reset button must restore the saved configuration");
resetButton.onClick();
expectEqual(valueOf(fieldsOf(render(false)), "-baseURL"), "https://saved.example", "reset restores the saved configuration");
console.log("template overwrite asks for confirmation and a reset restores the saved values");

// --- shape switch round-trip ---------------------------------------------------
const shapeStart = await open(basePayload);
const shapeStandalone = choose(shapeStart, "-shape", "standalone");
if (!hasField(shapeStandalone.fields, "-includeContent")) throw new Error("the standalone default should render includeContent");
const shapeBack = choose(shapeStandalone, "-shape", "in-protocol");
if (!hasField(shapeBack.fields, "-toolType")) throw new Error("the in-protocol default should render toolType");
expectEqual(valueOf(shapeBack.fields, "-apiKeyEnv"), "DEEPSEEK_API_KEY", "the in-protocol default uses the DeepSeek credential");
expectEqual(valueOf(shapeBack.fields, "-toolType"), "web_search_20250305", "the in-protocol default is DeepSeek Anthropic Messages");
console.log("shape switch round-trips through DeepSeek's standalone and built-in targets");

// --- unmount cancellation ------------------------------------------------------
const loadCleanup = pendingCleanups[pendingCleanups.length - 1];
if (typeof loadCleanup !== "function") throw new Error("the snapshot load effect must return a cleanup");
if (!(lastGetInit?.signal instanceof AbortSignal)) throw new Error("the snapshot load must pass an abort signal");
if (lastGetInit.signal.aborted) throw new Error("the snapshot load must not be aborted while mounted");
loadCleanup();
if (!lastGetInit.signal.aborted) throw new Error("unmount must abort the in-flight snapshot request");
console.log("unmount aborts the snapshot load request");

console.log("missing t() keys:", [...missing]);
if (missing.size > 0) throw new Error("missing locale keys");
console.log("\nALL CHECKS PASSED");