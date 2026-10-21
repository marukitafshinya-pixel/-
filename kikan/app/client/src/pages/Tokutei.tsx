import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api, ApiError } from "../api";
import { Field } from "../formParts";

type Row = Record<string, any>;

/** 特定商品 案内表示（Access の FM_特定商品表示）。ふだんは見るだけ、［編集］で合言葉を入れると直せる */
export default function Tokutei() {
  const nav = useNavigate();
  const [rows, setRows] = useState<Row[]>([]);
  const [pass, setPass] = useState<string | null>(null); // 編集できるときの合言葉
  const load = () => api.get<Row[]>("/api/tokutei").then(setRows);
  useEffect(() => {
    load();
  }, []);

  async function 編集() {
    const p = prompt("パスワードを入力してください");
    if (p === null) return;
    try {
      await api.post("/api/tokutei/unlock", { 合言葉: p });
      setPass(p);
      alert("修正可能になりました");
    } catch (e) {
      alert(e instanceof ApiError ? e.message : String(e));
    }
  }

  async function save(r: Row, 消す = false) {
    try {
      await api.post("/api/tokutei/save", { 合言葉: pass, 行: r, 消す });
      await load();
    } catch (e) {
      alert(e instanceof ApiError ? e.message : String(e));
    }
  }

  const name = async (kind: "tokui" | "shohin", code: number | null) => {
    if (code === null) return null;
    const r = await api.get<any>(kind === "tokui" ? `/api/juchu/form/tokui/${code}` : `/api/juchu/form/shohin-info/${code}`);
    return kind === "tokui" ? r.短縮名 : r.商品名;
  };
  const n = (v: string) => (v.trim() === "" ? null : Number(v));
  const can = pass !== null;

  const line = (r: Row, isNew = false) => (
    <tr key={r.ID ?? "new"} className={isNew ? "new" : ""}>
      <td className="c1">
        {can ? (
          <Field value={r.商品コード} kind="num" onCommit={async (v) => save({ ...r, 商品コード: n(v), 商品名: await name("shohin", n(v)) })} kyotsu="shohin" />
        ) : (
          r.商品コード
        )}
      </td>
      <td>{can ? <Field value={r.商品名} onCommit={(v) => save({ ...r, 商品名: v })} /> : r.商品名}</td>
      <td className="c2">
        {can ? (
          <Field value={r.届け先コード} kind="num" onCommit={async (v) => save({ ...r, 届け先コード: n(v), 届け先: await name("tokui", n(v)) })} kyotsu="tokui" />
        ) : (
          r.届け先コード
        )}
      </td>
      <td className="gray">{can ? <Field value={r.届け先} onCommit={(v) => save({ ...r, 届け先: v })} /> : r.届け先}</td>
      <td>{can ? <Field value={r.備考} onCommit={(v) => save({ ...r, 備考: v })} /> : r.備考}</td>
      <td>
        {r.入力時間}
        {can && !isNew && (
          <button className="del" onClick={() => confirm("この行を削除しますか？") && save(r, true)}>
            削除
          </button>
        )}
      </td>
    </tr>
  );

  return (
    <div className="tokutei">
      <div className="tabs">
        <span>受注管理</span>
        <span className="active">FM_特定商品表示</span>
      </div>
      <div className="tk-head">
        <h2>特定商品 案内表示</h2>
        <button onClick={編集} disabled={can}>
          編集
        </button>
        <button onClick={() => nav("/")}>閉じる</button>
        {can && <span className="note">修正できます。欄を直してほかへ移ると保存されます。一番下の行に書くと足せます。</span>}
      </div>
      <table className="tk-grid">
        <thead>
          <tr>
            <th>コード</th>
            <th>商品名</th>
            <th>コード</th>
            <th>届け先</th>
            <th>内容</th>
            <th>入力日時</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => line(r))}
          {can && line({ ID: null }, true)}
        </tbody>
      </table>
    </div>
  );
}
