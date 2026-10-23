import type { FastifyInstance } from "fastify";
import type { PoolClient } from "pg";
import { pool, q, t, 日本の今 } from "./db.js";
import { requireUser } from "./auth.js";
import { cint } from "./hanmori.js";
import { 一連で, 賞味期限計算 } from "./ws.js";

// 製造計画（Access の 製造計画.accdb）。
// 大阪で入れた生産計画（大阪丸北生産計画）を、製造管理の入庫予定（TD_入庫）に取り込み、変わったところを WorkStation の出荷に知らせる。
const 大阪の計画 = t("kyoyu", "大阪丸北生産計画");
const 新規生産計画 = t("kyoyu", "TD_新規生産計画");
const 前回生産計画 = t("keikaku", "TD_前回生産計画");
const 変更案内 = t("keikaku", "TD_生産計画変更案内");
const 変更日の表 = t("keikaku", "T_生産計画変更案内");
const 変更ログ = t("keikaku", "T_製造変更ログ");
const 検査区分 = t("keikaku", "TM_商品検査区分作成");
const 入庫 = t("seizo", "TD_入庫");
const 出荷 = t("ws", "TD_出荷");
const 商品マスタ = t("kyotsu", "TM_商品マスタ");
const 得意先マスタ = t("kyotsu", "TM_得意先マスタ");

type Rec = Record<string, any>;
const n = (v: unknown) => Number(v ?? 0) || 0;
const 空 = (v: unknown) => v === null || v === undefined;
const 日付 = (v: unknown) => (v ? String(v).slice(0, 10) : null);
/** VBA の a <> b（どちらかが Null なら「違う」にならない） */
const 違う = (a: unknown, b: unknown) => !空(a) && !空(b) && String(a) !== String(b);
/** Access の日付の通し番号（CLng(日付)） */
const 日の番号 = (d: string) => Math.round((Date.parse(d.slice(0, 10) + "T00:00:00Z") - Date.UTC(1899, 11, 30)) / 864e5);
/** VBA で日付を文字にしたとき（時刻が 0 なら日付だけ） */
function 日付の文字(d: string) {
  const [日, 時 = "00:00:00"] = d.split(/[ T]/);
  const s = 日.replace(/-/g, "/");
  if (時.startsWith("00:00:00")) return s;
  const [h, m, sec] = 時.slice(0, 8).split(":");
  return `${s} ${Number(h)}:${m}:${sec}`;
}
/** VBA で数を文字につなげたとき（Null は空） */
const 数の文字 = (v: unknown) => (空(v) ? "" : String(Number(v)));

/** 表の項目（Access と同じ並び）と型 */
async function 項目一覧(c: PoolClient, schema: string, table: string) {
  return (
    await c.query(
      `SELECT column_name AS name, data_type AS type FROM information_schema.columns WHERE table_schema = $1 AND table_name = $2 ORDER BY ordinal_position`,
      [schema, table],
    )
  ).rows as { name: string; type: string }[];
}

/** 行を入れる。Access の表の既定値（数は 0、はい／いいえ は いいえ、登録時間は今）を先に入れておく */
async function 既定値で入れる(c: PoolClient, 表: string, 項目: { name: string; type: string }[], v: Rec, 今: string) {
  const all: Rec = {};
  for (const f of 項目) {
    if (f.type === "boolean") all[f.name] = false;
    else if (["integer", "double precision", "smallint", "bigint", "numeric", "real"].includes(f.type)) all[f.name] = 0;
  }
  if (項目.some((f) => f.name === "登録時間")) all.登録時間 = 今;
  Object.assign(all, v);
  const k = Object.keys(all).filter((x) => 項目.some((f) => f.name === x));
  await c.query(`INSERT INTO ${表} (${k.map((x) => `"${x}"`).join(", ")}) VALUES (${k.map((_, i) => `$${i + 1}`).join(", ")})`, k.map((x) => all[x]));
}

/**
 * Access で、違う型の項目に値を入れたとき（On Error Resume Next なので、入らないものは飛ばす）。
 * 入らないときは undefined を返す。
 */
