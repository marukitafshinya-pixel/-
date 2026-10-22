import type { FastifyInstance } from "fastify";
import { pool, q, t } from "./db.js";
import { requireUser } from "./auth.js";
import { 一連で } from "./ws.js";

// WorkStation の小さなマスタ（1 つにまとめた kyotsu の表を直す。もとはマスタ管理・受注登録の表。migrate/unify_masters.sql）
// - 相手先商品マスタ（FM_相手先商品マスタ）：相手先の商品コード・商品名と自社の商品の読み替え
// - 相手先届け先コードマスタ（FM_相手先届け先コードマスタ）：相手先の届け先コードと自社の得意先の読み替え
// - 集荷先パレット設定（FM_集荷先パレット設定）：集荷先ごと・商品ごとのパレットの積み数
const 得意先マスタ = t("kyotsu", "TM_得意先マスタ");
const 商品マスタ = t("kyotsu", "TM_商品マスタ");

type Rec = Record<string, any>;
const n = (v: unknown) => Number(v ?? 0) || 0;

type 設定 = {
  表: string;
  /** 行を見分ける列（なければ ctid） */
  鍵: string | null;
  列: string[];
  数の列: string[];
  絞る列: string;
  並び: string;
  合言葉: boolean;
};
const 表 = {
  aite: {
    表: t("kyotsu", "TM_相手先商品マスタ"), 鍵: null, 合言葉: false, 絞る列: "得意先短縮コード", 並び: `"得意先短縮コード", "相手先商品コード", "商品コード"`,
    列: ["得意先短縮コード", "得意先名", "相手先商品コード", "相手先商品名", "商品コード", "商品名"], 数の列: ["得意先短縮コード", "商品コード"],
  },
  todoke: {
    表: t("kyotsu", "TM_相手先届け先マスタ"), 鍵: "ID", 合言葉: false, 絞る列: "相手先コード", 並び: `"ID"`,
    列: ["相手方届け先コード", "自社コード", "届け先", "相手先コード", "相手先名"], 数の列: ["自社コード", "相手先コード"],
  },
  pallet: {
    表: t("kyotsu", "TM_集荷先別パレット設定"), 鍵: "ID", 合言葉: true, 絞る列: "集荷先ID", 並び: `"ID"`,
    列: ["集荷先ID", "集荷先", "商品コード", "商品名", "パレット単位", "特定パレット単位", "段数", "備考"], 数の列: ["集荷先ID", "商品コード", "パレット単位", "特定パレット単位", "段数"],
  },
} satisfies Record<string, 設定>;
type 種類 = keyof typeof 表;
const 表を選ぶ = (k: string): 設定 | null => (k in 表 ? 表[k as 種類] : null);

async function 短縮名(c: { query: typeof pool.query }, code: unknown) {
  return (await c.query(`SELECT "短縮名" FROM ${得意先マスタ} WHERE "短縮コード" = $1 LIMIT 1`, [n(code)])).rows[0]?.短縮名 ?? null;
}
async function 商品名(c: { query: typeof pool.query }, code: unknown) {
  return (await c.query(`SELECT "商品名" FROM ${商品マスタ} WHERE "商品コード" = $1 LIMIT 1`, [n(code)])).rows[0]?.商品名 ?? null;
}

function 合言葉が合う(v: unknown) {
  const pass = process.env.JUCHU_DELETE_PASSWORD;
  return !!pass && String(v ?? "") === pass;
}

