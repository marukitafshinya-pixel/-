import type { FastifyInstance } from "fastify";
import type { PoolClient } from "pg";
import { pool, q, t, 日本の今 } from "./db.js";
import { requireUser } from "./auth.js";
import { 一連で } from "./ws.js";

// 在庫検査結果登録（Access の FM_在庫検査結果登録）と サンプル登録（FM_サンプル登録）
const 在庫 = t("ws", "TD_在庫");
const 出荷 = t("ws", "TD_出荷");
const 入庫 = t("seizo", "TD_入庫");
const 商品区分 = t("ws_fe", "TM_商品区分");
const 合否判定 = t("ws_fe", "TM_合否判定");
const 商品マスタ = t("kyotsu", "TM_商品マスタ");
const 得意先マスタ = t("kyotsu", "TM_得意先マスタ");
const サンプルの商品 = 697;

type Rec = Record<string, any>;
const n = (v: unknown) => Number(v ?? 0) || 0;
const 何日前 = (k: number) => new Date(Date.now() + 9 * 3600 * 1000 - k * 86400000).toISOString().slice(0, 10);

/** 在庫の変更を、まだ積込確認していない出荷に知らせる（Access の ZaikoPlanChange）。知らせた件数を返す */
export async function 出荷に知らせる(c: PoolClient, 在庫ID: number): Promise<number> {
  const r = await c.query(
    `UPDATE ${出荷} SET "在庫ID" = $1, "認識ID" = $1::text, "通知" = '訂正', "計画変更chk" = true, "変更通知" = '数量訂正' WHERE "chk" = false AND "在庫ID" = $1`,
    [在庫ID],
  );
  return r.rowCount ?? 0;
}

/**
 * 検査結果を出荷に写す（Access の C_商品区分反映）。確定なら出荷の商品区分を 0（製品）、そうでなければ在庫の商品区分にする。
 * そのあと仕掛在庫にも写す（C_検査結果反映_仕掛）。仕掛在庫の表（仕掛原料管理）がまだ移っていないときは何もしない（Access もエラーを無視している）
 */
async function 商品区分反映(c: PoolClient, 在庫ID: number, 確定 = false) {
  await c.query(
    `UPDATE ${出荷} SET "商品区分" = ${確定 ? "0" : `(SELECT "商品区分" FROM ${在庫} WHERE "在庫ID" = $1 LIMIT 1)`} WHERE "在庫ID" = $1`,
    [在庫ID],
  );
  const 仕掛 = (await c.query(`SELECT to_regclass('shikake."TD_入庫"') IS NOT NULL AS ok`)).rows[0].ok;
  if (!仕掛) return;
  await c.query("SAVEPOINT shikake");
  try {
    await c.query(
      `UPDATE shikake."TD_入庫" s SET "商品区分" = z."商品区分"
       FROM ${在庫} z JOIN ${商品マスタ} zm ON zm."商品コード" = z."商品コード", ${商品マスタ} sm
       WHERE z."在庫ID" = $1 AND sm."商品コード" = s."商品コード" AND sm."グループ商品コード" = zm."グループ商品コード"
         AND s."製造日" = z."製造日" AND s."タグ" = z."タグ"`,
      [在庫ID],
    );
    await c.query("RELEASE SAVEPOINT shikake");
  } catch {
    await c.query("ROLLBACK TO SAVEPOINT shikake");
  }
}

/**
 * 製造側の入庫の検査結果を在庫に写す（Access の C_検査内容反映。画面を開くたびに動く）。
 * 検査予定日が 30 日以内の入庫ごとに、同じ入庫ID で、まだ検査結果のない、製造日が 30 日以内の在庫（最初の 1 行）に、検査予定日・合否を写す。
 * 合格（〇）なら商品区分を製品にして、出荷にも写す
 */
async function 検査内容反映(c: PoolClient) {
  const 境 = 何日前(30);
  const 入庫の行 = (await c.query(`SELECT "入庫ID", "検査予定日", "合否判定ID", "合否判定" FROM ${入庫} WHERE "検査予定日" > $1::date ORDER BY "入庫ID"`, [境])).rows;
  for (const i of 入庫の行) {
    const z = (
      await c.query(`SELECT "在庫ID" FROM ${在庫} WHERE "検査結果" = 0 AND "製造日" >= $1::date AND "入庫ID" = $2 ORDER BY "在庫ID" LIMIT 1`, [境, i.入庫ID])
    ).rows[0];
    if (!z) continue;
    // Access は在庫を書き込む前に出荷・仕掛在庫へ写すので、仕掛在庫には書き込む前の商品区分が入る
    if (i.合否判定ID === 1) await 商品区分反映(c, z.在庫ID, true);
    await c.query(
      `UPDATE ${在庫} SET "検査予定日" = $2, "検査結果" = $3, "合否判定ID" = $3, "合否判定" = $4${i.合否判定ID === 1 ? `, "商品区分" = 0` : ""} WHERE "在庫ID" = $1`,
      [z.在庫ID, i.検査予定日, i.合否判定ID, i.合否判定],
    );
  }
}

