/**
 * 时间范围选择器：预设 + 起止日期月历。
 *
 * 查询范围与导入范围共用本组件，但各自持有独立的值。第一次点日期选起点，第二次点
 * 日期选终点并收起；也可用「至今」只保留起点。月份与星期交给浏览器区域设置格式化，
 * 不新增语言键。
 *
 * @module dsh-web-search-diy/client/obs/calendar
 */
import * as react from "react";
import type { RangePreset, TimeRange } from "./types.ts";
import { dayKeyOf, rangeLabelOf, rangeOfDays, RANGE_PRESETS, startOfDay } from "./range.ts";

/** 一周从周一开始，固定 6 行以保持面板高度稳定。 */
const WEEK_DAYS = 7;
const CELL_COUNT = 42;

/** 星期缩写，按浏览器区域设置生成；2024-01-01 是周一。 */
const WEEKDAY_LABELS: readonly string[] = Array.from(
	{ length: WEEK_DAYS },
	(_, index) => new Intl.DateTimeFormat(undefined, { weekday: "narrow" }).format(new Date(2024, 0, 1 + index))
);

/** 月份标题。 */
function monthTitleOf(date: Date): string {
	return new Intl.DateTimeFormat(undefined, { year: "numeric", month: "long" }).format(date);
}

/** 日期的可访问名称。 */
function dayTitleOf(date: Date): string {
	return new Intl.DateTimeFormat(undefined, { dateStyle: "long" }).format(date);
}

/** 某月的第一天。 */
function firstOfMonth(date: Date): Date {
	return new Date(date.getFullYear(), date.getMonth(), 1);
}

/** 有效日期或当前时间；自定义值损坏时不至于把日历渲染成 NaN。 */
function safeDate(value: string | Date): Date {
	const date = value instanceof Date ? value : new Date(value);
	return Number.isNaN(date.getTime()) ? new Date() : date;
}

/** 6×7 的日期格，包含相邻月份的日期。 */
function cellsOf(cursor: Date): readonly { readonly date: Date; readonly inMonth: boolean }[] {
	const first = firstOfMonth(cursor);
	const offset = (first.getDay() + 6) % WEEK_DAYS;
	return Array.from({ length: CELL_COUNT }, (_, index) => {
		const date = new Date(first.getFullYear(), first.getMonth(), 1 - offset + index);
		return { date, inMonth: date.getMonth() === first.getMonth() };
	});
}

/** 选择器属性。 */
export interface RangePickerProps {
	/** 字段标签，例如「时间范围」。 */
	readonly label: string;
	/** 当前值。 */
	readonly value: TimeRange;
	/** 值变更回调。 */
	readonly onChange: (next: TimeRange) => void;
	/** 文案查找。 */
	readonly t: (key: string) => string;
	/** 预设按钮；默认与查询范围共用同一组。 */
	readonly presets?: readonly RangePreset[];
	/** 额外的根节点 class，用于区分两个独立实例。 */
	readonly className?: string;
}

