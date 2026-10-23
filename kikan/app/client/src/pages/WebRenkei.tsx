import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api, ApiError } from "../api";
import { Field } from "../formParts";

type Rec = Record<string, any>;
const エラー = (e: unknown) => alert(e instanceof ApiError ? e.message : String(e));

/** WEB連携のメニュー（Access の F_Web出力選択画面・FM_マスタ管理）。できたものから押せるようにする */
export function WebMenu() {
  const nav = useNavigate();
  const 項目: { label: string; to?: string; 説明: string }[] = [
    { label: "相手先サイトの設定", to: "/web/settei", 説明: "elixxi・ランテック・販盛・MerQurius のログイン画面の住所と、ログインID・パスワード（暗号にして保存）" },
    { label: "elixxi 拠点コードマスタ", to: "/web/elixxi", 説明: "自社の届け先コードと elixxi の拠点コード" },
    { label: "大谷地 積み日表示マスタ", to: "/web/tsumi", 説明: "大谷地からの出庫で「○月○日 積み」を摘要に書く届け先" },
    { label: "ランテック賞味期限表示マスタ", to: "/web/lantec", 説明: "ランテックの発注の備考に賞味期限を書く届け先" },
    { label: "MerQurius 発注元マスタ", to: "/web/mq", 説明: "取引元と MerQurius の Web-EDI のコード" },
    { label: "elixxi 入庫依頼・出庫依頼", 説明: "これから作ります" },
    { label: "ランテック輸送手配・送り状照合", 説明: "これから作ります" },
    { label: "MerQurius 納入日程", to: "/web/merqurius", 説明: "納入日程 CSV を取り込んで照合し、登録用 CSV を作る" },
    { label: "販盛 在庫移動・仕入", 説明: "やり方を決めてから作ります" },
  ];
  return (
    <div className="sz sko">
      <div className="kk-head">
        <div className="kk-title">WEB連携</div>
        <button onClick={() => nav("/")}>閉じる</button>
      </div>
      <table className="sz-grid">
        <tbody>
          {項目.map((x) => (
            <tr key={x.label}>
              <td><button disabled={!x.to} onClick={() => x.to && nav(x.to)} style={{ minWidth: 220 }}>{x.label}</button></td>
              <td className="small">{x.説明}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/**
 * 相手先サイトの設定（Access の FM_UP管理・FM_Webアドレス管理）。サイトごとにログイン画面の住所と、ログインID・パスワードを入れる。
 * パスワードは暗号にしてサーバーに保存し、画面には出さない（変えるときだけ入れる）。利用者を選ぶと、その人だけが使うログインにできる。
 */
export function WebSettei() {
  const nav = useNavigate();
  const [d, setD] = useState<{ サイト: Rec[]; ログイン: Rec[]; 利用者: Rec[]; 鍵: boolean } | null>(null);
  const [合言葉, set合言葉] = useState<string | null>(null);
  const [新, set新] = useState<Rec | null>(null);
  const load = () => api.get<any>("/api/web/sites").then(setD).catch(エラー);
  useEffect(() => {
    load();
  }, []);
  async function 修正() {
    const p = prompt("合言葉を入力してください");
    if (p === null) return;
    const r = await api.post<{ ok: boolean }>("/api/web/unlock", { 合言葉: p }).catch((e) => (エラー(e), null));
    if (r?.ok) set合言葉(p);
    else if (r) alert("合言葉が違います");
  }
  async function サイトを直す(s: Rec, 項目: string, 値: string) {
    await api.post("/api/web/sites/save", { 合言葉, サイト: s.サイト, 項目, 値 }).catch(エラー);
    load();
  }
  async function 保存() {
    if (!新) return;
    try {
      await api.post("/api/web/login/save", { 合言葉, ...新 });
      set新(null);
      load();
    } catch (e) {
      エラー(e);
    }
  }
  async function 消す(l: Rec) {
    if (!confirm(`${l.サイト} のログイン（${l.利用者 || "全員"}）を消します。よろしいですか？`)) return;
    await api.post("/api/web/login/delete", { 合言葉, サイト: l.サイト, 利用者: l.利用者 }).catch(エラー);
    load();
  }
  if (!d) return null;
  const ro = 合言葉 === null;
  const 名前 = (id: string) => (id ? d.利用者.find((u) => u.id === id)?.name ?? id : "全員");
  return (
    <div className="sz sko">
      <div className="kk-head">
        <div className="kk-title">相手先サイトの設定</div>
        <button className={ro ? "red" : "red on"} onClick={修正}>{ro ? "修正" : "修正中"}</button>
        <button onClick={() => nav(-1)}>閉じる</button>
      </div>
      {!d.鍵 && <p className="sko-pad red">暗号の鍵（WEB_RENKEI_KEY）がサーバーに設定されていないため、パスワードを保存できません。</p>}
      <p className="sko-pad small">パスワードは暗号にして保存し、画面には出しません。変えるときだけ入れてください。Access に書かれていた ID・パスワードは写していません。</p>
      {d.サイト.map((s) => (
        <div key={s.サイト} className="sko-pad">
          <table className="sz-grid">
            <tbody>
              <tr>
                <th style={{ width: 200 }}>{s.名前}</th>
                <td>ログイン画面の住所 <Field value={s.住所} className="w30" readOnly={ro} onCommit={(v) => サイトを直す(s, "住所", v)} /></td>
                <td>備考 <Field value={s.備考} className="w20" readOnly={ro} onCommit={(v) => サイトを直す(s, "備考", v)} /></td>
              </tr>
            </tbody>
          </table>
          <table className="sz-grid">
            <thead><tr><th>使う人</th><th>ログインID</th><th>パスワード</th><th>寄託者など</th><th>更新</th><th></th></tr></thead>
            <tbody>
              {d.ログイン.filter((l) => l.サイト === s.サイト).map((l) => (
                <tr key={l.利用者}>
                  <td>{名前(l.利用者)}</td><td>{l.ログインID}</td><td>{l.パスワードあり ? "●●●●（保存済み）" : "（なし）"}</td><td>{l.寄託者}</td>
                  <td className="small">{l.更新日時} {l.更新者}</td>
                  <td>
                    {!ro && <button onClick={() => set新({ サイト: s.サイト, 利用者: l.利用者, ログインID: l.ログインID, パスワード: "", 寄託者: l.寄託者 })}>直す</button>}
                    {!ro && <button onClick={() => 消す(l)}>削除</button>}
                  </td>
                </tr>
              ))}
              {!ro && (
                <tr><td colSpan={6}><button onClick={() => set新({ サイト: s.サイト, 利用者: "", ログインID: "", パスワード: "", 寄託者: "" })}>ログインを足す</button></td></tr>
              )}
            </tbody>
          </table>
        </div>
      ))}
      {新 && (
        <div className="modal">
          <div className="sko-dlg">
            <div className="sko-dlg-h">
              ログイン（{d.サイト.find((s) => s.サイト === 新.サイト)?.名前}）
              <span><button className="blue" onClick={保存}>保存</button><button onClick={() => set新(null)}>やめる</button></span>
            </div>
            <table className="ws-grid sko-pad">
              <tbody>
                <tr>
                  <th>使う人</th>
                  <td>
                    <select value={新.利用者} onChange={(e) => set新({ ...新, 利用者: e.target.value })}>
                      <option value="">全員</option>
                      {d.利用者.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
                    </select>
                  </td>
                </tr>
                <tr><th>ログインID</th><td><input value={新.ログインID} onChange={(e) => set新({ ...新, ログインID: e.target.value })} autoComplete="off" /></td></tr>
                <tr><th>パスワード</th><td><input type="password" value={新.パスワード} placeholder="変えるときだけ入れる" onChange={(e) => set新({ ...新, パスワード: e.target.value })} autoComplete="new-password" /></td></tr>
                <tr><th>寄託者など</th><td><input value={新.寄託者} onChange={(e) => set新({ ...新, 寄託者: e.target.value })} /></td></tr>
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
