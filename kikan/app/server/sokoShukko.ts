import type { FastifyInstance } from "fastify";
import type { PoolClient } from "pg";
import { q, t, 日本の今 } from "./db.js";
import { requireUser } from "./auth.js";
import { 一連で, 特別項目 } from "./ws.js";
import { 倉庫の便, 倉庫の出荷, 倉庫の名変, 倉庫の在庫, 締める } from "./soko.js";
import { 期限通知 } from "./wsZaiko.js";
import { 賞味期限計算 } from "./ws.js";

// 倉庫管理System の出庫入力（Access の FS_配車選択 → FM_出荷明細票・FS_出荷明細）。
// 便（TD_輸送計画）は出庫場所（冷蔵庫）と出庫No を持ち、明細（TD_出荷）は便の輸送ID と出荷日（＝便の出荷計画日）でつながる。
const 得意先マスタ = t("kyotsu", "TM_得意先マスタ");
const 商品マスタ = t("kyotsu", "TM_商品マスタ");
const 運送会社マスタ = t("kyotsu", "TM_運送会社マスタ");
const 名義条件 = t("soko_fe", "TM_入庫先商品別名義条件");
const 運賃振分区分マスタ = t("soko_fe", "TM_運賃振分区分マスタ");
const 倉庫の受注 = t("soko", "TD_受注"); // Access の QD_受注（受注登録の受注の写し）

type Rec = Record<string, any>;
const n = (v: unknown) => Number(v ?? 0) || 0;
const 日付 = (v: unknown) => (v ? String(v).slice(0, 10) : null);

/** 上の欄の選択肢（表と、コード・名前の項目） */
const 選択肢の表: Record<string, [string, string, string]> = {
  運賃区分ID: [t("soko_fe", "TM_運賃輸送区分"), "運賃輸送区分", "運賃輸送区分名"],
  輸送区分ID: [t("soko_fe", "TM_輸送区分"), "輸送区分ID", "輸送区分"],
  配達区分ID: [t("soko_fe", "TM_配達区分"), "配達区分ID", "配達区分"],
  車両区分ID: [t("soko_fe", "TM_車両区分"), "車両区分ID", "車両区分"],
  冷凍区分ID: [t("soko_fe", "TM_冷凍区分"), "冷凍ID", "冷凍区分"],
  運賃計算区分: [t("soko_fe", "TM_運賃分類マスタ"), "運賃計算ID", "運賃計算名"],
};

/** 便で画面から直せる項目 */
const 便の項目 = new Set([
  "出荷計画日", "運送会社ID", "手配運送会社コード", "帳合運送会社コード", "出庫場所ID", "出庫No", "車番", "乗務員", "携帯番号", "集荷日", "集荷時間", "担当者",
  "引取日", "引取時間", "集荷時備考", "引取備考", "セット温度", "冷凍区分ID", "運賃区分ID", "輸送区分ID", "車両区分ID", "配達区分ID", "運賃計算区分",
  "運行指令No", "納品日コメント", "受付時間", "接車時間", "出発時間",
]);
/** 明細で画面から直せる項目 */
const 明細の項目 = new Set([
  "倉庫ID", "商品コード", "届け先コード", "ケース", "製造日", "賞味期限", "納品日", "タグ", "備考", "社内連絡", "商品積込順", "出庫確認", "出庫済み",
  "入庫前名義ID", "入庫後名義ID", "ユーザー伝票No", "請求先コード", "取引元ID", "取引帳合ID", "手配元ID", "手配帳合ID", "サービス区分", "本社受注", "入庫備考",
]);
/** コードを入れたら名前も入れる項目 */
const 名前の組: Record<string, string> = {
  届け先コード: "届け先", 倉庫ID: "倉庫名", 取引元ID: "取引元", 取引帳合ID: "取引帳合", 手配元ID: "手配元", 手配帳合ID: "手配帳合", 請求先コード: "請求先",
};

async function 短縮名(c: PoolClient, code: unknown): Promise<string | null> {
  if (code === null || code === undefined || code === "") return null;
  return (await c.query(`SELECT "短縮名" FROM ${得意先マスタ} WHERE "短縮コード" = $1 LIMIT 1`, [n(code)])).rows[0]?.短縮名 ?? null;
}
async function 運送会社名(c: PoolClient, code: unknown): Promise<string | null> {
  if (code === null || code === undefined || code === "") return null;
  return (
    (
      await c.query(
        `SELECT "短縮名" FROM ${運送会社マスタ} WHERE "運送会社ID" = $1 ORDER BY COALESCE("使用不可フラグ", false), "運送会社名" IS NULL, "ID" LIMIT 1`,
        [n(code)],
      )
    ).rows[0]?.短縮名 ?? null
  );
}
async function 直す(c: PoolClient, 表: string, 鍵: string, id: number, v: Rec) {
  const k = Object.keys(v);
  if (k.length) await c.query(`UPDATE ${表} SET ${k.map((x, i) => `"${x}" = $${i + 2}`).join(", ")} WHERE "${鍵}" = $1`, [id, ...k.map((x) => v[x])]);
}

/** 表の項目の型（新しい行の既定値を作るため） */
const 型の控え: Record<string, Record<string, string>> = {};
/** 新しい行の既定値（Access の表の既定値：数は 0、はい／いいえは いいえ。鍵の項目は除く） */
async function 既定値(c: PoolClient, 表名: "TD_出荷" | "TD_輸送計画", 鍵: string): Promise<Rec> {
  if (!型の控え[表名]) {
    型の控え[表名] = {};
    for (const r of (await c.query(`SELECT column_name, data_type FROM information_schema.columns WHERE table_schema = 'soko' AND table_name = $1`, [表名])).rows)
      型の控え[表名][r.column_name] = r.data_type;
  }
  const v: Rec = {};
  for (const [k, ty] of Object.entries(型の控え[表名])) {
    if (k === 鍵) continue;
    if (ty === "boolean") v[k] = false;
    else if (["integer", "smallint", "bigint", "double precision", "real", "numeric"].includes(ty)) v[k] = 0;
  }
  return v;
}
async function 行を入れる(c: PoolClient, 表: string, v: Rec) {
  const k = Object.keys(v);
  await c.query(`INSERT INTO ${表} (${k.map((x) => `"${x}"`).join(", ")}) VALUES (${k.map((_, i) => `$${i + 1}`).join(", ")})`, k.map((x) => v[x]));
}

/**
 * 1 行の運賃振分け（Access の 倉庫管理の C_レコード別条件運賃振分け）。届け先が冷蔵庫なら届け先区分 3。
 * 入庫先商品別名義条件（届け先ごと）から、出荷元・商品（グループ商品コード）が合うもの、なければ商品が合うものの 運賃請求ID・運賃振分区分 を入れ、
 * 名義も入れる（629 なら本社受注）。冷蔵庫あては名義 629 なら 大阪デポ／大阪丸北、ほかは 丸北　北海道デポ／丸北　北海道 を取引元・取引帳合に。
 */
