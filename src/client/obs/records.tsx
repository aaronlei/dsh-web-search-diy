/**
 * 记录页：状态/搜索词筛选、时间倒序表格、展开详情与「加载更多」分页。
 *
 * @module dsh-web-search-diy/client/obs/records
 */
import * as react from "react";
import type { Filters, RecordView, StatusKey } from "./types.ts";
import { fetchRecords } from "./api.ts";
import { durationOf, numberOf, queryOf, timeOf } from "./format.ts";
import { EmptyState, ErrorBanner, StatusCell, TableSkeleton } from "./shared.tsx";

/** 每页记录数。 */
const PAGE_SIZE = 50;

/** 展开详情需要展示的来源标记。 */
function sourceMarks(t: (key: string) => string, source: RecordView["sources"][number]): string[] {
	const marks: string[] = [];
	if (source.hasSummary) marks.push(t("obsSourceSummary"));
	if (source.hasSnippet) marks.push(t("obsSourceSnippet"));
	if (!source.hasTitle) marks.push(t("obsSourceNoTitle"));
	return marks;
}

/** One record row plus, when expanded, its detail row. */
function RecordRows({ t, record, open, onToggle, onCopy }: {
	t: (key: string) => string;
	record: RecordView;
	open: boolean;
	onToggle: () => void;
	onCopy: () => void;
}) {
	const detailsId = `dwsd-obs-details-${record.id}`;
	return [
		<tr
			key="row"
			className="dwsd-obs-clickable"
			tabIndex={0}
			aria-expanded={open}
			aria-controls={detailsId}
			onClick={onToggle}
			onKeyDown={(event) => {
				if (event.key === "Enter" || event.key === " ") {
					event.preventDefault();
					onToggle();
				}
			}}
		>
				<td className="dwsd-obs-timeCell">{timeOf(record.at)}</td>
				<td className="dwsd-obs-targetCell">{record.target}</td>
				<td className="dwsd-obs-queryCell">{queryOf(record.query)}</td>
				<td className="dwsd-obs-num">{durationOf(record.durationMs)}</td>
				<td className="dwsd-obs-num">{numberOf(record.sourceCount)}</td>
				<td className="dwsd-obs-num">{record.sourceCount === 0 ? "—" : numberOf(record.withSummary)}</td>
			<td><StatusCell t={t} ok={record.ok} /></td>
		</tr>,
		open ? (
			<tr key="details" id={detailsId} className="dwsd-obs-detailRow">
					<td colSpan={7}>
						<div className="dwsd-obs-detail">
							{record.errorCode !== void 0 ? (
								<p className="dwsd-obs-detailError">
									<strong>{t("obsDetailsError")}:</strong> {record.errorCode}{record.errorMessage !== void 0 ? `: ${record.errorMessage}` : ""}
								</p>
							) : null}
							<div className="dwsd-obs-detailMeta">
								<span>{t("obsDetailsKind")}: {record.kind}</span>
								<span>{t("obsDetailsAnswer")}: {numberOf(record.answerChars)}</span>
								<span>{t("obsDetailsRecordId")}: {record.id}</span>
								{record.sessionId !== void 0 ? <span>{t("obsDetailsSession")}: {record.sessionId}</span> : null}
							</div>
							<p className="dwsd-obs-detailTitle">{t("obsDetailsSources")}</p>
							{record.sources.length === 0
								? <p className="dwsd-obs-hint">{t("obsNoData")}</p>
								: <ul className="dwsd-obs-sourceList">
									{record.sources.map((source) => (
										<li className="dwsd-obs-sourceRow" key={source.urlHash}>
											<span className="dwsd-obs-sourceHost">{source.host.length > 0 ? source.host : t("obsSourceNoHost")}</span>
											<span className="dwsd-obs-sourceHash">{source.urlHash}</span>
											<span className="dwsd-obs-marks">{sourceMarks(t, source).map((mark) => <span className="dwsd-obs-mark" key={mark}>{mark}</span>)}</span>
										</li>
									))}
								</ul>}
							<div className="dwsd-obs-detailActions">
								<button type="button" className="dwsd-obs-btn" onClick={(event) => { event.stopPropagation(); onCopy(); }}>{t("obsCopyJson")}</button>
							</div>
						</div>
					</td>
				</tr>
		) : null
	];
}

/** Records props. */
export interface RecordsProps {
	readonly t: (key: string) => string;
	readonly filters: Filters;
	readonly targetOptions: readonly string[];
	/** Bumped by the parent's refresh button to reload the first page. */
	readonly refreshToken: number;
	/** Clears the parent's target filter (the in-view filters are cleared here). */
	readonly onResetTarget: () => void;
}

