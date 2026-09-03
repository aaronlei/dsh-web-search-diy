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
		* （第三方插件贡献卡片的标准席位，不依赖官方白名单）。
		* 卡片通过 host 的 /api/web-search-diy/config 端点读写配置：
		*   - baseURL / apiKeyEnv / model / maxOutputTokens → 存 $DSH_HOME/dsh-web-search-diy.json
		*   - API key → host 经 credentials seam 只写存储（不落配置、不回显）
		* 保存即生效，无需重启。
		*/
		/** Stable plugin id, stamped into the loader handoff. */
		const ID = "dsh-web-search-diy";
		/** Locale namespace for this card's strings. */
		const NS = "dshWebSearchDiy";
		/** Service dependencies: we only need the slot registry. */
		const inject = ["slots"];
		const row = {
			display: "flex",
			alignItems: "center",
			gap: 8,
			margin: "6px 0",
			flexWrap: "wrap"
		};
		const label = {
			width: 150,
			flex: "0 0 auto",
			fontSize: 12,
			color: "var(--dsh-text-secondary, #888)"
		};
		const input = {
			flex: "1 1 280px",
			minWidth: 200,
			padding: "5px 8px",
			borderRadius: 6,
			border: "1px solid var(--dsh-border, #444)",
			background: "var(--dsh-bg-input, transparent)",
			color: "var(--dsh-text, inherit)",
			fontSize: 13
		};
		const hint = {
			fontSize: 11,
			color: "var(--dsh-text-tertiary, #999)",
			margin: "2px 0 0 158px"
		};
		function ConfigCard() {
			const [baseURL, setBaseURL] = (0, react.useState)("");
			const [apiKeyEnv, setApiKeyEnv] = (0, react.useState)("");
			const [model, setModel] = (0, react.useState)("");
			const [maxOutputTokens, setMaxOutputTokens] = (0, react.useState)("");
			const [apiKey, setApiKey] = (0, react.useState)("");
			const [keyConfigured, setKeyConfigured] = (0, react.useState)(false);
			const [status, setStatus] = (0, react.useState)("加载中…");
			(0, react.useEffect)(() => {
				let alive = true;
				fetch("/api/web-search-diy/config").then((r) => r.json()).then((data) => {
					if (!alive) return;
					setBaseURL(data.baseURL ?? "");
					setApiKeyEnv(data.apiKeyEnv ?? "");
					setModel(data.model ?? "");
					setMaxOutputTokens(data.maxOutputTokens != null ? String(data.maxOutputTokens) : "");
					setKeyConfigured(!!data.keyConfigured);
					setStatus("");
				}).catch((e) => {
					if (alive) setStatus("加载配置失败: " + String(e));
				});
				return () => {
					alive = false;
				};
			}, []);
			const save = async () => {
				setStatus("保存中…");
				try {
					const body = {
						baseURL,
						apiKeyEnv,
						model
					};
					if (maxOutputTokens.trim() !== "") body.maxOutputTokens = Number(maxOutputTokens);
					if (apiKey.trim() !== "") body.apiKey = apiKey;
					const r = await fetch("/api/web-search-diy/config", {
						method: "POST",
						headers: { "Content-Type": "application/json" },
						body: JSON.stringify(body)
					});
					const data = await r.json().catch(() => ({}));
					if (r.ok) {
						setStatus("已保存 ✓ 立即生效（无需重启）");
						setApiKey("");
						if (typeof data.keyConfigured === "boolean") setKeyConfigured(data.keyConfigured);
					} else setStatus("保存失败: " + (data.error ?? `HTTP ${r.status}`));
				} catch (e) {
					setStatus("保存失败: " + String(e));
				}
			};
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				style: { padding: "4px 0" },
				children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						style: {
							fontSize: 12,
							color: "var(--dsh-text-secondary, #888)",
							marginBottom: 6
						},
						children: "自定义 OpenAI 兼容联网搜索（Responses API + web_search 工具）。默认 Qwen Token Plan，可改端点/模型切换任意兼容网关。"
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						style: row,
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("label", {
							style: label,
							children: "端点 baseURL"
						}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
							style: input,
							value: baseURL,
							onChange: (e) => setBaseURL(e.target.value),
							placeholder: "https://…/compatible-mode/v1",
							spellCheck: false
						})]
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						style: row,
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("label", {
							style: label,
							children: "凭据引用 apiKeyEnv"
						}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
							style: input,
							value: apiKeyEnv,
							onChange: (e) => setApiKeyEnv(e.target.value),
							placeholder: "QWEN_TOKEN_PLAN_CN_API_KEY",
							spellCheck: false
						})]
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						style: row,
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("label", {
							style: label,
							children: "模型 model"
						}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
							style: input,
							value: model,
							onChange: (e) => setModel(e.target.value),
							placeholder: "deepseek-v4-flash-0731",
							spellCheck: false
						})]
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						style: row,
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("label", {
							style: label,
							children: "maxOutputTokens"
						}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
							style: {
								...input,
								maxWidth: 160
							},
							value: maxOutputTokens,
							onChange: (e) => setMaxOutputTokens(e.target.value),
							placeholder: "1024"
						})]
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						style: row,
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", {
							style: label,
							children: ["API 密钥 ", keyConfigured ? "（已配置 ✓）" : "（未配置）"]
						}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
							style: input,
							type: "password",
							value: apiKey,
							onChange: (e) => setApiKey(e.target.value),
							placeholder: keyConfigured ? "留空保持已存密钥" : "粘贴 API key",
							autoComplete: "off"
						})]
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						style: hint,
						children: "密钥经凭据服务只写存储（~/.dsh/.credentials.yaml），绝不写入配置或代码。"
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						style: {
							margin: "10px 0 0 158px",
							display: "flex",
							alignItems: "center",
							gap: 10
						},
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
							type: "button",
							onClick: save,
							style: {
								padding: "5px 18px",
								borderRadius: 6,
								border: "1px solid var(--dsh-border, #444)",
								background: "var(--dsh-bg-accent, #2d7ff9)",
								color: "#fff",
								cursor: "pointer",
								fontSize: 13
							},
							children: "保存"
						}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
							style: {
								fontSize: 12,
								color: status.startsWith("已保存") ? "var(--dsh-text-success, #3fb950)" : "var(--dsh-text-secondary, #888)"
							},
							children: status
						})]
					})
				]
			});
		}
		/**
		* Register the configuration card into the plugin configuration section.
		*
		* `settings.plugin.item` is a KEYED slot: its registration contract requires
		* `key`, not `id`/`order` (list-slot fields). The owner (settings-plugins
		* client) renders one card per settings namespace, dispatching
		* `entryKey = namespace`, so the card must register under the same
		* `web-search-diy` namespace the host half serves. The shipped cards use
		* their settings namespace as key too (shell / agent-loop / web-search-deepseek).
		*/
		function apply(ctx) {
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