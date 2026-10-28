import type { FastifyInstance } from "fastify";
import type { PoolClient } from "pg";
import { pool, t, 日本の今 } from "./db.js";
import { requireUser } from "./auth.js";
import { 一連で, 出荷の既定値, 賞味期限計算 } from "./ws.js";
import { 在庫見込み } from "./wsZaiko.js";
import { パレット計算 } from "./wsJuchu.js";

// 丸北WorkStation の年間受注割振り（Access の F_受注検索_商品ベース_年月基準・M_年間テーブル作成_製造日ベース）
// インポート処理の「年間受注読込」から開く。受注年月と商品で、届け先ごとの月の受注数・出荷済み・出荷予定・残りを出し、
// 「選択」で在庫を割り付けて、この便に出荷の行を作る。
// 月の表（TMS_本社依頼受注_製造）は、Access と同じく検索のたびに足りない届け先の行を作り、数を出し直す。
const 輸送計画 = t("ws", "TD_輸送計画");
const 出荷 = t("ws", "TD_出荷");
const 月の表 = t("ws", "TMS_本社依頼受注_製造");
const WS受注 = t("ws", "TD_受注");
const 計画の入庫 = t("seizo", "TD_入庫"); // WorkStation の TD_入庫 は製造管理のもの
const 月末在庫 = t("ws_fe", "T_月末在庫_保管場所商品別");
const 倉庫の出庫 = t("soko", "TD_出荷"); // Access の T_出庫（倉庫管理の出庫を 7 日前〜60 日後だけ写した表）のもと
const 得意先マスタ = t("kyotsu", "TM_得意先マスタ");
const 商品マスタ = t("kyotsu", "TM_商品マスタ");
const 出荷場所条件 = t("ws_fe", "TM_出荷場所条件");

// Access の Q_出荷レコード（便のある出荷。届け先コードが 0 や空のものは入らない）
const 出荷レコード = `(SELECT s.*, m."グループ商品コード" FROM ${出荷} s JOIN ${輸送計画} p ON p."輸送ID" = s."輸送ID"
  LEFT JOIN ${商品マスタ} m ON m."商品コード" = s."商品コード" WHERE s."届け先コード" <> 0)`;
// Access の QS_本社出荷条件（出荷場所がユーザー区分 1 の出荷）
const 本社出荷条件 = `(SELECT s.*, m."グループ商品コード" FROM ${出荷} s LEFT JOIN ${得意先マスタ} u ON u."短縮コード" = s."倉庫ID"
  LEFT JOIN ${商品マスタ} m ON m."商品コード" = s."商品コード" WHERE u."ユーザー区分" = 1)`;
// 届け先の候補から外すコード（Access の AQ_商品別届け先ver2 と同じ）
const 外す届け先 = [0, 10, 11, 191, 1029, 133, 1165, 4564];

type Rec = Record<string, any>;
type Db = PoolClient | typeof pool;
const n = (v: unknown) => Number(v ?? 0) || 0;
const pad = (v: number) => String(v).padStart(2, "0");

/** 日付（YYYY-MM-DD）に月を足す。月末を越えるときはその月の末日（Access の DateAdd("m") と同じ） */
function 月を足す(d: string, m: number): string {
  const y = Number(d.slice(0, 4));
  const mo = Number(d.slice(5, 7)) - 1 + m;
  const yy = y + Math.floor(mo / 12);
  const mm = ((mo % 12) + 12) % 12;
  const last = new Date(Date.UTC(yy, mm + 1, 0)).getUTCDate();
  return `${yy}-${pad(mm + 1)}-${pad(Math.min(Number(d.slice(8, 10)), last))}`;
}
function 日を足す(d: string, k: number): string {
  return new Date(Date.parse(d.slice(0, 10) + "T00:00:00Z") + k * 86400000).toISOString().slice(0, 10);
}

/** 受注年月（yymm）からその月の初日・末日。月が 00（年間）や形の違うものは null */
export function 月の範囲(年月: string): { 開始: string; 終了: string } | null {
  if (!/^\d{4}$/.test(年月)) return null;
  const m = Number(年月.slice(2));
  if (m < 1 || m > 12) return null;
  const 開始 = `20${年月.slice(0, 2)}-${pad(m)}-01`;
  return { 開始, 終了: 日を足す(月を足す(開始, 1), -1) };
}

async function 合計(c: Db, from: string, where: string, args: unknown[], 列 = "ケース"): Promise<number> {
  return n((await c.query(`SELECT SUM("${列}") AS v FROM ${from} x WHERE ${where}`, args)).rows[0]?.v);
}

async function グループ(c: Db, 商品コード: number): Promise<number> {
  return n((await c.query(`SELECT "グループ商品コード" FROM ${商品マスタ} WHERE "商品コード" = $1 LIMIT 1`, [商品コード])).rows[0]?.グループ商品コード);
}

