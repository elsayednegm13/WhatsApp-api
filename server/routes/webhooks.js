import { randomUUID } from "node:crypto";
import { requirePermission } from "../lib/auth.js";
import { readDb, updateDb } from "../lib/db.js";
import { decryptValue, verifyHmacSha256 } from "../lib/security.js";
import { httpError, readJson, requireFields, sendJson } from "../lib/router.js";
import { extractIncomingMessages, matchAutoReply, sendWhatsAppMessage } from "../lib/whatsapp.js";

function sendText(res, status, text) {
  res.writeHead(status, { "Content-Type": "text/plain; charset=utf-8" });
  res.end(text);
}

async function processIncomingPayload(payload) {
  const db = await readDb();
  const settings = db.settings;
  const incoming = extractIncomingMessages(payload, settings);
  const savedMessages = [];
  const replies = [];

  for (const item of incoming) {
    const rule = settings.autoReplyEnabled ? matchAutoReply(item.text, db.autoReplies) : null;
    const inbound = {
      id: randomUUID(),
      waMessageId: item.waMessageId,
      direction: "inbound",
      from: item.from,
      to: item.to || settings.businessPhone,
      contactName: item.contactName || item.from,
      text: item.text,
      status: "received",
      matchedRuleId: rule?.id || null,
      raw: item.raw || null,
      error: null,
      createdAt: item.createdAt || new Date().toISOString()
    };
    savedMessages.push(inbound);

    if (rule) {
      const outbound = {
        id: randomUUID(),
        waMessageId: null,
        direction: "outbound",
        from: settings.businessPhone,
        to: inbound.from,
        contactName: inbound.contactName,
        text: rule.replyText,
        status: "pending",
        matchedRuleId: rule.id,
        raw: null,
        error: null,
        createdAt: new Date().toISOString()
      };
      try {
        const sendResult = await sendWhatsAppMessage(settings, outbound);
        outbound.waMessageId = sendResult.providerMessageId;
        outbound.status = "sent";
        outbound.raw = sendResult.providerResponse || null;
      } catch (error) {
        outbound.status = "failed";
        outbound.error = error.message;
      }
      savedMessages.push(outbound);
      replies.push({ inboundId: inbound.id, ruleId: rule.id, message: outbound });
    }
  }

  if (savedMessages.length > 0) {
    await updateDb((data) => {
      data.messages.push(...savedMessages);
    });
  }

  return { inboundCount: incoming.length, savedMessages, replies };
}

export function registerWebhookRoutes(router) {
  router.add("GET", "/api/webhooks/whatsapp", async ({ res, url }) => {
    const db = await readDb();
    const verifyToken = decryptValue(db.settings.encryptedVerifyToken) || process.env.WHATSAPP_VERIFY_TOKEN;
    const mode = url.searchParams.get("hub.mode");
    const token = url.searchParams.get("hub.verify_token");
    const challenge = url.searchParams.get("hub.challenge");

    if (mode === "subscribe" && token && challenge && token === verifyToken) {
      sendText(res, 200, challenge);
      return;
    }
    throw httpError(403, "Webhook verification failed.");
  });

  router.add("POST", "/api/webhooks/whatsapp", async ({ req, res }) => {
    const { body, rawBody } = await readJson(req);
    const db = await readDb();
    const appSecret = decryptValue(db.settings.encryptedAppSecret);
    const signature = req.headers["x-hub-signature-256"];
    if (signature && !verifyHmacSha256(rawBody, signature, appSecret)) {
      throw httpError(401, "Invalid webhook signature.");
    }
    const result = await processIncomingPayload(body);
    sendJson(res, 200, { ok: true, ...result });
  });

  router.add("POST", "/api/webhooks/whatsapp/simulate", async ({ req, res }) => {
    await requirePermission(req, "messages:send");
    const { body } = await readJson(req);
    requireFields(body, ["from", "text"]);
    const result = await processIncomingPayload({
      from: body.from,
      contactName: body.contactName || body.from,
      text: body.text,
      waMessageId: `local.simulated.${Date.now()}`
    });
    sendJson(res, 201, {
      inbound: result.savedMessages.find((message) => message.direction === "inbound") || null,
      reply: result.savedMessages.find((message) => message.direction === "outbound") || null,
      matchedRule: result.replies[0]?.ruleId || null
    });
  });
}
