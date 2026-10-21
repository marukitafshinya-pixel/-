import type { FastifyInstance } from "fastify";
import type { PoolClient } from "pg";
import { pool, t, 日本の今 } from "./db.js";
import { requireUser } from "./auth.js";
import { 一連で } from "./ws.js";

// 丸北WorkStation の出荷関連報告書印刷（Access の FSD_出荷報告印刷）と、そのもとの表
// 入庫依頼書確認用（T_入庫依頼書確認用・C_入庫依頼書確認用）。
// 出荷明細票の「入庫案内・出荷・送品案内」から開く。届け先・名義・納品日ごとに、入庫依頼書などを送ったかの印を付ける。
const 輸送計画 = t("ws", "TD_輸送計画");
const 出荷 = t("ws", "TD_出荷");
const 確認用 = t("ws_fe", "T_入庫依頼書確認用");
const 得意先マスタ = t("kyotsu", "TM_得意先マスタ");

type Rec = Record<string, any>;
const n = (v: unknown) => Number(v ?? 0) || 0;

function 日を足す(d: string, k: number): string {
  return new Date(Date.parse(d.slice(0, 10) + "T00:00:00Z") + k * 86400000).toISOString().slice(0, 10);
}

// 倉庫の名義（この名義なら届け先が倉庫でも「倉庫」、ほかは「ユーザー」）。丸北北海道・ふらの・大阪丸北 など（Access と同じ）
const 倉庫の名義 = [11, 150, 629, 658, 1267];
// 届け先ごとに帳票を切り替える（Access の 2021/11/11 の追記）
const 日洋専用 = [273, 297];
// 扱い区分の名前は Access のデータのまま（帳票に出る）
const 扱いの名前: Record<number, string> = { 11: "丸北  北海道", 12: "㈱ 丸 北 ", 629: " 大阪" };

/**
 * Access の QS_入庫依頼書確認用：便・届け先・名義・納品日ごとの出荷の合計。
 * リンクコード1 は「輸送ID\届け先\名義\納品日の通し番号」。積込完了件数は Access と同じく積込確認の数のマイナス（真が -1 のため）
 */
async function 出荷のまとめ(c: PoolClient, 今日: string) {
  return (
    await c.query(
      `SELECT p."出荷計画日", s."届け先コード", s."届け先", s."入庫後名義ID", p."運送会社ID", p."運送会社名", p."車番", s."輸送ID", p."冷凍区分ID",
         SUM(s."商品kg") AS "商品kgの合計", s."納品日",
         s."輸送ID" || '\\' || s."届け先コード" || '\\' || COALESCE(s."入庫後名義ID"::text, '') || '\\' || (s."納品日"::date - DATE '1899-12-30') AS "リンクコード1",
         -COUNT(*) FILTER (WHERE s."積込確認") AS "積込完了件数", COUNT(s."出庫ID") AS "出荷件数"
       FROM ${輸送計画} p JOIN ${出荷} s ON s."輸送ID" = p."輸送ID"
       WHERE s."届け先コード" <> 0 AND p."出荷計画日" >= $1::date - 15 AND s."納品日" IS NOT NULL
       GROUP BY p."出荷計画日", s."届け先コード", s."届け先", s."入庫後名義ID", p."運送会社ID", p."運送会社名", p."車番", s."輸送ID", p."冷凍区分ID", s."納品日"
       ORDER BY p."出荷計画日", s."届け先コード", s."入庫後名義ID"`,
      [今日],
    )
  ).rows;
}

