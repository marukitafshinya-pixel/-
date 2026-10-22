import type { FastifyInstance } from "fastify";
import { pool, q, t, 日本の今 } from "./db.js";
import { requireUser } from "./auth.js";
import { 一覧のExcel } from "./excel.js";
import { 一連で } from "./ws.js";

// 丸北WorkStation の抽出帳票
// - 在庫表抽出印刷（Access の FM_在庫表。メニューの「在庫抽出帳票」）
// - 出荷抽出帳票（FSD_出荷抽出帳票）：出荷を条件で絞り、見出し（ヘッダー・フッダー）と並び順を選んで印刷・Excel 出力。条件は名前を付けて保存できる
const 在庫 = t("ws", "TD_在庫");
const 出荷 = t("ws", "TD_出荷");
const 輸送計画 = t("ws", "TD_輸送計画");
const 得意先マスタ = t("kyotsu", "TM_得意先マスタ");
const 商品マスタ = t("kyotsu", "TM_商品マスタ");
const 商品分類 = t("ws_fe", "TD_商品分類");
const レポート作成 = t("ws_fe", "TM_レポート作成");

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

// ---------------- 出荷抽出帳票 ----------------

/** 出荷の行（Access の Q_出荷レコード：便に入っていて届け先のある出荷。名義・分類・本社コードを足す） */
const 出荷の表 = `(SELECT s."出庫ID", s."輸送ID", s."出荷日", s."納品日", s."製造日", s."賞味期限", s."届け先コード", s."届け先", s."倉庫ID", s."倉庫名",
    s."手配帳合ID", s."手配帳合" AS "帳合先", s."取引元ID", s."取引元", s."商品コード", s."商品名", s."規格", s."ケース", s."商品kg", s."入庫No",
    s."入庫前名義ID", s."入庫後名義ID", mae."短縮名" AS "入庫前名義", ato."短縮名" AS "入庫後名義",
    p."運送会社ID", p."運送会社名", p."車番", g."分類ID", g."本社コード"
  FROM ${輸送計画} p JOIN ${出荷} s ON s."輸送ID" = p."輸送ID"
    LEFT JOIN ${商品マスタ} g ON g."商品コード" = s."商品コード"
    LEFT JOIN ${得意先マスタ} mae ON mae."短縮コード" = s."入庫前名義ID"
    LEFT JOIN ${得意先マスタ} ato ON ato."短縮コード" = s."入庫後名義ID"
  WHERE s."届け先コード" <> 0)`;

/** 見出しにできるもの（Access の GroupName。番号はフォームのヘッダー・フッダーの番号） */
const 見出し: Record<number, { 名前: string; 式: string }> = {
  1: { 名前: "出荷月", 式: `to_char(x."出荷日", 'YYYY/MM')` },
  2: { 名前: "製造月", 式: `to_char(x."製造日", 'YYYY/MM')` },
  3: { 名前: "届け先", 式: `x."届け先"` },
  4: { 名前: "倉庫名", 式: `x."倉庫名"` },
  5: { 名前: "運送会社名", 式: `x."運送会社名"` },
  6: { 名前: "商品名", 式: `x."商品名"` },
  7: { 名前: "入庫前名義", 式: `x."入庫前名義"` },
  8: { 名前: "入庫後名義", 式: `x."入庫後名義"` },
  9: { 名前: "分類ID", 式: `x."分類ID"::text` },
  10: { 名前: "取引元", 式: `x."取引元"` },
  12: { 名前: "帳合先", 式: `x."帳合先"` },
};
/** 並び順にできる項目（Access の rab1〜rab11 のラベル） */
const 並べる項目 = ["出荷日", "製造日", "届け先コード", "手配帳合ID", "倉庫ID", "運送会社ID", "商品コード", "入庫前名義ID", "入庫後名義ID", "分類ID", "取引元ID"];

type 出荷の条件 = {
  出荷日1?: string; 出荷日2?: string; 製造日1?: string; 製造日2?: string; 届け先?: number; 帳合?: number; 出荷元?: number; 運送会社?: number;
  商品?: number; 名義?: number; 入庫名義?: number; 分類?: number; 分類等号?: string; 取引元?: number; 品名?: string;
  ヘッダー?: number; フッダー?: number; 並び?: string[];
};

