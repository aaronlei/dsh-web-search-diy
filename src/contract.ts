/**
 * GET `/api/web-search-diy/config` 的线上形状。
 *
 * Host 的端点与 Client 的解析共同引用这里，避免两侧各写一份 schema 后漂移。
 * 这些声明只是编译期类型：type-only import 在 Host 与 Client 的构建产物里都会被擦除，
 * 不引入任何运行时耦合。
 *
 * @module dsh-web-search-diy/contract
 */
import type { Protocol, Shape, Support, Template } from "./catalog.ts";

/**
 * 一个字段的校验规格。Host 用它校验保存，Client 用它选控件与即时校验；
 * 两侧共用这一份形状，字段值域不再各写一份。
 */
export type FieldSpecWire =
	| { readonly kind: "string" }
	| { readonly kind: "refName" }
	| { readonly kind: "positiveInt"; readonly max?: number }
	| { readonly kind: "boolean" }
	| { readonly kind: "enum"; readonly values: readonly string[] }
	| { readonly kind: "json" };

/** 一个 catalog 条目在配置端点上的形状。 */
export interface CatalogSnapshotEntry {
	id: string;
	kind: Shape;
	protocol: Protocol;
	vendor: string;
	support: Support;
	reason: string;
	title: string;
	docs: string;
	defaults: Record<string, unknown>;
	fields: readonly string[];
	/** 该条目每个声明字段的校验规格，与 `fields` 一一对应。 */
	specs: Readonly<Record<string, FieldSpecWire>>;
	modelLocked?: boolean;
	hints: Record<string, string>;
	templates?: readonly Template[];
}

/** 配置端点 GET 的完整响应。 */
export interface ConfigSnapshot {
	version: number;
	selection: { vendor: string; protocol: Protocol };
	/** 当前 target 已保存的桶；Client 目前不直接使用。 */
	target: unknown;
	targets: Record<string, unknown>;
	keyConfigured: boolean;
	/** 每个厂商的默认凭据链状态，供徽标使用。 */
	credentials: Record<string, boolean>;
	/** 每种搜索形态的默认落点。 */
	shapeDefaults: Partial<Record<Shape, string>>;
	catalog: CatalogSnapshotEntry[];
}