async function 運賃振分け(c: PoolClient, 出庫ID: number, 名義表示: boolean) {
  const r = (
    await c.query(`SELECT s.*, m."グループ商品コード" FROM ${倉庫の出荷} s LEFT JOIN ${商品マスタ} m ON m."商品コード" = s."商品コード" WHERE s."出庫ID" = $1`, [出庫ID])
  ).rows[0];
  if (!r) return;
  const v: Rec = {};
  const 倉庫区分 = (await c.query(`SELECT "倉庫区分" FROM ${得意先マスタ} WHERE "短縮コード" = $1 LIMIT 1`, [n(r.届け先コード)])).rows[0]?.倉庫区分;
  v.届け先区分 = 倉庫区分 === true ? 3 : 0;
  const 条件 = (await c.query(`SELECT * FROM ${名義条件} WHERE "届け先コード" = $1 ORDER BY "ID"`, [n(r.届け先コード)])).rows as Rec[];
  const g = n(r.グループ商品コード);
  const hit = 条件.find((x) => n(x.届け先コード) === n(r.届け先コード) && n(x.倉庫ID) === n(r.倉庫ID) && n(x.商品コード) === g) ?? 条件.find((x) => n(x.商品コード) === g);
  let 名義 = r.入庫後名義ID;
  if (hit) {
    v.運賃請求ID = hit.運賃請求ID;
    v.運賃振分区分 = hit.運賃振分区分;
    v.運賃振分区分名 = (await c.query(`SELECT "運賃振分区分名" FROM ${運賃振分区分マスタ} WHERE "運賃振分区分" = $1`, [n(hit.運賃振分区分)])).rows[0]?.運賃振分区分名 ?? null;
    if (名義表示) {
      名義 = n(hit.入庫名義ID);
      v.入庫後名義ID = 名義;
      if (名義 === 629) v.本社受注 = true;
    }
    if (v.届け先区分 === 3) {
      if (n(名義) === 629) Object.assign(v, { 取引元ID: 645, 取引元: "大阪デポ", 取引帳合ID: 629, 取引帳合: "大阪丸北" });
      else Object.assign(v, { 取引元ID: 1254, 取引元: "丸北　北海道デポ", 取引帳合ID: 11, 取引帳合: "丸北　北海道" });
    }
  }
  if (r.本社受注 === true || v.本社受注 === true) {
    v.運賃振分区分 = 629;
    v.運賃振分区分名 = (await c.query(`SELECT "運賃振分区分名" FROM ${運賃振分区分マスタ} WHERE "運賃振分区分" = 629`)).rows[0]?.運賃振分区分名 ?? null;
    v.本社受注 = true;
  }
  await 直す(c, 倉庫の出荷, "出庫ID", 出庫ID, v);
}

/** 受注の残ケースを出し直す（Access の C_残ケース処理。消す行のケースを引いて数える。名変で使った分も引く） */
async function 残ケース処理(c: PoolClient, 受注ID: number, 削除ケース = 0) {
  if (!受注ID) return;
  const 出荷 = n((await c.query(`SELECT SUM("ケース") AS v FROM ${倉庫の出荷} WHERE "受注ID" = $1`, [受注ID])).rows[0].v);
  const 名変 = n((await c.query(`SELECT SUM("ケース") AS v FROM ${倉庫の名変} WHERE "受注ID" = $1`, [受注ID])).rows[0].v);
  await c.query(`UPDATE ${倉庫の受注} SET "残ケース" = "ケース" - $2, "手配DataChk" = true WHERE "受注ID" = $1`, [受注ID, 出荷 - 削除ケース + 名変]);
}

/**
 * 在庫の見込み（Access の 倉庫管理の CC_KakuZaikoSum。作業用の表 TD_架空在庫ver2 に入れるかわりに、その場で計算して返す）。
 * 在庫kg が 0 でないロット（商品はグループ商品コードで、倉庫を指定すればその倉庫）を繰越にし、まだ登録していない出庫（日付は見ない）を認識ID で引く。
 * 在庫から選ぶときも「架空」から選ぶときも、Access は同じ結果になる（架空入庫を足す引数を渡していないため）。
 */
