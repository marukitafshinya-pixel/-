import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api, ApiError } from "../api";
import { Field, parseDate } from "../formParts";

type Rec = Record<string, any>;
type 選択肢 = { id: number; name: string | null };
const エラー = (e: unknown) => alert(e instanceof ApiError ? e.message : String(e));

/** 詳細の画面の項目（題・項目・種類） */
const 詳細の項目: [string, string, "num" | "date" | "text" | "bool" | "maru"][] = [
  ["冷蔵庫", "短縮コード", "num"], ["名義", "名義コード", "num"], ["商品（0＝標準）", "商品コード", "num"], ["共通名称", "共通名称", "text"],
  ["契約入庫日 開始", "契約入庫日開始", "date"], ["契約入庫日 終了", "契約入庫日終了", "date"], ["終了日", "終了日", "date"], ["終了", "終了chk", "bool"],
  ["入出庫料", "入出庫料", "num"], ["保管料", "保管料", "num"], ["計算単位（1＝ケース）", "計算単位", "num"], ["最低入出庫料", "最低入出庫料", "num"], ["最低入出庫kg", "最低入出庫kg", "num"],
  ["最低保管料", "最低保管料", "num"], ["最低保管kg", "最低保管kg", "num"], ["初回だけ最低保管料", "初回最低保管料のみ適用", "bool"], ["荷役料", "荷役料", "num"],
  ["小数点区分", "小数点区分", "maru"], ["一桁目繰上", "一桁目繰上", "maru"], ["丸め計算", "丸め計算", "num"], ["名義変更料", "名義変更料", "num"], ["名変料発生区分", "名変料発生区分", "num"],
  ["休日入出庫料", "休日入出庫料", "num"], ["小口出庫割増", "小口出庫割増", "num"], ["業務代行料", "業務代行料", "num"], ["分割手数料", "分割手数料", "num"], ["証明書料金", "証明書料金", "num"],
  ["賞味期限管理手数料kg", "賞味期限管理手数料kg", "num"], ["賞味期限管理手数料dm3", "賞味期限管理手数料dm3", "num"], ["検品手数料", "検品手数料", "num"], ["画像報告手数料", "画像報告手数料", "num"],
  ["経由出庫手数料", "経由出庫手数料", "num"], ["税区分", "税区分", "num"], ["自動名変", "自動名変", "bool"], ["自動名変の変更後名義", "自動変更後名義ID", "num"], ["入力日", "入力日", "date"], ["備考", "備考", "text"],
];

/**
 * 倉庫賃率・入庫設定（Access の FM_保管賃設定）。冷蔵庫ごとに、倉庫詳細設定（名義×商品〈0＝標準〉×契約入庫日の期間の料率）と得意先の入庫フラグ。
 * ［修正］でパスワードを入れると直せる（行を足す・消すも）。［詳細］で 1 行の全部の項目。
 */
