/**
 * Types shared by the client half: staged draft values and the props of every
 * field control. Wire shapes live in `../contract.ts`.
 */
import type { CatalogSnapshotEntry, ConfigSnapshot } from "../contract.ts";

/** One staged field value. */
export type Primitive = string | boolean;
/** One target's staged bucket. */
export type TargetDraft = Record<string, Primitive>;
/** One catalog entry as served by GET /config; the wire shape lives in `../contract.ts`. */
export type CatalogEntry = CatalogSnapshotEntry;
/** The GET /config payload; the wire shape lives in `../contract.ts`. */
export type Snapshot = ConfigSnapshot;
/** Props shared by every input-shaped field. */
export interface ValueFieldProps {
	id: string;
	label: string;
	hint: string;
	text: string;
	placeholder?: string;
	numeric?: boolean;
	invalid?: boolean;
	invalidLabel?: string;
	disabled?: boolean;
	onEdit: (text: string) => void;
}
/** Props of one enumerated-choice field. */
export interface ChoiceFieldProps {
	id: string;
	label: string;
	hint: string;
	value: string;
	options: readonly { value: string; label: string; disabled?: boolean }[];
	disabled?: boolean;
	onEdit: (value: string) => void;
}
/** Props of a one-shot action picker. */
export interface SelectFieldProps {
	id: string;
	label: string;
	hint: string;
	value: string;
	placeholder: string;
	options: readonly { value: string; label: string }[];
	onChange: (value: string) => void;
}
/** Props of a text field with a suggestion list (free input allowed). */
export interface ComboFieldProps {
	id: string;
	label: string;
	hint: string;
	text: string;
	options: readonly string[];
	placeholder?: string;
	onEdit: (text: string) => void;
}
/** Props of the boolean switch field. */
export interface SwitchFieldProps {
	id: string;
	label: string;
	hint: string;
	checked: boolean;
	disabled?: boolean;
	onEdit: (checked: boolean) => void;
}
/** Props of the write-only credential field. */
export interface SecretFieldProps {
	id: string;
	label: string;
	hint: string;
	text: string;
	configured: boolean;
	stateLabel: string;
	disabled?: boolean;
	onEdit: (text: string) => void;
}
/** What the slot owner hands one view. */
export interface SlotProps {
	t: (key: string) => string;
	view: string;
}
/** The slice of the plugin context this card touches. */
export interface PluginContext {
	effect(fn: () => void, label: string): void;
	locale: {
		register(ns: string, dictionaries: { zh: Record<string, string>; en: Record<string, string> }): void;
	};
	slots: {
		inject(name: string, fn: () => void): void;
		register(options: { name: string; key: string; locale: string }, component: (props: SlotProps) => unknown): void;
	};
}
