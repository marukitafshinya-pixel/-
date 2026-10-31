import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { api, ApiError, num } from "../api";
import { CalendarDialog, Field, PageClose } from "../formParts";
import { 帳票印刷, 積込確認書印刷 } from "./Chohyo";

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
// 帳票の選び方ごとの帳票（Access の cmd表示_Click）
const 帳票の種類: Record<number, string> = { 1: "nyuko", 2: "tsuchi", 3: "sohin_reizo", 4: "sohin_user", 5: "sohin_muji" };

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
  const [印刷, set印刷] = useState<{ pages: Rec[]; 名前: string } | null>(null);
  const [差出人, set差出人] = useState<Rec[] | null>(null);
  const [積込, set積込] = useState<Rec | null>(null);
  const [設定, set設定] = useState<Rec[]>([]);
  // 入庫依頼書コメントを備考欄から選ぶ（Access の FM_入庫依頼書 の［挿入］）
  const [コメント選ぶ, setコメント選ぶ] = useState<Rec | null>(null);
  const [備考欄, set備考欄] = useState<Rec[] | null>(null);

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

  async function コメントを直す(r: Rec, 値: string) {
    try {
      await api.post("/api/ws/houkoku/comment", { ID: r.ID, 値 });
      setRows((rs) => rs.map((x) => (x.ID === r.ID ? { ...x, 入庫依頼書コメント: 値.trim() || null } : x)));
    } catch (e) {
      エラー(e);
    }
  }
  async function 備考欄から(r: Rec) {
    if (!備考欄) {
      try {
        set備考欄((await api.get<any>("/api/ws/detail-choices")).備考欄 ?? []);
      } catch (e) {
        return エラー(e);
      }
    }
    setコメント選ぶ(r);
  }

  // 印刷表示：選んだ行の帳票（Access の cmd表示_Click）
  async function 印刷表示() {
    if (!kind) return alert("印刷する帳票（入庫依頼書・出荷案内書・送品案内書）を選んでください。");
    if (!rows.some((r) => r.抽出区分)) return alert("印刷する行の「選択」に印を付けてください。");
    try {
      const r = await api.post<{ pages: Rec[] }>("/api/ws/chohyo", { 種類: 帳票の種類[kind], 出荷日: date, 担当者, 備考 });
      set印刷({ pages: r.pages, 名前: 帳票.find((x) => x.id === kind)!.name });
    } catch (e) {
      エラー(e);
    }
  }

  // 仮印刷：その行だけ（Access の cmd_仮印刷_Click。印刷すると「仮入庫印刷」に印が付く）
  async function 仮印刷(r: Rec) {
    if (!confirm("仮印刷表示になりますが、よろしいですか？")) return;
    try {
      const x = await api.post<{ pages: Rec[] }>("/api/ws/chohyo", { 種類: "nyuko", 出荷日: date, links: [r.リンクコード1], 担当者, 備考, 仮: true });
      setRows(rows.map((y) => (y.ID === r.ID ? { ...y, 仮入庫通知: true } : y)));
      set印刷({ pages: x.pages, 名前: `仮印刷 ${r.届け先}` });
    } catch (e) {
      エラー(e);
    }
  }

  // 積込確認書印刷（Access の cmd_積込確認書印刷_Click）：便を選んでから
  async function 積込確認書() {
    if (!yuso) return alert("運送便を指定してください");
    try {
      const r = await api.get<Rec>(`/api/ws/sekisai/${yuso}`);
      // パレット輸送の便は、パレット輸送割付を開く（Access と同じ）
      if (r.パレット輸送) return nav(`/ws/pallet?id=${yuso}`);
      set積込(r);
    } catch (e) {
      エラー(e);
    }
  }

  async function 差出人を開く() {
    set差出人(await api.get<Rec[]>("/api/ws/sashidashi"));
    set設定(await api.get<Rec[]>("/api/ws/settei"));
  }

  async function 差出人を保存(x: Rec) {
    try {
      await api.post("/api/ws/sashidashi", x);
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
          <button className="sekisai" onClick={積込確認書}>積込確認書印刷</button>
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
            <button onClick={差出人を開く} title="帳票に出す会社名・住所・電話">差出人の設定</button>
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
              <th title="入庫依頼書に載せる一言。ダブルクリックで備考欄から選べます">入庫依頼書コメント</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.ID}>
                <td><button className="kari" onClick={() => 仮印刷(r)}>印刷</button></td>
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
                <td className="hr-comment">
                  <Field value={r.入庫依頼書コメント ?? ""} onCommit={(v) => コメントを直す(r, v)} onDoubleClick={() => 備考欄から(r)} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {準備 && rows.length === 0 && <p className="hr-none">この日の入庫依頼書・送品案内書の対象はありません。</p>}
      </div>
      <div className="hr-foot">
        <div className="box">
          <button onClick={() => { setYuso(null); setKind(0); }}>条件クリア</button>
          <button onClick={印刷表示}>印刷表示</button>
          <PageClose onClick={閉じる} />
        </div>
      </div>
      {印刷 && <帳票印刷 pages={印刷.pages} 名前={印刷.名前} onClose={() => set印刷(null)} />}
      {積込 && <積込確認書印刷 s={積込} onClose={() => set積込(null)} />}
      {コメント選ぶ && (
        <div className="modal" onClick={() => setコメント選ぶ(null)}>
          <div className="find" onClick={(e) => e.stopPropagation()}>
            <div className="find-head">備考欄選択（押すと入庫依頼書コメントにします）<button onClick={() => setコメント選ぶ(null)}>やめる</button></div>
            <div className="find-list">
              <table>
                <tbody>
                  {(備考欄 ?? []).map((o: Rec) => (
                    <tr key={o.id} onClick={() => { const r = コメント選ぶ; setコメント選ぶ(null); コメントを直す(r, o.name); }}>
                      <td className="sub">{o.分類}</td>
                      <td className="sub">{o.作業分類}</td>
                      <td>{o.name}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
      {差出人 && (
        <div className="modal" onClick={() => set差出人(null)}>
          <div className="nt" onClick={(e) => e.stopPropagation()}>
            <div className="nt-head">
              差出人の設定（入庫依頼書・出荷通知書・送品案内書に出す会社名・住所・電話）
              <button onClick={() => set差出人(null)}>閉じる</button>
            </div>
            <table className="ws-grid sd-grid">
              <thead>
                <tr><th>使うところ</th><th>社名</th><th>店舗</th><th>住所</th><th>TEL</th><th>FAX</th></tr>
              </thead>
              <tbody>
                {差出人.map((x) => (
                  <tr key={x.区分}>
                    <td>{x.区分}</td>
                    {(["社名", "店舗", "住所", "TEL", "FAX"] as const).map((k) => (
                      <td key={k}>
                        <input defaultValue={x[k]} onBlur={(e) => { if (e.target.value !== x[k]) { x[k] = e.target.value; 差出人を保存(x); } }} />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
            <table className="ws-grid sd-grid">
              <thead>
                <tr><th>そのほかの文言</th><th>内容</th></tr>
              </thead>
              <tbody>
                {設定.map((x) => (
                  <tr key={x.名前}>
                    <td>{x.名前}</td>
                    <td>
                      <input defaultValue={x.値} onBlur={(e) => { if (e.target.value !== x.値) { x.値 = e.target.value; api.post("/api/ws/settei", x).catch(エラー); } }} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="sd-note">丸北北海道：名義が丸北北海道のとき。丸北：ユーザー納入分。ふらの：名義がふらのとき（FAX は入庫依頼書の送り先の案内に使う）。大阪丸北：名義・扱いが大阪丸北のとき。輸送依頼書の連絡先：注意書きの「至急○○まで連絡してください」に入る名前。</p>
          </div>
        </div>
      )}
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
