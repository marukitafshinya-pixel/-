// 利用者を作る（または、パスワードを付け直す）。
// 使い方: npm run create-user -- <ログインID> <名前> <パスワード> [admin]
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { pool } from "../db.js";
import { hashPassword } from "../auth.js";

const [login, name, password, admin] = process.argv.slice(2);
if (!login || !name || !password) {
  console.error("使い方: npm run create-user -- <ログインID> <名前> <パスワード> [admin]");
  process.exit(1);
}
const here = dirname(fileURLToPath(import.meta.url));
await pool.query(readFileSync(join(here, "..", "schema.sql"), "utf8"));
await pool.query(
  `INSERT INTO app.users (login, name, pass_hash, is_admin) VALUES ($1, $2, $3, $4)
   ON CONFLICT (login) DO UPDATE SET name = EXCLUDED.name, pass_hash = EXCLUDED.pass_hash, is_admin = EXCLUDED.is_admin`,
  [login, name, hashPassword(password), admin === "admin"],
);
console.log(`利用者「${login}」を登録しました`);
await pool.end();
