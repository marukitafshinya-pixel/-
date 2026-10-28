import type { FastifyInstance } from "fastify";
import type { PoolClient } from "pg";
import { q, t, 日本の今 } from "./db.js";
import { requireUser } from "./auth.js";
import { 一連で } from "./ws.js";

// 包装場管理System（Access の 包装場管理System.accdb）。
// 包装準備（FM_包装準備）：その日の入庫に、ロボット（パレタイザー）の積み付け（プログラムNo・パレット・段数など）を入れる。
const 入庫 = t("seizo", "TD_入庫");
const 出荷 = t("ws", "TD_出荷");
const ロボット設定 = t("housou", "TD_ロボットPrgNo_製造別");
const 積み付けマスタ = t("housou", "TM_ロボット積み付けマスタ");
const 商品マスタ = t("kyotsu", "TM_商品マスタ");
const 包装時間 = t("housou_fe", "TM_包装時間");

type Rec = Record<string, any>;
const n = (v: unknown) => Number(v ?? 0) || 0;
/** 整数に丸める（.5 は偶数へ。Access の CLng と同じ） */
const 偶数丸め = (v: number) => {
  const f = Math.floor(v);
  const d = v - f;
  return d > 0.5 + 1e-9 ? f + 1 : d < 0.5 - 1e-9 ? f : f % 2 === 0 ? f : f + 1;
};
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

  // ---- 包装時間登録（FM_包装時間登録：TM_包装時間 を 1 行ずつ入れる。Access に合言葉は無い） ----
  // 時刻は Access と同じく 1899/12/30 の日付付きで持つ。画面には HH:MM で出す
  const 時刻 = (v: unknown) => (v instanceof Date ? v.getTime() : Date.parse(String(v).replace(" ", "T")));
  const 時間の列 = (k: string) => `to_char("${k}", 'HH24:MI') AS "${k}"`;
  app.get<{ Querystring: { code?: string } }>("/api/housou/jikan", async (req) => {
    const code = Number(req.query.code) || 0;
    return {
      rows: await q(
        `SELECT "ID", "製造日"::date::text AS "製造日", "商品コード", "品名", "台数", "段数", "1台あたり（秒）", "包装個数", "実働時間分", "人員", "備品",
                "不凍結A", "不凍結B", "不凍結C", "不凍結D", "備考", "ケース_秒", ${時間の列("開始時間")}, ${時間の列("終了時間")}
         FROM ${包装時間} WHERE ($1::int = 0 OR "商品コード" = $1) ORDER BY "製造日" DESC NULLS LAST, "ID" DESC`,
        [code],
      ),
      商品: await q(`SELECT "商品コード" AS id, MAX("品名") AS name, COUNT(*)::int AS 件数 FROM ${包装時間} WHERE "商品コード" IS NOT NULL GROUP BY "商品コード" ORDER BY "商品コード"`),
    };
  });

  // 1 つの項目を直す。Access と同じ計算：商品コード → 品名（商品マスタ）、終了時間 → 実働時間分（開始からの分）、
  // 実働時間分 → ケース_秒（実働 ÷ 包装個数 × 60。整数）・1台あたり（秒）（実働 ÷ 台数 × 60。小数 1 けた）
  app.post<{ Body: { ID: number; 項目: string; 値: unknown } }>("/api/housou/jikan/save", async (req, reply) => {
    const 項目 = req.body.項目;
    const 数 = ["商品コード", "台数", "段数", "1台あたり（秒）", "包装個数", "実働時間分", "人員", "不凍結A", "不凍結B", "不凍結C", "不凍結D", "ケース_秒"];
    const 文字 = ["品名", "備品", "備考"];
    if (![...数, ...文字, "製造日", "開始時間", "終了時間"].includes(項目)) return reply.code(400).send({ error: "この項目は直せません" });
    let 値: unknown = req.body.値 === "" || req.body.値 === undefined ? null : req.body.値;
    if (値 !== null && 数.includes(項目)) {
      値 = Number(String(値).replace(/,/g, ""));
      if (!Number.isFinite(値 as number)) return reply.code(400).send({ error: "数を入れてください" });
    }
    if (値 !== null && 項目 === "製造日") {
      const d = String(値).replace(/\//g, "-");
      if (!/^\d{4}-\d{1,2}-\d{1,2}$/.test(d)) return reply.code(400).send({ error: "日付を入れてください（例 2026/10/28）" });
      値 = d;
    }
    if (値 !== null && (項目 === "開始時間" || 項目 === "終了時間")) {
      const m = String(値).replace(/：/g, ":").match(/^(\d{1,2}):?(\d{2})$/);
      if (!m || Number(m[1]) > 23 || Number(m[2]) > 59) return reply.code(400).send({ error: "時刻を 10:20 のように入れてください" });
      値 = `1899-12-30 ${m[1].padStart(2, "0")}:${m[2]}:00`;
    }
    return 一連で(async (c) => {
      const r = (await c.query(`SELECT * FROM ${包装時間} WHERE "ID" = $1 FOR UPDATE`, [n(req.body.ID)])).rows[0];
      if (!r) return reply.code(404).send({ error: "この行はありません" });
      const v: Rec = { [項目]: 値 };
      if (項目 === "商品コード") v.品名 = 値 === null ? r.品名 : ((await c.query(`SELECT "商品名" FROM ${商品マスタ} WHERE "商品コード" = $1 LIMIT 1`, [値])).rows[0]?.商品名 ?? r.品名);
      if (項目 === "終了時間" && 値 !== null && r.開始時間) v.実働時間分 = Math.round((時刻(値) - 時刻(r.開始時間)) / 60000);
      if (項目 === "実働時間分" && 値 !== null) {
        const 実働 = Number(値);
        // ケース秒は Access の欄が整数のため、小数 1 けたにしたあと整数に丸めて入る（.5 は偶数へ。Access の型変換と同じ）
        if (n(r.包装個数) !== 0) v.ケース_秒 = 偶数丸め(Math.round((実働 / n(r.包装個数)) * 60 * 10) / 10);
        if (n(r.台数) !== 0) v["1台あたり（秒）"] = Math.round((実働 / n(r.台数)) * 60 * 10) / 10;
      }
      const k = Object.keys(v);
      await c.query(`UPDATE ${包装時間} SET ${k.map((x, i) => `"${x}" = $${i + 2}`).join(", ")} WHERE "ID" = $1`, [r.ID, ...k.map((x) => v[x])]);
      return { ok: true };
    });
  });

  // 新しい行（ID は今までの一番大きい番号の次。製造日は今日）
  app.post<{ Body: { 商品コード?: number } }>("/api/housou/jikan/new", async (req) =>
    一連で(async (c) => {
      await c.query(`SELECT pg_advisory_xact_lock(hashtext('TM_包装時間.ID'))`);
      const id = n((await c.query(`SELECT COALESCE(MAX("ID"), 0) + 1 AS m FROM ${包装時間}`)).rows[0].m);
      const code = Number(req.body?.商品コード) || null;
      const 品名 = code ? (await c.query(`SELECT "商品名" FROM ${商品マスタ} WHERE "商品コード" = $1 LIMIT 1`, [code])).rows[0]?.商品名 ?? null : null;
      await c.query(`INSERT INTO ${包装時間} ("ID", "製造日", "商品コード", "品名", "不凍結A", "不凍結B", "不凍結C", "不凍結D") VALUES ($1, $2::date, $3, $4, 0, 0, 0, 0)`, [id, 日本の今().日付, code, 品名]);
      return { ID: id };
    }),
  );

  app.post<{ Body: { ID: number } }>("/api/housou/jikan/delete", async (req, reply) => {
    const r = await q(`DELETE FROM ${包装時間} WHERE "ID" = $1 RETURNING 1`, [n(req.body.ID)]);
    if (!r.length) return reply.code(404).send({ error: "この行はありません" });
    return { ok: true };
  });

  // 包装場管理のメニューの「生産登録状況」（Access の FS_出来高入力状況：製造日がその日の工場〈倉庫 11〉の入庫。商品 746 は除く。包装順）。
  // Access は今日に決まっていたが、Web 版はメニューの日付で出す
  app.get<{ Querystring: { date: string } }>("/api/housou/menu", async (req) =>
    !/^\d{4}-\d{2}-\d{2}$/.test(String(req.query.date ?? "")) ? [] : q(
      `SELECT "入庫ID", "包装順", "商品名", "タグ", "ケース", "ロボットPrgNo" FROM ${入庫}
       WHERE "製造日" = $1::date AND "倉庫ID" = 11 AND "商品コード" <> 746 ORDER BY "包装順", "入庫ID"`,
      [req.query.date],
    ),
  );

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