export function SokoChinritsu() {
  const nav = useNavigate();
  const [一覧, set一覧] = useState<Rec[]>([]);
  const [丸め, set丸め] = useState<選択肢[]>([]);
  const [i, setI] = useState(0);
  const [rows, setRows] = useState<Rec[]>([]);
  const [合言葉, set合言葉] = useState<string | null>(null);
  const [詳細, set詳細] = useState<number | null>(null);
  const 冷蔵庫 = 一覧[i];
  const 読む = () => api.get<any>("/api/soko/chinritsu").then((r) => { set一覧(r.冷蔵庫); set丸め(r.丸め); }).catch(エラー);
  useEffect(() => {
    読む();
  }, []);
  const load = () => (冷蔵庫 ? api.get<Rec[]>(`/api/soko/chinritsu/${冷蔵庫.id}`).then(setRows).catch(エラー) : Promise.resolve());
  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [冷蔵庫?.id]);
  const ro = 合言葉 === null;
  async function パスワード(): Promise<string | null> {
    if (合言葉 !== null) return 合言葉;
    const p = prompt("パスワードを入力してください");
    if (p === null) return null;
    const r = await api.post<{ ok: boolean }>("/api/soko/chinritsu/unlock", { 合言葉: p }).catch((e) => (エラー(e), null));
    if (!r?.ok) {
      if (r) alert("パスワードが違います!! ");
      return null;
    }
    return p;
  }
  async function 修正() {
    const p = await パスワード();
    if (p !== null) set合言葉(p);
  }
  async function 直す(r: Rec, 項目: string, 値: unknown) {
    await api.post("/api/soko/chinritsu/save", { 合言葉, ID: r.ID, 項目, 値 }).catch(エラー);
    load();
  }
  async function 足す() {
    await api.post("/api/soko/chinritsu/add", { 合言葉, 短縮コード: 冷蔵庫.id }).catch(エラー);
    load();
  }
  async function 消す(r: Rec) {
    if (!confirm(`名義 ${r.名義コード}・商品 ${r.商品コード} の設定を削除します。よろしいですか？`)) return;
    await api.post("/api/soko/chinritsu/delete", { 合言葉, ID: r.ID }).catch(エラー);
    load();
  }
  async function 入庫フラグ(v: boolean) {
    await api.post("/api/soko/chinritsu/flag", { 合言葉, 短縮コード: 冷蔵庫.id, 入庫フラグ: v }).catch(エラー);
    読む();
  }
  async function 詳細を開く(r: Rec) {
    // Access は［詳細］のたびにパスワードを聞く
    const p = await パスワード();
    if (p === null) return;
    set合言葉(p);
    set詳細(r.ID);
  }
  const 数 = (r: Rec, k: string, cls = "w5") => <Field value={r[k]} kind="num" className={cls} readOnly={ro} onCommit={(v) => 直す(r, k, v.trim() === "" ? null : Number(v))} />;
  const 日 = (r: Rec, k: string) => (
    <Field
      value={r[k]}
      kind="date"
      className="w8"
      readOnly={ro}
      onCommit={(v) => {
        const d = parseDate(v);
        if (d === undefined) return alert("日付の書き方が正しくありません。（例：10/28）");
        直す(r, k, d);
      }}
    />
  );
  return (
    <div className="sz sko">
      <div className="kk-head">
        <div className="kk-title">倉庫賃率・入庫設定</div>
        <button onClick={() => setI(0)}>|◀</button>
        <button onClick={() => setI(Math.max(0, i - 1))}>◀</button>
        <select value={冷蔵庫?.id ?? ""} onChange={(e) => setI(一覧.findIndex((x) => x.id === Number(e.target.value)))}>
          {一覧.map((x) => <option key={x.id} value={x.id}>{x.id} {x.name}</option>)}
        </select>
        <button onClick={() => setI(Math.min(一覧.length - 1, i + 1))}>▶</button>
        <button onClick={() => setI(一覧.length - 1)}>▶|</button>
        <span>{i + 1}/{一覧.length}</span>
        {冷蔵庫 && (
          <label title="入れると、倉庫詳細設定にある名義だけ入庫できる。外すと名義 11・137・150 だけ">
            <input type="checkbox" checked={!!冷蔵庫.入庫フラグ} disabled={ro} onChange={(e) => 入庫フラグ(e.target.checked)} /> 入庫フラグ
          </label>
        )}
        <button className={ro ? "red" : "red on"} onClick={修正}>{ro ? "修正" : "修正中"}</button>
        {!ro && <button onClick={足す}>行を足す</button>}
        <button onClick={() => nav(-1)}>閉じる</button>
      </div>
      <div className="sko-gridwrap">
        <table className="sz-grid sko-grid">
          <thead>
            <tr>
              <th>名義</th><th>商品</th><th>契約入庫日</th><th>終了日</th><th>入出庫料</th><th>保管料</th><th>単位</th><th>最低入出庫料</th><th>最低入出庫kg</th>
              <th>最低保管料</th><th>最低保管kg</th><th>初回だけ</th><th>荷役料</th><th>小数点</th><th>一桁目</th><th>自動名変</th><th>備考</th><th></th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && <tr><td colSpan={18} className="c">設定はありません</td></tr>}
            {rows.map((r) => (
              <tr key={r.ID}>
                <td>{数(r, "名義コード")}<div className="small">{r.名義名}</div></td>
                <td>{数(r, "商品コード")}<div className="small">{r.商品コード ? r.商品名 : "標準"}</div></td>
                <td>{日(r, "契約入庫日開始")}<br />{日(r, "契約入庫日終了")}</td>
                <td>{日(r, "終了日")}</td>
                <td>{数(r, "入出庫料")}</td><td>{数(r, "保管料")}</td>
                <td>
                  <select value={r.計算単位 ?? 0} disabled={ro} onChange={(e) => 直す(r, "計算単位", Number(e.target.value))}>
                    <option value={0}>kg</option><option value={1}>ケース</option>
                  </select>
                </td>
                <td>{数(r, "最低入出庫料")}</td><td>{数(r, "最低入出庫kg")}</td><td>{数(r, "最低保管料")}</td><td>{数(r, "最低保管kg")}</td>
                <td className="c"><input type="checkbox" checked={!!r.初回最低保管料のみ適用} disabled={ro} onChange={(e) => 直す(r, "初回最低保管料のみ適用", e.target.checked)} /></td>
                <td>{数(r, "荷役料")}</td>
                {(["小数点区分", "一桁目繰上"] as const).map((k) => (
                  <td key={k}>
                    <select value={r[k] ?? 0} disabled={ro} onChange={(e) => 直す(r, k, Number(e.target.value))}>
                      {丸め.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
                    </select>
                  </td>
                ))}
                <td className="c">
                  <input type="checkbox" checked={!!r.自動名変} disabled={ro} onChange={(e) => 直す(r, "自動名変", e.target.checked)} />
                  {r.自動名変 && <span className="small"> →{r.自動変更後名義ID}</span>}
                </td>
                <td><Field value={r.備考} className="w12" readOnly={ro} onCommit={(v) => 直す(r, "備考", v || null)} /></td>
                <td>
                  <button onClick={() => 詳細を開く(r)}>詳細</button>
                  {!ro && <button onClick={() => 消す(r)}>削除</button>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {詳細 !== null && (() => {
        const r = rows.find((x) => x.ID === 詳細);
        if (!r) return null;
        return (
          <div className="modal">
            <div className="sko-dlg">
              <div className="sko-dlg-h">
                倉庫詳細設定（ID {r.ID}）
                <span>
                  <button className="blue" onClick={() => confirm("マスタを登録しますか？") && set詳細(null)}>登録</button>
                  <button onClick={() => set詳細(null)}>閉じる</button>
                </span>
              </div>
              <table className="ws-grid sko-pad">
                <tbody>
                  {詳細の項目.map(([題, k, 種類]) => (
                    <tr key={k}>
                      <th>{題}</th>
                      <td>
                        {種類 === "num" ? 数(r, k, "w8")
                          : 種類 === "date" ? 日(r, k)
                          : 種類 === "bool" ? <input type="checkbox" checked={!!r[k]} onChange={(e) => 直す(r, k, e.target.checked)} />
                          : 種類 === "maru" ? (
                            <select value={r[k] ?? 0} onChange={(e) => 直す(r, k, Number(e.target.value))}>
                              {丸め.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
                            </select>
                          )
                          : <Field value={r[k]} className="w20" onCommit={(v) => 直す(r, k, v || null)} />}
                        {k === "短縮コード" && <span className="small"> {r.倉庫名}</span>}
                        {k === "名義コード" && <span className="small"> {r.名義名}</span>}
                        {k === "商品コード" && <span className="small"> {r.商品名}</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="small sko-pad">直した項目はそのまま保存されます。</div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
