import type { FastifyInstance } from "fastify";
import { pool, q, t, 日本の今 } from "./db.js";
import { requireUser } from "./auth.js";
import { 一連で, 賞味期限計算 } from "./ws.js";
import { 確認用を作る } from "./wsTeishi.js";

// 丸北WorkStation の在庫表（Access の FM_商品別在庫・Q_商品別在庫表）と保管庫詳細（FM_保管庫）
const 在庫 = t("ws", "TD_在庫");
const 出荷 = t("ws", "TD_出荷");
const 得意先マスタ = t("kyotsu", "TM_得意先マスタ");
const 商品分類 = t("juchu_fe", "TD_商品分類");
const 商品区分 = t("ws_fe", "TM_商品区分");
const 在庫変更 = t("ws", "TD_在庫変更");
const 商品振替 = t("ws_fe", "TM_商品振替");
const 商品マスタ = t("kyotsu", "TM_商品マスタ");

const n = (v: unknown) => Number(v ?? 0) || 0;
const 今日 = () => new Date(Date.now() + 9 * 3600 * 1000).toISOString().slice(0, 10);

/** 保管期間の期（Access の Hokan期。半月ごとに数える） */
export function 保管の期(入庫日: string | null, 基準日 = 今日()): number {
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

  // ---------------- 在庫振替（Access の FSD_在庫訂正・FS_在庫訂正）。保管庫詳細の「振替」から ----------------

  app.get<{ Params: { id: string } }>("/api/ws/furikae/:id", async (req, reply) => {
    const z = (
      await pool.query(
        `SELECT z.*, m."短縮名" AS "名義名" FROM ${在庫} z LEFT JOIN ${得意先マスタ} m ON m."短縮コード" = z."入庫後名義ID" WHERE z."在庫ID" = $1`,
        [n(req.params.id)],
      )
    ).rows[0];
    if (!z) return reply.code(404).send({ error: "この在庫はありません" });
    const rows = await q(`SELECT * FROM ${在庫変更} WHERE "在庫No" = $1 AND "変更区分" <> 0 ORDER BY "変更日", "変更No" DESC`, [z.在庫ID]);
    const 振替先 = await q(`SELECT "ID" AS id, "振替先" AS name, "備考" FROM ${商品振替} ORDER BY "ID"`);
    return { 在庫: z, rows, 振替先, 今日: 今日() };
  });

  /** 数量から重さ（商品マスタの入数）と、在庫の名前・日付を入れる（Access の ケース_AfterUpdate） */
  async function 数量の値(c: { query: typeof pool.query }, z: Record<string, any>, ケース: number) {
    const 入数 = n((await c.query(`SELECT "入数" FROM ${商品マスタ} WHERE "商品コード" = $1 LIMIT 1`, [n(z.商品コード)])).rows[0]?.入数);
    return { ケース, 商品kg: ケース * 入数, 商品名: z.商品名, 保管庫名: z.倉庫名, 製造日: z.製造日, 賞味期限: z.賞味期限 };
  }

  // 新しい行（まだ登録しない）
  app.post<{ Body: { 在庫ID: number; 変更日: string; ケース: number; 移動先ID: number; 備考?: string } }>("/api/ws/furikae/add", async (req, reply) => {
    const b = req.body;
    return 一連で(async (c) => {
      const z = (await c.query(`SELECT * FROM ${在庫} WHERE "在庫ID" = $1`, [n(b.在庫ID)])).rows[0];
      if (!z) return reply.code(404).send({ error: "この在庫はありません" });
      const 先 = (await c.query(`SELECT "振替先" FROM ${商品振替} WHERE "ID" = $1`, [n(b.移動先ID)])).rows[0];
      await c.query(`SELECT pg_advisory_xact_lock(hashtext('TD_在庫変更.変更No'))`);
      const no = n((await c.query(`SELECT COALESCE(MAX("変更No"), 0) + 1 AS n FROM ${在庫変更}`)).rows[0].n);
      const v: Record<string, unknown> = {
        変更No: no, 在庫No: z.在庫ID, Set_ID: 0, 変更日: b.変更日 || 今日(), 保管庫ID: z.倉庫ID, 商品コード: z.商品コード, 規格: z.規格, 入数: 0,
        ...(await 数量の値(c, z, n(b.ケース))), 移動先ID: n(b.移動先ID), 移動先名: 先?.振替先 ?? null, 備考: b.備考 || null,
        変更前名義ID: 0, 変更後名義ID: 0, 変更区分: 1, 変更Check: false, 変更前在庫数: 0, 出荷期数: 0, 保管料: 0, 入出庫料: 0, 出荷伝票No: 0,
        抽出区分: false, 支払区分: 0, 買取単価コード: 0, 買取金額: 0, 買取chk: false,
      };
      const keys = Object.keys(v);
      await c.query(`INSERT INTO ${在庫変更} (${keys.map((k) => `"${k}"`).join(", ")}) VALUES (${keys.map((_, i) => `$${i + 1}`).join(", ")})`, keys.map((k) => v[k]));
      return { 変更No: no };
    });
  });

  // まだ登録していない行を直す（数量・振替先・変更日・備考）
  app.post<{ Body: { 変更No: number; 項目: string; 値: unknown } }>("/api/ws/furikae/save", async (req, reply) => {
    const { 項目 } = req.body;
    if (!["ケース", "移動先ID", "変更日", "備考"].includes(項目)) return reply.code(400).send({ error: "この項目は直せません" });
    return 一連で(async (c) => {
      const h = (await c.query(`SELECT * FROM ${在庫変更} WHERE "変更No" = $1 FOR UPDATE`, [n(req.body.変更No)])).rows[0];
      if (!h) return reply.code(404).send({ error: "この行はありません" });
      if (h.変更Check) return reply.code(400).send({ error: "登録済みの行は直せません。" });
      const z = (await c.query(`SELECT * FROM ${在庫} WHERE "在庫ID" = $1`, [h.在庫No])).rows[0] ?? {};
      const 値 = req.body.値 === "" ? null : req.body.値;
      let v: Record<string, unknown> = { [項目]: 値 };
      if (項目 === "ケース") v = await 数量の値(c, z, n(値));
      if (項目 === "移動先ID") v.移動先名 = (await c.query(`SELECT "振替先" FROM ${商品振替} WHERE "ID" = $1`, [n(値)])).rows[0]?.振替先 ?? null;
      const cols = Object.keys(v);
      await c.query(`UPDATE ${在庫変更} SET ${cols.map((k, i) => `"${k}" = $${i + 2}`).join(", ")} WHERE "変更No" = $1`, [h.変更No, ...cols.map((k) => v[k])]);
      return { ok: true };
    });
  });

  // 登録（Access の cmd_登録_Click）：在庫から数量を引き、製品化・原料化・出荷停止なら別の在庫の行として振り替える
  app.post<{ Body: { 変更No: number } }>("/api/ws/furikae/toroku", async (req, reply) => {
    return 一連で(async (c) => {
      const h = (await c.query(`SELECT * FROM ${在庫変更} WHERE "変更No" = $1 FOR UPDATE`, [n(req.body.変更No)])).rows[0];
      if (!h) return reply.code(404).send({ error: "この行はありません" });
      // Access では登録済みの行をもう一度登録でき、在庫が二重に引かれてしまう。Web 版では止める
      if (h.変更Check) return reply.code(400).send({ error: "この行は登録済みです。" });
      const z = (await c.query(`SELECT * FROM ${在庫} WHERE "在庫ID" = $1 FOR UPDATE`, [h.在庫No])).rows[0];
      if (!z) return reply.code(404).send({ error: "この在庫はありません" });
      await c.query(`SELECT pg_advisory_xact_lock(hashtext('TD_在庫.在庫ID'))`);
      // 製品化（7）・原料化（8）・出荷停止（9）は、在庫の行を写して商品区分を変える（Access の C_在庫振替。写すのは振り替える前の数）
      if ([7, 8, 9].includes(n(h.移動先ID))) {
        const 後 = n((await c.query(`SELECT "振替後商品区分" FROM ${商品振替} WHERE "ID" = $1`, [n(h.移動先ID)])).rows[0]?.振替後商品区分);
        const 前の名 = (await c.query(`SELECT "区分名" FROM ${商品区分} WHERE "区分ID" = $1`, [n(z.商品区分)])).rows[0]?.区分名 ?? "";
        const d = String(h.変更日 ?? 今日());
        const v: Record<string, unknown> = {
          商品区分: 後, 変更前在庫ID: z.在庫ID, 作成日付: h.変更日, 倉庫ID: z.倉庫ID, 倉庫名: z.倉庫名, 商品コード: z.商品コード, 商品名: z.商品名,
          規格: z.規格, 入数: z.入数, 製造日: z.製造日, 賞味期限: z.賞味期限, 入庫日: z.入庫日, 入庫ID: z.入庫ID, 入庫元数: z.在庫ケース,
          製造ケース: z.製造ケース, 製造kg: z.製造kg, 繰越ケース: z.繰越ケース, 繰越kg: z.繰越kg, 出庫ケース: z.出庫ケース, 出荷kg: z.出荷kg,
          在庫ケース: z.在庫ケース, 在庫kg: z.在庫kg,
          管理備考: `${Number(d.slice(5, 7))}/${Number(d.slice(8, 10))}付 ${前の名}から変更\r\n${z.管理備考 ?? ""}`,
          検査区分: z.検査区分, タグ: z.タグ, カードカラーコード: z.カードカラーコード, 産地コード: n(z.産地コード), 製造工場ID: z.倉庫ID, 製造工場名: z.倉庫名,
          最終出庫日: z.最終出庫日, 入庫後名義ID: z.入庫後名義ID,
        };
        let 先 = (await c.query(`SELECT "在庫ID" FROM ${在庫} WHERE "変更前在庫ID" = $1 ORDER BY "在庫ID" LIMIT 1`, [z.在庫ID])).rows[0]?.在庫ID;
        if (!先) {
          先 = n((await c.query(`SELECT COALESCE(MAX("在庫ID"), 0) + 1 AS n FROM ${在庫}`)).rows[0].n);
          await c.query(
            `INSERT INTO ${在庫} ("在庫ID", "短縮コード", "期", "出庫回数", "サービス区分", "未包装kg", "抽出区分", "出荷止め区分", "グループコード",
               "入庫区分", "ストック数", "訂正chk", "買取金額", "買取単価コード", "買取chk", "支払区分", "検査結果", "手配元ID", "手配帳合ID",
               "大阪発注確認chk", "検体区分", "指定最終届け先コード", "検体取得", "パレット積載数", "合否判定ID", "登録時間")
             VALUES ($1, 0, 0, 0, false, 0, false, false, 0, false, 0, false, 0, 0, false, 0, 0, 0, 0, false, false, 0, false, 0, 0, $2)`,
            [先, 日本の今().日時.replace(/\//g, "-")],
          );
        }
        const cols = Object.keys(v);
        await c.query(`UPDATE ${在庫} SET ${cols.map((k, i) => `"${k}" = $${i + 2}`).join(", ")} WHERE "在庫ID" = $1`, [先, ...cols.map((k) => v[k])]);
      }
      // もとの在庫から引く
      const 出庫ケース = n(z.出庫ケース) + n(h.ケース);
      const 出荷kg = n(z.出荷kg) + n(h.商品kg);
      await c.query(
        `UPDATE ${在庫} SET "出庫ケース" = $2, "出荷kg" = $3, "在庫ケース" = $4, "在庫kg" = $5 WHERE "在庫ID" = $1`,
        [z.在庫ID, 出庫ケース, 出荷kg, n(z.繰越ケース) + n(z.製造ケース) - 出庫ケース, n(z.繰越kg) + n(z.製造kg) - 出荷kg],
      );
      // まだ積込確認していない出荷に知らせる（ZaikoPlanChange）
      const r = await c.query(
        `UPDATE ${出荷} SET "認識ID" = $1::text, "通知" = '訂正', "計画変更chk" = true, "変更通知" = '数量訂正' WHERE "chk" = false AND "在庫ID" = $1`,
        [z.在庫ID],
      );
      await c.query(`UPDATE ${在庫変更} SET "変更Check" = true, "商品コード" = $2 WHERE "変更No" = $1`, [h.変更No, z.商品コード]);
      // 出荷停止に振り替えたときは、もとの在庫の行もその日の出荷停止在庫一覧に出す（Access の「出荷停止確認の為、変更を表示させる」）
      if (n(h.移動先ID) === 9) await 確認用を作る(c, 0, String(h.変更日 ?? 今日()).slice(0, 10), z.在庫ID);
      return { 通知: r.rowCount ?? 0 };
    });
  });
}
