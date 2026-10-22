import type { FastifyInstance } from "fastify";
import { pool, q, t, 日本の今 } from "./db.js";
import { requireUser } from "./auth.js";
import { 一覧のExcel } from "./excel.js";

// 丸北WorkStation の抽出帳票
// - 在庫表抽出印刷（Access の FM_在庫表。メニューの「在庫抽出帳票」）
const 在庫 = t("ws", "TD_在庫");
const 出荷 = t("ws", "TD_出荷");
const 輸送計画 = t("ws", "TD_輸送計画");
const 得意先マスタ = t("kyotsu", "TM_得意先マスタ");
const 商品マスタ = t("kyotsu", "TM_商品マスタ");
const 商品分類 = t("ws_fe", "TD_商品分類");

type Rec = Record<string, any>;
const n = (v: unknown) => Number(v ?? 0) || 0;

/** 在庫表抽出の条件（Access の Filt1〜Filt4。分類と商品は同じところに入るので、どちらか一方だけ効く） */
type 在庫の条件 = { soko?: string; meigi?: string; shohin?: string; bunrui?: string; nyuko?: string };
function 在庫の絞り込み(p: 在庫の条件): [string, unknown[]] {
  const w: string[] = [`z."在庫ケース" <> 0`];
  const a: unknown[] = [];
  const add = (sql: string, v: unknown) => {
    a.push(v);
    w.push(sql.replace("?", `$${a.length}`));
  };
  if (p.soko) add(`z."倉庫ID" = ?`, n(p.soko));
  if (p.meigi) add(`z."入庫後名義ID" = ?`, n(p.meigi));
  if (p.bunrui) add(`z."分類ID" = ?`, n(p.bunrui));
  else if (p.shohin) add(`z."商品コード" = ?`, n(p.shohin));
  const 今日 = 日本の今().日付;
  if (p.nyuko === "1") add(`z."入庫日" <= ?::date`, 今日);
  if (p.nyuko === "2") add(`z."入庫日" > ?::date`, 今日);
  return [w.join(" AND "), a];
}

async function 在庫の行(p: 在庫の条件): Promise<Rec[]> {
  const [w, a] = 在庫の絞り込み(p);
  return q(
    `SELECT z."在庫ID", z."倉庫ID", z."倉庫名", z."入庫後名義ID", m."短縮名" AS "名義名", b."分類名", z."商品コード", z."商品名", z."規格", z."入数",
            z."製造日"::date::text AS "製造日", z."賞味期限"::date::text AS "賞味期限", z."入庫日"::date::text AS "入庫日", z."入庫No",
            z."入庫元数", z."繰越ケース", z."製造ケース", z."出庫ケース", z."在庫ケース", z."繰越kg", z."製造kg", z."出荷kg", z."在庫kg",
            s."出荷日"::date::text AS "出荷日", g."本社コード"
     FROM ${在庫} z
       LEFT JOIN ${得意先マスタ} m ON m."短縮コード" = z."入庫後名義ID"
       LEFT JOIN ${商品分類} b ON b."分類ID" = z."分類ID"
       LEFT JOIN LATERAL (SELECT x."出荷日" FROM ${出荷} x JOIN ${輸送計画} y ON y."輸送ID" = x."輸送ID"
                          WHERE x."出庫ID" = z."出庫ID" AND x."届け先コード" <> 0 LIMIT 1) s ON true
       LEFT JOIN ${商品マスタ} g ON g."商品コード" = z."商品コード"
     WHERE ${w}
     ORDER BY s."出荷日" NULLS FIRST, z."倉庫ID", z."入庫後名義ID", z."商品コード", z."製造日" NULLS FIRST, z."在庫ID"`,
    a,
  );
}

/** Access の エクセル用在庫表（ロット別）の列 */
const 在庫のExcelの列 = [
  { key: "ID", width: 6 }, { key: "保管場所", width: 16 }, { key: "名義", width: 16 }, { key: "出荷日", width: 12, date: true },
  { key: "入庫日", width: 12, date: true }, { key: "入庫番号", width: 10 }, { key: "商品コード", width: 10 }, { key: "商品名", width: 30 },
  { key: "規格", width: 10 }, { key: "製造日", width: 12, date: true }, { key: "賞味期限", width: 12, date: true }, { key: "元数", width: 8 },
  { key: "繰越Cs", width: 8 }, { key: "入庫Cs", width: 8 }, { key: "出庫Cs", width: 8 }, { key: "在庫Cs", width: 8 }, { key: "＆", width: 3 },
  { key: "繰越kg", width: 9 }, { key: "入庫kg", width: 9 }, { key: "出庫kg", width: 9 }, { key: "在庫kg", width: 9 },
];

