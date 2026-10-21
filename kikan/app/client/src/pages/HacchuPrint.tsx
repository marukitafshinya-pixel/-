import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { api, num } from "../api";

type Row = Record<string, any>;
type 宛先 = {
  商品コード: number; 手配依頼先: string; 仕入先名: string; 仕入先コード: string;
  返信コメント2: string; 返信コメント3: string; 納品指定時間: string;
};
type 発行元 = { 会社名: string; 住所: string; TEL: string; FAX: string };

const 日 = (v: string | null | undefined) => (v ? v.slice(0, 10).replace(/-/g, "/") : "");
/** 郵便番号 "3060606" → "306-0606" */
const 〒 = (v: unknown) => {
  const s = String(v ?? "").trim();
  return /^\d{7}$/.test(s) ? `${s.slice(0, 3)}-${s.slice(3)}` : s;
};

/** 発注書（Access の R_発注依頼）。いただいた見本と同じ並び。A4 横でブラウザから印刷する */
export default function HacchuPrint() {
  const [sp] = useSearchParams();
  const [data, setData] = useState<{ rows: Row[]; 宛先: 宛先[]; 発行元: 発行元 } | null>(null);
  const [edit, setEdit] = useState(false);

  const load = () => api.get<any>("/api/hacchu/report", Object.fromEntries(sp.entries())).then(setData);
  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!data) return null;
  if (data.rows.length === 0)
    return <div className="notyet">対象のデータがありません。参照が正しいか確認してください。</div>;

  // 宛先は Access と同じく、上の宛先は商品コード1、下のコメントは商品コードで選ぶ
  const pick = (code: unknown) => data.宛先.find((a) => a.商品コード === Number(code)) ?? data.宛先.find((a) => a.商品コード === 0)!;
  const h = data.発行元;

  return (
    <div className="print-page">
      <div className="no-print print-bar">
        <button onClick={() => window.print()}>印刷する</button>
        <button onClick={() => setEdit(!edit)}>宛先の設定</button>
        <span className="hint">印刷の画面で「横」を選んでください。</span>
      </div>
      {edit && <AtesakiEdit list={data.宛先} 発行元={h} onSaved={load} />}
      {data.rows.map((r, i) => {
        const head = pick(r.商品コード1);
        const foot = pick(r.商品コード);
        return (
          <div key={r.受注ID} className="hc-sheet">
            <div className="hc-grid">
              <div className="hc-left">
                <div className="hc-to">{head.手配依頼先}</div>
                <div className="hc-code">{head.仕入先コード}</div>
                <div className="hc-name">{head.仕入先名}</div>
                <div className="hc-rule" />
                <div className="hc-rule" />
                <div className="hc-tel">
                  <span>TEL</span>
                  <span>FAX</span>
                </div>
                <div>下記の通り注文します。</div>
              </div>
              <div className="hc-title">発 注 書</div>
              <div className="hc-right">
                <div className="hc-no">
                  <span>No. {i + 1}</span>
                  <span>
                    {i + 1} / {data.rows.length}
                  </span>
                </div>
                <div className="hc-row">
                  <span className="k">発注日</span>
                  <span>{日(r.受注日)}</span>
                </div>
                <div className="hc-row big">
                  <span className="k">納品指定日</span>
                  <span>{日(r.納品日)}</span>
                  <span className="k2">納品指定時間</span>
                  <span>{head.納品指定時間}</span>
                </div>
                <div className="hc-row">
                  <span className="k">納品場所</span>
                  <span className="pad">{r.届け先正式名 ?? r.届け先}</span>
                </div>
                <div className="hc-row">
                  <span className="k">住所</span>
                  <span className="bold">
                    〒 {〒(r.郵便番号)} {r.住所}
                  </span>
                </div>
                <div className="hc-row">
                  <span className="k">TEL</span>
                  <span>{r.電話番号}</span>
                  <span>FAX {r.FAX番号 ?? ""}</span>
                </div>
              </div>
            </div>
            <table className="hc-table">
              <thead>
                <tr>
                  <th style={{ width: "11%" }}>発注No.</th>
                  <th style={{ width: "22%" }}>商品名</th>
                  <th style={{ width: "9%" }}>規格</th>
                  <th style={{ width: "11%" }}>GTINコード</th>
                  <th style={{ width: "10.5%" }}>数量</th>
                  <th style={{ width: "3.5%" }}>単位</th>
                  <th>備考</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className="c big">{r.受注番号}</td>
                  <td className="top">
                    {r.商品名}
                    {Number(r.商品コード) === 1193 && <div>( 珠江・その他         )</div>}
                  </td>
                  <td className="c big">{r.入数 ? `${r.入数}KG` : ""}</td>
                  <td>{r.GTINコード}</td>
                  <td className="r big">{num(r.商品kg)}</td>
                  <td className="c">キロ</td>
                  <td className="memo">
                    <div>製　造　日</div>
                    <div>賞 味 期 限</div>
                  </td>
                </tr>
                <tr className="empty">
                  <td />
                  <td />
                  <td />
                  <td />
                  <td />
                  <td />
                  <td className="top small">以下余白</td>
                </tr>
              </tbody>
            </table>
            <div className="hc-foot">
              <div>出荷手配お願いします。</div>
              {foot.返信コメント2 && <div>{foot.返信コメント2}</div>}
              {foot.返信コメント3 && <div>{foot.返信コメント3}</div>}
            </div>
            <div className="hc-from">
              <div>{h.会社名}</div>
              <div>
                {h.住所}
                {h.TEL && <span>　　TEL: {h.TEL}</span>}
                {h.FAX && <span>　FAX: {h.FAX}</span>}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function AtesakiEdit({ list, 発行元, onSaved }: { list: 宛先[]; 発行元: 発行元; onSaved: () => void }) {
  const [rows, setRows] = useState(list);
  const [h, setH] = useState(発行元);
  const keys: (keyof 宛先)[] = ["手配依頼先", "仕入先名", "仕入先コード", "納品指定時間", "返信コメント2", "返信コメント3"];
  return (
    <div className="no-print atesaki">
      <p>
        発注書の宛先です。商品コード 0 がふだんの宛先、ほかは商品ごとの宛先です。担当者の名前（「○○ 様」）もここに入れてください。
      </p>
      <table>
        <thead>
          <tr>
            <th>商品コード</th>
            {keys.map((k) => (
              <th key={k}>{k}</th>
            ))}
            <th></th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={r.商品コード}>
              <td>{r.商品コード}</td>
              {keys.map((k) => (
                <td key={k}>
                  <input value={String(r[k] ?? "")} onChange={(e) => setRows(rows.map((x, j) => (j === i ? { ...x, [k]: e.target.value } : x)))} />
                </td>
              ))}
              <td>
                <button
                  onClick={async () => {
                    await api.post("/api/hacchu/atesaki", r);
                    onSaved();
                  }}
                >
                  保存
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <p>発注書のいちばん下に出す、自社の名前・住所・電話番号です。</p>
      <div className="hk">
        {(["会社名", "住所", "TEL", "FAX"] as const).map((k) => (
          <label key={k}>
            {k}
            <input value={h[k] ?? ""} onChange={(e) => setH({ ...h, [k]: e.target.value })} />
          </label>
        ))}
        <button
          onClick={async () => {
            await api.post("/api/hacchu/hakkomoto", h);
            onSaved();
          }}
        >
          保存
        </button>
      </div>
    </div>
  );
}
