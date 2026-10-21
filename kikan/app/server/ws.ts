import type { FastifyInstance } from "fastify";
import { pool, q, t } from "./db.js";
import { requireUser } from "./auth.js";

// 丸北WorkStation の出荷明細票（Access の FM_出荷明細票・FS_出荷明細）で使う表
const 輸送計画 = t("ws", "TD_輸送計画");
const 出荷 = t("ws", "TD_出荷");
const 積込順 = t("ws", "TD_積込順");
const 運送会社マスタ = t("ws_fe", "TM_運送会社マスタ");
const 得意先マスタ = t("ws_fe", "TM_得意先マスタ");

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
    const [m] = await q(`SELECT "短縮名" FROM ${運送会社マスタ} WHERE "運送会社ID" = $1 LIMIT 1`, [Number(req.params.code)]);
    return { 短縮名: m?.短縮名 ?? null };
  });
}
