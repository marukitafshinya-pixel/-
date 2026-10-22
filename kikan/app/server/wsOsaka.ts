import type { FastifyInstance } from "fastify";
import { pool, q, t } from "./db.js";
import { requireUser } from "./auth.js";
import { cint } from "./hanmori.js";
import { 一連で } from "./ws.js";
import { 月の表を作る, 受注の出荷を出し直す } from "./wsNenkan.js";

// 大阪 月間受注登録（Access の F_受注検索_大阪受注登録）。
// 年間受注割振りと同じ月の表（TMS_本社依頼受注_製造）のうち、大阪扱い（運賃振分区分 629）の行に、手配数量（kg）を入れる。
const 月の表 = t("ws", "TMS_本社依頼受注_製造");
const 商品マスタ = t("kyotsu", "TM_商品マスタ");
const 得意先マスタ = t("kyotsu", "TM_得意先マスタ");
const 大阪 = 629;

type Rec = Record<string, any>;
const n = (v: unknown) => Number(v ?? 0) || 0;
const 月の範囲 = (年: number, 月: number) => {
  const 開始 = `${年}-${String(月).padStart(2, "0")}-01`;
  const 末 = new Date(Date.UTC(年, 月, 0)).toISOString().slice(0, 10);
  return { 開始, 終了: 末, 年月: `${String(年).slice(2)}${String(月).padStart(2, "0")}` };
};

function 合言葉が合う(v: unknown) {
  const pass = process.env.JUCHU_DELETE_PASSWORD;
  return !!pass && String(v ?? "") === pass;
}

