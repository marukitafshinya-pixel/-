import type { FastifyInstance } from "fastify";
import type { PoolClient } from "pg";
import { q, t, 日本の今 } from "./db.js";
import { requireUser } from "./auth.js";
import { cint } from "./hanmori.js";
import { 一連で } from "./ws.js";
import { 手配表のExcel } from "./excel.js";

// 手配出力用カレンダー（Access の 手配出力用カレンダー.accdb）。
// - 配送予定カレンダー（F_配送予定カレンダー）：自社手配（630）の貸切便（配達区分 4）を月のカレンダーで見る。道外・道内は LN 帳合（139）
// - 保管庫トン数の予想（CC_保管庫予想在庫ver2）：工場（11）の在庫＋製造予定−出荷予定を 120 日先まで出し、カレンダーの日に色で出す
// - ニチレイ出荷詳細データ出力（C_輸送手配データ作成・C_ニチレイ手配用輸送依頼_詳細シート作成）：便×集荷先×届け先×商品の手配表を Excel で作る
const 輸送計画 = t("ws", "TD_輸送計画");
const 出荷 = t("ws", "TD_出荷");
const 在庫 = t("ws", "TD_在庫");
const 入庫 = t("seizo", "TD_入庫");
const 得意先マスタ = t("kyotsu", "TM_得意先マスタ");
// 手配の写しの相手先届け先マスタは、ニチレイ大谷地（相手先コード 164）の番号だけだった。まとめた表から 164 の行だけを使う
// （まとめるときに 164 の行は使わない指示だったため、いまは番号が空になる。資料で確認中）
const 相手先届け先 = t("kyotsu", "TM_相手先届け先マスタ");
const 相手運送会社 = t("tehai_fe", "TM_相手運送会社マスタ");
const 日別予想 = t("tehai_fe", "T_日別予想kg");
const 手配詳細 = t("tehai_fe", "T_ニチレイ輸送手配詳細データ");
const 入庫依頼書確認用 = t("ws_fe", "T_入庫依頼書確認用");

type Rec = Record<string, any>;
const n = (v: unknown) => Number(v ?? 0) || 0;
const 工場 = 11;
const 日を足す = (v: string, k: number) => new Date(Date.parse(v.slice(0, 10) + "T00:00:00Z") + k * 86400000).toISOString().slice(0, 10);
const 通し番号 = (v: unknown) => (v ? Math.round((Date.parse(String(v).slice(0, 10) + "T00:00:00Z") - Date.UTC(1899, 11, 30)) / 86400000) : 0);
/** mm月dd日(aaa) */
const 月日曜 = (v: unknown) => {
  if (!v) return null;
  const s = String(v).slice(0, 10);
  return `${s.slice(5, 7)}月${s.slice(8, 10)}日(${"日月火水木金土"[new Date(s + "T00:00:00Z").getUTCDay()]})`;
};
/** hh:mm */
const 時分 = (v: unknown) => (v ? String(v).slice(11, 16) : null);

