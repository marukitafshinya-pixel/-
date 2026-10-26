import type { FastifyInstance } from "fastify";
import type { PoolClient } from "pg";
import { q, t, 日本の今 } from "./db.js";
import { requireUser } from "./auth.js";
import { 一連で, 賞味期限計算 } from "./ws.js";
import { 倉庫の在庫, 倉庫の出荷, 倉庫の名変, 倉庫詳細設定, 保管の期, 入庫できる, 入出庫料, 行の保管料, 在庫の初期値, 行を足す, 次の番号 } from "./soko.js";
import { 倉庫の在庫見込み } from "./sokoShukko.js";

// 倉庫管理System の名義変更（Access の FM_名義変更・ZaikoReMake・ZaikoReturn・C_名変訂正）。
// 冷蔵庫の在庫の名義を変える。変更日ごとの名変（TD_在庫変更）を作り、［登録］で元のロットから引いて、入庫できる名義なら新しいロットを作る。
const 得意先マスタ = t("kyotsu", "TM_得意先マスタ");
const 商品マスタ = t("kyotsu", "TM_商品マスタ");
const 買取単価マスタ = t("ws_fe", "TM_買取単価マスタ");
const 倉庫の受注 = t("soko", "TD_受注");

type Rec = Record<string, any>;
const n = (v: unknown) => Number(v ?? 0) || 0;
const 日付 = (v: unknown) => (v ? String(v).slice(0, 10) : null);
const 日を足す = (d: string, k: number) => new Date(Date.parse(d + "T00:00:00Z") + k * 86400000).toISOString().slice(0, 10);

/** その日を含む半月の末日（Access の HokanKijitu(日, True)） */
export function 半月の末日(d: string): string {
  if (Number(d.slice(8, 10)) <= 15) return d.slice(0, 8) + "15";
  const y = Number(d.slice(0, 4));
  const m = Number(d.slice(5, 7));
  return new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10);
}

async function 短縮名(c: PoolClient, code: unknown): Promise<string | null> {
  if (code === null || code === undefined || code === "") return null;
  return (await c.query(`SELECT "短縮名" FROM ${得意先マスタ} WHERE "短縮コード" = $1 LIMIT 1`, [n(code)])).rows[0]?.短縮名 ?? null;
}

/** 買取単価コード（Access の Sum_買取単価コード）。製造日があれば製造日の単価（計算区分 1）、なければ・合わなければ着日（変更日）以後に終わる最初の単価 */
export async function 買取単価コード(c: PoolClient, 買取先: unknown, 商品: unknown, 着日: string | null, ロット: string | null): Promise<number> {
  if (!着日) return 0;
  const rows = (await c.query(`SELECT * FROM ${買取単価マスタ} WHERE "買取先コード" = $1 AND "商品コード" = $2 ORDER BY "終了日"`, [n(買取先), n(商品)])).rows as Rec[];
  if (ロット) {
    const hit = rows.find((r) => n(r.計算区分) === 1 && 日付(r.開始日)! <= ロット && 日付(r.終了日)! >= ロット);
    if (hit) return n(hit.ID);
  }
  const hit = rows.find((r) => !(日付(r.終了日)! < 着日 || n(r.計算区分) === 1));
  return n(hit?.ID);
}

/** 在庫の変更を、まだ登録していない出庫に知らせる（Access の ZaikoPlanChange） */
async function 出庫に知らせる(c: PoolClient, 在庫ID: number): Promise<number> {
  const r = await c.query(
    `UPDATE ${倉庫の出荷} SET "在庫ID" = $1, "認識ID" = $2, "通知" = '訂正', "計画変更chk" = true, "変更通知" = '数量訂正されました。' WHERE "chk" = false AND "在庫ID" = $1`,
    [在庫ID, String(在庫ID)],
  );
  return r.rowCount ?? 0;
}

