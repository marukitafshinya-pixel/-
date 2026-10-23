import type { FastifyInstance } from "fastify";
import type { PoolClient } from "pg";
import { q, t } from "./db.js";
import { requireUser } from "./auth.js";
import { 一連で } from "./ws.js";

// 包装場管理System（Access の 包装場管理System.accdb）。
// 包装準備（FM_包装準備）：その日の入庫に、ロボット（パレタイザー）の積み付け（プログラムNo・パレット・段数など）を入れる。
const 入庫 = t("seizo", "TD_入庫");
const 出荷 = t("ws", "TD_出荷");
const ロボット設定 = t("housou", "TD_ロボットPrgNo_製造別");
const 積み付けマスタ = t("housou", "TM_ロボット積み付けマスタ");
const 商品マスタ = t("kyotsu", "TM_商品マスタ");

type Rec = Record<string, any>;
const n = (v: unknown) => Number(v ?? 0) || 0;
/** Access の My小数点計算（2：小数があれば繰り上げ） */
const 繰り上げ = (v: number) => (Number.isInteger(v) ? v : Math.trunc(v) + (v > 0 ? 1 : 0));
/** パレット輸送（ニチレイ大谷地・十勝）の届け先 */
const パレット輸送の届け先 = [164, 1221];

/** 入庫のロボット設定の行（なければ作る。Access は入庫と結んだ一覧で、設定の項目を入れると行ができる） */
async function 設定の行(c: PoolClient, 入庫ID: number): Promise<Rec> {
  const r = (await c.query(`SELECT * FROM ${ロボット設定} WHERE "入庫ID" = $1 ORDER BY "ID" LIMIT 1`, [入庫ID])).rows[0];
  if (r) return r;
  await c.query(`SELECT pg_advisory_xact_lock(hashtext('TD_ロボットPrgNo_製造別.ID'))`);
  const id = n((await c.query(`SELECT COALESCE(MAX("ID"), 0) + 1 AS m FROM ${ロボット設定}`)).rows[0].m);
  await c.query(`INSERT INTO ${ロボット設定} ("ID", "入庫ID", "積み段数", "積み付け数", "スピード", "長さ㎜", "幅㎜", "高さ㎜", "パレット枚数", "ニチレイ積載数", "ロボットPrgNo") VALUES ($1, $2, 0, 0, 0, 0, 0, 0, 0, 0, 0)`, [id, 入庫ID]);
  return (await c.query(`SELECT * FROM ${ロボット設定} WHERE "ID" = $1`, [id])).rows[0];
}

/** プログラムNo の積み付けマスタの値（パレット・一段積載・段数・積み付け数・スピード・大きさ） */
async function マスタの値(c: PoolClient, プログラムNo: number) {
  const m = (await c.query(`SELECT * FROM ${積み付けマスタ} WHERE "ロボットプログラムNo" = $1 LIMIT 1`, [プログラムNo])).rows[0] ?? {};
  return {
    プログラム名: m.品番 ?? null, 使用パレット: m.パレット ?? null, 一段積載: m.一段積載 ?? null, 積み段数: m.段数 ?? null, 積み付け数: m.積み付け数 ?? null,
    スピード: m.スピード ?? null, "長さ㎜": m["長さ㎜"] ?? null, "幅㎜": m["幅㎜"] ?? null, "高さ㎜": m["高さ㎜"] ?? null,
  };
}
async function 設定を直す(c: PoolClient, ID: number, v: Rec) {
  const k = Object.keys(v);
  if (k.length) await c.query(`UPDATE ${ロボット設定} SET ${k.map((x, i) => `"${x}" = $${i + 2}`).join(", ")} WHERE "ID" = $1`, [ID, ...k.map((x) => v[x])]);
}

/** その日の行（QS_入庫_ロボット設定：丸北北海道・未登録の入庫） */
async function その日の行(c: { query: PoolClient["query"] }, 入庫日: string) {
  return (
    await c.query(
      `SELECT i."入庫ID", i."入庫日"::date::text AS "入庫日", i."製造日"::date::text AS "製造日", i."商品コード", i."商品名", i."規格", i."タグ", i."ケース", i."商品kg",
              i."検査区分", i."管理備考", i."包装順", i."ロボットPrgNo", i."作業場",
              r."ID", r."パレット枚数", r."使用パレット", r."一段積載", r."積み段数", r."積み付け数", r."高さ㎜", r."長さ㎜", r."幅㎜", r."スピード", r."積み付け備考",
              r."ニチレイ積載数", r."プログラム名", m."DB品番CD"
       FROM ${入庫} i LEFT JOIN ${ロボット設定} r ON r."入庫ID" = i."入庫ID" LEFT JOIN ${商品マスタ} m ON m."商品コード" = i."商品コード"
       WHERE i."倉庫ID" = 11 AND COALESCE(i."chk", false) = false AND i."入庫日" = $1::date
       ORDER BY i."包装順", i."商品コード", i."製造日" DESC, i."タグ", i."入庫ID", i."検査区分"`,
      [入庫日],
    )
  ).rows as Rec[];
}

/**
 * パレット枚数の再計算（C_パレット枚数再計算）：パレット枚数＝ケース ÷ 積み付け数（小数は繰り上げ）。
 * パレット輸送（ニチレイ大谷地・十勝）に出す分があれば、積み付け備考と入庫の管理備考に「○ 個 (N)」を入れる。
 */
