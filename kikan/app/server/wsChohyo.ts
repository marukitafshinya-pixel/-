import type { FastifyInstance } from "fastify";
import type { PoolClient } from "pg";
import { pool, t, 日本の今 } from "./db.js";
import { requireUser } from "./auth.js";
import { 一連で, 賞味期限計算 } from "./ws.js";
import { 並びの鍵, 鍵で比べる } from "./narabi.js";

// 丸北WorkStation の入庫依頼書・出荷通知書・送品案内書（Access の 出荷案内書作成 と R_入庫依頼書_冷蔵庫・R_出荷通知書・
// R_送品案内書_冷蔵庫／ユーザー／無地）。出荷関連報告書印刷の「印刷表示」「仮印刷」から出す。
// Access は作業用の表（TDS_出荷案内書作成）に写してからレポートで集めるが、ここでは同じ決まりでその場で集める。
const 輸送計画 = t("ws", "TD_輸送計画");
const 出荷 = t("ws", "TD_出荷");
const 確認用 = t("ws_fe", "T_入庫依頼書確認用");
const 得意先マスタ = t("kyotsu", "TM_得意先マスタ");
const 商品マスタ = t("kyotsu", "TM_商品マスタ");
const 相手先商品 = t("ws_fe", "TM_相手先商品マスタ");
const 冷凍区分 = t("ws_fe", "TM_冷凍区分");
const 車両区分 = t("ws_fe", "TM_車両区分");
const 差出人の表 = t("app", "帳票_差出人");

type Rec = Record<string, any>;
const n = (v: unknown) => Number(v ?? 0) || 0;
const 日付 = (v: unknown) => (v ? String(v).slice(0, 10) : null);

/** Access の 規格表示：「10×2」→「10kg×2」 */
export function 規格表示(規格: string | null): string | null {
  if (!規格) return 規格;
  const i = 規格.indexOf("×");
  if (i <= 0) return 規格;
  return `${規格.slice(0, i)}kg×${規格.slice(i + 1)}`;
}

