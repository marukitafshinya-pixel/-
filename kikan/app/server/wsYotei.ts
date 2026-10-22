import type { FastifyInstance } from "fastify";
import { pool, t, 日本の今 } from "./db.js";
import { requireUser } from "./auth.js";

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
}
