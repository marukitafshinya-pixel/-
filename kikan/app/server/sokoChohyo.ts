import type { FastifyInstance } from "fastify";
import type { PoolClient } from "pg";
import { pool, t, 日本の今 } from "./db.js";
import { requireUser } from "./auth.js";
import { 一連で, 賞味期限計算 } from "./ws.js";
import { 規格表示 } from "./wsChohyo.js";

// 倉庫管理System の出庫入力（FM_出荷明細票）の印刷。いただいた見本（2026/10/27）の形。
// - 出庫依頼書（R_出庫依頼書。出庫依頼書テーブル作成）：冷蔵庫あて。便・送り先・名義ごとに、出庫するロットと 入庫元数／残数
// - 配送依頼書（R_ニチレイ輸送依頼書_ニチレイ船橋／高松／大谷地。運送会社 130・135・160）：ニチレイの運送あて。ほかの運送会社
//   （ランテックは WEB で入力）の輸送依頼書は使っていない
// - 送品案内書（R_送品案内書。出荷案内書作成 の印刷区分 1）：届け先あて
// Access は作業用の表（TD_当日在庫・TDS_出荷案内書作成）に写してからレポートで集めるが、ここでは同じ決まりでその場で集める。
const 輸送計画 = t("soko", "TD_輸送計画");
const 出荷 = t("soko", "TD_出荷");
const 在庫 = t("soko", "TD_在庫");
const 名変 = t("soko", "TD_在庫変更");
const 得意先マスタ = t("kyotsu", "TM_得意先マスタ");
const 商品マスタ = t("kyotsu", "TM_商品マスタ");
const 相手先商品 = t("kyotsu", "TM_相手先商品マスタ");
const 名義条件 = t("soko_fe", "TM_入庫先商品別名義条件");
const 差出人の表 = t("app", "帳票_差出人");

type Rec = Record<string, any>;
const n = (v: unknown) => Number(v ?? 0) || 0;
const 日付 = (v: unknown) => (v ? String(v).slice(0, 10) : null);
/** Access の日付の通し番号（CLng(日付)） */
const 通し番号 = (d: string | null) => (d ? Math.round((Date.parse(d + "T00:00:00Z") - Date.UTC(1899, 11, 30)) / 86400000) : "");
/** ニチレイの運送会社（配送依頼書を使う） */
export const ニチレイ便 = [130, 135, 160];

async function 得意先(c: PoolClient, code: unknown): Promise<Rec> {
  return (await c.query(`SELECT "得意先名", "住所", "郵便番号", "電話番号", "FAX番号" FROM ${得意先マスタ} WHERE "短縮コード" = $1 LIMIT 1`, [n(code)])).rows[0] ?? {};
}
async function 便を読む(c: PoolClient, 輸送ID: number): Promise<Rec | null> {
  return (await c.query(`SELECT *, "出荷計画日"::date::text AS "出荷計画日", "集荷日"::date::text AS "集荷日" FROM ${輸送計画} WHERE "輸送ID" = $1`, [輸送ID])).rows[0] ?? null;
}

/**
 * 出庫依頼書（出庫依頼書テーブル作成 → R_出庫依頼書）。
 * 残数＝入庫元数 −（その在庫の出庫のうち、出荷日・輸送ID・出庫ID の並び〈Access の MyIndex〉でこの行までのケース ＋ 出荷日までの名変のケース）。
 * Access は出庫場所の在庫ケースが 0 でない在庫しか写さず、それ以外の行は前の行の値が残る（On Error Resume Next）。Web 版は在庫ID で読む。
 */
