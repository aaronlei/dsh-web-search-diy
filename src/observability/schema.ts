/**
 * 观测数据库：打开连接、PRAGMA、schema 迁移与保留策略。
 *
 * 使用 Node 内置 `node:sqlite`（22.13 起无需 flag），不引入第三方原生依赖。
 * 打开或迁移失败由调用方降级为「观测禁用」，搜索本身不受影响。
 *
 * @module dsh-web-search-diy/observability/schema
 */
import { chmodSync, existsSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { homedir } from "node:os";
import type { DatabaseLike } from "./types.ts";

/** 当前 schema 版本；写入 `PRAGMA user_version`。 */
export const SCHEMA_VERSION = 1;

/** 保留窗口：180 天。 */
export const RETENTION_DAYS = 180;

/** 保留条数上限：50,000 条。 */
export const RETENTION_ROWS = 50_000;

/** 数据库相对 `$DSH_HOME` 的位置。 */
const DATABASE_SUBDIR = "web-search-diy";
const DATABASE_FILE = "observations.db";

/** 观测库的绝对路径；`DSH_HOME` 显式为空串时回落到 `~/.dsh`。 */
export function observationDatabasePath(): string {
	const home = process.env.DSH_HOME?.trim();
	const root = home !== void 0 && home.length > 0 ? home : join(homedir(), ".dsh");
	return join(root, DATABASE_SUBDIR, DATABASE_FILE);
}

/** v1 表结构；索引覆盖时间、target 与 kind 三类查询。 */
const SCHEMA_V1 = `
CREATE TABLE IF NOT EXISTS observations (
  id            TEXT PRIMARY KEY,
  at            TEXT NOT NULL,
  kind          TEXT NOT NULL,
  session_id    TEXT,
  target        TEXT NOT NULL,
  vendor        TEXT NOT NULL,
  protocol      TEXT NOT NULL,
  query         TEXT NOT NULL,
  ok            INTEGER NOT NULL,
  error_code    TEXT,
  error_message TEXT,
  duration_ms   INTEGER NOT NULL,
  source_count  INTEGER NOT NULL,
  with_title    INTEGER NOT NULL,
  with_snippet  INTEGER NOT NULL,
  with_summary  INTEGER NOT NULL,
  summary_chars INTEGER NOT NULL,
  answer_chars  INTEGER NOT NULL,
  truncated     INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_obs_at        ON observations(at DESC);
CREATE INDEX IF NOT EXISTS idx_obs_target_at ON observations(target, at DESC);
CREATE INDEX IF NOT EXISTS idx_obs_kind_at   ON observations(kind, at DESC);

CREATE TABLE IF NOT EXISTS observation_sources (
  observation_id TEXT NOT NULL REFERENCES observations(id) ON DELETE CASCADE,
  url_hash       TEXT NOT NULL,
  host           TEXT NOT NULL,
  has_title      INTEGER NOT NULL,
  has_snippet    INTEGER NOT NULL,
  has_summary    INTEGER NOT NULL,
  PRIMARY KEY (observation_id, url_hash)
);
CREATE INDEX IF NOT EXISTS idx_sources_hash ON observation_sources(url_hash);
`;

/** 读取当前 schema 版本。 */
function readUserVersion(db: DatabaseLike): number {
	try {
		const row = db.prepare("PRAGMA user_version").get() as { user_version?: unknown } | undefined;
		return typeof row?.user_version === "number" ? row.user_version : 0;
	} catch {
		return 0;
	}
}

/**
 * 按版本顺序迁移；事务保证失败时不留半套表。
 *
 * @param db - 已打开的数据库连接。
 */
export function migrate(db: DatabaseLike): void {
	const version = readUserVersion(db);
	if (version >= SCHEMA_VERSION) return;
	db.exec("BEGIN IMMEDIATE");
	try {
		if (version < 1) db.exec(SCHEMA_V1);
		db.exec(`PRAGMA user_version = ${SCHEMA_VERSION}`);
		db.exec("COMMIT");
	} catch (error) {
		try {
			db.exec("ROLLBACK");
		} catch {
			// 连接可能已损坏；保留原始失败原因。
		}
		throw error;
	}
}

/**
 * 清理超出保留窗口或条数上限的记录；启动时执行一次，不自动 VACUUM。
 *
 * @param db - 已迁移的数据库连接。
 * @param now - 当前时间（毫秒），便于测试注入。
 * @returns 删除的观测条数。
 */
export function retain(db: DatabaseLike, now: number = Date.now()): number {
	const cutoff = new Date(now - RETENTION_DAYS * 24 * 60 * 60 * 1000).toISOString();
	const expired = db.prepare("DELETE FROM observations WHERE at < ?").run(cutoff);
	const overflow = db.prepare("DELETE FROM observations WHERE id NOT IN (SELECT id FROM observations ORDER BY at DESC LIMIT ?)").run(RETENTION_ROWS);
	return Number(expired.changes) + Number(overflow.changes);
}

/** 把数据库与 WAL 伴生文件收紧到 0600；失败不影响功能。 */
function modeOfDb(path: string): void {
	for (const file of [path, `${path}-wal`, `${path}-shm`]) {
		if (!existsSync(file)) continue;
		try {
			chmodSync(file, 0o600);
		} catch {
			// Windows 或只读挂载没有 POSIX 权限；忽略。
		}
	}
}

/** 打开数据库连接并应用 PRAGMA；`node:sqlite` 不可用时抛错。 */
function openDatabase(path: string): DatabaseLike {
	const sqlite = process.getBuiltinModule("node:sqlite") as typeof import("node:sqlite") | undefined;
	if (sqlite === void 0) throw new Error("node:sqlite is unavailable in this Node.js build");
	return new sqlite.DatabaseSync(path) as unknown as DatabaseLike;
}

/**
 * 打开并初始化观测库。
 *
 * @param path - 数据库路径；默认见 {@link observationDatabasePath}。
 * @returns 已迁移且已执行保留策略的连接。
 * @throws 目录不可写、数据库损坏或 `node:sqlite` 不可用时。
 */
export function openObservationDatabase(path: string = observationDatabasePath()): DatabaseLike {
	mkdirSync(dirname(path), { recursive: true, mode: 0o700 });
	try {
		chmodSync(dirname(path), 0o700);
	} catch {
		// Best effort: existing directories may be owned by another user.
	}
	const db = openDatabase(path);
	try {
		db.exec("PRAGMA journal_mode = WAL");
		db.exec("PRAGMA synchronous = NORMAL");
		db.exec("PRAGMA busy_timeout = 1000");
		db.exec("PRAGMA foreign_keys = ON");
		migrate(db);
		retain(db);
	} catch (error) {
		try {
			db.close();
		} catch {
			// 保留原始打开失败原因。
		}
		throw error;
	}
	modeOfDb(path);
	return db;
}
