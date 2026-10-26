import type { FastifyInstance } from "fastify";
import type { PoolClient } from "pg";
import { pool, q, t, 日本の今 } from "./db.js";
import { requireUser } from "./auth.js";
import { 一連で, 特別項目, 賞味期限計算 } from "./ws.js";
import { 倉庫の便, 倉庫の出荷, 倉庫の名変, 行を足す, 次の番号 } from "./soko.js";
import { 半月の末日 } from "./sokoMeihen.js";
import { 倉庫の在庫見込み } from "./sokoShukko.js";

// 倉庫管理System の受注検索（Access の 倉庫管理の F_受注検索・FSD_受注分在庫出力・My出庫出力）。
// 出荷明細票の［受注表示］から開く。受注の写し（soko.TD_受注）から受注を選び、出庫場所の在庫を割り付けて、この便に出庫の行を作る。
const 倉庫の受注 = t("soko", "TD_受注");
const 受注登録の受注 = t("juchu", "TD_受注"); // Access の TD_受注_受注登録
const 得意先マスタ = t("kyotsu", "TM_得意先マスタ");
const 商品マスタ = t("kyotsu", "TM_商品マスタ");
const 受注検索方法 = t("soko_fe", "TM_受注検索方法");
const 受注先マスタ = t("soko_fe", "TM_受注先マスタ");
const 名義条件 = t("soko_fe", "TM_入庫先商品別名義条件");
const 出荷場所条件 = t("soko_fe", "TM_出荷場所条件");
const ストックマスタ = t("ws", "TM_商品在庫ストックマスタ"); // Access は WorkStation から写している

type Rec = Record<string, any>;
const n = (v: unknown) => Number(v ?? 0) || 0;
const 日付 = (v: unknown) => (v ? String(v).slice(0, 10) : null);
const 日を足す = (d: string, k: number) => new Date(Date.parse(d + "T00:00:00Z") + k * 86400000).toISOString().slice(0, 10);

async function 短縮名(c: PoolClient | typeof pool, code: unknown, 列 = "短縮名"): Promise<string | null> {
  return (await c.query(`SELECT "${列}" AS v FROM ${得意先マスタ} WHERE "短縮コード" = $1 LIMIT 1`, [n(code)])).rows[0]?.v ?? null;
}

/** 受注の残ケース＝ケース −（倉庫管理の出庫 ＋ 名変 で使った数） */
async function 残ケースを出し直す(c: PoolClient | typeof pool, ids: number[]) {
  await c.query(
    `UPDATE ${倉庫の受注} w SET "残ケース" = COALESCE(w."ケース", 0) - ((SELECT COALESCE(SUM("ケース"), 0) FROM ${倉庫の出荷} s WHERE s."受注ID" = w."受注ID")
       + (SELECT COALESCE(SUM("ケース"), 0) FROM ${倉庫の名変} h WHERE h."受注ID" = w."受注ID"))
     WHERE w."受注ID" = ANY($1::int[])`,
    [ids],
  );
}

/** 受注登録の新しい受注を写す（Access の C_受注データインポート。写しの最大の受注ID より大きいものだけ。同じ名前の項目を写す） */
async function 受注を取り込む(c: PoolClient) {
  const cols = (
    await c.query(
      `SELECT a.column_name FROM information_schema.columns a JOIN information_schema.columns b ON b.column_name = a.column_name
       WHERE a.table_schema = 'soko' AND a.table_name = 'TD_受注' AND b.table_schema = 'juchu' AND b.table_name = 'TD_受注' ORDER BY a.ordinal_position`,
    )
  ).rows.map((r: Rec) => `"${r.column_name}"`);
  const max = n((await c.query(`SELECT MAX("受注ID") AS m FROM ${倉庫の受注}`)).rows[0].m);
  const ids = (
    await c.query(`INSERT INTO ${倉庫の受注} (${cols.join(", ")}) SELECT ${cols.join(", ")} FROM ${受注登録の受注} WHERE "受注ID" > $1 ORDER BY "受注ID" RETURNING "受注ID"`, [max])
  ).rows.map((r: Rec) => n(r.受注ID));
  if (ids.length) await 残ケースを出し直す(c, ids);
  return ids.length;
}

