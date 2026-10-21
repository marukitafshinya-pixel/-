import type { FastifyInstance } from "fastify";
import { q, t, 日本の今 } from "./db.js";
import { requireUser } from "./auth.js";

// 発注依頼（F_受注元選択・F_発注書印刷・F_日本食研発注書印刷・R_発注依頼）と特定商品表示（FM_特定商品表示）で使う表
const 受注 = t("juchu", "TD_受注");
const 依頼先 = t("juchu_fe", "TM_出荷依頼先選択");
const 得意先マスタ = t("kyotsu", "TM_得意先マスタ");
const 相手先届け先 = t("juchu_fe", "TM_相手先届け先マスタ");
const 相手先商品 = t("juchu", "TM_相手先商品マスタ");
const 受注特定項目 = t("juchu_fe", "TM_受注特定項目");
const 宛先 = `app."発注依頼書_宛先"`;

/** 300 日前（Access の Date - 300） */
function 三百日前(): string {
  return new Date(Date.now() + 9 * 3600 * 1000 - 300 * 86400 * 1000).toISOString().slice(0, 10);
}

/** 特定商品の編集・依頼先の削除の合言葉（Access と同じ。値はサーバーの設定 JUCHU_EDIT_PASSWORD に置き、プログラムには書かない） */
function 合言葉が合う(v: unknown): boolean {
  const pass = process.env.JUCHU_EDIT_PASSWORD;
  return !!pass && v === pass;
}

