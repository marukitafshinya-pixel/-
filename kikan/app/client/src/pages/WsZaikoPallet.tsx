import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api, ApiError, num } from "../api";
import { Field } from "../formParts";

type Rec = Record<string, any>;
const エラー = (e: unknown) => alert(e instanceof ApiError ? e.message : String(e));
const 欄 = Array.from({ length: 25 }, (_, i) => `${String(i + 1).padStart(2, "0")}A`);
const 短い日 = (v: string | null) => (v ? `${v.slice(2, 4)}/${v.slice(5, 7)}/${v.slice(8, 10)}` : "");

/**
 * 在庫商品パレット確認（Access の FS_在庫商品パレット確認）。メニューの「在庫確認（パレット）」から開く。
 * 工場の在庫のロットごとに、パレット 1〜25 枚目のケースを入れる。パレット単位を入れるとパレット数 1、パレット数を入れると単位のケースを順に入れる。
 * パレットの合計が在庫ケースと合えば「OK」、違えば「多い／あと」の数を出す。
 */
export default function WsZaikoPallet() {
  const nav = useNavigate();
  const [rows, setRows] = useState<Rec[]>([]);
  const [合わない, set合わない] = useState(false);

  async function 読む() {
    try {
      setRows(await api.get<Rec[]>("/api/ws/zpallet"));
    } catch (e) {
      エラー(e);
    }
  }
  useEffect(() => {
    読む();
  }, []);

  async function 直す(r: Rec, 項目: string, v: string) {
    try {
      const res = await api.post<Rec>("/api/ws/zpallet/save", { 在庫ID: r.在庫ID, 項目, 値: v.trim() === "" ? null : Number(v) });
      setRows((x) => x.map((y) => (y.在庫ID === r.在庫ID ? { ...y, ...res } : y)));
    } catch (e) {
      エラー(e);
    }
  }
  const 差 = (r: Rec) => Number(r.A計 ?? 0) - Number(r.在庫ケース ?? 0);
  const 出す = 合わない ? rows.filter((r) => 差(r) !== 0) : rows;
  const 合う数 = rows.filter((r) => 差(r) === 0).length;

  return (
    <div className="zp">
      <div className="kn-head no-print">
        <div className="kn-title">在庫商品パレット確認</div>
        <div className="kn-box">
          <label><input type="checkbox" checked={合わない} onChange={(e) => set合わない(e.target.checked)} /> 合っていない行だけ出す</label>
          <div className="small">合っている {合う数} 件／全部 {rows.length} 件</div>
        </div>
        <div className="kn-btns">
          <button onClick={読む}>出し直す</button>
          <button onClick={() => window.print()}>印刷</button>
          <button onClick={() => nav(-1)}>閉じる</button>
        </div>
      </div>
      <div className="print-only zp-ptitle">在庫商品パレット確認</div>
      <div className="kn-list zp-list">
        <table className="kn-grid zp-grid">
          <thead>
            <tr>
              <th>倉庫</th><th>商品名</th><th>製造・賞味</th><th>区分</th><th>在庫</th><th>計</th><th>確認</th><th>単位</th><th>枚数</th>
              {欄.map((k) => <th key={k} className="zp-a">{Number(k.slice(0, 2))}</th>)}
            </tr>
          </thead>
          <tbody>
            {出す.length === 0 && <tr><td colSpan={34} className="c none">当てはまる在庫はありません</td></tr>}
            {出す.map((r) => {
              const d = 差(r);
              return (
                <tr key={r.在庫ID} className={d === 0 ? "ok" : ""}>
                  <td className="small nowrap">{r.倉庫名}</td>
                  <td className="name">{r.商品名}<div className="small gray">{r.商品コード}</div></td>
                  <td><div className="navy-t">{短い日(r.製造日)}</div><div className="orange small">{短い日(r.賞味期限)}</div></td>
                  <td className="c">{r.タグ}</td>
                  <td className="r"><b>{num(r.在庫ケース)}</b><div className="small gray">{num(r.在庫kg)}</div></td>
                  <td className="r"><b>{num(r.A計)}</b></td>
                  <td className={"c nowrap " + (d === 0 ? "zp-ok" : "zp-ng")}>{d === 0 ? "OK" : d > 0 ? `多い ${num(d)}` : `あと ${num(-d)}`}</td>
                  <td><Field value={r.パレット単位} kind="num" className="zp-n" onCommit={(v) => 直す(r, "パレット単位", v)} /></td>
                  <td><Field value={r.パレット数} kind="num" className="zp-n" onCommit={(v) => 直す(r, "パレット数", v)} /></td>
                  {欄.map((k) => (
                    <td key={k} className="zp-a"><Field value={r[k] || ""} kind="num" className="zp-c" onCommit={(v) => 直す(r, k, v)} /></td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
