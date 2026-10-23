import type { FastifyInstance } from "fastify";
import { pool, q, t, 日本の今 } from "./db.js";
import { requireUser } from "./auth.js";
import { 一覧のExcel } from "./excel.js";
import { 一連で } from "./ws.js";

// 丸北WorkStation の抽出帳票
// - 在庫表抽出印刷（Access の FM_在庫表。メニューの「在庫抽出帳票」）
// - 輸送抽出帳票（FSD_輸送抽出帳票）：便の出荷を期間・運送会社・区分・届け先などで絞り、出す列（表示）・並び順・ページの見出し・改ページの小計を選んで、
//   その場で帳票を組み立てる（Access の C_ReportMaking）。通常（明細）と集計（出す列でまとめてケース・kg を足す）
// - 出荷抽出帳票（FSD_出荷抽出帳票）：出荷を条件で絞り、見出し（ヘッダー・フッダー）と並び順を選んで印刷・Excel 出力。条件は名前を付けて保存できる
/** 日付の項目を「令和8年10月」にする SQL（2019/05/01 より前は平成） */
const 和暦の月 = (列: string) =>
  `(CASE WHEN ${列} < '2019-05-01' THEN '平成' || (extract(year from ${列})::int - 1988) ELSE '令和' || (extract(year from ${列})::int - 2018) END || '年' || to_char(${列}, 'MM') || '月')`;