async function 出庫依頼書(c: PoolClient, 輸送ID: number) {
  const p = await 便を読む(c, 輸送ID);
  if (!p) return null;
  const rows = (
    await c.query(
      `SELECT s.*, s."出荷日"::date::text AS "出荷日", s."製造日"::date::text AS "製造日", s."賞味期限"::date::text AS "賞味期限",
              z."入庫No" AS "在庫の入庫No", z."入庫日"::date::text AS "在庫の入庫日", z."入庫元数", z."タグ" AS "在庫のタグ"
       FROM ${出荷} s LEFT JOIN ${在庫} z ON z."在庫ID" = s."在庫ID"
       WHERE s."輸送ID" = $1 AND COALESCE(s."ケース", 0) <> 0
       ORDER BY s."届け先コード", s."入庫前名義ID", s."商品積込順", s."出庫ID"`,
      [輸送ID],
    )
  ).rows as Rec[];
  const 鍵 = (r: Rec) => `${通し番号(日付(r.出荷日))}#${n(r.輸送ID)}#${n(r.出庫ID)}`;
  for (const r of rows) {
    if (!r.在庫ID) continue;
    const 出 = (await c.query(`SELECT "出荷日"::date::text AS "出荷日", "輸送ID", "出庫ID", "ケース" FROM ${出荷} WHERE "在庫ID" = $1`, [r.在庫ID])).rows as Rec[];
    const 自分 = 鍵(r);
    const 出庫計 = 出.filter((x) => 鍵(x) <= 自分).reduce((a, x) => a + n(x.ケース), 0);
    const 名変計 = r.出荷日
      ? n((await c.query(`SELECT SUM("ケース") AS v FROM ${名変} WHERE "在庫No" = $1 AND "変更日" <= $2::date`, [r.在庫ID, r.出荷日])).rows[0].v)
      : 0;
    r.残数 = r.入庫元数 == null ? null : n(r.入庫元数) - (出庫計 + 名変計);
  }
  const 倉庫 = await 得意先(c, p.出庫場所ID);
  const 組 = new Map<string, Rec[]>();
  for (const r of rows) {
    const k = `${r.届け先コード}|${r.入庫前名義ID}`;
    if (!組.has(k)) 組.set(k, []);
    組.get(k)!.push(r);
  }
  const 今 = 日本の今().日時;
  const pages: Rec[] = [];
  for (const g of 組.values()) {
    const 名義 = await 得意先(c, g[0].入庫前名義ID);
    const 送り先 = await 得意先(c, g[0].届け先コード);
    pages.push({
      印刷日時: 今, No: `${n(p.運送会社ID)}${輸送ID}`, 名義名: 名義.得意先名 ?? "", 名義TEL: 名義.電話番号 ?? "", 名義FAX: 名義.FAX番号 ?? "",
      宛先: 倉庫.得意先名 ?? p.出庫場所 ?? "", 出庫日: p.出荷計画日, 運送便: p.運送会社名 ?? "", 送り先: 送り先.得意先名 ?? g[0].届け先 ?? "",
      // 破損のときの連絡のお願い：見本ではニチレイの運送（船橋）のときだけ出ている
      破損連絡: ニチレイ便.includes(n(p.運送会社ID)),
      行: g.map((r) => ({
        ユーザーコード: r.在庫の入庫No ?? (r.在庫の入庫日 ? `${r.在庫の入庫日.slice(5, 7)}/${r.在庫の入庫日.slice(8, 10)}入庫予定` : r.入庫No ?? ""),
        コード: r.商品コード, 商品名: r.商品名, 規格: r.規格, ケース: n(r.ケース), 製造日: r.製造日, 賞味期限: r.賞味期限, 区分: r.在庫のタグ ?? r.タグ ?? null,
        入庫元数: r.入庫元数, 残数: r.残数 ?? null,
      })),
    });
  }
  return { 便: { 輸送ID, 運送会社ID: p.運送会社ID, 出庫場所ID: p.出庫場所ID }, pages };
}

/** 送品案内書の差出人（Access の R_送品案内書 の グループヘッダー_Format。住所・TEL・FAX はレポートに書いてある本社のもの） */
function 送品の社名(名義: number, 扱い: number, 差: Record<string, Rec>): string {
  if ([1, 11, 1261].includes(名義)) return 差["丸北北海道"]?.社名 ?? "";
  if (名義 === 150) return 差["ふらの"]?.社名 ?? "";
  if (名義 === 629 || 名義 === 658 || 扱い === 629) return 差["大阪丸北"]?.社名 ?? "";
  return 差["丸北"]?.社名 ?? "";
}

/**
 * 送品案内書（出荷案内書作成 の印刷区分 1 → R_送品案内書）。その便の出荷を 輸送ID・届け先・名義・納品日 ごとに 1 枚。
 * 品名は届け先の相手先商品名（なければ自社の商品名）、取引元が 350 のときは相手先の商品コード、発注No はユーザー伝票No、
 * 備考は「旧箱」（旧会社コードの商品で、名義条件の新ダンボール初回案内に印がある届け先）と 1265 の「旧　外装」。
 */
