import { useNavigate } from "react-router-dom";
import { api } from "../api";
import type { User } from "../main";

// 受注管理のメニュー（Access の FM_メインメニュー）。まだ作っていない画面は「準備中」を開く。
// 受注日報・売上日報・日本食研web確認表は、社内で「移さない」と決めたので載せない（09_必要な機能と帳票.md）。
const items: { label: string; to: string }[] = [
  { label: "受注登録", to: "/juchu/select" },
  { label: "受注検索", to: "/juchu/search" },
  { label: "販盛受注取込み", to: "/form/F_販盛インポート" },
  { label: "販盛売上出力", to: "/form/F_販盛インポート売上" },
  { label: "単価チェック", to: "/form/F_販盛単価確認" },
  { label: "SB受注取り込み", to: "/form/F_エスビー受注インポート" },
  { label: "発注依頼", to: "/form/F_受注元選択" },
  { label: "伝票発行", to: "/form/F_伝票発行" },
  { label: "特定商品表示", to: "/form/FM_特定商品表示" },
];

export default function Menu({ user, onLogout }: { user: User; onLogout: () => void }) {
  const nav = useNavigate();
  return (
    <div className="menu">
      <header>
        <h1>受注管理</h1>
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
      <div className="menu-grid">
        {items.map((i) => (
          <button key={i.label} onClick={() => nav(i.to)}>
            {i.label}
          </button>
        ))}
      </div>
    </div>
  );
}
