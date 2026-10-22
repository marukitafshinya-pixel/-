import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api, ApiError } from "../api";
import { Field, FindDialog } from "../formParts";

type Rec = Record<string, any>;
type Opt = { id: number; name: string };
const エラー = (e: unknown) => alert(e instanceof ApiError ? e.message : String(e));

type 列 = { k: string; 見出し: string; 数?: boolean; 探す?: "tokui" | "shohin"; 読むだけ?: boolean; 幅?: number };
type 設定 = {
  kind: "aite" | "todoke" | "pallet";
  題: string;
  絞り: string;
  列: 列[];
  合言葉: boolean;
  絞りの探し方: "find" | "select";
};

const 設定一覧: Record<string, 設定> = {
  aite: {
    kind: "aite", 題: "相手先商品マスタ", 絞り: "相手先", 合言葉: false, 絞りの探し方: "find",
    列: [
      { k: "得意先短縮コード", 見出し: "相手ｺｰﾄﾞ", 数: true, 探す: "tokui", 幅: 60 },
      { k: "得意先名", 見出し: "相手先", 読むだけ: true },
      { k: "相手先商品コード", 見出し: "相手先ｺｰﾄﾞ", 幅: 110 },
      { k: "相手先商品名", 見出し: "相手先商品名", 幅: 220 },
      { k: "商品コード", 見出し: "元コード", 数: true, 探す: "shohin", 幅: 60 },
      { k: "商品名", 見出し: "元商品名", 読むだけ: true },
    ],
  },
  todoke: {
    kind: "todoke", 題: "相手先届け先コードマスタ", 絞り: "相手先", 合言葉: false, 絞りの探し方: "select",
    列: [
      { k: "相手方届け先コード", 見出し: "相手方の届け先コード", 幅: 110 },
      { k: "自社コード", 見出し: "自社コード", 数: true, 探す: "tokui", 幅: 60 },
      { k: "届け先", 見出し: "届け先", 幅: 200 },
      { k: "相手先コード", 見出し: "相手先コード", 数: true, 幅: 60 },
      { k: "相手先名", 見出し: "相手先名", 幅: 120 },
    ],
  },
  pallet: {
    kind: "pallet", 題: "集荷先パレット設定", 絞り: "集荷先", 合言葉: true, 絞りの探し方: "select",
    列: [
      { k: "商品コード", 見出し: "商品コード", 数: true, 探す: "shohin", 幅: 60 },
      { k: "商品名", 見出し: "商品名", 読むだけ: true },
      { k: "パレット単位", 見出し: "パレット単位", 数: true, 幅: 60 },
      { k: "特定パレット単位", 見出し: "特定パレット単位", 数: true, 幅: 60 },
      { k: "段数", 見出し: "段数", 数: true, 幅: 50 },
      { k: "備考", 見出し: "備考", 幅: 200 },
    ],
  },
};

/**
 * WorkStation の小さなマスタ（相手先商品マスタ・相手先届け先コードマスタ・集荷先パレット設定）。
 * 上で相手先（集荷先）を選ぶとその行だけを出す。コードの欄はダブルクリックで探せる。
 */
