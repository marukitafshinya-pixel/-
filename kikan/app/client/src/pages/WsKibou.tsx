import { useMemo, useState } from "react";
import { api, ApiError, num } from "../api";

type Rec = Record<string, any>;
const 年月日 = (v: string | null | undefined) => (v ? v.slice(0, 10).replace(/-/g, "/") : "");
const 月日 = (v: string | null | undefined) => (v ? `${Number(v.slice(5, 7))}月${v.slice(8, 10)}` : "");
const 曜日付き = (v: string | null | undefined) =>
  v ? `${Number(v.slice(5, 7))}月${Number(v.slice(8, 10))}日(${"日月火水木金土"[new Date(v.slice(0, 10) + "T00:00:00").getDay()]})` : "";

export type 希望在庫 = { rows: Rec[]; 本社依頼kg: number | null; 本社依頼残kg: number | null; 表題: string };

/**
 * 希望在庫表示（Access の FSD_希望在庫表示）。出荷明細票の「検索実行」から開く。
 * 「抽出」を付けた在庫で、この便に出荷の行を作る。希望C/S を入れると、製造日の古い順に必要な数まで印を付ける。
 */
export function KibouDialog(props: {
  data: 希望在庫;
  輸送ID: number;
  出荷予定日: string;
  shohin: number;
  soko: number;
  onClose: (追加した: boolean) => void;
}) {
  const [rows, setRows] = useState<Rec[]>(props.data.rows.map((r) => ({ ...r, 抽出区分: false, 実算ケース: r.在庫ケース, 実算kg: 0 })));
  const [絞り, set絞り] = useState<"全体" | "当日" | "検体">("全体");
  const [名義, set名義] = useState<number | null>(null);
  const [受注個数, set受注個数] = useState<number | null>(null);

  const 名義一覧 = useMemo(() => [...new Set(rows.map((r) => r.入庫後名義ID))].filter((v) => v !== null), [rows]);
  const shown = rows.filter(
    (r) =>
      (絞り !== "当日" || (r.入庫日 ?? "") <= props.出荷予定日 + " 99") &&
      (絞り !== "検体" || r.検体区分) &&
      (名義 === null || r.入庫後名義ID === 名義),
  );
  const 在庫総数 = shown.reduce((a, r) => a + (r.在庫ケース ?? 0), 0);
  const 在庫kg計 = shown.reduce((a, r) => a + (r.在庫kg ?? 0), 0);
  const 割付数 = rows.filter((r) => r.抽出区分).reduce((a, r) => a + (r.実算ケース ?? 0), 0);
  const 割付kg = rows.filter((r) => r.抽出区分).reduce((a, r) => a + (r.実算kg ?? 0), 0);
  const 受注kg = 受注個数 === null ? null : 受注個数 * (rows[0]?.入数 ?? 0);

  // 抽出の付け外し（Access の 抽出区分_Click）
  function 抽出(r: Rec) {
    if (r.出荷止め区分) return alert("出荷止めが設定されている為、抽出できません。");
    if (r.入庫日 && props.出荷予定日 < r.入庫日.slice(0, 10) && !confirm("包装日が出荷日より先ですがよろしいですか？")) return;
    setRows(rows.map((x) => (x === r ? { ...x, 抽出区分: !x.抽出区分 } : x)));
  }

  // 希望C/S（Access の 受注個数_AfterUpdate と C_必要数量在庫読込）
  function 必要数を選ぶ(v: string) {
    const 数 = v.trim() === "" ? null : Number(v);
    if (数 === null || Number.isNaN(数)) return set受注個数(null);
    let 必要 = 数;
    if (在庫総数 < 数) {
      if (!confirm(`在庫が　${在庫総数 - 数}個　不足しています。\n在庫分まで選択しますか？`)) return;
      必要 = 在庫総数;
    }
    set受注個数(必要);
    // 製造日・賞味期限・タグ・入庫No・入庫日 の順に、必要な数まで印を付ける
    const order = [...rows].sort((a, b) =>
      [["製造日"], ["賞味期限"], ["タグ"], ["入庫No"], ["入庫日"]].reduce(
        (c, [k]) => c || (String(a[k] ?? "") < String(b[k] ?? "") ? -1 : String(a[k] ?? "") > String(b[k] ?? "") ? 1 : 0),
        0,
      ),
    );
    const next = new Map<Rec, Rec>();
    let 残り = 必要;
    for (const r of order) {
      const x = { ...r, 実算ケース: 0, 実算kg: 0, 抽出区分: false };
      if (残り !== 0) {
        if (残り - r.在庫ケース > 0) {
          x.実算ケース = r.在庫ケース;
          if (r.在庫ケース !== 0) x.抽出区分 = true;
          残り -= r.在庫ケース;
        } else {
          x.実算ケース = 残り;
          x.抽出区分 = true;
          残り = 0;
        }
        x.実算kg = x.実算ケース * (r.入数 ?? 0);
      }
      next.set(r, x);
    }
    setRows(rows.map((r) => next.get(r)!));
  }

  // 出荷止め・管理備考を直す（取り込み元の在庫・生産計画に書く）
  async function 止め(r: Rec, 出荷止め区分: boolean, 管理備考: string | null) {
    try {
      await api.post("/api/ws/kibou/tome", { 架空実物: r.架空実物, 入庫ID: r.入庫ID, 在庫ID: r.架空ID, 出荷止め区分, 管理備考 });
      setRows(rows.map((x) => (x === r ? { ...x, 出荷止め区分, 管理備考 } : x)));
    } catch (e) {
      alert(e instanceof ApiError ? e.message : String(e));
    }
  }

  async function OK() {
    const 選んだ = rows.filter((r) => r.抽出区分).map((r) => r.認識ID);
    if (!選んだ.length) return props.onClose(false);
    try {
      await api.post("/api/ws/kibou/add", { 輸送ID: props.輸送ID, shohin: props.shohin, soko: props.soko, 認識ID: 選んだ });
      props.onClose(true);
    } catch (e) {
      alert(e instanceof ApiError ? e.message : String(e));
    }
  }

  return (
    <div className="modal">
      <div className="kb">
        <div className="kb-head">
          <b className="kb-title">希望在庫表示{props.data.表題 ? `　${props.data.表題}` : ""}</b>
          <span className="kb-kv"><span>本社依頼kg</span><b>{num(props.data.本社依頼kg)}</b></span>
          <span className="kb-kv"><span>本社依頼残kg</span><b>{num(props.data.本社依頼残kg)}</b></span>
          <span className="kb-kv"><span>在庫合計</span><b>{num(在庫総数)}</b><b>{num(在庫kg計)} kg</b></span>
        </div>
        <div className="kb-head">
          <span className="kb-kv">
            <span>希望C/S</span>
            <input className="r" defaultValue="" onBlur={(e) => 必要数を選ぶ(e.target.value)} onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()} />
            <b>{受注kg === null ? "" : `${num(受注kg)} kg`}</b>
          </span>
          <span className="kb-kv"><span>受注割付数</span><b>{num(割付数)}</b><b>{num(割付kg)} kg</b></span>
          <span className="kb-kv">
            <span>必要数</span>
            <b>{受注個数 === null ? "" : num(受注個数 - 割付数)}</b>
            <b>{受注kg === null ? "" : `${num(受注kg - 割付kg)} kg`}</b>
          </span>
          <button className={絞り === "当日" ? "on" : ""} onClick={() => set絞り("当日")} title="出荷予定日までに入庫するものだけ">出荷可能表示</button>
          <button className={絞り === "全体" ? "on" : ""} onClick={() => set絞り("全体")}>全体表示</button>
          <button className={絞り === "検体" ? "on" : ""} onClick={() => set絞り("検体")}>検体表示</button>
          <select value={名義 ?? ""} onChange={(e) => set名義(e.target.value === "" ? null : Number(e.target.value))}>
            <option value="">名義：全部</option>
            {名義一覧.map((m) => <option key={m} value={m}>{m}</option>)}
          </select>
          <span className="sp" />
          <button className="ok" onClick={OK}>OK</button>
          <button onClick={() => props.onClose(false)}>キャンセル</button>
        </div>
        <div className="kb-list">
          <table className="ws-grid">
            <thead>
              <tr>
                <th>抽出</th><th>製造日</th><th>賞味期限</th><th></th><th>保管場所</th><th>在庫C/S</th><th>在庫kg</th><th>出荷数</th>
                <th>入庫日</th><th>入庫元数</th><th>商品名</th><th>区分</th><th>タグ</th><th>名義</th><th>検査予定日</th><th>検体</th>
                <th>出荷止め</th><th>管理備考</th><th>備考</th>
              </tr>
            </thead>
            <tbody>
              {shown.map((r) => (
                <tr key={r.認識ID} className={(r.抽出区分 ? "picked " : "") + (r.架空実物 ? "plan" : "")}>
                  <td className="c"><button className={"kb-pick" + (r.抽出区分 ? " on" : "")} onClick={() => 抽出(r)}>{r.抽出区分 ? "抽出" : ""}</button></td>
                  <td className="bold">{年月日(r.製造日)}</td>
                  <td>{年月日(r.賞味期限)}</td>
                  <td className="red">{r.賞味期限通知}</td>
                  <td>{r.倉庫名}</td>
                  <td className={"r" + (r.在庫ケース < 0 ? " red" : "")}>{num(r.在庫ケース)}</td>
                  <td className={"r" + (r.在庫kg < 0 ? " red" : "")}>{num(r.在庫kg)}</td>
                  <td className="r">{r.抽出区分 ? num(r.実算ケース) : ""}</td>
                  <td>{月日(r.入庫日)}</td>
                  <td className="r">{num(r.入庫元数)}</td>
                  <td>{r.商品名}</td>
                  <td>{r.商品区分名}</td>
                  <td>{r.タグ}</td>
                  <td className="r">{r.入庫後名義ID}</td>
                  <td>{曜日付き(r.検査予定日)}</td>
                  <td className="c">{r.検体区分 ? "検体合わせ" : ""}</td>
                  <td className="c"><input type="checkbox" checked={!!r.出荷止め区分} onChange={(e) => 止め(r, e.target.checked, r.管理備考)} /></td>
                  <td>
                    <input className="kb-memo" defaultValue={r.管理備考 ?? ""} onBlur={(e) => e.target.value !== (r.管理備考 ?? "") && 止め(r, !!r.出荷止め区分, e.target.value)} />
                  </td>
                  <td className="note pre">{r.備考在庫}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {shown.length === 0 && <p className="wsi-err">表示する在庫はありません。</p>}
        </div>
      </div>
    </div>
  );
}
