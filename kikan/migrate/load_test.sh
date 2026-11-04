#!/bin/bash
# Access のファイルから、Web 版で試すためのデータベースを作る（今使っているデータベースはさわらない）。
#
# 使い方:
#   bash load_test.sh <Access のファイルを置いたフォルダ> [作るデータベース名（はじめは kikan_test）] [ログインを写す元のデータベース（はじめは kikan）]
#
# 1. 作るデータベースを作り直す（同じ名前のものがあれば消す）
# 2. フォルダの中で sources.json に載っているファイルだけを、それぞれのスキーマに入れる（accdb_to_pg.py）
# 3. 商品・得意先・運送会社マスタを 1 つにまとめ（unify_masters.sql）、パソコンごとの表を空にする（reset_per_pc.sql）
# 4. Web 版だけの表（server/schema.sql）を作り、ログインの利用者を元のデータベースから写す
#
# 必要なもの: mdbtools、psql、Python 3。PG（接続先。はじめは postgresql://postgres@127.0.0.1）を渡すと変えられる。
set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
FOLDER="${1:?Access のファイルを置いたフォルダを指定してください}"
DB="${2:-kikan_test}"
FROM_DB="${3:-kikan}"
PG="${PG:-postgresql://postgres@127.0.0.1}"
[ "$DB" = "$FROM_DB" ] && { echo "作るデータベースとログインを写す元が同じです。別の名前にしてください。"; exit 1; }

# 2 で使う sources（フォルダにあるファイルだけ）
WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT
python3 - "$HERE/sources.json" "$FOLDER" "$WORK/sources.json" <<'PY'
import json, os, sys, unicodedata
src, folder, out = sys.argv[1:4]
norm = lambda s: unicodedata.normalize("NFKC", s).replace(" ", "").replace("　", "").lower()
files = {norm(f): os.path.join(folder, f) for f in os.listdir(folder) if f.lower().endswith((".accdb", ".mdb"))}
have, missing = [], []
for s in json.load(open(src, encoding="utf-8"))["sources"]:
    p = files.get(norm(os.path.basename(s["file"])))
    (have if p else missing).append({**s, "file": p} if p else s["file"])
json.dump({"sources": have}, open(out, "w", encoding="utf-8"), ensure_ascii=False)
print(f"入れるファイル {len(have)} 個:", ", ".join(os.path.basename(x["file"]) for x in have))
if missing:
    print("フォルダにないファイル（入れない）:", ", ".join(os.path.basename(m) for m in missing))
PY

echo "== データベース $DB を作り直します"
psql "$PG/postgres" -v ON_ERROR_STOP=1 -qc "DROP DATABASE IF EXISTS \"$DB\" WITH (FORCE)" -c "CREATE DATABASE \"$DB\""
URL="$PG/$DB"

echo "== Access の表を入れます"
(cd "$HERE" && PGURL="$URL" python3 accdb_to_pg.py "$WORK/sources.json")

echo "== マスタをまとめ、パソコンごとの表を空にします"
psql "$URL" -v ON_ERROR_STOP=1 -q -f "$HERE/unify_masters.sql"
psql "$URL" -v ON_ERROR_STOP=1 -q -f "$HERE/reset_per_pc.sql"

echo "== Web 版だけの表を作り、ログインの利用者を $FROM_DB から写します"
psql "$URL" -v ON_ERROR_STOP=1 -q -f "$HERE/../app/server/schema.sql"
pg_dump --data-only -t app.users "$PG/$FROM_DB" | psql "$URL" -q -v ON_ERROR_STOP=1

echo "== できました。試すとき: PGURL=$URL PORT=3001 npm start（app フォルダで）"
echo "   表ごとの件数は migrate/移し替え結果.md"