/** The records view. */
export function Records(props: RecordsProps) {
	const { t, filters } = props;
	const [status, setStatus] = react.useState<StatusKey>("all");
	const [term, setTerm] = react.useState("");
	const [appliedTerm, setAppliedTerm] = react.useState("");
	const [records, setRecords] = react.useState<readonly RecordView[]>([]);
	const [nextBefore, setNextBefore] = react.useState<string | null>(null);
	const [expanded, setExpanded] = react.useState<string | null>(null);
	const [loading, setLoading] = react.useState(true);
	const [loadingMore, setLoadingMore] = react.useState(false);
	const [error, setError] = react.useState<string | null>(null);
	const [toast, setToast] = react.useState<string | null>(null);
	const toastTimer = react.useRef<ReturnType<typeof setTimeout> | null>(null);
	const abortRef = react.useRef<AbortController | null>(null);

	/** Reload the first page for the current filters. */
	const loadFirstPage = react.useCallback(async (signal: AbortSignal) => {
		setLoading(true);
		setError(null);
		try {
			const page = await fetchRecords(filters, { limit: PAGE_SIZE, status, query: appliedTerm }, signal);
			setRecords(page.records);
			setNextBefore(page.nextBefore);
		} catch (cause) {
			if (!signal.aborted) setError(cause instanceof Error ? cause.message : String(cause));
		} finally {
			if (!signal.aborted) setLoading(false);
		}
	}, [filters, status, appliedTerm]);

	react.useEffect(() => {
		abortRef.current?.abort();
		const controller = new AbortController();
		abortRef.current = controller;
		void loadFirstPage(controller.signal);
		return () => controller.abort();
	}, [loadFirstPage, props.refreshToken]);

	/** Clear the toast timer on unmount. */
	react.useEffect(() => () => {
		if (toastTimer.current !== null) clearTimeout(toastTimer.current);
	}, []);

	/** Show a two-second toast. */
	const showToast = (text: string): void => {
		if (toastTimer.current !== null) clearTimeout(toastTimer.current);
		setToast(text);
		toastTimer.current = setTimeout(() => {
			setToast(null);
			toastTimer.current = null;
		}, 2000);
	};

	/** Append the next page. */
	const loadMore = async (): Promise<void> => {
		if (nextBefore === null || loadingMore) return;
		setLoadingMore(true);
		setError(null);
		try {
			const page = await fetchRecords(filters, { limit: PAGE_SIZE, status, query: appliedTerm, before: nextBefore });
			setRecords((current) => [...current, ...page.records]);
			setNextBefore(page.nextBefore);
		} catch (cause) {
			setError(cause instanceof Error ? cause.message : String(cause));
		} finally {
			setLoadingMore(false);
		}
	};

	/** Copy one record as JSON. */
	const copy = async (record: RecordView): Promise<void> => {
		try {
			await navigator.clipboard.writeText(JSON.stringify(record, null, 2));
			showToast(t("obsCopied"));
		} catch {
			showToast(t("obsCopyFailed"));
		}
	};

	/** Reset every in-view filter and ask the parent to clear its target filter. */
	const resetFilters = (): void => {
		setStatus("all");
		setTerm("");
		setAppliedTerm("");
		props.onResetTarget();
	};

	const filtered = status !== "all" || appliedTerm.length > 0 || filters.target.length > 0;
	return (
		<div className="dwsd-obs-view">
			{error !== null ? <ErrorBanner t={t} message={error} onRetry={() => {
				abortRef.current?.abort();
				const controller = new AbortController();
				abortRef.current = controller;
				void loadFirstPage(controller.signal);
			}} /> : null}
			<div className="dwsd-obs-filters">
				<label className="dwsd-obs-filter">
					<span className="dwsd-obs-filterLabel">{t("obsFilterStatus")}</span>
					<select className="dwsd-obs-input" value={status} onChange={(event) => { setStatus(event.target.value as StatusKey); }}>
						<option value="all">{t("obsAllStatuses")}</option>
						<option value="ok">{t("obsStatusOk")}</option>
						<option value="fail">{t("obsStatusFail")}</option>
					</select>
				</label>
				<label className="dwsd-obs-filter dwsd-obs-filterGrow">
					<span className="dwsd-obs-filterLabel">{t("obsFilterQuery")}</span>
					<input
						className="dwsd-obs-input"
						type="search"
						value={term}
						placeholder={t("obsFilterQueryHint")}
						onChange={(event) => { setTerm(event.target.value); }}
						onKeyDown={(event) => {
							if (event.key === "Enter") setAppliedTerm(term.trim());
						}}
					/>
				</label>
				{filtered ? <button type="button" className="dwsd-obs-btn" onClick={resetFilters}>{t("obsClearFilters")}</button> : null}
			</div>
			{loading && records.length === 0
				? <TableSkeleton rows={6} />
				: records.length === 0
					? <EmptyState
						t={t}
						title={filtered ? t("obsEmptyFiltered") : t("obsEmpty")}
						hint={filtered ? t("obsEmptyFilteredHint") : t("obsEmptyHint")}
						{...(filtered ? { actionLabel: t("obsClearFilters"), onAction: resetFilters } : {})}
					/>
					: (
						<div className="dwsd-obs-tableWrap">
							<table className="dwsd-obs-table">
								<caption className="dwsd-obs-caption">{t("obsRecordsCaption")}</caption>
								<thead>
									<tr>
										<th scope="col">{t("obsTableTime")}</th>
										<th scope="col">{t("obsTableTarget")}</th>
										<th scope="col">{t("obsTableQuery")}</th>
										<th scope="col" className="dwsd-obs-num">{t("obsTableDuration")}</th>
										<th scope="col" className="dwsd-obs-num">{t("obsTableSources")}</th>
										<th scope="col" className="dwsd-obs-num">{t("obsTableSummary")}</th>
										<th scope="col">{t("obsTableStatus")}</th>
									</tr>
								</thead>
								<tbody>
									{records.map((record) => (
										<RecordRows
											key={record.id}
											t={t}
											record={record}
											open={expanded === record.id}
											onToggle={() => { setExpanded(expanded === record.id ? null : record.id); }}
											onCopy={() => { void copy(record); }}
										/>
									))}
								</tbody>
							</table>
							{nextBefore !== null
								? <div className="dwsd-obs-more">
									<button type="button" className="dwsd-obs-btn" disabled={loadingMore} onClick={() => { void loadMore(); }}>
										{t(loadingMore ? "obsLoadingMore" : "obsLoadMore")}
									</button>
								</div>
								: null}
						</div>
					)}
			{toast !== null ? <div className="dwsd-obs-toast" role="status">{toast}</div> : null}
		</div>
	);
}
