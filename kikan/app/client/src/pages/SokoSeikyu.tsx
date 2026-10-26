import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api, ApiError, num, 処理中 } from "../api";
import { Field, parseDate, today } from "../formParts";

type Rec = Record<string, any>;
type 選択肢 = { id: number; name: string | null };
const エラー = (e: unknown) => alert(e instanceof ApiError ? e.message : String(e));
const 年月日 = (v: string | null | undefined) => (v ? v.slice(0, 10).replace(/-/g, "/") : "");
const 月末 = (y: number, m: number) => new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10);
const 円 = (v: unknown) => `¥${num(Math.round(Number(v ?? 0)))}`;
/** Web 版で作ってある帳票 */
const 作った帳票 = new Set(["R_保管料請求書", "R_在庫証明書"]);
/** 明細の 1 ページの行数（A4 横） */
const 明細の行数 = 26;

/**
 * 請求書印刷（Access の FSD_請求書印刷）。年度・月（または開始日〜終了日）、倉庫・名義を選んで［印刷］すると、月末集計をしてから帳票を出す。
 * ［チェック画面］で集計の結果（作業表）を見て Excel に出せる。
 */
export function SokoSeikyu() {
  const nav = useNavigate();
  const d = today();
  const [年度, set年度] = useState(Number(d.slice(0, 4)));
  const [開始, set開始] = useState<string | null>(null);
  const [終了, set終了] = useState<string | null>(null);
  const [opts, setOpts] = useState<{ 倉庫: 選択肢[]; 名義: 選択肢[]; 帳票: Rec[]; USER: Rec } | null>(null);
  const [倉庫, set倉庫] = useState(0);
  const [名義, set名義] = useState(0);
  const [処理, set処理] = useState("");
  const [帳票, set帳票] = useState("R_保管料請求書");
  const [rows, setRows] = useState<Rec[] | null>(null);
  const [見る, set見る] = useState<"印刷" | "チェック" | null>(null);
  const [印刷日時, set印刷日時] = useState("");
  const 読む = () => api.get<any>("/api/soko/seikyu/opts").then(setOpts).catch(エラー);
  useEffect(() => {
    読む();
    // 初めは先月
    const 先月 = new Date(Date.UTC(Number(d.slice(0, 4)), Number(d.slice(5, 7)) - 2, 1));
    月を選ぶ(先月.getUTCFullYear(), 先月.getUTCMonth() + 1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  function 月を選ぶ(y: number, m: number) {
    set年度(y);
    set開始(`${y}-${String(m).padStart(2, "0")}-01`);
    set終了(月末(y, m));
  }
  async function 集計() {
    if (!開始 || !終了) throw new Error("期間を入れてください");
    let 再計算 = false;
    const 前回 = opts?.USER?.保管賃集計日;
    if (前回 && 前回 >= 終了) 再計算 = confirm(`前回集計は${年月日(前回)} です、再集計しますか?`);
    await 処理中(() => api.post("/api/soko/seikyu/shukei", { 開始, 終了, 再計算 }));
    読む();
  }
  const [証明, set証明] = useState<{ rows: Rec[]; 差出人: Rec } | null>(null);
  async function 印刷() {
    if (!作った帳票.has(帳票)) return alert("この帳票はまだ作っていません（見本をいただいてから作ります）。");
    if (帳票 === "R_在庫証明書") {
      // 在庫証明書は在庫の表から作るので、月末集計はしない
      try {
        const rows = await 処理中(() => api.get<Rec[]>("/api/soko/seikyu/shomei", { ...(倉庫 ? { soko: String(倉庫) } : {}), ...(名義 ? { meigi: String(名義) } : {}) }));
        const list = await api.get<Rec[]>("/api/ws/sashidashi").catch(() => [] as Rec[]);
        set証明({ rows, 差出人: list.find((x) => x.区分 === "丸北北海道") ?? {} });
      } catch (e) {
        エラー(e);
      }
      return;
    }
    try {
      await 集計();
      setRows(await api.get<Rec[]>("/api/soko/seikyu/rows", { ...(倉庫 ? { soko: String(倉庫) } : {}), ...(名義 ? { meigi: String(名義) } : {}) }));
      const t = new Date(Date.now() + 9 * 3600 * 1000).toISOString();
      set印刷日時(`${t.slice(0, 10).replace(/-/g, "/")} ${Number(t.slice(11, 13))}${t.slice(13, 19)}`);
      set見る("印刷");
    } catch (e) {
      エラー(e);
    }
  }
  async function チェック() {
    try {
      setRows(await api.get<Rec[]>("/api/soko/seikyu/rows"));
      set見る("チェック");
    } catch (e) {
      エラー(e);
    }
  }
  async function Excel() {
    try {
      await 処理中(async () => {
        const res = await fetch(`/api/soko/seikyu/excel`, { credentials: "same-origin" });
        if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? "Excel に出力できませんでした");
        const a = document.createElement("a");
        a.href = URL.createObjectURL(await res.blob());
        a.download = "保管賃チェック.xlsx";
        document.body.appendChild(a);
        a.click();
        a.remove();
      });
    } catch (e) {
      エラー(e);
    }
  }
  const 帳票一覧 = (opts?.帳票 ?? []).filter((r) => !処理 || r.処理区分 === 処理);
  const 日の欄 = (v: string | null, set: (x: string | null) => void) => (
    <Field value={v} kind="date" className="sko-date" onCommit={(x) => { const p = parseDate(x); if (p === undefined) return alert("日付の書き方が正しくありません。"); set(p); }} />
  );

  if (証明) return <ZaikoShomeiPrint rows={証明.rows} 差出人={証明.差出人} onClose={() => set証明(null)} />;
  if (見る === "印刷" && rows) return <HokanSeikyuPrint rows={rows} 開始={開始!} 終了={終了!} 印刷日時={印刷日時} onClose={() => set見る(null)} />;
  return (
    <div className="sz sko">
      <div className="kk-head">
        <div className="kk-title">請求書印刷</div>
        <span>年度</span>
        <button onClick={() => set年度(年度 - 1)}>◀</button>
        <b>{年度}</b>
        <button onClick={() => set年度(年度 + 1)}>▶</button>
        {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
          <button key={m} className={開始 === `${年度}-${String(m).padStart(2, "0")}-01` ? "on blue" : ""} onClick={() => 月を選ぶ(年度, m)}>{m}月</button>
        ))}
        <button onClick={() => nav(-1)}>閉じる</button>
      </div>
      <div className="sko-top">
        <span>期間</span>{日の欄(開始, set開始)}<span>〜</span>{日の欄(終了, set終了)}
        <span>倉庫</span>
        <select value={倉庫} onChange={(e) => set倉庫(Number(e.target.value))}>
          <option value={0}>（全部）</option>
          {opts?.倉庫.map((o) => <option key={o.id} value={o.id}>{o.id} {o.name}</option>)}
        </select>
        <span>名義</span>
        <select value={名義} onChange={(e) => set名義(Number(e.target.value))}>
          <option value={0}>（全部）</option>
          {opts?.名義.map((o) => <option key={o.id} value={o.id}>{o.id} {o.name}</option>)}
        </select>
        <span className="small">前回の保管賃集計日 {年月日(opts?.USER?.保管賃集計日)}・集計した日 {年月日(opts?.USER?.集計終了日)}</span>
      </div>
      <div className="sko-body">
        <div className="sko-bins">
          {["", "月末処理", "月初処理", "年度末処理"].map((x) => (
            <button key={x} className={"sko-bin" + (処理 === x ? " on" : "")} onClick={() => set処理(x)}>{x || "全部の帳票"}</button>
          ))}
        </div>
        <div className="sko-main">
          <table className="sz-grid">
            <thead><tr><th></th><th>帳票</th><th>処理</th><th>備考</th></tr></thead>
            <tbody>
              {帳票一覧.map((r) => (
                <tr key={r.id} className={r.id === 帳票 ? "sel" : ""} onClick={() => set帳票(r.id)}>
                  <td className="c"><input type="radio" checked={r.id === 帳票} onChange={() => set帳票(r.id)} /></td>
                  <td>{r.name}{!作った帳票.has(r.id) && <span className="small red">（見本待ち）</span>}</td><td>{r.処理区分}</td><td className="small">{r.備考}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="sko-foot">
            <button className="navy" onClick={印刷}>{帳票 === "R_在庫証明書" ? "印刷" : "印刷（月末集計をしてから）"}</button>
            <button onClick={チェック}>チェック画面</button>
            <button className="green" onClick={Excel}>チェックの Excel</button>
          </div>
          {見る === "チェック" && rows && (
            <table className="sz-grid sko-grid">
              <thead>
                <tr><th>倉庫</th><th>名義</th><th>在庫ID</th><th>入庫No</th><th>商品名</th><th>入庫日</th><th>請求期</th><th>請求個数</th><th>請求kg</th><th>入出庫料</th><th>保管料</th><th>荷役料</th><th>名変料</th><th>割増料</th><th>諸経費</th><th>税区分</th></tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={i}>
                    <td>{r.倉庫名}</td><td>{r.名義名 ?? r.名義短縮名}</td><td className="r">{r.在庫ID}</td><td>{r.入庫No}</td><td className="name">{r.商品名}</td><td>{年月日(r.入庫日)}</td>
                    <td className="r">{r.請求期}</td><td className="r">{num(r.請求個数)}</td><td className="r">{num(r.請求kg)}</td><td className="r">{num(r.当月入出庫料)}</td><td className="r">{num(r.当月保管料)}</td>
                    <td className="r">{num(r.荷役料)}</td><td className="r">{num(r.名変料)}</td><td className="r">{num(r.割増料)}</td><td className="r">{num(r.諸経費)}</td><td className="c">{r.税区分}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * 月別保管料明細表（Access の R_保管料請求書〈ニチレイ用〉。いただいた見本の形）。倉庫・名義ごとに、
 * 1 枚目に税区分（課税・非課税）ごとの 入出庫料・保管料・諸費用・減額分・計 と 責任者・担当者 の欄、2 枚目からロットごとの明細。
 */
function HokanSeikyuPrint(props: { rows: Rec[]; 開始: string; 終了: string; 印刷日時: string; onClose: () => void }) {
  const 組 = new Map<string, Rec[]>();
  for (const r of props.rows) {
    const k = `${r.倉庫ID}-${r.入庫後名義ID}`;
    (組.get(k) ?? 組.set(k, []).get(k)!).push(r);
  }
  // ページを作る（Access と同じく、倉庫・名義ごとに 1 枚目のあと、商品コードごとに改ページして小計。倉庫全体の諸経費〈コード 0〉が先頭。
  // 1 つの商品が 明細の行数 を超えるときは続きのページに）
  type ページ = { 種類: "表紙" | "明細"; rows: Rec[]; 小計: Rec[] | null; 組: Rec[] };
  const ページ: ページ[] = [];
  for (const rows of 組.values()) {
    ページ.push({ 種類: "表紙", rows, 小計: null, 組: rows });
    const 商品 = new Map<number, Rec[]>();
    for (const r of [...rows].sort((a, b) => Number(a.商品コード ?? 0) - Number(b.商品コード ?? 0) || String(a.入庫日 ?? "").localeCompare(String(b.入庫日 ?? "")) || String(a.入庫No ?? "").localeCompare(String(b.入庫No ?? ""))))
      (商品.get(Number(r.商品コード ?? 0)) ?? 商品.set(Number(r.商品コード ?? 0), []).get(Number(r.商品コード ?? 0))!).push(r);
    for (const g of 商品.values())
      for (let i = 0; i < g.length; i += 明細の行数) ページ.push({ 種類: "明細", rows: g.slice(i, i + 明細の行数), 小計: i + 明細の行数 >= g.length ? g : null, 組: rows });
  }
  const 計 = (rows: Rec[], k: string) => rows.reduce((a, r) => a + Number(r[k] ?? 0), 0);
  const 行の計 = (r: Rec) => Number(r.当月入出庫料 ?? 0) + Number(r.当月保管料 ?? 0) + Number(r.諸経費 ?? 0);
  return (
    <div className="hs-wrap">
      <div className="no-print hs-bar">
        <button className="navy" onClick={() => window.print()}>印刷する</button>
        <button onClick={props.onClose}>戻る</button>
        <span className="small">減額分は内容を確かめてから入れます（いまは 0）。</span>
      </div>
      {ページ.map((p, i) => {
        const 組の行 = p.組;
        const h = 組の行[0] ?? {};
        // 小計の 期 の欄は、Access と同じく その倉庫・名義の請求期のいちばん大きい数
        const 最大の期 = Math.max(0, ...組の行.map((r) => Number(r.請求期 ?? 0)));
        const kg = (v: unknown) => num(Math.round(Number(v ?? 0)));
        const 頭 = (
          <>
            <div className="hs-time">{props.印刷日時}</div>
            <div className="hs-title">月別保管料明細表</div>
            <div className="hs-head">
              <div>
                <div>倉庫 {h.倉庫得意先名 ?? h.倉庫名}</div>
                <div>名義 {h.名義得意先名 ?? h.名義名}</div>
              </div>
              <div className="hs-day">{年月日(props.開始)} ～ {年月日(props.終了)}</div>
            </div>
          </>
        );
        const 税 = (区分: number) => {
          const rs = 組の行.filter((r) => Number(r.税区分 ?? 0) === 区分);
          const a = 計(rs, "当月入出庫料"), b = 計(rs, "当月保管料"), c = 計(rs, "諸経費"), dd = 0;
          return [a, b, c, dd, a + b + c + dd];
        };
        const 課税 = 税(0), 非課税 = 税(1);
        return (
          <div key={i} className="hs-page">
            {頭}
            {p.種類 === "表紙" ? (
              <div className="hs-sumrow">
                <table className="hs-sum">
                  <thead><tr><th>税区分</th><th>入出庫料</th><th>保管料</th><th>諸費用</th><th>減額分</th><th>計</th></tr></thead>
                  <tbody>
                    <tr><th>課税</th>{課税.map((v, j) => <td key={j}>{円(v)}</td>)}</tr>
                    <tr><th>非課税</th>{非課税.map((v, j) => <td key={j}>{円(v)}</td>)}</tr>
                    <tr className="b"><th>合計</th>{課税.map((v, j) => <td key={j}>{円(v + 非課税[j])}</td>)}</tr>
                  </tbody>
                </table>
                <table className="hs-stamp"><thead><tr><th>責任者</th><th>担当者</th></tr></thead><tbody><tr><td /><td /></tr></tbody></table>
              </div>
            ) : (
              <table className="hs-grid">
                <thead>
                  <tr><th>入庫日</th><th>入庫No</th><th>コード</th><th className="hs-name">商品名</th><th>賞味期限</th><th>期</th><th>入庫数</th><th>請求数</th><th>KG</th><th>入出庫料</th><th>保管料</th><th>荷役料</th><th>名変料</th><th>割増料</th><th>計</th></tr>
                </thead>
                <tbody>
                  {p.rows.map((r, j) => (
                    <tr key={j}>
                      <td>{年月日(r.入庫日)}</td><td>{r.入庫No}</td><td className="r">{Number(r.商品コード ?? 0)}</td><td>{r.商品名}</td><td>{年月日(r.賞味期限)}</td>
                      <td className="r">{Number(r.請求期 ?? 0)}</td><td className="r">{num(r.入庫元数 ?? 0)}</td><td className="r">{num(r.請求個数 ?? 0)}</td><td className="r">{kg(r.請求kg)}</td>
                      <td className="r">{円(r.当月入出庫料)}</td><td className="r">{円(r.当月保管料)}</td><td className="r">{円(r.荷役料)}</td>
                      <td className="r">{円(r.名変料)}</td><td className="r">{円(r.割増料)}</td><td className="r">{円(行の計(r))}</td>
                    </tr>
                  ))}
                  {p.小計 && (
                    <tr className="b hs-subtotal">
                      <td /><td /><td /><td /><td />
                      <td className="r">{最大の期}</td><td />
                      <td className="r">{num(計(p.小計, "請求個数"))}</td><td className="r">{kg(計(p.小計, "請求kg"))}</td><td className="r">{円(計(p.小計, "当月入出庫料"))}</td>
                      <td className="r">{円(計(p.小計, "当月保管料"))}</td><td className="r">{円(計(p.小計, "荷役料"))}</td><td className="r">{円(計(p.小計, "名変料"))}</td>
                      <td className="r">{円(計(p.小計, "割増料"))}</td><td className="r">{円(p.小計.reduce((a, r) => a + 行の計(r), 0))}</td>
                    </tr>
                  )}
                </tbody>
              </table>
            )}
            <div className="hs-pageno">{i + 1} / {ページ.length} ページ</div>
          </div>
        );
      })}
      {ページ.length === 0 && <p className="sko-pad">この期間・倉庫・名義の保管料はありません。</p>}
    </div>
  );
}

/** 在庫証明書（Access の R_在庫証明書。いただいた見本の形）。A4 横、20 行ごとにページ、最後のページに合計 */
function ZaikoShomeiPrint(props: { rows: Rec[]; 差出人: Rec; onClose: () => void }) {
  const { rows, 差出人 } = props;
  const 頁: Rec[][] = [];
  for (let i = 0; i < Math.max(rows.length, 1); i += 20) 頁.push(rows.slice(i, i + 20));
  const t = new Date(Date.now() + 9 * 3600 * 1000);
  const 発行 = `${t.getUTCFullYear()}年${String(t.getUTCMonth() + 1).padStart(2, "0")}月${String(t.getUTCDate()).padStart(2, "0")}日 発行`;
  const 日 = (v: unknown) => (v ? String(v).slice(0, 10).replace(/-/g, "/") : "");
  const 計 = (k: string) => rows.reduce((a, r) => a + Number(r[k] ?? 0), 0);
  const 先 = rows[0] ?? {};
  return (
    <div className="hs-wrap">
      <div className="no-print hs-bar">
        <button onClick={() => window.print()}>印刷</button> <button onClick={props.onClose}>閉じる</button>
        {rows.length === 0 && <span className="small">　在庫がありません（名義を選ばないときは、Access と同じく名義 1261 の在庫を出します）。</span>}
      </div>
      {頁.map((p, i) => (
        <div key={i} className="zs-page">
          <div className="zs-title">在庫　証明書</div>
          <div className="zs-head">
            <div className="zs-to">
              <div>{先.名義正式名 ?? ""}{先.名義正式名 ? "　御中" : ""}</div>
              <div>{先.倉庫正式名 ?? 先.倉庫名 ?? ""}</div>
            </div>
            <div className="zs-date">{発行}</div>
            <div className="zs-from">
              <div>{差出人.住所}</div>
              <div className="zs-co">{差出人.社名} {差出人.店舗}</div>
              <div className="zs-tel">
                <div>
                  <div>TEL:{差出人.TEL}</div>
                  <div style={{ marginTop: "4mm" }}>FAX:{差出人.FAX}</div>
                </div>
                <table className="zs-in"><tbody><tr><th>担当者</th></tr><tr><td /></tr></tbody></table>
              </div>
            </div>
          </div>
          <table className="zs-t">
            <thead><tr><th>入庫日</th><th>倉庫名</th><th>入庫No</th><th>商品名</th><th>重量</th><th>製造日</th><th>賞味期限</th><th>在庫数</th><th>在庫kg</th></tr></thead>
            <tbody>
              {p.map((r, k) => (
                <tr key={k}>
                  <td className="c">{日(r.入庫日)}</td><td>{r.倉庫名}</td><td className="c">{r.入庫No}</td><td>{r.商品名}</td><td className="r">{r.入数}</td>
                  <td className="c">{日(r.製造日)}</td><td className="c">{日(r.賞味期限)}</td><td className="r">{num(r.在庫ケース)}</td><td className="r">{num(r.在庫kg)}</td>
                </tr>
              ))}
              {p.length === 0 && <tr><td /><td /><td /><td /><td /><td /><td /><td /><td /></tr>}
              {i === 頁.length - 1 && (
                <tr className="zs-sum"><td colSpan={7} className="r">合計　　</td><td className="r">{num(計("在庫ケース"))}</td><td className="r">{num(計("在庫kg"))}</td></tr>
              )}
            </tbody>
          </table>
          <div className="zs-page-no">{i + 1} / {頁.length} ページ</div>
        </div>
      ))}
    </div>
  );
}
