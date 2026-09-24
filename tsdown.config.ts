/**
 * tsdown configuration for the browser-side bundle.
 *
 * The host consumes a **built** `lib/client.js`: `dsh.client` in package.json
 * points at it, and dsh-client-modules serves it to the browser, where the
 * shell's `window.__ModuleLoader__` materializes the factory. The banner and
 * footer therefore wrap rolldown's CommonJS output in exactly that loader
 * handoff (the same shape the official client plugins ship), and React stays
 * external — the platform module table provides it, so it must never be
 * bundled.
 *
 * Run `pnpm run bundle` (one shot) or `pnpm run watch` (rebuild on change);
 * `npm run test:client` then exercises the built artifact's contracts.
 */
import { defineConfig } from "tsdown";

export default defineConfig({
	entry: ["src/client/index.tsx"],
	outDir: "lib",
	format: "cjs",
	platform: "browser",
	target: "es2022",
	deps: {
		neverBundle: ["react", "react/jsx-runtime"]
	},
	dts: false,
	clean: false,
	sourcemap: true,
	outputOptions: {
		entryFileNames: "client.js",
		strict: false,
		banner: [
			"window.__ModuleLoader__.load({",
			`\tid: "dsh-web-search-diy",`,
			"\tfactory: (require) => {",
			"\t\tvar module = { exports: {} };",
			"\t\tvar exports = module.exports;"
		].join("\n"),
		footer: [
			"\t\treturn module.exports;",
			"\t}",
			"});"
		].join("\n")
	}
});
