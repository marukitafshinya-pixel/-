import type { FastifyInstance } from "fastify";
import { q, t, 日本の今 } from "./db.js";
import { requireUser } from "./auth.js";
import { 一連で } from "./ws.js";
import { csvを読む, 文字にする } from "./hanmori.js";

// WEB連携のランテック輸送手配（Access の F_ランテック輸送手配・F_ランテックチェックリスト、
// C_ランテック送り状番号取得・C_ランテック送り状紐づけ・C_ランテックアンマッチ表示）。
// Access はランテックの画面から「発注一覧明細CSV」を自動でダウンロードしたが、Web 版はまず人がそのファイルを選んで取り込む。
// 取り込んだあとの照合と書き込みは Access と同じ（今日以降の便だけに書く）。ただし照合に商品コードも加えた（Access は見ていなかった。2026/10 ご依頼）。
const 詳細 = t("web_fe", "T_ランテック詳細");
const 輸送計画 = t("soko", "TD_輸送計画");
const 出庫 = t("soko", "TD_出荷");
const ランテック = 24; // 運送会社ID

type Rec = Record<string, any>;

// T_ランテック詳細 の列（CSV の見出しと同じ名前。Access の TransferText は見出しの名前で列に入れる）
const 数の列 = ["発送日", "お届希望日", "発送元CD", "お届け先CD", "送り状No", "ケース(トータル)", "商品金額計", "予定料金", "明細No", "商品CD", "ケース"];
const 文字の列 = ["発送元", "発送先住所", "お届け先", "お届け先住所", "貨物保険", "送り状印刷", "荷札印刷", "状況", "持込支店", "止め支店", "商品名", "規格", "温度", "サイズ"];

/** yyyymmdd の数字を日付（yyyy-mm-dd）に。Access の CDate(Left & "/" & Mid & "/" & Right) */
function 数字の日付(v: unknown): string | null {
  const s = String(v ?? "").replace(/\.0+$/, "");
  if (!/^\d{8}$/.test(s)) return null;
  return `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}`;
}
/** 送り状No を便の欄（文字）に書くときの形。Access は数の列をそのまま文字にする */
const 番号の文字 = (v: unknown) => (v === null || v === undefined ? "" : String(Number(v)));

const 賞味表 = t("web_fe", "TM_ランテック賞味期限表示マスタ");
/** 全角にする（Access の StrConv(…, vbWide)。数字・英字・記号） */
const 全角 = (s: string) => s.replace(/[!-~]/g, (c) => String.fromCharCode(c.charCodeAt(0) + 0xfee0));
const 年月日8 = (v: unknown) => (v ? String(v).slice(0, 10).replace(/-/g, "/") : "");
const 年月日2 = (v: unknown) => (v ? `${String(v).slice(2, 4)}/${String(v).slice(5, 7)}/${String(v).slice(8, 10)}` : "");

