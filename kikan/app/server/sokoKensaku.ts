import type { FastifyInstance } from "fastify";
import type { PoolClient } from "pg";
import { pool, q, t, 日本の今 } from "./db.js";
import { requireUser } from "./auth.js";
import { 一覧のExcel } from "./excel.js";
import { 倉庫の在庫, 倉庫の出荷, 倉庫の便, 倉庫の名変, 倉庫詳細設定 } from "./soko.js";
import { 倉庫の在庫見込み } from "./sokoShukko.js";
import { 小数点計算 } from "./sokoHokan.js";

// 倉庫管理System の倉庫別データ検索（Access の FSD_倉庫選択・FM_倉庫情報〈在庫一覧・入庫一覧・出庫一覧・名変一覧・倉庫設定〉・
// FSD_配送商品検索・FM_商品別在庫〈仮締め CC_KariJimeSum〉）。どれも見るだけ。
const 得意先マスタ = t("kyotsu", "TM_得意先マスタ");
const 商品マスタ = t("kyotsu", "TM_商品マスタ");
const 地区 = t("soko_fe", "TM_地区コード");
const WSの出荷 = t("ws", "TD_出荷");
const WSの便 = t("ws", "TD_輸送計画");

type Rec = Record<string, any>;
const n = (v: unknown) => Number(v ?? 0) || 0;
const 日付か = (v: unknown) => /^\d{4}-\d{2}-\d{2}$/.test(String(v ?? ""));
const 月末 = (d: string) => new Date(Date.UTC(Number(d.slice(0, 4)), Number(d.slice(5, 7)), 0)).toISOString().slice(0, 10);
const 日付の列 = (a: string, cols: string[]) => cols.map((c) => `${a}"${c}"::date::text AS "${c}"`).join(", ");

/**
 * 仮締め（Access の CC_KariJimeSum）。集計日の時点の在庫を作る。
 * 1. 入庫日が集計日以前で、今の在庫ケースが 0 でないロットごとに、集計日までの出庫（登録していないものも）と名変（変更日）を足し、在庫残数＝入庫元数−その数。
 *    Access と同じく、今の在庫が 0 のロットは最初から入れない（過去の日付で締めると、そのあと出し切ったロットは入らない）。
 * 2. WorkStation の出荷のうち、届け先が冷蔵庫（倉庫詳細設定がある）でまだ取り込んでいないもの（納品日が集計日の月末まで・出荷日が集計日まで・完了していない）を入庫予定として足す。
 * 冷蔵庫・名義を渡すとそのぶんだけ作る（まとめた結果は同じ）。
 */
