import type { FastifyInstance } from "fastify";
import { q, t, 日本の今 } from "./db.js";
import { requireUser } from "./auth.js";
import { cint } from "./hanmori.js";

// 丸北商品推移（Access の 丸北商品推移Ver2FE.accdb の F_出荷推移ver4「商品推移」）。
// Access は WorkStation・倉庫管理・製造管理の表の写しを取り込んで集計していた。Web 版は本物の表を直接読む。
// - UQ_出荷レコード：WorkStation の出荷（インポート場所 1・8、運賃振分区分 1・629）＋ 倉庫管理の出庫（運賃振分区分 1・629）
// - UQ_在庫：WorkStation の在庫 ＋ 倉庫管理の在庫（在庫ケースが 0 でない行）
// - Q_名変：倉庫管理の名義変更、Q_入庫・Q_製造データ：製造管理の入庫
const 商品マスタ = t("kyotsu", "TM_商品マスタ");
const 得意先マスタ = t("kyotsu", "TM_得意先マスタ");
const ストック = t("ws", "TM_商品在庫ストックマスタ");
const 入庫 = t("seizo", "TD_入庫");
const 名変 = t("soko", "TD_在庫変更");

/** UQ_出荷レコード（グループ商品コード付き） */
const 出荷レコード = `(
  SELECT s."出荷日"::date AS "出荷日", s."納品日"::date AS "納品日", s."取引元ID", s."取引元", s."倉庫ID", s."倉庫名", s."商品コード", s."商品名", s."ケース", s."商品kg",
         s."届け先コード", s."届け先", m."グループ商品コード", s."製造日"::date AS "製造日", s."賞味期限"::date AS "賞味期限", COALESCE(s."chk", false) AS "chk",
         s."受注ID", s."輸送ID", s."運賃振分区分", s."入庫後名義ID", 'WorkStation' AS "場所"
  FROM ${t("ws", "TD_出荷")} s LEFT JOIN ${商品マスタ} m ON m."商品コード" = s."商品コード"
  WHERE s."出庫ID" IS NOT NULL AND s."インポート場所ID" IN (1, 8) AND s."運賃振分区分" IN (1, 629)
  UNION ALL
  SELECT s."出荷日"::date, s."納品日"::date, s."取引元ID", s."取引元", s."倉庫ID", s."倉庫名", s."商品コード", s."商品名", s."ケース", s."商品kg",
         s."届け先コード", s."届け先", m."グループ商品コード", s."製造日"::date, s."賞味期限"::date, COALESCE(s."chk", false),
         s."受注ID", s."輸送ID", s."運賃振分区分", s."入庫後名義ID", '倉庫管理'
  FROM ${t("soko", "TD_出荷")} s LEFT JOIN ${商品マスタ} m ON m."商品コード" = s."商品コード"
  WHERE s."商品コード" IS NOT NULL AND s."運賃振分区分" IN (1, 629)
) x`;
/** UQ_在庫（在庫ケースが 0 でない行） */
const 在庫レコード = `(
  SELECT z."倉庫ID", z."倉庫名", z."商品コード", z."商品名", z."在庫ケース", z."在庫kg", m."グループ商品コード", z."製造日"::date AS "製造日", z."賞味期限"::date AS "賞味期限", z."入庫日"::date AS "入庫日", 'WorkStation' AS "場所"
  FROM ${t("ws", "TD_在庫")} z LEFT JOIN ${商品マスタ} m ON m."商品コード" = z."商品コード" WHERE COALESCE(z."在庫ケース", 0) <> 0
  UNION ALL
  SELECT z."倉庫ID", z."倉庫名", z."商品コード", z."商品名", z."在庫ケース", z."在庫kg", m."グループ商品コード", z."製造日"::date, z."賞味期限"::date, z."入庫日"::date, '倉庫管理'
  FROM ${t("soko", "TD_在庫")} z LEFT JOIN ${商品マスタ} m ON m."商品コード" = z."商品コード" WHERE COALESCE(z."在庫ケース", 0) <> 0
) x`;