export async function 倉庫の在庫見込み(c: PoolClient, 商品コード: number, 倉庫ID: number): Promise<Rec[]> {
  const 今日 = 日本の今().日付;
  const g = n((await c.query(`SELECT "グループ商品コード" FROM ${商品マスタ} WHERE "商品コード" = $1 LIMIT 1`, [商品コード])).rows[0]?.グループ商品コード);
  const w: string[] = [];
  const a: unknown[] = [];
  if (商品コード) {
    a.push(g || 商品コード);
    w.push(`${g ? `x."グループ商品コード"` : `x."商品コード"`} = $${a.length}`);
  }
  if (倉庫ID) {
    a.push(倉庫ID);
    w.push(`x."倉庫ID" = $${a.length}`);
  }
  const 条件 = w.length ? w.join(" AND ") + " AND " : "";
  const lots = (
    await c.query(
      `SELECT x.*, x."入庫日"::date::text AS "入庫日", x."製造日"::date::text AS "製造日", x."賞味期限"::date::text AS "賞味期限" FROM ${倉庫の在庫} x
       WHERE ${条件} x."在庫kg" <> 0`,
      a,
    )
  ).rows as Rec[];
  const 行 = new Map<string, Rec>();
  for (const z of lots) {
    行.set(String(z.在庫ID), {
      入庫日: z.入庫日, 倉庫ID: z.倉庫ID, 倉庫名: z.倉庫名, 商品コード: z.商品コード, 分類ID: z.分類ID, 商品名: z.商品名, 規格: z.規格, 入数: z.入数,
      入庫後名義ID: z.入庫後名義ID, 製造日: z.製造日, 賞味期限: z.賞味期限, 繰越ケース: n(z.在庫ケース), 繰越kg: n(z.在庫kg), 製造ケース: 0, 製造kg: 0, 出庫ケース: 0, 出荷kg: 0,
      期: z.期, タグ: z.タグ, 備考在庫: z.入庫日 && z.入庫日 > 今日 ? `[${z.倉庫名 ?? ""}] 行き 輸送中\r\n` : "", 入庫No: z.入庫No, 入庫元数: z.入庫元数, 架空実物: false,
      出荷止め区分: z.出荷止め区分, 管理備考: z.管理備考, 出庫ID: z.出庫ID, 認識ID: String(z.在庫ID), 入庫ID: z.入庫ID, 在庫ケース: n(z.在庫ケース), 在庫kg: n(z.在庫kg),
      商品区分: z.商品区分, 商品状態隠語: z.商品状態隠語, グループ商品コード: z.グループ商品コード, 産地コード: z.産地コード, 製造工場ID: z.製造工場ID, 製造工場名: z.製造工場名,
      手配元ID: z.運賃振分区分, 最終出庫日: null, 通知: null,
    });
  }
  // まだ登録していない出庫（Q_出荷レコード：グループ商品コードは商品マスタの値）を出荷日の順に
  const 出庫 = (
    await c.query(
      `SELECT x."認識ID", x."ケース", x."商品kg", x."出荷日"::date::text AS "出荷日"
       FROM (SELECT s.*, m."グループ商品コード" FROM ${倉庫の出荷} s LEFT JOIN ${商品マスタ} m ON m."商品コード" = s."商品コード") x
       WHERE ${条件} x."chk" = false ORDER BY x."出荷日", x."出庫ID"`,
      a,
    )
  ).rows as Rec[];
  for (const s of 出庫) {
    const r = 行.get(String(s.認識ID ?? ""));
    if (!r) continue;
    r.出庫ケース += n(s.ケース);
    r.出荷kg += n(s.商品kg);
    r.最終出庫日 = s.出荷日;
    r.備考在庫 += s.出荷日 ? `${Number(s.出荷日.slice(5, 7))}月${Number(s.出荷日.slice(8, 10))}日 ${n(s.ケース)} 出\r\n` : "";
  }
  for (const r of 行.values()) {
    if (r.在庫ケース === 0) continue;
    r.在庫ケース = r.繰越ケース + r.製造ケース - r.出庫ケース;
    r.在庫kg = r.繰越kg + r.製造kg - r.出荷kg;
    if (r.賞味期限 == null) r.賞味期限 = await 賞味期限計算(c, r.製造日, r.商品コード);
    const 残日数設定 = n((await c.query(`SELECT "USER賞味残日数" AS v FROM ${商品マスタ} WHERE "商品コード" = $1 LIMIT 1`, [n(r.商品コード)])).rows[0]?.v);
    if (r.賞味期限 != null) {
      r.賞味期限通知 = 期限通知(r.賞味期限);
      if (残日数設定) {
        const 残 = Math.round((Date.parse(r.賞味期限) - Date.parse(今日)) / 86400000) - 残日数設定;
        if (残 <= 120) {
          r.User賞味通知区分 = 残 >= 61 ? 3 : 残 >= 31 ? 2 : 残 >= 1 ? 1 : 0;
          if (残 <= 90) r.通知 = `ﾕｰｻﾞｰ賞味   ${残}日`;
        } else r.User賞味通知区分 = 99;
      }
    }
    if (n(r.入庫後名義ID) === 0) r.入庫後名義ID = 629;
  }
  const 順 = (x: unknown) => (x == null ? "" : String(x));
  return [...行.values()].sort(
    (x, y) =>
      Number(x.架空実物) - Number(y.架空実物) || 順(x.賞味期限).localeCompare(順(y.賞味期限)) || 順(x.タグ).localeCompare(順(y.タグ)) ||
      順(x.入庫日).localeCompare(順(y.入庫日)) || 順(x.製造日).localeCompare(順(y.製造日)) || 順(x.入庫No).localeCompare(順(y.入庫No)) || n(x.入庫元数) - n(y.入庫元数),
  );
}

/**
 * 出荷チェック（Access の C_出荷チェック）。まだ登録していない出庫を在庫（在庫ケースが 0 でないロット）と比べ、
 * 商品コード・商品名・倉庫・製造日・賞味期限が違えば 計画変更chk と 変更通知（最後に見つかった違い）。
 * ケース ＞ 入庫元数 − そのロットの全部の出庫（登録済みも、自分も含む）なら 通知「在庫不足」、ほかは「確認OK!」。
 * Access は書き損じで毎回 出荷日＝便の出荷計画日 にする。Web 版も同じにするが、便がない（出荷計画日が空の）ときは出荷日を消さない。
 */
async function 出荷チェック(c: PoolClient, 出庫ID?: number) {
  const rows = (
    await c.query(
      `SELECT s.*, p."出荷計画日"::date::text AS "計画日" FROM ${倉庫の出荷} s LEFT JOIN ${倉庫の便} p ON p."輸送ID" = s."輸送ID"
       WHERE s."chk" = false ${出庫ID ? `AND s."出庫ID" = $1` : ""}`,
      出庫ID ? [出庫ID] : [],
    )
  ).rows as Rec[];
  const 違う = (a: unknown, b: unknown) => a != null && b != null && String(a).slice(0, 19) !== String(b).slice(0, 19);
  for (const r of rows) {
    const z = (await c.query(`SELECT * FROM ${倉庫の在庫} WHERE "在庫ID" = $1 AND "在庫ケース" <> 0 LIMIT 1`, [n(r.在庫ID)])).rows[0];
    if (!z) continue;
    const v: Rec = {};
    if (r.計画日) v.出荷日 = r.計画日;
    if (違う(z.商品コード, r.商品コード)) Object.assign(v, { 計画変更chk: true, 変更通知: "商品コード 相違" });
    if (違う(z.商品名, r.商品名)) Object.assign(v, { 計画変更chk: true, 変更通知: "商品名 相違" });
    if (違う(z.倉庫ID, r.倉庫ID)) Object.assign(v, { 計画変更chk: true, 変更通知: "倉庫名 相違" });
    const 出庫計 = n((await c.query(`SELECT SUM("ケース") AS v FROM ${倉庫の出荷} WHERE "在庫ID" = $1`, [n(r.在庫ID)])).rows[0].v);
    v.通知 = n(r.ケース) > n(z.入庫元数) - 出庫計 ? "在庫不足" : "確認OK!";
    if (違う(z.製造日, r.製造日)) Object.assign(v, { 計画変更chk: true, 変更通知: "製造日 相違" });
    if (違う(z.賞味期限, r.賞味期限)) Object.assign(v, { 計画変更chk: true, 変更通知: "賞味期限 相違" });
    await 直す(c, 倉庫の出荷, "出庫ID", r.出庫ID, v);
  }
}

const 便の列 = `p.*, p."出荷計画日"::date::text AS "出荷計画日", p."集荷日"::date::text AS "集荷日", p."引取日"::date::text AS "引取日"`;
const 明細の列 = `s.*, s."出荷日"::date::text AS "出荷日", s."納品日"::date::text AS "納品日", s."製造日"::date::text AS "製造日", s."賞味期限"::date::text AS "賞味期限",
  s."入庫日"::date::text AS "入庫日", s."売り日"::date::text AS "売り日"`;