/** ランテックの新規発注に入れる中身（C_ランテック出力Ver2 が読むもの：Q_出庫レコード のその便。並びは商品・製造日・賞味期限・タグ） */
export async function 発注の中身(輸送ID: number) {
  const 行 = await q(
    `SELECT k."出荷計画日"::date::text AS "出荷計画日", s."倉庫ID", s."納品日"::date::text AS "納品日", s."届け先コード", s."届け先", s."商品コード", s."商品名",
            s."ケース", s."賞味期限"::date::text AS "賞味期限"
     FROM ${輸送計画} k JOIN ${出庫} s ON s."輸送ID" = k."輸送ID"
     WHERE k."輸送ID" = $1
     ORDER BY s."商品コード", s."製造日", s."賞味期限", s."タグ", s."出庫ID"`,
    [輸送ID],
  );
  if (!行.length) return null;
  const r = 行[0];
  // 賞味期限を備考に書く届け先（ランテック賞味期限表示マスタ）。備考が入っている届け先は「届け先コード（全角）」と 1 行目の賞味期限、
  // ほかは最小と最大の賞味期限（同じなら 1 つ）
  let 備考1 = "";
  let 備考2 = "";
  const m = (await q(`SELECT "得意先短縮コード", "備考" FROM ${賞味表} WHERE "得意先短縮コード" = $1 LIMIT 1`, [Number(r.届け先コード ?? 0)]))[0];
  if (m) {
    if (String(m.備考 ?? "") !== "") {
      備考1 = 全角(String(m.得意先短縮コード));
      備考2 = "賞味期限" + 全角(年月日2(r.賞味期限));
    } else {
      const 期限 = 行.map((x) => x.賞味期限).filter((x) => x);
      const 最小 = 期限.length ? 期限.reduce((a, b) => (a < b ? a : b)) : "";
      const 最大 = 期限.length ? 期限.reduce((a, b) => (a > b ? a : b)) : "";
      備考1 = "賞味期限" + 全角(年月日2(最小));
      if (最小 !== 最大) 備考2 = "賞味期限" + 全角(年月日2(最大));
    }
  }
  return {
    発送元コード: r.倉庫ID,
    出荷日: 年月日8(r.出荷計画日),
    お届け先コード: r.届け先コード,
    お届け先: r.届け先 ?? "",
    お届け希望日: 年月日8(r.納品日),
    備考1,
    備考2,
    明細: 行.map((x) => ({ 商品CD: x.商品コード, 商品名: x.商品名, ケース: x.ケース })),
    件数: 行.length,
    ケース計: 行.reduce((a, x) => a + Number(x.ケース ?? 0), 0),
  };
}

