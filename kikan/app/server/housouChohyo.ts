import type { FastifyInstance } from "fastify";
import type { PoolClient } from "pg";
import { t, 日本の今 } from "./db.js";
import { requireUser } from "./auth.js";
import { 一連で } from "./ws.js";
import { cint } from "./hanmori.js";

// 包装場管理System の帳票（いただいた見本〈2026/10/27〉の形）。
// F_包装管理日誌：包装予定表（R_生産計画予定表ver2）・製造分割予定表（R_製造計画分割予定表）・包装日誌（R_包装日誌）・数量チェック表（R_包装数量チェック表）
// F_包装札作成の［印刷］：パレット票（R_包装札）・区分表示（R_包装札(在庫)）・仕掛原料管理札（R_仕掛原料管理札新Ver）・
//   ロボットパレット引き出し確認表（R_包装連絡表_Robot確認ver2）・包装連絡表（R_包装連絡表）
// Access は作業用の表（T_生産計画予定表ver2・T_包装札作成）に写してからレポートで集めるが、ここでは同じ決まりでその場で集める。
const 入庫 = t("seizo", "TD_入庫");
const 商品マスタ = t("kyotsu", "TM_商品マスタ");
const 出荷 = t("ws", "TD_出荷");
const 在庫 = t("ws", "TD_在庫");
const 輸送計画 = t("ws", "TD_輸送計画");
const ロボット設定 = t("housou", "TD_ロボットPrgNo_製造別");
const 予定 = t("housou", "TD_予定");
const 札色 = t("housou_fe", "TM_札色設定");
const ハイ積み = t("housou_fe", "TM_ハイ積みマスタ");
const 原料 = t("housou_fe", "TM_原料マスタ");
const 人員 = t("housou_fe", "TM_人員");
const 包装時間 = t("housou_fe", "TM_包装時間");

type Rec = Record<string, any>;
const n = (v: unknown) => Number(v ?? 0) || 0;
const 日を足す = (d: string, k: number) => new Date(Date.parse(d + "T00:00:00Z") + k * 86400000).toISOString().slice(0, 10);
const 日付か = (v: unknown) => /^\d{4}-\d{2}-\d{2}$/.test(String(v ?? ""));

/** 札の色（入庫の 札の色、なければ カードカラーコード を札色設定で読む） */
async function 札色の表(c: PoolClient): Promise<Map<number, string>> {
  return new Map((await c.query(`SELECT "ID", "札の色" FROM ${札色}`)).rows.map((r: Rec) => [n(r.ID), String(r.札の色 ?? "").trim()]));
}
const 色の名 = (r: Rec, 表: Map<number, string>) => (r.札の色 ? String(r.札の色) : 表.get(n(r.カードカラーコード)) ?? "");
const カードNo = (r: Rec) => (n(r.開始No) || n(r.終了No) ? `${n(r.開始No)}-${n(r.終了No)}` : "");

/** その日の申し送り（TD_予定 の 備考。完了していないもの） */
async function 申し送り(c: PoolClient, 日: string): Promise<string[]> {
  return (await c.query(`SELECT "備考" FROM ${予定} WHERE "日付"::date = $1::date AND "完了チェック" = false AND COALESCE("区分", 0) <> 12 ORDER BY "ID"`, [日])).rows
    .map((r: Rec) => String(r.備考 ?? "").trim())
    .filter((x) => x);
}

/**
 * 包装予定表（C_生産計画表作成ver2 ＋ C_予定追加 → R_生産計画予定表ver2）。指定日から 45 日の工場（倉庫 11）の入庫を、包装日ごとに出す。
 * 1 行は 製造日・商品 ごと：品番（DB品番）・ケース・P数＝(ケース＋20)÷パレット単位1・分＝ケース×包装時間の平均（ケース_秒）÷60・
 * 当日＝その日の同じ製造日の出荷・ﾁﾚｲP＝ニチレイ大谷地（164）行き・kg・冷凍パン＝ケース×規格枚数÷冷凍パン入数。
 * 予定（TD_予定）は、その日の予定のない行に順に入れ、余れば予定だけの行にする（入庫のない日も予定があれば出す）。区分 12 は出勤時間。
 */
