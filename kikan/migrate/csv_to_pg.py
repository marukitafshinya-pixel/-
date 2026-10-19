#!/usr/bin/env python3
"""Access から書き出した CSV（ExportTables で作ったもの）を PostgreSQL に入れる。

- fields.txt（表名・項目名・型・長さ）から表を作り、同じ名前の CSV を入れる。
- リンクしている表は、本来の持ち主のデータ側ファイルのスキーマに入れる
  （例：受注登録FE の「TD_出庫」→ 倉庫管理System.accdb の「TD_出荷」→ soko."TD_出荷"）。
  リンクの対応は links/<画面側ファイル名>.json、ファイルとスキーマの対応は sources.json。
- 画面側ファイルの中の表は、sources.json でその画面側ファイルに割り当てたスキーマに入れる。
- 入れる前に、その表を作り直す（何度でもやり直せる）。

使い方:
  PGURL=... python3 csv_to_pg.py --fe 受注登録FE --dir 書き出したフォルダ
"""
import argparse
import csv
import io
import json
import os
import re
import subprocess
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
ENV = dict(os.environ, LC_ALL="C.UTF-8", LANG="C.UTF-8")

# DAO の型番号 → PostgreSQL の型
TYPES = {1: "BOOLEAN", 2: "SMALLINT", 3: "SMALLINT", 4: "INTEGER", 5: "NUMERIC(19,4)", 6: "REAL",
         7: "DOUBLE PRECISION", 8: "TIMESTAMP", 11: "BYTEA", 12: "TEXT", 15: "TEXT", 16: "BIGINT",
         20: "NUMERIC"}


def read_text(path):
    raw = open(path, "rb").read()
    for enc in ("utf-8-sig", "cp932"):
        try:
            return raw.decode(enc)
        except UnicodeDecodeError:
            pass
    return raw.decode("cp932", errors="replace")


def parse_fields(path):
    tables, cur = {}, None
    for line in read_text(path).splitlines():
        if line.startswith("## "):
            name = line[3:].strip()
            link = name.endswith("(link)")
            name = re.sub(r"\s*\(link\)$", "", name)
            cur = tables[name] = {"link": link, "cols": []}
        elif cur is not None and line.startswith("  ") and "\t" in line:
            parts = line.strip().split("\t")
            if len(parts) == 3:
                cur["cols"].append((parts[0], int(parts[1]), int(parts[2])))
    return tables


def pg_type(t, size):
    if t == 10:
        return f"VARCHAR({size})" if size > 0 else "TEXT"
    return TYPES.get(t, "TEXT")


def fix_value(v, t):
    if v == "":
        return v
    if t == 1:  # はい/いいえ（-1 は「はい」）
        return "1" if v.strip() in ("-1", "1", "True", "TRUE", "Yes") else "0"
    if t == 8 and "/" not in v and "-" not in v:  # 時刻だけ → Access の日付 0 を付ける
        return "1899/12/30 " + v
    if t in (5, 6, 7, 20, 2, 3, 4, 16):
        return v.replace(",", "").replace("¥", "").replace("\\", "")
    return v


