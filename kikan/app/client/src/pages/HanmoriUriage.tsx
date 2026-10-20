import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api, ApiError, mdw, num, upload } from "../api";

type Row = Record<string, any>;

/** 販盛売上出力（Access の F_販盛インポート売上） */
export default function HanmoriUriage() {
  const nav = useNavigate();
  const [rows, setRows] = useState<Row[]>([]);
  const [only, setOnly] = useState(true); // 売上番号がまだのものだけ
  const [busy, setBusy] = useState(false);
  const [fname, setFname] = useState("");
  const [msg, setMsg] = useState("販盛の「売上実績一覧」のファイルを読み込むと、売上番号を受注に結びつけます");
  const fileRef = useRef<HTMLInputElement>(null);

  const load = (o = only) => api.get<Row[]>("/api/hanmori/uriage/list", { only: o ? "unlinked" : "" }).then(setRows);
  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function run(fn: () => Promise<void>) {
    setBusy(true);
    try {
      await fn();
    } catch (e) {
      alert(e instanceof ApiError ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="hanmori uriage">
      <div className="tabs">
        <span>受注管理</span>
        <span className="active">販盛売上出力</span>
      </div>
      <div className="hm-head">
        <div className="hm-left">
          <button className="dark" disabled title="販盛のサイトからのダウンロードは、社内のパソコンの自動入力で行います（準備中）">
            販盛売上出力
          </button>
          <button
            className="dark yellow"
            disabled={busy}
            onClick={() =>
              run(async () => {
                const r = await api.post<{ 結んだ: number }>("/api/hanmori/uriage/recognize");
                setMsg(`前に読み込んだ売上で ${r.結んだ} 件を結びつけました`);
                setOnly(false);
                await load(false);
              })
            }
          >
            番号認識
          </button>
          <button className="light" disabled title="販盛への売上の自動入力は、社内のパソコンで行います（準備中）">
            販盛売上自動入力
          </button>
        </div>
        <div className="hm-mid">
          <div className="hm-info">{msg}</div>
          <button className="hm-file" onClick={() => fileRef.current?.click()} disabled={busy}>
            ファイル参照
          </button>
          <div className="hm-fname">{fname}</div>
          <input
            ref={fileRef}
            type="file"
            accept=".csv,.txt"
            hidden
            onChange={(e) => {
              const f = e.target.files?.[0];
              e.target.value = "";
              if (!f) return alert("ファイルの参照を取り消しました");
              setFname(f.name);
              run(async () => {
                const r = await upload<{ 件数: number; 結んだ: number }>("/api/hanmori/uriage/upload", f);
                setMsg(`${r.件数} 行を読み込み、${r.結んだ} 件を受注に結びつけました`);
                setOnly(true);
                await load(true);
              });
            }}
          />
        </div>
        <div className="hm-right">
          <button onClick={() => nav("/")}>閉じる</button>
          <label className="hm-only">
            <input type="checkbox" checked={only} onChange={(e) => (setOnly(e.target.checked), load(e.target.checked))} />
            売上番号がまだのものだけ
          </label>
        </div>
      </div>
      <table className="hm-grid">
        <thead>
          <tr>
            <th className="y">選択</th>
            <th>販盛売上番号</th>
            <th>受注ID</th>
            <th>販盛受注No</th>
            <th>品名</th>
            <th>ケース</th>
            <th>商品kg</th>
            <th>納入先名</th>
            <th>納品日</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.受注ID}>
              <td className="c">
                <input type="checkbox" checked={!!r.出力用chk} disabled title="販盛への売上の自動入力は準備中です" />
              </td>
              <td className="r">{r.販盛売上番号}</td>
              <td className="r">{r.受注ID}</td>
              <td className="r">{r.販盛伝票番号}</td>
              <td>{r.商品名}</td>
              <td className="r">{num(r.ケース)}</td>
              <td className="r">{num(r.商品kg)}</td>
              <td>{r.届け先}</td>
              <td>{mdw(r.納品日)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {rows.length === 0 && <p className="hm-empty">7 日前からの受注で、表示するものはありません。</p>}
    </div>
  );
}
