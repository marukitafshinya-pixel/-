import { useEffect, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { api, ApiError, num } from "../api";
import { Field, parseDate } from "../formParts";

type Rec = Record<string, any>;
const 和暦 = (s: string | null | undefined) =>
  s
    ? new Date(s.slice(0, 10) + "T00:00:00").toLocaleDateString("ja-JP", { year: "numeric", month: "long", day: "numeric" }) +
      `(${"日月火水木金土"[new Date(s.slice(0, 10) + "T00:00:00").getDay()]})`
    : "";

/** インポート処理（Access の F_インポート処理）。取り込み方を選ぶ */
export function WsImportMenu() {
  const nav = useNavigate();
  const [sp] = useSearchParams();
  const id = Number(sp.get("id"));
  const [plan, setPlan] = useState<Rec | null>(null);
  useEffect(() => {
    if (id) api.get<any>(`/api/ws/plan/${id}`).then((r) => setPlan(r.plan));
  }, [id]);
  if (!id) return <div className="notyet">インポート先のデータがありません</div>;
  return (
    <div className="wsi">
      <div className="tabs">
        <span>メインメニュー</span>
        <span>FM_出荷明細票</span>
        <span className="active">F_インポート処理</span>
      </div>
      <div className="wsi-head">
        <table>
          <thead>
            <tr><th>出荷日</th><th>運送会社名</th><th>車番</th></tr>
          </thead>
          <tbody>
            <tr><td>{和暦(plan?.出荷計画日)}</td><td>{plan?.運送会社名}</td><td>{plan?.車番}</td></tr>
          </tbody>
        </table>
        <button onClick={() => nav(-1)}>閉じる</button>
      </div>
      <div className="wsi-msg">上記に出力する方法を選択してください。</div>
      <div className="wsi-group">
        <div>受注から選択</div>
        <div className="box">
          <button className="b1" disabled title="受注読込は次に作ります">受注読込</button>
        </div>
        <div>別ファイルからインポート</div>
        <div className="box">
          <button className="b2" onClick={() => nav(`/ws/import/soko?id=${id}`)}>倉庫管理からインポート</button>
          <button className="b3" onClick={() => nav(`/ws/import/tenbai?id=${id}`)}>転売品管理からインポート</button>
          <button className="b4" onClick={() => nav(`/ws/import/genryo?id=${id}`)}>原料管理からインポート</button>
        </div>
      </div>
    </div>
  );
}

const 名前: Record<string, string> = { soko: "倉庫管理", tenbai: "転売品管理", genryo: "原料管理" };

/** 取り込む行を選ぶ（Access の FSD_出庫インポート選択・FSD_転売インポート選択・FSD_原料インポート選択） */
export function WsImportSelect() {
  const nav = useNavigate();
  const { src = "soko" } = useParams();
  const [sp] = useSearchParams();
  const id = Number(sp.get("id"));
  const [date, setDate] = useState<string | null>(null);
  const [soko, setSoko] = useState("");
  const [rows, setRows] = useState<Rec[]>([]);
  const [sel, setSel] = useState<Set<number>>(new Set());
  const [err, setErr] = useState("");

  useEffect(() => {
    // 開いたときは、その便の出荷日の分を出す
    api.get<any>(`/api/ws/plan/${id}`).then((r) => setDate(String(r.plan.出荷計画日).slice(0, 10)));
  }, [id]);
  useEffect(() => {
    if (!date) return;
    setSel(new Set());
    api
      .get<Rec[]>(`/api/ws/import/${src}`, { date, soko })
      .then((r) => {
        setRows(r);
        setErr("");
      })
      .catch((e) => setErr(e instanceof ApiError ? e.message : String(e)));
  }, [date, soko, src]);

  async function 読込() {
    if (!sel.size) return alert("取り込む行を選んでください。");
    const 済 = rows.filter((r) => sel.has(r.出庫ID) && r.取込済 > 0).length;
    if (済 && !confirm(`選んだ行のうち ${済} 件は、すでに WorkStation に取り込まれています。\nもう一度取り込むと二重になりますが、よろしいですか？`)) return;
    try {
      const r = await api.post<{ 件数: number }>(`/api/ws/import/${src}`, { 輸送ID: id, 出庫ID: [...sel] });
      alert(`${r.件数} 件を取り込みました。`);
      nav(`/ws?date=${date}&id=${id}`);
    } catch (e) {
      alert(e instanceof ApiError ? e.message : String(e));
    }
  }

  const sokos = [...new Map(rows.map((r) => [r.倉庫ID, r.倉庫名])).entries()];
  return (
    <div className="wsi sel">
      <div className="tabs">
        <span>メインメニュー</span>
        <span>F_インポート処理</span>
        <span className="active">{名前[src]}からインポート</span>
      </div>
      <div className="wsi-bar">
        <span className="lbl">出荷日</span>
        <Field value={date} kind="date" className="wsi-date" onCommit={(v) => {
          const d = parseDate(v);
          if (d === undefined) return alert("日付の書き方が正しくありません。（例：10/28）");
          setDate(d);
        }} />
        {src !== "soko" && (
          <select value={soko} onChange={(e) => setSoko(e.target.value)}>
            <option value="">倉庫：全部</option>
            {sokos.map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        )}
        <button onClick={() => setSel(new Set(rows.map((r) => r.出庫ID)))}>全選択</button>
        <button onClick={() => setSel(new Set())}>全解除</button>
        <button className="go" onClick={読込}>読込</button>
        <button onClick={() => nav(-1)}>キャンセル</button>
        <span className="note">{sel.size} 件を選択中</span>
      </div>
      {err && <p className="wsi-err">{err}</p>}
      <table className="ws-grid">
        <thead>
          <tr>
            <th>選択</th><th>取込済</th><th>輸送ID</th><th>順</th><th>コード</th><th>届け先</th><th>コード</th><th>倉庫</th>
            <th>コード</th><th>商品名</th><th>C/S</th><th>kg</th><th>製造日</th><th>賞味期限</th><th>納品日</th><th>区分</th><th>備考</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.出庫ID} className={sel.has(r.出庫ID) ? "picked" : ""}>
              <td className="c">
                <input type="checkbox" checked={sel.has(r.出庫ID)} onChange={(e) => {
                  const s = new Set(sel);
                  e.target.checked ? s.add(r.出庫ID) : s.delete(r.出庫ID);
                  setSel(s);
                }} />
              </td>
              <td className="c" title="WorkStation に取り込んだ回数">{r.取込済 ? `済(${r.取込済})` : ""}</td>
              <td className="r">{r.輸送ID}</td>
              <td className="c">{r.商品積込順}</td>
              <td className="r kc">{r.届け先コード}</td>
              <td>{r.届け先}</td>
              <td className="r kc">{r.倉庫ID}</td>
              <td>{r.倉庫名}</td>
              <td className="r kc">{r.商品コード}</td>
              <td className="bold">{r.商品名}</td>
              <td className="r">{num(r.ケース)}</td>
              <td className="r">{num(r.商品kg)}</td>
              <td>{r.製造日?.slice(0, 10)}</td>
              <td>{r.賞味期限?.slice(0, 10)}</td>
              <td>{r.納品日?.slice(0, 10)}</td>
              <td className="c tag">{r.タグ}</td>
              <td className="note">{r.備考}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {!err && rows.length === 0 && <p className="wsi-err">この出荷日のデータはありません。</p>}
    </div>
  );
}