async function 包装予定表(c: PoolClient, 日: string) {
  const 終 = 日を足す(日, 45);
  const rows = (
    await c.query(
      `SELECT i."入庫日"::date::text AS "入庫日", i."製造日"::date::text AS "製造日", i."商品コード", MAX(m."商品名") AS "商品名",
              SUM(i."ケース") AS "ケース", SUM(i."商品kg") AS "商品kg", MAX(m."DB品番CD") AS "品番", MAX(m."規格枚数") AS "規格枚数",
              MAX(m."冷凍パン入数") AS "冷凍パン入数", MAX(m."パレット単位1") AS "パレット単位1", MAX(m."グループ商品コード") AS "グループ"
       FROM ${入庫} i LEFT JOIN ${商品マスタ} m ON m."商品コード" = i."商品コード"
       WHERE i."倉庫ID" = 11 AND i."入庫日" BETWEEN $1::date AND $2::date
       GROUP BY i."入庫日", i."製造日", i."賞味期限", i."商品コード"`,
      [日, 終],
    )
  ).rows as Rec[];
  const 秒 = new Map(
    (await c.query(`SELECT "商品コード", AVG("ケース_秒") AS v FROM ${包装時間} GROUP BY "商品コード"`)).rows.map((r: Rec) => [n(r.商品コード), Number(r.v ?? 0)]),
  );
  const 日の組 = new Map<string, Rec[]>();
  for (const r of rows) {
    const ケース = n(r.ケース);
    const 出 = async (届け先: boolean) =>
      n(
        (
          await c.query(
            `SELECT SUM("ケース") AS v FROM ${出荷} WHERE "商品コード" = $1 AND "製造日"::date = $2::date ${届け先 ? `AND "届け先コード" = 164` : `AND "出荷日"::date = $3::date`}`,
            届け先 ? [r.商品コード, r.製造日] : [r.商品コード, r.製造日, r.入庫日],
          )
        ).rows[0].v,
      );
    const v: Rec = {
      入庫日: r.入庫日, 製造日: r.製造日, 商品コード: r.商品コード, 商品名: r.商品名, 品番: r.品番 ?? "", 商品kg: Number(r.商品kg ?? 0),
      ケース: n(r.商品コード) === 736 ? ケース * 2 : ケース, // 生姜おろし 300g は 2 倍（Access と同じ）
      P数: n(r.パレット単位1) ? (ケース + 20) / n(r.パレット単位1) : null,
      分: 秒.has(n(r.グループ)) ? (ケース * (秒.get(n(r.グループ)) ?? 0)) / 60 : 0,
      当日: await 出(false), ﾁﾚｲP: await 出(true),
      冷凍パン: n(r.冷凍パン入数) ? (ケース * n(r.規格枚数)) / n(r.冷凍パン入数) : 0,
      備考: null as string | null,
    };
    if (!日の組.has(r.入庫日)) 日の組.set(r.入庫日, []);
    日の組.get(r.入庫日)!.push(v);
  }
  // 予定（区分 12 は出勤時間、ほかは備考）
  const 予定たち = (
    await c.query(
      `SELECT "日付"::date::text AS "日付", "開始時間", "区分", "備考" FROM ${予定} WHERE "完了チェック" = false AND "日付"::date BETWEEN $1::date AND $2::date ORDER BY "日付", "ID"`,
      [日, 終],
    )
  ).rows as Rec[];
  const 出勤 = new Map<string, string>();
  for (const y of 予定たち) {
    // 出勤時間（区分 12）は入庫のある日だけ（Access は入庫のない日には入庫日が空の行を作るので出ない）。ほかの予定は入庫がなくても出す
    if (n(y.区分) !== 12 && !日の組.has(y.日付)) 日の組.set(y.日付, []);
    const 組 = 日の組.get(y.日付);
    if (!組) continue;
    if (n(y.区分) === 12) {
      if (y.開始時間) {
        const s = String(y.開始時間);
        const m = s.match(/(\d{1,2}):(\d{2})/);
        if (m) 出勤.set(y.日付, `${Number(m[1])}:${m[2]}出勤`);
      }
      continue;
    }
    const 空き = [...組].sort((a, b) => b.商品kg - a.商品kg).find((r) => r.備考 == null && r.商品コード != null);
    if (空き) 空き.備考 = y.備考 ?? "";
    else 組.push({ 入庫日: y.日付, 商品名: "", 備考: y.備考 ?? "", 分: 0 });
  }
  const 日々 = [...日の組.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([入庫日, 行]) => {
      const 品 = 行.filter((r) => r.商品コード != null).sort((a, b) => b.商品kg - a.商品kg);
      const 予定だけ = 行.filter((r) => r.商品コード == null);
      return {
        入庫日, 出勤: 出勤.get(入庫日) ?? "", 行: [...品, ...予定だけ],
        冷凍パン: Math.round(品.reduce((a, r) => a + r.冷凍パン, 0)), 分計: Math.round(行.reduce((a, r) => a + n(r.分), 0)),
      };
    });
  return { 日, 印刷日: 日本の今().日付, 日々 };
}

