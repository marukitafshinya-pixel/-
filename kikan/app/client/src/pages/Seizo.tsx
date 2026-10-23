import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { api, ApiError, num, 処理中 } from "../api";
import { Field, today } from "../formParts";

type Rec = Record<string, any>;
type Opt = { id: number | string; name: string };
const エラー = (e: unknown) => alert(e instanceof ApiError ? e.message : String(e));
const 日を足す = (v: string, k: number) => new Date(Date.parse(v + "T00:00:00Z") + k * 86400000).toISOString().slice(0, 10);
const 日付に = (v: string) => (v ? v.replace(/\//g, "-") : "");
const 曜日付き = (v: string) => (v ? `${v.replace(/-/g, "/")}（${"日月火水木金土"[new Date(v + "T00:00:00").getDay()]}）` : "");
const 短い日 = (v: string | null) => (v ? `${v.slice(2, 4)}/${v.slice(5, 7)}/${v.slice(8, 10)}` : "");
/** 包装日誌・他工場で選べる工場（Access のトグル） */
const 工場 = [
  { id: 11, name: "北海道" },
  { id: 1187, name: "えんゆう" },
  { id: 191, name: "ふらの" },
  { id: 1271, name: "遠軽" },
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

/** 日付の移動（◀ ▶・最初・最後・カレンダー） */
function 日付の欄(props: { 題: string; value: string; onChange: (v: string) => void }) {
  return (
    <div className="sz-date">
      <span className="lbl">{props.題}</span>
      <button onClick={() => props.onChange(日を足す(props.value, -1))} title="前の日">◀</button>
      <Field kind="date" value={props.value} className="sz-d" onCommit={(v) => v && props.onChange(日付に(v))} />
      <button onClick={() => props.onChange(日を足す(props.value, 1))} title="次の日">▶</button>
      <span className="sz-w">{曜日付き(props.value)}</span>
    </div>
  );
}

/**
 * 製造管理 丸北 のメニュー（Access の FM_メインメニュー）。包装日を選んで各画面を開く。
 */
export function SeizoMenu() {
  const nav = useNavigate();
  const [日, set日] = useState(today());
  return (
    <div className="sz">
      <div className="sz-title">製造管理　丸北</div>
      <div className="sz-box">
        <日付の欄 題="包装日" value={日} onChange={set日} />
        <div className="sz-menu">
          <button onClick={() => nav(`/seizo/hoso?date=${日}`)}>包装日誌登録</button>
          <button onClick={() => nav(`/seizo/dekidaka?date=${日}`)}>計量数登録</button>
          <button onClick={() => nav(`/seizo/yotei?date=${日}`)}>包装予定追加</button>
          <button onClick={() => nav(`/seizo/hoso?date=${日}&soko=191`)}>他工場 生産登録</button>
          <button onClick={() => nav("/seizo/kensaku")}>検索</button>
          <button onClick={() => nav("/")}>閉じる</button>
        </div>
      </div>
    </div>
  );
}

/** 一覧の 1 項目（数・文字・日付）。直したらサーバーで Access と同じ計算をして、一覧を読み直す */
function 欄(props: { r: Rec; k: string; kind?: "num" | "date" | "text"; w?: number; ro?: boolean; kyotsu?: "shohin" | "tokui"; 直す: (r: Rec, k: string, v: unknown) => void }) {
  const { r, k } = props;
  return (
    <td>
      <Field
        value={r[k]}
        kind={props.kind ?? "text"}
        kyotsu={props.kyotsu}
        readOnly={props.ro}
        className={"sz-in" + (props.w ? ` w${props.w}` : "")}
        onCommit={(v) => props.直す(r, k, props.kind === "num" ? (v.trim() === "" ? null : Number(v.replace(/,/g, ""))) : props.kind === "date" ? 日付に(v) || null : v)}
      />
    </td>
  );
}

/**
 * 包装日誌登録（Access の FM_生産登録）。包装日と工場で絞った入庫に、計量元数・開始No・終了No・ケースなどを入れる。
 * 計量元数からケース・kg・箱詰枚数・仕掛枚数を出し、ケースを変えたものは［登録］で出荷に知らせる。
 */
export function SeizoHoso() {
  const nav = useNavigate();
  const [sp] = useSearchParams();
  const [日, set日] = useState(sp.get("date") ?? today());
  const [倉庫, set倉庫] = useState(Number(sp.get("soko") ?? 11));
  const [rows, setRows] = useState<Rec[]>([]);
  const [opts, setOpts] = useState<{ 商品区分: Opt[]; 産地: Opt[]; 商品状態: Opt[] }>({ 商品区分: [], 産地: [], 商品状態: [] });
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
  useEffect(() => {
    api.get<typeof opts>("/api/seizo/opts").then(setOpts, エラー);
  }, []);

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
    const r = await api.get<{ 件数: number }>("/api/seizo/miteiroku").catch(() => ({ 件数: 0 }));
    if (r.件数) return alert("登録が完了していません。登録ボタンをクリックしてください。");
    nav(-1);
  }
  const 計 = (k: string) => rows.reduce((a, r) => a + Number(r[k] ?? 0), 0);
  const P = { 直す };

  return (
    <div className="sz">
      <div className="sz-head">
        <div className="sz-title">包装日誌登録</div>
        <日付の欄 題="包装日" value={日} onChange={set日} />
        <span className="sz-toggle">
          {工場.map((k) => <button key={k.id} className={倉庫 === k.id ? "on" : ""} onClick={() => set倉庫(k.id)}>{k.name}</button>)}
        </span>
        <span className="sz-btns">
          <button onClick={async () => set未包装(await api.get<Rec[]>("/api/seizo/mihoso").catch((e) => (エラー(e), null)))}>未包装の読み込み</button>
          <button className="navy" onClick={登録}>登録</button>
          <button onClick={() => Excelを受け取る(`/api/seizo/kensa-nippo?date=${rows[0]?.製造日 ?? 日}`, "検査日報.xlsx").catch(エラー)}>検査日報</button>
          <button disabled title="販盛のサイトへの入力は準備中です">販盛出力</button>
          <button onClick={閉じる}>閉じる</button>
        </span>
      </div>
      <div className="sz-list">
        <table className="sz-grid">
          <thead>
            <tr>
              <th>コード</th><th>商品名</th><th>規格</th><th>製造日</th><th>賞味期限</th><th>タグ</th><th>開始No</th><th>終了No</th><th>検査区分</th>
              <th>計量元数</th><th>箱詰枚数</th><th>仕掛枚数</th><th>ケース</th><th>商品kg</th><th>未包装枚数</th><th>段ボールID</th><th>原料</th><th>産地</th><th>状態</th>
              <th>商品区分</th><th>備考</th><th>数量確認済み</th><th />
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && <tr><td colSpan={23} className="c none">この包装日の入庫はありません</td></tr>}
            {rows.map((r) => (
              <tr key={r.入庫ID} className={r.chk ? "done" : ""}>
                <欄 {...P} r={r} k="商品コード" kind="num" kyotsu="shohin" w={5} />
                <td className="name">{r.商品名}</td>
                <td className="small">{r.規格}</td>
                <欄 {...P} r={r} k="製造日" kind="date" w={8} />
                <td className="c">{短い日(r.賞味期限)}</td>
                <欄 {...P} r={r} k="タグ" w={3} />
                <欄 {...P} r={r} k="開始No" kind="num" w={4} />
                <欄 {...P} r={r} k="終了No" kind="num" w={4} />
                <td className="c">{r.検査区分}</td>
                <欄 {...P} r={r} k="計量元数" kind="num" w={5} />
                <欄 {...P} r={r} k="箱詰枚数" kind="num" w={5} />
                <td className="r">{num(r.仕掛枚数)}</td>
                <欄 {...P} r={r} k="ケース" kind="num" w={5} />
                <欄 {...P} r={r} k="商品kg" kind="num" w={6} />
                <欄 {...P} r={r} k="未包装枚数" kind="num" w={4} />
                <欄 {...P} r={r} k="段ボールID" kind="num" w={4} />
                <td className="small">{r.原料}</td>
                <td>
                  <select value={r.産地コード ?? ""} onChange={(e) => 直す(r, "産地コード", e.target.value === "" ? null : Number(e.target.value))}>
                    <option value="" />
                    {opts.産地.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
                  </select>
                </td>
                <td>
                  <select value={r.商品状態隠語 ?? ""} onChange={(e) => 直す(r, "商品状態隠語", e.target.value || null)}>
                    <option value="" />
                    {opts.商品状態.map((o) => <option key={o.id} value={o.id}>{o.id}</option>)}
                  </select>
                </td>
                <td>
                  <select value={r.商品区分 ?? ""} onChange={(e) => 直す(r, "商品区分", e.target.value === "" ? null : Number(e.target.value))}>
                    <option value="" />
                    {opts.商品区分.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
                  </select>
                </td>
                <欄 {...P} r={r} k="備考" w={8} />
                <td className="c">
                  <label className="sz-chk">
                    <input type="checkbox" checked={n(r.数量確定フラグ) !== 0} onChange={(e) => 直す(r, "数量確定フラグ", e.target.checked ? -1 : 0)} />
                  </label>
                </td>
                <td className="c small">{r.chk ? "登録済み" : r.ユーザーchk ? "未登録" : ""}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <td colSpan={12} className="r">合計</td>
              <td className="r">{num(計("ケース"))}</td>
              <td className="r">{num(計("商品kg"))}</td>
              <td colSpan={9} />
            </tr>
          </tfoot>
        </table>
      </div>
      {未包装 && <未包装の画面 rows={未包装} 日={日} onClose={(読み直す) => (set未包装(null), 読み直す && 読む())} />}
    </div>
  );
}
const n = (v: unknown) => Number(v ?? 0) || 0;

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
 * 計量数登録（Access の FM_出来高登録）。製造日・工場の商品を選び、区分ごとに計量元数を入れる。
 * 計量元数からケース・箱詰枚数・再生枚数を出し、計画元数があれば最後の区分で合計を合わせる。閉じるときに変わったものを出荷に知らせる。
 */
export function SeizoDekidaka() {
  const nav = useNavigate();
  const [sp] = useSearchParams();
  const メニューの日 = sp.get("date") ?? today();
  const 製造日 = メニューの日;
  const [倉庫, set倉庫] = useState(11);
  const [商品一覧, set商品一覧] = useState<Rec[]>([]);
  const [選択, set選択] = useState<Rec | null>(null);
  const [data, setData] = useState<{ rows: Rec[]; 計画元数: number | null }>({ rows: [], 計画元数: null });

  useEffect(() => {
    api
      .get<Rec[]>("/api/seizo/dekidaka/shohin", { seizo: 製造日, soko: 倉庫 })
      .then((l) => {
        set商品一覧(l);
        if (!l.length) alert(`${製造日.replace(/-/g, "/")} は製造する商品が存在しません。`);
        set選択(l[0] ?? null);
      })
      .catch(エラー);
  }, [製造日, 倉庫]);
  async function 読む(s = 選択) {
    if (!s) return setData({ rows: [], 計画元数: null });
    try {
      setData(await api.get("/api/seizo/dekidaka", { seizo: s.製造日, soko: 倉庫, shohin: s.商品コード, sagyo: s.作業場 ?? "", menu: メニューの日 }));
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
  async function 閉じる() {
    try {
      const r = await api.post<{ 件数: number }>("/api/seizo/touroku", {});
      alert(`${r.件数} 件の変更を出荷に通知しました。`);
      nav(-1);
    } catch (e) {
      エラー(e);
    }
  }
  const P = { 直す };
  const 計 = (k: string) => data.rows.reduce((a, r) => a + Number(r[k] ?? 0), 0);
  return (
    <div className="sz">
      <div className="sz-head">
        <div className="sz-title">計量数登録</div>
        <span className="sz-toggle">
          {工場.map((k) => <button key={k.id} className={倉庫 === k.id ? "on" : ""} onClick={() => set倉庫(k.id)}>{k.name}</button>)}
        </span>
        <span className="lbl">商品</span>
        <select
          value={選択 ? `${選択.商品コード}|${選択.作業場 ?? ""}` : ""}
          onChange={(e) => set選択(商品一覧.find((x) => `${x.商品コード}|${x.作業場 ?? ""}` === e.target.value) ?? null)}
        >
          {商品一覧.map((x) => <option key={`${x.商品コード}|${x.作業場 ?? ""}`} value={`${x.商品コード}|${x.作業場 ?? ""}`}>{x.商品コード}　{x.商品名}　{x.作業場 ?? ""}</option>)}
        </select>
        <span className="sz-info">製造日 {短い日(選択?.製造日 ?? null)}　包装日 {短い日(選択?.入庫日 ?? null)}</span>
        <span className="lbl">計画元数</span>
        <Field
          value={data.計画元数}
          kind="num"
          className="sz-in w5"
          onCommit={async (v) => {
            if (!選択) return;
            await api.post("/api/seizo/dekidaka/keikaku", { 商品コード: 選択.商品コード, 製造日: メニューの日, 値: Number(v) }).catch(エラー);
            読む();
          }}
        />
        <span className="sz-btns">
          <button onClick={() => 区分("add")}>区分の追加</button>
          <button onClick={() => 区分("del")}>区分の削除</button>
          <button onClick={() => Excelを受け取る(`/api/seizo/kensa-nippo?date=${製造日}`, "検査日報.xlsx").catch(エラー)}>検査日報</button>
          <button onClick={閉じる}>閉じる</button>
        </span>
      </div>
      <div className="sz-list">
        <table className="sz-grid">
          <thead>
            <tr><th>包装日</th><th>タグ</th><th>検体</th><th>開始No</th><th>終了No</th><th>検査区分</th><th>計量元数</th><th>箱詰枚数</th><th>再生枚数</th><th>ケース</th><th>商品kg</th><th>商品区分</th><th>管理備考</th><th /></tr>
          </thead>
          <tbody>
            {data.rows.map((r) => (
              <tr key={r.入庫ID} className={r.chk ? "done" : ""}>
                <td className="c">{短い日(r.入庫日)}</td>
                <欄 {...P} r={r} k="タグ" w={3} />
                <td className="c"><input type="checkbox" checked={!!r.検体区分} onChange={(e) => 直す(r, "検体区分", e.target.checked)} /></td>
                <欄 {...P} r={r} k="開始No" kind="num" w={4} />
                <欄 {...P} r={r} k="終了No" kind="num" w={4} />
                <td className="c">{r.検査区分}</td>
                <欄 {...P} r={r} k="計量元数" kind="num" w={5} />
                <欄 {...P} r={r} k="箱詰枚数" kind="num" w={5} />
                <td className="r">{num(r.再生枚数)}</td>
                <欄 {...P} r={r} k="ケース" kind="num" w={5} />
                <欄 {...P} r={r} k="商品kg" kind="num" w={6} />
                <td className="c">{r.商品区分}</td>
                <欄 {...P} r={r} k="管理備考" w={10} />
                <td className="c small">{r.chk ? "登録済み" : r.ユーザーchk ? "未登録" : ""}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr><td colSpan={9} className="r">合計</td><td className="r">{num(計("ケース"))}</td><td className="r">{num(計("商品kg"))}</td><td colSpan={3} /></tr>
          </tfoot>
        </table>
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
