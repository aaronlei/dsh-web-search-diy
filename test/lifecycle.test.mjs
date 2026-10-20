/**
 * 生命周期回归：`webServer` 服务消失时，路由注册必须随注入的子 fiber 一起撤销；
 * 服务重建后只保留一套路由。
 *
 * 这里用真实的 Cordis Context，而不是手写 mock：mock 无法复现“服务变化 → 子插件卸载”
 * 的语义，上一版的路由残留正是这样漏掉的。
 */
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, before, describe, it } from "node:test";
import { Context } from "@deepseek-ai/cordis";
import { apply } from "../lib/index.js";

let home;
const originalHome = process.env.DSH_HOME;

before(() => {
	home = mkdtempSync(join(tmpdir(), "dsh-web-search-diy-lifecycle-"));
	process.env.DSH_HOME = home;
});

after(() => {
	if (originalHome === void 0) delete process.env.DSH_HOME;
	else process.env.DSH_HOME = originalHome;
	rmSync(home, { recursive: true, force: true });
});

/** Wait for the microtask/effect queue to settle. */
const settle = () => new Promise((resolve) => setTimeout(resolve, 20));

describe("webServer lifecycle", () => {
	it("releases the routes when the service disappears and re-registers once when it returns", async () => {
		const ctx = new Context();
		ctx.provide("web", { registerSearchProvider() {} });
		let registered = 0;
		let disposed = 0;
		const server = {
			register() {
				registered += 1;
				return () => {
					disposed += 1;
				};
			}
		};
		const remove = ctx.provide("webServer", server);
		await ctx.plugin({ inject: ["web"], apply });
		await settle();
		assert.equal(registered, 2, "both config routes register while the server is present");

		await remove();
		await settle();
		assert.equal(disposed, 2, "the child fiber must release both routes before the server goes away");

		ctx.provide("webServer", server);
		await settle();
		assert.equal(registered, 4, "the replacement server sees one fresh registration per route");
		assert.equal(registered - disposed, 2, "no route from the previous server lingers");
	});
});
