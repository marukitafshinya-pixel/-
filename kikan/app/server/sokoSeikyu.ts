import type { FastifyInstance } from "fastify";
import type { PoolClient } from "pg";
import { q, t, 日本の今 } from "./db.js";
import { requireUser } from "./auth.js";
import { 一連で } from "./ws.js";
import { cint } from "./hanmori.js";
import { 一覧のExcel } from "./excel.js";
import { 倉庫の在庫, 倉庫の出荷, 倉庫の名変, 倉庫詳細設定, 倉庫のUSER, 費用月別集計 } from "./soko.js";
import { 保管料の明細を作る, 小数点計算 } from "./sokoHokan.js";
import { 買取単価コード } from "./sokoMeihen.js";

// 倉庫管理System の請求書印刷（Access の FSD_請求書印刷）と月末集計（M_月末処理 の C_月末集計・C_指定月保管賃計算・C_倉庫名義別在庫集計）。
// 月末集計の結果は Access と同じく作業表 T_在庫計算表（soko_fe）に書き、帳票（保管料請求書＝月別保管料明細表 など）はそこから作る。
const 計算表 = t("soko_fe", "T_在庫計算表");
const 諸経費 = t("soko", "TD_諸経費");
const 得意先マスタ = t("kyotsu", "TM_得意先マスタ");
const 商品マスタ = t("kyotsu", "TM_商品マスタ");
const 経費項目 = t("soko", "TM_経費項目マスタ");
const 買取単価マスタ = t("ws_fe", "TM_買取単価マスタ");
const オブジェクト一覧 = t("soko_fe", "オブジェクト一覧");

type Rec = Record<string, any>;
const n = (v: unknown) => Number(v ?? 0) || 0;
const 日付か = (v: unknown) => /^\d{4}-\d{2}-\d{2}$/.test(String(v ?? ""));
const 年月 = (d: string) => d.slice(0, 7).replace("-", "/");

/** 一桁目の計算（Access の My一桁目計算。いったん整数〈銀行丸め〉にしてから、1 の位を 1＝四捨五入・2＝繰上げ・3＝繰下げ で 10 円単位にする） */
export function 一桁目計算(v: number, 方法: number): number {
  const x = cint(v);
  const 一の位 = Number(String(x).slice(-1));
  if (!一の位) return x;
  if (方法 === 1) return 一の位 >= 5 ? x - 一の位 + 10 : x - 一の位;
  if (方法 === 2) return x - 一の位 + 10;
  if (方法 === 3) return x - 一の位;
  return x;
}

/** 費用月別集計の合計（在庫ID・開始期間が期間内） */
async function 費用の合計(c: PoolClient, 在庫ID: number, 開始: string, 終了: string) {
  return (
    await c.query(
      `SELECT SUM("ケース") AS "ケース", SUM("入出庫料") AS "入出庫料", SUM("保管料") AS "保管料", SUM("サービス料") AS "サービス料", SUM("その他費用") AS "その他費用", COUNT("期") AS "請求期"
       FROM ${費用月別集計} WHERE "在庫ID" = $1 AND "開始期間" BETWEEN $2::date AND $3::date`,
      [在庫ID, 開始, 終了],
    )
  ).rows[0] as Rec;
}
async function 諸経費の合計(c: PoolClient, 条件: string, 在庫ID: number, 開始: string, 終了: string): Promise<number> {
  return n(
    (await c.query(`SELECT SUM("諸経費") AS v FROM ${諸経費} WHERE ${条件} AND "在庫ID" = $1 AND "集計月" BETWEEN $2 AND $3`, [在庫ID, 年月(開始), 年月(終了)])).rows[0].v,
  );
}

/**
 * 倉庫・名義ごとの集計（C_倉庫名義別在庫集計）。保管料の明細（費用月別集計）を 終了期間の月ごと・ロットごとにまとめ、開始期間が期間内のものを 1 行にする。
 * - 請求個数・当月入出庫料・当月保管料（−サービス料）・請求期は、期間内の明細の合計。端数は倉庫詳細設定の小数点区分・一桁目繰上で丸め、入出庫料訂正（経費 32）・保管料訂正（33）を足す。
 * - 荷役料＝明細のその他費用、名変料＝経費 4、割増料＝経費 14、諸経費＝荷役料＋経費 31 未満（そのロットの分）。
 * - 倉庫全体の諸経費（在庫ID 0・経費 31 未満・開始日の月）を別の行で足す。Access と同じく名義では絞らないので、名義ごとに同じ行が入る。
 * Access の書き損じもそのまま：設定が一度見つかると以後の行も「見つかった」側の計算になる（どちらでも結果はほぼ同じ）、期は入らない（0）、
 * 設定が見つからない行の丸めは前に見つかった設定で行う。
 */
