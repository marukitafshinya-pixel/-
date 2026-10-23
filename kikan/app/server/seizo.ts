import type { FastifyInstance } from "fastify";
import type { PoolClient } from "pg";
import { q, t, 日本の今 } from "./db.js";
import { requireUser } from "./auth.js";
import { cint } from "./hanmori.js";
import { 一覧のExcel } from "./excel.js";
import { 一連で, 賞味期限計算 } from "./ws.js";
import { 出荷に知らせる } from "./keikaku.js";

// 製造管理 丸北（Access の 製造管理 丸北.accdb）。製造の入庫（seizo.TD_入庫）に、包装・計量の結果を入れる。
// 包装日誌登録（FM_生産登録）・計量数登録（FM_出来高登録）・包装予定追加（FSD_生産予定入力）。
const 入庫 = t("seizo", "TD_入庫");
const 出荷 = t("ws", "TD_出荷");
const 商品マスタ = t("kyotsu", "TM_商品マスタ");
const 得意先マスタ = t("kyotsu", "TM_得意先マスタ");
const 新規生産計画 = t("kyoyu", "TD_新規生産計画");

type Rec = Record<string, any>;
const n = (v: unknown) => Number(v ?? 0) || 0;
const 空 = (v: unknown) => v === null || v === undefined || v === "";
const 日付 = (v: unknown) => (v ? String(v).slice(0, 10) : null);
const 通し番号 = (v: unknown) => (v ? Math.round((Date.parse(String(v).slice(0, 10) + "T00:00:00Z") - Date.UTC(1899, 11, 30)) / 86400000) : 0);
const 日を足す = (v: string, k: number) => new Date(Date.parse(v.slice(0, 10) + "T00:00:00Z") + k * 86400000).toISOString().slice(0, 10);
/** VBA の Fix（0 の方へ切り捨て） */
const fix = (v: number) => (v < 0 ? Math.ceil(v) : Math.floor(v));
/** 数を文字の項目に入れるとき（Access と同じく 15 けた） */
const 数の文字 = (v: number) => (Number.isFinite(v) ? String(Number(v.toPrecision(15))) : null);
const 丸数字 = ["", "①", "②", "③", "④", "⑤", "⑥", "⑦", "⑧"];

async function マスタ(c: PoolClient, 商品コード: unknown): Promise<Rec> {
  return (await c.query(`SELECT * FROM ${商品マスタ} WHERE "商品コード" = $1 LIMIT 1`, [n(商品コード)])).rows[0] ?? {};
}
async function 短縮名(c: PoolClient, code: unknown) {
  return (await c.query(`SELECT "短縮名" FROM ${得意先マスタ} WHERE "短縮コード" = $1 LIMIT 1`, [n(code)])).rows[0]?.短縮名 ?? null;
}
async function 入庫の行(c: PoolClient, 入庫ID: number): Promise<Rec | undefined> {
  return (await c.query(`SELECT * FROM ${入庫} WHERE "入庫ID" = $1 FOR UPDATE`, [入庫ID])).rows[0];
}
async function 入庫を直す(c: PoolClient, 入庫ID: number, v: Rec) {
  const k = Object.keys(v);
  if (!k.length) return;
  await c.query(`UPDATE ${入庫} SET ${k.map((x, i) => `"${x}" = $${i + 2}`).join(", ")} WHERE "入庫ID" = $1`, [入庫ID, ...k.map((x) => v[x])]);
}
/** 入庫ID は Access のオートナンバーと同じく、使ったことのない番号（出荷が指している番号より大きく） */
async function 次の入庫ID(c: PoolClient) {
  await c.query(`SELECT pg_advisory_xact_lock(hashtext('TD_入庫.入庫ID'))`);
  return n((await c.query(`SELECT GREATEST((SELECT MAX("入庫ID") FROM ${入庫}), (SELECT MAX("入庫ID") FROM ${出荷})) AS m`)).rows[0].m) + 1;
}
/** 新しい入庫の行（Access の表の既定値：数は 0、はい／いいえ は いいえ、登録時間は今） */
async function 入庫を足す(c: PoolClient, v: Rec) {
  const 項目 = (
    await c.query(`SELECT column_name AS name, data_type AS type FROM information_schema.columns WHERE table_schema = 'seizo' AND table_name = 'TD_入庫'`)
  ).rows as { name: string; type: string }[];
  const all: Rec = {};
  for (const f of 項目) {
    if (f.type === "boolean") all[f.name] = false;
    else if (["integer", "double precision", "smallint", "bigint", "numeric", "real"].includes(f.type)) all[f.name] = 0;
  }
  all.登録時間 = 日本の今().日時;
  Object.assign(all, v, { 入庫ID: await 次の入庫ID(c) });
  const k = Object.keys(all).filter((x) => 項目.some((f) => f.name === x));
  await c.query(`INSERT INTO ${入庫} (${k.map((x) => `"${x}"`).join(", ")}) VALUES (${k.map((_, i) => `$${i + 1}`).join(", ")})`, k.map((x) => all[x]));
  return all.入庫ID as number;
}

