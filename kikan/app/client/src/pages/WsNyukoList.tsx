import { useEffect, useState } from "react";
import { api, ApiError } from "../api";
import { PageClose } from "../formParts";

type Rec = Record<string, any>;
const エラー = (e: unknown) => alert(e instanceof ApiError ? e.message : String(e));
const 曜 = "日月火水木金土";
const 今日 = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
const 斜線 = (v: string) => v.replace(/-/g, "/");
/** 10月13日(火) */
const 月日曜 = (v: string | null) => {
  if (!v) return "";
  const x = new Date(v.slice(0, 10) + "T00:00:00");
  return `${x.getMonth() + 1}月${x.getDate()}日(${曜[x.getDay()]})`;
};
/** 10月05日 */
const 月日2 = (v: string | null) => (v ? `${v.slice(5, 7)}月${v.slice(8, 10)}日` : "");
/** 26/10/05 */
const 年月日2 = (v: string | null) => (v ? `${v.slice(2, 4)}/${v.slice(5, 7)}/${v.slice(8, 10)}` : "");
const 数 = (v: unknown) => (v === null || v === undefined || v === "" ? "" : Number(v).toLocaleString("ja-JP"));
/** 1 ページの行数（見本の A4 横と同じ） */
const 行数 = 26;

/**
 * ニチレイ入庫リスト（Access の WorkStation の F_入庫リスト表示）。
 * 冷蔵庫と納品日の範囲で、その冷蔵庫に届ける出荷を出す。［入庫リスト表示］で入庫予定リストを印刷する
 * （大谷地は R_ニチレイ専用入庫リスト_ニチレイ大谷地「イーリクシー 入庫予定リスト」、ほかは同じ商品・ロットをまとめた R_ニチレイ専用入庫リスト）。
 */
