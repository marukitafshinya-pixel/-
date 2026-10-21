import type { FastifyInstance } from "fastify";
import type { PoolClient } from "pg";
import { pool, t } from "./db.js";
import { requireUser } from "./auth.js";
import { cint } from "./hanmori.js";
import { 一連で, 出荷の既定値, 賞味期限計算 } from "./ws.js";

// 丸北WorkStation の在庫の割り当て（Access の M_架空在庫集計・M_読込新・FSD_希望在庫表示）
const 輸送計画 = t("ws", "TD_輸送計画");
const 出荷 = t("ws", "TD_出荷");
const 在庫 = t("ws", "TD_在庫");
const 入庫 = t("seizo", "TD_入庫"); // WorkStation がつないでいる TD_入庫 は製造管理のもの（生産計画・出来高）
const 得意先マスタ = t("kyotsu", "TM_得意先マスタ");
const 商品マスタ = t("kyotsu", "TM_商品マスタ");
const 商品区分 = t("ws_fe", "TM_商品区分");
const 出荷場所条件 = t("ws_fe", "TM_出荷場所条件");
const 本社依頼受注 = t("ws_fe", "TM_本社依頼受注");
const ストックマスタ = t("ws", "TM_商品在庫ストックマスタ");

type Rec = Record<string, any>;
const n = (v: unknown) => Number(v ?? 0) || 0;

/** Access の日付の通し番号（CLng(日付)。1899/12/30 が 0） */
function 日付の番号(v: string | null | undefined): number {
  if (!v) return 0;
  const d = Date.parse(v.slice(0, 10) + "T00:00:00Z");
  return Math.round((d - Date.UTC(1899, 11, 30)) / 86400000);
}

/** 日本の今日（YYYY-MM-DD） */
const 今日 = () => new Date(Date.now() + 9 * 3600 * 1000).toISOString().slice(0, 10);

/** 賞味期限の知らせ（Access の C_期限通知） */
export function 期限通知(期限: string | null | undefined): string {
  if (!期限) return "";
  const 残り = Math.round((Date.parse(期限.slice(0, 10)) - Date.parse(今日())) / 86400000);
  if (残り > 180) return "";
  return 残り < 0 ? "期限切れ!" : `あと${cint(残り / 30)}ヶ月!`;
}

/** 月日（Access の Format(日付, "m月d日")） */
const 月日 = (v: string) => `${Number(v.slice(5, 7))}月${Number(v.slice(8, 10))}日`;

/**
 * 在庫の見込み（Access の CC_KakuZaikoSum。作業用の表 TD_架空在庫 に入れるかわりに、その場で計算して返す）
 * - 在庫（TD_在庫 の在庫ケースが 0 でないもの）
 * - 計画を含むときは、生産計画（製造管理の TD_入庫 で chk が付いていないもの）
 * - まだ在庫登録していない出荷（便に入っていて chk が付いていないもの）を、認識ID の同じ行から引く
 * 商品は同じグループ商品コードのものをまとめて出す（Access と同じ）。
 */
