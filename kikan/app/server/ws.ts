import type { FastifyInstance } from "fastify";
import type { PoolClient } from "pg";
import { pool, q, t, 日本の今 } from "./db.js";
import { requireUser } from "./auth.js";
import { cint } from "./hanmori.js";

// 丸北WorkStation の出荷明細票（Access の FM_出荷明細票・FS_出荷明細）で使う表
const 輸送計画 = t("ws", "TD_輸送計画");
const 出荷 = t("ws", "TD_出荷");
const 積込順 = t("ws", "TD_積込順");
// 運送会社ID が同じ行が 2 つある運送会社（180・213）があるので、使っている（使用不可でない・名前のある）行を選ぶ
const 運送会社マスタ = t("ws_fe", "TM_運送会社マスタ");
const 得意先マスタ = t("kyotsu", "TM_得意先マスタ");
const 商品マスタ = t("kyotsu", "TM_商品マスタ");
const 名義条件 = t("ws_fe", "TM_入庫先商品別名義条件");
const 出荷場所条件 = t("ws_fe", "TM_出荷場所条件");
const 運賃振分区分マスタ = t("ws_fe", "TM_運賃振分区分マスタ");
const 訂正履歴 = t("ws_fe", "TD_訂正履歴管理");
const WS受注 = t("ws", "TD_受注"); // Access の QD_受注（WorkStation の受注の写し）

/** 明細（TD_出荷）で、画面から書き込んでよい項目 */
const 明細の書ける項目 = new Set([
  "届け先コード", "届け先", "倉庫ID", "倉庫名", "ケース", "商品kg", "製造日", "賞味期限", "納品日", "タグ", "商品区分", "商品状態隠語",
  "本社受注", "運賃請求ID", "サンプル区分", "サービス区分", "蔵前区分", "運賃振分区分", "運賃振分区分名", "産地コード", "製造工場ID", "製造工場名",
  "取引元ID", "取引元", "取引帳合ID", "取引帳合", "手配元ID", "手配元", "手配帳合ID", "手配帳合", "入庫前名義ID", "入庫後名義ID",
  "請求先コード", "請求先", "送り状No", "ユーザー伝票No", "他工場伝票No", "参照受注番号", "受注表題", "備考", "社内連絡", "入庫備考",
  "商品積込順", "規格", "入数",
]);
/** 得意先コードと名前の組（コードを変えたら名前も入れる） */
const 名前の組: Record<string, string> = {
  届け先コード: "届け先", 倉庫ID: "倉庫名", 取引元ID: "取引元", 取引帳合ID: "取引帳合", 手配元ID: "手配元", 手配帳合ID: "手配帳合", 請求先コード: "請求先", 製造工場ID: "製造工場名",
};

async function 短縮名(c: PoolClient, code: unknown): Promise<string | null> {
  if (code === null || code === undefined || code === "") return null;
  const r = await c.query(`SELECT "短縮名" FROM ${得意先マスタ} WHERE "短縮コード" = $1 LIMIT 1`, [Number(code)]);
  return r.rows[0]?.短縮名 ?? null;
}

/** 商品・届け先の特記事項を備考に足す（Access の C_特別項目。0＝商品の特記事項、1＝届け先の受付時間） */
export async function 特別項目(c: PoolClient, 区分: 0 | 1, 備考: string, code: unknown): Promise<string> {
  const r =
    区分 === 0
      ? await c.query(`SELECT "特記事項" AS v FROM ${商品マスタ} WHERE "商品コード" = $1 LIMIT 1`, [Number(code ?? 0)])
      : await c.query(`SELECT "受付時間" AS v FROM ${得意先マスタ} WHERE "短縮コード" = $1 LIMIT 1`, [Number(code ?? 0)]);
  const add = r.rows[0]?.v ?? "";
  if (("ads" + 備考).includes(add)) return 備考; // すでに入っている（空のときもここ）
  return add.length + 備考.length < 50 ? add + 備考 : add;
}

/** 製造日から賞味期限を出す（Access の KigenSum） */
export async function 賞味期限計算(c: PoolClient, 製造日: string | null, 商品コード: unknown): Promise<string | null> {
  if (!製造日) return null;
  const r = await c.query(`SELECT "品質保持期間", "賞味期限日付差" FROM ${商品マスタ} WHERE "商品コード" = $1 LIMIT 1`, [Number(商品コード ?? 0)]);
  const 期間 = Number(r.rows[0]?.品質保持期間 ?? 0);
  if (!期間) return null;
  let 差 = Number(r.rows[0]?.賞味期限日付差 ?? 0);
  const d0 = new Date(製造日.slice(0, 10) + "T00:00:00Z");
  if (d0.getUTCMonth() === 1 && d0.getUTCDate() === 29) 差 = 0;
  // DateAdd("m") と同じく、月末を超えるときはその月の最後の日にする
  const months = Math.round(期間 * 12);
  const y = d0.getUTCFullYear() + Math.floor((d0.getUTCMonth() + months) / 12);
  const m = (d0.getUTCMonth() + months) % 12;
  const last = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
  let d = new Date(Date.UTC(y, m, Math.min(d0.getUTCDate(), last)));
  d = new Date(d.getTime() + 差 * 86400000);
  if (d.getUTCMonth() === 1 && d.getUTCDate() === 29) d = new Date(d.getTime() - 86400000);
  return d.toISOString().slice(0, 10);
}

