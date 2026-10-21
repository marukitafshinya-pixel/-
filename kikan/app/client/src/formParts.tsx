import { useEffect, useState } from "react";
import { api } from "./api";

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
export function Field(props: {
  value: any;
  onCommit?: (v: string) => void;
  kind?: "text" | "num" | "date";
  readOnly?: boolean;
  className?: string;
  inputRef?: React.Ref<HTMLInputElement>;
  onDoubleClick?: () => void;
  list?: string;
  kyotsu?: "tokui" | "shohin";
}) {
  const shown = props.kind === "date" ? showDate(props.value) : props.value ?? "";
  const [draft, setDraft] = useState<string>(String(shown));
  const [finding, setFinding] = useState(false);
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
        title={kyotsu ? `共通コード（ダブルクリックで${props.kyotsu === "shohin" ? "商品" : "得意先"}を探せます）` : undefined}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onDoubleClick={kyotsu ? () => setFinding(true) : props.onDoubleClick}
      />
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
  kyotsu?: "tokui" | "shohin";
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

/** 名前から探す画面（Access の FSD_得意先選択・FSD_商品名選択） */
export function FindDialog(props: { kind: "tokui" | "shohin"; onPick: (code: number) => void; onClose: () => void }) {
  const [w, setW] = useState("");
  const [rows, setRows] = useState<{ コード: number; 名前: string; 補足: string }[]>([]);
  useEffect(() => {
    const h = setTimeout(() => api.get<any[]>("/api/juchu/form/find", { kind: props.kind, w }).then(setRows), 200);
    return () => clearTimeout(h);
  }, [w, props.kind]);
  return (
    <div className="modal" onClick={props.onClose}>
      <div className="find" onClick={(e) => e.stopPropagation()}>
        <div className="find-head">
          {props.kind === "shohin" ? "商品名で探す" : "得意先を探す"}
          <input autoFocus value={w} onChange={(e) => setW(e.target.value)} placeholder="名前の一部かコード" />
          <button onClick={props.onClose}>やめる</button>
        </div>
        <div className="find-list">
          <table>
            <tbody>
              {rows.map((r) => (
                <tr key={r.コード} onClick={() => props.onPick(r.コード)}>
                  <td className="num">{r.コード}</td>
                  <td>{r.名前}</td>
                  <td className="sub">{r.補足}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