function 型を合わせる(v: unknown, 型: string): unknown {
  if (空(v)) return null;
  const 数 = ["integer", "double precision", "smallint", "bigint", "numeric", "real"].includes(型);
  if (型 === "character varying" || 型 === "text") {
    if (typeof v === "boolean") return v ? "-1" : "0";
    if (typeof v === "string" && /^\d{4}-\d{2}-\d{2}/.test(v)) return 日付の文字(v);
    return String(v);
  }
  if (型 === "boolean") {
    if (typeof v === "boolean") return v;
    if (typeof v === "number") return v !== 0;
    if (typeof v === "string" && v.trim() !== "" && !isNaN(Number(v))) return Number(v) !== 0;
    if (v === "True" || v === "False") return v === "True";
    return undefined;
  }
  if (数) {
    if (typeof v === "boolean") return v ? -1 : 0;
    if (typeof v === "number") return 型 === "integer" ? cint(v) : v;
    if (typeof v === "string" && /^\d{4}-\d{2}-\d{2}/.test(v)) return 日の番号(v);
    if (typeof v === "string" && v.trim() !== "" && !isNaN(Number(v))) return 型 === "integer" ? cint(Number(v)) : Number(v);
    return undefined;
  }
  if (型.startsWith("timestamp")) {
    if (typeof v === "number") return new Date(Date.UTC(1899, 11, 30) + Math.round(v) * 864e5).toISOString().slice(0, 10) + " 00:00:00";
    if (typeof v === "string") {
      const m = v.match(/^(\d{4})[/-](\d{1,2})[/-](\d{1,2})(?:[ T](\d{1,2}):(\d{2})(?::(\d{2}))?)?/);
      if (!m) return undefined;
      return `${m[1]}-${m[2].padStart(2, "0")}-${m[3].padStart(2, "0")} ${(m[4] ?? "0").padStart(2, "0")}:${m[5] ?? "00"}:${m[6] ?? "00"}`;
    }
    return undefined;
  }
  return v;
}

/** 前回の計画変更日（T_生産計画変更案内）と、大阪の計画の作成日のいちばん新しいもの */
async function 変更日(c: PoolClient) {
  const 前回 = (await c.query(`SELECT "生産計画変更日" AS d FROM ${変更日の表} LIMIT 1`)).rows[0]?.d ?? null;
  const r = (await c.query(`SELECT MAX("作成日") AS d, MAX("製造日")::date::text AS e FROM ${大阪の計画}`)).rows[0];
  return { 前回: 前回 as string | null, 今回: (r?.d ?? null) as string | null, 最後の製造日: (r?.e ?? null) as string | null };
}

/** 在庫変更を出荷に知らせる（C_在庫変更通知）。知らせた件数を返す */
export async function 出荷に知らせる(c: PoolClient, 入庫ID: number, 通知区分: string | null) {
  const r = await c.query(`UPDATE ${出荷} SET "通知" = '訂正', "計画変更chk" = true, "変更通知" = $2 WHERE COALESCE("chk", false) = false AND "入庫ID" = $1`, [入庫ID, 通知区分]);
  return r.rowCount ?? 0;
}

/**
 * 生産計画のインポート（Access の CC_生産計画）。順番も Access と同じ。
 * 1. 前回生産計画を、いまの入庫予定（TD_入庫）から作り直す
 * 2. 新規生産計画に、大阪の計画のうち期間の分を写す
 * 3. 前回と新規を製造ID で比べ、製造変更・kg変更・包装日変更・新規 の印を付ける
 * 4. 変わった製造の入庫予定に印を付け、数量が決まっていないものは出荷に知らせてから消す
 * 5. 新規・変更の分を入庫予定に入れる（検査区分の表があれば、予想kg ごとに分ける）
 * 6. 変更案内（WorkStation の製造変更案内に出る表）を作る
 * 7. 計画変更日を進め、ログを残す
 */
