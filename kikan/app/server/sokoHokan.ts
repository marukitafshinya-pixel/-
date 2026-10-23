import type { FastifyInstance } from "fastify";
import type { PoolClient } from "pg";
import { q, t, 日本の今 } from "./db.js";
import { requireUser } from "./auth.js";
import { 一連で, 賞味期限計算 } from "./ws.js";
import { cint } from "./hanmori.js";
import { 一覧のExcel } from "./excel.js";
import { 倉庫の在庫, 倉庫の出荷, 倉庫の名変, 倉庫詳細設定, 倉庫のUSER, 費用月別集計, 入庫待ち, 保管の期, 入出庫料, 行を足す, 在庫の初期値, 次の番号 } from "./soko.js";
import { 出荷チェック } from "./sokoShukko.js";

// 倉庫管理System の倉庫商品一覧（Access の FM_保管倉庫・FM_保管倉庫_訂正・FM_保管庫詳細・FM_入庫履歴）と、
// ロットごとの保管料の計算（SumAuto倉庫詳細）、開くときの点検（C_UnMachCheck）。
const 得意先マスタ = t("kyotsu", "TM_得意先マスタ");
const 商品マスタ = t("kyotsu", "TM_商品マスタ");
const WSの出荷 = t("ws", "TD_出荷");

type Rec = Record<string, any>;
const n = (v: unknown) => Number(v ?? 0) || 0;
const 日付 = (v: unknown) => (v ? String(v).slice(0, 10) : null);
const 日を足す = (d: string, k: number) => new Date(Date.parse(d + "T00:00:00Z") + k * 86400000).toISOString().slice(0, 10);

/** 半月の初日・末日（Access の HokanKijitu(日, False / True)） */
export function 半月の初日(d: string): string {
  return d.slice(0, 8) + (Number(d.slice(8, 10)) <= 15 ? "01" : "16");
}
export function 半月の末日(d: string): string {
  if (Number(d.slice(8, 10)) <= 15) return d.slice(0, 8) + "15";
  return new Date(Date.UTC(Number(d.slice(0, 4)), Number(d.slice(5, 7)), 0)).toISOString().slice(0, 10);
}

/** 小数点の計算（Access の My小数点計算。小数第 1 位だけを見る。1＝四捨五入、2＝繰上げ、3＝繰下げ、ほかはそのまま） */
export function 小数点計算(v: number, 方法: number): number {
  const s = String(v);
  const i = s.indexOf(".");
  if (i < 0) return v;
  const 第1位 = Number(s[i + 1]);
  const 整数 = Number(s.slice(0, i));
  if (方法 === 1) return 第1位 >= 5 ? 整数 + 1 : 整数;
  if (方法 === 2) return 整数 + 1;
  if (方法 === 3) return 整数;
  return v;
}

const 以下 = (a: unknown, b: unknown) => a != null && b != null && String(a).slice(0, 10) <= String(b).slice(0, 10);

/**
 * 1 期分の保管料（Access の Sum保管料計算）。保管料負担日が契約の期間に入り、終了日が集計日（請求する半月の初日）以後の設定を、
 * 商品コード（グループではなくその商品）、なければ標準（商品 0）で探す。kg が 最低保管kg 以下なら最低保管料（初回だけの設定なら単価。
 * Access は期を渡さないので、初回だけの設定はいつも単価）、ほかは 単価×kg（計算単位 1 はケース単価：単価×kg÷入数）。合う設定がなければ 0。
 */
async function 期の保管料(c: PoolClient, 倉庫: unknown, 名義: unknown, 商品: unknown, kg: number, 集計日: string, 負担日: string | null): Promise<number> {
  if (kg === 0) return 0;
  const rows = (await c.query(`SELECT * FROM ${倉庫詳細設定} WHERE "短縮コード" = $1 AND "名義コード" = $2 ORDER BY "ID"`, [n(倉庫), n(名義)])).rows as Rec[];
  const 合う = (r: Rec) => 以下(r.契約入庫日開始, 負担日) && 以下(負担日, r.契約入庫日終了) && 以下(集計日, r.終了日);
  const f = rows.find((r) => n(r.商品コード) === n(商品) && 合う(r)) ?? rows.find((r) => n(r.商品コード) === 0 && 合う(r));
  if (!f) return 0;
  let 単価: number;
  if (kg <= n(f.最低保管kg)) {
    if (f.初回最低保管料のみ適用 !== true) return n(f.最低保管料);
    単価 = n(f.保管料);
  } else 単価 = n(f.保管料);
  if (n(f.計算単位) === 1) {
    const 入数 = cint(n((await c.query(`SELECT "入数" FROM ${商品マスタ} WHERE "商品コード" = $1 LIMIT 1`, [n(商品)])).rows[0]?.入数));
    return 入数 ? 単価 * (kg / 入数) : 0;
  }
  return 単価 * kg;
}

