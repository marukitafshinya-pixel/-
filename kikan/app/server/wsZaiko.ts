import type { FastifyInstance } from "fastify";
import type { PoolClient } from "pg";
import { pool, t, 日本の今 } from "./db.js";
import { requireUser } from "./auth.js";
import { cint } from "./hanmori.js";
import { 一連で, 出荷の既定値, 特別項目, 賞味期限計算 } from "./ws.js";

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
const 倉庫 = t("ws_fe", "TD_倉庫");
const 在庫変更 = t("ws", "TD_在庫変更");
const 倉庫詳細設定 = t("ws_fe", "TD_倉庫詳細設定"); // 倉庫管理の在庫の写し（WorkStation の画面側ファイルの表）

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

  // ---------------- 在庫選択（明細の詳細で商品コードを変えたとき） ----------------
  // Access の 商品コード_AfterUpdate → CC_在庫商品日付参照 → FSD_在庫読込選択 → FSD_架空在庫選択 → 在庫データ読込

  // その倉庫に、この商品の在庫・生産計画・倉庫の在庫があるか（なければ在庫を選ばずにマスタから入れる）
  // Access は TD_倉庫 の「商品kg」「chk」を数えているが、WorkStation の TD_倉庫 にはその項目がない。Web 版では行があるかで見る
  app.get<{ Querystring: { shohin: string; soko: string } }>("/api/ws/zaiko/aru", async (req) => {
    const args = [n(req.query.shohin), n(req.query.soko)];
    const [r] = (
      await pool.query(
        `SELECT (SELECT COUNT("在庫kg") FROM ${在庫} WHERE "商品コード" = $1 AND "倉庫ID" = $2)
              + (SELECT COUNT("商品kg") FROM ${入庫} WHERE "商品コード" = $1 AND "倉庫ID" = $2 AND "chk" = false)
              + (SELECT COUNT(*) FROM ${倉庫} WHERE "商品コード" = $1 AND "倉庫ID" = $2) AS n,
                (SELECT "商品名" FROM ${商品マスタ} WHERE "商品コード" = $1 LIMIT 1) AS "商品名"`,
        args,
      )
    ).rows;
    return { ある: n(r.n) > 0, 商品名: r.商品名 ?? null };
  });

  // 選べる在庫（在庫選択＝在庫だけ、架空＝生産計画も含める）。その倉庫の分だけ
  app.get<{ Querystring: { shohin: string; soko: string; plan?: string } }>("/api/ws/zaiko/list", async (req) => {
    const rows = await 在庫見込み(pool, { 商品コード: n(req.query.shohin), 倉庫ID: n(req.query.soko), 計画: req.query.plan === "1" });
    // 入庫名義（入庫後名義の短縮名）を添える
    const ids = [...new Set(rows.map((r) => n(r.入庫後名義ID)))];
    const 名 = new Map(
      (await pool.query(`SELECT "短縮コード", "短縮名" FROM ${得意先マスタ} WHERE "短縮コード" = ANY($1::int[])`, [ids])).rows.map((r: Rec) => [n(r.短縮コード), r.短縮名]),
    );
    return rows.map((r) => ({ ...r, 入庫名義: 名.get(n(r.入庫後名義ID)) ?? null }));
  });

  // 商品コードを変える。認識ID があればその在庫を読み込む（在庫データ読込）。なければマスタの名前・規格・入数を入れる（強制）
  app.post<{ Body: { 出庫ID: number; 商品コード: number; 認識ID?: string | null; plan?: boolean } }>("/api/ws/zaiko/set", async (req, reply) => {
    const b = req.body;
    return 一連で(async (c) => {
      const cur = (await c.query(`SELECT * FROM ${出荷} WHERE "出庫ID" = $1 FOR UPDATE`, [n(b.出庫ID)])).rows[0];
      if (!cur) return reply.code(404).send({ error: "この明細はありません" });
      if (cur.chk) return reply.code(403).send({ error: "登録済みのデータを訂正する場合、訂正ボタンをクリックしてください。" });
      const 商品コード = n(b.商品コード);
      const m = (await c.query(`SELECT "商品名", "規格", "入数" FROM ${商品マスタ} WHERE "商品コード" = $1 LIMIT 1`, [商品コード])).rows[0];
      const v: Record<string, unknown> = { 商品コード };
      if (!b.認識ID) {
        Object.assign(v, {
          商品名: m?.商品名 ?? null, 在庫ID: 0, 認識ID: "0", 入庫日: null, 製造日: null, 賞味期限: null, 通知: "", 入庫ID: 0, 計画変更chk: false,
        });
      } else {
        const z = (await 在庫見込み(c, { 商品コード, 倉庫ID: n(cur.倉庫ID), 計画: !!b.plan })).find((r) => String(r.認識ID) === String(b.認識ID));
        if (!z) return reply.code(400).send({ error: "選んだ在庫が見つかりません。もう一度選んでください。" });
        Object.assign(v, {
          輸送ID: n(cur.輸送ID) || cur.輸送ID, 認識ID: String(z.認識ID), 入庫日: z.入庫日,
          // 通知：Access では包装日の知らせ（○日後包装）を入れたあと、在庫か計画かの知らせで上書きしている
          在庫ID: z.架空実物 ? 0 : n(z.認識ID), 通知: z.架空実物 ? "計画" : "確認OK!",
          商品名: z.商品名, 入庫No: z.入庫No ?? null, 製造日: z.製造日, 賞味期限: z.賞味期限, 規格: z.規格, 入数: z.入数, 入庫ID: z.入庫ID,
          商品区分: z.商品区分, タグ: z.タグ ?? null, 産地コード: z.産地コード ?? null, 製造工場ID: z.製造工場ID ?? null, 製造工場名: z.製造工場名 ?? null,
          検体区分: z.検体区分 ?? null, 社内連絡: `${cur.社内連絡 ?? ""}\r\n${z.検査区分 ?? ""}`, 入庫前名義ID: z.入庫後名義ID, 計画変更chk: false,
        });
      }
      // 商品の特記事項を備考に足し、規格・入数はマスタの値、重量は入数×ケース（Access の C_特別項目・CC_コード表示）
      v.備考 = await 特別項目(c, 0, String(cur.備考 ?? ""), 商品コード);
      v.規格 = m?.規格 ?? null;
      v.入数 = m?.入数 ?? null;
      if (m?.入数 !== null && m?.入数 !== undefined) v.商品kg = Number(m.入数) * n(cur.ケース);
      const cols = Object.keys(v);
      await c.query(`UPDATE ${出荷} SET ${cols.map((k, i) => `"${k}" = $${i + 2}`).join(", ")} WHERE "出庫ID" = $1`, [cur.出庫ID, ...cols.map((k) => v[k])]);
      return { ok: true };
    });
  });

  // ---------------- 積込確認（明細の ✔）：在庫の登録・削除 ----------------
  // Access の 積込確認_Click → C_出荷指定レコード在庫登録・C_出荷指定レコード在庫削除
  app.post<{ Body: { 出庫ID: number; 積込確認: boolean } }>("/api/ws/tsumikomi", async (req, reply) => {
    const id = n(req.body.出庫ID);
    return 一連で(async (c) => {
      const cur = (await c.query(`SELECT * FROM ${出荷} WHERE "出庫ID" = $1 FOR UPDATE`, [id])).rows[0];
      if (!cur) return reply.code(404).send({ error: "この明細はありません" });
      const on = !!req.body.積込確認;
      await c.query(`UPDATE ${出荷} SET "積込確認" = $2, "chk" = $2 WHERE "出庫ID" = $1`, [id, on]);
      await c.query(`SELECT pg_advisory_xact_lock(hashtext('TD_在庫.在庫ID'))`);
      if (on) await 在庫登録(c, id);
      else await 在庫削除(c, id);
      return { ok: true };
    });
  });
}

