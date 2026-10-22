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

// ---------------- 積込確認書一式（積込確認書印刷） ----------------
const 丸数字 = (v: string | null | undefined) => v ?? "";
const 月日曜 = (v: string | null) => {
  const x = d(v);
  return x ? `${x.getMonth() + 1}月${x.getDate()}日(${曜[x.getDay()]})` : "";
};
const 年月日曜日2 = 年月日曜日;
const 期限2 = 期限;

/** 積込み前点検表（R_車両点検表）。点検の欄は手で書く */
function 積込み前点検表(props: { s: Rec }) {
  const s = props.s;
  const 丸 = "○　・　×";
  const 左: [string, string, boolean?][] = [
    ["設定温度(℃)", "℃"], ["予冷時間", "時間"], ["予冷温度(℃)", "℃"], ["現在温度(℃)", "℃"], ["最大積載量", ""],
    ["冷凍機作動状態", 丸], ["温度記録機能", 丸], ["エンジンの停止", 丸, true], ["輪留め (タイヤ止め)", 丸], ["パレット落下防止装置", 丸],
    ["ラッシングベルト", 丸], ["ラッシングバー", 丸], ["緩衝材", 丸],
  ];
  const 右: [string, string, boolean?][] = [
    ["コンテナ清潔状態", 丸], ["冷凍機始動確認", 丸, true], ["", ""], ["", ""], ["結露防止対策", 丸], ["仕切り資材", 丸], ["点検表　異常の有無", ""],
  ];
  return (
    <div className="pv-page tk">
      <div className="tk-head">
        <div className="tk-hl">運転手様　各位<br />下記項目について点検致します</div>
        <div className="tk-title">積込み前点検表</div>
        <div className="tk-sha">{s.社名}</div>
      </div>
      <div className="tk-two">
        <div>
          <div className="tk-cap">ドライバーさん確認用</div>
          <table className="tk-t">
            <tbody>
              <tr><th>点検日</th><td className="v">{月日曜(s.便.出荷日)}</td></tr>
              <tr><th>運送会社名</th><td className="v big">{s.便.運送会社名}</td></tr>
              <tr><th>車両番号</th><td /></tr>
              <tr><th>運転者名</th><td /></tr>
              <tr><th>積込み開始時間</th><td className="c">{s.便.開始}</td></tr>
              <tr><th>到着時間</th><td className="c">：</td></tr>
              <tr><th>配車指定時間</th><td className="c">：</td></tr>
            </tbody>
          </table>
        </div>
        <div>
          <div className="tk-cap">丸北点検者　確認用</div>
          <table className="tk-t">
            <tbody>
              <tr><th>天気</th><td className="c">☀　☁　☂　☃</td></tr>
              <tr><th>出荷場所</th><td className="v big">丸北北海道</td></tr>
              <tr><th>点検者(丸北)</th><td /></tr>
              <tr><th>積込み者</th><td /></tr>
              <tr><th>温度(℃)</th><td className="r">℃</td></tr>
              <tr><th>湿度</th><td className="r">%</td></tr>
              <tr><th>積込み開始時間</th><td className="c">：</td></tr>
            </tbody>
          </table>
        </div>
      </div>
      <div className="tk-sec">冷凍機コンテナ</div>
      <div className="tk-helmet">ヘルメットの着用をお願い致します。<span>丸北<br />確認欄</span></div>
      <div className="tk-two">
        <table className="tk-t chk">
          <tbody>
            {左.map(([k, v, red], i) => (
              <tr key={i}><th className={red ? "red" : ""}>{k}</th><td className={v === 丸 ? "c" : "r"}>{v}</td><td className={i === 1 || i === 2 ? "slash" : "box"} /></tr>
            ))}
          </tbody>
        </table>
        <table className="tk-t chk">
          <tbody>
            {右.map(([k, v, red], i) => (
              <tr key={i}><th className={red ? "red" : ""}>{k}</th><td className="c">{v}</td></tr>
            ))}
            <tr><td colSpan={2} className="biko">備考</td></tr>
          </tbody>
        </table>
      </div>
      <div className="tk-note red">車両に異常がある場合、点検者に報告お願いします</div>
      <div className="tk-sec">積込終了後</div>
      <div className="tk-two">
        <table className="tk-t">
          <tbody>
            <tr><th className="small">ｼﾞｮﾙﾀﾞｰ、緩衝材等<br />梱材の積み忘れ確認</th><td /></tr>
            <tr><th>積込完了後　温度(℃)</th><td /></tr>
            <tr><th>出発前　温度(℃)</th><td /></tr>
            <tr><th>ニチレイ大谷地着予想</th><td /></tr>
          </tbody>
        </table>
        <table className="tk-t">
          <tbody>
            <tr><th>完了温度(℃)</th><td /></tr>
            <tr><th>完了湿度</th><td className="r">%</td></tr>
            <tr><th>完了時間</th><td className="c">：</td></tr>
            <tr><th>出発時間</th><td className="c">：</td></tr>
          </tbody>
        </table>
      </div>
      <div className="tk-foot">※禁止事項：コンパネ使用禁止！。パレット輸送で緩衝材（最低22枚）の無いものは積込みできません。</div>
      <div className="tk-foot">{s.社名}　作成　　作成日24．10．31</div>
    </div>
  );
}

