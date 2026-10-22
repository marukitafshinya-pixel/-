export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

// ---------------- 処理中の表示（インジケーター） ----------------
// サーバーへの問い合わせが 0.3 秒より長くかかったら、画面の真ん中に「処理しています」を出す（全部の画面で共通）。
// 出ている間は画面を押せない（二度押しを防ぐ）。
let 動いている数 = 0;
let 出す予約: ReturnType<typeof setTimeout> | null = null;
function 表示を作る(): HTMLElement {
  let el = document.getElementById("busy-indicator");
  if (!el) {
    el = document.createElement("div");
    el.id = "busy-indicator";
    el.innerHTML = '<div class="busy-box"><div class="busy-spin"></div><div class="busy-text">処理しています…</div></div>';
    document.body.appendChild(el);
  }
  return el;
}
function 始める() {
  動いている数++;
  if (動いている数 === 1 && typeof document !== "undefined")
    出す予約 = setTimeout(() => 表示を作る().classList.add("on"), 300);
}
function 終わる() {
  動いている数 = Math.max(0, 動いている数 - 1);
  if (動いている数 === 0 && typeof document !== "undefined") {
    if (出す予約) clearTimeout(出す予約);
    出す予約 = null;
    document.getElementById("busy-indicator")?.classList.remove("on");
  }
}
/** 時間のかかる処理（Excel の書き出しなど、api を通さないもの）を、処理中の表示付きで行う */
export async function 処理中<T>(p: () => Promise<T>): Promise<T> {
  始める();
  try {
    return await p();
  } finally {
    終わる();
  }
}

async function call<T>(method: string, url: string, body?: unknown): Promise<T> {
  return 処理中(async () => {
    const r = await fetch(url, {
      method,
      headers: body ? { "Content-Type": "application/json" } : undefined,
      body: body ? JSON.stringify(body) : undefined,
      credentials: "same-origin",
    });
    const data = await r.json().catch(() => ({}));
    if (!r.ok) throw new ApiError(r.status, data.error ?? "エラーが起きました");
    return data as T;
  });
}

export const api = {
  get: <T,>(url: string, params?: Record<string, string | number | undefined | null>) => {
    const qs = new URLSearchParams();
    for (const [k, v] of Object.entries(params ?? {})) if (v !== undefined && v !== null && v !== "") qs.set(k, String(v));
    const s = qs.toString();
    return call<T>("GET", s ? `${url}?${s}` : url);
  },
  post: <T,>(url: string, body?: unknown) => call<T>("POST", url, body ?? {}),
};

/** ファイルをそのままサーバーに送る */
export async function upload<T = any>(url: string, file: File): Promise<T> {
  return 処理中(async () => {
    const r = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/octet-stream" },
      body: await file.arrayBuffer(),
      credentials: "same-origin",
    });
    const data = await r.json().catch(() => ({}));
    if (!r.ok) throw new ApiError(r.status, data.error ?? "エラーが起きました");
    return data as T;
  });
}

/** "2026-10-01 00:00:00" → "10/01（木）" のように、Access の画面と同じ書き方にする */
export function mdw(v: string | null | undefined): string {
  if (!v) return "";
  const d = new Date(v.replace(" ", "T"));
  if (isNaN(+d)) return "";
  const w = "日月火水木金土"[d.getDay()];
  return `${String(d.getMonth() + 1).padStart(2, "0")}/${String(d.getDate()).padStart(2, "0")}（${w}）`;
}

export function ymd(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function num(v: number | null | undefined): string {
  return v === null || v === undefined ? "" : Number(v).toLocaleString("ja-JP");
}
