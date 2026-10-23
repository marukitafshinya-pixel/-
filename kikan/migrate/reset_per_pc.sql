-- パソコンごとにあった表を、本番に移すときに空にする（2026/10/23 利用者：全員で一旦データをリセット）。
-- Access ではこれらの表が各パソコンの画面側ファイルにあり、人ごとに中身が違っていた。Web 版では全員が同じものを使うので、空から始める。
-- 取り込み（accdb_to_pg.py・csv_to_pg.py）のあとに流す：psql "$PGURL" -v ON_ERROR_STOP=1 -f reset_per_pc.sql
BEGIN;
DELETE FROM ws_fe."TM_レポート作成";          -- 保存した出荷抽出の条件（出荷抽出帳票）
DELETE FROM ws_fe."TM_集計用レポートクエリ";  -- 保存した輸送抽出の条件（輸送抽出帳票）
DELETE FROM ws_fe."T_パレット配置図";         -- パレット配置図
DELETE FROM ws_fe."TD_在庫_確認";             -- 出荷停止の確認の印（出荷停止在庫一覧）
COMMIT;
