import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { api } from "./api";

/**
 * 画面を閉じて戻る（2026/10/28 利用者：閉じるボタンをそろえる）。来た画面があればそこへ戻り、
 * この画面を直接開いたとき（戻る先がないとき）は fallback（ふつうはメニュー）へ。
 */
export function useBack(fallback = "/") {
  const nav = useNavigate();
  const loc = useLocation();
  return () => (loc.key && loc.key !== "default" ? nav(-1) : nav(fallback));
}

/** 画面の閉じるボタン。どの画面でも右上の同じ場所・同じ見た目に出す（styles.css の .page-close） */
export function PageClose(props: { onClick?: () => void; label?: string; fallback?: string; disabled?: boolean; title?: string }) {
  const back = useBack(props.fallback);
  return (
    <button type="button" className="page-close" onClick={props.onClick ?? back} disabled={props.disabled} title={props.title}>
      {props.label ?? "閉じる"}
    </button>
  );
}

export type Opt = { code: number | string; name: string };

/** 入力欄の値（空欄は null）。Access と同じく、空欄どうし・空欄との比べは「違う」としない。 */
export function differs(a: unknown, b: unknown): boolean {
  if (a === null || a === undefined || a === "" || b === null || b === undefined || b === "") return false;
  return String(a) !== String(b);
}

/** Access で小数を整数の項目に入れたときと同じ丸め方（.5 は偶数の方へ） */
export function cint(v: number): number {
  const f = Math.floor(v);
  const d = v - f;
  if (d > 0.5) return f + 1;
  if (d < 0.5) return f;
  return f % 2 === 0 ? f : f + 1;
}

export function pad(n: number) {
  return String(n).padStart(2, "0");
}

/** 日付の打ち方（10/28、2026/10/28、20261028 など）を "2026-10-28" にする。読めなければ undefined。 */
export function parseDate(s: string): string | null | undefined {
  s = s.trim().replace(/[．。.\-]/g, "/");
  if (!s) return null;
  let y = new Date().getFullYear();
  let m: number, d: number;
  const p = s.split("/").map((x) => Number(x));
  if (/^\d{8}$/.test(s)) [y, m, d] = [Number(s.slice(0, 4)), Number(s.slice(4, 6)), Number(s.slice(6))];
  else if (p.length === 2) [m, d] = p;
  else if (p.length === 3) [y, m, d] = p;
  else return undefined;
  if (y < 100) y += 2000;
  const dt = new Date(y, m - 1, d);
  if (isNaN(+dt) || dt.getMonth() !== m - 1) return undefined;
  return `${y}-${pad(m)}-${pad(d)}`;
}

export function showDate(v: string | null | undefined): string {
  return v ? v.slice(0, 10).replace(/-/g, "/") : "";
}

export function today(): string {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** 統一受注ID（年間ID）＝納品日の「年2けた＋月」-商品コード（Access と同じ） */
export function 統一受注ID(納品日: string | null, 商品コード: unknown): string {
  const yymm = 納品日 ? 納品日.slice(2, 4) + 納品日.slice(5, 7) : "";
  return `${yymm}-${商品コード ?? ""}`;
}

/** 文字を打つ欄。確定（Enter・ほかの欄へ移る）したときだけ onCommit を呼ぶ（Access の「更新後処理」と同じ）。 */
/**
 * 共通コード（全システムで使うマスタのコード）が入る欄の印。アプリ全体の決まり：
 * kyotsu="tokui"（得意先の短縮コード）・kyotsu="shohin"（商品コード）を付けると、色を変え、
 * ダブルクリックでそのマスタを探す画面を出す（選ぶと onCommit にそのコードが入る）。
 */
/**
 * 数の欄：ブラウザでは日本語入力を切れないので、全角の数字（１２３）は半角にし、数字・小数点・マイナス以外は入らないようにする
 * （2026/10/28 利用者の依頼：数の欄は数値型・変換オフ）
 */
export function 数字だけ(v: string): string {
  return v
    .replace(/[０-９．－]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0))
    .replace(/[ー−‐]/g, "-")
    .replace(/[^0-9.\-]/g, "");
}

