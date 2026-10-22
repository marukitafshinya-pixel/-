import type { FastifyInstance } from "fastify";
import type { PoolClient } from "pg";
import { pool, q, t, 日本の今 } from "./db.js";
import { requireUser } from "./auth.js";
import { 一連で } from "./ws.js";

// マスタ管理（Access の「Accessマスタ管理」画面側ファイル：F_マスタ一覧・FM_商品マスタ・FM_商品登録(_新規)・F_商品マスタ登録選択・
// FM_得意先マスタ・FM_得意先登録(_新規追加)）。
// Access ではマスタ管理の表を各システムに配っていた（配信型）。Web 版はマスタが kyotsu に 1 つなので、配る処理はない。
// 直す・足すときの合言葉は Access と同じ使い方。値はサーバーの設定 MASTER_PASSWORD に置き、プログラムには書かない。
const 商品マスタ = t("kyotsu", "TM_商品マスタ");
const 得意先マスタ = t("kyotsu", "TM_得意先マスタ");
const 商品分類 = t("ws_fe", "TD_商品分類");
const 原料マスタ = t("ws_fe", "TM_原料マスタ");
const 商品区分 = t("master_fe", "TM_商品区分");
const テープ = t("master_fe", "TM_テープマスタ");
const ハイ積み = t("master_fe", "TM_ハイ積みマスタ");
const 仕入マスタ = t("master_fe", "TM_仕入マスタ");
const 産地 = t("master_fe", "TM_産地マスタ");
const 得意先区分 = t("master_fe", "TM_得意先区分");
const web出力 = t("master_fe", "TM_web出力判別区分");
const 地区コード = t("master_fe", "TM_地区コード");
const 運送会社マスタ = t("kyotsu", "TM_運送会社マスタ");
const 名義条件 = t("kyotsu", "TM_入庫先商品別名義条件");
const 取引先グループ = t("master_fe", "TMU_取引先グループマスタ");
const 運賃扱い = t("master", "TM_運賃扱いマスタ");
const 配達区分 = t("master_fe", "TM_配達区分");
const 輸送計画の表 = [t("ws", "TD_輸送計画"), t("soko", "TD_輸送計画")];

type Rec = Record<string, any>;
const n = (v: unknown) => Number(v ?? 0) || 0;
const 空 = (v: unknown) => v === null || v === undefined || v === "";

function 合言葉が合う(v: unknown): boolean {
  const pass = process.env.MASTER_PASSWORD;
  return !!pass && v === pass;
}
class 止める extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}
function 合言葉を確かめる(v: unknown) {
  if (!process.env.MASTER_PASSWORD) throw new 止める(400, "合言葉がサーバーに設定されていないため、直せません。");
  if (!合言葉が合う(v)) throw new 止める(403, "パスワードが違います!");
}

/** 都道府県を住所の頭から取る（Access の 都道府県Get） */
export function 都道府県を取る(住所: string | null | undefined): string {
  if (!住所) return "";
  const 三 = 住所.slice(0, 3);
  if (["県", "道", "府", "都"].includes(住所.slice(2, 3))) return 三;
  if (["和歌山", "神奈川", "鹿児島"].includes(三)) return 三 + "県";
  return "";
}

/** 地区ごとの空いている短縮コード（Access の 地区別ナンバリング。見つからなければ 0） */
async function 地区別ナンバリング(c: PoolClient | typeof pool, 地区: number): Promise<number> {
  const rows = (await c.query(`SELECT "短縮コード" FROM ${得意先マスタ} WHERE "短縮コード" <> 0 AND "地区コード" = $1 ORDER BY "短縮コード"`, [地区])).rows;
  if (!rows.length) return 0;
  const ある = new Set((await c.query(`SELECT "短縮コード" FROM ${得意先マスタ}`)).rows.map((r: Rec) => n(r.短縮コード)));
  let first = n(rows[0].短縮コード);
  for (const r of rows) {
    // Access と同じく、コードの頭の 1 桁が地区コードと違えば、いまの行のコードから数え直す
    if (String(first).slice(0, 1) !== String(地区)) first = n(r.短縮コード);
    if (first !== n(r.短縮コード) && !ある.has(first)) return first;
    first++;
  }
  return 0;
}

/** 商品コードの空き番号（Access の My商品コード空き番号検索：1 から 9999 で最初の空き） */
async function 商品コードの空き(c: PoolClient | typeof pool): Promise<number> {
  const ある = new Set((await c.query(`SELECT "商品コード" FROM ${商品マスタ}`)).rows.map((r: Rec) => n(r.商品コード)));
  for (let i = 1; i <= 9999; i++) if (!ある.has(i)) return i;
  return 0;
}

