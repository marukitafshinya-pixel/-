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
ALTER TABLE app."発注依頼書_宛先" ADD COLUMN IF NOT EXISTS "納品指定時間" TEXT NOT NULL DEFAULT '';
INSERT INTO app."発注依頼書_宛先" ("商品コード", "手配依頼先", "仕入先名", "仕入先コード", "返信コメント2", "返信コメント3", "納品指定時間") VALUES
  (0, '大阪丸北商事㈱', '大阪丸北商事株式会社　様', '1000710', '尚、出庫手配の返信をFAXお願いします。', '', 'AM必着'),
  (75, '株式会社　綾・野菜加工館 御中', '', '', '※確認の為FAXにて返信お願いします。', '  尚、運送便決まり次第、運送の送り状を返信お願いします。', ''),
  (1163, 'ハーヴィーインターナショナル 御中', '', '', '※確認の為FAXにて返信お願いします。', '  尚、運送便決まり次第、運送の送り状を返信お願いします。', '')
ON CONFLICT DO NOTHING;

-- 発注依頼書の下に出す、発行元（自社）の名前・住所・電話。画面の「宛先の設定」で入れる（ここには書かない）。
CREATE TABLE IF NOT EXISTS app."発注依頼書_発行元" (
  "番号"   INTEGER PRIMARY KEY DEFAULT 1 CHECK ("番号" = 1),
  "会社名" TEXT NOT NULL DEFAULT '',
  "住所"   TEXT NOT NULL DEFAULT '',
  "TEL"    TEXT NOT NULL DEFAULT '',
  "FAX"    TEXT NOT NULL DEFAULT ''
);
INSERT INTO app."発注依頼書_発行元" ("番号") VALUES (1) ON CONFLICT DO NOTHING;

-- 画面の動きで使う決めごと（文言など）。プログラムに書かず、ここに入れる。起動のたびに消さない。
-- 寿預かりの備考：入庫後名義を 658 にしたとき、備考に足す一文（Access ではプログラムに書かれていた。人の名前を含むので、ここで入れる）
CREATE TABLE IF NOT EXISTS app."設定" (
  "名前" TEXT PRIMARY KEY,
  "値"   TEXT NOT NULL DEFAULT ''
);
INSERT INTO app."設定" ("名前", "値") VALUES ('寿預かりの備考', '') ON CONFLICT DO NOTHING;

-- 入庫依頼書・出荷通知書・送品案内書に出す差出人（Access ではレポートの中に書かれていたもの）。
-- 名義・扱いで 4 つを使い分ける。住所・電話は画面の「差出人の設定」で入れる（ここには書かない）。起動のたびに消さない。
CREATE TABLE IF NOT EXISTS app."帳票_差出人" (
  "区分"   TEXT PRIMARY KEY,
  "並び"   INTEGER NOT NULL DEFAULT 0,
  "社名"   TEXT NOT NULL DEFAULT '',
  "店舗"   TEXT NOT NULL DEFAULT '',
  "住所"   TEXT NOT NULL DEFAULT '',
  "TEL"    TEXT NOT NULL DEFAULT '',
  "FAX"    TEXT NOT NULL DEFAULT ''
);
INSERT INTO app."帳票_差出人" ("区分", "並び", "社名") VALUES
  ('丸北北海道', 1, '㈱丸北北海道'),
  ('丸北', 2, '㈱　丸　北'),
  ('ふらの', 3, 'ふらの農業協同組合'),
  ('大阪丸北', 4, '大阪丸北商事㈱')
ON CONFLICT DO NOTHING;
-- 輸送依頼書の注意書きの連絡先（Access ではレポートに人の名前が書かれていた。ここで入れる）
INSERT INTO app."設定" ("名前", "値") VALUES ('輸送依頼書の連絡先', '') ON CONFLICT DO NOTHING;

-- 日付ごとの在庫の控え（利用者の依頼 2026/10/22：過去の在庫や、保管庫ごとの量を見るため）。
-- 在庫更新・日時更新のたびに、その日の在庫（在庫ケースが 0 でない行）を 入庫日・倉庫ID・商品コード ごとにまとめて書き直す。前の日の分は消さずに貯める。
CREATE TABLE IF NOT EXISTS ws."TD_在庫日別集計" (
  "集計日"     DATE NOT NULL,
  "入庫日"     DATE,
  "倉庫ID"     INTEGER,
  "商品コード" INTEGER,
  "ケース"     INTEGER NOT NULL DEFAULT 0,
  "商品kg"     DOUBLE PRECISION NOT NULL DEFAULT 0,
  "更新時間"   TEXT
);
CREATE INDEX IF NOT EXISTS "TD_在庫日別集計_集計日" ON ws."TD_在庫日別集計" ("集計日", "倉庫ID");
-- どのシステムの在庫か（ws＝WorkStation の在庫、soko＝倉庫管理の在庫：外の冷蔵庫。パレット積載許容数で埋まり具合を見るため 2026/10/22）
ALTER TABLE ws."TD_在庫日別集計" ADD COLUMN IF NOT EXISTS "システム" TEXT NOT NULL DEFAULT 'ws';

