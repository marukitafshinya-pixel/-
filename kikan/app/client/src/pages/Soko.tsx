import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api, ApiError, num, 処理中 } from "../api";
import { Field } from "../formParts";

type Rec = Record<string, any>;
const エラー = (e: unknown) => alert(e instanceof ApiError ? e.message : String(e));
const 短い日 = (v: string | null) => (v ? `${v.slice(2, 4)}/${v.slice(5, 7)}/${v.slice(8, 10)}` : "");

/** 倉庫管理のメニュー（Access の T_画面一覧 の分類ごと）。to のないものはまだ作っていない */
const メニュー: { 分類: string; items: { label: string; to?: string; 説明: string }[] }[] = [
  { 分類: "倉庫", items: [{ label: "倉庫別データ検索", 説明: "倉庫別にデータを参照します。" }] },
  {
    分類: "在庫・保管料",
    items: [
      { label: "倉庫商品一覧", 説明: "倉庫ごとの商品別詳細データ" },
      { label: "予定在庫・パレット表示", 説明: "倉庫、商品、名義別の在庫合計" },
      { label: "在庫抽出帳票", to: "/soko/zaikochu", 説明: "在庫表を表示します。Excel に出力も出来ます。" },
      { label: "諸経費登録", 説明: "資料代、手数料などの諸経費を登録します。" },
      { label: "請求書印刷", 説明: "倉庫別、名義別の各請求書を印刷します。" },
      { label: "倉庫情報印刷", 説明: "抽出した条件で倉庫の明細を印刷表示できます。" },
    ],
  },
  {
    分類: "出庫",
    items: [
      { label: "出庫入力", 説明: "出庫登録画面です。" },
      { label: "出庫参照", 説明: "出庫の明細を見る画面です。" },
      { label: "出庫抽出帳票", to: "/soko/shukkachu", 説明: "抽出した条件で出庫の明細を印刷表示できます。" },
      { label: "出荷関連報告書", 説明: "出庫に関する印刷選択画面です。" },
      { label: "出庫リスト表示", 説明: "ニチレイ用　出庫リスト表示" },
    ],
  },
  { 分類: "名義変更", items: [{ label: "名義変更", 説明: "名義変更・登録を行います" }, { label: "名義変更関連印刷", 説明: "名義変更に関する印刷選択画面です。" }] },
  { 分類: "確認", items: [{ label: "入庫確認", 説明: "入庫データの確認" }, { label: "出庫確認", 説明: "出庫の確認" }] },
  {
    分類: "入庫",
    items: [
      { label: "入庫登録(出庫時)", to: "/soko/idou", 説明: "入庫未登録(出庫時)のデータを登録します。" },
      { label: "入庫登録(ｲﾝﾎﾟｰﾄ)", to: "/soko/nyuko", 説明: "WorkStation からインポートして、入庫未登録のデータを登録します。" },
      { label: "入庫訂正データ", 説明: "入庫データと一致しないデータを検出します。" },
      { label: "重複データ(在庫)", 説明: "在庫データの重複（インポートの重複）を検出します。" },
    ],
  },
  { 分類: "マスタ", items: [{ label: "倉庫賃率・入庫設定", 説明: "倉庫への入庫条件を設定します。" }] },
];
const 月日 = (d: string) => `${d.slice(5, 7)}月${d.slice(8, 10)}日`;

/**
 * 倉庫管理のメニュー（Access の FM_メインメニュー）。開いたとき、Access の起動時と同じく
 * 2 日以上締めていなければ「昨日まで更新しますか？」と聞いて前日締めをし、日付が変わって最初なら日時更新（繰越など）をする。
 * 入庫待ちがあれば知らせる。
 */