async function 倉庫名義別に集計する(c: PoolClient, 開始: string, 終了: string, 倉庫: number, 名義: number, 作成日付: string) {
  const 明細 = (
    await c.query(
      `SELECT h."在庫ID", MIN(h."倉庫名") AS "倉庫名", h."倉庫No" AS "倉庫ID", h."入庫後名義ID", h."商品コード", MIN(h."商品名") AS "商品名", h."入庫日"::date::text AS "入庫日",
              h."製造日"::date::text AS "製造日", h."賞味期限"::date::text AS "賞味期限", h."入庫元数", h."入庫No", COUNT(h."期") AS "請求期", SUM(h."ケース") AS "ケース",
              SUM(h."保管料") AS "保管料", SUM(h."サービス料") AS "サービス料", MIN(h."開始期間")::date::text AS "開始期間", z."名変前在庫ID", z."タグ", z."商品区分"
       FROM ${費用月別集計} h JOIN ${倉庫の在庫} z ON z."在庫ID" = h."在庫ID"
       WHERE h."倉庫No" = $1 AND h."入庫後名義ID" = $2
       GROUP BY to_char(h."終了期間", 'YYYY/MM'), h."倉庫名", h."入庫後名義ID", h."商品コード", h."商品名", h."入庫日", h."製造日", h."賞味期限", h."入庫元数", h."入庫No", h."在庫ID", h."倉庫No",
                z."保管料負担日", z."名変前在庫ID", z."タグ", z."商品区分"
       HAVING MIN(h."開始期間") BETWEEN $3::date AND $4::date
       ORDER BY h."在庫ID", MIN(h."開始期間")`,
      [倉庫, 名義, 開始, 終了],
    )
  ).rows as Rec[];
  const 設定 = (await c.query(`SELECT * FROM ${倉庫詳細設定} WHERE "短縮コード" = $1 AND "名義コード" = $2 ORDER BY "ID"`, [倉庫, 名義])).rows as Rec[];
  const 名義名 = (await c.query(`SELECT "短縮名" FROM ${得意先マスタ} WHERE "短縮コード" = $1 LIMIT 1`, [名義])).rows[0]?.短縮名 ?? null;
  const 以下 = (a: unknown, b: unknown) => a != null && b != null && String(a).slice(0, 10) <= String(b).slice(0, 10);
  let 見つかった = false;
  let 今の設定: Rec | undefined = 設定[0];
  const 行: Rec[] = [];
  for (const r of 明細) {
    const id = n(r.在庫ID);
    const 入数 = n((await c.query(`SELECT "入数" FROM ${商品マスタ} WHERE "商品コード" = $1 LIMIT 1`, [n(r.商品コード)])).rows[0]?.入数);
    const 出 = (
      await c.query(
        `SELECT COALESCE((SELECT SUM("ケース") FROM ${倉庫の出荷} WHERE "在庫ID" = $1 AND "出荷日" <= $2::date), 0) + COALESCE((SELECT SUM("ケース") FROM ${倉庫の名変} WHERE "在庫No" = $1 AND "変更日" <= $2::date), 0) AS v`,
        [id, 終了],
      )
    ).rows[0].v;
    const ケース = n(出);
    const 買取 = await 買取単価コード(c, r.入庫後名義ID, r.商品コード, r.入庫日, r.製造日);
    // 支払区分：名義 150 は買取単価の年度、ほかは区分（タグ）。Access は区分が数でないと入らない（既定の 0 のまま）
    let 支払区分: number | null = 0;
    if (n(r.入庫後名義ID) === 150) 支払区分 = (await c.query(`SELECT "年度" FROM ${買取単価マスタ} WHERE "ID" = $1 LIMIT 1`, [買取])).rows[0]?.年度 ?? null;
    else if (r.タグ != null && /^-?\d+$/.test(String(r.タグ).trim())) 支払区分 = Number(r.タグ);
    const x: Rec = {
      在庫ID: id, 作成日付, 集計終了日: 終了, 出荷日: 終了, 倉庫ID: r.倉庫ID, 倉庫名: r.倉庫名, 入庫後名義ID: r.入庫後名義ID, 名義名, 商品コード: r.商品コード,
      商品名: n(r.商品区分) === 20 ? `${r.商品名 ?? ""}　(預かり品)` : r.商品名, 入数, 入庫日: r.入庫日, 製造日: r.製造日, 賞味期限: r.賞味期限, 入庫元数: r.入庫元数,
      ケース, 商品kg: ケース * 入数, 入庫No: r.入庫No, 買取単価コード: 買取, 支払区分, 期: 0, 集計月: 年月(開始), 在庫残数: n(r.入庫元数) - ケース,
      在庫残kg: (n(r.入庫元数) - ケース) * 入数, 名変区分: n(r.名変前在庫ID) !== 0 ? "名変" : null, タグ: r.タグ, chk: false, 税区分: 0,
    };
    // 料率の設定（その商品、なければ標準。契約入庫日の期間に入庫日が入るもの）
    const 合う = (s: Rec) => 以下(s.契約入庫日開始, r.入庫日) && 以下(r.入庫日, s.契約入庫日終了);
    const f = 設定.find((s) => n(s.商品コード) === n(r.商品コード) && 合う(s)) ?? 設定.find((s) => n(s.商品コード) === 0 && 合う(s));
    if (f) {
      見つかった = true;
      今の設定 = f;
    }
    const 合計 = await 費用の合計(c, id, 開始, 終了);
    if (!見つかった) {
      x.請求個数 = cint(n(r.ケース));
      x.請求kg = n(r.ケース) * 入数;
      x.当月入出庫料 = n(合計.入出庫料);
      x.当月保管料 = n(r.保管料) - n(r.サービス料);
      x.請求期 = n(r.請求期);
    } else {
      x.請求個数 = cint(n(合計.ケース));
      x.請求kg = x.請求個数 * 入数;
      x.当月入出庫料 = n(合計.入出庫料);
      x.サービス料 = n(合計.サービス料);
      x.当月保管料 = n(合計.保管料) - x.サービス料;
      x.請求期 = n(合計.請求期);
    }
    if (今の設定) {
      x.当月入出庫料 = 一桁目計算(小数点計算(x.当月入出庫料, n(今の設定.小数点区分)), n(今の設定.一桁目繰上));
      x.当月保管料 = 一桁目計算(小数点計算(x.当月保管料, n(今の設定.小数点区分)), n(今の設定.一桁目繰上));
    }
    x.当月入出庫料補正 = await 諸経費の合計(c, `"経費ID" = 32`, id, 開始, 終了);
    x.当月保管料補正 = await 諸経費の合計(c, `"経費ID" = 33`, id, 開始, 終了);
    x.当月入出庫料 += x.当月入出庫料補正;
    x.当月保管料 += x.当月保管料補正;
    x.荷役料 = cint(n(合計.その他費用));
    x.名変料 = cint(await 諸経費の合計(c, `"経費ID" = 4`, id, 開始, 終了));
    x.割増料 = cint(await 諸経費の合計(c, `"経費ID" = 14`, id, 開始, 終了));
    x.諸経費 = x.荷役料 + (await 諸経費の合計(c, `"経費ID" < 31`, id, 開始, 終了));
    行.push(x);
  }
  // 倉庫全体の諸経費
  const 全体 = (
    await c.query(
      `SELECT k.*, m."経費項目" FROM ${諸経費} k LEFT JOIN ${経費項目} m ON m."経費ID" = k."経費ID" WHERE k."倉庫ID" = $1 AND k."経費ID" < 31 AND k."在庫ID" = 0 AND k."集計月" = $2 ORDER BY k."ID"`,
      [倉庫, 年月(開始)],
    )
  ).rows as Rec[];
  for (const k of 全体)
    行.push({ 作成日付, 集計月: k.集計月, 倉庫ID: k.倉庫ID, 経費ID: k.経費ID, 入庫後名義ID: 名義, 商品名: k.備考 ? k.備考 : k.経費項目, 諸経費: n(k.諸経費), chk: false, 税区分: 0 });
  return 行;
}

