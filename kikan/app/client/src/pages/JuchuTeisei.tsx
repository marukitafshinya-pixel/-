import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { api, ApiError } from "../api";
import { Combo, Field, Opt, parseDate, showDate, PageClose } from "../formParts";

type Rec = Record<string, any>;

/** 受注訂正（Access の FM_受注訂正）。左が今の受注、右に直したい値を入れて「訂正して閉じる」 */
export default function JuchuTeisei() {
  const nav = useNavigate();
  const { jid } = useParams();
  const [cur, setCur] = useState<Rec | null>(null);
  const [t, setT] = useState<Rec>({});
  const [shohinOpts, setShohinOpts] = useState<Opt[]>([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api.get<Rec>(`/api/juchu/form/record/${jid}`).then((r) => {
      setCur(r);
      // 画面を開いたときに、今の値を訂正の欄に写す（Access の Form_Open と同じ。引き取り区分は写さない）
      // 隠語は Access では写さず訂正で消えていたが、残すことにした（2026/10/20 利用者確認）
      setT({
        発注日: r.受注日, 受注元ID: r.受注元ID, 受注元名: r.受注元名, 受注先ID: r.受注先ID, 受注先名: r.受注先名,
        統一受注ID: r.統一受注ID, 受注番号: r.受注番号, 商品コード: r.商品コード, 商品名: r.商品名, 入数: r.入数,
        ケース: r.ケース, 商品kg: r.商品kg, 届け先コード: r.届け先コード, 届け先: r.届け先, 納品日: r.納品日,
        送り状No: r.送り状No, 隠語: r.隠語, 蔵前区分: null,
      });
      api.get<any[]>("/api/juchu/form/shohin", { saki: r.受注先ID }).then((rows) =>
        setShohinOpts(rows.map((x) => ({ code: x.商品コード, name: x.商品名 }))),
      );
    });
  }, [jid]);

  const patch = (p: Rec) => setT((o) => ({ ...o, ...p }));
  const n = (v: string) => (v.trim() === "" ? null : Number(v));
  const 短縮名 = async (code: number | null) =>
    code === null ? null : (await api.get<any>(`/api/juchu/form/tokui/${code}`)).短縮名;

  async function 受注元を変えた(v: string) {
    const code = n(v);
    patch({ 受注元ID: code, 受注元名: await 短縮名(code) });
  }
  async function 受注先を変えた(v: string) {
    const code = n(v);
    patch({ 受注先ID: code, 受注先名: await 短縮名(code) });
  }
  async function 届け先を変えた(v: string) {
    const code = n(v);
    patch({ 届け先コード: code, 届け先: await 短縮名(code) });
  }
  async function 商品を変えた(v: string) {
    const code = n(v);
    // Access と同じく、商品名は選んだ商品のもの。入数は今の商品のまま
    const s = code === null ? { 商品名: null } : await api.get<any>(`/api/juchu/form/shohin-info/${code}`);
    patch({ 商品コード: code, 商品名: s.商品名 });
  }
  function ケースを変えた(v: string) {
    const c = n(v);
    patch({ ケース: c, 商品kg: c === null || cur?.入数 == null ? null : c * cur.入数 });
  }
  function 日付を変えた(key: string, v: string) {
    const d = parseDate(v);
    if (d === undefined) return alert("日付の書き方が正しくありません。（例：10/28）");
    patch({ [key]: d });
  }

  async function 訂正して閉じる() {
    setBusy(true);
    try {
      const r = await api.post<{ 通知件数: number }>(`/api/juchu/form/teisei/${jid}`, t);
      alert(`${r.通知件数} 件の変更を通知しました。`);
      nav(-1);
    } catch (e) {
      alert(e instanceof ApiError ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  async function del() {
    if (!cur || !confirm("現在表示されているレコードを削除しますか？")) return;
    const pass = prompt("パスワードを入力してください。");
    if (pass === null) return;
    try {
      const r = await api.post<{ 削除: boolean; chkを外せる?: boolean }>("/api/juchu/form/delete", { 受注ID: cur.受注ID, 合言葉: pass, chk: !!cur.chk });
      if (r.chkを外せる) return alert("処理済みのチェックを外せるようにしました。受注登録の画面で外してください。");
      alert(`受注ID ${cur.受注ID} を削除しました`);
      nav("/juchu/search");
    } catch (e) {
      alert(e instanceof ApiError ? (e.status === 403 && cur.chk ? "すでに登録済みの為、削除できません。" : e.message) : String(e));
    }
  }

  if (!cur) return null;

  // [見出し, 今の値, 訂正の欄]
  const rows: [string, React.ReactNode, React.ReactNode][] = [
    ["発注日", showDate(cur.受注日), <Field value={t.発注日} kind="date" onCommit={(v) => 日付を変えた("発注日", v)} />],
    ["受注元", `${cur.受注元ID ?? ""}　${cur.受注元名 ?? ""}`,
      <div className="pair"><Field value={t.受注元ID} kind="num" className="code" onCommit={受注元を変えた} kyotsu="tokui" /><input readOnly tabIndex={-1} value={t.受注元名 ?? ""} /></div>],
    ["受注先", `${cur.受注先ID ?? ""}　${cur.受注先名 ?? ""}`,
      <div className="pair"><Field value={t.受注先ID} kind="num" className="code" onCommit={受注先を変えた} kyotsu="tokui" /><input readOnly tabIndex={-1} value={t.受注先名 ?? ""} /></div>],
    ["年間ID", cur.統一受注ID, <Field value={t.統一受注ID} onCommit={(v) => patch({ 統一受注ID: v || null })} />],
    ["受注番号", cur.受注番号, <Field value={t.受注番号} onCommit={(v) => patch({ 受注番号: v || null })} />],
    ["商品コード", `${cur.商品コード ?? ""}　${cur.商品名 ?? ""}`,
      <div className="pair"><Combo value={t.商品コード} options={shohinOpts} onCommit={商品を変えた} kyotsu="shohin" className="code2" /><Field value={t.商品名} onCommit={(v) => patch({ 商品名: v || null })} /></div>],
    ["ケース", cur.ケース, <Field value={t.ケース} kind="num" onCommit={ケースを変えた} />],
    ["商品kg", cur.商品kg, <Field value={t.商品kg} kind="num" onCommit={(v) => patch({ 商品kg: n(v) })} />],
    ["届け先", `${cur.届け先コード ?? ""}　${cur.届け先 ?? ""}`,
      <div className="pair"><Field value={t.届け先コード} kind="num" className="code" onCommit={届け先を変えた} kyotsu="tokui" /><Field value={t.届け先} onCommit={(v) => patch({ 届け先: v || null })} /></div>],
    ["納品日", showDate(cur.納品日), <Field value={t.納品日} kind="date" onCommit={(v) => 日付を変えた("納品日", v)} />],
    ["送り状No", cur.送り状No, <Field value={t.送り状No} onCommit={(v) => patch({ 送り状No: v || null })} />],
    ["隠語", cur.隠語, <Field value={t.隠語} onCommit={(v) => patch({ 隠語: v || null })} />],
    ["引き取り区分", cur.蔵前区分 ? "蔵前渡し" : "届け",
      <div className="toggle2 jf-toggle">
        <button className={t.蔵前区分 === false ? "on" : ""} onClick={() => patch({ 蔵前区分: false })}>届け</button>
        <button className={t.蔵前区分 === true ? "on" : ""} onClick={() => patch({ 蔵前区分: true })}>蔵前渡し</button>
      </div>],
  ];

  return (
    <div className="jform teisei">
      <div className="tabs">
        <span>受注管理</span>
        <span>F_受注検索</span>
        <span className="active">FM_受注訂正</span>
      </div>
      <div className="jf-top wide">
        <div className="jf-row">
          <span className="lbl">自社受注番号</span>
          <span className="jid">{cur.受注ID}</span>
          <div className="jf-btns">
            <button onClick={del} disabled={busy}>削除</button>
            <button className="blue" onClick={() => nav("/juchu/search")}>検索</button>
            <PageClose onClick={訂正して閉じる} disabled={busy} title="右の値で訂正して閉じます" />
            <button onClick={() => nav(-1)} title="訂正しないで閉じます">やめる</button>
          </div>
        </div>
      </div>
      <table className="teisei-table">
        <thead>
          <tr>
            <th></th>
            <th>今の受注</th>
            <th>訂正</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(([label, now, edit]) => (
            <tr key={label}>
              <th>{label}</th>
              <td className="now">{now}</td>
              <td>{edit}</td>
            </tr>
          ))}
          <tr>
            <th>備考</th>
            <td className="now note" colSpan={2}>{cur.備考}</td>
          </tr>
        </tbody>
      </table>
      <p className="teisei-note">
        「閉じる」を押すと、右の値で訂正し、備考の先頭に「どこを直したか」を書き足します。WorkStation・倉庫管理・転売品管理の受注の写しも直し、まだ確定していない出荷に「受注訂正」の知らせを出します。直さずに戻るときは「やめる」を押します。
      </p>
    </div>
  );
}
