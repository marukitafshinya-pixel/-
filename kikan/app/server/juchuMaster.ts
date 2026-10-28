import type { FastifyInstance } from "fastify";
import { q, t } from "./db.js";
import { requireUser } from "./auth.js";
import { 一連で } from "./ws.js";

// 受注グループマスタ（Access の FM_受注先マスタ登録）。受注先選択画面のボタン・受注先の一覧のもとになる表
const 受注先マスタ = t("juchu_fe", "TM_受注先マスタ");
const 得意先マスタ = t("kyotsu", "TM_得意先マスタ");
const 得意先区分 = t("juchu_fe", "TM_得意先区分");

/** 画面から書き込んでよい項目 */
const 書ける項目 = [
  "本社受注", "受注区分", "取引先ID", "取引先名", "受注元ID", "受注元名", "受注先ID", "受注先名", "受注帳合ID", "受注帳合先名",
  "指定届け先コード", "指定届け先", "ユーザー区分", "指定入庫名義ID", "指定入庫後名義名", "指定倉庫ID", "指定倉庫名", "備考",
  "道内区分", "転売区分", "一般ユーザー", "仕入区分", "伝票送付", "デポ区分", "使用不可", "取扱い区分",
];

/** 開くときの合言葉（Access と同じ。値はサーバーの設定 JUCHU_MASTER_PASSWORD に置き、プログラムには書かない） */
function 合言葉が合う(v: unknown): boolean {
  const pass = process.env.JUCHU_MASTER_PASSWORD;
  return !!pass && v === pass;
}

export function juchuMasterRoutes(app: FastifyInstance) {
  app.addHook("preHandler", requireUser);
  app.setErrorHandler((e: any, _req, reply) => {
    reply.code(e.status ?? e.statusCode ?? 500).send({ error: e.status ? e.message : "うまくいきませんでした：" + e.message });
  });
  // 合言葉が要る（開くときに確かめ、書き込みのたびにも確かめる）
  app.addHook("preHandler", async (req, reply) => {
    if (!process.env.JUCHU_MASTER_PASSWORD)
      return reply.code(400).send({ error: "合言葉がサーバーに設定されていないため、開けません。" });
    if (!合言葉が合う(req.headers["x-kikan-pass"] ? decodeURIComponent(String(req.headers["x-kikan-pass"])) : ""))
      return reply.code(403).send({ error: "パスワードが違います。" });
  });

  app.get("/api/juchu-master/unlock", async () => ({ ok: true }));

  // 一覧（受注区分 1＝丸北北海道・629＝大阪丸北、取引元、指定届け先で絞る）
  app.get<{ Querystring: { kubun?: string; torihiki?: string; todoke?: string } }>("/api/juchu-master/list", async (req) => {
    const where: string[] = [];
    const args: unknown[] = [];
    const add = (sql: string, v: unknown) => {
      args.push(v);
      where.push(sql.replace("?", `$${args.length}`));
    };
    if (req.query.kubun) add(`"受注区分" = ?`, Number(req.query.kubun));
    if (req.query.torihiki) add(`"取引先ID" = ?`, Number(req.query.torihiki));
    if (req.query.todoke) add(`"指定届け先コード" = ?`, Number(req.query.todoke));
    return q(`SELECT * FROM ${受注先マスタ} ${where.length ? "WHERE " + where.join(" AND ") : ""} ORDER BY "ID"`, args);
  });

  // 取引元の選択肢（その受注区分の取引先）
  app.get<{ Querystring: { kubun: string } }>("/api/juchu-master/torihiki", async (req) =>
    q(
      `SELECT "取引先ID", MIN("取引先名") AS "取引先名" FROM ${受注先マスタ} WHERE "受注区分" = $1 GROUP BY "取引先ID" ORDER BY "取引先ID"`,
      [Number(req.query.kubun)],
    ),
  );

  app.get("/api/juchu-master/user-kubun", async () =>
    q(`SELECT "得意先区分コード", "区分名" FROM ${得意先区分} ORDER BY "得意先区分コード"`),
  );

  // 1 行を直す・足す
  app.post<{ Body: Record<string, any> }>("/api/juchu-master/save", async (req) => {
    const b = req.body;
    const v: Record<string, unknown> = {};
    for (const k of 書ける項目) if (k in b) v[k] = b[k] === "" ? null : b[k];
    const cols = Object.keys(v);
    if (b.ID) {
      if (cols.length)
        await q(`UPDATE ${受注先マスタ} SET ${cols.map((k, i) => `"${k}" = $${i + 2}`).join(", ")} WHERE "ID" = $1`, [
          b.ID, ...cols.map((k) => v[k]),
        ]);
      return { ID: b.ID };
    }
    // 新しい行。ID は Access のオートナンバーと同じく今までの一番大きい番号の次
    // 同時に 2 人が足しても同じ ID にならないように鍵を取る（2026/10/28 点検）
    return 一連で(async (c) => {
      await c.query(`SELECT pg_advisory_xact_lock(hashtext('TM_受注先マスタ.ID'))`);
      const id = Number((await c.query(`SELECT COALESCE(MAX("ID"), 0) + 1 AS id FROM ${受注先マスタ}`)).rows[0].id);
      const all: Record<string, unknown> = {
        道内区分: false, 転売区分: false, 一般ユーザー: false, 仕入区分: false, 伝票送付: false, デポ区分: false, 使用不可: false,
        取扱い区分: 0, ユーザー区分: 0,
        ...v, ID: id,
      };
      const k = Object.keys(all);
      await c.query(`INSERT INTO ${受注先マスタ} (${k.map((x) => `"${x}"`).join(", ")}) VALUES (${k.map((_, i) => `$${i + 1}`).join(", ")})`, k.map((x) => all[x]));
      return { ID: id };
    });
  });

  app.post<{ Body: { ID: number } }>("/api/juchu-master/delete", async (req) => {
    await q(`DELETE FROM ${受注先マスタ} WHERE "ID" = $1`, [Number(req.body.ID)]);
    return { ok: true };
  });

  // 得意先の短縮名（コードを入れたときに名前を出す）
  app.get<{ Params: { code: string } }>("/api/juchu-master/name/:code", async (req) => {
    const [m] = await q(`SELECT "短縮名" FROM ${得意先マスタ} WHERE "短縮コード" = $1 LIMIT 1`, [Number(req.params.code)]);
    return { 短縮名: m?.短縮名 ?? null };
  });
}