/** 荷役料（Access の Sum荷役料）。その商品の設定があればその荷役料、なければ標準（商品 0）の荷役料 × kg。標準の設定の小数点区分で丸める */
async function 荷役料(c: PoolClient, 倉庫: unknown, 名義: unknown, 商品: unknown, kg: number): Promise<number> {
  const 設定 = async (商品コード: number) =>
    (await c.query(`SELECT "商品コード", "荷役料", "小数点区分" FROM ${倉庫詳細設定} WHERE "短縮コード" = $1 AND "名義コード" = $2 AND "商品コード" = $3 ORDER BY "ID" LIMIT 1`, [n(倉庫), n(名義), 商品コード])).rows[0];
  const その商品 = await 設定(n(商品));
  const 標準 = await 設定(0);
  const 単価 = n(その商品?.商品コード) === 0 ? n(標準?.荷役料) : n(その商品.荷役料);
  return 小数点計算(単価 * kg, n(標準?.小数点区分));
}

/**
 * ロットごとの保管料の明細を作り直す（Access の SumAuto倉庫詳細）。費用月別集計のそのロットの行を消し、期ごとに 1 行作る。
 * 1 期目の集計は保管料負担日の半月の一つ前の半月から。期ごとに、その期の末日までの出庫（登録していないものも）と名変（譲渡人負担日）を入庫元数から引いた数に、
 * 次の半月（請求する半月）の保管料をかける。1 期目は入出庫料（名変でできたロットは 0）と荷役料。サービス区分のロットは 1 期目の保管料をサービス料にする。
 * 今日の半月を超える期は作らない。入庫元数が 0 なら作らない。確定も＝false のときは確定したロットは何もしない。
 */
export async function 保管料の明細を作る(c: PoolClient, 在庫ID: number, 確定も = false): Promise<number> {
  const z = (await c.query(`SELECT * FROM ${倉庫の在庫} WHERE "在庫ID" = $1 ${確定も ? "" : `AND "確定フラグ" = false`}`, [在庫ID])).rows[0] as Rec | undefined;
  if (!z) return 0;
  await c.query(`DELETE FROM ${費用月別集計} WHERE "在庫ID" = $1`, [在庫ID]);
  const 負担日 = 日付(z.保管料負担日);
  if (!負担日 || n(z.入庫元数) === 0) return 0;
  const 今 = 日本の今().日付;
  const 今の末日 = 半月の末日(今);
  const 最初 = 半月の初日(日を足す(半月の初日(負担日), -1));
  const 名義名 = (await c.query(`SELECT "短縮名" FROM ${得意先マスタ} WHERE "短縮コード" = $1 LIMIT 1`, [n(z.入庫後名義ID)])).rows[0]?.短縮名 ?? null;
  const 出 = (await c.query(`SELECT "出荷日"::date::text AS d, "ケース", "商品kg" FROM ${倉庫の出荷} WHERE "在庫ID" = $1 AND "出荷日" >= $2::date`, [在庫ID, 最初])).rows as Rec[];
  const 名 = (await c.query(`SELECT "譲渡人負担日"::date::text AS d, "ケース", "商品kg" FROM ${倉庫の名変} WHERE "在庫No" = $1 AND "譲渡人負担日" >= $2::date`, [在庫ID, 最初])).rows as Rec[];
  const 元kg = n(z.入庫元数) * n(z.入数);
  let 始 = 最初;
  let 件数 = 0;
  let ID = await 次の番号(c, 費用月別集計, "ID");
  for (let k = 1; k <= n(z.期); k++) {
    const 終 = 半月の末日(始);
    if (終 > 今の末日) break;
    const まで = (rows: Rec[], key: string) => rows.filter((r) => r.d <= 終).reduce((a, r) => a + n(r[key]), 0);
    const ケース = n(z.入庫元数) - まで(出, "ケース") - まで(名, "ケース");
    let kg = 元kg - まで(出, "商品kg") - まで(名, "商品kg");
    const 開始期間 = 日を足す(終, 1);
    const 終了期間 = 半月の末日(開始期間);
    let 入出 = 0;
    let その他 = 0;
    if (k === 1 && n(z.名変前在庫ID) === 0) {
      入出 = await 入出庫料(c, z.倉庫ID, z.入庫後名義ID, z.商品コード, kg, 開始期間, 負担日);
      その他 = await 荷役料(c, z.倉庫ID, z.入庫後名義ID, z.商品コード, kg);
    }
    let 保管料: number;
    if (n(z.倉庫ID) === 6706) {
      // 寿冷蔵（尼崎）は kg と保管料を四捨五入する
      kg = 小数点計算(kg, 1);
      保管料 = 小数点計算(await 期の保管料(c, z.倉庫ID, z.入庫後名義ID, z.商品コード, kg, 開始期間, 負担日), 1);
    } else 保管料 = await 期の保管料(c, z.倉庫ID, z.入庫後名義ID, z.商品コード, kg, 開始期間, 負担日);
    let サービス料 = 0;
    if (k === 1 && z.サービス区分 === true) {
      const 末尾 = String(元kg).slice(-1);
      サービス料 = n(z.倉庫ID) === 321 && 末尾 !== "0" ? 保管料 + 5 : 保管料;
    }
    await 行を足す(c, 費用月別集計, {
      ID: ID++, 在庫ID, 作成日付: 今, 集計開始日: 始, 集計終了日: 終, 期: k, 倉庫No: z.倉庫ID, 倉庫名: z.倉庫名, 入庫No: z.入庫No,
      入庫後名義ID: z.入庫後名義ID, 名義名, 商品コード: z.商品コード, 商品名: z.商品名, 入庫日: z.入庫日, 製造日: z.製造日, 賞味期限: z.賞味期限, 入庫元数: z.入庫元数,
      ケース: cint(ケース), 商品kg: kg, 入出庫料: 入出, 保管料, サービス料, 情報手数料: 0, その他費用: cint(その他), 訂正金額: 0, 出庫ID: 0, 開始期間, 終了期間,
    });
    件数++;
    始 = 日を足す(終, 1);
  }
  return 件数;
}

