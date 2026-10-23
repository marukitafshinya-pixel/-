import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api, ApiError, num } from "../api";
import { Field, parseDate, today } from "../formParts";

type Rec = Record<string, any>;
const エラー = (e: unknown) => alert(e instanceof ApiError ? e.message : String(e));
const 日を足す = (d: string, k: number) => new Date(Date.parse(d + "T00:00:00Z") + k * 86400000).toISOString().slice(0, 10);
const 年月日 = (v: string | null | undefined) => (v ? v.slice(0, 10).replace(/-/g, "/") : "");

/** 出荷予定日の ◀▶・最初・最後・今日（Access の画面と同じ。最初・最後は WorkStation の便の日付） */
function 日付の行({ 日付, set日付 }: { 日付: string; set日付: (d: string) => void }) {
  async function 端(k: "最初" | "最後") {
    const r = await api.get<Rec>("/api/web/lantec/range").catch((e) => (エラー(e), null));
    if (r?.[k]) set日付(r[k]);
  }
  return (
    <>
      出荷予定日 <button onClick={() => 端("最初")}>最初</button> <button onClick={() => set日付(日を足す(日付, -1))}>◀</button>{" "}
      <Field value={日付} kind="date" className="sko-date" onCommit={(x) => { const d = parseDate(x); if (!d) return alert("日付の書き方が正しくありません。"); set日付(d); }} />{" "}
      <button onClick={() => set日付(日を足す(日付, 1))}>▶</button> <button onClick={() => 端("最後")}>最後</button> <button onClick={() => set日付(today())}>今日</button>
    </>
  );
}

/**
 * 販盛 在庫移動（Access の F_販盛在庫移動）。一覧は elixxi 入庫依頼と同じ（倉庫向け・ニチレイ 5 拠点）。
 * 行を選ぶと、販盛の在庫移動に入れる中身と、出荷内訳（行ごとにロット統合に入れる中身）を出す。
 */