/** 積込み個数確認書（R_積込み確認書ver2） */
function 積込み個数確認書(props: { s: Rec }) {
  const s = props.s;
  let 前: unknown = null;
  return (
    <div className="pv-page land kk">
      <div className="kk-head">
        <div className="date">{年月日曜日2(s.便.出荷日)}</div>
        <div className="title">{[..."積込み個数確認書"].join(" ")}</div>
        <div className="time">{s.印刷日時}</div>
      </div>
      <div className="kk-sub">
        <div>
          <div className="jikan">開始予定時間　{s.便.開始}　　終了予定時間　{s.便.終了}　頃</div>
          <div className="bin">{s.便.運送会社名}　{s.便.車番}</div>
        </div>
        <div className="kk-notes">
          <div>※　積込時、品名、製造ロットの確認お願いします。</div>
          <div>※　異常発見の場合は、すぐに積込担当者まで連絡お願い致します。</div>
          <div>※　都合により時間帯が変更になる事が ありますのでご了承願います。</div>
        </div>
      </div>
      <div className="kk-sign"><span>運転手氏名</span><span>丸北積込責任者</span></div>
      <table className="kk-grid">
        <colgroup>
          <col style={{ width: "2.5%" }} /><col style={{ width: "14%" }} /><col style={{ width: "16%" }} /><col style={{ width: "5%" }} /><col style={{ width: "5.5%" }} />
          <col style={{ width: "6.5%" }} /><col style={{ width: "3.8%" }} /><col style={{ width: "23.5%" }} /><col style={{ width: "11.5%" }} /><col style={{ width: "4.2%" }} /><col style={{ width: "5%" }} />
        </colgroup>
        <thead>
          <tr><th>順</th><th>届け先</th><th>品名</th><th>規格</th><th>ケース</th><th>製造ﾛｯﾄ</th><th>区分</th><th>数量確認</th><th>備考</th><th>補足</th><th>残数</th></tr>
        </thead>
        <tbody>
          {s.確認書.map((r: Rec, i: number) => {
            const 同じ = r.届け先コード === 前;
            前 = r.届け先コード;
            return (
              <tr key={i}>
                <td className="c b">{r.順}</td>
                <td className={同じ ? "c" : "todoke"}>{同じ ? "〃" : r.届け先}</td>
                <td className="name">{r.商品名}</td>
                <td className="c">{r.規格}</td>
                <td className="r b">{r.ケース}</td>
                <td className="c">{期限2(r.製造日)}</td>
                <td className="c kubun">{丸数字(r.区分)}</td>
                <td /><td>{r.備考}</td><td className="c b">{r.補足}</td><td />
              </tr>
            );
          })}
        </tbody>
      </table>
      {s.注意事項 && <div className="kk-chui">{s.注意事項}</div>}
      <div className="kk-foot">
        <span>※ コンパネは、異物混入の恐れ（木片、木くず等）がある為、使用禁止です！</span>
        <table><tbody><tr><td>4方ざし</td><td>使用</td><td>残</td><td>2方ざし</td><td>使用</td><td>残</td></tr></tbody></table>
      </div>
    </div>
  );
}