export default function WsNyukoList() {
  const [冷蔵庫一覧, set冷蔵庫一覧] = useState<Rec[]>([]);
  const [冷蔵庫, set冷蔵庫] = useState(164);
  const [開始, set開始] = useState(今日());
  const [終了, set終了] = useState(今日());
  const [rows, setRows] = useState<Rec[] | null>(null);
  const [印刷, set印刷] = useState<Rec | null>(null);

  useEffect(() => {
    api.get<Rec[]>("/api/ws/nyuko-list/soko").then(set冷蔵庫一覧, エラー);
  }, []);
  useEffect(() => {
    if (開始 > 終了) return;
    api.get<Rec[]>("/api/ws/nyuko-list", { soko: 冷蔵庫, from: 開始, to: 終了 }).then(setRows, エラー);
  }, [冷蔵庫, 開始, 終了]);

  async function 印刷表示() {
    try {
      set印刷(await api.get<Rec>("/api/ws/nyuko-list/print", { soko: 冷蔵庫, from: 開始, to: 終了 }));
    } catch (e) {
      エラー(e);
    }
  }

  return (
    <div className="nkl">
      <div className="nkl-head">
        <label className="nkl-f">
          <span>冷蔵庫選択</span>
          <select value={冷蔵庫} onChange={(e) => set冷蔵庫(Number(e.target.value))}>
            {冷蔵庫一覧.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
          </select>
        </label>
        <label className="nkl-f">
          <span>納品日</span>
          <input type="date" value={開始} onChange={(e) => e.target.value && set開始(e.target.value)} />
        </label>
        <div className="nkl-kara">～</div>
        <label className="nkl-f">
          <span>納品日</span>
          <input type="date" value={終了} onChange={(e) => e.target.value && set終了(e.target.value)} />
        </label>
        <div className="nkl-btns">
          <button onClick={印刷表示}>入庫リスト表示</button>
        </div>
        <PageClose fallback="/maruhoku" />
      </div>
      {開始 > 終了 && <p className="nkl-none">納品日の終わりを始めより後にしてください。</p>}
      <table className="nkl-grid">
        <thead>
          <tr><th>入庫日</th><th>商品名</th><th>ケース</th><th>商品kg</th><th>区分</th><th>名義</th><th>状態</th></tr>
        </thead>
        <tbody>
          {(rows ?? []).map((r) => (
            <tr key={r.出庫ID}>
              <td>{月日曜(r.納品日)}</td>
              <td className="name">{r.商品名}</td>
              <td className="r">{数(r.ケース)}</td>
              <td className="r">{数(r.商品kg)}</td>
              <td className="c">{r.タグ}</td>
              <td>{r.入庫後名義}</td>
              <td className="c">{r.積込確認 ? "積込完了" : ""}</td>
            </tr>
          ))}
          {rows && rows.length === 0 && <tr><td colSpan={7} className="nkl-none">この冷蔵庫・納品日の出荷はありません。</td></tr>}
        </tbody>
      </table>
      {印刷 && <入庫予定リスト印刷 d={印刷} onClose={() => set印刷(null)} />}
    </div>
  );
}

/** 入庫予定リスト（R_ニチレイ専用入庫リスト_ニチレイ大谷地・R_ニチレイ専用入庫リスト）。A4 横、名義ごと、1 ページ 26 行 */
function 入庫予定リスト印刷(props: { d: Rec; onClose: () => void }) {
  const d = props.d;
  const pages: { 名義: string; 行: Rec[] }[] = [];
  for (const g of d.名義 as Rec[]) for (let i = 0; i < g.行.length; i += 行数) pages.push({ 名義: g.名義, 行: g.行.slice(i, i + 行数) });
  const 題 = d.大谷地 ? "イーリクシー　入庫予定リスト" : "入庫予定リスト";
  return (
    <div className="pv">
      <div className="pv-bar">
        <span>{題}（{pages.length} 枚）</span>
        <button onClick={() => window.print()}>印刷</button>
        <button onClick={props.onClose}>閉じる</button>
      </div>
      <div className="pv-pages">
        {pages.length === 0 && <div className="pv-none">データがありません</div>}
        {pages.map((p, i) => (
          <div key={i} className="pv-page land nkr">
            <div className="nkr-time">{d.作成時間}</div>
            <div className="nkr-top">
              <span className="no">{i + 1} / {pages.length}</span>
              <span className="title">{題}</span>
              <span className="sha">{d.社名}</span>
            </div>
            <div className="nkr-range">{斜線(d.開始)}　～　{斜線(d.終了)}</div>
            <div className="nkr-sub">
              <span>入庫先：　{d.入庫先}</span>
              <span>{p.名義}　名義</span>
            </div>
            <table className="nkr-grid">
              <colgroup>
                <col style={{ width: "7%" }} /><col style={{ width: "7%" }} /><col style={{ width: "9%" }} /><col style={{ width: "6%" }} /><col style={{ width: "13%" }} />
                <col style={{ width: "5%" }} /><col style={{ width: "6%" }} /><col style={{ width: "6%" }} /><col style={{ width: "6%" }} /><col style={{ width: "9%" }} />
                <col style={{ width: "10%" }} /><col style={{ width: "16%" }} />
              </colgroup>
              <thead>
                <tr>
                  <th>納品日</th><th>出荷日</th><th>出荷場所</th><th>ｺｰﾄﾞ</th><th>商品名</th><th>ケース</th><th>商品kg</th><th>製造日</th><th>賞味期限</th><th>運送会社名</th><th>受付No</th><th>ニチレイ運行指示No</th>
                </tr>
              </thead>
              <tbody>
                {p.行.map((r, j) => {
                  const 前 = j > 0 ? p.行[j - 1] : null;
                  // 見本と同じく、便（納品日・出荷日・便）が変わるところは太い線
                  const 区切り = !前 || 前.納品日 !== r.納品日 || 前.出荷日 !== r.出荷日 || 前.輸送ID !== r.輸送ID;
                  return (
                    <tr key={j} className={区切り ? "sep" : ""}>
                      <td className="c">{月日2(r.納品日)}</td>
                      <td className="c">{年月日2(r.出荷日)}</td>
                      <td className="c">{r.出荷場所}</td>
                      <td className="c">{r.商品コード}</td>
                      <td className="c name">{r.商品名}</td>
                      <td className="r">{数(r.ケース)}</td>
                      <td className="r">{数(r.商品kg)}</td>
                      <td className="c">{年月日2(r.製造日)}</td>
                      <td className="c">{年月日2(r.賞味期限)}</td>
                      <td className="c">{r.運送会社名}</td>
                      <td className="c">{r.受付No}</td>
                      <td className="c">{r.運行指示No}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ))}
      </div>
    </div>
  );
}
