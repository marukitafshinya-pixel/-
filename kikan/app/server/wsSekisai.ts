import type { FastifyInstance } from "fastify";
import type { PoolClient } from "pg";
import { t, 日本の今 } from "./db.js";
import { requireUser } from "./auth.js";
import { 一連で } from "./ws.js";

// 丸北WorkStation の積込確認書一式（Access の FSD_出荷報告印刷 の cmd_積込確認書印刷_Click）。
// 積込み前点検表（R_車両点検表）・積込み個数確認書（R_積込み確認書ver2・積込確認書テーブル作成）・
// 集荷パレットチェックリスト（R_集荷用チェックリスト）・荷台積載イメージ図（R_グラフ作成(積込)ver2・C_積込積載イメージ作成）。
const 輸送計画 = t("ws", "TD_輸送計画");
const 出荷 = t("ws", "TD_出荷");
const 在庫 = t("ws", "TD_在庫");
const 計画の入庫 = t("seizo", "TD_入庫"); // WorkStation の TD_入庫 は製造管理のもの
const 得意先マスタ = t("kyotsu", "TM_得意先マスタ");
const 商品マスタ = t("kyotsu", "TM_商品マスタ");
const パレット調整区分 = t("ws_fe", "TM_パレット調整区分");
const 差出人の表 = t("app", "帳票_差出人");

type Rec = Record<string, any>;
const n = (v: unknown) => Number(v ?? 0) || 0;
const 日付 = (v: unknown) => (v ? String(v).slice(0, 10) : null);
const 通し番号 = (v: unknown) => (v ? Math.round((Date.parse(日付(v) + "T00:00:00Z") - Date.UTC(1899, 11, 30)) / 86400000) : 0);
/** Access の整数の欄に入れたときの丸め（0.5 は偶数の方へ。例：57.5→58、40.5→40） */
const 整数に = (v: number) => {
  const f = Math.floor(v);
  const d = v - f;
  return d > 0.5 || (d === 0.5 && f % 2 === 1) ? f + 1 : f;
};
const 時刻 = (v: unknown) => (v ? String(v).slice(11, 16).replace(/^0/, "") : "");

/**
 * 積込み個数確認書の行（Access の 積込確認書テーブル作成）。丸北（倉庫 10・11）から出す、この便の出荷。
 * 残数は、その在庫（または生産計画）の元の数から、この出荷までに出した数を引いたもの。
 */
async function 確認書の行(c: PoolClient, 輸送ID: number, 出荷日: string): Promise<Rec[]> {
  // もとの在庫：丸北の在庫（在庫ケースが 0 でないもの。認識ID＝在庫ID）と、包装日までの生産計画
  const 元 = new Map<string, Rec>();
  for (const z of (await c.query(`SELECT "在庫ID", "入庫元数", "検体取得" FROM ${在庫} WHERE "倉庫ID" = 11 AND "在庫ケース" <> 0`)).rows)
    元.set(String(z.在庫ID), { 入庫元数: n(z.入庫元数), 検体取得: z.検体取得 });
  for (const z of (
    await c.query(`SELECT "倉庫ID", "商品コード", "製造日", "入庫日", "入庫ID", "ケース", "検体取得" FROM ${計画の入庫} WHERE "chk" = false AND "入庫日" <= $1::date`, [出荷日])
  ).rows)
    元.set(`${n(z.倉庫ID)}${n(z.商品コード)}${通し番号(z.製造日)}${通し番号(z.入庫日)}${n(z.入庫ID)}`, { 入庫元数: n(z.ケース), 検体取得: z.検体取得 });

  const rows = (
    await c.query(
      `SELECT s.*, p."丸北開始時間", u."得意先名" AS "届け先名", k."パレット区分調整"
       FROM ${出荷} s JOIN ${輸送計画} p ON p."輸送ID" = s."輸送ID"
       LEFT JOIN ${得意先マスタ} u ON u."短縮コード" = s."届け先コード"
       LEFT JOIN ${パレット調整区分} k ON k."パレット区分調整ID" = s."パレット区分"
       WHERE s."輸送ID" = $1 AND s."届け先コード" <> 0 AND s."倉庫ID" IN (10, 11)
       ORDER BY s."商品積込順", s."出庫ID"`,
      [輸送ID],
    )
  ).rows;
  const out: Rec[] = [];
  for (const r of rows) {
    const z = 元.get(String(r.認識ID));
    let 残数: number | null = null;
    if (z) {
      // Access と同じく：出荷日がこの日まで・丸北開始時間がこの便まで・出庫ID がこの行まで、の同じ在庫の出荷
      const 出した = n(
        (
          await c.query(
            `SELECT SUM(s."ケース") AS v FROM ${出荷} s JOIN ${輸送計画} p ON p."輸送ID" = s."輸送ID"
             WHERE s."届け先コード" <> 0 AND s."出荷日" <= $1 AND p."丸北開始時間" <= $2 AND s."出庫ID" <= $3 AND s."認識ID" = $4`,
            [r.出荷日, r.丸北開始時間, r.出庫ID, String(r.認識ID)],
          )
        ).rows[0]?.v,
      );
      残数 = z.入庫元数 - 出した;
    }
    out.push({
      順: r.商品積込順, 届け先コード: r.届け先コード, 届け先: r.届け先名 ?? r.届け先, 商品名: r.商品名, 規格: r.規格, ケース: n(r.ケース),
      製造日: 日付(r.製造日), 区分: r.タグ, 備考: r.備考, 補足: r.パレット区分調整 ?? "", 残数,
    });
  }
  return out;
}

