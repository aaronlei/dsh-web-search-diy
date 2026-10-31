/**
 * 观测概览：五张指标卡、target 排行与最近记录。
 *
 * 概览展示指标卡、趋势与 target 排行，记录明细在记录页。
 *
 * @module dsh-web-search-diy/client/obs/overview
 */
import type { SummaryResponse } from "./types.ts";
import { durationOf, numberOf, percentOf, targetLabelOf } from "./format.ts";
import { TrendChart } from "./charts.tsx";
import { EmptyState, ErrorBanner, MetricCard, MetricSkeleton, TableSkeleton } from "./shared.tsx";

/** Overview props. */
export interface OverviewProps {
	readonly t: (key: string) => string;
	readonly summary: SummaryResponse | null;
	readonly loading: boolean;
	readonly error: string | null;
	/** True when a target filter is active, so an empty result explains itself. */
	readonly filtered: boolean;
	readonly onRefresh: () => void;
	readonly onOpenTarget: (target: string) => void;
	readonly onClearFilters: () => void;
}

/** The target ranking table. */
function TargetRanking({ t, summary, onOpenTarget }: { t: (key: string) => string; summary: SummaryResponse; onOpenTarget: (target: string) => void }) {
	if (summary.byTarget.length === 0) return null;
	return (
		<section className="dwsd-obs-section">
			<h3 className="dwsd-obs-sectionTitle">{t("obsTargetRanking")}</h3>
			<div className="dwsd-obs-tableWrap">
				<table className="dwsd-obs-table">
					<caption className="dwsd-obs-caption">{t("obsTargetRanking")}</caption>
					<thead>
						<tr>
							<th scope="col">{t("obsTableTarget")}</th>
							<th scope="col" className="dwsd-obs-num">{t("obsMetricCount")}</th>
							<th scope="col" className="dwsd-obs-num">{t("obsMetricSuccess")}</th>
							<th scope="col" className="dwsd-obs-num">{t("obsMetricP95")}</th>
							<th scope="col" className="dwsd-obs-num">{t("obsMetricSources")}</th>
							<th scope="col" className="dwsd-obs-num dwsd-obs-colSummary">{t("obsMetricSummary")}</th>
							<th scope="col" className="dwsd-obs-num">{t("obsTableErrors")}</th>
						</tr>
					</thead>
					<tbody>
						{summary.byTarget.map((row) => (
							<tr
								key={row.target}
								className="dwsd-obs-clickable"
								tabIndex={0}
								onClick={() => { onOpenTarget(row.target); }}
								onKeyDown={(event) => {
									if (event.key === "Enter" || event.key === " ") {
										event.preventDefault();
										onOpenTarget(row.target);
									}
								}}
							>
								<td className="dwsd-obs-targetCell">{targetLabelOf(t, row.target)}</td>
								<td className="dwsd-obs-num">{numberOf(row.count)}</td>
								<td className="dwsd-obs-num">{percentOf(row.successRate)}</td>
								<td className="dwsd-obs-num">{durationOf(row.p95)}</td>
								<td className="dwsd-obs-num">{numberOf(row.avgSources, 1)}</td>
								<td className="dwsd-obs-num dwsd-obs-colSummary">{percentOf(row.summaryCoverage)}</td>
								<td className="dwsd-obs-num">{row.errorCount > 0 ? numberOf(row.errorCount) : "—"}</td>
							</tr>
						))}
					</tbody>
				</table>
			</div>
		</section>
	);
}

/** The overview view. */
export function Overview(props: OverviewProps) {
	const { t, summary } = props;
	if (props.loading && summary === null) return <div className="dwsd-obs-view"><MetricSkeleton /><TableSkeleton rows={4} /></div>;
	return (
		<div className="dwsd-obs-view">
			{props.error !== null ? <ErrorBanner t={t} message={props.error} onRetry={props.onRefresh} /> : null}
			{summary === null
				? <EmptyState t={t} title={t("obsEmpty")} hint={t("obsEmptyHint")} />
				: (
					<div className="dwsd-obs-content">
						<div className="dwsd-obs-cards">
							<MetricCard label={t("obsMetricCount")} value={numberOf(summary.totals.count)} />
							<MetricCard label={t("obsMetricSuccess")} value={percentOf(summary.totals.successRate)} />
							<MetricCard label={t("obsMetricP95")} value={durationOf(summary.totals.p95)} />
							<MetricCard label={t("obsMetricSources")} value={numberOf(summary.totals.avgSources, 1)} />
							<MetricCard label={t("obsMetricSummary")} value={percentOf(summary.totals.summaryCoverage)} />
						</div>
						<TrendChart t={t} buckets={summary.byBucket} />
						{summary.totals.count === 0
							? props.filtered
								? <EmptyState t={t} title={t("obsEmptyFiltered")} hint={t("obsEmptyFilteredHint")} actionLabel={t("obsClearFilters")} onAction={props.onClearFilters} />
								: <EmptyState t={t} title={t("obsEmpty")} hint={t("obsEmptyHint")} />
							: <TargetRanking t={t} summary={summary} onOpenTarget={props.onOpenTarget} />}
					</div>
				)}
		</div>
	);
}
