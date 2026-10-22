import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { api, ApiError } from "../api";

// マスタ管理（Access の「Accessマスタ管理」：F_マスタ一覧・FM_商品マスタ・FM_商品登録・FM_得意先マスタ・FM_得意先登録）
type Rec = Record<string, any>;
type 選択肢 = { id: number; name: string; sub?: string };
const エラー = (e: unknown) => alert(e instanceof ApiError ? e.message : String(e));
const n = (v: unknown) => Number(v ?? 0) || 0;
const 日 = (v: unknown) => (v ? String(v).slice(0, 10).replace(/-/g, "/") : "");

/** 合言葉を聞いて確かめる（Access の InputBox と同じ。値はサーバーで確かめる） */
async function 合言葉を聞く(): Promise<string | null> {
  const pass = prompt("パスワードを入力してください。");
  if (pass === null) return null;
  try {
    await api.post("/api/mst/unlock", { pass });
    return pass;
  } catch (e) {
    エラー(e);
    return null;
  }
}

/** 半角カタカナにする（Access の StrConv(..., vbNarrow + vbKatakana)） */
function 半角カナ(v: string, ひらがなも = true): string {
  const 全 = "アイウエオカキクケコサシスセソタチツテトナニヌネノハヒフヘホマミムメモヤユヨラリルレロワヲンァィゥェォャュョッー";
  const 半 = "ｱｲｳｴｵｶｷｸｹｺｻｼｽｾｿﾀﾁﾂﾃﾄﾅﾆﾇﾈﾉﾊﾋﾌﾍﾎﾏﾐﾑﾒﾓﾔﾕﾖﾗﾘﾙﾚﾛﾜｦﾝｧｨｩｪｫｬｭｮｯｰ";
  const 濁 = "ガギグゲゴザジズゼゾダヂヅデドバビブベボ", 濁元 = "カキクケコサシスセソタチツテトハヒフヘホ";
  const 半濁 = "パピプペポ", 半濁元 = "ハヒフヘホ";
  const 一字 = (c: string) => { const i = 全.indexOf(c); return i >= 0 ? 半[i] : c; };
  let s = ひらがなも ? v.replace(/[ぁ-ゖ]/g, (c) => String.fromCharCode(c.charCodeAt(0) + 0x60)) : v;
  s = s.replace(/[！-～]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0)).replace(/　/g, " ");
  return [...s].map((c) => {
    const i = 濁.indexOf(c);
    if (i >= 0) return 一字(濁元[i]) + "ﾞ";
    const j = 半濁.indexOf(c);
    if (j >= 0) return 一字(半濁元[j]) + "ﾟ";
    if (c === "ヴ") return "ｳﾞ";
    return 一字(c);
  }).join("");
}
/** 半角にする（Access の StrConv(..., vbNarrow)：英数字・カタカナを半角に。ひらがなはそのまま） */
const 半角 = (v: string) => 半角カナ(v, false);

// ---------------- マスタ選択（F_マスタ一覧） ----------------
export function MasterMenu() {
  const nav = useNavigate();
  return (
    <div className="ms-menu">
      <div className="ms-title">マスタ選択</div>
      <button onClick={() => nav("/master/shohin")}>商品マスタ登録</button>
      <button onClick={() => nav("/master/tokui")}>得意先マスタ登録</button>
      <button onClick={() => nav("/master/unso")}>運送会社マスタ登録</button>
      <button className="close" onClick={() => nav("/")}>閉じる</button>
    </div>
  );
}

