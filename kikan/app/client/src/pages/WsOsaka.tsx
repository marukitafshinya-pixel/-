import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { api, ApiError, num } from "../api";
import { Field, FindDialog, PageClose } from "../formParts";

type Rec = Record<string, any>;
const エラー = (e: unknown) => alert(e instanceof ApiError ? e.message : String(e));
const 今年 = () => Number(new Date(Date.now() + 9 * 3600 * 1000).toISOString().slice(0, 4));
const 短い日 = (v: string) => `${v.slice(2, 4)}/${v.slice(5, 7)}/${v.slice(8, 10)}`;

/**
 * 大阪 月間受注登録（Access の F_受注検索_大阪受注登録）。メニューの「大阪受注登録」から開く。
 * 年間受注割振りと同じ月の表の、大阪扱いの行に手配数量（kg）を入れる。kg ÷ 入数 のケースが、年間受注割振りの受注数になる。
 * 受注月を選び、［商品検索］で商品を選ぶか［月全体を表示］。直す・足す・消すには［追加の許可］でパスワードを入れる。
 */
export default function WsOsaka() {
  const nav = useNavigate();
  const [年, set年] = useState(今年());
  const [月, set月] = useState<number | null>(null);
  const [方法, set方法] = useState<"商品" | "全体" | null>(null);
  const [商品, set商品] = useState<number | null>(null);
  const [探す, set探す] = useState(false);
  const [data, setData] = useState<{ 開始: string; 終了: string; 商品名: string; rows: Rec[] } | null>(null);
  const [合言葉, set合言葉] = useState<string | null>(null);
  const ro = 合言葉 === null;

  async function 読む(m = 月, s = 商品, y = 年, 全体 = 方法 === "全体") {
    if (!m) return;
    if (!全体 && !s) return setData(null);
    try {
      setData(await api.get("/api/ws/osaka", { year: String(y), month: String(m), ...(全体 ? {} : { shohin: String(s) }) }));
    } catch (e) {
      エラー(e);
    }
  }
  function 月を選ぶ(m: number) {
    set月(m);
    読む(m);
  }
  function 条件クリア() {
    set月(null);
    set方法(null);
    set商品(null);
    setData(null);
  }
  async function 追加の許可() {
    if (合言葉 !== null) return;
    const p = prompt("編集モードに切り替えます。パスワードを入力してください。");
    if (p === null) return;
    const r = await api.post<{ ok: boolean }>("/api/ws/osaka/unlock", { 合言葉: p }).catch((e) => (エラー(e), null));
    if (!r) return;
    if (r.ok) {
      set合言葉(p);
      alert("編集可能になりました");
    } else alert("パスワードが違います");
  }
  async function 直す(r: Rec, 項目: string, 値: unknown) {
    try {
      const res = await api.post<Rec>("/api/ws/osaka/save", { 合言葉, 個別受注ID: r.個別受注ID, 項目, 値 });
      setData((d) => d && { ...d, rows: d.rows.map((x) => (x.個別受注ID === r.個別受注ID ? { ...x, ...res } : x)) });
    } catch (e) {
      エラー(e);
    }
  }
  async function 足す() {
    if (!月) return alert("受注月を選んでください");
    try {
      await api.post("/api/ws/osaka/new", { 合言葉, year: 年, month: 月, shohin: 方法 === "商品" ? 商品 : null });
      await 読む();
    } catch (e) {
      エラー(e);
    }
  }
  async function 消す(r: Rec) {
    if (r.chk) return alert("登録済みの為削除できません");
    if (!confirm("この行を消します。よろしいですか？")) return;
    try {
      await api.post("/api/ws/osaka/delete", { 合言葉, 個別受注ID: r.個別受注ID });
      setData((d) => d && { ...d, rows: d.rows.filter((x) => x.個別受注ID !== r.個別受注ID) });
    } catch (e) {
      エラー(e);
    }
  }
  const 案内 = !月 ? "受注月を選んで下さい" : !方法 ? "表示方法を選んで下さい" : 方法 === "商品" && !商品 ? "商品を選択して下さい" : 方法 === "商品" ? `${商品} ${data?.商品名 ?? ""}` : "月全体を表示しています";

  return (
    <div className="os">
      <div className="os-head">
        <div className="os-title">大阪　月間受注登録</div>
        <div className="os-month">
          <div className="lbl">受注月</div>
          <div className="row">
            {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
              <button key={m} className={月 === m ? "on" : ""} onClick={() => 月を選ぶ(m)}>{m}</button>
            ))}
          </div>
          <div className="row">
            <select value={年} onChange={(e) => (set年(Number(e.target.value)), 月 && 読む(月, 商品, Number(e.target.value)))}>
              {[今年() - 1, 今年(), 今年() + 1].map((y) => <option key={y} value={y}>{y}</option>)}
            </select>
            <span>年</span>
            <span className="os-day">{data ? 短い日(data.開始) : ""}</span>
            <span>～</span>
            <span className="os-day">{data ? 短い日(data.終了) : ""}</span>
          </div>
        </div>
        <div className="os-way">
          <div className="lbl">表示方法</div>
          <button className={方法 === "商品" ? "on" : ""} disabled={!月} onClick={() => (set方法("商品"), set探す(true))}>商品検索</button>
          <button className={方法 === "全体" ? "on" : ""} disabled={!月} onClick={() => (set方法("全体"), 読む(月, 商品, 年, true))}>月全体を表示</button>
        </div>
        <div className="os-right">
          <div className="os-btns">
            <button onClick={() => 読む()}>最新情報に更新</button>
            <button onClick={条件クリア} className="blue">検索条件クリア</button>
            <button onClick={追加の許可} className={ro ? "" : "on"}>{ro ? "追加の許可" : "編集中"}</button>
            <PageClose fallback="/maruhoku" />
          </div>
          <div className="os-msg">{案内}</div>
        </div>
      </div>
      <div className="os-list">
        <table className="os-grid">
          <thead>
            <tr><th>年間ID</th><th>基本コード</th><th>商品名</th><th>届け先コード</th><th>届け先</th><th>手配数量(kg)</th><th>ケース</th><th>備考</th><th>ID</th><th /></tr>
          </thead>
          <tbody>
            {(data?.rows ?? []).map((r) => (
              <tr key={r.個別受注ID}>
                <td className="c">{r.大阪受注ID ?? ""}</td>
                <td><Field value={r.商品コード} kind="num" kyotsu="shohin" readOnly={ro} className="os-code" onCommit={(v) => 直す(r, "商品コード", v.trim() === "" ? null : Number(v))} /></td>
                <td className="name">{r.商品名}</td>
                <td><Field value={r.届け先コード} kind="num" kyotsu="tokui" readOnly={ro} className="os-code" onCommit={(v) => 直す(r, "届け先コード", v.trim() === "" ? null : Number(v))} /></td>
                <td className="name">{r.届け先}</td>
                <td><Field value={r.受注元KG} kind="num" readOnly={ro} className="os-kg" onCommit={(v) => 直す(r, "受注元KG", v.trim() === "" ? null : Number(v))} /></td>
                <td className="r gray">{num(r.受注元数)}</td>
                <td><Field value={r.備考} readOnly={ro} className="os-biko" onCommit={(v) => 直す(r, "備考", v)} /></td>
                <td className="c">{r.個別受注ID}</td>
                <td><button disabled={ro} onClick={() => 消す(r)}>消す</button></td>
              </tr>
            ))}
          </tbody>
        </table>
        {!ro && 月 && <button className="os-add" onClick={足す}>新しい行</button>}
      </div>
      <div className="os-foot"><span className="lbl">件数</span><span className="v">{data?.rows.length ?? ""}</span></div>
      {探す && (
        <FindDialog
          kind="shohin"
          onClose={() => set探す(false)}
          onPick={(c) => {
            set探す(false);
            set商品(c);
            読む(月, c, 年, false);
          }}
        />
      )}
    </div>
  );
}