/** 前に出荷したときの名義・取引元・帳合（Access の「前回処理済みの出荷データから引用」） */
async function 前回の出荷(c: Db, 運賃振分区分: number, 商品: number, 届け先: number) {
  const id = n(
    (
      await c.query(
        `SELECT MAX("出庫ID") AS v FROM ${出荷レコード} x WHERE "運賃振分区分" = $1 AND "chk" = true AND "グループ商品コード" = $2 AND "届け先コード" = $3`,
        [運賃振分区分, 商品, 届け先],
      )
    ).rows[0]?.v,
  );
  const r = (await c.query(`SELECT "入庫後名義ID", "取引元ID", "取引帳合ID" FROM ${出荷} WHERE "出庫ID" = $1`, [id])).rows[0];
  return { 入庫後名義ID: n(r?.入庫後名義ID), 取引元ID: n(r?.取引元ID), 取引帳合ID: n(r?.取引帳合ID) };
}

/** 前の月の受注残数（Access の 年間前月繰越数。見つからなければ null） */
async function 前月の残り(c: Db, r: Rec, 開始: string): Promise<number | null> {
  const v = (
    await c.query(
      `SELECT "受注残数" FROM ${月の表} WHERE "運賃振分区分" = $1 AND "届け先コード" = $2 AND "グループ商品コード" = $3
       AND "集計開始日" = $4::date AND "集計終了日" = $5::date ORDER BY "個別受注ID" LIMIT 1`,
      [n(r.運賃振分区分), n(r.届け先コード), n(r.グループ商品コード), 月を足す(開始, -1), 日を足す(開始, -1)],
    )
  ).rows[0];
  return v ? (v.受注残数 ?? null) : null;
}

/** 月の表の数を出し直す（Access の C_年間受注テーブル集計_製造日ベース） */
async function 集計(c: PoolClient, 開始: string, 終了: string, 商品: number) {
  const 今日 = 日本の今().日付;
  const rows = (
    await c.query(
      `SELECT * FROM ${月の表} WHERE "グループ商品コード" = $1 AND "集計開始日" = $2::date AND "集計終了日" = $3::date ORDER BY "個別受注ID"`,
      [商品, 開始, 終了],
    )
  ).rows;
  for (const r of rows) {
    const 届け先 = n(r.届け先コード);
    const 扱い = n(r.運賃振分区分);
    const v: Rec = {};
    // 前月までに作った分の出荷（製造日が月より前で、納品日がこの月）
    const 前月分 = `"届け先コード" = $1 AND "グループ商品コード" = $2 AND "製造日" < $3::date AND "納品日" BETWEEN $3::date AND $4::date`;
    v.前月繰越出荷済み数 = await 合計(c, 出荷レコード, `"chk" = true AND ${前月分}`, [届け先, 商品, 開始, 終了]);
    v.前月繰越出荷見込み数 = await 合計(c, 出荷レコード, `"chk" = false AND ${前月分}`, [届け先, 商品, 開始, 終了]);
    v.前月繰越残数 = n(r.前月繰越数) - (v.前月繰越出荷済み数 + v.前月繰越出荷見込み数);
    v.年間前月繰越数 = n(await 前月の残り(c, r, 開始));
    // 届け先が倉庫のときの、明日から 60 日の倉庫の出庫予定（Access は倉庫管理の出庫を写した T_出庫 から。ここでは倉庫管理の表を直接見る）
    v.在庫出荷予定数 = n(
      (
        await c.query(
          `SELECT SUM(x."ケース") AS v FROM ${倉庫の出庫} x LEFT JOIN ${商品マスタ} m ON m."商品コード" = x."商品コード"
           WHERE x."運賃振分区分" = $1 AND x."出荷日" > $2::date AND x."出荷日" <= $2::date + 60 AND x."倉庫ID" = $3 AND m."グループ商品コード" = $4`,
          [扱い, 今日, 届け先, 商品],
        )
      ).rows[0]?.v,
    );
    // この月に作った分の出荷（丸北の工場から）
    const 当月 = `"インポート場所ID" = 1 AND "グループ商品コード" = $1 AND "製造日" BETWEEN $2::date AND $3::date AND "運賃振分区分" = $4`;
    const 当月args = [商品, 開始, 終了, 扱い, 届け先];
    v.出荷済みケース = (await 合計(c, 出荷レコード, `"chk" = true AND ${当月} AND "届け先コード" = $5`, 当月args)) + v.前月繰越出荷済み数;
    v.出荷見込ケース = (await 合計(c, 出荷レコード, `"chk" = false AND ${当月} AND "届け先コード" = $5`, 当月args)) + v.前月繰越出荷見込み数;
    v.出荷ケース = v.出荷済みケース + v.出荷見込ケース;
    v.残ケース = v.前月繰越残数 + n(r.調整ケース) + n(r.製造分割数) - v.出荷ケース;
    v.合算予定数 = v.前月繰越残数 + n(r.調整ケース) + n(r.製造分割数);
    // Access では現在庫数が空だと予定在庫数も空になる
    v.予定在庫数 = r.現在庫数 === null ? null : n(r.現在庫数) - v.在庫出荷予定数;

    if (v.年間前月繰越数 !== 0 || n(r.受注元数) !== 0) {
      // 受注の出荷（出荷日がこの月のもの）。Access の「見込み2」は 出荷日が空 かつ 出荷日がこの月 という条件で、いつも 0
      const 受注分 = `"届け先コード" = $1 AND "グループ商品コード" = $2 AND "出荷日" BETWEEN $3::date AND $4::date AND "運賃振分区分" = $5`;
      v.受注出荷済み数 = await 合計(c, 出荷レコード, `"chk" = true AND ${受注分}`, [届け先, 商品, 開始, 終了, 扱い]);
      v.受注出荷見込み数 = await 合計(c, 出荷レコード, `"chk" = false AND ${受注分}`, [届け先, 商品, 開始, 終了, 扱い]);
      v.受注残数 = n(r.受注元数) + v.年間前月繰越数 + n(r.年間調整数) - (v.受注出荷済み数 + v.受注出荷見込み数);
      // 次の月に出す予定（この月に作った分で、出荷日が次の月）
      v.次月出荷予定数 = await 合計(
        c,
        出荷レコード,
        `"届け先コード" = $5 AND ${当月} AND "chk" = false AND "出荷日" BETWEEN $6::date AND $7::date`,
        [...当月args, 月を足す(開始, 1), 月を足す(終了, 1)],
      );
    } else {
      // 受注が入っていないものは出さない
      v.受注出荷済み数 = 0;
      v.受注出荷見込み数 = 0;
      v.受注残数 = 0;
    }
    if (!n(r.取引元ID)) Object.assign(v, await 前回の出荷(c, 扱い, n(r.商品コード), 届け先));
    const keys = Object.keys(v);
    await c.query(
      `UPDATE ${月の表} SET ${keys.map((k, i) => `"${k}" = $${i + 2}`).join(", ")} WHERE "個別受注ID" = $1`,
      [r.個別受注ID, ...keys.map((k) => v[k])],
    );
  }
}