/** 集荷パレットチェックリスト（R_集荷用チェックリスト）。1 枚に 6 行ずつ */
function 集荷パレットチェックリスト(props: { s: Rec; 行: Rec[]; 最初: boolean }) {
  const s = props.s;
  return (
    <div className="pv-page land ck">
      {props.最初 && (
        <>
          <div className="ck-head">
            <div className="title">集荷パレットチェックリスト</div>
            <div className="time">{s.印刷日時}</div>
          </div>
          <div className="ck-sub">
            <table>
              <thead><tr><th>集荷日</th><th>運送会社名</th><th>車番</th><th>運転手名</th></tr></thead>
              <tbody><tr><td>{s.便.出荷日?.replace(/-/g, "/")}</td><td className="b">{s.便.運送会社名}</td><td>{s.便.車番}</td><td /></tr></tbody>
            </table>
            <div className="notes">
              <div>※商品、ロット、区分ごとに仕切り紙を入れてください。</div>
              <div>※一パレットごとにケース数確認をお願いします。総個数（枚数）チェックの欄に記入してください。</div>
            </div>
          </div>
        </>
      )}
      {props.行.map((r, i) => (
        <div key={i} className="ck-block">
          <div className="name">{r.商品名}</div>
          <table>
            <thead><tr><th>順</th><th>製造日</th><th>区分</th><th>総数</th><th>積載数</th><th colSpan={12}>総個数（枚数）チェック</th></tr></thead>
            <tbody>
              <tr>
                <td>{r.順}</td><td className="c">{期限2(r.製造日)}</td><td className="c kubun">{丸数字(r.区分)}</td><td className="c">{r.総数}</td><td />
                {[...Array(12)].map((_, j) => <td key={j} className="box" />)}
              </tr>
            </tbody>
          </table>
        </div>
      ))}
    </div>
  );
}

const 色 = ["#000", "#000", "#f00", "#00f", "#7d7d00", "#7d0000", "#007d00", "#00007d", "#f0f", "#0ff"];

