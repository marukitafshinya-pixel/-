import type { FastifyInstance } from "fastify";
import { q, t, 日本の今 } from "./db.js";
import { requireUser } from "./auth.js";
import { 一連で } from "./ws.js";

// 在庫商品パレット確認（Access の FS_在庫商品パレット確認。メインメニューの［在庫確認］）
// 工場の在庫（倉庫 11・13）のロットごとに、パレット 1〜25 枚目に何ケース載っているかを入れ、在庫ケースと合うかを確かめる
const 在庫 = t("ws", "TD_在庫");
const 数パレット = t("ws", "TD_在庫商品数パレット");

const n = (v: unknown) => Number(v ?? 0) || 0;
/** パレットの欄（01A〜25A） */
export const パレット欄 = Array.from({ length: 25 }, (_, i) => `${String(i + 1).padStart(2, "0")}A`);
const 合計式 = (p: string) => パレット欄.map((k) => `COALESCE(${p}."${k}", 0)`).join(" + ");

export function wsZaikoPalletRoutes(app: FastifyInstance) {
  app.addHook("preHandler", requireUser);

  // 一覧（サンプル 697 を除き、在庫があり、入庫日が今日まで）
  app.get("/api/ws/zpallet", async () =>
    q(
      `SELECT z."在庫ID", z."倉庫ID", z."倉庫名", z."商品コード", z."商品名", z."製造日"::date::text AS "製造日", z."賞味期限"::date::text AS "賞味期限",
              z."タグ", z."在庫ケース", z."在庫kg", z."訂正chk", z."入庫日"::date::text AS "入庫日", p."パレット単位", p."パレット数",
              ${パレット欄.map((k) => `p."${k}"`).join(", ")}, (${合計式("p")}) AS "A計"
       FROM ${在庫} z LEFT JOIN ${数パレット} p ON p."在庫ID" = z."在庫ID"
       WHERE z."商品コード" <> 697 AND z."在庫ケース" <> 0 AND z."入庫日" <= (now() AT TIME ZONE 'Asia/Tokyo')::date AND (z."倉庫ID" = 11 OR z."倉庫ID" = 13)
       ORDER BY z."商品コード", z."製造日", z."賞味期限", z."タグ", z."在庫ケース", z."在庫ID"`,
    ),
  );

  // 1 つの欄を直す。パレット単位を入れるとパレット数 1、パレット数を入れると 1 枚目から順に単位のケースを入れる（Access と同じ）。
  // 直したら、パレットの合計が在庫ケースと合うかを在庫の 訂正chk に入れる（Form_BeforeUpdate）
  app.post<{ Body: { 在庫ID: number; 項目: string; 値: unknown } }>("/api/ws/zpallet/save", async (req, reply) => {
    const 項目 = req.body.項目;
    if (!["パレット単位", "パレット数", ...パレット欄].includes(項目)) return reply.code(400).send({ error: "この欄は直せません" });
    return 一連で(async (c) => {
      const z = (await c.query(`SELECT "在庫ID", "在庫ケース" FROM ${在庫} WHERE "在庫ID" = $1 FOR UPDATE`, [n(req.body.在庫ID)])).rows[0];
      if (!z) return reply.code(404).send({ error: "この在庫はありません" });
      let p = (await c.query(`SELECT * FROM ${数パレット} WHERE "在庫ID" = $1 LIMIT 1`, [z.在庫ID])).rows[0];
      if (!p) {
        // はじめて入れるときに行を作る（Access は表の既定値で 0 が入る）
        await c.query(
          `INSERT INTO ${数パレット} ("在庫ID", "パレット単位", "パレット数", ${パレット欄.map((k) => `"${k}"`).join(", ")}, "入力時間")
           VALUES ($1, 0, 0, ${パレット欄.map(() => "0").join(", ")}, $2)`,
          [z.在庫ID, 日本の今().日時],
        );
        p = (await c.query(`SELECT * FROM ${数パレット} WHERE "在庫ID" = $1 LIMIT 1`, [z.在庫ID])).rows[0];
      }
      const 値 = req.body.値 === "" || req.body.値 == null ? null : Math.trunc(n(req.body.値));
      const v: Record<string, number | null> = { [項目]: 値 };
      if (項目 === "パレット単位" || 項目 === "パレット数") {
        const 単位 = 項目 === "パレット単位" ? 値 : p.パレット単位;
        const 枚 = 項目 === "パレット単位" ? 1 : n(値);
        if (項目 === "パレット単位") v.パレット数 = 1;
        // Access は 26 枚目の欄がなくて止まるので、25 枚までにする
        パレット欄.forEach((k, i) => (v[k] = i < Math.min(枚, 25) ? 単位 : 0));
      }
      const cols = Object.keys(v);
      await c.query(`UPDATE ${数パレット} SET ${cols.map((k, i) => `"${k}" = $${i + 2}`).join(", ")} WHERE "在庫ID" = $1`, [z.在庫ID, ...cols.map((k) => v[k])]);
      const 後 = (await c.query(`SELECT *, (${合計式(数パレット)}) AS "A計" FROM ${数パレット} WHERE "在庫ID" = $1 LIMIT 1`, [z.在庫ID])).rows[0];
      const 合う = n(z.在庫ケース) - n(後.A計) === 0;
      await c.query(`UPDATE ${在庫} SET "訂正chk" = $2 WHERE "在庫ID" = $1`, [z.在庫ID, 合う]);
      const 返す: Record<string, unknown> = { 訂正chk: 合う, A計: n(後.A計), パレット単位: 後.パレット単位, パレット数: 後.パレット数 };
      for (const k of パレット欄) 返す[k] = 後[k];
      return 返す;
    });
  });
}
