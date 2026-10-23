import type { FastifyInstance } from "fastify";
import { q, t } from "./db.js";
import { requireUser } from "./auth.js";

// WEB連携の販盛（Access の F_販盛在庫移動・F_販盛仕入入力 と M_販盛RPA の「何を入れるか」）。
// Access は Edge（IE モード）を動かして社内の販盛に打ち込み、最後は人が在庫を選んで登録していた。
// Web 版はまず、打ち込む中身を画面と印刷で見られるようにする（販盛は社内のサーバーなので、入力の補助は本物で試してから）。
const 確認用 = t("ws_fe", "T_入庫依頼書確認用");
const 出荷 = t("ws", "TD_出荷");
const 輸送計画 = t("ws", "TD_輸送計画");
const 得意先 = t("kyotsu", "TM_得意先マスタ");
const 商品 = t("kyotsu", "TM_商品マスタ");
// 販盛の倉庫・取引先のコード（Access の直書きと同じ）
const 移動元倉庫 = "001";
const 仕入先コード = "00055001";
const ふらの工場 = 191;
const 大谷地 = 164;
/** 販盛の倉庫・納入先コード（届け先 4563 は 405、仕入の 164 は 0164。ほかは届け先コードのまま） */
const 移動先コード = (届け先: number) => (届け先 === 4563 ? "405" : String(届け先));
const 納入先コード = (届け先: number) => (届け先 === 4563 ? "405" : 届け先 === 大谷地 ? "0164" : String(届け先));

type Rec = Record<string, any>;
const 年月日 = (v: unknown) => (v ? String(v).slice(0, 10).replace(/-/g, "/") : "");

/** 商品コード → 販盛の商品コード（TM_商品マスタ.繁盛商品コード） */
async function 販盛コード(商品コード: number[]) {
  const m = new Map<number, string>();
  if (!商品コード.length) return m;
  for (const r of await q(`SELECT "商品コード", "繁盛商品コード" FROM ${商品} WHERE "商品コード" = ANY($1::int[])`, [商品コード]))
    m.set(Number(r.商品コード), String(r.繁盛商品コード ?? ""));
  return m;
}

