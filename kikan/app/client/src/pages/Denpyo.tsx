import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api";
import { Combo, Field, parseDate } from "../formParts";

type 届け先 = { 電話番号: string | null; 得意先名: string | null; 短縮コード: number | null };
type 商品 = { 相手先商品コード: string; 商品コード: number; 相手先商品名: string };

/** 伝票発行（Access の F_伝票発行）。和弘食品専用伝票を出す */
export default function Denpyo() {
  const nav = useNavigate();
  const [todokes, setTodokes] = useState<届け先[]>([]);
  const [shohins, setShohins] = useState<商品[]>([]);
  const [f, setF] = useState<Record<string, any>>({});
  const [見る, set見る] = useState<{ 商品名?: string; 届け先?: string; 商品kg?: number }>({});

  useEffect(() => {
    api.get<any>("/api/denpyo/choices").then((r) => {
      setTodokes(r.届け先);
      setShohins(r.商品);
    });
  }, []);

  const patch = (p: Record<string, any>) => setF((o) => ({ ...o, ...p }));
  // 選んだ届け先の短縮コード（Access の 届け先コード.Column(2)）・商品の自社コード（商品コード.Column(1)）
  const 届け先短縮 = (v = f) => todokes.find((t) => String(t.電話番号) === String(v.届け先))?.短縮コード ?? 0;
  const 商品自社 = (v = f) => shohins.find((s) => String(s.相手先商品コード) === String(v.商品))?.商品コード ?? 0;

  function 日付(key: string, s: string) {
    const d = parseDate(s);
    if (d === undefined) return alert("日付の書き方が正しくありません。（例：10/28）");
    patch({ [key]: d });
  }

  async function 届け先を選ぶ(v: string) {
    const next = { ...f, 届け先: v };
    setF(next);
    const r = await api.get<any>("/api/denpyo/choices", { todoke: 届け先短縮(next) });
    setShohins(r.商品);
  }

  async function 受注番号を入れた(v: string) {
    const next = { ...f, 受注番号: v };
    setF(next);
    set見る(await api.get<any>("/api/denpyo/lookup", { shohin: 商品自社(next), todoke: 届け先短縮(next), bango: v }));
  }

  /** Access の C_エラートラップ と同じ確かめ */
  function 印刷() {
    const m: string[] = [];
    if (!f.受注日) m.push("受注日が入力されていません。");
    if (!f.納品日) m.push("納品日が入力されていません。");
    if (!f.届け先) m.push("届け先電話番号が入力されていません。");
    if (!f.受注番号) m.push("受注番号入力されていません。");
    if (!f.商品) m.push("商品コードが入力されていません。");
    if (!Number(f.ケース)) m.push("ケース数が入力されていません。");
    if (m.length) return alert(m.join("\n"));
    const params = new URLSearchParams({
      受注日: f.受注日, 納品日: f.納品日, 受注先ID: String(届け先短縮()), 受注番号: f.受注番号,
      商品コード: String(商品自社()), ケース: String(f.ケース),
    });
    window.open(`/print/denpyo?${params}`, "_blank");
  }

  return (
    <div className="jform hacchu">
      <div className="tabs">
        <span>受注管理</span>
        <span className="active">F_伝票発行</span>
      </div>
      <div className="jf-top wide hc-top">
        <h2>和弘食品 伝票発行</h2>
        <div className="jf-btns">
          <button className="blue" onClick={印刷}>
            印刷
          </button>
          <button onClick={() => nav("/")}>閉じる</button>
        </div>
      </div>
      <div className="jf-body hc-body">
        <div className="jf-line">
          <span className="lbl">受注日</span>
          <Field value={f.受注日} kind="date" className="w1 yellow-bg" onCommit={(v) => 日付("受注日", v)} />
        </div>
        <div className="jf-line">
          <span className="lbl">納品日</span>
          <Field value={f.納品日} kind="date" className="w1 yellow-bg" onCommit={(v) => 日付("納品日", v)} />
        </div>
        <div className="jf-line">
          <span className="lbl">届け先電話番号</span>
          <Combo
            value={f.届け先}
            options={todokes.map((t) => ({ code: t.電話番号 ?? "", name: `${t.得意先名 ?? ""}（${t.短縮コード ?? ""}）` }))}
            onCommit={届け先を選ぶ}
            className="w1"
          />
          <input className="w2s gray" readOnly tabIndex={-1} value={todokes.find((t) => String(t.電話番号) === String(f.届け先))?.得意先名 ?? ""} />
        </div>
        <div className="jf-line">
          <span className="lbl">商品コード</span>
          <Combo
            value={f.商品}
            options={shohins.map((s) => ({ code: s.相手先商品コード, name: `${s.相手先商品名}（${s.商品コード}）` }))}
            onCommit={(v) => patch({ 商品: v })}
            className="w1"
          />
          <input className="w2s gray" readOnly tabIndex={-1} value={shohins.find((s) => String(s.相手先商品コード) === String(f.商品))?.相手先商品名 ?? ""} />
        </div>
        <div className="jf-line">
          <span className="lbl">受注番号</span>
          <Field value={f.受注番号} className="w1" onCommit={受注番号を入れた} />
        </div>
        <div className="jf-line gap">
          <span className="lbl">ケース</span>
          <Field value={f.ケース} kind="num" className="w1" onCommit={(v) => patch({ ケース: v })} />
        </div>
        <div className="jf-line tight">
          <span className="lbl">届け先</span>
          <input className="w2 dark" readOnly tabIndex={-1} value={見る.届け先 ?? ""} />
        </div>
        <div className="jf-line tight">
          <span className="lbl">製品名</span>
          <input className="w2 dark" readOnly tabIndex={-1} value={見る.商品名 ?? ""} />
        </div>
        <div className="jf-line tight">
          <span className="lbl">商品kg</span>
          <input className="w1 dark" readOnly tabIndex={-1} value={見る.商品kg ?? ""} />
        </div>
      </div>
    </div>
  );
}
