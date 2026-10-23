import type { FastifyInstance } from "fastify";
import type { PoolClient } from "pg";
import { q, t, 日本の今 } from "./db.js";
import { requireUser } from "./auth.js";
import { 一連で } from "./ws.js";
import { 倉庫詳細設定, 次の番号, 行を足す } from "./soko.js";

// 倉庫管理System の倉庫賃率・入庫設定（Access の FM_保管賃設定・FS_保管賃設定・FS_保管賃設定詳細）。
// 冷蔵庫（営業冷蔵庫の得意先）ごとに、倉庫詳細設定（冷蔵庫×名義×商品〈0＝標準〉×契約入庫日の期間の料率）と、得意先の入庫フラグを直す。
const 得意先マスタ = t("kyotsu", "TM_得意先マスタ");
const 商品マスタ = t("kyotsu", "TM_商品マスタ");
const 丸め計算 = t("soko", "TM_丸め計算マスタ");

type Rec = Record<string, any>;
const n = (v: unknown) => Number(v ?? 0) || 0;

const 数の項目 = new Set([
  "短縮コード", "商品コード", "名義コード", "入出庫料", "保管料", "名義変更料", "休日入出庫料", "最低入出庫料", "最低保管料", "最低入出庫kg", "最低保管kg", "小数点区分", "丸め計算",
  "名変料発生区分", "荷役料", "小口出庫割増", "業務代行料", "分割手数料", "証明書料金", "自動変更後名義ID", "一桁目繰上", "計算単位", "税区分", "賞味期限管理手数料kg",
  "賞味期限管理手数料dm3", "検品手数料", "画像報告手数料", "経由出庫手数料",
]);
const 整数の項目 = new Set(["短縮コード", "商品コード", "名義コード", "名義変更料", "小数点区分", "丸め計算", "名変料発生区分", "自動変更後名義ID", "一桁目繰上", "計算単位", "税区分", "賞味期限管理手数料kg", "検品手数料", "経由出庫手数料"]);
const 日の項目 = new Set(["終了日", "入力日", "契約入庫日開始", "契約入庫日終了"]);
const はいいいえ = new Set(["自動名変", "初回最低保管料のみ適用", "終了chk"]);
const 文字の項目 = new Set(["倉庫名", "商品名", "名義名", "備考", "共通名称"]);

/** 修正の合言葉（Access は TD_USER のパスワード。Web 版はサーバーの設定 SOKO_PASSWORD） */
const 合言葉が合う = (v: unknown) => !!process.env.SOKO_PASSWORD && String(v ?? "") === process.env.SOKO_PASSWORD;

async function 名前(c: PoolClient, 表: "得意先" | "商品", code: unknown): Promise<string | null> {
  if (表 === "商品") return (await c.query(`SELECT "商品名" FROM ${商品マスタ} WHERE "商品コード" = $1 LIMIT 1`, [n(code)])).rows[0]?.商品名 ?? null;
  return (await c.query(`SELECT "短縮名" FROM ${得意先マスタ} WHERE "短縮コード" = $1 LIMIT 1`, [n(code)])).rows[0]?.短縮名 ?? null;
}

