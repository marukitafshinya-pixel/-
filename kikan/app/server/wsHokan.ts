import type { FastifyInstance } from "fastify";
import { pool, q, t } from "./db.js";
import { requireUser } from "./auth.js";
import { 一連で, 賞味期限計算 } from "./ws.js";

// 丸北WorkStation の在庫表（Access の FM_商品別在庫・Q_商品別在庫表）と保管庫詳細（FM_保管庫）
const 在庫 = t("ws", "TD_在庫");
const 出荷 = t("ws", "TD_出荷");
const 得意先マスタ = t("kyotsu", "TM_得意先マスタ");
const 商品分類 = t("juchu_fe", "TD_商品分類");
const 商品区分 = t("ws_fe", "TM_商品区分");

const n = (v: unknown) => Number(v ?? 0) || 0;
const 今日 = () => new Date(Date.now() + 9 * 3600 * 1000).toISOString().slice(0, 10);

/** 保管期間の期（Access の Hokan期。半月ごとに数える） */
function 保管の期(入庫日: string | null, 基準日 = 今日()): number {
  if (!入庫日) return 0;
  const a = new Date(入庫日.slice(0, 10) + "T00:00:00Z");
  const b = new Date(基準日 + "T00:00:00Z");
  const 月 = (b.getUTCFullYear() - a.getUTCFullYear()) * 12 + (b.getUTCMonth() - a.getUTCMonth());
  const 補正 = a.getUTCDate() <= 15 ? 1 : 0;
  return b.getUTCDate() <= 15 ? 月 * 2 + 補正 : 月 * 2 + 1 + 補正;
}

/** 保管庫詳細で直せる項目 */
const 書ける項目 = new Set([
  "入庫日", "商品区分", "入庫後名義ID", "製造日", "賞味期限", "タグ", "入庫元数", "繰越ケース", "製造ケース", "出庫ケース", "在庫ケース",
  "出荷止め区分", "管理備考", "検査区分", "産地コード", "製造工場ID",
]);

