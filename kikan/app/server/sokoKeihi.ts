import type { FastifyInstance } from "fastify";
import { q, t, 日本の今 } from "./db.js";
import { requireUser } from "./auth.js";
import { 一連で } from "./ws.js";
import { 倉庫の在庫, 次の番号, 行を足す } from "./soko.js";

// 倉庫管理System の諸経費登録（Access の F_諸経費登録・FS_諸経費登録・FS_諸経費詳細）。
// 冷蔵庫・名義・集計月ごとに TD_諸経費 を直接入れる。保管料の請求書（月末処理）で、名変料・割増料・入出庫料訂正・保管料訂正などとして足される。
const 諸経費 = t("soko", "TD_諸経費");
const 経費項目 = t("soko", "TM_経費項目マスタ");
const 得意先マスタ = t("kyotsu", "TM_得意先マスタ");

type Rec = Record<string, any>;
const n = (v: unknown) => Number(v ?? 0) || 0;

/** 直せる項目 */
const 直せる = new Set(["経費ID", "諸経費", "備考", "発生日", "在庫ID", "請求先ID", "税区分"]);

export function sokoKeihiRoutes(app: FastifyInstance) {
  app.addHook("preHandler", requireUser);

  // 冷蔵庫の一覧（在庫のある冷蔵庫。コードの頭の数字ごと）と、名義の一覧（在庫にある名義。1 は除く）、経費の項目
  app.get("/api/soko/keihi/choices", async () => ({
    倉庫: await q(
      `SELECT "倉庫ID" AS id, MIN("倉庫名") AS name FROM ${倉庫の在庫} WHERE "倉庫ID" IS NOT NULL GROUP BY "倉庫ID" ORDER BY left("倉庫ID"::text, 1), "倉庫ID"`,
    ),
    名義: await q(
      `SELECT z."入庫後名義ID" AS id, m."短縮名" AS name, COUNT(z."倉庫ID") AS "件数" FROM ${倉庫の在庫} z LEFT JOIN ${得意先マスタ} m ON m."短縮コード" = z."入庫後名義ID"
       WHERE z."入庫後名義ID" <> 1 GROUP BY z."入庫後名義ID", m."短縮名" ORDER BY z."入庫後名義ID"`,
    ),
    経費: await q(`SELECT "経費ID" AS id, "経費項目" AS name FROM ${経費項目} ORDER BY "経費ID"`),
    最初: (await q(`SELECT to_char(MIN("入庫日"), 'YYYY/MM') AS "最初", to_char(MAX("入庫日"), 'YYYY/MM') AS "最後" FROM ${倉庫の在庫}`))[0],
  }));

  // その冷蔵庫・集計月・名義の諸経費
  app.get<{ Querystring: { soko: string; tsuki: string; meigi: string } }>("/api/soko/keihi", async (req) =>
    q(
      `SELECT *, "発生日"::date::text AS "発生日", "登録日"::date::text AS "登録日" FROM ${諸経費}
       WHERE "倉庫ID" = $1 AND "集計月" = $2 AND "入庫後名義ID" = $3 ORDER BY "ID"`,
      [n(req.query.soko), String(req.query.tsuki ?? ""), n(req.query.meigi)],
    ),
  );
  // 詳細の在庫ID の選択肢（その冷蔵庫・名義の在庫）
  app.get<{ Querystring: { soko: string; meigi: string } }>("/api/soko/keihi/zaiko", async (req) =>
    q(
      `SELECT "在庫ID" AS id, "入庫No", "商品名", to_char("製造日", 'YY/MM/DD') AS "製造", to_char("賞味期限", 'YY/MM/DD') AS "賞味"
       FROM ${倉庫の在庫} WHERE "倉庫ID" = $1 AND "入庫後名義ID" = $2 ORDER BY "在庫ID" DESC`,
      [n(req.query.soko), n(req.query.meigi)],
    ),
  );

  // 新しい行（Access は金額か発生日を入れたときに 集計月・冷蔵庫・名義 を入れる）
  app.post<{ Body: { soko: number; tsuki: string; meigi: number; 項目: string; 値: unknown } }>("/api/soko/keihi/add", async (req, reply) => {
    if (!/^\d{4}\/\d{2}$/.test(req.body.tsuki ?? "")) return reply.code(400).send({ error: "集計月が正しくありません" });
    if (!直せる.has(req.body.項目)) return reply.code(400).send({ error: "この項目は直せません" });
    return 一連で(async (c) => {
      const ID = await 次の番号(c, 諸経費, "ID");
      const 倉庫名 = (await c.query(`SELECT MIN("倉庫名") AS v FROM ${倉庫の在庫} WHERE "倉庫ID" = $1`, [n(req.body.soko)])).rows[0]?.v ?? null;
      await 行を足す(c, 諸経費, {
        ID, 倉庫ID: n(req.body.soko), 倉庫名, 入庫後名義ID: n(req.body.meigi), 商品コード: 0, 在庫ID: 0, 経費ID: 0, 諸経費: 0, 登録日: 日本の今().日付,
        chk: false, 請求先ID: 0, 集計月: req.body.tsuki, 税区分: 0,
      });
      await 直す(c, ID, req.body.項目, req.body.値);
      return { ID };
    });
  });
  app.post<{ Body: { ID: number; 項目: string; 値: unknown } }>("/api/soko/keihi/save", async (req, reply) => {
    if (!直せる.has(req.body.項目)) return reply.code(400).send({ error: "この項目は直せません" });
    return 一連で(async (c) => {
      await 直す(c, n(req.body.ID), req.body.項目, req.body.値);
      return { ok: true };
    });
  });
  // 削除（詳細の画面では Access と同じく合言葉が要る。Web 版はサーバーの設定 SOKO_PASSWORD）
  app.post<{ Body: { ID: number; 合言葉?: string; 詳細?: boolean } }>("/api/soko/keihi/delete", async (req, reply) => {
    if (req.body.詳細) {
      const pass = process.env.SOKO_PASSWORD;
      if (!pass || String(req.body.合言葉 ?? "") !== pass) return reply.code(403).send({ error: "パスワードが違います。" });
    }
    await q(`DELETE FROM ${諸経費} WHERE "ID" = $1`, [n(req.body.ID)]);
    return { ok: true };
  });

  /** 1 つの項目を直す。金額（諸経費）を入れると chk（Access の登録の画面）。経費を選ぶと経費名、在庫を選ぶと入庫No、請求先を選ぶと請求先名 */
  async function 直す(c: import("pg").PoolClient, ID: number, 項目: string, 値0: unknown) {
    let 値: any = 値0 === "" ? null : 値0;
    if (["経費ID", "在庫ID", "請求先ID", "税区分"].includes(項目)) 値 = 値 === null ? 0 : Math.trunc(Number(値));
    if (項目 === "諸経費" && 値 !== null) 値 = Number(値);
    const v: Rec = { [項目]: 値 };
    if (項目 === "諸経費") v.chk = true;
    if (項目 === "経費ID") v.経費名 = (await c.query(`SELECT "経費項目" FROM ${経費項目} WHERE "経費ID" = $1`, [値])).rows[0]?.経費項目 ?? null;
    if (項目 === "在庫ID") v.入庫No = (await c.query(`SELECT "入庫No" FROM ${倉庫の在庫} WHERE "在庫ID" = $1`, [値])).rows[0]?.入庫No ?? null;
    if (項目 === "請求先ID") v.請求先 = (await c.query(`SELECT "短縮名" FROM ${得意先マスタ} WHERE "短縮コード" = $1 LIMIT 1`, [値])).rows[0]?.短縮名 ?? null;
    const k = Object.keys(v);
    await c.query(`UPDATE ${諸経費} SET ${k.map((x, i) => `"${x}" = $${i + 2}`).join(", ")} WHERE "ID" = $1`, [ID, ...k.map((x) => v[x])]);
  }
}