/** 帳票の明細のもと（Access の 出荷案内書作成。印刷区分 2＝入庫依頼書、1＝送品案内書） */
async function 明細を集める(c: PoolClient, 印刷区分: 1 | 2, 出荷日: string): Promise<Rec[]> {
  // Q_入庫依頼書作成／Q_出荷案内書：便のある出荷を、同じ中身ごとにまとめる。入庫依頼書は入庫区分のある届け先だけ
  const 入庫依頼書 = 印刷区分 === 2;
  const 列 = [
    `s."輸送ID"`, `p."運送会社ID"`, `p."運送会社名"`, `p."車番"`, `s."出荷日"`, `s."商品コード"`, `s."商品名"`, `s."規格"`, `s."入数"`,
    `s."製造日"`, `s."納品日"`, `s."賞味期限"`, `s."届け先コード"`, `s."届け先"`, `s."入庫後名義ID"`, `s."ユーザー伝票No"`, `s."帳票グループ化"`,
    `s."運賃振分区分"`, `s."商品区分"`, `s."タグ"`, `s."サンプル区分"`, `s."取引元ID"`,
    ...(入庫依頼書 ? [`s."倉庫ID"`, `s."倉庫名"`, `s."サービス区分"`, `s."入庫備考"`, `s."特別検査区分"`, `s."タグ2"`] : []),
  ];
  const rows = (
    await c.query(
      `SELECT ${列.join(", ")}, SUM(s."ケース") AS "ケース", SUM(s."商品kg") AS "商品kg"${入庫依頼書 ? `, MAX(s."備考") AS "備考"` : ""}
       FROM ${輸送計画} p JOIN ${出荷} s ON s."輸送ID" = p."輸送ID"
       ${入庫依頼書 ? `LEFT JOIN ${得意先マスタ} u ON u."短縮コード" = s."届け先コード"` : ""}
       WHERE s."届け先コード" <> 0 AND s."出荷日" = $1::date ${入庫依頼書 ? `AND u."入庫区分" = true` : ""}
       GROUP BY ${列.join(", ")}`,
      [出荷日],
    )
  ).rows;
  const 商品 = new Map<number, Rec>();
  const 商品を見る = async (code: unknown) => {
    const k = n(code);
    if (!商品.has(k))
      商品.set(k, (await c.query(`SELECT "本社コード", "特記事項" FROM ${商品マスタ} WHERE "商品コード" = $1 LIMIT 1`, [k])).rows[0] ?? {});
    return 商品.get(k)!;
  };
  const out: Rec[] = [];
  for (const r of rows) {
    const v: Rec = {
      輸送ID: r.輸送ID, 運送会社名: r.運送会社名, 車番: r.車番, 出荷日: r.出荷日, 納品日: r.納品日, 届け先コード: r.届け先コード, 届け先: r.届け先,
      入庫後名義ID: r.入庫後名義ID, 商品コード: r.商品コード, 規格: 規格表示(r.規格), 入数: r.入数, ケース: n(r.ケース), 商品kg: Number(r.商品kg ?? 0),
      製造日: r.製造日, 賞味期限: r.賞味期限 ?? (await 賞味期限計算(c, r.製造日, r.商品コード)), ユーザー伝票No: r.ユーザー伝票No,
      商品区分: r.商品区分, 運賃振分区分: null as unknown,
      // リンクコード1：入庫依頼書確認用の行と結ぶ（輸送ID\届け先\名義\納品日の通し番号）
      リンクコード1: `${r.輸送ID}\\${r.届け先コード}\\${r.入庫後名義ID ?? ""}\\${r.納品日 ? Math.round((Date.parse(日付(r.納品日) + "T00:00:00Z") - Date.UTC(1899, 11, 30)) / 86400000) : ""}`,
      // タグ（区分）は、ニチレイ大谷地（164）で商品区分が 0 でないもの以外は出さない（Access の 2026/03/27 の変更）
      タグ: n(r.届け先コード) === 164 && n(r.商品区分) !== 0 ? r.タグ : null,
      備考: null as unknown,
      本社コード: null as unknown,
    };
    if (入庫依頼書) {
      Object.assign(v, { 倉庫ID: r.倉庫ID, 倉庫名: r.倉庫名, サービス区分: r.サービス区分, 運賃振分区分: r.運賃振分区分 });
      v.本社コード = (await 商品を見る(r.商品コード)).本社コード ?? null;
      if (r.入庫備考) v.備考 = r.備考;
      // 寿（657）は、検査結果の出ていない商品に印
      v.寿検査待ち = n(r.商品区分) !== 0 && n(r.届け先コード) === 657;
      // 2 合い商品・大阪扱いのオニオンミンチ 3.2㎜ は名前を変える
      if (n(r.商品コード) === 736 || n(r.商品コード) === 1290) v.商品名 = `${r.商品名} （2合い）`;
      else if (n(r.運賃振分区分) === 629 && (n(r.商品コード) === 64 || n(r.商品コード) === 1246)) v.商品名 = "オニオンミンチ3.2ミリ";
      else v.商品名 = r.商品名;
      // ニチレイ大宮（321）入庫は、積込の順を出す
      v.商品積込順 =
        n(r.届け先コード) === 321
          ? ((
              await c.query(
                `SELECT MAX("商品積込順") AS v FROM ${出荷} WHERE "倉庫ID" = $1 AND "届け先コード" = $2 AND "輸送ID" = $3 AND "商品コード" = $4 AND "賞味期限" = $5`,
                [r.倉庫ID, r.届け先コード, r.輸送ID, r.商品コード, r.賞味期限],
              )
            ).rows[0]?.v ?? null)
          : null;
      v.特記事項 = (await 商品を見る(r.商品コード)).特記事項 ?? null;
    } else {
      // 送品案内書：相手先（取引元）の商品コード、発注No
      const a = (
        await c.query(`SELECT "相手先商品コード" FROM ${相手先商品} WHERE "商品コード" = $1 AND "得意先短縮コード" = $2 LIMIT 1`, [
          n(r.商品コード),
          n(r.取引元ID),
        ])
      ).rows[0];
      if (a?.相手先商品コード) v.本社コード = a.相手先商品コード;
      v.商品名 = r.商品名;
      if (r.ユーザー伝票No) v.備考 = r.ユーザー伝票No;
      v.運賃振分区分 = r.運賃振分区分;
    }
    if (r.サンプル区分) v.商品名 = `ｻﾝﾌﾟﾙ ${v.商品名}`;
    out.push(v);
  }
  return out;
}

