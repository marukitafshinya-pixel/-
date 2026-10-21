// 見本版（ブラウザの中で動かす）のデータベース。server/db.ts の代わりに使う（vite.demo.config.ts で差し替え）
// PGlite（ブラウザの中の PostgreSQL）を 1 つ持ち、pg の pool と同じ形で使えるようにする。
import { PGlite, types } from "@electric-sql/pglite";

let db: PGlite;

/** pg と同じ値の形にする（日付・時刻は文字のまま、bigint・numeric も文字） */
const parsers = {
  [types.TIMESTAMP]: (v: string) => v,
  [types.DATE]: (v: string) => v,
  [types.INT8]: (v: string) => v,
  [types.NUMERIC]: (v: string) => v,
};

export async function はじめる(): Promise<PGlite> {
  // PGlite の中のファイル一式（pglite.data）。Artifacts では .data のファイルを置けないので、.wasm の名前で置いたものを読む
  let fsBundle: Blob | undefined;
  try {
    const r = await fetch(new URL("./assets/pglite-fs.wasm", document.baseURI));
    if (r.ok) fsBundle = await r.blob();
  } catch {
    // ないときは PGlite が自分で読む（ふつうの置き方のとき）
  }
  db = await PGlite.create({ parsers, ...(fsBundle ? { fsBundle } : {}) });
  return db;
}

type Result = { rows: any[]; rowCount: number };
async function run(sql: string, params: unknown[] = []): Promise<Result> {
  // 文の区切り（;）で複数の文を流すとき（schema.sql など）は exec
  if (!params.length && /;\s*\S/.test(sql.trim().replace(/;\s*$/, ""))) {
    const rs = await db.exec(sql);
    const last = rs[rs.length - 1];
    return { rows: last?.rows ?? [], rowCount: last?.affectedRows ?? 0 };
  }
  const r = await db.query(sql, params as any[]);
  return { rows: r.rows as any[], rowCount: r.affectedRows ?? r.rows.length };
}

// 一連の処理（BEGIN〜COMMIT）がぶつからないよう、接続は 1 つずつ順番に貸す
let 順番: Promise<void> = Promise.resolve();
const client = { query: run, release: () => {} };

export const pool = {
  query: run,
  async connect() {
    let 返す!: () => void;
    const 前 = 順番;
    順番 = new Promise<void>((r) => (返す = r));
    await 前;
    return { query: run, release: () => 返す() } as typeof client;
  },
};

export async function q<T = any>(sql: string, params: unknown[] = []): Promise<T[]> {
  return (await run(sql, params)).rows as T[];
}

export function t(schema: string, table: string): string {
  return `"${schema}"."${table}"`;
}

export function 日本の今(): { 日付: string; 日時: string } {
  const d = new Date(Date.now() + 9 * 3600 * 1000).toISOString();
  return { 日付: d.slice(0, 10), 日時: `${d.slice(0, 10).replace(/-/g, "/")} ${Number(d.slice(11, 13))}${d.slice(13, 19)}` };
}
