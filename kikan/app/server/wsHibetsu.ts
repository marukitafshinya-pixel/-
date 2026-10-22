import type { FastifyInstance } from "fastify";
import { pool, t, 日本の今 } from "./db.js";
import { requireUser } from "./auth.js";
import { 一連で } from "./ws.js";

// 日別の在庫（ws.TD_在庫日別集計）を見る画面と、過去の日の作り直し。
// 控えは［日時更新］［登録］［登録前に戻す］のたびに書く（wsKoshin.ts の 在庫の控え）。
// 作り直しは、今の在庫から「その日より後に登録した出荷」と「その日より後の在庫の訂正（廃棄など）」を足し戻して出す。
// 出荷の表の残っている最初の日から作り直せる（WorkStation は 2026/01/05、倉庫管理は 2025/01/06 から）。
// ws＝WorkStation の在庫、soko＝倉庫管理の在庫（外の冷蔵庫）。倉庫管理のほうは読むだけ
const システム = [
  { 名前: "ws", 在庫: t("ws", "TD_在庫"), 出荷: t("ws", "TD_出荷"), 在庫変更: t("ws", "TD_在庫変更") },
  { 名前: "soko", 在庫: t("soko", "TD_在庫"), 出荷: t("soko", "TD_出荷"), 在庫変更: t("soko", "TD_在庫変更") },
];
const 日別集計 = t("ws", "TD_在庫日別集計");
const 得意先マスタ = t("kyotsu", "TM_得意先マスタ");
const 商品マスタ = t("kyotsu", "TM_商品マスタ");
const 作り直しの印 = "作り直し";

type Rec = Record<string, any>;
const n = (v: unknown) => Number(v ?? 0) || 0;
const 日付 = (v: unknown) => (v ? String(v instanceof Date ? v.toISOString() : v).slice(0, 10) : null);
const 日を足す = (v: string, k: number) => new Date(Date.parse(v.slice(0, 10) + "T00:00:00Z") + k * 86400000).toISOString().slice(0, 10);