/**
 * 生産計画の変更を出荷に知らせる（Access の PlanChange。入庫の行について：Tfg 2＝出荷停止、3＝包装完了、4＝数量訂正）。
 * 出荷の認識ID（倉庫ID＋商品コード＋製造日＋入庫日＋入庫ID）が同じで、まだ積み込んでいない出荷に印を付ける。
 * Access は出荷の在庫ID・認識ID に入庫ID を入れていたが、在庫ID は在庫の番号なので、関係のない在庫から引かれないよう在庫ID はそのままにし、
 * 認識ID は次の変更でも見つかるように同じ印のままにする（データを壊さないための直し）。知らせた件数を返す。
 */
async function 計画の変更を知らせる(c: PoolClient, 入庫ID: number, 種類: 2 | 3 | 4, 元?: Rec): Promise<number> {
  const r = (await c.query(`SELECT * FROM ${入庫} WHERE "入庫ID" = $1`, [入庫ID])).rows[0];
  if (!r) return 0;
  // Access は項目を直した直後（保存の前）に表から読むので、印は直す前の値で作る
  const o = 元 ?? r;
  const 印 = `${n(o.倉庫ID)}${n(o.商品コード)}${通し番号(o.製造日)}${通し番号(o.入庫日)}${n(o.入庫ID)}`;
  const 知らせ = 種類 === 2 ? ["変更!", "出荷停止!"] : 種類 === 3 ? ["未包装", "包装完了"] : ["訂正", "数量訂正"];
  const u = await c.query(
    `UPDATE ${出荷} SET "製造日" = $2, "包装日" = $3, "入庫日" = $3, "入庫ID" = $4, "通知" = $5, "計画変更chk" = true, "変更通知" = $6
     WHERE "認識ID" = $1 AND COALESCE("chk", false) = false`,
    [印, r.製造日, r.入庫日, r.入庫ID, 知らせ[0], 知らせ[1]],
  );
  return u.rowCount ?? 0;
}
const 計画変更の知らせ = (件数: number) => (件数 > 0 ? [`変更により、出荷計画に${件数} 件の変更通知を送ります。`] : []);

/** 登録（ユーザーchk の付いた入庫を、出荷に「出来高変更」または「出荷停止」として知らせ、印を外す） */
async function 変更を出荷に知らせる(c: PoolClient) {
  let 件数 = 0;
  for (const r of (await c.query(`SELECT "入庫ID", "商品区分" FROM ${入庫} WHERE "ユーザーchk" = true ORDER BY "入庫ID"`)).rows) {
    件数 += await 出荷に知らせる(c, r.入庫ID, n(r.商品区分) === 5 ? "出荷停止" : "出来高変更");
    await c.query(`UPDATE ${入庫} SET "ユーザーchk" = false WHERE "入庫ID" = $1`, [r.入庫ID]);
  }
  return 件数;
}

/** 箱詰枚数を直したとき（包装日誌・計量数で同じ） */
async function 箱詰めから(m: Rec, r: Rec): Promise<Rec> {
  const 規格kg = n(m.規格kg) || 1;
  const 規格枚数 = n(m.規格枚数) || 1;
  const 箱詰 = n(r.商品kg) / 規格kg;
  const ケース = fix(n(r.計量元数) / 規格枚数);
  return { 箱詰枚数: 数の文字(箱詰), 仕掛枚数: cint(n(r.計量元数) - 箱詰), ケース, 商品kg: n(r.入数) * ケース };
}

/** 商品を選んだとき（CS_区分登録・cmb_商品コード_AfterUpdate） */
async function 商品の値(c: PoolClient, 商品コード: unknown, 製造日: unknown) {
  const m = await マスタ(c, 商品コード);
  return {
    商品名: m.商品名 ?? null, 規格: m.規格 ?? null, 入数: m.入数 ?? null, 段ボールID: m.資材ダンボールID ?? null,
    賞味期限: await 賞味期限計算(c, 日付(製造日), 商品コード), 商品区分: m.商品区分 ?? null,
  };
}

