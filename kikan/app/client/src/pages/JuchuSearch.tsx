import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api, ApiError, mdw, num, ymd } from "../api";

type MotoBtn = { 並び: number; 表示名: string; 値: number; 要確認: boolean };
type SakiBtn = { 受注先ID: number; 表示名: string };
type Row = Record<string, any>;

// 進み具合のチェック（画面の見出し → 受注の項目）
const CHECKS: [string, string][] = [
  ["入力\n確認", "入力確認チェック"],
  ["受注\n返信", "受注返信FAX"],
  ["配車\n確認", "受注手配確認"],
  ["出庫\n確認", "受注出庫確認"],
  ["出庫\n返信", "出庫返信FAX確認"],
  ["輸送\n返信", "輸送手配返信確認"],
  ["受領\n確認", "受領書確認"],
  ["伝票\n作成", "伝票作成"],
  ["伝票\n郵送", "伝票送付"],
  ["伝票\nFAX", "伝票FAX"],
  ["送品\n案内", "送品案内"],
];

function monthRange(m: number): [string, string] {
  const y = new Date().getFullYear();
  return [ymd(new Date(y, m - 1, 1)), ymd(new Date(y, m, 0))];
}

/** 受注検索（Access の F_受注検索） */
export default function JuchuSearch() {
  const nav = useNavigate();
  const [motoBtns, setMotoBtns] = useState<MotoBtn[]>([]);
  const [sakiBtns, setSakiBtns] = useState<SakiBtn[]>([]);
  const [shohinList, setShohinList] = useState<{ 商品コード: number; 商品名: string }[]>([]);
  const thisMonth = new Date().getMonth() + 1;
  const [f, setF] = useState<Record<string, string>>(() => {
    const [from, to] = monthRange(thisMonth);
    return { from, to };
  });
  const [month, setMonth] = useState<number | null>(thisMonth);
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    api.get<MotoBtn[]>("/api/juchu/search/moto-buttons").then(setMotoBtns);
    api.get<any[]>("/api/master/shohin").then(setShohinList);
  }, []);

  useEffect(() => {
    setLoading(true);
    api.get<Row[]>("/api/juchu/search", f).then((r) => {
      setRows(r);
      setLoading(false);
    });
  }, [f]);

  function set(patch: Record<string, string | undefined>) {
    setF((old) => {
      const n = { ...old, ...patch } as Record<string, string>;
      delete n.mode;
      for (const k of Object.keys(n)) if (n[k] === undefined || n[k] === "") delete n[k];
      return n;
    });
  }

  async function chooseMoto(v: number) {
    set({ moto: String(v), saki: undefined });
    setSakiBtns(await api.get<SakiBtn[]>("/api/juchu/search/saki-buttons", { moto: v }));
  }

  // チェックを押したらすぐ保存する（Access の表と同じ）
  async function toggle(r: Row, col: string) {
    const v = !r[col];
    setRows((rs) => rs.map((x) => (x.受注ID === r.受注ID ? { ...x, [col]: v } : x)));
    try {
      const u = await api.post<Row>("/api/juchu/search/check", { 受注ID: r.受注ID, 項目: col, 値: v });
      setRows((rs) => rs.map((x) => (x.受注ID === r.受注ID ? { ...x, ...u } : x)));
    } catch (e) {
      setRows((rs) => rs.map((x) => (x.受注ID === r.受注ID ? { ...x, [col]: !v } : x)));
      alert(e instanceof ApiError ? e.message : String(e));
    }
  }

  const shohinName = useMemo(
    () => shohinList.find((s) => String(s.商品コード) === f.shohin)?.商品名 ?? "",
    [shohinList, f.shohin],
  );

  return (
    <div className="search">
      <div className="tabs">
        <span>受注管理</span>
        <span className="active">F_受注検索</span>
      </div>
      <div className="search-head">
        <div className="moto">
          {motoBtns.map((b) => (
            <button
              key={b.並び}
              className={(f.moto === String(b.値) ? "on " : "") + (b.要確認 ? "unsure" : "")}
              title={b.要確認 ? "どの受注元にあたるか確認中のボタンです" : ""}
              onClick={() => chooseMoto(b.値)}
            >
              {b.表示名}
            </button>
          ))}
        </div>
        <button className="plain" onClick={() => setF({ mode: "today" })}>
          当日入力分
          <br />
          表示
        </button>
        <div className="field">
          <span>納品日検索</span>
          <input
            type="date"
            onChange={(e) => {
              setMonth(null);
              set({ from: e.target.value, to: e.target.value });
            }}
          />
        </div>
        <div className="field purple">
          <span>自社Noで検索</span>
          <input defaultValue={f.jid} onKeyDown={(e) => e.key === "Enter" && set({ jid: e.currentTarget.value, bango: undefined })} />
        </div>
        <div className="field purple">
          <span>受注番号で検索</span>
          <input onKeyDown={(e) => e.key === "Enter" && set({ bango: e.currentTarget.value, jid: undefined })} />
        </div>
        <div className="field purple">
          <span>年間IDで検索</span>
          <input onKeyDown={(e) => e.key === "Enter" && set({ toitsu: e.currentTarget.value })} />
        </div>
        <div className="actions">
          <button title="Excel への出力は準備中です" disabled>
            出力
          </button>
          <button
            onClick={() => {
              setSakiBtns([]);
              setMonth(null);
              setF({});
            }}
          >
            クリア
          </button>
          <button onClick={() => nav("/")}>閉じる</button>
        </div>
      </div>
      <div className="search-head2">
        <div className="saki">
          {sakiBtns.filter((b) => b.表示名).map((b) => (
            <button key={b.受注先ID} className={f.saki === String(b.受注先ID) ? "on" : ""} onClick={() => set({ saki: String(b.受注先ID) })}>
              {b.表示名}
            </button>
          ))}
        </div>
        <div className="field purple wide">
          <span>商品で検索</span>
          <div>
            <select value={f.shohin ?? "0"} onChange={(e) => set({ shohin: e.target.value === "0" ? undefined : e.target.value })}>
              <option value="0">0</option>
              {shohinList.map((s) => (
                <option key={s.商品コード} value={s.商品コード}>
                  {s.商品コード} {s.商品名}
                </option>
              ))}
            </select>
            <span className="shohin-name">{shohinName}</span>
          </div>
        </div>
        <div className="range">
          <span className="title">納品日範囲</span>
          <div>
            <input type="date" value={f.from ?? ""} onChange={(e) => (setMonth(null), set({ from: e.target.value }))} />
            〜
            <input type="date" value={f.to ?? ""} onChange={(e) => (setMonth(null), set({ to: e.target.value }))} />
          </div>
          <div className="months">
            {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
              <button
                key={m}
                className={month === m ? "on" : ""}
                onClick={() => {
                  setMonth(m);
                  const [from, to] = monthRange(m);
                  set({ from, to });
                }}
              >
                {m}
              </button>
            ))}
          </div>
        </div>
        <button className="plain" onClick={() => setF({ mode: "cancel" })}>
          キャンセル
          <br />
          未処理
        </button>
      </div>
      <div className="grid-wrap">
        <table className="grid">
          <thead>
            <tr>
              <th>受注ID<br />販盛番号</th>
              <th>販盛売上<br />No</th>
              <th className="red">完了<br />消込</th>
              <th>受注日</th>
              <th>受注番号<br />年間ID</th>
              <th>処理<br />コード</th>
              <th>コード</th>
              <th>届け先</th>
              <th>コード</th>
              <th>製品名</th>
              <th>ケース<br />商品kg</th>
              <th>納品日</th>
              <th>備考</th>
              {CHECKS.map(([label]) => (
                <th key={label} className="chk">
                  {label}
                </th>
              ))}
              <th>出荷予定日</th>
              <th>運送会社</th>
              <th>ランテック送り状<br />No</th>
              <th>集荷先</th>
              <th>elixxi出庫受<br />付No</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.受注ID}>
                <td className="num">
                  <b>{r.受注ID}</b>
                  <br />
                  <small>
                    {r.販盛伝票番号 ?? ""} {r.枝番3 ?? ""}
                  </small>
                </td>
                <td className="num">{r.販盛売上番号}</td>
                <td className="center">
                  <input type="checkbox" checked={!!r.完了消込} onChange={() => toggle(r, "完了消込")} />
                </td>
                <td className="red">{mdw(r.受注日)}</td>
                <td>
                  {r.受注番号}
                  <br />
                  <small className="red">{r.統一受注ID}</small>
                </td>
                <td>{r.枝番1}</td>
                <td className="num">{r.届け先コード}</td>
                <td>{r.届け先}</td>
                <td className="num">{r.商品コード}</td>
                <td>{r.商品名}</td>
                <td className="num">
                  {num(r.ケース)}
                  <br />
                  <small>{num(r.商品kg)}</small>
                </td>
                <td className="red">{mdw(r.納品日)}</td>
                <td className="note">{r.備考}</td>
                {CHECKS.map(([label, col]) => (
                  <td key={label} className="center">
                    <input type="checkbox" checked={!!r[col]} onChange={() => toggle(r, col)} />
                  </td>
                ))}
                <td className="dark">{mdw(r.出荷予定日)}</td>
                <td className="dark">{r.運送会社}</td>
                <td className="dark">{r.手配輸送番号}</td>
                <td className="dark">{r.倉庫名}</td>
                <td className="dark">{r.手配出庫番号}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="count">{loading ? "読み込み中…" : `${rows.length} 件${rows.length >= 3000 ? "（3000 件まで表示）" : ""}`}</div>
      </div>
    </div>
  );
}
