import { useEffect, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { api, ApiError } from "../api";

type Rec = Record<string, any>;
type Opt = { code: number | string; name: string };

/** 入力欄の値（空欄は null）。Access と同じく、空欄どうし・空欄との比べは「違う」としない。 */
function differs(a: unknown, b: unknown): boolean {
  if (a === null || a === undefined || a === "" || b === null || b === undefined || b === "") return false;
  return String(a) !== String(b);
}

/** Access で小数を整数の項目に入れたときと同じ丸め方（.5 は偶数の方へ） */
function cint(v: number): number {
  const f = Math.floor(v);
  const d = v - f;
  if (d > 0.5) return f + 1;
  if (d < 0.5) return f;
  return f % 2 === 0 ? f : f + 1;
}

function pad(n: number) {
  return String(n).padStart(2, "0");
}

/** 日付の打ち方（10/28、2026/10/28、20261028 など）を "2026-10-28" にする。読めなければ undefined。 */
function parseDate(s: string): string | null | undefined {
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

function showDate(v: string | null | undefined): string {
  return v ? v.slice(0, 10).replace(/-/g, "/") : "";
}

function today(): string {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** 統一受注ID（年間ID）＝納品日の「年2けた＋月」-商品コード（Access と同じ） */
function 統一受注ID(納品日: string | null, 商品コード: unknown): string {
  const yymm = 納品日 ? 納品日.slice(2, 4) + 納品日.slice(5, 7) : "";
  return `${yymm}-${商品コード ?? ""}`;
}

/** 文字を打つ欄。確定（Enter・ほかの欄へ移る）したときだけ onCommit を呼ぶ（Access の「更新後処理」と同じ）。 */
function Field(props: {
  value: any;
  onCommit?: (v: string) => void;
  kind?: "text" | "num" | "date";
  readOnly?: boolean;
  className?: string;
  inputRef?: React.Ref<HTMLInputElement>;
  onDoubleClick?: () => void;
  list?: string;
}) {
  const shown = props.kind === "date" ? showDate(props.value) : props.value ?? "";
  const [draft, setDraft] = useState<string>(String(shown));
  useEffect(() => setDraft(String(shown)), [shown]);
  const commit = () => {
    if (draft !== String(shown)) props.onCommit?.(draft);
  };
  return (
    <input
      ref={props.inputRef}
      className={(props.className ?? "") + (props.kind === "num" ? " r" : "")}
      value={draft}
      readOnly={props.readOnly}
      tabIndex={props.readOnly ? -1 : undefined}
      list={props.list}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onDoubleClick={props.onDoubleClick}
    />
  );
}

/** 一覧から選べる欄（Access のコンボボックス）。▼で一覧、ダブルクリックで名前から探す。 */
function Combo(props: {
  value: any;
  options: Opt[];
  onCommit: (v: string) => void;
  onFind?: () => void;
  className?: string;
  inputRef?: React.Ref<HTMLInputElement>;
  wide?: boolean;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className={"combo " + (props.className ?? "")}>
      <Field value={props.value} kind="num" onCommit={props.onCommit} onDoubleClick={props.onFind} inputRef={props.inputRef} />
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
function FindDialog(props: { kind: "tokui" | "shohin"; onPick: (code: number) => void; onClose: () => void }) {
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

const 画面名 = "FM_受注登録_届け先指定";

/** 受注登録（届け先指定）。Access の FM_受注登録_届け先指定 */
export default function JuchuTodokeForm() {
  const nav = useNavigate();
  const [sp] = useSearchParams();
  const groupId = sp.get("id");
  const jidParam = sp.get("jid");

  const [defaults, setDefaults] = useState<Rec | null>(null); // 新しく入力するときの初めの値
  const [saved, setSaved] = useState<Rec>({}); // 最後に保存した（または開いた）ときの値
  const [rec, setRec] = useState<Rec>({});
  const [dirty, setDirty] = useState(false);
  const [chkUnlocked, setChkUnlocked] = useState(false);
  const [todokeOpts, setTodokeOpts] = useState<Opt[]>([]);
  const [shohinOpts, setShohinOpts] = useState<Opt[]>([]);
  const [meigiOpts, setMeigiOpts] = useState<Opt[]>([]);
  const [meigiName, setMeigiName] = useState("");
  const [find, setFind] = useState<null | { kind: "tokui" | "shohin"; pick: (code: number) => void }>(null);
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const bangoRef = useRef<HTMLInputElement>(null);
  const formRef = useRef<HTMLDivElement>(null);

  // 書き換え中の値をすぐ読めるように（続けて処理するとき用）
  const recRef = useRef(rec);
  recRef.current = rec;

  function patch(p: Rec) {
    setRec((r) => ({ ...r, ...p }));
    recRef.current = { ...recRef.current, ...p };
    setDirty(true);
  }

  // ---- 選択肢 ----
  async function loadTodokeOpts(r: Rec) {
    const rows = await api.get<any[]>("/api/juchu/form/todoke", { moto: r.受注元ID, saki: r.受注先ID });
    setTodokeOpts(rows.map((x) => ({ code: x.届け先コード, name: x.届け先 })));
  }
  async function loadShohinOpts(saki: unknown, todoke?: unknown) {
    const rows = await api.get<any[]>("/api/juchu/form/shohin", { saki: saki as any, todoke: todoke as any });
    setShohinOpts(rows.map((x) => ({ code: x.商品コード, name: x.商品名 })));
  }
  async function loadMeigiOpts(r: Rec) {
    const rows = await api.get<any[]>("/api/juchu/form/meigi", {
      torihiki: r.取引元ID, moto: r.受注元ID, todoke: r.届け先コード, saki: r.受注先ID,
    });
    setMeigiOpts(rows.map((x) => ({ code: x.入庫名義ID, name: x.名義名 })));
  }

  async function openNew(d: Rec) {
    setRec(d);
    recRef.current = d;
    setSaved(d);
    setDirty(false);
    setChkUnlocked(false);
    setTimeout(() => bangoRef.current?.focus(), 0);
  }

  async function openRecord(jid: number) {
    const r = await api.get<Rec>(`/api/juchu/form/record/${jid}`);
    setRec(r);
    recRef.current = r;
    setSaved(r);
    setDirty(false);
    setChkUnlocked(false);
    loadTodokeOpts(r);
    loadShohinOpts(r.受注先ID);
  }

  useEffect(() => {
    if (jidParam) {
      openRecord(Number(jidParam));
    } else if (groupId) {
      api.get<Rec>(`/api/juchu/form/new/${groupId}`).then((d) => {
        setDefaults(d);
        openNew(d);
        loadTodokeOpts(d);
        loadShohinOpts(d.受注先ID);
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groupId, jidParam]);

  useEffect(() => {
    const code = rec.入庫名義ID;
    if (code === null || code === undefined || code === "" || Number(code) === 0) return setMeigiName("");
    api.get<any>(`/api/juchu/form/tokui/${code}`).then((r) => setMeigiName(r.短縮名 ?? ""));
  }, [rec.入庫名義ID]);

  // ---- 入力したときの処理（Access の「更新後処理」） ----
  const numOrNull = (v: string) => (v.trim() === "" ? null : Number(v));

  async function 届け先コードを変えた(v: string) {
    const code = numOrNull(v);
    patch({ 届け先コード: code });
    if (code === null || isNaN(code)) return;
    const t = await api.get<any>(`/api/juchu/form/tokui/${code}`);
    patch({ 届け先: t.短縮名, 正式届け先名: t.得意先名 });
    const r = recRef.current;
    loadShohinOpts(r.受注先ID, code);
    loadMeigiOpts(r);
  }

  async function 商品コードを変えた(v: string) {
    const code = numOrNull(v);
    patch({ 商品コード: code });
    if (code === null || isNaN(code)) return;
    const s = await api.get<any>(`/api/juchu/form/shohin-info/${code}`);
    const r = recRef.current;
    patch({ 商品名: s.商品名, 規格: s.規格, 入数: s.入数, 受注日: today(), 統一受注ID: 統一受注ID(r.納品日, code) });
    const m = await api.get<any>("/api/juchu/form/meigi-default", {
      moto: r.受注元ID, todoke: r.届け先コード, saki: r.受注先ID, shohin: code,
    });
    patch({ 入庫名義ID: m.入庫名義ID });
  }

  function ケースを変えた(v: string) {
    const c = numOrNull(v);
    const r = recRef.current;
    const p: Rec = { ケース: c, 残ケース: c };
    if (Number(r.商品コード) !== 999) p.商品kg = c === null || r.入数 === null || r.入数 === undefined ? null : c * r.入数;
    patch(p);
  }
  function ケース1を変えた(v: string) {
    const c = numOrNull(v);
    const r = recRef.current;
    const p: Rec = { ケース1: c };
    if (Number(r.商品コード) !== 999) p.商品kg1 = c === null || r.入数 === null || r.入数 === undefined ? null : c * r.入数;
    patch(p);
  }
  // 商品kg からケースを出す（入数がないときは何もしない）
  function kgを変えた(v: string, which: "" | "1") {
    const kg = numOrNull(v);
    const r = recRef.current;
    const p: Rec = { ["商品kg" + which]: kg };
    if (kg !== null && r.入数) p["ケース" + which] = cint(kg / r.入数);
    patch(p);
  }

  function 納品日を変えた(v: string, which: "" | "1") {
    const d = parseDate(v);
    if (d === undefined) {
      alert("日付の書き方が正しくありません。（例：10/28）");
      setRec({ ...recRef.current });
      return;
    }
    if (which === "1") return patch({ 納品日1: d });
    patch({ 納品日: d, 統一受注ID: 統一受注ID(d, recRef.current.商品コード) });
  }

  function 受注番号1を変えた(v: string) {
    patch({ 受注番号1: v === "" ? null : v });
    if (differs(recRef.current.受注番号, v)) {
      alert("受注番号が誤まりです");
      bangoRef.current?.focus();
    }
  }

  async function 受注先IDを変えた(v: string) {
    const code = numOrNull(v);
    patch({ 受注先ID: code });
    const t = code === null ? { 短縮名: null } : await api.get<any>(`/api/juchu/form/tokui/${code}`);
    patch({ 受注先名: t.短縮名 });
  }

  function chkを押した(on: boolean) {
    if (on) {
      if (!confirm("処理済みとして非表示します、よろしいですか？")) {
        // Access と同じく、この受注の入力をすべて元に戻す
        setRec(saved);
        recRef.current = saved;
        setDirty(false);
        return;
      }
    }
    patch({ chk: on });
  }

  // ---- 保存（Access の「更新前処理」の確かめ） ----
  async function save(): Promise<boolean> {
    const r = { ...recRef.current };
    const errs: string[] = [];
    if (!r.受注番号) {
      if (confirm("受注番号がありません。受注番号を作成しますか？")) {
        const d = new Date();
        r.受注番号 = `${String(d.getFullYear()).slice(2)}${pad(d.getMonth() + 1)}${pad(d.getDate())}${r.商品コード ?? ""}${r.届け先コード ?? ""}`;
      } else if (differs(r.受注番号, r.受注番号1)) {
        errs.push("受注番号が誤りです、確認してください。");
      }
    }
    if (differs(r.商品コード, r.商品コード1)) errs.push("商品コードが誤りです、確認してください。");
    if (differs(r.商品kg, r.商品kg1)) errs.push("商品kgが誤りです、確認してください。");
    if (differs(r.ケース, r.ケース1)) errs.push("ケースが誤りです、確認してください。");
    if (differs(r.届け先コード, r.届け先コード1)) errs.push("届け先コードが誤りです、確認してください。");
    if (differs(r.納品日?.slice(0, 10), r.納品日1?.slice(0, 10))) errs.push("納品日が誤りです、確認してください。");
    if (errs.length) {
      alert(errs.join("\n"));
      return false;
    }
    setBusy(true);
    try {
      const res = await api.post<{ 受注ID: number }>("/api/juchu/form/save", r);
      setMsg(`受注ID ${res.受注ID} で${r.受注ID ? "直しました" : "登録しました"}`);
      if (r.受注ID) {
        await openRecord(res.受注ID);
      } else if (defaults) {
        // 続けて次の受注を入力できるように、新しい入力に戻す（Access の新規レコードへの移動と同じ）
        await openNew(defaults);
      } else {
        await openRecord(res.受注ID);
      }
      return true;
    } catch (e) {
      alert(e instanceof ApiError ? e.message : String(e));
      return false;
    } finally {
      setBusy(false);
    }
  }

  /** ほかへ移る前に、入力中のものを保存する（Access は閉じるときに自動で保存する） */
  async function saveBeforeLeave(): Promise<boolean> {
    if (!dirty) return true;
    if (await save()) return true;
    return confirm("この受注は保存できません。保存しないで進みますか？");
  }

  async function move(dir: "prev" | "next") {
    if (!(await saveBeforeLeave())) return;
    const from = rec.受注ID ?? (dir === "prev" ? 2147483647 : 0);
    const r = await api.get<{ 受注ID: number | null }>("/api/juchu/form/move", { from, dir });
    if (r.受注ID) openRecord(r.受注ID);
  }

  async function goNew() {
    if (!(await saveBeforeLeave())) return;
    if (defaults) openNew(defaults);
  }

  async function del() {
    if (!confirm("現在表示されているレコードを削除しますか？")) return;
    const pass = prompt("パスワードを入力してください。");
    if (pass === null) return;
    if (!rec.受注ID) {
      // まだ保存していない受注は、入力を消すだけ
      if (defaults) openNew(defaults);
      return;
    }
    try {
      const r = await api.post<{ 削除: boolean; chkを外せる?: boolean }>("/api/juchu/form/delete", { 受注ID: rec.受注ID, 合言葉: pass, chk: !!rec.chk });
      if (r.chkを外せる) {
        setChkUnlocked(true);
        return;
      }
      setMsg(`受注ID ${rec.受注ID} を削除しました`);
      if (defaults) openNew(defaults);
      else nav("/juchu/search");
    } catch (e) {
      alert(e instanceof ApiError ? (e.status === 403 ? (rec.chk ? "すでに登録済みの為、削除できません。" : e.message) : e.message) : String(e));
    }
  }

  // Enter で次の欄へ（Access と同じ打ち方）
  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key !== "Enter" || (e.target as HTMLElement).tagName === "TEXTAREA" || e.nativeEvent.isComposing) return;
    const els = Array.from(formRef.current?.querySelectorAll<HTMLElement>("input:not([readonly]):not([type=checkbox]), textarea") ?? []);
    const i = els.indexOf(e.target as HTMLElement);
    if (i >= 0) {
      e.preventDefault();
      (e.target as HTMLElement).blur();
      setTimeout(() => els[i + 1]?.focus(), 0);
    }
  }

  const locked受注先 = Number(rec.受注先ID ?? 0) !== 0 && !!groupId && Number(defaults?.受注先ID ?? 0) !== 0;
  const tokuiFind = (pick: (code: number) => void) => () => setFind({ kind: "tokui", pick });

  return (
    <div className="jform" onKeyDown={onKeyDown} ref={formRef}>
      <div className="tabs">
        <span>受注管理</span>
        <span>受注選択画面</span>
        <span className="active">{画面名}</span>
      </div>
      <div className="jf-top">
        <div className="jf-row">
          <span className="lbl">自社受注番号</span>
          <span className="jid">{rec.受注ID ? rec.受注ID : "（新規）"}</span>
          <div className="jf-btns">
            <button onClick={del} disabled={busy}>
              削除
            </button>
            <button
              className="blue"
              onClick={async () => {
                if (await saveBeforeLeave()) nav("/juchu/search");
              }}
            >
              検索
            </button>
            <button
              onClick={async () => {
                if (await saveBeforeLeave()) nav(-1);
              }}
            >
              閉じる
            </button>
          </div>
        </div>
        <div className="jf-row big">
          <span className="lbl">受注先</span>
          <Field value={rec.受注先ID} kind="num" className="code" readOnly={locked受注先} onCommit={受注先IDを変えた}
            onDoubleClick={locked受注先 ? undefined : tokuiFind((c) => 受注先IDを変えた(String(c)))} />
          <Field value={rec.受注先名} className="name" readOnly={locked受注先} onCommit={(v) => patch({ 受注先名: v })} />
        </div>
        <div className="jf-row big">
          <span className="lbl">帳合先</span>
          <Field value={rec.受注帳合ID} kind="num" className="code" readOnly={locked受注先} onCommit={(v) => patch({ 受注帳合ID: numOrNull(v) })}
            onDoubleClick={locked受注先 ? undefined : tokuiFind((c) => patch({ 受注帳合ID: c }))} />
          <Field value={rec.受注帳合名} className="name" readOnly={locked受注先} onCommit={(v) => patch({ 受注帳合名: v })} />
        </div>
        <div className="jf-row">
          <span className="lbl">引き取り区分</span>
          <div className="toggle2 jf-toggle">
            <button className={!rec.蔵前区分 ? "on" : ""} onClick={() => patch({ 蔵前区分: false })}>
              届け
            </button>
            <button className={rec.蔵前区分 ? "on" : ""} onClick={() => patch({ 蔵前区分: true })}>
              蔵前渡し
            </button>
          </div>
          <span className="lbl small">年間ID</span>
          <input className="toitsu" value={rec.統一受注ID ?? ""} readOnly tabIndex={-1} />
        </div>
      </div>

      <div className="jf-body">
        <div className="jf-line">
          <span className="lbl">受注番号</span>
          <Field value={rec.受注番号} className="w1 yellow" inputRef={bangoRef} onCommit={(v) => patch({ 受注番号: v === "" ? null : v })} />
          <Field value={rec.受注番号1} className="w1" onCommit={受注番号1を変えた} />
        </div>
        <div className="jf-line">
          <span className="lbl">届け先コード</span>
          <Combo value={rec.届け先コード} options={todokeOpts} onCommit={届け先コードを変えた}
            onFind={tokuiFind((c) => 届け先コードを変えた(String(c)))} className="w1" />
          <Combo value={rec.届け先コード1} options={todokeOpts} onCommit={(v) => patch({ 届け先コード1: numOrNull(v) })}
            onFind={tokuiFind((c) => patch({ 届け先コード1: c }))} className="w1" />
        </div>
        <div className="jf-line">
          <span className="lbl">届け先</span>
          <Field value={rec.届け先} className="w2 center big" onCommit={(v) => patch({ 届け先: v })} />
        </div>
        <div className="jf-line">
          <span className="lbl">商品コード</span>
          <Combo value={rec.商品コード} options={shohinOpts} onCommit={商品コードを変えた}
            onFind={() => setFind({ kind: "shohin", pick: (c) => 商品コードを変えた(String(c)) })} className="w1" />
          <Combo value={rec.商品コード1} options={shohinOpts} onCommit={(v) => patch({ 商品コード1: numOrNull(v) })}
            onFind={() => setFind({ kind: "shohin", pick: (c) => patch({ 商品コード1: c }) })} className="w1" />
          <input
            type="checkbox"
            className="chk"
            title="処理済み（チェックすると一覧に出なくなります）"
            checked={!!rec.chk}
            disabled={!!saved.chk && !chkUnlocked}
            onChange={(e) => chkを押した(e.target.checked)}
          />
        </div>
        <div className="jf-line">
          <span className="lbl">製品名</span>
          <Field value={rec.商品名} className="w2" readOnly={Number(rec.商品コード) !== 999} onCommit={(v) => patch({ 商品名: v })} />
        </div>
        <div className="jf-line">
          <span className="lbl">ケース</span>
          <Field value={rec.ケース} kind="num" className="w1" onCommit={ケースを変えた} />
          <Field value={rec.ケース1} kind="num" className="w1" onCommit={ケース1を変えた} />
        </div>
        <div className="jf-line">
          <span className="lbl">商品kg</span>
          <Field value={rec.商品kg} kind="num" className="w1" onCommit={(v) => kgを変えた(v, "")} />
          <Field value={rec.商品kg1} kind="num" className="w1" onCommit={(v) => kgを変えた(v, "1")} />
        </div>
        <div className="jf-line">
          <span className="lbl">入庫名義</span>
          <Combo value={rec.入庫名義ID} options={meigiOpts} onCommit={(v) => patch({ 入庫名義ID: numOrNull(v) })} className="w1" />
          <input className="w1 gray" value={meigiName} readOnly tabIndex={-1} />
        </div>
        <div className="jf-line">
          <span className="lbl">納品予定日</span>
          <Field value={rec.納品日} kind="date" className="w1" onCommit={(v) => 納品日を変えた(v, "")} />
          <Field value={rec.納品日1} kind="date" className="w1" onCommit={(v) => 納品日を変えた(v, "1")} />
        </div>
        <div className="jf-line">
          <span className="lbl">送り状No</span>
          <Field value={rec.送り状No} className="w2" onCommit={(v) => patch({ 送り状No: v === "" ? null : v })} />
        </div>
        <div className="jf-line tall">
          <span className="lbl">備考</span>
          <textarea
            className="w2"
            value={rec.備考 ?? ""}
            onChange={(e) => patch({ 備考: e.target.value === "" ? null : e.target.value })}
          />
        </div>
        <div className="jf-foot">
          <button onClick={() => move("prev")} disabled={busy} title="前の受注">
            ◀ 前
          </button>
          <button onClick={() => move("next")} disabled={busy} title="次の受注">
            次 ▶
          </button>
          <button onClick={goNew} disabled={busy || !defaults} title="新しい受注を入力">
            新規
          </button>
          <button className="save" onClick={save} disabled={busy}>
            登録
          </button>
          <span className="msg">{dirty ? "入力中（まだ保存していません）" : msg}</span>
        </div>
      </div>
      {find && (
        <FindDialog
          kind={find.kind}
          onClose={() => setFind(null)}
          onPick={(c) => {
            setFind(null);
            find.pick(c);
          }}
        />
      )}
    </div>
  );
}
