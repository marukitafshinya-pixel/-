import type { FastifyInstance } from "fastify";
import { q, t, 日本の今 } from "./db.js";
import { requireUser } from "./auth.js";
import { 一連で } from "./ws.js";
import { 寄託者コード } from "./webRenkei.js";

// WEB連携の elixxi 出庫依頼（Access の F_出庫リスト表示 と C_elixxi出庫出力Ver2 の「何を入れるか」、C_外部番号受注紐づけ）。
// Access は Edge を動かして elixxi の出庫依頼登録の画面に打ち込み、最後の［登録］は人が押していた。
// Web 版はまず、打ち込む中身（拠点・出庫日・納品日・依頼No・摘要・出庫先・扱い便・明細）を画面と印刷で見られるようにする。
const 輸送計画 = t("soko", "TD_輸送計画");
const 出庫 = t("soko", "TD_出荷");
const 受注 = t("juchu", "TD_受注");
const 得意先 = t("kyotsu", "TM_得意先マスタ");
const 相手先商品 = t("kyotsu", "TM_相手先商品マスタ");
const 拠点表 = t("web_fe", "TM_elixxi倉庫コードマスタ");
const 積み日表 = t("web_fe", "TM_ニチレイ大谷地積み日指定表示マスタ");
// ニチレイの 5 拠点（大谷地・十勝・大宮・船橋・高松東）
const 拠点 = [164, 1221, 321, 343, 826];
const 日洋 = 350;
const 日洋のNDF届け先 = [3230, 6693];

type Rec = Record<string, any>;
const 年月日2 = (v: unknown) => (v ? `${String(v).slice(2, 4)}/${String(v).slice(5, 7)}/${String(v).slice(8, 10)}` : "");
/** Access の Format(日付, "m月d日(aaa)") */
const 月日曜 = (v: string) => {
  const d = new Date(v.slice(0, 10) + "T00:00:00Z");
  return `${d.getUTCMonth() + 1}月${d.getUTCDate()}日(${"日月火水木金土"[d.getUTCDay()]})`;
};

/** elixxi の扱い便コード（拠点ごとの決まり。大谷地は運送会社 160 のときだけ入れる） */
function 扱い便コード(倉庫ID: number, 運送会社ID: number): string {
  switch (倉庫ID) {
    case 164:
      return 運送会社ID === 160 ? String(運送会社ID) : "";
    case 1221:
    case 826:
      return String(運送会社ID);
    case 321:
      return 運送会社ID === 17 || 運送会社ID === 24 ? "0" + 運送会社ID : String(運送会社ID);
    case 343:
      return 運送会社ID === 130 ? 運送会社ID + "00" : 運送会社ID + "000";
    default:
      return "";
  }
}

