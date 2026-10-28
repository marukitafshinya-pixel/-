import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { api, ApiError } from "../api";
import { Field, parseDate, PageClose } from "../formParts";
import { ZaikoSentaku } from "./WsZaikoSelect";

type Rec = Record<string, any>;
type 一覧 = { id: number | string; name: string }[];

const 和暦 = (s: string | null | undefined) =>
  s
    ? new Date(s.slice(0, 10) + "T00:00:00").toLocaleDateString("ja-JP-u-ca-japanese", { era: "long", year: "numeric", month: "long", day: "numeric" }) +
      `(${"日月火水木金土"[new Date(s.slice(0, 10) + "T00:00:00").getDay()]})`
    : "";

/**
 * 出荷の明細の詳細（Access の FSD_出荷明細2）。
 * 登録済み（chk）の行は、［訂正］を押してから欄を押すと、理由を選んで直せる（訂正履歴に残る）。
 */
export default function WsDetail() {
  const nav = useNavigate();
  const { id } = useParams();
  const [r, setR] = useState<Rec | null>(null);
  const [ids, setIds] = useState<number[]>([]);
  const [ch, setCh] = useState<Record<string, 一覧>>({});
  const [訂正モード, set訂正モード] = useState(false);
  const [訂正, set訂正] = useState<null | { 項目: string; 別名: string; 前: any; kind?: "date" | "num" }>(null);
  const [bikou, setBikou] = useState(false);
  const [新商品, set新商品] = useState<number | null>(null); // 在庫選択中の商品コード
  const [版, set版] = useState(0); // キャンセルしたとき、打った商品コードを元に戻すため

  const load = () =>
    api.get<{ row: Rec; ids: number[] }>(`/api/ws/detail/${id}`).then((x) => {
      setR(x.row);
      setIds(x.ids);
    });
  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);
  useEffect(() => {
    api.get<any>("/api/ws/detail-choices").then(setCh);
  }, []);

  if (!r) return null;
  const 登録済み = !!r.chk;

  async function save(p: Rec) {
    try {
      // 受注品の届け先を変えるときは、Access と同じく受注ID を入れて確かめる
      if ("届け先コード" in p && r!.受注ID) {
        const ok = prompt(
          `商品名：${r!.商品名} ${r!.ケース} 個\n\n届け先：${r!.届け先}\n\nは受注品です\n\n届け先を変更してよろしいですか？\n良ければ受注IDを入力してください。`,
        );
        if (String(ok ?? "") !== String(r!.受注ID)) return load();
      }
      await api.post("/api/ws/detail/save", { 出庫ID: r!.出庫ID, ...p });
      await load();
    } catch (e) {
      alert(e instanceof ApiError ? e.message : String(e));
      await load();
    }
  }
  const n = (v: string) => (v.trim() === "" ? null : Number(v));
  const 日 = (key: string) => (v: string) => {
    const d = parseDate(v);
    if (d === undefined) return alert("日付の書き方が正しくありません。（例：10/28）");
    save({ [key]: d });
  };

  /** 欄を押したとき：訂正モードなら訂正の画面、そうでなければ何もしない */
  const 訂正する = (項目: string, 別名: string, kind?: "date" | "num") => (訂正モード ? () => set訂正({ 項目, 別名, 前: r![項目], kind }) : undefined);
  const ro = 登録済み; // 登録済みの行は、ふだんは直せない

  const 欄 = (label: string, el: React.ReactNode, cls = "") => (
    <div className={"wd-line " + cls}>
      <span className="lbl">{label}</span>
      {el}
    </div>
  );
  const コード名 = (code: string, name: string, label: string, kyotsu = true) =>
    欄(
      label,
      <div className="wd-pair" onClick={訂正する(code, label, "num")}>
        <Field value={r[code]} kind="num" className="code" kyotsu={kyotsu ? "tokui" : undefined} readOnly={ro || 訂正モード} onCommit={(v) => save({ [code]: n(v) })} />
        <span className="name">{r[name]}</span>
      </div>,
    );
  const 二択 = (key: string, a: [string, any], b: [string, any]) => (
    <div className="toggle2 jf-toggle" onClick={訂正する(key, key)}>
      {[a, b].map(([label, val]) => (
        <button key={label} className={r[key] === val || (val === false && !r[key]) ? "on" : ""} disabled={ro || 訂正モード} onClick={() => save({ [key]: val })}>
          {label}
        </button>
      ))}
    </div>
  );
  const pos = ids.indexOf(r.出庫ID);

  return (
    <div className="wd">
      <div className="tabs">
        <span>メインメニュー</span>
        <span>FM_出荷明細票</span>
        <span className="active">FSD_出荷明細2</span>
      </div>
      <div className="wd-top">
        <span className="lbl">出荷日</span>
        <span className="box w2">{和暦(r.便の出荷日 ?? r.出荷日)}</span>
        <span className="lbl">運送会社名</span>
        <span className="box w2">{r.便の運送会社名}</span>
        <span className="lbl">車番</span>
        <span className="box">{r.便の車番}</span>
        <div className="wd-nav">
          <button onClick={() => nav(`/ws/detail/${ids[pos - 1]}`)} disabled={pos <= 0}>
            ◀
          </button>
          <span>
            {pos + 1} / {ids.length}
          </span>
          <button onClick={() => nav(`/ws/detail/${ids[pos + 1]}`)} disabled={pos >= ids.length - 1}>
            ▶
          </button>
          <button className={"teisei" + (訂正モード ? " on" : "")} onClick={() => {
            if (!訂正モード) alert("訂正モード\n\n訂正する項目を押して下さい。");
            set訂正モード(!訂正モード);
          }}>
            {訂正モード ? "訂正モード解除" : "訂正"}
          </button>
          <button className="del" onClick={async () => {
            const 消す = confirm("このデータを削除しますか？ＯＫなら削除、Cancelなら便からはずします（再読込可能です）。");
            try {
              await api.post("/api/ws/detail/delete", { 出庫ID: r.出庫ID, 消す });
              nav(-1);
            } catch (e) {
              alert(e instanceof ApiError ? e.message : String(e));
            }
          }}>
            削除
          </button>
          <PageClose fallback="/ws" />
        </div>
      </div>
      {登録済み && <div className="wd-note">登録済み（積込確認済み）の明細です。直すときは［訂正］を押してから、直す欄を押してください。</div>}
      <div className="wd-body">
        <div className="wd-col">
          {欄("受注区分", <div className="wd-pair">{二択("本社受注", ["北海道", false], ["大阪丸", true])}<div className="toggle2 jf-toggle">
            <button className={r.サンプル区分 ? "on" : ""} disabled={ro} onClick={() => save({ サンプル区分: !r.サンプル区分 })}>サンプル</button>
            <button className={r.サービス区分 ? "on" : ""} disabled={ro} onClick={() => save({ サービス区分: !r.サービス区分 })}>サービス</button>
          </div></div>)}
          {欄("運賃請求", 二択("運賃請求ID", ["北海道", 1], ["大阪丸", 629]))}
          {欄("商品区分・状態", <div className="wd-pair" onClick={訂正する("商品区分", "商品区分")}>
            <select value={r.商品区分 ?? ""} disabled={ro || 訂正モード} onChange={(e) => save({ 商品区分: n(e.target.value) })}>
              <option value=""></option>
              {(ch.商品区分 ?? []).map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
            </select>
            <Field value={r.商品状態隠語} className="w1s" readOnly={ro || 訂正モード} onCommit={(v) => save({ 商品状態隠語: v || null })} />
          </div>)}
          {欄("コード・商品名", <div className="wd-pair" onClick={訂正する("商品コード", "商品コード", "num")}>
            <Field key={版} value={r.商品コード} kind="num" className="code" kyotsu="shohin" readOnly={ro || 訂正モード} onCommit={(v) => {
              const code = n(v);
              if (code !== null && code !== r.商品コード) set新商品(code);
            }} />
            <span className="name wide">{r.商品名}</span>
          </div>)}
          {欄("規格・入数", <div className="wd-pair"><span className="box">{r.規格}</span><span className="box">{r.入数}</span></div>)}
          {欄("ケース・重量", <div className="wd-pair">
            <span onClick={訂正する("ケース", "ケース", "num")}><Field value={r.ケース} kind="num" className="w1s" readOnly={ro || 訂正モード} onCommit={(v) => save({ ケース: n(v) })} /></span>
            <span>個</span>
            <span onClick={訂正する("商品kg", "商品kg", "num")}><Field value={r.商品kg} kind="num" className="w1s" readOnly={ro || 訂正モード} onCommit={(v) => save({ 商品kg: n(v) })} /></span>
            <span>kg</span>
          </div>)}
          {欄("製造日", <span onClick={訂正する("製造日", "製造日", "date")}><Field value={r.製造日} kind="date" className="w1 blue" readOnly={ro || 訂正モード} onCommit={日("製造日")} /></span>)}
          {欄("賞味期限", <span onClick={訂正する("賞味期限", "賞味期限", "date")}><Field value={r.賞味期限} kind="date" className="w1 redt" readOnly={ro || 訂正モード} onCommit={日("賞味期限")} /></span>)}
          {欄("区分", <span onClick={訂正する("タグ", "区分")}><Field value={r.タグ} className="w1 c" readOnly={ro || 訂正モード} onCommit={(v) => save({ タグ: v || null })} /></span>)}
          {欄("納品日", <span onClick={訂正する("納品日", "納品日", "date")}><Field value={r.納品日} kind="date" className="w1" readOnly={ro || 訂正モード} onCommit={日("納品日")} /></span>)}
          {欄("しらい送り状No", <Field value={r.送り状No} className="w2" readOnly={ro} onCommit={(v) => save({ 送り状No: v || null })} />)}
          {欄("発注No", <Field value={r.ユーザー伝票No} className="w2" readOnly={ro} onCommit={(v) => save({ ユーザー伝票No: v || null })} />)}
        </div>
        <div className="wd-col">
          {欄("受注ID", <span className="box">{r.受注ID || ""}</span>)}
          {欄("受渡区分", 二択("蔵前区分", ["届け", false], ["蔵前渡し", true]))}
          {欄("運賃取扱い区分", <div className="wd-pair" onClick={訂正する("運賃振分区分", "運賃振分区分", "num")}>
            <select value={r.運賃振分区分 ?? ""} disabled={ro || 訂正モード}
              onChange={(e) => save({ 運賃振分区分: n(e.target.value), 運賃振分区分名: (ch.運賃振分区分 ?? []).find((o) => String(o.id) === e.target.value)?.name ?? null })}>
              <option value=""></option>
              {(ch.運賃振分区分 ?? []).map((o) => <option key={o.id} value={o.id}>{o.id} {o.name}</option>)}
            </select>
          </div>)}
          {欄("製造工場", <div className="wd-pair">
            <Field value={r.製造工場ID} kind="num" className="code" kyotsu="tokui" readOnly={ro} onCommit={(v) => save({ 製造工場ID: n(v) })} />
            <span className="name">{r.製造工場名}</span>
          </div>)}
          {欄("美瑛・士幌伝票No", <Field value={r.他工場伝票No} className="w2" readOnly={ro} onCommit={(v) => save({ 他工場伝票No: v || null })} />)}
          {欄("受注No", <Field value={r.参照受注番号} className="w2" readOnly={ro} onCommit={(v) => save({ 参照受注番号: v || null })} />)}
          {欄("原料産地", <select value={r.産地コード ?? ""} disabled={ro} onChange={(e) => save({ 産地コード: n(e.target.value) })}>
            <option value=""></option>
            {(ch.産地 ?? []).map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
          </select>)}
          {欄("受注案内", <Field value={r.受注表題} className="w2" readOnly={ro} onCommit={(v) => save({ 受注表題: v || null })} />)}
          <div className="wd-ninshiki">在庫 {r.認識ID ?? ""}</div>
        </div>
      </div>
      <div className="wd-codes">
        <div className="wd-col">
          {コード名("取引元ID", "取引元", "取引先グループ")}
          {コード名("取引帳合ID", "取引帳合", "取引先")}
          {コード名("届け先コード", "届け先", "納品場所")}
          {コード名("入庫後名義ID", "入庫後名義名", "入庫後名義")}
        </div>
        <div className="wd-col">
          {コード名("手配元ID", "手配元", "依頼主")}
          {コード名("手配帳合ID", "手配帳合", "帳合先")}
          {コード名("倉庫ID", "倉庫名", "出荷場所")}
          {コード名("入庫前名義ID", "入庫前名義名", "入庫前名義")}
        </div>
      </div>
      <div className="wd-memo">
        <div className="wd-mcol">
          <div className="wd-btns">
            <button disabled={ro} onClick={() => setBikou(true)}>備考検索</button>
            <label>
              <input type="checkbox" checked={!!r.入庫備考} disabled={ro} onChange={(e) => save({ 入庫備考: e.target.checked })} />
              入庫依頼書に出す
            </label>
          </div>
          <textarea key={`b${r.出庫ID}${r.備考 ?? ""}`} defaultValue={r.備考 ?? ""} disabled={ro}
            onBlur={(e) => e.target.value !== (r.備考 ?? "") && save({ 備考: e.target.value || null })} />
        </div>
        <div className="wd-mcol">
          <span className="lbl">社内連絡</span>
          <textarea key={`s${r.出庫ID}${r.社内連絡 ?? ""}`} defaultValue={r.社内連絡 ?? ""} disabled={ro}
            onBlur={(e) => e.target.value !== (r.社内連絡 ?? "") && save({ 社内連絡: e.target.value || null })} />
        </div>
      </div>
      {新商品 !== null && (
        <ZaikoSentaku
          出庫ID={r.出庫ID}
          商品コード={新商品}
          倉庫ID={r.倉庫ID ?? 0}
          onDone={async () => {
            set新商品(null);
            await load();
            set版(版 + 1);
          }}
        />
      )}
      {訂正 && (
        <TeiseiDialog
          {...訂正}
          科目={ch.訂正科目 ?? []}
          onClose={() => set訂正(null)}
          onSave={async (値, 科目ID, 特記事項) => {
            try {
              await api.post("/api/ws/detail/correct", { 出庫ID: r.出庫ID, 項目: 訂正.項目, 別名: 訂正.別名, 値, 科目ID, 特記事項 });
              set訂正(null);
              await load();
            } catch (e) {
              alert(e instanceof ApiError ? e.message : String(e));
            }
          }}
        />
      )}
      {bikou && (
        <div className="modal" onClick={() => setBikou(false)}>
          <div className="find" onClick={(e) => e.stopPropagation()}>
            <div className="find-head">備考欄選択（押すと備考の後ろに足します）<button onClick={() => setBikou(false)}>やめる</button></div>
            <div className="find-list">
              <table>
                <tbody>
                  {(ch.備考欄 ?? []).map((o: any) => (
                    <tr key={o.id} onClick={() => {
                      setBikou(false);
                      if (confirm("備考を挿入しますがよろしいですか?")) save({ 備考: `${r.備考 ?? ""}${o.name}` });
                    }}>
                      <td className="sub">{o.分類}</td>
                      <td className="sub">{o.作業分類}</td>
                      <td>{o.name}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/** 訂正の画面（Access の F_訂正画面）。理由を選び、新しい値を入れる */
function TeiseiDialog(props: {
  項目: string; 別名: string; 前: any; kind?: "date" | "num"; 科目: 一覧;
  onClose: () => void; onSave: (値: any, 科目ID: number, 特記事項: string) => void;
}) {
  const [科目ID, set科目ID] = useState(0);
  const [値, set値] = useState("");
  const [特記, set特記] = useState("");
  const 前 = props.kind === "date" && props.前 ? String(props.前).slice(0, 10).replace(/-/g, "/") : props.前 ?? "";
  return (
    <div className="modal" onClick={props.onClose}>
      <div className="find teisei-dlg" onClick={(e) => e.stopPropagation()}>
        <div className="find-head">{props.別名} を訂正します</div>
        <div className="td-body">
          <label>
            訂正理由
            <select value={科目ID} onChange={(e) => set科目ID(Number(e.target.value))}>
              <option value={0}>（選んでください）</option>
              {props.科目.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
            </select>
          </label>
          <div>訂正前：<b>{String(前)}</b></div>
          <label>
            訂正後
            <input value={値} onChange={(e) => set値(e.target.value)} disabled={!科目ID} placeholder={props.kind === "date" ? "例：10/28" : ""} />
          </label>
          {科目ID === 5 && (
            <label>
              特記事項
              <input value={特記} onChange={(e) => set特記(e.target.value)} />
            </label>
          )}
        </div>
        <div className="td-btns">
          <button
            onClick={() => {
              if (!科目ID) return alert("訂正理由を選択して下さい。");
              let v: any = 値.trim() === "" ? null : 値;
              if (props.kind === "date" && v !== null) {
                const d = parseDate(v);
                if (d === undefined) return alert("日付の書き方が正しくありません。（例：10/28）");
                v = d;
              } else if (props.kind === "num" && v !== null) v = Number(v);
              if (!confirm(`${props.別名}\n${String(前)} → ${値} に変更します。\nよろしいですか？`)) return;
              props.onSave(v, 科目ID, 特記);
            }}
          >
            登録
          </button>
          <button onClick={() => confirm("訂正処理をキャンセルしますが、よろしいですか？") && props.onClose()}>キャンセル</button>
        </div>
      </div>
    </div>
  );
}
