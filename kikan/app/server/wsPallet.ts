import type { FastifyInstance } from "fastify";
import type { PoolClient } from "pg";
import { pool, t, 日本の今 } from "./db.js";
import { requireUser } from "./auth.js";
import { 一連で } from "./ws.js";

// 丸北WorkStation のパレット輸送割付（Access の AF_パレット輸送割付・C_パレット輸送積み込みデータ作成）と
// 積み込み指示書（A_パレット輸送積込確認書）。パレット輸送の便で［積込確認書印刷］を押したときに開く。
// 出荷をパレットの単位（商品マスタのパレット単位2）に分け、荷台の左（ヨコ・100cm）と右（タテ・120cm）の枠に割り当てる。
const 輸送計画 = t("ws", "TD_輸送計画");
const 出荷 = t("ws", "TD_出荷");
const 商品マスタ = t("kyotsu", "TM_商品マスタ");
const 得意先マスタ = t("kyotsu", "TM_得意先マスタ");
const 積み込み = t("ws_fe", "T_パレット輸送積み込み");
const 回送 = t("ws_fe", "T_パレット回送");

type Rec = Record<string, any>;
const n = (v: unknown) => Number(v ?? 0) || 0;
const 日付 = (v: unknown) => (v ? String(v).slice(0, 10) : null);
const 時刻 = (v: unknown) => (v ? String(v).slice(11, 16).replace(/^0/, "") : "");
export const 左の枠 = [...Array(12)].map((_, i) => `txt_L${i + 1}`);
export const 右の枠 = [...Array(10)].map((_, i) => `txt_R${i + 1}`);

/** 左右の枠の数（Access の C_パレット輸送組合せ変換：左は 枚数÷2＋1、右は残り＋1） */
export function 枠の数(枚数: number) {
  const 左 = Math.min(12, Math.trunc(枚数 / 2) + 1);
  return { 左, 右: Math.min(10, Math.max(0, 枚数 - 左 + 1)) };
}

/** パレットに分ける（Access の C_パレット輸送積み込みデータ作成。その便の分を作り直す） */
async function 積み込みを作る(c: PoolClient, 輸送ID: number) {
  await c.query(`DELETE FROM ${積み込み} WHERE "輸送ID" = $1`, [輸送ID]);
  const 積載数 = n((await c.query(`SELECT "パレット積載数" FROM ${輸送計画} WHERE "輸送ID" = $1`, [輸送ID])).rows[0]?.パレット積載数);
  const rows = (
    await c.query(
      `SELECT s.*, m."パレット単位2", m."短縮名" AS "商品短縮名" FROM ${出荷} s LEFT JOIN ${商品マスタ} m ON m."商品コード" = s."商品コード"
       WHERE m."分類ID" <> 7 AND s."輸送ID" = $1 ORDER BY s."商品積込順", s."出庫ID"`,
      [輸送ID],
    )
  ).rows;
  await c.query(`SELECT pg_advisory_xact_lock(hashtext('T_パレット輸送積み込み.ID'))`);
  let id = n((await c.query(`SELECT COALESCE(MAX("ID"), 0) + 1 AS n FROM ${積み込み}`)).rows[0].n);
  let 番 = 0;
  for (const r of rows) {
    const 単位 = n(r.パレット単位2);
    let 残り = n(r.ケース);
    while (残り > 0) {
      番++;
      const v: Rec = {
        ID: id++, 商品コード: r.商品コード, 商品名: r.商品短縮名 ?? "0", 入庫日: r.入庫日, 製造日: r.製造日, タグ: r.タグ, 出荷日: r.出荷日,
        輸送ID: r.輸送ID, 倉庫ID: r.倉庫ID, 倉庫名: r.倉庫名, パレット単位: 単位, 抽出chk: false,
        当日包装区分: !!r.入庫日 && 日付(r.入庫日) === 日付(r.出荷日) ? true : null,
        // ニチレイ大谷地（164）・1221 のパレット
        パレット区分: n(r.届け先コード) === 164 ? "N-O" : n(r.届け先コード) === 1221 ? "N-T" : "その他",
      };
      // 積載数 20・22 のときの左右（Access と同じ。今の画面では使わない）
      if (積載数 === 20 || 積載数 === 22) {
        const L = 番 >= (積載数 === 20 ? 10 : 11);
        Object.assign(v, { LR場所: L ? "L" : "R", LR場所区分: !L });
      }
      if (残り < 単位 || 単位 === 0) {
        v.ケース = 残り;
        v.半端区分 = true;
        v.積順 = 番;
      } else v.ケース = 単位;
      // 商品kg は整数の欄（Access と同じく、0.5 は偶数の方へ丸める）
      const kg = v.ケース * n(r.入数);
      const f = Math.floor(kg);
      v.商品kg = kg - f > 0.5 || (kg - f === 0.5 && f % 2 === 1) ? f + 1 : f;
      if (!v.積順) {
        v.積順 = 番;
        v.No = 番;
      }
      const keys = Object.keys(v);
      await c.query(
        `INSERT INTO ${積み込み} (${keys.map((k) => `"${k}"`).join(", ")}) VALUES (${keys.map((_, i) => `$${i + 1}`).join(", ")})`,
        keys.map((k) => v[k]),
      );
      if (単位 === 0) break;
      残り -= 単位;
    }
  }
}