/** elixxi に入れる中身（C_elixxi出庫出力Ver2 が読むもの：Q_出庫レコード のその便。並びは商品・製造日・賞味期限・タグ） */
export async function 出庫依頼の中身(輸送ID: number) {
  const 行 = await q(
    `SELECT k."出荷計画日"::date::text AS "出荷計画日", k."運送会社ID", k."運送会社名", s."倉庫ID", s."納品日"::date::text AS "納品日", s."受注ID",
            s."届け先コード", s."届け先", s."取引元ID", s."商品コード", s."商品名", s."ユーザー伝票No", s."入庫No", s."ケース", s."製造日"::date::text AS "製造日",
            s."賞味期限"::date::text AS "賞味期限", s."タグ", s."入庫前名義ID"
     FROM ${輸送計画} k JOIN ${出庫} s ON s."輸送ID" = k."輸送ID"
     WHERE k."輸送ID" = $1
     ORDER BY s."商品コード", s."製造日", s."賞味期限", s."タグ", s."出庫ID"`,
    [輸送ID],
  );
  if (!行.length) return null;
  const r = 行[0];
  const 倉庫ID = Number(r.倉庫ID);
  const k = (await q(`SELECT "相手方届け先コード", "届け先" FROM ${拠点表} WHERE "自社コード" = $1 ORDER BY "ID" LIMIT 1`, [倉庫ID]))[0];
  let 依頼No = "";
  let 摘要 = "";
  if (倉庫ID === 321) 依頼No = r.受注ID === null ? "" : String(r.受注ID); // 大宮：照合用に自社の受注ID
  else if (倉庫ID === 164 && r.納品日) {
    // 大谷地：積み日を出す届け先なら「m月d日(曜) 積み」（納品日の日付で書く。Access のまま）
    const あり = (await q(`SELECT 1 FROM ${積み日表} WHERE "得意先短縮コード" = $1 LIMIT 1`, [Number(r.届け先コード ?? 0)])).length > 0;
    if (あり) 摘要 = `${月日曜(r.納品日)} 積み`;
  }
  if (Number(r.取引元ID) === 日洋 && 日洋のNDF届け先.includes(Number(r.届け先コード))) {
    // 日洋の 2 か所：「発注:（ユーザー伝票No） NDF:（相手先商品コードの下 6 桁）」。同じ摘要の欄に続けて入る
    const a = (await q(`SELECT "相手先商品コード" FROM ${相手先商品} WHERE "受注元コード" = $1 AND "商品コード" = $2 LIMIT 1`, [日洋, Number(r.商品コード)]))[0];
    const ndf = String(a?.相手先商品コード ?? "");
    摘要 += `発注:${r.ユーザー伝票No ?? ""} NDF:${ndf.slice(-6)}`;
  }
  return {
    拠点コード: k?.相手方届け先コード ?? "",
    拠点名: k?.届け先 ?? "",
    出庫日: 年月日2(r.出荷計画日),
    納品日: 年月日2(r.納品日),
    依頼No,
    摘要,
    出庫先コード: r.届け先コード,
    出庫先名: r.届け先 ?? "",
    扱い便コード: 扱い便コード(倉庫ID, Number(r.運送会社ID)),
    扱い便名: r.運送会社名 ?? "",
    名義: r.入庫前名義ID,
    明細: 行.map((x) => ({
      入庫No: x.入庫No ? String(x.入庫No).slice(0, 8) + String(x.入庫No).slice(-2) : "",
      出庫個数: x.ケース,
      商品コード: x.商品コード,
      商品名: x.商品名,
      製造日: 年月日2(x.製造日),
      賞味期限: 年月日2(x.賞味期限),
    })),
    件数: 行.length,
    ケース計: 行.reduce((a, x) => a + Number(x.ケース ?? 0), 0),
  };
}

