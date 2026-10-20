import type { FastifyInstance } from "fastify";
import { pool, q, t, 日本の今 } from "./db.js";
import { requireUser } from "./auth.js";

// 受注の入力画面（Access の FM_受注登録_届け先指定）で使う表
const 受注 = t("juchu", "TD_受注");
const 受注先マスタ = t("juchu_fe", "TM_受注先マスタ");
const 得意先マスタ = t("juchu_fe", "TM_得意先マスタ");
const 商品マスタ = t("juchu_fe", "TM_商品マスタ");
const 名義条件 = t("juchu_fe", "TM_入庫先商品別名義条件");

/** 画面から書き込んでよい項目（これ以外は受け付けない） */
const 書ける項目 = [
  "受注日", "受注番号", "受注番号1", "受注元ID", "受注元名", "取引元ID", "取引元",
  "受注先ID", "受注先名", "受注帳合ID", "受注帳合名",
  "届け先コード", "届け先コード1", "届け先", "正式届け先名",
  "商品コード", "商品コード1", "商品名", "規格", "入数",
  "ケース", "ケース1", "残ケース", "商品kg", "商品kg1",
  "納品日", "納品日1", "入庫名義ID", "送り状No", "備考",
  "統一受注ID", "受注グループID", "本社受注", "蔵前区分", "chk",
] as const;

/**
 * 新しく登録するときに入る値。Access の表の「既定値」にあたるもの。
 * 今の受注データで、どの画面から入れた受注でも同じ値になっている項目を並べた。
 */
const 新規の既定値: Record<string, unknown> = {
  残kg: 0, 請求先コード: 0, 支払区分: 0, 受注区分: 0, 手配元ID: 0, 手配帳合ID: 0,
  丸北出荷数: 0, 倉庫出荷数: 0, 転売出荷数: 0, 年間受注ID: 0, 月間カウンタ: 0, 月間No: 0,
  運賃振分区分: 0, 変更前ケース: 0, 変更前商品kg: 0, 指定最終届け先コード: 0,
  chk: false, 手配DataChk: false, 入力確認チェック: false, 受注手配確認: false, 受注出庫確認: false,
  出庫返信FAX確認: false, 輸送手配返信確認: false, 受領書確認: false, 受注返信FAX: false,
  賞味期限送信: false, 送品案内: false, 出力用chk: false, 伝票作成: false, 伝票送付: false,
  伝票FAX: false, 完了消込: false, 少量残連絡chk: false, 蔵前区分: false, OneDriveChk: false,
  初回登録chk: true,
};

async function 短縮名(code: unknown): Promise<string | null> {
  if (code === null || code === undefined || code === "") return null;
  const r = await q<{ 短縮名: string }>(`SELECT "短縮名" FROM ${得意先マスタ} WHERE "短縮コード" = $1 LIMIT 1`, [Number(code)]);
  return r[0]?.短縮名 ?? null;
}

