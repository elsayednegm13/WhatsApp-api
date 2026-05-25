import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { createCipheriv, createDecipheriv, createHmac, pbkdf2Sync, randomBytes, randomUUID, timingSafeEqual } from "node:crypto";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

const secretPath = fileURLToPath(new URL("../../data/.app-secret", import.meta.url));

function base64url(input) {
  return Buffer.from(input).toString("base64url");
}

function parseBase64url(input) {
  return Buffer.from(input, "base64url").toString("utf8");
}

export function getAppSecret() {
  if (process.env.APP_SECRET) return process.env.APP_SECRET;
  if (process.env.VERCEL) {
    return process.env.APP_SECRET || "demo-vercel-secret-change-me-in-production";
  }
  if (!existsSync(secretPath)) {
    mkdirSync(dirname(secretPath), { recursive: true });
    writeFileSync(secretPath, randomBytes(48).toString("hex"), { mode: 0o600 });
  }
  return readFileSync(secretPath, "utf8").trim();
}

export function hashPassword(password, salt = randomBytes(16).toString("hex")) {
  const hash = pbkdf2Sync(password, salt, 120000, 32, "sha256").toString("hex");
  return { salt, passwordHash: hash };
}

export function verifyPassword(password, user) {
  const current = Buffer.from(user.passwordHash, "hex");
  const candidate = Buffer.from(hashPassword(password, user.salt).passwordHash, "hex");
  return current.length === candidate.length && timingSafeEqual(current, candidate);
}

export function signToken(payload, ttlMs = 1000 * 60 * 60 * 12) {
  const header = { alg: "HS256", typ: "JWT" };
  const body = {
    ...payload,
    jti: randomUUID(),
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor((Date.now() + ttlMs) / 1000)
  };
  const unsigned = `${base64url(JSON.stringify(header))}.${base64url(JSON.stringify(body))}`;
  const signature = createHmac("sha256", getAppSecret()).update(unsigned).digest("base64url");
  return `${unsigned}.${signature}`;
}

export function verifyToken(token) {
  const parts = String(token || "").split(".");
  if (parts.length !== 3) throw new Error("Invalid token");
  const [header, body, signature] = parts;
  const unsigned = `${header}.${body}`;
  const expected = createHmac("sha256", getAppSecret()).update(unsigned).digest("base64url");
  const provided = Buffer.from(signature);
  const actual = Buffer.from(expected);
  if (provided.length !== actual.length || !timingSafeEqual(provided, actual)) {
    throw new Error("Invalid token signature");
  }
  const payload = JSON.parse(parseBase64url(body));
  if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) {
    throw new Error("Token expired");
  }
  return payload;
}

function encryptionKey() {
  return createHmac("sha256", getAppSecret()).update("whatsapp-settings").digest();
}

export function encryptValue(value) {
  if (!value) return null;
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(String(value), "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `enc:${iv.toString("base64url")}:${tag.toString("base64url")}:${encrypted.toString("base64url")}`;
}

export function decryptValue(value) {
  if (!value) return "";
  if (!String(value).startsWith("enc:")) return String(value);
  const [, ivText, tagText, encryptedText] = String(value).split(":");
  const decipher = createDecipheriv("aes-256-gcm", encryptionKey(), Buffer.from(ivText, "base64url"));
  decipher.setAuthTag(Buffer.from(tagText, "base64url"));
  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(encryptedText, "base64url")),
    decipher.final()
  ]);
  return decrypted.toString("utf8");
}

export function verifyHmacSha256(rawBody, signatureHeader, secret) {
  if (!signatureHeader || !secret) return true;
  const signature = signatureHeader.replace("sha256=", "");
  const expected = createHmac("sha256", secret).update(rawBody).digest("hex");
  const provided = Buffer.from(signature, "hex");
  const actual = Buffer.from(expected, "hex");
  return provided.length === actual.length && timingSafeEqual(provided, actual);
}