export function wsChushutsuRoutes(app: FastifyInstance) {
  app.addHook("preHandler", requireUser);

  // 在庫表抽出：選ぶ一覧（保管庫・名義は在庫の表に出てくるもの、分類、商品は選んだ保管庫・名義の在庫の商品）
  app.get<{ Querystring: 在庫の条件 }>("/api/ws/zaikochu/opts", async (req) => {
    const p = req.query;
    const w: string[] = [];
    const a: unknown[] = [];
    if (p.soko) (a.push(n(p.soko)), w.push(`"倉庫ID" = $${a.length}`));
    if (p.soko && p.meigi) (a.push(n(p.meigi)), w.push(`"入庫後名義ID" = $${a.length}`));
    return {
      保管庫: await q(
        `SELECT z."倉庫ID" AS id, MIN(m."短縮名") AS name FROM ${在庫} z LEFT JOIN ${得意先マスタ} m ON m."短縮コード" = z."倉庫ID" GROUP BY z."倉庫ID" ORDER BY z."倉庫ID"`,
      ),
      名義: await q(
        `SELECT z."入庫後名義ID" AS id, MIN(m."短縮名") AS name FROM ${在庫} z LEFT JOIN ${得意先マスタ} m ON m."短縮コード" = z."入庫後名義ID"
         WHERE z."入庫後名義ID" IS NOT NULL GROUP BY z."入庫後名義ID" ORDER BY z."入庫後名義ID"`,
      ),
      分類: await q(`SELECT "分類ID" AS id, "分類名" AS name FROM ${商品分類} ORDER BY "分類ID"`),
      商品: await q(
        `SELECT "商品コード" AS id, MIN("商品名") AS name FROM ${在庫} ${w.length ? "WHERE " + w.join(" AND ") : ""} GROUP BY "商品コード" ORDER BY "商品コード"`,
        a,
      ),
    };
  });

  app.get<{ Querystring: 在庫の条件 }>("/api/ws/zaikochu", async (req) => 在庫の行(req.query));

  // Excel に出力（Access の Zaiko_ExelOutput のロット別。最後の行に合計）
  app.get<{ Querystring: 在庫の条件 }>("/api/ws/zaikochu/excel", async (req, reply) => {
    const rows = await 在庫の行(req.query);
    const 合計 = { 繰越Cs: 0, 入庫Cs: 0, 出庫Cs: 0, 在庫Cs: 0, 繰越kg: 0, 入庫kg: 0, 出庫kg: 0, 在庫kg: 0 };
    const out: Rec[] = rows.map((r, i) => {
      const x: Rec = {
        ID: i + 1, 保管場所: r.倉庫名, 名義: r.名義名, 出荷日: r.出荷日, 入庫日: r.入庫日, 入庫番号: r.入庫No, 商品コード: r.本社コード, 商品名: r.商品名,
        規格: r.規格, 製造日: r.製造日, 賞味期限: r.賞味期限, 元数: r.入庫元数, 繰越Cs: r.繰越ケース, 入庫Cs: r.製造ケース, 出庫Cs: r.出庫ケース,
        在庫Cs: r.在庫ケース, 繰越kg: r.繰越kg, 入庫kg: r.製造kg, 出庫kg: r.出荷kg, 在庫kg: r.在庫kg,
      };
      for (const k of Object.keys(合計) as (keyof typeof 合計)[]) 合計[k] += n(x[k]);
      return x;
    });
    // Access は合計の行の入庫kg を書き損じている（製造kg という列はない）ので、入庫kg は空のまま
    out.push({ ID: out.length + 1, ...合計, 入庫kg: null });
    const 名義 = req.query.meigi ? (await pool.query(`SELECT "短縮名" FROM ${得意先マスタ} WHERE "短縮コード" = $1`, [n(req.query.meigi)])).rows[0]?.短縮名 ?? "" : "";
    const d = 日本の今().日付;
    const 名前 = `${d.slice(0, 4)}年${d.slice(5, 7)}月${d.slice(8, 10)}日  ${名義}名義在庫表（ﾛｯﾄ別）`;
    const buf = await 一覧のExcel("在庫表", 在庫のExcelの列, out);
    reply
      .header("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
      .header("Content-Disposition", `attachment; filename*=UTF-8''${encodeURIComponent(名前 + ".xlsx")}`);
    return reply.send(buf);
  });
}
