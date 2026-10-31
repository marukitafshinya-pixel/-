import type { FastifyInstance } from "fastify";
import { q, t, 日本の今 } from "./db.js";
import { requireUser } from "./auth.js";
import { cint } from "./hanmori.js";
import { 出荷レコード } from "./shohinSuii.js";

// 全体在庫（丸北商品推移の FM_現在在庫表示）。［集計］で、集計開始日〜集計終了日の
// 製造（CC_製造集計_丸北）・WorkStation の在庫（CC_在庫集計_丸北）・倉庫管理の在庫（CC_在庫集計_倉庫）を
// 倉庫・商品ごとにまとめ（CC_在庫グループ化）、在庫率（CC_全体在庫率集計）を出す。
// Access は作業用の表（TD_架空在庫_新・_新G）に入れていたが、Web 版はその場で計算して返す（表には書かない）。
const 入庫 = t("seizo", "TD_入庫");
const 得意先マスタ = t("kyotsu", "TM_得意先マスタ");
const 商品マスタ = t("kyotsu", "TM_商品マスタ");
const 受注 = t("juchu", "TD_受注");

type Rec = Record<string, any>;
const n = (v: unknown) => Number(v ?? 0) || 0;
const 日付か = (v: unknown) => /^\d{4}-\d{2}-\d{2}$/.test(String(v ?? ""));
/** Access の Sum：全部が空（Null）なら空 */
const 足す = (a: number | null, b: number | null) => (a === null ? b : b === null ? a : a + b);
const 日を足す = (d: string, k: number) => new Date(Date.parse(d + "T00:00:00Z") + k * 86400000).toISOString().slice(0, 10);

/** 在庫の表（WorkStation・倉庫管理）ごとの 1 行ずつの集計（CC_在庫集計_丸北・_倉庫） */
function 在庫の集計(場所: "ws" | "soko") {
  const 在庫 = t(場所, "TD_在庫");
  const 出荷 = t(場所, "TD_出荷");
  const 変更 = t(場所, "TD_在庫変更");
  // WorkStation は倉庫 10・112 と商品 697（サンプル）を除き、最終出庫日が集計開始日以降のもの（空は入らない：Access と同じ）。
  // 倉庫管理は最終出庫日が空か集計開始日以降のもの
  const 条件 =
    場所 === "ws"
      ? `z."倉庫ID" NOT IN (10, 112) AND z."商品コード" <> 697 AND z."入庫日"::date <= $2::date AND z."最終出庫日"::date >= $1::date`
      : `z."入庫日"::date <= $2::date AND (z."最終出庫日" IS NULL OR z."最終出庫日"::date >= $1::date)`;
  const 出 = (cond: string) => `COALESCE((SELECT SUM(s."ケース") FROM ${出荷} s WHERE s."在庫ID" = z."在庫ID" AND ${cond.replace(/日/g, 's."出荷日"::date')}), 0)`;
  const 変 = (cond: string) => `COALESCE((SELECT SUM(h."ケース") FROM ${変更} h WHERE h."在庫No" = z."在庫ID" AND ${cond.replace(/日/g, 'h."変更日"::date')}), 0)`;
  return `
    SELECT z."倉庫ID", z."商品コード", z."商品名", z."入数", z."入庫後名義ID", ${場所 === "ws" ? 1 : 2} AS "インポート場所ID",
           z."入庫元数"::float8 AS "入庫元数", NULL::float8 AS "製造ケース",
           CASE WHEN z."入庫日"::date < $1::date THEN z."入庫元数" - (${出("日 < $1::date")} + ${変("日 <= $1::date")}) END::float8 AS "繰越ケース",
           CASE WHEN z."入庫日"::date BETWEEN $1::date AND $2::date THEN z."入庫元数" END::float8 AS "範囲入庫ケース",
           (${出("日 BETWEEN $1::date AND $2::date")} + ${変("日 BETWEEN $1::date AND $2::date")})::float8 AS "範囲出庫ケース",
           (${出("日 <= $2::date")} + ${変("日 <= $2::date")})::float8 AS "出庫ケース"
    FROM ${在庫} z WHERE ${条件}`;
}