export default function WsMaster(props: { kind: keyof typeof 設定一覧 }) {
  const s = 設定一覧[props.kind];
  const nav = useNavigate();
  const [絞る, set絞る] = useState<number | null>(null);
  const [rows, setRows] = useState<Rec[]>([]);
  const [選択肢, set選択肢] = useState<Opt[]>([]);
  const [探す, set探す] = useState(false);
  const [合言葉, set合言葉] = useState<string | null>(null);
  const ro = s.合言葉 && 合言葉 === null;

  async function 読む(code = 絞る) {
    try {
      const r = await api.get<{ rows: Rec[]; 選択肢: Opt[] }>(`/api/ws/mst/${s.kind}`, code ? { code: String(code) } : {});
      setRows(r.rows);
      set選択肢(r.選択肢);
      // 集荷先は、はじめは一番小さい集荷先を出す（Access と同じ）
      if (s.kind === "pallet" && code === null && r.選択肢.length) set絞る(r.選択肢[0].id);
    } catch (e) {
      エラー(e);
    }
  }
  useEffect(() => {
    読む(絞る);
  }, [絞る]);

  async function 修正() {
    if (合言葉 !== null) return;
    const p = prompt("パスワードを入力してください");
    if (p === null) return;
    const r = await api.post<{ ok: boolean }>("/api/ws/mst/unlock", { 合言葉: p }).catch((e) => (エラー(e), null));
    if (!r) return;
    if (r.ok) {
      set合言葉(p);
      alert("修正可能になりました");
    } else alert("パスワードが違います!!");
  }
  async function 直す(r: Rec, 項目: string, 値: unknown) {
    try {
      const res = await api.post<Rec>(`/api/ws/mst/${s.kind}/save`, { 鍵: r._鍵, 項目, 値, 合言葉 });
      setRows((x) => x.map((y) => (y._鍵 === r._鍵 ? { ...y, ...res } : y)));
    } catch (e) {
      エラー(e);
    }
  }
  async function 足す() {
    try {
      await api.post(`/api/ws/mst/${s.kind}/new`, { code: 絞る, 合言葉 });
      await 読む();
    } catch (e) {
      エラー(e);
    }
  }
  async function 消す(r: Rec) {
    if (!confirm("この行を消します。よろしいですか？")) return;
    try {
      await api.post(`/api/ws/mst/${s.kind}/delete`, { 鍵: r._鍵, 合言葉 });
      setRows((x) => x.filter((y) => y._鍵 !== r._鍵));
    } catch (e) {
      エラー(e);
    }
  }
  const i = 選択肢.findIndex((o) => o.id === 絞る);
  const 名前 = s.絞りの探し方 === "select" ? 選択肢[i]?.name ?? "" : rows.find((r) => r.得意先短縮コード === 絞る)?.得意先名 ?? "";

  return (
    <div className="kn">
      <div className="kn-head">
        <div className="kn-title">{s.題}</div>
        <div className="kn-box">
          <div className="lbl">{s.絞り}</div>
          <div className="row">
            {s.絞りの探し方 === "find" ? (
              <>
                <button onClick={() => set探す(true)}>{s.絞り}選択</button>
                <span>{絞る ? `${絞る} ${名前}` : "（すべて）"}</span>
                {絞る !== null && <button onClick={() => set絞る(null)}>すべて出す</button>}
              </>
            ) : (
              <>
                {s.kind === "pallet" && <button onClick={() => i > 0 && set絞る(選択肢[i - 1].id)} title="前の集荷先">◀</button>}
                <select value={絞る ?? ""} onChange={(e) => set絞る(e.target.value === "" ? null : Number(e.target.value))}>
                  {s.kind !== "pallet" && <option value="">（すべて）</option>}
                  {選択肢.map((o) => <option key={o.id} value={o.id}>{o.id} {o.name}</option>)}
                </select>
                {s.kind === "pallet" && <button onClick={() => i < 選択肢.length - 1 && set絞る(選択肢[i + 1].id)} title="次の集荷先">▶</button>}
                {s.kind === "pallet" && <button onClick={() => set探す(true)} title="得意先から探す">探す</button>}
              </>
            )}
          </div>
        </div>
        <div className="kn-btns">
          {s.合言葉 && <button onClick={修正} className={ro ? "" : "on"}>{ro ? "修正" : "修正中"}</button>}
          <button onClick={足す} disabled={ro || (s.kind === "pallet" && !絞る)}>新しい行</button>
          <button onClick={() => 読む()}>出し直す</button>
          <button onClick={() => nav(-1)}>閉じる</button>
        </div>
      </div>
      <div className="kn-list">
        <table className="kn-grid">
          <thead>
            <tr>{s.列.map((c) => <th key={c.k}>{c.見出し}</th>)}<th /></tr>
          </thead>
          <tbody>
            {rows.length === 0 && <tr><td colSpan={s.列.length + 1} className="c none">行がありません</td></tr>}
            {rows.map((r) => (
              <tr key={r._鍵}>
                {s.列.map((c) =>
                  c.読むだけ ? (
                    <td key={c.k} className="name">{r[c.k]}</td>
                  ) : (
                    <td key={c.k} style={{ width: c.幅 ?? 100 }}>
                      <Field
                        value={r[c.k]}
                        kind={c.数 ? "num" : "text"}
                        readOnly={ro}
                        kyotsu={c.探す}
                        onCommit={(v) => 直す(r, c.k, v.trim() === "" ? null : c.数 ? Number(v) : v)}
                        className="ms-cell"
                      />
                    </td>
                  ),
                )}
                <td><button disabled={ro} onClick={() => 消す(r)} title="この行を消す">消す</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="kn-foot">{rows.length} 件　コードの欄はダブルクリックで探せます。</div>
      {探す && (
        <FindDialog
          kind="tokui"
          onClose={() => set探す(false)}
          onPick={(c) => {
            set探す(false);
            set絞る(c);
          }}
        />
      )}
    </div>
  );
}
