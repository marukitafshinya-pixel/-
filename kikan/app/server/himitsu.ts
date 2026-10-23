import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from "node:crypto";

// 相手先サイトのパスワードなどを暗号にしてしまう（AES-256-GCM）。鍵はサーバーの設定 WEB_RENKEI_KEY から作り、プログラムやデータベースには置かない。
function 鍵(): Buffer | null {
  const k = process.env.WEB_RENKEI_KEY;
  return k ? scryptSync(k, "kikan-web-renkei", 32) : null;
}
export const 鍵がある = () => !!process.env.WEB_RENKEI_KEY;

export function 暗号にする(平文: string): string {
  const key = 鍵();
  if (!key) throw new Error("暗号の鍵（WEB_RENKEI_KEY）がサーバーに設定されていないため、保存できません。");
  const iv = randomBytes(12);
  const c = createCipheriv("aes-256-gcm", key, iv);
  const body = Buffer.concat([c.update(平文, "utf8"), c.final()]);
  return ["v1", iv.toString("base64"), c.getAuthTag().toString("base64"), body.toString("base64")].join(":");
}

export function 元に戻す(暗号: string): string {
  const key = 鍵();
  if (!key) throw new Error("暗号の鍵（WEB_RENKEI_KEY）がサーバーに設定されていません。");
  const [v, iv, tag, body] = 暗号.split(":");
  if (v !== "v1") throw new Error("暗号の形が違います");
  const d = createDecipheriv("aes-256-gcm", key, Buffer.from(iv, "base64"));
  d.setAuthTag(Buffer.from(tag, "base64"));
  return Buffer.concat([d.update(Buffer.from(body, "base64")), d.final()]).toString("utf8");
}
