/**
 * 记录页：状态/搜索词筛选、时间倒序表格、展开详情与页码分页。
 *
 * @module dsh-web-search-diy/client/obs/records
 */
import * as react from "react";
import type { Filters, ObservationSource, RecordView, StatusKey } from "./types.ts";
import { fetchRecords } from "./api.ts";
import { durationOf, numberOf, queryOf, targetLabelOf, timeOf } from "./format.ts";
import { EmptyState, ErrorBanner, StatusCell, TableSkeleton } from "./shared.tsx";

/** 每页条数选项；默认 10 条。 */
const PAGE_SIZES: readonly number[] = [10, 20, 50, 100];
const DEFAULT_PAGE_SIZE = 10;

/** 页码列表：首尾页 + 当前页附近，间隔用 `"gap"` 表示。 */
export function pageItemsOf(page: number, totalPages: number): readonly (number | "gap")[] {
	if (totalPages <= 7) return Array.from({ length: totalPages }, (_, index) => index + 1);
	const pages = new Set<number>([1, totalPages]);
	if (page <= 4) {
		for (let value = 2; value <= 5; value += 1) pages.add(value);
	} else if (page >= totalPages - 3) {
		for (let value = totalPages - 4; value < totalPages; value += 1) pages.add(value);
	} else {
		for (let value = page - 1; value <= page + 1; value += 1) pages.add(value);
	}
	const sorted = [...pages].filter((value) => value >= 1 && value <= totalPages).sort((left, right) => left - right);
	const items: (number | "gap")[] = [];
	let previous = 0;
	for (const value of sorted) {
		if (previous > 0 && value - previous > 1) items.push("gap");
		items.push(value);
		previous = value;
	}
	return items;
}

/** 分页栏：上一页/下一页、页码、每页条数与跳页。 */
function Pager({ t, page, pageSize, total, loading, onPage, onPageSize }: {
	readonly t: (key: string) => string;
	readonly page: number;
	readonly pageSize: number;
	readonly total: number;
	readonly loading: boolean;
	readonly onPage: (target: number) => void;
	readonly onPageSize: (size: number) => void;
}) {
	const totalPages = Math.max(1, Math.ceil(total / pageSize));
	const [jump, setJump] = react.useState("");
	const go = (target: number): void => {
		if (loading) return;
		onPage(Math.min(Math.max(target, 1), totalPages));
	};
	const applyJump = (): void => {
		const value = Number(jump);
		if (!Number.isFinite(value)) return;
		go(Math.trunc(value));
		setJump("");
	};
	return (
		<div className="dwsd-obs-pager">
			<div className="dwsd-obs-pageNav">
				<button type="button" className="dwsd-obs-pageArrow" disabled={loading || page <= 1} aria-label={t("obsPrevPage")} onClick={() => { go(page - 1); }}>‹</button>
				{pageItemsOf(page, totalPages).map((item, index) => item === "gap"
					? <span className="dwsd-obs-pageGap" key={`gap-${index}`} aria-hidden="true">…</span>
					: (
						<button
							key={item}
							type="button"
							className={`dwsd-obs-pageBtn${item === page ? " dwsd-obs-pageBtnOn" : ""}`}
							aria-current={item === page ? "page" : void 0}
							aria-label={t("obsPageNumber").replace("{page}", String(item))}
							disabled={loading}
							onClick={() => { go(item); }}
						>
							{item}
						</button>
					))}
				<button type="button" className="dwsd-obs-pageArrow" disabled={loading || page >= totalPages} aria-label={t("obsNextPage")} onClick={() => { go(page + 1); }}>›</button>
			</div>
			<select
				className="dwsd-obs-input dwsd-obs-pageSize"
				value={pageSize}
				disabled={loading}
				aria-label={t("obsPageSizeLabel")}
				onChange={(event) => { onPageSize(Number(event.target.value)); }}
			>
				{PAGE_SIZES.map((size) => <option key={size} value={size}>{t("obsPageSize").replace("{size}", String(size))}</option>)}
			</select>
			<label className="dwsd-obs-pageJump">
				<span>{t("obsPageJump")}</span>
				<input
					className="dwsd-obs-input dwsd-obs-pageJumpInput"
					type="number"
					min={1}
					max={totalPages}
					value={jump}
					onChange={(event) => { setJump(event.target.value); }}
					onKeyDown={(event) => {
						if (event.key === "Enter") applyJump();
					}}
				/>
				<span>{t("obsPageUnit")}</span>
			</label>
		</div>
	);
}