/** 在庫移動の中身（C_販盛在庫移動自動入力。大谷地は Q_入庫依頼書作成、ほかは …区分グループ化。出荷日では絞らない：Access のまま） */
export async function 在庫移動の中身(輸送ID: number, 届け先コード: number) {
  const 行: Rec[] =
    届け先コード === 大谷地
      ? await q(
          `SELECT s."出荷日"::date::text AS "出荷日", s."納品日"::date::text AS "納品日", s."商品コード", s."商品名", s."賞味期限"::date::text AS "賞味期限",
                  SUM(s."ケース")::float8 AS "ケース"
           FROM ${出荷} s JOIN ${輸送計画} p ON p."輸送ID" = s."輸送ID"
           WHERE s."輸送ID" = $1 AND s."届け先コード" = $2
           GROUP BY s."商品区分", s."帳票グループ化", s."入庫備考", s."運賃振分区分", s."特別検査区分", s."タグ2", s."輸送ID", p."運送会社ID", p."運送会社名", p."車番",
                    s."出荷日", s."倉庫ID", s."倉庫名", s."商品コード", s."商品名", s."規格", s."入数", s."製造日", s."納品日", s."賞味期限", s."届け先コード", s."届け先",
                    s."入庫後名義ID", s."サンプル区分", s."取引元ID", s."ユーザー伝票No", s."タグ", s."サービス区分"
           ORDER BY s."商品区分", s."帳票グループ化", s."入庫備考", s."運賃振分区分", s."特別検査区分", s."タグ2", s."輸送ID", p."運送会社ID", p."運送会社名", p."車番",
                    s."出荷日", s."倉庫ID", s."倉庫名", s."商品コード", s."商品名", s."規格", s."入数", s."製造日", s."納品日", s."賞味期限", s."タグ"`,
          [輸送ID, 届け先コード],
        )
      : await q(
          `SELECT s."出荷日"::date::text AS "出荷日", s."納品日"::date::text AS "納品日", s."商品コード", s."商品名", s."賞味期限"::date::text AS "賞味期限",
                  SUM(s."ケース")::float8 AS "ケース"
           FROM ${出荷} s JOIN ${輸送計画} p ON p."輸送ID" = s."輸送ID"
           WHERE s."輸送ID" = $1 AND s."届け先コード" = $2 AND s."入庫後名義ID" = 11
             AND EXISTS (SELECT 1 FROM ${得意先} k WHERE k."短縮コード" = s."届け先コード" AND k."グループコード2" = 1)
           GROUP BY p."車番", s."出荷日", s."倉庫ID", s."倉庫名", s."商品コード", s."商品名", s."規格", s."入数", s."製造日", s."納品日", s."賞味期限", s."届け先コード",
                    s."届け先", s."入庫後名義ID", s."サンプル区分", s."取引元ID", s."ユーザー伝票No", s."サービス区分", s."運賃振分区分", s."特別検査区分", s."タグ2",
                    s."輸送ID", p."運送会社ID", p."運送会社名"
           ORDER BY p."車番", s."出荷日", s."倉庫ID", s."倉庫名", s."商品コード", s."商品名", s."規格", s."入数", s."製造日", s."納品日", s."賞味期限"`,
          [輸送ID, 届け先コード],
        );
  if (!行.length) return null;
  const コード = await 販盛コード([...new Set(行.map((r) => Number(r.商品コード)))]);
  return {
    伝票日: 年月日(行[0].出荷日),
    完了日: 年月日(行[0].納品日),
    移動元倉庫,
    移動先倉庫: 移動先コード(届け先コード),
    明細: 行.map((r) => ({
      商品コード: r.商品コード,
      商品名: r.商品名,
      販盛商品コード: コード.get(Number(r.商品コード)) ?? "",
      単位: "3",
      数量: r.ケース,
      詳細日付1: 年月日(r.賞味期限),
    })),
    件数: 行.length,
    ケース計: 行.reduce((a, r) => a + Number(r.ケース ?? 0), 0),
  };
}

/** 仕入の中身（C_販盛仕入自動入力。AQ_ふらの出荷：倉庫 191 の出荷を 便・商品・ロットごとに合計） */
export async function 仕入の中身(輸送ID: number, 届け先コード: number) {
  const 行 = await q(
    `SELECT "出荷日"::date::text AS "出荷日", "納品日"::date::text AS "納品日", "商品コード", "商品名", "賞味期限"::date::text AS "賞味期限",
            SUM("ケース")::float8 AS "ケースの合計"
     FROM ${出荷} WHERE "倉庫ID" = $3 AND "輸送ID" = $1 AND "届け先コード" = $2
     GROUP BY "出荷日", "輸送ID", "商品コード", "商品名", "製造日", "賞味期限", "届け先コード", "届け先", "納品日"
     ORDER BY "出荷日", "輸送ID", "商品コード", "商品名", "製造日", "賞味期限"`,
    [輸送ID, 届け先コード, ふらの工場],
  );
  if (!行.length) return null;
  const コード = await 販盛コード([...new Set(行.map((r) => Number(r.商品コード)))]);
  return {
    伝票日: 年月日(行[0].出荷日),
    送付日: 年月日(行[0].出荷日),
    入荷日: 年月日(行[0].納品日),
    仕入先: 仕入先コード,
    納入先: 納入先コード(届け先コード),
    明細: 行.map((r) => ({
      商品コード: r.商品コード,
      商品名: r.商品名,
      販盛商品コード: コード.get(Number(r.商品コード)) ?? "",
      エリア: "3",
      数量: r.ケースの合計,
      倉庫: String(ふらの工場),
      賞味期限: 年月日(r.賞味期限),
    })),
    件数: 行.length,
    ケース計: 行.reduce((a, r) => a + Number(r.ケースの合計 ?? 0), 0),
  };
}

