import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { api } from "../api";
import { Combo, Field, parseDate, PageClose } from "../formParts";

type Choice = { コード: string | number; 名前: string; 自社コード: number };

/**
 * 発注依頼書印刷（Access の F_発注書印刷。日本食研は F_日本食研発注書印刷）。
 * 入れた条件にすべて合う受注の発注依頼書を出す。
 */
export default function HacchuForm() {
  const nav = useNavigate();
  const moto = Number(useParams().moto);
  const 日本食研 = moto === 360;
  const [title, setTitle] = useState("");
  const [ch, setCh] = useState<{ 届け先: Choice[]; 商品: Choice[] }>({ 届け先: [], 商品: [] });
  const [shohinShown, setShohinShown] = useState(日本食研); // 日本食研以外は、届け先を選ぶと商品の選択肢が出る
  const [f, setF] = useState<Record<string, any>>({});
  const [見る, set見る] = useState<{ 商品名?: string; 届け先?: string }>({});

  useEffect(() => {
    api.get<any>(`/api/hacchu/name/${moto}`).then((r) => setTitle(r.短縮名));
    api.get<any>("/api/hacchu/choices", { moto }).then(setCh);
  }, [moto]);

  const patch = (p: Record<string, any>) => setF((o) => ({ ...o, ...p }));
  const 名前 = (list: Choice[], code: unknown) => list.find((c) => String(c.コード) === String(code))?.名前 ?? "";
  const 自社 = (list: Choice[], code: unknown) => list.find((c) => String(c.コード) === String(code))?.自社コード ?? 0;

  /** Access の C_エラートラップ と同じ確かめ */
  function 足りない(v: Record<string, any>): string[] {
    const m: string[] = [];
    if (日本食研 && !v.受注日) m.push("受注日が入力されていません。");
    if (!v.納品日) m.push("納品日が入力されていません。");
    if (!Number(v.届け先コード)) m.push("届け先コードが入力されていません。");
    if (!v.受注番号) m.push("受注番号入力されていません。");
    if (!Number(v.商品コード)) m.push("商品コードが入力されていません。");
    if (!Number(v.商品kg)) m.push("商品kgが入力されていません。");
    return m;
  }

  function 印刷(v = f) {
    const m = 足りない(v);
    if (m.length) return alert(m.join("\n"));
    // 日本食研は相手先のコードを自社のコードに読み替える（選択肢の 3 列目・2 列目）
    const params = new URLSearchParams({
      moto: String(moto),
      納品日: v.納品日,
      届け先コード: String(日本食研 ? 自社(ch.届け先, v.届け先コード) : v.届け先コード),
      受注番号: v.受注番号,
      商品コード: String(日本食研 ? 自社(ch.商品, v.商品コード) : v.商品コード),
      商品kg: String(v.商品kg),
    });
    if (日本食研) params.set("受注日", v.受注日);
    window.open(`/print/hacchu?${params}`, "_blank");
  }

  async function 日付(key: string, s: string) {
    const d = parseDate(s);
    if (d === undefined) return alert("日付の書き方が正しくありません。（例：10/28）");
    const v = { ...f, [key]: d };
    setF(v);
    if (key === "納品日") {
      // Access と同じく、納品日を入れると受注番号から商品名・届け先を出し、そのまま印刷する
      if (v.受注番号) set見る(await api.get<any>("/api/hacchu/lookup", { bango: v.受注番号 }));
      印刷(v);
    }
  }

  return (
    <div className="jform hacchu">
      <div className="tabs">
        <span>受注管理</span>
        <span>F_受注元選択</span>
        <span className="active">{日本食研 ? "F_日本食研発注書印刷" : "F_発注書印刷"}</span>
      </div>
      <div className="jf-top wide hc-top">
        <h2>{title} 発注依頼書印刷</h2>
        <div className="jf-btns">
          <button className="blue" onClick={() => 印刷()}>
            印刷
          </button>
          <PageClose fallback="/juchu" />
        </div>
      </div>
      <div className="jf-body hc-body">
        {日本食研 && (
          <div className="jf-line">
            <span className="lbl">受注日</span>
            <Field value={f.受注日} kind="date" className="w1 yellow-bg" onCommit={(v) => 日付("受注日", v)} />
          </div>
        )}
        <div className="jf-line">
          <span className="lbl">納品予定日</span>
          <Field value={f.納品日} kind="date" className="w1 yellow-bg" onCommit={(v) => 日付("納品日", v)} />
        </div>
        <div className="jf-line">
          <span className="lbl">届け先コード</span>
          <Combo
            value={f.届け先コード}
            options={ch.届け先.map((c) => ({ code: c.コード, name: c.名前 }))}
            onCommit={(v) => {
              patch({ 届け先コード: v });
              setShohinShown(true);
            }}
            kyotsu={日本食研 ? undefined : "tokui"}
            className="w1"
          />
          <input className="w2s gray" readOnly tabIndex={-1} value={名前(ch.届け先, f.届け先コード)} />
        </div>
        <div className="jf-line">
          <span className="lbl">受注番号</span>
          <Field value={f.受注番号} className="w1" onCommit={(v) => patch({ 受注番号: v })} />
        </div>
        <div className="jf-line">
          <span className="lbl">商品コード</span>
          <Combo
            value={f.商品コード}
            options={shohinShown ? ch.商品.map((c) => ({ code: c.コード, name: c.名前 })) : []}
            onCommit={(v) => patch({ 商品コード: v })}
            kyotsu={日本食研 ? undefined : "shohin"}
            className="w1"
          />
          <input className="w2s gray" readOnly tabIndex={-1} value={名前(ch.商品, f.商品コード)} />
        </div>
        <div className="jf-line gap">
          <span className="lbl">商品kg</span>
          <Field value={f.商品kg} kind="num" className="w1" onCommit={(v) => patch({ 商品kg: v })} />
        </div>
        <div className="jf-line tight">
          <span className="lbl">届け先</span>
          <input className="w2 dark" readOnly tabIndex={-1} value={見る.届け先 ?? ""} />
        </div>
        <div className="jf-line tight">
          <span className="lbl">商品コード</span>
          <input className="w1 dark" readOnly tabIndex={-1} value={f.商品コード ?? ""} />
        </div>
        <div className="jf-line tight">
          <span className="lbl">製品名</span>
          <input className="w2 dark" readOnly tabIndex={-1} value={見る.商品名 ?? ""} />
        </div>
      </div>
    </div>
  );
}