/** 月の表を作る（Access の C_年間受注テーブル作成_製造日ベース）。この 400 日に出荷した届け先で、まだ行のないものを足してから数を出し直す */
export async function 月の表を作る(c: PoolClient, 開始: string, 終了: string, 商品コード: number) {
  const 今日 = 日本の今().日付;
  const cand = (
    await c.query(
      `SELECT DISTINCT s."届け先コード", s."届け先", m."グループ商品コード", s."運賃振分区分"
       FROM ${出荷} s LEFT JOIN ${商品マスタ} m ON m."商品コード" = s."商品コード" LEFT JOIN ${得意先マスタ} u ON u."短縮コード" = s."届け先コード"
       WHERE s."出荷日" > $1::date - 400 AND s."chk" = true AND u."ユーザー区分" IN (0, 3) AND s."届け先コード" <> ALL($2::int[])
         AND m."グループ商品コード" = $3`,
      [今日, 外す届け先, 商品コード],
    )
  ).rows;
  await c.query(`SELECT pg_advisory_xact_lock(hashtext('TMS_本社依頼受注_製造.個別受注ID'))`);
  let next = n((await c.query(`SELECT COALESCE(MAX("個別受注ID"), 0) + 1 AS n FROM ${月の表}`)).rows[0].n);
  for (const r of cand) {
    const 扱い = n(r.運賃振分区分);
    const ある = (
      await c.query(
        `SELECT 1 FROM ${月の表} WHERE "運賃振分区分" = $1 AND "届け先コード" = $2 AND "グループ商品コード" = $3 AND "集計開始日" = $4::date AND "集計終了日" = $5::date LIMIT 1`,
        [扱い, n(r.届け先コード), r.グループ商品コード, 開始, 終了],
      )
    ).rowCount;
    if (ある) continue;
    const m = (await c.query(`SELECT "商品名", "規格", "入数" FROM ${商品マスタ} WHERE "商品コード" = $1 LIMIT 1`, [r.グループ商品コード])).rows[0];
    const 一回 = (
      await c.query(`SELECT MAX("ケース") AS v FROM ${WS受注} WHERE "届け先コード" = $1 AND "納品日" BETWEEN $2::date AND $3::date`, [
        n(r.届け先コード),
        月を足す(開始, -1),
        月を足す(終了, -1),
      ])
    ).rows[0]?.v;
    const 年月 = `${開始.slice(2, 4)}${開始.slice(5, 7)}`;
    const v: Rec = {
      個別受注ID: next++,
      運賃振分区分: 扱い,
      届け先コード: n(r.届け先コード),
      届け先: r.届け先,
      商品コード: n(r.グループ商品コード),
      グループ商品コード: r.グループ商品コード,
      商品名: m?.商品名 ?? "0",
      規格: m?.規格 ?? null,
      入数: m?.入数 ?? null,
      一回発注数: 一回 ?? null,
      集計開始日: 開始,
      集計終了日: 終了,
      年月,
      統一受注ID: `${年月}-${r.グループ商品コード}`,
    };
    v.年間前月繰越数 = await 前月の残り(c, v, 開始);
    Object.assign(v, await 前回の出荷(c, 扱い, n(v.商品コード), n(v.届け先コード)));
    const keys = Object.keys(v);
    await c.query(
      `INSERT INTO ${月の表} (${keys.map((k) => `"${k}"`).join(", ")}) VALUES (${keys.map((_, i) => `$${i + 1}`).join(", ")})`,
      keys.map((k) => v[k]),
    );
  }
  await 集計(c, 開始, 終了, 商品コード);
}

