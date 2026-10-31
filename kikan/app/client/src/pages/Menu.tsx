import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api";
import { today, PageClose } from "../formParts";
import type { User } from "../main";

// 基幹システムのメインメニュー（2026/10/28 利用者：いただいた画面のボタン 12 個を仮のメインにする）。
// 各ボタンから、それぞれのメニュー画面に移る。to のないもの（白いボタン）は Web 版にまだ入れていない。
const ボタン: { label: string; to?: string }[] = [
  { label: "製造計画", to: "/keikaku" },
  { label: "受注登録", to: "/juchu" },
  { label: "倉庫管理", to: "/soko" },
  { label: "マスタ管理", to: "/master" },
  { label: "製造管理", to: "/seizo" },
  { label: "丸北管理", to: "/maruhoku" },
  { label: "原料管理" },
  { label: "商品推移", to: "/suii" },
  { label: "包装場管理", to: "/housou" },
  { label: "仕掛管理" },
  { label: "WEB連携", to: "/web" },
  { label: "丸北　輸送管理" },
];

export default function Menu({ user, onLogout }: { user: User; onLogout: () => void }) {
  const nav = useNavigate();
  return (
    <div className="menu">
      <header>
        <h1>基幹システム</h1>
        <span className="who">
          {user.name} さん
          <button
            onClick={async () => {
              await api.post("/api/logout");
              onLogout();
            }}
          >
            ログアウト
          </button>
        </span>
      </header>
      <div className="top-grid">
        {ボタン.map((b) => (
          <button key={b.label} className={b.to ? "" : "mada"} disabled={!b.to} title={b.to ? "" : "Web 版にはまだ入れていません"} onClick={() => b.to && nav(b.to)}>
            {b.label}
          </button>
        ))}
      </div>
      <div className="top-other">
        ほかの画面：<button onClick={() => nav("/tehai")}>配送予定カレンダー（手配出力用カレンダー）</button>
      </div>
    </div>
  );
}

type 項目 = { label: string; to?: string; 説明?: string };

/**
 * 受注管理のメニュー（Access の 受注管理 のメニュー）。いただいた画面のボタンのうち、
 * 使っていない画面（伝票発行・受注日報・日本食研受注確認表。09_必要な機能と帳票.md で「移さない」）は載せない。
 * to のないものは Web 版にまだ入れていない。
 */
export function JuchuMenu() {
  const nav = useNavigate();
  const 左: 項目[] = [
    { label: "発注依頼", to: "/form/F_受注元選択" },
    { label: "受注登録", to: "/juchu/select" },
    { label: "受注検索", to: "/juchu/search" },
    { label: "相手先商品マスタ", to: "/juchu/aite" },
    { label: "相手先届け先マスタ", to: "/juchu/aite-todoke" },
    { label: "受注グループマスタ", to: "/form/FM_受注先マスタ登録" },
    { label: "特定商品表示", to: "/form/FM_特定商品表示" },
  ];
  const 右: 項目[] = [
    { label: "販盛 受注取込処理", to: "/form/F_販盛インポート" },
    { label: "販盛 売上出力処理", to: "/form/F_販盛インポート売上" },
    { label: "SB受注取り込み", to: "/form/F_エスビー受注インポート" },
    { label: "食研HD愛媛 受注取込" },
    { label: "販盛単価確認", to: "/form/F_販盛単価確認" },
    { label: "ランテック2か月以上未配達リスト" },
  ];
  const ボタン = (x: 項目) => (
    <button key={x.label} className={x.to ? "" : "mada"} disabled={!x.to} title={x.to ? "" : "Web 版にはまだ入れていません"} onClick={() => x.to && nav(x.to)}>
      {x.label}
    </button>
  );
  return (
    <div className="jkm">
      <div className="jkm-head">
        <div className="jkm-title">受注管理</div>
        <PageClose onClick={() => nav("/")} />
      </div>
      <div className="jkm-body">
        <div className="jkm-col">{左.map(ボタン)}</div>
        <div className="jkm-col right">{右.map(ボタン)}</div>
      </div>
    </div>
  );
}

/**
 * 丸北管理（Access の 丸北WorkStation の FM_メインメニュー）。受注・出荷・在庫・情報管理のタブ。
 * 一覧のあるボタン（Access の F_処理選択。T_画面一覧 の分類）は、押すと左に画面の一覧を出し、そこから開く。
 * 住所録（分類 630）は個人の情報のため移さない。オートナンバー修正・データ出力（ファイルへの書き出し）は Web 版では要らない。
 */