/** 帳票の 1 行（同じ中身をまとめ、ケース 0 は出さない）。並びは商品名・賞味期限 */
function 行にまとめる(rows: Rec[], 入庫依頼書: boolean): Rec[] {
  const m = new Map<string, Rec>();
  for (const r of rows) {
    const key = JSON.stringify([
      r.商品コード, r.本社コード, r.商品名, r.規格, r.入数, 日付(r.製造日), 日付(r.賞味期限), r.タグ, 入庫依頼書 ? r.商品区分 : null, r.備考,
      入庫依頼書 ? r.倉庫ID : null, r.商品積込順 ?? null,
    ]);
    const x = m.get(key);
    if (x) {
      x.ケース += r.ケース;
      x.商品kg += r.商品kg;
    } else m.set(key, { ...r });
  }
  return [...m.values()]
    .filter((r) => r.ケース !== 0)
    .map((r): Rec => ({ ...r, 鍵: 並びの鍵(r.商品名) }))
    .sort((a, b) => 鍵で比べる(a.鍵, b.鍵) || String(日付(a.賞味期限)).localeCompare(String(日付(b.賞味期限))) || n(a.商品積込順) - n(b.商品積込順))
    .map(({ 鍵, ...r }) => r);
}

type 差出人 = { 社名: string; 店舗: string; 住所: string; TEL: string; FAX: string };

const 管理願い = "≪賞味期限　ロット区分ごとの入庫 ・ -20℃以下 ・ 縦積みでの保管をお願い申し上げます。≫";

/** 入庫依頼書・出荷通知書の上の部分（Access の グループヘッダー11_Format） */
function 入庫依頼書の頭(帳票: "入庫依頼書" | "出荷通知書", h: Rec, 差: Record<string, 差出人>, 届け先名: string, 名義名: string, サービス: boolean) {
  const 本社 = 差["丸北北海道"];
  const 連絡 = `その他不明事項は${本社.社名} TEL${本社.TEL} までご連絡下さい。`;
  const サービス文 = サービス ? ["1 期分　サービス でお願いします。"] : [];
  const 名義 = n(h.入庫後名義ID);
  const 扱い = n(h.運賃振分区分);
  if (帳票 === "出荷通知書")
    return {
      表題: "出荷通知書", 宛先: `${届け先名} 様 納入分`, 差出人: 扱い === 629 ? 差["大阪丸北"] : 差["丸北"], 記入者: true, 管理願い: "",
      名義表示: `≪ ${名義名}  名義  ≫`, 名義情報: [連絡], 車両を出す: false,
    };
  if ([1, 11, 1261].includes(名義))
    return {
      表題: "入庫依頼書", 宛先: `${届け先名}   御中`, 差出人: 本社, 記入者: true, 管理願い, 名義表示: `≪ ${名義名}  名義  ≫`,
      名義情報: [連絡, ...サービス文], 車両を出す: true,
    };
  if (名義 === 150)
    return {
      表題: "入庫依頼書", 宛先: `${届け先名}   御中`, 差出人: { ...差["ふらの"], FAX: "" }, 記入者: false, 管理願い, 名義表示: `≪ ${名義名}  名義  ≫`,
      名義情報: [
        `入庫通知書を右記二箇所に送信お願いします　　　　　　　　　　　FAX ${本社.FAX}        FAX ${差["ふらの"].FAX}`,
        `${連絡}※必ずこちらにFAXお願い致します。`,
        ...サービス文,
      ],
      車両を出す: true,
    };
  if (名義 === 629 || 名義 === 658)
    return {
      表題: "出荷通知書\n入庫依頼書", 宛先: `${届け先名}   御中`, 差出人: 差["大阪丸北"], 記入者: true, 管理願い,
      名義表示: `≪ ${名義 === 629 ? 差["大阪丸北"].社名 : 名義名}  名義  ≫`, 名義情報: [連絡, ...サービス文], 車両を出す: true,
    };
  if (扱い === 629)
    return {
      表題: "出荷通知書", 宛先: `${届け先名}   御中`, 差出人: 差["大阪丸北"], 記入者: true, 管理願い, 名義表示: `≪ ${名義名}  名義  ≫`,
      名義情報: [連絡, ...サービス文], 車両を出す: true,
    };
  return {
    表題: "出荷通知書", 宛先: `${届け先名} 様 納入分`, 差出人: 差["丸北"], 記入者: true, 管理願い: "", 名義表示: `≪ ${名義名}  名義  ≫`,
    名義情報: [連絡], 車両を出す: true,
  };
}