/**
 * 名変の登録（ZaikoReMake）。変更日が指定の日以前でまだ登録していない名変ごとに、元のロットから名変ケースを引き、名変の行に 出荷期数・保管料・入出庫料・買取の値・登録日 を入れる。
 * 冷蔵庫×変更後名義が入庫できれば、新しいロット（保管料負担日＝譲受人負担日、入庫No は元の入庫No の「-」の次の 1 文字までに名変回数）を作る。
 */
async function 名変を登録する(c: PoolClient, 変更日: string) {
  const rows = (await c.query(`SELECT * FROM ${倉庫の名変} WHERE "変更日" <= $1::date AND "変更Check" = false ORDER BY "変更No" FOR UPDATE`, [変更日])).rows as Rec[];
  let 知らせ = 0;
  const 今 = 日本の今();
  for (const h of rows) {
    const z = (await c.query(`SELECT * FROM ${倉庫の在庫} WHERE "在庫ID" = $1 FOR UPDATE`, [n(h.在庫No)])).rows[0];
    if (!z) continue;
    const kg = n(h.商品kg);
    const 期数 = 保管の期(z.保管料負担日, h.譲渡人負担日);
    const 買取 = await 買取単価コード(c, z.入庫後名義ID, h.商品コード, 日付(h.変更日), 日付(h.製造日));
    const 単価 = (await c.query(`SELECT "単価", "年度" FROM ${買取単価マスタ} WHERE "ID" = $1 LIMIT 1`, [買取])).rows[0];
    await c.query(
      `UPDATE ${倉庫の名変} SET "変更Check" = true, "変更前在庫数" = $2, "変更区分" = 0, "出荷期数" = $3, "保管料" = $4, "入出庫料" = $5, "買取単価コード" = $6, "買取金額" = $7,
         "支払区分" = $8, "登録日" = $9::date, "移動先ID" = 10, "移動先名" = '名義変更' WHERE "変更No" = $1`,
      [
        h.変更No, z.在庫ケース, 期数, await 行の保管料(c, z.倉庫ID, z.入庫後名義ID, h.商品コード, kg, 期数), await 入出庫料(c, z.倉庫ID, z.入庫後名義ID, h.商品コード, kg),
        買取, 単価 && h.商品kg != null && 単価.単価 != null ? Number(h.商品kg) * Number(単価.単価) : null, 単価?.年度 ?? null, 今.日付,
      ],
    );
    const 出庫 = n(z.出庫ケース) + n(h.ケース);
    const 出荷kg = 出庫 * n(h.入数);
    const 回数 = n((await c.query(`SELECT COUNT(*) AS v FROM ${倉庫の在庫} WHERE "名変前在庫ID" = $1`, [z.在庫ID])).rows[0].v) + 1;
    await c.query(
      `UPDATE ${倉庫の在庫} SET "出庫ケース" = $2, "出荷kg" = $3, "在庫ケース" = COALESCE("繰越ケース", 0) + COALESCE("製造ケース", 0) - $2::int,
         "在庫kg" = COALESCE("繰越kg", 0) + COALESCE("製造kg", 0) - $3::float8, "名変回数" = $4 WHERE "在庫ID" = $1`,
      [z.在庫ID, 出庫, 出荷kg, 回数],
    );
    知らせ += await 出庫に知らせる(c, z.在庫ID);
    if (await 入庫できる(c, h.保管庫ID, h.変更後名義ID)) {
      // 入庫No：元の入庫No の「-」の次の 1 文字までに、名変回数を付ける（例：00449126-00 → 00449126-01）
      const 元No = h.入庫No == null ? null : String(h.入庫No);
      const pos = 元No ? 元No.indexOf("-") + 1 : 0;
      const 入庫No = 元No == null ? String(回数) : 元No.slice(0, pos + 1) + String(回数);
      const 在庫ID = await 次の番号(c, 倉庫の在庫, "在庫ID");
      const g = (await c.query(`SELECT "商品名" FROM ${商品マスタ} WHERE "商品コード" = $1 LIMIT 1`, [n(h.商品コード)])).rows[0];
      await 行を足す(c, 倉庫の在庫, {
        ...在庫の初期値,
        在庫ID, 名変前在庫ID: z.在庫ID, 倉庫ID: h.保管庫ID, 倉庫名: h.保管庫名, 入庫日: z.入庫日, タグ: z.タグ, 保管料負担日: h.譲受人負担日, 期: 保管の期(h.譲受人負担日),
        入庫No, 商品コード: h.商品コード, グループ商品コード: h.商品コード, 商品名: g?.商品名 ?? null, 規格: h.規格, 入数: h.入数, 製造日: h.製造日, 賞味期限: h.賞味期限,
        製造ケース: h.ケース, 製造kg: h.商品kg, 在庫ケース: h.ケース, 在庫kg: h.商品kg, 入庫元数: h.ケース, 入庫後名義ID: h.変更後名義ID, 仮入庫No: String(h.変更No),
        製造工場ID: z.製造工場ID, 製造工場名: await 短縮名(c, z.製造工場ID), 運賃振分区分: h.変更後名義ID, 登録時間: 今.日時,
      });
    }
  }
  return { 件数: rows.length, 知らせ };
}

