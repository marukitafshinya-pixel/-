import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api, ApiError, upload } from "../api";
import { Field } from "../formParts";

type Row = Record<string, any>;

const 案内 = [
  "",
  "① ファイル参照：販盛からダウンロードした「受注実績一覧」のファイルを選びます",
  "①-2 番号認識：選んだファイルで、もう一度 Access の受注と結びつけます",
  "② 取り込む行に「選択」の印を付けて［受注取込み］を押すと、受注に入ります",
];

/** 販盛受注取込み（Access の F_販盛インポート） */
export default function HanmoriJuchu() {
  const nav = useNavigate();
  const [rows, setRows] = useState<Row[]>([]);
  const [only, setOnly] = useState(true); // まだ結びついていないものだけ
  const [file, setFile] = useState<File | null>(null);
  const [info, setInfo] = useState(1);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const load = (o = only) => api.get<Row[]>("/api/hanmori/juchu/list", { only: o ? "unlinked" : "" }).then(setRows);

  useEffect(() => {
    // Access と同じく、開いたときに前の読み込みを消す
    api.post("/api/hanmori/juchu/open").then(() => load());
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

  async function 読み込む(f: File, 結んでいないものだけ: boolean) {
    await run(async () => {
      await upload("/api/hanmori/juchu/upload", f);
      setOnly(結んでいないものだけ);
      await load(結んでいないものだけ);
      setInfo(3);
    });
  }

  async function setRow(r: Row, p: Row) {
    // 先に画面を変えてから保存する（押した感じがすぐ出るように）
    setRows((rs) => rs.map((x) => (x.ID === r.ID ? { ...x, ...p } : x)));
    try {
      await api.post("/api/hanmori/juchu/row", { ID: r.ID, ...p });
    } catch (e) {
      alert(e instanceof ApiError ? e.message : String(e));
    }
    await load();
  }

  async function 取込み() {
    await run(async () => {
      const r = await api.post<{ 選択: number; 成功: number }>("/api/hanmori/juchu/import");
      await load(false);
      setOnly(false);
      alert(`${r.選択} 件のうち ${r.成功} 件を受注に取り込みました。`);
    });
  }

  return (
    <div className="hanmori">
      <div className="tabs">
        <span>受注管理</span>
        <span className="active">販盛受注取込み</span>
      </div>
      <div className="hm-head">
        <div className="hm-left">
          <button className="dark" disabled title="販盛のサイトからのダウンロードは、社内のパソコンの自動入力で行います（準備中）">
            販盛受注出力
          </button>
          <button className="dark yellow" disabled={!file || busy} onClick={() => file && 読み込む(file, false)}>
            番号認識
          </button>
          <button className="light" disabled={busy} onClick={取込み}>
            受注取込み
          </button>
        </div>
        <div className="hm-mid">
          <div className="hm-info">{案内[info]}</div>
          <button className="hm-file" onClick={() => fileRef.current?.click()} disabled={busy}>
            ファイル参照
          </button>
          <div className="hm-fname">{file?.name ?? ""}</div>
          <input
            ref={fileRef}
            type="file"
            accept=".csv,.txt"
            hidden
            onChange={(e) => {
              const f = e.target.files?.[0];
              e.target.value = "";
              if (!f) return alert("ファイルの参照を取り消しました");
              setFile(f);
              読み込む(f, true);
            }}
          />
        </div>
        <div className="hm-right">
          <button onClick={() => nav("/")}>閉じる</button>
          <label className="hm-only">
            <input type="checkbox" checked={only} onChange={(e) => (setOnly(e.target.checked), load(e.target.checked))} />
            結びついていないものだけ
          </label>
        </div>
      </div>
      <table className="hm-grid">
        <thead>
          <tr>
            <th className="y">選択</th>
            <th>状態</th>
            <th>User発注番号<br /><small>Access表示</small></th>
            <th>伝票番号<br /><small>丸北受注ID</small></th>
            <th>行</th>
            <th>品名</th>
            <th>ケース</th>
            <th>重量(kg)</th>
            <th>納入先名</th>
            <th>納品日</th>
            <th className="y">読込変換<br />届け先コード</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.ID}>
              <td className="c">
                <input type="checkbox" checked={!!r.選択chk} onChange={(e) => setRow(r, { 選択chk: e.target.checked })} />
              </td>
              <td className={"st" + (String(r.取込み備考 ?? "").startsWith("×") ? " ng" : "")}>{r.取込み備考}</td>
              <td>{r.外部番号}<br /><small>{r.Access受注番号}</small></td>
              <td className="r">{r.伝票番号}<br /><small>{r.丸北受注ID || ""}</small></td>
              <td className="r">{r.行}</td>
              <td>{r.品名}</td>
              <td className="r">{r.箱数 ?? r.数量}</td>
              <td className="r">{r["重量(kg)"]}</td>
              <td>{r.納入先名}</td>
              <td>{r.納品予定日}</td>
              <td>
                <Field
                  value={r.変換丸北届け先コード || ""}
                  kind="num"
                  className="hm-code"
                  onCommit={(v) => setRow(r, { 変換丸北届け先コード: v.trim() === "" ? 0 : Number(v) })}
                  kyotsu="tokui"
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {rows.length === 0 && <p className="hm-empty">ファイル参照で、販盛の受注実績一覧を読み込んでください。</p>}
    </div>
  );
}
