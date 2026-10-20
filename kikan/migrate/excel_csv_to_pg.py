#!/usr/bin/env python3
"""Excel で保存した CSV（Access の表を Excel に貼り付けて CSV にしたもの）を PostgreSQL に入れる。

ExportTables の CSV と違い、型の情報（fields.txt）がないので、同じ形の表（--like）の型を借りる。
- 日付は「13-Oct-26」「2026/10/13」「2026/10/13 9:05:00」のどれでも読む。
- TRUE / FALSE は真偽、数字のカンマは取る。空欄は空（NULL）。
- 入れる前に、その表を作り直す（何度でもやり直せる）。

使い方:
  PGURL=... python3 excel_csv_to_pg.py --csv 倉庫の受注.csv --table soko.TD_受注 --like juchu.TD_受注
"""
import argparse
import csv
import io
import os
import re
import subprocess
from datetime import datetime

MONTHS = {m: i + 1 for i, m in enumerate("Jan Feb Mar Apr May Jun Jul Aug Sep Oct Nov Dec".split())}


def read_text(path):
    raw = open(path, "rb").read()
    for enc in ("utf-8-sig", "cp932"):
        try:
            return raw.decode(enc)
        except UnicodeDecodeError:
            pass
    return raw.decode("cp932", errors="replace")


def psql(pgurl, sql, stdin=None):
    return subprocess.run(["psql", pgurl, "-v", "ON_ERROR_STOP=1", "-q", "-At", "-c", sql],
                          input=stdin, capture_output=True, check=True).stdout.decode()


def qname(full):
    schema, table = full.split(".", 1)
    return f'"{schema}"."{table}"'


def fix_date(v):
    m = re.fullmatch(r"(\d{1,2})-([A-Za-z]{3})-(\d{2})", v)
    if m:
        return f"20{m.group(3)}-{MONTHS[m.group(2).title()]:02d}-{int(m.group(1)):02d}"
    m = re.fullmatch(r"(\d{4})/(\d{1,2})/(\d{1,2})(?: (\d{1,2}):(\d{2})(?::(\d{2}))?)?", v)
    if m:
        y, mo, d, hh, mi, ss = m.groups()
        s = f"{y}-{int(mo):02d}-{int(d):02d}"
        return s + (f" {int(hh):02d}:{mi}:{ss or '00'}" if hh else "")
    raise ValueError(f"日付が読めません: {v}")


def fix(v, typ):
    if v == "":
        return ""
    if typ == "boolean":
        return {"TRUE": "true", "FALSE": "false", "-1": "true", "0": "false"}.get(v.upper(), v)
    if typ.startswith("timestamp") or typ == "date":
        return fix_date(v)
    if typ in ("integer", "smallint", "bigint", "double precision", "numeric", "real"):
        return v.replace(",", "").replace("¥", "")
    return v


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--csv", required=True)
    ap.add_argument("--table", required=True, help="入れ先（スキーマ.表）")
    ap.add_argument("--like", required=True, help="型を借りる表（スキーマ.表）")
    a = ap.parse_args()
    pgurl = os.environ.get("PGURL", "postgresql://postgres@/kikan?host=/tmp")

    ls, lt = a.like.split(".", 1)
    types = dict(line.split("|", 1) for line in psql(pgurl, f"""
        SELECT column_name || '|' || format_type(a.atttypid, a.atttypmod)
        FROM information_schema.columns c
        JOIN pg_attribute a ON a.attrelid = '{qname(a.like)}'::regclass AND a.attname = c.column_name
        WHERE c.table_schema = '{ls}' AND c.table_name = '{lt}'""").splitlines() if line)

    rows = list(csv.reader(io.StringIO(read_text(a.csv))))
    head, body = rows[0], [r for r in rows[1:] if any(r)]
    cols = [(h, types.get(h, "text")) for h in head]

    schema = a.table.split(".", 1)[0]
    psql(pgurl, f'CREATE SCHEMA IF NOT EXISTS "{schema}"; DROP TABLE IF EXISTS {qname(a.table)}; '
                f'CREATE TABLE {qname(a.table)} ({", ".join(f"{chr(34)}{h}{chr(34)} {t}" for h, t in cols)})')
    out = io.StringIO()
    w = csv.writer(out)
    for r in body:
        w.writerow([fix(v, t) for v, (h, t) in zip(r, cols)])
    collist = ", ".join(f'"{h}"' for h, _ in cols)
    nonnull = ", ".join(f'"{h}"' for h, t in cols if t != "text" and not t.startswith("character"))
    opts = f", FORCE_NULL ({nonnull})" if nonnull else ""
    psql(pgurl, f"\\copy {qname(a.table)} ({collist}) FROM STDIN WITH (FORMAT csv{opts})",
         stdin=out.getvalue().encode())
    n = psql(pgurl, f"SELECT count(*) FROM {qname(a.table)}").strip()
    print(f"{a.table}: CSV {len(body)} 行 → 表 {n} 行")


if __name__ == "__main__":
    main()