/**
 * 製造分割予定表（R_製造計画分割予定表）。製造日の工場の入庫（グループ商品コード 746 を除く）を商品ごとに 1 つの枠にし、
 * 区分（タグ）ごとに希望kg。上に 計画 総枚数（ケース×規格枚数）・計画 総ケース・kg の合計・工場（作業場）。並びは 工場・現場ID（見本から）。
 */
async function 製造分割予定表(c: PoolClient, 日: string) {
  const rows = (
    await c.query(
      `SELECT i."商品コード", i."商品名", i."タグ", i."ケース", i."商品kg", i."作業場", m."規格枚数", m."現場ID", i."入庫ID"
       FROM ${入庫} i LEFT JOIN ${商品マスタ} m ON m."商品コード" = i."商品コード"
       WHERE i."倉庫ID" = 11 AND COALESCE(m."グループ商品コード", 0) <> 746 AND i."製造日"::date = $1::date
       ORDER BY i."作業場", m."現場ID", i."商品コード", i."タグ", i."入庫ID"`,
      [日],
    )
  ).rows as Rec[];
  const 組 = new Map<string, Rec[]>();
  for (const r of rows) {
    const k = String(r.商品コード);
    if (!組.has(k)) 組.set(k, []);
    組.get(k)!.push(r);
  }
  return {
    日, 印刷日時: 日本の今().日時,
    品: [...組.values()].map((g) => ({
      商品名: g[0].商品名, 工場: g[0].作業場 ?? "", kg: g.reduce((a, r) => a + Number(r.商品kg ?? 0), 0),
      総枚数: g.reduce((a, r) => a + n(r.ケース) * n(r.規格枚数), 0), 総ケース: g.reduce((a, r) => a + n(r.ケース), 0),
      行: g.map((r) => ({ 区分: r.タグ ?? "", 希望kg: Number(r.商品kg ?? 0) })),
    })),
  };
}

