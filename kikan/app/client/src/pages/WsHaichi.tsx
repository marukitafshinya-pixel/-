import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api, ApiError, num } from "../api";

type Rec = Record<string, any>;
const エラー = (e: unknown) => alert(e instanceof ApiError ? e.message : String(e));
const 今日 = () => new Date(Date.now() + 9 * 3600 * 1000).toISOString().slice(0, 10);
const 日を足す = (v: string, k: number) => new Date(Date.parse(v + "T00:00:00Z") + k * 86400000).toISOString().slice(0, 10);

/** 枠の並び（Access のフォームの位置と同じ。上が L7、下が L1。右の列は R5〜R1 と T2・T1） */
const 行 = [7, 6, 5, 4, 3, 2, 1].map((i) => [
  `L${i}-1`, `L${i}-2`, `L${i}-3`,
  i >= 3 ? `CL-${i - 2}` : null,
  i >= 3 ? `CR-${i - 2}` : null,
  i >= 3 ? `R${i - 2}-1` : i === 2 ? "T2" : "T1",
]);

/** 印刷した日時（2026/10/23 10:02:46） */
function 印刷日時() {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}/${p(d.getMonth() + 1)}/${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
}

/**
 * パレット配置図（Access の AF_パレット配置図）。メニューの「パレット配置図」から開く。
 * 右の一覧（その日の時点の工場の在庫）から、在庫を枠へ引っぱって置く（または一覧で選んで枠を押す）。
 * 1 枠に置く数は商品マスタのパレット単位1。枠の文字はダブルクリックで直せる。
 */
