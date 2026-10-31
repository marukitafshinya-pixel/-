import type { FastifyInstance } from "fastify";
import { pool, t, 日本の今 } from "./db.js";
import { requireUser } from "./auth.js";
import { cint } from "./hanmori.js";

// 出荷予定明細票（Access の R_出荷予定明細票。出荷明細票の［輸送印刷］→ FSD_出荷帳票印刷 の「出荷予定(個別抽出)」）。
// 便（輸送ID）ごとに 1 枚。積順の順に、出荷元・名義・入庫先・品名・ケース・kg・賞味期限・着日・区分（タグ）・備考。
const 輸送計画 = t("ws", "TD_輸送計画");
const 出荷 = t("ws", "TD_出荷");
const 得意先マスタ = t("kyotsu", "TM_得意先マスタ");
const 差出人の表 = t("app", "帳票_差出人");

type Rec = Record<string, any>;
const n = (v: unknown) => Number(v ?? 0) || 0;
const 日付 = (v: unknown) => (v ? String(v instanceof Date ? v.toISOString() : v).slice(0, 10) : null);
/** Access の 名義短縮表示：11＝H（北海道）、150＝F（ふらの）、ほかは M（大阪） */
export const 名義の記号 = (id: unknown) => (n(id) === 11 ? "H" : n(id) === 150 ? "F" : "M");
const 一枚の行数 = 22;

