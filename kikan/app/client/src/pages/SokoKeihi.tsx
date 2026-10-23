import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { api, ApiError, num } from "../api";
import { Field, parseDate } from "../formParts";

type Rec = Record<string, any>;
type 選択肢 = { id: number; name: string | null };
const エラー = (e: unknown) => alert(e instanceof ApiError ? e.message : String(e));
const 今月 = () => new Date(Date.now() + 9 * 3600 * 1000).toISOString().slice(0, 7).replace("-", "/");
const 月を足す = (m: string, k: number) => {
  const d = new Date(Date.UTC(Number(m.slice(0, 4)), Number(m.slice(5, 7)) - 1 + k, 1));
  return `${d.getUTCFullYear()}/${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
};

/**
 * 諸経費登録（Access の F_諸経費登録）。冷蔵庫・名義・集計月を選んで、諸経費（書類代・名変手数料・サーチャージ料・入出庫料訂正 など）を入れる。
 * ［詳細］に切り替えると、発生日・在庫・請求先も入れられる（削除に合言葉が要る）。
 */
export function SokoKeihi() {
  const nav = useNavigate();
  const [sp] = useSearchParams();
  const [opts, setOpts] = useState<{ 倉庫: 選択肢[]; 名義: 選択肢[]; 経費: 選択肢[]; 最初: { 最初: string; 最後: string } } | null>(null);
  const [soko, setSoko] = useState<number | null>(null);
  const [meigi, setMeigi] = useState<number | null>(null);
  const [月, set月] = useState(今月());
  const [詳細, set詳細] = useState(false);
  const [rows, setRows] = useState<Rec[]>([]);
  const [在庫, set在庫] = useState<Rec[]>([]);
  const [新, set新] = useState(0);

  useEffect(() => {
    api.get<any>("/api/soko/keihi/choices").then((o) => {
      setOpts(o);
      setSoko(Number(sp.get("soko")) || (o.倉庫[0]?.id ?? null));
      setMeigi(o.名義[0]?.id ?? null);
    }).catch(エラー);
  }, []);
  const load = () =>
    soko !== null && meigi !== null
      ? api.get<Rec[]>("/api/soko/keihi", { soko: String(soko), tsuki: 月, meigi: String(meigi) }).then(setRows).catch(エラー)
      : Promise.resolve();
  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [soko, meigi, 月]);
  useEffect(() => {
    if (詳細 && soko !== null && meigi !== null) api.get<Rec[]>("/api/soko/keihi/zaiko", { soko: String(soko), meigi: String(meigi) }).then(set在庫).catch(エラー);
  }, [詳細, soko, meigi]);
  // 冷蔵庫を選ぶと、名義は一覧の最初に戻る（Access の Lis_倉庫ID_AfterUpdate）
  const 冷蔵庫 = (id: number) => {
    setSoko(id);
    setMeigi(opts?.名義[0]?.id ?? null);
  };

  async function 直す(r: Rec | null, 項目: string, 値: unknown) {
    try {
      if (r) await api.post("/api/soko/keihi/save", { ID: r.ID, 項目, 値 });
      else {
        await api.post("/api/soko/keihi/add", { soko, tsuki: 月, meigi, 項目, 値 });
        set新((x) => x + 1);
      }
    } catch (e) {
      エラー(e);
    }
    load();
  }
  async function 削除(r: Rec) {
    let 合言葉: string | null = null;
    if (詳細) {
      合言葉 = prompt("削除を行うにはパスワードが必要です、パスワードを入力してください。");
      if (合言葉 === null) return;
    } else if (!confirm("この行を削除します。よろしいですか？")) return;
    await api.post("/api/soko/keihi/delete", { ID: r.ID, 合言葉, 詳細 }).catch(エラー);
    load();
  }
  const 日 = (r: Rec | null, k: string) => (
    <Field
      value={r?.[k] ?? null}
      kind="date"
      className="w8"
      onCommit={(v) => {
        const d = parseDate(v);
        if (d === undefined) return alert("日付の書き方が正しくありません。（例：10/28）");
        直す(r, k, d);
      }}
    />
  );
  const 行 = (r: Rec | null) => (
    <tr key={r?.ID ?? `新${新}`} className={r ? "" : "kk-newrow"}>
      {詳細 && <td>{日(r, "発生日")}</td>}
      {詳細 && (
        <td>
          <select value={r?.在庫ID ?? 0} onChange={(e) => 直す(r, "在庫ID", Number(e.target.value))}>
            <option value={0}>（倉庫全体）</option>
            {在庫.map((z) => <option key={z.id} value={z.id}>{z.id} {z.入庫No} {z.商品名} {z.製造}</option>)}
          </select>
        </td>
      )}
      <td>
        <select value={r?.経費ID ?? ""} onChange={(e) => 直す(r, "経費ID", Number(e.target.value))}>
          <option value="" />
          {opts?.経費.map((k) => <option key={k.id} value={k.id}>{k.id} {k.name}</option>)}
        </select>
      </td>
      <td><Field value={r?.諸経費 ?? null} kind="num" className="w8" onCommit={(v) => 直す(r, "諸経費", v.trim() === "" ? null : Number(v))} /></td>
      {詳細 && (
        <td>
          <Field value={r?.請求先ID || ""} kind="num" kyotsu="tokui" className="w5" onCommit={(v) => 直す(r, "請求先ID", Number(v) || 0)} />
          <span className="small"> {r?.請求先}</span>
        </td>
      )}
      <td><Field value={r?.備考 ?? null} className="w20" onCommit={(v) => 直す(r, "備考", v || null)} /></td>
      <td className="c">{r?.chk ? "✓" : ""}</td>
      <td>{r?.登録日 ?? ""}</td>
      <td>{r && <button onClick={() => 削除(r)}>削除</button>}</td>
    </tr>
  );
  const 合計 = rows.reduce((a, r) => a + Number(r.諸経費 ?? 0), 0);
  return (
    <div className="sz sko">
      <div className="kk-head">
        <div className="kk-title">諸経費登録</div>
        <span>集計月</span>
        <button onClick={() => opts && set月(opts.最初.最初)} title="いちばん古い入庫の月">|◀</button>
        <button onClick={() => set月(月を足す(月, -1))}>◀</button>
        <Field value={月} className="w5" onCommit={(v) => /^\d{4}\/\d{1,2}$/.test(v) && set月(`${v.slice(0, 4)}/${v.slice(5).padStart(2, "0")}`)} />
        <button onClick={() => set月(月を足す(月, 1))}>▶</button>
        <button onClick={() => opts && set月(opts.最初.最後)} title="いちばん新しい入庫の月">▶|</button>
        <span>名義</span>
        <select value={meigi ?? ""} onChange={(e) => setMeigi(Number(e.target.value))}>
          {opts?.名義.map((m) => <option key={m.id} value={m.id}>{m.id} {m.name}</option>)}
        </select>
        <label><input type="checkbox" checked={詳細} onChange={(e) => set詳細(e.target.checked)} /> 詳細</label>
        <button onClick={() => nav(-1)}>閉じる</button>
      </div>
      <div className="sko-body">
        <div className="sko-bins">
          {opts?.倉庫.map((w) => (
            <button key={w.id} className={"sko-bin" + (w.id === soko ? " on" : "")} onClick={() => 冷蔵庫(w.id)}>
              <div><b>{w.id}</b> {w.name}</div>
            </button>
          ))}
        </div>
        <div className="sko-main">
          <table className="sz-grid">
            <thead>
              <tr>
                {詳細 && <th>発生日</th>}
                {詳細 && <th>在庫</th>}
                <th>経費</th><th>金額</th>{詳細 && <th>請求先</th>}<th>備考</th><th>chk</th><th>登録日</th><th></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => 行(r))}
              {行(null)}
            </tbody>
            <tfoot>
              <tr><td colSpan={詳細 ? 3 : 1}>合計</td><td className="r">{num(合計)}</td><td colSpan={詳細 ? 5 : 4} /></tr>
            </tfoot>
          </table>
          <div className="small sko-pad">一番下の空いた行に入れると、新しい諸経費になります。在庫を選ばない（倉庫全体の）諸経費は、請求書で別の行になります。</div>
        </div>
      </div>
    </div>
  );
}