export async function 生産計画を取り込む(開始: string, 終了: string) {
  return 一連で(async (c) => {
    await c.query(`LOCK TABLE ${入庫} IN EXCLUSIVE MODE`);
    const 今 = 日本の今();
    const 今日 = 今.日付;
    const { 前回: 前回の変更日, 今回: 今回の変更日 } = await 変更日(c);

    // ---- 1. C_生産計画データ更新 ----
    await c.query(`DELETE FROM ${前回生産計画}`);
    const 前回の元 = (
      await c.query(
        `SELECT i."製造ID", i."倉庫ID", MIN(i."入庫日") AS "入庫日", i."商品コード", i."商品名", i."製造日", i."賞味期限",
                SUM(i."ケース") AS "ケース", SUM(i."商品kg") AS "商品kg", i."作業場"
         FROM ${入庫} i
         WHERE COALESCE(i."製造予定入力chk", false) = false AND COALESCE(i."出来高入力chk", false) = false
         GROUP BY i."製造ID", i."倉庫ID", i."商品コード", i."商品名", i."製造日", i."賞味期限", i."作業場", i."chk", i."原料コード"
         HAVING i."商品コード" <> 746 AND i."製造日" > $1::date AND COALESCE(i."chk", false) = false
         ORDER BY i."倉庫ID", MIN(i."入庫日"), i."製造日"`,
        [今日],
      )
    ).rows;
    if (!前回の元.length) throw Object.assign(new Error("入庫予定（明日以降の製造）がないため、取り込めません。"), { statusCode: 400 });
    for (const r of 前回の元) {
      const m = (await c.query(`SELECT "規格", "入数" FROM ${商品マスタ} WHERE "商品コード" = $1 LIMIT 1`, [r.商品コード])).rows[0];
      const 倉庫名 = (await c.query(`SELECT "短縮名" FROM ${得意先マスタ} WHERE "短縮コード" = $1 LIMIT 1`, [r.倉庫ID])).rows[0]?.短縮名 ?? null;
      await c.query(
        `INSERT INTO ${前回生産計画} ("作業場", "製造ID", "入庫日", "倉庫ID", "倉庫名", "商品コード", "商品名", "規格", "入数", "製造日", "賞味期限", "製造識別コード", "ケース", "商品kg", "抽出区分")
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, false)`,
        [
          r.作業場, r.製造ID, r.入庫日, r.倉庫ID, 倉庫名, r.商品コード, r.商品名, m?.規格 ?? null, m?.入数 ?? null, r.製造日, r.賞味期限,
          `${r.製造日 ? 日の番号(r.製造日) : ""}#${r.商品コード ?? ""}#${r.倉庫ID ?? ""}#${r.作業場 ?? ""}`,
          r.ケース === null ? null : cint(n(r.ケース)), r.商品kg,
        ],
      );
    }

    // ---- 2. C_生産計画インポート ----
    await c.query(`DELETE FROM ${新規生産計画}`);
    const 大阪の項目 = (await 項目一覧(c, "kyoyu", "大阪丸北生産計画")).map((f) => f.name);
    const 新規の項目 = await 項目一覧(c, "kyoyu", "TD_新規生産計画");
    const 写す = 大阪の項目.filter((x) => 新規の項目.some((f) => f.name === x)).map((x) => `"${x}"`).join(", ");
    const 写した = await c.query(`INSERT INTO ${新規生産計画} (${写す}) SELECT ${写す} FROM ${大阪の計画} WHERE "製造日" BETWEEN $1::date AND $2::date`, [開始, 終了]);
    if (!写した.rowCount) throw Object.assign(new Error("この期間の生産計画がありません。"), { statusCode: 400 });

    // ---- 3. C_製造予定変更チェック（製造ID で比べる） ----
    const 新規 = (await c.query(`SELECT ctid::text AS k, * FROM ${新規生産計画} WHERE "製造日" > $1::date`, [今日])).rows as Rec[];
    const 前回 = (await c.query(`SELECT ctid::text AS k, * FROM ${前回生産計画}`)).rows as Rec[];
    const 印 = (r: Rec, 通知: string) => Object.assign(r, { 抽出区分: true, 通知, 変わった: true });
    for (const p of 前回) {
      const s = 空(p.製造ID) ? undefined : 新規.find((x) => x.製造ID === p.製造ID);
      if (!s) {
        印(p, "製造変更"); // 製造予定の商品がなくなった
        continue;
      }
      if (違う(p.商品コード, s.商品コード)) {
        印(p, "製造変更");
        印(s, "製造変更");
      } else {
        if (違う(p.ケース, s.ケース)) {
          印(p, "kg変更");
          印(s, "kg変更");
          s.変更記録 = `${数の文字(p.商品kg)}kg → ${数の文字(s.商品kg)}kgに変更`;
        }
        if (違う(p.入庫日, s.入庫日)) {
          印(p, "包装日変更");
          印(s, "包装日変更");
        }
      }
    }
    for (const s of 新規) {
      if (空(s.製造ID) || !前回.some((p) => p.製造ID === s.製造ID)) 印(s, "新規");
    }
    for (const p of 前回.filter((x) => x.変わった))
      await c.query(`UPDATE ${前回生産計画} SET "抽出区分" = true, "通知" = $2 WHERE ctid = $1::tid`, [p.k, p.通知]);
    for (const s of 新規.filter((x) => x.変わった))
      await c.query(`UPDATE ${新規生産計画} SET "抽出区分" = true, "通知" = $2, "変更記録" = $3 WHERE ctid = $1::tid`, [s.k, s.通知, s.変更記録 ?? null]);

    // ---- 4. C_生産計画データ変更案内 ----
    for (const p of 前回.filter((x) => x.抽出区分))
      await c.query(`UPDATE ${入庫} SET "製造変更chk" = true, "変更通知" = $2 WHERE COALESCE("chk", false) = false AND "製造ID" = $1`, [n(p.製造ID), p.通知]);
    const 消す = (
      await c.query(
        `SELECT "入庫ID", "変更通知" FROM ${入庫} WHERE "製造日" BETWEEN $1::date AND $2::date AND "数量確定フラグ" <> -1 AND "製造変更chk" = true ORDER BY "入庫ID"`,
        [開始, 終了],
      )
    ).rows;
    const 知らせ: string[] = [];
    let 消した = 0;
    for (const r of 消す) {
      const 件数 = await 出荷に知らせる(c, r.入庫ID, r.変更通知);
      if (件数 > 0) 知らせ.push(`変更により、出荷計画に${件数} 件の変更通知を送ります。`);
      await c.query(`DELETE FROM ${入庫} WHERE "入庫ID" = $1`, [r.入庫ID]);
      消した++;
    }

    // ---- 5. CC_製造予定反映（新規・変更の分を入庫予定に入れる） ----
    const 入庫の項目 = await 項目一覧(c, "seizo", "TD_入庫");
    // 入庫ID は Access のオートナンバーと同じく使ったことのない番号にする（消した番号を出荷が指したままにならないように、出荷の入庫ID より大きくする）
    let 次の入庫ID =
      n((await c.query(`SELECT GREATEST((SELECT MAX("入庫ID") FROM ${入庫}), (SELECT MAX("入庫ID") FROM ${出荷}), $1::int) AS m`, [Math.max(0, ...消す.map((r) => n(r.入庫ID)))])).rows[0].m) + 1;
    const 反映 = (
      await c.query(
        `SELECT s.*, m."商品区分" AS "マスタ商品区分", m."規格kg" AS "マスタ規格kg" FROM ${新規生産計画} s LEFT JOIN ${商品マスタ} m ON m."商品コード" = s."商品コード"
         WHERE COALESCE(s."抽出区分", false) = true`,
      )
    ).rows as Rec[];
    const 一工場あり = new Set(
      (await c.query(`SELECT DISTINCT "商品コード", "製造日"::text AS d FROM ${新規生産計画} WHERE "作業場" = '1工場'`)).rows.map((r) => `${r.商品コード}#${r.d}`),
    );
    let 入れた = 0;
    for (const s of 反映) {
      const 区分 = (
        await c.query(`SELECT * FROM ${検査区分} WHERE "商品コード" = $1 AND "作業場" = $2 ORDER BY "商品コード", "区分No"`, [s.商品コード, s.作業場])
      ).rows as Rec[];
      // 新規生産計画にある項目だけ写る（分類ID は新規生産計画にないので、表の既定値の 0 のまま）
      const 元: Rec = {
        入庫日: s.入庫日, 倉庫ID: s.倉庫ID, 倉庫名: s.倉庫名, 商品コード: s.商品コード, 商品名: s.商品名, 規格: s.規格, 入数: s.入数,
        製造日: s.製造日, 賞味期限: s.賞味期限, 製造識別コード: s.製造識別コード, 製造ID: s.製造ID, 商品区分: s.マスタ商品区分, 作業場: s.作業場, 検体取得: true,
      };
      const ケースに = (kg: unknown) => (空(kg) || !n(s.入数) ? undefined : cint(n(kg) / n(s.入数)));
      const 入れる = async (v: Rec) => {
        for (const k of Object.keys(v)) if (v[k] === undefined) delete v[k];
        await 既定値で入れる(c, 入庫, 入庫の項目, { ...元, ...v, 入庫ID: 次の入庫ID++ }, 今.日時);
        入れた++;
      };
      if (!区分.length) {
        // 区分がないときのタグは Access ではエラーで入らない（空のまま）
        await 入れる({ 計画ケース: s.ケース, 計画kg: s.商品kg, ケース: s.ケース, 商品kg: s.商品kg });
        continue;
      }
      const 分割前 = n(s.商品kg);
      let 加算 = 0;
      for (let i = 0; i < 区分.length; i++) {
        const k = 区分[i];
        加算 += n(k.予想kg);
        const タグ = !一工場あり.has(`${s.商品コード}#${s.製造日}`) && s.作業場 === "2工場" ? k.区分記号2 : k.区分記号;
        const 最後 = i === 区分.length - 1;
        if (分割前 > 加算) {
          if (最後) {
            const kg = 分割前 - (加算 - n(k.予想kg));
            await 入れる({ タグ, 計画ケース: s.ケース, 計画kg: s.商品kg, 商品kg: kg, ケース: ケースに(kg) });
            break;
          }
          await 入れる({ タグ, 商品kg: k.予想kg, ケース: ケースに(k.予想kg) });
        } else {
          // 元の重量が分ける重量を下回ったら、残りを入れて終わり
          const kg = 分割前 - (加算 - n(k.予想kg));
          const 規格kg = n(s.マスタ規格kg);
          await 入れる({
            タグ, 計画ケース: s.ケース, 計画kg: s.商品kg, 商品kg: kg, ケース: ケースに(kg),
            計画枚数: !kg ? 0 : 規格kg && !空(s.商品kg) ? cint(n(s.商品kg) / 規格kg) : undefined,
          });
          break;
        }
      }
    }

    // ---- 6. C_生産計画変更案内作成 ----
    // Access は新規の行を、項目の「番号」で前回の表の項目名に入れている（並びが違うので、ずれて入る）。WorkStation の画面がこの表を見るので、そのとおりにする
    await c.query(`DELETE FROM ${変更案内}`);
    const 案内の項目 = new Map((await 項目一覧(c, "keikaku", "TD_生産計画変更案内")).map((f) => [f.name, f.type]));
    const 前回の項目 = (await 項目一覧(c, "keikaku", "TD_前回生産計画")).map((f) => f.name);
    const 案内に入れる = async (行: Rec, 項目: string[], ゼロ: boolean) => {
      const v: Rec = {};
      項目.forEach((名前, i) => {
        const 先 = 前回の項目[i];
        const 型 = 先 && 案内の項目.get(先);
        if (!型) return;
        const x = 型を合わせる(ゼロ && 空(行[名前]) ? 0 : 行[名前], 型);
        if (x !== undefined) v[先] = x;
      });
      v.更新時間 = 前回の変更日 ? 日付の文字(前回の変更日) : null;
      v.作成日 = 今.日時;
      const k = Object.keys(v);
      await c.query(`INSERT INTO ${変更案内} (${k.map((x) => `"${x}"`).join(", ")}) VALUES (${k.map((_, i) => `$${i + 1}`).join(", ")})`, k.map((x) => v[x]));
    };
    const 新規の名前 = 新規の項目.map((f) => f.name);
    for (const r of (await c.query(`SELECT * FROM ${新規生産計画} WHERE "通知" = '新規'`)).rows) await 案内に入れる(r, 新規の名前, false);
    for (const r of (await c.query(`SELECT * FROM ${前回生産計画} WHERE "通知" IS NOT NULL`)).rows) await 案内に入れる(r, 前回の項目, true);

    // ---- 7. 変更日を進める・ログ ----
    await c.query(`UPDATE ${変更日の表} SET "生産計画変更日" = $1`, [今回の変更日]);
    await c.query(`UPDATE ${新規生産計画} SET "抽出区分" = false WHERE "抽出区分" = true`);
    const 数 = async (通知: string) => n((await c.query(`SELECT COUNT("製造ID") AS n FROM ${新規生産計画} WHERE "通知" = $1`, [通知])).rows[0].n);
    const 件数 = { 新規: await 数("新規"), 製造変更: await 数("製造変更"), kg変更: await 数("kg変更"), 包装日変更: await 数("包装日変更") };
    const 出荷変更 = n((await c.query(`SELECT COUNT("出庫ID") AS n FROM ${出荷} WHERE "計画変更chk" = true`)).rows[0].n);
    const id = n((await c.query(`SELECT COALESCE(MAX("ID"), 0) + 1 AS n FROM ${変更ログ}`)).rows[0].n);
    // 合計件数：Access の式は包装日変更の件数を足していない（変数名の書き間違い）。そのとおりにする
    await c.query(
      `INSERT INTO ${変更ログ} ("ID", "製造変更日", "新規件数", "製造変更件数", "kg変更件数", "包装日変更件数", "合計件数", "出荷変更件数") VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [id, 今回の変更日 ?? "1899-12-30 00:00:00", 件数.新規, 件数.製造変更, 件数.kg変更, 件数.包装日変更, 件数.新規 + 件数.製造変更 + 件数.kg変更, 出荷変更],
    );
    return { ok: true, 件数, 出荷変更, 知らせ, 消した, 入れた, 取り込んだ: 写した.rowCount };
  });
}

export function keikakuRoutes(app: FastifyInstance) {
  app.addHook("preHandler", requireUser);

  // メニュー（FM_メインメニュー）：開いたときに、終了日をいちばん後の製造日にし、新しい計画変更があれば知らせる（C_生産計画変更確認）
  app.get("/api/keikaku/menu", async () => {
    const d = await 変更日(pool as unknown as PoolClient);
    const 新しい = !!d.今回 && (!d.前回 || d.前回 < d.今回);
    return { 前回: d.前回, 今回: d.今回, 終了日: d.最後の製造日, 新しい };
  });

  app.post<{ Body: { 開始日: string; 終了日: string } }>("/api/keikaku/import", async (req, reply) => {
    const { 開始日, 終了日 } = req.body ?? ({} as any);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(開始日 ?? "") || !/^\d{4}-\d{2}-\d{2}$/.test(終了日 ?? "")) return reply.code(400).send({ error: "開始日と終了日を入れてください" });
    try {
      return await 生産計画を取り込む(開始日, 終了日);
    } catch (e: any) {
      if (e?.statusCode === 400) return reply.code(400).send({ error: e.message });
      throw e;
    }
  });

  // 変更内容確認（F_製造変更案内）：上が新規の計画（追加・変更後）、下が前回の計画（変更前）
  app.get("/api/keikaku/henko", async () => {
    const 列 = (a: string) =>
      `${a}."通知", ${a}."製造ID", ${a}."製造日"::date::text AS "製造日", ${a}."入庫日"::date::text AS "入庫日", ${a}."作業場", ${a}."倉庫ID", ${a}."商品コード", ${a}."商品名",
       ${a}."規格", ${a}."入数", ${a}."ケース", ${a}."商品kg", ${a}."賞味期限"::date::text AS "賞味期限", ${a}."変更記録", g."商品名" AS "自社原料"`;
    const 新規 = await q(
      `SELECT ${列("s")} FROM ${新規生産計画} s LEFT JOIN ${商品マスタ} m ON m."商品コード" = s."商品コード"
       LEFT JOIN LATERAL (SELECT "商品名" FROM ${商品マスタ} x WHERE x."商品コード" = m."自社原料区分" LIMIT 1) g ON true
       WHERE s."通知" IS NOT NULL ORDER BY s."製造日", s."商品コード", s."作業場"`,
    );
    const 前回 = await q(
      `SELECT ${列("p")} FROM ${前回生産計画} p LEFT JOIN ${商品マスタ} m ON m."商品コード" = p."商品コード"
       LEFT JOIN LATERAL (SELECT "商品名" FROM ${商品マスタ} x WHERE x."商品コード" = m."自社原料区分" LIMIT 1) g ON true
       WHERE p."通知" IS NOT NULL ORDER BY p."製造日", p."商品コード", p."作業場"`,
    );
    return { 新規, 前回 };
  });

  // 変更履歴表示（R_計画変更ログ）。Access は TD_USER の更新時間より後に絞ろうとするが、その表がないため絞り込みは効かず、全部出る
  app.get("/api/keikaku/log", async () =>
    q(
      `SELECT "ID", "製造変更日"::text AS "製造変更日", to_char("製造変更日", 'YYYY/MM') AS "変更月", "新規件数", "製造変更件数", "kg変更件数", "包装日変更件数", "合計件数", "出荷変更件数"
       FROM ${変更ログ} ORDER BY "製造変更日"`,
    ),
  );

  // 製造カレンダー（FM_製造カレンダー）：大阪の計画を、工場（倉庫）ごとに月のカレンダーで見る
  app.get<{ Querystring: { from: string; to: string; soko: string } }>("/api/keikaku/calendar", async (req, reply) => {
    const { from, to } = req.query;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(from ?? "") || !/^\d{4}-\d{2}-\d{2}$/.test(to ?? "")) return reply.code(400).send({ error: "日付が正しくありません" });
    return q(
      `SELECT "製造ID", "商品名", "商品kg", "倉庫ID", "製造日"::date::text AS "製造日", "作業場" FROM ${大阪の計画}
       WHERE "倉庫ID" = $1 AND "製造日" BETWEEN $2::date AND $3::date ORDER BY "製造日", "倉庫ID", "作業場", "商品kg" DESC`,
      [n(req.query.soko) || 11, from, to],
    );
  });

  // 製造計画入力（FM_製造計画入力）：その日・その工場の大阪の計画
  app.get<{ Querystring: { date: string; soko: string } }>("/api/keikaku/day", async (req, reply) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(req.query.date ?? "")) return reply.code(400).send({ error: "日付が正しくありません" });
    return q(
      `SELECT "製造ID", "倉庫ID", "倉庫名", "作業場", "商品コード", "商品名", "原料コード", "原料", "規格", "入数", "ケース", "商品kg", "原料kg",
              "製造日"::date::text AS "製造日", "入庫日"::date::text AS "入庫日", "賞味期限"::date::text AS "賞味期限", "備考", "作成日"::text AS "作成日"
       FROM ${大阪の計画} WHERE "製造日" = $1::date AND "倉庫ID" = $2
       ORDER BY "倉庫ID", "作業場", "商品コード", "商品kg"`,
      [req.query.date, n(req.query.soko) || 11],
    );
  });

  // 製造計画入力の選ぶもの（倉庫・作業場は新規生産計画にあるもの、商品は分類のあるもの）
  app.get("/api/keikaku/day/opts", async () => ({
    倉庫: await q(`SELECT "倉庫ID" AS id, MAX("倉庫名") AS name FROM ${新規生産計画} WHERE "倉庫ID" IS NOT NULL AND "倉庫名" IS NOT NULL GROUP BY "倉庫ID" ORDER BY "倉庫ID"`),
    作業場: (await q(`SELECT DISTINCT "作業場" AS id FROM ${新規生産計画} WHERE "作業場" IS NOT NULL ORDER BY 1`)).map((r) => r.id),
    商品: await q(
      `SELECT m."商品コード" AS id, m."商品名" AS name FROM ${商品マスタ} m
       WHERE m."商品コード" IS NOT NULL AND COALESCE(m."分類ID", 0) <> 0 ORDER BY m."商品コード"`,
    ),
    原料: await q(`SELECT "商品コード" AS id, "商品名" AS name FROM ${商品マスタ} WHERE "商品コード" IS NOT NULL ORDER BY "商品コード"`),
    最初: (await q(`SELECT MIN("製造日")::date::text AS v FROM ${入庫}`))[0]?.v ?? null,
    最後: (await q(`SELECT MAX("製造日")::date::text AS v FROM ${入庫}`))[0]?.v ?? null,
  }));

  // 製造計画入力の 1 つの項目を直す（各項目の AfterUpdate と同じ）
  app.post<{ Body: { 製造ID: number; 項目: string; 値: unknown } }>("/api/keikaku/day/save", async (req, reply) => {
    const 項目 = req.body.項目;
    const 直せる = ["倉庫ID", "作業場", "商品コード", "商品名", "原料コード", "製造日", "入庫日", "ケース", "商品kg", "原料kg", "賞味期限", "備考"];
    if (!直せる.includes(項目)) return reply.code(400).send({ error: "この項目は直せません" });
    return 一連で(async (c) => {
      const r = (await c.query(`SELECT * FROM ${大阪の計画} WHERE "製造ID" = $1 FOR UPDATE`, [n(req.body.製造ID)])).rows[0];
      if (!r) return reply.code(404).send({ error: "この計画はありません" });
      let 値: any = req.body.値 === "" ? null : req.body.値;
      if (["倉庫ID", "商品コード", "原料コード", "ケース", "原料kg"].includes(項目) && 値 !== null) 値 = cint(Number(値));
      const v: Rec = { [項目]: 値 };
      const 新 = { ...r, ...v };
      const マスタ = async (code: unknown) => (await c.query(`SELECT "商品名", "規格", "入数" FROM ${商品マスタ} WHERE "商品コード" = $1 LIMIT 1`, [n(code)])).rows[0];
      const 製造日 = 新.製造日 ? 日付(新.製造日) : null;
      const 識別 = () => (製造日 ? `${日の番号(製造日)}#${数の文字(新.商品コード)}#${数の文字(新.倉庫ID)}#${新.作業場 ?? ""}` : null);
      if (項目 === "商品コード") {
        const m = await マスタ(値);
        Object.assign(v, { 商品名: m?.商品名 ?? null, 規格: m?.規格 ?? null, 入数: m?.入数 ?? null, 賞味期限: await 賞味期限計算(c, 製造日, 値) });
      } else if (項目 === "原料コード") {
        v.原料 = (await マスタ(値))?.商品名 ?? null;
      } else if (項目 === "ケース") {
        const m = await マスタ(新.商品コード);
        Object.assign(v, { 商品kg: m ? n(m.入数) * n(値) : null, 製造識別コード: 識別(), 作成日: 日本の今().日時 });
      } else if (項目 === "商品kg") {
        const m = await マスタ(新.商品コード);
        // Access は ケース（整数の項目）に 商品kg ÷ 入数 を入れる（端数は偶数への丸め）
        Object.assign(v, { ケース: m && n(m.入数) ? cint(n(値) / n(m.入数)) : null, 製造識別コード: 識別(), 作成日: 日本の今().日時 });
      } else if (項目 === "製造日") {
        v.賞味期限 = await 賞味期限計算(c, 製造日, 新.商品コード);
      }
      const k = Object.keys(v);
      await c.query(`UPDATE ${大阪の計画} SET ${k.map((x, i) => `"${x}" = $${i + 2}`).join(", ")} WHERE "製造ID" = $1`, [r.製造ID, ...k.map((x) => v[x])]);
      return { ok: true };
    });
  });

  // 新しい行（製造日は開いている日。工場は選んでいる工場）
  app.post<{ Body: { date: string; soko: number } }>("/api/keikaku/day/new", async (req, reply) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(req.body.date ?? "")) return reply.code(400).send({ error: "日付が正しくありません" });
    return 一連で(async (c) => {
      await c.query(`SELECT pg_advisory_xact_lock(hashtext('大阪丸北生産計画.製造ID'))`);
      const id = n((await c.query(`SELECT COALESCE(MAX("製造ID"), 0) + 1 AS m FROM ${大阪の計画}`)).rows[0].m);
      await c.query(
        `INSERT INTO ${大阪の計画} ("製造ID", "製造日", "倉庫ID", "ケース", "商品kg", "原料kg", "入数", "chk", "抽出区分", "ユーザーchk", "確認済みチェック", "冷凍原料手配区分")
         VALUES ($1, $2::date, $3, 0, 0, 0, 0, false, false, false, false, false)`,
        [id, req.body.date, n(req.body.soko) || 11],
      );
      return { 製造ID: id };
    });
  });

  app.post<{ Body: { 製造ID: number } }>("/api/keikaku/day/delete", async (req) => {
    await q(`DELETE FROM ${大阪の計画} WHERE "製造ID" = $1`, [n(req.body.製造ID)]);
    return { ok: true };
  });
}
