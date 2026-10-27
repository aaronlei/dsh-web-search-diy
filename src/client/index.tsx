/**
 * dsh-web-search-diy — client 配置卡片入口（2.0：搜索形态 → 协议 → 厂商）。
 *
 * 注册到侧栏「插件」页本插件卡片的 `plugins.bundle.config` 槽位；点击已安装插件列表
 * 中的本插件卡片即直接进入配置页，`summary` 是兜底的一句话简介，`page` 是带保存控件的整页表单。
 *
 * 2.0 起 Client 不再硬编码厂商默认值：`GET /api/web-search-diy/config` 下发完整
 * catalog，`page.tsx` 只负责三层选择、按 `fields` 渲染表单、把草稿按
 * `{ vendor, protocol, ...fields }` 提交。字段值域是显示层副本，Host 的
 * `buildConfigPatch` 才是权威校验。
 *
 * 模块划分：`consts`（id/端点）、`types`（草稿与字段 props）、`field-meta`（字段元数据）、
 * `draft`（草稿读写）、`fields.tsx`（控件）、`page.tsx`（整页表单）、`styles`、`locale`。
 * 它们由 tsdown 内联成单个 `lib/client.js`，loader id 仍是包名。
 *
 * @module dsh-web-search-diy/client
 */
import { ID, NS } from "./consts.ts";
import type { PluginContext } from "./types.ts";
import { ConfigPage } from "./page.tsx";
import { injectStyles } from "./styles.ts";
import { en, zh } from "./locale.ts";

/** Service dependencies: the slot registry and the locale service. */
const inject = ["slots", "locale"];

//#region plugin
/**
 * Register the bundle's configuration entry on the Plugins page.
 *
 * `plugins.bundle.config` is keyed by the package name (`dsh-web-search-diy`),
 * so clicking this bundle's card in the installed-plugin list opens the form
 * directly. `locale: NS` is what hands the component its `t`, so the page follows
 * Settings → Language.
 */
function apply(ctx: PluginContext): void {
	ctx.effect(() => {
		injectStyles();
	}, `${ID}: page stylesheet`);
	ctx.effect(() => ctx.locale.register(NS, { zh, en }), `${ID}: dictionaries`);
	ctx.effect(() => {
		ctx.slots.inject("plugins.bundle.config", () => ctx.slots.register({
			name: "plugins.bundle.config",
			key: ID,
			locale: NS
		}, (props) => props.view === "summary" ? props.t("description") : <ConfigPage t={props.t} />));
	}, `${ID}: plugins.bundle.config registration`);
}
//#endregion

export { ID, apply, inject };
