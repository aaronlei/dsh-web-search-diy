window.__ModuleLoader__.load({
	id: "dsh-web-search-diy",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
		let react = require("react");
		let react_jsx_runtime = require("react/jsx-runtime");
		//#region src/client/index.tsx
		/**
		* dsh-web-search-diy — client 配置卡片。
		*
		* 注册到设置 → 插件 → 插件配置 页的 `settings.plugin.item` slot
		* （第三方插件贡献卡片的标准席位，不依赖官方白名单），与官方随包的
		* 终端 / Agent 循环 / Subagent / 网页搜索卡片共用同一个卡片列表。
		*
		* 卡片视觉与交互复刻官方 `PluginCard`（`@deepseek-ai/dsh-client-ui-settings-plugins`）：
		*   - 折叠态只显示 标题 + 一句描述 + 未保存徽标 + chevron；点击 header 展开。
		*   - 字段走官方 `ValueField` / `SecretField` 的形态（label 行 + 输入 + hint）。
		*   - 底部 footer 为 失败文案 + 放弃修改 + 保存，右对齐；保存成功自动收起。
		*   - 文案经 locale 服务注册为自有命名空间，跟随 设置 → 语言（zh / en）。
		* 样式不复用官方构建产物的 hashed 类名（升级即失效），而是注入同规则的
		* 自有样式表，全部颜色走 `--dsw-alias-*` 主题变量，深浅色自动跟随。
		*
		* 卡片通过 host 的 /api/web-search-diy/config 端点读写配置：
		*   - baseURL / apiKeyEnv / model / maxOutputTokens → 存 $DSH_HOME/dsh-web-search-diy.json
		*   - API key → host 经 credentials seam 只写存储（不落配置、不回显）
		* 编辑先暂存在草稿里（header 出现「未保存」），点保存才提交；保存即生效，无需重启。
		*/
		/** Stable plugin id, stamped into the loader handoff. */
		const ID = "dsh-web-search-diy";
		/** Locale namespace for this card's strings. */
		const NS = "dshWebSearchDiy";
		/** Service dependencies: the slot registry and the locale service. */
		const inject = ["slots", "locale"];
		/** Config endpoints the host half serves. */
		const CONFIG_URL = "/api/web-search-diy/config";
		/** Minimal class joiner (the official cards use clsx; we need three joins at most). */
		function cx(...names) {
			return names.filter(Boolean).join(" ");
		}
		//#region card stylesheet
		/**
		* Styles mirroring the official PluginCard.module.css and fields.module.css
		* rules, under our own `dwsd-` class prefix. Aliases only — no literals —
		* so dark/light theming stays owned by the app.
		*/
		const CARD_CSS = [
			".dwsd-card{border:.5px solid var(--dsw-alias-border-l4);background:var(--dsw-alias-bg-layer-3);border-radius:16px;list-style:none;transition:border-color .16s,background .16s}",
			".dwsd-card:hover{border-color:var(--dsw-alias-label-dimmed)}",
			".dwsd-cardOpen{background:var(--dsw-alias-bg-layer-2);border-color:var(--dsw-alias-label-dimmed)}",
			".dwsd-header{appearance:none;width:100%;font:inherit;color:inherit;text-align:left;cursor:pointer;background:0 0;border:0;border-radius:12px;align-items:center;gap:12px;padding:14px 16px;display:flex}",
			".dwsd-header:focus-visible{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:-2px}",
			".dwsd-headText{flex-direction:column;flex:1;gap:4px;min-width:0;display:flex}",
			".dwsd-name{color:var(--dsw-alias-label-primary);font-size:15px;font-weight:600;line-height:1.4}",
			".dwsd-description{color:var(--dsw-alias-label-tertiary);font-size:13px;line-height:1.5}",
			".dwsd-chevron{color:var(--dsw-alias-label-tertiary);flex:none;transition:transform .16s}",
			".dwsd-chevronOpen{transform:rotate(180deg)}",
			".dwsd-body{border-top:.5px solid var(--dsw-alias-border-l2);margin:0 16px;padding-bottom:8px}",
			".dwsd-status{color:var(--dsw-alias-label-tertiary);margin:12px 0 0;font-size:12px;line-height:1.5}",
			".dwsd-pending{white-space:nowrap;background:var(--dsw-alias-bg-module-platform);color:var(--dsw-alias-label-secondary);border-radius:999px;flex:none;padding:1px 8px;font-size:11px;font-weight:500;line-height:17px}",
			".dwsd-footer{border-top:.5px solid var(--dsw-alias-border-l2);justify-content:flex-end;align-items:center;gap:8px;padding:12px 0 4px;display:flex}",
			".dwsd-failed{min-width:0;color:var(--dsw-alias-label-error);flex:1;margin:0;font-size:12px;line-height:1.5}",
			".dwsd-discard,.dwsd-save{appearance:none;font:inherit;cursor:pointer;border:1px solid #0000;border-radius:8px;padding:5px 14px;font-size:13px;line-height:1.5}",
			".dwsd-discard{border-color:var(--dsw-alias-border-l2);color:var(--dsw-alias-label-secondary);background:0 0}",
			".dwsd-discard:hover:not(:disabled){color:var(--dsw-alias-label-primary);border-color:var(--dsw-alias-label-dimmed)}",
			".dwsd-save{background:var(--dsw-alias-label-primary);color:var(--dsw-alias-bg-layer-3)}",
			".dwsd-discard:disabled,.dwsd-save:disabled{opacity:.4;cursor:default}",
			".dwsd-discard:focus-visible,.dwsd-save:focus-visible{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:1px}",
			".dwsd-field{flex-direction:column;gap:6px;padding:12px 0;display:flex}",
			".dwsd-field+.dwsd-field{border-top:.5px solid var(--dsw-alias-border-l2)}",
			".dwsd-head{align-items:center;gap:8px;display:flex}",
			".dwsd-label{min-width:0;color:var(--dsw-alias-label-primary);flex:1;font-size:13px;font-weight:500;line-height:1.5}",
			".dwsd-badges{align-items:center;gap:8px;display:inline-flex}",
			".dwsd-badge{white-space:nowrap;background:var(--dsw-alias-bg-module-platform);color:var(--dsw-alias-label-secondary);border-radius:999px;padding:1px 8px;font-size:11px;font-weight:500;line-height:17px}",
			".dwsd-badgeMuted{white-space:nowrap;color:var(--dsw-alias-label-tertiary);border-radius:999px;padding:1px 8px;font-size:11px;line-height:17px}",
			".dwsd-input{border:.5px solid var(--dsw-alias-border-l4);background:var(--dsw-alias-bg-layer-3);height:34px;font:inherit;color:var(--dsw-alias-label-primary);border-radius:8px;padding:0 12px;font-size:13px;line-height:1.5}",
			".dwsd-input:focus-visible{border-color:var(--dsw-alias-brand-primary);outline:none}",
			".dwsd-input:disabled{color:var(--dsw-alias-label-tertiary);cursor:default}",
			".dwsd-inputInvalid{border-color:var(--dsw-alias-label-error)}",
			".dwsd-invalid{color:var(--dsw-alias-label-error);margin:0;font-size:12px;line-height:1.5}",
			".dwsd-hint{color:var(--dsw-alias-label-tertiary);margin:0;font-size:12px;line-height:1.5}"
		].join("");
		/** Idempotently install the card stylesheet into the document head. */
		function injectStyles() {
			if (typeof document === "undefined") return;
			const tagId = "dsh-web-search-diy/client.css";
			if (document.querySelector("style[data-plugin-css=" + JSON.stringify(tagId) + "]") !== null) return;
			const tag = document.createElement("style");
			tag.dataset.plugin = ID;
			tag.dataset.pluginCss = tagId;
			tag.textContent = CARD_CSS;
			document.head.appendChild(tag);
		}
		//#endregion
		//#region locales
		/** Simplified Chinese copy. */
		const zh = {
			title: "自定义网页搜索",
			description: "OpenAI 兼容的联网搜索提供方（Responses API + web_search 工具）。",
			expand: "展开设置",
			collapse: "收起设置",
			loading: "正在读取配置…",
			loadFailed: "读取配置失败；请确认插件服务可用后重试。",
			unsaved: "未保存",
			save: "保存",
			saving: "保存中…",
			discard: "放弃修改",
			baseURL: "接口地址 baseURL",
			baseURLHint: "留空则使用提供方默认地址（Qwen Token Plan 兼容端点）。",
			apiKeyEnv: "凭据引用 apiKeyEnv",
			apiKeyEnvHint: "凭据服务中保存密钥所用的引用名。",
			model: "模型 model",
			modelHint: "任意暴露 web_search 工具的 Responses API 模型。",
			maxOutputTokens: "最大输出 tokens",
			maxOutputTokensHint: "单次搜索回合（推理 + 工具调用 + 回答）的输出上限。",
			invalidNumber: "请填正整数；留空表示使用默认值。",
			apiKey: "API 密钥",
			apiKeyHint: "经凭据服务只写存储（~/.dsh/.credentials.yaml），不写入配置文件。留空表示保持当前密钥。",
			apiKeySet: "已配置密钥。",
			apiKeyUnset: "未配置密钥；配置之前搜索不可用。"
		};
		/** English copy. */
		const en = {
			title: "Custom web search",
			description: "An OpenAI-compatible web search provider (Responses API + web_search tool).",
			expand: "Show settings",
			collapse: "Hide settings",
			loading: "Reading the configuration…",
			loadFailed: "The configuration could not be read; retry once the plugin service is available.",
			unsaved: "Unsaved",
			save: "Save",
			saving: "Saving…",
			discard: "Discard",
			baseURL: "Endpoint (baseURL)",
			baseURLHint: "Leave blank to use the provider default (the Qwen Token Plan compatible endpoint).",
			apiKeyEnv: "Credential reference (apiKeyEnv)",
			apiKeyEnvHint: "The reference the credentials service stores the key under.",
			model: "Model",
			modelHint: "Any Responses API model exposing the web_search tool.",
			maxOutputTokens: "Max output tokens",
			maxOutputTokensHint: "Output cap for one search turn (reasoning + tool use + answer).",
			invalidNumber: "Enter a positive integer, or leave blank to use the default.",
			apiKey: "API key",
			apiKeyHint: "Stored through the credentials service (~/.dsh/.credentials.yaml), never in the config file. Leave blank to keep the current key.",
			apiKeySet: "A key is configured.",
			apiKeyUnset: "No key is configured; search is unavailable until one is."
		};
		//#endregion
		//#region fields
		/**
		* One settings field: a head row (label, optional trailing badges), the
		* control, and a hint line — the official ValueField's exact layout.
		* @param props - the field's copy and its staged text.
		* @returns the labelled control.
		*/
		function ValueField(props) {
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: "dwsd-field",
				children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						className: "dwsd-head",
						children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("label", {
							className: "dwsd-label",
							htmlFor: props.id,
							children: props.label
						})
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
						id: props.id,
						className: props.invalid ? "dwsd-input dwsd-inputInvalid" : "dwsd-input",
						type: "text",
						...props.numeric === true ? { inputMode: "numeric" } : {},
						...props.invalid ? { "aria-invalid": true } : {},
						value: props.text,
						placeholder: props.placeholder ?? "",
						spellCheck: false,
						autoComplete: "off",
						disabled: props.disabled,
						onChange: (event) => {
							props.onEdit(event.target.value);
						}
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
						className: props.invalid ? "dwsd-invalid" : "dwsd-hint",
						children: props.invalid ? props.invalidLabel : props.hint
					})
				]
			});
		}
		/**
		* A write-only credential control. The stored key never rides a response,
		* so the control starts blank and reports only whether one is configured —
		* the official SecretField's contract, mirrored here.
		* @param props - the field's copy, its staged text, and the configured state.
		* @returns the labelled control.
		*/
		function SecretField(props) {
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: "dwsd-field",
				children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: "dwsd-head",
						children: [
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("label", {
								className: "dwsd-label",
								htmlFor: props.id,
								children: props.label
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
								className: "dwsd-badges",
								children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
									className: props.configured ? "dwsd-badge" : "dwsd-badgeMuted",
									children: props.stateLabel
								})
							})
						]
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
						id: props.id,
						className: "dwsd-input",
						type: "password",
						autoComplete: "off",
						value: props.text,
						disabled: props.disabled,
						onChange: (event) => {
							props.onEdit(event.target.value);
						}
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
						className: "dwsd-hint",
						children: props.hint
					})
				]
			});
		}
		//#endregion
		//#region config card
		/** Normalize one GET /config payload into the card's saved snapshot. */
		function toSnapshot(data) {
			return {
				baseURL: data.baseURL ?? "",
				apiKeyEnv: data.apiKeyEnv ?? "",
				model: data.model ?? "",
				maxOutputTokens: data.maxOutputTokens != null ? String(data.maxOutputTokens) : "",
				keyConfigured: !!data.keyConfigured
			};
		}
		/** The 14px outline chevron the official card headers rotate. */
		function ChevronIcon({ className }) {
			return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("svg", {
				className,
				viewBox: "0 0 14 14",
				width: 14,
				height: 14,
				fill: "none",
				"aria-hidden": true,
				children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("path", {
					d: "M3.5 5.25L7 8.75L10.5 5.25",
					stroke: "currentColor",
					"stroke-width": 1.2,
					"stroke-linecap": "round",
					"stroke-linejoin": "round"
				})
			});
		}
		/**
		* The configuration card itself, sharing the official PluginCard's face:
		* a disclosure header over a staged form, with discard/save in a footer.
		*
		* Edits stage locally; the header shows an "unsaved" badge while the draft
		* differs from what the Host holds. Save POSTs the draft (an empty token
		* field means "keep the default"; a blank key field writes nothing), then
		* re-reads the authoritative config and — like the official cards —
		* collapses the card. A rejected save keeps the card open with the error
		* in the footer, exactly where the official card reports save failures.
		*
		* @param props - the slot kit; `t` resolves this card's locale namespace.
		* @returns the card.
		*/
		function ConfigCard(props) {
			const { t } = props;
			const [loaded, setLoaded] = (0, react.useState)(false);
			const [loadFailed, setLoadFailed] = (0, react.useState)(false);
			const [saved, setSaved] = (0, react.useState)({ baseURL: "", apiKeyEnv: "", model: "", maxOutputTokens: "", keyConfigured: false });
			const [draft, setDraft] = (0, react.useState)({ baseURL: "", apiKeyEnv: "", model: "", maxOutputTokens: "" });
			const [apiKeyDraft, setApiKeyDraft] = (0, react.useState)("");
			const [open, setOpen] = (0, react.useState)(false);
			const [saving, setSaving] = (0, react.useState)(false);
			const [failed, setFailed] = (0, react.useState)("");
			(0, react.useEffect)(() => {
				let alive = true;
				fetch(CONFIG_URL).then((r) => {
					if (!r.ok) throw new Error(`HTTP ${r.status}`);
					return r.json();
				}).then((data) => {
					if (!alive) return;
					const snapshot = toSnapshot(data);
					setSaved(snapshot);
					setDraft({ baseURL: snapshot.baseURL, apiKeyEnv: snapshot.apiKeyEnv, model: snapshot.model, maxOutputTokens: snapshot.maxOutputTokens });
					setLoaded(true);
					setLoadFailed(false);
				}).catch(() => {
					if (alive) setLoadFailed(true);
				});
				return () => {
					alive = false;
				};
			}, []);
			const dirty = draft.baseURL !== saved.baseURL || draft.apiKeyEnv !== saved.apiKeyEnv || draft.model !== saved.model || draft.maxOutputTokens !== saved.maxOutputTokens || apiKeyDraft !== "";
			const tokensText = draft.maxOutputTokens.trim();
			const tokensInvalid = tokensText !== "" && !(Number.isInteger(Number(tokensText)) && Number(tokensText) >= 1);
			const discard = () => {
				setDraft({ baseURL: saved.baseURL, apiKeyEnv: saved.apiKeyEnv, model: saved.model, maxOutputTokens: saved.maxOutputTokens });
				setApiKeyDraft("");
				setFailed("");
			};
			const save = async () => {
				setSaving(true);
				setFailed("");
				try {
					const body = { baseURL: draft.baseURL, apiKeyEnv: draft.apiKeyEnv, model: draft.model };
					if (tokensText !== "") body.maxOutputTokens = Number(tokensText);
					if (apiKeyDraft !== "") body.apiKey = apiKeyDraft;
					const r = await fetch(CONFIG_URL, {
						method: "POST",
						headers: { "Content-Type": "application/json" },
						body: JSON.stringify(body)
					});
					const data = await r.json().catch(() => ({}));
					if (!r.ok) {
						setFailed(data.error ?? `HTTP ${r.status}`);
						return;
					}
					const fresh = await fetch(CONFIG_URL).then((response) => response.json());
					const snapshot = toSnapshot(fresh);
					setSaved(snapshot);
					setDraft({ baseURL: snapshot.baseURL, apiKeyEnv: snapshot.apiKeyEnv, model: snapshot.model, maxOutputTokens: snapshot.maxOutputTokens });
					setApiKeyDraft("");
					setOpen(false);
				} catch (e) {
					setFailed(String(e));
				} finally {
					setSaving(false);
				}
			};
			const blocked = !dirty || tokensInvalid || saving;
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("li", {
				className: cx("dwsd-card", open && "dwsd-cardOpen"),
				children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("button", {
						type: "button",
						className: "dwsd-header",
						"aria-expanded": open,
						"aria-label": `${t(open ? "collapse" : "expand")}: ${t("title")}`,
						onClick: () => {
							setOpen(!open);
						},
						children: [
							/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
								className: "dwsd-headText",
								children: [
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
										className: "dwsd-name",
										children: t("title")
									}),
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
										className: "dwsd-description",
										children: t("description")
									})
								]
							}),
							dirty ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
								className: "dwsd-pending",
								children: t("unsaved")
							}) : null,
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)(ChevronIcon, { className: cx("dwsd-chevron", open && "dwsd-chevronOpen") })
						]
					}),
					open ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: "dwsd-body",
						children: [
							!loaded && !loadFailed ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
								className: "dwsd-status",
								role: "status",
								children: t("loading")
							}) : null,
							loadFailed ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
								className: "dwsd-failed",
								role: "status",
								children: t("loadFailed")
							}) : null,
							loaded ? [
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)(ValueField, {
									id: "plugin-config-web-search-diy-base-url",
									label: t("baseURL"),
									hint: t("baseURLHint"),
									text: draft.baseURL,
									onEdit: (text) => {
										setDraft((current) => ({ ...current, baseURL: text }));
									}
								}, "baseURL"),
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)(ValueField, {
									id: "plugin-config-web-search-diy-api-key-env",
									label: t("apiKeyEnv"),
									hint: t("apiKeyEnvHint"),
									text: draft.apiKeyEnv,
									onEdit: (text) => {
										setDraft((current) => ({ ...current, apiKeyEnv: text }));
									}
								}, "apiKeyEnv"),
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)(ValueField, {
									id: "plugin-config-web-search-diy-model",
									label: t("model"),
									hint: t("modelHint"),
									text: draft.model,
									onEdit: (text) => {
										setDraft((current) => ({ ...current, model: text }));
									}
								}, "model"),
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)(ValueField, {
									id: "plugin-config-web-search-diy-max-output-tokens",
									label: t("maxOutputTokens"),
									hint: t("maxOutputTokensHint"),
									numeric: true,
									invalid: tokensInvalid,
									invalidLabel: t("invalidNumber"),
									text: draft.maxOutputTokens,
									onEdit: (text) => {
										setDraft((current) => ({ ...current, maxOutputTokens: text }));
									}
								}, "maxOutputTokens"),
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)(SecretField, {
									id: "plugin-config-web-search-diy-api-key",
									label: t("apiKey"),
									hint: t("apiKeyHint"),
									text: apiKeyDraft,
									configured: saved.keyConfigured,
									stateLabel: saved.keyConfigured ? t("apiKeySet") : t("apiKeyUnset"),
									onEdit: setApiKeyDraft
								}, "apiKey")
							] : null,
							/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
								className: "dwsd-footer",
								children: [
									failed ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
										className: "dwsd-failed",
										role: "status",
										children: failed
									}) : null,
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
										type: "button",
										className: "dwsd-discard",
										disabled: !dirty || saving,
										onClick: discard,
										children: t("discard")
									}),
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
										type: "button",
										className: "dwsd-save",
										disabled: blocked,
										onClick: save,
										children: t(saving ? "saving" : "save")
									})
								]
							})
						]
					}) : null
				]
			});
		}
		//#endregion
		/**
		* Register the configuration card into the plugin configuration section.
		*
		* `settings.plugin.item` is a KEYED slot: its registration contract requires
		* `key`, not `id`/`order` (list-slot fields). The owner (settings-plugins
		* client) renders one card per settings namespace, dispatching
		* `entryKey = namespace`, so the card registers under the `web-search-diy`
		* namespace the host half serves. `locale: NS` is what hands the component
		* its `t` — the same mechanism the shipped cards use, which is why the card
		* follows Settings → Language like the official ones do.
		*/
		function apply(ctx) {
			ctx.effect(() => {
				injectStyles();
			}, `${ID}: card stylesheet`);
			ctx.effect(() => ctx.locale.register(NS, {
				zh,
				en
			}), `${ID}: dictionaries`);
			ctx.effect(() => {
				ctx.slots.inject("settings.plugin.item", () => ctx.slots.register({
					name: "settings.plugin.item",
					key: "web-search-diy",
					locale: NS,
					inject: () => ({})
				}, ConfigCard));
			}, `${ID}: settings.plugin.item registration`);
		}
		//#endregion
		exports.ID = ID;
		exports.apply = apply;
		exports.inject = inject;
		return module.exports;
	}
});

//# sourceMappingURL=client.js.map
