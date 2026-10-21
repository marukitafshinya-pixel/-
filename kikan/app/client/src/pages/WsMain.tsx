import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { api, ApiError, num } from "../api";
import { CalendarDialog, Field, parseDate } from "../formParts";
import { KibouDialog, type 希望在庫 } from "./WsKibou";

type Rec = Record<string, any>;
type 選択肢 = Record<string, { id: number; name: string }[]>;

const pad = (n: number) => String(n).padStart(2, "0");
const 今日 = () => {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};
const 足す = (s: string, n: number) => {
  const d = new Date(s + "T00:00:00");
  d.setDate(d.getDate() + n);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};
/** "2026-10-21" → "令和8年10月21日(水)" */
const 和暦 = (s: string) =>
  new Date(s + "T00:00:00").toLocaleDateString("ja-JP-u-ca-japanese", { era: "long", year: "numeric", month: "long", day: "numeric" }) +
  `(${"日月火水木金土"[new Date(s + "T00:00:00").getDay()]})`;
const 月日 = (v: string | null | undefined) => (v ? `${Number(v.slice(5, 7))}月${Number(v.slice(8, 10))}日` : "");
const 年月日2 = (v: string | null | undefined) => (v ? v.slice(2, 10).replace(/-/g, "/") : "");
const 時刻 = (v: string | null | undefined) => (v ? String(Number(v.slice(11, 13))) + v.slice(13, 16) : "");