/** 荷台積載イメージ図（R_グラフ作成(積込)ver2）。荷台を横から見た図。長さ・高さは Access と同じ縮尺（cm） */
function 荷台積載イメージ図(props: { s: Rec }) {
  const s = props.s;
  const k = s.積載;
  const 補正 = k.車両大区分 === "トレーラー" ? 2.2 : 2.5;
  const 上 = k.車両大区分 === "トレーラー" ? 5.28 : 6;
  const cm = (v: number) => `${(v * 補正) / 100}cm`;
  let 左 = 0;
  const 列 = k.列.map((r: Rec) => {
    const x = { ...r, 左 };
    左 += r.長さcm;
    return x;
  });
  // 商品ごとの名前の帯（積順が変わるところから、その商品の列の終わりまで）
  const 帯: Rec[] = [];
  for (const r of 列) {
    const last = 帯[帯.length - 1];
    if (last && last.積込順 === r.積込順) last.幅 += r.長さcm;
    else 帯.push({ 積込順: r.積込順, 商品名: r.商品名, 左: r.左, 幅: r.長さcm });
  }
  // 届け先の変わり目の線
  const 線 = 列.filter((r: Rec, i: number) => i > 0 && r.届け先コード !== 列[i - 1].届け先コード).map((r: Rec) => r.左);
  const 残り = k.荷台長 - k.長さ計;
  const 超え = k.荷台長 < k.長さ計;
  return (
    <div className="pv-page land sk">
      <div className="sk-head">
        <div className="bin">
          <div>{月日曜(s.便.出荷日)}</div>
          <div className="big">{s.便.運送会社名}</div>
          <div className="big">{s.便.車番}</div>
        </div>
        <div className="vol">
          <div>{k.m3} m3</div>
          <div>才数:{k.才数}</div>
        </div>
        <div className="title">荷台積載イメージ図（横）</div>
        <div className="len">
          <div className={`plan ${超え ? "red" : ""}`}>積載長予定 約 {k.長さ計} cm 以上</div>
          <div className="base">荷台長基準 約 {k.荷台長} cm　前後</div>
        </div>
        <div className={`rest ${超え ? "red" : ""}`}>＝ 残り {残り} cm</div>
      </div>
      <div className="sk-fb"><span>前</span><span>後</span></div>
      <div className="sk-area" style={{ height: `${上}cm` }}>
        <div className="sk-over" style={{ width: 超え ? "28cm" : cm(k.長さ計), height: `${上}cm` }} />
        <div className="sk-box" style={{ width: cm(k.荷台長), height: `${上}cm` }} />
        {[40, 80, 120, 160, 200].map((h) => (
          <div key={h} className="sk-line" style={{ bottom: cm(h) }}>{h === 120 || h === 160 ? <span>{h}cm</span> : null}</div>
        ))}
        {帯.map((b, i) => (
          <div key={i} className="sk-name" style={{ left: cm(b.左), width: cm(b.幅), height: `${上}cm`, color: 色[b.積込順] ?? "#000" }}>{b.商品名}</div>
        ))}
        {線.map((x: number, i: number) => <div key={i} className="sk-todoke" style={{ left: cm(x), height: `${上}cm` }} />)}
        {列.map((r: Rec) => (
          <div key={r.No} className="sk-bar" style={{ left: cm(r.左), width: cm(r.長さcm), height: cm(r.段高さcm), color: 色[r.積込順] ?? "#000" }}>
            {r.ケース}個{r.段数 === 1 ? "" : <><br />{r.段数} 段</>}
          </div>
        ))}
      </div>
      <div className="sk-no">
        {列.map((r: Rec) => (
          <div key={r.No} style={{ left: cm(r.左) }}>
            {r.No}
            {r.商品毎No === 1 ? <><br />{r.長さcm}cm</> : null}
          </div>
        ))}
      </div>
    </div>
  );
}

/** 積込確認書一式の印刷画面（Access と同じく 点検表 → 個数確認書 → チェックリスト → 積載イメージ図） */
export function 積込確認書印刷(props: { s: Rec; onClose: () => void }) {
  const s = props.s;
  const 組: Rec[][] = [];
  for (let i = 0; i < s.チェック.length; i += 6) 組.push(s.チェック.slice(i, i + 6));
  return (
    <div className="pv">
      <div className="pv-bar">
        <span>積込確認書（{s.便.運送会社名} {s.便.車番}）</span>
        <button onClick={() => window.print()}>印刷</button>
        <button onClick={props.onClose}>閉じる</button>
      </div>
      <div className="pv-pages">
        <積込み前点検表 s={s} />
        <積込み個数確認書 s={s} />
        {組.map((g, i) => <集荷パレットチェックリスト key={i} s={s} 行={g} 最初={i === 0} />)}
        <荷台積載イメージ図 s={s} />
      </div>
    </div>
  );
}

