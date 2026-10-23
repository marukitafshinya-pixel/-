import type { FastifyInstance } from "fastify";
import { q, t } from "./db.js";
import { requireUser } from "./auth.js";
import { 一連で } from "./ws.js";
import { 確認用を作り直す } from "./wsHoukoku.js";

// WEB連携の elixxi 入庫依頼（Access の F_Web出力選択 と C_elixxi入庫登録Ver2 の「何を入れるか」の部分）。
// Access は Edge を動かして elixxi の入庫依頼登録の画面に打ち込み、最後の［登録］は人が押していた。
// Web 版はまず、打ち込む中身（拠点・入庫日・扱い便・明細）を画面と印刷で見られるようにし、登録後に出た受付番号をここで入れる。
const 確認用 = t("ws_fe", "T_入庫依頼書確認用");
const 出荷 = t("ws", "TD_出荷");
const 輸送計画 = t("ws", "TD_輸送計画");
const 得意先 = t("kyotsu", "TM_得意先マスタ");
const 拠点表 = t("web_fe", "TM_elixxi倉庫コードマスタ");
// ニチレイの 5 拠点（大谷地・十勝・大宮・船橋・高松東。Access の画面の絞り込みに直書き）
const 拠点 = [164, 1221, 321, 343, 826];
const 大谷地 = 164;

type Rec = Record<string, any>;
const 年月日2 = (v: unknown) => (v ? `${String(v).slice(2, 4)}/${String(v).slice(5, 7)}/${String(v).slice(8, 10)}` : "");

/** elixxi に入れる中身（C_elixxi入庫登録Ver2 が読むもの）。大谷地はタグごと、ほかはロットごと（名義 11・グループコード2=1 だけ） */
export async function 入庫依頼の中身(出荷日: string, 輸送ID: number, 届け先コード: number, 名義: number) {
  const 共通 = `FROM ${出荷} s JOIN ${輸送計画} p ON p."輸送ID" = s."輸送ID"
       WHERE s."出荷日"::date = $1::date AND s."輸送ID" = $2 AND s."届け先コード" = $3 AND s."入庫後名義ID" = $4`;
  const 明細: Rec[] =
    届け先コード === 大谷地
      ? // Q_入庫依頼書作成（帳票グループ化・入庫備考・タグなども分ける単位に入っている）
        await q(
          `SELECT s."商品コード", s."商品名", s."製造日"::date::text AS "製造日", s."賞味期限"::date::text AS "賞味期限", s."納品日"::date::text AS "納品日",
                  SUM(s."ケース")::float8 AS "ケース", s."タグ", s."取引元ID", p."運送会社名", s."届け先コード"
           ${共通}
           GROUP BY s."商品区分", s."帳票グループ化", s."入庫備考", s."運賃振分区分", s."特別検査区分", s."タグ2", s."輸送ID", p."運送会社ID", p."運送会社名", p."車番",
                    s."出荷日", s."倉庫ID", s."倉庫名", s."商品コード", s."商品名", s."規格", s."入数", s."製造日", s."納品日", s."賞味期限", s."届け先コード", s."届け先",
                    s."入庫後名義ID", s."サンプル区分", s."取引元ID", s."ユーザー伝票No", s."タグ", s."サービス区分"
           ORDER BY s."商品コード", s."製造日", s."賞味期限", s."タグ"`,
          [出荷日, 輸送ID, 届け先コード, 名義],
        )
      : // Q_入庫依頼書作成_区分グループ化（2026/3 から。名義 11 で、届け先のグループコード2 が 1 のものだけ）
        await q(
          `SELECT s."商品コード", s."商品名", s."製造日"::date::text AS "製造日", s."賞味期限"::date::text AS "賞味期限", s."納品日"::date::text AS "納品日",
                  SUM(s."ケース")::float8 AS "ケース", NULL AS "タグ", s."取引元ID", p."運送会社名", s."届け先コード"
           ${共通} AND s."入庫後名義ID" = 11
             AND EXISTS (SELECT 1 FROM ${得意先} k WHERE k."短縮コード" = s."届け先コード" AND k."グループコード2" = 1)
           GROUP BY p."車番", s."出荷日", s."倉庫ID", s."倉庫名", s."商品コード", s."商品名", s."規格", s."入数", s."製造日", s."納品日", s."賞味期限", s."届け先コード",
                    s."届け先", s."入庫後名義ID", s."サンプル区分", s."取引元ID", s."ユーザー伝票No", s."サービス区分", s."運賃振分区分", s."特別検査区分", s."タグ2",
                    s."輸送ID", p."運送会社ID", p."運送会社名"
           ORDER BY s."商品コード", s."製造日", s."賞味期限"`,
          [出荷日, 輸送ID, 届け先コード, 名義],
        );
  if (!明細.length) return null;
  const 先頭 = 明細[0];
  const k = (await q(`SELECT "相手方届け先コード", "届け先" FROM ${拠点表} WHERE "自社コード" = $1 ORDER BY "ID" LIMIT 1`, [Number(先頭.届け先コード)]))[0];
  return {
    拠点コード: k?.相手方届け先コード ?? "",
    拠点名: k?.届け先 ?? "",
    入庫日: 年月日2(先頭.納品日),
    扱い便名: 先頭.運送会社名 ?? "",
    明細: 明細.map((r) => ({
      商品CD: r.商品コード,
      品名: r.商品名,
      // 大谷地は「タグ 取引元ID」、ほかは取引元ID
      マーク: 届け先コード === 大谷地 ? `${r.タグ ?? ""} ${r.取引元ID ?? ""}` : String(r.取引元ID ?? ""),
      入庫予定個数: r.ケース,
      製造日: 年月日2(r.製造日),
      賞味期限: 年月日2(r.賞味期限),
    })),
    件数: 明細.length,
    ケース計: 明細.reduce((a, r) => a + Number(r.ケース ?? 0), 0),
  };
}

