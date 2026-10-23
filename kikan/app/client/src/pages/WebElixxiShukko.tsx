import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api, ApiError, num } from "../api";
import { Field, parseDate, today } from "../formParts";
import { 入力用の文字 } from "./webHojoScript";

type Rec = Record<string, any>;
const エラー = (e: unknown) => alert(e instanceof ApiError ? e.message : String(e));
const 年月日 = (v: string | null | undefined) => (v ? v.slice(0, 10).replace(/-/g, "/") : "");

/**
 * elixxi 出庫依頼（Access の F_出庫リスト表示）。倉庫管理の便を期間と出庫場所（ニチレイ 5 拠点）で絞って出す。
 * 便を選ぶと、elixxi の「出庫依頼登録」に入れる中身を出す。運行指令No を入れると受注登録に書き戻す。
 */
export function WebElixxiShukko() {
  const nav = useNavigate();
  const [開始, set開始] = useState<string>(today());
  const [終了, set終了] = useState<string>(today());
  const [場所, set場所] = useState<string>("");
  const [場所一覧, set場所一覧] = useState<Rec[]>([]);
  const [一覧, set一覧] = useState<Rec[]>([]);
  const [選択, set選択] = useState<number | null>(null);
  const [中身, set中身] = useState<Rec | null | undefined>(undefined);
  useEffect(() => {
    api.get<Rec[]>("/api/web/elixxi/shukko/basho").then(set場所一覧).catch(エラー);
  }, []);
  const 読む = () =>
    api.get<Rec[]>(`/api/web/elixxi/shukko/list?開始=${開始}&終了=${終了}&場所=${場所}`).then(set一覧).catch(エラー);
  useEffect(() => {
    set選択(null);
    set中身(undefined);
    読む();
  }, [開始, 終了, 場所]);
  useEffect(() => {
    if (選択 === null) return;
    api.get<Rec>(`/api/web/elixxi/shukko/detail?輸送ID=${選択}`).then((r) => set中身(r.中身)).catch(エラー);
  }, [選択]);
  async function 番号(b: Rec, 項目: "運行指令No" | "車号", v: string | null) {
    if ((v ?? "") === String(b[項目] ?? "")) return;
    try {
      const r = await api.post<Rec>("/api/web/elixxi/shukko/bango", { 輸送ID: b.輸送ID, 項目, 値: v });
      if (項目 === "運行指令No" && r.受注件数) alert(`受注 ${r.受注件数} 件に運行指令No・車号を書きました。`);
      読む();
    } catch (e) {
      エラー(e);
    }
  }
  function コピー() {
    if (!中身) return;
    const 行 = [["入庫No", "出庫個数"], ...中身.明細.map((x: Rec) => [x.入庫No, x.出庫個数])];
    navigator.clipboard.writeText(行.map((r) => r.join("\t")).join("\n")).then(() => alert("明細をコピーしました。"), エラー);
  }
  function 入力用() {
    if (!中身) return;
    navigator.clipboard.writeText(入力用の文字("出庫", 中身)).then(
      () => alert("コピーしました。elixxi の「出庫依頼登録」の画面で「基幹 入力」のブックマークを押してください。"),
      エラー,
    );
  }
  const 日 = (v: string, set: (x: string) => void) => (
    <Field value={v} kind="date" className="sko-date" onCommit={(x) => { const d = parseDate(x); if (!d) return alert("日付の書き方が正しくありません。"); set(d); }} />
  );
  const 便 = 一覧.find((b) => b.輸送ID === 選択);
  return (
    <div className="sz sko">
      <div className="kk-head no-print">
        <div className="kk-title">elixxi 出庫依頼</div>
        <button onClick={() => nav(-1)}>閉じる</button>
      </div>
      <div className="sko-pad no-print">
        出庫場所{" "}
        <select value={場所} onChange={(e) => set場所(e.target.value)}>
          <option value="">すべて</option>
          {場所一覧.map((x) => <option key={x.短縮コード} value={x.短縮コード}>{x.短縮名}</option>)}
        </select>
        　出荷計画日 {日(開始, set開始)} 〜 {日(終了, set終了)}
        <span className="small">　（30 日前より後の便だけ）便を選ぶと、elixxi に入れる中身が下に出ます。</span>
      </div>
      <div className="sko-gridwrap no-print">
        <table className="sz-grid sko-grid">
          <thead><tr><th>出荷計画日</th><th>出庫場所</th><th>出庫No</th><th>輸送ID</th><th>運送会社</th><th>車番</th><th>届け先</th><th>納品日</th><th>ケース</th><th>運行指令No</th><th>車号</th></tr></thead>
          <tbody>
            {一覧.length === 0 && <tr><td colSpan={11} className="c">この期間の便はありません</td></tr>}
            {一覧.map((b) => (
              <tr key={b.輸送ID} className={b.輸送ID === 選択 ? "sel" : ""} onClick={() => set選択(b.輸送ID)}>
                <td>{年月日(b.出荷計画日)}</td><td>{b.出庫場所}</td><td className="r">{b.出庫No}</td><td className="r">{b.輸送ID}</td><td>{b.運送会社名}</td><td>{b.車番}</td>
                <td className="name">{b.届け先}</td><td>{年月日(b.納品日)}</td><td className="r">{num(b.ケース)}</td>
                <td onClick={(e) => e.stopPropagation()}><Field value={b.運行指令No === null ? "" : String(b.運行指令No)} onCommit={(v) => 番号(b, "運行指令No", v)} /></td>
                <td onClick={(e) => e.stopPropagation()}><Field value={b.車号 ?? ""} onCommit={(v) => 番号(b, "車号", v)} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {便 && 中身 !== undefined && (
        <>
          <div className="sko-pad">
            <b>elixxi の出庫依頼登録に入れる中身</b>　輸送ID {便.輸送ID}・{便.出庫場所}・{年月日(便.出荷計画日)}
            <span className="no-print">　<button onClick={() => window.print()}>印刷</button> <button onClick={コピー} disabled={!中身}>明細をコピー</button> <button className="blue" onClick={入力用} disabled={!中身}>elixxi 入力用にコピー</button> <button onClick={() => nav("/web/hojo")}>使い方</button></span>
          </div>
          {!中身 ? (
            <div className="sko-pad small">この便には出庫の明細がありません。</div>
          ) : (
            <>
              <table className="sz-grid sko-grid" style={{ margin: "0 8px 8px" }}>
                <tbody>
                  <tr><th>拠点</th><td>{中身.拠点コード ? `${中身.拠点コード}（${中身.拠点名}）` : "elixxi 拠点コードマスタにない倉庫です"}</td><th>出庫日</th><td>{中身.出庫日}</td><th>納品日</th><td>{中身.納品日}</td></tr>
                  <tr><th>依頼No</th><td>{中身.依頼No}</td><th>摘要</th><td colSpan={3}>{中身.摘要}</td></tr>
                  <tr><th>出庫先コード</th><td>{中身.出庫先コード}</td><th>出庫先名</th><td colSpan={3}>{中身.出庫先名}</td></tr>
                  <tr><th>扱い便コード</th><td>{中身.扱い便コード}</td><th>扱い便名</th><td colSpan={3}>{中身.扱い便名}</td></tr>
                </tbody>
              </table>
              <div className="sko-pad">{中身.件数} 件・合計 {num(中身.ケース計)} 個</div>
              <div className="sko-gridwrap">
                <table className="sz-grid sko-grid">
                  <thead><tr><th>No</th><th>入庫No</th><th>出庫個数</th><th>商品コード</th><th>商品名</th><th>製造日</th><th>賞味期限</th></tr></thead>
                  <tbody>
                    {中身.明細.map((x: Rec, i: number) => (
                      <tr key={i}>
                        <td className="r">{i + 1}</td><td>{x.入庫No}</td><td className="r">{num(x.出庫個数)}</td><td className="r">{x.商品コード}</td>
                        <td className="name">{x.商品名}</td><td>{x.製造日}</td><td>{x.賞味期限}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}
