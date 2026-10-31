import type { FastifyInstance } from "fastify";
import { q, t, 日本の今 } from "./db.js";
import { requireUser } from "./auth.js";

// ニチレイ入庫リスト（Access の WorkStation の F_入庫リスト表示 と、その［入庫リスト表示］で出す
// R_ニチレイ専用入庫リスト_ニチレイ大谷地・R_ニチレイ専用入庫リスト）。
// 冷蔵庫（TM_週間予定表マスタ）と納品日の範囲で、その冷蔵庫に届ける出荷（Q_出荷レコード：便に入っている出荷）を出す。
const 出荷 = t("ws", "TD_出荷");
const 輸送計画 = t("ws", "TD_輸送計画");
const 商品マスタ = t("kyotsu", "TM_商品マスタ");
const 得意先マスタ = t("kyotsu", "TM_得意先マスタ");
const 冷蔵庫の表 = t("ws_fe", "TM_週間予定表マスタ");
const 確認用 = t("ws_fe", "T_入庫依頼書確認用");
const 差出人の表 = t("app", "帳票_差出人");

type Rec = Record<string, any>;
const n = (v: unknown) => Number(v ?? 0) || 0;
const 日付か = (v: unknown) => /^\d{4}-\d{2}-\d{2}$/.test(String(v ?? ""));

export function wsNyukoListRoutes(app: FastifyInstance) {
  app.addHook("preHandler", requireUser);

  // 冷蔵庫の選択肢（cbo の値リスト：TM_週間予定表マスタ）
  app.get("/api/ws/nyuko-list/soko", async () =>
    q(`SELECT "届け先コード" AS id, "届け先名" AS name FROM ${冷蔵庫の表} WHERE COALESCE("使用不可", false) = false ORDER BY "ID"`),
  );

  // 画面の一覧（F_入庫リスト表示）：届け先・納品日・本社コード・賞味期限・製造日・タグの順
  app.get<{ Querystring: { soko: string; from: string; to: string } }>("/api/ws/nyuko-list", async (req, reply) => {
    const { soko, from, to } = req.query;
    if (!n(soko) || !日付か(from) || !日付か(to)) return reply.code(400).send({ error: "冷蔵庫と納品日を選んでください" });
    return q(
      `SELECT s."出庫ID", s."納品日"::date::text AS "納品日", s."商品コード", s."商品名", s."ケース", s."商品kg", s."タグ",
              s."入庫後名義ID", b."短縮名" AS "入庫後名義", COALESCE(s."積込確認", false) AS "積込確認", COALESCE(s."chk", false) AS "chk"
       FROM ${輸送計画} y JOIN ${出荷} s ON s."輸送ID" = y."輸送ID"
       LEFT JOIN ${商品マスタ} m ON m."商品コード" = s."商品コード"
       LEFT JOIN ${得意先マスタ} b ON b."短縮コード" = s."入庫後名義ID"
       WHERE s."届け先コード" = $1 AND s."納品日"::date BETWEEN $2::date AND $3::date
       ORDER BY s."届け先コード", s."納品日", m."本社コード", s."賞味期限", s."製造日", s."タグ", s."出庫ID"`,
      [n(soko), from, to],
    );
  });

  // 印刷（cmd_週間表_Click）：届け先がニチレイのグループ（グループコード 400）の出荷。
  // 大谷地（164）は 1 行ずつ（R_ニチレイ専用入庫リスト_ニチレイ大谷地）、ほかは同じ商品・ロットをまとめる（R_ニチレイ専用入庫リスト。2026/03/27 Access の改定）
  app.get<{ Querystring: { soko: string; from: string; to: string } }>("/api/ws/nyuko-list/print", async (req, reply) => {
    const { soko, from, to } = req.query;
    if (!n(soko) || !日付か(from) || !日付か(to)) return reply.code(400).send({ error: "冷蔵庫と納品日を選んでください" });
    const 大谷地 = n(soko) === 164;
    const 行 = await q(
      `SELECT s."納品日"::date::text AS "納品日", s."出荷日"::date::text AS "出荷日", s."輸送ID", s."倉庫名" AS "出荷場所", s."商品コード", s."商品名",
              ${大谷地 ? `s."ケース"::float8 AS "ケース", s."商品kg"::float8 AS "商品kg"` : `SUM(s."ケース")::float8 AS "ケース", SUM(s."商品kg")::float8 AS "商品kg"`},
              s."製造日"::date::text AS "製造日", s."賞味期限"::date::text AS "賞味期限", y."運送会社名", y."車号" AS "運行指示No",
              s."入庫後名義ID", MAX(b."短縮名") AS "名義", MAX(k."入庫受付番号") AS "受付No"
       FROM ${輸送計画} y JOIN ${出荷} s ON s."輸送ID" = y."輸送ID"
       JOIN ${得意先マスタ} g ON g."短縮コード" = s."届け先コード" AND g."グループコード" = 400
       LEFT JOIN ${得意先マスタ} b ON b."短縮コード" = s."入庫後名義ID"
       LEFT JOIN ${確認用} k ON k."輸送ID" = s."輸送ID" AND k."届け先コード" = s."届け先コード" AND k."納品日"::date = s."納品日"::date AND k."入庫後名義ID" = s."入庫後名義ID"
       WHERE s."届け先コード" = $1 AND s."納品日"::date BETWEEN $2::date AND $3::date
       GROUP BY s."納品日", s."出荷日", s."輸送ID", s."倉庫ID", s."倉庫名", s."商品コード", s."商品名", s."製造日", s."賞味期限", y."運送会社名", y."車号", s."入庫後名義ID"
                ${大谷地 ? `, s."出庫ID", s."ケース", s."商品kg", s."商品積込順"` : ""}
       ORDER BY s."入庫後名義ID", s."納品日", s."出荷日", s."輸送ID", ${大谷地 ? `s."商品積込順", s."出庫ID"` : `MIN(s."商品積込順"), s."商品コード", s."製造日"`}`,
      [n(soko), from, to],
    );
    const 入庫先 = (await q(`SELECT "届け先名" FROM ${冷蔵庫の表} WHERE "届け先コード" = $1 LIMIT 1`, [n(soko)]))[0]?.届け先名 ?? "";
    const 社名 = (await q(`SELECT "社名" FROM ${差出人の表} WHERE "区分" = '丸北北海道'`))[0]?.社名 ?? "";
    // 名義ごとに分ける（帳票の 名義 の見出し）
    const 名義ごと = new Map<number, Rec>();
    for (const r of 行) {
      const k = n(r.入庫後名義ID);
      if (!名義ごと.has(k)) 名義ごと.set(k, { 名義: r.名義 ?? "", 行: [] });
      名義ごと.get(k)!.行.push(r);
    }
    return { 大谷地, 入庫先, 社名, 開始: from, 終了: to, 作成時間: 日本の今().日時, 名義: [...名義ごと.values()] };
  });
}
