import type { FastifyInstance } from "fastify";
import type { PoolClient } from "pg";
import { q, t, 日本の今 } from "./db.js";
import { requireUser } from "./auth.js";
import { 一連で } from "./ws.js";

// 倉庫管理System（Access の 倉庫管理System.accdb）。外の冷蔵庫（ﾆﾁﾚｲ大谷地・大宮・高松東・寿 など）の在庫・出庫・名義変更・保管料。
// 丸北WorkStation は常に更新する形、倉庫管理は前日までで締めて更新する形（2026/10/23 利用者）。
// - 入庫の取り込み（メインメニューの［インポート］：LinkTable出荷Lord）：WorkStation で在庫更新が済んだ冷蔵庫あての出荷を、入庫待ち（TD_入庫）にする
// - 入庫登録（ｲﾝﾎﾟｰﾄ）（FM_入庫未登録一覧(ver2)：NyukoImport）：選んだ入庫待ちを在庫（TD_在庫）にする
export const 入庫待ち = t("soko", "TD_入庫");
export const 倉庫の在庫 = t("soko", "TD_在庫");
export const 倉庫の出荷 = t("soko", "TD_出荷");
export const 倉庫の便 = t("soko", "TD_輸送計画");
export const 倉庫詳細設定 = t("soko", "TD_倉庫詳細設定");
export const 倉庫のUSER = t("soko", "TD_USER");
const WSの出荷 = t("ws", "TD_出荷");
const WSの便 = t("ws", "TD_輸送計画");
const 得意先マスタ = t("kyotsu", "TM_得意先マスタ");
const 商品マスタ = t("kyotsu", "TM_商品マスタ");

type Rec = Record<string, any>;
const n = (v: unknown) => Number(v ?? 0) || 0;
const 日付 = (v: unknown) => (v ? String(v).slice(0, 10) : null);

/**
 * 保管の期（Access の Hokan期）。半月（1〜15 日・16 日〜末日）を 1 期として、入庫日の半月から基準日の半月までの数（両方を含む）。
 * 基準日を省くと今日。入庫日がなければ 0。
 */
export function 保管の期(入庫日: unknown, 基準日?: unknown): number {
  const a = 日付(入庫日);
  if (!a) return 0;
  const b = 日付(基準日) ?? 日本の今().日付;
  const 半月 = (d: string) => 2 * (Number(d.slice(0, 4)) * 12 + Number(d.slice(5, 7))) + (Number(d.slice(8, 10)) >= 16 ? 1 : 0);
  return 半月(b) - 半月(a) + 1;
}

/**
 * 入庫できるか（Access の NewkoCondition）。届け先が冷蔵庫（倉庫区分あり・出荷元でない）であること。
 * 得意先の入庫フラグが立っていれば、倉庫詳細設定にその冷蔵庫×名義があるときだけ。立っていなければ名義 11・137・150 だけ。
 */
export async function 入庫できる(c: PoolClient, 倉庫: unknown, 名義: unknown): Promise<boolean> {
  const m = (await c.query(`SELECT "倉庫区分", "出荷元区分", "入庫フラグ" FROM ${得意先マスタ} WHERE "短縮コード" = $1 LIMIT 1`, [n(倉庫)])).rows[0];
  if (!m || m.倉庫区分 !== true || m.出荷元区分 !== false) return false;
  if (m.入庫フラグ === true)
    return (await c.query(`SELECT 1 FROM ${倉庫詳細設定} WHERE "短縮コード" = $1 AND "名義コード" = $2 LIMIT 1`, [n(倉庫), n(名義)])).rows.length > 0;
  return [11, 137, 150].includes(n(名義));
}

/** 行を足す（項目名と値の組から INSERT を作る） */
export async function 行を足す(c: PoolClient, 表: string, v: Rec) {
  const k = Object.keys(v);
  await c.query(`INSERT INTO ${表} (${k.map((x) => `"${x}"`).join(", ")}) VALUES (${k.map((_, i) => `$${i + 1}`).join(", ")})`, k.map((x) => v[x]));
}

