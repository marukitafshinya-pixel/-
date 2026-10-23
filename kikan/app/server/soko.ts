import type { FastifyInstance } from "fastify";
import type { PoolClient } from "pg";
import { q, t, 日本の今 } from "./db.js";
import { requireUser } from "./auth.js";
import { 一連で, 賞味期限計算 } from "./ws.js";
import { 期限通知 } from "./wsZaiko.js";
import { cint } from "./hanmori.js";

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
export const 倉庫の名変 = t("soko", "TD_在庫変更");
export const 費用月別集計 = t("soko", "TD_在庫費用月別集計");
const 買取単価マスタ = t("ws_fe", "TM_買取単価マスタ"); // Access は［インポート］のたびに WorkStation から写し直している
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

// ---------------- 料金（M_保管賃計算） ----------------

/** 倉庫詳細設定のその冷蔵庫×名義の行（表の並び＝ID 順） */
async function 設定の行(c: PoolClient, 倉庫: unknown, 名義: unknown): Promise<Rec[]> {
  return (await c.query(`SELECT * FROM ${倉庫詳細設定} WHERE "短縮コード" = $1 AND "名義コード" = $2 ORDER BY "ID"`, [n(倉庫), n(名義)])).rows;
}
async function グループ商品コード(c: PoolClient, 商品: unknown): Promise<number | null> {
  const v = (await c.query(`SELECT "グループ商品コード" FROM ${商品マスタ} WHERE "商品コード" = $1 LIMIT 1`, [n(商品)])).rows[0]?.グループ商品コード;
  return v == null ? null : Number(v);
}
const 以下 = (a: unknown, b: unknown) => a != null && b != null && String(a).slice(0, 10) <= String(b).slice(0, 10);

/**
 * 出庫・名変の行の保管料（Access の Sum保管料。契約の期間を見ない古い計算）。商品のグループ商品コード、なければ標準（商品 0）の設定で、
 * 最低保管kg 以下なら最低保管料（期数は掛けない）、ほかは 単価×kg（期数が 2 以上なら ×期数）。
 */
export async function 行の保管料(c: PoolClient, 倉庫: unknown, 名義: unknown, 商品: unknown, kg: number, 期数 = 1, 加算 = 0): Promise<number> {
  const rows = await 設定の行(c, 倉庫, 名義);
  const g = await グループ商品コード(c, 商品);
  const f = (g != null ? rows.find((r) => n(r.商品コード) === g) : undefined) ?? rows.find((r) => n(r.商品コード) === 0);
  let 単価 = 0;
  if (f) {
    if (kg <= n(f.最低保管kg)) return n(f.最低保管料);
    単価 = n(f.保管料);
  }
  return 期数 > 1 ? 加算 + 単価 * kg * 期数 : 単価 * kg;
}

/**
 * 入出庫料（Access の Sum入出庫料）。保管料負担日が契約の期間に入り、終了日が集計日以後の設定（グループ商品コード、なければ標準）で、
 * 最低入出庫kg 以下なら最低入出庫料、ほかは 単価×kg（計算単位 1 はケース単価：単価×kg÷入数）。日付を渡さないとき（締め・日時更新）は合う設定がなく 0。
 */
export async function 入出庫料(c: PoolClient, 倉庫: unknown, 名義: unknown, 商品: unknown, kg: number, 集計日?: string | null, 負担日?: string | null): Promise<number> {
  if (!集計日 || !負担日) return 0;
  const rows = await 設定の行(c, 倉庫, 名義);
  const g = await グループ商品コード(c, 商品);
  const 合う = (r: Rec) => 以下(r.契約入庫日開始, 負担日) && 以下(負担日, r.契約入庫日終了) && 以下(集計日, r.終了日);
  const f = (g != null ? rows.find((r) => n(r.商品コード) === g && 合う(r)) : undefined) ?? rows.find((r) => n(r.商品コード) === 0 && 合う(r));
  if (!f) return 0;
  if (f.最低入出庫kg != null && kg <= Number(f.最低入出庫kg)) return n(f.最低入出庫料);
  const 単価 = n(f.入出庫料);
  if (n(f.計算単位) === 1) {
    const 入数 = n((await c.query(`SELECT "入数" FROM ${商品マスタ} WHERE "商品コード" = $1 LIMIT 1`, [n(商品)])).rows[0]?.入数);
    return 入数 ? 単価 * (kg / 入数) : 0;
  }
  return 単価 * kg;
}

// ---------------- 前日締め（M_在庫集計Ver3 の CC_ZaikoSum）と日時更新（CC_SokoSum） ----------------