/** 検査結果登録で直せる項目（在庫ケースは数・重さの計算が崩れるので直せない） */
const 検査で直せる = new Set(["製造日", "商品区分", "検査区分", "タグ", "検査予定日", "管理備考", "合否判定ID"]);
/** サンプル登録で直せる項目 */
const サンプルで直せる = new Set(["商品名", "製造日", "賞味期限", "在庫ケース", "入数", "抽出区分", "倉庫ID"]);

function 合言葉が合う(v: unknown) {
  const pass = process.env.JUCHU_DELETE_PASSWORD;
  return !!pass && String(v ?? "") === pass;
}

export function wsKensaRoutes(app: FastifyInstance) {
  app.addHook("preHandler", requireUser);

  // 検査結果登録の一覧。初めて開いたときは製造側の検査結果を写してから出す
  // 絞り方：mi＝合否が〇以外（はじめ）、all＝すべて、machi＝検査待ち（商品区分 1〜4）、teishi＝出荷停止（5）、day＝製造日、none＝出さない
  app.get<{ Querystring: { mode?: string; date?: string; open?: string } }>("/api/ws/kensa", async (req) =>
    一連で(async (c) => {
      if (req.query.open === "1") {
        await c.query(`SELECT pg_advisory_xact_lock(hashtext('C_検査内容反映'))`);
        await 検査内容反映(c);
      }
      const 件数 = (
        await c.query(
          `SELECT COUNT(*) FILTER (WHERE "商品区分" BETWEEN 1 AND 4)::int AS "検査待ち", COUNT(*) FILTER (WHERE "商品区分" = 5)::int AS "出荷停止" FROM ${在庫}`,
        )
      ).rows[0];
      const mode = req.query.mode ?? "mi";
      const args: unknown[] = [];
      let w = "true";
      if (mode === "mi") w = `z."合否判定ID" <> 1`;
      else if (mode === "machi") w = `z."商品区分" BETWEEN 1 AND 4`;
      else if (mode === "teishi") w = `z."商品区分" = 5`;
      else if (mode === "day") {
        args.push(req.query.date || 何日前(0));
        w = `z."製造日"::date = $1::date`;
      } else if (mode === "none") w = "false";
      const rows = (
        await c.query(
          `SELECT z."在庫ID", z."倉庫ID", z."倉庫名", z."製造日"::date::text AS "製造日", z."賞味期限"::date::text AS "賞味期限", z."商品区分", z."商品コード",
                  z."商品名", z."検査区分", z."タグ", z."検査予定日"::date::text AS "検査予定日", z."管理備考", z."在庫ケース", z."合否判定ID"
           FROM ${在庫} z
           WHERE (z."倉庫ID" = 11 OR z."倉庫ID" = 1187) AND z."製造日" > '2023-09-01' AND ${w}
           ORDER BY z."倉庫ID", z."製造日", z."商品コード", z."タグ", z."在庫ID"`,
          args,
        )
      ).rows;
      return { 件数, rows };
    }),
  );

  app.get("/api/ws/kensa/opts", async () => ({
    商品区分: await q(`SELECT "区分ID" AS "id", "区分名" AS "name" FROM ${商品区分} ORDER BY "区分ID"`),
    合否判定: await q(`SELECT "合否判定ID" AS "id", "合否判定" AS "name" FROM ${合否判定} ORDER BY "合否判定ID"`),
  }));

  // ［修正］・［出荷停止］のパスワード（保管庫詳細の［修正］と同じ）
  app.post<{ Body: { 合言葉: string } }>("/api/ws/kensa/unlock", async (req, reply) => {
    if (!process.env.JUCHU_DELETE_PASSWORD) return reply.code(400).send({ error: "合言葉がサーバーに設定されていないため、修正できません。" });
    return { ok: 合言葉が合う(req.body.合言葉) };
  });

  // 1 つの項目を直す（合否判定ID_AfterUpdate・商品区分_AfterUpdate）
  app.post<{ Body: { 合言葉: string; 在庫ID: number; 項目: string; 値: unknown } }>("/api/ws/kensa/save", async (req, reply) => {
    if (!合言葉が合う(req.body.合言葉)) return reply.code(403).send({ error: "修正できません。［修正］を押してパスワードを入れてください。" });
    const 項目 = req.body.項目;
    if (!検査で直せる.has(項目)) return reply.code(400).send({ error: "この項目は直せません" });
    return 一連で(async (c) => {
      const z = (await c.query(`SELECT "在庫ID" FROM ${在庫} WHERE "在庫ID" = $1 FOR UPDATE`, [n(req.body.在庫ID)])).rows[0];
      if (!z) return reply.code(404).send({ error: "この在庫はありません" });
      let 値 = req.body.値 === "" ? null : req.body.値;
      if (["商品区分", "合否判定ID"].includes(項目) && 値 !== null) 値 = n(値);
      const v: Rec = { [項目]: 値 };
      // 合格（〇）なら商品区分を製品にする
      if (項目 === "合否判定ID" && 値 === 1) v.商品区分 = 0;
      const cols = Object.keys(v);
      await c.query(`UPDATE ${在庫} SET ${cols.map((k, i) => `"${k}" = $${i + 2}`).join(", ")} WHERE "在庫ID" = $1`, [z.在庫ID, ...cols.map((k) => v[k])]);
      if (項目 === "合否判定ID") await 商品区分反映(c, z.在庫ID);
      const 通知 = 項目 === "商品区分" ? await 出荷に知らせる(c, z.在庫ID) : null;
      return { ok: true, 商品区分: v.商品区分 ?? null, 通知 };
    });
  });

  // ---------------- サンプル登録 ----------------

  app.get("/api/ws/sample", async () => ({
    rows: await q(
      `SELECT "在庫ID", "商品名", "製造日"::date::text AS "製造日", "賞味期限"::date::text AS "賞味期限", "在庫ケース", "入数", "在庫kg", "抽出区分", "倉庫ID", "倉庫名", "商品コード"
       FROM ${在庫} WHERE "商品コード" = ${サンプルの商品} ORDER BY "在庫ID"`,
    ),
    倉庫: await q(`SELECT "短縮コード" AS "id", "短縮名" AS "name" FROM ${得意先マスタ} WHERE "出荷元区分" = true ORDER BY "短縮コード"`),
  }));

  // 新しい行（Access の表の既定値に合わせる）
  app.post("/api/ws/sample/new", async () =>
    一連で(async (c) => {
      await c.query(`SELECT pg_advisory_xact_lock(hashtext('TD_在庫.在庫ID'))`);
      const id = n((await c.query(`SELECT COALESCE(MAX("在庫ID"), 0) + 1 AS n FROM ${在庫}`)).rows[0].n);
      const 今 = 日本の今();
      await c.query(
        `INSERT INTO ${在庫} ("在庫ID", "作成日付", "入庫日", "商品コード", "倉庫名", "入数", "在庫ケース", "在庫kg", "短縮コード", "期", "出庫回数", "サービス区分",
           "未包装kg", "抽出区分", "出荷止め区分", "グループコード", "商品区分", "入庫区分", "ストック数", "訂正chk", "買取金額", "買取単価コード", "買取chk",
           "支払区分", "検査結果", "手配元ID", "手配帳合ID", "大阪発注確認chk", "検体区分", "指定最終届け先コード", "検体取得", "パレット積載数", "合否判定ID", "登録時間")
         VALUES ($1, $2::date, $2::date, ${サンプルの商品}, '丸北北海道サンプル', 0, 0, 0, 0, 0, 0, false, 0, false, false, 0, 0, false, 0, false, 0, 0, false,
           0, 0, 0, 0, false, false, 0, false, 0, 0, $3)`,
        [id, 今.日付, 今.日時.replace(/\//g, "-")],
      );
      return { 在庫ID: id };
    }),
  );

  // 1 つの項目を直す（在庫ケース・入数を変えたら在庫kg、倉庫を変えたら倉庫名。商品コードを渡すと「【ｻﾝﾌﾟﾙ】 商品名」にする）
  app.post<{ Body: { 在庫ID: number; 項目: string; 値: unknown } }>("/api/ws/sample/save", async (req, reply) => {
    const 項目 = req.body.項目;
    if (!サンプルで直せる.has(項目) && 項目 !== "商品から") return reply.code(400).send({ error: "この項目は直せません" });
    return 一連で(async (c) => {
      const z = (await c.query(`SELECT * FROM ${在庫} WHERE "在庫ID" = $1 AND "商品コード" = ${サンプルの商品} FOR UPDATE`, [n(req.body.在庫ID)])).rows[0];
      if (!z) return reply.code(404).send({ error: "このサンプルはありません" });
      const 値 = req.body.値 === "" ? null : req.body.値;
      const v: Rec = {};
      if (項目 === "商品から") {
        const 名 = (await c.query(`SELECT "商品名" FROM ${商品マスタ} WHERE "商品コード" = $1 LIMIT 1`, [n(値)])).rows[0]?.商品名 ?? "";
        v.商品名 = `【ｻﾝﾌﾟﾙ】 ${名}`;
      } else v[項目] = 項目 === "抽出区分" ? !!値 : ["在庫ケース", "入数", "倉庫ID"].includes(項目) && 値 !== null ? n(値) : 値;
      if (項目 === "在庫ケース" || 項目 === "入数") {
        const x = { ...z, ...v };
        v.在庫kg = x.入数 == null || x.在庫ケース == null ? null : n(x.入数) * n(x.在庫ケース);
      }
      if (項目 === "倉庫ID") v.倉庫名 = (await c.query(`SELECT "短縮名" FROM ${得意先マスタ} WHERE "短縮コード" = $1 LIMIT 1`, [n(値)])).rows[0]?.短縮名 ?? null;
      const cols = Object.keys(v);
      await c.query(`UPDATE ${在庫} SET ${cols.map((k, i) => `"${k}" = $${i + 2}`).join(", ")} WHERE "在庫ID" = $1`, [z.在庫ID, ...cols.map((k) => v[k])]);
      return { ok: true, ...v };
    });
  });
}
