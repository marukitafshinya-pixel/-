import pg from "pg";

// 日付・時刻は文字列のまま受け取る（タイムゾーンでずれないように）
pg.types.setTypeParser(1114, (v) => v); // timestamp
pg.types.setTypeParser(1082, (v) => v); // date

export const pool = new pg.Pool({
  connectionString: process.env.PGURL ?? "postgresql://postgres@/kikan?host=/tmp",
});

export async function q<T = any>(sql: string, params: unknown[] = []): Promise<T[]> {
  const r = await pool.query(sql, params);
  return r.rows as T[];
}

/** Access と同じ名前の表を指す（例：t("juchu", "TD_受注") → "juchu"."TD_受注"） */
export function t(schema: string, table: string): string {
  return `"${schema}"."${table}"`;
}

/** 日本の日時（サーバーの時計が世界標準時でもずれないように） */
export function 日本の今(): { 日付: string; 日時: string } {
  const d = new Date(Date.now() + 9 * 3600 * 1000).toISOString();
  // 時刻は Access の Now() と同じく、時の頭に 0 を付けない（例：2026/10/09 9:02:01）
  return { 日付: d.slice(0, 10), 日時: `${d.slice(0, 10).replace(/-/g, "/")} ${Number(d.slice(11, 13))}${d.slice(13, 19)}` };
}
