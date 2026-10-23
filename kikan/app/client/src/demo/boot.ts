// 見本版のはじまり：ブラウザの中にデータベースを作り、サーバーの処理を登録してから、いつもの画面を出す
import schema from "./schema.sql?raw";
import serverSchema from "../../../server/schema.sql?raw";
import data from "./data.sql?raw";
import { はじめる } from "./db";
import { fakeApp, fetchを回す } from "./fakeServer";

// サーバーの合言葉（見本版では demo）
(globalThis as any).process = { env: { JUCHU_DELETE_PASSWORD: "demo", JUCHU_EDIT_PASSWORD: "demo", JUCHU_MASTER_PASSWORD: "demo", MASTER_PASSWORD: "demo" } };

// Artifacts の画面では alert・confirm・prompt の窓が出ない（confirm はいつも「いいえ」になる）。
// 見本版では、知らせをページの右下に出し、確かめる窓はいつも OK、入力の窓は初めの値（合言葉は demo）で進める。
function 知らせ(text: string, kind: "info" | "ok") {
  let box = document.getElementById("demo-toasts");
  if (!box) {
    box = document.createElement("div");
    box.id = "demo-toasts";
    box.style.cssText = "position:fixed;right:12px;bottom:12px;display:flex;flex-direction:column;gap:6px;z-index:9999;max-width:420px";
    document.body.appendChild(box);
  }
  const el = document.createElement("div");
  el.textContent = text;
  el.style.cssText = `white-space:pre-line;background:${kind === "ok" ? "#e8f4ff" : "#fff8d8"};color:#222;border:1px solid #888;border-radius:4px;padding:8px 10px;font-size:13px;box-shadow:0 2px 6px rgba(0,0,0,.25);cursor:pointer`;
  el.onclick = () => el.remove();
  box.appendChild(el);
  setTimeout(() => el.remove(), 7000);
}
window.alert = (m?: any) => 知らせ(String(m ?? ""), "info");
window.confirm = (m?: string) => (知らせ(`${m ?? ""}\n→ 見本版では OK で進めます`, "ok"), true);
window.prompt = (m?: string, d?: string) => {
  const v = d !== undefined && d !== "" ? d : "demo";
  知らせ(`${m ?? ""}\n→ 見本版では「${v}」を入れて進めます`, "ok");
  return v;
};
window.open = ((u?: string | URL) => (知らせ(`見本版では、別の窓（${String(u ?? "")}）は開けません。`, "info"), null)) as any;

const pad = (n: number) => String(n).padStart(2, "0");
const d = new Date();
const 今日 = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

async function main() {
  const db = await はじめる();
  await db.exec(schema);
  await db.exec(serverSchema);
  await db.exec(`CREATE FUNCTION demo_day(int) RETURNS timestamp LANGUAGE sql AS $$ SELECT (DATE '${今日}' + $1)::timestamp $$;`);
  await db.exec(data);

  const [{ authRoutes }, juchu, juchuForm, hanmori, sb, hacchu, juchuMaster, find, ws, wsZaiko, wsJuchu, wsHokan, wsNenkan, wsHoukoku, wsChohyo, wsSekisai, wsPallet, wsKoshin, wsHibetsu, wsYotei, wsTeishi, wsKensa, wsZaikoPallet, wsHaichi, wsMasters, wsOsaka, wsChushutsu, keikaku, seizo, housou, tehai, master, sakujo] = await Promise.all([
    import("../../../server/auth"),
    import("../../../server/juchu"),
    import("../../../server/juchuForm"),
    import("../../../server/hanmori"),
    import("../../../server/sb"),
    import("../../../server/hacchu"),
    import("../../../server/juchuMaster"),
    import("../../../server/find"),
    import("../../../server/ws"),
    import("../../../server/wsZaiko"),
    import("../../../server/wsJuchu"),
    import("../../../server/wsHokan"),
    import("../../../server/wsNenkan"),
    import("../../../server/wsHoukoku"),
    import("../../../server/wsChohyo"),
    import("../../../server/wsSekisai"),
    import("../../../server/wsPallet"),
    import("../../../server/wsKoshin"),
    import("../../../server/wsHibetsu"),
    import("../../../server/wsYotei"),
    import("../../../server/wsTeishi"),
    import("../../../server/wsKensa"),
    import("../../../server/wsZaikoPallet"),
    import("../../../server/wsHaichi"),
    import("../../../server/wsMasters"),
    import("../../../server/wsOsaka"),
    import("../../../server/wsChushutsu"),
    import("../../../server/keikaku"),
    import("../../../server/seizo"),
    import("../../../server/housou"),
    import("../../../server/tehai"),
    import("../../../server/master"),
    import("../../../server/sakujo"),
  ]);
  authRoutes(fakeApp);
  juchu.juchuRoutes(fakeApp);
  juchuForm.juchuFormRoutes(fakeApp);
  hanmori.hanmoriRoutes(fakeApp);
  sb.sbRoutes(fakeApp);
  hacchu.hacchuRoutes(fakeApp);
  juchuMaster.juchuMasterRoutes(fakeApp);
  find.findRoutes(fakeApp);
  ws.wsRoutes(fakeApp);
  wsZaiko.wsZaikoRoutes(fakeApp);
  wsJuchu.wsJuchuRoutes(fakeApp);
  wsHokan.wsHokanRoutes(fakeApp);
  wsNenkan.wsNenkanRoutes(fakeApp);
  wsHoukoku.wsHoukokuRoutes(fakeApp);
  wsChohyo.wsChohyoRoutes(fakeApp);
  wsSekisai.wsSekisaiRoutes(fakeApp);
  wsPallet.wsPalletRoutes(fakeApp);
  wsKoshin.wsKoshinRoutes(fakeApp);
  wsHibetsu.wsHibetsuRoutes(fakeApp);
  wsYotei.wsYoteiRoutes(fakeApp);
  wsTeishi.wsTeishiRoutes(fakeApp);
  wsKensa.wsKensaRoutes(fakeApp);
  wsZaikoPallet.wsZaikoPalletRoutes(fakeApp);
  wsHaichi.wsHaichiRoutes(fakeApp);
  wsMasters.wsMastersRoutes(fakeApp);
  wsOsaka.wsOsakaRoutes(fakeApp);
  wsChushutsu.wsChushutsuRoutes(fakeApp);
  keikaku.keikakuRoutes(fakeApp);
  seizo.seizoRoutes(fakeApp);
  housou.housouRoutes(fakeApp);
  tehai.tehaiRoutes(fakeApp);
  master.masterRoutes(fakeApp);
  sakujo.sakujoRoutes(fakeApp);
  fetchを回す();

  const banner = document.getElementById("demo-banner")!;
  banner.textContent = "見本版：作り物のデータで動いています。直した内容はページを閉じると消えます。合言葉（パスワード）は demo です。";
  banner.style.cssText = "background:#fff3b0;color:#333;padding:4px 10px;font-size:13px;border-bottom:1px solid #c9b25a";
  await import("../main");
}

main().catch((e) => {
  console.error(e);
  document.getElementById("root")!.innerHTML = `<p style="padding:40px;color:#900">見本版を準備できませんでした：${String(e?.message ?? e)}</p>`;
});
