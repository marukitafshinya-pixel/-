import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { api, num } from "../api";
import { showDate } from "../formParts";

type Row = Record<string, any>;
type 宛先 = { 商品コード: number; 手配依頼先: string; 仕入先名: string; 仕入先コード: string; 返信コメント2: string; 返信コメント3: string };

/**
 * 発注依頼書（Access の R_発注依頼）。ブラウザの印刷で紙にする。
 * ※ 今の印刷物の見本をいただいてから、並び・文言を合わせる（いまは仮の形）。
 */
export default function HacchuPrint() {
  const [sp] = useSearchParams();
  const [data, setData] = useState<{ rows: Row[]; 宛先: 宛先[] } | null>(null);
  const [edit, setEdit] = useState(false);

  const load = () => api.get<any>("/api/hacchu/report", Object.fromEntries(sp.entries())).then(setData);
  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!data) return null;
  if (data.rows.length === 0)
    return <div className="notyet">対象のデータがありません。参照が正しいか確認してください。</div>;

  // 宛先は Access と同じく、見出しは商品コード1、下のコメントは商品コードで選ぶ
  const pick = (code: unknown) => data.宛先.find((a) => a.商品コード === Number(code)) ?? data.宛先.find((a) => a.商品コード === 0)!;
  const today = new Date();

  return (
    <div className="print-page">
      <div className="no-print print-bar">
        <button onClick={() => window.print()}>印刷する</button>
        <button onClick={() => setEdit(!edit)}>宛先の設定</button>
        <span>※ 仮の形です。今の発注依頼書の見本をいただいたら、同じ並びに直します。</span>
      </div>
      {edit && <AtesakiEdit list={data.宛先} onSaved={load} />}
      {data.rows.map((r) => {
        const head = pick(r.商品コード1);
        const foot = pick(r.商品コード);
        return (
          <div key={r.受注ID} className="sheet">
            <h1>発 注 依 頼 書</h1>
            <div className="sheet-top">
              <div>
                <div className="to">{head.手配依頼先}</div>
                {head.仕入先名 && <div>{head.仕入先名}</div>}
                {head.仕入先コード && <div>仕入先コード：{head.仕入先コード}</div>}
              </div>
              <div className="from">
                <div>{today.getFullYear()}年{today.getMonth() + 1}月{today.getDate()}日</div>
                <div>丸北北海道</div>
              </div>
            </div>
            <p>下記の通り、出庫手配をお願いいたします。</p>
            <table className="sheet-table">
              <tbody>
                <tr><th>受注番号</th><td>{r.受注番号}</td><th>受注ID</th><td>{r.受注ID}</td></tr>
                <tr><th>受注日</th><td>{showDate(r.受注日)}</td><th>納品日</th><td>{showDate(r.納品日)}</td></tr>
                <tr><th>届け先</th><td colSpan={3}>{r.届け先コード}　{r.届け先正式名 ?? r.届け先}</td></tr>
                <tr><th>住所</th><td colSpan={3}>{r.住所}</td></tr>
                <tr><th>電話番号</th><td colSpan={3}>{r.電話番号}</td></tr>
                <tr>
                  <th>品名</th>
                  <td colSpan={3}>
                    {r.商品コード}　{r.商品名}　{r.規格}
                    {Number(r.商品コード) === 1193 && "　( 珠江・その他         )"}
                  </td>
                </tr>
                <tr><th>ケース</th><td>{num(r.ケース)}</td><th>数量(kg)</th><td>{num(r.商品kg)}</td></tr>
                <tr><th>備考</th><td colSpan={3}>{r.備考}</td></tr>
              </tbody>
            </table>
            <div className="sheet-foot">
              {foot.返信コメント2 && <div>{foot.返信コメント2}</div>}
              {foot.返信コメント3 && <div>{foot.返信コメント3}</div>}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function AtesakiEdit({ list, onSaved }: { list: 宛先[]; onSaved: () => void }) {
  const [rows, setRows] = useState(list);
  const keys: (keyof 宛先)[] = ["手配依頼先", "仕入先名", "仕入先コード", "返信コメント2", "返信コメント3"];
  return (
    <div className="no-print atesaki">
      <p>発注依頼書の宛先です。商品コード 0 がふだんの宛先、ほかは商品ごとの宛先です。担当者の名前もここに入れてください。</p>
      <table>
        <thead>
          <tr>
            <th>商品コード</th>
            {keys.map((k) => <th key={k}>{k}</th>)}
            <th></th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={r.商品コード}>
              <td>{r.商品コード}</td>
              {keys.map((k) => (
                <td key={k}>
                  <input value={String(r[k] ?? "")} onChange={(e) => setRows(rows.map((x, j) => (j === i ? { ...x, [k]: e.target.value } : x)))} />
                </td>
              ))}
              <td>
                <button
                  onClick={async () => {
                    await api.post("/api/hacchu/atesaki", r);
                    onSaved();
                  }}
                >
                  保存
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
