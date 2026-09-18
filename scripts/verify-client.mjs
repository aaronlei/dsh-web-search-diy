/**
 * Stub-environment smoke test for lib/client.js: executes the bundle outside
 * a browser, walks the registration path (apply → slots.inject → register),
 * and renders both views of the entry with a fake React, verifying the new
 * `plugins.row.config` contract without a live dsh web.
 *
 * Run: node scripts/verify-client.mjs
 */
import { readFileSync } from "node:fs";

let registered = null; // { options, component }

// --- fake react / jsx-runtime -------------------------------------------------
const fakeReact = {
	useState: (init) => [typeof init === "function" ? init() : init, () => {}],
	useEffect: () => {},
	useMemo: (fn) => fn(),
};
const fakeJsx = (type, props, key) => ({ $$type: "jsx", type, props, key });
const fakeJsxs = fakeJsx;

// --- fake browser globals -----------------------------------------------------
const styleEl = { textContent: "" };
globalThis.window = {
	__ModuleLoader__: {
		load({ id, factory }) {
			const require = (spec) => {
				if (spec === "react") return fakeReact;
				if (spec === "react/jsx-runtime") return { jsx: fakeJsx, jsxs: fakeJsxs };
				throw new Error(`unexpected require: ${spec}`);
			};
			const exports = factory(require);
			return { id, exports };
		},
	},
};
globalThis.document = {
	createElement: () => styleEl,
	head: { appendChild: () => {} },
};

// --- load the bundle ----------------------------------------------------------
const source = readFileSync(new URL("../lib/client.js", import.meta.url), "utf8");
new Function(source)(); // populates globalThis.window.__ModuleLoader__
const mod = window.__ModuleLoader__.modules?.[0] // loader may stash modules;
	?? undefined;
// The loader implementation returns the module from load(); capture via wrapper:
// (some builds stash on window; fall back to re-running with a capture)
let captured = null;
globalThis.window.__ModuleLoader__.load = undefined;
{
	const load = function ({ id, factory }) {
		const require = (spec) => {
			if (spec === "react") return fakeReact;
			if (spec === "react/jsx-runtime") return { jsx: fakeJsx, jsxs: fakeJsxs };
			throw new Error(`unexpected require: ${spec}`);
		};
		captured = { id, exports: factory(require) };
	};
	globalThis.window.__ModuleLoader__ = { load };
	new Function(source)();
}

const { id, exports } = captured;
console.log(`module id: ${id}`);
if (id !== "dsh-web-search-diy") throw new Error(`unexpected module id ${id}`);
if (typeof exports.apply !== "function") throw new Error("apply missing");

// --- fake plugin ctx ----------------------------------------------------------
const effects = [];
const ctx = {
	effect(fn, label) {
		effects.push({ fn, label });
	},
	locale: {
		registered: null,
		register(ns, dicts) {
			this.registered = { ns, dicts };
		},
	},
	slots: {
		inject(name, fn) {
			if (name !== "plugins.row.config") throw new Error(`inject waits on wrong slot: ${name}`);
			fn(); // slot is declared in the composition; run the registration
		},
		register(options, component) {
			registered = { options, component };
		},
	},
};
exports.apply(ctx);

console.log(`effects: ${effects.map((e) => e.label).join(" | ")}`);
if (!registered) throw new Error("plugins.row.config entry was not registered");
console.log(`registered slot: ${registered.options.name}`);
console.log(`registered key:  ${registered.options.key}`);
if (registered.options.name !== "plugins.row.config") throw new Error("wrong slot name");
if (registered.options.key !== "dsh-web-search-diy#web-search-diy") throw new Error(`wrong key: ${registered.options.key}`);

const dicts = ctx.locale.registered;
if (!dicts || dicts.ns !== "dshWebSearchDiy") throw new Error("locale namespace not registered");
const t = (key) => dicts.dicts.zh[key] ?? `<missing:${key}>`;

// --- both views ---------------------------------------------------------------
const summary = registered.component({ t, view: "summary" });
console.log(`summary view: ${JSON.stringify(summary)}`);
if (typeof summary !== "string" || summary.length === 0 || summary.startsWith("<missing")) throw new Error("bad summary");

const page = registered.component({ t, view: "page" });
console.log(`page view element: $$type=${page.$$type} type=${page.type?.name ?? "?"}`);
if (page.$$type !== "jsx" || typeof page.type !== "function") throw new Error("page view is not the form component");

// Render the page component's static return with the fake hooks (it will run
// the fetch path via useEffect stub = no-op; useState returns initial values).
const el = page.type({ t });
console.log(`page root: <${el.type}> children=${Array.isArray(el.props.children) ? el.props.children.length : 1}`);
console.log("\nALL CHECKS PASSED");