/** 时间范围下拉：预设快捷项 + 月历选起止日。 */
export function RangePicker({ label, value, onChange, t, presets = RANGE_PRESETS, className }: RangePickerProps) {
	const [open, setOpen] = react.useState(false);
	const [cursor, setCursor] = react.useState(() => firstOfMonth(safeDate(value.preset === "custom" ? value.since : new Date())));
	/** 已点起点、等待终点的本地零点 ISO。 */
	const [pendingStart, setPendingStart] = react.useState<string | null>(null);
	const rootRef = react.useRef<HTMLDivElement | null>(null);

	/** 当前高亮区间；等待终点时只高亮起点。 */
	const boundsOf = (): { readonly start: number | null; readonly end: number | null } => {
		if (pendingStart !== null) {
			const at = startOfDay(safeDate(pendingStart)).getTime();
			return { start: at, end: at };
		}
		if (value.preset !== "custom") return { start: null, end: null };
		const start = startOfDay(safeDate(value.since)).getTime();
		const end = value.until === void 0 ? start : startOfDay(safeDate(value.until)).getTime();
		return { start, end };
	};
	const bounds = boundsOf();

	/** 点击外部或按 Esc 关闭；测试环境没有 document 监听器时静默跳过。 */
	react.useEffect(() => {
		if (!open) return;
		if (typeof document === "undefined" || typeof document.addEventListener !== "function") return;
		const onPointerDown = (event: Event): void => {
			const root = rootRef.current;
			if (root !== null && event.target instanceof Node && !root.contains(event.target)) {
				setPendingStart(null);
				setOpen(false);
			}
		};
		const onKeyDown = (event: KeyboardEvent): void => {
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
	const toggle = (): void => {
		if (!open) {
			setPendingStart(null);
			setCursor(firstOfMonth(safeDate(value.preset === "custom" ? value.since : new Date())));
		} else {
			setPendingStart(null);
		}
		setOpen(!open);
	};

	const choosePreset = (preset: RangePreset): void => {
		setPendingStart(null);
		onChange({ preset });
		setOpen(false);
	};

	/** 第一次点起点，第二次点终点；反向选择时自动交换。 */
	const pickDay = (date: Date): void => {
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
	const chooseToday = (): void => {
		onChange(rangeOfDays(new Date(), new Date()));
		setPendingStart(null);
		setOpen(false);
	};

	/** 只保留起点：从已选起点（或当前选中范围起点）到现在。 */
	const chooseUntilNow = (): void => {
		const since = pendingStart ?? (value.preset === "custom" ? value.since : new Date().toISOString());
		onChange({ preset: "custom", since });
		setPendingStart(null);
		setOpen(false);
	};

	const shiftMonth = (delta: number): void => {
		setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + delta, 1));
	};

	const triggerText = open && pendingStart !== null ? t("obsRangePickEnd") : rangeLabelOf(t, value);
	const canChooseUntilNow = pendingStart !== null || value.preset === "custom";

	return (
		<div ref={rootRef} className={["dwsd-obs-filter", "dwsd-obs-range", className ?? ""].filter((part) => part.length > 0).join(" ")}>
			<span className="dwsd-obs-filterLabel">{label}</span>
			<button
				type="button"
				className="dwsd-obs-rangeTrigger"
				aria-haspopup="dialog"
				aria-expanded={open}
				aria-label={`${label} ${triggerText}`}
				onClick={toggle}
			>
				<span className="dwsd-obs-rangeValue">{triggerText}</span>
				<span className="dwsd-obs-rangeCaret" aria-hidden="true">▾</span>
			</button>
			{open ? (
				<div className="dwsd-obs-cal" role="dialog" aria-label={label}>
					<div className="dwsd-obs-calPresets" role="group" aria-label={label}>
						{presets.map((preset) => (
							<button
								key={preset}
								type="button"
								className={`dwsd-obs-calPreset${value.preset === preset && pendingStart === null ? " dwsd-obs-calPresetOn" : ""}`}
								aria-pressed={value.preset === preset && pendingStart === null}
								onClick={() => { choosePreset(preset); }}
							>
								{t(`obsRange_${preset}`)}
							</button>
						))}
					</div>
					<div className="dwsd-obs-calHead">
						<button type="button" className="dwsd-obs-calNav" aria-label={t("obsCalendarPrev")} onClick={() => { shiftMonth(-1); }}>‹</button>
						<span className="dwsd-obs-calTitle">{monthTitleOf(cursor)}</span>
						<button type="button" className="dwsd-obs-calNav" aria-label={t("obsCalendarNext")} onClick={() => { shiftMonth(1); }}>›</button>
					</div>
					<div className="dwsd-obs-calWeek" aria-hidden="true">
						{WEEKDAY_LABELS.map((weekday) => <span key={weekday}>{weekday}</span>)}
					</div>
					<div className="dwsd-obs-calGrid" role="group" aria-label={label}>
						{cellsOf(cursor).map(({ date, inMonth }) => {
							const day = startOfDay(date).getTime();
							const selected = bounds.start !== null && day >= bounds.start && day <= (bounds.end ?? bounds.start);
							const edge = day === bounds.start || day === (bounds.end ?? bounds.start);
							return (
								<button
									key={dayKeyOf(date)}
									type="button"
									className={[
										"dwsd-obs-calDay",
										inMonth ? "" : "dwsd-obs-calDayOut",
										selected && !edge ? "dwsd-obs-calDayInRange" : "",
										edge ? "dwsd-obs-calDayOn" : ""
									].filter((part) => part.length > 0).join(" ")}
									aria-pressed={selected}
									aria-label={dayTitleOf(date)}
									onClick={() => { pickDay(date); }}
								>
									{date.getDate()}
								</button>
							);
						})}
					</div>
					<div className="dwsd-obs-calFoot">
						<div className="dwsd-obs-calActions">
							<button type="button" className="dwsd-obs-link" onClick={chooseToday}>{t("obsRange_today")}</button>
							{canChooseUntilNow ? <button type="button" className="dwsd-obs-link" onClick={chooseUntilNow}>{t("obsRangeUntilNow")}</button> : null}
						</div>
						<span className="dwsd-obs-calHint">{pendingStart !== null ? `${t("obsRangePickEnd")} · ${dayKeyOf(pendingStart)}` : rangeLabelOf(t, value)}</span>
					</div>
				</div>
			) : null}
		</div>
	);
}
