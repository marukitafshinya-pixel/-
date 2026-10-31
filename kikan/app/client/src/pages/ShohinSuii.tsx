import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { api, ApiError } from "../api";
import { PageClose } from "../formParts";

type Rec = Record<string, any>;
const エラー = (e: unknown) => alert(e instanceof ApiError ? e.message : String(e));
const 今日 = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
/** 数の見せ方：空（Access の Null）は空欄、ほかは 3 けた区切り */
const 数 = (v: unknown, 小数 = 0) => (v === null || v === undefined || v === "" ? "" : Number(v).toLocaleString("ja-JP", { maximumFractionDigits: 小数, minimumFractionDigits: 小数 }));
const 率 = (v: number | null) => (v === null || !Number.isFinite(v) ? "" : v.toFixed(2));
/** 月別の表の並び（7 月始まり） */
const 月の並び = [7, 8, 9, 10, 11, 12, 1, 2, 3, 4, 5, 6];
const 月末 = (y: number, m: number) => new Date(y, m, 0).getDate();

/**
 * 商品推移（Access の 丸北商品推移Ver2FE の F_出荷推移ver4）。
 * 商品を選ぶと、その商品（グループ商品）の年間製造・月別の出荷（取引先×届け先）・倉庫ごとの在庫と出荷の推移を出す。
 * 数をダブルクリックすると明細。予定ケースを入れると、出庫予定込在庫率・年間在庫率を出す（Access の 予定ケース_AfterUpdate と同じ）。
 */
