import { randomUUID } from "node:crypto";
import { decryptValue } from "./security.js";

export function matchAutoReply(text, rules) {
  const value = String(text || "");
  return rules
    .filter((rule) => rule.enabled)
    .sort((a, b) => Number(a.priority || 0) - Number(b.priority || 0))
    .find((rule) => {
      const source = rule.caseSensitive ? value : value.toLowerCase();
      const keyword = rule.caseSensitive ? rule.keyword : String(rule.keyword || "").toLowerCase();
      if (rule.matchType === "exact") return source === keyword;
      if (rule.matchType === "startsWith") return source.startsWith(keyword);
      if (rule.matchType === "regex") {
        try {
          return new RegExp(rule.keyword, rule.caseSensitive ? "" : "i").test(value);
        } catch {
          return false;
        }
      }
      return source.includes(keyword);
    });
}

export function extractIncomingMessages(payload, settings) {
  if (payload.from && payload.text) {
    return [
      {
        waMessageId: payload.waMessageId || `local.webhook.${Date.now()}`,
        from: payload.from,
        to: settings.businessPhone,
        contactName: payload.contactName || payload.from,
        text: payload.text,
        raw: payload,
        createdAt: new Date().toISOString()
      }
    ];
  }

  const messages = [];
  for (const entry of payload.entry || []) {
    for (const change of entry.changes || []) {
      const value = change.value || {};
      const contacts = new Map((value.contacts || []).map((contact) => [contact.wa_id, contact.profile?.name || contact.wa_id]));
      for (const message of value.messages || []) {
        const text =
          message.text?.body ||
          message.button?.text ||
          message.interactive?.button_reply?.title ||
          message.interactive?.list_reply?.title ||
          "";
        messages.push({
          waMessageId: message.id,
          from: message.from,
          to: value.metadata?.display_phone_number || settings.businessPhone,
          contactName: contacts.get(message.from) || message.from,
          text,
          raw: message,
          createdAt: message.timestamp
            ? new Date(Number(message.timestamp) * 1000).toISOString()
            : new Date().toISOString()
        });
      }
    }
  }
  return messages;
}

export async function sendWhatsAppMessage(settings, payload) {
  if (settings.sendMode !== "cloud") {
    return {
      provider: "mock",
      providerMessageId: `local.mock.${randomUUID()}`
    };
  }

  const accessToken = decryptValue(settings.encryptedAccessToken);
  if (!accessToken || !settings.phoneNumberId) {
    const error = new Error("WhatsApp Cloud API credentials are incomplete.");
    error.status = 422;
    throw error;
  }

  const graphVersion = process.env.WHATSAPP_GRAPH_VERSION || "v20.0";
  const response = await fetch(`https://graph.facebook.com/${graphVersion}/${settings.phoneNumberId}/messages`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to: payload.to,
      type: "text",
      text: { preview_url: false, body: payload.text }
    })
  });

  const result = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(result.error?.message || "WhatsApp Cloud API request failed.");
    error.status = response.status;
    error.providerError = result;
    throw error;
  }

  return {
    provider: "cloud",
    providerMessageId: result.messages?.[0]?.id || null,
    providerResponse: result
  };
}
