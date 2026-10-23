import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api, ApiError, num, 処理中 } from "../api";
import { Field } from "../formParts";

type Rec = Record<string, any>;
const エラー = (e: unknown) => alert(e instanceof ApiError ? e.message : String(e));
const 短い日 = (v: string | null) => (v ? `${v.slice(2, 4)}/${v.slice(5, 7)}/${v.slice(8, 10)}` : "");

/**
 * 入庫登録（ｲﾝﾎﾟｰﾄ）（Access の FM_入庫未登録一覧(ver2)。メインメニューの［インポート］のあとに開く画面）。
 * ［インポート］で WorkStation の冷蔵庫あての出荷（在庫更新済み）を入庫待ちに取り込み、選んだものを［登録］で冷蔵庫の在庫にする。
 * ケースを直すと 商品kg＝ケース×入数。入庫後名義も直せる。
 */
export function SokoNyuko() {
  const nav = useNavigate();
  const [rows, setRows] = useState<Rec[]>([]);
  const [最終読込日, set最終読込日] = useState<string | null>(null);
  const 読む = () =>
    api
      .get<{ rows: Rec[]; 最終読込日: string | null }>("/api/soko/nyuko")
      .then((r) => {
        setRows(r.rows);
        set最終読込日(r.最終読込日);
      })
      .catch(エラー);
  useEffect(() => {
    読む();
  }, []);
  async function 送る(url: string, body: Rec) {
    try {
      return await api.post<Rec>(url, body);
    } catch (e) {
      エラー(e);
    } finally {
      読む();
    }
  }
  async function 取り込む() {
    if (!confirm("WorkStation から入庫データをインポートしますが、よろしいですか？")) return;
    const r = await 処理中(() => 送る("/api/soko/nyuko/import", {}));
    if (r) alert(r.件数 ? `${r.件数} 件をインポートしました。` : "インポートするデータはありませんでした。");
  }
  async function 登録() {
    if (!rows.length) return;
    if (!confirm("入庫データ(インポート)を登録しますが宜しいですか？")) return;
    const r = await 処理中(() => 送る("/api/soko/nyuko/register", {}));
    if (r) alert(`入庫登録完了しました。（${r.件数} 件）`);
  }
  async function 消す(r: Rec) {
    if (!confirm("削除しますがよろしいですか？")) return;
    await 送る("/api/soko/nyuko/delete", { 鍵: r.鍵 });
  }
  const 全部 = rows.length > 0 && rows.every((r) => r.抽出区分);
  return (
    <div className="sz">
      <div className="kk-head">
        <div className="kk-title">入庫登録（ｲﾝﾎﾟｰﾄ）</div>
        <button className="blue" onClick={取り込む}>インポート</button>
        <span className="small">最後に読み込んだ日時：{最終読込日 ?? "―"}</span>
        <button className="navy" onClick={登録}>登録</button>
        <button onClick={() => nav(-1)}>閉じる</button>
      </div>
      <div className="sz-list">
        <table className="sz-grid">
          <thead>
            <tr>
              <th><label><input type="checkbox" checked={全部} onChange={(e) => 送る("/api/soko/nyuko/all", { 選ぶ: e.target.checked })} />選択</label></th>
              <th>出荷日</th><th>納品日</th><th>出荷元</th><th>届け先（冷蔵庫）</th><th>コード</th><th>商品名</th><th>規格</th><th>ケース</th><th>商品kg</th>
              <th>製造日</th><th>賞味期限</th><th>入庫後名義</th><th>タグ</th><th>出庫ID</th><th />
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && <tr><td colSpan={16} className="c none">未登録データ(インポート)はありません。</td></tr>}
            {rows.map((r) => (
              <tr key={r.鍵} className={r.抽出区分 ? "sel" : ""}>
                <td className="c"><input type="checkbox" checked={!!r.抽出区分} onChange={(e) => 送る("/api/soko/nyuko/save", { 鍵: r.鍵, 項目: "抽出区分", 値: e.target.checked })} /></td>
                <td>{短い日(r.出荷日)}</td>
                <td>{短い日(r.納品日)}</td>
                <td>{r.倉庫名}</td>
                <td>{r.届け先}</td>
                <td className="r">{r.商品コード}</td>
                <td className="name">{r.商品名}</td>
                <td>{r.規格}</td>
                <td><Field value={r.ケース} kind="num" className="sz-in w4" onCommit={(v) => 送る("/api/soko/nyuko/save", { 鍵: r.鍵, 項目: "ケース", 値: v })} /></td>
                <td className="r">{num(r.商品kg)}</td>
                <td>{短い日(r.製造日)}</td>
                <td>{短い日(r.賞味期限)}</td>
                <td>
                  <Field value={r.入庫後名義ID} kind="num" className="sz-in w4" kyotsu="tokui" onCommit={(v) => 送る("/api/soko/nyuko/save", { 鍵: r.鍵, 項目: "入庫後名義ID", 値: v })} />
                  <span className="small">{r.入庫後名義}</span>
                </td>
                <td className="c">{r.タグ}</td>
                <td className="r small">{r.出庫ID}</td>
                <td><button className="small" onClick={() => 消す(r)}>削除</button></td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <td colSpan={8} className="r">計</td>
              <td className="r">{num(rows.reduce((a, r) => a + Number(r.ケース ?? 0), 0))}</td>
              <td className="r">{num(rows.reduce((a, r) => a + Number(r.商品kg ?? 0), 0))}</td>
              <td colSpan={6} />
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}
