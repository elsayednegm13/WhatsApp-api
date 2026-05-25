import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";
import { encryptValue, hashPassword } from "./security.js";
import { rolePermissions } from "./permissions.js";

const localDbPath = fileURLToPath(new URL("../../data/db.json", import.meta.url));
const ephemeralDbPath = join(tmpdir(), "whatsapp-api-admin-db.json");
const dbPath = process.env.DB_FILE_PATH || (process.env.VERCEL ? ephemeralDbPath : localDbPath);
const kvKey = process.env.KV_DB_KEY || "whatsapp-api-admin:db";

function now() {
  return new Date().toISOString();
}

function seedUser({ name, email, password, role }) {
  const passwordData = hashPassword(password);
  return {
    id: randomUUID(),
    name,
    email,
    ...passwordData,
    role,
    status: "active",
    lastLoginAt: null,
    createdAt: now(),
    updatedAt: now()
  };
}

function seedUsers() {
  const adminEmail = process.env.ADMIN_EMAIL;
  const adminPassword = process.env.ADMIN_PASSWORD;
  const adminName = process.env.ADMIN_NAME || "مدير النظام";

  if (adminEmail || adminPassword) {
    if (!adminEmail || !adminPassword) {
      throw new Error("ADMIN_EMAIL and ADMIN_PASSWORD must both be configured, or both omitted to use demo users.");
    }
    return [seedUser({ name: adminName, email: adminEmail, password: adminPassword, role: "admin" })];
  }

  return [
    seedUser({ name: "ليلى منصور", email: "admin@demo.local", password: "Admin@123", role: "admin" }),
    seedUser({ name: "أحمد سالم", email: "agent@demo.local", password: "Agent@123", role: "agent" }),
    seedUser({ name: "نور علي", email: "viewer@demo.local", password: "Viewer@123", role: "viewer" })
  ];
}

function initialData() {
  return {
    users: seedUsers(),
    messages: [
      {
        id: randomUUID(),
        waMessageId: "wamid.seed.1001",
        direction: "inbound",
        from: "+201001112233",
        to: "+201055501234",
        contactName: "سارة خالد",
        text: "مرحبًا، أريد معرفة حالة طلبي",
        status: "received",
        matchedRuleId: "rule_order_status",
        raw: null,
        error: null,
        createdAt: "2026-05-25T06:12:00.000Z"
      },
      {
        id: randomUUID(),
        waMessageId: "local.seed.1002",
        direction: "outbound",
        from: "+201055501234",
        to: "+201001112233",
        contactName: "سارة خالد",
        text: "أرسل لنا رقم الطلب وسنراجع حالته فورًا.",
        status: "sent",
        matchedRuleId: "rule_order_status",
        raw: null,
        error: null,
        createdAt: "2026-05-25T06:12:02.000Z"
      },
      {
        id: randomUUID(),
        waMessageId: "wamid.seed.1003",
        direction: "inbound",
        from: "+201002224455",
        to: "+201055501234",
        contactName: "مروان فؤاد",
        text: "ما مواعيد العمل؟",
        status: "received",
        matchedRuleId: "rule_hours",
        raw: null,
        error: null,
        createdAt: "2026-05-25T07:04:00.000Z"
      }
    ],
    autoReplies: [
      {
        id: "rule_order_status",
        name: "حالة الطلب",
        keyword: "حالة طلبي",
        matchType: "contains",
        replyText: "أرسل لنا رقم الطلب وسنراجع حالته فورًا.",
        priority: 1,
        enabled: true,
        caseSensitive: false,
        createdAt: now(),
        updatedAt: now()
      },
      {
        id: "rule_hours",
        name: "مواعيد العمل",
        keyword: "مواعيد العمل",
        matchType: "contains",
        replyText: "مواعيد العمل من 9 صباحًا حتى 6 مساءً، من الأحد إلى الخميس.",
        priority: 2,
        enabled: true,
        caseSensitive: false,
        createdAt: now(),
        updatedAt: now()
      }
    ],
    settings: {
      businessName: "Nile Support",
      phoneNumberId: "1234567890",
      businessPhone: "+201055501234",
      webhookUrl: "/api/webhooks/whatsapp",
      encryptedVerifyToken: encryptValue("demo_verify_token"),
      encryptedAccessToken: null,
      encryptedAppSecret: null,
      sendMode: "mock",
      autoReplyEnabled: true,
      updatedAt: now()
    },
    revokedTokenIds: []
  };
}

function hasKvStore() {
  return Boolean(process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN);
}

async function kvCommand(command, ...args) {
  const response = await fetch(process.env.KV_REST_API_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.KV_REST_API_TOKEN}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify([command, ...args])
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload.error || `KV command failed: ${command}`);
  }
  return payload.result;
}

export async function ensureDb() {
  if (hasKvStore()) {
    const existing = await kvCommand("GET", kvKey);
    if (!existing) await kvCommand("SET", kvKey, JSON.stringify(initialData()));
    return;
  }
  if (!existsSync(dbPath)) {
    mkdirSync(dirname(dbPath), { recursive: true });
    writeFileSync(dbPath, JSON.stringify(initialData(), null, 2));
  }
}

export async function readDb() {
  await ensureDb();
  if (hasKvStore()) {
    const value = await kvCommand("GET", kvKey);
    return typeof value === "string" ? JSON.parse(value) : value;
  }
  return JSON.parse(readFileSync(dbPath, "utf8"));
}

export async function writeDb(data) {
  if (hasKvStore()) {
    await kvCommand("SET", kvKey, JSON.stringify(data));
    return;
  }
  mkdirSync(dirname(dbPath), { recursive: true });
  writeFileSync(dbPath, JSON.stringify(data, null, 2));
}

export async function updateDb(mutator) {
  const data = await readDb();
  const result = mutator(data);
  await writeDb(data);
  return result;
}

export function publicUser(user) {
  if (!user) return null;
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    status: user.status,
    lastLoginAt: user.lastLoginAt,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
    permissions: rolePermissions[user.role] || []
  };
}

export { dbPath };