/** 月末集計（C_月末集計）。保管料の明細を作り直し（必要なとき）、確定していない在庫の 倉庫×名義 ごとに集計して作業表に書く */
export async function 月末集計(c: PoolClient, 開始: string, 終了: string, 保管料を作り直す: boolean) {
  const 作成日付 = 日本の今().日付;
  await c.query(`DELETE FROM ${計算表}`);
  await c.query(`DELETE FROM ${t("soko_fe", "T_在庫計算表_参照用")}`);
  // Access と同じく、金額 0 の諸経費は消す
  await c.query(`DELETE FROM ${諸経費} WHERE "諸経費" = 0`);
  // 指定月の保管賃計算（C_指定月保管賃計算）：期間に在庫のあったロット（確定していないもの）の保管料の明細を作り直す
  let 作り直した = 0;
  if (保管料を作り直す) {
    const lots = (
      await c.query(
        `SELECT "在庫ID" FROM ${倉庫の在庫} WHERE "入庫日" <= $2::date AND ("最終出庫日" >= $1::date OR "最終出庫日" IS NULL) ORDER BY "在庫ID"`,
        [開始, 終了],
      )
    ).rows as Rec[];
    for (const l of lots) if (await 保管料の明細を作る(c, n(l.在庫ID))) 作り直した++;
    await c.query(`UPDATE ${倉庫のUSER} SET "保管賃集計日" = $1::date`, [終了]);
  }
  const 組 = (await c.query(`SELECT "倉庫ID", "入庫後名義ID" FROM ${倉庫の在庫} WHERE "確定フラグ" = false GROUP BY "倉庫ID", "入庫後名義ID" ORDER BY "倉庫ID", "入庫後名義ID"`)).rows as Rec[];
  let 件数 = 0;
  for (const g of 組) {
    const rows = await 倉庫名義別に集計する(c, 開始, 終了, n(g.倉庫ID), n(g.入庫後名義ID), 作成日付);
    for (const r of rows) {
      const k = Object.keys(r);
      await c.query(`INSERT INTO ${計算表} (${k.map((x) => `"${x}"`).join(", ")}) VALUES (${k.map((_, i) => `$${i + 1}`).join(", ")})`, k.map((x) => r[x]));
    }
    件数 += rows.length;
  }
  // 1192 は ﾆﾁﾚｲ 大谷地（164）の外貨として、税区分 1 にする（Access と同じ）
  await c.query(`UPDATE ${計算表} SET "倉庫ID" = 164, "倉庫名" = 'ﾆﾁﾚｲ　大谷地', "税区分" = 1 WHERE "倉庫ID" = 1192`);
  await c.query(`UPDATE ${倉庫のUSER} SET "集計終了日" = $1::date`, [作成日付]);
  return { 件数, 作り直した };
}

