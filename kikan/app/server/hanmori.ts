import type { FastifyInstance } from "fastify";
import type { PoolClient } from "pg";
import { pool, q, t, 日本の今 } from "./db.js";
import { requireUser } from "./auth.js";
import { 新規の既定値 } from "./juchuForm.js";

// 販盛の取り込み（Access の F_販盛インポート・F_販盛インポート売上）で使う表
const 受注 = t("juchu", "TD_受注");
const 販盛受注 = t("juchu_fe", "T_販盛受注");
const 販盛売上 = t("juchu_fe", "T_販盛売上");
const 得意先マスタ = t("juchu_fe", "TM_得意先マスタ");
const 商品マスタ = t("juchu_fe", "TM_商品マスタ");
const 受注特定項目 = t("juchu_fe", "TM_受注特定項目");
const 販盛単価マスタ = t("juchu_fe", "T_販盛単価マスタ");
const ユーザー設定 = t("juchu_fe", "TD_USER");

/** 販盛の番号を探すときに見る受注の範囲（Access と同じ） */
const 番号を探す受注ID = 37359;

// ---------------- CSV ----------------

/** 販盛の CSV（Shift_JIS か UTF-8）を文字にする */
function 文字にする(buf: Buffer): string {
  const utf8 = new TextDecoder("utf-8", { fatal: false }).decode(buf);
  if (!utf8.includes("�")) return utf8.replace(/^﻿/, "");
  return new TextDecoder("shift_jis").decode(buf);
}

/** CSV を行と列に分ける（"..." の中のカンマ・改行もそのまま読む） */
function csvを読む(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let inq = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inq) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          cell += '"';
          i++;
        } else inq = false;
      } else cell += ch;
    } else if (ch === '"') inq = true;
    else if (ch === ",") {
      row.push(cell);
      cell = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      row.push(cell);
      if (row.some((c) => c !== "")) rows.push(row);
      row = [];
      cell = "";
    } else cell += ch;
  }
  row.push(cell);
  if (row.some((c) => c !== "")) rows.push(row);
  return rows;
}

/** "2026/10/09" や "20261009" を "2026-10-09" に。読めなければ null */
function 日付(v: unknown): string | null {
  if (v === null || v === undefined) return null;
  const s = String(v).trim();
  let m = s.match(/^(\d{4})[\/-](\d{1,2})[\/-](\d{1,2})(?:[ T](\d{1,2}):(\d{2})(?::(\d{2}))?)?/);
  if (m) {
    const d = `${m[1]}-${m[2].padStart(2, "0")}-${m[3].padStart(2, "0")}`;
    return m[4] ? `${d} ${m[4].padStart(2, "0")}:${m[5]}:${m[6] ?? "00"}` : d;
  }
  m = s.match(/^(\d{4})(\d{2})(\d{2})$/);
  return m ? `${m[1]}-${m[2]}-${m[3]}` : null;
}

/** "1,000" → 1000。数でなければ null */
function 数(v: unknown): number | null {
  if (v === null || v === undefined) return null;
  const s = String(v).replace(/[,¥\s]/g, "");
  if (s === "") return null;
  const n = Number(s);
  return isNaN(n) ? null : n;
}

/** Access で小数を整数の項目に入れたときと同じ丸め方（.5 は偶数の方へ） */
function cint(v: number): number {
  const f = Math.floor(v);
  const d = v - f;
  if (d > 0.5) return f + 1;
  if (d < 0.5) return f;
  return f % 2 === 0 ? f : f + 1;
}

/**
 * CSV を取り込み用の表に入れる（Access の C_CSV取込み：見出しが表の項目名と同じ前提）。
 * 表を空にしてから入れる。ID は Access のオートナンバーと同じく続きの番号。
 */
