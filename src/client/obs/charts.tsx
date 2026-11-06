/**
 * 趋势图：成功率实线与 P95 虚线，共用时间轴；空桶断线而不是画成 0。
 *
 * 纯 SVG，无第三方图表依赖；hover 用 HTML tooltip，图表本身带 `role="img"` 与
 * 概括性 `aria-label`。
 *
 * @module dsh-web-search-diy/client/obs/charts
 */
import * as react from "react";
import type { BucketSummary } from "./types.ts";
import { durationOf, percentOf, timeOf } from "./format.ts";

/** 初始画布宽度；挂载后按容器实测宽度重算，避免固定画布在宽屏下只占左侧一段。 */
const INITIAL_WIDTH = 640;
const HEIGHT = 160;
const PAD_X = 30;
const PAD_Y = 16;

/** 一段连续点的折线路径；null 处断开。 */
function linePath(values: readonly (number | null)[], x: (index: number) => number, y: (value: number) => number): string {
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
function areaPath(values: readonly (number | null)[], x: (index: number) => number, y: (value: number) => number): string {
	const base = (HEIGHT - PAD_Y).toFixed(1);
	let path = "";
	let start: number | null = null;
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

/** 时间轴的短标签：保留日期与时分，跨天范围也能区分首尾。 */
function tickLabel(iso: string): string {
	return timeOf(iso).slice(0, 11);
}

/** The trend chart. */
export function TrendChart({ t, buckets }: { t: (key: string) => string; buckets: readonly BucketSummary[] }) {
	const [active, setActive] = react.useState<number | null>(null);
	const chartRef = react.useRef<HTMLDivElement>(null);
	const [width, setWidth] = react.useState(INITIAL_WIDTH);
	const hasData = buckets.some((bucket) => bucket.count > 0);
	/** 观察容器内容盒宽度并同步 viewBox，让折线与边框同宽。 */
	react.useEffect(() => {
		const element = chartRef.current;
		if (element === null || typeof ResizeObserver === "undefined") return;
		const observer = new ResizeObserver((entries) => {
			const entry = entries[0];
			if (entry !== void 0 && entry.contentRect.width > 0) setWidth(entry.contentRect.width);
		});
		observer.observe(element);
		return () => observer.disconnect();
	}, [hasData]);
	const canvasWidth = Math.max(320, width);
	if (!hasData) {
		return (
			<div className="dwsd-obs-chart dwsd-obs-chartEmpty" ref={chartRef}>
				<svg viewBox={`0 0 ${canvasWidth} ${HEIGHT}`} role="img" aria-label={t("obsNoData")} >
					<line x1={PAD_X} y1={HEIGHT - PAD_Y} x2={canvasWidth - PAD_X} y2={HEIGHT - PAD_Y} className="dwsd-obs-chartAxis" />
				</svg>
				<p className="dwsd-obs-hint">{t("obsNoData")}</p>
			</div>
		);
	}
	const step = buckets.length > 1 ? (canvasWidth - PAD_X * 2) / (buckets.length - 1) : 0;
	const xAt = (index: number): number => PAD_X + index * step;
	const maxP95 = Math.max(1000, ...buckets.map((bucket) => bucket.p95 ?? 0));
	const yOfRatio = (ratio: number): number => HEIGHT - PAD_Y - ratio * (HEIGHT - PAD_Y * 2);
	const yOfP95 = (ms: number): number => HEIGHT - PAD_Y - (ms / maxP95) * (HEIGHT - PAD_Y * 2);
	const maxErrors = Math.max(1, ...buckets.map((bucket) => bucket.errorCount));
	const barWidth = Math.max(1, step * 0.35);
	const errorHeight = (count: number): number => (count / maxErrors) * (HEIGHT - PAD_Y * 2) * 0.3;
	const successValues: (number | null)[] = buckets.map((bucket) => bucket.count > 0 ? bucket.successRate : null);
	const p95Values: (number | null)[] = buckets.map((bucket) => bucket.count > 0 ? bucket.p95 : null);
	const rates = successValues.filter((value): value is number => value !== null);
	const minRate = rates.length > 0 ? Math.min(...rates) : 0;
	const maxRate = rates.length > 0 ? Math.max(...rates) : 0;
	const ariaLabel = t("obsTrendAria")
		.replace("{min}", percentOf(minRate))
		.replace("{max}", percentOf(maxRate))
		.replace("{buckets}", String(buckets.length));
	const activeBucket = active !== null ? buckets[active] : void 0;
	return (
		<section className="dwsd-obs-section">
			<div className="dwsd-obs-sectionHead">
				<h3 className="dwsd-obs-sectionTitle">{t("obsTrend")}</h3>
				<span className="dwsd-obs-legend">
					<span className="dwsd-obs-legendItem"><span className="dwsd-obs-legendLine dwsd-obs-legendSuccess" aria-hidden="true" />{t("obsTrendSuccess")}</span>
					<span className="dwsd-obs-legendItem"><span className="dwsd-obs-legendLine dwsd-obs-legendP95" aria-hidden="true" />{t("obsTrendP95")}</span>
					<span className="dwsd-obs-legendItem"><span className="dwsd-obs-legendBar" aria-hidden="true" />{t("obsTrendErrors")}</span>
				</span>
			</div>
			<div className="dwsd-obs-chart" ref={chartRef}>
				<svg viewBox={`0 0 ${canvasWidth} ${HEIGHT}`} role="img" aria-label={ariaLabel} >
					<line x1={PAD_X} y1={PAD_Y} x2={canvasWidth - PAD_X} y2={PAD_Y} className="dwsd-obs-chartGrid" />
					<line x1={PAD_X} y1={(HEIGHT - PAD_Y + PAD_Y) / 2} x2={canvasWidth - PAD_X} y2={(HEIGHT - PAD_Y + PAD_Y) / 2} className="dwsd-obs-chartGrid" />
					<line x1={PAD_X} y1={HEIGHT - PAD_Y} x2={canvasWidth - PAD_X} y2={HEIGHT - PAD_Y} className="dwsd-obs-chartAxis" />
					{buckets.map((bucket, index) => bucket.errorCount > 0
						? (
							<rect
								key={`errors-${bucket.at}`}
								x={xAt(index) - barWidth / 2}
								y={HEIGHT - PAD_Y - errorHeight(bucket.errorCount)}
								width={barWidth}
								height={errorHeight(bucket.errorCount)}
								className="dwsd-obs-chartErrors"
							/>
						)
						: null)}
					<path d={areaPath(successValues, xAt, yOfRatio)} className="dwsd-obs-chartArea" />
					<path d={linePath(successValues, xAt, yOfRatio)} className="dwsd-obs-chartSuccess" />
					<path d={linePath(p95Values, xAt, yOfP95)} className="dwsd-obs-chartP95" />
					{buckets.map((bucket, index) => bucket.count > 0 && bucket.successRate !== null
						? <circle key={`dot-${bucket.at}`} cx={xAt(index)} cy={yOfRatio(bucket.successRate)} r={2.5} className="dwsd-obs-chartDot" />
						: null)}
					{buckets.map((bucket, index) => (
						<rect
							key={bucket.at}
							x={Math.max(0, xAt(index) - step / 2)}
							y={0}
							width={Math.max(step, 1)}
							height={HEIGHT}
							className="dwsd-obs-chartHit"
							onMouseEnter={() => { setActive(index); }}
							onMouseLeave={() => { setActive(null); }}
						/>
					))}
				</svg>
				<div className="dwsd-obs-chartTicks">
					<span>{tickLabel(buckets[0].at)}</span>
					<span>{tickLabel(buckets[buckets.length - 1].at)}</span>
				</div>
				{activeBucket !== void 0 ? (
					<div className="dwsd-obs-chartTip" role="status">
						<span>{timeOf(activeBucket.at)}</span>
						<span>{t("obsMetricSuccess")}: {percentOf(activeBucket.successRate)}</span>
						<span>{t("obsTrendP95")}: {activeBucket.p95 === null ? "—" : durationOf(activeBucket.p95)}</span>
						<span>{t("obsTrendErrors")}: {activeBucket.errorCount}</span>
						<span>{t("obsMetricCount")}: {activeBucket.count}</span>
					</div>
				) : null}
			</div>
		</section>
	);
}