// ---------------- 輸送依頼書（R_輸送依頼書ver2） ----------------
const 令和 = (v: string | null) => {
  const x = d(v);
  return x ? `${x.getFullYear() - 2018}年${x.getMonth() + 1}月${x.getDate()}日${曜[x.getDay()]}曜日` : "";
};
const 年月日曜 = (v: string | null) => {
  const x = d(v);
  return x ? `${x.getFullYear()}年${x.getMonth() + 1}月${x.getDate()}日${曜[x.getDay()]}曜` : "";
};

function 輸送依頼書ページ(props: { y: Rec }) {
  const y = props.y;
  const 差 = y.差出人 ?? {};
  const 違う = y.集荷日 && y.出荷日 && y.集荷日 !== y.出荷日;
  return (
    <div className="pv-page yi">
      <div className="yi-top">
        <div>No. {y.No}</div>
        <div className="title">{[..."輸送依頼書"].join(" ")}</div>
        <div className="from">
          <div>{令和(y.印刷日)}</div>
          <div className="sha">{差.社名}</div>
          <div className="addr">{差.住所}</div>
          {差.TEL && <div className="addr">TEL：{差.TEL}</div>}
          {差.FAX && <div className="addr">FAX：{差.FAX}</div>}
        </div>
      </div>
      <div className="yi-ate">{y.宛先}</div>
      <table className="yi-kv">
        <tbody>
          <tr><th>集 荷 先</th><td>{y.集荷先.名前}</td></tr>
          <tr><th>住　 所</th><td>{y.集荷先.住所}</td></tr>
          <tr><th>Ｔ Ｅ Ｌ</th><td>{y.集荷先.TEL}</td></tr>
          <tr className="gap"><td colSpan={2} /></tr>
          <tr>
            <th>集 荷 日</th>
            <td>
              <span className={違う ? "ul" : ""}>{年月日曜(y.集荷日)}</span>
              {違う && <><span>{` ～   ${年月日曜(y.集荷日)}`}</span><div className="kome">　集荷可能な日に〇を記入の上、返信お願いします　</div></>}
            </td>
          </tr>
        </tbody>
      </table>
      {y.納品日ごと.map((g: Rec) => (
        <div key={g.納品日} className="yi-day">
          <div className="nohin">納 品 日　{g.納品日 ? `${Number(g.納品日.slice(5, 7))}月${Number(g.納品日.slice(8, 10))}日` : ""}</div>
          {g.届け先.map((t: Rec) => (
            <div key={t.コード} className="yi-todoke">
              <table>
                <tbody>
                  <tr><th>届 け 先</th><td>{t.名前}</td><td className="sum">合 計　{t.ケース} 個　　{数(t.kg)} kg</td></tr>
                  <tr><th>住　 所</th><td colSpan={2}>{t.住所}</td></tr>
                  <tr><th>Ｔ Ｅ Ｌ</th><td colSpan={2}>{t.TEL}</td></tr>
                  {t.品.map((h: Rec, i: number) => (
                    <tr key={i}><th>{i === 0 ? "品　 名：" : ""}</th><td>{h.商品名}{h.サイズ ? `　${h.サイズ}` : ""}</td><td className="ko">{h.ケース} 個　　{数(h.kg)} kg</td></tr>
                  ))}
                </tbody>
              </table>
              <div className="biko"><span>備　 考：</span><span className="pre">{t.備考}</span></div>
            </div>
          ))}
        </div>
      ))}
      <div className="yi-reply">受信されましたら御確認のうえ、上記宛てに返信下さい</div>
      <div className="yi-bottom">
        <div className="seikyu">請求先は{y.請求先}でお願いします。</div>
        <div className="notes">
          <div>　　　冷凍機指示：　　　　　　　セット温度　{y.セット温度}℃　チャート紙　必要</div>
          <div>　　　商 品 積 付：基本積み付け 天地無用厳守実施（横積み厳禁）重ね積み最大5段 角打ち禁止 落下禁止</div>
          <div>※　積込前に冷凍機のE/g始動の確認して下さい。又 異常等が発生の場合</div>
          <div>※　（交通事情・異常気象・等により配達時間の変更の場合）は至急{y.連絡先}まで連絡してください。</div>
          <div>　　連絡の無いものや、積込み時異常報告のない場合は乗務員の責任とさせていただきます。</div>
          <div>　　商品の破損発見時（DBの破損、つぶれ）又 落下等による破損の場合、必ず積込み者立会いのもとで</div>
          <div>　　現認後の積込みになります。</div>
        </div>
        <div className="page">1/1 ページ</div>
      </div>
    </div>
  );
}