/** 商品マスタで書ける項目 */
const 商品の項目 = [
  "商品コード", "同一商品chk", "グループ商品コード", "分類ID", "本社コード", "ｶﾅ分類", "短縮名", "商品名", "規格", "入数", "非加熱品", "パット使用数",
  "品質保持期間", "歩留", "商品区分", "主用原料コード", "取引先ID", "取引先名", "テープID", "自社原料区分", "賞味期限日付差", "規格枚数", "規格kg",
  "原料コード", "パレット単位1", "パレット単位2", "特記事項", "ロット表示区分", "冷凍パン入数", "現場ID", "パレットID", "賞味期限追記", "製造場所ID",
  "製造場所", "使用中止", "産地コード", "産地通称", "積込時注意項目", "USER賞味残日数", "繁盛商品コード", "資材ダンボールID", "資材計量袋ID",
  "資材その他ID", "寸法L", "寸法H", "寸法W", "DB品番CD",
] as const;

/** 得意先マスタで書ける項目 */
const 得意先の項目 = [
  "短縮コード", "得意先コード", "ｶﾅ分類", "得意先名", "短縮名", "地区コード", "郵便番号", "都道府県", "住所", "電話番号", "FAX番号", "倉庫区分",
  "入庫区分", "グループコード", "グループコード2", "十二地区", "受付時間", "備考", "入庫フラグ", "ユーザー区分", "ユーザー区分名", "使用不可フラグ",
  "繁盛取引先コード", "繁盛納入先コード",
] as const;

/** 整数の項目（Access の整数の項目に小数を入れると偶数丸めになる CLng と同じにする） */
const 整数の項目 = [
  "商品コード", "グループ商品コード", "分類ID", "パット使用数", "歩留", "商品区分", "主用原料コード", "取引先ID", "テープID", "自社原料区分",
  "賞味期限日付差", "規格枚数", "原料コード", "パレット単位1", "パレット単位2", "ロット表示区分", "冷凍パン入数", "現場ID", "パレットID", "製造場所ID",
  "産地コード", "USER賞味残日数", "資材ダンボールID", "資材計量袋ID", "資材その他ID", "寸法L", "寸法H", "寸法W",
];
function CLng(v: unknown): number {
  const x = Number(v) || 0;
  const f = Math.floor(x);
  const d = x - f;
  return d > 0.5 || (d === 0.5 && f % 2 !== 0) ? f + 1 : f;
}

/** 運送会社マスタで書ける項目 */
const 運送会社の項目 = [
  "運送会社ID", "小口配送区分", "配達区分", "配達区分名", "カナ分類", "短縮名", "運送会社名", "グループコード1", "請求先区分", "住所", "電話番号", "FAX番号",
  "締日", "支払方法", "取引銀行", "口座番号", "その他支払い", "サイト", "請求先コード", "請求先", "請求書送り先住所", "請求先電話番号", "請求書FAX番号",
  "振込先コード", "振込先", "振込住所", "振込先電話番号", "振込先FAX番号", "備考", "支払い元", "支払い元住所", "支払い元電話番号", "支払先FAX番号",
  "運賃扱い区分", "使用不可フラグ", "最大パレット積載数", "最小パレット積載数", "eLixxi扱い便CD",
] as const;

/** ユーザーマスタ（入庫先商品別名義条件）で書ける項目 */
const ユーザーの項目 = [
  "受注元ID", "取引先グループID", "取引先ID", "受注先ID", "届け先コード", "ユーザー区分", "商品コード", "倉庫ID", "運賃請求ID", "運賃振分区分",
  "入庫名義ID", "備考", "重複", "特定条件", "指定冷蔵庫", "輸送扱い区分", "もい運賃単位", "もらい運賃", "もらい運賃個建", "キロ立替運賃",
  "新ダンボール初回案内", "新ダンボール備考", "取扱名", "横持区分", "売上請求先ID", "未完了chk",
] as const;
/** 運賃請求先・扱いの選択肢（Access の画面の値リスト：丸北・大阪） */
const 請求先の名前: Record<number, string> = { 1: "丸北", 629: "大阪" };

/** Access の 商品登録 の［登録］で確かめる項目（製造場所がないときは「入数」の知らせが「製造場所」に置き換わるのも Access と同じ） */
function 商品の足りない項目(v: Rec): string {
  const m: string[] = [];
  if (空(v.ｶﾅ分類)) m[1] = "ｶﾅ分類 ";
  if (空(v.分類ID)) m[2] = "分類ID ";
  if (空(v.商品名)) m[3] = "商品名 ";
  if (!n(v.規格kg)) m[4] = "規格kg ";
  if (!n(v.規格枚数)) m[5] = "規格枚数 ";
  if (!n(v.入数)) m[6] = "入数 ";
  if (空(v.規格)) m[7] = "規格 ";
  if (空(v.品質保持期間)) m[8] = "品質保持期間 ";
  if (空(v.賞味期限日付差)) m[9] = "賞味期限日付差 ";
  if (空(v.短縮名)) m[10] = "短縮名 ";
  if (空(v.原料コード)) m[11] = "原料区分 ";
  if (!n(v.製造場所ID)) m[6] = "製造場所 ";
  return m.filter(Boolean).join("");
}

