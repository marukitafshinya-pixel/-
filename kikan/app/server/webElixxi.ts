import type { FastifyInstance } from "fastify";
import { pool, q, t, 日本の今 } from "./db.js";
import { requireUser } from "./auth.js";
import { 一連で } from "./ws.js";
import { csvを読む, 文字にする } from "./hanmori.js";
import { 出荷のまとめ } from "./wsHoukoku.js";

// WEB連携の elixxi 入庫予定の照合（Access の C_elixxi入庫予定データ出力 の取り込み部分と F_elixxi入庫データチェック）。
// Access は elixxi の「入庫依頼一覧」を拠点ごとに自動でダウンロードしたが、Web 版はまず人がそのファイルを選んで取り込む（拠点の数だけ選べる）。
// 照合は Access の 3 つのリストと同じ（自社側は 名義 11・届け先にニチレイ・納品日が今日以降。受付番号は入庫依頼書確認用（ws_fe）に写したもの。Access では F_Web出力選択 で手入力）。
const 一時 = t("web_fe", "T_elixxi一時入庫データ");
const 確認用 = t("ws_fe", "T_入庫依頼書確認用");

type Rec = Record<string, any>;

// T_elixxi一時入庫データ の列（CSV の見出しと同じ名前。Access の TransferText は見出しの名前で列に入れる）
const 数の列 = ["商品CD", "入庫予定個数", "入庫予定端数", "入数", "単量", "総重量"];
const 整数の列 = ["受付No", "受付行No", "入庫実績個数", "入庫実績端数"];
const 日付の列 = ["入庫予定日", "製造日", "賞味期限", "登録日時", "更新日時"];
const 文字の列 = ["拠点名称", "依頼No", "入庫No", "品名", "規格・ブランド", "定貫区分", "重量単位", "入庫状態", "入荷元名称", "扱い便名称", "寄託者名称", "登録ユーザID", "更新ユーザID", "マーク"];

/** 日付・日時を PG に入れられる形に（読めなければ空） */
function 日時にする(s: string): string | null {
  const m = s.match(/^(\d{4})[/\-.](\d{1,2})[/\-.](\d{1,2})(?:[ T](\d{1,2}):(\d{2})(?::(\d{2}))?)?/);
  if (!m) return null;
  const d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
  if (d.getUTCMonth() !== +m[2] - 1) return null;
  const 日 = `${m[1]}-${m[2].padStart(2, "0")}-${m[3].padStart(2, "0")}`;
  return m[4] ? `${日} ${m[4].padStart(2, "0")}:${m[5]}:${m[6] ?? "00"}` : 日;
}

/** 自社側（QS_入庫受付Noグループリスト自社）：便・届け先・名義・納品日ごとの出荷に、入庫依頼書確認用の受付番号を付けたもの */
async function 自社の受付(今日: string) {
  const c = await pool.connect();
  try {
    const まとめ = (await 出荷のまとめ(c, 今日)) as Rec[];
    const 受付 = new Map<string, (string | null)[]>();
    for (const r of (await c.query(`SELECT "リンクコード1", "入庫受付番号" FROM ${確認用} ORDER BY "ID"`)).rows as Rec[]) {
      const k = String(r.リンクコード1 ?? "");
      受付.set(k, [...(受付.get(k) ?? []), r.入庫受付番号 ?? null]);
    }
    // LEFT JOIN（確認用に同じリンクコードが複数あれば行も増える。Access の結合のまま）→ 名義 11・ニチレイ・納品日が今日以降
    const 行: Rec[] = [];
    for (const m of まとめ) {
      if (Number(m.入庫後名義ID) !== 11) continue;
      const 納品日 = String(m.納品日 ?? "").slice(0, 10);
      if (!(納品日 >= 今日) || !String(m.届け先 ?? "").includes("ニチレイ")) continue;
      for (const 番号 of 受付.get(String(m.リンクコード1)) ?? [null])
        行.push({ ...m, 納品日, 出荷計画日: String(m.出荷計画日 ?? "").slice(0, 10), 入庫受付番号: 番号 === null || 番号 === "" ? null : String(番号) });
    }
    // 納品日・届け先コード・届け先・受付番号・輸送ID・出荷計画日・出荷件数・リンクコード1 ごとに kg を足す
    const g = new Map<string, Rec>();
    for (const r of 行) {
      const k = [r.納品日, r.届け先コード, r.届け先, r.入庫受付番号, r.輸送ID, r.出荷計画日, r.出荷件数, r.リンクコード1].join("|");
      const x = g.get(k);
      if (x) x.合計kg += Number(r.商品kgの合計 ?? 0);
      else
        g.set(k, {
          納品日: r.納品日, 届け先コード: r.届け先コード, 届け先: r.届け先, 合計kg: Number(r.商品kgの合計 ?? 0), 入庫受付番号: r.入庫受付番号,
          輸送ID: r.輸送ID, 出荷計画日: r.出荷計画日, 出荷件数: Number(r.出荷件数), リンクコード1: r.リンクコード1,
        });
    }
    return [...g.values()].sort((a, b) => (a.納品日 < b.納品日 ? -1 : a.納品日 > b.納品日 ? 1 : Number(a.届け先コード) - Number(b.届け先コード)));
  } finally {
    c.release();
  }
}

