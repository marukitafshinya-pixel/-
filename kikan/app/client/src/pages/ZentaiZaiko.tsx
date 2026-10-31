import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { api, ApiError } from "../api";
import { PageClose } from "../formParts";

type Rec = Record<string, any>;
const エラー = (e: unknown) => alert(e instanceof ApiError ? e.message : String(e));
const 日付 = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const 数 = (v: unknown, 小数 = 0) => (v === null || v === undefined ? "" : Number(v).toLocaleString("ja-JP", { maximumFractionDigits: 小数, minimumFractionDigits: 小数 }));
const 斜線 = (v: string) => v.replace(/-/g, "/");

/**
 * 全体在庫（Access の 丸北商品推移 の FM_現在在庫表示）。集計開始日〜集計終了日で［集計］すると、
 * 製造（まだ在庫にしていない分）・WorkStation の在庫・倉庫管理の在庫を倉庫・商品ごとにまとめ、半年・年間の出荷から在庫率を出す。
 * 商品コードをダブルクリックすると商品推移。［在庫不足リスト］［少量在庫リスト］で印刷。
 */
export default function ZentaiZaiko() {
  const nav = useNavigate();
  const 今日 = new Date();
  const [開始, set開始] = useState(日付(new Date(今日.getFullYear(), 今日.getMonth(), 1)));
  const [終了, set終了] = useState(日付(今日));
  const [倉庫, set倉庫] = useState(0);
  const [d, setD] = useState<{ 倉庫: Rec[]; 行: Rec[] } | null>(null);
  const [集計中, set集計中] = useState(false);
  const [印刷, set印刷] = useState<Rec | null>(null);

  async function 集計() {
    set集計中(true);
    try {
      setD(await api.get<{ 倉庫: Rec[]; 行: Rec[] }>("/api/zentai-zaiko", { from: 開始, to: 終了 }));
    } catch (e) {
      エラー(e);
    } finally {
      set集計中(false);
    }
  }
  async function リスト(kind: "fusoku" | "shoryo") {
    try {
      const r = await api.get<Rec>("/api/zentai-zaiko/list", { from: 開始, to: 終了, kind });
      set印刷({ ...r, 題: kind === "fusoku" ? "在庫不足リスト" : "少量在庫リスト" });
    } catch (e) {
      エラー(e);
    }
  }
  const 行 = (d?.行 ?? []).filter((r) => !倉庫 || r.倉庫ID === 倉庫);
  return (
    <div className="ssi">
      <div className="ssi-head">
        <div className="ssi-title">全体在庫</div>
        <label className="ssi-f"><span>集計開始日</span><input type="date" value={開始} onChange={(e) => e.target.value && set開始(e.target.value)} /></label>
        <label className="ssi-f"><span>集計終了日</span><input type="date" value={終了} onChange={(e) => e.target.value && set終了(e.target.value)} /></label>
        <button onClick={集計} disabled={集計中}>{集計中 ? "集計中…" : "集計"}</button>
        <label className="ssi-f">
          <span>倉庫</span>
          <select value={倉庫} onChange={(e) => set倉庫(Number(e.target.value))} disabled={!d}>
            <option value={0}>すべて</option>
            {(d?.倉庫 ?? []).map((x) => <option key={x.id} value={x.id}>{x.id} {x.name}</option>)}
          </select>
        </label>
        <button onClick={() => リスト("fusoku")}>在庫不足リスト</button>
        <button onClick={() => リスト("shoryo")}>少量在庫リスト</button>
        <PageClose fallback="/suii" />
      </div>
      {!d && <p className="ssi-none">集計の期間を選んで［集計］を押してください。</p>}
      {d && (
        <div className="ssi-scroll zz-list">
          <table className="ssi-grid">
            <thead>
              <tr>
                <th>倉庫</th><th>コード</th><th>商品名</th><th>入数</th><th>繰越</th><th>入庫</th><th>出庫</th><th>在庫ケース</th><th>在庫kg</th>
                <th>半年出荷</th><th>年間出荷</th><th>平均年間</th><th>現在在庫率</th><th>年間在庫率</th><th>最小受注</th><th>最大受注</th>
              </tr>
            </thead>
            <tbody>
              {行.map((r, i) => (
                <tr key={i}>
                  <td>{r.倉庫名 ?? r.倉庫ID}</td>
                  <td className="r dbl" title="ダブルクリックで商品推移" onDoubleClick={() => nav(`/suii?code=${r.商品コード}`)}>{r.商品コード}</td>
                  <td>{r.商品名}</td>
                  <td className="r">{数(r.入数, 2)}</td>
                  <td className="r">{数(r.繰越ケース)}</td>
                  <td className="r">{数(r.範囲入庫ケース)}</td>
                  <td className="r">{数(r.範囲出庫ケース)}</td>
                  <td className={"r b" + (r.在庫ケース < 0 ? " minus" : "")}>{数(r.在庫ケース)}</td>
                  <td className="r">{数(r.在庫kg)}</td>
                  <td className="r">{数(r.半年ケース)}</td>
                  <td className="r">{数(r.年間ケース)}</td>
                  <td className="r">{数(r.平均年間ケース, 1)}</td>
                  <td className={"r" + (r.現在在庫率 !== null && r.現在在庫率 < 3 ? " minus" : "")}>{数(r.現在在庫率, 2)}</td>
                  <td className="r">{数(r.年間在庫率, 2)}</td>
                  <td className="r">{数(r.最小受注数)}</td>
                  <td className="r">{数(r.最大受注数)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="ssi-note">{行.length} 行。在庫ケースが 0 の行は出しません。現在在庫率＝在庫 ÷ 半年の出荷の 1 か月分、年間在庫率＝在庫 ÷ 年間の出荷の 1 か月分（取引元 11・1254 の出荷は数えない）。</p>
        </div>
      )}
      {印刷 && <在庫リスト印刷 x={印刷} onClose={() => set印刷(null)} />}
    </div>
  );
}

/** 在庫不足リスト（R_在庫不足リスト）・少量在庫リスト（R_少量在庫リスト）。A4 縦、1 ページ 40 行 */
function 在庫リスト印刷(props: { x: Rec; onClose: () => void }) {
  const { x } = props;
  const 行: Rec[] = x.行;
  const pages: Rec[][] = [];
  for (let i = 0; i < 行.length; i += 40) pages.push(行.slice(i, i + 40));
  if (!pages.length) pages.push([]);
  return (
    <div className="pv">
      <div className="pv-bar">
        <span>{x.題}（{pages.length} 枚）</span>
        <button onClick={() => window.print()}>印刷</button>
        <button onClick={props.onClose}>閉じる</button>
      </div>
      <div className="pv-pages">
        {pages.map((p, i) => (
          <div key={i} className="pv-page zz-pr">
            <div className="zz-pr-head">
              <span className="t">{x.題}</span>
              <span>集計期間 {斜線(x.開始)} ～ {斜線(x.終了)}</span>
              <span>{x.作成時間}　{i + 1} / {pages.length}</span>
            </div>
            <table className="zz-pr-grid">
              <thead>
                <tr><th>取引先</th><th>倉庫</th><th>コード</th><th>商品名</th><th>在庫ケース</th><th>半年出荷</th><th>年間出荷</th><th>現在在庫率</th><th>在庫率</th><th>最大受注</th></tr>
              </thead>
              <tbody>
                {p.map((r, j) => (
                  <tr key={j}>
                    <td>{r.取引先名}</td>
                    <td>{r.倉庫名}</td>
                    <td className="r">{r.商品コード}</td>
                    <td>{r.商品名}</td>
                    <td className="r">{数(r.在庫ケース)}</td>
                    <td className="r">{数(r.半年ケース)}</td>
                    <td className="r">{数(r.年間ケース)}</td>
                    <td className="r">{数(r.現在在庫率, 2)}</td>
                    <td className="r">{r.在庫率}</td>
                    <td className="r">{数(r.最大受注数)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))}
      </div>
    </div>
  );
}