/** 入庫依頼書確認用を作り直す（Access の C_入庫依頼書確認用。画面を開いたときに動く） */
export async function 確認用を作り直す(c: PoolClient) {
  const 今日 = 日本の今().日付;
  await c.query(`SELECT pg_advisory_xact_lock(hashtext('T_入庫依頼書確認用'))`);
  await c.query(`DELETE FROM ${確認用} WHERE "出荷計画日" <= $1::date`, [日を足す(今日, -30)]);
  const まとめ = await 出荷のまとめ(c, 今日);
  const 得意先 = new Map<number, Rec>();
  const 得意先を見る = async (code: unknown) => {
    const k = n(code);
    if (!得意先.has(k))
      得意先.set(
        k,
        (await c.query(`SELECT "得意先名", "地区コード", "倉庫区分", "入庫区分" FROM ${得意先マスタ} WHERE "短縮コード" = $1 LIMIT 1`, [k])).rows[0] ?? {},
      );
    return 得意先.get(k)!;
  };
  let next = n((await c.query(`SELECT COALESCE(MAX("ID"), 0) + 1 AS n FROM ${確認用}`)).rows[0].n);

  // 1. この 7 日の出荷のまとめを写す（あれば変わったところに印、なければ足す）
  for (const q of まとめ.filter((x) => String(x.出荷計画日).slice(0, 10) > 日を足す(今日, -7))) {
    const kg = q.商品kgの合計 === null ? null : Number(q.商品kgの合計);
    const r: Rec | undefined = (await c.query(`SELECT * FROM ${確認用} WHERE "リンクコード1" = $1 ORDER BY "ID" LIMIT 1`, [q.リンクコード1])).rows[0];
    const v: Rec = r ? { ...r } : { ID: next++, 通知: null, 未データchk: false, 入庫依頼書送付chk: false, 運賃振分区分: null };
    let 変更 = 0;
    if (r) {
      if (r.商品kg !== null && kg !== null && Number(r.商品kg) !== kg) {
        変更++;
        v.通知 = "KG変更";
      }
      if (r.車番 !== null && q.車番 !== null && r.車番 !== q.車番) {
        変更++;
        v.通知 = `${v.通知 ?? ""}\r\n車番変更`;
      }
      // 出荷が登録し直されたとき
      if (r.未データchk) {
        変更++;
        v.未データchk = false;
      }
      if (r.納品日 && String(r.納品日).slice(0, 10) === 今日) v.入庫済みchk = true;
    }
    if (変更 && v.入庫依頼書送付chk) v.変更chk = true;
    const 届け先 = await 得意先を見る(q.届け先コード);
    Object.assign(v, {
      出荷計画日: q.出荷計画日, 納品日: q.納品日, 入庫後名義ID: q.入庫後名義ID, 届け先コード: q.届け先コード, 届け先: q.届け先,
      地区コード: 届け先.地区コード ?? null, 倉庫区分: 届け先.倉庫区分 ?? null, 商品kg: kg, リンクコード1: q.リンクコード1, 輸送ID: q.輸送ID,
      運送会社ID: q.運送会社ID, 運送会社名: q.運送会社名, 車番: q.車番, 冷凍区分ID: q.冷凍区分ID,
      積込完了件数: n(q.積込完了件数), 出荷件数: n(q.出荷件数), 入庫区分: 届け先.入庫区分 ?? null,
    });
    // 全部積込確認したら完了（Access と同じく、あとで外しても完了のまま）
    if (v.積込完了件数 + v.出荷件数 === 0) v.積込完了chk = true;
    // 届け先が倉庫でも、名義が丸北北海道・ふらの・大阪丸北 など以外は「ユーザー」
    v.ユーザー区分名 = v.倉庫区分 === true && 倉庫の名義.includes(n(q.入庫後名義ID)) ? "倉庫" : "ユーザー";
    // 扱い区分（Access は運賃振分区分を写していないので、いつも大阪になる。そのまま）
    v.扱い区分 = n(v.運賃振分区分) === 1 ? (v.ユーザー区分名 === "倉庫" ? 11 : 12) : 629;
    v.扱い区分名 = 扱いの名前[v.扱い区分];
    // Access は空の文字を入れるが、写したデータでは空（null）になっているので、それに合わせる
    v.入庫後名義名 = v.ユーザー区分名 === "倉庫" ? ((await 得意先を見る(q.入庫後名義ID)).得意先名 ?? null) : null;
    v.特殊レポート名 = 日洋専用.includes(n(v.届け先コード)) ? "R_日洋専用出荷通知書" : null;
    const keys = Object.keys(v);
    if (r)
      await c.query(`UPDATE ${確認用} SET ${keys.map((k, i) => `"${k}" = $${i + 2}`).join(", ")} WHERE "ID" = $1`, [r.ID, ...keys.map((k) => v[k])]);
    else
      await c.query(
        `INSERT INTO ${確認用} (${keys.map((k) => `"${k}"`).join(", ")}) VALUES (${keys.map((_, i) => `$${i + 1}`).join(", ")})`,
        keys.map((k) => v[k]),
      );
  }

  // 2. 出荷がなくなったもの（便・届け先・名義・納品日が変わったものも）：FAX を送っていれば印を付けて残し、送っていなければ消す
  const ある = new Set(まとめ.map((x) => String(x.リンクコード1)));
  const rows = (await c.query(`SELECT "ID", "リンクコード1", "入庫依頼書送付chk", "通知" FROM ${確認用} WHERE "入庫済みchk" = false AND "未データchk" = false`)).rows;
  for (const r of rows) {
    if (ある.has(String(r.リンクコード1))) continue;
    if (r.入庫依頼書送付chk)
      await c.query(`UPDATE ${確認用} SET "変更chk" = true, "未データchk" = true, "通知" = $2 WHERE "ID" = $1`, [r.ID, `削除\r\n${r.通知 ?? ""}`]);
    else await c.query(`DELETE FROM ${確認用} WHERE "ID" = $1`, [r.ID]);
  }
}

