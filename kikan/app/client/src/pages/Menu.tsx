import { useNavigate } from "react-router-dom";
import { api } from "../api";
import type { User } from "../main";

// 受注管理のメニュー（Access の FM_メインメニュー）。まだ作っていない画面は「準備中」を開く。
// 受注日報・売上日報・日本食研web確認表・伝票発行は、社内で「移さない」と決めたので載せない（09_必要な機能と帳票.md。伝票発行は受注検索の「印刷」で代わりにする）。
const sections: { title: string; items: { label: string; to: string }[] }[] = [
  { title: "受注管理", items: [
  { label: "受注登録", to: "/juchu/select" },
  { label: "受注検索", to: "/juchu/search" },
  { label: "販盛受注取込み", to: "/form/F_販盛インポート" },
  { label: "販盛売上出力", to: "/form/F_販盛インポート売上" },
  { label: "単価チェック", to: "/form/F_販盛単価確認" },
  { label: "SB受注取り込み", to: "/form/F_エスビー受注インポート" },
  { label: "発注依頼", to: "/form/F_受注元選択" },
  { label: "特定商品表示", to: "/form/FM_特定商品表示" },
  { label: "受注グループマスタ", to: "/form/FM_受注先マスタ登録" },
  { label: "相手先届け先マスタ", to: "/juchu/aite-todoke" },
  { label: "相手先商品マスタ", to: "/juchu/aite" },
  ] },
  // 丸北WorkStation（Access の WorkStation のメインメニュー）。作ったものから足していく
  { title: "丸北WorkStation", items: [{ label: "出荷明細票", to: "/ws" }, { label: "在庫表", to: "/ws/zaikohyo" }, { label: "保管庫詳細", to: "/ws/hokan" }, { label: "出荷停止在庫", to: "/ws/teishi" }, { label: "検査結果登録", to: "/ws/kensa" }, { label: "検査待ち在庫", to: "/ws/kensamachi" }, { label: "サンプル登録", to: "/ws/sample" }, { label: "在庫確認（パレット）", to: "/ws/zpallet" }, { label: "パレット配置図", to: "/ws/haichi" }, { label: "相手先商品", to: "/ws/aite" }, { label: "相手先届け先", to: "/ws/aite-todoke" }, { label: "集荷先パレット設定", to: "/ws/shuka-pallet" }, { label: "商品使用予定数入力", to: "/ws/stock" }, { label: "大阪受注登録", to: "/ws/osaka" }, { label: "出荷抽出帳票", to: "/ws/shukkachu" }, { label: "輸送抽出帳票", to: "/ws/yusochu" }, { label: "在庫抽出帳票", to: "/ws/zaikochu" }, { label: "名義運賃振分設定", to: "/master/user" }, { label: "在庫更新", to: "/ws/koshin" }, { label: "日別の在庫", to: "/ws/hibetsu" }, { label: "パレット輸送割付", to: "/ws/pallet" }] },
  // 製造管理 丸北（Access の 製造管理 丸北.accdb のメニュー）
  { title: "製造管理　丸北", items: [{ label: "製造管理メニュー", to: "/seizo" }, { label: "丸北 計量枚数登録", to: "/seizo/dekidaka" }, { label: "丸北 包装日誌登録", to: "/seizo/hoso" }, { label: "包装予定追加", to: "/seizo/yotei" }, { label: "他工場 計量日誌登録", to: "/seizo/tako" }, { label: "他工場 包装日誌登録", to: "/seizo/hoso?soko=191" }, { label: "取引先商品製造一覧", to: "/seizo/kensaku" }] },
  // 包装場管理System（Access の 包装場管理System.accdb。作っている途中）
  { title: "包装場管理", items: [{ label: "包装準備", to: "/housou/junbi" }, { label: "ロボットハイ積みマスタ", to: "/housou/robot" }] },
  // 手配出力用カレンダー（Access の 手配出力用カレンダー.accdb）
  { title: "手配出力用カレンダー", items: [{ label: "配送予定カレンダー", to: "/tehai" }] },
  // 倉庫管理System（Access の 倉庫管理System.accdb。外の冷蔵庫の在庫・出庫・名義変更・保管料）
  { title: "倉庫管理System", items: [{ label: "倉庫管理メニュー", to: "/soko" }, { label: "入庫登録(ｲﾝﾎﾟｰﾄ)", to: "/soko/nyuko" }, { label: "在庫抽出帳票", to: "/soko/zaikochu" }, { label: "出庫抽出帳票", to: "/soko/shukkachu" }] },
  // 製造計画（Access の 製造計画.accdb のメニュー）
  { title: "製造計画", items: [{ label: "生産計画インポート", to: "/keikaku" }, { label: "変更内容確認", to: "/keikaku/henko" }, { label: "製造カレンダー確認", to: "/keikaku/calendar" }, { label: "変更履歴表示", to: "/keikaku/log" }] },
  // マスタ管理（Access の「Accessマスタ管理」）
  { title: "マスタ管理", items: [{ label: "商品マスタ", to: "/master/shohin" }, { label: "得意先マスタ", to: "/master/tokui" }, { label: "運送会社マスタ", to: "/master/unso" }, { label: "ユーザーマスタ", to: "/master/user" }, { label: "ユーザーマスタ未設定", to: "/master/misettei" }, { label: "カレンダー設定", to: "/master/calendar" }, { label: "古いデータを消す", to: "/master/sakujo" }, { label: "マスタ選択", to: "/master" }] },
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
      {sections.map((sec) => (
        <section key={sec.title}>
          <h2 className="menu-sec">{sec.title}</h2>
          <div className="menu-grid">
            {sec.items.map((i) => (
              <button key={i.label} onClick={() => nav(i.to)}>
                {i.label}
              </button>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