export default function ShohinSuii() {
  const [取引元一覧, set取引元一覧] = useState<Rec[]>([]);
  const [商品一覧, set商品一覧] = useState<Rec[]>([]);
  const [取引元, set取引元] = useState(0);
  const nav = useNavigate();
  const [sp] = useSearchParams();
  // 全体在庫から商品コードをダブルクリックしたとき（?code=）はその商品を開く
  const [商品, set商品] = useState(sp.get("code") ?? "");
  const [kg, setKg] = useState(true);
  const [集計日, set集計日] = useState(今日());
  const [年度, set年度] = useState(0);
  const [d, setD] = useState<Rec | null>(null);
  const [予定, set予定] = useState<Record<number, string>>({});
  const [明細, set明細] = useState<{ 題: string; rows: Rec[] } | null>(null);

  useEffect(() => {
    api.get<Rec[]>("/api/suii/torihiki").then(set取引元一覧, エラー);
  }, []);
  useEffect(() => {
    api.get<Rec[]>("/api/suii/shohin", { torihiki: 取引元 }).then(set商品一覧, エラー);
  }, [取引元]);

  async function 出す(code = 商品) {
    if (!code) return;
    try {
      const r = await api.get<Rec>("/api/suii", { code, torihiki: 取引元, kg: kg ? 1 : 0, date: 集計日, nendo: 年度 || "" });
      setD(r);
      if (!年度) set年度(r.年度);
      set予定({});
    } catch (e) {
      エラー(e);
    }
  }
  useEffect(() => {
    出す();
  }, [取引元, kg, 集計日, 年度]);

  async function 明細を出す(題: string, q: Rec) {
    if (!d) return;
    try {
      const rows = await api.get<Rec[]>("/api/suii/meisai", { G: d.グループ商品コード, ...q });
      set明細({ 題, rows });
    } catch (e) {
      エラー(e);
    }
  }
  // 出荷の明細（期間・倉庫・ユーザー）
  const 出荷明細 = (題: string, soko: number, from: string, to: string, 未確定 = false) =>
    明細を出す(題, { kind: "shukka", soko, from, to, torihiki: 取引元 || "", mikakutei: 未確定 ? 1 : "" });
  const 日を足す = (v: string, k: number) => {
    const x = new Date(v + "T00:00:00");
    x.setDate(x.getDate() + k);
    return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, "0")}-${String(x.getDate()).padStart(2, "0")}`;
  };
  const 月初 = (k: number) => {
    const t = new Date();
    const x = new Date(t.getFullYear(), t.getMonth() + k, 1);
    return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, "0")}-01`;
  };
  const 先月末 = 日を足す(月初(0), -1);
  const 年度の月 = (m: number) => (m >= 7 ? d!.年度 : d!.年度 + 1);

  const 月計 = 月の並び.map((m) => (d?.月別 ?? []).reduce((a: number, r: Rec) => a + r.月[m], 0));
  return (
    <div className="ssi">
      <div className="ssi-head">
        <div className="ssi-title">商品推移</div>
        <label className="ssi-f">
          <span>商品</span>
          <input
            className="ssi-code"
            list="ssi-shohin"
            value={商品}
            inputMode="numeric"
            onChange={(e) => set商品(e.target.value.replace(/[^0-9]/g, ""))}
            onBlur={() => 商品 !== String(d?.商品コード ?? "") && 出す()}
            onKeyDown={(e) => e.key === "Enter" && 商品 !== String(d?.商品コード ?? "") && 出す()}
            title="商品コードを入れるか、一覧から選びます"
          />
          <datalist id="ssi-shohin">
            {商品一覧.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
          </datalist>
          <span className="ssi-name">{d?.商品名 ?? ""}</span>
        </label>
        <label className="ssi-f">
          <span>ユーザー</span>
          <select value={取引元} onChange={(e) => set取引元(Number(e.target.value))}>
            <option value={0}>すべて</option>
            {取引元一覧.map((x) => <option key={x.id} value={x.id}>{x.name ?? x.id}</option>)}
          </select>
        </label>
        <div className="ssi-f ssi-unit">
          <span>単位</span>
          <button className={kg ? "on" : ""} onClick={() => setKg(true)}>kg</button>
          <button className={!kg ? "on" : ""} onClick={() => setKg(false)}>ケース</button>
        </div>
        <label className="ssi-f">
          <span>集計日付</span>
          <input type="date" value={集計日} onChange={(e) => e.target.value && set集計日(e.target.value)} />
        </label>
        <label className="ssi-f">
          <span>年度</span>
          <input className="ssi-year" type="number" value={年度 || ""} onChange={(e) => set年度(Number(e.target.value) || 0)} title="7 月始まりの年（例 2026 は 2026/7〜2027/6）" />
        </label>
        <button className="ssi-zentai" onClick={() => nav("/suii/zaiko")} title="全体在庫（現在在庫表示）">全体在庫</button>
        <PageClose fallback="/" />
      </div>

      {!d && <p className="ssi-none">商品コードを入れるか、一覧から選んでください。</p>}
      {d && (
        <>
          <div className="ssi-sum">
            <div><span>年間製造</span><b>{数(d.年間製造)}</b><small>{d.製造開始.replace(/-/g, "/")}〜{d.製造終了.replace(/-/g, "/")}</small></div>
            <div><span>前年製造</span><b>{数(d.前年製造)}</b></div>
            <div><span>年間平均</span><b>{数(d.年間平均)}</b></div>
            <div className="wide"><span>ストック</span><b className="txt">{String(d.ストック数 ?? "")}</b></div>
            <div><span>単位</span><b>{d.単位}</b></div>
          </div>

          <h3 className="ssi-h">月別の出荷（{d.年度}年7月〜{d.年度 + 1}年6月）</h3>
          <div className="ssi-scroll">
            <table className="ssi-grid">
              <thead>
                <tr><th>取引先</th><th>届け先</th>{月の並び.map((m) => <th key={m}>{m}月</th>)}<th>年間合計</th></tr>
              </thead>
              <tbody>
                {d.月別.map((r: Rec) => (
                  <tr key={`${r.取引先コード}/${r.届け先コード}`} className={r.倉庫区分 ? "soko" : ""}>
                    <td>{r.取引先名 ?? r.取引先コード}</td>
                    <td>{r.届け先 ?? r.届け先コード}</td>
                    {月の並び.map((m) => {
                      const y = 年度の月(m);
                      const mm = String(m).padStart(2, "0");
                      return (
                        <td key={m} className="r dbl" onDoubleClick={() => 出荷明細(`${y}年${m}月の出荷`, 0, `${y}-${mm}-01`, `${y}-${mm}-${月末(y, m)}`)}>
                          {r.月[m] ? 数(r.月[m]) : ""}
                        </td>
                      );
                    })}
                    <td className="r b">{数(r.年間合計)}</td>
                  </tr>
                ))}
                {d.月別.length === 0 && <tr><td colSpan={15} className="ssi-none">この年度の出荷はありません。</td></tr>}
              </tbody>
              {d.月別.length > 0 && (
                <tfoot>
                  <tr><td colSpan={2}>合計</td>{月計.map((v, i) => <td key={i} className="r">{v ? 数(v) : ""}</td>)}<td className="r">{数(月計.reduce((a, b) => a + b, 0))}</td></tr>
                </tfoot>
              )}
            </table>
          </div>

          <h3 className="ssi-h">倉庫ごとの推移（集計日付 {集計日.replace(/-/g, "/")}）</h3>
          <div className="ssi-scroll">
            <table className="ssi-grid">
              <thead>
                <tr>
                  <th>倉庫</th><th>現在在庫</th><th>輸送中</th><th>受注予定</th><th>入庫予定</th><th>受注込在庫</th><th>製造予定</th>
                  <th>予定ケース</th><th>現在在庫率</th><th>出庫予定込<br />在庫率</th><th>年間在庫率</th>
                  <th>一日</th><th>一週</th><th>一月</th><th>三ヶ月</th><th>半年</th><th>年間</th><th>平均年間</th><th>年間入庫</th><th>年間入庫<br />平均</th>
                </tr>
              </thead>
              <tbody>
                {d.倉庫.map((r: Rec) => {
                  const 予定値 = 予定[r.倉庫ID] ?? "";
                  const 込み = n(r.受注込在庫) + Number(予定値 || 0);
                  const 出庫予定込 = 予定値 === "" || !r.三ヶ月 ? null : 込み / (r.三ヶ月 / 3);
                  const 年間在庫率 = 予定値 === "" ? 0 : r.平均年間 ? 込み / r.平均年間 : null;
                  const 名 = r.倉庫名 ?? r.倉庫ID;
                  return (
                    <tr key={r.倉庫ID}>
                      <td>{名}</td>
                      <td className="r dbl" onDoubleClick={() => 明細を出す(`${名}の在庫`, { kind: "zaiko", soko: r.倉庫ID })}>{数(r.現在在庫)}</td>
                      <td className="r">{数(r.輸送中)}</td>
                      <td className="r dbl" onDoubleClick={() => 出荷明細(`${名}の受注予定`, r.倉庫ID, 集計日, "", true)}>{数(r.受注予定)}</td>
                      <td className="r">{数(r.入庫予定)}</td>
                      <td className={"r b" + (n(r.受注込在庫) < 0 ? " minus" : "")}>{数(r.受注込在庫)}</td>
                      <td className="r dbl" onDoubleClick={() => 明細を出す("製造予定", { kind: "nyuko" })}>{数(r.製造予定)}</td>
                      <td>
                        <input
                          className="ssi-yotei"
                          inputMode="numeric"
                          value={予定値}
                          onChange={(e) => set予定({ ...予定, [r.倉庫ID]: e.target.value.replace(/[０-９]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0)).replace(/[^0-9-]/g, "") })}
                        />
                      </td>
                      <td className="r">{率(r.現在在庫率)}</td>
                      <td className="r">{率(出庫予定込)}</td>
                      <td className="r">{率(年間在庫率)}</td>
                      <td className="r dbl" onDoubleClick={() => 出荷明細(`${名}の一日の出荷`, r.倉庫ID, 集計日, 集計日)}>{数(r.一日)}</td>
                      <td className="r dbl" onDoubleClick={() => 出荷明細(`${名}の一週の出荷`, r.倉庫ID, 日を足す(集計日, -6), 集計日)}>{数(r.一週)}</td>
                      <td className="r dbl" onDoubleClick={() => 出荷明細(`${名}の一月の出荷`, r.倉庫ID, 月初(-1), 先月末)}>{数(r.一月)}</td>
                      <td className="r dbl" onDoubleClick={() => 出荷明細(`${名}の三ヶ月の出荷`, r.倉庫ID, 月初(-3), 先月末)}>{数(r.三ヶ月)}</td>
                      <td className="r dbl" onDoubleClick={() => 出荷明細(`${名}の半年の出荷`, r.倉庫ID, 日を足す(集計日, -183), 集計日)}>{数(r.半年)}</td>
                      <td className="r dbl" onDoubleClick={() => 出荷明細(`${名}の年間の出荷`, r.倉庫ID, 日を足す(集計日, -365), 集計日)}>{数(r.年間)}</td>
                      <td className="r">{数(r.平均年間)}</td>
                      <td className="r">{数(r.年間入庫)}</td>
                      <td className="r">{数(r.年間入庫平均)}</td>
                    </tr>
                  );
                })}
                {d.倉庫.length === 0 && <tr><td colSpan={20} className="ssi-none">この商品の在庫のある倉庫はありません。</td></tr>}
              </tbody>
            </table>
          </div>
          <p className="ssi-note">数をダブルクリックすると明細が出ます。予定ケースを入れると、出庫予定込在庫率（受注込在庫＋予定 ÷ 三ヶ月の 1 か月分）と年間在庫率（受注込在庫＋予定 ÷ 平均年間）を出します。予定ケースは保存しません。</p>
        </>
      )}

      {明細 && (
        <div className="modal" onClick={() => set明細(null)}>
          <div className="ssi-dlg" onClick={(e) => e.stopPropagation()}>
            <div className="ssi-dlg-h">
              <span>{明細.題}（{明細.rows.length} 件）</span>
              <button onClick={() => set明細(null)}>閉じる</button>
            </div>
            <div className="ssi-dlg-b">
              {明細.rows.length === 0 ? (
                <p className="ssi-none">明細はありません。</p>
              ) : (
                <table className="ssi-grid">
                  <thead><tr>{Object.keys(明細.rows[0]).map((k) => <th key={k}>{k}</th>)}</tr></thead>
                  <tbody>
                    {明細.rows.map((r, i) => (
                      <tr key={i}>
                        {Object.keys(明細.rows[0]).map((k) => (
                          <td key={k} className={typeof r[k] === "number" ? "r" : ""}>
                            {typeof r[k] === "boolean" ? (r[k] ? "✓" : "") : typeof r[k] === "number" ? (Number.isInteger(r[k]) && !/ID|コード/.test(k) ? 数(r[k]) : Number.isInteger(r[k]) ? String(r[k]) : 数(r[k], 1)) : String(r[k] ?? "").replace(/^(\d{4})-(\d{2})-(\d{2}).*$/, "$1/$2/$3")}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
const n = (v: unknown) => Number(v ?? 0) || 0;