type Rec = Record<string, any>;
const n = (v: unknown) => Number(v ?? 0) || 0;
const 日付か = (v: unknown) => /^\d{4}-\d{2}-\d{2}$/.test(String(v ?? ""));
const 日を足す = (d: string, k: number) => new Date(Date.parse(d + "T00:00:00Z") + k * 86400000).toISOString().slice(0, 10);
/** その月の 1 日（k か月ずらす） */
const 月初 = (d: string, k: number) => {
  const x = new Date(Date.UTC(Number(d.slice(0, 4)), Number(d.slice(5, 7)) - 1 + k, 1));
  return x.toISOString().slice(0, 10);
};
/** Access の DSum：合う行がなければ空（Null） */
const 合計 = async (sql: string, args: unknown[]) => {
  const v = (await q(sql, args))[0]?.v;
  return v === null || v === undefined ? null : Number(v);
};
/** Null × 入数 は Null（Access と同じ） */
const 掛ける = (v: number | null, k: number) => (v === null ? null : v * k);
/** Long の欄に入れるとき（Access の型変換と同じく .5 は偶数へ） */
const 整数 = (v: number | null) => (v === null ? null : cint(v));

export function shohinSuiiRoutes(app: FastifyInstance) {
  app.addHook("preHandler", requireUser);

  // ユーザー（取引元）の選択肢：出荷のある取引元（多い順）
  app.get("/api/suii/torihiki", async () =>
    q(
      `SELECT x."取引元ID" AS id, MAX(m."短縮名") AS name, COUNT(*)::int AS 件数 FROM ${出荷レコード}
       LEFT JOIN ${得意先マスタ} m ON m."短縮コード" = x."取引元ID"
       WHERE COALESCE(x."取引元ID", 0) <> 0 GROUP BY x."取引元ID" ORDER BY COUNT(*) DESC LIMIT 40`,
    ),
  );

  // 商品の選択肢（UQ_出荷 の商品。ユーザーを選んだときはその取引元の出荷の商品。商品 0・200・697 は出さない）
  app.get<{ Querystring: { torihiki?: string } }>("/api/suii/shohin", async (req) => {
    const 取引元 = n(req.query.torihiki);
    return q(
      `SELECT x."商品コード" AS id, MAX(x."商品名") AS name FROM ${出荷レコード}
       WHERE x."商品コード" NOT IN (0, 200, 697) ${取引元 ? `AND x."取引元ID" = $1` : ""}
       GROUP BY x."商品コード" ORDER BY x."商品コード"`,
      取引元 ? [取引元] : [],
    );
  });

  /**
   * 商品推移（cmb_商品コード_AfterUpdate・C_商品推移・M_出荷集計）。
   * code＝商品コード、torihiki＝ユーザー（取引元。0 はすべて）、kg＝1 なら入数を掛けて kg、date＝集計日付、nendo＝年度（7 月始まりの年）
   */
  app.get<{ Querystring: { code: string; torihiki?: string; kg?: string; date?: string; nendo?: string } }>("/api/suii", async (req, reply) => {
    const 今日 = 日本の今().日付;
    const 集計日 = 日付か(req.query.date) ? String(req.query.date) : 今日;
    const code = n(req.query.code);
    const 取引元 = n(req.query.torihiki);
    const kg = req.query.kg !== "0";
    const m = (await q(`SELECT "商品名", "グループ商品コード", "入数" FROM ${商品マスタ} WHERE "商品コード" = $1 LIMIT 1`, [code]))[0];
    const G = n(m?.グループ商品コード);
    if (!G) return reply.code(400).send({ error: "商品コードが正しくありません" });
    // 入数：Access は 単位切替 のとき商品の入数（推移の表はグループの商品の入数）
    const 入数 = kg ? n(m.入数) : 1;
    const 入数G = kg ? n((await q(`SELECT "入数" FROM ${商品マスタ} WHERE "グループ商品コード" = $1 ORDER BY "ID" LIMIT 1`, [G]))[0]?.入数) : 1;

    // ---- 上の欄：年間製造（今年の前年 9/1〜今年 8/31 の製造）・前年製造・年間平均・ストック ----
    const 年 = Number(今日.slice(0, 4));
    const 製造開始 = `${年 - 1}-09-01`;
    const 製造終了 = `${年}-08-31`;
    const 製造 = (a: string, b: string) => 合計(`SELECT SUM(i."ケース") AS v FROM ${入庫} i LEFT JOIN ${商品マスタ} m ON m."商品コード" = i."商品コード" WHERE m."グループ商品コード" = $1 AND i."製造日"::date BETWEEN $2::date AND $3::date`, [G, a, b]);
    const 年間製造 = 掛ける(await 製造(製造開始, 製造終了), 入数);
    // Access は DateAdd("y", -1) で、1 年前ではなく 1 日前の範囲になっている（そのまま）
    const 前年製造 = 掛ける(await 製造(日を足す(製造開始, -1), 日を足す(製造終了, -1)), 入数);
    const ストック数 = (await q(`SELECT "ストック数" FROM ${ストック} WHERE "商品コード" = $1 LIMIT 1`, [G]))[0]?.ストック数 ?? "";

    // ---- 月別の出荷（M_出荷集計：年度の 7/1〜翌 6/30、取引元×届け先、届け先 11 を除く。取引先 1254 は出さない） ----
    const 年度 = n(req.query.nendo) || (Number(今日.slice(5, 7)) >= 7 ? 年 : 年 - 1);
    const 月別の行 = await q(
      `SELECT x."取引元ID" AS "取引先コード", x."届け先コード", EXTRACT(MONTH FROM x."出荷日")::int AS 月, SUM(x."ケース")::float8 AS ケース
       FROM ${出荷レコード} WHERE x."グループ商品コード" = $1 AND x."届け先コード" <> 11 AND x."出荷日" BETWEEN $2::date AND $3::date
       GROUP BY 1, 2, 3`,
      [G, `${年度}-07-01`, `${年度 + 1}-06-30`],
    );
    const 名前 = new Map<number, Rec>(
      (await q(`SELECT "短縮コード", "短縮名", "倉庫区分" FROM ${得意先マスタ} WHERE "短縮コード" = ANY($1::int[])`, [
        [...new Set(月別の行.flatMap((r) => [n(r.取引先コード), n(r.届け先コード)]))],
      ])).map((r) => [n(r.短縮コード), r]),
    );
    const 組 = new Map<string, Rec>();
    for (const r of 月別の行) {
      const k = `${n(r.取引先コード)}/${n(r.届け先コード)}`;
      if (!組.has(k))
        組.set(k, {
          取引先コード: n(r.取引先コード), 取引先名: 名前.get(n(r.取引先コード))?.短縮名 ?? null,
          届け先コード: n(r.届け先コード), 届け先: 名前.get(n(r.届け先コード))?.短縮名 ?? null,
          倉庫区分: 名前.get(n(r.届け先コード))?.倉庫区分 ?? null, 月: Array(13).fill(0),
        });
      組.get(k)!.月[r.月] = n(r.ケース) * 入数;
    }
    const 月別 = [...組.values()]
      .filter((r) => r.取引先コード !== 1254)
      .map((r): Rec => ({ ...r, 年間合計: r.月.reduce((a: number, b: number) => a + b, 0) }))
      .sort((a, b) => Number(!!a.倉庫区分) - Number(!!b.倉庫区分) || a.取引先コード - b.取引先コード || a.届け先コード - b.届け先コード || a.年間合計 - b.年間合計);

    // ---- 倉庫ごとの推移（C_商品推移） ----
    const 場所 = await q(
      `SELECT DISTINCT y."倉庫ID" FROM (
         SELECT "倉庫ID", "商品コード" FROM ${t("ws", "TD_在庫")} UNION SELECT "倉庫ID", "商品コード" FROM ${t("soko", "TD_在庫")}
       ) y JOIN ${商品マスタ} m ON m."商品コード" = y."商品コード"
       WHERE m."グループ商品コード" = $1 AND y."倉庫ID" NOT IN (10, 1125, 1029, 1165) ORDER BY 1`,
      [G],
    );
    const 一月前 = 月初(今日, -1);
    const 先月末 = 日を足す(月初(今日, 0), -1);
    const 三月前 = 月初(今日, -3);
    const 倉庫 = [];
    for (const p of 場所) {
      const 倉庫ID = n(p.倉庫ID);
      // 絞り（MyFilterNo）：商品・倉庫・ユーザー
      const 絞り = `x."グループ商品コード" = $1 AND x."倉庫ID" = $2${取引元 ? ` AND x."取引元ID" = ${取引元}` : ""}`;
      const 出荷 = (cond: string, args: unknown[]) => 合計(`SELECT SUM(x."ケース") AS v FROM ${出荷レコード} WHERE ${cond}`, args);
      const 在庫 = (cond: string) => 合計(`SELECT SUM(x."在庫ケース") AS v FROM ${在庫レコード} WHERE x."グループ商品コード" = $1 AND x."倉庫ID" = $2 AND ${cond}`, [G, 倉庫ID, 今日]);
      let 現在在庫 = n(await 在庫(`x."入庫日" <= $3::date`)) * 入数G;
      const 輸送中 = n(await 在庫(`x."入庫日" > $3::date`)) * 入数G;
      現在在庫 += n(await 合計(
        `SELECT SUM(h."ケース") AS v FROM ${名変} h LEFT JOIN ${商品マスタ} m ON m."商品コード" = h."商品コード" WHERE h."変更日"::date > $3::date AND m."グループ商品コード" = $1 AND h."保管庫ID" = $2`,
        [G, 倉庫ID, 集計日],
      )) * 入数G;
      const 受注予定 = n(await 出荷(`x."出荷日" >= $3::date AND ${絞り} AND x."chk" = false`, [G, 倉庫ID, 集計日])) * 入数G;
      // Access は「登録済みでまだ入庫していない分」も足そうとしているが、使う表に 出荷区分 の項目が無くエラーで飛ばされている（そのまま）
      const 入庫予定 = n(await 出荷(`x."入庫後名義ID" = 11 AND x."出荷日" >= $3::date AND x."届け先コード" = $2 AND x."chk" = false AND x."グループ商品コード" = $1`, [G, 倉庫ID, 集計日])) * 入数G;
      const 受注込在庫 = 現在在庫 + 入庫予定 - 受注予定 + 輸送中;
      const 製造予定 = 掛ける(
        await 合計(`SELECT SUM(i."ケース") AS v FROM ${入庫} i LEFT JOIN ${商品マスタ} m ON m."商品コード" = i."商品コード" WHERE COALESCE(i."chk", false) = false AND m."グループ商品コード" = $1 AND i."倉庫ID" = $2`, [G, 倉庫ID]),
        入数G,
      );
      const 期間 = async (a: string, b: string) => 出荷(`x."出荷日" BETWEEN $3::date AND $4::date AND ${絞り}`, [G, 倉庫ID, a, b]);
      // 一日は Access も入数を掛けていない（そのまま）
      const 一日 = await 出荷(`x."出荷日" = $3::date AND ${絞り}`, [G, 倉庫ID, 集計日]);
      const 一週 = 掛ける(await 期間(日を足す(集計日, -6), 集計日), 入数G);
      const 一月 = 掛ける(await 期間(一月前, 先月末), 入数G);
      const 三ヶ月 = 掛ける(await 期間(三月前, 先月末), 入数G);
      const 半年 = 掛ける(await 期間(日を足す(集計日, -183), 集計日), 入数G);
      const 年間 = 掛ける(await 期間(日を足す(集計日, -365), 集計日), 入数G);
      const 平均年間 = 年間 === null ? null : 年間 / 12;
      const 年間入庫 = 掛ける(await 出荷(`x."出荷日" BETWEEN $3::date AND $4::date AND x."届け先コード" = $2 AND x."グループ商品コード" = $1`, [G, 倉庫ID, 日を足す(集計日, -365), 集計日]), 入数G);
      const 現在在庫率 = 三ヶ月 ? 整数(現在在庫)! / (三ヶ月 / 3) : null;
      const 名 = (await q(`SELECT "短縮名" FROM ${得意先マスタ} WHERE "短縮コード" = $1 LIMIT 1`, [倉庫ID]))[0]?.短縮名 ?? null;
      倉庫.push({
        倉庫ID, 倉庫名: 名, 入数: n(m.入数),
        現在在庫: 整数(現在在庫), 輸送中: 整数(輸送中), 受注予定: 整数(受注予定), 入庫予定: 整数(入庫予定), 受注込在庫: 整数(受注込在庫), 製造予定: 整数(製造予定),
        一日, 一週, 一月, 三ヶ月, 半年, 年間, 平均年間, 年間入庫, 年間入庫平均: 年間入庫 === null ? 0 : 整数(年間入庫 / 12),
        現在在庫率,
      });
    }
    return {
      商品コード: code, グループ商品コード: G, 商品名: m.商品名, 集計日付: 集計日, 年度, 単位: kg ? "kg" : "ケース",
      年間製造, 前年製造, 年間平均: 年間製造 === null ? null : 年間製造 / 12, 製造開始, 製造終了, ストック数,
      月別, 倉庫,
    };
  });

  // 明細（FS_出荷詳細・FS_在庫詳細・FS_入庫詳細）：数をダブルクリックしたとき
  app.get<{ Querystring: { kind: string; G: string; soko?: string; from?: string; to?: string; torihiki?: string; mikakutei?: string; osaka?: string } }>(
    "/api/suii/meisai",
    async (req, reply) => {
      const G = n(req.query.G);
      const soko = n(req.query.soko);
      const args: unknown[] = [G];
      const 足す = (v: unknown) => (args.push(v), `$${args.length}`);
      if (req.query.kind === "zaiko")
        return q(
          `SELECT x.* FROM ${在庫レコード} WHERE x."グループ商品コード" = $1 ${soko ? `AND x."倉庫ID" = ${足す(soko)}` : ""} ORDER BY x."倉庫ID", x."製造日", x."入庫日"`,
          args,
        );
      if (req.query.kind === "nyuko")
        return q(
          `SELECT i."入庫ID", i."入庫日"::date::text AS "入庫日", i."製造日"::date::text AS "製造日", i."倉庫ID", i."倉庫名", i."商品コード", i."商品名", i."ケース", i."商品kg", i."タグ"
           FROM ${入庫} i LEFT JOIN ${商品マスタ} m ON m."商品コード" = i."商品コード" WHERE COALESCE(i."chk", false) = false AND m."グループ商品コード" = $1 ORDER BY i."製造日", i."入庫ID"`,
          args,
        );
      if (req.query.kind !== "shukka") return reply.code(400).send({ error: "種類が正しくありません" });
      let where = `x."グループ商品コード" = $1`;
      if (soko) where += ` AND x."倉庫ID" = ${足す(soko)}`;
      if (日付か(req.query.from)) where += ` AND x."出荷日" >= ${足す(req.query.from)}::date`;
      if (日付か(req.query.to)) where += ` AND x."出荷日" <= ${足す(req.query.to)}::date`;
      if (n(req.query.torihiki)) where += ` AND x."取引元ID" = ${足す(n(req.query.torihiki))}`;
      if (req.query.mikakutei === "1") where += ` AND x."chk" = false`;
      if (req.query.osaka === "1") where += ` AND x."運賃振分区分" = 629`;
      return q(
        `SELECT x."出荷日"::text AS "出荷日", x."納品日"::text AS "納品日", x."取引元", x."倉庫名", x."届け先", x."商品コード", x."商品名", x."ケース", x."商品kg", x."chk", x."場所"
         FROM ${出荷レコード} WHERE ${where} ORDER BY x."出荷日", x."倉庫ID", x."届け先コード" LIMIT 2000`,
        args,
      );
    },
  );
}