async function 回送の行(c: PoolClient | typeof pool, 輸送ID: number): Promise<Rec | null> {
  return (await c.query(`SELECT * FROM ${回送} WHERE "輸送ID" = $1 ORDER BY "ID" LIMIT 1`, [輸送ID])).rows[0] ?? null;
}

/** 回送の行がなければ作る（Access は打ち込むと新しい行ができる） */
async function 回送を用意(c: PoolClient, 輸送ID: number): Promise<Rec> {
  const r = await 回送の行(c, 輸送ID);
  if (r) return r;
  await c.query(`SELECT pg_advisory_xact_lock(hashtext('T_パレット回送.ID'))`);
  const id = n((await c.query(`SELECT COALESCE(MAX("ID"), 0) + 1 AS n FROM ${回送}`)).rows[0].n);
  await c.query(`INSERT INTO ${回送} ("輸送ID", "ID") VALUES ($1, $2)`, [輸送ID, id]);
  return (await 回送の行(c, 輸送ID))!;
}

async function 画面のデータ(c: PoolClient | typeof pool, 輸送ID: number) {
  const plan = (await c.query(`SELECT "輸送ID", "出荷計画日", "運送会社名" FROM ${輸送計画} WHERE "輸送ID" = $1`, [輸送ID])).rows[0];
  const 一覧 = (
    await c.query(
      `SELECT "ID", "商品名", "製造日", "タグ", "ケース", "倉庫名" FROM ${積み込み} WHERE "輸送ID" = $1 AND "抽出chk" = false
       ORDER BY CASE WHEN "半端区分" IS NULL THEN 0 WHEN "半端区分" THEN 1 ELSE 2 END, "商品コード", "製造日", "タグ"`, // Access の並び：空・真・偽
      [輸送ID],
    )
  ).rows;
  const 件数 = n((await c.query(`SELECT COUNT("商品コード") AS n FROM ${積み込み} WHERE "輸送ID" = $1`, [輸送ID])).rows[0].n);
  return { plan, 一覧, 件数, 回送: await 回送の行(c, 輸送ID) };
}

/** 左右の長さ（Access は見えない枠も数えるので、いつも 左 1200・右 1200） */
const 左右差 = () => `左 ${12 * 100}\r\n右 ${10 * 120}`;