export function sokoSeikyuRoutes(app: FastifyInstance) {
  app.addHook("preHandler", requireUser);

  // 画面の選択肢：倉庫（在庫のある冷蔵庫）・名義・帳票の一覧（オブジェクト一覧の 倉庫 の帳票）と、前回の集計日
  app.get("/api/soko/seikyu/opts", async () => ({
    倉庫: await q(`SELECT z."倉庫ID" AS id, MIN(m."短縮名") AS name FROM ${倉庫の在庫} z LEFT JOIN ${得意先マスタ} m ON m."短縮コード" = z."倉庫ID" GROUP BY z."倉庫ID" ORDER BY z."倉庫ID"`),
    名義: await q(`SELECT z."入庫後名義ID" AS id, MIN(m."短縮名") AS name FROM ${倉庫の在庫} z LEFT JOIN ${得意先マスタ} m ON m."短縮コード" = z."入庫後名義ID" GROUP BY z."入庫後名義ID" ORDER BY z."入庫後名義ID"`),
    帳票: await q(`SELECT "オブジェクト名" AS id, "名称" AS name, "処理区分", "備考" FROM ${オブジェクト一覧} WHERE "テーブル" = '倉庫' AND COALESCE("非表示", false) = false ORDER BY "ID"`),
    USER: (await q(`SELECT "保管賃集計日"::date::text AS "保管賃集計日", "集計終了日"::date::text AS "集計終了日" FROM ${倉庫のUSER} LIMIT 1`))[0] ?? {},
  }));

  // 月末集計。保管賃集計日が終了日以後なら、保管料の明細を作り直すか画面で聞く（再計算）
  app.post<{ Body: { 開始: string; 終了: string; 再計算?: boolean } }>("/api/soko/seikyu/shukei", async (req, reply) => {
    const { 開始, 終了 } = req.body;
    if (!日付か(開始) || !日付か(終了)) return reply.code(400).send({ error: "期間が正しくありません" });
    return 一連で(async (c) => {
      const 前回 = (await c.query(`SELECT "保管賃集計日"::date::text AS v FROM ${倉庫のUSER} LIMIT 1`)).rows[0]?.v ?? null;
      const 作り直す = !(前回 && 前回 >= 終了) || req.body.再計算 === true;
      return 月末集計(c, 開始, 終了, 作り直す);
    });
  });

  // 在庫証明書（R_在庫証明書）：在庫のロット（在庫ケースのあるもの）。Access の帳票の元は「名義 1261 の在庫」に決め打ちで、そこへ画面の倉庫・名義の絞り込みを
  // 重ねていた（1261 は今は在庫が無く、白紙になる）。Web 版は、名義を選んだときはその名義、選ばないときは Access と同じ 1261 にする
  app.get<{ Querystring: { soko?: string; meigi?: string } }>("/api/soko/seikyu/shomei", async (req) =>
    q(
      `SELECT z."在庫ID", z."倉庫ID", z."倉庫名", z."入庫日"::date::text AS "入庫日", z."入庫No", z."商品コード", z."商品名", z."入数", z."製造日"::date::text AS "製造日",
              z."賞味期限"::date::text AS "賞味期限", z."在庫ケース", z."在庫kg", z."入庫後名義ID",
              (SELECT "得意先名" FROM ${得意先マスタ} m WHERE m."短縮コード" = z."入庫後名義ID" LIMIT 1) AS "名義正式名",
              (SELECT "得意先名" FROM ${得意先マスタ} m WHERE m."短縮コード" = z."倉庫ID" LIMIT 1) AS "倉庫正式名"
       FROM ${t("soko", "TD_在庫")} z
       WHERE z."在庫ケース" <> 0 AND z."入庫後名義ID" = $1 AND ($2::int = 0 OR z."倉庫ID" = $2::int)
       ORDER BY z."倉庫ID", z."入庫日", z."商品コード", z."入庫No"`,
      [n(req.query.meigi) || 1261, n(req.query.soko)],
    ),
  );

  // 作業表の中身（帳票・チェック画面）。倉庫・名義で絞る（Access の帳票は パブリックコード で絞る）
  app.get<{ Querystring: { soko?: string; meigi?: string } }>("/api/soko/seikyu/rows", async (req) => {
    const a: unknown[] = [];
    const w: string[] = [];
    if (n(req.query.soko)) {
      a.push(n(req.query.soko));
      w.push(`"倉庫ID" = $${a.length}`);
    }
    if (n(req.query.meigi)) {
      a.push(n(req.query.meigi));
      w.push(`"入庫後名義ID" = $${a.length}`);
    }
    return q(
      `SELECT *, "入庫日"::date::text AS "入庫日", "製造日"::date::text AS "製造日", "賞味期限"::date::text AS "賞味期限", "集計終了日"::date::text AS "集計終了日",
              (SELECT "短縮名" FROM ${得意先マスタ} m WHERE m."短縮コード" = x."倉庫ID" LIMIT 1) AS "倉庫短縮名",
              (SELECT "短縮名" FROM ${得意先マスタ} m WHERE m."短縮コード" = x."入庫後名義ID" LIMIT 1) AS "名義短縮名",
              (SELECT "得意先名" FROM ${得意先マスタ} m WHERE m."短縮コード" = x."倉庫ID" LIMIT 1) AS "倉庫得意先名",
              (SELECT "得意先名" FROM ${得意先マスタ} m WHERE m."短縮コード" = x."入庫後名義ID" LIMIT 1) AS "名義得意先名"
       FROM ${計算表} x ${w.length ? "WHERE " + w.join(" AND ") : ""}
       ORDER BY x."倉庫ID", x."入庫後名義ID", x."在庫ID" IS NULL, x."入庫日", x."入庫No", x."在庫ID"`,
      a,
    );
  });
  // チェック画面の Excel
  app.get("/api/soko/seikyu/excel", async (req, reply) => {
    const rows = await q(`SELECT * FROM ${計算表} ORDER BY "倉庫ID", "入庫後名義ID", "在庫ID"`);
    const 列 = [
      "集計月", "倉庫ID", "倉庫名", "入庫後名義ID", "名義名", "在庫ID", "入庫No", "商品コード", "商品名", "入庫日", "賞味期限", "入庫元数", "ケース", "在庫残数", "請求期",
      "請求個数", "請求kg", "当月入出庫料", "当月保管料", "荷役料", "名変料", "割増料", "諸経費", "税区分",
    ].map((key) => ({ key, width: key === "商品名" || key === "倉庫名" ? 24 : 11, date: ["入庫日", "賞味期限"].includes(key) }));
    const buf = await 一覧のExcel("在庫計算表", 列, rows);
    reply
      .header("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
      .header("Content-Disposition", `attachment; filename*=UTF-8''${encodeURIComponent("保管賃チェック.xlsx")}`);
    return reply.send(buf);
  });
}
