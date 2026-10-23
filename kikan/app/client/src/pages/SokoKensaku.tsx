import { useEffect, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { api, ApiError, num, 処理中 } from "../api";
import { Field, parseDate, today } from "../formParts";

type Rec = Record<string, any>;
type 選択肢 = { id: number; name: string | null };
const エラー = (e: unknown) => alert(e instanceof ApiError ? e.message : String(e));
const 年月日2 = (v: string | null | undefined) => (v ? v.slice(2, 10).replace(/-/g, "/") : "");
const 月初 = () => today().slice(0, 8) + "01";
const 月末 = () => {
  const d = today();
  return new Date(Date.UTC(Number(d.slice(0, 4)), Number(d.slice(5, 7)), 0)).toISOString().slice(0, 10);
};
function 日の欄(props: { value: string | null; set: (d: string | null) => void }) {
  return (
    <Field
      value={props.value}
      kind="date"
      className="sko-date"
      onCommit={(v) => {
        const d = parseDate(v);
        if (d === undefined) return alert("日付の書き方が正しくありません。（例：10/28）");
        props.set(d);
      }}
    />
  );
}

/**
 * 倉庫別データ検索（Access の FSD_倉庫選択）。営業冷蔵庫ごとの在庫ケース・kg・ロット数。地区で絞れる。
 * ［倉庫情報］で冷蔵庫の情報と在庫・入庫・出庫・名変の一覧、kg をダブルクリックで商品別在庫、［出庫］で集計開始日〜終了日の出庫。
 */
export function SokoKensaku() {
  const nav = useNavigate();
  const [rows, setRows] = useState<Rec[]>([]);
  const [地区, set地区] = useState<選択肢[]>([]);
  const [選んだ地区, set選んだ地区] = useState(0);
  const [並び, set並び] = useState<"得意先名" | "短縮コード">("得意先名");
  const [開始, set開始] = useState<string | null>(月初());
  const [終了, set終了] = useState<string | null>(月末());
  const [出庫, set出庫] = useState<{ soko: Rec; rows: Rec[] } | null>(null);
  useEffect(() => {
    api.get<{ rows: Rec[]; 地区: 選択肢[] }>("/api/soko/kensaku").then((r) => {
      setRows(r.rows);
      set地区(r.地区);
    }).catch(エラー);
  }, []);
  const 見せる = rows
    .filter((r) => !選んだ地区 || Number(r.地区コード) === 選んだ地区)
    .sort((a, b) => (並び === "短縮コード" ? a.短縮コード - b.短縮コード : String(a.得意先名 ?? "").localeCompare(String(b.得意先名 ?? ""), "ja")));
  async function 出庫を見る(r: Rec) {
    if (!開始 || !終了) return alert("集計開始日・終了日を入れてください");
    try {
      set出庫({ soko: r, rows: await api.get<Rec[]>("/api/soko/kensaku/haiso", { soko: String(r.短縮コード), from: 開始, to: 終了 }) });
    } catch (e) {
      エラー(e);
    }
  }
  return (
    <div className="sz sko">
      <div className="kk-head">
        <div className="kk-title">倉庫別データ検索</div>
        <span>集計開始日</span>
        <日の欄 value={開始} set={set開始} />
        <span>〜</span>
        <日の欄 value={終了} set={set終了} />
        <button onClick={() => nav(-1)}>閉じる</button>
      </div>
      <div className="sko-top">
        <span>地区</span>
        <button className={選んだ地区 === 0 ? "on blue" : ""} onClick={() => set選んだ地区(0)}>全部</button>
        {地区.map((c) => (
          <button key={c.id} className={選んだ地区 === c.id ? "on blue" : ""} onClick={() => set選んだ地区(c.id)}>{c.name}</button>
        ))}
      </div>
      <div className="sko-gridwrap">
        <table className="sz-grid sko-grid">
          <thead>
            <tr>
              <th className="link" onClick={() => set並び("短縮コード")}>コード</th>
              <th className="link" onClick={() => set並び("得意先名")}>冷蔵庫</th>
              <th>ロット数</th><th>在庫ケース</th><th>在庫kg</th><th></th>
            </tr>
          </thead>
          <tbody>
            {見せる.map((r) => (
              <tr key={r.短縮コード}>
                <td className="r">{r.短縮コード}</td>
                <td className="name">{r.得意先名}</td>
                <td className="r">{num(r.ロット数)}</td>
                <td className="r">{num(r.ケースの合計)}</td>
                <td className="r link" title="ダブルクリックで商品別在庫" onDoubleClick={() => nav(`/soko/shohinbetsu?soko=${r.短縮コード}`)}>{num(r.商品kgの合計)}</td>
                <td>
                  <button onClick={() => nav(`/soko/joho/${r.短縮コード}`)}>倉庫情報</button>
                  <button onClick={() => nav(`/soko/shohinbetsu?soko=${r.短縮コード}`)}>商品別在庫</button>
                  <button onClick={() => 出庫を見る(r)}>出庫</button>
                  <button onClick={() => nav(`/soko/keihi?soko=${r.短縮コード}`)}>諸経費</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {出庫 && (
        <div className="modal" onClick={() => set出庫(null)}>
          <div className="sko-dlg" onClick={(e) => e.stopPropagation()}>
            <div className="sko-dlg-h">
              配送商品検索（{出庫.soko.得意先名}　{年月日2(開始)}〜{年月日2(終了)}）<button onClick={() => set出庫(null)}>閉じる</button>
            </div>
            <ShukkoTable rows={出庫.rows} />
          </div>
        </div>
      )}
    </div>
  );
}

function ShukkoTable(props: { rows: Rec[] }) {
  const 計 = (k: string) => props.rows.reduce((a, r) => a + Number(r[k] ?? 0), 0);
  return (
    <table className="ws-grid">
      <thead>
        <tr><th>出荷日</th><th>輸送ID</th><th>運送会社</th><th>コード</th><th>商品名</th><th>製造日</th><th>賞味期限</th><th>区分</th><th>入庫No</th><th>ケース</th><th>kg</th><th>届け先</th><th>納品日</th><th>登録</th></tr>
      </thead>
      <tbody>
        {props.rows.length === 0 && <tr><td colSpan={14} className="c">出庫はありません</td></tr>}
        {props.rows.map((r) => (
          <tr key={r.出庫ID}>
            <td>{年月日2(r.出荷日)}</td><td className="r">{r.輸送ID || ""}</td><td>{r.運送会社名}</td><td className="r">{r.商品コード}</td><td>{r.商品名}</td>
            <td>{年月日2(r.製造日)}</td><td>{年月日2(r.賞味期限)}</td><td className="c">{r.タグ}</td><td>{r.入庫No}</td>
            <td className="r">{num(r.ケース)}</td><td className="r">{num(r.商品kg)}</td><td>{r.届け先}</td><td>{年月日2(r.納品日)}</td><td className="c">{r.chk ? "済" : ""}</td>
          </tr>
        ))}
      </tbody>
      <tfoot><tr><td colSpan={9}>合計</td><td className="r">{num(計("ケース"))}</td><td className="r">{num(計("商品kg"))}</td><td colSpan={3} /></tr></tfoot>
    </table>
  );
}

/** 倉庫情報（Access の FM_倉庫情報）。営業冷蔵庫の得意先の情報と、在庫一覧・入庫一覧・出庫一覧・名変一覧・倉庫設定（料率） */
export function SokoJoho() {
  const nav = useNavigate();
  const { code } = useParams();
  const [d, setD] = useState<{ 得意先: Rec | null; 一覧: 選択肢[] } | null>(null);
  const [タブ, setタブ] = useState<"在庫" | "入庫" | "出庫" | "名変" | "設定">("在庫");
  const [rows, setRows] = useState<Rec[]>([]);
  const [mode, setMode] = useState(3);
  const [商品, set商品] = useState(0);
  const [商品一覧, set商品一覧] = useState<選択肢[]>([]);
  const [日, set日] = useState<string | null>(null);
  useEffect(() => {
    api.get<{ 得意先: Rec | null; 一覧: 選択肢[] }>(`/api/soko/joho/${code ?? 0}`).then(setD).catch(エラー);
    api.get<選択肢[]>(`/api/soko/joho/${code ?? 0}/shohin`).then(set商品一覧).catch(エラー);
    set商品(0);
    set日(null);
  }, [code]);
  useEffect(() => {
    if (!d?.得意先) return;
    const c = d.得意先.短縮コード;
    const 道 =
      タブ === "在庫" ? api.get<Rec[]>(`/api/soko/joho/${c}/zaiko`, { mode: String(mode), ...(商品 ? { shohin: String(商品) } : {}) })
      : タブ === "入庫" ? api.get<Rec[]>(`/api/soko/joho/${c}/nyuko`, 日 ? { date: 日 } : {})
      : タブ === "出庫" ? api.get<Rec[]>(`/api/soko/joho/${c}/shukko`, 日 ? { date: 日 } : {})
      : タブ === "名変" ? api.get<Rec[]>(`/api/soko/joho/${c}/meihen`)
      : api.get<Rec[]>(`/api/soko/joho/${c}/settei`);
    処理中(() => 道).then(setRows).catch(エラー);
  }, [d, タブ, mode, 商品, 日]);
  if (!d) return null;
  const k = d.得意先;
  const i = d.一覧.findIndex((x) => x.id === k?.短縮コード);
  const 移る = (j: number) => d.一覧[j] && nav(`/soko/joho/${d.一覧[j].id}`, { replace: true });
  const 計 = (f: string) => rows.reduce((a, r) => a + Number(r[f] ?? 0), 0);
  return (
    <div className="sz sko">
      <div className="kk-head">
        <div className="kk-title">倉庫情報</div>
        <button onClick={() => 移る(0)}>|◀</button>
        <button onClick={() => 移る(i - 1)}>◀</button>
        <Field value={k?.短縮コード ?? null} kind="num" kyotsu="tokui" className="w5" onCommit={(v) => Number(v) && nav(`/soko/joho/${Number(v)}`, { replace: true })} />
        <button onClick={() => 移る(i + 1)}>▶</button>
        <button onClick={() => 移る(d.一覧.length - 1)}>▶|</button>
        <b>{k?.得意先名 ?? "（営業冷蔵庫ではありません）"}</b>
        <button onClick={() => nav(-1)}>閉じる</button>
      </div>
      {k && (
        <div className="sko-pad small">
          〒{k.郵便番号} {k.住所}　TEL {k.電話番号 ?? ""}　FAX {k.FAX番号 ?? ""}　受付時間 {k.受付時間 ?? ""}
        </div>
      )}
      <div className="sko-top">
        {(["在庫", "入庫", "出庫", "名変", "設定"] as const).map((x) => (
          <button key={x} className={タブ === x ? "on blue" : ""} onClick={() => setタブ(x)}>{x === "設定" ? "倉庫設定" : x + "一覧"}</button>
        ))}
        <span className="sko-sp" />
        {タブ === "在庫" && (
          <>
            <select value={mode} onChange={(e) => setMode(Number(e.target.value))}>
              <option value={3}>全部</option>
              <option value={1}>今日までの在庫</option>
              <option value={2}>これからの入庫</option>
            </select>
            <select value={商品} onChange={(e) => set商品(Number(e.target.value))}>
              <option value={0}>（全部の商品）</option>
              {商品一覧.map((s) => <option key={s.id} value={s.id}>{s.id} {s.name}</option>)}
            </select>
          </>
        )}
        {(タブ === "入庫" || タブ === "出庫") && (
          <>
            <span>{タブ === "入庫" ? "入庫日" : "出荷日"}</span>
            <日の欄 value={日} set={set日} />
            <button onClick={() => set日(null)}>全部</button>
          </>
        )}
      </div>
      <div className="sko-gridwrap">
        {(タブ === "在庫" || タブ === "入庫") && (
          <table className="sz-grid sko-grid">
            <thead>
              <tr><th>入庫日</th><th>コード</th><th>商品名</th><th>規格</th><th>製造日</th><th>賞味期限</th><th>区分</th><th>入庫No</th><th>名義</th><th>元数</th><th>出庫</th><th>在庫</th><th>在庫kg</th><th>在庫ID</th></tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.在庫ID}>
                  <td>{年月日2(r.入庫日)}</td><td className="r">{r.商品コード}</td><td className="name">{r.商品名}</td><td>{r.規格}</td><td>{年月日2(r.製造日)}</td><td>{年月日2(r.賞味期限)}</td>
                  <td className="c">{r.タグ}</td><td>{r.入庫No}</td><td>{r.名義名}</td><td className="r">{num(r.入庫元数)}</td><td className="r">{num(r.出庫ケース)}</td>
                  <td className="r">{num(r.在庫ケース)}</td><td className="r">{num(r.在庫kg)}</td><td className="r">{r.在庫ID}</td>
                </tr>
              ))}
            </tbody>
            <tfoot><tr><td colSpan={9}>合計（{rows.length} 件）</td><td className="r">{num(計("入庫元数"))}</td><td className="r">{num(計("出庫ケース"))}</td><td className="r">{num(計("在庫ケース"))}</td><td className="r">{num(計("在庫kg"))}</td><td /></tr></tfoot>
          </table>
        )}
        {タブ === "出庫" && <ShukkoTable rows={rows} />}
        {タブ === "名変" && (
          <table className="sz-grid sko-grid">
            <thead><tr><th>変更日</th><th>コード</th><th>商品名</th><th>製造日</th><th>賞味期限</th><th>入庫No</th><th>ケース</th><th>kg</th><th>変更前名義</th><th>変更後名義</th><th>譲渡人負担日</th><th>登録</th></tr></thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.変更No}>
                  <td>{年月日2(r.変更日)}</td><td className="r">{r.商品コード}</td><td className="name">{r.商品名}</td><td>{年月日2(r.製造日)}</td><td>{年月日2(r.賞味期限)}</td><td>{r.入庫No}</td>
                  <td className="r">{num(r.ケース)}</td><td className="r">{num(r.商品kg)}</td><td>{r.変更前名義}</td><td>{r.変更後名義}</td><td>{年月日2(r.譲渡人負担日)}</td><td className="c">{r.変更Check ? "済" : ""}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {タブ === "設定" && (
          <table className="sz-grid sko-grid">
            <thead><tr><th>名義</th><th>名義名</th><th>商品</th><th>商品名</th><th>入出庫料</th><th>保管料</th><th>最低入出庫料</th><th>最低保管料</th><th>最低入出庫kg</th><th>最低保管kg</th><th>荷役料</th><th>計算単位</th><th>契約入庫日</th><th>終了日</th><th>自動名変</th></tr></thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.ID}>
                  <td className="r">{r.名義コード}</td><td>{r.名義名}</td><td className="r">{r.商品コード}</td><td>{r.商品名}</td><td className="r">{r.入出庫料}</td><td className="r">{r.保管料}</td>
                  <td className="r">{r.最低入出庫料}</td><td className="r">{r.最低保管料}</td><td className="r">{r.最低入出庫kg}</td><td className="r">{r.最低保管kg}</td><td className="r">{r.荷役料}</td>
                  <td className="c">{r.計算単位 === 1 ? "ケース" : "kg"}</td><td>{年月日2(r.契約入庫日開始)}〜{年月日2(r.契約入庫日終了)}</td><td>{年月日2(r.終了日)}</td><td className="c">{r.自動名変 ? `→${r.自動変更後名義ID}` : ""}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

/**
 * 商品別在庫（Access の FM_商品別在庫）。集計日の時点の在庫（仮締め）を、出荷元（冷蔵庫）・名義ごとに商品別にまとめる。WorkStation からの入庫予定も入る。
 * 商品コードをダブルクリックで倉庫商品一覧。［Excel］は全部の冷蔵庫の在庫（倉庫在庫）。
 */
export function SokoShohinbetsu() {
  const nav = useNavigate();
  const [sp] = useSearchParams();
  const [soko, setSoko] = useState(Number(sp.get("soko") ?? 0));
  const [meigi, setMeigi] = useState<number | null>(null);
  const [日, set日] = useState<string | null>(today());
  const [opts, setOpts] = useState<{ 出荷元: 選択肢[]; 名義: 選択肢[] }>({ 出荷元: [], 名義: [] });
  const [rows, setRows] = useState<Rec[]>([]);
  // 出荷元を変えると、名義はその冷蔵庫の在庫のいちばん小さい名義（cmb_出荷元_AfterUpdate）
  useEffect(() => {
    api.get<{ 出荷元: 選択肢[]; 名義: 選択肢[]; 最初の名義: number | null }>("/api/soko/shohinbetsu/choices", soko ? { soko: String(soko) } : {}).then((r) => {
      setOpts(r);
      setMeigi(r.最初の名義);
    }).catch(エラー);
  }, [soko]);
  useEffect(() => {
    if (!soko || meigi === null || !日) return setRows([]);
    処理中(() => api.get<Rec[]>("/api/soko/shohinbetsu", { soko: String(soko), meigi: String(meigi), date: 日 })).then(setRows).catch(エラー);
  }, [soko, meigi, 日]);
  async function Excel() {
    if (!日) return;
    try {
      await 処理中(async () => {
        const res = await fetch(`/api/soko/shohinbetsu/excel?date=${日}`, { credentials: "same-origin" });
        if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? "Excel に出力できませんでした");
        const a = document.createElement("a");
        a.href = URL.createObjectURL(await res.blob());
        a.download = "倉庫在庫.xlsx";
        document.body.appendChild(a);
        a.click();
        a.remove();
      });
    } catch (e) {
      エラー(e);
    }
  }
  const 計 = (f: string) => rows.reduce((a, r) => a + Number(r[f] ?? 0), 0);
  return (
    <div className="sz sko">
      <div className="kk-head">
        <div className="kk-title">商品別在庫</div>
        <span>出荷元</span>
        <select value={soko} onChange={(e) => setSoko(Number(e.target.value))}>
          <option value={0} />
          {opts.出荷元.map((o) => <option key={o.id} value={o.id}>{o.id} {o.name}</option>)}
        </select>
        <span>名義</span>
        <select value={meigi ?? ""} onChange={(e) => setMeigi(Number(e.target.value))}>
          {opts.名義.map((o) => <option key={o.id} value={o.id}>{o.id} {o.name}</option>)}
        </select>
        <span>集計日</span>
        <日の欄 value={日} set={set日} />
        <button className="green" onClick={Excel}>Excel</button>
        <button onClick={() => nav(-1)}>閉じる</button>
      </div>
      <div className="sko-gridwrap">
        <table className="sz-grid sko-grid">
          <thead><tr><th>冷蔵庫</th><th>コード</th><th>商品名</th><th>入数</th><th>入庫元数</th><th>出庫</th><th>出庫kg</th><th>在庫残数</th><th>在庫残kg</th></tr></thead>
          <tbody>
            {rows.length === 0 && <tr><td colSpan={9} className="c">在庫はありません</td></tr>}
            {rows.map((r, i) => (
              <tr key={i}>
                <td>{r.倉庫名}</td>
                <td className="r link" title="ダブルクリックで倉庫商品一覧" onDoubleClick={() => nav(`/soko/hokan?soko=${soko}&shohin=${r.商品コード}`)}>{r.商品コード}</td>
                <td className="name">{r.商品名}</td><td className="r">{num(r.入数)}</td><td className="r">{num(r.入庫元数)}</td><td className="r">{num(r.ケース)}</td>
                <td className="r">{num(r.商品kg)}</td><td className="r bold">{num(r.在庫残数)}</td><td className="r">{num(r.在庫残kg)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot><tr><td colSpan={4}>合計</td><td className="r">{num(計("入庫元数"))}</td><td className="r">{num(計("ケース"))}</td><td className="r">{num(計("商品kg"))}</td><td className="r">{num(計("在庫残数"))}</td><td className="r">{num(計("在庫残kg"))}</td></tr></tfoot>
        </table>
      </div>
    </div>
  );
}