/** 包装日誌（R_包装日誌）。包装日の工場（倉庫 1・11）の入庫を 商品・製造日・賞味期限 ごとに 1 枚。ロットの印字は商品のロット表示区分で「印字なし」 */
async function 包装日誌(c: PoolClient, 日: string) {
  const rows = (
    await c.query(
      `SELECT i."商品コード", i."商品名", i."製造日"::date::text AS "製造日", i."賞味期限"::date::text AS "賞味期限",
              MAX(m."品質保持期間") AS "品質保持期間", MAX(m."ロット表示区分") AS "ロット表示区分"
       FROM ${入庫} i LEFT JOIN ${商品マスタ} m ON m."商品コード" = i."商品コード"
       WHERE i."入庫日"::date = $1::date AND i."倉庫ID" IN (1, 11) AND i."商品コード" <> 746 AND COALESCE(i."検体区分", false) = false
       GROUP BY i."商品コード", i."商品名", i."製造日", i."賞味期限"
       ORDER BY MIN(i."包装順"), i."商品コード", i."製造日"`,
      [日],
    )
  ).rows as Rec[];
  const ロット = (v: string | null) => (v ? `${v.slice(2, 4)}.${v.slice(5, 7)}.${v.slice(8, 10)}` : "");
  return {
    日,
    枚: rows.map((r) => {
      // 期限 ○ 年 ○ ｶ月（品質保持期間〈年〉から。ロット表示区分 1 は出さない）
      const 月数 = Math.round(Number(r.品質保持期間 ?? 0) * 12);
      const 年 = Math.floor(月数 / 12);
      const 月 = 月数 - 年 * 12;
      return {
        商品名: r.商品名, 製造ロット: n(r.ロット表示区分) === 2 ? "印字なし" : ロット(r.製造日), 賞味ロット: n(r.ロット表示区分) === 1 ? "印字なし" : ロット(r.賞味期限),
        製造日: r.製造日, 期限: n(r.ロット表示区分) === 1 ? "期限 " : `期限 ${年} 年 ${月 ? `${月} ｶ月` : ""}`.trim(),
      };
    }),
  };
}

/**
 * 包装 数量チェック表（R_包装数量チェック表）。包装日の工場（倉庫 11）のまだ登録していない入庫（未包装時ID 0）を
 * 商品・製造日・賞味期限・段数・作業場 ごとに 1 枚。計量予定数＝計量元数の合計、予定ケース＝ケースの合計。
 * 右の人の名前は人員の表（実習生を除く）から出す（Access はレポートに書いてあった）。
 */
async function 数量チェック表(c: PoolClient, 日: string) {
  const rows = (
    await c.query(
      `SELECT i."商品コード", i."商品名", i."製造日"::date::text AS "製造日", i."賞味期限"::date::text AS "賞味期限", i."段数", i."作業場",
              SUM(i."ケース") AS "ケース", SUM(i."計量元数") AS "計量元数", MIN(i."包装順") AS "包装順"
       FROM ${入庫} i
       WHERE i."入庫日"::date = $1::date AND i."倉庫ID" = 11 AND COALESCE(i.chk, false) = false AND COALESCE(i."未包装時ID", 0) = 0
       GROUP BY i."商品コード", i."商品名", i."製造日", i."賞味期限", i."段数", i."作業場"
       ORDER BY MIN(i."包装順"), i."商品コード", i."製造日"`,
      [日],
    )
  ).rows as Rec[];
  const 人 = (await c.query(`SELECT "人員" FROM ${人員} WHERE COALESCE("区分", '') <> '実習生' ORDER BY "ID"`)).rows.map((r: Rec) => String(r.人員 ?? ""));
  return {
    日, 人,
    枚: rows.map((r) => ({ 商品名: r.商品名, 製造日: r.製造日, 賞味期限: r.賞味期限, 段数: n(r.段数), 計量予定数: n(r.計量元数), 予定ケース: n(r.ケース), 包装順: r.包装順 ?? "" })),
  };
}

/** その日のパレット（C_包装札作成ver2）：入庫ごとに、ケースを積み付け数で分けた 1 枚ずつ（積み付け数が 0 なら 1 枚で全部） */
async function パレットたち(c: PoolClient, 日: string): Promise<Rec[]> {
  const rows = (
    await c.query(
      `SELECT i.*, i."製造日"::date::text AS "製造日", i."入庫日"::date::text AS "入庫日", r."使用パレット", r."積み付け数", r."ロボットPrgNo" AS "ロボットNo", r."積み付け備考"
       FROM ${入庫} i LEFT JOIN ${ロボット設定} r ON r."入庫ID" = i."入庫ID"
       WHERE i."入庫日"::date = $1::date AND i."倉庫ID" = 11
       ORDER BY i."包装順", i."商品コード", i."製造日", i."タグ", i."入庫ID", i."検査区分"`,
      [日],
    )
  ).rows as Rec[];
  const out: Rec[] = [];
  for (const r of rows) {
    const 単位 = n(r.積み付け数);
    let 残 = n(r.ケース);
    let No = 0;
    while (残 > 0) {
      No++;
      const 数 = 単位 === 0 || 残 < 単位 ? 残 : 単位;
      out.push({ 入庫: r, No, ケース: 数 });
      if (単位 === 0) break;
      残 -= 単位;
    }
  }
  return out;
}