/** 在庫の行の初期値（Access の表の既定値：数は 0、はい／いいえは いいえ） */
export const 在庫の初期値: Rec = {
  短縮コード: 0, 分類ID: 0, 繰越ケース: 0, 製造ケース: 0, 出庫ケース: 0, 在庫ケース: 0, 繰越kg: 0, 製造kg: 0, 出荷kg: 0, 在庫kg: 0, 入庫元数: 0, 出庫回数: 0,
  未包装kg: 0, 抽出区分: false, 出荷止め区分: false, 入庫ID: 0, 振替ケース: 0, グループコード: 0, 商品区分: 0, 入出庫料: 0, 保管料: 0, 前期保管料: 0, 後期保管料: 0,
  サービス料: 0, 情報手数料: 0, その他費用: 0, 訂正金額: 0, 変更前在庫ID: 0, 確定フラグ: false, 不一致フラグ: false, 買取単価コード: 0, 請求年度: 0, ユーザーchk: false,
  名変回数: 0, 名変前在庫ID: 0, 入出庫料固定: false, 産地コード: 0, 手配元ID: 0, 手配帳合ID: 0, 指定最終届け先コード: 0, 仮入庫フラグ: false, パレット積載数: 0,
  空き予定パレット数: 0, パレット積載元数: 0, User賞味通知区分: 0, User賞味残日数: 0, サービス区分: false,
};

/** 番号を振る（今の最大＋1。同時に振らないよう鍵をかける） */
async function 次の番号(c: PoolClient, 表: string, 列: string) {
  await c.query(`SELECT pg_advisory_xact_lock(hashtext($1))`, [`${表}.${列}`]);
  return n((await c.query(`SELECT COALESCE(MAX("${列}"), 0) + 1 AS m FROM ${表}`)).rows[0].m);
}

/**
 * 入庫の取り込み（LinkTable出荷Lord）。WorkStation の出荷のうち、在庫更新済み（chk）・まだ取り込んでいない（出荷区分なし）・便に入っている、
 * 届け先が冷蔵庫で倉庫詳細設定にあるものを、入庫できる名義なら入庫待ちにし、WorkStation の出荷に「取り込んだ」印（出荷区分）を付ける。人参果汁DM（148）は入れない。
 */
async function 入庫を取り込む(c: PoolClient) {
  const rows = (
    await c.query(
      `SELECT s.* FROM ${WSの出荷} s JOIN ${WSの便} p ON p."輸送ID" = s."輸送ID" JOIN ${得意先マスタ} m ON m."短縮コード" = s."届け先コード"
       WHERE s."輸送ID" <> 0 AND COALESCE(s."出荷区分", false) = false AND s."chk" = true AND m."出荷元区分" = false AND m."倉庫区分" = true
         AND EXISTS (SELECT 1 FROM ${倉庫詳細設定} d WHERE d."短縮コード" = m."短縮コード")
       ORDER BY s."輸送ID", s."商品コード", s."製造日", p."運送会社ID"
       FOR UPDATE OF s`,
    )
  ).rows as Rec[];
  let 件数 = 0;
  for (const r of rows) {
    if (!(await 入庫できる(c, r.届け先コード, r.入庫後名義ID))) continue;
    if (n(r.商品コード) === 148) continue;
    await c.query(
      `INSERT INTO ${入庫待ち} ("出庫ID", "出荷日", "納品日", "倉庫ID", "倉庫名", "商品コード", "グループ商品コード", "商品名", "規格", "入数", "製造日", "賞味期限",
         "ケース", "商品kg", "入庫前名義ID", "入庫後名義ID", "届け先コード", "届け先", "サービス区分", "在庫ID", "インポートアドレス", "タグ", "タグ2", "商品状態隠語",
         "商品区分", "産地コード", "入庫時輸送ID", "運賃振分区分", "運賃振分区分名",
         "入庫フラグ", "完了フラグ", "抽出区分", "ｻﾝﾌﾟﾙ区分", "出荷区分", "chk", "仮入庫フラグ", "入庫ID", "買取単価コード")
       VALUES ($1, $2, $3, $4, $5, $6, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, 'WorkStation', $20, $21, $22, $23, $24, $25, $26, $27,
         true, false, false, false, false, false, false, 0, 0)`,
      [
        r.出庫ID, r.出荷日, r.納品日, r.倉庫ID, r.倉庫名, r.商品コード, r.商品名, r.規格, r.入数, r.製造日, r.賞味期限, r.ケース, r.商品kg, r.入庫前名義ID,
        r.入庫後名義ID, r.届け先コード, r.届け先, r.サービス区分, r.在庫ID, r.タグ, r.タグ2, r.商品状態隠語, r.商品区分, r.産地コード, r.輸送ID, r.運賃振分区分,
        r.運賃振分区分名,
      ],
    );
    await c.query(`UPDATE ${WSの出荷} SET "出荷区分" = true WHERE "出庫ID" = $1`, [r.出庫ID]);
    件数++;
  }
  await c.query(`UPDATE ${倉庫のUSER} SET "最終読込日" = $1`, [日本の今().日時]);
  return 件数;
}

