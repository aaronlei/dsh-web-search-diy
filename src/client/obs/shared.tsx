/**
 * 观测页共用的小组件：错误横幅、状态标记与骨架屏。
 *
 * @module dsh-web-search-diy/client/obs/shared
 */
/** One status cell: a dot plus text, so color is never the only signal. */
export function StatusCell({ t, ok }: { t: (key: string) => string; ok: boolean }) {
	return (
		<span className={ok ? "dwsd-obs-status" : "dwsd-obs-status dwsd-obs-statusFail"}>
			<span className={ok ? "dwsd-obs-dot dwsd-obs-dotOk" : "dwsd-obs-dot dwsd-obs-dotFail"} aria-hidden="true" />
			{t(ok ? "obsStatusOk" : "obsStatusFail")}
		</span>
	);
}

/** An endpoint failure banner that keeps already-loaded data on screen. */
export function ErrorBanner({ t, message, onRetry }: { t: (key: string) => string; message: string; onRetry: () => void }) {
	return (
		<div className="dwsd-obs-banner" role="alert">
			<span className="dwsd-obs-bannerText">{t("obsError")}: {message}</span>
			<button type="button" className="dwsd-obs-btn" onClick={onRetry}>{t("obsRetry")}</button>
		</div>
	);
}

/** A skeleton for the metric cards; no full-page spinner. */
export function MetricSkeleton() {
	return (
		<div className="dwsd-obs-cards" aria-hidden="true">
			{[0, 1, 2, 3, 4].map((index) => (
				<div className="dwsd-obs-card" key={index}>
					<span className="dwsd-obs-skeleton dwsd-obs-skeletonLabel" />
					<span className="dwsd-obs-skeleton dwsd-obs-skeletonValue" />
				</div>
			))}
		</div>
	);
}

/** One table skeleton row set. */
export function TableSkeleton({ rows = 5 }: { rows?: number }) {
	return (
		<div className="dwsd-obs-skeletonRows" aria-hidden="true">
			{Array.from({ length: rows }, (_unused, index) => <span className="dwsd-obs-skeleton dwsd-obs-skeletonRow" key={index} />)}
		</div>
	);
}

/** Shared empty state with an optional action. */
export function EmptyState({ t, title, hint, actionLabel, onAction }: {
	t: (key: string) => string;
	title: string;
	hint: string;
	actionLabel?: string;
	onAction?: () => void;
}) {
	return (
		<div className="dwsd-obs-empty">
			<span className="dwsd-obs-emptyIcon" aria-hidden="true">⌕</span>
			<p className="dwsd-obs-emptyTitle">{title}</p>
			<p className="dwsd-obs-hint">{hint}</p>
			{actionLabel !== void 0 && onAction !== void 0
				? <button type="button" className="dwsd-obs-btn" onClick={onAction}>{actionLabel}</button>
				: null}
		</div>
	);
}

/** A metric card: label above, tabular number below. */
export function MetricCard({ label, value }: { label: string; value: string }) {
	return (
		<div className="dwsd-obs-card">
			<span className="dwsd-obs-cardLabel">{label}</span>
			<span className="dwsd-obs-cardValue">{value}</span>
		</div>
	);
}
