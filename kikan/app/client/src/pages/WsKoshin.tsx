import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api, ApiError, num } from "../api";

type Rec = Record<string, any>;
const エラー = (e: unknown) => alert(e instanceof ApiError ? e.message : String(e));
/** 和暦（令和8年10月22日・平成30年03月26日 の形。Access の画面と同じ） */
const 年月日 = (v: string | null | undefined) => {
  if (!v) return "";
  const t = String(v).slice(0, 10);
  const [y, m, dd] = t.split("-").map(Number);
  const [元号, 年] = t >= "2019-05-01" ? ["令和", y - 2018] : t >= "1989-01-08" ? ["平成", y - 1988] : ["昭和", y - 1925];
  return `${元号}${年}年${String(m).padStart(2, "0")}月${String(dd).padStart(2, "0")}日`;
};
const 短い日 = (v: string | null | undefined) => (v ? `${String(v).slice(2, 4)}/${String(v).slice(5, 7)}/${String(v).slice(8, 10)}` : "");
const 月日 = (v: string | null | undefined) => (v ? `${String(v).slice(5, 7)}月${String(v).slice(8, 10)}日` : "");
const 工場 = [
  { id: 11, name: "丸北北海道" },
  { id: 191, name: "ふらの" },
];

/**
 * 在庫更新処理（Access の FM_在庫更新）。メニューの「在庫更新」から開く。
 * 右上：まだ登録していない入庫（製造の出来高。数量確定したものだけ選べる）、右下：まだ登録していない便（便を押すと左下に中身）。
 * 印を付けて［登録］すると、入庫を在庫に入れ、便の出荷を在庫から引き、在庫を集計する。終わったら在庫確認を出す。
 * ［登録前に戻す］で直前の登録を取り消す。
 */
