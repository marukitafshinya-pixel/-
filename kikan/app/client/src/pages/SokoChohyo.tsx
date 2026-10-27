// 倉庫管理の出庫入力の印刷（出庫依頼書・配送依頼書・送品案内書）。いただいた見本（2026/10/27）と同じ並びにする。
// 出庫依頼書・配送依頼書は A4 横、送品案内書は A4 縦（丸北WorkStation の送品案内書と同じ形）。
import { useState } from "react";
import { api, ApiError } from "../api";
import { 送品案内書 } from "./Chohyo";

type Rec = Record<string, any>;
const 曜 = "日月火水木金土";
const d = (v: string | null | undefined) => (v ? new Date(v.slice(0, 10) + "T00:00:00") : null);
const 年月日曜日 = (v: string | null) => {
  const x = d(v);
  return x ? `${x.getFullYear()}年${x.getMonth() + 1}月${x.getDate()}日${曜[x.getDay()]}曜日` : "";
};
const 年月日括弧 = (v: string | null) => {
  const x = d(v);
  return x ? `${x.getFullYear()}年${x.getMonth() + 1}月${x.getDate()}日(${曜[x.getDay()]})` : "";
};
const 年月日 = (v: string | null) => (v ? v.slice(0, 10).replace(/-/g, "/") : "");
const 短い = (v: string | null) => (v ? `${v.slice(2, 4)}/${v.slice(5, 7)}/${v.slice(8, 10)}` : "");
const 数 = (v: number | null | undefined) => (v == null ? "" : v.toLocaleString("ja-JP"));
const 電話 = (v: string | null | undefined) => (v ? v.replace(/-/g, " - ") : "");
const エラー = (e: unknown) => alert(e instanceof ApiError ? e.message : String(e));

/** 出庫依頼書（R_出庫依頼書）の 1 ページの行数 */
const 出庫の行数 = 12;
/** ニチレイの運送会社（輸送依頼書は配送依頼書。サーバーの sokoChohyo.ts と同じ） */
export const ニチレイ便 = [130, 135, 160];

function 出庫依頼書ページ(props: { p: Rec; 行: Rec[]; 頁: number; 最後: boolean }) {
  const { p } = props;
  const 合計 = p.行.reduce((a: number, r: Rec) => a + r.ケース, 0);
  const 名義の呼び名 = String(p.名義名 ?? "").replace(/㈱|\(株\)/g, "").replace(/　/g, " ").trim();
  return (
    <div className="pv-page land si">
      <div className="si-top">
        <div className="si-title">出 庫 依 頼 書</div>
        <div className="si-time">{p.印刷日時}<div className="si-no">No.{p.No}</div></div>
      </div>
      <div className="si-row1">
        <div className="si-page">No{props.頁}</div>
        <div className="si-from">{String(p.名義名 ?? "").replace(/　/g, " ")}</div>
      </div>
      {p.破損連絡 && <div className="si-hason">※ 商品の破損発見時又、落下等による破損の場合、速やかに下記<br />　{名義の呼び名} まで連絡お願いします。</div>}
      <div className="si-head">
        <div>
          <div className="si-to">{p.宛先} 御中</div>
          <div className="si-date"><span>出庫日</span>{年月日曜日(p.出庫日)}</div>
        </div>
        <div>
          <div className="si-u">運送便　{p.運送便}</div>
          <div className="si-u">送り先　{p.送り先}</div>
        </div>
      </div>
      <table className="si-t">
        <colgroup>
          <col style={{ width: "3%" }} /><col style={{ width: "12%" }} /><col style={{ width: "6%" }} /><col style={{ width: "27%" }} /><col style={{ width: "7%" }} />
          <col style={{ width: "7%" }} /><col style={{ width: "8.5%" }} /><col style={{ width: "8.5%" }} /><col style={{ width: "4.5%" }} /><col style={{ width: "16.5%" }} />
        </colgroup>
        <thead>
          <tr><th>順</th><th>ﾕｰｻﾞｰｺｰﾄﾞ</th><th>コード</th><th className="l">商品名</th><th>規格</th><th>ケース</th><th>製造日</th><th>賞味期限</th><th>区分</th><th>入庫元数 ／ 残数</th></tr>
        </thead>
        <tbody>
          {props.行.map((r, i) => (
            <tr key={i}>
              <td className="c">{r.順}</td><td className="c sm">{r.ユーザーコード}</td><td className="c">{r.コード}</td><td className="name">{r.商品名}</td><td className="c sm">{r.規格}</td>
              <td className="c">{数(r.ケース)}</td>
              <td className="c sm top">{短い(r.製造日)}{r.区分 && <div className="tag">{r.区分}</div>}</td>
              <td className="c sm top">{短い(r.賞味期限)}</td><td className="c kubun">{r.区分}</td>
              <td className="zan"><span className="k">入庫元数</span><span className="v">{数(r.入庫元数)}</span><span className="k">残数</span><span className="v">{数(r.残数)}</span></td>
            </tr>
          ))}
          {props.最後 && (
            <tr><td /><td /><td /><td /><td className="c">合計</td><td className="c">{数(合計)}</td><td /><td /><td /><td /></tr>
          )}
        </tbody>
      </table>
      <div className="si-foot">※確認の為FAXにて{String(p.名義名 ?? "").replace(/　/g, " ")}まで返信お願いします。 FAX: {p.名義FAX}　TEL: {p.名義TEL}</div>
    </div>
  );
}