type WsBtn = { label: string; to?: string; 一覧?: 項目[] };
const WSタブ: { k: string; 名: string; ボタン: WsBtn[] }[] = [
  {
    k: "juchu",
    名: "受注",
    ボタン: [
      { label: "大阪受注登録", to: "/ws/osaka" },
      { label: "印刷", 一覧: [{ label: "大阪発注割振り(製造分)" }, { label: "大阪発注割振り(在庫)" }] },
      { label: "道内ストック表示設定", to: "/ws/stock" },
    ],
  },
  {
    k: "shukka",
    名: "出荷",
    ボタン: [
      {
        label: "出荷登録",
        一覧: [{ label: "出荷登録", to: "/ws" }, { label: "積荷情報" }, { label: "入庫依頼書確認用" }, { label: "elixxi入庫登録", to: "/web/elixxi-nyuko" }],
      },
      { label: "回送積込確認書作成", to: "/ws/pallet" },
      { label: "検索", 一覧: [{ label: "出荷抽出帳票", to: "/ws/shukkachu" }, { label: "輸送抽出帳票", to: "/ws/yusochu" }] },
      { label: "ニチレイ入庫リスト", to: "/ws/nyuko-list" },
    ],
  },
  {
    k: "zaiko",
    名: "在庫",
    ボタン: [
      {
        label: "在庫登録",
        一覧: [
          { label: "在庫表示・印刷", to: "/ws/zaikohyo" },
          { label: "在庫表示詳細・印刷", to: "/ws/hokan" },
          { label: "サンプル登録", to: "/ws/sample" },
          { label: "検査結果登録", to: "/ws/kensa" },
          { label: "検査待ち在庫", to: "/ws/kensamachi" },
          { label: "出荷停止在庫確認", to: "/ws/teishi" },
          { label: "日別の在庫", to: "/ws/hibetsu" },
        ],
      },
      { label: "在庫確認", to: "/ws/zpallet" },
      { label: "パレット配置図", to: "/ws/haichi" },
      { label: "検索", 一覧: [{ label: "在庫抽出帳票", to: "/ws/zaikochu" }] },
    ],
  },
  {
    k: "joho",
    名: "情報管理",
    ボタン: [
      { label: "在庫更新", to: "/ws/koshin" },
      { label: "得意先マスタ", to: "/master/tokui" },
      { label: "商品マスタ", to: "/master/shohin" },
      { label: "運送会社マスタ", to: "/master/unso" },
      {
        label: "出荷のマスタ",
        一覧: [
          { label: "相手先科目マスタ", to: "/ws/aite" },
          { label: "相手先届け先", to: "/ws/aite-todoke" },
          // 集荷先パレット設定はメニューから外す（2026/10/28 利用者の依頼。画面と設定のデータは残す）
        ],
      },
      { label: "名義運賃振分設定", to: "/master/user" },
    ],
  },
];

export function WsMenu() {
  const nav = useNavigate();
  const [タブ, setタブ] = useState(() => sessionStorage.getItem("ws-menu-tab") ?? "shukka");
  const [一覧, set一覧] = useState<WsBtn | null>(null);
  const 今 = WSタブ.find((t) => t.k === タブ) ?? WSタブ[1];
  function 押す(b: WsBtn) {
    if (b.一覧) set一覧(b);
    else if (b.to) nav(b.to);
  }
  return (
    <div className="wm">
      <div className="wm-head">
        <div className="wm-title">丸北管理　ワークステーション</div>
        <div className="wm-co">丸北北海道</div>
        <button className="wm-nenkan" onClick={() => nav("/ws/nenkan")}>年間受注</button>
      </div>
      <div className="wm-body">
        <div className="wm-side">
          {一覧 && (
            <>
              {一覧.一覧!.map((x) => (
                <button key={x.label} className={x.to ? "" : "mada"} disabled={!x.to} title={x.to ? "" : "Web 版にはまだ入れていません"} onClick={() => x.to && nav(x.to)}>
                  {x.label}
                </button>
              ))}
              <button className="wm-close" onClick={() => set一覧(null)}>閉じる</button>
            </>
          )}
        </div>
        <div className="wm-main">
          <div className="sz-tabs">
            {WSタブ.map((t) => (
              <button
                key={t.k}
                className={タブ === t.k ? "on" : ""}
                onClick={() => {
                  setタブ(t.k);
                  set一覧(null);
                  try {
                    sessionStorage.setItem("ws-menu-tab", t.k);
                  } catch {
                    /* 覚えられなくてもよい */
                  }
                }}
              >
                {t.名}
              </button>
            ))}
          </div>
          <div className="wm-page">
            {今.ボタン.map((b) => (
              <button key={b.label} className={(b.to || b.一覧 ? "" : "mada") + (一覧 === b ? " on" : "")} disabled={!b.to && !b.一覧} onClick={() => 押す(b)}>
                {b.label}
              </button>
            ))}
          </div>
        </div>
      </div>
      <PageClose onClick={() => nav("/")} label="終　了" />
    </div>
  );
}

