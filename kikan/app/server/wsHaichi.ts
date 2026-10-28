import type { FastifyInstance } from "fastify";
import { pool, q, t } from "./db.js";
import { requireUser } from "./auth.js";
import { 一連で } from "./ws.js";
import { 在庫見込み } from "./wsZaiko.js";

// パレット配置図（Access の AF_パレット配置図）。工場（倉庫 11）の保管庫のどこに、どのロットのパレットを置いたかを日ごとに描く
const 配置図 = t("ws_fe", "T_パレット配置図");
const 在庫 = t("ws", "TD_在庫");
const 商品マスタ = t("kyotsu", "TM_商品マスタ");
const ロボット = t("housou", "TD_ロボットPrgNo_製造別");

type Rec = Record<string, any>;
const n = (v: unknown) => Number(v ?? 0) || 0;

/** 置き場（Access のフォームにある枠。T3〜T6 は表にはあるが画面にない） */
export const 置き場 = [
  ...[1, 2, 3, 4, 5, 6, 7].flatMap((i) => [1, 2, 3].map((j) => `L${i}-${j}`)),
  ...[1, 2, 3, 4, 5].map((i) => `CL-${i}`),
  ...[1, 2, 3, 4, 5].map((i) => `CR-${i}`),
  ...[1, 2, 3, 4, 5].map((i) => `R${i}-1`),
  "T1",
  "T2",
];
const 置き場か = (k: string) => 置き場.includes(k);

async function その日の配置(c: { query: typeof pool.query }, 日: string): Promise<Rec | null> {
  return (await c.query(`SELECT * FROM ${配置図} WHERE "入庫日"::date = $1::date ORDER BY "ID" LIMIT 1`, [日])).rows[0] ?? null;
}