async function パレット枚数を出し直す(c: PoolClient, 入庫日: string) {
  for (const r of await その日の行(c, 入庫日)) {
    if (!r.ID) continue; // Access もロボット設定の行がない入庫は直さない（結んだ先の行がないため）
    const v: Rec = { パレット枚数: 繰り上げ(n(r.ケース) / (n(r.積み付け数) || 1)) };
    const 積載 = n(
      (await c.query(`SELECT SUM("ケース") AS v FROM ${出荷} WHERE "入庫ID" = $1 AND "届け先コード" = ANY($2::int[])`, [r.入庫ID, パレット輸送の届け先])).rows[0].v,
    );
    if (積載) {
      v.積み付け備考 = `${積載} 個 (N)`;
      await c.query(`UPDATE ${入庫} SET "管理備考" = $2 WHERE "入庫ID" = $1`, [r.入庫ID, `${積載} 個 (N)`]);
    }
    await 設定を直す(c, r.ID, v);
  }
}

export function housouRoutes(app: FastifyInstance) {
  app.addHook("preHandler", requireUser);

  app.get<{ Querystring: { date: string } }>("/api/housou/junbi", async (req) => ({
    rows: await その日の行({ query: (s: string, p: unknown[]) => q(s, p).then((rows) => ({ rows })) } as any, req.query.date),
    プログラム: await q(`SELECT "ロボットプログラムNo" AS id, "パレット", "品番", "段数", "積み付け数" FROM ${積み付けマスタ} ORDER BY "ロボットプログラムNo"`),
    パレット: (await q(`SELECT DISTINCT "パレット" AS id FROM ${積み付けマスタ} WHERE "パレット" IS NOT NULL ORDER BY 1`)).map((r) => r.id),
    積み付けパターン: (await q(`SELECT "積み付けパターン" AS id FROM ${t("housou_fe", "TM_積み付けパターン")}`).catch(() => [])).map((r) => r.id),
  }));

  // 1 つの項目を直す。ロボットPrgNo を入れたら、積み付けマスタの値を入れてパレット枚数を出す（ロボットPrgNo_AfterUpdate）
  app.post<{ Body: { 入庫ID: number; 項目: string; 値: unknown } }>("/api/housou/junbi/save", async (req, reply) => {
    const 項目 = req.body.項目;
    const 入庫の項目 = ["ロボットPrgNo", "包装順", "管理備考"];
    const 設定の項目 = ["使用パレット", "一段積載", "積み段数", "積み付け数", "スピード", "長さ㎜", "幅㎜", "高さ㎜", "パレット枚数", "積み付け備考", "ニチレイ積載数", "プログラム名"];
    if (!入庫の項目.includes(項目) && !設定の項目.includes(項目)) return reply.code(400).send({ error: "この項目は直せません" });
    return 一連で(async (c) => {
      const i = (await c.query(`SELECT * FROM ${入庫} WHERE "入庫ID" = $1 FOR UPDATE`, [n(req.body.入庫ID)])).rows[0];
      if (!i) return reply.code(404).send({ error: "この入庫はありません" });
      const 値 = req.body.値 === "" ? null : req.body.値;
      if (入庫の項目.includes(項目)) await c.query(`UPDATE ${入庫} SET "${項目}" = $2 WHERE "入庫ID" = $1`, [i.入庫ID, 値]);
      const s = await 設定の行(c, i.入庫ID);
      if (設定の項目.includes(項目)) await 設定を直す(c, s.ID, { [項目]: 値 });
      if (項目 === "ロボットPrgNo") {
        const m = await マスタの値(c, n(値));
        // Access はプログラム名をここでは入れない（自動割付のときだけ）
        const { プログラム名: _, ...v } = m;
        await 設定を直す(c, s.ID, { ...v, パレット枚数: 繰り上げ(n(i.ケース) / (n(m.積み付け数) || 1)) });
      }
      return { ok: true };
    });
  });

  // 自動割付（cmd_自動割付）：過去の設定から、パレット輸送（ニチレイ大谷地）に出すものは (N)、ほかは (大) のプログラムNo を入れる
  app.post<{ Body: { date: string } }>("/api/housou/junbi/auto", async (req) =>
    一連で(async (c) => {
      for (const r of await その日の行(c, req.body.date)) {
        const N = n((await c.query(`SELECT SUM("ケース") AS v FROM ${出荷} WHERE "届け先コード" = 164 AND "入庫ID" = $1`, [r.入庫ID])).rows[0].v) !== 0;
        // Q_過去ロボット設定：入庫と結んだロボット設定のうち、パレットが同じものの最初の行
        const p = n(
          (
            await c.query(
              `SELECT i."ロボットPrgNo" AS v FROM ${入庫} i JOIN ${ロボット設定} s ON s."入庫ID" = i."入庫ID"
               WHERE s."使用パレット" = $1 AND i."商品コード" = $2 ORDER BY s."ID" LIMIT 1`,
              [N ? "(N)" : "(大)", n(r.商品コード)],
            )
          ).rows[0]?.v,
        );
        await c.query(`UPDATE ${入庫} SET "ロボットPrgNo" = $2 WHERE "入庫ID" = $1`, [r.入庫ID, p]);
        const s = await 設定の行(c, r.入庫ID);
        const m = await マスタの値(c, p);
        if (N) {
          // パレット輸送のときは使用パレットを (N) にし、プログラムNo があるときだけマスタの値を入れる
          await 設定を直す(c, s.ID, p ? { ...m, 使用パレット: "(N)" } : { 使用パレット: "(N)" });
        } else await 設定を直す(c, s.ID, m);
      }
      await パレット枚数を出し直す(c, req.body.date);
      return { ok: true };
    }),
  );

  app.post<{ Body: { date: string } }>("/api/housou/junbi/recalc", async (req) =>
    一連で(async (c) => {
      await パレット枚数を出し直す(c, req.body.date);
      return { ok: true };
    }),
  );
}
