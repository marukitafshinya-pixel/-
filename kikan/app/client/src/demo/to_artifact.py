#!/usr/bin/env python3
"""見本版（dist-demo/demo.html）を、Artifacts に置く形（html・head・body のタグを書かない形）にする。

使い方: python3 to_artifact.py ../../../dist-demo
"""
import glob
import re
import shutil
import sys

d = sys.argv[1]
html = open(f"{d}/demo.html", encoding="utf-8").read()
title = re.search(r"<title>(.*?)</title>", html).group(1)
scripts = re.findall(r'<script type="module"[^>]*src="([^"]+)"[^>]*></script>', html)
body = re.search(r"<body>(.*)</body>", html, re.S).group(1).strip()
out = f"""<title>{title}</title>
<style>
  body {{ background: #ffffff; color: #222222; }}
</style>
{body}
""" + "".join(f'<script type="module" src="{s}"></script>\n' for s in scripts)
open(f"{d}/artifact.html", "w", encoding="utf-8").write(out)
# PGlite の中のファイル一式（.data）は Artifacts に置けないので、.wasm の名前にして置く（db.ts が読む）
for f in glob.glob(f"{d}/assets/pglite-*.data"):
    shutil.copy(f, f"{d}/assets/pglite-fs.wasm")
print(out)
