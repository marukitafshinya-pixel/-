import { useEffect, useState, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { api, ApiError, num, 処理中 } from "../api";
import { Field, FindDialog, parseDate, PageClose } from "../formParts";

type Rec = Record<string, any>;
type Opt = { id: number; name: string };
const エラー = (e: unknown) => alert(e instanceof ApiError ? e.message : String(e));
const n = (v: unknown) => Number(v ?? 0) || 0;
const 和暦の今日 = () => {
  const d = new Date(Date.now() + 9 * 3600 * 1000);
  return `令和${d.getUTCFullYear() - 2018}年${String(d.getUTCMonth() + 1).padStart(2, "0")}月${String(d.getUTCDate()).padStart(2, "0")}日報告書`;
};
const 月初 = () => new Date(Date.now() + 9 * 3600 * 1000).toISOString().slice(0, 8) + "01";
const 月末 = () => {
  const d = new Date(Date.now() + 9 * 3600 * 1000);
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).toISOString().slice(0, 10);
};

/** 列（Access の trgG_0〜12・trgH_0〜12 のボタン名） */
const 列名 = ["日付", "地域", "手配", "帳合", "運送", "輸送ID", "配達ID", "車両ID", "冷凍ID", "車番", "届け先", "出荷地", "品名"];
/** はじめに表示に印の付いている列（Access のフォームの既定値） */
const はじめの表示 = [true, true, true, true, true, false, false, false, false, true, true, true, true];

/**
 * 輸送抽出帳票（Access の FSD_輸送抽出帳票）。メニューの「輸送抽出帳票」から開く。
 * 集計期間（出荷計画日）と条件で便の出荷を絞り、表示に印を付けた列で帳票を組み立てる。
 * 「ページ」で選んだ列ごとに見出し、「改行」で選んだ列ごとにケース・kg を足して改ページ。「順」は押した順に並べる。
 * 通常は明細、集計は表示した列でまとめてケース・kg を足す。
 */