/** 1 行の運賃振分け（Access の C_レコード別条件運賃振分け を 1 件について） */
async function 運賃振分け(c: PoolClient, 出庫ID: number, 名義表示: boolean, 本社受注: boolean) {
  const { rows } = await c.query(
    `SELECT s.*, m."グループ商品コード" FROM ${出荷} s LEFT JOIN ${商品マスタ} m ON m."商品コード" = s."商品コード" WHERE s."出庫ID" = $1`,
    [出庫ID],
  );
  const r = rows[0];
  if (!r) return;
  const v: Record<string, unknown> = {};
  const [tk] = (await c.query(`SELECT "倉庫区分" FROM ${得意先マスタ} WHERE "短縮コード" = $1 LIMIT 1`, [r.届け先コード ?? 0])).rows;
  v.届け先区分 = tk?.倉庫区分 === true ? 3 : 0;
  const 条件 = (await c.query(`SELECT * FROM ${名義条件} WHERE "届け先コード" = $1 ORDER BY "ID"`, [r.届け先コード ?? 0])).rows;
  const g = r.グループ商品コード ?? 0;
  const 本社 = (x: any) => (本社受注 ? x.運賃振分区分 === 629 : x.運賃振分区分 !== 629);
  const hit =
    条件.find((x) => x.倉庫ID === (r.倉庫ID ?? 0) && x.商品コード === g && 本社(x)) ??
    条件.find((x) => x.商品コード === g && 本社(x)) ??
    条件.find((x) => x.商品コード === g);
  let 入庫後名義ID = r.入庫後名義ID;
  if (hit) {
    v.運賃請求ID = hit.運賃請求ID;
    v.運賃振分区分 = hit.運賃振分区分;
    v.運賃振分区分名 = (await c.query(`SELECT "運賃振分区分名" FROM ${運賃振分区分マスタ} WHERE "運賃振分区分" = $1`, [hit.運賃振分区分 ?? 0])).rows[0]?.運賃振分区分名 ?? null;
    if (名義表示) {
      入庫後名義ID = hit.入庫名義ID ?? 0;
      v.入庫後名義ID = 入庫後名義ID;
      if (入庫後名義ID === 629) v.本社受注 = true;
    }
    if (v.届け先区分 === 3) {
      if (入庫後名義ID === 629) Object.assign(v, { 取引元ID: 645, 取引元: "大阪デポ", 取引帳合ID: 629, 取引帳合: "大阪丸北" });
      else if (入庫後名義ID === 11 || 入庫後名義ID === 150)
        Object.assign(v, { 取引元ID: 1254, 取引元: "丸北　北海道デポ", 取引帳合ID: 11, 取引帳合: "丸北　北海道" });
      else
        Object.assign(v, { 取引元ID: hit.取引先ID, 取引元: await 短縮名(c, hit.取引先ID), 取引帳合ID: hit.受注先ID, 取引帳合: await 短縮名(c, hit.受注先ID) });
    }
  }
  if (本社受注 || r.本社受注 === true || v.本社受注 === true) {
    v.運賃振分区分 = 629;
    v.運賃振分区分名 = (await c.query(`SELECT "運賃振分区分名" FROM ${運賃振分区分マスタ} WHERE "運賃振分区分" = 629`)).rows[0]?.運賃振分区分名 ?? null;
    v.本社受注 = true;
  }
  const cols = Object.keys(v);
  await c.query(`UPDATE ${出荷} SET ${cols.map((k, i) => `"${k}" = $${i + 2}`).join(", ")} WHERE "出庫ID" = $1`, [出庫ID, ...cols.map((k) => v[k])]);
}

/** 受注の残ケースを出し直す（Access の C_受注残数変更。QD_受注＝WorkStation の受注の写し） */
async function 受注残数(c: PoolClient, 受注ID: number) {
  if (!受注ID) return;
  await c.query(
    `UPDATE ${WS受注} SET "残ケース" = COALESCE("ケース", 0) - (SELECT COALESCE(SUM("ケース"), 0) FROM ${出荷} WHERE "受注ID" = $1) WHERE "受注ID" = $1`,
    [受注ID],
  );
}

export async function 一連で<T>(fn: (c: PoolClient) => Promise<T>): Promise<T> {
  const c = await pool.connect();
  try {
    await c.query("BEGIN");
    const r = await fn(c);
    await c.query("COMMIT");
    return r;
  } catch (e) {
    await c.query("ROLLBACK");
    throw e;
  } finally {
    c.release();
  }
}

/** 上の欄の選択肢（表と、コード・名前の項目） */
const 選択肢の表: Record<string, [string, string, string]> = {
  運賃区分ID: [t("ws_fe", "TM_運賃輸送区分"), "運賃輸送区分", "運賃輸送区分名"], // 画面の「輸送区分」（商品輸送など）
  輸送区分ID: [t("ws_fe", "TM_輸送区分"), "輸送区分ID", "輸送区分"], // 画面の「輸送」（陸・海・空）
  配達区分ID: [t("ws_fe", "TM_配達区分"), "配達区分ID", "配達区分"],
  車両区分ID: [t("ws_fe", "TM_車両区分"), "車両区分ID", "車両区分"],
  冷凍区分ID: [t("ws_fe", "TM_冷凍区分"), "冷凍ID", "冷凍区分"],
  運賃計算区分: [t("ws_fe", "TM_運賃分類マスタ"), "運賃計算ID", "運賃計算名"], // 画面の「運賃区分」（貸切など）
};

/** 画面から書き込んでよい輸送計画の項目 */
const 書ける項目 = new Set([
  "出荷計画日", "運送会社ID", "運送会社名", "手配運送会社コード", "手配運送会社名", "帳合運送会社コード", "帳合運送会社名",
  "車番", "運行指令No", "集荷日", "担当者", "セット温度", "冷凍区分ID", "運賃区分ID", "輸送区分ID", "車両区分ID", "配達区分ID",
  "積込開始時間", "積込終了時間", "丸北開始時間", "丸北終了時間", "到着時間", "丸北指定時間", "パレット輸送区分", "パレット積載数",
  "運賃計算区分", "納品日コメント",
]);