// ---------------- 商品マスタ一覧（FM_商品マスタ） ----------------
export function ShohinList() {
  const nav = useNavigate();
  const [検索, set検索] = useState("");
  const [rows, setRows] = useState<Rec[]>([]);
  const [選ぶ, set選ぶ] = useState<string | null>(null);
  const [グループ元, setグループ元] = useState<Rec[] | null>(null);
  const 読む = (q = 検索) => api.get<Rec[]>("/api/mst/shohin", { q }).then(setRows, エラー);
  useEffect(() => {
    読む("");
  }, []);

  async function 新規登録() {
    const pass = await 合言葉を聞く();
    if (!pass) return;
    set選ぶ(pass);
  }
  function コードで探す() {
    const v = prompt("商品コードか品名の一部を入れてください。");
    if (!v) return;
    const r = rows.find((x) => String(x.商品コード) === v.trim()) ?? rows.find((x) => String(x.商品名 ?? "").includes(v.trim()));
    if (!r) return alert("見つかりませんでした。");
    document.getElementById(`sm-${r.商品コード}`)?.scrollIntoView({ block: "center" });
    document.getElementById(`sm-${r.商品コード}`)?.classList.add("hit");
  }

  return (
    <div className="ms">
      <div className="ms-head">
        <div className="ms-name">商品マスタ登録</div>
        <label className="ms-box">
          <span>品名検索</span>
          <input value={検索} onChange={(e) => set検索(e.target.value)} onBlur={() => 読む()} onKeyDown={(e) => e.key === "Enter" && 読む()} />
        </label>
        <div className="ms-box"><span>件数</span><b>{rows.length}</b></div>
        <div className="ms-btns">
          <button onClick={新規登録}>新規登録</button>
          <button onClick={コードで探す}>検索</button>
          <button onClick={() => window.print()}>印刷</button>
          <button onClick={() => nav("/master")}>閉じる</button>
        </div>
      </div>
      <table className="ms-grid">
        <thead>
          <tr><th>詳細・編集</th><th>商品コード</th><th>大阪コード</th><th>分類</th><th>原料分類</th><th>カナ</th><th>品名</th><th>袋kg</th><th>箱枚数</th><th>主要取引先</th><th>賞味期限(年)</th><th>冷凍パン入数</th><th>製造工場</th><th>使用停止</th></tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.商品コード} id={`sm-${r.商品コード}`}>
              <td className="c"><button className="link" onClick={() => nav(`/master/shohin/${r.商品コード}`)}>詳細編集</button></td>
              <td className="r code">{r.商品コード}</td>
              <td className="c">{r.本社コード}</td>
              <td>{r.分類名}</td>
              <td>{r.原料分類}</td>
              <td className="c">{r.ｶﾅ分類}</td>
              <td className="name">{r.商品名}</td>
              <td className="r">{r.規格kg}</td>
              <td className="r">{r.規格枚数}</td>
              <td className="c small">{r.取引先名}</td>
              <td className="r">{r.品質保持期間}</td>
              <td className="r">{r.冷凍パン入数}</td>
              <td className="small">{r.製造場所}</td>
              <td className="c stop">{r.使用中止 ? "使用停止" : ""}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {選ぶ && (
        <div className="modal" onClick={() => set選ぶ(null)}>
          <div className="ms-dlg" onClick={(e) => e.stopPropagation()}>
            <div className="head">商品マスタの新規登録</div>
            <button onClick={() => nav("/master/shohin/new", { state: { pass: 選ぶ } })}>新規登録（新しい商品）</button>
            <button onClick={() => api.get<Rec[]>("/api/mst/shohin-group-src").then(setグループ元, エラー)}>グループ登録（元の商品と同じ商品名で登録）</button>
            {グループ元 && (
              <div className="ms-pick">
                <div>元になる商品を選択して下さい。</div>
                <table className="ms-grid">
                  <tbody>
                    {グループ元.map((g) => (
                      <tr key={g.商品コード} onClick={() => nav("/master/shohin/new", { state: { pass: 選ぶ, 元: g.商品コード } })}>
                        <td className="r">{g.商品コード}</td><td>{g.分類名}</td><td className="c">{g.ｶﾅ分類}</td><td>{g.商品名}</td><td>{g.規格}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <button onClick={() => set選ぶ(null)}>やめる</button>
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------- 入力の部品 ----------------
function 入力(props: { v: Rec; k: string; set: (k: string, x: any) => void; ro: boolean; num?: boolean; cls?: string; after?: (x: string) => void }) {
  const x = props.v[props.k];
  return (
    <input
      className={props.cls}
      value={x ?? ""}
      readOnly={props.ro}
      inputMode={props.num ? "decimal" : undefined}
      onChange={(e) => props.set(props.k, props.num ? (e.target.value === "" ? null : e.target.value) : e.target.value)}
      onBlur={(e) => !props.ro && props.after?.(e.target.value)}
    />
  );
}
function 選ぶ(props: { v: Rec; k: string; set: (k: string, x: any) => void; ro: boolean; opts: 選択肢[]; 空き?: boolean; cls?: string; after?: (o: 選択肢 | undefined) => void }) {
  const x = props.v[props.k];
  const ある = props.opts.some((o) => String(o.id) === String(x));
  return (
    <select
      className={props.cls}
      value={x ?? ""}
      disabled={props.ro}
      onChange={(e) => {
        const val = e.target.value === "" ? null : Number(e.target.value);
        props.set(props.k, val);
        props.after?.(props.opts.find((o) => String(o.id) === e.target.value));
      }}
    >
      {(props.空き ?? true) && <option value="" />}
      {!ある && x !== null && x !== undefined && x !== "" && <option value={x}>{x}</option>}
      {props.opts.map((o) => (
        <option key={o.id} value={o.id}>{o.name}{o.sub ? `　${o.sub}` : ""}</option>
      ))}
    </select>
  );
}
function 切替(props: { v: Rec; k: string; set: (k: string, x: any) => void; ro: boolean; 文字: string }) {
  const on = !!props.v[props.k];
  return (
    <button type="button" className={on ? "ms-tg on" : "ms-tg"} disabled={props.ro} onClick={() => props.set(props.k, !on)}>
      {props.文字}
    </button>
  );
}

const 現場 = [{ id: 1, name: "一工場" }, { id: 2, name: "二工場" }, { id: 3, name: "びえい" }];
const ロット印字 = [{ id: 0, name: "製造日 賞味期限" }, { id: 1, name: "製造日のみ" }, { id: 2, name: "賞味期限のみ" }];

// ---------------- 商品マスタ登録（FM_商品登録・FM_商品登録_新規） ----------------
export function ShohinForm() {
  const { code } = useParams();
  const nav = useNavigate();
  const loc = useLocation();
  const st = (loc.state ?? {}) as { pass?: string; 元?: number };
  const 新規 = code === "new";
  const [v, setV] = useState<Rec>({});
  const [o, setO] = useState<Record<string, 選択肢[]>>({});
  const [pass, setPass] = useState<string | null>(新規 ? st.pass ?? null : null);
  const [変えた, set変えた] = useState(false);
  const ro = !pass;
  const set = (k: string, x: any) => {
    setV((a) => ({ ...a, [k]: x }));
    set変えた(true);
  };

  useEffect(() => {
    api.get<Record<string, 選択肢[]>>("/api/mst/shohin-opts").then(setO, エラー);
    if (新規) {
      if (!st.pass) return void nav("/master/shohin");
      api.post<Rec>("/api/mst/shohin-new", { pass: st.pass, 元: st.元 }).then(setV, エラー);
    } else api.get<Rec>(`/api/mst/shohin/${code}`).then(setV, エラー);
  }, [code]);

  async function 訂正() {
    const p = await 合言葉を聞く();
    if (!p) return;
    setPass(p);
    alert("マスタ修正が可能になりました。");
  }
  async function 登録() {
    if (!confirm("登録します。よろしいですか")) return alert("登録をキャンセルしました。");
    try {
      await api.post("/api/mst/shohin/save", { pass, 元コード: 新規 ? undefined : n(code), 値: v });
      nav("/master/shohin");
    } catch (e) {
      エラー(e);
    }
  }
  function キャンセル() {
    if (変えた && !confirm("保存しないで閉じますがよろしいですか？")) return;
    nav("/master/shohin");
  }
  const 計 = useMemo(() => (n(v.規格kg) * n(v.規格枚数)) || "", [v.規格kg, v.規格枚数]);
  const P = { v, set, ro };
  const 枚数を入れた = () => {
    if (v.規格kg === null || v.規格kg === undefined) return;
    setV((a) => ({ ...a, 規格: `${a.規格kg ?? ""}×${a.規格枚数 ?? ""}`, 入数: n(a.規格kg) * n(a.規格枚数) }));
  };

  return (
    <div className="mf">
      <div className="mf-top">
        <span className="lbl">元コード</span>
        <span className="code">{v.グループ商品コード ?? ""}</span>
        <span className="lbl">商品区分</span>
        <選ぶ {...P} k="商品区分" opts={o.商品区分 ?? []} cls="kubun" />
        <div className="mf-btns">
          <button onClick={登録} disabled={ro}>登録</button>
          <button onClick={キャンセル}>キャンセル</button>
          {!新規 && <button onClick={訂正} disabled={!ro}>訂正</button>}
        </div>
        {ro && <span className="mf-ro">見るだけです。直すときは［訂正］を押してください。</span>}
      </div>
      <div className="mf-body">
        <fieldset className="mf-sec">
          <legend className="hissu">必須項目</legend>
          <div className="row"><span className="lbl">商品コード</span><span className="code big">{v.商品コード}</span><span className="lbl">カナ分類</span><入力 {...P} k="ｶﾅ分類" cls="s" after={(x) => set("ｶﾅ分類", 半角カナ(x))} /></div>
          <div className="row"><span className="lbl">商品分類</span><選ぶ {...P} k="分類ID" opts={o.分類 ?? []} /><span className="lbl">原料区分</span><選ぶ {...P} k="原料コード" opts={o.原料 ?? []} /></div>
          <div className="row"><span className="lbl">商品名</span><入力 {...P} k="商品名" cls="w" after={(x) => set("短縮名", 半角(x))} /></div>
          <div className="row"><span className="lbl">短縮名</span><入力 {...P} k="短縮名" cls="w" /></div>
          <div className="row">
            <span className="lbl">袋Kg / 枚数</span><入力 {...P} k="規格kg" num cls="s" />kg×<入力 {...P} k="規格枚数" num cls="s" after={枚数を入れた} />枚　計 <b>{計}</b> kg
          </div>
          <div className="row"><span className="lbl">表示規格</span><入力 {...P} k="規格" cls="w" /></div>
          <div className="row"><span className="lbl">賞味期限(年)</span><入力 {...P} k="品質保持期間" num cls="s" />年　製造月日から<入力 {...P} k="賞味期限日付差" num cls="s" />日</div>
          <div className="row"><span className="lbl">ユーザ賞味残日数</span><入力 {...P} k="USER賞味残日数" num cls="s" />日　<切替 {...P} k="非加熱品" 文字="非加熱品" /></div>
          <div className="row"><span className="lbl">製造場所</span><選ぶ {...P} k="製造場所ID" opts={o.得意先 ?? []} after={(x) => set("製造場所", x?.name ?? null)} /><span className="sub">{v.製造場所}</span></div>
        </fieldset>
        <fieldset className="mf-sec">
          <legend>その他の項目</legend>
          <div className="row"><span className="lbl">大阪共用コード</span><入力 {...P} k="本社コード" cls="w" /></div>
          <div className="row"><span className="lbl">主要原料</span><選ぶ {...P} k="主用原料コード" opts={o.主要原料 ?? []} /></div>
          <div className="row"><span className="lbl">原料産地</span><選ぶ {...P} k="産地コード" opts={o.産地 ?? []} after={(x) => set("産地通称", x?.name ?? null)} /><span className="sub">{v.産地通称}</span></div>
          <div className="row"><span className="lbl">歩留</span><入力 {...P} k="歩留" num cls="s" />%</div>
          <div className="row"><span className="lbl">ロット印字</span><選ぶ {...P} k="ロット表示区分" opts={ロット印字} 空き={false} /></div>
          <div className="row"><span className="lbl">ロット印字追記</span><入力 {...P} k="賞味期限追記" cls="w" /></div>
          <div className="row"><span className="lbl">製造現場</span><選ぶ {...P} k="現場ID" opts={現場} /></div>
          <div className="row"><span className="lbl">主要取引先</span><選ぶ {...P} k="取引先ID" opts={o.得意先 ?? []} after={(x) => set("取引先名", x?.name ?? null)} /><span className="sub">{v.取引先名}</span></div>
          <div className="row"><span className="lbl">積込時備考</span><textarea value={v.積込時注意項目 ?? ""} readOnly={ro} onChange={(e) => set("積込時注意項目", e.target.value)} /></div>
          <div className="row"><span className="lbl">使用停止</span><切替 {...P} k="使用中止" 文字={v.使用中止 ? "使用停止中" : "使用停止する"} /></div>
        </fieldset>
        <fieldset className="mf-sec side">
          <legend>そのほか</legend>
          <div className="row"><span className="lbl">繁盛商品コード</span><入力 {...P} k="繁盛商品コード" cls="w" /></div>
          <div className="sub-h">パレット積載 個数</div>
          <div className="row"><span className="lbl">丸北パレット</span><入力 {...P} k="パレット単位1" num cls="s" /></div>
          <div className="row"><span className="lbl">ニチレイパレット</span><入力 {...P} k="パレット単位2" num cls="s" /></div>
          <div className="row"><span className="lbl">段ボール品番</span><入力 {...P} k="DB品番CD" cls="s" /></div>
          <div className="row"><span className="lbl">寸法W 幅(mm)</span><入力 {...P} k="寸法W" num cls="s" /></div>
          <div className="row"><span className="lbl">寸法D 長さ(mm)</span><入力 {...P} k="寸法L" num cls="s" /></div>
          <div className="row"><span className="lbl">寸法H 高さ(mm)</span><入力 {...P} k="寸法H" num cls="s" /></div>
          <div className="row"><span className="lbl">マスタ登録日</span><span>{日(v.マスタ登録日)}</span></div>
          <div className="row"><span className="lbl">編集日時</span><span>{v.登録時間 ?? ""}</span></div>
        </fieldset>
        <fieldset className="mf-sec wide">
          <legend className="shizai">必要資材</legend>
          <div className="grid2">
            <div className="row"><span className="lbl">使用ダンボール</span><選ぶ {...P} k="資材ダンボールID" opts={o.ダンボール ?? []} /></div>
            <div className="row"><span className="lbl">計量袋</span><選ぶ {...P} k="資材計量袋ID" opts={o.計量袋 ?? []} /></div>
            <div className="row"><span className="lbl">使用パット</span><選ぶ {...P} k="資材その他ID" opts={o.パット ?? []} /></div>
            <div className="row"><span className="lbl">パット使用数</span><入力 {...P} k="パット使用数" num cls="s" /></div>
            <div className="row"><span className="lbl">使用テープ</span><選ぶ {...P} k="テープID" opts={o.テープ ?? []} /></div>
            <div className="row"><span className="lbl">冷凍パン入数</span><入力 {...P} k="冷凍パン入数" num cls="s" /></div>
            <div className="row"><span className="lbl">特記事項</span><textarea value={v.特記事項 ?? ""} readOnly={ro} onChange={(e) => set("特記事項", e.target.value)} /></div>
            <div className="row"><span className="lbl">基本使用パレット</span><選ぶ {...P} k="パレットID" opts={o.パレット ?? []} /></div>
            <div className="row"><span className="lbl">冷凍原料区分</span><選ぶ {...P} k="自社原料区分" opts={o.冷凍原料 ?? []} /></div>
          </div>
        </fieldset>
      </div>
    </div>
  );
}

// ---------------- 得意先マスタ一覧（FM_得意先マスタ） ----------------
export function TokuiList() {
  const nav = useNavigate();
  const [検索, set検索] = useState("");
  const [rows, setRows] = useState<Rec[]>([]);
  const 読む = (q = 検索) => api.get<Rec[]>("/api/mst/tokui", { q }).then(setRows, エラー);
  useEffect(() => {
    読む("");
  }, []);
  async function 訂正(code: number) {
    const pass = await 合言葉を聞く();
    if (pass) nav(`/master/tokui/${code}`, { state: { pass } });
  }
  const 地図 = (住所: string) => window.open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(住所)}`, "_blank", "noopener");

  return (
    <div className="ms tk2">
      <div className="ms-head">
        <div className="ms-name">得意先マスタ</div>
        <label className="ms-box">
          <span>検索（名前・コード）</span>
          <input value={検索} onChange={(e) => set検索(e.target.value)} onBlur={() => 読む()} onKeyDown={(e) => e.key === "Enter" && 読む()} />
        </label>
        <div className="ms-box"><span>件数</span><b>{rows.length}</b></div>
        <div className="ms-btns">
          <button onClick={() => nav("/master/tokui/new")}>新規追加</button>
          <button onClick={() => window.print()}>印刷</button>
          <button onClick={() => nav("/master")}>閉じる</button>
        </div>
      </div>
      <table className="ms-grid tk2-grid">
        <thead>
          <tr><th /><th>短縮・本社コード</th><th>カナ</th><th>得意先名・短縮名</th><th>〒・地区</th><th>住所</th><th>TEL・FAX</th><th>ユーザー分類</th><th>その他</th><th>販盛納入先コード</th></tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={`${r.短縮コード}-${r.得意先名}`} className={r.使用不可フラグ ? "off" : ""}>
              <td className="c"><button className="teisei" onClick={() => 訂正(r.短縮コード)}>訂<br />正</button></td>
              <td><div className="r code">{r.短縮コード}</div><div>{r.得意先コード}</div></td>
              <td className="c kana">{r.ｶﾅ分類}</td>
              <td><div className="b">{r.得意先名}</div><div className="short">{r.短縮名}</div></td>
              <td className="c"><div>{r.郵便番号}</div><div className="chiku">{r.地区コード}</div>{r.住所 && <button className="map" title="地図を開く" onClick={() => 地図(r.住所)}>地図</button>}</td>
              <td className="addr">{r.住所}</td>
              <td><div>{r.電話番号}</div><div className="gray">{r.FAX番号}</div><div className="gray c">{r.都道府県}</div></td>
              <td><div className="r">{r.ユーザー区分}</div><div className="b">{r.ユーザー区分名}</div></td>
              <td className="etc">
                <div className="flags">
                  <span className={r.倉庫区分 ? "on" : ""}>倉庫</span>
                  <span className={r.入庫区分 ? "on" : ""}>入庫通知</span>
                  <span className={r.入庫フラグ ? "on" : ""}>特定入庫</span>
                  <span className={r.使用不可フラグ ? "on" : ""}>使用不可</span>
                </div>
                <div><span className="grp">グループ {r.グループコード}</span>{r.グループ名 && <span className="grpname">{r.グループ名}</span>}</div>
                {r.備考 && <div className="gray">{r.備考}</div>}
              </td>
              <td className="c">{r.繁盛納入先コード}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ---------------- 得意先マスタ登録（FM_得意先登録・FM_得意先登録_新規追加） ----------------
export function TokuiForm() {
  const { code } = useParams();
  const nav = useNavigate();
  const loc = useLocation();
  const 新規 = code === "new";
  const [pass] = useState<string | null>(((loc.state ?? {}) as { pass?: string }).pass ?? null);
  const [v, setV] = useState<Rec>(新規 ? { 短縮コード: 0, グループコード: 0, グループコード2: 0, ユーザー区分: 0 } : {});
  const [o, setO] = useState<Rec>({});
  const ro = !新規 && !pass;
  const set = (k: string, x: any) => setV((a) => ({ ...a, [k]: x }));
  useEffect(() => {
    api.get<Rec>("/api/mst/tokui-opts").then(setO, エラー);
    if (!新規) api.get<Rec>(`/api/mst/tokui/${code}`).then(setV, エラー);
  }, [code]);

  // 住所・郵便番号を入れたら、都道府県・地区コード・十二地区（新しいときは短縮コードの空き番号も）を入れる（Access の コード表示）
  async function コード表示(住所: string) {
    try {
      const r = await api.post<Rec>("/api/mst/tokui/chiku", { 住所, 短縮コード: v.短縮コード });
      setV((a) => ({ ...a, 都道府県: r.都道府県, 地区コード: r.地区コード, 十二地区: r.十二地区, 短縮コード: 新規 ? r.短縮コード : a.短縮コード }));
    } catch (e) {
      エラー(e);
    }
  }
  async function 登録() {
    if (!confirm("登録します。よろしいですか")) return alert("登録をキャンセルしました。");
    try {
      await api.post("/api/mst/tokui/save", { pass, 元コード: 新規 ? undefined : n(code), 値: v });
      nav("/master/tokui");
    } catch (e) {
      エラー(e);
    }
  }
  const P = { v, set, ro };
  const グループ名 = (o.得意先 ?? []).find((x: 選択肢) => x.id === n(v.グループコード))?.name ?? "";

  return (
    <div className="tf">
      <div className="tf-top">
        <div className="tf-name">得意先マスタ登録</div>
        <div className="mf-btns">
          <button onClick={登録} disabled={ro}>登録</button>
          <button onClick={() => nav("/master/tokui")}>閉じる</button>
        </div>
      </div>
      <div className="tf-grid">
        <div className="cell"><div className="h">短縮コード</div>{新規 ? <入力 {...P} k="短縮コード" num cls="code" /> : <div className="code">{v.短縮コード}</div>}</div>
        <div className="cell"><div className="h">グループID</div><選ぶ {...P} k="グループコード" opts={o.得意先 ?? []} /></div>
        <div className="cell"><div className="h">グループ名</div><div className="gray">{n(v.グループコード) ? グループ名 : ""}</div></div>
        <div className="cell"><div className="h">販盛納入先コード</div><入力 {...P} k="繁盛納入先コード" /></div>
        <div className="cell w2"><div className="h">得意先名</div><入力 {...P} k="得意先名" cls="w" /></div>
        <div className="cell"><div className="h">カナ</div><入力 {...P} k="ｶﾅ分類" cls="s" after={(x) => set("ｶﾅ分類", 半角カナ(x))} /></div>
        <div className="cell"><div className="h">短縮名</div><入力 {...P} k="短縮名" /></div>
        <div className="cell"><div className="h">郵便番号</div><入力 {...P} k="郵便番号" after={() => v.住所 && コード表示(v.住所)} /></div>
        <div className="cell w2"><div className="h">住所</div><入力 {...P} k="住所" cls="w" after={(x) => コード表示(x)} /></div>
        <div className="cell">
          <div className="h">都道府県</div>
          <select value={v.都道府県 ?? ""} disabled={ro} onChange={(e) => { const x = (o.都道府県 ?? []).find((p: Rec) => p.name === e.target.value); setV((a) => ({ ...a, 都道府県: e.target.value, 地区コード: x?.地区コード ?? a.地区コード })); }}>
            <option value="" />
            {(o.都道府県 ?? []).map((p: Rec) => <option key={p.name} value={p.name}>{p.name}</option>)}
          </select>
        </div>
        <div className="cell"><div className="h">TEL</div><入力 {...P} k="電話番号" /></div>
        <div className="cell"><div className="h">FAX</div><入力 {...P} k="FAX番号" /></div>
        <div className="cell"><div className="h">地区コード</div><div className="gray c">{v.地区コード}</div></div>
        <div className="cell w2"><div className="h">受付時間</div><textarea value={v.受付時間 ?? ""} readOnly={ro} onChange={(e) => set("受付時間", e.target.value)} /></div>
        <div className="cell w2"><div className="h">備考</div><textarea value={v.備考 ?? ""} readOnly={ro} onChange={(e) => set("備考", e.target.value)} /></div>
      </div>
      <div className="tf-side">
        <div className="h">web出力区分</div>
        <選ぶ {...P} k="グループコード2" opts={o.web出力 ?? []} 空き={false} />
        <div className="row2">
          <div><div className="h">User分類ID</div><選ぶ {...P} k="ユーザー区分" opts={o.ユーザー区分 ?? []} /></div>
        </div>
        <div className="tgs">
          <切替 {...P} k="入庫区分" 文字="入庫・出荷通知表示する" />
          <切替 {...P} k="倉庫区分" 文字="保管場所として在庫データを保存する" />
          <切替 {...P} k="入庫フラグ" 文字="特定条件のみ入庫させる" />
          <切替 {...P} k="使用不可フラグ" 文字="使用(表示)しない" />
        </div>
        {ro && <div className="mf-ro">見るだけです。一覧の［訂正］から開くと直せます。</div>}
      </div>
    </div>
  );
}

// ---------------- 運送会社マスタ（FM_運送会社マスタ） ----------------
export function UnsoList() {
  const nav = useNavigate();
  const [rows, setRows] = useState<Rec[]>([]);
  const 読む = () => api.get<Rec[]>("/api/mst/unso").then(setRows, エラー);
  useEffect(() => {
    読む();
  }, []);
  async function 訂正(id: number) {
    const pass = await 合言葉を聞く();
    if (pass) nav(`/master/unso/${id}`, { state: { pass } });
  }
  async function 削除(r: Rec) {
    if (!confirm(`${r.運送会社名 ?? ""} のレコードを削除しますが、よろしいですか？`)) return;
    const pass = await 合言葉を聞く();
    if (!pass) return;
    try {
      await api.post("/api/mst/unso/delete", { pass, ID: r.ID });
      読む();
    } catch (e) {
      エラー(e);
    }
  }
  function 探す() {
    const v = prompt("運送会社IDか名前の一部を入れてください。");
    if (!v) return;
    const r = rows.find((x) => String(x.運送会社ID) === v.trim()) ?? rows.find((x) => `${x.運送会社名 ?? ""}${x.短縮名 ?? ""}`.includes(v.trim()));
    if (!r) return alert("見つかりませんでした。");
    document.getElementById(`un-${r.ID}`)?.scrollIntoView({ block: "center" });
    document.getElementById(`un-${r.ID}`)?.classList.add("hit");
  }
  return (
    <div className="ms">
      <div className="ms-head">
        <div className="ms-name">運送会社マスタ</div>
        <div className="ms-box"><span>件数</span><b>{rows.length}</b></div>
        <div className="ms-btns">
          <button onClick={() => nav("/master/unso/new")}>新規登録</button>
          <button onClick={探す}>検索</button>
          <button onClick={() => window.print()}>印刷</button>
          <button onClick={() => nav("/master")}>閉じる</button>
        </div>
      </div>
      <table className="ms-grid">
        <thead>
          <tr><th /><th>運送会社ID</th><th>カナ</th><th>短縮名</th><th>運送会社名</th><th>住所</th><th>TEL</th><th>FAX</th><th>締日</th><th>支払方法</th><th>請求先</th><th>振込先</th><th>運賃扱い</th><th>最大パレット</th><th>使用不可</th><th /></tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.ID} id={`un-${r.ID}`} className={r.使用不可フラグ ? "off" : ""}>
              <td className="c"><button className="link" onClick={() => 訂正(r.ID)}>訂正</button></td>
              <td className="r code">{r.運送会社ID}</td>
              <td className="c">{r.カナ分類}</td>
              <td>{r.短縮名}</td>
              <td className="name">{r.運送会社名}</td>
              <td className="small">{r.住所}</td>
              <td>{r.電話番号}</td>
              <td>{r.FAX番号}</td>
              <td>{r.締日}</td>
              <td className="small">{r.支払方法}</td>
              <td className="small">{r.請求先}</td>
              <td className="small">{r.振込先}</td>
              <td>{r.扱い区分名}</td>
              <td className="r">{r.最大パレット積載数 || ""}</td>
              <td className="c">{r.使用不可フラグ ? "使用不可" : ""}</td>
              <td className="c"><button onClick={() => 削除(r)}>削除</button></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ---------------- 運送会社マスタ登録（FM_運送会社マスタ登録） ----------------
export function UnsoForm() {
  const { id } = useParams();
  const nav = useNavigate();
  const loc = useLocation();
  const 新規 = id === "new";
  const [pass] = useState<string | null>(((loc.state ?? {}) as { pass?: string }).pass ?? null);
  const [v, setV] = useState<Rec>(新規 ? { 運送会社ID: null, 運賃扱い区分: 0, 配達区分: 0 } : {});
  const [o, setO] = useState<Rec>({});
  const ro = !新規 && !pass;
  const set = (k: string, x: any) => setV((a) => ({ ...a, [k]: x }));
  useEffect(() => {
    api.get<Rec>("/api/mst/unso-opts").then(setO, エラー);
    if (!新規) api.get<Rec>(`/api/mst/unso/${id}`).then(setV, エラー);
  }, [id]);
  async function 登録() {
    if (!confirm("登録します。よろしいですか")) return alert("登録をキャンセルしました。");
    try {
      await api.post("/api/mst/unso/save", { pass, ID: 新規 ? undefined : n(id), 値: v });
      nav("/master/unso");
    } catch (e) {
      エラー(e);
    }
  }
  const P = { v, set, ro };
  const 欄 = (h: string, k: string, opt?: { num?: boolean; w2?: boolean }) => (
    <div className={opt?.w2 ? "cell w2" : "cell"}><div className="h">{h}</div><入力 {...P} k={k} num={opt?.num} /></div>
  );
  const 名前 = (code: unknown) => (o.運送会社 ?? []).find((x: 選択肢) => x.id === n(code))?.name ?? "";
  return (
    <div className="tf">
      <div className="tf-top">
        <div className="tf-name">運送会社マスタ登録</div>
        <div className="mf-btns">
          <button onClick={登録} disabled={ro}>登録</button>
          <button onClick={() => nav("/master/unso")}>閉じる</button>
        </div>
        {ro && <span className="mf-ro">見るだけです。一覧の［訂正］から開くと直せます。</span>}
      </div>
      <div className="tf-grid">
        <div className="cell"><div className="h">運送会社ID</div>{新規 ? <入力 {...P} k="運送会社ID" num cls="code" /> : <div className="code">{v.運送会社ID}</div>}</div>
        <div className="cell"><div className="h">カナ</div><入力 {...P} k="カナ分類" after={(x) => set("カナ分類", 半角カナ(x))} /></div>
        {欄("短縮名", "短縮名")}
        {欄("運送会社名", "運送会社名")}
        {欄("住所", "住所", { w2: true })}
        {欄("TEL", "電話番号")}
        {欄("FAX", "FAX番号")}
        {欄("締日", "締日")}
        {欄("支払方法", "支払方法")}
        {欄("サイト", "サイト")}
        {欄("その他支払い", "その他支払い")}
        {欄("取引銀行", "取引銀行")}
        {欄("口座番号", "口座番号")}
        <div className="cell"><div className="h">請求先コード</div><入力 {...P} k="請求先コード" num /></div>
        <div className="cell"><div className="h">請求先</div><div className="gray">{n(v.請求先コード) ? 名前(v.請求先コード) : v.請求先 ?? ""}</div></div>
        {欄("請求書送り先住所", "請求書送り先住所", { w2: true })}
        {欄("請求先TEL", "請求先電話番号")}
        {欄("請求書FAX", "請求書FAX番号")}
        <div className="cell"><div className="h">振込先コード</div><入力 {...P} k="振込先コード" num /></div>
        <div className="cell"><div className="h">振込先</div><div className="gray">{n(v.振込先コード) ? 名前(v.振込先コード) : v.振込先 ?? ""}</div></div>
        {欄("振込住所", "振込住所", { w2: true })}
        {欄("振込先TEL", "振込先電話番号")}
        {欄("振込先FAX", "振込先FAX番号")}
        {欄("支払い元", "支払い元")}
        {欄("支払い元住所", "支払い元住所")}
        {欄("支払い元TEL", "支払い元電話番号")}
        {欄("支払先FAX", "支払先FAX番号")}
        <div className="cell w2"><div className="h">備考</div><textarea value={v.備考 ?? ""} readOnly={ro} onChange={(e) => set("備考", e.target.value)} /></div>
      </div>
      <div className="tf-side">
        <div className="h">運賃扱い区分</div>
        <選ぶ {...P} k="運賃扱い区分" opts={o.運賃扱い ?? []} />
        <div className="h">配達区分</div>
        <選ぶ {...P} k="配達区分" opts={o.配達区分 ?? []} />
        <div className="h">最大パレット積載数</div><入力 {...P} k="最大パレット積載数" num />
        <div className="h">最小パレット積載数</div><入力 {...P} k="最小パレット積載数" num />
        <div className="h">eLixxi扱い便CD</div><入力 {...P} k="eLixxi扱い便CD" />
        <div className="tgs">
          <切替 {...P} k="小口配送区分" 文字="小口配送" />
          <切替 {...P} k="請求先区分" 文字="請求先" />
          <切替 {...P} k="使用不可フラグ" 文字="使用(表示)しない" />
        </div>
      </div>
    </div>
  );
}