/** 送品案内書の差出人（Access の グループヘッダー1_Format など） */
function 送品の差出人(h: Rec, 差: Record<string, 差出人>): 差出人 {
  const 名義 = n(h.入庫後名義ID);
  if ([1, 11, 1261].includes(名義)) return 差["丸北北海道"];
  if (名義 === 150) return { ...差["ふらの"], 住所: "", TEL: "", FAX: "" };
  if (名義 === 629 || 名義 === 658 || n(h.運賃振分区分) === 629) return 差["大阪丸北"];
  return 差["丸北"];
}

// 帳票ごとの対象の名義（Access のレポートのもとのクエリ）
const 入庫依頼書の名義 = [11, 150, 629, 658, 3060];
const 出荷通知書で除く名義 = [11, 150, 1261];
const 送品冷蔵庫の名義 = [11, 150, 629, 1261, 3060, 212];
// 送品案内書の写し（ページの表題）
const 送品の写し: Record<string, string[]> = {
  sohin_reizo: ["送品案内書", "送品受領書"],
  sohin_user: ["送品案内書", "送品受領書", "送品案内書（控）"],
  sohin_muji: ["送品案内書", "送品受領書"],
};

export type 帳票の種類 = "nyuko" | "tsuchi" | "sohin_reizo" | "sohin_user" | "sohin_muji";

