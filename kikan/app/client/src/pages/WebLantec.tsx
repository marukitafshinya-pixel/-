import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api, ApiError, num, upload, 処理中 } from "../api";
import { Field, parseDate, today } from "../formParts";

type Rec = Record<string, any>;
const エラー = (e: unknown) => alert(e instanceof ApiError ? e.message : String(e));
const 日を足す = (d: string, k: number) => new Date(Date.parse(d + "T00:00:00Z") + k * 86400000).toISOString().slice(0, 10);
const 曜 = "日月火水木金土";
/** Access の Format(日付, "m月dd日(aaa)") */
const 月日曜 = (v: string | null | undefined) => {
  if (!v) return "";
  const d = new Date(v.slice(0, 10) + "T00:00:00Z");
  return `${d.getUTCMonth() + 1}月${String(d.getUTCDate()).padStart(2, "0")}日(${曜[d.getUTCDay()]})`;
};

/**
 * ランテック輸送手配（Access の F_ランテック輸送手配・F_ランテックチェックリスト）。
 * 上：出荷計画日の便の一覧（送り状番号を見る・直す）。ランテックの発注一覧から出した「発注一覧明細CSV」を取り込むと、
 * Access と同じ決まりで便に送り状番号を書き、下のチェックリストに取り込んだ明細と「Access側に一致するデータ無し」を出す。
 */
export function WebLantec() {
  const nav = useNavigate();
  const [日付, set日付] = useState<string>(today());
  const [便, set便] = useState<Rec[]>([]);
  const [明細, set明細] = useState<Rec[]>([]);
  const [結果, set結果] = useState<Rec | null>(null);
  const 便を読む = (d = 日付) => api.get<Rec[]>(`/api/web/lantec/bins?日付=${d}`).then(set便).catch(エラー);
  const 明細を読む = () => api.get<Rec[]>("/api/web/lantec/check").then(set明細).catch(エラー);
  useEffect(() => {
    便を読む(日付);
  }, [日付]);
  useEffect(() => {
    明細を読む();
  }, []);
  async function 端(k: "最初" | "最後") {
    const r = await api.get<Rec>("/api/web/lantec/range").catch((e) => (エラー(e), null));
    if (r?.[k]) set日付(r[k]);
  }
  async function 取り込む(f: File | undefined) {
    if (!f) return;
    try {
      const r = await 処理中(() => upload<Rec>("/api/web/lantec/import", f));
      set結果(r);
      便を読む();
      明細を読む();
    } catch (e) {
      エラー(e);
    }
  }
  async function 番号を直す(b: Rec, v: string | null) {
    if ((v ?? "") === (b.web輸送送り状No ?? "")) return;
    try {
      await api.post("/api/web/lantec/okurijo", { 輸送ID: b.輸送ID, 送り状No: v });
      便を読む();
    } catch (e) {
      エラー(e);
    }
  }
  const 不一致 = 明細.filter((r) => r.アンマッチchk);
  const 明細表 = (rows: Rec[], 空: string) => (
    <table className="sz-grid sko-grid">
      <thead><tr><th>送り状No</th><th>出荷日</th><th>発送元</th><th>ケース</th><th>お届け先</th><th>着日</th><th>商品CD</th><th>商品名</th></tr></thead>
      <tbody>
        {rows.length === 0 && <tr><td colSpan={8} className="c">{空}</td></tr>}
        {rows.map((r) => (
          <tr key={r.ID} className={r.アンマッチchk ? "sel" : ""}>
            <td>{r.送り状No}</td><td>{月日曜(r.出荷日)}</td><td className="name">{r.発送元}</td><td className="r">{num(r.ケース)}</td>
            <td className="name">{r.お届け先}</td><td>{月日曜(r.着日)}</td><td className="r">{r.商品CD}</td><td className="name">{r.商品名}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
  return (
    <div className="sz sko">
      <div className="kk-head">
        <div className="kk-title">ランテック輸送手配</div>
        <button onClick={() => nav(-1)}>閉じる</button>
      </div>
      <div className="sko-pad">
        出荷計画日 <button onClick={() => 端("最初")}>最初</button> <button onClick={() => set日付(日を足す(日付, -1))}>◀</button>{" "}
        <Field value={日付} kind="date" className="sko-date" onCommit={(x) => { const d = parseDate(x); if (!d) return alert("日付の書き方が正しくありません。"); set日付(d); }} />{" "}
        <button onClick={() => set日付(日を足す(日付, 1))}>▶</button> <button onClick={() => 端("最後")}>最後</button>{" "}
        <button onClick={() => set日付(today())}>今日</button>
      </div>
      <div className="sko-gridwrap">
        <table className="sz-grid sko-grid">
          <thead><tr><th>輸送ID</th><th>出庫場所</th><th>出庫No</th><th>運送会社</th><th>車番</th><th>倉庫</th><th>届け先</th><th>納品日</th><th>ケース</th><th>送り状No</th></tr></thead>
          <tbody>
            {便.length === 0 && <tr><td colSpan={10} className="c">この日の便はありません</td></tr>}
            {便.map((b) => (
              <tr key={b.輸送ID} className={b.運送会社ID === 24 ? "" : "done"}>
                <td className="r">{b.輸送ID}</td><td>{b.出庫場所}</td><td className="r">{b.出庫No}</td><td>{b.運送会社名}</td><td>{b.車番}</td>
                <td className="name">{b.倉庫}</td><td className="name">{b.届け先}</td><td>{月日曜(b.納品日)}</td><td className="r">{num(b.ケース)}</td>
                <td><Field value={b.web輸送送り状No ?? ""} onCommit={(v) => 番号を直す(b, v)} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="sko-pad">
        <b>ランテックの送り状番号を取り込む</b>　ランテックの発注一覧で全件を選んで［CSV ダウンロード］したファイル（発注一覧明細CSV_日付.csv）を選んでください。
        <input type="file" accept=".csv" onChange={(e) => { 取り込む(e.target.files?.[0]); e.target.value = ""; }} />
        {結果 && (
          <div className="small">
            {結果.取込} 行を取り込み、{結果.書込} か所の便に送り状番号を書きました。便に付かなかった送り状：{結果.不一致} 件
          </div>
        )}
        <div className="small">送り状番号を書くのは、出荷計画日が今日以降のランテックの便だけです（出荷日・納品日・発送元・届け先・商品コード・ケース数が同じ便を探します）。</div>
      </div>
      <div className="sko-pad"><b>Access側に一致するデータ無し</b>（{不一致.length} 行）</div>
      <div className="sko-gridwrap">{明細表(不一致, "ありません")}</div>
      <div className="sko-pad"><b>取り込んだ明細</b>（{明細.length} 行）</div>
      <div className="sko-gridwrap">{明細表(明細, "まだ取り込んでいません")}</div>
    </div>
  );
}