export async function 仮締め(c: PoolClient, 集計日: string, 倉庫?: number, 名義?: number): Promise<Rec[]> {
  const 条件 = (a: string, 倉庫列: string, 名義列: string, 始: number) => {
    const w: string[] = [];
    const v: unknown[] = [];
    if (倉庫) {
      v.push(倉庫);
      w.push(`${a}"${倉庫列}" = $${始 + v.length}`);
    }
    if (名義 !== undefined) {
      v.push(名義);
      w.push(`${a}"${名義列}" = $${始 + v.length}`);
    }
    return { sql: w.map((x) => " AND " + x).join(""), v };
  };
  const z = 条件("z.", "倉庫ID", "入庫後名義ID", 1);
  const lots = (
    await c.query(
      `SELECT z."在庫ID", z."入庫日"::date::text AS "入庫日", z."倉庫ID", m."短縮名" AS "倉庫名", z."商品コード", g."分類ID", z."商品名", z."規格", z."入数", z."入庫後名義ID",
              z."製造日"::date::text AS "製造日", z."賞味期限"::date::text AS "賞味期限", z."タグ", z."入庫No", z."入庫元数",
              COALESCE((SELECT SUM(s."ケース") FROM ${倉庫の出荷} s WHERE s."在庫ID" = z."在庫ID" AND s."出荷日" <= $1::date), 0)
            + COALESCE((SELECT SUM(h."ケース") FROM ${倉庫の名変} h WHERE h."在庫No" = z."在庫ID" AND h."変更日" <= $1::date), 0) AS "ケース"
       FROM ${倉庫の在庫} z
         LEFT JOIN LATERAL (SELECT "短縮名" FROM ${得意先マスタ} WHERE "短縮コード" = z."倉庫ID" LIMIT 1) m ON true
         LEFT JOIN LATERAL (SELECT "分類ID" FROM ${商品マスタ} WHERE "商品コード" = z."商品コード" LIMIT 1) g ON true
       WHERE z."入庫日" <= $1::date AND z."在庫ケース" <> 0${z.sql} ORDER BY z."在庫ID"`,
      [集計日, ...z.v],
    )
  ).rows as Rec[];
  const out: Rec[] = lots.map((r) => {
    const ケース = n(r.ケース);
    const 在庫残数 = n(r.入庫元数) - ケース;
    return { ...r, 区分: "在庫", ケース, 商品kg: ケース * n(r.入数), 在庫残数, 在庫残kg: 在庫残数 * n(r.入数) };
  });
  const y = 条件("s.", "届け先コード", "入庫後名義ID", 2);
  const yotei = (
    await c.query(
      `SELECT s."納品日"::date::text AS "入庫日", s."届け先コード" AS "倉庫ID", s."届け先" AS "倉庫名", s."商品コード", g."分類ID", s."商品名", s."規格", s."入数", s."入庫後名義ID",
              s."製造日"::date::text AS "製造日", s."賞味期限"::date::text AS "賞味期限", s."タグ", s."ケース" AS "入庫元数", s."ケース" AS "在庫残数", s."商品kg" AS "在庫残kg"
       FROM ${WSの出荷} s JOIN ${WSの便} p ON p."輸送ID" = s."輸送ID"
         JOIN ${得意先マスタ} k ON k."短縮コード" = s."届け先コード"
         LEFT JOIN LATERAL (SELECT "分類ID" FROM ${商品マスタ} WHERE "商品コード" = s."商品コード" LIMIT 1) g ON true
       WHERE s."出荷区分" = false AND k."出荷元区分" = false AND k."倉庫区分" = true
         AND EXISTS (SELECT 1 FROM ${倉庫詳細設定} d WHERE d."短縮コード" = k."短縮コード")
         AND s."納品日" <= $1::date AND s."出荷日" <= $2::date AND s."完了フラグ" = false${y.sql}
       ORDER BY s."出荷日", s."出庫ID"`,
      [月末(集計日), 集計日, ...y.v],
    )
  ).rows as Rec[];
  for (const r of yotei) out.push({ ...r, 在庫ID: null, 入庫No: null, 区分: "入庫予定", ケース: 0, 商品kg: 0, 在庫残数: n(r.在庫残数), 在庫残kg: n(r.在庫残kg) });
  return out;
}

/** 仮締めを 冷蔵庫・冷蔵庫名・名義・商品・商品名・入数 ごとにまとめる（FM_商品別在庫・倉庫在庫） */
function まとめる(rows: Rec[]): Rec[] {
  const m = new Map<string, Rec>();
  for (const r of rows) {
    const k = [r.倉庫ID, r.倉庫名, r.入庫後名義ID, r.商品コード, r.商品名, r.入数].join("\u0001");
    const x = m.get(k) ?? { 倉庫ID: r.倉庫ID, 倉庫名: r.倉庫名, 入庫後名義ID: r.入庫後名義ID, 商品コード: r.商品コード, 商品名: r.商品名, 規格: r.規格, 入数: r.入数, 入庫元数: 0, ケース: 0, 商品kg: 0, 在庫残数: 0, 在庫残kg: 0 };
    for (const f of ["入庫元数", "ケース", "商品kg", "在庫残数", "在庫残kg"]) x[f] += n(r[f]);
    m.set(k, x);
  }
  return [...m.values()].sort((a, b) => n(a.倉庫ID) - n(b.倉庫ID) || n(a.入庫後名義ID) - n(b.入庫後名義ID) || n(a.商品コード) - n(b.商品コード));
}

