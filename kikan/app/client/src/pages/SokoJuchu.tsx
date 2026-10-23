import { useEffect, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { api, ApiError, num } from "../api";
import { CalendarDialog, Field, parseDate } from "../formParts";

type Rec = Record<string, any>;
type ボタン = { id: number; name: string | null };
const 月日 = (v: string | null | undefined) => (v ? `${Number(v.slice(5, 7))}月${Number(v.slice(8, 10))}日` : "");
const pad = (n: number) => String(n).padStart(2, "0");
const エラー = (e: unknown) => alert(e instanceof ApiError ? e.message : String(e));
const 斜め = (d: string) => d.replace(/-/g, "/");

/**
 * ロット逆転の確認（Access の C_届け先賞味期限ロット逆転防止。受注分在庫出力から呼ぶので理由は聞かない）。true＝逆転（選ばない）
 * mode=meihen は名変の写しで比べる（C_名変用届け先賞味期限ロット逆転防止）
 */
async function ロット逆転(todoke: number, shohin: number, nouhin: string | null, kigen: string | null, mode: "shukka" | "meihen"): Promise<boolean> {
  if (!kigen && mode === "shukka") return false;
  const L = await api.get<Rec>("/api/soko/juchu/lot", { todoke: String(todoke), shohin: String(shohin), nouhin: nouhin ?? "", mode });
  if (mode === "shukka" && L.特別) alert("この届け先・商品は、運賃を登録後、品管に報告してください");
  if (L.納品日なし) {
    alert("納品日が入力されてないので比較できません、前回ロットを表示します");
    return false;
  }
  if (!L.前回 || !kigen) return false;
  if (kigen < L.前回) {
    if (!confirm(`ロット逆転！！！！\n選択された賞味期限は前回より古いものです！\n\n前回賞味期限 ${斜め(L.前回)}\n\n今回賞味期限 ${斜め(kigen)}\nロットが逆転しますがよろしいですか！？`)) return true;
    if (!confirm("ロットが逆転しますが、本当によろしいですね？！")) return true;
    return false;
  }
  if (L.次回 && L.次回 < kigen && nouhin && confirm("先の納品日にロット逆転が発生しますが、よろしいですか？")) {
    await api.post("/api/soko/juchu/lot-mark", { todoke, shohin, nouhin, kigen });
    alert(`${斜め(nouhin)} 以降の納品にロット逆転が発生していますので確認お願いします。`);
  }
  return false;
}

/**
 * 受注検索（Access の 倉庫管理の F_受注検索）。出庫入力の［受注表示］から開く。
 * 検索方法 → ボタンで扱い先・受注元・受注先・届け先 → 納品日 の順に絞り、受注を選んで、出荷場所（出庫場所）の在庫を割り付けてこの便に出庫の行を作る。
 */
export function SokoJuchu() {
  const nav = useNavigate();
  const [sp] = useSearchParams();
  const 輸送ID = Number(sp.get("id"));
  const [bin, setBin] = useState<Rec | null>(null);
  const [methods, setMethods] = useState<ボタン[]>([]);
  const [方法, set方法] = useState(0);
  const [表題, set表題] = useState("検索方法を選択して下さい。");
  const [buttons, setButtons] = useState<ボタン[] | null>(null);
  const [入れる先, set入れる先] = useState<"moto" | "saki" | "todoke">("moto");
  const [次, set次] = useState(0);
  const [cond, setCond] = useState({ moto: 0, saki: 0, todoke: 0, d1: "", d2: "", toitsu: "", jid: "", shohin: 0 });
  const [日付欄, set日付欄] = useState(false);
  const [番号欄, set番号欄] = useState<"" | "toitsu" | "jid">("");
  const [商品欄, set商品欄] = useState(false);
  const [soko, setSoko] = useState<number | null>(null);
  const [rows, setRows] = useState<Rec[]>([]);
  const [cal, setCal] = useState(false);
  const [rireki, setRireki] = useState<Rec[] | null>(null);
  const [在庫画面, set在庫画面] = useState<null | { z: Rec; resolve: (v: Rec[] | null) => void }>(null);
  const 積込No = useRef(0);

  useEffect(() => {
    api.post("/api/soko/juchu/open", {}).catch(() => alert("受注データの更新が出来ませでした。"));
    api.get<ボタン[]>("/api/soko/juchu/methods").then(setMethods);
    if (輸送ID)
      api.get<Rec>(`/api/soko/shukko/bin/${輸送ID}`).then((r) => {
        setBin(r.便);
        setSoko(r.便.出庫場所ID ?? null);
      });
  }, [輸送ID]);

  const 一覧 = async (c = cond) =>
    setRows(await api.get<Rec[]>("/api/soko/juchu/list", { moto: String(c.moto || ""), saki: String(c.saki || ""), todoke: String(c.todoke || ""), d1: c.d1, d2: c.d2, toitsu: c.toitsu, jid: c.jid, shohin: String(c.shohin || "") }));
  const 並び = async (kind: number, c = cond, last = 0) => setButtons(await api.get<ボタン[]>("/api/soko/juchu/buttons", { kind: String(kind), moto: String(c.moto), saki: String(c.saki), last: String(last) }));

  function クリア() {
    const c = { moto: 0, saki: 0, todoke: 0, d1: "", d2: "", toitsu: "", jid: "", shohin: 0 };
    setCond(c);
    setButtons(null);
    set日付欄(false);
    set番号欄("");
    set商品欄(false);
    setRows([]);
    set表題("検索方法を選択して下さい。");
    return c;
  }
  // 検索方法を選ぶ（flm_検索区分_AfterUpdate）
  async function 方法を選ぶ(id: number) {
    const c = クリア();
    set方法(id);
    if (id === 1 || id === 2) {
      await 並び(0, c);
      set表題("丸北の取扱い区分を選択して下さい。");
      set入れる先("moto");
      set次(id === 1 ? 1 : 11);
    } else if (id === 3) {
      await 並び(12, c);
      set表題("ユーザーを選択して下さい。");
      set入れる先("moto");
      set次(2);
    } else if (id === 4 || id === 5) {
      set表題(id === 4 ? "検索する発注Noを入力してください。" : "検索する丸北の受注IDを入力してください。");
      set番号欄(id === 4 ? "toitsu" : "jid");
    } else if (id === 6) {
      set表題("検索する商品コードを入力してください。");
      set商品欄(true);
    }
  }
  // ボタンを押す（Flm_受注元選択_AfterUpdate → C_検索ボタン配列切替）
  async function ボタンを押す(b: ボタン) {
    const c = { ...cond, [入れる先]: b.id };
    setCond(c);
    if (次 === 1) {
      await 並び(1, c, b.id);
      set表題("ユーザーを選択して下さい。");
      set入れる先("moto");
      set次(2);
    } else if (次 === 2) {
      await 並び(2, c, b.id);
      set表題("受注先を選択して下さい。");
      set入れる先("saki");
      set次(13);
    } else if (次 === 11) {
      await 並び(11, c, b.id);
      set表題("受注先を選択して下さい。");
      set入れる先("moto");
      set次(13);
    } else if (次 === 13) {
      await 並び(13, c, b.id);
      set表題("届け先を選択して下さい。");
      set入れる先("todoke");
      set次(4);
    } else if (次 === 4) {
      setButtons(null);
      set表題("納品日を選択して下さい。");
      set日付欄(true);
    }
  }
  async function 納品日(d1: string, d2: string, 更新 = false) {
    const c = { ...cond, d1, d2 };
    setCond(c);
    await 一覧(c);
    if (更新) await 最新();
    set表題("出荷場所を選択して下さい。");
  }
  function 月(m: number) {
    const y = new Date().getFullYear();
    納品日(`${y}-${pad(m)}-01`, `${y}-${pad(m)}-${pad(new Date(y, m, 0).getDate())}`);
  }
  async function 最新(list = rows) {
    await api.post("/api/soko/juchu/refresh", { 受注ID: list.map((r) => r.受注ID) });
    await 一覧();
  }

  // 1 件の受注を割り付ける（C_受注在庫読込 → My出庫出力）
  async function 割り付ける(r: Rec) {
    const z = await api.get<Rec>("/api/soko/juchu/zaiko", { jid: String(r.受注ID), soko: String(soko ?? 0) });
    const j = z.受注;
    let 選んだ: Rec[] | undefined;
    if (!z.重量) {
      if (!confirm(`${j.商品名} の在庫がありません。直接出力しますか?`)) return;
    } else {
      if (!confirm(`${j.商品名}\n合計${z.rows.length}件\n重量 ${num(z.重量)} kgまでを表示します`)) return;
      const s = await new Promise<Rec[] | null>((resolve) => set在庫画面({ z, resolve }));
      set在庫画面(null);
      if (!s) return;
      選んだ = s;
    }
    const out = await api.post<Rec>("/api/soko/juchu/out", {
      輸送ID, 受注ID: j.受注ID, 倉庫ID: soko ?? 0, 積込No: 積込No.current, 選んだ: 選んだ?.map((x) => ({ 認識ID: x.認識ID, ケース: x.実算ケース })),
    });
    積込No.current = out.積込No;
  }
  const 割付の確認 = () => confirm(`出荷日：${斜め(String(bin?.出荷計画日 ?? ""))} ${bin?.運送会社名 ?? ""}に割付ますがよろしいですか?`);
  async function 個別(r: Rec) {
    if (!soko) return alert("出荷場所が選択されていません。");
    if (割付の確認()) {
      try {
        await 割り付ける(r);
      } catch (e) {
        エラー(e);
      }
    }
    閉じる();
  }
  async function 複数() {
    if (割付の確認()) {
      積込No.current = 0;
      const list = rows.filter((r) => r.chk).sort((a, b) => String(a.納品日 ?? "").localeCompare(String(b.納品日 ?? "")) || a.受注ID - b.受注ID || a.商品コード - b.商品コード);
      for (const r of list) {
        try {
          await 割り付ける(r);
        } catch (e) {
          エラー(e);
        }
      }
    }
    閉じる();
  }
  async function 閉じる() {
    await api.post("/api/soko/juchu/close", {}).catch(エラー);
    nav(bin ? `/soko/shukko?date=${bin.出荷計画日}&id=${輸送ID}` : "/soko/shukko");
  }
  async function 印(r: Rec, on: boolean) {
    setRows(rows.map((x) => (x === r ? { ...x, chk: on } : x)));
    await api.post("/api/soko/juchu/chk", { 受注ID: r.受注ID, chk: on });
  }

  const 計 = rows.reduce((a, r) => ({ c: a.c + (r.ケース ?? 0), kg: a.kg + (r.商品kg ?? 0) }), { c: 0, kg: 0 });
  return (
    <div className="wj">
      <div className="wj-top">
        <div className="wj-left">
          <div className="wj-methods">
            {methods.map((m) => (
              <button key={m.id} className={方法 === m.id ? "on" : ""} onClick={() => 方法を選ぶ(m.id)}>{m.name}</button>
            ))}
          </div>
        </div>
        <div className="wj-mid">
          <div className="wj-title">{表題}</div>
          {buttons && (
            <div className="wj-buttons">
              {buttons.map((b, i) => <button key={i} onClick={() => ボタンを押す(b)}>{b.name ?? ""}</button>)}
            </div>
          )}
          {日付欄 && (
            <div className="wj-dates">
              <div className="months">{Array.from({ length: 12 }, (_, i) => <button key={i} onClick={() => 月(i + 1)}>{i + 1}月</button>)}</div>
              <button onClick={() => setCal(true)}>納品日検索</button>
              <Field value={cond.d1 || null} kind="date" className="d" onCommit={(v) => { const d = parseDate(v); if (!d) return alert("日付の書き方が正しくありません。（例：10/28）"); 納品日(d, cond.d2 || d); }} />
              <span>から</span>
              <Field value={cond.d2 || null} kind="date" className="d" onCommit={(v) => { const d = parseDate(v); if (!d) return alert("日付の書き方が正しくありません。（例：10/28）"); 納品日(cond.d1 || d, d); }} />
            </div>
          )}
          {番号欄 && (
            <div className="wj-row">
              <span className="lbl">{番号欄 === "toitsu" ? "発注No検索" : "受注ID検索"}</span>
              <Field value="" className="w2" onCommit={async (v) => { const c = { ...cond, [番号欄]: v.trim() }; setCond(c); await 一覧(c); }} />
            </div>
          )}
          {商品欄 && (
            <div className="wj-row">
              <span className="lbl">商品検索</span>
              <Field value={cond.shohin || null} kind="num" kyotsu="shohin" onCommit={async (v) => { const c = { ...cond, shohin: Number(v) || 0 }; setCond(c); await 一覧(c); }} />
            </div>
          )}
          <div className="wj-row soko">
            <span className="lbl">出荷場所</span>
            <Field value={soko} kind="num" kyotsu="tokui" onCommit={(v) => setSoko(v.trim() === "" ? null : Number(v))} />
            <span className="name">{soko === bin?.出庫場所ID ? bin?.出庫場所 : ""}</span>
          </div>
        </div>
        <div className="wj-right">
          <button onClick={() => 最新()}>更新</button>
          <button className="blue" onClick={() => { set方法(0); クリア(); }}>検索条件クリア</button>
          <button onClick={閉じる}>閉じる</button>
        </div>
      </div>
      <div className="wj-list">
        <table className="ws-grid">
          <thead>
            <tr><th>複数<br />選択</th><th>受注ID</th><th>受注番号</th><th>コード</th><th>届け先</th><th>コード</th><th>製品名</th><th>規格</th><th>納品予定日</th><th>ケース</th><th>残</th><th>商品kg</th><th>個別<br />選択</th><th>履歴</th><th>備考</th></tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.受注ID} className={r.chk ? "picked" : ""}>
                <td className="c"><input type="checkbox" checked={!!r.chk} onChange={(e) => 印(r, e.target.checked)} /></td>
                <td className="r">{r.受注ID}</td><td>{r.受注番号}</td><td className="r kc">{r.届け先コード}</td><td>{r.届け先}</td><td className="r kc">{r.商品コード}</td>
                <td className="bold">{r.商品名}</td><td>{r.規格}</td><td>{月日(r.納品日)}</td><td className="r">{num(r.ケース)}</td>
                <td className={"r bold" + ((r.残ケース ?? 0) > 0 ? " zan" : "")}>{num(r.残ケース)}</td><td className="r">{num(r.商品kg)}</td>
                <td><button className="small" onClick={() => 個別(r)}>選択</button></td>
                <td><button className="small" onClick={async () => setRireki(await api.get<Rec[]>(`/api/soko/juchu/rireki/${r.受注ID}`))}>表示</button></td>
                <td className="note">{r.備考}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="wj-foot">
        <button onClick={複数}>複数選択実行</button>
        <span className="sp" />
        <span className="k">件数</span><span className="v">{rows.length}</span>
        <span className="k">ケース計</span><span className="v">{num(計.c)}</span>
        <span className="k">Kg計</span><span className="v">{num(計.kg)}</span>
      </div>
      {cal && <CalendarDialog value={cond.d1 || null} onClose={() => setCal(false)} onPick={(d) => { setCal(false); 納品日(d, d, true); }} />}
      {rireki && (
        <div className="modal" onClick={() => setRireki(null)}>
          <div className="sko-dlg" onClick={(e) => e.stopPropagation()}>
            <div className="sko-dlg-h">受注履歴<button onClick={() => setRireki(null)}>閉じる</button></div>
            <table className="ws-grid">
              <thead><tr><th>出荷日</th><th>配車伝票No</th><th>届け先</th><th>出荷場所</th><th>商品名</th><th>ケース</th><th>商品kg</th><th>納品日</th></tr></thead>
              <tbody>
                {rireki.length === 0 && <tr><td colSpan={8} className="c">この受注の出庫はまだありません</td></tr>}
                {rireki.map((x) => (
                  <tr key={x.出庫ID}><td>{x.出荷日 ? 斜め(x.出荷日) : ""}</td><td className="r">{x.輸送ID || ""}</td><td>{x.届け先}</td><td>{x.倉庫名}</td><td className="bold">{x.商品名}</td><td className="r">{num(x.ケース)}</td><td className="r">{num(x.商品kg)}</td><td>{月日(x.納品日)}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
      {在庫画面 && <受注分在庫出力 z={在庫画面.z} onDone={在庫画面.resolve} />}
    </div>
  );
}

/**
 * 受注分在庫出力（Access の 倉庫管理の FSD_受注分在庫出力）。受注の残ケース分を賞味期限の古い順に割り付けた在庫を出し、選び直して OK で返す。
 * 抽出を付けるときにロット逆転を確かめる。OK のときは名変の写しでもう一度確かめ、逆転なら外す。
 */
function 受注分在庫出力(props: { z: Rec; onDone: (選んだ: Rec[] | null) => void }) {
  const j = props.z.受注;
  const [rows, setRows] = useState<Rec[]>(props.z.rows);
  useEffect(() => {
    if (props.z.ストック数) alert(props.z.ストック数);
  }, []);
  const 在庫数 = rows.reduce((a, r) => a + Number(r.在庫ケース ?? 0), 0);
  const 受注個数 = Number(j.残ケース ?? 0);
  const 割付 = rows.filter((r) => r.抽出区分).reduce((a, r) => a + Number(r.実算ケース ?? 0), 0);
  const 直す = (r: Rec, v: Rec) => setRows((rs) => rs.map((x) => (x === r ? { ...x, ...v } : x)));
  async function 抽出(r: Rec) {
    if (r.出荷止め区分) return alert("出荷止めが設定されている為、抽出できません。");
    try {
      if (!(await ロット逆転(Number(j.届け先コード), Number(r.商品コード), j.納品日, r.賞味期限, "shukka"))) 直す(r, { 抽出区分: !r.抽出区分 });
    } catch (e) {
      エラー(e);
    }
  }
  async function 出荷止め(r: Rec, 止め: boolean, 備考: string | null) {
    try {
      await api.post("/api/soko/kibou/tome", { 在庫ID: Number(r.認識ID), 出荷止め区分: 止め, 管理備考: 備考 });
      直す(r, { 出荷止め区分: 止め, 管理備考: 備考 });
    } catch (e) {
      エラー(e);
    }
  }
  async function OK() {
    const 選 = [];
    for (const r of rows.filter((x) => x.抽出区分)) {
      try {
        if (!(await ロット逆転(Number(j.届け先コード), Number(r.商品コード), j.納品日, r.賞味期限, "meihen"))) 選.push(r);
      } catch (e) {
        エラー(e);
      }
    }
    props.onDone(選);
  }
  return (
    <div className="modal">
      <div className="sko-dlg">
        <div className="sko-dlg-h">
          受注分在庫出力　{j.商品名}
          <span>
            <button className="blue" onClick={OK}>OK</button>
            <button onClick={() => props.onDone(null)}>キャンセル</button>
          </span>
        </div>
        <div className="sko-pad">
          受注個数 <b>{num(受注個数)}</b>（{num(受注個数 * Number(rows[0]?.入数 ?? 0))} kg）　割付 <b>{num(割付)}</b>　前回賞味期限 <b>{props.z.前回賞味期限 ? 斜め(props.z.前回賞味期限) : "―"}</b>
          {在庫数 < 受注個数 && <span className="red">　在庫が　{在庫数 - 受注個数}個　不足しています。</span>}
        </div>
        <table className="ws-grid">
          <thead><tr><th>抽出</th><th>倉庫</th><th>入庫日</th><th>製造日</th><th>賞味期限</th><th>区分</th><th>入庫No</th><th>元数</th><th>C/S</th><th>Kg</th><th>実算C/S</th><th>実算kg</th><th>名義</th><th>出荷止め</th><th>管理備考</th><th>備考</th></tr></thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.認識ID} className={r.抽出区分 ? "sel" : ""}>
                <td className="c"><input type="checkbox" checked={!!r.抽出区分} onChange={() => 抽出(r)} /></td>
                <td>{r.倉庫名}</td><td>{r.入庫日}</td><td>{r.製造日}</td><td>{r.賞味期限}</td><td className="c">{r.タグ}</td><td>{r.入庫No}</td>
                <td className="r">{num(r.入庫元数)}</td><td className={"r" + (r.在庫ケース < 0 ? " red" : "")}>{num(r.在庫ケース)}</td><td className="r">{num(r.在庫kg)}</td>
                <td><Field value={r.実算ケース} kind="num" className="w4" onCommit={(v) => 直す(r, { 実算ケース: Number(v) || 0, 実算kg: (Number(v) || 0) * Number(r.入数 ?? 0) })} /></td>
                <td className="r">{num(r.実算kg)}</td><td>{r.入庫名義}</td>
                <td className="c"><input type="checkbox" checked={!!r.出荷止め区分} onChange={(e) => 出荷止め(r, e.target.checked, r.管理備考 ?? null)} /></td>
                <td><Field value={r.管理備考} className="w12" onCommit={(v) => 出荷止め(r, !!r.出荷止め区分, v || null)} /></td>
                <td className="small pre">{r.備考在庫}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
