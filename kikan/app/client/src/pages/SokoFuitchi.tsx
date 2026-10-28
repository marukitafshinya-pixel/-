import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api, ApiError, num, 処理中 } from "../api";
import { Field, parseDate, PageClose } from "../formParts";

type Rec = Record<string, any>;
const エラー = (e: unknown) => alert(e instanceof ApiError ? e.message : String(e));
const 年月日2 = (v: string | null | undefined) => (v ? v.slice(2, 10).replace(/-/g, "/") : "");

/**
 * 入庫訂正データ（Access の FSD_不一致入庫データ(インポート)）。不一致の印のあるロットと、もとの入庫データ（WorkStation から取り込んだもの）を並べて見る。
 * 入庫データの 納品日・ケース・名義 を直せる。［在庫へ］で倉庫商品一覧を開き、入庫チェックをし直す。
 */
export function SokoFuitchi() {
  const nav = useNavigate();
  const [rows, setRows] = useState<Rec[] | null>(null);
  const load = () => 処理中(() => api.get<Rec[]>("/api/soko/fuitchi")).then(setRows).catch(エラー);
  useEffect(() => {
    load();
  }, []);
  async function 直す(r: Rec, 項目: string, 値: unknown) {
    await api.post("/api/soko/fuitchi/save", { 鍵: r.鍵, 項目, 値, 入数: r.入数 }).catch(エラー);
    load();
  }
  async function 在庫へ(r: Rec) {
    await api.post("/api/soko/fuitchi/check", {}).catch(エラー);
    nav(`/soko/hokan?soko=${r.倉庫ID}&shohin=${r.商品コード}`);
  }
  if (rows && rows.length === 0)
    return (
      <div className="sz sko">
        <p className="sko-pad">不一致データはありません</p>
        <PageClose fallback="/soko" />
      </div>
    );
  return (
    <div className="sz sko">
      <div className="kk-head">
        <div className="kk-title">入庫訂正データ</div>
        <span className="small">{rows ? `${rows.length} 件` : ""}　黄色の欄（もとの入庫データ）を直せます。</span>
        <PageClose fallback="/soko" />
      </div>
      <div className="sko-gridwrap">
        <table className="sz-grid sko-grid">
          <thead>
            <tr>
              <th>冷蔵庫</th><th>入庫日</th><th>コード</th><th>商品名</th><th>入庫No</th><th>入庫元数</th><th>在庫</th><th>不一致</th>
              <th>出荷日</th><th>納品日</th><th>ケース</th><th>kg</th><th>賞味期限</th><th>名義</th><th>在庫ID</th><th></th>
            </tr>
          </thead>
          <tbody>
            {rows?.map((r) => (
              <tr key={r.鍵 + r.在庫ID}>
                <td>{r.倉庫名}</td><td>{年月日2(r.入庫日)}</td><td className="r">{r.商品コード}</td><td className="name">{r.商品名}</td><td>{r.入庫No}</td>
                <td className="r">{num(r.入庫元数)}</td><td className="r">{num(r.在庫ケース)}</td><td className="small red pre">{r.不一致備考}</td>
                <td>{年月日2(r.出荷日)}</td>
                <td>
                  <Field value={r.納品日} kind="date" className="w8 kyotsu" onCommit={(v) => { const d = parseDate(v); if (d === undefined) return alert("日付の書き方が正しくありません。"); 直す(r, "納品日", d); }} />
                </td>
                <td><Field value={r.ケース} kind="num" className="w4 kyotsu" onCommit={(v) => 直す(r, "ケース", v)} /></td>
                <td className="r">{num(r.商品kg)}</td><td>{年月日2(r.賞味期限)}</td>
                <td><Field value={r.入庫後名義ID} kind="num" kyotsu="tokui" className="w4" onCommit={(v) => 直す(r, "入庫後名義ID", v)} /><span className="small"> {r.名義名}</span></td>
                <td className="r">{r.在庫ID}</td>
                <td><button onClick={() => 在庫へ(r)}>在庫へ</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