/** 集計（FM_現在在庫表示 の［集計］）。倉庫・商品ごとの行（在庫ケースが 0 の行も含む） */
export async function 全体在庫を集計(開始: string, 終了: string): Promise<Rec[]> {
  const 製造 = `
    SELECT i."倉庫ID", i."商品コード", i."商品名", i."入数", i."倉庫ID" AS "入庫後名義ID", 1 AS "インポート場所ID",
           i."ケース"::float8 AS "入庫元数", i."ケース"::float8 AS "製造ケース", NULL::float8 AS "繰越ケース", i."ケース"::float8 AS "範囲入庫ケース",
           NULL::float8 AS "範囲出庫ケース",
           COALESCE((SELECT SUM(s."ケース") FROM ${t("ws", "TD_出荷")} s WHERE COALESCE(s."chk", false) = false AND s."入庫ID" = i."入庫ID" AND s."出荷日"::date <= $2::date), 0)::float8 AS "出庫ケース"
    FROM ${入庫} i WHERE COALESCE(i."chk", false) = false AND i."入庫日"::date <= $2::date`;
  const 行 = await q(`SELECT * FROM (${製造} UNION ALL ${在庫の集計("ws")} UNION ALL ${在庫の集計("soko")}) x`, [開始, 終了]);

  // CC_在庫グループ化：倉庫・商品・商品名・入数・インポート場所・入庫後名義ごとに合計
  const 組 = new Map<string, Rec>();
  for (const r of 行) {
    const k = [r.倉庫ID, r.商品コード, r.商品名, r.入数, r.インポート場所ID, r.入庫後名義ID].join("|");
    const 在庫 = r.入庫元数 === null ? null : n(r.入庫元数) - n(r.出庫ケース);
    const g = 組.get(k);
    if (!g) {
      組.set(k, {
        倉庫ID: n(r.倉庫ID), 商品コード: n(r.商品コード), 商品名: r.商品名, 入数: r.入数 === null ? null : Number(r.入数),
        インポート場所ID: r.インポート場所ID, 入庫後名義ID: r.入庫後名義ID, 入庫元数: r.入庫元数, 出庫ケース: r.出庫ケース, 在庫ケース: 在庫,
        製造ケース: r.製造ケース, 繰越ケース: r.繰越ケース, 範囲入庫ケース: r.範囲入庫ケース, 範囲出庫ケース: r.範囲出庫ケース,
      });
      continue;
    }
    for (const f of ["入庫元数", "出庫ケース", "製造ケース", "繰越ケース", "範囲入庫ケース", "範囲出庫ケース"]) g[f] = 足す(g[f], r[f] === null ? null : Number(r[f]));
    g.在庫ケース = 足す(g.在庫ケース, 在庫);
  }
  const 結果 = [...組.values()];
  const 名前 = new Map<number, string>(
    (await q(`SELECT "短縮コード", "短縮名" FROM ${得意先マスタ} WHERE "短縮コード" = ANY($1::int[])`, [[...new Set(結果.map((r) => r.倉庫ID))]])).map((r) => [n(r.短縮コード), r.短縮名]),
  );
  const グループ = new Map<number, number>(
    (await q(`SELECT "商品コード", "グループ商品コード" FROM ${商品マスタ} WHERE "商品コード" = ANY($1::int[])`, [[...new Set(結果.map((r) => r.商品コード))]])).map((r) => [
      n(r.商品コード), n(r.グループ商品コード),
    ]),
  );

  // CC_全体在庫率集計：倉庫・商品ごとの半年・年間の出荷（取引元 11・1254 を除く）。
  // Access は「商品・商品名・取引元・倉庫」ごとにまとめた最初の 1 行だけを使っている（ほかの取引元の分は足さない。そのまま）
  const 期間 = async (日数: number) => {
    const rows = await q(
      `SELECT x."倉庫ID", x."商品コード", x."商品名", x."取引元ID", SUM(x."ケース")::float8 AS "ケース"
       FROM ${出荷レコード} WHERE x."出荷日" BETWEEN $1::date AND $2::date AND x."取引元ID" NOT IN (11, 1254)
       GROUP BY x."商品コード", x."商品名", x."取引元ID", x."倉庫ID" ORDER BY x."商品コード", x."商品名", x."取引元ID", x."倉庫ID"`,
      [日を足す(終了, -日数), 終了],
    );
    const m = new Map<string, number>();
    for (const r of rows) {
      const k = `${n(r.倉庫ID)}|${n(r.商品コード)}`;
      if (!m.has(k)) m.set(k, Number(r.ケース));
    }
    return m;
  };
  const 半年 = await 期間(183);
  const 年間 = await 期間(365);
  // 最小・最大受注数：今日から 1 年前までの受注（納品日）のケース。商品はグループ商品コード
  const 今日 = 日本の今().日付;
  const 受注数 = new Map<number, Rec>(
    (
      await q(
        `SELECT "商品コード", MIN("ケース")::float8 AS "最小", MAX("ケース")::float8 AS "最大" FROM ${受注}
         WHERE "納品日"::date BETWEEN $1::date AND $2::date GROUP BY "商品コード"`,
        [日を足す(今日, -365), 今日],
      )
    ).map((r) => [n(r.商品コード), r]),
  );
  for (const g of 結果) {
    g.倉庫名 = 名前.get(g.倉庫ID) ?? null;
    g.在庫kg = g.在庫ケース === null || g.入数 === null ? null : g.在庫ケース * g.入数;
    g.半年ケース = null;
    g.年間ケース = null;
    g.平均年間ケース = null;
    g.現在在庫率 = null;
    g.年間在庫率 = null;
    g.最小受注数 = null;
    g.最大受注数 = null;
    if (!n(g.在庫ケース)) continue;
    const k = `${g.倉庫ID}|${g.商品コード}`;
    g.半年ケース = 半年.get(k) ?? 0;
    // Access は年間の出荷がないとき、年間ではなく半年を 0 にしている（年間は空のまま。そのまま）
    if (年間.has(k)) g.年間ケース = 年間.get(k)!;
    else g.半年ケース = 0;
    g.平均年間ケース = g.年間ケース === null ? null : g.年間ケース / 12;
    // 在庫率は Access の単精度の欄に入る
    if (g.半年ケース) g.現在在庫率 = Math.fround(g.在庫ケース / (g.半年ケース / 6));
    if (g.平均年間ケース) g.年間在庫率 = Math.fround(g.在庫ケース / g.平均年間ケース);
    const 受 = 受注数.get(グループ.get(g.商品コード) ?? 0);
    g.最小受注数 = 受 ? cint(Number(受.最小)) : null;
    g.最大受注数 = 受 ? cint(Number(受.最大)) : null;
  }
  return 結果;
}

