import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { api, ApiError, num } from "../api";
import { CalendarDialog } from "../formParts";

type Rec = Record<string, any>;
const エラー = (e: unknown) => alert(e instanceof ApiError ? e.message : String(e));
const 月日曜 = (v: string | null | undefined) => {
  if (!v) return "";
  const d = new Date(v.slice(0, 10) + "T00:00:00");
  return `${d.getMonth() + 1}月${d.getDate()}日（${"日月火水木金土"[d.getDay()]}）`;
};

// 帳票の選び方（Access の flm_帳票選択）
const 帳票 = [
  { id: 1, name: "入庫依頼書", cls: "b1" },
  { id: 2, name: "出荷案内書", cls: "b2" },
  { id: 3, name: "送品案内書(冷蔵庫)", cls: "b3" },
  { id: 4, name: "送品案内書(ユーザー)", cls: "b4" },
  { id: 5, name: "送品案内書(無地)", cls: "b5" },
];
// 一覧の印（左から）
const 印 = [
  { k: "仮入庫通知", name: "仮入庫\n印刷" },
  { k: "入庫依頼書確認chk", name: "入庫依頼書\n帳票チェック" },
  { k: "仮FAX", name: "仮入庫FAX\n送信済み", red: true },
  { k: "入庫依頼書送付chk", name: "入庫依頼書\nFAX送信済み" },
  { k: "送品案内書確認chk", name: "送品案内書\nチェック" },
  { k: "送品案内送付chk", name: "送品案内書\n印刷済み" },
];
const まだ = () => alert("帳票の形は、紙の見本（写真や PDF）をいただいてから作ります。");

/**
 * 出荷関連報告書印刷（Access の FSD_出荷報告印刷）。出荷明細票の「入庫案内・出荷・送品案内」から開く。
 * 開いたときに入庫依頼書確認用の表を作り直し、その日の届け先・名義・納品日ごとに、入庫依頼書などを送ったかの印を付ける。
 */
export default function WsHoukoku() {
  const nav = useNavigate();
  const [sp] = useSearchParams();
  const [date, setDate] = useState(sp.get("date") ?? new Date().toISOString().slice(0, 10));
  const [bin, setBin] = useState<Rec[]>([]);
  const [yuso, setYuso] = useState<number | null>(null);
  const [kind, setKind] = useState(0);
  const [rows, setRows] = useState<Rec[]>([]);
  const [準備, set準備] = useState(false);
  const [cal, setCal] = useState(false);
  const [担当者, set担当者] = useState("");
  const [備考, set備考] = useState("");

  // 開いたとき：表を作り直す
  useEffect(() => {
    api.post("/api/ws/houkoku/open").then(() => set準備(true), エラー);
  }, []);
  useEffect(() => {
    api.get<Rec[]>("/api/ws/houkoku/bin", { date }).then(setBin);
  }, [date]);
  useEffect(() => {
    if (準備) 一覧();
  }, [準備, date, yuso, kind]);

  async function 一覧() {
    setRows(await api.get<Rec[]>("/api/ws/houkoku/list", { date, yuso, kind }));
  }

  async function 帳票を選ぶ(id: number) {
    await api.post("/api/ws/houkoku/clear");
    setKind(kind === id ? 0 : id);
  }

  async function 印を付ける(r: Rec, k: string, 値: boolean) {
    try {
      await api.post("/api/ws/houkoku/chk", { ID: r.ID, 項目: k, 値, kind });
      setRows(rows.map((x) => (x.ID === r.ID ? { ...x, [k]: 値 } : x)));
    } catch (e) {
      エラー(e);
    }
  }

  async function 閉じる() {
    await api.post("/api/ws/houkoku/clear").catch(() => {});
    nav(-1);
  }

  return (
    <div className="hr">
      <div className="tabs">
        <span>メインメニュー</span>
        <span>FM_出荷明細票</span>
        <span className="active">出荷関連報告書印刷</span>
      </div>
      <div className="hr-top">
        <div className="hr-col">
          <div className="lbl">出荷日</div>
          <input className="date" value={date.replace(/-/g, "/")} readOnly onDoubleClick={() => setCal(true)} title="ダブルクリックでカレンダー" />
          <button className="sekisai" onClick={() => (yuso ? まだ() : alert("運送便を指定してください"))}>積込確認書印刷</button>
        </div>
        <div className="hr-col">
          <div className="lbl">運送会社選択</div>
          <div className="hr-bin">
            <div className="head"><span>運送会社名</span><span>車番</span></div>
            {bin.map((b) => (
              <div key={b.輸送ID} className={b.輸送ID === yuso ? "on" : ""} onClick={() => setYuso(b.輸送ID === yuso ? null : b.輸送ID)}>
                <span>{b.運送会社名}</span><span>{b.車番}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="hr-right">
          <div className="hr-kind">
            {帳票.map((x) => (
              <button key={x.id} className={`${x.cls} ${kind === x.id ? "on" : ""}`} onClick={() => 帳票を選ぶ(x.id)}>{x.name}</button>
            ))}
          </div>
          <div className="hr-memo">
            <button onClick={まだ}>大阪入庫リスト印刷</button>
            <div className="memo">
              <div className="row"><span className="k">担当者名</span><input value={担当者} onChange={(e) => set担当者(e.target.value)} /></div>
              <div className="row"><span className="k tall">備考</span><textarea value={備考} onChange={(e) => set備考(e.target.value)} /></div>
            </div>
          </div>
        </div>
      </div>
      <div className="hr-list">
        <table className="hr-grid">
          <thead>
            <tr>
              <th>仮印刷</th><th>選択</th><th>届け先</th><th>商品kg</th><th>名義</th><th>納品日</th><th>区分</th>
              {印.map((x) => (
                <th key={x.k} className={x.red ? "red" : ""}>{x.name}</th>
              ))}
              <th>積込</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.ID}>
                <td><button className="kari" onClick={まだ}>印刷</button></td>
                <td className="c"><input type="checkbox" checked={!!r.抽出区分} onChange={(e) => 印を付ける(r, "抽出区分", e.target.checked)} /></td>
                <td className="todoke">{r.届け先}</td>
                <td className="r kg">{num(r.商品kg)}</td>
                <td className="mei">{r.入庫後名義名}</td>
                <td className="nohin">{月日曜(r.納品日)}</td>
                <td className={`kubun ${r.ユーザー区分名 === "倉庫" ? "soko" : "user"}`}>{r.ユーザー区分名}</td>
                {印.map((x) => (
                  <td key={x.k} className="c"><input type="checkbox" checked={!!r[x.k]} onChange={(e) => 印を付ける(r, x.k, e.target.checked)} /></td>
                ))}
                <td className={`seki ${r.積込完了chk ? "" : "mi"}`}>{r.積込完了chk ? "済" : "未"}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {準備 && rows.length === 0 && <p className="hr-none">この日の入庫依頼書・送品案内書の対象はありません。</p>}
      </div>
      <div className="hr-foot">
        <div className="box">
          <button onClick={() => { setYuso(null); setKind(0); }}>条件クリア</button>
          <button onClick={まだ}>印刷表示</button>
          <button onClick={閉じる}>閉じる</button>
        </div>
      </div>
      {cal && (
        <CalendarDialog
          value={date}
          onClose={() => setCal(false)}
          onPick={(d) => {
            setCal(false);
            setYuso(null);
            setDate(d.slice(0, 10));
          }}
        />
      )}
    </div>
  );
}
