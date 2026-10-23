// 見本版では Excel 出力は使えない（server/excel.ts の代わり）
export async function 受注検索のExcel(): Promise<never> {
  throw new Error("見本版では Excel 出力は使えません。");
}
export async function 古いデータのExcel(): Promise<never> {
  throw new Error("見本版では Excel 出力は使えません。");
}
export async function 一覧のExcel(): Promise<never> {
  throw new Error("見本版では Excel 出力は使えません。");
}
export async function 手配表のExcel(): Promise<never> {
  throw new Error("見本版では Excel 出力は使えません。");
}
