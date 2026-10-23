import type { FastifyInstance } from "fastify";
import type { PoolClient } from "pg";
import { q, t, 日本の今 } from "./db.js";
import { requireUser } from "./auth.js";
import { 一連で, 特別項目 } from "./ws.js";
import { 倉庫の便, 倉庫の出荷, 倉庫の名変, 締める } from "./soko.js";

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
        await コード表示();
        // 在庫から選ばないときと同じ（在庫の選択は［在庫選択］で）：商品名・規格・入数を入れ、ロットの項目を空にする
        const m = (await c.query(`SELECT "商品名", "規格", "入数" FROM ${商品マスタ} WHERE "商品コード" = $1 LIMIT 1`, [n(値)])).rows[0];
        Object.assign(v, { 商品名: m?.商品名 ?? null, 規格: m?.規格 ?? null, 入数: m?.入数 ?? null, 在庫ID: 0, 認識ID: "0", 入庫日: null, 製造日: null, 賞味期限: null, 通知: "", 入庫ID: 0, 計画変更chk: false });
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
      }
      return { ok: true };
    });
  });

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