async function 送品案内書(c: PoolClient, 輸送ID: number) {
  const p = await 便を読む(c, 輸送ID);
  if (!p) return null;
  const 差 = Object.fromEntries((await c.query(`SELECT * FROM ${差出人の表}`)).rows.map((r: Rec) => [r.区分, r])) as Record<string, Rec>;
  const 列 = [
    `s."輸送ID"`, `s."出荷日"`, `s."納品日"`, `s."届け先コード"`, `s."入庫後名義ID"`, `s."商品コード"`, `s."商品名"`, `s."規格"`, `s."入数"`, `s."製造日"`,
    `s."賞味期限"`, `s."ｻﾝﾌﾟﾙ区分"`, `s."取引元ID"`, `s."ユーザー伝票No"`, `s."運賃振分区分"`,
  ];
  const rows = (
    await c.query(
      `SELECT ${列.join(", ")}, SUM(s."ケース") AS "ケース", SUM(s."商品kg") AS "商品kg" FROM ${出荷} s WHERE s."輸送ID" = $1 GROUP BY ${列.join(", ")}`,
      [輸送ID],
    )
  ).rows as Rec[];
  const 組 = new Map<string, Rec[]>();
  for (const r of rows) {
    const v: Rec = { ...r, 出荷日: 日付(r.出荷日), 納品日: 日付(r.納品日), ケース: n(r.ケース), 商品kg: Number(r.商品kg ?? 0) };
    v.賞味期限 = 日付(r.賞味期限) ?? (await 賞味期限計算(c, 日付(r.製造日), r.商品コード));
    v.規格 = n(r.商品コード) === 736 || n(r.商品コード) === 1290 ? r.規格 : 規格表示(r.規格);
    const 相手 = async (得意先: unknown, 列: string) =>
      (await c.query(`SELECT "${列}" AS v FROM ${相手先商品} WHERE "商品コード" = $1 AND "得意先短縮コード" = $2 LIMIT 1`, [n(r.商品コード), n(得意先)])).rows[0]?.v ?? null;
    const 相手コード = await 相手(r.取引元ID, "相手先商品コード");
    v.本社コード = 相手コード && n(r.取引元ID) === 350 ? 相手コード : null;
    v.商品名 = (await 相手(r.届け先コード, "相手先商品名")) || r.商品名;
    const m = (await c.query(`SELECT "旧会社コード区分", "グループ商品コード" FROM ${商品マスタ} WHERE "商品コード" = $1 LIMIT 1`, [n(r.商品コード)])).rows[0];
    const 初回 =
      m?.旧会社コード区分 === true &&
      (await c.query(`SELECT "新ダンボール初回案内" AS v FROM ${名義条件} WHERE "届け先コード" = $1 AND "商品コード" = $2 LIMIT 1`, [n(r.届け先コード), n(m.グループ商品コード)])).rows[0]?.v === true;
    v.備考2 = n(r.商品コード) === 1265 ? "旧　外装" : 初回 ? "旧箱" : "";
    if (r.ｻﾝﾌﾟﾙ区分 === true) v.商品名 = `ｻﾝﾌﾟﾙ ${v.商品名}`;
    const k = `${r.輸送ID}\\${r.届け先コード}\\${r.入庫後名義ID ?? ""}\\${通し番号(v.納品日)}`;
    if (!組.has(k)) 組.set(k, []);
    組.get(k)!.push(v);
  }
  const 今 = 日本の今().日時;
  const 本社 = 差["丸北北海道"] ?? {};
  const pages: Rec[] = [];
  for (const g of 組.values()) {
    // 同じ中身はまとめる（ケース 0 は出さない）。並びは 発注No・品名・賞味期限（見本の並び）
    const m = new Map<string, Rec>();
    for (const r of g) {
      const key = JSON.stringify([r.商品コード, r.本社コード, r.商品名, r.規格, r.賞味期限, r.ユーザー伝票No, r.備考2]);
      const x = m.get(key);
      if (x) {
        x.ケース += r.ケース;
        x.商品kg += r.商品kg;
      } else m.set(key, { ...r });
    }
    const 行 = [...m.values()]
      .filter((r) => r.ケース !== 0)
      .sort((a, b) => String(a.ユーザー伝票No ?? "").localeCompare(String(b.ユーザー伝票No ?? "")) || String(a.商品名).localeCompare(String(b.商品名), "ja") || String(a.賞味期限).localeCompare(String(b.賞味期限)));
    if (!行.length) continue;
    const 届け先 = await 得意先(c, g[0].届け先コード);
    pages.push({
      様式: "sohin", 表題: "送品案内書", No: String(輸送ID), 印刷日時: 今, 宛先: `${届け先.得意先名 ?? ""} 御中`, 担当者: "", 名義分: "",
      差出人: { 社名: 送品の社名(n(g[0].入庫後名義ID), n(g[0].運賃振分区分), 差), 店舗: "", 住所: 本社.住所 ?? "", TEL: 本社.TEL ?? "", FAX: 本社.FAX ?? "" },
      運送会社名: p.運送会社名 ?? "", 車番: p.車番 ?? "", 出荷日: g[0].出荷日, 納品日: g[0].納品日, 連絡事項: "",
      行: 行.map((r) => ({ 商品コード: r.商品コード, 本社コード: r.本社コード, 商品名: r.商品名, 規格: r.規格, ケース: r.ケース, kg: r.商品kg, 賞味期限: r.賞味期限, 発注No: r.ユーザー伝票No, 特記: r.備考2 })),
      計: { ケース: 行.reduce((a, r) => a + r.ケース, 0), kg: 行.reduce((a, r) => a + r.商品kg, 0) },
    });
  }
  return { 便: { 輸送ID }, pages };
}

