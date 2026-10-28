import type { FastifyInstance } from "fastify";
import type { PoolClient } from "pg";
import { pool, q, t } from "./db.js";
import { requireUser } from "./auth.js";
import { 一連で, 出荷の既定値, 特別項目, 賞味期限計算 } from "./ws.js";
import { 在庫見込み } from "./wsZaiko.js";

// 丸北WorkStation の受注検索（Access の F_受注検索・FSD_受注分在庫出力・My出庫出力）
// インポート処理の「受注読込」から開く。WorkStation の受注の写し（ws.TD_受注）から受注を選び、在庫を割り付けて、この便に出荷の行を作る。
const 輸送計画 = t("ws", "TD_輸送計画");
const 出荷 = t("ws", "TD_出荷");
const WS受注 = t("ws", "TD_受注");
const 受注登録の受注 = t("juchu", "TD_受注"); // Access の TD_受注_受注登録（受注登録のデータ側の表）
const 得意先マスタ = t("kyotsu", "TM_得意先マスタ");
const 商品マスタ = t("kyotsu", "TM_商品マスタ");
const 受注検索方法 = t("ws_fe", "TM_受注検索方法");
const 受注先マスタ = t("ws_fe", "TM_受注先マスタ");
const 名義条件 = t("ws_fe", "TM_入庫先商品別名義条件");
const 出荷場所条件 = t("ws_fe", "TM_出荷場所条件");

type Rec = Record<string, any>;
const n = (v: unknown) => Number(v ?? 0) || 0;
const 日本食研 = 360;

async function 短縮名(c: PoolClient | typeof pool, code: unknown, 列 = "短縮名"): Promise<string | null> {
  return (await c.query(`SELECT "${列}" AS v FROM ${得意先マスタ} WHERE "短縮コード" = $1 LIMIT 1`, [n(code)])).rows[0]?.v ?? null;
}

/** 受注登録へ書き戻す（Access の C_受注データエクスポート）。手配DataChk の付いた受注の残ケース・受注手配確認・受注出庫確認 */
async function 受注を書き戻す(c: PoolClient) {
  const rows = (await c.query(`SELECT "受注ID", "残ケース", "受注手配確認", "受注出庫確認" FROM ${WS受注} WHERE "手配DataChk" = true`)).rows;
  let 件数 = 0;
  for (const r of rows) {
    const u = await c.query(
      `UPDATE ${受注登録の受注} SET "残ケース" = $2, "受注手配確認" = $3, "受注出庫確認" = $4 WHERE "受注ID" = $1 AND "chk" = false`,
      [r.受注ID, r.残ケース, r.受注手配確認, r.受注出庫確認],
    );
    if (u.rowCount) {
      await c.query(`UPDATE ${WS受注} SET "手配DataChk" = false WHERE "受注ID" = $1`, [r.受注ID]);
      件数++;
    }
  }
  return 件数;
}

/** 受注登録の新しい受注を写す（Access の C_受注データインポート。WorkStation の写しの最大の受注ID より大きいものだけ） */
async function 受注を取り込む(c: PoolClient) {
  const cols = (
    await c.query(
      `SELECT a.column_name FROM information_schema.columns a JOIN information_schema.columns b ON b.column_name = a.column_name
       WHERE a.table_schema = 'ws' AND a.table_name = 'TD_受注' AND b.table_schema = 'juchu' AND b.table_name = 'TD_受注' ORDER BY a.ordinal_position`,
    )
  ).rows.map((r: Rec) => `"${r.column_name}"`);
  // 2 人が同時に開いても同じ受注を 2 回写さないように（2026/10/28 点検）
  await c.query(`SELECT pg_advisory_xact_lock(hashtext('ws.TD_受注 取込'))`);
  const max = n((await c.query(`SELECT MAX("受注ID") AS m FROM ${WS受注}`)).rows[0].m);
  const r = await c.query(
    `INSERT INTO ${WS受注} (${cols.join(", ")}) SELECT ${cols.join(", ")} FROM ${受注登録の受注} WHERE "受注ID" > $1 ORDER BY "受注ID"`,
    [max],
  );
  await c.query(
    `UPDATE ${WS受注} w SET "残ケース" = COALESCE(w."ケース", 0) - (SELECT COALESCE(SUM("ケース"), 0) FROM ${出荷} s WHERE s."受注ID" = w."受注ID")
     WHERE w."受注ID" > $1`,
    [max],
  );
  return r.rowCount ?? 0;
}

