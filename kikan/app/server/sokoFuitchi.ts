import type { FastifyInstance } from "fastify";
import { q, t, 日本の今 } from "./db.js";
import { requireUser } from "./auth.js";
import { 一連で } from "./ws.js";
import { 倉庫の在庫, 入庫待ち, 倉庫のUSER } from "./soko.js";
import { 入庫を比べる } from "./sokoHokan.js";

// 倉庫管理System の入庫訂正データ（Access の FSD_不一致入庫データ(インポート)・Q_不一致入庫データ(インポート)）。
// 不一致の印のあるロットを、もとの入庫待ち（ケースが 0 でないもの）と並べて見る。入庫待ちの 納品日・ケース・名義 を直せる。
const 得意先マスタ = t("kyotsu", "TM_得意先マスタ");

type Rec = Record<string, any>;
const n = (v: unknown) => Number(v ?? 0) || 0;

export function sokoFuitchiRoutes(app: FastifyInstance) {
  app.addHook("preHandler", requireUser);

  app.get("/api/soko/fuitchi", async () =>
    q(
      `SELECT z."在庫ID", z."倉庫ID", z."倉庫名", z."商品コード", z."商品名", z."入数", z."入庫日"::date::text AS "入庫日", z."入庫No", z."入庫元数", z."在庫ケース",
              z."製造日"::date::text AS "製造日", z."賞味期限"::date::text AS "在庫の賞味期限", z."入庫後名義ID" AS "在庫の名義", z."不一致備考", z."出庫ID",
              i.ctid::text AS "鍵", i."出荷日"::date::text AS "出荷日", i."ケース", i."商品kg", i."納品日"::date::text AS "納品日", i."賞味期限"::date::text AS "賞味期限",
              i."入庫後名義ID", m."短縮名" AS "名義名"
       FROM ${入庫待ち} i JOIN ${倉庫の在庫} z ON z."出庫ID" = i."出庫ID"
         LEFT JOIN ${得意先マスタ} m ON m."短縮コード" = i."入庫後名義ID"
       WHERE i."ケース" <> 0 AND z."不一致フラグ" = true
       ORDER BY z."倉庫ID", z."入庫日", z."在庫ID"`,
    ),
  );

  // 入庫待ちの 納品日・ケース（商品kg＝ケース×入数）・名義 を直す。
  // Access はこのあと訂正の履歴と在庫を直す処理（MakeErrorList）を呼ぶが、その中で入庫待ちに無い項目（届け先コード）を読んでエラーになり、
  // 履歴も在庫も書かれない。Web 版も入庫待ちだけを直す。
  app.post<{ Body: { 鍵: string; 項目: string; 値: unknown; 入数?: number } }>("/api/soko/fuitchi/save", async (req, reply) => {
    const 項目 = req.body.項目;
    if (!["納品日", "ケース", "入庫後名義ID"].includes(項目)) return reply.code(400).send({ error: "この項目は直せません" });
    let 値: any = req.body.値 === "" ? null : req.body.値;
    if ((項目 === "ケース" || 項目 === "入庫後名義ID") && 値 !== null) 値 = Math.trunc(Number(値));
    const v: Rec = { [項目]: 値 };
    if (項目 === "ケース") v.商品kg = 値 === null ? null : 値 * n(req.body.入数);
    const k = Object.keys(v);
    const r = await q(`UPDATE ${入庫待ち} SET ${k.map((x, i) => `"${x}" = $${i + 2}`).join(", ")} WHERE ctid = $1::tid RETURNING 1`, [req.body.鍵, ...k.map((x) => v[x])]);
    if (!r.length) return reply.code(404).send({ error: "この入庫データはもうありません。読み直してください。" });
    return { ok: true };
  });

  // ［在庫へ］のあとの入庫チェック（C_入庫チェック）をし直す
  app.post("/api/soko/fuitchi/check", async () =>
    一連で(async (c) => {
      const 期間 = n((await c.query(`SELECT "チェック期間" FROM ${倉庫のUSER} LIMIT 1`)).rows[0]?.チェック期間);
      await 入庫を比べる(c, 期間, 日本の今().日付);
      return { ok: true };
    }),
  );
}