/** 画面上の「当月出来高」「前月繰越」（Access の My商品条件セット の月間集計） */
async function 上の数(c: Db, 開始: string, 終了: string, 商品: number) {
  const 月 = `"出荷日" BETWEEN $2::date AND $3::date AND "グループ商品コード" = $1`;
  const 当月製造 = `${月} AND "製造日" BETWEEN $2::date AND $3::date`;
  const 前月製造 = `${月} AND "製造日" < $2::date`;
  const a = [商品, 開始, 終了];
  const 当月製造数 = n(
    (
      await c.query(
        `SELECT SUM(i."ケース") AS v FROM ${計画の入庫} i LEFT JOIN ${商品マスタ} m ON m."商品コード" = i."商品コード"
         WHERE m."グループ商品コード" = $1 AND i."製造日" BETWEEN $2::date AND $3::date`,
        a,
      )
    ).rows[0]?.v,
  );
  const 製造出荷済み = await 合計(c, 出荷レコード, `"chk" = true AND ${当月製造}`, a);
  const 製造出荷見込み = await 合計(c, 出荷レコード, `"chk" = false AND ${当月製造}`, a);
  // 前の月末の在庫（月末在庫の表。商品コードはグループの商品コードで探す）＋ まだ包装していない前の月の製造分
  const 前月 = `${月を足す(開始, -1).slice(0, 7).replace("-", "/")}`;
  let 前月在庫残 = n(
    (await c.query(`SELECT SUM("在庫ケース") AS v FROM ${月末在庫} WHERE "集計月" = $1 AND "ユーザー区分" = 1 AND "商品コード" = $2`, [前月, 商品])).rows[0]?.v,
  );
  前月在庫残 += n(
    (await c.query(`SELECT SUM("ケース") AS v FROM ${計画の入庫} WHERE "入庫日" >= $1::date AND "商品コード" = $2 AND "製造日" < $1::date`, [開始, 商品])).rows[0]?.v,
  );
  const 出荷済み2 = await 合計(c, 出荷レコード, `"chk" = true AND ${前月製造}`, a);
  const 出荷見込2 = await 合計(c, 出荷レコード, `"chk" = false AND ${前月製造}`, a);
  const 見込み数 = await 合計(c, 出荷レコード, `"インポート場所ID" = 1 AND "chk" = false AND "納品日" IS NULL AND ${月}`, a);
  return {
    当月製造数,
    製造出荷済み,
    製造出荷見込み,
    当月製造残数: 当月製造数 - 製造出荷済み - 製造出荷見込み,
    前月在庫残,
    出荷済み2,
    出荷見込2,
    当月在庫残数: 前月在庫残 - (出荷済み2 + 出荷見込2 + 見込み数),
  };
}

const 一覧の列 = `t."個別受注ID", t."統一受注ID", t."年月", t."集計開始日", t."集計終了日", t."運賃振分区分", t."届け先コード", t."届け先",
  t."商品コード", t."グループ商品コード", t."商品名", t."入数", t."年間前月繰越数", t."年間調整数", t."受注元数", t."受注出荷済み数",
  t."受注出荷見込み数", t."受注残数", t."次月出荷予定数", t."備考", t."chk"`;

async function 一覧(c: Db, 年月: string, 商品: number) {
  return (
    await c.query(
      `SELECT ${一覧の列} FROM ${月の表} t
       WHERE (t."年間前月繰越数" <> 0 OR t."受注元数" <> 0) AND t."年月" = $1 AND t."グループ商品コード" = $2
       ORDER BY t."運賃振分区分", left(t."届け先コード"::text, 1), t."届け先コード", t."集計開始日", t."集計終了日", t."大阪受注ID", t."個別受注ID"`,
      [年月, 商品],
    )
  ).rows;
}

function 合言葉が違う(合言葉: unknown): string | null {
  const pass = process.env.JUCHU_DELETE_PASSWORD;
  if (!pass) return "合言葉がサーバーに設定されていないため、編集できません。";
  return String(合言葉 ?? "") === pass ? null : "パスワードが違います";
}