/** 出荷を絞って並べる（Access の C_Filset と Nmbering。見出しで並べてから、選んだ並び順、最後にケース） */
async function 出荷の行(p: 出荷の条件): Promise<Rec[]> {
  const w: string[] = [];
  const a: unknown[] = [];
  const add = (sql: string, v: unknown) => {
    a.push(v);
    w.push(sql.replace("?", `$${a.length}`));
  };
  if (p.出荷日1 || p.出荷日2) {
    add(`x."出荷日" >= ?::date`, p.出荷日1 || "1900-01-01");
    add(`x."出荷日" <= ?::date`, p.出荷日2 || "9999-12-31");
  }
  if (p.製造日1 || p.製造日2) {
    add(`x."製造日" >= ?::date`, p.製造日1 || "1900-01-01");
    add(`x."製造日" <= ?::date`, p.製造日2 || "9999-12-31");
  }
  const 数: [keyof 出荷の条件, string][] = [
    ["届け先", "届け先コード"], ["帳合", "手配帳合ID"], ["出荷元", "倉庫ID"], ["運送会社", "運送会社ID"], ["商品", "商品コード"],
    ["名義", "入庫前名義ID"], ["入庫名義", "入庫後名義ID"], ["取引元", "取引元ID"],
  ];
  for (const [k, col] of 数) if (p[k] != null && String(p[k]) !== "") add(`x."${col}" = ?`, n(p[k]));
  if (p.分類 != null && String(p.分類) !== "") {
    const 等号 = ["=", "<=", ">="].includes(p.分類等号 ?? "") ? p.分類等号 : "=";
    add(`x."分類ID" ${等号} ?`, n(p.分類));
  }
  if (p.品名) add(`x."商品名" LIKE ?`, `%${p.品名}%`);
  const 並び: string[] = [];
  const h = 見出し[n(p.ヘッダー)];
  const f = 見出し[n(p.フッダー)];
  if (h) 並び.push(`${h.式} NULLS FIRST`);
  if (f) 並び.push(`${f.式} NULLS FIRST`);
  const 選んだ = (p.並び ?? []).filter((k) => 並べる項目.includes(k));
  for (const k of 選んだ.length ? 選んだ : ["出荷日"]) 並び.push(`x."${k}" NULLS FIRST`);
  並び.push(`x."ケース"`, `x."出庫ID"`);
  return q(
    `SELECT x.*, x."出荷日"::date::text AS "出荷日", x."納品日"::date::text AS "納品日", x."製造日"::date::text AS "製造日", x."賞味期限"::date::text AS "賞味期限",
            ${h ? h.式 : "NULL"} AS "見出し1", ${f ? f.式 : "NULL"} AS "見出し2"
     FROM ${出荷の表} x ${w.length ? "WHERE " + w.join(" AND ") : ""} ORDER BY ${並び.join(", ")} LIMIT 20000`,
    a,
  );
}