export function wsMastersRoutes(app: FastifyInstance) {
  app.addHook("preHandler", requireUser);

  // 一覧（絞るコードを渡すとその相手先・集荷先だけ）と、絞り込みの選択肢
  app.get<{ Params: { kind: string }; Querystring: { code?: string } }>("/api/ws/mst/:kind", async (req, reply) => {
    const s = 表を選ぶ(req.params.kind);
    if (!s) return reply.code(404).send({ error: "この表はありません" });
    const code = req.query.code;
    const 鍵 = s.鍵 ? `"${s.鍵}"` : "ctid::text";
    const rows = await q(
      `SELECT ${鍵} AS "_鍵", ${s.列.map((k) => `"${k}"`).join(", ")} FROM ${s.表} ${code ? `WHERE "${s.絞る列}" = $1` : ""} ORDER BY ${s.並び}`,
      code ? [n(code)] : [],
    );
    let 選択肢: Rec[] = [];
    if (req.params.kind === "todoke")
      // Access の cmb_検索届け先（相手先ごと。届け先の多い順）
      選択肢 = await q(
        `SELECT "相手先コード" AS id, MAX("相手先名") AS name FROM ${s.表} GROUP BY "相手先コード" HAVING "相手先コード" <> 0 ORDER BY COUNT("相手方届け先コード") DESC, "相手先コード"`,
      );
    else if (req.params.kind === "pallet")
      選択肢 = await q(
        `SELECT p."集荷先ID" AS id, COALESCE(MIN(m."短縮名"), MIN(p."集荷先")) AS name FROM ${s.表} p LEFT JOIN ${得意先マスタ} m ON m."短縮コード" = p."集荷先ID"
         GROUP BY p."集荷先ID" ORDER BY p."集荷先ID"`,
      );
    return { rows, 選択肢 };
  });

  app.post<{ Body: { 合言葉: string } }>("/api/ws/mst/unlock", async (req, reply) => {
    if (!process.env.JUCHU_DELETE_PASSWORD) return reply.code(400).send({ error: "合言葉がサーバーに設定されていないため、修正できません。" });
    return { ok: 合言葉が合う(req.body.合言葉) };
  });

  // 1 つの欄を直す。コードを入れると名前も入れる（Access の各欄の AfterUpdate）
  app.post<{ Params: { kind: string }; Body: { 鍵: string; 項目: string; 値: unknown; 合言葉?: string } }>("/api/ws/mst/:kind/save", async (req, reply) => {
    const s = 表を選ぶ(req.params.kind);
    if (!s) return reply.code(404).send({ error: "この表はありません" });
    if (s.合言葉 && !合言葉が合う(req.body.合言葉)) return reply.code(403).send({ error: "修正できません。［修正］を押してパスワードを入れてください。" });
    const 項目 = req.body.項目;
    if (!s.列.includes(項目)) return reply.code(400).send({ error: "この欄は直せません" });
    return 一連で(async (c) => {
      const 値 = req.body.値 === "" || req.body.値 == null ? null : s.数の列.includes(項目) ? n(req.body.値) : String(req.body.値);
      const v: Rec = { [項目]: 値 };
      const k = req.params.kind as 種類;
      if (k === "aite" && 項目 === "得意先短縮コード") v.得意先名 = await 短縮名(c, 値);
      if ((k === "aite" || k === "pallet") && 項目 === "商品コード") v.商品名 = await 商品名(c, 値);
      // 自社コードを選ぶと、届け先が空なら得意先の短縮名を入れる（Access は欄の名前の書き違いでここが働いていない。手で入れた名前は残す）
      if (k === "todoke" && 項目 === "自社コード") {
        const 今 = (await c.query(`SELECT "届け先" FROM ${s.表} WHERE "ID" = $1`, [n(req.body.鍵)])).rows[0];
        if (今 && !今.届け先) v.届け先 = await 短縮名(c, 値);
      }
      const cols = Object.keys(v);
      const where = s.鍵 ? `"${s.鍵}" = $1` : `ctid = $1::tid`;
      const r = await c.query(
        `UPDATE ${s.表} SET ${cols.map((x, i) => `"${x}" = $${i + 2}`).join(", ")} WHERE ${where} RETURNING ${s.鍵 ? `"${s.鍵}"` : "ctid::text"} AS "_鍵"`,
        [s.鍵 ? n(req.body.鍵) : req.body.鍵, ...cols.map((x) => v[x])],
      );
      if (!r.rowCount) return reply.code(409).send({ error: "この行はほかの人が直したか消したようです。［出し直す］を押してください。" });
      return { ...v, _鍵: r.rows[0]._鍵 };
    });
  });

  // 新しい行（絞っている相手先・集荷先を入れておく。Access の DefaultValue と同じ）
  app.post<{ Params: { kind: string }; Body: { code?: number; 合言葉?: string } }>("/api/ws/mst/:kind/new", async (req, reply) => {
    const s = 表を選ぶ(req.params.kind);
    if (!s) return reply.code(404).send({ error: "この表はありません" });
    if (s.合言葉 && !合言葉が合う(req.body.合言葉)) return reply.code(403).send({ error: "修正できません。［修正］を押してパスワードを入れてください。" });
    return 一連で(async (c) => {
      const k = req.params.kind as 種類;
      const code = n(req.body.code);
      const v: Rec = {};
      if (k === "aite") Object.assign(v, { 得意先短縮コード: code || null, 得意先名: code ? await 短縮名(c, code) : null, chk: false, 使用不可: false });
      if (k === "todoke") {
        const 名 = code ? (await c.query(`SELECT "相手先名" FROM ${s.表} WHERE "相手先コード" = $1 AND "相手先名" IS NOT NULL LIMIT 1`, [code])).rows[0]?.相手先名 : null;
        Object.assign(v, { 相手先コード: code || 0, 相手先名: 名 ?? null, 自社コード: 0 });
      }
      if (k === "pallet") Object.assign(v, { 集荷先ID: code, 集荷先: await 短縮名(c, code), 商品コード: 0, パレット単位: 0, 特定パレット単位: 0, 段数: 0 });
      if (s.鍵) {
        await c.query(`SELECT pg_advisory_xact_lock(hashtext($1))`, [s.表]);
        v[s.鍵] = n((await c.query(`SELECT COALESCE(MAX("${s.鍵}"), 0) + 1 AS n FROM ${s.表}`)).rows[0].n);
      }
      const cols = Object.keys(v);
      await c.query(`INSERT INTO ${s.表} (${cols.map((x) => `"${x}"`).join(", ")}) VALUES (${cols.map((_, i) => `$${i + 1}`).join(", ")})`, cols.map((x) => v[x]));
      return { ok: true };
    });
  });

  // 行を消す
  app.post<{ Params: { kind: string }; Body: { 鍵: string; 合言葉?: string } }>("/api/ws/mst/:kind/delete", async (req, reply) => {
    const s = 表を選ぶ(req.params.kind);
    if (!s) return reply.code(404).send({ error: "この表はありません" });
    if (s.合言葉 && !合言葉が合う(req.body.合言葉)) return reply.code(403).send({ error: "修正できません。［修正］を押してパスワードを入れてください。" });
    const r = await pool.query(`DELETE FROM ${s.表} WHERE ${s.鍵 ? `"${s.鍵}" = $1` : `ctid = $1::tid`}`, [s.鍵 ? n(req.body.鍵) : req.body.鍵]);
    if (!r.rowCount) return reply.code(409).send({ error: "この行はほかの人が直したか消したようです。［出し直す］を押してください。" });
    return { ok: true };
  });
}
