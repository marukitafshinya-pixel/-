import type { FastifyInstance } from "fastify";
import type { PoolClient } from "pg";
import { pool, t, 日本の今 } from "./db.js";
import { requireUser } from "./auth.js";
import { 一連で, 賞味期限計算 } from "./ws.js";
import { 入庫できる } from "./wsZaiko.js";

// 丸北WorkStation の在庫更新（Access の FM_在庫更新・CC_ZaikoUpdate）。
// 製造管理の入庫（出来高）のうち印を付けたものを在庫に入れ、印を付けた便のまだ登録していない出荷を在庫から引き、在庫を集計する。
// 更新の前に在庫を写しておき、［元に戻す］で戻せる（Access は表へのつながりしか写しておらず戻せなかったので、Web 版では中身を写す）。
const 在庫 = t("ws", "TD_在庫");
const 在庫の写し = t("ws", "TD_在庫BackUp");
const 出荷 = t("ws", "TD_出荷");
const 輸送計画 = t("ws", "TD_輸送計画");
const 在庫変更 = t("ws", "TD_在庫変更");
const 入庫 = t("seizo", "TD_入庫"); // WorkStation の TD_入庫 は製造管理のもの
const 得意先マスタ = t("kyotsu", "TM_得意先マスタ");
const 商品マスタ = t("kyotsu", "TM_商品マスタ");
const 利用者 = t("ws_fe", "TD_USER");

type Rec = Record<string, any>;
const n = (v: unknown) => Number(v ?? 0) || 0;
const 日付 = (v: unknown) => (v ? String(v).slice(0, 10) : null);
const 通し番号 = (v: unknown) => (v ? Math.round((Date.parse(日付(v) + "T00:00:00Z") - Date.UTC(1899, 11, 30)) / 86400000) : 0);
function 月を足す(v: string, 月: number): string {
  const d = new Date(v.slice(0, 10) + "T00:00:00Z");
  const y = d.getUTCFullYear() + Math.floor((d.getUTCMonth() + 月) / 12);
  const m = (d.getUTCMonth() + 月) % 12;
  const last = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
  return new Date(Date.UTC(y, m, Math.min(d.getUTCDate(), last))).toISOString().slice(0, 10);
}
const 日を足す = (v: string, k: number) => new Date(Date.parse(v.slice(0, 10) + "T00:00:00Z") + k * 86400000).toISOString().slice(0, 10);

async function 短縮名(c: PoolClient, code: unknown) {
  return (await c.query(`SELECT "短縮名" FROM ${得意先マスタ} WHERE "短縮コード" = $1 LIMIT 1`, [n(code)])).rows[0]?.短縮名 ?? null;
}