/** パレット票（R_包装札）。パレット 1 枚に 1 票（A5 で 2 つずつ） */
async function パレット票(c: PoolClient, 日: string) {
  const 色 = await 札色の表(c);
  return {
    日,
    票: (await パレットたち(c, 日)).map(({ 入庫: r, No, ケース }) => ({
      入庫日: r.入庫日, No, 区分: r.タグ ?? "", 品名: r.商品名, 製造日: r.製造日, パレット: r.パレット名 ?? "", 数量: ケース, 札色: 色の名(r, 色), 区分No: カードNo(r),
      備考: r.商品コード, 出荷停止: n(r.商品区分) === 5 ? "出荷停止!" : "",
    })),
  };
}

/**
 * ロボットパレット引き出し確認表（R_包装連絡表_Robot確認ver2）。入庫ごとに 1 行：品名・区分とケース・積み付け備考（「○ 個 (N)」）・
 * ロボットNo・使用パレット・積数、右にパレットごとのケース（1〜14 枚目）。
 */
async function ロボット確認表(c: PoolClient, 日: string) {
  const p = await パレットたち(c, 日);
  const 行 = new Map<number, Rec>();
  for (const { 入庫: r, No, ケース } of p) {
    if (!行.has(n(r.入庫ID)))
      行.set(n(r.入庫ID), {
        商品コード: r.商品コード, 品名: r.商品名, 区分: r.タグ ?? "", ケース: n(r.ケース), 備考: r.積み付け備考 ?? "", ロボットNo: r.ロボットNo ?? "",
        使用パレット: r.使用パレット ?? "", 積数: r.積み付け数 ?? "", パレット: [] as number[],
      });
    行.get(n(r.入庫ID))!.パレット[No - 1] = ケース;
  }
  return { 日, 申し送り: [] as string[], 行: [...行.values()] };
}

/**
 * 包装連絡表（R_包装連絡表）。包装日の工場（倉庫 11）の入庫ごとに 1 行：品名・区分・札色・カードNo・計量枚数（計量元数）・ケース・
 * 端数（仕掛枚数）・パレット数＝ケース÷総数（切り捨て）・総段数＝ケース÷ハイ（切り捨て）と半端＝ケース−総段数×ハイ（ハイ積みマスタ）。
 * 上に申し送り（その日の予定）。
 */
async function 包装連絡表(c: PoolClient, 日: string) {
  const 色 = await 札色の表(c);
  const rows = (
    await c.query(
      `SELECT i.*, h."総数", h."ハイ"
       FROM ${入庫} i LEFT JOIN ${商品マスタ} m ON m."商品コード" = i."商品コード" LEFT JOIN ${ハイ積み} h ON h."ハイ積みID" = m."パレットID"
       WHERE i."入庫日"::date = $1::date AND i."倉庫ID" = 11
       ORDER BY i."包装順", i."商品コード", i."製造日", i."タグ", i."入庫ID"`,
      [日],
    )
  ).rows as Rec[];
  return {
    日, 申し送り: await 申し送り(c, 日),
    行: rows.map((r) => {
      const ケース = n(r.ケース);
      const 段 = n(r.ハイ) ? Math.floor(ケース / n(r.ハイ)) : null;
      return {
        商品コード: r.商品コード, 品名: r.商品名, 区分: r.タグ ?? "", 札色: 色の名(r, 色), カードNo: カードNo(r), 計量枚数: n(r.計量元数), ケース, 端数: n(r.仕掛枚数),
        パレット数: n(r.総数) ? Math.trunc(ケース / n(r.総数)) : null, 総段数: 段, 半端: 段 == null ? null : ケース - 段 * n(r.ハイ),
      };
    }),
  };
}