/** 積込時の注意事項（Access と同じく、最後の商品の分だけになる） */
async function 注意事項(c: PoolClient, 輸送ID: number): Promise<string> {
  const rows = (
    await c.query(
      `SELECT DISTINCT s."商品コード", s."商品名", m."積込時注意項目" FROM ${出荷} s LEFT JOIN ${商品マスタ} m ON m."商品コード" = s."商品コード"
       WHERE s."輸送ID" = $1 AND s."倉庫ID" IN (10, 11) AND m."積込時注意項目" IS NOT NULL ORDER BY s."商品コード"`,
      [輸送ID],
    )
  ).rows;
  const last = rows[rows.length - 1];
  return last ? `注意事項：${last.商品名} ${last.積込時注意項目}` : "";
}

/**
 * 荷台積載イメージ図の列（Access の C_積込積載イメージ作成）。
 * 商品ごとに、荷台の幅に並ぶ数（2220mm ÷ 箱の幅）× 段数 で 1 列にし、列を前から並べる。ニチレイ大谷地（164）行きは入れない。
 */
async function 積載の列(c: PoolClient, 輸送ID: number, 車両区分ID: number) {
  const 商品 = (
    await c.query(
      `SELECT s."届け先コード", s."商品コード", s."商品名", MIN(s."商品積込順") AS "積込順の最小", SUM(s."ケース") AS "ケース", SUM(s."商品kg") AS "kg",
         m."寸法H", m."寸法L", m."寸法W"
       FROM ${出荷} s LEFT JOIN ${商品マスタ} m ON m."商品コード" = s."商品コード" AND COALESCE(m."寸法H", 0) <> 0
       WHERE s."輸送ID" = $1 AND s."届け先コード" <> 164
       GROUP BY s."届け先コード", s."倉庫ID", s."商品コード", s."商品名", s."chk", m."寸法H", m."寸法L", m."寸法W"
       ORDER BY MIN(s."商品積込順"), s."届け先コード"`,
      [輸送ID],
    )
  ).rows;
  const 寸法 = (r: Rec) => {
    const H = n(r.寸法H), L = n(r.寸法L), W = n(r.寸法W);
    if (!H) return null;
    return { 長さcm: 整数に(L / 10), 高さcm: 整数に(H / 10), 横幅積載数: Math.trunc(2220 / W), 段120: Math.trunc(1200 / H), 段160: Math.trunc(1600 / H), m3: (H / 1000) * (L / 1000) * (W / 1000) };
  };
  const 才数計 = Math.trunc(商品.reduce((a, r) => a + n(r.ケース) * (寸法(r)?.m3 ?? 0) * 36, 0));
  const 単車 = 車両区分ID === 3;
  const 列: Rec[] = [];
  let 積込順 = 0;
  let 前の順 = 0;
  for (const r of 商品) {
    const s = 寸法(r);
    let 残り = n(r.ケース);
    let 商品毎No = 0;
    while (残り > 0) {
      商品毎No++;
      // 商品が変わるごとに積順を数える（Access と同じく、前の積込順が 0 なら 1 に戻す）
      if (前の順 === 0) 積込順 = 1;
      else if (前の順 !== n(r.積込順の最小)) 積込順++;
      前の順 = n(r.積込順の最小);
      const 長さcm = s ? s.長さcm : 57;
      const 高さcm = s ? s.高さcm : 37;
      const 横幅積載数 = s ? s.横幅積載数 : 12;
      // 寸法のない商品は、才数に入れない（Access と同じ）
      const m3 = s ? s.m3 : 0;
      // 段数：単車は才数が 850 以上なら高積み（160cm）、ふだんは 120cm。トレーラーは高積み
      let 段数 = s ? (単車 && 才数計 < 850 ? s.段120 : s.段160) : 0;
      if (n(r.商品コード) === 1286) 段数 = 7;
      if (!段数) 段数 = 3;
      const ブロック = 横幅積載数 * 段数;
      let ケース: number;
      if (残り < ブロック || ブロック === 0) {
        ケース = 残り;
        段数 = Math.trunc(ケース / 横幅積載数 + 0.9);
      } else ケース = ブロック;
      列.push({
        No: 列.length + 1, 商品毎No, 積込順, 商品コード: r.商品コード, 商品名: r.商品名, 届け先コード: r.届け先コード, 長さcm, 高さcm, 横幅積載数,
        段数, ケース, 才数: ケース * m3 * 36, 段高さcm: 高さcm * 段数,
      });
      残り -= ブロック;
      if (ブロック === 0) break;
    }
  }
  const 長さ計 = 列.reduce((a, r) => a + r.長さcm, 0);
  const 才数 = Math.trunc(列.reduce((a, r) => a + r.才数, 0));
  return { 列, 車両大区分: 単車 ? "単車" : "トレーラー", 荷台長: 単車 ? 930 : 1100, 長さ計, 才数, m3: Math.trunc(才数 / 36) };
}

