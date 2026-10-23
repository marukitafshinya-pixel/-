import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { api, ApiError, num, 処理中 } from "../api";
import { Field, today } from "../formParts";
import { ZaikoSentaku } from "./WsZaikoSelect";

type Rec = Record<string, any>;
const エラー = (e: unknown) => alert(e instanceof ApiError ? e.message : String(e));
const 足す = (d: string, k: number) => new Date(Date.parse(d + "T00:00:00Z") + k * 86400000).toISOString().slice(0, 10);
const 曜 = (d: string) => "日月火水木金土"[new Date(d + "T00:00:00").getDay()];
const 和の日 = (d: string) => `${d.slice(0, 4)}年${Number(d.slice(5, 7))}月${Number(d.slice(8, 10))}日(${曜(d)})`;
const 日付に = (v: string) => (v ? v.replace(/\//g, "-") : "");
const n = (v: unknown) => Number(v ?? 0) || 0;
const 時刻 = (v: string | null | undefined) => (v ? (v.includes(" ") ? v.split(" ")[1].slice(0, 5) : v) : "");

/**
 * 出庫入力（Access の FS_配車選択 と FM_出荷明細票・FS_出荷明細）。
 * 出荷日ごとの便（出庫場所＝冷蔵庫・出庫No・運送会社）を選び、明細（出荷元・商品・ケース・届け先など）を入れる。
 * ［追加］で出庫場所を選ぶと、出庫No（その日・その出庫場所の最大＋1）を振った新しい便を作る。
 * ［完了］はこの便の出庫だけを在庫に登録する（前日締めと同じ処理）。登録済みの明細は直せない。
 */
export function SokoShukko() {
  const nav = useNavigate();
  const [sp, setSp] = useSearchParams();
  const [date, setDate] = useState(sp.get("date") ?? today());
  const [bins, setBins] = useState<Rec[]>([]);
  const [id, setId] = useState<number | null>(sp.get("id") ? Number(sp.get("id")) : null);
  const [data, setData] = useState<{ 便: Rec; rows: Rec[]; 通知: number } | null>(null);
  const [ch, setCh] = useState<Record<string, { id: number; name: string }[]>>({});
  const [追加, set追加] = useState<number | "">("");
  const [在庫選択, set在庫選択] = useState<Rec | null>(null);
  const [履歴, set履歴] = useState<Rec[] | null>(null);
  const [不足, set不足] = useState<Rec[] | null>(null);
  const [検索商品, set検索商品] = useState<string>("");
  const [検索倉庫, set検索倉庫] = useState<string>("");
  const [希望, set希望] = useState<{ mode: "zaiko" | "soko"; rows: Rec[]; 選べる: boolean; 商品: number; 倉庫: number } | null>(null);

  useEffect(() => {
    api.get<Record<string, { id: number; name: string }[]>>("/api/soko/shukko/choices").then(setCh).catch(エラー);
  }, []);
  const 便を読む = async (d = date, 選ぶ?: number | null) => {
    const r = await api.get<Rec[]>("/api/soko/shukko/day", { date: d });
    setBins(r);
    const next = 選ぶ && r.some((b) => b.輸送ID === 選ぶ) ? 選ぶ : r[0]?.輸送ID ?? null;
    setId(next);
    setSp({ date: d, ...(next ? { id: String(next) } : {}) }, { replace: true });
  };
  useEffect(() => {
    便を読む(date, id).catch(エラー);
  }, [date]);
  const 読む = () => (id ? api.get<{ 便: Rec; rows: Rec[]; 通知: number }>(`/api/soko/shukko/bin/${id}`).then(setData).catch(エラー) : Promise.resolve(setData(null)));
  useEffect(() => {
    読む();
    if (id) setSp({ date, id: String(id) }, { replace: true });
  }, [id]);

  async function 便を直す(項目: string, 値: unknown) {
    if (!id) return;
    try {
      await api.post("/api/soko/shukko/bin/save", { 輸送ID: id, 項目, 値 });
    } catch (e) {
      エラー(e);
    }
    読む();
    便を読む(date, id);
  }
  async function 明細を直す(r: Rec, 項目: string, 値: unknown) {
    try {
      await api.post("/api/soko/shukko/meisai/save", { 出庫ID: r.出庫ID, 項目, 値 });
      // 商品コードを入れたら、その出荷元（冷蔵庫）の在庫から選ぶ（Access の CC_在庫商品日付参照）
      if (項目 === "商品コード" && 値 != null) set在庫選択({ 出庫ID: r.出庫ID, 商品コード: 値, 倉庫ID: r.倉庫ID ?? 0 });
    } catch (e) {
      エラー(e);
    }
    読む();
  }
  /** 出庫確認の印（出庫確認_AfterUpdate）：印を保存してから、ロット逆転を確かめる（C_届け先賞味期限ロット逆転防止） */
  async function 出庫確認(r: Rec, on: boolean) {
    try {
      await api.post("/api/soko/shukko/meisai/save", { 出庫ID: r.出庫ID, 項目: "出庫確認", 値: on });
      const L = await api.get<Rec>(`/api/soko/shukko/lot/${r.出庫ID}`);
      if (L.特別) alert(`${L.届け先 ?? ""}\n${L.商品名 ?? ""}\n以上の条件は、運賃を登録後、品管に報告してください`);
      let 逆転 = false;
      let 理由: string | undefined;
      let 先に印 = false;
      const 履歴を出す = async (前: string) => set履歴(await api.get<Rec[]>("/api/soko/shukko/lot-history", { 出庫ID: String(r.出庫ID), 前 }));
      if (L.賞味期限 && !L.納品日) {
        alert("納品日が入力されてないので比較できません、前回ロットを表示します");
        await 履歴を出す(足す(today(), 10));
      } else if (L.賞味期限 && L.前回) {
        if (L.賞味期限 < L.前回) {
          const s = (d: string) => d.replace(/-/g, "/");
          if (
            confirm(`ロット逆転！！！！\n選択された賞味期限は前回より古いものです！\n\n前回賞味期限 ${s(L.前回)}\n\n今回賞味期限 ${s(L.賞味期限)}\nロットが逆転しますがよろしいですか！？`) &&
            confirm("ロットが逆転しますが、本当によろしいですね？！")
          ) {
            理由 = prompt("ロット逆転許可の理由を登録してください") ?? "";
            if (!理由) {
              alert("ロット逆転許可の理由が入力されていません\n訂正して下さい");
              逆転 = true;
            }
          } else 逆転 = true;
        } else if (L.次回 && L.次回 < L.賞味期限) {
          if (confirm("先の納品日にロット逆転が発生しますが、よろしいですか？")) {
            先に印 = true;
            alert(`${L.納品日.replace(/-/g, "/")} 以降の納品にロット逆転が発生していますので確認お願いします。`);
          }
        }
      }
      await api.post("/api/soko/shukko/lot/result", { 出庫ID: r.出庫ID, 逆転, 理由: 理由 || undefined, 先に印 });
      if (逆転) {
        alert("ロットを訂正してください");
        if (L.納品日) await 履歴を出す(L.納品日);
      }
    } catch (e) {
      エラー(e);
    }
    読む();
  }
  /** ［検索］（その冷蔵庫の在庫）・［倉庫表示］（全部の冷蔵庫の在庫）：C_架空製造日別出荷データ表示Ver2 */
  async function 在庫を見る(mode: "zaiko" | "soko") {
    if (!p) return;
    const 商品 = Number(検索商品) || 0;
    const 倉庫 = mode === "soko" ? Number(検索倉庫) || 0 : Number(検索倉庫) || n(p.出庫場所ID);
    try {
      const rows = await 処理中(() => api.get<Rec[]>("/api/soko/kibou", { shohin: String(商品), soko: String(倉庫), mode }));
      const kg = rows.reduce((a, r) => a + Number(r.在庫kg ?? 0), 0);
      if (!confirm(`合計${rows.length}件\n重量 ${num(kg)} kgまでを表示します`)) return;
      // 検索で出庫場所と違う冷蔵庫を選んだときは見るだけ（読み込めない）
      set希望({ mode, rows: rows.map((r) => ({ ...r, 抽出区分: false })), 選べる: mode === "soko" || 倉庫 === n(p.出庫場所ID), 商品, 倉庫 });
    } catch (e) {
      エラー(e);
    }
  }
  async function 希望を読み込む() {
    if (!希望 || !id) return;
    const 選んだ = 希望.rows.filter((r) => r.抽出区分).map((r) => String(r.認識ID));
    set希望(null);
    if (!選んだ.length) return;
    try {
      const r = await api.post<Rec>("/api/soko/kibou/add", { 輸送ID: id, shohin: 希望.商品, soko: 希望.倉庫, mode: 希望.mode, 選んだ });
      alert(`${r.件数} 件を明細に入れました。`);
    } catch (e) {
      エラー(e);
    }
    読む();
  }
  async function 出荷止め(r: Rec, 止め: boolean, 備考: string | null) {
    try {
      await api.post("/api/soko/kibou/tome", { 在庫ID: Number(r.認識ID), 出荷止め区分: 止め, 管理備考: 備考 });
      set希望((h) => h && { ...h, rows: h.rows.map((x) => (x.認識ID === r.認識ID ? { ...x, 出荷止め区分: 止め, 管理備考: 備考, 抽出区分: 止め ? false : x.抽出区分 } : x)) });
    } catch (e) {
      エラー(e);
    }
  }
  function 抽出(r: Rec) {
    if (r.出荷止め区分) return alert("出荷止めが設定されている為、抽出できません。");
    if (!r.抽出区分 && 希望?.mode === "soko" && r.入庫日 && date < r.入庫日 && !confirm("包装日が出荷日より先ですがよろしいですか？")) return;
    set希望((h) => h && { ...h, rows: h.rows.map((x) => (x.認識ID === r.認識ID ? { ...x, 抽出区分: !x.抽出区分 } : x)) });
  }

  async function 在庫不足() {
    try {
      const r = await 処理中(() => api.post<Rec[]>("/api/soko/shukko/fusoku", {}));
      if (!r.length) alert("在庫不足のレコードはありません");
      else set不足(r);
    } catch (e) {
      エラー(e);
    }
    読む();
  }

  async function 便を足す() {
    if (!追加) return alert("出庫場所を選んでください");
    try {
      const r = await api.post<{ 輸送ID: number }>("/api/soko/shukko/bin/new", { date, 出庫場所ID: 追加 });
      set追加("");
      await 便を読む(date, r.輸送ID);
    } catch (e) {
      エラー(e);
    }
  }
  async function 明細を足す() {
    if (!id) return;
    try {
      await api.post("/api/soko/shukko/meisai/new", { 輸送ID: id });
    } catch (e) {
      エラー(e);
    }
    読む();
  }
  async function 明細を消す(r: Rec) {
    if (!confirm("このデータを削除しますか？")) return;
    try {
      await api.post("/api/soko/shukko/meisai/delete", { 出庫ID: r.出庫ID });
    } catch (e) {
      エラー(e);
    }
    読む();
  }
  async function 完了() {
    if (!data) return;
    if (!confirm(`${data.便.運送会社名 ?? ""} のバッチ更新を行いますか？`)) return;
    try {
      const r = await 処理中(() => api.post<Rec>("/api/soko/shukko/bin/kanryo", { 輸送ID: id }));
      alert(`${r.件数} 件の出庫を在庫に登録しました。`);
    } catch (e) {
      エラー(e);
    }
    読む();
    便を読む(date, id);
  }
  async function 便を消す() {
    if (!data) return;
    if (!confirm(`${data.便.集荷日?.replace(/-/g, "/") ?? ""} ${data.便.運送会社名 ?? ""} のレコードを削除しますか？`)) return;
    const pass = prompt("パスワードを入力してください。");
    if (pass === null) return;
    try {
      await api.post("/api/soko/shukko/bin/delete", { 輸送ID: id, 合言葉: pass });
      await 便を読む(date, null);
    } catch (e) {
      エラー(e);
    }
  }

  const p = data?.便;
  const 済 = p?.chk === true;
  const 選ぶ = (key: string, label: string) => (
    <label className="sko-f">
      <span>{label}</span>
      <select value={p?.[key] ?? ""} disabled={!p} onChange={(e) => 便を直す(key, e.target.value === "" ? null : Number(e.target.value))}>
        <option value="" />
        {p?.[key] != null && !(ch[key] ?? []).some((o) => o.id === p[key]) && <option value={p[key]}>{key === "出庫場所ID" ? `${p[key]}　${p.出庫場所 ?? ""}` : p[key]}</option>}
        {(ch[key] ?? []).map((o) => <option key={o.id} value={o.id}>{key === "出庫場所ID" ? `${o.id}　${o.name}` : o.name}</option>)}
      </select>
    </label>
  );
  const 文字 = (key: string, label: string, cls = "") => (
    <label className="sko-f">
      <span>{label}</span>
      <Field value={p?.[key]} className={cls} readOnly={!p} onCommit={(v) => 便を直す(key, v)} />
    </label>
  );
  const 運送 = (key: string, nameKey: string, label: string) => (
    <label className="sko-f">
      <span>{label}</span>
      <Field value={p?.[key]} kind="num" className="sko-code" kyotsu="unso" readOnly={!p} onCommit={(v) => 便を直す(key, v.trim() === "" ? null : Number(v))} />
      <b className="sko-name">{p?.[nameKey]}</b>
    </label>
  );
  const 合計 = (data?.rows ?? []).reduce((a, r) => ({ ケース: a.ケース + Number(r.ケース ?? 0), kg: a.kg + Number(r.商品kg ?? 0) }), { ケース: 0, kg: 0 });

  return (
    <div className="sko">
      <div className="sko-top">
        <div className="sko-title">出庫入力</div>
        <button onClick={async () => setDate((await api.get<Rec>("/api/soko/shukko/ends")).最初)}>|◀</button>
        <button onClick={() => setDate(足す(date, -1))}>◀</button>
        <Field kind="date" value={date} className="sko-date" onCommit={(v) => v && setDate(日付に(v))} />
        <button onClick={() => setDate(足す(date, 1))}>▶</button>
        <button onClick={async () => setDate((await api.get<Rec>("/api/soko/shukko/ends")).最後)}>▶|</button>
        <span className="sko-wa">{和の日(date)}</span>
        {data && data.通知 > 0 && <span className="sko-notice" title="計画変更の印が付いた出庫があります">通知 {data.通知}</span>}
        <span className="sko-sp" />
        <button onClick={() => nav("/soko")}>閉じる</button>
      </div>
      <div className="sko-body">
        <div className="sko-bins">
          <div className="sko-bins-h">この日の便（{bins.length}）</div>
          {bins.map((b) => (
            <button key={b.輸送ID} className={"sko-bin" + (b.輸送ID === id ? " on" : "") + (b.chk ? " done" : "")} onClick={() => setId(b.輸送ID)}>
              <div><b>{b.出庫場所 ?? "（出庫場所なし）"}</b> No.{b.出庫No ?? ""}</div>
              <div className="small">{b.運送会社名 ?? "（運送会社なし）"}</div>
              <div className="small">{b.明細数} 行・{num(b.ケース計)} ケース{b.chk ? "・登録済" : ""}</div>
            </button>
          ))}
          <div className="sko-add">
            <select value={追加} onChange={(e) => set追加(e.target.value === "" ? "" : Number(e.target.value))}>
              <option value="">出庫場所を選ぶ</option>
              {(ch.出庫場所 ?? []).map((o) => <option key={o.id} value={o.id}>{o.id}　{o.name}</option>)}
            </select>
            <button className="blue" onClick={便を足す}>追加</button>
          </div>
        </div>
        <div className="sko-main">
          {!p ? (
            <p className="sko-empty">この出荷日の便はありません。左の［追加］で出庫場所を選ぶと作れます。</p>
          ) : (
            <>
              <div className="sko-head">
                <div className="sko-row">
                  {選ぶ("出庫場所ID", "出庫場所")}
                  <label className="sko-f"><span>出庫No</span><Field value={p.出庫No} kind="num" className="sko-code" onCommit={(v) => 便を直す("出庫No", v.trim() === "" ? null : Number(v))} /></label>
                  {運送("手配運送会社コード", "手配運送会社名", "手配")}
                  {運送("帳合運送会社コード", "帳合運送会社名", "帳合")}
                  {運送("運送会社ID", "運送会社名", "輸送")}
                  <span className={"sko-state" + (済 ? " done" : "")}>{済 ? "登録済" : "未登録"}</span>
                </div>
                <div className="sko-row">
                  {文字("車番", "車番", "w8")}
                  {文字("乗務員", "乗務員", "w8")}
                  {文字("携帯番号", "携帯", "w10")}
                  {文字("担当者", "担当者", "w8")}
                  {文字("運行指令No", "受付番号", "w10")}
                  <label className="sko-f"><span>セット温度</span><Field value={p.セット温度} kind="num" className="sko-code" onCommit={(v) => 便を直す("セット温度", v.trim() === "" ? null : Number(v))} /></label>
                </div>
                <div className="sko-row">
                  <label className="sko-f"><span>集荷日</span><Field kind="date" value={p.集荷日} className="w10" onCommit={(v) => 便を直す("集荷日", 日付に(v) || null)} /></label>
                  <label className="sko-f"><span>集荷時間</span><Field value={時刻(p.集荷時間)} className="w5" onCommit={(v) => 便を直す("集荷時間", v || null)} /></label>
                  <label className="sko-f"><span>引取日</span><Field kind="date" value={p.引取日} className="w10" onCommit={(v) => 便を直す("引取日", 日付に(v) || null)} /></label>
                  <label className="sko-f"><span>引取時間</span><Field value={時刻(p.引取時間)} className="w5" onCommit={(v) => 便を直す("引取時間", v || null)} /></label>
                  {選ぶ("冷凍区分ID", "冷凍")}
                  {選ぶ("運賃区分ID", "輸送区分")}
                  {選ぶ("輸送区分ID", "輸送")}
                  {選ぶ("配達区分ID", "配達")}
                  {選ぶ("車両区分ID", "車両")}
                  {選ぶ("運賃計算区分", "運賃区分")}
                </div>
                <div className="sko-row">
                  {文字("集荷時備考", "集荷時備考", "w30")}
                  {文字("引取備考", "引取備考", "w30")}
                  {文字("納品日コメント", "納品日コメント", "w20")}
                </div>
                <div className="sko-row sko-btns">
                  <button className="navy" onClick={完了} title="この便の出庫だけを在庫に登録します（バッチ更新）">完了</button>
                  <button className="red" onClick={便を消す} title="この便と明細を消します（パスワードが要ります）">削除</button>
                  <span className="sko-sp" />
                  <button onClick={在庫不足} title="まだ登録していない出庫を在庫と比べ、在庫不足のものを出します">在庫不足チェック</button>
                  <button onClick={() => nav(`/soko/juchu?id=${id}`)} title="受注を探して、この便に割り付けます（受注検索）">受注表示</button>
                  <button disabled title="準備中">受注読込</button>
                  <label className="sko-f"><span>商品</span><Field value={検索商品} kind="num" className="sko-code" kyotsu="shohin" onCommit={set検索商品} /></label>
                  <label className="sko-f"><span>倉庫</span><Field value={検索倉庫} kind="num" className="sko-code" kyotsu="tokui" onCommit={set検索倉庫} /></label>
                  <button onClick={() => 在庫を見る("zaiko")} title="出庫場所（または倉庫）の在庫を見て、選んだものを明細に入れます">検索</button>
                  <button onClick={() => 在庫を見る("soko")} title="商品の在庫を冷蔵庫ごとに見ます">倉庫表示</button>
                  <button disabled title="準備中">出庫依頼書</button>
                  <button disabled title="準備中">輸送依頼書</button>
                  <button disabled title="準備中">送品案内書</button>
                  <button disabled title="準備中">印刷</button>
                </div>
              </div>
              <div className="sko-gridwrap">
                <table className="ws-grid sko-grid">
                  <thead>
                    <tr>
                      <th>通知</th><th>順</th><th>出荷元</th><th>コード</th><th>商品名</th><th>規格</th><th>C/S</th><th>kg</th><th>製造日</th><th>賞味期限</th><th>納品日</th>
                      <th>届け先</th><th>名義</th><th>備考</th><th title="出庫確認（ロット逆転を確かめる）">確認</th><th title="冷蔵庫から出庫済みの報告があったもの">出庫済</th><th>登録</th><th />
                    </tr>
                  </thead>
                  <tbody>
                    {data!.rows.map((r) => {
                      const ro = r.chk === true;
                      return (
                        <tr key={r.出庫ID} className={ro ? "done" : ""}>
                          <td className="notice"><div className="y">{r.通知}</div><div className="r">{r.変更通知}</div></td>
                          <td><Field value={r.商品積込順} kind="num" className="w3" readOnly={ro} onCommit={(v) => 明細を直す(r, "商品積込順", v.trim() === "" ? null : Number(v))} /></td>
                          <td><Field value={r.倉庫ID} kind="num" className="sko-code" kyotsu="tokui" readOnly={ro} onCommit={(v) => 明細を直す(r, "倉庫ID", v.trim() === "" ? null : Number(v))} /><div className="small">{r.倉庫名}</div></td>
                          <td><Field value={r.商品コード} kind="num" className="sko-code" kyotsu="shohin" readOnly={ro} onCommit={(v) => 明細を直す(r, "商品コード", v.trim() === "" ? null : Number(v))} /></td>
                          <td className="bold">{r.商品名}</td>
                          <td>{r.規格}</td>
                          <td><Field value={r.ケース} kind="num" className="w4" readOnly={ro} onCommit={(v) => 明細を直す(r, "ケース", v.trim() === "" ? null : Number(v))} /></td>
                          <td className="r">{num(r.商品kg)}</td>
                          <td><Field kind="date" value={r.製造日} className="w8" readOnly={ro} onCommit={(v) => 明細を直す(r, "製造日", 日付に(v) || null)} /></td>
                          <td><Field kind="date" value={r.賞味期限} className="w8" readOnly={ro} onCommit={(v) => 明細を直す(r, "賞味期限", 日付に(v) || null)} /></td>
                          <td><Field kind="date" value={r.納品日} className="w8" readOnly={ro} onCommit={(v) => 明細を直す(r, "納品日", 日付に(v) || null)} /></td>
                          <td><Field value={r.届け先コード} kind="num" className="sko-code" kyotsu="tokui" readOnly={ro} onCommit={(v) => 明細を直す(r, "届け先コード", v.trim() === "" ? null : Number(v))} /><div className="small">{r.届け先}</div></td>
                          <td className="r">{r.入庫後名義ID || ""}</td>
                          <td><Field value={r.備考} className="w12" readOnly={ro} onCommit={(v) => 明細を直す(r, "備考", v)} /></td>
                          <td className="c"><input type="checkbox" checked={!!r.出庫確認} onChange={(e) => 出庫確認(r, e.target.checked)} /></td>
                          <td className="c"><input type="checkbox" checked={!!r.出庫済み} onChange={(e) => 明細を直す(r, "出庫済み", e.target.checked)} /></td>
                          <td className="c">{ro ? "済" : ""}</td>
                          <td>{!ro && <button className="small" onClick={() => 明細を消す(r)}>削除</button>}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                <div className="sko-foot">
                  <button className="small blue" onClick={明細を足す}>明細を足す</button>
                  <span>件数 {data!.rows.length}件</span>
                  <span>C/S計 {num(合計.ケース)}</span>
                  <span>kg計 {num(合計.kg)}</span>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
      {履歴 && (
        <div className="modal" onClick={() => set履歴(null)}>
          <div className="sko-dlg" onClick={(e) => e.stopPropagation()}>
            <div className="sko-dlg-h">前回出荷ロット履歴<button onClick={() => set履歴(null)}>閉じる</button></div>
            <table className="ws-grid">
              <thead><tr><th>出荷日</th><th>運送会社</th><th>コード</th><th>商品名</th><th>製造日</th><th>賞味期限</th><th>届け先</th><th>納品日</th><th>変更通知</th></tr></thead>
              <tbody>
                {履歴.length === 0 && <tr><td colSpan={9} className="c">前回の出荷はありません</td></tr>}
                {履歴.map((h) => (
                  <tr key={h.出庫ID}><td>{h.出荷日}</td><td>{h.運送会社名}</td><td className="r">{h.商品コード}</td><td>{h.商品名}</td><td>{h.製造日}</td><td className="b">{h.賞味期限}</td><td>{h.届け先}</td><td>{h.納品日}</td><td className="red">{h.変更通知}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
      {希望 && (
        <div className="modal">
          <div className="sko-dlg">
            <div className="sko-dlg-h">
              {希望.mode === "soko" ? "希望倉庫表示" : "希望在庫表示"}
              <span>
                {希望.選べる && <button className="blue" onClick={希望を読み込む}>OK（選んだものを明細に入れる）</button>}
                <button onClick={() => set希望(null)}>キャンセル</button>
              </span>
            </div>
            {!希望.選べる && <div className="red sko-pad">出庫画面と違う倉庫のため、見るだけで読み込めません。</div>}
            <table className="ws-grid">
              <thead>
                <tr>{希望.選べる && <th>抽出</th>}<th>倉庫</th><th>入庫日</th><th>コード</th><th>商品名</th><th>製造日</th><th>賞味期限</th><th>区分</th><th>入庫No</th><th>元数</th><th>C/S</th><th>Kg</th><th>名義</th><th>出荷止め</th><th>管理備考</th><th>備考</th></tr>
              </thead>
              <tbody>
                {希望.rows.length === 0 && <tr><td colSpan={16} className="c">在庫はありません</td></tr>}
                {希望.rows.map((r) => (
                  <tr key={r.認識ID} className={r.抽出区分 ? "sel" : ""}>
                    {希望.選べる && <td className="c"><input type="checkbox" checked={!!r.抽出区分} onChange={() => 抽出(r)} /></td>}
                    <td>{r.倉庫名}</td><td>{r.入庫日}</td><td className="r">{r.商品コード}</td><td className="b">{r.商品名}</td><td>{r.製造日}</td>
                    <td>{r.賞味期限}{r.賞味期限通知 && <div className="red small">{r.賞味期限通知}</div>}</td><td className="c">{r.タグ}</td><td>{r.入庫No}</td>
                    <td className="r">{num(r.入庫元数)}</td><td className={"r" + (r.在庫ケース < 0 ? " red" : "")}>{num(r.在庫ケース)}</td><td className="r">{num(r.在庫kg)}</td><td>{r.入庫名義}</td>
                    <td className="c"><input type="checkbox" checked={!!r.出荷止め区分} onChange={(e) => 出荷止め(r, e.target.checked, r.管理備考 ?? null)} /></td>
                    <td><Field value={r.管理備考} className="w12" onCommit={(v) => 出荷止め(r, !!r.出荷止め区分, v || null)} /></td>
                    <td className="small pre">{r.備考在庫}{r.通知 && <div className="red">{r.通知}</div>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
      {不足 && (
        <div className="modal" onClick={() => set不足(null)}>
          <div className="sko-dlg" onClick={(e) => e.stopPropagation()}>
            <div className="sko-dlg-h">在庫不足表示<button onClick={() => set不足(null)}>閉じる</button></div>
            <table className="ws-grid">
              <thead><tr><th>出荷日</th><th>出荷元</th><th>コード</th><th>商品名</th><th>C/S</th><th>残数</th><th>製造日</th><th>賞味期限</th><th>届け先</th><th /></tr></thead>
              <tbody>
                {不足.map((h) => (
                  <tr key={h.出庫ID}>
                    <td>{h.出荷計画日 ?? h.出荷日}</td><td>{h.倉庫名}</td><td className="r">{h.商品コード}</td><td>{h.商品名}</td><td className="r">{num(h.ケース)}</td>
                    <td className="r red">{num(h.残数)}</td><td>{h.製造日}</td><td>{h.賞味期限}</td><td>{h.届け先}</td>
                    <td><button className="small" onClick={() => { set不足(null); if (h.出荷計画日) { setDate(h.出荷計画日); setId(h.輸送ID); } }}>移る</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
      {在庫選択 && (
        <ZaikoSentaku
          基="/api/soko/zaiko"
          出庫ID={在庫選択.出庫ID}
          商品コード={Number(在庫選択.商品コード)}
          倉庫ID={Number(在庫選択.倉庫ID)}
          onDone={() => {
            set在庫選択(null);
            読む();
          }}
        />
      )}
    </div>
  );
}