-- 探すための索引（Access から移した表には索引がないので、よく使う項目に付ける。2026/10/22）
-- 表がまだないとき（取り込み前・見本版の一部）は飛ばす
DO $$
DECLARE
  x text[];
  ix text[] := ARRAY[
    'ws|TD_出荷|出庫ID', 'ws|TD_出荷|輸送ID', 'ws|TD_出荷|在庫ID', 'ws|TD_出荷|受注ID', 'ws|TD_出荷|入庫ID', 'ws|TD_出荷|出荷日', 'ws|TD_出荷|届け先コード',
    'soko|TD_出荷|出庫ID', 'soko|TD_出荷|輸送ID', 'soko|TD_出荷|在庫ID', 'soko|TD_出荷|受注ID', 'soko|TD_出荷|入庫ID', 'soko|TD_出荷|出荷日',
    'ws|TD_在庫|在庫ID', 'ws|TD_在庫|入庫ID', 'ws|TD_在庫|商品コード', 'soko|TD_在庫|在庫ID', 'soko|TD_在庫|入庫ID',
    'ws|TD_在庫変更|在庫No', 'soko|TD_在庫変更|在庫No',
    'ws|TD_輸送計画|輸送ID', 'ws|TD_輸送計画|出荷計画日', 'soko|TD_輸送計画|輸送ID', 'soko|TD_輸送計画|出荷計画日',
    'seizo|TD_入庫|入庫ID', 'seizo|TD_入庫|入庫日', 'juchu|TD_受注|受注ID', 'juchu|TD_受注|受注日', 'juchu|TD_受注|届け先コード'
  ];
  s text;
BEGIN
  FOREACH s IN ARRAY ix LOOP
    x := string_to_array(s, '|');
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = x[1] AND table_name = x[2] AND column_name = x[3]) THEN
      EXECUTE format('CREATE INDEX IF NOT EXISTS %I ON %I.%I (%I)', x[2] || '_' || x[3] || '_idx', x[1], x[2], x[3]);
    END IF;
  END LOOP;
END $$;

-- WEB連携：相手先サイト（elixxi・ランテック・販盛・MerQurius）のログイン画面の住所と、ログイン情報。
-- Access は ID・パスワードを表やプログラムにそのまま書いていた。Web 版ではパスワードを暗号にして保存し、画面には出さない（鍵はサーバーの設定 WEB_RENKEI_KEY）。
CREATE TABLE IF NOT EXISTS app."外部サイト" (
  "サイト" TEXT PRIMARY KEY,
  "並び"   INTEGER NOT NULL DEFAULT 0,
  "名前"   TEXT NOT NULL DEFAULT '',
  "住所"   TEXT NOT NULL DEFAULT '',
  "備考"   TEXT NOT NULL DEFAULT ''
);
INSERT INTO app."外部サイト" ("サイト", "並び", "名前") VALUES
  ('elixxi', 1, 'elixxi（ニチレイ）'),
  ('lantec', 2, 'ランテック'),
  ('hanmori', 3, '販盛（販売管理システム）'),
  ('merqurius', 4, 'MerQurius（日本食研）'),
  ('merqurius-test', 5, 'MerQurius（テスト）')
ON CONFLICT DO NOTHING;
-- 利用者が '' のときは全員で使うログイン。利用者ごとに分けるときは Web 版のログインID を入れる
CREATE TABLE IF NOT EXISTS app."外部サイトのログイン" (
  "サイト"       TEXT NOT NULL REFERENCES app."外部サイト"("サイト") ON DELETE CASCADE,
  "利用者"       TEXT NOT NULL DEFAULT '',
  "ログインID"   TEXT NOT NULL DEFAULT '',
  "パスワード暗号" TEXT NOT NULL DEFAULT '',
  "寄託者"       TEXT NOT NULL DEFAULT '',
  "更新日時"     TIMESTAMPTZ NOT NULL DEFAULT now(),
  "更新者"       TEXT NOT NULL DEFAULT '',
  PRIMARY KEY ("サイト", "利用者")
);

-- WEB連携の MerQurius 枝番：出庫ID ごとに 1 行（Access は主キー。移した表には無いので足す）
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'web_fe' AND table_name = 'MQ_枝番') THEN
    CREATE UNIQUE INDEX IF NOT EXISTS "MQ_枝番_出庫ID_key" ON web_fe."MQ_枝番" ("出庫ID");
  END IF;
END $$;
