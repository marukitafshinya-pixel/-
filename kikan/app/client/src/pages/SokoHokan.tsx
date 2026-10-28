import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { api, ApiError, num, 処理中 } from "../api";
import { Field, parseDate, PageClose } from "../formParts";

type Rec = Record<string, any>;
type 選択肢 = { id: number; name: string | null; 規格?: string | null };
const エラー = (e: unknown) => alert(e instanceof ApiError ? e.message : String(e));
const 年月日2 = (v: string | null | undefined) => (v ? v.slice(2, 10).replace(/-/g, "/") : "");

/** 開いたときの点検は 1 回だけ（Access は開くたびだが、画面の中で冷蔵庫を変えても点検しない） */
let 点検済み = false;

/**
 * 倉庫商品一覧（Access の FM_保管倉庫）。冷蔵庫・商品を選んでロットの一覧を出す。開くときに入庫・出庫の点検（C_UnMachCheck）をする。
 * ［修正］でパスワードを入れると直せる。ケースを直すとそのロットの保管料の明細を作り直す。
 */
export function SokoHokan() {
  const nav = useNavigate();
  const [sp] = useSearchParams();
  /** 商品別在庫から開いたときの冷蔵庫・商品 */
  const [指定] = useState(() => ({ soko: Number(sp.get("soko")) || null, shohin: Number(sp.get("shohin")) || null }));
  const [soko, setSoko] = useState<number | null>(null);
  const [sokoName, setSokoName] = useState("");
  const [mode, setMode] = useState(0);
  const [shohins, setShohins] = useState<選択肢[]>([]);
  const [shohin, setShohin] = useState<number | null>(null);
  const [rows, setRows] = useState<Rec[]>([]);
  const [合言葉, set合言葉] = useState<string | null>(null);
  const [間違い, set間違い] = useState(0);
  const [詳細, set詳細] = useState<number | null>(null);
  const [履歴, set履歴] = useState<number | null>(null);
  const [訂正, set訂正] = useState<{ id: number; 合言葉: string } | null>(null);

  useEffect(() => {
    // 開くとき：点検（Access の Form_Open → C_UnMachCheck）と、在庫のあるいちばん大きい冷蔵庫
    (async () => {
      if (!点検済み) {
        try {
          const r = await 処理中(() => api.post<{ soko: number }>("/api/soko/hokan/open", {}));
          点検済み = true;
          setSoko(指定.soko ?? r.soko);
          return;
        } catch (e) {
          エラー(e);
        }
      }
      setSoko(指定.soko ?? (await api.get<選択肢[]>("/api/soko/hokan/soko").catch(() => []))[0]?.id ?? 0);
    })();
  }, []);
  // 冷蔵庫・在庫表示を変えたら商品の一覧を作り直し、いちばん小さい商品コードを出す（cmb_倉庫_AfterUpdate）
  useEffect(() => {
    if (soko === null) return;
    api.get<{ 短縮名: string }>(`/api/soko/hokan/name/${soko}`).then((r) => setSokoName(r.短縮名 ?? "")).catch(エラー);
    api
      .get<{ list: 選択肢[]; 最初: number | null }>("/api/soko/hokan/shohin", { soko: String(soko), mode: String(mode) })
      .then((r) => {
        setShohins(r.list);
        setShohin(指定.soko === soko && 指定.shohin ? 指定.shohin : r.最初);
      })
      .catch(エラー);
  }, [soko, mode]);
  const load = () =>
    soko !== null && shohin !== null
      ? api.get<Rec[]>("/api/soko/hokan", { soko: String(soko), shohin: String(shohin), mode: String(mode) }).then(setRows).catch(エラー)
      : Promise.resolve(setRows([]));
  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [soko, shohin, mode]);

  const ids = [...new Set(shohins.map((s) => s.id))];
  const i = ids.indexOf(shohin ?? -1);
  const 移る = (j: number) => ids[j] !== undefined && setShohin(ids[j]);

  async function パスワード(): Promise<string | null> {
    const p = prompt("パスワードを入力してください");
    if (p === null) return null;
    const r = await api.post<{ ok: boolean }>("/api/soko/hokan/unlock", { 合言葉: p }).catch((e) => (エラー(e), null));
    if (!r) return null;
    if (r.ok) return p;
    const k = 間違い + 1;
    set間違い(k);
    alert(`パスワードが違います!!\n${k} 回目`);
    if (k > 2) nav("/soko"); // Access と同じく 3 回まちがえると閉じる
    return null;
  }
  async function 修正() {
    if (合言葉 !== null) return;
    const p = await パスワード();
    if (p === null) return;
    set合言葉(p);
    alert("修正可能になりました (^0^)/ ");
  }
  async function 直す(r: Rec, 項目: string, 値: unknown) {
    try {
      await api.post("/api/soko/hokan/save", { 合言葉, 在庫ID: r.在庫ID, 項目, 値, soko, shohin });
    } catch (e) {
      エラー(e);
    }
    await load();
  }
  async function 行を足す() {
    if (soko === null || shohin === null) return;
    await api.post("/api/soko/hokan/add", { 合言葉, soko, shohin }).catch(エラー);
    await load();
  }
  async function 保管料詳細(r: Rec) {
    await api.post("/api/soko/hokan/kikan", { 在庫ID: r.在庫ID }).catch(エラー);
    set詳細(r.在庫ID);
  }
  async function 処理履歴(r: Rec) {
    const p = 合言葉 ?? (await パスワード());
    if (p !== null) set訂正({ id: r.在庫ID, 合言葉: p });
  }
  async function 出力() {
    if (soko === null) return;
    try {
      await 処理中(async () => {
        const res = await fetch(`/api/soko/hokan/excel?soko=${soko}`, { credentials: "same-origin" });
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

  const ro = 合言葉 === null;
  const 数 = (r: Rec, k: string, cls = "") => (
    <Field value={r[k]} kind="num" className={"hk-n " + cls} readOnly={ro} onCommit={(v) => 直す(r, k, v.trim() === "" ? null : Number(v))} />
  );
  const 日 = (r: Rec, k: string, cls = "") => (
    <Field
      value={r[k]}
      kind="date"
      className={"hk-d " + cls}
      readOnly={ro}
      onCommit={(v) => {
        const d = parseDate(v);
        if (d === undefined) return alert("日付の書き方が正しくありません。（例：10/28）");
        直す(r, k, d);
      }}
    />
  );
  const ケース計 = rows.reduce((a, r) => a + Number(r.在庫ケース ?? 0), 0);
  const kg計 = rows.reduce((a, r) => a + Number(r.在庫kg ?? 0), 0);
  const 商品名 = shohins.find((s) => s.id === shohin);
  return (
    <div className="hk">
      <div className="tabs">
        <span>倉庫管理メニュー</span>
        <span className="active">倉庫商品一覧</span>
      </div>
      <div className="hk-top">
        <div className="zh-col">
          <div className="lbl">冷蔵庫</div>
          <div className="row">
            <Field value={soko} kind="num" className="hk-code" kyotsu="tokui" onCommit={(v) => Number(v) && setSoko(Number(v))} />
            <span className="name">{sokoName}</span>
          </div>
        </div>
        <div className="zh-nav">
          <button onClick={() => 移る(0)} title="はじめの商品">|◀</button>
          <button onClick={() => 移る(i - 1)} title="前の商品">◀</button>
          <button onClick={() => 移る(i + 1)} title="次の商品">▶</button>
          <button onClick={() => 移る(ids.length - 1)} title="さいごの商品">▶|</button>
        </div>
        <div className="zh-col">
          <div className="lbl">商品</div>
          <div className="row">
            <select value={shohin ?? ""} onChange={(e) => setShohin(Number(e.target.value))}>
              {shohin !== null && i < 0 && <option value={shohin}>{shohin}</option>}
              {ids.map((id) => <option key={id} value={id}>{id}</option>)}
            </select>
            <span className="name blue">{商品名?.name ?? rows[0]?.商品名 ?? ""} {商品名?.規格 ?? ""}</span>
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
              <th>入庫日</th><th>負担日・期</th><th>名義</th><th>入庫No</th><th>規格/入数</th><th>製造・賞味</th><th>区分</th><th>元数</th>
              <th>繰越</th><th>入庫</th><th className="o">出庫</th><th>在庫</th><th>出荷止め</th><th>不一致</th><th>保管料</th><th>在庫ID</th><th></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.在庫ID}>
                <td>{日(r, "入庫日", "bold")}</td>
                <td className="c">{年月日2(r.保管料負担日)}<div className="small">{r.期} 期{r.確定フラグ ? "・確定" : ""}</div></td>
                <td>
                  <Field value={r.入庫後名義ID} kind="num" className="hk-code" kyotsu="tokui" readOnly={ro} onCommit={(v) => 直す(r, "入庫後名義ID", Number(v) || 0)} />
                  <div className="small">{r.名義名}</div>
                </td>
                <td><Field value={r.入庫No} className="hk-memo" readOnly={ro} onCommit={(v) => 直す(r, "入庫No", v || null)} /></td>
                <td className="c"><div className="bold">{r.規格}</div><div>{r.入数}</div></td>
                <td>
                  <div className="navy">{日(r, "製造日")}</div>
                  <div className="orange">{日(r, "賞味期限")}</div>
                  {r.賞味期限通知 && <div className="red small">{r.賞味期限通知}</div>}
                </td>
                <td><Field value={r.タグ} className="hk-tag" readOnly={ro} onCommit={(v) => 直す(r, "タグ", v || null)} /></td>
                <td className="r maroon">{数(r, "入庫元数")}</td>
                <td>{数(r, "繰越ケース")}<div className="r small">{num(r.繰越kg)}</div></td>
                <td onDoubleClick={() => set履歴(r.在庫ID)} title="ダブルクリックで入庫履歴が見られます">{数(r, "製造ケース", "blue")}<div className="r small blue">{num(r.製造kg)}</div></td>
                <td onDoubleClick={() => set履歴(r.在庫ID)} title="ダブルクリックで入庫履歴が見られます">
                  {数(r, "出庫ケース", "orange")}
                  <div className="r small orange">{num(r.出荷kg)}</div>
                </td>
                <td className="zaiko">{数(r, "在庫ケース", "bold")}<div className="r small">{num(r.在庫kg)}</div></td>
                <td className="tome">
                  <label><input type="checkbox" checked={!!r.出荷止め区分} disabled={ro} onChange={(e) => 直す(r, "出荷止め区分", e.target.checked)} /> 止め</label>
                  <Field value={r.管理備考} className="hk-memo" readOnly={ro} onCommit={(v) => 直す(r, "管理備考", v || null)} />
                </td>
                <td className="small red pre">{r.不一致フラグ ? r.不一致備考 : ""}</td>
                <td className="r">{num(r.保管料)}</td>
                <td className="r">{r.在庫ID}</td>
                <td className="c">
                  <button onClick={() => 保管料詳細(r)}>保管料詳細</button>
                  <button onClick={() => 処理履歴(r)}>訂正</button>
                </td>
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
          {!ro && <button onClick={行を足す}>行を足す</button>}
          <button className="green" onClick={出力}>出力</button>
          <PageClose fallback="/soko" />
        </div>
      </div>
      {詳細 !== null && <HokanShosai 在庫ID={詳細} onClose={() => { set詳細(null); load(); }} />}
      {履歴 !== null && <NyukoRireki 在庫ID={履歴} onClose={() => set履歴(null)} />}
      {訂正 && (
        <HokanTeisei
          在庫ID={訂正.id}
          合言葉={訂正.合言葉}
          onDetail={(id) => 保管料詳細({ 在庫ID: id })}
          onClose={(変えた) => {
            set訂正(null);
            if (変えた) load();
          }}
        />
      )}
    </div>
  );
}

/** 保管庫詳細（Access の FM_保管庫詳細）。ロットの費用月別集計（期ごとの保管料）。［再計算］で作り直す。冷蔵庫・商品・入庫No・名義でも絞れる */
function HokanShosai(props: { 在庫ID: number; onClose: () => void }) {
  const [条件, set条件] = useState<Rec>({ id: String(props.在庫ID) });
  const [rows, setRows] = useState<Rec[]>([]);
  const load = (c = 条件) => api.get<Rec[]>("/api/soko/hokan/detail", c).then(setRows).catch(エラー);
  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [条件]);
  const 変える = (k: string, v: string) => set条件((c) => (k === "id" ? { id: v } : { ...c, id: "", [k]: v }));
  async function 再計算() {
    if (!confirm("保管費用を再集計します(以前のデータは削除されます)。\nよろしいですか？")) return;
    if (!Number(条件.id)) return alert("集計する在庫レコードが選択されていません。");
    await api.post("/api/soko/hokan/detail/recalc", { 在庫ID: Number(条件.id) }).catch(エラー);
    load();
  }
  const 計 = (k: string) => rows.reduce((a, r) => a + Number(r[k] ?? 0), 0);
  return (
    <div className="modal">
      <div className="sko-dlg">
        <div className="sko-dlg-h">
          保管庫詳細
          <span>
            <button onClick={再計算}>再計算</button>
            <button onClick={() => set条件({ id: "" })}>クリア</button>
            <button onClick={props.onClose}>閉じる</button>
          </span>
        </div>
        <div className="sko-pad">
          在庫ID <Field value={条件.id} kind="num" className="hk-code" onCommit={(v) => 変える("id", v)} />
          {" "}冷蔵庫 <Field value={条件.soko ?? ""} kind="num" kyotsu="tokui" className="hk-code" onCommit={(v) => 変える("soko", v)} />
          {" "}商品 <Field value={条件.shohin ?? ""} kind="num" kyotsu="shohin" className="hk-code" onCommit={(v) => 変える("shohin", v)} />
          {" "}入庫No <Field value={条件.no ?? ""} className="hk-memo" onCommit={(v) => 変える("no", v)} />
          {" "}名義 <Field value={条件.meigi ?? ""} kind="num" kyotsu="tokui" className="hk-code" onCommit={(v) => 変える("meigi", v)} />
        </div>
        <table className="ws-grid">
          <thead>
            <tr>
              <th>在庫ID</th><th>期</th><th>集計開始日</th><th>集計終了日</th><th>開始期間</th><th>終了期間</th><th>冷蔵庫</th><th>名義</th><th>商品名</th><th>入庫No</th>
              <th>入庫日</th><th>元数</th><th>ケース</th><th>kg</th><th>入出庫料</th><th>保管料</th><th>サービス料</th><th>その他</th><th>作成日</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && <tr><td colSpan={19} className="c">保管料の明細はありません</td></tr>}
            {rows.map((r) => (
              <tr key={r.ID}>
                <td className="r">{r.在庫ID}</td><td className="r">{r.期}</td><td>{年月日2(r.集計開始日)}</td><td>{年月日2(r.集計終了日)}</td><td>{年月日2(r.開始期間)}</td><td>{年月日2(r.終了期間)}</td>
                <td>{r.倉庫名}</td><td>{r.名義名}</td><td>{r.商品名}</td><td>{r.入庫No}</td><td>{年月日2(r.入庫日)}</td><td className="r">{num(r.入庫元数)}</td>
                <td className="r">{num(r.ケース)}</td><td className="r">{num(r.商品kg)}</td><td className="r">{num(r.入出庫料)}</td><td className="r">{num(r.保管料)}</td>
                <td className="r">{num(r.サービス料)}</td><td className="r">{num(r.その他費用)}</td><td>{年月日2(r.作成日付)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr><td colSpan={14}>合計</td><td className="r">{num(計("入出庫料"))}</td><td className="r">{num(計("保管料"))}</td><td className="r">{num(計("サービス料"))}</td><td className="r">{num(計("その他費用"))}</td><td /></tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}

/** 入庫履歴（Access の FM_入庫履歴）。ロットのもとの入庫と、出荷・名変の履歴 */
function NyukoRireki(props: { 在庫ID: number; onClose: () => void }) {
  const [d, setD] = useState<{ 入庫: Rec[]; 出荷: Rec[]; 名変: Rec[] } | null>(null);
  useEffect(() => {
    api.get<{ 入庫: Rec[]; 出荷: Rec[]; 名変: Rec[] }>(`/api/soko/hokan/rireki/${props.在庫ID}`).then(setD).catch(エラー);
  }, [props.在庫ID]);
  const 計 = (rows: Rec[], k: string) => rows.reduce((a, r) => a + Number(r[k] ?? 0), 0);
  return (
    <div className="modal" onClick={props.onClose}>
      <div className="sko-dlg" onClick={(e) => e.stopPropagation()}>
        <div className="sko-dlg-h">入庫履歴（在庫ID {props.在庫ID}）<button onClick={props.onClose}>閉じる</button></div>
        {d && (
          <>
            <table className="ws-grid">
              <thead><tr><th>出荷日</th><th>納品日</th><th>出荷元</th><th>届け先</th><th>商品名</th><th>製造日</th><th>賞味期限</th><th>ケース</th><th>kg</th><th>名義</th><th>出庫ID</th></tr></thead>
              <tbody>
                {d.入庫.length === 0 && <tr><td colSpan={11} className="c">もとの入庫はありません</td></tr>}
                {d.入庫.map((r, i) => (
                  <tr key={i}>
                    <td>{年月日2(r.出荷日)}</td><td>{年月日2(r.納品日)}</td><td>{r.倉庫名}</td><td>{r.届け先}</td><td>{r.商品名}</td><td>{年月日2(r.製造日)}</td><td>{年月日2(r.賞味期限)}</td>
                    <td className="r">{num(r.ケース)}</td><td className="r">{num(r.商品kg)}</td><td className="r">{r.入庫後名義ID}</td><td className="r">{r.出庫ID}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="sko-pad bold">出荷履歴（{num(計(d.出荷, "ケース"))} ケース・{num(計(d.出荷, "商品kg"))} kg）</div>
            <table className="ws-grid">
              <thead><tr><th>出荷日</th><th>届け先</th><th>ケース</th><th>kg</th><th>出庫ID</th><th>輸送ID</th></tr></thead>
              <tbody>
                {d.出荷.map((r) => (
                  <tr key={r.出庫ID}><td>{年月日2(r.出荷日)}</td><td>{r.届け先}</td><td className="r">{num(r.ケース)}</td><td className="r">{num(r.商品kg)}</td><td className="r">{r.出庫ID}</td><td className="r">{r.輸送ID}</td></tr>
                ))}
              </tbody>
            </table>
            <div className="sko-pad bold">名変履歴（{num(計(d.名変, "ケース"))} ケース・{num(計(d.名変, "商品kg"))} kg）</div>
            <table className="ws-grid">
              <thead><tr><th>変更日</th><th>移動先</th><th>ケース</th><th>kg</th><th>変更No</th></tr></thead>
              <tbody>
                {d.名変.map((r) => (
                  <tr key={r.変更No}><td>{年月日2(r.変更日)}</td><td>{r.移動先名}</td><td className="r">{num(r.ケース)}</td><td className="r">{num(r.商品kg)}</td><td className="r">{r.変更No}</td></tr>
                ))}
              </tbody>
            </table>
          </>
        )}
      </div>
    </div>
  );
}

/** 訂正（Access の FM_保管倉庫_訂正）。1 つのロットをまとめて直し、［修正］で登録する（出荷計画に知らせる）。［削除］は数を全部 0 にする */
function HokanTeisei(props: { 在庫ID: number; 合言葉: string; onDetail: (id: number) => void; onClose: (変えた: boolean) => void }) {
  const [z, setZ] = useState<Rec | null>(null);
  const [値, set値] = useState<Rec>({});
  useEffect(() => {
    api.get<Rec>(`/api/soko/hokan/teisei/${props.在庫ID}`).then(setZ).catch(エラー);
  }, [props.在庫ID]);
  if (!z) return null;
  const 今 = (k: string) => (k in 値 ? 値[k] : z[k]);
  const 入れる = (k: string, v: unknown) => set値((x) => ({ ...x, [k]: v }));
  async function 登録() {
    if (!confirm("在庫訂正を登録しますか？")) return;
    try {
      const r = await api.post<{ 知らせ: number }>("/api/soko/hokan/teisei", { 合言葉: props.合言葉, 在庫ID: props.在庫ID, 値 });
      if (r.知らせ) alert(`変更により、出荷計画に${r.知らせ} 件の変更通知を送ります。`);
      props.onClose(true);
    } catch (e) {
      エラー(e);
    }
  }
  async function 削除() {
    if (!confirm("このレコードを削除いたしますか?")) return alert("キャンセルしました");
    try {
      await api.post("/api/soko/hokan/teisei/delete", { 合言葉: props.合言葉, 在庫ID: props.在庫ID });
      setZ(await api.get<Rec>(`/api/soko/hokan/teisei/${props.在庫ID}`));
      set値({});
    } catch (e) {
      エラー(e);
    }
  }
  function やめる() {
    if (Object.keys(値).length && !confirm("保存しないで終了しますがよろしいですか?")) return;
    props.onClose(false);
  }
  const 行 = (題: string, k: string, kind: "text" | "num" | "date" = "text") => (
    <tr>
      <th>{題}</th>
      <td>
        <Field
          value={今(k)}
          kind={kind}
          className="hk-memo"
          onCommit={(v) => {
            if (kind === "date") {
              const d = parseDate(v);
              if (d === undefined) return alert("日付の書き方が正しくありません。（例：10/28）");
              入れる(k, d);
            } else 入れる(k, kind === "num" ? (v.trim() === "" ? null : Number(v)) : v);
          }}
        />
      </td>
    </tr>
  );
  return (
    <div className="modal">
      <div className="sko-dlg">
        <div className="sko-dlg-h">
          在庫訂正（在庫ID {z.在庫ID}・{z.商品名}）
          <span>
            <button className="blue" onClick={登録}>修正</button>
            <button className="red" onClick={削除}>削除</button>
            <button onClick={() => props.onDetail(z.在庫ID)}>保管料詳細</button>
            <button onClick={やめる}>キャンセル</button>
          </span>
        </div>
        <table className="ws-grid sko-pad">
          <tbody>
            {行("入庫日", "入庫日", "date")}
            {行("保管料負担日", "保管料負担日", "date")}
            {行("名義", "入庫後名義ID", "num")}
            {行("入庫No", "入庫No")}
            {行("製造日", "製造日", "date")}
            {行("賞味期限", "賞味期限", "date")}
            {行("区分", "タグ")}
            {行("元数", "入庫元数", "num")}
            {行("繰越ケース", "繰越ケース", "num")}
            {行("入庫ケース", "製造ケース", "num")}
            {行("出庫ケース", "出庫ケース", "num")}
            {行("在庫ケース", "在庫ケース", "num")}
            <tr>
              <th>出荷止め</th>
              <td><input type="checkbox" checked={!!今("出荷止め区分")} onChange={(e) => 入れる("出荷止め区分", e.target.checked)} /></td>
            </tr>
            {行("管理備考", "管理備考")}
          </tbody>
        </table>
        <div className="sko-pad small">今の在庫：{num(z.在庫ケース)} ケース・{num(z.在庫kg)} kg　期 {z.期}</div>
      </div>
    </div>
  );
}
