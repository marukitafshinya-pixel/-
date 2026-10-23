// elixxi 入力の補助（ブックマークに登録して、elixxi の画面で押す小さなプログラム）。
// Access の C_elixxi入庫登録Ver2・C_elixxi出庫出力Ver2 が Edge に打ち込んでいたのと同じ欄に、同じ順で入れる。最後の［登録］は人が押す。
// 基幹システムで「elixxi 入力用にコピー」を押すと、頭に「KIKAN-ELIXXI:」を付けた中身がクリップボードに入る。それを読む。
// ［確定］で画面が読み直されても続きから入れられるように、途中の状態をそのタブの sessionStorage に置く（10 分で捨てる）。
// ログインは人がする（ID・パスワードはここに入れない）。

export const 目印 = "KIKAN-ELIXXI:";

/** クリップボードに入れる文字（種類は 入庫 / 出庫） */
export const 入力用の文字 = (種類: "入庫" | "出庫", 中身: Record<string, any>) => 目印 + JSON.stringify({ ...中身, 種類 });

const 本体 = `(async () => {
  const KEY = "kikan-elixxi";
  const 待つ = (ms) => new Promise((r) => setTimeout(r, ms));
  const 欄 = (n, i = 0) => document.getElementsByName(n)[i];
  const ない = (n) => new Error("欄「" + n + "」が見つかりません。elixxi の画面が変わったかもしれません。");
  const 入れる = (n, v, i = 0) => {
    const e = 欄(n, i);
    if (!e) throw ない(n);
    e.focus();
    e.value = String(v ?? "");
    e.dispatchEvent(new Event("input", { bubbles: true }));
    e.dispatchEvent(new Event("change", { bubbles: true }));
    e.blur();
  };
  const 選ぶ = (n, v) => {
    const e = 欄(n);
    if (!e) throw ない(n);
    if (![...e.options].some((o) => o.value === String(v))) throw new Error("「" + n + "」に「" + v + "」がありません。");
    e.value = String(v);
    e.dispatchEvent(new Event("change", { bubbles: true }));
  };
  const 押す = (n, i = 0) => {
    const e = 欄(n, i);
    if (!e) throw ない(n);
    e.click();
  };
  let d = null;
  try {
    const s = JSON.parse(sessionStorage.getItem(KEY) || "null");
    if (s && Date.now() - s.時刻 < 600000) d = s;
  } catch (e) {}
  const 明細の欄 = (x) => (x.種類 === "入庫" ? "shohinCD" : "nyukoNo");
  if (d && !欄(明細の欄(d))) d = null;
  if (!d) {
    let t = "";
    try { t = await navigator.clipboard.readText(); } catch (e) {}
    if (!t.startsWith("${目印}")) t = prompt("基幹システムで「elixxi 入力用にコピー」を押してから、ここに貼り付けて［OK］を押してください。") || "";
    if (!t.startsWith("${目印}")) { if (t) alert("基幹システムの「elixxi 入力用にコピー」の中身ではありません。"); return; }
    d = JSON.parse(t.slice(${目印.length}));
    d.段 = "見出し";
  }
  try {
    if (d.段 === "見出し") {
      if (!欄("sel_kyoten")) throw new Error("elixxi にログインして「" + (d.種類 === "入庫" ? "入庫依頼登録" : "出庫依頼登録") + "」の画面を開いてから押してください。");
      if (d.寄託者 && 欄("sel_ninushiGroup")) { 選ぶ("sel_ninushiGroup", d.寄託者); await 待つ(3000); }
      document.getElementById("id_kyoten_select")?.click();
      選ぶ("sel_kyoten", d.拠点コード);
      await 待つ(d.種類 === "入庫" ? 3000 : 2000);
      if (d.種類 === "入庫") {
        入れる("cndNyukoDT", d.入庫日);
        入れる("cndAtsukaibinRN", d.扱い便名);
      } else {
        入れる("cndShukkoDT", d.出庫日);
        入れる("cndNohinDT", d.納品日);
        if (d.依頼No) 入れる("cndIraiNo", d.依頼No);
        if (d.摘要) 入れる("cndTekiyo", d.摘要);
        入れる("cndShukkosakiCD", d.出庫先コード);
        入れる("cndShukkosakiRN", d.出庫先名);
        if (d.扱い便コード) 入れる("cndAtsukaibinCD", d.扱い便コード);
        入れる("cndAtsukaibinRN", d.扱い便名);
      }
      d.段 = "明細";
      d.時刻 = Date.now();
      sessionStorage.setItem(KEY, JSON.stringify(d));
      押す("kakutei");
      // 画面が読み直されたら、ここで止まる。明細の欄が出てから、もう一度押すと続きから入れる
      for (let k = 0; k < 20 && !欄(明細の欄(d)); k++) await 待つ(250);
      if (!欄(明細の欄(d))) { alert("［確定］しました。明細の欄が出たら、もう一度このボタンを押してください。"); return; }
      await 待つ(1000);
    }
    sessionStorage.removeItem(KEY);
    let 個 = 0;
    for (let i = 0; i < d.明細.length; i++) {
      const x = d.明細[i];
      if (d.種類 === "入庫") {
        入れる("shohinCD", x.商品CD, i);
        入れる("hinmei", x.品名, i);
        入れる("mark", x.マーク, i);
        入れる("nyukoYoteiKosu", x.入庫予定個数, i);
        入れる("seizoDT", x.製造日, i);
        入れる("shomikigenDT", x.賞味期限, i);
        個 += Number(x.入庫予定個数 || 0);
        await 待つ(500);
      } else {
        入れる("nyukoNo", x.入庫No, i);
        入れる("shukkoKosu", x.出庫個数, i);
        押す("haritsuke", i);
        個 += Number(x.出庫個数 || 0);
        await 待つ(1000);
      }
    }
    alert((d.種類 === "入庫" ? "入庫" : "出庫") + "の入力が終わりました。\\n\\n" + d.明細.length + " 件・合計 " + 個 + " 個\\n\\n画面を確認して、［登録］を押してください。");
  } catch (e) {
    sessionStorage.removeItem(KEY);
    alert("入力を止めました。\\n\\n" + e.message);
  }
})();`;

/** ブックマークに登録する文字（javascript: で始まる） */
export const ブックマーク = "javascript:" + encodeURIComponent(本体);
/** 試験用：そのまま動かせる本体 */
export const 補助の本体 = 本体;