/** 受注登録へ書き戻す（Access の C_受注データエクスポート）。手配DataChk の付いた受注の 残ケース・受注手配確認・受注出庫確認 */
async function 受注を書き戻す(c: PoolClient) {
  const rows = (await c.query(`SELECT "受注ID", "残ケース", "受注手配確認", "受注出庫確認" FROM ${倉庫の受注} WHERE "手配DataChk" = true`)).rows;
  for (const r of rows) {
    const u = await c.query(`UPDATE ${受注登録の受注} SET "残ケース" = $2, "受注手配確認" = $3, "受注出庫確認" = $4 WHERE "受注ID" = $1 AND "chk" = false`, [
      r.受注ID, r.残ケース, r.受注手配確認, r.受注出庫確認,
    ]);
    if (u.rowCount) await c.query(`UPDATE ${倉庫の受注} SET "手配DataChk" = false WHERE "受注ID" = $1`, [r.受注ID]);
  }
}

/** 入庫後名義（Access の 倉庫管理の C_ユーザー評価。届け先・グループ商品コードの名義条件にあればそれ、なければそのまま） */
async function ユーザー評価(c: PoolClient, 届け先コード: unknown, 商品コード: unknown, 名義: unknown): Promise<number> {
  const g = n((await c.query(`SELECT "グループ商品コード" FROM ${商品マスタ} WHERE "商品コード" = $1 LIMIT 1`, [n(商品コード)])).rows[0]?.グループ商品コード);
  const r = n((await c.query(`SELECT "入庫名義ID" FROM ${名義条件} WHERE "届け先コード" = $1 AND "商品コード" = $2 ORDER BY "ID" LIMIT 1`, [n(届け先コード), g])).rows[0]?.入庫名義ID);
  return r || n(名義);
}