export function webElixxiNyukoRoutes(app: FastifyInstance) {
  app.addHook("preHandler", requireUser);

  // 画面を開いたとき：入庫依頼書確認用を作り直す（Access の Form_Open → C_入庫依頼書確認用）
  app.post("/api/web/elixxi/nyuko/open", async () => {
    await 一連で((c) => 確認用を作り直す(c));
    return { ok: true };
  });

  // 出荷計画日の一覧（倉庫向け・ニチレイ 5 拠点）
  app.get<{ Querystring: { 日付?: string } }>("/api/web/elixxi/nyuko/list", async (req, reply) => {
    const 日付 = req.query.日付 ?? "";
    if (!/^\d{4}-\d{2}-\d{2}$/.test(日付)) return reply.code(400).send({ error: "日付が正しくありません" });
    return q(
      `SELECT "ID", "出荷計画日"::date::text AS "出荷計画日", "納品日"::date::text AS "納品日", "届け先コード", "届け先", "入庫後名義ID", "入庫後名義名",
              "ケース", "商品kg", "輸送ID", "運送会社ID", "運送会社名", "車番", "入庫受付番号"
       FROM ${確認用}
       WHERE "ユーザー区分名" = '倉庫' AND "届け先コード" = ANY($2::int[]) AND "出荷計画日"::date = $1::date
       ORDER BY "出荷計画日", "届け先コード", "入庫後名義ID"`,
      [日付, 拠点],
    );
  });

  // 受付番号を入れる（elixxi で登録したあとに出た番号を写す）
  app.post<{ Body: { ID: number; 入庫受付番号: string | null } }>("/api/web/elixxi/nyuko/uketsuke", async (req, reply) => {
    const r = await q(`UPDATE ${確認用} SET "入庫受付番号" = $2 WHERE "ID" = $1::int RETURNING "ID"`, [req.body.ID, req.body.入庫受付番号?.trim() || null]);
    if (!r.length) return reply.code(404).send({ error: "その行は見つかりません（一覧を開き直してください）" });
    return { ok: true };
  });

  // 選んだ行：出荷内訳（商品ごとのケース）と、elixxi に入れる中身
  app.get<{ Querystring: { ID?: string } }>("/api/web/elixxi/nyuko/detail", async (req, reply) => {
    const 行 = (await q(`SELECT * FROM ${確認用} WHERE "ID" = $1::int`, [Number(req.query.ID)]))[0];
    if (!行) return reply.code(404).send({ error: "その行は見つかりません（一覧を開き直してください）" });
    const 内訳 = await q(
      `SELECT "倉庫名", "商品コード", "商品名", SUM("ケース")::float8 AS "ケース"
       FROM ${出荷} WHERE "輸送ID" = $1 AND "届け先コード" = $2 AND "入庫後名義ID" = $3
       GROUP BY "輸送ID", "届け先コード", "届け先", "納品日", "倉庫名", "商品コード", "商品名", "入庫後名義ID" ORDER BY "商品コード"`,
      [行.輸送ID, 行.届け先コード, 行.入庫後名義ID],
    );
    // Access は画面の「出荷予定日」（＝出荷計画日）を、出荷の「出荷日」と比べて探す
    const 中身 = await 入庫依頼の中身(String(行.出荷計画日).slice(0, 10), Number(行.輸送ID), Number(行.届け先コード), Number(行.入庫後名義ID));
    return { 内訳, 中身 };
  });
}
