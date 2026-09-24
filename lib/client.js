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
		//#region src/client/index.tsx
		/**
		* dsh-web-search-diy — client 配置卡片。
		*
		* 注册到侧栏「插件」页 dsh-web-search-diy 组合包 `web-search-diy` 行的
		* `plugins.row.config` slot（dsh 0.1.6-alpha.2 起的席位；旧「设置 → 插件
		* → 插件配置」页的 `settings.plugin.item` slot 已随该版本移除）。
		*
		* 行页面由宿主绘制标题与面包屑，本条目按 `view` 提供两种形态：
		* `summary` 是行下的一句话简介，`page` 是带保存控件的整页表单。
		*
		* 字段走官方 `ValueField` / `SecretField` 的形态（label 行 + 输入 + hint）。
		* 底部 footer 为 失败文案 + 放弃修改 + 保存，右对齐。
		* 文案经 locale 服务注册为自有命名空间，跟随 设置 → 语言（zh / en）。
		* 样式不复用官方构建产物的 hashed 类名（升级即失效），而是注入同规则的
		* 自有样式表，全部颜色走 `--dsw-alias-*` 主题变量，深浅色自动跟随。
		*
		* 卡片通过 host 的 /api/web-search-diy/config 端点读写配置：
		*   - mode / baseURL / apiKeyEnv / model / maxOutputTokens 及智谱搜索
		*     选项（searchEngine / count / searchRecencyFilter / contentSize /
		*     searchDomainFilter / searchIntent / searchPrompt）→ 存 $DSH_HOME/dsh-web-search-diy.json
		*   - API key → host 经 credentials seam 只写存储（不落配置、不回显）
		* 编辑先暂存在草稿里（header 出现「未保存」），点保存才提交；保存即生效，无需重启。
		*
		* 本文件是 lib/client.js 的权威源（宿主消费的是已构建的客户端 bundle）：
		* 改完请跑 `pnpm run bundle`，再跑 `pnpm run test:client` 验证卡片契约。
		*
		* @module dsh-web-search-diy/client
		*/
		/** Stable plugin id, stamped into the loader handoff. */
		const ID = "dsh-web-search-diy";
		/** Locale namespace for this card's strings. */
		const NS = "dshWebSearchDiy";
		/** Service dependencies: the slot registry and the locale service. */
		const inject = ["slots", "locale"];
		/** Config endpoints the host half serves. */
		const CONFIG_URL = "/api/web-search-diy/config";
		/**
		* Styles mirroring the official PluginCard.module.css and fields.module.css
		* rules, under our own `dwsd-` class prefix. Aliases only — no literals —
		* so dark/light theming stays owned by the app.
		*/
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
		/** Simplified Chinese copy. */
		const zh = {
			title: "自定义网页搜索",
			description: "多协议网页搜索提供方：OpenAI 兼容 Responses API、DeepSeek 官方 Anthropic 兼容 Messages API、智谱基础检索与问答增强。",
			expand: "展开设置",
			collapse: "收起设置",
			loading: "正在读取配置…",
			loadFailed: "读取配置失败；请确认插件服务可用后重试。",
			unsaved: "未保存",
			save: "保存",
			saving: "保存中…",
			discard: "放弃修改",
			mode: "协议模式 mode",
			modeHint: "切换搜索协议时自动填入该模式的官方接口地址（自定义地址不会被覆盖）。",
			modeResponses: "OpenAI 兼容（Responses API + web_search）",
			modeAnthropic: "Anthropic 兼容（ Messages API + web_search，DeepSeek 官方采用）",
			modeZhipuWeb: "智谱基础检索（Web Search API）",
			modeZhipuChat: "智谱问答增强（Web Search in Chat）",
			baseURL: "接口地址 baseURL",
			baseURLHint: "切换协议时自动填入官方地址；仍可改为任意自定义地址，留空保存即恢复该模式默认地址。DeepSeek 官方模式留空时还会回退到环境变量 DEEPSEEK_SEARCH_BASE_URL。",
			apiKeyEnv: "凭据引用 apiKeyEnv",
			apiKeyEnvHint: "留空则使用当前协议模式的默认引用（OpenAI 兼容：QWEN_TOKEN_PLAN_CN_API_KEY；DeepSeek 官方：DEEPSEEK_API_KEY；智谱：ZAI_CODING_CN_API_KEY，其后兼容历史名 ZHIPU_API_KEY）。切换协议时，属于其他服务商家族的引用会自动换成新协议的默认值，自定义引用名则保留。",
			model: "模型 model",
			modelHint: "留空使用默认；OpenAI 兼容模式为 deepseek-v4-flash-0731，DeepSeek 官方为 deepseek-flash，智谱问答增强为 glm-5.3-flash（配思考强度 low）。免费档 glm-4.7-flash 经常限流不可用，不建议。",
			maxOutputTokens: "最大输出 tokens",
			maxOutputTokensHint: "单次搜索回合（推理 + 工具调用 + 回答）的输出上限；留空使用该模式默认值（DeepSeek 官方 65536，其余模式 4096）。这只是上限、不预扣费，实际按生成量计费；设得过小会把回合截断、搜索轮次被砍。",
			apiVersion: "协议版本 apiVersion",
			apiVersionHint: "仅 DeepSeek 官方模式生效；作为 anthropic-version 请求头发送，官方默认 2023-06-01；留空保存恢复默认。",
			maxUses: "搜索次数上限 maxUses",
			maxUsesHint: "仅 DeepSeek 官方模式生效；单次请求内 web_search 服务端工具最多可调用几次，官方默认 5；留空保存恢复默认。",
			anthropicThinking: "思考模式",
			anthropicThinkingHint: "仅 DeepSeek 官方模式生效；该端点忽略推理档位与思考预算（实测）。关闭思考会跳过推理过程并省下思考 token（思考越长省得越多，短查询时延差别不大）。",
			searchEngine: "搜索引擎 searchEngine",
			searchEngineHint: "仅智谱模式生效；不同引擎单价不同。",
			engineStd: "search_std（智谱自研 · 基础）",
			enginePro: "search_pro（智谱自研 · 高级）",
			engineSogou: "search_pro_sogou（搜狗）",
			engineQuark: "search_pro_quark（夸克）",
			count: "结果条数 count",
			countHint: "单次搜索返回的结果条数（1-50）；请求自带上限时优先使用请求值；留空保存恢复默认。",
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
			reasoningEffort: "思考强度 reasoningEffort",
			reasoningEffortHint: "仅问答增强模式生效；low 让思考型模型（如 GLM-5.3-Flash）保持快速，复杂任务可调高。",
			effortLow: "low（快速）",
			effortHigh: "high（增强）",
			effortMax: "max（深度）",
			effortDefault: "默认（随模型，不传档位）",
			thinkingOff: "关闭思考（更快、更省）",
			responsesReasoningEffort: "推理档位 reasoning.effort",
			responsesReasoningEffortHint: "仅 OpenAI 兼容模式生效；透传 OpenAI 标准 reasoning.effort。默认不传，随大模型自身模式；网关不支持该参数时请保持默认。",
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
			description: "A multi-protocol web search provider: OpenAI-compatible Responses API, DeepSeek official Anthropic-compatible Messages API, Zhipu Web Search API, and Web Search in Chat.",
			expand: "Show settings",
			collapse: "Hide settings",
			loading: "Reading the configuration…",
			loadFailed: "The configuration could not be read; retry once the plugin service is available.",
			unsaved: "Unsaved",
			save: "Save",
			saving: "Saving…",
			discard: "Discard",
			mode: "Protocol (mode)",
			modeHint: "Switching the protocol fills in that mode's official endpoint (a customized endpoint is never overwritten).",
			modeResponses: "OpenAI-compatible (Responses API + web_search)",
			modeAnthropic: "Anthropic-compatible (Messages API + web_search, used by DeepSeek official)",
			modeZhipuWeb: "Zhipu Web Search API (basic retrieval)",
			modeZhipuChat: "Zhipu Web Search in Chat (answer augmentation)",
			baseURL: "Endpoint (baseURL)",
			baseURLHint: "Auto-filled with the official endpoint on protocol switch; still yours to override — saving it blank restores the mode default. In DeepSeek official mode a blank endpoint also falls back to the DEEPSEEK_SEARCH_BASE_URL environment variable.",
			apiKeyEnv: "Credential reference (apiKeyEnv)",
			apiKeyEnvHint: "Leave blank to use the current mode's default (OpenAI-compatible: QWEN_TOKEN_PLAN_CN_API_KEY; DeepSeek official: DEEPSEEK_API_KEY; Zhipu: ZAI_CODING_CN_API_KEY, then the historical ZHIPU_API_KEY). A reference belonging to another vendor's family follows a protocol switch; a custom name is kept.",
			model: "Model",
			modelHint: "Leave blank for the default: deepseek-v4-flash-0731 in OpenAI-compatible mode, deepseek-flash in DeepSeek official mode, glm-5.3-flash (with thinking effort low) in Zhipu chat mode. The free-tier glm-4.7-flash is frequently rate-limited and not recommended.",
			maxOutputTokens: "Max output tokens",
			maxOutputTokensHint: "Output cap for one search turn (reasoning + tool use + answer). Leave blank for the mode default: 65536 in DeepSeek official mode, 4096 elsewhere. It is a ceiling, not a reservation — only generated tokens are billed, and too small a value truncates the turn and cuts the search round short.",
			apiVersion: "Protocol version (apiVersion)",
			apiVersionHint: "DeepSeek official mode only; sent as the anthropic-version header, default 2023-06-01. Saving it blank restores the default.",
			maxUses: "Search uses per request (maxUses)",
			maxUsesHint: "DeepSeek official mode only; how many times the web_search server tool may run in one request, default 5. Saving it blank restores the default.",
			anthropicThinking: "Thinking mode",
			anthropicThinkingHint: "DeepSeek official mode only. The endpoint ignores reasoning-effort and thinking budgets (measured). Turning thinking off skips the reasoning pass and saves its tokens (the longer the reasoning, the bigger the saving; short queries barely differ).",
			searchEngine: "Search engine",
			searchEngineHint: "Zhipu modes only; engines differ in per-call pricing.",
			engineStd: "search_std (Zhipu built-in, basic)",
			enginePro: "search_pro (Zhipu built-in, advanced)",
			engineSogou: "search_pro_sogou (Sogou)",
			engineQuark: "search_pro_quark (Quark)",
			count: "Result count",
			countHint: "How many results one search returns (1-50); a request-supplied cap takes precedence. Saving it blank restores the default.",
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
			reasoningEffort: "Thinking effort",
			reasoningEffortHint: "Chat mode only; low keeps thinking-only models (e.g. GLM-5.3-Flash) fast, raise it for harder tasks.",
			effortLow: "low (fast)",
			effortHigh: "high (enhanced)",
			effortMax: "max (deep)",
			effortDefault: "Default (model's own, no knob)",
			thinkingOff: "Off (faster, cheaper)",
			responsesReasoningEffort: "Reasoning effort (reasoning.effort)",
			responsesReasoningEffortHint: "OpenAI-compatible mode only; passes the OpenAI-standard reasoning.effort. Default sends nothing and follows the model's own mode; keep the default if your gateway rejects the parameter.",
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
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
								type: "radio",
								name: props.id,
								value: option.value,
								checked: props.value === option.value,
								disabled: props.disabled,
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
		/**
		* A boolean control shaped like the official toggle switch: a switch button
		* on the field's head row, hint underneath, staged through `onEdit`.
		* @param props - the field's copy and its staged boolean.
		* @returns the labelled switch.
		*/
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
		/** Normalize one mode's stored bucket into draft-shaped values. */
		function normalizeBucket(bucket) {
			return {
				baseURL: bucket.baseURL ?? "",
				apiKeyEnv: bucket.apiKeyEnv ?? "",
				model: bucket.model ?? "",
				maxOutputTokens: bucket.maxOutputTokens != null ? String(bucket.maxOutputTokens) : "",
				apiVersion: bucket.apiVersion ?? "",
				maxUses: bucket.maxUses != null ? String(bucket.maxUses) : "",
				anthropicThinking: bucket.anthropicThinking ?? "default",
				searchEngine: bucket.searchEngine ?? "search_std",
				count: bucket.count != null ? String(bucket.count) : "",
				searchRecencyFilter: bucket.searchRecencyFilter ?? "noLimit",
				contentSize: bucket.contentSize ?? "medium",
				reasoningEffort: bucket.reasoningEffort ?? "low",
				responsesReasoningEffort: bucket.responsesReasoningEffort ?? "",
				searchDomainFilter: bucket.searchDomainFilter ?? "",
				searchIntent: !!bucket.searchIntent,
				searchPrompt: bucket.searchPrompt ?? ""
			};
		}
		/** Normalize one GET /config payload into the card's saved snapshot. */
		function toSnapshot(data) {
			return {
				mode: data.mode ?? "responses",
				...normalizeBucket(data),
				keyConfigured: !!data.keyConfigured
			};
		}
		/**
		* The draft one mode starts from: the bucket the host stored for it, or the
		* mode's official values when it has none yet. Switching modes therefore
		* restores that mode's own endpoint, model, credential reference, and search
		* options — across a reload too, because the buckets come from the host
		* rather than from anything this card remembers.
		*
		* @param mode - the mode being entered.
		* @param buckets - every stored bucket, keyed by mode.
		* @returns the staged draft for that mode.
		*/
		function draftForMode(mode, buckets) {
			const bucket = buckets?.[mode];
			if (bucket === void 0) {
				const family = modeFamily(mode);
				return {
					...emptyDraft(),
					mode,
					baseURL: OFFICIAL_ENDPOINTS[family][0],
					model: OFFICIAL_MODELS[family][0],
					apiKeyEnv: OFFICIAL_KEY_REFS[family][0]
				};
			}
			return {
				...emptyDraft(),
				...normalizeBucket(bucket),
				mode
			};
		}
		/** Draft keys compared against the saved snapshot to flag "unsaved". */
		const DRAFT_KEYS = [
			"mode",
			"baseURL",
			"apiKeyEnv",
			"model",
			"maxOutputTokens",
			"apiVersion",
			"maxUses",
			"anthropicThinking",
			"searchEngine",
			"count",
			"searchRecencyFilter",
			"contentSize",
			"reasoningEffort",
			"responsesReasoningEffort",
			"searchDomainFilter",
			"searchIntent",
			"searchPrompt"
		];
		/**
		* Official endpoint, model, and credential reference per protocol family,
		* highest priority first: these are settled facts, not something the user
		* should have to look up. A family may list several acceptable values — the
		* Zhipu chain leads with `ZAI_CODING_CN_API_KEY` (the name DeepSeek's
		* credential plane uses for a `zai-coding-cn` provider) and keeps the
		* historical `ZHIPU_API_KEY` behind it — and every entry counts as that
		* family's own.
		*/
		const OFFICIAL_ENDPOINTS = {
			responses: ["https://token-plan.cn-beijing.maas.aliyuncs.com/compatible-mode/v1"],
			"anthropic-messages": ["https://api.deepseek.com/anthropic/v1"],
			zhipu: ["https://open.bigmodel.cn/api/paas/v4"]
		};
		/**
		* Each mode's default output budget, shown as the placeholder while the
		* field is blank. The Anthropic turn needs more room than the others
		* (thinking plus the native tool round).
		*/
		const MODE_MAX_OUTPUT_TOKENS = {
			responses: 4096,
			"anthropic-messages": 65536,
			"zhipu-web-search": 4096,
			"zhipu-chat-search": 4096
		};
		const OFFICIAL_MODELS = {
			responses: ["deepseek-v4-flash-0731"],
			"anthropic-messages": ["deepseek-flash"],
			zhipu: ["glm-5.3-flash"]
		};
		const OFFICIAL_KEY_REFS = {
			responses: ["QWEN_TOKEN_PLAN_CN_API_KEY"],
			"anthropic-messages": ["DEEPSEEK_API_KEY"],
			zhipu: ["ZAI_CODING_CN_API_KEY", "ZHIPU_API_KEY"]
		};
		/** The family a mode belongs to: the key its official values live under. */
		function modeFamily(mode) {
			return mode === "zhipu-web-search" || mode === "zhipu-chat-search" ? "zhipu" : mode;
		}
		/** The draft shape behind the staged form. */
		function emptyDraft() {
			return {
				mode: "responses",
				baseURL: "",
				apiKeyEnv: "",
				model: "",
				maxOutputTokens: "",
				apiVersion: "",
				maxUses: "",
				anthropicThinking: "default",
				searchEngine: "search_std",
				count: "",
				searchRecencyFilter: "noLimit",
				contentSize: "medium",
				reasoningEffort: "low",
				responsesReasoningEffort: "",
				searchDomainFilter: "",
				searchIntent: false,
				searchPrompt: ""
			};
		}
		/**
		* The row's configuration page, sharing the official configuration pages'
		* field face: a staged form with discard/save in a footer.
		*
		* Edits stage locally; the draft differing from what the Host holds leaves
		* the save control enabled. Save POSTs the draft (an empty numeric
		* field means "keep the default"; a blank key field writes nothing), then
		* re-reads the authoritative config. A rejected save keeps the page with
		* the error in the footer, exactly where the official pages report save
		* failures.
		*
		* Protocol-specific fields render conditionally: Zhipu search options only
		* in the `zhipu-*` modes, the model/max-tokens pair only where a model
		* turn exists, and the chat prompt only in `zhipu-chat-search`.
		*
		* @param props - the slot kit; `t` resolves this entry's locale namespace.
		* @returns the page.
		*/
		function ConfigPage(props) {
			const { t } = props;
			const [loaded, setLoaded] = react.useState(false);
			const [loadFailed, setLoadFailed] = react.useState(false);
			const [saved, setSaved] = react.useState({
				...emptyDraft(),
				keyConfigured: false
			});
			/** Every stored bucket, exactly as the host serves them. */
			const [buckets, setBuckets] = react.useState({});
			const [draft, setDraft] = react.useState(emptyDraft());
			const [apiKeyDraft, setApiKeyDraft] = react.useState("");
			const [saving, setSaving] = react.useState(false);
			const [failed, setFailed] = react.useState("");
			react.useEffect(() => {
				let alive = true;
				fetch(CONFIG_URL).then((r) => {
					if (!r.ok) throw new Error(`HTTP ${r.status}`);
					return r.json();
				}).then((data) => {
					if (!alive) return;
					const snapshot = toSnapshot(data);
					setSaved(snapshot);
					setBuckets(data.modes ?? {});
					setDraft(draftForMode(snapshot.mode, data.modes ?? {}));
					setLoaded(true);
					setLoadFailed(false);
				}).catch(() => {
					if (alive) setLoadFailed(true);
				});
				return () => {
					alive = false;
				};
			}, []);
			const baseline = draftForMode(draft.mode, buckets);
			/**
			* The selected mode counts as a change on its own: entering a mode whose
			* bucket already holds these values would otherwise look clean and the
			* selection itself could never be saved.
			*/
			const dirty = draft.mode !== saved.mode || DRAFT_KEYS.some((key) => draft[key] !== baseline[key]) || apiKeyDraft !== "";
			const tokensText = draft.maxOutputTokens.trim();
			const tokensInvalid = tokensText !== "" && !(Number.isInteger(Number(tokensText)) && Number(tokensText) >= 1);
			const countText = draft.count.trim();
			const countInvalid = countText !== "" && !(Number.isInteger(Number(countText)) && Number(countText) >= 1 && Number(countText) <= 50);
			const maxUsesText = draft.maxUses.trim();
			const maxUsesInvalid = maxUsesText !== "" && !(Number.isInteger(Number(maxUsesText)) && Number(maxUsesText) >= 1);
			const isZhipu = draft.mode.startsWith("zhipu-");
			draft.mode;
			const discard = () => {
				setDraft(draftForMode(saved.mode, buckets));
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
					if (maxUsesText !== "") body.maxUses = Number(maxUsesText);
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
					setBuckets(fresh.modes ?? {});
					setDraft(draftForMode(snapshot.mode, fresh.modes ?? {}));
					setApiKeyDraft("");
				} catch (e) {
					setFailed(String(e));
				} finally {
					setSaving(false);
				}
			};
			const blocked = !dirty || tokensInvalid || countInvalid || maxUsesInvalid || saving;
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
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
								{
									value: "anthropic-messages",
									label: t("modeAnthropic")
								},
								{
									value: "responses",
									label: t("modeResponses")
								},
								{
									value: "zhipu-web-search",
									label: t("modeZhipuWeb")
								},
								{
									value: "zhipu-chat-search",
									label: t("modeZhipuChat")
								}
							],
							onEdit: (value) => {
								setDraft(draftForMode(value, buckets));
							}
						}, "mode"),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)(ValueField, {
							id: "plugin-config-web-search-diy-base-url",
							label: t("baseURL"),
							hint: t("baseURLHint"),
							placeholder: OFFICIAL_ENDPOINTS[modeFamily(draft.mode)][0],
							text: draft.baseURL,
							onEdit: (text) => {
								setDraft((current) => ({
									...current,
									baseURL: text
								}));
							}
						}, "baseURL"),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)(ValueField, {
							id: "plugin-config-web-search-diy-api-key-env",
							label: t("apiKeyEnv"),
							hint: t("apiKeyEnvHint"),
							text: draft.apiKeyEnv,
							onEdit: (text) => {
								setDraft((current) => ({
									...current,
									apiKeyEnv: text
								}));
							}
						}, "apiKeyEnv"),
						isZhipu ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)(ChoiceField, {
							id: "plugin-config-web-search-diy-search-engine",
							label: t("searchEngine"),
							hint: t("searchEngineHint"),
							value: draft.searchEngine,
							options: [
								{
									value: "search_std",
									label: t("engineStd")
								},
								{
									value: "search_pro",
									label: t("enginePro")
								},
								{
									value: "search_pro_sogou",
									label: t("engineSogou")
								},
								{
									value: "search_pro_quark",
									label: t("engineQuark")
								}
							],
							onEdit: (value) => {
								setDraft((current) => ({
									...current,
									searchEngine: value
								}));
							}
						}, "searchEngine") : null,
						isZhipu ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)(ValueField, {
							id: "plugin-config-web-search-diy-count",
							label: t("count"),
							hint: t("countHint"),
							numeric: true,
							invalid: countInvalid,
							invalidLabel: t("invalidCount"),
							text: draft.count,
							onEdit: (text) => {
								setDraft((current) => ({
									...current,
									count: text
								}));
							}
						}, "count") : null,
						isZhipu ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)(ChoiceField, {
							id: "plugin-config-web-search-diy-recency",
							label: t("searchRecencyFilter"),
							hint: t("searchRecencyHint"),
							value: draft.searchRecencyFilter,
							options: [
								{
									value: "noLimit",
									label: t("recencyNoLimit")
								},
								{
									value: "oneDay",
									label: t("recencyOneDay")
								},
								{
									value: "oneWeek",
									label: t("recencyOneWeek")
								},
								{
									value: "oneMonth",
									label: t("recencyOneMonth")
								},
								{
									value: "oneYear",
									label: t("recencyOneYear")
								}
							],
							onEdit: (value) => {
								setDraft((current) => ({
									...current,
									searchRecencyFilter: value
								}));
							}
						}, "searchRecencyFilter") : null,
						isZhipu ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)(ChoiceField, {
							id: "plugin-config-web-search-diy-content-size",
							label: t("contentSize"),
							hint: t("contentSizeHint"),
							value: draft.contentSize,
							options: [{
								value: "medium",
								label: t("sizeMedium")
							}, {
								value: "high",
								label: t("sizeHigh")
							}],
							onEdit: (value) => {
								setDraft((current) => ({
									...current,
									contentSize: value
								}));
							}
						}, "contentSize") : null,
						isZhipu ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)(ValueField, {
							id: "plugin-config-web-search-diy-domain-filter",
							label: t("searchDomainFilter"),
							hint: t("searchDomainHint"),
							text: draft.searchDomainFilter,
							onEdit: (text) => {
								setDraft((current) => ({
									...current,
									searchDomainFilter: text
								}));
							}
						}, "searchDomainFilter") : null,
						draft.mode === "zhipu-web-search" ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)(SwitchField, {
							id: "plugin-config-web-search-diy-search-intent",
							label: t("searchIntent"),
							hint: t("searchIntentHint"),
							checked: draft.searchIntent,
							onEdit: (checked) => {
								setDraft((current) => ({
									...current,
									searchIntent: checked
								}));
							}
						}, "searchIntent") : null,
						draft.mode === "zhipu-chat-search" ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)(ChoiceField, {
							id: "plugin-config-web-search-diy-reasoning-effort",
							label: t("reasoningEffort"),
							hint: t("reasoningEffortHint"),
							value: draft.reasoningEffort,
							options: [
								{
									value: "low",
									label: t("effortLow")
								},
								{
									value: "high",
									label: t("effortHigh")
								},
								{
									value: "max",
									label: t("effortMax")
								}
							],
							onEdit: (value) => {
								setDraft((current) => ({
									...current,
									reasoningEffort: value
								}));
							}
						}, "reasoningEffort") : null,
						draft.mode === "zhipu-chat-search" ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)(ValueField, {
							id: "plugin-config-web-search-diy-search-prompt",
							label: t("searchPrompt"),
							hint: t("searchPromptHint"),
							text: draft.searchPrompt,
							onEdit: (text) => {
								setDraft((current) => ({
									...current,
									searchPrompt: text
								}));
							}
						}, "searchPrompt") : null,
						draft.mode !== "zhipu-web-search" ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)(ValueField, {
							id: "plugin-config-web-search-diy-model",
							label: t("model"),
							hint: t("modelHint"),
							text: draft.model,
							onEdit: (text) => {
								setDraft((current) => ({
									...current,
									model: text
								}));
							}
						}, "model") : null,
						draft.mode !== "zhipu-web-search" ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)(ValueField, {
							id: "plugin-config-web-search-diy-max-output-tokens",
							label: t("maxOutputTokens"),
							hint: t("maxOutputTokensHint"),
							placeholder: String(MODE_MAX_OUTPUT_TOKENS[draft.mode]),
							numeric: true,
							invalid: tokensInvalid,
							invalidLabel: t("invalidNumber"),
							text: draft.maxOutputTokens,
							onEdit: (text) => {
								setDraft((current) => ({
									...current,
									maxOutputTokens: text
								}));
							}
						}, "maxOutputTokens") : null,
						draft.mode === "anthropic-messages" ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)(ValueField, {
							id: "plugin-config-web-search-diy-api-version",
							label: t("apiVersion"),
							hint: t("apiVersionHint"),
							text: draft.apiVersion,
							onEdit: (text) => {
								setDraft((current) => ({
									...current,
									apiVersion: text
								}));
							}
						}, "apiVersion") : null,
						draft.mode === "anthropic-messages" ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)(ValueField, {
							id: "plugin-config-web-search-diy-max-uses",
							label: t("maxUses"),
							hint: t("maxUsesHint"),
							numeric: true,
							invalid: maxUsesInvalid,
							invalidLabel: t("invalidNumber"),
							text: draft.maxUses,
							onEdit: (text) => {
								setDraft((current) => ({
									...current,
									maxUses: text
								}));
							}
						}, "maxUses") : null,
						draft.mode === "anthropic-messages" ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)(ChoiceField, {
							id: "plugin-config-web-search-diy-anthropic-thinking",
							label: t("anthropicThinking"),
							hint: t("anthropicThinkingHint"),
							value: draft.anthropicThinking,
							options: [{
								value: "default",
								label: t("effortDefault")
							}, {
								value: "disabled",
								label: t("thinkingOff")
							}],
							onEdit: (value) => {
								setDraft((current) => ({
									...current,
									anthropicThinking: value
								}));
							}
						}, "anthropicThinking") : null,
						draft.mode === "responses" ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)(ChoiceField, {
							id: "plugin-config-web-search-diy-responses-reasoning-effort",
							label: t("responsesReasoningEffort"),
							hint: t("responsesReasoningEffortHint"),
							value: draft.responsesReasoningEffort,
							options: [
								{
									value: "",
									label: t("effortDefault")
								},
								{
									value: "low",
									label: t("effortLow")
								},
								{
									value: "high",
									label: t("effortHigh")
								}
							],
							onEdit: (value) => {
								setDraft((current) => ({
									...current,
									responsesReasoningEffort: value
								}));
							}
						}, "responsesReasoningEffort") : null,
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
			});
		}
		/**
		* Register the row's configuration entry on the Plugins page.
		*
		* `plugins.row.config` is a KEYED slot keyed by `<package name>#<row id>`:
		* `web-search-diy` is the row id the bundle's cordis.patch.yml inserts, so
		* the key is `dsh-web-search-diy#web-search-diy` (the patch declaring the
		* row is the slot's precondition, and the entry lives only while the row
		* is enabled). `locale: NS` is what hands the component its `t` — the same
		* mechanism the official entries use, which is why the page follows
		* Settings → Language like they do. The owner asks for two views:
		* `summary` renders the one-liner under the row title, `page` mounts the
		* form (the page itself draws the title, icon, and crumb).
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
				ctx.slots.inject("plugins.row.config", () => ctx.slots.register({
					name: "plugins.row.config",
					key: `${ID}#web-search-diy`,
					locale: NS
				}, (props) => props.view === "summary" ? props.t("description") : /* @__PURE__ */ (0, react_jsx_runtime.jsx)(ConfigPage, { t: props.t })));
			}, `${ID}: plugins.row.config registration`);
		}
		//#endregion
		exports.ID = ID;
		exports.apply = apply;
		exports.inject = inject;
		return module.exports;
	}
});

//# sourceMappingURL=client.js.map