export default function WsHaichi() {
  const nav = useNavigate();
  const [日, set日] = useState(今日());
  const [配置, set配置] = useState<Rec>({});
  const [在庫, set在庫] = useState<Rec[]>([]);
  const [選択, set選択] = useState<Rec | null>(null);
  const [直す枠, set直す枠] = useState<string | null>(null);
  const [下書き, set下書き] = useState("");

  async function 読む(d = 日) {
    try {
      const r = await api.get<{ 配置: Rec | null; 在庫: Rec[] }>("/api/ws/haichi", { date: d });
      set配置(r.配置 ?? {});
      set在庫(r.在庫);
      set選択(null);
    } catch (e) {
      エラー(e);
    }
  }
  useEffect(() => {
    読む(日);
  }, [日]);

  async function 置く(欄: string, z: Rec | null) {
    if (!z) return;
    try {
      const r = await api.post<{ 文字: string; 数: number }>("/api/ws/haichi/drop", {
        date: 日, 欄, 認識ID: z.認識ID, 商品コード: z.商品コード, 商品名: z.商品名, 製造日: z.製造日, タグ: z.タグ, 割付残数: z.割付残数,
      });
      set配置((x) => ({ ...x, [欄]: r.文字, [`${欄}在庫ID`]: z.認識ID }));
      // 残りを減らす（Access と同じく、日を変えるか開き直すまでのあいだ）
      set在庫((x) => x.map((y) => (y.認識ID === z.認識ID ? { ...y, 割付残数: y.割付残数 - r.数 } : y)));
      set選択(null);
    } catch (e) {
      エラー(e);
    }
  }
  async function 文字を保存() {
    const 欄 = 直す枠;
    set直す枠(null);
    if (!欄 || 下書き === (配置[欄] ?? "")) return;
    try {
      await api.post("/api/ws/haichi/save", { date: 日, 欄, 値: 下書き });
      set配置((x) => ({ ...x, [欄]: 下書き }));
    } catch (e) {
      エラー(e);
    }
  }
  async function リセット() {
    if (!confirm("この日の配置図を消し、在庫のストック数を元に戻します。よろしいですか？")) return;
    try {
      await api.post("/api/ws/haichi/reset", { date: 日 });
      set配置({});
    } catch (e) {
      エラー(e);
    }
  }
  const 一覧 = 在庫.filter((z) => z.割付残数 !== 0);

  return (
    <div className="pz">
      <div className="kn-head no-print">
        <div className="kn-title">パレット配置図</div>
        <div className="kn-box">
          <div className="lbl">日付</div>
          <div className="row">
            <button onClick={() => set日(日を足す(日, -1))} title="前の日">◀</button>
            <input type="date" value={日} onChange={(e) => e.target.value && set日(e.target.value)} />
            <button onClick={() => set日(日を足す(日, 1))} title="次の日">▶</button>
          </div>
        </div>
        <div className="kn-btns">
          <button onClick={() => window.print()}>印刷</button>
          <button onClick={リセット}>リセット</button>
          <button onClick={() => nav(-1)}>閉じる</button>
        </div>
      </div>
      <style>{"@media print { @page { size: A4 landscape; margin: 10mm; } }"}</style>
      <div className="print-only pz-phead">
        <div className="pz-pdate">{`${Number(日.slice(5, 7))}月${Number(日.slice(8, 10))}日(${"日月火水木金土"[new Date(日 + "T00:00:00").getDay()]})`}</div>
        <div className="pz-ptitle">保管庫　配置図</div>
        <div className="pz-ptime">{印刷日時()}</div>
      </div>
      <div className="pz-body">
        <table className="pz-map">
          <tbody>
            {行.map((r, i) => (
              <tr key={i}>
                {r.map((欄, j) =>
                  欄 === null ? (
                    <td key={j} className="pz-none">{i === 行.length - 1 && j === 4 ? <div className="print-only pz-door">入口</div> : null}</td>
                  ) : (
                    <td
                      key={j}
                      className={"pz-slot" + (j === 3 || j === 5 ? " pz-gap" : "") + (選択 ? " pz-target" : "")}
                      onDragOver={(e) => e.preventDefault()}
                      onDrop={(e) => {
                        e.preventDefault();
                        const id = e.dataTransfer.getData("text/plain");
                        置く(欄, 在庫.find((z) => z.認識ID === id) ?? null);
                      }}
                      onClick={() => 選択 && 置く(欄, 選択)}
                      onDoubleClick={() => {
                        set直す枠(欄);
                        set下書き(配置[欄] ?? "");
                      }}
                      title="ダブルクリックで文字を直せます"
                    >
                      <div className="pz-name">{欄}</div>
                      {直す枠 === 欄 ? (
                        <textarea autoFocus value={下書き} onChange={(e) => set下書き(e.target.value)} onBlur={文字を保存} />
                      ) : (
                        <div className="pz-text">{(配置[欄] ?? "").replace(/\r\n/g, "\n")}</div>
                      )}
                    </td>
                  ),
                )}
              </tr>
            ))}
          </tbody>
        </table>
        <div className="pz-list no-print">
          <div className="small">在庫を枠へ引っぱるか、選んでから枠を押してください。</div>
          <table className="kn-grid">
            <thead>
              <tr><th>商品名</th><th>製造日</th><th>区分</th><th>在庫</th><th>残り</th><th>積付</th><th>棚済</th></tr>
            </thead>
            <tbody>
              {一覧.length === 0 && <tr><td colSpan={7} className="c none">置ける在庫はありません</td></tr>}
              {一覧.map((z) => (
                <tr
                  key={z.認識ID}
                  draggable
                  onDragStart={(e) => e.dataTransfer.setData("text/plain", z.認識ID)}
                  onClick={() => set選択(選択?.認識ID === z.認識ID ? null : z)}
                  className={"pz-row" + (選択?.認識ID === z.認識ID ? " sel" : "") + (z.計画 ? " plan" : "")}
                >
                  <td className="name">{z.商品名}</td>
                  <td className="c">{z.製造日}</td>
                  <td className="c">{z.タグ}</td>
                  <td className="r">{num(z.在庫ケース)}</td>
                  <td className="r"><b>{num(z.割付残数)}</b></td>
                  <td className="r">{z.積み付け数 ?? ""}</td>
                  <td className="c">{z.棚済み ? "✓" : ""}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