export function wsRoutes(app: FastifyInstance) {
  app.addHook("preHandler", requireUser);
  app.setErrorHandler((e: any, _req, reply) => {
    reply.code(e.status ?? e.statusCode ?? 500).send({ error: e.status ? e.message : "うまくいきませんでした：" + e.message });
  });

  // 上の欄の選択肢
  app.get("/api/ws/choices", async () => {
    const out: Record<string, unknown[]> = {};
    for (const [k, [tb, id, name]] of Object.entries(選択肢の表))
      out[k] = await q(`SELECT "${id}" AS "id", "${name}" AS "name" FROM ${tb} ORDER BY "${id}"`);
    return out;
  });

  // その日の便（輸送計画）の一覧。Access と同じく輸送ID の順
  app.get<{ Querystring: { date: string } }>("/api/ws/day", async (req) => {
    const ids = await q<{ 輸送ID: number }>(`SELECT "輸送ID" FROM ${輸送計画} WHERE "出荷計画日" = $1::date ORDER BY "輸送ID"`, [req.query.date]);
    // 割付前データ（その日の出荷で、まだ便に割り付けていないもの。Access の 配車日付移動）
    const [{ n }] = await q<{ n: number }>(`SELECT COUNT(*)::int AS n FROM ${出荷} WHERE "輸送ID" = 0 AND "出荷日" = $1::date`, [req.query.date]);
    return { 輸送ID: ids.map((r) => r.輸送ID), 割付前: n };
  });

  // 出荷日の端（最初・最後の便の日）
  app.get("/api/ws/ends", async () => {
    const [r] = await q(`SELECT MIN("出荷計画日")::date::text AS "最初", MAX("出荷計画日")::date::text AS "最後" FROM ${輸送計画}`);
    return r;
  });

  // 計画変更の通知（Access の 計画変更表示）
  app.get("/api/ws/notice", async () => {
    const [{ n }] = await q<{ n: number }>(`SELECT COUNT(*)::int AS n FROM ${出荷} WHERE "計画変更chk" = true`);
    return { 件数: n };
  });

  // 通知の一覧（Access の FSD_通知。計画変更chk の付いた出荷を出荷日の順に）
  app.get("/api/ws/notice/list", async () =>
    q(`SELECT "出庫ID", "輸送ID", "出荷日", "商品名", "届け先", "変更通知" FROM ${出荷} WHERE "計画変更chk" = true ORDER BY "出荷日", "出庫ID"`),
  );

  // 1 便の中身（上の欄・明細・積込順・合計）
  app.get<{ Params: { id: string } }>("/api/ws/plan/:id", async (req, reply) => {
    const id = Number(req.params.id);
    const [plan] = await q(`SELECT * FROM ${輸送計画} WHERE "輸送ID" = $1`, [id]);
    if (!plan) return reply.code(404).send({ error: "この便はありません" });
    // 予約の欄はパレット区分（TM_パレット調整区分：1＝確定、2＝調整）
    const rows = await q(
      `SELECT s.*, pk."パレット区分調整" AS "予約" FROM ${出荷} s
       LEFT JOIN ${t("ws_fe", "TM_パレット調整区分")} pk ON pk."パレット区分調整ID" = s."パレット区分"
       WHERE s."輸送ID" = $1 ORDER BY s."商品積込順", s."商品コード", s."賞味期限", s."タグ", s."出庫ID"`,
      [id],
    );
    const 積込 = await q(
      `SELECT k.*, a."短縮名" AS "届け先名", b."短縮名" AS "出荷元名" FROM ${積込順} k
       LEFT JOIN ${得意先マスタ} a ON a."短縮コード" = k."積込順届け先"
       LEFT JOIN ${得意先マスタ} b ON b."短縮コード" = k."積込順出荷元"
       WHERE k."輸送ID" = $1 ORDER BY k."届け順" DESC, k."積込順"`,
      [id],
    );
    return { plan, rows, 積込 };
  });

  // 左の積込順（Access の FS_積込順）：届け順・積込順・届け先・出荷元・積込備考を直す。届け先を変えたら、その受付時間を積込備考の前に足す
  const 積込順の項目 = ["届け順", "積込順", "積込順届け先", "積込順出荷元", "積込備考"];
  app.post<{ Body: { ID: number; 項目: string; 値: unknown } }>("/api/ws/tsumi/save", async (req, reply) => {
    const 項目 = req.body.項目;
    if (!積込順の項目.includes(項目)) return reply.code(400).send({ error: "この項目は直せません" });
    let 値: unknown = req.body.値 === "" || req.body.値 === undefined ? null : req.body.値;
    if (値 !== null && 項目 !== "積込備考") {
      値 = Number(値);
      if (!Number.isFinite(値 as number)) return reply.code(400).send({ error: "数を入れてください" });
    }
    return 一連で(async (c) => {
      const k = (await c.query(`SELECT * FROM ${積込順} WHERE "ID" = $1 FOR UPDATE`, [Number(req.body.ID)])).rows[0];
      if (!k) return reply.code(404).send({ error: "この行はありません" });
      const v: Record<string, unknown> = { [項目]: 値 };
      if (項目 === "積込順届け先" && 値 !== null) {
        const 受付 = (await c.query(`SELECT "受付時間" FROM ${得意先マスタ} WHERE "短縮コード" = $1 LIMIT 1`, [値])).rows[0]?.受付時間 ?? "";
        v.積込備考 = `${受付}${k.積込備考 ?? ""}`.slice(0, 255) || null;
      }
      const cols = Object.keys(v);
      await c.query(`UPDATE ${積込順} SET ${cols.map((x, i) => `"${x}" = $${i + 2}`).join(", ")} WHERE "ID" = $1`, [k.ID, ...cols.map((x) => v[x])]);
      return { ok: true };
    });
  });
  app.post<{ Body: { 輸送ID: number } }>("/api/ws/tsumi/new", async (req, reply) => {
    const 輸送ID = Number(req.body.輸送ID);
    if (!輸送ID) return reply.code(400).send({ error: "便を選んでください" });
    return 一連で(async (c) => {
      await c.query(`SELECT pg_advisory_xact_lock(hashtext('TD_積込順.ID'))`);
      const id = Number((await c.query(`SELECT COALESCE(MAX("ID"), 0) + 1 AS m FROM ${積込順}`)).rows[0].m);
      const 次 = (await c.query(`SELECT COALESCE(MAX("届け順"), 0) + 1 AS t, COALESCE(MAX("積込順"), 0) + 1 AS k FROM ${積込順} WHERE "輸送ID" = $1`, [輸送ID])).rows[0];
      await c.query(`INSERT INTO ${積込順} ("ID", "輸送ID", "届け順", "積込順") VALUES ($1, $2, $3, $4)`, [id, 輸送ID, Number(次.t), Number(次.k)]);
      return { ID: id };
    });
  });
  app.post<{ Body: { ID: number } }>("/api/ws/tsumi/delete", async (req, reply) => {
    const r = await q(`DELETE FROM ${積込順} WHERE "ID" = $1 RETURNING 1`, [Number(req.body.ID)]);
    if (!r.length) return reply.code(404).send({ error: "この行はありません" });
    return { ok: true };
  });

  // 上の欄を直す。輸送の運送会社を変えたときは、Access と同じく区分などの初めの値を入れる
  app.post<{ Body: Record<string, any> }>("/api/ws/plan/save", async (req, reply) => {
    const b = req.body;
    const id = Number(b.輸送ID);
    const v: Record<string, unknown> = {};
    for (const [k, x] of Object.entries(b)) if (書ける項目.has(k)) v[k] = x === "" ? null : x;

    if ("運送会社ID" in v && v.運送会社ID !== null) {
      const unso = Number(v.運送会社ID);
      const [plan] = await q(`SELECT "手配運送会社コード", "帳合運送会社コード", "出荷計画日" FROM ${輸送計画} WHERE "輸送ID" = $1`, [id]);
      const [last] = await q(`SELECT "配達区分ID", "車両区分ID" FROM ${輸送計画} WHERE "運送会社ID" = $1 ORDER BY "輸送ID" LIMIT 1`, [unso]);
      // 運賃計算区分は、同じ手配・帳合・輸送の組で、2022/4/1 からおとといまでの一番大きい値（Access の DMax）
      const [unchin] = await q(
        `SELECT COALESCE(MAX("運賃計算区分"), 0) AS m FROM ${輸送計画}
         WHERE "出荷計画日" BETWEEN '2022-04-01' AND (now() AT TIME ZONE 'Asia/Tokyo')::date - 2
           AND "手配運送会社コード" = $1 AND "帳合運送会社コード" = $2 AND "運送会社ID" = $3`,
        [b.手配運送会社コード ?? plan?.手配運送会社コード ?? 0, b.帳合運送会社コード ?? plan?.帳合運送会社コード ?? 0, unso],
      );
      Object.assign(v, {
        運賃区分ID: 1, 冷凍区分ID: 2, 輸送区分ID: 1, 配達区分ID: last?.配達区分ID ?? null, 車両区分ID: last?.車両区分ID ?? null,
        セット温度: -22, 集荷日: plan?.出荷計画日 ?? null, 運賃計算区分: unchin.m,
      });
    }
    // 時刻は Access と同じく 1899/12/30 の日付を付けて持つ
    for (const k of ["積込開始時間", "積込終了時間", "丸北開始時間", "丸北終了時間", "到着時間", "丸北指定時間"]) {
      if (typeof v[k] !== "string") continue;
      const m = String(v[k]).match(/^(\d{1,2})[:：](\d{2})$/);
      if (!m) throw Object.assign(new Error("時刻の書き方が正しくありません。（例：8:55）"), { status: 400 });
      v[k] = `1899-12-30 ${m[1].padStart(2, "0")}:${m[2]}:00`;
    }
    // 車番は全角にする（Access の StrConv(車番, vbWide)）
    if (typeof v.車番 === "string")
      v.車番 = v.車番.replace(/[!-~]/g, (c) => String.fromCharCode(c.charCodeAt(0) + 0xfee0)).replace(/ /g, "　");

    const cols = Object.keys(v);
    if (!cols.length) return { ok: true };
    const r = await q(`UPDATE ${輸送計画} SET ${cols.map((k, i) => `"${k}" = $${i + 2}`).join(", ")} WHERE "輸送ID" = $1 RETURNING "輸送ID"`, [
      id, ...cols.map((k) => v[k]),
    ]);
    if (!r.length) return reply.code(404).send({ error: "この便はありません" });
    return { ok: true };
  });

  // 新しい便（その出荷日で）
  // 振分け（Access の 配車自動振分け）：この便の届け先・出荷元ごとに、届け順と積込順を作り直す（前の積込順は消える。積込備考も消える）
  app.post<{ Body: { 輸送ID: number } }>("/api/ws/plan/furiwake", async (req) => {
    const 輸送ID = Number(req.body.輸送ID);
    return 一連で(async (c) => {
      await c.query(`DELETE FROM ${積込順} WHERE "輸送ID" = $1`, [輸送ID]);
      // 届け先・出荷元ごとに、商品積込順（はじめの行の値）の大きい順、地区コードの順
      const rows = (
        await c.query(
          `SELECT s."届け先コード", s."倉庫ID", (array_agg(s."商品積込順" ORDER BY s."出庫ID"))[1] AS "順", m."地区コード"
           FROM ${出荷} s LEFT JOIN ${得意先マスタ} m ON m."短縮コード" = s."届け先コード"
           WHERE s."輸送ID" = $1 GROUP BY s."届け先コード", s."倉庫ID", m."地区コード"
           ORDER BY 3 DESC NULLS LAST, m."地区コード", s."届け先コード", s."倉庫ID"`,
          [輸送ID],
        )
      ).rows;
      await c.query(`SELECT pg_advisory_xact_lock(hashtext('TD_積込順.ID'))`);
      let id = Number((await c.query(`SELECT COALESCE(MAX("ID"), 0) + 1 AS n FROM ${積込順}`)).rows[0].n);
      let 積込順の数 = rows.length;
      for (const [i, r] of rows.entries()) {
        await c.query(
          `INSERT INTO ${積込順} ("ID", "輸送ID", "積込順", "届け順", "積込順出荷元", "積込順届け先", "積込指定No", "積込指定外No", "OneDriveChk")
           VALUES ($1, $2, $3, $4, $5, $6, 0, 0, false)`,
          [id++, 輸送ID, 積込順の数--, i + 1, r.倉庫ID, r.届け先コード],
        );
      }
      return { 件数: rows.length };
    });
  });

  app.post<{ Body: { date: string } }>("/api/ws/plan/new", async (req) => {
    const c = await pool.connect();
    try {
      await c.query("BEGIN");
      await c.query(`SELECT pg_advisory_xact_lock(hashtext('TD_輸送計画.輸送ID'))`);
      const { rows } = await c.query(`SELECT COALESCE(MAX("輸送ID"), 0) + 1 AS id FROM ${輸送計画}`);
      const id = Number(rows[0].id);
      await c.query(
        `INSERT INTO ${輸送計画} ("輸送ID", "出荷計画日", "chk", "受領印チェック", "重量エラーchk", "運賃chk", "OneDriveChk")
         VALUES ($1, $2::date, false, false, false, false, false)`,
        [id, req.body.date],
      );
      await c.query("COMMIT");
      return { 輸送ID: id };
    } catch (e) {
      await c.query("ROLLBACK");
      throw e;
    } finally {
      c.release();
    }
  });

  // 便を消す（Access と同じく合言葉が要る。配車割付をはずしてから消す）
  app.post<{ Body: { 輸送ID: number; 合言葉: string } }>("/api/ws/plan/delete", async (req, reply) => {
    const pass = process.env.JUCHU_DELETE_PASSWORD;
    if (!pass) return reply.code(400).send({ error: "削除の合言葉がサーバーに設定されていないため、削除できません。" });
    const id = Number(req.body.輸送ID);
    const [p] = await q<{ chk: boolean }>(`SELECT chk FROM ${輸送計画} WHERE "輸送ID" = $1`, [id]);
    if (!p) return reply.code(404).send({ error: "この便はありません" });
    if (req.body.合言葉 !== pass) return reply.code(403).send({ error: p.chk ? "すでに登録済みの為、削除できません。" : "パスワードが違います。" });
    if (p.chk) return { 削除: false, chkを外せる: true };
    const c = await pool.connect();
    try {
      await c.query("BEGIN");
      await c.query(`UPDATE ${出荷} SET "輸送ID" = 0 WHERE "輸送ID" = $1`, [id]);
      await c.query(`DELETE FROM ${輸送計画} WHERE "輸送ID" = $1`, [id]);
      await c.query("COMMIT");
    } catch (e) {
      await c.query("ROLLBACK");
      throw e;
    } finally {
      c.release();
    }
    return { 削除: true };
  });

  // 運送会社の名前（コードを入れたとき）
  app.get<{ Params: { code: string } }>("/api/ws/unso/:code", async (req) => {
    const [m] = await q(`SELECT "短縮名" FROM ${運送会社マスタ} WHERE "運送会社ID" = $1
       ORDER BY COALESCE("使用不可フラグ", false), "運送会社名" IS NULL, "ID" LIMIT 1`, [Number(req.params.code)]);
    return { 短縮名: m?.短縮名 ?? null };
  });

  // ---------------- 明細の詳細（Access の FSD_出荷明細2） ----------------

  // 選択肢（商品区分・運賃振分区分・産地・訂正の理由）
  app.get("/api/ws/detail-choices", async () => ({
    商品区分: await q(`SELECT "区分ID" AS "id", "区分名" AS "name" FROM ${t("ws_fe", "TM_商品区分")} ORDER BY "区分ID"`),
    運賃振分区分: await q(`SELECT "運賃振分区分" AS "id", "運賃振分区分名" AS "name" FROM ${運賃振分区分マスタ} ORDER BY "運賃振分区分"`),
    産地: await q(`SELECT "産地コード" AS "id", "通称" AS "name" FROM ${t("ws_fe", "TM_産地マスタ")} ORDER BY "産地コード"`),
    訂正科目: await q(`SELECT "訂正科目ID" AS "id", "訂正科目名" AS "name" FROM ${t("ws_fe", "TM_訂正科目マスタ")} ORDER BY "訂正科目ID"`),
    備考欄: await q(`SELECT "ID" AS "id", "備考欄" AS "name", "分類", "作業分類" FROM ${t("ws", "TM_備考欄")} ORDER BY "分類", "作業分類", "備考欄"`),
  }));

  // 1 行（同じ便のほかの行の出庫ID も、一覧と同じ順で）
  app.get<{ Params: { id: string } }>("/api/ws/detail/:id", async (req, reply) => {
    const [r] = await q(
      `SELECT s.*, p."運送会社名" AS "便の運送会社名", p."車番" AS "便の車番", p."出荷計画日" AS "便の出荷日",
              n1."短縮名" AS "入庫後名義名", n2."短縮名" AS "入庫前名義名"
       FROM ${出荷} s LEFT JOIN ${輸送計画} p ON p."輸送ID" = s."輸送ID"
       LEFT JOIN ${得意先マスタ} n1 ON n1."短縮コード" = s."入庫後名義ID"
       LEFT JOIN ${得意先マスタ} n2 ON n2."短縮コード" = s."入庫前名義ID"
       WHERE s."出庫ID" = $1`,
      [Number(req.params.id)],
    );
    if (!r) return reply.code(404).send({ error: "この明細はありません" });
    const ids = await q<{ 出庫ID: number }>(
      `SELECT "出庫ID" FROM ${出荷} WHERE "輸送ID" = $1 ORDER BY "商品積込順", "商品コード", "賞味期限", "タグ", "出庫ID"`,
      [r.輸送ID],
    );
    return { row: r, ids: ids.map((x) => x.出庫ID) };
  });

  // 1 行を直す（Access の各欄の「更新後処理」と同じ動き）。登録済み（chk）の行は訂正からだけ直せる
  app.post<{ Body: Record<string, any> }>("/api/ws/detail/save", async (req, reply) => {
    const b = req.body;
    const id = Number(b.出庫ID);
    return 一連で(async (c) => {
      const cur = (await c.query(`SELECT * FROM ${出荷} WHERE "出庫ID" = $1 FOR UPDATE`, [id])).rows[0];
      if (!cur) return reply.code(404).send({ error: "この明細はありません" });
      if (cur.chk) return reply.code(403).send({ error: "登録済みのデータを訂正する場合、訂正ボタンをクリックしてください。" });
      const v: Record<string, unknown> = {};
      for (const [k, x] of Object.entries(b)) if (明細の書ける項目.has(k)) v[k] = x === "" ? null : x;
      for (const [code, name] of Object.entries(名前の組)) if (code in v && !(name in v)) v[name] = await 短縮名(c, v[code]);
      // 届け先：届け先の受付時間を備考に足す
      if ("届け先コード" in v) v.備考 = await 特別項目(c, 1, String(v.備考 ?? cur.備考 ?? ""), v.届け先コード);
      // 出荷場所：在庫を読み込んでいない行は、入庫前名義を出荷場所条件の名義にする
      // 出荷明細票の一覧で出荷場所を変えたとき（Access の FS_出荷明細 cmb_出荷元_AfterUpdate）：手配元・手配帳合を出荷場所条件から（無ければ出荷場所）、
      // 社内連絡を「 mm/dd（便の集荷日）出荷場所 引取り」にする。詳細画面（FSD_出荷明細2）はこれをしない
      if ("倉庫ID" in v && b.一覧から) {
        const 場所 = (await c.query(`SELECT "手配元ID", "手配帳合ID" FROM ${出荷場所条件} WHERE "倉庫ID" = $1 LIMIT 1`, [v.倉庫ID])).rows[0];
        v.手配元ID = 場所?.手配元ID ?? v.倉庫ID;
        v.手配帳合ID = 場所?.手配帳合ID ?? v.倉庫ID;
        v.手配元 = await 短縮名(c, v.手配元ID);
        v.手配帳合 = await 短縮名(c, v.手配帳合ID);
        const 集荷日 = (await c.query(`SELECT "集荷日"::date::text AS d FROM ${輸送計画} WHERE "輸送ID" = $1`, [cur.輸送ID])).rows[0]?.d;
        v.社内連絡 = `${集荷日 ? ` ${集荷日.slice(5, 7)}/${集荷日.slice(8, 10)}` : ""}${v.倉庫名 ?? ""} 引取り`;
      }
      if ("倉庫ID" in v && (cur.認識ID ?? "0") === "0") {
        const m = (await c.query(`SELECT "名義ID" FROM ${出荷場所条件} WHERE "倉庫ID" = $1 LIMIT 1`, [v.倉庫ID])).rows[0];
        v.入庫前名義ID = m?.名義ID ?? v.倉庫ID;
      }
      // ケース・商品kg（入数で計算）
      const 入数 = Number(cur.入数 ?? 0);
      if ("ケース" in v && !("商品kg" in v)) v.商品kg = v.ケース === null ? null : Number(v.ケース) * 入数;
      else if ("商品kg" in v && !("ケース" in v) && 入数) v.ケース = v.商品kg === null ? null : cint(Number(v.商品kg) / 入数);
      // 製造日を入れたら賞味期限を出す
      if ("製造日" in v && !("賞味期限" in v)) v.賞味期限 = await 賞味期限計算(c, v.製造日 as string | null, cur.商品コード);
      // 入庫後名義が 658（寿預かり）のときは、入庫依頼書に出す印と、決めてある一文を備考に足す
      if (v.入庫後名義ID === 658 || v.入庫後名義ID === "658") {
        v.入庫備考 = true;
        const [s] = (await c.query(`SELECT "値" FROM app."設定" WHERE "名前" = '寿預かりの備考'`)).rows;
        if (s?.値) v.備考 = `${v.備考 ?? cur.備考 ?? ""} ${s.値}`;
      }
      const cols = Object.keys(v);
      if (cols.length)
        await c.query(`UPDATE ${出荷} SET ${cols.map((k, i) => `"${k}" = $${i + 2}`).join(", ")} WHERE "出庫ID" = $1`, [id, ...cols.map((k) => v[k])]);
      // 届け先を変えたら運賃振分け（名義も入れる）
      if ("届け先コード" in v) await 運賃振分け(c, id, true, Boolean(v.本社受注 ?? cur.本社受注));
      // ケースを変えたら受注の残数を出し直す
      if ("ケース" in v && cur.受注ID) await 受注残数(c, cur.受注ID);
      return { ok: true };
    });
  });

  // 訂正（Access の F_訂正画面。理由を選び、値を変えて、訂正履歴に残す）
  app.post<{ Body: { 出庫ID: number; 項目: string; 値: any; 科目ID: number; 特記事項?: string; 別名?: string } }>("/api/ws/detail/correct", async (req, reply) => {
    const b = req.body;
    if (!明細の書ける項目.has(b.項目) && !["chk", "商品コード", "商品名"].includes(b.項目))
      return reply.code(400).send({ error: "この項目は訂正できません" });
    if (!b.科目ID) return reply.code(400).send({ error: "訂正理由を選択して下さい。" });
    return 一連で(async (c) => {
      const cur = (await c.query(`SELECT * FROM ${出荷} WHERE "出庫ID" = $1 FOR UPDATE`, [Number(b.出庫ID)])).rows[0];
      if (!cur) return reply.code(404).send({ error: "この明細はありません" });
      const 値 = b.値 === "" ? null : b.値;
      await c.query(`UPDATE ${出荷} SET "${b.項目}" = $2 WHERE "出庫ID" = $1`, [Number(b.出庫ID), 値]);
      const 科目 = (await c.query(`SELECT "訂正科目名" FROM ${t("ws_fe", "TM_訂正科目マスタ")} WHERE "訂正科目ID" = $1`, [b.科目ID])).rows[0];
      const next = Number((await c.query(`SELECT COALESCE(MAX("訂正ID"), 0) + 1 AS n FROM ${訂正履歴}`)).rows[0].n);
      await c.query(
        `INSERT INTO ${訂正履歴} ("訂正ID", "訂正科目ID", "訂正科目名", "訂正フォーム名", "訂正テーブル名", "訂正IndexField名", "訂正Index",
           "訂正フィールド", "訂正フィールド別名", "訂正前フィールド値", "訂正後フィールド値", "訂正時間", "訂正IndexFieldType", "訂正フィールドType", "特記事項")
         VALUES ($1, $2, $3, 'FSD_出荷明細2', 'TD_出荷', '出庫ID', $4, $5, $6, $7, $8, $9, '数値', $10, $11)`,
        [
          next, b.科目ID, 科目?.訂正科目名 ?? null, String(b.出庫ID), b.項目, b.別名 ?? b.項目,
          cur[b.項目] === null || cur[b.項目] === undefined ? null : String(cur[b.項目]), 値 === null ? null : String(値),
          日本の今().日時, typeof 値 === "number" ? "数値" : "文字列", b.特記事項 ?? null,
        ],
      );
      if (b.項目 === "ケース" && cur.受注ID) await 受注残数(c, cur.受注ID);
      return { ok: true };
    });
  });

  // 行を消す・便からはずす（Access の Form_Delete。登録済みの行は消せない）
  app.post<{ Body: { 出庫ID: number; 消す: boolean } }>("/api/ws/detail/delete", async (req, reply) => {
    return 一連で(async (c) => {
      const cur = (await c.query(`SELECT * FROM ${出荷} WHERE "出庫ID" = $1 FOR UPDATE`, [Number(req.body.出庫ID)])).rows[0];
      if (!cur) return reply.code(404).send({ error: "この明細はありません" });
      if (!req.body.消す) {
        // キャンセル：消さずに便からはずす（あとで読み込み直せる）
        await c.query(`UPDATE ${出荷} SET "輸送ID" = 0 WHERE "出庫ID" = $1`, [cur.出庫ID]);
        return { はずした: true };
      }
      if (cur.chk)
        return reply.code(400).send({ error: "更新済みのﾚｺｰﾄﾞは在庫に影響する為、削除出来ません！\n(変更は可能ですが在庫には反映されません)" });
      await c.query(`DELETE FROM ${出荷} WHERE "出庫ID" = $1`, [cur.出庫ID]);
      if (cur.受注ID) await 受注残数(c, cur.受注ID);
      return { 消した: true };
    });
  });

  // ---------------- 受注読込（Access の FSD_受注選択） ----------------
  // 出荷日・届け先の地区・割付前／割付後で出荷の行を出し、印（抽出区分）を付けた行をこの便に入れる。
  // 印は Access と同じく表（TD_出荷.抽出区分）に書く。閉じたときに消すのは便に入っている行の印だけ（Access と同じ）。

  /** 地区（0＝全て、1〜9）と割付前／割付後の条件。全て選択・全て解除は Access と同じく地区コード 0・なしの届け先を含めない */
  function 受注選択の条件(p: { date: string; chiku?: string | number; ato?: string | boolean }, args: unknown[], 全ての地区: string) {
    args.push(p.date);
    let where = `s."出荷日" = $${args.length}::date`;
    const chiku = Number(p.chiku ?? 0);
    if (chiku) {
      args.push(chiku);
      where += ` AND m."地区コード" = $${args.length}`;
    } else where += 全ての地区;
    where += p.ato === true || p.ato === "1" ? ` AND s."輸送ID" <> 0` : ` AND s."輸送ID" = 0`;
    return where;
  }
  const 地区つき = `${出荷} s LEFT JOIN LATERAL (SELECT "地区コード" FROM ${得意先マスタ} WHERE "短縮コード" = s."届け先コード" LIMIT 1) m ON true`;

  app.get<{ Querystring: { date: string; chiku?: string; ato?: string } }>("/api/ws/yomikomi", async (req) => {
    const args: unknown[] = [];
    const where = 受注選択の条件(req.query, args, "");
    return q(
      `SELECT s."出庫ID", s."抽出区分", s."輸送ID", s."製造日", s."ケース", s."倉庫名", s."商品kg", p."運送会社名", s."商品名", s."納品日", s."届け先", m."地区コード"
       FROM ${地区つき} LEFT JOIN ${輸送計画} p ON p."輸送ID" = s."輸送ID"
       WHERE ${where} ORDER BY s."輸送ID", s."届け先コード", s."倉庫ID", s."商品コード", s."出庫ID"`,
      args,
    );
  });

  // 1 行の印を付ける・はずす
  app.post<{ Body: { 出庫ID: number; 抽出区分: boolean } }>("/api/ws/yomikomi/check", async (req) => {
    await q(`UPDATE ${出荷} SET "抽出区分" = $2 WHERE "出庫ID" = $1`, [Number(req.body.出庫ID), !!req.body.抽出区分]);
    return { ok: true };
  });

  // 全て選択・全て解除（いま出している条件の行。地区が「全て」のときは地区コード 0・なしの届け先を含めない）
  app.post<{ Body: { date: string; chiku?: number; ato?: boolean; 抽出区分: boolean } }>("/api/ws/yomikomi/all", async (req) => {
    const args: unknown[] = [];
    const where = 受注選択の条件(req.body, args, ` AND m."地区コード" <> 0`);
    args.push(!!req.body.抽出区分);
    const r = await pool.query(
      `UPDATE ${出荷} SET "抽出区分" = $${args.length} WHERE "出庫ID" IN (SELECT s."出庫ID" FROM ${地区つき} WHERE ${where})`,
      args,
    );
    return { 件数: r.rowCount };
  });

  /** 閉じたとき：便に入っている行の印を消す（Access の Form_Close。Q_出荷レコード＝便のある行で届け先コードが 0 でないもの） */
  async function 受注選択の印を消す(c: { query: (sql: string) => Promise<unknown> }) {
    await c.query(
      `UPDATE ${出荷} s SET "抽出区分" = false WHERE s."抽出区分" = true AND s."届け先コード" <> 0
         AND EXISTS (SELECT 1 FROM ${輸送計画} p WHERE p."輸送ID" = s."輸送ID")`,
    );
  }

  app.post("/api/ws/yomikomi/close", async () => {
    await 受注選択の印を消す(pool);
    return { ok: true };
  });

  // 読込：印の付いた行（画面に出ていない行も含め、表全体で印のあるもの）をこの便に入れ、出荷日を便の出荷日にする
  app.post<{ Body: { 輸送ID: number } }>("/api/ws/yomikomi/read", async (req) => {
    const 輸送ID = Number(req.body.輸送ID) || 0;
    return 一連で(async (c) => {
      const plan = (await c.query(`SELECT "出荷計画日" FROM ${輸送計画} WHERE "輸送ID" = $1`, [輸送ID])).rows[0];
      // 便が見つからないときは今日の日付（Access の Nz(DLookup(...), Date)）
      const 日付 = plan?.出荷計画日 ?? 日本の今().日付;
      const r = await c.query(`UPDATE ${出荷} SET "輸送ID" = $1, "出荷日" = $2 WHERE "抽出区分" = true`, [輸送ID, 日付]);
      await 受注選択の印を消す(c);
      return { 件数: r.rowCount };
    });
  });

  // ---------------- インポート処理（倉庫管理・転売品管理・原料管理から） ----------------
  // Access の FSD_出庫インポート選択・FSD_転売インポート選択・FSD_原料インポート選択（CC_出荷to出庫）

  // 取り込み元の一覧（出荷日で）。どの便にも取り込んでいないかの目安として、WorkStation にある件数も出す
  app.get<{ Params: { src: string }; Querystring: { date: string; soko?: string } }>("/api/ws/import/:src", async (req, reply) => {
    const src = 取り込み元[req.params.src];
    if (!src) return reply.code(404).send({ error: "取り込み元がありません" });
    if (!(await 表がある(src.表))) return reply.code(400).send({ error: `${src.名前}のデータがまだデータベースにありません。` });
    const args: unknown[] = [req.query.date, src.場所ID];
    let where = `s."出荷日" = $1::date`;
    if (req.query.soko) {
      args.push(Number(req.query.soko));
      where += ` AND s."倉庫ID" = $3`;
    }
    return q(
      `SELECT s."出庫ID", s."輸送ID", s."商品積込順", s."届け先コード", s."届け先", s."倉庫ID", s."倉庫名", s."商品コード", s."商品名",
              s."ケース", s."商品kg", s."製造日", s."賞味期限", s."納品日", s."タグ", s."備考",
              (SELECT COUNT(*)::int FROM ${出荷} w WHERE w."インポート場所ID" = $2 AND w."インポート場所出庫ID" = s."出庫ID") AS "取込済"
       FROM ${src.表} s WHERE ${where}
       ORDER BY s."輸送ID", s."商品積込順", s."届け先コード", s."倉庫ID", s."商品コード", s."賞味期限", s."タグ"`,
      args,
    );
  });

  // 選んだ行を、この便の出荷に入れる（Access の 読込）
  app.post<{ Params: { src: string }; Body: { 輸送ID: number; 出庫ID: number[] } }>("/api/ws/import/:src", async (req, reply) => {
    const src = 取り込み元[req.params.src];
    if (!src) return reply.code(404).send({ error: "取り込み元がありません" });
    if (!(await 表がある(src.表))) return reply.code(400).send({ error: `${src.名前}のデータがまだデータベースにありません。` });
    const 輸送ID = Number(req.body.輸送ID);
    return 一連で(async (c) => {
      const plan = (await c.query(`SELECT "出荷計画日" FROM ${輸送計画} WHERE "輸送ID" = $1`, [輸送ID])).rows[0];
      if (!plan) return reply.code(404).send({ error: "この便はありません" });
      await c.query(`SELECT pg_advisory_xact_lock(hashtext('TD_出荷.出庫ID'))`);
      let next = Number((await c.query(`SELECT COALESCE(MAX("出庫ID"), 0) + 1 AS n FROM ${出荷}`)).rows[0].n);
      const rows = (await c.query(`SELECT * FROM ${src.表} WHERE "出庫ID" = ANY($1::int[]) ORDER BY "輸送ID", "商品積込順", "出庫ID"`, [req.body.出庫ID])).rows;
      for (const r of rows) {
        const v: Record<string, unknown> = { ...出荷の既定値, 出庫ID: next++, 輸送ID, 出荷日: plan.出荷計画日 };
        // タグ2 は倉庫管理からのときだけ写す（転売品管理・原料管理は Access でも写していない）
        for (const k of 写す項目) if (k in r && (k !== "タグ2" || src.場所ID === 2)) v[k] = r[k];
        v.倉庫受注ID = r.受注ID ?? null;
        v.インポート場所ID = src.場所ID;
        v.インポート場所出庫ID = r.出庫ID;
        if (src.場所ID === 2) v.認識ID = `S_${r.在庫ID ?? ""}`;
        if (src.場所ID === 4) v.認識ID = `G_${r.在庫ID ?? ""}`;
        if (src.場所ID === 8) {
          v.認識ID = r.認識ID ?? null;
          v.他工場伝票No = r.他工場伝票No ?? null;
        }
        // 倉庫管理からのときだけ、パレット枚数を出す（ケース ÷ 商品マスタのパレット単位1）
        if (src.場所ID === 2) {
          const p1 = Number((await c.query(`SELECT "パレット単位1" FROM ${商品マスタ} WHERE "商品コード" = $1 LIMIT 1`, [r.商品コード ?? 0])).rows[0]?.パレット単位1 ?? 0);
          v.パレット使用枚数 = p1 ? cint(Number(r.ケース ?? 0) / p1) : 0;
        }
        v.運賃振分区分名 = (await c.query(`SELECT "運賃振分区分名" FROM ${運賃振分区分マスタ} WHERE "運賃振分区分" = $1`, [r.運賃振分区分 ?? 0])).rows[0]?.運賃振分区分名 ?? null;
        const k = Object.keys(v);
        await c.query(`INSERT INTO ${出荷} (${k.map((x) => `"${x}"`).join(", ")}) VALUES (${k.map((_, i) => `$${i + 1}`).join(", ")})`, k.map((x) => v[x]));
        // 取り込み元に印を付ける（転売品管理は丸北輸送ID、原料管理はインポート先出庫ID）
        if (src.場所ID === 8) await c.query(`UPDATE ${src.表} SET "丸北輸送ID" = $2 WHERE "出庫ID" = $1`, [r.出庫ID, 輸送ID]);
        if (src.場所ID === 4) await c.query(`UPDATE ${src.表} SET "インポート先出庫ID" = $2 WHERE "出庫ID" = $1`, [r.出庫ID, v.出庫ID]);
      }
      return { 件数: rows.length };
    });
  });
}

