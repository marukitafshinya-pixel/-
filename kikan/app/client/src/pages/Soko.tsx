import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api, ApiError, num, 処理中 } from "../api";
import { Field, today } from "../formParts";

type Rec = Record<string, any>;
const エラー = (e: unknown) => alert(e instanceof ApiError ? e.message : String(e));
const 短い日 = (v: string | null) => (v ? `${v.slice(2, 4)}/${v.slice(5, 7)}/${v.slice(8, 10)}` : "");

/** 倉庫管理のメニュー（Access の T_画面一覧 の分類ごと）。to のないものはまだ作っていない */
const メニュー: { 分類: string; items: { label: string; to?: string; 説明: string }[] }[] = [
  { 分類: "倉庫", items: [{ label: "倉庫別データ検索", to: "/soko/kensaku", 説明: "倉庫別にデータを参照します。" }] },
  {
    分類: "在庫・保管料",
    items: [
      { label: "倉庫商品一覧", to: "/soko/hokan", 説明: "倉庫ごとの商品別詳細データ" },
      { label: "予定在庫・パレット表示", 説明: "倉庫、商品、名義別の在庫合計" },
      { label: "在庫抽出帳票", to: "/soko/zaikochu", 説明: "在庫表を表示します。Excel に出力も出来ます。" },
      { label: "諸経費登録", to: "/soko/keihi", 説明: "資料代、手数料などの諸経費を登録します。" },
      { label: "請求書印刷", 説明: "倉庫別、名義別の各請求書を印刷します。" },
      { label: "倉庫情報印刷", 説明: "抽出した条件で倉庫の明細を印刷表示できます。" },
    ],
  },
  {
    分類: "出庫",
    items: [
      { label: "出庫入力", to: "/soko/shukko", 説明: "出庫登録画面です。" },
      { label: "出庫参照", 説明: "出庫の明細を見る画面です。" },
      { label: "出庫抽出帳票", to: "/soko/shukkachu", 説明: "抽出した条件で出庫の明細を印刷表示できます。" },
      { label: "出荷関連報告書", 説明: "出庫に関する印刷選択画面です。" },
      { label: "出庫リスト表示", 説明: "ニチレイ用　出庫リスト表示" },
    ],
  },
  { 分類: "名義変更", items: [{ label: "名義変更", to: "/soko/meihen", 説明: "名義変更・登録を行います" }, { label: "名義変更関連印刷", 説明: "名義変更に関する印刷選択画面です。" }] },
  { 分類: "確認", items: [{ label: "入庫確認", to: "/soko/nyuko-kakunin", 説明: "入庫データの確認" }, { label: "出庫確認", to: "/soko/shukko-kakunin", 説明: "出庫の確認" }] },
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
/** 起動時の確かめ（締め・日時更新・入庫待ちの知らせ）は、Access と同じく開いたとき 1 回だけ */
let 起動済み = false;

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
    if (起動済み) {
      様子().catch(エラー);
      return;
    }
    起動済み = true;
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

const 日を足す = (d: string, k: number) => new Date(Date.parse(d + "T00:00:00Z") + k * 86400000).toISOString().slice(0, 10);
function 日付の欄(props: { 日: string; set日: (d: string) => void }) {
  return (
    <>
      <button onClick={() => props.set日(日を足す(props.日, -1))}>◀</button>
      <Field kind="date" value={props.日} className="sko-date" onCommit={(v) => v && props.set日(v.replace(/\//g, "-"))} />
      <button onClick={() => props.set日(日を足す(props.日, 1))}>▶</button>
    </>
  );
}

/**
 * 入庫確認（Access の F_入庫確認・F_入庫確認FS）。入庫日ごとに冷蔵庫を選び、冷蔵庫から届いた入庫No を入れる（同じロットの出庫の入庫No も変わる）。
 * 同じ商品・賞味期限のロットに印を付けて［グループ化］すると、最初のロットにまとめ、ほかは消す（出庫は最初のロットに付け替えて「グループ化」の知らせ）。
 */
export function SokoNyukoKakunin() {
  const nav = useNavigate();
  const [日, set日] = useState(today());
  const [倉庫, set倉庫] = useState<Rec[]>([]);
  const [選んだ, set選んだ] = useState<number | null>(null);
  const [lots, setLots] = useState<Rec[]>([]);
  const [印, set印] = useState<Set<number>>(new Set());
  useEffect(() => {
    api.get<Rec[]>("/api/soko/nyuko-kakunin", { date: 日 }).then(set倉庫).catch(エラー);
    set選んだ(null);
    setLots([]);
  }, [日]);
  const ロット = (soko = 選んだ) => (soko ? api.get<Rec[]>("/api/soko/nyuko-kakunin/lots", { date: 日, soko: String(soko) }).then(setLots).catch(エラー) : Promise.resolve());
  useEffect(() => {
    set印(new Set());
    ロット();
  }, [選んだ]);
  async function グループ化() {
    if (!confirm("商品をグループ化します。よろしいですか？")) return;
    try {
      const r = await api.post<Rec>("/api/soko/nyuko-kakunin/group", { 在庫ID: [...印] });
      if (r.知らせ) alert(`変更により、出荷計画に${r.知らせ} 件の変更通知を送ります。`);
    } catch (e) {
      エラー(e);
    }
    set印(new Set());
    ロット();
  }
  const 印の数 = lots.filter((z) => 印.has(z.在庫ID)).reduce((a, z) => a + Number(z.入庫元数 ?? 0), 0);
  return (
    <div className="sz">
      <div className="kk-head">
        <div className="kk-title">入庫確認</div>
        <span>入庫日</span>
        <日付の欄 日={日} set日={set日} />
        <span className="small">{選んだ ? (印.size ? "グループ化するレコードにチェックを入れてください。" : "入庫Noを登録して下さい。") : "確認する冷蔵庫を選択して下さい。"}</span>
        <button onClick={() => nav(-1)}>閉じる</button>
      </div>
      <div className="sko-body">
        <div className="sko-bins">
          {倉庫.length === 0 && <div className="small">この入庫日の入庫はありません</div>}
          {倉庫.map((w) => (
            <button key={w.倉庫ID} className={"sko-bin" + (w.倉庫ID === 選んだ ? " on" : "")} onClick={() => set選んだ(w.倉庫ID)}>
              <div><b>{w.得意先名 ?? w.倉庫ID}</b></div>
              <div className="small">入庫 {num(w.入庫元数の合計)} ケース</div>
            </button>
          ))}
        </div>
        <div className="sko-main">
          {選んだ && (
            <>
              <table className="sz-grid">
                <thead><tr><th>選択</th><th>名義</th><th>コード</th><th>商品名</th><th>規格</th><th>製造日</th><th>賞味期限</th><th>区分</th><th>入庫元数</th><th>在庫</th><th>入庫No</th><th>不一致</th></tr></thead>
                <tbody>
                  {lots.map((z) => (
                    <tr key={z.在庫ID} className={印.has(z.在庫ID) ? "sel" : ""}>
                      <td className="c"><input type="checkbox" checked={印.has(z.在庫ID)} onChange={(e) => set印((s) => { const x = new Set(s); e.target.checked ? x.add(z.在庫ID) : x.delete(z.在庫ID); return x; })} /></td>
                      <td className="r">{z.入庫後名義ID}</td><td className="r">{z.商品コード}</td><td className="name">{z.商品名}</td><td>{z.規格}</td><td>{z.製造日}</td><td>{z.賞味期限}</td>
                      <td className="c">{z.タグ}</td><td className="r">{num(z.入庫元数)}</td><td className="r">{num(z.在庫ケース)}</td>
                      <td><Field value={z.入庫No} className="sz-in w10" onCommit={async (v) => { await api.post("/api/soko/nyuko-kakunin/no", { 在庫ID: z.在庫ID, 入庫No: v }).catch(エラー); ロット(); }} /></td>
                      <td className="small red">{z.不一致備考}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="sko-foot">
                <button className="blue" disabled={印.size < 2} onClick={グループ化}>グループ化</button>
                <span>グループ化個数計 {num(印の数)}</span>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * 出庫確認（Access の F_出庫確認・F_出庫確認FS）。出荷日ごとに冷蔵庫を選び、冷蔵庫からの出庫の報告と照らして「出庫済み」の印を付ける。
 */
export function SokoShukkoKakunin() {
  const nav = useNavigate();
  const [日, set日] = useState(today());
  const [倉庫, set倉庫] = useState<Rec[]>([]);
  const [選んだ, set選んだ] = useState<number | null>(null);
  const [rows, setRows] = useState<Rec[]>([]);
  useEffect(() => {
    api.get<Rec[]>("/api/soko/shukko-kakunin", { date: 日 }).then(set倉庫).catch(エラー);
    set選んだ(null);
    setRows([]);
  }, [日]);
  const 読む = (soko = 選んだ) => (soko ? api.get<Rec[]>("/api/soko/shukko-kakunin/rows", { date: 日, soko: String(soko) }).then(setRows).catch(エラー) : Promise.resolve());
  useEffect(() => {
    読む();
  }, [選んだ]);
  async function 印(r: Rec, on: boolean) {
    if (on && !confirm("確認よろしいですか？")) return;
    await api.post("/api/soko/shukko-kakunin/set", { 出庫ID: r.出庫ID, 出庫済み: on }).catch(エラー);
    読む();
  }
  return (
    <div className="sz">
      <div className="kk-head">
        <div className="kk-title">出庫確認</div>
        <span>出荷日</span>
        <日付の欄 日={日} set日={set日} />
        <span className="small">{選んだ ? "" : "確認する冷蔵庫を選択して下さい。"}</span>
        <button onClick={() => nav(-1)}>閉じる</button>
      </div>
      <div className="sko-body">
        <div className="sko-bins">
          {倉庫.length === 0 && <div className="small">この出荷日の出庫はありません</div>}
          {倉庫.map((w) => (
            <button key={w.倉庫ID} className={"sko-bin" + (w.倉庫ID === 選んだ ? " on" : "")} onClick={() => set選んだ(w.倉庫ID)}>
              <div><b>{w.得意先名 ?? w.倉庫ID}</b></div>
              <div className="small">{num(w.ケースの合計)} ケース・{num(w.商品kgの合計)} kg</div>
            </button>
          ))}
        </div>
        <div className="sko-main">
          {選んだ && (
            <table className="sz-grid">
              <thead><tr><th>出庫済み</th><th>入庫No</th><th>コード</th><th>商品名</th><th>規格</th><th>製造日</th><th>賞味期限</th><th>区分</th><th>ケース</th><th>kg</th><th>届け先</th><th>納品日</th><th>運送会社</th><th>登録</th></tr></thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.出庫ID} className={r.出庫済み ? "sel" : ""}>
                    <td className="c"><input type="checkbox" checked={!!r.出庫済み} onChange={(e) => 印(r, e.target.checked)} /></td>
                    <td>{r.入庫No}</td><td className="r">{r.商品コード}</td><td className="name">{r.商品名}</td><td>{r.規格}</td><td>{r.製造日}</td><td>{r.賞味期限}</td>
                    <td className="c">{r.タグ}</td><td className="r">{num(r.ケース)}</td><td className="r">{num(r.商品kg)}</td><td>{r.届け先}</td><td>{r.納品日}</td><td>{r.運送会社名}</td>
                    <td className="c">{r.chk ? "済" : ""}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
