-- Web 版だけで使う表（利用者・ログイン・設定）。Access から移した表とは別のスキーマ「app」に置く。
CREATE SCHEMA IF NOT EXISTS app;

CREATE TABLE IF NOT EXISTS app.users (
  login       TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  pass_hash   TEXT NOT NULL,
  is_admin    BOOLEAN NOT NULL DEFAULT false,
  disabled    BOOLEAN NOT NULL DEFAULT false,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS app.sessions (
  token       TEXT PRIMARY KEY,
  login       TEXT NOT NULL REFERENCES app.users(login) ON DELETE CASCADE,
  expires_at  TIMESTAMPTZ NOT NULL
);

-- 受注検索の「受注元」ボタン。Access の画面の設計に入っている値なので、ここで直せるようにする。
-- 値の意味は Access の F_受注検索 と同じ：-1＝入庫名義ID<>1、0＝全部、629＝本社受注、それ以外＝受注元ID。
CREATE TABLE IF NOT EXISTS app."受注検索_受注元ボタン" (
  並び     INTEGER PRIMARY KEY,
  表示名   TEXT NOT NULL,
  値       INTEGER NOT NULL,
  要確認   BOOLEAN NOT NULL DEFAULT false
);

INSERT INTO app."受注検索_受注元ボタン" (並び, 表示名, 値, 要確認) VALUES
  (1, '日本食研', 360, false),
  (2, '日洋', 350, false),
  (3, '丸大', 6672, false),
  (4, 'SB食品', 357, false),
  (5, '和弘食品', 1237, false),
  (6, 'ふらの', 150, false),
  (7, '北海道ﾌｰｽﾞ', 1255, true),
  (8, '美瑛ﾌｰｽﾞ', 133, true),
  (9, '冷凍原料', 1095, true),
  (10, '丸北デポ', 1254, false),
  (11, '大阪', 629, false),
  (12, 'その他', -1, true)
ON CONFLICT (並び) DO NOTHING;