async function 残ケースを出し直す(c: PoolClient | typeof pool, ids: number[]) {
  await c.query(
    `UPDATE ${WS受注} w SET "残ケース" = COALESCE(w."ケース", 0) - (SELECT COALESCE(SUM("ケース"), 0) FROM ${出荷} s WHERE s."受注ID" = w."受注ID")
     WHERE w."受注ID" = ANY($1::int[])`,
    [ids],
  );
}

/** 入庫後名義（Access の C_ユーザー評価。届け先・グループ商品コードの名義条件にあればそれ） */
async function ユーザー評価(c: PoolClient, 届け先コード: unknown, 商品コード: unknown, 名義: unknown): Promise<number> {
  const g = n((await c.query(`SELECT "グループ商品コード" FROM ${商品マスタ} WHERE "商品コード" = $1 LIMIT 1`, [n(商品コード)])).rows[0]?.グループ商品コード);
  const r = n(
    (await c.query(`SELECT "入庫名義ID" FROM ${名義条件} WHERE "届け先コード" = $1 AND "商品コード" = $2 ORDER BY "ID" LIMIT 1`, [n(届け先コード), g])).rows[0]?.入庫名義ID,
  );
  return r || n(名義);
}

/** パレット枚数（ケース ÷ パレット単位1、端数は繰り上げ） */
export async function パレット計算(c: PoolClient, 商品コード: unknown, ケース: number): Promise<number> {
  const 単位 = n((await c.query(`SELECT "パレット単位1" FROM ${商品マスタ} WHERE "商品コード" = $1 LIMIT 1`, [n(商品コード)])).rows[0]?.パレット単位1);
  if (!単位) return 0;
  const x = ケース / 単位;
  return Number.isInteger(x) ? x : Math.trunc(x) + 1;
}

