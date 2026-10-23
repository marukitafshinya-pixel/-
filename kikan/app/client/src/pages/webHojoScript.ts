// 相手先サイトへの入力の補助（ブックマークに登録して、elixxi・ランテックの画面で押す小さなプログラム）。
// Access の C_elixxi入庫登録Ver2・C_elixxi出庫出力Ver2・C_ランテック出力Ver2 が Edge に打ち込んでいたのと同じ欄に、同じ順で入れる。最後の［登録］は人が押す。
// 基幹システムで「…入力用にコピー」を押すと、頭に「KIKAN-WEB:」を付けた中身がクリップボードに入る。それを読む。
// ［確定］で画面が読み直されても続きから入れられるように、途中の状態をそのタブの sessionStorage に置く（10 分で捨てる）。
// ログインは人がする（ID・パスワードはここに入れない）。

export const 目印 = "KIKAN-WEB:";

/** クリップボードに入れる文字（種類は 入庫 / 出庫〈elixxi〉・ランテック） */
export const 入力用の文字 = (種類: "入庫" | "出庫" | "入庫訂正" | "ランテック", 中身: Record<string, any>) => 目印 + JSON.stringify({ ...中身, 種類 });

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
  if (d && d.種類 !== "入庫訂正" && (d.種類 === "ランテック" || !欄(明細の欄(d)))) d = null;
  // 入庫訂正の途中の状態は 30 分まで。新しく始めたいときは、ここで捨てられる
  const 検索の画面 = () => 欄("cndJoken2") && !document.getElementsByName("sho_maisai_1").length && !欄("nyukoYoteiKosu");
  if (d && d.種類 === "入庫訂正" && (Date.now() - d.時刻 > 1800000 || (検索の画面() && !confirm("受付番号 " + d.受付番号 + " の訂正の続きをします。\\n\\n［キャンセル］を押すと、続きはやめて、新しくコピーした中身で始めます。")))) {
    sessionStorage.removeItem(KEY);
    d = null;
  }
  if (!d) {
    let t = "";
    try { t = await navigator.clipboard.readText(); } catch (e) {}
    if (!t.startsWith("${目印}")) t = prompt("基幹システムで「…入力用にコピー」を押してから、ここに貼り付けて［OK］を押してください。") || "";
    if (!t.startsWith("${目印}")) { if (t) alert("基幹システムの「…入力用にコピー」の中身ではありません。"); return; }
    d = JSON.parse(t.slice(${目印.length}));
    d.段 = "見出し";
  }
  if (d.種類 === "入庫訂正") {
    // C_elixxi入庫訂正登録：受付番号を変えないために、今の行は残したまま品名を「削除」に書き換え、新しい明細を続きに足して登録し、
    // そのあと一覧で「削除」の行だけを取り消す（Access は一覧の上から n 行を取り消していたので、品名で選ぶように直した）。
    // 押すたびに、開いている画面を見て次の段を行う。［登録］と［依頼取消］は人が押す
    const 置く = () => { d.時刻 = Date.now(); sessionStorage.setItem(KEY, JSON.stringify(d)); };
    try {
      const 編集中 = 欄("nyukoYoteiKosu") && 欄("hinmei");
      const 一覧 = document.getElementsByName("sho_maisai_1");
      if (d.段 !== "取消" && 編集中) {
        // 依頼修正の画面：今の行の品名を「削除」に（入庫予定個数が空の行まで）→ 続きに新しい明細
        let k = 0;
        while (欄("nyukoYoteiKosu", k) && String(欄("nyukoYoteiKosu", k).value || "").trim() !== "" && String(欄("nyukoYoteiKosu", k).value).trim() !== "0") {
          入れる("hinmei", "削除", k);
          k++;
        }
        if (k === 0) throw new Error("今の行が見つかりません。受付番号 " + d.受付番号 + " の依頼修正の画面か確かめてください。");
        let 個 = 0;
        for (let i = 0; i < d.明細.length; i++) {
          const x = d.明細[i];
          入れる("shohinCD", x.商品CD, k + i);
          入れる("hinmei", x.品名, k + i);
          入れる("mark", x.マーク, k + i);
          入れる("nyukoYoteiKosu", x.入庫予定個数, k + i);
          入れる("seizoDT", x.製造日, k + i);
          入れる("shomikigenDT", x.賞味期限, k + i);
          個 += Number(x.入庫予定個数 || 0);
          await 待つ(1000);
        }
        d.段 = "取消";
        d.削除数 = k;
        置く();
        alert("今の " + k + " 行の品名を「削除」にし、新しい明細 " + d.明細.length + " 件（合計 " + 個 + " 個）を足しました。\\n\\n画面を確認して［登録］を押してください。\\n\\nそのあと一覧に戻り、もう一度このボタンを押すと、「削除」の行にチェックを付けます。");
        return;
      }
      if (d.段 === "取消" && 一覧.length) {
        // 一覧：品名が「削除」の行だけにチェック（並び順では選ばない）
        const 削除の行 = [...一覧].filter((c) => { const tr = c.closest("tr"); return tr && /(^|\\s)削除(\\s|$)/.test(tr.innerText || tr.textContent || ""); });
        if (削除の行.length !== d.削除数) throw new Error("「削除」の行が " + 削除の行.length + " 行ありました（" + d.削除数 + " 行のはず）。チェックは付けていません。画面を見て、手で取り消してください。");
        for (const c of 一覧) if (c.checked) c.click();
        for (const c of 削除の行) c.click();
        sessionStorage.removeItem(KEY);
        alert("「削除」の " + 削除の行.length + " 行にチェックを付けました。\\n\\nほかの行にチェックが付いていないか確かめて、［依頼取消］を押してください。");
        return;
      }
      if (d.段 === "修正" && 一覧.length) {
        // 受付番号で抽出した一覧：1 件目にチェックして［依頼修正］
        一覧[0].click();
        置く();
        押す("iraishusei");
        return;
      }
      if (欄("cndJoken2") && 欄("sel_kyoten")) {
        // 入庫依頼一覧の検索：寄託者・拠点・条件「受付番号」で抽出
        if (d.寄託者 && 欄("sel_ninushiGroup")) { 選ぶ("sel_ninushiGroup", d.寄託者); await 待つ(3000); }
        選ぶ("sel_kyoten", d.拠点コード);
        await 待つ(3000);
        選ぶ("cndJoken2", "3");
        入れる("cndJokenValue2", d.受付番号);
        d.段 = "修正";
        置く();
        押す("chushutsu");
        await 待つ(2000);
        if (document.getElementsByName("sho_maisai_1").length) { document.getElementsByName("sho_maisai_1")[0].click(); 置く(); 押す("iraishusei"); }
        return;
      }
      throw new Error("elixxi の「入庫依頼一覧」の画面を開いてから押してください。");
    } catch (e) {
      alert("入力を止めました。\\n\\n" + e.message);
    }
    return;
  }
  if (d.種類 === "ランテック") {
    // C_ランテック出力Ver2：Angular の画面。Access と同じ欄・同じ場所（XPath）に入れ、Enter を送り、入ったかを読み返す
    const X = (p) => document.evaluate(p, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue;
    const 要る = (e, what) => { if (!e) throw new Error(what + "が見つかりません。ランテックの画面が変わったかもしれません。"); return e; };
    const エンター = (e) => { for (const t of ["keydown", "keypress", "keyup"]) e.dispatchEvent(new KeyboardEvent(t, { key: "Enter", code: "Enter", keyCode: 13, which: 13, bubbles: true })); };
    const 打つ = (e, v) => { e.focus(); e.value = String(v ?? ""); e.dispatchEvent(new Event("input", { bubbles: true })); e.dispatchEvent(new Event("change", { bubbles: true })); };
    const 日付 = (v) => { const m = String(v || "").match(/(\\d{4})\\D(\\d{1,2})\\D(\\d{1,2})/); return m ? m[1] + "/" + m[2].padStart(2, "0") + "/" + m[3].padStart(2, "0") : String(v || ""); };
    const 表 = "/html/body/app-root/app-bus/div/div/main/app-order-edit/form/igx-tabs/div/div[2]/div/igx-tabs-group/igx-card/app-order-edit-tab-sendto/form/main";
    const 行 = (n) => 表 + "/div/igx-grid/div[2]/div[1]/igx-display-container/igx-grid-row[" + n + "]/igx-display-container";
    const 行2 = (n) => "//*[@id='igx-grid-0']/div[2]/div[1]/igx-display-container/igx-grid-row[" + n + "]/igx-display-container";
    try {
      const 元 = 欄("textInputCdSendfrom");
      if (!元) throw new Error("ランテックにログインして、新規発注の画面を開いてから押してください。");
      打つ(元, d.発送元コード); await 待つ(2000); エンター(元);
      打つ(要る(document.getElementsByName("igxInput")[0], "出荷日の欄"), d.出荷日); await 待つ(500);
      const 先 = 要る(欄("textInputCdSendto"), "お届け先の欄");
      打つ(先, d.お届け先コード); await 待つ(2000); エンター(先);
      打つ(要る(document.getElementsByName("igxInput")[1], "お届け希望日の欄"), d.お届け希望日);
      await 待つ(300);
      // 入ったかを読み返す（Access と同じ知らせ。お届け希望日の違いも「届け先コード 登録エラー」と出るのは Access のまま）
      let 誤り = "";
      if (Number(d.発送元コード) !== Number(欄("textInputCdSendfrom").value)) 誤り += "倉庫ID登録エラー\\n";
      if (d.出荷日 !== 日付(document.getElementsByName("igxInput")[0].value)) 誤り += "出荷計画日 登録エラー\\n";
      if (Number(d.お届け先コード) !== Number(欄("textInputCdSendto").value)) 誤り += "届け先コード 登録エラー\\n";
      if (d.お届け希望日 !== 日付(document.getElementsByName("igxInput")[1].value)) 誤り += "届け先コード 登録エラー\\n";
      if (誤り) throw new Error("※※※※　入力失敗　※※※\\n\\n" + 誤り);
      if (d.備考1) 打つ(要る(X("//*[@id='igx-input-group-10']/div[1]/div/input"), "備考1の欄"), d.備考1);
      if (d.備考2) 打つ(要る(X("//*[@id='igx-input-group-11']/div[1]/div/input"), "備考2の欄"), d.備考2);
      await 待つ(2000);
      要る(X(表), "明細の表").click();
      要る(X(行(1) + "/igx-grid-cell[3]"), "明細の 1 行目").click();
      let 個 = 0;
      for (let n = 1; n <= d.明細.length; n++) {
        const x = d.明細[n - 1];
        要る(X(行(n) + "/igx-grid-cell[3]"), "明細の " + n + " 行目").click();
        await 待つ(500);
        if (n === 1) エンター(要る(X(行2(n) + "/igx-grid-cell[3]"), "明細の 1 行目"));
        await 待つ(500);
        打つ(要る(X(行(n) + "/igx-grid-cell[3]/div/igx-input-group/div[1]/div/input"), "商品CD の欄（" + n + " 行目）"), x.商品CD);
        await 待つ(500);
        エンター(要る(X(行2(n) + "/igx-grid-cell[9]"), "ケースの欄（" + n + " 行目）"));
        await 待つ(500);
        const k = 要る(X(行(n) + "/igx-grid-cell[9]/div/igx-input-group/div[1]/div/input"), "ケースの欄（" + n + " 行目）");
        打つ(k, x.ケース);
        個 += Number(x.ケース || 0);
        await 待つ(1000);
        if (Number(k.value) !== Number(x.ケース)) throw new Error("※※※※　入力失敗　※※※\\n\\n個数 登録エラー（" + n + " 行目）");
      }
      alert("出力完了!\\n\\n" + d.明細.length + " 件・合計 " + 個 + " 個\\n\\n画面を確認して、［登録］を押してください。");
    } catch (e) {
      alert("入力を止めました。\\n\\n" + e.message);
    }
    return;
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