// ---------------- 開くときの点検（M_アンマッチ の C_UnMachCheck） ----------------

/**
 * 入庫待ちを WorkStation の出荷と合わせる（C_入庫出力済みチェック）。出荷日が今日の前後 期間 日の入庫待ちを、WorkStation の出荷（出庫ID）の今の値で上書きする。
 * WorkStation に同じ期間の出荷がなければ、Access と同じく入庫待ちの行を消す。
 */
async function 入庫待ちを合わせる(c: PoolClient, 期間: number, 今: string) {
  const 始 = 日を足す(今, -期間);
  const 終 = 日を足す(今, 期間);
  const rows = (await c.query(`SELECT ctid, "出庫ID" FROM ${入庫待ち} WHERE "出荷日" BETWEEN $1::date AND $2::date`, [始, 終])).rows as Rec[];
  for (const r of rows) {
    const s = (await c.query(`SELECT * FROM ${WSの出荷} WHERE "出荷日" BETWEEN $1::date AND $2::date AND "出庫ID" = $3 LIMIT 1`, [始, 終, n(r.出庫ID)])).rows[0];
    if (!s) {
      await c.query(`DELETE FROM ${入庫待ち} WHERE ctid = $1`, [r.ctid]);
      continue;
    }
    await c.query(
      `UPDATE ${入庫待ち} SET "出荷日" = $2, "納品日" = $3, "倉庫ID" = $4, "倉庫名" = $5, "商品コード" = $6, "商品名" = $7, "規格" = $8, "入数" = $9, "製造日" = $10,
         "賞味期限" = $11, "ケース" = $12, "商品kg" = $13, "入庫後名義ID" = $14, "届け先コード" = $15, "届け先" = $16, "サービス区分" = $17 WHERE ctid = $1`,
      [r.ctid, s.出荷日, s.納品日, s.倉庫ID, s.倉庫名, s.商品コード, s.商品名, s.規格, s.入数, s.製造日, s.賞味期限, s.ケース, s.商品kg, s.入庫後名義ID, s.届け先コード, s.届け先, s.サービス区分],
    );
  }
}

/** 在庫と入庫待ちを比べて 不一致フラグ・不一致備考 を付ける（C_入庫チェック）。不一致の印のあるロットと、入庫日が今日の 期間 日前〜期間＋5 日後のロット */
async function 入庫を比べる(c: PoolClient, 期間: number, 今: string) {
  const lots = (
    await c.query(`SELECT * FROM ${倉庫の在庫} WHERE "不一致フラグ" = true OR ("出庫ID" <> 0 AND "入庫日" BETWEEN $1::date AND $2::date) ORDER BY "在庫ID"`, [
      日を足す(今, -期間),
      日を足す(今, 5 + 期間),
    ])
  ).rows as Rec[];
  // Access の「<>」は片方が空なら違うとしない
  const 違う = (a: unknown, b: unknown) => a != null && b != null && String(a) !== String(b);
  const 数が違う = (a: unknown, b: unknown) => a != null && b != null && Number(a) !== Number(b);
  for (const z of lots) {
    const r = (await c.query(`SELECT * FROM ${入庫待ち} WHERE "出庫ID" = $1 LIMIT 1`, [n(z.出庫ID)])).rows[0];
    let 印: boolean;
    let 備考: string;
    if (!r) {
      印 = true;
      備考 = "元になる入庫データが存在しません!";
    } else {
      印 = !z.入庫No;
      備考 = 印 ? "入庫No未入力" : "";
      const 足す = (語: string, 区切り: string) => {
        印 = true;
        備考 += (備考 === "" ? "" : 区切り) + 語;
      };
      if (数が違う(z.商品コード, r.商品コード)) 足す("商品名", " ");
      if (数が違う(z.入庫元数, r.ケース)) 足す("入庫元数", "\r\n");
      if (違う(z.入庫日, r.納品日)) 足す("入庫日", " ");
      if (違う(z.製造日, r.製造日)) 足す("製造日", "\r\n");
      if (違う(z.賞味期限, r.賞味期限)) 足す("賞味期限", " ");
      if (数が違う(z.入庫後名義ID, r.入庫後名義ID)) 足す("名義", "\r\n");
    }
    if (印 !== z.不一致フラグ || 備考 !== (z.不一致備考 ?? null))
      await c.query(`UPDATE ${倉庫の在庫} SET "不一致フラグ" = $2, "不一致備考" = $3 WHERE "在庫ID" = $1`, [z.在庫ID, 印, 備考]);
  }
}

