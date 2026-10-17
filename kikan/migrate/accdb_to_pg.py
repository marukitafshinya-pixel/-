#!/usr/bin/env python3
"""Access (.accdb/.mdb) のテーブルを PostgreSQL に移し替える。

- テーブル名・項目名は Access と同じ（大文字・小文字も含めて）にする。
- Access ファイル 1 つ = PostgreSQL のスキーマ 1 つ（sources.json で対応を決める）。
- 何度でもやり直せるように、移す前にそのスキーマを作り直す。

使い方:
  PGURL=postgresql://user@host/db python3 accdb_to_pg.py sources.json [--only スキーマ名]

必要なもの: mdbtools（mdb-tables, mdb-schema, mdb-export）, psql
"""
import argparse
import json
import os
import re
import subprocess
import sys

ENV = dict(os.environ, LC_ALL="C.UTF-8", LANG="C.UTF-8")
SKIP = re.compile(r"^(MSys|~|f_[0-9A-F]{32}_)")


def run(cmd, **kw):
    return subprocess.run(cmd, env=ENV, check=True, capture_output=True, **kw).stdout


def tables(db):
    names = run(["mdb-tables", "-1", db]).decode("utf-8").splitlines()
    return [t for t in names if t and not SKIP.match(t)]


def exact_columns(db, table):
    """Access 形式の定義から、項目名を元の大文字・小文字のまま並び順どおりに取る。"""
    ddl = run(["mdb-schema", "-T", table, db]).decode("utf-8")
    return re.findall(r"^\s*\[(.+?)\]\s+\S", ddl, re.M)


def pg_ddl(db, table, schema):
    """mdbtools の PostgreSQL 用の定義を取り、名前を元の表記に戻す。"""
    ddl = run(["mdb-schema", "-T", table, "--no-comments", "--no-relations", db, "postgres"]).decode("utf-8")
    cols = exact_columns(db, table)
    body = re.search(r"CREATE TABLE IF NOT EXISTS \"[^\"]+\"\s*\((.*?)\n\);", ddl, re.S)
    if not body:
        raise RuntimeError(f"定義を読めません: {table}")
    lines = [l for l in body.group(1).splitlines() if l.strip()]
    if len(lines) != len(cols):
        raise RuntimeError(f"項目数が合いません: {table} ({len(lines)} != {len(cols)})")
    out = []
    lower = {}
    for line, col in zip(lines, cols):
        m = re.match(r'\s*"([^"]+)"\s+(.*?),?\s*$', line)
        lower[m.group(1)] = col
        out.append(f'  "{col}" {m.group(2).rstrip(",").strip()}')
    q = f'"{schema}"."{table}"'
    sql = [f"CREATE TABLE {q} (\n" + ",\n".join(out) + "\n);"]
    # 一意の索引だけ残す（主キー・重複なしの決まりを守るため）
    for m in re.finditer(r'CREATE UNIQUE INDEX "[^"]+" ON "[^"]+" \(([^)]*)\);', ddl):
        cs = [lower.get(c.strip().strip('"'), c.strip().strip('"')) for c in m.group(1).split(",")]
        sql.append(f"CREATE UNIQUE INDEX ON {q} (" + ", ".join(f'"{c}"' for c in cs) + ");")
    serials = [lower[n] for n, t in re.findall(r'^\s*"([^"]+)"\s+(SERIAL)', ddl, re.M)]
    # 文字以外の項目は、空欄（""）を NULL として読む
    nontext = [col for line, col in zip(lines, cols) if not re.search(r'"\s+(VARCHAR|TEXT)', line)]
    return "\n".join(sql), serials, nontext


def psql(pgurl, sql, stdin=None):
    return subprocess.run(["psql", pgurl, "-v", "ON_ERROR_STOP=1", "-q", "-At", "-c", sql],
                          env=ENV, input=stdin, check=True, capture_output=True).stdout.decode()


def migrate(pgurl, src):
    db, schema = src["file"], src["schema"]
    only = set(src.get("tables", []))
    print(f"== {schema} ← {db}", flush=True)
    psql(pgurl, f'DROP SCHEMA IF EXISTS "{schema}" CASCADE; CREATE SCHEMA "{schema}";')
    report = []
    for t in tables(db):
        if only and t not in only:
            continue
        try:
            ddl, serials, nontext = pg_ddl(db, t, schema)
            psql(pgurl, ddl)
            data = run(["mdb-export", "-b", "strip", "-D", "%Y-%m-%d %H:%M:%S",
                        "-T", "%Y-%m-%d %H:%M:%S", db, t])
            # Access の日付 0（1899/12/30、時刻だけの値）を mdbtools は「1900-01-00」と書くので直す
            data = data.replace(b"1900-01-00 ", b"1899-12-30 ")
            n_src = len(_csv_rows(data)) - 1
            fn = ", ".join(f'"{c}"' for c in nontext)
            opt = f", FORCE_NULL ({fn})" if nontext else ""
            psql(pgurl, f'\\copy "{schema}"."{t}" FROM STDIN WITH (FORMAT csv, HEADER true{opt})', stdin=data)
            for c in serials:
                psql(pgurl, f"SELECT setval(pg_get_serial_sequence('\"{schema}\".\"{t}\"', '{c}'), "
                            f"COALESCE((SELECT MAX(\"{c}\") FROM \"{schema}\".\"{t}\"), 0) + 1, false);")
            n_pg = int(psql(pgurl, f'SELECT count(*) FROM "{schema}"."{t}"').strip())
            report.append((t, n_src, n_pg, "OK" if n_src == n_pg else "件数違い"))
        except Exception as e:  # 1 つの表の失敗で全体を止めない
            msg = e.stderr.decode(errors="replace").strip() if isinstance(e, subprocess.CalledProcessError) else str(e)
            report.append((t, "", "", "失敗: " + msg.splitlines()[-1][:200] if msg else "失敗"))
    return report


def _csv_rows(data):
    import csv
    import io
    return list(csv.reader(io.StringIO(data.decode("utf-8", errors="replace"))))


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("sources")
    ap.add_argument("--only", help="このスキーマだけ移す")
    ap.add_argument("--report", default="移し替え結果.md")
    a = ap.parse_args()
    pgurl = os.environ.get("PGURL")
    if not pgurl:
        sys.exit("PGURL（PostgreSQL の接続先）を指定してください")
    cfg = json.load(open(a.sources, encoding="utf-8"))
    base = os.path.dirname(os.path.abspath(a.sources))
    lines = ["# 移し替え結果", "", "| スキーマ | 表 | Access の件数 | 移した件数 | 結果 |", "|---|---|---|---|---|"]
    bad = 0
    for src in cfg["sources"]:
        if a.only and src["schema"] != a.only:
            continue
        src = dict(src, file=os.path.join(base, src["file"]))
        if not os.path.exists(src["file"]):
            lines.append(f"| {src['schema']} | （ファイルなし） | | | 未実施 |")
            continue
        for t, s, p, r in migrate(pgurl, src):
            bad += r != "OK"
            lines.append(f"| {src['schema']} | {t} | {s} | {p} | {r} |")
    open(a.report, "w", encoding="utf-8").write("\n".join(lines) + "\n")
    print(f"結果: {a.report}（問題 {bad} 件）")


if __name__ == "__main__":
    main()
