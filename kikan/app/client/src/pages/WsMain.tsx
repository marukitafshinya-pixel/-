import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { api, ApiError, num } from "../api";
import { CalendarDialog, Field, parseDate, PageClose } from "../formParts";
import { KibouDialog, type 希望在庫 } from "./WsKibou";
import { 輸送依頼書印刷, 出荷予定明細票印刷, 出荷予定明細票ver2印刷 } from "./Chohyo";
import { ZaikoSentaku } from "./WsZaikoSelect";

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
  const [通知一覧, set通知一覧] = useState(false);
  const [依頼書, set依頼書] = useState<Rec | null>(null);
  const [予定, set予定] = useState<{ 開始: string; 終了: string; 便だけ: boolean } | null>(null);
  const [予定票, set予定票] = useState<Rec | null>(null);
  // 出荷予定明細票ver2（丸北商品推移の 丸北出荷 の［印刷］：工場の在庫の見込みつき）
  const [予定票2, set予定票2] = useState<Rec | null>(null);
  const [在庫選択, set在庫選択] = useState<{ 出庫ID: number; 商品コード: number; 倉庫ID: number } | null>(null);
  const [版, set版] = useState(0); // 在庫選択をやめたとき、打った商品コードを元に戻すため
  const [備考選ぶ, set備考選ぶ] = useState<Rec | null>(null);
  const [備考欄, set備考欄] = useState<Rec[] | null>(null);

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

  // 積込確認（Access の 積込確認_Click）：✔で在庫に登録、外すと在庫から戻す
  async function 積込確認(r: Rec, on: boolean) {
    try {
      await api.post("/api/ws/tsumikomi", { 出庫ID: r.出庫ID, 積込確認: on });
      await load();
    } catch (e) {
      alert(e instanceof ApiError ? e.message : String(e));
    }
  }

  // 明細の届け先・出荷場所を一覧で直す（Access の FS_出荷明細 cmb_届け先・cmb_出荷元。詳細画面と同じ保存）
  async function 明細を直す(r: Rec, 項目: "届け先コード" | "倉庫ID", 値: string) {
    const code = 値.trim() === "" ? null : Number(値);
    if (code === (r[項目] ?? null)) return;
    if (項目 === "届け先コード" && r.受注ID) {
      // Access と同じく、受注の品は受注ID を打って確かめる
      const a = prompt(`商品名：${r.商品名 ?? ""} ${r.ケース ?? ""} 個\n\n届け先：${r.届け先 ?? ""}\n\nは受注の品です（受注ID ${r.受注ID}）\n\n届け先を変更してよろしいですか？\n良ければ受注IDを入力してください。`);
      if (String(a ?? "").trim() !== String(r.受注ID)) {
        set版((x) => x + 1);
        return;
      }
    }
    try {
      await api.post("/api/ws/detail/save", { 出庫ID: r.出庫ID, [項目]: code, 一覧から: true });
    } catch (e) {
      alert(e instanceof ApiError ? e.message : String(e));
    }
    set版((x) => x + 1);
    await load();
  }
  function 商品を変える(r: Rec, 値: string) {
    const code = Number(値);
    if (!値.trim() || !code || code === r.商品コード) return;
    set在庫選択({ 出庫ID: r.出庫ID, 商品コード: code, 倉庫ID: r.倉庫ID ?? 0 });
  }
  // 左の積込順（Access の FS_積込順）
  async function 積込を直す(k: Rec, 項目: string, 値: string) {
    if (String(k[項目] ?? "") === 値) return;
    try {
      await api.post("/api/ws/tsumi/save", { ID: k.ID, 項目, 値 });
    } catch (e) {
      alert(e instanceof ApiError ? e.message : String(e));
    }
    await load();
  }
  async function 積込を足す() {
    try {
      await api.post("/api/ws/tsumi/new", { 輸送ID });
    } catch (e) {
      alert(e instanceof ApiError ? e.message : String(e));
    }
    await load();
  }
  async function 積込を消す(k: Rec) {
    if (!confirm(`届け順：${k.届け順 ?? ""}\n届け先：${k.届け先名 ?? ""}\n\n積み順：${k.積込順 ?? ""}\n集荷先：${k.出荷元名 ?? ""}\n\n並び順およびコメントの削除しますか？`)) return;
    try {
      await api.post("/api/ws/tsumi/delete", { ID: k.ID });
    } catch (e) {
      alert(e instanceof ApiError ? e.message : String(e));
    }
    await load();
  }
  async function 備考を選ぶ(k: Rec) {
    if (!備考欄) {
      try {
        set備考欄((await api.get<any>("/api/ws/detail-choices")).備考欄 ?? []);
      } catch (e) {
        return alert(e instanceof ApiError ? e.message : String(e));
      }
    }
    set備考選ぶ(k);
  }

  // 振分け（Access の cmd_Auto振分け）
  async function 振分け() {
    if (!confirm("自動振分けを開始します。以前のデータは上書きされますが、よろしいですか?")) return;
    try {
      await api.post("/api/ws/plan/furiwake", { 輸送ID });
      await load();
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
              <button className="red" onClick={削除} disabled={!輸送ID} title="この便を消し、明細を便からはずす">割付解除</button>
              <button disabled={!輸送ID} onClick={() => nav(`/ws/yomikomi?id=${輸送ID}`)} title="受注読込（FSD_受注選択）">配車割付</button>
              <button className="blue" onClick={() => set予定({ 開始: date, 終了: date, 便だけ: false })} title="出荷予定明細票（R_出荷予定明細票）">輸送印刷</button>
              <button
                className="blue"
                onClick={async () => {
                  try {
                    set予定票2(await api.get<Rec>("/api/ws/yotei2", { date }));
                  } catch (e) {
                    alert(e instanceof ApiError ? e.message : String(e));
                  }
                }}
                title="この出荷日から先の出荷予定明細票（工場の在庫の見込みつき。R_出荷予定明細票ver2）"
              >
                予定明細(在庫見込み)
              </button>
              <PageClose fallback="/maruhoku" />
            </div>
          </div>
          <div className="ws-row">
            <span className="lbl">セット℃</span>
            <Field value={p.セット温度} kind="num" className="temp" readOnly={!輸送ID} onCommit={(v) => save({ セット温度: n(v) })} />
            <button className="small" onClick={() => nav(`/ws/houkoku?date=${date}`)} title="出荷関連報告書印刷（FSD_出荷報告印刷）">入庫案内・出荷・送品案内</button>
            <button className="small" disabled={!輸送ID} onClick={async () => { try { set依頼書(await api.get<Rec>(`/api/ws/yusoirai/${輸送ID}`)); } catch (e) { alert(e instanceof ApiError ? e.message : String(e)); } }} title="輸送依頼書（R_輸送依頼書ver2）">輸送依頼書</button>
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
            <button className={"ws-notice" + (通知 ? " on" : "")} onClick={() => 通知 && set通知一覧(true)}>
              {通知 ? `通知 ${通知}件` : ""}
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
            <div key={`${k.ID}-${版}`} className={"ws-tsumi" + (leftTab === "備考" ? " memo-mode" : "")}>
              <div className="nums">
                <span>届順</span>
                <Field value={k.届け順} kind="num" className="ws-tn" onCommit={(v) => 積込を直す(k, "届け順", v.trim())} />
                <span>積順</span>
                <Field value={k.積込順} kind="num" className="ws-tn" onCommit={(v) => 積込を直す(k, "積込順", v.trim())} />
                <button className="small ws-tdel" onClick={() => 積込を消す(k)} title="この並び順とコメントを消します">削除</button>
              </div>
              <div className="ws-tcode">
                <Field value={k.積込順届け先} kind="num" kyotsu="tokui" className="c" onCommit={(v) => 積込を直す(k, "積込順届け先", v.trim())} />
                <span>{k.届け先名}</span>
              </div>
              <div className="ws-tcode">
                <Field value={k.積込順出荷元} kind="num" kyotsu="tokui" className="c" onCommit={(v) => 積込を直す(k, "積込順出荷元", v.trim())} />
                <span>{k.出荷元名}</span>
              </div>
              {leftTab === "備考" && (
                <textarea
                  key={k.積込備考 ?? ""}
                  className="memo"
                  defaultValue={k.積込備考 ?? ""}
                  title="ダブルクリックで備考欄から選べます"
                  onBlur={(e) => 積込を直す(k, "積込備考", e.target.value)}
                  onDoubleClick={() => 備考を選ぶ(k)}
                />
              )}
            </div>
          ))}
          <button className="small ws-furi" disabled={!輸送ID} onClick={積込を足す} title="並び順の行を 1 つ足します">追加</button>
          <button className="small ws-furi" disabled={!輸送ID} onClick={振分け} title="届け先・出荷元ごとに届け順と積込順を作り直します">振分け</button>
        </div>
        <div className="ws-gridwrap">
          <table className="ws-grid">
            <thead>
              <tr>
                <th title="積込確認（✔で在庫に登録）">積込</th>
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
                  <td className="c">
                    <input type="checkbox" checked={!!r.積込確認} onChange={(e) => 積込確認(r, e.target.checked)} />
                  </td>
                  <td className="notice">
                    <div className="y">{r.通知}</div>
                    <div className="r">{r.変更通知}</div>
                  </td>
                  <td>
                    <button className="small" onClick={() => nav(`/ws/detail/${r.出庫ID}`)}>詳細</button>
                  </td>
                  <td className="jun">{r.商品積込順}</td>
                  <td className="r kc">
                    <Field key={`t${版}`} value={r.届け先コード} kind="num" kyotsu="tokui" readOnly={!!r.chk} className="ws-code" onCommit={(v) => 明細を直す(r, "届け先コード", v)} />
                  </td>
                  <td>{r.届け先}</td>
                  <td className="r kc">
                    <Field key={`s${版}`} value={r.倉庫ID} kind="num" kyotsu="tokui" readOnly={!!r.chk} className="ws-code" onCommit={(v) => 明細を直す(r, "倉庫ID", v)} />
                  </td>
                  <td>{r.倉庫名}</td>
                  <td className="r kc">
                    <Field key={`c${版}`} value={r.商品コード} kind="num" kyotsu="shohin" readOnly={!!r.chk} className="ws-code" onCommit={(v) => 商品を変える(r, v)} />
                  </td>
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
      {在庫選択 && (
        <ZaikoSentaku
          {...在庫選択}
          onDone={async () => {
            set在庫選択(null);
            set版((x) => x + 1);
            await load();
          }}
        />
      )}
      {備考選ぶ && (
        <div className="modal" onClick={() => set備考選ぶ(null)}>
          <div className="find" onClick={(e) => e.stopPropagation()}>
            <div className="find-head">備考欄選択（押すと積込備考をこの文にします）<button onClick={() => set備考選ぶ(null)}>やめる</button></div>
            <div className="find-list">
              <table>
                <tbody>
                  {(備考欄 ?? []).map((o: any) => (
                    <tr key={o.id} onClick={async () => {
                      const k = 備考選ぶ;
                      set備考選ぶ(null);
                      await api.post("/api/ws/tsumi/save", { ID: k.ID, 項目: "積込備考", 値: o.name }).catch((e) => alert(e instanceof ApiError ? e.message : String(e)));
                      set版((x) => x + 1);
                      await load();
                    }}>
                      <td className="sub">{o.分類}</td>
                      <td className="sub">{o.作業分類}</td>
                      <td>{o.name}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
      {依頼書 && <輸送依頼書印刷 y={依頼書} onClose={() => set依頼書(null)} />}
      {予定 && (
        <div className="modal" onClick={() => set予定(null)}>
          <div className="yt-dlg" onClick={(e) => e.stopPropagation()}>
            <div className="head">出荷予定明細票</div>
            <label>出荷日 <input type="date" value={予定.開始} onChange={(e) => set予定({ ...予定, 開始: e.target.value })} /></label>
            <label>〜 <input type="date" value={予定.終了} onChange={(e) => set予定({ ...予定, 終了: e.target.value })} /></label>
            <label className="chk"><input type="checkbox" checked={予定.便だけ} disabled={!輸送ID} onChange={(e) => set予定({ ...予定, 便だけ: e.target.checked })} /> いま開いている便だけ</label>
            <div className="btns">
              <button
                className="blue"
                onClick={async () => {
                  try {
                    set予定票(await api.post<Rec>("/api/ws/yotei", 予定.便だけ ? { 輸送ID } : { 開始: 予定.開始, 終了: 予定.終了 }));
                    set予定(null);
                  } catch (e) {
                    alert(e instanceof ApiError ? e.message : String(e));
                  }
                }}
              >
                印刷表示
              </button>
              <button onClick={() => set予定(null)}>閉じる</button>
            </div>
          </div>
        </div>
      )}
      {予定票 && <出荷予定明細票印刷 y={予定票} onClose={() => set予定票(null)} />}
      {予定票2 && <出荷予定明細票ver2印刷 y={予定票2} onClose={() => set予定票2(null)} />}
      {通知一覧 && (
        <NoticeDialog
          onClose={() => set通知一覧(false)}
          onGo={async (r) => {
            if (!r.輸送ID) return alert("まだ便に入っていない出荷です。受注読込（配車割付）から登録してください。");
            set通知一覧(false);
            await 日付を移す(String(r.出荷日).slice(0, 10), r.輸送ID);
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

/** 通知（Access の FSD_通知）。計画変更のあった出荷の一覧。［→］でその便へ移る */
function NoticeDialog(props: { onClose: () => void; onGo: (r: Rec) => void }) {
  const [rows, setRows] = useState<Rec[]>([]);
  useEffect(() => {
    api.get<Rec[]>("/api/ws/notice/list").then(setRows);
  }, []);
  return (
    <div className="modal" onClick={props.onClose}>
      <div className="nt" onClick={(e) => e.stopPropagation()}>
        <div className="nt-head">
          変更があるレコードは <b>{rows.length}</b> 件あります
          <button onClick={props.onClose}>閉じる</button>
        </div>
        <table className="ws-grid">
          <thead>
            <tr><th>出荷日</th><th>商品名</th><th>届け先</th><th>配車伝票No</th><th></th><th>変更通知</th></tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.出庫ID}>
                <td>{String(r.出荷日 ?? "").slice(0, 10).replace(/-/g, "/")}</td>
                <td className="bold">{r.商品名}</td>
                <td>{r.届け先}</td>
                <td className="r">{r.輸送ID || ""}</td>
                <td><button className="small" onClick={() => props.onGo(r)}>移る</button></td>
                <td className="red">{r.変更通知}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
