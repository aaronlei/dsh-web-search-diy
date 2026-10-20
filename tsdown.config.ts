/**
 * tsdown 配置：双产物。
 *
 * 1. **Host**（`src/index.ts` → `lib/index.js`）：Cordis 插件本体，ESM，跑在 Node。
 *    `@deepseek-ai/*` 依赖（schemastery / credentials / launch-environment / web）
 *    与 `node:*` 内建模块保持 external —— 它们由宿主部署提供，不能打进产物。
 * 2. **Client**（`src/client/index.tsx` → `lib/client.js`）：浏览器侧 bundle。宿主
 *    消费的是**已构建**文件：package.json 的 `dsh.client` 指向它，
 *    dsh-client-modules 会把它送到浏览器，由 shell 的
 *    `window.__ModuleLoader__` 实例化工厂。banner/footer 因此把 rolldown 的
 *    CommonJS 输出包成那个 loader 交接形状（与官方 client 插件一致），React 保持
 *    external —— 平台模块表提供它，绝不能打包进来。
 *
 * 跑 `pnpm run build`（一次）或 `pnpm run watch`（改动重建）；
 * `pnpm run test:client` 随后验证客户端产物契约。
 */
import { defineConfig } from "tsdown";
import { readFileSync } from "node:fs";

/** The published package name, used for the client loader handoff. */
const manifest = JSON.parse(readFileSync(new URL("./package.json", import.meta.url), "utf8")) as { name: string };

export default defineConfig([
	// Host: Cordis plugin, ESM for Node.
	{
		entry: ["src/index.ts"],
		outDir: "lib",
		format: "esm",
		platform: "node",
		target: "node20",
		dts: false,
		clean: false,
		sourcemap: false,
		outputOptions: {
			entryFileNames: "index.js"
		}
	},
	// Client: browser bundle wrapped in the loader handoff.
	{
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
				`\tid: ${JSON.stringify(manifest.name)},`,
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
	}
]);