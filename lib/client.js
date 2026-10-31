window.__ModuleLoader__.load({
	id: "dsh-web-search-diy",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
		//#region \0rolldown/runtime.js
		var __create = Object.create;
		var __defProp = Object.defineProperty;
		var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
		var __getOwnPropNames = Object.getOwnPropertyNames;
		var __getProtoOf = Object.getPrototypeOf;
		var __hasOwnProp = Object.prototype.hasOwnProperty;
		var __copyProps = (to, from, except, desc) => {
			if (from && typeof from === "object" || typeof from === "function") for (var keys = __getOwnPropNames(from), i = 0, n = keys.length, key; i < n; i++) {
				key = keys[i];
				if (!__hasOwnProp.call(to, key) && key !== except) __defProp(to, key, {
					get: ((k) => from[k]).bind(null, key),
					enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable
				});
			}
			return to;
		};
		var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(isNodeMode || !mod || !mod.__esModule || !__hasOwnProp.call(mod, "default") ? __defProp(target, "default", {
			value: mod,
			enumerable: true
		}) : target, mod));
		//#endregion
		let react = require("react");
		react = __toESM(react, 1);
		let react_jsx_runtime = require("react/jsx-runtime");
		//#region src/client/consts.ts
		/**
		* Client-half constants: the loader id, the locale namespace and the two host
		* endpoints this card talks to.
		*/
		/** Stable plugin id, stamped into the loader handoff. */
		const ID = "dsh-web-search-diy";
		/** Locale namespace for this card's strings. */
		const NS = "dshWebSearchDiy";
		/** Config endpoint the host half serves. */
		const CONFIG_URL = "/api/web-search-diy/config";
		/** Endpoint for one dry-run search with the staged draft. */
		const TEST_URL = "/api/web-search-diy/test";
		//#endregion
		//#region src/client/field-meta.ts
		/**
		* Candidate tool types. Free input stays allowed: the host validates the string
		* and gateways ship their own tool names (e.g. `openrouter:web_search`).
		*/
		const SUGGESTED_TOOL_TYPES = [
			"web_search",
			"openrouter:web_search",
			"web_search_20250305",
			"web_search_20260209",
			"web_search_20260318"
		];
		/**
		* 自定义网关的搜索引擎取值：智谱、OpenRouter 与常见自建/第三方引擎放在一起，
		* 只作为候选；输入框仍接受任意值。智谱模板下留空时回落到 search_std（该接口必填）。
		*/
		const CUSTOM_SEARCH_ENGINES = [
			"search_std",
			"search_pro",
			"search_pro_sogou",
			"search_pro_quark",
			"auto",
			"native",
			"exa",
			"firecrawl",
			"parallel",
			"perplexity",
			"searxng",
			"google",
			"bing",
			"brave",
			"duckduckgo",
			"tavily"
		];
		/**
		* 自定义 Chat 的四个变体各自实际使用的搜索字段。保存时 Host 按并集校验，
		* 但 UI 只渲染当前变体相关的字段，避免在 OpenRouter 变体下误填智谱参数。
		*/
		const CHAT_VARIANT_FIELDS = {
			zhipu: [
				"searchEngine",
				"count",
				"searchRecencyFilter",
				"contentSize",
				"searchDomainFilter",
				"requireSearch",
				"searchPrompt",
				"reasoningEffort"
			],
			qwen: [
				"searchStrategy",
				"forcedSearch",
				"freshness",
				"assignedSiteList",
				"searchExtension",
				"promptIntervene"
			],
			openrouter: [
				"engine",
				"mode",
				"maxResults",
				"maxUses",
				"maxTotalResults",
				"searchContextSize",
				"maxCharacters",
				"userLocation",
				"allowedDomains",
				"excludedDomains",
				"xSearch"
			],
			"openai-search-model": []
		};
		/** 变体专属字段的并集；这些键只对声明它们的变体渲染。 */
		const CHAT_VARIANT_ONLY = new Set(Object.values(CHAT_VARIANT_FIELDS).flat());
		/** Fields folded into the advanced section. */
		const ADVANCED = /* @__PURE__ */ new Set([
			"toolType",
			"includeSources",
			"reasoningEffort",
			"thinking",
			"effort",
			"searchContextSize",
			"allowedDomains",
			"blockedDomains",
			"excludedDomains",
			"userLocation",
			"maxUses",
			"searchRecencyFilter",
			"contentSize",
			"searchDomainFilter",
			"requireSearch",
			"searchPrompt",
			"searchStrategy",
			"forcedSearch",
			"freshness",
			"assignedSiteList",
			"searchExtension",
			"promptIntervene",
			"engine",
			"mode",
			"maxResults",
			"maxTotalResults",
			"maxCharacters",
			"includeContent",
			"timeoutSeconds",
			"oriQuestion",
			"localization",
			"chatVariant",
			"digestEntries",
			"digestSnippetChars",
			"path",
			"queryField",
			"countField",
			"resultsPath",
			"urlField",
			"titleField",
			"snippetField",
			"dateField",
			"contentField",
			"externalWebAccess",
			"returnTokenBudget",
			"searchContentTypes",
			"imageMaxResults",
			"imageCaption",
			"responseInclusion",
			"xSearch"
		]);
		/** References seen on existing deployments that are not a vendor's default chain. */
		const EXTRA_CREDENTIAL_REFS = {
			deepseek: ["DEEPSEEK_API_SEARCH_KEY"],
			zhipu: ["ZAI_API_KEY"]
		};
		/** The default credential chain a catalog entry declares. */
		function chainOf(entry) {
			const chain = entry.defaults.apiKeyEnv;
			return Array.isArray(chain) ? chain.filter((ref) => typeof ref === "string" && ref.length > 0) : [];
		}
		/** Credential references for one vendor: catalog chains first, then deployment aliases. */
		function credentialRefsFor(catalog, vendor) {
			const refs = /* @__PURE__ */ new Set();
			for (const entry of catalog) {
				if (entry.vendor !== vendor || entry.support === "unsupported") continue;
				for (const ref of chainOf(entry)) refs.add(ref);
			}
			for (const ref of EXTRA_CREDENTIAL_REFS[vendor] ?? []) refs.add(ref);
			return [...refs];
		}
		/** Every reference the catalog declares plus aliases, for custom gateways. */
		function allCredentialRefs(catalog) {
			const refs = /* @__PURE__ */ new Set();
			for (const entry of catalog) for (const ref of chainOf(entry)) refs.add(ref);
			for (const extra of Object.values(EXTRA_CREDENTIAL_REFS)) for (const ref of extra) refs.add(ref);
			return [...refs];
		}
		//#endregion
		//#region src/client/draft.ts
		/**
		* Numeric fields must reach the host as JSON numbers; a blank entry stays blank so
		* the host sees the "clear this key" signal instead of storing 0.
		*/
		const wireValue = (spec, value) => spec?.kind === "positiveInt" && typeof value === "string" && /^\d+$/u.test(value.trim()) ? Number(value.trim()) : value;
		/** Normalize a stored bucket into staged values. */
		function toDraft(bucket) {
			const draft = {};
			if (typeof bucket !== "object" || bucket === null) return draft;
			for (const [key, value] of Object.entries(bucket)) draft[key] = typeof value === "boolean" ? value : String(value);
			return draft;
		}
		/**
		* Fill a draft from one template. Only keys this target actually declares are copied:
		* a template may carry another protocol's defaults (e.g. Zhipu's `contentSize` on a
		* search target), and staging those would make the host reject the whole save.
		*/
		function fillFromTemplate(template, fields) {
			const allowed = new Set(fields);
			const filled = {};
			if (template.chatVariant !== void 0 && allowed.has("chatVariant")) filled.chatVariant = template.chatVariant;
			if (template.toolType !== void 0 && allowed.has("toolType")) filled.toolType = template.toolType;
			for (const [key, raw] of Object.entries(template.defaults)) {
				if (!allowed.has(key)) continue;
				if (Array.isArray(raw)) {
					if (raw.length > 0) filled[key] = String(raw[0]);
				} else if (typeof raw === "boolean") filled[key] = raw;
				else if (raw !== void 0 && raw !== null) filled[key] = String(raw);
			}
			return filled;
		}
		function seedFromTemplate(next) {
			const template = next?.templates?.[0];
			if (next === void 0 || template === void 0) return {};
			return fillFromTemplate(template, next.fields);
		}
		/** Placeholder text for one field: its catalog default. */
		function defaultText(entry, key) {
			const value = entry?.defaults[key];
			if (Array.isArray(value)) return value.length > 0 ? String(value[0]) : "";
			if (typeof value === "boolean") return "";
			return value == null ? "" : String(value);
		}
		/** Current staged value; booleans fall back to the catalog default. */
		function stagedValue(draft, entry, key) {
			const value = draft[key];
			if (value !== void 0) return value;
			if (entry?.specs?.[key]?.kind === "boolean") return entry?.defaults[key] === true;
			return "";
		}
		//#endregion
		//#region src/client/labels.ts
		/** Protocol display order. */
		const PROTOCOLS = [
			"chat-completions",
			"responses",
			"anthropic-messages",
			"search"
		];
		/** Human label for a protocol. */
		function protocolLabel(t, protocol) {
			if (protocol === "chat-completions") return t("protocolChat");
			if (protocol === "responses") return t("protocolResponses");
			if (protocol === "anthropic-messages") return t("protocolAnthropic");
			return t("protocolSearch");
		}
		/** Human label for a vendor. */
		function vendorLabel(t, vendor) {
			const key = `vendor${vendor.slice(0, 1).toUpperCase()}${vendor.slice(1)}`;
			const label = t(key);
			return label === key ? vendor : label;
		}
		/** Support badge copy. */
		function supportLabel(t, support) {
			return t(support);
		}
		//#endregion
		//#region src/client/fields.tsx
		/**
		* Field controls: text, combo, enumerated choice, switch, one-shot picker and
		* the write-only credential input. Presentational only — state lives in the page.
		*/
		/** One settings field: label, control, hint. */
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
		/** A write-only credential control. */
		function SecretField(props) {
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: "dwsd-field",
				children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: "dwsd-head",
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("label", {
							className: "dwsd-label",
							htmlFor: props.id,
							children: props.label
						}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
							className: "dwsd-badges",
							children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
								className: props.configured ? "dwsd-badge" : "dwsd-badgeMuted",
								children: props.stateLabel
							})
						})]
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
		* A text field with an explicit dropdown: the button always lists every candidate
		* (datalist filters by the current text, which makes a prefilled field look like it
		* has one option), while the input still accepts free text.
		*/
		function ComboField(props) {
			const [open, setOpen] = react.useState(false);
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
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: "dwsd-combo",
						children: [
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
								id: props.id,
								className: props.invalid === true ? "dwsd-input dwsd-inputInvalid" : "dwsd-input",
								type: "text",
								...props.invalid === true ? { "aria-invalid": true } : {},
								value: props.text,
								placeholder: props.placeholder ?? "",
								spellCheck: false,
								autoComplete: "off",
								onChange: (event) => {
									const next = event.target.value;
									props.onEdit(next);
									/** 清空时展开候选，正常输入时收起，避免遮挡。 */
									setOpen(next === "");
								},
								onKeyDown: () => {
									setOpen(false);
								},
								onBlur: () => {
									setOpen(false);
								}
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
								type: "button",
								className: "dwsd-comboToggle",
								onMouseDown: (event) => {
									event.preventDefault();
								},
								"aria-label": props.label,
								"aria-expanded": open,
								onClick: () => {
									setOpen(!open);
								},
								children: "▾"
							}),
							open ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("ul", {
								className: "dwsd-comboList",
								children: props.options.map((option) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)("li", { children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
									type: "button",
									onMouseDown: (event) => {
										event.preventDefault();
									},
									onClick: () => {
										props.onEdit(option);
										setOpen(false);
									},
									children: option
								}) }, option))
							}) : null
						]
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
						className: props.invalid === true ? "dwsd-invalid" : "dwsd-hint",
						children: props.invalid === true ? props.invalidLabel : props.hint
					})
				]
			});
		}
		/** An enumerated-choice control. */
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
							className: option.disabled === true ? "dwsd-choice dwsd-choiceDisabled" : "dwsd-choice",
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
								id: `${props.id}-${option.value === "" ? "empty" : option.value}`,
								type: "radio",
								name: props.id,
								value: option.value,
								checked: props.value === option.value,
								disabled: props.disabled === true || option.disabled === true,
								onChange: () => {
									props.onEdit(option.value);
								}
							}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
								className: "dwsd-choiceLabel",
								children: option.label
							})]
						}, option.value))
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
						className: "dwsd-hint",
						children: props.hint
					})
				]
			});
		}
		/** A one-shot action picker: the selection applies and resets to the placeholder. */
		function SelectField(props) {
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
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("select", {
						id: props.id,
						className: "dwsd-input",
						value: props.value,
						onChange: (event) => {
							props.onChange(event.target.value);
						},
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("option", {
							value: "",
							disabled: true,
							children: props.placeholder
						}), props.options.map((option) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)("option", {
							value: option.value,
							children: option.label
						}, option.value))]
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
						className: "dwsd-hint",
						children: props.hint
					})
				]
			});
		}
		/** A boolean control shaped like the official toggle switch. */
		function SwitchField(props) {
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: "dwsd-field",
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
					className: "dwsd-switchRow",
					children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
						className: "dwsd-label",
						children: props.label
					}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
						type: "button",
						role: "switch",
						"aria-checked": props.checked,
						className: props.checked ? "dwsd-switch dwsd-switchOn" : "dwsd-switch",
						disabled: props.disabled,
						onClick: () => {
							props.onEdit(!props.checked);
						},
						children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { className: "dwsd-thumb" })
					})]
				}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
					className: "dwsd-hint",
					children: props.hint
				})]
			});
		}
		//#endregion
		//#region src/client/obs/range.ts
		/** 查询与导入共用的预设顺序。 */
		const RANGE_PRESETS = [
			"24h",
			"7d",
			"30d",
			"all"
		];
		/** 默认范围：近 24 小时。 */
		const DEFAULT_RANGE = { preset: "24h" };
		/** 把范围转成后端 `since` 参数：预设名或 ISO 时间戳。 */
		function sinceOf(range) {
			return range.preset === "custom" ? range.since : range.preset;
		}
		/** 把范围转成后端 `until` 参数；预设与「至今」返回 undefined。 */
		function untilOf(range) {
			return range.preset === "custom" ? range.until : void 0;
		}
		/** 本地时区的日期键 `YYYY-MM-DD`；ISO 字符串无效时原样返回。 */
		function dayKeyOf(value) {
			const date = value instanceof Date ? value : new Date(value);
			if (Number.isNaN(date.getTime())) return String(value);
			const pad = (part) => String(part).padStart(2, "0");
			return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
		}
		/** 某个本地日期的零点。 */
		function startOfDay(date) {
			return new Date(date.getFullYear(), date.getMonth(), date.getDate());
		}
		/** 某个本地日期的最后一毫秒，保证结束日整天被包含。 */
		function endOfDay(date) {
			return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59, 999);
		}
		/** 起止日期对应的自定义范围；结束日按整天计入。 */
		function rangeOfDays(from, to) {
			return {
				preset: "custom",
				since: startOfDay(from).toISOString(),
				until: endOfDay(to).toISOString()
			};
		}
		/** 触发器文案：预设标签、「自 YYYY-MM-DD 起」，或「起 ~ 止」。 */
		function rangeLabelOf(t, range) {
			if (range.preset !== "custom") return t(`obsRange_${range.preset}`);
			const since = dayKeyOf(range.since);
			return range.until === void 0 ? t("obsRangeSince").replace("{date}", since) : `${since} ~ ${dayKeyOf(range.until)}`;
		}
		//#endregion
		//#region src/client/obs/api.ts
		/** Host 观测端点前缀。 */
		const OBS_BASE = "/api/web-search-diy/observability";
		/** 把筛选状态转成查询串。 */
		function queryOf$1(filters, extra = {}) {
			const params = new URLSearchParams();
			params.set("since", sinceOf(filters.range));
			const until = untilOf(filters.range);
			if (until !== void 0) params.set("until", until);
			if (filters.target.length > 0) params.set("target", filters.target);
			if (filters.includeTests) params.set("includeTests", "true");
			for (const [key, value] of Object.entries(extra)) if (value !== void 0 && value.length > 0) params.set(key, value);
			return params.toString();
		}
		/** 解析 JSON 响应；非 2xx 抛出带状态码的错误。 */
		async function readJson(response) {
			if (!response.ok) {
				let detail = `HTTP ${response.status}`;
				try {
					const body = await response.json();
					if (typeof body.error === "string" && body.error.length > 0) detail = body.error;
				} catch {}
				throw new Error(detail);
			}
			return await response.json();
		}
		/** 拉取汇总。 */
		async function fetchSummary(filters, signal) {
			return await readJson(await fetch(`${OBS_BASE}/summary?${queryOf$1(filters)}`, {
				headers: { accept: "application/json" },
				...signal !== void 0 ? { signal } : {}
			}));
		}
		/** 拉取一页记录；页码从 1 开始。 */
		async function fetchRecords(filters, options = {}, signal) {
			const extra = {
				limit: String(options.limit ?? 50),
				page: options.page === void 0 ? void 0 : String(options.page),
				status: options.status === void 0 || options.status === "all" ? void 0 : options.status,
				query: options.query
			};
			return await readJson(await fetch(`${OBS_BASE}/records?${queryOf$1(filters, extra)}`, {
				headers: { accept: "application/json" },
				...signal !== void 0 ? { signal } : {}
			}));
		}
		/** 导出链接：直接交给浏览器下载当前筛选范围。 */
		function exportUrl(format, filters) {
			return `${OBS_BASE}/export?${queryOf$1(filters, { format })}`;
		}
		async function importHistory(range) {
			const until = untilOf(range);
			return await readJson(await fetch(`${OBS_BASE}/import`, {
				method: "POST",
				headers: { "content-type": "application/json" },
				body: JSON.stringify({
					since: sinceOf(range),
					...until !== void 0 ? { until } : {}
				})
			}));
		}
		/** 清空全部观测记录；返回删除条数。 */
		async function clearObservations() {
			return (await readJson(await fetch(`${OBS_BASE}/records`, {
				method: "DELETE",
				headers: { "content-type": "application/json" },
				body: JSON.stringify({ confirm: "DELETE" })
			}))).deleted ?? 0;
		}
		//#endregion
		//#region src/client/obs/calendar.tsx
		/**
		* 时间范围选择器：预设 + 起止日期月历。
		*
		* 查询范围与导入范围共用本组件，但各自持有独立的值。第一次点日期选起点，第二次点
		* 日期选终点并收起；也可用「至今」只保留起点。月份与星期交给浏览器区域设置格式化，
		* 不新增语言键。
		*
		* @module dsh-web-search-diy/client/obs/calendar
		*/
		/** 一周从周一开始，固定 6 行以保持面板高度稳定。 */
		const WEEK_DAYS = 7;
		const CELL_COUNT = 42;
		/** 星期缩写，按浏览器区域设置生成；2024-01-01 是周一。 */
		const WEEKDAY_LABELS = Array.from({ length: WEEK_DAYS }, (_, index) => new Intl.DateTimeFormat(void 0, { weekday: "narrow" }).format(new Date(2024, 0, 1 + index)));
		/** 月份标题。 */
		function monthTitleOf(date) {
			return new Intl.DateTimeFormat(void 0, {
				year: "numeric",
				month: "long"
			}).format(date);
		}
		/** 日期的可访问名称。 */
		function dayTitleOf(date) {
			return new Intl.DateTimeFormat(void 0, { dateStyle: "long" }).format(date);
		}
		/** 某月的第一天。 */
		function firstOfMonth(date) {
			return new Date(date.getFullYear(), date.getMonth(), 1);
		}
		/** 有效日期或当前时间；自定义值损坏时不至于把日历渲染成 NaN。 */
		function safeDate(value) {
			const date = value instanceof Date ? value : new Date(value);
			return Number.isNaN(date.getTime()) ? /* @__PURE__ */ new Date() : date;
		}
		/** 6×7 的日期格，包含相邻月份的日期。 */
		function cellsOf(cursor) {
			const first = firstOfMonth(cursor);
			const offset = (first.getDay() + 6) % WEEK_DAYS;
			return Array.from({ length: CELL_COUNT }, (_, index) => {
				const date = new Date(first.getFullYear(), first.getMonth(), 1 - offset + index);
				return {
					date,
					inMonth: date.getMonth() === first.getMonth()
				};
			});
		}
		/** 时间范围下拉：预设快捷项 + 月历选起止日。 */
		function RangePicker({ label, value, onChange, t, presets = RANGE_PRESETS, className }) {
			const [open, setOpen] = react.useState(false);
			const [cursor, setCursor] = react.useState(() => firstOfMonth(safeDate(value.preset === "custom" ? value.since : /* @__PURE__ */ new Date())));
			/** 已点起点、等待终点的本地零点 ISO。 */
			const [pendingStart, setPendingStart] = react.useState(null);
			const rootRef = react.useRef(null);
			/** 当前高亮区间；等待终点时只高亮起点。 */
			const boundsOf = () => {
				if (pendingStart !== null) {
					const at = startOfDay(safeDate(pendingStart)).getTime();
					return {
						start: at,
						end: at
					};
				}
				if (value.preset !== "custom") return {
					start: null,
					end: null
				};
				const start = startOfDay(safeDate(value.since)).getTime();
				return {
					start,
					end: value.until === void 0 ? start : startOfDay(safeDate(value.until)).getTime()
				};
			};
			const bounds = boundsOf();
			/** 点击外部或按 Esc 关闭；测试环境没有 document 监听器时静默跳过。 */
			react.useEffect(() => {
				if (!open) return;
				if (typeof document === "undefined" || typeof document.addEventListener !== "function") return;
				const onPointerDown = (event) => {
					const root = rootRef.current;
					if (root !== null && event.target instanceof Node && !root.contains(event.target)) {
						setPendingStart(null);
						setOpen(false);
					}
				};
				const onKeyDown = (event) => {
					if (event.key === "Escape") {
						setPendingStart(null);
						setOpen(false);
					}
				};
				document.addEventListener("pointerdown", onPointerDown);
				document.addEventListener("keydown", onKeyDown);
				return () => {
					document.removeEventListener("pointerdown", onPointerDown);
					document.removeEventListener("keydown", onKeyDown);
				};
			}, [open]);
			/** 打开时清空半选状态，并把日历定位到当前选中值所在月份。 */
			const toggle = () => {
				if (!open) {
					setPendingStart(null);
					setCursor(firstOfMonth(safeDate(value.preset === "custom" ? value.since : /* @__PURE__ */ new Date())));
				} else setPendingStart(null);
				setOpen(!open);
			};
			const choosePreset = (preset) => {
				setPendingStart(null);
				onChange({ preset });
				setOpen(false);
			};
			/** 第一次点起点，第二次点终点；反向选择时自动交换。 */
			const pickDay = (date) => {
				if (pendingStart === null) {
					setPendingStart(startOfDay(date).toISOString());
					return;
				}
				const first = Date.parse(pendingStart);
				const second = startOfDay(date).getTime();
				onChange(rangeOfDays(new Date(Math.min(first, second)), new Date(Math.max(first, second))));
				setPendingStart(null);
				setOpen(false);
			};
			/** 单日区间：今天 00:00 到 23:59:59.999。 */
			const chooseToday = () => {
				onChange(rangeOfDays(/* @__PURE__ */ new Date(), /* @__PURE__ */ new Date()));
				setPendingStart(null);
				setOpen(false);
			};
			/** 只保留起点：从已选起点（或当前选中范围起点）到现在。 */
			const chooseUntilNow = () => {
				onChange({
					preset: "custom",
					since: pendingStart ?? (value.preset === "custom" ? value.since : (/* @__PURE__ */ new Date()).toISOString())
				});
				setPendingStart(null);
				setOpen(false);
			};
			const shiftMonth = (delta) => {
				setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + delta, 1));
			};
			const triggerText = open && pendingStart !== null ? t("obsRangePickEnd") : rangeLabelOf(t, value);
			const canChooseUntilNow = pendingStart !== null || value.preset === "custom";
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				ref: rootRef,
				className: [
					"dwsd-obs-filter",
					"dwsd-obs-range",
					className ?? ""
				].filter((part) => part.length > 0).join(" "),
				children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
						className: "dwsd-obs-filterLabel",
						children: label
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("button", {
						type: "button",
						className: "dwsd-obs-rangeTrigger",
						"aria-haspopup": "dialog",
						"aria-expanded": open,
						"aria-label": `${label} ${triggerText}`,
						onClick: toggle,
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
							className: "dwsd-obs-rangeValue",
							children: triggerText
						}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
							className: "dwsd-obs-rangeCaret",
							"aria-hidden": "true",
							children: "▾"
						})]
					}),
					open ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: "dwsd-obs-cal",
						role: "dialog",
						"aria-label": label,
						children: [
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
								className: "dwsd-obs-calPresets",
								role: "group",
								"aria-label": label,
								children: presets.map((preset) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
									type: "button",
									className: `dwsd-obs-calPreset${value.preset === preset && pendingStart === null ? " dwsd-obs-calPresetOn" : ""}`,
									"aria-pressed": value.preset === preset && pendingStart === null,
									onClick: () => {
										choosePreset(preset);
									},
									children: t(`obsRange_${preset}`)
								}, preset))
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
								className: "dwsd-obs-calHead",
								children: [
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
										type: "button",
										className: "dwsd-obs-calNav",
										"aria-label": t("obsCalendarPrev"),
										onClick: () => {
											shiftMonth(-1);
										},
										children: "‹"
									}),
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
										className: "dwsd-obs-calTitle",
										children: monthTitleOf(cursor)
									}),
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
										type: "button",
										className: "dwsd-obs-calNav",
										"aria-label": t("obsCalendarNext"),
										onClick: () => {
											shiftMonth(1);
										},
										children: "›"
									})
								]
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
								className: "dwsd-obs-calWeek",
								"aria-hidden": "true",
								children: WEEKDAY_LABELS.map((weekday) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: weekday }, weekday))
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
								className: "dwsd-obs-calGrid",
								role: "group",
								"aria-label": label,
								children: cellsOf(cursor).map(({ date, inMonth }) => {
									const day = startOfDay(date).getTime();
									const selected = bounds.start !== null && day >= bounds.start && day <= (bounds.end ?? bounds.start);
									const edge = day === bounds.start || day === (bounds.end ?? bounds.start);
									return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
										type: "button",
										className: [
											"dwsd-obs-calDay",
											inMonth ? "" : "dwsd-obs-calDayOut",
											selected && !edge ? "dwsd-obs-calDayInRange" : "",
											edge ? "dwsd-obs-calDayOn" : ""
										].filter((part) => part.length > 0).join(" "),
										"aria-pressed": selected,
										"aria-label": dayTitleOf(date),
										onClick: () => {
											pickDay(date);
										},
										children: date.getDate()
									}, dayKeyOf(date));
								})
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
								className: "dwsd-obs-calFoot",
								children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
									className: "dwsd-obs-calActions",
									children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
										type: "button",
										className: "dwsd-obs-link",
										onClick: chooseToday,
										children: t("obsRange_today")
									}), canChooseUntilNow ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
										type: "button",
										className: "dwsd-obs-link",
										onClick: chooseUntilNow,
										children: t("obsRangeUntilNow")
									}) : null]
								}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
									className: "dwsd-obs-calHint",
									children: pendingStart !== null ? `${t("obsRangePickEnd")} · ${dayKeyOf(pendingStart)}` : rangeLabelOf(t, value)
								})]
							})
						]
					}) : null
				]
			});
		}
		//#endregion
		//#region src/client/obs/format.ts
		/**
		* 观测页的数字与日期格式。
		*
		* 不使用硬编码语言：数字跟随浏览器区域设置，日期用固定字段（月-日 时:分:秒），
		* 避免在图表与表格里出现未翻译的英文单词。
		*
		* @module dsh-web-search-diy/client/obs/format
		*/
		/** 0–1 的比例转百分比；null 显示破折号。 */
		function percentOf(ratio) {
			if (ratio === null || !Number.isFinite(ratio)) return "—";
			return `${Math.round(ratio * 100)}%`;
		}
		/** 毫秒显示：一公里以内保留整数毫秒，超过用一位小数秒。 */
		function durationOf(ms) {
			if (!Number.isFinite(ms) || ms < 0) return "—";
			if (ms < 1e3) return `${Math.round(ms)}ms`;
			return `${(ms / 1e3).toFixed(1)}s`;
		}
		/** 计数与平均值的紧凑显示。 */
		function numberOf(value, fractionDigits = 0) {
			if (!Number.isFinite(value)) return "—";
			return new Intl.NumberFormat(void 0, {
				maximumFractionDigits: fractionDigits,
				minimumFractionDigits: fractionDigits
			}).format(value);
		}
		/** 紧凑日期：`10-31 20:41:13`。 */
		function timeOf(iso) {
			const date = new Date(iso);
			if (Number.isNaN(date.getTime())) return iso;
			const pad = (value) => String(value).padStart(2, "0");
			return `${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
		}
		/** target 的展示名；历史导入记录没有 provider，显示为「历史记录」。 */
		function targetLabelOf(t, target) {
			return target === "historical" ? t("obsHistoricalTarget") : target;
		}
		/** 搜索词的表格显示：折叠空白并按字符截断。 */
		function queryOf(query, max = 48) {
			const collapsed = query.replace(/\s+/gu, " ").trim();
			const characters = [...collapsed];
			return characters.length <= max ? collapsed : `${characters.slice(0, max).join("")}…`;
		}
		//#endregion
		//#region src/client/obs/charts.tsx
		/**
		* 趋势图：成功率实线与 P95 虚线，共用时间轴；空桶断线而不是画成 0。
		*
		* 纯 SVG，无第三方图表依赖；hover 用 HTML tooltip，图表本身带 `role="img"` 与
		* 概括性 `aria-label`。
		*
		* @module dsh-web-search-diy/client/obs/charts
		*/
		/** 画布尺寸；用 viewBox 自适应容器宽度。 */
		const WIDTH = 640;
		const HEIGHT = 160;
		const PAD_X = 30;
		const PAD_Y = 16;
		/** 一段连续点的折线路径；null 处断开。 */
		function linePath(values, x, y) {
			let path = "";
			let pen = false;
			for (let index = 0; index < values.length; index += 1) {
				const value = values[index];
				if (value === null) {
					pen = false;
					continue;
				}
				path += `${pen ? "L" : "M"}${x(index).toFixed(1)},${y(value).toFixed(1)} `;
				pen = true;
			}
			return path.trim();
		}
		/** 成功率的面积填充；每段连续点闭合到底边。 */
		function areaPath(values, x, y) {
			const base = 144 .toFixed(1);
			let path = "";
			let start = null;
			for (let index = 0; index < values.length; index += 1) {
				const value = values[index];
				if (value !== null && start === null) {
					start = index;
					path += `M${x(index).toFixed(1)},${base} `;
				}
				if (value === null && start !== null) {
					const end = index - 1;
					path += `L${x(end).toFixed(1)},${base} Z `;
					start = null;
					continue;
				}
				if (value !== null && start !== null) path += `L${x(index).toFixed(1)},${y(value).toFixed(1)} `;
			}
			if (start !== null) path += `L${x(values.length - 1).toFixed(1)},${base} Z `;
			return path.trim();
		}
		/** 时间轴的短标签：`MM-DD HH:mm` 的时分部分。 */
		function tickLabel(iso) {
			return timeOf(iso).slice(6);
		}
		/** The trend chart. */
		function TrendChart({ t, buckets }) {
			const [active, setActive] = react.useState(null);
			if (!buckets.some((bucket) => bucket.count > 0)) return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: "dwsd-obs-chart dwsd-obs-chartEmpty",
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("svg", {
					viewBox: `0 0 ${WIDTH} ${HEIGHT}`,
					role: "img",
					"aria-label": t("obsNoData"),
					children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("line", {
						x1: PAD_X,
						y1: 144,
						x2: 610,
						y2: 144,
						className: "dwsd-obs-chartAxis"
					})
				}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
					className: "dwsd-obs-hint",
					children: t("obsNoData")
				})]
			});
			const step = buckets.length > 1 ? 580 / (buckets.length - 1) : 0;
			const xAt = (index) => PAD_X + index * step;
			const maxP95 = Math.max(1e3, ...buckets.map((bucket) => bucket.p95 ?? 0));
			const yOfRatio = (ratio) => 144 - ratio * 128;
			const yOfP95 = (ms) => 144 - ms / maxP95 * 128;
			const successValues = buckets.map((bucket) => bucket.count > 0 ? bucket.successRate : null);
			const p95Values = buckets.map((bucket) => bucket.count > 0 ? bucket.p95 : null);
			const rates = successValues.filter((value) => value !== null);
			const minRate = rates.length > 0 ? Math.min(...rates) : 0;
			const maxRate = rates.length > 0 ? Math.max(...rates) : 0;
			const ariaLabel = t("obsTrendAria").replace("{min}", percentOf(minRate)).replace("{max}", percentOf(maxRate)).replace("{buckets}", String(buckets.length));
			const activeBucket = active !== null ? buckets[active] : void 0;
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("section", {
				className: "dwsd-obs-section",
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
					className: "dwsd-obs-sectionHead",
					children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("h3", {
						className: "dwsd-obs-sectionTitle",
						children: t("obsTrend")
					}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
						className: "dwsd-obs-legend",
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
							className: "dwsd-obs-legendItem",
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
								className: "dwsd-obs-legendLine dwsd-obs-legendSuccess",
								"aria-hidden": "true"
							}), t("obsTrendSuccess")]
						}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
							className: "dwsd-obs-legendItem",
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
								className: "dwsd-obs-legendLine dwsd-obs-legendP95",
								"aria-hidden": "true"
							}), t("obsTrendP95")]
						})]
					})]
				}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
					className: "dwsd-obs-chart",
					children: [
						/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("svg", {
							viewBox: `0 0 ${WIDTH} ${HEIGHT}`,
							role: "img",
							"aria-label": ariaLabel,
							children: [
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("line", {
									x1: PAD_X,
									y1: PAD_Y,
									x2: 610,
									y2: PAD_Y,
									className: "dwsd-obs-chartGrid"
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("line", {
									x1: PAD_X,
									y1: 80,
									x2: 610,
									y2: 80,
									className: "dwsd-obs-chartGrid"
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("line", {
									x1: PAD_X,
									y1: 144,
									x2: 610,
									y2: 144,
									className: "dwsd-obs-chartAxis"
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("path", {
									d: areaPath(successValues, xAt, yOfRatio),
									className: "dwsd-obs-chartArea"
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("path", {
									d: linePath(successValues, xAt, yOfRatio),
									className: "dwsd-obs-chartSuccess"
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("path", {
									d: linePath(p95Values, xAt, yOfP95),
									className: "dwsd-obs-chartP95"
								}),
								buckets.map((bucket, index) => bucket.count > 0 && bucket.successRate !== null ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("circle", {
									cx: xAt(index),
									cy: yOfRatio(bucket.successRate),
									r: 2.5,
									className: "dwsd-obs-chartDot"
								}, `dot-${bucket.at}`) : null),
								buckets.map((bucket, index) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)("rect", {
									x: Math.max(0, xAt(index) - step / 2),
									y: 0,
									width: Math.max(step, 1),
									height: HEIGHT,
									className: "dwsd-obs-chartHit",
									onMouseEnter: () => {
										setActive(index);
									},
									onMouseLeave: () => {
										setActive(null);
									}
								}, bucket.at))
							]
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							className: "dwsd-obs-chartTicks",
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: tickLabel(buckets[0].at) }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: tickLabel(buckets[buckets.length - 1].at) })]
						}),
						activeBucket !== void 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							className: "dwsd-obs-chartTip",
							role: "status",
							children: [
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: timeOf(activeBucket.at) }),
								/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", { children: [
									t("obsMetricSuccess"),
									": ",
									percentOf(activeBucket.successRate)
								] }),
								/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", { children: [
									t("obsTrendP95"),
									": ",
									activeBucket.p95 === null ? "—" : durationOf(activeBucket.p95)
								] }),
								/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", { children: [
									t("obsMetricCount"),
									": ",
									activeBucket.count
								] })
							]
						}) : null
					]
				})]
			});
		}
		//#endregion
		//#region src/client/obs/shared.tsx
		/**
		* 观测页共用的小组件：错误横幅、状态标记与骨架屏。
		*
		* @module dsh-web-search-diy/client/obs/shared
		*/
		/** One status cell: a dot plus text, so color is never the only signal. */
		function StatusCell({ t, ok }) {
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
				className: ok ? "dwsd-obs-status" : "dwsd-obs-status dwsd-obs-statusFail",
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
					className: ok ? "dwsd-obs-dot dwsd-obs-dotOk" : "dwsd-obs-dot dwsd-obs-dotFail",
					"aria-hidden": "true"
				}), t(ok ? "obsStatusOk" : "obsStatusFail")]
			});
		}
		/** An endpoint failure banner that keeps already-loaded data on screen. */
		function ErrorBanner({ t, message, onRetry }) {
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: "dwsd-obs-banner",
				role: "alert",
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
					className: "dwsd-obs-bannerText",
					children: [
						t("obsError"),
						": ",
						message
					]
				}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
					type: "button",
					className: "dwsd-obs-btn",
					onClick: onRetry,
					children: t("obsRetry")
				})]
			});
		}
		/** A skeleton for the metric cards; no full-page spinner. */
		function MetricSkeleton() {
			return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
				className: "dwsd-obs-cards",
				"aria-hidden": "true",
				children: [
					0,
					1,
					2,
					3,
					4
				].map((index) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
					className: "dwsd-obs-card",
					children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { className: "dwsd-obs-skeleton dwsd-obs-skeletonLabel" }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { className: "dwsd-obs-skeleton dwsd-obs-skeletonValue" })]
				}, index))
			});
		}
		/** One table skeleton row set. */
		function TableSkeleton({ rows = 5 }) {
			return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
				className: "dwsd-obs-skeletonRows",
				"aria-hidden": "true",
				children: Array.from({ length: rows }, (_unused, index) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { className: "dwsd-obs-skeleton dwsd-obs-skeletonRow" }, index))
			});
		}
		/** Shared empty state with an optional action. */
		function EmptyState({ t, title, hint, actionLabel, onAction }) {
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: "dwsd-obs-empty",
				children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
						className: "dwsd-obs-emptyIcon",
						"aria-hidden": "true",
						children: "⌕"
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
						className: "dwsd-obs-emptyTitle",
						children: title
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
						className: "dwsd-obs-hint",
						children: hint
					}),
					actionLabel !== void 0 && onAction !== void 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
						type: "button",
						className: "dwsd-obs-btn",
						onClick: onAction,
						children: actionLabel
					}) : null
				]
			});
		}
		/** A metric card: label above, tabular number below. */
		function MetricCard({ label, value }) {
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: "dwsd-obs-card",
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
					className: "dwsd-obs-cardLabel",
					children: label
				}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
					className: "dwsd-obs-cardValue",
					children: value
				})]
			});
		}
		//#endregion
		//#region src/client/obs/overview.tsx
		/** The target ranking table. */
		function TargetRanking({ t, summary, onOpenTarget }) {
			if (summary.byTarget.length === 0) return null;
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("section", {
				className: "dwsd-obs-section",
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("h3", {
					className: "dwsd-obs-sectionTitle",
					children: t("obsTargetRanking")
				}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
					className: "dwsd-obs-tableWrap",
					children: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("table", {
						className: "dwsd-obs-table",
						children: [
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("caption", {
								className: "dwsd-obs-caption",
								children: t("obsTargetRanking")
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("thead", { children: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("tr", { children: [
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("th", {
									scope: "col",
									children: t("obsTableTarget")
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("th", {
									scope: "col",
									className: "dwsd-obs-num",
									children: t("obsMetricCount")
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("th", {
									scope: "col",
									className: "dwsd-obs-num",
									children: t("obsMetricSuccess")
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("th", {
									scope: "col",
									className: "dwsd-obs-num",
									children: t("obsMetricP95")
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("th", {
									scope: "col",
									className: "dwsd-obs-num",
									children: t("obsMetricSources")
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("th", {
									scope: "col",
									className: "dwsd-obs-num dwsd-obs-colSummary",
									children: t("obsMetricSummary")
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("th", {
									scope: "col",
									className: "dwsd-obs-num",
									children: t("obsTableErrors")
								})
							] }) }),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("tbody", { children: summary.byTarget.map((row) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("tr", {
								className: "dwsd-obs-clickable",
								tabIndex: 0,
								onClick: () => {
									onOpenTarget(row.target);
								},
								onKeyDown: (event) => {
									if (event.key === "Enter" || event.key === " ") {
										event.preventDefault();
										onOpenTarget(row.target);
									}
								},
								children: [
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)("td", {
										className: "dwsd-obs-targetCell",
										children: targetLabelOf(t, row.target)
									}),
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)("td", {
										className: "dwsd-obs-num",
										children: numberOf(row.count)
									}),
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)("td", {
										className: "dwsd-obs-num",
										children: percentOf(row.successRate)
									}),
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)("td", {
										className: "dwsd-obs-num",
										children: durationOf(row.p95)
									}),
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)("td", {
										className: "dwsd-obs-num",
										children: numberOf(row.avgSources, 1)
									}),
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)("td", {
										className: "dwsd-obs-num dwsd-obs-colSummary",
										children: percentOf(row.summaryCoverage)
									}),
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)("td", {
										className: "dwsd-obs-num",
										children: row.errorCount > 0 ? numberOf(row.errorCount) : "—"
									})
								]
							}, row.target)) })
						]
					})
				})]
			});
		}
		/** The overview view. */
		function Overview(props) {
			const { t, summary } = props;
			if (props.loading && summary === null) return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: "dwsd-obs-view",
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)(MetricSkeleton, {}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)(TableSkeleton, { rows: 4 })]
			});
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: "dwsd-obs-view",
				children: [props.error !== null ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)(ErrorBanner, {
					t,
					message: props.error,
					onRetry: props.onRefresh
				}) : null, summary === null ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)(EmptyState, {
					t,
					title: t("obsEmpty"),
					hint: t("obsEmptyHint")
				}) : /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
					className: "dwsd-obs-content",
					children: [
						/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							className: "dwsd-obs-cards",
							children: [
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)(MetricCard, {
									label: t("obsMetricCount"),
									value: numberOf(summary.totals.count)
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)(MetricCard, {
									label: t("obsMetricSuccess"),
									value: percentOf(summary.totals.successRate)
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)(MetricCard, {
									label: t("obsMetricP95"),
									value: durationOf(summary.totals.p95)
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)(MetricCard, {
									label: t("obsMetricSources"),
									value: numberOf(summary.totals.avgSources, 1)
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)(MetricCard, {
									label: t("obsMetricSummary"),
									value: percentOf(summary.totals.summaryCoverage)
								})
							]
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)(TrendChart, {
							t,
							buckets: summary.byBucket
						}),
						summary.totals.count === 0 ? props.filtered ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)(EmptyState, {
							t,
							title: t("obsEmptyFiltered"),
							hint: t("obsEmptyFilteredHint"),
							actionLabel: t("obsClearFilters"),
							onAction: props.onClearFilters
						}) : /* @__PURE__ */ (0, react_jsx_runtime.jsx)(EmptyState, {
							t,
							title: t("obsEmpty"),
							hint: t("obsEmptyHint")
						}) : /* @__PURE__ */ (0, react_jsx_runtime.jsx)(TargetRanking, {
							t,
							summary,
							onOpenTarget: props.onOpenTarget
						})
					]
				})]
			});
		}
		//#endregion
		//#region src/client/obs/records.tsx
		/**
		* 记录页：状态/搜索词筛选、时间倒序表格、展开详情与页码分页。
		*
		* @module dsh-web-search-diy/client/obs/records
		*/
		/** 每页条数选项；默认 10 条。 */
		const PAGE_SIZES = [
			10,
			20,
			50,
			100
		];
		const DEFAULT_PAGE_SIZE = 10;
		/** 页码列表：首尾页 + 当前页附近，间隔用 `"gap"` 表示。 */
		function pageItemsOf(page, totalPages) {
			if (totalPages <= 7) return Array.from({ length: totalPages }, (_, index) => index + 1);
			const pages = /* @__PURE__ */ new Set([1, totalPages]);
			if (page <= 4) for (let value = 2; value <= 5; value += 1) pages.add(value);
			else if (page >= totalPages - 3) for (let value = totalPages - 4; value < totalPages; value += 1) pages.add(value);
			else for (let value = page - 1; value <= page + 1; value += 1) pages.add(value);
			const sorted = [...pages].filter((value) => value >= 1 && value <= totalPages).sort((left, right) => left - right);
			const items = [];
			let previous = 0;
			for (const value of sorted) {
				if (previous > 0 && value - previous > 1) items.push("gap");
				items.push(value);
				previous = value;
			}
			return items;
		}
		/** 分页栏：上一页/下一页、页码、每页条数与跳页。 */
		function Pager({ t, page, pageSize, total, loading, onPage, onPageSize }) {
			const totalPages = Math.max(1, Math.ceil(total / pageSize));
			const [jump, setJump] = react.useState("");
			const go = (target) => {
				if (loading) return;
				onPage(Math.min(Math.max(target, 1), totalPages));
			};
			const applyJump = () => {
				const value = Number(jump);
				if (!Number.isFinite(value)) return;
				go(Math.trunc(value));
				setJump("");
			};
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: "dwsd-obs-pager",
				children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: "dwsd-obs-pageNav",
						children: [
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
								type: "button",
								className: "dwsd-obs-pageArrow",
								disabled: loading || page <= 1,
								"aria-label": t("obsPrevPage"),
								onClick: () => {
									go(page - 1);
								},
								children: "‹"
							}),
							pageItemsOf(page, totalPages).map((item, index) => item === "gap" ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
								className: "dwsd-obs-pageGap",
								"aria-hidden": "true",
								children: "…"
							}, `gap-${index}`) : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
								type: "button",
								className: `dwsd-obs-pageBtn${item === page ? " dwsd-obs-pageBtnOn" : ""}`,
								"aria-current": item === page ? "page" : void 0,
								"aria-label": t("obsPageNumber").replace("{page}", String(item)),
								disabled: loading,
								onClick: () => {
									go(item);
								},
								children: item
							}, item)),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
								type: "button",
								className: "dwsd-obs-pageArrow",
								disabled: loading || page >= totalPages,
								"aria-label": t("obsNextPage"),
								onClick: () => {
									go(page + 1);
								},
								children: "›"
							})
						]
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("select", {
						className: "dwsd-obs-input dwsd-obs-pageSize",
						value: pageSize,
						disabled: loading,
						"aria-label": t("obsPageSizeLabel"),
						onChange: (event) => {
							onPageSize(Number(event.target.value));
						},
						children: PAGE_SIZES.map((size) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)("option", {
							value: size,
							children: t("obsPageSize").replace("{size}", String(size))
						}, size))
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", {
						className: "dwsd-obs-pageJump",
						children: [
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: t("obsPageJump") }),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
								className: "dwsd-obs-input dwsd-obs-pageJumpInput",
								type: "number",
								min: 1,
								max: totalPages,
								value: jump,
								onChange: (event) => {
									setJump(event.target.value);
								},
								onKeyDown: (event) => {
									if (event.key === "Enter") applyJump();
								}
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: t("obsPageUnit") })
						]
					})
				]
			});
		}
		/** 只把 http(s) URL 渲染成链接。 */
		function safeHref(url) {
			if (url === void 0) return void 0;
			try {
				const parsed = new URL(url);
				return parsed.protocol === "http:" || parsed.protocol === "https:" ? url : void 0;
			} catch {
				return;
			}
		}
		/** 来源预览：优先 summary，其次 snippet，截到 400 字符供阅读。 */
		function previewOf(source) {
			const text = (source.summary ?? source.snippet ?? "").trim();
			const characters = [...text];
			return characters.length <= 400 ? text : `${characters.slice(0, 400).join("")}…`;
		}
		/** 展开详情需要展示的来源标记。 */
		function sourceMarks(t, source) {
			const marks = [];
			if (source.hasSummary) marks.push(t("obsSourceSummary"));
			if (source.hasSnippet) marks.push(t("obsSourceSnippet"));
			if (!source.hasTitle) marks.push(t("obsSourceNoTitle"));
			return marks;
		}
		/** One record row plus, when expanded, its detail row. */
		function RecordRows({ t, record, open, onToggle, onCopy }) {
			const detailsId = `dwsd-obs-details-${record.id}`;
			return [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("tr", {
				className: "dwsd-obs-clickable",
				tabIndex: 0,
				"aria-expanded": open,
				"aria-controls": detailsId,
				onClick: onToggle,
				onKeyDown: (event) => {
					if (event.key === "Enter" || event.key === " ") {
						event.preventDefault();
						onToggle();
					}
				},
				children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("td", {
						className: "dwsd-obs-timeCell",
						children: timeOf(record.at)
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("td", {
						className: "dwsd-obs-targetCell",
						children: targetLabelOf(t, record.target)
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("td", {
						className: "dwsd-obs-queryCell",
						children: queryOf(record.query)
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("td", {
						className: "dwsd-obs-num",
						children: durationOf(record.durationMs)
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("td", {
						className: "dwsd-obs-num",
						children: numberOf(record.sourceCount)
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("td", {
						className: "dwsd-obs-num dwsd-obs-colSummary",
						children: record.sourceCount === 0 ? "—" : numberOf(record.withSummary)
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("td", { children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(StatusCell, {
						t,
						ok: record.ok
					}) })
				]
			}, "row"), open ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("tr", {
				id: detailsId,
				className: "dwsd-obs-detailRow",
				children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("td", {
					colSpan: 7,
					children: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: "dwsd-obs-detail",
						children: [
							record.errorCode !== void 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("p", {
								className: "dwsd-obs-detailError",
								children: [
									/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("strong", { children: [t("obsDetailsError"), ":"] }),
									" ",
									record.errorCode,
									record.errorMessage !== void 0 ? `: ${record.errorMessage}` : ""
								]
							}) : null,
							/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("p", {
								className: "dwsd-obs-detailQuery",
								children: [
									/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("strong", { children: [t("obsDetailsQuery"), ":"] }),
									" ",
									record.query
								]
							}),
							record.answer !== void 0 && record.answer.length > 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("pre", {
								className: "dwsd-obs-answer",
								children: record.answer
							}) : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
								className: "dwsd-obs-hint",
								children: t("obsAnswerEmpty")
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
								className: "dwsd-obs-detailMeta",
								children: [
									/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", { children: [
										t("obsDetailsKind"),
										": ",
										record.kind
									] }),
									/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", { children: [
										t("obsDetailsAnswer"),
										": ",
										numberOf(record.answerChars)
									] }),
									/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", { children: [
										t("obsDetailsRecordId"),
										": ",
										record.id
									] }),
									record.sessionId !== void 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", { children: [
										t("obsDetailsSession"),
										": ",
										record.sessionId
									] }) : null
								]
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
								className: "dwsd-obs-detailTitle",
								children: t("obsDetailsSources")
							}),
							record.sources.length === 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
								className: "dwsd-obs-hint",
								children: t("obsNoData")
							}) : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("ul", {
								className: "dwsd-obs-sourceList",
								children: record.sources.map((source) => {
									const href = safeHref(source.url);
									const preview = previewOf(source);
									return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("li", {
										className: "dwsd-obs-sourceItem",
										children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
											className: "dwsd-obs-sourceHead",
											children: [
												href !== void 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("a", {
													className: "dwsd-obs-sourceTitle",
													href,
													target: "_blank",
													rel: "noopener noreferrer",
													children: source.title ?? source.host ?? href
												}) : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
													className: "dwsd-obs-sourceTitle",
													children: source.title ?? t("obsSourceNoTitle")
												}),
												/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
													className: "dwsd-obs-sourceHost",
													children: source.host.length > 0 ? source.host : t("obsSourceNoHost")
												}),
												/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
													className: "dwsd-obs-marks",
													children: sourceMarks(t, source).map((mark) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
														className: "dwsd-obs-mark",
														children: mark
													}, mark))
												}),
												/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
													className: "dwsd-obs-sourceHash",
													children: source.urlHash
												})
											]
										}), preview.length > 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
											className: "dwsd-obs-sourceText",
											children: preview
										}) : null]
									}, source.urlHash);
								})
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
								className: "dwsd-obs-detailActions",
								children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
									type: "button",
									className: "dwsd-obs-btn",
									onClick: (event) => {
										event.stopPropagation();
										onCopy();
									},
									children: t("obsCopyJson")
								})
							})
						]
					})
				})
			}, "details") : null];
		}
		/** The records view. */
		function Records(props) {
			const { t, filters } = props;
			const [status, setStatus] = react.useState("all");
			const [term, setTerm] = react.useState("");
			const [appliedTerm, setAppliedTerm] = react.useState("");
			const [records, setRecords] = react.useState([]);
			const [total, setTotal] = react.useState(0);
			const [page, setPage] = react.useState(1);
			const [pageSize, setPageSize] = react.useState(DEFAULT_PAGE_SIZE);
			const [retryToken, setRetryToken] = react.useState(0);
			const [expanded, setExpanded] = react.useState(null);
			const [loading, setLoading] = react.useState(true);
			const [error, setError] = react.useState(null);
			const [toast, setToast] = react.useState(null);
			const toastTimer = react.useRef(null);
			const abortRef = react.useRef(null);
			/** 筛选条件变了就回到第一页；页码变化本身不重置。 */
			const filterKey = `${JSON.stringify(filters)}|${status}|${appliedTerm}|${pageSize}`;
			const filterKeyRef = react.useRef(filterKey);
			/** 加载当前页；响应里的页码是后端夹紧后的实际页码。 */
			react.useEffect(() => {
				const changed = filterKeyRef.current !== filterKey;
				filterKeyRef.current = filterKey;
				/** 筛选变化时先回到第一页，避免先请求旧页再请求第一页。 */
				if (changed && page !== 1) {
					setPage(1);
					return;
				}
				abortRef.current?.abort();
				const controller = new AbortController();
				abortRef.current = controller;
				setLoading(true);
				setError(null);
				(async () => {
					try {
						const result = await fetchRecords(filters, {
							page,
							limit: pageSize,
							status,
							query: appliedTerm
						}, controller.signal);
						if (controller.signal.aborted) return;
						setRecords(result.records);
						setTotal(result.total);
						setPage(result.page);
					} catch (cause) {
						if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : String(cause));
					} finally {
						if (!controller.signal.aborted) setLoading(false);
					}
				})();
				return () => controller.abort();
			}, [
				filterKey,
				page,
				props.refreshToken,
				retryToken
			]);
			/** Clear the toast timer on unmount. */
			react.useEffect(() => () => {
				if (toastTimer.current !== null) clearTimeout(toastTimer.current);
			}, []);
			/** Show a two-second toast. */
			const showToast = (text) => {
				if (toastTimer.current !== null) clearTimeout(toastTimer.current);
				setToast(text);
				toastTimer.current = setTimeout(() => {
					setToast(null);
					toastTimer.current = null;
				}, 2e3);
			};
			/** Copy one record as JSON. */
			const copy = async (record) => {
				try {
					await navigator.clipboard.writeText(JSON.stringify(record, null, 2));
					showToast(t("obsCopied"));
				} catch {
					showToast(t("obsCopyFailed"));
				}
			};
			/** Reset every in-view filter and ask the parent to clear its target filter. */
			const resetFilters = () => {
				setStatus("all");
				setTerm("");
				setAppliedTerm("");
				props.onResetTarget();
			};
			const filtered = status !== "all" || appliedTerm.length > 0 || filters.target.length > 0;
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: "dwsd-obs-view",
				children: [
					error !== null ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)(ErrorBanner, {
						t,
						message: error,
						onRetry: () => {
							setRetryToken((current) => current + 1);
						}
					}) : null,
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: "dwsd-obs-filters",
						children: [
							/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", {
								className: "dwsd-obs-filter",
								children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
									className: "dwsd-obs-filterLabel",
									children: t("obsFilterStatus")
								}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("select", {
									className: "dwsd-obs-input",
									value: status,
									onChange: (event) => {
										setStatus(event.target.value);
									},
									children: [
										/* @__PURE__ */ (0, react_jsx_runtime.jsx)("option", {
											value: "all",
											children: t("obsAllStatuses")
										}),
										/* @__PURE__ */ (0, react_jsx_runtime.jsx)("option", {
											value: "ok",
											children: t("obsStatusOk")
										}),
										/* @__PURE__ */ (0, react_jsx_runtime.jsx)("option", {
											value: "fail",
											children: t("obsStatusFail")
										})
									]
								})]
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", {
								className: "dwsd-obs-filter dwsd-obs-filterGrow",
								children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
									className: "dwsd-obs-filterLabel",
									children: t("obsFilterQuery")
								}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
									className: "dwsd-obs-input",
									type: "search",
									value: term,
									placeholder: t("obsFilterQueryHint"),
									onChange: (event) => {
										setTerm(event.target.value);
									},
									onKeyDown: (event) => {
										if (event.key === "Enter") setAppliedTerm(term.trim());
									}
								})]
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
								type: "button",
								className: "dwsd-obs-btn",
								onClick: () => {
									setAppliedTerm(term.trim());
								},
								children: t("obsApplyFilters")
							}),
							filtered ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
								type: "button",
								className: "dwsd-obs-btn",
								onClick: resetFilters,
								children: t("obsClearFilters")
							}) : null
						]
					}),
					loading && records.length === 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)(TableSkeleton, { rows: 6 }) : records.length === 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)(EmptyState, {
						t,
						title: filtered ? t("obsEmptyFiltered") : t("obsEmpty"),
						hint: filtered ? t("obsEmptyFilteredHint") : t("obsEmptyHint"),
						...filtered ? {
							actionLabel: t("obsClearFilters"),
							onAction: resetFilters
						} : {}
					}) : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						className: "dwsd-obs-tableWrap",
						children: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("table", {
							className: "dwsd-obs-table",
							children: [
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("caption", {
									className: "dwsd-obs-caption",
									children: t("obsRecordsCaption")
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("thead", { children: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("tr", { children: [
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)("th", {
										scope: "col",
										children: t("obsTableTime")
									}),
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)("th", {
										scope: "col",
										children: t("obsTableTarget")
									}),
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)("th", {
										scope: "col",
										children: t("obsTableQuery")
									}),
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)("th", {
										scope: "col",
										className: "dwsd-obs-num",
										children: t("obsTableDuration")
									}),
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)("th", {
										scope: "col",
										className: "dwsd-obs-num",
										children: t("obsTableSources")
									}),
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)("th", {
										scope: "col",
										className: "dwsd-obs-num dwsd-obs-colSummary",
										children: t("obsTableSummary")
									}),
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)("th", {
										scope: "col",
										children: t("obsTableStatus")
									})
								] }) }),
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("tbody", { children: records.map((record) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)(RecordRows, {
									t,
									record,
									open: expanded === record.id,
									onToggle: () => {
										setExpanded(expanded === record.id ? null : record.id);
									},
									onCopy: () => {
										copy(record);
									}
								}, record.id)) })
							]
						})
					}),
					records.length > 0 || total > 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)(Pager, {
						t,
						page,
						pageSize,
						total,
						loading,
						onPage: setPage,
						onPageSize: (size) => {
							setPageSize(size);
							setPage(1);
						}
					}) : null,
					toast !== null ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						className: "dwsd-obs-toast",
						role: "status",
						children: toast
					}) : null
				]
			});
		}
		//#endregion
		//#region src/client/obs/page.tsx
		/**
		* 观测页容器：概览 / 记录两个二级视图、时间与 target 筛选、刷新、导出与数据管理。
		*
		* 一级 tab（配置 / 观测）在 `client/page.tsx`；本文件只负责观测内部的信息架构。
		*
		* @module dsh-web-search-diy/client/obs/page
		*/
		/** The observability page. */
		function ObsPage({ t }) {
			const [view, setView] = react.useState("overview");
			const [range, setRange] = react.useState(DEFAULT_RANGE);
			/** 导入范围与查询范围互相独立：共用同一个选择器，但各自持有自己的值。 */
			const [importRange, setImportRange] = react.useState(DEFAULT_RANGE);
			const [target, setTarget] = react.useState("");
			const [includeTests, setIncludeTests] = react.useState(false);
			const [refreshToken, setRefreshToken] = react.useState(0);
			const [summary, setSummary] = react.useState(null);
			const [targetOptions, setTargetOptions] = react.useState([]);
			const [loading, setLoading] = react.useState(true);
			const [error, setError] = react.useState(null);
			const [clearText, setClearText] = react.useState("");
			const [clearing, setClearing] = react.useState(false);
			const [cleared, setCleared] = react.useState(null);
			const [importing, setImporting] = react.useState(false);
			const [imported, setImported] = react.useState(null);
			const filters = react.useMemo(() => ({
				range,
				target,
				includeTests
			}), [
				range,
				target,
				includeTests
			]);
			/** Load the summary and the recent list for the active filters. */
			const load = react.useCallback(async (signal) => {
				setLoading(true);
				setError(null);
				try {
					const nextSummary = await fetchSummary(filters, signal);
					setSummary(nextSummary);
					/** 未筛选时刷新 target 选项；筛选后保留完整列表，避免选项随筛选收缩。 */
					if (filters.target.length === 0) setTargetOptions(nextSummary.byTarget.map((row) => row.target));
				} catch (cause) {
					if (!signal.aborted) setError(cause instanceof Error ? cause.message : String(cause));
				} finally {
					if (!signal.aborted) setLoading(false);
				}
			}, [filters]);
			react.useEffect(() => {
				const controller = new AbortController();
				load(controller.signal);
				return () => controller.abort();
			}, [load, refreshToken]);
			/** Reload from the toolbar or the error banner. */
			const refresh = () => {
				setRefreshToken((current) => current + 1);
			};
			/** Clear the target filter from the overview or the records page. */
			const clearTarget = () => {
				setTarget("");
			};
			/** Import historical web_search calls from local session logs. */
			const runImport = async () => {
				setImporting(true);
				setImported(null);
				setError(null);
				try {
					const result = await importHistory(importRange);
					setImported(t("obsImportDone").replace("{sessions}", String(result.sessions)).replace("{imported}", String(result.imported)).replace("{skipped}", String(result.skipped)).replace("{filtered}", String(result.filtered)).replace("{identified}", String(result.identified)).replace("{updated}", String(result.updated)));
					refresh();
				} catch (cause) {
					setError(cause instanceof Error ? cause.message : String(cause));
				} finally {
					setImporting(false);
				}
			};
			/** Delete every observation after the typed confirmation. */
			const clear = async () => {
				setClearing(true);
				try {
					const deleted = await clearObservations();
					setCleared(t("obsCleared").replace("{count}", String(deleted)));
					setClearText("");
					refresh();
				} catch (cause) {
					setError(cause instanceof Error ? cause.message : String(cause));
				} finally {
					setClearing(false);
				}
			};
			const filtered = target.length > 0;
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: "dwsd-obs",
				children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: "dwsd-obs-toolbar",
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
							className: "dwsd-obs-segmented",
							role: "tablist",
							"aria-label": t("tabObservability"),
							children: ["overview", "records"].map((value) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
								type: "button",
								role: "tab",
								"aria-selected": view === value,
								className: view === value ? "dwsd-obs-segment dwsd-obs-segmentOn" : "dwsd-obs-segment",
								onClick: () => {
									setView(value);
								},
								children: value === "overview" ? t("obsOverview") : t("obsRecords")
							}, value))
						}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							className: "dwsd-obs-toolbarRight",
							children: [
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)(RangePicker, {
									label: t("obsRange"),
									value: range,
									onChange: setRange,
									t
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", {
									className: "dwsd-obs-filter",
									children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
										className: "dwsd-obs-filterLabel",
										children: t("obsTargetFilter")
									}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("select", {
										className: "dwsd-obs-input",
										value: target,
										onChange: (event) => {
											setTarget(event.target.value);
										},
										children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("option", {
											value: "",
											children: t("obsAllTargets")
										}), targetOptions.map((value) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)("option", {
											value,
											children: value
										}, value))]
									})]
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", {
									className: "dwsd-obs-check",
									children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
										type: "checkbox",
										checked: includeTests,
										onChange: (event) => {
											setIncludeTests(event.target.checked);
										}
									}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: t("obsIncludeTests") })]
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
									type: "button",
									className: "dwsd-obs-btn",
									disabled: loading,
									onClick: refresh,
									"aria-label": t("obsRefresh"),
									children: t(loading ? "obsRefreshing" : "obsRefresh")
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("a", {
									className: "dwsd-obs-btn",
									href: exportUrl("jsonl", filters),
									download: true,
									children: t("obsExportJsonl")
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("a", {
									className: "dwsd-obs-btn",
									href: exportUrl("csv", filters),
									download: true,
									children: t("obsExportCsv")
								})
							]
						})]
					}),
					view === "overview" ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)(Overview, {
						t,
						summary,
						loading,
						error,
						filtered,
						onRefresh: refresh,
						onOpenTarget: (next) => {
							setTarget(next);
							setView("records");
						},
						onClearFilters: clearTarget
					}) : /* @__PURE__ */ (0, react_jsx_runtime.jsx)(Records, {
						t,
						filters,
						targetOptions,
						refreshToken,
						onResetTarget: clearTarget
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("details", {
						className: "dwsd-obs-data",
						children: [
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("summary", { children: t("obsDataManagement") }),
							/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
								className: "dwsd-obs-clearRow",
								children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
									type: "button",
									className: "dwsd-obs-btn",
									disabled: importing,
									onClick: () => {
										runImport();
									},
									children: t(importing ? "obsImporting" : "obsImport")
								}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
									className: "dwsd-obs-hint",
									children: t("obsImportHint")
								})]
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
								className: "dwsd-obs-clearRow",
								children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(RangePicker, {
									className: "dwsd-obs-importRange",
									label: t("obsImportRange"),
									value: importRange,
									onChange: setImportRange,
									t
								})
							}),
							imported !== null ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
								className: "dwsd-obs-hint",
								role: "status",
								children: imported
							}) : null,
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
								className: "dwsd-obs-hint",
								children: t("obsClearHint")
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
								className: "dwsd-obs-clearRow",
								children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
									className: "dwsd-obs-input",
									type: "text",
									value: clearText,
									placeholder: t("obsClearPlaceholder"),
									onChange: (event) => {
										setClearText(event.target.value);
									}
								}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
									type: "button",
									className: "dwsd-obs-btn",
									disabled: clearText !== "DELETE" || clearing,
									onClick: () => {
										clear();
									},
									children: t(clearing ? "obsClearing" : "obsClear")
								})]
							}),
							cleared !== null ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
								className: "dwsd-obs-hint",
								role: "status",
								children: cleared
							}) : null
						]
					})
				]
			});
		}
		//#endregion
		//#region src/client/page.tsx
		/**
		* The full configuration page: shape → protocol → vendor selection, a
		* catalog-driven field form, template seeding, test and save.
		*/
		/** DOM id prefix for every control the card renders. */
		const ID_PREFIX = "plugin-config-web-search-diy-";
		/** Target id reduced to a DOM-safe slug. */
		const slugOf = (targetId) => targetId.replace(/[^a-z0-9]+/gu, "-");
		/** Staged-draft equality that ignores key order but compares every value. */
		function sameDraft(left, right) {
			const keys = Object.keys(left);
			if (keys.length !== Object.keys(right).length) return false;
			return keys.every((key) => right[key] === left[key]);
		}
		/** The host's credential-reference grammar; the host re-checks it on save. */
		const REF_NAME = /^[A-Za-z_][A-Za-z0-9_]*$/u;
		/** Whether one staged value violates the spec the host projected for its field. */
		function specInvalid(spec, value) {
			if (spec === void 0) return false;
			const text = typeof value === "string" ? value : "";
			/** A blank entry is the host's "clear this key" signal, never an error. */
			if (text.length === 0) return false;
			switch (spec.kind) {
				case "positiveInt": {
					if (!/^\d+$/u.test(text)) return true;
					const numeric = Number(text);
					return numeric < 1 || spec.max !== void 0 && numeric > spec.max;
				}
				case "refName": return !REF_NAME.test(text);
				case "json": try {
					const parsed = JSON.parse(text);
					return typeof parsed !== "object" || parsed === null || Array.isArray(parsed);
				} catch {
					return true;
				}
				default: return false;
			}
		}
		/** The full configuration page. */
		function ConfigPage({ t }) {
			const [snapshot, setSnapshot] = react.useState(null);
			const [failed, setFailed] = react.useState(null);
			const [saving, setSaving] = react.useState(false);
			const [apiKey, setApiKey] = react.useState("");
			const [testing, setTesting] = react.useState(false);
			const [testResult, setTestResult] = react.useState(null);
			/** 加载前占位：与 Host 默认 target（DeepSeek 纯工具搜索）一致，GET 返回后以服务端选择为准。 */
			const [shape, setShape] = react.useState("standalone");
			const [vendor, setVendor] = react.useState("deepseek");
			const [protocol, setProtocol] = react.useState("search");
			const [drafts, setDrafts] = react.useState({});
			const [baseline, setBaseline] = react.useState({});
			/** 模板是一次性填充动作：`lastTemplate` 只用于 placeholder 提示，不进入配置。 */
			const [lastTemplate, setLastTemplate] = react.useState(null);
			/** 已保存过配置时，切模板先要求确认，避免静默覆盖。 */
			const [pendingTemplate, setPendingTemplate] = react.useState(null);
			/** Aborts an in-flight snapshot request when the card unmounts or a reload supersedes it. */
			const loadAbort = react.useRef(null);
			/** Load the host snapshot and stage every saved target. */
			const load = react.useCallback(async () => {
				loadAbort.current?.abort();
				const controller = new AbortController();
				loadAbort.current = controller;
				try {
					const response = await fetch(CONFIG_URL, {
						headers: { accept: "application/json" },
						signal: controller.signal
					});
					if (!response.ok) throw new Error(`HTTP ${response.status}`);
					const data = await response.json();
					const staged = {};
					for (const [id, bucket] of Object.entries(data.targets ?? {})) staged[id] = toDraft(bucket);
					const selection = data.selection ?? {
						vendor: "deepseek",
						protocol: "search"
					};
					const entry = (data.catalog ?? []).find((item) => item.vendor === selection.vendor && item.protocol === selection.protocol);
					/** 已保存选择指向自定义 target 但没有桶时，用首个模板补上草稿，避免模板看起来已选中却全是空值。 */
					if (entry?.support === "custom" && staged[entry.id] === void 0) {
						const seed = seedFromTemplate(entry);
						if (Object.keys(seed).length > 0) staged[entry.id] = seed;
					}
					setSnapshot(data);
					setBaseline(staged);
					setDrafts(staged);
					setVendor(selection.vendor);
					setProtocol(selection.protocol);
					setShape(entry?.kind ?? (selection.protocol === "search" ? "standalone" : "in-protocol"));
					setLastTemplate(null);
					setPendingTemplate(null);
					setFailed(null);
				} catch {
					/** An abort is a superseded/unmounted load, not a failure worth showing. */
					if (controller.signal.aborted) return;
					setFailed(t("loadFailed"));
				}
			}, [t]);
			react.useEffect(() => {
				load();
				/** Drop the in-flight request when the card unmounts; its setState would be pointless. */
				return () => {
					loadAbort.current?.abort();
				};
			}, [load]);
			if (snapshot === null) return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
				className: "dwsd-status",
				children: failed ?? t("loading")
			});
			const catalog = snapshot.catalog;
			const shapeProtocols = PROTOCOLS.filter((value) => catalog.some((entry) => entry.kind === shape && entry.protocol === value));
			const vendorEntries = catalog.filter((entry) => entry.kind === shape && entry.protocol === protocol && entry.support !== "unsupported");
			/** 折叠区只列当前形态下不可用的组合：内置协议与纯工具的原因分开呈现。 */
			const unsupportedEntries = catalog.filter((entry) => entry.support === "unsupported" && entry.kind === shape);
			const currentId = `${vendor}/${protocol}`;
			const currentSlug = slugOf(currentId);
			const entry = catalog.find((item) => item.id === currentId);
			const savedDraft = baseline[currentId] ?? {};
			const draft = drafts[currentId] ?? savedDraft;
			const dirty = vendor !== snapshot.selection.vendor || protocol !== snapshot.selection.protocol || !sameDraft(draft, savedDraft) || apiKey.length > 0;
			/**
			* 密钥徽标跟随所选厂商：GET 一次探测每个厂商的默认链；`custom` 的引用名由
			* 用户填写，无法预判，改为提示它取决于引用名。
			*/
			const customCredential = vendor === "custom";
			const credentialConfigured = customCredential ? false : snapshot.credentials?.[vendor] ?? snapshot.keyConfigured;
			const credentialLabel = customCredential ? t("apiKeyByReference") : credentialConfigured ? t("apiKeySet") : t("apiKeyUnset");
			/** Switch shape, landing on that shape's default target when the host declares one. */
			const chooseShape = (next) => {
				setShape(next);
				setApiKey("");
				/** 模板提示只针对当前 target；切换后清空，避免 placeholder 误导。 */
				setLastTemplate(null);
				setPendingTemplate(null);
				/** 形态默认落点由 Host 下发：纯工具 → DeepSeek 纯搜索，协议内置 → DeepSeek Anthropic Messages。 */
				const shapeDefaultId = snapshot.shapeDefaults?.[next];
				const shapeDefault = catalog.find((item) => item.id === shapeDefaultId && item.support !== "unsupported");
				if (shapeDefault !== void 0) {
					setProtocol(shapeDefault.protocol);
					setVendor(shapeDefault.vendor);
					return;
				}
				const protocols = PROTOCOLS.filter((value) => catalog.some((item) => item.kind === next && item.protocol === value));
				const keep = protocols.includes(protocol) ? protocol : protocols[0];
				if (keep === void 0) return;
				setProtocol(keep);
				if (catalog.some((item) => item.vendor === vendor && item.protocol === keep && item.kind === next)) return;
				const fallback = catalog.find((item) => item.kind === next && item.protocol === keep && item.support === "full") ?? catalog.find((item) => item.kind === next && item.protocol === keep && item.support !== "unsupported");
				if (fallback !== void 0) setVendor(fallback.vendor);
			};
			/** Switch protocol, moving to a vendor that supports it when needed. */
			const chooseProtocol = (next) => {
				setProtocol(next);
				setApiKey("");
				setLastTemplate(null);
				setPendingTemplate(null);
				if (catalog.some((item) => item.vendor === vendor && item.protocol === next)) return;
				const fallback = catalog.find((item) => item.kind === shape && item.protocol === next && item.support === "full") ?? catalog.find((item) => item.kind === shape && item.protocol === next && item.support !== "unsupported");
				if (fallback !== void 0) setVendor(fallback.vendor);
			};
			/** Seed a custom target's draft from its first template when nothing is saved yet. */
			const seededDraft = (next) => next === void 0 || Object.keys(baseline[next.id] ?? {}).length > 0 ? {} : seedFromTemplate(next);
			/** Stage one field on the current target. */
			const edit = (key, value) => {
				/** 切换自定义 Chat 的变体时清掉上一个变体的专属字段，避免保存无用参数。 */
				if (key === "chatVariant" && entry?.support === "custom" && entry.protocol === "chat-completions") {
					const allowed = new Set(CHAT_VARIANT_FIELDS[String(value)] ?? []);
					const next = {};
					for (const [k, v] of Object.entries(draft)) if (!CHAT_VARIANT_ONLY.has(k) || allowed.has(k)) next[k] = v;
					next[key] = value;
					setDrafts((current) => ({
						...current,
						[currentId]: next
					}));
					return;
				}
				setDrafts((current) => ({
					...current,
					[currentId]: {
						...draft,
						[key]: value
					}
				}));
			};
			/** Discard staged edits for the current target. */
			const discard = () => {
				setDrafts((current) => ({
					...current,
					[currentId]: savedDraft
				}));
				setApiKey("");
				setLastTemplate(null);
				setPendingTemplate(null);
				setVendor(snapshot.selection.vendor);
				setProtocol(snapshot.selection.protocol);
				setShape(snapshot.selection.protocol === "search" ? "standalone" : "in-protocol");
				setFailed(null);
			};
			/** The staged draft as the host expects it: blank values cleared, numbers by spec. */
			const stagedPayload = () => {
				const payload = {
					vendor,
					protocol
				};
				for (const [key, value] of Object.entries(draft)) payload[key] = wireValue(entry?.specs?.[key], value);
				return payload;
			};
			/** Run one minimal search with the staged draft; nothing is persisted. */
			const test = async () => {
				setTesting(true);
				setTestResult(null);
				const payload = stagedPayload();
				try {
					const response = await fetch(TEST_URL, {
						method: "POST",
						headers: { "content-type": "application/json" },
						body: JSON.stringify(payload)
					});
					const data = await response.json();
					if (data.ok === true) {
						const count = data.sourceCount ?? 0;
						const ms = data.latencyMs ?? 0;
						/** 0 来源按该组合的预期来源质量分级：设计上不返回、可能未执行、或应检查配置。 */
						const summary = count > 0 ? `${t("testOk")} · ${count} ${t("testSources")} · ${ms}ms` : data.sourceQuality === "none" ? `${t("testOk")} · ${t("testNoSourcesByDesign")} · ${ms}ms` : data.sourceQuality === "partial" ? `${t("testOk")} · ${t("testNoSourcesPartial")} · ${ms}ms` : `${t("testOk")} · ${t("testNoSourcesFull")} · ${ms}ms`;
						setTestResult({
							text: `${summary}${data.degraded === true ? ` · ${t("testDegraded")}` : ""}`,
							warn: count === 0 && data.sourceQuality !== "none"
						});
					} else setTestResult({
						text: `${t("testFailed")}: ${data.error ?? `HTTP ${response.status}`}`,
						warn: true
					});
				} catch (cause) {
					setTestResult({
						text: `${t("testFailed")}: ${cause instanceof Error ? cause.message : String(cause)}`,
						warn: true
					});
				} finally {
					setTesting(false);
				}
			};
			/** Submit the staged draft for the current target. */
			const save = async () => {
				setSaving(true);
				setFailed(null);
				const payload = stagedPayload();
				if (apiKey.length > 0) payload.apiKey = apiKey;
				try {
					const response = await fetch(CONFIG_URL, {
						method: "POST",
						headers: { "content-type": "application/json" },
						body: JSON.stringify(payload)
					});
					const data = await response.json();
					if (!response.ok || data.ok !== true) throw new Error(data.error ?? `HTTP ${response.status}`);
					setApiKey("");
					await load();
				} catch (error) {
					setFailed(error instanceof Error ? error.message : String(error));
				} finally {
					setSaving(false);
				}
			};
			/** Localized field label; falls back to the raw key when untranslated. */
			const labelOf = (key) => {
				const translated = t(`field_${key}`);
				return translated === `field_${key}` ? key : translated;
			};
			/** Apply a custom target's template: rebuild the draft from that template, never leaking the previous one's values. */
			const applyTemplate = (templateId) => {
				const template = entry?.templates?.find((item) => item.id === templateId);
				if (template === void 0) return;
				/** 只填该 target 声明的字段；`template` 本身不进入草稿，保存时也不会提交。 */
				const next = fillFromTemplate(template, entry?.fields ?? []);
				setDrafts((current) => ({
					...current,
					[currentId]: next
				}));
				setLastTemplate(template.label);
			};
			/** 选模板：有已保存配置时先确认，否则直接填充。 */
			const chooseTemplate = (templateId) => {
				const template = entry?.templates?.find((item) => item.id === templateId);
				if (template === void 0) return;
				if (snapshot.targets?.[currentId] !== void 0) {
					setPendingTemplate({
						id: template.id,
						label: template.label
					});
					return;
				}
				applyTemplate(template.id);
			};
			const confirmTemplate = () => {
				if (pendingTemplate === null) return;
				applyTemplate(pendingTemplate.id);
				setPendingTemplate(null);
			};
			/** 重置回该 target 已保存的配置（没有保存过则清空）。 */
			const resetToSaved = () => {
				setDrafts((current) => ({
					...current,
					[currentId]: savedDraft
				}));
				setLastTemplate(null);
				setPendingTemplate(null);
			};
			/** Localized error copy for one spec; only the kinds that can be invalid are listed. */
			const invalidLabelOf = (spec) => {
				if (spec?.kind === "positiveInt") return spec.max !== void 0 ? t("invalidRange").replace("{max}", String(spec.max)) : t("invalidPositive");
				if (spec?.kind === "refName") return t("invalidRefName");
				if (spec?.kind === "json") return t("invalidJson");
				return t("invalidPositive");
			};
			/** Whether one staged field currently violates its spec. */
			const invalidOf = (key) => specInvalid(entry?.specs?.[key], stagedValue(draft, entry, key));
			/** Render one field by the spec the host declares for it. */
			const renderField = (key) => {
				const spec = entry?.specs?.[key];
				const value = stagedValue(draft, entry, key);
				const translatedHint = t(`hint_${key}`);
				/** The locale service returns an untranslated key verbatim, so equality means "no hint". */
				const baseHint = entry?.hints[key] ?? (translatedHint === `hint_${key}` ? t("fieldPlaceholder") : translatedHint);
				const hint = key === "model" && entry?.modelLocked === true ? t("modelLockedHint") : baseHint;
				const placeholder = defaultText(entry, key);
				const id = `${ID_PREFIX}${currentSlug}-${key}`;
				const invalid = invalidOf(key);
				const invalidLabel = invalidLabelOf(spec);
				if (key === "apiKeyEnv") {
					/** 只有从未设置过才显示默认；用户清空后保持为空，便于改选或手填。 */
					const raw = draft[key];
					const current = raw === void 0 ? defaultText(entry, key) : String(raw);
					/** 候选从 catalog 派生，避免厂商链在这里再维护一份副本；自定义网关列出全部引用。 */
					const options = entry?.vendor === "custom" ? allCredentialRefs(catalog) : credentialRefsFor(catalog, entry?.vendor ?? "");
					return /* @__PURE__ */ (0, react_jsx_runtime.jsx)(ComboField, {
						id,
						label: labelOf(key),
						hint,
						text: current,
						options: options.length > 0 ? options : allCredentialRefs(catalog),
						invalid,
						invalidLabel,
						onEdit: (next) => {
							edit(key, next);
						}
					}, key);
				}
				if (key === "toolType") {
					const raw = draft[key];
					const current = raw === void 0 ? defaultText(entry, key) : String(raw);
					return /* @__PURE__ */ (0, react_jsx_runtime.jsx)(ComboField, {
						id,
						label: labelOf(key),
						hint,
						text: current,
						options: SUGGESTED_TOOL_TYPES,
						onEdit: (next) => {
							edit(key, next);
						}
					}, key);
				}
				if (key === "searchEngine" && entry?.support === "custom") {
					/** 自定义网关的引擎名不统一：候选只做提示，允许自由输入，留空不发送。 */
					const raw = draft[key];
					const current = raw === void 0 ? defaultText(entry, key) : String(raw);
					return /* @__PURE__ */ (0, react_jsx_runtime.jsx)(ComboField, {
						id,
						label: labelOf(key),
						hint: t("hint_searchEngineCustom"),
						text: current,
						options: CUSTOM_SEARCH_ENGINES,
						onEdit: (next) => {
							edit(key, next);
						}
					}, key);
				}
				if (spec?.kind === "boolean") return /* @__PURE__ */ (0, react_jsx_runtime.jsx)(SwitchField, {
					id,
					label: labelOf(key),
					hint,
					checked: value === true,
					onEdit: (checked) => {
						edit(key, checked);
					}
				}, key);
				if (spec?.kind === "enum") {
					const options = spec.values.map((option) => {
						const labelKey = `opt_${key}_${option === "" ? "empty" : option}`;
						const label = t(labelKey);
						return {
							value: option,
							label: label === labelKey ? option.length > 0 ? option : "—" : label
						};
					});
					const current = String(value) === "" ? defaultText(entry, key) : String(value);
					return /* @__PURE__ */ (0, react_jsx_runtime.jsx)(ChoiceField, {
						id,
						label: labelOf(key),
						hint,
						value: current,
						options,
						onEdit: (next) => {
							edit(key, next);
						}
					}, key);
				}
				return /* @__PURE__ */ (0, react_jsx_runtime.jsx)(ValueField, {
					id,
					label: labelOf(key),
					hint,
					text: String(value),
					placeholder,
					numeric: spec?.kind === "positiveInt",
					invalid,
					invalidLabel,
					disabled: key === "model" && entry?.modelLocked === true,
					onEdit: (next) => {
						edit(key, next);
					}
				}, key);
			};
			const chatVariant = String(stagedValue(draft, entry, "chatVariant") || entry?.defaults.chatVariant || "zhipu");
			const variantFields = entry?.support === "custom" && entry.protocol === "chat-completions" ? new Set(CHAT_VARIANT_FIELDS[chatVariant] ?? []) : void 0;
			/** `chatVariant` 由模板决定并随配置保存，但不作为用户可选项展示。 */
			const fields = (entry?.fields ?? []).filter((key) => key !== "template" && key !== "chatVariant" && (variantFields === void 0 || !CHAT_VARIANT_ONLY.has(key) || variantFields.has(key)));
			const basic = fields.filter((key) => !ADVANCED.has(key));
			const advanced = fields.filter((key) => ADVANCED.has(key));
			/** A staged value the host would reject: saving it can only fail, so the button waits. */
			const hasInvalid = fields.some((key) => invalidOf(key));
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: "dwsd-body",
				children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: "dwsd-field",
						children: [
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
								className: "dwsd-head",
								children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
									className: "dwsd-label",
									children: t("shape")
								})
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
								className: "dwsd-choices",
								role: "radiogroup",
								"aria-label": t("shape"),
								children: ["in-protocol", "standalone"].map((value) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", {
									className: "dwsd-choice",
									children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
										id: `${ID_PREFIX}shape-${value}`,
										type: "radio",
										name: `${ID_PREFIX}shape`,
										value,
										checked: shape === value,
										onChange: () => {
											chooseShape(value);
										}
									}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
										className: "dwsd-choiceLabel",
										children: value === "in-protocol" ? t("shapeInProtocol") : t("shapeStandalone")
									})]
								}, value))
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
								className: "dwsd-hint",
								children: t("description")
							})
						]
					}),
					shapeProtocols.length > 1 ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: "dwsd-field",
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
							className: "dwsd-head",
							children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
								className: "dwsd-label",
								children: t("protocol")
							})
						}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
							className: "dwsd-choices",
							role: "radiogroup",
							"aria-label": t("protocol"),
							children: shapeProtocols.map((value) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", {
								className: "dwsd-choice",
								children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
									id: `${ID_PREFIX}protocol-${value}`,
									type: "radio",
									name: `${ID_PREFIX}protocol`,
									value,
									checked: protocol === value,
									onChange: () => {
										chooseProtocol(value);
									}
								}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
									className: "dwsd-choiceLabel",
									children: protocolLabel(t, value)
								})]
							}, value))
						})]
					}) : null,
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: "dwsd-field",
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
							className: "dwsd-head",
							children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
								className: "dwsd-label",
								children: t("vendor")
							})
						}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
							className: "dwsd-choices",
							role: "radiogroup",
							"aria-label": t("vendor"),
							children: vendorEntries.map((item) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", {
								className: "dwsd-choice",
								children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
									id: `${ID_PREFIX}vendor-${item.vendor}`,
									type: "radio",
									name: `${ID_PREFIX}vendor`,
									value: item.vendor,
									checked: vendor === item.vendor,
									onChange: () => {
										const nextId = `${item.vendor}/${protocol}`;
										const next = catalog.find((entryItem) => entryItem.id === nextId);
										setVendor(item.vendor);
										setApiKey("");
										setLastTemplate(null);
										setPendingTemplate(null);
										setDrafts((current) => current[nextId] !== void 0 ? current : {
											...current,
											[nextId]: seededDraft(next)
										});
									}
								}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
									className: "dwsd-choiceLabel",
									children: [
										vendorLabel(t, item.vendor),
										" · ",
										supportLabel(t, item.support),
										item.support === "degraded" && item.reason.length > 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
											className: "dwsd-choiceReason",
											children: item.reason
										}) : null
									]
								})]
							}, item.id))
						})]
					}),
					unsupportedEntries.length > 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("details", {
						className: "dwsd-advanced",
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("summary", { children: [
							t("unsupportedVendors"),
							" (",
							unsupportedEntries.length,
							")"
						] }), unsupportedEntries.map((item) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("p", {
							className: "dwsd-notice",
							children: [
								vendorLabel(t, item.vendor),
								" · ",
								protocolLabel(t, item.protocol),
								" — ",
								item.reason
							]
						}, item.id))]
					}) : null,
					entry?.support === "custom" ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
						className: "dwsd-notice",
						children: t("customNotice")
					}) : null,
					entry?.templates !== void 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: "dwsd-field",
						children: [
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)(SelectField, {
								id: `${ID_PREFIX}${currentSlug}-template`,
								label: t("fillFromTemplate"),
								hint: t("templateFillHint"),
								value: "",
								placeholder: lastTemplate === null ? t("templatePlaceholder") : t("templateUsed").replace("{name}", lastTemplate),
								options: entry.templates.map((item) => ({
									value: item.id,
									label: item.label
								})),
								onChange: (next) => {
									chooseTemplate(next);
								}
							}),
							pendingTemplate !== null ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
								className: "dwsd-confirm",
								children: [
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
										className: "dwsd-failed",
										role: "alert",
										children: t("templateOverwrite").replace("{name}", pendingTemplate.label)
									}),
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
										type: "button",
										className: "dwsd-discard",
										onClick: confirmTemplate,
										children: t("templateApply")
									}),
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
										type: "button",
										className: "dwsd-discard",
										onClick: () => {
											setPendingTemplate(null);
										},
										children: t("templateCancel")
									})
								]
							}) : null,
							snapshot.targets?.[currentId] !== void 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
								type: "button",
								className: "dwsd-discard",
								onClick: resetToSaved,
								children: t("resetToSaved")
							}) : null
						]
					}) : null,
					entry !== void 0 && entry.support !== "unsupported" ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", { children: basic.map(renderField) }) : null,
					entry !== void 0 && entry.support !== "unsupported" && advanced.length > 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("details", {
						className: "dwsd-advanced",
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("summary", { children: t("advanced") }), advanced.map(renderField)]
					}) : null,
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)(SecretField, {
						id: `${ID_PREFIX}api-key`,
						label: t("apiKey"),
						hint: t("apiKeyHint"),
						text: apiKey,
						configured: credentialConfigured,
						stateLabel: credentialLabel,
						disabled: entry?.support === "unsupported",
						onEdit: setApiKey
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: "dwsd-footer",
						children: [
							dirty ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
								className: "dwsd-badgeMuted",
								children: t("unsaved")
							}) : null,
							testResult !== null ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
								className: testResult.warn ? "dwsd-failed" : "dwsd-hint",
								role: "status",
								children: testResult.text
							}) : null,
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
								type: "button",
								className: "dwsd-discard",
								disabled: testing || entry?.support === "unsupported",
								onClick: () => {
									test();
								},
								children: t(testing ? "testing" : "test")
							}),
							failed !== null ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
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
								disabled: !dirty || saving || hasInvalid || entry?.support === "unsupported",
								onClick: () => {
									save();
								},
								children: t(saving ? "saving" : "save")
							})
						]
					})
				]
			});
		}
		/** 一级 tab：配置与观测；观测页只在切到时挂载，避免打开配置页就读观测库。 */
		function PluginPage({ t }) {
			const [tab, setTab] = react.useState("config");
			const tabs = ["config", "observability"];
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: "dwsd-page",
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
					className: "dwsd-tabs",
					role: "tablist",
					"aria-label": t("tabNav"),
					onKeyDown: (event) => {
						if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
						const index = tabs.indexOf(tab);
						const step = event.key === "ArrowRight" ? 1 : tabs.length - 1;
						setTab(tabs[(index + step) % tabs.length]);
					},
					children: tabs.map((value) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
						type: "button",
						role: "tab",
						"aria-selected": tab === value,
						className: tab === value ? "dwsd-tab dwsd-tabOn" : "dwsd-tab",
						onClick: () => {
							setTab(value);
						},
						children: value === "config" ? t("tabConfig") : t("tabObservability")
					}, value))
				}), tab === "config" ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)(ConfigPage, { t }) : /* @__PURE__ */ (0, react_jsx_runtime.jsx)(ObsPage, { t })]
			});
		}
		//#endregion
		//#region src/client/obs/styles.ts
		/**
		* 观测页样式，`dwsd-obs-*` 前缀；由 `styles.ts` 与卡片样式合并注入。
		*
		* 颜色全部来自 DSH 的 `--dsw-alias-*` token，状态不只靠颜色（圆点 + 文本）。
		*
		* @module dsh-web-search-diy/client/obs/styles
		*/
		const OBS_CSS = [
			".dwsd-page{display:flex;flex-direction:column;min-width:0}",
			".dwsd-tabs{display:flex;gap:16px;border-bottom:.5px solid var(--dsw-alias-border-l2);margin:0 0 8px}",
			".dwsd-tab{appearance:none;background:0 0;border:0;border-bottom:2px solid transparent;color:var(--dsw-alias-label-tertiary);cursor:pointer;font:inherit;font-size:13px;font-weight:500;line-height:1.5;padding:8px 2px;margin-bottom:-1px}",
			".dwsd-tab:hover{color:var(--dsw-alias-label-primary)}",
			".dwsd-tabOn{color:var(--dsw-alias-label-primary);border-bottom-color:var(--dsw-alias-brand-primary)}",
			".dwsd-tab:focus-visible{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:1px}",
			".dwsd-obs{display:flex;flex-direction:column;gap:12px;min-width:0;padding-bottom:8px}",
			".dwsd-obs-toolbar{display:flex;align-items:center;gap:8px;flex-wrap:wrap}",
			".dwsd-obs-toolbarRight{display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-left:auto}",
			".dwsd-obs-segmented{display:inline-flex;background:var(--dsw-alias-bg-layer-4);border-radius:8px;padding:2px;gap:2px}",
			".dwsd-obs-segment{appearance:none;background:0 0;border:0;border-radius:6px;color:var(--dsw-alias-label-secondary);cursor:pointer;font:inherit;font-size:12px;line-height:1.5;padding:4px 10px}",
			".dwsd-obs-segmentOn{background:var(--dsw-alias-bg-layer-3);color:var(--dsw-alias-label-primary);box-shadow:0 1px 2px #00000014}",
			".dwsd-obs-segment:focus-visible,.dwsd-obs-btn:focus-visible,.dwsd-obs-link:focus-visible{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:1px}",
			".dwsd-obs-filter{display:flex;align-items:center;gap:4px;min-width:0}",
			".dwsd-obs-filterGrow{flex:1;min-width:160px}",
			".dwsd-obs-filterLabel{color:var(--dsw-alias-label-tertiary);font-size:12px;white-space:nowrap}",
			".dwsd-obs-input{border:.5px solid var(--dsw-alias-border-l4);background:var(--dsw-alias-bg-layer-3);height:28px;font:inherit;color:var(--dsw-alias-label-primary);border-radius:6px;padding:0 8px;font-size:12px;line-height:1.5;min-width:0}",
			".dwsd-obs-input:focus-visible{border-color:var(--dsw-alias-brand-primary);outline:none}",
			".dwsd-obs-check{display:inline-flex;align-items:center;gap:4px;color:var(--dsw-alias-label-secondary);font-size:12px;cursor:pointer;white-space:nowrap}",
			".dwsd-obs-check input{accent-color:var(--dsw-alias-brand-primary);margin:0}",
			".dwsd-obs-btn{appearance:none;font:inherit;cursor:pointer;border:.5px solid var(--dsw-alias-border-l2);border-radius:6px;color:var(--dsw-alias-label-secondary);background:0 0;padding:3px 10px;font-size:12px;line-height:1.5;text-decoration:none;white-space:nowrap}",
			".dwsd-obs-btn:hover:not(:disabled){color:var(--dsw-alias-label-primary);border-color:var(--dsw-alias-label-dimmed)}",
			".dwsd-obs-btn:disabled{opacity:.4;cursor:default}",
			".dwsd-obs-link{appearance:none;background:0 0;border:0;color:var(--dsw-alias-brand-primary);cursor:pointer;font:inherit;font-size:12px;padding:0}",
			".dwsd-obs-content{display:flex;flex-direction:column;gap:16px}",
			".dwsd-obs-cards{display:grid;grid-template-columns:repeat(auto-fit,minmax(104px,1fr));gap:8px}",
			".dwsd-obs-card{display:flex;flex-direction:column;gap:4px;border:.5px solid var(--dsw-alias-border-l2);border-radius:8px;padding:12px 16px;min-width:0}",
			".dwsd-obs-cardLabel{color:var(--dsw-alias-label-tertiary);font-size:12px;line-height:1.5;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}",
			".dwsd-obs-cardValue{color:var(--dsw-alias-label-primary);font-size:24px;font-weight:600;line-height:1.25;font-variant-numeric:tabular-nums}",
			".dwsd-obs-section{display:flex;flex-direction:column;gap:8px;min-width:0}",
			".dwsd-obs-sectionHead{display:flex;align-items:baseline;justify-content:space-between;gap:8px}",
			".dwsd-obs-sectionTitle{margin:0;color:var(--dsw-alias-label-primary);font-size:14px;font-weight:600;line-height:1.5}",
			".dwsd-obs-caption{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap}",
			".dwsd-obs-tableWrap{overflow-x:auto;border:.5px solid var(--dsw-alias-border-l2);border-radius:8px}",
			".dwsd-obs-table{border-collapse:collapse;width:100%;min-width:600px;font-size:13px;line-height:1.5}",
			".dwsd-obs-table th{position:sticky;top:0;z-index:1;background:var(--dsw-alias-bg-layer-3);color:var(--dsw-alias-label-tertiary);font-size:12px;font-weight:500;letter-spacing:.02em;text-align:left;padding:8px 12px;border-bottom:.5px solid var(--dsw-alias-border-l2);white-space:nowrap}",
			".dwsd-obs-table td{padding:0 12px;height:40px;color:var(--dsw-alias-label-primary);border-bottom:.5px solid var(--dsw-alias-border-l2);vertical-align:middle}",
			".dwsd-obs-table tbody tr:last-child td{border-bottom:0}",
			".dwsd-obs-num{text-align:right;font-variant-numeric:tabular-nums}",
			".dwsd-obs-table th.dwsd-obs-num{text-align:right}",
			".dwsd-obs-clickable{cursor:pointer}",
			".dwsd-obs-clickable:hover td{background:var(--dsw-alias-bg-layer-4)}",
			".dwsd-obs-clickable:focus-visible{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:-2px}",
			".dwsd-obs-targetCell{font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;font-size:12px;white-space:nowrap}",
			".dwsd-obs-timeCell{white-space:nowrap;font-variant-numeric:tabular-nums;color:var(--dsw-alias-label-secondary);position:sticky;left:0;z-index:1;background:var(--dsw-alias-bg-layer-3)}",
			".dwsd-obs-clickable:hover .dwsd-obs-timeCell{background:var(--dsw-alias-bg-layer-4)}",
			".dwsd-obs-queryCell{max-width:260px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}",
			".dwsd-obs-status{display:inline-flex;align-items:center;gap:4px;white-space:nowrap;color:var(--dsw-alias-label-primary);font-size:12px}",
			".dwsd-obs-statusFail{color:var(--dsw-alias-label-error)}",
			".dwsd-obs-dot{width:8px;height:8px;border-radius:50%;flex:none;background:var(--dsw-alias-brand-primary)}",
			".dwsd-obs-dotFail{background:var(--dsw-alias-label-error)}",
			".dwsd-obs-list{list-style:none;margin:0;padding:0;display:flex;flex-direction:column}",
			".dwsd-obs-listRow{display:grid;grid-template-columns:auto minmax(90px,auto) minmax(0,1fr) auto auto;align-items:center;gap:12px;padding:8px 0;border-bottom:.5px solid var(--dsw-alias-border-l2);font-size:13px;min-width:0}",
			".dwsd-obs-listRow:last-child{border-bottom:0}",
			".dwsd-obs-listTime{color:var(--dsw-alias-label-tertiary);font-size:12px;font-variant-numeric:tabular-nums;white-space:nowrap}",
			".dwsd-obs-listTarget{color:var(--dsw-alias-label-secondary);font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;font-size:12px;white-space:nowrap}",
			".dwsd-obs-listQuery{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--dsw-alias-label-primary)}",
			".dwsd-obs-listMeta{color:var(--dsw-alias-label-tertiary);font-size:12px;white-space:nowrap;font-variant-numeric:tabular-nums}",
			".dwsd-obs-filters{display:flex;align-items:flex-end;gap:8px;flex-wrap:wrap}",
			".dwsd-obs-range{position:relative}",
			".dwsd-obs-rangeTrigger{appearance:none;display:inline-flex;align-items:center;gap:6px;height:28px;padding:0 8px;border:.5px solid var(--dsw-alias-border-l4);border-radius:6px;background:var(--dsw-alias-bg-layer-3);color:var(--dsw-alias-label-primary);font:inherit;font-size:12px;line-height:1.5;cursor:pointer;white-space:nowrap}",
			".dwsd-obs-rangeTrigger:hover{border-color:var(--dsw-alias-label-dimmed)}",
			".dwsd-obs-rangeTrigger:focus-visible{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:1px}",
			".dwsd-obs-rangeCaret{color:var(--dsw-alias-label-tertiary);font-size:9px;line-height:1}",
			".dwsd-obs-cal{position:absolute;top:calc(100% + 6px);left:0;z-index:40;width:272px;padding:10px;border:.5px solid var(--dsw-alias-border-l2);border-radius:10px;background:var(--dsw-alias-bg-layer-2);box-shadow:0 10px 28px #00000026;display:flex;flex-direction:column;gap:8px}",
			".dwsd-obs-calPresets{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:4px}",
			".dwsd-obs-calPreset{appearance:none;border:.5px solid var(--dsw-alias-border-l2);border-radius:6px;background:0 0;color:var(--dsw-alias-label-secondary);font:inherit;font-size:12px;line-height:1.5;padding:3px 2px;cursor:pointer;white-space:nowrap}",
			".dwsd-obs-calPreset:hover{color:var(--dsw-alias-label-primary);border-color:var(--dsw-alias-label-dimmed)}",
			".dwsd-obs-calPresetOn{background:var(--dsw-alias-bg-layer-4);border-color:var(--dsw-alias-brand-primary);color:var(--dsw-alias-label-primary);font-weight:500}",
			".dwsd-obs-calPreset:focus-visible,.dwsd-obs-calNav:focus-visible,.dwsd-obs-calDay:focus-visible{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:1px}",
			".dwsd-obs-calHead{display:flex;align-items:center;justify-content:space-between;gap:4px}",
			".dwsd-obs-calTitle{color:var(--dsw-alias-label-primary);font-size:12px;font-weight:600;line-height:1.5}",
			".dwsd-obs-calNav{appearance:none;border:.5px solid transparent;border-radius:6px;background:0 0;color:var(--dsw-alias-label-secondary);cursor:pointer;font:inherit;font-size:16px;line-height:1;width:24px;height:24px;display:inline-flex;align-items:center;justify-content:center;padding:0}",
			".dwsd-obs-calNav:hover{background:var(--dsw-alias-bg-layer-4);color:var(--dsw-alias-label-primary)}",
			".dwsd-obs-calWeek,.dwsd-obs-calGrid{display:grid;grid-template-columns:repeat(7,minmax(0,1fr));gap:2px}",
			".dwsd-obs-calWeek{color:var(--dsw-alias-label-tertiary);font-size:11px;line-height:1.5;text-align:center}",
			".dwsd-obs-calDay{appearance:none;border:.5px solid transparent;border-radius:6px;background:0 0;color:var(--dsw-alias-label-primary);cursor:pointer;font:inherit;font-size:12px;line-height:1.5;height:28px;padding:0;font-variant-numeric:tabular-nums}",
			".dwsd-obs-calDay:hover{background:var(--dsw-alias-bg-layer-4)}",
			".dwsd-obs-calDayOut{color:var(--dsw-alias-label-tertiary)}",
			".dwsd-obs-calDayInRange,.dwsd-obs-calDayInRange:hover{background:var(--dsw-alias-bg-layer-4);border-radius:0}",
			".dwsd-obs-calDayOn,.dwsd-obs-calDayOn:hover{background:var(--dsw-alias-brand-primary);color:#fff}",
			".dwsd-obs-calFoot{display:flex;align-items:center;justify-content:space-between;gap:8px;border-top:.5px solid var(--dsw-alias-border-l2);padding-top:6px}",
			".dwsd-obs-calActions{display:flex;align-items:center;gap:10px;white-space:nowrap}",
			".dwsd-obs-calHint{color:var(--dsw-alias-label-tertiary);font-size:11px;line-height:1.5;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}",
			".dwsd-obs-detailRow td{height:auto;padding:0;background:var(--dsw-alias-bg-layer-4)}",
			".dwsd-obs-detail{display:flex;flex-direction:column;gap:8px;padding:12px 16px;font-size:12px;line-height:1.5}",
			".dwsd-obs-detailError{margin:0;color:var(--dsw-alias-label-error);word-break:break-word}",
			".dwsd-obs-detailQuery{margin:0;color:var(--dsw-alias-label-primary);word-break:break-word}",
			".dwsd-obs-answer{margin:0;padding:8px 12px;border-radius:6px;background:var(--dsw-alias-bg-layer-3);color:var(--dsw-alias-label-primary);font:inherit;font-size:12px;line-height:1.7;white-space:pre-wrap;word-break:break-word;max-height:240px;overflow:auto}",
			".dwsd-obs-sourceItem{display:flex;flex-direction:column;gap:2px;min-width:0;padding:4px 0;border-bottom:.5px solid var(--dsw-alias-border-l2)}",
			".dwsd-obs-sourceItem:last-child{border-bottom:0}",
			".dwsd-obs-sourceHead{display:flex;align-items:center;gap:8px;flex-wrap:wrap;min-width:0}",
			".dwsd-obs-sourceTitle{color:var(--dsw-alias-brand-primary);font-size:12px;line-height:1.5;word-break:break-word;text-decoration:none}",
			".dwsd-obs-sourceTitle:hover{text-decoration:underline}",
			".dwsd-obs-sourceText{margin:0;color:var(--dsw-alias-label-secondary);font-size:12px;line-height:1.6;white-space:pre-wrap;word-break:break-word;max-height:96px;overflow:hidden}",
			".dwsd-obs-detailMeta{display:flex;flex-wrap:wrap;gap:4px 16px;color:var(--dsw-alias-label-tertiary);font-variant-numeric:tabular-nums}",
			".dwsd-obs-detailTitle{margin:0;color:var(--dsw-alias-label-secondary);font-weight:500}",
			".dwsd-obs-sourceList{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:4px}",
			".dwsd-obs-sourceRow{display:flex;align-items:center;gap:8px;flex-wrap:wrap;min-width:0}",
			".dwsd-obs-sourceHost{color:var(--dsw-alias-label-primary);font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;font-size:12px;word-break:break-all}",
			".dwsd-obs-sourceHash{color:var(--dsw-alias-label-tertiary);font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;font-size:11px}",
			".dwsd-obs-marks{display:inline-flex;gap:4px;flex-wrap:wrap}",
			".dwsd-obs-mark{background:var(--dsw-alias-bg-layer-3);color:var(--dsw-alias-label-secondary);border-radius:999px;padding:0 6px;font-size:11px;line-height:17px;white-space:nowrap}",
			".dwsd-obs-detailActions{display:flex;gap:8px;justify-content:flex-end}",
			".dwsd-obs-more{display:flex;justify-content:center;padding:8px}",
			".dwsd-obs-pager{display:flex;align-items:center;gap:8px;flex-wrap:wrap;padding:8px 2px;font-size:12px;line-height:1.5}",
			".dwsd-obs-pageNav{display:flex;align-items:center;gap:4px;flex-wrap:wrap}",
			".dwsd-obs-pageBtn,.dwsd-obs-pageArrow{appearance:none;display:inline-flex;align-items:center;justify-content:center;min-width:28px;height:28px;padding:0 6px;border:.5px solid var(--dsw-alias-border-l4);border-radius:6px;background:var(--dsw-alias-bg-layer-3);color:var(--dsw-alias-label-primary);font:inherit;font-size:12px;line-height:1.5;font-variant-numeric:tabular-nums;cursor:pointer}",
			".dwsd-obs-pageBtn:hover:not(:disabled),.dwsd-obs-pageArrow:hover:not(:disabled){border-color:var(--dsw-alias-label-dimmed)}",
			".dwsd-obs-pageBtnOn,.dwsd-obs-pageBtnOn:hover:not(:disabled){border-color:var(--dsw-alias-brand-primary);color:var(--dsw-alias-brand-primary)}",
			".dwsd-obs-pageBtn:disabled,.dwsd-obs-pageArrow:disabled{opacity:.4;cursor:default}",
			".dwsd-obs-pageBtn:focus-visible,.dwsd-obs-pageArrow:focus-visible{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:1px}",
			".dwsd-obs-pageGap{min-width:20px;text-align:center;color:var(--dsw-alias-label-tertiary)}",
			".dwsd-obs-pageSize{width:96px;padding:0 6px}",
			".dwsd-obs-pageJump{display:flex;align-items:center;gap:4px;color:var(--dsw-alias-label-secondary);white-space:nowrap}",
			".dwsd-obs-pageJumpInput{width:56px;padding:0 6px}",
			".dwsd-obs-empty{display:flex;flex-direction:column;align-items:center;gap:4px;padding:32px 16px;text-align:center;border:.5px dashed var(--dsw-alias-border-l2);border-radius:8px}",
			".dwsd-obs-emptyIcon{color:var(--dsw-alias-label-tertiary);font-size:24px;line-height:1}",
			".dwsd-obs-emptyTitle{margin:4px 0 0;color:var(--dsw-alias-label-primary);font-size:14px;font-weight:500}",
			".dwsd-obs-hint{margin:0;color:var(--dsw-alias-label-tertiary);font-size:12px;line-height:1.5}",
			".dwsd-obs-skeletonRows{display:flex;flex-direction:column;gap:8px}",
			".dwsd-obs-skeleton{display:block;border-radius:6px;background:var(--dsw-alias-bg-layer-4);animation:dwsd-obs-pulse 1.2s ease-in-out infinite}",
			".dwsd-obs-skeletonLabel{width:60%;height:12px}",
			".dwsd-obs-skeletonValue{width:80%;height:24px}",
			".dwsd-obs-skeletonRow{width:100%;height:36px}",
			"@keyframes dwsd-obs-pulse{0%,100%{opacity:.55}50%{opacity:.9}}",
			".dwsd-obs-banner{display:flex;align-items:center;gap:8px;justify-content:space-between;border:.5px solid var(--dsw-alias-label-error);border-radius:8px;padding:8px 12px}",
			".dwsd-obs-bannerText{color:var(--dsw-alias-label-error);font-size:12px;line-height:1.5;min-width:0;word-break:break-word}",
			".dwsd-obs-toast{position:fixed;left:50%;bottom:24px;transform:translateX(-50%);background:var(--dsw-alias-label-primary);color:var(--dsw-alias-bg-layer-3);border-radius:8px;padding:6px 14px;font-size:12px;line-height:1.5;z-index:50;pointer-events:none}",
			".dwsd-obs-data{border-top:.5px solid var(--dsw-alias-border-l2);padding-top:8px;margin-top:4px}",
			".dwsd-obs-data>summary{cursor:pointer;color:var(--dsw-alias-label-secondary);font-size:13px;line-height:1.5;padding:4px 0}",
			".dwsd-obs-data>summary:focus-visible{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:2px}",
			".dwsd-obs-clearRow{display:flex;align-items:center;gap:8px;margin:8px 0 4px}",
			".dwsd-obs-chart{position:relative;border:.5px solid var(--dsw-alias-border-l2);border-radius:8px;padding:8px}",
			".dwsd-obs-chart svg{display:block;width:100%;height:160px}",
			".dwsd-obs-chartGrid{stroke:var(--dsw-alias-border-l2);stroke-width:1}",
			".dwsd-obs-chartAxis{stroke:var(--dsw-alias-border-l4);stroke-width:1}",
			".dwsd-obs-chartArea{fill:var(--dsw-alias-brand-primary);opacity:.08}",
			".dwsd-obs-chartSuccess{fill:none;stroke:var(--dsw-alias-brand-primary);stroke-width:2}",
			".dwsd-obs-chartP95{fill:none;stroke:var(--dsw-alias-label-secondary);stroke-width:2;stroke-dasharray:4 3}",
			".dwsd-obs-chartDot{fill:var(--dsw-alias-brand-primary)}",
			".dwsd-obs-chartHit{fill:transparent}",
			".dwsd-obs-chartHit:hover{fill:var(--dsw-alias-bg-layer-4);opacity:.5}",
			".dwsd-obs-chartTicks{display:flex;justify-content:space-between;color:var(--dsw-alias-label-tertiary);font-size:11px;padding:0 24px}",
			".dwsd-obs-chartTip{position:absolute;top:16px;left:50%;transform:translateX(-50%);background:var(--dsw-alias-bg-layer-3);border:.5px solid var(--dsw-alias-border-l4);border-radius:6px;padding:6px 10px;display:flex;gap:12px;font-size:12px;color:var(--dsw-alias-label-primary);pointer-events:none;white-space:nowrap;font-variant-numeric:tabular-nums}",
			".dwsd-obs-chartEmpty{display:flex;flex-direction:column;gap:4px;align-items:center}",
			".dwsd-obs-chartEmpty svg{height:120px}",
			".dwsd-obs-legend{display:inline-flex;gap:12px;color:var(--dsw-alias-label-secondary);font-size:12px}",
			".dwsd-obs-legendItem{display:inline-flex;align-items:center;gap:4px}",
			".dwsd-obs-legendLine{width:16px;height:2px;display:inline-block;background:var(--dsw-alias-brand-primary)}",
			".dwsd-obs-legendP95{height:0;background:0 0;border-top:2px dashed var(--dsw-alias-label-secondary)}",
			"@media (max-width:768px){.dwsd-obs-colSummary{display:none}.dwsd-obs-table td,.dwsd-obs-table th{padding-left:8px;padding-right:8px}.dwsd-obs-queryCell{max-width:140px}.dwsd-obs-chartTip{position:static;transform:none;margin-top:8px;justify-content:center}}",
			"@media (max-width:480px){.dwsd-obs-toolbarRight{width:100%;margin-left:0}.dwsd-obs-listRow{grid-template-columns:auto minmax(0,1fr) auto auto}.dwsd-obs-listQuery{display:none}}",
			"@media (prefers-reduced-motion:reduce){.dwsd-obs-skeleton{animation:none}}"
		].join("");
		/** 卡片样式与观测页样式在同一个 style 标签里注入。 */
		const CARD_CSS = [
			".dwsd-body{margin:0;padding-bottom:8px}",
			".dwsd-status{color:var(--dsw-alias-label-tertiary);margin:12px 0 0;font-size:12px;line-height:1.5}",
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
			".dwsd-choiceDisabled{opacity:.5;cursor:default}",
			".dwsd-choiceLabel{color:var(--dsw-alias-label-primary);font-size:13px;line-height:1.5}",
			".dwsd-choiceReason{color:var(--dsw-alias-label-tertiary);margin-left:8px;font-size:12px;line-height:1.5}",
			".dwsd-combo{position:relative;align-items:center;gap:6px;display:flex}",
			".dwsd-combo .dwsd-input{flex:1;min-width:0}",
			".dwsd-comboToggle{border:.5px solid var(--dsw-alias-border-l4);background:var(--dsw-alias-bg-layer-3);color:var(--dsw-alias-label-secondary);border-radius:8px;cursor:pointer;font:inherit;padding:0 10px;height:34px;line-height:1}",
			".dwsd-comboToggle:hover{color:var(--dsw-alias-label-primary)}",
			".dwsd-comboList{z-index:20;background:var(--dsw-alias-bg-layer-3);border:.5px solid var(--dsw-alias-border-l4);border-radius:8px;max-height:240px;margin:0;padding:4px;list-style:none;position:absolute;top:38px;left:0;right:0;overflow:auto}",
			".dwsd-comboList button{background:0 0;border:0;border-radius:6px;color:var(--dsw-alias-label-primary);cursor:pointer;font:inherit;font-size:13px;line-height:1.5;padding:6px 8px;text-align:left;width:100%}",
			".dwsd-comboList button:hover{background:var(--dsw-alias-bg-layer-4)}",
			".dwsd-switchRow{color:var(--dsw-alias-label-primary);justify-content:space-between;align-items:center;gap:16px;font-size:13px;line-height:1.5;display:flex}",
			".dwsd-switch{box-sizing:border-box;background:var(--dsw-alias-border-l3);cursor:pointer;border:0;border-radius:10px;flex:none;width:36px;height:20px;padding:2px;position:relative}",
			".dwsd-switchOn{background:var(--dsw-alias-brand-primary)}",
			".dwsd-switch:disabled{cursor:default;opacity:.5}",
			".dwsd-switch:focus-visible{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:2px}",
			".dwsd-thumb{background:var(--dsw-alias-label-primary-foreground);border-radius:50%;width:16px;height:16px;transition:transform .12s;display:block}",
			".dwsd-switchOn .dwsd-thumb{transform:translate(16px)}",
			".dwsd-advanced{margin-top:4px}",
			".dwsd-advanced>summary{cursor:pointer;color:var(--dsw-alias-label-secondary);font-size:13px;line-height:1.5;padding:8px 0}",
			".dwsd-advanced>summary:focus-visible{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:2px}",
			".dwsd-notice{margin:0 0 4px;color:var(--dsw-alias-label-tertiary);font-size:12px;line-height:1.5}",
			".dwsd-confirm{display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-top:8px}"
		].join("") + OBS_CSS;
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
		/**
		* Every dictionary the locale service can select, keyed by the DSH language
		* ids. Registration hands the whole map to `ctx.locale.register`, so a
		* language added here becomes available to the card without touching the page.
		*/
		const ALL_LOCALES = {
			zh: {
				description: "多协议网页搜索：协议内置（Chat Completions / Responses / Anthropic Messages）与纯工具搜索，按厂商选择。",
				loading: "正在读取配置…",
				loadFailed: "读取配置失败；请确认插件服务可用后重试。",
				unsaved: "未保存",
				save: "保存",
				saving: "保存中…",
				discard: "放弃修改",
				shape: "搜索方式",
				shapeInProtocol: "协议内置搜索",
				shapeStandalone: "纯工具搜索",
				protocol: "协议",
				vendor: "厂商",
				advanced: "高级选项",
				fieldPlaceholder: "留空使用默认值",
				unsupported: "不支持",
				full: "完整",
				degraded: "降级",
				custom: "自定义",
				unsupportedVendors: "本版未接入的组合（不代表该厂商整体不可用）",
				customNotice: "自定义接入需自行确认网关行为；保存后可直接测试。",
				fillFromTemplate: "从模板填充（仅供参考）",
				templateFillHint: "选择模板只把该厂商的默认值填入下面的配置项；模板本身不会保存，选完下拉会清空。",
				templatePlaceholder: "选择模板…",
				templateUsed: "刚才用了：{name}",
				templateOverwrite: "选择「{name}」会用它覆盖当前配置（包括已保存的值）",
				templateApply: "应用模板",
				templateCancel: "取消",
				resetToSaved: "重置为已保存配置",
				test: "测试连接",
				testing: "测试中…",
				testOk: "连接成功",
				testFailed: "测试失败",
				testSources: "个来源",
				testDegraded: "降级组合",
				testNoSourcesByDesign: "该组合不返回来源",
				testNoSourcesPartial: "未返回来源：可能搜索未执行，或本次没有可引用页面",
				testNoSourcesFull: "未返回来源，请检查搜索工具名与端点",
				modelLockedHint: "该组合只支持此模型，不可修改。",
				apiKey: "API 密钥",
				apiKeyHint: "经凭据服务只写存储（~/.dsh/.credentials.yaml），不写入配置文件。留空表示保持当前密钥。",
				apiKeySet: "已配置密钥",
				apiKeyUnset: "未配置密钥",
				apiKeyByReference: "取决于凭据引用",
				invalidPositive: "请填正整数；留空使用默认值。",
				invalidRange: "请填 1-{max} 的整数；留空使用默认值。",
				invalidRefName: "请填合法的凭据引用名（字母或下划线开头，仅字母、数字、下划线）。",
				invalidJson: "请填 JSON 对象；留空不发送。",
				protocolChat: "Chat Completions",
				protocolResponses: "Responses",
				protocolAnthropic: "Anthropic Messages",
				protocolSearch: "纯工具搜索",
				vendorDeepseek: "DeepSeek",
				vendorKimi: "Kimi",
				vendorZhipu: "智谱",
				vendorQwen: "千问",
				vendorOpenai: "OpenAI",
				vendorAnthropic: "Anthropic",
				vendorOpenrouter: "OpenRouter",
				vendorCustom: "自定义",
				opt_thinking_default: "default（跟随模型）",
				opt_thinking_disabled: "disabled（关闭思考，更快更省）",
				opt_effort_empty: "不传（跟随模型）",
				opt_effort_low: "low（低）",
				opt_effort_medium: "medium（中）",
				opt_effort_high: "high（高）",
				opt_effort_xhigh: "xhigh（超高）",
				opt_effort_max: "max（最高）",
				opt_searchEngine_search_std: "search_std（智谱自研 · 基础）",
				opt_searchEngine_search_pro: "search_pro（智谱自研 · 高级）",
				opt_searchEngine_search_pro_sogou: "search_pro_sogou（搜狗）",
				opt_searchEngine_search_pro_quark: "search_pro_quark（夸克）",
				opt_searchRecencyFilter_noLimit: "不限",
				opt_searchRecencyFilter_oneDay: "一天内",
				opt_searchRecencyFilter_oneWeek: "一周内",
				opt_searchRecencyFilter_oneMonth: "一月内",
				opt_searchRecencyFilter_oneYear: "一年内",
				opt_contentSize_medium: "medium（摘要）",
				opt_contentSize_high: "high（详细）",
				opt_searchStrategy_turbo: "turbo（极速）",
				opt_searchStrategy_max: "max（深度）",
				opt_searchStrategy_agent: "agent（智能体）",
				opt_searchStrategy_agent_max: "agent_max（智能体 · 深度）",
				opt_freshness_empty: "不传",
				opt_freshness_noLimit: "不限",
				opt_freshness_oneDay: "一天内",
				opt_freshness_oneWeek: "一周内",
				opt_freshness_oneMonth: "一月内",
				opt_freshness_oneYear: "一年内",
				opt_searchContextSize_low: "low（少量）",
				opt_searchContextSize_medium: "medium（均衡）",
				opt_searchContextSize_high: "high（更多）",
				opt_externalWebAccess_empty: "跟随端点默认（开启）",
				opt_externalWebAccess_true: "true（实时联网）",
				opt_externalWebAccess_false: "false（仅缓存/索引）",
				opt_returnTokenBudget_empty: "不传",
				opt_returnTokenBudget_default: "default（默认预算）",
				opt_returnTokenBudget_unlimited: "unlimited（不设上限）",
				opt_responseInclusion_empty: "默认（full）",
				opt_responseInclusion_full: "full（完整返回）",
				opt_responseInclusion_excluded: "excluded（省略已消费块）",
				hint_baseURL: "接口地址前缀，可填官方或自建网关。留空使用该组合的官方默认端点；协议路径由插件拼接，不要重复写 /responses 之类的路径。",
				hint_apiKeyEnv: "凭据引用名，即凭据服务或环境变量里的键名。留空使用该组合的默认引用链（如 ZAI_CODING_CN_API_KEY → ZHIPU_API_KEY）。",
				hint_requestTimeoutMs: "单次搜索的本地超时。超时记为 WEB_PROVIDER_TIMEOUT，而不是等待工具层的统一取消；留空用 25000，配置页测试连接默认 60000。",
				hint_model: "模型名，必须属于该端点且支持内置搜索。留空用组合默认模型；模型不支持搜索时请求不会执行搜索。",
				hint_maxOutputTokens: "单次搜索回合的输出上限（推理 + 工具调用 + 回答）。只是上限、不预扣费；设得过小会截断回合，导致搜索轮次被砍。",
				hint_toolType: "tools[] 里声明的搜索工具名，决定端点是否执行搜索。默认值按厂商给出；可从下拉选择常用写法，也可手填网关自定义的名称。填错时响应里没有搜索块。",
				hint_includeSources: "向端点请求完整来源列表（include）。OpenAI 官方该字段是 include-only，关闭后只剩少量引用注解；不支持该参数的网关可关闭。",
				hint_reasoningEffort: "推理档位（reasoning.effort）。档位集合因模型而异，不支持时返回 400，插件会自动去掉该参数重试；留空不发送。",
				hint_searchContextSize: "搜索结果注入模型的上下文量：low 省 token、medium 均衡、high 更完整。通常影响时延与费用，不保证来源数量。",
				hint_allowedDomains: "只返回这些域名的结果，逗号分隔，不带 https:// 前缀。OpenAI 最多 100 个；与 blockedDomains 互斥（Anthropic 同时发会 400，插件优先 allowed）。",
				hint_blockedDomains: "屏蔽这些域名，逗号分隔，不带协议前缀。与 allowedDomains 互斥；各厂商支持程度不同，不支持时会被忽略。",
				hint_excludedDomains: "排除这些域名（OpenRouter）。部分引擎与 allowedDomains 互斥：Exa 可同时使用，其他引擎可能返回 400。",
				hint_userLocation: "两字母国家代码（如 US），用于地域偏置。部分端点支持，不支持时忽略；Anthropic 还支持城市/时区，这里只开放国家码。",
				hint_maxUses: "单次请求最多调用几次搜索工具。达到后端点返回错误结果而不是继续搜索，用于控制费用与时延。",
				hint_thinking: "default 跟随模型；disabled 关闭思考，更快更省。部分模型始终思考，传 disabled 会 400，插件会去掉该开关重试。",
				hint_effort: "Anthropic 的 output_config.effort 档位。不同模型支持的档位不同，被拒时插件自动去掉重试；留空不发送。",
				hint_searchEngine: "智谱搜索引擎，单价与能力不同：std 基础、pro 高级、sogou 与夸克各有配额和结果限制。",
				hint_searchEngineCustom: "搜索引擎取值由网关定义。这里只列常见写法：智谱 search_std / search_pro，OpenRouter auto / exa / perplexity，自建 searxng / google / bing 等；可直接输入其他值。智谱模板留空时按 search_std 发送（该接口必填），非智谱模板不使用此参数。",
				hint_count: "结果条数：智谱与 DeepSeek 为 1-50，Kimi 为 1-20（超出会被钳制）。seam 请求带 maxResults 时优先用请求值，配置值只在请求未指定时生效；它与「摘要条数」相互独立。",
				hint_searchRecencyFilter: "只返回该时间窗内发布的网页。窗口越窄召回越少，但对时效性问题更准。",
				hint_contentSize: "摘要长度：medium 短摘要省 token，high 提供更详细正文但费用更高。",
				hint_searchDomainFilter: "限定来源域名，逗号分隔，不带协议前缀。留空不限；部分引擎不支持该参数，会被忽略。",
				hint_requireSearch: "没有搜索结果时拒绝作答，保证回答来自实时检索。默认关闭；开启后可能因无结果直接失败，而不是用模型知识回答。",
				hint_searchPrompt: "结果融合提示词，控制如何把搜索内容整合进回答。留空使用官方默认。",
				hint_searchStrategy: "千问搜索策略：turbo 极速、max 深度、agent/agent_max 智能体。策略越深越慢、费用越高。",
				hint_forcedSearch: "强制本次请求执行搜索，即使模型判断不需要。用于必须联网的场景。",
				hint_freshness: "只返回该时间窗内的结果（千问）。留空不限制；与智谱时间范围字段语义相同。",
				hint_assignedSiteList: "限定站点列表，逗号分隔（千问）。留空不限；与智谱的域名限定作用类似。",
				hint_searchExtension: "千问的搜索扩展参数，原样透传。留空不发送；具体取值以千问文档为准。",
				hint_promptIntervene: "千问的提示词干预参数，原样透传。留空不发送；非必要不建议修改。",
				hint_engine: "OpenRouter 搜索引擎：auto 自动（有原生则用原生，否则 Exa）、native 模型自带、exa/firecrawl/parallel/perplexity 第三方。不同引擎计费与能力不同。",
				hint_mode: "引擎专属模式：Exa 为 instant/fast/auto/deep-lite/deep/deep-reasoning，Parallel 为 turbo/fast/basic/advanced。留空用引擎默认。",
				hint_maxCharacters: "单条结果的正文/摘要字符上限。与 searchContextSize 同时设置时本项优先；留空由引擎自适应。",
				hint_externalWebAccess: "是否抓取实时网页：留空跟随端点默认（开启），false 只用缓存/索引，适合需要可复现结果或合规限制的场景。",
				hint_returnTokenBudget: "单次搜索允许返回的内容预算：default 标准、unlimited 不设上限（更慢更贵）。仅 GPT-5+ 推理模型支持。",
				hint_searchContentTypes: "请求的结果类型，逗号分隔：text 文本、image 图片。含 image 时同时返回图片结果，需要配合图片结果数与说明。",
				hint_imageMaxResults: "图片结果数量。0 或不填表示不请求图片；仅在搜索内容类型含 image 时生效。",
				hint_imageCaption: "为图片结果请求简短说明。开启后便于筛选与展示，响应体略大。",
				hint_responseInclusion: "搜索结果块在响应中的呈现：full 完整返回、excluded 省略已被代码执行消费的块以节省输出 token。仅 web_search_20260318+ 支持。",
				hint_xSearch: "OpenRouter 与 xAI 的 X/Twitter 搜索参数，JSON 对象，如 {\"allowed_x_handles\":[\"OpenRouterAI\"]}。留空关闭。",
				hint_maxResults: "单次搜索返回的结果上限（OpenRouter 1-25，部分引擎 1-20）。与 maxTotalResults 配合控制成本与上下文。",
				hint_maxTotalResults: "一次请求内所有搜索累计的结果上限。达到后端点提示模型停止继续搜索。",
				hint_includeContent: "同时返回网页正文。会显著增加响应体与 token 消耗；只需要标题与摘要时保持关闭。智谱模板下开启会把 `content_size` 固定为 high，需要自定义摘要长度时关闭本开关。",
				hint_digestEntries: "拼给调用方的 content 摘要最多包含几条结果（1-20）。只影响摘要文本，不裁剪 sources；留空用默认 8。",
				hint_digestSnippetChars: "摘要里每条结果最多保留多少字符（1-2000），超出部分截断；留空用默认 200。",
				hint_timeoutSeconds: "请求超时秒数（Kimi 1-60）。超时后本次搜索失败；长查询可适当调高。",
				hint_oriQuestion: "附带本次触发搜索的用户原话（折叠空白、截断 128 字符），便于 DeepSeek 理解搜索意图。无会话或找不到提问时自动省略；仅 DeepSeek 模板发送。",
				hint_localization: "本地化 IP，用于地域排序。仅接受合法 IPv4/IPv6；留空或填非法值都不发送。",
				hint_path: "请求路径，相对 baseURL。自定义网关必填；内置 target 由协议固定，一般不改。",
				hint_queryField: "请求体里查询字段的名字。留空用模板默认（智谱 search_query、DeepSeek query、Kimi text_query）。",
				hint_countField: "请求体里条数字段的名字。留空用模板默认（智谱与 DeepSeek 为 count、Kimi 为 limit）。",
				hint_resultsPath: "响应里结果数组的点路径，如 data.items。留空用模板默认（智谱 search_result、DeepSeek results、Kimi search_results）。",
				hint_urlField: "结果项里 URL 字段的名字。留空用模板默认（智谱 link，其余 url）。",
				hint_titleField: "结果项里标题字段的名字。留空用模板默认（title）。",
				hint_snippetField: "结果项里摘要字段的名字。留空用模板默认（智谱 content，其余 snippet）。",
				hint_dateField: "结果项里日期字段的名字。留空表示不解析日期；仅当响应包含日期字段时填写。",
				hint_contentField: "结果项里长正文字段的名字。正文写入来源摘要（单条上限 2000 字符，与 snippet 相同则省略），snippet 为空时也作为 content 摘要兜底；留空回退到 summary 字段。",
				field_baseURL: "接口地址",
				field_apiKeyEnv: "凭据引用",
				field_requestTimeoutMs: "请求超时（毫秒）",
				field_model: "模型",
				field_maxOutputTokens: "输出上限",
				field_count: "结果条数",
				field_maxUses: "搜索次数上限",
				field_searchEngine: "搜索引擎",
				field_searchRecencyFilter: "时间范围",
				field_contentSize: "摘要长度",
				field_searchDomainFilter: "域名限定",
				field_requireSearch: "强制搜索",
				field_searchPrompt: "搜索提示词",
				field_reasoningEffort: "思考强度",
				field_thinking: "思考模式",
				field_effort: "思考档位",
				field_includeSources: "请求完整来源",
				field_includeContent: "返回正文",
				field_digestEntries: "摘要条数",
				field_digestSnippetChars: "摘要每条字符上限",
				field_timeoutSeconds: "超时秒数",
				field_oriQuestion: "原始问题",
				field_localization: "本地化 IP",
				field_path: "请求路径",
				field_template: "兼容模板",
				field_toolType: "搜索工具名",
				field_queryField: "查询字段名",
				field_countField: "条数字段名",
				field_resultsPath: "结果数组路径",
				field_urlField: "URL 字段名",
				field_titleField: "标题字段名",
				field_snippetField: "摘要字段名",
				field_dateField: "日期字段名",
				field_contentField: "正文字段名",
				field_searchContextSize: "搜索上下文大小",
				field_allowedDomains: "允许域名",
				field_blockedDomains: "屏蔽域名",
				field_excludedDomains: "排除域名",
				field_userLocation: "用户地区",
				field_engine: "搜索引擎",
				field_mode: "引擎模式",
				field_maxCharacters: "单结果最大字符数",
				field_externalWebAccess: "实时联网",
				field_returnTokenBudget: "返回 token 预算",
				field_searchContentTypes: "搜索内容类型",
				field_imageMaxResults: "图片结果数",
				field_imageCaption: "图片说明",
				field_responseInclusion: "响应包含模式",
				field_xSearch: "X 搜索参数（JSON）",
				field_maxResults: "单次结果数",
				field_maxTotalResults: "总结果数",
				field_searchStrategy: "搜索策略",
				field_forcedSearch: "强制搜索",
				field_freshness: "时间范围",
				field_assignedSiteList: "限定站点",
				field_searchExtension: "搜索扩展",
				field_promptIntervene: "提示词干预",
				tabNav: "插件导航",
				tabConfig: "配置",
				tabObservability: "观测",
				obsOverview: "概览",
				obsRecords: "记录",
				obsRange: "时间范围",
				obsRange_all: "全部",
				obsTargetFilter: "target",
				obsAllTargets: "全部 target",
				obsIncludeTests: "包含测试连接",
				obsRefresh: "刷新",
				obsRefreshing: "刷新中…",
				obsExportJsonl: "导出 JSONL",
				obsExportCsv: "导出 CSV",
				obsMetricCount: "搜索次数",
				obsMetricSuccess: "成功率",
				obsMetricP95: "P95 耗时",
				obsMetricSources: "平均来源",
				obsMetricSummary: "摘要覆盖",
				obsTargetRanking: "Target 排行",
				obsEmpty: "还没有搜索记录",
				obsEmptyHint: "用当前配置运行一次测试连接，或等待下一次真实搜索。",
				obsEmptyFiltered: "没有符合条件的记录",
				obsEmptyFilteredHint: "调整时间范围、target 或状态筛选后再试。",
				obsClearFilters: "清除筛选",
				obsNoData: "暂无数据",
				obsTableTime: "时间",
				obsTableTarget: "target",
				obsTableQuery: "搜索词",
				obsTableDuration: "耗时",
				obsTableSources: "来源数",
				obsTableSummary: "摘要数",
				obsTableStatus: "状态",
				obsTableErrors: "错误",
				obsStatusOk: "成功",
				obsStatusFail: "失败",
				obsFilterStatus: "状态",
				obsAllStatuses: "全部状态",
				obsFilterQuery: "搜索词",
				obsFilterQueryHint: "按搜索词筛选，回车应用",
				obsLoadMore: "加载更多",
				obsLoadingMore: "加载中…",
				obsDetailsError: "错误",
				obsDetailsSources: "来源明细",
				obsDetailsKind: "类型",
				obsDetailsAnswer: "答案字符",
				obsDetailsRecordId: "记录 ID",
				obsDetailsSession: "会话",
				obsSourceSummary: "摘要",
				obsSourceSnippet: "快照",
				obsSourceNoTitle: "无标题",
				obsSourceNoHost: "无主机名",
				obsCopyJson: "复制 JSON",
				obsCopied: "已复制",
				obsCopyFailed: "复制失败",
				obsDataManagement: "数据管理",
				obsClearHint: "清空会删除全部观测记录，不可撤销。输入 DELETE 确认。",
				obsClearPlaceholder: "输入 DELETE",
				obsClear: "清空观测数据",
				obsClearing: "清空中…",
				obsCleared: "已清空 {count} 条记录",
				obsRecordsCaption: "搜索记录",
				obsTrend: "趋势",
				obsTrendSuccess: "成功率",
				obsTrendP95: "P95 耗时",
				obsTrendAria: "近 {buckets} 个时间桶，成功率 {min}–{max}",
				obsApplyFilters: "应用",
				obsDetailsQuery: "搜索词",
				obsAnswerEmpty: "该记录没有答案文本",
				obsRange_today: "今天",
				obsRange_week: "本周",
				obsRange_month: "本月",
				obsRange_quarter: "本季度",
				obsRange_year: "全年",
				obsImport: "导入历史搜索",
				obsImportHint: "扫描本地会话日志，把旧版本留下的 web_search 记录补进观测库；重复导入只补新增。",
				obsImporting: "导入中…",
				obsImportDone: "扫描 {sessions} 个会话，导入 {imported} 条（识别 target {identified} 条），更新 {updated} 条，已存在 {skipped} 条，范围外 {filtered} 条",
				obsRange_24h: "24 小时",
				obsRange_7d: "7 天",
				obsRange_30d: "30 天",
				obsRangeSince: "自 {date} 起",
				obsCalendarPrev: "上个月",
				obsCalendarNext: "下个月",
				obsRangeUntilNow: "至今",
				obsRangePickEnd: "再选结束日期",
				obsPrevPage: "上一页",
				obsNextPage: "下一页",
				obsPageNumber: "第 {page} 页",
				obsPageSize: "{size} 条/页",
				obsPageJump: "跳至",
				obsPageUnit: "页",
				obsPageSizeLabel: "每页条数",
				obsImportRange: "导入范围",
				obsHistoricalTarget: "历史记录"
			},
			en: {
				description: "Multi-protocol web search: in-protocol (Chat Completions / Responses / Anthropic Messages) and standalone search, selected by vendor.",
				loading: "Reading the configuration…",
				loadFailed: "The configuration could not be read; retry once the plugin service is available.",
				unsaved: "Unsaved",
				save: "Save",
				saving: "Saving…",
				discard: "Discard",
				shape: "Search kind",
				shapeInProtocol: "In-protocol search",
				shapeStandalone: "Standalone search",
				protocol: "Protocol",
				vendor: "Vendor",
				advanced: "Advanced",
				fieldPlaceholder: "Blank uses the default",
				unsupported: "Unsupported",
				full: "Full",
				degraded: "Degraded",
				custom: "Custom",
				unsupportedVendors: "Combinations not wired in this build (the vendor may still work in another protocol)",
				customNotice: "Custom endpoints are your responsibility; test after saving.",
				fillFromTemplate: "Prefill from a template (reference only)",
				templateFillHint: "Picking a template only fills the fields below; the template itself is not saved and the picker resets after use.",
				templatePlaceholder: "Pick a template…",
				templateUsed: "Last used: {name}",
				templateOverwrite: "\"{name}\" will overwrite the current configuration (including saved values)",
				templateApply: "Apply template",
				templateCancel: "Cancel",
				resetToSaved: "Reset to saved configuration",
				test: "Test",
				testing: "Testing…",
				testOk: "Connected",
				testFailed: "Test failed",
				testSources: "sources",
				testDegraded: "degraded",
				testNoSourcesByDesign: "this combination returns no sources",
				testNoSourcesPartial: "no sources: the search may not have run, or this run had no citable page",
				testNoSourcesFull: "no sources returned; check the tool name and endpoint",
				modelLockedHint: "This combination only supports this model; it cannot be changed.",
				apiKey: "API key",
				apiKeyHint: "Stored through the credentials service (~/.dsh/.credentials.yaml), never in the config file. Leave blank to keep the current key.",
				apiKeySet: "Key configured",
				apiKeyUnset: "No key",
				apiKeyByReference: "Depends on the credential reference",
				invalidPositive: "Enter a positive integer, or leave blank for the default.",
				invalidRange: "Enter an integer from 1 to {max}, or leave blank for the default.",
				invalidRefName: "Enter a valid credential reference name (letter or underscore first; letters, digits and underscores only).",
				invalidJson: "Enter a JSON object, or leave blank to omit it.",
				protocolChat: "Chat Completions",
				protocolResponses: "Responses",
				protocolAnthropic: "Anthropic Messages",
				protocolSearch: "Standalone search",
				vendorDeepseek: "DeepSeek",
				vendorKimi: "Kimi",
				vendorZhipu: "Zhipu",
				vendorQwen: "Qwen",
				vendorOpenai: "OpenAI",
				vendorAnthropic: "Anthropic",
				vendorOpenrouter: "OpenRouter",
				vendorCustom: "Custom",
				opt_thinking_default: "default (follow model)",
				opt_thinking_disabled: "disabled (thinking off, faster)",
				opt_effort_empty: "not sent (follow model)",
				opt_effort_low: "low",
				opt_effort_medium: "medium",
				opt_effort_high: "high",
				opt_effort_xhigh: "xhigh",
				opt_effort_max: "max",
				opt_searchEngine_search_std: "search_std (Zhipu basic)",
				opt_searchEngine_search_pro: "search_pro (Zhipu advanced)",
				opt_searchEngine_search_pro_sogou: "search_pro_sogou (Sogou)",
				opt_searchEngine_search_pro_quark: "search_pro_quark (Quark)",
				opt_searchRecencyFilter_noLimit: "No limit",
				opt_searchRecencyFilter_oneDay: "Past day",
				opt_searchRecencyFilter_oneWeek: "Past week",
				opt_searchRecencyFilter_oneMonth: "Past month",
				opt_searchRecencyFilter_oneYear: "Past year",
				opt_contentSize_medium: "medium (summary)",
				opt_contentSize_high: "high (detailed)",
				opt_searchStrategy_turbo: "turbo (fastest)",
				opt_searchStrategy_max: "max (deep)",
				opt_searchStrategy_agent: "agent",
				opt_searchStrategy_agent_max: "agent_max (agent + deep)",
				opt_freshness_empty: "not sent",
				opt_freshness_noLimit: "No limit",
				opt_freshness_oneDay: "Past day",
				opt_freshness_oneWeek: "Past week",
				opt_freshness_oneMonth: "Past month",
				opt_freshness_oneYear: "Past year",
				opt_searchContextSize_low: "low",
				opt_searchContextSize_medium: "medium",
				opt_searchContextSize_high: "high",
				opt_externalWebAccess_empty: "follow endpoint default (on)",
				opt_externalWebAccess_true: "true (live web)",
				opt_externalWebAccess_false: "false (cache/index only)",
				opt_returnTokenBudget_empty: "not sent",
				opt_returnTokenBudget_default: "default (standard budget)",
				opt_returnTokenBudget_unlimited: "unlimited (no cap)",
				opt_responseInclusion_empty: "default (full)",
				opt_responseInclusion_full: "full (return all blocks)",
				opt_responseInclusion_excluded: "excluded (drop consumed blocks)",
				hint_baseURL: "Endpoint prefix: official or a self-hosted gateway. Blank uses the combination default; protocol paths are appended by the plugin, so do not repeat /responses here.",
				hint_apiKeyEnv: "Credential reference: the key name in the credentials service or environment. Blank uses the combination default chain (e.g. ZAI_CODING_CN_API_KEY then ZHIPU_API_KEY).",
				hint_requestTimeoutMs: "Local timeout for one search. A timeout is recorded as WEB_PROVIDER_TIMEOUT instead of waiting for the tool budget; blank uses 25000, and test connections use 60000.",
				hint_model: "Model name; it must exist on this endpoint and support built-in search. Blank uses the combination default; a model without search support never searches.",
				hint_maxOutputTokens: "Output cap for one search turn (reasoning + tools + answer). It is a ceiling, not a reservation; too small a value truncates the turn and cuts search rounds.",
				hint_toolType: "Search tool name declared in tools[]. The default follows the vendor; pick a known spelling from the list or type a gateway-specific name. A wrong name means no search block appears.",
				hint_includeSources: "Ask for the complete source list (include). On real OpenAI endpoints the field is include-only; without it only citation annotations remain. Turn it off for gateways that reject it.",
				hint_reasoningEffort: "Reasoning level (reasoning.effort). The set is per-model; an unsupported level returns 400 and the plugin retries without it. Blank sends nothing.",
				hint_searchContextSize: "How much search context reaches the model: low saves tokens, medium balances, high is fuller. It affects latency and cost, not the source count.",
				hint_allowedDomains: "Only results from these domains, comma separated, without scheme. OpenAI caps at 100; it is mutually exclusive with blockedDomains (Anthropic returns 400, the plugin sends allowed first).",
				hint_blockedDomains: "Block these domains, comma separated, without scheme. Mutually exclusive with allowedDomains; support varies and unsupported gateways ignore it.",
				hint_excludedDomains: "Exclude these domains (OpenRouter). Some engines treat it as mutually exclusive with allowedDomains: Exa accepts both, others may return 400.",
				hint_userLocation: "Two-letter country code (e.g. US) for geographic bias. Some endpoints support it, others ignore it; Anthropic also accepts city/timezone, only the country is exposed here.",
				hint_maxUses: "Maximum search-tool calls per request. Once reached the endpoint returns an error result instead of searching, which bounds cost and latency.",
				hint_thinking: "default follows the model; disabled turns thinking off (faster, cheaper). Some models always think and answer 400 for disabled; the plugin retries without the switch.",
				hint_effort: "Anthropic output_config.effort level. Supported levels differ per model; a rejected level is retried without it. Blank sends nothing.",
				hint_searchEngine: "Zhipu search engine; pricing and capability differ: std basic, pro advanced, sogou and quark have their own quotas and limits.",
				hint_searchEngineCustom: "The engine value is defined by the gateway. Common spellings are listed (Zhipu search_std / search_pro, OpenRouter auto / exa / perplexity, self-hosted searxng / google / bing); type any other value. On the Zhipu template a blank value sends search_std (the API requires it); other templates do not use this parameter.",
				hint_count: "Result count: 1-50 for Zhipu and DeepSeek, 1-20 for Kimi (values above are clamped). A request-supplied maxResults takes precedence; the configured value only applies when the request omits it. It is independent of the digest entry count.",
				hint_searchRecencyFilter: "Only pages published within this window. Narrower windows reduce recall but improve freshness-sensitive queries.",
				hint_contentSize: "Snippet size: medium saves tokens, high returns more detail at a higher price.",
				hint_searchDomainFilter: "Restrict source domains, comma separated, without scheme. Blank means unrestricted; unsupported engines ignore it.",
				hint_requireSearch: "Refuse to answer without search results, keeping answers grounded. Off by default; when on, an empty result set fails the request instead of answering from model knowledge.",
				hint_searchPrompt: "Result-fusion prompt controlling how search content is integrated. Blank uses the official default.",
				hint_searchStrategy: "Qwen search strategy: turbo fastest, max deepest, agent/agent_max agentic. Deeper strategies are slower and more expensive.",
				hint_forcedSearch: "Force a search even when the model thinks it is unnecessary. Use for must-be-online requests.",
				hint_freshness: "Only results within this window (Qwen). Blank means unrestricted; it is the Qwen counterpart of Zhipu recency.",
				hint_assignedSiteList: "Restrict to these sites, comma separated (Qwen). Blank means unrestricted; similar to Zhipu domain filtering.",
				hint_searchExtension: "Qwen search-extension parameter, passed through. Blank omits it; see Qwen docs for accepted values.",
				hint_promptIntervene: "Qwen prompt-intervention parameter, passed through. Blank omits it; leave alone unless you know the semantics.",
				hint_engine: "OpenRouter search engine: auto (native when available, else Exa), native (provider built-in), or exa/firecrawl/parallel/perplexity. Engines differ in price and capability.",
				hint_mode: "Engine-specific mode: Exa instant/fast/auto/deep-lite/deep/deep-reasoning, Parallel turbo/fast/basic/advanced. Blank uses the engine default.",
				hint_maxCharacters: "Character cap per result. It takes precedence over searchContextSize when both are set; blank lets the engine choose.",
				hint_externalWebAccess: "Whether to fetch live pages: blank follows the endpoint default (on); false uses cache/index only, useful for reproducible or compliance-constrained runs.",
				hint_returnTokenBudget: "Content budget for one search run: default standard, unlimited removes the cap (slower, costlier). GPT-5+ reasoning models only.",
				hint_searchContentTypes: "Result types to request, comma separated: text and image. Including image also returns image results and works with the image count and caption fields.",
				hint_imageMaxResults: "Number of image results. 0 or blank disables image search; only applied when searchContentTypes includes image.",
				hint_imageCaption: "Ask for short image descriptions. Helpful for filtering and display, at a slightly larger response size.",
				hint_responseInclusion: "How search blocks appear: full returns everything, excluded drops blocks already consumed by code execution to save output tokens. web_search_20260318+ only.",
				hint_xSearch: "OpenRouter + xAI X/Twitter search parameters as a JSON object, e.g. {\"allowed_x_handles\":[\"OpenRouterAI\"]}. Blank disables it.",
				hint_maxResults: "Results per search (OpenRouter 1-25, some engines 1-20). Combine with maxTotalResults to bound cost and context.",
				hint_maxTotalResults: "Cumulative result cap across all searches in one request. Once reached the endpoint tells the model to stop searching.",
				hint_includeContent: "Also return page content. This significantly increases response size and token usage; keep it off when titles and snippets suffice. On the Zhipu template it pins content_size to high; turn it off to control the snippet length yourself.",
				hint_digestEntries: "How many results the content digest includes (1-20). It only shapes the digest text; sources are not truncated. Blank uses 8.",
				hint_digestSnippetChars: "Maximum characters kept per digest entry (1-2000); longer snippets are truncated. Blank uses 200.",
				hint_timeoutSeconds: "Request timeout in seconds (Kimi 1-60). A timeout fails the search; raise it for long queries.",
				hint_oriQuestion: "Attach the user prompt that triggered this search (whitespace collapsed, cut to 128 characters) so DeepSeek can rank by intent. Omitted outside a session or without a user prompt; DeepSeek templates only.",
				hint_localization: "Localization IP for geographic ranking. Only a valid IPv4/IPv6 is sent; blank or malformed values are omitted.",
				hint_path: "Request path relative to baseURL. Required for custom gateways; fixed by the protocol for built-in targets.",
				hint_queryField: "Name of the query field in the request body. Blank uses the template default (Zhipu search_query, DeepSeek query, Kimi text_query).",
				hint_countField: "Name of the count field in the request body. Blank uses the template default (count for Zhipu/DeepSeek, limit for Kimi).",
				hint_resultsPath: "Dot path to the results array, e.g. data.items. Blank uses the template default (Zhipu search_result, DeepSeek results, Kimi search_results).",
				hint_urlField: "Name of the URL field in each result. Blank uses the template default (link for Zhipu, url elsewhere).",
				hint_titleField: "Name of the title field in each result. Blank uses the template default (title).",
				hint_snippetField: "Name of the snippet field in each result. Blank uses the template default (content for Zhipu, snippet elsewhere).",
				hint_dateField: "Name of the date field in each result. Blank means dates are not parsed; set it only when the response carries one.",
				hint_contentField: "Name of the long-body field in each result. The body becomes the source summary (capped at 2000 characters, omitted when identical to snippet) and backs the content digest when snippet is empty; blank falls back to the summary field.",
				field_baseURL: "Endpoint",
				field_apiKeyEnv: "Credential reference",
				field_requestTimeoutMs: "Request timeout (ms)",
				field_model: "Model",
				field_maxOutputTokens: "Max output tokens",
				field_count: "Result count",
				field_maxUses: "Max search uses",
				field_searchEngine: "Search engine",
				field_searchRecencyFilter: "Recency",
				field_contentSize: "Snippet size",
				field_searchDomainFilter: "Domain filter",
				field_requireSearch: "Require search",
				field_searchPrompt: "Search prompt",
				field_reasoningEffort: "Thinking effort",
				field_thinking: "Thinking mode",
				field_effort: "Effort",
				field_includeSources: "Request full sources",
				field_includeContent: "Include content",
				field_digestEntries: "Digest entries",
				field_digestSnippetChars: "Chars per digest entry",
				field_timeoutSeconds: "Timeout (s)",
				field_oriQuestion: "Original question",
				field_localization: "Localization IP",
				field_path: "Request path",
				field_template: "Compatible template",
				field_toolType: "Search tool name",
				field_queryField: "Query field",
				field_countField: "Count field",
				field_resultsPath: "Results path",
				field_urlField: "URL field",
				field_titleField: "Title field",
				field_snippetField: "Snippet field",
				field_dateField: "Date field",
				field_contentField: "Content field",
				field_searchContextSize: "Search context size",
				field_allowedDomains: "Allowed domains",
				field_blockedDomains: "Blocked domains",
				field_excludedDomains: "Excluded domains",
				field_userLocation: "User location",
				field_engine: "Engine",
				field_mode: "Engine mode",
				field_maxCharacters: "Max chars per result",
				field_externalWebAccess: "Live web access",
				field_returnTokenBudget: "Return token budget",
				field_searchContentTypes: "Search content types",
				field_imageMaxResults: "Image max results",
				field_imageCaption: "Image captions",
				field_responseInclusion: "Response inclusion",
				field_xSearch: "X search (JSON)",
				field_maxResults: "Max results",
				field_maxTotalResults: "Max total results",
				field_searchStrategy: "Search strategy",
				field_forcedSearch: "Force search",
				field_freshness: "Freshness",
				field_assignedSiteList: "Assigned sites",
				field_searchExtension: "Search extension",
				field_promptIntervene: "Prompt intervention",
				tabNav: "Plugin navigation",
				tabConfig: "Configuration",
				tabObservability: "Observability",
				obsOverview: "Overview",
				obsRecords: "Records",
				obsRange: "Range",
				obsRange_all: "All",
				obsTargetFilter: "Target",
				obsAllTargets: "All targets",
				obsIncludeTests: "Include test connections",
				obsRefresh: "Refresh",
				obsRefreshing: "Refreshing…",
				obsExportJsonl: "Export JSONL",
				obsExportCsv: "Export CSV",
				obsMetricCount: "Searches",
				obsMetricSuccess: "Success rate",
				obsMetricP95: "P95 latency",
				obsMetricSources: "Avg. sources",
				obsMetricSummary: "Summary coverage",
				obsTargetRanking: "Target ranking",
				obsEmpty: "No searches yet",
				obsEmptyHint: "Run a test connection with the current configuration, or wait for the next real search.",
				obsEmptyFiltered: "No records match these filters",
				obsEmptyFilteredHint: "Adjust the range, target or status filter and try again.",
				obsClearFilters: "Clear filters",
				obsNoData: "No data",
				obsTableTime: "Time",
				obsTableTarget: "Target",
				obsTableQuery: "Query",
				obsTableDuration: "Duration",
				obsTableSources: "Sources",
				obsTableSummary: "Summaries",
				obsTableStatus: "Status",
				obsTableErrors: "Errors",
				obsStatusOk: "OK",
				obsStatusFail: "Failed",
				obsFilterStatus: "Status",
				obsAllStatuses: "All statuses",
				obsFilterQuery: "Query",
				obsFilterQueryHint: "Filter by query, Enter to apply",
				obsLoadMore: "Load more",
				obsLoadingMore: "Loading…",
				obsDetailsError: "Error",
				obsDetailsSources: "Sources",
				obsDetailsKind: "Kind",
				obsDetailsAnswer: "Answer chars",
				obsDetailsRecordId: "Record ID",
				obsDetailsSession: "Session",
				obsSourceSummary: "Summary",
				obsSourceSnippet: "Snippet",
				obsSourceNoTitle: "No title",
				obsSourceNoHost: "No host",
				obsCopyJson: "Copy JSON",
				obsCopied: "Copied",
				obsCopyFailed: "Copy failed",
				obsDataManagement: "Data management",
				obsClearHint: "Clearing deletes every observation and cannot be undone. Type DELETE to confirm.",
				obsClearPlaceholder: "Type DELETE",
				obsClear: "Clear observations",
				obsClearing: "Clearing…",
				obsCleared: "Cleared {count} records",
				obsRecordsCaption: "Search records",
				obsTrend: "Trend",
				obsTrendSuccess: "Success rate",
				obsTrendP95: "P95 latency",
				obsTrendAria: "Across {buckets} buckets, success rate {min}–{max}",
				obsApplyFilters: "Apply",
				obsDetailsQuery: "Query",
				obsAnswerEmpty: "No answer text recorded",
				obsRange_today: "Today",
				obsRange_week: "This week",
				obsRange_month: "This month",
				obsRange_quarter: "This quarter",
				obsRange_year: "This year",
				obsImport: "Import search history",
				obsImportHint: "Scan local session logs to backfill web_search records from older versions; re-running adds only new ones.",
				obsImporting: "Importing…",
				obsImportDone: "Scanned {sessions} sessions, imported {imported} (target identified for {identified}), updated {updated}, already present {skipped}, out of range {filtered}",
				obsRange_24h: "24 hours",
				obsRange_7d: "7 days",
				obsRange_30d: "30 days",
				obsRangeSince: "Since {date}",
				obsCalendarPrev: "Previous month",
				obsCalendarNext: "Next month",
				obsRangeUntilNow: "Until now",
				obsRangePickEnd: "Pick an end date",
				obsPrevPage: "Previous page",
				obsNextPage: "Next page",
				obsPageNumber: "Page {page}",
				obsPageSize: "{size} per page",
				obsPageJump: "Go to",
				obsPageUnit: "page",
				obsPageSizeLabel: "Rows per page",
				obsImportRange: "Import range",
				obsHistoricalTarget: "History"
			},
			ja: {
				description: "マルチプロトコルのウェブ検索：プロトコル内蔵（Chat Completions / Responses / Anthropic Messages）とスタンドアロン検索を、ベンダーごとに選択。",
				loading: "設定を読み込み中…",
				loadFailed: "設定を読み込めませんでした。プラグインサービスが利用可能になってから再試行してください。",
				unsaved: "未保存",
				save: "保存",
				saving: "保存中…",
				discard: "変更を破棄",
				shape: "検索方式",
				shapeInProtocol: "プロトコル内蔵検索",
				shapeStandalone: "スタンドアロン検索",
				protocol: "プロトコル",
				vendor: "ベンダー",
				advanced: "詳細オプション",
				fieldPlaceholder: "空欄は既定値",
				unsupported: "非対応",
				full: "完全",
				degraded: "縮退",
				custom: "カスタム",
				unsupportedVendors: "本ビルドで未接続の組み合わせ（ベンダー自体が別プロトコルで使えないわけではありません）",
				customNotice: "カスタム接続はゲートウェイの動作をご自身で確認してください。保存後にテストできます。",
				fillFromTemplate: "テンプレートから入力（参考用）",
				templateFillHint: "テンプレートを選ぶと下の項目だけが埋まります。テンプレート自体は保存されず、選択は使用後にリセットされます。",
				templatePlaceholder: "テンプレートを選択…",
				templateUsed: "前回使用：{name}",
				templateOverwrite: "「{name}」は現在の設定（保存済みの値を含む）を上書きします",
				templateApply: "テンプレートを適用",
				templateCancel: "キャンセル",
				resetToSaved: "保存済み設定に戻す",
				test: "接続テスト",
				testing: "テスト中…",
				testOk: "接続成功",
				testFailed: "テスト失敗",
				testSources: "件のソース",
				testDegraded: "縮退した組み合わせ",
				testNoSourcesByDesign: "この組み合わせはソースを返しません",
				testNoSourcesPartial: "ソースなし：検索が実行されていないか、引用可能なページがありませんでした",
				testNoSourcesFull: "ソースが返りません。ツール名とエンドポイントを確認してください",
				modelLockedHint: "この組み合わせはこのモデルのみ対応しており、変更できません。",
				apiKey: "API キー",
				apiKeyHint: "資格情報サービス（~/.dsh/.credentials.yaml）経由で書き込みのみ保存し、設定ファイルには書き込みません。空欄は現在のキーを維持します。",
				apiKeySet: "キー設定済み",
				apiKeyUnset: "キー未設定",
				apiKeyByReference: "資格情報参照に依存",
				invalidPositive: "正の整数を入力してください。空欄は既定値です。",
				invalidRange: "1〜{max} の整数を入力してください。空欄は既定値です。",
				invalidRefName: "有効な資格情報参照名を入力してください（先頭は英字かアンダースコア、以降は英数字とアンダースコアのみ）。",
				invalidJson: "JSON オブジェクトを入力してください。空欄なら送信しません。",
				protocolChat: "Chat Completions",
				protocolResponses: "Responses",
				protocolAnthropic: "Anthropic Messages",
				protocolSearch: "スタンドアロン検索",
				vendorDeepseek: "DeepSeek",
				vendorKimi: "Kimi",
				vendorZhipu: "Zhipu",
				vendorQwen: "Qwen",
				vendorOpenai: "OpenAI",
				vendorAnthropic: "Anthropic",
				vendorOpenrouter: "OpenRouter",
				vendorCustom: "カスタム",
				opt_thinking_default: "default（モデルに従う）",
				opt_thinking_disabled: "disabled（思考オフ、高速・低コスト）",
				opt_effort_empty: "送信しない（モデルに従う）",
				opt_effort_low: "low（低）",
				opt_effort_medium: "medium（中）",
				opt_effort_high: "high（高）",
				opt_effort_xhigh: "xhigh（超高）",
				opt_effort_max: "max（最高）",
				opt_searchEngine_search_std: "search_std（Zhipu 基本）",
				opt_searchEngine_search_pro: "search_pro（Zhipu 詳細）",
				opt_searchEngine_search_pro_sogou: "search_pro_sogou（Sogou）",
				opt_searchEngine_search_pro_quark: "search_pro_quark（Quark）",
				opt_searchRecencyFilter_noLimit: "制限なし",
				opt_searchRecencyFilter_oneDay: "過去 1 日",
				opt_searchRecencyFilter_oneWeek: "過去 1 週間",
				opt_searchRecencyFilter_oneMonth: "過去 1 か月",
				opt_searchRecencyFilter_oneYear: "過去 1 年",
				opt_contentSize_medium: "medium（要約）",
				opt_contentSize_high: "high（詳細）",
				opt_searchStrategy_turbo: "turbo（最速）",
				opt_searchStrategy_max: "max（深い）",
				opt_searchStrategy_agent: "agent（エージェント）",
				opt_searchStrategy_agent_max: "agent_max（エージェント＋深い）",
				opt_freshness_empty: "送信しない",
				opt_freshness_noLimit: "制限なし",
				opt_freshness_oneDay: "過去 1 日",
				opt_freshness_oneWeek: "過去 1 週間",
				opt_freshness_oneMonth: "過去 1 か月",
				opt_freshness_oneYear: "過去 1 年",
				opt_searchContextSize_low: "low（少量）",
				opt_searchContextSize_medium: "medium（均衡）",
				opt_searchContextSize_high: "high（多め）",
				opt_externalWebAccess_empty: "エンドポイント既定に従う（オン）",
				opt_externalWebAccess_true: "true（リアルタイム Web）",
				opt_externalWebAccess_false: "false（キャッシュ/インデックスのみ）",
				opt_returnTokenBudget_empty: "送信しない",
				opt_returnTokenBudget_default: "default（標準予算）",
				opt_returnTokenBudget_unlimited: "unlimited（上限なし）",
				opt_responseInclusion_empty: "既定（full）",
				opt_responseInclusion_full: "full（すべてのブロックを返す）",
				opt_responseInclusion_excluded: "excluded（消費済みブロックを省略）",
				hint_baseURL: "エンドポイントのプレフィックス：公式または自前のゲートウェイ。空欄は組み合わせの既定値。プロトコルのパスはプラグインが付加するため、ここに /responses などを重複して書かないでください。",
				hint_apiKeyEnv: "資格情報参照：資格情報サービスまたは環境変数のキー名。空欄は組み合わせの既定チェーン（例：ZAI_CODING_CN_API_KEY → ZHIPU_API_KEY）。",
				hint_requestTimeoutMs: "1 回の検索に対するローカルタイムアウト。ツール層の共通キャンセルを待たず WEB_PROVIDER_TIMEOUT として記録します。空欄は 25000、接続テストは 60000。",
				hint_model: "モデル名。このエンドポイントに存在し、内蔵検索に対応している必要があります。空欄は組み合わせの既定値。検索非対応モデルでは検索されません。",
				hint_maxOutputTokens: "1 回の検索ターンの出力上限（推論＋ツール＋回答）。上限であり予約ではありません。小さすぎるとターンが切り詰められ、検索ラウンドが削られます。",
				hint_toolType: "tools[] に宣言する検索ツール名。既定値はベンダーごと。一覧から既知の表記を選ぶか、ゲートウェイ固有の名前を入力してください。誤ると検索ブロックが返りません。",
				hint_includeSources: "完全なソース一覧を要求（include）。OpenAI 公式では include 専用で、ない場合は引用注釈だけになります。拒否するゲートウェイではオフにしてください。",
				hint_reasoningEffort: "推論レベル（reasoning.effort）。対応値はモデルごと。未対応値は 400 を返すため、プラグインはそのパラメータを外して再試行します。空欄は送信しません。",
				hint_searchContextSize: "検索コンテキストをモデルへ渡す量：low はトークン節約、medium は均衡、high はより完全。レイテンシと費用に影響し、ソース数は保証しません。",
				hint_allowedDomains: "これらのドメインの結果のみ返します。カンマ区切り、プロトコルなし。OpenAI は最大 100 件。blockedDomains とは排他（Anthropic は同時送信で 400、プラグインは allowed を優先）。",
				hint_blockedDomains: "これらのドメインを除外します。カンマ区切り、プロトコルなし。allowedDomains と排他。対応状況は様々で、非対応ゲートウェイは無視します。",
				hint_excludedDomains: "これらのドメインを除外します（OpenRouter）。一部エンジンでは allowedDomains と排他：Exa は併用可、他は 400 の可能性。",
				hint_userLocation: "2 文字の国コード（例：US）で地域バイアス。対応はエンドポイント次第で、非対応なら無視されます。Anthropic は都市/タイムゾーンも受けますが、ここでは国のみ公開。",
				hint_maxUses: "1 リクエストあたりの検索ツール呼び出し上限。到達するとエンドポイントは検索せずエラー結果を返し、費用とレイテンシを抑えます。",
				hint_thinking: "default はモデルに従う。disabled は思考をオフにし高速・低コスト。常時思考するモデルは disabled で 400 を返すため、プラグインはスイッチを外して再試行します。",
				hint_effort: "Anthropic の output_config.effort レベル。対応レベルはモデルごと。拒否された場合は外して再試行します。空欄は送信しません。",
				hint_searchEngine: "Zhipu の検索エンジン。価格と能力が異なります：std 基本、pro 詳細、sogou と quark は独自の割当と制限。",
				hint_searchEngineCustom: "エンジン値はゲートウェイが定義します。代表的な表記を列挙しています（Zhipu search_std / search_pro、OpenRouter auto / exa / perplexity、自前 searxng / google / bing）。その他の値も入力できます。Zhipu テンプレートで空欄なら search_std を送信（API 必須）。他のテンプレートはこのパラメータを使いません。",
				hint_count: "結果件数：Zhipu と DeepSeek は 1-50、Kimi は 1-20（超過はクランプ）。リクエストの maxResults が優先され、設定値はリクエストで未指定のときだけ有効。ダイジェスト件数とは独立です。",
				hint_searchRecencyFilter: "この期間に公開されたページのみ。狭いほど再現率は下がりますが、鮮度が重要なクエリに有効。",
				hint_contentSize: "要約の長さ：medium はトークン節約、high は詳細だが高コスト。",
				hint_searchDomainFilter: "ソースのドメインを制限。カンマ区切り、プロトコルなし。空欄は無制限。非対応エンジンは無視します。",
				hint_requireSearch: "検索結果がない場合は回答を拒否し、根拠を保ちます。既定はオフ。オンで結果が空なら、モデル知識で答える代わりに失敗します。",
				hint_searchPrompt: "結果統合プロンプト。検索内容の組み込み方を制御。空欄は公式既定。",
				hint_searchStrategy: "Qwen の検索戦略：turbo 最速、max 最深、agent/agent_max エージェント。深いほど低速・高コスト。",
				hint_forcedSearch: "モデルが不要と判断しても検索を強制。必ずオンラインにしたい場合に使用。",
				hint_freshness: "この期間内の結果のみ（Qwen）。空欄は無制限。Zhipu の時間範囲に相当。",
				hint_assignedSiteList: "これらのサイトに限定（カンマ区切り、Qwen）。空欄は無制限。Zhipu のドメイン制限に類似。",
				hint_searchExtension: "Qwen の検索拡張パラメータをそのまま転送。空欄は送信しません。有効値は Qwen のドキュメント参照。",
				hint_promptIntervene: "Qwen のプロンプト介入パラメータをそのまま転送。空欄は送信しません。意味を理解している場合以外は変更しないでください。",
				hint_engine: "OpenRouter の検索エンジン：auto（ネイティブがあればそれ、なければ Exa）、native（プロバイダー内蔵）、exa/firecrawl/parallel/perplexity。価格と能力は異なります。",
				hint_mode: "エンジン固有モード：Exa は instant/fast/auto/deep-lite/deep/deep-reasoning、Parallel は turbo/fast/basic/advanced。空欄はエンジン既定。",
				hint_maxCharacters: "1 結果あたりの文字数上限。searchContextSize と併用時はこちらが優先。空欄はエンジン任せ。",
				hint_externalWebAccess: "リアルタイムのウェブ取得：空欄はエンドポイント既定（オン）、false はキャッシュ/インデックスのみ。再現性やコンプライアンス制約がある場合に有効。",
				hint_returnTokenBudget: "1 回の検索で返す内容の予算：default 標準、unlimited 上限なし（低速・高コスト）。GPT-5+ 推論モデルのみ。",
				hint_searchContentTypes: "要求する結果タイプ（カンマ区切り）：text と image。image を含めると画像結果も返し、画像件数と説明の項目が有効になります。",
				hint_imageMaxResults: "画像結果の数。0 または空欄で画像検索なし。searchContentTypes に image が含まれる場合のみ有効。",
				hint_imageCaption: "画像結果に短い説明を要求。絞り込みと表示に有用で、応答はやや大きくなります。",
				hint_responseInclusion: "検索ブロックの返し方：full はすべて、excluded はコード実行で消費済みのブロックを省略して出力トークンを節約。web_search_20260318+ のみ。",
				hint_xSearch: "OpenRouter と xAI の X/Twitter 検索パラメータを JSON オブジェクトで指定。例：{\"allowed_x_handles\":[\"OpenRouterAI\"]}。空欄は無効。",
				hint_maxResults: "1 検索あたりの結果数（OpenRouter 1-25、一部エンジン 1-20）。maxTotalResults と併用して費用とコンテキストを制限。",
				hint_maxTotalResults: "1 リクエスト内の全検索の累計結果上限。到達するとエンドポイントはモデルに検索停止を指示。",
				hint_includeContent: "ページ本文も返します。応答サイズとトークン消費が大きく増えます。タイトルと要約で足りるならオフのままに。Zhipu テンプレートでは content_size を high に固定。要約長を自分で制御するならオフ。",
				hint_digestEntries: "content ダイジェストに含める結果数（1-20）。ダイジェスト文だけを調整し、sources は切り詰めません。空欄は 8。",
				hint_digestSnippetChars: "ダイジェスト各項目の最大文字数（1-2000）。超過分は切り詰め。空欄は 200。",
				hint_timeoutSeconds: "リクエストのタイムアウト秒（Kimi 1-60）。タイムアウトで検索失敗。長いクエリでは増やしてください。",
				hint_oriQuestion: "この検索を起こしたユーザーの発話を添付（空白を畳み、128 文字に切断）し、DeepSeek が意図で順位付けできるようにします。セッション外やユーザー発話がない場合は省略。DeepSeek テンプレートのみ。",
				hint_localization: "地域ランキング用のローカライズ IP。有効な IPv4/IPv6 のみ送信。空欄または不正値は省略。",
				hint_path: "baseURL からの相対リクエストパス。カスタムゲートウェイでは必須。組み込みターゲットではプロトコルが固定。",
				hint_queryField: "リクエスト本文のクエリフィールド名。空欄はテンプレート既定（Zhipu search_query、DeepSeek query、Kimi text_query）。",
				hint_countField: "リクエスト本文の件数フィールド名。空欄はテンプレート既定（Zhipu/DeepSeek は count、Kimi は limit）。",
				hint_resultsPath: "結果配列へのドットパス（例：data.items）。空欄はテンプレート既定（Zhipu search_result、DeepSeek results、Kimi search_results）。",
				hint_urlField: "各結果の URL フィールド名。空欄はテンプレート既定（Zhipu は link、他は url）。",
				hint_titleField: "各結果のタイトルフィールド名。空欄はテンプレート既定（title）。",
				hint_snippetField: "各結果の要約フィールド名。空欄はテンプレート既定（Zhipu は content、他は snippet）。",
				hint_dateField: "各結果の日付フィールド名。空欄は日付を解析しません。応答に日付がある場合のみ設定。",
				hint_contentField: "各結果の長文フィールド名。本文は source.summary になります（1 件 2000 文字上限、snippet と同じなら省略）。snippet が空のときは content ダイジェストのフォールバックにもなり、空欄は summary フィールドにフォールバックします。",
				field_baseURL: "エンドポイント",
				field_apiKeyEnv: "資格情報参照",
				field_requestTimeoutMs: "リクエストタイムアウト（ミリ秒）",
				field_model: "モデル",
				field_maxOutputTokens: "出力上限",
				field_count: "結果件数",
				field_maxUses: "検索回数上限",
				field_searchEngine: "検索エンジン",
				field_searchRecencyFilter: "時間範囲",
				field_contentSize: "要約長",
				field_searchDomainFilter: "ドメイン制限",
				field_requireSearch: "検索を必須化",
				field_searchPrompt: "検索プロンプト",
				field_reasoningEffort: "思考強度",
				field_thinking: "思考モード",
				field_effort: "思考レベル",
				field_includeSources: "完全なソースを要求",
				field_includeContent: "本文を含める",
				field_digestEntries: "ダイジェスト件数",
				field_digestSnippetChars: "各ダイジェストの文字上限",
				field_timeoutSeconds: "タイムアウト（秒）",
				field_oriQuestion: "元の質問",
				field_localization: "ローカライズ IP",
				field_path: "リクエストパス",
				field_template: "互換テンプレート",
				field_toolType: "検索ツール名",
				field_queryField: "クエリフィールド名",
				field_countField: "件数フィールド名",
				field_resultsPath: "結果配列パス",
				field_urlField: "URL フィールド名",
				field_titleField: "タイトルフィールド名",
				field_snippetField: "要約フィールド名",
				field_dateField: "日付フィールド名",
				field_contentField: "正文字段名",
				field_searchContextSize: "検索コンテキストサイズ",
				field_allowedDomains: "許可ドメイン",
				field_blockedDomains: "ブロックドメイン",
				field_excludedDomains: "除外ドメイン",
				field_userLocation: "ユーザー地域",
				field_engine: "エンジン",
				field_mode: "エンジンモード",
				field_maxCharacters: "1 結果の最大文字数",
				field_externalWebAccess: "リアルタイム Web",
				field_returnTokenBudget: "返却トークン予算",
				field_searchContentTypes: "検索コンテンツ種別",
				field_imageMaxResults: "画像結果数",
				field_imageCaption: "画像の説明",
				field_responseInclusion: "応答の包含モード",
				field_xSearch: "X 検索パラメータ（JSON）",
				field_maxResults: "1 回の結果数",
				field_maxTotalResults: "総結果数",
				field_searchStrategy: "検索戦略",
				field_forcedSearch: "検索を強制",
				field_freshness: "鮮度",
				field_assignedSiteList: "限定サイト",
				field_searchExtension: "検索拡張",
				field_promptIntervene: "プロンプト介入",
				tabNav: "プラグインのナビゲーション",
				tabConfig: "設定",
				tabObservability: "観測",
				obsOverview: "概要",
				obsRecords: "記録",
				obsRange: "期間",
				obsRange_all: "すべて",
				obsTargetFilter: "ターゲット",
				obsAllTargets: "すべてのターゲット",
				obsIncludeTests: "接続テストを含める",
				obsRefresh: "更新",
				obsRefreshing: "更新中…",
				obsExportJsonl: "JSONL を書き出す",
				obsExportCsv: "CSV を書き出す",
				obsMetricCount: "検索回数",
				obsMetricSuccess: "成功率",
				obsMetricP95: "P95 遅延",
				obsMetricSources: "平均ソース数",
				obsMetricSummary: "要約カバー率",
				obsTargetRanking: "ターゲット別ランキング",
				obsEmpty: "検索記録がありません",
				obsEmptyHint: "現在の設定で接続テストを実行するか、次の検索を待ってください。",
				obsEmptyFiltered: "条件に一致する記録がありません",
				obsEmptyFilteredHint: "期間・ターゲット・状態の絞り込みを変更して再試行してください。",
				obsClearFilters: "絞り込みを解除",
				obsNoData: "データなし",
				obsTableTime: "時刻",
				obsTableTarget: "ターゲット",
				obsTableQuery: "検索語",
				obsTableDuration: "所要時間",
				obsTableSources: "ソース数",
				obsTableSummary: "要約数",
				obsTableStatus: "状態",
				obsTableErrors: "エラー",
				obsStatusOk: "成功",
				obsStatusFail: "失敗",
				obsFilterStatus: "状態",
				obsAllStatuses: "すべての状態",
				obsFilterQuery: "検索語",
				obsFilterQueryHint: "検索語で絞り込み、Enter で適用",
				obsLoadMore: "さらに読み込む",
				obsLoadingMore: "読み込み中…",
				obsDetailsError: "エラー",
				obsDetailsSources: "ソースの詳細",
				obsDetailsKind: "種類",
				obsDetailsAnswer: "回答文字数",
				obsDetailsRecordId: "レコード ID",
				obsDetailsSession: "セッション",
				obsSourceSummary: "要約",
				obsSourceSnippet: "スニペット",
				obsSourceNoTitle: "タイトルなし",
				obsSourceNoHost: "ホスト名なし",
				obsCopyJson: "JSON をコピー",
				obsCopied: "コピーしました",
				obsCopyFailed: "コピーに失敗しました",
				obsDataManagement: "データ管理",
				obsClearHint: "消去するとすべての観測記録が削除され、元に戻せません。DELETE と入力して確認してください。",
				obsClearPlaceholder: "DELETE と入力",
				obsClear: "観測データを消去",
				obsClearing: "消去中…",
				obsCleared: "{count} 件の記録を消去しました",
				obsRecordsCaption: "検索記録",
				obsTrend: "推移",
				obsTrendSuccess: "成功率",
				obsTrendP95: "P95 遅延",
				obsTrendAria: "{buckets} 個の時間バケットで成功率 {min}–{max}",
				obsApplyFilters: "適用",
				obsDetailsQuery: "検索語",
				obsAnswerEmpty: "この記録には回答テキストがありません",
				obsRange_today: "今日",
				obsRange_week: "今週",
				obsRange_month: "今月",
				obsRange_quarter: "今四半期",
				obsRange_year: "今年",
				obsImport: "検索履歴をインポート",
				obsImportHint: "ローカルセッションログを走査し、旧バージョンの web_search 記録を補完します。再実行時は新しい分だけ追加します。",
				obsImporting: "インポート中…",
				obsImportDone: "{sessions} セッションを走査、{imported} 件を追加（target 識別 {identified} 件）、{updated} 件を更新、既存 {skipped} 件、範囲外 {filtered} 件",
				obsRange_24h: "24 時間",
				obsRange_7d: "7 日間",
				obsRange_30d: "30 日間",
				obsRangeSince: "{date} 以降",
				obsCalendarPrev: "前の月",
				obsCalendarNext: "次の月",
				obsRangeUntilNow: "現在まで",
				obsRangePickEnd: "終了日を選択",
				obsPrevPage: "前のページ",
				obsNextPage: "次のページ",
				obsPageNumber: "{page} ページ",
				obsPageSize: "{size} 件/ページ",
				obsPageJump: "移動",
				obsPageUnit: "ページ",
				obsPageSizeLabel: "1 ページあたりの件数",
				obsImportRange: "インポート範囲",
				obsHistoricalTarget: "履歴"
			},
			es: {
				description: "Búsqueda web multiprotocolo: integrada en el protocolo (Chat Completions / Responses / Anthropic Messages) y búsqueda independiente, según el proveedor.",
				loading: "Leyendo la configuración…",
				loadFailed: "No se pudo leer la configuración; reintente cuando el servicio del plugin esté disponible.",
				unsaved: "Sin guardar",
				save: "Guardar",
				saving: "Guardando…",
				discard: "Descartar cambios",
				shape: "Tipo de búsqueda",
				shapeInProtocol: "Búsqueda en el protocolo",
				shapeStandalone: "Búsqueda independiente",
				protocol: "Protocolo",
				vendor: "Proveedor",
				advanced: "Opciones avanzadas",
				fieldPlaceholder: "Vacío usa el valor predeterminado",
				unsupported: "No compatible",
				full: "Completo",
				degraded: "Degradado",
				custom: "Personalizado",
				unsupportedVendors: "Combinaciones no conectadas en esta compilación (el proveedor puede funcionar con otro protocolo)",
				customNotice: "Los puntos de conexión personalizados son responsabilidad suya; pruebe tras guardar.",
				fillFromTemplate: "Rellenar desde una plantilla (solo referencia)",
				templateFillHint: "Elegir una plantilla solo rellena los campos siguientes; la plantilla no se guarda y el selector se restablece tras usarla.",
				templatePlaceholder: "Elegir una plantilla…",
				templateUsed: "Última usada: {name}",
				templateOverwrite: "«{name}» sobrescribirá la configuración actual (incluidos los valores guardados)",
				templateApply: "Aplicar plantilla",
				templateCancel: "Cancelar",
				resetToSaved: "Restablecer a la configuración guardada",
				test: "Probar conexión",
				testing: "Probando…",
				testOk: "Conexión correcta",
				testFailed: "Prueba fallida",
				testSources: "fuentes",
				testDegraded: "degradada",
				testNoSourcesByDesign: "esta combinación no devuelve fuentes",
				testNoSourcesPartial: "sin fuentes: puede que la búsqueda no se ejecutara o que no hubiera páginas citables",
				testNoSourcesFull: "no se devolvieron fuentes; revise el nombre de la herramienta y el punto de conexión",
				modelLockedHint: "Esta combinación solo admite este modelo; no se puede cambiar.",
				apiKey: "Clave de API",
				apiKeyHint: "Se guarda solo mediante el servicio de credenciales (~/.dsh/.credentials.yaml), nunca en el archivo de configuración. Déjelo vacío para mantener la clave actual.",
				apiKeySet: "Clave configurada",
				apiKeyUnset: "Sin clave",
				apiKeyByReference: "Depende de la referencia de credencial",
				invalidPositive: "Introduzca un entero positivo o déjelo vacío para el valor predeterminado.",
				invalidRange: "Introduzca un entero de 1 a {max}, o déjelo vacío para el valor predeterminado.",
				invalidRefName: "Introduzca un nombre de referencia de credencial válido (letra o guion bajo al inicio; solo letras, dígitos y guiones bajos).",
				invalidJson: "Introduzca un objeto JSON o déjelo vacío para omitirlo.",
				protocolChat: "Chat Completions",
				protocolResponses: "Responses",
				protocolAnthropic: "Anthropic Messages",
				protocolSearch: "Búsqueda independiente",
				vendorDeepseek: "DeepSeek",
				vendorKimi: "Kimi",
				vendorZhipu: "Zhipu",
				vendorQwen: "Qwen",
				vendorOpenai: "OpenAI",
				vendorAnthropic: "Anthropic",
				vendorOpenrouter: "OpenRouter",
				vendorCustom: "Personalizado",
				opt_thinking_default: "default (seguir el modelo)",
				opt_thinking_disabled: "disabled (pensamiento desactivado, más rápido)",
				opt_effort_empty: "no se envía (seguir el modelo)",
				opt_effort_low: "low (bajo)",
				opt_effort_medium: "medium (medio)",
				opt_effort_high: "high (alto)",
				opt_effort_xhigh: "xhigh (muy alto)",
				opt_effort_max: "max (máximo)",
				opt_searchEngine_search_std: "search_std (Zhipu básico)",
				opt_searchEngine_search_pro: "search_pro (Zhipu avanzado)",
				opt_searchEngine_search_pro_sogou: "search_pro_sogou (Sogou)",
				opt_searchEngine_search_pro_quark: "search_pro_quark (Quark)",
				opt_searchRecencyFilter_noLimit: "Sin límite",
				opt_searchRecencyFilter_oneDay: "Último día",
				opt_searchRecencyFilter_oneWeek: "Última semana",
				opt_searchRecencyFilter_oneMonth: "Último mes",
				opt_searchRecencyFilter_oneYear: "Último año",
				opt_contentSize_medium: "medium (resumen)",
				opt_contentSize_high: "high (detallado)",
				opt_searchStrategy_turbo: "turbo (la más rápida)",
				opt_searchStrategy_max: "max (profunda)",
				opt_searchStrategy_agent: "agent (agente)",
				opt_searchStrategy_agent_max: "agent_max (agente + profunda)",
				opt_freshness_empty: "no se envía",
				opt_freshness_noLimit: "Sin límite",
				opt_freshness_oneDay: "Último día",
				opt_freshness_oneWeek: "Última semana",
				opt_freshness_oneMonth: "Último mes",
				opt_freshness_oneYear: "Último año",
				opt_searchContextSize_low: "low (poco)",
				opt_searchContextSize_medium: "medium (equilibrado)",
				opt_searchContextSize_high: "high (más)",
				opt_externalWebAccess_empty: "seguir el predeterminado del endpoint (activado)",
				opt_externalWebAccess_true: "true (web en vivo)",
				opt_externalWebAccess_false: "false (solo caché/índice)",
				opt_returnTokenBudget_empty: "no se envía",
				opt_returnTokenBudget_default: "default (presupuesto estándar)",
				opt_returnTokenBudget_unlimited: "unlimited (sin límite)",
				opt_responseInclusion_empty: "predeterminado (full)",
				opt_responseInclusion_full: "full (devolver todos los bloques)",
				opt_responseInclusion_excluded: "excluded (omitir bloques ya consumidos)",
				hint_baseURL: "Prefijo del punto de conexión: oficial o una pasarela propia. Vacío usa el valor predeterminado de la combinación; las rutas del protocolo las añade el plugin, así que no repita /responses aquí.",
				hint_apiKeyEnv: "Referencia de credencial: el nombre de la clave en el servicio de credenciales o en el entorno. Vacío usa la cadena predeterminada de la combinación (p. ej., ZAI_CODING_CN_API_KEY y luego ZHIPU_API_KEY).",
				hint_requestTimeoutMs: "Tiempo límite local de una búsqueda. Al agotarse se registra como WEB_PROVIDER_TIMEOUT en lugar de esperar al presupuesto de la herramienta; vacío usa 25000 y la prueba de conexión 60000.",
				hint_model: "Nombre del modelo; debe existir en este punto de conexión y admitir búsqueda integrada. Vacío usa el predeterminado de la combinación; un modelo sin búsqueda nunca buscará.",
				hint_maxOutputTokens: "Límite de salida de un turno de búsqueda (razonamiento + herramientas + respuesta). Es un techo, no una reserva; un valor demasiado bajo trunca el turno y recorta rondas de búsqueda.",
				hint_toolType: "Nombre de la herramienta de búsqueda declarada en tools[]. El predeterminado depende del proveedor; elija una grafía conocida de la lista o escriba una específica de la pasarela. Un nombre erróneo implica que no aparezca ningún bloque de búsqueda.",
				hint_includeSources: "Solicitar la lista completa de fuentes (include). En los endpoints oficiales de OpenAI el campo es solo «include»; sin él solo quedan anotaciones de cita. Desactívelo en pasarelas que lo rechacen.",
				hint_reasoningEffort: "Nivel de razonamiento (reasoning.effort). El conjunto varía por modelo; un nivel no admitido devuelve 400 y el plugin reintenta sin él. Vacío no envía nada.",
				hint_searchContextSize: "Cuánto contexto de búsqueda llega al modelo: low ahorra tokens, medium equilibra, high es más completo. Afecta a la latencia y el coste, no al número de fuentes.",
				hint_allowedDomains: "Solo resultados de estos dominios, separados por comas, sin esquema. OpenAI admite hasta 100; es mutuamente excluyente con blockedDomains (Anthropic devuelve 400; el plugin envía allowed primero).",
				hint_blockedDomains: "Bloquear estos dominios, separados por comas, sin esquema. Mutuamente excluyente con allowedDomains; la compatibilidad varía y las pasarelas no compatibles lo ignoran.",
				hint_excludedDomains: "Excluir estos dominios (OpenRouter). Algunos motores lo tratan como excluyente con allowedDomains: Exa admite ambos, otros pueden devolver 400.",
				hint_userLocation: "Código de país de dos letras (p. ej., US) para sesgo geográfico. Algunos endpoints lo admiten y otros lo ignoran; Anthropic también acepta ciudad/zona horaria, aquí solo se expone el país.",
				hint_maxUses: "Máximo de llamadas a la herramienta de búsqueda por solicitud. Al alcanzarlo, el endpoint devuelve un error en lugar de buscar, lo que limita coste y latencia.",
				hint_thinking: "default sigue al modelo; disabled desactiva el pensamiento (más rápido y barato). Algunos modelos siempre piensan y devuelven 400 con disabled; el plugin reintenta sin el interruptor.",
				hint_effort: "Nivel de output_config.effort de Anthropic. Los niveles admitidos varían por modelo; si se rechaza, se reintenta sin él. Vacío no envía nada.",
				hint_searchEngine: "Motor de búsqueda de Zhipu; precio y capacidad difieren: std básico, pro avanzado, sogou y quark tienen sus propias cuotas y límites.",
				hint_searchEngineCustom: "El valor del motor lo define la pasarela. Se listan grafías habituales (Zhipu search_std / search_pro, OpenRouter auto / exa / perplexity, searxng / google / bing propios); escriba cualquier otro valor. En la plantilla de Zhipu, un valor vacío envía search_std (la API lo exige); las demás plantillas no usan este parámetro.",
				hint_count: "Número de resultados: 1-50 para Zhipu y DeepSeek, 1-20 para Kimi (los valores superiores se recortan). Un maxResults de la solicitud tiene prioridad; el valor configurado solo se aplica si la solicitud lo omite. Es independiente del número de entradas del resumen.",
				hint_searchRecencyFilter: "Solo páginas publicadas en esta ventana. Las ventanas más estrechas reducen la cobertura pero mejoran las consultas sensibles a la actualidad.",
				hint_contentSize: "Tamaño del fragmento: medium ahorra tokens, high devuelve más detalle a mayor precio.",
				hint_searchDomainFilter: "Restringir los dominios de origen, separados por comas, sin esquema. Vacío significa sin restricción; los motores no compatibles lo ignoran.",
				hint_requireSearch: "Rechazar la respuesta sin resultados de búsqueda, manteniendo el fundamento. Desactivado por defecto; activado, un conjunto vacío falla en lugar de responder con el conocimiento del modelo.",
				hint_searchPrompt: "Prompt de fusión de resultados que controla cómo se integra el contenido de búsqueda. Vacío usa el predeterminado oficial.",
				hint_searchStrategy: "Estrategia de búsqueda de Qwen: turbo la más rápida, max la más profunda, agent/agent_max agéntica. Las más profundas son más lentas y caras.",
				hint_forcedSearch: "Forzar una búsqueda aunque el modelo la considere innecesaria. Úselo para solicitudes que deben estar en línea.",
				hint_freshness: "Solo resultados dentro de esta ventana (Qwen). Vacío significa sin restricción; es el equivalente de Qwen a la recencia de Zhipu.",
				hint_assignedSiteList: "Restringir a estos sitios, separados por comas (Qwen). Vacío significa sin restricción; similar al filtro de dominios de Zhipu.",
				hint_searchExtension: "Parámetro de extensión de búsqueda de Qwen, reenviado tal cual. Vacío lo omite; consulte la documentación de Qwen para los valores admitidos.",
				hint_promptIntervene: "Parámetro de intervención del prompt de Qwen, reenviado tal cual. Vacío lo omite; no lo modifique salvo que conozca su semántica.",
				hint_engine: "Motor de búsqueda de OpenRouter: auto (nativo si existe, si no Exa), native (integrado del proveedor), o exa/firecrawl/parallel/perplexity. Los motores difieren en precio y capacidad.",
				hint_mode: "Modo específico del motor: Exa instant/fast/auto/deep-lite/deep/deep-reasoning, Parallel turbo/fast/basic/advanced. Vacío usa el predeterminado del motor.",
				hint_maxCharacters: "Límite de caracteres por resultado. Tiene prioridad sobre searchContextSize cuando ambos se definen; vacío deja elegir al motor.",
				hint_externalWebAccess: "Si se obtienen páginas en vivo: vacío sigue el predeterminado del endpoint (activado); false usa solo caché/índice, útil para ejecuciones reproducibles o con restricciones de cumplimiento.",
				hint_returnTokenBudget: "Presupuesto de contenido por ejecución de búsqueda: default estándar, unlimited sin límite (más lento y caro). Solo modelos de razonamiento GPT-5+.",
				hint_searchContentTypes: "Tipos de resultado a solicitar, separados por comas: text e image. Incluir image también devuelve resultados de imagen y activa el número y el pie de imagen.",
				hint_imageMaxResults: "Número de resultados de imagen. 0 o vacío desactiva la búsqueda de imágenes; solo se aplica si searchContentTypes incluye image.",
				hint_imageCaption: "Pedir descripciones breves de las imágenes. Ayuda a filtrar y mostrar, con un cuerpo de respuesta algo mayor.",
				hint_responseInclusion: "Cómo aparecen los bloques de búsqueda: full devuelve todo, excluded omite los bloques ya consumidos por la ejecución de código para ahorrar tokens de salida. Solo web_search_20260318+.",
				hint_xSearch: "Parámetros de búsqueda de X/Twitter de OpenRouter y xAI como objeto JSON, p. ej. {\"allowed_x_handles\":[\"OpenRouterAI\"]}. Vacío lo desactiva.",
				hint_maxResults: "Resultados por búsqueda (OpenRouter 1-25, algunos motores 1-20). Combine con maxTotalResults para acotar coste y contexto.",
				hint_maxTotalResults: "Límite acumulado de resultados en todas las búsquedas de una solicitud. Al alcanzarlo, el endpoint indica al modelo que deje de buscar.",
				hint_includeContent: "Devolver también el contenido de la página. Aumenta mucho el tamaño de la respuesta y el uso de tokens; déjelo desactivado si bastan títulos y fragmentos. En la plantilla de Zhipu fija content_size en high; desactívelo para controlar la longitud del fragmento.",
				hint_digestEntries: "Cuántos resultados incluye el resumen de contenido (1-20). Solo moldea el texto del resumen; no recorta las fuentes. Vacío usa 8.",
				hint_digestSnippetChars: "Caracteres máximos por entrada del resumen (1-2000); los fragmentos más largos se truncan. Vacío usa 200.",
				hint_timeoutSeconds: "Tiempo de espera de la solicitud en segundos (Kimi 1-60). Un tiempo agotado hace fallar la búsqueda; auméntelo para consultas largas.",
				hint_oriQuestion: "Adjuntar el mensaje del usuario que originó esta búsqueda (espacios colapsados, cortado a 128 caracteres) para que DeepSeek ordene por intención. Se omite fuera de una sesión o sin mensaje de usuario; solo plantillas de DeepSeek.",
				hint_localization: "IP de localización para el ranking geográfico. Solo se envía una IPv4/IPv6 válida; los valores vacíos o mal formados se omiten.",
				hint_path: "Ruta de la solicitud relativa a baseURL. Obligatoria para pasarelas personalizadas; fijada por el protocolo en los destinos integrados.",
				hint_queryField: "Nombre del campo de consulta en el cuerpo de la solicitud. Vacío usa el predeterminado de la plantilla (Zhipu search_query, DeepSeek query, Kimi text_query).",
				hint_countField: "Nombre del campo de cantidad en el cuerpo de la solicitud. Vacío usa el predeterminado de la plantilla (count para Zhipu/DeepSeek, limit para Kimi).",
				hint_resultsPath: "Ruta con puntos al arreglo de resultados, p. ej. data.items. Vacío usa el predeterminado de la plantilla (Zhipu search_result, DeepSeek results, Kimi search_results).",
				hint_urlField: "Nombre del campo URL de cada resultado. Vacío usa el predeterminado de la plantilla (link para Zhipu, url en los demás).",
				hint_titleField: "Nombre del campo de título de cada resultado. Vacío usa el predeterminado de la plantilla (title).",
				hint_snippetField: "Nombre del campo de fragmento de cada resultado. Vacío usa el predeterminado de la plantilla (content para Zhipu, snippet en los demás).",
				hint_dateField: "Nombre del campo de fecha de cada resultado. Vacío significa que no se analizan fechas; defínalo solo si la respuesta las incluye.",
				hint_contentField: "Nombre del campo de cuerpo largo de cada resultado. El cuerpo pasa a ser el resumen de la fuente (máximo 2000 caracteres, omitido si coincide con snippet) y respalda el digest de content cuando snippet está vacío; vacío = usa el campo summary.",
				field_baseURL: "Punto de conexión",
				field_apiKeyEnv: "Referencia de credencial",
				field_requestTimeoutMs: "Tiempo de espera (ms)",
				field_model: "Modelo",
				field_maxOutputTokens: "Límite de salida",
				field_count: "Número de resultados",
				field_maxUses: "Máximo de búsquedas",
				field_searchEngine: "Motor de búsqueda",
				field_searchRecencyFilter: "Antigüedad",
				field_contentSize: "Tamaño del fragmento",
				field_searchDomainFilter: "Filtro de dominios",
				field_requireSearch: "Exigir búsqueda",
				field_searchPrompt: "Prompt de búsqueda",
				field_reasoningEffort: "Intensidad de razonamiento",
				field_thinking: "Modo de pensamiento",
				field_effort: "Nivel de esfuerzo",
				field_includeSources: "Solicitar fuentes completas",
				field_includeContent: "Incluir contenido",
				field_digestEntries: "Entradas del resumen",
				field_digestSnippetChars: "Caracteres por entrada",
				field_timeoutSeconds: "Tiempo de espera (s)",
				field_oriQuestion: "Pregunta original",
				field_localization: "IP de localización",
				field_path: "Ruta de la solicitud",
				field_template: "Plantilla compatible",
				field_toolType: "Nombre de la herramienta",
				field_queryField: "Campo de consulta",
				field_countField: "Campo de cantidad",
				field_resultsPath: "Ruta de resultados",
				field_urlField: "Campo URL",
				field_titleField: "Campo de título",
				field_snippetField: "Campo de fragmento",
				field_dateField: "Campo de fecha",
				field_contentField: "Campo de contenido",
				field_searchContextSize: "Tamaño del contexto de búsqueda",
				field_allowedDomains: "Dominios permitidos",
				field_blockedDomains: "Dominios bloqueados",
				field_excludedDomains: "Dominios excluidos",
				field_userLocation: "Ubicación del usuario",
				field_engine: "Motor",
				field_mode: "Modo del motor",
				field_maxCharacters: "Máx. caracteres por resultado",
				field_externalWebAccess: "Acceso web en vivo",
				field_returnTokenBudget: "Presupuesto de tokens de retorno",
				field_searchContentTypes: "Tipos de contenido de búsqueda",
				field_imageMaxResults: "Máx. resultados de imagen",
				field_imageCaption: "Pies de imagen",
				field_responseInclusion: "Inclusión en la respuesta",
				field_xSearch: "Búsqueda en X (JSON)",
				field_maxResults: "Máx. resultados",
				field_maxTotalResults: "Máx. resultados totales",
				field_searchStrategy: "Estrategia de búsqueda",
				field_forcedSearch: "Forzar búsqueda",
				field_freshness: "Actualidad",
				field_assignedSiteList: "Sitios asignados",
				field_searchExtension: "Extensión de búsqueda",
				field_promptIntervene: "Intervención del prompt",
				tabNav: "Navegación del plugin",
				tabConfig: "Configuración",
				tabObservability: "Observación",
				obsOverview: "Resumen",
				obsRecords: "Registros",
				obsRange: "Intervalo",
				obsRange_all: "Todo",
				obsTargetFilter: "Destino",
				obsAllTargets: "Todos los destinos",
				obsIncludeTests: "Incluir pruebas de conexión",
				obsRefresh: "Actualizar",
				obsRefreshing: "Actualizando…",
				obsExportJsonl: "Exportar JSONL",
				obsExportCsv: "Exportar CSV",
				obsMetricCount: "Búsquedas",
				obsMetricSuccess: "Tasa de éxito",
				obsMetricP95: "Latencia P95",
				obsMetricSources: "Fuentes medias",
				obsMetricSummary: "Cobertura de resúmenes",
				obsTargetRanking: "Ranking por destino",
				obsEmpty: "Aún no hay búsquedas",
				obsEmptyHint: "Ejecuta una prueba de conexión con la configuración actual o espera a la próxima búsqueda real.",
				obsEmptyFiltered: "Ningún registro coincide con estos filtros",
				obsEmptyFilteredHint: "Ajusta el intervalo, el destino o el estado e inténtalo de nuevo.",
				obsClearFilters: "Borrar filtros",
				obsNoData: "Sin datos",
				obsTableTime: "Hora",
				obsTableTarget: "Destino",
				obsTableQuery: "Consulta",
				obsTableDuration: "Duración",
				obsTableSources: "Fuentes",
				obsTableSummary: "Resúmenes",
				obsTableStatus: "Estado",
				obsTableErrors: "Errores",
				obsStatusOk: "Correcto",
				obsStatusFail: "Fallido",
				obsFilterStatus: "Estado",
				obsAllStatuses: "Todos los estados",
				obsFilterQuery: "Consulta",
				obsFilterQueryHint: "Filtra por consulta; Enter para aplicar",
				obsLoadMore: "Cargar más",
				obsLoadingMore: "Cargando…",
				obsDetailsError: "Error",
				obsDetailsSources: "Fuentes",
				obsDetailsKind: "Tipo",
				obsDetailsAnswer: "Caracteres de respuesta",
				obsDetailsRecordId: "ID del registro",
				obsDetailsSession: "Sesión",
				obsSourceSummary: "Resumen",
				obsSourceSnippet: "Fragmento",
				obsSourceNoTitle: "Sin título",
				obsSourceNoHost: "Sin host",
				obsCopyJson: "Copiar JSON",
				obsCopied: "Copiado",
				obsCopyFailed: "No se pudo copiar",
				obsDataManagement: "Gestión de datos",
				obsClearHint: "Borrar elimina todos los registros de observación y no se puede deshacer. Escribe DELETE para confirmar.",
				obsClearPlaceholder: "Escribe DELETE",
				obsClear: "Borrar datos de observación",
				obsClearing: "Borrando…",
				obsCleared: "Se borraron {count} registros",
				obsRecordsCaption: "Registros de búsqueda",
				obsTrend: "Tendencia",
				obsTrendSuccess: "Tasa de éxito",
				obsTrendP95: "Latencia P95",
				obsTrendAria: "En {buckets} intervalos, tasa de éxito {min}–{max}",
				obsApplyFilters: "Aplicar",
				obsDetailsQuery: "Consulta",
				obsAnswerEmpty: "Este registro no tiene texto de respuesta",
				obsRange_today: "Hoy",
				obsRange_week: "Esta semana",
				obsRange_month: "Este mes",
				obsRange_quarter: "Este trimestre",
				obsRange_year: "Este año",
				obsImport: "Importar historial de búsquedas",
				obsImportHint: "Recorre los registros de sesión locales para recuperar búsquedas web_search de versiones anteriores; repetir solo añade las nuevas.",
				obsImporting: "Importando…",
				obsImportDone: "{sessions} sesiones escaneadas, {imported} importadas (destino identificado en {identified}), {updated} actualizadas, ya existentes {skipped}, fuera de rango {filtered}",
				obsRange_24h: "24 horas",
				obsRange_7d: "7 días",
				obsRange_30d: "30 días",
				obsRangeSince: "Desde {date}",
				obsCalendarPrev: "Mes anterior",
				obsCalendarNext: "Mes siguiente",
				obsRangeUntilNow: "Hasta ahora",
				obsRangePickEnd: "Elige una fecha final",
				obsPrevPage: "Página anterior",
				obsNextPage: "Página siguiente",
				obsPageNumber: "Página {page}",
				obsPageSize: "{size} por página",
				obsPageJump: "Ir a",
				obsPageUnit: "página",
				obsPageSizeLabel: "Filas por página",
				obsImportRange: "Rango de importación",
				obsHistoricalTarget: "Historial"
			},
			fr: {
				description: "Recherche web multiprotocole : intégrée au protocole (Chat Completions / Responses / Anthropic Messages) et recherche autonome, selon le fournisseur.",
				loading: "Lecture de la configuration…",
				loadFailed: "La configuration n'a pas pu être lue ; réessayez lorsque le service du plugin est disponible.",
				unsaved: "Non enregistré",
				save: "Enregistrer",
				saving: "Enregistrement…",
				discard: "Annuler les modifications",
				shape: "Type de recherche",
				shapeInProtocol: "Recherche intégrée au protocole",
				shapeStandalone: "Recherche autonome",
				protocol: "Protocole",
				vendor: "Fournisseur",
				advanced: "Options avancées",
				fieldPlaceholder: "Vide = valeur par défaut",
				unsupported: "Non pris en charge",
				full: "Complet",
				degraded: "Dégradé",
				custom: "Personnalisé",
				unsupportedVendors: "Combinaisons non raccordées dans cette version (le fournisseur peut fonctionner avec un autre protocole)",
				customNotice: "Les points de terminaison personnalisés relèvent de votre responsabilité ; testez après l'enregistrement.",
				fillFromTemplate: "Préremplir depuis un gabarit (indicatif)",
				templateFillHint: "Choisir un gabarit ne remplit que les champs ci-dessous ; le gabarit n'est pas enregistré et le sélecteur se réinitialise après usage.",
				templatePlaceholder: "Choisir un gabarit…",
				templateUsed: "Dernier utilisé : {name}",
				templateOverwrite: "« {name} » écrasera la configuration actuelle (y compris les valeurs enregistrées)",
				templateApply: "Appliquer le gabarit",
				templateCancel: "Annuler",
				resetToSaved: "Revenir à la configuration enregistrée",
				test: "Tester la connexion",
				testing: "Test en cours…",
				testOk: "Connexion réussie",
				testFailed: "Échec du test",
				testSources: "sources",
				testDegraded: "dégradée",
				testNoSourcesByDesign: "cette combinaison ne renvoie aucune source",
				testNoSourcesPartial: "aucune source : la recherche n'a peut-être pas été exécutée, ou aucune page citable n'était disponible",
				testNoSourcesFull: "aucune source renvoyée ; vérifiez le nom de l'outil et le point de terminaison",
				modelLockedHint: "Cette combinaison ne prend en charge que ce modèle ; il n'est pas modifiable.",
				apiKey: "Clé d'API",
				apiKeyHint: "Stockée en écriture seule via le service d'identifiants (~/.dsh/.credentials.yaml), jamais dans le fichier de configuration. Laissez vide pour conserver la clé actuelle.",
				apiKeySet: "Clé configurée",
				apiKeyUnset: "Aucune clé",
				apiKeyByReference: "Dépend de la référence d'identifiant",
				invalidPositive: "Saisissez un entier positif, ou laissez vide pour la valeur par défaut.",
				invalidRange: "Saisissez un entier de 1 à {max}, ou laissez vide pour la valeur par défaut.",
				invalidRefName: "Saisissez un nom de référence d'identifiant valide (lettre ou tiret bas au début ; lettres, chiffres et tirets bas uniquement).",
				invalidJson: "Saisissez un objet JSON, ou laissez vide pour l'omettre.",
				protocolChat: "Chat Completions",
				protocolResponses: "Responses",
				protocolAnthropic: "Anthropic Messages",
				protocolSearch: "Recherche autonome",
				vendorDeepseek: "DeepSeek",
				vendorKimi: "Kimi",
				vendorZhipu: "Zhipu",
				vendorQwen: "Qwen",
				vendorOpenai: "OpenAI",
				vendorAnthropic: "Anthropic",
				vendorOpenrouter: "OpenRouter",
				vendorCustom: "Personnalisé",
				opt_thinking_default: "default (suivre le modèle)",
				opt_thinking_disabled: "disabled (réflexion désactivée, plus rapide)",
				opt_effort_empty: "non envoyé (suivre le modèle)",
				opt_effort_low: "low (faible)",
				opt_effort_medium: "medium (moyen)",
				opt_effort_high: "high (élevé)",
				opt_effort_xhigh: "xhigh (très élevé)",
				opt_effort_max: "max (maximum)",
				opt_searchEngine_search_std: "search_std (Zhipu basique)",
				opt_searchEngine_search_pro: "search_pro (Zhipu avancé)",
				opt_searchEngine_search_pro_sogou: "search_pro_sogou (Sogou)",
				opt_searchEngine_search_pro_quark: "search_pro_quark (Quark)",
				opt_searchRecencyFilter_noLimit: "Sans limite",
				opt_searchRecencyFilter_oneDay: "Dernier jour",
				opt_searchRecencyFilter_oneWeek: "Dernière semaine",
				opt_searchRecencyFilter_oneMonth: "Dernier mois",
				opt_searchRecencyFilter_oneYear: "Dernière année",
				opt_contentSize_medium: "medium (résumé)",
				opt_contentSize_high: "high (détaillé)",
				opt_searchStrategy_turbo: "turbo (le plus rapide)",
				opt_searchStrategy_max: "max (profond)",
				opt_searchStrategy_agent: "agent (agentique)",
				opt_searchStrategy_agent_max: "agent_max (agentique + profond)",
				opt_freshness_empty: "non envoyé",
				opt_freshness_noLimit: "Sans limite",
				opt_freshness_oneDay: "Dernier jour",
				opt_freshness_oneWeek: "Dernière semaine",
				opt_freshness_oneMonth: "Dernier mois",
				opt_freshness_oneYear: "Dernière année",
				opt_searchContextSize_low: "low (peu)",
				opt_searchContextSize_medium: "medium (équilibré)",
				opt_searchContextSize_high: "high (plus)",
				opt_externalWebAccess_empty: "suivre le défaut du point de terminaison (activé)",
				opt_externalWebAccess_true: "true (web en direct)",
				opt_externalWebAccess_false: "false (cache/index uniquement)",
				opt_returnTokenBudget_empty: "non envoyé",
				opt_returnTokenBudget_default: "default (budget standard)",
				opt_returnTokenBudget_unlimited: "unlimited (sans plafond)",
				opt_responseInclusion_empty: "par défaut (full)",
				opt_responseInclusion_full: "full (renvoyer tous les blocs)",
				opt_responseInclusion_excluded: "excluded (omettre les blocs déjà consommés)",
				hint_baseURL: "Préfixe du point de terminaison : officiel ou passerelle auto-hébergée. Vide = valeur par défaut de la combinaison ; les chemins de protocole sont ajoutés par le plugin, n'ajoutez donc pas /responses ici.",
				hint_apiKeyEnv: "Référence d'identifiant : nom de la clé dans le service d'identifiants ou l'environnement. Vide = chaîne par défaut de la combinaison (p. ex. ZAI_CODING_CN_API_KEY puis ZHIPU_API_KEY).",
				hint_requestTimeoutMs: "Délai local d'une recherche. Son expiration est enregistrée comme WEB_PROVIDER_TIMEOUT au lieu d'attendre le budget de l'outil ; vide utilise 25000, le test de connexion 60000.",
				hint_model: "Nom du modèle ; il doit exister sur ce point de terminaison et prendre en charge la recherche intégrée. Vide = valeur par défaut ; un modèle sans recherche ne recherchera jamais.",
				hint_maxOutputTokens: "Plafond de sortie d'un tour de recherche (raisonnement + outils + réponse). C'est un plafond, pas une réservation ; une valeur trop faible tronque le tour et coupe des tours de recherche.",
				hint_toolType: "Nom de l'outil de recherche déclaré dans tools[]. La valeur par défaut dépend du fournisseur ; choisissez une orthographe connue dans la liste ou saisissez un nom propre à la passerelle. Un nom erroné empêche tout bloc de recherche.",
				hint_includeSources: "Demander la liste complète des sources (include). Sur les points de terminaison officiels OpenAI, le champ est réservé à include ; sans lui, seules les annotations de citation subsistent. Désactivez-le pour les passerelles qui le rejettent.",
				hint_reasoningEffort: "Niveau de raisonnement (reasoning.effort). L'ensemble dépend du modèle ; un niveau non pris en charge renvoie 400 et le plugin réessaie sans lui. Vide n'envoie rien.",
				hint_searchContextSize: "Quantité de contexte de recherche transmise au modèle : low économise des jetons, medium équilibre, high est plus complet. Cela influe sur la latence et le coût, pas sur le nombre de sources.",
				hint_allowedDomains: "Uniquement les résultats de ces domaines, séparés par des virgules, sans schéma. OpenAI plafonne à 100 ; incompatible avec blockedDomains (Anthropic renvoie 400 ; le plugin envoie allowed en premier).",
				hint_blockedDomains: "Bloquer ces domaines, séparés par des virgules, sans schéma. Incompatible avec allowedDomains ; la prise en charge varie et les passerelles non compatibles l'ignorent.",
				hint_excludedDomains: "Exclure ces domaines (OpenRouter). Certains moteurs le traitent comme incompatible avec allowedDomains : Exa accepte les deux, d'autres peuvent renvoyer 400.",
				hint_userLocation: "Code pays à deux lettres (p. ex. US) pour le biais géographique. Certains points de terminaison le prennent en charge, d'autres l'ignorent ; Anthropic accepte aussi ville/fuseau horaire, seul le pays est exposé ici.",
				hint_maxUses: "Nombre maximal d'appels à l'outil de recherche par requête. Une fois atteint, le point de terminaison renvoie une erreur au lieu de chercher, ce qui limite coût et latence.",
				hint_thinking: "default suit le modèle ; disabled désactive la réflexion (plus rapide, moins cher). Certains modèles réfléchissent toujours et renvoient 400 pour disabled ; le plugin réessaie sans l'option.",
				hint_effort: "Niveau output_config.effort d'Anthropic. Les niveaux pris en charge varient selon le modèle ; un niveau rejeté est réessayé sans lui. Vide n'envoie rien.",
				hint_searchEngine: "Moteur de recherche Zhipu ; prix et capacités diffèrent : std basique, pro avancé, sogou et quark ont leurs propres quotas et limites.",
				hint_searchEngineCustom: "La valeur du moteur est définie par la passerelle. Les orthographes courantes sont listées (Zhipu search_std / search_pro, OpenRouter auto / exa / perplexity, searxng / google / bing auto-hébergés) ; saisissez toute autre valeur. Sur le gabarit Zhipu, une valeur vide envoie search_std (l'API l'exige) ; les autres gabarits n'utilisent pas ce paramètre.",
				hint_count: "Nombre de résultats : 1-50 pour Zhipu et DeepSeek, 1-20 pour Kimi (les valeurs supérieures sont écrêtées). Un maxResults fourni par la requête prime ; la valeur configurée ne s'applique que si la requête l'omet. Indépendant du nombre d'entrées du digest.",
				hint_searchRecencyFilter: "Uniquement les pages publiées dans cette fenêtre. Des fenêtres plus étroites réduisent le rappel mais améliorent les requêtes sensibles à l'actualité.",
				hint_contentSize: "Taille de l'extrait : medium économise des jetons, high renvoie plus de détails à un prix plus élevé.",
				hint_searchDomainFilter: "Restreindre les domaines sources, séparés par des virgules, sans schéma. Vide = sans restriction ; les moteurs non compatibles l'ignorent.",
				hint_requireSearch: "Refuser de répondre sans résultats de recherche, en gardant l'ancrage. Désactivé par défaut ; activé, un ensemble vide fait échouer la requête au lieu de répondre depuis les connaissances du modèle.",
				hint_searchPrompt: "Prompt de fusion des résultats contrôlant l'intégration du contenu de recherche. Vide = valeur par défaut officielle.",
				hint_searchStrategy: "Stratégie de recherche Qwen : turbo la plus rapide, max la plus profonde, agent/agent_max agentique. Les plus profondes sont plus lentes et plus chères.",
				hint_forcedSearch: "Forcer une recherche même si le modèle la juge inutile. À utiliser pour les requêtes qui doivent être en ligne.",
				hint_freshness: "Uniquement les résultats dans cette fenêtre (Qwen). Vide = sans restriction ; équivalent Qwen de la récence Zhipu.",
				hint_assignedSiteList: "Restreindre à ces sites, séparés par des virgules (Qwen). Vide = sans restriction ; similaire au filtrage de domaines Zhipu.",
				hint_searchExtension: "Paramètre d'extension de recherche Qwen, transmis tel quel. Vide l'omet ; voir la documentation Qwen pour les valeurs acceptées.",
				hint_promptIntervene: "Paramètre d'intervention de prompt Qwen, transmis tel quel. Vide l'omet ; ne le modifiez pas sans en connaître la sémantique.",
				hint_engine: "Moteur de recherche OpenRouter : auto (natif si disponible, sinon Exa), native (intégré au fournisseur), ou exa/firecrawl/parallel/perplexity. Les moteurs diffèrent en prix et en capacités.",
				hint_mode: "Mode propre au moteur : Exa instant/fast/auto/deep-lite/deep/deep-reasoning, Parallel turbo/fast/basic/advanced. Vide = valeur par défaut du moteur.",
				hint_maxCharacters: "Plafond de caractères par résultat. Il prime sur searchContextSize lorsque les deux sont définis ; vide laisse le moteur choisir.",
				hint_externalWebAccess: "Faut-il récupérer les pages en direct : vide suit le défaut du point de terminaison (activé) ; false utilise uniquement cache/index, utile pour des exécutions reproductibles ou contraintes.",
				hint_returnTokenBudget: "Budget de contenu par exécution de recherche : default standard, unlimited sans plafond (plus lent, plus cher). Modèles de raisonnement GPT-5+ uniquement.",
				hint_searchContentTypes: "Types de résultats demandés, séparés par des virgules : text et image. Inclure image renvoie aussi des résultats d'image et active le nombre et la légende d'images.",
				hint_imageMaxResults: "Nombre de résultats d'image. 0 ou vide désactive la recherche d'images ; appliqué uniquement si searchContentTypes inclut image.",
				hint_imageCaption: "Demander de brèves descriptions des images. Utile pour filtrer et afficher, au prix d'une réponse un peu plus volumineuse.",
				hint_responseInclusion: "Présentation des blocs de recherche : full renvoie tout, excluded omet les blocs déjà consommés par l'exécution de code pour économiser des jetons de sortie. web_search_20260318+ uniquement.",
				hint_xSearch: "Paramètres de recherche X/Twitter d'OpenRouter et xAI sous forme d'objet JSON, p. ex. {\"allowed_x_handles\":[\"OpenRouterAI\"]}. Vide le désactive.",
				hint_maxResults: "Résultats par recherche (OpenRouter 1-25, certains moteurs 1-20). À combiner avec maxTotalResults pour limiter coût et contexte.",
				hint_maxTotalResults: "Plafond cumulé de résultats sur toutes les recherches d'une requête. Une fois atteint, le point de terminaison demande au modèle d'arrêter de chercher.",
				hint_includeContent: "Renvoyer aussi le contenu de la page. Cela augmente fortement la taille de la réponse et l'usage de jetons ; laissez désactivé si titres et extraits suffisent. Sur le gabarit Zhipu, force content_size à high ; désactivez-le pour contrôler vous-même la longueur de l'extrait.",
				hint_digestEntries: "Nombre de résultats inclus dans le digest de contenu (1-20). Cela ne façonne que le texte du digest ; les sources ne sont pas tronquées. Vide = 8.",
				hint_digestSnippetChars: "Caractères maximaux par entrée du digest (1-2000) ; les extraits plus longs sont tronqués. Vide = 200.",
				hint_timeoutSeconds: "Délai d'expiration de la requête en secondes (Kimi 1-60). Un dépassement fait échouer la recherche ; augmentez-le pour les requêtes longues.",
				hint_oriQuestion: "Joindre le message utilisateur à l'origine de cette recherche (espaces réduits, coupé à 128 caractères) pour que DeepSeek classe selon l'intention. Omis hors session ou sans message utilisateur ; gabarits DeepSeek uniquement.",
				hint_localization: "IP de localisation pour le classement géographique. Seule une IPv4/IPv6 valide est envoyée ; les valeurs vides ou mal formées sont omises.",
				hint_path: "Chemin de requête relatif à baseURL. Obligatoire pour les passerelles personnalisées ; fixé par le protocole pour les cibles intégrées.",
				hint_queryField: "Nom du champ de requête dans le corps. Vide = valeur par défaut du gabarit (Zhipu search_query, DeepSeek query, Kimi text_query).",
				hint_countField: "Nom du champ de nombre dans le corps. Vide = valeur par défaut du gabarit (count pour Zhipu/DeepSeek, limit pour Kimi).",
				hint_resultsPath: "Chemin pointé vers le tableau de résultats, p. ex. data.items. Vide = valeur par défaut du gabarit (Zhipu search_result, DeepSeek results, Kimi search_results).",
				hint_urlField: "Nom du champ URL de chaque résultat. Vide = valeur par défaut du gabarit (link pour Zhipu, url ailleurs).",
				hint_titleField: "Nom du champ titre de chaque résultat. Vide = valeur par défaut du gabarit (title).",
				hint_snippetField: "Nom du champ extrait de chaque résultat. Vide = valeur par défaut du gabarit (content pour Zhipu, snippet ailleurs).",
				hint_dateField: "Nom du champ date de chaque résultat. Vide = dates non analysées ; à définir seulement si la réponse en contient.",
				hint_contentField: "Nom du champ corps long de chaque résultat. Le corps devient le résumé de la source (2000 caractères max, omis s'il est identique à snippet) et sert de repli au digest content quand snippet est vide ; vide = repli sur le champ summary.",
				field_baseURL: "Point de terminaison",
				field_apiKeyEnv: "Référence d'identifiant",
				field_requestTimeoutMs: "Délai de la requête (ms)",
				field_model: "Modèle",
				field_maxOutputTokens: "Plafond de sortie",
				field_count: "Nombre de résultats",
				field_maxUses: "Appels de recherche max.",
				field_searchEngine: "Moteur de recherche",
				field_searchRecencyFilter: "Récence",
				field_contentSize: "Taille de l'extrait",
				field_searchDomainFilter: "Filtre de domaines",
				field_requireSearch: "Exiger une recherche",
				field_searchPrompt: "Prompt de recherche",
				field_reasoningEffort: "Intensité de raisonnement",
				field_thinking: "Mode de réflexion",
				field_effort: "Niveau d'effort",
				field_includeSources: "Demander toutes les sources",
				field_includeContent: "Inclure le contenu",
				field_digestEntries: "Entrées du digest",
				field_digestSnippetChars: "Caractères par entrée",
				field_timeoutSeconds: "Délai d'expiration (s)",
				field_oriQuestion: "Question d'origine",
				field_localization: "IP de localisation",
				field_path: "Chemin de requête",
				field_template: "Gabarit compatible",
				field_toolType: "Nom de l'outil de recherche",
				field_queryField: "Champ de requête",
				field_countField: "Champ de nombre",
				field_resultsPath: "Chemin des résultats",
				field_urlField: "Champ URL",
				field_titleField: "Champ titre",
				field_snippetField: "Champ extrait",
				field_dateField: "Champ date",
				field_contentField: "Champ contenu",
				field_searchContextSize: "Taille du contexte de recherche",
				field_allowedDomains: "Domaines autorisés",
				field_blockedDomains: "Domaines bloqués",
				field_excludedDomains: "Domaines exclus",
				field_userLocation: "Localisation de l'utilisateur",
				field_engine: "Moteur",
				field_mode: "Mode du moteur",
				field_maxCharacters: "Caractères max. par résultat",
				field_externalWebAccess: "Accès web en direct",
				field_returnTokenBudget: "Budget de jetons retournés",
				field_searchContentTypes: "Types de contenu de recherche",
				field_imageMaxResults: "Résultats d'image max.",
				field_imageCaption: "Légendes d'images",
				field_responseInclusion: "Inclusion dans la réponse",
				field_xSearch: "Recherche X (JSON)",
				field_maxResults: "Résultats max.",
				field_maxTotalResults: "Résultats totaux max.",
				field_searchStrategy: "Stratégie de recherche",
				field_forcedSearch: "Forcer la recherche",
				field_freshness: "Fraîcheur",
				field_assignedSiteList: "Sites assignés",
				field_searchExtension: "Extension de recherche",
				field_promptIntervene: "Intervention de prompt",
				tabNav: "Navigation du plugin",
				tabConfig: "Configuration",
				tabObservability: "Observabilité",
				obsOverview: "Aperçu",
				obsRecords: "Enregistrements",
				obsRange: "Période",
				obsRange_all: "Tout",
				obsTargetFilter: "Cible",
				obsAllTargets: "Toutes les cibles",
				obsIncludeTests: "Inclure les tests de connexion",
				obsRefresh: "Actualiser",
				obsRefreshing: "Actualisation…",
				obsExportJsonl: "Exporter JSONL",
				obsExportCsv: "Exporter CSV",
				obsMetricCount: "Recherches",
				obsMetricSuccess: "Taux de réussite",
				obsMetricP95: "Latence P95",
				obsMetricSources: "Sources moyennes",
				obsMetricSummary: "Couverture des résumés",
				obsTargetRanking: "Classement par cible",
				obsEmpty: "Aucune recherche pour l'instant",
				obsEmptyHint: "Lancez un test de connexion avec la configuration actuelle ou attendez la prochaine recherche réelle.",
				obsEmptyFiltered: "Aucun enregistrement ne correspond à ces filtres",
				obsEmptyFilteredHint: "Ajustez la période, la cible ou le statut, puis réessayez.",
				obsClearFilters: "Effacer les filtres",
				obsNoData: "Aucune donnée",
				obsTableTime: "Heure",
				obsTableTarget: "Cible",
				obsTableQuery: "Requête",
				obsTableDuration: "Durée",
				obsTableSources: "Sources",
				obsTableSummary: "Résumés",
				obsTableStatus: "Statut",
				obsTableErrors: "Erreurs",
				obsStatusOk: "Réussi",
				obsStatusFail: "Échoué",
				obsFilterStatus: "Statut",
				obsAllStatuses: "Tous les statuts",
				obsFilterQuery: "Requête",
				obsFilterQueryHint: "Filtrer par requête ; Entrée pour appliquer",
				obsLoadMore: "Charger plus",
				obsLoadingMore: "Chargement…",
				obsDetailsError: "Erreur",
				obsDetailsSources: "Sources",
				obsDetailsKind: "Type",
				obsDetailsAnswer: "Caractères de réponse",
				obsDetailsRecordId: "ID d'enregistrement",
				obsDetailsSession: "Session",
				obsSourceSummary: "Résumé",
				obsSourceSnippet: "Extrait",
				obsSourceNoTitle: "Sans titre",
				obsSourceNoHost: "Sans hôte",
				obsCopyJson: "Copier le JSON",
				obsCopied: "Copié",
				obsCopyFailed: "Échec de la copie",
				obsDataManagement: "Gestion des données",
				obsClearHint: "La suppression efface tous les enregistrements d'observation et est irréversible. Saisissez DELETE pour confirmer.",
				obsClearPlaceholder: "Saisissez DELETE",
				obsClear: "Effacer les données d'observation",
				obsClearing: "Suppression…",
				obsCleared: "{count} enregistrements effacés",
				obsRecordsCaption: "Enregistrements de recherche",
				obsTrend: "Tendance",
				obsTrendSuccess: "Taux de réussite",
				obsTrendP95: "Latence P95",
				obsTrendAria: "Sur {buckets} intervalles, taux de réussite {min}–{max}",
				obsApplyFilters: "Appliquer",
				obsDetailsQuery: "Requête",
				obsAnswerEmpty: "Cet enregistrement n'a pas de texte de réponse",
				obsRange_today: "Aujourd'hui",
				obsRange_week: "Cette semaine",
				obsRange_month: "Ce mois",
				obsRange_quarter: "Ce trimestre",
				obsRange_year: "Cette année",
				obsImport: "Importer l'historique de recherche",
				obsImportHint: "Parcourt les journaux de session locaux pour récupérer les recherches web_search des versions précédentes ; relancer n'ajoute que les nouvelles.",
				obsImporting: "Importation…",
				obsImportDone: "{sessions} sessions analysées, {imported} importées (cible identifiée pour {identified}), {updated} mises à jour, déjà présentes {skipped}, hors plage {filtered}",
				obsRange_24h: "24 heures",
				obsRange_7d: "7 jours",
				obsRange_30d: "30 jours",
				obsRangeSince: "Depuis {date}",
				obsCalendarPrev: "Mois précédent",
				obsCalendarNext: "Mois suivant",
				obsRangeUntilNow: "Jusqu'à maintenant",
				obsRangePickEnd: "Choisissez une date de fin",
				obsPrevPage: "Page précédente",
				obsNextPage: "Page suivante",
				obsPageNumber: "Page {page}",
				obsPageSize: "{size} par page",
				obsPageJump: "Aller à",
				obsPageUnit: "page",
				obsPageSizeLabel: "Lignes par page",
				obsImportRange: "Plage d'importation",
				obsHistoricalTarget: "Historique"
			},
			de: {
				description: "Multiprotokoll-Websuche: protokollintegriert (Chat Completions / Responses / Anthropic Messages) und eigenständige Suche, nach Anbieter ausgewählt.",
				loading: "Konfiguration wird gelesen…",
				loadFailed: "Die Konfiguration konnte nicht gelesen werden; versuchen Sie es erneut, sobald der Plugin-Dienst verfügbar ist.",
				unsaved: "Nicht gespeichert",
				save: "Speichern",
				saving: "Wird gespeichert…",
				discard: "Änderungen verwerfen",
				shape: "Suchart",
				shapeInProtocol: "Protokollintegrierte Suche",
				shapeStandalone: "Eigenständige Suche",
				protocol: "Protokoll",
				vendor: "Anbieter",
				advanced: "Erweiterte Optionen",
				fieldPlaceholder: "Leer = Standardwert",
				unsupported: "Nicht unterstützt",
				full: "Vollständig",
				degraded: "Eingeschränkt",
				custom: "Benutzerdefiniert",
				unsupportedVendors: "In diesem Build nicht angebundene Kombinationen (der Anbieter kann in einem anderen Protokoll funktionieren)",
				customNotice: "Benutzerdefinierte Endpunkte liegen in Ihrer Verantwortung; testen Sie nach dem Speichern.",
				fillFromTemplate: "Aus Vorlage vorbelegen (nur Referenz)",
				templateFillHint: "Das Wählen einer Vorlage füllt nur die Felder unten aus; die Vorlage selbst wird nicht gespeichert und die Auswahl nach der Verwendung zurückgesetzt.",
				templatePlaceholder: "Vorlage wählen…",
				templateUsed: "Zuletzt verwendet: {name}",
				templateOverwrite: "„{name}“ überschreibt die aktuelle Konfiguration (einschließlich gespeicherter Werte)",
				templateApply: "Vorlage anwenden",
				templateCancel: "Abbrechen",
				resetToSaved: "Auf gespeicherte Konfiguration zurücksetzen",
				test: "Verbindung testen",
				testing: "Wird getestet…",
				testOk: "Verbindung erfolgreich",
				testFailed: "Test fehlgeschlagen",
				testSources: "Quellen",
				testDegraded: "eingeschränkte Kombination",
				testNoSourcesByDesign: "diese Kombination liefert keine Quellen",
				testNoSourcesPartial: "keine Quellen: Die Suche wurde möglicherweise nicht ausgeführt oder es gab keine zitierbare Seite",
				testNoSourcesFull: "keine Quellen zurückgegeben; prüfen Sie Werkzeugname und Endpunkt",
				modelLockedHint: "Diese Kombination unterstützt nur dieses Modell; es kann nicht geändert werden.",
				apiKey: "API-Schlüssel",
				apiKeyHint: "Wird nur schreibend über den Anmeldedaten-Dienst (~/.dsh/.credentials.yaml) gespeichert, nie in der Konfigurationsdatei. Leer lassen, um den aktuellen Schlüssel beizubehalten.",
				apiKeySet: "Schlüssel konfiguriert",
				apiKeyUnset: "Kein Schlüssel",
				apiKeyByReference: "Hängt von der Anmeldedaten-Referenz ab",
				invalidPositive: "Geben Sie eine positive ganze Zahl ein oder lassen Sie das Feld für den Standardwert leer.",
				invalidRange: "Geben Sie eine ganze Zahl von 1 bis {max} ein oder lassen Sie das Feld für den Standardwert leer.",
				invalidRefName: "Geben Sie einen gültigen Referenznamen für Anmeldedaten ein (Buchstabe oder Unterstrich am Anfang; nur Buchstaben, Ziffern und Unterstriche).",
				invalidJson: "Geben Sie ein JSON-Objekt ein oder lassen Sie das Feld leer, um es wegzulassen.",
				protocolChat: "Chat Completions",
				protocolResponses: "Responses",
				protocolAnthropic: "Anthropic Messages",
				protocolSearch: "Eigenständige Suche",
				vendorDeepseek: "DeepSeek",
				vendorKimi: "Kimi",
				vendorZhipu: "Zhipu",
				vendorQwen: "Qwen",
				vendorOpenai: "OpenAI",
				vendorAnthropic: "Anthropic",
				vendorOpenrouter: "OpenRouter",
				vendorCustom: "Benutzerdefiniert",
				opt_thinking_default: "default (Modell folgen)",
				opt_thinking_disabled: "disabled (Denken aus, schneller)",
				opt_effort_empty: "nicht gesendet (Modell folgen)",
				opt_effort_low: "low (niedrig)",
				opt_effort_medium: "medium (mittel)",
				opt_effort_high: "high (hoch)",
				opt_effort_xhigh: "xhigh (sehr hoch)",
				opt_effort_max: "max (maximal)",
				opt_searchEngine_search_std: "search_std (Zhipu Basis)",
				opt_searchEngine_search_pro: "search_pro (Zhipu erweitert)",
				opt_searchEngine_search_pro_sogou: "search_pro_sogou (Sogou)",
				opt_searchEngine_search_pro_quark: "search_pro_quark (Quark)",
				opt_searchRecencyFilter_noLimit: "Keine Begrenzung",
				opt_searchRecencyFilter_oneDay: "Letzter Tag",
				opt_searchRecencyFilter_oneWeek: "Letzte Woche",
				opt_searchRecencyFilter_oneMonth: "Letzter Monat",
				opt_searchRecencyFilter_oneYear: "Letztes Jahr",
				opt_contentSize_medium: "medium (Zusammenfassung)",
				opt_contentSize_high: "high (ausführlich)",
				opt_searchStrategy_turbo: "turbo (schnellste)",
				opt_searchStrategy_max: "max (tief)",
				opt_searchStrategy_agent: "agent (agentisch)",
				opt_searchStrategy_agent_max: "agent_max (agentisch + tief)",
				opt_freshness_empty: "nicht gesendet",
				opt_freshness_noLimit: "Keine Begrenzung",
				opt_freshness_oneDay: "Letzter Tag",
				opt_freshness_oneWeek: "Letzte Woche",
				opt_freshness_oneMonth: "Letzter Monat",
				opt_freshness_oneYear: "Letztes Jahr",
				opt_searchContextSize_low: "low (wenig)",
				opt_searchContextSize_medium: "medium (ausgeglichen)",
				opt_searchContextSize_high: "high (mehr)",
				opt_externalWebAccess_empty: "Endpunkt-Standard folgen (an)",
				opt_externalWebAccess_true: "true (Live-Web)",
				opt_externalWebAccess_false: "false (nur Cache/Index)",
				opt_returnTokenBudget_empty: "nicht gesendet",
				opt_returnTokenBudget_default: "default (Standardbudget)",
				opt_returnTokenBudget_unlimited: "unlimited (ohne Obergrenze)",
				opt_responseInclusion_empty: "Standard (full)",
				opt_responseInclusion_full: "full (alle Blöcke zurückgeben)",
				opt_responseInclusion_excluded: "excluded (bereits verbrauchte Blöcke weglassen)",
				hint_baseURL: "Endpunkt-Präfix: offiziell oder eigenes Gateway. Leer = Standard der Kombination; Protokollpfade fügt das Plugin hinzu, /responses hier also nicht wiederholen.",
				hint_apiKeyEnv: "Anmeldedaten-Referenz: Schlüsselname im Anmeldedaten-Dienst oder in der Umgebung. Leer = Standardkette der Kombination (z. B. ZAI_CODING_CN_API_KEY, dann ZHIPU_API_KEY).",
				hint_requestTimeoutMs: "Lokales Zeitlimit einer Suche. Bei Ablauf wird WEB_PROVIDER_TIMEOUT erfasst, statt auf das Tool-Budget zu warten; leer nutzt 25000, der Verbindungstest 60000.",
				hint_model: "Modellname; er muss an diesem Endpunkt existieren und integrierte Suche unterstützen. Leer = Standard der Kombination; ein Modell ohne Suchunterstützung sucht nie.",
				hint_maxOutputTokens: "Ausgabegrenze für einen Suchzug (Schlussfolgern + Werkzeuge + Antwort). Es ist eine Obergrenze, keine Reservierung; ein zu kleiner Wert kürzt den Zug und schneidet Suchrunden ab.",
				hint_toolType: "Name des in tools[] deklarierten Suchwerkzeugs. Der Standard folgt dem Anbieter; wählen Sie eine bekannte Schreibweise aus der Liste oder geben Sie einen gateway-spezifischen Namen ein. Ein falscher Name bedeutet, dass kein Suchblock erscheint.",
				hint_includeSources: "Die vollständige Quellenliste anfordern (include). Bei echten OpenAI-Endpunkten ist das Feld nur für include gedacht; ohne es bleiben nur Zitationsannotationen. Für Gateways, die es ablehnen, ausschalten.",
				hint_reasoningEffort: "Denkstufe (reasoning.effort). Der Satz hängt vom Modell ab; eine nicht unterstützte Stufe liefert 400 und das Plugin versucht es ohne sie erneut. Leer sendet nichts.",
				hint_searchContextSize: "Wie viel Suchkontext das Modell erreicht: low spart Token, medium gleicht aus, high ist vollständiger. Das beeinflusst Latenz und Kosten, nicht die Quellenzahl.",
				hint_allowedDomains: "Nur Ergebnisse dieser Domains, durch Kommas getrennt, ohne Schema. OpenAI begrenzt auf 100; es schließt blockedDomains aus (Anthropic liefert 400, das Plugin sendet zuerst allowed).",
				hint_blockedDomains: "Diese Domains blockieren, durch Kommas getrennt, ohne Schema. Schließt allowedDomains aus; die Unterstützung variiert und nicht unterstützende Gateways ignorieren es.",
				hint_excludedDomains: "Diese Domains ausschließen (OpenRouter). Manche Engines behandeln es als unvereinbar mit allowedDomains: Exa akzeptiert beides, andere liefern möglicherweise 400.",
				hint_userLocation: "Zweistelliger Ländercode (z. B. US) für geografische Gewichtung. Manche Endpunkte unterstützen es, andere ignorieren es; Anthropic akzeptiert auch Stadt/Zeitzone, hier wird nur das Land angeboten.",
				hint_maxUses: "Maximale Aufrufe des Suchwerkzeugs pro Anfrage. Danach liefert der Endpunkt einen Fehler statt zu suchen, was Kosten und Latenz begrenzt.",
				hint_thinking: "default folgt dem Modell; disabled schaltet das Denken aus (schneller, günstiger). Manche Modelle denken immer und antworten mit 400 auf disabled; das Plugin versucht es ohne den Schalter erneut.",
				hint_effort: "Anthropic output_config.effort-Stufe. Unterstützte Stufen unterscheiden sich je Modell; eine abgelehnte Stufe wird ohne sie erneut versucht. Leer sendet nichts.",
				hint_searchEngine: "Zhipu-Suchmaschine; Preis und Fähigkeiten unterscheiden sich: std Basis, pro erweitert, sogou und quark haben eigene Kontingente und Grenzen.",
				hint_searchEngineCustom: "Der Engine-Wert wird vom Gateway definiert. Häufige Schreibweisen sind aufgeführt (Zhipu search_std / search_pro, OpenRouter auto / exa / perplexity, selbst gehostetes searxng / google / bing); geben Sie jeden anderen Wert ein. Bei der Zhipu-Vorlage sendet ein leerer Wert search_std (die API verlangt es); andere Vorlagen nutzen diesen Parameter nicht.",
				hint_count: "Ergebnisanzahl: 1-50 für Zhipu und DeepSeek, 1-20 für Kimi (höhere Werte werden gekappt). Ein von der Anfrage übergebenes maxResults hat Vorrang; der konfigurierte Wert gilt nur, wenn die Anfrage es weglässt. Unabhängig von der Anzahl der Digest-Einträge.",
				hint_searchRecencyFilter: "Nur Seiten, die in diesem Zeitfenster veröffentlicht wurden. Engere Fenster senken den Recall, verbessern aber aktualitätskritische Abfragen.",
				hint_contentSize: "Snippet-Größe: medium spart Token, high liefert mehr Details zu höherem Preis.",
				hint_searchDomainFilter: "Quelldomains einschränken, durch Kommas getrennt, ohne Schema. Leer = unbegrenzt; nicht unterstützende Engines ignorieren es.",
				hint_requireSearch: "Ohne Suchergebnisse nicht antworten, um die Fundierung zu wahren. Standardmäßig aus; wenn an, schlägt eine leere Ergebnismenge fehl, statt aus Modellwissen zu antworten.",
				hint_searchPrompt: "Ergebnis-Fusions-Prompt, der steuert, wie Suchinhalte eingebunden werden. Leer = offizieller Standard.",
				hint_searchStrategy: "Qwen-Suchstrategie: turbo am schnellsten, max am tiefsten, agent/agent_max agentisch. Tiefere Strategien sind langsamer und teurer.",
				hint_forcedSearch: "Eine Suche erzwingen, auch wenn das Modell sie für unnötig hält. Für Anfragen, die online sein müssen.",
				hint_freshness: "Nur Ergebnisse in diesem Zeitfenster (Qwen). Leer = unbegrenzt; das Qwen-Gegenstück zur Zhipu-Aktualität.",
				hint_assignedSiteList: "Auf diese Sites beschränken, durch Kommas getrennt (Qwen). Leer = unbegrenzt; ähnlich der Zhipu-Domainfilterung.",
				hint_searchExtension: "Qwen-Sucherweiterungsparameter, unverändert weitergegeben. Leer lässt ihn weg; zulässige Werte siehe Qwen-Dokumentation.",
				hint_promptIntervene: "Qwen-Prompt-Interventionsparameter, unverändert weitergegeben. Leer lässt ihn weg; nur ändern, wenn die Semantik bekannt ist.",
				hint_engine: "OpenRouter-Suchmaschine: auto (nativ wenn verfügbar, sonst Exa), native (anbietereigen), oder exa/firecrawl/parallel/perplexity. Engines unterscheiden sich in Preis und Fähigkeit.",
				hint_mode: "Engine-spezifischer Modus: Exa instant/fast/auto/deep-lite/deep/deep-reasoning, Parallel turbo/fast/basic/advanced. Leer = Engine-Standard.",
				hint_maxCharacters: "Zeichengrenze pro Ergebnis. Sie hat Vorrang vor searchContextSize, wenn beide gesetzt sind; leer lässt die Engine wählen.",
				hint_externalWebAccess: "Ob Live-Seiten abgerufen werden: leer folgt dem Endpunkt-Standard (an); false nutzt nur Cache/Index, nützlich für reproduzierbare oder compliance-eingeschränkte Läufe.",
				hint_returnTokenBudget: "Inhaltsbudget pro Suchlauf: default Standard, unlimited ohne Obergrenze (langsamer, teurer). Nur GPT-5+ Reasoning-Modelle.",
				hint_searchContentTypes: "Angeforderte Ergebnistypen, durch Kommas getrennt: text und image. Mit image werden auch Bilderseiten zurückgegeben und Bildanzahl sowie Bildunterschrift aktiviert.",
				hint_imageMaxResults: "Anzahl der Bilderseiten. 0 oder leer deaktiviert die Bildersuche; gilt nur, wenn searchContentTypes image enthält.",
				hint_imageCaption: "Kurze Bildbeschreibungen anfordern. Hilfreich zum Filtern und Anzeigen, bei etwas größerer Antwort.",
				hint_responseInclusion: "Darstellung der Suchblöcke: full gibt alles zurück, excluded lässt bereits von der Codeausführung verbrauchte Blöcke weg, um Ausgabetoken zu sparen. Nur web_search_20260318+.",
				hint_xSearch: "X/Twitter-Suchparameter von OpenRouter und xAI als JSON-Objekt, z. B. {\"allowed_x_handles\":[\"OpenRouterAI\"]}. Leer deaktiviert es.",
				hint_maxResults: "Ergebnisse pro Suche (OpenRouter 1-25, manche Engines 1-20). Mit maxTotalResults kombinieren, um Kosten und Kontext zu begrenzen.",
				hint_maxTotalResults: "Kumulative Ergebnisobergrenze über alle Suchen einer Anfrage. Danach weist der Endpunkt das Modell an, die Suche zu beenden.",
				hint_includeContent: "Auch Seiteninhalt zurückgeben. Das erhöht Antwortgröße und Tokenverbrauch deutlich; aus lassen, wenn Titel und Snippets genügen. Bei der Zhipu-Vorlage wird content_size auf high fixiert; ausschalten, um die Snippet-Länge selbst zu steuern.",
				hint_digestEntries: "Wie viele Ergebnisse der Inhalts-Digest enthält (1-20). Es formt nur den Digest-Text; Quellen werden nicht gekürzt. Leer = 8.",
				hint_digestSnippetChars: "Maximale Zeichen pro Digest-Eintrag (1-2000); längere Snippets werden gekürzt. Leer = 200.",
				hint_timeoutSeconds: "Anfrage-Timeout in Sekunden (Kimi 1-60). Ein Timeout lässt die Suche fehlschlagen; für lange Abfragen erhöhen.",
				hint_oriQuestion: "Die auslösende Nutzereingabe anhängen (Leerraum zusammengefasst, auf 128 Zeichen gekürzt), damit DeepSeek nach Absicht sortieren kann. Wird außerhalb einer Sitzung oder ohne Nutzereingabe weggelassen; nur DeepSeek-Vorlagen.",
				hint_localization: "Lokalisierungs-IP für geografisches Ranking. Nur eine gültige IPv4/IPv6 wird gesendet; leere oder fehlerhafte Werte werden weggelassen.",
				hint_path: "Anfragepfad relativ zu baseURL. Für benutzerdefinierte Gateways erforderlich; bei integrierten Zielen durch das Protokoll festgelegt.",
				hint_queryField: "Name des Abfragefelds im Anfragetext. Leer = Vorlagenstandard (Zhipu search_query, DeepSeek query, Kimi text_query).",
				hint_countField: "Name des Anzahlfelds im Anfragetext. Leer = Vorlagenstandard (count für Zhipu/DeepSeek, limit für Kimi).",
				hint_resultsPath: "Punktpfad zum Ergebnisarray, z. B. data.items. Leer = Vorlagenstandard (Zhipu search_result, DeepSeek results, Kimi search_results).",
				hint_urlField: "Name des URL-Felds pro Ergebnis. Leer = Vorlagenstandard (link für Zhipu, sonst url).",
				hint_titleField: "Name des Titelfelds pro Ergebnis. Leer = Vorlagenstandard (title).",
				hint_snippetField: "Name des Snippet-Felds pro Ergebnis. Leer = Vorlagenstandard (content für Zhipu, sonst snippet).",
				hint_dateField: "Name des Datumsfelds pro Ergebnis. Leer = Datumsangaben werden nicht ausgewertet; nur setzen, wenn die Antwort sie enthält.",
				hint_contentField: "Name des Langtextfelds pro Ergebnis. Der Text wird zur Quellzusammenfassung (max. 2000 Zeichen, entfällt bei Gleichheit mit snippet) und dient als Rückfall für den content-Digest, wenn snippet leer ist; leer = Rückfall auf das Feld summary.",
				field_baseURL: "Endpunkt",
				field_apiKeyEnv: "Anmeldedaten-Referenz",
				field_requestTimeoutMs: "Anfrage-Timeout (ms)",
				field_model: "Modell",
				field_maxOutputTokens: "Ausgabegrenze",
				field_count: "Ergebnisanzahl",
				field_maxUses: "Max. Suchaufrufe",
				field_searchEngine: "Suchmaschine",
				field_searchRecencyFilter: "Aktualität",
				field_contentSize: "Snippet-Größe",
				field_searchDomainFilter: "Domainfilter",
				field_requireSearch: "Suchergebnisse erforderlich",
				field_searchPrompt: "Such-Prompt",
				field_reasoningEffort: "Denkintensität",
				field_thinking: "Denkmodus",
				field_effort: "Denkstufe",
				field_includeSources: "Vollständige Quellen anfordern",
				field_includeContent: "Inhalt einbeziehen",
				field_digestEntries: "Digest-Einträge",
				field_digestSnippetChars: "Zeichen pro Eintrag",
				field_timeoutSeconds: "Timeout (s)",
				field_oriQuestion: "Ursprüngliche Frage",
				field_localization: "Lokalisierungs-IP",
				field_path: "Anfragepfad",
				field_template: "Kompatible Vorlage",
				field_toolType: "Name des Suchwerkzeugs",
				field_queryField: "Abfragefeld",
				field_countField: "Anzahlfeld",
				field_resultsPath: "Ergebnispfad",
				field_urlField: "URL-Feld",
				field_titleField: "Titelfeld",
				field_snippetField: "Snippet-Feld",
				field_dateField: "Datumsfeld",
				field_contentField: "Inhaltsfeld",
				field_searchContextSize: "Suchkontextgröße",
				field_allowedDomains: "Erlaubte Domains",
				field_blockedDomains: "Blockierte Domains",
				field_excludedDomains: "Ausgeschlossene Domains",
				field_userLocation: "Nutzerstandort",
				field_engine: "Engine",
				field_mode: "Engine-Modus",
				field_maxCharacters: "Max. Zeichen pro Ergebnis",
				field_externalWebAccess: "Live-Webzugriff",
				field_returnTokenBudget: "Rückgabe-Tokenbudget",
				field_searchContentTypes: "Suchinhaltstypen",
				field_imageMaxResults: "Max. Bilderseiten",
				field_imageCaption: "Bildunterschriften",
				field_responseInclusion: "Antwort-Einbeziehung",
				field_xSearch: "X-Suche (JSON)",
				field_maxResults: "Max. Ergebnisse",
				field_maxTotalResults: "Max. Gesamtergebnisse",
				field_searchStrategy: "Suchstrategie",
				field_forcedSearch: "Suche erzwingen",
				field_freshness: "Zeitfenster",
				field_assignedSiteList: "Zugewiesene Sites",
				field_searchExtension: "Sucherweiterung",
				field_promptIntervene: "Prompt-Intervention",
				tabNav: "Plugin-Navigation",
				tabConfig: "Konfiguration",
				tabObservability: "Beobachtung",
				obsOverview: "Übersicht",
				obsRecords: "Einträge",
				obsRange: "Zeitraum",
				obsRange_all: "Alle",
				obsTargetFilter: "Ziel",
				obsAllTargets: "Alle Ziele",
				obsIncludeTests: "Verbindungstests einbeziehen",
				obsRefresh: "Aktualisieren",
				obsRefreshing: "Wird aktualisiert…",
				obsExportJsonl: "JSONL exportieren",
				obsExportCsv: "CSV exportieren",
				obsMetricCount: "Suchvorgänge",
				obsMetricSuccess: "Erfolgsrate",
				obsMetricP95: "P95-Latenz",
				obsMetricSources: "Ø Quellen",
				obsMetricSummary: "Zusammenfassungsabdeckung",
				obsTargetRanking: "Ziel-Ranking",
				obsEmpty: "Noch keine Suchvorgänge",
				obsEmptyHint: "Führen Sie mit der aktuellen Konfiguration einen Verbindungstest aus oder warten Sie auf die nächste echte Suche.",
				obsEmptyFiltered: "Keine Einträge entsprechen diesen Filtern",
				obsEmptyFilteredHint: "Passen Sie Zeitraum, Ziel oder Status an und versuchen Sie es erneut.",
				obsClearFilters: "Filter zurücksetzen",
				obsNoData: "Keine Daten",
				obsTableTime: "Zeit",
				obsTableTarget: "Ziel",
				obsTableQuery: "Suchbegriff",
				obsTableDuration: "Dauer",
				obsTableSources: "Quellen",
				obsTableSummary: "Zusammenfassungen",
				obsTableStatus: "Status",
				obsTableErrors: "Fehler",
				obsStatusOk: "Erfolgreich",
				obsStatusFail: "Fehlgeschlagen",
				obsFilterStatus: "Status",
				obsAllStatuses: "Alle Status",
				obsFilterQuery: "Suchbegriff",
				obsFilterQueryHint: "Nach Suchbegriff filtern; Enter zum Anwenden",
				obsLoadMore: "Mehr laden",
				obsLoadingMore: "Wird geladen…",
				obsDetailsError: "Fehler",
				obsDetailsSources: "Quellen",
				obsDetailsKind: "Art",
				obsDetailsAnswer: "Antwortzeichen",
				obsDetailsRecordId: "Eintrags-ID",
				obsDetailsSession: "Sitzung",
				obsSourceSummary: "Zusammenfassung",
				obsSourceSnippet: "Ausschnitt",
				obsSourceNoTitle: "Ohne Titel",
				obsSourceNoHost: "Ohne Host",
				obsCopyJson: "JSON kopieren",
				obsCopied: "Kopiert",
				obsCopyFailed: "Kopieren fehlgeschlagen",
				obsDataManagement: "Datenverwaltung",
				obsClearHint: "Löschen entfernt alle Beobachtungseinträge unwiderruflich. Geben Sie DELETE zur Bestätigung ein.",
				obsClearPlaceholder: "DELETE eingeben",
				obsClear: "Beobachtungsdaten löschen",
				obsClearing: "Wird gelöscht…",
				obsCleared: "{count} Einträge gelöscht",
				obsRecordsCaption: "Sucheinträge",
				obsTrend: "Verlauf",
				obsTrendSuccess: "Erfolgsrate",
				obsTrendP95: "P95-Latenz",
				obsTrendAria: "Über {buckets} Zeitfenster, Erfolgsrate {min}–{max}",
				obsApplyFilters: "Anwenden",
				obsDetailsQuery: "Suchbegriff",
				obsAnswerEmpty: "Für diesen Eintrag wurde kein Antworttext gespeichert",
				obsRange_today: "Heute",
				obsRange_week: "Diese Woche",
				obsRange_month: "Dieser Monat",
				obsRange_quarter: "Dieses Quartal",
				obsRange_year: "Dieses Jahr",
				obsImport: "Suchverlauf importieren",
				obsImportHint: "Durchsucht lokale Sitzungsprotokolle nach web_search-Einträgen älterer Versionen; erneutes Ausführen ergänzt nur neue.",
				obsImporting: "Wird importiert…",
				obsImportDone: "{sessions} Sitzungen geprüft, {imported} importiert (Ziel erkannt für {identified}), {updated} aktualisiert, bereits vorhanden {skipped}, außerhalb {filtered}",
				obsRange_24h: "24 Stunden",
				obsRange_7d: "7 Tage",
				obsRange_30d: "30 Tage",
				obsRangeSince: "Seit {date}",
				obsCalendarPrev: "Vorheriger Monat",
				obsCalendarNext: "Nächster Monat",
				obsRangeUntilNow: "Bis jetzt",
				obsRangePickEnd: "Enddatum wählen",
				obsPrevPage: "Vorherige Seite",
				obsNextPage: "Nächste Seite",
				obsPageNumber: "Seite {page}",
				obsPageSize: "{size} pro Seite",
				obsPageJump: "Gehe zu",
				obsPageUnit: "Seite",
				obsPageSizeLabel: "Zeilen pro Seite",
				obsImportRange: "Importbereich",
				obsHistoricalTarget: "Verlauf"
			},
			ru: {
				description: "Мультипротокольный веб-поиск: встроенный в протокол (Chat Completions / Responses / Anthropic Messages) и автономный поиск, с выбором по поставщику.",
				loading: "Чтение конфигурации…",
				loadFailed: "Не удалось прочитать конфигурацию; повторите попытку, когда служба плагина станет доступна.",
				unsaved: "Не сохранено",
				save: "Сохранить",
				saving: "Сохранение…",
				discard: "Отменить изменения",
				shape: "Тип поиска",
				shapeInProtocol: "Встроенный в протокол поиск",
				shapeStandalone: "Автономный поиск",
				protocol: "Протокол",
				vendor: "Поставщик",
				advanced: "Дополнительно",
				fieldPlaceholder: "Пусто — значение по умолчанию",
				unsupported: "Не поддерживается",
				full: "Полный",
				degraded: "Ограниченный",
				custom: "Пользовательский",
				unsupportedVendors: "Комбинации, не подключённые в этой сборке (поставщик может работать в другом протоколе)",
				customNotice: "Пользовательские эндпоинты — ваша ответственность; проверьте после сохранения.",
				fillFromTemplate: "Заполнить из шаблона (справочно)",
				templateFillHint: "Выбор шаблона заполняет только поля ниже; сам шаблон не сохраняется, а выбор сбрасывается после использования.",
				templatePlaceholder: "Выбрать шаблон…",
				templateUsed: "Последний: {name}",
				templateOverwrite: "«{name}» перезапишет текущую конфигурацию (включая сохранённые значения)",
				templateApply: "Применить шаблон",
				templateCancel: "Отмена",
				resetToSaved: "Сбросить к сохранённой конфигурации",
				test: "Проверить подключение",
				testing: "Проверка…",
				testOk: "Подключение успешно",
				testFailed: "Проверка не удалась",
				testSources: "источников",
				testDegraded: "ограниченная комбинация",
				testNoSourcesByDesign: "эта комбинация не возвращает источники",
				testNoSourcesPartial: "источников нет: возможно, поиск не выполнялся или не было страниц для цитирования",
				testNoSourcesFull: "источники не возвращены; проверьте имя инструмента и эндпоинт",
				modelLockedHint: "Эта комбинация поддерживает только эту модель; изменить нельзя.",
				apiKey: "Ключ API",
				apiKeyHint: "Сохраняется только на запись через службу учётных данных (~/.dsh/.credentials.yaml), никогда в файле конфигурации. Оставьте пустым, чтобы сохранить текущий ключ.",
				apiKeySet: "Ключ настроен",
				apiKeyUnset: "Ключ не задан",
				apiKeyByReference: "Зависит от ссылки на учётные данные",
				invalidPositive: "Введите положительное целое число или оставьте пустым для значения по умолчанию.",
				invalidRange: "Введите целое число от 1 до {max} или оставьте пустым для значения по умолчанию.",
				invalidRefName: "Введите допустимое имя ссылки на учётные данные (первая — буква или подчёркивание; далее буквы, цифры и подчёркивания).",
				invalidJson: "Введите объект JSON или оставьте пустым, чтобы не отправлять.",
				protocolChat: "Chat Completions",
				protocolResponses: "Responses",
				protocolAnthropic: "Anthropic Messages",
				protocolSearch: "Автономный поиск",
				vendorDeepseek: "DeepSeek",
				vendorKimi: "Kimi",
				vendorZhipu: "Zhipu",
				vendorQwen: "Qwen",
				vendorOpenai: "OpenAI",
				vendorAnthropic: "Anthropic",
				vendorOpenrouter: "OpenRouter",
				vendorCustom: "Пользовательский",
				opt_thinking_default: "default (следовать модели)",
				opt_thinking_disabled: "disabled (без рассуждений, быстрее)",
				opt_effort_empty: "не отправляется (следовать модели)",
				opt_effort_low: "low (низкий)",
				opt_effort_medium: "medium (средний)",
				opt_effort_high: "high (высокий)",
				opt_effort_xhigh: "xhigh (очень высокий)",
				opt_effort_max: "max (максимальный)",
				opt_searchEngine_search_std: "search_std (Zhipu базовый)",
				opt_searchEngine_search_pro: "search_pro (Zhipu расширенный)",
				opt_searchEngine_search_pro_sogou: "search_pro_sogou (Sogou)",
				opt_searchEngine_search_pro_quark: "search_pro_quark (Quark)",
				opt_searchRecencyFilter_noLimit: "Без ограничений",
				opt_searchRecencyFilter_oneDay: "За последний день",
				opt_searchRecencyFilter_oneWeek: "За последнюю неделю",
				opt_searchRecencyFilter_oneMonth: "За последний месяц",
				opt_searchRecencyFilter_oneYear: "За последний год",
				opt_contentSize_medium: "medium (краткое)",
				opt_contentSize_high: "high (подробное)",
				opt_searchStrategy_turbo: "turbo (самый быстрый)",
				opt_searchStrategy_max: "max (глубокий)",
				opt_searchStrategy_agent: "agent (агентный)",
				opt_searchStrategy_agent_max: "agent_max (агентный + глубокий)",
				opt_freshness_empty: "не отправляется",
				opt_freshness_noLimit: "Без ограничений",
				opt_freshness_oneDay: "За последний день",
				opt_freshness_oneWeek: "За последнюю неделю",
				opt_freshness_oneMonth: "За последний месяц",
				opt_freshness_oneYear: "За последний год",
				opt_searchContextSize_low: "low (мало)",
				opt_searchContextSize_medium: "medium (баланс)",
				opt_searchContextSize_high: "high (больше)",
				opt_externalWebAccess_empty: "следовать настройке эндпоинта (вкл.)",
				opt_externalWebAccess_true: "true (живой веб)",
				opt_externalWebAccess_false: "false (только кэш/индекс)",
				opt_returnTokenBudget_empty: "не отправляется",
				opt_returnTokenBudget_default: "default (стандартный бюджет)",
				opt_returnTokenBudget_unlimited: "unlimited (без ограничений)",
				opt_responseInclusion_empty: "по умолчанию (full)",
				opt_responseInclusion_full: "full (вернуть все блоки)",
				opt_responseInclusion_excluded: "excluded (пропустить использованные блоки)",
				hint_baseURL: "Префикс эндпоинта: официальный или собственный шлюз. Пусто — значение по умолчанию комбинации; пути протокола добавляет плагин, поэтому не повторяйте здесь /responses.",
				hint_apiKeyEnv: "Ссылка на учётные данные: имя ключа в службе учётных данных или окружении. Пусто — цепочка по умолчанию комбинации (например, ZAI_CODING_CN_API_KEY, затем ZHIPU_API_KEY).",
				hint_requestTimeoutMs: "Локальный тайм-аут одного поиска. При истечении записывается WEB_PROVIDER_TIMEOUT вместо ожидания общего бюджета инструмента; пусто — 25000, тест подключения — 60000.",
				hint_model: "Имя модели; оно должно существовать на этом эндпоинте и поддерживать встроенный поиск. Пусто — значение по умолчанию комбинации; модель без поддержки поиска не будет искать.",
				hint_maxOutputTokens: "Лимит вывода на один поисковый ход (рассуждения + инструменты + ответ). Это потолок, а не резерв; слишком малое значение обрежет ход и поисковые раунды.",
				hint_toolType: "Имя инструмента поиска, объявленного в tools[]. Значение по умолчанию зависит от поставщика; выберите известное написание из списка или введите имя, специфичное для шлюза. При ошибке блок поиска не появится.",
				hint_includeSources: "Запросить полный список источников (include). На официальных эндпоинтах OpenAI поле работает только как include; без него остаются лишь аннотации цитирования. Отключите для шлюзов, которые его отклоняют.",
				hint_reasoningEffort: "Уровень рассуждений (reasoning.effort). Набор зависит от модели; неподдерживаемый уровень даёт 400, и плагин повторяет запрос без него. Пусто — ничего не отправляется.",
				hint_searchContextSize: "Сколько поискового контекста получает модель: low экономит токены, medium балансирует, high полнее. Влияет на задержку и стоимость, но не на число источников.",
				hint_allowedDomains: "Только результаты с этих доменов, через запятую, без схемы. OpenAI ограничивает 100; несовместимо с blockedDomains (Anthropic возвращает 400, плагин отправляет allowed первым).",
				hint_blockedDomains: "Блокировать эти домены, через запятую, без схемы. Несовместимо с allowedDomains; поддержка различается, неподдерживающие шлюзы игнорируют.",
				hint_excludedDomains: "Исключить эти домены (OpenRouter). Некоторые движки считают это несовместимым с allowedDomains: Exa принимает оба, другие могут вернуть 400.",
				hint_userLocation: "Двухбуквенный код страны (например, US) для географического смещения. Одни эндпоинты поддерживают его, другие игнорируют; Anthropic также принимает город/часовой пояс, здесь доступна только страна.",
				hint_maxUses: "Максимум вызовов инструмента поиска на запрос. По достижении эндпоинт возвращает ошибку вместо поиска, что ограничивает стоимость и задержку.",
				hint_thinking: "default следует модели; disabled отключает рассуждения (быстрее и дешевле). Некоторые модели всегда рассуждают и отвечают 400 на disabled; плагин повторяет запрос без переключателя.",
				hint_effort: "Уровень output_config.effort Anthropic. Поддерживаемые уровни различаются по моделям; отклонённый уровень повторяется без него. Пусто — ничего не отправляется.",
				hint_searchEngine: "Поисковый движок Zhipu; цена и возможности различаются: std базовый, pro расширенный, у sogou и quark свои квоты и лимиты.",
				hint_searchEngineCustom: "Значение движка определяется шлюзом. Перечислены частые написания (Zhipu search_std / search_pro, OpenRouter auto / exa / perplexity, собственные searxng / google / bing); введите любое другое значение. В шаблоне Zhipu пустое значение отправляет search_std (API этого требует); другие шаблоны этот параметр не используют.",
				hint_count: "Число результатов: 1–50 для Zhipu и DeepSeek, 1–20 для Kimi (большие значения ограничиваются). maxResults из запроса имеет приоритет; настроенное значение применяется, только если запрос его не указал. Не зависит от числа записей дайджеста.",
				hint_searchRecencyFilter: "Только страницы, опубликованные в этом окне. Более узкие окна снижают полноту, но улучшают запросы, чувствительные к свежести.",
				hint_contentSize: "Размер фрагмента: medium экономит токены, high даёт больше деталей по более высокой цене.",
				hint_searchDomainFilter: "Ограничить домены источников, через запятую, без схемы. Пусто — без ограничений; неподдерживающие движки игнорируют.",
				hint_requireSearch: "Не отвечать без результатов поиска, сохраняя обоснованность. По умолчанию выкл.; при включении пустой результат приводит к ошибке вместо ответа из знаний модели.",
				hint_searchPrompt: "Промпт объединения результатов, управляющий встраиванием поискового контента. Пусто — официальное значение по умолчанию.",
				hint_searchStrategy: "Стратегия поиска Qwen: turbo самая быстрая, max самая глубокая, agent/agent_max агентная. Глубокие стратегии медленнее и дороже.",
				hint_forcedSearch: "Принудительный поиск, даже если модель считает его ненужным. Для запросов, которые должны быть онлайн.",
				hint_freshness: "Только результаты в этом окне (Qwen). Пусто — без ограничений; аналог свежести Zhipu для Qwen.",
				hint_assignedSiteList: "Ограничить этими сайтами, через запятую (Qwen). Пусто — без ограничений; похоже на фильтр доменов Zhipu.",
				hint_searchExtension: "Параметр расширения поиска Qwen, передаётся как есть. Пусто — не отправляется; допустимые значения см. в документации Qwen.",
				hint_promptIntervene: "Параметр вмешательства в промпт Qwen, передаётся как есть. Пусто — не отправляется; не меняйте, если не знаете семантику.",
				hint_engine: "Поисковый движок OpenRouter: auto (нативный, если доступен, иначе Exa), native (встроенный у поставщика) или exa/firecrawl/parallel/perplexity. Движки различаются ценой и возможностями.",
				hint_mode: "Режим движка: Exa instant/fast/auto/deep-lite/deep/deep-reasoning, Parallel turbo/fast/basic/advanced. Пусто — значение движка по умолчанию.",
				hint_maxCharacters: "Лимит символов на результат. Имеет приоритет над searchContextSize, если заданы оба; пусто — выбор движка.",
				hint_externalWebAccess: "Загружать ли живые страницы: пусто — настройка эндпоинта (вкл.); false использует только кэш/индекс, полезно для воспроизводимых или ограниченных требованиями запусков.",
				hint_returnTokenBudget: "Бюджет контента на один поиск: default стандартный, unlimited без ограничений (медленнее и дороже). Только модели рассуждений GPT-5+.",
				hint_searchContentTypes: "Запрашиваемые типы результатов, через запятую: text и image. С image также возвращаются изображения и активируются число изображений и подпись.",
				hint_imageMaxResults: "Число результатов-изображений. 0 или пусто отключает поиск изображений; применяется только если searchContentTypes содержит image.",
				hint_imageCaption: "Запрашивать краткие описания изображений. Помогает при фильтрации и отображении, ответ немного больше.",
				hint_responseInclusion: "Как показывать блоки поиска: full возвращает всё, excluded пропускает блоки, уже использованные выполнением кода, экономя выходные токены. Только web_search_20260318+.",
				hint_xSearch: "Параметры поиска по X/Twitter от OpenRouter и xAI в виде объекта JSON, например {\"allowed_x_handles\":[\"OpenRouterAI\"]}. Пусто отключает.",
				hint_maxResults: "Результатов на поиск (OpenRouter 1–25, некоторые движки 1–20). Сочетайте с maxTotalResults, чтобы ограничить стоимость и контекст.",
				hint_maxTotalResults: "Суммарный предел результатов по всем поискам в одном запросе. По достижении эндпоинт просит модель остановить поиск.",
				hint_includeContent: "Также возвращать содержимое страницы. Это заметно увеличивает размер ответа и расход токенов; оставьте выкл., если хватает заголовков и фрагментов. В шаблоне Zhipu фиксирует content_size на high; отключите, чтобы управлять длиной фрагмента самостоятельно.",
				hint_digestEntries: "Сколько результатов включает дайджест контента (1–20). Влияет только на текст дайджеста; источники не обрезаются. Пусто — 8.",
				hint_digestSnippetChars: "Максимум символов на запись дайджеста (1–2000); более длинные фрагменты обрезаются. Пусто — 200.",
				hint_timeoutSeconds: "Тайм-аут запроса в секундах (Kimi 1–60). При тайм-ауте поиск завершается ошибкой; для длинных запросов увеличьте.",
				hint_oriQuestion: "Приложить сообщение пользователя, вызвавшее этот поиск (пробелы сжаты, обрезано до 128 символов), чтобы DeepSeek учитывал намерение. Не передаётся вне сеанса или без сообщения пользователя; только шаблоны DeepSeek.",
				hint_localization: "IP локализации для географического ранжирования. Отправляется только корректный IPv4/IPv6; пустые или некорректные значения опускаются.",
				hint_path: "Путь запроса относительно baseURL. Обязателен для пользовательских шлюзов; для встроенных целей задаётся протоколом.",
				hint_queryField: "Имя поля запроса в теле. Пусто — значение шаблона (Zhipu search_query, DeepSeek query, Kimi text_query).",
				hint_countField: "Имя поля количества в теле. Пусто — значение шаблона (count для Zhipu/DeepSeek, limit для Kimi).",
				hint_resultsPath: "Путь через точку к массиву результатов, например data.items. Пусто — значение шаблона (Zhipu search_result, DeepSeek results, Kimi search_results).",
				hint_urlField: "Имя поля URL каждого результата. Пусто — значение шаблона (link для Zhipu, url в остальных).",
				hint_titleField: "Имя поля заголовка каждого результата. Пусто — значение шаблона (title).",
				hint_snippetField: "Имя поля фрагмента каждого результата. Пусто — значение шаблона (content для Zhipu, snippet в остальных).",
				hint_dateField: "Имя поля даты каждого результата. Пусто — даты не разбираются; задавайте, только если ответ их содержит.",
				hint_contentField: "Имя поля длинного текста каждого результата. Текст становится сводкой источника (до 2000 символов, не пишется при совпадении со snippet) и служит запасным вариантом для content-дайджеста, если snippet пуст; пусто — берётся поле summary.",
				field_baseURL: "Эндпоинт",
				field_apiKeyEnv: "Ссылка на учётные данные",
				field_requestTimeoutMs: "Тайм-аут запроса (мс)",
				field_model: "Модель",
				field_maxOutputTokens: "Лимит вывода",
				field_count: "Число результатов",
				field_maxUses: "Макс. вызовов поиска",
				field_searchEngine: "Поисковый движок",
				field_searchRecencyFilter: "Свежесть",
				field_contentSize: "Размер фрагмента",
				field_searchDomainFilter: "Фильтр доменов",
				field_requireSearch: "Требовать поиск",
				field_searchPrompt: "Промпт поиска",
				field_reasoningEffort: "Глубина рассуждений",
				field_thinking: "Режим рассуждений",
				field_effort: "Уровень усилий",
				field_includeSources: "Запросить все источники",
				field_includeContent: "Включить содержимое",
				field_digestEntries: "Записей дайджеста",
				field_digestSnippetChars: "Символов на запись",
				field_timeoutSeconds: "Тайм-аут (с)",
				field_oriQuestion: "Исходный вопрос",
				field_localization: "IP локализации",
				field_path: "Путь запроса",
				field_template: "Совместимый шаблон",
				field_toolType: "Имя инструмента поиска",
				field_queryField: "Поле запроса",
				field_countField: "Поле количества",
				field_resultsPath: "Путь результатов",
				field_urlField: "Поле URL",
				field_titleField: "Поле заголовка",
				field_snippetField: "Поле фрагмента",
				field_dateField: "Поле даты",
				field_contentField: "Поле содержимого",
				field_searchContextSize: "Размер поискового контекста",
				field_allowedDomains: "Разрешённые домены",
				field_blockedDomains: "Заблокированные домены",
				field_excludedDomains: "Исключённые домены",
				field_userLocation: "Местоположение",
				field_engine: "Движок",
				field_mode: "Режим движка",
				field_maxCharacters: "Макс. символов на результат",
				field_externalWebAccess: "Доступ к живому вебу",
				field_returnTokenBudget: "Бюджет токенов ответа",
				field_searchContentTypes: "Типы контента поиска",
				field_imageMaxResults: "Макс. изображений",
				field_imageCaption: "Подписи изображений",
				field_responseInclusion: "Включение в ответ",
				field_xSearch: "Поиск в X (JSON)",
				field_maxResults: "Макс. результатов",
				field_maxTotalResults: "Макс. всего результатов",
				field_searchStrategy: "Стратегия поиска",
				field_forcedSearch: "Принудительный поиск",
				field_freshness: "Свежесть",
				field_assignedSiteList: "Заданные сайты",
				field_searchExtension: "Расширение поиска",
				field_promptIntervene: "Вмешательство в промпт",
				tabNav: "Навигация плагина",
				tabConfig: "Настройки",
				tabObservability: "Наблюдение",
				obsOverview: "Обзор",
				obsRecords: "Записи",
				obsRange: "Период",
				obsRange_all: "Все",
				obsTargetFilter: "Цель",
				obsAllTargets: "Все цели",
				obsIncludeTests: "Включать тесты подключения",
				obsRefresh: "Обновить",
				obsRefreshing: "Обновление…",
				obsExportJsonl: "Экспорт JSONL",
				obsExportCsv: "Экспорт CSV",
				obsMetricCount: "Поиски",
				obsMetricSuccess: "Доля успешных",
				obsMetricP95: "Задержка P95",
				obsMetricSources: "Среднее число источников",
				obsMetricSummary: "Покрытие сводками",
				obsTargetRanking: "Рейтинг целей",
				obsEmpty: "Поисков пока нет",
				obsEmptyHint: "Запустите тест подключения с текущей конфигурацией или дождитесь следующего реального поиска.",
				obsEmptyFiltered: "Нет записей, соответствующих фильтрам",
				obsEmptyFilteredHint: "Измените период, цель или статус и повторите попытку.",
				obsClearFilters: "Сбросить фильтры",
				obsNoData: "Нет данных",
				obsTableTime: "Время",
				obsTableTarget: "Цель",
				obsTableQuery: "Запрос",
				obsTableDuration: "Длительность",
				obsTableSources: "Источники",
				obsTableSummary: "Сводки",
				obsTableStatus: "Статус",
				obsTableErrors: "Ошибки",
				obsStatusOk: "Успешно",
				obsStatusFail: "Ошибка",
				obsFilterStatus: "Статус",
				obsAllStatuses: "Все статусы",
				obsFilterQuery: "Запрос",
				obsFilterQueryHint: "Фильтр по запросу; Enter для применения",
				obsLoadMore: "Загрузить ещё",
				obsLoadingMore: "Загрузка…",
				obsDetailsError: "Ошибка",
				obsDetailsSources: "Источники",
				obsDetailsKind: "Тип",
				obsDetailsAnswer: "Символов ответа",
				obsDetailsRecordId: "ID записи",
				obsDetailsSession: "Сессия",
				obsSourceSummary: "Сводка",
				obsSourceSnippet: "Фрагмент",
				obsSourceNoTitle: "Без заголовка",
				obsSourceNoHost: "Без хоста",
				obsCopyJson: "Копировать JSON",
				obsCopied: "Скопировано",
				obsCopyFailed: "Не удалось скопировать",
				obsDataManagement: "Управление данными",
				obsClearHint: "Очистка удалит все записи наблюдений без возможности отмены. Введите DELETE для подтверждения.",
				obsClearPlaceholder: "Введите DELETE",
				obsClear: "Очистить данные наблюдений",
				obsClearing: "Очистка…",
				obsCleared: "Удалено записей: {count}",
				obsRecordsCaption: "Записи поиска",
				obsTrend: "Динамика",
				obsTrendSuccess: "Доля успешных",
				obsTrendP95: "Задержка P95",
				obsTrendAria: "По {buckets} интервалам доля успешных {min}–{max}",
				obsApplyFilters: "Применить",
				obsDetailsQuery: "Запрос",
				obsAnswerEmpty: "В этой записи нет текста ответа",
				obsRange_today: "Сегодня",
				obsRange_week: "На этой неделе",
				obsRange_month: "В этом месяце",
				obsRange_quarter: "В этом квартале",
				obsRange_year: "В этом году",
				obsImport: "Импортировать историю поиска",
				obsImportHint: "Сканирует локальные журналы сессий и добавляет записи web_search старых версий; повторный запуск добавляет только новые.",
				obsImporting: "Импорт…",
				obsImportDone: "Проверено сессий: {sessions}, импортировано: {imported} (цель распознана: {identified}), обновлено: {updated}, уже есть: {skipped}, вне диапазона: {filtered}",
				obsRange_24h: "24 часа",
				obsRange_7d: "7 дней",
				obsRange_30d: "30 дней",
				obsRangeSince: "С {date}",
				obsCalendarPrev: "Предыдущий месяц",
				obsCalendarNext: "Следующий месяц",
				obsRangeUntilNow: "До сейчас",
				obsRangePickEnd: "Выберите дату окончания",
				obsPrevPage: "Предыдущая страница",
				obsNextPage: "Следующая страница",
				obsPageNumber: "Страница {page}",
				obsPageSize: "{size} на странице",
				obsPageJump: "Перейти на",
				obsPageUnit: "страница",
				obsPageSizeLabel: "Строк на странице",
				obsImportRange: "Диапазон импорта",
				obsHistoricalTarget: "История"
			},
			pt: {
				description: "Pesquisa web multiprotocolo: integrada ao protocolo (Chat Completions / Responses / Anthropic Messages) e pesquisa autônoma, selecionada por fornecedor.",
				loading: "Lendo a configuração…",
				loadFailed: "Não foi possível ler a configuração; tente novamente quando o serviço do plugin estiver disponível.",
				unsaved: "Não salvo",
				save: "Salvar",
				saving: "Salvando…",
				discard: "Descartar alterações",
				shape: "Tipo de pesquisa",
				shapeInProtocol: "Pesquisa integrada ao protocolo",
				shapeStandalone: "Pesquisa autônoma",
				protocol: "Protocolo",
				vendor: "Fornecedor",
				advanced: "Opções avançadas",
				fieldPlaceholder: "Vazio usa o padrão",
				unsupported: "Não suportado",
				full: "Completo",
				degraded: "Degradado",
				custom: "Personalizado",
				unsupportedVendors: "Combinações não conectadas nesta compilação (o fornecedor ainda pode funcionar em outro protocolo)",
				customNotice: "Endpoints personalizados são de sua responsabilidade; teste após salvar.",
				fillFromTemplate: "Preencher a partir de um template (referência)",
				templateFillHint: "Escolher um template apenas preenche os campos abaixo; o template não é salvo e o seletor é redefinido após o uso.",
				templatePlaceholder: "Escolher um template…",
				templateUsed: "Último usado: {name}",
				templateOverwrite: "«{name}» substituirá a configuração atual (incluindo valores salvos)",
				templateApply: "Aplicar template",
				templateCancel: "Cancelar",
				resetToSaved: "Restaurar a configuração salva",
				test: "Testar conexão",
				testing: "Testando…",
				testOk: "Conectado",
				testFailed: "Falha no teste",
				testSources: "fontes",
				testDegraded: "degradada",
				testNoSourcesByDesign: "esta combinação não retorna fontes",
				testNoSourcesPartial: "sem fontes: a pesquisa pode não ter sido executada ou não havia página citável",
				testNoSourcesFull: "nenhuma fonte retornada; verifique o nome da ferramenta e o endpoint",
				modelLockedHint: "Esta combinação só suporta este modelo; não pode ser alterado.",
				apiKey: "Chave de API",
				apiKeyHint: "Armazenada somente para escrita pelo serviço de credenciais (~/.dsh/.credentials.yaml), nunca no arquivo de configuração. Deixe em branco para manter a chave atual.",
				apiKeySet: "Chave configurada",
				apiKeyUnset: "Sem chave",
				apiKeyByReference: "Depende da referência de credencial",
				invalidPositive: "Informe um inteiro positivo ou deixe em branco para o padrão.",
				invalidRange: "Informe um inteiro de 1 a {max} ou deixe em branco para o padrão.",
				invalidRefName: "Informe um nome de referência de credencial válido (letra ou sublinhado no início; apenas letras, dígitos e sublinhados).",
				invalidJson: "Informe um objeto JSON ou deixe em branco para omitir.",
				protocolChat: "Chat Completions",
				protocolResponses: "Responses",
				protocolAnthropic: "Anthropic Messages",
				protocolSearch: "Pesquisa autônoma",
				vendorDeepseek: "DeepSeek",
				vendorKimi: "Kimi",
				vendorZhipu: "Zhipu",
				vendorQwen: "Qwen",
				vendorOpenai: "OpenAI",
				vendorAnthropic: "Anthropic",
				vendorOpenrouter: "OpenRouter",
				vendorCustom: "Personalizado",
				opt_thinking_default: "default (seguir o modelo)",
				opt_thinking_disabled: "disabled (pensamento desligado, mais rápido)",
				opt_effort_empty: "não enviado (seguir o modelo)",
				opt_effort_low: "low (baixo)",
				opt_effort_medium: "medium (médio)",
				opt_effort_high: "high (alto)",
				opt_effort_xhigh: "xhigh (muito alto)",
				opt_effort_max: "max (máximo)",
				opt_searchEngine_search_std: "search_std (Zhipu básico)",
				opt_searchEngine_search_pro: "search_pro (Zhipu avançado)",
				opt_searchEngine_search_pro_sogou: "search_pro_sogou (Sogou)",
				opt_searchEngine_search_pro_quark: "search_pro_quark (Quark)",
				opt_searchRecencyFilter_noLimit: "Sem limite",
				opt_searchRecencyFilter_oneDay: "Último dia",
				opt_searchRecencyFilter_oneWeek: "Última semana",
				opt_searchRecencyFilter_oneMonth: "Último mês",
				opt_searchRecencyFilter_oneYear: "Último ano",
				opt_contentSize_medium: "medium (resumo)",
				opt_contentSize_high: "high (detalhado)",
				opt_searchStrategy_turbo: "turbo (mais rápido)",
				opt_searchStrategy_max: "max (profundo)",
				opt_searchStrategy_agent: "agent (agente)",
				opt_searchStrategy_agent_max: "agent_max (agente + profundo)",
				opt_freshness_empty: "não enviado",
				opt_freshness_noLimit: "Sem limite",
				opt_freshness_oneDay: "Último dia",
				opt_freshness_oneWeek: "Última semana",
				opt_freshness_oneMonth: "Último mês",
				opt_freshness_oneYear: "Último ano",
				opt_searchContextSize_low: "low (pouco)",
				opt_searchContextSize_medium: "medium (equilibrado)",
				opt_searchContextSize_high: "high (mais)",
				opt_externalWebAccess_empty: "seguir o padrão do endpoint (ativado)",
				opt_externalWebAccess_true: "true (web ao vivo)",
				opt_externalWebAccess_false: "false (somente cache/índice)",
				opt_returnTokenBudget_empty: "não enviado",
				opt_returnTokenBudget_default: "default (orçamento padrão)",
				opt_returnTokenBudget_unlimited: "unlimited (sem limite)",
				opt_responseInclusion_empty: "padrão (full)",
				opt_responseInclusion_full: "full (retornar todos os blocos)",
				opt_responseInclusion_excluded: "excluded (omitir blocos já consumidos)",
				hint_baseURL: "Prefixo do endpoint: oficial ou um gateway próprio. Vazio usa o padrão da combinação; os caminhos de protocolo são anexados pelo plugin, então não repita /responses aqui.",
				hint_apiKeyEnv: "Referência de credencial: o nome da chave no serviço de credenciais ou no ambiente. Vazio usa a cadeia padrão da combinação (ex.: ZAI_CODING_CN_API_KEY e depois ZHIPU_API_KEY).",
				hint_requestTimeoutMs: "Tempo limite local de uma busca. Ao expirar, é registrado como WEB_PROVIDER_TIMEOUT em vez de aguardar o orçamento da ferramenta; vazio usa 25000 e o teste de conexão 60000.",
				hint_model: "Nome do modelo; ele deve existir neste endpoint e suportar busca integrada. Vazio usa o padrão da combinação; um modelo sem suporte a busca nunca pesquisará.",
				hint_maxOutputTokens: "Limite de saída de um turno de pesquisa (raciocínio + ferramentas + resposta). É um teto, não uma reserva; um valor muito baixo trunca o turno e corta rodadas de pesquisa.",
				hint_toolType: "Nome da ferramenta de pesquisa declarada em tools[]. O padrão segue o fornecedor; escolha uma grafia conhecida na lista ou digite um nome específico do gateway. Um nome errado significa que nenhum bloco de pesquisa aparece.",
				hint_includeSources: "Solicitar a lista completa de fontes (include). Em endpoints oficiais da OpenAI o campo é somente include; sem ele restam apenas anotações de citação. Desative para gateways que o rejeitam.",
				hint_reasoningEffort: "Nível de raciocínio (reasoning.effort). O conjunto varia por modelo; um nível não suportado retorna 400 e o plugin tenta de novo sem ele. Vazio não envia nada.",
				hint_searchContextSize: "Quanto contexto de pesquisa chega ao modelo: low economiza tokens, medium equilibra, high é mais completo. Afeta latência e custo, não o número de fontes.",
				hint_allowedDomains: "Apenas resultados destes domínios, separados por vírgulas, sem esquema. A OpenAI limita a 100; é mutuamente exclusivo com blockedDomains (a Anthropic retorna 400; o plugin envia allowed primeiro).",
				hint_blockedDomains: "Bloquear estes domínios, separados por vírgulas, sem esquema. Mutuamente exclusivo com allowedDomains; o suporte varia e gateways não compatíveis o ignoram.",
				hint_excludedDomains: "Excluir estes domínios (OpenRouter). Alguns mecanismos o tratam como exclusivo com allowedDomains: a Exa aceita ambos, outros podem retornar 400.",
				hint_userLocation: "Código de país de duas letras (ex.: US) para viés geográfico. Alguns endpoints suportam, outros ignoram; a Anthropic também aceita cidade/fuso horário, aqui só o país é exposto.",
				hint_maxUses: "Máximo de chamadas à ferramenta de pesquisa por requisição. Ao atingir, o endpoint retorna erro em vez de pesquisar, limitando custo e latência.",
				hint_thinking: "default segue o modelo; disabled desliga o pensamento (mais rápido e barato). Alguns modelos sempre pensam e retornam 400 para disabled; o plugin tenta de novo sem a opção.",
				hint_effort: "Nível output_config.effort da Anthropic. Os níveis suportados variam por modelo; um nível rejeitado é tentado de novo sem ele. Vazio não envia nada.",
				hint_searchEngine: "Mecanismo de busca Zhipu; preço e capacidade diferem: std básico, pro avançado, sogou e quark têm suas próprias cotas e limites.",
				hint_searchEngineCustom: "O valor do mecanismo é definido pelo gateway. Grafias comuns estão listadas (Zhipu search_std / search_pro, OpenRouter auto / exa / perplexity, searxng / google / bing próprios); digite qualquer outro valor. No template Zhipu, um valor vazio envia search_std (a API exige); os demais templates não usam este parâmetro.",
				hint_count: "Número de resultados: 1-50 para Zhipu e DeepSeek, 1-20 para Kimi (valores acima são limitados). Um maxResults da requisição tem precedência; o valor configurado só se aplica quando a requisição o omite. É independente do número de entradas do resumo.",
				hint_searchRecencyFilter: "Apenas páginas publicadas nesta janela. Janelas mais estreitas reduzem a cobertura, mas melhoram consultas sensíveis à atualidade.",
				hint_contentSize: "Tamanho do trecho: medium economiza tokens, high retorna mais detalhes a um preço maior.",
				hint_searchDomainFilter: "Restringir os domínios de origem, separados por vírgulas, sem esquema. Vazio significa sem restrição; mecanismos não compatíveis o ignoram.",
				hint_requireSearch: "Recusar responder sem resultados de pesquisa, mantendo o embasamento. Desligado por padrão; quando ligado, um conjunto vazio falha em vez de responder com o conhecimento do modelo.",
				hint_searchPrompt: "Prompt de fusão de resultados que controla como o conteúdo da pesquisa é integrado. Vazio usa o padrão oficial.",
				hint_searchStrategy: "Estratégia de pesquisa do Qwen: turbo a mais rápida, max a mais profunda, agent/agent_max agêntica. As mais profundas são mais lentas e caras.",
				hint_forcedSearch: "Forçar uma pesquisa mesmo quando o modelo a considera desnecessária. Use para solicitações que precisam estar online.",
				hint_freshness: "Apenas resultados dentro desta janela (Qwen). Vazio significa sem restrição; é o equivalente do Qwen à recência do Zhipu.",
				hint_assignedSiteList: "Restringir a estes sites, separados por vírgulas (Qwen). Vazio significa sem restrição; semelhante ao filtro de domínios do Zhipu.",
				hint_searchExtension: "Parâmetro de extensão de pesquisa do Qwen, repassado como está. Vazio o omite; consulte a documentação do Qwen para valores aceitos.",
				hint_promptIntervene: "Parâmetro de intervenção no prompt do Qwen, repassado como está. Vazio o omite; não altere sem conhecer a semântica.",
				hint_engine: "Mecanismo de pesquisa do OpenRouter: auto (nativo quando disponível, senão Exa), native (integrado do fornecedor) ou exa/firecrawl/parallel/perplexity. Os mecanismos diferem em preço e capacidade.",
				hint_mode: "Modo específico do mecanismo: Exa instant/fast/auto/deep-lite/deep/deep-reasoning, Parallel turbo/fast/basic/advanced. Vazio usa o padrão do mecanismo.",
				hint_maxCharacters: "Limite de caracteres por resultado. Tem precedência sobre searchContextSize quando ambos são definidos; vazio deixa o mecanismo escolher.",
				hint_externalWebAccess: "Se busca páginas ao vivo: vazio segue o padrão do endpoint (ativado); false usa apenas cache/índice, útil para execuções reproduzíveis ou com restrições de conformidade.",
				hint_returnTokenBudget: "Orçamento de conteúdo por execução de pesquisa: default padrão, unlimited sem limite (mais lento e caro). Somente modelos de raciocínio GPT-5+.",
				hint_searchContentTypes: "Tipos de resultado a solicitar, separados por vírgulas: text e image. Incluir image também retorna resultados de imagem e ativa o número e a legenda de imagens.",
				hint_imageMaxResults: "Número de resultados de imagem. 0 ou vazio desativa a busca de imagens; aplica-se apenas quando searchContentTypes inclui image.",
				hint_imageCaption: "Pedir descrições curtas das imagens. Ajuda a filtrar e exibir, com resposta um pouco maior.",
				hint_responseInclusion: "Como os blocos de pesquisa aparecem: full retorna tudo, excluded omite blocos já consumidos pela execução de código para economizar tokens de saída. Somente web_search_20260318+.",
				hint_xSearch: "Parâmetros de pesquisa do X/Twitter do OpenRouter e xAI como objeto JSON, ex.: {\"allowed_x_handles\":[\"OpenRouterAI\"]}. Vazio o desativa.",
				hint_maxResults: "Resultados por pesquisa (OpenRouter 1-25, alguns mecanismos 1-20). Combine com maxTotalResults para limitar custo e contexto.",
				hint_maxTotalResults: "Limite acumulado de resultados em todas as pesquisas de uma requisição. Ao atingir, o endpoint instrui o modelo a parar de pesquisar.",
				hint_includeContent: "Retornar também o conteúdo da página. Isso aumenta muito o tamanho da resposta e o uso de tokens; mantenha desligado quando títulos e trechos bastarem. No template Zhipu fixa content_size em high; desligue para controlar o comprimento do trecho.",
				hint_digestEntries: "Quantos resultados o resumo de conteúdo inclui (1-20). Apenas molda o texto do resumo; as fontes não são truncadas. Vazio usa 8.",
				hint_digestSnippetChars: "Caracteres máximos por entrada do resumo (1-2000); trechos mais longos são truncados. Vazio usa 200.",
				hint_timeoutSeconds: "Tempo limite da requisição em segundos (Kimi 1-60). Um timeout faz a pesquisa falhar; aumente para consultas longas.",
				hint_oriQuestion: "Anexar a mensagem do usuário que originou esta pesquisa (espaços colapsados, cortada em 128 caracteres) para o DeepSeek ordenar por intenção. Omitida fora de uma sessão ou sem mensagem do usuário; somente templates DeepSeek.",
				hint_localization: "IP de localização para ranking geográfico. Apenas um IPv4/IPv6 válido é enviado; valores vazios ou malformados são omitidos.",
				hint_path: "Caminho da requisição relativo a baseURL. Obrigatório para gateways personalizados; fixado pelo protocolo nos destinos integrados.",
				hint_queryField: "Nome do campo de consulta no corpo. Vazio usa o padrão do template (Zhipu search_query, DeepSeek query, Kimi text_query).",
				hint_countField: "Nome do campo de quantidade no corpo. Vazio usa o padrão do template (count para Zhipu/DeepSeek, limit para Kimi).",
				hint_resultsPath: "Caminho com pontos até o array de resultados, ex.: data.items. Vazio usa o padrão do template (Zhipu search_result, DeepSeek results, Kimi search_results).",
				hint_urlField: "Nome do campo URL de cada resultado. Vazio usa o padrão do template (link para Zhipu, url nos demais).",
				hint_titleField: "Nome do campo de título de cada resultado. Vazio usa o padrão do template (title).",
				hint_snippetField: "Nome do campo de trecho de cada resultado. Vazio usa o padrão do template (content para Zhipu, snippet nos demais).",
				hint_dateField: "Nome do campo de data de cada resultado. Vazio significa que datas não são analisadas; defina apenas se a resposta as contiver.",
				hint_contentField: "Nome do campo de corpo longo de cada resultado. O corpo vira o resumo da fonte (máx. 2000 caracteres, omitido quando igual a snippet) e serve de fallback para o digest de content quando snippet está vazio; vazio = usa o campo summary.",
				field_baseURL: "Endpoint",
				field_apiKeyEnv: "Referência de credencial",
				field_requestTimeoutMs: "Tempo limite da solicitação (ms)",
				field_model: "Modelo",
				field_maxOutputTokens: "Limite de saída",
				field_count: "Número de resultados",
				field_maxUses: "Máx. de pesquisas",
				field_searchEngine: "Mecanismo de busca",
				field_searchRecencyFilter: "Atualidade",
				field_contentSize: "Tamanho do trecho",
				field_searchDomainFilter: "Filtro de domínios",
				field_requireSearch: "Exigir pesquisa",
				field_searchPrompt: "Prompt de pesquisa",
				field_reasoningEffort: "Intensidade de raciocínio",
				field_thinking: "Modo de pensamento",
				field_effort: "Nível de esforço",
				field_includeSources: "Solicitar todas as fontes",
				field_includeContent: "Incluir conteúdo",
				field_digestEntries: "Entradas do resumo",
				field_digestSnippetChars: "Caracteres por entrada",
				field_timeoutSeconds: "Tempo limite (s)",
				field_oriQuestion: "Pergunta original",
				field_localization: "IP de localização",
				field_path: "Caminho da requisição",
				field_template: "Template compatível",
				field_toolType: "Nome da ferramenta",
				field_queryField: "Campo de consulta",
				field_countField: "Campo de quantidade",
				field_resultsPath: "Caminho dos resultados",
				field_urlField: "Campo URL",
				field_titleField: "Campo de título",
				field_snippetField: "Campo de trecho",
				field_dateField: "Campo de data",
				field_contentField: "Campo de conteúdo",
				field_searchContextSize: "Tamanho do contexto de pesquisa",
				field_allowedDomains: "Domínios permitidos",
				field_blockedDomains: "Domínios bloqueados",
				field_excludedDomains: "Domínios excluídos",
				field_userLocation: "Localização do usuário",
				field_engine: "Mecanismo",
				field_mode: "Modo do mecanismo",
				field_maxCharacters: "Máx. de caracteres por resultado",
				field_externalWebAccess: "Acesso web ao vivo",
				field_returnTokenBudget: "Orçamento de tokens de retorno",
				field_searchContentTypes: "Tipos de conteúdo da pesquisa",
				field_imageMaxResults: "Máx. de resultados de imagem",
				field_imageCaption: "Legendas de imagem",
				field_responseInclusion: "Inclusão na resposta",
				field_xSearch: "Pesquisa no X (JSON)",
				field_maxResults: "Máx. de resultados",
				field_maxTotalResults: "Máx. de resultados totais",
				field_searchStrategy: "Estratégia de pesquisa",
				field_forcedSearch: "Forçar pesquisa",
				field_freshness: "Atualidade",
				field_assignedSiteList: "Sites atribuídos",
				field_searchExtension: "Extensão de pesquisa",
				field_promptIntervene: "Intervenção no prompt",
				tabNav: "Navegação do plugin",
				tabConfig: "Configuração",
				tabObservability: "Observação",
				obsOverview: "Visão geral",
				obsRecords: "Registros",
				obsRange: "Período",
				obsRange_all: "Tudo",
				obsTargetFilter: "Destino",
				obsAllTargets: "Todos os destinos",
				obsIncludeTests: "Incluir testes de conexão",
				obsRefresh: "Atualizar",
				obsRefreshing: "Atualizando…",
				obsExportJsonl: "Exportar JSONL",
				obsExportCsv: "Exportar CSV",
				obsMetricCount: "Pesquisas",
				obsMetricSuccess: "Taxa de sucesso",
				obsMetricP95: "Latência P95",
				obsMetricSources: "Média de fontes",
				obsMetricSummary: "Cobertura de resumos",
				obsTargetRanking: "Ranking por destino",
				obsEmpty: "Ainda não há pesquisas",
				obsEmptyHint: "Execute um teste de conexão com a configuração atual ou aguarde a próxima pesquisa real.",
				obsEmptyFiltered: "Nenhum registro corresponde a estes filtros",
				obsEmptyFilteredHint: "Ajuste o período, o destino ou o status e tente novamente.",
				obsClearFilters: "Limpar filtros",
				obsNoData: "Sem dados",
				obsTableTime: "Hora",
				obsTableTarget: "Destino",
				obsTableQuery: "Consulta",
				obsTableDuration: "Duração",
				obsTableSources: "Fontes",
				obsTableSummary: "Resumos",
				obsTableStatus: "Status",
				obsTableErrors: "Erros",
				obsStatusOk: "Sucesso",
				obsStatusFail: "Falhou",
				obsFilterStatus: "Status",
				obsAllStatuses: "Todos os status",
				obsFilterQuery: "Consulta",
				obsFilterQueryHint: "Filtre por consulta; Enter para aplicar",
				obsLoadMore: "Carregar mais",
				obsLoadingMore: "Carregando…",
				obsDetailsError: "Erro",
				obsDetailsSources: "Fontes",
				obsDetailsKind: "Tipo",
				obsDetailsAnswer: "Caracteres da resposta",
				obsDetailsRecordId: "ID do registro",
				obsDetailsSession: "Sessão",
				obsSourceSummary: "Resumo",
				obsSourceSnippet: "Trecho",
				obsSourceNoTitle: "Sem título",
				obsSourceNoHost: "Sem host",
				obsCopyJson: "Copiar JSON",
				obsCopied: "Copiado",
				obsCopyFailed: "Falha ao copiar",
				obsDataManagement: "Gerenciamento de dados",
				obsClearHint: "Limpar exclui todos os registros de observação e não pode ser desfeito. Digite DELETE para confirmar.",
				obsClearPlaceholder: "Digite DELETE",
				obsClear: "Limpar dados de observação",
				obsClearing: "Limpando…",
				obsCleared: "{count} registros limpos",
				obsRecordsCaption: "Registros de pesquisa",
				obsTrend: "Tendência",
				obsTrendSuccess: "Taxa de sucesso",
				obsTrendP95: "Latência P95",
				obsTrendAria: "Em {buckets} intervalos, taxa de sucesso {min}–{max}",
				obsApplyFilters: "Aplicar",
				obsDetailsQuery: "Consulta",
				obsAnswerEmpty: "Este registro não tem texto de resposta",
				obsRange_today: "Hoje",
				obsRange_week: "Esta semana",
				obsRange_month: "Este mês",
				obsRange_quarter: "Este trimestre",
				obsRange_year: "Este ano",
				obsImport: "Importar histórico de pesquisas",
				obsImportHint: "Varre os logs de sessão locais para recuperar pesquisas web_search de versões anteriores; repetir adiciona apenas as novas.",
				obsImporting: "Importando…",
				obsImportDone: "{sessions} sessões verificadas, {imported} importadas (destino identificado em {identified}), {updated} atualizadas, já existentes {skipped}, fora do intervalo {filtered}",
				obsRange_24h: "24 horas",
				obsRange_7d: "7 dias",
				obsRange_30d: "30 dias",
				obsRangeSince: "Desde {date}",
				obsCalendarPrev: "Mês anterior",
				obsCalendarNext: "Próximo mês",
				obsRangeUntilNow: "Até agora",
				obsRangePickEnd: "Escolha uma data final",
				obsPrevPage: "Página anterior",
				obsNextPage: "Próxima página",
				obsPageNumber: "Página {page}",
				obsPageSize: "{size} por página",
				obsPageJump: "Ir para",
				obsPageUnit: "página",
				obsPageSizeLabel: "Linhas por página",
				obsImportRange: "Intervalo de importação",
				obsHistoricalTarget: "Histórico"
			}
		};
		//#endregion
		//#region src/client/index.tsx
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
		/** Service dependencies: the slot registry and the locale service. */
		const inject = ["slots", "locale"];
		/**
		* Register the bundle's configuration entry on the Plugins page.
		*
		* `plugins.bundle.config` is keyed by the package name (`dsh-web-search-diy`),
		* so clicking this bundle's card in the installed-plugin list opens the form
		* directly. `locale: NS` is what hands the component its `t`, so the page follows
		* Settings → Language.
		*/
		function apply(ctx) {
			ctx.effect(() => {
				injectStyles();
			}, `${ID}: page stylesheet`);
			ctx.effect(() => ctx.locale.register(NS, ALL_LOCALES), `${ID}: dictionaries`);
			ctx.effect(() => {
				ctx.slots.inject("plugins.bundle.config", () => ctx.slots.register({
					name: "plugins.bundle.config",
					key: ID,
					locale: NS
				}, (props) => props.view === "summary" ? props.t("description") : /* @__PURE__ */ (0, react_jsx_runtime.jsx)(PluginPage, { t: props.t })));
			}, `${ID}: plugins.bundle.config registration`);
		}
		//#endregion
		exports.ID = ID;
		exports.apply = apply;
		exports.inject = inject;
		return module.exports;
	}
});

//# sourceMappingURL=client.js.map