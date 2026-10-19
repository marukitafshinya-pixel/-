export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

async function call<T>(method: string, url: string, body?: unknown): Promise<T> {
  const r = await fetch(url, {
    method,
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
    credentials: "same-origin",
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new ApiError(r.status, data.error ?? "エラーが起きました");
  return data as T;
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