/** 帳票のページを作る。links を渡すとその行（仮印刷）、渡さないと出荷関連報告書印刷で選んだ行 */
export async function 帳票を作る(
  c: PoolClient,
  p: { 種類: 帳票の種類; 出荷日: string; links?: string[]; 担当者?: string; 備考?: string; 仮?: boolean },
): Promise<Rec[]> {
  const 差 = Object.fromEntries((await c.query(`SELECT * FROM ${差出人の表}`)).rows.map((r: Rec) => [r.区分, r])) as Record<string, 差出人>;
  for (const k of ["丸北北海道", "丸北", "ふらの", "大阪丸北"]) 差[k] ??= { 社名: "", 店舗: "", 住所: "", TEL: "", FAX: "" };
  const 確認 = (
    await c.query(
      p.links
        ? `SELECT * FROM ${確認用} WHERE "リンクコード1" = ANY($1::text[]) ORDER BY "輸送ID", "ユーザー区分名", "届け先コード", "入庫後名義ID"`
        : `SELECT * FROM ${確認用} WHERE "抽出区分" = true AND "出荷計画日" = $1::date AND "届け先コード" <> 11 ORDER BY "輸送ID", "ユーザー区分名", "届け先コード", "入庫後名義ID"`,
      [p.links ?? p.出荷日],
    )
  ).rows;
  const 名前 = async (code: unknown) =>
    (await c.query(`SELECT "得意先名" FROM ${得意先マスタ} WHERE "短縮コード" = $1 LIMIT 1`, [n(code)])).rows[0]?.得意先名 ?? "";
  const 今 = 日本の今().日時;
  const 入庫系 = p.種類 === "nyuko" || p.種類 === "tsuchi";
  const 明細 = await 明細を集める(c, 入庫系 ? 2 : 1, p.出荷日);
  const pages: Rec[] = [];
  for (const h of 確認) {
    const rows = 明細.filter((r) => r.リンクコード1 === h.リンクコード1);
    if (!rows.length) continue;
    const 名義 = n(rows[0].入庫後名義ID);
    const 届け先名 = await 名前(h.届け先コード);
    const 名義名 = await 名前(名義);
    const plan = (
      await c.query(
        `SELECT p."車番", v."車両区分", r."区分名2" FROM ${輸送計画} p LEFT JOIN ${車両区分} v ON v."車両区分ID" = p."車両区分ID"
         LEFT JOIN ${冷凍区分} r ON r."冷凍ID" = p."冷凍区分ID" WHERE p."輸送ID" = $1`,
        [h.輸送ID],
      )
    ).rows[0] ?? {};
    const 共通 = {
      印刷日時: 今, 出荷日: 日付(h.出荷計画日), 納品日: 日付(h.納品日), 運送会社名: rows[0].運送会社名 ?? h.運送会社名, 車番: rows[0].車番 ?? h.車番,
      車両: plan.車両区分 ?? "", 区分: plan.区分名2 ?? "", 担当者: p.担当者 ? `${p.担当者} 様` : "", リンクコード1: h.リンクコード1,
    };
    if (入庫系) {
      // 入庫依頼書は名義が丸北北海道・ふらの・大阪丸北など、出荷通知書はそれ以外
      // 仮印刷は 1 行ずつ：入庫依頼書の名義なら入庫依頼書、ほか（日洋専用など）は出荷通知書の形で出す
      const 種類 = p.仮 ? (入庫依頼書の名義.includes(名義) && !h.特殊レポート名 ? "nyuko" : "tsuchi") : p.種類;
      if (!p.仮 && 種類 === "nyuko" && !入庫依頼書の名義.includes(名義)) continue;
      if (!p.仮 && 種類 === "tsuchi" && 出荷通知書で除く名義.includes(名義)) continue;
      const 行 = 行にまとめる(rows, true);
      const 頭 = 入庫依頼書の頭(種類 === "nyuko" ? "入庫依頼書" : "出荷通知書", { ...h, 入庫後名義ID: 名義, 運賃振分区分: rows[0].運賃振分区分 }, 差, 届け先名, 名義名, rows.some((r) => r.サービス区分));
      // トマトダイスはお願い事項、寿の検査待ちは再 FAX のお知らせ（Access の グループフッター3_Format）
      const お願い = 行.find((r) => n(r.商品コード) === 1159 || n(r.商品コード) === 1174);
      pages.push({
        様式: "nyuko", ...共通, ...頭, No: `${h.輸送ID}${h.届け先コード}${名義}`, 入庫票: 種類 === "nyuko", 仮: !!p.仮,
        備考欄: p.備考 ? `備考：${p.備考}` : "",
        行: 行.map((r) => ({
          // 入庫依頼書は自社の商品コード、出荷通知書は本社コード（見本と同じ）
          商品コード: 種類 === "nyuko" ? r.商品コード : r.本社コード || r.商品コード, 商品名: r.商品名, 区分: r.タグ, 規格: r.規格, 入数: r.入数, ケース: r.ケース, kg: r.商品kg,
          // 「検」（検査待ち）は出荷通知書だけに出す（入庫依頼書の見本では出ていない）
          賞味期限: 日付(r.賞味期限), コード: r.倉庫ID, 連絡: 種類 === "tsuchi" && n(r.商品区分) !== 0 ? "検" : "", 積込順: r.商品積込順,
        })),
        お知らせ: [
          ...(お願い ? [`お願い事項\n${お願い.特記事項 ?? ""}`] : []),
          ...(行.some((r) => r.寿検査待ち) ? ["区分が二つ以上発生する場合、入庫日の前日までに再FAX致します。"] : []),
        ],
        計: { ケース: 行.reduce((a, r) => a + r.ケース, 0), kg: 行.reduce((a, r) => a + r.商品kg, 0) },
      });
    } else {
      if (p.種類 === "sohin_reizo" && !送品冷蔵庫の名義.includes(n(h.入庫後名義ID))) continue;
      const 行 = 行にまとめる(rows, false);
      const 差出 = p.種類 === "sohin_muji" ? null : 送品の差出人({ ...h, 入庫後名義ID: 名義, 運賃振分区分: rows[0].運賃振分区分 }, 差);
      for (const 写し of 送品の写し[p.種類]) {
        pages.push({
          様式: "sohin", ...共通, 表題: 写し, 宛先: `${届け先名} 御中`, 名義分: p.種類 === "sohin_reizo" && h.入庫後名義名 ? `${h.入庫後名義名} 様 名義分` : "",
          差出人: 差出, 連絡事項: p.備考 ? `※ご連絡事項： ${p.備考}` : "",
          行: 行.map((r) => ({
            商品コード: r.商品コード, 本社コード: r.本社コード, 商品名: r.商品名, 規格: r.規格, ケース: r.ケース, kg: r.商品kg, 賞味期限: 日付(r.賞味期限), 発注No: r.ユーザー伝票No,
            // キューソー栗橋第二営業所（3217）のソテーオニオン 65D・45D は受領印の即日回収（Access の RS_送品案内）
            特記: n(h.届け先コード) === 3217 && ["ソテーオニオン65D", "ソテーオニオン45D"].includes(r.商品名) ? "受領印 即日回収お願いします" : "",
          })),
          計: { ケース: 行.reduce((a, r) => a + r.ケース, 0), kg: 行.reduce((a, r) => a + r.商品kg, 0) },
        });
      }
    }
  }
  return pages;
}