/** 只把 http(s) URL 渲染成链接。 */
function safeHref(url: string | undefined): string | undefined {
	if (url === void 0) return void 0;
	try {
		const parsed = new URL(url);
		return parsed.protocol === "http:" || parsed.protocol === "https:" ? url : void 0;
	} catch {
		return void 0;
	}
}

/** 来源预览：优先 summary，其次 snippet，截到 400 字符供阅读。 */
function previewOf(source: ObservationSource): string {
	const text = (source.summary ?? source.snippet ?? "").trim();
	const characters = [...text];
	return characters.length <= 400 ? text : `${characters.slice(0, 400).join("")}…`;
}

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
				<td className="dwsd-obs-targetCell">{targetLabelOf(t, record.target)}</td>
				<td className="dwsd-obs-queryCell">{queryOf(record.query)}</td>
				<td className="dwsd-obs-num">{durationOf(record.durationMs)}</td>
				<td className="dwsd-obs-num">{numberOf(record.sourceCount)}</td>
				<td className="dwsd-obs-num dwsd-obs-colSummary">{record.sourceCount === 0 ? "—" : numberOf(record.withSummary)}</td>
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
							<p className="dwsd-obs-detailQuery"><strong>{t("obsDetailsQuery")}:</strong> {record.query}</p>
							{record.answer !== void 0 && record.answer.length > 0
								? <pre className="dwsd-obs-answer">{record.answer}</pre>
								: <p className="dwsd-obs-hint">{t("obsAnswerEmpty")}</p>}
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
									{record.sources.map((source) => {
										const href = safeHref(source.url);
										const preview = previewOf(source);
										return (
											<li className="dwsd-obs-sourceItem" key={source.urlHash}>
												<div className="dwsd-obs-sourceHead">
													{href !== void 0
														? <a className="dwsd-obs-sourceTitle" href={href} target="_blank" rel="noopener noreferrer">{source.title ?? source.host ?? href}</a>
														: <span className="dwsd-obs-sourceTitle">{source.title ?? t("obsSourceNoTitle")}</span>}
													<span className="dwsd-obs-sourceHost">{source.host.length > 0 ? source.host : t("obsSourceNoHost")}</span>
													<span className="dwsd-obs-marks">{sourceMarks(t, source).map((mark) => <span className="dwsd-obs-mark" key={mark}>{mark}</span>)}</span>
													<span className="dwsd-obs-sourceHash">{source.urlHash}</span>
												</div>
												{preview.length > 0 ? <p className="dwsd-obs-sourceText">{preview}</p> : null}
											</li>
										);
									})}
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
	const [total, setTotal] = react.useState(0);
	const [page, setPage] = react.useState(1);
	const [pageSize, setPageSize] = react.useState(DEFAULT_PAGE_SIZE);
	const [retryToken, setRetryToken] = react.useState(0);
	const [expanded, setExpanded] = react.useState<string | null>(null);
	const [loading, setLoading] = react.useState(true);
	const [error, setError] = react.useState<string | null>(null);
	const [toast, setToast] = react.useState<string | null>(null);
	const toastTimer = react.useRef<ReturnType<typeof setTimeout> | null>(null);
	const abortRef = react.useRef<AbortController | null>(null);

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
		void (async () => {
			try {
				const result = await fetchRecords(filters, { page, limit: pageSize, status, query: appliedTerm }, controller.signal);
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
	}, [filterKey, page, props.refreshToken, retryToken]);

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
			{error !== null ? <ErrorBanner t={t} message={error} onRetry={() => { setRetryToken((current) => current + 1); }} /> : null}
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
				<button type="button" className="dwsd-obs-btn" onClick={() => { setAppliedTerm(term.trim()); }}>{t("obsApplyFilters")}</button>
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
										<th scope="col" className="dwsd-obs-num dwsd-obs-colSummary">{t("obsTableSummary")}</th>
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
						</div>
					)}
			{records.length > 0 || total > 0
				? <Pager
					t={t}
					page={page}
					pageSize={pageSize}
					total={total}
					loading={loading}
					onPage={setPage}
					onPageSize={(size) => { setPageSize(size); setPage(1); }}
				/>
				: null}
			{toast !== null ? <div className="dwsd-obs-toast" role="status">{toast}</div> : null}
		</div>
	);
}