export default function WsYusoChu() {
  const nav = useNavigate();
  const [c, setC] = useState<Rec>({ 開始: 月初(), 終了: 月末(), 日付基準: 1, 日単位: 1, 地域区分: 2, 届け先: [null, null, null, null] });
  const [表示, set表示] = useState<boolean[]>(はじめの表示);
  const [並び, set並び] = useState<number[]>([]);
  const [ページ, setページ] = useState(1);
  const [改行, set改行] = useState(2);
  const [集計, set集計] = useState(false);
  const [表題, set表題] = useState("輸送一覧表");
  const [担当, set担当] = useState("");
  const [opts, setOpts] = useState<Rec>({});
  const [saved, setSaved] = useState<Rec[]>([]);
  const [名前, set名前] = useState<Rec>({});
  const [探す, set探す] = useState<{ k: string; i?: number; kind: "tokui" | "shohin" | "unso" } | null>(null);
  const [帳票, set帳票] = useState<{ 列: string[]; rows: Rec[]; 題: string; 頭名: string; 足名: string } | null>(null);

  const 保存一覧 = () => api.get<Rec[]>("/api/ws/yusochu/saved").then(setSaved, エラー);
  useEffect(() => {
    api.get<Rec>("/api/ws/yusochu/opts").then(setOpts, エラー);
    保存一覧();
  }, []);

  const 送る = (more: Rec = {}) => ({ ...c, 集計, 表示, 並び, ページ, 改行, ...more });
  async function 名前を出す(key: string, kind: string, code: unknown) {
    if (!code) return set名前((x) => ({ ...x, [key]: "" }));
    const r = await api.get<{ name: string }>("/api/ws/shukkachu/name", { kind, code: String(code) }).catch(() => ({ name: "" }));
    set名前((x) => ({ ...x, [key]: r.name }));
  }
  function 入れる(k: string, kind: string, v: unknown, i?: number) {
    const x = v === "" || v == null ? null : Number(v);
    if (i == null) setC((p) => ({ ...p, [k]: x }));
    else setC((p) => ({ ...p, 届け先: p.届け先.map((y: unknown, j: number) => (j === i ? x : y)) }));
    名前を出す(i == null ? k : `${k}${i}`, kind, x);
  }
  async function 印刷表示(積み下ろし = false) {
    try {
      const r = await api.post<{ 列: string[]; rows: Rec[] }>("/api/ws/yusochu", 送る({ 積み下ろし }));
      if (!r.rows.length) return alert("当てはまるデータがありません");
      set帳票({
        ...r,
        // Access と同じく、表題が空なら「令和○年○月○日報告書」。届け先別印刷は担当者の欄を表題にする（Access のまま）
        題: (積み下ろし ? 担当 : 表題) || 和暦の今日(),
        頭名: 積み下ろし ? "出荷月" : 列名[ページ] ?? "",
        足名: 積み下ろし ? "出荷月" : 列名[改行] ?? "",
      });
    } catch (e) {
      エラー(e);
    }
  }
  async function Excel() {
    try {
      await 処理中(async () => {
        const res = await fetch("/api/ws/yusochu/excel", {
          method: "POST", credentials: "same-origin", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...送る(), 表題 }),
        });
        if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? "Excel に出力できませんでした");
        const name = decodeURIComponent((res.headers.get("Content-Disposition") ?? "").split("''")[1] ?? "輸送一覧表.xlsx");
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
  function クリア() {
    setC({ 開始: 月初(), 終了: 月末(), 日付基準: 1, 日単位: 1, 地域区分: 2, 届け先: [null, null, null, null] });
    set表示(はじめの表示);
    set並び([]);
    setページ(1);
    set改行(2);
    set集計(false);
    set表題("輸送一覧表");
    set担当("");
    set名前({});
  }
  async function 保存() {
    try {
      await api.post("/api/ws/yusochu/saved", { ...送る(), 表題 });
      await 保存一覧();
    } catch (e) {
      エラー(e);
    }
  }
  async function 削除(r: Rec) {
    if (!confirm(`${r.表題 ?? ""}の条件を削除しますがよろしいですか？`)) return;
    try {
      await api.post("/api/ws/yusochu/saved/delete", { ID: r.ID });
      await 保存一覧();
    } catch (e) {
      エラー(e);
    }
  }
  function 読み込む(r: Rec) {
    if (!confirm("データを読み込みしますか？")) return;
    const 数 = (v: unknown) => (v == null || v === "" ? null : n(v));
    const x: Rec = {
      開始: r.集計開始日?.slice(0, 10) ?? c.開始, 終了: r.集計終了日?.slice(0, 10) ?? c.終了, 日単位: 数(r.W_0) ?? 1, 地域区分: 数(r.W_1) === 3 ? 2 : 数(r.W_1) ?? 2, // 前に 12区分で保存した条件は 9区分で開く
      日付基準: 数(r.W_0_1) ?? 1, エリア: r.W_1_1 ?? "", 手配: 数(r.W_2), 帳合: 数(r.W_3), 運送: 数(r.W_4), 輸送区分: 数(r.W_5), 配達区分: 数(r.W_6),
      車両区分: 数(r.W_7), 冷凍区分: 数(r.W_8), 届け先: [数(r.W_10_1), 数(r.W_10_2), 数(r.W_10_3), 数(r.W_10_4)], 出荷地: 数(r.W_11),
      品目: 数(r.W_12), 品名: r.W_like ?? "",
    };
    setC(x);
    set表示(列名.map((_, i) => !!r[`V_${i}`]));
    set集計(!!r.グループ集計);
    set表題(r.表題 ?? "");
    setページ(数(r.ヘッダー) ?? 2);
    set改行(数(r.フッダー) ?? 2);
    for (const k of ["手配", "帳合", "運送"]) 名前を出す(k, "unso", x[k]);
    名前を出す("出荷地", "tokui", x.出荷地);
    x.届け先.forEach((v: unknown, i: number) => 名前を出す(`届け先${i}`, "tokui", v));
    alert("読込終了");
  }

  if (帳票) return <YusoPrint {...帳票} 担当={担当} c={c} onClose={() => set帳票(null)} />;

  const エリアの一覧: { name: string }[] = opts[({ 1: "都道府県", 2: "地区名", 3: "十二地区" } as Record<number, string>)[c.地域区分]] ?? [];
  const 選ぶ = (k: string, list: Opt[] | undefined) => (
    <select value={c[k] ?? ""} onChange={(e) => setC((p) => ({ ...p, [k]: e.target.value === "" ? null : Number(e.target.value) }))}>
      <option value="" />
      {(list ?? []).map((o) => <option key={o.id} value={o.id}>{o.id} {o.name}</option>)}
    </select>
  );
  const 会社 = (k: string) => (
    <>
      <div className="sc-pick">
        <Field value={c[k] ?? ""} kind="num" className="yc-in" onCommit={(v) => 入れる(k, "unso", v.trim())} />
        <button tabIndex={-1} onClick={() => set探す({ k, kind: "unso" })}>▾</button>
      </div>
      <span className="yc-name">{名前[k] ?? ""}</span>
    </>
  );
  const 行の頭 = (i: number) => (
    <>
      <td><input type="checkbox" checked={表示[i]} onChange={(e) => set表示((x) => x.map((y, j) => (j === i ? e.target.checked : y)))} /></td>
      <td><button className={"yc-page" + (ページ === i ? " on" : "")} onClick={() => (setページ(i), set改行(i))}>{列名[i]}</button></td>
      <td><button className={"yc-sq" + (改行 === i ? " on" : "")} onClick={() => set改行(i)} title="この列ごとに小計して改ページ" /></td>
      <td><button className="yc-sq" onClick={() => !並び.includes(i) && 並び.length < 11 && set並び((x) => [...x, i])} title="押した順に並べます">{並び.includes(i) ? 並び.indexOf(i) + 1 : ""}</button></td>
    </>
  );

  return (
    <div className="yc">
      <div className="yc-top">
        <div className="yc-btns">
          <button className={!集計 ? "on" : ""} onClick={() => set集計(false)}>通常</button>
          <button className={集計 ? "on" : ""} onClick={() => set集計(true)}>集計</button>
        </div>
        <div className="yc-btns">
          <button className="green" onClick={Excel}>Exel 出力</button>
          <button className="blue" onClick={クリア}>条件クリア</button>
          <button onClick={() => 印刷表示()}>印刷表示</button>
          <PageClose fallback="/maruhoku" />
        </div>
        <button onClick={() => 印刷表示(true)}>届け先別印刷</button>
      </div>
      <div className="yc-head">
        <div className="sc-box"><div className="lbl">担当者</div><input value={担当} onChange={(e) => set担当(e.target.value)} /></div>
        <div className="sc-box wide"><div className="lbl">レポート表題 &amp; リスト表題</div><input className="c b" value={表題} onChange={(e) => set表題(e.target.value)} /></div>
        <div className="sc-box wide">
          <div className="lbl">集計期間</div>
          <div className="row">{日付欄(c, setC, "開始")}<span>～</span>{日付欄(c, setC, "終了")}</div>
        </div>
      </div>
      <div className="yc-body">
        <table className="yc-grid">
          <thead>
            <tr><th>表示</th><th>ﾍﾟｰｼﾞ</th><th>改行</th><th>順</th><th colSpan={3}>抽出条件</th></tr>
          </thead>
          <tbody>
            <tr>
              {行の頭(0)}
              <td className="yc-lbl">日付表示</td>
              <td>
                <select value={c.日付基準} onChange={(e) => setC((p) => ({ ...p, 日付基準: Number(e.target.value) }))}>
                  <option value={1}>出荷日</option><option value={2}>納品日</option><option value={3}>売り日</option>
                </select>
              </td>
              <td className="yc-tog">
                {[[1, "日単位"], [2, "月単位"], [3, "曜日単位"]].map(([v, l]) => (
                  <button key={v} className={c.日単位 === v ? "on" : ""} onClick={() => setC((p) => ({ ...p, 日単位: v }))}>{l}</button>
                ))}
              </td>
            </tr>
            <tr>
              {行の頭(1)}
              <td className="yc-lbl">地域表示</td>
              <td>
                <select value={c.エリア ?? ""} onChange={(e) => setC((p) => ({ ...p, エリア: e.target.value }))}>
                  <option value="" />
                  {エリアの一覧.map((o) => <option key={o.name} value={o.name}>{o.name}</option>)}
                </select>
              </td>
              <td className="yc-tog">
                {/* 12区分は使わない（2026/10/26 利用者） */}
                {[[1, "都道府県"], [2, "9区分"]].map(([v, l]) => (
                  <button key={v} className={c.地域区分 === v ? "on" : ""} onClick={() => setC((p) => ({ ...p, 地域区分: v, エリア: "" }))}>{l}</button>
                ))}
              </td>
            </tr>
            <tr>{行の頭(2)}<td className="yc-lbl">手配会社</td><td colSpan={2}><div className="row">{会社("手配")}</div></td></tr>
            <tr>{行の頭(3)}<td className="yc-lbl">帳合会社</td><td colSpan={2}><div className="row">{会社("帳合")}</div></td></tr>
            <tr>{行の頭(4)}<td className="yc-lbl">輸送会社</td><td colSpan={2}><div className="row">{会社("運送")}</div></td></tr>
            <tr>{行の頭(5)}<td className="yc-lbl">輸送区分</td><td colSpan={2}>{選ぶ("輸送区分", opts.輸送区分)}</td></tr>
            <tr>{行の頭(6)}<td className="yc-lbl">配達区分</td><td colSpan={2}>{選ぶ("配達区分", opts.配達区分)}</td></tr>
            <tr>{行の頭(7)}<td className="yc-lbl">車両区分</td><td colSpan={2}>{選ぶ("車両区分", opts.車両区分)}</td></tr>
            <tr>{行の頭(8)}<td className="yc-lbl">冷凍区分</td><td colSpan={2}>{選ぶ("冷凍区分", opts.冷凍区分)}</td></tr>
            <tr>{行の頭(9)}<td className="yc-lbl">車番表示</td><td colSpan={2} /></tr>
            <tr>
              {行の頭(10)}
              <td className="yc-lbl">届け先</td>
              <td colSpan={2}>
                <div className="row">
                  {[0, 1, 2, 3].map((i) => (
                    <div key={i} className="yc-todoke">
                      <div className="sc-pick">
                        <Field value={c.届け先[i] ?? ""} kind="num" className="yc-in s" onCommit={(v) => 入れる("届け先", "tokui", v.trim(), i)} />
                        <button tabIndex={-1} onClick={() => set探す({ k: "届け先", i, kind: "tokui" })}>▾</button>
                      </div>
                      <div className="yc-name s">{名前[`届け先${i}`] ?? ""}</div>
                    </div>
                  ))}
                </div>
              </td>
            </tr>
            <tr>
              {行の頭(11)}
              <td className="yc-lbl">出荷地</td>
              <td colSpan={2}>
                <div className="row">
                  <div className="sc-pick">
                    <Field value={c.出荷地 ?? ""} kind="num" className="yc-in" onCommit={(v) => 入れる("出荷地", "tokui", v.trim())} />
                    <button tabIndex={-1} onClick={() => set探す({ k: "出荷地", kind: "tokui" })}>▾</button>
                  </div>
                  <span className="yc-name">{名前.出荷地 ?? ""}</span>
                </div>
              </td>
            </tr>
            <tr>
              {行の頭(12)}
              <td className="yc-lbl">商品名</td>
              <td colSpan={2} className="yc-tog">
                {[[1, "玉葱"], [2, "人参"], [3, "その他"]].map(([v, l]) => (
                  <button key={v} className={c.品目 === v ? "on" : ""} onClick={() => setC((p) => ({ ...p, 品目: p.品目 === v ? null : v }))}>{l}</button>
                ))}
                {c.品目 === 3 && <input value={c.品名 ?? ""} onChange={(e) => setC((p) => ({ ...p, 品名: e.target.value }))} placeholder="商品名の一部" />}
              </td>
            </tr>
          </tbody>
        </table>
        <div className="sc-saved">
          <div className="lbl yc-listlbl">リスト一覧</div>
          <div className="list">
            {saved.map((r) => (
              <div key={r.ID} onClick={() => 読み込む(r)}>
                {r.表題}
                <button className="del" onClick={(e) => (e.stopPropagation(), 削除(r))} title="この条件を削除">×</button>
              </div>
            ))}
          </div>
          <div className="row">
            <button onClick={保存}>保存</button>
            <button className="red" onClick={() => saved.length && alert("消す条件の右の × を押してください")}>削除</button>
          </div>
        </div>
      </div>
      {探す && (
        <FindDialog
          kind={探す.kind}
          onClose={() => set探す(null)}
          onPick={(code) => {
            const s = 探す;
            set探す(null);
            入れる(s.k, s.kind, code, s.i);
          }}
        />
      )}
    </div>
  );
}

function 日付欄(c: Rec, setC: (f: (p: Rec) => Rec) => void, k: string) {
  return (
    <Field
      value={c[k] ?? null}
      kind="date"
      className="sc-date"
      onCommit={(v) => {
        const d = parseDate(v);
        if (d === undefined) return alert("日付の書き方が正しくありません。（例：10/28）");
        setC((p) => ({ ...p, [k]: d }));
      }}
    />
  );
}

/** 組み立てた帳票（Access の C_ReportMaking：ページの見出しごとに見出しと列名、改行の見出しごとに数の合計と改ページ） */
function YusoPrint(props: { 列: string[]; rows: Rec[]; 題: string; 頭名: string; 足名: string; 担当: string; c: Rec; onClose: () => void }) {
  const { 列, rows } = props;
  const 数の列 = new Set(列.filter((k) => rows.some((r) => typeof r[k] === "number")));
  // ページの列（頭）が変わるところで改ページ、改行の列（足）が変わるところで計、最後に合計
  type 段 = { 足: string; rows: Rec[] };
  type 頁 = { 頭: string; 段: 段[] };
  const 頁: 頁[] = [];
  for (const r of rows) {
    const h = String(r._頭 ?? "");
    const f = String(r._足 ?? "");
    let a = 頁[頁.length - 1];
    if (!a || a.頭 !== h) 頁.push((a = { 頭: h, 段: [] }));
    let b = a.段[a.段.length - 1];
    if (!b || b.足 !== f) a.段.push((b = { 足: f, rows: [] }));
    b.rows.push(r);
  }
  const 表示 = (k: string, v: unknown) => (数の列.has(k) ? num(v as number) : (v as ReactNode) ?? "");
  const 計の行 = (題: string, rs: Rec[], cls: string) => (
    <tr className={cls}>
      {列.map((k, j) => (
        <td key={k} className={数の列.has(k) ? "r" : ""}>{数の列.has(k) ? num(rs.reduce((x, r) => x + n(r[k]), 0)) : j === 0 ? 題 : ""}</td>
      ))}
    </tr>
  );
  const d = new Date();
  const 日時 = `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, "0")}/${String(d.getDate()).padStart(2, "0")} ${d.getHours()}:${String(d.getMinutes()).padStart(2, "0")}`;
  const 期間 = `${props.c.開始?.replace(/-/g, "/") ?? ""}　～　${props.c.終了?.replace(/-/g, "/") ?? ""}`;
  const 分ける = props.足名 && props.足名 !== props.頭名;
  return (
    <div className="sp">
      <style>{"@page { size: A4 landscape; margin: 10mm; }"}</style>
      <div className="no-print sp-bar">
        <button onClick={() => window.print()}>印刷</button>
        <button onClick={props.onClose}>戻る</button>
        <span className="small">{rows.length} 行・{頁.length} ページ</span>
      </div>
      {頁.map((a, i) => (
        <div key={i} className={i < 頁.length - 1 ? "yp-page" : ""}>
          <div className="sp-head1">
            <div className="sp-to">{props.担当}</div>
            <div className="sp-center1">
              <div className="sp-title1">{props.題}</div>
              <div className="sp-range1">{期間}</div>
            </div>
            <div className="sp-right0">
              <div className="sp-time">{日時}　{i + 1} / {頁.length}</div>
              <div className="sp-co">丸北北海道</div>
            </div>
          </div>
          {props.頭名 ? <div className="yp-group">{props.頭名}：{a.頭 || "（なし）"}</div> : null}
          <table className="sp-grid yp-grid">
            <thead><tr>{列.map((k) => <th key={k}>{k}</th>)}</tr></thead>
            <tbody>
              {a.段.map((b, j) => (
                <FragmentRows key={j}>
                  {b.rows.map((r, x) => (
                    <tr key={x}>{列.map((k) => <td key={k} className={数の列.has(k) ? "r" : ""}>{表示(k, r[k])}</td>)}</tr>
                  ))}
                  {分ける ? 計の行(`${b.足 || "（なし）"} 計`, b.rows, "sp-f") : null}
                </FragmentRows>
              ))}
              {計の行(props.頭名 ? `${a.頭 || "（なし）"} 計` : "計", a.段.flatMap((b) => b.rows), "sp-t")}
              {i === 頁.length - 1 && 頁.length > 1 ? 計の行("合計", rows, "sp-t") : null}
            </tbody>
          </table>
        </div>
      ))}
    </div>
  );
}
function FragmentRows(props: { children: ReactNode }) {
  return <>{props.children}</>;
}