export function wsJuchuRoutes(app: FastifyInstance) {
  app.addHook("preHandler", requireUser);

  // 開いたとき：書き戻してから、新しい受注を取り込む
  app.post("/api/ws/juchu/open", async () =>
    一連で(async (c) => {
      const 書き戻し = await 受注を書き戻す(c);
      const 取り込み = await 受注を取り込む(c);
      return { 書き戻し, 取り込み };
    }),
  );

  // 閉じたとき：出荷の抽出区分を消し、書き戻し、受注の写しの chk を消す（Access の Form_Close）
  app.post("/api/ws/juchu/close", async () =>
    一連で(async (c) => {
      await c.query(`UPDATE ${出荷} SET "抽出区分" = false WHERE "抽出区分" = true`);
      await 受注を書き戻す(c);
      await c.query(`UPDATE ${WS受注} SET "chk" = false WHERE "chk" = true`);
      return { ok: true };
    }),
  );

  // 検索方法（TM_受注検索方法 ＋ 商品名検索）
  app.get("/api/ws/juchu/methods", async () => {
    const rows = await q(`SELECT "検索方法ID" AS id, "選択方法" AS name FROM ${受注検索方法} ORDER BY "ID"`);
    return [...rows, { id: 6, name: "商品名検索" }];
  });

  // 絞り込みのボタン（Access の C_検索ボタン配列切替）
  app.get<{ Querystring: { kind: string; moto?: string; saki?: string } }>("/api/ws/juchu/buttons", async (req) => {
    const moto = n(req.query.moto);
    const saki = n(req.query.saki);
    switch (req.query.kind) {
      case "0": // 扱い先
        return [{ id: 0, name: "丸北 北海道" }, { id: -1, name: "大阪丸北" }];
      case "2": {
        // 受注先（受注元の受注にある受注先。1123 は出さない）。日本食研は短縮名2
        const rows = await q(`SELECT DISTINCT "受注先ID" AS id FROM ${WS受注} WHERE "受注元ID" = $1 AND "受注先ID" <> 1123 ORDER BY 1`, [moto]);
        for (const r of rows) r.name = await 短縮名(pool, r.id, moto === 日本食研 ? "短縮名2" : "短縮名");
        return rows.slice(0, 32);
      }
      case "11":
      case "12": {
        // ユーザー（出荷した重さの多い順。11＝上位 10、扱い先で絞る。12＝11 位から、全部）
        const args: unknown[] = [];
        let w = "";
        if (req.query.kind === "11") {
          args.push(moto !== 0);
          w = `WHERE u."本社受注" = $1`;
        }
        const rows = await q(
          `SELECT s."取引元ID" AS id, u."取引先名" AS name, SUM(s."商品kg") AS kg
           FROM (SELECT DISTINCT "取引先ID", "取引先名", "本社受注" FROM ${受注先マスタ} WHERE "仕入区分" = false) u
           LEFT JOIN ${出荷} s ON s."取引元ID" = u."取引先ID" ${w}
           GROUP BY s."取引元ID", u."取引先名" HAVING s."取引元ID" <> 1227 ORDER BY SUM(s."商品kg") DESC NULLS LAST`,
          args,
        );
        return req.query.kind === "11" ? rows.slice(0, 10) : rows.slice(10, 42);
      }
      case "13": {
        // 届け先（名義条件から）。Access ではボタンの値に存在しない項目を入れていて、どれを押しても届け先では絞らない（値は 0）
        const args: unknown[] = [moto];
        let w = `"取引先グループID" = $1`;
        if (saki) {
          args.push(saki);
          w += ` AND "受注先ID" = $2`;
        }
        const rows = await q(`SELECT DISTINCT "届け先コード" AS code FROM ${名義条件} WHERE ${w} ORDER BY 1`, args);
        const out: Rec[] = [];
        for (const r of rows) out.push({ id: 0, name: await 短縮名(pool, r.code, moto === 日本食研 ? "短縮名2" : "短縮名") });
        return out.slice(0, 32);
      }
    }
    return [];
  });

  // 出荷場所の選択肢（出荷の多い倉庫の順）
  app.get("/api/ws/juchu/soko", async () =>
    q(`SELECT "倉庫ID" AS id, MIN("倉庫名") AS name FROM ${出荷} WHERE "倉庫ID" IS NOT NULL GROUP BY "倉庫ID" ORDER BY COUNT(*) DESC LIMIT 60`),
  );

  // 受注の一覧（Access の C_MyFilter_set の条件）
  app.get<{ Querystring: Record<string, string | undefined> }>("/api/ws/juchu/list", async (req) => {
    const p = req.query;
    const w: string[] = [];
    const args: unknown[] = [];
    const add = (sql: string, v: unknown) => {
      args.push(v);
      w.push(sql.replace("?", `$${args.length}`));
    };
    if (n(p.moto)) add(`"受注元ID" = ?`, n(p.moto));
    if (n(p.saki)) add(`"受注先ID" = ?`, n(p.saki));
    if (n(p.todoke)) add(`"届け先コード" = ?`, n(p.todoke));
    if (p.d1 && p.d2) {
      args.push(p.d1, p.d2);
      w.push(`"納品日" BETWEEN $${args.length - 1}::date AND $${args.length}::date`);
    }
    if (p.toitsu) add(`"統一受注ID"::text LIKE ?`, p.toitsu.replace(/\*/g, "%"));
    if (p.jid) add(`"受注ID"::text LIKE ?`, `%${p.jid}%`);
    if (n(p.shohin)) add(`"商品コード" = ?`, n(p.shohin));
    if (!w.length) return [];
    return q(
      `SELECT "受注ID", "chk", "受注番号", "届け先コード", "届け先", "商品コード", "商品名", "規格", "納品日", "ケース", "残ケース", "商品kg", "備考", "本社受注"
       FROM ${WS受注} WHERE ${w.join(" AND ")} ORDER BY "受注ID" LIMIT 2000`,
      args,
    );
  });

  // 複数選択の印
  app.post<{ Body: { 受注ID: number; chk: boolean } }>("/api/ws/juchu/chk", async (req) => {
    await pool.query(`UPDATE ${WS受注} SET "chk" = $2 WHERE "受注ID" = $1`, [n(req.body.受注ID), !!req.body.chk]);
    return { ok: true };
  });

  // 最新情報に更新（出ている受注の残ケースを出し直す）
  app.post<{ Body: { 受注ID: number[] } }>("/api/ws/juchu/refresh", async (req) => {
    await 残ケースを出し直す(pool, (req.body.受注ID ?? []).map(n));
    return { ok: true };
  });

  // 受注の履歴（Access の FSD_受注履歴。この受注から作った出荷）
  app.get<{ Params: { id: string } }>("/api/ws/juchu/rireki/:id", async (req) =>
    q(
      `SELECT "輸送ID", "出庫ID", "出荷日", "届け先", "倉庫名", "商品名", "ケース", "商品kg", "納品日", "受注ID" FROM ${出荷} WHERE "受注ID" = $1 ORDER BY "出荷日", "出庫ID"`,
      [n(req.params.id)],
    ),
  );

  // 受注とその商品・出荷場所の在庫（Access の C_受注在庫読込 → CC_KakuZaikoSum。生産計画も含む）
  app.get<{ Querystring: { jid: string; soko: string } }>("/api/ws/juchu/zaiko", async (req, reply) => {
    const j = (await pool.query(`SELECT * FROM ${WS受注} WHERE "受注ID" = $1`, [n(req.query.jid)])).rows[0];
    if (!j) return reply.code(404).send({ error: "この受注はありません" });
    const rows = await 在庫見込み(pool, { 商品コード: n(j.商品コード), 倉庫ID: n(req.query.soko), 計画: true });
    return { 受注: j, rows };
  });

  // 出荷の行を作る（Access の My出庫出力）。在庫を選んだときは選んだ在庫ごと、在庫がないときは入れた数で 1 行
  app.post<{
    Body: { 輸送ID: number; 受注ID: number; 倉庫ID: number; 選んだ?: { 認識ID: string; ケース: number; kg: number }[]; 直接ケース?: number };
  }>("/api/ws/juchu/out", async (req, reply) => {
    const b = req.body;
    return 一連で(async (c) => {
      const plan = (await c.query(`SELECT "出荷計画日", "集荷日" FROM ${輸送計画} WHERE "輸送ID" = $1`, [n(b.輸送ID)])).rows[0];
      if (!plan) return reply.code(404).send({ error: "この便はありません" });
      const j = (await c.query(`SELECT * FROM ${WS受注} WHERE "受注ID" = $1 FOR UPDATE`, [n(b.受注ID)])).rows[0];
      if (!j) return reply.code(404).send({ error: "この受注はありません" });
      const 集荷 = plan.集荷日 ? ` ${plan.集荷日.slice(5, 7)}/${plan.集荷日.slice(8, 10)}` : "";
      const 受注日 = j.受注日 ? `${Number(j.受注日.slice(5, 7))}/${Number(j.受注日.slice(8, 10))}` : "";

      // 作る行（在庫から選んだ行、または在庫なしの 1 行）
      type 行 = { z: Rec | null; ケース: number; kg: number | null };
      const 行たち: 行[] = [];
      // 在庫の画面で何も選ばなかったとき（空の一覧）は作らない（2026/10/28 点検：0 ケースの行ができていた）
      if (Array.isArray(b.選んだ) && b.選んだ.length === 0) return reply.code(400).send({ error: "在庫が選ばれていません。" });
      if (b.選んだ?.length) {
        const all = await 在庫見込み(c, { 商品コード: n(j.商品コード), 倉庫ID: n(b.倉庫ID), 計画: true });
        for (const s of b.選んだ) {
          const z = all.find((r) => String(r.認識ID) === String(s.認識ID));
          if (!z) return reply.code(400).send({ error: "選んだ在庫が見つかりません。もう一度選んでください。" });
          行たち.push({ z, ケース: n(s.ケース), kg: s.kg ?? null });
        }
      } else 行たち.push({ z: null, ケース: n(b.直接ケース), kg: null });

      await c.query(`SELECT pg_advisory_xact_lock(hashtext('TD_出荷.出庫ID'))`);
      let next = n((await c.query(`SELECT COALESCE(MAX("出庫ID"), 0) + 1 AS n FROM ${出荷}`)).rows[0].n);
      for (const { z, ケース, kg } of 行たち) {
        const v: Rec = {
          ...出荷の既定値,
          出庫ID: next++, 輸送ID: n(b.輸送ID), 出荷日: plan.出荷計画日,
          届け先コード: j.届け先コード, 届け先: j.届け先, 取引元ID: j.受注元ID, 取引帳合ID: j.受注先ID,
          取引元: await 短縮名(c, j.受注元ID), 取引帳合: await 短縮名(c, j.受注先ID),
          ユーザー伝票No: j.受注番号, 送り状No: j.送り状No, 納品日: j.納品日, 蔵前区分: j.蔵前区分 ?? false,
          指定最終届け先コード: j.指定最終届け先コード ?? 0, 指定最終届け先: j.指定最終届け先,
          受注ID: j.受注ID, 本社受注: j.本社受注 ?? false,
          受注表題: `${受注日}受注 ${j.本社受注 ? "大阪丸北" : "丸北 北海道"}\r\n${j.備考 ?? ""}`,
          入庫後名義ID: j.入庫名義ID,
        };
        // サービス区分は Access でも働かない（2026/10/08 にはずした）ので、既定の値のまま
        if (!n(v.入庫後名義ID)) {
          const 倉庫 = (await c.query(`SELECT "倉庫区分" FROM ${得意先マスタ} WHERE "短縮コード" = $1 LIMIT 1`, [n(v.届け先コード)])).rows[0]?.倉庫区分;
          if (倉庫 === true) {
            v.届け先区分 = 3;
            if (v.本社受注) v.入庫後名義ID = 629; // 本社依頼の冷蔵庫入庫は本社名義
          } else v.入庫後名義ID = v.届け先コード; // ユーザーは受注先の名義
        }
        if (z) {
          Object.assign(v, {
            商品コード: z.商品コード, 商品名: z.商品名, 規格: z.規格, 入数: z.入数, ケース, 商品kg: kg || ケース * n(z.入数), // kg が 0 で届いたとき（ケースはある）は入数から（2026/10/28 点検）
            パレット使用枚数: await パレット計算(c, z.商品コード, ケース),
            入庫日: z.入庫日, 製造日: z.製造日, 賞味期限: z.賞味期限 ?? (await 賞味期限計算(c, z.製造日, z.商品コード)),
            入庫No: z.入庫No ?? null, 入庫ID: z.入庫ID, 倉庫ID: z.倉庫ID, 倉庫名: z.倉庫名, タグ: z.タグ ?? null, 入庫前名義ID: z.入庫後名義ID,
            認識ID: String(z.認識ID), 在庫ID: z.架空ID, 通知: "確認OK!", 産地コード: z.産地コード ?? null, 製造工場ID: z.製造工場ID ?? null,
            製造工場名: z.製造工場名 ?? null, 商品区分: n(z.商品区分), 検体区分: z.検体区分 ?? false, インポート場所ID: z.インポート場所ID,
            社内連絡: z.管理備考
              ? `${j.備考 ?? ""} ${z.管理備考}\r\n${集荷}${j.倉庫名 ?? ""} 引取り`
              : `${j.備考 ?? ""} ${集荷}${j.倉庫名 ?? ""} 引取り`,
          });
        } else {
          const m = (await c.query(`SELECT "製造場所ID" FROM ${商品マスタ} WHERE "商品コード" = $1 LIMIT 1`, [n(j.商品コード)])).rows[0];
          const 製造工場ID = n(m?.製造場所ID);
          Object.assign(v, {
            商品コード: j.商品コード, 商品名: j.商品名, 規格: j.規格, 入数: j.入数, 倉庫ID: n(b.倉庫ID), 倉庫名: await 短縮名(c, b.倉庫ID),
            ケース, 商品kg: ケース * n(j.入数), パレット使用枚数: await パレット計算(c, j.商品コード, ケース),
            社内連絡: `${j.備考 ?? ""} ${集荷}${j.倉庫名 ?? ""} 引取り`, 製造工場ID, 製造工場名: await 短縮名(c, 製造工場ID),
            認識ID: "0", 在庫ID: 0,
          });
          // 在庫のない行は、出荷場所条件の名義（なければ倉庫ID）
          const 場所 = (await c.query(`SELECT "名義ID" FROM ${出荷場所条件} WHERE "倉庫ID" = $1 LIMIT 1`, [n(b.倉庫ID)])).rows[0];
          v.入庫前名義ID = 場所?.名義ID ?? n(b.倉庫ID);
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
        v.運賃振分区分 = v.本社受注 ? 629 : 1;
        v.運賃振分区分名 = await 短縮名(c, v.運賃振分区分);
        const g = n((await c.query(`SELECT "グループ商品コード" FROM ${商品マスタ} WHERE "商品コード" = $1 LIMIT 1`, [n(v.商品コード)])).rows[0]?.グループ商品コード);
        v.運賃請求ID = n(
          (await c.query(`SELECT "運賃請求ID" FROM ${名義条件} WHERE "届け先コード" = $1 AND "商品コード" = $2 ORDER BY "ID" LIMIT 1`, [n(v.届け先コード), g])).rows[0]?.運賃請求ID,
        );
        const keys = Object.keys(v);
        await c.query(
          `INSERT INTO ${出荷} (${keys.map((k) => `"${k}"`).join(", ")}) VALUES (${keys.map((_, i) => `$${i + 1}`).join(", ")})`,
          keys.map((k) => v[k]),
        );
      }
      // 受注に印を付け、残ケースを出し直す
      await c.query(`UPDATE ${WS受注} SET "手配DataChk" = true WHERE "受注ID" = $1`, [j.受注ID]);
      await 残ケースを出し直す(c, [j.受注ID]);
      // 複数選択の印は外す
      await c.query(`UPDATE ${WS受注} SET "chk" = false WHERE "受注ID" = $1`, [j.受注ID]);
      return { 件数: 行たち.length };
    });
  });
}
