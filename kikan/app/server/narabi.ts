// Access の並べ替え（日本語）に近い順にするための並びの鍵。
// かなは五十音順（半角カナは全角にしてから）、漢字は JIS の並び（Shift_JIS の番号の順）、英数字はかなより前。
let 番号表: Map<string, number> | null = null;

function 表を作る(): Map<string, number> {
  const m = new Map<string, number>();
  const dec = new TextDecoder("shift_jis");
  const lead = [...Array(0x9f - 0x81 + 1).keys()].map((i) => 0x81 + i).concat([...Array(0xfc - 0xe0 + 1).keys()].map((i) => 0xe0 + i));
  for (const a of lead)
    for (let b = 0x40; b <= 0xfc; b++) {
      if (b === 0x7f) continue;
      const ch = dec.decode(new Uint8Array([a, b]));
      if (ch.length === 1 && ch !== "�" && !m.has(ch)) m.set(ch, a * 256 + b);
    }
  return m;
}

/** 文字列を並べるための数の並び */
export function 並びの鍵(s: string | null | undefined): number[] {
  番号表 ??= 表を作る();
  const out: number[] = [];
  for (const ch of (s ?? "").normalize("NFKC")) {
    const c = ch.codePointAt(0)!;
    out.push(c < 0x80 ? c : (番号表.get(ch) ?? 0xffff));
  }
  return out;
}

export function 鍵で比べる(a: number[], b: number[]): number {
  for (let i = 0; i < Math.min(a.length, b.length); i++) if (a[i] !== b[i]) return a[i] - b[i];
  return a.length - b.length;
}
