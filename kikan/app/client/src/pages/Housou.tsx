import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { api, ApiError, num } from "../api";
import { Field, today } from "../formParts";

type Rec = Record<string, any>;
const エラー = (e: unknown) => alert(e instanceof ApiError ? e.message : String(e));
const 日を足す = (v: string, k: number) => new Date(Date.parse(v + "T00:00:00Z") + k * 86400000).toISOString().slice(0, 10);
const 日付に = (v: string) => (v ? v.replace(/\//g, "-") : "");
const 和の日付 = (v: string) => (v ? `${v.slice(0, 4)}年${v.slice(5, 7)}月${v.slice(8, 10)}日(${"日月火水木金土"[new Date(v + "T00:00:00").getDay()]})` : "");
const 短い日 = (v: string | null) => (v ? `${v.slice(2, 4)}/${v.slice(5, 7)}/${v.slice(8, 10)}` : "");

/**
 * 包装準備（Access の FM_包装準備）。入庫日（包装日）の丸北北海道の入庫に、ロボット（パレタイザー）の積み付けを入れる。
 * プログラムNo を選ぶと積み付けマスタのパレット・段数・積み付け数などが入り、パレット枚数（ケース ÷ 積み付け数、小数は繰り上げ）を出す。
 * ［自動割付］は過去の設定から入れる（パレット輸送に出すものは (N)）。
 */
export function HousouJunbi() {
  const nav = useNavigate();
  const [sp] = useSearchParams();
  const [日, set日] = useState(sp.get("date") ?? today());
  const [data, setData] = useState<{ rows: Rec[]; プログラム: Rec[]; パレット: string[]; 積み付けパターン: string[] }>({ rows: [], プログラム: [], パレット: [], 積み付けパターン: [] });
  async function 読む(d = 日) {
    try {
      setData(await api.get("/api/housou/junbi", { date: d }));
    } catch (e) {
      エラー(e);
    }
  }
  useEffect(() => {
    読む(日);
  }, [日]);
  async function 直す(r: Rec, 項目: string, 値: unknown) {
    if (項目 === "ロボットPrgNo" && !Number(値) && !confirm("項目を非表示にしますよろしいですか？")) return 読む();
    try {
      await api.post("/api/housou/junbi/save", { 入庫ID: r.入庫ID, 項目, 値 });
      読む();
    } catch (e) {
      エラー(e);
    }
  }
  async function 自動割付() {
    try {
      await api.post("/api/housou/junbi/auto", { date: 日 });
      読む();
    } catch (e) {
      エラー(e);
    }
  }
  const 幅 = (w: number) => (w <= 36 ? "w3" : w <= 44 ? "w4" : w <= 60 ? "w5" : w <= 90 ? "w8" : "w10");
  const 数 = (r: Rec, k: string, w = 44) => (
    <td><Field value={r[k]} kind="num" className={"sz-in " + 幅(w)} onCommit={(v) => 直す(r, k, v.trim() === "" ? null : Number(v))} /></td>
  );
  const 文字 = (r: Rec, k: string, w = 90) => (
    <td><Field value={r[k]} className={"sz-in " + 幅(w)} onCommit={(v) => 直す(r, k, v)} /></td>
  );
  return (
    <div className="sz">
      <div className="sz-top">
        <div className="sz-date">
          <div className="sz-date-top">
            <span className="sz-date-lbl">入庫日</span>
            <button onClick={() => set日(日を足す(日, -1))}>◀</button>
            <button onClick={() => set日(日を足す(日, 1))}>▶</button>
          </div>
          <Field kind="date" value={日} className="sz-date-v" onCommit={(v) => v && set日(日付に(v))} />
          <div className="sz-date-w">{和の日付(日)}</div>
        </div>
        <div className="sz-top-btns">
          <button className="blue" onClick={自動割付}>自動割付</button>
          <button onClick={() => nav("/housou/robot")}>ロボットマスタ</button>
          <button onClick={async () => { await api.post("/api/housou/junbi/recalc", { date: 日 }).catch(エラー); 読む(); }}>パレット枚数の再計算</button>
          <button disabled title="印刷の形をいただいてから作ります">印刷</button>
          <button disabled title="印刷の形をいただいてから作ります">包装札印刷</button>
          <button onClick={() => nav(-1)}>閉じる</button>
        </div>
      </div>
      <div className="sz-list">
        <table className="sz-grid">
          <thead>
            <tr>
              <th>包装順</th><th>製造日</th><th>コード</th><th>商品名</th><th>規格</th><th>区分</th><th>ケース</th><th>商品kg</th><th>プログラムNo</th><th>プログラム名</th>
              <th>パレット</th><th>一段積載</th><th>段数</th><th>積み付け数</th><th>パレット枚数</th><th>スピード</th><th>長さ㎜</th><th>幅㎜</th><th>高さ㎜</th><th>積み付け備考</th><th>管理備考</th>
            </tr>
          </thead>
          <tbody>
            {data.rows.length === 0 && <tr><td colSpan={21} className="c none">この入庫日の入庫はありません</td></tr>}
            {data.rows.map((r) => (
              <tr key={r.入庫ID}>
                {数(r, "包装順", 36)}
                <td className="c">{短い日(r.製造日)}</td>
                <td className="r">{r.商品コード}</td>
                <td className="name">{r.商品名}</td>
                <td className="c">{r.規格}</td>
                <td className="c">{r.タグ}</td>
                <td className="r">{num(r.ケース)}</td>
                <td className="r">{num(r.商品kg)}</td>
                <td>
                  <select className="sz-sel" value={r.ロボットPrgNo ?? ""} onChange={(e) => 直す(r, "ロボットPrgNo", e.target.value === "" ? 0 : Number(e.target.value))}>
                    <option value="" />
                    {data.プログラム.map((p) => <option key={p.id} value={p.id}>{p.id}　{p.パレット ?? ""}　{p.品番 ?? ""}　{p.段数 ?? ""}段　{p.積み付け数 ?? ""}</option>)}
                  </select>
                </td>
                <td className="small">{r.プログラム名}</td>
                <td>
                  <select className="sz-sel" value={r.使用パレット ?? ""} onChange={(e) => 直す(r, "使用パレット", e.target.value || null)}>
                    <option value="" />
                    {[...new Set([...data.パレット, "(N)", "(大)"])].map((p) => <option key={p} value={p}>{p}</option>)}
                  </select>
                </td>
                <td>
                  <select className="sz-sel" value={r.一段積載 ?? ""} onChange={(e) => 直す(r, "一段積載", e.target.value || null)}>
                    <option value="" />
                    {[...new Set([...data.積み付けパターン, ...(r.一段積載 ? [r.一段積載] : [])])].map((p) => <option key={p} value={p}>{p}</option>)}
                  </select>
                </td>
                {数(r, "積み段数", 36)}
                {数(r, "積み付け数", 40)}
                <td className="r b">{num(r.パレット枚数)}</td>
                {数(r, "スピード", 36)}
                {数(r, "長さ㎜", 44)}
                {数(r, "幅㎜", 44)}
                {数(r, "高さ㎜", 44)}
                {文字(r, "積み付け備考", 90)}
                {文字(r, "管理備考", 110)}
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <td colSpan={6} className="r sz-sum-lbl">合計</td>
              <td className="r">{num(data.rows.reduce((a, r) => a + Number(r.ケース ?? 0), 0))}</td>
              <td className="r">{num(data.rows.reduce((a, r) => a + Number(r.商品kg ?? 0), 0))}</td>
              <td colSpan={6} />
              <td className="r">{num(data.rows.reduce((a, r) => a + Number(r.パレット枚数 ?? 0), 0))}</td>
              <td colSpan={6} />
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}