/** 取り込み元（インポート場所ID：2＝倉庫管理、8＝転売品管理、4＝原料管理） */
const 取り込み元: Record<string, { 表: string; 場所ID: number; 名前: string }> = {
  soko: { 表: t("soko", "TD_出荷"), 場所ID: 2, 名前: "倉庫管理" },
  tenbai: { 表: t("tenbai", "TD_出荷"), 場所ID: 8, 名前: "転売品管理" },
  genryo: { 表: t("genryo", "TD_出荷"), 場所ID: 4, 名前: "原料管理" },
};

/** 取り込むときに元から写す項目（Access の CC_出荷to出庫） */
const 写す項目 = [
  "商品積込順", "納品日", "商品コード", "商品名", "規格", "入数", "ケース", "商品kg", "製造日", "入庫前名義ID", "入庫後名義ID", "入庫No", "賞味期限",
  "倉庫ID", "倉庫名", "届け先コード", "届け先", "手配元ID", "手配帳合ID", "手配元", "手配帳合", "取引元ID", "取引帳合ID", "取引元", "取引帳合",
  "ユーザー伝票No", "サービス区分", "タグ", "タグ2", "製造工場ID", "製造工場名", "社内連絡", "備考", "商品状態隠語", "商品区分", "運賃請求ID", "運賃振分区分",
];

