import { useEffect, useState } from "react";
import { api, ApiError, num } from "../api";

type Rec = Record<string, any>;
const 年月日 = (v: string | null | undefined) => (v ? v.slice(0, 10).replace(/-/g, "/") : "");
const 月日 = (v: string | null | undefined) => (v ? `${Number(v.slice(5, 7))}月${v.slice(8, 10)}` : "");

/**
 * 明細の商品コードを変えたときの在庫の読み込み（Access の CC_在庫商品日付参照）
 * 1. その倉庫に在庫などがなければ、在庫を選ばずにマスタの名前などを入れる
 * 2. あれば「在庫読込選択」（在庫選択・架空・強制・キャンセル）を出す
 * 3. 在庫選択・架空なら「在庫選択」で行を選び、その在庫を明細に読み込む
 * キャンセルしたときは、商品コードを元のままにする。
 */
export function ZaikoSentaku(props: { 出庫ID: number; 商品コード: number; 倉庫ID: number; onDone: (変えた: boolean) => void }) {
  const [step, setStep] = useState<"check" | "ask" | "list">("check");
  const [商品名, set商品名] = useState("");
  const [plan, setPlan] = useState(false);
  const [rows, setRows] = useState<Rec[]>([]);

  async function 入れる(認識ID: string | null, p = plan) {
    try {
      await api.post("/api/ws/zaiko/set", { 出庫ID: props.出庫ID, 商品コード: props.商品コード, 認識ID, plan: p });
      props.onDone(true);
    } catch (e) {
      alert(e instanceof ApiError ? e.message : String(e));
      props.onDone(false);
    }
  }

  useEffect(() => {
    api.get<{ ある: boolean; 商品名: string | null }>("/api/ws/zaiko/aru", { shohin: String(props.商品コード), soko: String(props.倉庫ID ?? 0) }).then((r) => {
      set商品名(r.商品名 ?? "");
      if (r.ある) setStep("ask");
      else 入れる(null);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function 一覧(p: boolean) {
    setPlan(p);
    setRows(await api.get<Rec[]>("/api/ws/zaiko/list", { shohin: String(props.商品コード), soko: String(props.倉庫ID ?? 0), plan: p ? "1" : "" }));
    setStep("list");
  }

  // 選択（Access の FSD_架空在庫選択 cmd_選択_Click）
  function 選ぶ(r: Rec) {
    if (r.出荷止め区分 && !confirm(`出荷止め ${r.管理備考 ?? ""}　ですがよろしいですか？`)) return;
    const 製造 = r.製造日 ? `${Number(r.製造日.slice(5, 7))}月${Number(r.製造日.slice(8, 10))}日製造` : "";
    if (confirm(`【${r.倉庫名 ?? ""}】　【${r.商品名 ?? ""}】　【${製造}】\nのデータでよろしいですか？`)) 入れる(String(r.認識ID));
    else props.onDone(false);
  }

  if (step === "check") return null;
  if (step === "ask")
    return (
      <div className="modal">
        <div className="zy">
          <div className="zy-msg">{商品名}{"\n"} の在庫を表示しますか？</div>
          <div className="zy-btns">
            <button onClick={() => 一覧(false)} title="いまある在庫から選ぶ">在庫選択</button>
            <button onClick={() => 一覧(true)} title="生産計画も含めて選ぶ">架空</button>
            <button onClick={() => 入れる(null)} title="在庫を選ばずに商品だけ変える">強制</button>
            <button onClick={() => props.onDone(false)}>キャンセル</button>
          </div>
        </div>
      </div>
    );
  return (
    <div className="modal">
      <div className="kb">
        <div className="kb-head">
          <b className="kb-title">在庫選択{plan ? "（生産計画を含む）" : ""}</b>
          <span className="sp" />
          <button onClick={() => props.onDone(false)}>キャンセル</button>
        </div>
        <div className="kb-list">
          <table className="ws-grid">
            <thead>
              <tr>
                <th></th><th>製造日</th><th>賞味期限</th><th></th><th>出荷元</th><th>在庫C/S</th><th>在庫kg</th><th>入庫No</th><th>入庫日</th>
                <th>入庫元数</th><th>商品名</th><th>入庫名義</th><th>検査区分</th><th>タグ</th><th>管理備考</th><th>備考</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.認識ID} className={r.架空実物 ? "plan" : ""}>
                  <td className="c"><button className="kb-pick" onClick={() => 選ぶ(r)}>選択</button></td>
                  <td className="bold">{年月日(r.製造日)}</td>
                  <td>{年月日(r.賞味期限)}</td>
                  <td className="red">{r.賞味期限通知}</td>
                  <td>{r.倉庫名}</td>
                  <td className={"r" + (r.在庫ケース < 0 ? " red" : "")}>{num(r.在庫ケース)}</td>
                  <td className={"r" + (r.在庫kg < 0 ? " red" : "")}>{num(r.在庫kg)}</td>
                  <td>{r.入庫No}</td>
                  <td>{月日(r.入庫日)}</td>
                  <td className="r">{num(r.入庫元数)}</td>
                  <td>{r.商品名}</td>
                  <td>{r.入庫名義}</td>
                  <td>{r.検査区分}</td>
                  <td>{r.タグ}</td>
                  <td className={r.出荷止め区分 ? "red" : ""}>{r.出荷止め区分 ? "出荷止め " : ""}{r.管理備考}</td>
                  <td className="note pre">{r.備考在庫}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {rows.length === 0 && <p className="wsi-err">この倉庫の在庫はありません。</p>}
        </div>
      </div>
    </div>
  );
}
