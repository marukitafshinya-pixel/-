import { useEffect, useState, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { api, ApiError, num, 処理中 } from "../api";
import { Field, FindDialog, parseDate } from "../formParts";

type Rec = Record<string, any>;
const エラー = (e: unknown) => alert(e instanceof ApiError ? e.message : String(e));
const 日 = (v: string | null) => (v ? v.replace(/-/g, "/") : "");
const 短い日 = (v: string | null) => (v ? `${v.slice(2, 4)}/${v.slice(5, 7)}/${v.slice(8, 10)}` : "");

/** 条件の行（Access の画面の並び。見出しの番号は Access の GroupName の番号、並べる項目は rab のラベル） */
const 行: { 名: string; 見出し: number; 並べる: string; 条件?: string; 探す?: "tokui" | "shohin" | "unso" | "bunrui"; 日付?: [string, string] }[] = [
  { 名: "出荷日", 見出し: 1, 並べる: "出荷日", 日付: ["出荷日1", "出荷日2"] },
  { 名: "製造日", 見出し: 2, 並べる: "製造日", 日付: ["製造日1", "製造日2"] },
  { 名: "届け先コード", 見出し: 3, 並べる: "届け先コード", 条件: "届け先", 探す: "tokui" },
  { 名: "手配帳合ID", 見出し: 12, 並べる: "手配帳合ID", 条件: "帳合", 探す: "tokui" },
  { 名: "倉庫ID", 見出し: 4, 並べる: "倉庫ID", 条件: "出荷元", 探す: "tokui" },
  { 名: "運送会社ID", 見出し: 5, 並べる: "運送会社ID", 条件: "運送会社", 探す: "unso" },
  { 名: "商品コード", 見出し: 6, 並べる: "商品コード", 条件: "商品", 探す: "shohin" },
  { 名: "入庫前名義", 見出し: 7, 並べる: "入庫前名義ID", 条件: "名義", 探す: "tokui" },
  { 名: "入庫後名義", 見出し: 8, 並べる: "入庫後名義ID", 条件: "入庫名義", 探す: "tokui" },
  { 名: "分類ID", 見出し: 9, 並べる: "分類ID", 条件: "分類", 探す: "bunrui" },
  { 名: "取引元ID", 見出し: 10, 並べる: "取引元ID", 条件: "取引元", 探す: "tokui" },
];
/** 印刷の列（Access の R_出荷履歴_簡易・R_出荷履歴_標準。いただいた印刷の見本と同じ並び） */
type 印刷の列 = { k: string; 名: string; 数?: boolean; 右?: boolean; 日?: "長" | "短" | "月日"; 中?: boolean; 幅?: number };
const 印刷の列: Record<number, 印刷の列[]> = {
  0: [
    { k: "出荷日", 名: "出荷日", 日: "月日", 中: true, 幅: 7 }, { k: "運送会社名", 名: "運送会社", 中: true, 幅: 11 }, { k: "届け先", 名: "届け先", 幅: 13 },
    { k: "倉庫名", 名: "出荷場所", 幅: 11 }, { k: "商品コード", 名: "ｺｰﾄﾞ", 右: true, 幅: 4 }, { k: "商品名", 名: "商品名", 幅: 18 },
    { k: "製造日", 名: "製造日", 日: "短", 中: true, 幅: 7 }, { k: "賞味期限", 名: "賞味期限", 日: "短", 中: true, 幅: 7 },
    { k: "ケース", 名: "ケース", 数: true, 幅: 4 }, { k: "商品kg", 名: "商品kg", 数: true, 幅: 7 }, { k: "納品日", 名: "納品日", 日: "月日", 中: true, 幅: 7 },
  ],
  1: [
    { k: "出荷日", 名: "出荷日", 日: "長", 中: true, 幅: 7 }, { k: "倉庫名", 名: "出荷場所", 中: true, 幅: 9 }, { k: "商品コード", 名: "ｺｰﾄﾞ", 中: true, 幅: 3.5 },
    { k: "商品名", 名: "商品名", 中: true, 幅: 11 }, { k: "ケース", 名: "ケース", 数: true, 幅: 4 }, { k: "商品kg", 名: "商品kg", 数: true, 幅: 4.5 },
    { k: "届け先", 名: "届け先", 中: true, 幅: 9 }, { k: "製造日", 名: "製造日", 日: "短", 中: true, 幅: 5 }, { k: "賞味期限", 名: "賞味期限", 日: "短", 中: true, 幅: 5 },
    { k: "納品日", 名: "納品日", 日: "月日", 中: true, 幅: 5 }, { k: "入庫前名義", 名: "入庫前名義", 中: true, 幅: 7.5 },
    { k: "入庫後名義", 名: "入庫後名義", 中: true, 幅: 7.5 }, { k: "入庫No", 名: "入庫No", 中: true, 幅: 5.5 }, { k: "運送会社名", 名: "運送会社名", 中: true, 幅: 8 },
    { k: "車番", 名: "車番", 中: true, 幅: 5 },
  ],
};
const 印刷の日 = (v: string | null, 形: "長" | "短" | "月日") =>
  !v ? "" : 形 === "長" ? 日(v) : 形 === "短" ? 短い日(v) : `${v.slice(5, 7)}月${v.slice(8, 10)}日`;
/** 見出しの番号の名前（Access の GroupName） */
const 見出しの名前: Record<number, string> = { 1: "出荷月", 2: "製造月", 3: "届け先", 4: "倉庫名", 5: "運送会社名", 6: "商品名", 7: "入庫前名義", 8: "入庫後名義", 9: "分類ID", 10: "取引元", 12: "帳合先" };

/**
 * 出荷抽出帳票（Access の FSD_出荷抽出帳票）。メニューの「出荷抽出帳票」から開く。
 * 条件で出荷を絞り、ヘッダー（大きい見出し）・フッダー（小計の見出し）と並び順を選んで、印刷（簡易・標準）や Excel に出す。
 * 条件は名前（レポート表題）を付けて記録でき、右の一覧から読み込める。
 */
export default function WsShukkaChu(props: { 系?: "ws" | "soko" }) {
  const 系 = props.系 ?? "ws";
  const nav = useNavigate();
  const [c, setC] = useState<Rec>({ 分類等号: "=" });
  const [名前, set名前] = useState<Rec>({});
  const [表題, set表題] = useState("出荷履歴");
  const [宛名, set宛名] = useState("");
  const [タイプ, setタイプ] = useState(1);
  const [ヘッダー, setヘッダー] = useState(1);
  const [フッダー, setフッダー] = useState(0);
  const [番号, set番号] = useState<Record<string, number>>({});
  const [タブ, setタブ] = useState<"条件" | "プレビュー">("条件");
  const [rows, setRows] = useState<Rec[] | null>(null);
  const [印刷, set印刷] = useState(false);
  const [saved, setSaved] = useState<Rec[]>([]);
  const [探す, set探す] = useState<{ 条件: string; kind: "tokui" | "shohin" | "unso" } | null>(null);
  const [情報, set情報] = useState("");

  const 保存一覧 = () => api.get<Rec[]>(`/api/${系}/shukkachu/saved`).then(setSaved, エラー);
  useEffect(() => {
    保存一覧();
  }, []);

  async function 名前を出す(条件: string, kind: string, code: unknown) {
    if (code == null || code === "") return set名前((x) => ({ ...x, [条件]: "" }));
    const r = await api.get<{ name: string }>(`/api/${系}/shukkachu/name`, { kind, code: String(code) }).catch(() => ({ name: "" }));
    set名前((x) => ({ ...x, [条件]: r.name }));
  }
  function 入れる(条件: string, kind: string, v: string) {
    const x = v.trim() === "" ? null : Number(v);
    setC((p) => ({ ...p, [条件]: x }));
    名前を出す(条件, kind, x);
  }
  /** 並び順の番号（Access の AutoNo：押した順に 1〜5） */
  function 並びを足す(k: string) {
    if (番号[k]) return;
    const n = Object.keys(番号).length + 1;
    if (n < 6) set番号((x) => ({ ...x, [k]: n }));
  }
  /** ヘッダーを選ぶ（Access と同じく、条件と並び順を消してから、その項目を並び順の 1 にし、フッダーも同じにする） */
  function ヘッダーを選ぶ(i: number) {
    setC((p) => ({ 出荷日1: p.出荷日1, 出荷日2: p.出荷日2, 製造日1: p.製造日1, 製造日2: p.製造日2, 取引元: p.取引元, 品名: p.品名, 分類等号: p.分類等号 }));
    set名前((x) => ({ 取引元: x.取引元 }));
    const r = 行.find((x) => x.見出し === i);
    set番号(r ? { [r.並べる]: 1 } : {});
    setヘッダー(i);
    setフッダー(i);
  }
  const 並び = () => Object.entries(番号).sort((a, b) => a[1] - b[1]).map(([k]) => k);
  const 送る = () => ({ ...c, ヘッダー, フッダー, 並び: 並び() });

  async function 抽出() {
    try {
      const r = await api.post<Rec[]>(`/api/${系}/shukkachu`, 送る());
      setRows(r);
      return r;
    } catch (e) {
      エラー(e);
      return null;
    }
  }
  async function 実行出力() {
    const r = await 抽出();
    if (!r) return;
    setタブ("プレビュー");
    setTimeout(async () => {
      if (!confirm("この条件をExcelに出力しますか？")) return;
      try {
        await 処理中(async () => {
          const res = await fetch(`/api/${系}/shukkachu/excel`, {
            method: "POST", credentials: "same-origin", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...送る(), 表題 }),
          });
          if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? "Excel に出力できませんでした");
          const name = decodeURIComponent((res.headers.get("Content-Disposition") ?? "").split("''")[1] ?? "出荷履歴.xlsx");
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
    }, 50);
  }
  async function 印刷表示() {
    if (await 抽出()) set印刷(true);
  }
  function 条件クリア() {
    setC({ 出荷日1: c.出荷日1, 出荷日2: c.出荷日2, 製造日1: c.製造日1, 製造日2: c.製造日2, 分類等号: "=" });
    set名前({});
    set番号({});
  }
  async function 記録() {
    if (!confirm("この条件を保存しますか？")) return;
    try {
      await api.post(`/api/${系}/shukkachu/saved`, { ...c, 表題, 宛名, タイプ, ヘッダー, フッダー, 並び: 並び(), 番号 });
      await 保存一覧();
      alert("保存終了");
    } catch (e) {
      エラー(e);
    }
  }
  async function 削除(r: Rec) {
    if (!confirm(`${r.表題 ?? ""}の条件を削除しますがよろしいですか？`)) return;
    try {
      await api.post(`/api/${系}/shukkachu/saved/delete`, { ID: r.ID });
      await 保存一覧();
    } catch (e) {
      エラー(e);
    }
  }
  /** 保存した条件を読み込む（Access の ris_R_Click。出荷日・製造日・帳合はそのまま） */
  function 読み込む(r: Rec) {
    set表題(r.表題 ?? "");
    set宛名(r.宛名 ?? "");
    const x: Rec = {
      出荷日1: c.出荷日1, 出荷日2: c.出荷日2, 製造日1: c.製造日1, 製造日2: c.製造日2, 帳合: c.帳合,
      届け先: r.届け先コード, 出荷元: r.倉庫ID, 運送会社: r.運送会社ID, 商品: r.商品コード, 名義: r.入庫前名義, 入庫名義: r.入庫後名義,
      分類: r.商品分類, 分類等号: r.商品分類等号 || "=", 取引元: r.取引元ID, 品名: r.抽出品名 ?? "",
    };
    setC(x);
    for (const 行1 of 行) if (行1.条件 && 行1.探す) 名前を出す(行1.条件, 行1.探す, x[行1.条件]);
    setタイプ(n(r.レポートタイプ) === 0 ? 0 : 1);
    setヘッダー(n(r.ヘッダー));
    setフッダー(n(r.フッダー));
    const 番: Record<string, number> = {};
    行.slice(0, 10).forEach((行1, i) => {
      const v = n(r[`No${i + 1}`]);
      if (v) 番[行1.並べる] = v;
    });
    set番号(番);
    alert("読込終了");
  }

  const 列 = 印刷の列[タイプ] ?? 印刷の列[1];

  if (印刷 && rows) return <ShukkaPrint rows={rows} 列={列} タイプ={タイプ} 表題={表題} 宛名={宛名} c={c} ヘッダー={ヘッダー} フッダー={フッダー} onClose={() => set印刷(false)} />;

  return (
    <div className="sc">
      <div className="sc-head">
        <div className="sc-box">
          <div className="lbl">宛名</div>
          <input value={宛名} onChange={(e) => set宛名(e.target.value)} />
        </div>
        <div className="sc-box wide">
          <div className="lbl">レポート表題</div>
          <input value={表題} onChange={(e) => set表題(e.target.value)} className="c b" />
        </div>
        <div className="sc-type">
          <div className="lbl">レポート表示タイプ</div>
          <div className="row">
            <button className={タイプ === 0 ? "on" : ""} onClick={() => setタイプ(0)}>簡易</button>
            <button className={タイプ === 1 ? "on" : ""} onClick={() => setタイプ(1)}>標準</button>
          </div>
        </div>
      </div>
      <div className="sc-info">{情報}</div>
      <div className="sc-tabs">
        <span className={タブ === "条件" ? "on" : ""} onClick={() => setタブ("条件")}>抽出条件</span>
        <span className={タブ === "プレビュー" ? "on" : ""} onClick={() => (setタブ("プレビュー"), rows === null && 抽出())}>プレビュー</span>
      </div>
      {タブ === "条件" ? (
        <div className="sc-body">
          <div className="sc-cond">
            <table>
              <thead>
                <tr><th className="hf">ﾍｯﾀﾞｰ</th><th className="hf">ﾌｯﾀﾞｰ</th><th /><th /><th /><th /><th /></tr>
              </thead>
              <tbody>
                {行.filter((r) => 系 === "ws" || r.条件 !== "取引元").map((r) => (
                  <tr key={r.名} onMouseEnter={() => set情報(`${r.名}：ヘッダー・フッダーで見出し、左の□を押した順に並べます`)}>
                    <td className="hf"><input type="radio" checked={ヘッダー === r.見出し} onChange={() => ヘッダーを選ぶ(r.見出し)} /></td>
                    <td className="hf"><input type="radio" checked={フッダー === r.見出し} onChange={() => setフッダー(r.見出し)} /></td>
                    <td><button className="sc-no" onClick={() => 並びを足す(r.並べる)} title="押した順に並べます">{番号[r.並べる] ?? ""}</button></td>
                    <td><span className="sc-lbl">{r.名}</span></td>
                    {r.日付 ? (
                      <>
                        <td>{日付欄(c, setC, r.日付[0])}</td>
                        <td className="c">～</td>
                        <td>{日付欄(c, setC, r.日付[1])}</td>
                      </>
                    ) : (
                      <>
                        <td>
                          <div className="sc-pick">
                            <Field value={c[r.条件!] ?? ""} kind="num" className="sc-in" onCommit={(v) => 入れる(r.条件!, r.探す!, v)} />
                            {r.探す !== "bunrui" && <button tabIndex={-1} onClick={() => set探す({ 条件: r.条件!, kind: r.探す as "tokui" | "shohin" | "unso" })} title="探す">▾</button>}
                          </div>
                        </td>
                        <td />
                        <td>
                          <div className="row">
                            <span className="sc-name">{名前[r.条件!] ?? ""}</span>
                            {r.条件 === "分類" && (
                              <button onClick={() => setC((p) => ({ ...p, 分類等号: p.分類等号 === "=" ? "<=" : p.分類等号 === "<=" ? ">=" : "=" }))}>{c.分類等号}</button>
                            )}
                          </div>
                        </td>
                      </>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="sc-hinmei">
              <span className="sc-lbl">品名抽出</span>
              <button onClick={() => setC((p) => ({ ...p, 品名: "玉葱" }))}>玉葱</button>
              <button onClick={() => setC((p) => ({ ...p, 品名: "人参" }))}>人参</button>
              <button onClick={() => setC((p) => ({ ...p, 品名: "" }))} title="右の欄に入れてください">その他</button>
              <input value={c.品名 ?? ""} onChange={(e) => setC((p) => ({ ...p, 品名: e.target.value }))} className="sc-like" />
            </div>
          </div>
          <div className="sc-saved">
            <div className="list">
              {saved.map((r) => (
                <div key={r.ID} onClick={() => 読み込む(r)} title="押すとこの条件を読み込みます">
                  {r.表題}
                  <button className="del" onClick={(e) => (e.stopPropagation(), 削除(r))} title="この条件を削除">×</button>
                </div>
              ))}
            </div>
            <div className="row">
              <button className="red" onClick={() => saved.length && alert("消す条件の右の × を押してください")}>削除</button>
              <button onClick={記録}>記録</button>
            </div>
          </div>
        </div>
      ) : (
        <div className="sc-preview">
          <table className="kn-grid">
            <thead><tr>{列.map((x) => <th key={x.k}>{x.名}</th>)}</tr></thead>
            <tbody>
              {(rows ?? []).map((r) => (
                <tr key={r.出庫ID}>{列.map((x) => <td key={x.k} className={x.数 ? "r" : ""}>{x.日 ? 短い日(r[x.k]) : x.数 ? num(r[x.k]) : r[x.k]}</td>)}</tr>
              ))}
            </tbody>
          </table>
          <div className="kn-foot">{rows?.length ?? 0} 件　ケース計 {num((rows ?? []).reduce((a, r) => a + Number(r.ケース ?? 0), 0))}</div>
        </div>
      )}
      <div className="sc-foot">
        <button className="green" onClick={実行出力}>実行･出力</button>
        <button className="blue" onClick={条件クリア}>条件クリア</button>
        <button onClick={印刷表示}>印刷表示</button>
        <button onClick={() => nav(-1)}>閉じる</button>
      </div>
      {探す && (
        <FindDialog
          kind={探す.kind}
          onClose={() => set探す(null)}
          onPick={(code) => {
            const s = 探す;
            set探す(null);
            入れる(s.条件, s.kind, String(code));
          }}
        />
      )}
    </div>
  );
}

const n = (v: unknown) => Number(v ?? 0) || 0;

function 日付欄(c: Rec, setC: (f: (p: Rec) => Rec) => void, k: string) {
  return (
    <Field
      value={c[k] ?? null}
      kind="date"
      className="sc-date"
      onCommit={(v) => {
        if (v.trim() === "") return setC((p) => ({ ...p, [k]: null }));
        const d = parseDate(v);
        if (d === undefined) return alert("日付の書き方が正しくありません。（例：10/28）");
        setC((p) => ({ ...p, [k]: d }));
      }}
    />
  );
}

/**
 * 印刷（Access の R_出荷履歴_簡易・標準）。いただいた印刷の見本に合わせた横向きの表。
 * ヘッダーの見出しが変わるところで太い線で区切り、フッダーの見出しごとに小計、最後にケース・商品kg の合計。
 */
function ShukkaPrint(props: {
  rows: Rec[]; 列: 印刷の列[]; タイプ: number; 表題: string; 宛名: string; c: Rec; ヘッダー: number; フッダー: number; onClose: () => void;
}) {
  const { rows, 列 } = props;
  type 塊 = { 見出し: string; 小: { 見出し: string; rows: Rec[] }[] };
  const 塊: 塊[] = [];
  for (const r of rows) {
    const h = String(r.見出し1 ?? "");
    const f = String(r.見出し2 ?? "");
    let a = 塊[塊.length - 1];
    if (!a || a.見出し !== h) 塊.push((a = { 見出し: h, 小: [] }));
    let b = a.小[a.小.length - 1];
    if (!b || b.見出し !== f) a.小.push((b = { 見出し: f, rows: [] }));
    b.rows.push(r);
  }
  const 計 = (rs: Rec[], k: string) => rs.reduce((x, r) => x + Number(r[k] ?? 0), 0);
  const 合計の列 = new Set(["ケース", "商品kg"]);
  const 小計 = (題: string, rs: Rec[], cls: string) => (
    <tr className={cls}>
      {列.map((x, i) => (
        <td key={x.k} className={x.数 ? "r" : ""}>{合計の列.has(x.k) ? num(計(rs, x.k)) : i === 0 ? 題 : ""}</td>
      ))}
    </tr>
  );
  const 期間 = `${日(props.c.出荷日1)}　～　${日(props.c.出荷日2)}`;
  const 今 = new Date();
  const 印刷日時 = `${今.getFullYear()}/${String(今.getMonth() + 1).padStart(2, "0")}/${String(今.getDate()).padStart(2, "0")} ${今.getHours()}:${String(今.getMinutes()).padStart(2, "0")}:${String(今.getSeconds()).padStart(2, "0")}`;
  const 全幅 = 列.reduce((s, x) => s + (x.幅 ?? 5), 0);
  return (
    <div className={"sp sp-type" + props.タイプ}>
      <style>{"@page { size: A4 landscape; margin: 10mm; }"}</style>
      <div className="no-print sp-bar">
        <button onClick={() => window.print()}>印刷</button>
        <button onClick={props.onClose}>戻る</button>
      </div>
      {props.タイプ === 0 ? (
        <div className="sp-head0">
          <div className="sp-title0">{props.表題}</div>
          <div className="sp-range0">{期間}</div>
          <div className="sp-right0">
            <div className="sp-time">{印刷日時}</div>
            <div className="sp-co">丸北北海道</div>
          </div>
        </div>
      ) : (
        <div className="sp-head1">
          <div className="sp-to">{props.宛名}</div>
          <div className="sp-center1">
            <div className="sp-title1">{props.表題}</div>
            <div className="sp-range1">{期間}</div>
          </div>
          <div className="sp-co">丸北北海道</div>
        </div>
      )}
      {props.タイプ === 0 && props.宛名 ? <div className="sp-to">{props.宛名}</div> : null}
      {props.タイプ === 1 && (props.ヘッダー || props.フッダー) ? (
        <div className="sp-groups">{[見出しの名前[props.ヘッダー], 見出しの名前[props.フッダー]].filter(Boolean).join("　　")}</div>
      ) : null}
      <table className="sp-grid">
        <colgroup>{列.map((x) => <col key={x.k} style={{ width: `${((x.幅 ?? 5) / 全幅) * 100}%` }} />)}</colgroup>
        <thead><tr>{列.map((x) => <th key={x.k}>{x.名}</th>)}</tr></thead>
        <tbody>
          {塊.map((a, i) => (
            <FragmentRows key={i}>
              {props.ヘッダー ? <tr className="sp-h"><td colSpan={列.length}>{a.見出し || "（なし）"}</td></tr> : null}
              {a.小.map((b, j) => (
                <FragmentRows key={j}>
                  {b.rows.map((r) => (
                    <tr key={r.出庫ID}>
                      {列.map((x) => (
                        <td key={x.k} className={x.数 || x.右 ? "r" : x.中 ? "c" : ""}>{x.日 ? 印刷の日(r[x.k], x.日) : x.数 ? num(r[x.k]) : r[x.k]}</td>
                      ))}
                    </tr>
                  ))}
                  {props.フッダー ? 小計(`${b.見出し || "（なし）"} 計`, b.rows, "sp-f") : null}
                </FragmentRows>
              ))}
            </FragmentRows>
          ))}
          {小計("", rows, "sp-t")}
        </tbody>
      </table>
    </div>
  );
}
function FragmentRows(props: { children: ReactNode }) {
  return <>{props.children}</>;
}
