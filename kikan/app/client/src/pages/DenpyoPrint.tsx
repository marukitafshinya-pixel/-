import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { api, num } from "../api";
import { showDate } from "../formParts";

type Row = Record<string, any>;

/**
 * 和弘食品専用伝票（Access の R_和弘食品専用伝票）。ブラウザの印刷で紙にする。
 * ※ 今の伝票の見本をいただいてから、並び・文言を合わせる（いまは仮の形）。
 */
export default function DenpyoPrint() {
  const [sp] = useSearchParams();
  const [rows, setRows] = useState<Row[] | null>(null);
  useEffect(() => {
    api.get<Row[]>("/api/denpyo/report", Object.fromEntries(sp.entries())).then(setRows);
  }, [sp]);
  if (!rows) return null;
  if (rows.length === 0) return <div className="notyet">対象のデータがありません。参照が正しいか確認してください。</div>;
  return (
    <div className="print-page">
      <div className="no-print print-bar">
        <button onClick={() => window.print()}>印刷する</button>
        <span>※ 仮の形です。今の伝票の見本をいただいたら、同じ並びに直します。</span>
      </div>
      {rows.map((r) => (
        <div key={r.受注ID} className="sheet">
          <h1>納 品 書</h1>
          <div className="sheet-top">
            <div>
              <div className="to">{r.受注先名} 御中</div>
              <div>受注番号：{r.受注番号}</div>
            </div>
            <div className="from">
              <div>受注日 {showDate(r.受注日)}</div>
              <div>丸北北海道</div>
            </div>
          </div>
          <table className="sheet-table">
            <tbody>
              <tr><th>納品日</th><td>{showDate(r.納品日)}</td><th>受注ID</th><td>{r.受注ID}</td></tr>
              <tr><th>届け先</th><td colSpan={3}>{r.届け先正式名 ?? r.届け先}</td></tr>
              <tr><th>住所</th><td colSpan={3}>{r.住所}</td></tr>
              <tr><th>電話番号</th><td colSpan={3}>{r.電話番号}</td></tr>
              <tr><th>品名</th><td colSpan={3}>{r.商品コード}　{r.商品名}</td></tr>
              <tr><th>規格</th><td>{r.規格表示}</td><th>ケース</th><td>{num(r.ケース)}</td></tr>
              <tr><th>数量(kg)</th><td>{num(r.商品kg)}</td><th></th><td></td></tr>
              <tr><th>備考</th><td colSpan={3}>{r.備考}</td></tr>
            </tbody>
          </table>
        </div>
      ))}
    </div>
  );
}
