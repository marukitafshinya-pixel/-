import type { FastifyInstance } from "fastify";
import type { PoolClient } from "pg";
import { q, t, 日本の今 } from "./db.js";
import { requireUser } from "./auth.js";
import { 新規の既定値 } from "./juchuForm.js";
import { cint, csvを表に入れる, 一連で, 数 } from "./hanmori.js";

// SB受注取り込み（Access の F_エスビー受注インポート）で使う表
const 受注 = t("juchu", "TD_受注");
const SB受注 = t("juchu_fe", "T_エスビーweb受注");
const 相手先商品 = t("juchu", "TM_相手先商品マスタ");
const 相手先届け先 = t("juchu_fe", "TM_相手先届け先マスタ");
const 得意先マスタ = t("juchu_fe", "TM_得意先マスタ");
const 商品マスタ = t("juchu_fe", "TM_商品マスタ");
const 受注先マスタ = t("juchu_fe", "TM_受注先マスタ");

/** 数を文字にするとき、Access と同じく小数点以下が 0 なら付けない（12345.0 → "12345"） */
function 数の文字(v: unknown): string | null {
  return v === null || v === undefined ? null : String(Number(v));
}

/** "2026-01-20 00:00:00" → "1月20日" */
function 月日(v: unknown): string {
  const m = String(v).match(/^\d{4}-(\d{2})-(\d{2})/);
  return m ? `${Number(m[1])}月${Number(m[2])}日` : String(v);
}

class 止まった extends Error {}

/**
 * 1 行を受注に入れる（Access の C_エスビーweb受注インポート の 1 回分）。
 * Access で処理が止まってしまう場面（届け先・受注先が見つからない、入数が 0 など）は、ここでも止める。
 */
async function 一行(c: PoolClient, s: any): Promise<void> {
  const 一つ = async (sql: string, args: unknown[]) => (await c.query(sql, args)).rows[0];
  const 名前 = async (code: unknown) =>
    (await 一つ(`SELECT "短縮名" FROM ${得意先マスタ} WHERE "短縮コード" = $1 LIMIT 1`, [code]))?.短縮名 ?? null;

  const 品目 = String(s.工場品目 ?? "").slice(0, 6);
  const 商品コード =
    (await 一つ(`SELECT "商品コード" FROM ${相手先商品} WHERE "受注元コード" = 357 AND "相手先商品コード" = $1 LIMIT 1`, [品目]))
      ?.商品コード ?? 0;
  const 商品 = await 一つ(`SELECT "商品名", "規格", "入数" FROM ${商品マスタ} WHERE "商品コード" = $1 LIMIT 1`, [商品コード]);
  const 入数: number = 商品?.入数 ?? 0;

  const 届け先コード = (
    await 一つ(`SELECT "自社コード" FROM ${相手先届け先} WHERE "相手先コード" = 357 AND "相手先名称" = $1 LIMIT 1`, [s.納入先])
  )?.自社コード;
  if (届け先コード === null || 届け先コード === undefined)
    throw new 止まった(`納入先「${s.納入先 ?? ""}」が相手先届け先マスタにありません`);
  const 受注先ID = (await 一つ(`SELECT "受注先ID" FROM ${受注先マスタ} WHERE "指定届け先コード" = $1 LIMIT 1`, [届け先コード]))
    ?.受注先ID;
  if (受注先ID === null || 受注先ID === undefined)
    throw new 止まった(`届け先コード ${届け先コード} が受注先マスタの指定届け先にありません`);

  const 商品kg = 数(s.数量回答);
  if (商品kg !== null && 入数 === 0)
    throw new 止まった(`工場品目 ${s.工場品目 ?? ""} の入数がわかりません（商品コードが見つからないか、入数が 0）`);
  const ケース = 商品kg === null ? null : cint(商品kg / 入数);

  let 備考 = "";
  if (商品コード === 0 && 届け先コード === 0) 備考 = "×:商品コードエラー\n×:届け先コードエラー";
  else if (商品コード === 0) 備考 = "×:商品コードエラー";
  else if (届け先コード === 0) 備考 = "×:届け先コードエラー";
  else if (入数 === 0) 備考 = "×:入数エラー";
  if (備考) {
    await c.query(`UPDATE ${SB受注} SET "取込みチェック" = false, "取込み備考" = $2 WHERE "ID" = $1`, [s.ID, 備考]);
    return;
  }

  await c.query(`SELECT pg_advisory_xact_lock(hashtext('TD_受注.受注ID'))`);
  const id = Number((await 一つ(`SELECT COALESCE(MAX("受注ID"), 0) + 1 AS id FROM ${受注}`, [])).id);
  const now = 日本の今();
  const v: Record<string, unknown> = {
    ...新規の既定値,
    受注ID: id,
    商品コード, 商品名: 商品?.商品名 ?? null, 規格: 商品?.規格 ?? "", 入数,
    受注日: s.確認日, 統一受注ID: 数の文字(s.オーダーNo),
    登録時間: now.日時, 入力日: now.日付,
    届け先コード, 届け先: await 名前(届け先コード),
    受注元ID: 357, 受注元名: await 名前(357),
    受注先ID, 受注先名: await 名前(受注先ID),
    受注番号: 数の文字(s.依頼書No), 納品日: s.今回納期, 商品kg, ケース,
    受注区分: s.備考 === "名義変更" ? 2 : 1,
  };
  if (s.前回納期) v.備考 = `${月日(s.前回納期)} ${数の文字(s.前回依頼数) ?? ""} から変更`;
  const k = Object.keys(v);
  await c.query(
    `INSERT INTO ${受注} (${k.map((x) => `"${x}"`).join(", ")}) VALUES (${k.map((_, i) => `$${i + 1}`).join(", ")})`,
    k.map((x) => v[x]),
  );
  await c.query(`UPDATE ${SB受注} SET "丸北受注ID" = $2, "取込みチェック" = true, "取込み備考" = '〇:成功！' WHERE "ID" = $1`, [s.ID, id]);
}

