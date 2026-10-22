import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { api, ApiError, num } from "../api";

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
      <button onClick={() => nav("/master/user")}>ユーザーマスタ登録</button>
      <button onClick={() => nav("/master/misettei")}>ユーザーマスタ未設定登録</button>
      <button onClick={() => nav("/master/calendar")}>カレンダー設定</button>
      <button onClick={() => nav("/master/sakujo")}>古いデータを消す</button>
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

// ---------------- ユーザーマスタ登録（F_ユーザーカード検索・FM_ユーザーカード） ----------------
const 受注元 = [{ id: 1, name: "丸北北海道" }, { id: 629, name: "大阪丸北" }];
const 請求先 = [{ id: 1, name: "丸北" }, { id: 629, name: "大阪" }];
export function UserList() {
  const nav = useNavigate();
  const [o, setO] = useState<Rec>({});
  const [元, set元] = useState(1);
  const [グループ, setグループ] = useState<number | "">(11);
  const [商品, set商品] = useState<number | "">("");
  const [届け先, set届け先] = useState<number | "">("");
  const [rows, setRows] = useState<Rec[]>([]);
  const [開く, set開く] = useState<number | "new" | null>(null);
  const 読む = () =>
    api.get<Rec[]>("/api/mst/user", { group: グループ, shohin: 商品, todoke: 届け先 }).then(setRows, エラー);
  useEffect(() => {
    api.get<Rec>("/api/mst/user-opts").then(setO, エラー);
  }, []);
  useEffect(() => {
    読む();
  }, [グループ, 商品, 届け先]);
  const グループ一覧: Rec[] = (o.グループ ?? []).filter((g: Rec) => n(g.受注区分) === 元);
  // 商品・届け先の絞り込みの選択肢は、いまの取引先グループに出てくるもの（Access と同じ）
  const [グループの行, setグループの行] = useState<Rec[]>([]);
  useEffect(() => {
    api.get<Rec[]>("/api/mst/user", { group: グループ }).then(setグループの行, エラー);
  }, [グループ]);
  const 商品一覧 = useMemo(() => [...new Map(グループの行.map((r) => [r.商品コード, r.商品名])).entries()].filter(([c]) => c != null), [グループの行]);
  const 届け先一覧 = useMemo(() => [...new Map(グループの行.map((r) => [r.届け先コード, r.届け先])).entries()].filter(([c]) => c != null), [グループの行]);
  const 名前 = (code: unknown) => (o.得意先 ?? []).find((x: 選択肢) => x.id === n(code))?.name ?? "";

  return (
    <div className="ms us">
      <div className="ms-head">
        <div className="ms-name">ユーザーマスタ登録</div>
        <label className="ms-box">
          <span>受注元</span>
          <select value={元} onChange={(e) => { const v = Number(e.target.value); set元(v); const g = (o.グループ ?? []).find((x: Rec) => n(x.受注区分) === v); setグループ(g ? g.id : ""); set商品(""); set届け先(""); }}>
            {受注元.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
          </select>
        </label>
        <label className="ms-box">
          <span>取引先グループ検索</span>
          <select value={グループ} onChange={(e) => { setグループ(e.target.value === "" ? "" : Number(e.target.value)); set商品(""); set届け先(""); }}>
            <option value="" />
            {グループ一覧.map((g) => <option key={g.id} value={g.id}>{g.id}　{g.name}</option>)}
          </select>
        </label>
        <label className="ms-box">
          <span>商品名検索</span>
          <select value={商品} onChange={(e) => set商品(e.target.value === "" ? "" : Number(e.target.value))}>
            <option value="" />
            {商品一覧.map(([c, nm]) => <option key={c} value={c}>{c}　{nm}</option>)}
          </select>
        </label>
        <label className="ms-box">
          <span>届け先検索</span>
          <select value={届け先} onChange={(e) => set届け先(e.target.value === "" ? "" : Number(e.target.value))}>
            <option value="" />
            {届け先一覧.map(([c, nm]) => <option key={c} value={c}>{c}　{nm}</option>)}
          </select>
        </label>
        <div className="ms-box"><span>件数</span><b>{rows.length}</b></div>
        <div className="ms-btns">
          <button onClick={() => set開く("new")}>新規登録</button>
          <button onClick={() => nav("/master")}>閉じる</button>
        </div>
      </div>
      <table className="ms-grid">
        <thead>
          <tr><th>選択</th><th>受注先</th><th>コード</th><th>商品名</th><th>コード</th><th>届け先</th><th>コード</th><th>集荷場所</th><th>指定名義</th><th>運賃請求先</th><th>扱い</th><th>取扱区分名</th></tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.ID}>
              <td className="c"><button onClick={() => set開く(r.ID)}>選択</button></td>
              <td>{r.受注先 ?? ""}</td>
              <td className="r">{r.商品コード}</td><td>{r.商品名}</td>
              <td className="r">{r.届け先コード}</td><td>{r.届け先}</td>
              <td className="r">{r.倉庫ID}</td><td>{r.倉庫名}</td>
              <td>{r.入庫名義 ?? (r.入庫名義ID ? r.入庫名義ID : "")}</td>
              <td className="c">{請求先.find((x) => x.id === n(r.運賃請求ID))?.name ?? (r.運賃請求ID ?? "")}</td>
              <td className="c">{請求先.find((x) => x.id === n(r.運賃振分区分))?.name ?? (r.運賃振分区分 ?? "")}</td>
              <td>{r.取扱名}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {開く != null && (
        <UserCard
          id={開く}
          o={o}
          既定={{ 受注元ID: 元 === 1 ? 11 : 629, 取引先グループID: グループ === "" ? null : グループ, 運賃請求ID: 元, 運賃振分区分: 元 }}
          名前={名前}
          onClose={(変えた) => { set開く(null); if (変えた) 読む(); }}
        />
      )}
    </div>
  );
}

