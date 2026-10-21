import type { FastifyInstance } from "fastify";
import { q, t } from "./db.js";
import { requireUser } from "./auth.js";

// 共通の探す画面（Access の FSD_得意先選択・FSD_商品名選択）
const 得意先マスタ = t("juchu_fe", "TM_得意先マスタ");
const 商品マスタ = t("juchu_fe", "TM_商品マスタ");
const 商品分類 = t("juchu_fe", "TD_商品分類");
const 原料マスタ = t("juchu_fe", "TM_原料マスタ");
const 地区コード = t("juchu_fe", "TM_地区コード");
const グループマスタ = t("ws_fe", "TM_グループマスタ");

/** カナの範囲（"ｱ-ｵ" や "ｲ"）を、ｶﾅ分類の先頭の文字の条件にする。Access の Like '[ｱ-ｵ]*' と同じ */
function カナ条件(kana: string | undefined): string | null {
  if (!kana) return null;
  if (!/^[ｦ-ﾝ](-[ｦ-ﾝ])?$/.test(kana)) return null;
  return `^[${kana}]`;
}

/** 並べ替えに使ってよい項目 */
const 商品の並び = new Set(["ｶﾅ分類", "商品コード", "本社コード", "商品名", "規格", "分類名"]);
const 得意先の並び = new Set(["ｶﾅ分類", "短縮コード", "得意先名", "短縮名", "住所"]);
/** 商品の文字で探す項目（Access の cmb_検索リスト） */
const 商品の検索項目 = new Set(["商品名", "短縮名", "規格", "取引先名", "本社コード", "グループ商品コード"]);

export function findRoutes(app: FastifyInstance) {
  app.addHook("preHandler", requireUser);

  // 選ぶ欄の一覧（商品：分類・原料、得意先：地区・グループ・グループマスタ）
  app.get("/api/find/lists", async () => ({
    分類: await q(`SELECT "分類ID" AS "id", "分類名" AS "name" FROM ${商品分類} ORDER BY "分類ID"`),
    原料: await q(`SELECT "原料分類ID" AS "id", MIN("原料分類") AS "name" FROM ${原料マスタ} GROUP BY "原料分類ID" ORDER BY "原料分類ID"`),
    地区: await q(`SELECT "地区コード" AS "id", MIN("地区名") AS "name" FROM ${地区コード} GROUP BY "地区コード" ORDER BY "地区コード"`),
    グループ: await q(
      `SELECT g."グループコード" AS "id", (SELECT "短縮名" FROM ${得意先マスタ} m WHERE m."短縮コード" = g."グループコード" LIMIT 1) AS "name"
       FROM ${得意先マスタ} g WHERE g."グループコード" <> 0 GROUP BY g."グループコード" ORDER BY COUNT(*)`,
    ),
    グループマスタ: await q(`SELECT "グループID" AS "id", "グループ名" AS "name" FROM ${グループマスタ} ORDER BY "グループID"`),
  }));

  // 地区を選んだときの都道府県
  app.get<{ Querystring: { chiku: string } }>("/api/find/pref", async (req) =>
    q(
      `SELECT "都道府県名" AS "name" FROM ${地区コード} WHERE "地区コード" = $1 GROUP BY "都道府県名" ORDER BY MIN("都道府県コード")`,
      [Number(req.query.chiku)],
    ),
  );

  // 商品（FSD_商品名選択）
  app.get<{ Querystring: Record<string, string | undefined> }>("/api/find/shohin", async (req) => {
    const p = req.query;
    const where: string[] = [];
    const args: unknown[] = [];
    const add = (sql: string, v: unknown) => {
      args.push(v);
      where.push(sql.replace("?", `$${args.length}`));
    };
    const kana = カナ条件(p.kana);
    if (kana) add(`s."ｶﾅ分類" ~ ?`, kana);
    if (p.bunrui) add(`s."分類ID" = ?`, Number(p.bunrui));
    if (p.genryo) add(`s."原料コード" = ?`, Number(p.genryo));
    if (p.w) {
      const col = 商品の検索項目.has(p.col ?? "") ? p.col! : "商品名";
      if (col === "グループ商品コード") add(`s."グループ商品コード" = ?`, Number(p.w) || -1);
      else add(`s."${col}"::text LIKE ?`, `%${p.w}%`);
    }
    if (p.old === "1") where.push(`s."旧会社コード区分" = true`);
    const sort = 商品の並び.has(p.sort ?? "") ? p.sort! : "商品コード";
    return q(
      `SELECT s."商品コード" AS "コード", s."ｶﾅ分類", s."本社コード", s."短縮名", s."商品名", s."取引先名", s."規格", b."分類名"
       FROM ${商品マスタ} s LEFT JOIN ${商品分類} b ON b."分類ID" = s."分類ID"
       ${where.length ? "WHERE " + where.join(" AND ") : ""}
       ORDER BY "${sort}", s."商品コード" LIMIT 1000`,
      args,
    );
  });

  // 得意先（FSD_得意先選択）
  app.get<{ Querystring: Record<string, string | undefined> }>("/api/find/tokui", async (req) => {
    const p = req.query;
    const where: string[] = [];
    const args: unknown[] = [];
    const add = (sql: string, v: unknown) => {
      args.push(v);
      where.push(sql.replace("?", `$${args.length}`));
    };
    const kana = カナ条件(p.kana);
    if (kana) add(`"ｶﾅ分類" ~ ?`, kana);
    if (p.w) {
      // 名前の一部、または短縮コードそのもので探す（Access は得意先名だけ。コードでも探せるようにした）
      args.push(`%${p.w}%`, p.w);
      where.push(`("得意先名" LIKE $${args.length - 1} OR "短縮名" LIKE $${args.length - 1} OR "短縮コード"::text = $${args.length})`);
    }
    if (p.group) add(`"グループコード" = ?`, Number(p.group));
    if (p.group3) add(`"グループコード3" = ?`, Number(p.group3));
    if (p.chiku) add(`"地区コード"::text = ?`, String(p.chiku));
    if (p.pref) add(`"住所" LIKE ?`, `%${p.pref}%`);
    // 保管：2＝倉庫で出荷元、3＝倉庫で出荷元でない
    if (p.hokan === "2") where.push(`"倉庫区分" = true AND "出荷元区分" = true`);
    if (p.hokan === "3") where.push(`"倉庫区分" = true AND "出荷元区分" = false`);
    const sort = 得意先の並び.has(p.sort ?? "") ? p.sort! : "ｶﾅ分類";
    return q(
      `SELECT "短縮コード" AS "コード", "ｶﾅ分類", "短縮名", "得意先名", "住所", "電話番号"
       FROM ${得意先マスタ} ${where.length ? "WHERE " + where.join(" AND ") : ""}
       ORDER BY "${sort}", "短縮コード" LIMIT 1000`,
      args,
    );
  });
}