export function webLantecRoutes(app: FastifyInstance) {
  app.addHook("preHandler", requireUser);
  // ファイルはそのままの中身（バイト）で受け取る
  app.addContentTypeParser("application/octet-stream", { parseAs: "buffer", bodyLimit: 20 * 1024 * 1024 }, (_req, body, done) =>
    done(null, body),
  );

  // 出荷計画日の便の一覧（倉庫管理の便。運送会社は絞らない：Access の画面と同じ）
  app.get<{ Querystring: { 日付?: string } }>("/api/web/lantec/bins", async (req, reply) => {
    const 日付 = req.query.日付 ?? "";
    if (!/^\d{4}-\d{2}-\d{2}$/.test(日付)) return reply.code(400).send({ error: "日付が正しくありません" });
    return q(
      `SELECT k."輸送ID", k."出荷計画日"::date::text AS "出荷計画日", k."出庫場所", k."出庫No", k."運送会社ID", k."運送会社名", k."車番", k."web輸送送り状No",
              MIN(s."納品日")::date::text AS "納品日", string_agg(DISTINCT s."倉庫名", '・') AS "倉庫", string_agg(DISTINCT s."届け先", '・') AS "届け先",
              SUM(s."ケース")::int AS "ケース"
       FROM ${輸送計画} k LEFT JOIN ${出庫} s ON s."輸送ID" = k."輸送ID"
       WHERE k."出荷計画日"::date = $1::date
       GROUP BY k."輸送ID", k."出荷計画日", k."出庫場所", k."出庫場所ID", k."出庫No", k."運送会社ID", k."運送会社名", k."車番", k."web輸送送り状No"
       ORDER BY k."出庫場所ID", k."出庫No", k."運送会社ID", k."輸送ID"`,
      [日付],
    );
  });

  // 選んだ便のランテック新規発注の中身
  app.get<{ Querystring: { 輸送ID?: string } }>("/api/web/lantec/detail", async (req) => ({ 中身: await 発注の中身(Number(req.query.輸送ID)) }));

  // ［最初］［最後］の日付（Access は WorkStation の TD_輸送計画 の最小・最大を使っている。そのまま）
  app.get("/api/web/lantec/range", async () =>
    (await q(`SELECT MIN("出荷計画日")::date::text AS "最初", MAX("出荷計画日")::date::text AS "最後" FROM ${t("ws", "TD_輸送計画")}`))[0],
  );

  // 便の送り状番号を手で直す（Access の一覧の web輸送送り状No 欄）
  app.post<{ Body: { 輸送ID: number; 送り状No: string | null } }>("/api/web/lantec/okurijo", async (req, reply) => {
    const { 輸送ID, 送り状No } = req.body;
    const r = await q(`UPDATE ${輸送計画} SET "web輸送送り状No" = $2 WHERE "輸送ID" = $1::int RETURNING "輸送ID"`, [輸送ID, 送り状No?.trim() || null]);
    if (!r.length) return reply.code(404).send({ error: "その便は見つかりません" });
    return { ok: true };
  });

  // 発注一覧明細 CSV を取り込み → 便に送り状番号を書く → 便に付かなかった送り状に印を付ける
  app.post("/api/web/lantec/import", async (req, reply) => {
    const rows = csvを読む(文字にする(req.body as Buffer));
    if (!rows.length) return reply.code(400).send({ error: "ファイルが空です" });
    const hdr = rows[0].map((s) => s.replace(/﻿/g, "").replace(/"/g, "").trim());
    const h = new Map(hdr.map((k, i) => [k, i]));
    for (const need of ["発送日", "お届希望日", "発送元CD", "お届け先CD", "送り状No", "ケース"])
      if (!h.has(need)) return reply.code(400).send({ error: `CSVに列「${need}」がありません。ランテックの発注一覧から出した「発注一覧明細CSV」を選んでください。` });
    const 使う列 = [...数の列, ...文字の列].filter((k) => h.has(k));
    return 一連で(async (c) => {
      // Access：T_ランテック詳細 を空にしてから取り込む
      await c.query(`DELETE FROM ${詳細}`);
      let 取込 = 0;
      for (const r of rows.slice(1)) {
        if (r.every((x) => !String(x ?? "").trim())) continue;
        const 値 = 使う列.map((k) => {
          const s = String(r[h.get(k)!] ?? "").trim();
          if (!数の列.includes(k)) return s === "" ? null : s;
          if (s === "") return null;
          const v = Number(s.replace(/,/g, ""));
          return Number.isFinite(v) ? v : null;
        });
        const i発送 = 使う列.indexOf("発送日"), i届 = 使う列.indexOf("お届希望日");
        await c.query(
          `INSERT INTO ${詳細} (${使う列.map((k) => `"${k}"`).join(", ")}, "出庫日", "納品日", "アンマッチchk")
           VALUES (${使う列.map((_, i) => `$${i + 1}`).join(", ")}, $${使う列.length + 1}::date, $${使う列.length + 2}::date, false)`,
          [...値, 数字の日付(値[i発送]), 数字の日付(値[i届])],
        );
        取込++;
      }

      const 今日 = 日本の今().日付;
      // C_ランテック送り状紐づけ：送り状×商品ごとのケース合計を、ランテック便（出荷計画日が 10 日前より後）の便×商品ごとのケース合計と
      // 出荷日・納品日・倉庫ID（発送元CD）・届け先コード（お届け先CD）・商品コード（商品CD）・ケース数 で突き合わせる
      // （Access は商品コードを見ず、同じ日・届け先・ケース数の別の商品や別の便に付くことがあった。ご依頼で商品コードも見るようにした）
      const 便 = (
        await c.query(
          `SELECT k."出荷計画日"::date::text AS "出荷計画日", s."納品日"::date::text AS "納品日", k."輸送ID", s."倉庫ID", s."届け先コード", s."商品コード", SUM(s."ケース")::float8 AS "ケースの合計"
           FROM ${輸送計画} k LEFT JOIN ${出庫} s ON s."輸送ID" = k."輸送ID"
           WHERE k."運送会社ID" = $1 AND k."出荷計画日" > ($2::date - 10)
           GROUP BY k."出荷計画日", k."運送会社ID", s."納品日", k."輸送ID", s."商品コード", s."商品名", s."倉庫ID", s."倉庫名", s."届け先コード", s."届け先"
           ORDER BY k."出荷計画日", k."運送会社ID", s."納品日", k."輸送ID", s."商品コード", s."商品名", s."倉庫ID", s."倉庫名", s."届け先コード", s."届け先"`,
          [ランテック, 今日],
        )
      ).rows as Rec[];
      const 送り状 = (
        await c.query(
          `SELECT "送り状No", "出庫日"::date::text AS "出庫日", "納品日"::date::text AS "納品日", "発送元CD", "お届け先CD", "商品CD", SUM("ケース")::float8 AS "ケースの合計"
           FROM ${詳細}
           GROUP BY "送り状No", "発送日", "お届希望日", "発送元CD", "発送元", "お届け先CD", "お届け先", "商品CD", "商品名", "出庫日", "納品日"
           ORDER BY "送り状No", "発送日", "お届希望日", "発送元CD", "発送元", "お届け先CD", "お届け先", "商品CD", "商品名", "出庫日", "納品日"`,
        )
      ).rows as Rec[];
      // 書き込むのは出荷計画日が今日以降の便だけ（Access：出荷計画日 > Date - 1）
      const 書ける = new Set(
        ((await c.query(`SELECT "輸送ID" FROM ${輸送計画} WHERE "出荷計画日" > ($1::date - 1)`, [今日])).rows as Rec[]).map((r) => Number(r.輸送ID)),
      );
      let 書込 = 0;
      for (const r of 送り状) {
        // 値が空の送り状は Access では検索の式が作れず止まる。Web 版では飛ばす
        if (r.出庫日 === null || r.納品日 === null || r.発送元CD === null || r.お届け先CD === null || r.商品CD === null || r.ケースの合計 === null) continue;
        const 見つけた = 便.find(
          (b) => b.出荷計画日 === r.出庫日 && b.納品日 === r.納品日 && Number(b.倉庫ID) === Number(r.発送元CD) && Number(b.届け先コード) === Number(r.お届け先CD) && Number(b.商品コード) === Number(r.商品CD) && Number(b.ケースの合計) === Number(r.ケースの合計),
        );
        if (!見つけた || !書ける.has(Number(見つけた.輸送ID))) continue;
        await c.query(`UPDATE ${輸送計画} SET "web輸送送り状No" = $2 WHERE "輸送ID" = $1`, [見つけた.輸送ID, 番号の文字(r.送り状No)]);
        書込++;
      }

      // C_ランテックアンマッチ表示：今日以降の便のどれにも付いていない送り状に印を付ける
      await c.query(
        `UPDATE ${詳細} d SET "アンマッチchk" = true, "通知" = 'Access側に一致するデータ無し'
         WHERE NOT EXISTS (SELECT 1 FROM ${輸送計画} k WHERE k."出荷計画日" > ($1::date - 1) AND k."web輸送送り状No" = (d."送り状No"::bigint)::text)`,
        [今日],
      );
      const 不一致 = Number(((await c.query(`SELECT COUNT(DISTINCT "送り状No")::int AS n FROM ${詳細} WHERE "アンマッチchk"`)).rows[0] as Rec).n);
      return { 取込, 書込, 不一致 };
    });
  });

  // チェックリスト（F_ランテックチェックリスト：取り込んだ明細と、便に付かなかったもの）
  app.get("/api/web/lantec/check", async () =>
    q(
      `SELECT "ID", ("送り状No"::bigint)::text AS "送り状No", "出庫日"::date::text AS "出荷日", "発送元", "ケース", "お届け先", "納品日"::date::text AS "着日",
              "商品CD", "商品名", "アンマッチchk", "通知"
       FROM ${詳細} ORDER BY "ID"`,
    ),
  );
}