/** ユーザーカード（FM_ユーザーカード・FM_ユーザーカード_新規）：1 行を直す・足す。いただいたスクリーンショットと同じ項目・並び */
const 振分 = [{ id: 1, name: "北海道工場" }, { id: 629, name: "大阪丸北" }];
const もらい単位 = [{ id: 0, name: "kg建て" }, { id: 1, name: "個建て" }];
function UserCard(props: { id: number | "new"; o: Rec; 既定: Rec; 名前: (c: unknown) => string; onClose: (変えた: boolean) => void }) {
  const 新規 = props.id === "new";
  const [v, setV] = useState<Rec>(新規 ? { ...props.既定 } : {});
  const set = (k: string, x: any) => setV((a) => ({ ...a, [k]: x }));
  useEffect(() => {
    if (!新規) api.get<Rec>(`/api/mst/user/${props.id}`).then(setV, エラー);
  }, [props.id]);
  async function 登録() {
    if (!confirm("登録します。よろしいですか")) return alert("登録をキャンセルしました。");
    try {
      await api.post("/api/mst/user/save", { ID: 新規 ? undefined : props.id, 値: v });
      props.onClose(true);
    } catch (e) {
      エラー(e);
    }
  }
  function キャンセル() {
    if (!confirm("保存されませんが、よろしいですか？")) return;
    props.onClose(false);
  }
  const P = { v, set, ro: false };
  const 得意先: 選択肢[] = props.o.得意先 ?? [];
  const 商品: Rec[] = props.o.商品 ?? [];
  const 分類 = (props.o.分類 ?? []) as 選択肢[];
  const 取扱名一覧: string[] = props.o.取扱名 ?? [];
  return (
    <div className="modal">
      <div className="uc2" onClick={(e) => e.stopPropagation()}>
        <div className="uc2-top">
          <span className="h">ID</span><span className="id">{新規 ? "（新規）" : props.id}</span>
          <div className="btns"><button onClick={登録}>登録</button><button onClick={キャンセル}>キャンセル</button></div>
        </div>
        <div className="uc2-block">
          <div className="r"><span className="h">受注元</span><選ぶ {...P} k="受注元ID" opts={得意先} cls="w" /></div>
          <div className="r"><span className="h">取引先グループ</span><選ぶ {...P} k="取引先グループID" opts={(props.o.グループ ?? []).map((g: Rec) => ({ id: g.id, name: g.name }))} cls="w" /></div>
        </div>
        <div className="uc2-block">
          <div className="r"><span className="h">取引先</span><選ぶ {...P} k="取引先ID" opts={得意先} cls="w" /></div>
          <div className="r"><span className="h">受注先</span><選ぶ {...P} k="受注先ID" opts={得意先} cls="w" /></div>
          <div className="r"><span className="h">届け先</span><選ぶ {...P} k="届け先コード" opts={得意先} cls="w" /></div>
          <div className="r"><span className="h">ユーザー区分</span><選ぶ {...P} k="ユーザー区分" opts={props.o.ユーザー区分 ?? []} cls="w" ro={true} /></div>
        </div>
        <div className="uc2-block">
          <div className="r"><span className="h">入庫名義</span><入力 {...P} k="入庫名義ID" num cls="code" /><span className="name">{props.名前(v.入庫名義ID)}</span></div>
        </div>
        <hr />
        <div className="uc2-grid">
          <span className="h">コード</span><span className="h wide">科目</span><span className="h">商品分類</span><span />
          <span className="h">商品名</span>
          <span className="pair"><入力 {...P} k="商品コード" num cls="code" /><span className="name">{商品.find((x) => x.id === n(v.商品コード))?.name ?? ""}</span></span>
          <span className="gray">{分類.find((x) => x.id === n(商品.find((y) => y.id === n(v.商品コード))?.分類ID))?.name ?? ""}</span>
          <span className="tate"><span className="h">立替運賃</span><入力 {...P} k="キロ立替運賃" num /></span>
          <span className="h">出荷場所</span>
          <span className="pair"><入力 {...P} k="倉庫ID" num cls="code" /><span className="name">{props.名前(v.倉庫ID)}</span></span>
          <span /><span />
        </div>
        <div className="uc2-block">
          <div className="r"><span className="h">扱い</span><選ぶ {...P} k="運賃振分区分" opts={振分} /></div>
          <div className="r"><span className="h">運賃請求先</span><選ぶ {...P} k="運賃請求ID" opts={振分} /></div>
        </div>
        <div className="uc2-block">
          <div className="r">
            <span className="h">取扱区分</span>
            <input list="uc2-toriatsukai" value={v.取扱名 ?? ""} onChange={(e) => setV((a) => ({ ...a, 取扱名: e.target.value, 取扱区分: !!e.target.value }))} />
            <datalist id="uc2-toriatsukai">{取扱名一覧.map((x) => <option key={x} value={x} />)}</datalist>
            <input type="checkbox" checked={!!v.取扱区分} readOnly />
          </div>
          <div className="r"><span className="h">立替運賃</span><入力 {...P} k="キロ立替運賃" num /></div>
          <div className="r"><span className="h">もらい単位</span><選ぶ {...P} k="もい運賃単位" opts={もらい単位} 空き={false} /></div>
          <div className="r"><span className="h">もらい運賃</span><入力 {...P} k="もらい運賃" num /></div>
        </div>
        <div className="uc2-biko">
          <div className="h">備考</div>
          <textarea value={v.備考 ?? ""} onChange={(e) => set("備考", e.target.value)} />
        </div>
      </div>
    </div>
  );
}

