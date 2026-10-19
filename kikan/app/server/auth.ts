import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { q } from "./db.js";

const COOKIE = "kikan_session";
const DAYS = 14;

export function hashPassword(pw: string): string {
  const salt = randomBytes(16);
  const hash = scryptSync(pw, salt, 32);
  return `scrypt$${salt.toString("hex")}$${hash.toString("hex")}`;
}

function verify(pw: string, stored: string): boolean {
  const [kind, saltHex, hashHex] = stored.split("$");
  if (kind !== "scrypt") return false;
  const hash = scryptSync(pw, Buffer.from(saltHex, "hex"), 32);
  return timingSafeEqual(hash, Buffer.from(hashHex, "hex"));
}

export type User = { login: string; name: string; is_admin: boolean };

declare module "fastify" {
  interface FastifyRequest {
    user?: User;
  }
}

export async function requireUser(req: FastifyRequest, reply: FastifyReply) {
  const token = req.cookies[COOKIE];
  if (token) {
    const rows = await q<User>(
      `SELECT u.login, u.name, u.is_admin FROM app.sessions s JOIN app.users u USING (login)
       WHERE s.token = $1 AND s.expires_at > now() AND NOT u.disabled`,
      [token],
    );
    if (rows[0]) {
      req.user = rows[0];
      return;
    }
  }
  reply.code(401).send({ error: "ログインしてください" });
}

export function authRoutes(app: FastifyInstance) {
  app.post<{ Body: { login: string; password: string } }>("/api/login", async (req, reply) => {
    const { login, password } = req.body ?? ({} as any);
    const rows = await q<{ pass_hash: string; disabled: boolean }>(
      "SELECT pass_hash, disabled FROM app.users WHERE login = $1",
      [login],
    );
    if (!rows[0] || rows[0].disabled || !verify(password ?? "", rows[0].pass_hash)) {
      return reply.code(401).send({ error: "ログインIDかパスワードが違います" });
    }
    const token = randomBytes(32).toString("hex");
    await q(`INSERT INTO app.sessions (token, login, expires_at) VALUES ($1, $2, now() + interval '${DAYS} days')`, [
      token,
      login,
    ]);
    reply.setCookie(COOKIE, token, { path: "/", httpOnly: true, sameSite: "lax", maxAge: DAYS * 86400 });
    return { ok: true };
  });

  app.post("/api/logout", async (req, reply) => {
    const token = req.cookies[COOKIE];
    if (token) await q("DELETE FROM app.sessions WHERE token = $1", [token]);
    reply.clearCookie(COOKIE, { path: "/" });
    return { ok: true };
  });

  app.get("/api/me", { preHandler: requireUser }, async (req) => req.user);
}
