// 丸北WorkStation の帳票（入庫依頼書・出荷通知書・送品案内書）の印刷画面。
// いただいた見本（Access で印刷したもの）と同じ並びにする。［印刷］でブラウザの印刷（A4 縦）。
type Rec = Record<string, any>;
const 曜 = "日月火水木金土";
const d = (v: string | null | undefined) => (v ? new Date(v.slice(0, 10) + "T00:00:00") : null);
const 年月日曜日 = (v: string | null) => {
  const x = d(v);
  return x ? `${x.getFullYear()}年${x.getMonth() + 1}月${x.getDate()}日${曜[x.getDay()]}曜日` : "";
};
const 年月日括弧 = (v: string | null) => {
  const x = d(v);
  return x ? `${x.getFullYear()}年${x.getMonth() + 1}月${x.getDate()}日(${曜[x.getDay()]})` : "";
};
const 短い年月日 = (v: string | null) => (v ? `${v.slice(2, 4)}年${v.slice(5, 7)}月${v.slice(8, 10)}日` : "");
const 期限 = (v: string | null) => (v ? `${v.slice(2, 4)}/${v.slice(5, 7)}/${v.slice(8, 10)}` : "");
const 数 = (v: number | null | undefined) => (v === null || v === undefined ? "" : String(Math.round(v * 100) / 100));
const 送品の数 = (v: number) => v.toLocaleString("ja-JP");

/** 入庫依頼書・出荷通知書（R_入庫依頼書_冷蔵庫・R_出荷通知書） */
function 入庫依頼書(props: { p: Rec; 枚: number; 全: number }) {
  const p = props.p;
  const 差 = p.差出人 ?? {};
  const 表題 = String(p.表題).split("\n");
  return (
    <div className="pv-page ny">
      <div className="ny-top">
        <span>{p.印刷日時}</span>
        {p.入庫票 && <span>No. {p.No}</span>}
      </div>
      <div className="ny-head">
        <div className="ny-title">
          {表題.map((t) => (
            <div key={t} className={表題.length > 1 ? "small" : ""}>{[...t].join("　")}</div>
          ))}
        </div>
        <div className="ny-from">
          <div className="sha">{差.社名}</div>
          {差.店舗 && <div className="ten">{差.店舗}</div>}
        </div>
      </div>
      <div className="ny-to">
        <div>
          <div className="atesaki">{p.宛先}</div>
          {p.担当者 && <div className="tanto">{p.担当者}</div>}
          <div className="msg">下記の通り、当工場より製品を出庫いたしました。</div>
        </div>
        <div className="addr">
          <div>{差.住所}</div>
          {差.TEL && <div>TEL：{差.TEL}</div>}
          {差.FAX && <div>FAX：{差.FAX}</div>}
        </div>
      </div>
      <div className="ny-box">
        <table>
          <tbody>
            <tr>
              <th>入庫日</th>
              <td className="big" colSpan={p.車両を出す ? 1 : 1}>{年月日曜日(p.納品日)}</td>
              <th>発送日</th>
              <td colSpan={3}>{年月日括弧(p.出荷日)}</td>
            </tr>
            <tr>
              <th>運送会社</th>
              <td className="big">{p.運送会社名}{p.車番 ? `  車番  ${p.車番}` : "  車番"}</td>
              <th>{p.車両を出す ? "車両" : ""}</th>
              <td>{p.車両を出す ? p.車両 : ""}</td>
              <th>区分</th>
              <td>{p.区分}</td>
            </tr>
          </tbody>
        </table>
        {p.記入者 && (
          <div className="kinyu">
            <span>記入者</span>
          </div>
        )}
      </div>
      {p.管理願い && <div className="ny-negai">{p.管理願い}</div>}
      <table className="ny-grid">
        <colgroup>
          <col style={{ width: "13%" }} /><col style={{ width: "30%" }} /><col style={{ width: "5%" }} /><col style={{ width: "7%" }} />
          <col style={{ width: "5%" }} /><col style={{ width: "8%" }} /><col style={{ width: "10%" }} /><col style={{ width: "11%" }} />
          <col style={{ width: "5%" }} /><col style={{ width: "5%" }} />
        </colgroup>
        <thead>
          <tr>
            <th>商品コード</th><th>製品名</th><th>区分</th><th>規格</th><th>入数</th><th>ケース</th><th>kg</th><th>賞味期限</th>
            <th className="faint">コード</th><th>連絡</th>
          </tr>
        </thead>
        <tbody>
          {p.行.map((r: Rec, i: number) => [
            <tr key={`a${i}`} className="lot">
              <td className="c">{r.商品コード}</td>
              <td className={String(r.商品名 ?? "").length > 25 ? "name small" : "name"}>{r.商品名}{r.積込順 ? `（${r.積込順}）` : ""}</td>
              <td className="c">{r.区分}</td>
              <td className="kikaku">{r.規格}</td>
              <td className="c">{r.入数}</td>
              <td className="r">{数(r.ケース)}</td>
              <td className="r">{数(r.kg)}</td>
              <td className="c">{期限(r.賞味期限)}</td>
              <td className="c">{r.コード}</td>
              <td className="c">{r.連絡}</td>
            </tr>,
            <tr key={`b${i}`} className="lotkei">
              <td /><td />
              <td colSpan={3} className="r lbl">{p.入庫票 ? "ﾛｯﾄ計" : ""}</td>
              <td className="r">{p.入庫票 ? 数(r.ケース) : ""}</td>
              <td className="r">{p.入庫票 ? 数(r.kg) : ""}</td>
              <td /><td /><td />
            </tr>,
          ])}
          <tr className="gap"><td colSpan={10} /></tr>
          <tr className="total">
            <td />
            <td colSpan={4} className="c">合 計 入 庫 数 量</td>
            <td colSpan={2} className="c">{数(p.計.ケース)} C/S</td>
            <td colSpan={3} className="c">{数(p.計.kg)}Kg</td>
          </tr>
        </tbody>
      </table>
      <div className="ny-meigi">{p.名義表示}</div>
      {p.名義情報.map((t: string) => (
        <div key={t} className="ny-info">{t}</div>
      ))}
      {p.お知らせ.map((t: string) => (
        <div key={t} className="ny-info pre">{t}</div>
      ))}
      {p.備考欄 && <div className="ny-info">{p.備考欄}</div>}
      <div className="pv-foot">{props.枚} / {props.全}</div>
    </div>
  );
}

