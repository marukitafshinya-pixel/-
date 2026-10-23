import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api, ApiError, num } from "../api";
import { Field, parseDate, today } from "../formParts";

type Rec = Record<string, any>;
const エラー = (e: unknown) => alert(e instanceof ApiError ? e.message : String(e));
const 日を足す = (d: string, k: number) => new Date(Date.parse(d + "T00:00:00Z") + k * 86400000).toISOString().slice(0, 10);
const 年月日 = (v: string | null | undefined) => (v ? v.slice(0, 10).replace(/-/g, "/") : "");

/**
 * elixxi 入庫依頼（Access の F_Web出力選択）。出荷計画日ごとに、ニチレイ 5 拠点へ倉庫として入れる便・届け先・名義の一覧を出す。
 * 行を選ぶと、商品ごとの出荷と、elixxi の「入庫依頼登録」に入れる中身（拠点・入庫日・扱い便・明細）を出す。登録後に出た受付番号はこの一覧に入れる。
 */
export function WebElixxiNyuko() {
  const nav = useNavigate();
  const [日付, set日付] = useState<string>(today());
  const [一覧, set一覧] = useState<Rec[]>([]);
  const [選択, set選択] = useState<number | null>(null);
  const [詳細, set詳細] = useState<Rec | null>(null);
  const [準備, set準備] = useState(false);
  useEffect(() => {
    api.post("/api/web/elixxi/nyuko/open", {}).catch(エラー).finally(() => set準備(true));
  }, []);
  const 読む = (d = 日付) => api.get<Rec[]>(`/api/web/elixxi/nyuko/list?日付=${d}`).then(set一覧).catch(エラー);
  useEffect(() => {
    if (!準備) return;
    set選択(null);
    set詳細(null);
    読む(日付);
  }, [日付, 準備]);
  useEffect(() => {
    if (選択 === null) return;
    api.get<Rec>(`/api/web/elixxi/nyuko/detail?ID=${選択}`).then(set詳細).catch(エラー);
  }, [選択]);
  async function 端(k: "最初" | "最後") {
    const r = await api.get<Rec>("/api/web/lantec/range").catch((e) => (エラー(e), null));
    if (r?.[k]) set日付(r[k]);
  }
  async function 番号(r: Rec, v: string | null) {
    if ((v ?? "") === (r.入庫受付番号 ?? "")) return;
    try {
      await api.post("/api/web/elixxi/nyuko/uketsuke", { ID: r.ID, 入庫受付番号: v });
      読む();
    } catch (e) {
      エラー(e);
    }
  }
  function コピー() {
    const m = 詳細?.中身;
    if (!m) return;
    const 行 = [["商品CD", "品名", "マーク", "入庫予定個数", "製造日", "賞味期限"], ...m.明細.map((x: Rec) => [x.商品CD, x.品名, x.マーク, x.入庫予定個数, x.製造日, x.賞味期限])];
    navigator.clipboard.writeText(行.map((r) => r.join("\t")).join("\n")).then(() => alert("明細をコピーしました。"), エラー);
  }
  const 選んだ行 = 一覧.find((r) => r.ID === 選択);
  const m = 詳細?.中身;
  return (
    <div className="sz sko">
      <div className="kk-head no-print">
        <div className="kk-title">elixxi 入庫依頼</div>
        <button onClick={() => nav(-1)}>閉じる</button>
      </div>
      <div className="sko-pad no-print">
        出荷予定日 <button onClick={() => 端("最初")}>最初</button> <button onClick={() => set日付(日を足す(日付, -1))}>◀</button>{" "}
        <Field value={日付} kind="date" className="sko-date" onCommit={(x) => { const d = parseDate(x); if (!d) return alert("日付の書き方が正しくありません。"); set日付(d); }} />{" "}
        <button onClick={() => set日付(日を足す(日付, 1))}>▶</button> <button onClick={() => 端("最後")}>最後</button> <button onClick={() => set日付(today())}>今日</button>
        <span className="small">　行を選ぶと、elixxi に入れる中身が下に出ます。elixxi で登録したら、出た受付番号を「受付番号」に入れてください。</span>
      </div>
      <div className="sko-gridwrap no-print">
        <table className="sz-grid sko-grid">
          <thead><tr><th>出荷計画日</th><th>納品日</th><th>届け先</th><th>名義</th><th>kg</th><th>輸送ID</th><th>運送会社</th><th>車番</th><th>受付番号</th></tr></thead>
          <tbody>
            {一覧.length === 0 && <tr><td colSpan={9} className="c">この日の入庫依頼はありません</td></tr>}
            {一覧.map((r) => (
              <tr key={r.ID} className={r.ID === 選択 ? "sel" : ""} onClick={() => set選択(r.ID)}>
                <td>{年月日(r.出荷計画日)}</td><td>{年月日(r.納品日)}</td><td className="name">{r.届け先}</td><td>{r.入庫後名義名}</td>
                <td className="r">{num(r.商品kg)}</td><td className="r">{r.輸送ID}</td><td>{r.運送会社名}</td><td>{r.車番}</td>
                <td onClick={(e) => e.stopPropagation()}><Field value={r.入庫受付番号 ?? ""} onCommit={(v) => 番号(r, v)} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {選んだ行 && 詳細 && (
        <>
          <div className="sko-pad">
            <b>elixxi の入庫依頼登録に入れる中身</b>　{選んだ行.届け先}・{年月日(選んだ行.納品日)} 着・{選んだ行.入庫後名義名}
            {選んだ行.入庫受付番号 ? `・受付番号 ${選んだ行.入庫受付番号}（登録し直すときは elixxi で訂正）` : "・まだ受付番号はありません"}
            <span className="no-print">　<button onClick={() => window.print()}>印刷</button> <button onClick={コピー} disabled={!m}>明細をコピー</button></span>
          </div>
          {!m ? (
            <div className="sko-pad small">
              elixxi に入れる明細がありません。大谷地以外は、丸北北海道の名義で届け先のグループコード2 が 1 のものだけが対象です。また、出荷日が出荷計画日と違う出荷は入りません（Access と同じ）。
            </div>
          ) : (
            <>
              <div className="sko-pad">
                拠点：{m.拠点コード ? `${m.拠点コード}（${m.拠点名}）` : "elixxi 拠点コードマスタにない届け先です"}　入庫日：{m.入庫日}　扱い便名：{m.扱い便名}　{m.件数} 件・合計 {num(m.ケース計)} 個
              </div>
              <div className="sko-gridwrap">
                <table className="sz-grid sko-grid">
                  <thead><tr><th>No</th><th>商品CD</th><th>品名</th><th>マーク</th><th>入庫予定個数</th><th>製造日</th><th>賞味期限</th></tr></thead>
                  <tbody>
                    {m.明細.map((x: Rec, i: number) => (
                      <tr key={i}>
                        <td className="r">{i + 1}</td><td className="r">{x.商品CD}</td><td className="name">{x.品名}</td><td>{x.マーク}</td>
                        <td className="r">{num(x.入庫予定個数)}</td><td>{x.製造日}</td><td>{x.賞味期限}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
          <div className="sko-pad no-print"><b>出荷内訳</b>（商品ごとのケース）</div>
          <div className="sko-gridwrap no-print">
            <table className="sz-grid sko-grid">
              <thead><tr><th>倉庫</th><th>商品コード</th><th>商品名</th><th>ケース</th></tr></thead>
              <tbody>
                {詳細.内訳.map((x: Rec, i: number) => (
                  <tr key={i}><td>{x.倉庫名}</td><td className="r">{x.商品コード}</td><td className="name">{x.商品名}</td><td className="r">{num(x.ケース)}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