/** 配送依頼書の運送会社ごとの決まった文字（宛名・TEL・FAX・荷主コード・集荷先）。Access はレポートに書いてあった。app."設定" の「配送依頼書_運送会社ID」 */
type 配送設定 = { 宛名?: string; TEL?: string; FAX?: string; 荷主コード?: string; 集荷先名?: string; 集荷先住所?: string; 集荷先電話?: string };
async function 配送設定を読む(c: PoolClient | typeof pool, 運送会社ID: number): Promise<配送設定> {
  const v = (await c.query(`SELECT "値" FROM app."設定" WHERE "名前" = $1`, [`配送依頼書_${運送会社ID}`])).rows[0]?.値;
  try {
    return v ? JSON.parse(v) : {};
  } catch {
    return {};
  }
}

/**
 * 配送依頼書（R_ニチレイ輸送依頼書_ニチレイ船橋／高松／大谷地）。便の出荷を 届け先・納品日 ごとに 1 枚、商品・賞味期限 ごとに 1 行。
 * 商品コードは本社コード（なければ自社のコード）、規格は 規格kg kg×規格枚数（高松は商品の規格）、温度帯は F、外装日は賞味期限。
 * 宛名・TEL・FAX・荷主コード・集荷先は運送会社ごとの設定（無ければ出庫場所の得意先マスタ）。
 */
