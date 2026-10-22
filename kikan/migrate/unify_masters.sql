-- 商品マスタ・得意先マスタ・運送会社マスタを 1 つにまとめる（利用者の了承済み）
--
-- Access では画面側ファイルごとにマスタの写しを持っていて、中身が少しずつ違う。
-- Web 版では kyotsu スキーマの 1 つの表にまとめ、各スキーマの同じ名前のところはビュー（のぞき窓）にする。
-- これまでの画面・SQL は書き換えなくてもそのまま動く。
--
-- まとめ方
--   - 中身は、マスタ管理の本体（Accessマスタ管理.accdb ＝ master。マスタはここで直して各システムに配っていた）を使う。
--     本体を取り込んでいないときは、いちばん新しい写し（受注登録の画面側＝juchu_fe。倉庫管理・製造管理・包装場・手配・WEB連携も同じ中身）を使う。
--   - そこにない商品（新しい写しで消された古い商品）は、製造計画（keikaku）、なければ WorkStation（ws_fe）から足す。
--     過去の受注・出荷の商品名を出すため。
--   - 商品マスタの「ロボットプログラムNo」は製造計画と WorkStation にしかないので、製造計画、なければ WorkStation の値を入れる。
--   - 型が写しで違う項目（smallint と integer）は広い方（integer）にする。
--   - 運送会社マスタも同じ（本体、なければ倉庫管理の写し。そこにない運送会社ID は WorkStation の写しから足す）。
--     運送会社ID が同じ行が 2 つあるもの（180・213）は、本体のとおり両方残す。
--
-- 何度流してもよい。取り込み（accdb_to_pg・csv_to_pg）で各スキーマに表が入り直したときは、
-- その表を old_master スキーマへ移して、まとめ直す。表が入り直していなければ、まとめた表はそのまま（画面での直しを消さない）。
--
--   psql "$PGURL" -v ON_ERROR_STOP=1 -f unify_masters.sql

CREATE SCHEMA IF NOT EXISTS kyotsu;
CREATE SCHEMA IF NOT EXISTS old_master;

DO $$
DECLARE
  schemas text[] := ARRAY['master', 'juchu_fe', 'soko_fe', 'seizo_fe', 'housou_fe', 'tehai_fe', 'web_fe', 'ws_fe', 'keikaku'];
  tables text[] := ARRAY['TM_商品マスタ', 'TM_得意先マスタ', 'TM_運送会社マスタ'];
  src text;
  s text;
  tb text;
  moved boolean := false;
  cols text;