export async function 在庫見込み(
  c: PoolClient | typeof pool,
  p: { 商品コード?: number; 倉庫ID?: number; 計画: boolean; 指定日?: string | null },
): Promise<Rec[]> {
  // 商品（同じグループ）・倉庫・日付の条件。表ごとに $1… を振り直す
  let g0 = 0;
  if (p.商品コード)
    g0 = n((await c.query(`SELECT "グループ商品コード" FROM ${商品マスタ} WHERE "商品コード" = $1 LIMIT 1`, [p.商品コード])).rows[0]?.グループ商品コード);
  const 条件 = (日付の列: string, more: string[]): [string, unknown[]] => {
    const args: unknown[] = [];
    const w: string[] = [];
    if (p.商品コード) {
      args.push(g0 || p.商品コード);
      w.push(g0 ? `m."グループ商品コード" = $${args.length}` : `x."商品コード" = $${args.length}`);
    }
    if (p.倉庫ID) {
      args.push(p.倉庫ID);
      w.push(`x."倉庫ID" = $${args.length}`);
    }
    if (p.指定日) {
      args.push(p.指定日);
      w.push(`x."${日付の列}" <= $${args.length}::date`);
    }
    w.push(...more);
    return [w.length ? "WHERE " + w.join(" AND ") : "", args];
  };
  const 名前 = new Map<number, string>();
  const 短縮名 = async (code: unknown) => {
    const k = n(code);
    if (!名前.has(k)) 名前.set(k, (await c.query(`SELECT "短縮名" FROM ${得意先マスタ} WHERE "短縮コード" = $1 LIMIT 1`, [k])).rows[0]?.短縮名 ?? null);
    return 名前.get(k) ?? null;
  };
  const 区分名 = new Map<number, string>(
    (await c.query(`SELECT "区分ID", "区分名" FROM ${商品区分}`)).rows.map((r: Rec) => [n(r.区分ID), r.区分名]),
  );

  const rows: Rec[] = [];
  // 1. 在庫（CC_Kurikei）
  const [w1, a1] = 条件("入庫日", [`x."在庫ケース" <> 0`]);
  const zaiko = (
    await c.query(
      `SELECT x.*, m."分類ID" AS "m分類ID" FROM ${在庫} x LEFT JOIN ${商品マスタ} m ON m."商品コード" = x."商品コード" ${w1} ORDER BY x."在庫ID"`,
      a1,
    )
  ).rows;
  for (const z of zaiko) {
    rows.push({
      入庫日: z.入庫日, 倉庫ID: z.倉庫ID, 倉庫名: await 短縮名(z.倉庫ID), 商品コード: z.商品コード, 分類ID: z.m分類ID, 商品名: z.商品名,
      規格: z.規格, 入数: z.入数, 入庫後名義ID: z.入庫後名義ID, 製造日: z.製造日, 賞味期限: z.賞味期限,
      繰越ケース: n(z.在庫ケース), 繰越kg: n(z.在庫kg), 製造ケース: 0, 製造kg: 0, 出庫ケース: 0, 出荷kg: 0,
      タグ: z.タグ, タグ2: z.タグ2, 商品区分: n(z.商品区分), 検査区分: z.検査区分, 入庫No: z.入庫No, 未包装kg: z.未包装kg,
      入庫元数: z.入庫元数, 架空実物: false, 出荷止め区分: z.出荷止め区分, 管理備考: z.管理備考, 出庫ID: z.出庫ID,
      認識ID: String(z.在庫ID), 架空ID: z.在庫ID, 入庫ID: z.入庫ID, 在庫ケース: n(z.在庫ケース), 在庫kg: n(z.在庫kg),
      インポート場所ID: 1, 産地コード: z.産地コード, 製造工場ID: z.製造工場ID, 製造工場名: z.製造工場名, 検体区分: z.検体区分,
      検査予定日: z.検査予定日, 合否判定ID: z.合否判定ID, 合否判定: z.合否判定, 備考在庫: "", 賞味期限通知: "", 通知: null,
    });
  }
  // 2. 生産計画（CC_SeisanSum）
  if (p.計画) {
    const [w2, a2] = 条件("入庫日", [`x."chk" = false`]);
    const nyuko = (
      await c.query(`SELECT x.* FROM ${入庫} x LEFT JOIN ${商品マスタ} m ON m."商品コード" = x."商品コード" ${w2} ORDER BY x."入庫ID"`, a2)
    ).rows;
    for (const z of nyuko) {
      const 名義: Record<number, number> = { 1: 1, 11: 11, 133: 133, 191: 150, 1187: 1187 };
      const r: Rec = {
        入庫日: z.入庫日, 倉庫ID: z.倉庫ID, 倉庫名: await 短縮名(z.倉庫ID), 商品コード: z.商品コード, 分類ID: null, 商品名: z.商品名,
        規格: z.規格, 入数: z.入数, 製造日: z.製造日,
        賞味期限: z.賞味期限 ?? (await 賞味期限計算(c as PoolClient, z.製造日, z.商品コード)),
        入庫元数: z.ケース, 繰越ケース: 0, 繰越kg: 0, 製造ケース: n(z.ケース), 製造kg: n(z.商品kg),
        出庫ケース: n(z.出庫ケース), 出荷kg: n(z.出荷kg), 入庫ID: z.入庫ID, 出荷止め区分: z.出荷止め, 管理備考: z.管理備考,
        架空実物: true, 製造工場ID: z.倉庫ID, 製造工場名: z.倉庫名, 通知: "生産計画", 検体区分: z.検体区分,
        入庫後名義ID: 名義[n(z.倉庫ID)] ?? 629, 備考在庫: z.未包装区分 ? "現在未包装です。\r\n" : "",
        商品区分: n(z.商品区分), 検査区分: z.検査区分, タグ: z.タグ, インポート場所ID: 1, 架空ID: null, 賞味期限通知: "",
      };
      r.在庫ケース = r.製造ケース - r.出庫ケース;
      r.在庫kg = r.製造kg - r.出荷kg;
      r.認識ID = `${n(z.倉庫ID)}${n(z.商品コード)}${日付の番号(z.製造日)}${日付の番号(z.入庫日)}${n(z.入庫ID)}`;
      rows.push(r);
    }
  }
  // 3. まだ在庫登録していない出荷を引く（CC_kakuSykei。便に入っていて届け先がある行）
  if (rows.length) {
    const [w3, a3] = 条件("出荷日", [`x."届け先コード" <> 0`, `x."chk" = false`]);
    const ship = (
      await c.query(
        `SELECT x."認識ID", x."ケース", x."商品kg", x."出荷日" FROM ${出荷} x
           JOIN ${輸送計画} p ON p."輸送ID" = x."輸送ID"
           LEFT JOIN ${商品マスタ} m ON m."商品コード" = x."商品コード"
         ${w3} ORDER BY x."出荷日", x."出庫ID"`,
        a3,
      )
    ).rows;
    for (const s of ship) {
      const r = rows.find((x) => x.認識ID === String(s.認識ID ?? ""));
      if (!r) continue;
      r.出庫ケース += n(s.ケース);
      r.出荷kg += n(s.商品kg);
      r.備考在庫 = (r.備考在庫 ?? "") + `${s.出荷日 ? 月日(s.出荷日) : ""} ${n(s.ケース)} 出\r\n`;
    }
  }
  // 4. 計算し直す（CC_kakuZaikei。製造か出庫のある行だけ）
  for (const r of rows) {
    r.商品区分名 = 区分名.get(n(r.商品区分)) ?? null;
    if (r.製造ケース !== 0 || r.出庫ケース !== 0) {
      r.在庫ケース = r.繰越ケース + r.製造ケース - r.出庫ケース;
      r.在庫kg = r.繰越kg + r.製造kg - r.出荷kg;
      if (r.製造日) {
        r.賞味期限 = r.賞味期限 ?? (await 賞味期限計算(c as PoolClient, r.製造日, r.商品コード));
        if (r.賞味期限) r.賞味期限通知 = 期限通知(r.賞味期限);
      }
      if (n(r.入庫後名義ID) === 0) r.入庫後名義ID = 629;
    }
    r.実算ケース = r.在庫ケース;
    r.実算kg = 0;
  }
  // 並びは Access の選ぶ画面と同じ（グループ商品コード・賞味期限・検体区分・タグ・製造日・検査区分・入庫日・商品コード）
  const g = new Map<number, number>();
  for (const r of rows) {
    if (!g.has(n(r.商品コード)))
      g.set(n(r.商品コード), n((await c.query(`SELECT "グループ商品コード" FROM ${商品マスタ} WHERE "商品コード" = $1 LIMIT 1`, [n(r.商品コード)])).rows[0]?.グループ商品コード));
  }
  const 比べる = (a: unknown, b: unknown) => {
    if (a === b) return 0;
    if (a === null || a === undefined || a === "") return -1;
    if (b === null || b === undefined || b === "") return 1;
    return typeof a === "number" && typeof b === "number" ? a - b : String(a) < String(b) ? -1 : 1;
  };
  rows.sort(
    (a, b) =>
      比べる(g.get(n(a.商品コード)), g.get(n(b.商品コード))) ||
      比べる(a.賞味期限, b.賞味期限) ||
      比べる(b.検体区分 ? 1 : 0, a.検体区分 ? 1 : 0) ||
      比べる(a.タグ, b.タグ) ||
      比べる(a.製造日, b.製造日) ||
      比べる(a.検査区分, b.検査区分) ||
      比べる(a.入庫日, b.入庫日) ||
      比べる(n(a.商品コード), n(b.商品コード)),
  );
  return rows;
}