/**
 * 最終区分の自動計算（Access の C_最終区分自動計算）：計画のケース（元数）と出来高の合計が合うように、いちばん後の区分のケースを直す。
 * 2026/03/25 に「区分の半端を合わせる」決まりは Access でも外されている。
 */
async function 最終区分を合わせる(c: PoolClient, 商品コード: number, 製造日: string, 元ケース: number, 作業場: string | null) {
  const 条件 = `"作業場" = $1 AND "倉庫ID" = 11 AND "商品コード" = $2 AND "製造日" = $3::date`;
  const 引数 = [作業場, 商品コード, 製造日];
  const rows = (await c.query(`SELECT * FROM ${入庫} WHERE ${条件} AND "検体区分" = false AND "chk" = false ORDER BY "入庫ID"`, 引数)).rows;
  if (rows.length <= 1 || 空(rows[0].タグ)) return;
  const 最大 = (await c.query(`SELECT MAX("タグ") AS v FROM ${入庫} WHERE ${条件}`, 引数)).rows[0]?.v;
  for (const r of rows) {
    if (r.タグ !== 最大) continue;
    const 未入力 = n((await c.query(`SELECT COUNT("出来高入力chk") AS v FROM ${入庫} WHERE ${条件} AND "出来高入力chk" = false AND "検体区分" = false`, 引数)).rows[0].v);
    if (未入力 <= 1) continue;
    const m = await マスタ(c, r.商品コード);
    const 出来高 = n((await c.query(`SELECT SUM("ケース") AS v FROM ${入庫} WHERE ${条件}`, 引数)).rows[0].v);
    if (元ケース === 出来高) continue;
    const ケース = n(r.ケース) + (元ケース - 出来高);
    const 箱詰 = ケース * n(m.規格枚数);
    await 入庫を直す(c, r.入庫ID, {
      ケース, 商品kg: ケース * n(m.入数), 箱詰枚数: 数の文字(箱詰), 計量元数: 箱詰 + n(m.規格枚数), ...(ケース !== n(r.ケース) ? { ユーザーchk: true } : {}),
    });
  }
}

/** 一覧の項目（日付は日付だけにする） */
const 一覧の項目 = `i.*, i."入庫日"::date::text AS "入庫日", i."製造日"::date::text AS "製造日", i."賞味期限"::date::text AS "賞味期限"`;