/**
 * 入庫登録（NyukoImport）。選んだ（抽出区分）まだ登録していない入庫待ちを在庫にする。入庫日・保管料負担日は納品日。
 * 寿冷蔵（657）・大宮（321）に本社名義（629）で入るものは、別の倉庫（6676・3166）として登録する。
 * 同じ出庫ID の在庫がもうあれば、その在庫に「重複もしくは存在しないデータ」の印を付けるが、Access と同じく登録はする。
 */
async function 入庫を登録する(c: PoolClient) {
  const rows = (await c.query(`SELECT ctid, * FROM ${入庫待ち} WHERE "完了フラグ" = false AND "抽出区分" = true ORDER BY "出荷日", "届け先コード", "入庫後名義ID", "商品コード" FOR UPDATE`)).rows as Rec[];
  const 今 = 日本の今();
  for (const r of rows) {
    await c.query(`UPDATE ${倉庫の在庫} SET "不一致フラグ" = true, "不一致備考" = '重複もしくは存在しないデータ' WHERE "在庫ID" = (SELECT MIN("在庫ID") FROM ${倉庫の在庫} WHERE "出庫ID" = $1)`, [r.出庫ID]);
    const 倉庫 = n(r.届け先コード) === 657 && n(r.入庫後名義ID) === 629 ? 6676 : n(r.届け先コード) === 321 && n(r.入庫後名義ID) === 629 ? 3166 : n(r.届け先コード);
    const 倉庫名 = (await c.query(`SELECT "短縮名" FROM ${得意先マスタ} WHERE "短縮コード" = $1 LIMIT 1`, [倉庫])).rows[0]?.短縮名 ?? null;
    const g = (await c.query(`SELECT "グループ商品コード", "商品名" FROM ${商品マスタ} WHERE "商品コード" = $1 LIMIT 1`, [r.商品コード])).rows[0];
    const 管理備考 = r.仮入庫フラグ
      ? `仮入庫(${Number(String(r.出荷日).slice(5, 7))}/${Number(String(r.出荷日).slice(8, 10))}出荷　${Number(String(r.納品日).slice(5, 7))}/${Number(String(r.納品日).slice(8, 10))}納品)`
      : null;
    const 在庫ID = await 次の番号(c, 倉庫の在庫, "在庫ID");
    await 行を足す(c, 倉庫の在庫, {
      ...在庫の初期値,
      在庫ID, 倉庫ID: 倉庫, 倉庫名, 商品コード: r.商品コード, グループ商品コード: g?.グループ商品コード ?? null, 商品名: g?.商品名 ?? null, 規格: r.規格, 入数: r.入数,
      製造日: r.製造日, 賞味期限: r.賞味期限, 製造ケース: r.ケース, 製造kg: r.商品kg, 在庫ケース: r.ケース, 在庫kg: r.商品kg, 入庫元数: r.ケース,
      入庫後名義ID: r.入庫後名義ID, 出庫ID: r.出庫ID, 買取単価コード: r.買取単価コード, サービス区分: r.サービス区分, インポートアドレス: r.インポートアドレス,
      タグ: r.タグ, 商品状態隠語: r.商品状態隠語, 商品区分: r.商品区分, 産地コード: r.産地コード, タグ2: r.タグ2, 備考在庫: r.タグ2, 製造工場ID: r.倉庫ID, 製造工場名: r.倉庫名,
      管理備考, 入庫時輸送ID: r.入庫時輸送ID, 運賃振分区分: r.運賃振分区分, 運賃振分区分名: r.運賃振分区分名,
      入庫日: r.納品日, 保管料負担日: r.納品日, 期: 保管の期(r.納品日), 登録時間: 今.日時,
    });
    await c.query(`UPDATE ${入庫待ち} SET "完了フラグ" = true WHERE ctid = $1`, [r.ctid]);
  }
  return rows.length;
}