/** 輸送依頼書（Access の R_輸送依頼書ver2）。運送会社あての依頼。納品日・届け先ごとに品名と数 */
export async function 輸送依頼書(c: PoolClient, 輸送ID: number) {
  const plan = (
    await c.query(
      `SELECT p.*, r."コメント" AS "冷凍コメント" FROM ${輸送計画} p LEFT JOIN ${冷凍区分} r ON r."冷凍ID" = p."冷凍区分ID" WHERE p."輸送ID" = $1`,
      [輸送ID],
    )
  ).rows[0];
  if (!plan) return null;
  const 得意先 = async (code: unknown) =>
    (await c.query(`SELECT "得意先名", "住所", "電話番号" FROM ${得意先マスタ} WHERE "短縮コード" = $1 LIMIT 1`, [n(code)])).rows[0] ?? {};
  const rows = (
    await c.query(
      `SELECT "納品日", "届け先コード", "倉庫ID", "手配帳合ID", "商品コード", "商品名", SUM("ケース") AS "ケース", SUM("商品kg") AS "kg", MIN("商品積込順") AS "順"
       FROM ${出荷} WHERE "輸送ID" = $1 AND "届け先コード" <> 0
       GROUP BY "納品日", "届け先コード", "倉庫ID", "手配帳合ID", "商品コード", "商品名" ORDER BY "納品日", MIN("商品積込順"), "届け先コード", "商品コード"`,
      [輸送ID],
    )
  ).rows;
  // 集荷先は出す倉庫、請求先は手配帳合（なければ倉庫）
  const 集荷先 = await 得意先(rows[0]?.倉庫ID ?? 11);
  const 請求先 = await 得意先(rows[0]?.手配帳合ID || rows[0]?.倉庫ID || 11);
  const 納品日ごと: Rec[] = [];
  for (const r of rows) {
    let g = 納品日ごと.find((x) => x.納品日 === 日付(r.納品日));
    if (!g) 納品日ごと.push((g = { 納品日: 日付(r.納品日), 届け先: [] as Rec[] }));
    let t = g.届け先.find((x: Rec) => x.コード === r.届け先コード);
    if (!t) {
      const m = await 得意先(r.届け先コード);
      g.届け先.push((t = { コード: r.届け先コード, 名前: m.得意先名 ?? "", 住所: m.住所 ?? "", TEL: m.電話番号 ?? "", 品: [] as Rec[], ケース: 0, kg: 0, 備考: plan.冷凍コメント ?? "" }));
    }
    t.品.push({ 商品名: r.商品名, ケース: n(r.ケース), kg: Number(r.kg ?? 0), サイズ: n(plan.運送会社ID) === 24 ? "L ｻｲｽﾞ" : "" });
    t.ケース += n(r.ケース);
    t.kg += Number(r.kg ?? 0);
    // トマトダイスはお願い事項（Access の グループフッター1_Format）
    if (n(r.商品コード) === 1159 || n(r.商品コード) === 1174) {
      const 特記 = (await c.query(`SELECT "特記事項" FROM ${商品マスタ} WHERE "商品コード" = $1 LIMIT 1`, [n(r.商品コード)])).rows[0]?.特記事項 ?? "";
      t.備考 = `お願い事項\n${r.商品名} ${特記}`;
    }
  }
  const 差 = (await c.query(`SELECT * FROM ${差出人の表} WHERE "区分" = '丸北'`)).rows[0] ?? {};
  const 連絡先 = (await c.query(`SELECT "値" FROM app."設定" WHERE "名前" = '輸送依頼書の連絡先'`)).rows[0]?.値 ?? "";
  return {
    No: `${n(plan.運送会社ID)}${輸送ID}`, 印刷日: 日本の今().日付, 差出人: 差, 宛先: `${plan.運送会社名 ?? ""}御中`,
    集荷先: { 名前: 集荷先.得意先名 ?? "", 住所: 集荷先.住所 ?? "", TEL: 集荷先.電話番号 ?? "" },
    集荷日: 日付(plan.集荷日), 出荷日: 日付(plan.出荷計画日), 納品日ごと, 請求先: 請求先.得意先名 ?? "", セット温度: plan.セット温度, 連絡先,
  };
}