/** 出庫依頼書の全部のページ（1 枚に入らないときは続きのページ。合計は最後のページ） */
export function 出庫依頼書たち(props: { pages: Rec[] }) {
  return (
    <>
      {props.pages.flatMap((p, k) => {
        const 行 = p.行.map((r: Rec, i: number) => ({ ...r, 順: i + 1 }));
        const 頁: Rec[][] = [];
        for (let i = 0; i < Math.max(行.length, 1); i += 出庫の行数) 頁.push(行.slice(i, i + 出庫の行数));
        return 頁.map((x, i) => <出庫依頼書ページ key={`${k}-${i}`} p={p} 行={x} 頁={i + 1} 最後={i === 頁.length - 1} />);
      })}
    </>
  );
}

/** 配送依頼書（R_ニチレイ輸送依頼書_ニチレイ船橋 など） */
function 配送依頼書ページ(props: { p: Rec; 頁: number; 全: number }) {
  const { p } = props;
  const 計 = p.行.reduce((a: Rec, r: Rec) => ({ 数量: a.数量 + r.数量, 総重量: a.総重量 + r.総重量 }), { 数量: 0, 総重量: 0 });
  const 空き = Math.max(0, 3 - p.行.length);
  return (
    <div className="pv-page land hd">
      <div className="hd-top">
        <div className="hd-ate">
          <div>{p.宛名}宛</div>
          <div className="sm">TEL {p.宛TEL}　 FAX {p.宛FAX}</div>
        </div>
        <div className="hd-title">
          <div className="t">配送依頼書</div>
          <div className="s">{p.引取備考}</div>
        </div>
        <div className="hd-page">
          <div className="pg">{props.頁}/{props.全} ページ</div>
          <div className="sm">提出日　 {年月日括弧(p.提出日)}</div>
        </div>
      </div>
      <div className="hd-arrow up" />
      <div className="hd-sec">荷主情報</div>
      <table className="hd-box ninushi">
        <tbody>
          <tr>
            <th>社名</th><td colSpan={2} className="c">{p.社名}</td><td colSpan={3} className="r">{p.FAX} (FAX)</td><th>依頼No</th><td>No. {p.依頼No}</td>
          </tr>
          <tr>
            <th>部署名</th><td className="c">{p.部署名}</td><th className="code">コード</th><td className="c big">{p.荷主コード}</td><th className="code">TEL</th><td className="c big">{電話(p.TEL)}</td><th>担当者名</th><td />
          </tr>
          <tr>
            <th className="thin">発注No.</th><td /><th className="thin">配送時備考</th><td colSpan={3} /><th className="thin">名義</th><td>{String(p.名義 ?? "").replace(/　/g, " ")}</td>
          </tr>
        </tbody>
      </table>
      <div className="hd-two">
        <div>
          <div className="hd-sec">集荷先情報</div>
          <table className="hd-box">
            <tbody>
              <tr><th>集荷日</th><td className="c">{年月日(p.集荷日)}</td><th className="thin">時間指定</th><td className="tm">:</td><td className="tm">～</td><td className="tm">:</td></tr>
              <tr><th>集荷先名</th><td colSpan={5} className="c big">{p.集荷先名}</td></tr>
              <tr><th>住所</th><td colSpan={5} className="c big">{p.集荷先住所}</td></tr>
              <tr><th>電話番号</th><td colSpan={3} className="c">{電話(p.集荷先電話)}</td><td colSpan={2} className="none" /></tr>
            </tbody>
          </table>
        </div>
        <div className="hd-mid">▶</div>
        <div>
          <div className="hd-sec">納品先情報</div>
          <table className="hd-box">
            <tbody>
              <tr><th>到着日</th><td className="c">{年月日(p.到着日)}</td><th className="thin">時間指定</th><td className="tm big">{p.到着時間}</td><td className="tm">:</td><td className="tm">～</td><td className="tm">:</td></tr>
              <tr><th>納品先名</th><td colSpan={6} className="c big">{p.納品先名}</td></tr>
              <tr><th>住所</th><td colSpan={6} className="c big">{p.納品先住所}</td></tr>
              <tr><th>電話番号</th><td colSpan={3} className="c">{p.納品先電話}</td><td colSpan={3} className="none" /></tr>
            </tbody>
          </table>
        </div>
      </div>
      <div className="hd-sec">商品情報</div>
      <table className="hd-t">
        <colgroup>
          <col style={{ width: "2%" }} /><col style={{ width: "13%" }} /><col style={{ width: "34%" }} /><col style={{ width: "17%" }} /><col style={{ width: "5%" }} />
          <col style={{ width: "6%" }} /><col style={{ width: "3.5%" }} /><col style={{ width: "6%" }} /><col style={{ width: "10%" }} />
        </colgroup>
        <thead><tr><th>No.</th><th>商品コード</th><th>商品名</th><th>規格</th><th>数量</th><th colSpan={2}>総重量</th><th>温度帯</th><th>外装日</th></tr></thead>
        <tbody>
          {p.行.map((r: Rec, i: number) => (
            <tr key={i}>
              <td className="c">{i + 1}</td><td className="b">{r.商品コード}</td><td className="b">{r.商品名}</td><td className="c b">{r.規格}</td><td className="r b">{数(r.数量)}</td>
              <td className="r b">{数(r.総重量)}</td><td className="c">kg</td><td className="c b">{r.温度帯}</td><td className="c b">{年月日(r.外装日)}</td>
            </tr>
          ))}
          {Array.from({ length: 空き }, (_, i) => <tr key={`e${i}`}><td /><td /><td /><td /><td /><td /><td /><td /><td /></tr>)}
        </tbody>
      </table>
      <table className="hd-sum"><tbody><tr><th>合計</th><td className="r">{数(計.数量)}</td><td className="r">{数(計.総重量)}</td><td>kg</td></tr></tbody></table>
      <div className="hd-note">
        <div>※新規商品の場合は箱サイズの記入をお願いいたします。(たて×よこ×高さ)</div>
        <div>　　⇒太枠の項目は必須になります。必須項目が抜けている場合は手配ができませんので、記入漏れが無いようお願い致します。</div>
        <div className="gap">※変更の場合は元のFAXを一度キャンセルの上、新たな依頼を送付願います。</div>
      </div>
    </div>
  );
}

