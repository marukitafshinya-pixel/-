import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Combo, Field, FindDialog } from "../formParts";

type Row = Record<string, any>;

/** 合言葉を付けて呼ぶ */
async function call<T = any>(pass: string, method: string, url: string, body?: unknown): Promise<T> {
  const r = await fetch(url, {
    method,
    headers: { "x-kikan-pass": encodeURIComponent(pass), ...(body ? { "Content-Type": "application/json" } : {}) },
    body: body ? JSON.stringify(body) : undefined,
    credentials: "same-origin",
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(data.error ?? "エラーが起きました");
  return data as T;
}

// コードと名前の組（コードを入れると名前が入る。Access の .Column(1)）
const 組: [string, string][] = [
  ["取引先ID", "取引先名"],
  ["受注元ID", "受注元名"],
  ["受注先ID", "受注先名"],
  ["受注帳合ID", "受注帳合先名"],
  ["指定届け先コード", "指定届け先"],
  ["指定入庫名義ID", "指定入庫後名義名"],
];
const 印: [string, string][] = [
  ["本社受注", "本社"],
  ["道内区分", "道内"],
  ["転売区分", "転売"],
  ["一般ユーザー", "一般"],
  ["仕入区分", "仕入"],
  ["伝票送付", "伝票"],
  ["デポ区分", "デポ"],
  ["使用不可", "使用不可"],
];

/** 受注グループマスタ（Access の FM_受注先マスタ登録） */
export default function JuchuMaster() {
  const nav = useNavigate();
  const [pass, setPass] = useState<string | null>(null);
  const [kubun, setKubun] = useState(1); // 1＝丸北北海道、629＝大阪丸北
  const [torihiki, setTorihiki] = useState<string>("");
  const [todoke, setTodoke] = useState<string>("");
  const [torihikiOpts, setTorihikiOpts] = useState<{ code: number; name: string }[]>([]);
  const [userKubun, setUserKubun] = useState<{ 得意先区分コード: number; 区分名: string }[]>([]);
  const [rows, setRows] = useState<Row[]>([]);
  const [find, setFind] = useState<null | ((c: number) => void)>(null);

  // Access と同じく、開くときにパスワードを聞く
  useEffect(() => {
    const p = prompt("パスワードを入力してください。");
    if (p === null) return void nav("/");
    call(p, "GET", "/api/juchu-master/unlock")
      .then(() => setPass(p))
      .catch((e) => {
        alert(e.message);
        nav("/");
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const load = async () => {
    if (!pass) return;
    const qs = new URLSearchParams({ kubun: String(kubun), torihiki, todoke });
    setRows(await call(pass, "GET", `/api/juchu-master/list?${qs}`));
  };
  useEffect(() => {
    if (!pass) return;
    call(pass, "GET", `/api/juchu-master/torihiki?kubun=${kubun}`).then((r: any[]) =>
      setTorihikiOpts(r.map((x) => ({ code: x.取引先ID, name: x.取引先名 }))),
    );
    call(pass, "GET", "/api/juchu-master/user-kubun").then(setUserKubun);
  }, [pass, kubun]);
  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pass, kubun, torihiki, todoke]);

  if (!pass) return null;

  async function save(r: Row, p: Row) {
    try {
      // 新しい行は、絞っている受注区分・取引元を初めの値にして、全部の項目を送る
      const send: Row = r.ID ? { ...p, ID: r.ID } : { ...r, ...p, ID: null, 本社受注: kubun === 629, 受注区分: kubun };
      // コードを入れたら名前も入れる（Access の .Column(1)）
      for (const [c, nm] of 組)
        if (c in send && (c in p || !r.ID))
          send[nm] = send[c] === null || send[c] === undefined ? null : (await call(pass!, "GET", `/api/juchu-master/name/${send[c]}`)).短縮名;
      // 受注先を変えたら道内区分（コードの頭が 1 なら道内）、受注区分が 1 なら仕入区分（Access と同じ）
      if ("受注先ID" in p) send.道内区分 = String(p.受注先ID ?? "").startsWith("1");
      if ("受注区分" in p) send.仕入区分 = Number(p.受注区分) === 1;
      await call(pass!, "POST", "/api/juchu-master/save", send);
      await load();
    } catch (e: any) {
      alert(e.message);
    }
  }

  const n = (v: string) => (v.trim() === "" ? null : Number(v));
  const line = (r: Row, isNew = false) => (
    <tr key={r.ID ?? "new"} className={isNew ? "new" : ""}>
      <td className="r">{r.ID ?? "（新）"}</td>
      {組.map(([c, nm]) => (
        <td key={c} className="pair">
          <Field value={r[c]} kind="num" className="code" onCommit={(v) => save(r, { [c]: n(v) })}
            onDoubleClick={() => setFind(() => (code: number) => save(r, { [c]: code }))} />
          <span>{r[nm]}</span>
        </td>
      ))}
      <td>
        <select value={r.ユーザー区分 ?? 0} onChange={(e) => save(r, { ユーザー区分: Number(e.target.value) })}>
          {userKubun.map((u) => (
            <option key={u.得意先区分コード} value={u.得意先区分コード}>
              {u.区分名}
            </option>
          ))}
        </select>
      </td>
      {印.map(([k, label]) => (
        <td key={k} className="c" title={label}>
          <input type="checkbox" checked={!!r[k]} onChange={(e) => save(r, { [k]: e.target.checked })} />
        </td>
      ))}
      <td>
        <Field value={r.取扱い区分} kind="num" className="small" onCommit={(v) => save(r, { 取扱い区分: n(v) ?? 0 })} />
      </td>
      <td>
        <Field value={r.備考} onCommit={(v) => save(r, { 備考: v })} />
      </td>
      <td>
        {!isNew && (
          <button
            className="del"
            onClick={async () => {
              if (!confirm(`ID ${r.ID}（${r.受注先名 ?? ""}）を削除しますか？`)) return;
              await call(pass!, "POST", "/api/juchu-master/delete", { ID: r.ID });
              await load();
            }}
          >
            削除
          </button>
        )}
      </td>
    </tr>
  );

  return (
    <div className="jmaster">
      <div className="tabs">
        <span>受注管理</span>
        <span className="active">FM_受注先マスタ登録</span>
        <button className="close" onClick={() => nav("/")}>
          閉じる
        </button>
      </div>
      <div className="jm-head">
        <div className="toggle2 boxed">
          <button className={kubun === 1 ? "on" : ""} onClick={() => (setKubun(1), setTorihiki(""))}>
            丸北 北海道
          </button>
          <button className={kubun === 629 ? "on" : ""} onClick={() => (setKubun(629), setTorihiki(""))}>
            大阪丸北
          </button>
        </div>
        <label>
          取引元
          <Combo value={torihiki} options={torihikiOpts} onCommit={setTorihiki} className="jm-combo" wide />
        </label>
        <label>
          届け先で探す
          <Field value={todoke} kind="num" className="jm-todoke" onCommit={setTodoke} onDoubleClick={() => setFind(() => (c: number) => setTodoke(String(c)))} />
        </label>
        <button onClick={() => (setTorihiki(""), setTodoke(""))}>条件をはずす</button>
        <span className="note">{rows.length} 件。欄を直してほかへ移ると保存されます。コードの欄はダブルクリックで名前から探せます。</span>
      </div>
      <div className="jm-wrap">
        <table className="jm-grid">
          <thead>
            <tr>
              <th>ID</th>
              <th>取引先（グループ）</th>
              <th>受注元</th>
              <th>受注先</th>
              <th>帳合先</th>
              <th>指定届け先</th>
              <th>指定入庫名義</th>
              <th>ユーザー区分</th>
              {印.map(([k, label]) => (
                <th key={k}>{label}</th>
              ))}
              <th>取扱い区分</th>
              <th>備考</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => line(r))}
            {line({ ID: null, 受注区分: kubun, 本社受注: kubun === 629, 取引先ID: torihiki ? Number(torihiki) : null }, true)}
          </tbody>
        </table>
        {todoke && rows.length === 0 && <p className="note">この届け先の受注グループはまだありません。一番下の行に入れると新しく登録できます。</p>}
      </div>
      {find && (
        <FindDialog
          kind="tokui"
          onClose={() => setFind(null)}
          onPick={(c) => {
            const f = find;
            setFind(null);
            f(c);
          }}
        />
      )}
    </div>
  );
}
