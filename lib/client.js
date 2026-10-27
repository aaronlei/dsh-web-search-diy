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
		/** Enum value ranges (display layer; the host validates authoritatively). */
		const ENUMS = {
			toolType: [
				"web_search",
				"openrouter:web_search",
				"web_search_20250305",
				"web_search_20260209",
				"web_search_20260318"
			],
			thinking: ["default", "disabled"],
			effort: [
				"",
				"low",
				"medium",
				"high",
				"xhigh",
				"max"
			],
			searchEngine: [
				"search_std",
				"search_pro",
				"search_pro_sogou",
				"search_pro_quark"
			],
			searchRecencyFilter: [
				"noLimit",
				"oneDay",
				"oneWeek",
				"oneMonth",
				"oneYear"
			],
			contentSize: ["medium", "high"],
			searchStrategy: [
				"turbo",
				"max",
				"agent",
				"agent_max"
			],
			freshness: [
				"",
				"noLimit",
				"oneDay",
				"oneWeek",
				"oneMonth",
				"oneYear"
			],
			searchContextSize: [
				"low",
				"medium",
				"high"
			],
			externalWebAccess: [
				"",
				"true",
				"false"
			],
			returnTokenBudget: [
				"",
				"default",
				"unlimited"
			],
			responseInclusion: [
				"",
				"full",
				"excluded"
			]
		};
		/** Boolean fields. */
		const BOOLEANS = /* @__PURE__ */ new Set([
			"includeSources",
			"includeContent",
			"requireSearch",
			"searchIntent",
			"forcedSearch",
			"oriQuestion",
			"imageCaption"
		]);
		/** Numeric fields. */
		const NUMBERS = /* @__PURE__ */ new Set([
			"maxOutputTokens",
			"maxUses",
			"count",
			"maxResults",
			"maxTotalResults",
			"maxCharacters",
			"imageMaxResults",
			"timeoutSeconds",
			"digestEntries",
			"digestSnippetChars"
		]);
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
				"searchIntent",
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
			"searchIntent",
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
		const wireValue = (key, value) => NUMBERS.has(key) && typeof value === "string" && /^\d+$/u.test(value.trim()) ? Number(value.trim()) : value;
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
			if (BOOLEANS.has(key)) return entry?.defaults[key] === true;
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
								className: "dwsd-input",
								type: "text",
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
						className: "dwsd-hint",
						children: props.hint
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
		//#region src/client/page.tsx
		/**
		* The full configuration page: shape → protocol → vendor selection, a
		* catalog-driven field form, template seeding, test and save.
		*/
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
				children: failed === "loadFailed" ? t("loadFailed") : failed ?? t("loading")
			});
			const catalog = snapshot.catalog;
			const shapeProtocols = PROTOCOLS.filter((value) => catalog.some((entry) => entry.kind === shape && entry.protocol === value));
			const vendorEntries = catalog.filter((entry) => entry.kind === shape && entry.protocol === protocol && entry.support !== "unsupported");
			/** 折叠区只列当前形态下不可用的组合：内置协议与纯工具的原因分开呈现。 */
			const unsupportedEntries = catalog.filter((entry) => entry.support === "unsupported" && entry.kind === shape);
			const currentId = `${vendor}/${protocol}`;
			const entry = catalog.find((item) => item.id === currentId);
			const savedDraft = baseline[currentId] ?? {};
			const draft = drafts[currentId] ?? savedDraft;
			const dirty = vendor !== snapshot.selection.vendor || protocol !== snapshot.selection.protocol || JSON.stringify(draft) !== JSON.stringify(savedDraft) || apiKey.length > 0;
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
			/** Run one minimal search with the staged draft; nothing is persisted. */
			const test = async () => {
				setTesting(true);
				setTestResult(null);
				const payload = {
					vendor,
					protocol
				};
				for (const [key, value] of Object.entries(draft)) payload[key] = wireValue(key, value);
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
				const payload = {
					vendor,
					protocol
				};
				/** Send every staged key: a blank value is the host's "clear this key" signal. */
				for (const [key, value] of Object.entries(draft)) payload[key] = wireValue(key, value);
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
			/** Render one field by its declared type. */
			const renderField = (key) => {
				const value = stagedValue(draft, entry, key);
				const translatedHint = t(`hint_${key}`);
				const baseHint = entry?.hints[key] ?? (translatedHint.startsWith("hint_") || translatedHint.startsWith("<missing") ? t("fieldPlaceholder") : translatedHint);
				const hint = key === "model" && entry?.modelLocked === true ? t("modelLockedHint") : baseHint;
				const placeholder = defaultText(entry, key);
				const id = `plugin-config-web-search-diy-${currentId.replace(/[^a-z0-9]+/gu, "-")}-${key}`;
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
						options: ENUMS.toolType,
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
				if (BOOLEANS.has(key)) return /* @__PURE__ */ (0, react_jsx_runtime.jsx)(SwitchField, {
					id,
					label: labelOf(key),
					hint,
					checked: value === true,
					onEdit: (checked) => {
						edit(key, checked);
					}
				}, key);
				if (ENUMS[key] !== void 0) {
					const options = ENUMS[key].map((option) => {
						const labelKey = `opt_${key}_${option === "" ? "empty" : option}`;
						const label = t(labelKey);
						return {
							value: option,
							label: label === labelKey || label.startsWith("<missing") ? option.length > 0 ? option : "—" : label
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
				const numeric = NUMBERS.has(key);
				const text = String(value);
				const invalid = numeric && text.length > 0 && !/^\d+$/u.test(text);
				return /* @__PURE__ */ (0, react_jsx_runtime.jsx)(ValueField, {
					id,
					label: labelOf(key),
					hint,
					text,
					placeholder,
					numeric,
					invalid,
					invalidLabel: key === "count" ? t("invalidCount") : t("invalidNumber"),
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
										id: `plugin-config-web-search-diy-shape-${value}`,
										type: "radio",
										name: "plugin-config-web-search-diy-shape",
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
									id: `plugin-config-web-search-diy-protocol-${value}`,
									type: "radio",
									name: "plugin-config-web-search-diy-protocol",
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
									id: `plugin-config-web-search-diy-vendor-${item.vendor}`,
									type: "radio",
									name: "plugin-config-web-search-diy-vendor",
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
								id: `plugin-config-web-search-diy-${currentId.replace(/[^a-z0-9]+/gu, "-")}-template`,
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
						id: "plugin-config-web-search-diy-api-key",
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
								disabled: !dirty || saving || entry?.support === "unsupported",
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
		//#endregion
		//#region src/client/styles.ts
		/**
		* The card stylesheet. Styles mirror the official card rules under the
		* `dwsd-` prefix and are installed idempotently from the plugin effect.
		*/
		/** Styles mirroring the official card rules under our own `dwsd-` prefix. */
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
		//#region src/client/locale.ts
		/**
		* Card copy for both languages, registered under the `dshWebSearchDiy`
		* namespace. Kept in the bundle so the card follows Settings → Language
		* without a host round-trip.
		*/
		const zh = {
			title: "自定义网页搜索",
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
			unsupportedNotice: "该组合不可用：",
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
			invalidNumber: "请填正整数；留空使用默认值。",
			invalidCount: "请填 1-50 的整数（Kimi 1-20）；留空使用默认值。",
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
			hint_searchIntent: "先识别查询意图再检索。关闭可直接搜索、响应更快，但复杂问句的召回可能变差。",
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
			hint_contentField: "结果项里正文字段的名字。留空表示不拼接正文；用于生成 content 摘要。",
			field_baseURL: "接口地址",
			field_apiKeyEnv: "凭据引用",
			field_model: "模型",
			field_maxOutputTokens: "输出上限",
			field_count: "结果条数",
			field_maxUses: "搜索次数上限",
			field_searchEngine: "搜索引擎",
			field_searchRecencyFilter: "时间范围",
			field_contentSize: "摘要长度",
			field_searchIntent: "意图识别",
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
			field_promptIntervene: "提示词干预"
		};
		/** English copy. */
		const en = {
			title: "Custom web search",
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
			unsupportedNotice: "This combination is unavailable: ",
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
			invalidNumber: "Enter a positive integer, or leave blank for the default.",
			invalidCount: "Enter an integer from 1 to 50 (1-20 for Kimi), or leave blank for the default.",
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
			hint_searchIntent: "Run intent recognition before searching. Off searches directly and responds faster, at some cost in recall for complex questions.",
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
			hint_contentField: "Name of the content field in each result. Blank means no content digest is built.",
			field_baseURL: "Endpoint",
			field_apiKeyEnv: "Credential reference",
			field_model: "Model",
			field_maxOutputTokens: "Max output tokens",
			field_count: "Result count",
			field_maxUses: "Max search uses",
			field_searchEngine: "Search engine",
			field_searchRecencyFilter: "Recency",
			field_contentSize: "Snippet size",
			field_searchIntent: "Intent recognition",
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
			field_promptIntervene: "Prompt intervention"
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
			ctx.effect(() => ctx.locale.register(NS, {
				zh,
				en
			}), `${ID}: dictionaries`);
			ctx.effect(() => {
				ctx.slots.inject("plugins.bundle.config", () => ctx.slots.register({
					name: "plugins.bundle.config",
					key: ID,
					locale: NS
				}, (props) => props.view === "summary" ? props.t("description") : /* @__PURE__ */ (0, react_jsx_runtime.jsx)(ConfigPage, { t: props.t })));
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