async function csvを表に入れる(c: PoolClient, table: string, schema: string, name: string, buf: Buffer, extra: Record<string, unknown>) {
  const rows = csvを読む(文字にする(buf));
  if (rows.length < 1) throw Object.assign(new Error("ファイルが空です"), { status: 400 });
  const head = rows[0].map((h) => h.trim());
  const cols = await c.query(
    `SELECT a.attname AS name, format_type(a.atttypid, a.atttypmod) AS type FROM pg_attribute a
     WHERE a.attrelid = $1::regclass AND a.attnum > 0 AND NOT a.attisdropped`,
    [`"${schema}"."${name}"`],
  );
  const types = new Map<string, string>(cols.rows.map((r: any) => [r.name, r.type]));
  const use = head.map((h, i) => ({ h, i })).filter((x) => types.has(x.h) && x.h !== "ID");
  if (use.length === 0)
    throw Object.assign(new Error("このファイルは、販盛の一覧の形ではないようです（見出しが合いません）"), { status: 400 });

  const { rows: mx } = await c.query(`SELECT COALESCE(MAX("ID"), 0) AS m FROM ${table}`);
  let id = Number(mx[0].m);
  await c.query(`DELETE FROM ${table}`);
  for (const r of rows.slice(1)) {
    const v: Record<string, unknown> = { ID: ++id, ...extra };
    for (const { h, i } of use) {
      const raw = (r[i] ?? "").trim();
      const ty = types.get(h)!;
      v[h] =
        raw === ""
          ? null
          : ty.startsWith("timestamp")
            ? 日付(raw)
            : ty === "integer" || ty === "smallint" || ty === "double precision" || ty === "bigint"
              ? 数(raw)
              : ty === "boolean"
                ? /^(true|-1|yes|はい)$/i.test(raw)
                : raw;
    }
    const k = Object.keys(v);
    await c.query(
      `INSERT INTO ${table} (${k.map((x) => `"${x}"`).join(", ")}) VALUES (${k.map((_, i) => `$${i + 1}`).join(", ")})`,
      k.map((x) => v[x]),
    );
  }
  return rows.length - 1;
}

// ---------------- 受注の取り込み ----------------

/** 販盛の受注と Access の受注を結びつける（Access の C_販盛番号取得） */
async function 販盛番号取得(c: PoolClient) {
  const { rows: list } = await c.query(`SELECT * FROM ${販盛受注} ORDER BY "ID"`);
  const 結ぶ = async (j: number, s: any, 備考: string) => {
    await c.query(`UPDATE ${受注} SET "販盛伝票番号" = $2, "受注番号" = $3, "枝番3" = $4 WHERE "受注ID" = $1`, [
      j, s.伝票番号, s.外部番号, s.行,
    ]);
    await c.query(`UPDATE ${販盛受注} SET "取込みチェック" = true, "取込み備考" = $2, "丸北受注ID" = $3 WHERE "ID" = $1`, [
      s.ID, 備考, j,
    ]);
  };
  // 1 回目：販盛の伝票番号＋行で探す
  for (const s of list) {
    const r = await c.query(
      `SELECT "受注ID" FROM ${受注} WHERE "受注ID" >= $1 AND "販盛伝票番号" = $2 AND "枝番3" = $3 ORDER BY "受注ID" LIMIT 1`,
      [番号を探す受注ID, s.伝票番号, s.行],
    );
    // Access の表示と同じ文言（最後の " も Access のまま）
    if (r.rows[0]) await 結ぶ(r.rows[0].受注ID, s, '●:取込み済み"');
  }
  // 2 回目：重さ・受注番号（外部番号）・納品日で探す
  for (const s of list) {
    const kg = 数(s["重量(kg)"]);
    const 納品日 = 日付(s.納品予定日);
    if (kg === null || 納品日 === null) continue;
    const r = await c.query(
      `SELECT "受注ID", "販盛伝票番号" FROM ${受注}
       WHERE "受注ID" >= $1 AND "商品kg" = $2 AND "受注番号" = $3 AND "納品日" = $4::date ORDER BY "受注ID" LIMIT 1`,
      [番号を探す受注ID, cint(kg), s.外部番号 ?? "999999", 納品日],
    );
    const j = r.rows[0];
    if (j && (j.販盛伝票番号 === null || j.販盛伝票番号 === s.伝票番号)) await 結ぶ(j.受注ID, s, "認識に成功！");
  }
}