export function wsSekisaiRoutes(app: FastifyInstance) {
  app.addHook("preHandler", requireUser);

  // 積込確認書一式（積込み前点検表・積込み個数確認書・集荷パレットチェックリスト・荷台積載イメージ図）
  app.get<{ Params: { id: string } }>("/api/ws/sekisai/:id", async (req, reply) =>
    一連で(async (c) => {
      const 輸送ID = n(req.params.id);
      const plan = (await c.query(`SELECT * FROM ${輸送計画} WHERE "輸送ID" = $1`, [輸送ID])).rows[0];
      if (!plan) return reply.code(404).send({ error: "この便はありません" });
      // パレット輸送の便は、パレット輸送割付の画面を開く（Access と同じ）
      if (n(plan.パレット輸送区分) === 1) return { パレット輸送: true, 輸送ID };
      const 出荷日 = 日付(plan.出荷計画日)!;
      const 社名 = (await c.query(`SELECT "社名" FROM ${差出人の表} WHERE "区分" = '丸北北海道'`)).rows[0]?.社名 ?? "";
      const 出荷rows = (
        await c.query(
          `SELECT "出庫ID", "商品積込順", "商品名", "製造日", "タグ", "ケース" FROM ${出荷} WHERE "輸送ID" = $1 AND "届け先コード" <> 0 ORDER BY "商品積込順", "出庫ID"`,
          [輸送ID],
        )
      ).rows;
      return {
        印刷日時: 日本の今().日時, 社名,
        便: { 輸送ID, 出荷日, 運送会社名: plan.運送会社名, 車番: plan.車番, 開始: 時刻(plan.丸北開始時間), 終了: 時刻(plan.丸北終了時間) },
        確認書: await 確認書の行(c, 輸送ID, 出荷日),
        注意事項: await 注意事項(c, 輸送ID),
        チェック: 出荷rows.map((r: Rec) => ({ 順: r.商品積込順, 商品名: r.商品名, 製造日: 日付(r.製造日), 区分: r.タグ, 総数: n(r.ケース) })),
        積載: await 積載の列(c, 輸送ID, n(plan.車両区分ID)),
      };
    }),
  );
}