export function sokoChinritsuRoutes(app: FastifyInstance) {
  app.addHook("preHandler", requireUser);

  // 冷蔵庫（営業冷蔵庫の得意先。短縮コードの順）と、小数点区分・一桁目繰上の選択肢
  app.get("/api/soko/chinritsu", async () => ({
    冷蔵庫: await q(
      `SELECT "短縮コード" AS id, "得意先名" AS name, "短縮名", "入庫フラグ" FROM ${得意先マスタ} WHERE "倉庫区分" = true AND "出荷元区分" = false ORDER BY "短縮コード"`,
    ),
    丸め: await q(`SELECT "丸め計算ID" AS id, "計算名" AS name FROM ${丸め計算} ORDER BY "丸め計算ID"`),
  }));
  // その冷蔵庫の設定（終了日・契約入庫日開始の新しい順、名義・商品の順）
  app.get<{ Params: { code: string } }>("/api/soko/chinritsu/:code", async (req) =>
    q(
      `SELECT s.*, s."終了日"::date::text AS "終了日", s."入力日"::date::text AS "入力日", s."契約入庫日開始"::date::text AS "契約入庫日開始", s."契約入庫日終了"::date::text AS "契約入庫日終了"
       FROM ${倉庫詳細設定} s WHERE s."短縮コード" = $1
       ORDER BY s."終了日" DESC NULLS LAST, s."契約入庫日開始" DESC NULLS LAST, s."短縮コード", s."名義コード", s."商品コード", s."ID"`,
      [n(req.params.code)],
    ),
  );
  app.post<{ Body: { 合言葉: string } }>("/api/soko/chinritsu/unlock", async (req, reply) => {
    if (!process.env.SOKO_PASSWORD) return reply.code(400).send({ error: "合言葉がサーバーに設定されていないため、修正できません。" });
    return { ok: 合言葉が合う(req.body.合言葉) };
  });

  // 1 つの項目を直す（倉庫を入れると倉庫名と商品名、名義を入れると名義名、商品を入れると商品名）
  app.post<{ Body: { 合言葉: string; ID: number; 項目: string; 値: unknown } }>("/api/soko/chinritsu/save", async (req, reply) => {
    if (!合言葉が合う(req.body.合言葉)) return reply.code(403).send({ error: "修正できません。［修正］を押してパスワードを入れてください。" });
    const 項目 = req.body.項目;
    if (!数の項目.has(項目) && !日の項目.has(項目) && !はいいいえ.has(項目) && !文字の項目.has(項目)) return reply.code(400).send({ error: "この項目は直せません" });
    return 一連で(async (c) => {
      const r = (await c.query(`SELECT * FROM ${倉庫詳細設定} WHERE "ID" = $1 FOR UPDATE`, [n(req.body.ID)])).rows[0];
      if (!r) return reply.code(404).send({ error: "この設定はありません" });
      let 値: any = req.body.値 === "" ? null : req.body.値;
      if (数の項目.has(項目) && 値 !== null) 値 = 整数の項目.has(項目) ? Math.trunc(Number(値)) : Number(値);
      if (はいいいえ.has(項目)) 値 = !!値;
      const v: Rec = { [項目]: 値 };
      if (項目 === "短縮コード") {
        v.倉庫名 = await 名前(c, "得意先", 値);
        v.商品名 = await 名前(c, "商品", r.商品コード);
      }
      if (項目 === "名義コード") v.名義名 = await 名前(c, "得意先", 値);
      if (項目 === "商品コード") v.商品名 = await 名前(c, "商品", 値);
      const k = Object.keys(v);
      await c.query(`UPDATE ${倉庫詳細設定} SET ${k.map((x, i) => `"${x}" = $${i + 2}`).join(", ")} WHERE "ID" = $1`, [r.ID, ...k.map((x) => v[x])]);
      return { ok: true };
    });
  });
  // 新しい行（その冷蔵庫。数は 0、はい／いいえは いいえ）
  app.post<{ Body: { 合言葉: string; 短縮コード: number } }>("/api/soko/chinritsu/add", async (req, reply) => {
    if (!合言葉が合う(req.body.合言葉)) return reply.code(403).send({ error: "修正できません。［修正］を押してパスワードを入れてください。" });
    return 一連で(async (c) => {
      const ID = await 次の番号(c, 倉庫詳細設定, "ID");
      const v: Rec = { ID };
      for (const k of 数の項目) v[k] = 0;
      for (const k of はいいいえ) v[k] = false;
      Object.assign(v, { 短縮コード: n(req.body.短縮コード), 倉庫名: await 名前(c, "得意先", req.body.短縮コード), 入力日: 日本の今().日付 });
      await 行を足す(c, 倉庫詳細設定, v);
      return { ID };
    });
  });
  app.post<{ Body: { 合言葉: string; ID: number } }>("/api/soko/chinritsu/delete", async (req, reply) => {
    if (!合言葉が合う(req.body.合言葉)) return reply.code(403).send({ error: "修正できません。［修正］を押してパスワードを入れてください。" });
    await q(`DELETE FROM ${倉庫詳細設定} WHERE "ID" = $1`, [n(req.body.ID)]);
    return { ok: true };
  });
  // 得意先の入庫フラグ（立っていれば、倉庫詳細設定にある名義だけ入庫できる）
  app.post<{ Body: { 合言葉: string; 短縮コード: number; 入庫フラグ: boolean } }>("/api/soko/chinritsu/flag", async (req, reply) => {
    if (!合言葉が合う(req.body.合言葉)) return reply.code(403).send({ error: "修正できません。［修正］を押してパスワードを入れてください。" });
    await q(`UPDATE ${得意先マスタ} SET "入庫フラグ" = $2 WHERE "短縮コード" = $1`, [n(req.body.短縮コード), !!req.body.入庫フラグ]);
    return { ok: true };
  });
}
