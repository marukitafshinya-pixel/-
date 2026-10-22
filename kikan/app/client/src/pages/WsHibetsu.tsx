import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api, ApiError, num } from "../api";

type Rec = Record<string, any>;
const エラー = (e: unknown) => alert(e instanceof ApiError ? e.message : String(e));
const 曜 = "日月火水木金土";
const 日の表示 = (v: string | null | undefined) => {
  if (!v) return "";
  const x = new Date(v + "T00:00:00");
  return `${x.getFullYear()}年${x.getMonth() + 1}月${x.getDate()}日（${曜[x.getDay()]}）`;
};

/**
 * 日別の在庫（ws.TD_在庫日別集計 を見る）。メニューの「日別の在庫」から開く。
 * 上に倉庫ごとのその日の在庫（ケース・kg）、下に前の日から入った・減った商品だけを出す。
 */
export default function WsHibetsu() {
  const nav = useNavigate();
  const [d, setD] = useState<Rec | null>(null);
  const [倉庫, set倉庫] = useState<number | "">("");
  const [作り直し中, set作り直し中] = useState(false);
  const [推移, set推移] = useState<Rec | null>(null);
  useEffect(() => {
    if (倉庫 === "") return set推移(null);
    api.get<Rec>("/api/ws/hibetsu/suii", { soko: 倉庫 }).then(set推移, エラー);
  }, [倉庫, d?.最初]);

  async function 読む(date?: string, soko: number | "" = 倉庫) {
    try {
      setD(await api.get<Rec>("/api/ws/hibetsu", { date: date ?? d?.日付 ?? "", soko: soko === "" ? "" : soko }));
    } catch (e) {
      エラー(e);
    }
  }
  useEffect(() => {
    読む("");
  }, []);

  async function 作り直す() {
    if (!confirm("出荷の記録が残っている日から昨日までの在庫を、今の在庫と出荷・訂正の記録から計算し直して入れます。\n（在庫更新・日時更新で控えた日はそのままです）\nよろしいですか？")) return;
    set作り直し中(true);
    try {
      const r = await api.post<Rec>("/api/ws/hibetsu/rebuild", {});
      alert(r.日数 ? `${r.最初} から ${r.最後} までの ${r.日数} 日分を入れました。` : "作り直せる日がありませんでした。");
      await 読む(d?.日付 || "");
    } catch (e) {
      エラー(e);
    } finally {
      set作り直し中(false);
    }
  }

  const 倉庫一覧: Rec[] = d?.倉庫一覧 ?? [];
  const 動き: Rec[] = d?.動き ?? [];
  const 合計 = 倉庫一覧.reduce((a, r) => ({ ケース: a.ケース + r.ケース, kg: a.kg + r.kg }), { ケース: 0, kg: 0 });
  const 作り直しの日 = 倉庫一覧.some((r) => r.更新時間 === "作り直し");

  return (
    <div className="hb">
      <div className="hb-top">
        <h2>日別の在庫</h2>
        <button disabled={!d?.前の日} onClick={() => 読む(d?.前の日)}>◀ 前の日</button>
        <input type="date" value={d?.日付 ?? ""} min={d?.最初 ?? undefined} max={d?.最後 ?? undefined} onChange={(e) => e.target.value && 読む(e.target.value)} />
        <button disabled={!d?.次の日} onClick={() => 読む(d?.次の日)}>次の日 ▶</button>
        <span className="day">{日の表示(d?.日付)}</span>
        <button className="right" onClick={作り直す} disabled={作り直し中}>{作り直し中 ? "計算中…" : "過去の日を作り直す"}</button>
        <button onClick={() => nav(-1)}>閉じる</button>
      </div>
      <div className="hb-note">
        {d?.最初 ? `控えのある日：${d.最初} 〜 ${d.最後}` : "まだ控えがありません。在庫更新の［日時更新］か［登録］を押すと、その日の在庫が控えられます。"}
        {作り直しの日 && "（この日は出荷・訂正の記録から計算し直したものです）"}
      </div>
      <h3>倉庫ごとの在庫</h3>
      <table className="ws-grid hb-soko">
        <thead><tr><th>倉庫</th><th>名前</th><th>ケース</th><th>kg</th><th>パレット（概算）</th><th>入る量</th><th>空き</th><th>埋まり具合</th><th>パレット単位のない商品</th></tr></thead>
        <tbody>
          {倉庫一覧.map((r) => (
            <tr key={r.倉庫ID} className={倉庫 === r.倉庫ID ? "cur" : ""} onClick={() => { const v = 倉庫 === r.倉庫ID ? "" : r.倉庫ID; set倉庫(v); 読む(d?.日付, v); }}>
              <td className="r">{r.倉庫ID}</td><td>{r.倉庫名}</td><td className="r">{num(r.ケース)}</td><td className="r">{num(Math.round(r.kg))}</td>
              <td className="r">{num(r.パレット)} 枚</td><td className="r">{r.許容数 ? `${num(r.許容数)} 枚` : ""}</td>
              <td className={r.空き != null && r.空き < 0 ? "r akiover" : "r"}>{r.空き != null ? (r.空き < 0 ? `${num(-r.空き)} 枚 オーバー` : `${num(r.空き)} 枚`) : ""}</td>
              <td className="ritsu">{r.使用率 != null && <div className="bar"><div className={r.使用率 >= 90 ? "fill over" : "fill"} style={{ width: `${Math.min(100, r.使用率)}%` }} /><span>{r.使用率}%</span></div>}</td>
              <td className="r">{r.単位なし ? `${num(r.単位なし)} ケース` : ""}</td>
            </tr>
          ))}
          {倉庫一覧.length > 0 && (
            <tr className="sum"><td /><td>合計</td><td className="r">{num(合計.ケース)}</td><td className="r">{num(Math.round(合計.kg))}</td><td colSpan={5} /></tr>
          )}
        </tbody>
      </table>
      {推移 && <推移グラフ s={推移} 日付={d?.日付} onPick={(day) => 読む(day)} />}
      <div className="hb-note">パレット数は、商品マスタの「パレット単位1」で割って切り上げた概算です（Access と同じ）。入る量は得意先マスタの「パレット積載許容数」です。</div>
      <h3>
        入った・減った商品{d?.前の日 ? `（${d.前の日} と比べて）` : ""}
        {倉庫 !== "" && <span className="filter">倉庫 {倉庫} だけ <button onClick={() => { set倉庫(""); 読む(d?.日付, ""); }}>全部の倉庫</button></span>}
      </h3>
      <table className="ws-grid hb-ugoki">
        <thead><tr><th>倉庫</th><th>コード</th><th>商品名</th><th>規格</th><th>前の日</th><th>入った</th><th>減った</th><th>この日</th><th>kg</th></tr></thead>
        <tbody>
          {動き.length === 0 && <tr><td colSpan={9} className="c">入った・減った商品はありません</td></tr>}
          {動き.map((r) => (
            <tr key={`${r.倉庫ID}-${r.商品コード}`}>
              <td>{r.倉庫名}</td><td className="r">{r.商品コード}</td><td>{r.商品名}</td><td>{r.規格}</td>
              <td className="r">{num(r.前)}</td><td className="r plus">{r.入った ? `+${num(r.入った)}` : ""}</td><td className="r minus">{r.減った ? `−${num(r.減った)}` : ""}</td>
              <td className="r">{num(r.ケース)}</td><td className="r">{num(Math.round(r.kg))}</td>
              <td className="r">{num(r.パレット)} 枚</td><td className="r">{r.許容数 ? `${num(r.許容数)} 枚` : ""}</td>
              <td className={r.空き != null && r.空き < 0 ? "r akiover" : "r"}>{r.空き != null ? (r.空き < 0 ? `${num(-r.空き)} 枚 オーバー` : `${num(r.空き)} 枚`) : ""}</td>
              <td className="ritsu">{r.使用率 != null && <div className="bar"><div className={r.使用率 >= 90 ? "fill over" : "fill"} style={{ width: `${Math.min(100, r.使用率)}%` }} /><span>{r.使用率}%</span></div>}</td>
              <td className="r">{r.単位なし ? `${num(r.単位なし)} ケース` : ""}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** 1 つの倉庫の埋まり具合（％）の移り変わり。100％ の線を引き、点にマウスを当てると数を出す。点を押すとその日へ */
function 推移グラフ(props: { s: Rec; 日付?: string; onPick: (day: string) => void }) {
  const 列: Rec[] = props.s.日ごと ?? [];
  const [ホバー, setホバー] = useState<number | null>(null);
  const 許容 = props.s.許容数 as number | null;
  const 値 = (r: Rec) => (許容 ? r.使用率 : r.パレット) as number;
  if (!列.length) return <div className="hb-note">{props.s.倉庫名}：控えがありません。</div>;
  const W = 900, H = 220, L = 48, R = 12, T = 12, B = 28;
  const 最大 = Math.max(許容 ? 110 : 10, ...列.map(値));
  const 刻み = [10, 20, 25, 50, 100, 200, 250, 500, 1000, 2000, 5000].find((k) => 最大 / k <= 5) ?? 10000;
  const 上 = Math.ceil(最大 / 刻み) * 刻み;
  const x = (i: number) => L + (列.length === 1 ? 0 : (i * (W - L - R)) / (列.length - 1));
  const y = (v: number) => T + (H - T - B) * (1 - v / 上);
  const 線 = 列.map((r, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(値(r)).toFixed(1)}`).join(" ");
  const 目盛り = Array.from({ length: 上 / 刻み + 1 }, (_, k) => k * 刻み);
  const 月の頭 = 列.map((r, i) => [r, i] as const).filter(([r, i]) => i === 0 || r.日付.slice(8, 10) === "01");
  const 今 = 列.findIndex((r) => r.日付 === props.日付);
  const h = ホバー ?? (今 >= 0 ? 今 : null);
  return (
    <div className="hb-chart">
      <h3>{props.s.倉庫名} の{許容 ? `埋まり具合（入る量 ${num(許容)} 枚に対するパレット数の割合）` : "パレット数（入る量の登録なし）"}</h3>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        onMouseMove={(e) => {
          const b = (e.currentTarget as SVGSVGElement).getBoundingClientRect();
          const px = ((e.clientX - b.left) / b.width) * W;
          const i = Math.round(((px - L) / (W - L - R)) * (列.length - 1));
          setホバー(Math.max(0, Math.min(列.length - 1, i)));
        }}
        onMouseLeave={() => setホバー(null)}
        onClick={() => ホバー != null && props.onPick(列[ホバー].日付)}
      >
        {目盛り.map((v) => (
          <g key={v}>
            <line x1={L} x2={W - R} y1={y(v)} y2={y(v)} className="grid" />
            <text x={L - 6} y={y(v) + 4} className="tick" textAnchor="end">{許容 ? `${v}%` : v}</text>
          </g>
        ))}
        {月の頭.map(([r, i]) => (
          <text key={r.日付} x={x(i)} y={H - 8} className="tick" textAnchor="middle">{i === 0 || r.日付.slice(5, 7) === "01" ? `${r.日付.slice(2, 4)}年${Number(r.日付.slice(5, 7))}月` : `${Number(r.日付.slice(5, 7))}月`}</text>
        ))}
        {許容 && <line x1={L} x2={W - R} y1={y(100)} y2={y(100)} className="limit" />}
        {許容 && <text x={W - R} y={y(100) - 4} className="tick" textAnchor="end">入る量（100%）</text>}
        <path d={線} className="line" />
        {h != null && (
          <g>
            <line x1={x(h)} x2={x(h)} y1={T} y2={H - B} className="cross" />
            <circle cx={x(h)} cy={y(値(列[h]))} r={5} className="dot" />
          </g>
        )}
      </svg>
      {h != null && (
        <div className="hb-tip">
          {列[h].日付}：{num(列[h].パレット)} 枚{許容 ? `（${列[h].使用率}%）` : ""}・{num(列[h].ケース)} ケース
          {ホバー != null && <span className="hint">　押すとこの日を開きます</span>}
        </div>
      )}
    </div>
  );
}
