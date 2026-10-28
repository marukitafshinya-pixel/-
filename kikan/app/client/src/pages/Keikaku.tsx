import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { api, ApiError, num } from "../api";
import { Field, today, PageClose } from "../formParts";

type Rec = Record<string, any>;
const エラー = (e: unknown) => alert(e instanceof ApiError ? e.message : String(e));
const 曜日 = (d: string) => "日月火水木金土"[new Date(d + "T00:00:00").getDay()];
/** 10月26日(月) */
const 月日曜 = (d: string | null) => (d ? `${Number(d.slice(5, 7))}月${Number(d.slice(8, 10))}日(${曜日(d)})` : "");
const 日時 = (v: string | null) => (v ? v.slice(0, 19).replace(/-/g, "/") : "");

/**
 * 製造計画のメニュー（Access の 製造計画.accdb の FM_メインメニュー）。
 * 開いたときに、大阪の計画に新しい変更があれば知らせる。
 */
export function KeikakuMenu() {
  const nav = useNavigate();
  const [info, setInfo] = useState<Rec | null>(null);
  const [開始日, set開始日] = useState(today());
  const [終了日, set終了日] = useState("");
  const [結果, set結果] = useState<Rec | null>(null);

  useEffect(() => {
    api
      .get<Rec>("/api/keikaku/menu")
      .then((r) => {
        setInfo(r);
        set終了日(r.終了日 ?? "");
        if (r.新しい) alert("新しい生産計画変更があります、インポートしてください");
      })
      .catch(エラー);
  }, []);

  async function 取り込む() {
    const s = 開始日.replace(/\//g, "-");
    const e = 終了日.replace(/\//g, "-");
    if (!s || !e) return alert("開始日と終了日を入れてください");
    if (!confirm(`${s.replace(/-/g, "/")} ～ ${e.replace(/-/g, "/")} までの製造分を丸北生産計画からインポートします。よろしいですか？`)) return;
    try {
      const r = await api.post<Rec>("/api/keikaku/import", { 開始日: s, 終了日: e });
      set結果(r);
      for (const m of r.知らせ ?? []) alert(m);
      setInfo(await api.get<Rec>("/api/keikaku/menu"));
      nav("/keikaku/henko");
    } catch (err) {
      エラー(err);
    }
  }

  return (
    <div className="kkm">
      <div className="kkm-dates">
        <Field kind="date" value={開始日} className="kkm-date" onCommit={(v) => set開始日(v)} />
        <Field kind="date" value={終了日} className="kkm-date" onCommit={(v) => set終了日(v)} />
      </div>
      <div className="kkm-lbl">前回 計画変更日</div>
      <div className="kkm-v">{日時(info?.前回 ?? null)}</div>
      {結果 && (
        <div className="kk-done">
          取り込みました（新規 {結果.件数.新規} 件・製造変更 {結果.件数.製造変更} 件・kg変更 {結果.件数.kg変更} 件・包装日変更 {結果.件数.包装日変更} 件）
        </div>
      )}
      <button className="kkm-big" onClick={取り込む}>生産計画インポート</button>
      <button onClick={() => nav("/keikaku/henko")}>変更内容確認</button>
      <button onClick={() => nav("/keikaku/calendar")}>製造カレンダー確認</button>
      <button disabled title="準備中です">繁盛生産計画出力</button>
      <button className="kkm-log" onClick={() => nav("/keikaku/log")}>変更履歴表示</button>
      <PageClose onClick={() => nav("/")} />
    </div>
  );
}

/** 製造変更案内の日付（11月10日(火)。日は 2 けた） */
const 月日曜2 = (d: string | null) => (d ? `${Number(d.slice(5, 7))}月${d.slice(8, 10)}日(${曜日(d)})` : "");

function 変更の表({ rows, 題, 前 }: { rows: Rec[]; 題: string; 前?: boolean }) {
  const [選, set選] = useState(0);
  return (
    <div className={"kh-part" + (前 ? " mae" : "")}>
      <div className="kh-ttl">{題}</div>
      <div className="kh-scroll">
        <table className="kh-grid">
          <thead>
            <tr><th>製造日</th><th>工場</th><th>コード</th><th>商品名</th><th>ケース</th><th>商品kg</th><th>案内</th></tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i} className={!前 && i === 選 ? "on" : ""} onClick={() => set選(i)}>
                <td className="d">{月日曜2(r.製造日)}</td>
                <td>{r.作業場}</td>
                <td className="r">{r.商品コード}</td>
                <td className="n">{r.商品名}</td>
                <td className="r">{num(r.ケース)}</td>
                <td className="r">{num(r.商品kg)}</td>
                <td>{r.通知}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/** 変更内容確認（Access の F_製造変更案内）：左が変更後（新しい計画）、右が変更前（前回の計画）。いただいた画面と同じ並び */
export function KeikakuHenko() {
  const nav = useNavigate();
  const [d, setD] = useState<{ 新規: Rec[]; 前回: Rec[] } | null>(null);
  useEffect(() => {
    api.get<{ 新規: Rec[]; 前回: Rec[] }>("/api/keikaku/henko").then(setD).catch(エラー);
  }, []);
  return (
    <div className="kh">
      <div className="kh-bar">
        <b>製造変更案内</b>
        <PageClose fallback="/keikaku" />
      </div>
      {d && (
        <div className="kh-body">
          <変更の表 rows={d.新規} 題="変更後" />
          <変更の表 rows={d.前回} 題="変更前" 前 />
        </div>
      )}
    </div>
  );
}

/** 変更履歴表示（Access の R_計画変更ログ）。月ごとに区切る */
export function KeikakuLog() {
  const nav = useNavigate();
  const [rows, setRows] = useState<Rec[]>([]);
  useEffect(() => {
    api.get<Rec[]>("/api/keikaku/log").then(setRows).catch(エラー);
  }, []);
  const 月 = [...new Set(rows.map((r) => r.変更月))];
  return (
    <div className="kk">
      <div className="kk-head no-print">
        <div className="kk-title">計画変更ログ</div>
        <button onClick={() => window.print()}>印刷</button>
        <PageClose fallback="/keikaku" />
      </div>
      <h2 className="print-only">計画変更ログ</h2>
      <table className="kk-grid kk-log">
        <thead>
          <tr><th>変更日時</th><th>新規</th><th>製造変更</th><th>kg変更</th><th>包装日変更</th><th>合計</th><th>出荷変更</th></tr>
        </thead>
        {月.map((m) => {
          const rs = rows.filter((r) => r.変更月 === m);
          const 計 = (k: string) => rs.reduce((s, r) => s + Number(r[k] ?? 0), 0);
          return (
            <tbody key={m}>
              <tr className="kk-month"><td colSpan={7}>{m}</td></tr>
              {rs.map((r) => (
                <tr key={r.ID}>
                  <td>{日時(r.製造変更日)}</td>
                  <td className="r">{r.新規件数}</td><td className="r">{r.製造変更件数}</td><td className="r">{r.kg変更件数}</td>
                  <td className="r">{r.包装日変更件数}</td><td className="r">{r.合計件数}</td><td className="r">{r.出荷変更件数}</td>
                </tr>
              ))}
              <tr className="kk-sum">
                <td className="r">計</td>
                <td className="r">{計("新規件数")}</td><td className="r">{計("製造変更件数")}</td><td className="r">{計("kg変更件数")}</td>
                <td className="r">{計("包装日変更件数")}</td><td className="r">{計("合計件数")}</td><td className="r">{計("出荷変更件数")}</td>
              </tr>
            </tbody>
          );
        })}
      </table>
    </div>
  );
}

type 日 = { date: string; label: string; inMonth: boolean; holiday: string; color: string; underline: boolean };
const 工場 = [
  { id: 11, name: "北海道" },
  { id: 191, name: "ふらの" },
];

/**
 * 製造カレンダー（Access の FM_製造カレンダー）。大阪の生産計画を、工場ごとに月のカレンダーで見る。
 * 日をダブルクリックすると、その日の計画（FM_製造計画入力）を開く。
 * Access のドラッグで日を動かす機能は、呼び出す処理がファイルになく動かないため、作っていない。
 */
export function KeikakuCalendar() {
  const nav = useNavigate();
  const t = today();
  const [年, set年] = useState(Number(t.slice(0, 4)));
  const [月, set月] = useState(Number(t.slice(5, 7)));
  const [倉庫, set倉庫] = useState(11);
  const [days, setDays] = useState<日[]>([]);
  const [rows, setRows] = useState<Rec[]>([]);

  useEffect(() => {
    (async () => {
      const ds = (await api.get<日[]>("/api/calendar", { year: 年, month: 月 })).slice(0, 35);
      setDays(ds);
      setRows(await api.get<Rec[]>("/api/keikaku/calendar", { from: ds[0].date, to: ds[34].date, soko: 倉庫 }));
    })().catch(エラー);
  }, [年, 月, 倉庫]);

  return (
    <div className="kk">
      <div className="kk-head">
        <div className="kk-title">製造カレンダー</div>
        <select value={年} onChange={(e) => set年(Number(e.target.value))}>
          {[年 - 1, 年, 年 + 1].map((y) => <option key={y} value={y}>{y}</option>)}
        </select>
        <span>年</span>
        <select value={月} onChange={(e) => set月(Number(e.target.value))}>
          {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => <option key={m} value={m}>{m}</option>)}
        </select>
        <span>月</span>
        <span className="kk-toggle">
          {工場.map((k) => (
            <button key={k.id} className={倉庫 === k.id ? "on" : ""} onClick={() => set倉庫(k.id)}>{k.name}</button>
          ))}
        </span>
        <PageClose fallback="/keikaku" />
      </div>
      <div className="kk-cal">
        {["日", "月", "火", "水", "木", "金", "土"].map((w) => <div key={w} className="kk-w">{w}</div>)}
        {days.map((d) => {
          const 予定 = rows.filter((r) => r.製造日 === d.date);
          const 色 = d.holiday ? "red" : d.color === "red" ? "sun" : d.color === "blue" ? "sat" : "";
          return (
            <div key={d.date} className={"kk-day" + (d.inMonth ? "" : " out") + (d.date < t ? " past" : "")} onDoubleClick={() => nav(`/keikaku/day?date=${d.date}&soko=${倉庫}`)} title={d.holiday || "ダブルクリックでこの日の計画を開きます"}>
              <div className={"kk-dl " + 色 + (d.date === t ? " today" : "")}>
                {d.inMonth ? `${Number(d.date.slice(8))}日` : `${Number(d.date.slice(5, 7))}月${Number(d.date.slice(8))}日`}
                {d.holiday ? `　${d.holiday}` : ""}
              </div>
              <div className="kk-list">
                {予定.map((r) => (
                  <div key={r.製造ID} className="kk-item">
                    <span>{r.商品名}</span>
                    <span className="r">{num(r.商品kg)}</span>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/**
 * 製造計画入力（Access の FM_製造計画入力）。製造カレンダーの日を押すと開く。その日・その工場の大阪の計画を入れる・直す・消す。
 * 商品コードを入れると商品名・規格・入数・賞味期限が入る。ケースを入れると商品kg（入数×ケース）、商品kg を入れるとケース（商品kg÷入数）を出す。
 * 入れた計画は、製造計画の［生産計画のインポート］で製造管理の入庫予定に取り込まれる。
 */
export function KeikakuDay() {
  const nav = useNavigate();
  const [sp] = useSearchParams();
  const [日, set日] = useState(sp.get("date") ?? today());
  const 倉庫 = Number(sp.get("soko") ?? 11);
  const [rows, setRows] = useState<Rec[]>([]);
  const [opts, setOpts] = useState<Rec>({ 倉庫: [], 作業場: [], 商品: [], 原料: [] });
  const 読む = (d = 日) => api.get<Rec[]>("/api/keikaku/day", { date: d, soko: 倉庫 }).then(setRows).catch(エラー);
  useEffect(() => {
    api.get<Rec>("/api/keikaku/day/opts").then(setOpts).catch(エラー);
  }, []);
  useEffect(() => {
    読む(日);
  }, [日, 倉庫]);
  const ずらす = (n: number) => {
    const d = new Date(日 + "T00:00:00Z");
    d.setUTCDate(d.getUTCDate() + n);
    set日(d.toISOString().slice(0, 10));
  };
  async function 直す(r: Rec, 項目: string, 値: unknown) {
    try {
      await api.post("/api/keikaku/day/save", { 製造ID: r.製造ID, 項目, 値 });
    } catch (e) {
      エラー(e);
    }
    読む();
  }
  async function 足す() {
    try {
      await api.post("/api/keikaku/day/new", { date: 日, soko: 倉庫 });
    } catch (e) {
      エラー(e);
    }
    読む();
  }
  async function 消す(r: Rec) {
    if (!confirm(`${r.商品名 ?? "この行"} を削除します。よろしいですか？`)) return;
    try {
      await api.post("/api/keikaku/day/delete", { 製造ID: r.製造ID });
    } catch (e) {
      エラー(e);
    }
    読む();
  }
  const 選ぶ = (r: Rec, 項目: string, 一覧: Rec[], 数 = true) => (
    <select className="kk-sel" value={r[項目] ?? ""} onChange={(e) => 直す(r, 項目, e.target.value === "" ? null : 数 ? Number(e.target.value) : e.target.value)}>
      <option value="" />
      {!一覧.some((o) => String(o.id) === String(r[項目] ?? "")) && r[項目] != null && <option value={r[項目]}>{r[項目]}</option>}
      {一覧.map((o) => <option key={o.id} value={o.id}>{o.id}{o.name ? `　${o.name}` : ""}</option>)}
    </select>
  );
  return (
    <div className="kk">
      <div className="kk-head">
        <div className="kk-title">製造計画入力</div>
        <button onClick={() => opts.最初 && set日(opts.最初)} title="いちばん古い製造日">|◀</button>
        <button onClick={() => ずらす(-1)}>◀</button>
        <Field kind="date" value={日} className="kk-date" onCommit={(v) => v && set日(v.replace(/\//g, "-"))} />
        <button onClick={() => ずらす(1)}>▶</button>
        <button onClick={() => opts.最後 && set日(opts.最後)} title="いちばん新しい製造日">▶|</button>
        <span className="kk-v">{月日曜(日)}</span>
        <button onClick={() => 読む()}>再表示</button>
        <button className="blue" onClick={足す}>新しい行</button>
        <PageClose fallback="/keikaku" />
      </div>
      <table className="kk-grid kk-edit">
        <thead>
          <tr><th>工場</th><th>作業場</th><th>商品コード</th><th>商品名</th><th>原料</th><th>規格</th><th>入数</th><th>ケース</th><th>商品kg</th><th>原料kg</th><th>製造日</th><th>包装日</th><th>賞味期限</th><th>備考</th><th>製造ID</th><th /></tr>
        </thead>
        <tbody>
          {rows.length === 0 && <tr><td colSpan={16} className="c">この日の計画はありません</td></tr>}
          {rows.map((r) => (
            <tr key={r.製造ID}>
              <td>{選ぶ(r, "倉庫ID", opts.倉庫)}</td>
              <td>{選ぶ(r, "作業場", opts.作業場.map((x: string) => ({ id: x })), false)}</td>
              <td>{選ぶ(r, "商品コード", opts.商品)}</td>
              <td><Field value={r.商品名} className="kk-in w-name" onCommit={(v) => 直す(r, "商品名", v)} /></td>
              <td>{選ぶ(r, "原料コード", opts.原料)}</td>
              <td>{r.規格}</td>
              <td className="r">{r.入数}</td>
              <td><Field value={r.ケース} kind="num" className="kk-in w-num" onCommit={(v) => 直す(r, "ケース", v.trim() === "" ? null : Number(v))} /></td>
              <td><Field value={r.商品kg} kind="num" className="kk-in w-num" onCommit={(v) => 直す(r, "商品kg", v.trim() === "" ? null : Number(v))} /></td>
              <td><Field value={r.原料kg} kind="num" className="kk-in w-num" onCommit={(v) => 直す(r, "原料kg", v.trim() === "" ? null : Number(v))} /></td>
              <td><Field value={r.製造日} kind="date" className="kk-in w-date" onCommit={(v) => 直す(r, "製造日", v.replace(/\//g, "-") || null)} /></td>
              <td><Field value={r.入庫日} kind="date" className="kk-in w-date" onCommit={(v) => 直す(r, "入庫日", v.replace(/\//g, "-") || null)} /></td>
              <td><Field value={r.賞味期限} kind="date" className="kk-in w-date" onCommit={(v) => 直す(r, "賞味期限", v.replace(/\//g, "-") || null)} /></td>
              <td><Field value={r.備考} className="kk-in w-name" onCommit={(v) => 直す(r, "備考", v)} /></td>
              <td className="r">{r.製造ID}</td>
              <td><button className="small" onClick={() => 消す(r)}>削除</button></td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr>
            <td colSpan={7} className="r">計</td>
            <td className="r">{num(rows.reduce((s, r) => s + Number(r.ケース ?? 0), 0))}</td>
            <td className="r">{num(rows.reduce((s, r) => s + Number(r.商品kg ?? 0), 0))}</td>
            <td colSpan={7} />
          </tr>
        </tfoot>
      </table>
    </div>
  );
}