// 帳票の選び方ごとの絞り込み（Access の C_Myフィルタ）
const 帳票の条件: Record<number, string> = {
  1: `"ユーザー区分名" = '倉庫' AND "入庫区分" = true`,
  2: `"ユーザー区分名" = 'ユーザー' AND "入庫区分" = true`,
  3: `"ユーザー区分名" = '倉庫'`,
  4: `"ユーザー区分名" = 'ユーザー'`,
};
// 画面で付け外しできる印
const 印の項目 = ["抽出区分", "仮入庫通知", "入庫依頼書確認chk", "仮FAX", "入庫依頼書送付chk", "送品案内書確認chk", "送品案内送付chk"];

export function wsHoukokuRoutes(app: FastifyInstance) {
  app.addHook("preHandler", requireUser);

  // 開いたとき：表を作り直す
  app.post("/api/ws/houkoku/open", async () =>
    一連で(async (c) => {
      await 確認用を作り直す(c);
      return { ok: true };
    }),
  );

  // 閉じたとき・帳票の選び方を変えたとき：選択の印を全部外す（Access の My帳票chk）
  app.post("/api/ws/houkoku/clear", async () => {
    await pool.query(`UPDATE ${確認用} SET "抽出区分" = false WHERE "抽出区分" = true`);
    return { ok: true };
  });

  // その日の便（運送会社選択）
  app.get<{ Querystring: { date: string } }>("/api/ws/houkoku/bin", async (req) =>
    (
      await pool.query(`SELECT "輸送ID", "運送会社名", "車番", "chk" FROM ${輸送計画} WHERE "出荷計画日" = $1::date ORDER BY "出荷計画日", "輸送ID"`, [
        req.query.date,
      ])
    ).rows,
  );

  // 一覧（Access のフォームのもと：届け先 11 は出さない）
  app.get<{ Querystring: { date: string; yuso?: string; kind?: string } }>("/api/ws/houkoku/list", async (req) => {
    const w = [`"届け先コード" <> 11`, `"出荷計画日" = $1::date`];
    const args: unknown[] = [req.query.date];
    if (n(req.query.yuso)) {
      args.push(n(req.query.yuso));
      w.push(`"輸送ID" = $2`);
    }
    const k = 帳票の条件[n(req.query.kind)];
    if (k) w.push(k);
    return (
      await pool.query(
        `SELECT * FROM ${確認用} WHERE ${w.join(" AND ")} ORDER BY "輸送ID", "ユーザー区分名", "届け先コード", "入庫後名義ID"`,
        args,
      )
    ).rows;
  });

  // 印を付け外す。選択は、入庫依頼書・出荷案内書のときは積込完了していないと付けられない（Access の 抽出区分_Click）
  app.post<{ Body: { ID: number; 項目: string; 値: boolean; kind?: number } }>("/api/ws/houkoku/chk", async (req, reply) => {
    const { ID, 項目, 値 } = req.body;
    if (!印の項目.includes(項目)) return reply.code(400).send({ error: "この項目は変えられません。" });
    const r = (await pool.query(`SELECT "積込完了chk" FROM ${確認用} WHERE "ID" = $1`, [n(ID)])).rows[0];
    if (!r) return reply.code(404).send({ error: "この行はありません。" });
    if (項目 === "抽出区分" && 値 && n(req.body.kind) <= 2 && !r.積込完了chk)
      return reply.code(400).send({ error: "積込完了していません。完了後、印刷可能です" });
    await pool.query(`UPDATE ${確認用} SET "${項目}" = $2 WHERE "ID" = $1`, [n(ID), !!値]);
    return { ok: true };
  });
}
