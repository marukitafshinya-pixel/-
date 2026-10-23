import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api, ApiError, 処理中 } from "../api";
import { Field, today } from "../formParts";

type Rec = Record<string, any>;
type 日 = { date: string; label: string; inMonth: boolean; holiday: string; color: string; underline: boolean };
const エラー = (e: unknown) => alert(e instanceof ApiError ? e.message : String(e));
const 日付に = (v: string) => (v ? v.replace(/\//g, "-") : "");

/**
 * 配送予定カレンダー（Access の 手配出力用カレンダー F_配送予定カレンダー）。
 * 自社手配（630）の貸切便（配達区分 4）を月のカレンダーで見る。［道外］［道内］は LN 帳合（139）の便だけ。
 * 日の右上は工場の保管庫の予想トン数（36t を超えると桃色、38t を超えると赤、40t 以上は日も赤）。
 * 便を押すと、その便の出荷明細票（WorkStation）を開く。
 * ［ニチレイ出荷詳細データ出力］で、開始日〜終了日の手配表を Excel にする（Access は共有フォルダに保存するが、Web 版はダウンロード）。
 */
export function TehaiCalendar() {
  const nav = useNavigate();
  const t = today();
  const [年, set年] = useState(Number(t.slice(0, 4)));
  const [月, set月] = useState(Number(t.slice(5, 7)));
  const [種類, set種類] = useState(0);
  const [days, setDays] = useState<日[]>([]);
  const [便, set便] = useState<Rec[]>([]);
  const [トン, setトン] = useState<Rec>({});
  const [開始日, set開始日] = useState(t);
  const [終了日, set終了日] = useState("");
  const [準備, set準備] = useState(false);

  useEffect(() => {
    api
      .post<{ 開始日: string; 終了日: string | null }>("/api/tehai/yoso", {})
      .then((r) => {
        set開始日(r.開始日);
        set終了日(r.終了日 ?? "");
        set準備(true);
      })
      .catch(エラー);
  }, []);
  useEffect(() => {
    if (!準備) return;
    (async () => {
      const ds = (await api.get<日[]>("/api/calendar", { year: 年, month: 月 })).slice(0, 35);
      setDays(ds);
      const r = await api.get<{ 便: Rec[]; トン: Rec }>("/api/tehai/calendar", { from: ds[0].date, to: ds[34].date, type: 種類 });
      set便(r.便);
      setトン(r.トン);
    })().catch(エラー);
  }, [年, 月, 種類, 準備]);

  async function 出力() {
    if (種類 === 0) return alert("[道外]　または　[道内]　を選択してください");
    try {
      await 処理中(async () => {
        const res = await fetch("/api/tehai/nichirei", {
          method: "POST",
          credentials: "same-origin",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ type: 種類, 開始日, 終了日 }),
        });
        if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? "Excel に出力できませんでした");
        const name = decodeURIComponent((res.headers.get("Content-Disposition") ?? "").split("''")[1] ?? "ニチレイ輸送手配.xlsx");
        const a = document.createElement("a");
        a.href = URL.createObjectURL(await res.blob());
        a.download = name;
        document.body.appendChild(a);
        a.click();
        a.remove();
        alert(`${name} を保存しました`);
      });
    } catch (e) {
      エラー(e);
    }
  }

  return (
    <div className="tc">
      <div className="tc-head">
        <div className="tc-title">配送予定カレンダー</div>
        <select value={年} onChange={(e) => set年(Number(e.target.value))}>
          {[年 - 1, 年, 年 + 1].map((y) => <option key={y} value={y}>{y}</option>)}
        </select>
        <span>年</span>
        <select value={月} onChange={(e) => set月(Number(e.target.value))}>
          {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => <option key={m} value={m}>{m}</option>)}
        </select>
        <span>月</span>
        <span className="tc-toggle">
          {["全部", "道外", "道内"].map((x, i) => <button key={x} className={種類 === i ? "on" : ""} onClick={() => set種類(i)}>{x}</button>)}
        </span>
        <span className="tc-out">
          <Field kind="date" value={開始日} className="tc-d" onCommit={(v) => set開始日(日付に(v))} />
          <span>～</span>
          <Field kind="date" value={終了日} className="tc-d" onCommit={(v) => set終了日(日付に(v))} />
          <button className="navy" onClick={出力}>ニチレイ出荷詳細データ出力</button>
        </span>
        <button onClick={() => nav(-1)}>閉じる</button>
      </div>
      <div className="tc-cal">
        {["日", "月", "火", "水", "木", "金", "土"].map((w) => <div key={w} className="tc-w">{w}</div>)}
        {days.map((d) => {
          const ト = トン[d.date];
          const 色 = d.date === t ? "today" : d.holiday || d.color === "red" ? "hol" : d.color === "blue" ? "sat" : "";
          return (
            <div key={d.date} className={"tc-day" + (d.inMonth ? "" : " out") + (ト?.赤 ? " full" : "") + (d.date < t ? " past" : "")}>
              <div className="tc-top">
                <span className={"tc-dl " + 色}>
                  {d.inMonth ? `${Number(d.date.slice(8))}日` : `${Number(d.date.slice(5, 7))}月${Number(d.date.slice(8))}日`}
                  {d.holiday ? `　${d.holiday}` : ""}
                </span>
                {ト && <span className={"tc-t " + ト.色}>{ト.文字}</span>}
              </div>
              <table className="tc-list">
                <tbody>
                  {便.filter((b) => b.出荷計画日 === d.date).map((b) => (
                    <tr key={b.輸送ID} onClick={() => nav(`/ws?date=${d.date}&id=${b.輸送ID}`)} title="押すとこの便の出荷明細票を開きます">
                      <td className="u">{b.運送会社名}</td><td>{b.丸北指定時間}</td><td className="u">{b.着}</td><td className="r">{b.t数}</td><td className="u">{b.発}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          );
        })}
      </div>
    </div>
  );
}