/** パレット枚数（Access の Myパレット計算。ケース ÷ パレット単位1 の端数は繰り上げ） */
async function パレット計算(c: PoolClient, 商品コード: unknown, ケース: number): Promise<number> {
  const 単位 = n((await c.query(`SELECT "パレット単位1" FROM ${商品マスタ} WHERE "商品コード" = $1 LIMIT 1`, [n(商品コード)])).rows[0]?.パレット単位1);
  if (!単位) return 0;
  const x = ケース / 単位;
  return Number.isInteger(x) ? x : Math.trunc(x) + 1;
}

export function wsZaikoRoutes(app: FastifyInstance) {
  app.addHook("preHandler", requireUser);

  // 希望在庫表示（出荷明細票の「検索実行」）。品名・倉庫で在庫の見込みを出す（生産計画を含む）
  app.get<{ Querystring: { shohin?: string; soko?: string } }>("/api/ws/kibou", async (req, reply) => {
    const 商品コード = n(req.query.shohin);
    const 倉庫ID = n(req.query.soko);
    if (!商品コード && !倉庫ID) return reply.code(400).send({ error: "検索条件が入力されていません。" });
    const rows = await 在庫見込み(pool, { 商品コード, 倉庫ID, 計画: true });
    const 依頼 = 商品コード
      ? (await pool.query(`SELECT SUM("商品kg") AS kg, SUM("残kg") AS zan FROM ${本社依頼受注} WHERE "商品コード" = $1`, [商品コード])).rows[0]
      : null;
    const 表題 = 商品コード
      ? (await pool.query(`SELECT "ストック数" FROM ${ストックマスタ} WHERE "商品コード" = $1 LIMIT 1`, [商品コード])).rows[0]?.ストック数 ?? ""
      : "";
    return { rows, 本社依頼kg: 依頼?.kg ?? null, 本社依頼残kg: 依頼?.zan ?? null, 表題 };
  });

  // 出荷止め・管理備考を直す（Access の 出荷止め区分_Click。生産計画は TD_入庫、在庫は TD_在庫 に書く）
  app.post<{ Body: { 架空実物: boolean; 入庫ID?: number; 在庫ID?: number; 出荷止め区分: boolean; 管理備考: string | null } }>(
    "/api/ws/kibou/tome",
    async (req) => {
      const b = req.body;
      if (b.架空実物) await pool.query(`UPDATE ${入庫} SET "出荷止め" = $2, "管理備考" = $3 WHERE "入庫ID" = $1`, [n(b.入庫ID), !!b.出荷止め区分, b.管理備考 ?? ""]);
      else await pool.query(`UPDATE ${在庫} SET "出荷止め区分" = $2, "管理備考" = $3 WHERE "在庫ID" = $1`, [n(b.在庫ID), !!b.出荷止め区分, b.管理備考 ?? ""]);
      return { ok: true };
    },
  );

  // 選んだ在庫から出荷の行を作る（Access の C_架空製造日別出荷データ表示Ver2 の後半）
  app.post<{ Body: { 輸送ID: number; shohin?: number; soko?: number; 認識ID: string[] } }>("/api/ws/kibou/add", async (req, reply) => {
    const 輸送ID = n(req.body.輸送ID);
    return 一連で(async (c) => {
      const plan = (await c.query(`SELECT "出荷計画日", "集荷日" FROM ${輸送計画} WHERE "輸送ID" = $1`, [輸送ID])).rows[0];
      if (!plan) return reply.code(404).send({ error: "この便はありません" });
      const 選んだ = new Set(req.body.認識ID.map(String));
      const all = await 在庫見込み(c, { 商品コード: n(req.body.shohin), 倉庫ID: n(req.body.soko), 計画: true });
      // 作業用の表に入った順（在庫 → 生産計画）で入れる
      const rows = all
        .filter((r) => 選んだ.has(String(r.認識ID)))
        .sort((a, b) => Number(a.架空実物) - Number(b.架空実物) || n(a.架空ID ?? a.入庫ID) - n(b.架空ID ?? b.入庫ID));
      await c.query(`SELECT pg_advisory_xact_lock(hashtext('TD_出荷.出庫ID'))`);
      let next = n((await c.query(`SELECT COALESCE(MAX("出庫ID"), 0) + 1 AS n FROM ${出荷}`)).rows[0].n);
      const 集荷 = plan.集荷日 ? ` ${plan.集荷日.slice(5, 7)}/${plan.集荷日.slice(8, 10)}` : "";
      for (const r of rows) {
        const 場所 = (await c.query(`SELECT "手配元ID", "手配帳合ID" FROM ${出荷場所条件} WHERE "倉庫ID" = $1 LIMIT 1`, [n(r.倉庫ID)])).rows[0];
        const 手配元ID = 場所?.手配元ID ?? r.倉庫ID;
        const 手配帳合ID = 場所?.手配帳合ID ?? r.倉庫ID;
        const 名 = async (code: unknown) => (await c.query(`SELECT "短縮名" FROM ${得意先マスタ} WHERE "短縮コード" = $1 LIMIT 1`, [n(code)])).rows[0]?.短縮名 ?? null;
        const m = (await c.query(`SELECT "特別検査区分" FROM ${商品マスタ} WHERE "商品コード" = $1 LIMIT 1`, [n(r.商品コード)])).rows[0];
        const v: Record<string, unknown> = {
          ...出荷の既定値,
          出庫ID: next++, 輸送ID, 出荷日: plan.出荷計画日, 商品コード: r.商品コード, 商品名: r.商品名, 規格: r.規格, 入数: r.入数,
          ケース: r.在庫ケース, パレット使用枚数: await パレット計算(c, r.商品コード, n(r.在庫ケース)), 商品kg: r.在庫kg, 製造日: r.製造日,
          入庫前名義ID: r.入庫後名義ID, 入庫No: r.入庫No ?? null,
          賞味期限: r.賞味期限 ?? (await 賞味期限計算(c, r.製造日, r.商品コード)),
          入庫ID: r.入庫ID, 倉庫ID: r.倉庫ID, 倉庫名: r.倉庫名,
          // 届け先は Access でも入れない（検索実行からは届け先を渡していない）
          届け先コード: null,
          手配元ID, 手配帳合ID, 手配元: await 名(手配元ID), 手配帳合: await 名(手配帳合ID),
          タグ: r.タグ ?? null, タグ2: r.タグ2 ?? null, 産地コード: r.産地コード ?? null, 製造工場ID: r.製造工場ID ?? null, 製造工場名: r.製造工場名 ?? null,
          検体区分: r.検体区分 ?? false, 商品区分: r.商品区分, 特別検査区分: m?.特別検査区分 ?? false,
          認識ID: r.認識ID, 入庫日: r.入庫日, 在庫ID: r.架空ID,
          社内連絡: `${集荷}${r.倉庫名 ?? ""} 引取り\r\n${r.検査区分 ?? ""}`,
          通知: r.架空実物 ? "計画" : "確認OK!", インポート場所ID: r.インポート場所ID,
        };
        const keys = Object.keys(v);
        await c.query(
          `INSERT INTO ${出荷} (${keys.map((k) => `"${k}"`).join(", ")}) VALUES (${keys.map((_, i) => `$${i + 1}`).join(", ")})`,
          keys.map((k) => v[k]),
        );
      }
      return { 件数: rows.length };
    });
  });
}
