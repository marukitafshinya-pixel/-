import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { api, ApiError, num } from "../api";
import { FindDialog } from "../formParts";
import { KibouDialog } from "./WsKibou";

type Rec = Record<string, any>;
type 選んだ = { 認識ID: string; ケース: number; kg: number }[];
const pad = (n: number) => String(n).padStart(2, "0");
const 今月 = () => {
  const d = new Date();
  return `${String(d.getFullYear()).slice(2)}${pad(d.getMonth() + 1)}`;
};
const 月日 = (v: string | null | undefined) => (v ? `${v.slice(5, 7)}/${v.slice(8, 10)}` : "");
const エラー = (e: unknown) => alert(e instanceof ApiError ? e.message : String(e));

/**
 * 年間受注割振り（Access の F_受注検索_商品ベース_年月基準）。インポート処理の「年間受注読込」から開く。
 * 受注年月と商品コードを入れると、その月の届け先ごとの受注数・出荷済み・出荷予定・当月残を出す。
 * 「選択」で在庫を割り付けて、この便に出荷の行を作る。
 */
export default function WsNenkan() {
  const nav = useNavigate();
  const [sp] = useSearchParams();
  const 輸送ID = Number(sp.get("id"));
  const [plan, setPlan] = useState<Rec | null>(null);
  const [年月, set年月] = useState(今月());
  const [商品, set商品] = useState("");
  const [data, setData] = useState<Rec | null>(null);
  const [soko, setSoko] = useState<number>(0);
  const [sokoList, setSokoList] = useState<{ id: number; name: string }[]>([]);
  const [kg, setKg] = useState(false);
  const [合言葉, set合言葉] = useState<string | null>(null);
  const [探す, set探す] = useState(false);
  const [詳細, set詳細] = useState<Rec[] | null>(null);
  const [在庫画面, set在庫画面] = useState<null | { rows: Rec[]; 受注: Rec; resolve: (v: 選んだ | null) => void }>(null);
  const [足す, set足す] = useState<{ 届け先コード: string; 運賃振分区分: number } | null>(null);
  const [cur, setCur] = useState<number | null>(null);

  useEffect(() => {
    if (輸送ID) api.get<any>(`/api/ws/plan/${輸送ID}`).then((r) => setPlan(r.plan));
  }, [輸送ID]);

  async function 検索(code = 商品, ym = 年月) {
    if (!code.trim()) return;
    try {
      const d = await api.post<Rec>("/api/ws/nenkan/search", { 年月: ym, 商品コード: Number(code) });
      setData(d);
      setSokoList(await api.get<{ id: number; name: string }[]>("/api/ws/nenkan/soko", { shohin: code }));
    } catch (e) {
      setData(null);
      エラー(e);
    }
  }

  // 個数と KG の切り替え（KG は入数を掛ける）
  const 表示 = (v: number | null | undefined, 空にする = true) => {
    if (v === null || v === undefined || (空にする && v === 0)) return "";
    return num(kg ? v * (data?.入数 ?? 0) : v);
  };

  async function 編集() {
    const v = prompt("編集モードに切り替えます、よろしいですか？", "");
    if (v === null) return;
    try {
      const r = await api.post<{ ok: boolean }>("/api/ws/nenkan/unlock", { 合言葉: v });
      if (!r.ok) return alert("パスワードが違います");
      set合言葉(v);
      alert("編集可能になりました");
    } catch (e) {
      エラー(e);
    }
  }

  async function 直す(r: Rec, 項目: string, 値: string) {
    if (String(r[項目] ?? "") === 値) return;
    try {
      const res = await api.post<Rec>("/api/ws/nenkan/save", { 合言葉, 個別受注ID: r.個別受注ID, 項目, 値 });
      setData((d) => d && { ...d, rows: d.rows.map((x: Rec) => (x.個別受注ID === r.個別受注ID ? { ...x, ...res, [項目]: 値 === "" ? null : 項目 === "備考" ? 値 : Number(値) } : x)) });
    } catch (e) {
      エラー(e);
    }
  }

  async function 消す(r: Rec) {
    if (r.chk) return alert("登録済みの為削除できません");
    if (!confirm(`${r.届け先 ?? ""} の行を削除しますか？`)) return;
    try {
      await api.post("/api/ws/nenkan/delete", { 合言葉, 個別受注ID: r.個別受注ID });
      await 検索();
    } catch (e) {
      エラー(e);
    }
  }

  async function 行を足す() {
    if (!足す) return;
    try {
      await api.post("/api/ws/nenkan/add", { 合言葉, 年月, 商品コード: Number(商品), 届け先コード: Number(足す.届け先コード), 運賃振分区分: 足す.運賃振分区分 });
      set足す(null);
      await 検索();
    } catch (e) {
      エラー(e);
    }
  }

  // 選択（Access の cmd_受注選択_Click → My出庫出力）。在庫を選んで出荷の行を作り、表を出し直して閉じる
  async function 選択(r: Rec) {
    if (!輸送ID) return alert("出荷明細票から開いてください。");
    try {
      const z = await api.get<{ 受注: Rec; rows: Rec[] }>("/api/ws/nenkan/zaiko", { id: r.個別受注ID, shohin: 商品, soko });
      if (!z.rows.length) {
        if (confirm(`${r.商品名} の在庫がありません。直接出力しますか?`))
          await api.post("/api/ws/nenkan/out", { 輸送ID, 個別受注ID: r.個別受注ID, 商品コード: Number(商品), 倉庫ID: soko });
        return nav(-1);
      }
      const 重量 = z.rows.reduce((a, x) => a + (x.在庫kg ?? 0), 0);
      if (!confirm(`${r.商品名}\n合計${z.rows.length}件\n重量 ${重量 ? num(重量) : ""} kgまでを表示します`)) return nav(-1);
      const sel = await new Promise<選んだ | null>((resolve) => set在庫画面({ rows: z.rows, 受注: z.受注, resolve }));
      set在庫画面(null);
      if (sel) await api.post("/api/ws/nenkan/out", { 輸送ID, 個別受注ID: r.個別受注ID, 商品コード: Number(商品), 倉庫ID: soko, 選んだ: sel });
      nav(-1);
    } catch (e) {
      エラー(e);
    }
  }

  const rows: Rec[] = data?.rows ?? [];
  const 計 = (k: string) => rows.reduce((a, r) => a + (Number(r[k]) || 0), 0);
  const 上 = data?.上;
  const 編集中 = 合言葉 !== null;
  const 今の行 = rows.find((r) => r.個別受注ID === cur) ?? rows[0];

  return (
    <div className="nk">
      <div className="tabs">
        <span>メインメニュー</span>
        <span>FM_出荷明細票</span>
        <span>F_インポート処理</span>
        <span className="active">F_受注検索_商品ベース_年月基準</span>
      </div>
      <div className="nk-top">
        <div className="nk-left">
          <div className="nk-kind">
            <span>個別受注</span>
            <span className="on">年間受注</span>
          </div>
          <div className="nk-search">
            <div className="nk-ken">検<br />索</div>
            <label>
              <span>受注年月</span>
              <input
                value={年月}
                onChange={(e) => set年月(e.target.value)}
                onBlur={() => 検索()}
                onKeyDown={(e) => e.key === "Enter" && 検索()}
              />
            </label>
            <span className="dash">-</span>
            <label>
              <span>商品コード</span>
              <input
                className="r"
                value={商品}
                onChange={(e) => set商品(e.target.value)}
                onBlur={() => 検索()}
                onKeyDown={(e) => e.key === "Enter" && 検索()}
                onDoubleClick={() => set探す(true)}
                title="ダブルクリックで商品を探す"
              />
            </label>
            <label className="wide">
              <span>商品名</span>
              <div className="name">{data?.商品名 ?? ""}</div>
            </label>
          </div>
        </div>
        <div className="nk-title">年間受注割振り</div>
        <div className="nk-unit">
          <div className="lbl">単位切替</div>
          <div className="tg">
            <button className={kg ? "" : "on"} onClick={() => setKg(false)}>個数</button>
            <button className={kg ? "on" : ""} onClick={() => setKg(true)}>KG</button>
          </div>
        </div>
        <div className="nk-btns">
          <button onClick={編集} className={編集中 ? "on" : ""}>編集</button>
          <button onClick={() => nav(-1)}>閉じる</button>
        </div>
        <div className="nk-id">
          <div>{data ? `${年月}-${商品}` : ""}</div>
          <div>{data ? 年月 : ""}</div>
        </div>
      </div>
      <div className="nk-mid">
        <div className="nk-soko">
          <div className="lbl">出荷場所選択</div>
          <div className="row">
            <select value={soko} onChange={(e) => setSoko(Number(e.target.value))}>
              <option value={0}>0</option>
              {sokoList.map((s) => (
                <option key={s.id} value={s.id}>{s.id}</option>
              ))}
            </select>
            <span className="name">{sokoList.find((s) => s.id === soko)?.name ?? ""}</span>
          </div>
        </div>
        <button className="nk-rep" onClick={() => alert("在庫割り振り表（帳票）は、帳票づくりの段階で作ります。")}>在庫割り振り表</button>
        <table className="nk-sum">
          <thead>
            <tr><th>前月繰越</th><th>当月製造</th><th>出荷済み</th><th>出荷予定</th><th>当月残数</th></tr>
          </thead>
          <tbody>
            <tr>
              <th>当月出来高</th>
              <td>{上 ? 表示(上.当月製造数, false) : ""}</td>
              <td className="red">{上 ? 表示(上.製造出荷済み) : ""}</td>
              <td className="pink">{上 ? 表示(上.製造出荷見込み) : ""}</td>
              <td className="blue">{上 ? 表示(上.当月製造残数, false) : ""}</td>
            </tr>
            <tr>
              <th>前月繰越</th>
              <td>{上 ? 表示(上.前月在庫残, false) : ""}</td>
              <td className="red">{上 ? 表示(上.出荷済み2) : ""}</td>
              <td className="pink">{上 ? 表示(上.出荷見込2) : ""}</td>
              <td className="gray">{上 ? 表示(上.当月在庫残数, false) : ""}</td>
            </tr>
          </tbody>
        </table>
        <div className="nk-dates">
          <span>{月日(今の行?.集計開始日 ?? data?.開始)}</span>
          <span>{月日(今の行?.集計終了日 ?? data?.終了)}</span>
        </div>
      </div>
      <div className="nk-list">
        <table className="nk-grid">
          <thead>
            <tr>
              <th>コード</th><th>届け先</th><th>扱い</th><th className="gap" /><th>前月繰越</th><th>調整</th><th>受注数</th><th>出荷済み</th>
              <th>出荷予定</th><th>当月残</th><th>次月出荷</th><th>選択</th><th className="gap" /><th>備考</th><th>詳細</th>
              {編集中 && <th>削除</th>}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.個別受注ID} className={r.個別受注ID === 今の行?.個別受注ID ? "cur" : ""} onClick={() => setCur(r.個別受注ID)}>
                <td className="code">{r.届け先コード}</td>
                <td className="todoke">{r.届け先}</td>
                <td className="atsu">
                  {編集中 ? (
                    <select value={r.運賃振分区分 ?? 1} onChange={(e) => 直す(r, "運賃振分区分", e.target.value)}>
                      <option value={1}>丸北</option>
                      <option value={629}>大阪</option>
                    </select>
                  ) : r.運賃振分区分 === 629 ? "大阪" : "丸北"}
                </td>
                <td className="gap" />
                {(["年間前月繰越数", "年間調整数", "受注元数"] as const).map((k) => (
                  <td key={k} className={k === "受注元数" ? "r" : "r navy"}>
                    {編集中 && !kg ? (
                      <input className="r" defaultValue={r[k] ?? ""} onBlur={(e) => 直す(r, k, e.target.value.trim())} />
                    ) : (
                      表示(r[k])
                    )}
                  </td>
                ))}
                <td className="r red">{表示(r.受注出荷済み数)}</td>
                <td className="r pink">{表示(r.受注出荷見込み数)}</td>
                <td className="r">{表示(r.受注残数)}</td>
                <td className="r jigetsu">{表示(r.次月出荷予定数)}</td>
                <td><button className="sel" onClick={() => 選択(r)}>選択</button></td>
                <td className="gap" />
                <td className="biko">
                  {編集中 ? <input defaultValue={r.備考 ?? ""} onBlur={(e) => 直す(r, "備考", e.target.value)} /> : r.備考}
                </td>
                <td>
                  <button className="show" onClick={async () => set詳細(await api.get<Rec[]>(`/api/ws/nenkan/shosai/${r.個別受注ID}`))}>表示</button>
                </td>
                {編集中 && (
                  <td><button className="show" onClick={() => 消す(r)}>削除</button></td>
                )}
              </tr>
            ))}
            {編集中 && data && (
              <tr className="add">
                <td colSpan={16}>
                  {足す ? (
                    <>
                      届け先コード <input className="r" value={足す.届け先コード} onChange={(e) => set足す({ ...足す, 届け先コード: e.target.value })} />
                      扱い{" "}
                      <select value={足す.運賃振分区分} onChange={(e) => set足す({ ...足す, 運賃振分区分: Number(e.target.value) })}>
                        <option value={1}>丸北</option>
                        <option value={629}>大阪</option>
                      </select>
                      <button onClick={行を足す}>追加</button>
                      <button onClick={() => set足す(null)}>やめる</button>
                    </>
                  ) : (
                    <button onClick={() => set足す({ 届け先コード: "", 運賃振分区分: 1 })}>行を追加</button>
                  )}
                </td>
              </tr>
            )}
          </tbody>
        </table>
        {data && rows.length === 0 && <p className="nk-none">この月・この商品の受注はありません。</p>}
      </div>
      <div className="nk-foot">
        <span className="lbl">推移</span>
        <span className="sp" />
        <span>{表示(計("年間前月繰越数"), false)}</span>
        <span>{表示(計("年間調整数"), false)}</span>
        <span>{表示(計("受注元数"), false)}</span>
        <span className="red">{表示(計("受注出荷済み数"), false)}</span>
        <span className="pink">{表示(計("受注出荷見込み数"), false)}</span>
        <span>{表示(計("受注残数"), false)}</span>
        <span>{表示(計("次月出荷予定数"), false)}</span>
      </div>

      {探す && (
        <FindDialog
          kind="shohin"
          onClose={() => set探す(false)}
          onPick={(code) => {
            set探す(false);
            set商品(String(code));
            検索(String(code));
          }}
        />
      )}
      {詳細 && (
        <div className="modal" onClick={() => set詳細(null)}>
          <div className="nt" onClick={(e) => e.stopPropagation()}>
            <div className="nt-head">
              この月の出荷（納品日がこの月のもの）
              <button onClick={() => set詳細(null)}>閉じる</button>
            </div>
            <table className="ws-grid">
              <thead>
                <tr><th>出荷日</th><th>配車伝票No</th><th>届け先</th><th>出荷場所</th><th>製造日</th><th>ケース</th><th>商品kg</th><th>納品日</th><th>積込</th></tr>
              </thead>
              <tbody>
                {詳細.map((x) => (
                  <tr key={x.出庫ID}>
                    <td>{String(x.出荷日 ?? "").slice(0, 10)}</td>
                    <td className="r">{x.輸送ID}</td>
                    <td>{x.届け先}</td>
                    <td>{x.倉庫名}</td>
                    <td>{String(x.製造日 ?? "").slice(0, 10)}</td>
                    <td className="r">{num(x.ケース)}</td>
                    <td className="r">{num(x.商品kg)}</td>
                    <td>{String(x.納品日 ?? "").slice(0, 10)}</td>
                    <td>{x.chk ? "✔" : ""}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {詳細.length === 0 && <p className="wsi-err">この月の出荷はまだありません。</p>}
          </div>
        </div>
      )}
      {在庫画面 && (
        <KibouDialog
          data={{ rows: 在庫画面.rows, 本社依頼kg: null, 本社依頼残kg: null, 表題: "" } as any}
          輸送ID={輸送ID}
          出荷予定日={String(plan?.出荷計画日 ?? "").slice(0, 10)}
          shohin={Number(商品)}
          soko={soko}
          onClose={() => 在庫画面.resolve(null)}
          受注分={{ 品名: 在庫画面.受注.商品名, 残ケース: 在庫画面.受注.受注残数 ?? 0, onPick: (sel) => 在庫画面.resolve(sel) }}
        />
      )}
    </div>
  );
}
