import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api, ApiError, num, upload, 処理中 } from "../api";

type Rec = Record<string, any>;
const エラー = (e: unknown) => alert(e instanceof ApiError ? e.message : String(e));
const 年月日 = (v: string | null | undefined) => (v ? v.slice(0, 10).replace(/-/g, "/") : "");
const kg = (v: unknown) => (v === null || v === undefined ? "" : num(Math.round(Number(v) * 100) / 100));

/**
 * elixxi 入庫予定の照合（Access の F_elixxi入庫データチェック）。
 * elixxi の「入庫依頼一覧」からダウンロードしたファイル（拠点ごと）を選ぶと取り込み、WorkStation の入庫依頼書確認用に入れた受付番号と照らす。
 */
export function WebElixxi() {
  const nav = useNavigate();
  const [d, setD] = useState<Rec | null>(null);
  const 読む = () => api.get<Rec>("/api/web/elixxi/check").then(setD).catch(エラー);
  useEffect(() => {
    読む();
  }, []);
  async function 取り込む(fs: FileList | null) {
    if (!fs?.length) return;
    try {
      let 件数 = 0;
      for (let i = 0; i < fs.length; i++) {
        const r = await 処理中(() => upload<Rec>(`/api/web/elixxi/import${i > 0 ? "?追加=1" : ""}`, fs[i]));
        件数 += r.件数;
      }
      alert(`${fs.length} ファイル・${件数} 行を取り込みました。`);
      読む();
    } catch (e) {
      エラー(e);
      読む();
    }
  }
  const 状況 = d?.状況;
  return (
    <div className="sz sko">
      <div className="kk-head">
        <div className="kk-title">elixxi 入庫予定の照合</div>
        <button onClick={() => nav(-1)}>閉じる</button>
      </div>
      <div className="sko-pad">
        <b>入庫依頼一覧を取り込む</b>　elixxi の「入庫依頼一覧」で拠点ごとに検索してダウンロードしたファイルを選んでください（いくつでもまとめて選べます。前に取り込んだものは消えます）。
        <input type="file" accept=".csv" multiple onChange={(e) => { 取り込む(e.target.files); e.target.value = ""; }} />
        <div className="small">
          いま取り込んであるもの：{状況 ? `${num(状況.行数)} 行${状況.行数 ? `（入庫予定日 ${年月日(状況.最初)}〜${年月日(状況.最後)}）` : ""}` : ""}
          　自社側は、丸北北海道の名義で、届け先がニチレイ、納品日が今日以降の分を見ます（受付番号は、elixxi で入庫を登録したあとに写した番号。入れる画面は「elixxi 入庫依頼・出庫依頼」といっしょに作ります）。
        </div>
      </div>
      <div className="sko-pad"><b>elixxi にあって自社に無い受付番号</b>（{d?.elixxi不一致.length ?? 0} 件）</div>
      <div className="sko-gridwrap">
        <table className="sz-grid sko-grid">
          <thead><tr><th>受付番号</th><th>拠点名称</th><th>入庫予定日</th><th>kg計</th></tr></thead>
          <tbody>
            {!d?.elixxi不一致.length && <tr><td colSpan={4} className="c">ありません</td></tr>}
            {d?.elixxi不一致.map((r: Rec, i: number) => (
              <tr key={i} className="sel"><td>{r.受付番号}</td><td>{r.拠点名称}</td><td>{年月日(r.入庫予定日)}</td><td className="r">{kg(r.kg計)}</td></tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="sko-pad"><b>自社で受付番号を入れたのに elixxi に無いもの</b>（{d?.丸北不一致.length ?? 0} 件）</div>
      <div className="sko-gridwrap">
        <table className="sz-grid sko-grid">
          <thead><tr><th>受付番号</th><th>届け先</th><th>納品日</th><th>合計kg</th></tr></thead>
          <tbody>
            {!d?.丸北不一致.length && <tr><td colSpan={4} className="c">ありません</td></tr>}
            {d?.丸北不一致.map((r: Rec, i: number) => (
              <tr key={i} className="sel"><td>{r.入庫受付番号}</td><td className="name">{r.届け先}</td><td>{年月日(r.納品日)}</td><td className="r">{kg(r.合計kg)}</td></tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="sko-pad"><b>両方にあるもの</b>（{d?.両方.length ?? 0} 件。件数が違うものに印）</div>
      <div className="sko-gridwrap">
        <table className="sz-grid sko-grid">
          <thead><tr><th>輸送ID</th><th>受付番号</th><th>届け先</th><th>出荷計画日</th><th>納品日</th><th>自社kg</th><th>elixxi kg</th><th>自社件数</th><th>elixxi件数</th><th>件数相違</th></tr></thead>
          <tbody>
            {!d?.両方.length && <tr><td colSpan={10} className="c">ありません</td></tr>}
            {d?.両方.map((r: Rec, i: number) => (
              <tr key={i} className={r.件数相違 ? "sel" : ""}>
                <td className="r">{r.輸送ID}</td><td>{r.入庫受付番号}</td><td className="name">{r.届け先}</td><td>{年月日(r.出荷計画日)}</td><td>{年月日(r.納品日)}</td>
                <td className="r">{kg(r.合計kg)}</td><td className="r">{kg(r.kg計)}</td><td className="r">{r.出荷件数}</td><td className="r">{r.件数}</td><td className="c">{r.件数相違 ? "✓" : ""}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