// 編集で直せる項目と、直したあとに受注残数を出し直すか
/**
 * 受注元数を変えたときに、その行の出荷済み・見込み・残を出し直す（Access と同じく、製造日は見ない）。
 * r は受注元数を入れたあとの行。大阪 月間受注登録（kg で入れる）からも使う
 */
export async function 受注の出荷を出し直す(c: Db, r: Rec): Promise<Rec> {
  const w = `"グループ商品コード" = $1 AND "出荷日" BETWEEN $2::date AND $3::date AND "運賃振分区分" = $4 AND "届け先コード" = $5`;
  const a = [n(r.商品コード), r.集計開始日, r.集計終了日, n(r.運賃振分区分), n(r.届け先コード)];
  const 済み = await 合計(c, 出荷レコード, `"chk" = true AND ${w}`, a);
  const 見込み = await 合計(c, 出荷レコード, `"chk" = false AND ${w}`, a);
  return {
    受注出荷済み数: 済み,
    受注出荷見込み数: 見込み,
    受注残数: n(r.年間前月繰越数) + n(r.年間調整数) + n(r.受注元数) - (済み + 見込み),
  };
}

const 直せる項目: Record<string, "数" | "文字"> = { 年間前月繰越数: "数", 年間調整数: "数", 受注元数: "数", 備考: "文字", 運賃振分区分: "数" };