/** 丸北WorkStation 出荷明細票（Access の FM_出荷明細票）。出荷日ごとの便（輸送計画）と、その便の出荷の明細 */
export default function WsMain() {
  const nav = useNavigate();
  // 出荷日と便は画面の住所（URL）にも持つ。詳細の画面から戻ったときに、同じ日・同じ便に戻れるように
  const [sp, setSp] = useSearchParams();
  const [date, setDate] = useState(sp.get("date") ?? 今日());
  const [ids, setIds] = useState<number[]>([]);
  const [pos, setPos] = useState(0);
  const [data, setData] = useState<{ plan: Rec; rows: Rec[]; 積込: Rec[] } | null>(null);
  const [ch, setCh] = useState<選択肢>({});
  const [通知, set通知] = useState(0);
  const [cal, setCal] = useState(false);
  const [leftTab, setLeftTab] = useState<"届順" | "備考">("届順");
  // 検索実行の条件（Access の cmb_商品検索表示・cmb_抽出倉庫。保存しない欄）
  const [検索商品, set検索商品] = useState<number | null>(null);
  const [検索倉庫, set検索倉庫] = useState<number | null>(null);
  const [希望, set希望] = useState<希望在庫 | null>(null);

  useEffect(() => {
    api.get<選択肢>("/api/ws/choices").then(setCh);
    api.get<{ 件数: number }>("/api/ws/notice").then((r) => set通知(r.件数));
  }, []);

  // 出荷日を変えたら、その日の便を読み直す（Access の 配車日付移動）
  async function 日付を移す(d: string, keep?: number) {
    setDate(d);
    const r = await api.get<{ 輸送ID: number[]; 割付前: number }>("/api/ws/day", { date: d });
    setIds(r.輸送ID);
    const i = keep !== undefined ? Math.max(0, r.輸送ID.indexOf(keep)) : 0;
    setPos(i);
    if (r.割付前) alert(`${r.割付前}件の割付前データがあります。\n受注読込から登録してください。`);
    if (!r.輸送ID.length) setData(null);
  }
  useEffect(() => {
    日付を移す(sp.get("date") ?? 今日(), sp.get("id") ? Number(sp.get("id")) : undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const 輸送ID = ids[pos];
  useEffect(() => {
    if (輸送ID) setSp({ date, id: String(輸送ID) }, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [輸送ID, date]);
  const load = () => (輸送ID ? api.get<any>(`/api/ws/plan/${輸送ID}`).then(setData) : Promise.resolve(setData(null)));
  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [輸送ID]);

  async function save(p: Rec) {
    if (!輸送ID) return;
    try {
      await api.post("/api/ws/plan/save", { 輸送ID, ...p });
      await load();
    } catch (e) {
      alert(e instanceof ApiError ? e.message : String(e));
    }
  }
  const 運送会社名 = async (code: string) => (code.trim() ? (await api.get<any>(`/api/ws/unso/${code}`)).短縮名 : null);
  const n = (v: string) => (v.trim() === "" ? null : Number(v));

  // 検索実行（Access の cmd_検索_Click → C_架空製造日別出荷データ表示Ver2）
  async function 検索実行() {
    if (!検索商品 && !検索倉庫) return alert("検索条件が入力されていません。");
    try {
      const r = await api.get<希望在庫>("/api/ws/kibou", { shohin: String(検索商品 ?? ""), soko: String(検索倉庫 ?? "") });
      const kg = r.rows.reduce((a, x) => a + (x.在庫kg ?? 0), 0);
      if (!confirm(`合計${r.rows.length}件\n重量 ${kg ? num(kg) : ""} kgまでを表示します`)) return;
      set希望(r);
    } catch (e) {
      alert(e instanceof ApiError ? e.message : String(e));
    }
  }

  async function 新しい便() {
    const r = await api.post<{ 輸送ID: number }>("/api/ws/plan/new", { date });
    await 日付を移す(date, r.輸送ID);
  }

  async function 削除() {
    if (!data) return;
    const p = data.plan;
    if (!confirm(`${p.出荷計画日?.slice(0, 10)} ${p.運送会社名 ?? ""} のレコードを削除しますか？`)) return;
    const pass = prompt("パスワードを入力してください。");
    if (pass === null) return;
    try {
      const r = await api.post<{ 削除: boolean; chkを外せる?: boolean }>("/api/ws/plan/delete", { 輸送ID, 合言葉: pass });
      if (r.chkを外せる) return alert("登録済みの便です。チェックを外せるようにしました。");
      await 日付を移す(date);
    } catch (e) {
      alert(e instanceof ApiError ? e.message : String(e));
    }
  }

  const p = data?.plan ?? {};
  const rows = data?.rows ?? [];
  const 合計 = rows.reduce(
    (a, r) => ({ ケース: a.ケース + (r.ケース ?? 0), kg: a.kg + (r.商品kg ?? 0), P: a.P + (r.パレット使用枚数 ?? 0) }),
    { ケース: 0, kg: 0, P: 0 },
  );
  const sel = (key: string, label: string) => (
    <div className="ws-sel">
      <span className="lbl">{label}</span>
      <select value={p[key] ?? ""} disabled={!輸送ID} onChange={(e) => save({ [key]: e.target.value === "" ? null : Number(e.target.value) })}>
        <option value=""></option>
        {(ch[key] ?? []).map((o) => (
          <option key={o.id} value={o.id}>
            {o.name}
          </option>
        ))}
      </select>
    </div>
  );
  const 運送 = (codeKey: string, nameKey: string, label: string) => (
    <div className="ws-unso">
      <span className="lbl">{label}</span>
      <Field value={p[codeKey]} kind="num" className="code" kyotsu="unso" readOnly={!輸送ID}
        onCommit={async (v) => save({ [codeKey]: n(v), [nameKey]: await 運送会社名(v) })} />
      <span className="name">{p[nameKey]}</span>
    </div>
  );
  const 時間 = (key: string, label: string) => (
    <div className="ws-time">
      <span>{label}</span>
      <Field value={時刻(p[key])} readOnly={!輸送ID} onCommit={(v) => save({ [key]: v || null })} />
    </div>
  );

  return (
    <div className="ws">
      <div className="tabs">
        <span>メインメニュー</span>
        <span className="active">FM_出荷明細票</span>
      </div>
      <div className="ws-head">
        <div className="ws-block date">
          <div className="ws-row">
            <span className="lbl big">出荷日</span>
            <div className="navb">
              <button onClick={async () => 日付を移す((await api.get<any>("/api/ws/ends")).最初.slice(0, 10))}>|◀</button>
              <button onClick={() => 日付を移す(足す(date, -1))}>◀</button>
              <button onClick={() => 日付を移す(足す(date, 1))}>▶</button>
              <button onClick={async () => 日付を移す((await api.get<any>("/api/ws/ends")).最後.slice(0, 10))}>▶|</button>
            </div>
          </div>
          <div className="ws-date" onDoubleClick={() => setCal(true)} title="ダブルクリックでカレンダーから選べます">
            {和暦(date)}
          </div>
          <div className="ws-row">
            <span className="lbl big">車</span>
            <div className="navb">
              <button onClick={() => setPos(0)} disabled={!ids.length}>|◀</button>
              <button onClick={() => setPos(Math.max(0, pos - 1))} disabled={pos <= 0}>◀</button>
              <button onClick={() => setPos(Math.min(ids.length - 1, pos + 1))} disabled={pos >= ids.length - 1}>▶</button>
              <button onClick={() => setPos(ids.length - 1)} disabled={!ids.length}>▶|</button>
            </div>
          </div>
          <div className="ws-row">
            <span className={"ws-status" + (p.chk ? " done" : "")}>{輸送ID ? (p.chk ? "済" : "未") : ""}</span>
            <button className="small" onClick={新しい便} title="この出荷日に新しい便を足します">
              新規
            </button>
            <span className="ws-page">
              {ids.length ? pos + 1 : 0} / {ids.length}
            </span>
          </div>
        </div>
        <div className="ws-block ids">
          <div className="ws-kv">
            <span>輸送ID</span>
            <b>{輸送ID ?? ""}</b>
          </div>
          <div className="ws-kv">
            <span>外部運行No</span>
            <Field value={p.運行指令No} readOnly={!輸送ID} onCommit={(v) => save({ 運行指令No: v || null })} />
          </div>
          <div className="ws-kv">
            <span>品名</span>
            <Field value={検索商品} kind="num" kyotsu="shohin" onCommit={(v) => set検索商品(n(v))} />
          </div>
          <div className="ws-kv">
            <span>倉庫</span>
            <Field value={検索倉庫} kind="num" kyotsu="tokui" onCommit={(v) => set検索倉庫(n(v))} />
          </div>
          <div className="ws-row">
            <button className="small" disabled={!輸送ID} onClick={検索実行}>検索実行</button>
            <button className="small" disabled={!輸送ID} onClick={() => nav(`/ws/import?id=${輸送ID}`)}>インポート処理</button>
          </div>
          {sel("運賃計算区分", "運賃区分")}
        </div>
        <div className="ws-block unso">
          {運送("手配運送会社コード", "手配運送会社名", "手配")}
          {運送("帳合運送会社コード", "帳合運送会社名", "帳合")}
          {運送("運送会社ID", "運送会社名", "輸送")}
          <div className="ws-unso">
            <span className="lbl">車番</span>
            <Field value={p.車番} className="carno" readOnly={!輸送ID} onCommit={(v) => save({ 車番: v })} />
          </div>
          <div className="ws-times">
            {時間("積込開始時間", "積込開始")}
            {時間("積込終了時間", "終了")}
            {時間("到着時間", "到着")}
            {時間("丸北開始時間", "丸北開始")}
            {時間("丸北終了時間", "終了")}
            {時間("丸北指定時間", "指定")}
          </div>
        </div>
        <div className="ws-block kubun">
          {sel("運賃区分ID", "輸送区分")}
          {sel("輸送区分ID", "輸送")}
          {sel("配達区分ID", "配達区分")}
          {sel("車両区分ID", "車両区分")}
          {sel("冷凍区分ID", "冷凍区分")}
          <div className="ws-sel">
            <span className="lbl">輸送手段</span>
            <select value={p.パレット輸送区分 ? 1 : 0} disabled={!輸送ID} onChange={(e) => save({ パレット輸送区分: Number(e.target.value) })}>
              <option value={0}>バラ積載</option>
              <option value={1}>パレット</option>
            </select>
          </div>
          <div className="ws-sel">
            <span className="lbl">P積載数</span>
            <Field value={p.パレット積載数} kind="num" readOnly={!輸送ID} onCommit={(v) => save({ パレット積載数: n(v) ?? 0 })} />
          </div>
        </div>
        <div className="ws-block right">
          <div className="ws-row">
            <span className="lbl">集荷日</span>
            <Field value={p.集荷日} kind="date" className="shuka" readOnly={!輸送ID} onCommit={(v) => { const d = parseDate(v); if (d === undefined) return alert("日付の書き方が正しくありません。（例：10/28）"); save({ 集荷日: d }); }} />
            <div className="ws-btns">
              <button className="red" disabled title="③で作ります">割付解除</button>
              <button disabled title="③で作ります">配車割付</button>
              <button className="blue" disabled title="④で作ります">輸送印刷</button>
              <button onClick={() => nav("/")}>閉じる</button>
            </div>
          </div>
          <div className="ws-row">
            <span className="lbl">セット℃</span>
            <Field value={p.セット温度} kind="num" className="temp" readOnly={!輸送ID} onCommit={(v) => save({ セット温度: n(v) })} />
            <button className="small" disabled title="④で作ります">入庫案内・出荷・送品案内</button>
            <button className="small" disabled title="④で作ります">輸送依頼書</button>
          </div>
          <div className="ws-row">
            <span className="lbl">担当者</span>
            <textarea
              key={輸送ID ?? 0}
              defaultValue={p.担当者 ?? ""}
              disabled={!輸送ID}
              onBlur={(e) => e.target.value !== (p.担当者 ?? "") && save({ 担当者: e.target.value || null })}
            />
            <div className="ws-weight">
              <div title="最大積載重量">{num(p.最大積載重量kg)}</div>
              <div title="この便の重さの合計">{num(合計.kg)}</div>
            </div>
          </div>
          <div className="ws-row">
            <button className={"ws-notice" + (通知 ? " on" : "")} onClick={() => 通知 && alert(`計画変更の通知が ${通知} 件あります。（通知の画面は②で作ります）`)}>
              {通知 ? `通知 ${通知}件` : ""}
            </button>
            <button className="small del" onClick={削除} disabled={!輸送ID}>
              この便を削除
            </button>
          </div>
        </div>
      </div>
      <div className="ws-body">
        <div className="ws-left">
          <div className="ws-ltabs">
            {(["届順", "備考"] as const).map((t) => (
              <button key={t} className={leftTab === t ? "on" : ""} onClick={() => setLeftTab(t)}>
                {t}
              </button>
            ))}
          </div>
          {(data?.積込 ?? []).map((k) => (
            <div key={k.ID} className="ws-tsumi">
              {leftTab === "届順" ? (
                <>
                  <div className="nums">
                    <span>届順</span>
                    <b>{k.届け順}</b>
                    <span>積順</span>
                    <b>{k.積込順}</b>
                  </div>
                  <div>
                    <span className="c">{k.積込順届け先}</span> {k.届け先名}
                  </div>
                  <div>
                    <span className="c">{k.積込順出荷元}</span> {k.出荷元名}
                  </div>
                </>
              ) : (
                <div className="memo">{k.積込備考}</div>
              )}
            </div>
          ))}
        </div>
        <div className="ws-gridwrap">
          <table className="ws-grid">
            <thead>
              <tr>
                <th>通知</th>
                <th>切替</th>
                <th>順</th>
                <th>コード</th>
                <th>届け先</th>
                <th>コード</th>
                <th>出荷地</th>
                <th>コード</th>
                <th>製品名</th>
                <th>C/S</th>
                <th>kg</th>
                <th>区分</th>
                <th>予約</th>
                <th>製造/賞味</th>
                <th>納品日</th>
                <th>受注ID</th>
                <th>年間ID</th>
                <th>P数</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.出庫ID}>
                  <td className="notice">
                    <div className="y">{r.通知}</div>
                    <div className="r">{r.変更通知}</div>
                  </td>
                  <td>
                    <button className="small" onClick={() => nav(`/ws/detail/${r.出庫ID}`)}>詳細</button>
                  </td>
                  <td className="jun">{r.商品積込順}</td>
                  <td className="r kc">{r.届け先コード}</td>
                  <td>{r.届け先}</td>
                  <td className="r kc">{r.倉庫ID}</td>
                  <td>{r.倉庫名}</td>
                  <td className="r kc">{r.商品コード}</td>
                  <td className="bold">{r.商品名}</td>
                  <td className="r">{num(r.ケース)}</td>
                  <td className="r">{num(r.商品kg)}</td>
                  <td className="c tag">{r.タグ}</td>
                  <td className="c yoyaku">{r.予約}</td>
                  <td className="dates">
                    <div className="b">{年月日2(r.製造日)}</div>
                    <div className="o">{年月日2(r.賞味期限)}</div>
                  </td>
                  <td className="o">{月日(r.納品日)}</td>
                  <td className="r">{r.受注ID || ""}</td>
                  <td>{r.年間受注ID}</td>
                  <td className="r bold">{r.パレット使用枚数}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {!輸送ID && <p className="ws-empty">この出荷日の便はありません。［新規］で足せます。</p>}
          <div className="ws-foot">
            <span className="k">件数</span>
            <span className="v">{rows.length}件</span>
            <span className="k">C/s計</span>
            <span className="v">{num(合計.ケース)}</span>
            <span className="k">kg計</span>
            <span className="v">{num(合計.kg)}</span>
            <span className="k">P計</span>
            <span className="v">{合計.P}</span>
          </div>
        </div>
      </div>
      {cal && (
        <CalendarDialog
          value={date}
          onClose={() => setCal(false)}
          onPick={(d) => {
            setCal(false);
            日付を移す(d);
          }}
        />
      )}
      {希望 && 輸送ID && (
        <KibouDialog
          data={希望}
          輸送ID={輸送ID}
          出荷予定日={String(p.出荷計画日 ?? date).slice(0, 10)}
          shohin={検索商品 ?? 0}
          soko={検索倉庫 ?? 0}
          onClose={(added) => {
            set希望(null);
            if (added) load();
          }}
        />
      )}
    </div>
  );
}