/** 同じ出庫ID のロットが 2 つ以上あれば、最初のロットに「重複入庫 n 件あり」（C_入庫重複チェック） */
async function 重複を探す(c: PoolClient) {
  const rows = (await c.query(`SELECT "出庫ID", COUNT(*) AS k FROM ${倉庫の在庫} WHERE "出庫ID" <> 0 GROUP BY "出庫ID" HAVING COUNT(*) > 1`)).rows as Rec[];
  for (const r of rows)
    await c.query(
      `UPDATE ${倉庫の在庫} SET "不一致フラグ" = true, "不一致備考" = COALESCE("不一致備考", '') || CASE WHEN COALESCE("不一致備考", '') = '' THEN '' ELSE ' ' END || $2
       WHERE "在庫ID" = (SELECT MIN("在庫ID") FROM ${倉庫の在庫} WHERE "出庫ID" = $1)`,
      [r.出庫ID, `重複入庫 ${r.k} 件あり`],
    );
}

/** 開くときの点検（C_UnMachCheck）。期間は TD_USER のチェック期間 */
export async function アンマッチ(c: PoolClient) {
  const 期間 = n((await c.query(`SELECT "チェック期間" FROM ${倉庫のUSER} LIMIT 1`)).rows[0]?.チェック期間);
  const 今 = 日本の今().日付;
  await 入庫待ちを合わせる(c, 期間, 今);
  await 入庫を比べる(c, 期間, 今);
  await 重複を探す(c);
  await 出荷チェック(c);
}

// ---------------- 画面 ----------------

/** 在庫表示（-1＝全表示、0＝通常：40 日以内に出庫したものか在庫のあるもの、1＝現在庫） */
function 表示の条件(mode: number, 商品一覧: boolean, p: string): string {
  if (mode === -1) return "true";
  if (mode === 1) return `z."在庫ケース" <> 0`;
  return `(z."最終出庫日" > ${p}::date OR z."在庫ケース" <> 0${商品一覧 ? ` OR (z."出庫ケース" = 0 AND z."在庫ケース" = 0)` : ""})`;
}
const 四十日前 = () => 日を足す(日本の今().日付, -40);

/** 修正の合言葉（Access は TD_USER のパスワード。Web 版はサーバーの設定 SOKO_PASSWORD に置き、プログラムには書かない） */
function 合言葉が合う(v: unknown): boolean {
  const pass = process.env.SOKO_PASSWORD;
  return !!pass && String(v ?? "") === pass;
}

/** 修正で直せる項目（倉庫商品一覧） */
const 一覧で直せる = new Set(["入庫日", "入庫後名義ID", "入庫No", "製造日", "賞味期限", "タグ", "入庫元数", "繰越ケース", "製造ケース", "出庫ケース", "在庫ケース", "出荷止め区分", "管理備考"]);
/** 訂正で直せる項目（FM_保管倉庫_訂正） */
const 訂正で直せる = new Set([
  "入庫日", "保管料負担日", "入庫後名義ID", "入庫No", "製造日", "賞味期限", "タグ", "入庫元数", "繰越ケース", "製造ケース", "出庫ケース", "在庫ケース", "出荷止め区分", "管理備考",
]);

async function 商品の値(c: PoolClient, 商品: unknown): Promise<Rec> {
  return (await c.query(`SELECT * FROM ${商品マスタ} WHERE "商品コード" = $1 LIMIT 1`, [n(商品)])).rows[0] ?? {};
}