export function webElixxiShukkoRoutes(app: FastifyInstance) {
  app.addHook("preHandler", requireUser);

  // 出庫場所の選択肢（ニチレイ 5 拠点の短縮名）
  app.get("/api/web/elixxi/shukko/basho", async () =>
    q(`SELECT DISTINCT ON ("短縮コード") "短縮コード", "短縮名" FROM ${得意先} WHERE "短縮コード" = ANY($1::int[]) ORDER BY "短縮コード"`, [拠点]),
  );

  // 便の一覧（倉庫管理の便。出荷計画日が 30 日前より後。期間と出庫場所で絞る）
  app.get<{ Querystring: { 開始?: string; 終了?: string; 場所?: string } }>("/api/web/elixxi/shukko/list", async (req, reply) => {
    const { 開始 = "", 終了 = "", 場所 = "" } = req.query;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(開始) || !/^\d{4}-\d{2}-\d{2}$/.test(終了)) return reply.code(400).send({ error: "日付が正しくありません" });
    const 今日 = 日本の今().日付;
    return q(
      `SELECT k."輸送ID", k."出荷計画日"::date::text AS "出荷計画日", k."出庫場所ID", k."出庫場所", k."出庫No", k."運送会社ID", k."運送会社名", k."車番",
              k."運行指令No", k."車号",
              MIN(s."納品日")::date::text AS "納品日", string_agg(DISTINCT s."届け先", '・') AS "届け先", SUM(s."ケース")::int AS "ケース"
       FROM ${輸送計画} k LEFT JOIN ${出庫} s ON s."輸送ID" = k."輸送ID"
       WHERE k."出荷計画日" > ($1::date - 30) AND k."出荷計画日"::date BETWEEN $2::date AND $3::date AND ($4::int IS NULL OR k."出庫場所ID" = $4::int)
       GROUP BY k."輸送ID", k."出荷計画日", k."出庫場所ID", k."出庫場所", k."出庫No", k."運送会社ID", k."運送会社名", k."車番", k."運行指令No", k."車号"
       ORDER BY k."出荷計画日", k."出庫場所ID", k."出庫No", k."輸送ID"`,
      [今日, 開始, 終了, 場所 === "" ? null : Number(場所)],
    );
  });

  // 選んだ便の elixxi 出庫依頼の中身
  app.get<{ Querystring: { 輸送ID?: string } }>("/api/web/elixxi/shukko/detail", async (req) => {
    const 中身 = await 出庫依頼の中身(Number(req.query.輸送ID));
    // 寄託者は 1 行目の入庫前名義で切り替える（設定に入っているときだけ）
    if (中身) Object.assign(中身, { 寄託者: await 寄託者コード(req.user?.login ?? "", Number(中身.名義)) });
    return { 中身 };
  });

  // 運行指令No・車号を入れる。運行指令No を変えたときは受注登録に書き戻す（C_外部番号受注紐づけ）
  app.post<{ Body: { 輸送ID: number; 項目: "運行指令No" | "車号"; 値: string | null } }>("/api/web/elixxi/shukko/bango", async (req, reply) => {
    const { 輸送ID, 項目, 値 } = req.body;
    if (項目 !== "運行指令No" && 項目 !== "車号") return reply.code(400).send({ error: "項目が正しくありません" });
    const v = (値 ?? "").trim();
    if (項目 === "運行指令No" && v !== "" && !/^\d{1,9}$/.test(v)) return reply.code(400).send({ error: "運行指令No は数字で入れてください" });
    if (!(await q(`SELECT 1 FROM ${輸送計画} WHERE "輸送ID" = $1::int`, [輸送ID])).length) return reply.code(404).send({ error: "その便は見つかりません" });
    return 一連で(async (c) => {
      const r = await c.query(`UPDATE ${輸送計画} SET "${項目}" = $2 WHERE "輸送ID" = $1::int RETURNING "運行指令No", "車号"`, [
        輸送ID,
        v === "" ? null : 項目 === "運行指令No" ? Number(v) : v,
      ]);
      let 受注件数 = 0;
      if (項目 === "運行指令No") {
        const { 運行指令No, 車号 } = r.rows[0] as Rec;
        const 出庫番号 = 運行指令No === null ? null : String(運行指令No);
        const 輸送番号 = 車号 === null || 車号 === "" ? null : String(車号);
        // 便の出庫ごとに、その受注へ 手配出庫番号＝運行指令No・手配輸送番号＝車号。値があれば確認の印を付ける（外すことはしない：Access のまま）
        for (const s of (await c.query(`SELECT DISTINCT "受注ID" FROM ${出庫} WHERE "輸送ID" = $1 AND "受注ID" IS NOT NULL`, [輸送ID])).rows as Rec[]) {
          const u = await c.query(
            `UPDATE ${受注} SET "手配出庫番号" = $2::text, "手配輸送番号" = $3::text,
                    "受注出庫確認" = CASE WHEN $2::text IS NOT NULL THEN true ELSE "受注出庫確認" END,
                    "出庫返信FAX確認" = CASE WHEN $2::text IS NOT NULL THEN true ELSE "出庫返信FAX確認" END,
                    "手配DataChk" = CASE WHEN $3::text IS NOT NULL THEN true ELSE "手配DataChk" END,
                    "輸送手配返信確認" = CASE WHEN $3::text IS NOT NULL THEN true ELSE "輸送手配返信確認" END
             WHERE "受注ID" = $1`,
            [s.受注ID, 出庫番号, 輸送番号],
          );
          受注件数 += u.rowCount ?? 0;
        }
      }
      return { ok: true, 受注件数 };
    });
  });
}