export function wsNenkanRoutes(app: FastifyInstance) {
  app.addHook("preHandler", requireUser);

  // 出荷場所の選択肢（Access の txt_倉庫ID：この商品を出した倉庫）
  app.get<{ Querystring: { shohin: string } }>("/api/ws/nenkan/soko", async (req) => {
    const g = await グループ(pool, n(req.query.shohin));
    return (
      await pool.query(
        `SELECT "倉庫ID" AS id, MIN("倉庫名") AS name FROM ${出荷レコード} x WHERE "グループ商品コード" = $1 AND "倉庫ID" IS NOT NULL GROUP BY "倉庫ID" ORDER BY "倉庫ID"`,
        [g],
      )
    ).rows;
  });

  // 検索（Access の My商品条件セット）。月の表を作って数を出し直し、上の数と一覧を返す
  app.post<{ Body: { 年月: string; 商品コード: number } }>("/api/ws/nenkan/search", async (req, reply) => {
    const 年月 = String(req.body.年月 ?? "").trim();
    const 商品コード = n(req.body.商品コード);
    if (/^\d{2}00$/.test(年月))
      return reply.code(400).send({ error: "年間（月が 00）の受注は今は使われていないため、この画面では扱いません。月を入れてください。" });
    const 範囲 = 月の範囲(年月);
    if (!範囲) return reply.code(400).send({ error: "受注年月は「2610」のように、年の下 2 けたと月の 4 けたで入れてください。" });
    const m = (await pool.query(`SELECT "商品名", "グループ商品コード", "入数" FROM ${商品マスタ} WHERE "商品コード" = $1 LIMIT 1`, [商品コード])).rows[0];
    if (!m) return reply.code(400).send({ error: "この商品コードは商品マスタにありません。" });
    const g = n(m.グループ商品コード);
    return 一連で(async (c) => {
      await 月の表を作る(c, 範囲.開始, 範囲.終了, g);
      return { 商品名: m.商品名, グループ商品コード: g, 入数: m.入数, ...範囲, 上: await 上の数(c, 範囲.開始, 範囲.終了, g), rows: await 一覧(c, 年月, g) };
    });
  });

  // 編集に切り替える（Access の cmd_マスタ編集_Click の合言葉）
  app.post<{ Body: { 合言葉: string } }>("/api/ws/nenkan/unlock", async (req, reply) => {
    if (!process.env.JUCHU_DELETE_PASSWORD) return reply.code(400).send({ error: "合言葉がサーバーに設定されていないため、編集できません。" });
    return { ok: !合言葉が違う(req.body.合言葉) };
  });

  // 1 つの項目を直す（Access の 受注元数・年間前月繰越数・年間調整数 の AfterUpdate）
  app.post<{ Body: { 合言葉: string; 個別受注ID: number; 項目: string; 値: unknown } }>("/api/ws/nenkan/save", async (req, reply) => {
    const e = 合言葉が違う(req.body.合言葉);
    if (e) return reply.code(403).send({ error: e });
    const 種類 = 直せる項目[req.body.項目];
    if (!種類) return reply.code(400).send({ error: "この項目は直せません。" });
    const 値 = 種類 === "数" ? (req.body.値 === "" || req.body.値 === null ? null : n(req.body.値)) : req.body.値 === "" ? null : String(req.body.値 ?? "");
    return 一連で(async (c) => {
      const r = (await c.query(`SELECT * FROM ${月の表} WHERE "個別受注ID" = $1 FOR UPDATE`, [n(req.body.個別受注ID)])).rows[0];
      if (!r) return reply.code(404).send({ error: "この行はありません。" });
      r[req.body.項目] = 値;
      const set: Rec = { [req.body.項目]: 値 };
      if (req.body.項目 === "受注元数") Object.assign(set, await 受注の出荷を出し直す(c, r));
      if (req.body.項目 !== "備考" && req.body.項目 !== "運賃振分区分")
        set.受注残数 = n(r.年間前月繰越数) + n(r.年間調整数) + n(r.受注元数) - (n(r.受注出荷済み数) + n(r.受注出荷見込み数));
      const keys = Object.keys(set);
      await c.query(`UPDATE ${月の表} SET ${keys.map((k, i) => `"${k}" = $${i + 2}`).join(", ")} WHERE "個別受注ID" = $1`, [
        r.個別受注ID,
        ...keys.map((k) => set[k]),
      ]);
      return { ok: true, ...set };
    });
  });

  // 行を足す（編集のとき。Access は表の最後の行に打ち込む。年月・商品・集計期間は検索の値が入る）
  app.post<{ Body: { 合言葉: string; 年月: string; 商品コード: number; 届け先コード: number; 運賃振分区分: number } }>(
    "/api/ws/nenkan/add",
    async (req, reply) => {
      const e = 合言葉が違う(req.body.合言葉);
      if (e) return reply.code(403).send({ error: e });
      const 範囲 = 月の範囲(String(req.body.年月 ?? ""));
      if (!範囲) return reply.code(400).send({ error: "受注年月が正しくありません。" });
      const 商品コード = n(req.body.商品コード);
      const m = (await pool.query(`SELECT "商品名", "規格", "入数", "グループ商品コード" FROM ${商品マスタ} WHERE "商品コード" = $1 LIMIT 1`, [商品コード])).rows[0];
      if (!m) return reply.code(400).send({ error: "この商品コードは商品マスタにありません。" });
      const 届け先 = (await pool.query(`SELECT "短縮名" FROM ${得意先マスタ} WHERE "短縮コード" = $1 LIMIT 1`, [n(req.body.届け先コード)])).rows[0];
      if (!届け先) return reply.code(400).send({ error: "この届け先コードは得意先マスタにありません。" });
      return 一連で(async (c) => {
        await c.query(`SELECT pg_advisory_xact_lock(hashtext('TMS_本社依頼受注_製造.個別受注ID'))`);
        const id = n((await c.query(`SELECT COALESCE(MAX("個別受注ID"), 0) + 1 AS n FROM ${月の表}`)).rows[0].n);
        const v: Rec = {
          個別受注ID: id, 年月: req.body.年月, 統一受注ID: `${req.body.年月}-${商品コード}`, 年間受注区分: false,
          // 月の表の商品はグループの商品コード（月の表を作るときと同じ。2026/10/28 点検）
          商品コード: n(m.グループ商品コード) || 商品コード, グループ商品コード: n(m.グループ商品コード) || 商品コード, 商品名: m.商品名, 規格: m.規格, 入数: m.入数,
          集計開始日: 範囲.開始, 集計終了日: 範囲.終了, 届け先コード: n(req.body.届け先コード), 届け先: 届け先.短縮名,
          運賃振分区分: n(req.body.運賃振分区分) || 1,
        };
        const keys = Object.keys(v);
        await c.query(
          `INSERT INTO ${月の表} (${keys.map((k) => `"${k}"`).join(", ")}) VALUES (${keys.map((_, i) => `$${i + 1}`).join(", ")})`,
          keys.map((k) => v[k]),
        );
        return { 個別受注ID: id };
      });
    },
  );

  // 行を消す（Access の Form_Delete。登録済み（chk）は消せない）
  app.post<{ Body: { 合言葉: string; 個別受注ID: number } }>("/api/ws/nenkan/delete", async (req, reply) => {
    const e = 合言葉が違う(req.body.合言葉);
    if (e) return reply.code(403).send({ error: e });
    const r = (await pool.query(`SELECT "chk" FROM ${月の表} WHERE "個別受注ID" = $1`, [n(req.body.個別受注ID)])).rows[0];
    if (!r) return reply.code(404).send({ error: "この行はありません。" });
    if (r.chk) return reply.code(400).send({ error: "登録済みの為削除できません" });
    await pool.query(`DELETE FROM ${月の表} WHERE "個別受注ID" = $1`, [n(req.body.個別受注ID)]);
    return { ok: true };
  });

  // 詳細（Access の FS_本社受注確認_出荷。納品日がこの月で、この商品・届け先の出荷）
  app.get<{ Params: { id: string } }>("/api/ws/nenkan/shosai/:id", async (req, reply) => {
    const r = (await pool.query(`SELECT * FROM ${月の表} WHERE "個別受注ID" = $1`, [n(req.params.id)])).rows[0];
    if (!r) return reply.code(404).send({ error: "この行はありません。" });
    return (
      await pool.query(
        `SELECT "輸送ID", "出庫ID", "chk", "出荷日", "納品日", "届け先", "倉庫名", "商品名", "製造日", "ケース", "商品kg", "運賃振分区分名"
         FROM ${出荷レコード} x WHERE "納品日" BETWEEN $1::date AND $2::date AND "グループ商品コード" = $3 AND "届け先コード" = $4 ORDER BY "出荷日", "出庫ID"`,
        [r.集計開始日, r.集計終了日, n(r.商品コード), n(r.届け先コード)],
      )
    ).rows;
  });

  // 選択：在庫を出す（Access の cmd_受注選択_Click → CC_KakuZaikoSum。生産計画も含む）
  app.get<{ Querystring: { id: string; shohin: string; soko: string } }>("/api/ws/nenkan/zaiko", async (req, reply) => {
    const r = (await pool.query(`SELECT * FROM ${月の表} WHERE "個別受注ID" = $1`, [n(req.query.id)])).rows[0];
    if (!r) return reply.code(404).send({ error: "この行はありません。" });
    const rows = await 在庫見込み(pool, { 商品コード: n(req.query.shohin), 倉庫ID: n(req.query.soko), 計画: true });
    return { 受注: r, rows };
  });

  // 選択：出荷の行を作る（Access の My出庫出力 の年間受注の分。受注残数フラグあり）。そのあと月の表を出し直す
  app.post<{
    Body: { 輸送ID: number; 個別受注ID: number; 商品コード: number; 倉庫ID: number; 選んだ?: { 認識ID: string; ケース: number; kg: number }[] };
  }>("/api/ws/nenkan/out", async (req, reply) => {
    const b = req.body;
    return 一連で(async (c) => {
      const plan = (await c.query(`SELECT "出荷計画日" FROM ${輸送計画} WHERE "輸送ID" = $1`, [n(b.輸送ID)])).rows[0];
      if (!plan) return reply.code(404).send({ error: "この便はありません" });
      const j = (await c.query(`SELECT * FROM ${月の表} WHERE "個別受注ID" = $1 FOR UPDATE`, [n(b.個別受注ID)])).rows[0];
      if (!j) return reply.code(404).send({ error: "この行はありません。" });

      type 行 = { z: Rec | null; ケース: number; kg: number | null };
      const 行たち: 行[] = [];
      if (b.選んだ) {
        const all = await 在庫見込み(c, { 商品コード: n(b.商品コード), 倉庫ID: n(b.倉庫ID), 計画: true });
        for (const s of b.選んだ) {
          const z = all.find((r) => String(r.認識ID) === String(s.認識ID));
          if (!z) return reply.code(400).send({ error: "選んだ在庫が見つかりません。もう一度選んでください。" });
          行たち.push({ z, ケース: n(s.ケース), kg: s.kg ?? null });
        }
      } else 行たち.push({ z: null, ケース: n(j.受注残数), kg: null }); // 在庫がないときは受注残数で 1 行

      const 届け先備考 = (await c.query(`SELECT "備考" FROM ${得意先マスタ} WHERE "短縮コード" = $1 LIMIT 1`, [n(j.届け先コード)])).rows[0]?.備考 ?? "";
      const 特別検査 =
        (await c.query(`SELECT "特別検査区分" FROM ${商品マスタ} WHERE "商品コード" = $1 LIMIT 1`, [n(j.商品コード)])).rows[0]?.特別検査区分 ?? false;
      await c.query(`SELECT pg_advisory_xact_lock(hashtext('TD_出荷.出庫ID'))`);
      let next = n((await c.query(`SELECT COALESCE(MAX("出庫ID"), 0) + 1 AS n FROM ${出荷}`)).rows[0].n);
      for (const { z, ケース, kg } of 行たち) {
        const v: Rec = {
          ...出荷の既定値,
          出庫ID: next++, 輸送ID: n(b.輸送ID), 出荷日: plan.出荷計画日,
          届け先コード: j.届け先コード, 届け先: j.届け先, 取引元ID: j.取引元ID, 取引帳合ID: j.取引帳合ID,
          取引元: (await c.query(`SELECT "短縮名" FROM ${得意先マスタ} WHERE "短縮コード" = $1 LIMIT 1`, [n(j.取引元ID)])).rows[0]?.短縮名 ?? null,
          取引帳合: (await c.query(`SELECT "短縮名" FROM ${得意先マスタ} WHERE "短縮コード" = $1 LIMIT 1`, [n(j.取引帳合ID)])).rows[0]?.短縮名 ?? null,
          運賃振分区分: j.運賃振分区分,
          運賃振分区分名: n(j.運賃振分区分) === 629 ? "大阪丸北" : "丸北 北海道",
          受注グループ: j.個別受注ID,
        };
        if (n(j.運賃振分区分) === 629) v.本社受注 = true;
        if (z) {
          Object.assign(v, {
            商品コード: z.商品コード, 商品名: z.商品名, 規格: z.規格, 入数: z.入数, ケース, 商品kg: kg || ケース * n(z.入数), // kg が 0 で届いたとき（ケースはある）は入数から（2026/10/28 点検）
            // 191 の倉庫は 44 ケースで 1 枚（端数は繰り上げ）
            パレット使用枚数: n(z.倉庫ID) === 191 ? (Number.isInteger(ケース / 44) ? ケース / 44 : Math.trunc(ケース / 44) + 1) : await パレット計算(c, z.商品コード, ケース),
            特別検査区分: 特別検査,
            入庫日: z.入庫日, 製造日: z.製造日, 賞味期限: z.賞味期限 ?? (await 賞味期限計算(c, z.製造日, z.商品コード)),
            入庫No: z.入庫No ?? null, 入庫ID: z.入庫ID, 倉庫ID: z.倉庫ID, 倉庫名: z.倉庫名, タグ: z.タグ ?? null, 入庫前名義ID: z.入庫後名義ID,
            認識ID: String(z.認識ID), 在庫ID: z.架空ID, 通知: "確認OK!", 製造工場ID: z.製造工場ID ?? null, 製造工場名: z.製造工場名 ?? null,
            商品区分: n(z.商品区分), 検体区分: z.検体区分 ?? false, 社内連絡: j.備考,
          });
          // 出荷日に包装が間に合わないときは知らせる
          if (z.入庫日 && String(plan.出荷計画日).slice(0, 10) < String(z.入庫日).slice(0, 10)) {
            v.計画変更chk = true;
            v.変更通知 = "出荷日に包装が間に合いません!";
          }
        } else {
          const 倉庫名 = (await c.query(`SELECT "短縮名" FROM ${得意先マスタ} WHERE "短縮コード" = $1 LIMIT 1`, [n(b.倉庫ID)])).rows[0]?.短縮名 ?? null;
          const 場所 = (await c.query(`SELECT "名義ID" FROM ${出荷場所条件} WHERE "倉庫ID" = $1 LIMIT 1`, [n(b.倉庫ID)])).rows[0];
          Object.assign(v, {
            商品コード: j.商品コード, 商品名: j.商品名, 規格: j.規格, 入数: j.入数, 倉庫ID: n(b.倉庫ID), 倉庫名,
            ケース, 商品kg: ケース * n(j.入数), 社内連絡: j.備考, 認識ID: "0", 在庫ID: 0, 入庫前名義ID: 場所?.名義ID ?? n(b.倉庫ID),
          });
        }
        const 場所 = (await c.query(`SELECT "手配元ID", "手配帳合ID", "手配元", "手配帳合" FROM ${出荷場所条件} WHERE "倉庫ID" = $1 LIMIT 1`, [n(v.倉庫ID)])).rows[0];
        v.手配元ID = 場所?.手配元ID ?? v.倉庫ID;
        v.手配帳合ID = 場所?.手配帳合ID ?? v.倉庫ID;
        v.手配元 = 場所?.手配元 ?? v.倉庫名;
        v.手配帳合 = 場所?.手配帳合 ?? v.倉庫名;
        v.入庫後名義ID = j.入庫後名義ID;
        v.年間受注ID = `${j.年月}-${j.商品コード}`;
        v.社内連絡 = `${v.社内連絡 ?? ""}\r\n${届け先備考}`;
        const keys = Object.keys(v);
        await c.query(
          `INSERT INTO ${出荷} (${keys.map((k) => `"${k}"`).join(", ")}) VALUES (${keys.map((_, i) => `$${i + 1}`).join(", ")})`,
          keys.map((k) => v[k]),
        );
      }
      // 月の表の残ケース（Access と同じく、出荷ケースから、月末より後に納める大阪丸北の出荷を引く。空なら空）
      const 後 = (
        await c.query(
          `SELECT SUM("ケース") AS v FROM ${本社出荷条件} x WHERE "グループ商品コード" = $1 AND "納品日" > $2::date AND "運賃振分区分" = 629`,
          [n(j.商品コード), j.集計終了日],
        )
      ).rows[0]?.v;
      const 残 = 後 === null || 後 === undefined || j.出荷ケース === null ? null : n(j.出荷ケース) - n(後);
      await c.query(`UPDATE ${月の表} SET "残ケース" = $2, "chk" = false WHERE "個別受注ID" = $1`, [j.個別受注ID, 残]);
      // 月の表を作り直す（Access は検索の年月の月で作り直す）
      await 月の表を作る(c, String(j.集計開始日).slice(0, 10), String(j.集計終了日).slice(0, 10), n(j.グループ商品コード));
      return { 件数: 行たち.length };
    });
  });
}