export function sokoHokanRoutes(app: FastifyInstance) {
  app.addHook("preHandler", requireUser);

  // 開くとき：点検をして、いちばん大きい（在庫のある）冷蔵庫を返す（Access の Form_Open：C_UnMachCheck と ReLoad）
  app.post("/api/soko/hokan/open", async () =>
    一連で(async (c) => {
      await アンマッチ(c);
      return { soko: n((await c.query(`SELECT MAX("倉庫ID") AS v FROM ${倉庫の在庫} WHERE "在庫ケース" <> 0`)).rows[0].v) };
    }),
  );
  app.get("/api/soko/hokan/soko", async () =>
    q(
      `SELECT x."倉庫ID" AS id, MIN(m."短縮名") AS name FROM (SELECT DISTINCT "倉庫ID" FROM ${倉庫の在庫}) x LEFT JOIN ${得意先マスタ} m ON m."短縮コード" = x."倉庫ID"
       WHERE x."倉庫ID" IS NOT NULL GROUP BY x."倉庫ID" ORDER BY x."倉庫ID"`,
    ),
  );
  app.get<{ Params: { code: string } }>("/api/soko/hokan/name/:code", async (req) => (await q(`SELECT "短縮名" FROM ${得意先マスタ} WHERE "短縮コード" = $1 LIMIT 1`, [n(req.params.code)]))[0] ?? { 短縮名: "" });

  // 商品の一覧（商品一覧設定）と、冷蔵庫を変えたときに出す商品（DMin。こちらは「出庫も在庫も 0」のロットを入れない）
  app.get<{ Querystring: { soko: string; mode?: string } }>("/api/soko/hokan/shohin", async (req) => {
    const mode = Number(req.query.mode ?? 0);
    const 一覧の条件 = 表示の条件(mode, true, "$2");
    const list = await q(
      `SELECT z."商品コード" AS id, z."商品名" AS name, z."規格" FROM ${倉庫の在庫} z WHERE z."倉庫ID" = $1 AND ${一覧の条件}
       GROUP BY z."商品コード", z."商品名", z."規格" ORDER BY z."商品コード", z."商品名", z."規格"`,
      一覧の条件.includes("$2") ? [n(req.query.soko), 四十日前()] : [n(req.query.soko)],
    );
    const 最初の条件 = 表示の条件(mode, false, "$2");
    const 最初 = (
      await q(`SELECT MIN(z."商品コード") AS v FROM ${倉庫の在庫} z WHERE z."倉庫ID" = $1 AND ${最初の条件}`, 最初の条件.includes("$2") ? [n(req.query.soko), 四十日前()] : [n(req.query.soko)])
    )[0]?.v;
    return { list, 最初: 最初 == null ? null : Number(最初) };
  });

  // ロットの一覧（FM_保管倉庫）
  app.get<{ Querystring: { soko: string; shohin: string; mode?: string } }>("/api/soko/hokan", async (req) => {
    const w = 表示の条件(Number(req.query.mode ?? 0), false, "$3");
    return q(
      `SELECT z.*, z."入庫日"::date::text AS "入庫日", z."保管料負担日"::date::text AS "保管料負担日", z."製造日"::date::text AS "製造日", z."賞味期限"::date::text AS "賞味期限",
              z."最終出庫日"::date::text AS "最終出庫日", m."短縮名" AS "名義名"
       FROM ${倉庫の在庫} z LEFT JOIN ${得意先マスタ} m ON m."短縮コード" = z."入庫後名義ID"
       WHERE z."倉庫ID" = $1 AND z."商品コード" = $2 AND ${w} ORDER BY z."入庫日", z."入庫No", z."在庫ID"`,
      w.includes("$3") ? [n(req.query.soko), n(req.query.shohin), 四十日前()] : [n(req.query.soko), n(req.query.shohin)],
    );
  });

  // ［修正］（Access は 3 回まちがえると閉じる）
  app.post<{ Body: { 合言葉: string } }>("/api/soko/hokan/unlock", async (req, reply) => {
    if (!process.env.SOKO_PASSWORD) return reply.code(400).send({ error: "合言葉がサーバーに設定されていないため、修正できません。" });
    return { ok: 合言葉が合う(req.body.合言葉) };
  });

  // 1 つの項目を直す（各項目の AfterUpdate と GokeiSum。ケースを直したら保管料の明細も作り直す）
  app.post<{ Body: { 合言葉: string; 在庫ID: number; 項目: string; 値: unknown; soko?: number; shohin?: number } }>("/api/soko/hokan/save", async (req, reply) => {
    if (!合言葉が合う(req.body.合言葉)) return reply.code(403).send({ error: "修正できません。［修正］を押してパスワードを入れてください。" });
    const 項目 = req.body.項目;
    if (!一覧で直せる.has(項目)) return reply.code(400).send({ error: "この項目は直せません" });
    return 一連で(async (c) => {
      const z = (await c.query(`SELECT * FROM ${倉庫の在庫} WHERE "在庫ID" = $1 FOR UPDATE`, [n(req.body.在庫ID)])).rows[0] as Rec | undefined;
      if (!z) return reply.code(404).send({ error: "この在庫はありません" });
      let 値: any = req.body.値 === "" ? null : req.body.値;
      if (["入庫後名義ID", "入庫元数", "繰越ケース", "製造ケース", "出庫ケース", "在庫ケース"].includes(項目) && 値 !== null) 値 = cint(Number(値));
      if (項目 === "繰越ケース" && 値 === null) 値 = 0;
      const v: Rec = { [項目]: 値 };
      const 入数 = n((await 商品の値(c, z.商品コード)).入数);
      if (項目 === "繰越ケース") v.繰越kg = n(値) * 入数;
      if (項目 === "在庫ケース") v.在庫kg = n(値) * 入数;
      if (項目 === "出庫ケース") v.出荷kg = n(値) * 入数;
      if (項目 === "製造ケース") v.製造kg = n(値) * 入数;
      if (項目 === "製造日") v.賞味期限 = await 賞味期限計算(c, 日付(値), req.body.shohin ?? z.商品コード);
      if (項目 === "入庫日") {
        v.保管料負担日 = 値;
        v.期 = 保管の期(値);
        v.グループ商品コード = (await 商品の値(c, req.body.shohin ?? z.商品コード)).グループ商品コード ?? null;
      }
      const 計算 = ["繰越ケース", "在庫ケース", "出庫ケース", "製造ケース", "製造日"].includes(項目);
      if (計算) {
        // GokeiSum：いちばん新しいロットなら、冷蔵庫・商品の名前などを入れ直す（Access の新しい行のための処理）
        const 最大 = n((await c.query(`SELECT MAX("在庫ID") AS v FROM ${倉庫の在庫}`)).rows[0].v);
        if (n(z.在庫ID) >= 最大 && req.body.soko && req.body.shohin) {
          const g = await 商品の値(c, req.body.shohin);
          Object.assign(v, {
            倉庫ID: req.body.soko,
            倉庫名: (await c.query(`SELECT "短縮名" FROM ${得意先マスタ} WHERE "短縮コード" = $1 LIMIT 1`, [req.body.soko])).rows[0]?.短縮名 ?? null,
            商品コード: req.body.shohin, 商品名: g.商品名 ?? null, 規格: g.規格 ?? null, 分類ID: n(g.分類ID), 入数: g.入数 ?? null, 登録時間: 日本の今().日時,
          });
        }
        const x = { ...z, ...v };
        v.在庫kg = n(x.繰越kg) + n(x.製造kg) - n(x.出荷kg);
        v.在庫ケース = n(x.繰越ケース) + n(x.製造ケース) - n(x.出庫ケース);
      }
      const k = Object.keys(v);
      await c.query(`UPDATE ${倉庫の在庫} SET ${k.map((x, i) => `"${x}" = $${i + 2}`).join(", ")} WHERE "在庫ID" = $1`, [z.在庫ID, ...k.map((x) => v[x])]);
      if (計算) await 保管料の明細を作る(c, z.在庫ID);
      return { ok: true };
    });
  });

  // 新しいロット（Access のフォームの新しい行。冷蔵庫・商品・グループ商品コード・入数は選んでいるもの）
  app.post<{ Body: { 合言葉: string; soko: number; shohin: number } }>("/api/soko/hokan/add", async (req, reply) => {
    if (!合言葉が合う(req.body.合言葉)) return reply.code(403).send({ error: "修正できません。［修正］を押してパスワードを入れてください。" });
    return 一連で(async (c) => {
      const g = await 商品の値(c, req.body.shohin);
      const 在庫ID = await 次の番号(c, 倉庫の在庫, "在庫ID");
      await 行を足す(c, 倉庫の在庫, {
        ...在庫の初期値, 在庫ID, 倉庫ID: n(req.body.soko),
        倉庫名: (await c.query(`SELECT "短縮名" FROM ${得意先マスタ} WHERE "短縮コード" = $1 LIMIT 1`, [n(req.body.soko)])).rows[0]?.短縮名 ?? null,
        商品コード: n(req.body.shohin), グループ商品コード: n(req.body.shohin), 商品名: g.商品名 ?? null, 規格: g.規格 ?? null, 分類ID: n(g.分類ID), 入数: g.入数 ?? null,
        登録時間: 日本の今().日時,
      });
      return { 在庫ID };
    });
  });

  // ［保管料詳細］：確定していなければ期を今日までに直してから開く
  app.post<{ Body: { 在庫ID: number } }>("/api/soko/hokan/kikan", async (req) => {
    await q(`UPDATE ${倉庫の在庫} SET "期" = $2 WHERE "在庫ID" = $1 AND "確定フラグ" = false AND "保管料負担日" IS NOT NULL`, [
      n(req.body.在庫ID),
      保管の期((await q(`SELECT "保管料負担日" FROM ${倉庫の在庫} WHERE "在庫ID" = $1`, [n(req.body.在庫ID)]))[0]?.保管料負担日),
    ]);
    return { ok: true };
  });

  // 保管庫詳細（FM_保管庫詳細）：在庫ID か、冷蔵庫・商品・入庫No・名義 で絞った費用月別集計
  app.get<{ Querystring: { id?: string; soko?: string; shohin?: string; no?: string; meigi?: string } }>("/api/soko/hokan/detail", async (req) => {
    const w: string[] = [];
    const a: unknown[] = [];
    const 足す = (sql: string, v: unknown) => {
      a.push(v);
      w.push(sql.replace("?", `$${a.length}`));
    };
    if (n(req.query.id)) 足す(`"在庫ID" = ?`, n(req.query.id));
    else {
      if (n(req.query.soko)) 足す(`"倉庫No" = ?`, n(req.query.soko));
      if (n(req.query.shohin)) 足す(`"商品コード" = ?`, n(req.query.shohin));
      if (req.query.no) 足す(`"入庫No" = ?`, req.query.no);
      if (n(req.query.meigi)) 足す(`"入庫後名義ID" = ?`, n(req.query.meigi));
    }
    return q(
      `SELECT *, "集計開始日"::date::text AS "集計開始日", "集計終了日"::date::text AS "集計終了日", "開始期間"::date::text AS "開始期間", "終了期間"::date::text AS "終了期間",
              "入庫日"::date::text AS "入庫日", "製造日"::date::text AS "製造日", "賞味期限"::date::text AS "賞味期限", "作成日付"::date::text AS "作成日付"
       FROM ${費用月別集計} ${w.length ? "WHERE " + w.join(" AND ") : ""} ORDER BY "在庫ID", "期" LIMIT 2000`,
      a,
    );
  });
  // ［再計算］（確定したロットも作り直す）
  app.post<{ Body: { 在庫ID: number } }>("/api/soko/hokan/detail/recalc", async (req, reply) => {
    if (!n(req.body.在庫ID)) return reply.code(400).send({ error: "集計する在庫レコードが選択されていません。" });
    return 一連で(async (c) => ({ 件数: await 保管料の明細を作る(c, n(req.body.在庫ID), true) }));
  });

  // 入庫履歴（FM_入庫履歴）：そのロットの入庫待ちの行と、出荷・名変の履歴
  app.get<{ Params: { id: string } }>("/api/soko/hokan/rireki/:id", async (req) => {
    const id = n(req.params.id);
    const z = (await q(`SELECT "出庫ID" FROM ${倉庫の在庫} WHERE "在庫ID" = $1`, [id]))[0];
    return {
      入庫: await q(
        `SELECT *, "出荷日"::date::text AS "出荷日", "納品日"::date::text AS "納品日", "製造日"::date::text AS "製造日", "賞味期限"::date::text AS "賞味期限"
         FROM ${入庫待ち} WHERE "出庫ID" = $1`,
        [n(z?.出庫ID)],
      ),
      出荷: await q(`SELECT "出荷日"::date::text AS "出荷日", "届け先", "ケース", "商品kg", "出庫ID", "輸送ID" FROM ${倉庫の出荷} WHERE "在庫ID" = $1 ORDER BY "出荷日", "届け先"`, [id]),
      名変: await q(`SELECT "変更日"::date::text AS "変更日", "移動先名", "ケース", "商品kg", "変更No", "在庫No" FROM ${倉庫の名変} WHERE "在庫No" = $1 ORDER BY "変更No"`, [id]),
    };
  });

  // 訂正（FM_保管倉庫_訂正）：まとめて直して［修正］で登録する。出荷計画に知らせる（ZaikoPlanChange）
  app.get<{ Params: { id: string } }>("/api/soko/hokan/teisei/:id", async (req) =>
    (
      await q(
        `SELECT z.*, z."入庫日"::date::text AS "入庫日", z."保管料負担日"::date::text AS "保管料負担日", z."製造日"::date::text AS "製造日", z."賞味期限"::date::text AS "賞味期限",
                m."短縮名" AS "名義名" FROM ${倉庫の在庫} z LEFT JOIN ${得意先マスタ} m ON m."短縮コード" = z."入庫後名義ID" WHERE z."在庫ID" = $1`,
        [n(req.params.id)],
      )
    )[0] ?? null,
  );
  app.post<{ Body: { 合言葉: string; 在庫ID: number; 値: Rec } }>("/api/soko/hokan/teisei", async (req, reply) => {
    if (!合言葉が合う(req.body.合言葉)) return reply.code(403).send({ error: "パスワードが違います" });
    const 値 = req.body.値 ?? {};
    for (const k of Object.keys(値)) if (!訂正で直せる.has(k)) return reply.code(400).send({ error: `${k} は直せません` });
    return 一連で(async (c) => {
      const z = (await c.query(`SELECT * FROM ${倉庫の在庫} WHERE "在庫ID" = $1 FOR UPDATE`, [n(req.body.在庫ID)])).rows[0] as Rec | undefined;
      if (!z) return reply.code(404).send({ error: "この在庫はありません" });
      const v: Rec = {};
      for (const [k, x] of Object.entries(値)) v[k] = x === "" ? null : x;
      for (const k of ["入庫後名義ID", "入庫元数", "繰越ケース", "製造ケース", "出庫ケース", "在庫ケース"]) if (k in v && v[k] !== null) v[k] = cint(Number(v[k]));
      const 入数 = n((await 商品の値(c, z.商品コード)).入数);
      if ("繰越ケース" in v && v.繰越ケース === null) v.繰越ケース = 0;
      if ("繰越ケース" in v) v.繰越kg = n(v.繰越ケース) * 入数;
      if ("在庫ケース" in v) v.在庫kg = n(v.在庫ケース) * 入数;
      if ("出庫ケース" in v) v.出荷kg = n(v.出庫ケース) * 入数;
      if ("製造ケース" in v) v.製造kg = n(v.製造ケース) * 入数;
      if (["繰越ケース", "在庫ケース", "出庫ケース", "製造ケース"].some((k) => k in v)) {
        const x = { ...z, ...v };
        v.在庫kg = n(x.繰越kg) + n(x.製造kg) - n(x.出荷kg);
        v.在庫ケース = n(x.繰越ケース) + n(x.製造ケース) - n(x.出庫ケース);
      }
      if ("製造日" in v && !("賞味期限" in v)) v.賞味期限 = await 賞味期限計算(c, 日付(v.製造日), z.商品コード);
      if ("入庫日" in v) {
        if (!("保管料負担日" in v)) v.保管料負担日 = v.入庫日;
        v.グループ商品コード = (await 商品の値(c, z.商品コード)).グループ商品コード ?? null;
      }
      if ("保管料負担日" in v) v.期 = 保管の期(v.保管料負担日);
      // 出荷止めを切り替えると商品区分も変える（止め＝5、外す＝0）
      if ("出荷止め区分" in v) v.商品区分 = v.出荷止め区分 ? 5 : 0;
      v.登録時間 = 日本の今().日時;
      // Access は訂正の履歴（My訂正履歴）を作る処理を止めているので、備考在庫には空の行が足されるだけ
      v.備考在庫 = z.備考在庫 ? z.備考在庫 + "\r\n" : "";
      const k = Object.keys(v);
      await c.query(`UPDATE ${倉庫の在庫} SET ${k.map((x, i) => `"${x}" = $${i + 2}`).join(", ")} WHERE "在庫ID" = $1`, [z.在庫ID, ...k.map((x) => v[x])]);
      const r = await c.query(
        `UPDATE ${倉庫の出荷} SET "在庫ID" = $1, "認識ID" = $2, "通知" = '訂正', "計画変更chk" = true, "変更通知" = '数量訂正されました。' WHERE "chk" = false AND "在庫ID" = $1`,
        [z.在庫ID, String(z.在庫ID)],
      );
      return { ok: true, 知らせ: r.rowCount ?? 0 };
    });
  });
  // 訂正の［削除］：数を全部 0 にして、管理備考に「日時 削除(Web)」（Access はパソコンの名前）。登録は［修正］のときと同じ
  app.post<{ Body: { 合言葉: string; 在庫ID: number } }>("/api/soko/hokan/teisei/delete", async (req, reply) => {
    if (!合言葉が合う(req.body.合言葉)) return reply.code(403).send({ error: "パスワードが違います" });
    await q(
      `UPDATE ${倉庫の在庫} SET "入庫元数" = 0, "在庫ケース" = 0, "繰越ケース" = 0, "出庫ケース" = 0, "在庫kg" = 0, "繰越kg" = 0, "出荷kg" = 0, "管理備考" = $2 WHERE "在庫ID" = $1`,
      [n(req.body.在庫ID), `${日本の今().日時} 削除(Web)`],
    );
    return { ok: true };
  });

  // ［出力］：その冷蔵庫の在庫のあるロットを Excel に（Access は月末処理などで作った作業表 T_在庫計算表 を写す。Web 版は今の在庫と保管料の明細から作る）
  app.get<{ Querystring: { soko: string } }>("/api/soko/hokan/excel", async (req, reply) => {
    const soko = n(req.query.soko);
    const rows = await q(
      `SELECT z.*, z."入庫日"::date::text AS "入庫日", z."製造日"::date::text AS "製造日", z."賞味期限"::date::text AS "賞味期限",
              g."本社コード", g."規格" AS "商品規格", m."短縮名" AS "名義",
              (SELECT SUM(h."保管料") FROM ${費用月別集計} h WHERE h."在庫ID" = z."在庫ID") AS "保管料計",
              (SELECT SUM(h."入出庫料") FROM ${費用月別集計} h WHERE h."在庫ID" = z."在庫ID") AS "入出庫料計"
       FROM ${倉庫の在庫} z LEFT JOIN ${商品マスタ} g ON g."商品コード" = z."商品コード" LEFT JOIN ${得意先マスタ} m ON m."短縮コード" = z."入庫後名義ID"
       WHERE z."倉庫ID" = $1 AND z."在庫ケース" <> 0 ORDER BY z."商品コード", z."入庫日", z."在庫ID"`,
      [soko],
    );
    const out = rows.map((r) => ({
      保管場所: r.倉庫名, 商品コード: r.本社コード, 商品名: r.商品名, 規格: r.商品規格, 元数: r.入庫元数, 在庫Cs: r.在庫ケース, 出庫Cs: r.出庫ケース,
      入庫kg: n(r.入庫元数) * n(r.入数), 出庫kg: r.出荷kg, 在庫kg: r.在庫kg, 保管料: r.保管料計, 入出庫料: r.入出庫料計, 入庫No: r.入庫No, 入庫日: r.入庫日,
      製造日: r.製造日, 賞味期限: r.賞味期限, 名義: r.名義,
    }));
    const 列 = Object.keys(out[0] ?? { 保管場所: 0 }).map((key) => ({ key, width: key === "商品名" || key === "保管場所" ? 24 : 12, date: ["入庫日", "製造日", "賞味期限"].includes(key) }));
    const buf = await 一覧のExcel("在庫表", 列, out);
    const d = 日本の今().日付;
    const 名 = (await q(`SELECT "短縮名" FROM ${得意先マスタ} WHERE "短縮コード" = $1 LIMIT 1`, [soko]))[0]?.短縮名 ?? "";
    const 名前 = `${d.slice(0, 4)}年${d.slice(5, 7)}月${d.slice(8, 10)}日 ${名} 在庫表（ﾛｯﾄ別）`;
    reply
      .header("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
      .header("Content-Disposition", `attachment; filename*=UTF-8''${encodeURIComponent(名前 + ".xlsx")}`);
    return reply.send(buf);
  });
}