def psql(pgurl, sql, stdin=None):
    return subprocess.run(["psql", pgurl, "-v", "ON_ERROR_STOP=1", "-q", "-At", "-c", sql],
                          env=ENV, input=stdin, check=True, capture_output=True).stdout.decode()


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--fe", required=True, help="書き出した画面側ファイルの名前（links/ のファイル名）")
    ap.add_argument("--dir", required=True, help="fields.txt と CSV があるフォルダ")
    ap.add_argument("--report", default="移し替え結果.md")
    a = ap.parse_args()
    pgurl = os.environ.get("PGURL") or sys.exit("PGURL（PostgreSQL の接続先）を指定してください")

    cfg = json.load(open(os.path.join(HERE, "sources.json"), encoding="utf-8"))
    schema_of = {os.path.basename(s["file"]): s["schema"] for s in cfg["sources"]}
    links = json.load(open(os.path.join(HERE, "links", a.fe + ".json"), encoding="utf-8"))
    local_schema = schema_of.get(a.fe + ".accdb") or sys.exit(f"sources.json に {a.fe}.accdb がありません")

    tables = parse_fields(os.path.join(a.dir, "fields.txt"))
    lines = [f"# 移し替え結果（{a.fe} から書き出した CSV）", "",
             "| 表（画面側の名前） | 入れた先 | CSV の件数 | 入れた件数 | 結果 |", "|---|---|---|---|---|"]
    bad = 0
    # 行き先を決める。リンクの印がなくても（表を貼り付けて書き出した場合など）、名前がリンクの表なら持ち主へ入れる。
    # 2 つの名前が同じ表を指すとき（例：TD_在庫 と TD_在庫BackUp）は、元の名前と同じものだけを持ち主へ入れ、
    # ほかは上書きしないように画面側のスキーマへ自分の名前で入れる。
    dest_of = {}
    for name in tables:
        if name in links:
            dest_of[name] = (schema_of.get(links[name]["file"], "_" + links[name]["file"].replace(".accdb", "")),
                             links[name]["table"])
        else:
            dest_of[name] = (local_schema, name)
    targets = {}
    for name, d in dest_of.items():
        targets.setdefault(d, []).append(name)
    for d, names in targets.items():
        if len(names) > 1:
            for name in names:
                if name != d[1]:
                    dest_of[name] = (local_schema, name)
    for name, info in tables.items():
        if name.startswith("MSys") or name in ("貼り付けエラー", "名前の自動修正保存エラー"):
            continue
        path = os.path.join(a.dir, name + ".csv")
        schema, table = dest_of[name]
        dest = f'"{schema}"."{table}"'
        if not os.path.exists(path):
            lines.append(f"| {name} | {schema}.{table} | | | CSV なし（とばした） |")
            continue
        try:
            cols = info["cols"]
            rows = list(csv.reader(io.StringIO(read_text(path))))
            header, body = rows[0], rows[1:]
            types = {c: t for c, t, _ in cols}
            out = io.StringIO()
            w = csv.writer(out)
            w.writerow(header)
            for r in body:
                w.writerow([fix_value(v, types.get(h, 10)) for h, v in zip(header, r)])
            ddl = ",\n".join(f'  "{c}" {pg_type(t, s)}' for c, t, s in cols)
            nontext = [c for c, t, _ in cols if t not in (10, 12)]
            fn = ", ".join(f'"{c}"' for c in nontext if c in header)
            psql(pgurl, f'CREATE SCHEMA IF NOT EXISTS "{schema}"; DROP TABLE IF EXISTS {dest}; '
                        f'CREATE TABLE {dest} (\n{ddl}\n);')
            hdr = ", ".join(f'"{h}"' for h in header)
            opt = f", FORCE_NULL ({fn})" if fn else ""
            psql(pgurl, f"\\copy {dest} ({hdr}) FROM STDIN WITH (FORMAT csv, HEADER true{opt})",
                 stdin=out.getvalue().encode("utf-8"))
            n = int(psql(pgurl, f"SELECT count(*) FROM {dest}").strip())
            ok = n == len(body)
            bad += not ok
            lines.append(f"| {name} | {schema}.{table} | {len(body)} | {n} | {'OK' if ok else '件数違い'} |")
        except Exception as e:
            bad += 1
            msg = e.stderr.decode(errors="replace").strip() if isinstance(e, subprocess.CalledProcessError) else str(e)
            lines.append(f"| {name} | {schema}.{table} | | | 失敗: {msg.splitlines()[-1][:200] if msg else ''} |")
    open(a.report, "w", encoding="utf-8").write("\n".join(lines) + "\n")
    print(f"結果: {a.report}（問題 {bad} 件）")


if __name__ == "__main__":
    main()