/** 配送依頼書の決まった文字（運送会社ごと）を直す欄 */
function 配送の設定(props: { 運送会社ID: number; 設定: Rec; onSaved: () => void }) {
  const [v, setV] = useState<Rec>({ ...props.設定 });
  const 欄: [string, string][] = [["宛名", "宛名（例：○○物流センター）"], ["TEL", "宛先の TEL"], ["FAX", "宛先の FAX"], ["荷主コード", "荷主のコード"], ["集荷先名", "集荷先名"], ["集荷先住所", "集荷先の住所"], ["集荷先電話", "集荷先の電話番号"]];
  async function 保存() {
    try {
      await api.post("/api/soko/chohyo/haiso-settei", { 運送会社ID: props.運送会社ID, 設定: v });
      props.onSaved();
    } catch (e) {
      エラー(e);
    }
  }
  return (
    <div className="hd-settei no-print">
      <div className="small">運送会社 {props.運送会社ID} の配送依頼書に出す決まった文字です。空の欄は、出庫場所の得意先マスタの名前・住所・電話を出します。</div>
      {欄.map(([k, l]) => (
        <label key={k}><span>{l}</span><input value={v[k] ?? ""} onChange={(e) => setV({ ...v, [k]: e.target.value })} /></label>
      ))}
      <button className="blue" onClick={保存}>保存して出し直す</button>
    </div>
  );
}

/** 出庫入力の印刷画面（種類ごと。一括は 輸送依頼書（配送依頼書）・送品案内書・出庫依頼書 の順。Access の 小口帳票一括印刷） */
export function 出庫の印刷(props: { 名前: string; 出庫?: Rec | null; 配送?: Rec | null; 送品?: Rec | null; onClose: () => void; onReload: () => void }) {
  const [設定を開く, set設定を開く] = useState(false);
  const 配送 = props.配送;
  const 枚 = (props.出庫?.pages.length ?? 0) + (配送?.pages.length ?? 0) + (props.送品?.pages.length ?? 0);
  return (
    <div className="pv">
      <div className="pv-bar">
        <span>{props.名前}</span>
        {配送 && <button onClick={() => set設定を開く(!設定を開く)}>配送依頼書の設定</button>}
        <button onClick={() => window.print()}>印刷</button>
        <button onClick={props.onClose}>閉じる</button>
      </div>
      <div className="pv-pages">
        {設定を開く && 配送 && <配送の設定 運送会社ID={配送.便.運送会社ID} 設定={配送.設定 ?? {}} onSaved={() => { set設定を開く(false); props.onReload(); }} />}
        {枚 === 0 && <div className="pv-none">データがありません</div>}
        {配送?.pages.map((p: Rec, i: number) => <配送依頼書ページ key={`h${i}`} p={p} 頁={i + 1} 全={配送.pages.length} />)}
        {props.送品?.pages.map((p: Rec, i: number) => <送品案内書 key={`s${i}`} p={p} />)}
        {props.出庫 && <出庫依頼書たち pages={props.出庫.pages} />}
      </div>
    </div>
  );
}