/** Access の エクセル用出荷履歴 の列 */
const 出荷のExcelの列 = [
  { key: "ID", width: 6 }, { key: "出荷日", width: 12, date: true }, { key: "曜日", width: 5 }, { key: "出荷元", width: 16 }, { key: "商品コード", width: 10 },
  { key: "商品名", width: 30 }, { key: "規格", width: 10 }, { key: "製造日", width: 12, date: true }, { key: "賞味期限", width: 12, date: true },
  { key: "ケース", width: 8 }, { key: "商品kg", width: 9 }, { key: "納品日", width: 12, date: true }, { key: "届け先", width: 18 }, { key: "入庫名義", width: 16 },
  { key: "運送会社名", width: 16 }, { key: "車番", width: 8 }, { key: "日数", width: 6 },
];
const 曜日 = "日月火水木金土";

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

  // ---------------- 出荷抽出帳票 ----------------

  app.post<{ Body: 出荷の条件 }>("/api/ws/shukkachu", async (req) => 出荷の行(req.body ?? {}));

  // Excel に出力（Access の Syukka_ExelOutput。ファイル名は 出荷日の範囲 ＋ レポート表題）
  app.post<{ Body: 出荷の条件 & { 表題?: string } }>("/api/ws/shukkachu/excel", async (req, reply) => {
    const rows = await 出荷の行(req.body ?? {});
    const out = rows.map((r, i) => ({
      ID: i + 1, 出荷日: r.出荷日, 曜日: r.出荷日 ? 曜日[new Date(r.出荷日 + "T00:00:00Z").getUTCDay()] : null, 出荷元: r.倉庫名, 商品コード: r.本社コード,
      商品名: r.商品名, 規格: r.規格, 製造日: r.製造日, 賞味期限: r.賞味期限, ケース: r.ケース, 商品kg: r.商品kg, 納品日: r.納品日, 届け先: r.届け先,
      入庫名義: r.入庫後名義, 運送会社名: r.運送会社名, 車番: r.車番,
      日数: r.出荷日 && r.納品日 ? Math.round((Date.parse(r.納品日) - Date.parse(r.出荷日)) / 86400000) : null,
    }));
    const 日 = (v?: string) => (v ? `${v.slice(2, 4)}年${v.slice(5, 7)}月${v.slice(8, 10)}日` : "");
    const 名前 = `${日(req.body?.出荷日1)}～${日(req.body?.出荷日2)}${req.body?.表題 ?? ""}`.replace(/[\\/:*?"<>|]/g, "");
    const buf = await 一覧のExcel("出荷履歴", 出荷のExcelの列, out);
    reply
      .header("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
      .header("Content-Disposition", `attachment; filename*=UTF-8''${encodeURIComponent((名前 || "出荷履歴") + ".xlsx")}`);
    return reply.send(buf);
  });

  // コードの名前（条件の欄の右に出す）
  app.get<{ Querystring: { kind: string; code: string } }>("/api/ws/shukkachu/name", async (req) => {
    const code = n(req.query.code);
    const k = req.query.kind;
    const sql =
      k === "shohin" ? `SELECT "商品名" AS name FROM ${商品マスタ} WHERE "商品コード" = $1 LIMIT 1`
      : k === "unso" ? `SELECT "運送会社名" AS name FROM ${t("kyotsu", "TM_運送会社マスタ")} WHERE "運送会社ID" = $1 ORDER BY COALESCE("使用不可フラグ", false) LIMIT 1`
      : k === "bunrui" ? `SELECT "分類名" AS name FROM ${商品分類} WHERE "分類ID" = $1 LIMIT 1`
      : `SELECT "短縮名" AS name FROM ${得意先マスタ} WHERE "短縮コード" = $1 LIMIT 1`;
    return { name: (await pool.query(sql, [code])).rows[0]?.name ?? "" };
  });

  // 保存した条件（Access の TM_レポート作成。出荷日・製造日・帳合は保存しない）
  app.get("/api/ws/shukkachu/saved", async () => q(`SELECT * FROM ${レポート作成} ORDER BY "ID"`));

  app.post<{ Body: Rec }>("/api/ws/shukkachu/saved", async (req) => {
    const b = req.body ?? {};
    const 番号 = (k: string) => (b.番号?.[k] ? n(b.番号[k]) : 0);
    const v: Rec = {
      表題: b.表題 ?? null, 宛名: b.宛名 ?? null, 届け先コード: b.届け先 ?? null, 倉庫ID: b.出荷元 ?? null, 運送会社ID: b.運送会社 ?? null,
      商品コード: b.商品 ?? null, 入庫前名義: b.名義 ?? null, 入庫後名義: b.入庫名義 ?? null, 商品分類: b.分類 ?? null, 取引元ID: b.取引元 ?? null,
      商品分類等号: b.分類等号 ?? "=", レポートタイプ: n(b.タイプ), ヘッダー: n(b.ヘッダー), フッダー: n(b.フッダー),
      並び順: (b.並び ?? []).map((x: string) => x + ",").join(""), 抽出品名: b.品名 ?? null, 作成日時: 日本の今().日時.replace(/\//g, "-"),
    };
    for (let i = 1; i <= 10; i++) v[`No${i}`] = 番号(並べる項目[i - 1]);
    await 一連で(async (c) => {
      await c.query(`SELECT pg_advisory_xact_lock(hashtext('TM_レポート作成.ID'))`);
      v.ID = n((await c.query(`SELECT COALESCE(MAX("ID"), 0) + 1 AS n FROM ${レポート作成}`)).rows[0].n);
      const cols = Object.keys(v);
      await c.query(`INSERT INTO ${レポート作成} (${cols.map((k) => `"${k}"`).join(", ")}) VALUES (${cols.map((_, i) => `$${i + 1}`).join(", ")})`, cols.map((k) => v[k]));
    });
    return { ID: v.ID };
  });

  app.post<{ Body: { ID: number } }>("/api/ws/shukkachu/saved/delete", async (req) => {
    await pool.query(`DELETE FROM ${レポート作成} WHERE "ID" = $1`, [n(req.body.ID)]);
    return { ok: true };
  });
}