export function webElixxiRoutes(app: FastifyInstance) {
  app.addHook("preHandler", requireUser);
  // ファイルはそのままの中身（バイト）で受け取る
  app.addContentTypeParser("application/octet-stream", { parseAs: "buffer", bodyLimit: 20 * 1024 * 1024 }, (_req, body, done) =>
    done(null, body),
  );

  // 入庫依頼一覧 CSV を取り込む。1 つ目のファイルのときに表を空にする（Access：取り込む前に T_elixxi一時入庫データ を空にし、拠点の数だけ足す）
  app.post<{ Querystring: { 追加?: string } }>("/api/web/elixxi/import", async (req, reply) => {
    const rows = csvを読む(文字にする(req.body as Buffer));
    if (!rows.length) return reply.code(400).send({ error: "ファイルが空です" });
    const hdr = rows[0].map((s) => s.replace(/﻿/g, "").replace(/"/g, "").trim());
    const h = new Map(hdr.map((k, i) => [k, i]));
    for (const need of ["拠点名称", "入庫予定日", "受付No", "総重量"])
      if (!h.has(need)) return reply.code(400).send({ error: `CSVに列「${need}」がありません。elixxi の入庫依頼一覧からダウンロードしたファイルを選んでください。` });
    const 使う列 = [...数の列, ...整数の列, ...日付の列, ...文字の列].filter((k) => h.has(k));
    return 一連で(async (c) => {
      if (req.query.追加 !== "1") await c.query(`DELETE FROM ${一時}`);
      let 件数 = 0;
      for (const r of rows.slice(1)) {
        if (r.every((x) => !String(x ?? "").trim())) continue;
        const 値 = 使う列.map((k) => {
          const s = String(r[h.get(k)!] ?? "").trim();
          if (s === "") return null;
          if (数の列.includes(k) || 整数の列.includes(k)) {
            const v = Number(s.replace(/,/g, ""));
            return Number.isFinite(v) ? (整数の列.includes(k) ? Math.round(v) : v) : null;
          }
          if (日付の列.includes(k)) return 日時にする(s);
          return s;
        });
        await c.query(`INSERT INTO ${一時} (${使う列.map((k) => `"${k}"`).join(", ")}) VALUES (${使う列.map((_, i) => `$${i + 1}`).join(", ")})`, 値);
        件数++;
      }
      return { 件数 };
    });
  });

  // 照合の結果（F_elixxi入庫データチェック の 3 つのリスト）
  app.get("/api/web/elixxi/check", async () => {
    const 今日 = 日本の今().日付;
    // QS_入庫受付Noグループリストelixxi：拠点・入庫予定日・受付番号ごとの個数・kg・件数
    const elixxi = await q(
      `SELECT "拠点名称", "入庫予定日"::date::text AS "入庫予定日", "受付No"::text AS "受付番号", SUM("入庫予定個数")::float8 AS "入庫数",
              SUM("総重量")::float8 AS "kg計", COUNT("受付No")::int AS "件数"
       FROM ${一時} GROUP BY "拠点名称", "入庫予定日", "受付No"::text ORDER BY "拠点名称", "入庫予定日"`,
    );
    const 自社 = await 自社の受付(今日);
    const 自社の番号 = new Map<string, Rec[]>();
    for (const r of 自社) if (r.入庫受付番号 !== null) 自社の番号.set(r.入庫受付番号, [...(自社の番号.get(r.入庫受付番号) ?? []), r]);
    const elixxiの番号 = new Map<string, Rec[]>();
    for (const r of elixxi) if (r.受付番号 !== null) elixxiの番号.set(r.受付番号, [...(elixxiの番号.get(r.受付番号) ?? []), r]);
    // elixxi にあって自社に無い受付番号（LEFT JOIN で相手が無いもの）
    const elixxi不一致 = elixxi.filter((r) => r.受付番号 === null || !自社の番号.has(r.受付番号));
    // 自社で受付番号を入れたのに elixxi に無いもの
    const 丸北不一致 = 自社.filter((r) => r.入庫受付番号 !== null && !elixxiの番号.has(r.入庫受付番号));
    // 両方にあるもの（INNER JOIN）：kg と件数を比べる
    const 両方: Rec[] = [];
    for (const a of 自社)
      for (const e of a.入庫受付番号 !== null ? elixxiの番号.get(a.入庫受付番号) ?? [] : [])
        両方.push({
          輸送ID: a.輸送ID, 入庫受付番号: a.入庫受付番号, 届け先: a.届け先, 納品日: a.納品日, 合計kg: a.合計kg, kg計: e.kg計, 件数: e.件数,
          受付番号: e.受付番号, 出荷計画日: a.出荷計画日, 出荷件数: a.出荷件数, 件数相違: e.件数 !== a.出荷件数,
        });
    const 状況 = (await q(`SELECT COUNT(*)::int AS "行数", MIN("入庫予定日")::date::text AS "最初", MAX("入庫予定日")::date::text AS "最後" FROM ${一時}`))[0];
    return { 状況, elixxi不一致, 丸北不一致, 両方 };
  });
}
