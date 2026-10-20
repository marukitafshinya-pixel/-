import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api, ApiError, num, upload } from "../api";
import { showDate } from "../formParts";

type Row = Record<string, any>;
type 結果 = { 行数: number; 成功: number; 止まった?: string };

/** SB受注取り込み（Access の F_エスビー受注インポート） */
export default function SbImport() {
  const nav = useNavigate();
  const [rows, setRows] = useState<Row[]>([]);
  const [fname, setFname] = useState("");
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const load = () => api.get<Row[]>("/api/sb/list").then(setRows);
  useEffect(() => {
    // Access と同じく、開いたときに前の読み込みを消す
    api.post("/api/sb/open").then(load);
  }, []);

  async function 取り込む(選択ID?: number) {
    setBusy(true);
    try {
      const r = await api.post<結果>("/api/sb/import", { 選択ID });
      await load();
      alert(r.止まった ? `${r.止まった}\n（それまでに ${r.成功} 件を取り込みました）` : `取り込み終了（${r.行数} 行のうち ${r.成功} 件を受注に取り込みました）`);
    } catch (e) {
      alert(e instanceof ApiError ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="hanmori sb">
      <div className="tabs">
        <span>受注管理</span>
        <span className="active">SB受注取り込み</span>
      </div>
      <div className="hm-head">
        <div className="hm-left">
          <button className="dark yellow" disabled={busy || rows.length === 0} onClick={() => 取り込む()}>
            番号認識
          </button>
        </div>
        <div className="hm-mid">
          <div className="hm-info">
            ① ファイル参照で、SB の受注（Windows アプリのテキスト CSV）を読み込みます。
            <br />② ［番号認識］を押すと、読み込んだ全部の行を受注に取り込みます。
          </div>
          <button className="hm-file" onClick={() => fileRef.current?.click()} disabled={busy}>
            ファイル参照
          </button>
          <div className="hm-fname">{fname}</div>
          <input
            ref={fileRef}
            type="file"
            accept=".csv,.txt"
            hidden
            onChange={async (e) => {
              const f = e.target.files?.[0];
              e.target.value = "";
              if (!f) return;
              setFname(f.name);
              setBusy(true);
              try {
                await upload("/api/sb/upload", f);
                await load();
              } catch (err) {
                alert(err instanceof ApiError ? err.message : String(err));
              } finally {
                setBusy(false);
              }
            }}
          />
        </div>
        <div className="hm-right">
          <button onClick={() => nav("/")}>閉じる</button>
        </div>
      </div>
      <table className="hm-grid">
        <thead>
          <tr>
            <th className="y">選択</th>
            <th>状態</th>
            <th>オーダーNo</th>
            <th>依頼書No</th>
            <th>納入先</th>
            <th>工場品目</th>
            <th>品目名称</th>
            <th>今回納期</th>
            <th>数量回答</th>
            <th>備考</th>
            <th>前回納期</th>
            <th>丸北受注ID</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.ID}>
              <td className="c">
                <input
                  type="checkbox"
                  checked={!!r.選択chk}
                  disabled={busy}
                  title="押すと、受注の取り込みを行います（Access と同じ）"
                  onChange={() => confirm("受注取り込みを行います") && 取り込む(r.ID)}
                />
              </td>
              <td className={"st" + (String(r.取込み備考 ?? "").startsWith("×") ? " ng" : "")}>{r.取込み備考}</td>
              <td className="r">{r.オーダーNo}</td>
              <td className="r">{r.依頼書No}</td>
              <td>{r.納入先}</td>
              <td>{r.工場品目}</td>
              <td>{r.品目名称}</td>
              <td>{showDate(r.今回納期)}</td>
              <td className="r">{num(r.数量回答)}</td>
              <td>{r.備考}</td>
              <td>{showDate(r.前回納期)}{r.前回依頼数 != null ? `（${num(r.前回依頼数)}）` : ""}</td>
              <td className="r">{r.丸北受注ID || ""}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {rows.length === 0 && <p className="hm-empty">ファイル参照で、SB の受注のファイルを読み込んでください。</p>}
    </div>
  );
}
