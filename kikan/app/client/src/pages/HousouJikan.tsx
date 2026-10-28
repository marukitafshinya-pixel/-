import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api, ApiError } from "../api";
import { Field } from "../formParts";

type Rec = Record<string, any>;
const エラー = (e: unknown) => alert(e instanceof ApiError ? e.message : String(e));

/**
 * 包装時間登録（Access の 包装場管理System の FM_包装時間登録。TM_包装時間）。
 * 商品ごとの包装の時間（台数・段数・包装個数・開始／終了時刻・実働時間・人員など）を 1 行ずつ入れる。
 * Access と同じ計算：商品コードを入れると品名、終了時間を入れると実働時間（分）、実働時間を入れるとケース秒・1台あたり秒。
 */
export default function HousouJikan() {
  const nav = useNavigate();
  const [商品, set商品] = useState(0);
  const [d, setD] = useState<{ rows: Rec[]; 商品: Rec[] } | null>(null);
  const 読む = (code = 商品) => api.get<{ rows: Rec[]; 商品: Rec[] }>("/api/housou/jikan", { code }).then(setD, エラー);
  useEffect(() => {
    読む();
  }, [商品]);

  async function 直す(r: Rec, 項目: string, 値: string) {
    if (String(r[項目] ?? "") === 値) return;
    try {
      await api.post("/api/housou/jikan/save", { ID: r.ID, 項目, 値 });
    } catch (e) {
      エラー(e);
    }
    読む();
  }
  async function 足す() {
    try {
      await api.post("/api/housou/jikan/new", { 商品コード: 商品 || null });
    } catch (e) {
      エラー(e);
    }
    読む();
  }
  async function 消す(r: Rec) {
    if (!confirm(`${r.製造日?.replace(/-/g, "/") ?? ""} ${r.品名 ?? ""} の行を削除しますか？`)) return;
    try {
      await api.post("/api/housou/jikan/delete", { ID: r.ID });
    } catch (e) {
      エラー(e);
    }
    読む();
  }
  const 数 = (r: Rec, k: string, w = "w4") => <td><Field value={r[k]} kind="num" className={"sz-in " + w} onCommit={(v) => 直す(r, k, v.trim())} /></td>;
  const 文字 = (r: Rec, k: string, w = "w8") => <td><Field value={r[k]} className={"sz-in " + w} onCommit={(v) => 直す(r, k, v)} /></td>;
  return (
    <div className="sz hj">
      <div className="kk-head">
        <div className="kk-title">包装時間登録</div>
        <label>
          商品{" "}
          <select value={商品} onChange={(e) => set商品(Number(e.target.value))}>
            <option value={0}>すべて</option>
            {d?.商品.map((x) => <option key={x.id} value={x.id}>{x.id} {x.name}（{x.件数}）</option>)}
          </select>
        </label>
        <button onClick={足す}>新しい行</button>
        <span className="small">{d ? `${d.rows.length} 件` : ""}</span>
        <button onClick={() => nav(-1)}>閉じる</button>
      </div>
      <div className="small hj-note">時刻は 10:20 のように入れます。終了時間を入れると実働時間（分）が入り、実働時間を入れるとケース秒（整数）・1台あたり秒が入ります（Access と同じ）。</div>
      <table className="sz-grid hj-grid">
        <thead>
          <tr>
            <th>製造日</th><th>商品コード</th><th>品名</th><th>台数</th><th>段数</th><th>包装個数</th><th>開始時間</th><th>終了時間</th><th>実働時間(分)</th>
            <th>ケース秒</th><th>1台あたり(秒)</th><th>人員</th><th>不凍結A</th><th>不凍結B</th><th>不凍結C</th><th>不凍結D</th><th>備品</th><th>備考</th><th></th>
          </tr>
        </thead>
        <tbody>
          {d?.rows.map((r) => (
            <tr key={r.ID}>
              <td><Field value={r.製造日} kind="date" className="sz-in w8" onCommit={(v) => 直す(r, "製造日", v)} /></td>
              <td><Field value={r.商品コード} kind="num" kyotsu="shohin" className="sz-in w4" onCommit={(v) => 直す(r, "商品コード", v.trim())} /></td>
              {文字(r, "品名", "w10")}
              {数(r, "台数")}
              {数(r, "段数", "w3")}
              {数(r, "包装個数")}
              {文字(r, "開始時間", "w4")}
              {文字(r, "終了時間", "w4")}
              {数(r, "実働時間分")}
              {数(r, "ケース_秒")}
              {数(r, "1台あたり（秒）")}
              {数(r, "人員", "w3")}
              {数(r, "不凍結A", "w3")}
              {数(r, "不凍結B", "w3")}
              {数(r, "不凍結C", "w3")}
              {数(r, "不凍結D", "w3")}
              {文字(r, "備品")}
              {文字(r, "備考")}
              <td><button className="small" onClick={() => 消す(r)}>削除</button></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
