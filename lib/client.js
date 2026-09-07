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
		*   - mode / baseURL / apiKeyEnv / model / maxOutputTokens 及智谱搜索
		*     选项（searchEngine / count / searchRecencyFilter / contentSize /
		*     searchDomainFilter / searchIntent / searchPrompt）→ 存 $DSH_HOME/dsh-web-search-diy.json
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
			".dwsd-hint{color:var(--dsw-alias-label-tertiary);margin:0;font-size:12px;line-height:1.5}",
			".dwsd-choices{gap:4px;display:grid}",
			".dwsd-choice{cursor:pointer;border-radius:6px;grid-template-columns:auto minmax(0,1fr);align-items:center;gap:8px;min-width:0;padding:6px;display:grid}",
			".dwsd-choice:hover{background:var(--dsw-alias-bg-layer-4)}",
			".dwsd-choice input{accent-color:var(--dsw-alias-brand-primary);margin:0}",
			".dwsd-choiceLabel{color:var(--dsw-alias-label-primary);font-size:13px;line-height:1.5}",
			".dwsd-switchRow{color:var(--dsw-alias-label-primary);justify-content:space-between;align-items:center;gap:16px;font-size:13px;line-height:1.5;display:flex}",
			".dwsd-switch{box-sizing:border-box;background:var(--dsw-alias-border-l3);cursor:pointer;border:0;border-radius:10px;flex:none;width:36px;height:20px;padding:2px;position:relative}",
			".dwsd-switchOn{background:var(--dsw-alias-brand-primary)}",
			".dwsd-switch:disabled{cursor:default;opacity:.5}",
			".dwsd-switch:focus-visible{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:2px}",
			".dwsd-thumb{background:var(--dsw-alias-label-primary-foreground);border-radius:50%;width:16px;height:16px;transition:transform .12s;display:block}",
			".dwsd-switchOn .dwsd-thumb{transform:translate(16px)}"
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
			description: "多协议网页搜索提供方：OpenAI 兼容 Responses API、智谱基础检索与问答增强。",
			expand: "展开设置",
			collapse: "收起设置",
			loading: "正在读取配置…",
			loadFailed: "读取配置失败；请确认插件服务可用后重试。",
			unsaved: "未保存",
			save: "保存",
			saving: "保存中…",
			discard: "放弃修改",
			mode: "协议模式 mode",
			modeHint: "切换搜索协议；接口地址与默认模型随模式取默认值。",
			modeResponses: "OpenAI 兼容（Responses API + web_search）",
			modeZhipuWeb: "智谱基础检索（Web Search API）",
			modeZhipuChat: "智谱问答增强（Web Search in Chat）",
			baseURL: "接口地址 baseURL",
			baseURLHint: "留空则使用当前协议模式的默认地址。",
			apiKeyEnv: "凭据引用 apiKeyEnv",
			apiKeyEnvHint: "留空则使用当前协议模式的默认引用（OpenAI 兼容：QWEN_TOKEN_PLAN_CN_API_KEY；智谱：ZHIPU_API_KEY）。",
			model: "模型 model",
			modelHint: "留空使用默认；OpenAI 兼容模式为 deepseek-v4-flash-0731，智谱问答增强为 glm-4-flash。",
			maxOutputTokens: "最大输出 tokens",
			maxOutputTokensHint: "单次搜索回合（推理 + 工具调用 + 回答）的输出上限。",
			searchEngine: "搜索引擎 searchEngine",
			searchEngineHint: "仅智谱模式生效；不同引擎单价不同。",
			engineStd: "search_std（智谱自研 · 基础）",
			enginePro: "search_pro（智谱自研 · 高级）",
			engineSogou: "search_pro_sogou（搜狗）",
			engineQuark: "search_pro_quark（夸克）",
			count: "结果条数 count",
			countHint: "单次搜索返回的结果条数（1-50）；请求自带上限时优先使用请求值。",
			searchRecencyFilter: "时间范围 searchRecencyFilter",
			searchRecencyHint: "仅智谱模式生效；限定网页发布时间窗口。",
			recencyNoLimit: "不限",
			recencyOneDay: "一天内",
			recencyOneWeek: "一周内",
			recencyOneMonth: "一月内",
			recencyOneYear: "一年内",
			contentSize: "摘要字数 contentSize",
			contentSizeHint: "仅智谱模式生效；控制网页摘要的信息量。",
			sizeMedium: "medium（摘要）",
			sizeHigh: "high（详细）",
			searchDomainFilter: "域名白名单 searchDomainFilter",
			searchDomainHint: "仅智谱模式生效；只返回指定域名（如 www.example.com）的结果，留空不限。",
			searchIntent: "意图识别 searchIntent",
			searchIntentHint: "仅智谱基础检索生效；关闭则跳过意图识别直接搜索。",
			searchIntentOn: "开启",
			searchIntentOff: "关闭",
			searchPrompt: "搜索提示词 searchPrompt",
			searchPromptHint: "仅智谱问答增强生效；定制搜索结果的整合方式，留空使用官方默认。",
			invalidNumber: "请填正整数；留空表示使用默认值。",
			invalidCount: "请填 1-50 的整数；留空表示使用默认值。",
			apiKey: "API 密钥",
			apiKeyHint: "经凭据服务只写存储（~/.dsh/.credentials.yaml），不写入配置文件。留空表示保持当前密钥。",
			apiKeySet: "已配置密钥。",
			apiKeyUnset: "未配置密钥；配置之前搜索不可用。"
		};
		/** English copy. */
		const en = {
			title: "Custom web search",
			description: "A multi-protocol web search provider: OpenAI-compatible Responses API, Zhipu Web Search API, and Web Search in Chat.",
			expand: "Show settings",
			collapse: "Hide settings",
			loading: "Reading the configuration…",
			loadFailed: "The configuration could not be read; retry once the plugin service is available.",
			unsaved: "Unsaved",
			save: "Save",
			saving: "Saving…",
			discard: "Discard",
			mode: "Protocol (mode)",
			modeHint: "Switch the search protocol; the endpoint and default model follow the mode.",
			modeResponses: "OpenAI-compatible (Responses API + web_search)",
			modeZhipuWeb: "Zhipu Web Search API (basic retrieval)",
			modeZhipuChat: "Zhipu Web Search in Chat (answer augmentation)",
			baseURL: "Endpoint (baseURL)",
			baseURLHint: "Leave blank to use the current protocol mode's default endpoint.",
			apiKeyEnv: "Credential reference (apiKeyEnv)",
			apiKeyEnvHint: "Leave blank to use the current mode's default (OpenAI-compatible: QWEN_TOKEN_PLAN_CN_API_KEY; Zhipu: ZHIPU_API_KEY).",
			model: "Model",
			modelHint: "Leave blank for the default: deepseek-v4-flash-0731 in OpenAI-compatible mode, glm-4-flash in Zhipu chat mode.",
			maxOutputTokens: "Max output tokens",
			maxOutputTokensHint: "Output cap for one search turn (reasoning + tool use + answer).",
			searchEngine: "Search engine",
			searchEngineHint: "Zhipu modes only; engines differ in per-call pricing.",
			engineStd: "search_std (Zhipu built-in, basic)",
			enginePro: "search_pro (Zhipu built-in, advanced)",
			engineSogou: "search_pro_sogou (Sogou)",
			engineQuark: "search_pro_quark (Quark)",
			count: "Result count",
			countHint: "How many results one search returns (1-50); a request-supplied cap takes precedence.",
			searchRecencyFilter: "Recency filter",
			searchRecencyHint: "Zhipu modes only; restricts the page publication window.",
			recencyNoLimit: "No limit",
			recencyOneDay: "Past day",
			recencyOneWeek: "Past week",
			recencyOneMonth: "Past month",
			recencyOneYear: "Past year",
			contentSize: "Snippet size",
			contentSizeHint: "Zhipu modes only; controls how detailed the page snippets are.",
			sizeMedium: "medium (summary)",
			sizeHigh: "high (detailed)",
			searchDomainFilter: "Domain allowlist",
			searchDomainHint: "Zhipu modes only; only results from the given domain (e.g. www.example.com), blank for no restriction.",
			searchIntent: "Intent recognition",
			searchIntentHint: "Zhipu basic retrieval only; off skips intent recognition and searches directly.",
			searchIntentOn: "On",
			searchIntentOff: "Off",
			searchPrompt: "Search prompt",
			searchPromptHint: "Zhipu chat mode only; customizes how search results are fused, blank for the official default.",
			invalidNumber: "Enter a positive integer, or leave blank to use the default.",
			invalidCount: "Enter an integer from 1 to 50, or leave blank to use the default.",
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
		/**
		* An enumerated-choice control: a radio group laid out with the official
		* model-selection row's exact rules (grid row, hover wash, brand accent).
		* The staged value is one of the options' values; nothing is committed
		* until the card saves.
		* @param props - the field's copy, its options, and the staged value.
		* @returns the labelled radio group.
		*/
		function ChoiceField(props) {
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: "dwsd-field",
				children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						className: "dwsd-head",
						children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
							className: "dwsd-label",
							children: props.label
						})
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						className: "dwsd-choices",
						role: "radiogroup",
						"aria-label": props.label,
						children: props.options.map((option) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", {
							className: "dwsd-choice",
							children: [
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
									type: "radio",
									name: props.id,
									value: option.value,
									checked: props.value === option.value,
									disabled: props.disabled,
									onChange: () => {
										props.onEdit(option.value);
									}
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
									className: "dwsd-choiceLabel",
									children: option.label
								})
							]
						}, option.value))
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
						className: "dwsd-hint",
						children: props.hint
					})
				]
			});
		}
		/**
		* A boolean control shaped like the official toggle switch: a switch button
		* on the field's head row, hint underneath, staged through `onEdit`.
		* @param props - the field's copy and its staged boolean.
		* @returns the labelled switch.
		*/
		function SwitchField(props) {
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: "dwsd-field",
				children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: "dwsd-switchRow",
						children: [
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
								className: "dwsd-label",
								children: props.label
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
								type: "button",
								role: "switch",
								"aria-checked": props.checked,
								className: props.checked ? "dwsd-switch dwsd-switchOn" : "dwsd-switch",
								disabled: props.disabled,
								onClick: () => {
									props.onEdit(!props.checked);
								},
								children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
									className: "dwsd-thumb"
								})
							})
						]
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
				mode: data.mode ?? "responses",
				baseURL: data.baseURL ?? "",
				apiKeyEnv: data.apiKeyEnv ?? "",
				model: data.model ?? "",
				maxOutputTokens: data.maxOutputTokens != null ? String(data.maxOutputTokens) : "",
				searchEngine: data.searchEngine ?? "search_std",
				count: data.count != null ? String(data.count) : "",
				searchRecencyFilter: data.searchRecencyFilter ?? "noLimit",
				contentSize: data.contentSize ?? "medium",
				searchDomainFilter: data.searchDomainFilter ?? "",
				searchIntent: !!data.searchIntent,
				searchPrompt: data.searchPrompt ?? "",
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
		* differs from what the Host holds. Save POSTs the draft (an empty numeric
		* field means "keep the default"; a blank key field writes nothing), then
		* re-reads the authoritative config and — like the official cards —
		* collapses the card. A rejected save keeps the card open with the error
		* in the footer, exactly where the official card reports save failures.
		*
		* Protocol-specific fields render conditionally: Zhipu search options only
		* in the `zhipu-*` modes, the model/max-tokens pair only where a model
		* turn exists, and the chat prompt only in `zhipu-chat-search`.
		*
		* @param props - the slot kit; `t` resolves this card's locale namespace.
		* @returns the card.
		*/
		/** Draft keys compared against the saved snapshot to flag "unsaved". */
		const DRAFT_KEYS = ["mode", "baseURL", "apiKeyEnv", "model", "maxOutputTokens", "searchEngine", "count", "searchRecencyFilter", "contentSize", "searchDomainFilter", "searchIntent", "searchPrompt"];
		/** The draft shape behind the staged form. */
		function emptyDraft() {
			return {
				mode: "responses",
				baseURL: "",
				apiKeyEnv: "",
				model: "",
				maxOutputTokens: "",
				searchEngine: "search_std",
				count: "",
				searchRecencyFilter: "noLimit",
				contentSize: "medium",
				searchDomainFilter: "",
				searchIntent: false,
				searchPrompt: ""
			};
		}
		function ConfigCard(props) {
			const { t } = props;
			const [loaded, setLoaded] = (0, react.useState)(false);
			const [loadFailed, setLoadFailed] = (0, react.useState)(false);
			const [saved, setSaved] = (0, react.useState)({ ...emptyDraft(), keyConfigured: false });
			const [draft, setDraft] = (0, react.useState)(emptyDraft());
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
					setDraft((({ keyConfigured, ...rest }) => rest)(snapshot));
					setLoaded(true);
					setLoadFailed(false);
				}).catch(() => {
					if (alive) setLoadFailed(true);
				});
				return () => {
					alive = false;
				};
			}, []);
			const dirty = DRAFT_KEYS.some((key) => draft[key] !== saved[key]) || apiKeyDraft !== "";
			const tokensText = draft.maxOutputTokens.trim();
			const tokensInvalid = tokensText !== "" && !(Number.isInteger(Number(tokensText)) && Number(tokensText) >= 1);
			const countText = draft.count.trim();
			const countInvalid = countText !== "" && !(Number.isInteger(Number(countText)) && Number(countText) >= 1 && Number(countText) <= 50);
			const isZhipu = draft.mode !== "responses";
			const isZhipuChat = draft.mode === "zhipu-chat-search";
			const discard = () => {
				setDraft((({ keyConfigured, ...rest }) => rest)(saved));
				setApiKeyDraft("");
				setFailed("");
			};
			const save = async () => {
				setSaving(true);
				setFailed("");
				try {
					const body = { ...draft };
					if (tokensText !== "") body.maxOutputTokens = Number(tokensText);
					if (countText !== "") body.count = Number(countText);
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
					setDraft((({ keyConfigured, ...rest }) => rest)(snapshot));
					setApiKeyDraft("");
					setOpen(false);
				} catch (e) {
					setFailed(String(e));
				} finally {
					setSaving(false);
				}
			};
			const blocked = !dirty || tokensInvalid || countInvalid || saving;
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
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)(ChoiceField, {
									id: "plugin-config-web-search-diy-mode",
									label: t("mode"),
									hint: t("modeHint"),
									value: draft.mode,
									options: [
										{ value: "responses", label: t("modeResponses") },
										{ value: "zhipu-web-search", label: t("modeZhipuWeb") },
										{ value: "zhipu-chat-search", label: t("modeZhipuChat") }
									],
									onEdit: (value) => {
										setDraft((current) => ({ ...current, mode: value }));
									}
								}, "mode"),
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
								draft.mode !== "responses" ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)(ChoiceField, {
									id: "plugin-config-web-search-diy-search-engine",
									label: t("searchEngine"),
									hint: t("searchEngineHint"),
									value: draft.searchEngine,
									options: [
										{ value: "search_std", label: t("engineStd") },
										{ value: "search_pro", label: t("enginePro") },
										{ value: "search_pro_sogou", label: t("engineSogou") },
										{ value: "search_pro_quark", label: t("engineQuark") }
									],
									onEdit: (value) => {
										setDraft((current) => ({ ...current, searchEngine: value }));
									}
								}, "searchEngine") : null,
								draft.mode !== "responses" ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)(ValueField, {
									id: "plugin-config-web-search-diy-count",
									label: t("count"),
									hint: t("countHint"),
									numeric: true,
									invalid: countInvalid,
									invalidLabel: t("invalidCount"),
									text: draft.count,
									onEdit: (text) => {
										setDraft((current) => ({ ...current, count: text }));
									}
								}, "count") : null,
								draft.mode !== "responses" ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)(ChoiceField, {
									id: "plugin-config-web-search-diy-recency",
									label: t("searchRecencyFilter"),
									hint: t("searchRecencyHint"),
									value: draft.searchRecencyFilter,
									options: [
										{ value: "noLimit", label: t("recencyNoLimit") },
										{ value: "oneDay", label: t("recencyOneDay") },
										{ value: "oneWeek", label: t("recencyOneWeek") },
										{ value: "oneMonth", label: t("recencyOneMonth") },
										{ value: "oneYear", label: t("recencyOneYear") }
									],
									onEdit: (value) => {
										setDraft((current) => ({ ...current, searchRecencyFilter: value }));
									}
								}, "searchRecencyFilter") : null,
								draft.mode !== "responses" ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)(ChoiceField, {
									id: "plugin-config-web-search-diy-content-size",
									label: t("contentSize"),
									hint: t("contentSizeHint"),
									value: draft.contentSize,
									options: [
										{ value: "medium", label: t("sizeMedium") },
										{ value: "high", label: t("sizeHigh") }
									],
									onEdit: (value) => {
										setDraft((current) => ({ ...current, contentSize: value }));
									}
								}, "contentSize") : null,
								draft.mode !== "responses" ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)(ValueField, {
									id: "plugin-config-web-search-diy-domain-filter",
									label: t("searchDomainFilter"),
									hint: t("searchDomainHint"),
									text: draft.searchDomainFilter,
									onEdit: (text) => {
										setDraft((current) => ({ ...current, searchDomainFilter: text }));
									}
								}, "searchDomainFilter") : null,
								draft.mode === "zhipu-web-search" ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)(SwitchField, {
									id: "plugin-config-web-search-diy-search-intent",
									label: t("searchIntent"),
									hint: t("searchIntentHint"),
									checked: draft.searchIntent,
									onEdit: (checked) => {
										setDraft((current) => ({ ...current, searchIntent: checked }));
									}
								}, "searchIntent") : null,
								draft.mode === "zhipu-chat-search" ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)(ValueField, {
									id: "plugin-config-web-search-diy-search-prompt",
									label: t("searchPrompt"),
									hint: t("searchPromptHint"),
									text: draft.searchPrompt,
									onEdit: (text) => {
										setDraft((current) => ({ ...current, searchPrompt: text }));
									}
								}, "searchPrompt") : null,
								draft.mode !== "zhipu-web-search" ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)(ValueField, {
									id: "plugin-config-web-search-diy-model",
									label: t("model"),
									hint: t("modelHint"),
									text: draft.model,
									onEdit: (text) => {
										setDraft((current) => ({ ...current, model: text }));
									}
								}, "model") : null,
								draft.mode !== "zhipu-web-search" ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)(ValueField, {
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
								}, "maxOutputTokens") : null,
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
