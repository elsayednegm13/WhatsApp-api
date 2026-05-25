import { randomUUID } from "node:crypto";
import { requirePermission } from "../lib/auth.js";
import { readDb, updateDb } from "../lib/db.js";
import { readJson, requireFields, sendJson } from "../lib/router.js";
import { sendWhatsAppMessage } from "../lib/whatsapp.js";

function sortNewest(items) {
  return items.slice().sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
}

function filterMessages(messages, query) {
  let result = messages.slice();
  const direction = query.get("direction");
  const search = query.get("search");
  if (direction && direction !== "all") result = result.filter((message) => message.direction === direction);
  if (search) {
    const value = search.toLowerCase();
    result = result.filter(
      (message) =>
        String(message.text).toLowerCase().includes(value) ||
        String(message.contactName).toLowerCase().includes(value) ||
        String(message.from).includes(value) ||
        String(message.to).includes(value)
    );
  }
  return sortNewest(result);
}

export function registerMessageRoutes(router) {
  router.add("GET", "/api/dashboard", async ({ req, res }) => {
    await requirePermission(req, "dashboard:read");
    const db = await readDb();
    const inbound = db.messages.filter((message) => message.direction === "inbound").length;
    const outbound = db.messages.filter((message) => message.direction === "outbound").length;
    const autoReplies = db.messages.filter((message) => message.direction === "outbound" && message.matchedRuleId).length;
    const activeRules = db.autoReplies.filter((rule) => rule.enabled).length;
    sendJson(res, 200, {
      stats: { inbound, outbound, autoReplies, activeRules },
      recentMessages: sortNewest(db.messages).slice(0, 6)
    });
  });

  router.add("GET", "/api/messages", async ({ req, res, url }) => {
    await requirePermission(req, "messages:read");
    const db = await readDb();
    sendJson(res, 200, { messages: filterMessages(db.messages, url.searchParams) });
  });

  router.add("POST", "/api/messages/send", async ({ req, res }) => {
    await requirePermission(req, "messages:send");
    const { body } = await readJson(req);
    requireFields(body, ["to", "text"]);
    const db = await readDb();
    const settings = db.settings;
    const createdAt = new Date().toISOString();
    const message = {
      id: randomUUID(),
      waMessageId: null,
      direction: "outbound",
      from: settings.businessPhone,
      to: body.to,
      contactName: body.contactName || body.to,
      text: body.text,
      status: "pending",
      matchedRuleId: body.matchedRuleId || null,
      raw: null,
      error: null,
      createdAt
    };

    try {
      const result = await sendWhatsAppMessage(settings, message);
      message.waMessageId = result.providerMessageId;
      message.status = "sent";
      message.raw = result.providerResponse || null;
    } catch (error) {
      message.status = "failed";
      message.error = error.message;
    }

    await updateDb((data) => {
      data.messages.push(message);
    });
    sendJson(res, message.status === "sent" ? 201 : 202, { message });
  });
}
