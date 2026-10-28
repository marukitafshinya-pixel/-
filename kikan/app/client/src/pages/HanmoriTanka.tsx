import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api, ApiError, num, upload } from "../api";
import { parseDate, showDate, PageClose } from "../formParts";

type Row = Record<string, any>;

/** 単価チェック（Access の F_販盛単価確認）。販盛の売上の Kg 単価を、販盛の単価マスタと見比べる */
export default function HanmoriTanka() {
  const nav = useNavigate();
  const [rows, setRows] = useState<Row[]>([]);
  const [day, setDay] = useState<string | null>(null);
  const [取得日, set取得日] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(
    "単価マスタを新しくするときは［単価マスタ読込］、売上の一覧を読み込むときは［売上ファイル読込］を押してください。\nそのあと、確かめる日を入れると単価を見比べます。",
  );
  const [prices, setPrices] = useState<{ id: number; list: { 単価: number; 期間開始日: string }[] } | null>(null);
  const masterRef = useRef<HTMLInputElement>(null);
  const uriageRef = useRef<HTMLInputElement>(null);

  const load = (d = day) => api.get<Row[]>("/api/hanmori/tanka/list", { day: d ?? undefined }).then(setRows);
  const info = () => api.get<{ 取得日: string | null }>("/api/hanmori/tanka/info").then((r) => set取得日(r.取得日));
  useEffect(() => {
    info();
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

  function 日を選ぶ(v: string) {
    const d = parseDate(v);
    if (d === undefined) return alert("日付の書き方が正しくありません。（例：10/28）");
    if (d === null) return;
    setDay(d);
    run(async () => {
      const r = await api.post<{ 件数: number; 違う: number }>("/api/hanmori/tanka/check", { day: d });
      setMsg(`納品予定日 ${showDate(d)} の売上 ${r.件数} 件を見比べ、単価が違うものが ${r.違う} 件ありました。`);
      await load(d);
    });
  }

  async function 参照を選ぶ(r: Row) {
    const list = await api.get<any[]>("/api/hanmori/tanka/prices", { nounyu: r.納入先コード, hinmoku: r.品目コード });
    setPrices({ id: r.ID, list });
  }

  return (
    <div className="hanmori tanka">
      <div className="tabs">
        <span>受注管理</span>
        <span className="active">単価チェック</span>
      </div>
      <div className="hm-head">
        <div className="hm-left">
          <button className="dark" disabled={busy} onClick={() => masterRef.current?.click()} title="販盛からダウンロードした単価マスタ（PRICE_INQUIRY）を読み込みます">
            単価マスタ読込
          </button>
          <button className="dark yellow" disabled={busy} onClick={() => uriageRef.current?.click()} title="販盛からダウンロードした売上実績一覧を読み込みます">
            売上ファイル読込
          </button>
          <div className="hm-date">
            <span>確かめる日</span>
            <input
              key={day ?? ""}
              defaultValue={showDate(day)}
              placeholder="10/28"
              onKeyDown={(e) => e.key === "Enter" && 日を選ぶ(e.currentTarget.value)}
              onBlur={(e) => e.currentTarget.value !== showDate(day) && 日を選ぶ(e.currentTarget.value)}
            />
          </div>
        </div>
        <div className="hm-mid">
          <div className="hm-info pre">{msg}</div>
          <div className="hm-fname">単価マスタの更新：{取得日 ?? "（まだありません）"}</div>
        </div>
        <div className="hm-right">
          <PageClose fallback="/juchu" />
          <button className="all" onClick={() => (setDay(null), load(null))}>
            全部の日を表示
          </button>
        </div>
      </div>
      <input
        ref={masterRef}
        type="file"
        accept=".csv,.txt"
        hidden
        onChange={(e) => {
          const f = e.target.files?.[0];
          e.target.value = "";
          if (!f) return;
          run(async () => {
            const r = await upload<{ 件数: number }>("/api/hanmori/tanka/master-upload", f);
            setMsg(`単価マスタを ${r.件数} 行読み込みました。確かめる日を入れてください。`);
            await info();
          });
        }}
      />
      <input
        ref={uriageRef}
        type="file"
        accept=".csv,.txt"
        hidden
        onChange={(e) => {
          const f = e.target.files?.[0];
          e.target.value = "";
          if (!f) return;
          run(async () => {
            const r = await upload<{ 件数: number; 結んだ: number }>("/api/hanmori/uriage/upload", f);
            setMsg(`売上を ${r.件数} 行読み込みました（受注に結びついたもの ${r.結んだ} 件）。確かめる日を入れてください。`);
            await load();
          });
        }}
      />
      <table className="hm-grid">
        <thead>
          <tr>
            <th>売上日</th>
            <th>伝票番号</th>
            <th>行</th>
            <th>受注ID</th>
            <th>納入先名</th>
            <th>品名</th>
            <th>重量(kg)</th>
            <th>単価</th>
            <th>Kg単価</th>
            <th className="y">参照Kg単価</th>
            <th>メモ</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.ID} className={r.アンマッチフラグ ? "ng" : ""}>
              <td>{showDate(r.売上日)}</td>
              <td className="r">{r.伝票番号}</td>
              <td className="r">{r.行}</td>
              <td className="r">{r.丸北受注ID}</td>
              <td>{r.納入先名}</td>
              <td>{r.品名}</td>
              <td className="r">{num(r["重量(kg)"])}</td>
              <td className="r">{num(r.単価)}</td>
              <td className="r">{r.Kg単価}</td>
              <td className="r ref" onClick={() => 参照を選ぶ(r)} title="押すと単価マスタから選べます">
                {r.参照Kg単価 ?? ""} ▾
                {prices?.id === r.ID && (
                  <div className="combo-list" onMouseLeave={() => setPrices(null)} onClick={(e) => e.stopPropagation()}>
                    {prices!.list.length === 0 && <div className="empty">（単価マスタにありません）</div>}
                    {prices!.list.map((p, i) => (
                      <div
                        key={i}
                        onClick={async () => {
                          setPrices(null);
                          await api.post("/api/hanmori/tanka/set", { ID: r.ID, 参照Kg単価: p.単価 });
                          await load();
                        }}
                      >
                        <span className="c">{p.単価}</span>
                        <span>{showDate(p.期間開始日)} から</span>
                      </div>
                    ))}
                  </div>
                )}
              </td>
              <td>{r.メモ３}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {rows.length === 0 && <p className="hm-empty">表示する売上はありません。</p>}
    </div>
  );
}