/** WorkStation の出荷に新しく入れるときの初めの値（Access の表の既定値。今のデータで、取り込んだ行がみなこの値） */
export const 出荷の既定値: Record<string, unknown> = {
  入庫ID: 0, 在庫ID: 0, サンプル区分: false, 出荷区分: false, chk: false, 計画変更chk: false, 請求先コード: 0, 個別運賃: 0, 地区コード: 0,
  買取単価コード: 0, 買取chk: false, 買取金額: 0, パレット枚数: 0, 入庫フラグ: false, 完了フラグ: false, 抽出区分: false, 受注確認: false,
  出荷元数: 0, 破損個数: 0, 受注グループ: 0, 輸送履歴読込chk: false, ユーザーchk: false, 帳票グループ化: 0, 積込確認: false, 破損出庫ID: 0,
  商品区分: 0, 出荷元kg: 0, 訂正kg: 0, 入庫備考: false, 商品輸送区分: 629, 本社受注: false, 特別検査区分: false, Newクロップ区分: false,
  取扱い区分: false, 検体区分: false, 指定最終届け先コード: 0, 受注元ID: 0, 蔵前区分: false, パレット区分: 0, 混載区分: 0, 混載No: 0,
  パレット積載数: 0, 空き予定パレット数: 0, パレット積載元数: 0, OneDriveChk: false, 売上科目コード: 0, パレット使用枚数: 0,
};

async function 表がある(qualified: string): Promise<boolean> {
  const [r] = await q<{ r: string | null }>(`SELECT to_regclass($1) AS r`, [qualified]);
  return r.r !== null;
}
