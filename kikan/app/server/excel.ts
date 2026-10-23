import ExcelJS from "exceljs";

/** "2026-10-14 00:00:00" → Excel の日付（時刻がずれないよう世界標準時で作る） */
function 日付(v: unknown): Date | null {
  if (typeof v !== "string" || !v) return null;
  const m = v.match(/^(\d{4})-(\d{2})-(\d{2})(?: (\d{2}):(\d{2}):(\d{2}))?/);
  if (!m) return null;
  return new Date(Date.UTC(+m[1], +m[2] - 1, +m[3], +(m[4] ?? 0), +(m[5] ?? 0), +(m[6] ?? 0)));
}

const 受注検索の列: { key: string; width: number; date?: boolean }[] = [
  { key: "受注ID", width: 10.55 },
  { key: "受注日", width: 13.48, date: true },
  { key: "受注番号", width: 16.99 },
  { key: "受注元ID", width: 12.74 },
  { key: "受注元名", width: 13.84 },
  { key: "届け先コード", width: 11.28 },
  { key: "届け先", width: 15.53 },
  { key: "商品コード", width: 13.91 },
  { key: "商品名", width: 28.56 },
  { key: "ケース", width: 8.93 },
  { key: "商品kg", width: 10.55 },
  { key: "納品日", width: 13.48, date: true },
  { key: "出荷予定日", width: 13.84, date: true },
  { key: "倉庫名", width: 13.84 },
  { key: "運送会社名", width: 19.04 },
];

/**
 * 受注検索の Excel（Access の「出力」で作られるファイルと同じ形）。
 * 1 行目が見出し（太字・灰色）、全部のマスに細い罫線、日付は dd-mmm-yy、文字は ＭＳ Ｐゴシック 11。
 */
export async function 受注検索のExcel(rows: Record<string, unknown>[]): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("受注検索");
  const font = { name: "ＭＳ Ｐゴシック", size: 11 };
  const thin = { style: "thin" as const };
  const border = { top: thin, left: thin, bottom: thin, right: thin };
  ws.columns = 受注検索の列.map((c) => ({ key: c.key, width: c.width }));

  const head = ws.addRow(受注検索の列.map((c) => c.key));
  head.eachCell((cell) => {
    cell.font = { ...font, bold: true };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFC0C0C0" } };
    cell.alignment = { horizontal: "center", vertical: "middle" };
    cell.border = border;
  });

  for (const r of rows) {
    const row = ws.addRow(受注検索の列.map((c) => (c.date ? 日付(r[c.key]) : r[c.key] ?? null)));
    受注検索の列.forEach((c, i) => {
      const cell = row.getCell(i + 1);
      cell.font = font;
      cell.border = border;
      cell.alignment = { vertical: "middle", horizontal: c.date ? "right" : undefined };
      if (c.date) cell.numFmt = "dd-mmm-yy";
    });
  }
  return Buffer.from(await wb.xlsx.writeBuffer());
}

/** 古いデータを消す前の控え：表ごとに 1 枚のシート（1 行目が見出し） */
export async function 古いデータのExcel(シート: { 名前: string; rows: Record<string, unknown>[] }[]): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  for (const s of シート) {
    const ws = wb.addWorksheet(s.名前.slice(0, 31));
    const cols = s.rows.length ? Object.keys(s.rows[0]) : [];
    if (!cols.length) {
      ws.addRow(["（消す行はありません）"]);
      continue;
    }
    const head = ws.addRow(cols);
    head.font = { bold: true };
    for (const r of s.rows) ws.addRow(cols.map((c) => (r[c] instanceof Date ? r[c] : r[c] ?? null)));
    ws.views = [{ state: "frozen", ySplit: 1 }];
  }
  return Buffer.from(await wb.xlsx.writeBuffer());
}

/** 一覧をそのまま Excel にする（1 行目が見出し。全部のマスに細い罫線。日付の列は yyyy/mm/dd） */
export async function 一覧のExcel(シート名: string, 列: { key: string; 見出し?: string; width?: number; date?: boolean }[], rows: Record<string, unknown>[]): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet(シート名.slice(0, 31));
  const font = { name: "ＭＳ Ｐゴシック", size: 11 };
  const thin = { style: "thin" as const };
  const border = { top: thin, left: thin, bottom: thin, right: thin };
  ws.columns = 列.map((c) => ({ key: c.key, width: c.width ?? 12 }));
  const head = ws.addRow(列.map((c) => c.見出し ?? c.key));
  head.eachCell((cell) => {
    cell.font = { ...font, bold: true };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFC0C0C0" } };
    cell.alignment = { horizontal: "center", vertical: "middle" };
    cell.border = border;
  });
  for (const r of rows) {
    const row = ws.addRow(列.map((c) => (c.date ? 日付(r[c.key]) : r[c.key] ?? null)));
    列.forEach((c, i) => {
      const cell = row.getCell(i + 1);
      cell.font = font;
      cell.border = border;
      if (c.date) cell.numFmt = "yyyy/mm/dd";
    });
  }
  ws.views = [{ state: "frozen", ySplit: 1 }];
  return Buffer.from(await wb.xlsx.writeBuffer());
}

/**
 * Access が Excel を直接動かして作る表（手配出力用カレンダーのニチレイ輸送手配など）。
 * 1 行目に見出し、2 行目から値を入れ、区切りの行の上に線を引き、列の幅を中身に合わせる（Columns.AutoFit）。
 */
export async function 手配表のExcel(見出し: string[], 行: unknown[][], 区切り: boolean[], 線の列数: number): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Sheet1");
  ws.addRow(見出し);
  行.forEach((r, i) => {
    const row = ws.addRow(r.map((v) => (v === undefined ? null : v)));
    if (区切り[i]) for (let c = 1; c <= 線の列数; c++) row.getCell(c).border = { top: { style: "thin" } };
  });
  const 列数 = Math.max(見出し.length, ...行.map((r) => r.length));
  for (let c = 1; c <= 列数; c++) {
    let w = 0;
    ws.getColumn(c).eachCell({ includeEmpty: false }, (cell) => {
      const s = String(cell.value ?? "");
      w = Math.max(w, [...s].reduce((a, ch) => a + (ch.charCodeAt(0) > 0xff ? 2 : 1), 0));
    });
    ws.getColumn(c).width = Math.max(8.43, w + 1.5);
  }
  return Buffer.from(await wb.xlsx.writeBuffer());
}