export function wsHibetsuRoutes(app: FastifyInstance) {
  app.addHook("preHandler", requireUser);

  // ある日の在庫：倉庫ごとの合計と、前の控えの日から入った・減った商品
  app.get<{ Querystring: { date?: string; soko?: string } }>("/api/ws/hibetsu", async (req) => {
    const 範囲 = (await pool.query(`SELECT MIN("集計日")::text AS a, MAX("集計日")::text AS b FROM ${日別集計}`)).rows[0];
    const 日 = req.query.date || 範囲?.b || 日本の今().日付;
    const 前の日 = (await pool.query(`SELECT MAX("集計日")::text AS d FROM ${日別集計} WHERE "集計日" < $1::date`, [日])).rows[0]?.d ?? null;
    const 次の日 = (await pool.query(`SELECT MIN("集計日")::text AS d FROM ${日別集計} WHERE "集計日" > $1::date`, [日])).rows[0]?.d ?? null;
    const 倉庫 = n(req.query.soko) || null;
    // パレット数は Access の Myパレット集計 と同じ：ケース ÷ 商品マスタの パレット単位1 を切り上げ（単位のない商品は数えない）。
    // 倉庫の入る量は 得意先マスタの パレット積載許容数（冷蔵庫ごとにパレットの大きさが違うので概算。2026/10/22 利用者）
    const 倉庫一覧 = (
      await pool.query(
        `SELECT a."倉庫ID", m."短縮名" AS "倉庫名", m."パレット積載許容数" AS "許容数", SUM(a."ケース") AS "ケース", SUM(a."商品kg") AS "kg",
                SUM(CASE WHEN COALESCE(s."パレット単位1", 0) > 0 THEN CEIL(a."ケース"::numeric / s."パレット単位1") ELSE 0 END) AS "パレット",
                SUM(CASE WHEN COALESCE(s."パレット単位1", 0) > 0 THEN 0 ELSE a."ケース" END) AS "単位なし",
                MAX(a."更新時間") AS "更新時間"
         FROM ${日別集計} a LEFT JOIN ${得意先マスタ} m ON m."短縮コード" = a."倉庫ID"
         LEFT JOIN LATERAL (SELECT "パレット単位1" FROM ${商品マスタ} WHERE "商品コード" = a."商品コード" LIMIT 1) s ON true
         WHERE a."集計日" = $1::date GROUP BY a."倉庫ID", m."短縮名", m."パレット積載許容数" ORDER BY SUM(a."商品kg") DESC`,
        [日],
      )
    ).rows.map((r: Rec) => {
      const 許容数 = n(r.許容数);
      const パレット = n(r.パレット);
      return {
        ...r, ケース: n(r.ケース), kg: Number(r.kg ?? 0), パレット, 単位なし: n(r.単位なし), 許容数: 許容数 || null,
        空き: 許容数 ? 許容数 - パレット : null, 使用率: 許容数 ? Math.round((パレット / 許容数) * 1000) / 10 : null,
      };
    });
    // 入庫日ごとの差を足して、商品ごとに「入った」「減った」を出す（同じ日に入って出た分も分かるように）
    const 動き = (
      await pool.query(
        `WITH a AS (SELECT "システム", "入庫日", "倉庫ID", "商品コード", "ケース", "商品kg" FROM ${日別集計} WHERE "集計日" = $1::date),
              b AS (SELECT "システム", "入庫日", "倉庫ID", "商品コード", "ケース", "商品kg" FROM ${日別集計} WHERE "集計日" = $2::date),
              d AS (SELECT COALESCE(a."倉庫ID", b."倉庫ID") AS "倉庫ID", COALESCE(a."商品コード", b."商品コード") AS "商品コード",
                           COALESCE(b."ケース", 0) AS "前", COALESCE(a."ケース", 0) AS "今", COALESCE(a."商品kg", 0) AS "kg"
                    FROM a FULL JOIN b ON a."システム" = b."システム" AND a."入庫日" IS NOT DISTINCT FROM b."入庫日" AND a."倉庫ID" = b."倉庫ID" AND a."商品コード" = b."商品コード")
         SELECT d."倉庫ID", w."短縮名" AS "倉庫名", d."商品コード", s."商品名", s."規格",
                SUM(d."前") AS "前", SUM(GREATEST(d."今" - d."前", 0)) AS "入った", SUM(GREATEST(d."前" - d."今", 0)) AS "減った",
                SUM(d."今") AS "ケース", SUM(d."kg") AS "kg"
         FROM d LEFT JOIN ${得意先マスタ} w ON w."短縮コード" = d."倉庫ID" LEFT JOIN ${商品マスタ} s ON s."商品コード" = d."商品コード"
         WHERE ($3::int IS NULL OR d."倉庫ID" = $3)
         GROUP BY d."倉庫ID", w."短縮名", d."商品コード", s."商品名", s."規格"
         HAVING SUM(GREATEST(d."今" - d."前", 0)) <> 0 OR SUM(GREATEST(d."前" - d."今", 0)) <> 0
         ORDER BY d."倉庫ID", d."商品コード"`,
        [日, 前の日 ?? "1900-01-01", 倉庫],
      )
    ).rows.map((r: Rec) => ({ ...r, 前: n(r.前), 入った: n(r.入った), 減った: n(r.減った), ケース: n(r.ケース), kg: Number(r.kg ?? 0) }));
    return { 日付: 日, 前の日, 次の日, 最初: 範囲?.a ?? null, 最後: 範囲?.b ?? null, 倉庫一覧, 動き };
  });

  // 過去の日を作り直す（出荷の残っている最初の日から昨日まで）。ボタンで書いた控えのある日はそのまま。
  // 1 つの倉庫の埋まり具合の移り変わり（控えのある日ごと）
  app.get<{ Querystring: { soko: string } }>("/api/ws/hibetsu/suii", async (req) => {
    const 倉庫ID = n(req.query.soko);
    const m = (await pool.query(`SELECT "短縮名", "パレット積載許容数" FROM ${得意先マスタ} WHERE "短縮コード" = $1 LIMIT 1`, [倉庫ID])).rows[0];
    const 許容数 = n(m?.パレット積載許容数) || null;
    const 日ごと = (
      await pool.query(
        `SELECT a."集計日"::text AS "日付", SUM(a."ケース") AS "ケース",
                SUM(CASE WHEN COALESCE(s."パレット単位1", 0) > 0 THEN CEIL(a."ケース"::numeric / s."パレット単位1") ELSE 0 END) AS "パレット"
         FROM ${日別集計} a LEFT JOIN LATERAL (SELECT "パレット単位1" FROM ${商品マスタ} WHERE "商品コード" = a."商品コード" LIMIT 1) s ON true
         WHERE a."倉庫ID" = $1 GROUP BY a."集計日" ORDER BY a."集計日"`,
        [倉庫ID],
      )
    ).rows;
    // その倉庫に在庫がなかった日も 0 として並べる
    const ある = new Map(日ごと.map((r: Rec) => [r.日付, r]));
    const 全部の日 = (await pool.query(`SELECT DISTINCT "集計日"::text AS d FROM ${日別集計} ORDER BY 1`)).rows.map((r: Rec) => r.d as string);
    const 最初 = 日ごと[0]?.日付;
    const 列 = 全部の日
      .filter((d) => 最初 && d >= 最初)
      .map((d) => {
        const r = ある.get(d);
        const パレット = n(r?.パレット);
        return { 日付: d, ケース: n(r?.ケース), パレット, 使用率: 許容数 ? Math.round((パレット / 許容数) * 1000) / 10 : null };
      });
    return { 倉庫ID, 倉庫名: m?.短縮名 ?? "", 許容数, 日ごと: 列 };
  });

  app.post("/api/ws/hibetsu/rebuild", async () =>
    一連で(async (c) => {
      await c.query(`SELECT pg_advisory_xact_lock(hashtext('在庫更新'))`);
      const 昨日 = 日を足す(日本の今().日付, -1);
      const 控えのある日 = new Set(
        (await c.query(`SELECT DISTINCT "集計日"::text AS d FROM ${日別集計} WHERE "更新時間" IS DISTINCT FROM $1`, [作り直しの印])).rows.map((r: Rec) => r.d),
      );
      await c.query(`DELETE FROM ${日別集計} WHERE "更新時間" = $1`, [作り直しの印]);
      const 日の集合 = new Set<string>();
      let 行数 = 0;
      let 全体の最初: string | null = null;
      for (const sys of システム) {
        const 最初 = 日付((await c.query(`SELECT MIN("出荷日") AS d FROM ${sys.出荷}`)).rows[0]?.d);
        if (!最初 || 最初 > 昨日) continue;
        if (!全体の最初 || 最初 < 全体の最初) 全体の最初 = 最初;
        // 今の在庫の行と、その行から後で引いた分（登録した出荷・在庫の訂正）
        const 行 = (await c.query(`SELECT "在庫ID", "入庫日"::date::text AS "入庫日", "倉庫ID", "商品コード", "在庫ケース", "入数" FROM ${sys.在庫}`)).rows;
        const 引いた = new Map<number, { 日: string; k: number }[]>();
        const 足す = (id: number, 日: string | null, k: number) => {
          if (!日 || !k) return;
          const a = 引いた.get(id) ?? [];
          a.push({ 日, k });
          引いた.set(id, a);
        };
        for (const s of (await c.query(`SELECT "在庫ID", "出荷日"::date::text AS d, SUM("ケース") AS k FROM ${sys.出荷} WHERE "chk" = true AND "在庫ID" <> 0 GROUP BY 1, 2`)).rows)
          足す(n(s.在庫ID), s.d, n(s.k));
        for (const h of (await c.query(`SELECT "在庫No", "変更日"::date::text AS d, SUM("ケース") AS k FROM ${sys.在庫変更} WHERE "変更日" >= $1::date GROUP BY 1, 2`, [最初])).rows)
          足す(n(h.在庫No), h.d, n(h.k));
        for (let 日 = 最初; 日 <= 昨日; 日 = 日を足す(日, 1)) {
          if (控えのある日.has(日)) continue;
          日の集合.add(日);
          const まとめ = new Map<string, { 入庫日: string | null; 倉庫ID: number; 商品コード: number; ケース: number; kg: number }>();
          for (const z of 行) {
            if (!z.入庫日 || z.入庫日 > 日) continue;
            let k = n(z.在庫ケース);
            for (const e of 引いた.get(n(z.在庫ID)) ?? []) if (e.日 > 日) k += e.k;
            if (k === 0) continue;
            const key = `${z.入庫日}|${n(z.倉庫ID)}|${n(z.商品コード)}`;
            const g = まとめ.get(key) ?? { 入庫日: z.入庫日, 倉庫ID: n(z.倉庫ID), 商品コード: n(z.商品コード), ケース: 0, kg: 0 };
            g.ケース += k;
            g.kg += k * Number(z.入数 ?? 0);
            まとめ.set(key, g);
          }
          const v = [...まとめ.values()];
          if (v.length) {
            await c.query(
              `INSERT INTO ${日別集計} ("集計日","システム","入庫日","倉庫ID","商品コード","ケース","商品kg","更新時間")
               SELECT $1::date, $3, x.a::date, x.b, x.c, x.d, x.e, $2 FROM unnest($4::text[], $5::int[], $6::int[], $7::int[], $8::float8[]) AS x(a, b, c, d, e)`,
              [日, 作り直しの印, sys.名前, v.map((g) => g.入庫日), v.map((g) => g.倉庫ID), v.map((g) => g.商品コード), v.map((g) => g.ケース), v.map((g) => Math.round(g.kg * 1000) / 1000)],
            );
          }
          行数 += v.length;
        }
      }
      const 日数 = 日の集合.size;
      const 最初 = 全体の最初;
      if (!日数) return { 日数: 0, 行数: 0, 最初: null, 最後: null };
      return { 日数, 行数, 最初, 最後: 昨日 };
    }),
  );
}
