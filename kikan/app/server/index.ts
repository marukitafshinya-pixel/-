import Fastify from "fastify";
import cookie from "@fastify/cookie";
import fstatic from "@fastify/static";
import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { pool } from "./db.js";
import { authRoutes } from "./auth.js";
import { juchuRoutes } from "./juchu.js";

const here = dirname(fileURLToPath(import.meta.url));
const app = Fastify({ logger: { level: process.env.LOG_LEVEL ?? "info" } });

await pool.query(readFileSync(join(here, "schema.sql"), "utf8"));

await app.register(cookie);
authRoutes(app);
await app.register(async (a) => juchuRoutes(a));

// 画面（vite build の結果）を配る
const dist = join(here, "..", "dist");
if (existsSync(dist)) {
  await app.register(fstatic, { root: dist });
  app.setNotFoundHandler((req, reply) =>
    req.url.startsWith("/api/") ? reply.code(404).send({ error: "not found" }) : reply.sendFile("index.html"),
  );
}

const port = Number(process.env.PORT ?? 3000);
await app.listen({ port, host: process.env.HOST ?? "127.0.0.1" });
