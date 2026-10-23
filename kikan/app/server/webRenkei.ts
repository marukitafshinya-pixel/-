import type { FastifyInstance } from "fastify";
import { q } from "./db.js";
import { requireUser } from "./auth.js";
import { 暗号にする, 元に戻す, 鍵がある } from "./himitsu.js";

// WEB連携の相手先サイトの設定（Access の FM_UP管理〈TM_WebM〉・FM_Webアドレス管理〈M_Webアドレス操作〉）。
// Access の値（ID・パスワード・住所）は写さない。Web 版で入れ直す（パスワードは暗号にして保存し、画面には出さない）。
const サイト表 = `app."外部サイト"`;
const ログイン表 = `app."外部サイトのログイン"`;

/** 直すときの合言葉（Access はプログラムに書いた番号。Web 版はマスタ管理の合言葉 MASTER_PASSWORD） */
const 合言葉が合う = (v: unknown) => !!process.env.MASTER_PASSWORD && String(v ?? "") === process.env.MASTER_PASSWORD;

/** サーバーの中だけで使う：そのサイトのログイン（利用者のものがなければ全員で使うもの） */
export async function ログイン情報(サイト: string, 利用者: string): Promise<{ ログインID: string; パスワード: string; 寄託者: string } | null> {
  const r = (
    await q(`SELECT * FROM ${ログイン表} WHERE "サイト" = $1 AND "利用者" IN ($2, '') ORDER BY "利用者" = '' LIMIT 1`, [サイト, 利用者])
  )[0];
  if (!r) return null;
  return { ログインID: r.ログインID, パスワード: r.パスワード暗号 ? 元に戻す(r.パスワード暗号) : "", 寄託者: r.寄託者 };
}

export function webRenkeiRoutes(app: FastifyInstance) {
  app.addHook("preHandler", requireUser);

  // サイトとログインの一覧（パスワードは「入っているか」だけ）
  app.get("/api/web/sites", async () => ({
    サイト: await q(`SELECT * FROM ${サイト表} ORDER BY "並び", "サイト"`),
    ログイン: await q(
      `SELECT "サイト", "利用者", "ログインID", "寄託者", "パスワード暗号" <> '' AS "パスワードあり", to_char("更新日時" AT TIME ZONE 'Asia/Tokyo', 'YYYY/MM/DD HH24:MI') AS "更新日時", "更新者"
       FROM ${ログイン表} ORDER BY "サイト", "利用者"`,
    ),
    利用者: await q(`SELECT login AS id, name FROM app.users WHERE NOT disabled ORDER BY login`),
    鍵: 鍵がある(),
  }));
  app.post<{ Body: { 合言葉: string } }>("/api/web/unlock", async (req, reply) => {
    if (!process.env.MASTER_PASSWORD) return reply.code(400).send({ error: "合言葉がサーバーに設定されていないため、直せません。" });
    return { ok: 合言葉が合う(req.body.合言葉) };
  });
  // サイトの名前・住所・備考
  app.post<{ Body: { 合言葉: string; サイト: string; 項目: string; 値: string } }>("/api/web/sites/save", async (req, reply) => {
    if (!合言葉が合う(req.body.合言葉)) return reply.code(403).send({ error: "直せません。［修正］を押して合言葉を入れてください。" });
    if (!["名前", "住所", "備考"].includes(req.body.項目)) return reply.code(400).send({ error: "この欄は直せません" });
    await q(`UPDATE ${サイト表} SET "${req.body.項目}" = $2 WHERE "サイト" = $1`, [req.body.サイト, String(req.body.値 ?? "")]);
    return { ok: true };
  });
  // ログインを入れる・直す（パスワードを空で送ると、前のパスワードのまま）
  app.post<{ Body: { 合言葉: string; サイト: string; 利用者?: string; ログインID: string; パスワード?: string; 寄託者?: string } }>("/api/web/login/save", async (req, reply) => {
    if (!合言葉が合う(req.body.合言葉)) return reply.code(403).send({ error: "直せません。［修正］を押して合言葉を入れてください。" });
    const 利用者 = String(req.body.利用者 ?? "");
    const 暗号 = req.body.パスワード ? 暗号にする(req.body.パスワード) : null;
    if (!暗号 && !鍵がある()) return reply.code(400).send({ error: "暗号の鍵（WEB_RENKEI_KEY）がサーバーに設定されていないため、保存できません。" });
    await q(
      `INSERT INTO ${ログイン表} ("サイト", "利用者", "ログインID", "パスワード暗号", "寄託者", "更新日時", "更新者") VALUES ($1, $2, $3, COALESCE($4, ''), $5, now(), $6)
       ON CONFLICT ("サイト", "利用者") DO UPDATE SET "ログインID" = EXCLUDED."ログインID", "寄託者" = EXCLUDED."寄託者",
         "パスワード暗号" = COALESCE($4, ${ログイン表}."パスワード暗号"), "更新日時" = now(), "更新者" = EXCLUDED."更新者"`,
      [req.body.サイト, 利用者, String(req.body.ログインID ?? ""), 暗号, String(req.body.寄託者 ?? ""), req.user?.login ?? ""],
    );
    return { ok: true };
  });
  app.post<{ Body: { 合言葉: string; サイト: string; 利用者: string } }>("/api/web/login/delete", async (req, reply) => {
    if (!合言葉が合う(req.body.合言葉)) return reply.code(403).send({ error: "直せません。［修正］を押して合言葉を入れてください。" });
    await q(`DELETE FROM ${ログイン表} WHERE "サイト" = $1 AND "利用者" = $2`, [req.body.サイト, String(req.body.利用者 ?? "")]);
    return { ok: true };
  });
}