export function wsOsakaRoutes(app: FastifyInstance) {
  app.addHook("preHandler", requireUser);

  // 一覧。商品を選んだときは、Access と同じく先に月の表を作り直す（C_年間受注テーブル作成_製造日ベース）
  app.get<{ Querystring: { year: string; month: string; shohin?: string } }>("/api/ws/osaka", async (req, reply) => {
    const 年 = n(req.query.year);
    const 月 = n(req.query.month);
    if (!年 || 月 < 1 || 月 > 12) return reply.code(400).send({ error: "受注月を選んでください" });
    const { 開始, 終了, 年月 } = 月の範囲(年, 月);
    // 月の表の商品はグループの商品コード（年間受注割振りと同じ）
    let 商品 = n(req.query.shohin);
    if (商品) 商品 = n((await q(`SELECT "グループ商品コード" FROM ${商品マスタ} WHERE "商品コード" = $1 LIMIT 1`, [商品]))[0]?.グループ商品コード) || 商品;
    if (商品) await 一連で((c) => 月の表を作る(c, 開始, 終了, 商品));
    const rows = await q(
      `SELECT t."個別受注ID", t."大阪受注ID", t."年月", t."商品コード", t."商品名", t."届け先コード", t."届け先", t."受注元KG", t."受注元数", t."入数", t."備考", t."chk"
       FROM ${月の表} t LEFT JOIN ${商品マスタ} m ON m."商品コード" = t."商品コード"
       WHERE t."運賃振分区分" = ${大阪} AND t."年月" = $1 ${商品 ? `AND t."商品コード" = $2` : ""}
       ORDER BY t."年月", m."本社コード", t."届け先コード", t."個別受注ID"`,
      商品 ? [年月, 商品] : [年月],
    );
    const 商品名 = 商品 ? (await q(`SELECT "商品名" FROM ${商品マスタ} WHERE "商品コード" = $1 LIMIT 1`, [商品]))[0]?.商品名 ?? "" : "";
    return { 開始, 終了, 年月, 商品名, rows };
  });

  app.post<{ Body: { 合言葉: string } }>("/api/ws/osaka/unlock", async (req, reply) => {
    if (!process.env.JUCHU_DELETE_PASSWORD) return reply.code(400).send({ error: "合言葉がサーバーに設定されていないため、修正できません。" });
    return { ok: 合言葉が合う(req.body.合言葉) };
  });

  // 1 つの項目を直す（［追加の許可］のあと）
  app.post<{ Body: { 合言葉: string; 個別受注ID: number; 項目: string; 値: unknown } }>("/api/ws/osaka/save", async (req, reply) => {
    if (!合言葉が合う(req.body.合言葉)) return reply.code(403).send({ error: "直せません。［追加の許可］を押してパスワードを入れてください。" });
    const 項目 = req.body.項目;
    if (!["商品コード", "届け先コード", "受注元KG", "備考"].includes(項目)) return reply.code(400).send({ error: "この項目は直せません" });
    return 一連で(async (c) => {
      const r = (await c.query(`SELECT * FROM ${月の表} WHERE "個別受注ID" = $1 FOR UPDATE`, [n(req.body.個別受注ID)])).rows[0];
      if (!r) return reply.code(404).send({ error: "この行はありません" });
      const 値 = req.body.値 === "" || req.body.値 == null ? null : 項目 === "備考" ? String(req.body.値) : n(req.body.値);
      const v: Rec = { [項目]: 値 };
      if (項目 === "商品コード") {
        // cmb_商品コード_AfterUpdate：商品名・グループ商品コード・入数
        const m = (await c.query(`SELECT "商品名", "グループ商品コード", "入数" FROM ${商品マスタ} WHERE "商品コード" = $1 LIMIT 1`, [n(値)])).rows[0];
        Object.assign(v, { 商品名: m?.商品名 ?? null, グループ商品コード: m?.グループ商品コード ?? null, 入数: m?.入数 ?? null });
      }
      if (項目 === "届け先コード") v.届け先 = (await c.query(`SELECT "短縮名" FROM ${得意先マスタ} WHERE "短縮コード" = $1 LIMIT 1`, [n(値)])).rows[0]?.短縮名 ?? null;
      if (項目 === "受注元KG") {
        // 受注元KG_AfterUpdate：受注元数 ＝ kg ÷ 入数。前の値が 0 でなく、数が変わったら備考に書き足す（Access の書き方のまま）
        const 入数 = n(r.入数);
        v.受注元数 = 入数 ? cint(n(値) / 入数) : null;
        const 前 = n(r.受注元KG);
        if (前 !== 0 && 前 !== v.受注元数) v.備考 = `${r.備考 ?? ""} ${前}→${v.受注元数}kgに訂正`;
        // 年間受注割振りの受注数（ケース）と同じ値なので、あちらでケースを入れたときと同じく出荷済み・見込み・残も出し直す
        Object.assign(v, await 受注の出荷を出し直す(c, { ...r, 受注元数: v.受注元数 }));
      }
      const cols = Object.keys(v);
      await c.query(`UPDATE ${月の表} SET ${cols.map((k, i) => `"${k}" = $${i + 2}`).join(", ")} WHERE "個別受注ID" = $1`, [r.個別受注ID, ...cols.map((k) => v[k])]);
      return v;
    });
  });

  // 新しい行（Access の既定値：その月の集計開始日・終了日、大阪扱い、検索した商品）
  app.post<{ Body: { 合言葉: string; year: number; month: number; shohin?: number } }>("/api/ws/osaka/new", async (req, reply) => {
    if (!合言葉が合う(req.body.合言葉)) return reply.code(403).send({ error: "追加できません。［追加の許可］を押してパスワードを入れてください。" });
    const { 開始, 終了, 年月 } = 月の範囲(n(req.body.year), n(req.body.month));
    return 一連で(async (c) => {
      await c.query(`SELECT pg_advisory_xact_lock(hashtext('TMS_本社依頼受注_製造.個別受注ID'))`);
      const id = n((await c.query(`SELECT COALESCE(MAX("個別受注ID"), 0) + 1 AS n FROM ${月の表}`)).rows[0].n);
      const 商品 = n(req.body.shohin);
      const m = 商品 ? (await c.query(`SELECT "商品名", "グループ商品コード", "入数", "規格" FROM ${商品マスタ} WHERE "商品コード" = $1 LIMIT 1`, [商品])).rows[0] : null;
      const v: Rec = {
        個別受注ID: id, 年月, 集計開始日: 開始, 集計終了日: 終了, 運賃振分区分: 大阪, 運賃振分区分名: "大阪丸北",
        商品コード: 商品 || null, 商品名: m?.商品名 ?? null, グループ商品コード: m?.グループ商品コード ?? null, 入数: m?.入数 ?? null, 規格: m?.規格 ?? null,
        統一受注ID: 商品 ? `${年月}-${m?.グループ商品コード ?? 商品}` : null, chk: false, 受注元KG: 0, 受注元数: 0,
      };
      const cols = Object.keys(v);
      await c.query(`INSERT INTO ${月の表} (${cols.map((k) => `"${k}"`).join(", ")}) VALUES (${cols.map((_, i) => `$${i + 1}`).join(", ")})`, cols.map((k) => v[k]));
      return { 個別受注ID: id };
    });
  });

  // 行を消す（Access の Form_Delete：登録済み（chk）は消せない。パスワードが要る）
  app.post<{ Body: { 合言葉: string; 個別受注ID: number } }>("/api/ws/osaka/delete", async (req, reply) => {
    if (!合言葉が合う(req.body.合言葉)) return reply.code(403).send({ error: "パスワードが違います。" });
    const r = (await pool.query(`SELECT "chk" FROM ${月の表} WHERE "個別受注ID" = $1`, [n(req.body.個別受注ID)])).rows[0];
    if (!r) return reply.code(404).send({ error: "この行はありません" });
    if (r.chk) return reply.code(400).send({ error: "登録済みの為削除できません" });
    await pool.query(`DELETE FROM ${月の表} WHERE "個別受注ID" = $1`, [n(req.body.個別受注ID)]);
    return { ok: true };
  });
}