/** 名変を元に戻す（ZaikoReturn・C_名変訂正）。元のロットを入庫元数から出し直し（登録済みの出庫と名変）、この名変で作ったロットを消す */
async function 名変を戻す(c: PoolClient, 変更No: number) {
  const h = (await c.query(`UPDATE ${倉庫の名変} SET "変更Check" = false WHERE "変更No" = $1 RETURNING *`, [変更No])).rows[0];
  if (!h) return;
  const z = (await c.query(`SELECT * FROM ${倉庫の在庫} WHERE "在庫ID" = $1 FOR UPDATE`, [n(h.在庫No)])).rows[0];
  if (z) {
    const 出 = (await c.query(`SELECT COALESCE(SUM("ケース"), 0) AS c, COALESCE(SUM("商品kg"), 0) AS k FROM ${倉庫の出荷} WHERE "chk" = true AND "在庫ID" = $1`, [z.在庫ID])).rows[0];
    const 名 = (await c.query(`SELECT COALESCE(SUM("ケース"), 0) AS c, COALESCE(SUM("商品kg"), 0) AS k FROM ${倉庫の名変} WHERE "変更Check" = true AND "在庫No" = $1`, [z.在庫ID])).rows[0];
    const 製造 = n(z.入庫元数);
    const 製造kg = 製造 * n(z.入数);
    const 出庫 = n(出.c) + n(名.c);
    const 出荷kg = Number(出.k) + Number(名.k);
    // 新しいロットを消す前に数えるので、Access と同じく名変回数にはこれから消すロットも入る
    const 回数 = n((await c.query(`SELECT COUNT(*) AS v FROM ${倉庫の在庫} WHERE "名変前在庫ID" = $1`, [z.在庫ID])).rows[0].v);
    await c.query(
      `UPDATE ${倉庫の在庫} SET "繰越ケース" = 0, "繰越kg" = 0, "製造ケース" = $2::int, "製造kg" = $3::float8, "出庫ケース" = $4::int, "出荷kg" = $5::float8, "在庫ケース" = $2::int - $4::int, "在庫kg" = $3::float8 - $5::float8,
         "名変回数" = $6 WHERE "在庫ID" = $1`,
      [z.在庫ID, 製造, 製造kg, 出庫, 出荷kg, 回数],
    );
  }
  await c.query(`DELETE FROM ${倉庫の在庫} WHERE "在庫ID" = (SELECT MIN("在庫ID") FROM ${倉庫の在庫} WHERE "仮入庫No" = $1)`, [String(h.変更No)]);
}

