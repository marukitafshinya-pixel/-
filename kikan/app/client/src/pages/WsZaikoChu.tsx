import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api, ApiError, num, 処理中 } from "../api";
import { PageClose } from "../formParts";

type Rec = Record<string, any>;
type Opt = { id: number; name: string };
const エラー = (e: unknown) => alert(e instanceof ApiError ? e.message : String(e));
const 短い日 = (v: string | null) => (v ? `${v.slice(2, 4)}/${v.slice(5, 7)}/${v.slice(8, 10)}` : "");

/**
 * 在庫表抽出印刷（Access の FM_在庫表）。メニューの「在庫抽出帳票」から開く。
 * 下の一覧で保管庫・名義・分類・商品を選んで在庫を絞る。在庫表示で輸送中（入庫日が明日以降）を含むか分ける。
 */
export default function WsZaikoChu(props: { 系?: "ws" | "soko" }) {
  const 系 = props.系 ?? "ws";
  const nav = useNavigate();
  const [条件, set条件] = useState<Record<string, string>>({ nyuko: "0" });
  const [rows, setRows] = useState<Rec[]>([]);
  const [opts, setOpts] = useState<{ 保管庫: Opt[]; 名義: Opt[]; 分類: Opt[]; 商品: Opt[] }>({ 保管庫: [], 名義: [], 分類: [], 商品: [] });

  useEffect(() => {
    api.get<Rec[]>(`/api/${系}/zaikochu`, 条件).then(setRows, エラー);
  }, [条件]);
  useEffect(() => {
    api.get<typeof opts>(`/api/${系}/zaikochu/opts`, { soko: 条件.soko ?? "", meigi: 条件.meigi ?? "" }).then(setOpts, エラー);
  }, [条件.soko, 条件.meigi]);

  // Access と同じく、分類と商品は同じ条件のところに入る（あとで選んだ方が効く）
  const 選ぶ = (k: string, v: number) =>
    set条件((c) => {
      const x = { ...c, [k]: String(v) };
      if (k === "bunrui") delete x.shohin;
      if (k === "shohin") delete x.bunrui;
      return x;
    });
  async function Excel() {
    try {
      await 処理中(async () => {
        const res = await fetch(`/api/${系}/zaikochu/excel?` + new URLSearchParams(条件).toString(), { credentials: "same-origin" });
        if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? "Excel に出力できませんでした");
        const name = decodeURIComponent((res.headers.get("Content-Disposition") ?? "").split("''")[1] ?? "在庫表.xlsx");
        const a = document.createElement("a");
        a.href = URL.createObjectURL(await res.blob());
        a.download = name;
        document.body.appendChild(a);
        a.click();
        a.remove();
      });
    } catch (e) {
      エラー(e);
    }
  }
  const ケース計 = rows.reduce((a, r) => a + Number(r.在庫ケース ?? 0), 0);
  const kg計 = rows.reduce((a, r) => a + Number(r.在庫kg ?? 0), 0);
  const 名義名 = opts.名義.find((o) => String(o.id) === 条件.meigi)?.name;
  const 一覧 = (題: string, k: string, list: Opt[], コード = false) => (
    <div className="zc-pick">
      <div className="lbl">{題}</div>
      <div className="list">
        {list.map((o) => (
          <div key={o.id} className={条件[k] === String(o.id) ? "sel" : ""} onClick={() => 選ぶ(k, o.id)}>
            {コード && <span className="code">{o.id}</span>}
            {o.name}
          </div>
        ))}
      </div>
    </div>
  );

  return (
    <div className="zc">
      <div className="zc-top no-print">
        <div className="zc-total"><span>{num(ケース計)}</span><span>{num(kg計)}</span></div>
      </div>
      <ZaikoPrint rows={rows} 名義名={名義名} />
      <div className="zc-list no-print">
        <table className="zc-grid">
          <thead>
            <tr><th>保管庫</th><th>入庫名義</th><th>分類</th><th>コード</th><th>商品名</th><th>製造日</th><th>賞味期限</th><th>元数</th><th>ケース</th><th>Kg</th></tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.在庫ID}>
                <td className="b">{r.倉庫名}</td>
                <td className="blue">{r.名義名}</td>
                <td className="c">{r.分類名}</td>
                <td className="c">{r.商品コード}</td>
                <td>{r.商品名}</td>
                <td className="c blue">{短い日(r.製造日)}</td>
                <td className="c red">{短い日(r.賞味期限)}</td>
                <td className="r blue b">{num(r.入庫元数)}</td>
                <td className="r">{num(r.在庫ケース)}</td>
                <td className="r">{num(r.在庫kg)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="zc-bottom no-print">
        {一覧("保管庫選択", "soko", opts.保管庫)}
        {一覧("名義選択", "meigi", opts.名義, true)}
        {一覧("分類選択", "bunrui", opts.分類)}
        {一覧("商品名選択", "shohin", opts.商品, true)}
        <div className="zc-way">
          <div className="lbl">在庫表示</div>
          {[["0", "輸送中も含む"], ["1", "現在庫"], ["2", "輸送中のみ"]].map(([v, l]) => (
            <button key={v} className={条件.nyuko === v ? "on" : ""} onClick={() => set条件((c) => ({ ...c, nyuko: v }))}>{l}</button>
          ))}
        </div>
        <div className="zc-side">
          <div className="zc-note">輸送在庫は届け先の在庫とします</div>
          <div className="zc-btns">
            <button onClick={() => window.print()} className="navy">伝票印刷</button>
            <PageClose fallback="/maruhoku" />
            <button onClick={() => set条件({ nyuko: 条件.nyuko })} className="red">クリア</button>
            <button onClick={Excel} className="green">Excelに出力</button>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * 伝票印刷（Access の 在庫報告書）。いただいた印刷の見本（ロット別在庫一覧表）に合わせた縦向きの表。
 * 保管庫ごとに名前を出し、コード・商品名・規格・製造日・賞味期限・元数・ケース・商品kg を並べる。
 */
function ZaikoPrint({ rows, 名義名 }: { rows: Rec[]; 名義名?: string }) {
  const d = new Date();
  const 日付 = `${d.getFullYear() - 2018}年${d.getMonth() + 1}月${d.getDate()}日${"日月火水木金土"[d.getDay()]}曜日`;
  const 保管庫: { 名: string; rows: Rec[] }[] = [];
  // 保管庫ごとに、コード・製造日の順（いただいた見本と同じ）
  const 並べた = [...rows].sort((a, b) => Number(a.商品コード ?? 0) - Number(b.商品コード ?? 0) || String(a.製造日 ?? "").localeCompare(String(b.製造日 ?? "")));
  for (const r of 並べた) {
    let g = 保管庫.find((x) => x.名 === (r.倉庫名 ?? ""));
    if (!g) 保管庫.push((g = { 名: r.倉庫名 ?? "", rows: [] }));
    g.rows.push(r);
  }
  return (
    <div className="print-only lz-print">
      <style>{"@page { size: A4 portrait; margin: 12mm; }"}</style>
      {保管庫.map((g, i) => (
        <div key={i} className="lz-page">
          <div className="lz-head">
            <div />
            <div className="lz-title">ロット別在庫一覧表</div>
            <div className="lz-date">{日付}</div>
          </div>
          <div className="lz-soko">{g.名}{名義名 ? <span className="lz-meigi">{名義名} 名義分</span> : null}</div>
          <table className="lz-grid">
            <thead>
              <tr><th>ｺｰﾄﾞ</th><th>商品名</th><th>規格</th><th>製造日</th><th>賞味期限</th><th>元数</th><th>ケース</th><th>商品kg</th></tr>
            </thead>
            <tbody>
              {g.rows.map((r) => (
                <tr key={r.在庫ID}>
                  <td className="r">{r.商品コード}</td>
                  <td>{r.商品名}</td>
                  <td className="c">{r.規格}</td>
                  <td className="c">{短い日(r.製造日)}</td>
                  <td className="c">{短い日(r.賞味期限)}</td>
                  <td className="r">{num(r.入庫元数)}</td>
                  <td className="r">{num(r.在庫ケース)}</td>
                  <td className="r">{num(r.在庫kg)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="lz-co">丸北北海道</div>
        </div>
      ))}
    </div>
  );
}
