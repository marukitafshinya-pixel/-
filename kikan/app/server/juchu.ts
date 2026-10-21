import type { FastifyInstance } from "fastify";
import { pool, q, t, 日本の今 } from "./db.js";
import { requireUser } from "./auth.js";
import { 受注検索のExcel } from "./excel.js";

// Access の受注登録で使っている表の置き場所
const 受注 = t("juchu", "TD_受注");
const 受注先マスタ = t("juchu_fe", "TM_受注先マスタ");
const 得意先マスタ = t("juchu_fe", "TM_得意先マスタ");
const 商品マスタ = t("juchu_fe", "TM_商品マスタ");
const 受注特定項目 = t("juchu_fe", "TM_受注特定項目");

/** 受注検索の表で、押して付け外しできるチェック */
const 付け外しできる項目 = new Set([
  "完了消込", "入力確認チェック", "受注返信FAX", "受注手配確認", "受注出庫確認", "出庫返信FAX確認",
  "輸送手配返信確認", "受領書確認", "伝票作成", "伝票送付", "伝票FAX", "送品案内",
]);

/**
 * 受注先選択画面で行を選んだときに開く入力画面。
 * Access では取引先ごとに別の画面（日本食研・丸大・SB食品・和弘食品・ふらのソース）を開いていたが、
 * Web 版では「受注登録（届け先指定）」の画面にまとめる（2026/10/20 利用者の決定）。
 */
export function 入力画面(_row: { 受注先ID: number; 取引先ID: number; 取扱い区分: number | null }): string {
  return "FM_受注登録_届け先指定";
}

// 「その他」＝受注元のボタンに載っていない受注元（本社受注は「大阪」に入るので除く）
const その他の受注元 = `j."本社受注" = false AND j."受注元ID" NOT IN
  (SELECT "値" FROM app."受注検索_受注元ボタン" WHERE "値" > 0 AND "値" <> 629)`;

function like(v: string): string {
  // Access の Like（* と ?）を PostgreSQL の LIKE に読み替える。記号がなければ完全一致と同じになる。
  return v.replace(/[%_\\]/g, (c) => "\\" + c).replace(/\*/g, "%").replace(/\?/g, "_");
}

/** 受注検索の条件（画面の検索と Excel 出力で同じものを使う） */
function 検索条件(p: Record<string, string | undefined>) {
  const where: string[] = [`j.chk = false`];
  const args: unknown[] = [];
  const add = (cond: string, v: unknown) => {
    args.push(v);
    where.push(cond.replace("?", `$${args.length}`));
  };

  if (p.mode === "today") {
    add(`j."入力日"::date = ?::date`, 日本の今().日付);
  } else if (p.mode === "cancel") {
    where.push(`j."枝番1" = '03' AND COALESCE(j."完了消込", false) = false`);
  } else {
    if (p.moto !== undefined && p.moto !== "") {
      const moto = Number(p.moto);
      if (moto === -2) where.push(`${その他の受注元}`);
      else if (moto === -1) where.push(`j."入庫名義ID" <> 1`);
      else if (moto === 0) where.push(`j."受注元ID" <> 0`);
      else if (moto === 629) where.push(`j."本社受注" = true`);
      else add(`j."受注元ID" = ?`, moto);
    }
    if (p.from && p.to) {
      add(`j."納品日" >= ?::date`, p.from);
      add(`j."納品日" < (?::date + 1)`, p.to);
    }
    if (p.saki) add(`j."受注先ID" = ?`, Number(p.saki));
    if (p.jid) add(`j."受注ID"::text LIKE ?`, like(p.jid));
    else if (p.bango) add(`j."受注番号" LIKE ?`, like(p.bango));
    if (p.toitsu) add(`j."統一受注ID" LIKE ?`, like(p.toitsu));
    if (p.shohin)
      add(`s."グループ商品コード" = (SELECT "グループ商品コード" FROM ${商品マスタ} WHERE "商品コード" = ?)`, Number(p.shohin));
  }

  return { where: where.join(" AND "), args };
}