export function masterRoutes(app: FastifyInstance) {
  app.addHook("preHandler", requireUser);
  app.setErrorHandler((e: any, _req, reply) => {
    reply.code(e.status ?? e.statusCode ?? 500).send({ error: e.status ? e.message : "うまくいきませんでした：" + e.message });
  });

  // 合言葉を確かめる（［訂正］［新規登録］のとき）
  app.post<{ Body: { pass: string } }>("/api/mst/unlock", async (req) => {
    合言葉を確かめる(req.body?.pass);
    return { ok: true };
  });

  // ---------------- 商品マスタ ----------------
  app.get<{ Querystring: { q?: string } }>("/api/mst/shohin", async (req) => {
    const 検索 = (req.query.q ?? "").trim();
    return q(
      `SELECT s."商品コード", s."本社コード", s."分類ID", b."分類名", s."原料コード", g."原料分類", s."ｶﾅ分類", s."商品名", s."規格kg", s."規格枚数",
              s."取引先名", s."品質保持期間", s."冷凍パン入数", s."製造場所", s."使用中止"
       FROM ${商品マスタ} s
       LEFT JOIN ${商品分類} b ON b."分類ID" = s."分類ID"
       LEFT JOIN ${原料マスタ} g ON g."原料分類ID" = s."原料コード"
       WHERE ($1 = '' OR s."商品名" LIKE '%' || $1 || '%')
       ORDER BY s."分類ID", s."ｶﾅ分類", s."商品名"`,
      [検索],
    );
  });

  // 選択肢（商品マスタ登録の画面）
  app.get("/api/mst/shohin-opts", async () => ({
    分類: await q(`SELECT "分類ID" AS id, "分類名" AS name FROM ${商品分類} ORDER BY "分類ID"`),
    原料: await q(`SELECT "原料分類ID" AS id, "原料分類" AS name FROM ${原料マスタ} ORDER BY "原料分類ID"`),
    商品区分: await q(`SELECT "区分ID" AS id, "区分名" AS name FROM ${商品区分} ORDER BY "区分ID"`),
    テープ: await q(`SELECT "テープID" AS id, '上面　' || COALESCE("テープ上", '') || '　下面　' || COALESCE("テープ下", '') AS name FROM ${テープ} ORDER BY "テープID"`),
    パレット: await q(
      `SELECT "ハイ積みID" AS id, COALESCE("パレット名", '') || ' 積み数 ' || COALESCE("総数"::text, '') || '  ' || COALESCE("ハイ積み備考", '') AS name
       FROM ${ハイ積み} ORDER BY "ハイ積みID"`,
    ),
    ダンボール: await q(`SELECT "ID" AS id, "品番" AS name, "商品名" AS sub FROM ${仕入マスタ} WHERE "品番" IS NOT NULL AND "分類ID" = 10 ORDER BY "取引先コード", "仕入コード"`),
    計量袋: await q(`SELECT "ID" AS id, "品番" AS name, "識別条件" AS sub FROM ${仕入マスタ} WHERE "識別条件" IS DISTINCT FROM '製品外資材' AND "分類ID" = 11 ORDER BY "品番"`),
    パット: await q(`SELECT "ID" AS id, "品番" AS name, "商品名" AS sub FROM ${仕入マスタ} WHERE "品番" LIKE '%パット%' AND "分類ID" = 10 ORDER BY "品番"`),
    産地: await q(`SELECT "産地コード" AS id, "通称" AS name, "国籍" AS sub FROM ${産地} ORDER BY "産地コード"`),
    主要原料: await q(`SELECT "商品コード" AS id, "商品名" AS name FROM ${商品マスタ} WHERE "分類ID" = 4 ORDER BY "商品コード"`),
    冷凍原料: await q(`SELECT "商品コード" AS id, "商品名" AS name FROM ${商品マスタ} WHERE "分類ID" = 4 AND "パレット単位1" <> 0 ORDER BY "商品コード"`),
    得意先: await q(`SELECT "短縮コード" AS id, "短縮名" AS name FROM ${得意先マスタ} ORDER BY "短縮コード"`),
  }));

  app.get<{ Params: { code: string } }>("/api/mst/shohin/:code", async (req, reply) => {
    const r = (await pool.query(`SELECT * FROM ${商品マスタ} WHERE "商品コード" = $1 LIMIT 1`, [n(req.params.code)])).rows[0];
    if (!r) return reply.code(404).send({ error: "この商品はありません" });
    return r;
  });

  // 新しい商品の下書き（Access の F_商品マスタ登録選択 → FM_商品登録_新規）。元の商品を選ぶとグループ登録（同じ商品名で、決まった項目を写す）
  app.post<{ Body: { pass: string; 元?: number } }>("/api/mst/shohin-new", async (req) => {
    合言葉を確かめる(req.body?.pass);
    const code = await 商品コードの空き(pool);
    if (!req.body.元) return { 商品コード: code, グループ商品コード: code, 同一商品chk: false };
    const m = (await pool.query(`SELECT * FROM ${商品マスタ} WHERE "商品コード" = $1`, [n(req.body.元)])).rows[0] ?? {};
    return {
      同一商品chk: true, グループ商品コード: n(req.body.元), ｶﾅ分類: m.ｶﾅ分類, 原料コード: m.原料コード, 分類ID: m.分類ID, 本社コード: m.本社コード,
      商品名: m.商品名, 規格kg: m.規格kg, 規格枚数: m.規格枚数, 規格: m.規格, 入数: m.入数, 品質保持期間: m.品質保持期間, 賞味期限日付差: m.賞味期限日付差,
      ロット表示区分: m.ロット表示区分,
      // Access と同じく、主要原料には元の商品の「入数」が入る（Access の写し方のまま）
      主用原料コード: CLng(m.入数), パット使用数: m.パット使用数, 冷凍パン入数: m.冷凍パン入数, パレットID: m.パレットID,
    };
  });

  // グループ登録の元にできる商品（Access の FSD_商品名選択_グループ以外）
  app.get("/api/mst/shohin-group-src", async () =>
    q(
      `SELECT s."商品コード", s."ｶﾅ分類", s."商品名", s."規格", b."分類名" FROM ${商品マスタ} s LEFT JOIN ${商品分類} b ON b."分類ID" = s."分類ID"
       WHERE b."分類名" IS NOT NULL AND s."同一商品chk" = false AND s."使用中止" = false ORDER BY s."分類ID", s."商品名"`,
    ),
  );

  // ［登録］：足りない項目を確かめて書く。元コード がなければ新しい商品として足す
  app.post<{ Body: { pass: string; 元コード?: number; 値: Rec } }>("/api/mst/shohin/save", async (req) =>
    一連で(async (c) => {
      合言葉を確かめる(req.body?.pass);
      const 元 = n(req.body.元コード);
      await c.query(`SELECT pg_advisory_xact_lock(hashtext('TM_商品マスタ'))`);
      const 今の行: Rec = 元 ? (await c.query(`SELECT * FROM ${商品マスタ} WHERE "商品コード" = $1 LIMIT 1`, [元])).rows[0] : {};
      if (元 && !今の行) throw new 止める(404, "この商品はありません");
      const v: Rec = {};
      for (const k of 商品の項目) if (k in (req.body.値 ?? {})) v[k] = req.body.値[k] === "" ? null : req.body.値[k];
      // 登録済みの商品コードは変えない（受注・在庫・出荷の商品コードとつながらなくなるため）
      if (元) v.商品コード = 元;
      else if (!n(v.商品コード)) v.商品コード = await 商品コードの空き(c);
      // Access と同じく、画面の行全体で確かめる
      const 行: Rec = { ...今の行, ...v };
      const 足りない = 商品の足りない項目(行);
      if (足りない) throw new 止める(400, `${足りない}が入力されていません`);
      if (!行.同一商品chk && !n(行.グループ商品コード)) v.グループ商品コード = 行.商品コード;
      for (const k of 整数の項目) if (v[k] !== null && v[k] !== undefined) v[k] = CLng(v[k]);
      if (!元) {
        if ((await c.query(`SELECT 1 FROM ${商品マスタ} WHERE "商品コード" = $1`, [n(v.商品コード)])).rowCount)
          throw new 止める(400, `商品コード ${v.商品コード} はもう使われています。`);
        const id = n((await c.query(`SELECT COALESCE(MAX("ID"), 0) + 1 AS n FROM ${商品マスタ}`)).rows[0].n);
        // Access の表の既定値（数は 0、はい／いいえ は いいえ）
        const 既定: Rec = {
          ID: id, 短縮コード: 0, 同一商品chk: false, 非加熱品: false, パット使用数: 0, 特別検査区分: false, 歩留: 0, 商品区分: 0, 主用原料コード: 0,
          計量袋ID: 0, 取引先ID: 0, ダンボールID: 0, テープID: 0, 自社原料区分: 0, 旧コード: 0, 標準単価: 0, 売価: 0, 変更通知: false,
          パレット単位1: 0, パレット単位2: 0, 作業工程: 0, ロット表示区分: 0, 冷凍パン入数: 0, 現場ID: 0, パレットID: 0, 取引先重複有無: false,
          使用中止: false, 特定運賃取扱区分: 0, 旧会社コード区分: false, 使用可能chk: false, 抽出フラグ: false, 取扱い区分: 0,
          マスタ登録日: 日本の今().日付, 資材ダンボールID: 0, 資材計量袋ID: 0, 資材その他ID: 0,
        };
        const all: Rec = { ...既定, ...Object.fromEntries(Object.entries(v).filter(([, x]) => x !== null)), 訂正区分: true, 登録時間: 日本の今().日時 };
        const ks = Object.keys(all);
        await c.query(`INSERT INTO ${商品マスタ} (${ks.map((k) => `"${k}"`).join(", ")}) VALUES (${ks.map((_, i) => `$${i + 1}`).join(", ")})`, ks.map((k) => all[k]));
        return { 商品コード: n(v.商品コード) };
      }
      delete v.商品コード;
      const all: Rec = { ...v, 訂正区分: true, 登録時間: 日本の今().日時 };
      const ks = Object.keys(all);
      const r = await c.query(`UPDATE ${商品マスタ} SET ${ks.map((k, i) => `"${k}" = $${i + 2}`).join(", ")} WHERE "商品コード" = $1`, [元, ...ks.map((k) => all[k])]);
      return { 商品コード: 元 };
    }),
  );

  // ---------------- 得意先マスタ ----------------
  app.get<{ Querystring: { q?: string } }>("/api/mst/tokui", async (req) => {
    const 検索 = (req.query.q ?? "").trim();
    return q(
      `SELECT m."短縮コード", m."得意先コード", m."ｶﾅ分類", m."得意先名", m."短縮名", m."郵便番号", m."地区コード", m."住所", m."電話番号", m."FAX番号",
              m."都道府県", m."ユーザー区分", m."ユーザー区分名", m."グループコード", g."短縮名" AS "グループ名", m."倉庫区分", m."入庫区分", m."入庫フラグ",
              m."使用不可フラグ", m."備考", m."受付時間", m."繁盛納入先コード"
       FROM ${得意先マスタ} m LEFT JOIN LATERAL (SELECT "短縮名" FROM ${得意先マスタ} WHERE "短縮コード" = m."グループコード" AND m."グループコード" <> 0 LIMIT 1) g ON true
       WHERE ($1 = '' OR m."得意先名" LIKE '%' || $1 || '%' OR m."短縮名" LIKE '%' || $1 || '%' OR m."短縮コード"::text = $1)
       ORDER BY m."短縮コード"`,
      [検索],
    );
  });

  app.get("/api/mst/tokui-opts", async () => ({
    ユーザー区分: await q(`SELECT "得意先区分コード" AS id, "区分名" AS name FROM ${得意先区分} ORDER BY "得意先区分コード"`),
    web出力: await q(`SELECT "web出力区分" AS id, "出力区分名" AS name FROM ${web出力} ORDER BY "web出力区分"`),
    都道府県: await q(
      `SELECT "都道府県名" AS name, MIN("地区コード") AS "地区コード" FROM ${地区コード} GROUP BY "都道府県名", "地区コード", "十二コード" ORDER BY "地区コード", "十二コード"`,
    ),
    得意先: await q(`SELECT "短縮コード" AS id, "短縮名" AS name FROM ${得意先マスタ} ORDER BY "短縮コード"`),
  }));

  app.get<{ Params: { code: string } }>("/api/mst/tokui/:code", async (req, reply) => {
    const r = (await pool.query(`SELECT * FROM ${得意先マスタ} WHERE "短縮コード" = $1 ORDER BY "ID" LIMIT 1`, [n(req.params.code)])).rows[0];
    if (!r) return reply.code(404).send({ error: "この得意先はありません" });
    return r;
  });

  // 住所・郵便番号を入れたとき（Access の コード表示）：都道府県・地区コード・十二地区、短縮コードが空なら地区ごとの空き番号
  app.post<{ Body: { 住所?: string; 短縮コード?: number } }>("/api/mst/tokui/chiku", async (req) => {
    const 都道府県 = 都道府県を取る(req.body.住所);
    const k = (await pool.query(`SELECT "地区コード", "十二地区" FROM ${地区コード} WHERE "都道府県名" = $1 LIMIT 1`, [都道府県])).rows[0];
    const 短縮コード = n(req.body.短縮コード) || (await 地区別ナンバリング(pool, n(k?.地区コード)));
    return { 都道府県, 地区コード: k?.地区コード ?? null, 十二地区: k?.十二地区 ?? null, 短縮コード };
  });

  // 新しい得意先は合言葉なしで足せる（Access の［新規追加］→ FM_得意先登録_新規追加 と同じ）。直すときは合言葉が要る
  app.post<{ Body: { pass?: string; 元コード?: number; 値: Rec } }>("/api/mst/tokui/save", async (req) =>
    一連で(async (c) => {
      if (n(req.body.元コード)) 合言葉を確かめる(req.body?.pass);
      const v: Rec = {};
      for (const k of 得意先の項目) if (k in (req.body.値 ?? {})) v[k] = req.body.値[k] === "" ? null : req.body.値[k];
      if (!n(req.body.元コード) && !n(v.短縮コード)) throw new 止める(400, "短縮コードが入力されていません");
      if (v.ユーザー区分 !== undefined)
        v.ユーザー区分名 = (await c.query(`SELECT "区分名" FROM ${得意先区分} WHERE "得意先区分コード" = $1`, [n(v.ユーザー区分)])).rows[0]?.区分名 ?? null;
      await c.query(`SELECT pg_advisory_xact_lock(hashtext('TM_得意先マスタ'))`);
      const 元 = n(req.body.元コード);
      if (!元) {
        if ((await c.query(`SELECT 1 FROM ${得意先マスタ} WHERE "短縮コード" = $1`, [n(v.短縮コード)])).rowCount)
          throw new 止める(400, `短縮コード ${v.短縮コード} はもう使われています。`);
        const id = n((await c.query(`SELECT COALESCE(MAX("ID"), 0) + 1 AS n FROM ${得意先マスタ}`)).rows[0].n);
        const 既定: Rec = {
          ID: id, 取引元ID: 0, 倉庫区分: false, 出荷元区分: false, 入庫区分: false, 仕入帳区分: 0, 通常保管料: 0, 入出庫料: 0, グループコード: 0,
          グループコード2: 0, 入庫フラグ: false, グループコード3: 0, 保管区分: 0, ユーザー区分: 0, 抽出フラグ: false, 丸北契約冷蔵庫区分: false,
          使用不可フラグ: false, パレット積載許容数: 0, 訂正区分: false, chk: false,
        };
        const all: Rec = { ...既定, ...Object.fromEntries(Object.entries(v).filter(([, x]) => x !== null)), 登録時間: 日本の今().日時 };
        const ks = Object.keys(all);
        await c.query(`INSERT INTO ${得意先マスタ} (${ks.map((k) => `"${k}"`).join(", ")}) VALUES (${ks.map((_, i) => `$${i + 1}`).join(", ")})`, ks.map((k) => all[k]));
        return { 短縮コード: n(v.短縮コード) };
      }
      // 登録済みの短縮コードは変えない（受注・在庫・出荷の取引先コードとつながらなくなるため）
      delete v.短縮コード;
      const all: Rec = { ...v, 訂正区分: true };
      const ks = Object.keys(all);
      const r = await c.query(`UPDATE ${得意先マスタ} SET ${ks.map((k, i) => `"${k}" = $${i + 2}`).join(", ")} WHERE "短縮コード" = $1`, [元, ...ks.map((k) => all[k])]);
      if (!r.rowCount) throw new 止める(404, "この得意先はありません");
      return { 短縮コード: 元 };
    }),
  );

  // ---------------- 運送会社マスタ（FM_運送会社マスタ・FM_運送会社マスタ登録） ----------------
  app.get("/api/mst/unso", async () =>
    q(
      `SELECT m."ID", m."運送会社ID", m."カナ分類", m."短縮名", m."運送会社名", m."住所", m."電話番号", m."FAX番号", m."締日", m."支払方法", m."請求先",
              m."振込先", a."扱い区分名", m."使用不可フラグ", m."最大パレット積載数", m."備考"
       FROM ${運送会社マスタ} m LEFT JOIN ${運賃扱い} a ON a."運賃扱い区分" = m."運賃扱い区分"
       ORDER BY m."運送会社ID", m."ID"`,
    ),
  );
  app.get("/api/mst/unso-opts", async () => ({
    運賃扱い: await q(`SELECT "運賃扱い区分" AS id, "扱い区分名" AS name FROM ${運賃扱い} ORDER BY "運賃扱い区分"`),
    配達区分: await q(`SELECT "配達区分ID" AS id, "配達区分" AS name FROM ${配達区分} ORDER BY "配達区分ID"`),
    運送会社: await q(`SELECT DISTINCT ON ("運送会社ID") "運送会社ID" AS id, "運送会社名" AS name FROM ${運送会社マスタ}
                      ORDER BY "運送会社ID", COALESCE("使用不可フラグ", false), "運送会社名" IS NULL, "ID"`),
  }));
  app.get<{ Params: { id: string } }>("/api/mst/unso/:id", async (req, reply) => {
    const r = (await pool.query(`SELECT * FROM ${運送会社マスタ} WHERE "ID" = $1`, [n(req.params.id)])).rows[0];
    if (!r) return reply.code(404).send({ error: "この運送会社はありません" });
    return r;
  });
  // ［登録］：直すときは合言葉が要る。新しい運送会社は合言葉なし（Access の［新規登録］と同じ）
  app.post<{ Body: { pass?: string; ID?: number; 値: Rec } }>("/api/mst/unso/save", async (req) =>
    一連で(async (c) => {
      const id = n(req.body.ID);
      if (id) 合言葉を確かめる(req.body?.pass);
      const v: Rec = {};
      for (const k of 運送会社の項目) if (k in (req.body.値 ?? {})) v[k] = req.body.値[k] === "" ? null : req.body.値[k];
      // 請求先・振込先の名前はコードから入れる（Access の 請求先コード_AfterUpdate・振込先コード_AfterUpdate）
      const 名前 = async (code: unknown) =>
        (await c.query(`SELECT "運送会社名" FROM ${運送会社マスタ} WHERE "運送会社ID" = $1 ORDER BY COALESCE("使用不可フラグ", false), "運送会社名" IS NULL, "ID" LIMIT 1`, [n(code)])).rows[0]?.運送会社名 ?? null;
      if ("請求先コード" in v) v.請求先 = n(v.請求先コード) ? await 名前(v.請求先コード) : null;
      if ("振込先コード" in v) v.振込先 = n(v.振込先コード) ? await 名前(v.振込先コード) : null;
      if ("配達区分" in v) v.配達区分名 = (await c.query(`SELECT "配達区分" FROM ${配達区分} WHERE "配達区分ID" = $1`, [n(v.配達区分)])).rows[0]?.配達区分 ?? null;
      await c.query(`SELECT pg_advisory_xact_lock(hashtext('TM_運送会社マスタ'))`);
      if (!id) {
        if (!n(v.運送会社ID)) throw new 止める(400, "運送会社IDが入力されていません");
        // Access では同じ運送会社ID を何度でも登録できたが、名前の引き当てがあいまいになるので止める
        if ((await c.query(`SELECT 1 FROM ${運送会社マスタ} WHERE "運送会社ID" = $1`, [n(v.運送会社ID)])).rowCount)
          throw new 止める(400, `運送会社ID ${v.運送会社ID} はもう使われています。`);
        const 新ID = n((await c.query(`SELECT COALESCE(MAX("ID"), 0) + 1 AS n FROM ${運送会社マスタ}`)).rows[0].n);
        const 既定: Rec = {
          ID: 新ID, 小口配送区分: false, 配達区分: 0, グループコード1: 0, 請求先区分: false, 請求先コード: 0, 振込先コード: 0, 運賃扱い区分: 0,
          使用不可フラグ: false, 最大パレット積載数: 0, 最小パレット積載数: 0,
        };
        const all: Rec = { ...既定, ...Object.fromEntries(Object.entries(v).filter(([, x]) => x !== null)), 訂正区分: true };
        const ks = Object.keys(all);
        await c.query(`INSERT INTO ${運送会社マスタ} (${ks.map((k) => `"${k}"`).join(", ")}) VALUES (${ks.map((_, i) => `$${i + 1}`).join(", ")})`, ks.map((k) => all[k]));
        return { ID: 新ID };
      }
      // 登録済みの運送会社ID は変えない（便とつながらなくなるため）
      delete v.運送会社ID;
      const all: Rec = { ...v, 訂正区分: true };
      const ks = Object.keys(all);
      const r = await c.query(`UPDATE ${運送会社マスタ} SET ${ks.map((k, i) => `"${k}" = $${i + 2}`).join(", ")} WHERE "ID" = $1`, [id, ...ks.map((k) => all[k])]);
      if (!r.rowCount) throw new 止める(404, "この運送会社はありません");
      return { ID: id };
    }),
  );
  // 削除（Access の cmd_Delete_Click）：便（輸送計画）で使われていれば消さない
  app.post<{ Body: { pass: string; ID: number } }>("/api/mst/unso/delete", async (req) =>
    一連で(async (c) => {
      合言葉を確かめる(req.body?.pass);
      const r = (await c.query(`SELECT "運送会社ID" FROM ${運送会社マスタ} WHERE "ID" = $1`, [n(req.body.ID)])).rows[0];
      if (!r) throw new 止める(404, "この運送会社はありません");
      for (const 表 of 輸送計画の表) {
        if (!(await c.query(`SELECT to_regclass($1) AS r`, [表])).rows[0].r) continue;
        if ((await c.query(`SELECT 1 FROM ${表} WHERE "運送会社ID" = $1 LIMIT 1`, [n(r.運送会社ID)])).rowCount)
          throw new 止める(400, "すでに使用されている為、削除できません");
      }
      await c.query(`DELETE FROM ${運送会社マスタ} WHERE "ID" = $1`, [n(req.body.ID)]);
      return { ok: true };
    }),
  );

  // ---------------- ユーザーマスタ登録（F_選択_北海道丸北 → F_選択_取引先グループ → F_ユーザーカード検索・FM_ユーザーカード） ----------------
  // Access は 受注元 → 取引先グループ の画面を通って一覧を開く。Web 版は一覧の上で選ぶ
  app.get("/api/mst/user-opts", async () => ({
    グループ: await q(`SELECT "取引先ID" AS id, "取引先名" AS name, "受注区分" FROM ${取引先グループ} ORDER BY "ID"`),
    得意先: await q(`SELECT "短縮コード" AS id, "短縮名" AS name FROM ${得意先マスタ} ORDER BY "短縮コード"`),
    商品: await q(`SELECT "商品コード" AS id, "商品名" AS name, "分類ID" FROM ${商品マスタ} ORDER BY "商品コード"`),
    輸送扱い: [
      { id: 1, name: "自社直送" }, { id: 2, name: "本社 直送" }, { id: 3, name: "自社横持ち" }, { id: 4, name: "本社 横持ち" },
    ],
  }));
  app.get<{ Querystring: { group?: string; shohin?: string; todoke?: string } }>("/api/mst/user", async (req) =>
    q(
      `SELECT u."ID", u."受注先ID", u."受注先", u."商品コード", u."商品名", u."届け先コード", u."届け先", u."倉庫ID", u."倉庫名",
              u."入庫名義ID", m."短縮名" AS "入庫名義", u."運賃請求ID", u."運賃振分区分", u."取扱名"
       FROM ${名義条件} u LEFT JOIN LATERAL (SELECT "短縮名" FROM ${得意先マスタ} WHERE "短縮コード" = u."入庫名義ID" LIMIT 1) m ON true
       WHERE u."未完了chk" = false
         AND ($1::int IS NULL OR u."取引先グループID" = $1) AND ($2::int IS NULL OR u."商品コード" = $2) AND ($3::int IS NULL OR u."届け先コード" = $3)
       ORDER BY u."取引先グループID", u."受注先ID", u."商品コード", u."倉庫ID", u."運賃請求ID", u."運賃振分区分"`,
      [n(req.query.group) || null, n(req.query.shohin) || null, n(req.query.todoke) || null],
    ),
  );
  app.get<{ Params: { id: string } }>("/api/mst/user/:id", async (req, reply) => {
    const r = (await pool.query(`SELECT * FROM ${名義条件} WHERE "ID" = $1`, [n(req.params.id)])).rows[0];
    if (!r) return reply.code(404).send({ error: "この行はありません" });
    return r;
  });
  // ［登録］（FM_ユーザーカード・FM_ユーザーカード_新規）。合言葉は要らない（Access と同じ）
  app.post<{ Body: { ID?: number; 値: Rec } }>("/api/mst/user/save", async (req) =>
    一連で(async (c) => {
      const v: Rec = {};
      for (const k of ユーザーの項目) if (k in (req.body.値 ?? {})) v[k] = req.body.値[k] === "" ? null : req.body.値[k];
      // コードから名前を入れる（Access の 各項目の AfterUpdate と同じ）
      const 短縮名 = async (code: unknown) =>
        (await c.query(`SELECT "短縮名" FROM ${得意先マスタ} WHERE "短縮コード" = $1 LIMIT 1`, [n(code)])).rows[0]?.短縮名 ?? null;
      if ("商品コード" in v) {
        const s = (await c.query(`SELECT "商品名", "分類ID" FROM ${商品マスタ} WHERE "商品コード" = $1 LIMIT 1`, [n(v.商品コード)])).rows[0];
        v.商品名 = s?.商品名 ?? null;
        v.商品分類ID = s?.分類ID ?? null;
      }
      if ("届け先コード" in v) v.届け先 = await 短縮名(v.届け先コード);
      if ("倉庫ID" in v) v.倉庫名 = await 短縮名(v.倉庫ID);
      if ("取引先ID" in v) v.取引先 = await 短縮名(v.取引先ID);
      if ("入庫名義ID" in v) v.入庫名義名 = await 短縮名(v.入庫名義ID);
      if ("取引先グループID" in v)
        v.取引先グループ名 = (await c.query(`SELECT "取引先名" FROM ${取引先グループ} WHERE "取引先ID" = $1 LIMIT 1`, [n(v.取引先グループID)])).rows[0]?.取引先名 ?? null;
      if ("運賃請求ID" in v) v.運賃請求先 = 請求先の名前[n(v.運賃請求ID)] ?? null;
      if ("取扱名" in v) v.取扱区分 = !!v.取扱名;
      await c.query(`SELECT pg_advisory_xact_lock(hashtext('TM_入庫先商品別名義条件'))`);
      const 今日 = 日本の今().日付;
      const id = n(req.body.ID);
      if (!id) {
        const 新ID = n((await c.query(`SELECT COALESCE(MAX("ID"), 0) + 1 AS n FROM ${名義条件}`)).rows[0].n);
        const 既定: Rec = {
          ID: 新ID, ユーザー区分: 0, 重複: false, 特定条件: false, 指定冷蔵庫: false, もい運賃単位: 0, 新ダンボール初回案内: false, 取扱区分: false,
          横持区分: false, 売上請求先ID: 0, 届け先件数: 0, 未完了chk: false, 登録日: 今日, 更新日: 今日,
        };
        const all: Rec = { ...既定, ...Object.fromEntries(Object.entries(v).filter(([, x]) => x !== null)), 訂正区分: true };
        const ks = Object.keys(all);
        await c.query(`INSERT INTO ${名義条件} (${ks.map((k) => `"${k}"`).join(", ")}) VALUES (${ks.map((_, i) => `$${i + 1}`).join(", ")})`, ks.map((k) => all[k]));
        return { ID: 新ID };
      }
      const all: Rec = { ...v, 訂正区分: true, 更新日: 今日 };
      const ks = Object.keys(all);
      const r = await c.query(`UPDATE ${名義条件} SET ${ks.map((k, i) => `"${k}" = $${i + 2}`).join(", ")} WHERE "ID" = $1`, [id, ...ks.map((k) => all[k])]);
      if (!r.rowCount) throw new 止める(404, "この行はありません");
      return { ID: id };
    }),
  );
}