/**
 * 出庫の登録（CC_Sykei）。出荷日が更新日以前でまだ登録していない出庫（便を指定したときはその便だけ）を、出荷日の順に在庫から引く。
 * 出庫の行には 登録の印・出荷期数・保管料・入出庫料・買取の値・更新日・更新時間 を入れる。届け先が入庫できる冷蔵庫なら 入庫フラグ（冷蔵庫間の移動）。
 */
async function 出庫を登録する(c: PoolClient, 更新日: string, 更新時間: string, 輸送ID?: number) {
  if (輸送ID) await c.query(`UPDATE ${倉庫の便} SET "更新時間" = $2, "chk" = true WHERE "輸送ID" = $1`, [輸送ID, 更新時間]);
  const rows = (
    await c.query(
      `SELECT * FROM ${倉庫の出荷} WHERE "出荷日" <= $1::date AND "chk" = false ${輸送ID ? `AND "輸送ID" = $2` : ""} ORDER BY "出荷日", "出庫ID" FOR UPDATE`,
      輸送ID ? [更新日, 輸送ID] : [更新日],
    )
  ).rows as Rec[];
  const 今 = 日本の今().日時;
  for (const r of rows) {
    await c.query(
      `UPDATE ${倉庫の在庫} SET "出庫回数" = "出庫回数" + 1, "出庫ケース" = "出庫ケース" + $2, "出荷kg" = "出荷kg" + $3, "登録時間" = $4 WHERE "在庫ID" = $1`,
      [r.在庫ID, r.ケース, r.商品kg, 今],
    );
    const v: Rec = {};
    // Access はサービス区分の出庫で「サービス料」に保管料を写そうとするが、出庫の表にその項目はない
    if (await 入庫できる(c, r.届け先コード, r.入庫後名義ID)) v.入庫フラグ = true;
    const kg = n(r.商品kg);
    v.chk = true;
    v.出荷期数 = 保管の期(r.入庫日, r.出荷日);
    v.保管料 = await 行の保管料(c, r.倉庫ID, r.入庫前名義ID, r.商品コード, kg, v.出荷期数);
    v.入出庫料 = await 入出庫料(c, r.倉庫ID, r.入庫前名義ID, r.商品コード, kg);
    v.買取単価コード = n(r.買取単価コード);
    const 買取 = (await c.query(`SELECT "年度", "単価" FROM ${買取単価マスタ} WHERE "ID" = $1 LIMIT 1`, [v.買取単価コード])).rows[0];
    v.支払区分 = 買取?.年度 ?? null;
    v.買取金額 = 買取 && r.商品kg != null && 買取.単価 != null ? Number(r.商品kg) * Number(買取.単価) : null;
    v.更新日 = 更新日;
    v.更新時間 = 更新時間;
    const k = Object.keys(v);
    await c.query(`UPDATE ${倉庫の出荷} SET ${k.map((x, i) => `"${x}" = $${i + 2}`).join(", ")} WHERE "出庫ID" = $1`, [r.出庫ID, ...k.map((x) => v[x])]);
  }
  return rows.length;
}

/**
 * 在庫の集計（CC_Zaikei）。確定していないロットの 在庫＝繰越＋入庫−出庫。在庫が 0 になったら最終出庫日（最後の出荷日と最後の名変の譲渡人負担日の遅い方）。
 * 分類ID・認識ID が空なら補い、賞味期限が空なら製造日から出す。
 */
