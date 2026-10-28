import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { api, ApiError, num } from "../api";
import { CalendarDialog, Field, parseDate, PageClose } from "../formParts";
import { KibouDialog } from "./WsKibou";

type Rec = Record<string, any>;
type ボタン = { id: number; name: string | null };
const 全角 = (n: number) => String(n).replace(/[0-9]/g, (d) => String.fromCharCode(d.charCodeAt(0) + 0xfee0));
const 月日 = (v: string | null | undefined) => (v ? `${Number(v.slice(5, 7))}月${Number(v.slice(8, 10))}日` : "");
const pad = (n: number) => String(n).padStart(2, "0");

/**
 * 受注検索（Access の WorkStation の F_受注検索）。インポート処理の「受注読込」から開く。
 * 検索方法 → ボタンで受注元・受注先・届け先 → 納品日 → 出荷場所 の順に絞り、受注を選んでこの便に出荷の行を作る。
 */
export default function WsJuchu() {
  const nav = useNavigate();
  const [sp] = useSearchParams();
  const 輸送ID = Number(sp.get("id"));
  const [plan, setPlan] = useState<Rec | null>(null);
  const [methods, setMethods] = useState<ボタン[]>([]);
  const [方法, set方法] = useState(0);
  const [表題, set表題] = useState("検索方法を選択して下さい。");
  // ボタンの並び（Access の Flm_受注元選択）と、押したときに入れる先・次の並び
  const [buttons, setButtons] = useState<ボタン[] | null>(null);
  const [入れる先, set入れる先] = useState<"moto" | "saki" | "todoke">("moto");
  const [次, set次] = useState(0);
  const [cond, setCond] = useState<{ moto: number; saki: number; todoke: number; d1: string; d2: string; toitsu: string; jid: string; shohin: number }>({
    moto: 0, saki: 0, todoke: 0, d1: "", d2: "", toitsu: "", jid: "", shohin: 0,
  });
  const [日付欄, set日付欄] = useState(false);
  const [番号欄, set番号欄] = useState<"" | "toitsu" | "jid">("");
  const [商品欄, set商品欄] = useState(false);
  const [場所欄, set場所欄] = useState(false);
  const [soko, setSoko] = useState<number | null>(null);
  const [sokoName, setSokoName] = useState("");
  const [rows, setRows] = useState<Rec[]>([]);
  const [cal, setCal] = useState(false);
  const [rireki, setRireki] = useState<Rec[] | null>(null);
  // 受注分在庫出力を待つ
  const [在庫画面, set在庫画面] = useState<null | { data: Rec; 受注: Rec; resolve: (v: { 認識ID: string; ケース: number; kg: number }[] | null) => void }>(null);

  useEffect(() => {
    api.post("/api/ws/juchu/open", {}).catch(() => alert("受注データの取得が出来ませんでした。"));
    api.get<ボタン[]>("/api/ws/juchu/methods").then(setMethods);
    if (輸送ID) api.get<any>(`/api/ws/plan/${輸送ID}`).then((r) => setPlan(r.plan));
  }, [輸送ID]);

  async function 一覧(c = cond) {
    setRows(
      await api.get<Rec[]>("/api/ws/juchu/list", {
        moto: String(c.moto || ""), saki: String(c.saki || ""), todoke: String(c.todoke || ""), d1: c.d1, d2: c.d2,
        toitsu: c.toitsu, jid: c.jid, shohin: String(c.shohin || ""),
      }),
    );
  }

  async function 並び(kind: number, c = cond) {
    const b = await api.get<ボタン[]>("/api/ws/juchu/buttons", { kind: String(kind), moto: String(c.moto), saki: String(c.saki) });
    setButtons(b);
  }

  // 検索条件クリア（Access の cmd_条件クリア_Click）
  function クリア() {
    const c = { moto: 0, saki: 0, todoke: 0, d1: "", d2: "", toitsu: "", jid: "", shohin: 0 };
    setCond(c);
    setButtons(null);
    set日付欄(false);
    set番号欄("");
    set商品欄(false);
    set場所欄(false);
    setSoko(null);
    setSokoName("");
    setRows([]);
    set表題("検索方法を選択して下さい。");
    return c;
  }

  // 検索方法を選ぶ（Access の flm_検索区分_AfterUpdate）
  async function 方法を選ぶ(id: number) {
    const c = クリア();
    set方法(id);
    if (id === 1) {
      // 日本食研専用：受注元は日本食研、受注先を選ぶ
      const c2 = { ...c, moto: 360 };
      setCond(c2);
      await 並び(2, c2);
      set表題("受注先を選択して下さい。");
      set入れる先("saki");
      set次(13);
    } else if (id === 2) {
      await 並び(0, c);
      set表題("丸北の取扱い区分を選択して下さい。");
      set入れる先("moto");
      set次(11);
    } else if (id === 3) {
      await 並び(12, c);
      set表題("ユーザーを選択して下さい。");
      set入れる先("moto");
      set次(2);
    } else if (id === 4 || id === 5) {
      set表題(id === 4 ? "検索する発注Noを入力してください。" : "検索する丸北の受注IDを入力してください。");
      set番号欄(id === 4 ? "toitsu" : "jid");
      set場所欄(true);
    } else if (id === 6) {
      set表題("検索する商品コードを入力してください。");
      set商品欄(true);
      set場所欄(true);
    }
  }

  // ボタンを押す（Access の Flm_受注元選択_AfterUpdate → C_検索ボタン配列切替）
  async function ボタンを押す(b: ボタン) {
    const c = { ...cond, [入れる先]: b.id };
    setCond(c);
    if (次 === 2) {
      await 並び(2, c);
      set表題("受注先を選択して下さい。");
      set入れる先("saki");
      set次(13);
    } else if (次 === 11) {
      await 並び(11, c);
      set表題("受注先を選択して下さい。");
      set入れる先("moto");
      set次(13);
    } else if (次 === 13) {
      await 並び(13, c);
      set表題("届け先を選択して下さい。");
      set入れる先("todoke");
      set次(4);
    } else if (次 === 4) {
      setButtons(null);
      set表題("納品日を選択して下さい。");
      set日付欄(true);
    }
  }

  // 納品日を決めたら一覧を出し、出荷場所を聞く（Access の C_納品日セット）
  async function 納品日(d1: string, d2: string, 更新 = false) {
    const c = { ...cond, d1, d2 };
    setCond(c);
    await 一覧(c);
    if (更新) await 最新();
    set場所欄(true);
    set表題("出荷場所を選択して下さい。");
  }
  function 月(m: number) {
    const y = new Date().getFullYear();
    const last = new Date(y, m, 0).getDate();
    納品日(`${y}-${pad(m)}-01`, `${y}-${pad(m)}-${pad(last)}`);
  }

  async function 最新(list = rows) {
    await api.post("/api/ws/juchu/refresh", { 受注ID: list.map((r) => r.受注ID) });
    await 一覧();
  }

  async function 出荷場所(v: string) {
    const id = v.trim() === "" ? null : Number(v);
    setSoko(id);
    setSokoName(id ? ((await api.get<Rec[]>("/api/find/tokui", { w: String(id) })).find((x) => x.コード === id)?.短縮名 ?? "") : "");
  }

  // 1 件の受注を割り付ける（Access の C_受注在庫読込 → My出庫出力）。在庫がなければ数を聞いて直接出す
  async function 割り付ける(r: Rec): Promise<boolean> {
    const z = await api.get<{ 受注: Rec; rows: Rec[] }>("/api/ws/juchu/zaiko", { jid: String(r.受注ID), soko: String(soko ?? 0) });
    const j = z.受注;
    if (!z.rows.length) {
      if (!confirm(`${j.商品名} の在庫がありません。直接出力しますか?`)) return false;
      const v = prompt(`受注元数：${全角(j.ケース ?? 0)}\n数量を入力してください。`, String(j.残ケース ?? 0));
      if (v === null) return false;
      const 数 = Number(v) || 0;
      if (!confirm(`受注元数：${全角(j.ケース ?? 0)}\n抽 出 数：${全角(数)}\nでよろしいですか？`)) return false;
      await api.post("/api/ws/juchu/out", { 輸送ID, 受注ID: j.受注ID, 倉庫ID: soko ?? 0, 直接ケース: 数 });
      return true;
    }
    const kg = z.rows.reduce((a, x) => a + (x.在庫kg ?? 0), 0);
    if (!confirm(`${j.商品名}\n合計${z.rows.length}件\n重量 ${kg ? num(kg) : ""} kgまでを表示します`)) return false;
    const 選んだ = await new Promise<{ 認識ID: string; ケース: number; kg: number }[] | null>((resolve) =>
      set在庫画面({ data: { rows: z.rows, 本社依頼kg: null, 本社依頼残kg: null, 表題: "" }, 受注: j, resolve }),
    );
    set在庫画面(null);
    if (!選んだ || 選んだ.length === 0) return false; // 何も選ばずに閉じたときはやめる
    await api.post("/api/ws/juchu/out", { 輸送ID, 受注ID: j.受注ID, 倉庫ID: soko ?? 0, 選んだ });
    return true;
  }

  const 割付の確認 = () =>
    confirm(`出荷日：${String(plan?.出荷計画日 ?? "").slice(0, 10).replace(/-/g, "/")} ${plan?.運送会社名 ?? ""}に割付ますがよろしいですか?`);

  // 個別選択（Access の cmd_選択_Click）
  async function 個別(r: Rec) {
    if (!soko) return alert("出荷場所が選択されていません。");
    if (!割付の確認()) return 閉じる();
    try {
      await 割り付ける(r);
    } catch (e) {
      alert(e instanceof ApiError ? e.message : String(e));
    }
    閉じる();
  }

  // 複数選択実行（Access の cmd_マルチ選択実行。印の付いた受注を、納品日・受注ID・商品コードの順に）
  async function 複数() {
    if (割付の確認()) {
      const list = rows
        .filter((r) => r.chk)
        .sort((a, b) => String(a.納品日 ?? "").localeCompare(String(b.納品日 ?? "")) || a.受注ID - b.受注ID || a.商品コード - b.商品コード);
      for (const r of list) {
        try {
          await 割り付ける(r);
        } catch (e) {
          alert(e instanceof ApiError ? e.message : String(e));
        }
      }
    }
    閉じる();
  }

  async function 閉じる() {
    await api.post("/api/ws/juchu/close", {});
    nav(輸送ID && plan ? `/ws?date=${String(plan.出荷計画日).slice(0, 10)}&id=${輸送ID}` : "/ws");
  }

  async function 印(r: Rec, on: boolean) {
    setRows(rows.map((x) => (x === r ? { ...x, chk: on } : x)));
    await api.post("/api/ws/juchu/chk", { 受注ID: r.受注ID, chk: on });
  }

  const 計 = rows.reduce((a, r) => ({ c: a.c + (r.ケース ?? 0), kg: a.kg + (r.商品kg ?? 0) }), { c: 0, kg: 0 });
  return (
    <div className="wj">
      <div className="tabs">
        <span>メインメニュー</span>
        <span>FM_出荷明細票</span>
        <span>F_インポート処理</span>
        <span className="active">F_受注検索</span>
      </div>
      <div className="wj-top">
        <div className="wj-left">
          <div className="wj-tabs">
            <button className="on">個別受注</button>
            <button disabled title="年間受注の割り振りは、このあと作ります">年間受注</button>
          </div>
          <div className="wj-methods">
            {methods.map((m) => (
              <button key={m.id} className={方法 === m.id ? "on" : ""} onClick={() => 方法を選ぶ(m.id)}>{m.name}</button>
            ))}
          </div>
        </div>
        <div className="wj-mid">
          <div className="wj-title">{表題}</div>
          {buttons && (
            <div className="wj-buttons">
              {buttons.map((b, i) => (
                <button key={i} onClick={() => ボタンを押す(b)}>{b.name ?? ""}</button>
              ))}
            </div>
          )}
          {日付欄 && (
            <div className="wj-dates">
              <div className="months">
                {Array.from({ length: 12 }, (_, i) => (
                  <button key={i} onClick={() => 月(i + 1)}>{i + 1}月</button>
                ))}
              </div>
              <button onClick={() => setCal(true)}>納品日検索</button>
              <Field value={cond.d1 || null} kind="date" className="d" onCommit={(v) => {
                const d = parseDate(v);
                if (!d) return alert("日付の書き方が正しくありません。（例：10/28）");
                納品日(d, cond.d2 || d);
              }} />
              <span>から</span>
              <Field value={cond.d2 || null} kind="date" className="d" onCommit={(v) => {
                const d = parseDate(v);
                if (!d) return alert("日付の書き方が正しくありません。（例：10/28）");
                納品日(cond.d1 || d, d);
              }} />
            </div>
          )}
          {番号欄 && (
            <div className="wj-row">
              <span className="lbl">{番号欄 === "toitsu" ? "発注No検索" : "受注ID検索"}</span>
              <Field value="" className="w2" onCommit={async (v) => {
                const c = { ...cond, [番号欄]: v.trim() };
                setCond(c);
                await 一覧(c);
              }} />
            </div>
          )}
          {商品欄 && (
            <div className="wj-row">
              <span className="lbl">商品検索</span>
              <Field value={cond.shohin || null} kind="num" kyotsu="shohin" onCommit={async (v) => {
                const c = { ...cond, shohin: Number(v) || 0 };
                setCond(c);
                await 一覧(c);
              }} />
            </div>
          )}
          {場所欄 && (
            <div className="wj-row soko">
              <span className="lbl">出荷場所選択</span>
              <Field value={soko} kind="num" kyotsu="tokui" onCommit={出荷場所} />
              <span className="name">{sokoName}</span>
            </div>
          )}
        </div>
        <div className="wj-right">
          <button onClick={() => 最新()}>最新情報に更新</button>
          <button className="blue" onClick={() => { set方法(0); クリア(); }}>検索条件クリア</button>
          <PageClose onClick={閉じる} />
        </div>
      </div>
      <div className="wj-list">
        <table className="ws-grid">
          <thead>
            <tr>
              <th>複数<br />選択</th><th>自社<br />No</th><th>受注番号</th><th>コード</th><th>届け先</th><th>コード</th><th>製品名</th><th>規格</th>
              <th>納品予定日</th><th>ケース</th><th>残</th><th>商品kg</th><th>個別<br />選択</th><th>詳細</th><th>備考</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.受注ID} className={r.chk ? "picked" : ""}>
                <td className="c"><input type="checkbox" checked={!!r.chk} onChange={(e) => 印(r, e.target.checked)} /></td>
                <td className="r">{r.受注ID}</td>
                <td>{r.受注番号}</td>
                <td className="r kc">{r.届け先コード}</td>
                <td>{r.届け先}</td>
                <td className="r kc">{r.商品コード}</td>
                <td className="bold">{r.商品名}</td>
                <td>{r.規格}</td>
                <td>{月日(r.納品日)}</td>
                <td className="r">{num(r.ケース)}</td>
                <td className={"r bold" + ((r.残ケース ?? 0) > 0 ? " zan" : "")}>{num(r.残ケース)}</td>
                <td className="r">{num(r.商品kg)}</td>
                <td><button className="small" onClick={() => 個別(r)}>選択</button></td>
                <td><button className="small" onClick={async () => setRireki(await api.get<Rec[]>(`/api/ws/juchu/rireki/${r.受注ID}`))}>表示</button></td>
                <td className="note">{r.備考}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="wj-foot">
        <button onClick={複数}>複数選択実行</button>
        <span className="sp" />
        <span className="k">件数</span><span className="v">{rows.length}</span>
        <span className="k">ケース計</span><span className="v">{num(計.c)}</span>
        <span className="k">Kg計</span><span className="v">{num(計.kg)}</span>
      </div>
      {cal && (
        <CalendarDialog
          value={cond.d1 || null}
          onClose={() => setCal(false)}
          onPick={(d) => {
            setCal(false);
            納品日(d, d, true);
          }}
        />
      )}
      {rireki && (
        <div className="modal" onClick={() => setRireki(null)}>
          <div className="nt" onClick={(e) => e.stopPropagation()}>
            <div className="nt-head">受注履歴<button onClick={() => setRireki(null)}>閉じる</button></div>
            <table className="ws-grid">
              <thead>
                <tr><th>出荷日</th><th>配車伝票No</th><th>届け先</th><th>出荷場所</th><th>商品名</th><th>ケース</th><th>商品kg</th><th>納品日</th><th></th></tr>
              </thead>
              <tbody>
                {rireki.map((x) => (
                  <tr key={x.出庫ID}>
                    <td>{String(x.出荷日 ?? "").slice(0, 10).replace(/-/g, "/")}</td>
                    <td className="r">{x.輸送ID || ""}</td>
                    <td>{x.届け先}</td>
                    <td>{x.倉庫名}</td>
                    <td className="bold">{x.商品名}</td>
                    <td className="r">{num(x.ケース)}</td>
                    <td className="r">{num(x.商品kg)}</td>
                    <td>{月日(x.納品日)}</td>
                    <td>
                      {x.輸送ID ? (
                        <button className="small" onClick={async () => { await api.post("/api/ws/juchu/close", {}); nav(`/ws?date=${String(x.出荷日).slice(0, 10)}&id=${x.輸送ID}`); }}>移る</button>
                      ) : ""}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {rireki.length === 0 && <p className="wsi-err">この受注の出荷はまだありません。</p>}
          </div>
        </div>
      )}
      {在庫画面 && (
        <KibouDialog
          data={在庫画面.data as any}
          輸送ID={輸送ID}
          出荷予定日={String(plan?.出荷計画日 ?? "").slice(0, 10)}
          shohin={在庫画面.受注.商品コード}
          soko={soko ?? 0}
          onClose={() => 在庫画面.resolve(null)}
          受注分={{ 品名: 在庫画面.受注.商品名, 残ケース: 在庫画面.受注.残ケース ?? 0, onPick: (sel) => 在庫画面.resolve(sel) }}
        />
      )}
    </div>
  );
}