/** 入庫できる届け先・名義か（Access の NewkoCondition） */
async function 入庫できる(c: PoolClient, 届け先コード: unknown, 名義: unknown): Promise<boolean> {
  if (届け先コード === null || 届け先コード === undefined) return false; // Access ではここでエラーになり、登録しない
  const f = (await c.query(`SELECT "入庫フラグ" FROM ${得意先マスタ} WHERE "倉庫区分" = true AND "短縮コード" = $1 LIMIT 1`, [n(届け先コード)])).rows[0];
  if (f && f.入庫フラグ === false) return true;
  const r = await c.query(`SELECT 1 FROM ${倉庫詳細設定} WHERE "短縮コード" = $1 AND "名義コード" = $2 LIMIT 1`, [n(届け先コード), n(名義)]);
  return r.rowCount! > 0;
}

/** 在庫の出庫ケース：登録済み（chk）の出荷 ＋ 在庫変更。実データの値と同じ決め方（在庫変更は全部足す） */
async function 在庫の出庫ケース(c: PoolClient, 在庫ID: number): Promise<number> {
  const r = await c.query(
    `SELECT COALESCE((SELECT SUM("ケース") FROM ${出荷} WHERE "chk" = true AND "在庫ID" = $1), 0)
          + COALESCE((SELECT SUM("ケース") FROM ${在庫変更} WHERE "在庫No" = $1), 0) AS n`,
    [在庫ID],
  );
  return n(r.rows[0].n);
}