export function WebHanmoriIdou() {
  const nav = useNavigate();
  const [日付, set日付] = useState<string>(today());
  const [一覧, set一覧] = useState<Rec[]>([]);
  const [選択, set選択] = useState<number | null>(null);
  const [詳細, set詳細] = useState<Rec | null>(null);
  const [準備, set準備] = useState(false);
  useEffect(() => {
    api.post("/api/web/elixxi/nyuko/open", {}).catch(エラー).finally(() => set準備(true));
  }, []);
  useEffect(() => {
    if (!準備) return;
    set選択(null);
    set詳細(null);
    api.get<Rec[]>(`/api/web/elixxi/nyuko/list?日付=${日付}`).then(set一覧).catch(エラー);
  }, [日付, 準備]);
  useEffect(() => {
    if (選択 === null) return;
    api.get<Rec>(`/api/web/hanmori/idou/detail?ID=${選択}`).then(set詳細).catch(エラー);
  }, [選択]);
  const 行 = 一覧.find((r) => r.ID === 選択);
  const m = 詳細?.中身;
  return (
    <div className="sz sko">
      <div className="kk-head no-print">
        <div className="kk-title">販盛 在庫移動</div>
        <button onClick={() => nav(-1)}>閉じる</button>
      </div>
      <div className="sko-pad no-print">
        <日付の行 日付={日付} set日付={set日付} />
        <span className="small">　行を選ぶと、販盛の在庫移動に入れる中身が下に出ます。</span>
      </div>
      <div className="sko-gridwrap no-print">
        <table className="sz-grid sko-grid">
          <thead><tr><th>出荷計画日</th><th>納品日</th><th>届け先</th><th>名義</th><th>kg</th><th>輸送ID</th><th>運送会社</th><th>車番</th></tr></thead>
          <tbody>
            {一覧.length === 0 && <tr><td colSpan={8} className="c">この日の便はありません</td></tr>}
            {一覧.map((r) => (
              <tr key={r.ID} className={r.ID === 選択 ? "sel" : ""} onClick={() => set選択(r.ID)}>
                <td>{年月日(r.出荷計画日)}</td><td>{年月日(r.納品日)}</td><td className="name">{r.届け先}</td><td>{r.入庫後名義名}</td>
                <td className="r">{num(r.商品kg)}</td><td className="r">{r.輸送ID}</td><td>{r.運送会社名}</td><td>{r.車番}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {行 && 詳細 && (
        <>
          <div className="sko-pad">
            <b>販盛の在庫移動に入れる中身</b>　{行.届け先}・{年月日(行.納品日)} 着・輸送ID {行.輸送ID}
            <span className="no-print">　<button onClick={() => window.print()}>印刷</button></span>
          </div>
          {!m ? (
            <div className="sko-pad small">販盛に入れる明細がありません（Access でも「出力レコードがありません」と出ます）。大谷地以外は、丸北北海道の名義で届け先のグループコード2 が 1 のものだけが対象です。</div>
          ) : (
            <>
              <table className="sz-grid sko-grid" style={{ margin: "0 8px 8px" }}>
                <tbody>
                  <tr><th>伝票日</th><td>{m.伝票日}</td><th>完了日</th><td>{m.完了日}</td></tr>
                  <tr><th>移動元倉庫</th><td>{m.移動元倉庫}</td><th>移動先倉庫</th><td>{m.移動先倉庫}</td></tr>
                </tbody>
              </table>
              <div className="sko-pad">{m.件数} 件・合計 {num(m.ケース計)} ケース　<span className="small">登録の前に、販盛の画面で在庫（ロット）を選びます。</span></div>
              <div className="sko-gridwrap">
                <table className="sz-grid sko-grid">
                  <thead><tr><th>No</th><th>販盛の商品</th><th>商品コード</th><th>商品名</th><th>単位</th><th>数量</th><th>詳細日付1（賞味期限）</th></tr></thead>
                  <tbody>
                    {m.明細.map((x: Rec, i: number) => (
                      <tr key={i} className={x.販盛商品コード ? "" : "sel"}>
                        <td className="r">{i + 1}</td><td>{x.販盛商品コード || "（販盛コードなし）"}</td><td className="r">{x.商品コード}</td><td className="name">{x.商品名}</td>
                        <td className="c">{x.単位}（ケース）</td><td className="r">{num(x.数量)}</td><td>{x.詳細日付1}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
          <div className="sko-pad"><b>出荷内訳とロット統合</b>　<span className="small">ロット在庫の統合では、販盛の「ロット統合」の画面に 倉庫・製造日・商品 を入れて［F9 検索］します。</span></div>
          <div className="sko-gridwrap">
            <table className="sz-grid sko-grid">
              <thead><tr><th>倉庫</th><th>商品コード</th><th>商品名</th><th>ケース</th><th>賞味期限</th><th>製造日</th><th>統合：倉庫</th><th>統合：製造日</th><th>統合：販盛の商品</th></tr></thead>
              <tbody>
                {詳細.内訳.map((x: Rec, i: number) => (
                  <tr key={i}>
                    <td>{x.倉庫名}</td><td className="r">{x.商品コード}</td><td className="name">{x.商品名}</td><td className="r">{num(x.ケース)}</td>
                    <td>{年月日(x.賞味期限)}</td><td>{年月日(x.製造日)}</td><td>{x.統合.倉庫}</td><td>{x.統合.製造日}</td><td>{x.統合.販盛商品コード || "（なし）"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}

/**
 * 販盛 仕入入力（Access の F_販盛仕入入力。ふらの工場〈倉庫 191〉から出る便の仕入）。
 * 便・届け先を選ぶと、販盛の仕入に入れる中身を出す。
 */
export function WebHanmoriShiire() {
  const nav = useNavigate();
  const [日付, set日付] = useState<string>(today());
  const [一覧, set一覧] = useState<Rec[]>([]);
  const [選択, set選択] = useState<string | null>(null);
  const [詳細, set詳細] = useState<Rec | null>(null);
  const 鍵 = (r: Rec) => `${r.輸送ID}|${r.届け先コード}`;
  useEffect(() => {
    set選択(null);
    set詳細(null);
    api.get<Rec[]>(`/api/web/hanmori/shiire/list?日付=${日付}`).then(set一覧).catch(エラー);
  }, [日付]);
  useEffect(() => {
    if (選択 === null) return;
    const [輸送ID, 届け先] = 選択.split("|");
    api.get<Rec>(`/api/web/hanmori/shiire/detail?輸送ID=${輸送ID}&届け先=${届け先}`).then(set詳細).catch(エラー);
  }, [選択]);
  const 行 = 一覧.find((r) => 鍵(r) === 選択);
  const m = 詳細?.中身;
  return (
    <div className="sz sko">
      <div className="kk-head no-print">
        <div className="kk-title">販盛 仕入入力（ふらの工場）</div>
        <button onClick={() => nav(-1)}>閉じる</button>
      </div>
      <div className="sko-pad no-print">
        <日付の行 日付={日付} set日付={set日付} />
        <span className="small">　ふらの工場（倉庫 191）から出る便です。行を選ぶと、販盛の仕入に入れる中身が下に出ます。</span>
      </div>
      <div className="sko-gridwrap no-print">
        <table className="sz-grid sko-grid">
          <thead><tr><th>出荷計画日</th><th>輸送ID</th><th>運送会社</th><th>車番</th><th>倉庫</th><th>届け先</th><th>納品日</th></tr></thead>
          <tbody>
            {一覧.length === 0 && <tr><td colSpan={7} className="c">この日の便はありません</td></tr>}
            {一覧.map((r) => (
              <tr key={鍵(r)} className={鍵(r) === 選択 ? "sel" : ""} onClick={() => set選択(鍵(r))}>
                <td>{年月日(r.出荷計画日)}</td><td className="r">{r.輸送ID}</td><td>{r.運送会社名}</td><td>{r.車番}</td><td>{r.倉庫名}</td>
                <td className="name">{r.届け先}</td><td>{年月日(r.納品日)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {行 && 詳細 && (
        <>
          <div className="sko-pad">
            <b>販盛の仕入に入れる中身</b>　{行.届け先}・{年月日(行.納品日)} 着・輸送ID {行.輸送ID}
            <span className="no-print">　<button onClick={() => window.print()}>印刷</button></span>
          </div>
          {!m ? (
            <div className="sko-pad small">販盛に入れる明細がありません。</div>
          ) : (
            <>
              <table className="sz-grid sko-grid" style={{ margin: "0 8px 8px" }}>
                <tbody>
                  <tr><th>伝票日</th><td>{m.伝票日}</td><th>送付日</th><td>{m.送付日}</td><th>入荷日</th><td>{m.入荷日}</td></tr>
                  <tr><th>仕入先</th><td>{m.仕入先}</td><th>納入先</th><td colSpan={3}>{m.納入先}</td></tr>
                </tbody>
              </table>
              <div className="sko-pad">{m.件数} 件・合計 {num(m.ケース計)} ケース</div>
              <div className="sko-gridwrap">
                <table className="sz-grid sko-grid">
                  <thead><tr><th>No</th><th>販盛の商品</th><th>商品コード</th><th>商品名</th><th>エリア</th><th>数量</th><th>倉庫</th><th>賞味期限</th></tr></thead>
                  <tbody>
                    {m.明細.map((x: Rec, i: number) => (
                      <tr key={i} className={x.販盛商品コード ? "" : "sel"}>
                        <td className="r">{i + 1}</td><td>{x.販盛商品コード || "（販盛コードなし）"}</td><td className="r">{x.商品コード}</td><td className="name">{x.商品名}</td>
                        <td className="c">{x.エリア}</td><td className="r">{num(x.数量)}</td><td>{x.倉庫}</td><td>{x.賞味期限}</td>
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
