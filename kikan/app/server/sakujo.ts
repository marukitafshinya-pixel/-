import type { FastifyInstance } from "fastify";
import type { PoolClient } from "pg";
import { pool, t, 日本の今 } from "./db.js";
import { requireUser } from "./auth.js";
import { 一連で } from "./ws.js";
import { 古いデータのExcel } from "./excel.js";

// 古いデータを消す（2026/10/22 利用者の依頼。Access では過去のデータを手で消していた：おおむね 2 年分を残す）。
// 年数を選び、消す行の件数を見て、Excel に書き出してから［削除］する。合言葉（MASTER_PASSWORD）が要る。
// 在庫が残っているロットと、それにつながる出荷・入庫・在庫訂正・受注・便は消さない。
type Rec = Record<string, any>;
const n = (v: unknown) => Number(v ?? 0) || 0;

export type まとまり = "受注出荷" | "在庫入庫" | "倉庫管理";

/** 消す行の決まり（x がその表の行。$1 がこの日より前を消す日） */
function 決まり(選ぶ: Set<まとまり>) {
  const A = 選ぶ.has("受注出荷");
  const B = 選ぶ.has("在庫入庫");
  const C = 選ぶ.has("倉庫管理");
  const sys = (s: "ws" | "soko") => ({
    出荷: t(s, "TD_出荷"),
    便: t(s, "TD_輸送計画"),
    在庫: t(s, "TD_在庫"),
    訂正: t(s, "TD_在庫変更"),
  });
  const W = sys("ws");
  const S = sys("soko");
  const 出荷を消す = { ws: A, soko: C };
  const 在庫を消す = { ws: B, soko: C };
  const T = { ws: W, soko: S };
  // 出荷：出荷日がその日より前で、在庫の残っているロットの出荷でない
  const 出荷候補 = (s: "ws" | "soko", a: string) =>
    出荷を消す[s]
      ? `(${a}."出荷日" < $1::date AND NOT EXISTS (SELECT 1 FROM ${T[s].在庫} z0 WHERE z0."在庫ID" = ${a}."在庫ID" AND COALESCE(z0."在庫ケース", 0) <> 0))`
      : "false";
  // 在庫：在庫が 0 で、最後に出した日（なければ入庫日）がその日より前で、消さない出荷がつながっていない
  const 在庫候補 = (s: "ws" | "soko", a: string) =>
    在庫を消す[s]
      ? `(COALESCE(${a}."在庫ケース", 0) = 0 AND COALESCE(${a}."最終出庫日", ${a}."入庫日") < $1::date
          AND NOT EXISTS (SELECT 1 FROM ${T[s].出荷} s1 WHERE s1."在庫ID" = ${a}."在庫ID" AND NOT ${出荷候補(s, "s1")}))`
      : "false";
  const 訂正候補 = (s: "ws" | "soko", a: string) =>
    在庫を消す[s]
      ? `(${a}."変更日" < $1::date AND NOT EXISTS (SELECT 1 FROM ${T[s].在庫} z1 WHERE z1."在庫ID" = ${a}."在庫No" AND NOT ${在庫候補(s, "z1")}))`
      : "false";
  const 便候補 = (s: "ws" | "soko", a: string) =>
    出荷を消す[s]
      ? `(${a}."出荷計画日" < $1::date AND NOT EXISTS (SELECT 1 FROM ${T[s].出荷} s2 WHERE s2."輸送ID" = ${a}."輸送ID" AND NOT ${出荷候補(s, "s2")}))`
      : "false";
  const 表: { まとまり: まとまり; 名前: string; 表: string; where: string }[] = [
    {
      まとまり: "受注出荷", 名前: "受注", 表: t("juchu", "TD_受注"),
      where: `x."受注日" < $1::date
        AND NOT EXISTS (SELECT 1 FROM ${W.出荷} s3 WHERE s3."受注ID" = x."受注ID" AND NOT ${出荷候補("ws", "s3")})
        AND NOT EXISTS (SELECT 1 FROM ${S.出荷} s4 WHERE s4."受注ID" = x."受注ID" AND NOT ${出荷候補("soko", "s4")})`,
    },
    { まとまり: "受注出荷", 名前: "出荷", 表: W.出荷, where: 出荷候補("ws", "x") },
    { まとまり: "受注出荷", 名前: "便（輸送計画）", 表: W.便, where: 便候補("ws", "x") },
    { まとまり: "在庫入庫", 名前: "在庫", 表: W.在庫, where: 在庫候補("ws", "x") },
    {
      まとまり: "在庫入庫", 名前: "入庫（製造）", 表: t("seizo", "TD_入庫"),
      where: `x."入庫日" < $1::date
        AND NOT EXISTS (SELECT 1 FROM ${W.在庫} z2 WHERE z2."入庫ID" = x."入庫ID" AND NOT ${在庫候補("ws", "z2")})
        AND NOT EXISTS (SELECT 1 FROM ${W.出荷} s5 WHERE s5."入庫ID" = x."入庫ID" AND NOT ${出荷候補("ws", "s5")})`,
    },
    { まとまり: "在庫入庫", 名前: "在庫訂正", 表: W.訂正, where: 訂正候補("ws", "x") },
    { まとまり: "倉庫管理", 名前: "倉庫管理の出荷", 表: S.出荷, where: 出荷候補("soko", "x") },
    { まとまり: "倉庫管理", 名前: "倉庫管理の便", 表: S.便, where: 便候補("soko", "x") },
    { まとまり: "倉庫管理", 名前: "倉庫管理の在庫", 表: S.在庫, where: 在庫候補("soko", "x") },
    { まとまり: "倉庫管理", 名前: "倉庫管理の在庫訂正", 表: S.訂正, where: 訂正候補("soko", "x") },
  ];
  return 表.filter((x) => 選ぶ.has(x.まとまり));
}

