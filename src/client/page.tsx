/**
 * The full configuration page: shape → protocol → vendor selection, a
 * catalog-driven field form, template seeding, test and save.
 */
import * as react from "react";
import type { Protocol, Shape } from "../catalog.ts";
import type { CatalogEntry, Primitive, Snapshot, TargetDraft } from "./types.ts";
import { CONFIG_URL, TEST_URL } from "./consts.ts";
import {
	ADVANCED,
	BOOLEANS,
	CHAT_VARIANT_FIELDS,
	CHAT_VARIANT_ONLY,
	CUSTOM_SEARCH_ENGINES,
	ENUMS,
	NUMBERS,
	allCredentialRefs,
	credentialRefsFor
} from "./field-meta.ts";
import { defaultText, fillFromTemplate, seedFromTemplate, stagedValue, toDraft, wireValue } from "./draft.ts";
import { PROTOCOLS, protocolLabel, supportLabel, vendorLabel } from "./labels.ts";
import { ChoiceField, ComboField, SecretField, SelectField, SwitchField, ValueField } from "./fields.tsx";

/** The full configuration page. */
export function ConfigPage({ t }: { t: (key: string) => string }) {
	const [snapshot, setSnapshot] = react.useState<Snapshot | null>(null);
	const [failed, setFailed] = react.useState<string | null>(null);
	const [saving, setSaving] = react.useState(false);
	const [apiKey, setApiKey] = react.useState("");
	const [testing, setTesting] = react.useState(false);
	const [testResult, setTestResult] = react.useState<{ text: string; warn: boolean } | null>(null);
	/** 加载前占位：与 Host 默认 target（DeepSeek 纯工具搜索）一致，GET 返回后以服务端选择为准。 */
	const [shape, setShape] = react.useState<Shape>("standalone");
	const [vendor, setVendor] = react.useState("deepseek");
	const [protocol, setProtocol] = react.useState<Protocol>("search");
	const [drafts, setDrafts] = react.useState<Record<string, TargetDraft>>({});
	const [baseline, setBaseline] = react.useState<Record<string, TargetDraft>>({});
	/** 模板是一次性填充动作：`lastTemplate` 只用于 placeholder 提示，不进入配置。 */
	const [lastTemplate, setLastTemplate] = react.useState<string | null>(null);
	/** 已保存过配置时，切模板先要求确认，避免静默覆盖。 */
	const [pendingTemplate, setPendingTemplate] = react.useState<{ id: string; label: string } | null>(null);
	/** Aborts an in-flight snapshot request when the card unmounts or a reload supersedes it. */
	const loadAbort = react.useRef<AbortController | null>(null);

	/** Load the host snapshot and stage every saved target. */
	const load = react.useCallback(async () => {
		loadAbort.current?.abort();
		const controller = new AbortController();
		loadAbort.current = controller;
		try {
			const response = await fetch(CONFIG_URL, { headers: { accept: "application/json" }, signal: controller.signal });
			if (!response.ok) throw new Error(`HTTP ${response.status}`);
			const data = await response.json() as Snapshot;
			const staged: Record<string, TargetDraft> = {};
			for (const [id, bucket] of Object.entries(data.targets ?? {})) staged[id] = toDraft(bucket);
			const selection = data.selection ?? { vendor: "deepseek", protocol: "search" as Protocol };
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
		void load();
		/** Drop the in-flight request when the card unmounts; its setState would be pointless. */
		return () => { loadAbort.current?.abort(); };
	}, [load]);

	if (snapshot === null) {
		return <p className="dwsd-status">{failed === "loadFailed" ? t("loadFailed") : failed ?? t("loading")}</p>;
	}

	const catalog = snapshot.catalog;
	const shapeProtocols = PROTOCOLS.filter((value) => catalog.some((entry) => entry.kind === shape && entry.protocol === value));
	const vendorEntries = catalog.filter((entry) => entry.kind === shape && entry.protocol === protocol && entry.support !== "unsupported");
	/** 折叠区只列当前形态下不可用的组合：内置协议与纯工具的原因分开呈现。 */
	const unsupportedEntries = catalog.filter((entry) => entry.support === "unsupported" && entry.kind === shape);
	const currentId = `${vendor}/${protocol}`;
	const entry = catalog.find((item) => item.id === currentId);
	const savedDraft = baseline[currentId] ?? {};
	const draft = drafts[currentId] ?? savedDraft;
	/** 选择本身也是待保存状态：切换厂商/协议后即使字段没改，也要能保存这次选择。 */
	const selectionChanged = vendor !== snapshot.selection.vendor || protocol !== snapshot.selection.protocol;
	const dirty = selectionChanged || JSON.stringify(draft) !== JSON.stringify(savedDraft) || apiKey.length > 0;
	/**
	 * 密钥徽标跟随所选厂商：GET 一次探测每个厂商的默认链；`custom` 的引用名由
	 * 用户填写，无法预判，改为提示它取决于引用名。
	 */
	const customCredential = vendor === "custom";
	const credentialConfigured = customCredential ? false : snapshot.credentials?.[vendor] ?? snapshot.keyConfigured;
	const credentialLabel = customCredential
		? t("apiKeyByReference")
		: credentialConfigured ? t("apiKeySet") : t("apiKeyUnset");

	/** Switch shape, landing on that shape's default target when the host declares one. */
	const chooseShape = (next: Shape): void => {
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
		const fallback = catalog.find((item) => item.kind === next && item.protocol === keep && item.support === "full")
			?? catalog.find((item) => item.kind === next && item.protocol === keep && item.support !== "unsupported");
		if (fallback !== void 0) setVendor(fallback.vendor);
	};

	/** Switch protocol, moving to a vendor that supports it when needed. */
	const chooseProtocol = (next: Protocol): void => {
		setProtocol(next);
		setApiKey("");
		setLastTemplate(null);
		setPendingTemplate(null);
		if (catalog.some((item) => item.vendor === vendor && item.protocol === next)) return;
		const fallback = catalog.find((item) => item.kind === shape && item.protocol === next && item.support === "full")
			?? catalog.find((item) => item.kind === shape && item.protocol === next && item.support !== "unsupported");
		if (fallback !== void 0) setVendor(fallback.vendor);
	};

	/** Seed a custom target's draft from its first template when nothing is saved yet. */
	const seededDraft = (next: CatalogEntry | undefined): TargetDraft =>
		next === void 0 || Object.keys(baseline[next.id] ?? {}).length > 0 ? {} : seedFromTemplate(next);

	/** Stage one field on the current target. */
	const edit = (key: string, value: Primitive): void => {
		/** 切换自定义 Chat 的变体时清掉上一个变体的专属字段，避免保存无用参数。 */
		if (key === "chatVariant" && entry?.support === "custom" && entry.protocol === "chat-completions") {
			const allowed = new Set(CHAT_VARIANT_FIELDS[String(value)] ?? []);
			const next: TargetDraft = {};
			for (const [k, v] of Object.entries(draft)) {
				if (!CHAT_VARIANT_ONLY.has(k) || allowed.has(k)) next[k] = v;
			}
			next[key] = value;
			setDrafts((current) => ({ ...current, [currentId]: next }));
			return;
		}
		setDrafts((current) => ({ ...current, [currentId]: { ...draft, [key]: value } }));
	};

	/** Discard staged edits for the current target. */
	const discard = (): void => {
		setDrafts((current) => ({ ...current, [currentId]: savedDraft }));
		setApiKey("");
		setLastTemplate(null);
		setPendingTemplate(null);
		setVendor(snapshot.selection.vendor);
		setProtocol(snapshot.selection.protocol);
		setShape(snapshot.selection.protocol === "search" ? "standalone" : "in-protocol");
		setFailed(null);
	};

	/** Run one minimal search with the staged draft; nothing is persisted. */
	const test = async (): Promise<void> => {
		setTesting(true);
		setTestResult(null);
		const payload: Record<string, unknown> = { vendor, protocol };
		for (const [key, value] of Object.entries(draft)) payload[key] = wireValue(key, value);
		try {
			const response = await fetch(TEST_URL, {
				method: "POST",
				headers: { "content-type": "application/json" },
				body: JSON.stringify(payload)
			});
			const data = await response.json() as { ok?: boolean; sourceCount?: number; sourceQuality?: string; degraded?: boolean; latencyMs?: number; error?: string };
			if (data.ok === true) {
				const count = data.sourceCount ?? 0;
				const ms = data.latencyMs ?? 0;
				/** 0 来源按该组合的预期来源质量分级：设计上不返回、可能未执行、或应检查配置。 */
				const summary = count > 0
					? `${t("testOk")} · ${count} ${t("testSources")} · ${ms}ms`
					: data.sourceQuality === "none"
						? `${t("testOk")} · ${t("testNoSourcesByDesign")} · ${ms}ms`
						: data.sourceQuality === "partial"
							? `${t("testOk")} · ${t("testNoSourcesPartial")} · ${ms}ms`
							: `${t("testOk")} · ${t("testNoSourcesFull")} · ${ms}ms`;
				setTestResult({ text: `${summary}${data.degraded === true ? ` · ${t("testDegraded")}` : ""}`, warn: count === 0 && data.sourceQuality !== "none" });
			} else {
				setTestResult({ text: `${t("testFailed")}: ${data.error ?? `HTTP ${response.status}`}`, warn: true });
			}
		} catch (cause) {
			setTestResult({ text: `${t("testFailed")}: ${cause instanceof Error ? cause.message : String(cause)}`, warn: true });
		} finally {
			setTesting(false);
		}
	};

	/** Submit the staged draft for the current target. */
	const save = async (): Promise<void> => {
		setSaving(true);
		setFailed(null);
		const payload: Record<string, unknown> = { vendor, protocol };
		/** Send every staged key: a blank value is the host's "clear this key" signal. */
		for (const [key, value] of Object.entries(draft)) payload[key] = wireValue(key, value);
		if (apiKey.length > 0) payload.apiKey = apiKey;
		try {
			const response = await fetch(CONFIG_URL, {
				method: "POST",
				headers: { "content-type": "application/json" },
				body: JSON.stringify(payload)
			});
			const data = await response.json() as { ok?: boolean; error?: string };
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
	const labelOf = (key: string): string => {
		const translated = t(`field_${key}`);
		return translated === `field_${key}` ? key : translated;
	};

	/** Apply a custom target's template: rebuild the draft from that template, never leaking the previous one's values. */
	const applyTemplate = (templateId: string): void => {
		const template = entry?.templates?.find((item) => item.id === templateId);
		if (template === void 0) return;
		/** 只填该 target 声明的字段；`template` 本身不进入草稿，保存时也不会提交。 */
		const next = fillFromTemplate(template, entry?.fields ?? []);
		setDrafts((current) => ({ ...current, [currentId]: next }));
		setLastTemplate(template.label);
	};

	/** 选模板：有已保存配置时先确认，否则直接填充。 */
	const chooseTemplate = (templateId: string): void => {
		const template = entry?.templates?.find((item) => item.id === templateId);
		if (template === void 0) return;
		if (snapshot.targets?.[currentId] !== void 0) {
			setPendingTemplate({ id: template.id, label: template.label });
			return;
		}
		applyTemplate(template.id);
	};

	const confirmTemplate = (): void => {
		if (pendingTemplate === null) return;
		applyTemplate(pendingTemplate.id);
		setPendingTemplate(null);
	};

	/** 重置回该 target 已保存的配置（没有保存过则清空）。 */
	const resetToSaved = (): void => {
		setDrafts((current) => ({ ...current, [currentId]: savedDraft }));
		setLastTemplate(null);
		setPendingTemplate(null);
	};

	/** Render one field by its declared type. */
	const renderField = (key: string): JSX.Element => {
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
			const options = entry?.vendor === "custom"
				? allCredentialRefs(catalog)
				: credentialRefsFor(catalog, entry?.vendor ?? "");
			return <ComboField key={key} id={id} label={labelOf(key)} hint={hint} text={current} options={options.length > 0 ? options : allCredentialRefs(catalog)} onEdit={(next) => { edit(key, next); }} />;
		}
		if (key === "toolType") {
			const raw = draft[key];
			const current = raw === void 0 ? defaultText(entry, key) : String(raw);
			return <ComboField key={key} id={id} label={labelOf(key)} hint={hint} text={current} options={ENUMS.toolType} onEdit={(next) => { edit(key, next); }} />;
		}
		if (key === "searchEngine" && entry?.support === "custom") {
			/** 自定义网关的引擎名不统一：候选只做提示，允许自由输入，留空不发送。 */
			const raw = draft[key];
			const current = raw === void 0 ? defaultText(entry, key) : String(raw);
			return <ComboField key={key} id={id} label={labelOf(key)} hint={t("hint_searchEngineCustom")} text={current} options={CUSTOM_SEARCH_ENGINES} onEdit={(next) => { edit(key, next); }} />;
		}
		if (BOOLEANS.has(key)) {
			return <SwitchField key={key} id={id} label={labelOf(key)} hint={hint} checked={value === true} onEdit={(checked) => { edit(key, checked); }} />;
		}
		if (ENUMS[key] !== void 0) {
			const options = ENUMS[key].map((option) => {
				const labelKey = `opt_${key}_${option === "" ? "empty" : option}`;
				const label = t(labelKey);
				return { value: option, label: label === labelKey || label.startsWith("<missing") ? (option.length > 0 ? option : "—") : label };
			});
			const current = String(value) === "" ? defaultText(entry, key) : String(value);
			return <ChoiceField key={key} id={id} label={labelOf(key)} hint={hint} value={current} options={options} onEdit={(next) => { edit(key, next); }} />;
		}
		const numeric = NUMBERS.has(key);
		const text = String(value);
		const invalid = numeric && text.length > 0 && !/^\d+$/u.test(text);
		return <ValueField
			key={key}
			id={id}
			label={labelOf(key)}
			hint={hint}
			text={text}
			placeholder={placeholder}
			numeric={numeric}
			invalid={invalid}
			invalidLabel={key === "count" ? t("invalidCount") : t("invalidNumber")}
			disabled={key === "model" && entry?.modelLocked === true}
			onEdit={(next) => { edit(key, next); }}
		/>;
	};

	const chatVariant = String(stagedValue(draft, entry, "chatVariant") || entry?.defaults.chatVariant || "zhipu");
	const isCustomChat = entry?.support === "custom" && entry.protocol === "chat-completions";
	const variantFields = isCustomChat ? new Set(CHAT_VARIANT_FIELDS[chatVariant] ?? []) : void 0;
	/** `chatVariant` 由模板决定并随配置保存，但不作为用户可选项展示。 */
	const fields = (entry?.fields ?? []).filter((key) => key !== "template" && key !== "chatVariant" && (
		variantFields === void 0 || !CHAT_VARIANT_ONLY.has(key) || variantFields.has(key)
	));
	const basic = fields.filter((key) => !ADVANCED.has(key));
	const advanced = fields.filter((key) => ADVANCED.has(key));

	return (
		<div className="dwsd-body">
			<div className="dwsd-field">
				<div className="dwsd-head">
					<span className="dwsd-label">{t("shape")}</span>
				</div>
				<div className="dwsd-choices" role="radiogroup" aria-label={t("shape")}>
					{(["in-protocol", "standalone"] as const).map((value) => (
						<label className="dwsd-choice" key={value}>
							<input id={`plugin-config-web-search-diy-shape-${value}`} type="radio" name="plugin-config-web-search-diy-shape" value={value} checked={shape === value} onChange={() => { chooseShape(value); }} />
							<span className="dwsd-choiceLabel">{value === "in-protocol" ? t("shapeInProtocol") : t("shapeStandalone")}</span>
						</label>
					))}
				</div>
				<p className="dwsd-hint">{t("description")}</p>
			</div>
			{shapeProtocols.length > 1 ? <div className="dwsd-field">
				<div className="dwsd-head">
					<span className="dwsd-label">{t("protocol")}</span>
				</div>
				<div className="dwsd-choices" role="radiogroup" aria-label={t("protocol")}>
					{shapeProtocols.map((value) => (
						<label className="dwsd-choice" key={value}>
							<input id={`plugin-config-web-search-diy-protocol-${value}`} type="radio" name="plugin-config-web-search-diy-protocol" value={value} checked={protocol === value} onChange={() => { chooseProtocol(value); }} />
							<span className="dwsd-choiceLabel">{protocolLabel(t, value)}</span>
						</label>
					))}
				</div>
			</div> : null}
			<div className="dwsd-field">
				<div className="dwsd-head">
					<span className="dwsd-label">{t("vendor")}</span>
				</div>
				<div className="dwsd-choices" role="radiogroup" aria-label={t("vendor")}>
					{vendorEntries.map((item) => (
						<label className="dwsd-choice" key={item.id}>
							<input
								id={`plugin-config-web-search-diy-vendor-${item.vendor}`}
								type="radio"
								name="plugin-config-web-search-diy-vendor"
								value={item.vendor}
								checked={vendor === item.vendor}
								onChange={() => {
									const nextId = `${item.vendor}/${protocol}`;
									const next = catalog.find((entryItem) => entryItem.id === nextId);
									setVendor(item.vendor);
									setApiKey("");
									setLastTemplate(null);
									setPendingTemplate(null);
									setDrafts((current) => current[nextId] !== void 0 ? current : { ...current, [nextId]: seededDraft(next) });
								}}
							/>
							<span className="dwsd-choiceLabel">
								{vendorLabel(t, item.vendor)} · {supportLabel(t, item.support)}
								{item.support === "degraded" && item.reason.length > 0 ? <span className="dwsd-choiceReason">{item.reason}</span> : null}
							</span>
						</label>
					))}
				</div>
			</div>
			{unsupportedEntries.length > 0 ? (
				<details className="dwsd-advanced">
					<summary>{t("unsupportedVendors")} ({unsupportedEntries.length})</summary>
					{unsupportedEntries.map((item) => (
						<p className="dwsd-notice" key={item.id}>{vendorLabel(t, item.vendor)} · {protocolLabel(t, item.protocol)} — {item.reason}</p>
					))}
				</details>
			) : null}
			{entry?.support === "custom" ? <p className="dwsd-notice">{t("customNotice")}</p> : null}
			{entry?.templates !== void 0 ? (
				<div className="dwsd-field">
					<SelectField
						id={`plugin-config-web-search-diy-${currentId.replace(/[^a-z0-9]+/gu, "-")}-template`}
						label={t("fillFromTemplate")}
						hint={t("templateFillHint")}
						value=""
						placeholder={lastTemplate === null ? t("templatePlaceholder") : t("templateUsed").replace("{name}", lastTemplate)}
						options={entry.templates.map((item) => ({ value: item.id, label: item.label }))}
						onChange={(next) => { chooseTemplate(next); }}
					/>
					{pendingTemplate !== null ? (
						<div className="dwsd-confirm">
							<p className="dwsd-failed" role="alert">{t("templateOverwrite").replace("{name}", pendingTemplate.label)}</p>
							<button type="button" className="dwsd-discard" onClick={confirmTemplate}>{t("templateApply")}</button>
							<button type="button" className="dwsd-discard" onClick={() => { setPendingTemplate(null); }}>{t("templateCancel")}</button>
						</div>
					) : null}
					{snapshot.targets?.[currentId] !== void 0 ? <button type="button" className="dwsd-discard" onClick={resetToSaved}>{t("resetToSaved")}</button> : null}
				</div>
			) : null}
			{entry !== void 0 && entry.support !== "unsupported" ? <div>{basic.map(renderField)}</div> : null}
			{entry !== void 0 && entry.support !== "unsupported" && advanced.length > 0 ? (
				<details className="dwsd-advanced">
					<summary>{t("advanced")}</summary>
					{advanced.map(renderField)}
				</details>
			) : null}
			<SecretField
				id="plugin-config-web-search-diy-api-key"
				label={t("apiKey")}
				hint={t("apiKeyHint")}
				text={apiKey}
				configured={credentialConfigured}
				stateLabel={credentialLabel}
				disabled={entry?.support === "unsupported"}
				onEdit={setApiKey}
			/>
			<div className="dwsd-footer">
				{dirty ? <span className="dwsd-badgeMuted">{t("unsaved")}</span> : null}
				{testResult !== null ? <p className={testResult.warn ? "dwsd-failed" : "dwsd-hint"} role="status">{testResult.text}</p> : null}
				<button type="button" className="dwsd-discard" disabled={testing || entry?.support === "unsupported"} onClick={() => { void test(); }}>{t(testing ? "testing" : "test")}</button>
				{failed !== null ? <p className="dwsd-failed" role="status">{failed}</p> : null}
				<button type="button" className="dwsd-discard" disabled={!dirty || saving} onClick={discard}>{t("discard")}</button>
				<button type="button" className="dwsd-save" disabled={!dirty || saving || entry?.support === "unsupported"} onClick={() => { void save(); }}>{t(saving ? "saving" : "save")}</button>
			</div>
		</div>
	);
}
