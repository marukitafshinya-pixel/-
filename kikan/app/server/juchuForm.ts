import type { FastifyInstance } from "fastify";
import { pool, q, t, 日本の今 } from "./db.js";
import { requireUser } from "./auth.js";

// 受注の入力画面（Access の FM_受注登録_届け先指定）で使う表
const 受注 = t("juchu", "TD_受注");
const 受注先マスタ = t("juchu_fe", "TM_受注先マスタ");
const 得意先マスタ = t("kyotsu", "TM_得意先マスタ");
const 商品マスタ = t("kyotsu", "TM_商品マスタ");
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
 * 初回登録chk は「入力確認」を押したときに入るもので、初めは入らない。
 */
export const 新規の既定値: Record<string, unknown> = {
  残kg: 0, 請求先コード: 0, 支払区分: 0, 受注区分: 0, 手配元ID: 0, 手配帳合ID: 0,
  丸北出荷数: 0, 倉庫出荷数: 0, 転売出荷数: 0, 年間受注ID: 0, 月間カウンタ: 0, 月間No: 0,
  運賃振分区分: 0, 変更前ケース: 0, 変更前商品kg: 0, 指定最終届け先コード: 0,
  chk: false, 手配DataChk: false, 入力確認チェック: false, 受注手配確認: false, 受注出庫確認: false,
  出庫返信FAX確認: false, 輸送手配返信確認: false, 受領書確認: false, 受注返信FAX: false,
  賞味期限送信: false, 送品案内: false, 出力用chk: false, 伝票作成: false, 伝票送付: false,
  伝票FAX: false, 完了消込: false, 少量残連絡chk: false, 蔵前区分: false, OneDriveChk: false,
  初回登録chk: false, 入庫名義ID: 1, 受注グループID: 0, ケース1: 0, 商品kg1: 0, 残ケース: 0, 本社受注: false,
  商品コード1: 0, 届け先コード1: 0,
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
  // 取引先ごとの画面をこの画面にまとめたため、ここに無い受注先（日本食研の一部など）は、
  // その受注先で今までに受けた届け先（多い順）を出す
  app.get<{ Querystring: { moto: string; saki: string } }>("/api/juchu/form/todoke", async (req) => {
    const rows = await q(
      `SELECT "届け先コード", "届け先" FROM ${名義条件}
       WHERE "取引先グループID" = $1 AND "受注先ID" = $2
       GROUP BY "届け先コード", "届け先" ORDER BY "届け先コード"`,
      [Number(req.query.moto), Number(req.query.saki)],
    );
    if (rows.length) return rows;
    return q(
      `SELECT "届け先コード", MIN("届け先") AS "届け先" FROM ${受注}
       WHERE "受注先ID" = $1 AND "届け先コード" IS NOT NULL
       GROUP BY "届け先コード" ORDER BY COUNT(*) DESC, "届け先コード"`,
      [Number(req.query.saki)],
    );
  });

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

  // ---------------- 受注訂正（Access の FM_受注訂正） ----------------

  // 処理コードの選択肢（TM_枝処理マスタ）
  app.get("/api/juchu/form/shori-list", async () =>
    q(`SELECT "枝番", "枝処理名" FROM ${t("juchu_fe", "TM_枝処理マスタ")} ORDER BY "枝番"`),
  );

  // 処理コード（受注検索の「処理コード」＝枝番1）を変える。1〜3 なら画面で受注訂正を開く
  app.post<{ Body: { 受注ID: number; 値: string | null } }>("/api/juchu/form/shori", async (req, reply) => {
    const r = await q(`UPDATE ${受注} SET "枝番1" = $2 WHERE "受注ID" = $1 RETURNING "受注ID"`, [
      Number(req.body.受注ID),
      req.body.値 === "" ? null : req.body.値,
    ]);
    if (!r.length) return reply.code(404).send({ error: "この受注はありません" });
    return { ok: true };
  });

  // 訂正を確定する（Access の「閉じる」ボタン。変えていなくても、押すと訂正として記録される）
  app.post<{ Params: { jid: string }; Body: Record<string, any> }>("/api/juchu/form/teisei/:jid", async (req, reply) => {
    const jid = Number(req.params.jid);
    const t = req.body ?? {};
    const c = await pool.connect();
    try {
      await c.query("BEGIN");
      const { rows } = await c.query(`SELECT * FROM ${受注} WHERE "受注ID" = $1 FOR UPDATE`, [jid]);
      const cur = rows[0];
      if (!cur) throw Object.assign(new Error("この受注はありません"), { status: 404 });
      const 名前 = async (code: unknown) => {
        if (code === null || code === undefined || code === "") return "";
        const r = await c.query(`SELECT "短縮名" FROM ${得意先マスタ} WHERE "短縮コード" = $1 LIMIT 1`, [Number(code)]);
        return r.rows[0]?.短縮名 ?? "";
      };

      // どこを直したか（Access と同じく、違いが見つかるたびに上書きするので、最後の 1 つだけが残る）
      let 箇所 = "";
      const 違う = (a: unknown, b: unknown) => !空(a) && !空(b) && 比べ用(a) !== 比べ用(b);
      if (違う(t.受注元ID, cur.受注元ID)) 箇所 = `受注元 ${文字(cur.受注元名)} → ${await 名前(t.受注元ID)}`;
      if (違う(t.受注先ID, cur.受注先ID)) 箇所 = `受注先  → ${await 名前(t.受注先ID)}`;
      if (違う(t.統一受注ID, cur.統一受注ID)) 箇所 = `年間ID ${文字(t.統一受注ID)} → ${文字(cur.統一受注ID)}`;
      if (違う(t.受注番号, cur.受注番号)) 箇所 = `受注No${文字(cur.受注番号)} → ${文字(t.受注番号)}`;
      if (違う(t.商品コード, cur.商品コード)) 箇所 = `商品コード${文字(cur.商品コード)} → ${文字(t.商品コード)}`;
      if (違う(t.商品名, cur.商品名)) 箇所 = `商品名${文字(cur.商品名)} → ${文字(t.商品名)}`;
      if (違う(t.ケース, cur.ケース)) 箇所 = `ケース${文字(cur.ケース)} → ${文字(t.ケース)}`;
      if (違う(t.商品kg, cur.商品kg)) 箇所 = `商品kg${文字(cur.商品kg)} → ${文字(t.商品kg)}`;
      if (違う(t.届け先コード, cur.届け先コード)) 箇所 = `届け先コード${文字(cur.届け先コード)} → ${文字(t.届け先コード)}`;
      if (違う(t.届け先, cur.届け先)) 箇所 = `届け先${文字(cur.届け先)} → ${文字(t.届け先)}`;
      if (違う(t.納品日, cur.納品日)) 箇所 = `納品日${日付(cur.納品日)} → ${日付(t.納品日)}`;
      if (違う(t.送り状No, cur.送り状No)) 箇所 = `送り状No${文字(cur.送り状No)} → ${文字(t.送り状No)}`;
      if (違う(t.隠語, cur.隠語)) 箇所 = `隠語${文字(cur.隠語)} → ${文字(t.隠語)}`;
      if (違う(t.蔵前区分, cur.蔵前区分)) 箇所 = `引き取り区分${真偽(cur.蔵前区分)} → ${真偽(t.蔵前区分)}`;

      // 書き込む値（Access と同じく、訂正の欄の値をそのまま入れる）
      const 値: Record<string, unknown> = {
        受注日: 空(t.発注日) ? null : t.発注日,
        受注元ID: 数(t.受注元ID), 受注元名: 空(t.受注元名) ? null : t.受注元名,
        受注先ID: 数(t.受注先ID), 受注先名: 空(t.受注先名) ? null : t.受注先名,
        統一受注ID: 空(t.統一受注ID) ? null : t.統一受注ID,
        受注番号: 空(t.受注番号) ? null : t.受注番号,
        商品コード: 数(t.商品コード), 商品名: 空(t.商品名) ? null : t.商品名,
        ケース: 数(t.ケース), 商品kg: 数(t.商品kg),
        届け先コード: 数(t.届け先コード), 届け先: 空(t.届け先) ? null : t.届け先,
        納品日: 空(t.納品日) ? null : t.納品日,
        送り状No: 空(t.送り状No) ? null : t.送り状No,
        // 隠語は、Access では訂正のたびに消えていたが、残すことにした（2026/10/20 利用者確認）。画面で書き換えたときだけ変える
        隠語: "隠語" in t ? (空(t.隠語) ? null : t.隠語) : cur.隠語,
      };
      // 引き取り区分は、空欄のときは Access でも書き込めずに今のまま
      if (!空(t.蔵前区分)) 値.蔵前区分 = !!t.蔵前区分;
      const 備考を足す = 箇所 + "に訂正 ";

      const 書く = async (table: string, extra: Record<string, unknown>, firstOnly: boolean) => {
        const v = { ...値, ...extra };
        const cols = Object.keys(v);
        const set = cols.map((k, i) => `"${k}" = $${i + 2}`).join(", ");
        const where = firstOnly
          ? `ctid = (SELECT ctid FROM ${table} WHERE "受注ID" = $1 LIMIT 1)`
          : `"受注ID" = $1`;
        await c.query(
          `UPDATE ${table} SET ${set}, "備考" = $${cols.length + 2} || COALESCE("備考", '') WHERE ${where}`,
          [jid, ...cols.map((k) => v[k]), 備考を足す],
        );
      };
      const 知らせる = async (table: string) => {
        const r = await c.query(
          `UPDATE ${table} SET "計画変更chk" = true, "通知" = '受注訂正', "変更通知" = $2 WHERE chk = false AND "受注ID" = $1`,
          [jid, 箇所],
        );
        return r.rowCount ?? 0;
      };
      const ある = async (schema: string, table: string) =>
        (await c.query(`SELECT to_regclass($1) AS r`, [`"${schema}"."${table}"`])).rows[0].r !== null;

      // 1. この受注
      await 書く(受注, {}, false);
      let 件数 = 0;
      const 写し: Record<string, unknown> = { 入数: 数(t.入数) };
      // 2. 倉庫管理の受注の写しと、出庫に知らせ
      if (await ある("soko", "TD_受注")) await 書く(表名("soko", "TD_受注"), 写し, true);
      if (await ある("soko", "TD_出荷")) 件数 += await 知らせる(表名("soko", "TD_出荷"));
      // 3. 転売品管理の受注の写しと、出荷に知らせ
      if (await ある("tenbai", "TD_受注")) await 書く(表名("tenbai", "TD_受注"), 写し, true);
      if (await ある("tenbai", "TD_出荷")) 件数 += await 知らせる(表名("tenbai", "TD_出荷"));
      // 4. WorkStation の受注の写しと、出荷に知らせ
      if (await ある("ws", "TD_受注")) await 書く(表名("ws", "TD_受注"), 写し, true);
      if (await ある("ws", "TD_出荷")) 件数 += await 知らせる(表名("ws", "TD_出荷"));

      await c.query("COMMIT");
      return { 通知件数: 件数, 訂正箇所: 箇所 };
    } catch (e: any) {
      await c.query("ROLLBACK");
      return reply.code(e.status ?? 500).send({ error: e.status ? e.message : "訂正できませんでした：" + e.message });
    } finally {
      c.release();
    }
  });
}