/** 消す日（今日から 年数 年前の日。この日より前を消す） */
export function 消す日(年数: number, 今日 = 日本の今().日付): string {
  const [y, m, d] = 今日.split("-").map(Number);
  const last = new Date(Date.UTC(y - 年数, m, 0)).getUTCDate();
  return `${y - 年数}-${String(m).padStart(2, "0")}-${String(Math.min(d, last)).padStart(2, "0")}`;
}

function 選んだもの(v: unknown): Set<まとまり> {
  const all: まとまり[] = ["受注出荷", "在庫入庫", "倉庫管理"];
  const a = Array.isArray(v) ? v : String(v ?? "").split(",");
  return new Set(all.filter((x) => a.includes(x)));
}
function 合言葉を確かめる(v: unknown) {
  const pass = process.env.MASTER_PASSWORD;
  if (!pass) throw Object.assign(new Error("合言葉がサーバーに設定されていないため、消せません。"), { status: 400 });
  if (v !== pass) throw Object.assign(new Error("パスワードが違います!"), { status: 403 });
}
async function ある表(c: PoolClient | typeof pool, 表: string) {
  return !!(await c.query(`SELECT to_regclass($1) AS r`, [表])).rows[0].r;
}

export function sakujoRoutes(app: FastifyInstance) {
  app.addHook("preHandler", requireUser);
  app.setErrorHandler((e: any, _req, reply) => {
    reply.code(e.status ?? e.statusCode ?? 500).send({ error: e.status ? e.message : "うまくいきませんでした：" + e.message });
  });

  // 消す行の件数
  app.get<{ Querystring: { years: string; kinds: string } }>("/api/mst/sakujo", async (req) => {
    const 年数 = Math.max(1, n(req.query.years));
    const 日 = 消す日(年数);
    const 表 = [];
    for (const x of 決まり(選んだもの(req.query.kinds))) {
      if (!(await ある表(pool, x.表))) continue;
      const r = (await pool.query(`SELECT COUNT(*) AS n, (SELECT COUNT(*) FROM ${x.表}) AS 全部 FROM ${x.表} x WHERE ${x.where}`, [日])).rows[0];
      表.push({ まとまり: x.まとまり, 名前: x.名前, 件数: n(r.n), 全部: n(r.全部) });
    }
    return { 消す日: 日, 表 };
  });

  // 消す行を Excel に書き出す（表ごとに 1 枚のシート）
  app.post<{ Body: { pass: string; years: number; kinds: string[] } }>("/api/mst/sakujo/excel", async (req, reply) => {
    合言葉を確かめる(req.body?.pass);
    const 日 = 消す日(Math.max(1, n(req.body.years)));
    const シート = [];
    for (const x of 決まり(選んだもの(req.body.kinds))) {
      if (!(await ある表(pool, x.表))) continue;
      シート.push({ 名前: x.名前, rows: (await pool.query(`SELECT x.* FROM ${x.表} x WHERE ${x.where}`, [日])).rows });
    }
    const buf = await 古いデータのExcel(シート);
    reply
      .header("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
      .header("Content-Disposition", `attachment; filename*=UTF-8''${encodeURIComponent(`消したデータ_${日}より前.xlsx`)}`);
    return reply.send(buf);
  });

  // 削除：先に全部の表で消す行を決めてから（消す順で決まりが変わらないように）、まとめて消す
  app.post<{ Body: { pass: string; years: number; kinds: string[]; 件数: Record<string, number> } }>("/api/mst/sakujo/run", async (req) => {
    合言葉を確かめる(req.body?.pass);
    const 日 = 消す日(Math.max(1, n(req.body.years)));
    return 一連で(async (c) => {
      await c.query(`SELECT pg_advisory_xact_lock(hashtext('古いデータを消す'))`);
      const 対象 = [];
      for (const x of 決まり(選んだもの(req.body.kinds))) {
        if (!(await ある表(c, x.表))) continue;
        const ctids = (await c.query(`SELECT x.ctid::text AS id FROM ${x.表} x WHERE ${x.where}`, [日])).rows.map((r: Rec) => r.id);
        // 画面で見た件数と違えば止める（その間にデータが変わった）
        if (req.body.件数 && n(req.body.件数[x.名前]) !== ctids.length)
          throw Object.assign(new Error(`${x.名前} の件数が変わりました（${req.body.件数[x.名前]} → ${ctids.length}）。もう一度確かめてください。`), { status: 409 });
        対象.push({ ...x, ctids });
      }
      const 結果: Record<string, number> = {};
      for (const x of 対象) {
        const r = x.ctids.length ? await c.query(`DELETE FROM ${x.表} WHERE ctid = ANY($1::tid[])`, [x.ctids]) : { rowCount: 0 };
        結果[x.名前] = r.rowCount ?? 0;
      }
      return { 消す日: 日, 結果 };
    });
  });
}
