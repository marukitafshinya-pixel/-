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
  ] },
  // 丸北WorkStation（Access の WorkStation のメインメニュー）。作ったものから足していく
  { title: "丸北WorkStation", items: [{ label: "出荷明細票", to: "/ws" }] },
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