/** 選んだ販盛の受注を Access の受注に入れる（Access の C_販盛受注インポート） */
async function 販盛受注インポート(c: PoolClient) {
  const { rows: list } = await c.query(`SELECT * FROM ${販盛受注} WHERE "選択chk" = true ORDER BY "ID"`);
  const 一つ = async (sql: string, args: unknown[]) => (await c.query(sql, args)).rows[0];
  let 成功 = 0;
  for (const s of list) {
    // ※ Access では「すでに取り込んだか」を確かめる部分が働いておらず、いつも新しく入れる（今のまま）
    const 品目 = String(s.品目コード ?? "");
    const 商品コード1 = 品目.startsWith("F") ? 0 : 数(品目);
    const 商品コード = (await 一つ(`SELECT "商品コード" FROM ${商品マスタ} WHERE "繁盛商品コード" = $1 LIMIT 1`, [品目]))?.商品コード ?? 0;
    const 商品 = await 一つ(`SELECT "商品名", "規格", "入数" FROM ${商品マスタ} WHERE "商品コード" = $1 LIMIT 1`, [商品コード]);
    let 入数: number = 商品?.入数 ?? 0;

    let 届け先コード: number;
    let 届け先コード1: number | null = null;
    if (!s.変換丸北届け先コード) {
      届け先コード1 = 数(s.納入先コード);
      届け先コード =
        (await 一つ(`SELECT "短縮コード" FROM ${得意先マスタ} WHERE "繁盛納入先コード" = $1 LIMIT 1`, [String(届け先コード1)]))
          ?.短縮コード ?? 0;
    } else 届け先コード = s.変換丸北届け先コード;
    const 届け先 = (await 一つ(`SELECT "短縮名" FROM ${得意先マスタ} WHERE "短縮コード" = $1 LIMIT 1`, [届け先コード]))?.短縮名 ?? null;

    // 受注先・受注元は、その届け先でいちばん多く受けている受注から（AQ_受注グループ取得用）
    const g = await 一つ(
      `SELECT "受注元ID", "届け先コード" FROM ${受注} WHERE "届け先コード" = $1
       GROUP BY "受注元ID", "受注元名", "届け先コード", "届け先" ORDER BY COUNT("受注ID") DESC LIMIT 1`,
      [届け先コード],
    );
    const 受注先ID = g?.届け先コード ?? 0;
    const 受注元ID = g?.受注元ID ?? 0;
    const 名前 = async (code: number) =>
      (await 一つ(`SELECT "短縮名" FROM ${得意先マスタ} WHERE "短縮コード" = $1 LIMIT 1`, [code]))?.短縮名 ?? null;

    const 特定 = await 一つ(`SELECT "備考" FROM ${受注特定項目} WHERE "商品コード" = $1 AND "届け先コード" = $2 LIMIT 1`, [
      商品コード, 届け先コード,
    ]);

    const 商品kg = 数(s["重量(kg)"]);
    let ケース: number | null = null;
    if (入数 !== 0 && 商品kg !== null) ケース = cint(商品kg / 入数);
    else if (入数 === 0) 入数 = 0;

    let 備考 = "";
    if (商品コード === 0 && 届け先コード === 0) 備考 = "×:商品コードエラー\n×:届け先コードエラー";
    else if (商品コード === 0) 備考 = "×:商品コードエラー";
    else if (届け先コード === 0) 備考 = "×:届け先コードエラー";
    else if (入数 === 0) 備考 = "×:入数エラー";

    if (備考) {
      await c.query(`UPDATE ${販盛受注} SET "取込みチェック" = false, "取込み備考" = $2 WHERE "ID" = $1`, [s.ID, 備考]);
      continue;
    }

    await c.query(`SELECT pg_advisory_xact_lock(hashtext('TD_受注.受注ID'))`);
    const id = Number((await 一つ(`SELECT COALESCE(MAX("受注ID"), 0) + 1 AS id FROM ${受注}`, [])).id);
    const now = 日本の今();
    const v: Record<string, unknown> = {
      ...新規の既定値,
      受注ID: id,
      販盛伝票番号: s.伝票番号, 枝番3: s.行,
      納品日: 日付(s.納品予定日), 受注日: 日付(s.受注日), 出荷予定日: 日付(s.出荷予定日), 受注番号: s.外部番号,
      登録時間: now.日時, 入力日: now.日付,
      商品コード1, 商品コード, 商品名: 商品?.商品名 ?? null, 規格: 商品?.規格 ?? "", 入数,
      届け先コード, 届け先,
      受注先ID, 受注先名: await 名前(受注先ID), 受注元ID, 受注元名: await 名前(受注元ID),
      隠語: "販盛In",
      商品kg, ケース,
    };
    if (届け先コード1 !== null) v.届け先コード1 = 届け先コード1;
    if (特定?.備考) v.備考 = 特定.備考;
    const k = Object.keys(v);
    await c.query(
      `INSERT INTO ${受注} (${k.map((x) => `"${x}"`).join(", ")}) VALUES (${k.map((_, i) => `$${i + 1}`).join(", ")})`,
      k.map((x) => v[x]),
    );
    await c.query(`UPDATE ${販盛受注} SET "丸北受注ID" = $2, "取込みチェック" = true, "取込み備考" = '〇:成功！' WHERE "ID" = $1`, [
      s.ID, id,
    ]);
    成功++;
  }
  return { 選択: list.length, 成功 };
}