/**
 * 区分表示（R_包装札(在庫)）。工場（倉庫 11）の在庫のうち、その日のまだ登録していない出荷（運送会社 8 を除く）で一部だけ出て残りがあるロットに 1 枚。
 * 区分（タグ）・品名・製造日。分類 1〜3 のみ。
 */
async function 区分表示(c: PoolClient, 日: string) {
  const rows = (
    await c.query(
      `SELECT z."商品名", z."タグ", z."製造日"::date::text AS "製造日", z."在庫ケース" - SUM(s."ケース") AS "残数"
       FROM ${出荷} s JOIN ${輸送計画} p ON p."輸送ID" = s."輸送ID" JOIN ${在庫} z ON z."入庫ID" = s."入庫ID"
       WHERE z."在庫ケース" <> 0 AND s.chk = false AND p."運送会社ID" <> 8 AND s."出荷日"::date = $1::date
         AND z."倉庫ID" = 11 AND z."分類ID" IN (1, 2, 3) AND COALESCE(z."入庫ID", 0) <> 0
       GROUP BY z."在庫ID", z."商品名", z."タグ", z."製造日", z."在庫ケース"
       HAVING z."在庫ケース" - SUM(s."ケース") <> 0
       ORDER BY z."商品名", z."製造日", z."タグ"`,
      [日],
    )
  ).rows as Rec[];
  return { 日, 札: rows.map((r) => ({ 区分: r.タグ ?? "", 品名: r.商品名, 製造日: r.製造日 })) };
}

/**
 * 製品 在庫確認表（R_在庫チェック表）。工場（倉庫 11）の在庫ケースがある行（商品 697 のサンプルを除く）。
 * コード・商品名・製造日・規格・在庫ケース・区分（タグ）・備考（管理備考・備考在庫）。並びは在庫の登録順（見本 2026/10/31 に近い順）。
 */
async function 在庫確認表(c: PoolClient, 日: string) {
  const rows = (
    await c.query(
      `SELECT "商品コード", "商品名", "製造日"::date::text AS "製造日", "賞味期限"::date::text AS "賞味期限", "規格", "在庫ケース", "タグ", "管理備考", "備考在庫"
       FROM ${在庫} WHERE "倉庫ID" = 11 AND "商品コード" <> 697 AND "在庫ケース" <> 0 ORDER BY "在庫ID"`,
    )
  ).rows as Rec[];
  return {
    日,
    行: rows.map((r) => ({
      コード: r.商品コード, 品名: r.商品名, 製造日: r.製造日, 賞味期限: r.賞味期限, 規格: r.規格 ?? "", ケース: n(r.在庫ケース), 区分: r.タグ ?? "",
      備考: [r.管理備考, r.備考在庫].filter((x) => String(x ?? "").trim()).join("\n"),
    })),
  };
}

/** 品質管理サンプル在庫表（R_サンプル在庫チェック表）。商品 697（サンプル）の在庫ケースがある行：商品名・規格・ケース・kg */
async function サンプル在庫表(c: PoolClient, 日: string) {
  const rows = (
    await c.query(
      `SELECT "商品名", "規格", "在庫ケース", "在庫kg" FROM ${在庫} WHERE "商品コード" = 697 AND "在庫ケース" <> 0 ORDER BY "倉庫ID", "商品コード", "製造日", "在庫ID"`,
    )
  ).rows as Rec[];
  return { 日, 行: rows.map((r) => ({ 品名: r.商品名, 規格: r.規格 ?? "", ケース: n(r.在庫ケース), kg: Number(r.在庫kg ?? 0) })) };
}