async function 在庫を集計する(c: PoolClient, 今日: string) {
  const rows = (await c.query(`SELECT * FROM ${倉庫の在庫} WHERE "確定フラグ" = false ORDER BY "在庫ID" FOR UPDATE`)).rows as Rec[];
  for (const z of rows) {
    const v: Rec = { 作成日付: 今日 };
    const ケース = z.繰越ケース == null || z.製造ケース == null || z.出庫ケース == null ? null : Number(z.繰越ケース) + Number(z.製造ケース) - Number(z.出庫ケース);
    if (ケース != null) v.在庫ケース = ケース;
    if (z.繰越kg != null && z.製造kg != null && z.出荷kg != null) v.在庫kg = Number(z.繰越kg) + Number(z.製造kg) - Number(z.出荷kg);
    if (ケース === 0) {
      v.在庫kg = 0;
      const 出荷 = (await c.query(`SELECT MAX("出荷日")::date::text AS v FROM ${倉庫の出荷} WHERE "在庫ID" = $1`, [z.在庫ID])).rows[0].v;
      const 名変 = (await c.query(`SELECT MAX("譲渡人負担日")::date::text AS v FROM ${倉庫の名変} WHERE "在庫No" = $1`, [z.在庫ID])).rows[0].v;
      const 最後 = [出荷, 名変].filter(Boolean).sort().pop();
      if (最後) v.最終出庫日 = 最後;
    }
    // Access はここで期も出し直そうとするが、書き損じで何もしない
    if (!n(z.分類ID)) v.分類ID = n((await c.query(`SELECT "分類ID" FROM ${商品マスタ} WHERE "商品コード" = $1 LIMIT 1`, [z.商品コード])).rows[0]?.分類ID);
    if (z.認識ID == null && z.製造日 && z.入庫日)
      v.認識ID = `${n(z.倉庫ID)}${n(z.商品コード)}${通し番号(z.製造日)}${通し番号(z.入庫日)}`;
    if (z.賞味期限 == null) v.賞味期限 = await 賞味期限計算(c, 日付(z.製造日), z.商品コード);
    const k = Object.keys(v);
    await c.query(`UPDATE ${倉庫の在庫} SET ${k.map((x, i) => `"${x}" = $${i + 2}`).join(", ")} WHERE "在庫ID" = $1`, [z.在庫ID, ...k.map((x) => v[x])]);
  }
}
/** Access の日付の通し番号（CLng(日付)） */
const 通し番号 = (v: unknown) => Math.round((Date.parse(String(v).slice(0, 10) + "T00:00:00Z") - Date.UTC(1899, 11, 30)) / 86400000);

/**
 * 前日締め（CC_ZaikoSum）。更新日（ふつうは昨日）までの出庫を在庫から引き、在庫を集計し、締めた日を TD_USER に書く。
 * Access と同じく、更新日が出荷計画日の便でまだ登録していないものは全部「登録済み」にする（便を指定した［完了］でも同じ。Access の書き損じ）。
 */
export async function 締める(c: PoolClient, 更新日: string, 輸送ID?: number) {
  const 今 = 日本の今();
  if (更新日 > 今.日付) throw Object.assign(new Error("当日以降の日付の場合は登録出来ません"), { statusCode: 400 });
  const 件数 = await 出庫を登録する(c, 更新日, 今.日時, 輸送ID);
  await 在庫を集計する(c, 今.日付);
  await c.query(`UPDATE ${倉庫のUSER} SET "前回更新日" = $1::date`, [更新日]);
  await c.query(`UPDATE ${倉庫の便} SET "更新時間" = $2, "chk" = true WHERE "出荷計画日" = $1::date AND "chk" = false`, [更新日, 今.日時]);
  await c.query(`UPDATE ${倉庫のUSER} SET "更新時間" = $1`, [今.日時]);
  return 件数;
}

/** Access の C_USER期限通知（ユーザー賞味の残り日数で 3・2・1・0、120 日より先は 99。残り日数も返す） */
function ユーザー期限通知(賞味期限: string, 残日数設定: number, 今日: string): { 区分: number; 残日数: number } {
  if (残日数設定 === 0) return { 区分: 99, 残日数: 0 };
  const 残 = Math.round((Date.parse(賞味期限.slice(0, 10) + "T00:00:00Z") - Date.parse(今日 + "T00:00:00Z")) / 86400000) - 残日数設定;
  if (残 > 120) return { 区分: 99, 残日数: 0 };
  const 区分 = 残 >= 61 ? 3 : 残 >= 31 ? 2 : 残 >= 1 ? 1 : 0;
  return { 区分, 残日数: 残 };
}

/**
 * 日時更新（CC_SokoSum。日付が変わって最初に開いたとき）。在庫を集計したあと、確定していないロットごとに
 * 賞味期限の通知、分類ID、繰越（入庫・出庫を 0 にして在庫を繰越に）、最終出庫日から 2 か月たったら確定、期、入出庫料、保管料・サービス料（費用月別集計の合計）を入れる。
 */