export function sokoKensakuRoutes(app: FastifyInstance) {
  app.addHook("preHandler", requireUser);

  // 倉庫選択（FSD_倉庫選択）：営業冷蔵庫ごとの在庫ケース・kg・ロット数（ロットのある冷蔵庫だけ。得意先名の順）
  app.get("/api/soko/kensaku", async () => ({
    rows: await q(
      `SELECT k."短縮コード", k."得意先名", k."地区コード", SUM(z."在庫ケース") AS "ケースの合計", SUM(z."在庫kg") AS "商品kgの合計", COUNT(z."倉庫ID") AS "ロット数"
       FROM ${得意先マスタ} k LEFT JOIN ${倉庫の在庫} z ON z."倉庫ID" = k."短縮コード"
       WHERE k."倉庫区分" = true AND k."出荷元区分" = false
       GROUP BY k."短縮コード", k."得意先名", k."地区コード" HAVING COUNT(z."倉庫ID") <> 0 ORDER BY k."得意先名"`,
    ),
    地区: await q(`SELECT "地区コード" AS id, MIN("地区名") AS name FROM ${地区} GROUP BY "地区コード" ORDER BY "地区コード"`),
  }));
  // 配送商品検索（FSD_配送商品検索）：その冷蔵庫の、集計開始日〜終了日の出庫
  app.get<{ Querystring: { soko: string; from: string; to: string } }>("/api/soko/kensaku/haiso", async (req, reply) => {
    if (!日付か(req.query.from) || !日付か(req.query.to)) return reply.code(400).send({ error: "集計開始日・終了日を入れてください" });
    return q(
      `SELECT s.*, ${日付の列("s.", ["出荷日", "納品日", "製造日", "賞味期限"])}, p."出荷計画日"::date::text AS "出荷計画日", p."運送会社名"
       FROM ${倉庫の出荷} s LEFT JOIN ${倉庫の便} p ON p."輸送ID" = s."輸送ID"
       WHERE s."倉庫ID" = $1 AND s."出荷日" >= $2::date AND s."出荷日" <= $3::date ORDER BY p."出荷計画日", s."商品コード", s."出庫ID"`,
      [n(req.query.soko), req.query.from, req.query.to],
    );
  });

  // 予定在庫・パレット表示（F_在庫_日付指定）：集計日までの予定在庫（在庫＋WorkStation からの入庫予定−集計日までの未登録の出庫）と、パレット枚数
  // （ニチレイパレット積載マスタの 冷蔵庫×商品 の積載数、なければ 30 ケース。繰上げ）
  app.get<{ Querystring: { soko: string; date: string } }>("/api/soko/yotei", async (req, reply) => {
    if (!日付か(req.query.date)) return reply.code(400).send({ error: "集計する日付を選択してください。" });
    const c = await pool.connect();
    try {
      const rows = (await 倉庫の在庫見込み(c, 0, n(req.query.soko), req.query.date)).filter((r) => n(r.在庫ケース) !== 0 || n(r.繰越ケース) !== 0);
      const 積載 = new Map<string, number>();
      for (const m of (await c.query(`SELECT "倉庫ID", "商品コード", "パレット積載数" FROM ${t("soko_fe", "TM_ニチレイパレット積載マスタ")} ORDER BY "ID"`)).rows as Rec[]) {
        const k = `${m.倉庫ID}-${m.商品コード}`;
        if (!積載.has(k)) 積載.set(k, n(m.パレット積載数));
      }
      const 枚数 = (倉庫: unknown, 商品: unknown, 個数: number) => 小数点計算(個数 / (積載.get(`${倉庫}-${商品}`) || 30), 2);
      for (const r of rows) {
        r.パレット積載元数 = 枚数(r.倉庫ID, r.商品コード, n(r.繰越ケース));
        r.パレット積載数 = 枚数(r.倉庫ID, r.商品コード, n(r.在庫ケース));
        r.空き予定パレット数 = r.パレット積載元数 - r.パレット積載数;
        const 名義 = (await c.query(`SELECT "短縮名", "得意先名" FROM ${得意先マスタ} WHERE "短縮コード" = $1 LIMIT 1`, [n(r.入庫後名義ID)])).rows[0];
        r.名義名 = 名義?.短縮名 ?? null;
        r.名義正式名 = 名義?.得意先名 ?? null;
      }
      return rows.sort((a, b) => n(a.商品コード) - n(b.商品コード) || Number(a.架空実物) - Number(b.架空実物) || String(a.賞味期限 ?? "").localeCompare(String(b.賞味期限 ?? "")));
    } finally {
      c.release();
    }
  });

  // パレット在庫集計（予定在庫・パレット表示の［印刷］。R_在庫表(パレット表示)）。今日・1 週間後・1 か月後のパレット枚数
  app.get<{ Querystring: { soko: string } }>("/api/soko/yotei/pallet", async (req) => {
    const soko = n(req.query.soko);
    const 今日 = 日本の今().日付;
    const 足す = (d: string, k: number) => new Date(Date.parse(d + "T00:00:00Z") + k * 86400000).toISOString().slice(0, 10);
    const 週 = 足す(今日, 7), 月 = 足す(今日, 30);
    const 積載 = new Map<string, number>();
    for (const m of await q(`SELECT "倉庫ID", "商品コード", "パレット積載数" FROM ${t("soko_fe", "TM_ニチレイパレット積載マスタ")} ORDER BY "ID"`)) {
      const k = `${m.倉庫ID}-${m.商品コード}`;
      if (!積載.has(k)) 積載.set(k, n(m.パレット積載数));
    }
    const 枚数 = (商品: unknown, 個数: number) => 小数点計算(個数 / (積載.get(`${soko}-${商品}`) || 30), 2);
    const 合計 = (rows: Rec[], k = "ケース") => rows.reduce((a, r) => a + 枚数(r.商品コード, n(r[k])), 0);
    const k = (await q(`SELECT "得意先名", "パレット積載許容数" FROM ${得意先マスタ} WHERE "短縮コード" = $1 LIMIT 1`, [soko]))[0] ?? {};
    // 今の在庫（ロットごとに枚数を出して足す）
    const 現在 = 合計(await q(`SELECT "商品コード", "在庫ケース" FROM ${倉庫の在庫} WHERE "倉庫ID" = $1 AND "在庫ケース" <> 0`, [soko]), "在庫ケース");
    // 出庫で空く枚数（まだ登録していない出庫の 1 件ごとの枚数。C_出荷空きパレット枚数）
    const 出庫 = await q(`SELECT "商品コード", "ケース", "出荷日"::date::text AS d FROM ${倉庫の出荷} WHERE "chk" = false AND "倉庫ID" = $1 AND "出荷日" <= $2::date`, [soko, 月]);
    const 空き = (from: string | null, to: string) => 合計(出庫.filter((r) => (from === null || r.d > from) && r.d <= to));
    // WorkStation から来る入庫予定（出荷日が今日〜1 か月後。CC_仮入庫入力）を納品日で
    const 入庫 = await q(
      `SELECT "商品コード", "ケース", "納品日"::date::text AS d FROM ${WSの出荷} WHERE "出荷区分" = false AND "届け先コード" = $1 AND "出荷日" BETWEEN $2::date AND $3::date`,
      [soko, 今日, 月],
    );
    const 入 = (from: string, to: string) => 合計(入庫.filter((r) => r.d > from && r.d <= to));
    const 今日の空き = 空き(null, 今日);
    const 残今日 = 現在 - 今日の空き;
    const 入1 = 入(今日, 週), 空1 = 空き(今日, 週);
    const 入2 = 入(今日, 月), 空2 = 空き(今日, 月);
    // 2 枚目：商品ごとのパレット数と在庫数（CC_KakuZaikoSum の 9〈今日から 30 日後まで〉→ C_ニチレイパレット積載確認）。
    // ロットごとに 元数＝繰越ケース÷積載数、残数＝在庫ケース÷積載数（どちらも繰り上げ）、出庫数＝元数−残数。kg は 繰越kg・出荷kg・在庫kg
    const c = await pool.connect();
    let lots: Rec[] = [];
    try {
      lots = await 倉庫の在庫見込み(c, 0, soko, 月);
    } finally {
      c.release();
    }
    const 商品 = new Map<number, Rec>();
    for (const l of lots) {
      const 元 = 枚数(l.商品コード, n(l.繰越ケース));
      const 残 = 枚数(l.商品コード, n(l.在庫ケース));
      const x = 商品.get(n(l.商品コード)) ?? { 商品コード: n(l.商品コード), 商品名: l.商品名, 元数: 0, 出庫数: 0, 残数: 0, 元kg: 0, 出荷kg: 0, 残kg: 0 };
      x.元数 += 元;
      x.出庫数 += 元 - 残;
      x.残数 += 残;
      x.元kg += n(l.繰越kg);
      x.出荷kg += n(l.出荷kg);
      x.残kg += n(l.在庫kg);
      商品.set(n(l.商品コード), x);
    }
    return {
      商品別: [...商品.values()].filter((x) => x.元数 || x.元kg).sort((a, b) => a.商品コード - b.商品コード),
      倉庫名: k.得意先名 ?? "", 許容: n(k.パレット積載許容数), 今日, 週, 月,
      今: { 現在, 空き: 今日の空き, 残: 残今日 },
      週後: { 入庫: 入1, 空き: 空1, 残: 残今日 + 入1 - 空1 },
      // いただいた見本（高松東 10/23）の数と合う形：1 か月後の残予定＝今の枚数＋入庫（1 か月）−（空き予定〈1 か月〉−空き予定〈1 週間〉）
      月後: { 入庫: 入2, 空き: 空2, 残: 現在 + 入2 - (空2 - 空1) },
    };
  });

  // 出庫リスト表示（F_出庫リスト表示。ニチレイ用）：倉庫・出荷日の範囲の出庫
  app.get<{ Querystring: { soko: string; from: string; to: string } }>("/api/soko/shukko-list", async (req, reply) => {
    if (!日付か(req.query.from) || !日付か(req.query.to)) return reply.code(400).send({ error: "出荷日を入れてください" });
    return q(
      `SELECT s.*, ${日付の列("s.", ["出荷日", "納品日", "製造日", "賞味期限"])}, p."運送会社名", p."出庫No", p."出荷計画日"::date::text AS "出荷計画日"
       FROM ${倉庫の出荷} s LEFT JOIN ${倉庫の便} p ON p."輸送ID" = s."輸送ID"
       WHERE s."倉庫ID" = $1 AND s."出荷日" BETWEEN $2::date AND $3::date ORDER BY s."出荷日", p."出庫No", s."輸送ID", s."商品コード", s."出庫ID"`,
      [n(req.query.soko), req.query.from, req.query.to],
    );
  });

  // 倉庫情報（FM_倉庫情報）：営業冷蔵庫の得意先の情報と、前後の冷蔵庫
  app.get<{ Params: { code: string } }>("/api/soko/joho/:code", async (req) => {
    const list = await q(`SELECT "短縮コード" AS id, "短縮名" AS name FROM ${得意先マスタ} WHERE "倉庫区分" = true AND "出荷元区分" = false ORDER BY "短縮コード"`);
    const code = n(req.params.code) || n(list[0]?.id);
    const k = (await q(`SELECT * FROM ${得意先マスタ} WHERE "短縮コード" = $1 AND "倉庫区分" = true AND "出荷元区分" = false LIMIT 1`, [code]))[0] ?? null;
    return { 得意先: k, 一覧: list };
  });
  app.get<{ Params: { code: string } }>("/api/soko/joho/:code/settei", async (req) =>
    q(
      `SELECT *, ${日付の列("", ["終了日", "入力日", "契約入庫日開始", "契約入庫日終了"])} FROM ${倉庫詳細設定} WHERE "短縮コード" = $1 ORDER BY "短縮コード", "名義コード", "商品コード"`,
      [n(req.params.code)],
    ),
  );
  const 在庫の列 = `z.*, ${日付の列("z.", ["入庫日", "製造日", "賞味期限", "最終出庫日", "保管料負担日"])}, m."短縮名" AS "名義名"`;
  // 在庫一覧：1＝今日までに入庫した在庫、2＝これから入庫する在庫、3（など）＝全部。商品でも絞る
  app.get<{ Params: { code: string }; Querystring: { mode?: string; shohin?: string } }>("/api/soko/joho/:code/zaiko", async (req) => {
    const a: unknown[] = [n(req.params.code)];
    let w = "";
    const mode = Number(req.query.mode ?? 3);
    if (mode === 1 || mode === 2) {
      a.push(日本の今().日付);
      w += ` AND z."入庫日" ${mode === 1 ? "<=" : ">"} $2::date AND z."在庫ケース" <> 0`;
    }
    if (n(req.query.shohin)) {
      a.push(n(req.query.shohin));
      w += ` AND z."商品コード" = $${a.length}`;
    }
    return q(
      `SELECT ${在庫の列} FROM ${倉庫の在庫} z LEFT JOIN ${得意先マスタ} m ON m."短縮コード" = z."入庫後名義ID"
       WHERE z."倉庫ID" = $1${w} ORDER BY z."商品コード", z."製造日", z."賞味期限", z."在庫ID"`,
      a,
    );
  });
  app.get<{ Params: { code: string } }>("/api/soko/joho/:code/shohin", async (req) =>
    q(`SELECT "商品コード" AS id, MIN("商品名") AS name FROM ${倉庫の在庫} WHERE "倉庫ID" = $1 GROUP BY "商品コード" ORDER BY "商品コード"`, [n(req.params.code)]),
  );
  // 入庫一覧：日を入れるとその入庫日だけ（Access は開いたときは絞らない）
  app.get<{ Params: { code: string }; Querystring: { date?: string } }>("/api/soko/joho/:code/nyuko", async (req) =>
    q(
      `SELECT ${在庫の列} FROM ${倉庫の在庫} z LEFT JOIN ${得意先マスタ} m ON m."短縮コード" = z."入庫後名義ID"
       WHERE z."倉庫ID" = $1 ${日付か(req.query.date) ? `AND z."入庫日"::date = $2::date` : ""} ORDER BY z."商品コード", z."製造日", z."賞味期限", z."タグ", z."在庫ID"`,
      日付か(req.query.date) ? [n(req.params.code), req.query.date] : [n(req.params.code)],
    ),
  );
  // 出庫一覧：在庫につながっている出庫。日を入れるとその出荷日だけ
  app.get<{ Params: { code: string }; Querystring: { date?: string } }>("/api/soko/joho/:code/shukko", async (req) =>
    q(
      `SELECT s.*, ${日付の列("s.", ["出荷日", "納品日", "製造日", "賞味期限"])}, p."運送会社名" FROM ${倉庫の出荷} s LEFT JOIN ${倉庫の便} p ON p."輸送ID" = s."輸送ID"
       WHERE s."倉庫ID" = $1 AND s."在庫ID" <> 0 ${日付か(req.query.date) ? `AND s."出荷日"::date = $2::date` : ""}
       ORDER BY s."出荷日", s."商品コード", s."賞味期限", s."届け先コード", s."タグ", s."出庫ID"`,
      日付か(req.query.date) ? [n(req.params.code), req.query.date] : [n(req.params.code)],
    ),
  );
  // 名変一覧（Access は集計開始日・終了日を入れても絞らない）
  app.get<{ Params: { code: string } }>("/api/soko/joho/:code/meihen", async (req) =>
    q(
      `SELECT h.*, ${日付の列("h.", ["変更日", "製造日", "賞味期限", "譲渡人負担日", "譲受人負担日"])},
              (SELECT "短縮名" FROM ${得意先マスタ} m WHERE m."短縮コード" = h."変更前名義ID" LIMIT 1) AS "変更前名義",
              (SELECT "短縮名" FROM ${得意先マスタ} m WHERE m."短縮コード" = h."変更後名義ID" LIMIT 1) AS "変更後名義"
       FROM ${倉庫の名変} h WHERE h."保管庫ID" = $1 AND h."在庫No" <> 0 AND h."変更区分" = 0 ORDER BY h."変更日", h."変更No"`,
      [n(req.params.code)],
    ),
  );

  // 商品別在庫（FM_商品別在庫）：出荷元（在庫のある冷蔵庫）・名義（その冷蔵庫の在庫にある名義）と、集計日の仮締め
  app.get<{ Querystring: { soko?: string } }>("/api/soko/shohinbetsu/choices", async (req) => ({
    出荷元: await q(
      `SELECT z."倉庫ID" AS id, m."短縮名" AS name FROM ${倉庫の在庫} z LEFT JOIN ${得意先マスタ} m ON m."短縮コード" = z."倉庫ID" GROUP BY z."倉庫ID", m."短縮名" ORDER BY z."倉庫ID"`,
    ),
    名義: n(req.query.soko)
      ? await q(
          `SELECT z."入庫後名義ID" AS id, m."短縮名" AS name, COUNT(z."入庫後名義ID") AS "件数" FROM ${倉庫の在庫} z LEFT JOIN ${得意先マスタ} m ON m."短縮コード" = z."入庫後名義ID"
           WHERE z."倉庫ID" = $1 GROUP BY z."入庫後名義ID", m."短縮名" ORDER BY COUNT(z."入庫後名義ID") DESC`,
          [n(req.query.soko)],
        )
      : [],
    最初の名義: n(req.query.soko) ? (await q(`SELECT MIN("入庫後名義ID") AS v FROM ${倉庫の在庫} WHERE "倉庫ID" = $1`, [n(req.query.soko)]))[0]?.v ?? null : null,
  }));
  app.get<{ Querystring: { soko: string; meigi: string; date: string } }>("/api/soko/shohinbetsu", async (req, reply) => {
    if (!日付か(req.query.date)) return reply.code(400).send({ error: "集計日が正しくありません" });
    const c = await pool.connect();
    try {
      return まとめる(await 仮締め(c, req.query.date, n(req.query.soko), n(req.query.meigi)));
    } finally {
      c.release();
    }
  });
  // ［Excel］（倉庫在庫：全部の冷蔵庫・名義・商品の在庫残数・kg）
  app.get<{ Querystring: { date: string } }>("/api/soko/shohinbetsu/excel", async (req, reply) => {
    if (!日付か(req.query.date)) return reply.code(400).send({ error: "集計日が正しくありません" });
    const c = await pool.connect();
    let rows: Rec[];
    try {
      rows = まとめる(await 仮締め(c, req.query.date));
    } finally {
      c.release();
    }
    const out = rows.map((r) => ({ 倉庫ID: r.倉庫ID, 倉庫名: r.倉庫名, 入庫後名義ID: r.入庫後名義ID, 商品コード: r.商品コード, 商品名: r.商品名, 在庫残数: r.在庫残数, 在庫残kg: r.在庫残kg }));
    const 列 = Object.keys(out[0] ?? { 倉庫ID: 0 }).map((key) => ({ key, width: key === "商品名" || key === "倉庫名" ? 26 : 12 }));
    const buf = await 一覧のExcel("倉庫在庫", 列, out);
    reply
      .header("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
      .header("Content-Disposition", `attachment; filename*=UTF-8''${encodeURIComponent("倉庫在庫.xlsx")}`);
    return reply.send(buf);
  });
}
