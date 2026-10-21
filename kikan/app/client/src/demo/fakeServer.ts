// 見本版：サーバーの道筋（ルート）をブラウザの中で受け、fetch("/api/...") をここに回す
type Handler = (req: any, reply: any) => any;
type Route = { method: string; parts: string[]; handler: Handler };
const routes: Route[] = [];

function 登録(method: string, path: string, a: any, b?: any) {
  const handler: Handler = typeof a === "function" ? a : b;
  routes.push({ method, parts: path.split("/").filter(Boolean), handler });
}

/** Fastify と同じ書き方で道筋を登録できるもの（使うところだけ） */
const 本体: any = {
  get: (p: string, a: any, b?: any) => 登録("GET", p, a, b),
  post: (p: string, a: any, b?: any) => 登録("POST", p, a, b),
  delete: (p: string, a: any, b?: any) => 登録("DELETE", p, a, b),
  put: (p: string, a: any, b?: any) => 登録("PUT", p, a, b),
  register: async (fn: any) => fn(fakeApp),
};
// そのほかの設定（addHook・setErrorHandler など）は見本版では何もしない
export const fakeApp: any = new Proxy(本体, { get: (o, k: string) => (k in o ? o[k] : () => fakeApp) });

function 探す(method: string, path: string) {
  const parts = path.split("/").filter(Boolean).map(decodeURIComponent);
  for (const r of routes) {
    if (r.method !== method || r.parts.length !== parts.length) continue;
    const params: Record<string, string> = {};
    if (r.parts.every((p, i) => (p.startsWith(":") ? ((params[p.slice(1)] = parts[i]), true) : p === parts[i]))) return { r, params };
  }
  return null;
}

export async function 受ける(method: string, url: string, body: any): Promise<{ status: number; data: any; headers: Record<string, string> }> {
  const u = new URL(url, "http://demo");
  const hit = 探す(method, u.pathname);
  if (!hit) return { status: 404, data: { error: "見本版ではこの機能は使えません。" }, headers: {} };
  const query: Record<string, string> = {};
  u.searchParams.forEach((v, k) => (query[k] = v));
  let status = 200;
  let sent: any = undefined;
  const headers: Record<string, string> = {};
  const reply: any = {
    code(n: number) {
      status = n;
      return reply;
    },
    status(n: number) {
      status = n;
      return reply;
    },
    header(k: string, v: string) {
      headers[k] = v;
      return reply;
    },
    type(v: string) {
      headers["content-type"] = v;
      return reply;
    },
    send(x: any) {
      sent = x;
      return reply;
    },
  };
  const req: any = { method, url, query, params: hit.params, body, headers: {}, cookies: {}, user: { login: "demo", name: "見本", is_admin: true } };
  try {
    const out = await hit.r.handler(req, reply);
    const data = sent !== undefined ? sent : out === reply ? sent : out;
    return { status, data: data ?? {}, headers };
  } catch (e: any) {
    console.error(e);
    return { status: 500, data: { error: e?.message ?? String(e) }, headers };
  }
}

/** fetch("/api/...") を横取りする */
export function fetchを回す() {
  const 元 = window.fetch.bind(window);
  window.fetch = async (input: any, init?: any) => {
    const url = typeof input === "string" ? input : input.url;
    if (!url.startsWith("/api/")) return 元(input, init);
    const method = (init?.method ?? "GET").toUpperCase();
    let body: any = undefined;
    if (init?.body && typeof init.body === "string") body = JSON.parse(init.body);
    else if (init?.body) body = init.body;
    const r = await 受ける(method, url, body);
    return new Response(JSON.stringify(r.data), { status: r.status, headers: { "content-type": "application/json" } });
  };
}
