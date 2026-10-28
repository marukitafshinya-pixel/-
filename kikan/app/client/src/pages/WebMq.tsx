import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api, ApiError, num, upload, 処理中 } from "../api";
import { Field, parseDate, today, PageClose } from "../formParts";

type Rec = Record<string, any>;
const エラー = (e: unknown) => alert(e instanceof ApiError ? e.message : String(e));
const 日を足す = (d: string, k: number) => new Date(Date.parse(d + "T00:00:00Z") + k * 86400000).toISOString().slice(0, 10);
const 年月日2 = (v: string | null | undefined) => (v ? v.slice(2, 10).replace(/-/g, "/") : "");

/**
 * MerQurius 納入日程（Access の modMerQurius）。1) MerQurius から出した納入日程 CSV を取り込む → 2) 出荷日の範囲を選んで照合し、登録用 CSV（Shift_JIS）をダウンロード →
 * 3) MerQurius の「CSV 登録」でそのファイルを選ぶ。照合の結果（新規・変更あり・登録済み・要確認）は下の確認一覧で見る。
 */
export function WebMq() {
  const nav = useNavigate();
  const [状況, set状況] = useState<Rec | null>(null);
  const [開始, set開始] = useState<string | null>(日を足す(today(), -7));
  const [終了, set終了] = useState<string | null>(日を足す(today(), 14));
  const [結果, set結果] = useState<Rec | null>(null);
  const [一覧, set一覧] = useState<Rec[]>([]);
  const 読む = () => {
    api.get<Rec>("/api/web/mq/status").then(set状況).catch(エラー);
    api.get<Rec[]>("/api/web/mq/list").then(set一覧).catch(エラー);
  };
  useEffect(読む, []);
  async function 取り込む(f: File | undefined) {
    if (!f) return;
    try {
      const r = await 処理中(() => upload<Rec>("/api/web/mq/import", f));
      alert(`${r.件数} 件を取り込みました。`);
      読む();
    } catch (e) {
      エラー(e);
    }
  }
  function 保存(b64: string, 名前: string) {
    const bin = atob(b64);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([bytes], { type: "text/csv" }));
    a.download = 名前;
    document.body.appendChild(a);
    a.click();
    a.remove();
  }
  async function 作る() {
    if (!開始 || !終了) return;
    try {
      const r = await 処理中(() => api.post<Rec>("/api/web/mq/build", { 開始, 終了 }));
      set結果(r);
      読む();
      if (r.csv) 保存(r.csv, r.ファイル名);
    } catch (e) {
      エラー(e);
    }
  }
  const 日 = (v: string | null, set: (x: string | null) => void) => (
    <Field value={v} kind="date" className="sko-date" onCommit={(x) => { const d = parseDate(x); if (d === undefined) return alert("日付の書き方が正しくありません。"); set(d); }} />
  );
  return (
    <div className="sz sko">
      <div className="kk-head">
        <div className="kk-title">MerQurius 納入日程</div>
        <PageClose fallback="/web" />
      </div>
      <div className="sko-pad">
        <b>1. 納入日程 CSV を取り込む</b>　MerQurius の納入日程一覧から出した CSV を選んでください。
        <input type="file" accept=".csv" onChange={(e) => { 取り込む(e.target.files?.[0]); e.target.value = ""; }} />
        <span className="small">　いま取り込んであるもの：{状況 ? `${num(状況.件数)} 件（${状況.取込日時 ?? "なし"}）` : ""}</span>
      </div>
      <div className="sko-pad">
        <b>2. 照合して登録用 CSV を作る</b>　対象の出荷日 {日(開始, set開始)} 〜 {日(終了, set終了)}
        <button className="blue" onClick={作る}>照合して CSV を作る</button>
        {結果 && (
          <div className="small">
            {Object.keys(結果.件数).length === 0 ? "対象データがありません。" : Object.entries(結果.件数).map(([k, v]) => `${k}：${v} 件`).join("　")}
            {結果.csv ? <>　<button onClick={() => 保存(結果.csv, 結果.ファイル名)}>登録用 CSV をもう一度保存</button>（{結果.ファイル名}）</> : "　登録の対象はありません。"}
          </div>
        )}
      </div>
      <div className="sko-pad"><b>3.</b> MerQurius の「CSV 登録」で、保存した登録用 CSV を選んでください。</div>
      <div className="sko-gridwrap">
        <table className="sz-grid sko-grid">
          <thead><tr><th>状態</th><th>注文番号</th><th>枝番</th><th>差異</th><th>出荷日</th><th>納品日</th><th>コード</th><th>商品名</th><th>ケース</th><th>kg</th><th>製造日</th><th>賞味期限</th><th>帳合</th><th>出庫ID</th></tr></thead>
          <tbody>
            {一覧.length === 0 && <tr><td colSpan={14} className="c">まだ照合していません</td></tr>}
            {一覧.map((r) => (
              <tr key={r.出庫ID} className={String(r.状態).startsWith("要確認") ? "sel" : r.状態 === "登録済み" ? "done" : ""}>
                <td>{r.状態}</td><td>{r.注文番号}</td><td className="r">{r.枝番 || ""}</td><td className="small">{r.差異}</td><td>{年月日2(r.出荷日)}</td><td>{年月日2(r.納品日)}</td>
                <td className="r">{r.商品コード}</td><td className="name">{r.商品名}</td><td className="r">{num(r.ケース)}</td><td className="r">{num(r.商品kg)}</td>
                <td>{年月日2(r.製造日)}</td><td>{年月日2(r.賞味期限)}</td><td>{r.取引帳合}</td><td className="r">{r.出庫ID}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