export function wsPalletRoutes(app: FastifyInstance) {
  app.addHook("preHandler", requireUser);

  // 運行の選択肢（今日からの、ニチレイ大谷地（164）・1221 行きの便）
  app.get("/api/ws/pallet/bins", async () =>
    (
      await pool.query(
        `SELECT s."輸送ID", p."出荷計画日", p."運送会社名", MIN(s."倉庫名") AS "出荷地", MIN(s."届け先") AS "届け先", SUM(s."パレット使用枚数") AS "パレット数"
         FROM ${出荷} s JOIN ${輸送計画} p ON p."輸送ID" = s."輸送ID"
         WHERE s."ケース" <> 0 AND s."届け先コード" IN (164, 1221) AND p."出荷計画日" >= $1::date
         GROUP BY s."輸送ID", p."出荷計画日", p."運送会社名" ORDER BY p."出荷計画日", p."運送会社名"`,
        [日本の今().日付],
      )
    ).rows,
  );

  // 運行を選んだとき：パレットに分け直して、画面のデータを返す（Access の cmb_パレット運行選択_Click）
  app.post<{ Params: { id: string } }>("/api/ws/pallet/:id/open", async (req) =>
    一連で(async (c) => {
      await 積み込みを作る(c, n(req.params.id));
      return 画面のデータ(c, n(req.params.id));
    }),
  );

  // 枠に割り当てる（Access の C_ドロップアクション）。ID を渡さないときは、枠の文字をそのまま直す
  app.post<{ Params: { id: string }; Body: { 枠: string; ID?: number; 文字?: string } }>("/api/ws/pallet/:id/slot", async (req, reply) => {
    const 枠 = req.body.枠;
    if (![...左の枠, ...右の枠].includes(枠)) return reply.code(400).send({ error: "この枠はありません。" });
    return 一連で(async (c) => {
      const 輸送ID = n(req.params.id);
      await 回送を用意(c, 輸送ID);
      let 文字 = req.body.文字 ?? "";
      if (req.body.ID) {
        const r = (await c.query(`SELECT * FROM ${積み込み} WHERE "ID" = $1 AND "輸送ID" = $2`, [n(req.body.ID), 輸送ID])).rows[0];
        if (!r) return reply.code(404).send({ error: "このパレットはありません。もう一度選んでください。" });
        const d = 日付(r.製造日);
        文字 = `${r.商品名}\r\n${d ? `${d.slice(2, 4)}/${d.slice(5, 7)}/${d.slice(8, 10)}` : ""} ${r.タグ ?? ""}\r\n${r.ケース}個`;
        await c.query(`UPDATE ${積み込み} SET "抽出chk" = true WHERE "ID" = $1`, [r.ID]);
      }
      await c.query(`UPDATE ${回送} SET "${枠}" = $2 WHERE "輸送ID" = $1`, [輸送ID, 文字 || null]);
      return 画面のデータ(c, 輸送ID);
    });
  });

  // パレット枚数（左右の枠の数が変わる）
  app.post<{ Params: { id: string }; Body: { 枚数: number } }>("/api/ws/pallet/:id/maisu", async (req) =>
    一連で(async (c) => {
      const 輸送ID = n(req.params.id);
      await 回送を用意(c, 輸送ID);
      await c.query(`UPDATE ${回送} SET "パレット枚数" = $2, "左右差" = $3 WHERE "輸送ID" = $1`, [輸送ID, n(req.body.枚数), 左右差()]);
      return 画面のデータ(c, 輸送ID);
    }),
  );

  // データクリア（Access の cmd_クリア_Click：割り当てを消して、分け直す）
  app.post<{ Params: { id: string } }>("/api/ws/pallet/:id/clear", async (req) =>
    一連で(async (c) => {
      const 輸送ID = n(req.params.id);
      await c.query(`DELETE FROM ${回送} WHERE "輸送ID" = $1`, [輸送ID]);
      await 積み込みを作る(c, 輸送ID);
      return 画面のデータ(c, 輸送ID);
    }),
  );

  // 積み込み指示書（A_パレット輸送積込確認書）と積み込み前点検表のデータ
  app.get<{ Params: { id: string } }>("/api/ws/pallet/:id/print", async (req, reply) => {
    const 輸送ID = n(req.params.id);
    const plan = (await pool.query(`SELECT * FROM ${輸送計画} WHERE "輸送ID" = $1`, [輸送ID])).rows[0];
    if (!plan) return reply.code(404).send({ error: "この便はありません" });
    const 回 = (await 回送の行(pool, 輸送ID)) ?? {};
    const 先 = (
      await pool.query(
        `SELECT MIN(s."納品日") AS "納品日", MIN(u."短縮名") AS "届け先" FROM ${出荷} s LEFT JOIN ${得意先マスタ} u ON u."短縮コード" = s."届け先コード"
         WHERE s."輸送ID" = $1 AND s."届け先コード" IN (164, 1221)`,
        [輸送ID],
      )
    ).rows[0] ?? {};
    const 明細 = (
      await pool.query(
        `SELECT "商品名", "製造日", "タグ", SUM("ケース") AS "個数", SUM("商品kg") AS "kg" FROM ${積み込み} WHERE "輸送ID" = $1
         GROUP BY "商品名", "倉庫名", "商品コード", "製造日", "タグ" ORDER BY "商品コード", "製造日", "タグ"`,
        [輸送ID],
      )
    ).rows.map((r: Rec) => ({ 商品名: r.商品名, ロット: 日付(r.製造日), 区分: r.タグ, 個数: n(r.個数), kg: n(r.kg) }));
    const 枚数 = n(回.パレット枚数) || 20;
    const 数 = 枠の数(枚数);
    const 社名 = (await pool.query(`SELECT "社名" FROM app."帳票_差出人" WHERE "区分" = '丸北北海道'`)).rows[0]?.社名 ?? "";
    return {
      社名, 印刷日時: 日本の今().日時,
      便: { 輸送ID, 出荷日: 日付(plan.出荷計画日), 集荷日: 日付(plan.集荷日), 運送会社名: plan.運送会社名, 車番: plan.車番, 開始: 時刻(plan.丸北開始時間), 終了: 時刻(plan.丸北終了時間) },
      届け先: 先.届け先 ?? "", 納品日: 日付(先.納品日),
      左: 左の枠.slice(0, 数.左).map((k) => 回[k] ?? ""), 右: 右の枠.slice(0, 数.右).map((k) => 回[k] ?? ""),
      明細,
    };
  });
}