export function wsChohyoRoutes(app: FastifyInstance) {
  app.addHook("preHandler", requireUser);

  // 帳票のページ（印刷表示・仮印刷）
  app.post<{ Body: { 種類: 帳票の種類; 出荷日: string; links?: string[]; 担当者?: string; 備考?: string; 仮?: boolean } }>(
    "/api/ws/chohyo",
    async (req) =>
      一連で(async (c) => {
        const pages = await 帳票を作る(c, req.body);
        // 仮印刷したら「仮入庫印刷」の印を付ける（Access の cmd_仮印刷_Click）
        if (req.body.仮 && req.body.links?.length)
          await c.query(`UPDATE ${確認用} SET "仮入庫通知" = true WHERE "リンクコード1" = ANY($1::text[])`, [req.body.links]);
        return { pages };
      }),
  );

  // 輸送依頼書（出荷明細票の「輸送依頼書」）
  app.get<{ Params: { id: string } }>("/api/ws/yusoirai/:id", async (req, reply) =>
    一連で(async (c) => (await 輸送依頼書(c, n(req.params.id))) ?? reply.code(404).send({ error: "この便はありません" })),
  );

  // 帳票の設定（人の名前などを含む文言。app."設定"）
  app.get("/api/ws/settei", async () => (await pool.query(`SELECT "名前", "値" FROM app."設定" ORDER BY "名前"`)).rows);
  app.post<{ Body: { 名前: string; 値: string } }>("/api/ws/settei", async (req, reply) => {
    const r = await pool.query(`UPDATE app."設定" SET "値" = $2 WHERE "名前" = $1`, [req.body.名前, req.body.値 ?? ""]);
    if (!r.rowCount) return reply.code(404).send({ error: "この設定はありません。" });
    return { ok: true };
  });

  // 差出人の設定
  app.get("/api/ws/sashidashi", async () => (await pool.query(`SELECT * FROM ${差出人の表} ORDER BY "並び"`)).rows);
  app.post<{ Body: { 区分: string; 社名: string; 店舗: string; 住所: string; TEL: string; FAX: string } }>("/api/ws/sashidashi", async (req, reply) => {
    const b = req.body;
    const r = await pool.query(`UPDATE ${差出人の表} SET "社名" = $2, "店舗" = $3, "住所" = $4, "TEL" = $5, "FAX" = $6 WHERE "区分" = $1`, [
      b.区分, b.社名 ?? "", b.店舗 ?? "", b.住所 ?? "", b.TEL ?? "", b.FAX ?? "",
    ]);
    if (!r.rowCount) return reply.code(404).send({ error: "この差出人はありません。" });
    return { ok: true };
  });
}