/** 送品案内書・送品受領書（R_送品案内書_冷蔵庫／ユーザー／無地） */
function 送品案内書(props: { p: Rec }) {
  const p = props.p;
  const 差 = p.差出人;
  // 同じ商品の続きでは、相手先の商品コードの行を出さない
  let 前の商品: unknown = null;
  return (
    <div className="pv-page sh">
      <div className="sh-head">
        <div className="sh-title">{[...String(p.表題).replace("（控）", "")].join(" ")}{String(p.表題).includes("（控）") ? "（控）" : ""}</div>
        <div className="sh-time">{p.印刷日時}</div>
      </div>
      <div className="sh-to">
        <div>
          <div className="atesaki">{p.宛先}</div>
          {p.担当者 && <div className="tanto">{p.担当者}</div>}
          {p.名義分 && <div className="meigi">{p.名義分}</div>}
        </div>
        {差 && (
          <div className="from">
            <div className="sha">{差.社名}</div>
            {差.店舗 && <div className="addr">{差.店舗}</div>}
            <div className="addr">{差.住所}</div>
            {差.TEL && <div className="addr">TEL  {差.TEL}</div>}
            {差.FAX && <div className="addr">FAX  {差.FAX}</div>}
          </div>
        )}
      </div>
      <table className="sh-box">
        <tbody>
          <tr>
            <th>運送会社</th><td className="wide">{p.運送会社名}  {p.車番}</td>
            <th>出荷日</th><td>{短い年月日(p.出荷日)}</td>
            <th>納品日</th><td>{短い年月日(p.納品日)}</td>
          </tr>
        </tbody>
      </table>
      <div className="sh-msg">下記の通り、発送致しました。</div>
      <table className="sh-grid">
        <colgroup>
          <col style={{ width: "34%" }} /><col style={{ width: "12%" }} /><col style={{ width: "7%" }} /><col style={{ width: "9%" }} />
          <col style={{ width: "10%" }} /><col style={{ width: "14%" }} /><col style={{ width: "14%" }} />
        </colgroup>
        <thead>
          <tr><th>品名</th><th>規格</th><th>C/S</th><th>Kg</th><th>賞味期限</th><th>発注No</th><th>備考</th></tr>
        </thead>
        <tbody>
          {p.行.map((r: Rec, i: number) => {
            const 見出し = r.本社コード && r.商品コード !== 前の商品;
            const 続き = r.商品コード === 前の商品;
            前の商品 = r.商品コード;
            return [
              !続き && <tr key={`s${i}`} className="sp"><td colSpan={7}>{見出し ? <div className="honsha">{r.本社コード}</div> : null}</td></tr>,
              <tr key={`a${i}`} className="lot">
                <td>{r.商品名}</td><td>{r.規格}</td><td className="r">{送品の数(r.ケース)}</td><td className="r">{送品の数(r.kg)}</td>
                <td>{期限(r.賞味期限)}</td><td className="hachu">{r.発注No}</td><td className="biko">{r.特記}</td>
              </tr>,
              <tr key={`b${i}`} className="kei">
                <td /><td className="r lbl">商品計</td><td className="r">{送品の数(r.ケース)}</td><td className="r">{送品の数(r.kg)}</td><td /><td /><td />
              </tr>,
            ];
          })}
          <tr className="kei total">
            <td /><td className="r lbl">総合計</td><td className="r">{送品の数(p.計.ケース)}</td><td className="r">{p.計.kg}</td><td /><td /><td />
          </tr>
        </tbody>
      </table>
      {p.連絡事項 && <div className="sh-renraku">{p.連絡事項}</div>}
    </div>
  );
}

/** 印刷画面（上の帯は印刷しない） */
export function 帳票印刷(props: { pages: Rec[]; 名前: string; onClose: () => void }) {
  return (
    <div className="pv">
      <div className="pv-bar">
        <span>{props.名前}（{props.pages.length} 枚）</span>
        <button onClick={() => window.print()}>印刷</button>
        <button onClick={props.onClose}>閉じる</button>
      </div>
      <div className="pv-pages">
        {props.pages.length === 0 && <div className="pv-none">データがありません</div>}
        {props.pages.map((p, i) =>
          p.様式 === "nyuko" ? <入庫依頼書 key={i} p={p} 枚={1} 全={1} /> : <送品案内書 key={i} p={p} />,
        )}
      </div>
    </div>
  );
}