export function seizoRoutes(app: FastifyInstance) {
  app.addHook("preHandler", requireUser);

  // 選択肢（工場・商品区分・産地・商品状態）
  app.get("/api/seizo/opts", async () => ({
    商品区分: await q(`SELECT "区分ID" AS id, "区分名" AS name FROM ${t("seizo_fe", "TM_商品区分")} ORDER BY "区分ID"`),
    産地: await q(`SELECT "産地コード" AS id, "通称" AS name FROM ${t("seizo_fe", "TM_産地マスタ")} ORDER BY "産地コード"`),
    商品状態: await q(`SELECT "隠語" AS id, "状態" AS name FROM ${t("seizo_fe", "TM_商品状態マスタ")} ORDER BY "隠語"`),
  }));

  // ================= 包装日誌登録（FM_生産登録）：包装日（入庫日）と工場で絞った入庫 =================
  app.get<{ Querystring: { date: string; soko: string } }>("/api/seizo/hoso", async (req) =>
    q(
      `SELECT ${一覧の項目} FROM ${入庫} i WHERE i."倉庫ID" = $1 AND i."入庫日" = $2::date ORDER BY i."商品コード", i."製造日", i."タグ", i."検査区分", i."入庫ID"`,
      [n(req.query.soko) || 11, req.query.date],
    ),
  );

  // 1 つの項目を直す。Access の各項目の AfterUpdate と同じ計算をする
  app.post<{ Body: { 入庫ID: number; 項目: string; 値: unknown; 画面: "hoso" | "dekidaka" | "yotei"; 製造日?: string; 入庫日?: string; 計画元数?: number; 作業場?: string; 工場?: number } }>(
    "/api/seizo/save",
    async (req, reply) => {
      const { 項目, 画面 } = req.body;
      const 直せる = [
        "商品コード", "ケース", "タグ", "計量元数", "開始No", "終了No", "商品kg", "製造日", "箱詰枚数", "数量確定フラグ", "原料コード", "産地コード", "商品状態隠語",
        "商品区分", "段ボールID", "備考", "管理備考", "規格", "入数", "賞味期限", "検査区分", "検体区分", "作業場", "カードカラーコード", "倉庫ID", "入庫日", "出荷止め",
        "印刷時非表示", "検査予定日", "製造表記", "未包装kg", "未包装枚数",
      ];
      if (!直せる.includes(項目)) return reply.code(400).send({ error: "この項目は直せません" });
      return 一連で(async (c) => {
        const r = await 入庫の行(c, n(req.body.入庫ID));
        if (!r) return reply.code(404).send({ error: "この行はありません" });
        const 値 = req.body.値 === "" ? null : req.body.値;
        const v: Rec = { [項目]: 値 };
        const 知らせ: string[] = [];
        const 新 = { ...r, ...v };
        const m = await マスタ(c, 新.商品コード);
        const 規格kg = n(m.規格kg) || 1;
        const 規格枚数 = n(m.規格枚数) || 1;
        let 計画変更 = false;
        if (項目 === "タグ") v.タグ = 丸数字[n(値)] && /^[1-5]$/.test(String(値)) ? 丸数字[n(値)] : 値;
        if (項目 === "終了No") v.検査区分 = `${r.開始No ?? ""}-${値 ?? ""}`;
        if (項目 === "製造日") v.賞味期限 = await 賞味期限計算(c, 日付(値), 新.商品コード);
        if (項目 === "原料コード") v.原料 = (await マスタ(c, 値)).商品名 ?? null;
        if (項目 === "商品kg" && n(r.商品kg) !== 0 && n(r.商品kg) !== n(値)) 計画変更 = true;

        if (画面 === "hoso") {
          // 包装日誌登録（FM_生産登録）
          if (項目 === "商品コード") Object.assign(v, await 商品の値(c, 値, r.製造日), { 原料: (await マスタ(c, m.主用原料コード)).短縮名 ?? null });
          if (項目 === "ケース") {
            v.商品kg = n(r.入数) * n(値);
            const 箱詰 = v.商品kg / 規格kg;
            v.箱詰枚数 = 数の文字(箱詰);
            if (n(r.ケース) !== n(値)) Object.assign(v, { 仕掛枚数: cint(n(r.計量元数) - 箱詰), ユーザーchk: true });
          }
          if (項目 === "計量元数") {
            v.ケース = fix(n(値) / 規格枚数);
            v.商品kg = n(r.入数) * v.ケース;
            const 箱詰 = v.商品kg / 規格kg;
            Object.assign(v, { 箱詰枚数: 数の文字(箱詰), 仕掛枚数: cint(n(値) - 箱詰) });
            計画変更 = true;
          }
          if (項目 === "箱詰枚数") Object.assign(v, await 箱詰めから(m, 新));
        }
        if (画面 === "dekidaka") {
          // 計量数登録（FM_出来高登録）
          const 区分登録 = async () => Object.assign(v, { 商品コード: 新.商品コード }, await 商品の値(c, 新.商品コード, v.製造日 ?? 新.製造日), { 数量確定フラグ: 1 });
          if (項目 === "計量元数") {
            const 旧ケース = n(r.ケース);
            const ケース = fix(n(値) / 規格枚数) + n(r.箱詰め数合わせ);
            const 箱詰 = ケース * 規格枚数;
            const 再生 = n(値) - 箱詰;
            Object.assign(v, {
              倉庫名: await 短縮名(c, req.body.工場 ?? r.倉庫ID), ケース, 箱詰枚数: 数の文字(箱詰), 検体枚数: 0, 再生枚数: 再生, 入数: n(m.入数),
              商品kg: n(m.入数) * ケース, 仕掛枚数: 再生, 製造日: req.body.製造日 ?? r.製造日,
            });
            if (!r.検体区分 && req.body.入庫日) v.入庫日 = req.body.入庫日;
            await 区分登録();
            if (旧ケース !== ケース) v.ユーザーchk = true;
          }
          if (項目 === "ケース") {
            v.商品kg = n(r.入数) * n(値);
            const 箱詰 = v.商品kg / 規格kg;
            Object.assign(v, { 箱詰枚数: 数の文字(箱詰), 仕掛枚数: cint(n(r.計量元数) - 箱詰) });
            if (n(r.ケース) !== 0 && n(r.ケース) !== n(値)) 計画変更 = true;
          }
          if (項目 === "タグ" || 項目 === "終了No") await 区分登録();
          if (項目 === "商品区分" && n(r.商品区分) !== n(値)) v.ユーザーchk = true;
          if (項目 === "箱詰枚数") Object.assign(v, await 箱詰めから(m, 新));
        }
        if (画面 === "yotei") {
          // 包装予定追加（FSD_生産予定入力）
          const 包装日を決める = async (x: Rec) => {
            const 製 = 日付(x.製造日);
            if (!製) return;
            const 土曜 = new Date(製 + "T00:00:00Z").getUTCDay() === 6;
            x.入庫日 = 日を足す(製, 土曜 ? (n(x.倉庫ID) === 191 ? 1 : 2) : 1);
            if (n(x.商品コード)) x.賞味期限 = await 賞味期限計算(c, 製, x.商品コード);
          };
          const 出荷元から = async (x: Rec) => {
            x.倉庫名 = n(x.倉庫ID) === 1 ? `${(await マスタ(c, x.商品コード)).現場ID ?? ""}工場` : await 短縮名(c, x.倉庫ID);
            await 包装日を決める(x);
          };
          if (項目 === "商品コード") {
            const x: Rec = { ...r, 商品コード: 値 };
            const mm = await マスタ(c, 値);
            Object.assign(x, { 商品名: mm.商品名 ?? null, 分類ID: mm.分類ID ?? null, 規格: mm.規格 ?? null, 入数: mm.入数 ?? null, 製造日: req.body.製造日 ?? r.製造日 });
            if (!x.賞味期限) x.賞味期限 = await 賞味期限計算(c, 日付(x.製造日), 値);
            Object.assign(x, { 段ボールID: mm.資材ダンボールID ?? null, 商品区分: mm.商品区分 ?? null });
            await 出荷元から(x);
            for (const k of ["商品名", "分類ID", "規格", "入数", "製造日", "賞味期限", "段ボールID", "商品区分", "倉庫名", "入庫日"]) v[k] = x[k];
          }
          if (項目 === "倉庫ID") {
            const x: Rec = { ...新 };
            await 出荷元から(x);
            Object.assign(v, { 倉庫名: x.倉庫名, 入庫日: x.入庫日, 賞味期限: x.賞味期限 });
          }
          if (項目 === "原料コード") {
            const x: Rec = { ...新 };
            await 包装日を決める(x);
            Object.assign(v, { 入庫日: x.入庫日, 賞味期限: x.賞味期限 });
          }
          if (項目 === "入庫日") 計画変更 = true;
          if (項目 === "ケース") {
            v.商品kg = n(値) * n(m.入数);
            v.製造識別コード = `${通し番号(新.製造日)}#${新.商品コード ?? ""}#${新.倉庫ID ?? ""}#${新.作業場 ?? ""}`;
          }
          if (項目 === "商品kg") {
            const ケース = Math.floor(n(値) / (n(r.入数) || 1));
            Object.assign(v, { ケース, 商品kg: ケース * n(r.入数), 箱詰枚数: 数の文字((ケース * n(r.入数)) / 規格枚数) });
            v.製造識別コード = `${通し番号(新.製造日)}#${新.商品コード ?? ""}#${新.倉庫ID ?? ""}#${新.作業場 ?? ""}`;
          }
        }
        await 入庫を直す(c, r.入庫ID, v);
        if (画面 === "yotei" && 項目 === "ケース" && n(r.ケース) !== 0 && n(r.ケース) !== n(値)) await 出荷に知らせる(c, r.入庫ID, "数量変更");
        if (画面 === "dekidaka" && 項目 === "計量元数" && n(req.body.計画元数) !== 0)
          await 最終区分を合わせる(c, n(新.商品コード), 日付(v.製造日 ?? r.製造日)!, n(req.body.計画元数), req.body.作業場 ?? r.作業場);
        if (計画変更) 知らせ.push(...計画変更の知らせ(await 計画の変更を知らせる(c, r.入庫ID, 4, r)));
        return { ok: true, 知らせ };
      });
    },
  );

  // 未包装として登録（未包装kg：ItemPt、未包装枚数：C_未包装登録）。別の行（前回未包装分）を作る・直す
  app.post<{ Body: { 入庫ID: number; 項目: "未包装kg" | "未包装枚数"; 値: number } }>("/api/seizo/mihoso", async (req, reply) =>
    一連で(async (c) => {
      const r = await 入庫の行(c, n(req.body.入庫ID));
      if (!r) return reply.code(404).send({ error: "この行はありません" });
      if (r.chk) return { ok: true }; // 登録済み（在庫になった）ものは何もしない
      const 枚数 = req.body.項目 === "未包装枚数";
      await 入庫を直す(c, r.入庫ID, { [req.body.項目]: n(req.body.値) });
      if (枚数 && !n(req.body.値) && !(await c.query(`SELECT 1 FROM ${入庫} WHERE "未包装時ID" = $1`, [r.入庫ID])).rowCount) return { ok: true };
      const m = await マスタ(c, r.商品コード);
      const 規格枚数 = n(m.規格枚数) || 1;
      const 規格kg = n(m.規格kg) || 1;
      const 数 = (): Rec => {
        if (!枚数) return { ケース: cint(n(req.body.値) / (n(r.入数) || 1)), 商品kg: n(req.body.値) };
        const ケース = fix(n(req.body.値) / 規格枚数);
        const kg = n(r.入数) * ケース;
        const 箱詰 = kg / 規格kg;
        return { 計量元数: n(req.body.値), ケース, 商品kg: kg, 箱詰枚数: 数の文字(箱詰), 仕掛枚数: cint(n(req.body.値) - 箱詰) };
      };
      const 前回 = (await c.query(`SELECT "入庫ID" FROM ${入庫} WHERE "未包装時ID" = $1 ORDER BY "入庫ID" LIMIT 1`, [r.入庫ID])).rows[0];
      if (前回) await 入庫を直す(c, 前回.入庫ID, 数());
      else
        await 入庫を足す(c, {
          商品コード: r.商品コード, 商品名: r.商品名, 規格: r.規格, 入数: r.入数, ...数(), 製造日: r.製造日, 賞味期限: await 賞味期限計算(c, 日付(r.製造日), r.商品コード),
          倉庫ID: r.倉庫ID, 倉庫名: await 短縮名(c, r.倉庫ID), 備考: "前回未包装分", 未包装時ID: r.入庫ID, 未包装区分: true, 出荷止め: r.出荷止め, 管理備考: r.管理備考,
          検査区分: r.検査区分, タグ: r.タグ, ...(枚数 ? { 作業場: r.作業場 } : {}),
        });
      return { ok: true };
    }),
  );

  // 未包装の一覧（FSD_未包装更新）と、選んだものをこの包装日にする（ItemVis）
  app.get("/api/seizo/mihoso", async () =>
    q(`SELECT ${一覧の項目} FROM ${入庫} i WHERE i."未包装区分" = true ORDER BY i."商品コード", i."製造日", i."入庫ID"`),
  );
  app.post<{ Body: { ids: number[]; 入庫日: string } }>("/api/seizo/mihoso/set", async (req) =>
    一連で(async (c) => {
      let 件数 = 0;
      for (const id of req.body.ids ?? []) {
        件数 += await 計画の変更を知らせる(c, n(id), 3);
        await 入庫を直す(c, n(id), { 入庫日: req.body.入庫日, 未包装区分: false });
      }
      return { ok: true, 件数 };
    }),
  );

  // 登録（cmd_登録・計量数登録を閉じるとき）：ユーザーchk の付いた入庫を出荷に知らせる
  app.post("/api/seizo/touroku", async () => 一連で(async (c) => ({ 件数: await 変更を出荷に知らせる(c) })));
  // 閉じてよいか（包装日誌登録：登録していない変更が残っていれば閉じられない）
  app.get("/api/seizo/miteiroku", async () => ({ 件数: n((await q(`SELECT COUNT(*) AS n FROM ${入庫} WHERE "ユーザーchk" = true`))[0].n) }));

  // 検査日報（C_検査日報：その製造日の非加熱商品の検査リスト）。Access は閉じるときに OneDrive に Excel を作るが、Web 版は［検査日報］で Excel をダウンロードする
  app.get<{ Querystring: { date: string } }>("/api/seizo/kensa-nippo", async (req, reply) => {
    const rows = await q(
      `SELECT "商品コード", "製造表記", "商品名", "賞味期限"::date AS "賞味期限", "ケース", "商品kg", "検査区分", '' AS "検査予定日"
       FROM ${入庫} WHERE "製造日" = $1::date AND "製造日" >= ($2::date - 3) AND "倉庫ID" = 11 AND "分類ID" = 0
       ORDER BY "賞味期限", "商品コード"`,
      [req.query.date, 日本の今().日付],
    );
    if (!rows.length) return reply.code(404).send({ error: "この製造日の検査リストはありません（製造日が 3 日より前のもの・非加熱商品でないものは出ません）" });
    const 列 = [
      { key: "商品コード", width: 8 }, { key: "製造表記", width: 10 }, { key: "商品名", width: 30 }, { key: "賞味期限", width: 12, date: true },
      { key: "ケース", width: 8 }, { key: "商品kg", width: 10 }, { key: "検査区分", width: 10 }, { key: "検査予定日", width: 12 },
    ];
    const d = String(req.query.date);
    const 名前 = `${Number(d.slice(5, 7))}月${Number(d.slice(8, 10))}日検査日報.xlsx`;
    const buf = await 一覧のExcel("検査結果待ちリスト", 列, rows);
    reply
      .header("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
      .header("Content-Disposition", `attachment; filename*=UTF-8''${encodeURIComponent(名前)}`);
    return reply.send(buf);
  });

  // ================= 計量数登録（FM_出来高登録）：製造日・工場・商品・作業場で絞る =================
  // 商品の選択肢：その製造日に作る商品（作業場ごと。包装日はいちばん早い日）
  app.get<{ Querystring: { seizo: string; soko: string } }>("/api/seizo/dekidaka/shohin", async (req) =>
    q(
      `SELECT "商品コード", "商品名", "製造日"::date::text AS "製造日", "倉庫ID", MIN("入庫日")::date::text AS "入庫日", "作業場"
       FROM ${入庫} GROUP BY "商品コード", "商品名", "製造日", "倉庫ID", "作業場"
       HAVING "製造日" = $1::date AND "倉庫ID" = $2 ORDER BY "商品コード", "作業場"`,
      [req.query.seizo, n(req.query.soko) || 11],
    ),
  );
  app.get<{ Querystring: { seizo: string; soko: string; shohin: string; sagyo: string; menu: string } }>("/api/seizo/dekidaka", async (req) => {
    const 作業場 = req.query.sagyo ?? "";
    const rows = await q(
      `SELECT ${一覧の項目}, m."規格枚数" FROM ${入庫} i LEFT JOIN ${商品マスタ} m ON m."商品コード" = i."商品コード"
       WHERE i."倉庫ID" = $1 AND i."商品コード" = $2 AND i."製造日" = $3::date AND i."作業場" = $4
       ORDER BY i."入庫日", i."商品コード", i."製造日", i."タグ", i."検体区分", i."検査区分", i."管理備考", i."入庫ID"`,
      [n(req.query.soko) || 11, n(req.query.shohin), req.query.seizo, 作業場],
    );
    // 計画元数：新しい生産計画のケース（丸北北海道・メニューの製造日）
    const 計画 = await q(
      `SELECT "ケース" FROM ${新規生産計画} WHERE "作業場" = $1 AND "倉庫ID" = 11 AND "商品コード" = $2 AND "製造日" = $3::date LIMIT 1`,
      [作業場, n(req.query.shohin), req.query.menu || req.query.seizo],
    );
    return { rows, 計画元数: 計画[0]?.ケース ?? null };
  });
  // 計画元数を直す（TD_新規生産計画 のケースに入れる。Access と同じく作業場は見ない）
  app.post<{ Body: { 商品コード: number; 製造日: string; 値: number } }>("/api/seizo/dekidaka/keikaku", async (req) =>
    一連で(async (c) => {
      await c.query(`UPDATE ${新規生産計画} SET "ケース" = $3 WHERE "倉庫ID" = 11 AND "商品コード" = $1 AND "製造日" = $2::date`, [
        n(req.body.商品コード), req.body.製造日, cint(n(req.body.値)),
      ]);
      return { ok: true };
    }),
  );
  // 区分の追加（cmd_区分の追加）：同じ商品・製造日・包装日に区分を 1 つ足し、タグを①②…と付ける。検体の行のタグも合わせる
  app.post<{ Body: { 商品コード: number; 製造日: string; 入庫日: string; 作業場: string; 工場: number } }>("/api/seizo/dekidaka/kubun-add", async (req) =>
    一連で(async (c) => {
      const { 商品コード, 製造日, 入庫日, 作業場 } = req.body;
      const 工場 = n(req.body.工場) || 11;
      const 条件 = `"製造日" = $1::date AND "倉庫ID" = $2 AND "商品コード" = $3`;
      const 引数 = [製造日, 工場, n(商品コード)];
      let 数 = n((await c.query(`SELECT COUNT("商品コード") AS v FROM ${入庫} WHERE "入庫日" = $4::date AND ${条件}`, [...引数, 入庫日])).rows[0].v);
      if (数 === 1) await c.query(`UPDATE ${入庫} SET "タグ" = '①' WHERE "入庫ID" = (SELECT "入庫ID" FROM ${入庫} WHERE "入庫日" = $4::date AND ${条件} ORDER BY "入庫ID" LIMIT 1)`, [...引数, 入庫日]);
      const 製造ID = (await c.query(`SELECT MAX("製造ID") AS v FROM ${入庫} WHERE ${条件}`, 引数)).rows[0]?.v ?? null;
      const m = await マスタ(c, 商品コード);
      数 += 1;
      await 入庫を足す(c, {
        製造ID, 倉庫ID: 工場, 倉庫名: await 短縮名(c, 工場), 入庫日, 製造日, 賞味期限: await 賞味期限計算(c, 製造日, 商品コード), 商品コード: n(商品コード),
        分類ID: m.分類ID ?? null, 商品名: m.商品名 ?? null, 規格: m.規格 ?? null, 入数: m.入数 ?? null, 作業場,
        製造識別コード: `${通し番号(製造日)}#${n(商品コード)}#${工場}#${作業場 ?? ""}`, タグ: 丸数字[数] ?? null,
      });
      await c.query(`UPDATE ${入庫} SET "タグ" = $4 WHERE "入庫ID" = (SELECT "入庫ID" FROM ${入庫} WHERE "検体区分" = true AND ${条件} ORDER BY "入庫ID" LIMIT 1)`, [
        ...引数, 丸数字[数] ?? null,
      ]);
      return { ok: true };
    }),
  );
  // 区分の削除（cmd_区分の削除）：いちばん後の区分（検体を除いた数の丸数字）を消し、出荷に「区分削除」を知らせる
  app.post<{ Body: { 商品コード: number; 製造日: string; 入庫日: string; 工場: number; 確認?: boolean } }>("/api/seizo/dekidaka/kubun-del", async (req) =>
    一連で(async (c) => {
      const { 商品コード, 製造日, 入庫日 } = req.body;
      const 工場 = n(req.body.工場) || 11;
      const 条件 = `"製造日" = $1::date AND "倉庫ID" = $2 AND "商品コード" = $3 AND "入庫日" = $4::date`;
      const 引数 = [製造日, 工場, n(商品コード), 入庫日];
      const 数 = n((await c.query(`SELECT COUNT("商品コード") AS v FROM ${入庫} WHERE "検体区分" = false AND ${条件}`, 引数)).rows[0].v);
      const タグ = 丸数字[数] ?? "";
      const r = (await c.query(`SELECT "入庫ID", "タグ" FROM ${入庫} WHERE COALESCE("タグ", '') = $5 AND ${条件} ORDER BY "入庫ID" LIMIT 1`, [...引数, タグ])).rows[0];
      if (!r) return { ok: false, タグ: null };
      if (!req.body.確認) return { ok: false, タグ: r.タグ ?? "" };
      const 件数 = await 出荷に知らせる(c, r.入庫ID, "区分削除");
      await c.query(`DELETE FROM ${入庫} WHERE "入庫ID" = $1`, [r.入庫ID]);
      return { ok: true, 知らせ: 件数 > 0 ? [`変更により、出荷計画に${件数} 件の変更通知を送ります。`] : [] };
    }),
  );

  // ================= 包装予定追加（FSD_生産予定入力）：製造日で絞った入庫 =================
  app.get<{ Querystring: { date: string } }>("/api/seizo/yotei", async (req) =>
    q(
      `SELECT ${一覧の項目}, m."ダンボールID" AS "マスタダンボールID" FROM ${入庫} i LEFT JOIN ${商品マスタ} m ON m."商品コード" = i."商品コード"
       WHERE i."製造日" = $1::date ORDER BY i."倉庫ID", m."分類ID", i."商品コード", i."タグ", i."検体区分", i."入庫ID"`,
      [req.query.date],
    ),
  );
  app.post<{ Body: { 製造日: string } }>("/api/seizo/yotei/new", async (req) =>
    一連で(async (c) => ({ 入庫ID: await 入庫を足す(c, { 製造日: req.body.製造日 }) })),
  );
  app.post<{ Body: { 入庫ID: number } }>("/api/seizo/yotei/delete", async (req) =>
    一連で(async (c) => {
      await 出荷に知らせる(c, n(req.body.入庫ID), "削除");
      await c.query(`DELETE FROM ${入庫} WHERE "入庫ID" = $1`, [n(req.body.入庫ID)]);
      return { ok: true };
    }),
  );
  // 出荷止め（出荷止め_Click）：印を付けて出荷に「出荷停止!」を知らせる
  app.post<{ Body: { 入庫ID: number } }>("/api/seizo/yotei/tome", async (req) =>
    一連で(async (c) => {
      await 入庫を直す(c, n(req.body.入庫ID), { 出荷止め: true });
      return { ok: true, 知らせ: 計画変更の知らせ(await 計画の変更を知らせる(c, n(req.body.入庫ID), 2)) };
    }),
  );
}