// 処理の中では t を訂正の値に使っているので、表の名前を作る関数は別の名前で呼ぶ
const 表名 = t;
function 空(v: unknown): boolean {
  return v === null || v === undefined || v === "";
}
function 数(v: unknown): number | null {
  return 空(v) ? null : Number(v);
}
/** 日付は日だけで比べる（"2026-10-28 00:00:00" と "2026-10-28" を同じにする） */
function 比べ用(v: unknown): string {
  const s = String(v).replace(/^(\d{4}-\d{2}-\d{2})T/, "$1 ");
  return /^\d{4}-\d{2}-\d{2}( 00:00:00)?$/.test(s) ? s.slice(0, 10) : typeof v === "number" ? String(v) : s;
}
function 文字(v: unknown): string {
  return v === null || v === undefined ? "" : String(v);
}
/** Access の日付を文字にしたときの形（2025/07/05） */
function 日付(v: unknown): string {
  if (空(v)) return "";
  const s = String(v).replace(/^(\d{4}-\d{2}-\d{2})T/, "$1 ");
  return s.endsWith(" 00:00:00") || s.length === 10 ? s.slice(0, 10).replace(/-/g, "/") : s.replace(/-/g, "/");
}
function 真偽(v: unknown): string {
  return 空(v) ? "" : v ? "True" : "False";
}
