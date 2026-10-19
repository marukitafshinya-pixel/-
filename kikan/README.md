# 基幹システム Web 版（Access からの移行）

Access で作った基幹システム 8 つ（受注登録・丸北WorkStation・倉庫管理System・製造管理 丸北・製造計画・包装場管理System・WEB連携・手配出力用カレンダー）を、クラウドで動く Web アプリに移すためのフォルダ。

- 調査と計画：[../docs/access移行/](../docs/access移行/00_全体像.md)
- 進め方：[移行計画](../docs/access移行/10_移行計画（案）.md)

## フォルダ

| フォルダ | 中身 |
|---|---|
| `migrate/` | Access のデータを PostgreSQL に移す道具 |

## データの移し替え（migrate）

1. Access のファイルを `migrate/data/` に置く（ファイル名は `migrate/sources.json` のとおり）。このフォルダはリポジトリに入れない。
2. PostgreSQL を用意し、次を実行する。

```
cd kikan/migrate
PGURL=postgresql://ユーザー@ホスト/データベース python3 accdb_to_pg.py sources.json
```

- Access ファイル 1 つが、PostgreSQL のスキーマ 1 つになる（例：丸北WorkStation.accdb → `ws`）。
- 表と項目の名前は Access と同じ（`ws."TD_出荷"."輸送ID"` のように二重引用符で囲んで使う）。
- 何度でもやり直せる（実行のたびに、そのスキーマを作り直す）。
- 結果は `移し替え結果.md` に出る（表ごとに Access の件数と移した件数を比べる）。
- 必要なもの：mdbtools（`mdb-tables`・`mdb-schema`・`mdb-export`）、psql、Python 3。

## 書き出した CSV からの取り込み（csv_to_pg）

Access の画面側ファイルで `ExportTables`（表を CSV と fields.txt に書き出すプログラム）を動かして作ったフォルダを取り込む。

```
cd kikan/migrate
PGURL=... python3 csv_to_pg.py --fe 受注登録FE --dir 書き出したフォルダ
```

- fields.txt の型で表を作り、同じ名前の CSV を入れる。
- リンクしている表は、本来の持ち主のスキーマに入れる（例：受注登録FE の「TD_出庫」→ `soko."TD_出荷"`）。対応は `links/画面側ファイル名.json`（画面側ファイルの中の情報から作ったもの）。
- 画面側ファイルの中の表は、`sources.json` でその画面側ファイルに割り当てたスキーマ（例：`juchu_fe`）に入れる。
- ほかのシステムの表がいっしょに書き出されていて、すでに取り込んだものを上書きしたくないときは `--skip-schemas ws,soko` のように指定する。