async function 配送依頼書(c: PoolClient, 輸送ID: number) {
  const p = await 便を読む(c, 輸送ID);
  if (!p) return null;
  const 設定 = await 配送設定を読む(c, n(p.運送会社ID));
  const 倉庫 = await 得意先(c, p.出庫場所ID);
  const 差 = Object.fromEntries((await c.query(`SELECT * FROM ${差出人の表}`)).rows.map((r: Rec) => [r.区分, r])) as Record<string, Rec>;
  const rows = (
    await c.query(
      `SELECT s."届け先コード", s."納品日"::date::text AS "納品日", s."入庫前名義ID", s."商品コード", s."商品名", s."規格", s."賞味期限"::date::text AS "賞味期限",
              SUM(s."ケース") AS "ケース", SUM(s."商品kg") AS "商品kg", MAX(m."規格枚数") AS "規格枚数", MAX(m."規格kg") AS "規格kg", MAX(m."本社コード") AS "本社コード"
       FROM ${出荷} s LEFT JOIN ${商品マスタ} m ON m."商品コード" = s."商品コード"
       WHERE s."輸送ID" = $1
       GROUP BY s."届け先コード", s."納品日", s."入庫前名義ID", s."商品コード", s."商品名", s."規格", s."賞味期限"
       ORDER BY s."届け先コード", s."納品日", s."商品コード", s."賞味期限"`,
      [輸送ID],
    )
  ).rows as Rec[];
  const 組 = new Map<string, Rec[]>();
  for (const r of rows) {
    if (n(r.ケース) === 0) continue;
    const k = `${r.届け先コード}|${r.納品日}`;
    if (!組.has(k)) 組.set(k, []);
    組.get(k)!.push(r);
  }
  const 本社 = 差["丸北北海道"] ?? {};
  const 名義名 = (await 得意先(c, rows[0]?.入庫前名義ID ?? 11)).得意先名 ?? "";
  // 荷主の社名・部署名は名義の得意先名を全角の空白で分ける（「㈱丸北　北海道」→「㈱丸北」「北海道」）
  const [社名, ...部署] = String(名義名).split(/[　 ]+/);
  const pages: Rec[] = [];
  for (const g of 組.values()) {
    const 届け先 = await 得意先(c, g[0].届け先コード);
    pages.push({
      宛名: 設定.宛名 || (倉庫.得意先名 ?? p.出庫場所 ?? ""), 宛TEL: 設定.TEL || 倉庫.電話番号 || "", 宛FAX: 設定.FAX || 倉庫.FAX番号 || "",
      提出日: 日本の今().日付, 社名, 部署名: 部署.join(" "), 荷主コード: 設定.荷主コード ?? "", TEL: 本社.TEL ?? "", FAX: 本社.FAX ?? "",
      依頼No: `${n(p.運送会社ID)}${輸送ID}`, 名義: 名義名,
      // 表題の下の一行は便の引取備考（見本では「集荷引き取り日の返信をお願い申し上げます。」）
      引取備考: p.引取備考 ?? "",
      集荷日: p.集荷日 ?? p.出荷計画日, 集荷先名: 設定.集荷先名 || 倉庫.得意先名 || "", 集荷先住所: 設定.集荷先住所 || 倉庫.住所 || "", 集荷先電話: 設定.集荷先電話 || 倉庫.電話番号 || "",
      到着日: g[0].納品日, 到着時間: p.納品日コメント ?? "", 納品先名: 届け先.得意先名 ?? "", 納品先住所: 届け先.住所 ?? "", 納品先電話: 届け先.電話番号 ?? "",
      行: g.map((r) => ({
        商品コード: r.本社コード || r.商品コード, 商品名: r.商品名,
        規格: n(p.運送会社ID) === 135 || !r.規格kg ? r.規格 : `${Number(r.規格kg)}kg×${n(r.規格枚数)}`,
        数量: n(r.ケース), 総重量: Number(r.商品kg ?? 0), 温度帯: "F", 外装日: r.賞味期限,
      })),
    });
  }
  return { 便: { 輸送ID, 運送会社ID: p.運送会社ID }, 設定, pages };
}

export function sokoChohyoRoutes(app: FastifyInstance) {
  app.addHook("preHandler", requireUser);
  const 便の番号 = (v: unknown) => n(v);
  app.get<{ Querystring: { id: string } }>("/api/soko/chohyo/shukko-irai", async (req, reply) =>
    一連で(async (c) => (await 出庫依頼書(c, 便の番号(req.query.id))) ?? reply.code(404).send({ error: "この便はありません" })),
  );
  app.get<{ Querystring: { id: string } }>("/api/soko/chohyo/sohin", async (req, reply) =>
    一連で(async (c) => (await 送品案内書(c, 便の番号(req.query.id))) ?? reply.code(404).send({ error: "この便はありません" })),
  );
  app.get<{ Querystring: { id: string } }>("/api/soko/chohyo/haiso", async (req, reply) =>
    一連で(async (c) => (await 配送依頼書(c, 便の番号(req.query.id))) ?? reply.code(404).send({ error: "この便はありません" })),
  );
  // 配送依頼書の決まった文字を直す（運送会社ごと）
  app.post<{ Body: { 運送会社ID: number; 設定: 配送設定 } }>("/api/soko/chohyo/haiso-settei", async (req, reply) => {
    const id = n(req.body.運送会社ID);
    if (!ニチレイ便.includes(id)) return reply.code(400).send({ error: "配送依頼書を使う運送会社ではありません" });
    const s = req.body.設定 ?? {};
    const v: 配送設定 = {};
    for (const k of ["宛名", "TEL", "FAX", "荷主コード", "集荷先名", "集荷先住所", "集荷先電話"] as const) v[k] = String(s[k] ?? "").slice(0, 200);
    await pool.query(`INSERT INTO app."設定" ("名前", "値") VALUES ($1, $2) ON CONFLICT ("名前") DO UPDATE SET "値" = EXCLUDED."値"`, [`配送依頼書_${id}`, JSON.stringify(v)]);
    return { ok: true };
  });
}