// ---------------- 売上 ----------------

/** 販盛の売上と Access の受注を結びつける（Access の C_販盛売上番号取得） */
async function 販盛売上番号取得(c: PoolClient) {
  const { rows: list } = await c.query(`SELECT * FROM ${販盛売上} ORDER BY "ID"`);
  let n = 0;
  for (const s of list) {
    const r = await c.query(
      `SELECT "受注ID" FROM ${受注} WHERE "受注ID" >= $1 AND "販盛伝票番号" = $2 AND "枝番3" = $3 ORDER BY "受注ID" LIMIT 1`,
      [番号を探す受注ID, s.受注伝票番号 === null ? null : String(s.受注伝票番号), s.受注行番号 === null ? null : String(s.受注行番号)],
    );
    const j = r.rows[0];
    if (!j) continue;
    await c.query(`UPDATE ${受注} SET "販盛売上番号" = $2, "販盛売上行" = $3 WHERE "受注ID" = $1`, [
      j.受注ID, s.伝票番号 === null ? null : String(s.伝票番号), s.行 === null ? null : String(s.行),
    ]);
    await c.query(`UPDATE ${販盛売上} SET "取込みチェック" = true, "取込み備考" = '●:取込み済み"', "丸北受注ID" = $2 WHERE "ID" = $1`, [
      s.ID, j.受注ID,
    ]);
    n++;
  }
  return n;
}

// ---------------- 単価チェック ----------------

/** 品目コード "02143400" → 2143400（Access の CLng と同じ。数でなければ null） */
function 長整数(v: unknown): number | null {
  const n = 数(v);
  return n === null ? null : cint(n);
}

/** 指定した日の売上の Kg 単価を、販盛の単価マスタと見比べる（Access の C_販盛売上単価アンマッチ） */
async function 単価違算チェック(c: PoolClient, day: string) {
  // Access と同じく、見比べるのは「納品予定日」がその日の売上（画面に出すのは「売上日」がその日のもの）
  const { rows: list } = await c.query(`SELECT * FROM ${販盛売上} WHERE "納品予定日" = $1::date ORDER BY "ID"`, [day]);
  let 違う = 0;
  for (const s of list) {
    const 納入先 = 長整数(s.納入先コード ?? 0);
    const 商品 = 長整数(s.品目コード);
    if (商品 === null) continue;
    // AQ_販盛単価_最新期間開始日：単位コード 1 の、取引先・納入先・商品ごとの一番新しい期間開始日（取引先コードの順で最初のもの）
    const m = (
      await c.query(
        `SELECT "納入先コード", MAX("期間開始日") AS "最大" FROM ${販盛単価マスタ}
         WHERE "単位コード" = 1 AND "納入先コード" = $1 AND "商品コード" = $2
         GROUP BY "取引先コード", "納入先コード", "商品コード" ORDER BY "取引先コード" LIMIT 1`,
        [納入先, 商品],
      )
    ).rows[0];
    if (!m) continue;
    const p = (
      await c.query(
        `SELECT "単価" FROM ${販盛単価マスタ}
         WHERE "単位コード" = 1 AND "期間開始日" = $1 AND "納入先コード" = $2 AND "商品コード" = $3 ORDER BY "ID" LIMIT 1`,
        [m.最大, m.納入先コード, 商品],
      )
    ).rows[0];
    const 参照 = p?.単価 ?? null;
    const d = String(m.最大);
    const メモ = `${d.slice(2, 4)}/${d.slice(5, 7)}/${d.slice(8, 10)} 開始単価`;
    // Access と同じく、違っていれば印を付ける（同じでも、前に付いた印は消さない）
    const ng = 参照 !== null && s.Kg単価 !== null && Number(参照) !== Number(s.Kg単価);
    await c.query(
      `UPDATE ${販盛売上} SET "参照Kg単価" = $2, "メモ３" = $3 ${ng ? `, "アンマッチフラグ" = true` : ""} WHERE "ID" = $1`,
      [s.ID, 参照, メモ],
    );
    if (ng) 違う++;
  }
  return { 件数: list.length, 違う };
}

