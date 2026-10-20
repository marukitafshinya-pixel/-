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

-- 受注検索の「受注元」ボタン。Access の画面の設計に入っている値なので、ここで持つ。
-- 値の意味：0＝全部、629＝本社受注（大阪）、-2＝その他（ほかのボタンに載っていない受注元。本社受注は除く）、それ以外＝受注元ID。
-- ※ 直す画面ができるまでは、起動のたびにこの内容に戻す。
CREATE TABLE IF NOT EXISTS app."受注検索_受注元ボタン" (
  並び     INTEGER PRIMARY KEY,
  表示名   TEXT NOT NULL,
  値       INTEGER NOT NULL,
  要確認   BOOLEAN NOT NULL DEFAULT false
);

DELETE FROM app."受注検索_受注元ボタン";
INSERT INTO app."受注検索_受注元ボタン" (並び, 表示名, 値, 要確認) VALUES
  (1, '日本食研', 360, false),
  (2, '日洋', 350, false),
  (3, '丸大', 6672, false),
  (4, 'SB食品', 357, false),
  (5, '和弘食品', 1237, false),
  (6, 'ふらの', 150, false),
  (7, '冷凍原料', 1095, false),
  (8, '丸北デポ', 1254, false),
  (9, '大阪', 629, false),
  (10, 'その他', -2, false);

-- 発注依頼書（R_発注依頼）の宛先。Access ではプログラムの中に書かれていたもの。
-- 商品コード 0 がふだんの宛先、ほかは商品ごとの宛先。担当者の名前は画面の「宛先の設定」で入れる（ここには書かない）。
-- 起動のたびに消さない（画面で直した内容を残す）。
CREATE TABLE IF NOT EXISTS app."発注依頼書_宛先" (
  "商品コード"    INTEGER PRIMARY KEY,
  "手配依頼先"    TEXT NOT NULL DEFAULT '',
  "仕入先名"      TEXT NOT NULL DEFAULT '',
  "仕入先コード"  TEXT NOT NULL DEFAULT '',
  "返信コメント2" TEXT NOT NULL DEFAULT '',
  "返信コメント3" TEXT NOT NULL DEFAULT ''
);
INSERT INTO app."発注依頼書_宛先" VALUES
  (0, '大阪丸北商事㈱', '大阪丸北商事株式会社　様', '1000710', '尚、出庫手配の返信をFAXお願いします。', ''),
  (75, '株式会社　綾・野菜加工館 御中', '', '', '※確認の為FAXにて返信お願いします。', '  尚、運送便決まり次第、運送の送り状を返信お願いします。'),
  (1163, 'ハーヴィーインターナショナル 御中', '', '', '※確認の為FAXにて返信お願いします。', '  尚、運送便決まり次第、運送の送り状を返信お願いします。')
ON CONFLICT DO NOTHING;