export async function 日時更新(c: PoolClient) {
  const 今日 = 日本の今().日付;
  await 在庫を集計する(c, 今日);
  const rows = (await c.query(`SELECT * FROM ${倉庫の在庫} WHERE "確定フラグ" = false ORDER BY "在庫ID" FOR UPDATE`)).rows as Rec[];
  for (const z of rows) {
    const v: Rec = { 作成日付: 今日 };
    if (z.賞味期限 && n(z.在庫ケース) !== 0) {
      v.賞味期限通知 = 期限通知(日付(z.賞味期限)) || null; // 通知なしは空（Access の "" は移したデータでは空になっている）
      const 設定 = (await c.query(`SELECT "USER賞味残日数" AS v FROM ${商品マスタ} WHERE "商品コード" = $1 LIMIT 1`, [z.商品コード])).rows[0]?.v ?? null;
      v.User賞味残日数 = 設定;
      if (n(設定) !== 0) {
        const u = ユーザー期限通知(String(z.賞味期限), n(設定), 今日);
        v.User賞味通知区分 = u.区分;
        if (u.残日数 <= 90) v.通知 = `ﾕｰｻﾞｰ賞味   ${u.残日数}日`;
      }
    }
    v.分類ID = n((await c.query(`SELECT "分類ID" FROM ${商品マスタ} WHERE "商品コード" = $1 LIMIT 1`, [z.商品コード])).rows[0]?.分類ID);
    Object.assign(v, { 製造ケース: 0, 製造kg: 0, 出庫ケース: 0, 出荷kg: 0, 繰越ケース: z.在庫ケース, 繰越kg: z.在庫kg });
    if (z.最終出庫日) {
      const d = new Date(String(z.最終出庫日).slice(0, 10) + "T00:00:00Z");
      const 月 = d.getUTCMonth() + 2;
      const 二か月後 = new Date(Date.UTC(d.getUTCFullYear(), 月, Math.min(d.getUTCDate(), new Date(Date.UTC(d.getUTCFullYear(), 月 + 1, 0)).getUTCDate())));
      if (二か月後.toISOString().slice(0, 10) < 今日) v.確定フラグ = true;
    }
    v.期 = 保管の期(z.保管料負担日, z.最終出庫日 ?? 今日);
    // 在庫の表の料金は整数の項目（Access は入れるときに偶数への丸め）
    v.入出庫料 = cint(await 入出庫料(c, z.倉庫ID, z.入庫後名義ID, z.商品コード, n(z.入庫元数) * n(z.入数)));
    const 費用 = (await c.query(`SELECT COALESCE(SUM("保管料"), 0) AS a, COALESCE(SUM("サービス料"), 0) AS b FROM ${費用月別集計} WHERE "在庫ID" = $1`, [z.在庫ID])).rows[0];
    v.保管料 = cint(Number(費用.a));
    v.サービス料 = cint(Number(費用.b));
    const k = Object.keys(v);
    await c.query(`UPDATE ${倉庫の在庫} SET ${k.map((x, i) => `"${x}" = $${i + 2}`).join(", ")} WHERE "在庫ID" = $1`, [z.在庫ID, ...k.map((x) => v[x])]);
  }
  await c.query(`UPDATE ${倉庫のUSER} SET "日時更新日" = $1::date`, [今日]);
}

export function sokoRoutes(app: FastifyInstance) {
  app.addHook("preHandler", requireUser);

  // 倉庫管理を開いたときの様子（前回の締め・日時更新、入庫待ちなど。Access の C_StartUp と C_変更報告通知）
  app.get("/api/soko/status", async () => {
    const u = (await q(`SELECT "前回更新日"::date::text AS "前回更新日", "日時更新日"::date::text AS "日時更新日", "更新時間" FROM ${倉庫のUSER} LIMIT 1`))[0] ?? {};
    const 今日 = 日本の今().日付;
    const 日数 = (d: string | null) => (d ? Math.round((Date.parse(今日) - Date.parse(d)) / 86400000) : 0);
    return {
      ...u,
      今日,
      締めていない日数: 日数(u.前回更新日),
      日時更新がまだ: 日数(u.日時更新日) > 0,
      冷蔵庫間の入庫待ち: n((await q(`SELECT COUNT(*) AS v FROM ${倉庫の出荷} WHERE "入庫フラグ" = true AND "完了フラグ" = false`))[0].v),
      入庫待ち: n((await q(`SELECT COUNT(*) AS v FROM ${入庫待ち} WHERE "入庫フラグ" = true AND "完了フラグ" = false`))[0].v),
    };
  });

  // 前日締め：昨日（または指定した日）までの出庫を在庫から引く
  app.post<{ Body: { 日付?: string } }>("/api/soko/shime", async (req) => {
    const 昨日 = new Date(Date.parse(日本の今().日付) - 86400000).toISOString().slice(0, 10);
    const 日 = /^\d{4}-\d{2}-\d{2}$/.test(req.body?.日付 ?? "") ? req.body.日付! : 昨日;
    return 一連で(async (c) => ({ 件数: await 締める(c, 日) }));
  });

  // 日時更新（日付が変わって最初に開いたとき）
  app.post("/api/soko/nichiji", async () =>
    一連で(async (c) => {
      const u = (await c.query(`SELECT "日時更新日"::date::text AS d FROM ${倉庫のUSER} LIMIT 1 FOR UPDATE`)).rows[0];
      if (u?.d && u.d >= 日本の今().日付) return { した: false };
      await 日時更新(c);
      return { した: true };
    }),
  );

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