export function SokoMenu() {
  const nav = useNavigate();
  const [st, setSt] = useState<Rec | null>(null);
  const [情報, set情報] = useState("");
  const 様子 = () => api.get<Rec>("/api/soko/status").then(setSt);
  useEffect(() => {
    (async () => {
      let s = await api.get<Rec>("/api/soko/status");
      if (s.締めていない日数 >= 2) {
        const 昨日 = new Date(Date.parse(s.今日) - 86400000).toISOString().slice(0, 10);
        if (confirm(`${s.締めていない日数}日間の更新がされていません${月日(昨日)}まで更新を行いますか？`)) {
          await 処理中(() => api.post("/api/soko/shime", {}));
        } else alert("手動で更新を行ってください。");
      }
      s = await api.get<Rec>("/api/soko/status");
      if (s.日時更新がまだ) await 処理中(() => api.post("/api/soko/nichiji", {}));
      s = await api.get<Rec>("/api/soko/status");
      setSt(s);
      if (s.入庫待ち && confirm(`入庫未登録データ(インポート)が ${s.入庫待ち} 件あります。入庫登録の画面を開きますか？`)) nav("/soko/nyuko");
    })().catch(エラー);
  }, []);
  async function 締める() {
    if (!st) return;
    const 昨日 = new Date(Date.parse(st.今日) - 86400000).toISOString().slice(0, 10);
    if (!confirm(`${月日(昨日)}まで更新を行いますか？`)) return;
    try {
      const r = await 処理中(() => api.post<Rec>("/api/soko/shime", {}));
      alert(`${r.件数} 件の出庫を登録しました。`);
    } catch (e) {
      エラー(e);
    }
    様子();
  }
  return (
    <div className="menu">
      <header>
        <h1>倉庫管理System</h1>
        <span className="who">
          {st && <>前回の締め：{st.前回更新日?.replace(/-/g, "/") ?? "―"}（{st.更新時間 ?? ""}）</>}
          <button onClick={締める}>昨日まで締める</button>
          <button onClick={() => nav("/")}>閉じる</button>
        </span>
      </header>
      {メニュー.map((sec) => (
        <section key={sec.分類}>
          <h2 className="menu-sec">{sec.分類}</h2>
          <div className="menu-grid">
            {sec.items.map((i) => (
              <button key={i.label} disabled={!i.to} onClick={() => i.to && nav(i.to)} onMouseEnter={() => set情報(i.to ? i.説明 : `${i.説明}（準備中）`)}>
                {i.label}
              </button>
            ))}
          </div>
        </section>
      ))}
      <div className="soko-info">{情報}</div>
    </div>
  );
}

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

/**
 * 入庫登録(出庫時)（Access の FM_入庫未登録一覧）。冷蔵庫から冷蔵庫へ移した出庫（締めのときに入庫フラグが付いたもの）を、選んで［登録］で届け先の冷蔵庫の在庫にする。
 * Access はこの画面で行を消すと出庫そのものが消えるので、Web 版では消せないようにした。
 */
export function SokoIdou() {
  const nav = useNavigate();
  const [rows, setRows] = useState<Rec[]>([]);
  const 読む = () => api.get<Rec[]>("/api/soko/idou").then(setRows).catch(エラー);
  useEffect(() => {
    読む();
  }, []);
  async function 選ぶ(r: Rec, v: boolean) {
    await api.post("/api/soko/idou/select", { 出庫ID: r.出庫ID, 選ぶ: v }).catch(エラー);
    読む();
  }
  async function 登録() {
    if (!confirm("入庫データ(出庫)を登録しますが宜しいですか？")) return;
    try {
      const r = await 処理中(() => api.post<Rec>("/api/soko/idou/register", {}));
      alert(`入庫登録完了しました。（${r.件数} 件）`);
    } catch (e) {
      エラー(e);
    }
    読む();
  }
  return (
    <div className="sz">
      <div className="kk-head">
        <div className="kk-title">入庫登録(出庫時)</div>
        <button className="navy" onClick={登録}>登録</button>
        <button onClick={() => nav(-1)}>閉じる</button>
      </div>
      <table className="sz-grid">
        <thead>
          <tr><th>選択</th><th>出荷日</th><th>納品日</th><th>出庫元（冷蔵庫）</th><th>入庫先（冷蔵庫）</th><th>運送会社</th><th>コード</th><th>商品名</th><th>規格</th><th>ケース</th><th>商品kg</th><th>製造日</th><th>賞味期限</th><th>入庫後名義</th></tr>
        </thead>
        <tbody>
          {rows.length === 0 && <tr><td colSpan={14} className="c none">未登録データ(出庫)はありません。</td></tr>}
          {rows.map((r) => (
            <tr key={r.出庫ID} className={r.抽出区分 ? "sel" : ""}>
              <td className="c"><input type="checkbox" checked={!!r.抽出区分} onChange={(e) => 選ぶ(r, e.target.checked)} /></td>
              <td>{短い日(r.出荷日)}</td>
              <td>{短い日(r.納品日)}</td>
              <td>{r.倉庫名}</td>
              <td>{r.届け先}</td>
              <td>{r.運送会社名}</td>
              <td className="r">{r.商品コード}</td>
              <td className="name">{r.商品名}</td>
              <td>{r.規格}</td>
              <td className="r">{num(r.ケース)}</td>
              <td className="r">{num(r.商品kg)}</td>
              <td>{短い日(r.製造日)}</td>
              <td>{短い日(r.賞味期限)}</td>
              <td>{r.入庫後名義}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