export function sokoJuchuRoutes(app: FastifyInstance) {
  app.addHook("preHandler", requireUser);

  // 開いたとき：新しい受注を写す（Access の 倉庫管理は、開くときには書き戻さない）
  app.post("/api/soko/juchu/open", async () => 一連で(async (c) => ({ 取り込み: await 受注を取り込む(c) })));

  // 閉じたとき：出庫の抽出区分を消し、受注登録へ書き戻し、受注の写しの chk を消す
  app.post("/api/soko/juchu/close", async () =>
    一連で(async (c) => {
      await c.query(`UPDATE ${倉庫の出荷} SET "抽出区分" = false WHERE "抽出区分" = true`);
      await 受注を書き戻す(c);
      await c.query(`UPDATE ${倉庫の受注} SET "chk" = false WHERE "chk" = true`);
      return { ok: true };
    }),
  );

  // 検索方法（TM_受注検索方法 ＋ 商品検索）
  app.get("/api/soko/juchu/methods", async () => {
    const rows = await q(`SELECT "検索方法ID" AS id, "選択方法" AS name FROM ${受注検索方法} ORDER BY "ID"`);
    return [...rows, { id: 6, name: "商品検索" }];
  });

  // 絞り込みのボタン（Access の C_検索ボタン配列切替）。last は直前に押したボタンの値（日本食研 360 なら短縮名2 で出す）
  app.get<{ Querystring: { kind: string; moto?: string; saki?: string; last?: string } }>("/api/soko/juchu/buttons", async (req) => {
    const moto = n(req.query.moto);
    const saki = n(req.query.saki);
    const 名の列 = n(req.query.last) === 360 ? "短縮名2" : "短縮名";
    switch (req.query.kind) {
      case "0": // 扱い先
        return [{ id: 0, name: "北海道" }, { id: -1, name: "本社" }];
      case "1": // 受注元（受注グループ：その扱い先の取引先。受注の重さの多い順）
        return (
          await q(
            `SELECT u."取引先ID" AS id, MIN(u."取引先名") AS name FROM ${受注先マスタ} u LEFT JOIN ${倉庫の受注} j ON j."受注元ID" = u."取引先ID"
             WHERE u."取引先ID" <> 112 AND u."本社受注" = $1 GROUP BY u."取引先ID", u."本社受注" ORDER BY SUM(j."商品kg") DESC NULLS LAST`,
            [moto !== 0],
          )
        ).slice(0, 24);
      case "2": {
        // 受注先（受注元の受注にある受注先。1123 は出さない）
        const rows = await q(`SELECT DISTINCT "受注先ID" AS id FROM ${倉庫の受注} WHERE "受注元ID" = $1 AND "受注先ID" <> 1123 ORDER BY 1`, [moto]);
        for (const r of rows) r.name = await 短縮名(pool, r.id, 名の列);
        return rows.slice(0, 24);
      }
      case "11": // 特定ユーザー（扱い先のユーザーを、出庫の重さの多い順に 10 件）
        return (
          await q(
            `SELECT u."取引先ID" AS id, u."取引先名" AS name FROM (SELECT DISTINCT "取引先ID", "取引先名", "本社受注" FROM ${受注先マスタ} WHERE "仕入区分" = false) u
             LEFT JOIN ${倉庫の出荷} s ON s."取引元ID" = u."取引先ID" WHERE u."本社受注" = $1
             GROUP BY u."取引先ID", u."取引先名" HAVING u."取引先ID" <> 1227 ORDER BY SUM(s."商品kg") DESC NULLS LAST`,
            [moto !== 0],
          )
        ).slice(0, 10);
      case "12": // その他ユーザー（全部のユーザーを出庫の重さの順に並べた 11 件目から）
        return (
          await q(
            `SELECT s."取引元ID" AS id, u."取引先名" AS name FROM (SELECT DISTINCT "取引先ID", "取引先名", "本社受注" FROM ${受注先マスタ} WHERE "仕入区分" = false) u
             LEFT JOIN ${倉庫の出荷} s ON s."取引元ID" = u."取引先ID"
             GROUP BY s."取引元ID", u."取引先名" HAVING s."取引元ID" <> 1227 ORDER BY SUM(s."商品kg") DESC NULLS LAST`,
          )
        ).slice(10, 34);
      case "13": {
        // 届け先（受注元〔と受注先〕の受注にある届け先）
        const args: unknown[] = [moto];
        let w = `"届け先コード" <> 0 AND "受注元ID" = $1`;
        if (saki) {
          args.push(saki);
          w += ` AND "受注先ID" = $2`;
        }
        const rows = await q(`SELECT DISTINCT "届け先コード" AS id FROM ${倉庫の受注} WHERE ${w} ORDER BY 1`, args);
        for (const r of rows) r.name = await 短縮名(pool, r.id, 名の列);
        return rows.slice(0, 24);
      }
    }
    return [];
  });

  // 受注の一覧（Access の C_MyFilter_set。複数選択の印の付いていないもの〔受注先 3165・3061 は印があっても出す〕）
  app.get<{ Querystring: Record<string, string | undefined> }>("/api/soko/juchu/list", async (req) => {
    const p = req.query;
    const w: string[] = [];
    const args: unknown[] = [];
    const add = (sql: string, v: unknown) => {
      args.push(v);
      w.push(sql.replace("?", `$${args.length}`));
    };
    if (n(p.moto)) add(`"受注元ID" = ?`, n(p.moto));
    // Access は受注先と届け先が同じ条件の場所に入るので、届け先を選ぶと受注先の条件は消える
    if (n(p.todoke)) add(`"届け先コード" = ?`, n(p.todoke));
    else if (n(p.saki)) add(`"受注先ID" = ?`, n(p.saki));
    if (p.d1 && p.d2) {
      args.push(p.d1, p.d2);
      w.push(`"納品日" BETWEEN $${args.length - 1}::date AND $${args.length}::date`);
    }
    if (p.toitsu) add(`"統一受注ID"::text LIKE ?`, p.toitsu.replace(/\*/g, "%"));
    if (p.jid) add(`"受注ID"::text LIKE ?`, `%${p.jid}%`);
    if (n(p.shohin)) add(`"商品コード" = ?`, n(p.shohin));
    if (!w.length) return [];
    return q(
      `SELECT "受注ID", "chk", "受注番号", "受注元ID", "受注先ID", "届け先コード", "届け先", "商品コード", "商品名", "規格", "納品日"::date::text AS "納品日",
              "ケース", "残ケース", "商品kg", "備考", "本社受注", "倉庫名"
       FROM ${倉庫の受注} WHERE ("chk" = false OR "受注先ID" IN (3165, 3061)) AND ${w.join(" AND ")}
       ORDER BY "納品日", "受注ID", "枝番1", "枝番2", "枝番3", "商品コード" LIMIT 2000`,
      args,
    );
  });

  app.post<{ Body: { 受注ID: number; chk: boolean } }>("/api/soko/juchu/chk", async (req) => {
    await pool.query(`UPDATE ${倉庫の受注} SET "chk" = $2 WHERE "受注ID" = $1`, [n(req.body.受注ID), !!req.body.chk]);
    return { ok: true };
  });
  // ［更新］：出ている受注の残ケースを出し直す（出庫と名変）
  app.post<{ Body: { 受注ID: number[] } }>("/api/soko/juchu/refresh", async (req) => {
    await 残ケースを出し直す(pool, (req.body.受注ID ?? []).map(n));
    return { ok: true };
  });
  // 受注の履歴（FSD_受注履歴：この受注から作った出庫）
  app.get<{ Params: { id: string } }>("/api/soko/juchu/rireki/:id", async (req) =>
    q(
      `SELECT "輸送ID", "出庫ID", "出荷日"::date::text AS "出荷日", "届け先", "倉庫名", "商品名", "ケース", "商品kg", "納品日"::date::text AS "納品日" FROM ${倉庫の出荷}
       WHERE "受注ID" = $1 ORDER BY "出荷日", "出庫ID"`,
      [n(req.params.id)],
    ),
  );

  // 受注とその商品・出庫場所の在庫（C_受注在庫読込 → CC_KakuZaikoSum）。残ケース分を賞味期限の古い順に先に割り付けておく（C_受注分在庫読込。商品区分 5 は落とさない）
  // mode=meihen は名変の受注検索（F_受注検索_名変 の C_受注分在庫読込）：割り付ける順が 製造日・賞味期限・タグ・入庫No・入庫日
  app.get<{ Querystring: { jid: string; soko: string; mode?: string } }>("/api/soko/juchu/zaiko", async (req, reply) =>
    一連で(async (c) => {
      const j = (await c.query(`SELECT *, "納品日"::date::text AS "納品日" FROM ${倉庫の受注} WHERE "受注ID" = $1`, [n(req.query.jid)])).rows[0];
      if (!j) return reply.code(404).send({ error: "この受注はありません" });
      const rows: Rec[] = (await 倉庫の在庫見込み(c, n(j.商品コード), n(req.query.soko))).map((r) => ({ ...r, 抽出区分: false, 実算ケース: 0, 実算kg: 0 }));
      const 順 = (x: unknown) => (x == null ? "" : String(x));
      const 割付順 = [...rows].sort((x, y) =>
        req.query.mode === "meihen"
          ? 順(x.製造日).localeCompare(順(y.製造日)) || 順(x.賞味期限).localeCompare(順(y.賞味期限)) || 順(x.タグ).localeCompare(順(y.タグ)) || 順(x.入庫No).localeCompare(順(y.入庫No)) || 順(x.入庫日).localeCompare(順(y.入庫日))
          : 順(x.賞味期限).localeCompare(順(y.賞味期限)) || 順(x.入庫日).localeCompare(順(y.入庫日)) || 順(x.タグ).localeCompare(順(y.タグ)) || 順(x.入庫No).localeCompare(順(y.入庫No)) || 順(x.製造日).localeCompare(順(y.製造日)));
      let 残 = n(j.残ケース);
      for (const r of 割付順) {
        if (残 === 0) break;
        if (n(r.商品区分) === 5) continue;
        if (残 - n(r.在庫ケース) > 0) {
          r.実算ケース = n(r.在庫ケース);
          if (n(r.在庫ケース) !== 0) r.抽出区分 = true;
          残 -= n(r.在庫ケース);
        } else {
          r.実算ケース = 残;
          r.抽出区分 = true;
          残 -= 残;
        }
        r.実算kg = r.実算ケース * n(r.入数);
      }
      // 画面の並び（賞味期限・製造日・入庫日・タグ・入庫No・商品コード）
      rows.sort((x, y) => 順(x.賞味期限).localeCompare(順(y.賞味期限)) || 順(x.製造日).localeCompare(順(y.製造日)) || 順(x.入庫日).localeCompare(順(y.入庫日)) || 順(x.タグ).localeCompare(順(y.タグ)) || 順(x.入庫No).localeCompare(順(y.入庫No)) || n(x.商品コード) - n(y.商品コード));
      const 名 = new Map((await c.query(`SELECT "短縮コード", "短縮名" FROM ${得意先マスタ} WHERE "短縮コード" = ANY($1::int[])`, [[...new Set(rows.map((r) => n(r.入庫後名義ID)))]])).rows.map((r: Rec) => [n(r.短縮コード), r.短縮名]));
      const ストック = (await c.query(`SELECT "ストック数" FROM ${ストックマスタ} WHERE "商品コード" = $1 LIMIT 1`, [n(j.商品コード)]).catch(() => ({ rows: [] as Rec[] }))).rows[0]?.ストック数 ?? null;
      const 前回 = (
        await c.query(
          j.納品日
            ? `SELECT MAX("賞味期限")::date::text AS v FROM ${倉庫の出荷} WHERE "商品コード" = $1 AND "届け先コード" = $2 AND "納品日" < $3::date`
            : `SELECT MAX("賞味期限")::date::text AS v FROM ${倉庫の出荷} WHERE "商品コード" = $1 AND "届け先コード" = $2 AND "出荷日" <= $3::date`,
          [n(j.商品コード), n(j.届け先コード), j.納品日 ?? 日本の今().日付],
        )
      ).rows[0].v;
      return { 受注: j, rows: rows.map((r) => ({ ...r, 入庫名義: 名.get(n(r.入庫後名義ID)) ?? null })), 重量: rows.reduce((a, r) => a + n(r.在庫kg), 0), ストック数: ストック, 前回賞味期限: 前回 };
    }),
  );

  // ロット逆転を確かめる材料（受注分在庫出力で在庫を選ぶとき）。mode=meihen は名変の写し（保管庫＝届け先の名変）で比べる
  app.get<{ Querystring: { todoke: string; shohin: string; nouhin?: string; mode?: string } }>("/api/soko/juchu/lot", async (req) => {
    const g = n((await q(`SELECT "グループ商品コード" FROM ${商品マスタ} WHERE "商品コード" = $1 LIMIT 1`, [n(req.query.shohin)]))[0]?.グループ商品コード);
    const 納品日 = /^\d{4}-\d{2}-\d{2}$/.test(req.query.nouhin ?? "") ? req.query.nouhin! : null;
    if (!納品日) return { 前回: null, 次回: null, 納品日なし: true };
    const 表 =
      req.query.mode === "meihen"
        ? { from: `${倉庫の名変} s LEFT JOIN ${商品マスタ} m ON m."商品コード" = s."商品コード"`, 先: `s."保管庫ID"`, 日: `s."変更日"` }
        : { from: `${倉庫の出荷} s LEFT JOIN ${商品マスタ} m ON m."商品コード" = s."商品コード"`, 先: `s."届け先コード"`, 日: `s."納品日"` };
    const 最大 = async (op: string) =>
      (await q(`SELECT MAX(s."賞味期限")::date::text AS v FROM ${表.from} WHERE ${表.先} = $1 AND m."グループ商品コード" = $2 AND ${表.日} ${op} $3::date`, [n(req.query.todoke), g, 納品日]))[0].v;
    return { 前回: await 最大("<"), 次回: req.query.mode === "meihen" ? null : await 最大(">"), 納品日なし: false, 特別: n(req.query.todoke) === 3194 && n(req.query.shohin) === 285 };
  });
  // 先の納品のロット逆転に印を付ける（受注分在庫出力で「先の納品日にロット逆転が発生しますが、よろしいですか？」に OK したとき）
  app.post<{ Body: { todoke: number; shohin: number; nouhin: string; kigen: string } }>("/api/soko/juchu/lot-mark", async (req) => {
    const g = n((await q(`SELECT "グループ商品コード" FROM ${商品マスタ} WHERE "商品コード" = $1 LIMIT 1`, [n(req.body.shohin)]))[0]?.グループ商品コード);
    await q(
      `UPDATE ${倉庫の出荷} s SET "変更通知" = 'ロット逆転!', "計画変更chk" = true FROM ${商品マスタ} m
       WHERE m."商品コード" = s."商品コード" AND m."グループ商品コード" = $1 AND s."賞味期限" < $2::date AND s."届け先コード" = $3 AND s."納品日" > $4::date`,
      [g, req.body.kigen, n(req.body.todoke), req.body.nouhin],
    );
    return { ok: true };
  });

  // 出庫の行を作る（Access の My出庫出力）。在庫を選んだときは選んだ在庫ごと（ケースは実算ケース）、在庫がないときは受注のケースで 1 行。
  // 積込順は 受注検索を開いてからの通し番号（Access の My積込No。複数選択実行のときは 0 から）
  app.post<{ Body: { 輸送ID: number; 受注ID: number; 倉庫ID: number; 選んだ?: { 認識ID: string; ケース: number }[]; 積込No: number } }>("/api/soko/juchu/out", async (req, reply) => {
    const b = req.body;
    return 一連で(async (c) => {
      const p = (await c.query(`SELECT * FROM ${倉庫の便} WHERE "輸送ID" = $1`, [n(b.輸送ID)])).rows[0];
      if (!p) return reply.code(404).send({ error: "この便はありません" });
      const j = (await c.query(`SELECT * FROM ${倉庫の受注} WHERE "受注ID" = $1 FOR UPDATE`, [n(b.受注ID)])).rows[0];
      if (!j) return reply.code(404).send({ error: "この受注はありません" });
      const 集荷日 = 日付(p.集荷日);
      const 引取り = `${集荷日 ? ` ${集荷日.slice(5, 7)}/${集荷日.slice(8, 10)}` : ""}${j.倉庫名 ?? ""} 引取り`;
      const 型 = (await c.query(`SELECT column_name, data_type FROM information_schema.columns WHERE table_schema = 'soko' AND table_name = 'TD_出荷'`)).rows as Rec[];
      const 既定: Rec = {};
      for (const r of 型) {
        if (r.column_name === "出庫ID") continue;
        if (r.data_type === "boolean") 既定[r.column_name] = false;
        else if (["integer", "smallint", "bigint", "double precision", "real", "numeric"].includes(r.data_type)) 既定[r.column_name] = 0;
      }
      type 行 = { z: Rec | null; ケース: number };
      const 行たち: 行[] = [];
      if (b.選んだ?.length) {
        const all = await 倉庫の在庫見込み(c, n(j.商品コード), n(b.倉庫ID));
        const 順 = (x: unknown) => (x == null ? "" : String(x));
        const 選 = b.選んだ
          .map((s) => ({ z: all.find((r) => r.認識ID === String(s.認識ID)) ?? null, ケース: n(s.ケース) }))
          .sort((x, y) => 順(x.z?.賞味期限).localeCompare(順(y.z?.賞味期限)) || 順(x.z?.タグ).localeCompare(順(y.z?.タグ)) || 順(x.z?.入庫No).localeCompare(順(y.z?.入庫No)));
        if (選.some((s) => !s.z)) return reply.code(400).send({ error: "選んだ在庫が見つかりません。もう一度選んでください。" });
        行たち.push(...選);
      } else 行たち.push({ z: null, ケース: n(j.ケース) });

      let 積込No = n(b.積込No);
      await c.query(`SELECT pg_advisory_xact_lock(hashtext('soko.TD_出荷.出庫ID'))`);
      let 次 = n((await c.query(`SELECT COALESCE(MAX("出庫ID"), 0) + 1 AS v FROM ${倉庫の出荷}`)).rows[0].v);
      for (const { z, ケース } of 行たち) {
        積込No++;
        const v: Rec = {
          ...既定, 出庫ID: 次++, 商品積込順: 積込No, 輸送ID: p.輸送ID, 出荷日: 日付(p.出荷計画日), 届け先コード: j.届け先コード, 届け先: j.届け先,
          取引元ID: j.受注元ID, 取引帳合ID: j.受注先ID, 取引元: await 短縮名(c, j.受注元ID), 取引帳合: await 短縮名(c, j.受注先ID), ユーザー伝票No: j.受注番号,
          納品日: 日付(j.納品日), 受注ID: j.受注ID, 本社受注: j.本社受注 ?? false, 入庫後名義ID: j.届け先コード, 登録時間: 日本の今().日時, 入力日付: 日本の今().日付,
        };
        if ((await c.query(`SELECT "倉庫区分" FROM ${得意先マスタ} WHERE "短縮コード" = $1 LIMIT 1`, [n(v.届け先コード)])).rows[0]?.倉庫区分 === true) {
          v.届け先区分 = 3;
          if (v.本社受注 === true) v.入庫後名義ID = 629; // 本社依頼の冷蔵庫入庫は本社名義
        }
        if (z) {
          const 入数 = (await c.query(`SELECT "入数" FROM ${商品マスタ} WHERE "商品コード" = $1 LIMIT 1`, [n(z.商品コード)])).rows[0]?.入数;
          Object.assign(v, {
            商品コード: z.商品コード, 商品名: z.商品名, 規格: z.規格, 入数: z.入数, ケース, 商品kg: 入数 == null ? null : Number(入数) * ケース, 入庫日: z.入庫日, 製造日: z.製造日,
            賞味期限: z.賞味期限 ?? (await 賞味期限計算(c, z.製造日, z.商品コード)), 入庫No: z.入庫No, 入庫ID: z.入庫ID, 倉庫ID: z.倉庫ID, 倉庫名: z.倉庫名, タグ: z.タグ,
            入庫前名義ID: z.入庫後名義ID, 認識ID: z.認識ID, 在庫ID: n(z.認識ID), 通知: "確認OK!", 産地コード: z.産地コード, 商品区分: z.商品区分, 商品状態隠語: z.商品状態隠語,
            製造工場ID: z.製造工場ID, 製造工場名: z.製造工場名,
            社内連絡: z.管理備考 ? `${j.備考 ?? ""} ${z.管理備考}\r\n${引取り}` : `${j.備考 ?? ""} ${引取り}`,
          });
        } else {
          Object.assign(v, {
            商品コード: j.商品コード, 商品名: j.商品名, 規格: j.規格, 入数: j.入数, 倉庫ID: n(b.倉庫ID), 倉庫名: await 短縮名(c, b.倉庫ID), ケース: n(j.ケース),
            商品kg: j.入数 == null ? null : n(j.ケース) * Number(j.入数), 社内連絡: `${j.備考 ?? ""} ${引取り}`,
          });
        }
        v.入庫後名義ID = await ユーザー評価(c, v.届け先コード, v.商品コード, v.入庫後名義ID);
        const 場所 = (await c.query(`SELECT "手配元ID", "手配帳合ID", "手配元", "手配帳合" FROM ${出荷場所条件} WHERE "倉庫ID" = $1 LIMIT 1`, [n(v.倉庫ID)])).rows[0];
        v.手配元ID = 場所?.手配元ID ?? v.倉庫ID;
        v.手配帳合ID = 場所?.手配帳合ID ?? v.倉庫ID;
        v.手配元 = 場所?.手配元 ?? v.倉庫名;
        v.手配帳合 = 場所?.手配帳合 ?? v.倉庫名;
        v.抽出区分 = true;
        v.備考 = await 特別項目(c, 1, "", v.届け先コード);
        v.備考 = await 特別項目(c, 0, String(v.備考 ?? ""), v.商品コード);
        v.運賃振分区分 = v.本社受注 === true ? 629 : 1;
        v.運賃振分区分名 = await 短縮名(c, v.運賃振分区分);
        const g = n((await c.query(`SELECT "グループ商品コード" FROM ${商品マスタ} WHERE "商品コード" = $1 LIMIT 1`, [n(v.商品コード)])).rows[0]?.グループ商品コード);
        v.運賃請求ID = n((await c.query(`SELECT "運賃請求ID" FROM ${名義条件} WHERE "届け先コード" = $1 AND "商品コード" = $2 ORDER BY "ID" LIMIT 1`, [n(v.届け先コード), g])).rows[0]?.運賃請求ID);
        const k = Object.keys(v);
        await c.query(`INSERT INTO ${倉庫の出荷} (${k.map((x) => `"${x}"`).join(", ")}) VALUES (${k.map((_, i) => `$${i + 1}`).join(", ")})`, k.map((x) => v[x]));
      }
      await c.query(`UPDATE ${倉庫の受注} SET "手配DataChk" = true WHERE "受注ID" = $1`, [j.受注ID]);
      await 残ケースを出し直す(c, [j.受注ID]);
      return { 件数: 行たち.length, 積込No };
    });
  });

  // 名変の行を作る（Access の F_受注検索_名変 の My出庫出力）。選んだ在庫ごとに、変更日の名変（TD_在庫変更）を 1 行ずつ作る。
  // 変更後名義・買取などは入れない（Access と同じ。名義変更の画面で入れる）。譲渡人負担日は変更日の半月の末日、譲受人負担日はその翌日
  app.post<{ Body: { 変更日: string; 受注ID: number; 倉庫ID: number; 選んだ: { 認識ID: string; ケース: number }[] } }>("/api/soko/juchu/meihen-out", async (req, reply) => {
    const b = req.body;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(b.変更日 ?? "")) return reply.code(400).send({ error: "変更日が正しくありません" });
    if (!b.選んだ?.length) return reply.code(400).send({ error: "在庫が選ばれていません" });
    return 一連で(async (c) => {
      const j = (await c.query(`SELECT * FROM ${倉庫の受注} WHERE "受注ID" = $1 FOR UPDATE`, [n(b.受注ID)])).rows[0];
      if (!j) return reply.code(404).send({ error: "この受注はありません" });
      const all = await 倉庫の在庫見込み(c, n(j.商品コード), n(b.倉庫ID));
      const 順 = (x: unknown) => (x == null ? "" : String(x));
      const 選 = b.選んだ
        .map((s) => ({ z: all.find((r) => r.認識ID === String(s.認識ID)) ?? null, ケース: n(s.ケース) }))
        .sort((x, y) => 順(x.z?.賞味期限).localeCompare(順(y.z?.賞味期限)) || 順(x.z?.タグ).localeCompare(順(y.z?.タグ)) || 順(x.z?.入庫No).localeCompare(順(y.z?.入庫No)));
      if (選.some((s) => !s.z)) return reply.code(400).send({ error: "選んだ在庫が見つかりません。もう一度選んでください。" });
      const 譲渡人 = 半月の末日(b.変更日);
      const 取引元 = await 短縮名(c, j.受注元ID);
      for (const { z, ケース } of 選) {
        const 入数 = (await c.query(`SELECT "入数" FROM ${商品マスタ} WHERE "商品コード" = $1 LIMIT 1`, [n(z!.商品コード)])).rows[0]?.入数;
        await 行を足す(c, 倉庫の名変, {
          変更No: await 次の番号(c, 倉庫の名変, "変更No"), 変更日: b.変更日, 取引元ID: j.受注元ID, 取引元, ユーザー伝票No: j.受注番号, 受注ID: j.受注ID,
          商品コード: z!.商品コード, 商品名: z!.商品名, 規格: z!.規格, 入数: z!.入数, ケース, 商品kg: 入数 == null ? null : Number(入数) * ケース, 製造日: z!.製造日,
          賞味期限: z!.賞味期限 ?? (await 賞味期限計算(c, z!.製造日, z!.商品コード)), 入庫No: z!.入庫No, 保管庫ID: z!.倉庫ID, 保管庫名: z!.倉庫名,
          変更前名義ID: z!.入庫後名義ID, 在庫No: n(z!.認識ID), 産地コード: z!.産地コード, 移動先ID: 10, 移動先名: "名義変更", 譲渡人負担日: 譲渡人, 譲受人負担日: 日を足す(譲渡人, 1),
          変更後名義ID: 0, 変更区分: 0, 変更Check: false, 抽出区分: false, 確認chk: false, 買取chk: false, 買取単価コード: 0, 買取金額: 0, 変更前在庫数: 0,
        });
      }
      await c.query(`UPDATE ${倉庫の受注} SET "手配DataChk" = true WHERE "受注ID" = $1`, [j.受注ID]);
      await 残ケースを出し直す(c, [j.受注ID]);
      return { 件数: 選.length };
    });
  });
}