export function webHanmoriRpaRoutes(app: FastifyInstance) {
  app.addHook("preHandler", requireUser);

  // 在庫移動：選んだ行（入庫依頼書確認用。一覧は elixxi 入庫依頼と同じ）の出荷内訳・在庫移動の中身・行ごとのロット統合の中身
  app.get<{ Querystring: { ID?: string } }>("/api/web/hanmori/idou/detail", async (req, reply) => {
    const 行 = (await q(`SELECT * FROM ${確認用} WHERE "ID" = $1::int`, [Number(req.query.ID)]))[0];
    if (!行) return reply.code(404).send({ error: "その行は見つかりません（一覧を開き直してください）" });
    const 内訳 = await q(
      `SELECT "倉庫名", "商品コード", "商品名", SUM("ケース")::float8 AS "ケース", "賞味期限"::date::text AS "賞味期限", "製造日"::date::text AS "製造日"
       FROM ${出荷} WHERE "輸送ID" = $1 AND "届け先コード" = $2 AND "入庫後名義ID" = $3
       GROUP BY "輸送ID", "届け先コード", "届け先", "納品日", "倉庫名", "商品コード", "商品名", "賞味期限", "製造日", "入庫後名義ID"
       ORDER BY "商品コード", "製造日"`,
      [行.輸送ID, 行.届け先コード, 行.入庫後名義ID],
    );
    // ロット統合（C_販盛在庫統合自動入力）：内訳の行ごとに 倉庫 001・製造日・商品
    const コード = await 販盛コード([...new Set(内訳.map((r) => Number(r.商品コード)))]);
    for (const r of 内訳) Object.assign(r, { 統合: { 倉庫: 移動元倉庫, 製造日: 年月日(r.製造日), 販盛商品コード: コード.get(Number(r.商品コード)) ?? "" } });
    return { 内訳, 中身: await 在庫移動の中身(Number(行.輸送ID), Number(行.届け先コード)) };
  });

  // 仕入入力：出荷計画日の便のうち、ふらの工場（倉庫 191）から出るもの（便・届け先ごと）
  app.get<{ Querystring: { 日付?: string } }>("/api/web/hanmori/shiire/list", async (req, reply) => {
    const 日付 = req.query.日付 ?? "";
    if (!/^\d{4}-\d{2}-\d{2}$/.test(日付)) return reply.code(400).send({ error: "日付が正しくありません" });
    return q(
      `SELECT k."輸送ID", k."運送会社ID", k."運送会社名", k."車番", s."倉庫ID", s."倉庫名", s."納品日"::date::text AS "納品日", s."届け先コード", s."届け先",
              k."出荷計画日"::date::text AS "出荷計画日"
       FROM ${輸送計画} k LEFT JOIN ${出荷} s ON s."輸送ID" = k."輸送ID"
       WHERE s."倉庫ID" = $2 AND k."出荷計画日"::date = $1::date
       GROUP BY k."輸送ID", k."運送会社ID", k."運送会社名", k."車番", s."倉庫ID", s."倉庫名", s."納品日", s."届け先コード", s."届け先", k."出荷計画日"
       ORDER BY k."出荷計画日", k."輸送ID", s."届け先コード"`,
      [日付, ふらの工場],
    );
  });

  // 仕入入力：選んだ便・届け先の出荷内訳と仕入の中身
  app.get<{ Querystring: { 輸送ID?: string; 届け先?: string } }>("/api/web/hanmori/shiire/detail", async (req) => {
    const 輸送ID = Number(req.query.輸送ID);
    const 届け先 = Number(req.query.届け先);
    const 内訳 = await q(
      `SELECT "倉庫ID", "商品コード", "商品名", SUM("ケース")::float8 AS "ケース", "賞味期限"::date::text AS "賞味期限", "製造日"::date::text AS "製造日"
       FROM ${出荷} WHERE "倉庫ID" = $3 AND "輸送ID" = $1 AND "届け先コード" = $2
       GROUP BY "輸送ID", "届け先コード", "届け先", "納品日", "倉庫ID", "商品コード", "商品名", "賞味期限", "製造日", "入庫後名義ID"
       ORDER BY "商品コード", "製造日"`,
      [輸送ID, 届け先, ふらの工場],
    );
    return { 内訳, 中身: await 仕入の中身(輸送ID, 届け先) };
  });
}