// ---------------- カレンダー設定（F_マルチカレンダー） ----------------
const 曜日名 = ["日", "月", "火", "水", "木", "金", "土"];
export function CalendarPage() {
  const nav = useNavigate();
  const now = new Date(Date.now() + 9 * 3600 * 1000);
  const [年, set年] = useState(now.getUTCFullYear());
  const [月, set月] = useState(now.getUTCMonth() + 1);
  const [種類, set種類] = useState(0);
  const [日, set日] = useState<Rec[]>([]);
  const 今日 = now.toISOString().slice(0, 10);
  useEffect(() => {
    api.get<Rec[]>("/api/mst/calendar", { year: 年, month: 月, mode: 種類 }).then(set日, エラー);
  }, [年, 月, 種類]);
  const 年一覧 = Array.from({ length: 7 }, (_, i) => now.getUTCFullYear() - 3 + i);
  return (
    <div className="mc">
      <div className="mc-top">
        <select value={年} onChange={(e) => set年(Number(e.target.value))}>{年一覧.map((y) => <option key={y} value={y}>{y}</option>)}</select>年
        <select value={月} onChange={(e) => set月(Number(e.target.value))}>{Array.from({ length: 12 }, (_, i) => i + 1).map((m) => <option key={m} value={m}>{String(m).padStart(2, "0")}</option>)}</select>月
        {["予定全体", "休日設定", "製造", "資材"].map((x, i) => (
          <button key={x} className={種類 === i ? "on" : ""} onClick={() => set種類(i)}>{x}</button>
        ))}
        <button className="close" onClick={() => nav("/master")}>閉じる</button>
      </div>
      <div className="mc-grid">
        {曜日名.map((w, i) => <div key={w} className={`mc-w ${i === 0 ? "sun" : i === 6 ? "sat" : ""}`}>{w}</div>)}
        {日.map((d) => {
          const 曜 = new Date(d.date + "T00:00:00Z").getUTCDay();
          const cls = d.holiday ? "hol" : 曜 === 0 ? "hol" : 曜 === 6 ? "sat" : "";
          return (
            <div key={d.date} className={`mc-day ${d.inMonth ? "" : "out"} ${d.date === 今日 ? "today" : ""} ${曜 === 0 ? "sunday" : ""}`}>
              <div className={`mc-head ${cls} ${d.date === 今日 ? "today" : ""}`}>{d.inMonth ? `${Number(d.date.slice(8))}日` : `${Number(d.date.slice(5, 7))}月${Number(d.date.slice(8))}日`}{d.holiday ? `　${d.holiday}` : ""}</div>
              <div className="mc-body">
                {(d.中身 ?? []).map((x: Rec, i: number) => (
                  <div key={i} className={`mc-row ${d.date < 今日 ? "past" : ""}`}><span>{x.a}</span><span>{x.b}</span></div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ---------------- ユーザーマスタ未設定登録（F_ユーザー詳細条件設定_未設定） ----------------
export function MisetteiList() {
  const nav = useNavigate();
  const [pass, setPass] = useState<string | null>(null);
  const [o, setO] = useState<Rec>({});
  const [rows, setRows] = useState<Rec[]>([]);
  const [知らせ, set知らせ] = useState("");
  const [開く, set開く] = useState<number | null>(null);
  const 読む = () =>
    api.get<Rec>("/api/mst/misettei").then((r) => {
      setRows(r.rows);
      set知らせ(r.足した ? `出荷から新しい組み合わせを ${r.足した} 件取り込みました。` : "");
    }, エラー);
  useEffect(() => {
    // Access と同じく、開くときに合言葉を聞く
    合言葉を聞く().then((p) => {
      if (!p) return nav("/master");
      setPass(p);
      api.get<Rec>("/api/mst/user-opts").then(setO, エラー);
      読む();
    });
  }, []);
  async function インポート() {
    try {
      const r = await api.post<Rec>("/api/mst/misettei/import", { pass });
      alert(r.足した ? `${r.足した} 件取り込みました。` : "新しい組み合わせはありませんでした。");
      読む();
    } catch (e) {
      エラー(e);
    }
  }
  async function 未完(r: Rec, 値: boolean) {
    try {
      await api.post("/api/mst/misettei/chk", { pass, ID: r.ID, 値 });
      setRows((x) => x.map((y) => (y.ID === r.ID ? { ...y, 未完了chk: 値 } : y)));
    } catch (e) {
      エラー(e);
    }
  }
  const 名前 = (code: unknown) => (o.得意先 ?? []).find((x: 選択肢) => x.id === n(code))?.name ?? "";
  const 振分名 = (v: unknown) => ({ 1: "北海道工場", 629: "大阪丸北" } as Record<number, string>)[n(v)] ?? (v ?? "");
  if (!pass) return <div className="ms" />;
  return (
    <div className="ms">
      <div className="ms-head">
        <div className="ms-name">ユーザーマスタ未設定登録</div>
        <button onClick={インポート}>未設定インポート</button>
        <div className="ms-box"><span>件数</span><b>{rows.length}</b></div>
        <div className="ms-btns"><button onClick={() => nav("/master")}>閉じる</button></div>
      </div>
      <div className="hb-note">
        直近 40 日の出荷（WorkStation・倉庫管理）で、ユーザーマスタにない 集荷場所・商品・届け先 の組み合わせを、開くたびに自動で取り込みます（1 時間ごとにも取り込みます）。
        ［選択］で中身を入れ、「未完」の印を外すと、ユーザーマスタ登録の一覧に出ます。{知らせ && <b>　{知らせ}</b>}
      </div>
      <table className="ms-grid mi-grid">
        <thead>
          <tr><th>選択</th><th>未完</th><th>登録日</th><th>受注元</th><th>取引先グループ</th><th>受注先</th><th>コード</th><th>商品名</th><th>分類</th><th>コード</th><th>集荷場所</th><th>コード</th><th>届け先</th><th>指定名義</th><th>支払先(運賃)</th><th>扱い</th><th>取扱区分名</th><th>立替運賃(kg)</th><th>貰い運賃(kg)</th><th>貰い運賃(個建)</th><th>最終出荷日</th></tr>
        </thead>
        <tbody>
          {rows.length === 0 && <tr><td colSpan={21} className="c">未設定の組み合わせはありません</td></tr>}
          {rows.map((r) => (
            <tr key={r.ID}>
              <td className="c"><button onClick={() => set開く(r.ID)}>選択</button></td>
              <td className="c"><input type="checkbox" checked={!!r.未完了chk} onChange={(e) => 未完(r, e.target.checked)} /></td>
              <td>{日(r.登録日)}</td>
              <td>{名前(r.受注元ID)}</td>
              <td>{(o.グループ ?? []).find((g: Rec) => g.id === n(r.取引先グループID))?.name ?? ""}</td>
              <td>{名前(r.受注先ID)}</td>
              <td className="r">{r.商品コード}</td><td>{r.商品名}</td><td>{r.分類名}</td>
              <td className="r">{r.倉庫ID}</td><td>{r.倉庫名}</td>
              <td className="r">{r.届け先コード}</td><td>{r.届け先}</td>
              <td>{r.入庫名義 ?? ""}</td>
              <td>{振分名(r.運賃請求ID)}</td><td>{振分名(r.運賃振分区分)}</td>
              <td>{r.取扱名}</td>
              <td className="r">{r.キロ立替運賃 ?? ""}</td><td className="r">{r.もらい運賃 ?? ""}</td><td className="r">{r.もらい運賃個建 ?? ""}</td>
              <td>{日(r.最終出荷日)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {開く != null && <UserCard id={開く} o={o} 既定={{}} 名前={名前} onClose={(変えた) => { set開く(null); if (変えた) 読む(); }} />}
    </div>
  );
}

// ---------------- 古いデータを消す ----------------
const まとまり一覧 = [
  { id: "受注出荷", name: "受注・出荷・便（輸送計画）" },
  { id: "在庫入庫", name: "在庫・入庫（製造）・在庫訂正" },
  { id: "倉庫管理", name: "倉庫管理の出荷・便・在庫・在庫訂正" },
];
export function SakujoPage() {
  const nav = useNavigate();
  const [年数, set年数] = useState(2);
  const [選ぶ, set選ぶ] = useState<string[]>(まとまり一覧.map((x) => x.id));
  const [d, setD] = useState<Rec | null>(null);
  const [書き出した, set書き出した] = useState(false);
  const [動作中, set動作中] = useState(false);
  const [結果, set結果] = useState<Rec | null>(null);
  const [数え中, set数え中] = useState(false);
  const 数える = () => {
    set数え中(true);
    set書き出した(false);
    return api
      .get<Rec>("/api/mst/sakujo", { years: 年数, kinds: 選ぶ.join(",") })
      .then(setD, エラー)
      .finally(() => set数え中(false));
  };
  useEffect(() => {
    数える();
  }, [年数, 選ぶ.join(",")]);
  const 表: Rec[] = d?.表 ?? [];
  const 合計 = 表.reduce((a, x) => a + n(x.件数), 0);

  async function 書き出す() {
    const pass = await 合言葉を聞く();
    if (!pass) return;
    set動作中(true);
    try {
      const r = await fetch("/api/mst/sakujo/excel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pass, years: 年数, kinds: 選ぶ }),
        credentials: "same-origin",
      });
      if (!r.ok) throw new ApiError(r.status, (await r.json().catch(() => ({}))).error ?? "書き出せませんでした");
      const url = URL.createObjectURL(await r.blob());
      const a = document.createElement("a");
      a.href = url;
      a.download = `消したデータ_${d?.消す日 ?? ""}より前.xlsx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 10000);
      set書き出した(true);
    } catch (e) {
      エラー(e);
    } finally {
      set動作中(false);
    }
  }
  async function 消す() {
    if (!confirm(`${d?.消す日} より前のデータ ${num(合計)} 件を消します。消したデータは元に戻せません（書き出した Excel に残っています）。よろしいですか？`)) return;
    const pass = await 合言葉を聞く();
    if (!pass) return;
    set動作中(true);
    try {
      const r = await api.post<Rec>("/api/mst/sakujo/run", {
        pass, years: 年数, kinds: 選ぶ, 件数: Object.fromEntries(表.map((x) => [x.名前, x.件数])),
      });
      set結果(r.結果);
      await 数える();
    } catch (e) {
      エラー(e);
    } finally {
      set動作中(false);
    }
  }
  return (
    <div className="ms sk2">
      <div className="ms-head">
        <div className="ms-name">古いデータを消す</div>
        <label className="ms-box">
          <span>残す年数</span>
          <select value={年数} onChange={(e) => set年数(Number(e.target.value))}>
            {[1, 2, 3, 4, 5].map((y) => <option key={y} value={y}>{y} 年</option>)}
          </select>
        </label>
        <div className="ms-btns"><button onClick={() => nav("/master")}>閉じる</button></div>
      </div>
      <div className="hb-note">
        {d?.消す日 ? `${d.消す日.replace(/-/g, "/")} より前のデータを消します。` : ""}
        在庫が残っているロットと、それにつながる出荷・入庫・在庫訂正・受注・便は消しません。消す前に Excel に書き出してください（書き出すまで［削除］は押せません）。
      </div>
      <div className="sk2-kinds">
        {まとまり一覧.map((x) => (
          <label key={x.id}>
            <input type="checkbox" checked={選ぶ.includes(x.id)} onChange={(e) => set選ぶ((a) => (e.target.checked ? [...a, x.id] : a.filter((y) => y !== x.id)))} />
            {x.name}
          </label>
        ))}
      </div>
      <table className="ms-grid">
        <thead><tr><th>データ</th><th>消す件数</th><th>今の件数</th><th>消したあと</th></tr></thead>
        <tbody>
          {表.map((x) => (
            <tr key={x.名前}>
              <td>{x.名前}</td><td className="r b">{num(x.件数)}</td><td className="r">{num(x.全部)}</td><td className="r">{num(x.全部 - x.件数)}</td>
            </tr>
          ))}
          {表.length > 0 && <tr className="sum"><td>合計</td><td className="r b">{num(合計)}</td><td /><td /></tr>}
        </tbody>
      </table>
      <div className="sk2-btns">
        {数え中 && <span>件数を数えています…</span>}
        <button onClick={書き出す} disabled={動作中 || 数え中 || !合計}>① Excel に書き出す</button>
        <button className="red" onClick={消す} disabled={動作中 || 数え中 || !合計 || !書き出した}>② 削除</button>
        {書き出した && <span className="ok">書き出しました。ファイルを保存したことを確かめてから［削除］を押してください。</span>}
      </div>
      {結果 && (
        <div className="sk2-result">
          消しました：{Object.entries(結果).filter(([, v]) => n(v)).map(([k, v]) => `${k} ${num(v as number)} 件`).join("、") || "0 件"}
        </div>
      )}
    </div>
  );
}