// 表の欄の型（Access と同じく、入れていない数の欄は 0、はい／いいえの欄は false にするため）
const 欄の型 = new Map<string, Map<string, string>>();
async function 既定値を足す(c: PoolClient, 表: string, v: Rec): Promise<Rec> {
  if (!欄の型.has(表)) {
    const [s, t2] = 表.replace(/"/g, "").split(".");
    const rows = (await c.query(`SELECT column_name, data_type FROM information_schema.columns WHERE table_schema = $1 AND table_name = $2`, [s, t2])).rows;
    欄の型.set(表, new Map(rows.map((r: Rec) => [r.column_name, r.data_type])));
  }
  // 登録時間は入れた時刻（Access の Now()）。パレットコード・パレット使用枚数は空のまま（Access の表の決め方）
  const out: Rec = { 登録時間: 日本の今().日時.replace(/\//g, "-") };
  for (const [k, ty] of 欄の型.get(表)!) {
    if (k in v || k === "パレットコード" || k === "パレット使用枚数") continue;
    if (ty === "boolean") out[k] = false;
    else if (["integer", "smallint", "bigint", "double precision", "numeric", "real"].includes(ty)) out[k] = 0;
  }
  return { ...out, ...v };
}

async function 足す(c: PoolClient, 表: string, v0: Rec) {
  const v = await 既定値を足す(c, 表, v0);
  const keys = Object.keys(v);
  const r = await c.query(
    `INSERT INTO ${表} (${keys.map((k) => `"${k}"`).join(", ")}) VALUES (${keys.map((_, i) => `$${i + 1}`).join(", ")}) RETURNING *`,
    keys.map((k) => v[k]),
  );
  return r.rows[0];
}

async function 次の在庫ID(c: PoolClient): Promise<number> {
  await c.query(`SELECT pg_advisory_xact_lock(hashtext('TD_在庫.在庫ID'))`);
  return n((await c.query(`SELECT COALESCE(MAX("在庫ID"), 0) + 1 AS n FROM ${在庫}`)).rows[0].n);
}

/** 生産工場の在庫の名義（Access と同じ。191 はふらの名義、ほかの工場は大阪丸北名義） */
export function 工場の名義(倉庫ID: number): number {
  if ([1, 11, 137, 1187].includes(倉庫ID)) return 倉庫ID;
  if (倉庫ID === 191) return 150;
  return 629;
}

/** 入庫登録（Access の C_NyukoUpdate）：印を付けた、まだ登録していない入庫を在庫にする */
async function 入庫登録(c: PoolClient, 更新日: string, 更新時間: string) {
  const rows = (await c.query(`SELECT * FROM ${入庫} WHERE "抽出区分" = true AND "chk" = false ORDER BY "入庫ID"`)).rows;
  for (const r of rows) {
    const 倉庫名 = await 短縮名(c, r.倉庫ID);
    const 製造ケース = n(r.ケース);
    const 製造kg = Number(r.商品kg ?? 0);
    const 出庫ケース = n(r.出庫ケース);
    const 出荷kg = Number(r.出荷kg ?? 0);
    const z = await 足す(c, 在庫, {
      在庫ID: await 次の在庫ID(c), 倉庫ID: r.倉庫ID, 倉庫名, 商品コード: r.商品コード, 商品名: r.商品名, 規格: r.規格, 入数: r.入数,
      製造日: r.製造日, 入庫日: r.入庫日, 入庫ID: r.入庫ID, 入庫元数: r.ケース, 製造ケース, 製造kg, 繰越ケース: 0, 繰越kg: 0, 出庫ケース, 出荷kg,
      在庫ケース: 製造ケース - 出庫ケース, 在庫kg: 製造kg - 出荷kg, 出荷止め区分: r.出荷止め, 管理備考: r.管理備考, 商品区分: r.商品区分,
      検査区分: r.検査区分, 検体区分: r.検体区分, タグ: r.タグ, カードカラーコード: r.カードカラーコード, 産地コード: n(r.産地コード),
      製造工場ID: r.倉庫ID, 製造工場名: 倉庫名, 検体取得: r.検体取得,
      // データは入庫日から 5 年持つ
      最終出庫日: r.入庫日 ? 月を足す(String(r.入庫日), 60) : null,
      入庫後名義ID: 工場の名義(n(r.倉庫ID)),
    });
    // この入庫から出した出荷に、在庫ID を入れる
    await c.query(`UPDATE ${出荷} SET "在庫ID" = $1 WHERE "入庫ID" = $2`, [z.在庫ID, r.入庫ID]);
    await c.query(`UPDATE ${入庫} SET "chk" = true, "更新日" = $2, "更新時間" = $3 WHERE "入庫ID" = $1`, [r.入庫ID, 更新日, 更新時間]);
  }
  return rows.length;
}

/**
 * 生産計画から出した出荷を、在庫の行に付け替える（Access の PlanChange。Tfg＝0）。
 * 出荷の認識ID（生産計画の印）がこの在庫の 倉庫ID＋商品コード＋製造日＋入庫日＋入庫ID と同じなら、在庫ID に変えて「実物ｱﾘ」にする。
 */
async function 計画を在庫に付け替える(c: PoolClient, z: Rec) {
  const 印 = `${n(z.倉庫ID)}${n(z.商品コード)}${通し番号(z.製造日)}${通し番号(z.入庫日)}${n(z.入庫ID)}`;
  await c.query(
    `UPDATE ${出荷} SET "在庫ID" = $2, "認識ID" = $3, "製造日" = $4, "包装日" = $5, "入庫日" = $5, "入庫ID" = $6, "入庫No" = NULL,
       "通知" = '実物ｱﾘ', "変更通知" = 'ﾃﾞｰﾀ更新', "抽出区分" = true
     WHERE "認識ID" = $1 AND "抽出区分" = false`,
    [印, z.在庫ID, String(z.在庫ID), z.製造日, z.入庫日, z.入庫ID],
  );
}

/** 集計（Access の C_ZaikoSum）：在庫ケース＝繰越＋製造－出庫、kg、分類、認識ID、賞味期限、最終出庫日 */
async function 集計(c: PoolClient) {
  const rows = (await c.query(`SELECT * FROM ${在庫} WHERE "在庫ケース" <> 0 ORDER BY "在庫ID"`)).rows;
  for (const z of rows) {
    const 在庫ケース = n(z.繰越ケース) + n(z.製造ケース) - n(z.出庫ケース);
    const 分類ID = n(z.分類ID) || n((await c.query(`SELECT "分類ID" FROM ${商品マスタ} WHERE "商品コード" = $1 LIMIT 1`, [n(z.商品コード)])).rows[0]?.分類ID);
    const 認識ID = n(z.認識ID) ? z.認識ID : `${n(z.倉庫ID)}${n(z.商品コード)}${通し番号(z.製造日)}${通し番号(z.入庫日)}${n(z.入庫ID)}`;
    const 賞味期限 = z.賞味期限 ?? (await 賞味期限計算(c, z.製造日, z.商品コード));
    await c.query(
      `UPDATE ${在庫} SET "作成日付" = NULL, "在庫ケース" = $2, "在庫kg" = $3, "分類ID" = $4, "認識ID" = $5, "賞味期限" = $6 WHERE "在庫ID" = $1`,
      [z.在庫ID, 在庫ケース, 在庫ケース === 0 ? 0 : 在庫ケース * Number(z.入数 ?? 0), 分類ID, 認識ID, 賞味期限],
    );
    await 計画を在庫に付け替える(c, z);
  }
  // 付け替えの印は全部消す（Access と同じく、出荷の表の印を全部消す）
  await c.query(`UPDATE ${出荷} SET "抽出区分" = false WHERE "抽出区分" = true`);
  // 最終出庫日の空いているもの：在庫が 0 なら最後に出した日、あれば入庫日から 5 年
  for (const z of (await c.query(`SELECT "在庫ID", "在庫ケース", "入庫日" FROM ${在庫} WHERE "最終出庫日" IS NULL`)).rows) {
    let v: string | null;
    if (n(z.在庫ケース) === 0) {
      const s = (await c.query(`SELECT MAX("出荷日") AS v FROM ${出荷} WHERE "在庫ID" = $1`, [z.在庫ID])).rows[0]?.v;
      const h = (await c.query(`SELECT MAX("変更日") AS v FROM ${在庫変更} WHERE "在庫No" = $1`, [z.在庫ID])).rows[0]?.v;
      v = 日付(s) && 日付(h) ? (日付(s)! < 日付(h)! ? 日付(h) : 日付(s)) : (日付(s) ?? 日付(h));
    } else v = z.入庫日 ? 月を足す(String(z.入庫日), 60) : null;
    await c.query(`UPDATE ${在庫} SET "最終出庫日" = $2 WHERE "在庫ID" = $1`, [z.在庫ID, v]);
  }
}

/** 出荷登録（Access の C_HaisyaUpdate・C_SyukkaUpdate）：印を付けた便の、まだ登録していない出荷を在庫から引く */
async function 出荷登録(c: PoolClient, 更新日: string, 更新時間: string, 今日: string) {
  let 登録できない = 0;
  const 便 = (await c.query(`SELECT "輸送ID" FROM ${輸送計画} WHERE "抽出区分" = true ORDER BY "輸送ID"`)).rows;
  for (const b of 便) {
    let 全部 = true;
    const rows = (
      await c.query(
        `SELECT s.* FROM ${出荷} s JOIN ${輸送計画} p ON p."輸送ID" = s."輸送ID"
         WHERE s."chk" = false AND s."輸送ID" = $1 AND s."届け先コード" <> 0 ORDER BY s."出荷日", s."出庫ID"`,
        [b.輸送ID],
      )
    ).rows;
    for (const s of rows) {
      // 出す在庫（在庫ケースがあり、最終出庫日が 30 日前より後のもの）
      const z = (
        await c.query(`SELECT * FROM ${在庫} WHERE "在庫ID" = $1 AND "在庫ケース" <> 0 AND "最終出庫日" >= $2::date`, [n(s.在庫ID), 日を足す(今日, -30)])
      ).rows[0];
      let 済 = false;
      if (z) {
        const 同じ =
          n(z.倉庫ID) === n(s.倉庫ID) && n(z.商品コード) === n(s.商品コード) && 日付(z.製造日) === 日付(s.製造日) && 日付(z.賞味期限) === 日付(s.賞味期限);
        // 年間受注（商品区分 11）の在庫は、中身が違っても出す
        if (同じ || n(z.商品区分) === 11) {
          const 出庫 = n(z.出庫ケース) + n(s.ケース);
          await c.query(
            `UPDATE ${在庫} SET "出庫回数" = "出庫回数" + 1, "出庫ケース" = $2, "出荷kg" = "出荷kg" + $3,
               "最終出庫日" = CASE WHEN "在庫ケース" - $2 = 0 THEN $4::timestamp ELSE "最終出庫日" END WHERE "在庫ID" = $1`,
            [z.在庫ID, 出庫, Number(s.商品kg ?? 0), s.出荷日],
          );
          済 = true;
        } else {
          await c.query(`UPDATE ${出荷} SET "変更通知" = '在庫データの参照が正しくありません', "計画変更chk" = true WHERE "出庫ID" = $1`, [s.出庫ID]);
          登録できない++;
          全部 = false;
        }
      } else if (n(s.インポート場所ID) !== 1 || (n(s.在庫ID) === 0 && String(s.認識ID ?? "").slice(0, 2) === "0")) {
        // 倉庫などから取り込んだ出荷・強制入力（在庫なし）は、そのまま登録する
        済 = true;
      } else {
        await c.query(`UPDATE ${出荷} SET "変更通知" = '生産登録後、再度参照してください。', "計画変更chk" = true WHERE "出庫ID" = $1`, [s.出庫ID]);
        登録できない++;
        全部 = false;
      }
      // 届け先が入庫できる倉庫なら、届け先の在庫として足す
      if (await 入庫できる(c, s.届け先コード, s.入庫後名義ID)) {
        const g = s.納品日 ? `${String(s.納品日).slice(5, 7)}月${Number(String(s.納品日).slice(8, 10))}日` : "";
        await 足す(c, 在庫, {
          在庫ID: await 次の在庫ID(c), 包装日: s.包装日, 倉庫ID: s.届け先コード, 倉庫名: await 短縮名(c, s.届け先コード), 商品コード: s.商品コード,
          商品名: s.商品名, 規格: s.規格, 入数: s.入数, 製造日: s.製造日, 賞味期限: s.賞味期限, 製造ケース: s.ケース, 製造kg: s.商品kg,
          入庫元数: s.ケース, 入庫後名義ID: s.入庫後名義ID, 入庫日: s.納品日, 出庫ID: s.出庫ID, 商品区分: s.商品区分, タグ: s.タグ,
          備考在庫: `${g}:${s.倉庫名 ?? ""}  ${s.ケース} ｹｰｽ入庫 `,
          // 在庫ケースなどは入れない（Access と同じ。ふだんは積込確認の✔で在庫に入るので、ここで入ることはまれ）
        });
      }
      if (済) {
        const m = (await c.query(`SELECT "倉庫区分", "出荷元区分" FROM ${得意先マスタ} WHERE "短縮コード" = $1 LIMIT 1`, [n(s.倉庫ID)])).rows[0];
        await c.query(
          `UPDATE ${出荷} SET "chk" = true, "更新日" = $2, "更新時間" = $3${m?.倉庫区分 === true && m?.出荷元区分 === false ? `, "入庫フラグ" = true` : ""} WHERE "出庫ID" = $1`,
          [s.出庫ID, 更新日, 更新時間],
        );
      }
    }
    // 登録できない出荷があれば、便は未登録のまま（もう一度更新できる）
    // 便の表には更新日の欄がない（Access でも書けずに飛ばしている）
    await c.query(`UPDATE ${輸送計画} SET "更新時間" = $2, "chk" = $3 WHERE "輸送ID" = $1`, [b.輸送ID, 更新時間, 全部]);
  }
  return 登録できない;
}

/** 在庫確認（Access の FM_在庫確認）：工場・名義ごと、商品ごとの kg */
async function 在庫確認(c: PoolClient | typeof pool, 工場: number, 今日: string) {
  return (
    await c.query(
      `SELECT "分類ID", "商品コード", "商品名", "規格", SUM("繰越kg") AS "繰越kg", SUM("製造kg") AS "製造kg", SUM("出荷kg") AS "出荷kg", SUM("在庫kg") AS "在庫kg"
       FROM ${在庫} WHERE "入庫日" <= $1::date AND "倉庫ID" = $2 AND "入庫後名義ID" = $3
       GROUP BY "分類ID", "商品コード", "商品名", "規格", "倉庫ID" HAVING SUM("在庫kg") <> 0 ORDER BY "分類ID", "商品コード"`,
      [今日, 工場, 工場 === 191 ? 150 : 工場],
    )
  ).rows;
}

export function wsKoshinRoutes(app: FastifyInstance) {
  app.addHook("preHandler", requireUser);

  // 画面のデータ：まだ登録していない入庫と便（今日まで）。開いたとき、その日の便の受領印チェックを付け直す（Access の C_輸送計画進行状況確認）
  app.get<{ Querystring: { date?: string } }>("/api/ws/koshin", async (req) =>
    一連で(async (c) => {
      const 今日 = 日本の今().日付;
      const 日 = req.query.date || 今日;
      await c.query(
        `UPDATE ${輸送計画} p SET "受領印チェック" = NOT EXISTS (SELECT 1 FROM ${出荷} s WHERE s."輸送ID" = p."輸送ID" AND s."積込確認" = false)
         WHERE p."出荷計画日" = $1::date`,
        [日],
      );
      const 入庫一覧 = (
        await c.query(
          `SELECT i."入庫ID", i."抽出区分", i."入庫日", i."倉庫ID", COALESCE(i."倉庫名", u."短縮名") AS "倉庫名", i."商品コード", i."商品名", i."規格",
             i."ケース", i."商品kg", i."製造日", i."タグ", i."数量確定フラグ"
           FROM ${入庫} i LEFT JOIN ${得意先マスタ} u ON u."短縮コード" = i."倉庫ID"
           WHERE i."chk" = false AND i."入庫日" <= $1::date ORDER BY i."入庫日", i."倉庫ID", i."商品コード", i."入庫ID"`,
          [今日],
        )
      ).rows;
      const 便一覧 = (
        await c.query(
          `SELECT p."輸送ID", p."抽出区分", p."出荷計画日", p."運送会社名", p."車番", p."受領印チェック",
             (SELECT COUNT(*) FROM ${出荷} s WHERE s."輸送ID" = p."輸送ID" AND s."chk" = false) AS "未登録", (SELECT COUNT(*) FROM ${出荷} s WHERE s."輸送ID" = p."輸送ID") AS "件数"
           FROM ${輸送計画} p WHERE p."chk" = false AND p."出荷計画日" <= $1::date ORDER BY p."出荷計画日", p."輸送ID"`,
          [今日],
        )
      ).rows;
      const u = (await c.query(`SELECT "更新時間" FROM ${利用者} ORDER BY "ID" LIMIT 1`)).rows[0];
      return { 今日, 入庫一覧, 便一覧, 前回: u?.更新時間 ?? null };
    }),
  );

  // 印の付け外し（入庫・便）
  app.post<{ Body: { 種類: "入庫" | "便"; id: number; 値: boolean } }>("/api/ws/koshin/chk", async (req, reply) => {
    const b = req.body;
    if (b.種類 === "入庫") await pool.query(`UPDATE ${入庫} SET "抽出区分" = $2 WHERE "入庫ID" = $1 AND "chk" = false`, [n(b.id), !!b.値]);
    else if (b.種類 === "便") await pool.query(`UPDATE ${輸送計画} SET "抽出区分" = $2 WHERE "輸送ID" = $1 AND "chk" = false`, [n(b.id), !!b.値]);
    else return reply.code(400).send({ error: "種類が正しくありません。" });
    return { ok: true };
  });

  // 更新（Access の cmd_Update_Click → CC_ZaikoUpdate）。更新の前に在庫を写す
  app.post<{ Body: { 更新日?: string } }>("/api/ws/koshin/run", async (req) =>
    一連で(async (c) => {
      // 同時に 2 人が更新しないように（Access の 更新中フラグ）
      await c.query(`SELECT pg_advisory_xact_lock(hashtext('在庫更新'))`);
      const now = 日本の今();
      const 更新日 = req.body.更新日 || now.日付;
      const 更新時間 = now.日時;
      await c.query(`DROP TABLE IF EXISTS ${在庫の写し}`);
      await c.query(`CREATE TABLE ${在庫の写し} AS SELECT * FROM ${在庫}`);
      const 入庫件数 = await 入庫登録(c, 更新日, 更新時間);
      await 集計(c);
      const 登録できない = await 出荷登録(c, 更新日, 更新時間, now.日付);
      await 集計(c);
      await c.query(`UPDATE ${利用者} SET "更新時間" = $1`, [更新時間]);
      return { 更新時間, 入庫件数, 登録できない, 在庫確認: await 在庫確認(c, 11, now.日付) };
    }),
  );

  // 在庫確認の工場を切り替える（11・191 など）
  app.get<{ Querystring: { kojo: string } }>("/api/ws/koshin/kakunin", async (req) => 在庫確認(pool, n(req.query.kojo) || 11, 日本の今().日付));

  // 元に戻す（Access の C_ZaikoRepare）：写した在庫に戻し、その更新で登録した入庫・出荷・便の印を外す
  app.post<{ Body: { 更新時間: string } }>("/api/ws/koshin/repair", async (req, reply) =>
    一連で(async (c) => {
      await c.query(`SELECT pg_advisory_xact_lock(hashtext('在庫更新'))`);
      const KT = String(req.body.更新時間 ?? "");
      const ある = (await c.query(`SELECT to_regclass('ws."TD_在庫BackUp"') AS r`)).rows[0]?.r;
      if (!KT || !ある) return reply.code(400).send({ error: "戻せる更新がありません。" });
      await c.query(`DELETE FROM ${在庫}`);
      await c.query(`INSERT INTO ${在庫} SELECT * FROM ${在庫の写し}`);
      await c.query(`UPDATE ${入庫} SET "chk" = false WHERE "更新時間" = $1`, [KT]);
      await c.query(`UPDATE ${出荷} SET "chk" = false WHERE "更新時間" = $1`, [KT]);
      await c.query(`UPDATE ${輸送計画} SET "chk" = false WHERE "更新時間" = $1`, [KT]);
      return { ok: true };
    }),
  );

  // 閉じたとき：入庫・便の印を外す（Access の cmdClose_Click）
  app.post("/api/ws/koshin/close", async () => {
    await pool.query(`UPDATE ${入庫} SET "抽出区分" = false WHERE "抽出区分" = true`);
    await pool.query(`UPDATE ${輸送計画} SET "抽出区分" = false WHERE "抽出区分" = true`);
    return { ok: true };
  });
}
