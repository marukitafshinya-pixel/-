import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { api, ApiError, num, 処理中 } from "../api";
import { Field, today } from "../formParts";

type Rec = Record<string, any>;
type Opt = { id: number | string; name: string };
type Opts = { 商品区分: Opt[]; 産地: Opt[]; 商品状態: Opt[]; 札色: Opt[]; 作業場: Opt[] };
const 空の選択肢: Opts = { 商品区分: [], 産地: [], 商品状態: [], 札色: [], 作業場: [] };
const エラー = (e: unknown) => alert(e instanceof ApiError ? e.message : String(e));
const 日を足す = (v: string, k: number) => new Date(Date.parse(v + "T00:00:00Z") + k * 86400000).toISOString().slice(0, 10);
const 日付に = (v: string) => (v ? v.replace(/\//g, "-") : "");
const 和の日付 = (v: string) => (v ? `${v.slice(0, 4)}年${v.slice(5, 7)}月${v.slice(8, 10)}日(${"日月火水木金土"[new Date(v + "T00:00:00").getDay()]})` : "");
const 短い日 = (v: string | null) => (v ? `${v.slice(2, 4)}/${v.slice(5, 7)}/${v.slice(8, 10)}` : "");
const 曜日付き = (v: string) => (v ? `${v.replace(/-/g, "/")}（${"日月火水木金土"[new Date(v + "T00:00:00").getDay()]}）` : "");
const n = (v: unknown) => Number(v ?? 0) || 0;
/** 他工場（Access の工場選択のトグル） */
const 他工場 = [
  { id: 1187, name: "えんゆう" },
  { id: 191, name: "ふらの" },
  { id: 1271, name: "遠軽食品" },
];

async function Excelを受け取る(url: string, 既定の名前: string) {
  await 処理中(async () => {
    const res = await fetch(url, { credentials: "same-origin" });
    if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? "Excel に出力できませんでした");
    const name = decodeURIComponent((res.headers.get("Content-Disposition") ?? "").split("''")[1] ?? 既定の名前);
    const a = document.createElement("a");
    a.href = URL.createObjectURL(await res.blob());
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
  });
}


/** 日付の欄（Access の［日付］と ◀ ▶、下に 2026年10月23日(金)） */
function 日付の欄(props: { 題: string; value: string; onChange: (v: string) => void }) {
  return (
    <div className="sz-date">
      <div className="sz-date-top">
        <span className="sz-date-lbl">{props.題}</span>
        <button onClick={() => props.onChange(日を足す(props.value, -1))} title="前の日">◀</button>
        <button onClick={() => props.onChange(日を足す(props.value, 1))} title="次の日">▶</button>
      </div>
      <Field kind="date" value={props.value} className="sz-date-v" onCommit={(v) => v && props.onChange(日付に(v))} />
      <div className="sz-date-w">{和の日付(props.value)}</div>
    </div>
  );
}

/** 工場選択（Access の枠の中のトグル） */
function 工場選択(props: { list: { id: number; name: string }[]; value: number; onChange: (v: number) => void }) {
  return (
    <div className="sz-factory">
      <div className="sz-factory-lbl">工場選択</div>
      <div className="sz-factory-btns">
        {props.list.map((k) => <button key={k.id} className={props.value === k.id ? "on" : ""} onClick={() => props.onChange(k.id)}>{k.name}</button>)}
      </div>
    </div>
  );
}

/**
 * 製造管理 丸北 のメニュー（Access の FM_メインメニュー）。いただいた画面のとおり、
 * 丸北 製造登録・他工場 製造登録・在庫管理・検索 のタブ。日付を選んで各画面を開く。
 */
export function SeizoMenu() {
  const nav = useNavigate();
  const [sp, setSp] = useSearchParams();
  const [日, set日] = useState(today());
  const タブ = sp.get("tab") ?? "maruhoku";
  const タブ一覧 = [
    { k: "maruhoku", 名: "丸北　製造登録" },
    { k: "tako", 名: "他工場　製造登録" },
    { k: "zaiko", 名: "在庫管理" },
    { k: "kensaku", 名: "検索" },
  ];
  return (
    <div className="sz-menu-page">
      <div className="sz-menu-head">
        <div>
          <div className="sz-menu-title">製造管理</div>
          <日付の欄 題="日付" value={日} onChange={set日} />
        </div>
        <div className="sz-menu-co">丸北北海道</div>
      </div>
      <div className="sz-menu-body">
        <div className="sz-tabs">
          {タブ一覧.map((t) => <button key={t.k} className={タブ === t.k ? "on" : ""} onClick={() => setSp({ tab: t.k }, { replace: true })}>{t.名}</button>)}
        </div>
        <div className="sz-tab-page">
          {タブ === "maruhoku" && (
            <div className="sz-tab-grid">
              <button onClick={() => nav(`/seizo/dekidaka?date=${日}`)}>丸北　計量枚数登録</button>
              <button onClick={() => nav(`/seizo/yotei?date=${日}`)}>包装予定追加</button>
              <button onClick={() => nav(`/seizo/hoso?date=${日}`)}>丸北　包装日誌登録</button>
            </div>
          )}
          {タブ === "tako" && (
            <div className="sz-tab-grid one">
              <button onClick={() => nav(`/seizo/tako?date=${日}`)}>他工場　計量日誌登録</button>
              <button onClick={() => nav(`/seizo/hoso?date=${日}&soko=191`)}>他工場　包装日誌登録</button>
            </div>
          )}
          {タブ === "zaiko" && <div className="sz-note">在庫管理のボタン（在庫確認・バッチ処理）は、Access でも押しても何もしないため、置いていません。</div>}
          {タブ === "kensaku" && (
            <div className="sz-tab-grid one">
              <button onClick={() => nav("/seizo/kensaku")}>取引先商品製造一覧</button>
              <button onClick={() => nav("/seizo/jikan")}>包装時間の集計</button>
            </div>
          )}
        </div>
      </div>
      <div className="sz-menu-foot">
        <span>Copyright 2020 marukita Ltd. All rights reserved.</span>
        <button className="sz-exit" onClick={() => nav("/")}>終　了</button>
      </div>
    </div>
  );
}

/** 一覧の 1 項目（数・文字・日付）。直したらサーバーで Access と同じ計算をして、一覧を読み直す */
function 欄(props: { r: Rec; k: string; kind?: "num" | "date" | "text"; w?: number; ro?: boolean; kyotsu?: "shohin" | "tokui"; cls?: string; 直す: (r: Rec, k: string, v: unknown) => void }) {
  return (
    <td className={props.cls}>
      <入力 {...props} />
    </td>
  );
}
function 入力(props: { r: Rec; k: string; kind?: "num" | "date" | "text"; w?: number; ro?: boolean; kyotsu?: "shohin" | "tokui"; 直す: (r: Rec, k: string, v: unknown) => void }) {
  const { r, k } = props;
  return (
    <Field
      value={r[k]}
      kind={props.kind ?? "text"}
      kyotsu={props.kyotsu}
      readOnly={props.ro}
      className={"sz-in" + (props.w ? ` w${props.w}` : "")}
      onCommit={(v) => props.直す(r, k, props.kind === "num" ? (v.trim() === "" ? null : Number(v.replace(/,/g, ""))) : props.kind === "date" ? 日付に(v) || null : v)}
    />
  );
}
function 選ぶ(props: { r: Rec; k: string; opts: Opt[]; num?: boolean; w?: number; 直す: (r: Rec, k: string, v: unknown) => void }) {
  return (
    <select
      className="sz-sel"
      style={props.w ? { width: props.w } : undefined}
      value={props.r[props.k] ?? ""}
      onChange={(e) => props.直す(props.r, props.k, e.target.value === "" ? null : props.num ? Number(e.target.value) : e.target.value)}
    >
      <option value="" />
      {props.opts.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
    </select>
  );
}
/** 袋総枚数・箱詰枚数・半端枚数（Access は 3 段で出す） */
function 三段(props: { r: Rec; 直す: (r: Rec, k: string, v: unknown) => void; 端?: string }) {
  return (
    <td className="sz-3">
      <入力 r={props.r} k="計量元数" kind="num" w={5} 直す={props.直す} />
      <入力 r={props.r} k="箱詰枚数" kind="num" w={5} 直す={props.直す} />
      <div className="sz-3-red">{num(props.r[props.端 ?? "仕掛枚数"] ?? 0)}</div>
    </td>
  );
}
function 選択肢を読む(set: (o: Opts) => void) {
  api.get<Opts>("/api/seizo/opts").then(set, エラー);
}

/**
 * 包装日誌登録（Access の FM_生産登録・FM_他工場 生産登録）。入庫日（包装日）と工場で絞った入庫に、袋総枚数（計量元数）などを入れる。
 * 袋総枚数からケース・kg・箱詰枚数・半端枚数を出し、ケースを変えたものは［登録］で出荷に知らせる。いただいた画面と同じ項目の並び。
 */
export function SeizoHoso() {
  const nav = useNavigate();
  const [sp] = useSearchParams();
  const 他 = Number(sp.get("soko") ?? 11) !== 11;
  const [日, set日] = useState(sp.get("date") ?? today());
  const [倉庫, set倉庫] = useState(Number(sp.get("soko") ?? 11));
  const [rows, setRows] = useState<Rec[]>([]);
  const [opts, setOpts] = useState<Opts>(空の選択肢);
  const [未包装, set未包装] = useState<Rec[] | null>(null);

  async function 読む(d = 日, s = 倉庫) {
    try {
      setRows(await api.get<Rec[]>("/api/seizo/hoso", { date: d, soko: s }));
    } catch (e) {
      エラー(e);
    }
  }
  useEffect(() => {
    読む(日, 倉庫);
  }, [日, 倉庫]);
  useEffect(() => 選択肢を読む(setOpts), []);

  async function 直す(r: Rec, 項目: string, 値: unknown) {
    try {
      if (項目 === "未包装枚数" || 項目 === "未包装kg") {
        if (!r.chk && n(値) !== 0 && !confirm(`${値}${項目 === "未包装枚数" ? "枚" : "Kg"}を未包装として登録します、よろしいですか？`)) return 読む();
        await api.post("/api/seizo/mihoso", { 入庫ID: r.入庫ID, 項目, 値: n(値) });
      } else {
        const res = await api.post<{ 知らせ: string[] }>("/api/seizo/save", { 入庫ID: r.入庫ID, 項目, 値, 画面: "hoso" });
        for (const m of res.知らせ ?? []) alert(m);
      }
      読む();
    } catch (e) {
      エラー(e);
    }
  }
  async function 登録() {
    try {
      const r = await api.post<{ 件数: number }>("/api/seizo/touroku", {});
      if (r.件数) alert(`${r.件数} 件の変更を出荷に通知しました。`);
      読む();
    } catch (e) {
      エラー(e);
    }
  }
  async function 閉じる() {
    if (!他) {
      const r = await api.get<{ 件数: number }>("/api/seizo/miteiroku").catch(() => ({ 件数: 0 }));
      if (r.件数) return alert("登録が完了していません。登録ボタンをクリックしてください。");
    }
    nav(-1);
  }
  const 計 = (k: string) => rows.reduce((a, r) => a + Number(r[k] ?? 0), 0);
  const P = { 直す };

  return (
    <div className="sz">
      <div className="sz-top">
        <日付の欄 題="入庫日" value={日} onChange={set日} />
        <工場選択 list={他 ? 他工場 : [{ id: 11, name: "丸北" }]} value={倉庫} onChange={set倉庫} />
        <div className="sz-top-btns">
          <button onClick={閉じる}>閉じる</button>
          <button className="blue" onClick={登録}>登録</button>
          <button className="orange" onClick={async () => set未包装(await api.get<Rec[]>("/api/seizo/mihoso").catch((e) => (エラー(e), null)))}>未包装読込</button>
        </div>
      </div>
      <div className="sz-list">
        <table className="sz-grid">
          <thead>
            <tr>
              <th>ﾁｪｯｸ</th><th>製造日</th><th>区分</th><th>隠語</th><th>コード</th><th>商品名</th><th>区<br />分</th><th>規格</th><th>入数</th>
              <th className="sz-3h">袋総枚数<br />箱詰枚数<br />半端枚数</th><th>ケース</th><th>商品kg</th><th className="or">未包装<br />枚数</th>
              <th>コード</th><th>原料</th><th>原料kg</th><th>備考</th><th>検査区分</th><th>特定産地</th><th title="包装の開始・終了の時刻（8:15 のように）。包装時間の集計に使います">開始<br />時刻</th><th>終了<br />時刻</th><th />
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && <tr><td colSpan={22} className="c none">この入庫日の入庫はありません</td></tr>}
            {rows.map((r) => (
              <tr key={r.入庫ID} className={r.chk ? "done" : ""}>
                <td className="c">
                  <button className={"sz-check" + (n(r.数量確定フラグ) !== 0 ? " on" : "")} title="数量確認済み" onClick={() => 直す(r, "数量確定フラグ", n(r.数量確定フラグ) !== 0 ? 0 : -1)}>
                    {n(r.数量確定フラグ) !== 0 ? "済" : ""}
                  </button>
                </td>
                <欄 {...P} r={r} k="製造日" kind="date" w={8} cls="blue-t" />
                <td><選ぶ {...P} r={r} k="商品区分" opts={opts.商品区分} num w={80} /></td>
                <td><選ぶ {...P} r={r} k="商品状態隠語" opts={opts.商品状態.map((o) => ({ id: o.id, name: String(o.id) }))} w={44} /></td>
                <欄 {...P} r={r} k="商品コード" kind="num" kyotsu="shohin" w={5} />
                <td className="name">{r.商品名}</td>
                <欄 {...P} r={r} k="タグ" w={3} />
                <td className="c">{r.規格}</td>
                <td className="r">{r.入数}</td>
                <三段 r={r} 直す={直す} />
                <欄 {...P} r={r} k="ケース" kind="num" w={5} />
                <td className="r">{num(r.商品kg)}</td>
                <欄 {...P} r={r} k="未包装枚数" kind="num" w={4} />
                <欄 {...P} r={r} k="原料コード" kind="num" kyotsu="shohin" w={5} />
                <td className="small">{r.原料}</td>
                <欄 {...P} r={r} k="原料kg" kind="num" w={5} />
                <欄 {...P} r={r} k="備考" w={10} />
                <欄 {...P} r={r} k="検査区分" w={6} />
                <td><選ぶ {...P} r={r} k="産地コード" opts={opts.産地} num w={80} /></td>
                <欄 {...P} r={r} k="作業開始時間" w={4} />
                <欄 {...P} r={r} k="作業終了時間" w={4} />
                <td className="c small">{r.chk ? "登録済み" : r.ユーザーchk ? "未登録" : ""}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <td colSpan={10} className="r sz-sum-lbl">合計</td>
              <td className="r">{num(計("ケース"))}</td>
              <td className="r">{num(計("商品kg"))}</td>
              <td colSpan={10} />
            </tr>
          </tfoot>
        </table>
      </div>
      {未包装 && <未包装の画面 rows={未包装} 日={日} onClose={(読み直す) => (set未包装(null), 読み直す && 読む())} />}
    </div>
  );
}

/**
 * 他工場 計量日誌登録（Access の FM_計量数登録）。製造日と工場（えんゆう・ふらの・遠軽食品）で絞った入庫に、袋総枚数などを入れる。
 * 袋総枚数からケース・kg・箱詰枚数・半端枚数を出し、ケースが変わったら出荷に「数量訂正」を知らせる。
 */
export function SeizoTako() {
  const nav = useNavigate();
  const [sp] = useSearchParams();
  const [日, set日] = useState(sp.get("date") ?? today());
  const [倉庫, set倉庫] = useState(191);
  const [rows, setRows] = useState<Rec[]>([]);
  const [opts, setOpts] = useState<Opts>(空の選択肢);
  async function 読む(d = 日, s = 倉庫) {
    try {
      setRows(await api.get<Rec[]>("/api/seizo/tako", { date: d, soko: s }));
    } catch (e) {
      エラー(e);
    }
  }
  useEffect(() => {
    読む(日, 倉庫);
  }, [日, 倉庫]);
  useEffect(() => 選択肢を読む(setOpts), []);
  async function 直す(r: Rec, 項目: string, 値: unknown) {
    try {
      if (項目 === "未包装kg") {
        if (!r.chk && n(値) !== 0 && !confirm(`${値}Kgを未包装として登録します、よろしいですか？`)) return 読む();
        await api.post("/api/seizo/mihoso", { 入庫ID: r.入庫ID, 項目, 値: n(値) });
      } else {
        const res = await api.post<{ 知らせ: string[] }>("/api/seizo/save", { 入庫ID: r.入庫ID, 項目, 値, 画面: "tako" });
        for (const m of res.知らせ ?? []) alert(m);
      }
      読む();
    } catch (e) {
      エラー(e);
    }
  }
  const P = { 直す };
  const 計 = (k: string) => rows.reduce((a, r) => a + Number(r[k] ?? 0), 0);
  return (
    <div className="sz">
      <div className="sz-top">
        <日付の欄 題="入庫日" value={日} onChange={set日} />
        <工場選択 list={他工場} value={倉庫} onChange={set倉庫} />
        <div className="sz-top-btns">
          <button onClick={() => nav(-1)}>閉じる</button>
        </div>
      </div>
      <div className="sz-list">
        <table className="sz-grid">
          <thead>
            <tr>
              <th>包装日</th><th>製造日</th><th>区分</th><th>コード</th><th>商品名</th><th>規格</th><th>入数</th>
              <th className="sz-3h">袋総枚数<br />箱詰枚数<br />半端枚数</th><th>ケース</th><th>商品kg</th><th className="or">未包装kg</th><th>備考</th><th>No</th><th>札の色</th><th>カード</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && <tr><td colSpan={15} className="c none">この日の入庫はありません</td></tr>}
            {rows.map((r) => (
              <tr key={r.入庫ID} className={r.chk ? "done" : ""}>
                <欄 {...P} r={r} k="入庫日" kind="date" w={8} />
                <td className="c gray">{短い日(r.製造日)}</td>
                <td><選ぶ {...P} r={r} k="商品区分" opts={opts.商品区分} num w={80} /></td>
                <欄 {...P} r={r} k="商品コード" kind="num" kyotsu="shohin" w={5} />
                <td className="name">{r.商品名}</td>
                <td className="c">{r.規格}</td>
                <td className="r">{r.入数}</td>
                <三段 r={r} 直す={直す} />
                <欄 {...P} r={r} k="ケース" kind="num" w={5} />
                <td className="r">{num(r.商品kg)}</td>
                <欄 {...P} r={r} k="未包装kg" kind="num" w={5} />
                <欄 {...P} r={r} k="備考" w={10} />
                <欄 {...P} r={r} k="タグ" w={3} />
                <td><選ぶ {...P} r={r} k="カードカラーコード" opts={opts.札色} num w={60} /></td>
                <td className="nowrap">
                  <入力 {...P} r={r} k="開始No" kind="num" w={4} />
                  <入力 {...P} r={r} k="終了No" kind="num" w={4} />
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <td colSpan={8} className="r sz-sum-lbl">合計</td>
              <td className="r">{num(計("ケース"))}</td>
              <td className="r">{num(計("商品kg"))}</td>
              <td colSpan={5} />
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}

/**
 * 計量枚数登録（Access の FM_出来高登録）。メニューの日を製造日として、丸北の商品（作業場ごと）を選び、区分ごとに袋総枚数を入れる。
 * 袋総枚数からケース・箱詰枚数・再生枚数を出し、計画元数があれば最後の区分で合計を合わせる。［登録］で変わったものを出荷に知らせて閉じる。
 */
export function SeizoDekidaka() {
  const nav = useNavigate();
  const [sp] = useSearchParams();
  const 製造日 = sp.get("date") ?? today();
  const 倉庫 = 11;
  const [商品一覧, set商品一覧] = useState<Rec[]>([]);
  const [選択, set選択] = useState<Rec | null>(null);
  const [data, setData] = useState<{ rows: Rec[]; 計画元数: number | null }>({ rows: [], 計画元数: null });
  const [opts, setOpts] = useState<Opts>(空の選択肢);
  useEffect(() => 選択肢を読む(setOpts), []);
  useEffect(() => {
    api
      .get<Rec[]>("/api/seizo/dekidaka/shohin", { seizo: 製造日, soko: 倉庫 })
      .then((l) => {
        set商品一覧(l);
        if (!l.length) {
          alert(`${製造日.replace(/-/g, "/")} は製造する商品が存在しません。`);
          nav(-1);
        }
        set選択(l[0] ?? null);
      })
      .catch(エラー);
  }, [製造日]);
  async function 読む(s = 選択) {
    if (!s) return setData({ rows: [], 計画元数: null });
    try {
      setData(await api.get("/api/seizo/dekidaka", { seizo: s.製造日, soko: 倉庫, shohin: s.商品コード, sagyo: s.作業場 ?? "", menu: 製造日 }));
    } catch (e) {
      エラー(e);
    }
  }
  useEffect(() => {
    読む(選択);
  }, [選択]);

  async function 直す(r: Rec, 項目: string, 値: unknown) {
    if (!選択) return;
    try {
      const res = await api.post<{ 知らせ: string[] }>("/api/seizo/save", {
        入庫ID: r.入庫ID, 項目, 値, 画面: "dekidaka", 製造日: 選択.製造日, 入庫日: 選択.入庫日, 計画元数: data.計画元数, 作業場: 選択.作業場, 工場: 倉庫,
      });
      for (const m of res.知らせ ?? []) alert(m);
      読む();
    } catch (e) {
      エラー(e);
    }
  }
  async function 区分(種類: "add" | "del") {
    if (!選択) return;
    const 本体 = { 商品コード: 選択.商品コード, 製造日: 選択.製造日, 入庫日: 選択.入庫日, 作業場: 選択.作業場, 工場: 倉庫 };
    try {
      if (種類 === "add") await api.post("/api/seizo/dekidaka/kubun-add", 本体);
      else {
        const r = await api.post<{ タグ: string | null }>("/api/seizo/dekidaka/kubun-del", 本体);
        if (r.タグ !== null && confirm(`${r.タグ} 区分の削除を行います、よろしいですか？`)) {
          const d = await api.post<{ 知らせ: string[] }>("/api/seizo/dekidaka/kubun-del", { ...本体, 確認: true });
          for (const m of d.知らせ ?? []) alert(m);
        }
      }
      読む();
    } catch (e) {
      エラー(e);
    }
  }
  async function 登録して閉じる() {
    try {
      const r = await api.post<{ 件数: number }>("/api/seizo/touroku", {});
      alert(`${r.件数} 件の変更を出荷に通知しました。`);
      nav(-1);
    } catch (e) {
      エラー(e);
    }
  }
  const P = { 直す };
  const rows = data.rows;
  const 計 = (k: string) => rows.reduce((a, r) => a + Number(r[k] ?? 0), 0);
  return (
    <div className="sz dk">
      <div className="sz-top">
        <工場選択 list={[{ id: 11, name: "丸北" }]} value={11} onChange={() => {}} />
        <div className="sz-top-btns">
          <button className="blue" onClick={() => 区分("add")}>区分の追加</button>
          <button className="red" onClick={() => 区分("del")}>区分の削除</button>
          <button onClick={登録して閉じる}>登録</button>
        </div>
      </div>
      <div className="dk-head">
        <div className="dk-box"><div className="dk-l">包装予定日</div><div className="dk-v">{選択?.入庫日?.replace(/-/g, "/") ?? ""}</div></div>
        <div className="dk-box"><div className="dk-l">製造日</div><div className="dk-v">{選択?.製造日?.replace(/-/g, "/") ?? 製造日.replace(/-/g, "/")}</div></div>
        <div className="dk-box"><div className="dk-l">コード</div>
          <select className="dk-sel" value={選択 ? `${選択.商品コード}|${選択.作業場 ?? ""}` : ""} onChange={(e) => set選択(商品一覧.find((x) => `${x.商品コード}|${x.作業場 ?? ""}` === e.target.value) ?? null)}>
            {商品一覧.map((x) => <option key={`${x.商品コード}|${x.作業場 ?? ""}`} value={`${x.商品コード}|${x.作業場 ?? ""}`}>{x.商品コード}　{x.商品名}　{x.作業場 ?? ""}</option>)}
          </select>
        </div>
        <div className="dk-box wide"><div className="dk-l">商品名</div><div className="dk-v left">{選択?.商品名 ?? ""}</div></div>
        <div className="dk-box"><div className="dk-l">工場</div><div className="dk-v left">{選択?.作業場 ?? ""}</div></div>
      </div>
      <div className="dk-sums">
        <span className="dk-kei">計</span>
        <div className="dk-s"><div className="dk-sl">袋総枚数計</div><div className="dk-sv">{num(計("計量元数"))}</div></div>
        <div className="dk-s"><div className="dk-sl">箱詰枚数計</div><div className="dk-sv blue-t">{num(計("箱詰枚数"))}</div></div>
        <div className="dk-s gap"><div className="dk-sl">半端計</div><div className="dk-sv red-t">{num(計("再生枚数"))}</div></div>
        <div className="dk-s"><div className="dk-sl">合わせ計</div><div className="dk-sv purple-t">{num(計("箱詰め数合わせ"))}</div></div>
        <div className="dk-s"><div className="dk-sl">ケース計</div><div className="dk-sv">{num(計("ケース"))}</div></div>
        <div className="dk-s"><div className="dk-sl">計画元数</div>
          <Field
            value={data.計画元数}
            kind="num"
            className="dk-plan"
            onCommit={async (v) => {
              if (!選択) return;
              await api.post("/api/seizo/dekidaka/keikaku", { 商品コード: 選択.商品コード, 製造日, 値: Number(v) }).catch(エラー);
              読む();
            }}
          />
        </div>
        <div className="dk-s gap"><div className="dk-sl">商品kg計</div><div className="dk-sv">{num(計("商品kg"))}</div></div>
      </div>
      <div className="sz-list">
        <table className="sz-grid dk-grid">
          <thead>
            <tr>
              <th>包装日</th><th>No</th><th>商品区分</th><th>カード色</th><th>カード区分</th><th>工場</th><th>袋総枚数</th><th>箱詰枚数</th>
              <th className="red-h">再生枚数</th><th className="red-h">合わせ</th><th>ケース</th><th>確認済</th><th>商品kg</th><th>在庫備考</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.入庫ID} className={r.chk ? "done" : ""}>
                <td className="c">{r.入庫日?.replace(/-/g, "/")}</td>
                <欄 {...P} r={r} k="タグ" w={3} cls="c" />
                <td><選ぶ {...P} r={r} k="商品区分" opts={opts.商品区分} num w={90} /></td>
                <td><選ぶ {...P} r={r} k="カードカラーコード" opts={opts.札色} num w={60} /></td>
                <td className="nowrap"><入力 {...P} r={r} k="開始No" kind="num" w={4} />～<入力 {...P} r={r} k="終了No" kind="num" w={4} /></td>
                <td><選ぶ {...P} r={r} k="作業場" opts={opts.作業場} w={70} /></td>
                <欄 {...P} r={r} k="計量元数" kind="num" w={5} />
                <欄 {...P} r={r} k="箱詰枚数" kind="num" w={5} />
                <td className="r red-t">{num(r.再生枚数 ?? 0)}</td>
                <td className="r purple-t">{num(r.箱詰め数合わせ ?? 0)}</td>
                <欄 {...P} r={r} k="ケース" kind="num" w={5} />
                <td className="c">
                  <button className={"sz-check" + (r.出来高入力chk ? " on" : "")} onClick={() => 直す(r, "出来高入力chk", !r.出来高入力chk)}>{r.出来高入力chk ? "済み" : ""}</button>
                </td>
                <td className="r">{num(r.商品kg)}{n(r.数量確定フラグ) !== 0 && <div className="dk-ok">確認済み</div>}</td>
                <欄 {...P} r={r} k="管理備考" w={12} />
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}


/** 未包装更新（FSD_未包装更新）：未包装の入庫を選び、いまの包装日にする */
function 未包装の画面(props: { rows: Rec[]; 日: string; onClose: (読み直す: boolean) => void }) {
  const [選んだ, set選んだ] = useState<Set<number>>(new Set());
  async function 決める() {
    try {
      const r = await api.post<{ 件数: number }>("/api/seizo/mihoso/set", { ids: [...選んだ], 入庫日: props.日 });
      if (r.件数) alert(`変更により、出荷計画に${r.件数} 件の変更通知を送ります。`);
      props.onClose(true);
    } catch (e) {
      エラー(e);
    }
  }
  return (
    <div className="modal" onClick={() => props.onClose(false)}>
      <div className="sz-dialog" onClick={(e) => e.stopPropagation()}>
        <div className="sz-dtitle">未包装の読み込み（{曜日付き(props.日)} に包装したものに印を付けてください）</div>
        <table className="sz-grid">
          <thead><tr><th /><th>コード</th><th>商品名</th><th>製造日</th><th>タグ</th><th>ケース</th><th>商品kg</th><th>備考</th></tr></thead>
          <tbody>
            {props.rows.length === 0 && <tr><td colSpan={8} className="c none">未包装のものはありません</td></tr>}
            {props.rows.map((r) => (
              <tr key={r.入庫ID}>
                <td className="c"><input type="checkbox" checked={選んだ.has(r.入庫ID)} onChange={(e) => set選んだ((s) => { const x = new Set(s); e.target.checked ? x.add(r.入庫ID) : x.delete(r.入庫ID); return x; })} /></td>
                <td className="r">{r.商品コード}</td><td>{r.商品名}</td><td>{短い日(r.製造日)}</td><td className="c">{r.タグ}</td>
                <td className="r">{num(r.ケース)}</td><td className="r">{num(r.商品kg)}</td><td>{r.備考}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="sz-dbtns">
          <button className="navy" disabled={!選んだ.size} onClick={決める}>この包装日にする</button>
          <button onClick={() => props.onClose(false)}>キャンセル</button>
        </div>
      </div>
    </div>
  );
}


/**
 * 包装予定追加（Access の FSD_生産予定入力）。製造日の入庫予定を見て、足す・直す・消す。
 * 商品・出荷元を選ぶと包装日（製造日の翌日。土曜は翌々日、ふらのは翌日）と賞味期限が入る。出荷止めを付けると出荷に知らせる。
 */
export function SeizoYotei() {
  const nav = useNavigate();
  const [sp] = useSearchParams();
  const [日, set日] = useState(sp.get("date") ?? today());
  const [rows, setRows] = useState<Rec[]>([]);
  async function 読む(d = 日) {
    try {
      setRows(await api.get<Rec[]>("/api/seizo/yotei", { date: d }));
    } catch (e) {
      エラー(e);
    }
  }
  useEffect(() => {
    読む(日);
  }, [日]);
  async function 直す(r: Rec, 項目: string, 値: unknown) {
    try {
      const res = await api.post<{ 知らせ: string[] }>("/api/seizo/save", { 入庫ID: r.入庫ID, 項目, 値, 画面: "yotei", 製造日: 日 });
      for (const m of res.知らせ ?? []) alert(m);
      読む();
    } catch (e) {
      エラー(e);
    }
  }
  const P = { 直す };
  return (
    <div className="sz">
      <div className="sz-head">
        <div className="sz-title">包装予定追加</div>
        <日付の欄 題="製造日" value={日} onChange={set日} />
        <span className="sz-btns">
          <button onClick={async () => { await api.post("/api/seizo/yotei/new", { 製造日: 日 }).catch(エラー); 読む(); }}>新しい行</button>
          <button onClick={() => nav(-1)}>閉じる</button>
        </span>
      </div>
      <div className="sz-list">
        <table className="sz-grid">
          <thead>
            <tr><th>出荷元</th><th>倉庫名</th><th>コード</th><th>商品名</th><th>規格</th><th>入数</th><th>作業場</th><th>原料コード</th><th>ケース</th><th>商品kg</th><th>包装日</th><th>賞味期限</th><th>タグ</th><th>出荷止め</th><th /></tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.入庫ID} className={r.chk ? "done" : ""}>
                <欄 {...P} r={r} k="倉庫ID" kind="num" kyotsu="tokui" w={4} />
                <td className="small">{r.倉庫名}</td>
                <欄 {...P} r={r} k="商品コード" kind="num" kyotsu="shohin" w={5} />
                <td className="name">{r.商品名}</td>
                <td className="small">{r.規格}</td>
                <td className="r">{r.入数}</td>
                <欄 {...P} r={r} k="作業場" w={5} />
                <欄 {...P} r={r} k="原料コード" kind="num" kyotsu="shohin" w={5} />
                <欄 {...P} r={r} k="ケース" kind="num" w={5} />
                <欄 {...P} r={r} k="商品kg" kind="num" w={6} />
                <欄 {...P} r={r} k="入庫日" kind="date" w={8} />
                <td className="c">{短い日(r.賞味期限)}</td>
                <欄 {...P} r={r} k="タグ" w={3} />
                <td className="c">
                  <input
                    type="checkbox"
                    checked={!!r.出荷止め}
                    onChange={async (e) => {
                      if (!e.target.checked) return 直す(r, "出荷止め", false);
                      if (!confirm("出荷止めをかけますがよろしいですか？")) return;
                      const res = await api.post<{ 知らせ: string[] }>("/api/seizo/yotei/tome", { 入庫ID: r.入庫ID }).catch((x) => (エラー(x), null));
                      for (const m of res?.知らせ ?? []) alert(m);
                      読む();
                    }}
                  />
                </td>
                <td>
                  <button
                    onClick={async () => {
                      if (!confirm(`${r.商品名 ?? ""} を削除しますがよろしいですか？`)) return;
                      await api.post("/api/seizo/yotei/delete", { 入庫ID: r.入庫ID }).catch(エラー);
                      読む();
                    }}
                  >
                    消す
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/**
 * 検索（Access の F_取引先商品製造一覧）。工場・取引先・商品・製造日で、生産履歴（製造日ごとのケース・kg）か出荷履歴（出荷日でも絞る）を出す。
 * ［表示］で一覧、［出力］で Excel。
 */
export function SeizoKensaku() {
  const nav = useNavigate();
  const [種類, set種類] = useState<"seisan" | "shukka">("seisan");
  const [c, setC] = useState<Record<string, string>>({ f: "", t: "", s1: "", s2: "" });
  const [opts, setOpts] = useState<{ 工場: Opt[]; 得意先: Opt[] }>({ 工場: [], 得意先: [] });
  const [商品, set商品] = useState<Opt[]>([]);
  const [rows, setRows] = useState<Rec[] | null>(null);
  useEffect(() => {
    api.get<typeof opts>("/api/seizo/kensaku/opts").then(setOpts, エラー);
  }, []);
  useEffect(() => {
    api.get<Opt[]>("/api/seizo/kensaku/shohin", { tokui: c.tokui ?? "" }).then(set商品, エラー);
  }, [c.tokui]);
  const 条件 = () => ({ type: 種類 === "shukka" ? "shukka" : "seisan", ...Object.fromEntries(Object.entries(c).filter(([, v]) => v)) });
  const 選ぶ = (題: string, k: string, list: Opt[]) => (
    <label className="sz-k">
      <span className="lbl">{題}</span>
      <select value={c[k] ?? ""} onChange={(e) => setC((x) => ({ ...x, [k]: e.target.value }))}>
        <option value="">（すべて）</option>
        {list.map((o) => <option key={o.id} value={o.id}>{o.id}　{o.name}</option>)}
      </select>
    </label>
  );
  const 日 = (題: string, k1: string, k2: string) => (
    <label className="sz-k">
      <span className="lbl">{題}</span>
      <Field kind="date" value={c[k1]} className="sz-d" onCommit={(v) => setC((x) => ({ ...x, [k1]: 日付に(v) }))} />
      <span>～</span>
      <Field kind="date" value={c[k2]} className="sz-d" onCommit={(v) => setC((x) => ({ ...x, [k2]: 日付に(v) }))} />
    </label>
  );
  const 列 = 種類 === "shukka"
    ? ["出荷日", "倉庫名", "商品コード", "商品名", "ケース", "商品kg", "届け先", "製造日", "賞味期限", "納品日", "運送会社名", "車番", "取引先名"]
    : ["倉庫ID", "製造日", "商品コード", "商品名", "ケース", "商品kg", "取引先ID", "取引先名"];
  const 数 = new Set(["ケース", "商品kg"]);
  return (
    <div className="sz">
      <div className="sz-head">
        <div className="sz-title">取引先商品製造一覧</div>
        <span className="sz-toggle">
          <button className={種類 === "seisan" ? "on" : ""} onClick={() => (set種類("seisan"), setRows(null))}>生産履歴</button>
          <button className={種類 === "shukka" ? "on" : ""} onClick={() => (set種類("shukka"), setRows(null))}>出荷履歴</button>
        </span>
        <span className="sz-btns">
          <button className="navy" onClick={async () => setRows(await api.get<Rec[]>("/api/seizo/kensaku", 条件()).catch((e) => (エラー(e), null)))}>表示</button>
          <button onClick={() => Excelを受け取る("/api/seizo/kensaku?" + new URLSearchParams({ ...条件(), excel: "1" }).toString(), "履歴.xlsx").catch(エラー)}>出力</button>
          <button onClick={() => (setC({ f: "", t: "", s1: "", s2: "" }), setRows(null))}>クリア</button>
          <button onClick={() => nav(-1)}>閉じる</button>
        </span>
      </div>
      <div className="sz-cond">
        {選ぶ("工場", "soko", opts.工場)}
        {選ぶ("得意先", "tokui", opts.得意先)}
        {選ぶ("商品", "shohin", 商品)}
        {日("製造日", "f", "t")}
        {種類 === "shukka" && 日("出荷日", "s1", "s2")}
      </div>
      {rows && (
        <div className="sz-list">
          <table className="sz-grid">
            <thead><tr>{列.map((k) => <th key={k}>{k}</th>)}</tr></thead>
            <tbody>
              {rows.map((r, i) => <tr key={i}>{列.map((k) => <td key={k} className={数.has(k) ? "r" : ""}>{数.has(k) ? num(r[k]) : k.endsWith("日") || k === "賞味期限" ? 短い日(r[k]) : r[k]}</td>)}</tr>)}
            </tbody>
            <tfoot>
              <tr>{列.map((k, i) => <td key={k} className="r">{数.has(k) ? num(rows.reduce((a, r) => a + Number(r[k] ?? 0), 0)) : i === 0 ? `${rows.length} 件` : ""}</td>)}</tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  );
}

/**
 * 包装時間の集計（Web 版で足したもの）。包装日誌登録に入れた包装の開始・終了の時刻から、商品ごとに
 * 回数・平均の開始と終了・平均の作業時間・1 ケースあたりの時間を出す。包装場の包装時間登録（過去の分）も足せる。
 */
export function SeizoJikan() {
  const nav = useNavigate();
  const 年前 = new Date(Date.parse(today() + "T00:00:00Z") - 365 * 86400000).toISOString().slice(0, 10);
  const [c, setC] = useState<Record<string, string>>({ from: 年前, to: today(), soko: "0", kako: "" });
  const [opts, setOpts] = useState<{ 工場: Opt[] }>({ 工場: [] });
  const [rows, setRows] = useState<Rec[] | null>(null);
  const [開く, set開く] = useState<number | null>(null);
  useEffect(() => {
    api.get<{ 工場: Opt[] }>("/api/seizo/kensaku/opts").then(setOpts, エラー);
  }, []);
  async function 表示() {
    set開く(null);
    setRows(await api.get<Rec[]>("/api/seizo/jikan", c).catch((e) => (エラー(e), null)));
  }
  const 字 = (v: unknown) => (v === null || v === undefined ? "" : String(v));
  return (
    <div className="sz">
      <div className="sz-head">
        <div className="sz-title">包装時間の集計</div>
        <span className="sz-btns">
          <button className="navy" onClick={表示}>表示</button>
          <button onClick={() => Excelを受け取る("/api/seizo/jikan?" + new URLSearchParams({ ...c, excel: "1" }).toString(), "包装時間の集計.xlsx").catch(エラー)}>出力</button>
          <button onClick={() => nav(-1)}>閉じる</button>
        </span>
      </div>
      <div className="sz-cond">
        <label className="sz-k">
          <span className="lbl">工場</span>
          <select value={c.soko} onChange={(e) => setC((x) => ({ ...x, soko: e.target.value }))}>
            <option value="0">（すべて）</option>
            {opts.工場.map((o) => <option key={o.id} value={o.id}>{o.id}　{o.name}</option>)}
          </select>
        </label>
        <label className="sz-k">
          <span className="lbl">包装日</span>
          <Field kind="date" value={c.from} className="sz-d" onCommit={(v) => setC((x) => ({ ...x, from: 日付に(v) }))} />
          <span>～</span>
          <Field kind="date" value={c.to} className="sz-d" onCommit={(v) => setC((x) => ({ ...x, to: 日付に(v) }))} />
        </label>
        <label className="sz-k">
          <input type="checkbox" checked={c.kako === "1"} onChange={(e) => setC((x) => ({ ...x, kako: e.target.checked ? "1" : "" }))} />
          <span>包装場の包装時間登録（過去の分）も入れる</span>
        </label>
      </div>
      <div className="sz-note">
        包装日誌登録の「開始時刻」「終了時刻」に入れた分を集めます。作業時間は 終了−開始（時刻の無い過去の分は実働時間分）。1ケースあたりは、作業時間の合計 ÷ ケースの合計です。行を押すと 1 回ごとの明細を出します。
      </div>
      {rows && (
        <div className="sz-list">
          <table className="sz-grid">
            <thead>
              <tr><th>コード</th><th>商品名</th><th>回数</th><th>最初の日</th><th>最後の日</th><th>平均の開始</th><th>平均の終了</th><th>平均の作業時間（分）</th><th>平均のケース</th><th>1ケースあたり（秒）</th></tr>
            </thead>
            <tbody>
              {rows.length === 0 && <tr><td colSpan={10} className="c none">この期間に時刻の入った包装はありません</td></tr>}
              {rows.flatMap((r) => [
                <tr key={r.商品コード} className={開く === r.商品コード ? "sel" : ""} onClick={() => set開く(開く === r.商品コード ? null : r.商品コード)}>
                  <td className="r">{r.商品コード}</td><td className="name">{r.商品名}</td><td className="r">{r.回数}</td><td>{短い日(r.最初)}</td><td>{短い日(r.最後)}</td>
                  <td className="c">{r.平均開始}</td><td className="c">{r.平均終了}</td><td className="r">{字(r.平均作業分)}</td><td className="r">{num(r.平均ケース)}</td><td className="r">{字(r.ケースあたり秒)}</td>
                </tr>,
                ...(開く === r.商品コード
                  ? r.明細.map((x: Rec, i: number) => (
                      <tr key={r.商品コード + "-" + i}>
                        <td /><td className="small">{x.元}・{x.倉庫名}</td><td /><td>{短い日(x.日)}</td><td /><td className="c">{x.開始}</td><td className="c">{x.終了}</td>
                        <td className="r">{字(x.作業分)}</td><td className="r">{num(x.ケース)}</td><td />
                      </tr>
                    ))
                  : []),
              ])}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