/**
 * 読み込んだ全部の行を受注に入れる。
 * ※ Access では「すでに取り込んだか」を確かめる部分が働いておらず、押すたびに全部の行を新しく入れる（今のまま）。
 * ※ Access と同じく、途中で止まっても、それまでに入れた行は残る。
 */
async function SB受注インポート() {
  const list = await q(`SELECT * FROM ${SB受注} ORDER BY "ID"`);
  let 成功 = 0;
  for (const s of list) {
    try {
      await 一連で((c) => 一行(c, s));
      const [r] = await q<{ 取込みチェック: boolean }>(`SELECT "取込みチェック" FROM ${SB受注} WHERE "ID" = $1`, [s.ID]);
      if (r?.取込みチェック) 成功++;
    } catch (e) {
      if (e instanceof 止まった) return { 行数: list.length, 成功, 止まった: `${s.ID} 行目で止まりました：${e.message}` };
      throw e;
    }
  }
  return { 行数: list.length, 成功 };
}

export function sbRoutes(app: FastifyInstance) {
  app.addHook("preHandler", requireUser);
  app.addContentTypeParser("application/octet-stream", { parseAs: "buffer", bodyLimit: 20 * 1024 * 1024 }, (_req, body, done) =>
    done(null, body),
  );
  app.setErrorHandler((e: any, _req, reply) => {
    reply.code(e.status ?? e.statusCode ?? 500).send({ error: e.status ? e.message : "うまくいきませんでした：" + e.message });
  });

  // 画面を開いたとき（Access と同じく、前の読み込みを消す）
  app.post("/api/sb/open", async () => {
    await q(`DELETE FROM ${SB受注}`);
    return { ok: true };
  });

  app.get("/api/sb/list", async () =>
    q(
      `SELECT "ID", "選択chk", "取込み備考", "オーダーNo", "依頼書No", "納入先", "工場品目", "品目名称", "今回納期", "数量回答",
              "単位", "備考", "前回納期", "前回依頼数", "丸北受注ID"
       FROM ${SB受注} ORDER BY "ID"`,
    ),
  );

  // ファイル参照：SB の受注（Windows アプリのテキスト CSV）を読み込む
  app.post("/api/sb/upload", async (req) => {
    const buf = req.body as Buffer;
    return 一連で(async (c) => ({
      件数: await csvを表に入れる(c, SB受注, "juchu_fe", "T_エスビーweb受注", buf, { 取込みチェック: false, 選択chk: false, 丸北受注ID: 0 }),
    }));
  });

  // 番号認識・選択：受注に取り込む
  app.post<{ Body: { 選択ID?: number } }>("/api/sb/import", async (req) => {
    if (req.body?.選択ID) await q(`UPDATE ${SB受注} SET "選択chk" = NOT COALESCE("選択chk", false) WHERE "ID" = $1`, [req.body.選択ID]);
    return SB受注インポート();
  });
}
