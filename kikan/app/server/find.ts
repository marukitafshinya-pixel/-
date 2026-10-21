import type { FastifyInstance } from "fastify";
import { q, t } from "./db.js";
import { requireUser } from "./auth.js";

// 共通の探す画面（Access の FSD_得意先選択・FSD_商品名選択）
const 得意先マスタ = t("juchu_fe", "TM_得意先マスタ");
const 商品マスタ = t("juchu_fe", "TM_商品マスタ");
const 商品分類 = t("juchu_fe", "TD_商品分類");
const 原料マスタ = t("juchu_fe", "TM_原料マスタ");
const 地区コード = t("juchu_fe", "TM_地区コード");
const グループマスタ = t("ws_fe", "TM_グループマスタ");
const 運送会社マスタ = t("ws_fe", "TM_運送会社マスタ");
const イベント = t("ws_fe", "TM_イベントスケジュール");

const 曜日 = "日月火水木金土";
const ymd = (d: Date) => `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;

/** カナの範囲（"ｱ-ｵ" や "ｲ"）を、ｶﾅ分類の先頭の文字の条件にする。Access の Like '[ｱ-ｵ]*' と同じ */
function カナ条件(kana: string | undefined): string | null {
  if (!kana) return null;
  if (!/^[ｦ-ﾝ](-[ｦ-ﾝ])?$/.test(kana)) return null;
  return `^[${kana}]`;
}

/** 並べ替えに使ってよい項目 */
const 商品の並び = new Set(["ｶﾅ分類", "商品コード", "本社コード", "商品名", "規格", "分類名"]);
const 得意先の並び = new Set(["ｶﾅ分類", "短縮コード", "得意先名", "短縮名", "住所"]);
/** 商品の文字で探す項目（Access の cmb_検索リスト） */
const 商品の検索項目 = new Set(["商品名", "短縮名", "規格", "取引先名", "本社コード", "グループ商品コード"]);

export function findRoutes(app: FastifyInstance) {
  app.addHook("preHandler", requireUser);

  // 選ぶ欄の一覧（商品：分類・原料、得意先：地区・グループ・グループマスタ）
  app.get("/api/find/lists", async () => ({
    分類: await q(`SELECT "分類ID" AS "id", "分類名" AS "name" FROM ${商品分類} ORDER BY "分類ID"`),
    原料: await q(`SELECT "原料分類ID" AS "id", MIN("原料分類") AS "name" FROM ${原料マスタ} GROUP BY "原料分類ID" ORDER BY "原料分類ID"`),
    地区: await q(`SELECT "地区コード" AS "id", MIN("地区名") AS "name" FROM ${地区コード} GROUP BY "地区コード" ORDER BY "地区コード"`),
    グループ: await q(
      `SELECT g."グループコード" AS "id", (SELECT "短縮名" FROM ${得意先マスタ} m WHERE m."短縮コード" = g."グループコード" LIMIT 1) AS "name"
       FROM ${得意先マスタ} g WHERE g."グループコード" <> 0 GROUP BY g."グループコード" ORDER BY COUNT(*)`,
    ),
    グループマスタ: await q(`SELECT "グループID" AS "id", "グループ名" AS "name" FROM ${グループマスタ} ORDER BY "グループID"`),
  }));

  // 地区を選んだときの都道府県
  app.get<{ Querystring: { chiku: string } }>("/api/find/pref", async (req) =>
    q(
      `SELECT "都道府県名" AS "name" FROM ${地区コード} WHERE "地区コード" = $1 GROUP BY "都道府県名" ORDER BY MIN("都道府県コード")`,
      [Number(req.query.chiku)],
    ),
  );

  // 商品（FSD_商品名選択）
  app.get<{ Querystring: Record<string, string | undefined> }>("/api/find/shohin", async (req) => {
    const p = req.query;
    const where: string[] = [];
    const args: unknown[] = [];
    const add = (sql: string, v: unknown) => {
      args.push(v);
      where.push(sql.replace("?", `$${args.length}`));
    };
    const kana = カナ条件(p.kana);
    if (kana) add(`s."ｶﾅ分類" ~ ?`, kana);
    if (p.bunrui) add(`s."分類ID" = ?`, Number(p.bunrui));
    if (p.genryo) add(`s."原料コード" = ?`, Number(p.genryo));
    if (p.w) {
      const col = 商品の検索項目.has(p.col ?? "") ? p.col! : "商品名";
      if (col === "グループ商品コード") add(`s."グループ商品コード" = ?`, Number(p.w) || -1);
      else add(`s."${col}"::text LIKE ?`, `%${p.w}%`);
    }
    if (p.old === "1") where.push(`s."旧会社コード区分" = true`);
    const sort = 商品の並び.has(p.sort ?? "") ? p.sort! : "商品コード";
    return q(
      `SELECT s."商品コード" AS "コード", s."ｶﾅ分類", s."本社コード", s."短縮名", s."商品名", s."取引先名", s."規格", b."分類名"
       FROM ${商品マスタ} s LEFT JOIN ${商品分類} b ON b."分類ID" = s."分類ID"
       ${where.length ? "WHERE " + where.join(" AND ") : ""}
       ORDER BY "${sort}", s."商品コード" LIMIT 1000`,
      args,
    );
  });

  // 得意先（FSD_得意先選択）
  app.get<{ Querystring: Record<string, string | undefined> }>("/api/find/tokui", async (req) => {
    const p = req.query;
    const where: string[] = [];
    const args: unknown[] = [];
    const add = (sql: string, v: unknown) => {
      args.push(v);
      where.push(sql.replace("?", `$${args.length}`));
    };
    const kana = カナ条件(p.kana);
    if (kana) add(`"ｶﾅ分類" ~ ?`, kana);
    if (p.w) {
      // 名前の一部、または短縮コードそのもので探す（Access は得意先名だけ。コードでも探せるようにした）
      args.push(`%${p.w}%`, p.w);
      where.push(`("得意先名" LIKE $${args.length - 1} OR "短縮名" LIKE $${args.length - 1} OR "短縮コード"::text = $${args.length})`);
    }
    if (p.group) add(`"グループコード" = ?`, Number(p.group));
    if (p.group3) add(`"グループコード3" = ?`, Number(p.group3));
    if (p.chiku) add(`"地区コード"::text = ?`, String(p.chiku));
    if (p.pref) add(`"住所" LIKE ?`, `%${p.pref}%`);
    // 保管：2＝倉庫で出荷元、3＝倉庫で出荷元でない
    if (p.hokan === "2") where.push(`"倉庫区分" = true AND "出荷元区分" = true`);
    if (p.hokan === "3") where.push(`"倉庫区分" = true AND "出荷元区分" = false`);
    const sort = 得意先の並び.has(p.sort ?? "") ? p.sort! : "ｶﾅ分類";
    return q(
      `SELECT "短縮コード" AS "コード", "ｶﾅ分類", "短縮名", "得意先名", "住所", "電話番号"
       FROM ${得意先マスタ} ${where.length ? "WHERE " + where.join(" AND ") : ""}
       ORDER BY "${sort}", "短縮コード" LIMIT 1000`,
      args,
    );
  });

  // 運送会社（FSD_運送会社選択）
  app.get<{ Querystring: Record<string, string | undefined> }>("/api/find/unso", async (req) => {
    const p = req.query;
    const where: string[] = [];
    const args: unknown[] = [];
    const kana = カナ条件(p.kana);
    if (kana) {
      args.push(kana);
      where.push(`"カナ分類" ~ $${args.length}`);
    }
    if (p.w) {
      args.push(`%${p.w}%`, p.w);
      where.push(`("短縮名" LIKE $${args.length - 1} OR "運送会社名" LIKE $${args.length - 1} OR "運送会社ID"::text = $${args.length})`);
    }
    const sort = ["カナ分類", "運送会社ID", "短縮名", "住所"].includes(p.sort ?? "") ? p.sort! : "運送会社ID";
    return q(
      `SELECT "運送会社ID" AS "コード", "カナ分類", "短縮名", "住所", "電話番号" FROM ${運送会社マスタ}
       ${where.length ? "WHERE " + where.join(" AND ") : ""} ORDER BY "${sort}", "運送会社ID" LIMIT 1000`,
      args,
    );
  });

  // カレンダー（Access の FSD_日付選択。祝日・休日は TM_イベントスケジュール と C_CalenderScadule と同じ決め方）
  app.get<{ Querystring: { year: string; month: string } }>("/api/calendar", async (req) => {
    const y = Number(req.query.year);
    const m = Number(req.query.month);
    const ev = await q<any>(`SELECT * FROM ${イベント} ORDER BY "ID"`);
    const first = new Date(Date.UTC(y, m - 1, 1));
    const start = new Date(first.getTime() - first.getUTCDay() * 86400000); // 月初めの週の日曜日から 42 日
    const 予定 = (d: Date): string => {
      const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
      const dd = String(d.getUTCDate()).padStart(2, "0");
      let name = "";
      // 春分の日（3/20・3/21 を計算で）
      if (d.getUTCMonth() === 2 && (d.getUTCDate() === 20 || d.getUTCDate() === 21)) {
        const yy = d.getUTCFullYear();
        const syun = Math.floor(20.8431 + 0.242194 * (yy - 1980)) - Math.floor((yy - 1980) / 4);
        if (syun === d.getUTCDate()) name = "春分の日";
      }
      // 決まった日の祝日
      const fixed = ev.find((e) => e.分類項目 === "祝日" && e.開始日 === `${mm}/${dd}`);
      if (fixed) name = fixed.件名;
      // 第何週の何曜日（成人の日・第 2・第 4 土曜の休日など）。週は表示している月の 1 日から 7 日ずつ数える
      const diff = Math.round((d.getTime() - first.getTime()) / 86400000);
      const week = Math.trunc(diff / 7) + 1;
      const w = ev.find(
        (e) => e.分類項目 === "祝日" && Number(e.特定月) === d.getUTCMonth() + 1 && Number(e.特定週) === week && e.特定曜日 === 曜日[d.getUTCDay()],
      );
      if (w) name += w.件名;
      // 会社の特定の休み
      const sp = ev.find((e) => e.分類項目 === "特定休日" && e.開始日 === `${d.getUTCFullYear()}/${mm}/${dd}`);
      if (sp) name += sp.件名;
      return name;
    };
    const days: { date: string; label: string; inMonth: boolean; holiday: string; color: "red" | "blue" | "black"; underline: boolean }[] = [];
    let 振替 = false;
    for (let i = 0; i < 42; i++) {
      const d = new Date(start.getTime() + i * 86400000);
      const inMonth = d.getUTCMonth() === m - 1;
      const name = 予定(d);
      let color: "red" | "blue" | "black" = d.getUTCDay() === 0 ? "red" : d.getUTCDay() === 6 ? "blue" : "black";
      let holiday = name;
      if (name) {
        color = "red";
        if (d.getUTCDay() === 0) 振替 = true;
      } else if (振替) {
        color = "red";
        holiday = "振替休日";
        振替 = false;
      }
      days.push({
        date: ymd(d),
        label: inMonth ? String(d.getUTCDate()) : `${d.getUTCMonth() + 1}月${d.getUTCDate()}日`,
        inMonth,
        holiday,
        color,
        underline: !!name,
      });
    }
    return days;
  });
}
