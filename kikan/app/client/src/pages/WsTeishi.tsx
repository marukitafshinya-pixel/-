import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api, ApiError, num } from "../api";
import { FurikaeDialog } from "./WsZaikoHyo";

type Rec = Record<string, any>;
const エラー = (e: unknown) => alert(e instanceof ApiError ? e.message : String(e));
const 今日 = () => new Date(Date.now() + 9 * 3600 * 1000).toISOString().slice(0, 10);
const 日を足す = (v: string, k: number) => new Date(Date.parse(v + "T00:00:00Z") + k * 86400000).toISOString().slice(0, 10);
const 日の表示 = (v: string) => `${v.slice(0, 4)}/${v.slice(5, 7)}/${v.slice(8, 10)}`;
const 短い日 = (v: string | null) => (v ? `${v.slice(2, 4)}/${v.slice(5, 7)}/${v.slice(8, 10)}` : "");

/**
 * 出荷停止在庫一覧（Access の FM_保管庫_出荷停止）。メニューの「出荷停止在庫」から開く。
 * 確認日ごとに、出荷停止の在庫を出す。［確認］に印を付ける。［振替］で在庫振替（保管庫詳細と同じ画面）。
 */
export default function WsTeishi() {
  const nav = useNavigate();
  const [日, set日] = useState(今日());
  const [rows, setRows] = useState<Rec[]>([]);
  const [振替, set振替] = useState<number | null>(null);

  async function 読む(d = 日) {
    try {
      const r = await api.get<Rec>("/api/ws/teishi", { date: d });
      setRows(r.rows);
    } catch (e) {
      エラー(e);
    }
  }
  useEffect(() => {
    読む(日);
  }, [日]);

  async function 確認(r: Rec, 値: boolean) {
    try {
      await api.post("/api/ws/teishi/chk", { 在庫ID: r.在庫ID, 日付: 日, 値 });
      setRows((x) => x.map((y) => (y.在庫ID === r.在庫ID ? { ...y, chk: 値 } : y)));
    } catch (e) {
      エラー(e);
    }
  }

  const ケース計 = rows.reduce((a, r) => a + Number(r.在庫ケース ?? 0), 0);
  const kg計 = rows.reduce((a, r) => a + Number(r.在庫kg ?? 0), 0);

  return (
    <div className="ts">
      <div className="ts-head">
        <div className="ts-day">
          <div className="row">
            <span className="lbl">確認日</span>
            <button onClick={() => set日(日を足す(日, -1))} title="前の日">◀</button>
            <button onClick={() => set日(日を足す(日, 1))} title="次の日">▶</button>
          </div>
          <input type="date" value={日} onChange={(e) => e.target.value && set日(e.target.value)} />
        </div>
        <div className="ts-title">出荷停止在庫一覧</div>
        <div className="ts-btns">
          <button onClick={() => nav(-1)}>閉じる</button>
        </div>
      </div>
      <table className="ts-grid">
        <thead>
          <tr><th>振替</th><th>商品名</th><th>規格</th><th>製造日</th><th>区分</th><th>元数</th><th>在庫数/kg</th><th>確認</th><th>出荷止め</th></tr>
        </thead>
        <tbody>
          {rows.length === 0 && <tr><td colSpan={9} className="c none">この日の出荷停止の在庫はありません</td></tr>}
          {rows.map((r) => (
            <tr key={r.在庫ID}>
              <td className="c"><button className="hk-furi" onClick={() => set振替(r.在庫ID)} title="在庫振替（在庫訂正）">振<br />替</button></td>
              <td className="name">
                <div>{r.商品名}</div>
                {r.賞味期限通知 && <div className="kigen">{r.賞味期限通知}</div>}
              </td>
              <td className="c b">{r.規格}</td>
              <td className="c seizo">{短い日(r.製造日)}</td>
              <td className="c">{r.タグ}</td>
              <td className="r moto">{num(r.入庫元数)}</td>
              <td className="r zaiko"><div className="cs">{num(r.在庫ケース)}</div><div className="kg">{num(r.在庫kg)}</div></td>
              <td className="c"><input type="checkbox" checked={!!r.chk} onChange={(e) => 確認(r, e.target.checked)} /></td>
              <td className="biko">{r.管理備考}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="ts-foot">
        <span className="lbl">ケース計</span><span className="v">{num(ケース計)}</span>
        <span className="lbl">Kg計</span><span className="v">{num(Math.round(kg計 * 10) / 10)}</span>
        <span className="day">（{日の表示(日)} の確認）</span>
      </div>
      {振替 != null && (
        <FurikaeDialog
          在庫ID={振替}
          onClose={(変えた) => {
            set振替(null);
            if (変えた) 読む();
          }}
        />
      )}
    </div>
  );
}