export default function WsKoshin() {
  const nav = useNavigate();
  const [d, setD] = useState<Rec | null>(null);
  const [結果, set結果] = useState<Rec | null>(null);
  const [工場ID, set工場ID] = useState(11);
  const [確認, set確認] = useState<Rec[]>([]);
  const [動作中, set動作中] = useState(false);
  const [便, set便] = useState<number | null>(null);
  const [中身, set中身] = useState<Rec[]>([]);

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
    try {
      await api.post("/api/ws/koshin/all", { 種類, 値 });
      await 読む();
    } catch (e) {
      エラー(e);
    }
  }

  async function 便を見る(id: number) {
    set便(id);
    set中身(await api.get<Rec[]>(`/api/ws/koshin/bin/${id}`));
  }

  async function 登録() {
    const 入 = (d?.入庫一覧 ?? []).filter((r: Rec) => r.抽出区分).length;
    const 便数 = (d?.便一覧 ?? []).filter((r: Rec) => r.抽出区分).length;
    if (!入 && !便数) return alert("登録する入庫か便を選択してください。");
    if (!confirm(`入庫 ${入} 件・便 ${便数} 件で在庫を更新します。よろしいですか？`)) return;
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

  /** 日時更新（押したときだけ）。在庫の期限通知・分類・期を今日の日付で付け直し、今日の在庫を日別集計に控える。繰越はしない。 */
  async function 日時更新() {
    set動作中(true);
    try {
      const n = await api.get<Rec>("/api/ws/koshin/nichiji");
      let 自動の登録 = false;
      if (n.差日数 == null || Number(n.差日数) >= 2) {
        const 何日 = n.差日数 == null ? "前回の更新の記録がありません。" : `${n.差日数}日間の更新がされていません`;
        自動の登録 = confirm(`${何日}${月日(n.昨日)}まで更新を行いますか？`);
        if (!自動の登録) alert("手動で更新を行ってください。");
      }
      const r = await api.post<Rec>("/api/ws/koshin/nichiji", { 自動の登録 });
      alert(
        `日時更新が終わりました。\n` +
          (自動の登録 ? `入庫の登録：${r.入庫件数} 件\n` : "") +
          `期限・分類の付け直し：${r.付け直し} 件\n日別の在庫の控え：${r.控え} 件`,
      );
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

  async function 戻す() {
    const KT = 結果?.更新時間 ?? d?.前回;
    if (!KT) return alert("戻せる登録がありません。");
    if (!confirm(`${KT} の登録を取り消して、登録の前に戻します。よろしいですか？`)) return;
    try {
      await api.post("/api/ws/koshin/repair", { 更新時間: KT });
      set結果(null);
      alert("登録の前に戻しました。");
      await 読む();
    } catch (e) {
      エラー(e);
    }
  }

  async function 閉じる() {
    await api.post("/api/ws/koshin/close").catch(() => {});
    nav(-1);
  }

  const 入庫一覧: Rec[] = d?.入庫一覧 ?? [];
  const 便一覧: Rec[] = d?.便一覧 ?? [];
  const 未登録便 = 便一覧.reduce((a, r) => a + Number(r.未登録 ?? 0), 0);

  return (
    <div className="ko">
      <div className="tabs">
        <span>メインメニュー</span>
        <span className="active">更新処理</span>
      </div>
      <div className="ko-top">
        <div className="title">在庫更新処理</div>
        <div className="msg">データを選択し登録ボタンを押してください。</div>
        <button className="close" onClick={閉じる}>閉じる</button>
      </div>
      <div className="ko-body">
        <div className="ko-left">
          <div className="ko-ctrl">
            <button onClick={日時更新} disabled={動作中}>日時更新</button>
            <button onClick={登録} disabled={動作中}>{動作中 ? "登録中…" : "登録"}</button>
            <button className="gray" onClick={戻す}>登録前に戻す</button>
            <div className="lbl">更新日</div>
            <div className="v">{年月日(d?.今日)}</div>
            <div className="lbl">前回更新日</div>
            <div className="v mizu">{年月日(d?.前回更新日)}</div>
            <div className="lbl">前回更新時間</div>
            <div className="v mizu">{d?.前回 ?? ""}</div>
          </div>
          <div className="ko-detail">
            <table>
              <thead><tr><th>届け先</th><th>商品名</th><th>ケース</th></tr></thead>
              <tbody>
                {中身.map((r, i) => (
                  <tr key={i}><td>{r.届け先}</td><td>{r.商品名}</td><td>{r.ケース}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        <div className="ko-right">
          <div className="ko-sec seisan">
            <div className="bar">
              <button onClick={() => 全部("入庫", true)}>選択</button>
              <button onClick={() => 全部("入庫", false)}>解除</button>
              <span className="tag">生産登録状況</span>
              <span className="cnt">{入庫一覧.length} 件未登録</span>
            </div>
            <table>
              <thead><tr><th>選択</th><th>保管庫</th><th>商品名</th><th>製造日</th><th>ケース</th><th>Kg</th></tr></thead>
              <tbody>
                {入庫一覧.map((r) => (
                  <tr key={r.入庫ID}>
                    <td className="c"><input type="checkbox" checked={!!r.抽出区分} onChange={(e) => 印("入庫", r.入庫ID, e.target.checked)} /></td>
                    <td>{r.倉庫名}</td><td>{r.商品名}</td><td className="c">{短い日(r.製造日)}</td>
                    <td className="r">{num(r.ケース)}</td><td className="r">{num(r.商品kg)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="ko-sec yuso">
            <div className="bar">
              <button onClick={() => 全部("便", true)}>選択</button>
              <button onClick={() => 全部("便", false)}>解除</button>
              <span className="tag">輸送登録状況</span>
              <span className="cnt">{未登録便} 件未登録</span>
            </div>
            <table>
              <thead><tr><th>選択</th><th>出荷日</th><th>運送会社</th><th>車番</th><th>未登録</th></tr></thead>
              <tbody>
                {便一覧.map((r) => (
                  <tr key={r.輸送ID} className={便 === r.輸送ID ? "cur" : ""} onClick={() => 便を見る(r.輸送ID)}>
                    <td className="c"><input type="checkbox" checked={!!r.抽出区分} onClick={(e) => e.stopPropagation()} onChange={(e) => 印("便", r.輸送ID, e.target.checked)} /></td>
                    <td className="c">{月日(r.出荷計画日)}</td><td>{r.運送会社名}</td><td>{r.車番}</td><td className="r">{r.未登録} 件</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
      {結果 && (
        <div className="modal" onClick={() => set結果(null)}>
          <div className="nt" onClick={(e) => e.stopPropagation()}>
            <div className="nt-head">
              在庫確認（{結果.更新時間} の登録：入庫 {結果.入庫件数} 件）
              <select value={工場ID} onChange={(e) => 工場を変える(Number(e.target.value))}>
                {工場.map((k) => <option key={k.id} value={k.id}>{k.name}</option>)}
              </select>
              <button onClick={() => set結果(null)}>閉じる</button>
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