const 月を足す = (v: string | null, 月: number): string | null => {
  if (!v) return null;
  const d = new Date(v.slice(0, 10) + "T00:00:00Z");
  const y = d.getUTCFullYear() + Math.floor((d.getUTCMonth() + 月) / 12);
  const m = (d.getUTCMonth() + 月) % 12;
  const last = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
  return new Date(Date.UTC(y, m, Math.min(d.getUTCDate(), last))).toISOString().slice(0, 10);
};
const 最初の日 = "1899-12-30"; // Access の日付の 0

/** 積込確認を付けたとき（Access の C_出荷指定レコード在庫登録） */
async function 在庫登録(c: PoolClient, 出庫ID: number) {
  const s = (await c.query(`SELECT * FROM ${出荷} WHERE "出庫ID" = $1`, [出庫ID])).rows[0];
  const 出荷分在庫ID = n(s.在庫ID);
  const 出荷分入庫ID = 出荷分在庫ID ? 0 : n(s.入庫ID);
  let 変更日の最後: string = 最初の日;

  // 1. 届け先が入庫できる倉庫なら、届け先の在庫として登録する（同じ出庫ID の在庫があれば直す）
  if (await 入庫できる(c, s.届け先コード, s.入庫後名義ID)) {
    let z = (await c.query(`SELECT * FROM ${在庫} WHERE "出庫ID" = $1 ORDER BY "在庫ID" LIMIT 1`, [出庫ID])).rows[0];
    if (!z) {
      const 在庫ID = n((await c.query(`SELECT COALESCE(MAX("在庫ID"), 0) + 1 AS n FROM ${在庫}`)).rows[0].n);
      await c.query(
        `INSERT INTO ${在庫} ("在庫ID", "短縮コード", "期", "出庫回数", "サービス区分", "未包装kg", "抽出区分", "出荷止め区分", "入庫ID", "グループコード",
           "変更前在庫ID", "入庫区分", "ストック数", "訂正chk", "買取金額", "買取単価コード", "買取chk", "支払区分", "検査結果", "産地コード",
           "手配元ID", "手配帳合ID", "大阪発注確認chk", "検体区分", "指定最終届け先コード", "検体取得", "パレット積載数", "合否判定ID", "登録時間")
         VALUES ($1, 0, 0, 0, false, 0, false, false, 0, 0, 0, false, 0, false, 0, 0, false, 0, 0, 0, 0, 0, false, false, 0, false, 0, 0, $2)`,
        [在庫ID, 日本の今().日時.replace(/\//g, "-")],
      );
      z = { 在庫ID };
    }
    const 入数 = n(s.入数);
    const 入庫元数 = n(s.ケース);
    const 出庫ケース = await 在庫の出庫ケース(c, z.在庫ID);
    const 在庫ケース = 入庫元数 - 出庫ケース;
    let 最終出庫日: string | null;
    if (在庫ケース === 0) {
      const m = (await c.query(`SELECT MAX("出荷日") AS s FROM ${出荷} WHERE "在庫ID" = $1`, [z.在庫ID])).rows[0].s ?? 最初の日;
      変更日の最後 = (await c.query(`SELECT MAX("変更日") AS h FROM ${在庫変更} WHERE "在庫No" = $1`, [z.在庫ID])).rows[0].h ?? 最初の日;
      最終出庫日 = m < 変更日の最後 ? 変更日の最後 : m;
    } else 最終出庫日 = 月を足す(s.納品日, 60) ?? z.最終出庫日 ?? null;
    const v: Record<string, unknown> = {
      出庫ID: s.出庫ID, 倉庫ID: s.届け先コード, 倉庫名: s.届け先, 商品コード: s.商品コード, 商品区分: n(s.商品区分), 商品名: s.商品名, 規格: s.規格, 入数: s.入数,
      入庫元数, 繰越ケース: 0, 繰越kg: 0, 製造ケース: 入庫元数, 製造kg: n(s.商品kg), 出庫ケース, 出荷kg: 出庫ケース * 入数, 在庫ケース, 在庫kg: 在庫ケース * 入数,
      製造日: s.製造日, 賞味期限: s.賞味期限, 入庫日: s.納品日, 入庫後名義ID: s.入庫後名義ID, タグ: s.タグ, 製造工場ID: s.製造工場ID, 製造工場名: s.製造工場名, 最終出庫日,
    };
    const cols = Object.keys(v);
    await c.query(`UPDATE ${在庫} SET ${cols.map((k, i) => `"${k}" = $${i + 2}`).join(", ")} WHERE "在庫ID" = $1`, [z.在庫ID, ...cols.map((k) => v[k])]);
  }

  // 2. 出荷した分を、もとの在庫（在庫ID があれば TD_在庫、なければ製造管理の TD_入庫）から引く
  if (出荷分在庫ID) {
    const z = (await c.query(`SELECT * FROM ${在庫} WHERE "在庫ID" = $1`, [出荷分在庫ID])).rows[0];
    if (z) {
      const 入数 = n(z.入数);
      const 出庫ケース = await 在庫の出庫ケース(c, 出荷分在庫ID);
      const 在庫ケース = n(z.入庫元数) - 出庫ケース;
      let 最終出庫日 = 月を足す(z.入庫日, 60) ?? z.最終出庫日;
      if (在庫ケース === 0) {
        const m = (await c.query(`SELECT MAX("出荷日") AS s FROM ${出荷} WHERE "在庫ID" = $1`, [出荷分在庫ID])).rows[0].s ?? 最初の日;
        最終出庫日 = m < 変更日の最後 ? 変更日の最後 : m;
      }
      await c.query(
        `UPDATE ${在庫} SET "繰越ケース" = 0, "繰越kg" = 0, "製造ケース" = "入庫元数", "製造kg" = $2, "出庫ケース" = $3, "出荷kg" = $4,
           "在庫ケース" = $5, "在庫kg" = $6, "最終出庫日" = $7 WHERE "在庫ID" = $1`,
        [出荷分在庫ID, n(z.入庫元数) * 入数, 出庫ケース, 出庫ケース * 入数, 在庫ケース, 在庫ケース * 入数, 最終出庫日],
      );
    }
  } else if (出荷分入庫ID) {
    const z = (await c.query(`SELECT * FROM ${入庫} WHERE "入庫ID" = $1`, [出荷分入庫ID])).rows[0];
    if (z) {
      const 入数 = n(z.入数);
      const 入庫元数 = n(z.ケース); // 入庫（生産計画）のときは、入庫元数にケースを入れる
      const 出庫ケース = n((await c.query(`SELECT SUM("ケース") AS n FROM ${出荷} WHERE "chk" = true AND "入庫ID" = $1`, [出荷分入庫ID])).rows[0].n);
      const 在庫ケース = 入庫元数 - 出庫ケース;
      let 最終出庫日 = 月を足す(z.入庫日, 60) ?? z.最終出庫日;
      if (在庫ケース === 0) {
        const m = (await c.query(`SELECT MAX("出荷日") AS s FROM ${出荷} WHERE "入庫ID" = $1`, [出荷分入庫ID])).rows[0].s ?? 最初の日;
        最終出庫日 = m < 変更日の最後 ? 変更日の最後 : m;
      }
      await c.query(
        `UPDATE ${入庫} SET "入庫元数" = $2, "繰越ケース" = 0, "繰越kg" = 0, "製造ケース" = $2, "製造kg" = $3, "出庫ケース" = $4, "出荷kg" = $5,
           "在庫ケース" = $6, "在庫kg" = $7, "最終出庫日" = $8 WHERE "入庫ID" = $1`,
        [出荷分入庫ID, 入庫元数, 入庫元数 * 入数, 出庫ケース, 出庫ケース * 入数, 在庫ケース, 在庫ケース * 入数, 最終出庫日],
      );
    }
  }
}

/** 積込確認を外したとき（Access の C_出荷指定レコード在庫削除）。登録した在庫は消さずに 0 にし、もとの在庫を数え直す */
async function 在庫削除(c: PoolClient, 出庫ID: number) {
  await c.query(
    `UPDATE ${在庫} SET "繰越ケース" = 0, "繰越kg" = 0, "製造ケース" = 0, "製造kg" = 0, "出庫ケース" = 0, "出荷kg" = 0, "在庫ケース" = 0, "在庫kg" = 0
     WHERE "在庫ID" = (SELECT MIN("在庫ID") FROM ${在庫} WHERE "出庫ID" = $1)`,
    [出庫ID],
  );
  const s = (await c.query(`SELECT "在庫ID", "入庫ID" FROM ${出荷} WHERE "出庫ID" = $1`, [出庫ID])).rows[0];
  const 出荷分在庫ID = n(s?.在庫ID);
  if (出荷分在庫ID) {
    const 出庫ケース = await 在庫の出庫ケース(c, 出荷分在庫ID);
    await c.query(
      `UPDATE ${在庫} SET "繰越ケース" = 0, "繰越kg" = 0, "製造ケース" = "入庫元数", "製造kg" = "入庫元数" * "入数", "出庫ケース" = $2::double precision, "出荷kg" = $2::double precision * "入数",
         "在庫ケース" = "入庫元数" - $2::double precision, "在庫kg" = ("入庫元数" - $2::double precision) * "入数" WHERE "在庫ID" = $1`,
      [出荷分在庫ID, 出庫ケース],
    );
  } else {
    const 出荷分入庫ID = n(s?.入庫ID);
    const 出庫ケース = n((await c.query(`SELECT SUM("ケース") AS n FROM ${出荷} WHERE "chk" = true AND "入庫ID" = $1`, [出荷分入庫ID])).rows[0].n);
    await c.query(
      `UPDATE ${入庫} SET "繰越ケース" = 0, "繰越kg" = 0, "製造ケース" = "入庫元数", "製造kg" = "入庫元数" * "入数", "出庫ケース" = $2::double precision, "出荷kg" = $2::double precision * "入数",
         "在庫ケース" = "入庫元数" - $2::double precision, "在庫kg" = ("入庫元数" - $2::double precision) * "入数" WHERE "入庫ID" = $1`,
      [出荷分入庫ID, 出庫ケース],
    );
  }
}