export function sokoRoutes(app: FastifyInstance) {
  app.addHook("preHandler", requireUser);

  // 入庫登録（ｲﾝﾎﾟｰﾄ）の一覧（FM_入庫未登録一覧(ver2)：入庫フラグあり・まだ登録していない入庫待ち）
  app.get("/api/soko/nyuko", async () => ({
    rows: await q(
      `SELECT ctid::text AS "鍵", "出庫ID", "出荷日"::date::text AS "出荷日", "納品日"::date::text AS "納品日", "倉庫ID", "倉庫名", "届け先コード", "届け先",
              "商品コード", "商品名", "規格", "入数", "ケース", "商品kg", "製造日"::date::text AS "製造日", "賞味期限"::date::text AS "賞味期限",
              "入庫前名義ID", "入庫後名義ID", (SELECT "短縮名" FROM ${得意先マスタ} m WHERE m."短縮コード" = i."入庫後名義ID" LIMIT 1) AS "入庫後名義",
              "タグ", "サービス区分", "抽出区分"
       FROM ${入庫待ち} i WHERE "入庫フラグ" = true AND "完了フラグ" = false
       ORDER BY "出荷日", "届け先コード", "入庫後名義ID", "商品コード"`,
    ),
    最終読込日: (await q(`SELECT "最終読込日" FROM ${倉庫のUSER} LIMIT 1`))[0]?.最終読込日 ?? null,
  }));

  // ［インポート］：WorkStation から入庫待ちを取り込む
  app.post("/api/soko/nyuko/import", async () => 一連で(async (c) => ({ 件数: await 入庫を取り込む(c) })));

  // 1 つの項目を直す（選ぶ・ケース・入庫後名義）。ケースを直すと 商品kg＝ケース×入数
  app.post<{ Body: { 鍵: string; 項目: string; 値: unknown } }>("/api/soko/nyuko/save", async (req, reply) => {
    const { 鍵, 項目 } = req.body;
    if (!["抽出区分", "ケース", "入庫後名義ID"].includes(項目)) return reply.code(400).send({ error: "この項目は直せません" });
    const 値 = 項目 === "抽出区分" ? req.body.値 === true : req.body.値 === "" || req.body.値 == null ? null : Math.trunc(Number(req.body.値));
    const r = await q(
      項目 === "ケース"
        ? `UPDATE ${入庫待ち} SET "ケース" = $2::int, "商品kg" = $2::int * "入数" WHERE ctid = $1::tid AND "完了フラグ" = false RETURNING 1`
        : `UPDATE ${入庫待ち} SET "${項目}" = $2 WHERE ctid = $1::tid AND "完了フラグ" = false RETURNING 1`,
      [鍵, 値],
    );
    if (!r.length) return reply.code(409).send({ error: "この行は変わっています。表示し直してください" });
    return { ok: true };
  });

  // 全部選ぶ・全部外す
  app.post<{ Body: { 選ぶ: boolean } }>("/api/soko/nyuko/all", async (req) => {
    await q(`UPDATE ${入庫待ち} SET "抽出区分" = $1 WHERE "入庫フラグ" = true AND "完了フラグ" = false`, [req.body.選ぶ === true]);
    return { ok: true };
  });

  app.post<{ Body: { 鍵: string } }>("/api/soko/nyuko/delete", async (req, reply) => {
    const r = await q(`DELETE FROM ${入庫待ち} WHERE ctid = $1::tid AND "完了フラグ" = false RETURNING 1`, [req.body.鍵]);
    if (!r.length) return reply.code(409).send({ error: "この行は変わっています。表示し直してください" });
    return { ok: true };
  });

  // ［登録］：選んだ入庫待ちを在庫にする。終わったら選んだ印を外す（Access は画面を閉じるときに外す）
  app.post("/api/soko/nyuko/register", async (req, reply) =>
    一連で(async (c) => {
      const 選んだ = n((await c.query(`SELECT COUNT(*) AS v FROM ${入庫待ち} WHERE "抽出区分" = true AND "完了フラグ" = false`)).rows[0].v);
      if (!選んだ) return reply.code(400).send({ error: "登録するレコードが選択されていません。" });
      const 件数 = await 入庫を登録する(c);
      await c.query(`UPDATE ${入庫待ち} SET "抽出区分" = false WHERE "抽出区分" = true`);
      return { 件数 };
    }),
  );
}
