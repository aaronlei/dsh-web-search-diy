/**
 * 观测页容器：概览 / 记录两个二级视图、时间与 target 筛选、刷新、导出与数据管理。
 *
 * 一级 tab（配置 / 观测）在 `client/page.tsx`；本文件只负责观测内部的信息架构。
 *
 * @module dsh-web-search-diy/client/obs/page
 */
import * as react from "react";
import type { Filters, StorageStats, SummaryResponse, TimeRange } from "./types.ts";
import { clearObservations, exportUrl, fetchImportStatus, fetchStorage, fetchSummary, startImport, type ImportResult } from "./api.ts";
import { RangePicker } from "./calendar.tsx";
import { bytesOf, numberOf, timeOf } from "./format.ts";
import { DEFAULT_RANGE } from "./range.ts";
import { Overview } from "./overview.tsx";
import { Records } from "./records.tsx";

/** 二级视图。 */
type ViewKey = "overview" | "records";

/** The observability page. */
export function ObsPage({ t }: { t: (key: string) => string }) {
	const [view, setView] = react.useState<ViewKey>("overview");
	const [range, setRange] = react.useState<TimeRange>(DEFAULT_RANGE);
	/** 导入范围与查询范围互相独立：共用同一个选择器，但各自持有自己的值。 */
	const [importRange, setImportRange] = react.useState<TimeRange>(DEFAULT_RANGE);
	const [target, setTarget] = react.useState("");
	const [errorCode, setErrorCode] = react.useState("");
	const [includeTests, setIncludeTests] = react.useState(false);
	const [refreshToken, setRefreshToken] = react.useState(0);
	const [summary, setSummary] = react.useState<SummaryResponse | null>(null);
	const [storage, setStorage] = react.useState<StorageStats | null>(null);
	const [targetOptions, setTargetOptions] = react.useState<readonly string[]>([]);
	const [loading, setLoading] = react.useState(true);
	const [error, setError] = react.useState<string | null>(null);
	const [clearText, setClearText] = react.useState("");
	const [clearing, setClearing] = react.useState(false);
	const [cleared, setCleared] = react.useState<string | null>(null);
	const [importing, setImporting] = react.useState(false);
	const [importProgress, setImportProgress] = react.useState<{ done: number; total: number } | null>(null);
	const [imported, setImported] = react.useState<string | null>(null);

	const filters = react.useMemo<Filters>(() => ({ range, target, includeTests, errorCode }), [range, target, includeTests, errorCode]);

	/** Load the summary and the recent list for the active filters. */
	const load = react.useCallback(async (signal: AbortSignal): Promise<void> => {
		setLoading(true);
		setError(null);
		try {
			const nextSummary = await fetchSummary(filters, signal);
			setSummary(nextSummary);
			/** 存储状态是库级信息，不跟筛选；失败不影响概览。 */
			void fetchStorage(signal).then(setStorage, () => void 0);
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
		void load(controller.signal);
		return () => controller.abort();
	}, [load, refreshToken]);

	/** Reload from the toolbar or the error banner. */
	const refresh = (): void => {
		setRefreshToken((current) => current + 1);
	};

	/** Clear the target filter from the overview or the records page. */
	const clearTarget = (): void => {
		setTarget("");
	};

	/** Import historical web_search calls from local session logs, then poll its progress. */
	const runImport = async (): Promise<void> => {
		setImporting(true);
		setImported(null);
		setImportProgress(null);
		setError(null);
		try {
			await startImport(importRange);
			for (;;) {
				const status = await fetchImportStatus();
				if (status.state === "running") {
					setImportProgress({ done: status.done, total: status.total });
					await new Promise((resolve) => setTimeout(resolve, 600));
					continue;
				}
				if (status.state === "done" && status.result !== undefined) {
					const result: ImportResult = status.result;
					setImported(t("obsImportDone")
						.replace("{sessions}", String(result.sessions))
						.replace("{imported}", String(result.imported))
						.replace("{skipped}", String(result.skipped))
						.replace("{filtered}", String(result.filtered))
						.replace("{identified}", String(result.identified))
						.replace("{updated}", String(result.updated)));
					refresh();
					break;
				}
				if (status.state === "failed") throw new Error(status.error ?? "导入失败");
				break;
			}
		} catch (cause) {
			setError(cause instanceof Error ? cause.message : String(cause));
		} finally {
			setImporting(false);
			setImportProgress(null);
		}
	};

	/** Delete every observation after the typed confirmation. */
	const clear = async (): Promise<void> => {
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

	const filtered = target.length > 0 || errorCode.length > 0;
	return (
		<div className="dwsd-obs">
			<div className="dwsd-obs-toolbar">
				<div className="dwsd-obs-segmented" role="tablist" aria-label={t("tabObservability")}>
					{(["overview", "records"] as const).map((value) => (
						<button
							key={value}
							type="button"
							role="tab"
							aria-selected={view === value}
							className={view === value ? "dwsd-obs-segment dwsd-obs-segmentOn" : "dwsd-obs-segment"}
							onClick={() => { setView(value); }}
						>
							{value === "overview" ? t("obsOverview") : t("obsRecords")}
						</button>
					))}
				</div>
				<div className="dwsd-obs-toolbarRight">
					<RangePicker label={t("obsRange")} value={range} onChange={setRange} t={t} />
					<label className="dwsd-obs-filter">
						<span className="dwsd-obs-filterLabel">{t("obsTargetFilter")}</span>
						<select className="dwsd-obs-input" value={target} onChange={(event) => { setTarget(event.target.value); }}>
							<option value="">{t("obsAllTargets")}</option>
							{targetOptions.map((value) => <option key={value} value={value}>{value}</option>)}
						</select>
					</label>
					<label className="dwsd-obs-check">
						<input type="checkbox" checked={includeTests} onChange={(event) => { setIncludeTests(event.target.checked); }} />
						<span>{t("obsIncludeTests")}</span>
					</label>
					<button type="button" className="dwsd-obs-btn" disabled={loading} onClick={refresh} aria-label={t("obsRefresh")}>
						{t(loading ? "obsRefreshing" : "obsRefresh")}
					</button>
					<a className="dwsd-obs-btn" href={exportUrl("jsonl", filters)} download>{t("obsExportJsonl")}</a>
					<a className="dwsd-obs-btn" href={exportUrl("csv", filters)} download>{t("obsExportCsv")}</a>
				</div>
			</div>
			{view === "overview"
				? <Overview
					t={t}
					summary={summary}
					loading={loading}
					error={error}
					filtered={filtered}
					onRefresh={refresh}
					onOpenTarget={(next) => { setTarget(next); setView("records"); }}
					onOpenError={(code) => { setErrorCode(code); setView("records"); }}
					onClearFilters={() => { clearTarget(); setErrorCode(""); }}
				/>
				: <Records
					t={t}
					filters={filters}
					targetOptions={targetOptions}
					errorOptions={summary?.topErrors.map((error) => error.code) ?? []}
					refreshToken={refreshToken}
					onResetTarget={clearTarget}
					onErrorCodeChange={setErrorCode}
				/>}
			<details className="dwsd-obs-data">
				<summary>{t("obsDataManagement")}</summary>
				{storage !== null ? (
					<div className="dwsd-obs-storage">
						<span>{t("obsStorageSize")}: {bytesOf(storage.bytes)}</span>
						<span>{t("obsStorageRows")}: {numberOf(storage.rows)}</span>
						<span>{t("obsStorageSources")}: {numberOf(storage.sources)}</span>
						<span>
							{t("obsStorageRange")}: {storage.oldest !== null && storage.newest !== null ? `${timeOf(storage.oldest)} ~ ${timeOf(storage.newest)}` : "—"}
						</span>
					</div>
				) : null}
				<div className="dwsd-obs-clearRow">
					<button type="button" className="dwsd-obs-btn" disabled={importing} onClick={() => { void runImport(); }}>
						{importing ? t("obsImporting") : t("obsImport")}
					</button>
					<span className="dwsd-obs-hint">
						{importProgress !== null && importProgress.total > 0
							? t("obsImportProgress").replace("{done}", String(importProgress.done)).replace("{total}", String(importProgress.total))
							: t("obsImportHint")}
					</span>
				</div>
				<div className="dwsd-obs-clearRow">
					<RangePicker className="dwsd-obs-importRange" label={t("obsImportRange")} value={importRange} onChange={setImportRange} t={t} />
				</div>
				{imported !== null ? <p className="dwsd-obs-hint" role="status">{imported}</p> : null}
				<p className="dwsd-obs-hint">{t("obsClearHint")}</p>
				<div className="dwsd-obs-clearRow">
					<input
						className="dwsd-obs-input"
						type="text"
						value={clearText}
						placeholder={t("obsClearPlaceholder")}
						onChange={(event) => { setClearText(event.target.value); }}
					/>
					<button type="button" className="dwsd-obs-btn" disabled={clearText !== "DELETE" || clearing} onClick={() => { void clear(); }}>
						{t(clearing ? "obsClearing" : "obsClear")}
					</button>
				</div>
				{cleared !== null ? <p className="dwsd-obs-hint" role="status">{cleared}</p> : null}
			</details>
		</div>
	);
}
