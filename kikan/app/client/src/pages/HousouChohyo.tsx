// 包装場管理System の帳票の印刷画面（いただいた見本〈2026/10/27〉と同じ並び）。
// 上で日付と帳票を選ぶと、下に印刷の形で出す。［印刷］でブラウザの印刷。
import { Fragment, useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { api, ApiError } from "../api";
import { today } from "../formParts";

type Rec = Record<string, any>;
const 曜 = "日月火水木金土";
const d = (v: string | null | undefined) => (v ? new Date(v.slice(0, 10) + "T00:00:00") : null);
const 月日曜 = (v: string | null) => {
  const x = d(v);
  return x ? `${x.getMonth() + 1}月${x.getDate()}日(${曜[x.getDay()]})` : "";
};
const 令和 = (v: string | null) => {
  const x = d(v);
  return x ? `令和${x.getFullYear() - 2018}年${x.getMonth() + 1}月${x.getDate()}日` : "";
};
const 点 = (v: string | null) => (v ? `${v.slice(2, 4)}.${v.slice(5, 7)}.${v.slice(8, 10)}` : "");
const 斜め = (v: string | null) => (v ? `${v.slice(2, 4)}/${v.slice(5, 7)}/${v.slice(8, 10)}` : "");
const 数 = (v: number | null | undefined, 桁 = 0) => (v == null || v === 0 ? "" : Number(v.toFixed(桁)).toLocaleString("ja-JP"));
const 数0 = (v: number | null | undefined) => (v == null ? "" : Math.round(v).toLocaleString("ja-JP"));
const 年月日 = (v: string | null) => {
  const x = d(v);
  return x ? `${x.getFullYear()}年${x.getMonth() + 1}月${x.getDate()}日` : "";
};
const 空白入り = (s: string) => [...String(s ?? "")].join(" ");
const エラー = (e: unknown) => alert(e instanceof ApiError ? e.message : String(e));

// ---------------- 包装予定表（R_生産計画予定表ver2） ----------------
function 包装予定表(props: { x: Rec }) {
  const { x } = props;
  return (
    <div className="pv-page hz-yotei">
      <div className="hy-head"><div className="t">包装予定表</div><div className="dt">{月日曜(x.印刷日)}</div></div>
      <table className="hy-t">
        <colgroup>
          <col style={{ width: "13%" }} /><col style={{ width: "27%" }} /><col style={{ width: "6%" }} /><col style={{ width: "5.5%" }} /><col style={{ width: "4%" }} />
          <col style={{ width: "5.5%" }} /><col style={{ width: "5%" }} /><col style={{ width: "5%" }} /><col style={{ width: "29%" }} />
        </colgroup>
        <thead><tr><th>包装日</th><th>Ⅰ工場</th><th>品番</th><th>ケース</th><th>P数</th><th>分</th><th>当日</th><th>ﾁﾚｲP</th><th>予定</th></tr></thead>
        {x.日々.map((day: Rec) => (
          <tbody key={day.入庫日} className="day">
            {day.行.map((r: Rec, i: number) => (
              <tr key={i}>
                <td className="left">
                  {i === 0 && <div className="date">{月日曜(day.入庫日)}</div>}
                  {i === 0 && day.出勤 && <div className="shukkin">{day.出勤}</div>}
                  <div className="pan">{r.商品コード != null ? 数0(r.冷凍パン) : ""}</div>
                </td>
                <td className="name">{r.商品名}</td><td className="c">{r.品番}</td><td className="r">{r.商品コード != null ? 数0(r.ケース) : ""}</td>
                <td className="r">{r.P数 != null ? Math.round(r.P数) : ""}</td><td className="r">{数0(r.分)}</td>
                <td className="r it">{数(r.当日)}</td><td className="r it red">{数(r.ﾁﾚｲP)}</td><td className="biko">{r.備考}</td>
              </tr>
            ))}
            <tr className="sum">
              <td className="left"><span>冷凍ﾊﾟﾝ</span><b>{数0(day.冷凍パン)}</b>{day.出勤 && <div className="shukkin2">{day.出勤}</div>}</td>
              <td /><td /><td /><td /><td className="r total">{数0(day.分計)}</td><td /><td /><td />
            </tr>
          </tbody>
        ))}
      </table>
    </div>
  );
}

// ---------------- 製造分割予定表（R_製造計画分割予定表） ----------------
function 製造分割予定表(props: { x: Rec }) {
  const { x } = props;
  return (
    <div className="pv-page hz-bun">
      <div className="hb-head"><div className="t">{月日曜(x.日)}製造分割予定表</div><div className="dt">{x.印刷日時}</div></div>
      {x.品.map((p: Rec, k: number) => {
        const 行数 = Math.max(p.行.length + 1, 3);
        return (
          <div key={k} className="hb-block">
            <div className="hb-top">
              <div className="hb-l">
                <div className="hin"><span>品　　名</span>{p.商品名}</div>
                <div className="sub"><span>予定開始時間</span><span className="colon">:</span><span className="kojo">{p.工場}</span><span>計量半端</span><span className="mai">枚</span></div>
                <div className="kg">{数0(p.kg)}</div>
              </div>
              <table className="hb-plan">
                <tbody>
                  <tr><th>計画 総枚数</th><td>{数0(p.総枚数)}</td></tr>
                  <tr><th>確定 総枚数</th><td /></tr>
                  <tr><th>計画 総ケース</th><td>{数0(p.総ケース)}</td></tr>
                  <tr><th>確定 総ケース</th><td /></tr>
                </tbody>
              </table>
              <div className="dan">段</div>
            </div>
            <div className="hb-tables">
              <table className="hb-t">
                <thead><tr><th>区分</th><th>希望kg</th><th>訂正kg</th><th>札色</th><th>ｶｰﾄﾞNo</th><th>計量枚数</th></tr></thead>
                <tbody>
                  {Array.from({ length: 行数 }, (_, i) => {
                    const r = p.行[i];
                    return <tr key={i}><td className="kubun">{r?.区分}</td><td className="r kibo">{r ? 数0(r.希望kg) : ""}</td><td /><td /><td /><td /></tr>;
                  })}
                </tbody>
              </table>
              <table className="hb-t">
                <thead><tr><th>個数</th><th>半端数</th><th>確認者</th><th>記入者</th><th>半端台車　No(枚数)</th></tr></thead>
                <tbody>{Array.from({ length: 行数 }, (_, i) => <tr key={i}><td /><td /><td /><td /><td /></tr>)}</tbody>
              </table>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ---------------- 包装日誌（R_包装日誌） ----------------
function 包装日誌ページ(props: { r: Rec; 日: string }) {
  const { r } = props;
  const 曜日 = d(r.製造日) ? `${曜[d(r.製造日)!.getDay()]}曜日` : "";
  const 枠 = (n: number) => Array.from({ length: n }, (_, i) => <td key={i} />);
  return (
    <div className="pv-page hz-nisshi">
      <div className="hn-top">
        <table className="hn-in"><tbody><tr><th>工場長</th><th>品質管理</th><th>製造管理</th></tr><tr><td /><td /><td /></tr></tbody></table>
        <div className="hn-title">包　装　日　誌<div className="no">NO.</div></div>
        <div className="hn-right">
          <div className="date">{空白入り(年月日(props.日))}</div>
          <div className="sign">記入者</div>
          <div className="sign">確認者</div>
        </div>
      </div>
      <table className="hn-t">
        <colgroup><col style={{ width: "19%" }} /><col /><col style={{ width: "13%" }} /><col style={{ width: "13%" }} /></colgroup>
        <tbody>
          <tr><th className="l">商品名</th><td colSpan={3} className="name">{空白入り(r.商品名)}</td></tr>
          <tr className="h2"><th className="l">作業時間</th><td className="c">～　　　　　　　　　～</td><th>人数</th><td /></tr>
          <tr className="h4"><th className="l">カードチェック</th><td className="small">{["色", "色", "色", "色"].map((c, i) => <div key={i}>{c}　（　　　　～　　　　）</div>)}</td><th className="small">確認者名<div className="tiny">11時間以上の<br />凍結確認チェック</div></th><td /></tr>
          <tr className="h3"><th className="l">袋チェック</th><td colSpan={3} className="small">白10k　青10k　NS-21　コーン袋　メタロセン袋1k　メタロセン赤 5k　メタロセンLLDPE青<br />メタロセン青5k　メタロセンオレンジ5k　メタロセンLLDPE透明10k　ソテー70青袋<br />メタロセンLLDPE白10k　メタロセン0.07mm　野菜袋オレンジ　ラミネート袋（　　g）</td></tr>
          <tr><th className="l">包装前 袋チェック</th><td className="small">シール　無・有<br />袋印字　無・有<span className="pad">袋印字読み上げ確認者</span></td><th>確認者</th><td /></tr>
          <tr className="h3"><th className="l">封緘テープ</th><td colSpan={2} className="small">上面　OPPテープ　赤OPPテープ　白OPPテープ　その他<br />下面　OPPテープ　　　　　　　　　　その他</td><th className="small">確認者</th></tr>
          <tr className="h3"><th className="l">ロット</th><td className="lot"><div><span>製造日</span>{r.製造ロット}</div><div><span>賞味期限</span>{r.賞味ロット}</div></td><td className="lot2"><div>{曜日}</div><div>{r.期限}</div></td><th className="small">確認者</th></tr>
          <tr><th className="l">ロット印字</th><td colSpan={3} className="small">調整者名　　　　　　　　　　確認者名</td></tr>
          <tr><th className="l">品名ゴム印、手書き</th><td colSpan={3} className="small">無・有　ラベル　ゴム印　　　　　箇所・手書き　　　　　　　箇所</td></tr>
          <tr><th className="l">ダンボール番号</th><td colSpan={3} className="small">A-　　　　B-　　　　C-　　　　D-　　　　E-　　　　その他</td></tr>
          <tr><th className="l">荷　姿</th><td colSpan={3} className="small">1kg×10　1kg×15　5kg×3　5kg×4　6kg×3　10kg×2　その他（　　　）</td></tr>
        </tbody>
      </table>
      <table className="hn-g">
        <thead><tr><th>区分</th><th>箱詰数</th><th /><th>原料</th><th>メトリ</th><th>形不良</th><th>穴あき</th><th>印字不良</th><th>シール不良</th><th>その他</th><th>未包装</th></tr></thead>
        <tbody>
          {Array.from({ length: 5 }, (_, i) => <tr key={i}>{枠(3)}{Array.from({ length: 8 }, (_, j) => <td key={j} className="mai">枚</td>)}</tr>)}
          <tr><td colSpan={2} className="small">破損ダンボール</td><td className="small">枚</td><td colSpan={2} className="small">数量確認者</td><td colSpan={2} className="small">ダンボール確認<br />有・無</td><td colSpan={4} className="small">備考</td></tr>
          <tr><td colSpan={2} className="small">返品ダンボール</td><td className="small">枚</td><td colSpan={8} /></tr>
        </tbody>
      </table>
      <table className="hn-x">
        <tbody>
          <tr><th className="l" rowSpan={2}>X線異物検出装置<br />チェック表<div className="tiny">照射6000時間以内の確認</div></th><td className="small">通過総数</td><td className="small">正常通過数<br />反応数</td><td className="small">内訳<br />テスト　誤作動　異物(良薬数)</td><td className="small">反応品の詳細</td><td className="small">赤<br />青<br />緑<br />黄</td></tr>
        </tbody>
      </table>
      <table className="hn-g">
        <thead><tr><th>確認時刻</th><th>手袋</th><th>X線カテゴリ</th><th>商品重量</th><th>X線重量<br /><span className="tiny">誤差±30g</span></th><th>Sus球<br /><span className="tiny">1.2mmφ</span></th><th>Sus線<br /><span className="tiny">φ0.7×5mm</span></th><th>塩ビ<br /><span className="tiny">5×5mm</span></th><th>ガラス球<br /><span className="tiny">4mmφ</span></th><th>セラミック球<br /><span className="tiny">4mmφ</span></th><th>入力者</th><th>確認者</th></tr></thead>
        <tbody>{Array.from({ length: 5 }, (_, i) => <tr key={i}>{枠(12)}</tr>)}</tbody>
      </table>
      <table className="hn-t foot">
        <tbody>
          <tr><td colSpan={2} className="c">凍結庫庫内設定温度(-30℃)の確認</td><td className="small">AM</td><td className="small">PM</td></tr>
          <tr><td className="small">保管庫庫の作業適正確認　am　　　　pm</td><td className="small">ハサミの確認（1本）</td><td colSpan={2} className="small">包装作業終了後異常　無・有<br />作業終了後　異常　無・有</td></tr>
        </tbody>
      </table>
      <div className="hn-foot">丸北北海道　作成部署　品質管理室　作成日16.07.01　改定日17.10.23</div>
    </div>
  );
}

// ---------------- 包装 数量チェック表（R_包装数量チェック表） ----------------
function 数量チェック表ページ(props: { r: Rec; 日: string; 人: string[] }) {
  const { r } = props;
  return (
    <div className="pv-page land hz-check">
      <div className="hq-top"><div>包装順：{r.包装順}</div><div className="t">{年月日(props.日)} 包装　数量チェック表</div></div>
      <div className="hq-head">
        <div className="hq-l">
          <div className="name">{r.商品名}</div>
          <div className="row"><span>製造日 {空白入り(点(r.製造日))}</span><span>賞味期限 {空白入り(点(r.賞味期限))}</span><b>{r.段数} 段</b></div>
          <div className="row small"><span>不凍結 A:</span><span>B:</span><span className="b">計量予定数　{数0(r.計量予定数)} 枚</span></div>
          <div className="row small"><span>不凍結 C:</span><span>D:</span><span className="b">予定ケース　{数0(r.予定ケース)} ケース</span></div>
        </div>
        <table className="hq-people">
          <tbody>
            {["ダッパン1", "ダッパン2", "箱入れ", "箱入補助"].map((k) => (
              <tr key={k}><th>{k}</th>{props.人.map((p, i) => <td key={i}>{p}</td>)}</tr>
            ))}
          </tbody>
        </table>
      </div>
      <table className="hq-t">
        <colgroup>
          <col style={{ width: "4%" }} /><col style={{ width: "3%" }} /><col style={{ width: "6.5%" }} />
          {Array.from({ length: 10 }, (_, i) => <col key={i} style={{ width: "3.6%" }} />)}
          <col style={{ width: "7%" }} /><col style={{ width: "5.5%" }} /><col style={{ width: "3%" }} /><col style={{ width: "5.5%" }} /><col style={{ width: "16%" }} /><col />
        </colgroup>
        <thead><tr><th>札色</th><th>区分</th><th>カード区分</th><th colSpan={10}>カード番号</th><th>計量枚数</th><th>ケース</th><th className="tiny">予定<br />袋残</th><th>実ケース</th><th>包装残</th><th>備考</th></tr></thead>
        <tbody>{Array.from({ length: 13 }, (_, i) => <tr key={i}>{Array.from({ length: 19 }, (_, j) => <td key={j} />)}</tr>)}</tbody>
      </table>
    </div>
  );
}

// ---------------- パレット票（R_包装札） ----------------
function パレット票(props: { r: Rec }) {
  const { r } = props;
  return (
    <div className="hp-card">
      <div className="hp-top"><span className="date">{r.入庫日?.replace(/-/g, "/")}</span><span className="no">{r.No}</span></div>
      <table className="hp-t">
        <tbody>
          <tr className="kubun"><th>区<br />分</th><td colSpan={3} className="tag">{r.区分}</td></tr>
          <tr className="hin"><th>品<br />名</th><td colSpan={3}>{r.品名}{r.出荷停止 && <div className="stop">{r.出荷停止}</div>}</td></tr>
          <tr className="hi"><th>日<br />付</th><td colSpan={3} className="big">{r.製造日 ? `${r.製造日.slice(5, 7)}/${r.製造日.slice(8, 10)}` : ""}</td></tr>
          <tr className="su"><th className="tiny">パ<br />レ<br />ッ<br />ト</th><td className="pal">{r.パレット}</td><th>数<br />量</th><td className="qty">{r.数量}</td></tr>
          <tr className="iro"><th>札<br />色</th><td className="color">{r.札色}</td><th className="small">区分<br />No</th><td className="cno">{r.区分No}</td></tr>
          <tr className="biko"><th className="small">備考</th><td colSpan={3}>{r.備考}</td></tr>
        </tbody>
      </table>
      <div className="hp-time">時間　　　　　：</div>
    </div>
  );
}

// ---------------- 区分表示（R_包装札(在庫)） ----------------
function 区分表示(props: { r: Rec }) {
  return (
    <div className="hk-card">
      <div className="tag">{props.r.区分}</div>
      <div className="name">{props.r.品名}</div>
      <div className="date">{点(props.r.製造日)}</div>
    </div>
  );
}

// ---------------- 仕掛原料管理札（R_仕掛原料管理札新Ver） ----------------
function 仕掛札(props: { r: Rec }) {
  const { r } = props;
  return (
    <table className="hf-card">
      <colgroup><col style={{ width: "22%" }} /><col style={{ width: "3.5%" }} /><col style={{ width: "26%" }} /><col style={{ width: "22%" }} /><col /></colgroup>
      <tbody>
        <tr className="top">
          <td className="code"><div className="lbl">コード</div><div className="v">{r.コード}</div></td>
          <td className={"kojo" + (r.水色 ? " blue" : " pink")}>{r.工場}</td>
          <td className="sp" colSpan={2} />
          <td className="gen"><div className="lbl">原料</div><div className="v">{r.原料}</div></td>
        </tr>
        <tr className="name"><th>商品名</th><td colSpan={4}>{r.品名}</td></tr>
        <tr className="date"><th>製造日</th><td colSpan={4}>{斜め(r.製造日)}</td></tr>
        <tr><th>残数</th><td colSpan={2} /><th>区分</th><td /></tr>
        <tr><th>記載者</th><td colSpan={4} /></tr>
      </tbody>
    </table>
  );
}

// ---------------- ロボットパレット引き出し確認表（R_包装連絡表_Robot確認ver2） ----------------
function ロボット確認表(props: { x: Rec }) {
  const { x } = props;
  let 前: unknown = null;
  return (
    <div className="pv-page land hz-robot">
      <div className="hr-head">
        <div className="date">{令和(x.日)}</div>
        <div className="t">包装ロボットパレット引き出し確認表</div>
        <table className="hz-kakunin"><tbody><tr><th>確認者</th><th>確認者</th></tr><tr><td /><td /></tr></tbody></table>
      </div>
      <div className="hr-mid">
        <div className="lbl">申し送り</div>
        <div className="kara">空パレット<br />枚数</div>
        <table className="hr-kara"><tbody><tr><th>丸北(大)</th><th>大谷地</th><th>十勝</th><th>ふらの</th><th>輸送用</th></tr><tr><td /><td /><td /><td /><td /></tr></tbody></table>
        <div className="chk">パレット積みチェック</div>
      </div>
      <table className="hr-t">
        <colgroup>
          <col style={{ width: "2.4%" }} /><col style={{ width: "21%" }} /><col style={{ width: "5%" }} /><col style={{ width: "5%" }} /><col style={{ width: "3.5%" }} />
          {Array.from({ length: 14 }, (_, i) => <col key={i} />)}
        </colgroup>
        <thead>
          <tr><th>順</th><th>品名</th><th className="small">ロボット<br />No</th><th className="small">使用<br />ﾊﾟﾚｯﾄ</th><th className="small">積数</th>{Array.from({ length: 14 }, (_, i) => <th key={i}>{i + 1}</th>)}</tr>
        </thead>
        <tbody>
          {x.行.map((r: Rec, i: number) => {
            const 名 = r.商品コード !== 前 ? r.品名 : "";
            前 = r.商品コード;
            return (
              <tr key={i}>
                <td className="jun">{i + 1}</td>
                <td className="hin"><div className="n">{名}</div><div className="k"><span className="tag">{r.区分}</span><span>{r.ケース}</span><span className="red">{r.備考}</span></div></td>
                <td className="robo">{r.ロボットNo || ""}</td><td className="c">{r.使用パレット}</td><td className="r">{r.積数}</td>
                {Array.from({ length: 14 }, (_, j) => <td key={j} className="p">{r.パレット[j] ?? ""}</td>)}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ---------------- 包装連絡表（R_包装連絡表） ----------------
function 包装連絡表(props: { x: Rec }) {
  const { x } = props;
  let 前: unknown = null;
  return (
    <div className="pv-page land hz-renraku">
      <div className="hl-head">
        <div className="date">{令和(x.日)}</div>
        <div className="t">包装連絡表</div>
        <table className="hz-kakunin"><tbody><tr><th>確認者</th><th>確認者</th></tr><tr><td /><td /></tr></tbody></table>
      </div>
      <div className="hl-pal"><span>丸北　空パレット枚数</span><span className="mai">枚</span><span>ニチレイ　空パレット枚数</span><span className="mai">枚</span><span>人員</span><span className="mai">人</span></div>
      <div className="hl-lbl">出荷情報<span className="caster">不良キャスター　　　　　台</span></div>
      <div className="hl-lbl">安全推進</div>
      <div className="hl-lbl">申し送り</div>
      <div className="hl-moushi">{x.申し送り.map((m: string, i: number) => <div key={i} className={i % 2 ? "gray" : ""}><span>{m}</span></div>)}</div>
      <table className="hl-t">
        <colgroup>
          <col style={{ width: "2.4%" }} /><col style={{ width: "26%" }} /><col style={{ width: "3.5%" }} /><col style={{ width: "7%" }} /><col style={{ width: "8.5%" }} /><col style={{ width: "6%" }} />
          <col style={{ width: "5.5%" }} /><col style={{ width: "5%" }} /><col style={{ width: "5%" }} /><col style={{ width: "5%" }} /><col style={{ width: "10%" }} /><col style={{ width: "5%" }} /><col />
        </colgroup>
        <thead><tr><th>順</th><th>品名</th><th>区分</th><th>札色</th><th>ｶｰﾄﾞNo</th><th>計量枚数</th><th>ケース</th><th>実ケース</th><th>端数</th><th>パレット数</th><th>総段数と半端個数</th><th className="tiny">ﾀﾞﾝﾎﾞｰﾙ<br />在庫</th><th>確認者</th></tr></thead>
        <tbody>
          {x.行.map((r: Rec, i: number) => {
            const 名 = r.商品コード !== 前 ? r.品名 : "";
            前 = r.商品コード;
            return (
              <tr key={i}>
                <td className="jun">{i + 1}</td><td>{名}</td><td className="c tag">{r.区分}</td><td className="c b">{r.札色}</td><td className="c">{r.カードNo}</td>
                <td className="r">{数(r.計量枚数)}</td><td className="r">{r.ケース}</td><td /><td className="c">{r.端数}</td><td className="c big">{r.パレット数 ?? ""}</td>
                <td className="small">{r.総段数 != null ? `${r.総段数} 段 + 半端 ${r.半端}` : ""}</td><td /><td />
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/** 帳票の一覧（Access の F_包装管理日誌・F_包装札作成 のボタン） */
const 帳票: { k: string; 名: string; 組: string }[] = [
  { k: "yotei", 名: "包装予定表", 組: "包装管理日誌" },
  { k: "bunkatsu", 名: "製造分割予定表", 組: "包装管理日誌" },
  { k: "nisshi", 名: "包装日誌", 組: "包装管理日誌" },
  { k: "check", 名: "数量チェック表", 組: "包装管理日誌" },
  { k: "renraku", 名: "包装連絡表", 組: "包装札作成" },
  { k: "robot", 名: "ロボットパレット引き出し確認表", 組: "包装札作成" },
  { k: "pallet", 名: "パレット票（包装札）", 組: "包装札作成" },
  { k: "kubun", 名: "区分表示（在庫）", 組: "包装札作成" },
  { k: "shikake", 名: "仕掛原料管理札", 組: "包装札作成" },
];
/** 包装札作成の［印刷］でまとめて出すもの（Access の cmd_印刷 の順） */
const 札のまとめ = ["pallet", "kubun", "shikake", "robot", "renraku"];

function ページたち(props: { k: string; x: Rec }) {
  const { k, x } = props;
  const 二つずつ = (list: Rec[], f: (r: Rec, i: number) => JSX.Element, 枚: number, cls: string) => {
    const pages: Rec[][] = [];
    for (let i = 0; i < list.length; i += 枚) pages.push(list.slice(i, i + 枚));
    return pages.map((p, i) => <div key={i} className={`pv-page land ${cls}`}>{p.map(f)}</div>);
  };
  if (k === "yotei") return <包装予定表 x={x} />;
  if (k === "bunkatsu") return <製造分割予定表 x={x} />;
  if (k === "nisshi") return <>{x.枚.map((r: Rec, i: number) => <包装日誌ページ key={i} r={r} 日={x.日} />)}</>;
  if (k === "check") return <>{x.枚.map((r: Rec, i: number) => <数量チェック表ページ key={i} r={r} 日={x.日} 人={x.人} />)}</>;
  if (k === "pallet") return <>{二つずつ(x.票, (r, i) => <パレット票 key={i} r={r} />, 2, "hz-pallet")}</>;
  // 区分表示は 1 枚に同じものを 2 つ、仕掛札は 4 つ（見本と同じ）
  if (k === "kubun") return <>{x.札.map((r: Rec, i: number) => <div key={i} className="pv-page land hz-kubun"><区分表示 r={r} /><区分表示 r={r} /></div>)}</>;
  if (k === "shikake") return <>{x.札.map((r: Rec, i: number) => <div key={i} className="pv-page land hz-shikake">{[0, 1, 2, 3].map((j) => <仕掛札 key={j} r={r} />)}</div>)}</>;
  if (k === "robot") return <ロボット確認表 x={x} />;
  if (k === "renraku") return <包装連絡表 x={x} />;
  return null;
}

/** 包装場の帳票（/housou/chohyo?date=…&k=…）。k に「fuda」を渡すと包装札作成の［印刷］のまとめ */
export function HousouChohyo() {
  const nav = useNavigate();
  const [sp, setSp] = useSearchParams();
  const [日, set日] = useState(sp.get("date") ?? today());
  const [選んだ, set選んだ] = useState<string[]>(sp.get("k") === "fuda" ? 札のまとめ : sp.get("k") ? sp.get("k")!.split(",") : []);
  const [作業場, set作業場] = useState("");
  const [中身, set中身] = useState<Record<string, Rec>>({});
  useEffect(() => {
    set中身({});
    (async () => {
      const out: Record<string, Rec> = {};
      for (const k of 選んだ) {
        try {
          out[k] = await api.get<Rec>(`/api/housou/chohyo/${k}`, { date: 日, ...(k === "shikake" && 作業場 ? { sagyo: 作業場 } : {}) });
        } catch (e) {
          エラー(e);
        }
      }
      set中身(out);
    })();
    setSp({ date: 日, ...(選んだ.length === 1 ? { k: 選んだ[0] } : {}) }, { replace: true });
  }, [日, 選んだ.join(","), 作業場]);
  const 日を足す = (k: number) => {
    const x = new Date(Date.parse(日 + "T00:00:00Z") + k * 86400000).toISOString().slice(0, 10);
    set日(x);
  };
  const 件数 = 選んだ.reduce((a, k) => a + (中身[k] ? 1 : 0), 0);
  return (
    <div className="pv">
      <div className="pv-bar hz-bar">
        <b>包装場の帳票</b>
        <button onClick={() => 日を足す(-1)}>◀</button>
        <input type="date" value={日} onChange={(e) => e.target.value && set日(e.target.value)} />
        <button onClick={() => 日を足す(1)}>▶</button>
        {["包装管理日誌", "包装札作成"].map((g) => (
          <Fragment key={g}>
            <span className="grp">{g}</span>
            {帳票.filter((x) => x.組 === g).map((x) => (
              <button key={x.k} className={選んだ.length === 1 && 選んだ[0] === x.k ? "on" : ""} onClick={() => set選んだ([x.k])}>{x.名}</button>
            ))}
          </Fragment>
        ))}
        <button className={選んだ.length > 1 ? "on" : ""} onClick={() => set選んだ(札のまとめ)} title="パレット票・区分表示・仕掛原料管理札・ロボットパレット引き出し確認表・包装連絡表（Access の包装札作成の［印刷］）">包装札一式</button>
        {選んだ.includes("shikake") && (
          <select value={作業場} onChange={(e) => set作業場(e.target.value)} title="仕掛原料管理札の工場">
            <option value="">仕掛札：全部</option><option value="1工場">仕掛札：ソテー（1工場）</option><option value="2工場">仕掛札：ペースト（2工場）</option>
          </select>
        )}
        <span className="sp" />
        <button onClick={() => window.print()} disabled={!件数}>印刷</button>
        <button onClick={() => nav(-1)}>閉じる</button>
      </div>
      <div className="pv-pages">
        {!選んだ.length && <div className="pv-none">上の帳票を選んでください</div>}
        {選んだ.map((k) => (中身[k] ? <ページたち key={k} k={k} x={中身[k]} /> : null))}
      </div>
    </div>
  );
}
