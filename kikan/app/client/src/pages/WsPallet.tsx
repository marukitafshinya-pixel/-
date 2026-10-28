import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { api, ApiError } from "../api";
import { パレット積込印刷 } from "./Chohyo";
import { PageClose } from "../formParts";

type Rec = Record<string, any>;
const エラー = (e: unknown) => alert(e instanceof ApiError ? e.message : String(e));
const 左の枠 = [...Array(12)].map((_, i) => `txt_L${i + 1}`);
const 右の枠 = [...Array(10)].map((_, i) => `txt_R${i + 1}`);
const 規定倍率 = 1.5;
const 短い日 = (v: string | null | undefined) => (v ? `${v.slice(2, 4)}/${v.slice(5, 7)}/${v.slice(8, 10)}` : "");

/**
 * パレット輸送割付（Access の AF_パレット輸送割付）。パレット輸送の便で［積込確認書印刷］を押すと開く。
 * 右の一覧（まだ割り当てていないパレット）を選んでから、左の枠（ヨコ：100cm）か右の枠（タテ：120cm）を押すと割り当たる。
 * 枠のダブルクリックで文字を直す・消す。［印刷］で積み込み指示書と積み込み前点検表。
 */
export default function WsPallet() {
  const nav = useNavigate();
  const [sp] = useSearchParams();
  const [輸送ID, set輸送ID] = useState<number>(Number(sp.get("id")) || 0);
  const [bins, setBins] = useState<Rec[]>([]);
  const [d, setD] = useState<Rec | null>(null);
  const [選んだ, set選んだ] = useState<number | null>(null);
  const [倍率, set倍率] = useState(規定倍率);
  const [印刷, set印刷] = useState<Rec | null>(null);

  useEffect(() => {
    api.get<Rec[]>("/api/ws/pallet/bins").then(setBins, エラー);
  }, []);
  useEffect(() => {
    if (輸送ID) api.post<Rec>(`/api/ws/pallet/${輸送ID}/open`).then(setD, エラー);
  }, [輸送ID]);

  const 回 = d?.回送 ?? {};
  const 枚数 = Number(回.パレット枚数) || 20;
  const 左数 = Math.min(12, Math.trunc(枚数 / 2) + 1);
  const 右数 = Math.min(10, Math.max(0, 枚数 - 左数 + 1));

  async function 割り当て(枠: string) {
    if (!選んだ) return;
    try {
      setD(await api.post<Rec>(`/api/ws/pallet/${輸送ID}/slot`, { 枠, ID: 選んだ }));
      set選んだ(null);
    } catch (e) {
      エラー(e);
    }
  }

  async function 文字を直す(枠: string) {
    const v = prompt("枠の文字を直します（空にすると消えます）", String(回[枠] ?? "").replace(/\r\n/g, " / "));
    if (v === null) return;
    try {
      setD(await api.post<Rec>(`/api/ws/pallet/${輸送ID}/slot`, { 枠, 文字: v.replace(/ \/ /g, "\r\n") }));
    } catch (e) {
      エラー(e);
    }
  }

  async function 枚数を変える(v: number) {
    try {
      setD(await api.post<Rec>(`/api/ws/pallet/${輸送ID}/maisu`, { 枚数: v }));
    } catch (e) {
      エラー(e);
    }
  }

  async function クリア() {
    if (!confirm("割り当てを消して、パレットを分け直します。よろしいですか？")) return;
    try {
      setD(await api.post<Rec>(`/api/ws/pallet/${輸送ID}/clear`));
    } catch (e) {
      エラー(e);
    }
  }

  async function 印刷表示() {
    try {
      set印刷(await api.get<Rec>(`/api/ws/pallet/${輸送ID}/print`));
    } catch (e) {
      エラー(e);
    }
  }

  const 枠 = (k: string, i: number, 高さ: number) => (
    <div key={k} className={`pl-slot ${選んだ ? "ready" : ""}`} style={{ height: 高さ * 倍率 }} onClick={() => 割り当て(k)} onDoubleClick={() => 文字を直す(k)}>
      <span className="no">{i + 1}</span>
      <span className="txt">{回[k] ?? ""}</span>
    </div>
  );
  const 日 = String(d?.plan?.出荷計画日 ?? "").slice(0, 10);

  return (
    <div className="pl">
      <div className="tabs">
        <span>メインメニュー</span>
        <span>FM_出荷明細票</span>
        <span className="active">AF_パレット輸送割付</span>
      </div>
      <div className="pl-body">
        <div className="pl-col">{左の枠.slice(0, 左数).map((k, i) => 枠(k, i, 38))}</div>
        <div className="pl-col">{右の枠.slice(0, 右数).map((k, i) => 枠(k, i, 45.6))}</div>
        <div className="pl-right">
          <div className="pl-top">
            <button onClick={() => nav(`/ws?date=${日}&id=${輸送ID}`)} disabled={!輸送ID}>画面にジャンプ</button>
            <div className="bai">
              <div>
                <button onClick={() => set倍率(Math.round((倍率 + 0.2) * 10) / 10)}>▲</button>
                <button onClick={() => set倍率(Math.max(0.5, Math.round((倍率 - 0.2) * 10) / 10))}>▼</button>
              </div>
              <span className="v">{倍率}</span> 倍
            </div>
            <div className="lr">{String(回.左右差 ?? "").split(/\r?\n/).map((x) => <div key={x}>{x}</div>)}</div>
            <div className="btns">
              <button className="red" onClick={クリア} disabled={!輸送ID}>データクリア</button>
              <button className="blue" onClick={印刷表示} disabled={!輸送ID}>印刷</button>
              <PageClose fallback="/maruhoku" />
            </div>
          </div>
          <div className="pl-id">{輸送ID || ""}</div>
          <div className="pl-head">
            <div><div className="lbl">レコード数</div><div className="cnt">{d?.件数 ?? ""}</div></div>
            <div>
              <div className="lbl">出荷予定日</div>
              <select value={輸送ID || ""} onChange={(e) => set輸送ID(Number(e.target.value))}>
                <option value="">（運行を選ぶ）</option>
                {bins.map((b) => (
                  <option key={b.輸送ID} value={b.輸送ID}>{String(b.出荷計画日).slice(0, 10).replace(/-/g, "/")}　{b.運送会社名}　{b.届け先}</option>
                ))}
                {輸送ID && !bins.some((b) => b.輸送ID === 輸送ID) ? <option value={輸送ID}>{日.replace(/-/g, "/")}</option> : null}
              </select>
            </div>
            <div className="wide"><div className="lbl">運送会社名</div><div className="v">{d?.plan?.運送会社名 ?? ""}</div></div>
            <div>
              <div className="lbl">パレット数</div>
              <select value={枚数} onChange={(e) => 枚数を変える(Number(e.target.value))} disabled={!輸送ID}>
                {[...Array(17)].map((_, i) => <option key={i} value={i + 6}>{i + 6}</option>)}
              </select>
            </div>
          </div>
          <div className="pl-list">
            <table>
              <thead><tr><th>商品名</th><th>製造Rot</th><th>タグ</th><th>ケース</th><th>倉庫名</th></tr></thead>
              <tbody>
                {(d?.一覧 ?? []).map((r: Rec) => (
                  <tr key={r.ID} className={選んだ === r.ID ? "on" : ""} onClick={() => set選んだ(選んだ === r.ID ? null : r.ID)}>
                    <td>{r.商品名}</td><td>{短い日(r.製造日)}</td><td>{r.タグ}</td><td>{r.ケース}</td><td>{r.倉庫名}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="pl-help">一覧のパレットを押して選び、左の枠を押すと割り当たります。枠をダブルクリックすると文字を直せます。</p>
        </div>
      </div>
      {印刷 && <パレット積込印刷 p={印刷} onClose={() => set印刷(null)} />}
    </div>
  );
}
