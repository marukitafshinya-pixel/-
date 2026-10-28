import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api, ApiError, num } from "../api";
import { Field, PageClose } from "../formParts";

type Rec = Record<string, any>;
const エラー = (e: unknown) => alert(e instanceof ApiError ? e.message : String(e));
const 欄 = Array.from({ length: 25 }, (_, i) => `${String(i + 1).padStart(2, "0")}A`);
const 短い日 = (v: string | null) => (v ? `${v.slice(2, 4)}/${v.slice(5, 7)}/${v.slice(8, 10)}` : "");

/**
 * 在庫商品パレット確認（Access の FS_在庫商品パレット確認）。メニューの「在庫確認（パレット）」から開く。
 * 工場の在庫のロットごとに、パレット 1〜25 枚目のケースを入れる。パレット単位を入れるとパレット数 1、パレット数を入れると単位のケースを順に入れる。
 * パレットの合計が在庫ケースと合えば「OK」、違えば「多い／あと」の数を出す。
 */
export default function WsZaikoPallet() {
  const nav = useNavigate();
  const [rows, setRows] = useState<Rec[]>([]);
  const [合わない, set合わない] = useState(false);

  async function 読む() {
    try {
      setRows(await api.get<Rec[]>("/api/ws/zpallet"));
    } catch (e) {
      エラー(e);
    }
  }
  useEffect(() => {
    読む();
  }, []);

  async function 直す(r: Rec, 項目: string, v: string) {
    try {
      const res = await api.post<Rec>("/api/ws/zpallet/save", { 在庫ID: r.在庫ID, 項目, 値: v.trim() === "" ? null : Number(v) });
      setRows((x) => x.map((y) => (y.在庫ID === r.在庫ID ? { ...y, ...res } : y)));
    } catch (e) {
      エラー(e);
    }
  }
  const 差 = (r: Rec) => Number(r.A計 ?? 0) - Number(r.在庫ケース ?? 0);
  const 出す = 合わない ? rows.filter((r) => 差(r) !== 0) : rows;
  const 合う数 = rows.filter((r) => 差(r) === 0).length;

  return (
    <div className="zp">
      <div className="kn-head no-print">
        <div className="kn-title">在庫商品パレット確認</div>
        <div className="kn-box">
          <label><input type="checkbox" checked={合わない} onChange={(e) => set合わない(e.target.checked)} /> 合っていない行だけ出す</label>
          <div className="small">合っている {合う数} 件／全部 {rows.length} 件</div>
        </div>
        <div className="kn-btns">
          <button onClick={読む}>出し直す</button>
          <button onClick={() => window.print()}>印刷</button>
          <PageClose fallback="/maruhoku" />
        </div>
      </div>
      <PalletPrint rows={出す} />
      <div className="kn-list zp-list no-print">
        <table className="kn-grid zp-grid">
          <thead>
            <tr>
              <th>倉庫</th><th>商品名</th><th>製造・賞味</th><th>区分</th><th>在庫</th><th>計</th><th>確認</th><th>単位</th><th>枚数</th>
              {欄.map((k) => <th key={k} className="zp-a">{Number(k.slice(0, 2))}</th>)}
            </tr>
          </thead>
          <tbody>
            {出す.length === 0 && <tr><td colSpan={34} className="c none">当てはまる在庫はありません</td></tr>}
            {出す.map((r) => {
              const d = 差(r);
              return (
                <tr key={r.在庫ID} className={d === 0 ? "ok" : ""}>
                  <td className="small nowrap">{r.倉庫名}</td>
                  <td className="name">{r.商品名}<div className="small gray">{r.商品コード}</div></td>
                  <td><div className="navy-t">{短い日(r.製造日)}</div><div className="orange small">{短い日(r.賞味期限)}</div></td>
                  <td className="c">{r.タグ}</td>
                  <td className="r"><b>{num(r.在庫ケース)}</b><div className="small gray">{num(r.在庫kg)}</div></td>
                  <td className="r"><b>{num(r.A計)}</b></td>
                  <td className={"c nowrap " + (d === 0 ? "zp-ok" : "zp-ng")}>{d === 0 ? "OK" : d > 0 ? `多い ${num(d)}` : `あと ${num(-d)}`}</td>
                  <td><Field value={r.パレット単位} kind="num" className="zp-n" onCommit={(v) => 直す(r, "パレット単位", v)} /></td>
                  <td><Field value={r.パレット数} kind="num" className="zp-n" onCommit={(v) => 直す(r, "パレット数", v)} /></td>
                  {欄.map((k) => (
                    <td key={k} className="zp-a"><Field value={r[k] || ""} kind="num" className="zp-c" onCommit={(v) => 直す(r, k, v)} /></td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/**
 * 印刷（Access の R_在庫商品パレット確認）。いただいた印刷の見本に合わせ、商品区分（製品など）ごとに、1 ページ 10 行。
 * 行ごとに 商品コード・商品名・製造日・区分（タグ）・在庫数（上の青い数はパレットの合計）・在庫kg、
 * 計算（パレット単位・パレット数）、パレット 1〜25 枚目のケース（10 列 × 3 段）、合っていれば「OK」。区分の最後に合計。
 */
function PalletPrint({ rows }: { rows: Rec[] }) {
  const d = new Date();
  const 日時 = `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, "0")}/${String(d.getDate()).padStart(2, "0")} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}:${String(d.getSeconds()).padStart(2, "0")}`;
  const 区分: { 名: string; 番: number; rows: Rec[] }[] = [];
  for (const r of [...rows].sort((a, b) => Number(a.商品区分 ?? 0) - Number(b.商品区分 ?? 0))) {
    let g = 区分.find((x) => x.番 === Number(r.商品区分 ?? 0));
    if (!g) 区分.push((g = { 名: r.商品区分名 ?? "", 番: Number(r.商品区分 ?? 0), rows: [] }));
    g.rows.push(r);
  }
  const ページ: { 名: string; rows: Rec[]; 合計?: Rec[] }[] = [];
  for (const g of 区分)
    for (let i = 0; i < g.rows.length; i += 10) ページ.push({ 名: g.名, rows: g.rows.slice(i, i + 10), 合計: i + 10 >= g.rows.length ? g.rows : undefined });
  const 製 = (v: string | null) => (v ? `${v.slice(2, 4)}.${v.slice(5, 7)}.${v.slice(8, 10)}` : "");
  const 数 = (v: unknown) => (v === null || v === undefined || v === "" ? "" : String(Number(v)));
  return (
    <div className="print-only pp-print">
      <style>{"@page { size: A4 landscape; margin: 8mm; }"}</style>
      {ページ.map((p, i) => (
        <div key={i} className="pp-page">
          <div className="pp-head">
            <div className="pp-title">{p.名}</div>
            <div className="pp-no">{i + 1} / {ページ.length}</div>
            <div className="pp-time">{日時}</div>
          </div>
          <div className="pp-cols">
            <span className="pp-c1">商品ｺｰﾄﾞ</span><span className="pp-c2">商品名</span><span className="pp-c3">製造日</span><span className="pp-c4">区分</span>
            <span className="pp-c5">在庫数</span><span className="pp-c6">在庫kg</span><span className="pp-c7">計算</span>
            {Array.from({ length: 10 }, (_, k) => <span key={k} className="pp-n">{k + 1}</span>)}
          </div>
          {p.rows.map((r) => {
            const 合う = Number(r.A計 ?? 0) === Number(r.在庫ケース ?? 0);
            return (
              <div key={r.在庫ID} className="pp-row">
                <div className="pp-c1 r">{r.商品コード}</div>
                <div className="pp-c2 pp-name">{r.商品名}</div>
                <div className="pp-c3 pp-big">{製(r.製造日)}</div>
                <div className="pp-c4 pp-big c">{r.タグ}</div>
                <div className="pp-c5 r"><div className="pp-blue">{Number(r.A計 ?? 0) ? 数(r.A計) : ""}</div><div className="pp-big">{数(r.在庫ケース)}</div></div>
                <div className="pp-c6 r pp-kg">{数(r.在庫kg)}</div>
                <div className="pp-c7"><div className="pp-calc"><span>{数(r.パレット単位 ?? 0)}</span><span>{数(r.パレット数 ?? 0)}</span></div><div className="pp-bar" /></div>
                <table className="pp-grid">
                  <tbody>
                    {[0, 10, 20].map((s) => (
                      <tr key={s}>
                        {Array.from({ length: 10 }, (_, k) => {
                          const n = s + k + 1;
                          const v = n <= 25 ? r[`${String(n).padStart(2, "0")}A`] : null;
                          return <td key={k}>{v ? 数(v) : ""}</td>;
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
                <div className="pp-ok">{合う ? "OK" : ""}</div>
              </div>
            );
          })}
          {p.合計 && (
            <div className="pp-sum">
              <span className="pp-sumlbl">合計</span>
              <span className="pp-sumv">{p.合計.reduce((a, r) => a + Number(r.在庫ケース ?? 0), 0)}</span>
              <span className="pp-sumv">{Math.round(p.合計.reduce((a, r) => a + Number(r.在庫kg ?? 0), 0) * 100) / 100}</span>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