BEGIN
  -- 1. 各スキーマに入っている表（ビューでないもの）を old_master へ移す
  FOREACH tb IN ARRAY tables LOOP
    FOREACH s IN ARRAY schemas LOOP
      IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = s AND table_name = tb AND table_type = 'BASE TABLE') THEN
        -- 写しを old_master に取っておき（索引などは付けない）、もとの表は消す
        EXECUTE format('DROP TABLE IF EXISTS old_master.%I', s || '.' || tb);
        EXECUTE format('CREATE TABLE old_master.%I AS TABLE %I.%I', s || '.' || tb, s, tb);
        EXECUTE format('DROP TABLE %I.%I', s, tb);
        moved := true;
      END IF;
    END LOOP;
  END LOOP;

  -- 2. 新しく移した表があるとき（またはまとめた表がまだないとき）だけ、まとめ直す
  IF moved OR to_regclass('kyotsu."TM_商品マスタ"') IS NULL OR to_regclass('kyotsu."TM_得意先マスタ"') IS NULL
     OR to_regclass('kyotsu."TM_運送会社マスタ"') IS NULL THEN
    -- 先にビューを消す（まとめた表を作り直すため）
    FOREACH tb IN ARRAY tables LOOP
      FOREACH s IN ARRAY schemas LOOP
        EXECUTE format('DROP VIEW IF EXISTS %I.%I', s, tb);
      END LOOP;
    END LOOP;
    DROP TABLE IF EXISTS kyotsu."TM_商品マスタ";
    DROP TABLE IF EXISTS kyotsu."TM_得意先マスタ";
    DROP TABLE IF EXISTS kyotsu."TM_運送会社マスタ";

    -- 商品マスタ
    CREATE TABLE kyotsu."TM_商品マスタ" (LIKE old_master."juchu_fe.TM_商品マスタ");
    ALTER TABLE kyotsu."TM_商品マスタ"
      ALTER COLUMN "テープID" TYPE integer,
      ALTER COLUMN "パット使用数" TYPE integer,
      ALTER COLUMN "パレット単位1" TYPE integer,
      ALTER COLUMN "パレット単位2" TYPE integer,
      ADD COLUMN "ロボットプログラムNo" integer;
    -- 本体 → 新しい写し → 製造計画 → WorkStation の順に、まだない商品を入れる（項目は名前で合わせる）
    FOREACH s IN ARRAY ARRAY['master', 'juchu_fe', 'keikaku', 'ws_fe'] LOOP
      CONTINUE WHEN to_regclass(format('old_master.%I', s || '.TM_商品マスタ')) IS NULL;
      SELECT string_agg(format('%I', c.column_name), ', ' ORDER BY c.ordinal_position) INTO cols
      FROM information_schema.columns c
      WHERE c.table_schema = 'old_master' AND c.table_name = s || '.TM_商品マスタ' AND c.column_name <> 'ロボットプログラムNo'
        AND EXISTS (SELECT 1 FROM information_schema.columns k WHERE k.table_schema = 'kyotsu' AND k.table_name = 'TM_商品マスタ' AND k.column_name = c.column_name);
      EXECUTE format('INSERT INTO kyotsu."TM_商品マスタ" (%s) SELECT %s FROM old_master.%I o
                      WHERE NOT EXISTS (SELECT 1 FROM kyotsu."TM_商品マスタ" m WHERE m."商品コード" = o."商品コード")',
                     cols, cols, s || '.TM_商品マスタ');
    END LOOP;
    UPDATE kyotsu."TM_商品マスタ" m SET "ロボットプログラムNo" = COALESCE(
      (SELECT k."ロボットプログラムNo" FROM old_master."keikaku.TM_商品マスタ" k WHERE k."商品コード" = m."商品コード" LIMIT 1),
      (SELECT w."ロボットプログラムNo" FROM old_master."ws_fe.TM_商品マスタ" w WHERE w."商品コード" = m."商品コード" LIMIT 1));

    CREATE INDEX ON kyotsu."TM_商品マスタ" ("商品コード");

    -- 得意先マスタ（本体 → 新しい写し → 製造計画 → WorkStation の順に、まだない得意先を足す。項目は名前で合わせる）
    CREATE TABLE kyotsu."TM_得意先マスタ" (LIKE old_master."juchu_fe.TM_得意先マスタ");
    FOREACH s IN ARRAY ARRAY['master', 'juchu_fe', 'keikaku', 'ws_fe'] LOOP
      CONTINUE WHEN to_regclass(format('old_master.%I', s || '.TM_得意先マスタ')) IS NULL;
      SELECT string_agg(format('%I', c.column_name), ', ' ORDER BY c.ordinal_position) INTO cols
      FROM information_schema.columns c
      WHERE c.table_schema = 'old_master' AND c.table_name = s || '.TM_得意先マスタ'
        AND EXISTS (SELECT 1 FROM information_schema.columns k WHERE k.table_schema = 'kyotsu' AND k.table_name = 'TM_得意先マスタ' AND k.column_name = c.column_name);
      EXECUTE format('INSERT INTO kyotsu."TM_得意先マスタ" (%s) SELECT %s FROM old_master.%I o
                      WHERE NOT EXISTS (SELECT 1 FROM kyotsu."TM_得意先マスタ" m WHERE m."短縮コード" = o."短縮コード")',
                     cols, cols, s || '.TM_得意先マスタ');
    END LOOP;
    CREATE INDEX ON kyotsu."TM_得意先マスタ" ("短縮コード");

    -- 運送会社マスタ（本体 → 倉庫管理の写し → WorkStation の写し。まだない運送会社ID の行を足す）
    src := CASE WHEN to_regclass('old_master."master.TM_運送会社マスタ"') IS NOT NULL THEN 'master.TM_運送会社マスタ'
                WHEN to_regclass('old_master."soko_fe.TM_運送会社マスタ"') IS NOT NULL THEN 'soko_fe.TM_運送会社マスタ'
                ELSE 'ws_fe.TM_運送会社マスタ' END;
    EXECUTE format('CREATE TABLE kyotsu."TM_運送会社マスタ" (LIKE old_master.%I)', src);
    FOREACH s IN ARRAY ARRAY['master', 'soko_fe', 'ws_fe'] LOOP
      CONTINUE WHEN to_regclass(format('old_master.%I', s || '.TM_運送会社マスタ')) IS NULL;
      SELECT string_agg(format('%I', c.column_name), ', ' ORDER BY c.ordinal_position) INTO cols
      FROM information_schema.columns c
      WHERE c.table_schema = 'old_master' AND c.table_name = s || '.TM_運送会社マスタ'
        AND EXISTS (SELECT 1 FROM information_schema.columns k WHERE k.table_schema = 'kyotsu' AND k.table_name = 'TM_運送会社マスタ' AND k.column_name = c.column_name);
      EXECUTE format('INSERT INTO kyotsu."TM_運送会社マスタ" (%s) SELECT %s FROM old_master.%I o
                      WHERE NOT EXISTS (SELECT 1 FROM kyotsu."TM_運送会社マスタ" m WHERE m."運送会社ID" = o."運送会社ID")',
                     cols, cols, s || '.TM_運送会社マスタ');
    END LOOP;
    CREATE INDEX ON kyotsu."TM_運送会社マスタ" ("運送会社ID");
  END IF;

  -- 3. 各スキーマの同じ名前のところをビューにする
  FOREACH tb IN ARRAY tables LOOP
    FOREACH s IN ARRAY schemas LOOP
      IF to_regclass(format('%I.%I', s, tb)) IS NULL THEN
        EXECUTE format('CREATE SCHEMA IF NOT EXISTS %I', s);
        EXECUTE format('CREATE VIEW %I.%I AS SELECT * FROM kyotsu.%I', s, tb, tb);
      END IF;
    END LOOP;
  END LOOP;
END $$;