export function wsHaichiRoutes(app: FastifyInstance) {
  app.addHook("preHandler", requireUser);

  // その日の配置と、その日の時点の工場の在庫（Access の CC_KakuZaikoSum(1, 0, 11, "TD_架空在庫ver3", False, 日)）
  app.get<{ Querystring: { date: string } }>("/api/ws/haichi", async (req, reply) => {
    const 日 = req.query.date;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(日 ?? "")) return reply.code(400).send({ error: "日付が正しくありません" });
    const 見込み = (await 在庫見込み(pool, { 倉庫ID: 11, 計画: true, 指定日: 日 })).filter((r) => n(r.在庫ケース) !== 0);
    const 入庫ID = [...new Set(見込み.map((r) => n(r.入庫ID)).filter((x) => x))];
    const 積み付け = new Map<number, number>(
      (await q(`SELECT DISTINCT ON ("入庫ID") "入庫ID", "積み付け数" FROM ${ロボット} WHERE "入庫ID" = ANY($1::int[]) ORDER BY "入庫ID", "ID"`, [入庫ID])).map(
        (r: Rec) => [n(r.入庫ID), r.積み付け数],
      ),
    );
    const 在庫ID = 見込み.filter((r) => !r.架空実物).map((r) => n(r.架空ID));
    const 棚済み = new Set<number>((await q(`SELECT "在庫ID" FROM ${在庫} WHERE "在庫ID" = ANY($1::int[]) AND "検体取得" = true`, [在庫ID])).map((r: Rec) => n(r.在庫ID)));
    // Access の Format(製造日, "yy/mm/dd")
    const 製造日の文字 = (v: unknown) => (v ? `${String(v).slice(2, 4)}/${String(v).slice(5, 7)}/${String(v).slice(8, 10)}` : "");
    const rows = 見込み
      .map((r) => ({
        認識ID: r.認識ID, 商品コード: r.商品コード, 商品名: r.商品名, 製造日: 製造日の文字(r.製造日), タグ: r.タグ, 在庫ケース: n(r.在庫ケース),
        割付残数: n(r.実算ケース), 積み付け数: 積み付け.get(n(r.入庫ID)) ?? null, 棚済み: !r.架空実物 && 棚済み.has(n(r.架空ID)), 計画: !!r.架空実物,
      }))
      // Access の一覧の並び（商品名・製造日・タグ）
      .sort((a, b) => String(a.商品名 ?? "").localeCompare(String(b.商品名 ?? ""), "ja") || a.製造日.localeCompare(b.製造日) || String(a.タグ ?? "").localeCompare(String(b.タグ ?? "")));
    const 配置 = await その日の配置(pool, 日);
    return { 置き場, 配置, 在庫: rows };
  });

  /** その日の行がなければ作る（Access は入庫日の既定値をその日にして、書いたときに行ができる） */
  async function 行を用意(c: { query: typeof pool.query }, 日: string): Promise<Rec> {
    const 今 = await その日の配置(c, 日);
    if (今) return 今;
    await c.query(`SELECT pg_advisory_xact_lock(hashtext('T_パレット配置図.ID'))`);
    const id = n((await c.query(`SELECT COALESCE(MAX("ID"), 0) + 1 AS n FROM ${配置図}`)).rows[0].n);
    await c.query(`INSERT INTO ${配置図} ("ID", "入庫日") VALUES ($1, $2::date)`, [id, 日]);
    return (await その日の配置(c, 日))!;
  }

  // 枠の文字を手で直す
  app.post<{ Body: { date: string; 欄: string; 値: string | null } }>("/api/ws/haichi/save", async (req, reply) => {
    const { date: 日, 欄 } = req.body;
    if (!置き場か(欄)) return reply.code(400).send({ error: "この枠はありません" });
    return 一連で(async (c) => {
      const r = await 行を用意(c, 日);
      await c.query(`UPDATE ${配置図} SET "${欄}" = $2 WHERE "ID" = $1`, [r.ID, req.body.値 === "" ? null : req.body.値]);
      return { ok: true };
    });
  });

  // 在庫を枠に置く（Access の C_保管庫用ドロップアクション）。
  // 1 枠に置く数は商品マスタのパレット単位1（なければ、または残りが少なければ残り全部）。同じロットが続くときは商品名を書かない
  app.post<{ Body: { date: string; 欄: string; 認識ID: string; 商品コード: number; 商品名: string; 製造日: string | null; タグ: string | null; 割付残数: number } }>(
    "/api/ws/haichi/drop",
    async (req, reply) => {
      const b = req.body;
      if (!置き場か(b.欄)) return reply.code(400).send({ error: "この枠はありません" });
      return 一連で(async (c) => {
        let 数 = n((await c.query(`SELECT "パレット単位1" FROM ${商品マスタ} WHERE "商品コード" = $1 LIMIT 1`, [n(b.商品コード)])).rows[0]?.パレット単位1);
        if (数 === 0 || n(b.割付残数) < 数) 数 = n(b.割付残数);
        const r = await 行を用意(c, b.date);
        const 前 = r[b.欄] ?? "";
        // 製造日は yy/mm/dd で届くので mm/dd にする
        const 日 = b.製造日 ? b.製造日.slice(-5) : "";
        const 文字 = (前 !== "" ? 前 + "\r\n" : "") + (String(r[`${b.欄}在庫ID`] ?? "") === String(b.認識ID) ? "" : `${b.商品名 ?? ""}\r\n`) + `${日} ${b.タグ ?? ""} ${数}個`;
        await c.query(`UPDATE ${配置図} SET "${b.欄}" = $2, "${b.欄}在庫ID" = $3 WHERE "ID" = $1`, [r.ID, 文字, String(b.認識ID)]);
        return { 文字, 数 };
      });
    },
  );

  // リセット（Access の ストックリセット）：工場の在庫のストック数を在庫ケースに戻し、その日の配置を消す
  app.post<{ Body: { date: string } }>("/api/ws/haichi/reset", async (req) =>
    一連で(async (c) => {
      await c.query(`UPDATE ${在庫} SET "ストック数" = "在庫ケース" WHERE "倉庫ID" = 11 AND "在庫ケース" <> 0`);
      const r = await その日の配置(c, req.body.date);
      if (r) await c.query(`DELETE FROM ${配置図} WHERE "ID" = $1`, [r.ID]);
      return { ok: true };
    }),
  );

  // ［自動］（Access は「テスト中」で動かない作り。2026/10/26 利用者の決め方で作った）。
  // 一覧の残り（割付残数）を 1 枚＝パレット単位1 のパレットに分け、空いている枠に 1 枠 3 枚まで置く。
  // 1 枚に満たない残り（端数。パレット単位の無い商品は残り全部）は T1・T2 へ（あふれたら手前の枠から）。満杯のパレットは同じ商品で枠をそろえる。満杯のパレットは、枚数の多いロットから（同じ枚数なら製造日の古い順）奥の枠
  // （L7→L1、R5→R1）から埋める。番地が C の枠（CL・CR）は保管庫の通路にあたり、ふさぐとフォークリフトが入れないので、
  // ほかの枠と T1・T2 がいっぱいのときだけ最後に使う（2026/10/28 利用者の依頼）。書いてある枠はそのまま。入りきらないものは置かずに返す
  app.post<{ Body: { date: string; 在庫: { 認識ID: string; 商品コード: number; 商品名: string; 製造日: string | null; タグ: string | null; 割付残数: number }[] } }>(
    "/api/ws/haichi/auto",
    async (req, reply) => {
      const b = req.body;
      if (!/^\d{4}-\d{2}-\d{2}$/.test(b.date ?? "")) return reply.code(400).send({ error: "日付が正しくありません" });
      return 一連で(async (c) => {
        const r = await 行を用意(c, b.date);
        type 枚 = { z: (typeof b.在庫)[number]; 数: number };
        const ロット: { z: (typeof b.在庫)[number]; 満杯: 枚[]; 端数: 枚 | null }[] = [];
        for (const z of b.在庫 ?? []) {
          const 残 = n(z.割付残数);
          if (残 <= 0) continue;
          const 単位 = n((await c.query(`SELECT "パレット単位1" FROM ${商品マスタ} WHERE "商品コード" = $1 LIMIT 1`, [n(z.商品コード)])).rows[0]?.パレット単位1);
          if (単位 === 0) ロット.push({ z, 満杯: [], 端数: { z, 数: 残 } }); // パレット単位が無い商品は残り全部を端数として 1 枚
          else ロット.push({ z, 満杯: Array.from({ length: Math.floor(残 / 単位) }, () => ({ z, 数: 単位 })), 端数: 残 % 単位 ? { z, 数: 残 % 単位 } : null });
        }
        ロット.sort((x, y) => y.満杯.length - x.満杯.length || String(x.z.製造日 ?? "").localeCompare(String(y.z.製造日 ?? "")) || n(x.z.商品コード) - n(y.z.商品コード) || String(x.z.タグ ?? "").localeCompare(String(y.z.タグ ?? "")));
        const 奥から = [
          ...[7, 6, 5, 4, 3, 2, 1].flatMap((i) => [1, 2, 3].map((j) => `L${i}-${j}`)),
          ...[5, 4, 3, 2, 1].map((i) => `R${i}-1`),
        ];
        const 通路 = [...[5, 4, 3, 2, 1].map((i) => `CL-${i}`), ...[5, 4, 3, 2, 1].map((i) => `CR-${i}`)];
        const 空き = (k: string) => !String(r[k] ?? "").trim();
        const 中身 = new Map<string, 枚[]>();
        // 混ぜない＝満杯のパレットは、ほかの商品が入っている枠には入れない（空き枠が足りないときだけ混ぜる）
        const 入れる = (枠たち: string[], p: 枚, 混ぜない = false) => {
          for (const k of 枠たち) {
            if (!空き(k)) continue;
            const x = 中身.get(k) ?? [];
            if (x.length >= 3) continue;
            if (混ぜない && x.length && x.some((y) => n(y.z.商品コード) !== n(p.z.商品コード))) continue;
            x.push(p);
            中身.set(k, x);
            return true;
          }
          return false;
        };
        const 後で: 枚[] = [];
        const 通路へ: 枚[] = [];
        for (const l of ロット) for (const p of l.満杯) if (!入れる(奥から, p, true)) 後で.push(p);
        for (const p of 後で) if (!入れる(奥から, p)) 通路へ.push(p);
        const 端数の残り: 枚[] = [];
        for (const l of [...ロット].sort((x, y) => String(x.z.製造日 ?? "").localeCompare(String(y.z.製造日 ?? ""))))
          if (l.端数 && !入れる(["T1", "T2", ...[...奥から].reverse()], l.端数)) 端数の残り.push(l.端数);
        // ほかが埋まったときだけ、C の枠（通路）を使う
        const 置けない: 枚[] = [];
        const 通路の後で: 枚[] = [];
        for (const p of 通路へ) if (!入れる(通路, p, true)) 通路の後で.push(p);
        for (const p of [...通路の後で, ...端数の残り]) if (!入れる(通路, p)) 置けない.push(p);
        // 枠に書く（手で置くときと同じ形：同じロットが続くときは商品名を書かない）
        const 置いた = new Map<string, number>();
        for (const [k, x] of 中身) {
          let 文字 = "";
          let 前 = "";
          for (const p of x) {
            const 日 = p.z.製造日 ? p.z.製造日.slice(-5) : "";
            文字 += (文字 ? "\r\n" : "") + (前 === String(p.z.認識ID) ? "" : `${p.z.商品名 ?? ""}\r\n`) + `${日} ${p.z.タグ ?? ""} ${p.数}個`;
            前 = String(p.z.認識ID);
            置いた.set(前, (置いた.get(前) ?? 0) + p.数);
          }
          await c.query(`UPDATE ${配置図} SET "${k}" = $2, "${k}在庫ID" = $3 WHERE "ID" = $1`, [r.ID, 文字, 前]);
        }
        return {
          枠数: 中身.size,
          枚数: [...中身.values()].reduce((a, x) => a + x.length, 0),
          置いた: Object.fromEntries(置いた),
          置けない: 置けない.map((p) => ({ 商品名: p.z.商品名, 製造日: p.z.製造日, 数: p.数 })),
        };
      });
    },
  );
}