/** 保管庫の予想（CC_保管庫予想在庫ver2）：今日から 120 日先まで、日ごとの製造・出荷・在庫 kg を作り直す */
async function 保管庫を予想する(c: PoolClient, 開始: string) {
  await c.query(`DELETE FROM ${日別予想}`);
  const 出荷の日 = new Map(
    (
      await c.query(
        `SELECT "出荷日"::date::text AS d, SUM("商品kg") AS kg FROM ${出荷} WHERE COALESCE("chk", false) = false AND "倉庫ID" = $2 AND "出荷日" >= $1::date GROUP BY "出荷日"`,
        [開始, 工場],
      )
    ).rows.map((r) => [r.d, n(r.kg)]),
  );
  const 製造の日 = new Map(
    (
      await c.query(
        `SELECT "入庫日"::date::text AS d, SUM("商品kg") AS kg, SUM("出荷kg") AS 出 FROM ${入庫} WHERE COALESCE("chk", false) = false AND "倉庫ID" = $2 AND "入庫日" >= $1::date GROUP BY "入庫日"`,
        [開始, 工場],
      )
    ).rows.map((r) => [r.d, { kg: n(r.kg), 出: n(r.出) }]),
  );
  const 戻り = new Map(
    (
      await c.query(
        `SELECT "納品日"::date::text AS d, SUM("商品kg") AS kg FROM ${出荷} WHERE "届け先コード" = $2 AND COALESCE("chk", false) = false AND "納品日" >= $1::date GROUP BY "納品日"`,
        [開始, 工場],
      )
    ).rows.map((r) => [r.d, n(r.kg)]),
  );
  let 在庫kg = cint(n((await c.query(`SELECT SUM("在庫kg") AS v FROM ${在庫} WHERE "倉庫ID" = $1 AND "入庫日" <= $2::date`, [工場, 開始])).rows[0].v));
  let id = 0;
  for (let i = 0; i <= 120; i++) {
    const d = 日を足す(開始, i);
    const 製 = 製造の日.get(d);
    const 製造kg = cint((製?.kg ?? 0) - (製?.出 ?? 0) + (戻り.get(d) ?? 0));
    const 出荷kg = 出荷の日.has(d) ? cint(出荷の日.get(d)!) : null;
    在庫kg = 在庫kg + 製造kg - (出荷kg ?? 0);
    // 倉庫ID は Access のプログラムの誤りで空のまま入る（そのとおりにする）
    await c.query(`INSERT INTO ${日別予想} ("ID", "日付", "倉庫ID", "製造kg", "出荷kg", "在庫kg") VALUES ($1, $2, NULL, $3, $4, $5)`, [++id, d, 製造kg, 出荷kg, 在庫kg]);
  }
}

/** カレンダーの日の色（36t・38t・40t で色分け。Access の Select Case と同じ境目） */
function トン数(kg: number) {
  if (kg === 0) return { 文字: "", 色: "blue", 赤: false };
  const 文字 = `${cint(kg / 1000)} t`;
  if (kg >= 1 && kg <= 36000) return { 文字, 色: "blue", 赤: false };
  if (kg > 36000 && kg <= 38000) return { 文字, 色: "magenta", 赤: false };
  if (kg >= 38001 && kg <= 39999) return { 文字, 色: "red", 赤: false };
  if (kg >= 40000 && kg <= 99999) return { 文字, 色: "red", 赤: true };
  return null; // Access ではどの場合にも当たらず、前の表示のまま
}