export function Field(props: {
  value: any;
  onCommit?: (v: string) => void;
  kind?: "text" | "num" | "date";
  readOnly?: boolean;
  className?: string;
  inputRef?: React.Ref<HTMLInputElement>;
  onDoubleClick?: () => void;
  list?: string;
  kyotsu?: "tokui" | "shohin" | "unso";
}) {
  const shown = props.kind === "date" ? showDate(props.value) : props.value ?? "";
  const [draft, setDraft] = useState<string>(String(shown));
  const [finding, setFinding] = useState(false);
  const [calendar, setCalendar] = useState(false);
  useEffect(() => setDraft(String(shown)), [shown]);
  const commit = () => {
    if (draft !== String(shown)) props.onCommit?.(draft);
  };
  const kyotsu = props.kyotsu && !props.readOnly;
  return (
    <>
      <input
        ref={props.inputRef}
        className={(props.className ?? "") + (props.kind === "num" ? " r" : "") + (props.kyotsu ? " kyotsu" : "")}
        value={draft}
        readOnly={props.readOnly}
        tabIndex={props.readOnly ? -1 : undefined}
        list={props.list}
        title={kyotsu ? `共通コード（ダブルクリックで${props.kyotsu === "shohin" ? "商品" : props.kyotsu === "unso" ? "運送会社" : "得意先"}を探せます）` : props.kind === "date" && !props.readOnly ? "ダブルクリックでカレンダーから選べます" : undefined}
        inputMode={props.kind === "num" ? "decimal" : undefined}
        onChange={(e) => setDraft(props.kind === "num" && !(e.nativeEvent as InputEvent).isComposing ? 数字だけ(e.target.value) : e.target.value)}
        onCompositionEnd={props.kind === "num" ? (e) => setDraft(数字だけ(e.currentTarget.value)) : undefined}
        onBlur={commit}
        onDoubleClick={
          kyotsu ? () => setFinding(true) : props.kind === "date" && !props.readOnly && !props.onDoubleClick ? () => setCalendar(true) : props.onDoubleClick
        }
      />
      {calendar && (
        <CalendarDialog
          value={props.value}
          onClose={() => setCalendar(false)}
          onPick={(d) => {
            setCalendar(false);
            const v = d.replace(/-/g, "/");
            setDraft(v);
            props.onCommit?.(v);
          }}
        />
      )}
      {finding && (
        <FindDialog
          kind={props.kyotsu!}
          onClose={() => setFinding(false)}
          onPick={(c) => {
            setFinding(false);
            setDraft(String(c));
            props.onCommit?.(String(c));
          }}
        />
      )}
    </>
  );
}
export function Combo(props: {
  value: any;
  options: Opt[];
  onCommit: (v: string) => void;
  onFind?: () => void;
  className?: string;
  inputRef?: React.Ref<HTMLInputElement>;
  wide?: boolean;
  kyotsu?: "tokui" | "shohin" | "unso";
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className={"combo " + (props.className ?? "")}>
      <Field value={props.value} kind="num" onCommit={props.onCommit} onDoubleClick={props.onFind} inputRef={props.inputRef} kyotsu={props.kyotsu} />
      <button type="button" tabIndex={-1} onClick={() => setOpen(!open)} title="一覧から選ぶ">
        ▾
      </button>
      {open && (
        <div className={"combo-list" + (props.wide ? " wide" : "")} onMouseLeave={() => setOpen(false)}>
          {props.options.length === 0 && <div className="empty">（選べるものがありません）</div>}
          {props.options.map((o) => (
            <div
              key={String(o.code)}
              onClick={() => {
                setOpen(false);
                props.onCommit(String(o.code));
              }}
            >
              <span className="c">{o.code}</span>
              <span>{o.name}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/** カナのボタン（Access の探す画面と同じ。行ごとのまとめと、2 文字目からの 1 文字ずつ） */
const カナ行: [string, string, string[]][] = [
  ["ｱ", "ｱ-ｵ", ["ｲ", "ｳ", "ｴ", "ｵ"]],
  ["ｶ", "ｶ-ｺ", ["ｷ", "ｸ", "ｹ", "ｺ"]],
  ["ｻ", "ｻ-ｿ", ["ｼ", "ｽ", "ｾ", "ｿ"]],
  ["ﾀ", "ﾀ-ﾄ", ["ﾁ", "ﾂ", "ﾃ", "ﾄ"]],
  ["ﾅ", "ﾅ-ﾉ", ["ﾆ", "ﾇ", "ﾈ", "ﾉ"]],
  ["ﾊ", "ﾊ-ﾎ", ["ﾋ", "ﾌ", "ﾍ", "ﾎ"]],
  ["ﾏ", "ﾏ-ﾓ", ["ﾐ", "ﾑ", "ﾒ", "ﾓ"]],
  ["ﾔ", "ﾔ-ﾖ", ["ﾕ", "ﾖ"]],
  ["ﾗ", "ﾗ-ﾛ", ["ﾘ", "ﾙ", "ﾚ", "ﾛ"]],
  ["ﾜ", "ﾜ-ﾝ", ["ﾝ"]],
];

type 一覧 = { id: number | string; name: string }[];

/**
 * 共通の探す画面（Access の FSD_得意先選択・FSD_商品名選択）。
 * カナのボタン・文字・分類などで絞り、行をダブルクリック（または選んで［選択］）するとそのコードを返す。
 */
export function FindDialog(props: { kind: "tokui" | "shohin" | "unso"; onPick: (code: number) => void; onClose: () => void }) {
  const 商品 = props.kind === "shohin";
  const 運送 = props.kind === "unso";
  const [kana, setKana] = useState("ｱ-ﾝ"); // Access と同じく、開いたときは「全」（ｱ-ﾝ）
  const [w, setW] = useState("");
  const [col, setCol] = useState("商品名");
  const [sel, setSel] = useState<Record<string, string>>({});
  const [sort, setSort] = useState(商品 ? "商品コード" : 運送 ? "運送会社ID" : "ｶﾅ分類");
  const [rows, setRows] = useState<Record<string, any>[]>([]);
  const [cur, setCur] = useState<number | null>(null);
  const [lists, setLists] = useState<Record<string, 一覧>>({});
  const [pref, setPref] = useState<一覧>([]);

  useEffect(() => {
    api.get<Record<string, 一覧>>("/api/find/lists").then(setLists);
  }, []);
  useEffect(() => {
    const h = setTimeout(
      () =>
        api
          .get<any[]>(`/api/find/${props.kind}`, { kana, w, col, sort, ...sel })
          .then((r) => {
            setRows(r);
            setCur(r[0]?.コード ?? null);
          }),
      200,
    );
    return () => clearTimeout(h);
  }, [kana, w, col, sort, sel, 商品]);

  const 全部 = () => {
    setKana("");
    setW("");
    setSel({});
    setPref([]);
  };
  const 選ぶ = (k: string, v: string) => setSel((o) => ({ ...o, [k]: v }));
  const head = 運送
    ? ([["カナ分類", "ｶﾅ"], ["運送会社ID", "コード"], ["短縮名", "運送会社"], ["住所", "住所"]] as const)
    : 商品
    ? ([["ｶﾅ分類", "ｶﾅ"], ["商品コード", "コード"], ["本社コード", "本社"], ["商品名", "商品名"], ["規格", "規格"], ["分類名", "分類"]] as const)
    : ([["ｶﾅ分類", "ｶﾅ"], ["短縮コード", "コード"], ["短縮名", "短縮名"], ["得意先名", "得意先名"], ["住所", "住所"]] as const);
  const 値 = (r: Record<string, any>, k: string) => (k === "商品コード" || k === "短縮コード" || k === "運送会社ID" ? r.コード : r[k]);
  const pick = (code: number | null) => code !== null && props.onPick(code);

  return (
    <div className="modal" onClick={props.onClose}>
      <div className="find big" onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.key === "Escape" && props.onClose()}>
        <div className="find-head">
          {商品 ? "商品名選択" : 運送 ? "運送会社選択" : "得意先選択"}
          <span className="cap">{kana ? `［${kana}］` : "すべて"}{w ? `「${w}」` : ""}</span>
          <button onClick={() => pick(cur)} disabled={cur === null}>
            選択
          </button>
          <button onClick={props.onClose}>キャンセル</button>
        </div>
        <div className="kana">
          <button className={kana === "ｱ-ﾝ" ? "on" : ""} onClick={() => setKana("ｱ-ﾝ")}>
            全
          </button>
          {カナ行.map(([label, range, singles]) => (
            <div key={label} className="kana-col">
              <button className={kana === range ? "on" : ""} onClick={() => setKana(range)}>
                {label}
              </button>
              {singles.map((c) => (
                <button key={c} className={"one" + (kana === c ? " on" : "")} onClick={() => setKana(c)}>
                  {c}
                </button>
              ))}
            </div>
          ))}
          <button className="all" onClick={全部}>
            すべて
          </button>
        </div>
        <div className="find-filters">
          {運送 ? (
            <input autoFocus value={w} onChange={(e) => setW(e.target.value)} placeholder="運送会社名の一部かコード" />
          ) : 商品 ? (
            <>
              <select value={col} onChange={(e) => setCol(e.target.value)}>
                {["商品名", "短縮名", "規格", "取引先名", "本社コード", "グループ商品コード"].map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>
              <input autoFocus value={w} onChange={(e) => setW(e.target.value)} placeholder="で探す（文字の一部）" />
              <select value={sel.bunrui ?? ""} onChange={(e) => 選ぶ("bunrui", e.target.value)}>
                <option value="">分類</option>
                {(lists.分類 ?? []).map((o) => (
                  <option key={o.id} value={o.id}>{o.name}</option>
                ))}
              </select>
              <select value={sel.genryo ?? ""} onChange={(e) => 選ぶ("genryo", e.target.value)}>
                <option value="">原料</option>
                {(lists.原料 ?? []).map((o) => (
                  <option key={o.id} value={o.id}>{o.name}</option>
                ))}
              </select>
              <label>
                <input type="checkbox" checked={sel.old === "1"} onChange={(e) => 選ぶ("old", e.target.checked ? "1" : "")} />
                旧コード
              </label>
            </>
          ) : (
            <>
              <input autoFocus value={w} onChange={(e) => setW(e.target.value)} placeholder="得意先名の一部かコード" />
              <select
                value={sel.chiku ?? ""}
                onChange={async (e) => {
                  setSel((o) => ({ ...o, chiku: e.target.value, pref: "" }));
                  setPref(e.target.value ? await api.get<一覧>("/api/find/pref", { chiku: e.target.value }) : []);
                }}
              >
                <option value="">地区</option>
                {(lists.地区 ?? []).map((o) => (
                  <option key={o.id} value={o.id}>{o.name}</option>
                ))}
              </select>
              <select value={sel.pref ?? ""} onChange={(e) => 選ぶ("pref", e.target.value)} disabled={pref.length === 0}>
                <option value="">都道府県</option>
                {pref.map((o) => (
                  <option key={o.name}>{o.name}</option>
                ))}
              </select>
              <select value={sel.group ?? ""} onChange={(e) => 選ぶ("group", e.target.value)}>
                <option value="">グループ</option>
                {(lists.グループ ?? []).map((o) => (
                  <option key={o.id} value={o.id}>{o.name ?? o.id}</option>
                ))}
              </select>
              <select value={sel.group3 ?? ""} onChange={(e) => 選ぶ("group3", e.target.value)}>
                <option value="">グループ3</option>
                {(lists.グループマスタ ?? []).map((o) => (
                  <option key={o.id} value={o.id}>{o.name}</option>
                ))}
              </select>
              <select value={sel.hokan ?? ""} onChange={(e) => 選ぶ("hokan", e.target.value)}>
                <option value="">保管：全部</option>
                <option value="2">倉庫（出荷元）</option>
                <option value="3">倉庫（出荷元でない）</option>
              </select>
            </>
          )}
        </div>
        <div className="find-list">
          <table>
            <thead>
              <tr>
                {head.map(([k, label]) => (
                  <th key={k} className={sort === k ? "on" : ""} onClick={() => setSort(k)} title="押すとこの順に並べます">
                    {label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.コード} className={cur === r.コード ? "cur" : ""} onClick={() => setCur(r.コード)} onDoubleClick={() => pick(r.コード)}>
                  {head.map(([k]) => (
                    <td key={k} className={k === "商品コード" || k === "短縮コード" || k === "運送会社ID" ? "num" : k === "ｶﾅ分類" || k === "カナ分類" ? "kn" : ""}>
                      {値(r, k)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
          {rows.length === 0 && <p className="empty">当てはまるものがありません</p>}
        </div>
      </div>
    </div>
  );
}

type 日 = { date: string; label: string; inMonth: boolean; holiday: string; color: "red" | "blue" | "black"; underline: boolean };

/**
 * 共通のカレンダー（Access の FSD_日付選択）。年・月を選び、日を押すとその日を返す。
 * 祝日・会社の休日は赤の下線（名前は日に重ねると出る）、日曜は赤、土曜は青、今日は黄色。
 */
export function CalendarDialog(props: { value?: string | null; onPick: (date: string) => void; onClose: () => void }) {
  const base = props.value ? new Date(props.value.slice(0, 10) + "T00:00:00") : new Date();
  const [year, setYear] = useState(base.getFullYear());
  const [month, setMonth] = useState(base.getMonth() + 1);
  const [days, setDays] = useState<日[]>([]);
  useEffect(() => {
    api.get<日[]>("/api/calendar", { year, month }).then(setDays);
  }, [year, month]);
  const todayStr = today();
  const years = Array.from({ length: 11 }, (_, i) => base.getFullYear() - 5 + i);
  return (
    <div className="modal" onClick={props.onClose}>
      <div className="cal" onClick={(e) => e.stopPropagation()}>
        <div className="cal-head">
          <select value={year} onChange={(e) => setYear(Number(e.target.value))}>
            {years.map((y) => (
              <option key={y}>{y}</option>
            ))}
          </select>
          <span>年度</span>
          <button onClick={props.onClose}>キャンセル</button>
        </div>
        <div className="cal-months">
          {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
            <button key={m} className={m === month ? "on" : ""} onClick={() => setMonth(m)}>
              {m}
            </button>
          ))}
        </div>
        <div className="cal-grid">
          {days.map((d) => (
            <button
              key={d.date}
              className={(d.inMonth ? "" : "out ") + (d.date === todayStr ? "today " : "") + d.color + (d.underline ? " ul" : "")}
              title={d.holiday}
              onClick={() => props.onPick(d.date)}
            >
              {d.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