/** 輸送依頼書の印刷画面 */
export function 輸送依頼書印刷(props: { y: Rec; onClose: () => void }) {
  return (
    <div className="pv">
      <div className="pv-bar">
        <span>輸送依頼書（{props.y.宛先}）</span>
        <button onClick={() => window.print()}>印刷</button>
        <button onClick={props.onClose}>閉じる</button>
      </div>
      <div className="pv-pages">
        <輸送依頼書ページ y={props.y} />
      </div>
    </div>
  );
}

// ---------------- パレット輸送の積み込み指示書（A_パレット輸送積込確認書） ----------------
/** 枠の文字（商品名・製造日 区分・個数）を、Access と同じく行ごとに色を変えて出す */
function 枠の文字(props: { v: string }) {
  const [名前, ロット, 個数] = String(props.v ?? "").split(/\r?\n/);
  return (
    <>
      <div>{名前}</div>
      {ロット !== undefined && <div className="lot">{ロット}</div>}
      {個数 !== undefined && <div className="ko">{個数}</div>}
    </>
  );
}

function 積み込み指示書(props: { p: Rec }) {
  const p = props.p;
  return (
    <div className="pv-page pi">
      <div className="pi-cols">
        <div className="pi-col">
          <div className="cap">ヨ コ</div>
          {p.左.map((v: string, i: number) => (
            <div key={i} className="slot yoko"><span className="no">{i + 1}</span><div className="t"><枠の文字 v={v} /></div></div>
          ))}
        </div>
        <div className="pi-col">
          <div className="cap">タ テ</div>
          {p.右.map((v: string, i: number) => (
            <div key={i} className="slot tate"><span className="no">{i + 1}</span><div className="t"><枠の文字 v={v} /></div></div>
          ))}
        </div>
        <div className="pi-right">
          <div className="title">積み込み指示書</div>
          <div className="info">
            <div className="unso">{p.便.運送会社名}</div>
            <div className="gou">号 車 {p.便.車番 ?? ""}</div>
            <table>
              <tbody>
                <tr><th>集 荷 日</th><td>：</td><td>{月日曜(p.便.集荷日)}</td></tr>
                <tr><th>積込予定時間</th><td>：</td><td>{p.便.開始}</td></tr>
                <tr><th>届 け 先</th><td>：</td><td>{p.届け先}</td></tr>
                <tr><th>納 品 日</th><td>：</td><td>{月日曜(p.納品日)}</td></tr>
              </tbody>
            </table>
          </div>
          <table className="pi-list">
            <thead><tr><th>商品名</th><th>ロット</th><th>区分</th><th>個数</th><th>kg</th></tr></thead>
            <tbody>
              {p.明細.map((r: Rec, i: number) => (
                <tr key={i}><td>{r.商品名}</td><td>{期限2(r.ロット)}</td><td className="kubun">{r.区分}</td><td>{r.個数}</td><td>{r.kg}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

/** 積み込み指示書と積み込み前点検表の印刷画面（Access の cmd_印刷_Click） */
export function パレット積込印刷(props: { p: Rec; onClose: () => void }) {
  return (
    <div className="pv">
      <div className="pv-bar">
        <span>積み込み指示書（{props.p.便.運送会社名}）</span>
        <button onClick={() => window.print()}>印刷</button>
        <button onClick={props.onClose}>閉じる</button>
      </div>
      <div className="pv-pages">
        <積み込み指示書 p={props.p} />
        <積込み前点検表 s={props.p} />
      </div>
    </div>
  );
}

// ---------------- 出荷予定明細票（R_出荷予定明細票） ----------------
const 月日2 = (v: string | null) => (v ? `${Number(v.slice(5, 7))}月${v.slice(8, 10)}日` : "");
const kg整数 = (v: number) => Math.round(v).toLocaleString("ja-JP");

function 出荷予定明細票ページ(props: { p: Rec; 社名: string; 作成時間: string }) {
  const p = props.p;
  return (
    <div className="pv-page land yt">
      <div className="yt-top">
        <div className="title">{[..."出荷予定明細票"].join(" ")}</div>
        <div className="time">{props.作成時間}</div>
      </div>
      <div className="yt-line">
        <div className="day">出荷予定日 {年月日曜日(p.出荷日)}</div>
        <div className="no">No{p.No}</div>
      </div>
      <div className="yt-sha">{props.社名}</div>
      <div className="yt-line2">
        <span className="u">運送業者 {p.運送会社名}</span>
        <span className="u">車番{p.車番}号車</span>
        <span className="sum"><span>合計</span><span>{kg整数(p.kg)} kg</span></span>
      </div>
      <table className="yt-grid">
        <colgroup><col style={{ width: "3%" }} /><col style={{ width: "7%" }} /><col style={{ width: "3%" }} /><col style={{ width: "4.5%" }} /><col style={{ width: "17%" }} /><col style={{ width: "4.5%" }} /><col style={{ width: "19%" }} /><col style={{ width: "5%" }} /><col style={{ width: "4.5%" }} /><col style={{ width: "5.8%" }} /><col style={{ width: "6%" }} /><col style={{ width: "6%" }} /><col style={{ width: "3%" }} /><col style={{ width: "12.2%" }} /></colgroup>
        <thead>
          <tr><th>積順</th><th>出荷元</th><th>名義</th><th>コード</th><th>入庫先</th><th>コード</th><th>品名</th><th>規格</th><th>ケース</th><th>kg</th><th>賞味期限</th><th>着日</th><th>区分</th><th>備考</th></tr>
        </thead>
        <tbody>
          {p.行.map((r: Rec, i: number) => (
            <tr key={i}>
              <td className="c b">{r.積順}</td><td className="small">{r.出荷元}</td><td className="c b">{r.名義}</td><td className="r">{r.コード}</td>
              <td className="small">{r.入庫先}</td><td className="r">{r.商品コード}</td><td className="small">{r.商品名}</td><td className="c">{r.規格}</td>
              <td className="r">{r.ケース}</td><td className="r">{kg整数(r.kg)}</td><td className="c">{期限(r.賞味期限)}</td><td className="c">{月日2(r.着日)}</td>
              <td className="c kubun">{r.区分}</td><td className="small">{r.備考}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="yt-note">
        <div>※ コンパネは、異物混入の恐れ(木片、木くず等)がある為、使用禁止です！</div>
        <div>※ 名義表示 F:ふらの M:大阪 H:北海道</div>
      </div>
    </div>
  );
}

/** 出荷予定明細票の印刷画面 */
export function 出荷予定明細票印刷(props: { y: Rec; onClose: () => void }) {
  const pages: Rec[] = props.y.pages ?? [];
  return (
    <div className="pv">
      <div className="pv-bar">
        <span>出荷予定明細票（{pages.length} 枚）</span>
        <button onClick={() => window.print()}>印刷</button>
        <button onClick={props.onClose}>閉じる</button>
      </div>
      <div className="pv-pages">
        {pages.length === 0 && <div className="pv-none">データがありません</div>}
        {pages.map((p, i) => <出荷予定明細票ページ key={i} p={p} 社名={props.y.社名} 作成時間={props.y.作成時間} />)}
      </div>
    </div>
  );
}
