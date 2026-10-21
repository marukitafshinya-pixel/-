import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api, ApiError, num } from "../api";

type Rec = Record<string, any>;
const エラー = (e: unknown) => alert(e instanceof ApiError ? e.message : String(e));
const 日 = (v: string | null | undefined) => (v ? String(v).slice(0, 10).replace(/-/g, "/") : "");
const 工場 = [
  { id: 11, name: "丸北北海道" },
  { id: 191, name: "ふらの" },
  { id: 1, name: "1" },
  { id: 137, name: "137" },
  { id: 1187, name: "1187" },
];

/**
 * 在庫更新（Access の FM_在庫更新）。メニューの「在庫更新」から開く。
 * 左：まだ登録していない入庫（製造の出来高）、右：まだ登録していない便。印を付けて［更新］すると、
 * 入庫を在庫に入れ、便の出荷を在庫から引き、在庫を集計する。終わったら在庫確認を出す。［元に戻す］で前回の更新を取り消す。
 */
export default function WsKoshin() {
  const nav = useNavigate();
  const [d, setD] = useState<Rec | null>(null);
  const [結果, set結果] = useState<Rec | null>(null);
  const [工場ID, set工場ID] = useState(11);
  const [確認, set確認] = useState<Rec[]>([]);
  const [動作中, set動作中] = useState(false);

  async function 読む() {
    try {
      setD(await api.get<Rec>("/api/ws/koshin"));
    } catch (e) {
      エラー(e);
    }
  }
  useEffect(() => {
    読む();
  }, []);

  async function 印(種類: "入庫" | "便", id: number, 値: boolean) {
    try {
      await api.post("/api/ws/koshin/chk", { 種類, id, 値 });
      setD((x) =>
        x && {
          ...x,
          入庫一覧: 種類 === "入庫" ? x.入庫一覧.map((r: Rec) => (r.入庫ID === id ? { ...r, 抽出区分: 値 } : r)) : x.入庫一覧,
          便一覧: 種類 === "便" ? x.便一覧.map((r: Rec) => (r.輸送ID === id ? { ...r, 抽出区分: 値 } : r)) : x.便一覧,
        },
      );
    } catch (e) {
      エラー(e);
    }
  }

  async function 全部(種類: "入庫" | "便", 値: boolean) {
    const list: Rec[] = 種類 === "入庫" ? d?.入庫一覧 ?? [] : d?.便一覧 ?? [];
    for (const r of list) if (!!r.抽出区分 !== 値) await 印(種類, 種類 === "入庫" ? r.入庫ID : r.輸送ID, 値);
  }

  async function 更新() {
    const 入 = (d?.入庫一覧 ?? []).filter((r: Rec) => r.抽出区分).length;
    const 便 = (d?.便一覧 ?? []).filter((r: Rec) => r.抽出区分).length;
    if (!入 && !便) return alert("更新する入庫か便に印を付けてください。");
    if (!confirm(`入庫 ${入} 件・便 ${便} 件で在庫を更新します。よろしいですか？`)) return;
    set動作中(true);
    try {
      const r = await api.post<Rec>("/api/ws/koshin/run", {});
      set結果(r);
      set確認(r.在庫確認);
      set工場ID(11);
      if (r.登録できない)
        alert(`${r.登録できない}件 の出荷レコードが登録されませんでした。\n再度、出荷データから在庫を確認し、登録を行ってください。`);
      await 読む();
    } catch (e) {
      エラー(e);
    } finally {
      set動作中(false);
    }
  }

  async function 工場を変える(id: number) {
    set工場ID(id);
    set確認(await api.get<Rec[]>("/api/ws/koshin/kakunin", { kojo: id }));
  }

  async function 元に戻す() {
    const KT = 結果?.更新時間 ?? d?.前回;
    if (!KT) return alert("戻せる更新がありません。");
    if (!confirm(`${KT} の在庫更新を取り消して、更新の前に戻します。よろしいですか？`)) return;
    try {
      await api.post("/api/ws/koshin/repair", { 更新時間: KT });
      set結果(null);
      alert("更新の前に戻しました。");
      await 読む();
    } catch (e) {
      エラー(e);
    }
  }

  async function 閉じる() {
    await api.post("/api/ws/koshin/close").catch(() => {});
    nav(-1);
  }

  return (
    <div className="ko">
      <div className="tabs">
        <span>メインメニュー</span>
        <span className="active">FM_在庫更新</span>
      </div>
      <div className="ko-top">
        <div className="title">在庫更新</div>
        <div className="info">今日：{日(d?.今日)}　前回の更新：{d?.前回 ?? ""}</div>
        <div className="btns">
          <button className="go" onClick={更新} disabled={動作中}>{動作中 ? "更新中…" : "更新"}</button>
          <button className="red" onClick={元に戻す}>元に戻す</button>
          <button onClick={閉じる}>閉じる</button>
        </div>
      </div>
      <div className="ko-body">
        <div className="ko-box">
          <div className="cap">
            入庫（まだ在庫に入れていない製造の出来高）
            <span><button onClick={() => 全部("入庫", true)}>全部選ぶ</button><button onClick={() => 全部("入庫", false)}>全部外す</button></span>
          </div>
          <table className="ws-grid">
            <thead><tr><th>選択</th><th>入庫日</th><th>倉庫</th><th>商品名</th><th>規格</th><th>ケース</th><th>kg</th><th>製造日</th><th>区分</th><th>確定</th></tr></thead>
            <tbody>
              {(d?.入庫一覧 ?? []).map((r: Rec) => (
                <tr key={r.入庫ID} className={r.抽出区分 ? "on" : ""}>
                  <td className="c"><input type="checkbox" checked={!!r.抽出区分} onChange={(e) => 印("入庫", r.入庫ID, e.target.checked)} /></td>
                  <td>{日(r.入庫日)}</td><td>{r.倉庫名}</td><td>{r.商品名}</td><td>{r.規格}</td>
                  <td className="r">{num(r.ケース)}</td><td className="r">{num(r.商品kg)}</td><td>{日(r.製造日)}</td><td className="c">{r.タグ}</td>
                  <td className="c">{r.数量確定フラグ ? "✔" : ""}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {d && !d.入庫一覧.length && <p className="ko-none">まだ登録していない入庫はありません。</p>}
        </div>
        <div className="ko-box">
          <div className="cap">
            便（まだ登録していない出荷のある便）
            <span><button onClick={() => 全部("便", true)}>全部選ぶ</button><button onClick={() => 全部("便", false)}>全部外す</button></span>
          </div>
          <table className="ws-grid">
            <thead><tr><th>選択</th><th>出荷日</th><th>運送会社</th><th>車番</th><th>出荷</th><th>未登録</th><th>積込</th></tr></thead>
            <tbody>
              {(d?.便一覧 ?? []).map((r: Rec) => (
                <tr key={r.輸送ID} className={r.抽出区分 ? "on" : ""}>
                  <td className="c"><input type="checkbox" checked={!!r.抽出区分} onChange={(e) => 印("便", r.輸送ID, e.target.checked)} /></td>
                  <td>{日(r.出荷計画日)}</td><td>{r.運送会社名}</td><td>{r.車番}</td>
                  <td className="r">{r.件数}</td><td className="r">{r.未登録}</td><td className="c">{r.受領印チェック ? "済" : "未"}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {d && !d.便一覧.length && <p className="ko-none">まだ登録していない便はありません。</p>}
        </div>
      </div>
      {結果 && (
        <div className="modal" onClick={() => set結果(null)}>
          <div className="nt" onClick={(e) => e.stopPropagation()}>
            <div className="nt-head">
              在庫確認（{結果.更新時間} の更新：入庫 {結果.入庫件数} 件）
              <select value={工場ID} onChange={(e) => 工場を変える(Number(e.target.value))}>
                {工場.map((k) => <option key={k.id} value={k.id}>{k.name}</option>)}
              </select>
              <button onClick={() => set結果(null)}>確認OK</button>
            </div>
            <table className="ws-grid">
              <thead><tr><th>分類</th><th>コード</th><th>商品名</th><th>規格</th><th>繰越kg</th><th>製造kg</th><th>出荷kg</th><th>在庫kg</th></tr></thead>
              <tbody>
                {確認.map((r) => (
                  <tr key={`${r.分類ID}-${r.商品コード}-${r.商品名}`}>
                    <td className="c">{r.分類ID}</td><td className="r">{r.商品コード}</td><td>{r.商品名}</td><td>{r.規格}</td>
                    <td className="r">{num(r.繰越kg)}</td><td className="r">{num(r.製造kg)}</td><td className="r">{num(r.出荷kg)}</td><td className="r">{num(r.在庫kg)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