export function juchuRoutes(app: FastifyInstance) {
  app.addHook("preHandler", requireUser);

  // 受注グループ（取引先）のボタン（Q_受注グループマスタ）
  app.get<{ Querystring: { honsha?: string } }>("/api/juchu/groups", async (req) => {
    const honsha = req.query.honsha === "1";
    return q(
      `SELECT "取引先ID", MIN("取引先名") AS "取引先名" FROM ${受注先マスタ}
       WHERE "本社受注" = $1
       GROUP BY "取引先ID" ORDER BY "取引先ID" DESC`,
      [honsha],
    );
  });

  // 受注先の一覧（Q_受注先グループマスタ）
  app.get<{ Querystring: { torihiki: string; honsha?: string } }>("/api/juchu/saki", async (req) => {
    const rows = await q<any>(
      `SELECT MIN("ID") AS "ID", "受注先ID", "受注先名", "取引先ID", "取引先名", "本社受注", "取扱い区分", "使用不可"
       FROM ${受注先マスタ}
       WHERE COALESCE("使用不可", false) = false AND "取引先ID" = $1 AND "本社受注" = $2
       GROUP BY "受注先ID", "受注先名", "取引先ID", "取引先名", "本社受注", "取扱い区分", "使用不可"
       ORDER BY "受注先ID"`,
      [Number(req.query.torihiki), req.query.honsha === "1"],
    );
    return rows.map((r) => ({ ...r, 入力画面: 入力画面(r) }));
  });

  // 受注検索の受注元ボタン
  app.get("/api/juchu/search/moto-buttons", async () =>
    q(`SELECT "並び", "表示名", "値", "要確認" FROM app."受注検索_受注元ボタン" ORDER BY "並び"`),
  );

  // 受注元を選んだときの受注先ボタン（F_受注検索.Flm_受注元選択_AfterUpdate）
  app.get<{ Querystring: { moto: string } }>("/api/juchu/search/saki-buttons", async (req) => {
    const moto = Number(req.query.moto);
    const cond = moto === -2 ? その他の受注元 : moto === 629 ? `j."本社受注" = true` : `j."受注元ID" = $1`;
    const rows = await q<{ 受注先ID: number; 短縮名: string | null }>(
      `SELECT j."受注先ID", m."短縮名" FROM (
         SELECT DISTINCT j."受注先ID" FROM ${受注} j WHERE j."受注先ID" <> 1123 AND ${cond}
       ) j LEFT JOIN ${得意先マスタ} m ON m."短縮コード" = j."受注先ID" ORDER BY j."受注先ID"`,
      moto === -2 || moto === 629 ? [] : [moto],
    );
    // 日本食研は短縮名の先頭 4 文字を省いて表示する（Access と同じ）
    return rows.map((r) => ({ 受注先ID: r.受注先ID, 表示名: moto === 360 ? (r.短縮名 ?? "").slice(4) : r.短縮名 ?? "" }));
  });

  // 受注検索（F_受注検索）
  app.get<{ Querystring: Record<string, string | undefined> }>("/api/juchu/search", async (req) => {
    const p = req.query;
    const { where, args } = 検索条件(p);
    const order =
      p.sort === "shohin" ? `j."商品コード", j."納品日"` : `j."納品日", j."取引元ID", j."届け先コード", j."受注ID"`;
    const rows = await q(
      `SELECT j."受注ID", j."販盛売上番号", j."販盛伝票番号", j."枝番3", j."完了消込", j."受注日", j."受注番号", j."統一受注ID",
              j."枝番1", j."届け先コード", j."届け先", j."商品コード", j."商品名", j."ケース", j."商品kg", j."納品日", j."備考",
              j."入力確認チェック", j."受注返信FAX", j."受注手配確認", j."受注出庫確認", j."出庫返信FAX確認", j."輸送手配返信確認",
              j."受領書確認", j."伝票作成", j."伝票送付", j."伝票FAX", j."送品案内",
              j."出荷予定日", j."受注ユーザー名" AS "運送会社", j."手配輸送番号", j."倉庫名", j."手配出庫番号"
       FROM ${受注} j LEFT JOIN ${商品マスタ} s ON s."商品コード" = j."商品コード"
       WHERE ${where}
       ORDER BY ${order}
       LIMIT 3000`,
      args,
    );
    return rows;
  });

  // Excel に出力（F_受注検索の「出力」。Access と同じ 15 列・同じ見た目で、受注ID の順）
  app.get<{ Querystring: Record<string, string | undefined> }>("/api/juchu/search/export", async (req, reply) => {
    const { where, args } = 検索条件(req.query);
    const rows = await q(
      `SELECT j."受注ID", j."受注日", j."受注番号", j."受注元ID", j."受注元名", j."届け先コード", j."届け先",
              j."商品コード", j."商品名", j."ケース", j."商品kg", j."納品日", j."出荷予定日", j."倉庫名", j."受注ユーザー名" AS "運送会社名"
       FROM ${受注} j LEFT JOIN ${商品マスタ} s ON s."商品コード" = j."商品コード"
       WHERE ${where} ORDER BY j."受注ID"`,
      args,
    );
    const buf = await 受注検索のExcel(rows);
    reply
      .header("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
      .header("Content-Disposition", `attachment; filename*=UTF-8''${encodeURIComponent("受注検索.xlsx")}`);
    return reply.send(buf);
  });

  // 商品の選択肢（商品で検索）
  app.get("/api/master/shohin", async () =>
    q(`SELECT "商品コード", "商品名" FROM ${商品マスタ} WHERE COALESCE("使用中止", false) = false ORDER BY "商品コード"`),
  );

  // 受注オートチェック（Access のメニューで受注検索を開くときに動く C_受注オートチェック・C_受注オートチェック名変）
  // 倉庫管理の出庫（輸送計画）と名義変更から、受注の倉庫・出荷予定日・運送会社などを写す
  app.post("/api/juchu/search/autocheck", async () => {
    const 今日 = 日本の今().日付;
    // 1. 営業冷蔵庫の出庫分（Q_受注進行状況取得：5 日前より後の出荷。受注ID ごとに最初の 1 件）
    const r1 = await q(
      `WITH k AS (
         SELECT DISTINCT ON (d."受注ID") d."受注ID", y.*
         FROM ${t("soko", "TD_輸送計画")} y LEFT JOIN ${t("soko", "TD_出荷")} d ON y."輸送ID" = d."輸送ID"
         WHERE d."受注ID" <> 0 AND d."出荷日" > $1::date - 5
         ORDER BY d."受注ID", y."輸送ID", d.ctid
       )
       UPDATE ${受注} j SET "倉庫ID" = k."出庫場所ID", "倉庫名" = k."出庫場所", "手配出庫番号" = k."運行指令No",
         "手配輸送番号" = k."web輸送送り状No", "出荷予定日" = k."出荷計画日", "受注ユーザーID" = k."運送会社ID",
         "受注ユーザー名" = k."運送会社名", "月間No" = k."輸送ID"
       FROM k WHERE k."受注ID" = j."受注ID" AND j."納品日" > $1::date - 2
       RETURNING j."受注ID"`,
      [今日],
    );
    // 2. 名義変更分（Q_受注進行状況取得_名変：5 日前より後の変更。受注ID ごとに最初の 1 件）
    const r2 = await q(
      `WITH k AS (
         SELECT DISTINCT ON (h."受注ID") h.* FROM ${t("soko", "TD_在庫変更")} h
         WHERE h."変更日" > $1::date - 5 ORDER BY h."受注ID", h.ctid
       )
       UPDATE ${受注} j SET "倉庫ID" = k."保管庫ID", "倉庫名" = k."保管庫名", "受注ユーザー名" = '名  変', "出荷予定日" = k."変更日"
       FROM k WHERE k."受注ID" = j."受注ID" AND j."納品日" > $1::date - 2
       RETURNING j."受注ID"`,
      [今日],
    );
    return { 出庫: r1.length, 名変: r2.length };
  });

  // チェックの付け外し（F_受注検索の表のチェック。押すとすぐ保存される）
  app.post<{ Body: { 受注ID: number; 項目: string; 値: boolean } }>("/api/juchu/search/check", async (req, reply) => {
    const { 受注ID, 項目, 値 } = req.body ?? ({} as any);
    if (!付け外しできる項目.has(項目)) return reply.code(400).send({ error: "この項目は変えられません" });
    const c = await pool.connect();
    try {
      await c.query("BEGIN");
      const r = await c.query(`UPDATE ${受注} SET "${項目}" = $2 WHERE "受注ID" = $1 RETURNING "商品コード", "届け先コード"`, [
        Number(受注ID),
        !!値,
      ]);
      if (r.rowCount === 0) throw Object.assign(new Error("この受注はありません"), { status: 404 });
      if (項目 === "入力確認チェック") {
        // Access と同じく、付けても外しても：受注特定項目の備考があれば備考の前に足し、初回登録chk・入力日（今日）を入れる
        const { 商品コード, 届け先コード } = r.rows[0];
        const m = await c.query(`SELECT "備考" FROM ${受注特定項目} WHERE "商品コード" = $1 AND "届け先コード" = $2 LIMIT 1`, [
          商品コード,
          届け先コード,
        ]);
        const 足す = m.rows[0]?.備考 ?? "";
        await c.query(
          `UPDATE ${受注} SET "備考" = CASE WHEN $2 <> '' THEN $2 || ' ' || COALESCE("備考", '') ELSE "備考" END,
             "初回登録chk" = true, "入力日" = $3 WHERE "受注ID" = $1`,
          [Number(受注ID), 足す, 日本の今().日付],
        );
      }
      await c.query("COMMIT");
      const [row] = await q(`SELECT "受注ID", "${項目}", "備考", "入力日" FROM ${受注} WHERE "受注ID" = $1`, [Number(受注ID)]);
      return row;
    } catch (e: any) {
      await c.query("ROLLBACK");
      return reply.code(e.status ?? 500).send({ error: e.status ? e.message : "保存できませんでした：" + e.message });
    } finally {
      c.release();
    }
  });
}