function 抽出帳票(app: FastifyInstance, 系: "ws" | "soko") {
  const 在庫 = t(系, "TD_在庫");
  const 出荷 = t(系, "TD_出荷");
  const 輸送計画 = t(系, "TD_輸送計画");
  const 得意先マスタ = t("kyotsu", "TM_得意先マスタ");
  const 商品マスタ = t("kyotsu", "TM_商品マスタ");
  const 商品分類 = t(`${系}_fe`, "TD_商品分類");
  const レポート作成 = t(`${系}_fe`, "TM_レポート作成");

  type Rec = Record<string, any>;
  const n = (v: unknown) => Number(v ?? 0) || 0;

  /** 在庫表抽出の条件（Access の Filt1〜Filt4。分類と商品は同じところに入るので、どちらか一方だけ効く） */
  type 在庫の条件 = { soko?: string; meigi?: string; shohin?: string; bunrui?: string; nyuko?: string };
  function 在庫の絞り込み(p: 在庫の条件): [string, unknown[]] {
    const w: string[] = [`z."在庫ケース" <> 0`];
    const a: unknown[] = [];
    const add = (sql: string, v: unknown) => {
      a.push(v);
      w.push(sql.replace("?", `$${a.length}`));
    };
    if (p.soko) add(`z."倉庫ID" = ?`, n(p.soko));
    if (p.meigi) add(`z."入庫後名義ID" = ?`, n(p.meigi));
    if (p.bunrui) add(`z."分類ID" = ?`, n(p.bunrui));
    else if (p.shohin) add(`z."商品コード" = ?`, n(p.shohin));
    const 今日 = 日本の今().日付;
    if (p.nyuko === "1") add(`z."入庫日" <= ?::date`, 今日);
    if (p.nyuko === "2") add(`z."入庫日" > ?::date`, 今日);
    return [w.join(" AND "), a];
}

  async function 在庫の行(p: 在庫の条件): Promise<Rec[]> {
    const [w, a] = 在庫の絞り込み(p);
    return q(
      `SELECT z."在庫ID", z."倉庫ID", z."倉庫名", z."入庫後名義ID", m."短縮名" AS "名義名", b."分類名", z."商品コード", z."商品名", z."規格", z."入数",
              z."製造日"::date::text AS "製造日", z."賞味期限"::date::text AS "賞味期限", z."入庫日"::date::text AS "入庫日", z."入庫No",
              z."入庫元数", z."繰越ケース", z."製造ケース", z."出庫ケース", z."在庫ケース", z."繰越kg", z."製造kg", z."出荷kg", z."在庫kg",
              s."出荷日"::date::text AS "出荷日", g."本社コード"
       FROM ${在庫} z
         LEFT JOIN ${得意先マスタ} m ON m."短縮コード" = z."入庫後名義ID"
         LEFT JOIN ${商品分類} b ON b."分類ID" = z."分類ID"
         LEFT JOIN LATERAL (SELECT x."出荷日" FROM ${出荷} x JOIN ${輸送計画} y ON y."輸送ID" = x."輸送ID"
                            WHERE x."出庫ID" = z."出庫ID" AND x."届け先コード" <> 0 LIMIT 1) s ON true
         LEFT JOIN ${商品マスタ} g ON g."商品コード" = z."商品コード"
       WHERE ${w}
       ORDER BY s."出荷日" NULLS FIRST, z."倉庫ID", z."入庫後名義ID", z."商品コード", z."製造日" NULLS FIRST, z."在庫ID"`,
      a,
    );
}

  /** Access の エクセル用在庫表（ロット別）の列 */
  const 在庫のExcelの列 = [
    { key: "ID", width: 6 }, { key: "保管場所", width: 16 }, { key: "名義", width: 16 }, { key: "出荷日", width: 12, date: true },
    { key: "入庫日", width: 12, date: true }, { key: "入庫番号", width: 10 }, { key: "商品コード", width: 10 }, { key: "商品名", width: 30 },
    { key: "規格", width: 10 }, { key: "製造日", width: 12, date: true }, { key: "賞味期限", width: 12, date: true }, { key: "元数", width: 8 },
    { key: "繰越Cs", width: 8 }, { key: "入庫Cs", width: 8 }, { key: "出庫Cs", width: 8 }, { key: "在庫Cs", width: 8 }, { key: "＆", width: 3 },
    { key: "繰越kg", width: 9 }, { key: "入庫kg", width: 9 }, { key: "出庫kg", width: 9 }, { key: "在庫kg", width: 9 },
  ];

  // ---------------- 出荷抽出帳票 ----------------

  /** 出荷の行（Access の Q_出荷レコード：便に入っていて届け先のある出荷。名義・分類・本社コードを足す） */
  const 出荷の表 = `(SELECT s."出庫ID", s."輸送ID", s."出荷日", s."納品日", s."製造日", s."賞味期限", s."届け先コード", s."届け先", s."倉庫ID", s."倉庫名",
      s."手配帳合ID", s."手配帳合" AS "帳合先", s."取引元ID", s."取引元", s."商品コード", s."商品名", s."規格", s."ケース", s."商品kg", s."入庫No",
      s."入庫前名義ID", s."入庫後名義ID", mae."短縮名" AS "入庫前名義", ato."短縮名" AS "入庫後名義",
      p."運送会社ID", p."運送会社名", p."車番", g."分類ID", g."本社コード"
    FROM ${輸送計画} p JOIN ${出荷} s ON s."輸送ID" = p."輸送ID"
      LEFT JOIN ${商品マスタ} g ON g."商品コード" = s."商品コード"
      LEFT JOIN ${得意先マスタ} mae ON mae."短縮コード" = s."入庫前名義ID"
      LEFT JOIN ${得意先マスタ} ato ON ato."短縮コード" = s."入庫後名義ID"
    WHERE s."届け先コード" <> 0)`;

  /** 見出しにできるもの（Access の GroupName。番号はフォームのヘッダー・フッダーの番号） */
  const 見出し: Record<number, { 名前: string; 式: string }> = {
    // 倉庫管理は「令和8年10月」の形（Access の Format(…,'ggge年mm月')）
    1: { 名前: "出荷月", 式: 系 === "soko" ? 和暦の月(`x."出荷日"`) : `to_char(x."出荷日", 'YYYY/MM')` },
    2: { 名前: "製造月", 式: 系 === "soko" ? 和暦の月(`x."製造日"`) : `to_char(x."製造日", 'YYYY/MM')` },
    3: { 名前: "届け先", 式: `x."届け先"` },
    4: { 名前: "倉庫名", 式: `x."倉庫名"` },
    5: { 名前: "運送会社名", 式: `x."運送会社名"` },
    6: { 名前: "商品名", 式: `x."商品名"` },
    7: { 名前: "入庫前名義", 式: `x."入庫前名義"` },
    8: { 名前: "入庫後名義", 式: `x."入庫後名義"` },
    9: { 名前: "分類ID", 式: `x."分類ID"::text` },
    10: { 名前: "取引元", 式: `x."取引元"` },
    12: { 名前: "帳合先", 式: `x."帳合先"` },
  };
  /** 並び順にできる項目（Access の rab1〜rab11 のラベル） */
  const 並べる項目 = ["出荷日", "製造日", "届け先コード", "手配帳合ID", "倉庫ID", "運送会社ID", "商品コード", "入庫前名義ID", "入庫後名義ID", "分類ID", "取引元ID"];

  type 出荷の条件 = {
    出荷日1?: string; 出荷日2?: string; 製造日1?: string; 製造日2?: string; 届け先?: number; 帳合?: number; 出荷元?: number; 運送会社?: number;
    商品?: number; 名義?: number; 入庫名義?: number; 分類?: number; 分類等号?: string; 取引元?: number; 品名?: string;
    ヘッダー?: number; フッダー?: number; 並び?: string[];
  };

  /** 出荷を絞って並べる（Access の C_Filset と Nmbering。見出しで並べてから、選んだ並び順、最後にケース） */
  async function 出荷の行(p: 出荷の条件): Promise<Rec[]> {
    const w: string[] = [];
    const a: unknown[] = [];
    const add = (sql: string, v: unknown) => {
      a.push(v);
      w.push(sql.replace("?", `$${a.length}`));
    };
    if (p.出荷日1 || p.出荷日2) {
      add(`x."出荷日" >= ?::date`, p.出荷日1 || "1900-01-01");
      add(`x."出荷日" <= ?::date`, p.出荷日2 || "9999-12-31");
    }
    if (p.製造日1 || p.製造日2) {
      add(`x."製造日" >= ?::date`, p.製造日1 || "1900-01-01");
      add(`x."製造日" <= ?::date`, p.製造日2 || "9999-12-31");
    }
    const 数: [keyof 出荷の条件, string][] = [
      ["届け先", "届け先コード"], ["帳合", "手配帳合ID"], ["出荷元", "倉庫ID"], ["運送会社", "運送会社ID"], ["商品", "商品コード"],
      ["名義", "入庫前名義ID"], ["入庫名義", "入庫後名義ID"], ["取引元", "取引元ID"],
    ];
    for (const [k, col] of 数) if (p[k] != null && String(p[k]) !== "") add(`x."${col}" = ?`, n(p[k]));
    if (p.分類 != null && String(p.分類) !== "") {
      const 等号 = ["=", "<=", ">="].includes(p.分類等号 ?? "") ? p.分類等号 : "=";
      add(`x."分類ID" ${等号} ?`, n(p.分類));
    }
    if (p.品名) add(`x."商品名" LIKE ?`, `%${p.品名}%`);
    const 並び: string[] = [];
    const h = 見出し[n(p.ヘッダー)];
    const f = 見出し[n(p.フッダー)];
    if (h) 並び.push(`${h.式} NULLS FIRST`);
    if (f) 並び.push(`${f.式} NULLS FIRST`);
    const 選んだ = (p.並び ?? []).filter((k) => 並べる項目.includes(k));
    for (const k of 選んだ.length ? 選んだ : ["出荷日"]) 並び.push(`x."${k}" NULLS FIRST`);
    並び.push(`x."ケース"`, `x."出庫ID"`);
    return q(
      `SELECT x.*, x."出荷日"::date::text AS "出荷日", x."納品日"::date::text AS "納品日", x."製造日"::date::text AS "製造日", x."賞味期限"::date::text AS "賞味期限",
              ${h ? h.式 : "NULL"} AS "見出し1", ${f ? f.式 : "NULL"} AS "見出し2"
       FROM ${出荷の表} x ${w.length ? "WHERE " + w.join(" AND ") : ""} ORDER BY ${並び.join(", ")} LIMIT 20000`,
      a,
    );
}

  /** Access の エクセル用出荷履歴 の列 */
  const 出荷のExcelの列 = [
    { key: "ID", width: 6 }, { key: "出荷日", width: 12, date: true }, { key: "曜日", width: 5 }, { key: "出荷元", width: 16 }, { key: "商品コード", width: 10 },
    { key: "商品名", width: 30 }, { key: "規格", width: 10 }, { key: "製造日", width: 12, date: true }, { key: "賞味期限", width: 12, date: true },
    { key: "ケース", width: 8 }, { key: "商品kg", width: 9 }, { key: "納品日", width: 12, date: true }, { key: "届け先", width: 18 }, { key: "入庫名義", width: 16 },
    { key: "運送会社名", width: 16 }, { key: "車番", width: 8 }, { key: "日数", width: 6 },
  ];
  const 曜日 = "日月火水木金土";

  // ---------------- 輸送抽出帳票 ----------------

  const 地区コード = t(`${系}_fe`, "TM_地区コード");
  const 集計用レポート = t(`${系}_fe`, "TM_集計用レポートクエリ");
  /** Access の T_輸送履歴（便の出荷。届け先の地区・区分の名前を足す） */
  const 輸送の表 = `(SELECT p."輸送ID", p."出荷計画日"::date AS "出荷日", s."売り日"::date AS "売り日", s."納品日"::date AS "納品日", g."分類ID", g."原料コード",
      s."商品コード", s."商品名", s."規格", s."入数", s."ケース", s."商品kg", s."入庫前名義ID", s."入庫後名義ID", p."運送会社ID", p."運送会社名",
      s."届け先コード", s."届け先", s."倉庫ID", s."倉庫名", u."都道府県", u."地区コード", u."十二地区",
      (SELECT k."地区名" FROM ${地区コード} k WHERE k."地区コード" = u."地区コード" LIMIT 1) AS "地区名",
      p."手配運送会社コード", p."手配運送会社名", p."帳合運送会社コード", p."帳合運送会社名", p."車番",
      p."輸送区分ID", p."配達区分ID", p."車両区分ID", p."冷凍区分ID",
      (SELECT x."輸送区分" FROM ${t(`${系}_fe`, "TM_輸送区分")} x WHERE x."輸送区分ID" = p."輸送区分ID" LIMIT 1) AS "輸送区分",
      (SELECT x."配達区分" FROM ${t(`${系}_fe`, "TM_配達区分")} x WHERE x."配達区分ID" = p."配達区分ID" LIMIT 1) AS "配達区分",
      (SELECT x."車両区分" FROM ${t(`${系}_fe`, "TM_車両区分")} x WHERE x."車両区分ID" = p."車両区分ID" LIMIT 1) AS "車両区分",
      (SELECT x."冷凍区分" FROM ${t(`${系}_fe`, "TM_冷凍区分")} x WHERE x."冷凍ID" = p."冷凍区分ID" LIMIT 1) AS "冷凍区分"
    FROM ${輸送計画} p JOIN ${出荷} s ON s."輸送ID" = p."輸送ID"
      LEFT JOIN ${商品マスタ} g ON g."商品コード" = s."商品コード"
      LEFT JOIN ${得意先マスタ} u ON u."短縮コード" = s."届け先コード"
    WHERE s."届け先コード" <> 0)`;

  /** 列（Access の trgG_0〜12 の Tag。0 は日付、1 はエリア） */
  const 輸送の列 = ["日付", "エリア", "手配運送会社名", "帳合運送会社名", "運送会社名", "輸送区分", "配達区分", "車両区分", "冷凍区分", "車番", "届け先", "倉庫名", "商品名"];
  const 日付の基準: Record<number, string> = { 1: "出荷日", 2: "納品日", 3: "売り日" };

  type 輸送の条件 = {
    開始?: string; 終了?: string; 集計?: boolean; 表示?: boolean[]; 並び?: number[]; ページ?: number; 改行?: number;
    日付基準?: number; 日単位?: number; 地域区分?: number; エリア?: string; 手配?: number; 帳合?: number; 運送?: number;
    輸送区分?: number; 配達区分?: number; 車両区分?: number; 冷凍区分?: number; 届け先?: (number | null)[]; 出荷地?: number; 品目?: number; 品名?: string;
    積み下ろし?: boolean;
  };

  function 輸送の式(i: number, p: 輸送の条件): string {
    if (i === 0) {
      const 基準 = `x."${日付の基準[n(p.日付基準)] ?? "出荷日"}"`;
      const 単位 = n(p.日単位) || 1;
      if (単位 === 2) return `to_char(${基準}, 'YYYY/MM')`;
      if (単位 === 3) return `(ARRAY['日曜日','月曜日','火曜日','水曜日','木曜日','金曜日','土曜日'])[extract(dow FROM ${基準})::int + 1]`;
      return `to_char(${基準}, 'YYYY/MM/DD')`;
    }
    if (i === 1) return `x."${({ 1: "都道府県", 2: "地区名", 3: "十二地区" } as Record<number, string>)[n(p.地域区分) || 1]}"`;
    return `x."${輸送の列[i]}"`;
}

  /** 輸送抽出（Access の LordDrive・DriveAriaSum・GroupSQL・R_Numbering）。列の名前と行を返す */
  async function 輸送の行(p: 輸送の条件): Promise<{ 列: string[]; rows: Rec[] }> {
    const w: string[] = [];
    const a: unknown[] = [];
    const add = (sql: string, v: unknown) => {
      a.push(v);
      w.push(sql.replace("?", `$${a.length}`));
    };
    add(`x."出荷日" >= ?::date`, p.開始 || "1900-01-01");
    add(`x."出荷日" <= ?::date`, p.終了 || "9999-12-31");
    if (n(p.品目) === 1) w.push(`x."分類ID" = 4 AND x."原料コード" = 1`);
    else if (n(p.品目) === 2) w.push(`x."分類ID" = 4 AND x."原料コード" = 3`);
    else if (n(p.品目) === 3) add(`x."商品名" LIKE ?`, `%${p.品名 ?? ""}%`);
    if (p.エリア) add(`${輸送の式(1, p)} = ?`, p.エリア);
    if (n(p.手配)) add(`x."手配運送会社コード" = ?`, n(p.手配));
    if (n(p.帳合)) add(`x."帳合運送会社コード" = ?`, n(p.帳合));
    if (p.運送 != null && String(p.運送) !== "") add(`x."運送会社ID" = ?`, n(p.運送));
    for (const k of ["輸送区分", "配達区分", "車両区分", "冷凍区分"] as const) if (n(p[k])) add(`x."${k}ID" = ?`, n(p[k]));
    const 届け先 = (p.届け先 ?? []).map(n).filter((x) => x);
    if (届け先.length) add(`x."届け先コード" = ANY(?::int[])`, 届け先);
    if (n(p.出荷地)) add(`x."倉庫ID" = ?`, n(p.出荷地));
    const where = `WHERE ${w.join(" AND ")}`;

    if (p.積み下ろし) {
      // 届け先別印刷（Access の Q_積み下ろし検索：出荷月・出荷日・運送会社・車番・届け先ごとの kg）
      const rows = await q(
        `SELECT to_char(x."出荷日", 'YYYY/MM') AS "出荷月", to_char(x."出荷日", 'YYYY/MM/DD') AS "出荷日", x."運送会社名", x."車番", x."届け先", round(SUM(x."商品kg")::numeric, 2)::float8 AS "商品kgの合計",
                to_char(x."出荷日", 'YYYY/MM') AS "_頭", to_char(x."出荷日", 'YYYY/MM') AS "_足"
         FROM ${輸送の表} x ${where} GROUP BY 1, 2, 3, 4, 5 ORDER BY 1, 2, 3, 4, 5`,
        a,
      );
      return { 列: ["出荷月", "出荷日", "運送会社名", "車番", "届け先", "商品kgの合計"], rows };
    }

    const 表示 = 輸送の列.map((_, i) => !!p.表示?.[i]);
    const 選んだ = 輸送の列.map((名, i) => ({ 名, i })).filter((x) => 表示[x.i]);
    const 列 = [...選んだ.map((x) => x.名), ...(p.集計 ? ["ケースの合計", "商品kgの合計"] : ["ケース", "商品kg"])];
    const 選 = 選んだ.map((x) => `${輸送の式(x.i, p)} AS "${x.名}"`);
    // ページの見出し・改ページの見出し（Access の CreateGroupLevel。帳票はまず見出しで並ぶ）
    const 頭 = p.ページ != null && 輸送の列[n(p.ページ)] ? 輸送の式(n(p.ページ), p) : null;
    const 足 = p.改行 != null && 輸送の列[n(p.改行)] ? 輸送の式(n(p.改行), p) : null;
    const 並び: string[] = [];
    if (頭) 並び.push(`"_頭" NULLS FIRST`);
    if (足) 並び.push(`"_足" NULLS FIRST`);
    for (const i of p.並び ?? []) if (輸送の列[i] && (!p.集計 || 表示[i])) 並び.push(`${p.集計 ? `"${輸送の列[i]}"` : 輸送の式(i, p)} NULLS FIRST`);
    let sql: string;
    if (p.集計) {
      const g = 選んだ.map((x) => 輸送の式(x.i, p));
      const 頭式 = 頭 && g.includes(頭) ? 頭 : "NULL";
      const 足式 = 足 && g.includes(足) ? 足 : "NULL";
      sql = `SELECT ${[...選, `SUM(x."ケース")::float8 AS "ケースの合計"`, `round(SUM(x."商品kg")::numeric, 2)::float8 AS "商品kgの合計"`, `${頭式} AS "_頭"`, `${足式} AS "_足"`].join(", ")}
             FROM ${輸送の表} x ${where} ${g.length ? `GROUP BY ${g.join(", ")}` : ""} ${並び.length ? `ORDER BY ${並び.join(", ")}` : ""}`;
    } else {
      sql = `SELECT ${[...選, `x."ケース"`, `x."商品kg"`, `${頭 ?? "NULL"} AS "_頭"`, `${足 ?? "NULL"} AS "_足"`].join(", ")}
             FROM ${輸送の表} x ${where} ORDER BY ${[...並び, `x."輸送ID"`].join(", ")} LIMIT 50000`;
    }
    return { 列, rows: await q(sql, a) };
}

  // ---------------- 画面 ----------------

    // 在庫表抽出：選ぶ一覧（保管庫・名義は在庫の表に出てくるもの、分類、商品は選んだ保管庫・名義の在庫の商品）
    app.get<{ Querystring: 在庫の条件 }>(`/api/${系}/zaikochu/opts`, async (req) => {
      const p = req.query;
      const w: string[] = [];
      const a: unknown[] = [];
      if (p.soko) (a.push(n(p.soko)), w.push(`"倉庫ID" = $${a.length}`));
      if (p.soko && p.meigi) (a.push(n(p.meigi)), w.push(`"入庫後名義ID" = $${a.length}`));
      return {
        保管庫: await q(
          `SELECT z."倉庫ID" AS id, MIN(m."短縮名") AS name FROM ${在庫} z LEFT JOIN ${得意先マスタ} m ON m."短縮コード" = z."倉庫ID" GROUP BY z."倉庫ID" ORDER BY z."倉庫ID"`,
        ),
        名義: await q(
          `SELECT z."入庫後名義ID" AS id, MIN(m."短縮名") AS name FROM ${在庫} z LEFT JOIN ${得意先マスタ} m ON m."短縮コード" = z."入庫後名義ID"
           WHERE z."入庫後名義ID" IS NOT NULL GROUP BY z."入庫後名義ID" ORDER BY z."入庫後名義ID"`,
        ),
        分類: await q(`SELECT "分類ID" AS id, "分類名" AS name FROM ${商品分類} ORDER BY "分類ID"`),
        商品: await q(
          `SELECT "商品コード" AS id, MIN("商品名") AS name FROM ${在庫} ${w.length ? "WHERE " + w.join(" AND ") : ""} GROUP BY "商品コード" ORDER BY "商品コード"`,
          a,
        ),
      };
    });

    app.get<{ Querystring: 在庫の条件 }>(`/api/${系}/zaikochu`, async (req) => 在庫の行(req.query));

    // Excel に出力（Access の Zaiko_ExelOutput のロット別。最後の行に合計）
    app.get<{ Querystring: 在庫の条件 }>(`/api/${系}/zaikochu/excel`, async (req, reply) => {
      const rows = await 在庫の行(req.query);
      const 合計 = { 繰越Cs: 0, 入庫Cs: 0, 出庫Cs: 0, 在庫Cs: 0, 繰越kg: 0, 入庫kg: 0, 出庫kg: 0, 在庫kg: 0 };
      const out: Rec[] = rows.map((r, i) => {
        const x: Rec = {
          ID: i + 1, 保管場所: r.倉庫名, 名義: r.名義名, 出荷日: r.出荷日, 入庫日: r.入庫日, 入庫番号: r.入庫No, 商品コード: r.本社コード, 商品名: r.商品名,
          規格: r.規格, 製造日: r.製造日, 賞味期限: r.賞味期限, 元数: r.入庫元数, 繰越Cs: r.繰越ケース, 入庫Cs: r.製造ケース, 出庫Cs: r.出庫ケース,
          在庫Cs: r.在庫ケース, 繰越kg: r.繰越kg, 入庫kg: r.製造kg, 出庫kg: r.出荷kg, 在庫kg: r.在庫kg,
        };
        for (const k of Object.keys(合計) as (keyof typeof 合計)[]) 合計[k] += n(x[k]);
        return x;
      });
      // Access は合計の行の入庫kg を書き損じている（製造kg という列はない）ので、入庫kg は空のまま
      out.push({ ID: out.length + 1, ...合計, 入庫kg: null });
      const 名義 = req.query.meigi ? (await pool.query(`SELECT "短縮名" FROM ${得意先マスタ} WHERE "短縮コード" = $1`, [n(req.query.meigi)])).rows[0]?.短縮名 ?? "" : "";
      const d = 日本の今().日付;
      const 名前 = `${d.slice(0, 4)}年${d.slice(5, 7)}月${d.slice(8, 10)}日  ${名義}名義在庫表（ﾛｯﾄ別）`;
      const buf = await 一覧のExcel("在庫表", 在庫のExcelの列, out);
      reply
        .header("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
        .header("Content-Disposition", `attachment; filename*=UTF-8''${encodeURIComponent(名前 + ".xlsx")}`);
      return reply.send(buf);
    });

    // ---------------- 出荷抽出帳票 ----------------

    app.post<{ Body: 出荷の条件 }>(`/api/${系}/shukkachu`, async (req) => 出荷の行(req.body ?? {}));

    // Excel に出力（Access の Syukka_ExelOutput。ファイル名は 出荷日の範囲 ＋ レポート表題）
    app.post<{ Body: 出荷の条件 & { 表題?: string } }>(`/api/${系}/shukkachu/excel`, async (req, reply) => {
      const rows = await 出荷の行(req.body ?? {});
      const out = rows.map((r, i) => ({
        ID: i + 1, 出荷日: r.出荷日, 曜日: r.出荷日 ? 曜日[new Date(r.出荷日 + "T00:00:00Z").getUTCDay()] : null, 出荷元: r.倉庫名, 商品コード: r.本社コード,
        商品名: r.商品名, 規格: r.規格, 製造日: r.製造日, 賞味期限: r.賞味期限, ケース: r.ケース, 商品kg: r.商品kg, 納品日: r.納品日, 届け先: r.届け先,
        入庫名義: r.入庫後名義, 運送会社名: r.運送会社名, 車番: r.車番,
        日数: r.出荷日 && r.納品日 ? Math.round((Date.parse(r.納品日) - Date.parse(r.出荷日)) / 86400000) : null,
      }));
      const 日 = (v?: string) => (v ? `${v.slice(2, 4)}年${v.slice(5, 7)}月${v.slice(8, 10)}日` : "");
      const 名前 = `${日(req.body?.出荷日1)}～${日(req.body?.出荷日2)}${req.body?.表題 ?? ""}`.replace(/[\\/:*?"<>|]/g, "");
      const buf = await 一覧のExcel("出荷履歴", 出荷のExcelの列, out);
      reply
        .header("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
        .header("Content-Disposition", `attachment; filename*=UTF-8''${encodeURIComponent((名前 || "出荷履歴") + ".xlsx")}`);
      return reply.send(buf);
    });

    // コードの名前（条件の欄の右に出す）
    app.get<{ Querystring: { kind: string; code: string } }>(`/api/${系}/shukkachu/name`, async (req) => {
      const code = n(req.query.code);
      const k = req.query.kind;
      const sql =
        k === "shohin" ? `SELECT "商品名" AS name FROM ${商品マスタ} WHERE "商品コード" = $1 LIMIT 1`
        : k === "unso" ? `SELECT "運送会社名" AS name FROM ${t("kyotsu", "TM_運送会社マスタ")} WHERE "運送会社ID" = $1 ORDER BY COALESCE("使用不可フラグ", false) LIMIT 1`
        : k === "bunrui" ? `SELECT "分類名" AS name FROM ${商品分類} WHERE "分類ID" = $1 LIMIT 1`
        : `SELECT "短縮名" AS name FROM ${得意先マスタ} WHERE "短縮コード" = $1 LIMIT 1`;
      return { name: (await pool.query(sql, [code])).rows[0]?.name ?? "" };
    });

    // 保存した条件（Access の TM_レポート作成。出荷日・製造日・帳合は保存しない）
    app.get(`/api/${系}/shukkachu/saved`, async () => q(`SELECT * FROM ${レポート作成} ORDER BY "ID"`));

    app.post<{ Body: Rec }>(`/api/${系}/shukkachu/saved`, async (req) => {
      const b = req.body ?? {};
      const 番号 = (k: string) => (b.番号?.[k] ? n(b.番号[k]) : 0);
      const v: Rec = {
        表題: b.表題 ?? null, 宛名: b.宛名 ?? null, 届け先コード: b.届け先 ?? null, 倉庫ID: b.出荷元 ?? null, 運送会社ID: b.運送会社 ?? null,
        商品コード: b.商品 ?? null, 入庫前名義: b.名義 ?? null, 入庫後名義: b.入庫名義 ?? null, 商品分類: b.分類 ?? null, 取引元ID: b.取引元 ?? null,
        商品分類等号: b.分類等号 ?? "=", レポートタイプ: n(b.タイプ), ヘッダー: n(b.ヘッダー), フッダー: n(b.フッダー),
        並び順: (b.並び ?? []).map((x: string) => x + ",").join(""), 抽出品名: b.品名 ?? null, 作成日時: 日本の今().日時.replace(/\//g, "-"),
      };
      for (let i = 1; i <= 10; i++) v[`No${i}`] = 番号(並べる項目[i - 1]);
      await 一連で(async (c) => {
        await c.query(`SELECT pg_advisory_xact_lock(hashtext('TM_レポート作成.ID'))`);
        v.ID = n((await c.query(`SELECT COALESCE(MAX("ID"), 0) + 1 AS n FROM ${レポート作成}`)).rows[0].n);
        const cols = Object.keys(v);
        await c.query(`INSERT INTO ${レポート作成} (${cols.map((k) => `"${k}"`).join(", ")}) VALUES (${cols.map((_, i) => `$${i + 1}`).join(", ")})`, cols.map((k) => v[k]));
      });
      return { ID: v.ID };
    });

    app.post<{ Body: { ID: number } }>(`/api/${系}/shukkachu/saved/delete`, async (req) => {
      await pool.query(`DELETE FROM ${レポート作成} WHERE "ID" = $1`, [n(req.body.ID)]);
      return { ok: true };
    });

    // ---------------- 輸送抽出帳票 ----------------

    app.get(`/api/${系}/yusochu/opts`, async () => ({
      運送会社: await q(`SELECT "運送会社ID" AS id, MIN("運送会社名") AS name FROM ${t("kyotsu", "TM_運送会社マスタ")} GROUP BY "運送会社ID" ORDER BY "運送会社ID"`),
      輸送区分: await q(`SELECT "輸送区分ID" AS id, "輸送区分" AS name FROM ${t(`${系}_fe`, "TM_輸送区分")} ORDER BY "輸送区分ID"`),
      配達区分: await q(`SELECT "配達区分ID" AS id, "配達区分" AS name FROM ${t(`${系}_fe`, "TM_配達区分")} ORDER BY "配達区分ID"`),
      車両区分: await q(`SELECT "車両区分ID" AS id, "車両区分" AS name FROM ${t(`${系}_fe`, "TM_車両区分")} ORDER BY "車両区分ID"`),
      冷凍区分: await q(`SELECT "冷凍ID" AS id, "冷凍区分" AS name FROM ${t(`${系}_fe`, "TM_冷凍区分")} ORDER BY "冷凍ID"`),
      都道府県: await q(`SELECT "都道府県名" AS name FROM ${地区コード} GROUP BY "都道府県名", "都道府県コード" ORDER BY "都道府県コード"`),
      地区名: await q(`SELECT "地区名" AS name FROM ${地区コード} GROUP BY "地区名", "地区コード" ORDER BY "地区コード"`),
      十二地区: await q(`SELECT "十二地区" AS name FROM ${地区コード} WHERE "十二地区" IS NOT NULL GROUP BY "十二地区", "十二コード" ORDER BY "十二コード"`),
    }));

    app.post<{ Body: 輸送の条件 }>(`/api/${系}/yusochu`, async (req) => 輸送の行(req.body ?? {}));

    // Excel（Access の cmd_Exel_Click：出した列のまま。ファイル名はレポート表題）
    app.post<{ Body: 輸送の条件 & { 表題?: string } }>(`/api/${系}/yusochu/excel`, async (req, reply) => {
      const r = await 輸送の行(req.body ?? {});
      const buf = await 一覧のExcel("輸送", r.列.map((k) => ({ key: k, width: k === "届け先" || k === "商品名" ? 28 : 14 })), r.rows);
      const 名前 = (req.body?.表題 || "輸送一覧表").replace(/[\\/:*?"<>|]/g, "");
      reply
        .header("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
        .header("Content-Disposition", `attachment; filename*=UTF-8''${encodeURIComponent(名前 + ".xlsx")}`);
      return reply.send(buf);
    });

    // 保存した条件（Access の TM_集計用レポートクエリ。並び順は保存しない）
    app.get(`/api/${系}/yusochu/saved`, async () => q(`SELECT * FROM ${集計用レポート} ORDER BY "ID"`));
    app.post<{ Body: 輸送の条件 & { 表題?: string } }>(`/api/${系}/yusochu/saved`, async (req) => {
      const b = req.body ?? {};
      const 文 = (v: unknown) => (v == null || v === "" ? null : String(v));
      const v: Rec = {
        作成日: 日本の今().日時, 集計開始日: b.開始 || null, 集計終了日: b.終了 || null, グループ集計: !!b.集計, 表題: b.表題 ?? null,
        W_0: 文(b.日単位), W_1: 文(b.地域区分), W_0_1: 文(b.日付基準), W_1_1: 文(b.エリア), W_2: 文(b.手配), W_3: 文(b.帳合), W_4: 文(b.運送),
        W_5: 文(b.輸送区分), W_6: 文(b.配達区分), W_7: 文(b.車両区分), W_8: 文(b.冷凍区分),
        W_10_1: 文(b.届け先?.[0]), W_10_2: 文(b.届け先?.[1]), W_10_3: 文(b.届け先?.[2]), W_10_4: 文(b.届け先?.[3]),
        W_11: 文(b.出荷地), W_12: 文(b.品目), W_like: 文(b.品名), ヘッダー: 文(b.ページ), フッダー: 文(b.改行),
      };
      for (let i = 0; i <= 12; i++) v[`V_${i}`] = !!b.表示?.[i];
      await 一連で(async (c) => {
        await c.query(`SELECT pg_advisory_xact_lock(hashtext('TM_集計用レポートクエリ.ID'))`);
        v.ID = n((await c.query(`SELECT COALESCE(MAX("ID"), 0) + 1 AS n FROM ${集計用レポート}`)).rows[0].n);
        const cols = Object.keys(v);
        await c.query(`INSERT INTO ${集計用レポート} (${cols.map((k) => `"${k}"`).join(", ")}) VALUES (${cols.map((_, i) => `$${i + 1}`).join(", ")})`, cols.map((k) => v[k]));
      });
      return { ID: v.ID };
    });
    app.post<{ Body: { ID: number } }>(`/api/${系}/yusochu/saved/delete`, async (req) => {
      await pool.query(`DELETE FROM ${集計用レポート} WHERE "ID" = $1`, [n(req.body.ID)]);
      return { ok: true };
    });
}

export function wsChushutsuRoutes(app: FastifyInstance) {
  app.addHook("preHandler", requireUser);
  抽出帳票(app, "ws");
  // 倉庫管理System の在庫抽出帳票（FM_在庫表）・出庫抽出帳票（FSD_出荷抽出帳票）も同じ作り。表は倉庫管理（soko）のもの
  抽出帳票(app, "soko");
}
