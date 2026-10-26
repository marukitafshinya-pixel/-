import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api, ApiError, num } from "../api";
import { Field, today } from "../formParts";

type Rec = Record<string, any>;
const エラー = (e: unknown) => alert(e instanceof ApiError ? e.message : String(e));
const 日を足す = (d: string, k: number) => new Date(Date.parse(d + "T00:00:00Z") + k * 86400000).toISOString().slice(0, 10);
const 曜日 = ["日", "月", "火", "水", "木", "金", "土"];
/** 10月24日(土) の形（Access の Format(日, "mm月dd日(aaa)")） */
const 月日 = (d: string) => `${d.slice(5, 7)}月${d.slice(8, 10)}日(${曜日[new Date(d + "T00:00:00Z").getUTCDay()]})`;

/**
 * 名義変更（Access の FM_名義変更）。変更日ごと（冷蔵庫を選べばその冷蔵庫だけ）の名変を一覧にして直す。
 * ［検索］で冷蔵庫・商品の在庫から名変を作り、［登録］でその日までの名変を在庫に反映する。［訂正］［全訂正］で元に戻す。
 */
export function SokoMeihen() {
  const nav = useNavigate();
  const [日, set日] = useState(today());
  const [倉庫一覧, set倉庫一覧] = useState<Rec[]>([]);
  const [倉庫, set倉庫] = useState(0);
  const [名義, set名義] = useState<Rec[]>([]);
  const [rows, setRows] = useState<Rec[]>([]);
  const [選んだ, set選んだ] = useState<number | null>(null);
  const [抽出倉庫, set抽出倉庫] = useState<number | null>(null);
  const [商品, set商品] = useState<number | null>(null);
  const [検索, set検索] = useState<{ rows: Rec[]; 印: Set<string> } | null>(null);
  const [通知, set通知] = useState<{ 中身: Rec; 差出人: Rec } | null>(null);

  useEffect(() => {
    api.get<Rec[]>("/api/soko/meihen/soko").then(set倉庫一覧).catch(エラー);
  }, []);
  const 読む = () =>
    api
      .get<Rec[]>("/api/soko/meihen", { date: 日, ...(倉庫 ? { soko: String(倉庫) } : {}) })
      .then(setRows)
      .catch(エラー);
  useEffect(() => {
    読む();
    set選んだ(null);
  }, [日, 倉庫]);
  useEffect(() => {
    // 冷蔵庫を選ぶと、検索の冷蔵庫もその冷蔵庫にし、変更後名義の選択肢をその冷蔵庫の名変に出てくる名義にする
    set抽出倉庫(倉庫 || null);
    if (倉庫) api.get<Rec[]>("/api/soko/meihen/meigi", { soko: String(倉庫) }).then(set名義).catch(エラー);
    else set名義([]);
  }, [倉庫]);

  async function 直す(r: Rec, 項目: string, 値: unknown, 連動?: boolean) {
    try {
      await api.post("/api/soko/meihen/save", { 変更No: r.変更No, 項目, 値, 変更日: 日, 連動 });
    } catch (e) {
      エラー(e);
    }
    読む();
  }
  async function 端(which: "最初" | "最後") {
    const e = await api.get<Rec>("/api/soko/meihen/ends").catch(エラー);
    if (e?.[which]) set日(e[which]);
  }
  async function 検索する() {
    if (!抽出倉庫 && !商品) return alert("条件が指定されていません");
    try {
      const r = await api.get<Rec[]>("/api/soko/meihen/zaiko", { ...(抽出倉庫 ? { soko: String(抽出倉庫) } : {}), ...(商品 ? { shohin: String(商品) } : {}) });
      set検索({ rows: r, 印: new Set() });
    } catch (e) {
      エラー(e);
    }
  }
  async function 追加() {
    if (!検索) return;
    try {
      await api.post("/api/soko/meihen/add", { 変更日: 日, soko: 抽出倉庫 ?? 0, shohin: 商品 ?? 0, 選んだ: [...検索.印] });
    } catch (e) {
      エラー(e);
    }
    set検索(null);
    読む();
  }
  async function 登録() {
    if (!confirm(`${月日(日)}迄の変更を行いますがよろしいですか？`)) return;
    try {
      await api.post("/api/soko/meihen/register", { 変更日: 日 });
      alert(`${月日(日)}迄の登録を完了しました`);
    } catch (e) {
      エラー(e);
    }
    読む();
  }
  async function 訂正() {
    const r = rows.find((x) => x.変更No === 選んだ);
    if (!r?.変更Check) return;
    if (!confirm(`${月日(日)}の選択したレコードを変更前に戻しますが宜しいですか？`)) return;
    await api.post("/api/soko/meihen/return", { 変更No: r.変更No }).catch(エラー);
    読む();
  }
  async function 全訂正() {
    if (!rows.length) return;
    if (!confirm(`${日.replace(/-/g, "/")} の名義変更を元に戻しますか？`)) return;
    try {
      await api.post("/api/soko/meihen/return-all", { 変更No: rows.map((r) => r.変更No) });
      alert(`${月日(日)}元に戻しました。`);
    } catch (e) {
      エラー(e);
    }
    読む();
  }
  async function 削除() {
    const r = rows.find((x) => x.変更No === 選んだ);
    if (!r) return;
    if (r.変更Check) return alert("変更済みの為、削除出来ません。");
    if (!confirm("選んだ名変を削除します。よろしいですか？")) return;
    await api.post("/api/soko/meihen/delete", { 変更No: r.変更No }).catch(エラー);
    set選んだ(null);
    読む();
  }
  // ［名変通知書印刷］（Access の cmd_名変通知書印刷。冷蔵庫を選んだときだけ。福山冷凍〈720〉用の帳票は見本がないため同じ形で出す）
  async function 通知書() {
    if (!倉庫) return alert("冷蔵庫が選択されていません");
    try {
      const [中身, list] = await Promise.all([api.get<Rec>("/api/soko/meihen/tsuchi", { date: 日, soko: String(倉庫) }), api.get<Rec[]>("/api/ws/sashidashi")]);
      if (!中身.組.length) return alert("この変更日・冷蔵庫の名義変更はありません。");
      set通知({ 中身, 差出人: list.find((x) => x.区分 === "丸北北海道") ?? {} });
    } catch (e) {
      エラー(e);
    }
  }
  const 合計 = rows.reduce((a, r) => [a[0] + Number(r.ケース ?? 0), a[1] + Number(r.商品kg ?? 0)], [0, 0]);

  if (通知) return <MeihenTsuchiPrint 中身={通知.中身} 差出人={通知.差出人} onClose={() => set通知(null)} />;
  return (
    <div className="sz sko">
      <div className="kk-head">
        <div className="kk-title">名義変更</div>
        <span>変更日</span>
        <button onClick={() => 端("最初")}>|◀</button>
        <button onClick={() => set日(日を足す(日, -1))}>◀</button>
        <Field kind="date" value={日} className="sko-date" onCommit={(v) => v && set日(v.replace(/\//g, "-"))} />
        <button onClick={() => set日(日を足す(日, 1))}>▶</button>
        <button onClick={() => 端("最後")}>▶|</button>
        <span>冷蔵庫</span>
        <select value={倉庫} onChange={(e) => set倉庫(Number(e.target.value))}>
          <option value={0}>（すべて）</option>
          {倉庫一覧.map((w) => (
            <option key={w.id} value={w.id}>{w.id} {w.name}</option>
          ))}
        </select>
        <button onClick={() => nav(-1)}>閉じる</button>
      </div>
      <div className="sko-top">
        <span>検索：冷蔵庫</span>
        <Field value={抽出倉庫} kind="num" kyotsu="tokui" className="w5" onCommit={(v) => set抽出倉庫(Number(v) || null)} />
        <span>商品</span>
        <Field value={商品} kind="num" kyotsu="shohin" className="w5" onCommit={(v) => set商品(Number(v) || null)} />
        <button onClick={検索する}>検索</button>
        <span className="sko-sp" />
        <button className="blue" onClick={登録}>登録</button>
        <button disabled={!rows.find((x) => x.変更No === 選んだ)?.変更Check} onClick={訂正}>訂正</button>
        <button disabled={!rows.length} onClick={全訂正}>全訂正</button>
        <button disabled={選んだ == null} onClick={削除}>削除</button>
        <button className="navy" onClick={通知書}>名変通知書印刷</button>
      </div>
      <datalist id="meihen-meigi">
        {名義.map((m) => (
          <option key={m.id} value={m.id}>{m.name}</option>
        ))}
      </datalist>
      <div className="sko-gridwrap">
        <table className="sz-grid sko-grid">
          <thead>
            <tr>
              <th>登録</th><th>冷蔵庫</th><th>入庫No</th><th>コード</th><th>商品名</th><th>規格</th><th>入数</th><th>ケース</th><th>kg</th><th>製造日</th><th>賞味期限</th>
              <th>変更前名義</th><th>変更後名義</th><th>譲渡人負担日</th><th>譲受人負担日</th><th>受注ID</th><th>取引元</th><th>期数</th><th>保管料</th><th>入出庫料</th><th>備考</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && <tr><td colSpan={21} className="c">この変更日の名義変更はありません</td></tr>}
            {rows.map((r) => (
              <tr key={r.変更No} className={(r.変更Check ? "done" : "") + (r.変更No === 選んだ ? " sel" : "")} onClick={() => set選んだ(r.変更No)}>
                <td className="c">{r.変更Check ? "済" : ""}</td>
                <td>{r.保管庫名}</td><td>{r.入庫No}</td><td className="r">{r.商品コード}</td><td className="name">{r.商品名}</td><td>{r.規格}</td><td className="r">{num(r.入数)}</td>
                <td><Field value={r.ケース} kind="num" className="w4" onCommit={(v) => 直す(r, "ケース", v)} /></td>
                <td className="r">{num(r.商品kg)}</td>
                <td><Field value={r.製造日} kind="date" className="w8" onCommit={(v) => 直す(r, "製造日", v.replace(/\//g, "-"))} /></td>
                <td><Field value={r.賞味期限} kind="date" className="w8" onCommit={(v) => 直す(r, "賞味期限", v.replace(/\//g, "-"))} /></td>
                <td>{r.変更前名義 ?? r.変更前名義ID}</td>
                <td>
                  <Field value={r.変更後名義ID} kind="num" kyotsu="tokui" list="meihen-meigi" className="w4" onCommit={(v) => 直す(r, "変更後名義ID", v)} />
                  <span className="small"> {r.変更後名義}</span>
                </td>
                <td>
                  <Field
                    value={r.譲渡人負担日}
                    kind="date"
                    className="w8"
                    onCommit={(v) => 直す(r, "譲渡人負担日", v.replace(/\//g, "-"), confirm("譲渡人負担日を変更します、よろしいですか？"))}
                  />
                </td>
                <td><Field value={r.譲受人負担日} kind="date" className="w8" onCommit={(v) => 直す(r, "譲受人負担日", v.replace(/\//g, "-"))} /></td>
                <td><Field value={r.受注ID} kind="num" className="w5" onCommit={(v) => 直す(r, "受注ID", v)} /></td>
                <td>{r.取引元}</td>
                <td className="r">{r.出荷期数}</td><td className="r">{num(r.保管料)}</td><td className="r">{num(r.入出庫料)}</td>
                <td><textarea className="w20" rows={2} defaultValue={r.備考 ?? ""} key={r.備考 ?? ""} onBlur={(e) => e.target.value !== (r.備考 ?? "") && 直す(r, "備考", e.target.value)} /></td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr><td colSpan={7}>合計</td><td className="r">{num(合計[0])}</td><td className="r">{num(合計[1])}</td><td colSpan={12} /></tr>
          </tfoot>
        </table>
      </div>
      {検索 && (
        <div className="modal">
          <div className="sko-dlg">
            <div className="sko-dlg-h">
              希望在庫表示
              <span>
                <button className="blue" disabled={!検索.印.size} onClick={追加}>OK（選んだ在庫を名変にする）</button>
                <button onClick={() => set検索(null)}>キャンセル</button>
              </span>
            </div>
            <table className="ws-grid">
              <thead>
                <tr><th>抽出</th><th>倉庫</th><th>入庫日</th><th>コード</th><th>商品名</th><th>製造日</th><th>賞味期限</th><th>区分</th><th>入庫No</th><th>元数</th><th>C/S</th><th>Kg</th><th>名義</th><th>通知</th></tr>
              </thead>
              <tbody>
                {検索.rows.length === 0 && <tr><td colSpan={14} className="c">在庫はありません</td></tr>}
                {検索.rows.map((r) => {
                  const on = 検索.印.has(r.認識ID);
                  return (
                    <tr key={r.認識ID} className={on ? "sel" : ""}>
                      <td className="c">
                        <input type="checkbox" checked={on} onChange={() => set検索((s) => { if (!s) return s; const x = new Set(s.印); on ? x.delete(r.認識ID) : x.add(r.認識ID); return { ...s, 印: x }; })} />
                      </td>
                      <td>{r.倉庫名}</td><td>{r.入庫日}</td><td className="r">{r.商品コード}</td><td className="b">{r.商品名}</td><td>{r.製造日}</td><td>{r.賞味期限}</td><td className="c">{r.タグ}</td>
                      <td>{r.入庫No}</td><td className="r">{num(r.入庫元数)}</td><td className={"r" + (r.在庫ケース < 0 ? " red" : "")}>{num(r.在庫ケース)}</td><td className="r">{num(r.在庫kg)}</td><td>{r.入庫名義}</td>
                      <td className="red">{r.通知}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

const 年月日 = (d: string) => `${d.slice(0, 4)}年${Number(d.slice(5, 7))}月${Number(d.slice(8, 10))}日`;
const 郵便 = (v: unknown) => {
  const x = String(v ?? "").replace(/[^0-9]/g, "");
  return x.length === 7 ? `〒${x.slice(0, 3)}-${x.slice(3)}` : v ? `〒${v}` : "";
};

/**
 * 冷蔵貨物寄託者名義変更通知書（Access の R_名義変更通知書_縦。いただいた見本の形）。譲渡人×譲受人ごとに 1 枚。
 * 左上に受注番号（mmdd-ユーザー伝票No-枝番2）、備考欄と No は印刷の前にここで入れる（Access のフォームの 印刷備考・No と同じ）。
 */
function MeihenTsuchiPrint(props: { 中身: Rec; 差出人: Rec; onClose: () => void }) {
  const { 中身: m, 差出人 } = props;
  const [備考, set備考] = useState("");
  const [番号, set番号] = useState("");
  return (
    <div className="hs-wrap">
      <div className="no-print hs-bar">
        <button onClick={() => window.print()}>印刷</button> <button onClick={props.onClose}>閉じる</button>
        <span>　No </span><input className="w5" value={番号} onChange={(e) => set番号(e.target.value)} />
        <span>　備考欄 </span><input className="w20" value={備考} onChange={(e) => set備考(e.target.value)} />
      </div>
      {m.組.map((rows: Rec[], i: number) => {
        const 先 = rows[0];
        const 計 = rows.reduce((a, r) => a + Number(r.ケース ?? 0), 0);
        return (
          <div key={i} className="mt-page">
            <div className="mt-top">
              <div className="mt-no">{m.受注番号.map((x: string) => <div key={x}>{x}</div>)}</div>
              <div className="mt-date">{番号 ? `No ${番号}　` : ""}{年月日(m.変更日)}</div>
            </div>
            <div className="mt-title">冷蔵貨物寄託者名義変更通知書</div>
            <div className="mt-to">{m.保管庫 ?? ""}　御中</div>
            <div className="mt-text">
              下記の通り当事者間に於いて貨物の譲渡をしましたので {年月日(m.変更日)} より当該を譲渡人の名義に変更して下さる様、冷蔵庫寄託約款に基き連署をもってご通知致します。
            </div>
            <table className="mt-who">
              <tbody>
                <tr>
                  <th rowSpan={2}>譲渡人</th><td className="k">住所</td><td>{郵便(先.譲渡人郵便番号)}　{先.譲渡人住所 ?? ""}</td>
                  <td rowSpan={2} className="mt-in"><div>担当者</div><div /></td>
                </tr>
                <tr><td className="k">氏名</td><td className="mt-name">{先.譲渡人名 ?? ""}</td></tr>
                <tr>
                  <th rowSpan={2}>譲受人</th><td className="k">住所</td><td>{郵便(先.譲受人郵便番号)}　{先.譲受人住所 ?? ""}</td>
                  <td rowSpan={2} className="mt-in"><div>担当者</div><div /></td>
                </tr>
                <tr><td className="k">氏名</td><td className="mt-name">{先.譲受人名 ?? ""}</td></tr>
              </tbody>
            </table>
            <div className="mt-futan">
              <span>譲渡人負担日　{年月日(m.譲渡人負担日)} まで</span>
              <span>譲受人負担日　{年月日(m.譲受人負担日)} より</span>
            </div>
            <table className="mt-t">
              <thead><tr><th>入庫No</th><th>商品ｺｰﾄﾞ</th><th>品名</th><th>規格</th><th>数量</th><th>重量</th><th>備考</th></tr></thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.変更No}>
                    <td className="c">{r.ユーザーコード}</td><td className="r">{r.商品コード}</td><td>{r.商品名}</td><td className="c">{r.規格}</td>
                    <td className="r">{num(r.ケース)}</td><td className="r">{num(r.商品kg)}</td>
                    <td>入庫元数{r.入庫元数 ?? ""}個　残 {r.在庫ケース ?? ""}</td>
                  </tr>
                ))}
                {Array.from({ length: Math.max(0, 12 - rows.length) }, (_, k) => <tr key={"e" + k}><td /><td /><td /><td /><td /><td /><td /></tr>)}
                <tr className="mt-sum"><td colSpan={4} className="c">合計</td><td className="r">{num(計)}</td><td /><td /></tr>
              </tbody>
            </table>
            <div className="mt-biko">{備考}</div>
            <div className="mt-from">
              <div>差出人　{差出人.社名 ?? ""} {差出人.店舗 ?? ""}</div>
              <div>FAX　{差出人.FAX ?? ""}</div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
