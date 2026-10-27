/**
 * Field controls: text, combo, enumerated choice, switch, one-shot picker and
 * the write-only credential input. Presentational only — state lives in the page.
 */
import * as react from "react";
import type {
	ChoiceFieldProps,
	ComboFieldProps,
	SecretFieldProps,
	SelectFieldProps,
	SwitchFieldProps,
	ValueFieldProps
} from "./types.ts";

/** One settings field: label, control, hint. */
export function ValueField(props: ValueFieldProps) {
	return (
		<div className="dwsd-field">
			<div className="dwsd-head">
				<label className="dwsd-label" htmlFor={props.id}>{props.label}</label>
			</div>
			<input
				id={props.id}
				className={props.invalid ? "dwsd-input dwsd-inputInvalid" : "dwsd-input"}
				type="text"
				{...(props.numeric === true ? { inputMode: "numeric" } : {})}
				{...(props.invalid ? { "aria-invalid": true } : {})}
				value={props.text}
				placeholder={props.placeholder ?? ""}
				spellCheck={false}
				autoComplete="off"
				disabled={props.disabled}
				onChange={(event) => {
					props.onEdit(event.target.value);
				}}
			/>
			<p className={props.invalid ? "dwsd-invalid" : "dwsd-hint"}>{props.invalid ? props.invalidLabel : props.hint}</p>
		</div>
	);
}
/** A write-only credential control. */
export function SecretField(props: SecretFieldProps) {
	return (
		<div className="dwsd-field">
			<div className="dwsd-head">
				<label className="dwsd-label" htmlFor={props.id}>{props.label}</label>
				<span className="dwsd-badges">
					<span className={props.configured ? "dwsd-badge" : "dwsd-badgeMuted"}>{props.stateLabel}</span>
				</span>
			</div>
			<input
				id={props.id}
				className="dwsd-input"
				type="password"
				autoComplete="off"
				value={props.text}
				disabled={props.disabled}
				onChange={(event) => {
					props.onEdit(event.target.value);
				}}
			/>
			<p className="dwsd-hint">{props.hint}</p>
		</div>
	);
}
/**
 * A text field with an explicit dropdown: the button always lists every candidate
 * (datalist filters by the current text, which makes a prefilled field look like it
 * has one option), while the input still accepts free text.
 */
export function ComboField(props: ComboFieldProps) {
	const [open, setOpen] = react.useState(false);
	return (
		<div className="dwsd-field">
			<div className="dwsd-head">
				<label className="dwsd-label" htmlFor={props.id}>{props.label}</label>
			</div>
			<div className="dwsd-combo">
				<input
					id={props.id}
					className="dwsd-input"
					type="text"
					value={props.text}
					placeholder={props.placeholder ?? ""}
					spellCheck={false}
					autoComplete="off"
					onChange={(event) => {
						const next = event.target.value;
						props.onEdit(next);
						/** 清空时展开候选，正常输入时收起，避免遮挡。 */
						setOpen(next === "");
					}}
					onKeyDown={() => {
						setOpen(false);
					}}
					onBlur={() => {
						setOpen(false);
					}}
				/>
				<button
					type="button"
					className="dwsd-comboToggle"
					onMouseDown={(event) => {
						event.preventDefault();
					}}
					aria-label={props.label}
					aria-expanded={open}
					onClick={() => {
						setOpen(!open);
					}}
				>
					▾
				</button>
				{open ? (
					<ul className="dwsd-comboList">
						{props.options.map((option) => (
							<li key={option}>
								<button
									type="button"
									onMouseDown={(event) => {
										event.preventDefault();
									}}
									onClick={() => {
										props.onEdit(option);
										setOpen(false);
									}}
								>
									{option}
								</button>
							</li>
						))}
					</ul>
				) : null}
			</div>
			<p className="dwsd-hint">{props.hint}</p>
		</div>
	);
}
/** An enumerated-choice control. */
export function ChoiceField(props: ChoiceFieldProps) {
	return (
		<div className="dwsd-field">
			<div className="dwsd-head">
				<span className="dwsd-label">{props.label}</span>
			</div>
			<div className="dwsd-choices" role="radiogroup" aria-label={props.label}>
				{props.options.map((option) => (
					<label className={option.disabled === true ? "dwsd-choice dwsd-choiceDisabled" : "dwsd-choice"} key={option.value}>
						<input
							id={`${props.id}-${option.value === "" ? "empty" : option.value}`}
							type="radio"
							name={props.id}
							value={option.value}
							checked={props.value === option.value}
							disabled={props.disabled === true || option.disabled === true}
							onChange={() => {
								props.onEdit(option.value);
							}}
						/>
						<span className="dwsd-choiceLabel">{option.label}</span>
					</label>
				))}
			</div>
			<p className="dwsd-hint">{props.hint}</p>
		</div>
	);
}
/** A one-shot action picker: the selection applies and resets to the placeholder. */
export function SelectField(props: SelectFieldProps) {
	return (
		<div className="dwsd-field">
			<div className="dwsd-head">
				<label className="dwsd-label" htmlFor={props.id}>{props.label}</label>
			</div>
			<select
				id={props.id}
				className="dwsd-input"
				value={props.value}
				onChange={(event) => {
					props.onChange(event.target.value);
				}}
			>
				<option value="" disabled>{props.placeholder}</option>
				{props.options.map((option) => (
					<option key={option.value} value={option.value}>{option.label}</option>
				))}
			</select>
			<p className="dwsd-hint">{props.hint}</p>
		</div>
	);
}
/** A boolean control shaped like the official toggle switch. */
export function SwitchField(props: SwitchFieldProps) {
	return (
		<div className="dwsd-field">
			<div className="dwsd-switchRow">
				<span className="dwsd-label">{props.label}</span>
				<button
					type="button"
					role="switch"
					aria-checked={props.checked}
					className={props.checked ? "dwsd-switch dwsd-switchOn" : "dwsd-switch"}
					disabled={props.disabled}
					onClick={() => {
						props.onEdit(!props.checked);
					}}
				>
					<span className="dwsd-thumb" />
				</button>
			</div>
			<p className="dwsd-hint">{props.hint}</p>
		</div>
	);
}
