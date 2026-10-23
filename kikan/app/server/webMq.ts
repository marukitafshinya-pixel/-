import type { FastifyInstance } from "fastify";
import { q, t, 日本の今 } from "./db.js";
import { requireUser } from "./auth.js";
import { 一連で } from "./ws.js";
import { csvを読む, 文字にする } from "./hanmori.js";
import { sjisにする } from "./narabi.js";

// WEB連携の MerQurius（日本食研）納入日程（Access の modMerQurius：MQ_Step1_取込・MQ_Step2_CSV作成・MQ_確認一覧）。
// MerQurius から出した納入日程 CSV を取り込み、WorkStation の出荷（日本食研向け）と 注文番号×ロット で照らし、登録用 CSV（Shift_JIS）を作る。
// Access は PC の作業フォルダにファイルを置いたが、Web 版は取り込んだ中身と枝番を DB（web_fe）に置き、CSV はその場でダウンロードする。
const 取込 = t("web_fe", "MQ_取込");
const 枝番表 = t("web_fe", "MQ_枝番");
const 発注元 = t("web_fe", "MQ_発注元対応");
const 出荷 = t("ws", "TD_出荷");

type Rec = Record<string, any>;
const n = (v: unknown) => Number(v ?? 0) || 0;
const 必要な列 = ["DS.注文番号", "DS.枝番", "DS.発注元（Web-EDIコード）", "DS.納入数量", "DS.納入予定日（日付）", "DS.出荷日（日付）", "DS.ロット番号", "DS.賞味期限", "DS.完納フラグ", "DS.無効"];
const 登録用の見出し = "DS.注文番号,DS.枝番,DS.発注元（Web-EDIコード）,DS.納入数量,DS.納入予定日（日付）,DS.納入予定日（時間）,DS.出荷日（日付）,DS.出荷日（時間）,DS.ロット番号,DS.賞味期限,DS.無効";