/**
 * ふらの製造パレット割り振り予定表（R_ふらのパレット確認表・C_ふらのパレット管理表作成）。
 * ふらの工場（倉庫 191）の製造（商品 77 を除く）を、製造日が その日〜14 日後 の分だけ 1 行ずつ。予定数＝ケース。
 * 大谷地・十勝は、同じ商品・製造日の出荷（届け先 164、十勝は 1221 と 1023）のケース。どちらも 0 のとき、商品 155・84 は全部を大谷地、17・1367 は全部を十勝にする。
 * パレット＝行き先のケース ÷ 積み付け数（商品マスタのパレット単位2。Access の整数の欄なので .5 は偶数へ丸める）。
 */
async function ふらのパレット(c: PoolClient, 日: string) {
  const rows = (
    await c.query(
      `SELECT i."製造日"::date::text AS "製造日", i."商品コード", i."商品名", i."ケース", COALESCE(m."パレット単位2", 0) AS "積み付け数",
              (SELECT COALESCE(SUM(s."ケース"), 0) FROM ${出荷} s WHERE s."商品コード" = i."商品コード" AND s."届け先コード" = 164 AND s."製造日"::date = i."製造日"::date)::float8 AS "大谷地",
              (SELECT COALESCE(SUM(s."ケース"), 0) FROM ${出荷} s WHERE s."商品コード" = i."商品コード" AND s."届け先コード" IN (1221, 1023) AND s."製造日"::date = i."製造日"::date)::float8 AS "十勝"
       FROM ${入庫} i LEFT JOIN ${商品マスタ} m ON m."商品コード" = i."商品コード"
       WHERE i."商品コード" <> 77 AND i."倉庫ID" = 191 AND i."製造日"::date BETWEEN $1::date AND $1::date + 14 AND i."入庫日"::date >= $1::date
       ORDER BY i."製造日", i."入庫ID"`,
      [日],
    )
  ).rows as Rec[];
  const 行 = rows.map((r) => {
    let 大谷地 = n(r.大谷地);
    let 十勝 = n(r.十勝);
    const code = n(r.商品コード);
    if (!大谷地 && !十勝 && (code === 155 || code === 84)) 大谷地 = n(r.ケース);
    else if (!大谷地 && !十勝 && (code === 17 || code === 1367)) 十勝 = n(r.ケース);
    const 単位 = n(r.積み付け数);
    return {
      製造日: r.製造日, コード: code, 品名: r.商品名, 予定数: n(r.ケース), 大谷地, 十勝,
      大谷地P: 単位 && 大谷地 ? cint(大谷地 / 単位) : null, 十勝P: 単位 && 十勝 ? cint(十勝 / 単位) : null,
    };
  });
  return { 日, 行 };
}

/**
 * HBミックスセット日誌（箱詰日誌。R_HBミックスセット日誌）。包装日誌印刷のとき、その日の入庫のうちグループ商品コード 746 の行ごとに 1 枚。
 * 商品名・箱詰作業日（入庫日）・賞味期限（入庫の賞味期限。なければ箱詰日の 1 年後）。ほかの欄は手書き（見本 2026/10/31）。
 */
async function HB日誌(c: PoolClient, 日: string) {
  const rows = (
    await c.query(
      `SELECT i."商品名", i."入庫日"::date::text AS "入庫日", COALESCE(i."賞味期限"::date, i."入庫日"::date + interval '1 year')::date::text AS "賞味期限"
       FROM ${入庫} i LEFT JOIN ${商品マスタ} m ON m."商品コード" = i."商品コード"
       WHERE m."グループ商品コード" = 746 AND i."入庫日"::date = $1::date ORDER BY i."入庫ID"`,
      [日],
    )
  ).rows as Rec[];
  const 社名 = (await c.query(`SELECT "社名" FROM app."帳票_差出人" WHERE "区分" = '丸北北海道'`)).rows[0]?.社名 ?? "";
  return { 日, 社名, 枚: rows };
}