async function 一連で(fn: (c: PoolClient) => Promise<unknown>) {
  const c = await pool.connect();
  try {
    await c.query("BEGIN");
    const r = await fn(c);
    await c.query("COMMIT");
    return r;
  } catch (e) {
    await c.query("ROLLBACK");
    throw e;
  } finally {
    c.release();
  }
}

export function hanmoriRoutes(app: FastifyInstance) {
  app.addHook("preHandler", requireUser);
  // ファイルはそのままの中身（バイト）で受け取る
  app.addContentTypeParser("application/octet-stream", { parseAs: "buffer", bodyLimit: 20 * 1024 * 1024 }, (_req, body, done) =>
    done(null, body),
  );
  app.setErrorHandler((e: any, _req, reply) => {
    reply.code(e.status ?? e.statusCode ?? 500).send({ error: e.status ? e.message : "うまくいきませんでした：" + e.message });
  });

  // ---- 販盛受注取込み ----

  // 画面を開いたとき（Access と同じく、前の読み込みを消す）
  app.post("/api/hanmori/juchu/open", async () => {
    await q(`DELETE FROM ${販盛受注}`);
    return { ok: true };
  });

  // 一覧（only=unlinked なら、まだ結びついていないものだけ）
  app.get<{ Querystring: { only?: string } }>("/api/hanmori/juchu/list", async (req) =>
    q(
      `SELECT s."ID", s."選択chk", s."取込み備考", s."外部番号", s."伝票番号", s."丸北受注ID", s."行", s."品名", s."箱数", s."数量",
              s."重量(kg)", s."納入先コード", s."納入先名", s."納品予定日", s."変換丸北届け先コード", j."受注番号" AS "Access受注番号"
       FROM ${販盛受注} s LEFT JOIN ${受注} j ON j."受注ID" = s."丸北受注ID"
       ${req.query.only === "unlinked" ? `WHERE COALESCE(s."丸北受注ID", 0) = 0` : ""}
       ORDER BY s."ID"`,
    ),
  );

  // ファイルを読み込んで、番号を結びつける（ファイル参照・番号認識）
  app.post("/api/hanmori/juchu/upload", async (req) => {
    const buf = req.body as Buffer;
    return 一連で(async (c) => {
      const n = await csvを表に入れる(c, 販盛受注, "juchu_fe", "T_販盛受注", buf, {
        取込みチェック: false, 選択chk: false, 丸北受注ID: 0, 変換丸北届け先コード: 0,
      });
      await 販盛番号取得(c);
      return { 件数: n };
    });
  });

  // 1 行を直す（選択・読込変換届け先コード）
  app.post<{ Body: { ID: number; 選択chk?: boolean; 変換丸北届け先コード?: number | null } }>("/api/hanmori/juchu/row", async (req) => {
    const b = req.body;
    if ("選択chk" in b) await q(`UPDATE ${販盛受注} SET "選択chk" = $2 WHERE "ID" = $1`, [b.ID, !!b.選択chk]);
    if ("変換丸北届け先コード" in b) {
      const code = b.変換丸北届け先コード ?? 0;
      // Access と同じく、納入先名も選んだ届け先の名前に変わる
      const [m] = await q<{ 短縮名: string }>(`SELECT "短縮名" FROM ${得意先マスタ} WHERE "短縮コード" = $1 LIMIT 1`, [code]);
      await q(`UPDATE ${販盛受注} SET "変換丸北届け先コード" = $2, "納入先名" = $3 WHERE "ID" = $1`, [b.ID, code, m?.短縮名 ?? null]);
    }
    return { ok: true };
  });

  // 受注取込み
  app.post("/api/hanmori/juchu/import", async (_req, reply) => {
    const [{ n }] = await q<{ n: number }>(`SELECT COUNT(*)::int AS n FROM ${販盛受注} WHERE "選択chk" = true`);
    if (n === 0) return reply.code(400).send({ error: "インポートするデータが選択されていません" });
    return 一連で(販盛受注インポート);
  });

  // ---- 販盛売上出力 ----

  // 一覧（販盛の受注番号がある受注。only=unlinked なら、売上番号がまだのもの。どちらも受注日が 7 日前から）
  app.get<{ Querystring: { only?: string } }>("/api/hanmori/uriage/list", async (req) => {
    const from = new Date(Date.now() + 9 * 3600 * 1000 - 7 * 86400 * 1000).toISOString().slice(0, 10);
    return q(
      `SELECT "受注ID", "出力用chk", "販盛売上番号", "販盛伝票番号", "商品名", "ケース", "商品kg", "届け先", "納品日", "受注日"
       FROM ${受注}
       WHERE "商品kg" <> 0 AND "販盛伝票番号" IS NOT NULL AND "受注日" >= $1::date
       ${req.query.only === "unlinked" ? `AND "販盛売上番号" IS NULL` : ""}
       ORDER BY "納品日", "販盛伝票番号"`,
      [from],
    );
  });

  // 売上実績一覧のファイルを読み込んで、売上番号を結びつける
  app.post("/api/hanmori/uriage/upload", async (req) => {
    const buf = req.body as Buffer;
    return 一連で(async (c) => {
      const n = await csvを表に入れる(c, 販盛売上, "juchu_fe", "T_販盛売上", buf, { 取込みチェック: false, 選択chk: false });
      const 結んだ = await 販盛売上番号取得(c);
      return { 件数: n, 結んだ };
    });
  });

  // 番号認識（前に読み込んだ売上で、もう一度結びつける）
  app.post("/api/hanmori/uriage/recognize", async () => 一連で(async (c) => ({ 結んだ: await 販盛売上番号取得(c) })));

  // ---- 単価チェック（F_販盛単価確認） ----

  app.get("/api/hanmori/tanka/info", async () => {
    const [u] = await q(`SELECT "販盛単価マスタ取得日" FROM ${ユーザー設定} LIMIT 1`);
    return { 取得日: u?.販盛単価マスタ取得日 ?? null };
  });

  // 単価マスタ（PRICE_INQUIRY）のファイルを読み込む
  app.post("/api/hanmori/tanka/master-upload", async (req) => {
    const buf = req.body as Buffer;
    return 一連で(async (c) => {
      const n = await csvを表に入れる(c, 販盛単価マスタ, "juchu_fe", "T_販盛単価マスタ", buf, {});
      await c.query(`UPDATE ${ユーザー設定} SET "販盛単価マスタ取得日" = $1`, [日本の今().日時]);
      return { 件数: n };
    });
  });

  // 日を選んで、単価の違いを調べる
  app.post<{ Body: { day: string } }>("/api/hanmori/tanka/check", async (req) =>
    一連で((c) => 単価違算チェック(c, req.body.day)),
  );

  // 一覧（売上日がその日のもの。日がなければ全部）
  app.get<{ Querystring: { day?: string } }>("/api/hanmori/tanka/list", async (req) =>
    q(
      `SELECT "ID", "売上日", "伝票番号", "行", "丸北受注ID", "納入先コード", "納入先名", "品目コード", "品名",
              "重量(kg)", "単価", "Kg単価", "参照Kg単価", "メモ３", "アンマッチフラグ", "納品予定日"
       FROM ${販盛売上} ${req.query.day ? `WHERE "売上日" = $1::date` : ""}
       ORDER BY "売上日", "伝票番号", "行"`,
      req.query.day ? [req.query.day] : [],
    ),
  );

  // 参照Kg単価の選択肢（その納入先・商品の単価マスタ）
  app.get<{ Querystring: { nounyu: string; hinmoku: string } }>("/api/hanmori/tanka/prices", async (req) =>
    q(
      `SELECT "単価", "期間開始日" FROM ${販盛単価マスタ}
       WHERE "単位コード" = 1 AND "納入先コード" = $1 AND "商品コード" = $2 ORDER BY "期間開始日" DESC`,
      [長整数(req.query.nounyu ?? 0), 長整数(req.query.hinmoku)],
    ),
  );

  app.post<{ Body: { ID: number; 参照Kg単価: number | null } }>("/api/hanmori/tanka/set", async (req) => {
    await q(`UPDATE ${販盛売上} SET "参照Kg単価" = $2 WHERE "ID" = $1`, [req.body.ID, req.body.参照Kg単価]);
    return { ok: true };
  });
}
