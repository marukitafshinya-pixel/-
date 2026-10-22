import type { FastifyInstance } from "fastify";
import type { PoolClient } from "pg";
import { pool, t, 日本の今 } from "./db.js";
import { requireUser } from "./auth.js";
import { 一連で } from "./ws.js";
import { 並びの鍵, 鍵で比べる } from "./narabi.js";

// 出荷停止在庫一覧（Access の FM_保管庫_出荷停止）。
// 開くたび・日を送るたびに、出荷停止（商品区分 5）の在庫を、その日の確認用の行（ws_fe.TD_在庫_確認）に写し、その日の行を出す（C_在庫確認用テーブル作成）。
// ［確認］の印はその日の行に付く。数が変わった行は印が外れる。
const 在庫 = t("ws", "TD_在庫");
const 確認用 = t("ws_fe", "TD_在庫_確認");
const 出荷停止 = 5;

type Rec = Record<string, any>;
const n = (v: unknown) => Number(v ?? 0) || 0;

/** Access の C_在庫確認用テーブル作成：在庫（商品区分で選ぶか、在庫ID 1 つ）を、その日の確認用の行に写す */
export async function 確認用を作る(c: PoolClient, 商品区分: number, 日: string, 在庫ID?: number) {
  const 元 = 在庫ID
    ? (await c.query(`SELECT * FROM ${在庫} WHERE "在庫ID" = $1`, [在庫ID])).rows
    : (await c.query(`SELECT * FROM ${在庫} WHERE "在庫ケース" <> 0 AND "商品区分" = $1`, [商品区分])).rows;
  for (const z of 元) {
    const 前 = (await c.query(`SELECT "chk", "在庫ケース" FROM ${確認用} WHERE "在庫ID" = $1 AND "作成日付" = $2::date LIMIT 1`, [z.在庫ID, 日])).rows[0];
    // 確認済みでも、数が変わっていたら印を外す
    const chk = 前 ? (前.chk === true && n(前.在庫ケース) !== n(z.在庫ケース) ? false : 前.chk) : false;
    // 出荷止め区分は Access では写していない（在庫の表に「出荷止め」という列がなく、写す行がエラーで飛ばされる）ので写さない
    const v: Rec = {
      倉庫ID: z.倉庫ID, 倉庫名: z.倉庫名, 商品コード: z.商品コード, 商品名: z.商品名, 規格: z.規格, 入数: z.入数, 製造日: z.製造日, 賞味期限: z.賞味期限,
      入庫日: z.入庫日, 製造ケース: z.製造ケース, 製造kg: z.製造kg, 入庫ID: z.入庫ID, chk, 入庫元数: z.入庫元数, 繰越ケース: z.繰越ケース, 繰越kg: z.繰越kg,
      出庫ケース: z.出庫ケース, 出荷kg: z.出荷kg, 在庫ケース: z.在庫ケース, 在庫kg: z.在庫kg, 管理備考: z.管理備考, 商品区分: z.商品区分, 検査区分: z.検査区分,
      タグ: z.タグ, カードカラーコード: z.カードカラーコード, 産地コード: n(z.産地コード), 製造工場ID: z.倉庫ID, 製造工場名: z.倉庫名, 最終出庫日: z.最終出庫日,
      入庫後名義ID: z.入庫後名義ID, 賞味期限通知: z.賞味期限通知,
    };
    const cols = Object.keys(v);
    if (前) {
      await c.query(
        `UPDATE ${確認用} SET ${cols.map((k, i) => `"${k}" = $${i + 3}`).join(", ")} WHERE "在庫ID" = $1 AND "作成日付" = $2::date`,
        [z.在庫ID, 日, ...cols.map((k) => v[k])],
      );
    } else {
      // Access の表の既定値（数は 0、はい／いいえ は いいえ）
      const 既定: Rec = {
        短縮コード: 0, 分類ID: 0, 期: 0, 出庫回数: 0, サービス区分: false, 未包装kg: 0, 出庫ID: 0, 抽出区分: false, 出荷止め区分: false, グループコード: 0,
        変更前在庫ID: 0, 入庫区分: false, ストック数: 0, 訂正chk: false, 買取金額: 0, 買取単価コード: 0, 買取chk: false, 支払区分: 0, 検査結果: 0,
        大阪発注確認chk: false, 登録時間: 日本の今().日時.replace(/\//g, "-"),
      };
      const all: Rec = { 在庫ID: z.在庫ID, 作成日付: 日, ...既定, ...v };
      const k2 = Object.keys(all);
      await c.query(`INSERT INTO ${確認用} (${k2.map((k) => `"${k}"`).join(", ")}) VALUES (${k2.map((_, i) => `$${i + 1}`).join(", ")})`, k2.map((k) => all[k]));
    }
  }
}

export function wsTeishiRoutes(app: FastifyInstance) {
  app.addHook("preHandler", requireUser);

  // その日の確認用の行を作り直して出す
  app.get<{ Querystring: { date?: string } }>("/api/ws/teishi", async (req) =>
    一連で(async (c) => {
      const 日 = req.query.date || 日本の今().日付;
      await c.query(`SELECT pg_advisory_xact_lock(hashtext('TD_在庫_確認'))`);
      await 確認用を作る(c, 出荷停止, 日);
      const rows = (
        await c.query(
          `SELECT "在庫ID", "倉庫名", "商品コード", "商品名", "規格", "製造日"::date::text AS "製造日", "賞味期限通知", "タグ", "入庫元数",
                  "在庫ケース", "在庫kg", "chk", "管理備考", "商品区分"
           FROM ${確認用} WHERE "作成日付" = $1::date`,
          [日],
        )
      ).rows;
      rows.sort((a: Rec, b: Rec) => 鍵で比べる(並びの鍵(a.商品名 ?? ""), 並びの鍵(b.商品名 ?? "")) || String(a.製造日 ?? "").localeCompare(String(b.製造日 ?? "")) || a.在庫ID - b.在庫ID);
      return { 日付: 日, rows };
    }),
  );

  // ［確認］の印
  app.post<{ Body: { 在庫ID: number; 日付: string; 値: boolean } }>("/api/ws/teishi/chk", async (req) => {
    await pool.query(`UPDATE ${確認用} SET "chk" = $3 WHERE "在庫ID" = $1 AND "作成日付" = $2::date`, [n(req.body.在庫ID), req.body.日付, !!req.body.値]);
    return { ok: true };
  });
}