export function sokoMeihenRoutes(app: FastifyInstance) {
  app.addHook("preHandler", requireUser);

  // 冷蔵庫の選択肢（在庫のある冷蔵庫と、名変のある保管庫）
  app.get("/api/soko/meihen/soko", async () =>
    q(
      `SELECT x.id, MIN(m."短縮名") AS name FROM (SELECT "倉庫ID" AS id FROM ${倉庫の在庫} WHERE "在庫ケース" <> 0 UNION SELECT "保管庫ID" FROM ${倉庫の名変}) x
       LEFT JOIN ${得意先マスタ} m ON m."短縮コード" = x.id WHERE x.id IS NOT NULL AND x.id <> 0 GROUP BY x.id ORDER BY x.id`,
    ),
  );
  app.get("/api/soko/meihen/ends", async () => (await q(`SELECT MIN("変更日")::date::text AS "最初", MAX("変更日")::date::text AS "最後" FROM ${倉庫の名変}`))[0]);

  // その変更日（と冷蔵庫）の名変（FM_名義変更：変更区分 0、商品・賞味期限・変更No の順）
  app.get<{ Querystring: { date: string; soko?: string } }>("/api/soko/meihen", async (req) => {
    const args: unknown[] = [req.query.date];
    let w = `h."変更日" = $1::date AND h."変更区分" = 0`;
    if (n(req.query.soko)) {
      args.push(n(req.query.soko));
      w += ` AND h."保管庫ID" = $2`;
    }
    return q(
      `SELECT h.*, h."変更日"::date::text AS "変更日", h."製造日"::date::text AS "製造日", h."賞味期限"::date::text AS "賞味期限",
              h."譲渡人負担日"::date::text AS "譲渡人負担日", h."譲受人負担日"::date::text AS "譲受人負担日", h."登録日"::date::text AS "登録日",
              (SELECT "短縮名" FROM ${得意先マスタ} m WHERE m."短縮コード" = h."変更前名義ID" LIMIT 1) AS "変更前名義",
              (SELECT "短縮名" FROM ${得意先マスタ} m WHERE m."短縮コード" = h."変更後名義ID" LIMIT 1) AS "変更後名義"
       FROM ${倉庫の名変} h WHERE ${w} ORDER BY h."商品コード", h."賞味期限", h."変更No"`,
      args,
    );
  });
  // 名変通知書（Access の R_名義変更通知書_縦）。変更日・保管庫の名変（変更区分 0）を、譲渡人（変更前名義）×譲受人（変更後名義）ごとに 1 枚にする。
  // 譲渡人負担日はその半月の末日、譲受人負担日はその次の日（帳票の中で計算。名変の行の負担日は使わない＝Access と同じ）。
  // 左上の番号は「mmdd-ユーザー伝票No-枝番2」を、その日・保管庫の名変の受注ごとに並べる
  app.get<{ Querystring: { date: string; soko: string } }>("/api/soko/meihen/tsuchi", async (req, reply) => {
    const 変更日 = req.query.date;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(変更日 ?? "")) return reply.code(400).send({ error: "変更日が正しくありません" });
    const soko = n(req.query.soko);
    if (!soko) return reply.code(400).send({ error: "冷蔵庫が選択されていません" });
    const 名義 = (col: string, k: string) => `(SELECT "${k}" FROM ${得意先マスタ} m WHERE m."短縮コード" = h."${col}" LIMIT 1)`;
    const rows = await q(
      `SELECT z."入庫No" AS "ユーザーコード", h."変更No", h."商品コード", h."商品名", h."規格", h."入数", h."ケース", h."商品kg", h."備考",
              h."変更前名義ID", h."変更後名義ID", z."入庫元数", z."在庫ケース",
              ${名義("変更前名義ID", "得意先名")} AS "譲渡人名", ${名義("変更前名義ID", "住所")} AS "譲渡人住所", ${名義("変更前名義ID", "郵便番号")} AS "譲渡人郵便番号",
              ${名義("変更後名義ID", "得意先名")} AS "譲受人名", ${名義("変更後名義ID", "住所")} AS "譲受人住所", ${名義("変更後名義ID", "郵便番号")} AS "譲受人郵便番号"
       FROM ${倉庫の名変} h LEFT JOIN ${倉庫の在庫} z ON z."在庫ID" = h."在庫No"
       WHERE h."変更区分" = 0 AND h."変更日" > '2016-07-01' AND h."変更日" = $1::date AND h."保管庫ID" = $2
       ORDER BY h."変更前名義ID", h."変更後名義ID", h."商品コード", h."変更No"`,
      [変更日, soko],
    );
    const 番号 = await q(
      `SELECT h."ユーザー伝票No", j."枝番2" FROM ${倉庫の名変} h LEFT JOIN ${倉庫の受注} j ON j."受注ID" = h."受注ID"
       WHERE h."変更日" = $1::date AND h."保管庫ID" = $2 GROUP BY h."ユーザー伝票No", j."枝番2", j."枝番3" ORDER BY 1, 2`,
      [変更日, soko],
    );
    const 保管庫 = (await q(`SELECT "得意先名" FROM ${得意先マスタ} WHERE "短縮コード" = $1 LIMIT 1`, [soko]))[0]?.得意先名 ?? null;
    const 組 = new Map<string, Rec[]>();
    for (const r of rows) {
      const k = `${r.変更前名義ID}|${r.変更後名義ID}`;
      if (!組.has(k)) 組.set(k, []);
      組.get(k)!.push(r);
    }
    const 譲渡人負担日 = 半月の末日(変更日);
    return {
      変更日, 保管庫, 譲渡人負担日, 譲受人負担日: 日を足す(譲渡人負担日, 1),
      受注番号: 番号.filter((x) => (x.ユーザー伝票No ?? "") !== "").map((x) => `${変更日.slice(5, 7)}${変更日.slice(8, 10)}-${x.ユーザー伝票No}-${x.枝番2 ?? ""}`),
      組: [...組.values()],
    };
  });
  // 変更後名義の選択肢（その保管庫の名変に出てくる名義。2 以上）
  app.get<{ Querystring: { soko: string } }>("/api/soko/meihen/meigi", async (req) =>
    q(
      `SELECT h."変更後名義ID" AS id, MIN(m."短縮名") AS name FROM ${倉庫の名変} h LEFT JOIN ${得意先マスタ} m ON m."短縮コード" = h."変更後名義ID"
       WHERE h."変更後名義ID" > 1 AND h."保管庫ID" = $1 GROUP BY h."変更後名義ID" ORDER BY 1`,
      [n(req.query.soko)],
    ),
  );

  // 名変の項目を直す（各項目の AfterUpdate と同じ）。登録済み（変更Check）の行はケースなどを直せない
  app.post<{ Body: { 変更No: number; 項目: string; 値: unknown; 変更日?: string; 連動?: boolean } }>("/api/soko/meihen/save", async (req, reply) => {
    const 項目 = req.body.項目;
    if (!["変更後名義ID", "ケース", "製造日", "賞味期限", "譲渡人負担日", "譲受人負担日", "受注ID", "変更日", "備考"].includes(項目)) return reply.code(400).send({ error: "この項目は直せません" });
    return 一連で(async (c) => {
      const h = (await c.query(`SELECT * FROM ${倉庫の名変} WHERE "変更No" = $1 FOR UPDATE`, [n(req.body.変更No)])).rows[0];
      if (!h) return reply.code(404).send({ error: "この名変はありません" });
      let 値: any = req.body.値 === "" ? null : req.body.値;
      if (["変更後名義ID", "ケース", "受注ID"].includes(項目) && 値 !== null) 値 = Math.trunc(Number(値));
      if (h.変更Check === true && 項目 === "ケース") return reply.code(400).send({ error: "登録済みのデータを訂正する場合、訂正ボタンをクリックしてから数字訂正してください。" });
      const v: Rec = { [項目]: 値 };
      if (項目 === "変更後名義ID" && n(値) === 629 && req.body.変更日 && ["01", "16"].includes(req.body.変更日.slice(8, 10))) {
        // 本社名義（629）へ 1 日・16 日に名変するときは、前の半月で切る
        v.譲渡人負担日 = 半月の末日(日を足す(req.body.変更日, -1));
        v.譲受人負担日 = 日を足す(v.譲渡人負担日, 1);
      }
      if (項目 === "ケース") v.商品kg = 値 == null || h.入数 == null ? null : 値 * Number(h.入数);
      if (項目 === "製造日" && !h.賞味期限) v.賞味期限 = await 賞味期限計算(c, 日付(値), h.商品コード);
      // 譲渡人負担日は「変更します、よろしいですか？」で OK のときだけ譲受人負担日も変える
      if (項目 === "譲渡人負担日" && 値 && req.body.連動 !== false) v.譲受人負担日 = 日を足す(半月の末日(String(値)), 1);
      if (項目 === "受注ID") {
        const j = (await c.query(`SELECT "受注番号", "受注元ID" FROM ${倉庫の受注} WHERE "受注ID" = $1 LIMIT 1`, [n(値)])).rows[0];
        Object.assign(v, { ユーザー伝票No: j?.受注番号 ?? null, 取引元ID: j?.受注元ID ?? null, 取引元: await 短縮名(c, j?.受注元ID) });
      }
      const k = Object.keys(v);
      await c.query(`UPDATE ${倉庫の名変} SET ${k.map((x, i) => `"${x}" = $${i + 2}`).join(", ")} WHERE "変更No" = $1`, [h.変更No, ...k.map((x) => v[x])]);
      return { ok: true };
    });
  });

  // 名変を消す（登録済みは消せない）
  app.post<{ Body: { 変更No: number } }>("/api/soko/meihen/delete", async (req, reply) => {
    const r = await q(`DELETE FROM ${倉庫の名変} WHERE "変更No" = $1 AND "変更Check" = false RETURNING 1`, [n(req.body.変更No)]);
    if (!r.length) return reply.code(400).send({ error: "変更済みの為、削除出来ません。" });
    return { ok: true };
  });

  // ［検索］：冷蔵庫・商品の在庫の見込み（自動名変の設定があるロットは「mm/dd 名変予定」）
  app.get<{ Querystring: { soko?: string; shohin?: string } }>("/api/soko/meihen/zaiko", async (req) =>
    一連で(async (c) => {
      const rows = await 倉庫の在庫見込み(c, n(req.query.shohin), n(req.query.soko));
      for (const r of rows) {
        const 設定 = (
          await c.query(`SELECT "自動名変" FROM ${倉庫詳細設定} WHERE "短縮コード" = $1 AND "名義コード" = $2 AND "商品コード" = $3 ORDER BY "ID" LIMIT 1`, [
            n(r.倉庫ID), n(r.入庫後名義ID), n(r.商品コード),
          ])
        ).rows[0];
        if (設定?.自動名変 === true && r.入庫日) {
          const z = (await c.query(`SELECT "サービス区分" FROM ${倉庫の在庫} WHERE "在庫ID" = $1`, [n(r.認識ID)])).rows[0];
          const 次 = 日を足す(半月の末日(r.入庫日), 1);
          const 日 = z?.サービス区分 === true ? 日を足す(半月の末日(次), 1) : 次;
          r.通知 = `${日.slice(5, 7)}/${日.slice(8, 10)} 名変予定`;
        }
        r.入庫名義 = await 短縮名(c, r.入庫後名義ID);
      }
      const 順 = (x: unknown) => (x == null ? "" : String(x));
      return rows.sort((x, y) => 順(x.賞味期限).localeCompare(順(y.賞味期限)) || 順(x.タグ).localeCompare(順(y.タグ)) || 順(x.入庫日).localeCompare(順(y.入庫日)) || 順(x.製造日).localeCompare(順(y.製造日)) || 順(x.入庫No).localeCompare(順(y.入庫No)) || n(x.商品コード) - n(y.商品コード));
    }),
  );
  // 選んだ在庫の名変を作る（倉庫データ抽出）。ケースは在庫ケースのまま、変更後名義は自動名変の設定の名義（なければ 0）、譲渡人負担日はその半月の末日
  app.post<{ Body: { 変更日: string; soko?: number; shohin?: number; 選んだ: string[] } }>("/api/soko/meihen/add", async (req, reply) => {
    const 変更日 = req.body.変更日;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(変更日 ?? "")) return reply.code(400).send({ error: "変更日が正しくありません" });
    return 一連で(async (c) => {
      const all = await 倉庫の在庫見込み(c, n(req.body.shohin), n(req.body.soko));
      let 件数 = 0;
      for (const id of req.body.選んだ ?? []) {
        const z = all.find((r) => r.認識ID === String(id));
        if (!z) continue;
        const 変更後 = n((await c.query(`SELECT "自動変更後名義ID" AS v FROM ${倉庫詳細設定} WHERE "自動名変" = true AND "短縮コード" = $1 ORDER BY "ID" LIMIT 1`, [n(z.倉庫ID)])).rows[0]?.v);
        const 譲渡人 = 半月の末日(変更日);
        const 元 = (await c.query(`SELECT "買取単価コード" FROM ${倉庫の在庫} WHERE "在庫ID" = $1`, [n(z.認識ID)])).rows[0];
        const 変更No = await 次の番号(c, 倉庫の名変, "変更No");
        await 行を足す(c, 倉庫の名変, {
          変更No, 変更日, 商品コード: z.商品コード, 商品名: z.商品名, 規格: z.規格, 入数: z.入数, ケース: z.在庫ケース, 商品kg: z.在庫kg, 製造日: z.製造日,
          賞味期限: z.賞味期限 ?? (await 賞味期限計算(c, z.製造日, z.商品コード)), 変更前名義ID: z.入庫後名義ID, 産地コード: z.産地コード, 取引元ID: 629, 取引元: await 短縮名(c, 629),
          変更後名義ID: 変更後, 譲渡人負担日: 譲渡人, 譲受人負担日: 日を足す(譲渡人, 1),
          備考: `${変更日.slice(5, 7)}月${変更日.slice(8, 10)}日 名変買取\r\n(${(await 短縮名(c, z.入庫後名義ID)) ?? ""}→ ${(await 短縮名(c, 変更後)) ?? ""} に名変)`,
          保管庫ID: z.倉庫ID, 保管庫名: z.倉庫名, 入庫No: z.入庫No, 在庫No: n(z.認識ID), 移動先ID: 10, 移動先名: "名義変更", 買取単価コード: n(元?.買取単価コード),
          買取chk: n(元?.買取単価コード) !== 0, 変更区分: 0, 変更Check: false, 抽出区分: false, 確認chk: false, 支払区分: null, 買取金額: 0, 変更前在庫数: 0,
        });
        件数++;
      }
      return { 件数 };
    });
  });

  // ［登録］：変更日まで登録する
  app.post<{ Body: { 変更日: string } }>("/api/soko/meihen/register", async (req, reply) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(req.body.変更日 ?? "")) return reply.code(400).send({ error: "変更日が正しくありません" });
    return 一連で((c) => 名変を登録する(c, req.body.変更日));
  });
  // ［訂正］：1 行を元に戻す（登録済みのときだけ）
  app.post<{ Body: { 変更No: number } }>("/api/soko/meihen/return", async (req, reply) =>
    一連で(async (c) => {
      const h = (await c.query(`SELECT "変更Check" FROM ${倉庫の名変} WHERE "変更No" = $1`, [n(req.body.変更No)])).rows[0];
      if (!h?.変更Check) return reply.code(400).send({ error: "登録していない名変です。" });
      await 名変を戻す(c, n(req.body.変更No));
      return { ok: true };
    }),
  );
  // ［全訂正］：その日（と冷蔵庫）に出ている名変を全部元に戻す
  app.post<{ Body: { 変更No: number[] } }>("/api/soko/meihen/return-all", async (req) =>
    一連で(async (c) => {
      for (const id of req.body.変更No ?? []) await 名変を戻す(c, n(id));
      return { ok: true };
    }),
  );
}