export function juchuFormRoutes(app: FastifyInstance) {
  app.addHook("preHandler", requireUser);

  // 新しく入力するときの初めの値（Form_Open。受注先選択画面で選んだ行の ID を受け取る）
  app.get<{ Params: { id: string } }>("/api/juchu/form/new/:id", async (req, reply) => {
    const id = Number(req.params.id);
    const [m] = await q<any>(`SELECT * FROM ${受注先マスタ} WHERE "ID" = $1`, [id]);
    if (!m) return reply.code(404).send({ error: "受注先マスタに見つかりません" });
    // Access と同じく、受注元には受注先マスタの「取引先ID」を入れる
    return {
      受注ID: null,
      取引元ID: m.取引先ID,
      取引元: await 短縮名(m.取引先ID),
      受注元ID: m.取引先ID,
      受注元名: await 短縮名(m.取引先ID),
      受注先ID: m.受注先ID,
      受注先名: await 短縮名(m.受注先ID),
      受注帳合ID: m.受注帳合ID,
      受注帳合名: await 短縮名(m.受注帳合ID),
      届け先コード: m.指定届け先コード,
      届け先: await 短縮名(m.指定届け先コード),
      受注グループID: id,
      本社受注: m.本社受注,
      // 画面の既定値（スクリーンショットで 0 になっているもの）
      届け先コード1: 0, 商品コード: 0, 商品コード1: 0, ケース: 0, ケース1: 0, 商品kg: 0, 商品kg1: 0, 入庫名義ID: 0,
      蔵前区分: false, chk: false,
    };
  });

  // 登録済みの受注を開く
  app.get<{ Params: { jid: string } }>("/api/juchu/form/record/:jid", async (req, reply) => {
    const [r] = await q<any>(`SELECT * FROM ${受注} WHERE "受注ID" = $1`, [Number(req.params.jid)]);
    if (!r) return reply.code(404).send({ error: "この受注はありません" });
    return r;
  });

  // 前・次の受注（Access の画面の移動ボタン。処理済み（chk）でない受注を受注ID の順に）
  app.get<{ Querystring: { from: string; dir: string } }>("/api/juchu/form/move", async (req) => {
    const from = Number(req.query.from);
    const prev = req.query.dir === "prev";
    const r = await q<{ 受注ID: number }>(
      `SELECT "受注ID" FROM ${受注} WHERE chk = false AND "受注ID" ${prev ? "<" : ">"} $1
       ORDER BY "受注ID" ${prev ? "DESC" : "ASC"} LIMIT 1`,
      [from],
    );
    return { 受注ID: r[0]?.受注ID ?? null };
  });

  // 届け先コードの選択肢（QS_受注先グループマスタVer2）
  app.get<{ Querystring: { moto: string; saki: string } }>("/api/juchu/form/todoke", async (req) =>
    q(
      `SELECT "届け先コード", "届け先" FROM ${名義条件}
       WHERE "取引先グループID" = $1 AND "受注先ID" = $2
       GROUP BY "届け先コード", "届け先" ORDER BY "届け先コード"`,
      [Number(req.query.moto), Number(req.query.saki)],
    ),
  );

  // 届け先を選んだときの値（短縮名・正式名）
  app.get<{ Params: { code: string } }>("/api/juchu/form/tokui/:code", async (req) => {
    const [r] = await q(`SELECT "短縮名", "得意先名" FROM ${得意先マスタ} WHERE "短縮コード" = $1 LIMIT 1`, [Number(req.params.code)]);
    return r ?? { 短縮名: null, 得意先名: null };
  });

  // 商品コードの選択肢
  // 届け先を選ぶ前：この受注先で今までに受けた商品（新しいコード順）
  // 届け先を選んだあと：QS_受注先別商品リスト（2019/10/1 より後の受注）
  app.get<{ Querystring: { saki: string; todoke?: string } }>("/api/juchu/form/shohin", async (req) => {
    const saki = Number(req.query.saki);
    if (req.query.todoke === undefined || req.query.todoke === "")
      return q(
        `SELECT "商品コード", "商品名" FROM ${受注} WHERE "受注先ID" = $1
         GROUP BY "商品コード", "商品名" ORDER BY MAX("商品コード") DESC`,
        [saki],
      );
    return q(
      `SELECT s."商品コード", s."商品名" FROM ${受注} j LEFT JOIN ${商品マスタ} s ON j."商品コード" = s."商品コード"
       WHERE j."受注日" > '2019-10-01' AND j."受注先ID" = $1 AND j."届け先コード" = $2
       GROUP BY s."商品コード", s."商品名" ORDER BY s."商品コード"`,
      [saki, Number(req.query.todoke)],
    );
  });

  // 商品を選んだときの値（商品名・規格・入数）
  app.get<{ Params: { code: string } }>("/api/juchu/form/shohin-info/:code", async (req) => {
    const [r] = await q(`SELECT "商品名", "規格", "入数" FROM ${商品マスタ} WHERE "商品コード" = $1 LIMIT 1`, [Number(req.params.code)]);
    return r ?? { 商品名: null, 規格: null, 入数: null };
  });

  // 入庫名義の選択肢（受注先マスタの指定入庫名義ID）
  app.get<{ Querystring: Record<string, string> }>("/api/juchu/form/meigi", async (req) => {
    const p = req.query;
    return q(
      `SELECT "指定入庫名義ID" AS "入庫名義ID", MIN("指定入庫後名義名") AS "名義名" FROM ${受注先マスタ}
       WHERE "取引先ID" = $1 AND "受注元ID" = $2 AND "指定届け先コード" = $3 AND "受注先ID" = $4
       GROUP BY "指定入庫名義ID"`,
      [Number(p.torihiki), Number(p.moto), Number(p.todoke), Number(p.saki)],
    );
  });

  // 商品を選んだときの入庫名義（TM_入庫先商品別名義条件。見つからなければ空）
  app.get<{ Querystring: Record<string, string> }>("/api/juchu/form/meigi-default", async (req) => {
    const p = req.query;
    const [r] = await q<{ 入庫名義ID: number | null }>(
      `SELECT "入庫名義ID" FROM ${名義条件}
       WHERE "取引先グループID" = $1 AND "届け先コード" = $2 AND "受注先ID" = $3 AND "商品コード" = $4 LIMIT 1`,
      [Number(p.moto), Number(p.todoke), Number(p.saki), Number(p.shohin)],
    );
    return { 入庫名義ID: r?.入庫名義ID ?? null };
  });

  // 名前で探す画面（Access の FSD_得意先選択・FSD_商品名選択）
  app.get<{ Querystring: { kind: string; w?: string } }>("/api/juchu/form/find", async (req) => {
    const w = `%${(req.query.w ?? "").trim()}%`;
    if (req.query.kind === "shohin")
      return q(
        `SELECT "商品コード" AS "コード", "商品名" AS "名前", "規格" AS "補足" FROM ${商品マスタ}
         WHERE "商品名" LIKE $1 OR "商品コード"::text LIKE $1 ORDER BY "商品コード" LIMIT 300`,
        [w],
      );
    return q(
      `SELECT "短縮コード" AS "コード", "短縮名" AS "名前", "得意先名" AS "補足" FROM ${得意先マスタ}
       WHERE "短縮名" LIKE $1 OR "得意先名" LIKE $1 OR "短縮コード"::text LIKE $1 ORDER BY "短縮コード" LIMIT 300`,
      [w],
    );
  });

  // 登録・更新（確かめは画面の側で Access と同じように行う）
  app.post<{ Body: Record<string, unknown> }>("/api/juchu/form/save", async (req, reply) => {
    const b = req.body ?? {};
    const vals: Record<string, unknown> = {};
    for (const k of 書ける項目) if (k in b) vals[k] = b[k] === "" ? null : b[k];
    const jid = b.受注ID ? Number(b.受注ID) : null;

    const c = await pool.connect();
    try {
      await c.query("BEGIN");
      if (jid) {
        const cols = Object.keys(vals);
        if (cols.length) {
          const set = cols.map((k, i) => `"${k}" = $${i + 2}`).join(", ");
          const r = await c.query(`UPDATE ${受注} SET ${set} WHERE "受注ID" = $1`, [jid, ...cols.map((k) => vals[k])]);
          if (r.rowCount === 0) throw Object.assign(new Error("この受注はありません"), { status: 404 });
        }
        await c.query("COMMIT");
        return { 受注ID: jid };
      }
      // 受注ID は Access のオートナンバーと同じく、今までの一番大きい番号の次にする
      await c.query(`SELECT pg_advisory_xact_lock(hashtext('TD_受注.受注ID'))`);
      const { rows } = await c.query(`SELECT COALESCE(MAX("受注ID"), 0) + 1 AS id FROM ${受注}`);
      const id = Number(rows[0].id);
      const now = 日本の今();
      const all: Record<string, unknown> = { ...新規の既定値, ...vals, 受注ID: id, 入力日: now.日付, 登録時間: now.日時 };
      const cols = Object.keys(all);
      await c.query(
        `INSERT INTO ${受注} (${cols.map((k) => `"${k}"`).join(", ")}) VALUES (${cols.map((_, i) => `$${i + 1}`).join(", ")})`,
        cols.map((k) => all[k]),
      );
      await c.query("COMMIT");
      return { 受注ID: id };
    } catch (e: any) {
      await c.query("ROLLBACK");
      return reply.code(e.status ?? 500).send({ error: e.status ? e.message : "登録できませんでした：" + e.message });
    } finally {
      c.release();
    }
  });

  // 削除（Access と同じく合言葉を確かめる。合言葉はサーバーの設定 JUCHU_DELETE_PASSWORD に置き、プログラムには書かない）
  app.post<{ Body: { 受注ID: number; 合言葉: string; chk?: boolean } }>("/api/juchu/form/delete", async (req, reply) => {
    const pass = process.env.JUCHU_DELETE_PASSWORD;
    if (!pass) return reply.code(400).send({ error: "削除の合言葉がサーバーに設定されていないため、削除できません。" });
    if (req.body?.合言葉 !== pass) return reply.code(403).send({ error: "パスワードが違います。" });
    const [r] = await q<{ chk: boolean }>(`SELECT chk FROM ${受注} WHERE "受注ID" = $1`, [Number(req.body.受注ID)]);
    if (!r) return reply.code(404).send({ error: "この受注はありません" });
    // 処理済み（chk。画面でチェックしただけのものも）の受注は消さずに、チェックを外せるようにするだけ（Access と同じ）
    if (r.chk || req.body.chk) return { 削除: false, chkを外せる: true };
    await q(`DELETE FROM ${受注} WHERE "受注ID" = $1`, [Number(req.body.受注ID)]);
    return { 削除: true };
  });
}