export function sokoShukkoRoutes(app: FastifyInstance) {
  app.addHook("preHandler", requireUser);

  app.get("/api/soko/shukko/choices", async () => {
    const out: Record<string, { id: number; name: string }[]> = {};
    for (const [k, [表, id, name]] of Object.entries(選択肢の表))
      out[k] = await q(`SELECT "${id}" AS id, "${name}" AS name FROM ${表} WHERE "${id}" IS NOT NULL ORDER BY "${id}"`).catch(() => []);
    // 出庫場所：在庫のある冷蔵庫（Access の FS_配車選択 の 出庫場所ID の一覧）
    out.出庫場所 = await q(
      `SELECT "倉庫ID" AS id, MIN("倉庫名") AS name FROM ${t("soko", "TD_在庫")} WHERE "在庫ケース" <> 0 AND COALESCE("倉庫名", '') <> '0' GROUP BY "倉庫ID" ORDER BY "倉庫ID"`,
    );
    return out;
  });

  // その日の便（FS_配車選択：出庫場所・出庫No・運送会社の順）と、明細の数
  app.get<{ Querystring: { date: string } }>("/api/soko/shukko/day", async (req, reply) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(req.query.date ?? "")) return reply.code(400).send({ error: "日付が正しくありません" });
    return q(
      `SELECT ${便の列}, (SELECT COUNT(*) FROM ${倉庫の出荷} s WHERE s."輸送ID" = p."輸送ID" AND s."出荷日" = p."出荷計画日")::int AS "明細数",
              (SELECT COALESCE(SUM(s."ケース"), 0) FROM ${倉庫の出荷} s WHERE s."輸送ID" = p."輸送ID" AND s."出荷日" = p."出荷計画日")::float AS "ケース計"
       FROM ${倉庫の便} p WHERE p."出荷計画日" = $1::date ORDER BY p."出庫場所ID", p."出庫No", p."運送会社ID", p."輸送ID"`,
      [req.query.date],
    );
  });
  app.get("/api/soko/shukko/ends", async () => (await q(`SELECT MIN("出荷計画日")::date::text AS "最初", MAX("出荷計画日")::date::text AS "最後" FROM ${倉庫の便}`))[0]);

  // 便と明細（FM_出荷明細票・FS_出荷明細：輸送ID と 出荷日＝出荷計画日 でつなぐ。積込順・賞味期限・タグの順）
  app.get<{ Params: { id: string } }>("/api/soko/shukko/bin/:id", async (req, reply) => {
    const p = (await q(`SELECT ${便の列} FROM ${倉庫の便} p WHERE p."輸送ID" = $1`, [n(req.params.id)]))[0];
    if (!p) return reply.code(404).send({ error: "この便はありません" });
    const rows = await q(
      `SELECT ${明細の列}, m."旧会社コード区分" FROM ${倉庫の出荷} s LEFT JOIN ${商品マスタ} m ON m."商品コード" = s."商品コード"
       WHERE s."輸送ID" = $1 AND s."出荷日" = $2::date ORDER BY s."商品積込順" NULLS FIRST, s."賞味期限" NULLS FIRST, s."タグ" NULLS FIRST, s."出庫ID"`,
      [p.輸送ID, p.出荷計画日],
    );
    const 通知 = n((await q(`SELECT COUNT(*) AS v FROM ${倉庫の出荷} WHERE "計画変更chk" = true`))[0].v);
    return { 便: p, rows, 通知 };
  });

  // 新しい便（FS_配車選択の［追加］で出庫場所を選んだとき）：出庫No＝その日・その出庫場所の最大＋1、冷凍区分 2・輸送区分 1・セット温度 −25
  app.post<{ Body: { date: string; 出庫場所ID: number } }>("/api/soko/shukko/bin/new", async (req, reply) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(req.body.date ?? "")) return reply.code(400).send({ error: "日付が正しくありません" });
    const 場所 = n(req.body.出庫場所ID);
    if (!場所) return reply.code(400).send({ error: "出庫場所を選んでください" });
    return 一連で(async (c) => {
      await c.query(`SELECT pg_advisory_xact_lock(hashtext('soko.TD_輸送計画.輸送ID'))`);
      const id = n((await c.query(`SELECT COALESCE(MAX("輸送ID"), 0) + 1 AS v FROM ${倉庫の便}`)).rows[0].v);
      const 出庫No = n((await c.query(`SELECT MAX("出庫No") AS v FROM ${倉庫の便} WHERE "出庫場所ID" = $1 AND "出荷計画日" = $2::date`, [場所, req.body.date])).rows[0].v) + 1;
      const 名前 = (await c.query(`SELECT MIN("倉庫名") AS v FROM ${t("soko", "TD_在庫")} WHERE "倉庫ID" = $1`, [場所])).rows[0].v ?? (await 短縮名(c, 場所));
      await 行を入れる(c, 倉庫の便, {
        ...(await 既定値(c, "TD_輸送計画", "輸送ID")),
        輸送ID: id, 出荷計画日: req.body.date, 出庫場所ID: 場所, 出庫場所: 名前, 出庫No, 冷凍区分ID: 2, 輸送区分ID: 1, セット温度: -25,
      });
      return { 輸送ID: id };
    });
  });

  // 便の項目を直す（各項目の AfterUpdate と同じ）
  app.post<{ Body: { 輸送ID: number; 項目: string; 値: unknown } }>("/api/soko/shukko/bin/save", async (req, reply) => {
    const { 項目 } = req.body;
    if (!便の項目.has(項目)) return reply.code(400).send({ error: "この項目は直せません" });
    return 一連で(async (c) => {
      const p = (await c.query(`SELECT * FROM ${倉庫の便} WHERE "輸送ID" = $1 FOR UPDATE`, [n(req.body.輸送ID)])).rows[0];
      if (!p) return reply.code(404).send({ error: "この便はありません" });
      const 値 = req.body.値 === "" ? null : req.body.値;
      const v: Rec = { [項目]: 値 };
      const 運送会社を決める = async (code: unknown) => {
        // cmb_輸送_AfterUpdate：区分の初期値。配達区分・車両区分はその運送会社の最初の便から、運賃計算区分は過去（2022/04/01〜おととい）の同じ組み合わせから
        const 前 = (await c.query(`SELECT "配達区分ID", "車両区分ID" FROM ${倉庫の便} WHERE "運送会社ID" = $1 ORDER BY "輸送ID" LIMIT 1`, [n(code)])).rows[0];
        const 手配 = 項目 === "手配運送会社コード" ? n(値) : n(p.手配運送会社コード);
        const 運賃計算 = (
          await c.query(
            `SELECT MAX("運賃計算区分") AS v FROM ${倉庫の便} WHERE "出荷計画日" BETWEEN '2022-04-01' AND $1::date AND COALESCE("手配運送会社コード", 0) = $2 AND COALESCE("帳合運送会社コード", 0) = $3 AND "運送会社ID" = $4`,
            [new Date(Date.parse(日本の今().日付) - 2 * 86400000).toISOString().slice(0, 10), 手配, n(p.帳合運送会社コード), n(code)],
          )
        ).rows[0].v;
        Object.assign(v, {
          運送会社ID: code, 運送会社名: await 運送会社名(c, code), 運賃区分ID: 1, 冷凍区分ID: 2, 輸送区分ID: 1, 配達区分ID: 前?.配達区分ID ?? null,
          車両区分ID: 前?.車両区分ID ?? null, セット温度: -25, 運賃計算区分: n(運賃計算), 集荷日: 日付(p.出荷計画日),
        });
      };
      if (項目 === "運送会社ID") await 運送会社を決める(値);
      if (項目 === "手配運送会社コード") {
        v.手配運送会社名 = await 運送会社名(c, 値);
        await 運送会社を決める(値);
      }
      if (項目 === "帳合運送会社コード") v.帳合運送会社名 = await 運送会社名(c, 値);
      if (項目 === "出庫場所ID") v.出庫場所 = await 短縮名(c, 値);
      // C_コード表示：出荷計画日を画面の日付にして保存する
      await 直す(c, 倉庫の便, "輸送ID", p.輸送ID, v);
      return { ok: true };
    });
  });

  // 便を消す（Access の［削除］。合言葉が要る。明細を消し、受注の残ケースを戻す）。
  // Access は登録済みの便でも「削除できません」と出したあと消してしまう（在庫と合わなくなる）ので、Web 版は登録済みなら消さない
  app.post<{ Body: { 輸送ID: number; 合言葉: string } }>("/api/soko/shukko/bin/delete", async (req, reply) => {
    const pass = process.env.JUCHU_DELETE_PASSWORD;
    if (!pass) return reply.code(400).send({ error: "削除の合言葉がサーバーに設定されていないため、削除できません。" });
    return 一連で(async (c) => {
      const p = (await c.query(`SELECT * FROM ${倉庫の便} WHERE "輸送ID" = $1 FOR UPDATE`, [n(req.body.輸送ID)])).rows[0];
      if (!p) return reply.code(404).send({ error: "この便はありません" });
      if (p.chk === true) return reply.code(400).send({ error: "登録完了の為、削除できません。" });
      if (req.body.合言葉 !== pass) return reply.code(403).send({ error: "パスワードが違います。" });
      const rows = (await c.query(`SELECT * FROM ${倉庫の出荷} WHERE "輸送ID" = $1`, [p.輸送ID])).rows as Rec[];
      if (rows.some((r) => r.chk === true)) return reply.code(400).send({ error: "登録済みの明細があるため、削除できません。" });
      for (const r of rows) {
        await c.query(`UPDATE ${倉庫の受注} SET "残ケース" = "残ケース" + $2, "手配DataChk" = true WHERE "受注ID" = $1`, [n(r.受注ID), n(r.ケース)]);
        await c.query(`DELETE FROM ${倉庫の出荷} WHERE "出庫ID" = $1`, [r.出庫ID]);
      }
      await c.query(`DELETE FROM ${倉庫の便} WHERE "輸送ID" = $1`, [p.輸送ID]);
      return { ok: true };
    });
  });

  // ［完了］（この便だけ在庫に登録する。Access の CC_ZaikoSum(出荷日, 3, 輸送ID)）
  app.post<{ Body: { 輸送ID: number } }>("/api/soko/shukko/bin/kanryo", async (req, reply) =>
    一連で(async (c) => {
      const p = (await c.query(`SELECT "輸送ID", "出荷計画日"::date::text AS d, "chk" FROM ${倉庫の便} WHERE "輸送ID" = $1`, [n(req.body.輸送ID)])).rows[0];
      if (!p) return reply.code(404).send({ error: "この便はありません" });
      const 未 = n((await c.query(`SELECT COUNT(*) AS v FROM ${倉庫の出荷} WHERE "輸送ID" = $1 AND "chk" = false`, [p.輸送ID])).rows[0].v);
      if (p.chk === true && 未 === 0) return reply.code(400).send({ error: "登録完了済みです。" });
      return { 件数: await 締める(c, p.d, p.輸送ID) };
    }),
  );

  // 新しい明細（この便・この出荷日）
  app.post<{ Body: { 輸送ID: number } }>("/api/soko/shukko/meisai/new", async (req, reply) =>
    一連で(async (c) => {
      const p = (await c.query(`SELECT * FROM ${倉庫の便} WHERE "輸送ID" = $1`, [n(req.body.輸送ID)])).rows[0];
      if (!p) return reply.code(404).send({ error: "運送会社が指定されていません。入力してください。" });
      await c.query(`SELECT pg_advisory_xact_lock(hashtext('soko.TD_出荷.出庫ID'))`);
      const id = n((await c.query(`SELECT COALESCE(MAX("出庫ID"), 0) + 1 AS v FROM ${倉庫の出荷}`)).rows[0].v);
      await 行を入れる(c, 倉庫の出荷, { ...(await 既定値(c, "TD_出荷", "出庫ID")), 出庫ID: id, 輸送ID: p.輸送ID, 出荷日: 日付(p.出荷計画日), 登録時間: 日本の今().日時, 入力日付: 日本の今().日付 });
      return { 出庫ID: id };
    }),
  );

  // 明細の項目を直す（FS_出荷明細 の各項目の AfterUpdate と同じ）。登録済み（chk）の行は直せない
  app.post<{ Body: { 出庫ID: number; 項目: string; 値: unknown } }>("/api/soko/shukko/meisai/save", async (req, reply) => {
    const { 項目 } = req.body;
    if (!明細の項目.has(項目)) return reply.code(400).send({ error: "この項目は直せません" });
    return 一連で(async (c) => {
      const r = (await c.query(`SELECT * FROM ${倉庫の出荷} WHERE "出庫ID" = $1 FOR UPDATE`, [n(req.body.出庫ID)])).rows[0];
      if (!r) return reply.code(404).send({ error: "この明細はありません" });
      if (r.chk === true && !["出庫確認", "出庫済み"].includes(項目))
        return reply.code(400).send({ error: "登録済みのデータを訂正する場合、訂正ボタンをクリックしてください。" });
      const p = (await c.query(`SELECT * FROM ${倉庫の便} WHERE "輸送ID" = $1`, [n(r.輸送ID)])).rows[0];
      if (!p) return reply.code(400).send({ error: "運送会社が指定されていません。入力してください。" });
      let 値: any = req.body.値 === "" ? null : req.body.値;
      if (["倉庫ID", "商品コード", "届け先コード", "ケース", "入庫前名義ID", "入庫後名義ID", "請求先コード", "取引元ID", "取引帳合ID", "手配元ID", "手配帳合ID", "商品積込順"].includes(項目) && 値 !== null)
        値 = Math.trunc(Number(値));
      const v: Rec = { [項目]: 値 };
      if (名前の組[項目]) v[名前の組[項目]] = await 短縮名(c, 値);
      const 新 = { ...r, ...v };
      const コード表示 = async () => {
        // CC_コード表示：出荷日を画面の日付（便の出荷計画日）にし、登録時間、備考に届け先の受付時間と商品の特記事項を足す
        v.出荷日 = 日付(p.出荷計画日);
        v.登録時間 = 日本の今().日時;
        let 備考 = await 特別項目(c, 1, String(新.備考 ?? ""), 新.届け先コード);
        備考 = await 特別項目(c, 0, 備考, 新.商品コード);
        v.備考 = 備考;
        新.備考 = 備考;
      };
      if (["製造日", "賞味期限", "納品日"].includes(項目)) await コード表示();
      if (項目 === "倉庫ID") {
        await コード表示();
        const 集荷日 = 日付(p.集荷日);
        v.社内連絡 = `${集荷日 ? ` ${集荷日.slice(5, 7)}/${集荷日.slice(8, 10)}` : ""}${v.倉庫名 ?? ""} 引取り`;
      }
      if (項目 === "商品コード") {
        // CC_コード表示 のあと、商品コードを保存してから在庫を選ぶ（画面が /api/soko/zaiko/… を呼ぶ）
        await コード表示();
      }
      if (項目 === "届け先コード") {
        await コード表示();
        // Access は CC_コード表示 のあとに、もう一度 受付時間 を備考の頭に付ける
        const 受付 = (await c.query(`SELECT "受付時間" FROM ${得意先マスタ} WHERE "短縮コード" = $1 LIMIT 1`, [n(値)])).rows[0]?.受付時間 ?? "";
        v.備考 = `${受付 ?? ""}${v.備考 ?? ""}`;
      }
      if (項目 === "ケース") {
        // Access：入数があるときだけ商品マスタの入数を入れ直す（書き損じ）。商品kg＝入数×ケース
        let 入数 = r.入数;
        if (n(入数)) 入数 = (await c.query(`SELECT "入数" FROM ${商品マスタ} WHERE "商品コード" = $1 LIMIT 1`, [n(r.商品コード)])).rows[0]?.入数 ?? null;
        v.入数 = 入数;
        v.商品kg = 入数 == null || 値 == null ? null : Number(入数) * Number(値);
      }
      await 直す(c, 倉庫の出荷, "出庫ID", r.出庫ID, v);
      if (項目 === "届け先コード") await 運賃振分け(c, r.出庫ID, true);
      if (項目 === "ケース") {
        if (n(r.受注ID)) await 残ケース処理(c, n(r.受注ID));
        await コード表示();
        await 直す(c, 倉庫の出荷, "出庫ID", r.出庫ID, { 出荷日: v.出荷日, 登録時間: v.登録時間, 備考: v.備考 });
        await 出荷チェック(c, r.出庫ID);
      }
      return { ok: true };
    });
  });

  // ---------------- 在庫選択（明細の商品コードを入れたとき：CC_在庫商品日付参照 → FSD_在庫読込選択 → FSD_架空在庫選択 → 在庫データ読込） ----------------
  // その冷蔵庫にこの商品の在庫の行があるか（Access は在庫kg のある行を数える。在庫 0 の行も数える）
  app.get<{ Querystring: { shohin: string; soko: string } }>("/api/soko/zaiko/aru", async (req) => {
    const r = (
      await q(
        `SELECT (SELECT COUNT("在庫kg") FROM ${倉庫の在庫} WHERE "商品コード" = $1 AND "倉庫ID" = $2)::int AS n, (SELECT "商品名" FROM ${商品マスタ} WHERE "商品コード" = $1 LIMIT 1) AS "商品名"`,
        [n(req.query.shohin), n(req.query.soko)],
      )
    )[0];
    return { ある: n(r.n) > 0, 商品名: r.商品名 ?? null };
  });
  // 選べる在庫（その冷蔵庫の分）
  app.get<{ Querystring: { shohin: string; soko: string } }>("/api/soko/zaiko/list", async (req) =>
    一連で(async (c) => (await 倉庫の在庫見込み(c, n(req.query.shohin), n(req.query.soko))).filter((r) => n(r.倉庫ID) === n(req.query.soko))),
  );
  // 選んだ在庫を明細に読み込む（在庫データ読込）。認識ID がなければ（在庫がない・強制）マスタの名前・規格・入数を入れ、ロットの項目を空にする
  app.post<{ Body: { 出庫ID: number; 商品コード: number; 認識ID?: string | null } }>("/api/soko/zaiko/set", async (req, reply) =>
    一連で(async (c) => {
      const cur = (await c.query(`SELECT * FROM ${倉庫の出荷} WHERE "出庫ID" = $1 FOR UPDATE`, [n(req.body.出庫ID)])).rows[0];
      if (!cur) return reply.code(404).send({ error: "この明細はありません" });
      if (cur.chk === true) return reply.code(400).send({ error: "登録済みのデータを訂正する場合、訂正ボタンをクリックしてください。" });
      const 商品コード = n(cur.商品コード);
      let v: Rec;
      if (!req.body.認識ID) {
        const m = (await c.query(`SELECT "商品名", "規格", "入数" FROM ${商品マスタ} WHERE "商品コード" = $1 LIMIT 1`, [商品コード])).rows[0];
        v = { 商品名: m?.商品名 ?? null, 規格: m?.規格 ?? null, 入数: m?.入数 ?? null, 在庫ID: 0, 認識ID: "0", 入庫日: null, 製造日: null, 賞味期限: null, 通知: "", 入庫ID: 0, 計画変更chk: false };
      } else {
        const z = (await 倉庫の在庫見込み(c, 商品コード, n(cur.倉庫ID))).find((r) => r.認識ID === String(req.body.認識ID));
        if (!z) return reply.code(400).send({ error: "選んだ在庫が見つかりません。もう一度選んでください。" });
        v = {
          認識ID: z.認識ID, 在庫ID: z.架空実物 ? 0 : n(z.認識ID), 通知: z.架空実物 ? "架空" : "確認OK!", 商品名: z.商品名, 入庫No: z.入庫No, 入庫日: z.入庫日, 製造日: z.製造日,
          賞味期限: z.賞味期限, 規格: z.規格, 入数: z.入数, 入庫ID: z.入庫ID, 社内連絡: `${z.管理備考 ?? ""}\r\n${cur.社内連絡 ?? ""}`, タグ: z.タグ, 産地コード: z.産地コード,
          製造工場ID: z.製造工場ID, 製造工場名: z.製造工場名, 入庫前名義ID: [105, 137, 191].includes(n(cur.倉庫ID)) ? 629 : z.入庫後名義ID, 計画変更chk: false,
        };
      }
      await 直す(c, 倉庫の出荷, "出庫ID", cur.出庫ID, v);
      return { ok: true };
    }),
  );

  // ---------------- 在庫不足（cmd_受注選択：全部の未登録の出庫で出荷チェックをして、在庫不足を一覧にする。FSD_在庫不足表示） ----------------
  app.post("/api/soko/shukko/fusoku", async () =>
    一連で(async (c) => {
      await 出荷チェック(c);
      return (
        await c.query(
          `SELECT s."出庫ID", s."輸送ID", s."出荷日"::date::text AS "出荷日", p."出荷計画日"::date::text AS "出荷計画日", s."倉庫名", s."商品コード", s."商品名", s."ケース",
                  s."届け先", s."製造日"::date::text AS "製造日", s."賞味期限"::date::text AS "賞味期限", s."在庫ID",
                  (SELECT "入庫元数" FROM ${倉庫の在庫} z WHERE z."在庫ID" = s."在庫ID" LIMIT 1)
                    - (SELECT SUM(x."ケース") FROM ${倉庫の出荷} x LEFT JOIN ${倉庫の便} y ON y."輸送ID" = x."輸送ID"
                       WHERE x."在庫ID" = s."在庫ID" AND (x."出荷日", x."輸送ID", x."出庫ID") <= (s."出荷日", s."輸送ID", s."出庫ID")) AS "残数"
           FROM ${倉庫の出荷} s LEFT JOIN ${倉庫の便} p ON p."輸送ID" = s."輸送ID"
           WHERE s."通知" = '在庫不足' AND s."chk" = false ORDER BY p."出荷計画日", s."商品コード", s."出庫ID"`,
        )
      ).rows;
    }),
  );

  // ---------------- ロット逆転の確認（出庫確認の印を付けたとき：C_届け先賞味期限ロット逆転防止） ----------------
  // 比べる材料：届け先・グループ商品コードが同じ出庫のうち、納品日がこの行より前の最も新しい賞味期限（前回）と、後の最も新しい賞味期限（次回以降）
  app.get<{ Params: { id: string } }>("/api/soko/shukko/lot/:id", async (req, reply) => {
    const r = (
      await q(
        `SELECT s."出庫ID", s."届け先コード", s."届け先", s."商品コード", s."商品名", s."賞味期限"::date::text AS "賞味期限", s."納品日"::date::text AS "納品日",
                COALESCE(m."グループ商品コード", 0) AS "G"
         FROM ${倉庫の出荷} s LEFT JOIN ${商品マスタ} m ON m."商品コード" = s."商品コード" WHERE s."出庫ID" = $1`,
        [n(req.params.id)],
      )
    )[0];
    if (!r) return reply.code(404).send({ error: "この明細はありません" });
    const 範囲 = async (op: "<" | ">") =>
      r.納品日
        ? (
            await q(
              `SELECT MAX(s."賞味期限")::date::text AS v FROM ${倉庫の出荷} s LEFT JOIN ${商品マスタ} m ON m."商品コード" = s."商品コード"
               WHERE s."届け先コード" = $1 AND m."グループ商品コード" = $2 AND s."納品日" ${op} $3::date`,
              [n(r.届け先コード), n(r.G), r.納品日],
            )
          )[0].v
        : null;
    return { ...r, 特別: n(r.届け先コード) === 3194 && n(r.商品コード) === 285, 前回: await 範囲("<"), 次回: await 範囲(">") };
  });
  // 確認の結果を書く。理由を入れたら社内連絡に、先の納品の逆転を知らせるならその行に印、最後に この行の 計画変更chk・変更通知
  app.post<{ Body: { 出庫ID: number; 逆転: boolean; 理由?: string; 先に印?: boolean } }>("/api/soko/shukko/lot/result", async (req, reply) =>
    一連で(async (c) => {
      const r = (
        await c.query(
          `SELECT s.*, s."賞味期限"::date::text AS k, s."納品日"::date::text AS d, COALESCE(m."グループ商品コード", 0) AS g
           FROM ${倉庫の出荷} s LEFT JOIN ${商品マスタ} m ON m."商品コード" = s."商品コード" WHERE s."出庫ID" = $1 FOR UPDATE OF s`,
          [n(req.body.出庫ID)],
        )
      ).rows[0];
      if (!r) return reply.code(404).send({ error: "この明細はありません" });
      if (req.body.理由) await 直す(c, 倉庫の出荷, "出庫ID", r.出庫ID, { 社内連絡: req.body.理由 });
      if (req.body.先に印 && r.k && r.d)
        await c.query(
          `UPDATE ${倉庫の出荷} s SET "変更通知" = 'ロット逆転!', "計画変更chk" = true FROM ${商品マスタ} m
           WHERE m."商品コード" = s."商品コード" AND m."グループ商品コード" = $1 AND s."賞味期限" < $2::date AND s."届け先コード" = $3 AND s."納品日" > $4::date`,
          [n(r.g), r.k, n(r.届け先コード), r.d],
        );
      await 直す(c, 倉庫の出荷, "出庫ID", r.出庫ID, req.body.逆転 ? { 計画変更chk: true, 変更通知: "ロット逆転" } : { 計画変更chk: false, 変更通知: "" });
      return { ok: true };
    }),
  );
  // 前回出荷ロット履歴（FSD_前回出荷ロット履歴：この 1 年の出荷のうち、届け先・グループ商品コードが同じで、納品日が指定の日より前のもの）
  app.get<{ Querystring: { 出庫ID: string; 前: string } }>("/api/soko/shukko/lot-history", async (req) => {
    const r = (
      await q(
        `SELECT s."届け先コード", COALESCE(m."グループ商品コード", 0) AS g FROM ${倉庫の出荷} s LEFT JOIN ${商品マスタ} m ON m."商品コード" = s."商品コード" WHERE s."出庫ID" = $1`,
        [n(req.query.出庫ID)],
      )
    )[0];
    if (!r || !/^\d{4}-\d{2}-\d{2}$/.test(req.query.前 ?? "")) return [];
    return q(
      `SELECT s."出荷日"::date::text AS "出荷日", s."輸送ID", s."出庫ID", p."運送会社名", s."商品コード", s."商品名", s."製造日"::date::text AS "製造日", s."届け先コード", s."届け先",
              s."変更通知", s."納品日"::date::text AS "納品日", s."賞味期限"::date::text AS "賞味期限"
       FROM ${倉庫の出荷} s LEFT JOIN ${倉庫の便} p ON p."輸送ID" = s."輸送ID" LEFT JOIN ${商品マスタ} m ON m."商品コード" = s."商品コード"
       WHERE s."出荷日" > $1::date AND m."グループ商品コード" = $2 AND s."届け先コード" = $3 AND s."納品日" < $4::date
       ORDER BY s."出荷日", s."納品日", s."賞味期限"`,
      [new Date(Date.parse(日本の今().日付) - 365 * 86400000).toISOString().slice(0, 10), n(r.g), n(r.届け先コード), req.query.前],
    );
  });

  // ---------------- 希望在庫表示・希望倉庫表示（［検索］［倉庫表示］：C_架空製造日別出荷データ表示Ver2） ----------------
  // 検索＝その冷蔵庫の在庫の見込み（賞味期限の順）。倉庫表示＝商品の全部の冷蔵庫の見込みから、地区コード 1 の冷蔵庫と、コードが 1 で始まる冷蔵庫を除いたもの（製造日の順。Access と同じ）
  app.get<{ Querystring: { shohin?: string; soko?: string; mode?: string } }>("/api/soko/kibou", async (req) =>
    一連で(async (c) => {
      let rows = await 倉庫の在庫見込み(c, n(req.query.shohin), n(req.query.soko));
      const 名 = new Map(
        (await c.query(`SELECT "短縮コード", "短縮名", "地区コード" FROM ${得意先マスタ} WHERE "短縮コード" = ANY($1::int[])`, [[...new Set(rows.flatMap((r) => [n(r.入庫後名義ID), n(r.倉庫ID)]))]])).rows.map((r: Rec) => [n(r.短縮コード), r]),
      );
      rows = rows.map((r) => ({ ...r, 入庫名義: 名.get(n(r.入庫後名義ID))?.短縮名 ?? null }));
      const 順 = (x: unknown) => (x == null ? "" : String(x));
      if (req.query.mode === "soko") {
        rows = rows.filter((r) => n(名.get(n(r.倉庫ID))?.地区コード) !== 1 && !String(n(r.倉庫ID)).startsWith("1"));
        rows.sort((x, y) => 順(x.製造日).localeCompare(順(y.製造日)) || 順(x.賞味期限).localeCompare(順(y.賞味期限)) || 順(x.タグ).localeCompare(順(y.タグ)) || 順(x.入庫日).localeCompare(順(y.入庫日)) || 順(x.入庫No).localeCompare(順(y.入庫No)) || n(x.商品コード) - n(y.商品コード));
      } else {
        rows.sort((x, y) => 順(x.賞味期限).localeCompare(順(y.賞味期限)) || 順(x.タグ).localeCompare(順(y.タグ)) || 順(x.入庫日).localeCompare(順(y.入庫日)) || 順(x.製造日).localeCompare(順(y.製造日)) || 順(x.入庫No).localeCompare(順(y.入庫No)) || n(x.商品コード) - n(y.商品コード));
      }
      return rows;
    }),
  );
  // 出荷止めを付ける・外す（一覧の 出荷止め区分・管理備考 を直したとき。在庫の行に書く）
  app.post<{ Body: { 在庫ID: number; 出荷止め区分: boolean; 管理備考: string | null } }>("/api/soko/kibou/tome", async (req) => {
    await q(`UPDATE ${倉庫の在庫} SET "出荷止め区分" = $2, "管理備考" = $3 WHERE "在庫ID" = $1`, [n(req.body.在庫ID), req.body.出荷止め区分 === true, req.body.管理備考 ?? null]);
    return { ok: true };
  });
  // 選んだ在庫を、この便の明細にする（ケースは在庫ケースそのまま。届け先は空）
  app.post<{ Body: { 輸送ID: number; shohin?: number; soko?: number; mode?: string; 選んだ: string[] } }>("/api/soko/kibou/add", async (req, reply) =>
    一連で(async (c) => {
      const p = (await c.query(`SELECT * FROM ${倉庫の便} WHERE "輸送ID" = $1`, [n(req.body.輸送ID)])).rows[0];
      if (!p) return reply.code(404).send({ error: "この便はありません" });
      const 全部 = await 倉庫の在庫見込み(c, n(req.body.shohin), n(req.body.soko));
      const 集荷日 = 日付(p.集荷日);
      let 件数 = 0;
      for (const id of req.body.選んだ ?? []) {
        const z = 全部.find((r) => r.認識ID === String(id));
        if (!z) continue;
        if (z.出荷止め区分) return reply.code(400).send({ error: "出荷止めが設定されている為、抽出できません。" });
        let 手配元ID = n(z.倉庫ID);
        let 手配帳合ID = n(z.倉庫ID);
        let 入庫前名義ID = z.入庫後名義ID;
        if ([105, 137, 191].includes(n(z.倉庫ID))) 入庫前名義ID = 629;
        if (n(z.倉庫ID) === 191) {
          手配元ID = 150;
          手配帳合ID = 173;
          if (n((await c.query(`SELECT "分類ID" FROM ${商品マスタ} WHERE "商品コード" = $1 LIMIT 1`, [n(z.商品コード)])).rows[0]?.分類ID) > 3) 手配帳合ID = 174;
        }
        const 引取り = `${集荷日 ? ` ${集荷日.slice(5, 7)}/${集荷日.slice(8, 10)}` : ""}${z.倉庫名 ?? ""} 引取り`;
        await c.query(`SELECT pg_advisory_xact_lock(hashtext('soko.TD_出荷.出庫ID'))`);
        const 出庫ID = n((await c.query(`SELECT COALESCE(MAX("出庫ID"), 0) + 1 AS v FROM ${倉庫の出荷}`)).rows[0].v);
        await 行を入れる(c, 倉庫の出荷, {
          ...(await 既定値(c, "TD_出荷", "出庫ID")),
          出庫ID, 輸送ID: p.輸送ID, 出荷日: 日付(p.出荷計画日), 商品コード: z.商品コード, 商品名: z.商品名, 規格: z.規格, 入数: z.入数, ケース: z.在庫ケース, 商品kg: z.在庫kg,
          製造日: z.製造日, 入庫前名義ID, 入庫No: z.入庫No, 賞味期限: z.賞味期限 ?? (await 賞味期限計算(c, z.製造日, z.商品コード)), 入庫ID: z.入庫ID, 倉庫ID: z.倉庫ID, 倉庫名: z.倉庫名,
          届け先コード: null, 届け先: null, 十二地区: null, 手配元ID, 手配帳合ID, 手配元: await 短縮名(c, 手配元ID), 手配帳合: await 短縮名(c, 手配帳合ID), タグ: z.タグ,
          産地コード: z.産地コード, 製造工場ID: z.製造工場ID, 製造工場名: z.製造工場名, 認識ID: z.認識ID, 入庫日: z.入庫日, 在庫ID: z.架空実物 ? 0 : n(z.認識ID),
          商品区分: z.商品区分, 商品状態隠語: z.商品状態隠語, 社内連絡: z.管理備考 ? `${z.管理備考}\r\n${引取り}` : 引取り, 通知: z.架空実物 ? "架空" : "確認OK!",
          登録時間: 日本の今().日時, 入力日付: 日本の今().日付,
        });
        件数++;
      }
      return { 件数 };
    }),
  );

  // 明細を消す（Form_Delete）。登録済みは消せない。受注があれば残ケースを出し直す
  app.post<{ Body: { 出庫ID: number } }>("/api/soko/shukko/meisai/delete", async (req, reply) =>
    一連で(async (c) => {
      const r = (await c.query(`SELECT * FROM ${倉庫の出荷} WHERE "出庫ID" = $1 FOR UPDATE`, [n(req.body.出庫ID)])).rows[0];
      if (!r) return reply.code(404).send({ error: "この明細はありません" });
      if (r.chk === true) return reply.code(400).send({ error: "更新済みのﾚｺｰﾄﾞは在庫に影響する為、削除出来ません！\n(変更は可能ですが在庫には反映されません)" });
      if (n(r.受注ID)) await 残ケース処理(c, n(r.受注ID), n(r.ケース));
      await c.query(`DELETE FROM ${倉庫の出荷} WHERE "出庫ID" = $1`, [r.出庫ID]);
      return { ok: true };
    }),
  );
}
