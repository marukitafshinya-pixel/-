import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api, ApiError, num } from "../api";
import { Field, FindDialog, parseDate } from "../formParts";

type Rec = Record<string, any>;
type Opt = { id: number; name: string };
const エラー = (e: unknown) => alert(e instanceof ApiError ? e.message : String(e));
const 今日 = () => new Date(Date.now() + 9 * 3600 * 1000).toISOString().slice(0, 10);

/**
 * 在庫検査結果登録（Access の FM_在庫検査結果登録）。メニューの「検査結果登録」から開く。
 * 製造工場の在庫（倉庫 11・1187、2023/9/1 より後の製造）に、検査区分・検査予定日・合否を入れる。
 * 開くたびに、製造側の入庫に入っている検査結果を写す。直すには［修正］でパスワードを入れる。
 */
export function WsKensa() {
  const nav = useNavigate();
  const [mode, setMode] = useState("mi");
  const [日, set日] = useState(今日());
  const [rows, setRows] = useState<Rec[]>([]);
  const [件数, set件数] = useState<{ 検査待ち: number; 出荷停止: number } | null>(null);
  const [opts, setOpts] = useState<{ 商品区分: Opt[]; 合否判定: Opt[] }>({ 商品区分: [], 合否判定: [] });
  const [合言葉, set合言葉] = useState<string | null>(null);
  const [間違い, set間違い] = useState(0);
  const [初回, set初回] = useState(true);

  async function 読む(m = mode, d = 日) {
    try {
      const r = await api.get<Rec>("/api/ws/kensa", { mode: m, date: d, open: 初回 ? "1" : "" });
      set初回(false);
      setRows(r.rows);
      set件数(r.件数);
    } catch (e) {
      エラー(e);
    }
  }
  useEffect(() => {
    api.get<typeof opts>("/api/ws/kensa/opts").then(setOpts, エラー);
  }, []);
  useEffect(() => {
    読む(mode, 日);
  }, [mode, 日]);

  async function パスワード(): Promise<string | null> {
    const p = prompt("パスワードを入力してください");
    if (p === null) return null;
    const r = await api.post<{ ok: boolean }>("/api/ws/kensa/unlock", { 合言葉: p }).catch((e) => (エラー(e), null));
    if (!r) return null;
    return r.ok ? p : "";
  }

  async function 修正() {
    if (合言葉 !== null) return;
    const p = await パスワード();
    if (p === null) return;
    if (p) {
      set合言葉(p);
      alert("修正可能になりました");
    } else {
      const k = 間違い + 1;
      set間違い(k);
      alert(`パスワードが違います!!\n${k} 回目`);
      if (k > 2) return nav("/"); // Access と同じく 3 回まちがえると閉じる
    }
    // Access と同じく、［修正］のあとは一度表を空にする（検査待ち・出荷停止・製造日のどれかで出し直す）
    setMode("none");
  }

  async function 出荷停止を出す() {
    // Access と同じく、出荷停止の一覧に切り替えるときにパスワードを聞く（違っていても切り替わる）
    const p = await パスワード();
    if (p === "") alert("パスワードが違います");
    setMode("teishi");
  }

  async function 直す(r: Rec, 項目: string, 値: unknown) {
    try {
      const res = await api.post<{ 商品区分: number | null; 通知: number | null }>("/api/ws/kensa/save", { 合言葉, 在庫ID: r.在庫ID, 項目, 値 });
      if (res.通知 !== null) alert(`変更により、出荷計画に${res.通知} 件の変更通知を送ります。`);
      setRows((x) => x.map((y) => (y.在庫ID === r.在庫ID ? { ...y, [項目]: 値, ...(res.商品区分 !== null ? { 商品区分: res.商品区分 } : {}) } : y)));
    } catch (e) {
      エラー(e);
    }
  }
  const ro = 合言葉 === null;
  const 日の欄 = (r: Rec, k: string) => (
    <Field value={r[k]} kind="date" className="kn-d" readOnly={ro} onCommit={(v) => {
      const d = parseDate(v);
      if (d === undefined) return alert("日付の書き方が正しくありません。（例：10/28）");
      直す(r, k, d);
    }} />
  );
  const 件 = (k: number | undefined) => (k ? `${k} 件` : "なし");

  return (
    <div className="kn">
      <div className="kn-head">
        <div className="kn-title">検査結果登録</div>
        <div className="kn-box">
          <div className="lbl">製造日検索</div>
          <input type="date" value={日} onChange={(e) => e.target.value && (set日(e.target.value), setMode("day"))} />
          <button className={mode === "day" ? "on" : ""} onClick={() => setMode("day")}>この日を出す</button>
        </div>
        <div className="kn-box">
          <div className="row">
            <button className={mode === "machi" ? "on" : ""} onClick={() => setMode("machi")}>検査待ち(未処理)</button>
            <span className="kn-cnt">{件(件数?.検査待ち)}</span>
          </div>
          <div className="row">
            <button className={mode === "teishi" ? "on" : ""} onClick={出荷停止を出す}>出荷停止</button>
            <span className="kn-cnt">{件(件数?.出荷停止)}</span>
          </div>
        </div>
        <div className="kn-box">
          <button className={mode === "mi" ? "on" : ""} onClick={() => setMode("mi")} title="合否が「〇」になっていない在庫">合否が〇以外</button>
          <button className={mode === "all" ? "on" : ""} onClick={() => setMode("all")}>すべて</button>
        </div>
        <div className="kn-btns">
          <button onClick={修正} className={ro ? "" : "on"}>{ro ? "修正" : "修正中"}</button>
          <button onClick={() => nav(-1)}>閉じる</button>
        </div>
      </div>
      <div className="kn-list">
        <table className="kn-grid">
          <thead>
            <tr><th>製造・賞味</th><th>商品区分</th><th>商品名</th><th>検査区分</th><th>タグ</th><th>検査予定日</th><th>管理備考</th><th>ケース</th><th>合否</th></tr>
          </thead>
          <tbody>
            {rows.length === 0 && <tr><td colSpan={9} className="c none">{mode === "none" ? "上のボタンで、出す在庫を選んでください" : "当てはまる在庫はありません"}</td></tr>}
            {rows.map((r) => (
              <tr key={r.在庫ID} className={r.商品区分 === 5 ? "teishi" : r.商品区分 >= 1 && r.商品区分 <= 4 ? "machi" : ""}>
                <td>
                  <div className="navy">{日の欄(r, "製造日")}</div>
                  <div className="orange small">{r.賞味期限?.replace(/-/g, "/")}</div>
                </td>
                <td>
                  <select value={r.商品区分 ?? ""} disabled={ro} onChange={(e) => 直す(r, "商品区分", Number(e.target.value))}>
                    {r.商品区分 == null && <option value="" />}
                    {opts.商品区分.map((k) => <option key={k.id} value={k.id}>{k.name}</option>)}
                  </select>
                </td>
                <td className="name">{r.商品名}<div className="small gray">{r.倉庫名}</div></td>
                <td><Field value={r.検査区分} className="kn-s" readOnly={ro} onCommit={(v) => 直す(r, "検査区分", v)} /></td>
                <td><Field value={r.タグ} className="kn-s" readOnly={ro} onCommit={(v) => 直す(r, "タグ", v)} /></td>
                <td>{日の欄(r, "検査予定日")}</td>
                <td><Field value={r.管理備考} className="kn-m" readOnly={ro} onCommit={(v) => 直す(r, "管理備考", v)} /></td>
                <td className="r">{num(r.在庫ケース)}</td>
                <td>
                  <select value={r.合否判定ID ?? ""} disabled={ro} onChange={(e) => 直す(r, "合否判定ID", e.target.value === "" ? null : Number(e.target.value))}>
                    <option value="" />
                    {opts.合否判定.map((k) => <option key={k.id} value={k.id}>{k.name || "（空き）"}</option>)}
                  </select>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="kn-foot">{rows.length} 件</div>
    </div>
  );
}

/**
 * サンプル登録（Access の FM_サンプル登録）。メニューの「サンプル登録」から開く。
 * サンプル（商品コード 697）の在庫を一覧で入れる。商品名をダブルクリックすると商品を探して「【ｻﾝﾌﾟﾙ】 商品名」にする。
 */
export function WsSample() {
  const nav = useNavigate();
  const [rows, setRows] = useState<Rec[]>([]);
  const [倉庫, set倉庫] = useState<Opt[]>([]);
  const [探す, set探す] = useState<number | null>(null);

  async function 読む() {
    try {
      const r = await api.get<{ rows: Rec[]; 倉庫: Opt[] }>("/api/ws/sample");
      setRows(r.rows);
      set倉庫(r.倉庫);
    } catch (e) {
      エラー(e);
    }
  }
  useEffect(() => {
    読む();
  }, []);

  async function 直す(id: number, 項目: string, 値: unknown) {
    try {
      const res = await api.post<Rec>("/api/ws/sample/save", { 在庫ID: id, 項目, 値 });
      const { ok: _, ...v } = res;
      setRows((x) => x.map((y) => (y.在庫ID === id ? { ...y, ...(項目 === "商品から" ? {} : { [項目]: 値 }), ...v } : y)));
    } catch (e) {
      エラー(e);
    }
  }
  async function 新しい行() {
    try {
      await api.post("/api/ws/sample/new", {});
      await 読む();
    } catch (e) {
      エラー(e);
    }
  }
  const 数 = (r: Rec, k: string) => (
    <Field value={r[k]} kind="num" className="sp-n" onCommit={(v) => 直す(r.在庫ID, k, v.trim() === "" ? null : Number(v))} />
  );
  const 日の欄 = (r: Rec, k: string) => (
    <Field value={r[k]} kind="date" className="sp-d" onCommit={(v) => {
      const d = parseDate(v);
      if (d === undefined) return alert("日付の書き方が正しくありません。（例：10/28）");
      直す(r.在庫ID, k, d);
    }} />
  );

  return (
    <div className="kn">
      <div className="kn-head">
        <div className="kn-title">サンプル登録</div>
        <div className="kn-btns">
          <button onClick={新しい行}>新しい行</button>
          <button onClick={() => nav(-1)}>閉じる</button>
        </div>
      </div>
      <div className="kn-list">
        <table className="kn-grid">
          <thead>
            <tr><th>商品名</th><th>製造日</th><th>賞味期限</th><th>ケース</th><th>入数</th><th>重さ(kg)</th><th>チェック</th><th>倉庫</th><th>倉庫名</th></tr>
          </thead>
          <tbody>
            {rows.length === 0 && <tr><td colSpan={9} className="c none">サンプルの在庫はありません</td></tr>}
            {rows.map((r) => (
              <tr key={r.在庫ID}>
                <td><Field value={r.商品名} className="sp-name" onCommit={(v) => 直す(r.在庫ID, "商品名", v)} onDoubleClick={() => set探す(r.在庫ID)} /></td>
                <td>{日の欄(r, "製造日")}</td>
                <td>{日の欄(r, "賞味期限")}</td>
                <td>{数(r, "在庫ケース")}</td>
                <td>{数(r, "入数")}</td>
                <td className="r">{num(r.在庫kg)}</td>
                <td className="c"><input type="checkbox" checked={!!r.抽出区分} onChange={(e) => 直す(r.在庫ID, "抽出区分", e.target.checked)} /></td>
                <td>
                  <select value={r.倉庫ID ?? ""} onChange={(e) => 直す(r.在庫ID, "倉庫ID", e.target.value === "" ? null : Number(e.target.value))}>
                    <option value="" />
                    {r.倉庫ID != null && !倉庫.some((k) => k.id === r.倉庫ID) && <option value={r.倉庫ID}>{r.倉庫ID}</option>}
                    {倉庫.map((k) => <option key={k.id} value={k.id}>{k.id} {k.name}</option>)}
                  </select>
                </td>
                <td>{r.倉庫名}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="kn-foot">商品名をダブルクリックすると、商品を探して「【ｻﾝﾌﾟﾙ】 商品名」にできます。　{rows.length} 件</div>
      {探す !== null && (
        <FindDialog
          kind="shohin"
          onClose={() => set探す(null)}
          onPick={(c) => {
            const id = 探す;
            set探す(null);
            直す(id, "商品から", c);
          }}
        />
      )}
    </div>
  );
}

/**
 * 検査結果待ち在庫一覧（Access の FM_検査待ち在庫）。メニューの「検査待ち在庫」から開く。
 * 商品区分が 菌検査待ち（1〜3）・出荷停止（5）の在庫を出す。［修正］でパスワードを入れると、商品区分・検査区分・菌検査状態を直せる。
 */
export function WsKensaMachi() {
  const nav = useNavigate();
  const [rows, setRows] = useState<Rec[]>([]);
  const [区分, set区分] = useState<Opt[]>([]);
  const [合言葉, set合言葉] = useState<string | null>(null);
  const [間違い, set間違い] = useState(0);

  async function 読む() {
    try {
      setRows(await api.get<Rec[]>("/api/ws/kensamachi"));
    } catch (e) {
      エラー(e);
    }
  }
  useEffect(() => {
    読む();
    api.get<{ 商品区分: Opt[] }>("/api/ws/kensa/opts").then((o) => set区分(o.商品区分), エラー);
  }, []);

  async function 修正() {
    if (合言葉 !== null) return;
    const p = prompt("パスワードを入力してください");
    if (p === null) return;
    const r = await api.post<{ ok: boolean }>("/api/ws/kensa/unlock", { 合言葉: p }).catch((e) => (エラー(e), null));
    if (!r) return;
    if (r.ok) {
      set合言葉(p);
      alert("修正可能になりました");
    } else {
      const k = 間違い + 1;
      set間違い(k);
      alert(`パスワードが違います!!\n${k} 回目`);
      if (k > 2) nav("/"); // Access と同じく 3 回まちがえると閉じる
    }
  }

  async function 直す(r: Rec, 項目: string, 値: unknown) {
    try {
      const res = await api.post<{ 商品区分?: number; 通知: number | null }>("/api/ws/kensamachi/save", { 合言葉, 在庫ID: r.在庫ID, 項目, 値 });
      if (res.通知 !== null) alert(`変更により、出荷計画に${res.通知} 件の変更通知を送ります。`);
      setRows((x) => x.map((y) => (y.在庫ID === r.在庫ID ? { ...y, ...(項目 === "検査区分" ? { 検査区分: 値 } : { 商品区分: res.商品区分 }) } : y)));
    } catch (e) {
      エラー(e);
    }
  }
  const ro = 合言葉 === null;
  const 日 = (v: string | null) => (v ? v.replace(/-/g, "/") : "");
  const ケース計 = rows.reduce((a, r) => a + Number(r.在庫ケース ?? 0), 0);

  return (
    <div className="kn">
      <div className="kn-head">
        <div className="kn-title">検査結果待ち在庫一覧</div>
        <div className="kn-btns">
          <button onClick={読む} title="直した結果で出し直す">出し直す</button>
          <button onClick={修正} className={ro ? "" : "on"}>{ro ? "修正" : "修正中"}</button>
          <button onClick={() => nav(-1)}>閉じる</button>
        </div>
      </div>
      <div className="kn-list">
        <table className="kn-grid">
          <thead>
            <tr>
              <th>入庫日</th><th>商品区分</th><th>名義</th><th>規格/入数</th><th>製造・賞味</th><th>商品名</th><th>検査区分</th>
              <th>元数</th><th>繰越</th><th>製造</th><th>出庫</th><th>在庫</th><th>菌検査状態</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && <tr><td colSpan={13} className="c none">検査待ちの在庫はありません</td></tr>}
            {rows.map((r) => (
              <tr key={r.在庫ID} className={r.商品区分 === 5 ? "teishi" : r.商品区分 >= 1 && r.商品区分 <= 3 ? "machi" : ""}>
                <td className="c">{日(r.入庫日)}</td>
                <td>
                  <select value={r.商品区分 ?? ""} disabled={ro} onChange={(e) => 直す(r, "商品区分", Number(e.target.value))}>
                    {区分.map((k) => <option key={k.id} value={k.id}>{k.name}</option>)}
                  </select>
                </td>
                <td className="small">{r.入庫後名義ID}<div className="gray">{r.名義名}</div></td>
                <td className="c"><b>{r.規格}</b><div>{r.入数}</div></td>
                <td><div className="navy-t">{日(r.製造日)}</div><div className="orange small">{日(r.賞味期限)}</div></td>
                <td className="name">{r.商品名}<div className="small gray">{r.倉庫名}</div>{r.賞味期限通知 && <div className="small kigen">{r.賞味期限通知}</div>}</td>
                <td><Field value={r.検査区分} className="kn-s" readOnly={ro} onCommit={(v) => 直す(r, "検査区分", v)} /></td>
                <td className="r">{num(r.入庫元数)}</td>
                <td className="r">{num(r.繰越ケース)}</td>
                <td className="r">{num(r.製造ケース)}</td>
                <td className="r">{num(r.出庫ケース)}</td>
                <td className="r"><b>{num(r.在庫ケース)}</b><div className="small gray">{num(r.在庫kg)}</div></td>
                <td className="c nowrap">
                  <button className={r.商品区分 === 0 ? "on" : ""} disabled={ro} onClick={() => 直す(r, "菌検査状態", 0)}>済み</button>
                  <button className={r.商品区分 === 3 ? "on" : ""} disabled={ro} onClick={() => 直す(r, "菌検査状態", 3)}>待ち</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="kn-foot">{rows.length} 件　在庫ケース計 {num(ケース計)}　［済み］で製品に、［待ち］で菌検査待ち(ソテー)にして、その在庫の出荷にも写します。</div>
    </div>
  );
}