/**
 * 大谷地回送用積み込み札（R_大谷地回送用積み込み札）。その日のパレットのうち、使用パレットが (N)（ニチレイ大谷地へ回送）のものに 1 枚ずつ。
 * 区分（タグ）・品名・製造日（区分表示と同じ形。2026/10/31 いただいた見本）。Access は (N) のパレットがあるときだけ出す。
 */
async function 大谷地札(c: PoolClient, 日: string) {
  const p = (await パレットたち(c, 日)).filter(({ 入庫: r }) => r.使用パレット === "(N)");
  return { 日, 札: p.map(({ 入庫: r }) => ({ 区分: r.タグ ?? "", 品名: r.商品名, 製造日: r.製造日 })) };
}

/**
 * 仕掛原料管理札（R_仕掛原料管理札新Ver）。包装日の工場の入庫を 商品・製造日・作業場 ごとに 1 枚（4 枚ずつ同じものを並べる）。
 * コード・作業場（1工場＝そてー工場、2工場＝ペースト工場）・原料・商品名・製造日、残数・区分・記載者は手書き。
 */
async function 仕掛札(c: PoolClient, 日: string, 作業場?: string) {
  const rows = (
    await c.query(
      `SELECT i."商品コード", i."商品名", i."製造日"::date::text AS "製造日", i."作業場", MAX(m."分類ID") AS "分類ID", MAX(g."原料分類") AS "原料"
       FROM ${入庫} i LEFT JOIN ${商品マスタ} m ON m."商品コード" = i."商品コード" LEFT JOIN ${原料} g ON g."原料分類ID" = m."原料コード"
       WHERE i."入庫日"::date = $1::date AND i."倉庫ID" = 11 AND i."商品コード" <> 746 ${作業場 ? `AND i."作業場" = $2` : ""}
       GROUP BY i."商品コード", i."商品名", i."製造日", i."作業場"
       ORDER BY i."作業場", i."商品コード", i."製造日"`,
      作業場 ? [日, 作業場] : [日],
    )
  ).rows as Rec[];
  return {
    日,
    札: rows.map((r) => ({
      コード: r.商品コード, 品名: r.商品名, 製造日: r.製造日, 原料: r.原料 ?? "",
      工場: r.作業場 === "1工場" ? "そてー工場" : r.作業場 === "2工場" ? "ペースト工場" : r.作業場 ?? "", 水色: n(r.分類ID) === 1,
    })),
  };
}

export function housouChohyoRoutes(app: FastifyInstance) {
  app.addHook("preHandler", requireUser);
  const 種類: Record<string, (c: PoolClient, 日: string, q: Rec) => Promise<unknown>> = {
    yotei: (c, d) => 包装予定表(c, d),
    bunkatsu: (c, d) => 製造分割予定表(c, d),
    nisshi: (c, d) => 包装日誌(c, d),
    check: (c, d) => 数量チェック表(c, d),
    pallet: (c, d) => パレット票(c, d),
    kubun: (c, d) => 区分表示(c, d),
    oyachi: (c, d) => 大谷地札(c, d),
    zaiko: (c, d) => 在庫確認表(c, d),
    furano: (c, d) => ふらのパレット(c, d),
    hb: (c, d) => HB日誌(c, d),
    sample: (c, d) => サンプル在庫表(c, d),
    shikake: (c, d, q) => 仕掛札(c, d, q.sagyo || undefined),
    robot: (c, d) => ロボット確認表(c, d),
    renraku: (c, d) => 包装連絡表(c, d),
  };
  app.get<{ Params: { kind: string }; Querystring: { date: string; sagyo?: string } }>("/api/housou/chohyo/:kind", async (req, reply) => {
    const f = 種類[req.params.kind];
    if (!f) return reply.code(404).send({ error: "この帳票はありません" });
    if (!日付か(req.query.date)) return reply.code(400).send({ error: "日付が正しくありません" });
    return 一連で((c) => f(c, req.query.date, req.query));
  });
}