/** 日付らしければ yyyy/mm/dd に（Access の NormDate：8 文字以上で日付として読めるものだけ） */
function 日付にそろえる(s0: unknown): string {
  const s = String(s0 ?? "").trim();
  if (s.length <= 7) return s;
  const m = s.match(/^(\d{4})[/\-.](\d{1,2})[/\-.](\d{1,2})(?:[ T].*)?$/);
  if (!m) return s;
  const d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
  if (d.getUTCMonth() !== +m[2] - 1) return s;
  return `${m[1]}/${m[2].padStart(2, "0")}/${m[3].padStart(2, "0")}`;
}
/** 小数 2 桁（Access の Format(x, "0.00")。5 は切り上げ） */
const 小数2 = (v: number) => (Math.round((v + Math.sign(v) * 1e-9) * 100) / 100).toFixed(2);
const 年月日 = (v: unknown) => (v ? String(v).slice(0, 10).replace(/-/g, "/") : "");
const ロット = (v: unknown) => (v ? `${String(v).slice(2, 4)}.${String(v).slice(5, 7)}.${String(v).slice(8, 10)}` : "");
const csv行 = (a: unknown[]) => a.map((x) => { const s = String(x); return /[,"]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; }).join(",");

export function webMqRoutes(app: FastifyInstance) {
  app.addHook("preHandler", requireUser);
  // ファイルはそのままの中身（バイト）で受け取る
  app.addContentTypeParser("application/octet-stream", { parseAs: "buffer", bodyLimit: 20 * 1024 * 1024 }, (_req, body, done) =>
    done(null, body),
  );

  // Step1：納入日程 CSV を取り込む（MQ_取込 を入れ替える）
  app.post("/api/web/mq/import", async (req, reply) => {
    const rows = csvを読む(文字にする(req.body as Buffer));
    if (!rows.length) return { 件数: 0 };
    const norm = (s: string) => s.replace(/﻿/g, "").replace(/"/g, "").replace(/\t/g, "").trim();
    const hdr = rows[0].map(norm);
    const h = new Map(hdr.map((k, i) => [k, i]));
    for (const need of 必要な列)
      if (!h.has(need)) {
        const 先頭 = hdr.slice(0, 3).join(" / ") + (hdr.length > 3 ? "…" : "");
        if (先頭.startsWith("OD.")) return reply.code(400).send({ error: "選択したファイルは注文依頼のCSVです。納入日程一覧から出力したCSVを選んでください。" });
        return reply.code(400).send({ error: `CSVに列「${need}」がありません。\nファイルの先頭の列：${先頭}` });
      }
    const 列 = (r: string[], k: string) => r[h.get(k)!] ?? "";
    return 一連で(async (c) => {
      await c.query(`DELETE FROM ${取込}`);
      const 今 = 日本の今().日時;
      let 件数 = 0;
      for (const r of rows.slice(1)) {
        if (r.length - 1 < h.get("DS.無効")!) continue;
        if (!列(r, "DS.注文番号").trim()) continue;
        await c.query(
          `INSERT INTO ${取込} ("注文番号", "枝番", "発注元コード", "納入数量", "納入予定日", "出荷日", "ロット番号", "賞味期限", "完納", "無効", "取込日時")
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
          [
            列(r, "DS.注文番号").trim(), Math.trunc(parseFloat(列(r, "DS.枝番")) || 0), 列(r, "DS.発注元（Web-EDIコード）"), parseFloat(列(r, "DS.納入数量")) || 0,
            日付にそろえる(列(r, "DS.納入予定日（日付）")), 日付にそろえる(列(r, "DS.出荷日（日付）")), 列(r, "DS.ロット番号").trim(), 日付にそろえる(列(r, "DS.賞味期限")),
            列(r, "DS.完納フラグ").toLowerCase() === "true", 列(r, "DS.無効").toLowerCase() === "true", 今,
          ],
        );
        件数++;
      }
      return { 件数 };
    });
  });

  // 取り込んである納入日程の件数と日時
  app.get("/api/web/mq/status", async () => (await q(`SELECT COUNT(*)::int AS "件数", MAX("取込日時")::text AS "取込日時" FROM ${取込}`))[0]);

  // Step2：照合して登録用 CSV を作る（出荷日の範囲。初めは 7 日前〜14 日後）
  app.post<{ Body: { 開始: string; 終了: string } }>("/api/web/mq/build", async (req, reply) => {
    const { 開始, 終了 } = req.body;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(開始 ?? "") || !/^\d{4}-\d{2}-\d{2}$/.test(終了 ?? "")) return reply.code(400).send({ error: "出荷日の範囲が正しくありません" });
    return 一連で(async (c) => {
      const コード = new Map<string, string>(((await c.query(`SELECT "取引元ID", "WebEDIコード" FROM ${発注元}`)).rows as Rec[]).map((r) => [String(r.取引元ID), String(r.WebEDIコード ?? "")]));
      // MerQurius に登録済みのもの（注文番号|ロット → 内容）、注文番号ごとの最大枝番、使っている枝番
      const mq = new Map<string, Rec>();
      const mq最大 = new Map<string, number>();
      const mq枝番 = new Set<string>();
      for (const r of (await c.query(`SELECT * FROM ${取込} WHERE "無効" = false`)).rows as Rec[]) {
        mq.set(`${r.注文番号}|${r.ロット番号}`, { 枝番: n(r.枝番), 数量: 小数2(n(r.納入数量)), 納入: r.納入予定日 ?? "", 出荷: r.出荷日 ?? "", 賞味: r.賞味期限 ?? "", 発注元: r.発注元コード ?? "" });
        if (n(r.枝番) > (mq最大.get(r.注文番号) ?? 0)) mq最大.set(r.注文番号, n(r.枝番));
        mq枝番.add(`${r.注文番号}|${r.枝番}`);
      }
      // 前に振った枝番（出庫ID → 注文番号・枝番）
      const 振った = new Map<string, Rec>();
      const 振った最大 = new Map<string, number>();
      for (const r of (await c.query(`SELECT * FROM ${枝番表}`)).rows as Rec[])
        if (n(r.枝番) > 0) {
          振った.set(String(r.出庫ID), { 注文番号: r.注文番号 ?? "", 枝番: n(r.枝番) });
          if (n(r.枝番) > (振った最大.get(r.注文番号 ?? "") ?? 0)) 振った最大.set(r.注文番号 ?? "", n(r.枝番));
        }
      const 確認日時 = 日本の今().日時;
      const 使った = new Set<string>();
      const 行: string[] = [];
      const 件数: Record<string, number> = {};
      const rows = (
        await c.query(
          `SELECT "出庫ID", "取引元ID", "ユーザー伝票No", "製造日"::date::text AS "製造日", "商品kg", "納品日"::date::text AS "納品日", "出荷日"::date::text AS "出荷日",
                  "賞味期限"::date::text AS "賞味期限"
           FROM ${出荷} WHERE "出荷日" BETWEEN $1::date AND $2::date ORDER BY "ユーザー伝票No" NULLS FIRST, "出庫ID"`,
          [開始, 終了],
        )
      ).rows as Rec[];
      for (const r of rows) {
        if (!コード.has(String(n(r.取引元ID)))) continue;
        const id = String(r.出庫ID);
        const 注文 = String(r.ユーザー伝票No ?? "").trim();
        const code = コード.get(String(n(r.取引元ID)))!;
        let 枝 = 0;
        let 差 = "";
        let 状態: string;
        if (!注文) 状態 = "要確認：注文番号なし";
        else if (!r.製造日) 状態 = "要確認：製造日なし";
        else {
          const lot = ロット(r.製造日);
          const 数量 = 小数2(n(r.商品kg));
          const 納入 = 年月日(r.納品日), 出荷日 = 年月日(r.出荷日), 賞味 = 年月日(r.賞味期限);
          const key = `${注文}|${lot}`;
          if (使った.has(key)) 状態 = "要確認：同じ注文・ロットが複数行";
          else {
            使った.add(key);
            const v = mq.get(key);
            if (v) {
              枝 = v.枝番;
              if (v.数量 !== 数量) 差 += `数量 MQ=${v.数量}/Access=${数量} `;
              if (v.納入 !== 納入) 差 += `納入予定日 MQ=${v.納入}/Access=${納入} `;
              if (v.出荷 !== 出荷日) 差 += `出荷日 MQ=${v.出荷}/Access=${出荷日} `;
              if (v.賞味 !== 賞味) 差 += `賞味期限 MQ=${v.賞味}/Access=${賞味} `;
              if (v.発注元 !== code) 差 += `発注元 MQ=${v.発注元}/Access=${code} `;
              状態 = 差 === "" ? "登録済み" : "変更あり";
            } else {
              const a = 振った.get(id);
              if (a && a.注文番号 === 注文 && !mq枝番.has(`${注文}|${a.枝番}`)) 枝 = a.枝番;
              if (枝 === 0) {
                枝 = Math.max(mq最大.get(注文) ?? 0, 振った最大.get(注文) ?? 0) + 1;
                振った最大.set(注文, 枝);
              }
              状態 = mq最大.has(注文) ? "新規" : "新規（注文番号未照合）";
            }
            if (状態 !== "登録済み") 行.push(csv行([注文, 枝, code, 数量, 納入, "000000", 出荷日, "000000", lot, 賞味, "false"]));
          }
        }
        await c.query(
          `INSERT INTO ${枝番表} ("出庫ID", "注文番号", "枝番", "状態", "差異", "確認日時") VALUES ($1, $2, $3, $4, $5, $6)
           ON CONFLICT ("出庫ID") DO UPDATE SET "注文番号" = EXCLUDED."注文番号", "枝番" = EXCLUDED."枝番", "状態" = EXCLUDED."状態", "差異" = EXCLUDED."差異", "確認日時" = EXCLUDED."確認日時"`,
          [Number(id), 注文, 枝, 状態, 差.trim().slice(0, 255), 確認日時],
        );
        件数[状態] = (件数[状態] ?? 0) + 1;
      }
      const d = 日本の今().日時.replace(/[/: ]/g, "");
      return {
        件数,
        ファイル名: 行.length ? `納入日程アップロード_${d}.csv` : null,
        csv: 行.length ? sjisにする(登録用の見出し + "\r\n" + 行.map((x) => x + "\r\n").join("")).toString("base64") : null,
      };
    });
  });

  // 確認一覧（MQ_確認一覧：いちばん新しい照合の結果を、状態・注文番号・枝番の順に）
  app.get("/api/web/mq/list", async () =>
    q(
      `SELECT b."状態", b."注文番号", b."枝番", b."差異", s."出荷日"::date::text AS "出荷日", s."納品日"::date::text AS "納品日", s."商品コード", s."商品名", s."ケース", s."商品kg",
              s."製造日"::date::text AS "製造日", s."賞味期限"::date::text AS "賞味期限", s."取引帳合", s."出庫ID"
       FROM ${枝番表} b JOIN ${出荷} s ON s."出庫ID" = b."出庫ID"
       WHERE b."確認日時" = (SELECT MAX("確認日時") FROM ${枝番表}) ORDER BY b."状態", b."注文番号", b."枝番"`,
    ),
  );
}
