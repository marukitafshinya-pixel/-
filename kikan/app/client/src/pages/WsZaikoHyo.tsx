import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { api, ApiError, num } from "../api";
import { Field, parseDate, PageClose } from "../formParts";

type Rec = Record<string, any>;
type 選択肢 = { id: number; name: string | null };
const 年月日2 = (v: string | null | undefined) => (v ? v.slice(2, 10).replace(/-/g, "/") : "");
const 分類色: Record<string, string> = { ソテー: "sot", ペースト: "pas", ミンチ: "min" };

/** 在庫表（Access の FM_商品別在庫）。保管庫ごとの商品別の在庫。商品コードをダブルクリックで保管庫詳細へ */
export function WsZaikoHyo() {
  const nav = useNavigate();
  const [sp, setSp] = useSearchParams();
  const [soko, setSoko] = useState(Number(sp.get("soko") ?? 11));
  const [sokos, setSokos] = useState<選択肢[]>([]);
  const [kubun, setKubun] = useState<選択肢[]>([]);
  const [区分, set区分] = useState(0);
  const [宛名, set宛名] = useState("");
  const [rows, setRows] = useState<Rec[]>([]);

  useEffect(() => {
    api.get<選択肢[]>("/api/ws/hokan/soko").then(setSokos);
    api.get<選択肢[]>("/api/ws/hokan/kubun").then(setKubun);
  }, []);
  useEffect(() => {
    setSp({ soko: String(soko) }, { replace: true });
    api.get<Rec[]>("/api/ws/zaikohyo", { soko }).then(setRows);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [soko]);

  const i = sokos.findIndex((s) => s.id === soko);
  const 移る = (j: number) => sokos[j] && setSoko(sokos[j].id);
  const 計 = (k: string) => rows.reduce((a, r) => a + Number(r[k] ?? 0), 0);
  const 丸め = (v: number) => num(Math.round(v * 100) / 100);
  return (
    <div className="zh">
      <div className="tabs">
        <span>メインメニュー</span>
        <span className="active">在庫表</span>
      </div>
      <div className="zh-top">
        <div className="zh-col">
          <div className="lbl">宛名</div>
          <input value={宛名} onChange={(e) => set宛名(e.target.value)} title="担当者などを入れる欄です（印刷に出します）" />
        </div>
        <div className="zh-col">
          <div className="lbl">保管庫</div>
          <div className="row">
            <select value={soko} onChange={(e) => setSoko(Number(e.target.value))}>
              {sokos.map((s) => <option key={s.id} value={s.id}>{s.id}</option>)}
            </select>
            <span className="name">{sokos[i]?.name ?? ""}</span>
          </div>
        </div>
        <div className="zh-nav">
          <button onClick={() => 移る(0)} title="はじめの保管庫">|◀</button>
          <button onClick={() => 移る(i - 1)} title="前の保管庫">◀</button>
          <button onClick={() => 移る(i + 1)} title="次の保管庫">▶</button>
          <button onClick={() => 移る(sokos.length - 1)} title="さいごの保管庫">▶|</button>
        </div>
        <div className="zh-col">
          <div className="lbl">区分</div>
          <div className="row">
            <select value={区分} onChange={(e) => set区分(Number(e.target.value))} title="Access と同じく、一覧は区分では絞りません">
              {kubun.map((k) => <option key={k.id} value={k.id}>{k.id}</option>)}
            </select>
            <span className="name">{kubun.find((k) => k.id === 区分)?.name ?? ""}</span>
          </div>
        </div>
        <div className="zh-btns">
          <button className="blue" disabled title="帳票（④）で作ります">ふらの在庫印刷</button>
          <div className="box">
            <button className="green" disabled title="帳票（④）で作ります">Exellに出力</button>
            <button className="blue" disabled title="帳票（④）で作ります">伝票印刷</button>
            <PageClose fallback="/maruhoku" />
          </div>
        </div>
      </div>
      <div className="zh-list">
        <table className="zh-grid">
          <thead>
            <tr>
              <th>分類</th><th>コード</th><th>商品名</th><th>規格</th><th className="g">繰越</th><th className="b">製造</th><th className="o">出庫</th><th>在庫</th><th className="p">未包装</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, k) => (
              <tr key={k}>
                <td className={"bunrui " + (分類色[r.分類名] ?? "")}>{r.分類名}</td>
                <td className="r code" onDoubleClick={() => nav(`/ws/hokan?soko=${soko}&shohin=${r.商品コード}`)} title="ダブルクリックで保管庫詳細を開きます">{r.商品コード}</td>
                <td className="bold">{r.商品名}</td>
                <td className="kikaku">{r.規格}</td>
                <td className="r g">{丸め(r.繰越kg)}</td>
                <td className="r b">{丸め(r.製造kg)}</td>
                <td className="r o">{丸め(r.出荷kg)}</td>
                <td className="r">{丸め(r.在庫kg)}</td>
                <td className="r p">{丸め(r.未包装kg)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="zh-foot">
        <span className="r g">{丸め(計("繰越kg"))}</span>
        <span className="r b">{丸め(計("製造kg"))}</span>
        <span className="r o">{丸め(計("出荷kg"))}</span>
        <span className="r">{丸め(計("在庫kg"))}</span>
        <span className="r p">{丸め(計("未包装kg"))}</span>
      </div>
    </div>
  );
}

/** 保管庫詳細（Access の FM_保管庫）。保管庫の 1 商品の在庫（ロットごと）。［修正］で直せるようになる */
export function WsHokan() {
  const nav = useNavigate();
  const [sp, setSp] = useSearchParams();
  const [soko, setSoko] = useState(Number(sp.get("soko") ?? 11));
  const [sokoName, setSokoName] = useState("");
  const [mode, setMode] = useState(1);
  const [shohins, setShohins] = useState<選択肢[]>([]);
  const [shohin, setShohin] = useState<number | null>(sp.get("shohin") ? Number(sp.get("shohin")) : null);
  const [rows, setRows] = useState<Rec[]>([]);
  const [kubun, setKubun] = useState<選択肢[]>([]);
  const [合言葉, set合言葉] = useState<string | null>(null);
  const [間違い, set間違い] = useState(0);
  const [履歴, set履歴] = useState<Rec[] | null>(null);
  const [振替, set振替] = useState<number | null>(null);

  useEffect(() => {
    api.get<選択肢[]>("/api/ws/hokan/kubun").then(setKubun);
  }, []);
  // 保管庫を変えたら商品の一覧を作り直し、いちばん小さい商品コードを出す（Access の cmb_倉庫_AfterUpdate）。
  // 在庫表から開いたときや、在庫表示を変えたときは、いまの商品のまま
  const [前の保管庫, set前の保管庫] = useState(soko);
  useEffect(() => {
    api.get<{ 短縮名: string }>(`/api/ws/hokan/name/${soko}`).then((r) => setSokoName(r.短縮名));
    api.get<選択肢[]>("/api/ws/hokan/shohin", { soko, mode }).then((list) => {
      setShohins(list);
      if (shohin === null || soko !== 前の保管庫) setShohin(list[0]?.id ?? null);
      set前の保管庫(soko);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [soko, mode]);
  const load = () => (shohin !== null ? api.get<Rec[]>("/api/ws/hokan", { soko, shohin, mode }).then(setRows) : Promise.resolve(setRows([])));
  useEffect(() => {
    setSp({ soko: String(soko), ...(shohin !== null ? { shohin: String(shohin) } : {}) }, { replace: true });
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [soko, shohin, mode]);

  const i = shohins.findIndex((s) => s.id === shohin);
  const 移る = (j: number) => shohins[j] && setShohin(shohins[j].id);

  async function 修正() {
    if (合言葉 !== null) return;
    const p = prompt("パスワードを入力してください");
    if (p === null) return;
    const r = await api.post<{ ok: boolean }>("/api/ws/hokan/unlock", { 合言葉: p }).catch((e) => (alert(e instanceof ApiError ? e.message : String(e)), null));
    if (!r) return;
    if (r.ok) {
      set合言葉(p);
      alert("修正可能になりました");
    } else {
      const k = 間違い + 1;
      set間違い(k);
      alert(`パスワードが違います!!\n${k} 回目`);
      if (k > 2) nav("/"); // Access と同じく 3 回まちがえると閉じる
    }
  }

  async function 直す(r: Rec, 項目: string, 値: unknown) {
    try {
      const res = await api.post<{ 通知: number | null }>("/api/ws/hokan/save", { 合言葉, 在庫ID: r.在庫ID, 項目, 値 });
      if (res.通知 !== null) alert(`変更により、出荷計画に${res.通知} 件の変更通知を送ります。`);
      await load();
    } catch (e) {
      alert(e instanceof ApiError ? e.message : String(e));
    }
  }
  const ro = 合言葉 === null;
  const 数 = (r: Rec, k: string, cls = "") => (
    <Field value={r[k]} kind="num" className={"hk-n " + cls} readOnly={ro} onCommit={(v) => 直す(r, k, v.trim() === "" ? null : Number(v))} />
  );
  const 日 = (r: Rec, k: string, cls = "") => (
    <Field value={r[k]} kind="date" className={"hk-d " + cls} readOnly={ro} onCommit={(v) => {
      const d = parseDate(v);
      if (d === undefined) return alert("日付の書き方が正しくありません。（例：10/28）");
      直す(r, k, d);
    }} />
  );
  const ケース計 = rows.reduce((a, r) => a + Number(r.在庫ケース ?? 0), 0);
  const kg計 = rows.reduce((a, r) => a + Number(r.在庫kg ?? 0), 0);
  return (
    <div className="hk">
      <div className="tabs">
        <span>メインメニュー</span>
        <span>在庫表</span>
        <span className="active">保管庫詳細</span>
      </div>
      <div className="hk-top">
        <div className="zh-col">
          <div className="lbl">保管庫</div>
          <div className="row">
            <Field value={soko} kind="num" className="hk-code" kyotsu="tokui" onCommit={(v) => Number(v) && setSoko(Number(v))} />
            <span className="name">{sokoName}</span>
          </div>
        </div>
        <div className="zh-nav">
          <button onClick={() => 移る(0)} title="はじめの商品">|◀</button>
          <button onClick={() => 移る(i - 1)} title="前の商品">◀</button>
          <button onClick={() => 移る(i + 1)} title="次の商品">▶</button>
          <button onClick={() => 移る(shohins.length - 1)} title="さいごの商品">▶|</button>
        </div>
        <div className="zh-col">
          <div className="lbl">商品名</div>
          <div className="row">
            <select value={shohin ?? ""} onChange={(e) => setShohin(Number(e.target.value))}>
              {shohin !== null && i < 0 && <option value={shohin}>{shohin}</option>}
              {shohins.map((s) => <option key={s.id} value={s.id}>{s.id}</option>)}
            </select>
            <span className="name blue">{shohins[i]?.name ?? rows[0]?.商品名 ?? ""}</span>
          </div>
        </div>
        <div className="zh-col">
          <div className="lbl">在庫表示</div>
          <div className="row tg">
            <button className={mode === -1 ? "on" : ""} onClick={() => setMode(-1)}>全表示</button>
            <button className={mode === 0 ? "on" : ""} onClick={() => setMode(0)} title="40 日以内に出庫したものと、在庫のあるもの">通常</button>
            <button className={mode === 1 ? "on" : ""} onClick={() => setMode(1)}>現在庫</button>
          </div>
        </div>
      </div>
      <div className="hk-list">
        <table className="hk-grid">
          <thead>
            <tr>
              <th>振替</th><th>入庫日</th><th>商品区分</th><th>名義</th><th>規格/入数</th><th>製造・賞味</th><th>ﾛｯﾄ番号</th><th>元数</th>
              <th>繰越</th><th>入庫</th><th className="o">出庫</th><th>在庫</th><th>出荷止め</th><th>検査区分</th><th>産地</th><th>製造工場</th><th>在庫ID</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.在庫ID}>
                <td className="c"><button className="hk-furi" onClick={() => set振替(r.在庫ID)} title="在庫振替（在庫訂正）">振<br />替</button></td>
                <td>{日(r, "入庫日", "bold")}</td>
                <td>
                  <select value={r.商品区分 ?? ""} disabled={ro} onChange={(e) => 直す(r, "商品区分", Number(e.target.value))}>
                    {kubun.map((k) => <option key={k.id} value={k.id}>{k.name}</option>)}
                  </select>
                </td>
                <td>
                  <Field value={r.入庫後名義ID} kind="num" className="hk-code" kyotsu="tokui" readOnly={ro} onCommit={(v) => 直す(r, "入庫後名義ID", Number(v) || 0)} />
                  <div className="small">{r.名義名}</div>
                </td>
                <td className="c"><div className="bold">{r.規格}</div><div>{r.入数}</div></td>
                <td>
                  <div className="navy">{日(r, "製造日")}</div>
                  <div className="orange">{日(r, "賞味期限")}</div>
                  {r.賞味期限通知 && <div className="red small">{r.賞味期限通知}</div>}
                </td>
                <td><Field value={r.タグ} className="hk-tag" readOnly={ro} onCommit={(v) => 直す(r, "タグ", v || null)} /></td>
                <td className="r maroon">{数(r, "入庫元数")}</td>
                <td>{数(r, "繰越ケース")}<div className="r small">{num(r.繰越kg)}</div></td>
                <td>{数(r, "製造ケース", "blue")}<div className="r small blue">{num(r.製造kg)}</div></td>
                <td onDoubleClick={async () => set履歴(await api.get<Rec[]>(`/api/ws/hokan/shukka/${r.在庫ID}`))} title="ダブルクリックで出荷履歴が見られます">
                  {数(r, "出庫ケース", "orange")}
                  <div className="r small orange">{num(r.出荷kg)}</div>
                </td>
                <td className="zaiko">{数(r, "在庫ケース", "bold")}<div className="r small">{num(r.在庫kg)}</div></td>
                <td className="tome">
                  <label><input type="checkbox" checked={!!r.出荷止め区分} disabled={ro} onChange={(e) => 直す(r, "出荷止め区分", e.target.checked)} /> 止め</label>
                  <Field value={r.管理備考} className="hk-memo" readOnly={ro} onCommit={(v) => 直す(r, "管理備考", v || null)} />
                </td>
                <td><Field value={r.検査区分} className="hk-memo" readOnly={ro} onCommit={(v) => 直す(r, "検査区分", v || null)} /></td>
                <td><Field value={r.産地コード || ""} kind="num" className="hk-code" readOnly={ro} onCommit={(v) => 直す(r, "産地コード", Number(v) || 0)} /></td>
                <td><Field value={r.製造工場ID || ""} kind="num" className="hk-code" kyotsu="tokui" readOnly={ro} onCommit={(v) => 直す(r, "製造工場ID", Number(v) || 0)} /><div className="small">{r.製造工場名2 ?? r.製造工場名}</div></td>
                <td className="r">{r.在庫ID}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {rows.length === 0 && <p className="wsi-err">表示する在庫はありません。</p>}
      </div>
      <div className="hk-foot">
        <span className="k">ケース計</span><span className="v">{num(ケース計)}</span>
        <span className="k">Kg計</span><span className="v">{num(Math.round(kg計 * 100) / 100)}</span>
        <span className="sp" />
        <div className="box">
          <button className={"red" + (ro ? "" : " on")} onClick={修正}>{ro ? "修正" : "修正中"}</button>
          <button className="green" disabled title="帳票（④）で作ります">Exel出力</button>
          <PageClose fallback="/maruhoku" />
        </div>
      </div>
      {振替 !== null && (
        <FurikaeDialog
          在庫ID={振替}
          onClose={async (変えた) => {
            set振替(null);
            if (変えた) await load();
          }}
        />
      )}
      {履歴 && (
        <div className="modal" onClick={() => set履歴(null)}>
          <div className="nt" onClick={(e) => e.stopPropagation()}>
            <div className="nt-head">出荷履歴<button onClick={() => set履歴(null)}>閉じる</button></div>
            <table className="ws-grid">
              <thead><tr><th>出荷日</th><th>配車伝票No</th><th>届け先</th><th>出荷場所</th><th>商品名</th><th>ケース</th><th>商品kg</th><th>積込</th></tr></thead>
              <tbody>
                {履歴.map((x) => (
                  <tr key={x.出庫ID}>
                    <td>{年月日2(x.出荷日)}</td>
                    <td className="r">{x.輸送ID || ""}</td>
                    <td>{x.届け先}</td>
                    <td>{x.倉庫名}</td>
                    <td className="bold">{x.商品名}</td>
                    <td className="r">{num(x.ケース)}</td>
                    <td className="r">{num(x.商品kg)}</td>
                    <td className="c">{x.chk ? "済" : ""}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {履歴.length === 0 && <p className="wsi-err">この在庫の出荷はありません。</p>}
          </div>
        </div>
      )}
    </div>
  );
}

/** 在庫振替（Access の FSD_在庫訂正）。在庫の 1 ロットから、破損・原料・サンプルなどで数を落とす。製品化・原料化・出荷停止は別の在庫の行に振り替える */
export function FurikaeDialog(props: { 在庫ID: number; onClose: (変えた: boolean) => void }) {
  const [d, setD] = useState<{ 在庫: Rec; rows: Rec[]; 振替先: 選択肢[]; 今日: string } | null>(null);
  const [新, set新] = useState<{ 変更日: string; ケース: string; 移動先ID: number; 備考: string }>({ 変更日: "", ケース: "0", 移動先ID: 0, 備考: "" });
  const load = () => api.get<any>(`/api/ws/furikae/${props.在庫ID}`).then((r) => {
    setD(r);
    set新((x) => ({ ...x, 変更日: x.変更日 || r.今日 }));
  });
  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.在庫ID]);
  if (!d) return null;
  const z = d.在庫;
  const 月日 = (v: string | null | undefined) => (v ? `${v.slice(5, 7)}月${v.slice(8, 10)}日` : "");
  const 失敗 = (e: unknown) => alert(e instanceof ApiError ? e.message : String(e));

  async function 直す(h: Rec, 項目: string, 値: unknown) {
    try {
      await api.post("/api/ws/furikae/save", { 変更No: h.変更No, 項目, 値 });
      await load();
    } catch (e) {
      失敗(e);
    }
  }
  async function 足す() {
    try {
      await api.post("/api/ws/furikae/add", { 在庫ID: z.在庫ID, 変更日: 新.変更日, ケース: Number(新.ケース) || 0, 移動先ID: 新.移動先ID, 備考: 新.備考 });
      set新({ 変更日: d!.今日, ケース: "0", 移動先ID: 0, 備考: "" });
      await load();
    } catch (e) {
      失敗(e);
    }
  }
  async function 登録(h: Rec) {
    if (!confirm("在庫振替を行います。よろしいですか？")) return;
    try {
      const r = await api.post<{ 通知: number }>("/api/ws/furikae/toroku", { 変更No: h.変更No });
      alert(`変更により、出荷計画に${r.通知} 件の変更通知を送ります。`);
      props.onClose(true); // Access と同じく、登録したら閉じる
    } catch (e) {
      失敗(e);
    }
  }
  const 先 = (id: number) => d.振替先.find((x) => x.id === id)?.name ?? "";
  return (
    <div className="modal">
      <div className="fk">
        <div className="fk-head">
          <div className="fk-memo">{z.管理備考}</div>
          <div className="fk-kv">
            <span>保管庫</span><b>{z.倉庫名}</b>
            <span>商品名</span><b>{z.商品名}</b>
            <span>製造/賞味</span><b><i>{年月日2(z.製造日)}</i><i className="o">{年月日2(z.賞味期限)}</i></b>
            <span>入庫名義</span><b className="c">{z.名義名 ? `${z.名義名} 名義` : ""}</b>
            <span>入庫No</span><b>{z.入庫No}</b>
          </div>
        </div>
        <table className="fk-sum">
          <thead><tr><th>No.</th><th>入庫元数</th><th>数量</th><th>Kg</th><th>入庫日</th><th>特筆備考</th></tr></thead>
          <tbody><tr><td className="r">{z.在庫ID}</td><td className="r">{num(z.入庫元数)}</td><td className="r">{num(z.在庫ケース)}</td><td className="r">{num(z.在庫kg)}</td><td>{月日(z.入庫日)}</td><td>{z.備考在庫}</td></tr></tbody>
        </table>
        <div className="fk-list">
          <table className="fk-grid">
            <thead><tr><th>登録</th><th>変更日</th><th>数量</th><th>Kg</th><th>振替先</th><th>備考</th></tr></thead>
            <tbody>
              {d.rows.map((h) => (
                <tr key={h.変更No}>
                  <td className="c"><button className="fk-btn" disabled={h.変更Check} onClick={() => 登録(h)}>登録</button></td>
                  <td className="day">{h.変更Check ? 月日(h.変更日) : <Field value={h.変更日} kind="date" className="fk-d" onCommit={(v) => { const x = parseDate(v); if (x) 直す(h, "変更日", x); }} />}</td>
                  <td className="r">{h.変更Check ? num(h.ケース) : <Field value={h.ケース} kind="num" className="fk-n" onCommit={(v) => 直す(h, "ケース", Number(v) || 0)} />}</td>
                  <td className="r">{num(h.商品kg)}</td>
                  <td className="saki">
                    {h.変更Check ? <b>{先(h.移動先ID) || h.移動先名}</b> : (
                      <select value={h.移動先ID ?? 0} onChange={(e) => 直す(h, "移動先ID", Number(e.target.value))}>
                        {d.振替先.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
                      </select>
                    )}
                    {h.変更Check && <div className="red small">登録済み</div>}
                  </td>
                  <td>{h.変更Check ? h.備考 : <Field value={h.備考} className="fk-memo2" onCommit={(v) => 直す(h, "備考", v || null)} />}</td>
                </tr>
              ))}
              <tr className="new">
                <td className="c"><button className="fk-btn" onClick={足す} title="この行を足します（登録はまだしません）">追加</button></td>
                <td><Field value={新.変更日} kind="date" className="fk-d" onCommit={(v) => { const x = parseDate(v); if (x) set新({ ...新, 変更日: x }); }} /></td>
                <td><input className="fk-n r" value={新.ケース} onChange={(e) => set新({ ...新, ケース: e.target.value })} /></td>
                <td />
                <td>
                  <select value={新.移動先ID} onChange={(e) => set新({ ...新, 移動先ID: Number(e.target.value) })}>
                    {d.振替先.map((x) => <option key={x.id} value={x.id} title={(x as any).備考}>{x.name}</option>)}
                  </select>
                </td>
                <td><input className="fk-memo2" value={新.備考} onChange={(e) => set新({ ...新, 備考: e.target.value })} /></td>
              </tr>
            </tbody>
          </table>
        </div>
        <div className="fk-foot">
          <div className="box">
            <button className="green" disabled title="帳票（④）で作ります">Exel出力</button>
            <button className="blue" disabled title="帳票（④）で作ります">伝票印刷</button>
            <button onClick={() => props.onClose(false)}>閉じる</button>
          </div>
        </div>
      </div>
    </div>
  );
}