/** Access の並び（倉庫・現在在庫率・年間在庫率。空は先） */
const 並べる = (a: Rec, b: Rec) => {
  const 空先 = (x: number | null, y: number | null) => (x === y ? 0 : x === null ? -1 : y === null ? 1 : x - y);
  return a.倉庫ID - b.倉庫ID || 空先(a.現在在庫率, b.現在在庫率) || 空先(a.年間在庫率, b.年間在庫率) || a.商品コード - b.商品コード;
};

export function zentaiZaikoRoutes(app: FastifyInstance) {
  app.addHook("preHandler", requireUser);

  // 一覧（在庫ケースが 0 でない行）。soko を渡すとその倉庫だけ
  app.get<{ Querystring: { from: string; to: string; soko?: string } }>("/api/zentai-zaiko", async (req, reply) => {
    const { from, to } = req.query;
    if (!日付か(from) || !日付か(to) || from > to) return reply.code(400).send({ error: "集計の期間を正しく選んでください" });
    const 全部 = (await 全体在庫を集計(from, to)).filter((r) => n(r.在庫ケース) !== 0);
    const 倉庫 = [...new Map(全部.map((r) => [r.倉庫ID, r.倉庫名])).entries()].sort((a, b) => a[0] - b[0]).map(([id, name]) => ({ id, name }));
    const soko = n(req.query.soko);
    return { 倉庫, 行: (soko ? 全部.filter((r) => r.倉庫ID === soko) : 全部).sort(並べる) };
  });

  // 在庫不足リスト（R_在庫不足リスト：現在在庫率 3 未満）・少量在庫リスト（R_少量在庫リスト：在庫ケース 100 未満）。
  // どちらも年間在庫率があり、倉庫ID が 1 で始まらず、最大受注数が 0 でない行。在庫率＝年間在庫率（整数）、取引先名は商品マスタ
  app.get<{ Querystring: { from: string; to: string; kind: string } }>("/api/zentai-zaiko/list", async (req, reply) => {
    const { from, to, kind } = req.query;
    if (!日付か(from) || !日付か(to) || from > to) return reply.code(400).send({ error: "集計の期間を正しく選んでください" });
    const 全部 = await 全体在庫を集計(from, to);
    const 行 = 全部.filter(
      (r) =>
        r.年間在庫率 !== null && !String(r.倉庫ID).startsWith("1") && n(r.最大受注数) !== 0 &&
        (kind === "shoryo" ? n(r.在庫ケース) < 100 : r.現在在庫率 !== null && r.現在在庫率 < 3),
    );
    const 取引先 = new Map<number, string>(
      (await q(`SELECT "商品コード", "取引先名" FROM ${商品マスタ} WHERE "商品コード" = ANY($1::int[])`, [[...new Set(行.map((r) => r.商品コード))]])).map((r) => [
        n(r.商品コード), r.取引先名,
      ]),
    );
    return {
      開始: from, 終了: to, 作成時間: 日本の今().日時,
      行: 行.map((r) => ({ ...r, 取引先名: 取引先.get(r.商品コード) ?? "", 在庫率: cint(r.年間在庫率) })).sort(並べる),
    };
  });
}