type Rec = Record<string, any>;
const 曜 = "日月火水木金土";
const 日を足す = (d: string, k: number) => new Date(Date.parse(d + "T00:00:00Z") + k * 86400000).toISOString().slice(0, 10);

/**
 * 包装場管理のメニュー（Access の 包装場管理System の F_包装管理日誌「帳票管理」）。いただいた画面のボタンの並び。
 * 上の一覧は「生産登録状況」（FS_出来高入力状況：製造日がその日の工場の入庫。Access は今日に決まっていたが、Web 版は画面の日付）。
 * to のないもの（白いボタン）は Web 版にまだ入れていない。
 */
export function HousouMenu() {
  const nav = useNavigate();
  const [日, set日] = useState(() => {
    try {
      return sessionStorage.getItem("housou-menu-date") ?? today();
    } catch {
      return today();
    }
  });
  const [rows, setRows] = useState<Rec[] | null>(null);
  useEffect(() => {
    try {
      sessionStorage.setItem("housou-menu-date", 日);
    } catch {
      /* 覚えられなくてもよい */
    }
    setRows(null);
    api.get<Rec[]>("/api/housou/menu", { date: 日 }).then(setRows, () => setRows([]));
  }, [日]);
  const d = new Date(日 + "T00:00:00");
  const ボタン = (label: string, to?: string, cls = "") => (
    <button key={label} className={cls + (to ? "" : " mada")} disabled={!to} title={to ? "" : "Web 版にはまだ入れていません"} onClick={() => to && nav(to)}>
      {label}
    </button>
  );
  const 帳票 = (k: string) => `/housou/chohyo?date=${日}&k=${k}`;
  return (
    <div className="hgm">
      <div className="hgm-date">
        <button onClick={() => set日(日を足す(日, -1))}>◀</button>
        <span>{`${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日(${曜[d.getDay()]})`}</span>
        <button onClick={() => set日(日を足す(日, 1))}>▶</button>
        <PageClose onClick={() => nav("/")} />
      </div>
      <div className="hgm-up">
        <div className="hgm-list">
          <div className="hgm-list-head">
            <span className="hgm-lbl">生産登録状況</span>
            <span className="hgm-day">{日.slice(2).replace(/-/g, "/")}</span>
          </div>
          <table>
            <thead>
              <tr><th>順</th><th>商品名</th><th>区分</th><th>ケース</th><th>ﾊﾟﾚﾀｲｻﾞｰNo</th></tr>
            </thead>
            <tbody>
              {(rows ?? []).map((r) => (
                <tr key={r.入庫ID}>
                  <td className="c">{r.包装順 ?? ""}</td>
                  <td>{r.商品名}</td>
                  <td className="c">{r.タグ}</td>
                  <td className="r">{r.ケース}</td>
                  <td className="r">{r.ロボットPrgNo ?? 0}</td>
                </tr>
              ))}
              {rows && rows.length === 0 && <tr><td colSpan={5} className="c">この日の製造はありません。</td></tr>}
            </tbody>
          </table>
        </div>
        <div className="hgm-right">
          {ボタン("カレンダー　登録", undefined, "navy")}
          <div className="hgm-gap" />
          {ボタン("Google連携用カレンダー出力(csv)", undefined, "sky")}
          {ボタン("包装予定表　印刷", 帳票("yotei"), "green")}
          {ボタン("ふらのパレット使用予定", undefined, "green")}
        </div>
      </div>
      <div className="hgm-low">
        <div className="hgm-col">
          {ボタン("包装札　印刷設定", `/housou/junbi?date=${日}`, "navy")}
          {ボタン("包装時間　登録", "/housou/jikan", "navy")}
          {ボタン("Oxpa取込み(パレタイザー)", undefined, "navy")}
        </div>
        <div className="hgm-col">
          {ボタン("包装日誌印刷", 帳票("check,nisshi,bunkatsu"), "green")}
          {ボタン("製品在庫表　印刷", 帳票("zaiko,sample"), "green")}
          {ボタン("無地　包装札印刷", undefined, "green")}
          {ボタン("無地　仕掛札印刷", undefined, "green")}
        </div>
        <div className="hgm-col">{ボタン("分割予定表", 帳票("bunkatsu"), "blue")}</div>
      </div>
      <div className="hgm-other">
        ほかの画面：
        <button onClick={() => nav("/housou/robot")}>ロボットハイ積みマスタ</button>
        <button onClick={() => nav(`/housou/chohyo?date=${日}`)}>包装場の帳票（ぜんぶ）</button>
      </div>
    </div>
  );
}