export function hacchuRoutes(app: FastifyInstance) {
  app.addHook("preHandler", requireUser);
  app.setErrorHandler((e: any, _req, reply) => {
    reply.code(e.status ?? e.statusCode ?? 500).send({ error: e.status ? e.message : "うまくいきませんでした：" + e.message });
  });

  // ---------------- 発注依頼 ----------------

  // 受注元のボタン（TM_出荷依頼先選択、本社受注でないもの。表に入っている順）
  app.get("/api/hacchu/moto", async () =>
    q(`SELECT "取引先ID", "取引先名" FROM ${依頼先} WHERE COALESCE("本社受注", false) = false ORDER BY ctid`),
  );

  // ユーザー追加
  app.post<{ Body: { 取引先ID: number } }>("/api/hacchu/moto/add", async (req, reply) => {
    const id = Number(req.body.取引先ID);
    const [m] = await q<{ 短縮名: string }>(`SELECT "短縮名" FROM ${得意先マスタ} WHERE "短縮コード" = $1 LIMIT 1`, [id]);
    if (!m) return reply.code(400).send({ error: "得意先マスタにありません" });
    const [has] = await q(`SELECT 1 FROM ${依頼先} WHERE "取引先ID" = $1`, [id]);
    if (has) return reply.code(400).send({ error: `${m.短縮名} は既に条件に入っています。` });
    await q(`INSERT INTO ${依頼先} ("取引先ID", "取引先名", "本社受注") VALUES ($1, $2, false)`, [id, m.短縮名]);
    return { ok: true };
  });

  // ユーザー削除（合言葉が要る）
  app.post<{ Body: { 取引先ID: number; 合言葉: string } }>("/api/hacchu/moto/delete", async (req, reply) => {
    if (!process.env.JUCHU_EDIT_PASSWORD) return reply.code(400).send({ error: "合言葉がサーバーに設定されていないため、削除できません。" });
    if (!合言葉が合う(req.body.合言葉)) return reply.code(403).send({ error: "パスワードが違います。" });
    await q(`DELETE FROM ${依頼先} WHERE "取引先ID" = $1`, [Number(req.body.取引先ID)]);
    return { ok: true };
  });

  // 画面の題名用（受注元の短縮名）
  app.get<{ Params: { moto: string } }>("/api/hacchu/name/:moto", async (req) => {
    const [m] = await q(`SELECT "短縮名" FROM ${得意先マスタ} WHERE "短縮コード" = $1 LIMIT 1`, [Number(req.params.moto)]);
    return { 短縮名: m?.短縮名 ?? "" };
  });

  // 届け先・商品の選択肢
  // 日本食研（360）は相手先のコード（相手先届け先マスタ・相手先商品マスタ）、ほかは 300 日以内の受注から
  app.get<{ Querystring: { moto: string } }>("/api/hacchu/choices", async (req) => {
    const moto = Number(req.query.moto);
    if (moto === 360) {
      const 届け先 = await q(
        `SELECT "相手方届け先コード" AS "コード", "届け先" AS "名前", "自社コード" FROM ${相手先届け先} WHERE "相手先コード" = $1`,
        [moto],
      );
      const 商品 = await q(
        `SELECT "相手先商品コード" AS "コード", "相手先商品名" AS "名前", "商品コード" AS "自社コード" FROM ${相手先商品}
         WHERE "受注元コード" = $1 GROUP BY "相手先商品コード", "商品コード", "相手先商品名" ORDER BY "商品コード"`,
        [moto],
      );
      return { 届け先, 商品 };
    }
    const from = 三百日前();
    const 届け先 = await q(
      `SELECT "届け先コード" AS "コード", "届け先" AS "名前", "届け先コード" AS "自社コード" FROM ${受注}
       WHERE "受注日" > $2::date AND "受注元ID" = $1 GROUP BY "届け先コード", "届け先" ORDER BY "届け先コード"`,
      [moto, from],
    );
    const 商品 = await q(
      `SELECT "商品コード" AS "コード", "商品名" AS "名前", "商品コード" AS "自社コード" FROM ${受注}
       WHERE "受注日" > $2::date AND "受注元ID" = $1 GROUP BY "商品コード", "商品名" ORDER BY "商品コード"`,
      [moto, from],
    );
    return { 届け先, 商品 };
  });

  // 受注番号から、商品名・届け先を出す（Access の 納品日_AfterUpdate）
  app.get<{ Querystring: { bango: string } }>("/api/hacchu/lookup", async (req) => {
    const [r] = await q(`SELECT "商品名", "届け先" FROM ${受注} WHERE "受注番号" = $1 ORDER BY "受注ID" LIMIT 1`, [req.query.bango]);
    return r ?? { 商品名: null, 届け先: null };
  });

  // 発注依頼書に載せる受注（R_発注依頼）。受注ID を指定したとき（受注検索の「印刷」）はその受注、ほかは条件にすべて合う受注
  app.get<{ Querystring: Record<string, string> }>("/api/hacchu/report", async (req) => {
    const p = req.query;
    let where: string[];
    let args: unknown[];
    if (p.jid) {
      where = [`j."受注ID" = $1`];
      args = [Number(p.jid)];
    } else {
      where = [`j."納品日" = $1::date`, `j."届け先コード" = $2`, `j."受注番号" = $3`, `j."商品コード" = $4`, `j."商品kg" = $5`];
      args = [p.納品日, Number(p.届け先コード), p.受注番号, Number(p.商品コード), Number(p.商品kg)];
      if (p.受注日) {
        args.push(p.受注日);
        where.push(`j."受注日"::date = $6::date`);
      }
    }
    const rows = await q(
      `SELECT j.*, m."得意先名" AS "届け先正式名", m."郵便番号", m."住所", m."電話番号", m."FAX番号",
              (SELECT a."相手先商品コード" FROM ${相手先商品} a WHERE a."商品コード" = j."商品コード" AND a."受注元コード" = j."受注元ID" LIMIT 1) AS "GTINコード"
       FROM ${受注} j LEFT JOIN ${得意先マスタ} m ON m."短縮コード" = j."届け先コード"
       WHERE ${where.join(" AND ")} ORDER BY j."受注元ID", j."受注先ID"`,
      args,
    );
    const 宛先一覧 = await q(`SELECT * FROM ${宛先} ORDER BY "商品コード"`);
    const [発行元] = await q(`SELECT * FROM app."発注依頼書_発行元" WHERE "番号" = 1`);
    return { rows, 宛先: 宛先一覧, 発行元 };
  });

  // 発注依頼書の宛先（商品コード 0 がふだんの宛先。75・1163 などは商品ごとの宛先）
  app.get("/api/hacchu/atesaki", async () => q(`SELECT * FROM ${宛先} ORDER BY "商品コード"`));
  app.post<{ Body: Record<string, any> }>("/api/hacchu/atesaki", async (req) => {
    const b = req.body;
    await q(
      `INSERT INTO ${宛先} ("商品コード", "手配依頼先", "仕入先名", "仕入先コード", "返信コメント2", "返信コメント3", "納品指定時間")
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT ("商品コード") DO UPDATE SET "手配依頼先" = $2, "仕入先名" = $3, "仕入先コード" = $4, "返信コメント2" = $5,
         "返信コメント3" = $6, "納品指定時間" = $7`,
      [Number(b.商品コード), b.手配依頼先 ?? "", b.仕入先名 ?? "", b.仕入先コード ?? "", b.返信コメント2 ?? "", b.返信コメント3 ?? "", b.納品指定時間 ?? ""],
    );
    return { ok: true };
  });

  // 発行元（自社）の名前・住所・電話
  app.post<{ Body: Record<string, any> }>("/api/hacchu/hakkomoto", async (req) => {
    const b = req.body;
    await q(`UPDATE app."発注依頼書_発行元" SET "会社名" = $1, "住所" = $2, "TEL" = $3, "FAX" = $4 WHERE "番号" = 1`, [
      b.会社名 ?? "", b.住所 ?? "", b.TEL ?? "", b.FAX ?? "",
    ]);
    return { ok: true };
  });

  // ---------------- 特定商品表示 ----------------

  app.get("/api/tokutei", async () =>
    q(`SELECT "ID", "商品コード", "商品名", "届け先コード", "届け先", "備考", "入力時間" FROM ${受注特定項目} ORDER BY "商品コード", "ID"`),
  );

  // 編集できるようにする（Access の［編集］。合言葉が要る）
  app.post<{ Body: { 合言葉: string } }>("/api/tokutei/unlock", async (req, reply) => {
    if (!process.env.JUCHU_EDIT_PASSWORD) return reply.code(400).send({ error: "合言葉がサーバーに設定されていないため、編集できません。" });
    if (!合言葉が合う(req.body.合言葉)) return reply.code(403).send({ error: "パスワードが違います!!" });
    return { ok: true };
  });

  // 1 行を直す・足す・消す（編集できるようにしたあとだけ。合言葉をいっしょに送る）
  app.post<{ Body: { 合言葉: string; 行: Record<string, any>; 消す?: boolean } }>("/api/tokutei/save", async (req, reply) => {
    if (!合言葉が合う(req.body.合言葉)) return reply.code(403).send({ error: "編集できる状態ではありません" });
    const r = req.body.行;
    if (req.body.消す) {
      await q(`DELETE FROM ${受注特定項目} WHERE "ID" = $1`, [r.ID]);
      return { ok: true };
    }
    const v = [r.商品コード ?? null, r.商品名 ?? null, r.届け先コード ?? null, r.届け先 ?? null, r.備考 ?? null];
    if (r.ID) {
      await q(
        `UPDATE ${受注特定項目} SET "商品コード" = $2, "商品名" = $3, "届け先コード" = $4, "届け先" = $5, "備考" = $6 WHERE "ID" = $1`,
        [r.ID, ...v],
      );
      return { ok: true };
    }
    const [{ id }] = await q<{ id: number }>(`SELECT COALESCE(MAX("ID"), 0) + 1 AS id FROM ${受注特定項目}`);
    await q(
      `INSERT INTO ${受注特定項目} ("ID", "商品コード", "商品名", "届け先コード", "届け先", "備考", "入力時間")
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [id, ...v, 日本の今().日時],
    );
    return { ok: true };
  });
}