export function wsHokanRoutes(app: FastifyInstance) {
  app.addHook("preHandler", requireUser);

  // 在庫のある保管庫（在庫表・保管庫詳細の選択肢）
  app.get("/api/ws/hokan/soko", async () =>
    q(
      `SELECT z."倉庫ID" AS id, MIN(m."短縮名") AS name FROM ${在庫} z LEFT JOIN ${得意先マスタ} m ON m."短縮コード" = z."倉庫ID"
       WHERE z."倉庫ID" <> 1 GROUP BY z."倉庫ID" ORDER BY z."倉庫ID"`,
    ),
  );
  app.get("/api/ws/hokan/kubun", async () => q(`SELECT "区分ID" AS id, "区分名" AS name FROM ${商品区分} ORDER BY "区分ID"`));

  // 在庫表（Q_商品別在庫表：入庫日が今日まで・在庫ケースが 0 でない在庫を、名義・商品区分ごとにまとめる）
  app.get<{ Querystring: { soko: string } }>("/api/ws/zaikohyo", async (req) =>
    q(
      `SELECT b."分類名", z."入庫後名義ID", z."倉庫ID", z."倉庫名", z."分類ID", z."商品コード", z."商品名",
              (array_agg(z."規格" ORDER BY z."在庫ID" DESC))[1] AS "規格",
              SUM(z."繰越ケース") AS "繰越ケース", SUM(z."製造ケース") AS "製造ケース", SUM(z."出庫ケース") AS "出庫ケース", SUM(z."在庫ケース") AS "在庫ケース",
              SUM(z."繰越kg") AS "繰越kg", SUM(z."製造kg") AS "製造kg", SUM(z."出荷kg") AS "出荷kg", SUM(z."在庫kg") AS "在庫kg", SUM(z."未包装kg") AS "未包装kg",
              z."商品区分"
       FROM ${在庫} z LEFT JOIN ${商品分類} b ON b."分類ID" = z."分類ID"
       WHERE z."入庫日" <= $2::date AND z."在庫ケース" <> 0 AND z."倉庫ID" = $1
       GROUP BY b."分類名", z."入庫後名義ID", z."倉庫ID", z."倉庫名", z."分類ID", z."商品コード", z."商品名", z."商品区分"
       ORDER BY z."倉庫ID", z."商品コード"`,
      [n(req.query.soko), 今日()],
    ),
  );

  /** 保管庫詳細の在庫表示（-1＝全表示、0＝通常：40 日以内に出庫したものか在庫のあるもの、1＝現在庫） */
  const 表示の条件 = (mode: number, 商品一覧 = false) =>
    mode === -1
      ? "true"
      : mode === 1
        ? `z."在庫ケース" <> 0`
        : `(z."最終出庫日" > $9::date OR z."在庫ケース" <> 0${商品一覧 ? ` OR (z."出庫ケース" = 0 AND z."在庫ケース" = 0)` : ""})`;
  const 四十日前 = () => new Date(Date.now() + 9 * 3600 * 1000 - 40 * 86400000).toISOString().slice(0, 10);

  // 保管庫の商品の一覧（cmb_商品コード）
  app.get<{ Querystring: { soko: string; mode?: string } }>("/api/ws/hokan/shohin", async (req) => {
    const mode = Number(req.query.mode ?? 1);
    const w = 表示の条件(mode, true).replace("$9", "$2");
    const args: unknown[] = [n(req.query.soko)];
    if (w.includes("$2")) args.push(四十日前());
    return q(
      `SELECT z."商品コード" AS id, MIN(z."商品名") AS name FROM ${在庫} z WHERE z."倉庫ID" = $1 AND ${w} GROUP BY z."商品コード" ORDER BY z."商品コード"`,
      args,
    );
  });

  // 保管庫詳細の行（FM_保管庫）
  app.get<{ Querystring: { soko: string; shohin: string; mode?: string } }>("/api/ws/hokan", async (req) => {
    const mode = Number(req.query.mode ?? 1);
    const w = 表示の条件(mode).replace("$9", "$3");
    const args: unknown[] = [n(req.query.soko), n(req.query.shohin)];
    if (w.includes("$3")) args.push(四十日前());
    return q(
      `SELECT z.*, m."短縮名" AS "名義名", f."短縮名" AS "製造工場名2" FROM ${在庫} z
         LEFT JOIN ${得意先マスタ} m ON m."短縮コード" = z."入庫後名義ID"
         LEFT JOIN ${得意先マスタ} f ON f."短縮コード" = z."製造工場ID"
       WHERE z."倉庫ID" = $1 AND z."商品コード" = $2 AND ${w}
       ORDER BY z."入庫日", z."入庫No", z."在庫ID"`,
      args,
    );
  });

  // 修正（Access はパスワードで直せるようにする。削除の合言葉と同じ）
  app.post<{ Body: { 合言葉: string } }>("/api/ws/hokan/unlock", async (req, reply) => {
    const pass = process.env.JUCHU_DELETE_PASSWORD;
    if (!pass) return reply.code(400).send({ error: "合言葉がサーバーに設定されていないため、修正できません。" });
    return { ok: String(req.body.合言葉 ?? "") === pass };
  });

  // 1 つの項目を直す（Access の各項目の AfterUpdate と GokeiSum）
  app.post<{ Body: { 合言葉: string; 在庫ID: number; 項目: string; 値: unknown } }>("/api/ws/hokan/save", async (req, reply) => {
    const pass = process.env.JUCHU_DELETE_PASSWORD;
    if (!pass || String(req.body.合言葉 ?? "") !== pass) return reply.code(403).send({ error: "修正できません。［修正］を押してパスワードを入れてください。" });
    const 項目 = req.body.項目;
    if (!書ける項目.has(項目)) return reply.code(400).send({ error: "この項目は直せません" });
    return 一連で(async (c) => {
      const z = (await c.query(`SELECT * FROM ${在庫} WHERE "在庫ID" = $1 FOR UPDATE`, [n(req.body.在庫ID)])).rows[0];
      if (!z) return reply.code(404).send({ error: "この在庫はありません" });
      let 値 = req.body.値 === "" ? null : req.body.値;
      const v: Record<string, unknown> = {};
      const 入数 = n(z.入数);
      if (項目 === "繰越ケース" && 値 === null) 値 = 0;
      v[項目] = 値;
      if (項目 === "繰越ケース") v.繰越kg = n(値) * 入数;
      if (項目 === "在庫ケース") v.在庫kg = n(値) * 入数;
      if (項目 === "出庫ケース") v.出荷kg = n(値) * 入数;
      if (項目 === "製造ケース") v.製造kg = n(値) * 入数;
      if (項目 === "製造日") v.賞味期限 = await 賞味期限計算(c, 値 as string | null, z.商品コード);
      if (項目 === "入庫日") v.期 = 保管の期(値 as string | null);
      // ケース・重量を足し引きし直す（GokeiSum。Access と同じく、在庫ケースを打っても 繰越＋製造－出庫 になる）
      if (["繰越ケース", "在庫ケース", "出庫ケース", "製造ケース", "製造日"].includes(項目)) {
        const x = { ...z, ...v };
        v.在庫kg = n(x.繰越kg) + n(x.製造kg) - n(x.出荷kg);
        v.在庫ケース = n(x.繰越ケース) + n(x.製造ケース) - n(x.出庫ケース);
      }
      const cols = Object.keys(v);
      await c.query(`UPDATE ${在庫} SET ${cols.map((k, i) => `"${k}" = $${i + 2}`).join(", ")} WHERE "在庫ID" = $1`, [z.在庫ID, ...cols.map((k) => v[k])]);
      // 商品区分・賞味期限を変えたら、まだ積込確認していない出荷に知らせる（Access の ZaikoPlanChange）
      let 通知 = 0;
      if (項目 === "商品区分" || 項目 === "賞味期限") {
        const r = await c.query(
          `UPDATE ${出荷} SET "在庫ID" = $1, "認識ID" = $1::text, "通知" = '訂正', "計画変更chk" = true, "変更通知" = '数量訂正'
           WHERE "chk" = false AND "在庫ID" = $1`,
          [z.在庫ID],
        );
        通知 = r.rowCount ?? 0;
      }
      return { ok: true, 通知: 項目 === "商品区分" || 項目 === "賞味期限" ? 通知 : null };
    });
  });

  // 出荷履歴（出庫ケースのダブルクリック。Access の FSD_配送商品検索：認識ID がこの在庫の出荷）
  app.get<{ Params: { id: string } }>("/api/ws/hokan/shukka/:id", async (req) =>
    q(
      `SELECT "出庫ID", "輸送ID", "出荷日", "届け先", "倉庫名", "商品名", "ケース", "商品kg", "納品日", "chk" FROM ${出荷}
       WHERE "認識ID" = $1 ORDER BY "出荷日", "出庫ID"`,
      [String(n(req.params.id))],
    ),
  );

  // 保管庫の名前
  app.get<{ Params: { code: string } }>("/api/ws/hokan/name/:code", async (req) => {
    const r = await pool.query(`SELECT "短縮名" FROM ${得意先マスタ} WHERE "短縮コード" = $1 LIMIT 1`, [n(req.params.code)]);
    return { 短縮名: r.rows[0]?.短縮名 ?? "" };
  });
}