export function tehaiRoutes(app: FastifyInstance) {
  app.addHook("preHandler", requireUser);

  // 開いたときの保管庫の予想（Form_Open）
  app.post("/api/tehai/yoso", async () =>
    一連で(async (c) => {
      await 保管庫を予想する(c, 日本の今().日付);
      const 終了 = (await c.query(`SELECT MAX("出荷計画日")::date::text AS d FROM ${輸送計画}`)).rows[0]?.d ?? null;
      return { ok: true, 開始日: 日本の今().日付, 終了日: 終了 };
    }),
  );

  // カレンダー（35 日分）：日ごとの便（運送会社名・丸北指定時間・着・t数・発）と保管庫のトン数
  app.get<{ Querystring: { from: string; to: string; type: string } }>("/api/tehai/calendar", async (req, reply) => {
    const { from, to } = req.query;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(from ?? "") || !/^\d{4}-\d{2}-\d{2}$/.test(to ?? "")) return reply.code(400).send({ error: "日付が正しくありません" });
    const 種類 = n(req.query.type);
    // Q_カレンダー用配車クエリ詳細：着地区コードは届け先コードの 1 けた目（Access のまま）
    const 条件 = 種類 === 1 ? `AND left(x."着地"::text, 1) <> '1' AND x."帳合運送会社コード"::text = '139'` : 種類 === 2 ? `AND left(x."着地"::text, 1) = '1' AND x."帳合運送会社コード"::text = '139'` : "";
    const 便 = await q(
      `SELECT x.*, a."短縮名" AS "発", b."短縮名" AS "着"
       FROM (
         SELECT p."出荷計画日"::date::text AS "出荷計画日", p."輸送ID", p."運送会社名", p."丸北指定時間"::text AS "丸北指定時間", p."帳合運送会社コード",
                MIN(s."倉庫ID") AS "発地", MAX(s."届け先コード") AS "着地", SUM(s."商品kg")::float8 AS "kg"
         FROM ${輸送計画} p LEFT JOIN ${出荷} s ON s."輸送ID" = p."輸送ID"
         WHERE p."配達区分ID" = 4 AND p."手配運送会社コード" = 630 AND p."出荷計画日" BETWEEN $1::date AND $2::date
         GROUP BY p."出荷計画日", p."輸送ID", p."運送会社ID", p."運送会社名", p."丸北指定時間", p."積込開始時間", p."帳合運送会社コード", s."chk"
         HAVING s."chk" = false
       ) x
       LEFT JOIN LATERAL (SELECT "短縮名" FROM ${得意先マスタ} WHERE "短縮コード" = x."発地" LIMIT 1) a ON true
       LEFT JOIN LATERAL (SELECT "短縮名" FROM ${得意先マスタ} WHERE "短縮コード" = x."着地" LIMIT 1) b ON true
       WHERE true ${条件}
       ORDER BY x."出荷計画日", x."輸送ID"`,
      [from, to],
    );
    const 予想 = await q(`SELECT "日付"::date::text AS d, "在庫kg" FROM ${日別予想} WHERE "日付" BETWEEN $1::date AND $2::date`, [from, to]);
    const 日: Rec = {};
    for (const r of 予想) 日[r.d] = トン数(n(r.在庫kg));
    return {
      // t数：CLng(商品kg ÷ 1000) & "t"
      便: 便.map((r) => ({ ...r, t数: `${cint(n(r.kg) / 1000)}t`, 丸北指定時間: r.丸北指定時間 ? r.丸北指定時間.slice(11, 16) : "" })),
      トン: 日,
    };
  });

  // ニチレイ出荷詳細データ出力：手配表の表を作り直し、Excel にする。type 1＝道外、2＝道内
  app.post<{ Body: { type: number; 開始日: string; 終了日: string } }>("/api/tehai/nichirei", async (req, reply) => {
    const 種類 = n(req.body.type);
    if (種類 !== 1 && 種類 !== 2) return reply.code(400).send({ error: "[道外]　または　[道内]　を選択してください" });
    const { 開始日, 終了日 } = req.body;
    const rows = await 一連で(async (c) => {
      await c.query(`DELETE FROM ${手配詳細}`);
      // Q_ニチレイ出力用出荷データ（LN 帳合・未確定の出荷を、便・集荷先・届け先・商品ごとにまとめる）
      const 元 = (
        await c.query(
          `SELECT s."輸送ID", p."出荷計画日", p."車号" AS "運行No", u."相手方運送会社コード" AS "運送CD", p."運送会社名" AS "実運送会社", p."車番",
                  p."丸北指定時間" AS "集荷時間", a."相手方届け先コード" AS "集荷先CD", s."倉庫名", b."相手方届け先コード" AS "届け先CD", s."届け先",
                  s."商品コード", s."商品名", SUM(s."ケース")::float8 AS "個数", SUM(s."商品kg")::float8 AS "KG", s."納品日", p."航路", m."地区コード", s."届け先コード"
           FROM ${輸送計画} p LEFT JOIN ${出荷} s ON s."輸送ID" = p."輸送ID"
             LEFT JOIN ${相手運送会社} u ON u."自社運送会社コード" = p."運送会社ID"
             LEFT JOIN ${相手先届け先} a ON a."自社コード" = s."倉庫ID" AND a."相手先コード" = 164
             LEFT JOIN ${得意先マスタ} m ON m."短縮コード" = s."届け先コード"
             LEFT JOIN ${相手先届け先} b ON b."自社コード" = m."短縮コード" AND b."相手先コード" = 164
           WHERE p."出荷計画日" BETWEEN $1::date AND $2::date
           GROUP BY s."輸送ID", p."出荷計画日", p."車号", u."相手方運送会社コード", p."運送会社名", p."車番", p."丸北指定時間", a."相手方届け先コード", s."倉庫名",
                    b."相手方届け先コード", s."届け先", s."商品コード", s."商品名", s."納品日", p."航路", m."地区コード", s."届け先コード", p."帳合運送会社コード", s."chk"
           HAVING p."帳合運送会社コード"::text = '139' AND s."chk" = false AND ${種類 === 1 ? `m."地区コード" <> 1` : `m."地区コード" = 1`}
           ORDER BY p."出荷計画日", s."輸送ID", MIN(s."商品積込順")`,
          [開始日, 終了日],
        )
      ).rows;
      let id = 0;
      for (const r of 元) {
        const elixxi = r.納品日
          ? (await c.query(`SELECT "入庫受付番号" FROM ${入庫依頼書確認用} WHERE "リンクコード1" = $1 LIMIT 1`, [`${r.輸送ID}\\${r.届け先コード}\\11\\${通し番号(r.納品日)}`])).rows[0]
              ?.入庫受付番号 ?? null
          : null;
        await c.query(
          `INSERT INTO ${手配詳細} ("ID", "輸送ID", "出荷計画日", "運行No", "運送CD", "実運送会社", "車番", "集荷時間", "集荷先CD", "倉庫名", "届け先CD", "届け先", "商品コード", "商品名", "個数", "KG", "納品日", "航路", "elixxi受付No")
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19)`,
          [++id, r.輸送ID, r.出荷計画日, r.運行No, r.運送CD, r.実運送会社, r.車番, r.集荷時間, r.集荷先CD, r.倉庫名, r.届け先CD, r.届け先, r.商品コード, r.商品名, r.個数, r.KG, r.納品日, r.航路, elixxi],
        );
      }
      return (await c.query(`SELECT * FROM ${手配詳細} ORDER BY "出荷計画日", "輸送ID", "集荷時間", "ID"`)).rows as Rec[];
    });
    // Access は出力する出荷がないとエラーで止まる
    if (!rows.length) return reply.code(404).send({ error: "この期間に出力する出荷はありません" });
    // 見出しは表の項目の並び（Access の TableDef の順）。値は Access と同じ列に入れる
    const 見出し = (
      await q(`SELECT column_name AS c FROM information_schema.columns WHERE table_schema = 'tehai_fe' AND table_name = 'T_ニチレイ輸送手配詳細データ' ORDER BY ordinal_position`)
    ).map((r) => r.c);
    const 行 = rows.map((r) => [
      r.輸送ID, 月日曜(r.出荷計画日), r.運行No, r.運送CD, r.車種, r.実運送会社, r.車番, 時分(r.集荷時間), r.集荷先CD, r.倉庫名, r.届け先CD, r.届け先, r.商品コード, r.商品名,
      r.個数, r.KG, 月日曜(r.納品日), r.航路, r.集荷, r.配達, r.備考, r.elixxi受付No, r.ID,
    ]);
    const 区切り = rows.map((r, i) => i === 0 || r.輸送ID !== rows[i - 1].輸送ID);
    const buf = await 手配表のExcel(見出し, 行, 区切り, 22);
    const 日付 = 日本の今().日付.replace(/-/g, "");
    const 最小 = rows.reduce((a, r) => (String(r.出荷計画日) < a ? String(r.出荷計画日) : a), String(rows[0].出荷計画日));
    const 最大 = rows.reduce((a, r) => (String(r.出荷計画日) > a ? String(r.出荷計画日) : a), String(rows[0].出荷計画日));
    const md = (v: string) => v.slice(5, 7) + v.slice(8, 10);
    const 名前 = `${日付}${種類 === 1 ? "道外" : ""} ﾆﾁﾚｲ輸送手配 (${md(最小)} ～ ${md(最大)})${種類 === 1 ? "" : "道内"}.xlsx`;
    reply
      .header("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
      .header("Content-Disposition", `attachment; filename*=UTF-8''${encodeURIComponent(名前)}`);
    return reply.send(buf);
  });
}
