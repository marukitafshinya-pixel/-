// 見本版のログイン（server/auth.ts の代わり）。いつも「見本」の人としてログインしている
import type { FastifyInstance } from "fastify";

export type User = { login: string; name: string; is_admin: boolean };
const 見本 = { login: "demo", name: "見本", is_admin: true };

export async function requireUser(req: any) {
  req.user = 見本;
}

export function hashPassword(pw: string) {
  return pw;
}

export function authRoutes(app: FastifyInstance) {
  app.post("/api/login", async () => 見本);
  app.post("/api/logout", async () => ({ ok: true }));
  app.get("/api/me", async () => 見本);
}