export function wsYoteiRoutes(app: FastifyInstance) {
  app.addHook("preHandler", requireUser);

  app.post<{ Body: { 開始: string; 終了?: string; 輸送ID?: number; 届け先?: number } }>("/api/ws/yotei", async (req, reply) => {
    const { 開始, 輸送ID, 届け先 } = req.body ?? ({} as any);
    const 終了 = req.body?.終了 || 開始;
    if (!開始 && !輸送ID) return reply.code(400).send({ error: "出荷日を入れてください。" });
    const rows = (
      await pool.query(
        `SELECT s."輸送ID", s."出荷日", s."商品積込順", s."倉庫ID", s."倉庫名", s."入庫後名義ID", s."届け先コード", m."得意先名" AS "入庫先", s."届け先",
                s."商品コード", s."商品名", s."規格", s."ケース", s."商品kg", s."賞味期限", s."納品日", s."タグ", s."備考",
                p."運送会社名", p."車番", p."出荷計画日"
         FROM ${出荷} s JOIN ${輸送計画} p ON p."輸送ID" = s."輸送ID"
         LEFT JOIN ${得意先マスタ} m ON m."短縮コード" = s."届け先コード"
         WHERE s."届け先コード" <> 0
           AND ($3::int IS NULL OR s."輸送ID" = $3)
           AND ($3::int IS NOT NULL OR s."出荷日" BETWEEN $1::date AND $2::date)
           AND ($4::int IS NULL OR s."届け先コード" = $4)
         ORDER BY s."出荷日", s."輸送ID", s."商品積込順", s."商品コード", s."出庫ID"`,
        [開始 || null, 終了 || null, 輸送ID ?? null, 届け先 || null],
      )
    ).rows;
    const 社名 = (await pool.query(`SELECT "社名" FROM ${差出人の表} WHERE "区分" = '丸北北海道'`)).rows[0]?.社名 ?? "";
    const 便: Rec[] = [];
    for (const r of rows) {
      let b = 便.find((x) => x.輸送ID === r.輸送ID && x.出荷日 === 日付(r.出荷日));
      if (!b) 便.push((b = { 輸送ID: r.輸送ID, 出荷日: 日付(r.出荷日), 運送会社名: r.運送会社名 ?? "", 車番: r.車番 ?? "", 行: [] as Rec[], kg: 0 }));
      b.行.push({
        積順: n(r.商品積込順),
        出荷元: r.倉庫名 ?? "",
        名義: 名義の記号(r.入庫後名義ID),
        コード: r.届け先コード,
        入庫先: r.入庫先 ?? r.届け先 ?? "",
        商品コード: r.商品コード,
        商品名: r.商品名 ?? "",
        規格: r.規格 ?? "",
        ケース: n(r.ケース),
        kg: Number(r.商品kg ?? 0),
        賞味期限: 日付(r.賞味期限),
        着日: 日付(r.納品日),
        区分: r.タグ ?? "",
        備考: r.備考 ?? "",
      });
      b.kg += Number(r.商品kg ?? 0);
    }
    // 1 枚に入りきらない便は続きの紙に分ける（合計は便の合計）
    const pages: Rec[] = [];
    for (const b of 便)
      for (let i = 0; i < Math.max(1, b.行.length); i += 一枚の行数) pages.push({ ...b, 行: b.行.slice(i, i + 一枚の行数) });
    pages.forEach((p, i) => (p.No = i + 1));
    return { 社名, 作成時間: 日本の今().日時, pages };
  });

  /**
   * 出荷予定明細票ver2（丸北商品推移の R_出荷予定明細票ver2・CC_YosonNver2）。
   * 工場（倉庫 11）の在庫kg の見込み（T_日別予想kg）：今日の在庫（入庫日が今日までの在庫kg）から 60 日先まで、
   * 製造kg＝その日の入庫（まだ在庫にしていない分）の kg − その出荷kg ＋ 工場に戻る出荷（届け先 11）の kg、出荷kg＝その日の工場からのまだ登録していない出荷、
   * 在庫kg＝前の日の在庫 ＋ 製造 − 出荷（Access の整数の欄なので、それぞれ .5 は偶数へ丸める）。
   * 明細は、出荷計画日が date 以降の、まだ登録していない出荷のうち 工場から出て入庫日のあるもの と 届け先 10・11・1217・1285 のもの。滞留日数＝出荷計画日−入庫日。
   */
  app.get<{ Querystring: { date: string } }>("/api/ws/yotei2", async (req, reply) => {
    const 開始 = String(req.query.date ?? "");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(開始)) return reply.code(400).send({ error: "出荷日を入れてください。" });
    const 今日 = 日本の今().日付;
    const 入庫 = t("seizo", "TD_入庫");
    const 在庫 = t("ws", "TD_在庫");
    const 足し = async (sql: string, args: unknown[]) => Number((await pool.query(sql, args)).rows[0]?.v ?? 0);
    let 在庫kg = cint(await 足し(`SELECT SUM("在庫kg") AS v FROM ${在庫} WHERE "倉庫ID" = 11 AND "入庫日"::date <= $1::date`, [今日]));
    const 出荷の日 = new Map<string, number>(
      (
        await pool.query(
          `SELECT "出荷日"::date::text AS d, SUM("商品kg")::float8 AS kg FROM ${出荷} WHERE COALESCE("chk", false) = false AND "倉庫ID" = 11 AND "出荷日"::date >= $1::date GROUP BY 1`,
          [今日],
        )
      ).rows.map((r) => [r.d, Number(r.kg)]),
    );
    const 予想 = new Map<string, Rec>();
    for (let i = 0; i <= 60; i++) {
      const d = new Date(Date.parse(今日 + "T00:00:00Z") + i * 86400000).toISOString().slice(0, 10);
      let 製造 = cint(await 足し(`SELECT SUM("商品kg") AS v FROM ${入庫} WHERE "倉庫ID" = 11 AND COALESCE("chk", false) = false AND "入庫日"::date = $1::date`, [d]));
      製造 = cint(製造 - (await 足し(`SELECT SUM("出荷kg") AS v FROM ${入庫} WHERE "倉庫ID" = 11 AND COALESCE("chk", false) = false AND "入庫日"::date = $1::date`, [d])));
      製造 = cint(製造 + (await 足し(`SELECT SUM("商品kg") AS v FROM ${出荷} WHERE "届け先コード" = 11 AND COALESCE("chk", false) = false AND "納品日"::date = $1::date`, [d])));
      const 出 = 出荷の日.has(d) ? cint(出荷の日.get(d)!) : null;
      在庫kg = cint(在庫kg + 製造 - (出 ?? 0));
      予想.set(d, { 日付: d, 製造kg: 製造, 出荷kg: 出, 在庫kg, 繰越kg: 在庫kg - 製造 + (出 ?? 0) });
    }
    const rows = (
      await pool.query(
        `SELECT p."出荷計画日"::date::text AS "出荷計画日", s."輸送ID", p."運送会社名", p."車番", s."商品積込順", s."倉庫名", s."届け先コード", s."届け先", s."入庫後名義ID",
                s."商品コード", s."商品名", s."規格", s."ケース", s."商品kg", s."製造日"::date::text AS "製造日", s."入庫日"::date::text AS "入庫日", s."タグ",
                (p."出荷計画日"::date - s."入庫日"::date) AS "滞留日数"
         FROM ${輸送計画} p JOIN ${出荷} s ON s."輸送ID" = p."輸送ID"
         WHERE s."届け先コード" <> 0 AND COALESCE(s."chk", false) = false AND p."出荷計画日"::date >= $1::date
           AND ((s."入庫日" IS NOT NULL AND s."倉庫ID" = 11) OR s."届け先コード" IN (10, 11, 1217, 1285))
         ORDER BY p."出荷計画日", s."輸送ID", s."商品積込順", s."商品コード", s."出庫ID"`,
        [開始],
      )
    ).rows;
    // 見込みのある日（今日から 60 日）だけを出す（Access は見込みの表から結ぶので、それより先の日は出ない）
    const 日: Rec[] = [];
    for (const r of rows) {
      const y = 予想.get(r.出荷計画日);
      if (!y) continue;
      let g = 日.find((x) => x.日付 === r.出荷計画日);
      if (!g) 日.push((g = { ...y, 便: [] as Rec[] }));
      let b = g.便.find((x: Rec) => x.輸送ID === r.輸送ID);
      if (!b) g.便.push((b = { 輸送ID: r.輸送ID, 運送会社名: r.運送会社名 ?? "", 車番: r.車番 ?? "", 行: [] as Rec[] }));
      b.行.push({
        積順: n(r.商品積込順), 出荷元: r.倉庫名 ?? "", 届け先: r.届け先 ?? "", 名義: 名義の記号(r.入庫後名義ID), 商品コード: r.商品コード, 商品名: r.商品名 ?? "",
        規格: r.規格 ?? "", ケース: n(r.ケース), kg: Number(r.商品kg ?? 0), 製造日: r.製造日, 区分: r.タグ ?? "", 滞留日数: r.滞留日数 === null ? null : n(r.滞留日数),
      });
    }
    const 社名 = (await pool.query(`SELECT "社名" FROM ${差出人の表} WHERE "区分" = '丸北北海道'`)).rows[0]?.社名 ?? "";
    return { 社名, 作成時間: 日本の今().日時, 開始, 日 };
  });
}
